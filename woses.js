/*
Copyright (c) 2009, Eric Fredricksen <e@fredricksen.net>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

//
// HTTP server for static and PHP files via Node.js (nodejs.org)
// See http://bitbucket.org/grumdrig/woses/wiki/Home
//
// Usage: node woses.js DOCUMENT_ROOT
//

var 
  sys   = require('sys'),
  posix = require('posix'),
  http  = require('http');


function respondWithPhp(req, res) {
  res.body = '';
  var parp = __filename.split('/').slice(0,-1).concat("parp.php").join("/");
  var params = [parp, req.uri.filename];
  for (var param in req.params)
    params.push(escape(param) + "=" + escape(req.params[param]));
  params.push("-s");
  params.push("HTTP_USER_AGENT=" + req.headers['user-agent']);
  params.push("HTTP_HOST=" + req.headers['host']);
  params.push("REQUEST_URI=" + req.uri.full);
  var promise = process.createChildProcess("php", params);
  promise.addListener("output", function (data) {
    req.pause();
    if (data != null) {
      res.body += data;
    } else {
      res.header("Content-Type", (res.body.indexOf("<?xml") == 0) ?
                 "application/xml" : "text/html")
      sys.puts(req.requestLine + " (php) " + res.body.length);
      if (res.body.match(/^404:/)) 
        res.status = 404;
      res.respond();
    }
    setTimeout(function(){req.resume();});
  });
  promise.addListener("error", function(content) {
    if (content != null) {
      sys.puts("STDERR (php): " + content);
      //return res.respond('500: Sombody said something shocking.');
    }
  });
}


function respondWithJsRpc(req, res) {
  // TODO: use conf file to distinguish client & server js
  try {
    var script = require(req.uri.basename);
    // TODO: don't have fetch call respond - just set body
    var len = script.fetch(req, res);
    sys.puts(req.requestLine + " " + len);
  } catch (e) {
    res.status = 404
    res.respond("404: In absentia. Or elsewhere.\n" +
                sys.inspect(e));
  }
}


function respondWithStatic(req, res) {
  var content_type = config.mimetypes[req.uri.ext] || "text/plain";
  res.encoding = (content_type.slice(0,4) === 'text' ? 'utf8' : 'binary');
  var promise = posix.cat(req.uri.filename, res.encoding);
  promise.addCallback(function(data) {
    res.header('Content-Type', content_type);
    sys.puts(req.requestLine + " " + data.length);
    res.respond(data);
  });
  promise.addErrback(function() {
    sys.puts("Error 404: " + req.uri.filename);
    res.status = 404;
    res.header('Content-Type', 'text/plain');
    res.respond('404: I looked but did not find.');
  });
}


var config = {
  port: 8080,
  index: "index.html",
  mimetypes: {
    "css" : "text/css",
    "html": "text/html",
    "ico" : "image/vnd.microsoft.icon",
    "jpg" : "image/jpeg",
    "js"  : "application/javascript",
    "png" : "image/png",
    "xml" : "application/xml",
    "xul" : "application/vnd.mozilla.xul+xml",
  },
  handlers: [
    [/\.php$/, respondWithPhp],
    [/-rpc\.js$/, respondWithJsRpc],
    [/$/, respondWithStatic]
  ]
}


if (process.ARGV.length > 2)
  process.chdir(process.ARGV[2]);

require.paths.push(process.cwd());

try {
  posix.stat(config.index).wait();
} catch (e) {
  config.index = "index.php"
}

try {
  var cf = require(".woses-conf");
  if (cf.mimetypes) {
    process.mixin(config.mimetypes, cf.mimetypes);
    delete cf.mimetypes;
  }
  if (cf.handlers) {
    config.handlers = cf.handlers.concat(config.handlers);
    delete cf.handlers;
  }
  process.mixin(config, cf);
  config.validate();
} catch (e) {
  // No config file is OK
}


http.createServer(function(req, res) {

  req.requestLine = req.method + " " + req.uri.full + 
    " HTTP/" + req.httpVersion;

  if (config.logRequestHeaders)
    sys.p(req.headers);

  if (req.uri.path == '/')
    req.uri.path = "/" + config.index;
  
  res.respond = function (body) {
    this.sendHeader(this.status || 200, this.headers);
    this.body = body || this.body || "";
    if (typeof this.body != 'string') {
      this.header("content-type", "application/json");
      this.body = JSON.stringify(this.body);
    }
    var result = this.body ? this.body.length : 0;
    this.encoding = this.encoding || 'utf8';
    res.header('Content-Length', (this.encoding === 'utf8' ? 
                       encodeURIComponent(this.body).replace(/%../g, 'x').length : 
                                  this.body.length));
    this.sendBody(this.body, this.encoding);
    this.finish();
    return result;
  }

  res.header = function(header, value) {
    if (!this.headers) this.headers = [];
    this.headers.push([header, value]);
  }

  var uriparts = RegExp("^/((.+?)(\\.([a-z]+))?)$")(req.uri.path);
  if (!uriparts) {
    res.status = 400;
    return res.respond("400: I have no idea what that is");
  }
  process.mixin(req.uri, {
    filename: uriparts[1],
    basename: uriparts[2],
    ext: uriparts[4]
  });

  // Exclude ".." in uri
  if (req.uri.path.indexOf('..') >= 0 || req.uri.filename.substr(1) == ".") {
    res.status = 403;
    return res.respond("403: Don't hack me, bro");
  }

  function decodeForm(data) {
    var result = {};
    data
    .split("&")
    .map(function (assignment) { return assignment.split("=").map(
      function (tok) { return decodeURIComponent(tok.replace(/\+/g, " "));})})
    .forEach(function(pair) { result[pair[0]] = pair[1]; });
    return result;
  }

  req.params = req.uri.params;
  req.body = '';
  req.addListener('body', function(chunk) {
    req.pause();
    req.body += chunk;
    setTimeout(function() { req.resume(); });
  });
  req.addListener('complete', function () {
    var ct = req.headers['content-type'];
    if (ct) ct = ct.split(';')[0];
    if (ct == "application/x-www-form-urlencoded") {
      var form = decodeForm(req.body);
      for (var param in form) 
        req.params[param] = form[param];
    } else if (ct == "application/json") {
      req.json = JSON.parse(req.body);
      process.mixin(req.params, req.json);
    }

    for (var i = 0; config.handlers[i]; ++i) {
      var match = config.handlers[i][0](req.uri.path);
      if (match) {
        req.uri.match = match;
        config.handlers[i][1](req, res);
        break;
      }
    }
  });

}).listen(config.port);


sys.puts('Woses running at http://127.0.0.1:' + 
         config.port + '/ in ' + 
         process.cwd());
