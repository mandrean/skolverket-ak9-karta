#!/usr/bin/env node
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const env = (name, fallback) => process.env[name] ?? fallback;
const envNumber = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};
const envBool = (name, fallback = false) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'ja', 'on'].includes(String(raw).toLowerCase());
};

const STOCKHOLM_MUNICIPALITIES = [
  { code: '0114', name: 'Upplands Väsby' },
  { code: '0115', name: 'Vallentuna' },
  { code: '0117', name: 'Österåker' },
  { code: '0120', name: 'Värmdö' },
  { code: '0123', name: 'Järfälla' },
  { code: '0125', name: 'Ekerö' },
  { code: '0126', name: 'Huddinge' },
  { code: '0127', name: 'Botkyrka' },
  { code: '0128', name: 'Salem' },
  { code: '0136', name: 'Haninge' },
  { code: '0138', name: 'Tyresö' },
  { code: '0139', name: 'Upplands-Bro' },
  { code: '0140', name: 'Nykvarn' },
  { code: '0160', name: 'Täby' },
  { code: '0162', name: 'Danderyd' },
  { code: '0163', name: 'Sollentuna' },
  { code: '0180', name: 'Stockholm' },
  { code: '0181', name: 'Södertälje' },
  { code: '0182', name: 'Nacka' },
  { code: '0183', name: 'Sundbyberg' },
  { code: '0184', name: 'Solna' },
  { code: '0186', name: 'Lidingö' },
  { code: '0187', name: 'Vaxholm' },
  { code: '0188', name: 'Norrtälje' },
  { code: '0191', name: 'Sigtuna' },
  { code: '0192', name: 'Nynäshamn' },
];

const VASTRA_GOTALAND_MUNICIPALITIES = [
  { code: '1401', name: 'Härryda' },
  { code: '1402', name: 'Partille' },
  { code: '1407', name: 'Öckerö' },
  { code: '1415', name: 'Stenungsund' },
  { code: '1419', name: 'Tjörn' },
  { code: '1421', name: 'Orust' },
  { code: '1427', name: 'Sotenäs' },
  { code: '1430', name: 'Munkedal' },
  { code: '1435', name: 'Tanum' },
  { code: '1438', name: 'Dals-Ed' },
  { code: '1439', name: 'Färgelanda' },
  { code: '1440', name: 'Ale' },
  { code: '1441', name: 'Lerum' },
  { code: '1442', name: 'Vårgårda' },
  { code: '1443', name: 'Bollebygd' },
  { code: '1444', name: 'Grästorp' },
  { code: '1445', name: 'Essunga' },
  { code: '1446', name: 'Karlsborg' },
  { code: '1447', name: 'Gullspång' },
  { code: '1452', name: 'Tranemo' },
  { code: '1460', name: 'Bengtsfors' },
  { code: '1461', name: 'Mellerud' },
  { code: '1462', name: 'Lilla Edet' },
  { code: '1463', name: 'Mark' },
  { code: '1465', name: 'Svenljunga' },
  { code: '1466', name: 'Herrljunga' },
  { code: '1470', name: 'Vara' },
  { code: '1471', name: 'Götene' },
  { code: '1472', name: 'Tibro' },
  { code: '1473', name: 'Töreboda' },
  { code: '1480', name: 'Göteborg' },
  { code: '1481', name: 'Mölndal' },
  { code: '1482', name: 'Kungälv' },
  { code: '1484', name: 'Lysekil' },
  { code: '1485', name: 'Uddevalla' },
  { code: '1486', name: 'Strömstad' },
  { code: '1487', name: 'Vänersborg' },
  { code: '1488', name: 'Trollhättan' },
  { code: '1489', name: 'Alingsås' },
  { code: '1490', name: 'Borås' },
  { code: '1491', name: 'Ulricehamn' },
  { code: '1492', name: 'Åmål' },
  { code: '1493', name: 'Mariestad' },
  { code: '1494', name: 'Lidköping' },
  { code: '1495', name: 'Skara' },
  { code: '1496', name: 'Skövde' },
  { code: '1497', name: 'Hjo' },
  { code: '1498', name: 'Tidaholm' },
  { code: '1499', name: 'Falköping' },
];

