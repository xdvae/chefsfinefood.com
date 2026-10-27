/*
 * The Chef's Fine Food Caterers — enquiry backend + dashboard
 * ------------------------------------------------------------
 * Plain Node.js (no framework). One dependency: pg (PostgreSQL).
 *
 * Environment variables (set these on Render → Environment):
 *   DATABASE_URL     PostgreSQL connection string (e.g. from neon.tech)          [required]
 *   ADMIN_PASSWORD   password for the dashboard at /admin                          [required]
 *   SESSION_SECRET   any long random text, keeps you logged in securely            [recommended]
 *   ALLOWED_ORIGINS  sites allowed to send enquiries, comma separated
 *                    default: https://chefsfinefood.com,https://www.chefsfinefood.com
 *   PGSSL            set to "disable" only for a database without SSL (rare)
 *   PORT             set automatically by Render
 */
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('cff:' + ADMIN_PASSWORD + ':' + (DATABASE_URL || '')).digest('hex');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://chefsfinefood.com,https://www.chefsfinefood.com')
  .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
const SESSION_DAYS = 30;

if (!DATABASE_URL) { console.error('Missing DATABASE_URL environment variable.'); process.exit(1); }
if (!ADMIN_PASSWORD) console.warn('WARNING: ADMIN_PASSWORD is not set — the dashboard login is disabled until you set it.');

/* ---------------- Database ---------------- */
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: (process.env.PGSSL === 'disable' || isLocalDb) ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});
pool.on('error', e => console.error('DB pool error:', e.message));

const STATUSES = ['new', 'contacted', 'booked', 'closed'];

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id          SERIAL PRIMARY KEY,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      name        TEXT NOT NULL,
      phone       TEXT NOT NULL,
      email       TEXT NOT NULL DEFAULT '',
      event_type  TEXT NOT NULL DEFAULT '',
      event_date  DATE,
      guests      TEXT NOT NULL DEFAULT '',
      venue       TEXT NOT NULL DEFAULT '',
      services    TEXT NOT NULL DEFAULT '',
      message     TEXT NOT NULL DEFAULT '',
      brand       TEXT NOT NULL DEFAULT 'The Chef''s',
      source_page TEXT NOT NULL DEFAULT '',
      channel     TEXT NOT NULL DEFAULT 'form',
      status      TEXT NOT NULL DEFAULT 'new',
      notes       TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS enquiries_created_idx ON enquiries (created_at DESC);
    CREATE INDEX IF NOT EXISTS enquiries_status_idx ON enquiries (status);
  `);
}

/* ---------------- Helpers ---------------- */
const clip = (v, n) => String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, n);

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  const data = isObj ? JSON.stringify(body) : body;
  res.writeHead(code, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Robots-Tag': 'noindex, nofollow',
    ...headers,
  });
  res.end(data);
}

function readBody(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const ct = (req.headers['content-type'] || '').toLowerCase();
      try {
        if (!raw) return resolve({});
        if (ct.includes('application/json') || ct.includes('text/plain')) return resolve(JSON.parse(raw));
        if (ct.includes('application/x-www-form-urlencoded')) return resolve(Object.fromEntries(new URLSearchParams(raw)));
        return resolve(JSON.parse(raw));
      } catch (e) { reject(Object.assign(new Error('bad body'), { code: 400 })); }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

// simple in-memory rate limiter: max hits per window per key
const buckets = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, reset: now + windowMs };
  if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
  b.n++; buckets.set(key, b);
  return b.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k); }, 10 * 60 * 1000).unref();

function cors(req, res) {
  const origin = (req.headers.origin || '').replace(/\/$/, '');
  if (origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    return true;
  }
  return false;
}

/* ---------------- Sessions (signed cookie) ---------------- */
const sign = v => crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url');
function makeToken() {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const v = `${exp}.${crypto.randomBytes(9).toString('base64url')}`;
  return `${v}.${sign(v)}`;
}
function validToken(t) {
  if (!t) return false;
  const i = t.lastIndexOf('.'); if (i < 0) return false;
  const v = t.slice(0, i), s = t.slice(i + 1), good = sign(v);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return false;
  return Number(v.split('.')[0]) > Date.now();
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
const isHttps = req => (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
function setSession(req, res, token, maxAge) {
  res.setHeader('Set-Cookie', `cff_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`);
}
const authed = req => validToken(cookies(req).cff_admin);
function passwordOk(p) {
  if (!ADMIN_PASSWORD) return false;
  const a = crypto.createHash('sha256').update(String(p || '')).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}
// admin write requests must come from this same site
function sameOrigin(req) {
  const o = req.headers.origin; if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

/* ---------------- Enquiry intake ---------------- */
function cleanEnquiry(b) {
  const services = Array.isArray(b.services) ? b.services.join(', ') : b.services;
  let date = clip(b.date || b.event_date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = null;
  return {
    name: clip(b.name, 120),
    phone: clip(b.phone, 30),
    email: clip(b.email, 160),
    event_type: clip(b.event || b.event_type, 80),
    event_date: date,
    guests: clip(b.guests, 40),
    venue: clip(b.venue, 200),
    services: clip(services, 300),
    message: clip(b.message, 3000),
    brand: /shyam/i.test(String(b.brand || b.page || '')) ? 'Shree Shyam' : "The Chef's",
    source_page: clip(b.page, 200),
    channel: b.channel === 'whatsapp' ? 'whatsapp' : 'form',
  };
}

async function createEnquiry(req, res) {
  const ip = clientIp(req);
  if (limited('enq:' + ip, 8, 10 * 60 * 1000)) return send(res, 429, { ok: false, error: 'Too many enquiries — please call us instead.' });
  let b;
  try { b = await readBody(req); } catch (e) { return send(res, e.code || 400, { ok: false, error: 'Invalid request' }); }
  if (b.website) return send(res, 200, { ok: true }); // honeypot: pretend success for bots
  const e = cleanEnquiry(b);
  if (e.name.length < 2) return send(res, 422, { ok: false, error: 'Please enter your name' });
  if (e.phone.replace(/\D/g, '').length < 10) return send(res, 422, { ok: false, error: 'Please enter a valid phone number' });
  try {
    const r = await pool.query(
      `INSERT INTO enquiries (name, phone, email, event_type, event_date, guests, venue, services, message, brand, source_page, channel)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [e.name, e.phone, e.email, e.event_type, e.event_date, e.guests, e.venue, e.services, e.message, e.brand, e.source_page, e.channel]);
    console.log(`New enquiry #${r.rows[0].id} from ${e.name} (${e.event_type || 'event'})`);
    send(res, 201, { ok: true, id: r.rows[0].id });
  } catch (err) {
    console.error('Insert failed:', err.message);
    send(res, 500, { ok: false, error: 'Could not save right now' });
  }
}

