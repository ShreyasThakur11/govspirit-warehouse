/**
 * GovSpirit Data Transformer
 * Cleans, normalizes, and builds relationships from raw mapped data
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.DataTransformer = (function () {
  const { Utils, Store } = GovSpirit;

  // ─── Type Coercions ───────────────────────────────────────────────────────

  function toNum(v, def = 0) {
    const n = parseFloat(v);
    return isNaN(n) ? def : n;
  }

  function toStr(v) {
    return v !== null && v !== undefined ? String(v).trim() : '';
  }

  function toDate(v) {
    return Utils.parseDate(v);
  }

  function toBool(v) {
    if (typeof v === 'boolean') return v;
    const s = String(v).toLowerCase();
    return ['yes', 'true', '1', 'y'].includes(s);
  }

  // ─── Clean Inventory ──────────────────────────────────────────────────────

  function cleanInventory(data) {
    const seen = new Set();
    return data
      .map(row => {
        const qty = toNum(row.quantity_bottles, 0);
        const price = toNum(row.unit_price, 0);
        const value = toNum(row.total_value) || qty * price;
        const lastReceived = toDate(row.last_received_date);
        const lastDispatched = toDate(row.last_dispatched_date);
        const daysInStock = row.days_in_stock
          ? toNum(row.days_in_stock)
          : lastReceived ? Utils.daysBetween(lastReceived, new Date()) : 0;

        const skuId = toStr(row.sku_id);
        const zone = toStr(row.zone || row.rack_id?.charAt(0) || '').toUpperCase();
        const rackId = toStr(row.rack_id || '').toUpperCase();
        const binId = toStr(row.bin_id || rackId || '').toUpperCase();

        return {
          inv_id: toStr(row.inv_id || Utils.generateId('inv')),
          sku_id: skuId,
          sku_name: toStr(row.sku_name || skuId),
          brand: toStr(row.brand || 'Unknown'),
          category: toStr(row.category || 'Unknown'),
          alcohol_type: toStr(row.alcohol_type || row.category || 'Unknown'),
          bottle_size: toStr(row.bottle_size || '750ml'),
          supplier: toStr(row.supplier || 'Unknown'),
          zone: zone || 'A',
          rack_id: rackId || 'A01',
          bin_id: binId || 'A01-B01',
          quantity_bottles: Math.max(0, qty),
          quantity_cases: toNum(row.quantity_cases) || Math.floor(qty / 12),
          unit_price: Math.max(0, price),
          total_value: Math.max(0, value),
          last_received_date: lastReceived,
          last_dispatched_date: lastDispatched,
          days_in_stock: Math.max(0, daysInStock),
          lot_number: toStr(row.lot_number || ''),
          expiry_date: toDate(row.expiry_date),
          condition: toStr(row.condition || 'Good'),
          is_active: toBool(row.is_active !== false && row.is_active !== 'No') ? 'Yes' : 'No',
        };
      })
      .filter(row => {
        if (!row.sku_id) return false; // drop rows with no SKU
        const key = `${row.sku_id}__${row.bin_id}`;
        if (seen.has(key)) return false; // dedup
        seen.add(key);
        return true;
      });
  }

  // ─── Clean Orders ─────────────────────────────────────────────────────────

  function cleanOrders(data) {
    return data
      .map(row => {
        const ordered = toNum(row.quantity_ordered, 0);
        const fulfilled = toNum(row.quantity_fulfilled, 0);
        const price = toNum(row.unit_price, 0);
        return {
          order_id: toStr(row.order_id || Utils.generateId('ord')),
          line_id: toStr(row.line_id || Utils.generateId('line')),
          hotel_name: toStr(row.hotel_name || 'Unknown Hotel'),
          order_date: toDate(row.order_date),
          delivery_date: toDate(row.delivery_date),
          sku_id: toStr(row.sku_id || ''),
          sku_name: toStr(row.sku_name || ''),
          brand: toStr(row.brand || ''),
          category: toStr(row.category || ''),
          bottle_size: toStr(row.bottle_size || ''),
          quantity_ordered: Math.max(0, ordered),
          quantity_fulfilled: Math.min(Math.max(0, fulfilled), ordered * 1.1),
          unit_price: Math.max(0, price),
          order_value: toNum(row.order_value) || ordered * price,
          fulfilled_value: toNum(row.fulfilled_value) || fulfilled * price,
          status: toStr(row.status || (fulfilled >= ordered ? 'Completed' : 'Pending')),
          priority: toStr(row.priority || 'Normal'),
        };
      })
      .filter(row => row.hotel_name && row.order_date);
  }

  // ─── Clean Dispatch ───────────────────────────────────────────────────────

  function cleanDispatch(data) {
    return data.map(row => ({
      dispatch_id: toStr(row.dispatch_id || Utils.generateId('dis')),
      order_id: toStr(row.order_id || ''),
      dispatch_date: toDate(row.dispatch_date),
      hotel_name: toStr(row.hotel_name || ''),
      sku_id: toStr(row.sku_id || ''),
      sku_name: toStr(row.sku_name || ''),
      brand: toStr(row.brand || ''),
      category: toStr(row.category || ''),
      quantity_dispatched: Math.max(0, toNum(row.quantity_dispatched, 0)),
      dispatch_value: Math.max(0, toNum(row.dispatch_value, 0)),
      vehicle: toStr(row.vehicle || ''),
      driver: toStr(row.driver || ''),
      picker: toStr(row.picker || ''),
      dispatch_time_minutes: toNum(row.dispatch_time_minutes, 30),
      status: toStr(row.status || 'Delivered'),
    })).filter(row => row.dispatch_date && row.quantity_dispatched > 0);
  }

  // ─── Build Zone/Rack Aggregates ───────────────────────────────────────────

  function buildZoneRacks(inventory, warehouseLayout) {
    // If layout data exists, use it; otherwise derive from inventory
    const layoutData = warehouseLayout && warehouseLayout.length > 0 ? warehouseLayout : null;

    // Aggregate inventory by zone and rack
    const byZone = Utils.groupBy(inventory, 'zone');
    const byRack = Utils.groupBy(inventory, 'rack_id');

    const zones = Object.entries(byZone).map(([zone, items]) => {
      const totalQty = Utils.sumBy(items, 'quantity_bottles');
      const totalValue = Utils.sumBy(items, 'total_value');
      const rackIds = [...new Set(items.map(i => i.rack_id))];
      const capacity = layoutData
        ? layoutData.filter(l => l.zone === zone).reduce((s, l) => s + toNum(l.capacity, 100), 0)
        : rackIds.length * BINS_PER_RACK * 100;
      const utilization = capacity > 0 ? Math.min(100, (totalQty / capacity) * 100) : 0;

      return {
        zone, totalQty, totalValue,
        numRacks: rackIds.length,
        numSkus: items.length,
        utilization: parseFloat(utilization.toFixed(1)),
        topBrand: topByKey(items, 'quantity_bottles', 'brand'),
        topCategory: topByKey(items, 'quantity_bottles', 'category'),
      };
    });

    const racks = Object.entries(byRack).map(([rack_id, items]) => {
      const zone = rack_id.charAt(0);
      const totalQty = Utils.sumBy(items, 'quantity_bottles');
      const totalValue = Utils.sumBy(items, 'total_value');
      const bins = [...new Set(items.map(i => i.bin_id))];
      const layoutBins = layoutData ? layoutData.filter(l => l.rack_id === rack_id) : [];
      const capacity = layoutBins.length > 0
        ? layoutBins.reduce((s, l) => s + toNum(l.capacity, 100), 0)
        : bins.length * 100;
      const utilization = capacity > 0 ? Math.min(100, (totalQty / capacity) * 100) : 0;

      return {
        rack_id, zone, totalQty, totalValue,
        numBins: bins.length,
        numSkus: items.length,
        utilization: parseFloat(utilization.toFixed(1)),
        capacity,
      };
    });

    return { zones, racks };
  }

  const BINS_PER_RACK = 10;

  function topByKey(items, valueKey, labelKey) {
    if (!items.length) return null;
    const grouped = Utils.groupBy(items, labelKey);
    let top = null, topVal = 0;
    Object.entries(grouped).forEach(([k, v]) => {
      const val = Utils.sumBy(v, valueKey);
      if (val > topVal) { topVal = val; top = k; }
    });
    return top;
  }

  // ─── Derive Filter Options ────────────────────────────────────────────────

  function deriveFilterOptions(inv, orders, dispatch) {
    const get = (arr, key) => [...new Set(arr.map(r => r[key]).filter(Boolean))].sort();

    return {
      zones: get(inv, 'zone'),
      brands: get(inv, 'brand'),
      suppliers: get(inv, 'supplier'),
      hotels: get(orders, 'hotel_name'),
      categories: get(inv, 'category'),
      bottleSizes: get(inv, 'bottle_size'),
      alcoholTypes: get(inv, 'alcohol_type'),
      skus: inv.map(r => ({ id: r.sku_id, name: r.sku_name })).filter(r => r.id),
      employees: dispatch.map(r => r.picker).filter(Boolean),
      shifts: ['Morning', 'Evening', 'Night'],
    };
  }

  // ─── Main Transform Function ──────────────────────────────────────────────

  function transformAll(rawData) {
    const inventory = cleanInventory(rawData.inventory || []);
    const orders = cleanOrders(rawData.orders || []);
    const dispatch = cleanDispatch(rawData.dispatch || []);

    const { zones, racks } = buildZoneRacks(inventory, rawData.warehouseLayout || []);
    const filterOptions = deriveFilterOptions(inventory, orders, dispatch);

    Store.setProcessedData('inventory', inventory);
    Store.setProcessedData('orders', orders);
    Store.setProcessedData('dispatch', dispatch);
    Store.setProcessedData('zones', zones);
    Store.setProcessedData('racks', racks);
    Store.setFilterOptions(filterOptions);

    return { inventory, orders, dispatch, zones, racks, filterOptions };
  }

  return { transformAll, cleanInventory, cleanOrders, cleanDispatch, buildZoneRacks, deriveFilterOptions };
})();
