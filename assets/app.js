'use strict';

/* =========================================================
   SeeBaged — encontre e acompanhe conquistas do Roblox
   ========================================================= */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nf = new Intl.NumberFormat('pt-BR');
const nfc = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const df = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });

const STORE_KEY = 'seebaged:v1';
const PLACEHOLDER = 'assets/icon.svg';

const POPULAR = [
  { placeId: 920587237, name: 'Adopt Me!' },
  { placeId: 4924922222, name: 'Brookhaven RP' },
  { placeId: 2753915549, name: 'Blox Fruits' },
  { placeId: 6516141723, name: 'DOORS' },
  { placeId: 1962086868, name: 'Tower of Hell' },
  { placeId: 142823291, name: 'Murder Mystery 2' },
  { placeId: 606849621, name: 'Jailbreak' },
  { placeId: 8737899170, name: 'Pet Simulator 99' },
  { placeId: 189707, name: 'Natural Disaster Survival' },
  { placeId: 286090429, name: 'Arsenal' },
];

// Dificuldade no estilo do Roblox, a partir da taxa de obtenção.
const TIERS = [
  { max: 0.001, key: 'impossivel', label: 'Impossível' },
  { max: 0.01, key: 'insana', label: 'Insana' },
  { max: 0.05, key: 'extrema', label: 'Extrema' },
  { max: 0.1, key: 'dificil', label: 'Difícil' },
  { max: 0.2, key: 'desafiadora', label: 'Desafiadora' },
  { max: 0.5, key: 'moderada', label: 'Moderada' },
  { max: 0.8, key: 'facil', label: 'Fácil' },
  { max: 0.9, key: 'moleza', label: 'Moleza' },
  { max: Infinity, key: 'gratis', label: 'De graça' },
];

/* ---------- Armazenamento local ---------- */

const store = loadStore();

function loadStore() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && typeof d === 'object') {
      return { owned: d.owned || {}, games: d.games || {}, settings: d.settings || {} };
    }
  } catch { /* armazenamento indisponível */ }
  return { owned: {}, games: {}, settings: {} };
}

let saveTimer = null;
function saveStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      toast('Não foi possível salvar no navegador (modo privado?).', 'error');
    }
  }, 150);
}

const isOwned = (id) => Object.prototype.hasOwnProperty.call(store.owned, id);

function setOwned(id, universeId, value, at) {
  if (value) store.owned[id] = { u: universeId, t: at || Date.now() };
  else delete store.owned[id];
  saveStore();
}

/* ---------- Acesso à API ---------- */

class ApiError extends Error {
  constructor(message, status, detail) { super(message); this.status = status; this.detail = detail; }
}

const api = {
  base: null,
  mode: 'auto',

  async init() {
    const custom = (store.settings.proxy || '').trim();
    if (custom) { this.base = custom; this.mode = 'custom'; return; }
    if (location.protocol.startsWith('http')) {
      try {
        const r = await fetch('rbx/ping', { cache: 'no-store' });
        if (r.ok && (await r.json()).ok) { this.base = 'rbx/{sub}'; this.mode = 'local'; return; }
      } catch { /* sem servidor local */ }
    }
    this.base = 'https://{sub}.roproxy.com';
    this.mode = 'roproxy';
  },

  url(sub, path) {
    const base = this.base.includes('{sub}') ? this.base.replace('{sub}', sub) : `${this.base.replace(/\/$/, '')}/${sub}`;
    return base.replace(/\/$/, '') + path;
  },

  async request(sub, path, { method = 'GET', body } = {}) {
    const url = this.url(sub, path);
    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await fetch(url, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch {
        setConn('erro');
        throw new ApiError('Não consegui falar com a API do Roblox. Confira o proxy nas configurações.', 0);
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await sleep(800 * 2 ** attempt);
        continue;
      }
      if (!res.ok) {
        if (res.status === 429) throw new ApiError('O Roblox limitou as requisições. Espere alguns segundos e tente de novo.', 429);
        // O Roblox costuma explicar o erro em { errors: [{ code, message }] }
        const info = await res.json().catch(() => null);
        const detail = info?.errors?.[0]?.message || '';
        throw new ApiError(`A API do Roblox respondeu com erro ${res.status}${detail ? `: ${detail}` : '.'}`, res.status, detail);
      }
      setConn('ok');
      return res.json();
    }
  },
};

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const roblox = {
  async search(query) {
    const d = await api.request('apis', `/search-api/omni-search?searchQuery=${encodeURIComponent(query)}&sessionId=${uuid()}&pageType=all`);
    const seen = new Set();
    const out = [];
    for (const group of d.searchResults || []) {
      if (group.contentGroupType && group.contentGroupType !== 'Game') continue;
      for (const c of group.contents || []) {
        if (!c.universeId || seen.has(c.universeId)) continue;
        seen.add(c.universeId);
        out.push({
          id: c.universeId,
          name: c.name,
          rootPlaceId: c.rootPlaceId,
          playing: c.playerCount,
          up: c.totalUpVotes,
          down: c.totalDownVotes,
        });
      }
    }
    return out;
  },

  async universeFromPlace(placeId) {
    const d = await api.request('apis', `/universes/v1/places/${placeId}/universe`);
    if (!d || !d.universeId) throw new ApiError('Jogo não encontrado.', 404);
    return d.universeId;
  },

  async games(ids) {
    const out = [];
    for (const part of chunk(ids, 50)) {
      const d = await api.request('games', `/v1/games?universeIds=${part.join(',')}`);
      out.push(...(d.data || []));
    }
    return out;
  },

  async thumbs(kind, ids) {
    const map = {};
    const param = kind === 'badges' ? 'badgeIds' : 'universeIds';
    const path = kind === 'badges' ? '/v1/badges/icons' : '/v1/games/icons';
    for (const part of chunk(ids, 100)) {
      try {
        const d = await api.request('thumbnails', `${path}?${param}=${part.join(',')}&size=150x150&format=Png&isCircular=false&returnPolicy=PlaceHolder`);
        for (const t of d.data || []) if (t.imageUrl) map[t.targetId] = t.imageUrl;
      } catch { /* ícones são opcionais */ }
    }
    return map;
  },

  badgesPage(universeId, cursor) {
    const c = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    return api.request('badges', `/v1/universes/${universeId}/badges?limit=100&sortOrder=Asc${c}`);
  },

  async user(username) {
    const d = await api.request('users', '/v1/usernames/users', {
      method: 'POST',
      body: { usernames: [username], excludeBannedUsers: false },
    });
    return (d.data || [])[0] || null;
  },

  async avatar(userId) {
    try {
      const d = await api.request('thumbnails', `/v1/users/avatar-headshot?userIds=${userId}&size=48x48&format=Png&isCircular=true`);
      return (d.data || [])[0]?.imageUrl || null;
    } catch { return null; }
  },

  async canViewInventory(userId) {
    try {
      const d = await api.request('inventory', `/v1/users/${userId}/can-view-inventory`);
      return d.canView !== false;
    } catch { return null; }
  },

  async awarded(userId, badgeIds) {
    const out = [];
    for (const part of chunk(badgeIds, 100)) {
      const d = await api.request('badges', `/v1/users/${userId}/badges/awarded-dates?badgeIds=${part.join(',')}`);
      out.push(...(d.data || []));
    }
    return out;
  },
};

