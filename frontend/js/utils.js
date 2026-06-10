export function debounce(fn, wait) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function formatINR(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return '₹' + Number(value).toLocaleString('en-IN');
}

export function riskClass(riskLevel) {
  if (riskLevel === 'Safe')    return 'safe';
  if (riskLevel === 'Caution') return 'caution';
  return 'high';
}

export function riskIconClass(riskLevel) {
  if (riskLevel === 'Safe')    return 'icon-check';
  if (riskLevel === 'Caution') return 'icon-alert';
  return 'icon-risk';
}

export function speculationLabel(val) {
  const labels = { 1: 'Minimal', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Extreme' };
  return `${val} — ${labels[val] || ''}`;
}

export function escapeHTML(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}
