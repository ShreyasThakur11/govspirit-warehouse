/**
 * GovSpirit stock aging, dead stock, damage and returns.
 */
(function initAgingEngine(GovSpirit) {
  'use strict';

  const { Collections, Store } = GovSpirit.require('Collections', 'Store');

  const BUCKETS = Object.freeze([
    { range: '0–30', min: 0, max: 30, tone: '#10b981' },
    { range: '31–60', min: 31, max: 60, tone: '#3b82f6' },
    { range: '61–90', min: 61, max: 90, tone: '#f59e0b' },
    { range: '90+', min: 91, max: Infinity, tone: '#f43f5e' },
  ]);

  const DEAD_DAYS = 90;
  const HIGH_RISK_DAYS = 180;
  const MAX_LIST_ROWS = 200;

  function analyze() {
    const inventory = Store.inventory();
    const { damage, returns } = Store.rawData();

    const agingBuckets = BUCKETS.map((bucket) => {
      const items = inventory.filter(
        (row) => row.days_in_stock >= bucket.min && row.days_in_stock <= bucket.max
      );
      return {
        range: bucket.range,
        tone: bucket.tone,
        count: items.length,
        qty: Collections.sumBy(items, 'quantity_bottles'),
        value: Collections.sumBy(items, 'total_value'),
        pct: inventory.length
          ? Collections.roundTo(Collections.percentageOf(items.length, inventory.length), 1)
          : 0,
      };
    });

    const deadStock = inventory
      .filter((row) => row.days_in_stock > DEAD_DAYS && row.quantity_bottles > 0)
      .sort((a, b) => b.days_in_stock - a.days_in_stock)
      .map((row) => ({
        ...row,
        risk: row.days_in_stock > HIGH_RISK_DAYS ? 'High' : 'Medium',
      }));

    const summarise = (rows, key, label) =>
      Object.entries(Collections.groupBy(rows, key))
        .map(([value, items]) => ({
          [label]: value,
          count: items.length,
          qty: Collections.sumBy(items, 'quantity_bottles'),
          value: Collections.sumBy(items, 'total_value'),
        }))
        .sort((a, b) => b.value - a.value);

    const brandAging = Object.entries(Collections.groupBy(inventory, 'brand'))
      .map(([brand, items]) => ({
        brand,
        avg_days: Collections.roundTo(Collections.avgBy(items, 'days_in_stock'), 1),
        max_days: Math.max(...items.map((i) => i.days_in_stock)),
        total_value: Collections.sumBy(items, 'total_value'),
        dead_count: items.filter((i) => i.days_in_stock > DEAD_DAYS).length,
      }))
      .sort((a, b) => b.avg_days - a.avg_days)
      .slice(0, 15);

    const aging = {
      agingBuckets,
      deadStock: deadStock.slice(0, MAX_LIST_ROWS),
      deadStockTotal: deadStock.length,
      deadStockByBrand: summarise(deadStock, 'brand', 'brand').slice(0, 10),
      deadStockByZone: summarise(deadStock, 'zone', 'zone'),
      brandAging,
      damage: (damage || []).slice(0, MAX_LIST_ROWS),
      returns: (returns || []).slice(0, MAX_LIST_ROWS),
      totalDeadQty: Collections.sumBy(deadStock, 'quantity_bottles'),
      totalDeadValue: Collections.sumBy(deadStock, 'total_value'),
    };

    Store.setAging(aging);
    return aging;
  }

  GovSpirit.AgingEngine = { analyze, BUCKETS, DEAD_DAYS };
})(window.GovSpirit);
