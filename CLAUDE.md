# pripoisti.sk — frontend (CLAUDE.md)

Verejná appka na pripoistenie vozidiel (9 pripoistení k existujúcemu PZP/havarku).
**Toto repo je PUBLIC — nikdy sem nedávaj tajomstvá** (credentials, API kľúče, heslá). Všetka autentifikácia voči Pillow/BCRM žije na backende.

## Rozsah tejto codebase
- Táto session/repo = **len frontend** (`pripoisti-sk`). Backend `api.pripoisti.sk` (repo `pripoisti-api`, privátne, FastAPI/Hetzner) vlastní iná session — zmeny backendu (nový endpoint, CORS, e-mail šablóny) NEROBIŤ tu, ale sformulovať ako požiadavku pre backend.
- Súbory: `app.html` (Krok 1+2: vstupy, dlaždice, ceny), `app-step3.html` (údaje klienta, 4 varianty FO/cudzinec/SZČO/PO), `app-step4.html` (súhrn + Pillow save + platba/QR/e-mail), `index.html` (splash — **NEMENIŤ**), `radca/` (SEO články + rozcestník), `vercel.json` (clean URLs len pre /radca — funnel nedotknutý).

## Nasadenie
- Hosting = **Vercel** (nie Caddy!). Deploy = `git push origin main` → auto. Overenie: `curl -s https://pripoisti.sk/app.html | grep "<niečo z commitu>"`.
- Workflow s používateľom: **krok po kroku** — malá zmena → lokálny commit (záchytný bod) → ukázať → push **až po jeho súhlase** („ano / nasaď"). Kalkulačka býva v živom teste u poisťovne — nič nerozbiť, žiadne veľké big-bang refaktory.
- GSC overovací súbor `google9ce749cdaf7d33ed.html` v roote **nikdy nemazať**.

## Dizajn (tvrdé pravidlá)
- Farby/typografia/rámiky/zaoblenia sú **naše**: akcent `--o #E8821A`, pozadie `--dark #111`, panely `rgba(255,255,255,.03–.04)` / `#1b1b1b`, radius 8–14px, font **Inter**. Z cudzích mockupov sa preberá len layout/nápad, nikdy farby.
- Hierarchia sýtosti: plnou oranžovou svieti **len** fajka vybranej dlaždice, vybraná frekvencia a hlavné CTA „Pripoistím sa teraz". Vybrané dlaždice majú jemný rámik `rgba(232,130,26,.4)`; nav „Začať teraz" je obrysové.
- Dropdown „Spôsob užívania" má aktívne ošatenie ako zvolená pilulka (oranžový rámik + tint) — vždy zobrazuje voľbu.
- Spodná cenová lišta: od okraja po okraj, bg `#1b1b1b` + teplý nádych `rgba(232,130,26,.06)` + horná 1px linka `rgba(255,255,255,.1)`, bez tieňa a zaoblení.
- Stated obmedzenie používateľa (napr. „nezväčšovať stránku") = tvrdé pravidlo od prvého návrhu.

## Mobil
- ≤720px: parametre (su-switch) jednostĺpcové, ovládač sa zalamuje POD otázku; poradie na mobile cez CSS `order` (užívanie → spoluúčasť → servis → garáž), desktop DOM poradie nemeniť.
- Číselné polia majú `inputmode` (tel/numeric) — pri nových poliach dodržať.
- Pozor na kolíziu kaskády: globálny blok „Kompaktný quote screen" (`.hero{padding:84px...}`) je v zdroji NESKÔR než mobilné media queries — mobilné override musia byť až ZA ním.
- Po zmenách vždy overiť `document.documentElement.scrollWidth == clientWidth` na 375px (nič nesmie pretekať).

## Technické poznámky
- Dáta tečú: Krok1 `order` objekt → `localStorage 'pripoisti_order'` → step3 → step4 (save robí čerstvý rate+save, calcId sa neprenáša).
- Dlaždica nesie 1+ Pillow rizík (`TILE_RISKS`); Havária = HP2+SZ2 (Pillow vyžaduje spolu), samostatná „zver" sa pri Havárii deaktivuje. Spoluúčasť jednotná pre HP2/SZ2/OV2/ZV2/VA2 (150/300/600, default 300).
- Pillow rate vracia ceny všetkých variantov naraz → prepínanie variantov/spoluúčasti/frekvencie bez ďalších API volaní.
- Sekcia dlaždíc + parametre sú `wow-hidden` (display:none) do prvého lookupu.
- Vývojový soft-gate: app.html vyžaduje `sessionStorage 'pripoisti_access'` (viditeľný v zdrojáku, nie je to ochrana). V preview ho nastav pred navigáciou.
- Preview screenshoty app.html občas glitchujú (čierna) — overuj cez computed styles / getBoundingClientRect, nie len okom.

## /radca (SEO články)
- Písané jazykom zákazníka (nie „výhody produktu"), E-E-A-T podpis redakcie na konci; moto články majú moto-špecifický box. Krytie rizík overovať proti VPP (pozor: krádež častí + pokus = Vandalizmus, nie Krádež; kuna = Stret so zverou; Úraz kryje len vodiča… pri pochybnosti si vyžiadať VPP).
- Clean URL rewrite/redirect rieši `vercel.json`; nové články doplniť do `sitemap.xml`.
