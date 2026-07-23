/**
 * GovSpirit List Parser
 * Converts unstructured free-text warehouse lists into structured inventory rows.
 * Handles brand names, sizes (ml/L), quantities (nos/units/bottles/qty), and locations (zone/rack).
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.ListParser = (function () {
  const REF = GovSpirit.ReferenceData;

  // ─── Brand Pattern Dictionary ─────────────────────────────────────────────
  // Each entry: { patterns: [string to match], brand, category }
  // Longer/more-specific patterns should come first.
  const BRAND_PATTERNS = [
    // WHISKY
    { p: ["blenders pride","blender's pride","blendr pride"], brand: "Blenders Pride", cat: "Whisky" },
    { p: ["antiquity blue","antiquity"], brand: "Antiquity Blue", cat: "Whisky" },
    { p: ["royal challenge"], brand: "Royal Challenge", cat: "Whisky" },
    { p: ["royal stag","royalstag","rs whisky","r stag"], brand: "Royal Stag", cat: "Whisky" },
    { p: ["imperial blue","imp blue","imperial bl","i.b.","impblue"], brand: "Imperial Blue", cat: "Whisky" },
    { p: ["directors special","director special","director's special","dir special","d.s."], brand: "Director's Special", cat: "Whisky" },
    { p: ["mcdowell's no.1","mcdowells no.1","mc dowell no 1","mcno1","mcdowell no1","mcdowells"], brand: "McDowell's No.1", cat: "Whisky" },
    { p: ["8 pm","8pm","eight pm"], brand: "8PM", cat: "Whisky" },
    { p: ["signature"], brand: "Signature", cat: "Whisky" },
    { p: ["johnnie walker red","johnie walker","jw red","johnnie walker"], brand: "Johnnie Walker Red", cat: "Whisky" },
    { p: ["chivas regal","chivas"], brand: "Chivas Regal 12Y", cat: "Whisky" },
    { p: ["jack daniel","jack daniels","jack dan","jd"], brand: "Jack Daniel's", cat: "Whisky" },
    { p: ["100 pipers","hundred pipers"], brand: "100 Pipers", cat: "Whisky" },
    // RUM
    { p: ["old monk","oldmonk","o monk"], brand: "Old Monk", cat: "Rum" },
    { p: ["mcdowell's celebration","mc dowell celebration","mc celebration","mcdo celebr","celebration rum"], brand: "McDowell's Celebration", cat: "Rum" },
    { p: ["bacardi"], brand: "Bacardi", cat: "Rum" },
    // BEER
    { p: ["kingfisher premium","kf premium","king fisher"], brand: "Kingfisher", cat: "Beer" },
    { p: ["kingfisher","kfb","k.f."], brand: "Kingfisher", cat: "Beer" },
    { p: ["haywards 5000","haywards5000","hw5000","hayward 5000","haywards"], brand: "Haywards 5000", cat: "Beer" },
    { p: ["carlsberg","carls"], brand: "Carlsberg", cat: "Beer" },
    { p: ["budweiser","bud"], brand: "Budweiser", cat: "Beer" },
    // VODKA
    { p: ["absolut","absolute vodka"], brand: "Absolut", cat: "Vodka" },
    { p: ["smirnoff"], brand: "Smirnoff", cat: "Vodka" },
    { p: ["magic moments","magic moment","mm vodka"], brand: "Magic Moments", cat: "Vodka" },
    // WINE
    { p: ["sula white","sula sauvignon"], brand: "Sula White", cat: "Wine" },
    { p: ["sula red","sula shiraz"], brand: "Sula Red", cat: "Wine" },
    { p: ["sula"], brand: "Sula Red", cat: "Wine" },
    { p: ["grover zampa","grover"], brand: "Grover Zampa", cat: "Wine" },
    // GIN
    { p: ["gordon's gin","gordons gin","gordons"], brand: "Gordon's Gin", cat: "Gin" },
    { p: ["beefeater"], brand: "Beefeater Gin", cat: "Gin" },
    { p: ["greater than"], brand: "Greater Than Gin", cat: "Gin" },
    // BRANDY
    { p: ["honey bee brandy","honey bee","honeybee"], brand: "Honey Bee Brandy", cat: "Brandy" },
    { p: ["morpheus"], brand: "Morpheus Brandy", cat: "Brandy" },
  ];

  // ─── Category keyword fallback ────────────────────────────────────────────
  const CAT_KEYWORDS = [
    { kw: ['whisky','whiskey','scotch','bourbon'], cat: 'Whisky' },
    { kw: ['rum'], cat: 'Rum' },
    { kw: ['beer','lager','ale','stout'], cat: 'Beer' },
    { kw: ['wine','merlot','chardonnay','cabernet','shiraz','sauvignon'], cat: 'Wine' },
    { kw: ['vodka'], cat: 'Vodka' },
    { kw: ['gin'], cat: 'Gin' },
    { kw: ['brandy','cognac'], cat: 'Brandy' },
  ];

  // Default zones when no reference data found
  const DEFAULT_ZONES = { Whisky: 'B', Rum: 'B', Beer: 'A', Wine: 'E', Vodka: 'C', Gin: 'D', Brandy: 'B', Unknown: 'C' };

  // ─── Main parse entry ─────────────────────────────────────────────────────

  /**
   * Parse a free-text multiline string into an array of structured items.
   * @param {string} text - The raw user input
   * @returns {Array} Parsed item objects
   */
  function parseText(text) {
    if (!text || !text.trim()) return [];

    // Split on newlines first; fall back to comma/semicolon if single line
    let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    if (lines.length <= 1 && text.includes(',')) {
      lines = text.split(/[,;]/).map(l => l.trim()).filter(l => l.length > 1);
    }

    return lines.map((line, i) => parseItem(line, i));
  }

  /**
   * Parse a single line into a structured item.
   */
  function parseItem(line, index = 0) {
    const lower = line.toLowerCase();
    const result = {
      id: 'ITEM-' + String(index + 1).padStart(3, '0'),
      raw: line,
      brand: null,
      category: null,
      size: null,
      qty: 0,
      location: null,
      confidence: 'low',
      suggestedZone: 'C',
      abcClass: 'C',
      velocity: 'Unknown',
      price: null,
      avgMonthlySales: null,
      stockMonths: null,
      storageNotes: 'No reference data. Store in Zone C by default.',
      refId: null,
      supplier: null,
    };

    // 1. Extract SIZE (e.g. 180ml, 750 ml, 1L, 1.5L)
    const sizeMatch = line.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i);
    if (sizeMatch) {
      const num = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toLowerCase();
      result.size = unit === 'l' ? Math.round(num * 1000) + 'ml' : Math.round(num) + 'ml';
    }

    // 2. Extract QUANTITY
    // Try ordered patterns: keyword+number, number+keyword, dash/colon + number
    const qtyPatterns = [
      /(?:qty|quantity|nos?|units?|bottles?|pcs?|pieces?|cases?)\s*[:\-=]?\s*(\d{1,5})/i,
      /(\d{1,5})\s*(?:qty|quantity|nos?|units?|bottles?|pcs?|pieces?|cases?)/i,
      /[-–:]\s*(\d{1,5})(?!\s*m?l)/i,
      /×\s*(\d{1,5})/i,
      /x\s*(\d{1,5})\b/i,
    ];
    for (const pat of qtyPatterns) {
      const m = line.match(pat);
      if (m) { result.qty = parseInt(m[1]); break; }
    }
    // Last resort: first standalone multi-digit number that isn't the size
    if (!result.qty) {
      const stripped = result.size ? line.replace(new RegExp(sizeMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ') : line;
      const numMatch = stripped.match(/\b(\d{1,5})\b/);
      if (numMatch && parseInt(numMatch[1]) !== parseInt(result.size)) {
        result.qty = parseInt(numMatch[1]);
      }
    }
    if (!result.qty || result.qty <= 0) result.qty = 1;

    // 3. Extract LOCATION (zone/rack/block/shelf)
    const locPatterns = [
      { re: /zone[:\s-]*([A-F]\d{0,2})/i, prefix: 'Zone ' },
      { re: /rack[:\s-]*([A-Z]\d{0,3})/i, prefix: 'Rack ' },
      { re: /block[:\s-]*([A-Z\d]{1,4})/i, prefix: 'Block ' },
      { re: /shelf[:\s-]*([A-Z\d]{1,4})/i, prefix: 'Shelf ' },
      { re: /row[:\s-]*([A-Z\d]{1,4})/i, prefix: 'Row ' },
    ];
    for (const lp of locPatterns) {
      const m = line.match(lp.re);
      if (m) { result.location = lp.prefix + m[1].toUpperCase(); break; }
    }

    // 4. Identify BRAND (longest match first)
    for (const bp of BRAND_PATTERNS) {
      let matched = false;
      for (const pat of bp.p) {
        if (lower.includes(pat)) {
          result.brand = bp.brand;
          result.category = bp.cat;
          result.confidence = 'high';
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    // 5. If brand not found, detect CATEGORY from keywords
    if (!result.brand) {
      for (const ck of CAT_KEYWORDS) {
        if (ck.kw.some(kw => lower.includes(kw))) {
          result.category = ck.cat;
          result.confidence = 'medium';
          break;
        }
      }
      // Extract brand-like text from the remaining string
      result.brand = _extractRemainingText(line, result.size, result.qty, result.location);
      if (!result.brand) result.brand = 'Unknown';
      if (!result.category) result.category = 'Unknown';
    }

    // 6. Infer size from category if still missing
    if (!result.size) {
      result.size = result.category === 'Beer' ? '650ml' : result.category === 'Whisky' && result.qty > 500 ? '180ml' : '750ml';
    }

    // 7. Match to REFERENCE data
    const ref = REF.findByBrandSize(result.brand, result.size) || REF.findByBrandSize(result.brand, null);
    if (ref) {
      result.suggestedZone = result.location ? result.location.replace('Zone ', '').replace('Rack ', '')[0] : ref.suggestedZone;
      result.suggestedZone = ref.suggestedZone; // Always recommend based on sales
      result.abcClass = ref.abcClass;
      result.velocity = ref.velocity;
      result.price = ref.price;
      result.avgMonthlySales = ref.avgMonthlySales;
      result.stockMonths = parseFloat((result.qty / ref.avgMonthlySales).toFixed(1));
      result.storageNotes = ref.storageNotes;
      result.refId = ref.id;
      result.supplier = ref.supplier;
    } else {
      result.suggestedZone = DEFAULT_ZONES[result.category] || 'C';
    }

    // 8. Total value
    result.totalValue = result.price ? result.qty * result.price : null;

    return result;
  }

  // ─── Extract brand text after removing noise ──────────────────────────────
  function _extractRemainingText(line, size, qty, location) {
    let text = line;
    if (size) text = text.replace(new RegExp(size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
    text = text.replace(/\b\d{1,5}\s*(ml|l|bottles?|nos?|units?|pcs?|qty|cases?)\b/gi, ' ');
    text = text.replace(/\b(qty|quantity|nos?|units?|bottles?|pcs?|zone|rack|block|shelf|row)[:\s-]*[A-Z0-9]*\b/gi, ' ');
    text = text.replace(/\b\d+\b/g, ' ');
    text = text.replace(/[-,;:\[\]()/\\|_]/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    // Title-case
    return text
      ? text.split(' ').filter(w => w.length > 1)
             .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
             .join(' ')
      : null;
  }

  // ─── Validate & enrich a parsed array ────────────────────────────────────
  function validate(items) {
    const warnings = [];
    items.forEach((item, i) => {
      if (item.confidence === 'low')  warnings.push({ row: i + 1, msg: `Row ${i+1}: Brand "${item.brand}" not recognized. Please verify.` });
      if (item.qty <= 0)              warnings.push({ row: i + 1, msg: `Row ${i+1}: Quantity seems missing or zero.` });
      if (!item.refId)                warnings.push({ row: i + 1, msg: `Row ${i+1}: No reference data for "${item.brand} ${item.size}". Zone assigned by category default.` });
    });
    return warnings;
  }

  return { parseText, parseItem, validate, BRAND_PATTERNS, CAT_KEYWORDS };
})();
