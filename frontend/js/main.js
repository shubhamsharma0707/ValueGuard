import { dom } from './dom.js';
import { state, INDIAN_STATES, CITY_STATE_MAP } from './state.js';
import { debounce, speculationLabel } from './utils.js';
import { fetchLocationsAPI, submitValuationAPI, fetchHistoryAPI } from './api.js';
import { updateSensitivityChart, renderRadarChart, refreshChartsTheme } from './charts.js';
import {
  showError, hideError, showSkeleton, initTheme, initIcons,
  toggleTheme, openSidebar, closeSidebar,
  filterCitiesByState, filterZonesByCity,
  updateResults, resetResultCards, renderHistory, renderHeatmap,
  computeEMI, renderPinnedChips, renderCompareTable,
  showToast,
  initTicker, initScrollIndicator
} from './ui.js';

/* ─── Populate State Dropdowns ─────────────────────────────────────── */

function populateStateDropdowns() {
  [dom.stateSelect, dom.compareStateSelect].forEach((el) => {
    if (!el) return;
    el.innerHTML = '<option value="">— Select State —</option>';
    INDIAN_STATES.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      // Mark states that have data
      const hasData = state.locations.some((loc) => (CITY_STATE_MAP[loc.city] || '') === s);
      if (!hasData) opt.classList.add('state-no-data');
      el.appendChild(opt);
    });
    el.disabled = false;
  });
}

/* ─── Fetch Locations ──────────────────────────────────────────────── */

async function fetchLocations() {
  try {
    const data = await fetchLocationsAPI();
    state.locations = data;
    hideError();
    populateStateDropdowns();
    applyURLParams();
  } catch (err) {
    console.error('[ValueGuard] Failed to load locations:', err);
    if (dom.stateSelect) {
      dom.stateSelect.innerHTML = '<option value="">⚠ Failed to load — reload page</option>';
      dom.stateSelect.disabled = false;
    }
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    showError(
      isLocal
        ? 'Cannot reach the server. Run: npm run dev'
        : `Failed to load zone data: ${err.message}. Please refresh.`
    );
  }
}


/* ─── URL State Encoding ───────────────────────────────────────────── */