const HALLAND_MUNICIPALITIES = [
  { code: '1315', name: 'Hylte' },
  { code: '1380', name: 'Halmstad' },
  { code: '1381', name: 'Laholm' },
  { code: '1382', name: 'Falkenberg' },
  { code: '1383', name: 'Varberg' },
  { code: '1384', name: 'Kungsbacka' },
];

const REGION_CONFIGS = {
  stockholm: {
    id: 'stockholm',
    name: 'Stockholm',
    fullName: 'Region Stockholm',
    dataFile: 'public/data/stockholm-grade9-schools.json',
    sampleFile: 'fixtures/sample-stockholm-grade9-schools.json',
    municipalities: STOCKHOLM_MUNICIPALITIES,
    coordinateBounds: {
      minLat: 58.75,
      maxLat: 60.25,
      minLng: 17.0,
      maxLng: 19.2,
    },
  },
  'vastra-gotaland': {
    id: 'vastra-gotaland',
    name: 'Västra Götaland',
    fullName: 'Västra Götalandsregionen',
    dataFile: 'public/data/vastra-gotaland-grade9-schools.json',
    sampleFile: 'fixtures/sample-vastra-gotaland-grade9-schools.json',
    municipalities: VASTRA_GOTALAND_MUNICIPALITIES,
    coordinateBounds: {
      minLat: 57.0,
      maxLat: 59.45,
      minLng: 10.7,
      maxLng: 14.8,
    },
  },
  halland: {
    id: 'halland',
    name: 'Halland',
    fullName: 'Region Halland',
    dataFile: 'public/data/halland-grade9-schools.json',
    sampleFile: 'fixtures/sample-halland-grade9-schools.json',
    municipalities: HALLAND_MUNICIPALITIES,
    coordinateBounds: {
      minLat: 56.25,
      maxLat: 57.85,
      minLng: 11.65,
      maxLng: 13.75,
    },
  },
};

const REGION_ALIASES = new Map([
  ['stockholm', 'stockholm'],
  ['region-stockholm', 'stockholm'],
  ['sthlm', 'stockholm'],
  ['vastra-gotaland', 'vastra-gotaland'],
  ['västra-götaland', 'vastra-gotaland'],
  ['vastra gotaland', 'vastra-gotaland'],
  ['västra götaland', 'vastra-gotaland'],
  ['vgr', 'vastra-gotaland'],
  ['vg', 'vastra-gotaland'],
  ['halland', 'halland'],
  ['region-halland', 'halland'],
]);

function normalizeRegionId(raw) {
  const normalized = String(raw || 'stockholm')
    .trim()
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/_/g, '-');
  return REGION_ALIASES.get(normalized) ?? normalized;
}

const selectedRegionId = normalizeRegionId(env('REGION', 'stockholm'));
const SELECTED_REGION = REGION_CONFIGS[selectedRegionId];

if (!SELECTED_REGION) {
  console.error(`Okänd REGION=${env('REGION', '')}. Välj en av: ${Object.keys(REGION_CONFIGS).join(', ')}`);
  process.exit(1);
}

const CONFIG = {
  plannedBaseUrl: env('SKOLVERKET_PLANNED_BASE_URL', 'https://api.skolverket.se/planned-educations').replace(/\/$/, ''),
  cacheDir: path.resolve(ROOT_DIR, env('CACHE_DIR', '.cache')),
  outFile: path.resolve(ROOT_DIR, env('OUT_FILE', SELECTED_REGION.dataFile)),
  httpCacheTtlMs: envNumber('HTTP_CACHE_TTL_MS', 7 * 24 * 60 * 60 * 1000),
  forceHttpRefresh: envBool('FORCE_HTTP_REFRESH', false),
  apiMinDelayMs: envNumber('API_MIN_DELAY_MS', 250),
  requestTimeoutMs: envNumber('REQUEST_TIMEOUT_MS', 30_000),
  pageSize: envNumber('PAGE_SIZE', 50),
  maxPagesPerMunicipality: envNumber('MAX_PAGES_PER_MUNICIPALITY', 40),
  statBatchSize: envNumber('STAT_BATCH_SIZE', 100),
  statBatchPauseMs: envNumber('STAT_BATCH_PAUSE_MS', 250),
  saveRawStatistics: envBool('SAVE_RAW_STATISTICS', false),
  useSampleData: envBool('USE_SAMPLE_DATA', false),
  municipalityCodes: env('MUNICIPALITY_CODES', '').split(',').map((x) => x.trim()).filter(Boolean),
};

