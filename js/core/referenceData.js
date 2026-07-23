/**
 * GovSpirit Reference Data
 * Embedded 30-SKU × 12-month synthetic sales dataset for Indian government alcohol warehouses.
 * Used as ground truth for storage planning, ABC classification, and demand benchmarking.
 * Months: Aug-25 → Jul-26
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.ReferenceData = (function () {

  const MONTHS = ['Aug-25','Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26','Apr-26','May-26','Jun-26','Jul-26'];

  // ─── 30 SKUs with 12 months of synthetic sales ────────────────────────────
  const SKUs = [
    // ── WHISKY ── Fast Movers (Zone A) ──────────────────────────────────────
    {
      id: 'RS-60', brand: 'Royal Stag', category: 'Whisky', size: '60ml',
      price: 75, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [2100,1980,2240,2900,3600,1840,1700,2020,2120,1960,2340,2520],
      storageNotes: 'Highest volume SKU. Ground floor, Zone A Row 1. Keep fully stocked.',
      supplier: 'Pernod Ricard'
    },
    {
      id: 'RS-180', brand: 'Royal Stag', category: 'Whisky', size: '180ml',
      price: 190, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [1050,980,1120,1450,1800,820,750,890,920,860,1020,1100],
      storageNotes: 'Top-3 seller. Zone A front rack. Safety stock: 500 bottles.',
      supplier: 'Pernod Ricard'
    },
    {
      id: 'RS-750', brand: 'Royal Stag', category: 'Whisky', size: '750ml',
      price: 680, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [420,390,510,620,780,380,350,420,450,410,480,520],
      storageNotes: 'High value. Zone A Rack 2, middle shelf for easy access.',
      supplier: 'Pernod Ricard'
    },
    {
      id: 'IB-60', brand: 'Imperial Blue', category: 'Whisky', size: '60ml',
      price: 70, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [1980,1860,2100,2720,3380,1730,1600,1900,1995,1840,2200,2370],
      storageNotes: 'Second highest volume. Zone A, adjacent to RS-60.',
      supplier: 'Pernod Ricard'
    },
    {
      id: 'IB-180', brand: 'Imperial Blue', category: 'Whisky', size: '180ml',
      price: 165, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [980,910,1050,1380,1720,780,710,840,870,810,960,1040],
      storageNotes: 'Very high volume. Zone A front. Safety stock: 400 bottles.',
      supplier: 'Pernod Ricard'
    },
    {
      id: 'IB-750', brand: 'Imperial Blue', category: 'Whisky', size: '750ml',
      price: 590, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [380,350,460,560,700,340,310,380,400,370,430,470],
      storageNotes: 'Zone A Rack 3.',
      supplier: 'Pernod Ricard'
    },
    {
      id: 'DS-375', brand: "Director's Special", category: 'Whisky', size: '375ml',
      price: 320, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [680,640,720,940,1150,590,550,650,680,620,730,790],
      storageNotes: 'High turnover half-pint. Zone A.',
      supplier: 'Allied Blenders'
    },
    {
      id: '8PM-90', brand: '8PM', category: 'Whisky', size: '90ml',
      price: 90, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [820,780,920,1200,1480,710,680,810,850,790,940,1010],
      storageNotes: 'Nip size, very fast. Zone A near checkout counter.',
      supplier: 'Radico Khaitan'
    },
    {
      id: 'MC-750', brand: "McDowell's No.1", category: 'Whisky', size: '750ml',
      price: 590, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [340,315,385,500,620,294,273,333,350,322,386,420],
      storageNotes: 'Zone A.',
      supplier: 'Diageo India'
    },
    // ── WHISKY ── Medium Movers (Zone B) ─────────────────────────────────────
    {
      id: 'BP-750', brand: 'Blenders Pride', category: 'Whisky', size: '750ml',
      price: 1120, abcClass: 'B', suggestedZone: 'B', velocity: 'Medium',
      monthlySales: [180,160,220,280,350,150,140,180,190,170,210,240],
      storageNotes: 'Zone B mid-shelf. Premium segment.',
      supplier: 'Pernod Ricard'
    },
    {
      id: 'AB-750', brand: 'Antiquity Blue', category: 'Whisky', size: '750ml',
      price: 890, abcClass: 'B', suggestedZone: 'B', velocity: 'Medium',
      monthlySales: [140,130,170,220,270,120,110,140,150,130,160,185],
      storageNotes: 'Zone B.',
      supplier: 'United Spirits'
    },
    {
      id: 'RC-750', brand: 'Royal Challenge', category: 'Whisky', size: '750ml',
      price: 760, abcClass: 'B', suggestedZone: 'B', velocity: 'Medium',
      monthlySales: [160,150,195,250,310,138,128,160,170,148,182,210],
      storageNotes: 'Zone B Rack 2.',
      supplier: 'Allied Blenders'
    },
    {
      id: 'SIG-750', brand: 'Signature', category: 'Whisky', size: '750ml',
      price: 980, abcClass: 'B', suggestedZone: 'B', velocity: 'Medium',
      monthlySales: [120,112,145,188,230,104,96,120,128,118,140,160],
      storageNotes: 'Zone B.',
      supplier: 'United Spirits'
    },
    // ── WHISKY ── Slow/Premium (Zone D) ──────────────────────────────────────
    {
      id: 'JWR-750', brand: 'Johnnie Walker Red', category: 'Whisky', size: '750ml',
      price: 3200, abcClass: 'C', suggestedZone: 'D', velocity: 'Slow',
      monthlySales: [18,14,22,35,48,12,10,16,18,14,20,26],
      storageNotes: 'Premium import. Zone D secured shelf. Lock cabinet.',
      supplier: 'Diageo India'
    },
    {
      id: 'CHR-750', brand: 'Chivas Regal 12Y', category: 'Whisky', size: '750ml',
      price: 4800, abcClass: 'C', suggestedZone: 'D', velocity: 'Slow',
      monthlySales: [8,6,10,16,22,5,4,7,8,6,9,12],
      storageNotes: 'High value, slow mover. Zone D, lockable cabinet, face-out display.',
      supplier: 'Pernod Ricard'
    },
    // ── RUM ── Fast Movers (Zone A) ───────────────────────────────────────────
    {
      id: 'OM-180', brand: 'Old Monk', category: 'Rum', size: '180ml',
      price: 142, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [720,680,810,1050,1300,630,590,710,745,690,820,890],
      storageNotes: 'Classic fast mover. Zone A Rack 5.',
      supplier: 'Mohan Meakin'
    },
    {
      id: 'OM-750', brand: 'Old Monk', category: 'Rum', size: '750ml',
      price: 498, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [310,290,350,460,570,270,252,305,320,295,352,385],
      storageNotes: 'Zone A Rack 5, middle shelf.',
      supplier: 'Mohan Meakin'
    },
    {
      id: 'MC-180', brand: "McDowell's Celebration", category: 'Rum', size: '180ml',
      price: 138, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [690,650,780,1010,1250,600,565,682,714,660,790,855],
      storageNotes: 'Zone A, Rack 6.',
      supplier: 'Diageo India'
    },
    // ── BEER ── Fast Movers (Zone A, Ground Floor) ────────────────────────────
    {
      id: 'KF-650', brand: 'Kingfisher', category: 'Beer', size: '650ml',
      price: 115, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [2200,1900,2500,1800,1400,1600,2400,2800,3200,3500,3800,2900],
      storageNotes: 'Highest volume overall. Zone A ground floor. Stack in cases of 12.',
      supplier: 'United Breweries'
    },
    {
      id: 'KF-330', brand: 'Kingfisher', category: 'Beer', size: '330ml',
      price: 80, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [1400,1200,1600,1200,900,1050,1550,1800,2100,2300,2500,1900],
      storageNotes: 'Zone A ground floor, canned section.',
      supplier: 'United Breweries'
    },
    {
      id: 'HW-650', brand: 'Haywards 5000', category: 'Beer', size: '650ml',
      price: 105, abcClass: 'A', suggestedZone: 'A', velocity: 'Fast',
      monthlySales: [1800,1600,2100,1500,1150,1350,2000,2400,2700,2950,3200,2400],
      storageNotes: 'Zone A ground floor, adjacent to Kingfisher.',
      supplier: 'SABMiller'
    },
    {
      id: 'CARL-650', brand: 'Carlsberg', category: 'Beer', size: '650ml',
      price: 130, abcClass: 'B', suggestedZone: 'B', velocity: 'Medium',
      monthlySales: [620,540,710,520,400,470,690,810,940,1020,1100,840],
      storageNotes: 'Zone B, beer section.',
      supplier: 'Carlsberg India'
    },
    // ── VODKA ─────────────────────────────────────────────────────────────────
    {
      id: 'SMI-375', brand: 'Smirnoff', category: 'Vodka', size: '375ml',
      price: 520, abcClass: 'B', suggestedZone: 'B', velocity: 'Medium',
      monthlySales: [140,126,168,215,268,120,110,138,148,135,162,186],
      storageNotes: 'Zone B Rack 1.',
      supplier: 'Diageo India'
    },
    {
      id: 'SMI-750', brand: 'Smirnoff', category: 'Vodka', size: '750ml',
      price: 985, abcClass: 'B', suggestedZone: 'B', velocity: 'Medium',
      monthlySales: [92,84,110,142,176,80,74,92,98,89,107,124],
      storageNotes: 'Zone B.',
      supplier: 'Diageo India'
    },
    {
      id: 'ABS-750', brand: 'Absolut', category: 'Vodka', size: '750ml',
      price: 1850, abcClass: 'C', suggestedZone: 'C', velocity: 'Slow',
      monthlySales: [35,28,42,58,72,25,22,32,36,30,40,50],
      storageNotes: 'Premium import. Zone C Shelf 3.',
      supplier: 'Pernod Ricard'
    },
    // ── WINE ──────────────────────────────────────────────────────────────────
    {
      id: 'SULA-R', brand: 'Sula Red', category: 'Wine', size: '750ml',
      price: 420, abcClass: 'C', suggestedZone: 'E', velocity: 'Slow',
      monthlySales: [28,22,34,45,56,20,18,26,30,24,32,40],
      storageNotes: 'Wine section Zone E. Horizontal storage if possible. Temperature sensitive.',
      supplier: 'Sula Vineyards'
    },
    {
      id: 'SULA-W', brand: 'Sula White', category: 'Wine', size: '750ml',
      price: 380, abcClass: 'C', suggestedZone: 'E', velocity: 'Slow',
      monthlySales: [22,18,28,38,48,16,14,21,24,19,26,34],
      storageNotes: 'Zone E. Horizontal storage.',
      supplier: 'Sula Vineyards'
    },
    // ── GIN ───────────────────────────────────────────────────────────────────
    {
      id: 'GOR-750', brand: "Gordon's Gin", category: 'Gin', size: '750ml',
      price: 1680, abcClass: 'C', suggestedZone: 'D', velocity: 'Slow',
      monthlySales: [15,12,18,24,30,11,10,14,16,13,17,21],
      storageNotes: 'Zone D.',
      supplier: 'Diageo India'
    },
    // ── BRANDY ────────────────────────────────────────────────────────────────
    {
      id: 'HB-180', brand: 'Honey Bee Brandy', category: 'Brandy', size: '180ml',
      price: 125, abcClass: 'B', suggestedZone: 'B', velocity: 'Medium',
      monthlySales: [380,355,430,560,695,330,308,374,392,360,430,468],
      storageNotes: 'Zone B Rack 1.',
      supplier: 'Blossom Industries'
    },
    {
      id: 'HB-750', brand: 'Honey Bee Brandy', category: 'Brandy', size: '750ml',
      price: 445, abcClass: 'B', suggestedZone: 'B', velocity: 'Medium',
      monthlySales: [165,155,188,243,302,143,134,163,171,157,188,204],
      storageNotes: 'Zone B.',
      supplier: 'Blossom Industries'
    },
  ];

  // ─── Add computed fields ──────────────────────────────────────────────────
  SKUs.forEach(sku => {
    sku.avgMonthlySales = Math.round(sku.monthlySales.reduce((s, v) => s + v, 0) / sku.monthlySales.length);
    sku.totalAnnualSales = sku.monthlySales.reduce((s, v) => s + v, 0);
    sku.annualRevenue = sku.totalAnnualSales * sku.price;
    sku.peakMonth = MONTHS[sku.monthlySales.indexOf(Math.max(...sku.monthlySales))];
    sku.stockCoverageWeeks = null; // filled after matching inventory
  });

  // ─── Zone Definitions ────────────────────────────────────────────────────
  const ZONES = {
    A: { label: 'Zone A', desc: 'Fast movers — Near loading dock', color: '#10b981', maxUtil: 90 },
    B: { label: 'Zone B', desc: 'Medium movers — Central warehouse', color: '#3b82f6', maxUtil: 85 },
    C: { label: 'Zone C', desc: 'Premium / Imported — Secured area', color: '#8b5cf6', maxUtil: 80 },
    D: { label: 'Zone D', desc: 'Slow movers / High-value — Back shelves', color: '#f59e0b', maxUtil: 70 },
    E: { label: 'Zone E', desc: 'Wine / Temperature-sensitive', color: '#f43f5e', maxUtil: 75 },
  };

  // ─── Hotel List ───────────────────────────────────────────────────────────
  const HOTELS = [
    'Raj Palace Hotel', 'Grand Mahal Suites', 'Heritage Inn', 'Blue Lagoon Resort',
    'The Royal Arms', 'Ambassador Hotel', 'Sunrise Club', 'Green Valley Resort',
    'Metro Banquet Hall', 'Elite Lounge', 'Crystal Gardens', 'Lotus Hotel',
    'Paradise Restaurant', 'Lake View Club', 'Mountain View Inn',
  ];

  // ─── Category Colors ─────────────────────────────────────────────────────
  const CATEGORY_COLORS = {
    Whisky: '#6366f1', Rum: '#f59e0b', Beer: '#10b981',
    Vodka: '#3b82f6', Wine: '#f43f5e', Gin: '#8b5cf6', Brandy: '#f97316',
  };

  // ─── Lookup helpers ───────────────────────────────────────────────────────
  function findByBrandSize(brand, size) {
    if (!brand || !size) return null;
    return SKUs.find(s => s.brand === brand && s.size === size) ||
           SKUs.find(s => s.brand === brand) || null;
  }

  function findByCategory(category) {
    return SKUs.filter(s => s.category === category);
  }

  return { SKUs, MONTHS, ZONES, HOTELS, CATEGORY_COLORS, findByBrandSize, findByCategory };
})();