/* ---------- Utilidades de UI ---------- */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $('#toasts').append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 3800);
}

function setConn(state) {
  const el = $('#connStatus');
  const labels = { local: 'servidor local', roproxy: 'via RoProxy', custom: 'proxy personalizado' };
  el.dataset.state = state;
  $('b', el).textContent = state === 'erro' ? 'sem conexão com o Roblox' : `API ${labels[api.mode] || ''}`;
}

const modal = {
  open(title, html, onMount) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modal').hidden = false;
    document.body.classList.add('no-scroll');
    onMount?.($('#modalBody'));
    setTimeout(() => $('#modalBody input, #modalBody button')?.focus(), 30);
  },
  close() {
    $('#modal').hidden = true;
    document.body.classList.remove('no-scroll');
  },
};

function tierOf(rate) {
  return TIERS.find((t) => rate < t.max) || TIERS[TIERS.length - 1];
}

function ring(pct, size = 92) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
  </svg>`;
}

function confetti() {
  const colors = ['#8b5cf6', '#22d3ee', '#34d399', '#fbbf24', '#f472b6'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    p.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 240}px`);
    p.style.setProperty('--r', `${Math.random() * 720}deg`);
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3500);
}

function gameStats(g) {
  const ids = g.ids || [];
  const have = ids.filter(isOwned).length;
  return { have, total: ids.length, pct: ids.length ? have / ids.length : 0 };
}

function updateNavCount() {
  $('#navCount').textContent = nfc.format(Object.keys(store.owned).length);
}

function parseGameInput(q) {
  const link = q.match(/roblox\.com\/(?:[a-z-]+\/)?games\/(\d+)/i);
  if (link) return { placeId: Number(link[1]) };
  if (/^\d{3,}$/.test(q)) return { placeId: Number(q) };
  return null;
}

async function openPlace(placeId) {
  try {
    const uid = await roblox.universeFromPlace(placeId);
    location.hash = `#/jogo/${uid}`;
  } catch (e) {
    // Talvez seja um ID de universo
    try {
      const [g] = await roblox.games([placeId]);
      if (g) { location.hash = `#/jogo/${g.id}`; return; }
    } catch { /* ignora */ }
    toast(e.status === 404 ? 'Não achei esse jogo. Confira o link ou ID.' : e.message, 'error');
  }
}

/* ---------- Roteamento ---------- */

let routeToken = 0;

function route() {
  const token = ++routeToken;
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, arg] = hash.split('/');
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === (page === 'colecao' ? 'colecao' : 'home')));
  window.scrollTo({ top: 0 });
  if (page === 'jogo' && /^\d+$/.test(arg || '')) return renderGame(Number(arg), token);
  if (page === 'colecao') return renderCollection();
  if (page === 'buscar' && arg) return renderHome(decodeURIComponent(arg), token);
  return renderHome('', token);
}

