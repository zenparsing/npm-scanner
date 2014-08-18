var Path = require("path");

import { NpmScanner } from "../../src/NpmScanner.js";
import { parse } from "esparse";

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
        this.rootMain = 0;
        this.keystrokes = 0;
        this.moduleKeystrokes = 0;
        this.modulesWithImports = 0;
    }
}

class Scanner extends NpmScanner {

    createPackageData() {

        return new PackageData();
    }

    async processFile(path, data, { name, path: packageRoot }) {

        // Skip files not ending with ".js"
        if (Path.extname(path).toLowerCase() !== ".js")
            return;

        if (Path.basename(path) === "main.js") {

            if (Path.dirname(path) === Path.resolve(packageRoot) ||
                Path.dirname(path) === Path.resolve(packageRoot, "package")) {

                data.rootMain = 1;
            }
        }

        var text = await this.readFile(path, "utf8"),
            hasImports = false,
            ast = null;

        data.modules += 1;

        text = text.replace(SHEBANG, "");

        this.log(`    ${ path.slice(packageRoot.length + 1) }`);

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
                // new Function(text);
                return;

            } catch (x) {

                // If V8 cannot parse it, then skip the module
                return;
            }

            throw x;
        }

        visit(ast);

        var keystrokes = text.replace(/(^|\n)[ \t\r]+|[ \t]+(?=[\r\n])/g, "$1").length;

        data.keystrokes += keystrokes;

        if (hasImports) {

            data.modulesWithImports += 1;
            data.moduleKeystrokes += keystrokes;
        }

        // Save the file so that we can resume in the event of crash
        this.save();

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
                args[0].type === "StringLiteral") {

                arg = args[0].value;
            }

            if (!arg)
                return;

            if      (RELATIVE.test(arg))    data.relative += 1;
            else if (PLATFORM.test(arg))    data.platform += 1;
            else if (ABSOLUTE.test(arg))    data.absolute += 1;
            else                            data.package += 1;

            hasImports = true;
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

    if (arg === "skip") {

        await scanner.skip();
        await scanner.close();
        return;
    }

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
            if (i > 0) await delay(2000);
            await scanner.next();
        }

        report(scanner.data);

    //} catch (x) {

        //console.log("Oops");
        //setTimeout($=> {}, 60 * 1000);

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
        parseErrors: 0,
        keystrokes: 0,
        modulesWithImports: 0,
        moduleKeystrokes: 0,
    };

    var packages = 0,
        packageList = Object.keys(data),
        rootMain = 0;

    packageList.forEach(key => {

        var item = data[key];

        if (!item || typeof item.modules !== "number")
            return;

        packages += 1;
        rootMain += Math.min(item.rootMain, 1);
        sum.modules += item.modules;
        sum.platform += item.platform;
        sum.absolute += item.absolute;
        sum.relative += item.relative;
        sum.package += item.package;
        sum.parseErrors += item.parseErrors;
        sum.keystrokes += item.keystrokes;
        sum.modulesWithImports += item.modulesWithImports;
        sum.moduleKeystrokes += item.moduleKeystrokes;
    });

    var allPackage = sum.platform + sum.package;
    var total = sum.platform + sum.package + sum.relative + sum.absolute;
    var keysAdded = sum.platform * 5 + sum.package * 0 + sum.relative * 3;

    _(`\n=== Module Specifier Analysis ===\n`);
    _(`Packages Scanned: ${ packages } (${ (packages / packageList.length * 100).toFixed(2) }%)`);
    _(`Files Scanned: ${ sum.modules }`);
    _(`Modules with Imports: ${ formatCount(sum.modulesWithImports, sum.modules) }`);
    _(`Parse Errors: ${ sum.parseErrors }`);
    _(`Relative: ${ formatCount(sum.relative) }`);
    _(`System: ${ formatCount(sum.platform) }`);
    _(`Package: ${ formatCount(sum.package) }`);
    _(`Non-Relative: ${ formatCount(sum.platform + sum.package) }`);
    _('');
    _(`Average File Size: ${ (sum.keystrokes / sum.modules).toFixed(2) }`);
    _(`Average Module Size: ${ (sum.moduleKeystrokes / sum.modulesWithImports).toFixed(2) }`);
    _(`Keystroke Increase per Module: ${ (keysAdded / sum.modulesWithImports).toFixed(2) }`);
    _(`Keystroke Increase: ${ formatCount(keysAdded, sum.moduleKeystrokes) }`);
    _('');
    _(`Packages with main.js at root: ${ rootMain } (${ (rootMain / packages * 100).toFixed(1) }%)`);
    _('');

    function _(msg) {

        console.log(msg);
    }

    function formatCount(n, sum = total) {

        return `${ n } (${ (n / sum * 100).toFixed(2) }%)`;
    }
}
