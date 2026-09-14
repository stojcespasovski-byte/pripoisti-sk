// Test hranice „nového vozidla" (vehIsNew v index.html). Bez závislostí:  node tests/veh-is-new.test.mjs
//
// Prečo existuje: pri osobnom aute s prvou evidenciou `on_or_after dnes-6m` Pillow bez
// hodnoty vozidla odmietne riziká závislé od hodnoty vrátane skla. Web podľa vehIsNew
// rozhoduje, či si hodnotu od klienta vypýta — keď sa hranica od backendu líši čo i len
// o deň, cena sa nevypýta a sklo neprejde.
//
// Očakávané hranice NIE SÚ vypočítané týmto testom, ale backendovou funkciou
// `datum_z_kotvy("dnes-6m", dnes=…)` z alex-sk adapters/canonical.py (14. 9. 2026).
// Pôvodná verzia webu (`setMonth(-6)` + porovnanie s časom) sa s ňou nezhodovala
// ani jeden deň z 2 192 (2024–2029): hraničný deň vypadol vždy, na konci mesiaca
// pretiekla až o 3 dni (31. 8. → 3. 3. namiesto 28. 2.).
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const zdroj = html.match(/function vehIsNew\(datumReg, dnes = new Date\(\)\) \{[\s\S]*?\n\}/);
if (!zdroj) { console.log('✗ vehIsNew(datumReg, dnes) som v index.html nenašiel'); process.exit(1); }
const vehIsNew = eval('(' + zdroj[0] + ')');

// [dnes, hranica podľa backendu] — vybrané konce mesiacov, priestupný rok, prelom roka
const HRANICE = [
  ['2026-09-14', '2026-03-14'], ['2026-08-31', '2026-02-28'], ['2026-08-30', '2026-02-28'],
  ['2026-08-29', '2026-02-28'], ['2028-08-31', '2028-02-29'], ['2028-08-29', '2028-02-29'],
  ['2026-03-31', '2025-09-30'], ['2026-10-31', '2026-04-30'], ['2026-12-31', '2026-06-30'],
  ['2026-01-15', '2025-07-15'], ['2027-01-01', '2026-07-01'], ['2029-05-31', '2028-11-30'],
];

let chyby = 0;
const ok = (p, m) => { console.log((p ? '  ✓' : '  ✗') + ' ' + m); if (!p) chyby++; };
const denPred = iso => new Date(Date.parse(iso) - 864e5).toISOString().slice(0, 10);

console.log('hranica = backend datum_z_kotvy("dnes-6m"):');
for (const [dnesIso, hranica] of HRANICE) {
  const [r, m, d] = dnesIso.split('-').map(Number);
  // Poobede — výsledok nesmie závisieť od času dňa (na tom padala stará verzia).
  const dnes = new Date(r, m - 1, d, 14, 30);
  ok(vehIsNew(hranica, dnes) === true && vehIsNew(denPred(hranica), dnes) === false,
     `dnes ${dnesIso}: ${hranica} je nové, ${denPred(hranica)} už nie`);
}

console.log('okrajové vstupy:');
const dnes = new Date(2026, 8, 14, 9, 0);
ok(vehIsNew('', dnes) === false, 'bez dátumu → nie je nové');
ok(vehIsNew('nezmysel', dnes) === false, 'nečitateľný dátum → nie je nové');
ok(vehIsNew('2026-03-14T00:00:00', dnes) === true, 'ISO s časom sa číta ako dátum');

console.log(chyby ? `\nFAIL — ${chyby} chýb` : '\nVŠETKO OK');
process.exit(chyby ? 1 : 0);
