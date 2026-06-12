import { dom } from './dom.js';
import { state } from './state.js';
import { debounce, speculationLabel } from './utils.js';
import { fetchLocationsAPI, submitValuationAPI, fetchHistoryAPI, fetchTrendsAPI } from './api.js';
import { updateSensitivityChart, renderRadarChart, renderTrendsChart } from './charts.js';
import {
  showError, hideError, showSkeleton, initTheme, initIcons,
  toggleTheme, openSidebar, closeSidebar, filterZonesByCity,
  updateResults, resetResultCards, renderHistory, renderHeatmap,
  computeEMI, renderPinnedChips, renderCompareTable, renderTrendStats,
  showToast,
  initTicker, initScrollIndicator
} from './ui.js';

async function fetchLocations() {
  try {
    const data = await fetchLocationsAPI();
    state.locations = data;
    hideError();

    const cities = [...new Set(data.map((loc) => loc.city))];

    dom.citySelect.innerHTML = '<option value="">— Select City —</option>';
    cities.forEach((city) => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      dom.citySelect.appendChild(opt);
    });
    dom.citySelect.disabled = false;

    dom.compareCitySelect.innerHTML = '<option value="">— Select City —</option>';
    cities.forEach((city) => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      dom.compareCitySelect.appendChild(opt);
    });

    applyURLParams();

  } catch (err) {
    console.error('[ValueGuard] Failed to load locations:', err);
    dom.citySelect.innerHTML = '<option value="">Server unavailable</option>';
    showError('Cannot reach the server at localhost:3000. Run: npm run dev');
  }
}

function encodeURLState() {
  const params = new URLSearchParams({
    city:  dom.citySelect.value || '',
    zone:  dom.zoneSelect.value || '',
    age:   dom.sliderAge.value,
    metro: dom.sliderMetro.value,
    spec:  dom.sliderSpeculation.value,
  });
  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', url);
}

function applyURLParams() {
  const params = new URLSearchParams(window.location.search);
  const city   = params.get('city');
  const zone   = params.get('zone');
  const age    = params.get('age');
  const metro  = params.get('metro');
  const spec   = params.get('spec');

  if (city && dom.citySelect.querySelector(`option[value="${CSS.escape(city)}"]`)) {

    dom.citySelect.value = city;
    filterZonesByCity(city, dom.zoneSelect);
    renderHeatmap(city);
    filterZonesByCity(city, dom.compareZoneSelect);
  }

  if (age)   { dom.sliderAge.value = age; dom.valAge.textContent = `${age} yr${age === '1' ? '' : 's'}`; }
  if (metro) { dom.sliderMetro.value = metro; dom.valMetro.textContent = `${Number(metro).toFixed(1)} km`; }
  if (spec)  { dom.sliderSpeculation.value = spec; dom.valSpeculation.textContent = speculationLabel(Number(spec)); }

  if (zone) {
    setTimeout(() => {
      if (dom.zoneSelect.querySelector(`option[value="${CSS.escape(zone)}"]`)) {
        dom.zoneSelect.value = zone;
        submitValuation();
      }
    }, 50);
  }
}

async function fetchHistory() {
  try {
    const history = await fetchHistoryAPI();
    renderHistory(history);
  } catch (err) {
    console.warn('[ValueGuard] History fetch failed:', err);
  }
}

async function fetchTrends(locationId) {
  if (!locationId) {
    dom.trendsEmpty.hidden = false;
    dom.trendsChartWrap.hidden = true;
    dom.trendStats.hidden = true;
    dom.trendsSubtitle.textContent = 'Select a zone in the Valuate tab to load projected trend data.';
    return;
  }

  const specLevel = dom.sliderSpeculation.value;

  try {
    const { zone_name, city, data } = await fetchTrendsAPI(locationId, specLevel);

    dom.trendsSubtitle.textContent = `${zone_name}, ${city} — 12-Month Projected Trend`;
    dom.trendsEmpty.hidden     = true;
    dom.trendsChartWrap.hidden = false;
    dom.trendStats.hidden      = false;

    renderTrendsChart(data);
    renderTrendStats(data, zone_name);

  } catch (err) {
    console.error('[ValueGuard] Trends fetch failed:', err);
    dom.trendsEmpty.hidden = false;
    dom.trendsChartWrap.hidden = true;
    dom.trendStats.hidden = true;
    dom.trendsSubtitle.textContent = `Error loading trend data: ${err.message}`;
  }
}

async function submitValuation() {
  const locationId = dom.zoneSelect.value;
  if (!locationId) return;

  const payload = {
    location_id:     locationId,
    property_age:    Number(dom.sliderAge.value),
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

    if (document.getElementById('tab-trends').classList.contains('active')) {
      fetchTrends(locationId);
    }

    if (dom.emiBody && !dom.emiBody.hidden) {
      computeEMI();
    }

  } catch (err) {
    console.error('[ValueGuard] Valuation error:', err);
    showError(`Valuation failed: ${err.message}`);
    resetResultCards();
  }
}

