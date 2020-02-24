const assert = require('assert')

const parseRange = range => {
  // 1.0.0 <= v < 2.0.0
  const splits = range.split(' '),
    low = parseVersion(splits[0].trim()),
    high = parseVersion(splits[4].trim()),
    first = getComp(splits[1]),
    second = getComp(splits[3])

  return version => {
    let v = parseVersion(version)
    return first(low, v) && second(v, high)
  }
}

const parseVersion = str =>
  str
    .split('.')
    .map(v => parseInt(v))
    .slice(0, 3)

const gt = (a, b) => compare(a, b) === 'gt'
const gte = (a, b) => {
  let comp = compare(a, b)
  return comp === 'gt' || comp === 'eq'
}
const lt = (a, b) => compare(a, b) === 'lt'
const lte = (a, b) => {
  let comp = compare(a, b)
  return comp === 'lt' || comp === 'eq'
}
const getComp = str => {
  switch (str) {
    case '>':
      return gt
    case '>=':
      return gte
    case '<':
      return lt
    case '<=':
      return lte
    default:
      throw new Error(`Unexpected getComp str: ${str}`)
  }
}
const compare = (a, b) => {
  if (typeof a === 'string') {
    a = parseVersion(a)
  }
  if (typeof b === 'string') {
    b = parseVersion(b)
  }
  if (!a.length || !b.length) {
    return 'eq'
  }

  if (a[0] === b[0]) {
    return compare(a.slice(1), b.slice(1))
  } else if (a[0] < b[0]) {
    return 'lt'
  } else {
    return 'gt'
  }
}

assert.equal(compare('1.0.10', '1.0.9'), 'gt')
assert.equal(parseRange('2.0.0 <= v <= 2.1.0')('2.1.0'), true)

module.exports = {
  parseRange,
  parseVersion,
  gte,
  lt,
  compare
}
