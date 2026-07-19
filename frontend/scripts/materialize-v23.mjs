import { gunzipSync } from 'node:zlib'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const archive = readFileSync(resolve(root, 'v23/source.json.gz'))
const files = JSON.parse(gunzipSync(archive).toString('utf8'))
for (const [relative, content] of Object.entries(files)) {
  const target = resolve(root, 'src', relative)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
}

// V2.3 replaces the former App.tsx entry point; removing it also keeps strict TypeScript builds clean.
rmSync(resolve(root, 'src', 'App.tsx'), { force: true })

// Leaflet CircleMarker radius is updated through setRadius, not Path.setStyle.
const appPath = resolve(root, 'src', 'AppV23.tsx')
const appSource = readFileSync(appPath, 'utf8').replace(
  ".setStyle({ radius: selected ? 11 : 8, color: selected ? '#21d7ff' : '#087f5b' })",
  ".setRadius(selected ? 11 : 8).setStyle({ color: selected ? '#21d7ff' : '#087f5b' })"
)
writeFileSync(appPath, appSource, 'utf8')
console.log(`Materialized ${Object.keys(files).length} BusBD V2.3 frontend files.`)
