const TOP_500 = [
    "underscore", "async", "request", "lodash", "commander", "express", "optimist", "coffee-script", "colors", "mkdirp", "debug", "q", "yeoman-generator", "moment", "chalk", "glob", "jade", "uglify-js", "redis", "socket.io", "through", "connect", "node-uuid", "cheerio", "mime", "winston", "through2", "grunt", "gulp-util", "mongodb", "semver", "ejs", "rimraf", "handlebars", "mongoose", "marked", "underscore.string", "xml2js", "mocha", "minimist", "less", "stylus", "js-yaml", "fs-extra", "superagent", "jsdom", "esprima", "wrench", "bluebird", "minimatch", "prompt", "event-stream", "pkginfo", "xtend", "jquery", "browserify", "mysql", "backbone", "extend", "shelljs", "readable-stream", "ws", "nopt", "when", "inherits", "passport", "cli-color", "nodemailer", "concat-stream", "should", "nconf", "validator", "clean-css", "qs", "chai", "http-proxy", "mustache", "ncp", "temp", "hiredis", "npm", "requirejs", "oauth", "socket.io-client", "aws-sdk", "open", "graceful-fs", "escodegen", "body-parser", "iconv-lite", "eventemitter2", "log4js", "bindings", "formidable", "tar", "bower", "uuid", "string", "grunt-contrib-jshint", "watch",
    "inquirer", "pg", "highlight.js", "cli-table", "phantomjs", "clone", "chokidar", "promise", "passport-oauth", "resolve", "dateformat", "step", "canvas", "nomnom", "gulp", "restify", "nib", "which", "yargs", "gm", "jshint", "co", "lru-cache", "yosay", "JSONStream", "xmldom", "bunyan", "nan", "hogan.js", "amdefine", "knox", "path", "sprintf", "split", "node.extend", "source-map", "swig", "querystring", "grunt-contrib-clean", "consolidate", "walk", "crypto", "adm-zip", "csv", "grunt-contrib-uglify", "findit", "progress", "once", "github", "sax", "send", "node-static", "restler", "read", "npmlog", "fstream", "serialport", "ssh2", "sugar", "traverse", "map-stream", "bcrypt", "sinon", "levelup", "sqlite3", "markdown", "passport-local", "cookie", "methods", "level", "vows", "js-beautify", "tmp", "nodeunit", "cookie-parser", "grunt-contrib-copy", "hyperquest", "rsvp", "grunt-contrib-watch", "inflection", "htmlparser2", "estraverse", "html-minifier", "gaze", "xmlhttprequest", "batch", "ini", "morgan", "generic-pool", "falafel", "MD5", "amqp", "htmlparser", "cli", "tape", "xmlbuilder", "archiver", "imagemagick", "node-sass", "rc",
    "required-keys", "es6-promise", "grunt-cli", "websocket", "hoek", "ms", "eco", "form-data", "connect-redis", "growl", "jasmine-node", "mout", "nano", "url", "eyes", "level-sublevel", "react", "ee-class", "libxmljs", "update-notifier", "merge", "argparse", "ee-log", "fs.extra", "dustjs-linkedin", "leveldown", "colorful", "dnode", "sequelize", "thunkify", "connect-flash", "cradle", "fibers", "cookies", "css-parse", "iconv", "watchr", "xml2json", "zmq", "deep-equal", "bytes", "irc", "less-middleware", "cron", "duplexer", "forever", "lodash-node", "unzip", "emitter-component", "grunt-contrib-concat", "hubot", "q-io", "wd", "gulp-rename", "execSync", "express-session", "stream-combiner", "ecstatic", "istanbul", "keypress", "util", "broccoli-filter", "noflo", "osenv", "d3", "pegjs", "connect-mongo", "detective", "config", "log", "findup-sync", "flatiron", "sockjs", "brfs", "rework", "ee-types", "lazy", "vow", "vinyl", "yamljs", "ansi", "assert-plus", "dirty", "pull-stream", "diff", "mongojs", "ndarray", "deepmerge", "hapi", "walkdir", "hook.io", "node-fs", "type-component", "koa", "method-override", "needle", "nunjucks", "yaml", "archy", "autoprefixer",
    "charm", "check-types", "grunt-contrib-nodeunit", "node-watch", "win-spawn", "path-to-regexp", "phantom", "tap", "xregexp", "compression", "hat", "ip", "prettyjson", "seq", "URIjs", "microtime", "mongoskin", "nedb", "npmconf", "stack-trace", "buffer-crc32", "json-schema", "memcached", "node-expat", "node-gyp", "buffertools", "cors", "kew", "readdirp", "dox", "envify", "globule", "grunt-lib-contrib", "joi", "prelude-ls", "resource", "temporary", "LiveScript", "coffeeify", "csso", "dot", "forever-monitor", "natural", "portfinder", "static-favicon", "useragent", "utile", "events", "expect.js", "eyespect", "feedparser", "iced-coffee-script", "shell-quote", "date-utils", "ltx", "mailparser", "node-markdown", "rx", "ansi-color", "daemon", "es5-ext", "source-map-support", "assert", "convert-source-map", "deferred", "gulp-template", "hbs", "lingo", "outcome", "promised-io", "wordwrap", "axon", "css", "domready", "file", "grunt-contrib-cssmin", "load-grunt-tasks", "react-tools", "rss", "text-table", "zombie", "data2xml", "deep-extend", "defaults", "ee-event-emitter", "faye-websocket", "fs-utils", "pluralize", "shoe", "bignum", "bl", "callsite", "engine.io", "errorhandler", "filed", "filesize", "gulp-install", "portscanner", "routes", "strftime",
    "transformer-test", "uid2", "acorn", "gulp-conflict", "hashish", "node-xmpp", "structr", "wiredep", "emailjs", "passport-facebook", "traceur", "ursa", "bops", "cliff", "crc", "grunt-contrib-connect", "process", "tiny-lr", "typescript", "bip-pod", "byline", "googleapis", "gulp-uglify", "mqtt", "optparse", "posix-getopt", "sift", "carrier", "grunt-contrib-less", "multiparty", "opener", "promptly", "ref", "retry", "serve-static", "utils-merge", "component-builder", "cssom", "escape-html", "follow", "gulp-concat", "he", "hypher", "json-stringify-safe", "sha1", "xmlrpc", "JSONPath", "domify", "lodash.defaults", "node-promise", "path-extra", "plist", "seaport", "tv4", "twit", "color", "docco", "fileops", "fstream-ignore", "gift", "grunt-contrib-coffee", "inherit", "mu2", "multilevel", "node-zip", "pty.js", "soap", "taskgroup", "urllib", "yui", "binary", "buffers", "ftp", "i18n", "node-hid", "passport-http", "xml", "xpath", "azure", "component-emitter", "docopt", "iniparser", "jwt-simple", "prime", "primus", "printf", "showdown", "sprintf-js", "st", "tar.gz", "util-extend", "after", "browser-request", "co-body", "director", "entities", "funargs", "jquery-browserify", "jschardet", "keygrip"
];

let data = {};

for (let name of TOP_500)
    data[name] = null;

console.log(JSON.stringify(data));