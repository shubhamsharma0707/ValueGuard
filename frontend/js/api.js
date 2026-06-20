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
  const result = await res.json();

  try {
    const stored = localStorage.getItem('vg-history');
    let history = stored ? JSON.parse(stored) : [];
    history.unshift({ ...result, location_id: payload.location_id });
    if (history.length > 5) history.pop();
    localStorage.setItem('vg-history', JSON.stringify(history));
  } catch (e) {
    console.warn('Could not save history locally', e);
  }

  return result;
}

export async function fetchHistoryAPI() {
  try {
    const stored = localStorage.getItem('vg-history');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

