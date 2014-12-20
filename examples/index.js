var connect = require("connect")
var http = require("http")
var WPTProxy = require("../proxy.js") // wptproxy

var targets = [
  {id: "B", target: "http://example.com"}
]

var app = connect()

var wp = new WPTProxy({
  targets: targets
})

app.use(wp.handler)

http.createServer(app).listen(3000)