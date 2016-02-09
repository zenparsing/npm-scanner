import * as HTTP from "node:http";
import * as HTTPS from "node:https";
import * as URL from "node:url";
import * as Path from "node:path";

import { File, Directory } from "zen-fs";
import { wrapNode, decodeText, concatText } from "streamware";
import { extract, listEntries } from "ziptar";

function asyncHandler(fn) {

    return (...args) => {

        fn(...args).then(null, err => { setTimeout(_=> { throw err }, 0) });
    };
}

export function http(method, url, options = {}) {

    return new Promise((resolve, reject) => {

        let requestInfo = URL.parse(url),
            makeRequest;

        switch (requestInfo.protocol.toLowerCase()) {

            case "http:": makeRequest = HTTP.request; break;
            case "https:": makeRequest = HTTPS.request; break;
            default: throw new Error("Invalid protocol");
        }

        let headers = options.headers || {};

        if (!headers.Host)
            headers.Host = requestInfo.hostname;

        if (!headers.Cookie)
            headers.Cookie = "";

        requestInfo.headers = headers;

        let request = makeRequest(requestInfo, asyncHandler(async response => {

            if (response.statusCode !== 200) {

                reject(new Error(`HTTP ${ response.statusCode }: ${ HTTP.STATUS_CODES[response.statusCode] }`));
                return;
            }

            let inStream = wrapNode(response),
                filePath = options.file;

            if (filePath) {

                filePath = Path.resolve(filePath);

                if (Path.basename(filePath) === "*")
                    filePath = filePath.replace(/\*$/, Path.basename(requestInfo.pathname));

                await File.write(inStream, filePath);
                resolve(filePath);

            } else {

                resolve(await inStream::decodeText()::concatText());
            }

        }));

        request.on("error", err => reject(err));
        request.end();
    });
}

function rand(min, max) {

    if (max === void 0) {

        max = min;
        min = 0;
    }

    return min + Math.floor(Math.random() * (max - min + 1));
}

export class NpmScanner {

    constructor(folder, options = {}) {

        if (typeof folder !== "string" || !folder)
            throw new Error("Invalid folder");

        this.folder = folder;
        this.data = null;
        this.packageList = null;
        this.position = 0;
        this.options = options;
    }

    async initialize() {

        let dest = Path.resolve(this.folder),
            stat;

        this.log(`Creating target directory [${ dest }]`);
        Directory.create(dest);

        this.log(`Fetching package index from NPM registry (this may take several minutes)`);
        let response = await http("GET", "https://registry.npmjs.org/-/all");

        this.log(`Parsing JSON response`);
        let data; try { data = JSON.parse(response); }
        catch (x) { console.log(response.slice(0, 512)); throw x; }

        let list = [], length = 0;

        this.log(`Generating shuffled list of package names`);
        Object.keys(data).forEach(key => {

            if (key === "__updated")
                return;

            // Prefix with a dot if the package name is an integer.  This will
            // force V8 to maintain the correct enumeration order in the resulting
            // object.

            if (key | 0 == key)
                key = "." + key;

            let r = rand(length);

            list[length++] = list[r];
            list[r] = key;
        });

        this.data = {};
        list.forEach(value => this.data[value] = null);

        this.packageList = list;

        // Since this operation is expensive, save before continuing
        this.save();
    }

    async skip() {

        if (!this.data)
            await this.open();

        let name = "";

        while (this.position < this.packageList.length) {

            name = this.packageList[this.position++];

            if (this.data[name] === null) {

                this.log(`Skipping package [${ name }]`);
                this.data[name] = {}
                break;
            }
        }
    }

