/**
 * GovSpirit Demo Data Generator
 * Generates realistic government alcohol warehouse data
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.DemoData = (function () {

  // ─── Reference Data ───────────────────────────────────────────────────────

  const BRANDS = [
    { name: 'Royal Stag', supplier: 'Pernod Ricard India Ltd', category: 'Whisky', alcohol_type: 'Indian Whisky' },
    { name: "Blenders Pride", supplier: 'Pernod Ricard India Ltd', category: 'Whisky', alcohol_type: 'Indian Whisky' },
    { name: "Imperial Blue", supplier: 'Pernod Ricard India Ltd', category: 'Whisky', alcohol_type: 'Indian Whisky' },
    { name: "Royal Challenge", supplier: 'United Spirits Ltd', category: 'Whisky', alcohol_type: 'Indian Whisky' },
    { name: "McDowell's No.1", supplier: 'United Spirits Ltd', category: 'Whisky', alcohol_type: 'Indian Whisky' },
    { name: "Signature Rare", supplier: 'United Spirits Ltd', category: 'Whisky', alcohol_type: 'Indian Whisky' },
    { name: "Black & White", supplier: 'Diageo India Pvt Ltd', category: 'Whisky', alcohol_type: 'Scotch Whisky' },
    { name: "Black Label", supplier: 'Diageo India Pvt Ltd', category: 'Whisky', alcohol_type: 'Scotch Whisky' },
    { name: "Teacher's Highland", supplier: 'Beam Suntory India', category: 'Whisky', alcohol_type: 'Scotch Whisky' },
    { name: "Jack Daniel's", supplier: 'Brown-Forman India', category: 'Whisky', alcohol_type: 'American Whisky' },
    { name: "Absolut Vodka", supplier: 'Pernod Ricard India Ltd', category: 'Vodka', alcohol_type: 'Vodka' },
    { name: "Smirnoff", supplier: 'Diageo India Pvt Ltd', category: 'Vodka', alcohol_type: 'Vodka' },
    { name: "Magic Moments", supplier: 'Radico Khaitan Ltd', category: 'Vodka', alcohol_type: 'Vodka' },
    { name: "Bacardi White", supplier: 'Bacardi India Pvt Ltd', category: 'Rum', alcohol_type: 'Rum' },
    { name: "Old Monk Dark", supplier: 'Mohan Meakins Ltd', category: 'Rum', alcohol_type: 'Rum' },
    { name: "McDowell's Rum", supplier: 'United Spirits Ltd', category: 'Rum', alcohol_type: 'Rum' },
    { name: "Beefeater Gin", supplier: 'Pernod Ricard India Ltd', category: 'Gin', alcohol_type: 'Gin' },
    { name: "Bombay Sapphire", supplier: 'Bacardi India Pvt Ltd', category: 'Gin', alcohol_type: 'Gin' },
    { name: "Kingfisher Premium", supplier: 'United Breweries Ltd', category: 'Beer', alcohol_type: 'Beer' },
    { name: "Bira 91 White", supplier: 'B9 Beverages Pvt Ltd', category: 'Beer', alcohol_type: 'Beer' },
    { name: "Heineken", supplier: 'United Breweries Ltd', category: 'Beer', alcohol_type: 'Beer' },
    { name: "Corona Extra", supplier: 'AB InBev India Pvt Ltd', category: 'Beer', alcohol_type: 'Beer' },
    { name: "Sula Sauvignon Blanc", supplier: 'Sula Vineyards Ltd', category: 'Wine', alcohol_type: 'White Wine' },
    { name: "Sula Shiraz", supplier: 'Sula Vineyards Ltd', category: 'Wine', alcohol_type: 'Red Wine' },
    { name: "Grover Zampa", supplier: 'Grover Zampa Vineyards', category: 'Wine', alcohol_type: 'Red Wine' },
  ];

  const BOTTLE_SIZES = ['180ml', '375ml', '750ml', '1000ml', '1750ml'];
  const SIZE_CASE_QTY = { '180ml': 48, '375ml': 24, '750ml': 12, '1000ml': 12, '1750ml': 6 };
  const SIZE_PRICE_MULT = { '180ml': 1, '375ml': 2, '750ml': 3.5, '1000ml': 4.5, '1750ml': 7 };

  const BASE_PRICES = {
    'Indian Whisky': 280, 'Scotch Whisky': 1200, 'American Whisky': 900,
    'Vodka': 350, 'Rum': 250, 'Gin': 500, 'Beer': 80, 'White Wine': 600, 'Red Wine': 700,
  };

  const ZONES = ['A', 'B', 'C', 'D', 'E', 'F'];
  const RACKS_PER_ZONE = 8;
  const BINS_PER_RACK = 10;

  const HOTELS = [
    'The Grand Hyatt', 'Leela Palace', 'ITC Maurya', 'Taj Mahal Hotel',
    'Hilton Garden Inn', 'Marriott Suites', 'Radisson Blu', 'Holiday Inn Express',
    'Sheraton Grand', 'JW Marriott', 'The Oberoi', 'Four Seasons',
    'Novotel', 'DoubleTree Hilton', 'Crown Plaza', 'Park Hyatt',
    'InterContinental', 'Best Western', 'Lalit Grand', 'Eros Hotel',
    'Hotel Janpath', 'The Ashok', 'Vivanta by Taj', 'Lemon Tree Hotels',
    'Fortune Select', 'The Imperial', 'Hyatt Regency', 'Shangri-La',
    'Conrad Hotels', 'W Hotels'
  ];

  const EMPLOYEES = [
    { name: 'Ramesh Kumar', role: 'Picker', shift: 'Morning' },
    { name: 'Suresh Singh', role: 'Picker', shift: 'Morning' },
    { name: 'Mahesh Verma', role: 'Picker', shift: 'Evening' },
    { name: 'Dinesh Yadav', role: 'Picker', shift: 'Evening' },
    { name: 'Priya Sharma', role: 'Packer', shift: 'Morning' },
    { name: 'Anita Gupta', role: 'Packer', shift: 'Evening' },
    { name: 'Rajesh Chauhan', role: 'Receiver', shift: 'Morning' },
    { name: 'Vijay Mishra', role: 'Receiver', shift: 'Morning' },
    { name: 'Arun Patel', role: 'Supervisor', shift: 'Morning' },
    { name: 'Mohan Lal', role: 'Supervisor', shift: 'Evening' },
    { name: 'Deepak Joshi', role: 'Driver', shift: 'Morning' },
    { name: 'Ravi Tiwari', role: 'Driver', shift: 'Evening' },
  ];

  const VEHICLES = ['UP-01-GH-4521', 'UP-01-GH-4522', 'DL-01-AB-7890', 'DL-01-AB-7891', 'HR-01-CD-1234'];

  // ─── Random Helpers ───────────────────────────────────────────────────────

  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function rndFloat(min, max, dp = 2) { return parseFloat((Math.random() * (max - min) + min).toFixed(dp)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function dateOffset(base, days) {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const TODAY = new Date();
  const todayStr = TODAY.toISOString().slice(0, 10);

  // ─── SKU Master Generator ─────────────────────────────────────────────────

  function generateSKUMaster() {
    const skus = [];
    let id = 1000;
    BRANDS.forEach(brand => {
      const sizes = brand.category === 'Beer'
        ? ['330ml', '650ml']
        : brand.category === 'Wine'
        ? ['750ml', '375ml']
        : BOTTLE_SIZES;

      sizes.forEach(size => {
        const basePrice = BASE_PRICES[brand.alcohol_type] || 300;
        const mult = SIZE_PRICE_MULT[size] || 3.5;
        const unitPrice = parseFloat((basePrice * mult * rndFloat(0.85, 1.15)).toFixed(2));
        const isActive = Math.random() > 0.05; // 95% active
        skus.push({
          sku_id: `SKU${String(id++).padStart(4, '0')}`,
          sku_name: `${brand.name} ${size}`,
          brand: brand.name,
          category: brand.category,
          alcohol_type: brand.alcohol_type,
          bottle_size: size,
          case_size: SIZE_CASE_QTY[size] || 12,
          supplier: brand.supplier,
          unit_price: unitPrice,
          mrp: parseFloat((unitPrice * 1.3).toFixed(2)),
          is_active: isActive ? 'Yes' : 'No',
          hsn_code: `22030${rnd(10, 99)}`,
        });
      });
    });
    return skus;
  }

  // ─── Warehouse Layout Generator ───────────────────────────────────────────

  function generateWarehouseLayout() {
    const layout = [];
    const zoneCapacity = { A: 500, B: 450, C: 400, D: 350, E: 300, F: 250 };
    ZONES.forEach(zone => {
      for (let r = 1; r <= RACKS_PER_ZONE; r++) {
        const rackId = `${zone}${String(r).padStart(2, '0')}`;
        for (let b = 1; b <= BINS_PER_RACK; b++) {
          const binId = `${rackId}-B${String(b).padStart(2, '0')}`;
          const capacity = rnd(80, 120);
          const isBlocked = Math.random() < 0.03;
          layout.push({
            zone,
            rack_id: rackId,
            bin_id: binId,
            bin_number: b,
            capacity,
            current_qty: 0, // will be filled from inventory
            is_blocked: isBlocked ? 'Yes' : 'No',
            rack_type: zone <= 'B' ? 'Drive-in' : zone <= 'D' ? 'Selective' : 'Cantilever',
          });
        }
      }
    });
    return layout;
  }

  // ─── Inventory Generator ──────────────────────────────────────────────────

  function generateInventory(skus, layout) {
    const inventory = [];
    // Select ~85% of SKUs to have stock
    const activeSkus = skus.filter(s => s.is_active === 'Yes' && Math.random() > 0.15);

    // Create demand weights (some SKUs move fast)
    const demandWeights = {};
    activeSkus.forEach(s => {
      // Whisky and Beer move faster
      const categoryMult = ['Whisky', 'Beer', 'Rum'].includes(s.category) ? rndFloat(1.5, 3.0) : rndFloat(0.5, 1.5);
      // Smaller sizes move faster
      const sizeMult = ['180ml', '330ml', '375ml'].includes(s.bottle_size) ? rndFloat(1.5, 2.5) : 1.0;
      demandWeights[s.sku_id] = categoryMult * sizeMult;
    });

    const layoutBins = [...layout].filter(b => b.is_blocked !== 'Yes');
    let binIndex = 0;

    activeSkus.forEach(sku => {
      if (binIndex >= layoutBins.length) return;
      const bin = layoutBins[binIndex++];
      const demandW = demandWeights[sku.sku_id] || 1;
      const qty = Math.round(rnd(10, 80) * demandW);
      const daysInStock = rnd(1, 120);
      const lastReceived = dateOffset(todayStr, -daysInStock);
      const lastDispatched = Math.random() > 0.2 ? dateOffset(todayStr, -rnd(1, daysInStock)) : null;

      inventory.push({
        inv_id: `INV${String(binIndex).padStart(5, '0')}`,
        sku_id: sku.sku_id,
        sku_name: sku.sku_name,
        brand: sku.brand,
        category: sku.category,
        alcohol_type: sku.alcohol_type,
        bottle_size: sku.bottle_size,
        supplier: sku.supplier,
        zone: bin.zone,
        rack_id: bin.rack_id,
        bin_id: bin.bin_id,
        quantity_bottles: qty,
        quantity_cases: Math.floor(qty / (sku.case_size || 12)),
        unit_price: sku.unit_price,
        total_value: parseFloat((qty * sku.unit_price).toFixed(2)),
        last_received_date: lastReceived,
        last_dispatched_date: lastDispatched,
        days_in_stock: daysInStock,
        lot_number: `LOT${rnd(10000, 99999)}`,
        batch_number: `BATCH${rnd(1000, 9999)}`,
        expiry_date: dateOffset(todayStr, rnd(365, 1095)),
        condition: Math.random() > 0.05 ? 'Good' : 'Damaged',
        is_active: 'Yes',
      });
      // Update layout bin
      bin.current_qty = qty;
    });
    return inventory;
  }

  // ─── Orders Generator ─────────────────────────────────────────────────────

  function generateOrders(skus, daysBack = 90) {
    const orders = [];
    let orderId = 5000;
    let lineId = 1;

    // Hotel order frequency weights
    const hotelWeights = HOTELS.map((h, i) => ({ hotel: h, weight: Math.pow(0.85, i) }));
    const totalWeight = hotelWeights.reduce((s, h) => s + h.weight, 0);

    for (let d = daysBack; d >= 0; d--) {
      const orderDate = dateOffset(todayStr, -d);
      const numOrders = rnd(3, 12);

      for (let o = 0; o < numOrders; o++) {
        // Pick hotel by weight
        let r = Math.random() * totalWeight, hotel = HOTELS[0];
        for (const hw of hotelWeights) { r -= hw.weight; if (r <= 0) { hotel = hw.hotel; break; } }

        const orderIdStr = `ORD${String(orderId++).padStart(5, '0')}`;
        const numLines = rnd(1, 6);
        const selectedSkus = skus.filter(s => s.is_active === 'Yes')
          .sort(() => Math.random() - 0.5).slice(0, numLines);

        let orderStatus = 'Completed';
        if (d === 0) orderStatus = Math.random() > 0.4 ? 'Pending' : 'Processing';
        else if (d === 1) orderStatus = Math.random() > 0.2 ? 'Completed' : 'Pending';

        selectedSkus.forEach(sku => {
          const qtyOrdered = rnd(5, 50);
          const fulfillPct = orderStatus === 'Completed' ? rndFloat(0.85, 1.0) : rndFloat(0, 0.5);
          const qtyFulfilled = Math.floor(qtyOrdered * fulfillPct);

          orders.push({
            order_id: orderIdStr,
            line_id: `LINE${String(lineId++).padStart(6, '0')}`,
            hotel_name: hotel,
            order_date: orderDate,
            delivery_date: orderStatus === 'Completed' ? dateOffset(orderDate, rnd(0, 2)) : null,
            sku_id: sku.sku_id,
            sku_name: sku.sku_name,
            brand: sku.brand,
            category: sku.category,
            bottle_size: sku.bottle_size,
            quantity_ordered: qtyOrdered,
            quantity_fulfilled: qtyFulfilled,
            unit_price: sku.unit_price,
            order_value: parseFloat((qtyOrdered * sku.unit_price).toFixed(2)),
            fulfilled_value: parseFloat((qtyFulfilled * sku.unit_price).toFixed(2)),
            status: orderStatus,
            priority: Math.random() > 0.85 ? 'High' : 'Normal',
          });
        });
      }
    }
    return orders;
  }

  // ─── Dispatch Generator ───────────────────────────────────────────────────

  function generateDispatch(orders) {
    return orders
      .filter(o => o.status === 'Completed' && o.quantity_fulfilled > 0)
      .map((o, i) => ({
        dispatch_id: `DIS${String(i + 1000).padStart(5, '0')}`,
        order_id: o.order_id,
        dispatch_date: o.delivery_date || o.order_date,
        hotel_name: o.hotel_name,
        sku_id: o.sku_id,
        sku_name: o.sku_name,
        brand: o.brand,
        category: o.category,
        quantity_dispatched: o.quantity_fulfilled,
        dispatch_value: o.fulfilled_value,
        vehicle: pick(VEHICLES),
        driver: pick(EMPLOYEES.filter(e => e.role === 'Driver')).name,
        picker: pick(EMPLOYEES.filter(e => e.role === 'Picker')).name,
        dispatch_time_minutes: rnd(15, 90),
        status: 'Delivered',
      }));
  }

  // ─── Goods Receipt Generator ──────────────────────────────────────────────

  function generateGoodsReceipt(skus, inventory) {
    const receipts = [];
    let rcptId = 3000;
    inventory.slice(0, Math.min(inventory.length, 200)).forEach(inv => {
      const sku = skus.find(s => s.sku_id === inv.sku_id);
      if (!sku) return;
      const qtyReceived = inv.quantity_bottles + rnd(0, 30);
      receipts.push({
        receipt_id: `GR${String(rcptId++).padStart(5, '0')}`,
        receipt_date: inv.last_received_date,
        supplier: inv.supplier,
        sku_id: inv.sku_id,
        sku_name: inv.sku_name,
        brand: inv.brand,
        quantity_received: qtyReceived,
        quantity_cases: Math.floor(qtyReceived / (sku.case_size || 12)),
        zone: inv.zone,
        rack_id: inv.rack_id,
        bin_id: inv.bin_id,
        lot_number: inv.lot_number,
        condition: qtyReceived > 0 && Math.random() > 0.08 ? 'Good' : 'Partially Damaged',
        received_by: pick(EMPLOYEES.filter(e => e.role === 'Receiver')).name,
        vehicle: pick(VEHICLES),
        po_number: `PO${rnd(10000, 99999)}`,
      });
    });
    return receipts;
  }

  // ─── Stock Movement Generator ─────────────────────────────────────────────

  function generateStockMovement(inventory) {
    const movements = [];
    let mvtId = 7000;
    inventory.slice(0, 80).forEach(inv => {
      const numMoves = rnd(1, 4);
      for (let i = 0; i < numMoves; i++) {
        const fromZone = pick(ZONES);
        const toZone = pick(ZONES);
        movements.push({
          movement_id: `MV${String(mvtId++).padStart(5, '0')}`,
          movement_date: dateOffset(todayStr, -rnd(1, 90)),
          sku_id: inv.sku_id,
          sku_name: inv.sku_name,
          brand: inv.brand,
          from_zone: fromZone,
          from_rack: `${fromZone}${String(rnd(1, 8)).padStart(2, '0')}`,
          to_zone: toZone,
          to_rack: `${toZone}${String(rnd(1, 8)).padStart(2, '0')}`,
          quantity: rnd(5, 30),
          reason: pick(['Rebalancing', 'Consolidation', 'Fast-mover relocation', 'Damage check', 'Cycle count adjustment']),
          employee: pick(EMPLOYEES).name,
        });
      }
    });
    return movements;
  }

  // ─── Employee Data Generator ──────────────────────────────────────────────

  function generateEmployeeData(dispatch) {
    return EMPLOYEES.map((emp, i) => {
      const empDispatch = dispatch.filter(d => d.picker === emp.name || d.driver === emp.name);
      const picksToday = rnd(20, 80);
      const ordersCompleted = empDispatch.length;
      return {
        employee_id: `EMP${String(i + 1).padStart(3, '0')}`,
        employee_name: emp.name,
        role: emp.role,
        shift: emp.shift,
        picks_today: picksToday,
        picks_per_hour: rndFloat(8, 25),
        orders_completed: ordersCompleted,
        accuracy_rate: rndFloat(95, 99.9),
        avg_pick_time_min: rndFloat(2, 8),
        attendance_days: rnd(20, 26),
        performance_score: rndFloat(70, 98),
      };
    });
  }

  // ─── Damage Register Generator ────────────────────────────────────────────

  function generateDamageRegister(inventory) {
    const damages = [];
    inventory.filter(() => Math.random() < 0.08).slice(0, 30).forEach((inv, i) => {
      damages.push({
        damage_id: `DMG${String(i + 100).padStart(4, '0')}`,
        damage_date: dateOffset(todayStr, -rnd(1, 60)),
        sku_id: inv.sku_id,
        sku_name: inv.sku_name,
        brand: inv.brand,
        zone: inv.zone,
        rack_id: inv.rack_id,
        quantity_damaged: rnd(1, 10),
        damage_value: parseFloat((rnd(1, 10) * inv.unit_price).toFixed(2)),
        cause: pick(['Forklift accident', 'Broken glass', 'Leakage', 'Expiry', 'Handling error', 'Water damage']),
        reported_by: pick(EMPLOYEES).name,
        status: pick(['Reported', 'Under Review', 'Written Off', 'Replaced']),
      });
    });
    return damages;
  }

  // ─── Cycle Count Generator ────────────────────────────────────────────────

  function generateCycleCount(inventory) {
    return inventory.slice(0, 100).map((inv, i) => {
      const variance = rnd(-5, 5);
      return {
        count_id: `CC${String(i + 100).padStart(4, '0')}`,
        count_date: dateOffset(todayStr, -rnd(1, 30)),
        sku_id: inv.sku_id,
        sku_name: inv.sku_name,
        zone: inv.zone,
        rack_id: inv.rack_id,
        bin_id: inv.bin_id,
        system_qty: inv.quantity_bottles,
        physical_qty: inv.quantity_bottles + variance,
        variance,
        variance_value: parseFloat(Math.abs(variance * inv.unit_price).toFixed(2)),
        counted_by: pick(EMPLOYEES).name,
        status: Math.abs(variance) <= 2 ? 'Matched' : 'Variance',
      };
    });
  }

  // ─── Returns Generator ────────────────────────────────────────────────────

  function generateReturns(orders) {
    const returns = [];
    orders.filter(o => o.status === 'Completed' && Math.random() < 0.04).slice(0, 20).forEach((o, i) => {
      returns.push({
        return_id: `RET${String(i + 100).padStart(4, '0')}`,
        return_date: dateOffset(o.delivery_date || o.order_date, rnd(1, 5)),
        order_id: o.order_id,
        hotel_name: o.hotel_name,
        sku_id: o.sku_id,
        sku_name: o.sku_name,
        brand: o.brand,
        quantity_returned: rnd(1, Math.max(1, Math.floor(o.quantity_fulfilled * 0.2))),
        return_value: 0,
        reason: pick(['Wrong SKU dispatched', 'Damaged on delivery', 'Overshipped', 'Order cancelled']),
        status: pick(['Received', 'Restocked', 'Written Off']),
      });
      returns[returns.length - 1].return_value = parseFloat((returns[returns.length - 1].quantity_returned * o.unit_price).toFixed(2));
    });
    return returns;
  }

  // ─── Main Generate Function ───────────────────────────────────────────────

  function generate() {
    console.log('[DemoData] Generating realistic warehouse dataset...');

    const skuMaster = generateSKUMaster();
    const warehouseLayout = generateWarehouseLayout();
    const inventory = generateInventory(skuMaster, warehouseLayout);
    const orders = generateOrders(skuMaster, 90);
    const dispatch = generateDispatch(orders);
    const goodsReceipt = generateGoodsReceipt(skuMaster, inventory);
    const stockMovement = generateStockMovement(inventory);
    const employees = generateEmployeeData(dispatch);
    const damage = generateDamageRegister(inventory);
    const cycleCount = generateCycleCount(inventory);
    const returns = generateReturns(orders);

    // Build supplier table from brand data
    const suppliers = [...new Set(BRANDS.map(b => b.supplier))].map((sup, i) => {
      const supplierBrands = BRANDS.filter(b => b.supplier === sup);
      return {
        supplier_id: `SUP${String(i + 1).padStart(3, '0')}`,
        supplier_name: sup,
        contact_person: pick(['Amit Shah', 'Priya Nair', 'Rahul Mehta', 'Sunita Reddy', 'Vijay Kumar']),
        phone: `+91 ${rnd(70000, 99999)} ${rnd(10000, 99999)}`,
        brands_supplied: supplierBrands.map(b => b.name).join(', '),
        num_brands: supplierBrands.length,
        total_receipts: goodsReceipt.filter(r => r.supplier === sup).length,
        reliability_score: rndFloat(80, 99),
        avg_lead_days: rnd(2, 10),
        last_supply_date: dateOffset(todayStr, -rnd(1, 30)),
      };
    });

    console.log(`[DemoData] Generated: ${skuMaster.length} SKUs, ${inventory.length} inventory rows, ${orders.length} order lines, ${dispatch.length} dispatches`);

    return {
      inventory,
      skuMaster,
      orders,
      dispatch,
      warehouseLayout,
      goodsReceipt,
      stockMovement,
      suppliers,
      employees,
      damage,
      cycleCount,
      returns,
    };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  function loadDemoData() {
    const data = generate();
    const Store = GovSpirit.Store;
    Object.entries(data).forEach(([key, val]) => Store.setRawData(key, val));
    return data;
  }

  return { generate, loadDemoData, BRANDS, ZONES, HOTELS, EMPLOYEES };
})();
