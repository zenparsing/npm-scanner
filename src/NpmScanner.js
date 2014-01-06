module HTTP from "node:http";
module HTTPS from "node:https";
module URL from "node:url";
module Path from "node:path";
module FS from "node:fs";

import { spawn } from "node:child_process";
import { AsyncFS } from "package:zen-bits";

async traverseFileSystem(path, fn) {

    path = Path.resolve(path);
    
    var list = [];
    
    try { list = await AsyncFS.readdir(path) }
    catch (x) { }

    for (var i = 0; i < list.length; ++i)
        await traverseFileSystem(Path.join(path, list[i]), fn);
    
    if (await AsyncFS.exists(path))
        await fn(path);
}

async wipeout(path) {

    await traverseFileSystem(path, path => { 
    
        var stat;
        
        try { stat = await AsyncFS.stat(path) }
        catch (x) { }
        
        if (!stat)
            return;
        
        if (stat.isDirectory())
            await AsyncFS.rmdir(path);
        else
            await AsyncFS.unlink(path);
    });
}

async http(method, url, options) {

    return new Promise((resolve, reject) => {
    
        options = options || {};
        
        var requestInfo = URL.parse(url),
            makeRequest;
        
        switch (requestInfo.protocol.toLowerCase()) {
        
            case "http:": makeRequest = HTTP.request; break;
            case "https:": makeRequest = HTTPS.request; break;
            default: throw new Error("Invalid protocol");
        }
        
        var headers = options.headers || {};
        
        if (!headers.Host)
            headers.Host = options.hostname;
        
        if (!headers.Cookie)
            headers.Cookie = "";
        
        requestInfo.headers = headers;
        
        var request = makeRequest(requestInfo, response => {

            if (response.statusCode !== 200) {
            
                reject(new Error(`HTTP ${ response.statusCode }: ${ HTTP.STATUS_CODES[response.statusCode] }`));
                return;
            }
            
            if (options.file) {
            
                if (Path.basename(options.file) === "*")
                    options.file = options.file.replace(/\*$/, Path.basename(requestInfo.pathname));
                
                var filePath = Path.resolve(options.file);
                var file = FS.createWriteStream(filePath);
                
                response.pipe(file);
                file.on("finish", $=> resolve(filePath));
                
                return;
            }
            
            var body = "";
            
            response.setEncoding("utf8");
                        
            response.on("data", data => body += data);
            response.on("end", $=> resolve(body));
        });

        request.on("error", err => reject(err));
        request.end();
    });
    
}

