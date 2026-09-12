// Test serverovej proxy (api/proxy.js). Bez závislostí:  node tests/api-proxy.test.mjs
//
// Prečo existuje: proxy je JEDINÉ hrdlo, ktorým idú všetky volania na backend
// z celého webu — ceny, kalkulácia, uzavretie zmluvy, doklady. Tichá regresia
// (niekto „zjednoduší" prenos hlavičiek a zmizne RestUid alebo X-Brand) by
// nezhodila web, ale prestali by sa uzatvárať zmluvy alebo zapisovať do CRM.
// Kontrola syntaxe takú vec nechytí, preto sú tu tvrdenia, ktoré padnú.
//
// Test ide cez ROVNAKÝ tvar adresy, aký vyrába rewrite vo vercel.json, a ten
// rewrite si zároveň overuje — inak by test prešiel aj vtedy, keď by pravidlo
// zo vercel.json vypadlo a produkcia by vracala NOT_FOUND (presne to sa
// 12. 9. 2026 stalo pri `api/[...cesta].js`: jeden segment fungoval, dva nie).
import { readFileSync } from 'node:fs';

const handler = (await import(new URL('../api/proxy.js', import.meta.url).href)).default;
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

let chyby = 0;
const ok = (p, m) => { console.log((p ? '  ✓' : '  ✗') + ' ' + m); if (!p) chyby++; };

// ── rewrite musí existovať a súhlasiť s názvom parametra v proxy ──
console.log('vercel.json:');
const pravidlo = (vercel.rewrites || []).find(r => r.source === '/api/(.*)');
ok(!!pravidlo, 'rewrite /api/(.*) existuje');
ok(pravidlo?.destination === '/api/proxy?__proxy_cesta=$1',
   'rewrite smeruje na /api/proxy s parametrom __proxy_cesta');

// Presne to, čo z pôvodnej adresy vyrobí ten rewrite.
function akoRewrite(cesta) {
  const [p, q] = cesta.replace(/^\//, '').split('?');
  const params = new URLSearchParams('__proxy_cesta=' + p);
  for (const [k, v] of new URLSearchParams(q || '')) params.append(k, v);
  return 'https://pripoisti.sk/api/proxy?' + params.toString();
}

let volanie = null;
const mockPdf = () => {
  globalThis.fetch = async (url, opts) => {
    volanie = { url, method: opts.method, headers: Object.fromEntries(opts.headers.entries()), telo: opts.body };
    return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      status: 200,
      headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="x.pdf"', 'x-tajne': 'must-not-pass' },
    });
  };
};
mockPdf();
process.env.ALEX_API_KEY = 'TAJNY_KLUC';

// ── 1) cieľová adresa pre KAŽDÚ cestu, ktorú web reálne volá ──
// Hĺbka 2+ je tu zámerne: na tom padla prvá verzia.
const cesty = [
  ['/rate-matrix', 'https://alexapi.sk/rate-matrix'],
  ['/reviews/google', 'https://alexapi.sk/reviews/google'],
  ['/ciselnik/farby', 'https://alexapi.sk/ciselnik/farby'],
  ['/ciselnik/obec?psc=84101', 'https://alexapi.sk/ciselnik/obec?psc=84101'],
  ['/bcrm/vehicle?ecv=BA123AB', 'https://alexapi.sk/bcrm/vehicle?ecv=BA123AB'],
  ['/bcrm/company?ico=123&stat=SK', 'https://alexapi.sk/bcrm/company?ico=123&stat=SK'],
  ['/bcrm/docs/zaznam?format=pdf', 'https://alexapi.sk/bcrm/docs/zaznam?format=pdf'],
  ['/bcrm/docs/najazd?km=15000', 'https://alexapi.sk/bcrm/docs/najazd?km=15000'],
  ['/bcrm/email/send-offer', 'https://alexapi.sk/bcrm/email/send-offer'],
  ['/pillow/authorize', 'https://alexapi.sk/pillow/authorize'],
  ['/pillow/logout', 'https://alexapi.sk/pillow/logout'],
  ['/pillow/doplnky/C1', 'https://alexapi.sk/pillow/doplnky/C1'],
  ['/pillow/par/policies/rate/AP2', 'https://alexapi.sk/pillow/par/policies/rate/AP2'],
  ['/pillow/par/policies/print/AP2/policyProposal/C1/print/AP2_NAV',
   'https://alexapi.sk/pillow/par/policies/print/AP2/policyProposal/C1/print/AP2_NAV'],
];
console.log('cieľové adresy (vrátane hlbokých ciest):');
for (const [cesta, ocak] of cesty) {
  await handler(new Request(akoRewrite(cesta), { method: 'GET' }));
  ok(volanie.url === ocak, `${cesta}  →  ${volanie.url}`);
}

