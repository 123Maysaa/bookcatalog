const http = require('node:http');
const { Pool } = require('pg');

const port = Number(process.env.PORT || 8080);
const appName = process.env.APP_NAME || 'Katalog Buku';
const greeting = process.env.GREETING || 'Selamat datang di koleksi pilihan kami.';
const theme = process.env.THEME || 'forest';
const featuredCategory = process.env.FEATURED_CATEGORY || 'Teknologi';
const apiTokenConfigured = Boolean(process.env.CATALOG_API_TOKEN);
const jwtConfigured = Boolean(process.env.JWT_SECRET);
const databaseConfigured = Boolean(
  process.env.DATABASE_HOST && process.env.DATABASE_USERNAME && process.env.DATABASE_PASSWORD
);

const seedBooks = [
  ['Clean Code', 'Robert C. Martin', 'Pemrograman'],
  ['The Pragmatic Programmer', 'Andrew Hunt & David Thomas', 'Teknologi'],
  ['Atomic Habits', 'James Clear', 'Pengembangan Diri']
];

const db = databaseConfigured ? new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME || 'catalog_db',
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  max: 5,
  connectionTimeoutMillis: 3000
}) : null;
let databaseReady = false;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function page(books) {
  const bookCards = books.map(({ title, author, category }) => `
    <article class="card">
      <span>${escapeHtml(category)}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(author)}</p>
    </article>`).join('');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(appName)}</title>
  <style>
    :root { --ink:#19342a; --accent:#247a5c; --paper:#f6f5ef; --muted:#607168; }
    * { box-sizing:border-box } body { margin:0; font-family:system-ui,sans-serif; background:var(--paper); color:var(--ink) }
    main { max-width:960px; padding:40px 24px 64px; margin:auto } .eyebrow { color:var(--accent); font-weight:700; text-transform:uppercase; letter-spacing:.09em; font-size:.76rem }
    h1 { font-size:clamp(2.4rem,7vw,5rem); line-height:1; margin:.4rem 0 1rem } .lead { max-width:620px; font-size:1.15rem; color:var(--muted) }
    .meta { display:flex; gap:12px; flex-wrap:wrap; margin:30px 0 } .pill { padding:8px 12px; border-radius:999px; background:#e4efe9; color:var(--accent); font-size:.9rem }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:16px; margin-top:20px }.card { background:#fff; padding:22px; border-radius:14px; box-shadow:0 6px 20px #19342a12 }.card span { font-size:.78rem; color:var(--accent); font-weight:700 }.card h3 { margin:10px 0 5px }.card p { margin:0; color:var(--muted) }
    footer { margin-top:42px; color:var(--muted); font-size:.88rem }
  </style>
</head>
<body data-theme="${escapeHtml(theme)}"><main>
  <div class="eyebrow">OpenShift demo application</div>
  <h1>${escapeHtml(appName)}</h1>
  <p class="lead">${escapeHtml(greeting)}</p>
  <div class="meta"><span class="pill">Kategori unggulan: ${escapeHtml(featuredCategory)}</span><span class="pill">Secret API: ${apiTokenConfigured ? 'terkonfigurasi' : 'belum diatur'}</span><span class="pill">Credential DB: ${databaseConfigured ? 'terkonfigurasi' : 'belum diatur'}</span><span class="pill">JWT: ${jwtConfigured ? 'terkonfigurasi' : 'belum diatur'}</span></div>
  <section class="grid">${bookCards}</section>
  <footer>Health check: <code>/healthz</code> · Info aplikasi: <code>/api/info</code></footer>
</main></body></html>`;
}

async function initializeDatabase() {
  if (!db) return;
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL
    )`);
    const existing = await db.query('SELECT COUNT(*)::int AS count FROM books');
    if (existing.rows[0].count === 0) {
      for (const [title, author, category] of seedBooks) {
        await db.query('INSERT INTO books (title, author, category) VALUES ($1, $2, $3)', [title, author, category]);
      }
    }
    databaseReady = true;
    console.log('Database connected and initialized');
  } catch (error) {
    databaseReady = false;
    console.error(`Database is not ready: ${error.message}`);
  }
}

async function getBooks() {
  if (databaseReady) {
    try {
      const result = await db.query('SELECT title, author, category FROM books ORDER BY id');
      return result.rows;
    } catch (error) {
      databaseReady = false;
      console.error(`Database query failed: ${error.message}`);
    }
  }
  return seedBooks.map(([title, author, category]) => ({ title, author, category }));
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') return sendJson(res, 200, { status: 'ok' });
  if (req.url === '/api/info') return sendJson(res, 200, { appName, theme, featuredCategory, apiTokenConfigured, databaseConfigured, databaseReady, jwtConfigured });
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(page(await getBooks()));
  }
  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`${appName} listening on ${port}`);
  initializeDatabase();
  setInterval(initializeDatabase, 15000).unref();
});
