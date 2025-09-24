# Package Usage Analytics CLI

Analyze dependency usage in Node.js projects. Works with JavaScript and TypeScript, supports monorepos, optional JSON output, and optional SQLite logging.

## Install

```bash
npm i -g puacli
```

Or run locally after cloning:

```bash
npm install
npm start -- --help
```

## Usage

```bash
pua analyze <project-path> [--json] [--verbose] [--monorepo] [--db]
pua unused <project-path> [--json] [--verbose] [--monorepo]
pua suggest <project-path> [--json] [--verbose] [--monorepo]
```

- **--json**: print machine-readable JSON.
- **--verbose**: show scan progress markers.
- **--monorepo**: scan npm/yarn/pnpm workspaces.
- **--db**: persist analyze results to SQLite if `sqlite3` is installed.

## Examples

Analyze a single package:

```bash
pua analyze .
```

List only unused dependencies:

```bash
pua unused ./examples/my-app
```

Check for outdated or deprecated packages:

```bash
pua suggest . --json
```

Scan a monorepo with workspaces:

```bash
pua analyze . --monorepo --verbose
```

Persist results to SQLite:

```bash
pua analyze . --db
```

## How it works

- Parses imports and requires with Babel parser.
- Scans JS/TS files, ignoring `node_modules`, `dist`, and `build`.
- Maps import specifiers to npm package names.
- Compares against declared dependencies and devDependencies.
- Suggests upgrades using npm registry metadata.

## Notes

- Requires Node.js 18+. Cross-platform on Windows, macOS, and Linux.
- Network access is required for `suggest`.
- SQLite storage is optional. Install `sqlite3` to enable it.

## License

GPL-3.0-or-later

## Author

Made by ♡ by Aditya (Clyders).