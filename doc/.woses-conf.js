
exports.mimetypes = {
  '.gif': "image/gif"
}

exports.port = 8080;

//exports.logRequestHeaders = true;

function respondWithMarkdown(req, res) {
  require('child_process').exec("Markdown.pl < " + req.filepath,
    function (error, stdout, stderr) {
      if (error) {
        res.status = 404;
        res.respond("404: Mark my words. No such file.");
      } else {
        res.respond(stdout);
      }
    });
}

exports.handlers = [
  [/\.(md|mkd|markdown)$/, respondWithMarkdown]
];