function formulaEstimate(loc, age, metroKm, specLevel) {
  const base     = loc.circle_rate_per_sqft * loc.zone_multiplier;
  const metro    = loc.metro_nearby && metroKm < 2 ? 800 : loc.metro_nearby && metroKm < 5 ? 400 : 0;
  const deprec   = age * 120;
  const uplift   = specLevel * 500;
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

  const age     = Number(dom.sliderAge.value);
  const metroKm = Number(dom.sliderMetro.value);
  const spec    = Number(dom.sliderSpeculation.value);
  const market  = formulaEstimate(loc, age, metroKm, spec);
  const variance = parseFloat((((market - loc.circle_rate_per_sqft) / loc.circle_rate_per_sqft) * 100).toFixed(2));
  const risk    = variance < 20 ? 'Safe' : variance <= 50 ? 'Caution' : 'High Risk';

  state.pinnedZones.push({
    ...loc,
    market_value: market,
    variance_pct: variance,
    risk_level:   risk,
  });

  renderPinnedChips(unpinZone);
  renderCompareTable();
  renderRadarChart();
  showToast(`Pinned ${loc.zone_name}`);
}

async function copyShareURL() {
  encodeURLState();
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('Shareable link copied.');
  } catch {
    showToast('Copy failed — check clipboard permissions.');
  }
}

function initTabs() {
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      tabPanels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panelId = btn.getAttribute('aria-controls');
      document.getElementById(panelId).classList.add('active');

      if (panelId === 'tab-trends') {
        const zoneId = dom.zoneSelect.value || (state.lastResult ? state.lastResult.location_id : null);
        fetchTrends(zoneId);
      }
    });
  });
}

function updateSliderFill(el) {
  const min = Number(el.min);
  const max = Number(el.max);
  const val = Number(el.value);
  const pct = ((val - min) / (max - min)) * 100;
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

  // Initialize fills on page load
  requestAnimationFrame(() => {
    updateSliderFill(dom.sliderAge);
    updateSliderFill(dom.sliderMetro);
    updateSliderFill(dom.sliderSpeculation);
  });
}

function initRevealAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll('.reveal-card').forEach((el) => observer.observe(el));
}

const debouncedValuate = debounce(submitValuation, 300);

function initEventListeners() {
  dom.citySelect.addEventListener('change', () => {
    filterZonesByCity(dom.citySelect.value, dom.zoneSelect);
    renderHeatmap(dom.citySelect.value);
    resetResultCards();
  });
  dom.zoneSelect.addEventListener('change', debouncedValuate);

  dom.sliderAge.addEventListener('input', debouncedValuate);
  dom.sliderMetro.addEventListener('input', debouncedValuate);
  dom.sliderSpeculation.addEventListener('input', debouncedValuate);

  dom.compareCitySelect.addEventListener('change', () => {
    filterZonesByCity(dom.compareCitySelect.value, dom.compareZoneSelect);
    dom.btnPinZone.disabled = true;
  });
  dom.compareZoneSelect.addEventListener('change', () => {
    dom.btnPinZone.disabled = !dom.compareZoneSelect.value;
  });
  dom.btnPinZone.addEventListener('click', pinZone);

  dom.drawerToggle.addEventListener('click', () => {
    const isOpen = dom.historyDrawer.classList.toggle('open');
    dom.drawerToggle.setAttribute('aria-expanded', String(isOpen));
  });

  dom.btnCopyURL.addEventListener('click', copyShareURL);
  dom.btnPrint.addEventListener('click', () => {
    dom.printTimestamp.textContent = `Generated: ${new Date().toLocaleString('en-IN')}`;
    window.print();
  });

  dom.themeToggle.addEventListener('click', toggleTheme);

  dom.hamburgerBtn.addEventListener('click', () => {
    const isOpen = dom.sidebar.classList.contains('open');
    isOpen ? closeSidebar() : openSidebar();
  });
  dom.sidebarOverlay.addEventListener('click', closeSidebar);

  dom.emiToggle.addEventListener('click', () => {
    const expanded = dom.emiToggle.getAttribute('aria-expanded') === 'true';
    dom.emiToggle.setAttribute('aria-expanded', String(!expanded));
    dom.emiBody.hidden = expanded;
    if (!expanded && state.lastResult) computeEMI();
  });

  [dom.emiArea, dom.emiRate, dom.emiTenure, dom.emiIncome].forEach((el) => {
    el.addEventListener('input', debounce(computeEMI, 300));
  });

  dom.sensitivityAxis.addEventListener('change', updateSensitivityChart);
}

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
