var sys = require("sys");

exports.fetch = function (request, response) {
  response.header("content-type", "application/json");
  response.body = {sum: request.json.a + request.json.b,
                   aka: request.query.a + request.query.b};
  return response.respond();
}