// ── 2) kľúč a hlavičky ──
console.log('hlavičky:');
await handler(new Request(akoRewrite('/pillow/par/policies/save/AP2'), {
  method: 'POST',
  headers: { 'Content-Type': 'text/xml; charset=utf-8', 'RestUid': 'UID9', 'X-Brand': 'pripoisti', 'Cookie': 'tajna=1' },
  body: '<policy/>',
}));
ok(volanie.headers['x-api-key'] === 'TAJNY_KLUC', 'X-Api-Key doplnený zo servera');
ok(volanie.headers['restuid'] === 'UID9', 'RestUid prenesený (Pillow session)');
ok(volanie.headers['x-brand'] === 'pripoisti', 'X-Brand prenesený (zápis do CRM)');
ok(volanie.headers['content-type'].startsWith('text/xml'), 'Content-Type prenesený');
ok(!('cookie' in volanie.headers), 'Cookie sa NEposiela na cudziu doménu');
ok(new TextDecoder().decode(volanie.telo) === '<policy/>', 'telo POST prenesené');
ok(!volanie.url.includes('__proxy_cesta'), 'služobný parameter neprejde na backend');

// ── 3) binárna odpoveď a stav ──
console.log('odpoveď:');
const r = await handler(new Request(akoRewrite('/bcrm/docs/zaznam?format=pdf')));
const bajty = new Uint8Array(await r.arrayBuffer());
ok(r.status === 200, 'stav prenesený');
ok(bajty[0] === 0x25 && bajty[1] === 0x50 && bajty[2] === 0x44 && bajty[3] === 0x46, 'PDF nie je poškodené (%PDF)');
ok(r.headers.get('content-disposition')?.includes('x.pdf'), 'content-disposition (názov súboru) prenesený');
ok(r.headers.get('x-tajne') === null, 'cudzie hlavičky sa neprepúšťajú');

// ── 4) stav sa neprekladá ──
globalThis.fetch = async () => new Response('{"detail":"chyba pola"}', { status: 422, headers: { 'content-type': 'application/json' } });
const r422 = await handler(new Request(akoRewrite('/rate-matrix'), { method: 'POST', body: '{}' }));
ok(r422.status === 422, '422 z backendu zostáva 422');
ok((await r422.text()).includes('chyba pola'), 'dôvod chyby sa nestráca');

// ── 5) backend nedostupný ──
globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
ok((await handler(new Request(akoRewrite('/rate-matrix')))).status === 502,
   'nedostupný backend → 502, nie spadnutá funkcia');

// ── 6) priame volanie /api/proxy bez rewritu ──
ok((await handler(new Request('https://pripoisti.sk/api/proxy'))).status === 400,
   'volanie bez __proxy_cesta → 400, necieli naslepo');

// ── 7) bez kľúča web NEzhasne (prechodný režim backendu) ──
delete process.env.ALEX_API_KEY;
globalThis.fetch = async (u, o) => { volanie = { headers: Object.fromEntries(o.headers.entries()) }; return new Response('ok', { status: 200 }); };
const errs = []; const orig = console.error; console.error = (...a) => errs.push(a.join(' '));
const rbk = await handler(new Request(akoRewrite('/rate-matrix')));
console.error = orig;
ok(rbk.status === 200, 'bez kľúča web NEzhasne (backend je v režime len-log)');
ok(!('x-api-key' in volanie.headers), 'bez kľúča sa neposiela prázdna hlavička');
ok(errs.some(e => e.includes('ALEX_API_KEY')), 'chýbajúci kľúč sa zaloguje');

console.log(chyby ? `\nFAIL — ${chyby} chýb` : '\nVŠETKO OK');
process.exit(chyby ? 1 : 0);
