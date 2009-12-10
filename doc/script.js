

function feedback(html) {
  var s = document.getElementById("something");
  s.innerHTML = html;
}

function requestJson(param, url, callback) {
  var http_request = new XMLHttpRequest();
  http_request.open("POST", url, true);
  http_request.onreadystatechange = function () {
    if (http_request.readyState == 4 && http_request.status == 200) {
      var response = JSON.parse(http_request.responseText);
      callback(response);
    }
  };
  http_request.setRequestHeader("Content-Type", "application/json");
  http_request.send(JSON.stringify(param));
}

function asserteq(v1, v2) {
  if (v1 != v2) {
    feedback("ASSERTION FAILED: " + v1 + " = " + v2);
    throw "Fit";
  }
}

function unittest() {
  requestJson({a:8, b:9}, 'json-rpc.js', function (sum) {
    feedback("back");
    asserteq(sum.sum, 17);
    feedback('TESTS RAN OK');
  });
}