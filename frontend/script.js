/**
 * ValueGuard — Phase 2 Frontend Application Script
 * Vanilla JS SPA connecting to the Express backend.
 *
 * Phase 2 additions:
 *  - Zone Comparison Mode with radar chart
 *  - Historical Price Trends (line chart from /api/trends)
 *  - EMI / Loan Affordability Calculator with donut chart
 *  - Sensitivity Analysis Panel (client-side sweep)
 *  - Dark / Light theme toggle
 *  - Mobile sidebar (hamburger menu)
 *  - Shareable URL state (encode inputs in query params)
 *  - Scroll-driven reveal animations (Intersection Observer)
 *  - Animated number counter on rate cards
 *  - Toast notification system
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
 * @type {{ locations: Array<Object>, lastResult: Object|null, pinnedZones: Array<Object> }}
 */
const state = {
  locations:   [],       // All 15 zone objects from /api/locations
  lastResult:  null,     // Most recent /api/valuate response
  pinnedZones: [],       // Zones pinned for comparison (max 3)
};

/** @type {Chart|null} References to active Chart.js instances */
let comparisonChart  = null;
let emiChart         = null;
let sensitivityChart = null;
let radarChart       = null;
let trendsChart      = null;

/* ============================================================
   2. DOM References
   ============================================================ */

// Controls
const citySelect        = document.getElementById('city-select');
const zoneSelect        = document.getElementById('zone-select');
const sliderAge         = document.getElementById('slider-age');
const sliderMetro       = document.getElementById('slider-metro');
const sliderSpeculation = document.getElementById('slider-speculation');
const valAge            = document.getElementById('val-age');
const valMetro          = document.getElementById('val-metro');
const valSpeculation    = document.getElementById('val-speculation');

// Rate cards
const circleRateValue   = document.getElementById('circle-rate-value');
const marketRateValue   = document.getElementById('market-rate-value');
const circleRateZone    = document.getElementById('circle-rate-zone');
const marketRateRisk    = document.getElementById('market-rate-risk');
const cardCircle        = document.getElementById('card-circle');
const cardMarket        = document.getElementById('card-market');

// Gauge
const gaugeFill         = document.getElementById('gauge-fill');
const gaugeTrack        = document.querySelector('.gauge-track');
const riskBadge         = document.getElementById('risk-badge');

// Insight
const insightCard       = document.getElementById('insight-card');
const insightIcon       = document.getElementById('insight-icon');
const insightText       = document.getElementById('insight-text');

// Breakdown
const bdBase            = document.getElementById('bd-base');
const bdMetro           = document.getElementById('bd-metro');
const bdDepr            = document.getElementById('bd-depr');
const bdSpec            = document.getElementById('bd-spec');

// History drawer
const drawerToggle      = document.getElementById('drawer-toggle');
const drawerBody        = document.getElementById('drawer-body');
const historyDrawer     = document.getElementById('history-drawer');
const historyList       = document.getElementById('history-list');
const drawerCount       = document.getElementById('drawer-count');

// Heatmap
const heatmapWrap       = document.getElementById('heatmap-table-wrap');
const heatmapSubtitle   = document.getElementById('heatmap-subtitle');

// Error banner & export
const errorBanner       = document.getElementById('error-banner');
const errorMessage      = document.getElementById('error-message');
const btnExportCSV      = document.getElementById('btn-export-csv');
const btnCopyURL        = document.getElementById('btn-copy-url');
const btnPrint          = document.getElementById('btn-print');
const topbarClock       = document.getElementById('topbar-clock');
const printTimestamp    = document.getElementById('print-timestamp');

// Theme & mobile
const themeToggle       = document.getElementById('theme-toggle');
const themeIcon         = document.getElementById('theme-icon');
const hamburgerBtn      = document.getElementById('hamburger-btn');
const sidebar           = document.getElementById('sidebar');
const sidebarOverlay    = document.getElementById('sidebar-overlay');

// EMI
const emiToggle         = document.getElementById('emi-toggle');
const emiBody           = document.getElementById('emi-body');
const emiArea           = document.getElementById('emi-area');
const emiRate           = document.getElementById('emi-rate');
const emiTenure         = document.getElementById('emi-tenure');
const emiIncome         = document.getElementById('emi-income');
const emiLoanAmount     = document.getElementById('emi-loan-amount');
const emiMonthly        = document.getElementById('emi-monthly');
const emiInterest       = document.getElementById('emi-interest');
const emiBadge          = document.getElementById('emi-badge');

// Sensitivity
const sensitivityAxis   = document.getElementById('sensitivity-axis');
const sensitivityHint   = document.getElementById('sensitivity-hint');

// Compare
const compareCitySelect = document.getElementById('compare-city-select');
const compareZoneSelect = document.getElementById('compare-zone-select');
const btnPinZone        = document.getElementById('btn-pin-zone');
const pinnedChips       = document.getElementById('pinned-chips');
const compareTableWrap  = document.getElementById('compare-table-wrap');

