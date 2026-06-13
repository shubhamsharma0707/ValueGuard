/**
 * ValueGuard — Historical Trend Route
 * Generates a deterministic 12-month price trend for a given zone.
 *
 * @module routes/trends
 */

'use strict';

const express   = require('express');
const router    = express.Router();
const locations = require('../data.json');
const { generateTrend } = require('../services/trendService');

/**
 * Validates a location_id path parameter.
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
 * GET /api/trends/:location_id
 * Returns 12 monthly data points for the selected zone.
 *
 * @query {number} [speculation=3] - Speculation level 1–5.
 */
router.get('/:location_id', (req, res) => {
  const { location_id }   = req.params;

  // ─── Input validation ────────────────────────────────────────────────────
  if (!isValidLocationId(location_id)) {
    return res.status(400).json({ error: 'location_id contains invalid characters or exceeds maximum length.' });
  }

  const speculationLvl    = Math.min(5, Math.max(1, Number(req.query.speculation) || 3));

  const loc = locations.find((l) => l.id === location_id);
  if (!loc) {
    // Do NOT reflect the raw user input back in the error message.
    return res.status(404).json({ error: 'Location not found.' });
  }

  const trend = generateTrend(loc, speculationLvl);

  res.json({
    location_id: loc.id,
    zone_name:   loc.zone_name,
    city:        loc.city,
    data:        trend,
  });
});

module.exports = router;