/* ---------- Página inicial / busca ---------- */

function gameCard(g, icon) {
  const votes = (g.up || 0) + (g.down || 0);
  const like = votes ? Math.round((g.up / votes) * 100) : null;
  const saved = store.games[g.id];
  const st = saved ? gameStats(saved) : null;
  return `<a class="game-card" href="#/jogo/${g.id}" data-uid="${g.id}">
    <div class="game-thumb"><img src="${esc(icon || saved?.icon || PLACEHOLDER)}" alt="" loading="lazy"></div>
    <div class="game-info">
      <h3>${esc(g.name)}</h3>
      <div class="game-meta">
        ${g.playing != null ? `<span title="Jogando agora"><i class="dot live"></i>${nfc.format(g.playing)}</span>` : ''}
        ${like != null ? `<span title="Aprovação">👍 ${like}%</span>` : ''}
        ${st && st.total ? `<span class="pill-mini">${st.have}/${st.total}</span>` : ''}
      </div>
    </div>
  </a>`;
}

async function renderHome(query, token) {
  const app = $('#app');
  const recent = Object.values(store.games).sort((a, b) => (b.visited || 0) - (a.visited || 0)).slice(0, 6);
  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow">✦ Rastreador de conquistas do Roblox</p>
      <h1>Encontre cada <span class="grad">badge</span>.<br>Marque cada vitória.</h1>
      <p class="lead">Busque qualquer jogo, veja todas as conquistas com raridade e marque as que você já tem — ou sincronize direto com seu perfil do Roblox.</p>
      <form class="search" id="searchForm" autocomplete="off">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="searchInput" type="search" placeholder="Nome do jogo, link ou ID do place…" value="${esc(query)}" aria-label="Buscar jogo">
        <button class="btn btn-primary" type="submit">Buscar</button>
      </form>
      <div class="chips" id="popular">
        <span class="chips-label">Populares:</span>
        ${POPULAR.map((p) => `<button class="chip" type="button" data-place="${p.placeId}">${esc(p.name)}</button>`).join('')}
      </div>
    </section>
    <section id="results"></section>
    ${recent.length && !query ? `
      <section class="section">
        <div class="section-head"><h2>Continuar de onde parou</h2><a href="#/colecao" class="link">Ver coleção →</a></div>
        <div class="game-grid">${recent.map((g) => gameCard(g, g.icon)).join('')}</div>
      </section>` : ''}
  `;

  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    if (!q) return;
    const parsed = parseGameInput(q);
    if (parsed) return openPlace(parsed.placeId);
    location.hash = `#/buscar/${encodeURIComponent(q)}`;
  });
  $('#popular').addEventListener('click', (e) => {
    const b = e.target.closest('[data-place]');
    if (!b) return;
    b.classList.add('loading');
    openPlace(Number(b.dataset.place)).finally(() => b.classList.remove('loading'));
  });

  if (!query) { $('#searchInput').focus({ preventScroll: true }); return; }

  const results = $('#results');
  results.innerHTML = `<div class="section"><div class="section-head"><h2>Resultados para “${esc(query)}”</h2></div>
    <div class="game-grid">${'<div class="game-card skeleton"></div>'.repeat(8)}</div></div>`;
  try {
    const games = await roblox.search(query);
    if (token !== routeToken) return;
    if (!games.length) {
      results.innerHTML = `<div class="empty"><div class="empty-ico">🔍</div><h3>Nenhum jogo encontrado</h3><p>Tente outro nome ou cole o link do jogo.</p></div>`;
      return;
    }
    const grid = $('.game-grid', results);
    grid.innerHTML = games.map((g) => gameCard(g)).join('');
    const icons = await roblox.thumbs('games', games.map((g) => g.id));
    if (token !== routeToken) return;
    for (const [id, url] of Object.entries(icons)) {
      const img = $(`[data-uid="${id}"] img`, grid);
      if (img) img.src = url;
    }
  } catch (e) {
    if (token !== routeToken) return;
    results.innerHTML = errorBox(e);
  }
}

function errorBox(e) {
  return `<div class="empty error"><div class="empty-ico">⚠️</div><h3>Algo deu errado</h3><p>${esc(e.message)}</p>
    <button class="btn" type="button" onclick="route()">Tentar de novo</button>
    <button class="btn btn-ghost" type="button" onclick="openSettings()">Configurar proxy</button></div>`;
}

/* ---------- Página do jogo ---------- */

const view = {
  uid: null,
  game: null,
  badges: [],
  icons: {},
  scale: 1,
  filter: 'todas',
  sort: 'padrao',
  q: '',
  showDisabled: false,
  loading: false,
};

