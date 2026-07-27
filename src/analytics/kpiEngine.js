/**
 * GovSpirit KPI engine.
 *
 * A deliberate change from the previous version: metrics that have no
 * supporting data now return `null` instead of a plausible-looking constant.
 * The old code returned 98.5% inventory accuracy when no cycle count had ever
 * been uploaded, 15 picks/hour with no workforce data, and 97% pick accuracy
 * out of thin air. Those numbers then fed the warehouse health score, so a
 * warehouse that had supplied nothing but a stock list scored well. A
 * dashboard that invents its own inputs is worse than no dashboard.
 *
 * `null` propagates to the UI as an em dash with an explanatory subtitle.
 */
(function initKpiEngine(GovSpirit) {
  'use strict';

  const { Format, Collections, Store } = GovSpirit.require('Format', 'Collections', 'Store');

  const DEAD_STOCK_DAYS = 90;
  const CASE_EQUIVALENT = 12;

  function calculate() {
    const state = Store.getState();
    const inventory = state.processedData.inventory;
    const orders = state.processedData.orders;
    const dispatch = state.processedData.dispatch;
    const zones = state.processedData.zones;
    const racks = state.processedData.racks;

    const layout = state.rawData.warehouseLayout;
    const damage = state.rawData.damage;
    const returns = state.rawData.returns;
    const cycleCount = state.rawData.cycleCount;
    const employees = state.rawData.employees;

    const today = Format.startOfToday();
    const todayKey = Format.dayKey(today);
    const last7 = Format.daysAgo(6);
    const last30 = Format.daysAgo(29);

    /* ── Inventory ──────────────────────────────────────────────────────── */

    const totalSKUs = Collections.countDistinct(inventory, 'sku_id');
    const activeSKUs = Collections.countDistinct(
      inventory.filter((r) => r.is_active === 'Yes' && r.quantity_bottles > 0),
      'sku_id'
    );
    const totalBottles = Collections.sumBy(inventory, 'quantity_bottles');
    const inventoryValue = Collections.sumBy(inventory, 'total_value');

    // Dead stock: nothing has left this line in 90 days. Where a last-dispatch
    // date exists it is authoritative; otherwise fall back to dwell time.
    const deadStockItems = inventory.filter((row) => {
      if (row.quantity_bottles <= 0) return false;
      if (row.last_dispatched_date) {
        const since = Format.daysBetween(row.last_dispatched_date, today);
        return since !== null && since > DEAD_STOCK_DAYS;
      }
      return row.days_in_stock > DEAD_STOCK_DAYS;
    });

    /* ── Orders ─────────────────────────────────────────────────────────── */

    const ordersToday = Collections.countDistinct(
      orders.filter((o) => Format.dayKey(o.order_date) === todayKey),
      'order_id'
    );
    const pendingOrders = Collections.countDistinct(
      orders.filter((o) => o.status === 'Pending' || o.status === 'Processing'),
      'order_id'
    );
    const completedOrders = Collections.countDistinct(
      orders.filter((o) => o.status === 'Completed'),
      'order_id'
    );

    const totalOrderLines = orders.length;
    // Fill rate is measured on lines, not orders: a hotel that receives four of
    // five requested products has had one line fail, and that is what matters
    // operationally.
    const fulfilledLines = orders.filter(
      (o) => o.quantity_ordered > 0 && o.quantity_fulfilled >= o.quantity_ordered
    ).length;
    const fillRate =
      totalOrderLines > 0 ? Collections.percentageOf(fulfilledLines, totalOrderLines) : null;

    const decidedOrders = completedOrders + pendingOrders;
    const orderFulfilmentRate =
      decidedOrders > 0 ? Collections.percentageOf(completedOrders, decidedOrders) : null;

    /* ── Dispatch ───────────────────────────────────────────────────────── */

    const dispatchCount = dispatch.length;
    const avgDispatchTime = dispatch.length
      ? Collections.avgBy(dispatch, 'dispatch_time_minutes')
      : null;
    const totalDispatchedBottles = Collections.sumBy(dispatch, 'quantity_dispatched');
    const totalDispatchValue = Collections.sumBy(dispatch, 'dispatch_value');

    const last30Dispatch = dispatch.filter((d) => d.dispatch_date && d.dispatch_date >= last30);
    const last7Dispatch = dispatch.filter((d) => d.dispatch_date && d.dispatch_date >= last7);
    const last30DispatchValue = Collections.sumBy(last30Dispatch, 'dispatch_value');

    /* ── Storage ────────────────────────────────────────────────────────── */

    const hasLayout = Array.isArray(layout) && layout.length > 0;

    const totalBins = hasLayout ? layout.length : racks.reduce((sum, r) => sum + r.numBins, 0);
    const occupiedBins = hasLayout
      ? layout.filter((b) => Format.toNumber(b.current_qty ?? b.occupied_bottles, 0) > 0).length
      : Collections.countDistinct(inventory, 'bin_id');
    const blockedBins = hasLayout
      ? layout.filter((b) => String(b.is_blocked ?? '').toLowerCase() === 'yes').length
      : 0;

    const warehouseOccupancy =
      totalBins > 0 ? Collections.percentageOf(occupiedBins, totalBins) : null;

    const totalCapacity = zones.reduce((sum, z) => sum + z.capacity, 0);
    const storageUtilization =
      totalCapacity > 0
        ? Math.min(100, Collections.percentageOf(totalBottles, totalCapacity))
        : null;
    // True when no layout file was supplied and capacity is an estimate.
    const storageUtilizationEstimated = zones.some((z) => z.capacityEstimated);

    /* ── Accuracy, from real cycle counts only ─────────────────────────── */

    const countedLines = Array.isArray(cycleCount) ? cycleCount.length : 0;
    const matchedLines = countedLines
      ? cycleCount.filter((c) => String(c.status).toLowerCase() === 'matched').length
      : 0;
    const inventoryAccuracy =
      countedLines > 0 ? Collections.percentageOf(matchedLines, countedLines) : null;

    /* ── Turnover ───────────────────────────────────────────────────────── */

    // Dispatch value over the last 30 days, annualised, divided by the value on
    // hand. Only a rough indicator without opening and closing balances, but
    // the assumptions are at least stated rather than hidden behind "/ 2".
    const inventoryTurnover =
      inventoryValue > 0 && last30DispatchValue > 0
        ? Collections.safeDivide(last30DispatchValue * (365 / 30), inventoryValue, 0)
        : null;

    /* ── Rankings ───────────────────────────────────────────────────────── */

    const rank = (rows, groupKey, label) =>
      Object.entries(Collections.groupBy(rows, groupKey))
        .map(([key, items]) => ({
          [label]: key,
          value: Collections.sumBy(items, 'total_value'),
          qty: Collections.sumBy(items, 'quantity_bottles'),
          skus: Collections.countDistinct(items, 'sku_id'),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    const topBrands = rank(inventory, 'brand', 'brand');
    const topSuppliers = rank(inventory, 'supplier', 'supplier');
    const topCategories = rank(inventory, 'category', 'category');

    const topHotels = Object.entries(Collections.groupBy(orders, 'hotel_name'))
      .map(([hotel, lines]) => ({
        hotel,
        totalOrders: Collections.countDistinct(lines, 'order_id'),
        orderValue: Collections.sumBy(lines, 'order_value'),
        qtyOrdered: Collections.sumBy(lines, 'quantity_ordered'),
        fillRate: Collections.roundTo(
          Collections.percentageOf(
            lines.filter(
              (l) => l.quantity_ordered > 0 && l.quantity_fulfilled >= l.quantity_ordered
            ).length,
            lines.length
          ),
          1
        ),
      }))
      .sort((a, b) => b.orderValue - a.orderValue)
      .slice(0, 10);

    const skuMovement = Object.entries(Collections.groupBy(dispatch, 'sku_id'))
      .map(([skuId, items]) => ({
        sku_id: skuId,
        sku_name: items[0]?.sku_name || skuId,
        brand: items[0]?.brand || '',
        category: items[0]?.category || '',
        dispatch_count: items.length,
        qty_dispatched: Collections.sumBy(items, 'quantity_dispatched'),
        dispatch_value: Collections.sumBy(items, 'dispatch_value'),
      }))
      .sort((a, b) => b.qty_dispatched - a.qty_dispatched);

    /* ── Concentration ──────────────────────────────────────────────────── */

    const byValue = Collections.sortBy(inventory, 'total_value', 'desc');
    const topDecileCount = Math.max(1, Math.ceil(inventory.length * 0.1));
    const topDecileValue = Collections.sumBy(byValue.slice(0, topDecileCount), 'total_value');
    const stockConcentration =
      inventoryValue > 0 ? Collections.percentageOf(topDecileValue, inventoryValue) : null;

    /* ── Losses ─────────────────────────────────────────────────────────── */

    const totalDamaged = Collections.sumBy(damage, 'quantity_damaged');
    const damageValue = Collections.sumBy(damage, 'damage_value');
    const totalReturned = Collections.sumBy(returns, 'quantity_returned');
    const returnValue = Collections.sumBy(returns, 'return_value');

    /* ── Workforce, from real employee data only ───────────────────────── */

    const pickingStaff = (employees || []).filter((e) => Format.toNumber(e.picks_per_hour, 0) > 0);
    const avgPicksPerHour = pickingStaff.length
      ? Collections.avgBy(pickingStaff, 'picks_per_hour')
      : null;
    const staffWithAccuracy = (employees || []).filter((e) => Format.isNumeric(e.accuracy_rate));
    const avgPickAccuracy = staffWithAccuracy.length
      ? Collections.avgBy(staffWithAccuracy, 'accuracy_rate')
      : null;

    /* ── Trends ─────────────────────────────────────────────────────────── */

    const trendDays = Format.lastNDayKeys(30);
    const dispatchByDay = Collections.countBy(dispatch, (d) => Format.dayKey(d.dispatch_date));
    const ordersByDay = Collections.countBy(orders, (o) => Format.dayKey(o.order_date));

    const valueByDay = Object.create(null);
    dispatch.forEach((d) => {
      const key = Format.dayKey(d.dispatch_date);
      if (!key) return;
      valueByDay[key] = (valueByDay[key] || 0) + Format.toNumber(d.dispatch_value, 0);
    });

    /* ── Warehouse health ───────────────────────────────────────────────── */

    // Components with no data are excluded and the remaining weights are
    // renormalised, so the score reflects what is actually known.
    const healthComponents = [
      { key: 'inventoryAccuracy', value: inventoryAccuracy, weight: 0.25 },
      { key: 'fillRate', value: fillRate, weight: 0.25 },
      {
        key: 'storageBalance',
        // 75% utilisation is the target; deviation in either direction costs.
        value:
          storageUtilization === null
            ? null
            : Math.max(0, 100 - Math.abs(storageUtilization - 75) * 2),
        weight: 0.2,
      },
      {
        key: 'deadStock',
        value:
          inventory.length === 0
            ? null
            : Math.max(
                0,
                100 - Collections.percentageOf(deadStockItems.length, inventory.length) * 2
              ),
        weight: 0.15,
      },
      { key: 'pickAccuracy', value: avgPickAccuracy, weight: 0.15 },
    ].filter((c) => c.value !== null && Number.isFinite(c.value));

    const weightTotal = healthComponents.reduce((sum, c) => sum + c.weight, 0);
    const warehouseHealthScore = weightTotal
      ? Collections.roundTo(
          healthComponents.reduce((sum, c) => sum + Math.min(100, c.value) * c.weight, 0) /
            weightTotal,
          1
        )
      : null;

    const round1 = (v) => (v === null ? null : Collections.roundTo(v, 1));

    const kpis = {
      // Inventory
      totalSKUs,
      activeSKUs,
      inactiveSKUs: Math.max(0, totalSKUs - activeSKUs),
      totalBottles,
      totalCases: Math.floor(totalBottles / CASE_EQUIVALENT),
      inventoryValue,
      deadStockCount: deadStockItems.length,
      deadStockValue: Collections.sumBy(deadStockItems, 'total_value'),
      avgStorageDays: inventory.length
        ? round1(Collections.avgBy(inventory, 'days_in_stock'))
        : null,

      // Orders
      ordersToday,
      pendingOrders,
      completedOrders,
      totalOrderLines,
      fulfilledLines,
      fillRate: round1(fillRate),
      orderFulfilmentRate: round1(orderFulfilmentRate),

      // Dispatch
      dispatchCount,
      avgDispatchTime: round1(avgDispatchTime),
      totalDispatchedBottles,
      totalDispatchValue,
      last30DispatchCount: last30Dispatch.length,
      last30DispatchValue,
      last7DispatchCount: last7Dispatch.length,

      // Storage
      totalBins,
      occupiedBins,
      blockedBins,
      warehouseOccupancy: round1(warehouseOccupancy),
      storageUtilization: round1(storageUtilization),
      storageUtilizationEstimated,
      inventoryAccuracy: round1(inventoryAccuracy),
      cycleCountLines: countedLines,
      inventoryTurnover:
        inventoryTurnover === null ? null : Collections.roundTo(inventoryTurnover, 2),

      // Zones
      avgZoneUtilization: zones.length ? round1(Collections.avgBy(zones, 'utilization')) : null,
      maxZoneUtilization: zones.length ? Math.max(...zones.map((z) => z.utilization)) : null,
      minZoneUtilization: zones.length ? Math.min(...zones.map((z) => z.utilization)) : null,

      // Rankings
      topBrands,
      topSuppliers,
      topCategories,
      topHotels,
      topSKUs: skuMovement.slice(0, 20),
      slowestSKUs: skuMovement.slice(-20).reverse(),

      // Risk
      stockConcentration: round1(stockConcentration),

      // Losses
      totalDamaged,
      damageValue,
      totalReturned,
      returnValue,

      // Workforce
      avgPicksPerHour: round1(avgPicksPerHour),
      avgPickAccuracy: round1(avgPickAccuracy),
      workforceRecords: (employees || []).length,

      // Trends
      trendDays,
      dispatchTrend: trendDays.map((day) => dispatchByDay[day] || 0),
      ordersTrend: trendDays.map((day) => ordersByDay[day] || 0),
      valueTrend: trendDays.map((day) => valueByDay[day] || 0),

      // Health
      warehouseHealthScore,
      healthComponents: healthComponents.map((c) => c.key),
    };

    Store.setKPIs(kpis);
    return kpis;
  }

  GovSpirit.KpiEngine = { calculate, DEAD_STOCK_DAYS };
})(window.GovSpirit);
