/**
 * GovSpirit collection and maths helpers used by the analytics engines.
 *
 * These deliberately tolerate dirty input: warehouse exports routinely contain
 * blank cells, numbers stored as text, and mixed types in a single column.
 * Every reducer coerces via Format.toNumber rather than trusting the value.
 */
(function initCollections(GovSpirit) {
  'use strict';

  const { Format } = GovSpirit.require('Format');

  const UNKEYED = '__unkeyed__';

  function keyOf(item, key) {
    return typeof key === 'function' ? key(item) : item?.[key];
  }

  /**
   * Group rows by a key or key function.
   * @returns {Record<string, object[]>}
   */
  function groupBy(rows, key) {
    const out = Object.create(null);
    (rows || []).forEach((item) => {
      const value = keyOf(item, key);
      const bucket =
        value === null || value === undefined || value === '' ? UNKEYED : String(value);
      (out[bucket] ||= []).push(item);
    });
    return out;
  }

  function countBy(rows, key) {
    const out = Object.create(null);
    (rows || []).forEach((item) => {
      const value = keyOf(item, key);
      if (value === null || value === undefined || value === '') return;
      const bucket = String(value);
      out[bucket] = (out[bucket] || 0) + 1;
    });
    return out;
  }

  function sumBy(rows, key) {
    return (rows || []).reduce((total, item) => total + Format.toNumber(keyOf(item, key), 0), 0);
  }

  function avgBy(rows, key) {
    if (!rows || rows.length === 0) return 0;
    return sumBy(rows, key) / rows.length;
  }

  /**
   * Sort a copy of `rows`. Numeric columns sort numerically, everything else
   * sorts with locale-aware string comparison. The previous implementation
   * did `b[key] - a[key]` unconditionally, which produced NaN (and therefore an
   * arbitrary order) for every text column it was pointed at.
   */
  function sortBy(rows, key, direction = 'desc') {
    const sign = direction === 'asc' ? 1 : -1;
    return [...(rows || [])].sort((a, b) => {
      const va = keyOf(a, key);
      const vb = keyOf(b, key);

      const aMissing = va === null || va === undefined || va === '';
      const bMissing = vb === null || vb === undefined || vb === '';
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1; // blanks always sink
      if (bMissing) return -1;

      if (Format.isNumeric(va) && Format.isNumeric(vb)) {
        return (Number(va) - Number(vb)) * sign;
      }
      if (va instanceof Date && vb instanceof Date) {
        return (va.getTime() - vb.getTime()) * sign;
      }
      return String(va).localeCompare(String(vb), Format.LOCALE, { numeric: true }) * sign;
    });
  }

  function topN(rows, key, n) {
    return sortBy(rows, key, 'desc').slice(0, n);
  }

  /** Distinct rows by key (or distinct primitives when no key is given). */
  function uniqueBy(rows, key) {
    const seen = new Set();
    return (rows || []).filter((item) => {
      const value = key ? keyOf(item, key) : item;
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  /** Sorted list of distinct non-empty values in a column. */
  function distinctValues(rows, key) {
    const seen = new Set();
    (rows || []).forEach((item) => {
      const value = keyOf(item, key);
      if (value === null || value === undefined || value === '') return;
      seen.add(String(value));
    });
    return [...seen].sort((a, b) => a.localeCompare(b, Format.LOCALE, { numeric: true }));
  }

  function countDistinct(rows, key) {
    const seen = new Set();
    (rows || []).forEach((item) => {
      const value = keyOf(item, key);
      if (value === null || value === undefined || value === '') return;
      seen.add(String(value));
    });
    return seen.size;
  }

  /** Label of the group with the largest total for `valueKey`. */
  function topGroup(rows, groupKey, valueKey) {
    const groups = groupBy(rows, groupKey);
    let best = null;
    let bestTotal = -Infinity;
    Object.entries(groups).forEach(([label, items]) => {
      const total = sumBy(items, valueKey);
      if (total > bestTotal) {
        bestTotal = total;
        best = label === UNKEYED ? null : label;
      }
    });
    return best;
  }

  /* ── Maths ────────────────────────────────────────────────────────────── */

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function roundTo(value, decimals = 0) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  /** Division that yields `fallback` instead of Infinity or NaN. */
  function safeDivide(numerator, denominator, fallback = 0) {
    if (!denominator || !Number.isFinite(denominator)) return fallback;
    const result = numerator / denominator;
    return Number.isFinite(result) ? result : fallback;
  }

  function percentageOf(part, whole, fallback = 0) {
    return safeDivide(part, whole, fallback / 100) * 100;
  }

  function mean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function standardDeviation(values) {
    if (!values || values.length < 2) return 0;
    const m = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  /** Coefficient of variation, the basis of XYZ demand classification. */
  function coefficientOfVariation(values) {
    const m = mean(values);
    if (m === 0) return null;
    return standardDeviation(values) / m;
  }

  GovSpirit.Collections = {
    groupBy,
    countBy,
    sumBy,
    avgBy,
    sortBy,
    topN,
    uniqueBy,
    distinctValues,
    countDistinct,
    topGroup,
    clamp,
    roundTo,
    safeDivide,
    percentageOf,
    mean,
    standardDeviation,
    coefficientOfVariation,
  };
})(window.GovSpirit);
