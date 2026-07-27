/**
 * GovSpirit demo dataset generator.
 *
 * Produces a coherent, cross-referenced warehouse: SKUs feed inventory,
 * inventory occupies real bins from the layout, orders draw on those SKUs,
 * dispatches derive from fulfilled orders, and receipts, damage, counts and
 * returns all reference rows that actually exist.
 *
 * Randomness is seeded. The previous generator used bare `Math.random()`, so
 * every reload produced different numbers, which made screenshots
 * inconsistent, bug reports unreproducible, and "did my change break the
 * KPIs?" impossible to answer. Pass a different `seed` to vary it.
 */
(function initDemoData(GovSpirit) {
  'use strict';

  const { Format } = GovSpirit.require('Format');

  const DEFAULT_SEED = 20260726;

  /** mulberry32: small, fast, adequate for synthetic data. */
  function createRandom(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const BRANDS = [
    {
      name: 'Royal Stag',
      supplier: 'Pernod Ricard India Ltd',
      category: 'Whisky',
      alcoholType: 'Indian Whisky',
    },
    {
      name: 'Blenders Pride',
      supplier: 'Pernod Ricard India Ltd',
      category: 'Whisky',
      alcoholType: 'Indian Whisky',
    },
    {
      name: 'Imperial Blue',
      supplier: 'Pernod Ricard India Ltd',
      category: 'Whisky',
      alcoholType: 'Indian Whisky',
    },
    {
      name: 'Royal Challenge',
      supplier: 'United Spirits Ltd',
      category: 'Whisky',
      alcoholType: 'Indian Whisky',
    },
    {
      name: "McDowell's No.1",
      supplier: 'United Spirits Ltd',
      category: 'Whisky',
      alcoholType: 'Indian Whisky',
    },
    {
      name: 'Signature Rare',
      supplier: 'United Spirits Ltd',
      category: 'Whisky',
      alcoholType: 'Indian Whisky',
    },
    {
      name: 'Black & White',
      supplier: 'Diageo India Pvt Ltd',
      category: 'Whisky',
      alcoholType: 'Scotch Whisky',
    },
    {
      name: 'Black Label',
      supplier: 'Diageo India Pvt Ltd',
      category: 'Whisky',
      alcoholType: 'Scotch Whisky',
    },
    {
      name: "Teacher's Highland",
      supplier: 'Beam Suntory India',
      category: 'Whisky',
      alcoholType: 'Scotch Whisky',
    },
    {
      name: "Jack Daniel's",
      supplier: 'Brown-Forman India',
      category: 'Whisky',
      alcoholType: 'American Whisky',
    },
    {
      name: 'Absolut Vodka',
      supplier: 'Pernod Ricard India Ltd',
      category: 'Vodka',
      alcoholType: 'Vodka',
    },
    { name: 'Smirnoff', supplier: 'Diageo India Pvt Ltd', category: 'Vodka', alcoholType: 'Vodka' },
    {
      name: 'Magic Moments',
      supplier: 'Radico Khaitan Ltd',
      category: 'Vodka',
      alcoholType: 'Vodka',
    },
    {
      name: 'Bacardi White',
      supplier: 'Bacardi India Pvt Ltd',
      category: 'Rum',
      alcoholType: 'Rum',
    },
    { name: 'Old Monk Dark', supplier: 'Mohan Meakins Ltd', category: 'Rum', alcoholType: 'Rum' },
    { name: "McDowell's Rum", supplier: 'United Spirits Ltd', category: 'Rum', alcoholType: 'Rum' },
    {
      name: 'Beefeater Gin',
      supplier: 'Pernod Ricard India Ltd',
      category: 'Gin',
      alcoholType: 'Gin',
    },
    {
      name: 'Bombay Sapphire',
      supplier: 'Bacardi India Pvt Ltd',
      category: 'Gin',
      alcoholType: 'Gin',
    },
    {
      name: 'Kingfisher Premium',
      supplier: 'United Breweries Ltd',
      category: 'Beer',
      alcoholType: 'Beer',
    },
    {
      name: 'Bira 91 White',
      supplier: 'B9 Beverages Pvt Ltd',
      category: 'Beer',
      alcoholType: 'Beer',
    },
    { name: 'Heineken', supplier: 'United Breweries Ltd', category: 'Beer', alcoholType: 'Beer' },
    {
      name: 'Corona Extra',
      supplier: 'AB InBev India Pvt Ltd',
      category: 'Beer',
      alcoholType: 'Beer',
    },
    {
      name: 'Sula Sauvignon Blanc',
      supplier: 'Sula Vineyards Ltd',
      category: 'Wine',
      alcoholType: 'White Wine',
    },
    {
      name: 'Sula Shiraz',
      supplier: 'Sula Vineyards Ltd',
      category: 'Wine',
      alcoholType: 'Red Wine',
    },
    {
      name: 'Grover Zampa',
      supplier: 'Grover Zampa Vineyards',
      category: 'Wine',
      alcoholType: 'Red Wine',
    },
  ];

  const SPIRIT_SIZES = ['180ml', '375ml', '750ml', '1000ml', '1750ml'];
  const CASE_QTY = {
    '180ml': 48,
    '330ml': 24,
    '375ml': 24,
    '650ml': 12,
    '750ml': 12,
    '1000ml': 12,
    '1750ml': 6,
  };
  const PRICE_MULTIPLIER = {
    '180ml': 1,
    '330ml': 0.9,
    '375ml': 2,
    '650ml': 1.4,
    '750ml': 3.5,
    '1000ml': 4.5,
    '1750ml': 7,
  };
  const BASE_PRICE = {
    'Indian Whisky': 280,
    'Scotch Whisky': 1200,
    'American Whisky': 900,
    Vodka: 350,
    Rum: 250,
    Gin: 500,
    Beer: 80,
    'White Wine': 600,
    'Red Wine': 700,
  };

  const ZONES = ['A', 'B', 'C', 'D', 'E', 'F'];
  const RACKS_PER_ZONE = 8;
  const BINS_PER_RACK = 10;

  const HOTELS = [
    'The Grand Hyatt',
    'Leela Palace',
    'ITC Maurya',
    'Taj Mahal Hotel',
    'Hilton Garden Inn',
    'Marriott Suites',
    'Radisson Blu',
    'Holiday Inn Express',
    'Sheraton Grand',
    'JW Marriott',
    'The Oberoi',
    'Four Seasons',
    'Novotel',
    'DoubleTree Hilton',
    'Crown Plaza',
    'Park Hyatt',
    'InterContinental',
    'Best Western',
    'Lalit Grand',
    'Eros Hotel',
    'Hotel Janpath',
    'The Ashok',
    'Vivanta by Taj',
    'Lemon Tree Hotels',
    'Fortune Select',
    'The Imperial',
    'Hyatt Regency',
    'Shangri-La',
    'Conrad Hotels',
    'W Hotels',
  ];

  const STAFF = [
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

  const VEHICLES = [
    'UP-01-GH-4521',
    'UP-01-GH-4522',
    'DL-01-AB-7890',
    'DL-01-AB-7891',
    'HR-01-CD-1234',
  ];
  const DAMAGE_CAUSES = [
    'Forklift impact',
    'Broken glass',
    'Leakage',
    'Expiry',
    'Handling error',
    'Water damage',
  ];
  const MOVE_REASONS = [
    'Rebalancing',
    'Consolidation',
    'Fast-mover relocation',
    'Damage check',
    'Cycle-count adjustment',
  ];
  const CONTACTS = ['Amit Shah', 'Priya Nair', 'Rahul Mehta', 'Sunita Reddy', 'Vijay Kumar'];

  /**
   * @param {object} [options]
   * @param {number} [options.seed]     PRNG seed; same seed produces same data
   * @param {number} [options.daysBack] days of order history to synthesise
   */
  function generate({ seed = DEFAULT_SEED, daysBack = 90 } = {}) {
    const random = createRandom(seed);
    const int = (min, max) => Math.floor(random() * (max - min + 1)) + min;
    const float = (min, max, dp = 2) => Number((random() * (max - min) + min).toFixed(dp));
    const pick = (list) => list[Math.floor(random() * list.length)];
    const chance = (p) => random() < p;

    const today = Format.startOfToday();
    const dayKeyAgo = (days) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return Format.dayKey(d);
    };
    const shiftDays = (key, days) => {
      const d = Format.parseDate(key);
      if (!d) return key;
      d.setDate(d.getDate() + days);
      return Format.dayKey(d);
    };

    /* ── SKU master ─────────────────────────────────────────────────────── */
    const skuMaster = [];
    let skuCounter = 1000;
    BRANDS.forEach((brand) => {
      const sizes =
        brand.category === 'Beer'
          ? ['330ml', '650ml']
          : brand.category === 'Wine'
            ? ['375ml', '750ml']
            : SPIRIT_SIZES;

      sizes.forEach((size) => {
        const base = BASE_PRICE[brand.alcoholType] || 300;
        const unitPrice = Number(
          (base * (PRICE_MULTIPLIER[size] || 3.5) * float(0.85, 1.15)).toFixed(2)
        );
        skuMaster.push({
          sku_id: `SKU${String(skuCounter++).padStart(4, '0')}`,
          sku_name: `${brand.name} ${size}`,
          brand: brand.name,
          category: brand.category,
          alcohol_type: brand.alcoholType,
          bottle_size: size,
          case_size: CASE_QTY[size] || 12,
          supplier: brand.supplier,
          unit_price: unitPrice,
          mrp: Number((unitPrice * 1.3).toFixed(2)),
          is_active: chance(0.95) ? 'Yes' : 'No',
          hsn_code: `22030${int(10, 99)}`,
        });
      });
    });

    /* ── Warehouse layout ───────────────────────────────────────────────── */
    const warehouseLayout = [];
    ZONES.forEach((zone) => {
      for (let rack = 1; rack <= RACKS_PER_ZONE; rack += 1) {
        const rackId = `${zone}${String(rack).padStart(2, '0')}`;
        for (let bin = 1; bin <= BINS_PER_RACK; bin += 1) {
          warehouseLayout.push({
            zone,
            rack_id: rackId,
            bin_id: `${rackId}-B${String(bin).padStart(2, '0')}`,
            bin_number: bin,
            capacity: int(80, 120),
            current_qty: 0, // filled in from inventory below
            is_blocked: chance(0.03) ? 'Yes' : 'No',
            rack_type: zone <= 'B' ? 'Drive-in' : zone <= 'D' ? 'Selective' : 'Cantilever',
          });
        }
      }
    });

    /* ── Inventory ──────────────────────────────────────────────────────────
       Placement follows the same slotting logic the platform recommends: fast
       movers near the dock in Zone A, medium movers in B, premium imports in
       the secured Zone C, slow high-value stock in D, wine in the temperature-
       controlled Zone E, overflow in F.

       A SKU whose holding exceeds one bin is split across consecutive bins,
       which is both what a real warehouse does and what makes bin occupancy
       and rack utilisation mean anything.

       A small number of fast movers are deliberately left in a back zone so
       the slotting recommendation has a genuine finding to report. */

    function targetZone(sku) {
      if (sku.category === 'Wine') return 'E';
      if (sku.alcohol_type === 'Scotch Whisky' || sku.alcohol_type === 'American Whisky') {
        return 'C';
      }
      if (sku.unit_price > 1500) return 'D';
      if (sku.category === 'Beer') return 'A';
      if (['180ml', '330ml', '375ml'].includes(sku.bottle_size)) return 'A';
      if (['Whisky', 'Rum'].includes(sku.category)) return 'B';
      return 'B';
    }

    // Free bins per zone, consumed in order.
    const binsByZone = new Map(ZONES.map((zone) => [zone, []]));
    warehouseLayout.forEach((bin) => {
      if (bin.is_blocked !== 'Yes') binsByZone.get(bin.zone).push(bin);
    });

    function takeBins(zone, count) {
      const taken = [];
      const order = [zone, ...ZONES.filter((z) => z !== zone)]; // overflow to any zone
      for (const candidate of order) {
        const pool = binsByZone.get(candidate);
        while (pool.length && taken.length < count) taken.push(pool.shift());
        if (taken.length >= count) break;
      }
      return taken;
    }

    const stockedSkus = skuMaster.filter((s) => s.is_active === 'Yes' && chance(0.9));
    const inventory = [];
    let invCounter = 0;

    stockedSkus.forEach((sku) => {
      // Fast-moving categories and small formats carry deeper stock.
      const categoryWeight = ['Whisky', 'Beer', 'Rum'].includes(sku.category)
        ? float(1.5, 3)
        : float(0.5, 1.5);
      const sizeWeight = ['180ml', '330ml', '375ml'].includes(sku.bottle_size)
        ? float(1.5, 2.5)
        : 1;
      const totalQty = Math.max(1, Math.round(int(10, 80) * categoryWeight * sizeWeight));

      // 6% of fast movers are misplaced in a back zone, the exact condition
      // the slotting rule is designed to catch.
      const natural = targetZone(sku);
      const zone = natural === 'A' && chance(0.06) ? pick(['D', 'F']) : natural;

      const binsNeeded = Math.max(1, Math.ceil(totalQty / 95));
      const bins = takeBins(zone, binsNeeded);
      if (!bins.length) return;

      // Skew ages so most stock is fresh but a believable tail is stale.
      const daysInStock = chance(0.1) ? int(95, 260) : int(1, 88);
      const lastReceived = dayKeyAgo(daysInStock);
      const lastDispatched =
        daysInStock > 90 ? null : dayKeyAgo(int(0, Math.max(1, Math.min(daysInStock, 40))));

      let remaining = totalQty;
      bins.forEach((bin, slot) => {
        const qty = slot === bins.length - 1 ? remaining : Math.min(remaining, int(70, 95));
        remaining -= qty;
        if (qty <= 0) return;

        invCounter += 1;
        inventory.push({
          inv_id: `INV${String(invCounter).padStart(5, '0')}`,
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
          total_value: Number((qty * sku.unit_price).toFixed(2)),
          last_received_date: lastReceived,
          last_dispatched_date: lastDispatched,
          days_in_stock: daysInStock,
          lot_number: `LOT${int(10000, 99999)}`,
          expiry_date: shiftDays(Format.dayKey(today), int(365, 1095)),
          condition: chance(0.96) ? 'Good' : 'Damaged',
          is_active: 'Yes',
        });

        bin.current_qty = qty;
      });
    });

    /* ── Orders ─────────────────────────────────────────────────────────── */
    const orders = [];
    let orderCounter = 5000;
    let lineCounter = 1;

    // Zipf-ish hotel demand: a handful of large customers dominate.
    const hotelWeights = HOTELS.map((hotel, i) => ({ hotel, weight: 0.85 ** i }));
    const weightTotal = hotelWeights.reduce((sum, h) => sum + h.weight, 0);
    const pickHotel = () => {
      let r = random() * weightTotal;
      for (const entry of hotelWeights) {
        r -= entry.weight;
        if (r <= 0) return entry.hotel;
      }
      return HOTELS[0];
    };

    /* Demand is heavily concentrated in real depots: a handful of nip-size
       whisky and beer lines carry a third of the volume. Picking SKUs
       uniformly (as the previous generator did) gave all 97 lines an identical
       ~1% share, which flattened the Pareto chart, made "top SKUs by dispatch"
       meaningless and left the slotting rule with nothing to find. */
    const orderableSkus = skuMaster.filter((s) => s.is_active === 'Yes');
    const skuWeights = orderableSkus.map((sku, i) => {
      const categoryWeight =
        { Beer: 3.2, Whisky: 2.6, Rum: 1.8, Brandy: 1.2, Vodka: 0.9, Gin: 0.5, Wine: 0.4 }[
          sku.category
        ] || 1;
      const sizeWeight =
        {
          '180ml': 2.6,
          '330ml': 2.2,
          '375ml': 1.8,
          '650ml': 2.0,
          '750ml': 1,
          '1000ml': 0.6,
          '1750ml': 0.3,
        }[sku.bottle_size] || 1;
      // Mild Zipf tail so the ordering within a category is not uniform either.
      return categoryWeight * sizeWeight * (1 / (1 + i * 0.012));
    });
    const skuWeightTotal = skuWeights.reduce((sum, w) => sum + w, 0);
    const pickSku = () => {
      let r = random() * skuWeightTotal;
      for (let i = 0; i < orderableSkus.length; i += 1) {
        r -= skuWeights[i];
        if (r <= 0) return orderableSkus[i];
      }
      return orderableSkus[orderableSkus.length - 1];
    };

    for (let day = daysBack; day >= 0; day -= 1) {
      const orderDate = dayKeyAgo(day);
      const ordersToday = int(3, 12);

      for (let o = 0; o < ordersToday; o += 1) {
        const orderId = `ORD${String(orderCounter++).padStart(5, '0')}`;
        const hotel = pickHotel();

        let status = 'Completed';
        if (day === 0) status = chance(0.6) ? 'Pending' : 'Processing';
        else if (day === 1) status = chance(0.8) ? 'Completed' : 'Pending';

        const lineCount = int(1, 6);
        for (let l = 0; l < lineCount; l += 1) {
          const sku = pickSku();
          const ordered = int(5, 50);

          // A completed order fills most lines exactly; the shortfall is the
          // interesting minority. Scaling every line by a random 0.85 to 1.0
          // factor (as the previous generator did) meant almost no line ever
          // landed on the ordered quantity, so the demo reported a 3% fill
          // rate and made a healthy warehouse look like a failing one.
          let fulfilled;
          if (status === 'Completed') {
            fulfilled = chance(0.88) ? ordered : Math.floor(ordered * float(0.4, 0.95));
          } else {
            fulfilled = Math.floor(ordered * float(0, 0.5));
          }

          orders.push({
            order_id: orderId,
            line_id: `LINE${String(lineCounter++).padStart(6, '0')}`,
            hotel_name: hotel,
            order_date: orderDate,
            delivery_date: status === 'Completed' ? shiftDays(orderDate, int(0, 2)) : null,
            sku_id: sku.sku_id,
            sku_name: sku.sku_name,
            brand: sku.brand,
            category: sku.category,
            bottle_size: sku.bottle_size,
            quantity_ordered: ordered,
            quantity_fulfilled: fulfilled,
            unit_price: sku.unit_price,
            order_value: Number((ordered * sku.unit_price).toFixed(2)),
            fulfilled_value: Number((fulfilled * sku.unit_price).toFixed(2)),
            status,
            priority: chance(0.15) ? 'High' : 'Normal',
          });
        }
      }
    }

    /* ── Dispatch ───────────────────────────────────────────────────────── */
    const drivers = STAFF.filter((s) => s.role === 'Driver');
    const pickers = STAFF.filter((s) => s.role === 'Picker');
    const receivers = STAFF.filter((s) => s.role === 'Receiver');

    const dispatch = orders
      .filter((o) => o.status === 'Completed' && o.quantity_fulfilled > 0)
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
        driver: pick(drivers).name,
        picker: pick(pickers).name,
        dispatch_time_minutes: int(15, 90),
        status: 'Delivered',
      }));

    /* ── Goods receipt ──────────────────────────────────────────────────── */
    const goodsReceipt = inventory.slice(0, Math.min(inventory.length, 200)).map((inv, i) => {
      const sku = skuMaster.find((s) => s.sku_id === inv.sku_id);
      const received = inv.quantity_bottles + int(0, 30);
      return {
        receipt_id: `GR${String(i + 3000).padStart(5, '0')}`,
        receipt_date: inv.last_received_date,
        supplier: inv.supplier,
        sku_id: inv.sku_id,
        sku_name: inv.sku_name,
        brand: inv.brand,
        quantity_received: received,
        quantity_cases: Math.floor(received / (sku?.case_size || 12)),
        zone: inv.zone,
        rack_id: inv.rack_id,
        bin_id: inv.bin_id,
        lot_number: inv.lot_number,
        condition: chance(0.92) ? 'Good' : 'Partially Damaged',
        received_by: pick(receivers).name,
        vehicle: pick(VEHICLES),
        po_number: `PO${int(10000, 99999)}`,
      };
    });

    /* ── Stock movement ─────────────────────────────────────────────────── */
    const stockMovement = [];
    let moveCounter = 7000;
    inventory.slice(0, 80).forEach((inv) => {
      for (let m = 0; m < int(1, 4); m += 1) {
        const fromZone = pick(ZONES);
        const toZone = pick(ZONES);
        stockMovement.push({
          movement_id: `MV${String(moveCounter++).padStart(5, '0')}`,
          movement_date: dayKeyAgo(int(1, 90)),
          sku_id: inv.sku_id,
          sku_name: inv.sku_name,
          brand: inv.brand,
          from_zone: fromZone,
          from_rack: `${fromZone}${String(int(1, RACKS_PER_ZONE)).padStart(2, '0')}`,
          to_zone: toZone,
          to_rack: `${toZone}${String(int(1, RACKS_PER_ZONE)).padStart(2, '0')}`,
          quantity: int(5, 30),
          reason: pick(MOVE_REASONS),
          employee: pick(STAFF).name,
        });
      }
    });

    /* ── Employees ──────────────────────────────────────────────────────── */
    const employees = STAFF.map((person, i) => {
      const handled = dispatch.filter((d) => d.picker === person.name || d.driver === person.name);
      const isPicking = person.role === 'Picker' || person.role === 'Packer';
      return {
        employee_id: `EMP${String(i + 1).padStart(3, '0')}`,
        employee_name: person.name,
        role: person.role,
        shift: person.shift,
        picks_today: isPicking ? int(20, 80) : 0,
        picks_per_hour: isPicking ? float(8, 25, 1) : 0,
        orders_completed: handled.length,
        accuracy_rate: float(95, 99.9, 1),
        avg_pick_time_min: float(2, 8, 1),
        attendance_days: int(20, 26),
        performance_score: float(70, 98, 1),
      };
    });

    /* ── Damage register ────────────────────────────────────────────────── */
    const damage = inventory
      .filter(() => chance(0.08))
      .slice(0, 30)
      .map((inv, i) => {
        const qty = int(1, 10);
        return {
          damage_id: `DMG${String(i + 100).padStart(4, '0')}`,
          damage_date: dayKeyAgo(int(1, 60)),
          sku_id: inv.sku_id,
          sku_name: inv.sku_name,
          brand: inv.brand,
          zone: inv.zone,
          rack_id: inv.rack_id,
          quantity_damaged: qty,
          damage_value: Number((qty * inv.unit_price).toFixed(2)),
          cause: pick(DAMAGE_CAUSES),
          reported_by: pick(STAFF).name,
          status: pick(['Reported', 'Under Review', 'Written Off', 'Replaced']),
        };
      });

    /* ── Cycle count ────────────────────────────────────────────────────── */
    const cycleCount = inventory.slice(0, 100).map((inv, i) => {
      // A controlled warehouse matches on most counted lines. A flat -5..+5
      // spread put 55% of counts outside the ±2 match tolerance and reported
      // 45% inventory accuracy, which no operating depot would survive.
      const roll = random();
      const variance = roll < 0.82 ? 0 : roll < 0.94 ? int(-2, 2) : int(-6, 6);
      return {
        count_id: `CC${String(i + 100).padStart(4, '0')}`,
        count_date: dayKeyAgo(int(1, 30)),
        sku_id: inv.sku_id,
        sku_name: inv.sku_name,
        zone: inv.zone,
        rack_id: inv.rack_id,
        bin_id: inv.bin_id,
        system_qty: inv.quantity_bottles,
        physical_qty: Math.max(0, inv.quantity_bottles + variance),
        variance,
        variance_value: Number(Math.abs(variance * inv.unit_price).toFixed(2)),
        counted_by: pick(STAFF).name,
        status: Math.abs(variance) <= 2 ? 'Matched' : 'Variance',
      };
    });

    /* ── Returns ────────────────────────────────────────────────────────── */
    const returns = orders
      .filter((o) => o.status === 'Completed' && o.quantity_fulfilled > 0 && chance(0.04))
      .slice(0, 20)
      .map((o, i) => {
        const qty = int(1, Math.max(1, Math.floor(o.quantity_fulfilled * 0.2)));
        return {
          return_id: `RET${String(i + 100).padStart(4, '0')}`,
          return_date: shiftDays(o.delivery_date || o.order_date, int(1, 5)),
          order_id: o.order_id,
          hotel_name: o.hotel_name,
          sku_id: o.sku_id,
          sku_name: o.sku_name,
          brand: o.brand,
          quantity_returned: qty,
          return_value: Number((qty * o.unit_price).toFixed(2)),
          reason: pick([
            'Wrong SKU dispatched',
            'Damaged on delivery',
            'Overshipped',
            'Order cancelled',
          ]),
          status: pick(['Received', 'Restocked', 'Written Off']),
        };
      });

    /* ── Suppliers ──────────────────────────────────────────────────────── */
    const suppliers = [...new Set(BRANDS.map((b) => b.supplier))].map((name, i) => {
      const supplied = BRANDS.filter((b) => b.supplier === name);
      return {
        supplier_id: `SUP${String(i + 1).padStart(3, '0')}`,
        supplier_name: name,
        contact_person: pick(CONTACTS),
        phone: `+91 ${int(70000, 99999)} ${int(10000, 99999)}`,
        brands_supplied: supplied.map((b) => b.name).join(', '),
        num_brands: supplied.length,
        total_receipts: goodsReceipt.filter((r) => r.supplier === name).length,
        reliability_score: float(80, 99, 1),
        avg_lead_days: int(2, 10),
        last_supply_date: dayKeyAgo(int(1, 30)),
      };
    });

    const vehicles = VEHICLES.map((registration, i) => {
      const trips = dispatch.filter((d) => d.vehicle === registration).length;
      return {
        vehicle_id: `VEH${String(i + 1).padStart(3, '0')}`,
        vehicle: registration,
        type: i < 3 ? 'Mini Truck' : 'Tempo',
        capacity: 500,
        trips,
      };
    });

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
      vehicles,
      damage,
      cycleCount,
      returns,
    };
  }

  GovSpirit.DemoData = { generate, DEFAULT_SEED };
})(window.GovSpirit);