// Trends
const trendsSubtitle    = document.getElementById('trends-subtitle');
const trendsEmpty       = document.getElementById('trends-empty');
const trendsChartWrap   = document.getElementById('trends-chart-wrap');
const trendStats        = document.getElementById('trend-stats');
const trendAppreciation = document.getElementById('trend-appreciation');
const trendPeak         = document.getElementById('trend-peak');
const trendTrough       = document.getElementById('trend-trough');
const trendAvgCircle    = document.getElementById('trend-avg-circle');

// Toast
const toast             = document.getElementById('toast');

/* ============================================================
   3. Utility Functions
   ============================================================ */

/**
 * Debounces a function.
 * @param {Function} fn - Function to debounce.
 * @param {number} wait - Delay in ms.
 * @returns {Function}
 */
function debounce(fn, wait) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Formats a number as Indian Rupees.
 * @param {number} value
 * @returns {string}
 */
function formatINR(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return '₹' + Number(value).toLocaleString('en-IN');
}

/** @param {'Safe'|'Caution'|'High Risk'} riskLevel @returns {'safe'|'caution'|'high'} */
function riskClass(riskLevel) {
  if (riskLevel === 'Safe')    return 'safe';
  if (riskLevel === 'Caution') return 'caution';
  return 'high';
}

/** @param {'Safe'|'Caution'|'High Risk'} riskLevel @returns {string} */
function riskIcon(riskLevel) {
  if (riskLevel === 'Safe')    return '✅';
  if (riskLevel === 'Caution') return '⚠️';
  return '🚨';
}

/** @param {number} val @returns {string} */
function speculationLabel(val) {
  const labels = { 1: 'Minimal', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Extreme' };
  return `${val} — ${labels[val] || ''}`;
}

/**
 * Escapes HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

/* ============================================================
   4. Toast Notification
   ============================================================ */

let toastTimer;

/**
 * Shows a temporary toast notification.
 * @param {string} message - Text to display.
 * @param {number} [duration=2500] - Duration in ms.
 */
function showToast(message, duration = 2500) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
}

/* ============================================================
   5. Error Handling
   ============================================================ */

function showError(message) {
  errorMessage.textContent = message;
  errorBanner.classList.add('visible');
}
function hideError() { errorBanner.classList.remove('visible'); }

/* ============================================================
   6. Skeleton / Loading State
   ============================================================ */

function showSkeleton() {
  circleRateValue.innerHTML = '<div class="skeleton-block skeleton"></div>';
  marketRateValue.innerHTML = '<div class="skeleton-block skeleton"></div>';
  circleRateZone.textContent = '';
  marketRateRisk.textContent = '';
}

/* ============================================================
   7. Clock
   ============================================================ */

function updateClock() {
  const now = new Date();
  topbarClock.textContent = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

/* ============================================================
   8. Theme Toggle
   ============================================================ */

/**
 * Initialises the dark/light theme. Reads from localStorage if set,
 * otherwise defaults to dark mode.
 */
function initTheme() {
  const saved = localStorage.getItem('vg-theme') || 'dark';
  applyTheme(saved);
}

/**
 * Applies a theme to the document root.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeIcon.textContent = '🌙';
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeIcon.textContent = '☀️';
  }
  localStorage.setItem('vg-theme', theme);
  // Refresh charts to pick up new colours
  if (comparisonChart) { comparisonChart.update(); }
  if (trendsChart)     { trendsChart.update(); }
}

function toggleTheme() {
  const current = localStorage.getItem('vg-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ============================================================
   9. Mobile Sidebar
   ============================================================ */

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('visible');
  sidebarOverlay.removeAttribute('aria-hidden');
  hamburgerBtn.classList.add('open');
  hamburgerBtn.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
  sidebarOverlay.setAttribute('aria-hidden', 'true');
  hamburgerBtn.classList.remove('open');
  hamburgerBtn.setAttribute('aria-expanded', 'false');
}

/* ============================================================
   10. Reveal Animations (Intersection Observer)
   ============================================================ */

/**
 * Sets up IntersectionObserver on all .reveal-card elements
 * so they fade in as they enter the viewport.
 */
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

/* ============================================================
   11. Animated Number Counter
   ============================================================ */

/**
 * Animates a numeric value change on a DOM element.
 * @param {HTMLElement} el      - Target element.
 * @param {number}      target  - Final numeric value.
 * @param {string}      prefix  - Prefix string (e.g. '₹').
 * @param {number}      [duration=400] - Animation duration ms.
 */
function animateNumber(el, target, prefix = '', duration = 400) {
  const start     = performance.now();
  const startVal  = parseFloat(el.dataset.rawValue || '0') || 0;
  el.dataset.rawValue = String(target);

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current  = Math.round(startVal + (target - startVal) * eased);
    el.textContent = prefix + Number(current).toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(step);
  }

  el.classList.add('number-flip');
  setTimeout(() => el.classList.remove('number-flip'), 400);
  requestAnimationFrame(step);
}

/* ============================================================
   12. Fetch Locations — Populate Dropdowns
   ============================================================ */

