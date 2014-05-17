var Path = require("path");

import { NpmScanner } from "../../src/NpmScanner.js";
import { parse } from "package:esparse";

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
        
        var text = await this.readFile(path, "utf8"),
            ast = null;
        
        data.modules += 1;
        
        text = text.replace(SHEBANG, "");
        
        try {
        
            ast = parse("function m() { \n" + text + "\n }", { module: false });
            
        } catch (x) {
        
            data.parseErrors += 1;
            
            // Continue to next module
            this.log(`Error parsing module [${ path }]`);
            this.log(`  ${ x.toString() } [${ x.line }:${ x.column }]`);
        
            // ES6 does not allow call expressions on LHS of assignment
            if (x.message === "Invalid left-hand side in assignment")
                return;
            
            try {
            
                // Attempt to parse with V8, instead
                new Function(text);
            
            } catch (x) {
            
                // If V8 cannot parse it, then skip the module
                return;
            }
            
            throw x;
        }
        
        visit(ast);
        
        function visit(node) {
        
            // Depth first traversal
            node.children().forEach(visit);
            
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

function delay(ms) {

    return new Promise(resolve => setTimeout($=> resolve(null), ms));
}

export async function main() {

    var scanner = new Scanner(Path.join(__dirname, "_work")),
        arg = process.argv[2] || "",
        count = arg | 0 || 1;
    
    await scanner.open();
    
    if (arg === "reset!") {
    
        scanner.reset();
        await scanner.close();
        return;
    }
    
    if (arg === "reset-parse-errors") {
    
        scanner.reset(data => data.parseErrors > 0);
        await scanner.close();
        return;
    }
    
    if (arg === "report") {
    
        report(scanner.data);
        return;
    }
    
    try {
    
        for (var i = 0; i < count; ++i) {
        
            console.log("");
            if (i > 0) await delay(500);
            await scanner.next();
        }
        
        report(scanner.data);
    
    } finally {
    
        await scanner.close();
    }
}

function report(data) {

    var sum = {
    
        modules: 0,
        platform: 0,
        absolute: 0,
        relative: 0,
        package: 0,
        parseErrors: 0
    };
    
    var packages = 0,
        packageList = Object.keys(data);
    
    packageList.forEach(key => {
    
        var item = data[key];
        
        if (!item || typeof item.modules !== "number")
            return;
    
        packages += 1;
        sum.modules += item.modules;
        sum.platform += item.platform;
        sum.absolute += item.absolute;
        sum.relative += item.relative;
        sum.package += item.package;
        sum.parseErrors += item.parseErrors;
    });
    
    var allPackage = sum.platform + sum.package;
    var total = sum.platform + sum.package + sum.relative + sum.absolute;
    
    _(`\n=== Module Specifier Analysis ===\n`);
    _(`Packages Scanned: ${ packages } (${ (packages / packageList.length * 100).toFixed(1) }%)`);
    _(`Modules Scanned: ${ sum.modules }`);
    _(`Parse Errors: ${ sum.parseErrors }`);
    _(`Relative: ${ formatCount(sum.relative) }`);
    _(`System: ${ formatCount(sum.platform) }`);
    _(`Package: ${ formatCount(sum.package) }`);
    _(`Non-Relative: ${ formatCount(sum.platform + sum.package) }`);
    _('');
    
    function _(msg) {
    
        console.log(msg);
    }
    
    function formatCount(n) {
        
        return `${ n } (${ (n / total * 100).toFixed(1) }%)`;
    }
}
