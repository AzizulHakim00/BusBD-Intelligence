import { gunzipSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const encoded = readFileSync(resolve(root, 'v2/source.json.gz.b64'), 'utf8').trim()
const files = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'))
for (const [relative, content] of Object.entries(files)) {
  const target = resolve(root, 'src', relative)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
}
console.log(`Materialized ${Object.keys(files).length} BusBD V2 frontend source files.`)
