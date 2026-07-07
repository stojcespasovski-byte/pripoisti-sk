# SEO podklad pre pripoisti.sk

> **Zdroj:** backend session (rola „backend manažér"). Toto je **východiskový podklad** — nálezy z rýchlej obhliadky živého webu, nie hotové riešenie.
> **Úloha pripoisti.sk session:** pozri si tieto zistenia, ale **sprav si aj vlastný nezávislý SEO audit** (možno nájdeš viac / iné priority), navrhni ďalšie vylepšenia a **spusti to sám**. Execution + rozhodnutia sú na tebe.
> **Backend ostáva na mne** — ak niečo potrebuješ z API (CORS pre automanager.sk, doc manifest endpoint, presun Pillow za backend), pošli konkrétnu požiadavku.

---

## Verdikt: čo Google vidí dnes

`pripoisti.sk/` je **prázdny „splash"** — len logo na tmavom pozadí, `<title>pripoisti.sk</title>`, žiadny popis, obsah, nadpisy, odkazy. Chýba `robots.txt` aj `sitemap.xml`. Pre vyhľadávač **nie je čo indexovať** → nulová organická viditeľnosť.

**Dobrá správa:** obsah aj dizajn už existujú v repe:
- `stranka.html` = hotová marketingová landing (hero H1, sekcie „prečo/why-head", „Štyri kroky/how-head", cenová ukážka) → kandidát na domovskú stránku.
- `app.html` = appka (title „pripoisti.sk — pripoistenie kedykoľvek", ale bez meta description / OG / canonical; načítava Inter z Google Fonts CDN = render-blocking).
- drafty: `pripoisti.html`, `pripoisti-v2.html`, `4koncepty.html` (riziko indexácie duplicít — vylúčiť).

Brand: gradient `#D63B1F → #E8821A → #F0A500`, tmavá `#111`, off-white `#F7F6F3`.

---

## Nálezy podľa závažnosti

| Nález | Závažnosť | Dopad |
|---|---|---|
| Root = prázdna splash bez obsahu | 🔴 Kritické | Nič sa neindexuje |
| Chýba meta description (index + app) | 🔴 Kritické | Slabý útržok v SERP, nízky CTR |
| Žiadny robots.txt / sitemap.xml | 🔴 Kritické | Pomalá/neúplná indexácia |
| Žiadne Open Graph / Twitter tagy | 🟠 Vysoké | Zdieľanie bez náhľadu |
| Žiadne štruktúrované dáta (JSON-LD) | 🟠 Vysoké | Bez rich results |
| Žiadny canonical / hreflang | 🟠 Vysoké | Duplicity, problém pri CZ expanzii |
| Google Fonts z CDN (render-blocking) | 🟡 Stredné | Horší LCP (Core Web Vitals) |
| Žiadny favicon / webmanifest / theme-color | 🟢 Nízke | Kozmetika |
| Draft súbory v repe | 🟢 Nízke | Riziko duplicít — disallow |

---

## Navrhované poradie (návrh, uprav podľa vlastného auditu)

**P0 — odblokovať indexáciu (~pol dňa)**
- reálny obsah na root (nasadiť `stranka.html` ako domovskú)
- meta vrstva každej stránky: unikátny `title` ≤60 zn., `description` ~155 zn., `canonical`, `html lang`, `meta robots`, `theme-color #D63B1F`
- `robots.txt` + `sitemap.xml`; draft súbory disallow
- Google Search Console — overiť doménu, poslať sitemap

**P1 — viditeľnosť (~1–2 dni)**
- Open Graph + Twitter cards + OG obrázok 1200×630
- JSON-LD: `Organization`, `WebSite` (+SearchAction), `Service`, `FAQPage`
- obsahové sekcie/kotvy na krytia (sklá, stret so zverou, krádež, prírodná udalosť, vandalizmus, asistencia, úraz, batožina)
- self-host Inter (preč z CDN) → lepší LCP
- favicon + webmanifest

**P2 — náskok + expanzia (priebežne)**
- hreflang SK ↔ CZ (viď nižšie)
- blog / rádca na dopytové témy (long-tail)
- interné prelinkovanie landing ↔ krytia ↔ blog ↔ appka
- meranie v Search Console

---

## Kľúčové slová (SK primárne, CZ pre neskôr)

| Téma | SK fráza | CZ ekvivalent | Zámer |
|---|---|---|---|
| Hlavné | pripoistenie vozidla online | připojištění vozidla online | transakčný |
| Sklá | poistenie čelného skla | pojištění čelního skla | transakčný |
| Zver | poistenie proti zrážke so zverou | pojištění střetu se zvěří | transakčný |
| Krádež | pripoistenie krádeže vozidla | připojištění krádeže vozidla | transakčný |
| Živel | poistenie vozidla proti živlom | pojištění vozidla proti živlům | transakčný |
| Doplnok k PZP | doplnkové pripoistenie k PZP | doplňkové připojištění k povinnému ručení | informačný |
| Rádca | koľko stojí výmena čelného skla | kolik stojí výměna čelního skla | long-tail |

---

## Architektúra SK + CZ (hreflang)

Odporúčaný model: samostatná doména `pripoisti.cz`, prepojená hreflang anotáciami (`sk-SK` = x-default, `cs-CZ`). Alternatíva `pripoisti.sk/cz/` je lacnejšia, ale `.cz` dáva silnejší lokálny signál. Rozhodnutie padne pri spustení CZ — hreflang je rovnaký pre oba varianty.

```html
<link rel="alternate" hreflang="sk-SK" href="https://pripoisti.sk/">
<link rel="alternate" hreflang="cs-CZ" href="https://pripoisti.cz/">
<link rel="alternate" hreflang="x-default" href="https://pripoisti.sk/">
<link rel="canonical" href="https://pripoisti.sk/">
```

---

## Technický checklist

**Meta (každá stránka):** unikátny title ≤60 zn. · meta description ~155 zn. · canonical · html lang · meta robots index,follow · theme-color `#D63B1F`
**Social/rich:** og:title/description/url/type · og:image 1200×630 · twitter:card summary_large_image · JSON-LD Organization/WebSite/Service/FAQPage
**Súbory:** robots.txt · sitemap.xml · favicon .ico + apple-touch 180×180 · site.webmanifest · vercel.json (hlavičky, čisté URL)
**Výkon:** self-host Inter · preconnect len na nutné · obrázky width/height + lazy · OG WebP · cieľ LCP < 2,5 s, CLS ≈ 0

### robots.txt (návrh)
```
User-agent: *
Allow: /
Disallow: /pripoisti-v2.html
Disallow: /4koncepty.html
Disallow: /stranka.html

Sitemap: https://pripoisti.sk/sitemap.xml
```

---

## Meranie

| Metrika | Nástroj | Cieľ |
|---|---|---|
| Indexované stránky | Search Console | root + appka do 1–2 tý. |
| Zobrazenia / prekliky | Search Console | rast na cieľové frázy |
| Priemerná pozícia | Search Console | „poistenie čelného skla" → top 10 |
| Core Web Vitals | PageSpeed / CrUX | LCP < 2,5 s, CLS < 0,1 |
| Rich results | Rich Results Test | FAQ + Organization bez chýb |

---

*Podklad je východisko, nie mandát. Over si nálezy vlastným auditom (napr. Lighthouse / PageSpeed / GSC), doplň čo chýba a rozhodni sám.*
