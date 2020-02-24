const parseRange = range => {
  // 1.0.0 <= v < 2.0.0
  const splits = range
      .replace(/\<\=/g, '')
      .replace(/\</g, '')
      .split(' ')
      .filter(Boolean),
    low = parseVersion(splits[0].trim()),
    high = parseVersion(splits[2].trim())

  return version => {
    let v = parseVersion(version)
    // version >= low && version < high
    // console.log({ low, high }, v)
    return gte(v, low) && lt(v, high)
  }
}

const parseVersion = str =>
  str
    .split('.')
    .map(v => parseInt(v))
    .slice(0, 3)

const gte = (a, b) => {
  let comp = compare(a, b)
  return comp === 'gt' || comp === 'eq'
}
const lt = (a, b) => compare(a, b) === 'lt'
const compare = (a, b) => {
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

module.exports = {
  parseRange,
  parseVersion,
  gte,
  lt,
  compare
}
