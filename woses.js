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
// Usage: node woses.js [--port PORT] DOCUMENT_ROOT/
//

var 
  sys   = require('sys'),
  posix = require('posix'),
  http  = require('http'),
  wwwforms  = require('./www-forms');


function getopt(argv) {
  // Presume all --opt flags have 1 argument, all -o flags don't
  var opts = {};
  var i = 0;
  for (; i < argv.length; ++i) {
    if (argv[i].substr(0,2) == "--") {
      opts[argv[i]] = argv[i+1];
      ++i;
    } else if (argv[i].substr(0,1) == "-") {
      opts[argv[i]] = (opts[argv[i]] || 0) + 1;
    } else {
      break;
    }
  }
  return [opts, argv.slice(i)];
}


var oa = getopt(process.ARGV.slice(2));
var opts = oa[0];
var args = oa[1];

var port = opts['--port'] || 8080;
var index = opts['--index'] || "/index.html";
if (index.substr(0,1) != '/')
  index = '/' + index;
var documentRoot = args[0];
if (documentRoot.substr(-1) != '/')
  documentRoot += "/";


var filetypes = {
  "css" : "text/css",
  "html": "text/html",
  "ico" : "image/vnd.microsoft.icon",
  "jpg" : "image/jpeg",
  "js"  : "application/javascript",
  "png" : "image/png",
  "xml" : "application/xml",
  "xul" : "application/vnd.mozilla.xul+xml",
};


http.createServer(function(req, res) {

    req.requestLine = req.method + " " + req.uri.full + 
      " HTTP/" + req.httpVersion;

    //sys.puts(sys.inspect(req.headers));

    if (req.uri.path == '/')
      req.uri.path = index;

    // Exclude ".." in uri
    if (req.uri.path.indexOf('..') >= 0)
      return respond(403, null, "403: Don't hack me, bro");

    var parts = RegExp("^/(.+?(\\.([a-z]+))?)$")(req.uri.path);
    if (!parts)
      return respond(400, null, "400: I have no idea what that is");

    var filename = parts[1];
    var ext = parts[3];
    var content_type = filetypes[ext] || "text/plain";
    
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
      var body = '';
      
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
                if (body.indexOf("<?xml") == 0)
                  content_type = "application/xml";
                else
                  content_type = "text/html";
                headers = [['Content-Type', content_type],
                           ['Content-Length', body.length]];
                sys.puts(req.requestLine + " (php) " + body.length);
                callback((body.indexOf("404:") == 0) ? 404 : 200, 
                         headers, body, encoding);
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


sys.puts('Woses running at http://127.0.0.1:' + port + '/ in ' + documentRoot);
