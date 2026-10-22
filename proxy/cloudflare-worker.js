// Proxy CORS para hospedar o SeeBaged em sites estáticos (GitHub Pages, Netlify...).
// Publique este arquivo como um Cloudflare Worker e coloque o endereço dele em
// assets/config.js:  proxy: 'https://SEU-WORKER.workers.dev/{sub}'
//   https://SEU-WORKER.workers.dev/<sub>/<caminho>  ->  https://<sub>.roblox.com/<caminho>

const ALLOWED_SUBS = new Set(['badges', 'games', 'thumbnails', 'users', 'apis']);

// Só estes sites podem usar o proxy pelo navegador (evita que outros sites gastem sua cota).
const ALLOWED_ORIGINS = ['https://matheusasturofc-del.github.io'];
const isAllowedOrigin = (origin) =>
  !origin || ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    if (!isAllowedOrigin(origin)) return new Response('Origem não permitida', { status: 403 });
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET' && request.method !== 'POST') return new Response(null, { status: 405, headers: cors });

    const url = new URL(request.url);
    const [, sub, ...rest] = url.pathname.split('/');
    if (!ALLOWED_SUBS.has(sub)) return new Response('SeeBaged proxy ok', { status: sub ? 404 : 200, headers: cors });

    // A chave do Open Cloud só segue para as rotas /cloud/ do apis.roblox.com, sem cache.
    const apiKey = sub === 'apis' && rest[0] === 'cloud' ? request.headers.get('x-api-key') : null;
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey;

    const upstream = await fetch(`https://${sub}.roblox.com/${rest.join('/')}${url.search}`, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
      cf: request.method === 'GET' && !apiKey ? { cacheTtl: 60, cacheEverything: true } : undefined,
    });

    const out = new Headers(cors);
    out.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
