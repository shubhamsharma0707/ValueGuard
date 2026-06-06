/**
 * ValueGuard — Frontend Application Script
 * Vanilla JS SPA connecting to the Express backend.
 *
 * Architecture:
 *  - On load: fetchLocations() populates city/zone dropdowns
 *  - All sliders and dropdowns trigger a debounced submitValuation()
 *  - All DOM updates come exclusively from server response data
 *  - Chart.js grouped bar chart updates on every valuation
 *  - History drawer populated from GET /api/history
 *  - Heatmap tab builds a color-coded table from location data
 *
 * @module script
 */

'use strict';

/* ============================================================
   1. Constants & State
   ============================================================ */

/** @type {string} Base URL of the backend API */
const API_BASE = 'http://localhost:3000/api';

/**
 * Global application state.
 * @type {{ locations: Array<Object>, lastResult: Object|null }}
 */
const state = {
  locations: [],   // all 15 zone objects from /api/locations
  lastResult: null, // most recent /api/valuate response
};

/** @type {Chart|null} Reference to the active Chart.js instance */
let comparisonChart = null;

/* ============================================================
   2. DOM References
   ============================================================ */
const citySelect        = document.getElementById('city-select');
const zoneSelect        = document.getElementById('zone-select');
const sliderAge         = document.getElementById('slider-age');
const sliderMetro       = document.getElementById('slider-metro');
const sliderSpeculation = document.getElementById('slider-speculation');
const valAge            = document.getElementById('val-age');
const valMetro          = document.getElementById('val-metro');
const valSpeculation    = document.getElementById('val-speculation');

const circleRateValue   = document.getElementById('circle-rate-value');
const marketRateValue   = document.getElementById('market-rate-value');
const circleRateZone    = document.getElementById('circle-rate-zone');
const marketRateRisk    = document.getElementById('market-rate-risk');
const cardCircle        = document.getElementById('card-circle');
const cardMarket        = document.getElementById('card-market');

const gaugeFill         = document.getElementById('gauge-fill');
const gaugeTrack        = document.querySelector('.gauge-track');
const riskBadge         = document.getElementById('risk-badge');
const insightCard       = document.getElementById('insight-card');
const insightIcon       = document.getElementById('insight-icon');
const insightText       = document.getElementById('insight-text');

const bdBase            = document.getElementById('bd-base');
const bdMetro           = document.getElementById('bd-metro');
const bdDepr            = document.getElementById('bd-depr');
const bdSpec            = document.getElementById('bd-spec');

const drawerToggle      = document.getElementById('drawer-toggle');
const drawerBody        = document.getElementById('drawer-body');
const historyDrawer     = document.getElementById('history-drawer');
const historyList       = document.getElementById('history-list');
const drawerCount       = document.getElementById('drawer-count');

const heatmapWrap       = document.getElementById('heatmap-table-wrap');
const heatmapSubtitle   = document.getElementById('heatmap-subtitle');

const errorBanner       = document.getElementById('error-banner');
const errorMessage      = document.getElementById('error-message');

const btnExportCSV      = document.getElementById('btn-export-csv');
const btnPrint          = document.getElementById('btn-print');
const topbarClock       = document.getElementById('topbar-clock');
const printTimestamp    = document.getElementById('print-timestamp');

/* ============================================================
   3. Utility Functions
   ============================================================ */

/**
 * Creates a debounced version of a function that delays invocation
 * until after `wait` milliseconds of silence.
 *
 * @param {Function} fn   - Function to debounce.
 * @param {number}   wait - Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
function debounce(fn, wait) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Formats a number as Indian Rupees with thousands separators.
 * @param {number} value - Number to format.
 * @returns {string} Formatted string e.g. "₹8,500".
 */
function formatINR(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return '₹' + Number(value).toLocaleString('en-IN');
}

/**
 * Returns a CSS class name corresponding to a risk level string.
 * @param {'Safe'|'Caution'|'High Risk'} riskLevel
 * @returns {'safe'|'caution'|'high'}
 */
function riskClass(riskLevel) {
  if (riskLevel === 'Safe') return 'safe';
  if (riskLevel === 'Caution') return 'caution';
  return 'high';
}

/**
 * Returns an emoji icon for a given risk level.
 * @param {'Safe'|'Caution'|'High Risk'} riskLevel
 * @returns {string} Emoji string.
 */
function riskIcon(riskLevel) {
  if (riskLevel === 'Safe') return '✅';
  if (riskLevel === 'Caution') return '⚠️';
  return '🚨';
}

/**
 * Returns the speculation label text for slider value.
 * @param {number} val - Speculation level (1–5).
 * @returns {string} Label string.
 */
