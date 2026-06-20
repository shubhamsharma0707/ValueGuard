// DOM references — resolved lazily to ensure DOMContentLoaded has fired.
// All selectors are re-evaluated on first access via getter pattern.

let _dom = null;

function createToast() {
  let t = document.getElementById('toast');
  if (t) return t;
  t = document.createElement('div');
  t.id = 'toast';
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  document.body.appendChild(t);
  return t;
}

function buildDom() {
  return {
    // ── Tool section controls (new landing page IDs)
    stateSelect:       document.getElementById('t-state'),
    citySelect:        document.getElementById('t-city'),
    zoneSelect:        document.getElementById('t-zone'),
    sliderAge:         document.getElementById('t-age'),
    sliderMetro:       document.getElementById('t-metro'),
    sliderSpeculation: document.getElementById('t-spec'),
    valAge:            document.getElementById('t-age-val'),
    valMetro:          document.getElementById('t-metro-val'),
    valSpeculation:    document.getElementById('t-spec-val'),

    // ── Rate cards (new IDs)
    circleRateValue:   document.getElementById('res-circle-val'),
    marketRateValue:   document.getElementById('res-market-val'),
    circleRateZone:    document.querySelector('#res-circle .result-card-unit'),
    marketRateRisk:    document.querySelector('#res-market .result-card-unit'),
    cardCircle:        document.getElementById('res-circle'),
    cardMarket:        document.getElementById('res-market'),

    // ── Variance gauge (new IDs)
    gaugeFill:         document.getElementById('variance-fill'),
    gaugeTrack:        document.querySelector('.variance-track'),
    riskBadge:         document.getElementById('res-risk'),

    // ── Insight (new IDs)
    insightCard:       document.getElementById('insight-box'),
    insightIcon:       document.getElementById('insight-icon'),
    insightText:       document.getElementById('insight-text'),

    // ── Breakdown (same IDs retained)
    bdBase:            document.getElementById('bd-base'),
    bdMetro:           document.getElementById('bd-metro'),
    bdDepr:            document.getElementById('bd-depr'),
    bdSpec:            document.getElementById('bd-spec'),

    // ── History drawer — not in new layout, provide safe stubs
    drawerToggle:      null,
    drawerBody:        null,
    historyDrawer:     null,
    historyList:       null,
    drawerCount:       null,

    // ── Heatmap — not in main view in new layout, safe stubs
    heatmapWrap:       null,
    heatmapSubtitle:   null,

    // ── Error / export — safe stubs (not in new layout)
    errorBanner:       null,
    errorMessage:      null,
    btnCopyURL:        null,
    btnPrint:          null,
    printTimestamp:    null,

    // ── Theme & mobile
    themeToggle:       document.getElementById('theme-toggle'),
    themeIcon:         document.getElementById('theme-icon'),
    hamburgerBtn:      document.getElementById('hamburger'),
    sidebar:           document.getElementById('sidebar'),
    sidebarOverlay:    document.getElementById('sidebar-overlay'),

    // ── EMI
    emiToggle:         document.getElementById('emi-toggle'),
    emiBody:           document.getElementById('emi-body'),
    emiArea:           document.getElementById('emi-area'),
    emiRate:           document.getElementById('emi-rate'),
    emiTenure:         document.getElementById('emi-tenure'),
    emiIncome:         document.getElementById('emi-income'),
    emiLoanAmount:     document.getElementById('emi-loan-amount'),
    emiMonthly:        document.getElementById('emi-monthly'),
    emiInterest:       document.getElementById('emi-interest'),
    emiBadge:          document.getElementById('emi-badge'),

    // ── Sensitivity
    sensitivityAxis:   null,
    sensitivityHint:   null,

    // ── Compare zone panel
    compareStateSelect: document.getElementById('c-state'),
    compareCitySelect:  document.getElementById('c-city'),
    compareZoneSelect:  document.getElementById('c-zone'),
    btnPinZone:         document.getElementById('btn-pin'),
    pinnedChips:        document.getElementById('pinned-chips'),
    compareTableWrap:   document.getElementById('compare-table-wrap'),

    // ── Main panel
    mainPanel:          document.getElementById('tool'),

    // ── Toast
    toast:              createToast(),

    // ── Ticker / scroll indicator (not in new layout)
    tickerTrack:        null,
    scrollIndicator:    null,
  };
}

// Proxy that lazily builds the DOM map on first access (after DOMContentLoaded)
export const dom = new Proxy({}, {
  get(target, key) {
    if (!_dom) _dom = buildDom();
    return _dom[key];
  },
  set(target, key, value) {
    if (!_dom) _dom = buildDom();
    _dom[key] = value;
    return true;
  }
});
