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
  wwwforms  = require('./www-forms');


function parseUri(path) {
  var parts = RegExp("^/((.+?)(\\.([a-z]+))?)$")(path);
  if (parts) {
    return {
      filename: parts[1],
      basename: parts[2],
      ext: parts[4]
    };
  }
}


var config = {
  port: 8080,
  documentRoot: "./",
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
  validate: function () {
    if (this.index.substr(0,1) != '/')
      this.index = '/' + this.index;
    if (this.documentRoot.substr(-1) != '/')
      this.documentRoot += "/";
  }
}

if (process.ARGV.length > 2) {
  config.documentRoot = process.ARGV[2];
  config.validate();
}

var confFile = config.documentRoot + ".woses-conf.js";
try {
  var cf = require(config.documentRoot + ".woses-conf");
  if (cf.mimetypes) {
    process.mixin(config.mimetypes, cf.mimetypes);
    delete cf.mimetypes;
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
    req.uri.path = config.index;
  
  res.respond = function (body) {
    this.sendHeader(this.status || 200, this.headers);
    this.body = body || this.body || "";
    if (typeof this.body != 'string')
      this.body = JSON.encode(this.body);
    this.sendBody(this.body, this.encoding || 'utf8');
    this.finish();
  }

  res.header = function(header, value) {
    if (!this.headers) this.headers = [];
    this.headers.push([header, value]);
  }

  var uri = parseUri(req.uri.path);
  if (!uri) {
    res.status = 400;
    return res.respond("400: I have no idea what that is");
  }

  // Exclude ".." in uri
  if (req.uri.path.indexOf('..') >= 0 || uri.filename.substr(1) == ".") {
    res.status = 403;
    return res.respond("403: Don't hack me, bro");
  }

  function respondWithStatic() {
    var content_type = config.mimetypes[uri.ext] || "text/plain";
    res.encoding = (content_type.slice(0,4) === 'text' ? 'utf8' : 'binary');
    var promise = posix.cat(config.documentRoot + uri.filename, res.encoding);
    promise.addCallback(function(data) {
      res.header('Content-Type', content_type);
      res.header('Content-Length', res.encoding === 'utf8' ? 
                 encodeURIComponent(data).replace(/%../g, 'x').length : 
                 data.length);
      sys.puts(req.requestLine + " " + data.length);
      res.respond(data);
    });
    promise.addErrback(function() {
      sys.puts("Error 404: " + uri.filename);
      res.status = 404;
      res.header('Content-Type', 'text/plain');
      res.respond('404: I looked but did not find.');
    });
  }

  function respondWithPhp() {
    res.body = '';
    var params = ['parp.php', uri.filename, '--dir=' + config.documentRoot];
    for (var param in req.uri.params)
      params.push(param + "=" + req.uri.params[param]);

    var form = wwwforms.decodeForm(req.body);
    for (var param in form) 
      params.push(param + "=" + form[param]);
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
        res.header("Content-Length", res.body.length);;
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
                  
  function finishUp() {
    if (uri.ext == "php") {
      respondWithPhp();
    } else if (uri.filename.substr(-7) == "-rpc.js") {
      // TODO: use conf file to distinguish client & server js
      try {
        var script = require(config.documentRoot + uri.basename);
        script.fetch(req, res);
        sys.puts(req.requestLine + " " + res.body.length);
        res.respond();
      } catch (e) {
        res.status = 404
        res.respond("404: In absentia. Or elsewhere.\n" +
                    sys.inspect(e));
      }
    } else if (uri.ext == "md") {
      sys.exec("Markdown.pl < " + config.documentRoot + uri.filename)
      .addCallback(function (stdout, stderr) {
        res.respond(stdout);})
      .addErrback(function (code, stdout, stderr) {
        res.status = 404;
        res.respond("404: Mark my words. No such file.");
      });
    } else {
      respondWithStatic();
    }
  }

  var contentLength = parseInt(req.headers['content-length']);
  if (contentLength) {
    req.body = '';
    req.addListener('body', function(chunk) {
      req.pause();
      req.body += chunk;
      setTimeout(function() { req.resume(); });
    });
    req.addListener('complete', finishUp);
  } else {
    finishUp(); // Todo: does complete get called regardless?
  }

}).listen(config.port);


sys.puts('Woses running at http://127.0.0.1:' + 
         config.port + '/ in ' + 
         config.documentRoot);
