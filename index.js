var Readable = require('readable-stream').Readable
var inherits = require('inherits')

module.exports = from2

from2.ctor = ctor
from2.obj = obj

function from2(opts, read) {
  return new (ctor(opts, read))
}

function ctor(opts, read) {
  if (typeof opts === 'function') {
    read = opts
    opts = {}
  }

  opts = defaults(opts)

  inherits(Class, Readable)
  function Class() {
    if (!(this instanceof Class)) return new Class
    this._reading = false
    Readable.call(this, opts)
  }

  Class.prototype._from = read
  Class.prototype._read = function(size) {
    var self = this

    if (this._reading) return
    this._reading = true
    this._from(size, check)
    function check(err, data) {
      if (err) return self.emit('error', err)
      if (data === null) return self.push(null)
      self._reading = false
      if (self.push(data)) self._read()
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
