var sys = require("sys");

exports.mimetypes = {
  gif: "image/gif"
}

exports.port = 8080;

//exports.logRequestHeaders = true;

function respondWithMarkdown(req, res) {
  sys.exec("Markdown.pl < " + req.uri.filename)
  .addCallback(function (stdout, stderr) {
    res.respond(stdout);})
  .addErrback(function (code, stdout, stderr) {
    res.status = 404;
    res.respond("404: Mark my words. No such file.");
  });
}

exports.handlers = [
  [/\.(md|markdown)$/, respondWithMarkdown]
];