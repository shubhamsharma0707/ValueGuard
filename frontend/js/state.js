export const API_BASE = (() => {
  const isFile = window.location.protocol === 'file:';
  const staticDevPorts = new Set(['5173', '5500', '8000', '8080']);
  const isStaticDevServer = staticDevPorts.has(window.location.port);
  if (!isFile && !isStaticDevServer) return `${window.location.origin}/api`;
  return 'http://localhost:3000/api';
})();

export const state = {
  locations:   [],       // All 15 zone objects from /api/locations
  lastResult:  null,     // Most recent /api/valuate response
  pinnedZones: [],       // Zones pinned for comparison (max 3)
};

export const charts = {
  comparisonChart:  null,
  emiChart:         null,
  sensitivityChart: null,
  radarChart:       null,
};
