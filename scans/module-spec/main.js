module Path from "node:path";

import { NpmScanner } from "../../src/NpmScanner.js";
import { parseScript } from "package:es6parse";
import { AsyncFS } from "package:zen-bits";

var NODE_LIB = [

    "_debugger",
    "_http_agent",
    "_http_client",
    "_http_common",
    "_http_incoming",
    "_http_outgoing",
    "_http_server",
    "_linklist",
    "_stream_duplex",
    "_stream_passthrough",
    "_stream_readable",
    "_stream_transform",
    "_stream_writable",
    "_tls_legacy",
    "_tls_wrap",
    "assert",
    "buffer",
    "child_process",
    "cluster",
    "console",
    "constants",
    "crypto",
    "dgram",
    "dns",
    "domain",
    "events",
    "freelist",
    "fs",
    "http",
    "https",
    "module",
    "net",
    "os",
    "path",
    "punycode",
    "querystring",
    "readline",
    "repl",
    "smalloc",
    "stream",
    "string_decoder",
    "sys",
    "timers",
    "tls",
    "tty",
    "url",
    "util",
    "vm",
    "zlib"
];

var PLATFORM = new RegExp("^(" + NODE_LIB.join("|") + ")$"),
    ABSOLUTE = /^([\\\/]|\w:[\\\/])/,
    RELATIVE = /^\./;

var SHEBANG = /(^|\r\n?|\n)#!.*/;


class PackageData {

    constructor() {
    
        this.modules = 0;
        this.parseErrors = 0;
        this.platform = 0;
        this.package = 0;
        this.relative = 0;
        this.absolute = 0;
    }
}

class Scanner extends NpmScanner {

    createPackageData() {
    
        return new PackageData();
    }
    
    async processFile(packageName, path, data) {
    
        // Skip files not ending with ".js"
        if (Path.extname(path).toLowerCase() !== ".js")
            return;
        
        var text = await AsyncFS.readFile(path, { encoding: "utf8" }),
            ast = null;
        
        data.modules += 1;
        
        try {
        
            ast = parseScript("function m() { " + text.replace(SHEBANG, "") + " }");
            
        } catch (x) {
        
            data.parseErrors += 1;
        
            // Continue to next module
            this.log(`Error parsing module [${ path }]`);
            this.log(`  ${ x.toString() }`);
            
            return;
        }
        
        visit(ast);
        
        function visit(node) {
        
            // Depth first traversal
            node.forEachChild(visit);
            
            if (node.type !== "CallExpression")
                return;
            
            var callee = node.callee,
                args = node.arguments,
                arg = "";
            
            if (callee.type === "Identifier" &&
                callee.value === "require" &&
                args.length > 0 &&
                args[0].type === "String") {
            
                arg = args[0].value;
            }
            
            if (!arg)
                return;
            
            if      (RELATIVE.test(arg))    data.relative += 1;
            else if (PLATFORM.test(arg))    data.platform += 1;
            else if (ABSOLUTE.test(arg))    data.absolute += 1;
            else                            data.package += 1;
        }
    }
    
}

async delay(ms) {

    return new Promise(resolve => setTimeout($=> resolve(null), ms));
}

export async main() {

    var scanner = new Scanner(Path.join(__dirname, "_work")),
        arg = process.argv[2] || "",
        count = arg | 0 || 1;
    
    await scanner.open();
    
    try {
    
        for (var i = 0; i < count; ++i) {
        
            if (i > 0) await delay(2000);
            await scanner.next();
        }
    
    } finally {
    
        await scanner.close();
    }
}