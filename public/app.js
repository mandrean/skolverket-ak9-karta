const REGIONS = [
  {
    id: 'stockholm',
    name: 'Stockholm',
    fullName: 'Region Stockholm',
    dataUrl: 'data/stockholm-grade9-schools.json',
    defaultCenter: [59.35, 18.05],
    defaultZoom: 9,
    coordinateBounds: {
      minLat: 58.75,
      maxLat: 60.25,
      minLng: 17.0,
      maxLng: 19.2,
    },
  },
  {
    id: 'vastra-gotaland',
    name: 'Västra Götaland',
    fullName: 'Västra Götalandsregionen',
    dataUrl: 'data/vastra-gotaland-grade9-schools.json',
    defaultCenter: [58.15, 12.95],
    defaultZoom: 8,
    coordinateBounds: {
      minLat: 57.0,
      maxLat: 59.45,
      minLng: 10.7,
      maxLng: 14.8,
    },
  },
  {
    id: 'halland',
    name: 'Halland',
    fullName: 'Region Halland',
    dataUrl: 'data/halland-grade9-schools.json',
    defaultCenter: [56.95, 12.65],
    defaultZoom: 9,
    coordinateBounds: {
      minLat: 56.25,
      maxLat: 57.85,
      minLng: 11.65,
      maxLng: 13.75,
    },
  },
];

const REGION_BY_ID = new Map(REGIONS.map((region) => [region.id, region]));

const state = {
  allSchools: [],
  filteredSchools: [],
  markers: new Map(),
  map: null,
  layer: null,
  dataDocs: [],
  selectedRegionIds: new Set([REGIONS[0].id]),
  selectedMunicipalities: new Set(),
  regionDocs: new Map(),
  currentMunicipalities: [],
};

const els = {
  status: document.querySelector('#status'),
  reloadButton: document.querySelector('#reloadButton'),
  regionFilter: document.querySelector('#regionFilter'),
  municipalityFilter: document.querySelector('#municipalityFilter'),
  searchFilter: document.querySelector('#searchFilter'),
  minMerit: document.querySelector('#minMerit'),
  maxMerit: document.querySelector('#maxMerit'),
  countText: document.querySelector('#countText'),
  schoolList: document.querySelector('#schoolList'),
  itemTemplate: document.querySelector('#schoolItemTemplate'),
};

let loadSequence = 0;

function selectedRegions() {
  const selected = REGIONS.filter((region) => state.selectedRegionIds.has(region.id));
  return selected.length ? selected : [REGIONS[0]];
}

function primaryRegion() {
  return selectedRegions()[0] ?? REGIONS[0];
}

function selectedRegionSummary() {
  const regions = selectedRegions();
  if (regions.length === REGIONS.length) return 'alla regioner';
  if (regions.length === 1) return regions[0].name;
  return `${regions.length} regioner`;
}

function meritValue(school) {
  const raw = school.averageMeritGrade9 ?? school.meritValue ?? school.averageMerit;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function meritLabel(school) {
  const value = meritValue(school);
  return school.averageMeritGrade9Label || school.meritLabel || (value === null ? '–' : svNumber(value));
}

function svNumber(value) {
  return Number(value).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function hasUsableCoordinates(school, region) {
  const lat = Number(school.lat);
  const lng = Number(school.lng);
  const bounds = region.coordinateBounds;
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= bounds.minLat
    && lat <= bounds.maxLat
    && lng >= bounds.minLng
    && lng <= bounds.maxLng;
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

function createMultiSelect({
  root,
  emptyText,
  getOptions,
  getSelectedValues,
  setSelectedValues,
  summaryText,
  required = false,
  onChange,
}) {
  let options = [];
  let lastClickedIndex = null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'multi-select__button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'multi-select__menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-multiselectable', 'true');

  root.classList.add('multi-select');
  root.replaceChildren(button, menu);

  function setOpen(open) {
    root.dataset.open = open ? 'true' : 'false';
    button.setAttribute('aria-expanded', String(open));
  }

  function applySelection(index, checked, shiftKey) {
    const next = new Set(getSelectedValues());
    const option = options[index];
    if (!option) return;

    if (shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      for (let i = start; i <= end; i += 1) {
        if (checked) next.add(options[i].value);
        else next.delete(options[i].value);
      }
    } else if (checked) {
      next.add(option.value);
    } else {
      next.delete(option.value);
    }

    if (required && next.size === 0) next.add(option.value);
    lastClickedIndex = index;
    setSelectedValues(next);
    if (onChange) onChange();
    render();
    if (shiftKey) setOpen(false);
  }

  function render() {
    options = getOptions();
    if (lastClickedIndex !== null && lastClickedIndex >= options.length) lastClickedIndex = null;

    const selected = new Set(getSelectedValues());
    button.textContent = summaryText(options, selected);
    button.title = button.textContent;
    menu.innerHTML = '';

    if (!options.length) {
      const empty = document.createElement('div');
      empty.className = 'multi-select__empty';
      empty.textContent = emptyText;
      menu.append(empty);
      return;
    }

    for (const [index, option] of options.entries()) {
      const isSelected = selected.has(option.value);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'multi-select__option';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(isSelected));

      const box = document.createElement('span');
      box.className = 'multi-select__box';
      box.setAttribute('aria-hidden', 'true');

      const text = document.createElement('span');
      text.className = 'multi-select__option-text';

      const label = document.createElement('span');
      label.textContent = option.label;
      text.append(label);

      if (option.detail) {
        const detail = document.createElement('small');
        detail.textContent = option.detail;
        text.append(detail);
      }

      item.append(box, text);
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        applySelection(index, !selected.has(option.value), event.shiftKey);
      });
      menu.append(item);
    }
  }

  button.addEventListener('click', () => setOpen(root.dataset.open !== 'true'));
  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  return {
    render,
    close: () => setOpen(false),
  };
}

