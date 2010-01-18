// Templates with embedded JavaScript
//
// Some credit is due to John Resig:
// http://ejohn.org/blog/javascript-micro-templating/
// and the templating follows that syntax and that of EJS:
// http://embeddedjs.com/
// Unlike the former, however, this implementation preserved newlines, etc.
//
// The template syntax is literal text, in which may be embedded:
// - Arbitrary code sections between <% ... %> tags, and
// - Evaluated expressions between <%= ... %> tags.
// The code sections may use `print(x)` to add output as well/
//
// Example template:
//
// <ul class="<%= className %>"> <% for (var i=0; item[i]; ++i) { %>
//     <li> <% print(item[i]); 
//   } %> 
// </ul>
//
// would produce, with data { className:"bold", item:["One", "Two"]} :
//
// <ul class="bold"> 
//   <li> One 
//   <li> Two 
// </ul>
//


var template = exports.template = function(template, data) {
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

  var t0 = template(
    '<ul class="<%= className %>"> \n' +
    '  <% for (var i=0; item[i]; ++i) { %> \n' +
    '     <li> <% print(item[i]); \n' +
    '  } %> \n' + 
    '</ul>');

  sys.print(t0({ className:"bold", item:["One", "Two"]}));
  
  var t1 = template(
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
  
  var t2 = template(
    '<script type="text/html" id="user_tmpl">\n'+
    '  <% for ( var i = 0; i < users.length; i++ ) { %>\n'+
    '    <li><a href="<%=users[i].url%>"><%=users[i].name%></a></li>\n'+
    '  <% } %>\n'+
    '</script>\n'
  );
  
  sys.print('\n\n');
  sys.print(t2({users:[{url:'URL1',name:'NAME1'}, {url:'URL2',name:'NAME2'}]}));
}

//test();
