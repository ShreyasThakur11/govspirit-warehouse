/**
 * GovSpirit Smart Column Mapper
 * Automatically maps unstructured CSV/Excel column headers to known inventory fields.
 * Uses multi-strategy scoring: exact, prefix, contains, and Levenshtein fuzzy match.
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.SmartMapper = (function () {

  // ─── Field Definitions ─────────────────────────────────────────────────────
  // All known column name variants for each logical field.
  // Order matters — more specific patterns first.

  const FIELDS = [
    {
      id: 'brand', label: 'Brand / Product Name', required: true, icon: '🏷️',
      desc: 'What is the item called?',
      variants: [
        'brand','brand_name','brandname','product','product_name','productname',
        'item','item_name','itemname','item description','description','desc',
        'name','sku_name','skuname','spirit','liquor','alcohol','drink','beverage',
        'goods','material','article','commodity','whisky','rum','beer','wine',
        'product description','stock item','item description','liquor name','brand item',
        'brand/item','brand item name','product/brand','alcohol name','stock name',
      ]
    },
    {
      id: 'quantity', label: 'Quantity / Stock', required: true, icon: '🔢',
      desc: 'How many bottles?',
      variants: [
        'qty','quantity','bottles','units','nos','no of bottles','no. of bottles',
        'stock','inventory','count','available','in_stock','total','amount',
        'closing_stock','closing stock','opening_stock','opening stock',
        'bal','balance','on_hand','on hand','available_qty','available qty',
        'quantity_bottles','quantity bottles','total bottles','total quantity',
        'physical qty','book qty','system qty','stock qty','actual qty',
        'qty in hand','qty on hand','no of pieces','pcs','pieces',
      ]
    },
    {
      id: 'size', label: 'Bottle Size (ml)', required: false, icon: '📏',
      desc: 'e.g. 180ml, 750ml, 1L',
      variants: [
        'size','volume','ml','bottle_size','bottlesize','pack_size','packsize',
        'variant','pack','capacity','ltr','litre','liter','milliliter','millilitre',
        'pack type','package size','size ml','pack ml','volume ml','bottle volume',
        'bottle size (ml)','size (ml)','volume (ml)','mrp pack','pack variant',
      ]
    },
    {
      id: 'category', label: 'Category / Type', required: false, icon: '📂',
      desc: 'Whisky, Beer, Rum, etc.',
      variants: [
        'category','type','category_name','alcohol_type','alcoholtype','kind','group',
        'segment','class','classification','product_type','producttype','product category',
        'spirit_type','spirittype','liquor_type','liquortype','item type','item category',
        'product group','drink type','beverage type','type of liquor','liquor category',
      ]
    },
    {
      id: 'zone', label: 'Storage Zone', required: false, icon: '🗺️',
      desc: 'e.g. Zone A, Godown 1',
      variants: [
        'zone','location','area','bay','section','storage_zone','storagezone',
        'warehouse_zone','warehousezone','storage location','storage area','bin',
        'store','compartment','godown','block','floor','level','wing','unit',
        'storage block','warehouse area','storage section','shelf location',
      ]
    },
    {
      id: 'rack', label: 'Rack / Shelf', required: false, icon: '📦',
      desc: 'e.g. Rack A1, Shelf 3',
      variants: [
        'rack','rack_id','rackid','rack_no','rackno','shelf','rack number',
        'bin_id','binid','row','aisle','position','slot','bay','rack name',
        'shelf no','shelf number','rack position','storage rack','bin no',
      ]
    },
    {
      id: 'price', label: 'Price per Bottle (₹)', required: false, icon: '₹',
      desc: 'MRP or rate per bottle',
      variants: [
        'price','rate','mrp','price_per_bottle','priceperbot','unit_price','unitprice',
        'cost','value','selling_price','sellingprice','retail_price','retailprice',
        'sp','per_unit_price','bottle_price','amt','amount_per_unit','rs','rupees',
        'unit rate','bottle rate','mrp per bottle','price per unit','unit cost',
        'bottle cost','per bottle rate','per bottle price','excise price',
      ]
    },
    {
      id: 'supplier', label: 'Supplier / Vendor', required: false, icon: '🏭',
      desc: 'Who supplied this item?',
      variants: [
        'supplier','vendor','manufacturer','brand_company','brandcompany','company',
        'firm','party','distributor','agency','source','origin','maker','importer',
        'party name','vendor name','supplier name','distillery','brewery','winery',
      ]
    },
    {
      id: 'received_date', label: 'Date Received', required: false, icon: '📅',
      desc: 'When was stock received?',
      variants: [
        'date','received_date','receiveddate','receipt_date','receiptdate','entry_date',
        'entrydate','purchase_date','purchasedate','in_date','indate','arrival_date',
        'arrivaldate','grn_date','grndate','stock_date','stockdate','po_date','podate',
        'receiving_date','dated','stock received date','grn date','receipt date',
        'date of receipt','date received','date of entry','posting date',
      ]
    },
    {
      id: 'sku_id', label: 'SKU / Item Code', required: false, icon: '#️⃣',
      desc: 'Unique product identifier',
      variants: [
        'sku','sku_id','skuid','item_code','itemcode','product_code','productcode',
        'code','barcode','id','material_code','materialcode','material_no','materialno',
        'article','product_id','productid','item_no','itemno','ref_no','refno',
        'ref','sap_code','sapcode','erp_code','part_no','part number','stock_code',
      ]
    },
    {
      id: 'total_value', label: 'Total Value (₹)', required: false, icon: '💰',
      desc: 'Total value of stock',
      variants: [
        'total_value','totalvalue','total value','value','stock_value','stockvalue',
        'inventory_value','inventoryvalue','total_amount','totalamount','total amount',
        'amount','total cost','stock cost','total stock value','closing value',
      ]
    },
  ];

  // ─── Internal Helpers ─────────────────────────────────────────────────────

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[\s_\-\.\/\\()\[\]{}#@!?,;:'"]+/g, '').trim();
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const dp = [];
    for (let i = 0; i <= m; i++) { dp[i] = [i]; }
    for (let j = 0; j <= n; j++) { dp[0][j] = j; }
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }

  /**
   * Score how well a column header matches a field's variant list.
   * Returns 0.0 – 1.0
   */
  function scoreMatch(header, variants) {
    const h = norm(header);
    if (!h) return 0;

    // 1. Exact match → 1.0
    if (variants.some(v => norm(v) === h)) return 1.0;

    // 2. Starts with or contains (full word) → 0.85
    if (variants.some(v => { const nv = norm(v); return h.startsWith(nv) || nv.startsWith(h); })) return 0.85;

    // 3. Contains → 0.7
    if (variants.some(v => { const nv = norm(v); return h.includes(nv) || nv.includes(h); })) return 0.7;

    // 4. Fuzzy Levenshtein → scaled 0–0.55
    let best = 0;
    for (const v of variants) {
      const nv = norm(v);
      const maxLen = Math.max(h.length, nv.length);
      if (maxLen < 3) continue;
      const sim = 1 - levenshtein(h, nv) / maxLen;
      if (sim > best) best = sim;
    }
    return best > 0.62 ? best * 0.55 : 0;
  }

  // ─── Main: Auto-map columns ────────────────────────────────────────────────

  /**
   * Given an array of column headers, return the best field mapping.
   * @param {string[]} headers
   * @returns {Object} { [header]: { fieldId, fieldLabel, score, confidence, auto } }
   */
  function autoMap(headers) {
    // Score every header × every field
    const allScores = headers.map(h => ({
      header: h,
      scores: FIELDS.map(f => ({ fieldId: f.id, score: scoreMatch(h, f.variants) }))
                    .sort((a, b) => b.score - a.score),
    }));

    // Greedy best-match assignment (highest score wins, no field reused)
    const assigned = {}; // fieldId → header
    const result = {};   // header → mapping

    // Sort headers by their top score desc so best matches get priority
    const sorted = [...allScores].sort((a, b) => b.scores[0].score - a.scores[0].score);

    for (const { header, scores } of sorted) {
      let matched = false;
      for (const { fieldId, score } of scores) {
        if (score < 0.25) break; // below noise floor
        if (!assigned[fieldId]) {
          assigned[fieldId] = header;
          result[header] = {
            fieldId,
            fieldLabel: FIELDS.find(f => f.id === fieldId)?.label || fieldId,
            score,
            confidence: score >= 0.85 ? 'high' : score >= 0.55 ? 'medium' : 'low',
            auto: score >= 0.55,
          };
          matched = true;
          break;
        }
      }
      if (!matched) {
        result[header] = { fieldId: '__skip__', fieldLabel: 'Skip', score: 0, confidence: 'none', auto: true };
      }
    }

    return result;
  }

  /**
   * Apply a mapping (possibly user-edited) to convert raw rows → structured rows.
   * @param {Object[]} rawRows - original rows from file
   * @param {Object} mapping - { [header]: { fieldId } }
   * @returns {Object[]} structured rows with known field names
   */
  function applyMapping(rawRows, mapping) {
    return rawRows
      .map(row => {
        const out = {};
        for (const [header, { fieldId }] of Object.entries(mapping)) {
          if (fieldId && fieldId !== '__skip__') {
            const val = row[header];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              out[fieldId] = val;
            }
          }
        }
        return out;
      })
      .filter(row => Object.keys(row).length > 1); // skip nearly-empty rows
  }

  /**
   * Detect whether a column likely contains numeric data.
   * @param {Object[]} rows
   * @param {string} header
   */
  function isNumericColumn(rows, header) {
    const sample = rows.slice(0, 20).map(r => r[header]).filter(v => v !== null && v !== '');
    if (!sample.length) return false;
    const numCount = sample.filter(v => !isNaN(parseFloat(String(v)))).length;
    return numCount / sample.length >= 0.7;
  }

  /**
   * Get unique values from a column (for category detection).
   */
  function getColumnSample(rows, header, maxItems = 5) {
    const vals = [...new Set(rows.slice(0, 50).map(r => r[header]).filter(Boolean))];
    return vals.slice(0, maxItems);
  }

  return { FIELDS, autoMap, applyMapping, scoreMatch, isNumericColumn, getColumnSample };
})();
