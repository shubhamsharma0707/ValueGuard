import { state, charts } from './state.js';
import { dom } from './dom.js';
import { riskClass } from './utils.js';

const ACCENT = 'rgba(255, 255, 255, 0.7)';
const ACCENT_STRONG = 'rgba(255, 255, 255, 0.92)';
const ACCENT_BORDER = 'rgba(255, 255, 255, 1)';
const ACCENT_GRADIENT = 'rgba(255, 255, 255, 0.24)';
const BLUE = 'rgba(128, 128, 128, 0.7)';
const BLUE_BORDER = 'rgba(128, 128, 128, 1)';
const GRAY = 'rgba(128, 128, 128, 0.5)';
const GRAY_STRONG = 'rgba(128, 128, 128, 0.7)';

// Cached gradient for trends chart — created once, reused on every update
let _trendsGrad = null;

function computeCityAverages(city) {
  const zones = state.locations.filter((l) => l.city === city);
  if (!zones.length) return { avgCircle: 0, avgMarket: 0 };
  const avgCircle = Math.round(zones.reduce((s, z) => s + z.circle_rate_per_sqft, 0) / zones.length);
  const avgMarket = Math.round(zones.reduce((s, z) => s + z.avg_market_rate_per_sqft, 0) / zones.length);
  return { avgCircle, avgMarket };
}

function riskBarColor(riskLevel, alpha) {
  if (riskLevel === 'Safe')    return `rgba(76, 217, 100, ${alpha})`;
  if (riskLevel === 'Caution') return `rgba(255, 149, 0, ${alpha})`;
  return `rgba(255, 69, 58, ${alpha})`;
}

