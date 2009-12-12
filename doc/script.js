

function feedback(html) {
  var s = document.getElementById("something");
  s.innerHTML = s.innerHTML + "<br>" + html;
}

function requestJson(param, url, callback) {
  var req = new XMLHttpRequest();
  req.open("POST", url, true);
  req.onreadystatechange = function () {
    if (req.readyState == 4 && req.status == 200) {
      var response = JSON.parse(req.responseText);
      callback(response);
    }
  };
  req.setRequestHeader("Content-Type", "application/json");
  req.send(JSON.stringify(param));
}


function objectToQueryString(params) {
  var result = "";
  for (p in params)
    if (typeof params[p] != 'undefined')
      result += (result.length ? "&" : "") + encodeURIComponent(p) + "=" +
    encodeURIComponent(params[p]);
  return result;
}

function requestXml(param, url, callback) {
  var req = new XMLHttpRequest();
  req.open("POST", url, true);
  req.onreadystatechange = function () {
    if (req.readyState == 4 && req.status == 200) {
      var t = req.responseText;
      callback(req.responseXML, t);
    }
  };
  req.setRequestHeader("Content-Type", 
                       "application/x-www-form-urlencoded");
  req.send(objectToQueryString(param));
}

function asserteq(v1, v2) {
  if (v1 != v2) {
    feedback("ASSERTION FAILED: " + v1 + " = " + v2);
    throw "Fit";
  }
}

function adhoc() {
  var r = '{"whoami":{"id":1,"nickname":"Grum"},"sanity":"check","char":[{"slot":1,"name":"Numkrut Runprib","id":2,"hp":1},{"slot":0,"name":"Xuzshout Ooxxoz","id":1,"hp":"1"}]}';
  JSON.parse(r);
}


String.prototype.escapeHTML = function () {
  return(                                                                 
    this.replace(/&/g,'&amp;').                                         
    replace(/>/g,'&gt;').                                           
    replace(/</g,'&lt;').                                           
    replace(/"/g,'&quot;')                                         
  );                                                                     
};

function unittest() {
  adhoc();
  requestJson({a:8, b:9}, 'json-rpc.js', function (sum) {
    feedback("JSON: " + sum);
    asserteq(sum.sum, 17);
    requestXml({a:8, b:9}, 'xml-rpc.php', function (xml, tex) {
      feedback("XML: " + tex.escapeHTML() + ":");
      //asserteq(sum.sum, 17);
      
      feedback('TESTS RAN OK');
    });
  });
}