const regionSelect = createMultiSelect({
  root: els.regionFilter,
  emptyText: 'Inga regioner',
  getOptions: () => REGIONS.map((region) => ({
    value: region.id,
    label: region.name,
    detail: region.fullName,
  })),
  getSelectedValues: () => state.selectedRegionIds,
  setSelectedValues: (next) => {
    const valid = [...next].filter((id) => REGION_BY_ID.has(id));
    state.selectedRegionIds = new Set(valid.length ? valid : [REGIONS[0].id]);
  },
  summaryText: (_options, selected) => {
    if (selected.size === REGIONS.length) return 'Alla regioner';
    if (selected.size === 1) return REGION_BY_ID.get([...selected][0])?.name ?? 'Välj region';
    return `${selected.size} regioner valda`;
  },
  required: true,
  onChange: () => loadSelectedRegions().catch(clearDataAfterError),
});

const municipalitySelect = createMultiSelect({
  root: els.municipalityFilter,
  emptyText: 'Inga kommuner i valda regioner',
  getOptions: () => state.currentMunicipalities.map((municipality) => ({
    value: municipality,
    label: municipality,
  })),
  getSelectedValues: () => state.selectedMunicipalities,
  setSelectedValues: (next) => {
    state.selectedMunicipalities = new Set([...next].filter((municipality) => state.currentMunicipalities.includes(municipality)));
  },
  summaryText: (_options, selected) => {
    if (!selected.size) return 'Alla kommuner';
    if (selected.size === 1) return [...selected][0];
    return `${selected.size} kommuner valda`;
  },
  onChange: applyFilters,
});