function visibleBadges() {
  let list = view.badges.filter((b) => view.showDisabled || b.enabled !== false);
  if (view.filter === 'tenho') list = list.filter((b) => isOwned(b.id));
  if (view.filter === 'faltam') list = list.filter((b) => !isOwned(b.id));
  if (view.q) {
    const q = view.q.toLowerCase();
    list = list.filter((b) => `${b.displayName || b.name} ${b.displayDescription || b.description || ''}`.toLowerCase().includes(q));
  }
  const rate = (b) => (b.statistics?.winRatePercentage || 0) / view.scale;
  // Conquistas sem ninguém que as obteve ainda não têm taxa real: vão para o fim.
  const rarity = (b) => (b.statistics?.awardedCount ? rate(b) : Infinity);
  const sorters = {
    padrao: null,
    raras: (a, b) => rarity(a) - rarity(b),
    comuns: (a, b) => rate(b) - rate(a),
    nome: (a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name, 'pt-BR'),
    novas: (a, b) => new Date(b.created) - new Date(a.created),
    obtidas: (a, b) => (b.statistics?.awardedCount || 0) - (a.statistics?.awardedCount || 0),
  };
  if (sorters[view.sort]) list = [...list].sort(sorters[view.sort]);
  return list;
}

function trackedBadges() {
  return view.badges.filter((b) => b.enabled !== false);
}

function badgeCard(b, i) {
  const owned = isOwned(b.id);
  const s = b.statistics || {};
  const rate = (s.winRatePercentage || 0) / view.scale;
  const fresh = !s.awardedCount;
  const tier = fresh ? { key: 'nova', label: 'Nova' } : tierOf(rate);
  const pct = rate * 100;
  const pctText = fresh ? '—' : pct < 0.1 ? '<0,1%' : `${pct.toLocaleString('pt-BR', { maximumFractionDigits: pct < 10 ? 1 : 0 })}%`;
  const name = b.displayName || b.name;
  const desc = b.displayDescription || b.description || 'Sem descrição.';
  const ownedAt = owned && store.owned[b.id].t ? df.format(store.owned[b.id].t) : '';
  return `<article class="badge-card ${owned ? 'owned' : ''} ${b.enabled === false ? 'disabled' : ''}" data-id="${b.id}" style="--i:${Math.min(i, 30)}">
    <button class="badge-toggle" type="button" aria-pressed="${owned}" aria-label="${owned ? 'Desmarcar' : 'Marcar'} ${esc(name)}">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg>
    </button>
    <div class="badge-icon tier-${tier.key}">
      <img src="${esc(view.icons[b.id] || PLACEHOLDER)}" alt="" loading="lazy" data-icon="${b.id}">
    </div>
    <h3 title="${esc(name)}">${esc(name)}</h3>
    <p class="badge-desc" title="${esc(desc)}">${esc(desc)}</p>
    <div class="badge-foot">
      <span class="tier tier-${tier.key}">${tier.label}</span>
      <span class="rate" title="Taxa de obtenção">${pctText}</span>
    </div>
    <div class="badge-sub">
      <span title="Jogadores que obtiveram">🏅 ${nfc.format(s.awardedCount || 0)}</span>
      ${b.enabled === false ? '<span class="off">Desativada</span>' : ownedAt ? `<span class="got">✓ ${ownedAt}</span>` : `<a href="https://www.roblox.com/badges/${b.id}" target="_blank" rel="noopener" class="ext">ver no Roblox ↗</a>`}
    </div>
  </article>`;
}

function renderBadgeGrid() {
  const grid = $('#badgeGrid');
  if (!grid) return;
  const list = visibleBadges();
  if (!list.length && !view.loading) {
    const msg = view.filter === 'tenho' ? ['🎯', 'Nenhuma marcada ainda', 'Toque em uma conquista para marcá-la como obtida.']
      : view.filter === 'faltam' && view.badges.length ? ['🏆', 'Você tem todas!', 'Coleção completa neste jogo. Lendário.']
      : view.q ? ['🔍', 'Nada encontrado', 'Nenhuma conquista combina com essa busca.']
      : ['🫥', 'Este jogo não tem conquistas', 'O criador ainda não publicou nenhuma badge.'];
    grid.innerHTML = `<div class="empty"><div class="empty-ico">${msg[0]}</div><h3>${msg[1]}</h3><p>${msg[2]}</p></div>`;
    return;
  }
  grid.innerHTML = list.map(badgeCard).join('') + (view.loading ? '<div class="badge-card skeleton"></div>'.repeat(4) : '');
}

function renderProgress() {
  const tracked = trackedBadges();
  const have = tracked.filter((b) => isOwned(b.id)).length;
  const pct = tracked.length ? have / tracked.length : 0;
  const box = $('#progressBox');
  if (!box) return;
  box.innerHTML = `${ring(pct)}<div class="ring-label"><b>${Math.round(pct * 100)}%</b><small>${have}/${tracked.length}</small></div>`;
  $('#cntTodas').textContent = view.badges.filter((b) => view.showDisabled || b.enabled !== false).length;
  $('#cntTenho').textContent = have;
  $('#cntFaltam').textContent = tracked.length - have;
}

function persistGame() {
  if (!view.game) return;
  store.games[view.uid] = {
    id: view.uid,
    name: view.game.name,
    rootPlaceId: view.game.rootPlaceId,
    creator: view.game.creator?.name,
    icon: view.gameIcon || store.games[view.uid]?.icon,
    ids: trackedBadges().map((b) => b.id),
    visited: Date.now(),
  };
  saveStore();
}

