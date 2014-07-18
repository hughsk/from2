var Readable = require('readable-stream').Readable
var inherits = require('inherits')

module.exports = from2

from2.ctor = ctor
from2.obj = obj

var Proto = ctor()

function from2(opts, read) {
  if (typeof opts === 'function') {
    read = opts
    opts = {}
  }

  var rs = new Proto(opts)
  rs._from = read
  return rs
}

function ctor(opts, read) {
  if (typeof opts === 'function') {
    read = opts
    opts = {}
  }

  opts = defaults(opts)

  inherits(Class, Readable)
  function Class(override) {
    if (!(this instanceof Class)) return new Class(override)
    Readable.call(this, override || opts)
  }

  Class.prototype._from = read
  Class.prototype._read = function(size) {
    var self = this

    this._from(size, check)
    function check(err, data) {
      if (err) return self.emit('error', err)
      if (data === null) return self.push(null)
      if (self.push(data)) self._from(size, check)
    }
  }

  return Class
}

function obj(opts, read) {
  if (typeof opts === 'function') {
    read = opts
    opts = {}
  }

  opts = defaults(opts)
  opts.objectMode = true

  return from2(opts, read)
}

function defaults(opts) {
  opts = opts || {}
  return opts
}
