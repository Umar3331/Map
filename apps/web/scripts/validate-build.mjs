import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const dist = path.resolve('dist')
const assets = path.join(dist, 'assets')
const assetNames = await readdir(assets)
const workers = assetNames.filter((name) => /^maplibre-gl-worker-[A-Za-z0-9_-]+\.js$/.test(name))

if (workers.length !== 1) {
  throw new Error(`Expected exactly one emitted MapLibre worker; found ${workers.length}`)
}

const worker = workers[0]
const workerPath = path.join(assets, worker)
const workerBytes = (await stat(workerPath)).size
const workerPrefix = (await readFile(workerPath, 'utf8')).slice(0, 100).toLowerCase()
if (workerBytes < 100_000 || workerPrefix.includes('<!doctype html')) {
  throw new Error(`Emitted MapLibre worker is not a valid JavaScript bundle: ${worker}`)
}

const applicationBundle = assetNames.find((name) => /^index-[A-Za-z0-9_-]+\.js$/.test(name))
if (!applicationBundle) throw new Error('Production application bundle is missing')
const application = await readFile(path.join(assets, applicationBundle), 'utf8')
if (!application.includes(`/assets/${worker}`)) {
  throw new Error(`Application bundle does not reference emitted worker ${worker}`)
}

const serviceWorker = await readFile(path.join(dist, 'sw.js'), 'utf8')
if (!serviceWorker.includes(`assets/${worker}`)) {
  throw new Error(`Workbox precache does not include emitted worker ${worker}`)
}
