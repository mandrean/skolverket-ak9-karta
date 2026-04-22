# Skolverket åk 9-karta – statiska JSON-filer + karta

<img width="2246" height="1498" alt="image" src="https://github.com/user-attachments/assets/65d4de5e-cea1-4b5f-9c76-0efa97aec86e" />

Den här versionen är uppdelad i två tydliga delar:

1. **Byggläge**: hämtar data från Skolverkets API, filtrerar fram grundskolor med slutbetyg/meritvärde i åk 9 och skriver en JSON-fil per region.
2. **Kartapp**: läser bara de färdiga JSON-filerna och plottar skolorna. Den gör inga anrop till Skolverket.

Det gör att Skolverket bara kontaktas när du aktivt kör om databygget.

## 1. Bygg JSON-filerna

```bash
npm run build:data
```

Default bygger Region Stockholm och skriver filen här:

```text
public/data/stockholm-grade9-schools.json
```

Bygg båda regionerna:

```bash
npm run build:data:all
```

Eller bygg dem separat:

```bash
npm run build:data:stockholm
npm run build:data:vastra-gotaland
```

Filerna som kartan läser är:

```text
public/data/stockholm-grade9-schools.json
public/data/vastra-gotaland-grade9-schools.json
```

JSON-filen har formen:

```json
{
  "schemaVersion": 2,
  "generatedAt": "2026-04-21T00:00:00.000Z",
  "source": { "name": "Skolverket Planned educations API" },
  "scope": {
    "region": {
      "id": "stockholm",
      "name": "Stockholm",
      "fullName": "Region Stockholm"
    },
    "municipalities": []
  },
  "metadata": { "complete": true },
  "schools": [
    {
      "schoolUnitCode": "86597125",
      "name": "Hässelby Villastads skola",
      "municipalityCode": "0180",
      "municipality": "Stockholm",
      "regionId": "stockholm",
      "region": "Stockholm",
      "lat": 59.3839,
      "lng": 17.8398,
      "typeOfSchool": "Grundskola",
      "averageMeritGrade9": 255.5,
      "averageMeritGrade9Label": "255,5",
      "utbildningsguidenUrl": "https://utbildningsguiden.skolverket.se/skolenhet?schoolUnitID=86597125"
    }
  ]
}
```

### Testa på en eller några kommuner

```bash
MUNICIPALITY_CODES=0180 npm run build:data
MUNICIPALITY_CODES=0180,0182 npm run build:data
REGION=vastra-gotaland MUNICIPALITY_CODES=1480 npm run build:data
```

### Skriv till annan fil

```bash
OUT_FILE=tmp/skolor.json npm run build:data
```

### Tvinga omhämtning trots HTTP-cache

```bash
FORCE_HTTP_REFRESH=1 npm run build:data
```

### Offline-demo

```bash
npm run build:data:sample
```

## 2. Starta kartappen

```bash
npm start
```

Öppna sedan:

```text
http://localhost:5173
```

Kartan läser de lokala JSON-filerna i `public/data/`. Regionfiltret väljer vilken fil som laddas. Knappen **Ladda om JSON** läser bara om vald lokal fil; den kontaktar inte Skolverket.

## 3. Publicera med GitHub Pages

Appen är förberedd för projekt-URL:

```text
https://mandrean.github.io/skolverket-ak9-karta/
```

GitHub Actions-workflowen i `.github/workflows/pages.yml` publicerar innehållet i `public/` till GitHub Pages när ändringar pushas till `master` eller `main`, och kan också köras manuellt från Actions-fliken.

Första gången behöver repositoryt ha Pages-källan satt till **GitHub Actions** under:

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

Alla appens lokala resurser laddas med relativa sökvägar (`styles.css`, `app.js`, `data/...`) så den fungerar både lokalt och under `/skolverket-ak9-karta/`.

## Hur Skolverket-anropen begränsas

All logik för externa anrop ligger i `scripts/build-data.mjs`:

- kommuner hanteras sekventiellt,
- skolenheter hämtas sida för sida,
- alla externa API-anrop går genom en throttlad kö med minst `API_MIN_DELAY_MS` mellan anrop,
- statistik hämtas i batchar (`STAT_BATCH_SIZE`) med paus mellan batchar (`STAT_BATCH_PAUSE_MS`),
- råa API-svar cachas i `.cache/http/*.json`,
- delresultat skrivs till JSON-filen efter varje kommun.

Defaultinställningar finns i `.env.example`.
Nuvarande default är `API_MIN_DELAY_MS=250`, `STAT_BATCH_SIZE=100` och `STAT_BATCH_PAUSE_MS=250`. Det ger snabbare byggning men behåller en global throttle mellan externa anrop.

## Datakälla och filtrering

Byggkommandot hämtar grundskoleenheter kommunvis i vald region och försöker därefter hämta statistik för respektive skolenhet. Endast skolenheter där statistiksvaret innehåller genomsnittligt meritvärde för åk 9 skrivs till `schools`. F–6-skolor faller därför bort automatiskt eftersom de saknar åk 9-meritvärde.

Skolurvalet använder `/v4/school-units` med `geographicalAreaCode`, `typeOfSchooling=gr` och `schoolYears=9`. Den kompakta endpointen `/compact-school-units` används inte för kommunurval eftersom den inte stödjer kommunfilter i Swagger-specifikationen.

Koordinater valideras dessutom mot ett grovt bounds-intervall för vald region. Det skyddar kartan mot enstaka felaktiga WGS84-koordinater i källsvaret.

## Felsök statistikrespons

Skolverkets statistikstruktur kan ändras. Extraktionen av meritvärde är därför tolerant och letar efter fält/texter som liknar `Åk 9: Genomsnittligt meritvärde`, `meritvärde`, `average merit` och liknande.

Spara råa statistikresponser så här:

```bash
SAVE_RAW_STATISTICS=1 npm run build:data
```

Då hamnar exempel i:

```text
.cache/raw-statistics/
```

Om meritvärden inte hittas kan du öppna dessa filer och justera `extractMeritValueFromStatistics()` i `scripts/build-data.mjs`.

## Filöversikt

- `scripts/build-data.mjs` – hämta från Skolverket, cache, batchning, paginering, meritextraktion och JSON-skrivning.
- `public/data/stockholm-grade9-schools.json` – statisk datafil för Region Stockholm.
- `public/data/vastra-gotaland-grade9-schools.json` – statisk datafil för Västra Götalandsregionen.
- `server.mjs` – enkel statisk server; gör inga Skolverket-anrop.
- `public/index.html` – frontend.
- `public/app.js` – Leaflet-karta, filter och popup.
- `public/styles.css` – UI och markörer.
- `.github/workflows/pages.yml` – publicerar `public/` till GitHub Pages.
