# @weboldaltmost/astro-kit

Közös komponensek minden WeboldaltMost Astro-oldalhoz.

## Telepítés egy oldalba

Amíg nincs npm-re publikálva, GitHubról telepíthető (privát repóból is, ha van hozzáférés):

```bash
npm install github:weboldaltmost/astro-kit
```

vagy helyben fejlesztéshez:

```bash
npm install ../weboldaltmost-platform/astro-kit
```

## Használat

```astro
---
import ContactForm from '@weboldaltmost/astro-kit/ContactForm.astro';
import CreditBar from '@weboldaltmost/astro-kit/CreditBar.astro';
---

<ContactForm formId="01jxxxxxxxxxxxxxxxxxxxxxxx" />

<!-- a layout legaljára -->
<CreditBar />
```

Az űrlap azonosítóját az admin felületen, az űrlap szerkesztésénél, a
„Beépítés a weboldalba” résznél találod.

## Beállítás

A platform címe alapból `https://app.weboldaltmost.hu`. Egy oldalon (pl. helyi
teszthez) a `.env`-ben felülírható:

```
PUBLIC_WM_API_URL=http://localhost:8000
```

A közös értékek (márkanév, credit szöveg, szín) a `src/config.ts`-ben vannak.

## Űrlapok élő frissítése (0.5.0-tól)

A `ContactForm` build közben statikus HTML-t készít, de oldalbetöltéskor megnézi a platformon az
űrlap aktuális változatát (`version`). Ha az ügyfél azóta módosította a panelen (új mező, átírt kérdés),
a friss változatot tölti be a beágyazható szkripttel – újraépítés nélkül, kb. 1 percen belül.
Ha a látogató már elkezdte kitölteni, nem cseréli ki alóla. Új mezőtípusok: szám, dátum,
egy- és többválasztós (radio / jelölőnégyzetek), cím (szakaszcím), súgószöveg, fél szélesség.

A frissítés a 0.4.0-s kit-tel épült oldalakon még nem működik: egyszer frissítsd a csomagot és építsd újra az oldalt.

## Időpontfoglalás

```astro
---
import BookingWidget from '@weboldaltmost/astro-kit/BookingWidget.astro';
---

<BookingWidget client="kovacs-festes" />
<!-- előre kiválasztott szolgáltatással: -->
<BookingWidget client="kovacs-festes" service="helyszini-felmeres" />
```

A widget a platformról töltődik be, így a javítások build nélkül megjelennek.
A kinézet az oldal CSS-ében állítható:

```css
.wmb-root {
  --bk-accent: #c2410c;
  --bk-font: 'Poppins', sans-serif;
  --bk-radius: 6px;
}
```