    async next() {

        if (!this.data)
            await this.open();

        let name = "";

        while (this.position < this.packageList.length) {

            name = this.packageList[this.position++];

            if (this.data[name] === null)
                break;
        }

        if (this.position > this.packageList.length)
            return false;

        // Remove leading dot from key name to get the real package name
        let realName = name.replace(/^\./, "");

        let pct = (this.position / this.packageList.length * 100).toFixed(1);
        this.log(`Processing package ${ realName } (${ this.position } of ${ this.packageList.length }, ${ pct }%)`);

        let infoURL = `https://registry.npmjs.org/${ realName }/latest`;
        this.log(`Downloading package metadata [${ infoURL }]`);

        let tarball = null;

        try {

            let info = JSON.parse(await http("GET", infoURL));

            if (!(info.dist && info.dist.tarball))
                throw new Error("Metadata does not contain an archive reference");

            tarball = info.dist.tarball;

        } catch (x) {

            this.log(`Unable to retrieve metadata for package [${ realName }]`);
            this.log(x.toString());

            // If package doesn't have a latest version, then skip it
            if (x.message.startsWith("HTTP 404")) {

                this.data[name] = { error: "Package metadata does not exist" };
                return;
            }

            throw x;
        }

        this.log(`Clearing old archive files`);

        await Directory.traverse(this.folder, async path => {

            if ((/\.t(ar\.)?gz$/i).test(path))
                await File.delete(path);
        });

        this.log(`Downloading package archive [${ tarball }]`);
        let archive = null;

        try {

            archive = await http("GET", tarball, { file: Path.join(this.folder, "*") });

        } catch (x) {

            this.log(`Error occured while downloading archive`);
            this.log(x.toString());

            if (x.message.startsWith("HTTP 404")) {

                this.data[name] = { error: "Archive does not exist" };
                return;
            }

            throw x;
        }

        this.log(`Analyzing package`);
        let packageData = this.createPackageData();

        if (this.options.extract) {

            await this.processPackage(realName, archive, packageData);

        } else {

            let packageInfo = { name: realName };

            for (let entry of await listEntries(archive))
                await this.processFile(entry.name, packageData, packageInfo);
        }

        this.data[name] = packageData;
        this.log(`Analysis complete`);

        return true;
    }

    async processPackage(name, archivePath, data) {

        let packageFolder = Path.join(this.folder, "package");

        this.log(`Clearing package folder [${ packageFolder }]`);

        try {

            await Directory.delete(packageFolder, true);

        } catch (x) {

            if (x.message.startsWith("ENOTEMPTY"))
                this.log(`Unable to clear package folder - try removing the folder manually`);

            throw x;
        }

        await Directory.create(packageFolder);

        this.log(`Unpacking archive [${ archivePath }]`);
        await extract(archivePath, packageFolder);

        let info = { name, path };

        await Directory.traverse(path, async path => {

            // Don't traverse into node_modules folders
            if (Path.basename(path) === "node_modules")
                return false;

            return true;

        }, async path => {

            if (await File.exists(path))
                await this.processFile(path, data, info);
        });
    }

    async open() {

        if (this.data)
            throw new Error("Already open");

        let path = Path.join(this.folder, "data.json"),
            content = null;

        this.log(`Attempting to read index file [${ path }]`);

        // Attempt to read the index file
        try { content = await File.readText(path) }
        catch (x) { }

        // If the index does not exist, then attempt to initialize the folder
        if (content === null) {

            this.log(`Index could not be read - attempting to initialize folder`);
            return await this.initialize();
        }

        this.log(`Parsing JSON package index`);

        this.data = JSON.parse(content);
        this.packageList = Object.keys(this.data);
    }

    async close() {

        if (!this.data)
            throw new Error("Not open");

        let p = this.save();
        this.data = null;
        await p;
    }

    async processFile(path, data, packageInfo) {

        throw new Error("Not implemented");
    }

    async readFile(path, encoding) {

        return encoding ? File.readText(path, encoding) : File.read(path);
    }

    async save() {

        if (!this.data)
            throw new Error("Package index not loaded");

        await File.writeText(Path.join(this.folder, "data.json"), JSON.stringify(this.data));
    }

    reset(predicate) {

        if (!this.data)
            throw new Error("Package index not loaded");

        this.log(`Resetting package data`);

        if (typeof predicate !== "function")
            predicate = null;

        Object.keys(this.data).forEach(key => {

            if (predicate && this.data[key] !== null) {

                let name = key.replace(/^\./, "");

                if (!predicate(this.data[key], name))
                    return;
            }

            this.data[key] = null;
        });
    }

    log(msg) {

        console.log(msg);
    }

    createPackageData() {

        return {};
    }
}
