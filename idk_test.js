var express = require("express");
var app = express();

app.listen(3000);

app.get("/sf", function(req, res) {
    res.end("sfsfsfsf");
})

app.get("/cm", function(req, res) {
    res.end("mrmrmr");
})