/**
 * Fetches all zone objects from GET /api/locations and populates
 * city dropdowns (main + compare tab).
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

    const cities = [...new Set(data.map((loc) => loc.city))];

    // Main sidebar city select
    citySelect.innerHTML = '<option value="">— Select City —</option>';
    cities.forEach((city) => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      citySelect.appendChild(opt);
    });
    citySelect.disabled = false;

    // Compare tab city select (mirror)
    compareCitySelect.innerHTML = '<option value="">— Select City —</option>';
    cities.forEach((city) => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      compareCitySelect.appendChild(opt);
    });

    // Parse URL params after locations are loaded
    applyURLParams();

  } catch (err) {
    console.error('[ValueGuard] Failed to load locations:', err);
    citySelect.innerHTML = '<option value="">⚠ Server Unavailable</option>';
    showError('Cannot reach the server at localhost:3000. Run: node backend/server.js');
  }
}

/**
 * Filters zone dropdown by city.
 * @param {string} city
 * @param {HTMLSelectElement} zoneEl
 */
function filterZonesByCity(city, zoneEl) {
  zoneEl.innerHTML = '<option value="">— Select Zone —</option>';
  zoneEl.disabled = true;

  if (!city) return;

  state.locations
    .filter((loc) => loc.city === city)
    .forEach((loc) => {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.textContent = loc.zone_name;
      zoneEl.appendChild(opt);
    });

  zoneEl.disabled = false;
}

/* ============================================================
   13. URL State — Shareable Links
   ============================================================ */

/**
 * Encodes current control values into the URL query string.
 */
function encodeURLState() {
  const params = new URLSearchParams({
    city:  citySelect.value || '',
    zone:  zoneSelect.value || '',
    age:   sliderAge.value,
    metro: sliderMetro.value,
    spec:  sliderSpeculation.value,
  });
  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', url);
}

/**
 * Reads URL query params and auto-populates controls.
 * Called after locations are loaded.
 */
function applyURLParams() {
  const params = new URLSearchParams(window.location.search);
  const city   = params.get('city');
  const zone   = params.get('zone');
  const age    = params.get('age');
  const metro  = params.get('metro');
  const spec   = params.get('spec');

  if (city && citySelect.querySelector(`option[value="${CSS.escape(city)}"]`)) {
    citySelect.value = city;
    filterZonesByCity(city, zoneSelect);
    renderHeatmap(city);
    filterZonesByCity(city, compareZoneSelect);
  }

  if (age)   { sliderAge.value = age; valAge.textContent = `${age} yr${age === '1' ? '' : 's'}`; }
  if (metro) { sliderMetro.value = metro; valMetro.textContent = `${Number(metro).toFixed(1)} km`; }
  if (spec)  { sliderSpeculation.value = spec; valSpeculation.textContent = speculationLabel(Number(spec)); }

  if (zone) {
    // Delay so zone dropdown is populated
    setTimeout(() => {
      if (zoneSelect.querySelector(`option[value="${CSS.escape(zone)}"]`)) {
        zoneSelect.value = zone;
        submitValuation();
      }
    }, 50);
  }
}

/* ============================================================
   14. Valuation API Call
   ============================================================ */

/**
 * Posts to /api/valuate and updates the entire UI.
 * @async
 * @returns {Promise<void>}
 */
async function submitValuation() {
  const locationId = zoneSelect.value;
  if (!locationId) return;

  const payload = {
    location_id:     locationId,
    property_age:    Number(sliderAge.value),
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
    state.lastResult = { ...data, location_id: locationId };
    updateResults(data);
    await fetchHistory();
    updateSensitivityChart();
    encodeURLState();

    // Auto-fetch trends if on trends tab
    if (document.getElementById('tab-trends').classList.contains('active')) {
      fetchTrends(locationId);
    }

    // Auto-update EMI if calculator is open
    if (emiBody && !emiBody.hidden) {
      computeEMI();
    }

  } catch (err) {
    console.error('[ValueGuard] Valuation error:', err);
    showError(`Valuation failed: ${err.message}`);
    resetResultCards();
  }
}

/* ============================================================
   15. DOM Update Functions
   ============================================================ */

/**
 * Master update function — applies all server response data to the UI.
 * @param {Object} data - Response from /api/valuate.
 */
function updateResults(data) {
  const cls = riskClass(data.risk_level);

  // Rate cards with animated counter
  const circleNum = data.circle_rate;
  const marketNum = data.market_value;

  circleRateValue.className = 'card-value';
  animateNumber(circleRateValue, circleNum, '₹');
  circleRateZone.textContent = data.zone_name + ', ' + data.city;

  marketRateValue.className = `card-value ${cls}`;
  animateNumber(marketRateValue, marketNum, '₹');
  marketRateRisk.textContent = `${data.variance_pct > 0 ? '+' : ''}${data.variance_pct}% variance`;

  cardMarket.className = `rate-card glass-card reveal-card revealed risk-${cls}`;

  // Gauge
  updateGauge(data.variance_pct, cls);

  // Risk badge
  riskBadge.textContent = data.risk_level;
  riskBadge.className   = `risk-badge ${cls}`;

  // Insight
  insightIcon.textContent = riskIcon(data.risk_level);
  insightText.textContent = data.reason_text;
  insightCard.className   = `insight-card glass-card reveal-card revealed ${cls}`;

  // Breakdown
  bdBase.textContent  = formatINR(data.breakdown.base);
  bdMetro.textContent = data.breakdown.metro_premium > 0
    ? `+${formatINR(data.breakdown.metro_premium)}`
    : formatINR(0);
  bdDepr.textContent  = `−${formatINR(data.breakdown.age_depreciation)}`;
  bdSpec.textContent  = `+${formatINR(data.breakdown.speculative_uplift)}`;

  // Chart
  updateChart(data);

  // ARIA
  gaugeTrack.setAttribute('aria-valuenow', Math.min(data.variance_pct, 100));
}

