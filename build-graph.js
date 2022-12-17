const fs = require('fs')
const createGraph = require('ngraph.graph')
const Versions = require('./versions')

const filePaths = fs.readFileSync(0).toString().trim().split('\n')

const readJson = (p) => {
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

;(async function () {
  const graph = createGraph()

  const packageLookup = {}
  const insert = (path, pkg) => {
    let [name, version] = parseFilePath(path)
    if (pkg.name !== name) {
      console.log(
        `package name doesn't match: Published as ${name}@${version}, elm.json says ${pkg.name}`
      )
    }
    if (pkg.version !== version) {
      console.log(
        `package version doesn't match: Published as ${name}@${version}, elm.json says ${pkg.version}`
      )
    }
    if (!(name in packageLookup)) {
      packageLookup[name] = {}
    }

    packageLookup[name][version] = pkg
    graph.addNode(pkgName({ name, version }), pkg)
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
      const isMatchingVersion = Versions.parseRange(deps[dep])
      if (!(dep in packageLookup)) {
        console.log('Unknown dep:', dep, deps[dep])
        console.log('needed for:', name, version)
        continue
      }
      const depVersion = Object.keys(packageLookup[dep]).find(isMatchingVersion)
      if (!depVersion) {
        console.log(`${name}@${version}`)
        console.log('no matching version:', dep, deps[dep])
        console.log('available:', Object.keys(packageLookup[dep]).join(', '))
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
    outDir: './data',
  })

  console.log('Done.')
  console.log(
    'Copy `links.bin`, `labels.bin` and `positions.bin` into vis folder'
  )
})()

const pkgName = (pkg) => `${pkg.name}@${pkg.version}`

const parseFilePath = (path) =>
  path
    .replace(/^\.\/packages\//, '')
    .replace(/\.json$/, '')
    .split('@')
