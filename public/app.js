const DATA_URL = '/data/stockholm-grade9-schools.json';

const STOCKHOLM_COORDINATE_BOUNDS = {
  minLat: 58.75,
  maxLat: 60.25,
  minLng: 17.0,
  maxLng: 19.2,
};

const state = {
  allSchools: [],
  filteredSchools: [],
  markers: new Map(),
  map: null,
  layer: null,
  dataDoc: null,
};

const els = {
  status: document.querySelector('#status'),
  reloadButton: document.querySelector('#reloadButton'),
  municipalityFilter: document.querySelector('#municipalityFilter'),
  searchFilter: document.querySelector('#searchFilter'),
  minMerit: document.querySelector('#minMerit'),
  maxMerit: document.querySelector('#maxMerit'),
  countText: document.querySelector('#countText'),
  schoolList: document.querySelector('#schoolList'),
  itemTemplate: document.querySelector('#schoolItemTemplate'),
};

function meritValue(school) {
  return Number(school.averageMeritGrade9 ?? school.meritValue ?? school.averageMerit ?? 0);
}

function meritLabel(school) {
  return school.averageMeritGrade9Label || school.meritLabel || svNumber(meritValue(school));
}

function svNumber(value) {
  return Number(value).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function hasUsableCoordinates(school) {
  const lat = Number(school.lat);
  const lng = Number(school.lng);
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= STOCKHOLM_COORDINATE_BOUNDS.minLat
    && lat <= STOCKHOLM_COORDINATE_BOUNDS.maxLat
    && lng >= STOCKHOLM_COORDINATE_BOUNDS.minLng
    && lng <= STOCKHOLM_COORDINATE_BOUNDS.maxLng;
}

function markerClass(value) {
  if (value >= 270) return 'grade-marker grade-marker--top';
  if (value >= 245) return 'grade-marker grade-marker--high';
  if (value >= 220) return 'grade-marker grade-marker--mid';
  return 'grade-marker grade-marker--low';
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initMap() {
  state.map = L.map('map', { preferCanvas: false }).setView([59.35, 18.05], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap-bidragsgivare',
  }).addTo(state.map);
  state.layer = L.layerGroup().addTo(state.map);
  syncMapLayout();
}

function syncMapLayout() {
  if (!state.map) return;
  state.map.invalidateSize({ pan: false });
  requestAnimationFrame(() => {
    state.map.invalidateSize({ pan: false });
    window.setTimeout(() => state.map.invalidateSize({ pan: false }), 150);
  });
}

function popupHtml(school) {
  return `
    <div class="popup">
      <div class="popup__header">
        <div>
          <div class="popup__title">${escapeHtml(school.name)}</div>
          <div class="popup__meta">${escapeHtml(school.municipality)} · ${escapeHtml(school.typeOfSchool || 'Grundskola')}</div>
        </div>
        <div class="popup__grade" aria-label="Genomsnittligt meritvärde">${escapeHtml(meritLabel(school))}</div>
      </div>
      <div class="popup__label">Genomsnittligt meritvärde i åk 9</div>
      <div class="popup__details">
        <span>Skolenhetskod</span>
        <strong>${escapeHtml(school.schoolUnitCode)}</strong>
      </div>
      ${school.utbildningsguidenUrl ? `<a class="popup__link" href="${escapeHtml(school.utbildningsguidenUrl)}" target="_blank" rel="noreferrer">Öppna på Utbildningsguiden</a>` : ''}
    </div>`;
}

function renderMarkers() {
  state.layer.clearLayers();
  state.markers.clear();

  for (const school of state.filteredSchools) {
    const value = meritValue(school);
    const icon = L.divIcon({
      className: '',
      html: `<div class="${markerClass(value)}">${escapeHtml(meritLabel(school))}</div>`,
      iconSize: [58, 34],
      iconAnchor: [29, 17],
      popupAnchor: [0, -18],
    });
    const marker = L.marker([school.lat, school.lng], { icon }).bindPopup(popupHtml(school), {
      className: 'school-popup',
      maxWidth: 320,
      minWidth: 260,
    });
    marker.addTo(state.layer);
    state.markers.set(school.schoolUnitCode, marker);
  }

  const markers = [...state.markers.values()];
  if (markers.length) {
    state.map.invalidateSize({ pan: false });
    const group = L.featureGroup(markers);
    state.map.fitBounds(group.getBounds().pad(0.12), { maxZoom: 12 });
    syncMapLayout();
  }
}

function renderList() {
  els.schoolList.innerHTML = '';
  els.countText.textContent = `${state.filteredSchools.length} av ${state.allSchools.length} skolor visas`;

  const visibleList = state.filteredSchools
    .slice()
    .sort((a, b) => meritValue(b) - meritValue(a) || a.name.localeCompare(b.name, 'sv'))
    .slice(0, 250);

  for (const school of visibleList) {
    const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.school-item__grade').textContent = meritLabel(school);
    node.querySelector('.school-item__name').textContent = school.name;
    node.querySelector('.school-item__meta').textContent = `${school.municipality} · ${school.schoolUnitCode}`;
    node.addEventListener('click', () => {
      const marker = state.markers.get(school.schoolUnitCode);
      if (marker) {
        state.map.setView(marker.getLatLng(), Math.max(state.map.getZoom(), 13), { animate: true });
        marker.openPopup();
      }
    });
    els.schoolList.append(node);
  }

  if (state.filteredSchools.length > visibleList.length) {
    const more = document.createElement('p');
    more.className = 'muted';
    more.textContent = `Listan visar de första ${visibleList.length}. Begränsa med filter för att se färre.`;
    els.schoolList.append(more);
  }
}

function updateMunicipalityOptions() {
  const current = els.municipalityFilter.value;
  const municipalities = [...new Set(state.allSchools.map((s) => s.municipality).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sv'));
  els.municipalityFilter.innerHTML = '<option value="">Alla kommuner</option>';
  for (const municipality of municipalities) {
    const option = document.createElement('option');
    option.value = municipality;
    option.textContent = municipality;
    els.municipalityFilter.append(option);
  }
  els.municipalityFilter.value = current;
}

function applyFilters() {
  const municipality = els.municipalityFilter.value;
  const q = els.searchFilter.value.trim().toLowerCase();
  const min = Number(els.minMerit.value || 0);
  const max = Number(els.maxMerit.value || 340);

  state.filteredSchools = state.allSchools.filter((school) => {
    const value = meritValue(school);
    if (municipality && school.municipality !== municipality) return false;
    if (q && !`${school.name} ${school.municipality} ${school.schoolUnitCode}`.toLowerCase().includes(q)) return false;
    if (value < min) return false;
    if (value > max) return false;
    return true;
  });

  renderMarkers();
  renderList();
}

function updateStatus(doc) {
  const generatedAt = doc.generatedAt ? new Date(doc.generatedAt).toLocaleString('sv-SE') : 'okänt datum';
  const meta = doc.metadata || {};
  const sourceName = doc.source?.name || 'okänd källa';
  const complete = meta.complete === false ? 'Delvis byggd' : 'Komplett';
  els.status.innerHTML = `
    <strong>${escapeHtml(complete)} JSON</strong><br>
    ${escapeHtml(state.allSchools.length)} skolor · byggd ${escapeHtml(generatedAt)}<br>
    Källa: ${escapeHtml(sourceName)}<br>
    <span class="muted">Skolenheter granskade: ${escapeHtml(meta.schoolUnitsExamined ?? '–')} · API-anrop vid byggning: ${escapeHtml(meta.networkCallsThisBuild ?? '–')}</span>
  `;
}

async function loadSchools() {
  els.reloadButton.disabled = true;
  try {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Kunde inte läsa ${DATA_URL} (${res.status})`);
    const doc = await res.json();
    const schools = Array.isArray(doc.schools) ? doc.schools : (Array.isArray(doc.data) ? doc.data : []);
    state.dataDoc = doc;
    state.allSchools = schools
      .filter((s) => hasUsableCoordinates(s) && Number.isFinite(meritValue(s)))
      .map((s) => ({ ...s, lat: Number(s.lat), lng: Number(s.lng) }));
    updateMunicipalityOptions();
    applyFilters();
    updateStatus(doc);
  } finally {
    els.reloadButton.disabled = false;
  }
}

function setupEvents() {
  window.addEventListener('resize', syncMapLayout);
  els.reloadButton.addEventListener('click', () => loadSchools().catch((err) => {
    els.status.textContent = err.message;
    els.reloadButton.disabled = false;
  }));
  for (const el of [els.municipalityFilter, els.searchFilter, els.minMerit, els.maxMerit]) {
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  }
}

initMap();
setupEvents();
loadSchools().catch((err) => {
  els.status.textContent = `${err.message}. Kör npm run build:data för att skapa JSON-filen.`;
});
