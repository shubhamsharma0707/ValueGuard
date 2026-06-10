/**
 * ValueGuard — Valuation Service
 * Contains pure business logic for property valuation.
 * @module services/valuationService
 */

'use strict';

/**
 * Simulates real-time market fluctuations.
 * Uses a deterministic pseudo-random seed based on the current minute.
 * @param {number} baseValue
 * @param {number} volatilityIndex
 * @returns {number}
 */
function applyRealTimeFluctuation(baseValue, volatilityIndex) {
  const now = new Date();
  // Seed changes every minute so the user can see live updates
  const seed = baseValue + now.getFullYear() + now.getMonth() + now.getDate() + now.getHours() + now.getMinutes();
  const randomFactor = Math.sin(seed) * volatilityIndex;
  return baseValue * (1 + randomFactor);
}

/**
 * Computes the metro proximity premium in ₹ per sqft.
 * @param {boolean} metroNearby - Whether a metro station is in the zone.
 * @param {number} distanceKm   - Distance from property to nearest metro (km).
 * @returns {number} Premium in ₹ per sqft.
 */
function computeMetroPremium(metroNearby, distanceKm) {
  if (!metroNearby) return 0;
  if (distanceKm < 2) return 800;
  if (distanceKm < 5) return 400;
  return 0;
}

/**
 * Computes age-based depreciation in ₹ per sqft.
 * @param {number} propertyAge - Age of the property in years.
 * @returns {number} Depreciation amount in ₹ per sqft.
 */
function computeAgeDepreciation(propertyAge) {
  return propertyAge * 120;
}

/**
 * Computes the speculative uplift in ₹ per sqft.
 * @param {number} speculationLevel - Speculation factor (1–5).
 * @returns {number} Uplift in ₹ per sqft.
 */
function computeSpeculativeUplift(speculationLevel) {
  return speculationLevel * 500;
}

/**
 * Determines the risk bucket label based on variance percentage.
 * @param {number} variancePct - Percentage variance between market and circle rate.
 * @returns {'Safe'|'Caution'|'High Risk'} Risk label.
 */
function getRiskLevel(variancePct) {
  if (variancePct < 20) return 'Safe';
  if (variancePct <= 50) return 'Caution';
  return 'High Risk';
}

/**
 * Generates a human-readable insight string based on valuation inputs and output.
 * @param {Object} params
 * @param {number} params.speculationLevel
 * @param {number} params.metroDistanceKm
 * @param {number} params.propertyAge
 * @param {number} params.variancePct
 * @param {boolean} params.metroNearby
 * @returns {string} Plain-English reason text.
 */
function buildReasonText({ speculationLevel, metroDistanceKm, propertyAge, variancePct, metroNearby }) {
  if (speculationLevel >= 4 && metroDistanceKm < 2) {
    return 'High variance is driven by metro proximity and elevated broker speculation. The circle rate is likely outdated and has not kept pace with rapid infrastructure-driven appreciation in this zone.';
  }
  if (speculationLevel >= 4 && metroNearby) {
    return 'Elevated speculation combined with good metro connectivity is inflating prices beyond the government benchmark. Buyers should verify recent comparable transactions before committing.';
  }
  if (propertyAge > 20) {
    return 'Significant depreciation is reducing market value. Older properties carry higher renovation risk and may require structural assessment. Factor in refurbishment costs before finalising a price.';
  }
  if (variancePct < 20) {
    return 'This zone is fairly priced. The market rate closely tracks the government circle rate, indicating low speculative activity. A relatively safe entry point for end-users.';
  }
  if (variancePct > 50) {
    return 'This zone is significantly overpriced relative to the government benchmark. High variance signals active speculation — exercise caution and negotiate aggressively or look at adjacent zones.';
  }
  if (metroDistanceKm < 2 && metroNearby) {
    return 'Metro proximity is adding a meaningful premium to this zone. Infrastructure-driven appreciation is real here, but ensure the premium aligns with your usage — investors benefit more than end-users.';
  }
  if (speculationLevel >= 3) {
    return 'Moderate-to-high speculation is present. Market prices are running ahead of the circle rate. Verify with on-ground brokers and check recent registration data from the sub-registrar office.';
  }
  return 'This zone shows moderate variance between circle and market rates. Standard market dynamics apply — always cross-check with 2–3 recent comparable sales before transacting.';
}

module.exports = {
  applyRealTimeFluctuation,
  computeMetroPremium,
  computeAgeDepreciation,
  computeSpeculativeUplift,
  getRiskLevel,
  buildReasonText
};