const HTTP_CACHE_DIR = path.join(CONFIG.cacheDir, 'http');
const RAW_STATS_DIR = path.join(CONFIG.cacheDir, 'raw-statistics');
const ACCEPT_V4 = 'application/vnd.skolverket.plannededucations.api.v4.hal+json';
const ACCEPT_V3 = 'application/vnd.skolverket.plannededucations.api.v3.hal+json';

const MUNICIPALITIES = CONFIG.municipalityCodes.length
  ? SELECTED_REGION.municipalities.filter((m) => CONFIG.municipalityCodes.includes(m.code))
  : SELECTED_REGION.municipalities;

if (CONFIG.municipalityCodes.length && MUNICIPALITIES.length === 0) {
  console.error(`Inga matchande kommuner i ${SELECTED_REGION.fullName} för MUNICIPALITY_CODES=${CONFIG.municipalityCodes.join(',')}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();
const log = (...args) => console.log(`[${new Date().toLocaleTimeString('sv-SE')}]`, ...args);

async function ensureDirs() {
  await mkdir(CONFIG.cacheDir, { recursive: true });
  await mkdir(HTTP_CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(CONFIG.outFile), { recursive: true });
  if (CONFIG.saveRawStatistics) await mkdir(RAW_STATS_DIR, { recursive: true });
}

async function readJsonFile(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeJsonFile(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  try { await unlink(tmp); } catch {}
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function isCacheFresh(cacheDoc, ttlMs) {
  if (!cacheDoc?.generatedAt) return false;
  const age = Date.now() - Date.parse(cacheDoc.generatedAt);
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
}

function buildUrl(base, query) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

let apiQueue = Promise.resolve();
let nextApiSlot = 0;
let apiCallsThisBuild = 0;
const inFlightHttp = new Map();

async function throttledNetworkCall(fn) {
  const task = apiQueue.then(async () => {
    const waitMs = Math.max(0, nextApiSlot - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    nextApiSlot = Date.now() + CONFIG.apiMinDelayMs;
    return fn();
  });
  apiQueue = task.catch(() => undefined);
  return task;
}

async function fetchJsonWithTimeout(url, { headers }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      const snippet = text.slice(0, 300).replace(/\s+/g, ' ');
      const error = new Error(`HTTP ${response.status}: ${snippet}`);
      error.status = response.status;
      throw error;
    }
    if (!text.trim()) return null;
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function cachedApiGet(url, acceptHeader) {
  const headers = {
    Accept: acceptHeader,
    'User-Agent': 'skolverket-ak9-karta/0.2 local-build',
  };
  const cacheKey = sha256(stableStringify({ method: 'GET', url, acceptHeader }));
  const cacheFile = path.join(HTTP_CACHE_DIR, `${cacheKey}.json`);

  if (!CONFIG.forceHttpRefresh) {
    const cached = await readJsonFile(cacheFile);
    if (cached && isCacheFresh(cached, CONFIG.httpCacheTtlMs)) {
      return { json: cached.json, fromCache: true, url };
    }
  }

  if (inFlightHttp.has(cacheKey)) return inFlightHttp.get(cacheKey);

  const promise = throttledNetworkCall(async () => {
    apiCallsThisBuild += 1;
    const json = await fetchJsonWithTimeout(url, { headers });
    await writeJsonFile(cacheFile, { generatedAt: nowIso(), url, acceptHeader, json });
    return { json, fromCache: false, url };
  }).finally(() => inFlightHttp.delete(cacheKey));

  inFlightHttp.set(cacheKey, promise);
  return promise;
}

function unwrapBody(value) {
  let current = value;
  for (let i = 0; i < 4; i += 1) {
    if (current && typeof current === 'object' && 'body' in current && current.body !== undefined) current = current.body;
    else break;
  }
  return current;
}

function firstArrayAtKnownKeys(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) return obj;
  for (const key of keys) if (Array.isArray(obj[key])) return obj[key];
  if (obj._embedded && typeof obj._embedded === 'object') {
    for (const key of keys) if (Array.isArray(obj._embedded[key])) return obj._embedded[key];
    for (const value of Object.values(obj._embedded)) if (Array.isArray(value)) return value;
  }
  if (obj.data?.attributes && Array.isArray(obj.data.attributes)) return obj.data.attributes;
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.data)) return obj.data;
  return null;
}

function extractSchoolUnits(json) {
  const root = unwrapBody(json);
  return firstArrayAtKnownKeys(root, [
    'compactSchoolUnits',
    'schoolUnits',
    'listedSchoolUnits',
    'listedCompactSchoolUnits',
    'content',
  ]);
}

function extractPageInfo(json) {
  const root = unwrapBody(json);
  return root?.page || root?.metadata?.page || root?.pagination || null;
}

function hasNextLink(json) {
  const root = unwrapBody(json);
  return Boolean(root?._links?.next?.href || root?.links?.next?.href || root?.next);
}

function parseNumberLoose(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /data saknas|för litet|for litet|saknas|^-$/i.test(trimmed)) return null;
  const normalized = trimmed.replace(/\s/g, '').replace(/−/g, '-').replace(',', '.');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function getFirst(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function getNestedFirst(obj, keys) {
  for (const key of keys) {
    if (!key.includes('.')) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && value !== '') return value;
      continue;
    }
    let current = obj;
    for (const part of key.split('.')) current = current?.[part];
    if (current !== undefined && current !== null && current !== '') return current;
  }
  return undefined;
}

function parseCoordinate(value) {
  return parseNumberLoose(value);
}

function isWithinRegionBounds(lat, lng) {
  const bounds = SELECTED_REGION.coordinateBounds;
  return lat >= bounds.minLat
    && lat <= bounds.maxLat
    && lng >= bounds.minLng
    && lng <= bounds.maxLng;
}

function schoolUnitCodeFromRaw(raw) {
  return String(getFirst(raw, ['schoolUnitCode', 'schoolUnitId', 'schoolUnitID', 'code', 'id']) ?? '').trim();
}

function typeOfSchoolLabel(raw) {
  const value = getFirst(raw, ['typeOfSchool', 'schoolType', 'schoolTypes', 'typeOfSchooling']);
  if (Array.isArray(value)) {
    const grundskola = value.find((item) => String(item?.code ?? '').toLowerCase() === 'gr');
    if (grundskola?.displayName) return String(grundskola.displayName);
    const first = value.find((item) => item?.displayName);
    if (first?.displayName) return String(first.displayName);
    return 'Grundskola';
  }
  return String(value ?? 'Grundskola').trim();
}

function normalizeSchoolUnit(raw, municipalityFallback) {
  const schoolUnitCode = schoolUnitCodeFromRaw(raw);
  const name = String(getFirst(raw, ['schoolUnitName', 'name', 'title', 'unitName']) ?? '').trim();
  const lat = parseCoordinate(getNestedFirst(raw, ['wgs84Latitude', 'wgs84_Lat', 'latitude', 'lat', 'y', 'coordinateLatitude', 'coordinates.latitude']));
  const lng = parseCoordinate(getNestedFirst(raw, ['wgs84Longitude', 'wgs84_Long', 'longitude', 'lng', 'lon', 'x', 'coordinateLongitude', 'coordinates.longitude']));
  const municipalityCode = String(getFirst(raw, ['municipalityCode', 'geographicalAreaCode']) ?? municipalityFallback.code).trim();
  const municipality = String(getFirst(raw, ['municipality', 'municipalityName', 'geographicalArea']) ?? municipalityFallback.name).trim();
  const typeOfSchool = typeOfSchoolLabel(raw);

  if (!schoolUnitCode || !name) return null;
  if (raw.abroadSchool === true) return null;
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (!isWithinRegionBounds(lat, lng)) return null;
  if (municipalityCode && municipalityCode !== municipalityFallback.code) return null;

  return {
    schoolUnitCode,
    name,
    municipalityCode,
    municipality,
    regionId: SELECTED_REGION.id,
    region: SELECTED_REGION.name,
    typeOfSchool,
    lat,
    lng,
  };
}

const unitEndpointCandidates = [
  {
    label: 'v4 school-units',
    accept: ACCEPT_V4,
    path: '/v4/school-units',
    detailPath: (code) => `/v4/school-units/${encodeURIComponent(code)}`,
    query: (m, page) => ({ page, size: CONFIG.pageSize, geographicalAreaCode: m.code, typeOfSchooling: 'gr', schoolYears: 9, coordinateSystemType: 'WGS84' }),
  },
  {
    label: 'v3 school-units',
    accept: ACCEPT_V3,
    path: '/v3/school-units',
    detailPath: (code) => `/v3/school-units/${encodeURIComponent(code)}`,
    query: (m, page) => ({ page, size: CONFIG.pageSize, geographicalAreaCode: m.code, typeOfSchooling: 'gr', schoolYears: 9, coordinateSystemType: 'WGS84' }),
  },
];

const statsEndpointCandidates = [
  {
    label: 'v4 statistics/gr',
    accept: ACCEPT_V4,
    path: (code) => `/v4/school-units/${encodeURIComponent(code)}/statistics/gr`,
    query: () => ({}),
  },
  {
    label: 'v3 school-unit statistics',
    accept: ACCEPT_V3,
    path: (code) => `/v3/school-units/${encodeURIComponent(code)}/statistics`,
    query: () => ({ schoolType: 'GR' }),
  },
];

let chosenUnitEndpoint = null;
let chosenStatsEndpoint = null;

async function fetchSchoolUnitsPage(municipality, page) {
  const candidates = chosenUnitEndpoint ? [chosenUnitEndpoint] : unitEndpointCandidates;
  const errors = [];
  for (const candidate of candidates) {
    const url = buildUrl(`${CONFIG.plannedBaseUrl}${candidate.path}`, candidate.query(municipality, page));
    try {
      const result = await cachedApiGet(url, candidate.accept);
      const items = extractSchoolUnits(result.json);
      const pageInfo = extractPageInfo(result.json);
      if (Array.isArray(items) || pageInfo) {
        chosenUnitEndpoint = candidate;
        return { ...result, items: items ?? [], pageInfo, label: candidate.label };
      }
      errors.push(`${candidate.label}: okänd responsstruktur`);
    } catch (err) {
      errors.push(`${candidate.label}: ${err.message}`);
    }
  }
  throw new Error(`Kunde inte hämta skolenheter för ${municipality.name}: ${errors.join(' | ')}`);
}

async function fetchSchoolUnitDetails(raw, municipality) {
  const schoolUnitCode = schoolUnitCodeFromRaw(raw);
  if (!schoolUnitCode || !chosenUnitEndpoint?.detailPath) return null;
  const url = `${CONFIG.plannedBaseUrl}${chosenUnitEndpoint.detailPath(schoolUnitCode)}`;
  const result = await cachedApiGet(url, chosenUnitEndpoint.accept);
  const detail = unwrapBody(result.json);
  return normalizeSchoolUnit({ ...raw, ...detail }, municipality);
}

async function fetchAllSchoolUnitsForMunicipality(municipality) {
  const listedUnits = [];
  const seen = new Set();

  for (let page = 0; page < CONFIG.maxPagesPerMunicipality; page += 1) {
    const { json, items, pageInfo, label, fromCache } = await fetchSchoolUnitsPage(municipality, page);
    log(`${municipality.name}: sida ${page + 1}, ${items.length} skolenheter (${label}${fromCache ? ', cache' : ''})`);

    for (const raw of items) {
      const schoolUnitCode = schoolUnitCodeFromRaw(raw);
      if (!schoolUnitCode || seen.has(schoolUnitCode)) continue;
      seen.add(schoolUnitCode);
      listedUnits.push(raw);
    }

    const totalPages = Number(pageInfo?.totalPages);
    if (Number.isFinite(totalPages) && page + 1 >= totalPages) break;
    if (!Number.isFinite(totalPages) && items.length < CONFIG.pageSize && !hasNextLink(json)) break;
    if (items.length === 0 && !hasNextLink(json)) break;
  }

  const units = [];
  for (const raw of listedUnits) {
    const normalized = await fetchSchoolUnitDetails(raw, municipality);
    if (normalized) units.push(normalized);
  }
  return units;
}

async function fetchStatsForSchoolUnit(schoolUnitCode) {
  const candidates = chosenStatsEndpoint ? [chosenStatsEndpoint] : statsEndpointCandidates;
  const errors = [];
  for (const candidate of candidates) {
    const url = buildUrl(`${CONFIG.plannedBaseUrl}${candidate.path(schoolUnitCode)}`, candidate.query());
    try {
      const result = await cachedApiGet(url, candidate.accept);
      chosenStatsEndpoint = candidate;
      return { ...result, label: candidate.label };
    } catch (err) {
      errors.push(`${candidate.label}: ${err.message}`);
    }
  }
  const error = new Error(errors.join(' | '));
  error.noStats = true;
  throw error;
}

const MERIT_RE = /(genomsnitt(?:ligt|lig)?\s+merit|merit(?:värde|varde|value|score)|average\s+merit|averageScore)/i;
const GRADE9_RE = /(åk\s*9|ar\s*9|årskurs\s*9|arskurs\s*9|grade\s*9|9th\s*grade|9thGrade|year\s*9|\b9\s*:\s*genomsnitt|slutbetyg)/i;
const BAD_RE = /(salsa|förvänt|forvant|expected|modell|model|avvik|deviation|nationell|national|sverige|riket)/i;
const VALUE_KEY_RE = /(value|värde|varde|result|score|merit|school|skola|skolenhet|actual|total|mean|average|genomsnitt)/i;
const BAD_VALUE_KEY_RE = /(national|sverige|riket|max|percent|andel|percentage|behörig|behorig)/i;

function numbersFromPrimitive(value) {
  if (typeof value === 'number') return [{ n: value, text: String(value) }];
  if (typeof value !== 'string') return [];
  if (/data saknas|för litet|for litet|saknas|^-$/i.test(value)) return [];
  const normalized = value.replace(/\s/g, '').replace(/−/g, '-').replace(/,/g, '.');
  const matches = normalized.match(/-?\d+(?:\.\d+)?/g) || [];
  return matches.map((m) => ({ n: Number(m), text: value })).filter((x) => Number.isFinite(x.n));
}

function stringifyShallow(obj) {
  if (!obj || typeof obj !== 'object') return String(obj ?? '');
  const parts = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') parts.push(`${key}: ${value}`);
    else if (Array.isArray(value) && value.every((x) => typeof x !== 'object')) parts.push(`${key}: ${value.join(' ')}`);
  }
  return parts.join(' ');
}

function scoreCandidate({ n, key, text, context }) {
  if (n < 0 || n > 340) return -Infinity;
  if (n === 9) return -50;
  let score = 0;
  if (n >= 100 && n <= 340) score += 8;
  if (n > 20 && n < 100) score += 1;
  if (n === 340) score -= 8;
  if (VALUE_KEY_RE.test(key)) score += 5;
  if (/school|skola|skolenhet|unit/i.test(key)) score += 3;
  if (BAD_VALUE_KEY_RE.test(key)) score -= 8;
  if (text && /av\s+max\s+340|max\s+340/i.test(text)) score += 4;
  if (text && text.includes('%')) score -= 12;
  if (BAD_RE.test(`${key} ${context}`)) score -= 3;
  return score;
}

function collectMeritCandidatesFromObject(obj, pathText, results) {
  const context = `${pathText} ${stringifyShallow(obj)}`;
  const hasMerit = MERIT_RE.test(context);
  const hasGrade9 = GRADE9_RE.test(context) || /statistics\/gr|typeOfSchooling:\s*gr|schoolType:\s*gr/i.test(context);
  if (!hasMerit || !hasGrade9) return;

  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') continue;
    for (const number of numbersFromPrimitive(value)) {
      const score = scoreCandidate({ n: number.n, key, text: number.text, context });
      if (score > -Infinity) results.push({ value: number.n, score, key, context: context.slice(0, 500) });
    }
  }
}

function extractLatestMetricValue(root, metricKeys) {
  for (const key of metricKeys) {
    const metric = root?.[key];
    const values = Array.isArray(metric) ? metric : metric?.schoolValues;
    if (!Array.isArray(values)) continue;
    for (const entry of values) {
      if (entry?.valueType && entry.valueType !== 'EXISTS') continue;
      const value = parseNumberLoose(entry?.value);
      if (value !== null && value > 20 && value <= 340) return Number(value.toFixed(1));
    }
  }
  return null;
}

function extractMeritValueFromStatistics(json) {
  const root = unwrapBody(json);
  const explicitValue = extractLatestMetricValue(root, ['averageGradesMeritRating9thGrade']);
  if (explicitValue !== null) return explicitValue;

  const results = [];

  function walk(node, pathParts = []) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((child, index) => walk(child, [...pathParts, String(index)]));
      return;
    }

    collectMeritCandidatesFromObject(node, pathParts.join(' '), results);

    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object') walk(value, [...pathParts, key]);
      else if (MERIT_RE.test(key)) {
        for (const number of numbersFromPrimitive(value)) {
          const score = scoreCandidate({ n: number.n, key, text: number.text, context: pathParts.join(' ') }) + 4;
          if (score > -Infinity) results.push({ value: number.n, score, key, context: pathParts.join(' ') });
        }
      }
    }
  }

  walk(root, []);
  results.sort((a, b) => b.score - a.score);
  const best = results.find((c) => c.score >= 6 && c.value > 20 && c.value <= 340);
  return best ? Number(best.value.toFixed(1)) : null;
}

function formatSvDecimal(value) {
  return value.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

async function saveRawStatisticsSample(schoolUnitCode, json) {
  if (!CONFIG.saveRawStatistics) return;
  const file = path.join(RAW_STATS_DIR, `${schoolUnitCode}.json`);
  if (!existsSync(file)) await writeJsonFile(file, json);
}

async function fetchMeritForSchoolUnit(unit, warnings) {
  try {
    const stats = await fetchStatsForSchoolUnit(unit.schoolUnitCode);
    await saveRawStatisticsSample(unit.schoolUnitCode, stats.json);
    const averageMeritGrade9 = extractMeritValueFromStatistics(stats.json);
    if (averageMeritGrade9 === null) return null;
    return {
      ...unit,
      averageMeritGrade9,
      averageMeritGrade9Label: formatSvDecimal(averageMeritGrade9),
      utbildningsguidenUrl: `https://utbildningsguiden.skolverket.se/skolenhet?schoolUnitID=${encodeURIComponent(unit.schoolUnitCode)}`,
      source: stats.label,
    };
  } catch (err) {
    if (!err.noStats && warnings.length < 25) warnings.push(`${unit.name} (${unit.schoolUnitCode}): ${err.message}`);
    return null;
  }
}

