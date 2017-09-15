import { Reader } from 'protobufjs'
var hexy = require('hexy');

// indent by count
const indent = count => Array(count).join('  ')

// is a number a float?
const isFloat = n => Number(n) === n && n % 1 !== 0

/**
 * Turn a protobuf into a data-object
 *
 * @param      {Buffer}   buffer  The proto in a binary buffer
 * @return     {object[]}         Info about the protobuf
 */
export const getData = buffer => {
  const reader = Reader.create(buffer)
  const out = []
  while (reader.pos < reader.len) {
    const tag = reader.uint64()
    const id = tag >>> 3
    const wireType = tag & 7
    switch (wireType) {
      case 0: // int32, int64, uint32, bool, enum, etc
        out.push({[id]: reader.uint32()})
        break
      case 1: // fixed64, sfixed64, double
        out.push({[id]: reader.fixed64()})
        break
      case 2: // string, bytes, sub-message
        const bytes = reader.bytes()
        try {
          const innerMessage = getData(bytes)
          out.push({[id]: innerMessage})
        } catch (e) {
          // search buffer for extended chars
          console.log('tag:', tag, ' id:', id, ' wire:', wireType);
          console.log(e);
          let hasExtended = false
          bytes.forEach(b => {
            if (b < 32) {
              hasExtended = true
            }
          })
          if (hasExtended) {
            console.log('Extended', hexy.hexy(new Buffer(bytes)));
            out.push({[id]: bytes})
          } else {
            console.log('UnExtended', hexy.hexy(new Buffer(bytes)));
            out.push({[id]: bytes.toString()})
          }
        }
        break
      // IGNORE start_group
      // IGNORE end_group
      case 5: // fixed32, sfixed32, float
        out.push({[id]: reader.float()})
        break
      default: reader.skipType(wireType)
    }
  }
  return out
}

const handleMessage = (msg, m = 'Root', level = 1) => {
  const seen = []
  const repeated = []
  const lines = msg.map(field => {
    const n = Object.keys(field).pop()
    const t = Array.isArray(field[n]) ? 'array' : typeof field[n]
    switch (t) {
      case 'object': // it's a buffer
      case 'string':
        return `${indent(level + 1)}string field${n} = ${n}; // could be a repeated-value, string, buffer, or malformed sub-message`
      case 'number':
        return isFloat(field[n])
          ? `${indent(level + 1)}float field${n} = ${n}; // could be a fixed64, sfixed64, double, fixed32, sfixed32, or float`
          : `${indent(level + 1)}int32 field${n} = ${n}; // could be a int32, int64, uint32, bool, enum, etc, or even a float of some kind`
      case 'array': // sub-message
        if (seen.indexOf(n) === -1) {
          seen.push(n)
          return `\n${handleMessage(field[n], n, level + 1)}\n${indent(level + 1)}\n${indent(level + 1)}Message${n} subMessage${n} = ${n};`
        } else {
          repeated.push(n)
        }
    }
  }).filter(l => l)

  const repeatHandled = []
  repeated.forEach(num => {
    lines.forEach((l, i) => {
      if (l.indexOf(`subMessage${num}`) !== -1 && repeatHandled.indexOf(num) === -1) {
        lines[i] = l.replace(`Message${num} subMessage${num}`, `repeated Message${num} subMessage${num}`)
        repeatHandled.push(num)
      }
    })
  })

  return `${indent(level)}Message${m} {\n${lines.join('\n')}\n${indent(level)}}`
}

/**
 * Gets the proto-definition string from a binary protobuf message
 *
 * @param      {Buffer}  buffer  The buffer
 * @return     {string}  The proto
 */
export const getProto = buffer => {
  const data = getData(buffer)
  let out = 'syntax = "proto3";\n\n'
  out += handleMessage(data)
  return out
}
