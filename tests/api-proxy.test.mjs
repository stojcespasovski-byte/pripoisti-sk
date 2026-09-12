// Test serverovej proxy (api/[...cesta].js). Bez závislostí:  node tests/api-proxy.test.mjs
//
// Prečo existuje: proxy je JEDINÉ hrdlo, ktorým idú všetky volania na backend
// z celého webu — ceny, kalkulácia, uzavretie zmluvy, doklady. Tichá regresia
// (niekto „zjednoduší" prenos hlavičiek a zmizne RestUid alebo X-Brand) by
// nezhodila web, ale prestali by sa uzatvárať zmluvy alebo zapisovať do CRM.
// Kontrola syntaxe takú vec nechytí, preto sú tu tvrdenia, ktoré padnú.
const mod = await import(new URL('../api/[...cesta].js', import.meta.url).href);
const handler = mod.default;
let volanie = null;
globalThis.fetch = async (url, opts) => {
  volanie = { url, method: opts.method, headers: Object.fromEntries(opts.headers.entries()), telo: opts.body };
  return new Response(new Uint8Array([0x25,0x50,0x44,0x46]), { status: 200,
    headers: { 'content-type':'application/pdf', 'content-disposition':'attachment; filename="x.pdf"', 'x-tajne':'must-not-pass' } });
};
process.env.ALEX_API_KEY = 'TAJNY_KLUC';

let chyby = 0;
const ok = (p, m) => { console.log((p?'  ✓':'  ✗') + ' ' + m); if(!p) chyby++; };

// 1) skladanie cieľovej adresy pre KAŽDÚ cestu, ktorú web reálne volá
const cesty = [
  ['/api/rate-matrix', '', 'https://alexapi.sk/rate-matrix'],
  ['/api/ciselnik/farby', '', 'https://alexapi.sk/ciselnik/farby'],
  ['/api/ciselnik/obec', '?psc=84101', 'https://alexapi.sk/ciselnik/obec?psc=84101'],
  ['/api/bcrm/vehicle', '?ecv=BA123AB', 'https://alexapi.sk/bcrm/vehicle?ecv=BA123AB'],
  ['/api/bcrm/company', '?ico=123&stat=SK', 'https://alexapi.sk/bcrm/company?ico=123&stat=SK'],
  ['/api/reviews/google', '', 'https://alexapi.sk/reviews/google'],
  ['/api/pillow/authorize', '', 'https://alexapi.sk/pillow/authorize'],
  ['/api/pillow/logout', '', 'https://alexapi.sk/pillow/logout'],
  ['/api/pillow/par/policies/rate/AP2', '', 'https://alexapi.sk/pillow/par/policies/rate/AP2'],
  ['/api/pillow/par/policies/print/AP2/policyProposal/C1/print/AP2_NAV', '', 'https://alexapi.sk/pillow/par/policies/print/AP2/policyProposal/C1/print/AP2_NAV'],
  ['/api/pillow/doplnky/C1', '', 'https://alexapi.sk/pillow/doplnky/C1'],
  ['/api/bcrm/docs/zaznam', '?format=pdf', 'https://alexapi.sk/bcrm/docs/zaznam?format=pdf'],
  ['/api/bcrm/email/send-offer', '', 'https://alexapi.sk/bcrm/email/send-offer'],
  ['/api/bcrm/docs/najazd', '?km=15000', 'https://alexapi.sk/bcrm/docs/najazd?km=15000'],
];
console.log('cieľové adresy:');
for (const [p, q, ocak] of cesty) {
  await handler(new Request('https://pripoisti.sk' + p + q, { method: 'GET' }));
  ok(volanie.url === ocak, `${p}${q} → ${volanie.url}`);
}

// 2) kľúč a hlavičky
console.log('hlavičky:');
await handler(new Request('https://pripoisti.sk/api/pillow/par/policies/save/AP2', {
  method:'POST', headers:{'Content-Type':'text/xml; charset=utf-8','RestUid':'UID9','X-Brand':'pripoisti','Cookie':'tajna=1'},
  body:'<policy/>' }));
ok(volanie.headers['x-api-key'] === 'TAJNY_KLUC', 'X-Api-Key doplnený zo servera');
ok(volanie.headers['restuid'] === 'UID9', 'RestUid prenesený (Pillow session)');
ok(volanie.headers['x-brand'] === 'pripoisti', 'X-Brand prenesený (zápis do CRM)');
ok(volanie.headers['content-type'].startsWith('text/xml'), 'Content-Type prenesený');
ok(!('cookie' in volanie.headers), 'Cookie sa NEposiela na cudziu domenu');
ok(new TextDecoder().decode(volanie.telo) === '<policy/>', 'telo POST prenesené');

// 3) binárna odpoveď a stav
console.log('odpoveď:');
const r = await handler(new Request('https://pripoisti.sk/api/bcrm/docs/zaznam?format=pdf'));
const bajty = new Uint8Array(await r.arrayBuffer());
ok(r.status === 200, 'stav prenesený');
ok(bajty[0]===0x25 && bajty[1]===0x50 && bajty[2]===0x44 && bajty[3]===0x46, 'PDF nie je poškodené (%PDF)');
ok(r.headers.get('content-disposition')?.includes('x.pdf'), 'content-disposition (názov súboru) prenesený');
ok(r.headers.get('x-tajne') === null, 'cudzie hlavičky sa neprepúšťajú');

// 4) stav sa neprekladá
globalThis.fetch = async () => new Response('{"detail":"chyba pola"}', { status:422, headers:{'content-type':'application/json'} });
const r422 = await handler(new Request('https://pripoisti.sk/api/rate-matrix', { method:'POST', body:'{}' }));
ok(r422.status === 422, '422 z backendu zostáva 422');
ok((await r422.text()).includes('chyba pola'), 'dôvod chyby sa nestráca');

// 5) backend nedostupný
globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
const r502 = await handler(new Request('https://pripoisti.sk/api/rate-matrix'));
ok(r502.status === 502, 'nedostupný backend → 502, nie spadnutá funkcia');

// 6) bez kľúča NEspadne (prechodný režim), ale zaloguje
delete process.env.ALEX_API_KEY;
globalThis.fetch = async (u,o) => { volanie={headers:Object.fromEntries(o.headers.entries())}; return new Response('ok',{status:200}); };
const errs=[]; const orig=console.error; console.error=(...a)=>errs.push(a.join(' '));
const rbk = await handler(new Request('https://pripoisti.sk/api/rate-matrix'));
console.error=orig;
ok(rbk.status === 200, 'bez kľúča web NEzhasne (backend je v režime len-log)');
ok(!('x-api-key' in volanie.headers), 'bez kľúča sa neposiela prázdna hlavička');
ok(errs.some(e=>e.includes('ALEX_API_KEY')), 'chýbajúci kľúč sa zaloguje');

console.log(chyby ? `\nFAIL — ${chyby} chýb` : '\nVŠETKO OK');
process.exit(chyby?1:0);
