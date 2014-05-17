var Path = require("path");

import { NpmScanner } from "../../src/NpmScanner.js";

export async function main() {

    var scanner = new NpmScanner(Path.join(__dirname, "_work"));
    
    await scanner.open();
    
    var data = scanner.data,
        chars = {};
    
    Object.keys(data).forEach(name => {
    
        for (var i = 0, c; i < name.length; ++i) {
        
            c = name.charAt(i);
            
            if (typeof chars[c] !== "number")
                chars[c] = 0;
            
            chars[c] += 1;
        }
    });
    
    var list = Object.keys(chars)
        .map(chr => ({ chr, count: chars[chr] }))
        .sort((a, b) => b.count - a.count);
    
    print("\n== Characters Used in Package Names ==\n");
    
    list.forEach(item => {
    
        print(`${ item.chr }: ${ item.count }`);
    });
    
    function print(msg) { console.log(msg) }
}