async function renderGame(uid, token) {
  Object.assign(view, { uid, game: null, badges: [], icons: {}, scale: 1, q: '', loading: true, gameIcon: null });
  const app = $('#app');
  app.innerHTML = `
    <section class="game-hero" id="gameHero">
      <div class="game-hero-bg" id="heroBg"></div>
      <a href="#/" class="back">← Voltar</a>
      <div class="game-hero-inner">
        <div class="game-hero-icon skeleton" id="heroIcon"></div>
        <div class="game-hero-text">
          <h1 id="gameName"><span class="skeleton-line" style="width:260px"></span></h1>
          <div class="game-hero-meta" id="gameMeta"><span class="skeleton-line" style="width:180px"></span></div>
          <div class="game-hero-actions">
            <button class="btn btn-primary" type="button" id="syncBtn">⟳ Sincronizar com Roblox</button>
            <a class="btn btn-ghost" id="playBtn" target="_blank" rel="noopener">▶ Jogar</a>
          </div>
        </div>
        <div class="progress-box" id="progressBox">${ring(0)}<div class="ring-label"><b>…</b></div></div>
      </div>
    </section>

    <section class="toolbar">
      <div class="segmented" role="tablist" id="filterTabs">
        <button type="button" data-filter="todas">Todas <span id="cntTodas">0</span></button>
        <button type="button" data-filter="tenho">Tenho <span id="cntTenho">0</span></button>
        <button type="button" data-filter="faltam">Faltam <span id="cntFaltam">0</span></button>
      </div>
      <div class="toolbar-right">
        <label class="mini-search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="badgeSearch" type="search" placeholder="Filtrar conquistas…" aria-label="Filtrar conquistas">
        </label>
        <select id="sortSel" aria-label="Ordenar">
          <option value="padrao">Ordem do jogo</option>
          <option value="raras">Mais raras</option>
          <option value="comuns">Mais comuns</option>
          <option value="obtidas">Mais obtidas</option>
          <option value="novas">Mais novas</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
        <div class="menu-wrap">
          <button class="icon-btn" type="button" id="moreBtn" aria-label="Mais opções" aria-expanded="false">⋯</button>
          <div class="menu" id="moreMenu" hidden>
            <label class="menu-item"><input type="checkbox" id="showDisabled"> Mostrar desativadas</label>
            <button class="menu-item" type="button" data-act="all">Marcar todas as visíveis</button>
            <button class="menu-item danger" type="button" data-act="none">Desmarcar todas as visíveis</button>
          </div>
        </div>
      </div>
    </section>

    <section class="badge-grid" id="badgeGrid">${'<div class="badge-card skeleton"></div>'.repeat(10)}</section>
  `;

  $$('#filterTabs button').forEach((b) => b.classList.toggle('active', b.dataset.filter === view.filter));
  $('#sortSel').value = view.sort;
  $('#showDisabled').checked = view.showDisabled;
  bindGameControls();

  try {
    const [game] = await roblox.games([uid]);
    if (token !== routeToken) return;
    if (!game) throw new ApiError('Jogo não encontrado.', 404);
    view.game = game;
    document.title = `${game.name} · SeeBaged`;
    $('#gameName').textContent = game.name;
    $('#gameMeta').innerHTML = `
      <span>por <b>${esc(game.creator?.name || '?')}</b>${game.creator?.hasVerifiedBadge ? ' <i class="verified" title="Verificado">✔</i>' : ''}</span>
      <span><i class="dot live"></i>${nf.format(game.playing || 0)} jogando</span>
      <span>👁 ${nfc.format(game.visits || 0)} visitas</span>`;
    $('#playBtn').href = `https://www.roblox.com/games/${game.rootPlaceId}`;

    roblox.thumbs('games', [uid]).then((m) => {
      if (token !== routeToken || !m[uid]) return;
      view.gameIcon = m[uid];
      $('#heroIcon').classList.remove('skeleton');
      $('#heroIcon').innerHTML = `<img src="${esc(m[uid])}" alt="">`;
      $('#heroBg').style.backgroundImage = `url("${m[uid]}")`;
      persistGame();
    });

    let cursor = null;
    let pages = 0;
    do {
      const page = await roblox.badgesPage(uid, cursor);
      if (token !== routeToken) return;
      const data = page.data || [];
      view.badges.push(...data);
      // A API pode devolver taxa em fração (0–1) ou em porcentagem (0–100).
      if (view.badges.some((b) => (b.statistics?.winRatePercentage || 0) > 1)) view.scale = 100;
      cursor = page.nextPageCursor;
      pages++;
      view.loading = Boolean(cursor) && pages < 30;
      renderBadgeGrid();
      renderProgress();
      roblox.thumbs('badges', data.map((b) => b.id)).then((m) => {
        if (token !== routeToken) return;
        Object.assign(view.icons, m);
        for (const [id, url] of Object.entries(m)) {
          const img = $(`img[data-icon="${id}"]`);
          if (img) img.src = url;
        }
      });
    } while (view.loading);

    persistGame();
    if (store.settings.userId && store.settings.autoSync !== false) syncCurrent(true);
  } catch (e) {
    if (token !== routeToken) return;
    view.loading = false;
    $('#badgeGrid').innerHTML = errorBox(e);
    if (!view.game) {
      $('#gameName').textContent = 'Jogo indisponível';
      $('#gameMeta').textContent = '';
    }
  }
}

