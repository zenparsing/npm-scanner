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

    return traverseFileSystem(path, path => { 
    
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
    
        var child = spawn("tar", ["xvfz", path], {

            cwd: dest,
            env: process.env,
            stdio: "inherit"
        });

        child.on("exit", code => {

            if (code) reject(code);
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
            // force Node to maintain the correct enumeration order in the
            // resulting object.
            
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
        
        this.log(`Processing package ${ realName }`);
        
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
            
            // TODO: Error recovery?  Move to next?
            throw x;
        }
        
        this.log(`Downloading package archive [${ tarball }]`);
        var archive = null;
        
        try {
        
            archive = await http("GET", tarball, { file: Path.join(this.folder, "*") });
        
        } catch (x) {
        
            this.log(`Error occured while downloading archive`);
            this.log(x.toString());
            
            // TODO: Error recovery?  Move to next?
            throw x;
        }
        
        var packageFolder = Path.join(this.folder, "package");
    
        this.log(`Clearing package folder [${ packageFolder }]`);
    
        await wipeout(packageFolder);
        await AsyncFS.mkdir(packageFolder);
    
        this.log(`Unpacking archive [${ archive }]`);
        await unpack(archive, packageFolder);
        
        this.log(`Removing archive file`);
        await wipeout(archive);
        
        this.log(`Processing package [${ realName }]`);
        var result = await this.processPackage(realName, packageFolder);
        
        if (result === void 0)
            result = {};
            
        this.data[name] = result;
        
        return true;
    }
    
    async open() {
    
        if (this.data)
            throw new Error("Already open");
        
        var path = Path.join(this.folder, "data.json"),
            content = null;
        
        this.log(`Attempting to read index file [${ path }]`);
        
        // Attempt to read the index file
        try { content = await AsyncFS.readFile(path) }
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
    
        var data = {};
        
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
    
    reset() {
    
        if (!this.data)
            throw new Error("Package index not loaded");
        
        Object.keys(this.data).forEach(key => this.data[key] = null);
    }
    
    log(msg) {
    
        console.log(msg);
    }
}

export async main() {

    var scanner = new NpmScanner("_modulespec");
    
    await scanner.open();
    await scanner.next();
    await scanner.close();
}