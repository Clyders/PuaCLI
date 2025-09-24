import fs from 'fs'
import path from 'path'
import fg from 'fast-glob'

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function safeStat(p) {
  try { return fs.statSync(p) } catch { return null }
}

function getWorkspaces(pkg) {
  if (Array.isArray(pkg.workspaces)) return pkg.workspaces
  if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) return pkg.workspaces.packages
  return null
}

async function findPackages(rootPath) {
  const rootPkgPath = path.join(rootPath, 'package.json')
  const rootStat = safeStat(rootPkgPath)
  if (!rootStat) return [rootPath]
  const pkg = readJson(rootPkgPath)
  const ws = getWorkspaces(pkg)
  if (!ws) return [rootPath]
  const patterns = ws.map(w => path.posix.join(w, 'package.json'))
  const matches = await fg(patterns, { cwd: rootPath, dot: false })
  const dirs = matches.map(m => path.join(rootPath, path.dirname(m)))
  if (!dirs.includes(rootPath)) dirs.unshift(rootPath)
  return Array.from(new Set(dirs))
}

export { findPackages }