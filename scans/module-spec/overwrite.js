var Path = require("path");

import { NpmScanner } from "../../src/NpmScanner.js";
import { openShell } from "zen-sh";

class PackageData {

    constructor() {

        this.overwrite = false;
        this.overwriteType = "";
        this.expando = [];
    }
}

class Scanner extends NpmScanner {

    createPackageData() {

        return new PackageData();
    }

    async processPackage(name, path) {

        var data = this.createPackageData();

        path = Path.join(path, "package");

        this.log("Installing dependencies");
        var sh = openShell({ cwd: path });

        try { await sh`npm install --production`.pipe() }
        catch (x) {}

        this.log("Loading package module");

        var cmd = "node -e '" +
            "var m = require(" + JSON.stringify(path) + ");" +
            "console.log(JSON.stringify({ " +
                "type: typeof m, " +
                "objectProto: Object.getPrototypeOf(m) === Object.prototype, " +
                "keys: Object.keys(m) }));" +
            "'";

        var info = JSON.parse((await sh(cmd)).output);

        if (info.type !== "object" || !info.objectProto) {

            data.overwrite = true;
            data.overwriteType = info.type;
            data.expando = info.keys;
        }

        await sh`exit`;

        return data;
    }

}

function delay(ms) {

    return new Promise(resolve => setTimeout($=> resolve(null), ms));
}

export async function main() {

    var scanner = new Scanner(Path.join(__dirname, "_overwrite")),
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

    if (arg === "report") {

        report(scanner.data);
        return;
    }

    if (arg === "query") {

        console.log(scanner.data[process.argv[3]]);
        return;
    }

    try {

        for (var i = 0; i < count; ++i) {

            console.log("");
            if (i > 0) await delay(500);
            await scanner.next();
            scanner.save();
        }

        report(scanner.data);

    } finally {

        await scanner.close();
    }
}

function report(data) {

    var sum = {

        overwrite: 0,
        expanded: 0,
        functionOverwrite: 0
    };

    var packages = 0,
        packageList = Object.keys(data);

    packageList.forEach(key => {

        var item = data[key];

        if (!item || typeof item.overwrite === "undefined")
            return;

        packages += 1;

        if (item.overwrite) {

            sum.overwrite += 1;

            if (item.overwriteType === "function") {

                sum.functionOverwrite += 1;

                if (item.expando.length > 0)
                    sum.expanded += 1;
            }
        }
    });

    _(`\n=== Module Overwrite Analysis ===\n`);
    _(`Packages Scanned: ${ packages } (${ pct(packages, packageList.length ) })`);
    _(`Custom Exports: ${ sum.overwrite } (${ pct(sum.overwrite, packages) })`);
    _(`Function Exports: ${ sum.functionOverwrite } (${ pct(sum.functionOverwrite, packages) }) (${ pct(sum.functionOverwrite, sum.overwrite) })`);
    _(`Function Exports with Expandos: ${ sum.expanded } (${ pct(sum.expanded, sum.functionOverwrite) }) (${ pct(sum.expanded, packages) })`);
    _(`Custom Exports without Expados: ${ sum.overwrite - sum.expanded } (${ pct(sum.overwrite - sum.expanded, packages) })`);
    _('');

    function _(msg) {

        console.log(msg);
    }

    function pct(n, total) {

        return `${ (n / total * 100).toFixed(1) }%`;
    }

    function formatCount(n, total) {

        return `${ n } (${ (n / total * 100).toFixed(1) }%)`;
    }
}
