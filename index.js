// from @tommoor
// https://github.com/tommoor/promise-pool/issues/4
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
    const { name, version, versions } = data[i]
    // `search.json` response seems to have changed in the past week
    if (version) {
      pool.add(() => fetchnwrite(name, version))
    } else if (versions instanceof Array) {
      for (let j = 0; j < versions.length; j++) {
        pool.add(() => fetchnwrite(name, versions[j]))
      }
    }
  }

  await pool.all()
})()

const fetchnwrite = async (name, version) => {
  try {
    const elmJson = await getElmJson(name, version)
    write(name, version, elmJson)
  } catch (e) {
    if (e.response && e.response.status !== 404) {
      console.log(`Error with ${name}@${version}`)
      console.log(
        `https://api.github.com/repos/${name}/contents/elm.json?ref=${version}`
      )
      console.log(e)
    }
  }
}

const write = (name, v, json) => {
  mkdirp.sync(`${dir}/${name.split('/')[0]}`)
  fs.writeFileSync(`${dir}/${name}@${v}.json`, json)
}

const getElmJson = async (name, v) => {
  const url = `https://api.github.com/repos/${name}/contents/elm.json?ref=${v}&access_token=${token}`
  const elmJson = await axios.get(url)
  const buf = Buffer.from(elmJson.data.content, 'base64')
  return buf.toString('utf-8')
}
