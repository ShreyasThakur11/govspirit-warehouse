/**
 * GovSpirit reference dataset.
 *
 * A 30-SKU × 12-month synthetic sales table for an Indian state excise
 * warehouse, used as the benchmark behind zone suggestions, ABC classification
 * and stock-coverage estimates when the operator's own file carries no history.
 *
 * The figures are synthetic but the shape is realistic: nip and quarter sizes
 * dominate by volume, beer is strongly seasonal (peaking through the summer),
 * spirits peak around Diwali and New Year, and premium imports move in single
 * or double digits per month.
 *
 * Months run Aug-25 through Jul-26.
 */
(function initReferenceData(GovSpirit) {
  'use strict';

  const MONTHS = Object.freeze([
    'Aug-25',
    'Sep-25',
    'Oct-25',
    'Nov-25',
    'Dec-25',
    'Jan-26',
    'Feb-26',
    'Mar-26',
    'Apr-26',
    'May-26',
    'Jun-26',
    'Jul-26',
  ]);

  // prettier-ignore. The aligned table is far easier to audit against an
  // excise price list than one property per line would be.
  /* prettier-ignore */
  const RAW_SKUS = [
    // ── Whisky: fast movers ────────────────────────────────────────────────
    { id: 'RS-60',    brand: 'Royal Stag',            category: 'Whisky', size: '60ml',  price: 75,   abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Pernod Ricard',   monthlySales: [2100, 1980, 2240, 2900, 3600, 1840, 1700, 2020, 2120, 1960, 2340, 2520], storageNotes: 'Highest-volume SKU. Ground floor, Zone A Row 1. Keep fully stocked.' },
    { id: 'RS-180',   brand: 'Royal Stag',            category: 'Whisky', size: '180ml', price: 190,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Pernod Ricard',   monthlySales: [1050, 980, 1120, 1450, 1800, 820, 750, 890, 920, 860, 1020, 1100],      storageNotes: 'Top-three seller. Zone A front rack. Safety stock: 500 bottles.' },
    { id: 'RS-750',   brand: 'Royal Stag',            category: 'Whisky', size: '750ml', price: 680,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Pernod Ricard',   monthlySales: [420, 390, 510, 620, 780, 380, 350, 420, 450, 410, 480, 520],            storageNotes: 'High value. Zone A Rack 2, middle shelf for easy access.' },
    { id: 'IB-60',    brand: 'Imperial Blue',         category: 'Whisky', size: '60ml',  price: 70,   abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Pernod Ricard',   monthlySales: [1980, 1860, 2100, 2720, 3380, 1730, 1600, 1900, 1995, 1840, 2200, 2370], storageNotes: 'Second-highest volume. Zone A, adjacent to RS-60.' },
    { id: 'IB-180',   brand: 'Imperial Blue',         category: 'Whisky', size: '180ml', price: 165,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Pernod Ricard',   monthlySales: [980, 910, 1050, 1380, 1720, 780, 710, 840, 870, 810, 960, 1040],        storageNotes: 'Very high volume. Zone A front. Safety stock: 400 bottles.' },
    { id: 'IB-750',   brand: 'Imperial Blue',         category: 'Whisky', size: '750ml', price: 590,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Pernod Ricard',   monthlySales: [380, 350, 460, 560, 700, 340, 310, 380, 400, 370, 430, 470],            storageNotes: 'Zone A Rack 3.' },
    { id: 'DS-375',   brand: "Director's Special",    category: 'Whisky', size: '375ml', price: 320,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Allied Blenders', monthlySales: [680, 640, 720, 940, 1150, 590, 550, 650, 680, 620, 730, 790],           storageNotes: 'High-turnover half-pint. Zone A.' },
    { id: '8PM-90',   brand: '8PM',                   category: 'Whisky', size: '90ml',  price: 90,   abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Radico Khaitan',  monthlySales: [820, 780, 920, 1200, 1480, 710, 680, 810, 850, 790, 940, 1010],         storageNotes: 'Nip size, very fast. Zone A near the counter.' },
    { id: 'MC-750',   brand: "McDowell's No.1",       category: 'Whisky', size: '750ml', price: 590,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Diageo India',    monthlySales: [340, 315, 385, 500, 620, 294, 273, 333, 350, 322, 386, 420],            storageNotes: 'Zone A.' },
    // ── Whisky: medium movers ──────────────────────────────────────────────
    { id: 'BP-750',   brand: 'Blenders Pride',        category: 'Whisky', size: '750ml', price: 1120, abcClass: 'B', suggestedZone: 'B', velocity: 'Medium', supplier: 'Pernod Ricard',   monthlySales: [180, 160, 220, 280, 350, 150, 140, 180, 190, 170, 210, 240],            storageNotes: 'Zone B mid-shelf. Premium segment.' },
    { id: 'AB-750',   brand: 'Antiquity Blue',        category: 'Whisky', size: '750ml', price: 890,  abcClass: 'B', suggestedZone: 'B', velocity: 'Medium', supplier: 'United Spirits',  monthlySales: [140, 130, 170, 220, 270, 120, 110, 140, 150, 130, 160, 185],            storageNotes: 'Zone B.' },
    { id: 'RC-750',   brand: 'Royal Challenge',       category: 'Whisky', size: '750ml', price: 760,  abcClass: 'B', suggestedZone: 'B', velocity: 'Medium', supplier: 'Allied Blenders', monthlySales: [160, 150, 195, 250, 310, 138, 128, 160, 170, 148, 182, 210],            storageNotes: 'Zone B Rack 2.' },
    { id: 'SIG-750',  brand: 'Signature',             category: 'Whisky', size: '750ml', price: 980,  abcClass: 'B', suggestedZone: 'B', velocity: 'Medium', supplier: 'United Spirits',  monthlySales: [120, 112, 145, 188, 230, 104, 96, 120, 128, 118, 140, 160],             storageNotes: 'Zone B.' },
    // ── Whisky: slow / premium imports ─────────────────────────────────────
    { id: 'JWR-750',  brand: 'Johnnie Walker Red',    category: 'Whisky', size: '750ml', price: 3200, abcClass: 'C', suggestedZone: 'D', velocity: 'Slow',   supplier: 'Diageo India',    monthlySales: [18, 14, 22, 35, 48, 12, 10, 16, 18, 14, 20, 26],                        storageNotes: 'Premium import. Zone D secured shelf. Lockable cabinet.' },
    { id: 'CHR-750',  brand: 'Chivas Regal 12Y',      category: 'Whisky', size: '750ml', price: 4800, abcClass: 'C', suggestedZone: 'D', velocity: 'Slow',   supplier: 'Pernod Ricard',   monthlySales: [8, 6, 10, 16, 22, 5, 4, 7, 8, 6, 9, 12],                                storageNotes: 'High value, slow mover. Zone D, lockable cabinet, face-out display.' },
    // ── Rum ────────────────────────────────────────────────────────────────
    { id: 'OM-180',   brand: 'Old Monk',              category: 'Rum',    size: '180ml', price: 142,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Mohan Meakin',    monthlySales: [720, 680, 810, 1050, 1300, 630, 590, 710, 745, 690, 820, 890],          storageNotes: 'Classic fast mover. Zone A Rack 5.' },
    { id: 'OM-750',   brand: 'Old Monk',              category: 'Rum',    size: '750ml', price: 498,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Mohan Meakin',    monthlySales: [310, 290, 350, 460, 570, 270, 252, 305, 320, 295, 352, 385],            storageNotes: 'Zone A Rack 5, middle shelf.' },
    { id: 'MCC-180',  brand: "McDowell's Celebration", category: 'Rum',   size: '180ml', price: 138,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'Diageo India',    monthlySales: [690, 650, 780, 1010, 1250, 600, 565, 682, 714, 660, 790, 855],          storageNotes: 'Zone A, Rack 6.' },
    // ── Beer (counter-seasonal to spirits) ─────────────────────────────────
    { id: 'KF-650',   brand: 'Kingfisher',            category: 'Beer',   size: '650ml', price: 115,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'United Breweries', monthlySales: [2200, 1900, 2500, 1800, 1400, 1600, 2400, 2800, 3200, 3500, 3800, 2900], storageNotes: 'Highest volume overall. Zone A ground floor. Stack in cases of 12.' },
    { id: 'KF-330',   brand: 'Kingfisher',            category: 'Beer',   size: '330ml', price: 80,   abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'United Breweries', monthlySales: [1400, 1200, 1600, 1200, 900, 1050, 1550, 1800, 2100, 2300, 2500, 1900],  storageNotes: 'Zone A ground floor, canned section.' },
    { id: 'HW-650',   brand: 'Haywards 5000',         category: 'Beer',   size: '650ml', price: 105,  abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',   supplier: 'SABMiller',        monthlySales: [1800, 1600, 2100, 1500, 1150, 1350, 2000, 2400, 2700, 2950, 3200, 2400],  storageNotes: 'Zone A ground floor, adjacent to Kingfisher.' },
    { id: 'CARL-650', brand: 'Carlsberg',             category: 'Beer',   size: '650ml', price: 130,  abcClass: 'B', suggestedZone: 'B', velocity: 'Medium', supplier: 'Carlsberg India',  monthlySales: [620, 540, 710, 520, 400, 470, 690, 810, 940, 1020, 1100, 840],            storageNotes: 'Zone B, beer section.' },
    // ── Vodka ──────────────────────────────────────────────────────────────
    { id: 'SMI-375',  brand: 'Smirnoff',              category: 'Vodka',  size: '375ml', price: 520,  abcClass: 'B', suggestedZone: 'B', velocity: 'Medium', supplier: 'Diageo India',    monthlySales: [140, 126, 168, 215, 268, 120, 110, 138, 148, 135, 162, 186],            storageNotes: 'Zone B Rack 1.' },
    { id: 'SMI-750',  brand: 'Smirnoff',              category: 'Vodka',  size: '750ml', price: 985,  abcClass: 'B', suggestedZone: 'B', velocity: 'Medium', supplier: 'Diageo India',    monthlySales: [92, 84, 110, 142, 176, 80, 74, 92, 98, 89, 107, 124],                   storageNotes: 'Zone B.' },
    { id: 'ABS-750',  brand: 'Absolut',               category: 'Vodka',  size: '750ml', price: 1850, abcClass: 'C', suggestedZone: 'C', velocity: 'Slow',   supplier: 'Pernod Ricard',   monthlySales: [35, 28, 42, 58, 72, 25, 22, 32, 36, 30, 40, 50],                        storageNotes: 'Premium import. Zone C Shelf 3.' },
    // ── Wine ───────────────────────────────────────────────────────────────
    { id: 'SULA-R',   brand: 'Sula Red',              category: 'Wine',   size: '750ml', price: 420,  abcClass: 'C', suggestedZone: 'E', velocity: 'Slow',   supplier: 'Sula Vineyards',  monthlySales: [28, 22, 34, 45, 56, 20, 18, 26, 30, 24, 32, 40],                        storageNotes: 'Wine section Zone E. Store horizontally. Temperature sensitive.' },
    { id: 'SULA-W',   brand: 'Sula White',            category: 'Wine',   size: '750ml', price: 380,  abcClass: 'C', suggestedZone: 'E', velocity: 'Slow',   supplier: 'Sula Vineyards',  monthlySales: [22, 18, 28, 38, 48, 16, 14, 21, 24, 19, 26, 34],                        storageNotes: 'Zone E. Store horizontally.' },
    // ── Gin ────────────────────────────────────────────────────────────────
    { id: 'GOR-750',  brand: "Gordon's Gin",          category: 'Gin',    size: '750ml', price: 1680, abcClass: 'C', suggestedZone: 'D', velocity: 'Slow',   supplier: 'Diageo India',    monthlySales: [15, 12, 18, 24, 30, 11, 10, 14, 16, 13, 17, 21],                        storageNotes: 'Zone D.' },
    // ── Brandy ─────────────────────────────────────────────────────────────
    { id: 'HB-180',   brand: 'Honey Bee Brandy',      category: 'Brandy', size: '180ml', price: 125,  abcClass: 'B', suggestedZone: 'B', velocity: 'Medium', supplier: 'Blossom Industries', monthlySales: [380, 355, 430, 560, 695, 330, 308, 374, 392, 360, 430, 468],         storageNotes: 'Zone B Rack 1.' },
    { id: 'HB-750',   brand: 'Honey Bee Brandy',      category: 'Brandy', size: '750ml', price: 445,  abcClass: 'B', suggestedZone: 'B', velocity: 'Medium', supplier: 'Blossom Industries', monthlySales: [165, 155, 188, 243, 302, 143, 134, 163, 171, 157, 188, 204],         storageNotes: 'Zone B.' },
  ];

  /** Derived aggregates, computed once at load. */
  const SKUS = Object.freeze(
    RAW_SKUS.map((sku) => {
      const total = sku.monthlySales.reduce((sum, v) => sum + v, 0);
      const peakIndex = sku.monthlySales.indexOf(Math.max(...sku.monthlySales));
      return Object.freeze({
        ...sku,
        monthlySales: Object.freeze([...sku.monthlySales]),
        avgMonthlySales: Math.round(total / sku.monthlySales.length),
        totalAnnualSales: total,
        annualRevenue: total * sku.price,
        peakMonth: MONTHS[peakIndex],
      });
    })
  );

  /** Zone taxonomy. Colours are theme-independent; they encode meaning. */
  const ZONES = Object.freeze({
    A: {
      label: 'Zone A',
      desc: 'Fast movers, nearest the loading dock',
      color: '#10b981',
      maxUtil: 90,
    },
    B: { label: 'Zone B', desc: 'Medium movers, central warehouse', color: '#3b82f6', maxUtil: 85 },
    C: {
      label: 'Zone C',
      desc: 'Premium and imported, secured area',
      color: '#8b5cf6',
      maxUtil: 80,
    },
    D: {
      label: 'Zone D',
      desc: 'Slow movers and high value, back shelves',
      color: '#f59e0b',
      maxUtil: 70,
    },
    E: {
      label: 'Zone E',
      desc: 'Wine and temperature-sensitive stock',
      color: '#f43f5e',
      maxUtil: 75,
    },
  });

  const CATEGORY_COLORS = Object.freeze({
    Whisky: '#6366f1',
    Rum: '#f59e0b',
    Beer: '#10b981',
    Vodka: '#3b82f6',
    Wine: '#f43f5e',
    Gin: '#8b5cf6',
    Brandy: '#f97316',
    Unknown: '#64748b',
  });

  /** Fallback zone by category when no reference SKU matches. */
  const DEFAULT_ZONE_BY_CATEGORY = Object.freeze({
    Whisky: 'B',
    Rum: 'B',
    Beer: 'A',
    Wine: 'E',
    Vodka: 'C',
    Gin: 'D',
    Brandy: 'B',
    Unknown: 'C',
  });

  const HOTELS = Object.freeze([
    'Raj Palace Hotel',
    'Grand Mahal Suites',
    'Heritage Inn',
    'Blue Lagoon Resort',
    'The Royal Arms',
    'Ambassador Hotel',
    'Sunrise Club',
    'Green Valley Resort',
    'Metro Banquet Hall',
    'Elite Lounge',
    'Crystal Gardens',
    'Lotus Hotel',
    'Paradise Restaurant',
    'Lake View Club',
    'Mountain View Inn',
  ]);

  /* ── Lookups ──────────────────────────────────────────────────────────── */

  const byBrandSize = new Map();
  const byBrand = new Map();
  SKUS.forEach((sku) => {
    byBrandSize.set(`${sku.brand.toLowerCase()}|${sku.size.toLowerCase()}`, sku);
    if (!byBrand.has(sku.brand.toLowerCase())) byBrand.set(sku.brand.toLowerCase(), sku);
  });

  /**
   * Find the closest reference SKU for a brand and (optional) size.
   * Falls back to any size of the same brand, then to a substring match, so a
   * pasted line reading "royal stag nip" still resolves.
   */
  function findByBrandSize(brand, size) {
    if (!brand) return null;
    const b = String(brand).trim().toLowerCase();
    if (!b) return null;

    if (size) {
      const exact = byBrandSize.get(`${b}|${String(size).trim().toLowerCase()}`);
      if (exact) return exact;
    }

    const brandOnly = byBrand.get(b);
    if (brandOnly) return brandOnly;

    // Last resort: the longest brand name contained in the supplied text.
    let best = null;
    SKUS.forEach((sku) => {
      const name = sku.brand.toLowerCase();
      if (b.includes(name) && (!best || name.length > best.brand.length)) best = sku;
    });
    return best;
  }

  function findByCategory(category) {
    return SKUS.filter((sku) => sku.category === category);
  }

  function defaultZoneFor(category) {
    return DEFAULT_ZONE_BY_CATEGORY[category] || 'C';
  }

  function zoneColor(zone) {
    return ZONES[zone]?.color || '#64748b';
  }

  function categoryColor(category) {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.Unknown;
  }

  GovSpirit.ReferenceData = {
    MONTHS,
    SKUS,
    ZONES,
    HOTELS,
    CATEGORY_COLORS,
    DEFAULT_ZONE_BY_CATEGORY,
    findByBrandSize,
    findByCategory,
    defaultZoneFor,
    zoneColor,
    categoryColor,
  };
})(window.GovSpirit);