/**
 * Resets rate cards to default state.
 */
function resetResultCards() {
  circleRateValue.textContent = '—';
  marketRateValue.textContent = '—';
  cardMarket.className = 'rate-card glass-card reveal-card revealed';
  gaugeFill.style.width = '0%';
  gaugeFill.textContent = '0%';
  gaugeFill.className = 'gauge-fill';
  riskBadge.textContent = '—';
  riskBadge.className = 'risk-badge default';
}

/**
 * Animates the variance gauge bar.
 * @param {number} variancePct
 * @param {string} cls
 */
function updateGauge(variancePct, cls) {
  const displayWidth = Math.min(Math.abs(variancePct), 100);
  requestAnimationFrame(() => {
    gaugeFill.style.width = `${displayWidth}%`;
    gaugeFill.textContent  = `${variancePct}%`;
    gaugeFill.className    = `gauge-fill ${cls}`;
  });
}

/* ============================================================
   16. Chart.js — Grouped Bar Chart
   ============================================================ */

function computeCityAverages(city) {
  const zones = state.locations.filter((l) => l.city === city);
  if (!zones.length) return { avgCircle: 0, avgMarket: 0 };
  const avgCircle = Math.round(zones.reduce((s, z) => s + z.circle_rate_per_sqft, 0) / zones.length);
  const avgMarket = Math.round(zones.reduce((s, z) => s + z.avg_market_rate_per_sqft, 0) / zones.length);
  return { avgCircle, avgMarket };
}

function riskBarColor(riskLevel, alpha) {
  if (riskLevel === 'Safe')    return `rgba(16, 185, 129, ${alpha})`;
  if (riskLevel === 'Caution') return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(239, 68, 68, ${alpha})`;
}

/**
 * Initialises or updates the Chart.js grouped bar chart.
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
        backgroundColor: 'rgba(0, 212, 255, 0.55)',
        borderColor: 'rgba(0, 212, 255, 1)',
        borderWidth: 1,
        borderRadius: 5,
      },
      {
        label: 'Market Rate',
        data: [data.market_value, avgMarket],
        backgroundColor: riskBarColor(data.risk_level, 0.55),
        borderColor:     riskBarColor(data.risk_level, 1),
        borderWidth: 1,
        borderRadius: 5,
      },
    ],
  };

  const opts = chartBaseOptions();

  const canvas = document.getElementById('comparison-chart');
  if (comparisonChart) {
    comparisonChart.data = chartData;
    comparisonChart.update('active');
  } else {
    comparisonChart = new Chart(canvas.getContext('2d'), {
      type: 'bar', data: chartData, options: opts,
    });
  }
}

/**
 * Returns shared Chart.js options for the current theme.
 * @returns {Object}
 */
function chartBaseOptions() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridClr = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
  const tickClr = isLight ? '#475569' : '#94a3b8';
  const tipBg   = isLight ? '#ffffff' : '#1a2235';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tipBg,
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: '#94a3b8',
        bodyColor: isLight ? '#1e293b' : '#e2e8f0',
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}/sqft`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: gridClr },
        ticks: { color: tickClr, font: { size: 11 } },
      },
      y: {
        grid: { color: gridClr },
        ticks: {
          color: tickClr, font: { size: 11 },
          callback: (val) => `₹${Number(val).toLocaleString('en-IN')}`,
        },
        beginAtZero: false,
      },
    },
  };
}

/* ============================================================
   17. Query History Drawer
   ============================================================ */

