const http = require("http");
const url = require("url");
const server = new http.Server();
server.listen(4848, "localhost");
console.log("ok");

server.on('request', function(req, res) {
    let urlParsed = url.parse(req.url, true);
    if (urlParsed.pathname == "/sf") {
        res.end("sfsfsfsfsf");
    } else {
        res.status = 404;
        res.end("page not found");
    }
});
