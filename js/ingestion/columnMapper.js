/**
 * GovSpirit Column Mapper
 * Intelligent column mapping using Fuse.js fuzzy matching
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.ColumnMapper = (function () {
  const { Utils } = GovSpirit;

  // ─── Canonical Field Definitions ──────────────────────────────────────────

  const CANONICAL_FIELDS = {
    inventory: {
      sku_id:         { aliases: ['sku_id','sku','sku_code','item_code','material','product_id','barcode','article','item_no','product_code'], required: true },
      sku_name:       { aliases: ['sku_name','product_name','description','item_name','name','article_desc','material_desc','item_desc'], required: true },
      brand:          { aliases: ['brand','brand_name','manufacturer','make','label','trade_name'], required: false },
      category:       { aliases: ['category','type','product_type','item_type','class','group','segment'], required: false },
      alcohol_type:   { aliases: ['alcohol_type','spirit_type','liquor_type','beverage_type','product_class'], required: false },
      bottle_size:    { aliases: ['bottle_size','size','volume','pack_size','unit_size','capacity','bottle_volume'], required: false },
      supplier:       { aliases: ['supplier','vendor','vendor_name','supplier_name','manufacturer_name'], required: false },
      quantity_bottles: { aliases: ['quantity_bottles','qty','quantity','stock_qty','on_hand','current_stock','bottles','units','balance_qty'], required: true },
      quantity_cases: { aliases: ['quantity_cases','cases','case_qty','qty_cases','no_of_cases'], required: false },
      unit_price:     { aliases: ['unit_price','price','cost','rate','selling_price','mrp','unit_cost','price_per_unit'], required: false },
      total_value:    { aliases: ['total_value','value','stock_value','inventory_value','amount','total_amount'], required: false },
      zone:           { aliases: ['zone','area','warehouse_zone','storage_zone','section'], required: false },
      rack_id:        { aliases: ['rack_id','rack','rack_no','rack_code','shelf','shelf_no','row'], required: false },
      bin_id:         { aliases: ['bin_id','bin','bin_no','bin_code','slot','location_id','storage_bin'], required: false },
      last_received_date: { aliases: ['last_received_date','received_date','receipt_date','date_received','last_receipt','grn_date'], required: false },
      last_dispatched_date: { aliases: ['last_dispatched_date','dispatch_date','last_issue','last_movement','last_out'], required: false },
      days_in_stock:  { aliases: ['days_in_stock','age','stock_age','days_old','aging_days','dwell_time'], required: false },
      lot_number:     { aliases: ['lot_number','lot','lot_no','batch','batch_no','batch_number','lot_id'], required: false },
      expiry_date:    { aliases: ['expiry_date','expiry','exp_date','best_before','expiration'], required: false },
      condition:      { aliases: ['condition','status','item_condition','quality','state'], required: false },
    },
    orders: {
      order_id:       { aliases: ['order_id','order_no','order_number','ref_no','reference','req_no'], required: true },
      hotel_name:     { aliases: ['hotel_name','hotel','customer','customer_name','outlet','client','destination'], required: true },
      order_date:     { aliases: ['order_date','date','request_date','requisition_date','created_date'], required: true },
      sku_id:         { aliases: ['sku_id','sku','item_code','product_id','material','article'], required: true },
      sku_name:       { aliases: ['sku_name','product_name','description','item_name','name'], required: false },
      quantity_ordered: { aliases: ['quantity_ordered','qty_ordered','ordered_qty','quantity','qty','requested_qty'], required: true },
      quantity_fulfilled: { aliases: ['quantity_fulfilled','qty_fulfilled','fulfilled_qty','dispatched_qty','issued_qty'], required: false },
      status:         { aliases: ['status','order_status','fulfillment_status','state'], required: false },
      delivery_date:  { aliases: ['delivery_date','delivered_date','dispatch_date','fulfillment_date'], required: false },
      unit_price:     { aliases: ['unit_price','price','rate','unit_cost'], required: false },
      brand:          { aliases: ['brand','brand_name'], required: false },
      category:       { aliases: ['category','type','product_type'], required: false },
    },
    dispatch: {
      dispatch_id:    { aliases: ['dispatch_id','dispatch_no','delivery_id','challan_no','voucher_no'], required: true },
      order_id:       { aliases: ['order_id','order_no','reference','ref_no'], required: false },
      dispatch_date:  { aliases: ['dispatch_date','date','delivery_date','challan_date','issue_date'], required: true },
      hotel_name:     { aliases: ['hotel_name','hotel','customer','customer_name','destination'], required: false },
      sku_id:         { aliases: ['sku_id','sku','item_code','material','product_id'], required: false },
      quantity_dispatched: { aliases: ['quantity_dispatched','qty_dispatched','dispatched_qty','quantity','qty','issued_qty'], required: true },
      vehicle:        { aliases: ['vehicle','vehicle_no','truck','vehicle_number','registration_no'], required: false },
      driver:         { aliases: ['driver','driver_name','driver_id'], required: false },
      dispatch_time_minutes: { aliases: ['dispatch_time_minutes','time_taken','lead_time','processing_time'], required: false },
    },
    warehouseLayout: {
      zone:     { aliases: ['zone','area','section','warehouse_area','storage_zone'], required: true },
      rack_id:  { aliases: ['rack_id','rack','rack_no','rack_code','aisle'], required: true },
      bin_id:   { aliases: ['bin_id','bin','bin_no','slot','location'], required: true },
      capacity: { aliases: ['capacity','max_capacity','total_capacity','bin_capacity','slots'], required: false },
      current_qty: { aliases: ['current_qty','qty','quantity','occupied','current_stock'], required: false },
      is_blocked:  { aliases: ['is_blocked','blocked','out_of_service','damaged','disabled'], required: false },
    },
    employees: {
      employee_id:   { aliases: ['employee_id','emp_id','staff_id','id'], required: false },
      employee_name: { aliases: ['employee_name','name','emp_name','staff_name','worker_name'], required: true },
      role:          { aliases: ['role','designation','position','job_title','department'], required: false },
      shift:         { aliases: ['shift','shift_name','schedule','work_shift'], required: false },
      picks_per_hour:{ aliases: ['picks_per_hour','productivity','pick_rate','efficiency'], required: false },
    },
  };

  // ─── Fuzzy Mapper ─────────────────────────────────────────────────────────

  function mapColumns(fileType, sourceColumns) {
    const canonicalDef = CANONICAL_FIELDS[fileType];
    if (!canonicalDef) {
      // Unknown file type: map all columns as-is
      return { mappings: {}, unmapped: sourceColumns, confidence: {} };
    }

    const mappings = {};     // canonical -> source column
    const confidence = {};   // canonical -> score 0-100
    const usedSourceCols = new Set();

    Object.entries(canonicalDef).forEach(([canonical, def]) => {
      let bestMatch = null, bestScore = 0;
      const aliases = def.aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, '_'));

      sourceColumns.forEach(srcCol => {
        const src = srcCol.toLowerCase().replace(/[^a-z0-9]/g, '_');
        // Exact match
        if (aliases.includes(src)) {
          const score = 100;
          if (score > bestScore && !usedSourceCols.has(srcCol)) { bestScore = score; bestMatch = srcCol; }
          return;
        }
        // Contains match
        aliases.forEach(alias => {
          const containsScore = src.includes(alias) || alias.includes(src) ? 75 : 0;
          const simScore = Utils.similarity(src, alias) * 70;
          const score = Math.max(containsScore, simScore);
          if (score > bestScore && !usedSourceCols.has(srcCol)) { bestScore = score; bestMatch = srcCol; }
        });
      });

      if (bestMatch && bestScore >= 45) {
        mappings[canonical] = bestMatch;
        confidence[canonical] = Math.round(bestScore);
        usedSourceCols.add(bestMatch);
      } else {
        mappings[canonical] = null;
        confidence[canonical] = 0;
      }
    });

    const unmapped = sourceColumns.filter(c => !usedSourceCols.has(c));
    return { mappings, confidence, unmapped, definition: canonicalDef };
  }

  // ─── Apply Mappings to Data ───────────────────────────────────────────────

  function applyMappings(data, mappings) {
    return data.map(row => {
      const mapped = {};
      Object.entries(mappings).forEach(([canonical, source]) => {
        if (source) mapped[canonical] = row[source] !== undefined ? row[source] : null;
        else mapped[canonical] = null;
      });
      // Preserve unmapped columns with prefix
      Object.keys(row).forEach(k => {
        const isUsed = Object.values(mappings).includes(k);
        if (!isUsed) mapped['_raw_' + k] = row[k];
      });
      return mapped;
    });
  }

  // ─── Get Unmapped Required Fields ────────────────────────────────────────

  function getMissingRequiredFields(fileType, mappings) {
    const def = CANONICAL_FIELDS[fileType];
    if (!def) return [];
    return Object.entries(def)
      .filter(([k, v]) => v.required && (!mappings[k] || mappings[k] === null))
      .map(([k]) => k);
  }

  // ─── Build Mapping Wizard HTML ────────────────────────────────────────────

  function buildMappingWizardHTML(fileType, sourceColumns, mappings, confidence) {
    const def = CANONICAL_FIELDS[fileType] || {};
    const rows = Object.entries(def).map(([canonical, fieldDef]) => {
      const mapped = mappings[canonical];
      const conf = confidence[canonical] || 0;
      const confClass = conf >= 80 ? 'conf-high' : conf >= 50 ? 'conf-med' : 'conf-low';
      const confLabel = conf >= 80 ? '✓ High' : conf >= 50 ? '~ Medium' : '✗ Low';
      const isRequired = fieldDef.required;

      const options = ['<option value="">-- Not mapped --</option>',
        ...sourceColumns.map(col =>
          `<option value="${col}" ${col === mapped ? 'selected' : ''}>${col}</option>`)
      ].join('');

      return `
        <tr class="mapping-row ${conf === 0 && isRequired ? 'mapping-row-missing' : ''}">
          <td><span class="canonical-field ${isRequired ? 'field-required' : ''}">${canonical}</span></td>
          <td>
            <select class="mapping-select" data-canonical="${canonical}" data-filetype="${fileType}">
              ${options}
            </select>
          </td>
          <td><span class="conf-badge ${confClass}">${confLabel} (${conf}%)</span></td>
          <td class="field-hint">${fieldDef.aliases.slice(0, 3).join(', ')}</td>
        </tr>`;
    }).join('');

    return `
      <div class="mapping-wizard-section">
        <h4>Column Mapping — ${fileType}</h4>
        <p class="mapping-hint">Review and adjust the auto-detected column mappings below. Fields marked <span class="field-required">*</span> are required.</p>
        <div class="table-wrapper">
          <table class="data-table mapping-table">
            <thead><tr><th>Target Field</th><th>Source Column</th><th>Confidence</th><th>Common Names</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ─── Get Canonical Fields for Type ───────────────────────────────────────

  function getCanonicalFields(fileType) {
    return CANONICAL_FIELDS[fileType] || {};
  }

  function getSupportedFileTypes() {
    return Object.keys(CANONICAL_FIELDS);
  }

  return { mapColumns, applyMappings, getMissingRequiredFields, buildMappingWizardHTML, getCanonicalFields, getSupportedFileTypes, CANONICAL_FIELDS };
})();