function speculationLabel(val) {
  const labels = { 1: 'Minimal', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Extreme' };
  return `${val} — ${labels[val] || ''}`;
}

/* ============================================================
   4. Error Handling
   ============================================================ */

/**
 * Shows the inline error banner with a custom message.
 * @param {string} message - Error text to display.
 */
function showError(message) {
  errorMessage.textContent = message;
  errorBanner.classList.add('visible');
}

/** Hides the inline error banner. */
function hideError() {
  errorBanner.classList.remove('visible');
}

/* ============================================================
   5. Skeleton / Loading State
   ============================================================ */

/** Activates the shimmer skeleton on rate cards while a fetch is in-flight. */
function showSkeleton() {
  circleRateValue.innerHTML = '<div class="skeleton-block skeleton"></div>';
  marketRateValue.innerHTML = '<div class="skeleton-block skeleton"></div>';
  circleRateZone.textContent = '';
  marketRateRisk.textContent = '';
}

/** Removes the skeleton and restores the DOM ready for real values. */
function hideSkeleton() {
  // Content will be overwritten by updateResults()
}

/* ============================================================
   6. Clock
   ============================================================ */

/** Updates the topbar clock display. Runs every second. */
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  topbarClock.textContent = timeStr;
}

/* ============================================================
   7. Fetch Locations — Populate Dropdowns
   ============================================================ */

/**
 * Fetches all zone objects from GET /api/locations and populates
 * the city dropdown. Zone dropdown remains disabled until a city is chosen.
 * MUST be called on page load. Never hardcodes dropdown options.
 *
 * @async
 * @returns {Promise<void>}
 */
async function fetchLocations() {
  try {
    const res = await fetch(`${API_BASE}/locations`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.locations = data;
    hideError();

    // Extract unique cities preserving order
    const cities = [...new Set(data.map((loc) => loc.city))];

    citySelect.innerHTML = '<option value="">— Select City —</option>';
    cities.forEach((city) => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      citySelect.appendChild(opt);
    });

    citySelect.disabled = false;
  } catch (err) {
    console.error('[ValueGuard] Failed to load locations:', err);
    citySelect.innerHTML = '<option value="">⚠ Server Unavailable</option>';
    showError('Cannot reach the server at localhost:3000. Run: node backend/server.js');
  }
}

/**
 * Filters and repopulates the zone dropdown based on selected city.
 * Also triggers a heatmap rebuild for the selected city.
 *
 * @param {string} city - Selected city name.
 */
function filterZonesByCity(city) {
  zoneSelect.innerHTML = '<option value="">— Select Zone —</option>';
  zoneSelect.disabled = true;

  if (!city) {
    renderHeatmap(null);
    return;
  }

  const zones = state.locations.filter((loc) => loc.city === city);
  zones.forEach((loc) => {
    const opt = document.createElement('option');
    opt.value = loc.id;
    opt.textContent = loc.zone_name;
    zoneSelect.appendChild(opt);
  });

  zoneSelect.disabled = false;
  renderHeatmap(city);
}

/* ============================================================
   8. Valuation API Call
   ============================================================ */

/**
 * Reads current control values, shows skeleton, posts to /api/valuate,
 * then updates all DOM elements from the response.
 * Debounced by 300ms via the event listeners below.
 *
 * @async
 * @returns {Promise<void>}
 */
