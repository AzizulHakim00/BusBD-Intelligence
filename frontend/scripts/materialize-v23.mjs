import { gunzipSync } from 'node:zlib'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const archivePath = resolve(root, 'v23/source.json.gz')

if (!existsSync(archivePath)) {
  throw new Error(`V2.3 frontend archive is missing: ${archivePath}`)
}

const archive = readFileSync(archivePath)
const files = JSON.parse(gunzipSync(archive).toString('utf8'))

for (const [relative, content] of Object.entries(files)) {
  const target = resolve(root, 'src', relative)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, String(content), 'utf8')
}

const mainPath = resolve(root, 'src', 'main.tsx')
const mainSource = existsSync(mainPath) ? readFileSync(mainPath, 'utf8') : ''
const appCandidates = ['AppV23.tsx', 'App.tsx']

for (const appName of appCandidates) {
  const appPath = resolve(root, 'src', appName)
  if (!existsSync(appPath)) continue
  const appSource = readFileSync(appPath, 'utf8').replace(
    ".setStyle({ radius: selected ? 11 : 8, color: selected ? '#21d7ff' : '#087f5b' })",
    ".setRadius(selected ? 11 : 8).setStyle({ color: selected ? '#21d7ff' : '#087f5b' })"
  )
  writeFileSync(appPath, appSource, 'utf8')
}

if (mainSource.includes("'./AppV23'") || mainSource.includes('"./AppV23"')) {
  rmSync(resolve(root, 'src', 'App.tsx'), { force: true })
}

console.log(`Materialized ${Object.keys(files).length} BusBD V2.3 frontend files.`)