function encodeURLState() {
  const params = new URLSearchParams({
    state: dom.stateSelect.value || '',
    city:  dom.citySelect.value  || '',
    zone:  dom.zoneSelect.value  || '',
    age:   dom.sliderAge.value,
    metro: dom.sliderMetro.value,
    spec:  dom.sliderSpeculation.value,
  });
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function applyURLParams() {
  const params   = new URLSearchParams(window.location.search);
  const statePrm = params.get('state');
  const city     = params.get('city');
  const zone     = params.get('zone');
  const age      = params.get('age');
  const metro    = params.get('metro');
  const spec     = params.get('spec');

  if (age)   { dom.sliderAge.value = age;   dom.valAge.textContent = `${age} yr${age === '1' ? '' : 's'}`; }
  if (metro) { dom.sliderMetro.value = metro; dom.valMetro.textContent = `${Number(metro).toFixed(1)} km`; }
  if (spec)  { dom.sliderSpeculation.value = spec; dom.valSpeculation.textContent = speculationLabel(Number(spec)); }

  if (statePrm && dom.stateSelect.querySelector(`option[value="${CSS.escape(statePrm)}"]`)) {
    dom.stateSelect.value = statePrm;
    filterCitiesByState(statePrm, dom.citySelect, dom.zoneSelect);
    renderHeatmap(null); // clear until city chosen
  }

  if (city) {
    setTimeout(() => {
      if (dom.citySelect.querySelector(`option[value="${CSS.escape(city)}"]`)) {
        dom.citySelect.value = city;
        filterZonesByCity(city, dom.zoneSelect);
        renderHeatmap(city);
      }
    }, 30);
  }

  if (zone) {
    setTimeout(() => {
      if (dom.zoneSelect.querySelector(`option[value="${CSS.escape(zone)}"]`)) {
        dom.zoneSelect.value = zone;
        submitValuation();
      }
    }, 60);
  }
}

/* ─── History ──────────────────────────────────────────────────────── */

async function fetchHistory() {
  try {
    const history = await fetchHistoryAPI();
    renderHistory(history);
  } catch (err) {
    console.warn('[ValueGuard] History fetch failed:', err);
  }
}

/* ─── Valuation ────────────────────────────────────────────────────── */

async function submitValuation() {
  const locationId = dom.zoneSelect.value;
  if (!locationId) return;

  const payload = {
    location_id:       locationId,
    property_age:      Number(dom.sliderAge.value),
    metro_distance_km: Number(dom.sliderMetro.value),
    speculation_level: Number(dom.sliderSpeculation.value),
  };

  showSkeleton();
  hideError();

  try {
    const data = await submitValuationAPI(payload);
    state.lastResult = { ...data, location_id: locationId };
    updateResults(data);
    await fetchHistory();
    updateSensitivityChart();
    encodeURLState();

    if (dom.emiBody && !dom.emiBody.hidden) computeEMI();

  } catch (err) {
    console.error('[ValueGuard] Valuation error:', err);
    showError(`Valuation failed: ${err.message}`);
    resetResultCards();
  }
}

/* ─── Compare helpers ──────────────────────────────────────────────── */

function formulaEstimate(loc, age, metroKm, specLevel) {
  const base   = loc.circle_rate_per_sqft * loc.zone_multiplier;
  const metro  = loc.metro_nearby && metroKm < 2 ? 800 : loc.metro_nearby && metroKm < 5 ? 400 : 0;
  const deprec = age * 120;
  const uplift = specLevel * 500;
  return Math.round(base + metro - deprec + uplift);
}

function unpinZone(id) {
  state.pinnedZones = state.pinnedZones.filter((z) => z.id !== id);
  renderPinnedChips(unpinZone);
  renderCompareTable();
  renderRadarChart();
}

function pinZone() {
  const locationId = dom.compareZoneSelect.value;
  if (!locationId) return;

  if (state.pinnedZones.some((z) => z.id === locationId)) {
    showToast('Zone already pinned.');
    return;
  }
  if (state.pinnedZones.length >= 3) {
    showToast('Maximum 3 zones. Unpin one first.');
    return;
  }

  const loc = state.locations.find((l) => l.id === locationId);
  if (!loc) return;

  const age      = Number(dom.sliderAge.value);
  const metroKm  = Number(dom.sliderMetro.value);
  const spec     = Number(dom.sliderSpeculation.value);
  const market   = formulaEstimate(loc, age, metroKm, spec);
  const variance = parseFloat((((market - loc.circle_rate_per_sqft) / loc.circle_rate_per_sqft) * 100).toFixed(2));
  const risk     = variance < 20 ? 'Safe' : variance <= 50 ? 'Caution' : 'High Risk';

  state.pinnedZones.push({ ...loc, market_value: market, variance_pct: variance, risk_level: risk });
  renderPinnedChips(unpinZone);
  renderCompareTable();
  renderRadarChart();
  showToast(`Pinned ${loc.zone_name}`);
}

/* ─── Share URL ────────────────────────────────────────────────────── */

async function copyShareURL() {
  encodeURLState();
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('Shareable link copied.');
  } catch {
    showToast('Copy failed — check clipboard permissions.');
  }
}

/* ─── Tabs ─────────────────────────────────────────────────────────── */

function initTabs() {
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      tabPanels.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(btn.getAttribute('aria-controls')).classList.add('active');
    });
  });
}

/* ─── Slider fills ─────────────────────────────────────────────────── */

function updateSliderFill(el) {
  const pct = ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100;
  el.style.background = `linear-gradient(to right, var(--clr-accent) ${pct}%, var(--clr-surface-3) ${pct}%)`;
}

function initSliderReadouts() {
  dom.sliderAge.addEventListener('input', () => {
    const v = dom.sliderAge.value;
    dom.valAge.textContent = `${v} yr${v === '1' ? '' : 's'}`;
    dom.sliderAge.setAttribute('aria-valuenow', v);
    updateSliderFill(dom.sliderAge);
  });
  dom.sliderMetro.addEventListener('input', () => {
    const v = Number(dom.sliderMetro.value).toFixed(1);
    dom.valMetro.textContent = `${v} km`;
    dom.sliderMetro.setAttribute('aria-valuenow', v);
    updateSliderFill(dom.sliderMetro);
  });
  dom.sliderSpeculation.addEventListener('input', () => {
    const v = dom.sliderSpeculation.value;
    dom.valSpeculation.textContent = speculationLabel(Number(v));
    dom.sliderSpeculation.setAttribute('aria-valuenow', v);
    updateSliderFill(dom.sliderSpeculation);
  });
  requestAnimationFrame(() => {
    updateSliderFill(dom.sliderAge);
    updateSliderFill(dom.sliderMetro);
    updateSliderFill(dom.sliderSpeculation);
  });
}

