export const API_BASE = (() => {
  const isFile = window.location.protocol === 'file:';
  const staticDevPorts = new Set(['5173', '5500', '8000', '8080']);
  const isStaticDevServer = staticDevPorts.has(window.location.port);
  if (!isFile && !isStaticDevServer) return `${window.location.origin}/api`;
  return 'http://localhost:3000/api';
})();

export const state = {
  locations:   [],       // All zone objects from /api/locations
  lastResult:  null,     // Most recent /api/valuate response
  pinnedZones: [],       // Zones pinned for comparison (max 3)
};

export const charts = {
  comparisonChart:  null,
  emiChart:         null,
  sensitivityChart: null,
  radarChart:       null,
};

// All 28 Indian states + Delhi (UT) — alphabetically sorted
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
];

// City → State mapping (extend as new cities are added to data.json)
export const CITY_STATE_MAP = {
  'Noida':       'Uttar Pradesh',
  'Bengaluru':   'Karnataka',
  'Pune':        'Maharashtra',
  'Mumbai':      'Maharashtra',
  'Hyderabad':   'Telangana',
  'Chennai':     'Tamil Nadu',
  'Kolkata':     'West Bengal',
  'Delhi':       'Delhi',
  'Ahmedabad':   'Gujarat',
  'Gurugram':    'Haryana',
  'Faridabad':   'Haryana',
  'Panchkula':   'Haryana',
  'Ambala':      'Haryana',
  'Sonipat':     'Haryana',
  'Rohtak':      'Haryana',
  'Hisar':       'Haryana',
  'Karnal':      'Haryana',
  'Panipat':     'Haryana',
  'Yamunanagar': 'Haryana',
  'Rewari':      'Haryana',
  'Bhiwani':     'Haryana',
  'Kurukshetra': 'Haryana',
  'Jhajjar':     'Haryana',
};
