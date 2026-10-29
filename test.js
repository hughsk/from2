var test = require('tape')
var path = require('path')
var from = require('./')
var fs   = require('fs')

var tmp = path.resolve(
  __dirname, 'tmp.txt'
)

function fromString(string) {
  return from(function(size, next) {
    if (string.length <= 0) return next(null, null)
    var chunk = string.slice(0, size)
    string = string.slice(size)
    next(null, chunk)
  })
}

test('from2', function(t) {
  var contents = fs.readFileSync(__filename, 'utf8')
  var stream = fromString(contents)

  stream
    .pipe(fs.createWriteStream(tmp))
    .on('close', function() {
      t.equal(fs.readFileSync(tmp, 'utf8'), contents)
      fs.unlinkSync(tmp)
      t.end()
    })
})

test('old mode', function(t) {
  var contents = fs.readFileSync(__filename, 'utf8')
  var stream = fromString(contents)
  var buffer = ''

  stream.on('data', function(data) {
    buffer += data
  }).on('end', function() {
    t.equal(buffer, contents)
    t.end()
  })
})

test('destroy', function(t) {
  var stream = from(function(size, next) {
    process.nextTick(function() {
      next(null, 'no')
    })
  })

  stream.on('data', function(data) {
    t.ok(false)
  }).on('close', function() {
    t.ok(true)
    t.end()
  })

  stream.destroy()
})

test('arrays', function (t) {
  var input = ['a', 'b', 'c']
  var stream = from(input)
  var output = []
  stream.on('data', function (letter) {
    output.push(letter.toString())
  })
  stream.on('end', function () {
    t.deepEqual(input, output)
    t.end()
  })
})

test('obj arrays', function (t) {
  var input = [{foo:'a'}, {foo:'b'}, {foo:'c'}]
  var stream = from.obj(input)
  var output = []
  stream.on('data', function (letter) {
    output.push(letter)
  })
  stream.on('end', function () {
    t.deepEqual(input, output)
    t.end()
  })
})


test('arrays can emit errors', function (t) {
  var input = ['a', 'b', new Error('ooops'), 'c']
  var stream = from(input)
  var output = []
  stream.on('data', function (letter) {
    output.push(letter.toString())
  })
  stream.on('error', function(e){
    t.deepEqual(['a', 'b'], output)
    t.equal('ooops', e.message)
    t.end()
  })  
  stream.on('end', function () {
    t.fail('the stream should have errored')
  })
})

test('obj arrays can emit errors', function (t) {
  var input = [{foo:'a'}, {foo:'b'}, new Error('ooops'), {foo:'c'}]
  var stream = from.obj(input)
  var output = []
  stream.on('data', function (letter) {
    output.push(letter)
  })
  stream.on('error', function(e){
    t.deepEqual([{foo:'a'}, {foo:'b'}], output)
    t.equal('ooops', e.message)
    t.end()
  })
  stream.on('end', function () {
    t.fail('the stream should have errored')
  })
})


test('many synchronous chunks do not overflow the stack', function (t) {
  var remaining = 20000
  var received = ''
  var stream = from(function (size, next) {
    if (!remaining) return next(null, null)
    remaining--
    next(null, 'x')
  })

  stream.on('data', function (chunk) {
    received += chunk.toString()
  })
  stream.on('end', function () {
    t.equal(received, new Array(20001).join('x'))
    t.end()
  })
})

test('synchronous object reads respect backpressure and order', function (t) {
  var produced = 0
  var received = 0
  var ordered = true
  var sizes = true
  var stream = from({ objectMode: true, highWaterMark: 8 }, function (size, next) {
    sizes = sizes && size === 8
    if (produced === 20000) return next(null, null)
    next(null, produced++)
  })

  stream.read(0)
  t.equal(produced, 8, 'stops when the buffer is full')
  stream.on('data', function (value) {
    ordered = ordered && value === received++
  })
  stream.on('end', function () {
    t.equal(received, 20000)
    t.ok(ordered, 'preserves chunk order')
    t.ok(sizes, 'preserves the requested read size')
    t.end()
  })
})

test('mixed synchronous and asynchronous reads preserve errors', function (t) {
  var produced = 0
  var received = 0
  var failure = new Error('read failed')
  var stream = from(function (size, next) {
    if (produced === 20000) return next(failure)
    produced++
    if (produced % 1000 === 0) {
      process.nextTick(function () { next(null, 'x') })
    } else {
      next(null, 'x')
    }
  })

  stream.on('data', function (chunk) { received += chunk.length })
  stream.on('error', function (err) {
    t.equal(err, failure)
    t.equal(received, 20000)
  })
  stream.on('end', function () { t.fail('must not end after a read error') })
  stream.on('close', function () { t.end() })
})

test('synchronous rereads use the configured buffer size', function (t) {
  var sizes = []
  var stream = from({ highWaterMark: 8 }, function (size, next) {
    sizes.push(size)
    next(null, sizes.length > 40 ? null : 'x')
  })

  t.equal(stream.read(32).length, 32)
  t.equal(sizes[0], 32)
  t.equal(sizes[1], 8)
  stream.resume()
  stream.on('end', function () { t.end() })
})
test('asynchronous reads still complete', function (t) {
  var remaining = 20
  var received = ''
  var stream = from(function (size, next) {
    process.nextTick(function () {
      next(null, remaining-- ? 'x' : null)
    })
  })

  stream.on('data', function (chunk) { received += chunk.toString() })
  stream.on('end', function () {
    t.equal(received, new Array(21).join('x'))
    t.end()
  })
})

test('read requests wait for the pending asynchronous callback', function (t) {
  var calls = 0
  var complete
  var stream = from(function (size, next) {
    calls++
    complete = next
    this.read(0)
  })

  stream.read(0)
  stream.read(0)
  t.equal(calls, 1, 'does not start a second pending read')
  complete(null, 'x')
  t.equal(calls, 2, 'requests more data after the callback')
  t.equal(stream.read().toString(), 'x')
  stream.read(0)
  t.equal(calls, 2, 'waits for the next pending callback')
  complete(null, null)
  stream.resume()
  stream.on('end', function () { t.end() })
})