function initMap() {
  const region = primaryRegion();
  state.map = L.map('map', { preferCanvas: false }).setView(region.defaultCenter, region.defaultZoom);
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
  const regionMeta = state.selectedRegionIds.size > 1 ? `${school.region} · ` : '';
  return `
    <div class="popup">
      <div class="popup__header">
        <div>
          <div class="popup__title">${escapeHtml(school.name)}</div>
          <div class="popup__meta">${escapeHtml(regionMeta)}${escapeHtml(school.municipality)} · ${escapeHtml(school.typeOfSchool || 'Grundskola')}</div>
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

function schoolKey(school) {
  return `${school.regionId || 'region'}:${school.schoolUnitCode}`;
}

function renderMarkers() {
  const region = primaryRegion();
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
    state.markers.set(schoolKey(school), marker);
  }

  const markers = [...state.markers.values()];
  if (markers.length) {
    state.map.invalidateSize({ pan: false });
    const group = L.featureGroup(markers);
    state.map.fitBounds(group.getBounds().pad(0.12), { maxZoom: 12 });
  } else {
    state.map.setView(region.defaultCenter, region.defaultZoom);
  }
  syncMapLayout();
}

function renderList() {
  els.schoolList.innerHTML = '';
  els.countText.textContent = `${state.filteredSchools.length} av ${state.allSchools.length} skolor visas i ${selectedRegionSummary()}`;

  const visibleList = state.filteredSchools
    .slice()
    .sort((a, b) => meritValue(b) - meritValue(a) || a.name.localeCompare(b.name, 'sv'))
    .slice(0, 250);

  for (const school of visibleList) {
    const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
    const metaParts = state.selectedRegionIds.size > 1
      ? [school.region, school.municipality, school.schoolUnitCode]
      : [school.municipality, school.schoolUnitCode];
    node.querySelector('.school-item__grade').textContent = meritLabel(school);
    node.querySelector('.school-item__name').textContent = school.name;
    node.querySelector('.school-item__meta').textContent = metaParts.filter(Boolean).join(' · ');
    node.addEventListener('click', () => {
      const marker = state.markers.get(schoolKey(school));
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

function updateRegionOptions() {
  regionSelect.render();
}

function updateMunicipalityOptions() {
  const available = new Set(state.currentMunicipalities);
  state.selectedMunicipalities = new Set([...state.selectedMunicipalities].filter((municipality) => available.has(municipality)));
  municipalitySelect.render();
}

function applyFilters() {
  const municipalities = state.selectedMunicipalities;
  const q = els.searchFilter.value.trim().toLowerCase();
  const min = Number(els.minMerit.value || 0);
  const max = Number(els.maxMerit.value || 340);

  state.filteredSchools = state.allSchools.filter((school) => {
    const value = meritValue(school);
    if (value === null) return false;
    if (municipalities.size && !municipalities.has(school.municipality)) return false;
    if (q && !`${school.name} ${school.region} ${school.municipality} ${school.schoolUnitCode}`.toLowerCase().includes(q)) return false;
    if (value < min) return false;
    if (value > max) return false;
    return true;
  });

  renderMarkers();
  renderList();
}

function sumMetadata(docs, key) {
  const values = docs.map((doc) => Number(doc.metadata?.[key])).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : '–';
}

function latestGeneratedAt(docs) {
  const times = docs
    .map((doc) => Date.parse(doc.generatedAt))
    .filter(Number.isFinite);
  if (!times.length) return 'okänt datum';
  return new Date(Math.max(...times)).toLocaleString('sv-SE');
}

function updateStatus(docs) {
  const sourceNames = [...new Set(docs.map((doc) => doc.source?.name).filter(Boolean))];
  const complete = docs.some((doc) => doc.metadata?.complete === false) ? 'Delvis byggd' : 'Komplett';
  const regionText = selectedRegions().length === 1
    ? `${selectedRegions()[0].fullName}: ${state.allSchools.length} skolor`
    : `${selectedRegions().length} regioner: ${state.allSchools.length} skolor`;
  els.status.innerHTML = `
    <strong>${escapeHtml(complete)} JSON</strong><br>
    ${escapeHtml(regionText)} · senast byggd ${escapeHtml(latestGeneratedAt(docs))}<br>
    Källa: ${escapeHtml(sourceNames.join(', ') || 'okänd källa')}<br>
    <span class="muted">Skolenheter granskade: ${escapeHtml(sumMetadata(docs, 'schoolUnitsExamined'))} · API-anrop vid byggning: ${escapeHtml(sumMetadata(docs, 'networkCallsThisBuild'))}</span>
  `;
}

function normalizeSchools(doc, region) {
  const schools = Array.isArray(doc.schools) ? doc.schools : (Array.isArray(doc.data) ? doc.data : []);
  return schools
    .filter((s) => hasUsableCoordinates(s, region) && meritValue(s) !== null)
    .map((s) => ({
      ...s,
      lat: Number(s.lat),
      lng: Number(s.lng),
      regionId: s.regionId || region.id,
      region: s.region || region.name,
    }));
}

function municipalitiesFromDoc(doc) {
  const scoped = doc.scope?.municipalities;
  if (Array.isArray(scoped)) return scoped.map((m) => m.name).filter(Boolean);
  const schools = Array.isArray(doc.schools) ? doc.schools : (Array.isArray(doc.data) ? doc.data : []);
  return schools.map((s) => s.municipality).filter(Boolean);
}

function updateCurrentMunicipalities(docs) {
  const fromScope = docs.flatMap(municipalitiesFromDoc);
  const fallback = state.allSchools.map((s) => s.municipality).filter(Boolean);
  state.currentMunicipalities = [...new Set((fromScope.length ? fromScope : fallback))]
    .sort((a, b) => a.localeCompare(b, 'sv'));
}

async function fetchRegionDoc(region, force = false) {
  if (!force && state.regionDocs.has(region.id)) return state.regionDocs.get(region.id);
  const res = await fetch(`${region.dataUrl}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Kunde inte läsa ${region.dataUrl} (${res.status})`);
  const doc = await res.json();
  state.regionDocs.set(region.id, doc);
  return doc;
}

async function loadSelectedRegions({ force = false } = {}) {
  const requestId = ++loadSequence;
  const regions = selectedRegions();
  els.reloadButton.disabled = true;
  els.status.textContent = `Laddar JSON för ${regions.map((region) => region.name).join(', ')}…`;

  try {
    const docs = await Promise.all(regions.map((region) => fetchRegionDoc(region, force)));
    if (requestId !== loadSequence) return;

    state.dataDocs = docs;
    state.allSchools = docs.flatMap((doc, index) => normalizeSchools(doc, regions[index]));
    updateCurrentMunicipalities(docs);
    updateMunicipalityOptions();
    applyFilters();
    updateStatus(docs);
  } finally {
    if (requestId === loadSequence) els.reloadButton.disabled = false;
  }
}

function clearDataAfterError(err) {
  state.allSchools = [];
  state.filteredSchools = [];
  state.currentMunicipalities = [];
  if (state.layer) state.layer.clearLayers();
  state.markers.clear();
  updateMunicipalityOptions();
  renderList();
  els.status.textContent = `${err.message}. Kör rätt build-kommando för att skapa JSON-filen.`;
}

function setupEvents() {
  window.addEventListener('resize', syncMapLayout);
  els.reloadButton.addEventListener('click', () => loadSelectedRegions({ force: true }).catch(clearDataAfterError));
  for (const el of [els.searchFilter, els.minMerit, els.maxMerit]) {
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  }
}

updateRegionOptions();
updateMunicipalityOptions();
initMap();
setupEvents();
loadSelectedRegions().catch(clearDataAfterError);