function bindGameControls() {
  $('#filterTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    view.filter = b.dataset.filter;
    $$('#filterTabs button').forEach((x) => x.classList.toggle('active', x === b));
    renderBadgeGrid();
  });
  let t;
  $('#badgeSearch').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { view.q = e.target.value.trim(); renderBadgeGrid(); }, 120);
  });
  $('#sortSel').addEventListener('change', (e) => { view.sort = e.target.value; renderBadgeGrid(); });

  const menu = $('#moreMenu');
  $('#moreBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    $('#moreBtn').setAttribute('aria-expanded', String(!menu.hidden));
  });
  menu.addEventListener('click', (e) => e.stopPropagation());
  $('#showDisabled').addEventListener('change', (e) => {
    view.showDisabled = e.target.checked;
    renderBadgeGrid();
    renderProgress();
  });
  menu.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const list = visibleBadges().filter((b) => b.enabled !== false);
    if (act === 'none' && !confirm(`Desmarcar ${list.length} conquista(s)?`)) return;
    list.forEach((b) => setOwned(b.id, view.uid, act === 'all'));
    menu.hidden = true;
    afterOwnedChange();
  });

  $('#badgeGrid').addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const card = e.target.closest('.badge-card[data-id]');
    if (!card || card.classList.contains('disabled')) return;
    toggleBadge(card);
  });

  $('#syncBtn').addEventListener('click', () => {
    if (!store.settings.userId) return openUserModal(() => syncCurrent());
    syncCurrent();
  });
}

function toggleBadge(card) {
  const id = Number(card.dataset.id);
  const now = !isOwned(id);
  const before = trackedBadges().every((b) => isOwned(b.id));
  setOwned(id, view.uid, now);
  if (view.filter !== 'todas') {
    card.classList.add('leaving');
    setTimeout(renderBadgeGrid, 220);
  } else {
    const b = view.badges.find((x) => x.id === id);
    const i = $$('.badge-card[data-id]').indexOf(card);
    card.outerHTML = badgeCard(b, i);
    const fresh = $(`.badge-card[data-id="${id}"]`);
    fresh.style.animation = 'none';
    if (now) fresh.classList.add('pop');
  }
  renderProgress();
  updateNavCount();
  persistGame();
  const tracked = trackedBadges();
  if (now && !before && tracked.length && tracked.every((b) => isOwned(b.id))) {
    confetti();
    toast(`🏆 Você completou todas as conquistas de ${view.game?.name || 'este jogo'}!`, 'success');
  }
}

function afterOwnedChange() {
  renderBadgeGrid();
  renderProgress();
  updateNavCount();
  persistGame();
}

async function syncCurrent(silent = false) {
  const btn = $('#syncBtn');
  const ids = trackedBadges().map((b) => b.id);
  if (!ids.length || !store.settings.userId) return;
  btn?.classList.add('loading');
  try {
    const got = await roblox.awarded(store.settings.userId, ids);
    let added = 0;
    for (const a of got) {
      if (!isOwned(a.badgeId)) added++;
      setOwned(a.badgeId, view.uid, true, Date.parse(a.awardedDate) || Date.now());
    }
    afterOwnedChange();
    if (!silent || added) toast(added ? `✨ ${added} conquista(s) sincronizada(s) de @${store.settings.username}.` : `Tudo em dia com @${store.settings.username}.`, 'success');
  } catch (e) {
    await handleSyncError(e, silent);
  } finally {
    btn?.classList.remove('loading');
  }
}

let privacyWarned = false;

// 403 na sincronização quase sempre significa inventário privado no Roblox.
async function handleSyncError(e, silent = false) {
  if (e.status === 403) {
    const canView = await roblox.canViewInventory(store.settings.userId);
    if (canView !== true) {
      if (silent && privacyWarned) return;
      privacyWarned = true;
      return openPrivacyModal();
    }
  }
  if (!silent) toast(e.message, 'error');
}

function openPrivacyModal() {
  const user = esc(store.settings.username || '');
  modal.open('Seu inventário está privado 🔒', `
    <p class="muted">O Roblox só mostra as conquistas de <b>@${user}</b> se o inventário estiver visível para todos. Por isso a sincronização foi bloqueada (erro 403).</p>
    <ol class="steps">
      <li>Abra as <a class="link" href="https://www.roblox.com/my/account#!/privacy" target="_blank" rel="noopener">configurações de privacidade do Roblox ↗</a> (⚙ Configurações → <b>Privacidade</b>).</li>
      <li>Em <b>“Quem pode ver meu inventário?”</b>, escolha <b>Todos</b> e salve.</li>
      <li>Volte aqui e clique em <b>⟳ Sincronizar com Roblox</b> de novo.</li>
    </ol>
    <p class="muted">Contas de menores de 13 anos podem ter essa opção travada — aí um responsável precisa liberar em <b>Controles parentais</b>. Enquanto isso, você pode marcar as conquistas manualmente clicando nelas.</p>
    <div class="form-actions"><button class="btn btn-primary" type="button" data-close>Entendi</button></div>`);
}