async function fetchHistory() {
  try {
    const res = await fetch(`${API_BASE}/history`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderHistory(await res.json());
  } catch (err) {
    console.warn('[ValueGuard] History fetch failed:', err);
  }
}

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
   18. City Heatmap Table
   ============================================================ */

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
    const tr   = document.createElement('tr');
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
   19. EMI / Loan Calculator
   ============================================================ */

/**
 * Computes the monthly EMI using the standard formula:
 * EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 * where r = monthly interest rate, n = tenure in months.
 */
function computeEMI() {
  if (!state.lastResult) return;

  const sqft       = Number(emiArea.value) || 1000;
  const annualRate = Number(emiRate.value) / 100;
  const months     = Number(emiTenure.value) * 12;
  const income     = Number(emiIncome.value) || 150000;

  const loanAmount = Math.round(state.lastResult.market_value * sqft);
  const r          = annualRate / 12;

  let emi;
  if (r === 0) {
    emi = Math.round(loanAmount / months);
  } else {
    emi = Math.round(loanAmount * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
  }

  const totalPayment  = emi * months;
  const totalInterest = totalPayment - loanAmount;
  const emiRatio      = emi / income;

  emiLoanAmount.textContent = formatINR(loanAmount);
  emiMonthly.textContent    = formatINR(emi) + '/mo';
  emiInterest.textContent   = formatINR(totalInterest);

  let affordLabel = 'Affordable';
  let affordCls   = 'affordable';
  if (emiRatio > 0.5) { affordLabel = 'High Burden'; affordCls = 'burden'; }
  else if (emiRatio > 0.35) { affordLabel = 'Stretch'; affordCls = 'stretch'; }
  emiBadge.textContent = `${affordLabel} (${Math.round(emiRatio * 100)}% of income)`;
  emiBadge.className   = `emi-badge ${affordCls}`;

  // Donut chart
  updateEMIChart(loanAmount, totalInterest);
}

/**
 * Initialises or updates the EMI donut chart.
 * @param {number} principal
 * @param {number} interest
 */
function updateEMIChart(principal, interest) {
  const canvas = document.getElementById('emi-chart');
  const ctx    = canvas.getContext('2d');

  const data = {
    labels: ['Principal', 'Total Interest'],
    datasets: [{
      data: [principal, interest],
      backgroundColor: ['rgba(0,212,255,0.7)', 'rgba(239,68,68,0.6)'],
      borderColor:     ['rgba(0,212,255,1)',   'rgba(239,68,68,1)'],
      borderWidth: 1,
      hoverOffset: 4,
    }],
  };

  if (emiChart) {
    emiChart.data = data;
    emiChart.update('active');
  } else {
    emiChart = new Chart(ctx, {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}`,
            },
          },
        },
      },
    });
  }
}

/* ============================================================
   20. Sensitivity Analysis
   ============================================================ */

/**
 * Formula constants (mirrors backend logic).
 * @param {Object} loc
 * @param {number} age
 * @param {number} metroKm
 * @param {number} specLevel
 * @returns {number} Estimated market value
 */
function formulaEstimate(loc, age, metroKm, specLevel) {
  const base     = loc.circle_rate_per_sqft * loc.zone_multiplier;
  const metro    = loc.metro_nearby && metroKm < 2 ? 800 : loc.metro_nearby && metroKm < 5 ? 400 : 0;
  const deprec   = age * 120;
  const uplift   = specLevel * 500;
  return Math.round(base + metro - deprec + uplift);
}

/**
 * Updates the sensitivity analysis sparkline for the current zone.
 */
function updateSensitivityChart() {
  if (!state.lastResult) {
    sensitivityHint.textContent = 'Run a valuation to enable sensitivity analysis.';
    return;
  }

  const loc = state.locations.find((l) => l.zone_name === state.lastResult.zone_name && l.city === state.lastResult.city);
  if (!loc) return;

  sensitivityHint.textContent = '';

  const axis    = sensitivityAxis.value;
  const age     = Number(sliderAge.value);
  const metroKm = Number(sliderMetro.value);
  const spec    = Number(sliderSpeculation.value);

  let labels = [], values = [];

  if (axis === 'speculation') {
    for (let s = 1; s <= 5; s++) {
      labels.push(`Level ${s}`);
      values.push(formulaEstimate(loc, age, metroKm, s));
    }
  } else if (axis === 'age') {
    for (let a = 0; a <= 40; a += 5) {
      labels.push(`${a}yr`);
      values.push(formulaEstimate(loc, a, metroKm, spec));
    }
  } else {
    for (let m = 0; m <= 10; m += 1) {
      labels.push(`${m}km`);
      values.push(formulaEstimate(loc, age, m, spec));
    }
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridClr = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
  const tickClr = isLight ? '#475569' : '#94a3b8';

  const canvas = document.getElementById('sensitivity-chart');
  const ctx    = canvas.getContext('2d');

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, 120);
  grad.addColorStop(0,   'rgba(0,212,255,0.3)');
  grad.addColorStop(1,   'rgba(0,212,255,0)');

  const data = {
    labels,
    datasets: [{
      label: 'Market Value',
      data: values,
      borderColor: 'rgba(0,212,255,0.9)',
      backgroundColor: grad,
      borderWidth: 1.5,
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 4,
    }],
  };

  if (sensitivityChart) {
    sensitivityChart.data = data;
    sensitivityChart.update('active');
  } else {
    sensitivityChart = new Chart(ctx, {
      type: 'line',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ₹${Number(ctx.raw).toLocaleString('en-IN')}/sqft`,
            },
          },
        },
        scales: {
          x: { grid: { color: gridClr }, ticks: { color: tickClr, font: { size: 9 } } },
          y: {
            grid: { color: gridClr },
            ticks: {
              color: tickClr, font: { size: 9 },
              callback: (v) => `₹${(v / 1000).toFixed(0)}k`,
            },
          },
        },
      },
    });
  }
}

/* ============================================================
   21. Zone Comparison
   ============================================================ */

/**
 * Pins the selected zone for comparison (max 3).
 */
