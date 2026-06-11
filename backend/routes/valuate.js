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
 * In-memory session store for the last 5 valuations.
 * Managed as a shared array passed from server.js context
 * and referenced via closure over `valuationHistory`.
 * @type {Array<Object>}
 */
const valuationHistory = [];

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

  // --- Input validation ---
  if (!location_id) {
    return res.status(400).json({ error: 'location_id is required.' });
  }

  const location = locations.find((loc) => loc.id === location_id);
  if (!location) {
    return res.status(404).json({ error: `Location "${location_id}" not found.` });
  }

  const age = Number(property_age) || 0;
  const distanceKm = Number(metro_distance_km) ?? 5;
  const specLevel = Number(speculation_level) || 1;

  // --- Formula components ---
  // Use real zone_multiplier directly from curated data
  const metroPremium = computeMetroPremium(location.metro_nearby, distanceKm);
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

  const riskLevel = getRiskLevel(variancePct);
  const reasonText = buildReasonText({
    speculationLevel: specLevel,
    metroDistanceKm: distanceKm,
    propertyAge: age,
    variancePct,
    metroNearby: location.metro_nearby,
  });

  const result = {
    zone_name: location.zone_name,
    city: location.city,
    circle_rate: location.circle_rate_per_sqft,
    market_value: marketValue,
    variance_pct: variancePct,
    risk_level: riskLevel,
    reason_text: reasonText,
    breakdown: {
      base: Math.round(location.circle_rate_per_sqft * location.zone_multiplier),
      metro_premium: metroPremium,
      age_depreciation: ageDepreciation,
      speculative_uplift: speculativeUplift,
    },
    data_source: location.data_source,
    last_updated: location.last_updated,
    timestamp: new Date().toISOString(),
  };

  // --- Store in session history (last 5) ---
  valuationHistory.unshift({ ...result, location_id });
  if (valuationHistory.length > 5) valuationHistory.pop();

  res.json(result);
});

/**
 * GET /api/history
 * Returns the last 5 valuations stored in the in-memory session array.
 */
router.get('/history', (req, res) => {
  res.json(valuationHistory);
});

module.exports = router;
