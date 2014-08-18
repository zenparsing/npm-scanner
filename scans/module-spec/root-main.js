var Path = require("path");

import { NpmScanner } from "../../src/NpmScanner.js";

export async function main() {

    var scanner = new NpmScanner(Path.join(__dirname, "_top500"));
    
    await scanner.open();
    
    var data = scanner.data,
        chars = {};
    
    Object.keys(data).forEach(name => {
    
        if (data[name] && data[name].rootMain)
            console.log(name);
    });
}