function chartBaseOptions() {
  const isDark = !document.documentElement.getAttribute('data-theme');
  const gridClr = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const tickClr = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const tipBg   = isDark ? '#1d1d29' : '#ffffff';
  const tipBody = isDark ? '#e2e2e2' : '#1e293b';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tipBg,
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        titleColor: tickClr,
        bodyColor: tipBody,
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

export function updateChart(data) {
  const { avgCircle, avgMarket } = computeCityAverages(data.city);

  const chartData = {
    labels: [data.zone_name, `${data.city} Avg`],
    datasets: [
      {
        label: 'Circle Rate',
        data: [data.circle_rate, avgCircle],
        backgroundColor: ACCENT,
        borderColor: ACCENT_BORDER,
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Market Rate',
        data: [data.market_value, avgMarket],
        backgroundColor: riskBarColor(data.risk_level, 0.55),
        borderColor:     riskBarColor(data.risk_level, 1),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const opts = chartBaseOptions();
  const canvas = document.getElementById('comparison-chart');
  
  if (charts.comparisonChart) {
    charts.comparisonChart.data = chartData;
    charts.comparisonChart.update('active');
  } else {
    charts.comparisonChart = new Chart(canvas.getContext('2d'), {
      type: 'bar', data: chartData, options: opts,
    });
  }
}

export function updateEMIChart(principal, interest) {
  const canvas = document.getElementById('emi-chart');
  const ctx    = canvas.getContext('2d');

  const isDark = !document.documentElement.getAttribute('data-theme');
  const labelClr = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

  const data = {
    labels: ['Principal', 'Total Interest'],
    datasets: [{
      data: [principal, interest],
      backgroundColor: [ACCENT_STRONG, 'rgba(255, 69, 58, 0.55)'],
      borderColor:     [ACCENT_BORDER,  'rgba(255, 69, 58, 1)'],
      borderWidth: 1,
      hoverOffset: 4,
    }],
  };

  if (charts.emiChart) {
    charts.emiChart.data = data;
    charts.emiChart.update('active');
  } else {
    charts.emiChart = new Chart(ctx, {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: labelClr, font: { size: 10 }, boxWidth: 10 },
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

function formulaEstimate(loc, age, metroKm, specLevel) {
  const base     = loc.circle_rate_per_sqft * loc.zone_multiplier;
  const metro    = loc.metro_nearby && metroKm < 2 ? 800 : loc.metro_nearby && metroKm < 5 ? 400 : 0;
  const deprec   = age * 120;
  const uplift   = specLevel * 500;
  return Math.round(base + metro - deprec + uplift);
}

export function updateSensitivityChart() {
  if (!state.lastResult) {
    dom.sensitivityHint.textContent = 'Run a valuation to enable sensitivity analysis.';
    return;
  }

  const loc = state.locations.find((l) => l.zone_name === state.lastResult.zone_name && l.city === state.lastResult.city);
  if (!loc) return;

  dom.sensitivityHint.textContent = '';

  const axis    = dom.sensitivityAxis.value;
  const age     = Number(dom.sliderAge.value);
  const metroKm = Number(dom.sliderMetro.value);
  const spec    = Number(dom.sliderSpeculation.value);

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

  const isDark = !document.documentElement.getAttribute('data-theme');
  const gridClr = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const tickClr = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';

  const canvas = document.getElementById('sensitivity-chart');
  const ctx    = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 120);
  grad.addColorStop(0,   ACCENT_GRADIENT);
  grad.addColorStop(1,   'rgba(255, 255, 255, 0)');

  const data = {
    labels,
    datasets: [{
      label: 'Market Value',
      data: values,
      borderColor: ACCENT_STRONG,
      backgroundColor: grad,
      borderWidth: 1.5,
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 4,
    }],
  };

  if (charts.sensitivityChart) {
    charts.sensitivityChart.data = data;
    charts.sensitivityChart.update('active');
  } else {
    charts.sensitivityChart = new Chart(ctx, {
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

export function renderRadarChart() {
  if (!state.pinnedZones.length) return;

  const age     = Number(dom.sliderAge.value);
  const metroKm = Number(dom.sliderMetro.value);
  const spec    = Number(dom.sliderSpeculation.value);

  const colours = [
    { border: ACCENT_BORDER,        bg: 'rgba(255, 255, 255, 0.12)' },
    { border: 'rgba(150, 150, 150, 0.9)', bg: 'rgba(150, 150, 150, 0.12)' },
    { border: 'rgba(100, 100, 100, 0.9)',  bg: 'rgba(100, 100, 100, 0.12)' },
  ];

  const allLocs = state.locations;
  const max = {
    circle:     Math.max(...allLocs.map((l) => l.circle_rate_per_sqft)),
    market:     Math.max(...allLocs.map((l) => formulaEstimate(l, age, metroKm, spec))),
    multiplier: Math.max(...allLocs.map((l) => l.zone_multiplier)),
    metro:      1,
    itCorridor: 1,
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

  const isDark = !document.documentElement.getAttribute('data-theme');
  const gridClr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const tickClr = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

  const canvas = document.getElementById('radar-chart');
  if (charts.radarChart) {
    charts.radarChart.data.datasets = datasets;
    charts.radarChart.update('active');
    return;
  }

  charts.radarChart = new Chart(canvas.getContext('2d'), {
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

export function renderTrendsChart(data) {
  const labels  = data.map((d) => d.month);
  const mktVals = data.map((d) => d.market_rate);
  const cirVals = data.map((d) => d.circle_rate);

  const canvas = document.getElementById('trends-chart');
  const ctx    = canvas.getContext('2d');

  // Reuse gradient — only create once to avoid re-triggering compositing
  if (!_trendsGrad) {
    _trendsGrad = ctx.createLinearGradient(0, 0, 0, 270);
    _trendsGrad.addColorStop(0, ACCENT_GRADIENT);
    _trendsGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  }

  const isDark  = !document.documentElement.getAttribute('data-theme');
  const gridClr = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const tickClr = isDark ? 'rgba(255,255,255,0.4)'  : 'rgba(0,0,0,0.35)';

  // Fast-path: just swap data arrays in-place, no full object replacement
  if (charts.trendsChart) {
    const ds = charts.trendsChart.data;
    ds.labels          = labels;
    ds.datasets[0].data = mktVals;
    ds.datasets[1].data = cirVals;
    charts.trendsChart.update('none');
    return;
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Market Rate',
        data: mktVals,
        borderColor: ACCENT_STRONG,
        backgroundColor: _trendsGrad,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: ACCENT_BORDER,
      },
      {
        label: 'Circle Rate',
        data: cirVals,
        borderColor: GRAY_STRONG,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [4, 4],
        fill: false,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: GRAY_STRONG,
      },
    ],
  };

  charts.trendsChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      resizeDelay: 200,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1d1d29' : '#fff',
          borderColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          titleColor: tickClr,
          bodyColor:  isDark ? '#e2e2e2' : '#1e293b',
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

export function refreshChartsTheme() {
  const isDark = !document.documentElement.getAttribute('data-theme');
  const gridClr = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const tickClr = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const tipBg   = isDark ? '#1d1d29' : '#ffffff';
  const tipBody = isDark ? '#e2e2e2' : '#1e293b';

  Object.values(charts).forEach(chart => {
    if (!chart) return;
    
    if (chart.options.plugins && chart.options.plugins.tooltip) {
      chart.options.plugins.tooltip.backgroundColor = tipBg;
      chart.options.plugins.tooltip.titleColor = tickClr;
      chart.options.plugins.tooltip.bodyColor = tipBody;
    }
    
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = gridClr;
        if (chart.options.scales.x.ticks) chart.options.scales.x.ticks.color = tickClr;
      }
      if (chart.options.scales.y) {
        if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = gridClr;
        if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = tickClr;
      }
      if (chart.options.scales.r) {
        if (chart.options.scales.r.grid) chart.options.scales.r.grid.color = gridClr;
        if (chart.options.scales.r.angleLines) chart.options.scales.r.angleLines.color = gridClr;
        if (chart.options.scales.r.pointLabels) chart.options.scales.r.pointLabels.color = tickClr;
      }
    }
    
    if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
       chart.options.plugins.legend.labels.color = tickClr;
    }

    chart.update('none');
  });
}
