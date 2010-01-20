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
  http  = require('http'),
  url   = require('url'),
  path  = require('path');


function respondWithPhp(req, res) {
  res.body = '';
  var parp = __filename.split('/').slice(0,-1).concat("parp.php").join("/");
  var params = [parp, req.filepath];
  for (var param in req.query)
    params.push(escape(param) + "=" + escape(req.query[param]));
  params.push("-s");
  params.push("HTTP_USER_AGENT=" + req.headers['user-agent']);
  params.push("HTTP_HOST=" + req.headers['host']);
  params.push("REQUEST_URI=" + req.url);
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
    var script = require(req.basepath);
  } catch (e) {
    res.status = 404
    res.respond("404: In absentia or error in module.\n" + sys.inspect(e));
    return;
  }
  script.fetch(req, res);
  var len = res.respond();
  sys.puts(req.requestLine + " " + len);
}


function respondWithStatic(req, res) {
  var content_type = config.mimetypes[req.extname] || "text/plain";
  res.encoding = (content_type.slice(0,4) === 'text' ? 'utf8' : 'binary');
  var promise = posix.cat(req.filepath, res.encoding);
  promise.addCallback(function(data) {
    res.header('Content-Type', content_type);
    sys.puts(req.requestLine + " " + data.length);
    res.respond(data);
  });
  promise.addErrback(function(data) {
    sys.puts("Error 404: " + req.filepath);
    res.status = 404;
    res.header('Content-Type', 'text/plain');
    res.respond('404: I looked but did not find.');
  });
}


var config = {
  port: 8080,
  index: "index.html",
  mimetypes: {
    ".css" : "text/css",
    ".html": "text/html",
    ".ico" : "image/vnd.microsoft.icon",
    ".jpg" : "image/jpeg",
    ".js"  : "application/javascript",
    ".png" : "image/png",
    ".xml" : "application/xml",
    ".xul" : "application/vnd.mozilla.xul+xml",
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
  var cf = require(".woses-conf");
} catch (e) {
  // No config file is OK
  var cf = {}
}
config.port = cf.port || config.port;
config.index = cf.index || config.index
if (cf.mimetypes) {
  process.mixin(config.mimetypes, cf.mimetypes);
}
if (cf.handlers) {
  config.handlers = cf.handlers.concat(config.handlers);
}


http.createServer(function(req, res) {

  req.requestLine = req.method + " " + req.url +  " HTTP/" + req.httpVersion;

  if (config.logRequestHeaders)
    sys.p(req.headers);

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

  process.mixin(req, url.parse(req.url, true));
  req.query = req.query || {};
  if (req.pathname.substr(0,1) != '/') {
    res.status = 400;
    return res.respond("400: I have no idea what that is");
  }
  req.filepath = req.pathname.substr(1) || config.index;      // path/name.ext
  if (!path.basename(req.filepath)) 
    req.filepath = path.join(req.filepath, config.index);
  req.filename = path.basename(req.filepath);                 // name.ext
  req.extname  = path.extname(req.filename);                  // .ext
  req.basename = path.basename(req.filename, req.extname);    // name
  req.basepath = path.join(path.dirname(req.filepath), 
                           req.basename);                     // path.name

  // Exclude ".." in uri
  if (req.pathname.indexOf('..') >= 0 || req.filename.substr(0,1) == ".") {
    res.status = 403;
    return res.respond("403: Don't hack me, bro");
  }

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
      var querystring = require("querystring");
      var form = querystring.parse(req.body);
      for (var param in form) 
        req.query[param] = form[param];
    } else if (ct == "application/json") {
      req.json = JSON.parse(req.body);
      process.mixin(req.query, req.json);
    }

    for (var i = 0; config.handlers[i]; ++i) {
      var match = config.handlers[i][0](req.pathname);
      if (match) {
        req.match = match;
        config.handlers[i][1](req, res);
        break;
      }
    }
  });

}).listen(config.port);


sys.puts('Woses running at http://127.0.0.1:' + 
         config.port + '/ in ' + 
         process.cwd());
