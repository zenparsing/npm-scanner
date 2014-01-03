import { NpmScanner } from "NpmScanner.js";
import { parseModule } from "package:es6parse";
import { AsyncFS } from "package:zen-bits";

module Path from "node:path";

export class AstScanner extends NpmScanner {

    processFile(packageName, path, data) {
    
        // Skip all files that don't end with ".js"
        if (Path.extname(path).toLowerCase() !== ".js")
            return;
        
        // TODO
    }
    
    processAST(ast, packageName, path, data) {
    
        throw new Error("Not implemented");
    }

}