function pinZone() {
  const locationId = compareZoneSelect.value;
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

  // Compute default valuation for pinned zone (neutral params)
  const age     = Number(sliderAge.value);
  const metroKm = Number(sliderMetro.value);
  const spec    = Number(sliderSpeculation.value);
  const market  = formulaEstimate(loc, age, metroKm, spec);
  const variance = parseFloat((((market - loc.circle_rate_per_sqft) / loc.circle_rate_per_sqft) * 100).toFixed(2));
  const risk    = variance < 20 ? 'Safe' : variance <= 50 ? 'Caution' : 'High Risk';

  state.pinnedZones.push({
    ...loc,
    market_value: market,
    variance_pct: variance,
    risk_level:   risk,
  });

  renderPinnedChips();
  renderCompareTable();
  renderRadarChart();
  showToast(`📌 Pinned ${loc.zone_name}`);
}

/**
 * Unpins a zone by id.
 * @param {string} id
 */
function unpinZone(id) {
  state.pinnedZones = state.pinnedZones.filter((z) => z.id !== id);
  renderPinnedChips();
  renderCompareTable();
  renderRadarChart();
}

/**
 * Renders the pinned zone chips.
 */
function renderPinnedChips() {
  pinnedChips.innerHTML = '';
  if (!state.pinnedZones.length) {
    pinnedChips.innerHTML = '<span style="font-size:0.72rem;color:var(--clr-text-dim)">No zones pinned yet</span>';
    return;
  }
  state.pinnedZones.forEach((z) => {
    const cls  = riskClass(z.risk_level);
    const chip = document.createElement('div');
    chip.className = `pinned-chip chip-${cls}`;
    chip.innerHTML = `
      <span>${escapeHTML(z.zone_name)}</span>
      <button aria-label="Unpin ${escapeHTML(z.zone_name)}" onclick="unpinZone('${escapeHTML(z.id)}')">✕</button>
    `;
    pinnedChips.appendChild(chip);
  });
}

/**
 * Renders the comparison table for pinned zones.
 */
