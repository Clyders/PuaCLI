import fs from 'fs'
import path from 'path'
import { fetch } from 'undici'
import semver from 'semver'

function readJsonSync(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

async function registryInfo(name) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`registry ${name} ${res.status}`)
  return res.json()
}

async function suggestPackages({ projectPath, verbose = false }) {
  const pkgPath = path.join(projectPath, 'package.json')
  const pkg = readJsonSync(pkgPath)
  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.optionalDependencies || {}) }
  const outdated = []
  const deprecated = []
  const names = Object.keys(all)
  for (const name of names) {
    try {
      const info = await registryInfo(name)
      const latest = info['dist-tags'] && info['dist-tags'].latest
      const versions = info.versions || {}
      const currentRange = all[name]
      const resolvedCurrent = semver.minVersion(currentRange)?.version || null
      const currentVersion = resolvedCurrent && versions[resolvedCurrent] ? resolvedCurrent : Object.keys(versions).find(v => semver.satisfies(v, currentRange)) || null
      const currentDeprecated = currentVersion && versions[currentVersion] && versions[currentVersion].deprecated
      if (latest && currentVersion && semver.valid(latest) && semver.valid(currentVersion) && semver.gt(latest, currentVersion)) {
        outdated.push({ name, current: currentVersion, latest })
      }
      if (currentDeprecated) {
        deprecated.push({ name, version: currentVersion })
      }
      if (verbose) process.stdout.write('.')
    } catch {
      if (verbose) process.stdout.write('!')
    }
  }
  if (verbose) process.stdout.write('\n')
  return { outdated, deprecated }
}

export { suggestPackages }