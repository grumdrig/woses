#
# HTTP server for static and PHP files via Node.js (nodejs.org)
# See http://bitbucket.org/grumdrig/woses/wiki/Home
#
# Usage: node woses.js DOCUMENT_ROOT
#
# By Eric Fredricksen <e@fredricksen.net> in 2010 and perhaps onwards.
# No rights reserved; this code is placed into the public domain.
#

sys:  require 'sys'
fs:   require 'fs'
http: require 'http'
url:  require 'url'
path: require 'path'


respondWithPhp: (req, res) ->
  res.body: ''
  parp: __filename.split('/').slice(0,-1).concat("parp.php").join("/")
  params: [parp, req.filepath].concat(for param,value of req.query
    escape(param) + "=" + escape(value))

  params.push "-s"
  params.push "HTTP_USER_AGENT=" + req.headers['user-agent']
  params.push "HTTP_HOST=" + req.headers.host
  params.push "REQUEST_URI=" + req.url
  child: require('child_process').spawn("php", params)
  child.stdout.addListener 'data', (data) ->
    res.body += data
  child.stderr.addListener 'data', (data) ->
    sys.puts "STDERR (php): " + content
  child.addListener 'exit', (code) ->
    res.header('content-type', if res.body.indexOf("<?xml") == 0 then "application/xml" else "text/html")
    sys.puts req.requestLine + " (php) " + res.body.length
    res.status: 404 if res.body.match(/^404:/)
    res.respond()



respondWithJsRpc: (req, res) ->
  # TODO: use conf file to distinguish client & server js
  try
    script: require(req.basepath)
  catch e
    res.status: 404
    res.respond "404: In absentia or error in module.\n" + sys.inspect(e)
    return
  script.fetch(req, res)
  len: res.respond()
  sys.puts(req.requestLine + " " + len)



respondWithStatic: (req, res) ->
  content_type: config.mimetypes[req.extname] || "text/plain"
  res.encoding: if content_type.slice(0,4) == 'text' then 'utf8' else 'binary'
  fs.readFile req.filepath, res.encoding, (err, data) ->
    if err
      sys.puts("Error 404: " + req.filepath)
      res.status: 404
      res.header('content-type', 'text/plain')
      res.respond('404: I looked but did not find.')
    else
      res.header('content-type', content_type)
      sys.puts(req.requestLine + " " + data.length)
      res.respond(data)


mixin: (target, source) ->
  for name,value of source
    target[name]: value

config: {
  port: 8080,
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


process.chdir(process.ARGV[2]) if process.ARGV.length > 2


# Read config

require.paths.push(process.cwd())

try
  cf: require(".woses-conf")
catch e
  # No config file is OK
  cf: {}
mixin(config.mimetypes, cf.mimetypes || {})
delete cf.mimetypes

if cf.handlers
  config.handlers: cf.handlers.concat(config.handlers || [])
  delete cf.handlers

mixin(config, cf)

# Go

serverFn: (req, res) ->
  req.requestLine: req.method + " " + req.url +  " HTTP/" + req.httpVersion

  sys.p(req.headers) if (config.logRequestHeaders)

  res.respond: (body) ->
    this.status: this.status || 200
    this.body: body || this.body || ""
    if (typeof this.body != 'string')
      this.header("content-type", "application/json")
      this.body: JSON.stringify(this.body)
    this.encoding: this.encoding || 'utf8'
    this.length: if this.encoding == 'utf8' then encodeURIComponent(this.body).replace(/%../g, 'x').length else this.body.length
    this.header('content-length', this.length)

    this.writeHead(this.status, this.headers)
    this.write(this.body, this.encoding)
    this.end()
    return this.body.length

  res.header: (header, value) ->
    this.headers: or {}
    this.headers[header]: value

  mixin(req, url.parse(req.url, true))
  req.query: or {}
  if req.pathname.substr(0,1) != '/'
    res.status: 400
    return res.respond("400: I have no idea what that is")
  req.filepath: req.pathname.substr(1) || config.index      # path/name.ext
  if not path.basename(req.filepath)
    req.filepath: path.join(req.filepath, config.index)
  req.filename: path.basename(req.filepath)                 # name.ext
  req.extname : path.extname(req.filename)                  # .ext
  req.basename: path.basename(req.filename, req.extname)    # name
  req.basepath: path.join(path.dirname(req.filepath),
                           req.basename)                    # path.name

  # Exclude ".." in uri
  if req.pathname.indexOf('..') >= 0 || req.filename.substr(0,1) == "."
    res.status: 403
    return res.respond("403: Don't hack me, bro")

  req.body: ''
  req.addListener('data', (chunk) -> req.body += chunk)
  req.addListener 'end', () ->
    ct: req.headers['content-type']
    ct: and ct.split(';')[0]
    if ct == "application/x-www-form-urlencoded"
      form: require("querystring").parse(req.body)
      mixin(req.query, form)
    else if ct == "application/json"
      req.json: JSON.parse(req.body)
      mixin(req.query, req.json)

    for handler in config.handlers
      req.match: handler[0](req.pathname)
      if req.match
        handler[1](req, res)
        break

http.createServer(serverFn).listen(config.port)


sys.puts('Woses running at http://127.0.0.1:' +
         config.port + '/ in ' +
         process.cwd())
