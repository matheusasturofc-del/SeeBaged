'use strict';

/* =========================================================
   Categorias de conquistas por jogo.
   Cada perfil classifica as badges pelo nome + descrição, então badges
   novas entram sozinhas na categoria certa. Uma badge pode ter várias.
   Para corrigir uma badge específica, use `fixas` (ID da badge → categorias).
   ========================================================= */

// Nomes tirados da Grace Wiki (grace.miraheze.org: Entities, Modifiers, Gamemodes).
// `exato: true` = só conta com a mesma grafia (evita confundir com palavras comuns em inglês).
const GRACE_ENTIDADES = [
  { nome: 'Carnation' }, { nome: 'Goatman' }, { nome: 'Slugfish' }, { nome: 'Elkman' },
  { nome: 'Dozer' }, { nome: 'Litany' }, { nome: 'Doppel' }, { nome: 'Doombringer' },
  { nome: 'Kookoo' }, { nome: 'Mime' }, { nome: 'Zomber' }, { nome: 'Duk' },
  { nome: 'Craven' }, { nome: 'Seesay' }, { nome: 'S.N.A.P.', padrao: /\bS\.?N\.?A\.?P\b/ },
  { nome: 'Innego' }, { nome: 'Sundial' }, { nome: 'PIHSROW' },
  { nome: 'Slight', exato: true }, { nome: 'Heed', exato: true }, { nome: 'Sorrow', exato: true },
  { nome: 'Tar', exato: true }, { nome: 'Rue', exato: true }, { nome: 'Drain', exato: true },
  { nome: 'Ire', exato: true }, { nome: 'Fool', exato: true }, { nome: 'Stem', exato: true },
  { nome: 'Covet', exato: true }, { nome: 'sin', exato: true }, { nome: 'SHAME', exato: true },
];

const GRACE_MODIFICADORES = [
  'Sunflower', '3rd Circle of Hell', 'Boingfish', 'My Many Eyes', 'Further Perspective',
  'Cheesed to meet you', 'MY SWEET DUCKLING', 'MYSWEETDUCKLING', 'Just a Pinch', 'uh oh!',
];

const GRACE_MODOS = [
  { nome: 'zen' }, { nome: 'REPRIEVE' }, { nome: 'MAYHEM' }, { nome: 'WOED' },
  { nome: 'rOT', exato: true }, { nome: 'RETRO', exato: true },
];

// Goober Clicker (minijogo do menu): rebirths/"regoob", quantidade de Goobers e cliques.
const GRACE_GOOBER = /goob|zloober|rebirth/i;

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termo = (t) => (t.re ||= t.padrao || new RegExp(`(^|[^\\p{L}\\p{N}])${escRe(t.nome)}(?=$|[^\\p{L}\\p{N}])`, t.exato ? 'u' : 'iu'));

const GRACE = {
  nome: 'Grace',
  // Grace [GRACE BUT EVIL] — e, se o universo mudar, qualquer "Grace" do mesmo criador.
  combina: (g) => g.id === 6508759464 || (/^\s*grace\b/i.test(g.name || '') && /fartering few/i.test(g.creator?.name || '')),
  categorias: [
    { id: 'entidades', icone: '👁', nome: 'Entidades', termos: GRACE_ENTIDADES, subfiltro: true },
    {
      id: 'modificadores', icone: '⚙', nome: 'Modificadores',
      termos: [
        ...GRACE_MODIFICADORES.map((nome) => ({ nome })),
        { nome: 'modifier', padrao: /modifier|modificador|custom lobby/i },
        { nome: 'CHAOS', exato: true },
      ],
    },
    {
      id: 'goobers', icone: '🥜', nome: 'Goobers',
      termos: [{ nome: 'goober', padrao: GRACE_GOOBER }],
    },
    {
      id: 'progresso', icone: '🚪', nome: 'Saferooms e progresso',
      // "Reach 1 000 000 Goobers" é do Goober Clicker, não da partida.
      exceto: GRACE_GOOBER,
      termos: [{ nome: 'progresso', padrao: /safe ?rooms?|\breach\b|\btimers?\b|\bfloors?\b|\blevel\b|\bxp\b|\bescape\b|\bwins?\b|\bwithout dying\b|\bin under\b/i }],
    },
    { id: 'modos', icone: '🎮', nome: 'Modos de jogo', termos: [...GRACE_MODOS, { nome: 'gamemode', padrao: /game ?mode/i }] },
    {
      id: 'eventos', icone: '🎉', nome: 'Eventos e especiais',
      termos: [{ nome: 'evento', padrao: /\bevent\b|halloween|christmas|xmas|easter|april fools?|anniversary|valentine|\bbeta\b|\balpha\b|tester|thank you|met the dev|developer/i }],
    },
    { id: 'segredos', icone: '❓', nome: 'Segredos e outros', resto: true },
  ],
  fixas: {},
};

const PERFIS = [GRACE];

function perfilDoJogo(game) {
  return (game && PERFIS.find((p) => p.combina(game))) || null;
}

// Devolve { cats: Set<id>, ents: Set<nome> } para uma badge.
function classificar(perfil, badge) {
  const texto = `${badge.displayName || badge.name || ''} — ${badge.displayDescription || badge.description || ''}`;
  const cats = new Set(perfil.fixas[badge.id] || []);
  const ents = new Set();
  if (!cats.size) {
    for (const c of perfil.categorias) {
      if (c.resto || c.exceto?.test(texto)) continue;
      for (const t of c.termos) {
        if (!termo(t).test(texto)) continue;
        cats.add(c.id);
        if (c.subfiltro) ents.add(t.nome);
      }
    }
    if (!cats.size) cats.add(perfil.categorias.find((c) => c.resto).id);
  } else {
    for (const t of perfil.categorias.find((c) => c.subfiltro)?.termos || []) if (termo(t).test(texto)) ents.add(t.nome);
  }
  return { cats, ents };
}
