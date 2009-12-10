var sys = require("sys");

exports.fetch = function (request, response) {
  response.header("content-type", "application/json");
  response.body = {sum: request.json.a + request.json.b,
                   aka: request.params.a + request.params.b};
  return response.respond();
}
