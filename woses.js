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

// HTTP server for static and PHP files via Node.js (nodejs.org)
// Usage: node woses.js
// Configure by editing the two lines below:

var port = 8080;
var documentRoot = "../pq9x/";

var 
  sys   = require('sys'),
  posix = require('posix'),
  http  = require('http'),
  wwwforms  = require('./coltrane/module/www-forms');


http.createServer(function(req, res) {

    req.requestLine = req.method + " " + req.uri.full + 
      " HTTP/" + req.httpVersion;

    //sys.puts(sys.inspect(req.headers));

    if (req.uri.path == '/')
      req.uri.path = '/index.php';

    var parts = RegExp("^/([a-z\\.]+?\\.([a-z]+))$")(req.uri.path);
    if (!parts) {
      res.sendHeader(404);
      res.sendBody("404: I have no idea what you're talking about", 'utf8');
      res.finish();
      return;
    }
    var filename = parts[1];
    var ext = parts[2];

    filetypes = {
      "css" : "text/css",
      "html": "text/html",
      "ico" : "image/vnd.microsoft.icon",
      "jpg" : "image/jpeg",
      "js"  : "application/javascript",
      "png" : "image/png",
      "xml" : "application/xml",
      "xul" : "application/vnd.mozilla.xul+xml",
    };
    content_type = filetypes[ext] || "text/html";
    
    var encoding = (content_type.slice(0,4) === 'text' ? 'utf8' : 'binary');
    
    function respondWithStatic(callback) {
      var promise = posix.cat(documentRoot + filename, encoding);
      promise.addCallback(function(data) {
          headers = [['Content-Type', content_type],
                     ['Content-Length', encoding === 'utf8' ? 
                      encodeURIComponent(data).replace(/%../g, 'x').length : 
                      data.length]];
          sys.puts(req.requestLine + " " + data.length);
          callback(200, headers, data, encoding);
        });
      promise.addErrback(function() {
          sys.puts("Error 404: " + filename);
          callback(404, [['Content-Type', 'text/plain']], 
                   '404: I looked but did not find.');
        });
    }


    function respondWithPhp(callback) {
      body = '';
      
      var params = ['parp.php', filename, '--dir=' + documentRoot];
      for (var param in req.uri.params)
        params.push(param + "=" + req.uri.params[param]);

      this.bytesTotal = req.headers['content-length'];
      
      req.body = '';
      req.addListener('body', function(chunk) {
          req.pause();
          req.body += chunk;
          setTimeout(function() { req.resume(); });
        });
      req.addListener('complete', function() {
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
                body += data;
              } else {
                if (body.match("^<\\?xml"))
                  content_type = "application/xml";
                headers = [['Content-Type', content_type],
                           ['Content-Length', body.length]];
                sys.puts(req.requestLine + " (php) " + body.length);
                callback(200, headers, body, encoding);
              }
              setTimeout(function(){req.resume();});
            });
          promise.addListener("error", function(content) {
              if (content != null) {
                sys.puts("STDERR (php): " + content);
                //callback(500, null, '500: Sombody said something shocking.');
              }
            });
        });
      
    }

    function respond(status, headers, body, encoding) {
      res.sendHeader(status, headers);
      res.sendBody(body, encoding || 'utf8');
      res.finish();
    }
  
    if (ext == "php") {
      respondWithPhp(respond);
    } else {
      respondWithStatic(respond);
    }
    
  }).listen(port);

sys.puts('Woses running at http://127.0.0.1:' + port + '/');
