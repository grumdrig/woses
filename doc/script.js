

function doSomething() {
  var s = document.getElementById("something");
  s.innerHTML = "<s>" + s.innerHTML + "</s>";
}

function requestJson(param, url) {
  var http_request = new XMLHttpRequest();
  http_request.open("POST", url, true);
  http_request.onreadystatechange = function () {
    if (http_request.readyState == 4 && http_request.status == 200) {
      var response = JSON.parse(http_request.responseText);
      var s = document.getElementById("something");
      s.innerHTML = JSON.stringify(response);
    }
  };
  http_request.setRequestHeader("Content-Type", "application/json");
  http_request.send(JSON.stringify(param));
}