/* ---------------- Admin API ---------------- */
async function listEnquiries(req, res, url) {
  const status = url.searchParams.get('status');
  const q = clip(url.searchParams.get('q'), 100);
  const where = []; const args = [];
  if (status && STATUSES.includes(status)) { args.push(status); where.push(`status = $${args.length}`); }
  if (q) {
    args.push('%' + q.replace(/[%_\\]/g, m => '\\' + m) + '%');
    const p = `$${args.length}`;
    where.push(`(name ILIKE ${p} OR phone ILIKE ${p} OR email ILIKE ${p} OR venue ILIKE ${p} OR event_type ILIKE ${p} OR message ILIKE ${p} OR notes ILIKE ${p})`);
  }
  const sql = `SELECT id, created_at, updated_at, name, phone, email, event_type, to_char(event_date,'YYYY-MM-DD') AS event_date,
                      guests, venue, services, message, brand, source_page, channel, status, notes
               FROM enquiries ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY created_at DESC LIMIT 500`;
  const [rows, stats] = await Promise.all([
    pool.query(sql, args),
    pool.query(`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status='new')::int AS new,
        count(*) FILTER (WHERE status='contacted')::int AS contacted,
        count(*) FILTER (WHERE status='booked')::int AS booked,
        count(*) FILTER (WHERE status='closed')::int AS closed,
        count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')::int AS today,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week,
        count(*) FILTER (WHERE event_date BETWEEN (now() AT TIME ZONE 'Asia/Kolkata')::date AND (now() AT TIME ZONE 'Asia/Kolkata')::date + 30 AND status <> 'closed')::int AS upcoming
      FROM enquiries`),
  ]);
  send(res, 200, { ok: true, enquiries: rows.rows, stats: stats.rows[0] });
}

async function updateEnquiry(req, res, id) {
  let b;
  try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false }); }
  const sets = []; const args = [];
  if (b.status !== undefined) { if (!STATUSES.includes(b.status)) return send(res, 422, { ok: false, error: 'Bad status' }); args.push(b.status); sets.push(`status=$${args.length}`); }
  if (b.notes !== undefined) { args.push(clip(b.notes, 5000)); sets.push(`notes=$${args.length}`); }
  if (!sets.length) return send(res, 400, { ok: false });
  args.push(id);
  const r = await pool.query(`UPDATE enquiries SET ${sets.join(', ')}, updated_at=now() WHERE id=$${args.length} RETURNING id, status, notes, updated_at`, args);
  if (!r.rowCount) return send(res, 404, { ok: false });
  send(res, 200, { ok: true, enquiry: r.rows[0] });
}

