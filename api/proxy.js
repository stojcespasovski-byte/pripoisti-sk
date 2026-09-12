// Serverová proxy na alexapi.sk. Existuje kvôli jedinej veci: kľúč odberateľa
// sa nesmie dostať do prehliadača. Stránka je stiahnuteľná, takže čokoľvek v nej
// je zverejnené — kľúč preto žije tu, v nastavení projektu, a von ide len výsledok.
//
// Prehliadač volá `/api/<cesta>` na NAŠEJ doméne, my dolejeme `X-Api-Key`
// a pošleme na `https://alexapi.sk/<cesta>`. Pre návštevníka sa nemení nič:
// žiadne prihlásenie, žiadna hlavička na jeho strane.
//
// SMEROVANIE: cestu NEČÍTAME z `request.url`, ale z parametra `__proxy_cesta`,
// ktorý dopĺňa rewrite vo `vercel.json`. Dôvod je overený na produkcii:
// súbor `api/[...cesta].js` Vercel v zero-config projekte (bez frameworku)
// obslúži len JEDEN segment — `/api/rate-matrix` prešlo, `/api/ciselnik/farby`
// vrátilo NOT_FOUND. Explicitný rewrite na toto správanie nesadá.
//
// Beží na Edge kvôli telu odpovede: `/bcrm/docs/zaznam?format=pdf` aj Pillow
// tlačivá vracajú PDF. Edge dostane Request/Response, takže binárku posielame
// ako stream a nekazíme ju prekódovaním na text (to by `res.send(text)`
// v Node runtime spravil ticho — PDF by prišlo rozbité).
export const config = { runtime: 'edge' };

const ALEX = process.env.ALEX_URL || 'https://alexapi.sk';

// Názov parametra je zámerne škaredý, aby sa nezrazil s parametrom, ktorý by
// niekedy niesla samotná cesta (`?psc=`, `?km=`, `?format=`…).
const PARAM_CESTA = '__proxy_cesta';

// Hlavičky, ktoré má zmysel preniesť ĎALEJ. Zámerne allowlist, nie „všetko
// okrem": cookie ani host sa na cudziu doménu posielať nemajú, a `RestUid`
// (Pillow session) s `X-Brand` (podľa nej backend vie, že zápis do CRM robí on)
// by sa pri slepom kopírovaní ľahko stratili.
const PRENOS_TAM = ['content-type', 'accept', 'restuid', 'x-brand'];
// `content-disposition` je tu kvôli názvu súboru pri PDF — bez neho sa doklad
// klientovi uloží ako „proxy".
const PRENOS_SPAT = ['content-type', 'content-disposition', 'cache-control'];

export default async function handler(request) {
  const vstup = new URL(request.url);
  const params = new URLSearchParams(vstup.search);

  const cesta = params.get(PARAM_CESTA);
  if (cesta === null) {
    // Bez parametra sa sem dá dostať len priamym volaním `/api/proxy`, teda
    // obídením rewritu. Nehádame cieľ — povieme, že to takto nefunguje.
    return json(400, { detail: 'Proxy sa volá ako /api/<cesta>, nie priamo.' });
  }
  params.delete(PARAM_CESTA);          // ďalej patrí len pôvodný query

  const zvysok = params.toString();
  const ciel = ALEX + '/' + cesta.replace(/^\/+/, '') + (zvysok ? '?' + zvysok : '');

  const hlavicky = new Headers();
  for (const h of PRENOS_TAM) {
    const v = request.headers.get(h);
    if (v) hlavicky.set(h, v);
  }

  const KLUC = process.env.ALEX_API_KEY;
  if (KLUC) {
    hlavicky.set('X-Api-Key', KLUC);
  } else {
    // ZÁMERNE fail-open, nie 503. Backend má prechodný režim „len log":
    // volanie bez kľúča prejde a zapíše sa. Keby sme tu spadli, chýbajúca
    // premenná by zhasla celú kalkulačku, kým takto je to jeden riadok v logu
    // backendu (`API KĽÚČ CHÝBA … origin=https://pripoisti.sk`) — a práve ten
    // log je dohodnutá kontrola, že je nasadenie hotové. Keď backend prepne na
    // 401, stane sa z toho ostrá porucha — dovtedy nemá zmysel lámať web pre
    // premennú, ktorá sa dopĺňa ručne.
    console.error('ALEX_API_KEY chýba v nastavení projektu — volanie ide bez kľúča:', cesta);
  }

  // Telo čítame celé (XML kalkulácií a JSON sú malé). Stream by si na Edge
  // vyžiadal `duplex: 'half'` a priniesol nekompatibilitu bez úžitku — PDF
  // chodia v ODPOVEDI, nie v požiadavke.
  const telo = ['GET', 'HEAD'].includes(request.method)
    ? undefined
    : await request.arrayBuffer();

  let odp;
  try {
    odp = await fetch(ciel, { method: request.method, headers: hlavicky, body: telo });
  } catch (e) {
    // 502 = „nedostal som sa k backendu". Odlišuje sa od chyby, ktorú by
    // vrátil samotný backend, aby sa pri hľadaní nemíňal čas.
    return json(502, { detail: 'Backend neodpovedá: ' + (e && e.message) });
  }

  // Stav sa NEPREKLADÁ. Keď backend povie 422 s dôvodom, stránka má vidieť 422
  // aj s dôvodom — inak by klient dostal „nepodarilo sa" a nikto by sa
  // nedozvedel, ktoré pole je zlé.
  const von = new Headers();
  for (const h of PRENOS_SPAT) {
    const v = odp.headers.get(h);
    if (v) von.set(h, v);
  }
  return new Response(odp.body, { status: odp.status, headers: von });
}

function json(status, telo) {
  return new Response(JSON.stringify(telo),
    { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
