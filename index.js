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
    this._reading = false
    this.destroyed = false
    Readable.call(this, override || opts)
  }

  Class.prototype._from = read
  Class.prototype._read = function(size) {
    var self = this

    if (this._reading || this.destroyed) return
    this._reading = true
    this._from(size, check)
    function check(err, data) {
      if (self.destroyed) return
      if (err) return self.emit('error', err)
      if (data === null) return self.push(null)
      self._reading = false
      if (self.push(data)) self._read()
    }
  }

  Class.prototype.destroy = function(err) {
    if (this.destroyed) return
    this.destroyed = true
    if (err) this.emit('error', err)
    this.emit('close')
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
  opts.highWaterMark = 16

  return from2(opts, read)
}

function defaults(opts) {
  opts = opts || {}
  return opts
}
