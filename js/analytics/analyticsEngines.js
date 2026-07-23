/**
 * GovSpirit ABC/XYZ Classification Engine
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.ABCXYZEngine = (function () {
  const { Utils, Store } = GovSpirit;

  function classify() {
    const inv = Store.getState().processedData.inventory || [];
    const dispatch = Store.getState().processedData.dispatch || [];

    // ─── ABC Classification (by value) ───────────────────────────────────

    const skuValues = {};
    inv.forEach(r => {
      if (!skuValues[r.sku_id]) skuValues[r.sku_id] = { sku_id: r.sku_id, sku_name: r.sku_name, brand: r.brand, category: r.category, value: 0, qty: 0 };
      skuValues[r.sku_id].value += r.total_value;
      skuValues[r.sku_id].qty += r.quantity_bottles;
    });

    const sorted = Object.values(skuValues).sort((a, b) => b.value - a.value);
    const totalValue = sorted.reduce((s, r) => s + r.value, 0);
    let cumValue = 0;

    sorted.forEach(item => {
      cumValue += item.value;
      const cumPct = (cumValue / totalValue) * 100;
      item.abc_class = cumPct <= 80 ? 'A' : cumPct <= 95 ? 'B' : 'C';
      item.cum_value_pct = parseFloat(cumPct.toFixed(1));
    });

    // ─── XYZ Classification (by demand variability) ──────────────────────

    const skuMonthlyDispatch = {};
    dispatch.forEach(d => {
      if (!d.sku_id) return;
      const month = d.dispatch_date ? d.dispatch_date.toISOString().slice(0, 7) : 'unknown';
      if (!skuMonthlyDispatch[d.sku_id]) skuMonthlyDispatch[d.sku_id] = {};
      skuMonthlyDispatch[d.sku_id][month] = (skuMonthlyDispatch[d.sku_id][month] || 0) + d.quantity_dispatched;
    });

    sorted.forEach(item => {
      const monthData = skuMonthlyDispatch[item.sku_id];
      if (!monthData || Object.keys(monthData).length < 2) {
        item.xyz_class = 'Z'; // Insufficient data
        item.cov = null;
        return;
      }
      const vals = Object.values(monthData);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      if (mean === 0) { item.xyz_class = 'Z'; item.cov = null; return; }
      const variance = vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length;
      const stdDev = Math.sqrt(variance);
      const cov = stdDev / mean; // Coefficient of variation
      item.cov = parseFloat(cov.toFixed(2));
      item.xyz_class = cov <= 0.5 ? 'X' : cov <= 1.0 ? 'Y' : 'Z';
      item.monthly_avg_dispatch = parseFloat(mean.toFixed(1));
    });

    // ─── Fast/Slow/Dead Classification ───────────────────────────────────

    const skuDispatchDays = {};
    dispatch.forEach(d => {
      if (!d.sku_id || !d.dispatch_date) return;
      if (!skuDispatchDays[d.sku_id]) skuDispatchDays[d.sku_id] = new Set();
      skuDispatchDays[d.sku_id].add(d.dispatch_date.toISOString().slice(0, 10));
    });

    sorted.forEach(item => {
      const days = skuDispatchDays[item.sku_id]?.size || 0;
      item.dispatch_days = days;
      item.movement_class = days >= 15 ? 'Fast' : days >= 5 ? 'Slow' : 'Dead';
    });

    // ─── Pareto Data ──────────────────────────────────────────────────────

    let cumulativeValue = 0;
    const pareto = sorted.map(item => {
      cumulativeValue += item.value;
      return {
        sku_id: item.sku_id,
        sku_name: item.sku_name,
        value: item.value,
        cumulative_pct: parseFloat(((cumulativeValue / totalValue) * 100).toFixed(1)),
        abc_class: item.abc_class,
      };
    });

    // ─── Summary Stats ────────────────────────────────────────────────────

    const abcCounts = { A: 0, B: 0, C: 0 };
    const abcValues = { A: 0, B: 0, C: 0 };
    const xyzCounts = { X: 0, Y: 0, Z: 0 };
    const movementCounts = { Fast: 0, Slow: 0, Dead: 0 };

    sorted.forEach(item => {
      abcCounts[item.abc_class]++;
      abcValues[item.abc_class] = (abcValues[item.abc_class] || 0) + item.value;
      if (item.xyz_class) xyzCounts[item.xyz_class]++;
      if (item.movement_class) movementCounts[item.movement_class]++;
    });

    const classifications = {
      items: sorted,
      pareto,
      abcCounts, abcValues, xyzCounts, movementCounts,
      totalItems: sorted.length,
      totalValue,
    };

    Store.setClassifications(classifications);
    return classifications;
  }

  return { classify };
})();

/**
 * GovSpirit Aging Engine
 */
