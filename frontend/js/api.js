import { API_BASE } from './state.js';

export async function fetchLocationsAPI() {
  const res = await fetch(`${API_BASE}/locations`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function submitValuationAPI(payload) {
  const res = await fetch(`${API_BASE}/valuate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  return await res.json();
}

export async function fetchHistoryAPI() {
  const res = await fetch(`${API_BASE}/history`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function fetchTrendsAPI(locationId, specLevel) {
  const res = await fetch(`${API_BASE}/trends/${locationId}?speculation=${specLevel}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