async unpack(path, dest) {

    path = Path.resolve(path);
    dest = Path.resolve(dest);
    
    return new Promise((resolve, reject) => {
    
        var child = spawn("tar", ["xfz", path], {

            cwd: dest,
            env: process.env,
            stdio: "inherit"
        });

        child.on("exit", code => {

            if (code) reject(new Error(`tar command exited with error code ${ code }`));
            else resolve(code);
        });
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

    constructor(folder) {
    
        if (this.folder)
            throw new Error("Already open");
        
        if (typeof folder !== "string" || !folder)
            throw new Error("Invalid folder");
            
        this.folder = folder;
        this.data = null;
        this.packageList = null;
        this.position = 0;
    }
    
    async initialize() {
    
        var dest = Path.resolve(this.folder),
            stat;
    
        try { stat = await AsyncFS.stat(dest) }
        catch (x) {}
    
        if (!stat || !stat.isDirectory()) {
    
            this.log(`Creating target directory [${ dest }]`);
            await AsyncFS.mkdir(dest);
        }
    
        this.log(`Fetching package index from NPM registry (this may take several minutes)`);
        var response = await http("GET", "https://registry.npmjs.org/-/all");
    
        this.log(`Parsing JSON response`);
        var data; try { data = JSON.parse(response); }
        catch (x) { console.log(response.slice(0, 512)); throw x; }
    
        var list = [], length = 0;
    
        this.log(`Generating shuffled list of package names`);
        Object.keys(data).forEach(key => {
    
            if (key === "__updated")
                return;
        
            // Prefix with a dot if the package name is an integer.  This will
            // force V8 to maintain the correct enumeration order in the resulting 
            // object.
            
            if (key | 0 == key)
                key = "." + key;
                
            var r = rand(length);
        
            list[length++] = list[r];
            list[r] = key;
        });
    
        this.data = {};
        list.forEach(value => this.data[value] = null);
        
        this.packageList = list;
        
        // Since this operation is expensive, save before continuing
        this.save();
    }
    
    async next() {
    
        if (!this.data)
            await this.open();
        
        var name = "";
        
        while (this.position < this.packageList.length) {
        
            name = this.packageList[this.position++];
            
            if (this.data[name] === null)
                break;
        }
        
        if (this.position > this.packageList.length)
            return false;
        
        // Remove leading dot from key name to get the real package name
        var realName = name.replace(/^\./, "");
        
        var pct = (this.position / this.packageList.length * 100).toFixed(1);
        this.log(`Processing package ${ realName } (${ this.position } of ${ this.packageList.length }, ${ pct }%)`);
        
        var infoURL = `https://registry.npmjs.org/${ realName }/latest`;
        this.log(`Downloading package metadata [${ infoURL }]`);
        
        var tarball = null;
        
        try {
        
            var info = JSON.parse(await http("GET", infoURL));
            
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
        
        await traverseFileSystem(this.folder, path => {
        
            if ((/\.t(ar\.)?gz$/i).test(path))
                await AsyncFS.unlink(path);
        });
        
        this.log(`Downloading package archive [${ tarball }]`);
        var archive = null;
        
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
        
        var packageFolder = Path.join(this.folder, "package");
    
        this.log(`Clearing package folder [${ packageFolder }]`);
    
        try { 
        
            await wipeout(packageFolder);
        
        } catch (x) {
        
            if (x.message.startsWith("ENOTEMPTY"))
                this.log(`Unable to clear package folder - try removing the folder manually`);
            
            throw x;
        }
        
        await AsyncFS.mkdir(packageFolder);
    
        this.log(`Unpacking archive [${ archive }]`);
        await unpack(archive, packageFolder);
        
        this.log(`Analyzing package`);
        var result = await this.processPackage(realName, packageFolder);
        
        if (result === void 0)
            result = {};
            
        this.data[name] = result;
        
        this.log(`Analysis complete`);
        
        return true;
    }
    
    async open() {
    
        if (this.data)
            throw new Error("Already open");
        
        var path = Path.join(this.folder, "data.json"),
            content = null;
        
        this.log(`Attempting to read index file [${ path }]`);
        
        // Attempt to read the index file
        try { content = await AsyncFS.readFile(path, { encoding: "utf8" }) }
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
        
        var p = this.save();
        this.data = null;
        await p;
    }
    
    async processPackage(name, path) {
    
        var data = this.createPackageData();
        
        await traverseFileSystem(path, path => {
        
            var stat;
            
            try { stat = await AsyncFS.stat(path) }
            catch (x) { }
            
            if (!stat || !stat.isFile())
                return;
            
            await this.processFile(name, path, data);
        });
        
        return data;
    }
    
    async processFile(packageName, path, data) {
    
        throw new Error("Not implemented");
    }
    
    async save() {
    
        if (!this.data)
            throw new Error("Package index not loaded");
        
        await AsyncFS.writeFile(Path.join(this.folder, "data.json"), JSON.stringify(this.data));
    }
    
    reset(predicate) {
    
        if (!this.data)
            throw new Error("Package index not loaded");
        
        this.log(`Resetting package data`);
        
        if (typeof predicate !== "function")
            predicate = null;
        
        Object.keys(this.data).forEach(key => {
        
            if (predicate && this.data[key] !== null) {
            
                var name = key.replace(/^\./, "");
                
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