/* ---------- Coleção ---------- */

function renderCollection() {
  document.title = 'Minha coleção · SeeBaged';
  const games = Object.values(store.games)
    .map((g) => ({ ...g, ...gameStats(g) }))
    .sort((a, b) => b.pct - a.pct || b.have - a.have || (b.visited || 0) - (a.visited || 0));
  const totalOwned = Object.keys(store.owned).length;
  const complete = games.filter((g) => g.total && g.have === g.total).length;
  const totalBadges = games.reduce((s, g) => s + g.total, 0);
  const totalHave = games.reduce((s, g) => s + g.have, 0);

  $('#app').innerHTML = `
    <section class="coll-head">
      <div>
        <p class="eyebrow">✦ Minha coleção</p>
        <h1>Seu troféu de <span class="grad">conquistas</span></h1>
      </div>
      <div class="coll-actions">
        <button class="btn" type="button" id="syncAll">⟳ Sincronizar tudo</button>
        <button class="btn btn-ghost" type="button" onclick="openSettings()">Backup</button>
      </div>
    </section>
    <section class="stats">
      <div class="stat"><b>${nf.format(totalOwned)}</b><span>conquistas marcadas</span></div>
      <div class="stat"><b>${games.length}</b><span>jogos acompanhados</span></div>
      <div class="stat"><b>${complete}</b><span>jogos 100%</span></div>
      <div class="stat"><b>${totalBadges ? Math.round((totalHave / totalBadges) * 100) : 0}%</b><span>progresso geral</span></div>
    </section>
    ${games.length ? `<section class="coll-list">${games.map((g) => `
      <div class="coll-row ${g.total && g.have === g.total ? 'complete' : ''}">
        <a href="#/jogo/${g.id}" class="coll-main">
          <img src="${esc(g.icon || PLACEHOLDER)}" alt="" loading="lazy">
          <div class="coll-text">
            <h3>${esc(g.name)} ${g.total && g.have === g.total ? '<span class="crown" title="Completo">👑</span>' : ''}</h3>
            <div class="bar"><i style="width:${(g.pct * 100).toFixed(1)}%"></i></div>
            <small>${g.have} de ${g.total} conquistas · ${Math.round(g.pct * 100)}%</small>
          </div>
        </a>
        <button class="icon-btn" type="button" data-remove="${g.id}" title="Remover da coleção" aria-label="Remover ${esc(g.name)}">✕</button>
      </div>`).join('')}</section>`
    : `<div class="empty"><div class="empty-ico">🎮</div><h3>Sua coleção está vazia</h3><p>Abra um jogo e comece a marcar suas conquistas.</p><a class="btn btn-primary" href="#/">Explorar jogos</a></div>`}
  `;

  $('#syncAll').addEventListener('click', () => {
    if (!store.settings.userId) return openUserModal(syncAll);
    syncAll();
  });
}

function onCollectionClick(e) {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  const g = store.games[btn.dataset.remove];
  if (!g || !confirm(`Remover “${g.name}” e suas marcações da coleção?`)) return;
  for (const id of g.ids || []) delete store.owned[id];
  delete store.games[btn.dataset.remove];
  saveStore();
  updateNavCount();
  renderCollection();
}

async function syncAll() {
  const btn = $('#syncAll');
  btn?.classList.add('loading');
  let added = 0;
  try {
    for (const g of Object.values(store.games)) {
      if (!g.ids?.length) continue;
      const got = await roblox.awarded(store.settings.userId, g.ids);
      for (const a of got) {
        if (!isOwned(a.badgeId)) added++;
        setOwned(a.badgeId, g.id, true, Date.parse(a.awardedDate) || Date.now());
      }
    }
    toast(added ? `✨ ${added} conquista(s) nova(s) sincronizada(s).` : 'Coleção já está em dia.', 'success');
  } catch (e) {
    await handleSyncError(e);
  } finally {
    btn?.classList.remove('loading');
    updateNavCount();
    if (location.hash.startsWith('#/colecao')) renderCollection();
  }
}

/* ---------- Usuário do Roblox ---------- */

function renderUserChip() {
  const { username, avatar } = store.settings;
  $('#userName').textContent = username ? `@${username}` : 'Conectar Roblox';
  const av = $('#userAvatar');
  av.innerHTML = avatar ? `<img src="${esc(avatar)}" alt="">` : esc(username ? username[0].toUpperCase() : '?');
  $('#userChip').classList.toggle('connected', Boolean(username));
}

