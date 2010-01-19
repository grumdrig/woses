var sys = require("sys");

exports.fetch = function (request, response) {
  response.header("content-type", "text/html");
  //sys.p(repsonse.headers);
  response.body = "Got it. <pre>" + sys.inspect(request.params);
  return response.respond();
}
