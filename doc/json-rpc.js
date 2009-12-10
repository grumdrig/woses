var sys = require("sys");

exports.fetch = function (request, response) {
  sys.p(request);
  sys.p("WTF");
  response.header("content-type", "application/json");
  response.body = {sum: request.json.a + request.json.b,
                   aka: request.params.a + request.params.b};
  return response.respond();
}
