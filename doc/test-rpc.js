var sys = require("sys");

exports.fetch = function (request, response) {
  response.header("content-type", "text/html");
  response.body = "Got it. <pre>" + sys.inspect(request.query);
}