async function deleteEnquiry(req, res, id) {
  const r = await pool.query('DELETE FROM enquiries WHERE id=$1', [id]);
  send(res, r.rowCount ? 200 : 404, { ok: !!r.rowCount });
}

async function exportCsv(req, res) {
  const r = await pool.query(`SELECT id, to_char(created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD HH24:MI') AS received, status, brand, name, phone, email,
      event_type, to_char(event_date,'YYYY-MM-DD') AS event_date, guests, venue, services, message, notes, source_page, channel
      FROM enquiries ORDER BY created_at DESC`);
  const cols = ['id', 'received', 'status', 'brand', 'name', 'phone', 'email', 'event_type', 'event_date', 'guests', 'venue', 'services', 'message', 'notes', 'source_page', 'channel'];
  const esc = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = '﻿' + [cols.join(','), ...r.rows.map(row => cols.map(c => esc(row[c])).join(','))].join('\r\n');
  const day = new Date().toISOString().slice(0, 10);
  send(res, 200, csv, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="enquiries-${day}.csv"`, 'Cache-Control': 'no-store' });
}

/* ---------------- Static admin files ---------------- */
const ADMIN_DIR = path.join(__dirname, 'admin');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function serveAdminFile(res, rel) {
  const fp = path.normalize(path.join(ADMIN_DIR, rel));
  if (!fp.startsWith(ADMIN_DIR)) return send(res, 404, 'Not found');
  fs.readFile(fp, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, data, {
      'Content-Type': TYPES[path.extname(fp)] || 'application/octet-stream',
      'Cache-Control': rel.endsWith('.html') ? 'no-store' : 'public, max-age=3600',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
  });
}

/* ---------------- Router ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '') || '/';
  try {
    // public
    if (p === '/api/health') { cors(req, res); return send(res, 200, { ok: true }); }
    if (p === '/api/enquiries') {
      const allowed = cors(req, res);
      if (req.method === 'OPTIONS') return send(res, allowed ? 204 : 403, '');
      if (req.method !== 'POST') return send(res, 405, { ok: false });
      if (req.headers.origin && !allowed) return send(res, 403, { ok: false, error: 'Origin not allowed' });
      return await createEnquiry(req, res);
    }
    if (p === '/' ) { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
    if (p === '/admin') { if (!req.url.endsWith('/')) { res.writeHead(301, { Location: '/admin/' }); return res.end(); } return serveAdminFile(res, 'index.html'); }
    if (p.startsWith('/admin/') && req.method === 'GET') return serveAdminFile(res, p.slice(7) || 'index.html');

    // admin auth
    if (p === '/api/admin/login' && req.method === 'POST') {
      if (!sameOrigin(req)) return send(res, 403, { ok: false });
      if (limited('login:' + clientIp(req), 10, 15 * 60 * 1000)) return send(res, 429, { ok: false, error: 'Too many attempts. Try again in 15 minutes.' });
      let b; try { b = await readBody(req, 4096); } catch (e) { return send(res, 400, { ok: false }); }
      if (!ADMIN_PASSWORD) return send(res, 503, { ok: false, error: 'ADMIN_PASSWORD is not set on the server.' });
      if (!passwordOk(b.password)) return send(res, 401, { ok: false, error: 'Wrong password' });
      setSession(req, res, makeToken(), SESSION_DAYS * 86400);
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/logout' && req.method === 'POST') { setSession(req, res, '', 0); return send(res, 200, { ok: true }); }
    if (p.startsWith('/api/admin/')) {
      if (!authed(req)) return send(res, 401, { ok: false, error: 'Please log in' });
      if (req.method !== 'GET' && !sameOrigin(req)) return send(res, 403, { ok: false });
      res.setHeader('Cache-Control', 'no-store');
      if (p === '/api/admin/me') return send(res, 200, { ok: true });
      if (p === '/api/admin/enquiries' && req.method === 'GET') return await listEnquiries(req, res, url);
      if (p === '/api/admin/export.csv' && req.method === 'GET') return await exportCsv(req, res);
      const m = p.match(/^\/api\/admin\/enquiries\/(\d+)$/);
      if (m && req.method === 'PATCH') return await updateEnquiry(req, res, Number(m[1]));
      if (m && req.method === 'DELETE') return await deleteEnquiry(req, res, Number(m[1]));
    }
    send(res, 404, { ok: false, error: 'Not found' });
  } catch (err) {
    console.error(req.method, req.url, err);
    if (!res.headersSent) send(res, 500, { ok: false, error: 'Server error' });
  }
});

migrate()
  .then(() => server.listen(PORT, () => console.log(`Enquiry server running on port ${PORT} — dashboard at /admin/`)))
  .catch(err => { console.error('Database setup failed:', err.message); process.exit(1); });
