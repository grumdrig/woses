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

"use strict";

var
  util  = require('util'),
  console = require('console'),
  fs   = require('fs'),
  http = require('http'),
  url  = require('url'),
  path = require('path');


function respondWithPhp(req, res) {
  res.body = '';
  var parp = __filename.split('/').slice(0,-1).concat("parp.php").join("/");
  var params = [parp, req.filepath];
  for (var param in req.query)
    params.push(escape(param) + "=" + escape(req.query[param]));
  params.push("-s");
  params.push("HTTP_USER_AGENT=" + req.headers['user-agent']);
  params.push("HTTP_HOST=" + req.headers.host);
  params.push("REQUEST_URI=" + req.url);
  var child = require('child_process').spawn("php", params);
  child.stdout.addListener('data', function (data) {
    res.body += data;
  });
  child.stderr.addListener('data', function (data) {
    console.log("STDERR (php): " + content);
    //return res.respond('500: Sombody said something shocking.');
  });
  child.addListener('exit', function (code) {
    res.header("content-type", (res.body.indexOf("<?xml") === 0) ?
               "application/xml" : "text/html");
    console.log(req.requestLine + " (php) " + res.body.length);
    if (res.body.match(/^404:/))
      res.status = 404;
    res.respond();
  });
}


function respondWithJsRpc(req, res) {
  // TODO: use conf file to distinguish client & server js
  try {
    var script = require(path.join(process.cwd(), req.basepath));
  } catch (e) {
    res.status = 404;
    res.respond("404: In absentia or error in module.\n" + util.inspect(e));
    return;
  }
  script.fetch(req, res, () => {
    var len = res.respond();
    console.log(req.requestLine + " " + len);
  });
}


function respondWithStatic(req, res) {
  var content_type = config.mimetypes[req.extname] || "text/plain";
  res.encoding = (content_type.slice(0,4) === 'text' ? 'utf8' : 'binary');
  fs.readFile(req.filepath, res.encoding, function(err, data) {
    if (err) {
      console.log("Error 404: " + req.filepath);
      res.status = 404;
      res.header('content-type', 'text/plain');
      res.respond('404: I looked but did not find.');
    } else {
      res.header('content-type', content_type);
      console.log(req.requestLine + " " + data.length);
      res.respond(data);
    }
  });
}

function mixin(target, source) {
  for (var name in source) {
    if (source.hasOwnProperty(name))
      target[name] = source[name];
  }
}


var config = {
  port: 8053,
  index: "index.html",
  mimetypes: {
    ".css" : "text/css",
    ".gif" : "image/gif",
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


if (process.argv.length > 2)
  process.chdir(process.argv[2]);

// Read config

try {
  var cf = require(path.join(process.cwd(), ".woses-conf"));
} catch (e) {
  // No config file is OK
  var cf = {};
}
mixin(config.mimetypes, cf.mimetypes || {});
delete cf.mimetypes;

if (cf.handlers) {
  config.handlers = cf.handlers.concat(config.handlers || []);
  delete cf.handlers;
}

mixin(config, cf);

// Go

http.createServer(function(req, res) {

  req.requestLine = req.method + " " + req.url +  " HTTP/" + req.httpVersion;

  if (config.logRequestHeaders)
    util.p(req.headers);

  res.respond = function (body) {
    if (!this.responded) {
      this.responded = true;
      this.status = this.status || 200;
      this.body = body || this.body || "";
      if (typeof this.body != 'string') {
        this.header("content-type", "application/json");
        this.body = JSON.stringify(this.body);
      }
      this.encoding = this.encoding || 'utf8';
      this.length = (this.encoding === 'utf8' ?
                     encodeURIComponent(this.body).replace(/%../g, 'x').length :
                     this.body.length);
      this.header('content-length', this.length);

      this.writeHead(this.status, this.headers);
      this.write(this.body, this.encoding);
      this.end();
    }
    return this.body.length;
  };

  res.header = function(header, value) {
    if (!this.headers) this.headers = {};
    this.headers[header] = value;
  };

  mixin(req, url.parse(req.url, true));
  req.query = req.query || {};
  if (req.pathname.substr(0,1) != '/') {
    res.status = 400;
    return res.respond("400: I have no idea what that is");
  }
  req.filepath = req.pathname.substr(1) || config.index;      // path/name.ext
  if (!path.basename(req.filepath) ||                         // ""
      path.basename(req.filepath).slice(-1) == "/")           // dir/
    req.filepath = path.join(req.filepath, config.index);     // dir/index.html
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
  req.addListener('data', function(chunk) {
    //req.pause();
    req.body += chunk;
    //setTimeout(function() { req.resume(); });
  });
  req.addListener('end', function () {
    var ct = req.headers['content-type'];
    if (ct) ct = ct.split(';')[0];
    if (ct == "application/x-www-form-urlencoded") {
      var querystring = require("querystring");
      var form = querystring.parse(req.body);
      mixin(req.query, form);
    } else if (ct == "application/json") {
      req.json = JSON.parse(req.body);
      mixin(req.query, req.json);
    }

    for (var i = 0; config.handlers[i]; ++i) {
      var match = config.handlers[i][0].exec(req.pathname);
      if (match) {
        req.match = match;
        config.handlers[i][1](req, res);
        break;
      }
    }
  });

}).listen(config.port);


console.log('Woses running at http://127.0.0.1:' +
         config.port + '/ in ' +
         process.cwd());
