module.exports = WPTProxy

/**
 * Create a new instance of WPT Proxy
 * @class
 * @param {Object} options
 * @see https://github.com/lafikl/WPTProxy
 */
function WPTProxy(options) {
  if ( !options ) options = {}
  
  if ( typeof options != "object" || Array.isArray(options) != false) {
    throw new Error("options must be an object.")
  }

  if ( options.targets && !Array.isArray(options.targets) ) {
    throw new Error("options.targets must be an array.")
  }

  this.targets = options.targets

  this.aliveTargets = options.targets

  this.proxy = require('http-proxy').createProxyServer({})

  this.handler = this.handler.bind(this)

  this.healthCheckInterval = options.healthCheck || 5000


  this.watchDog()
}


/**
 * List of the upstream WPT instances
 * @type {Array}
 */
WPTProxy.prototype.targets = []


/**
 * List of the alive upstream WPT instances
 * @type {Array}
 */
WPTProxy.prototype.aliveTargets = []


/**
 * Override the list of the upstream WPT instances
 * @this WPTProxy
 * @param {Array} targets
 */
WPTProxy.prototype.setTargets = function(targets) {
  this.targets = targets
}


/**
 * return the list of the upstream WPT instances
 * @this WPTProxy
 * @returns {Array} list of targets
 */
WPTProxy.prototype.getTargets = function() {
  return this.targets
}


/**
 * return the list of the upstream WPT instances
 * @this WPTProxy
 * @returns {Array} list of targets
 */
WPTProxy.prototype.getAliveTargets = function() {
  return this.aliveTargets
}

/**
 * Override the list of the alive upstream WPT instances
 * @this WPTProxy
 * @param {Array} targets
 */
WPTProxy.prototype.setAliveTargets = function(targets) {
  this._turn = 0
  this.aliveTargets = targets
}


/**
 * Index of the upstream target.
 * Used to implement a simple round-robin load balancer.
 * @type {Number}
 */
WPTProxy.prototype._turn = 0


/**
 * Get an alive upstream target either by Id or round-robin
 * @param  {HTTP Request Object} req
 * @return {Object}
 */
WPTProxy.prototype.getAliveTarget = function(req) {
  var url = require("url")
  var qs = url.parse(req.url, true).query

  console.log(this.getAliveTargets())
  var target
  if ( qs.test ) {
    target = this._getById(qs.test)
  }
  if ( !target ) {
    console.log("Round Robin")
    target = this._roundRobin()
  }

  return target
}


/**
 * Find upstream by server ID
 * @param  {String} testId
 * @return {Object|Boolean}
 */
WPTProxy.prototype._getById = function(testId) {
  var matches = testId.match(/[1-9]+_([A-Za-z]).+_[1-9]+/)
  if ( !matches || matches.length < 2 )
    return false

  var serverId = matches[1]
  var target 
  for (var i = 0; i < this.aliveTargets.length; i++) {
    if ( this.aliveTargets[i].id == serverId ) {
      
      target = this.aliveTargets[i]
      console.log("Found by ID", target)
      break
    }
  }

  return target
}


/**
 * Simple round-robin load balancer
 * @return {Object}
 */
WPTProxy.prototype._roundRobin = function() {
  if ( this._turn > this.aliveTargets.length - 1 )
    this._turn = 0

  var target = this.aliveTargets[this._turn]
  this._turn++
  return target
}


/**
 * HTTP requests handler that gets passed to the HTTP server
 * 
 * @this WPTProxy
 * @param  {HTTP Request Object} req
 * @param  {HTTP Response Object} res
 */
WPTProxy.prototype.handler = function(req, res) {
  this.proxy.web(req, res, this.getAliveTarget(req))
}


/**
 * Health check for the list of targets
 * if the statusCode is not 2xx then it's considered dead
 *
 * @this WPTProxy
 * @param  {Array} targets
 * @param  {Function} cb
 */
WPTProxy.prototype.watchDog = function() {
  var request = require("request")
  var eachAsync = require("each-async")

  var targets = this.getTargets()
  var self = this

  setTimeout(function() {
    var newTargets = []
    eachAsync(targets, function(target, index, done) {
      request(target.target, function(err, resp, body) {
        if ( err || resp.statusCode != 200 ) {
          done()
          return console.log(err)
        }
        newTargets.push(target)
        done()
      })
    }, function done() {
      self.setAliveTargets(newTargets)
      self.watchDog()
    })

  }, this.healthCheckInterval)
}