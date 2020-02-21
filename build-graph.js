const fs = require('fs')
const createGraph = require('ngraph.graph')

// STDIN_FILENO = 0
const stdinBuffer = fs.readFileSync(0)

const filePaths = stdinBuffer
  .toString()
  .split('\n')
  .filter(Boolean)

const readJson = p => {
  return new Promise((resolve, reject) => {
    fs.readFile(p, 'utf-8', (e, contents) => {
      if (e) {
        return reject(e)
      }

      try {
        resolve(JSON.parse(contents))
      } catch (e) {
        reject(e)
      }
    })
  })
}

;(async function() {
  const graph = createGraph()

  const packageLookup = {}
  const insert = (path, pkg) => {
    if (`./packages/${pkg.name}@${pkg.version}.json` !== path) {
      console.log('package doesnt match path:', path)
      console.log(pkg)
      return
    }
    if (!(pkg.name in packageLookup)) {
      packageLookup[pkg.name] = {}
    }

    packageLookup[pkg.name][pkg.version] = pkg
    graph.addNode(pkgName(pkg), pkg)
  }

  for (let i = 0; i < filePaths.length; i++) {
    const json = await readJson(filePaths[i])
    insert(filePaths[i], json)
  }

  for (let i = 0; i < filePaths.length; i++) {
    let [name, version] = parseFilePath(filePaths[i])

    if (!(name in packageLookup) || !(version in packageLookup[name])) {
      // no package found
      continue
    }

    // create a node for each
    // console.log(`${name}@${version}`)
    const deps = packageLookup[name][version].dependencies
    for (let dep in deps) {
      const isMatchingVersion = parseRange(deps[dep])
      if (!(dep in packageLookup)) {
        console.log('Unknown dep:', dep, deps[dep], '\nfor:', name, version)
        continue
      }
      const depVersion = Object.keys(packageLookup[dep]).find(isMatchingVersion)
      if (!depVersion) {
        console.log(`${name}@${version}`)
        console.log('no matching version:', dep, deps[dep])
        continue
      }
      graph.addLink(
        pkgName({ name, version }),
        pkgName({ name: dep, version: depVersion })
      )
      // console.log(`  ${key}@${depVersion}`)
    }
  }

  // https://github.com/phiresky/crawl-arch/blob/master/layout.js
  console.log(
    'Loaded graph with ' +
      graph.getLinksCount() +
      ' edges; ' +
      graph.getNodesCount() +
      ' nodes'
  )

  const layout = require('ngraph.offline.layout')(graph)

  console.log('Starting layout')
  layout.run()

  const save = require('ngraph.tobinary')
  save(graph, {
    outDir: './data'
  })

  console.log('Done.')
  console.log(
    'Copy `links.bin`, `labels.bin` and `positions.bin` into vis folder'
  )
})()

const pkgName = pkg => `${pkg.name}@${pkg.version}`

const parseFilePath = path =>
  path
    .replace(/^\.\/packages\//, '')
    .replace(/\.json$/, '')
    .split('@')

const parseRange = range => {
  // 1.0.0 <= v < 2.0.0
  const splits = range.split('<'),
    low = splits[0].trim(),
    high = splits[2].trim()

  return version => version >= low && version < high
}
