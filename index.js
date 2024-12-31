const fs = require('fs')
const axios = require('axios')
const mkdirp = require('mkdirp')
const PromisePool = require('async-promise-pool')
const Versions = require('./versions')

const token = process.env.TOKEN
const dir = './packages'

setTimeout(async () => {
  const packages = await getPackageList()
  console.log(`Downloading ${packages.length} packages`)

  const pool = new PromisePool({ concurrency: 10 })
  mkdirp.sync(dir)

  packages.forEach((package) => {
    pool.add(async () => {
      const majorVersions = uniqBy(package.versions, (v) => v.split('.')[0])
      for (let i = 0; i < majorVersions.length; i++) {
        await downloadPackage(package.name, majorVersions[i])
      }
    })
  })

  await pool.all()
})

const getPackageList = async () => {
  const [newRes, oldRes] = await Promise.all([
    axios.get('https://package.elm-lang.org/all-packages'),
    axios.get('https://elm.dmy.fr/all-packages?elm-package-version=0.18'),
  ])

  const nameToVersions = newRes.data
  const newPackageNames = new Set(Object.keys(newRes.data))
  const allPackages = Array.from(newPackageNames)
    .map((name) => ({ name, versions: nameToVersions[name] }))
    .concat(oldRes.data.filter(({ name }) => !newPackageNames.has(name)))
    .map((pkg) => ({
      ...pkg,
      versions: pkg.versions.sort((a, b) => {
        switch (Versions.compare(a, b)) {
          case 'gt':
            return 1
          case 'lt':
            return -1
          case 'eq':
            return 0
          default:
            throw new Error(`Unexpected compare value: ${a}, ${b}`)
        }
      }),
    }))
  return allPackages
}

const downloadPackage = async (name, version) => {
  try {
    const existing = await readJson(`${dir}/${name}@${version}.json`)
    return // already have it
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e
    }
  }
  try {
    const elmJson = await getFileAtVersion(name, 'elm.json', version)
    writeFile(name, version, elmJson)
  } catch (e) {
    if (e.response && e.response.status === 404) {
      return await downloadOldPackage(name, version)
    } else {
      console.log(`Error with elm.json ${name}@${version}`)
      console.log(e)
    }
  }
}

const downloadOldPackage = async (name, version) => {
  try {
    const elmJson = await getFileAtVersion(name, 'elm-package.json', version)
    // old packages didn't include their own name...
    const pkg = { ...JSON.parse(elmJson), name }
    writeFile(name, version, JSON.stringify(pkg, null, 2))
  } catch (e) {
    if (e.response && e.response.status === 404) {
      console.log('404', name, version)
    } else {
      console.log(`Error with elm-package.json ${name}@${version}`)
      console.log(e)
    }
  }
}

const writeFile = (name, version, elmJson) => {
  const [username, pkgname] = name.split('/')
  mkdirp.sync(`${dir}/${username}`)
  fs.writeFileSync(`${dir}/${username}/${pkgname}@${version}.json`, elmJson)
}

const getFileAtVersion = async (repo, filename, version) => {
  const url = `https://api.github.com/repos/${repo}/contents/${filename}?ref=${version}`
  const res = await respectfulGET(url, { Authorization: `token ${token}` })
  return Buffer.from(res.data.content, 'base64').toString('utf-8')
}

const uniqBy = (list, by) => {
  let obj = {}
  for (let i = 0; i < list.length; i++) {
    let item = list[i]
    let key = by(item)
    obj[key] = item
  }
  return Object.values(obj)
}

const respectfulGET = async (url, headers) => {
  try {
    return await axios.get(url, { headers })
  } catch (e) {
    if (
      e.response &&
      e.response.status === 403 &&
      (e.response.data.message.includes('abuse') ||
        e.response.data.message.includes('rate limit'))
    ) {
      // rate limit!
      // TODO: could check /rate_limit to know how long to sleep
      // https://docs.github.com/en/rest/rate-limit?apiVersion=2022-11-28
      // maybe this response even includes the timestamp
      console.log('sleep!')
      await sleep(30 * 1000)
      return await respectfulGET(url, headers)
    } else {
      throw e
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