GovSpirit.AgingEngine = (function () {
  const { Utils, Store } = GovSpirit;

  function analyze() {
    const inv = Store.getState().processedData.inventory || [];
    const damage = Store.getState().rawData.damage || [];
    const returns = Store.getState().rawData.returns || [];

    // ─── Aging Buckets ────────────────────────────────────────────────────

    const buckets = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };
    inv.forEach(r => {
      const d = r.days_in_stock;
      if (d <= 30) buckets['0-30'].push(r);
      else if (d <= 60) buckets['31-60'].push(r);
      else if (d <= 90) buckets['61-90'].push(r);
      else buckets['90+'].push(r);
    });

    const agingBuckets = Object.entries(buckets).map(([range, items]) => ({
      range,
      count: items.length,
      qty: Utils.sumBy(items, 'quantity_bottles'),
      value: Utils.sumBy(items, 'total_value'),
      pct: inv.length > 0 ? parseFloat(((items.length / inv.length) * 100).toFixed(1)) : 0,
    }));

    // ─── Dead Stock (no movement 90+ days) ───────────────────────────────

    const deadStock = inv.filter(r => r.days_in_stock > 90 && r.quantity_bottles > 0)
      .sort((a, b) => b.days_in_stock - a.days_in_stock)
      .map(r => ({ ...r, risk: r.days_in_stock > 180 ? 'High' : 'Medium' }));

    const deadStockByBrand = Utils.groupBy(deadStock, 'brand');
    const deadStockByZone = Utils.groupBy(deadStock, 'zone');

    // ─── Brand Aging ──────────────────────────────────────────────────────

    const brandAging = Object.entries(Utils.groupBy(inv, 'brand')).map(([brand, items]) => ({
      brand,
      avg_days: parseFloat(Utils.avgBy(items, 'days_in_stock').toFixed(1)),
      max_days: Math.max(...items.map(i => i.days_in_stock)),
      total_value: Utils.sumBy(items, 'total_value'),
      dead_count: items.filter(i => i.days_in_stock > 90).length,
    })).sort((a, b) => b.avg_days - a.avg_days);

    const aging = {
      agingBuckets,
      deadStock: deadStock.slice(0, 50),
      deadStockByBrand: Object.entries(deadStockByBrand).map(([b, i]) => ({ brand: b, count: i.length, value: Utils.sumBy(i, 'total_value') })),
      deadStockByZone: Object.entries(deadStockByZone).map(([z, i]) => ({ zone: z, count: i.length, value: Utils.sumBy(i, 'total_value') })),
      brandAging: brandAging.slice(0, 15),
      damage: damage.slice(0, 50),
      returns: returns.slice(0, 50),
      totalDeadQty: Utils.sumBy(deadStock, 'quantity_bottles'),
      totalDeadValue: Utils.sumBy(deadStock, 'total_value'),
    };

    Store.setAging(aging);
    return aging;
  }

  return { analyze };
})();

/**
 * GovSpirit Utilization Engine
 */
GovSpirit.UtilizationEngine = (function () {
  const { Utils, Store } = GovSpirit;

  function analyze() {
    const inv = Store.getState().processedData.inventory || [];
    const zones = Store.getState().processedData.zones || [];
    const racks = Store.getState().processedData.racks || [];
    const rawLayout = Store.getState().rawData.warehouseLayout || [];
    const dispatch = Store.getState().processedData.dispatch || [];

    // ─── Zone Utilization ─────────────────────────────────────────────────

    const zoneUtil = zones.map(z => ({
      ...z,
      status: z.utilization >= 90 ? 'Critical' : z.utilization >= 75 ? 'High' : z.utilization >= 50 ? 'Medium' : 'Low',
      color: Utils.getUtilizationColor(z.utilization),
    }));

    // ─── Rack Utilization ─────────────────────────────────────────────────

    const rackUtil = racks.map(r => ({
      ...r,
      status: r.utilization >= 90 ? 'Critical' : r.utilization >= 75 ? 'High' : r.utilization >= 50 ? 'Medium' : 'Low',
      color: Utils.getUtilizationColor(r.utilization),
    }));

    const congestedRacks = rackUtil.filter(r => r.utilization >= 90).length;
    const emptyRacks = rackUtil.filter(r => r.utilization < 10).length;
    const underutilizedRacks = rackUtil.filter(r => r.utilization < 40).length;

    // ─── Vehicle Utilization ──────────────────────────────────────────────

    const vehicleGroups = Utils.groupBy(dispatch, 'vehicle');
    const vehicleUtil = Object.entries(vehicleGroups).map(([v, items]) => ({
      vehicle: v,
      trips: items.length,
      totalQty: Utils.sumBy(items, 'quantity_dispatched'),
      totalValue: Utils.sumBy(items, 'dispatch_value'),
      avgLoad: parseFloat((Utils.avgBy(items, 'quantity_dispatched')).toFixed(1)),
    })).sort((a, b) => b.trips - a.trips);

    // ─── Hourly Pattern (simulated from avg dispatch time) ────────────────

    const hourlyPressure = Array.from({ length: 24 }, (_, h) => {
      // Simulate peak hours: 10-11am and 3-5pm
      const isPeak = (h >= 9 && h <= 11) || (h >= 14 && h <= 17);
      const isSlow = h < 7 || h > 19;
      return { hour: h, activity: isSlow ? Math.round(Math.random() * 15) : isPeak ? Math.round(60 + Math.random() * 40) : Math.round(20 + Math.random() * 40) };
    });

    const util = {
      zoneUtil,
      rackUtil: rackUtil.slice(0, 50),
      congestedRacks, emptyRacks, underutilizedRacks,
      vehicleUtil,
      hourlyPressure,
      topCongestedZones: zoneUtil.filter(z => z.utilization >= 75).sort((a, b) => b.utilization - a.utilization),
      underutilizedZones: zoneUtil.filter(z => z.utilization < 40).sort((a, b) => a.utilization - b.utilization),
    };

    Store.setUtilization(util);
    return util;
  }

  return { analyze };
})();
