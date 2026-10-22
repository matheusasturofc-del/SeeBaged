// Proxy CORS para hospedar o SeeBaged em sites estáticos (GitHub Pages, Netlify...).
// Publique este arquivo como um Cloudflare Worker e, nas configurações do site,
// use o modelo:  https://SEU-WORKER.workers.dev/{sub}
//   https://SEU-WORKER.workers.dev/<sub>/<caminho>  ->  https://<sub>.roblox.com/<caminho>

const ALLOWED_SUBS = new Set(['badges', 'games', 'thumbnails', 'users', 'apis']);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET' && request.method !== 'POST') return new Response(null, { status: 405, headers: CORS });

    const url = new URL(request.url);
    const [, sub, ...rest] = url.pathname.split('/');
    if (!ALLOWED_SUBS.has(sub)) return new Response('Não encontrado', { status: 404, headers: CORS });

    const upstream = await fetch(`https://${sub}.roblox.com/${rest.join('/')}${url.search}`, {
      method: request.method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: request.method === 'POST' ? await request.text() : undefined,
      cf: request.method === 'GET' ? { cacheTtl: 60, cacheEverything: true } : undefined,
    });

    const headers = new Headers(CORS);
    headers.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
