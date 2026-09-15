// Test zoradenia roletiek v modáli (značka, model, farba). Bez závislostí:  node tests/zoradenie.test.mjs
//
// Prečo existuje: klient hľadá v dlhom zozname podľa písmena. Modely a farby sa predtým
// nezoraďovali vôbec (poradie z číselníka — Touareg sa hľadal, Kodiaq Scout nebol pod
// Kodiaq, Čierna bola na konci) a značky podľa slovenských pravidiel, kde je „ch" za „h".
// Pravidlo usera: roletky zoraďovať BEZ diakritiky.
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const vytiahni = meno => {
  const m = html.match(new RegExp('function ' + meno + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
  if (!m) { console.log(`✗ funkciu ${meno} som v index.html nenašiel`); process.exit(1); }
  return m[0];
};
// eslint-disable-next-line no-eval
eval([vytiahni('bezDiakritiky'), vytiahni('porovnajNazvy'), vytiahni('zoradModely')].join('\n')
     + '\nglobalThis.t = { porovnajNazvy, zoradModely };');
const { porovnajNazvy, zoradModely } = globalThis.t;

let chyby = 0;
const ok = (p, m) => { console.log((p ? '  ✓' : '  ✗') + ' ' + m); if (!p) chyby++; };
const pred = (arr, a, b) => arr.indexOf(a) >= 0 && arr.indexOf(a) < arr.indexOf(b);

console.log('farby (bez diakritiky):');
const farby = ['ŽLTÁ', 'ČIERNA', 'BIELA', 'ČERVENÁ', 'MODRÁ', 'CYAN', 'ZELENÁ'].sort(porovnajNazvy);
ok(pred(farby, 'ČERVENÁ', 'ČIERNA') && pred(farby, 'ČIERNA', 'CYAN'), `Čierna medzi C: ${farby.join(', ')}`);
ok(farby[farby.length - 1] === 'ŽLTÁ', 'Žltá (Z) na konci, nie Čierna');

console.log('značky:');
const znacky = ['Hyundai', 'Chevrolet', 'Citroën', 'Škoda', 'Seat', 'BMW', 'alfa romeo'].sort(porovnajNazvy);
ok(pred(znacky, 'Chevrolet', 'Hyundai'), 'Chevrolet pred Hyundai („ch" nie je za „h")');
ok(pred(znacky, 'Seat', 'Škoda'), 'Škoda medzi S, za Seat');
ok(znacky[0] === 'alfa romeo', 'veľkosť písmen nerozhoduje');

console.log('modely:');
const m = zoradModely([['1', 'Superb'], ['2', 'Ostatní'], ['3', 'Kodiaq Scout'], ['4', '=C1882'],
                       ['5', 'Kodiaq'], ['6', '105'], ['7', 'Karoq'], ['8', 'T10'], ['9', 'T5']]).map(x => x[1]);
ok(m.indexOf('Kodiaq Scout') === m.indexOf('Kodiaq') + 1, `Kodiaq Scout hneď pod Kodiaq: ${m.join(', ')}`);
ok(pred(m, 'Karoq', 'Kodiaq'), 'Karoq pred Kodiaq');
ok(pred(m, 'T5', 'T10'), 'čísla prirodzene: T5 pred T10');
ok(m[0] === '105', 'číselné modely na začiatku');
ok(m[m.length - 1] === 'Ostatní', 'zberné „Ostatní" na konci');
ok(m[m.length - 2] === '=C1882', 'pokazený názov z číselníka pred „Ostatní", nie navrchu');
const ids = zoradModely([['7', 'B'], ['3', 'A']]).map(x => x[0]);
ok(ids.join() === '3,7', 'id modelu ide spolu s názvom');

console.log(chyby ? `\nFAIL — ${chyby} chýb` : '\nVŠETKO OK');
process.exit(chyby ? 1 : 0);