async function submitValuation() {
  const locationId = zoneSelect.value;
  if (!locationId) return;

  const payload = {
    location_id: locationId,
    property_age: Number(sliderAge.value),
    metro_distance_km: Number(sliderMetro.value),
    speculation_level: Number(sliderSpeculation.value),
  };

  showSkeleton();
  hideError();

  try {
    const res = await fetch(`${API_BASE}/valuate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    state.lastResult = data;
    hideSkeleton();
    updateResults(data);
    await fetchHistory();

  } catch (err) {
    console.error('[ValueGuard] Valuation error:', err);
    hideSkeleton();
    showError(`Valuation failed: ${err.message}`);
    resetResultCards();
  }
}

/* ============================================================
   9. DOM Update Functions
   ============================================================ */

/**
 * Master update function — applies all server response data to the UI.
 * Every DOM mutation must flow through here.
 *
 * @param {Object} data - Response from /api/valuate.
 */
function updateResults(data) {
  const cls = riskClass(data.risk_level);

  // --- Rate Cards ---
  circleRateValue.innerHTML = '';
  circleRateValue.textContent = formatINR(data.circle_rate);
  circleRateZone.textContent = data.zone_name + ', ' + data.city;

  marketRateValue.innerHTML = '';
  marketRateValue.textContent = formatINR(data.market_value);
  marketRateValue.className = `card-value ${cls}`;
  marketRateRisk.textContent = `${data.variance_pct > 0 ? '+' : ''}${data.variance_pct}% variance`;

  // Market card risk styling
  cardMarket.className = `rate-card risk-${cls}`;

  // --- Gauge ---
  updateGauge(data.variance_pct, cls);

  // --- Risk Badge ---
  riskBadge.textContent = data.risk_level;
  riskBadge.className = `risk-badge ${cls}`;

  // --- Insight Card ---
  insightIcon.textContent = riskIcon(data.risk_level);
  insightText.textContent = data.reason_text;
  insightCard.className = `insight-card ${cls} fade-in`;

  // --- Breakdown ---
  bdBase.textContent = formatINR(data.breakdown.base);
  bdMetro.textContent = data.breakdown.metro_premium > 0
    ? `+${formatINR(data.breakdown.metro_premium)}`
    : formatINR(0);
  bdDepr.textContent = `−${formatINR(data.breakdown.age_depreciation)}`;
  bdSpec.textContent = `+${formatINR(data.breakdown.speculative_uplift)}`;

  // --- Chart ---
  updateChart(data);

  // --- ARIA update ---
  gaugeTrack.setAttribute('aria-valuenow', Math.min(data.variance_pct, 100));
}

/**
 * Resets rate cards to default state when an error occurs.
 */
function resetResultCards() {
  circleRateValue.textContent = '—';
  marketRateValue.textContent = '—';
  cardMarket.className = 'rate-card';
  gaugeFill.style.width = '0%';
  gaugeFill.textContent = '0%';
  gaugeFill.className = 'gauge-fill';
  riskBadge.textContent = '—';
  riskBadge.className = 'risk-badge default';
}

/**
 * Animates the variance gauge bar with the appropriate color class.
 *
 * @param {number} variancePct - Variance percentage from server.
 * @param {string} cls         - CSS risk class: 'safe' | 'caution' | 'high'.
 */
function updateGauge(variancePct, cls) {
  // Cap at 100% visually; label still shows true value
  const displayWidth = Math.min(Math.abs(variancePct), 100);
  // Use requestAnimationFrame to trigger CSS transition properly
  requestAnimationFrame(() => {
    gaugeFill.style.width = `${displayWidth}%`;
    gaugeFill.textContent = `${variancePct}%`;
    gaugeFill.className = `gauge-fill ${cls}`;
  });
}

/* ============================================================
   10. Chart.js — Grouped Bar Chart
   ============================================================ */

/**
 * Computes the average circle rate and market rate for all zones in a city.
 *
 * @param {string} city - City name.
 * @returns {{ avgCircle: number, avgMarket: number }}
 */
function computeCityAverages(city) {
  const zones = state.locations.filter((l) => l.city === city);
  if (!zones.length) return { avgCircle: 0, avgMarket: 0 };
  const avgCircle = Math.round(zones.reduce((s, z) => s + z.circle_rate_per_sqft, 0) / zones.length);
  const avgMarket = Math.round(zones.reduce((s, z) => s + z.avg_market_rate_per_sqft, 0) / zones.length);
  return { avgCircle, avgMarket };
}

/**
 * Initialises or updates the Chart.js grouped bar chart.
 * Shows circle rate, estimated market rate, and city average for context.
 *
 * @param {Object} data - Response from /api/valuate.
 */
function updateChart(data) {
  const { avgCircle, avgMarket } = computeCityAverages(data.city);

  const chartData = {
    labels: [data.zone_name, `${data.city} Avg`],
    datasets: [
      {
        label: 'Circle Rate',
        data: [data.circle_rate, avgCircle],
        backgroundColor: 'rgba(0, 212, 255, 0.65)',
        borderColor: 'rgba(0, 212, 255, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Market Rate',
        data: [data.market_value, avgMarket],
        backgroundColor: riskBarColor(data.risk_level, 0.65),
        borderColor: riskBarColor(data.risk_level, 1),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a2235',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: '#94a3b8',
        bodyColor: '#e2e8f0',
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}/sqft`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (val) => `₹${Number(val).toLocaleString('en-IN')}`,
        },
        beginAtZero: false,
      },
    },
  };

  const canvas = document.getElementById('comparison-chart');
  const ctx = canvas.getContext('2d');

  if (comparisonChart) {
    comparisonChart.data = chartData;
    comparisonChart.update('active');
  } else {
    comparisonChart = new Chart(ctx, {
      type: 'bar',
      data: chartData,
      options: chartOptions,
    });
  }
}

