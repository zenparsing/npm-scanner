module Path from "node:path";

import { AsyncFS } from "package:zen-bits";

export async main() {

    var data = JSON.parse(await AsyncFS.readFile(Path.join(__dirname, "_work/data.json")));
    
    var sum = {
    
        modules: 0,
        platform: 0,
        absolute: 0,
        relative: 0,
        package: 0,
        nonRelative: 0,
        parseErrors: 0
    };
    
    Object.keys(data).forEach(key => {
    
        var item = data[key];
        
        if (!item || !item.modules)
            return;
    
        sum.modules += item.modules;
        sum.platform += item.platform;
        sum.absolute += item.absolute;
        sum.relative += item.relative;
        sum.package += item.package;
        sum.parseErrors += item.parseErrors;
    });
    
    sum.nonRelative = sum.platform + sum.package;
    
    console.log(sum);
}