function openUserModal(after) {
  const s = store.settings;
  modal.open('Conectar seu Roblox', `
    <p class="muted">Digite seu nome de usuário para sincronizar automaticamente as conquistas que você já ganhou. Nenhuma senha é necessária — usamos só dados públicos.</p>
    <form id="userForm" class="form">
      <label class="field"><span>Nome de usuário</span>
        <input id="userInput" required minlength="3" maxlength="20" placeholder="ex.: Builderman" value="${esc(s.username || '')}" autocomplete="off" spellcheck="false">
      </label>
      <label class="check"><input type="checkbox" id="autoSync" ${s.autoSync !== false ? 'checked' : ''}> Sincronizar sozinho ao abrir um jogo</label>
      <div class="form-actions">
        ${s.userId ? '<button class="btn btn-ghost danger" type="button" id="logoutBtn">Desconectar</button>' : ''}
        <button class="btn btn-primary" type="submit">Salvar</button>
      </div>
    </form>`, (root) => {
    $('#logoutBtn', root)?.addEventListener('click', () => {
      delete s.userId; delete s.username; delete s.avatar;
      saveStore(); renderUserChip(); modal.close();
      toast('Usuário desconectado.');
    });
    $('#userForm', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', root);
      btn.classList.add('loading');
      try {
        const name = $('#userInput', root).value.trim().replace(/^@/, '');
        const u = await roblox.user(name);
        if (!u) throw new Error('Usuário não encontrado.');
        Object.assign(s, { userId: u.id, username: u.name, autoSync: $('#autoSync', root).checked });
        s.avatar = await roblox.avatar(u.id);
        saveStore();
        renderUserChip();
        modal.close();
        toast(`Conectado como @${u.name}!`, 'success');
        after?.();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.classList.remove('loading');
      }
    });
  });
}

/* ---------- Configurações / backup ---------- */

function openSettings() {
  const s = store.settings;
  modal.open('Configurações', `
    <div class="form">
      <h4>Conexão com o Roblox</h4>
      <p class="muted">As APIs do Roblox não aceitam chamadas diretas do navegador, então o site usa um proxy. Rodando com <code>npm start</code>, o servidor local é usado automaticamente.</p>
      <label class="field"><span>Proxy personalizado (opcional)</span>
        <input id="proxyInput" placeholder="https://seu-worker.workers.dev/{sub}" value="${esc(s.proxy || '')}" spellcheck="false">
        <small>Use <code>{sub}</code> no lugar do subdomínio (badges, games…). Vazio = automático. Atual: <b>${esc(api.mode)}</b></small>
      </label>
      <div class="form-actions"><button class="btn" type="button" id="saveProxy">Salvar conexão</button></div>

      <h4>Backup das marcações</h4>
      <p class="muted">Seus dados ficam salvos neste navegador. Exporte para levar a outro dispositivo.</p>
      <div class="form-actions left">
        <button class="btn" type="button" id="exportBtn">⬇ Exportar</button>
        <label class="btn btn-ghost">⬆ Importar<input type="file" id="importInput" accept="application/json,.json" hidden></label>
        <button class="btn btn-ghost danger" type="button" id="wipeBtn">Apagar tudo</button>
      </div>
    </div>`, (root) => {
    $('#saveProxy', root).addEventListener('click', async () => {
      s.proxy = $('#proxyInput', root).value.trim();
      saveStore();
      await api.init();
      setConn('ok');
      modal.close();
      toast('Conexão atualizada.', 'success');
      route();
    });
    $('#exportBtn', root).addEventListener('click', () => {
      const data = { app: 'SeeBaged', version: 1, exportedAt: new Date().toISOString(), owned: store.owned, games: store.games };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = `seebaged-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('#importInput', root).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const d = JSON.parse(await file.text());
        if (!d || typeof d.owned !== 'object') throw new Error();
        Object.assign(store.owned, d.owned);
        Object.assign(store.games, d.games || {});
        saveStore();
        updateNavCount();
        modal.close();
        toast(`Backup importado: ${Object.keys(d.owned).length} conquista(s).`, 'success');
        route();
      } catch {
        toast('Arquivo de backup inválido.', 'error');
      }
    });
    $('#wipeBtn', root).addEventListener('click', () => {
      if (!confirm('Apagar todas as marcações e jogos salvos? Isso não pode ser desfeito.')) return;
      store.owned = {};
      store.games = {};
      saveStore();
      updateNavCount();
      modal.close();
      toast('Dados apagados.');
      route();
    });
  });
}

/* ---------- Inicialização ---------- */

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) modal.close();
  const menu = $('#moreMenu');
  if (menu && !menu.hidden && !e.target.closest('.menu-wrap')) menu.hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal').hidden) modal.close();
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
    const input = $('#searchInput') || $('#badgeSearch');
    if (input) { e.preventDefault(); input.focus(); }
  }
});
$('#app').addEventListener('click', onCollectionClick);
$('#settingsBtn').addEventListener('click', openSettings);
$('#userChip').addEventListener('click', () => openUserModal(() => { if (view.uid && location.hash.startsWith('#/jogo')) syncCurrent(); }));
window.addEventListener('hashchange', route);
window.addEventListener('storage', (e) => {
  if (e.key !== STORE_KEY) return;
  Object.assign(store, loadStore());
  updateNavCount();
  renderUserChip();
});

(async function start() {
  renderUserChip();
  updateNavCount();
  await api.init();
  setConn('ok');
  route();
})();
