// Serverová proxy na alexapi.sk. Existuje kvôli jedinej veci: kľúč odberateľa
// sa nesmie dostať do prehliadača. Stránka je stiahnuteľná, takže čokoľvek v nej
// je zverejnené — kľúč preto žije tu, v nastavení projektu, a von ide len výsledok.
//
// Prehliadač volá `/api/<cesta>` na NAŠEJ doméne, my dolejeme `X-Api-Key`
// a pošleme na `https://alexapi.sk/<cesta>`. Pre návštevníka sa nemení nič:
// žiadne prihlásenie, žiadna hlavička na jeho strane.
//
// Beží na Edge kvôli telu odpovede: `/bcrm/docs/zaznam?format=pdf` aj Pillow
// tlačivá vracajú PDF. Edge dostane Request/Response, takže binárku posielame
// ako stream a nekazíme ju prekódovaním na text (to bola chyba, ktorú by
// `res.send(text)` v Node runtime spravil ticho — PDF by prišlo rozbité).
export const config = { runtime: 'edge' };

const ALEX = process.env.ALEX_URL || 'https://alexapi.sk';

// Hlavičky, ktoré má zmysel preniesť ĎALEJ. Zámerne allowlist, nie „všetko
// okrem": cookie ani host sa na cudziu doménu posielať nemajú, a `RestUid`
// (Pillow session) s `X-Brand` (podľa nej backend vie, že zápis do CRM robí on)
// by sa pri slepom kopírovaní ľahko stratili.
const PRENOS_TAM = ['content-type', 'accept', 'restuid', 'x-brand'];
// `content-disposition` je tu kvôli názvu súboru pri PDF — bez neho sa doklad
// klientovi uloží ako „cesta".
const PRENOS_SPAT = ['content-type', 'content-disposition', 'cache-control'];

export default async function handler(request) {
  const vstup = new URL(request.url);

  // `/api/rate-matrix?x=1` → `/rate-matrix?x=1`. Prefix /api je len naša
  // adresa, backend ho nepozná.
  const cesta = vstup.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
  const ciel = ALEX + cesta + vstup.search;

  const hlavicky = new Headers();
  for (const h of PRENOS_TAM) {
    const v = request.headers.get(h);
    if (v) hlavicky.set(h, v);
  }

  const KLUC = process.env.ALEX_API_KEY;
  if (KLUC) {
    hlavicky.set('X-Api-Key', KLUC);
  } else {
    // ZÁMERNE fail-open, nie 503. Backend je v prechodnom režime „len log":
    // volanie bez kľúča prejde a zapíše sa. Keby sme tu spadli, chýbajúca
    // premenná by zhasla celú kalkulačku, kým takto je to jeden riadok v logu
    // backendu (`API KĽÚČ CHÝBA … origin=https://pripoisti.sk`) — a práve ten
    // log je dohodnutá kontrola, že je nasadenie hotové. Až keď backend prepne
    // na 401, stane sa z toho ostrá porucha — dovtedy nemá zmysel lámať web
    // pre premennú, ktorá sa dopĺňa ručne.
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
    return new Response(JSON.stringify({ detail: 'Backend neodpovedá: ' + (e && e.message) }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
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
