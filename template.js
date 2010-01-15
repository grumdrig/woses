/* 
This is resig's templating function, here for reference:

// http://ejohn.org/blog/javascript-micro-templating/

(function(){
  var cache = {};
  
  this.tmpl = function tmpl(str, data){
    // Figure out if we're getting a template, or if we need to
    // load the template - and be sure to cache the result.
    var fn = cache[str] = cache[str] ||
      
    // Generate a reusable function that will serve as a template
    // generator (and which will be cached).
    new Function("obj",
                 "var p=[],print=function(){p.push.apply(p,arguments);};" +
                 
                 // Introduce the data as local variables using with(){}
                 "with(obj){p.push('" +
                 // Convert the template into JS
                 str.replace(/[\r\t\n]/g, " ")
                    .split("<%").join("\t")
                    .replace(/((^|%>)[^\t]*)'/g, "$1\r")
                    .replace(/\t=(.*?)%>/g, "',$1,'")
                    .split("\t").join("');")
                    .split("%>").join("p.push('")
                    .split("\r").join("\\'") +
                 "');}return p.join('');");
    
    // Provide some basic currying
    return data ? fn(data) : fn;
  };
})();
*/


function compile(template, data) {
  // TODO cache
  var body = [
    "var $$p = [];",
    "function print() {$$p.push.apply($$p, arguments);}",
    "with($$context){",
  ];
  template.split("%>").forEach(function (part) {
    var parts = part.split("<%");
    body.push("print('" + parts[0]
                     .split("\\").join("\\\\")
                     .split("\n").join("\\n")
                     .split("\r").join("\\r")
                     .split("'").join("\\'") + 
                     "');");
    if (parts.length > 1) {
      if (parts[1].substr(0,1) == '=') 
        body.push("print(" + parts[1].substr(1) + ");");
      else
        body.push(parts[1]);
    }
  });
  body.push("}");
  body.push("return $$p.join('');");
  var generator = new Function("$$context", body.join('\n'));
  return data ? generator(data) : generator;  // Curry
}


function test() {
  var sys = require("sys");
  
  var t1 = compile(
    '<script type="text/html" id="item_tmpl">\n'+
    '  <div id="<%=id%>" class="<%=(i % 2 == 1 ? " even" : "")%>">\n'+
    '    <div class="grid_1 alpha right">\n'+
    '      <img class="righted" src="<%=profile_image_url%>"/>\n'+
    '    </div>\n'+
    '    <div class="grid_6 omega contents">\n'+
    '       <p><b><a href="/<%=from_user%>"><%=from_user%></a>:</b> <%=text%></p>\n'+
    '    </div>\n'+
    '  </div>\n'+
    '</script>\n'
  );

  sys.print('\n\n');
  sys.print(t1({id:"IDENTIFIER", i:5, profile_image_url:"URL", from_user:"USER", text:"TEXT"}));
  
  var t2 = compile(
    '<script type="text/html" id="user_tmpl">\n'+
    '  <% for ( var i = 0; i < users.length; i++ ) { %>\n'+
    '    <li><a href="<%=users[i].url%>"><%=users[i].name%></a></li>\n'+
    '  <% } %>\n'+
    '</script>\n'
  );
  
  sys.print('\n\n');
  sys.print(t2({users:[{url:'URL1',name:'NAME1'}, {url:'URL2',name:'NAME2'}]}));
}

test();
