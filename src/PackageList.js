module HTTP from "node:https";

function http(url) {

    return new Promise((resolve, reject) => {
    
        var output = "";

        var request = HTTP.request(url, response => {

            response.setEncoding("utf8");
            response.on("data", data => output += data);
            response.on("end", $=> resolve(output));
        });

        request.on("error", err => reject(err));
        request.end();
    });
    
}

export async main() {

    var data = await http("https://registry.npmjs.org/-/all");
    console.log(data);
}