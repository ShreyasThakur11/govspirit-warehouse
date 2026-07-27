/**
 * GovSpirit normalisation layer.
 *
 * Everything downstream (KPIs, classification, aging, utilisation,
 * recommendations) reads the canonical shapes produced here, so this is the
 * one place that has to cope with the variety of upstream inputs.
 *
 * Field aliases are resolved explicitly. The previous version read only
 * `unit_price` while one of its own dataset builders wrote `price_per_bottle`,
 * so every unit price silently became zero and the whole valuation chain with
 * it. The same mismatch existed between `capacity` / `capacity_bottles` and
 * `current_qty` / `occupied_bottles` in the layout data.
 */
(function initDataTransformer(GovSpirit) {
  'use strict';

  const { Format, Collections, Store } = GovSpirit.require('Format', 'Collections', 'Store');

  const BINS_PER_RACK = 10;
  const DEFAULT_BIN_CAPACITY = 100;
  const DEFAULT_CASE_SIZE = 12;

  /** First non-empty value among a list of candidate keys. */
  function pick(row, keys, fallback = null) {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
    return fallback;
  }

  const text = (value, fallback = '') =>
    value === null || value === undefined ? fallback : String(value).trim() || fallback;

  const numeric = (value, fallback = 0) => Format.toNumber(value, fallback);

  const bool = (value, fallback = true) => {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return ['yes', 'true', '1', 'y', 'active'].includes(String(value).trim().toLowerCase());
  };

  let idCounter = 0;
  const nextId = (prefix) => {
    idCounter += 1;
    return `${prefix}-${String(idCounter).padStart(6, '0')}`;
  };

  /* ── Inventory ────────────────────────────────────────────────────────── */

  function cleanInventory(rows) {
    const seen = new Set();
    const output = [];

    (rows || []).forEach((row) => {
      const skuId = text(pick(row, ['sku_id', 'sku', 'item_code', 'product_code']));
      // A row with no identifier cannot be reconciled with anything, so it is
      // dropped rather than silently inflating the SKU count.
      if (!skuId) return;

      const quantity = Math.max(
        0,
        numeric(pick(row, ['quantity_bottles', 'quantity', 'qty', 'stock']))
      );
      const unitPrice = Math.max(
        0,
        numeric(pick(row, ['unit_price', 'price_per_bottle', 'price', 'rate', 'mrp']))
      );
      const declaredValue = numeric(pick(row, ['total_value', 'stock_value', 'value']), NaN);
      const totalValue = Number.isFinite(declaredValue) ? declaredValue : quantity * unitPrice;

      const rackId = text(pick(row, ['rack_id', 'rack', 'shelf'])).toUpperCase();
      const zone = text(pick(row, ['zone', 'area', 'section']) || rackId.charAt(0)).toUpperCase();
      // Keep "the file gave us a bin" separate from "we borrowed the rack".
      // The fallback is fine for display, but treating it as a real slot makes
      // every line in a rack look like the same holding.
      const declaredBin = text(pick(row, ['bin_id', 'bin', 'slot'])).toUpperCase();
      const binId = declaredBin || rackId;

      const received = Format.parseDate(pick(row, ['last_received_date', 'received_date', 'date']));
      const dispatched = Format.parseDate(pick(row, ['last_dispatched_date', 'dispatch_date']));

      const declaredAge = pick(row, ['days_in_stock', 'stock_age', 'age']);
      const daysInStock =
        declaredAge !== null
          ? Math.max(0, numeric(declaredAge))
          : Math.max(0, Format.daysBetween(received, null) ?? 0);

      const caseSize = numeric(pick(row, ['case_size']), DEFAULT_CASE_SIZE) || DEFAULT_CASE_SIZE;

      const record = {
        inv_id: text(pick(row, ['inv_id'])) || nextId('INV'),
        sku_id: skuId,
        sku_name: text(pick(row, ['sku_name', 'product_name', 'item_name']), skuId),
        brand: text(pick(row, ['brand', 'brand_name']), 'Unknown'),
        category: text(pick(row, ['category', 'type']), 'Unknown'),
        alcohol_type: text(pick(row, ['alcohol_type', 'category', 'type']), 'Unknown'),
        bottle_size: text(pick(row, ['bottle_size', 'size', 'volume']), 'Unspecified'),
        supplier: text(pick(row, ['supplier', 'vendor']), 'Unknown'),
        zone: zone || 'A',
        rack_id: rackId || `${zone || 'A'}01`,
        bin_id: binId || `${zone || 'A'}01-B01`,
        quantity_bottles: quantity,
        quantity_cases:
          numeric(pick(row, ['quantity_cases', 'cases'])) || Math.floor(quantity / caseSize),
        unit_price: unitPrice,
        total_value: Math.max(0, totalValue),
        last_received_date: received,
        last_dispatched_date: dispatched,
        days_in_stock: daysInStock,
        lot_number: text(pick(row, ['lot_number', 'lot', 'batch', 'batch_number'])),
        expiry_date: Format.parseDate(pick(row, ['expiry_date', 'expiry', 'best_before'])),
        condition: text(pick(row, ['condition', 'quality']), 'Good'),
        is_active: bool(pick(row, ['is_active', 'active']), true) ? 'Yes' : 'No',
      };

      // De-duplicate on SKU + bin: the same product in the same slot twice is a
      // data-entry artefact, not two distinct holdings.
      //
      // Only when the file actually carries a bin. Plenty of depot exports stop
      // at the rack, and against an inferred bin this key collapses to the SKU,
      // so a product held in four places became one line and the other three
      // quantities disappeared from every total on the dashboard.
      if (declaredBin) {
        const key = `${record.sku_id}__${record.bin_id}`;
        if (seen.has(key)) return;
        seen.add(key);
      }
      output.push(record);
    });

    return output;
  }

  /* ── Orders ───────────────────────────────────────────────────────────── */

  function cleanOrders(rows) {
    return (rows || [])
      .map((row) => {
        const ordered = Math.max(
          0,
          numeric(pick(row, ['quantity_ordered', 'qty_ordered', 'quantity', 'qty']))
        );
        const fulfilledRaw = numeric(
          pick(row, ['quantity_fulfilled', 'qty_fulfilled', 'dispatched_qty'])
        );
        // Clamp to the ordered quantity plus a 10% tolerance; anything beyond
        // that is a typo, and letting it through poisons the fill rate.
        const fulfilled = Collections.clamp(Math.max(0, fulfilledRaw), 0, ordered * 1.1);
        const unitPrice = Math.max(0, numeric(pick(row, ['unit_price', 'price', 'rate'])));

        const declaredStatus = text(pick(row, ['status', 'order_status']));
        const status =
          declaredStatus || (fulfilled >= ordered && ordered > 0 ? 'Completed' : 'Pending');

        return {
          order_id: text(pick(row, ['order_id', 'order_no', 'order_number'])) || nextId('ORD'),
          line_id: text(pick(row, ['line_id'])) || nextId('LINE'),
          hotel_name: text(
            pick(row, ['hotel_name', 'hotel', 'customer', 'customer_name', 'outlet'])
          ),
          order_date: Format.parseDate(pick(row, ['order_date', 'date', 'request_date'])),
          delivery_date: Format.parseDate(pick(row, ['delivery_date', 'delivered_date'])),
          sku_id: text(pick(row, ['sku_id', 'sku', 'item_code'])),
          sku_name: text(pick(row, ['sku_name', 'product_name', 'item_name'])),
          brand: text(pick(row, ['brand'])),
          category: text(pick(row, ['category', 'type'])),
          bottle_size: text(pick(row, ['bottle_size', 'size'])),
          quantity_ordered: ordered,
          quantity_fulfilled: fulfilled,
          unit_price: unitPrice,
          order_value: numeric(pick(row, ['order_value']), NaN) || ordered * unitPrice,
          fulfilled_value: numeric(pick(row, ['fulfilled_value']), NaN) || fulfilled * unitPrice,
          status,
          priority: text(pick(row, ['priority']), 'Normal'),
        };
      })
      .filter((row) => row.hotel_name && row.order_date);
  }

  /* ── Dispatch ─────────────────────────────────────────────────────────── */

  function cleanDispatch(rows) {
    return (rows || [])
      .map((row) => ({
        dispatch_id: text(pick(row, ['dispatch_id', 'dispatch_no', 'challan_no'])) || nextId('DIS'),
        order_id: text(pick(row, ['order_id', 'order_no'])),
        dispatch_date: Format.parseDate(pick(row, ['dispatch_date', 'date', 'delivery_date'])),
        hotel_name: text(pick(row, ['hotel_name', 'hotel', 'customer'])),
        sku_id: text(pick(row, ['sku_id', 'sku', 'item_code'])),
        sku_name: text(pick(row, ['sku_name', 'product_name'])),
        brand: text(pick(row, ['brand'])),
        category: text(pick(row, ['category', 'type'])),
        quantity_dispatched: Math.max(
          0,
          numeric(pick(row, ['quantity_dispatched', 'qty_dispatched', 'quantity', 'qty']))
        ),
        dispatch_value: Math.max(0, numeric(pick(row, ['dispatch_value', 'value']))),
        vehicle: text(pick(row, ['vehicle', 'vehicle_no', 'truck'])),
        driver: text(pick(row, ['driver', 'driver_name'])),
        picker: text(pick(row, ['picker', 'picked_by'])),
        dispatch_time_minutes: numeric(
          pick(row, ['dispatch_time_minutes', 'time_taken', 'lead_time']),
          30
        ),
        status: text(pick(row, ['status']), 'Delivered'),
      }))
      .filter((row) => row.dispatch_date && row.quantity_dispatched > 0);
  }

  /* ── Zone and rack aggregation ────────────────────────────────────────── */

  /** Normalise a layout row's capacity and occupancy across naming variants. */
  function layoutCapacity(row) {
    return Math.max(
      0,
      numeric(
        pick(row, ['capacity', 'capacity_bottles', 'max_capacity', 'bin_capacity']),
        DEFAULT_BIN_CAPACITY
      )
    );
  }

  function layoutOccupancy(row) {
    return Math.max(
      0,
      numeric(pick(row, ['current_qty', 'occupied_bottles', 'occupied', 'quantity']))
    );
  }

  /**
   * Build zone and rack rollups.
   *
   * When a real layout file is supplied, capacity comes from it. Otherwise it
   * is estimated from the number of distinct racks and bins actually observed
   * in the inventory, and the estimate is flagged so the UI can say so rather
   * than presenting a guess as a measurement.
   */
  function buildZoneRacks(inventory, layout) {
    const hasLayout = Array.isArray(layout) && layout.length > 0;

    const layoutByZone = hasLayout
      ? Collections.groupBy(layout, (row) => text(row.zone).toUpperCase())
      : {};
    const layoutByRack = hasLayout
      ? Collections.groupBy(layout, (row) => text(pick(row, ['rack_id', 'rack'])).toUpperCase())
      : {};

    const inventoryByZone = Collections.groupBy(inventory, 'zone');
    const inventoryByRack = Collections.groupBy(inventory, 'rack_id');

    const zones = Object.entries(inventoryByZone).map(([zone, items]) => {
      const totalQty = Collections.sumBy(items, 'quantity_bottles');
      const rackIds = [...new Set(items.map((i) => i.rack_id))];

      const zoneLayout = layoutByZone[zone] || [];
      const capacity = zoneLayout.length
        ? zoneLayout.reduce((sum, row) => sum + layoutCapacity(row), 0)
        : rackIds.length * BINS_PER_RACK * DEFAULT_BIN_CAPACITY;

      return {
        zone,
        totalQty,
        totalValue: Collections.sumBy(items, 'total_value'),
        numRacks: rackIds.length,
        numSkus: Collections.countDistinct(items, 'sku_id'),
        capacity,
        capacityEstimated: zoneLayout.length === 0,
        utilization: Collections.roundTo(
          Math.min(100, Collections.percentageOf(totalQty, capacity)),
          1
        ),
        topBrand: Collections.topGroup(items, 'brand', 'quantity_bottles'),
        topCategory: Collections.topGroup(items, 'category', 'quantity_bottles'),
      };
    });

    const racks = Object.entries(inventoryByRack).map(([rackId, items]) => {
      const totalQty = Collections.sumBy(items, 'quantity_bottles');
      const bins = [...new Set(items.map((i) => i.bin_id))];

      const rackLayout = layoutByRack[rackId] || [];
      const capacity = rackLayout.length
        ? rackLayout.reduce((sum, row) => sum + layoutCapacity(row), 0)
        : bins.length * DEFAULT_BIN_CAPACITY;

      return {
        rack_id: rackId,
        zone: items[0]?.zone || rackId.charAt(0),
        totalQty,
        totalValue: Collections.sumBy(items, 'total_value'),
        numBins: bins.length,
        numSkus: Collections.countDistinct(items, 'sku_id'),
        capacity,
        capacityEstimated: rackLayout.length === 0,
        utilization: Collections.roundTo(
          Math.min(100, Collections.percentageOf(totalQty, capacity)),
          1
        ),
      };
    });

    return {
      zones: Collections.sortBy(zones, 'zone', 'asc'),
      racks: Collections.sortBy(racks, 'rack_id', 'asc'),
      layoutOccupancyTotal: hasLayout
        ? layout.reduce((sum, row) => sum + layoutOccupancy(row), 0)
        : null,
      layoutCapacityTotal: hasLayout
        ? layout.reduce((sum, row) => sum + layoutCapacity(row), 0)
        : null,
      layoutBinCount: hasLayout ? layout.length : null,
      layoutBlockedBins: hasLayout
        ? layout.filter((row) => bool(pick(row, ['is_blocked', 'blocked']), false)).length
        : 0,
    };
  }

  /* ── Filter options ───────────────────────────────────────────────────── */

  /**
   * Options are plain sorted strings. The previous implementation emitted
   * objects for SKUs and a duplicate-laden array for employees, which rendered
   * as "[object Object]" the moment either was shown in a select.
   */
  function deriveFilterOptions(inventory, orders) {
    return {
      zones: Collections.distinctValues(inventory, 'zone'),
      brands: Collections.distinctValues(inventory, 'brand'),
      suppliers: Collections.distinctValues(inventory, 'supplier'),
      categories: Collections.distinctValues(inventory, 'category'),
      bottleSizes: Collections.distinctValues(inventory, 'bottle_size'),
      alcoholTypes: Collections.distinctValues(inventory, 'alcohol_type'),
      skus: Collections.distinctValues(inventory, 'sku_id'),
      hotels: Collections.distinctValues(orders, 'hotel_name'),
    };
  }

  /* ── Entry point ──────────────────────────────────────────────────────── */

  function transformAll(rawData) {
    const inventory = cleanInventory(rawData?.inventory);
    const orders = cleanOrders(rawData?.orders);
    const dispatch = cleanDispatch(rawData?.dispatch);

    const layoutRollup = buildZoneRacks(inventory, rawData?.warehouseLayout);
    const filterOptions = deriveFilterOptions(inventory, orders);

    Store.setProcessedData('inventory', inventory);
    Store.setProcessedData('orders', orders);
    Store.setProcessedData('dispatch', dispatch);
    Store.setProcessedData('zones', layoutRollup.zones);
    Store.setProcessedData('racks', layoutRollup.racks);
    Store.setFilterOptions(filterOptions);

    return { inventory, orders, dispatch, ...layoutRollup, filterOptions };
  }

  GovSpirit.DataTransformer = {
    transformAll,
    cleanInventory,
    cleanOrders,
    cleanDispatch,
    buildZoneRacks,
    deriveFilterOptions,
  };
})(window.GovSpirit);
