import { dom } from './dom.js';
import { state, CITY_STATE_MAP } from './state.js';
import { formatINR, riskClass, escapeHTML, speculationLabel, iconSVG, riskIconSVG } from './utils.js';
import { updateChart, updateEMIChart, renderRadarChart } from './charts.js';

let toastTimer;
/* ─── Data Ticker ─────────────────────────────────────── */

export function initTicker() {
  if (!dom.tickerTrack || !state.locations.length) return;

  const items = buildTickerItems();
  renderTicker(items);
}

function buildTickerItems() {
  if (!state.locations.length) return [];

  const items = [];

  // Get unique cities with their avg metrics
  const cities = [...new Set(state.locations.map((l) => l.city))];
  cities.forEach((city) => {
    const zones = state.locations.filter((l) => l.city === city);
    const avgCircle = Math.round(zones.reduce((s, z) => s + z.circle_rate_per_sqft, 0) / zones.length);
    const avgMarket = Math.round(zones.reduce((s, z) => s + z.avg_market_rate_per_sqft, 0) / zones.length);
    const variance = parseFloat((((avgMarket - avgCircle) / avgCircle) * 100).toFixed(1));
    const changeCls = variance >= 0 ? 'positive' : 'negative';
    items.push({
      label: city,
      value: `₹${avgMarket.toLocaleString('en-IN')}`,
      change: `${variance > 0 ? '+' : ''}${variance}%`,
      changeCls,
    });
  });

  // Add a "Highest" and "Lowest" item
  const sorted = [...state.locations].sort((a, b) => b.avg_market_rate_per_sqft - a.avg_market_rate_per_sqft);
  if (sorted.length) {
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    items.push({ label: 'HIGH', value: `${highest.zone_name.split(' ')[0]} ₹${highest.avg_market_rate_per_sqft.toLocaleString('en-IN')}`, change: '', changeCls: 'positive' });
    items.push({ label: 'LOW', value: `${lowest.zone_name.split(' ')[0]} ₹${lowest.avg_market_rate_per_sqft.toLocaleString('en-IN')}`, change: '', changeCls: '' });
  }

  return items;
}

function renderTicker(items) {
  // Double the items for seamless loop
  const renderSet = [...items, ...items];
  dom.tickerTrack.innerHTML = renderSet.map((item) => `
    <span class="ticker-item">
      <span class="ticker-dot ${escapeHTML(item.changeCls)}"></span>
      <span class="ticker-label">${escapeHTML(item.label)}</span>
      <span class="ticker-value">${escapeHTML(item.value)}</span>
      ${item.change ? `<span class="ticker-change ${escapeHTML(item.changeCls)}">${escapeHTML(item.change)}</span>` : ''}
    </span>
  `).join('');
}

export function refreshTicker() {
  if (!dom.tickerTrack) return;
  const items = buildTickerItems();
  renderTicker(items);
}

/* ─── Scroll Indicator (inspired by matveyan.com) ──────── */

export function initScrollIndicator() {
  if (!dom.scrollIndicator) return;

  const onScroll = () => {
    if (window.scrollY > 60) {
      dom.scrollIndicator.classList.add('hidden');
    } else {
      dom.scrollIndicator.classList.remove('hidden');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ─── Icons ───────────────────────────────────────────── */

export function initIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon');
    el.innerHTML = iconSVG(name);
  });
}

export function showToast(message, duration = 2500) {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add('visible');
  toastTimer = setTimeout(() => dom.toast.classList.remove('visible'), duration);
}

export function showError(message) {
  dom.errorMessage.textContent = message;
  dom.errorBanner.classList.add('visible');
}

export function hideError() {
  dom.errorBanner.classList.remove('visible');
}

export function showSkeleton() {
  dom.circleRateValue.innerHTML = '<div class="skeleton-block skeleton"></div>';
  dom.marketRateValue.innerHTML = '<div class="skeleton-block skeleton"></div>';
  dom.circleRateZone.textContent = '';
  dom.marketRateRisk.textContent = '';
}

export function initTheme() {
  const saved = localStorage.getItem('vg-theme') || 'dark';
  applyTheme(saved);
}

export function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    dom.themeIcon.innerHTML = iconSVG('moon');
    dom.themeToggle.setAttribute('aria-label', 'Switch to dark mode');
  } else {
    document.documentElement.removeAttribute('data-theme');
    dom.themeIcon.innerHTML = iconSVG('sun');
    dom.themeToggle.setAttribute('aria-label', 'Switch to light mode');
  }
  localStorage.setItem('vg-theme', theme);
  window.dispatchEvent(new Event('themeChanged'));
}