function sortSchools(schools) {
  return schools.slice().sort((a, b) => {
    if (a.municipality !== b.municipality) return a.municipality.localeCompare(b.municipality, 'sv');
    return b.averageMeritGrade9 - a.averageMeritGrade9 || a.name.localeCompare(b.name, 'sv');
  });
}

function makeOutputDoc(schools, metadata) {
  return {
    schemaVersion: 2,
    generatedAt: nowIso(),
    source: {
      name: 'Skolverket Planned educations API',
      baseUrl: CONFIG.plannedBaseUrl,
      unitEndpoint: chosenUnitEndpoint?.label ?? null,
      statsEndpoint: chosenStatsEndpoint?.label ?? null,
    },
    scope: {
      region: {
        id: SELECTED_REGION.id,
        name: SELECTED_REGION.name,
        fullName: SELECTED_REGION.fullName,
      },
      municipalities: MUNICIPALITIES,
      coordinateBounds: SELECTED_REGION.coordinateBounds,
    },
    metadata: {
      ...metadata,
      rateLimit: {
        apiMinDelayMs: CONFIG.apiMinDelayMs,
        pageSize: CONFIG.pageSize,
        statBatchSize: CONFIG.statBatchSize,
        statBatchPauseMs: CONFIG.statBatchPauseMs,
      },
      httpCache: {
        cacheDir: path.relative(ROOT_DIR, HTTP_CACHE_DIR),
        ttlMs: CONFIG.httpCacheTtlMs,
        forceRefresh: CONFIG.forceHttpRefresh,
      },
    },
    schools: sortSchools(schools),
  };
}

