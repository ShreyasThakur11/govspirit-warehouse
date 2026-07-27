/**
 * GovSpirit free-text inventory list parser.
 *
 * Turns lines a storekeeper would actually type
 *
 *     Royal Stag 180ml 200 bottles Zone A
 *     imp blue 60ml - 500 nos rack A2
 *     kingfisher 650 300
 *
 * into structured rows, then enriches them from the reference dataset.
 */
(function initListParser(GovSpirit) {
  'use strict';

  const { ReferenceData } = GovSpirit.require('ReferenceData');

  /**
   * Brand aliases. Order matters: longer and more specific patterns must come
   * first so "mcdowell's celebration" is not swallowed by "mcdowells".
   */
  const BRAND_PATTERNS = Object.freeze([
    // Whisky
    {
      patterns: ['blenders pride', "blender's pride", 'blendr pride'],
      brand: 'Blenders Pride',
      category: 'Whisky',
    },
    { patterns: ['antiquity blue', 'antiquity'], brand: 'Antiquity Blue', category: 'Whisky' },
    { patterns: ['royal challenge'], brand: 'Royal Challenge', category: 'Whisky' },
    { patterns: ['royal stag', 'royalstag', 'r stag'], brand: 'Royal Stag', category: 'Whisky' },
    {
      patterns: ['imperial blue', 'imp blue', 'imperial bl', 'impblue'],
      brand: 'Imperial Blue',
      category: 'Whisky',
    },
    {
      patterns: ["director's special", 'directors special', 'director special', 'dir special'],
      brand: "Director's Special",
      category: 'Whisky',
    },
    {
      patterns: [
        "mcdowell's celebration",
        'mcdowells celebration',
        'mc celebration',
        'celebration rum',
      ],
      brand: "McDowell's Celebration",
      category: 'Rum',
    },
    {
      patterns: [
        "mcdowell's no.1",
        'mcdowells no.1',
        'mcdowell no1',
        'mc dowell no 1',
        'mcno1',
        'mcdowells',
      ],
      brand: "McDowell's No.1",
      category: 'Whisky',
    },
    { patterns: ['8 pm', '8pm', 'eight pm'], brand: '8PM', category: 'Whisky' },
    { patterns: ['signature'], brand: 'Signature', category: 'Whisky' },
    {
      patterns: ['johnnie walker red', 'johnnie walker', 'johnie walker', 'jw red'],
      brand: 'Johnnie Walker Red',
      category: 'Whisky',
    },
    { patterns: ['chivas regal', 'chivas'], brand: 'Chivas Regal 12Y', category: 'Whisky' },
    {
      patterns: ["jack daniel's", 'jack daniels', 'jack daniel'],
      brand: "Jack Daniel's",
      category: 'Whisky',
    },
    { patterns: ['100 pipers', 'hundred pipers'], brand: '100 Pipers', category: 'Whisky' },
    // Rum
    { patterns: ['old monk', 'oldmonk'], brand: 'Old Monk', category: 'Rum' },
    { patterns: ['bacardi'], brand: 'Bacardi', category: 'Rum' },
    // Beer
    {
      patterns: ['kingfisher premium', 'king fisher', 'kingfisher', 'kfb'],
      brand: 'Kingfisher',
      category: 'Beer',
    },
    {
      patterns: ['haywards 5000', 'haywards5000', 'hayward 5000', 'haywards', 'hw5000'],
      brand: 'Haywards 5000',
      category: 'Beer',
    },
    { patterns: ['carlsberg'], brand: 'Carlsberg', category: 'Beer' },
    { patterns: ['budweiser'], brand: 'Budweiser', category: 'Beer' },
    // Vodka
    { patterns: ['absolut', 'absolute vodka'], brand: 'Absolut', category: 'Vodka' },
    { patterns: ['smirnoff'], brand: 'Smirnoff', category: 'Vodka' },
    { patterns: ['magic moments', 'magic moment'], brand: 'Magic Moments', category: 'Vodka' },
    // Wine
    { patterns: ['sula white', 'sula sauvignon'], brand: 'Sula White', category: 'Wine' },
    { patterns: ['sula red', 'sula shiraz', 'sula'], brand: 'Sula Red', category: 'Wine' },
    { patterns: ['grover zampa', 'grover'], brand: 'Grover Zampa', category: 'Wine' },
    // Gin
    {
      patterns: ["gordon's gin", 'gordons gin', 'gordons'],
      brand: "Gordon's Gin",
      category: 'Gin',
    },
    { patterns: ['beefeater'], brand: 'Beefeater Gin', category: 'Gin' },
    { patterns: ['greater than'], brand: 'Greater Than Gin', category: 'Gin' },
    // Brandy
    {
      patterns: ['honey bee brandy', 'honey bee', 'honeybee'],
      brand: 'Honey Bee Brandy',
      category: 'Brandy',
    },
    { patterns: ['morpheus'], brand: 'Morpheus Brandy', category: 'Brandy' },
  ]);

  const CATEGORY_KEYWORDS = Object.freeze([
    { keywords: ['whisky', 'whiskey', 'scotch', 'bourbon'], category: 'Whisky' },
    { keywords: ['rum'], category: 'Rum' },
    { keywords: ['beer', 'lager', 'ale', 'stout', 'pilsner'], category: 'Beer' },
    {
      keywords: ['wine', 'merlot', 'chardonnay', 'cabernet', 'shiraz', 'sauvignon'],
      category: 'Wine',
    },
    { keywords: ['vodka'], category: 'Vodka' },
    { keywords: ['gin'], category: 'Gin' },
    { keywords: ['brandy', 'cognac'], category: 'Brandy' },
  ]);

  const SIZE_RE = /(\d+(?:\.\d+)?)\s*(ml|l|ltr|litre|liter)\b/i;

  const QUANTITY_PATTERNS = [
    /(?:qty|quantity|nos?|units?|bottles?|pcs?|pieces?|cases?)\s*[:\-=]?\s*(\d{1,6})/i,
    /(\d{1,6})\s*(?:qty|quantity|nos?|units?|bottles?|pcs?|pieces?|cases?)\b/i,
    /[-–:]\s*(\d{1,6})(?!\s*(?:ml|l)\b)/i,
    /[×x]\s*(\d{1,6})\b/i,
  ];

  const LOCATION_PATTERNS = [
    { re: /zone[:\s-]*([a-f]\d{0,2})/i, prefix: 'Zone ' },
    { re: /rack[:\s-]*([a-z]\d{0,3})/i, prefix: 'Rack ' },
    { re: /block[:\s-]*([a-z\d]{1,4})/i, prefix: 'Block ' },
    { re: /shelf[:\s-]*([a-z\d]{1,4})/i, prefix: 'Shelf ' },
    { re: /row[:\s-]*([a-z\d]{1,4})/i, prefix: 'Row ' },
    { re: /bin[:\s-]*([a-z\d-]{1,8})/i, prefix: 'Bin ' },
  ];

  const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** Normalise any recognised volume expression to millilitres. */
  function normaliseSize(rawNumber, rawUnit) {
    const value = Number.parseFloat(rawNumber);
    if (!Number.isFinite(value) || value <= 0) return null;
    const unit = String(rawUnit).toLowerCase();
    const millilitres = unit.startsWith('l') ? Math.round(value * 1000) : Math.round(value);
    return `${millilitres}ml`;
  }

  /** Strip the recognised tokens and title-case whatever is left as the brand. */
  function extractBrandText(line, sizeMatch) {
    let text = line;
    if (sizeMatch) text = text.replace(new RegExp(escapeRegExp(sizeMatch[0]), 'gi'), ' ');
    text = text
      .replace(
        /\b\d{1,6}\s*(ml|l|ltr|litre|liter|bottles?|nos?|units?|pcs?|pieces?|qty|cases?)\b/gi,
        ' '
      )
      .replace(
        /\b(qty|quantity|nos?|units?|bottles?|pcs?|zone|rack|block|shelf|row|bin)[:\s-]*[a-z0-9-]*\b/gi,
        ' '
      )
      .replace(/\b\d+\b/g, ' ')
      .replace(/[-,;:[\]()/\\|_×]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return null;
    return text
      .split(' ')
      .filter((word) => word.length > 1)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Parse a single line.
   * @param {string} line
   * @param {number} index
   */
  function parseItem(line, index = 0) {
    const lower = line.toLowerCase();

    const item = {
      id: `ITEM-${String(index + 1).padStart(3, '0')}`,
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
      storageNotes: 'No reference match. Defaulting to Zone C.',
      refId: null,
      supplier: null,
      totalValue: null,
    };

    // 1. Size
    const sizeMatch = SIZE_RE.exec(line);
    if (sizeMatch) item.size = normaliseSize(sizeMatch[1], sizeMatch[2]);

    // 2. Quantity
    for (const pattern of QUANTITY_PATTERNS) {
      const match = pattern.exec(line);
      if (match) {
        item.qty = Number.parseInt(match[1], 10);
        break;
      }
    }
    if (!item.qty) {
      // Fall back to the first standalone number that is not the bottle size.
      const stripped = sizeMatch
        ? line.replace(new RegExp(escapeRegExp(sizeMatch[0]), 'i'), ' ')
        : line;
      const numberMatch = /\b(\d{1,6})\b/.exec(stripped);
      if (numberMatch) item.qty = Number.parseInt(numberMatch[1], 10);
    }
    if (!Number.isFinite(item.qty) || item.qty <= 0) item.qty = 1;

    // 3. Location
    for (const { re, prefix } of LOCATION_PATTERNS) {
      const match = re.exec(line);
      if (match) {
        item.location = prefix + match[1].toUpperCase();
        break;
      }
    }

    // 4. Brand
    for (const entry of BRAND_PATTERNS) {
      if (entry.patterns.some((pattern) => lower.includes(pattern))) {
        item.brand = entry.brand;
        item.category = entry.category;
        item.confidence = 'high';
        break;
      }
    }

    // 5. Category fallback
    if (!item.brand) {
      for (const entry of CATEGORY_KEYWORDS) {
        if (entry.keywords.some((keyword) => lower.includes(keyword))) {
          item.category = entry.category;
          item.confidence = 'medium';
          break;
        }
      }
      item.brand = extractBrandText(line, sizeMatch) || 'Unknown';
      if (!item.category) item.category = 'Unknown';
    }

    // 6. Size fallback by category
    if (!item.size) {
      item.size = item.category === 'Beer' ? '650ml' : '750ml';
    }

    // 7. Reference enrichment
    const reference = ReferenceData.findByBrandSize(item.brand, item.size);
    if (reference) {
      // The zone recommendation deliberately ignores where the item is stored
      // today: the whole point is to surface stock that is in the wrong place.
      item.suggestedZone = reference.suggestedZone;
      item.abcClass = reference.abcClass;
      item.velocity = reference.velocity;
      item.price = reference.price;
      item.avgMonthlySales = reference.avgMonthlySales;
      item.stockMonths = reference.avgMonthlySales
        ? Number((item.qty / reference.avgMonthlySales).toFixed(1))
        : null;
      item.storageNotes = reference.storageNotes;
      item.refId = reference.id;
      item.supplier = reference.supplier;
    } else {
      item.suggestedZone = ReferenceData.defaultZoneFor(item.category);
      item.storageNotes = `No reference match. Suggested Zone ${item.suggestedZone} by category.`;
    }

    item.totalValue = item.price ? item.qty * item.price : null;

    return item;
  }

  /**
   * Parse a multi-line block. Falls back to comma or semicolon separation when
   * the whole list was pasted onto one line.
   * @param {string} text
   */
  function parseText(text) {
    if (!text || !text.trim()) return [];

    let lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 1);

    if (lines.length <= 1) {
      lines = text
        .split(/[,;]/)
        .map((line) => line.trim())
        .filter((line) => line.length > 1);
    }

    return lines.map(parseItem);
  }

  /** Human-readable warnings about rows that need a second look. */
  function validate(items) {
    const warnings = [];
    (items || []).forEach((item, i) => {
      const row = i + 1;
      if (item.confidence === 'low') {
        warnings.push({
          row,
          message: `Row ${row}: brand "${item.brand}" was not recognised. Please verify.`,
        });
      }
      if (!item.refId) {
        warnings.push({
          row,
          message: `Row ${row}: no reference sales data for "${item.brand} ${item.size}". Zone assigned by category default.`,
        });
      }
    });
    return warnings;
  }

  GovSpirit.ListParser = { parseText, parseItem, validate, BRAND_PATTERNS, CATEGORY_KEYWORDS };
})(window.GovSpirit);
