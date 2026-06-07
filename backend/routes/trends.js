/**
 * ValueGuard — Historical Trend Route
 * Generates a deterministic 12-month price trend for a given zone.
 * Uses a seeded pseudo-random walk based on the zone's properties
 * so results are consistent for the same zone (reproducible).
 *
 * @module routes/trends
 */

'use strict';

const express   = require('express');
const router    = express.Router();
const locations = require('../data.json');

/**
 * Seeded pseudo-random number generator (mulberry32).
 * Produces consistent values for the same seed.
 *
 * @param {number} seed - Integer seed value.
 * @returns {function(): number} Function returning a float in [0, 1).
 */
function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Converts a zone id string to a numeric seed.
 * @param {string} id - Zone id.
 * @returns {number} Numeric seed.
 */
function idToSeed(id) {
  return id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 31;
}

/**
 * Generates 12 monthly market value data points for the past year.
 * The walk starts ~15% below today's computed base value and trends
 * toward it with zone-specific volatility.
 *
 * @param {Object} loc            - Location object from data.json.
 * @param {number} speculationLvl - Speculation level 1–5 (default 3).
 * @returns {Array<{month: string, circle_rate: number, market_rate: number}>}
 */
function generateTrend(loc, speculationLvl = 3) {
  const rng = seededRng(idToSeed(loc.id));

  // Current market base (from the formula, neutral inputs)
  const currentBase  = Math.round(loc.circle_rate_per_sqft * loc.zone_multiplier);
  const specUplift   = speculationLvl * 500;
  const currentValue = currentBase + specUplift;

  // Circle rate grows slowly (0.5% / month as a proxy for annual revision)
  const circleGrowth = 0.005;

  // Determine volatility from zone_multiplier: higher multiplier = more volatile
  const volatility = (loc.zone_multiplier - 1.0) * 600;

  // Start 12–18% below current value
  const startDiscount = 0.82 + rng() * 0.06; // 0.82–0.88
  let marketRate = Math.round(currentValue * startDiscount);
  let circleRate = Math.round(loc.circle_rate_per_sqft * (1 - circleGrowth * 11));

  const now    = new Date();
  const months = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });

    months.push({
      month:       label,
      circle_rate: circleRate,
      market_rate: marketRate,
    });

    // Each month: trend upward toward current + noise
    const trendPull   = (currentValue - marketRate) * 0.15;   // pull toward today's value
    const noise       = (rng() - 0.46) * volatility;           // slight upward bias
    marketRate        = Math.max(Math.round(marketRate + trendPull + noise), loc.circle_rate_per_sqft);
    circleRate        = Math.round(circleRate * (1 + circleGrowth));
  }

  return months;
}

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
