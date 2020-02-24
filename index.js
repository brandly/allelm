const fs = require('fs')
const axios = require('axios')
const mkdirp = require('mkdirp')
const PromisePool = require('async-promise-pool')

const token = process.env.TOKEN
const dir = './packages'

setTimeout(async () => {
  const packages = await getPackageList()
  console.log(`Downloading ${packages.length} packages`)

  const pool = new PromisePool({ concurrency: 5 })
  mkdirp.sync(dir)

  packages.forEach(package => {
    pool.add(async () => {
      let versions
      try {
        versions = await getVersions(package.name)
      } catch (e) {
        console.log('Error getting versions', package.name, e)
        return
      }
      const majorVersions = uniqBy(versions, v => v.split('.')[0])
      for (let i = 0; i < majorVersions.length; i++) {
        await downloadPackage(package.name, majorVersions[i])
      }
    })
  })

  await pool.all()
})

// TODO: use this url instead
// https://package.elm-lang.org/all-packages
const getPackageList = async () => {
  const newRes = await axios.get('https://package.elm-lang.org/search.json')
  const oldRes = await axios.get(
    'https://elm.dmy.fr/all-packages?elm-package-version=0.18'
  )
  const newPackageNames = new Set(newRes.data.map(p => p.name))
  const allPackages = newRes.data.concat(
    oldRes.data.filter(({ name }) => !newPackageNames.has(name))
  )
  return allPackages
}

const getVersions = async name => {
  const url = `https://package.elm-lang.org/packages/${name}/releases.json`
  const res = await axios.get(url)
  return Object.keys(res.data)
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
  const url = `https://api.github.com/repos/${repo}/contents/${filename}?ref=${version}&access_token=${token}`
  const res = await respectfulGET(url)
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

const respectfulGET = async url => {
  try {
    return await axios.get(url)
  } catch (e) {
    if (
      e.response &&
      e.response.status === 403 &&
      (e.response.data.message.includes('abuse') ||
        e.response.data.message.includes('rate limit'))
    ) {
      // rate limit!
      console.log('sleep!')
      await sleep(30 * 1000)
      return await respectfulGET(url)
    } else {
      throw e
    }
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

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
