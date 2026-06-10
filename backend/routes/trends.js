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
 * GET /api/trends/:location_id
 * Returns 12 monthly data points for the selected zone.
 *
 * @query {number} [speculation=3] - Speculation level 1–5.
 */
router.get('/:location_id', (req, res) => {
  const { location_id }   = req.params;
  const speculationLvl    = Math.min(5, Math.max(1, Number(req.query.speculation) || 3));

  const loc = locations.find((l) => l.id === location_id);
  if (!loc) {
    return res.status(404).json({ error: `Location "${location_id}" not found.` });
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
