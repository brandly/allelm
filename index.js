const fs = require('fs')
const axios = require('axios')
const mkdirp = require('mkdirp')
const PromisePool = require('async-promise-pool')

const token = process.env.TOKEN
const dir = './packages'

;(async () => {
  const { data } = await axios.get('https://package.elm-lang.org/search.json')
  mkdirp.sync(dir)

  const pool = new PromisePool({ concurrency: 5 })

  for (let i = 0; i < data.length; i++) {
    const { name } = data[i]
    const versions = await getVersions(name)
    const majorVersions = uniqBy(versions, v => v.split('.')[0])

    majorVersions.forEach(version => {
      pool.add(() => downloadPackage(name, version))
    })
  }

  await pool.all()
})()

const getVersions = async name => {
  const url = `https://package.elm-lang.org/packages/${name}/releases.json`
  const res = await axios.get(url)
  return Object.keys(res.data)
}

const downloadPackage = async (name, version) => {
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