/**
 * Returns an RGBA colour string based on risk level for chart bars.
 * @param {'Safe'|'Caution'|'High Risk'} riskLevel
 * @param {number} alpha - Opacity (0–1).
 * @returns {string} RGBA colour string.
 */
function riskBarColor(riskLevel, alpha) {
  if (riskLevel === 'Safe')      return `rgba(16, 185, 129, ${alpha})`;
  if (riskLevel === 'Caution')   return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(239, 68, 68, ${alpha})`;
}

/* ============================================================
   11. Query History Drawer
   ============================================================ */

/**
 * Fetches the last 5 valuations from GET /api/history and renders
 * them in the collapsible history drawer.
 *
 * @async
 * @returns {Promise<void>}
 */
async function fetchHistory() {
  try {
    const res = await fetch(`${API_BASE}/history`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const history = await res.json();
    renderHistory(history);
  } catch (err) {
    console.warn('[ValueGuard] History fetch failed:', err);
  }
}

/**
 * Renders history items in the drawer list.
 *
 * @param {Array<Object>} history - Array of past valuation results (max 5).
 */
function renderHistory(history) {
  drawerCount.textContent = history.length;

  if (!history.length) {
    historyList.innerHTML = '<p class="history-empty">No queries yet. Run a valuation to see history.</p>';
    return;
  }

  historyList.innerHTML = '';
  history.forEach((item) => {
    const cls = riskClass(item.risk_level);
    const div = document.createElement('div');
    div.className = 'history-item fade-in';
    div.innerHTML = `
      <div>
        <div class="history-zone">${escapeHTML(item.zone_name)}</div>
        <div class="history-city text-muted">${escapeHTML(item.city)}</div>
      </div>
      <div class="history-rate">₹${Number(item.market_value).toLocaleString('en-IN')}/sqft</div>
      <div class="history-variance ${cls}" style="font-family:var(--font-mono);font-size:0.75rem">
        ${item.variance_pct > 0 ? '+' : ''}${item.variance_pct}%
      </div>
      <span class="history-badge hm-badge ${cls}">${escapeHTML(item.risk_level)}</span>
    `;
    historyList.appendChild(div);
  });
}

/* ============================================================
   12. City Heatmap Table
   ============================================================ */

/**
 * Builds a color-coded HTML table for all zones in the selected city.
 * Uses static data from state.locations — no extra API call needed.
 *
 * Variance is calculated client-side using avg_market_rate_per_sqft
 * from the static data (for display only; exact values come from /api/valuate).
 *
 * @param {string|null} city - City name, or null to show empty state.
 */
function renderHeatmap(city) {
  if (!city) {
    heatmapWrap.innerHTML = '<div class="heatmap-empty">Select a city from the control panel to load the heatmap.</div>';
    heatmapSubtitle.textContent = 'Select a city to view all zones and their risk profile.';
    return;
  }

  const zones = state.locations.filter((loc) => loc.city === city);
  heatmapSubtitle.textContent = `${city} — ${zones.length} zone${zones.length !== 1 ? 's' : ''} in database`;

  if (!zones.length) {
    heatmapWrap.innerHTML = '<div class="heatmap-empty">No zones found for this city.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'heatmap-table';
  table.setAttribute('aria-label', `Zone heatmap for ${city}`);

  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Zone</th>
        <th scope="col">Circle Rate</th>
        <th scope="col">Market Rate</th>
        <th scope="col">Variance</th>
        <th scope="col">IT Corridor</th>
        <th scope="col">Metro</th>
        <th scope="col">Risk</th>
      </tr>
    </thead>
    <tbody id="heatmap-tbody"></tbody>
  `;

  const tbody = table.querySelector('#heatmap-tbody');

  zones.forEach((loc) => {
    const variance = parseFloat(
      (((loc.avg_market_rate_per_sqft - loc.circle_rate_per_sqft) / loc.circle_rate_per_sqft) * 100).toFixed(1)
    );
    const risk = variance < 20 ? 'Safe' : variance <= 50 ? 'Caution' : 'High Risk';
    const cls  = riskClass(risk);

    const tr = document.createElement('tr');
    tr.className = `row-${cls}`;
    tr.innerHTML = `
      <td class="col-zone">${escapeHTML(loc.zone_name)}</td>
      <td class="col-mono">₹${Number(loc.circle_rate_per_sqft).toLocaleString('en-IN')}</td>
      <td class="col-mono">₹${Number(loc.avg_market_rate_per_sqft).toLocaleString('en-IN')}</td>
      <td class="col-mono ${cls}">${variance > 0 ? '+' : ''}${variance}%</td>
      <td>${loc.it_corridor ? '✓' : '—'}</td>
      <td>${loc.metro_nearby ? '✓' : '—'}</td>
      <td><span class="hm-badge ${cls}">${escapeHTML(risk)}</span></td>
    `;
    tbody.appendChild(tr);
  });

  heatmapWrap.innerHTML = '';
  heatmapWrap.appendChild(table);
}

