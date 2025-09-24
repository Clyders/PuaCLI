import fs from 'fs'
import path from 'path'
import fg from 'fast-glob'
import { parse } from '@babel/parser'
import traverseLib from '@babel/traverse'
const traverse = traverseLib.default

function readJson(filePath) {
  const data = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(data)
}

function safeStat(p) {
  try { return fs.statSync(p) } catch { return null }
}

function collectSourceFiles(projectPath) {
  const patterns = ['**/*.{js,jsx,ts,tsx}', '!**/node_modules/**', '!**/dist/**', '!**/build/**']
  return fg.sync(patterns, { cwd: projectPath, dot: false, followSymbolicLinks: true }).map(p => path.join(projectPath, p))
}

function parseFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8')
  const ext = path.extname(filePath)
  const isTS = ext === '.ts' || ext === '.tsx'
  return parse(code, {
    sourceType: 'unambiguous',
    plugins: [
      'jsx',
      isTS ? 'typescript' : null,
      'dynamicImport'
    ].filter(Boolean)
  })
}

function extractImportsFromAst(ast) {
  const names = new Set()
  traverse(ast, {
    ImportDeclaration(path) {
      const v = path.node.source && path.node.source.value
      if (v) names.add(v)
    },
    CallExpression(path) {
      const callee = path.node.callee
      if (callee && callee.type === 'Identifier' && callee.name === 'require') {
        const arg = path.node.arguments && path.node.arguments[0]
        if (arg && arg.type === 'StringLiteral') names.add(arg.value)
      }
    }
  })
  return names
}

function normalizeToPackage(importName) {
  if (!importName) return null
  if (importName.startsWith('.') || importName.startsWith('/') || importName.startsWith('..')) return null
  if (importName.startsWith('@')) {
    const parts = importName.split('/')
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importName
  }
  const parts = importName.split('/')
  return parts[0]
}

function loadPackageJson(projectPath) {
  const pkgPath = path.join(projectPath, 'package.json')
  const stat = safeStat(pkgPath)
  if (!stat) throw new Error(`package.json not found in ${projectPath}`)
  return readJson(pkgPath)
}

function listDeclaredDependencies(pkg) {
  const deps = Object.keys(pkg.dependencies || {})
  const devDeps = Object.keys(pkg.devDependencies || {})
  const optionalDeps = Object.keys(pkg.optionalDependencies || {})
  const peerDeps = Object.keys(pkg.peerDependencies || {})
  const all = new Set([...deps, ...devDeps, ...optionalDeps, ...peerDeps])
  return { deps, devDeps, all: Array.from(all) }
}

function detectUsedPackages(projectPath, files, verbose) {
  const used = new Set()
  for (const f of files) {
    try {
      const ast = parseFile(f)
      const imports = extractImportsFromAst(ast)
      for (const imp of imports) {
        const pkgName = normalizeToPackage(imp)
        if (pkgName) used.add(pkgName)
      }
      if (verbose) process.stdout.write('.')
    } catch {
      if (verbose) process.stdout.write('!')
    }
  }
  if (verbose) process.stdout.write('\n')
  return Array.from(used)
}

function filterUnused(declared, used) {
  const usedSet = new Set(used)
  const unused = declared.deps.filter(d => !usedSet.has(d))
  const devUnused = declared.devDeps.filter(d => !usedSet.has(d))
  return { unused, devUnused }
}

async function analyzeProject({ projectPath, verbose = false }) {
  const pkg = loadPackageJson(projectPath)
  const declared = listDeclaredDependencies(pkg)
  const files = collectSourceFiles(projectPath)
  const used = detectUsedPackages(projectPath, files, verbose)
  const { unused, devUnused } = filterUnused(declared, used)
  const usedDeclared = declared.all.filter(d => used.includes(d))
  return { used: usedDeclared, unused, devUnused, declared: declared.all }
}

export { analyzeProject }