async function writeOutput(schools, metadata) {
  const doc = makeOutputDoc(schools, metadata);
  await writeJsonFile(CONFIG.outFile, doc);
  return doc;
}

async function writeSampleOutput() {
  const samplePath = path.join(ROOT_DIR, SELECTED_REGION.sampleFile);
  const sample = await readJsonFile(samplePath);
  await writeJsonFile(CONFIG.outFile, { ...sample, generatedAt: nowIso() });
  log(`Skrev sampledata till ${path.relative(ROOT_DIR, CONFIG.outFile)}`);
}

async function buildData() {
  await ensureDirs();

  if (CONFIG.useSampleData) {
    await writeSampleOutput();
    return;
  }

  const startedAt = nowIso();
  const byCode = new Map();
  const warnings = [];
  let schoolUnitsExamined = 0;
  let noMeritCount = 0;

  log(`Bygger JSON för ${SELECTED_REGION.fullName} till ${path.relative(ROOT_DIR, CONFIG.outFile)}`);
  log(`Kommuner: ${MUNICIPALITIES.map((m) => m.name).join(', ')}`);
  log(`API-takt: minst ${CONFIG.apiMinDelayMs} ms mellan anrop, statistikbatch ${CONFIG.statBatchSize}, batchpaus ${CONFIG.statBatchPauseMs} ms.`);

  for (let municipalityIndex = 0; municipalityIndex < MUNICIPALITIES.length; municipalityIndex += 1) {
    const municipality = MUNICIPALITIES[municipalityIndex];
    log(`\n${municipality.name} (${municipality.code}) ${municipalityIndex + 1}/${MUNICIPALITIES.length}`);

    const units = await fetchAllSchoolUnitsForMunicipality(municipality);
    schoolUnitsExamined += units.length;
    log(`${municipality.name}: ${units.length} grundskoleenheter med koordinater hittade. Hämtar åk 9-statistik...`);

    for (let i = 0; i < units.length; i += CONFIG.statBatchSize) {
      const batch = units.slice(i, i + CONFIG.statBatchSize);
      const settled = await Promise.all(batch.map((unit) => fetchMeritForSchoolUnit(unit, warnings)));
      let hitsInBatch = 0;
      for (const school of settled) {
        if (!school) {
          noMeritCount += 1;
          continue;
        }
        hitsInBatch += 1;
        byCode.set(school.schoolUnitCode, school);
      }
      log(`${municipality.name}: batch ${Math.floor(i / CONFIG.statBatchSize) + 1}, +${hitsInBatch} skolor med meritvärde, totalt ${byCode.size}.`);
      if (i + CONFIG.statBatchSize < units.length) await sleep(CONFIG.statBatchPauseMs);
    }

    await writeOutput([...byCode.values()], {
      complete: municipalityIndex + 1 === MUNICIPALITIES.length,
      startedAt,
      municipalitiesDone: municipalityIndex + 1,
      totalMunicipalities: MUNICIPALITIES.length,
      schoolUnitsExamined,
      schoolsWithMerit: byCode.size,
      noMeritCount,
      networkCallsThisBuild: apiCallsThisBuild,
      warnings,
    });
    log(`Delresultat sparat: ${byCode.size} skolor i JSON-filen.`);
  }

  const finalDoc = await writeOutput([...byCode.values()], {
    complete: true,
    startedAt,
    municipalitiesDone: MUNICIPALITIES.length,
    totalMunicipalities: MUNICIPALITIES.length,
    schoolUnitsExamined,
    schoolsWithMerit: byCode.size,
    noMeritCount,
    networkCallsThisBuild: apiCallsThisBuild,
    warnings,
  });

  log(`\nKlart: ${finalDoc.schools.length} skolor skrivna till ${path.relative(ROOT_DIR, CONFIG.outFile)}.`);
  if (warnings.length) log(`Varningar: ${warnings.length}. De första ligger i JSON metadata.warnings.`);
}

buildData().catch((err) => {
  console.error('\nBygget misslyckades:');
  console.error(err.stack || err.message);
  process.exit(1);
});
