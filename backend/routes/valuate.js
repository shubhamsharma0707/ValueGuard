/**
 * ValueGuard — Express API Routes
 * Handles property valuation logic and history management.
 * @module routes/valuate
 */

'use strict';

const express = require('express');
const router = express.Router();
const locations = require('../data.json');
const {
  computeMetroPremium,
  computeAgeDepreciation,
  computeSpeculativeUplift,
  getRiskLevel,
  buildReasonText
} = require('../services/valuationService');


/**
 * Validates and sanitises a location_id string.
 * Only alphanumeric characters, hyphens, and underscores are allowed.
 * Max length: 64 characters.
 * @param {string} id
 * @returns {boolean}
 */
function isValidLocationId(id) {
  if (typeof id !== 'string') return false;
  if (id.length === 0 || id.length > 64) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Clamps a number to [min, max]. Returns fallback if value is NaN or Infinity.
 * @param {*} raw - Raw input value.
 * @param {number} min
 * @param {number} max
 * @param {number} fallback - Value to use if coercion fails.
 * @returns {number}
 */
function clampNumber(raw, min, max, fallback) {
  const n = Number(raw);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * GET /api/locations
 * Returns all zone objects from data.json with real rates.
 */
router.get('/locations', (req, res) => {
  res.json(locations);
});

/**
 * POST /api/valuate
 * Accepts valuation inputs, applies the formula, and returns the result.
 * @body {string} location_id
 * @body {number} property_age      - Years (0–40)
 * @body {number} metro_distance_km - Distance to metro in km (0–10)
 * @body {number} speculation_level - 1 (Low) to 5 (High)
 */
router.post('/valuate', (req, res) => {
  const { location_id, property_age, metro_distance_km, speculation_level } = req.body;

  // ─── Input validation ────────────────────────────────────────────────────

  if (!location_id) {
    return res.status(400).json({ error: 'location_id is required.' });
  }
  if (!isValidLocationId(location_id)) {
    return res.status(400).json({ error: 'location_id contains invalid characters or exceeds maximum length.' });
  }

  const location = locations.find((loc) => loc.id === location_id);
  if (!location) {
    // Do NOT reflect the raw user input back in the error message.
    return res.status(404).json({ error: 'Location not found.' });
  }

  // Clamp all numeric inputs to their valid ranges.
  const age       = clampNumber(property_age,      0,  40, 0);
  const distanceKm = clampNumber(metro_distance_km, 0,  10, 5);
  const specLevel  = clampNumber(speculation_level, 1,   5, 1);

  // ─── Formula components ──────────────────────────────────────────────────
  const metroPremium    = computeMetroPremium(location.metro_nearby, distanceKm);
  const ageDepreciation = computeAgeDepreciation(age);
  const speculativeUplift = computeSpeculativeUplift(specLevel);

  const marketValue = Math.round(
    location.circle_rate_per_sqft * location.zone_multiplier
    + metroPremium
    - ageDepreciation
    + speculativeUplift
  );

  const variancePct = parseFloat(
    (((marketValue - location.circle_rate_per_sqft) / location.circle_rate_per_sqft) * 100).toFixed(2)
  );

  const riskLevel  = getRiskLevel(variancePct);
  const reasonText = buildReasonText({
    speculationLevel: specLevel,
    metroDistanceKm:  distanceKm,
    propertyAge:      age,
    variancePct,
    metroNearby:      location.metro_nearby,
  });

  const result = {
    zone_name:    location.zone_name,
    city:         location.city,
    circle_rate:  location.circle_rate_per_sqft,
    market_value: marketValue,
    variance_pct: variancePct,
    risk_level:   riskLevel,
    reason_text:  reasonText,
    breakdown: {
      base:              Math.round(location.circle_rate_per_sqft * location.zone_multiplier),
      metro_premium:     metroPremium,
      age_depreciation:  ageDepreciation,
      speculative_uplift: speculativeUplift,
    },
    data_source:  location.data_source,
    last_updated: location.last_updated,
    timestamp:    new Date().toISOString(),
  };

  res.json(result);
});

module.exports = router;

