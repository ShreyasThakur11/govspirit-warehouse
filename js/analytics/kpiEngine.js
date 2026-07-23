/**
 * GovSpirit KPI Engine — Calculates all 45+ KPIs from processed data
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.KPIEngine = (function () {
  const { Utils, Store } = GovSpirit;

  function calculate() {
    const state = Store.getState();
    const inv = state.processedData.inventory || [];
    const orders = state.processedData.orders || [];
    const dispatch = state.processedData.dispatch || [];
    const zones = state.processedData.zones || [];
    const racks = state.processedData.racks || [];
    const rawLayout = state.rawData.warehouseLayout || [];
    const damage = state.rawData.damage || [];
    const returns = state.rawData.returns || [];
    const cycleCount = state.rawData.cycleCount || [];
    const employees = state.rawData.employees || [];

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const last30 = new Date(); last30.setDate(last30.getDate() - 30);
    const last7 = new Date(); last7.setDate(last7.getDate() - 7);

    // ─── Inventory KPIs ───────────────────────────────────────────────────

    const totalSKUs = [...new Set(inv.map(r => r.sku_id).filter(Boolean))].length;
    const activeSKUs = [...new Set(inv.filter(r => r.is_active === 'Yes' && r.quantity_bottles > 0).map(r => r.sku_id))].length;
    const inactiveSKUs = totalSKUs - activeSKUs;

    const totalBottles = Utils.sumBy(inv, 'quantity_bottles');
    const totalCases = Math.floor(totalBottles / 12);
    const inventoryValue = Utils.sumBy(inv, 'total_value');

    // Dead stock: no dispatch in 90+ days
    const deadStockItems = inv.filter(r => {
      if (r.quantity_bottles <= 0) return false;
      const lastOut = r.last_dispatched_date;
      if (!lastOut) return r.days_in_stock > 90;
      return Utils.daysBetween(lastOut, today) > 90;
    });
    const deadStockValue = Utils.sumBy(deadStockItems, 'total_value');
    const deadStockCount = deadStockItems.length;

    const avgStorageDays = inv.length ? Utils.avgBy(inv, 'days_in_stock') : 0;

    // ─── Order KPIs ───────────────────────────────────────────────────────

    const todayOrders = orders.filter(o => {
      const d = o.order_date;
      return d && d.toISOString().slice(0, 10) === todayStr;
    });
    const ordersToday = [...new Set(todayOrders.map(o => o.order_id))].length;
    const pendingOrders = [...new Set(orders.filter(o => o.status === 'Pending' || o.status === 'Processing').map(o => o.order_id))].length;
    const completedOrders = [...new Set(orders.filter(o => o.status === 'Completed').map(o => o.order_id))].length;

    const totalOrderLines = orders.length;
    const fulfilledLines = orders.filter(o => o.status === 'Completed' || o.quantity_fulfilled >= o.quantity_ordered).length;
    const fillRate = totalOrderLines > 0 ? (fulfilledLines / totalOrderLines) * 100 : 0;
    const orderFulfillmentRate = (completedOrders + pendingOrders) > 0
      ? (completedOrders / (completedOrders + pendingOrders)) * 100 : 0;

    // ─── Dispatch KPIs ────────────────────────────────────────────────────

    const dispatchCount = dispatch.length;
    const avgDispatchTime = dispatch.length ? Utils.avgBy(dispatch, 'dispatch_time_minutes') : 0;
    const totalDispatchedBottles = Utils.sumBy(dispatch, 'quantity_dispatched');
    const totalDispatchValue = Utils.sumBy(dispatch, 'dispatch_value');

    const last30Dispatch = dispatch.filter(d => d.dispatch_date && d.dispatch_date >= last30);
    const last7Dispatch = dispatch.filter(d => d.dispatch_date && d.dispatch_date >= last7);

    // ─── Warehouse KPIs ───────────────────────────────────────────────────

    const totalBins = rawLayout.length || (racks.length * 10);
    const occupiedBins = rawLayout.filter(b => parseFloat(b.current_qty) > 0).length || inv.length;
    const blockedBins = rawLayout.filter(b => b.is_blocked === 'Yes').length;
    const warehouseOccupancy = totalBins > 0 ? (occupiedBins / totalBins) * 100 : 0;

    const totalCapacity = rawLayout.reduce((s, b) => s + (parseFloat(b.capacity) || 100), 0) || totalBins * 100;
    const usedCapacity = rawLayout.reduce((s, b) => s + (parseFloat(b.current_qty) || 0), 0) || totalBottles;
    const storageUtilization = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

    // ─── Inventory Accuracy ───────────────────────────────────────────────

    const counted = cycleCount.length;
    const matched = cycleCount.filter(c => c.status === 'Matched').length;
    const inventoryAccuracy = counted > 0 ? (matched / counted) * 100 : 98.5;

    // ─── Inventory Turnover ───────────────────────────────────────────────

    const avgInventory = inventoryValue / 2 || 1;
    const inventoryTurnover = totalDispatchValue > 0 ? totalDispatchValue / avgInventory : 0;

    // ─── Zone Utilization ─────────────────────────────────────────────────

    const avgZoneUtilization = zones.length ? Utils.avgBy(zones, 'utilization') : 0;
    const maxZoneUtil = zones.length ? Math.max(...zones.map(z => z.utilization)) : 0;
    const minZoneUtil = zones.length ? Math.min(...zones.map(z => z.utilization)) : 0;

    // ─── Top Lists ────────────────────────────────────────────────────────

    // Top brands by inventory value
    const brandGroups = Utils.groupBy(inv, 'brand');
    const topBrands = Object.entries(brandGroups)
      .map(([brand, items]) => ({ brand, value: Utils.sumBy(items, 'total_value'), qty: Utils.sumBy(items, 'quantity_bottles'), skus: items.length }))
      .sort((a, b) => b.value - a.value).slice(0, 10);

    // Top suppliers
    const supplierGroups = Utils.groupBy(inv, 'supplier');
    const topSuppliers = Object.entries(supplierGroups)
      .map(([supplier, items]) => ({ supplier, value: Utils.sumBy(items, 'total_value'), qty: Utils.sumBy(items, 'quantity_bottles'), skus: items.length }))
      .sort((a, b) => b.value - a.value).slice(0, 10);

    // Top categories
    const catGroups = Utils.groupBy(inv, 'category');
    const topCategories = Object.entries(catGroups)
      .map(([category, items]) => ({ category, value: Utils.sumBy(items, 'total_value'), qty: Utils.sumBy(items, 'quantity_bottles'), skus: items.length }))
      .sort((a, b) => b.value - a.value).slice(0, 10);

    // Top hotels by order volume
    const hotelGroups = Utils.groupBy(orders, 'hotel_name');
    const topHotels = Object.entries(hotelGroups)
      .map(([hotel, lines]) => ({
        hotel,
        totalOrders: [...new Set(lines.map(l => l.order_id))].length,
        orderValue: Utils.sumBy(lines, 'order_value'),
        qtyOrdered: Utils.sumBy(lines, 'quantity_ordered'),
      }))
      .sort((a, b) => b.orderValue - a.orderValue).slice(0, 10);

    // Top SKUs by dispatch frequency
    const skuDispatch = Utils.groupBy(dispatch, 'sku_id');
    const topSKUsByDispatch = Object.entries(skuDispatch)
      .map(([sku_id, items]) => ({
        sku_id,
        sku_name: items[0]?.sku_name || sku_id,
        brand: items[0]?.brand || '',
        category: items[0]?.category || '',
        dispatch_count: items.length,
        qty_dispatched: Utils.sumBy(items, 'quantity_dispatched'),
        dispatch_value: Utils.sumBy(items, 'dispatch_value'),
      }))
      .sort((a, b) => b.qty_dispatched - a.qty_dispatched);

    const top20SKUs = topSKUsByDispatch.slice(0, 20);
    const bottom20SKUs = [...topSKUsByDispatch].reverse().slice(0, 20);

    // ─── Stock Concentration ──────────────────────────────────────────────

    const sortedByValue = Utils.sortBy(inv, 'total_value', 'desc');
    const top10PctCount = Math.ceil(inv.length * 0.1);
    const top10PctValue = Utils.sumBy(sortedByValue.slice(0, top10PctCount), 'total_value');
    const stockConcentration = inventoryValue > 0 ? (top10PctValue / inventoryValue) * 100 : 0;

    // ─── Damage KPIs ──────────────────────────────────────────────────────

    const totalDamaged = damage.reduce((s, d) => s + (parseFloat(d.quantity_damaged) || 0), 0);
    const damageValue = damage.reduce((s, d) => s + (parseFloat(d.damage_value) || 0), 0);

    // ─── Returns KPIs ─────────────────────────────────────────────────────

    const totalReturned = returns.reduce((s, r) => s + (parseFloat(r.quantity_returned) || 0), 0);
    const returnValue = returns.reduce((s, r) => s + (parseFloat(r.return_value) || 0), 0);

    // ─── Employee Productivity ────────────────────────────────────────────

    const avgPicksPerHour = employees.length ? Utils.avgBy(employees, 'picks_per_hour') : 15;
    const avgAccuracy = employees.length ? Utils.avgBy(employees, 'accuracy_rate') : 97;

    // ─── Trends (last 30 days, daily) ─────────────────────────────────────

    const last30Days = Utils.getLast30Days();
    const dispatchByDay = Utils.countBy(dispatch.filter(d => d.dispatch_date), d => d.dispatch_date?.toISOString().slice(0, 10));
    const ordersByDay = Utils.countBy(orders.filter(o => o.order_date), o => o.order_date?.toISOString().slice(0, 10));

    const dispatchTrend = last30Days.map(d => dispatchByDay[d] || 0);
    const ordersTrend = last30Days.map(d => ordersByDay[d] || 0);

    const valueByDay = {};
    dispatch.filter(d => d.dispatch_date).forEach(d => {
      const k = d.dispatch_date.toISOString().slice(0, 10);
      valueByDay[k] = (valueByDay[k] || 0) + d.dispatch_value;
    });
    const valueTrend = last30Days.map(d => valueByDay[d] || 0);

    // ─── Warehouse Health Score ───────────────────────────────────────────

    const healthComponents = [
      { score: Math.min(100, inventoryAccuracy), weight: 0.25 },
      { score: Math.min(100, fillRate), weight: 0.25 },
      { score: Math.max(0, 100 - Math.abs(storageUtilization - 75)), weight: 0.20 }, // 75% is ideal
      { score: deadStockCount < 5 ? 100 : Math.max(0, 100 - deadStockCount * 2), weight: 0.15 },
      { score: Math.min(100, avgAccuracy), weight: 0.15 },
    ];
    const warehouseHealthScore = healthComponents.reduce((s, c) => s + c.score * c.weight, 0);

    const kpis = {
      // Inventory
      totalSKUs, activeSKUs, inactiveSKUs,
      totalBottles, totalCases, inventoryValue,
      deadStockCount, deadStockValue, deadStockItems,
      avgStorageDays,

      // Orders
      ordersToday, pendingOrders, completedOrders,
      totalOrderLines, fulfilledLines,
      fillRate: parseFloat(fillRate.toFixed(1)),
      orderFulfillmentRate: parseFloat(orderFulfillmentRate.toFixed(1)),

      // Dispatch
      dispatchCount, avgDispatchTime,
      totalDispatchedBottles, totalDispatchValue,
      last30DispatchCount: last30Dispatch.length,
      last7DispatchCount: last7Dispatch.length,

      // Warehouse
      totalBins, occupiedBins, blockedBins,
      warehouseOccupancy: parseFloat(warehouseOccupancy.toFixed(1)),
      storageUtilization: parseFloat(storageUtilization.toFixed(1)),
      inventoryAccuracy: parseFloat(inventoryAccuracy.toFixed(1)),

      // Turnover
      inventoryTurnover: parseFloat(inventoryTurnover.toFixed(2)),

      // Zone
      avgZoneUtilization: parseFloat(avgZoneUtilization.toFixed(1)),
      maxZoneUtil, minZoneUtil,

      // Top lists
      topBrands, topSuppliers, topCategories, topHotels,
      top20SKUs, bottom20SKUs,

      // Concentration
      stockConcentration: parseFloat(stockConcentration.toFixed(1)),

      // Damage & Returns
      totalDamaged, damageValue, totalReturned, returnValue,

      // Employees
      avgPicksPerHour: parseFloat(avgPicksPerHour.toFixed(1)),
      avgAccuracy: parseFloat(avgAccuracy.toFixed(1)),

      // Trends
      last30Days, dispatchTrend, ordersTrend, valueTrend,

      // Health
      warehouseHealthScore: parseFloat(warehouseHealthScore.toFixed(1)),
    };

    Store.setKPIs(kpis);
    return kpis;
  }

  return { calculate };
})();