function renderCompareTable() {
  if (!state.pinnedZones.length) {
    compareTableWrap.innerHTML = '<div class="compare-empty">Pin at least one zone above to start comparing.</div>';
    return;
  }

  const age     = Number(sliderAge.value);
  const metroKm = Number(sliderMetro.value);
  const spec    = Number(sliderSpeculation.value);

  // Recompute with current slider values
  const zones = state.pinnedZones.map((z) => {
    const market   = formulaEstimate(z, age, metroKm, spec);
    const variance = parseFloat((((market - z.circle_rate_per_sqft) / z.circle_rate_per_sqft) * 100).toFixed(2));
    const risk     = variance < 20 ? 'Safe' : variance <= 50 ? 'Caution' : 'High Risk';
    return { ...z, market_value: market, variance_pct: variance, risk_level: risk };
  });

  const table = document.createElement('table');
  table.className = 'compare-table';
  table.setAttribute('aria-label', 'Zone comparison table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Zone</th>
        <th>City</th>
        <th>Circle Rate</th>
        <th>Market Rate</th>
        <th>Variance</th>
        <th>Base Mult.</th>
        <th>IT Corridor</th>
        <th>Metro</th>
        <th>Risk</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  zones.forEach((z) => {
    const cls = riskClass(z.risk_level);
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(z.zone_name)}</td>
      <td style="color:var(--clr-text-muted)">${escapeHTML(z.city)}</td>
      <td>₹${Number(z.circle_rate_per_sqft).toLocaleString('en-IN')}</td>
      <td style="color:${cls === 'safe' ? 'var(--clr-safe)' : cls === 'caution' ? 'var(--clr-caution)' : 'var(--clr-high)'}">₹${Number(z.market_value).toLocaleString('en-IN')}</td>
      <td class="col-mono ${cls}">${z.variance_pct > 0 ? '+' : ''}${z.variance_pct}%</td>
      <td>${z.zone_multiplier}×</td>
      <td>${z.it_corridor ? '✓' : '—'}</td>
      <td>${z.metro_nearby ? '✓' : '—'}</td>
      <td><span class="hm-badge ${cls}">${escapeHTML(z.risk_level)}</span></td>
    `;
    tbody.appendChild(tr);
  });

  compareTableWrap.innerHTML = '';
  compareTableWrap.appendChild(table);
}

/**
 * Renders a radar chart for pinned zones across 5 factors.
 */
function renderRadarChart() {
  if (!state.pinnedZones.length) return;

  const age     = Number(sliderAge.value);
  const metroKm = Number(sliderMetro.value);
  const spec    = Number(sliderSpeculation.value);

  const colours = [
    { border: 'rgba(0,212,255,0.9)',   bg: 'rgba(0,212,255,0.12)' },
    { border: 'rgba(99,102,241,0.9)',  bg: 'rgba(99,102,241,0.12)' },
    { border: 'rgba(245,158,11,0.9)', bg: 'rgba(245,158,11,0.12)' },
  ];

  // Normalise each factor to 0–100 relative to all locations
  const allLocs = state.locations;
  const max = {
    circle:     Math.max(...allLocs.map((l) => l.circle_rate_per_sqft)),
    market:     Math.max(...allLocs.map((l) => formulaEstimate(l, age, metroKm, spec))),
    multiplier: Math.max(...allLocs.map((l) => l.zone_multiplier)),
    metro:      1,  // boolean
    itCorridor: 1,  // boolean
  };

  const datasets = state.pinnedZones.map((z, i) => {
    const market = formulaEstimate(z, age, metroKm, spec);
    return {
      label: z.zone_name,
      data: [
        Math.round((z.circle_rate_per_sqft / max.circle)   * 100),
        Math.round((market / max.market)                   * 100),
        Math.round(((z.zone_multiplier - 1) / (max.multiplier - 1 || 1)) * 100),
        z.metro_nearby    ? 100 : 0,
        z.it_corridor     ? 100 : 0,
      ],
      borderColor:     colours[i].border,
      backgroundColor: colours[i].bg,
      borderWidth: 2,
      pointBackgroundColor: colours[i].border,
      pointRadius: 4,
    };
  });

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridClr = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)';
  const tickClr = isLight ? '#475569' : '#94a3b8';

  const canvas = document.getElementById('radar-chart');
  if (radarChart) {
    radarChart.data.datasets = datasets;
    radarChart.update('active');
    return;
  }

  radarChart = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['Circle Rate', 'Market Rate', 'Multiplier', 'Metro Nearby', 'IT Corridor'],
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0, max: 100,
          grid:       { color: gridClr },
          angleLines: { color: gridClr },
          pointLabels: { color: tickClr, font: { size: 11 } },
          ticks: { display: false },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: tickClr, font: { size: 11 }, boxWidth: 12 },
        },
      },
    },
  });
}

/* ============================================================
   22. Historical Trends
   ============================================================ */

/**
 * Fetches 12-month trend data from /api/trends/:location_id.
 * @param {string} locationId
 * @async
 */
async function fetchTrends(locationId) {
  if (!locationId) {
    trendsEmpty.hidden = false;
    trendsChartWrap.hidden = true;
    trendStats.hidden = true;
    trendsSubtitle.textContent = 'Select a zone in the Valuate tab to load 12-month trend data.';
    return;
  }

  const specLevel = sliderSpeculation.value;

  try {
    const res = await fetch(`${API_BASE}/trends/${locationId}?speculation=${specLevel}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { zone_name, city, data } = await res.json();

    trendsSubtitle.textContent = `${zone_name}, ${city} — 12-Month Historical Trend (Simulated)`;
    trendsEmpty.hidden     = true;
    trendsChartWrap.hidden = false;
    trendStats.hidden      = false;

    renderTrendsChart(data);
    renderTrendStats(data, zone_name);

  } catch (err) {
    console.error('[ValueGuard] Trends fetch failed:', err);
    trendsEmpty.hidden = false;
    trendsChartWrap.hidden = true;
    trendStats.hidden = true;
    trendsSubtitle.textContent = `Error loading trend data: ${err.message}`;
  }
}

/**
 * Renders the line chart from trend data.
 * @param {Array<{month:string, circle_rate:number, market_rate:number}>} data
 */
function renderTrendsChart(data) {
  const labels  = data.map((d) => d.month);
  const mktVals = data.map((d) => d.market_rate);
  const cirVals = data.map((d) => d.circle_rate);

  const canvas = document.getElementById('trends-chart');
  const ctx    = canvas.getContext('2d');

  // Gradient fill for market rate
  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, 'rgba(0,212,255,0.25)');
  grad.addColorStop(1, 'rgba(0,212,255,0)');

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridClr = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
  const tickClr = isLight ? '#475569' : '#94a3b8';

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Market Rate',
        data: mktVals,
        borderColor: 'rgba(0,212,255,0.9)',
        backgroundColor: grad,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: 'rgba(0,212,255,1)',
      },
      {
        label: 'Circle Rate',
        data: cirVals,
        borderColor: 'rgba(100,116,139,0.7)',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [4, 4],
        fill: false,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: 'rgba(100,116,139,1)',
      },
    ],
  };

  if (trendsChart) {
    trendsChart.data = chartData;
    trendsChart.update('active');
    return;
  }

  trendsChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLight ? '#fff' : '#1a2235',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: tickClr,
          bodyColor:  isLight ? '#1e293b' : '#e2e8f0',
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}/sqft`,
          },
        },
      },
      scales: {
        x: { grid: { color: gridClr }, ticks: { color: tickClr, font: { size: 10 } } },
        y: {
          grid: { color: gridClr },
          ticks: {
            color: tickClr, font: { size: 10 },
            callback: (v) => `₹${Number(v).toLocaleString('en-IN')}`,
          },
        },
      },
    },
  });
}

/**
 * Renders trend stat cards.
 * @param {Array} data
 * @param {string} zoneName
 */
function renderTrendStats(data, zoneName) {
  const mktVals = data.map((d) => d.market_rate);
  const cirVals = data.map((d) => d.circle_rate);

  const first       = mktVals[0];
  const last        = mktVals[mktVals.length - 1];
  const appreciation = parseFloat((((last - first) / first) * 100).toFixed(1));
  const peak        = Math.max(...mktVals);
  const trough      = Math.min(...mktVals);
  const avgCircle   = Math.round(cirVals.reduce((a, b) => a + b, 0) / cirVals.length);

  trendAppreciation.textContent = `${appreciation > 0 ? '+' : ''}${appreciation}%`;
  trendAppreciation.style.color = appreciation >= 0 ? 'var(--clr-safe)' : 'var(--clr-high)';
  trendPeak.textContent         = formatINR(peak) + '/sqft';
  trendTrough.textContent       = formatINR(trough) + '/sqft';
  trendAvgCircle.textContent    = formatINR(avgCircle) + '/sqft';
}

/* ============================================================
   23. Export Functions
   ============================================================ */

function exportCSV() {
  if (!state.lastResult) {
    showError('No valuation result to export. Run a valuation first.');
    return;
  }

  const d = state.lastResult;
  const headers = [
    'Zone', 'City', 'Circle Rate (₹/sqft)', 'Market Rate (₹/sqft)',
    'Variance %', 'Risk Level', 'Base Value', 'Metro Premium',
    'Age Depreciation', 'Speculative Uplift', 'Property Age', 'Metro Distance', 'Speculation Level', 'Timestamp',
  ];
  const row = [
    d.zone_name, d.city, d.circle_rate, d.market_value,
    d.variance_pct, d.risk_level, d.breakdown.base,
    d.breakdown.metro_premium, d.breakdown.age_depreciation,
    d.breakdown.speculative_uplift, sliderAge.value, sliderMetro.value, sliderSpeculation.value, d.timestamp,
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
  showToast('✅ CSV exported successfully');
}

/**
 * Copies the current shareable URL to the clipboard.
 */
async function copyShareURL() {
  encodeURLState();
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('🔗 Shareable link copied!');
  } catch {
    showToast('Copy failed — check clipboard permissions.');
  }
}

/* ============================================================
   24. Tab Switching
   ============================================================ */

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

      // Lazy-load trends chart when switching to that tab
      if (panelId === 'tab-trends') {
        const zoneId = zoneSelect.value || (state.lastResult ? state.lastResult.location_id : null);
        fetchTrends(zoneId);
      }
    });
  });
}

/* ============================================================
   25. Slider Readout Helpers
   ============================================================ */

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
   26. Event Wiring
   ============================================================ */

const debouncedValuate = debounce(submitValuation, 300);

function initEventListeners() {
  // Main city/zone
  citySelect.addEventListener('change', () => {
    filterZonesByCity(citySelect.value, zoneSelect);
    renderHeatmap(citySelect.value);
    resetResultCards();
  });
  zoneSelect.addEventListener('change', debouncedValuate);

  // Sliders
  sliderAge.addEventListener('input', debouncedValuate);
  sliderMetro.addEventListener('input', debouncedValuate);
  sliderSpeculation.addEventListener('input', debouncedValuate);

  // Compare city/zone
  compareCitySelect.addEventListener('change', () => {
    filterZonesByCity(compareCitySelect.value, compareZoneSelect);
    btnPinZone.disabled = true;
  });
  compareZoneSelect.addEventListener('change', () => {
    btnPinZone.disabled = !compareZoneSelect.value;
  });
  btnPinZone.addEventListener('click', pinZone);

  // History drawer
  drawerToggle.addEventListener('click', () => {
    const isOpen = historyDrawer.classList.toggle('open');
    drawerToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Export
  btnExportCSV.addEventListener('click', exportCSV);
  btnCopyURL.addEventListener('click', copyShareURL);
  btnPrint.addEventListener('click', () => {
    printTimestamp.textContent = `Generated: ${new Date().toLocaleString('en-IN')}`;
    window.print();
  });

  // Theme
  themeToggle.addEventListener('click', toggleTheme);

  // Mobile sidebar
  hamburgerBtn.addEventListener('click', () => {
    const isOpen = sidebar.classList.contains('open');
    isOpen ? closeSidebar() : openSidebar();
  });
  sidebarOverlay.addEventListener('click', closeSidebar);

  // EMI toggle
  emiToggle.addEventListener('click', () => {
    const expanded = emiToggle.getAttribute('aria-expanded') === 'true';
    emiToggle.setAttribute('aria-expanded', String(!expanded));
    emiBody.hidden = expanded;
    if (!expanded && state.lastResult) computeEMI();
  });

  // EMI inputs
  [emiArea, emiRate, emiTenure, emiIncome].forEach((el) => {
    el.addEventListener('input', debounce(computeEMI, 300));
  });

  // Sensitivity axis selector
  sensitivityAxis.addEventListener('change', updateSensitivityChart);
}

/* ============================================================
   27. Init — Entry Point
   ============================================================ */

async function init() {
  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Theme
  initTheme();

  // Reveal animations
  initRevealAnimations();

  // Tabs
  initTabs();

  // Slider readouts
  initSliderReadouts();

  // Events
  initEventListeners();

  // Fetch data
  await fetchLocations();
}

document.addEventListener('DOMContentLoaded', init);