/* ─── Reveal animations ────────────────────────────────────────────── */

function initRevealAnimations() {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); } }),
    { threshold: 0.1 }
  );
  document.querySelectorAll('.reveal-card').forEach((el) => observer.observe(el));
}

/* ─── Event Listeners ──────────────────────────────────────────────── */

const debouncedValuate = debounce(submitValuation, 300);

function initEventListeners() {
  // ── Main: State → City → Zone cascade ──
  dom.stateSelect.addEventListener('change', () => {
    const s = dom.stateSelect.value;
    filterCitiesByState(s, dom.citySelect, dom.zoneSelect);
    renderHeatmap(null);
    resetResultCards();
  });

  dom.citySelect.addEventListener('change', () => {
    const city = dom.citySelect.value;
    filterZonesByCity(city, dom.zoneSelect);
    renderHeatmap(city);
    resetResultCards();
  });

  dom.zoneSelect.addEventListener('change', debouncedValuate);

  // ── Sliders ──
  dom.sliderAge.addEventListener('input', debouncedValuate);
  dom.sliderMetro.addEventListener('input', debouncedValuate);
  dom.sliderSpeculation.addEventListener('input', debouncedValuate);

  // ── Compare: State → City → Zone cascade ──
  dom.compareStateSelect.addEventListener('change', () => {
    filterCitiesByState(dom.compareStateSelect.value, dom.compareCitySelect, dom.compareZoneSelect);
    dom.btnPinZone.disabled = true;
  });

  dom.compareCitySelect.addEventListener('change', () => {
    filterZonesByCity(dom.compareCitySelect.value, dom.compareZoneSelect);
    dom.btnPinZone.disabled = true;
  });

  dom.compareZoneSelect.addEventListener('change', () => {
    dom.btnPinZone.disabled = !dom.compareZoneSelect.value;
  });

  dom.btnPinZone.addEventListener('click', pinZone);

  // ── History drawer ──
  dom.drawerToggle.addEventListener('click', () => {
    const isOpen = dom.historyDrawer.classList.toggle('open');
    dom.drawerToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // ── Actions ──
  dom.btnCopyURL.addEventListener('click', copyShareURL);
  dom.btnPrint.addEventListener('click', () => {
    dom.printTimestamp.textContent = `Generated: ${new Date().toLocaleString('en-IN')}`;
    window.print();
  });

  // ── Theme & mobile ──
  dom.themeToggle.addEventListener('click', toggleTheme);
  dom.hamburgerBtn.addEventListener('click', () => {
    dom.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  dom.sidebarOverlay.addEventListener('click', closeSidebar);

  // ── EMI ──
  dom.emiToggle.addEventListener('click', () => {
    const expanded = dom.emiToggle.getAttribute('aria-expanded') === 'true';
    dom.emiToggle.setAttribute('aria-expanded', String(!expanded));
    dom.emiBody.hidden = expanded;
    if (!expanded && state.lastResult) computeEMI();
  });
  [dom.emiArea, dom.emiRate, dom.emiTenure, dom.emiIncome].forEach((el) => {
    el.addEventListener('input', debounce(computeEMI, 300));
  });

  // ── Sensitivity ──
  dom.sensitivityAxis.addEventListener('change', updateSensitivityChart);

  // ── Theme change ──
  window.addEventListener('themeChanged', refreshChartsTheme);
}

/* ─── Init ─────────────────────────────────────────────────────────── */

async function init() {
  initTheme();
  initIcons();
  initRevealAnimations();
  initTabs();
  initSliderReadouts();
  initEventListeners();
  initScrollIndicator();
  await fetchLocations();
  initTicker();
}

document.addEventListener('DOMContentLoaded', init);
