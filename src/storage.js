import path from 'path'
let sqlite3 = null
try {
  const mod = await import('sqlite3')
  sqlite3 = mod.default || mod
} catch {}

function getDb(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, err => {
      if (err) reject(err)
      else resolve(db)
    })
  })
}

async function init(db) {
  const sql1 = `create table if not exists scans (
    id integer primary key autoincrement,
    project_path text not null,
    scanned_at integer not null
  )`
  const sql2 = `create table if not exists scan_items (
    id integer primary key autoincrement,
    scan_id integer not null,
    name text not null,
    status text not null,
    foreign key(scan_id) references scans(id)
  )`
  await run(db, sql1)
  await run(db, sql2)
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

async function persistScan({ projectPath, result, dbFile }) {
  if (!sqlite3) return
  const dbPath = dbFile || path.join(process.cwd(), 'pua.sqlite')
  const db = await getDb(dbPath)
  await init(db)
  const now = Date.now()
  const res = await run(db, 'insert into scans(project_path, scanned_at) values (?, ?)', [projectPath, now])
  const scanId = res.lastID
  const items = []
  for (const name of result.used) items.push([scanId, name, 'used'])
  for (const name of result.unused) items.push([scanId, name, 'unused'])
  for (const name of result.devUnused || []) items.push([scanId, name, 'dev-unused'])
  const stmt = 'insert into scan_items(scan_id, name, status) values (?, ?, ?)'
  for (const row of items) await run(db, stmt, row)
  db.close()
}

async function trend({ projectPath, dbFile }) {
  if (!sqlite3) return []
  const dbPath = dbFile || path.join(process.cwd(), 'pua.sqlite')
  const db = await getDb(dbPath)
  await init(db)
  const rows = await all(db, 'select scanned_at, status, count(*) as cnt from scan_items si join scans s on s.id = si.scan_id where s.project_path = ? group by scanned_at, status order by scanned_at asc', [projectPath])
  db.close()
  return rows
}

export { persistScan, trend }