/* ============================================================
   13. Export Functions
   ============================================================ */

/**
 * Exports the last valuation result as a CSV file download.
 * Uses the Blob API for a pure-frontend download trigger.
 */
function exportCSV() {
  if (!state.lastResult) {
    showError('No valuation result to export. Run a valuation first.');
    return;
  }

  const d = state.lastResult;
  const headers = [
    'Zone', 'City', 'Circle Rate (₹/sqft)', 'Market Rate (₹/sqft)',
    'Variance %', 'Risk Level', 'Base Value', 'Metro Premium',
    'Age Depreciation', 'Speculative Uplift', 'Timestamp',
  ];
  const row = [
    d.zone_name, d.city, d.circle_rate, d.market_value,
    d.variance_pct, d.risk_level, d.breakdown.base,
    d.breakdown.metro_premium, d.breakdown.age_depreciation,
    d.breakdown.speculative_uplift, d.timestamp,
  ];

  const csvContent = [headers, row]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `valueguard-${d.zone_name.replace(/\s+/g, '-').toLowerCase()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ============================================================
   14. Security Utility
   ============================================================ */

/**
 * Escapes HTML special characters to prevent XSS injection.
 * @param {string} str - Raw string from API response.
 * @returns {string} HTML-safe string.
 */
function escapeHTML(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

/* ============================================================
   15. Tab Switching
   ============================================================ */

/**
 * Sets up tab button click handlers for the Valuate / City Heatmap tabs.
 */
function initTabs() {
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabPanels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panelId = btn.getAttribute('aria-controls');
      document.getElementById(panelId).classList.add('active');
    });
  });
}

/* ============================================================
   16. Slider Readout Helpers
   ============================================================ */

/**
 * Initialises live readout display updates for all three sliders.
 */
function initSliderReadouts() {
  sliderAge.addEventListener('input', () => {
    const v = sliderAge.value;
    valAge.textContent = `${v} yr${v === '1' ? '' : 's'}`;
    sliderAge.setAttribute('aria-valuenow', v);
  });

  sliderMetro.addEventListener('input', () => {
    const v = Number(sliderMetro.value).toFixed(1);
    valMetro.textContent = `${v} km`;
    sliderMetro.setAttribute('aria-valuenow', v);
  });

  sliderSpeculation.addEventListener('input', () => {
    const v = sliderSpeculation.value;
    valSpeculation.textContent = speculationLabel(Number(v));
    sliderSpeculation.setAttribute('aria-valuenow', v);
  });
}

/* ============================================================
   17. Event Wiring — Debounced API Calls
   ============================================================ */

/** Debounced version of submitValuation (300ms). */
const debouncedValuate = debounce(submitValuation, 300);

/**
 * Attaches all event listeners to controls.
 * Uses a single debounced handler for all slider inputs.
 */
function initEventListeners() {
  // City dropdown — filter zones, rebuild heatmap, no valuate call
  citySelect.addEventListener('change', () => {
    filterZonesByCity(citySelect.value);
    resetResultCards();
  });

  // Zone dropdown — trigger valuation
  zoneSelect.addEventListener('change', debouncedValuate);

  // Sliders — trigger debounced valuation
  sliderAge.addEventListener('input', debouncedValuate);
  sliderMetro.addEventListener('input', debouncedValuate);
  sliderSpeculation.addEventListener('input', debouncedValuate);

  // Drawer toggle
  drawerToggle.addEventListener('click', () => {
    const isOpen = historyDrawer.classList.toggle('open');
    drawerToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Export
  btnExportCSV.addEventListener('click', exportCSV);

  // Print
  btnPrint.addEventListener('click', () => {
    printTimestamp.textContent = `Generated: ${new Date().toLocaleString('en-IN')}`;
    window.print();
  });
}

/* ============================================================
   18. Init — Entry Point
   ============================================================ */

/**
 * Application entry point. Called on DOMContentLoaded.
 * Order: clock → tabs → sliders → events → fetch locations.
 */
async function init() {
  // Live clock
  updateClock();
  setInterval(updateClock, 1000);

  // UI setup
  initTabs();
  initSliderReadouts();
  initEventListeners();

  // Fetch data from backend
  await fetchLocations();
}

document.addEventListener('DOMContentLoaded', init);
