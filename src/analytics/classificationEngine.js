/**
 * GovSpirit ABC / XYZ / movement classification.
 *
 *   ABC  by share of inventory value (Pareto). A = top 80%, B = next 15%, C = rest.
 *   XYZ  by demand variability (coefficient of variation of monthly dispatch).
 *        X ≤ 0.5 stable, Y ≤ 1.0 variable, Z otherwise or insufficient history.
 *   Movement  by how many distinct days a SKU was dispatched on.
 */
(function initClassificationEngine(GovSpirit) {
  'use strict';

  const { Format, Collections, Store } = GovSpirit.require('Format', 'Collections', 'Store');

  const A_THRESHOLD = 80;
  const B_THRESHOLD = 95;
  const X_MAX_COV = 0.5;
  const Y_MAX_COV = 1.0;
  const FAST_DISPATCH_DAYS = 15;
  const SLOW_DISPATCH_DAYS = 5;
  /** Below this many observed months, variability is not meaningful. */
  const MIN_MONTHS_FOR_XYZ = 3;

  function classify() {
    const inventory = Store.inventory();
    const dispatch = Store.dispatch();

    if (inventory.length === 0) {
      const empty = {
        items: [],
        pareto: [],
        abcCounts: { A: 0, B: 0, C: 0 },
        abcValues: { A: 0, B: 0, C: 0 },
        xyzCounts: { X: 0, Y: 0, Z: 0 },
        movementCounts: { Fast: 0, Slow: 0, Dead: 0 },
        totalItems: 0,
        totalValue: 0,
      };
      Store.setClassifications(empty);
      return empty;
    }

    /* ── Roll inventory up to one row per SKU ───────────────────────────── */

    const bySku = new Map();
    inventory.forEach((row) => {
      let entry = bySku.get(row.sku_id);
      if (!entry) {
        entry = {
          sku_id: row.sku_id,
          sku_name: row.sku_name,
          brand: row.brand,
          category: row.category,
          value: 0,
          qty: 0,
          locations: 0,
        };
        bySku.set(row.sku_id, entry);
      }
      entry.value += row.total_value;
      entry.qty += row.quantity_bottles;
      entry.locations += 1;
    });

    const items = [...bySku.values()].sort((a, b) => b.value - a.value);
    const totalValue = items.reduce((sum, item) => sum + item.value, 0);

    /* ── ABC ────────────────────────────────────────────────────────────── */

    let cumulative = 0;
    items.forEach((item) => {
      cumulative += item.value;
      const cumulativePct = totalValue > 0 ? (cumulative / totalValue) * 100 : 100;
      item.cumulative_value_pct = Collections.roundTo(cumulativePct, 1);
      item.abc_class =
        cumulativePct <= A_THRESHOLD ? 'A' : cumulativePct <= B_THRESHOLD ? 'B' : 'C';
    });

    /* ── XYZ ────────────────────────────────────────────────────────────── */

    const monthlyBySku = new Map();
    dispatch.forEach((row) => {
      if (!row.sku_id) return;
      const month = Format.monthKey(row.dispatch_date);
      if (!month) return;
      let months = monthlyBySku.get(row.sku_id);
      if (!months) {
        months = new Map();
        monthlyBySku.set(row.sku_id, months);
      }
      months.set(month, (months.get(month) || 0) + row.quantity_dispatched);
    });

    items.forEach((item) => {
      const months = monthlyBySku.get(item.sku_id);
      if (!months || months.size < MIN_MONTHS_FOR_XYZ) {
        item.xyz_class = 'Z';
        item.cov = null;
        item.monthly_avg_dispatch = months ? Collections.mean([...months.values()]) : 0;
        item.xyz_reason = months
          ? `Only ${months.size} month(s) of dispatch history`
          : 'No dispatch history';
        return;
      }

      const values = [...months.values()];
      const cov = Collections.coefficientOfVariation(values);
      item.cov = cov === null ? null : Collections.roundTo(cov, 2);
      item.monthly_avg_dispatch = Collections.roundTo(Collections.mean(values), 1);
      item.xyz_class = cov === null ? 'Z' : cov <= X_MAX_COV ? 'X' : cov <= Y_MAX_COV ? 'Y' : 'Z';
      item.xyz_reason = null;
    });

    /* ── Movement ───────────────────────────────────────────────────────── */

    const dispatchDaysBySku = new Map();
    dispatch.forEach((row) => {
      if (!row.sku_id) return;
      const day = Format.dayKey(row.dispatch_date);
      if (!day) return;
      if (!dispatchDaysBySku.has(row.sku_id)) dispatchDaysBySku.set(row.sku_id, new Set());
      dispatchDaysBySku.get(row.sku_id).add(day);
    });

    items.forEach((item) => {
      const days = dispatchDaysBySku.get(item.sku_id)?.size || 0;
      item.dispatch_days = days;
      item.movement_class =
        days >= FAST_DISPATCH_DAYS ? 'Fast' : days >= SLOW_DISPATCH_DAYS ? 'Slow' : 'Dead';
    });

    /* ── Summaries ──────────────────────────────────────────────────────── */

    const abcCounts = { A: 0, B: 0, C: 0 };
    const abcValues = { A: 0, B: 0, C: 0 };
    const xyzCounts = { X: 0, Y: 0, Z: 0 };
    const movementCounts = { Fast: 0, Slow: 0, Dead: 0 };

    items.forEach((item) => {
      abcCounts[item.abc_class] += 1;
      abcValues[item.abc_class] += item.value;
      xyzCounts[item.xyz_class] += 1;
      movementCounts[item.movement_class] += 1;
    });

    const classifications = {
      items,
      // The Pareto chart only needs the head of the curve.
      pareto: items.slice(0, 40).map((item) => ({
        sku_id: item.sku_id,
        sku_name: item.sku_name,
        value: item.value,
        cumulative_pct: item.cumulative_value_pct,
        abc_class: item.abc_class,
      })),
      abcCounts,
      abcValues,
      xyzCounts,
      movementCounts,
      totalItems: items.length,
      totalValue,
    };

    Store.setClassifications(classifications);
    return classifications;
  }

  GovSpirit.ClassificationEngine = { classify };
})(window.GovSpirit);
