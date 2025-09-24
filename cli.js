#!/usr/bin/env node
import path from 'path'
import { fileURLToPath } from 'url'
import { Command } from 'commander'
import chalk from 'chalk'
import { analyzeProject } from './src/analyzer.js'
import { findPackages } from './src/monorepo.js'
import { suggestPackages } from './src/suggest.js'
import { persistScan } from './src/storage.js'

function resolveProjectPath(p) {
  if (!p) return process.cwd()
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)
}

async function runAnalyze(targetPath, opts) {
  const projects = opts.monorepo ? await findPackages(targetPath) : [targetPath]
  const results = []
  for (const projectPath of projects) {
    try {
      const result = await analyzeProject({ projectPath, verbose: opts.verbose })
      results.push({ projectPath, ...result })
      if (opts.db) await persistScan({ projectPath, result })
    } catch (err) {
      const msg = err && err.message ? err.message : String(err)
      if (opts.json) results.push({ projectPath, error: msg })
      else console.error(chalk.red(`Failed analyzing ${projectPath}: ${msg}`))
    }
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify({ results }, null, 2))
    return
  }
  for (const r of results) {
    if (r.error) {
      console.log(chalk.yellow(`[warn] ${r.projectPath}: ${r.error}`))
      continue
    }
    console.log(chalk.bold(r.projectPath))
    console.log(`${chalk.green('used')}: ${r.used.length}, ${chalk.red('unused')}: ${r.unused.length}`)
    if (r.used.length) console.log(chalk.green(r.used.join(', ')))
    if (r.unused.length) console.log(chalk.red(r.unused.join(', ')))
    if (r.devUnused && r.devUnused.length) console.log(chalk.yellow(`dev-unused: ${r.devUnused.join(', ')}`))
    console.log('')
  }
}

async function runUnused(targetPath, opts) {
  const projects = opts.monorepo ? await findPackages(targetPath) : [targetPath]
  const results = []
  for (const projectPath of projects) {
    try {
      const r = await analyzeProject({ projectPath, verbose: opts.verbose })
      results.push({ projectPath, unused: r.unused, devUnused: r.devUnused })
    } catch (err) {
      const msg = err && err.message ? err.message : String(err)
      results.push({ projectPath, error: msg })
    }
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify({ results }, null, 2))
    return
  }
  for (const r of results) {
    if (r.error) {
      console.log(chalk.yellow(`[warn] ${r.projectPath}: ${r.error}`))
      continue
    }
    if (r.unused.length === 0 && (!r.devUnused || r.devUnused.length === 0)) {
      console.log(chalk.green(`${r.projectPath}: no unused dependencies`))
      continue
    }
    console.log(chalk.bold(r.projectPath))
    if (r.unused.length) console.log(chalk.red(r.unused.join(', ')))
    if (r.devUnused && r.devUnused.length) console.log(chalk.yellow(`dev: ${r.devUnused.join(', ')}`))
  }
}

async function runSuggest(targetPath, opts) {
  const projects = opts.monorepo ? await findPackages(targetPath) : [targetPath]
  const suggestions = []
  for (const projectPath of projects) {
    try {
      const s = await suggestPackages({ projectPath, verbose: opts.verbose })
      suggestions.push({ projectPath, ...s })
    } catch (err) {
      const msg = err && err.message ? err.message : String(err)
      suggestions.push({ projectPath, error: msg })
    }
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify({ results: suggestions }, null, 2))
    return
  }
  for (const s of suggestions) {
    if (s.error) {
      console.log(chalk.yellow(`[warn] ${s.projectPath}: ${s.error}`))
      continue
    }
    console.log(chalk.bold(s.projectPath))
    if (s.outdated && s.outdated.length) {
      console.log(chalk.yellow('outdated'))
      for (const o of s.outdated) console.log(`${o.name} ${o.current} -> ${o.latest}`)
    }
    if (s.deprecated && s.deprecated.length) {
      console.log(chalk.red('deprecated'))
      for (const d of s.deprecated) console.log(`${d.name} ${d.version}`)
    }
    if ((!s.outdated || s.outdated.length === 0) && (!s.deprecated || s.deprecated.length === 0)) console.log(chalk.green('all up to date'))
  }
}

async function main() {
  const program = new Command()
  program
    .name('Package Usage Analytics CLI')
    .description('Analyze dependency usage in Node.js projects')
    .version('1.0.0')

  program
    .command('analyze')
    .argument('<project-path>')
    .option('--json', 'output JSON')
    .option('--verbose', 'verbose logs', false)
    .option('--monorepo', 'scan monorepo workspaces', false)
    .option('--db', 'persist results to sqlite when available', false)
    .action((p, opts) => runAnalyze(resolveProjectPath(p), opts))

  program
    .command('unused')
    .argument('<project-path>')
    .option('--json', 'output JSON')
    .option('--verbose', 'verbose logs', false)
    .option('--monorepo', 'scan monorepo workspaces', false)
    .action((p, opts) => runUnused(resolveProjectPath(p), opts))

  program
    .command('suggest')
    .argument('<project-path>')
    .option('--json', 'output JSON')
    .option('--verbose', 'verbose logs', false)
    .option('--monorepo', 'scan monorepo workspaces', false)
    .action((p, opts) => runSuggest(resolveProjectPath(p), opts))

  await program.parseAsync(process.argv)
}

main().catch(err => {
  const msg = err && err.stack ? err.stack : String(err)
  console.error(msg)
  process.exit(1)
})