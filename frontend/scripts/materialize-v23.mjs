import { gunzipSync } from 'node:zlib'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const archivePath = resolve(root, 'v23/source.json.gz')

if (!existsSync(archivePath)) throw new Error(`Missing V2.3 archive: ${archivePath}`)

let archive = readFileSync(archivePath)
if (!(archive[0] === 0x1f && archive[1] === 0x8b)) {
  const encoded = archive.toString('utf8').replace(/\s+/g, '')
  archive = Buffer.from(encoded, 'base64')
}

const decoded = gunzipSync(archive).toString('utf8')
const files = JSON.parse(decoded)

for (const [relative, content] of Object.entries(files)) {
  const normalized = relative.startsWith('src/') ? relative.slice(4) : relative
  const target = resolve(root, 'src', normalized)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8')
}

console.log(`Materialized ${Object.keys(files).length} BusBD V2.3 frontend files.`)
