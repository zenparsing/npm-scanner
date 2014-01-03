module HTTP from "node:https";
module HTTPS from "node:https";
module URL from "node:url";
module Path from "node:path";

import { spawn } from "node:child_process";
import { AsyncFS } from "package:zen-bits";

function http(method, url, headers) {

    return new Promise((resolve, reject) => {
    
        var options = URL.parse(url),
            makeRequest;
        
        switch (options.protocol.toLowerCase()) {
        
            case "http:": makeRequest = HTTP.request; break;
            case "https:": makeRequest = HTTPS.request; break;
            default: throw new Error("Invalid protocol");
        }
        
        headers = headers || {};
        
        if (!headers.Host)
            headers.Host = options.hostname;
        
        if (!headers.Cookie)
            headers.Cookie = "";
        
        options.headers = headers || {};
        
        var body = "";

        var request = makeRequest(options, response => {

            response.setEncoding("utf8");
            response.on("data", data => body += data);
            response.on("end", $=> resolve(body));
        });

        request.on("error", err => reject(err));
        request.end();
    });
    
}

function NPM(target) {

    target = Path.resolve(target);
    
    return async ƒ() {
    
        var args = [].slice.call(arguments, 0);
        
        return new Promise((resolve, reject) => {
    
            var child = spawn("npm", args, {
    
                cwd: target,
                env: process.env,
                stdio: "inherit"
            });
        
            child.on("exit", code => {
        
                if (code) reject(code);
                else resolve(code);
            });
        });
        
    };
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
    
            this.log(`Creating target directory [${ dest }].`);
            await AsyncFS.mkdir(dest);
        }
    
        this.log(`Writing empty package.json file at [${ dest }].`);
        await AsyncFS.writeFile(Path.join(dest, "package.json"), "{}");
    
        this.log(`Fetching package index from NPM registry.`);
        var response = await http("GET", "https://registry.npmjs.org/-/all");
    
        this.log(`Parsing JSON response`);
        var data = JSON.parse(response);
    
        var list = [], length = 0;
    
        this.log(`Generating shuffled list of package names.`);
        Object.keys(data).forEach(key => {
    
            if (key === "__updated")
                return;
        
            var r = rand(length);
        
            list[length++] = list[r];
            list[r] = key;
        });
    
        this.data = {};
        list.forEach(value => this.data[value] = null);
        
        this.packageList = list;
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
        
        var npm = NPM(this.folder);
        
        this.log(`Installing package ${ name }`);
        
        try { 
            
            await npm("install", name);
            
        } catch (x) { 
        
            this.log(`Unable to install package ${ name }.`);
            this.log(`Uninstalling package.`);
            
            try { await npm("rm", name) }
            catch (x) { }
            
            this.data[name] = { error: "Unable to install package" };
            return this.next();
        }
        
        try {
        
            var path = Path.join(this.folder, "node_modules");
            path = Path.join(path, name);
            
            this.data[name] = await this.process(name, path);
        
        } finally {
        
            this.log(`Uninstalling package.`);
            
            try { await npm("rm", name) }
            catch (x) { }
        }
    }
    
    async open() {
    
        if (this.data)
            throw new Error("Already open");
        
        var path = Path.join(this.folder, "data.json"),
            content = null;
        
        this.log(`Attempting to read index file [${ path }].`);
        
        // Attempt to read the index file
        try { content = await AsyncFS.readFile(path) }
        catch (x) { }
        
        // If the index does not exist, then attempt to initialize the folder
        if (content === null) {
        
            this.log(`Index could not be read.  Attempting to initialize folder.`);
            return await this.initialize();
        }
        
        this.log(`Parsing JSON package index.`);
        
        this.data = JSON.parse(content);
        this.packageList = Object.keys(this.data);
    }
    
    async close() {
    
        if (!this.data)
            throw new Error("Not open");
        
        var data = this.data;
        this.data = null;
        
        await AsyncFS.writeFile(Path.join(this.folder, "data.json"), JSON.stringify(data));
    }
    
    async process(name, path) {
    
        throw new Error("Not implemented");
    }
    
    log(msg) {
    
        console.log(msg);
    }
}

export async main() {

    var scanner = new NpmScanner("test/module-spec");
    await scanner.next();
    await scanner.close();
}