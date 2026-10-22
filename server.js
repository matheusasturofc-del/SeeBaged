#!/usr/bin/env node
// SeeBaged — servidor local sem dependências.
// Serve o site e faz proxy das APIs públicas do Roblox (que bloqueiam CORS no navegador).
//   /rbx/<sub>/<caminho>  ->  https://<sub>.roblox.com/<caminho>

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const ALLOWED_SUBS = new Set(['badges', 'games', 'thumbnails', 'users', 'apis']);
const CACHE_TTL = 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...CORS, ...headers });
  res.end(body);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('corpo muito grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxy(req, res, url) {
  const [, , sub, ...rest] = url.pathname.split('/');
  if (!ALLOWED_SUBS.has(sub)) return send(res, 404, JSON.stringify({ error: 'subdomínio não permitido' }), { 'Content-Type': 'application/json' });
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, '');

  const target = `https://${sub}.roblox.com/${rest.join('/')}${url.search}`;
  const key = req.method === 'GET' ? target : null;
  const hit = key && cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return send(res, hit.status, hit.body, { 'Content-Type': hit.type, 'X-Cache': 'HIT' });
  }

  try {
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'SeeBaged/1.0 (+https://github.com/matheusasturofc-del/SeeBaged)',
      },
      body,
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    const type = upstream.headers.get('content-type') || 'application/json';
    if (key && upstream.ok) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(key, { at: Date.now(), status: upstream.status, body: buf, type });
    }
    send(res, upstream.status, buf, { 'Content-Type': type });
  } catch (err) {
    send(res, 502, JSON.stringify({ error: 'falha ao contatar o Roblox', detail: String(err.message || err) }), { 'Content-Type': 'application/json' });
  }
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || rel.split('/').some((p) => p.startsWith('.'))) {
    return send(res, 403, 'Proibido');
  }
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Não encontrado');
    send(res, 200, data, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/rbx/ping') return send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json' });
  if (url.pathname.startsWith('/rbx/')) return proxy(req, res, url);
  serveStatic(req, res, url);
}).listen(PORT, () => {
  console.log(`SeeBaged rodando em http://localhost:${PORT}`);
});
