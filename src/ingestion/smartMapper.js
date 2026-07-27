/**
 * GovSpirit automatic column mapping.
 *
 * Government warehouse exports are wildly inconsistent: the same field appears
 * as "Qty", "No. of Bottles", "Closing Stock" or "BAL QTY" depending on which
 * clerk built the template. This module scores every incoming header against a
 * dictionary of known variants and proposes a mapping the operator can adjust.
 *
 * Scoring runs in four tiers so an exact match always beats a fuzzy one:
 *   1.00  exact match after normalisation
 *   0.85  one string is a prefix of the other
 *   0.70  one string contains the other
 *   ≤0.55 Levenshtein similarity above the noise floor
 */
(function initSmartMapper(GovSpirit) {
  'use strict';

  /** Canonical target fields, in the order they are offered in the UI. */
  const FIELDS = Object.freeze([
    {
      id: 'brand',
      label: 'Brand / Product Name',
      required: true,
      hint: 'What is the item called?',
      variants: [
        'brand',
        'brand_name',
        'brandname',
        'product',
        'product_name',
        'productname',
        'item',
        'item_name',
        'itemname',
        'item description',
        'description',
        'desc',
        'name',
        'sku_name',
        'skuname',
        'spirit',
        'liquor',
        'alcohol',
        'drink',
        'beverage',
        'goods',
        'material',
        'article',
        'commodity',
        'product description',
        'stock item',
        'liquor name',
        'brand item',
        'brand/item',
        'product/brand',
        'alcohol name',
        'stock name',
      ],
    },
    {
      id: 'quantity',
      label: 'Quantity / Stock',
      required: true,
      hint: 'How many bottles?',
      variants: [
        'qty',
        'quantity',
        'bottles',
        'units',
        'nos',
        'no of bottles',
        'no. of bottles',
        'stock',
        'inventory',
        'count',
        'available',
        'in_stock',
        'closing_stock',
        'closing stock',
        'opening_stock',
        'opening stock',
        'bal',
        'balance',
        'balance qty',
        'on_hand',
        'on hand',
        'available_qty',
        'available qty',
        'quantity_bottles',
        'total bottles',
        'total quantity',
        'physical qty',
        'book qty',
        'system qty',
        'stock qty',
        'actual qty',
        'qty in hand',
        'qty on hand',
        'no of pieces',
        'pcs',
        'pieces',
      ],
    },
    {
      id: 'size',
      label: 'Bottle Size',
      required: false,
      hint: 'e.g. 180ml, 750ml, 1L',
      variants: [
        'size',
        'volume',
        'ml',
        'bottle_size',
        'bottlesize',
        'pack_size',
        'packsize',
        'variant',
        'pack',
        'capacity',
        'ltr',
        'litre',
        'liter',
        'milliliter',
        'millilitre',
        'pack type',
        'package size',
        'size ml',
        'pack ml',
        'volume ml',
        'bottle volume',
        'bottle size (ml)',
        'size (ml)',
        'volume (ml)',
        'pack variant',
      ],
    },
    {
      id: 'category',
      label: 'Category / Type',
      required: false,
      hint: 'Whisky, Beer, Rum and so on',
      variants: [
        'category',
        'type',
        'category_name',
        'alcohol_type',
        'alcoholtype',
        'kind',
        'group',
        'segment',
        'class',
        'classification',
        'product_type',
        'producttype',
        'product category',
        'spirit_type',
        'liquor_type',
        'item type',
        'item category',
        'product group',
        'drink type',
        'beverage type',
        'type of liquor',
        'liquor category',
      ],
    },
    {
      id: 'zone',
      label: 'Storage Zone',
      required: false,
      hint: 'e.g. Zone A, Godown 1',
      variants: [
        'zone',
        'location',
        'area',
        'bay',
        'section',
        'storage_zone',
        'storagezone',
        'warehouse_zone',
        'storage location',
        'storage area',
        'store',
        'compartment',
        'godown',
        'block',
        'floor',
        'level',
        'wing',
        'storage block',
        'warehouse area',
        'storage section',
        'shelf location',
      ],
    },
    {
      id: 'rack',
      label: 'Rack / Shelf / Bin',
      required: false,
      hint: 'e.g. Rack A1, Shelf 3',
      variants: [
        'rack',
        'rack_id',
        'rackid',
        'rack_no',
        'rackno',
        'shelf',
        'rack number',
        'bin',
        'bin_id',
        'binid',
        'row',
        'aisle',
        'position',
        'slot',
        'rack name',
        'shelf no',
        'shelf number',
        'rack position',
        'storage rack',
        'bin no',
      ],
    },
    {
      id: 'price',
      label: 'Price per Bottle',
      required: false,
      hint: 'MRP or rate per bottle',
      variants: [
        'price',
        'rate',
        'mrp',
        'price_per_bottle',
        'unit_price',
        'unitprice',
        'cost',
        'selling_price',
        'retail_price',
        'sp',
        'per_unit_price',
        'bottle_price',
        'unit rate',
        'bottle rate',
        'mrp per bottle',
        'price per unit',
        'unit cost',
        'bottle cost',
        'per bottle rate',
        'per bottle price',
        'excise price',
        'issue price',
      ],
    },
    {
      id: 'total_value',
      label: 'Total Stock Value',
      required: false,
      hint: 'Value of the whole line',
      variants: [
        'total_value',
        'totalvalue',
        'total value',
        'value',
        'stock_value',
        'stockvalue',
        'inventory_value',
        'total_amount',
        'total amount',
        'amount',
        'total cost',
        'stock cost',
        'total stock value',
        'closing value',
        'line value',
      ],
    },
    {
      id: 'supplier',
      label: 'Supplier / Vendor',
      required: false,
      hint: 'Who supplied this item?',
      variants: [
        'supplier',
        'vendor',
        'manufacturer',
        'brand_company',
        'company',
        'firm',
        'party',
        'distributor',
        'agency',
        'source',
        'maker',
        'importer',
        'party name',
        'vendor name',
        'supplier name',
        'distillery',
        'brewery',
        'winery',
      ],
    },
    {
      id: 'received_date',
      label: 'Date Received',
      required: false,
      hint: 'When was the stock received?',
      variants: [
        'date',
        'received_date',
        'receipt_date',
        'entry_date',
        'purchase_date',
        'in_date',
        'arrival_date',
        'grn_date',
        'stock_date',
        'po_date',
        'receiving_date',
        'dated',
        'stock received date',
        'grn date',
        'receipt date',
        'date of receipt',
        'date received',
        'date of entry',
        'posting date',
      ],
    },
    {
      id: 'sku_id',
      label: 'SKU / Item Code',
      required: false,
      hint: 'Unique product identifier',
      variants: [
        'sku',
        'sku_id',
        'skuid',
        'item_code',
        'itemcode',
        'product_code',
        'productcode',
        'code',
        'barcode',
        'id',
        'material_code',
        'material_no',
        'product_id',
        'item_no',
        'itemno',
        'ref_no',
        'refno',
        'ref',
        'sap_code',
        'erp_code',
        'part_no',
        'part number',
        'stock_code',
        'brand code',
        'excise code',
      ],
    },
  ]);

  const FIELD_BY_ID = new Map(FIELDS.map((field) => [field.id, field]));
  const SKIP = '__skip__';

  /** Strip punctuation and whitespace so "No. of Bottles" ≈ "noofbottles". */
  function normalise(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\s_\-.,;:'"/\\()[\]{}#@!?]+/g, '');
  }

  /** Levenshtein distance with a single rolling row (O(min(m,n)) memory). */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      }
      previous = current;
    }
    return previous[b.length];
  }

  // Pre-normalise the dictionary once instead of on every comparison.
  const NORMALISED_VARIANTS = new Map(
    FIELDS.map((field) => [field.id, field.variants.map(normalise).filter(Boolean)])
  );

  /**
   * Score a header against one field's variants.
   * @returns {number} 0 to 1
   */
  function scoreMatch(header, fieldId) {
    const h = normalise(header);
    if (!h) return 0;

    const variants = NORMALISED_VARIANTS.get(fieldId) || [];
    if (variants.includes(h)) return 1;

    if (variants.some((v) => h.startsWith(v) || v.startsWith(h))) return 0.85;
    if (variants.some((v) => h.includes(v) || v.includes(h))) return 0.7;

    let best = 0;
    variants.forEach((v) => {
      const maxLength = Math.max(h.length, v.length);
      if (maxLength < 4) return; // two-letter tokens produce nonsense similarity
      const similarity = 1 - levenshtein(h, v) / maxLength;
      if (similarity > best) best = similarity;
    });

    return best > 0.62 ? best * 0.55 : 0;
  }

  const NOISE_FLOOR = 0.25;
  const AUTO_APPLY = 0.55;

  /**
   * Propose a mapping for a set of headers.
   *
   * Assignment is greedy on the globally best score, and each canonical field
   * can only be claimed once. A sheet with both "Qty" and "Closing Stock"
   * maps the stronger of the two and leaves the other for the operator.
   *
   * @param {string[]} headers
   * @returns {Record<string, {fieldId: string, fieldLabel: string, score: number, confidence: string, auto: boolean}>}
   */
  function autoMap(headers) {
    const candidates = [];
    (headers || []).forEach((header) => {
      FIELDS.forEach((field) => {
        const score = scoreMatch(header, field.id);
        if (score >= NOISE_FLOOR) candidates.push({ header, fieldId: field.id, score });
      });
    });

    candidates.sort((a, b) => b.score - a.score);

    const takenFields = new Set();
    const takenHeaders = new Set();
    const mapping = {};

    candidates.forEach(({ header, fieldId, score }) => {
      if (takenFields.has(fieldId) || takenHeaders.has(header)) return;
      takenFields.add(fieldId);
      takenHeaders.add(header);
      mapping[header] = {
        fieldId,
        fieldLabel: FIELD_BY_ID.get(fieldId).label,
        score,
        confidence: score >= 0.85 ? 'high' : score >= AUTO_APPLY ? 'medium' : 'low',
        auto: score >= AUTO_APPLY,
      };
    });

    (headers || []).forEach((header) => {
      if (!mapping[header]) {
        mapping[header] = {
          fieldId: SKIP,
          fieldLabel: 'Skip',
          score: 0,
          confidence: 'none',
          auto: true,
        };
      }
    });

    return mapping;
  }

  /**
   * Reassign one header, clearing whichever other header previously held that
   * field so a canonical field is never double-mapped.
   */
  function reassign(mapping, header, fieldId) {
    const next = { ...mapping };

    if (fieldId !== SKIP) {
      Object.keys(next).forEach((other) => {
        if (other !== header && next[other].fieldId === fieldId) {
          next[other] = {
            fieldId: SKIP,
            fieldLabel: 'Skip',
            score: 0,
            confidence: 'none',
            auto: false,
          };
        }
      });
    }

    next[header] = {
      fieldId,
      fieldLabel: FIELD_BY_ID.get(fieldId)?.label || 'Skip',
      score: next[header]?.score ?? 0,
      confidence: fieldId === SKIP ? 'none' : 'manual',
      auto: false,
    };

    return next;
  }

  /**
   * Project raw rows through a mapping.
   * Rows that end up with no mapped values at all are dropped.
   */
  function applyMapping(rows, mapping) {
    const pairs = Object.entries(mapping || {}).filter(([, m]) => m.fieldId && m.fieldId !== SKIP);
    if (pairs.length === 0) return [];

    const output = [];
    (rows || []).forEach((row) => {
      const mapped = {};
      let populated = 0;
      pairs.forEach(([header, { fieldId }]) => {
        const value = row?.[header];
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          mapped[fieldId] = value;
          populated += 1;
        }
      });
      if (populated > 0) output.push(mapped);
    });

    return output;
  }

  /** Which required fields are still unmapped. */
  function missingRequired(mapping) {
    const mapped = new Set(Object.values(mapping || {}).map((m) => m.fieldId));
    return FIELDS.filter((field) => field.required && !mapped.has(field.id)).map((f) => f.label);
  }

  /** A few example values, used to help the operator confirm a mapping. */
  function columnSample(rows, header, limit = 3) {
    const seen = new Set();
    for (const row of (rows || []).slice(0, 80)) {
      const value = row?.[header];
      if (value === null || value === undefined || String(value).trim() === '') continue;
      seen.add(String(value).trim().slice(0, 32));
      if (seen.size >= limit) break;
    }
    return [...seen];
  }

  GovSpirit.SmartMapper = {
    FIELDS,
    SKIP,
    autoMap,
    reassign,
    applyMapping,
    missingRequired,
    columnSample,
    scoreMatch,
  };
})(window.GovSpirit);