export function toggleTheme() {
  const current = localStorage.getItem('vg-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

export function openSidebar() {
  dom.sidebar.classList.add('open');
  dom.sidebarOverlay.classList.add('visible');
  dom.sidebarOverlay.removeAttribute('aria-hidden');
  dom.hamburgerBtn.classList.add('open');
  dom.hamburgerBtn.setAttribute('aria-expanded', 'true');
}

export function closeSidebar() {
  dom.sidebar.classList.remove('open');
  dom.sidebarOverlay.classList.remove('visible');
  dom.sidebarOverlay.setAttribute('aria-hidden', 'true');
  dom.hamburgerBtn.classList.remove('open');
  dom.hamburgerBtn.setAttribute('aria-expanded', 'false');
}

export function animateNumber(el, target, prefix = '', duration = 400) {
  const start     = performance.now();
  const startVal  = parseFloat(el.dataset.rawValue || '0') || 0;
  el.dataset.rawValue = String(target);

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = Math.round(startVal + (target - startVal) * eased);
    el.textContent = prefix + Number(current).toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(step);
  }

  el.classList.add('number-flip');
  setTimeout(() => el.classList.remove('number-flip'), 400);
  requestAnimationFrame(step);
}

export function filterCitiesByState(selectedState, cityEl, zoneEl) {
  cityEl.innerHTML = '<option value="">— Select City —</option>';
  cityEl.disabled = true;
  if (zoneEl) {
    zoneEl.innerHTML = '<option value="">— Select City first —</option>';
    zoneEl.disabled = true;
  }
  if (!selectedState) return;

  // Cities that have data AND belong to the selected state
  const cities = [...new Set(
    state.locations
      .filter((loc) => (CITY_STATE_MAP[loc.city] || '') === selectedState)
      .map((loc) => loc.city)
  )].sort();

  if (!cities.length) {
    cityEl.innerHTML = '<option value="">— No data for this state —</option>';
    return;
  }

  cities.forEach((city) => {
    const opt = document.createElement('option');
    opt.value = city;
    opt.textContent = city;
    cityEl.appendChild(opt);
  });
  cityEl.disabled = false;
}

export function filterZonesByCity(city, zoneEl) {
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

export function updateResults(data) {
  const cls = riskClass(data.risk_level);

  const circleNum = data.circle_rate;
  const marketNum = data.market_value;

  dom.circleRateValue.className = 'card-value';
  animateNumber(dom.circleRateValue, circleNum, '₹');
  dom.circleRateZone.textContent = data.zone_name + ', ' + data.city;

  dom.marketRateValue.className = `card-value ${cls}`;
  animateNumber(dom.marketRateValue, marketNum, '₹');
  dom.marketRateRisk.textContent = `${data.variance_pct > 0 ? '+' : ''}${data.variance_pct}% variance`;

  dom.cardMarket.className = `rate-card glass-card reveal-card revealed risk-${cls}`;

  updateGauge(data.variance_pct, cls);

  dom.riskBadge.textContent = data.risk_level;
  dom.riskBadge.className   = `risk-badge ${cls}`;

  dom.insightIcon.innerHTML = riskIconSVG(data.risk_level);
  dom.insightText.textContent = data.reason_text;
  dom.insightCard.className   = `insight-card glass-card reveal-card revealed ${cls}`;

  dom.bdBase.textContent  = formatINR(data.breakdown.base);
  dom.bdMetro.textContent = data.breakdown.metro_premium > 0
    ? `+${formatINR(data.breakdown.metro_premium)}`
    : formatINR(0);
  dom.bdDepr.textContent  = `−${formatINR(data.breakdown.age_depreciation)}`;
  dom.bdSpec.textContent  = `+${formatINR(data.breakdown.speculative_uplift)}`;

  updateChart(data);

  dom.gaugeTrack.setAttribute('aria-valuenow', Math.min(data.variance_pct, 100));
}

export function resetResultCards() {
  dom.circleRateValue.textContent = '—';
  dom.marketRateValue.textContent = '—';
  dom.cardMarket.className = 'rate-card glass-card reveal-card revealed';
  dom.gaugeFill.style.width = '0%';
  dom.gaugeFill.textContent = '0%';
  dom.gaugeFill.className = 'gauge-fill';
  dom.riskBadge.textContent = '—';
  dom.riskBadge.className = 'risk-badge default';
}

function updateGauge(variancePct, cls) {
  const displayWidth = Math.min(Math.abs(variancePct), 100);
  requestAnimationFrame(() => {
    dom.gaugeFill.style.width = `${displayWidth}%`;
    dom.gaugeFill.className    = `gauge-fill ${cls}`;
  });
}

export function renderHistory(history) {
  dom.drawerCount.textContent = history.length;
  if (!history.length) {
    dom.historyList.innerHTML = '<p class="history-empty">No queries yet. Run a valuation to see history.</p>';
    return;
  }
  dom.historyList.innerHTML = '';
  history.forEach((item) => {
    const cls         = riskClass(item.risk_level);
    const marketValue = Number(item.market_value);
    const variance    = parseFloat(item.variance_pct);
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div>
        <div class="history-zone">${escapeHTML(item.zone_name)}</div>
        <div class="history-city text-muted">${escapeHTML(item.city)}</div>
      </div>
      <div class="history-rate">₹${isFinite(marketValue) ? marketValue.toLocaleString('en-IN') : '—'}/sqft</div>
      <div class="history-variance ${escapeHTML(cls)}" style="font-family:var(--font-mono);font-size:0.72rem">
        ${isFinite(variance) ? (variance > 0 ? '+' : '') + variance + '%' : '—'}
      </div>
      <span class="history-badge hm-badge ${escapeHTML(cls)}">${escapeHTML(item.risk_level)}</span>
    `;
    dom.historyList.appendChild(div);
  });
}

export function renderHeatmap(city) {
  if (!city) {
    dom.heatmapWrap.innerHTML = '<div class="heatmap-empty">Select a city from the control panel to load the heatmap.</div>';
    dom.heatmapSubtitle.textContent = 'Select a city to view all zones and their risk profile.';
    return;
  }

  const zones = state.locations.filter((loc) => loc.city === city);
  dom.heatmapSubtitle.textContent = `${city} — ${zones.length} zone${zones.length !== 1 ? 's' : ''} in database`;

  if (!zones.length) {
    dom.heatmapWrap.innerHTML = '<div class="heatmap-empty">No zones found for this city.</div>';
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
      <td>${loc.it_corridor ? 'Yes' : 'No'}</td>
      <td>${loc.metro_nearby ? 'Yes' : 'No'}</td>
      <td><span class="hm-badge ${cls}">${escapeHTML(risk)}</span></td>
    `;
    tbody.appendChild(tr);
  });

  dom.heatmapWrap.innerHTML = '';
  dom.heatmapWrap.appendChild(table);
}

export function computeEMI() {
  if (!state.lastResult) return;

  const sqft       = Number(dom.emiArea.value) || 1000;
  const annualRate = Number(dom.emiRate.value) / 100;
  const months     = Number(dom.emiTenure.value) * 12;
  const income     = Number(dom.emiIncome.value) || 150000;

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

  dom.emiLoanAmount.textContent = formatINR(loanAmount);
  dom.emiMonthly.textContent    = formatINR(emi) + '/mo';
  dom.emiInterest.textContent   = formatINR(totalInterest);

  let affordLabel = 'Affordable';
  let affordCls   = 'affordable';
  if (emiRatio > 0.5) { affordLabel = 'High Burden'; affordCls = 'burden'; }
  else if (emiRatio > 0.35) { affordLabel = 'Stretch'; affordCls = 'stretch'; }
  dom.emiBadge.textContent = `${affordLabel} (${Math.round(emiRatio * 100)}% of income)`;
  dom.emiBadge.className   = `emi-badge ${affordCls}`;

  updateEMIChart(loanAmount, totalInterest);
}

function formulaEstimate(loc, age, metroKm, specLevel) {
  const base     = loc.circle_rate_per_sqft * loc.zone_multiplier;
  const metro    = loc.metro_nearby && metroKm < 2 ? 800 : loc.metro_nearby && metroKm < 5 ? 400 : 0;
  const deprec   = age * 120;
  const uplift   = specLevel * 500;
  return Math.round(base + metro - deprec + uplift);
}

export function renderPinnedChips(unpinZoneCallback) {
  dom.pinnedChips.innerHTML = '';
  if (!state.pinnedZones.length) {
    dom.pinnedChips.innerHTML = '<span style="font-size:0.7rem;color:var(--clr-text-quaternary)">No zones pinned yet</span>';
    return;
  }
  state.pinnedZones.forEach((z) => {
    const cls  = riskClass(z.risk_level);
    const chip = document.createElement('div');
    chip.className = `pinned-chip chip-${cls}`;
    
    const span = document.createElement('span');
    span.textContent = z.zone_name;
    
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', `Unpin ${z.zone_name}`);
    btn.innerHTML = iconSVG('xmark');
    btn.addEventListener('click', () => unpinZoneCallback(z.id));
    
    chip.appendChild(span);
    chip.appendChild(btn);
    dom.pinnedChips.appendChild(chip);
  });
}

export function renderCompareTable() {
  if (!state.pinnedZones.length) {
    dom.compareTableWrap.innerHTML = '<div class="compare-empty">Pin at least one zone above to start comparing.</div>';
    return;
  }

  const age     = Number(dom.sliderAge.value);
  const metroKm = Number(dom.sliderMetro.value);
  const spec    = Number(dom.sliderSpeculation.value);

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
      <td style="color:var(--clr-text-tertiary)">${escapeHTML(z.city)}</td>
      <td>₹${Number(z.circle_rate_per_sqft).toLocaleString('en-IN')}</td>
      <td style="color:${cls === 'safe' ? 'var(--clr-green)' : cls === 'caution' ? 'var(--clr-orange)' : 'var(--clr-red)'}">₹${Number(z.market_value).toLocaleString('en-IN')}</td>
      <td class="col-mono ${cls}">${z.variance_pct > 0 ? '+' : ''}${z.variance_pct}%</td>
      <td>${z.zone_multiplier}×</td>
      <td>${z.it_corridor ? 'Yes' : 'No'}</td>
      <td>${z.metro_nearby ? 'Yes' : 'No'}</td>
      <td><span class="hm-badge ${cls}">${escapeHTML(z.risk_level)}</span></td>
    `;
    tbody.appendChild(tr);
  });

  dom.compareTableWrap.innerHTML = '';
  dom.compareTableWrap.appendChild(table);
}


