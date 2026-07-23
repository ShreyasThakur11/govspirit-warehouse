/**
 * GovSpirit Input Page — v2
 * PRIMARY: Upload any CSV/Excel → auto-structure → dashboard
 * SECONDARY: Paste a text list
 */
window.GovSpirit = window.GovSpirit || {};
GovSpirit.Pages = GovSpirit.Pages || {};

GovSpirit.Pages.input = (function () {
  const { Utils, Store, EventBus, Events, ListParser, SmartMapper,
          ReferenceData: REF, KPIEngine, ABCXYZEngine, AgingEngine,
          UtilizationEngine, RecommendationEngine } = GovSpirit;

  // ─── State ────────────────────────────────────────────────────────────────
  let activeTab = 'upload';
  let uploadState = {
    file: null, sheets: [], activeSheet: 0,
    mapping: {}, mappingLocked: false,
    structuredRows: [],
  };
  let parsedItems = []; // for paste tab

  // ─── EXAMPLE TEXT (paste tab) ─────────────────────────────────────────────
  const EXAMPLE_TEXT = `Royal Stag 180ml 200 bottles Zone A
Imperial Blue 60ml 500 nos rack A2
Kingfisher 650ml 300 units Zone A
Old Monk 750ml 80 bottles
Blenders Pride 750ml 50 Zone B
Haywards 5000 650ml 250 nos Zone A
McDowell's Celebration 180ml 120
Smirnoff 750ml 30 units Zone C
Sula Red wine 750ml 15
Honey Bee Brandy 180ml 90 nos Zone B
whisky 180ml qty 60
beer 330ml 100 bottles Zone A`;

  // ─── RENDER ──────────────────────────────────────────────────────────────
  function render() {
    return `
      <div class="input-page">

        <!-- Hero -->
        <div class="input-hero">
          <div class="hero-badge">🏛️ GovSpirit Warehouse Intelligence</div>
          <h1 class="hero-title">Turn Any Data Into a Dashboard</h1>
          <p class="hero-sub">Upload your CSV or Excel file — even if it's messy or unstructured — and GovSpirit will automatically detect columns, structure the data, and build a full analytics dashboard.</p>
        </div>

        <!-- Tabs -->
        <div class="input-tabs-bar">
          <button class="input-tab-btn active" id="tab-btn-upload" onclick="GovSpirit.Pages.input._switchTab('upload')">
            <span class="tab-icon">📁</span> Upload File <span class="tab-badge">Recommended</span>
          </button>
          <button class="input-tab-btn" id="tab-btn-paste" onclick="GovSpirit.Pages.input._switchTab('paste')">
            <span class="tab-icon">✏️</span> Paste List
          </button>
          <button class="input-tab-btn" id="tab-btn-demo" onclick="GovSpirit.Pages.input._loadDemo()">
            <span class="tab-icon">⚡</span> Demo Data
          </button>
        </div>

        <!-- ── UPLOAD TAB ── -->
        <div class="tab-pane" id="tab-pane-upload">

          <!-- Drop Zone -->
          <div class="drop-zone" id="drop-zone">
            <div class="drop-zone-inner">
              <div class="drop-icon">📂</div>
              <div class="drop-title">Drop your file here</div>
              <div class="drop-sub">or <label class="drop-browse" for="file-input">browse to upload</label></div>
              <input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display:none" multiple>
              <div class="drop-formats">
                <span class="drop-fmt">.xlsx</span>
                <span class="drop-fmt">.xls</span>
                <span class="drop-fmt">.csv</span>
              </div>
              <div class="drop-hint">Works with any column structure — messy headers, extra columns, merged cells, all fine.</div>
            </div>
          </div>

          <!-- File processing feedback -->
          <div id="upload-status" style="display:none"></div>

          <!-- Mapping Review (shown after file parsed) -->
          <div id="mapping-section" style="display:none">

            <!-- File summary bar -->
            <div class="file-summary-bar" id="file-summary-bar"></div>

            <!-- Sheet tabs (for multi-sheet Excel) -->
            <div class="sheet-tabs" id="sheet-tabs" style="display:none"></div>

            <!-- Auto-mapping table -->
            <div class="mapping-card">
              <div class="mapping-card-header">
                <div>
                  <div class="mapping-card-title">🔍 Auto-detected Column Mapping</div>
                  <div class="mapping-card-sub">Review and adjust how each column in your file maps to inventory fields. High-confidence mappings are auto-applied.</div>
                </div>
                <button class="btn btn-ghost btn-sm" id="btn-reset-mapping">↺ Reset</button>
              </div>
              <div id="mapping-table-container"></div>
            </div>

            <!-- Data Preview -->
            <div class="preview-card">
              <div class="preview-card-header">
                <div class="preview-card-title">👁️ Data Preview <span class="preview-badge" id="preview-count"></span></div>
                <div class="preview-card-sub">First 5 rows of your file after applying the column mapping above</div>
              </div>
              <div id="data-preview-container" class="table-wrapper"></div>
            </div>

            <!-- Structured Stats -->
            <div id="structured-stats"></div>

            <!-- Generate CTA -->
            <div class="generate-cta">
              <button class="btn btn-primary btn-xl" id="btn-generate-upload">
                📊 Generate Analytics Dashboard →
              </button>
              <div class="generate-hint" id="generate-hint-text">Ready to analyze your data</div>
            </div>
          </div>
        </div>

        <!-- ── PASTE TAB ── -->
        <div class="tab-pane" id="tab-pane-paste" style="display:none">
          <div class="input-grid">
            <!-- Left: Text Input -->
            <div class="input-card">
              <div class="input-card-header">
                <div class="input-card-title">✏️ Your Inventory List</div>
                <div class="input-card-actions">
                  <button class="btn btn-ghost btn-xs" id="btn-example">Try Example</button>
                  <button class="btn btn-ghost btn-xs" id="btn-clear-text">Clear</button>
                </div>
              </div>
              <textarea id="list-input" class="list-textarea"
                placeholder="One item per line. Examples:&#10;&#10;Royal Stag 180ml 200 bottles Zone A&#10;Kingfisher beer 650ml 300 nos&#10;Old Monk 750ml 80 units, Rack B3&#10;whisky 100ml qty 60&#10;Smirnoff vodka 30 Zone C"
                spellcheck="false"></textarea>
              <div class="input-card-footer">
                <div class="fmt-hints">
                  <span class="fmt-hint">✓ Brand name</span>
                  <span class="fmt-hint">✓ Size (ml/L)</span>
                  <span class="fmt-hint">✓ Quantity</span>
                  <span class="fmt-hint">✓ Zone / Rack</span>
                </div>
                <button class="btn btn-primary btn-lg" id="btn-parse">⚡ Parse & Structure</button>
              </div>
            </div>
            <!-- Right: Info Panel -->
            <div class="input-info-panel">
              <div class="info-panel-section">
                <div class="info-section-title">📊 Recognized Brands</div>
                <div class="ref-stats">
                  ${REF.SKUs.slice(0, 8).map(s => `
                    <div class="ref-stat-pill">
                      <span class="ref-pill-abc ref-abc-${s.abcClass.toLowerCase()}">${s.abcClass}</span>
                      <span class="ref-pill-name">${s.brand}</span>
                      <span class="ref-pill-size">${s.size}</span>
                      <span class="ref-pill-vel">${Math.round(s.avgMonthlySales)}/mo</span>
                    </div>`).join('')}
                  <div class="ref-more">+${REF.SKUs.length - 8} more in reference database</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Paste Results -->
          <div id="parsed-section" style="display:none">
            <div class="parsed-header">
              <div>
                <div class="parsed-title" id="parsed-title"></div>
                <div class="parsed-subtitle" id="parsed-subtitle"></div>
              </div>
              <div class="parsed-actions">
                <button class="btn btn-ghost btn-sm" id="btn-edit-list">← Edit</button>
                <button class="btn btn-outline btn-sm" id="btn-export-parsed">⬇ CSV</button>
              </div>
            </div>
            <div id="parse-warnings"></div>
            <div class="parse-charts" id="parse-charts"></div>
            <div class="parsed-table-wrap"><div id="parsed-table-container"></div></div>
            <div class="storage-plan-section" id="storage-plan"></div>
            <div class="generate-cta">
              <button class="btn btn-primary btn-xl" id="btn-generate-dashboard">📊 Generate Full Analytics Dashboard →</button>
              <div class="generate-hint">Powered by 12-month reference sales data</div>
            </div>
          </div>
        </div>

      </div>`;
  }

  // ─── MOUNT ────────────────────────────────────────────────────────────────
  function mount() {
    _setupDropZone();
    _setupPasteTab();
  }

  // ─── TAB SWITCHING ────────────────────────────────────────────────────────
  function _switchTab(tab) {
    activeTab = tab;
    ['upload', 'paste'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const pane = document.getElementById(`tab-pane-${t}`);
      if (btn) btn.classList.toggle('active', t === tab);
      if (pane) pane.style.display = t === tab ? 'block' : 'none';
    });
  }

  // ─── DEMO DATA ───────────────────────────────────────────────────────────
  function _loadDemo() {
    const data = GovSpirit.DemoData.generate();
    Object.entries(data).forEach(([k, v]) => Store.setRawData(k, v));
    _runPipeline();
    GovSpirit.App.navigate('executive');
    GovSpirit.App.showToast('Demo dataset loaded — 200+ SKUs, 90 days of activity!', 'success');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  UPLOAD TAB
  // ═══════════════════════════════════════════════════════════════════════════

  function _setupDropZone() {
    const zone = document.getElementById('drop-zone');
    const input = document.getElementById('file-input');
    if (!zone || !input) return;

    // Drag events
    ['dragenter', 'dragover'].forEach(e => zone.addEventListener(e, ev => {
      ev.preventDefault(); zone.classList.add('drop-zone--active');
    }));
    ['dragleave', 'dragend', 'drop'].forEach(e => zone.addEventListener(e, () => {
      zone.classList.remove('drop-zone--active');
    }));
    zone.addEventListener('drop', ev => {
      ev.preventDefault();
      const files = [...ev.dataTransfer.files].filter(_isValidFile);
      if (files.length) _handleFiles(files);
      else GovSpirit.App.showToast('Please upload .xlsx, .xls, or .csv files only.', 'warning');
    });
    zone.addEventListener('click', (e) => {
      if (e.target.tagName !== 'LABEL') input.click();
    });
    input.addEventListener('change', () => {
      const files = [...input.files].filter(_isValidFile);
      if (files.length) _handleFiles(files);
    });
  }

  function _isValidFile(f) {
    return /\.(xlsx|xls|csv)$/i.test(f.name);
  }

  async function _handleFiles(files) {
    // Show loading state
    const zone = document.getElementById('drop-zone');
    const statusEl = document.getElementById('upload-status');
    if (zone) zone.style.display = 'none';
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = `
        <div class="upload-loading">
          <div class="upload-spinner"></div>
          <div class="upload-loading-text">Reading <strong>${files[0].name}</strong>…</div>
        </div>`;
    }

    try {
      const results = await GovSpirit.FileReader.processFiles(files, ({ file, status }) => {
        if (statusEl) {
          const msg = status === 'done' ? `✅ ${file} parsed` : status === 'error' ? `❌ ${file} failed` : `⏳ Reading ${file}…`;
          statusEl.innerHTML = `<div class="upload-loading"><div class="upload-spinner"></div><div class="upload-loading-text">${msg}</div></div>`;
        }
      });

      if (!results || !results.length) {
        throw new Error('No data found in file. Make sure the file has rows.');
      }

      uploadState.sheets = results;
      uploadState.activeSheet = 0;
      uploadState.file = files[0];

      if (statusEl) statusEl.style.display = 'none';
      _showMappingSection();

    } catch (err) {
      console.error('[Upload] File processing error:', err);
      if (statusEl) {
        statusEl.innerHTML = `
          <div class="upload-error">
            <div class="upload-error-icon">❌</div>
            <div class="upload-error-title">Could not read file</div>
            <div class="upload-error-msg">${err.message}</div>
            <button class="btn btn-outline btn-sm mt-2" onclick="document.getElementById('drop-zone').style.display='flex';document.getElementById('upload-status').style.display='none'">Try Again</button>
          </div>`;
      }
    }
  }

  // ─── SHOW MAPPING SECTION ────────────────────────────────────────────────
  function _showMappingSection() {
    const sheet = uploadState.sheets[uploadState.activeSheet];
    if (!sheet) return;

    // Run auto-mapper
    uploadState.mapping = SmartMapper.autoMap(sheet.columns);

    document.getElementById('mapping-section').style.display = 'block';

    _renderFileSummary(sheet);
    _renderSheetTabs();
    _renderMappingTable(sheet);
    _renderDataPreview(sheet);
    _renderStructuredStats(sheet);

    // Bind generate button
    document.getElementById('btn-generate-upload')?.addEventListener('click', _generateFromUpload);
    document.getElementById('btn-reset-mapping')?.addEventListener('click', () => {
      uploadState.mapping = SmartMapper.autoMap(sheet.columns);
      _renderMappingTable(sheet);
      _renderDataPreview(sheet);
    });

    document.getElementById('mapping-section').scrollIntoView({ behavior: 'smooth' });
  }

  // ─── FILE SUMMARY BAR ────────────────────────────────────────────────────
  function _renderFileSummary(sheet) {
    const el = document.getElementById('file-summary-bar');
    if (!el) return;
    const highConf = Object.values(uploadState.mapping).filter(m => m.confidence === 'high').length;
    const totalMapped = Object.values(uploadState.mapping).filter(m => m.fieldId && m.fieldId !== '__skip__').length;

    el.innerHTML = `
      <div class="file-summary">
        <div class="file-summary-info">
          <div class="file-summary-icon">📄</div>
          <div>
            <div class="file-summary-name">${sheet.filename}</div>
            <div class="file-summary-meta">${sheet.rowCount.toLocaleString()} rows · ${sheet.columns.length} columns · Sheet: ${sheet.sheetName}</div>
          </div>
        </div>
        <div class="file-summary-stats">
          <div class="file-stat">
            <div class="file-stat-val">${sheet.rowCount.toLocaleString()}</div>
            <div class="file-stat-lbl">Rows</div>
          </div>
          <div class="file-stat">
            <div class="file-stat-val">${totalMapped}</div>
            <div class="file-stat-lbl">Mapped</div>
          </div>
          <div class="file-stat">
            <div class="file-stat-val" style="color:var(--accent-emerald)">${highConf}</div>
            <div class="file-stat-lbl">Auto-detected</div>
          </div>
          <div class="file-stat">
            <div class="file-stat-val" style="color:var(--accent-amber)">${totalMapped - highConf}</div>
            <div class="file-stat-lbl">Review needed</div>
          </div>
        </div>
      </div>`;
  }

  // ─── SHEET TABS ──────────────────────────────────────────────────────────
  function _renderSheetTabs() {
    const el = document.getElementById('sheet-tabs');
    if (!el) return;
    if (uploadState.sheets.length <= 1) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = uploadState.sheets.map((s, i) => `
      <button class="sheet-tab ${i === uploadState.activeSheet ? 'active' : ''}"
              onclick="GovSpirit.Pages.input._switchSheet(${i})">
        ${s.sheetName} <span class="sheet-tab-count">${s.rowCount}</span>
      </button>`).join('');
  }

  function _switchSheet(idx) {
    uploadState.activeSheet = idx;
    const sheet = uploadState.sheets[idx];
    uploadState.mapping = SmartMapper.autoMap(sheet.columns);
    _renderFileSummary(sheet);
    _renderSheetTabs();
    _renderMappingTable(sheet);
    _renderDataPreview(sheet);
    _renderStructuredStats(sheet);
  }

  // ─── MAPPING TABLE ───────────────────────────────────────────────────────
  function _renderMappingTable(sheet) {
    const container = document.getElementById('mapping-table-container');
    if (!container) return;

    const fieldOptions = [
      '<option value="__skip__">— Skip this column —</option>',
      ...SmartMapper.FIELDS.map(f => `<option value="${f.id}">${f.icon} ${f.label}</option>`),
    ].join('');

    const rows = sheet.columns.map(header => {
      const m = uploadState.mapping[header] || { fieldId: '__skip__', confidence: 'none', score: 0 };
      const confClass = m.confidence === 'high' ? 'conf-high' : m.confidence === 'medium' ? 'conf-med' : m.confidence === 'low' ? 'conf-low' : 'conf-skip';
      const confLabel = m.confidence === 'high' ? '✅ Auto' : m.confidence === 'medium' ? '🟡 Review' : m.confidence === 'low' ? '🔴 Check' : '⬜ Skip';
      const sample = SmartMapper.getColumnSample(sheet.data, header, 3).join(', ');

      // Build select with correct selected option
      const selectHtml = `
        <select class="mapping-select" data-header="${header}" onchange="GovSpirit.Pages.input._updateMapping('${header}', this.value)">
          ${SmartMapper.FIELDS.map(f => `<option value="${f.id}" ${m.fieldId === f.id ? 'selected' : ''}>${f.icon} ${f.label}</option>`).join('')}
          <option value="__skip__" ${!m.fieldId || m.fieldId === '__skip__' ? 'selected' : ''}>— Skip —</option>
        </select>`;

      return `
        <tr class="mapping-row ${m.fieldId === '__skip__' ? 'mapping-row--skip' : ''}">
          <td class="mapping-col-header">
            <div class="mapping-col-name">${header}</div>
            <div class="mapping-col-sample">${sample || '—'}</div>
          </td>
          <td class="mapping-arrow">→</td>
          <td class="mapping-col-field">${selectHtml}</td>
          <td class="mapping-col-conf"><span class="conf-badge ${confClass}">${confLabel}</span></td>
          <td class="mapping-col-score">${m.score > 0 ? Math.round(m.score * 100) + '%' : '—'}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table mapping-table">
          <thead>
            <tr>
              <th>Your Column <span class="th-sub">/ Sample values</span></th>
              <th></th>
              <th>Maps To</th>
              <th>Confidence</th>
              <th>Match %</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function _updateMapping(header, newFieldId) {
    // Remove the new field from any existing assignment (avoid duplicates)
    if (newFieldId !== '__skip__') {
      for (const [h, m] of Object.entries(uploadState.mapping)) {
        if (h !== header && m.fieldId === newFieldId) {
          uploadState.mapping[h] = { ...m, fieldId: '__skip__', confidence: 'none', score: 0 };
        }
      }
    }
    const existing = uploadState.mapping[header] || {};
    uploadState.mapping[header] = { ...existing, fieldId: newFieldId, auto: false };

    const sheet = uploadState.sheets[uploadState.activeSheet];
    _renderMappingTable(sheet);
    _renderDataPreview(sheet);
    _renderStructuredStats(sheet);
  }

  // ─── DATA PREVIEW ────────────────────────────────────────────────────────
  function _renderDataPreview(sheet) {
    const container = document.getElementById('data-preview-container');
    const countEl = document.getElementById('preview-count');
    if (!container) return;

    // Get mapped fields (non-skip)
    const activeMappings = Object.entries(uploadState.mapping)
      .filter(([, m]) => m.fieldId && m.fieldId !== '__skip__')
      .map(([header, m]) => ({ header, ...m }));

    if (!activeMappings.length) {
      container.innerHTML = '<div class="empty-state">No columns mapped yet. Use the dropdowns above to map your columns.</div>';
      return;
    }

    const previewRows = sheet.data.slice(0, 5);
    if (countEl) countEl.textContent = `Showing 5 of ${sheet.rowCount.toLocaleString()} rows`;

    const headerHtml = activeMappings.map(m => `<th>${m.fieldLabel}</th>`).join('');
    const rowsHtml = previewRows.map(row => `
      <tr>${activeMappings.map(m => {
        const val = row[m.header];
        return `<td>${val !== null && val !== undefined && val !== '' ? String(val).slice(0, 40) : '<span class="text-muted">—</span>'}</td>`;
      }).join('')}</tr>`).join('');

    container.innerHTML = `
      <table class="data-table preview-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
  }

  // ─── STRUCTURED STATS ────────────────────────────────────────────────────
  function _renderStructuredStats(sheet) {
    const container = document.getElementById('structured-stats');
    if (!container) return;

    const mapped = Object.entries(uploadState.mapping).filter(([, m]) => m.fieldId && m.fieldId !== '__skip__');
    const hasBrand = mapped.some(([, m]) => m.fieldId === 'brand');
    const hasQty = mapped.some(([, m]) => m.fieldId === 'quantity');
    const hasPrice = mapped.some(([, m]) => m.fieldId === 'price');
    const hasZone = mapped.some(([, m]) => m.fieldId === 'zone');

    const readiness = [hasBrand, hasQty].filter(Boolean).length;
    const btn = document.getElementById('btn-generate-upload');
    const hint = document.getElementById('generate-hint-text');

    if (readiness < 2) {
      if (btn) btn.disabled = true;
      if (hint) hint.textContent = '⚠️ Map at least "Brand/Product Name" and "Quantity" columns to proceed';
    } else {
      if (btn) btn.disabled = false;
      const features = [
        hasBrand && '✅ Brand detection',
        hasQty && '✅ Quantity analysis',
        hasPrice && '✅ Value calculation',
        hasZone && '✅ Zone mapping',
        !hasZone && '🤖 Zones auto-assigned by AI',
      ].filter(Boolean);
      if (hint) hint.innerHTML = features.join(' &nbsp;·&nbsp; ');
    }

    container.innerHTML = `
      <div class="stats-readiness">
        <div class="readiness-bar-wrap">
          <div class="readiness-bar" style="width:${(mapped.length / sheet.columns.length * 100).toFixed(0)}%"></div>
        </div>
        <div class="readiness-label">${mapped.length} of ${sheet.columns.length} columns mapped (${(mapped.length / sheet.columns.length * 100).toFixed(0)}%)</div>
      </div>`;
  }

  // ─── GENERATE FROM UPLOAD ────────────────────────────────────────────────
  function _generateFromUpload() {
    const btn = document.getElementById('btn-generate-upload');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Processing…'; }

    setTimeout(() => {
      try {
        const sheet = uploadState.sheets[uploadState.activeSheet];
        const structuredRows = SmartMapper.applyMapping(sheet.data, uploadState.mapping);

        if (!structuredRows.length) throw new Error('No usable rows after mapping. Please check your column assignments.');

        // Save mappings so the dashboard can use the exact column names
        Store.setColumnMappings(uploadState.mapping);

        // Convert structured rows → inventory + augment with reference data
        const items = _structuredRowsToItems(structuredRows);
        const dataset = _buildDataset(items);

        Object.entries(dataset).forEach(([k, v]) => Store.setRawData(k, v));
        _runPipeline();

        GovSpirit.App.navigate('executive');
        GovSpirit.App.showToast(`✅ ${structuredRows.length} rows from "${sheet.filename}" → dashboard ready!`, 'success');

      } catch (err) {
        console.error('[Upload] Generate failed:', err);
        GovSpirit.App.showToast(err.message || 'Processing failed. Check console for details.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '📊 Generate Analytics Dashboard →'; }
      }
    }, 300);
  }

  // ─── STRUCTURED ROWS → ITEMS (normalise types) ───────────────────────────
  function _structuredRowsToItems(rows) {
    return rows.map((row, i) => {
      // Parse quantity
      let qty = parseInt(String(row.quantity || 0).replace(/[^0-9]/g, '')) || 0;

      // Parse size
      let size = null;
      if (row.size) {
        const s = String(row.size);
        const m = s.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i);
        if (m) size = m[2].toLowerCase() === 'l' ? Math.round(parseFloat(m[1]) * 1000) + 'ml' : Math.round(parseFloat(m[1])) + 'ml';
        else if (/^\d+$/.test(s.trim())) size = s.trim() + 'ml';
        else size = s.trim();
      }

      // Parse price
      let price = parseFloat(String(row.price || 0).replace(/[^0-9.]/g, '')) || null;

      // Detect category from brand name if not provided
      let category = row.category || _detectCategory(String(row.brand || ''));

      // Brand name clean
      const brand = String(row.brand || 'Unknown').trim();

      // Match reference data
      const ref = REF.findByBrandSize(brand, size) || REF.SKUs.find(s => brand.toLowerCase().includes(s.brand.toLowerCase()));

      const suggestedZone = ref ? ref.suggestedZone : _defaultZone(category);
      const abcClass = ref ? ref.abcClass : 'C';
      const velocity = ref ? ref.velocity : 'Unknown';
      if (!price && ref) price = ref.price;
      const avgMonthlySales = ref ? ref.avgMonthlySales : null;

      return {
        id: row.sku_id || ('ITEM-' + String(i + 1).padStart(4, '0')),
        brand,
        category: category || 'Unknown',
        size: size || (category === 'Beer' ? '650ml' : '750ml'),
        qty: qty || 1,
        location: row.zone || row.rack || null,
        suggestedZone: row.zone ? String(row.zone).toUpperCase().replace('ZONE', '').trim()[0] || suggestedZone : suggestedZone,
        abcClass,
        velocity,
        price,
        avgMonthlySales,
        stockMonths: avgMonthlySales && qty ? parseFloat((qty / avgMonthlySales).toFixed(1)) : null,
        storageNotes: ref ? ref.storageNotes : 'Store in Zone ' + suggestedZone,
        supplier: row.supplier || (ref ? ref.supplier : 'Government Supply'),
        receivedDate: row.received_date || null,
        totalValue: price && qty ? price * qty : (row.total_value ? parseFloat(String(row.total_value).replace(/[^0-9.]/g, '')) : null),
        refId: ref ? ref.id : null,
        raw: JSON.stringify(row).slice(0, 80),
        confidence: ref ? 'high' : 'medium',
      };
    });
  }

  function _detectCategory(name) {
    const n = name.toLowerCase();
    if (/whisky|whiskey|scotch|bourbon/.test(n)) return 'Whisky';
    if (/rum/.test(n)) return 'Rum';
    if (/beer|lager|ale/.test(n)) return 'Beer';
    if (/wine|merlot|chardonnay/.test(n)) return 'Wine';
    if (/vodka/.test(n)) return 'Vodka';
    if (/gin/.test(n)) return 'Gin';
    if (/brandy|cognac/.test(n)) return 'Brandy';
    return 'Whisky'; // most common default
  }

  function _defaultZone(category) {
    return { Whisky: 'B', Rum: 'B', Beer: 'A', Wine: 'E', Vodka: 'C', Gin: 'D', Brandy: 'B' }[category] || 'C';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PASTE TAB (existing functionality)
  // ═══════════════════════════════════════════════════════════════════════════

  function _setupPasteTab() {
    document.getElementById('btn-example')?.addEventListener('click', () => {
      document.getElementById('list-input').value = EXAMPLE_TEXT;
    });
    document.getElementById('btn-clear-text')?.addEventListener('click', () => {
      document.getElementById('list-input').value = '';
      document.getElementById('parsed-section').style.display = 'none';
      parsedItems = [];
    });
    document.getElementById('btn-parse')?.addEventListener('click', _handleParse);
    document.getElementById('list-input')?.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'Enter') _handleParse();
    });
  }

  function _handleParse() {
    const text = document.getElementById('list-input')?.value?.trim();
    if (!text) { GovSpirit.App.showToast('Please enter at least one item.', 'warning'); return; }
    parsedItems = ListParser.parseText(text);
    if (!parsedItems.length) { GovSpirit.App.showToast('Could not parse any items. Try the example format.', 'error'); return; }
    _displayParsedResults(parsedItems);
  }

  function _displayParsedResults(items) {
    const section = document.getElementById('parsed-section');
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });

    const highConf = items.filter(i => i.confidence === 'high').length;
    const withRef = items.filter(i => i.refId).length;
    document.getElementById('parsed-title').textContent = `✅ ${items.length} items structured`;
    document.getElementById('parsed-subtitle').textContent = `${highConf} brands recognized · ${withRef} matched to reference data · ${items.length - highConf} need review`;

    const warnings = ListParser.validate(items);
    const warnEl = document.getElementById('parse-warnings');
    warnEl.innerHTML = warnings.length
      ? `<div class="parse-warn-list">${warnings.slice(0, 5).map(w => `<div class="parse-warn-item">⚠️ ${w.msg}</div>`).join('')}</div>`
      : '<div class="parse-success-banner">✅ All items parsed successfully</div>';

    _renderMiniCharts(items);
    _renderParsedTable(items);
    _renderStoragePlan(items);

    document.getElementById('btn-edit-list')?.addEventListener('click', () => { section.style.display = 'none'; });
    document.getElementById('btn-export-parsed')?.addEventListener('click', () => {
      Utils.downloadCSV(items.map(i => ({ ID: i.id, Brand: i.brand, Category: i.category, Size: i.size, Qty: i.qty, Zone: i.suggestedZone, ABC: i.abcClass, Price: i.price || '', Value: i.totalValue || '' })), 'govspirit_parsed.csv');
    });
    document.getElementById('btn-generate-dashboard')?.addEventListener('click', _generateFromPaste);
  }

  function _generateFromPaste() {
    const btn = document.getElementById('btn-generate-dashboard');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
    setTimeout(() => {
      try {
        const dataset = _buildDataset(parsedItems);
        Object.entries(dataset).forEach(([k, v]) => Store.setRawData(k, v));
        _runPipeline();
        GovSpirit.App.navigate('executive');
        GovSpirit.App.showToast(`Dashboard ready from ${parsedItems.length} items!`, 'success');
      } catch (err) {
        console.error('[Paste] Generate failed:', err);
        GovSpirit.App.showToast('Error generating dashboard. See console.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '📊 Generate Full Analytics Dashboard →'; }
      }
    }, 300);
  }

  // ─── MINI CHARTS (paste tab) ─────────────────────────────────────────────
  function _renderMiniCharts(items) {
    const catCounts = {}, zoneCounts = {};
    items.forEach(i => {
      catCounts[i.category] = (catCounts[i.category] || 0) + i.qty;
      zoneCounts[i.suggestedZone] = (zoneCounts[i.suggestedZone] || 0) + 1;
    });
    const totalValue = items.reduce((s, i) => s + (i.totalValue || 0), 0);
    const totalQty = items.reduce((s, i) => s + i.qty, 0);

    document.getElementById('parse-charts').innerHTML = `
      <div class="mini-kpi-row">
        <div class="mini-kpi"><div class="mini-kpi-val">${items.length}</div><div class="mini-kpi-lbl">Items</div></div>
        <div class="mini-kpi"><div class="mini-kpi-val">${totalQty.toLocaleString()}</div><div class="mini-kpi-lbl">Total Bottles</div></div>
        <div class="mini-kpi"><div class="mini-kpi-val">${totalValue ? Utils.formatCurrency(totalValue) : '—'}</div><div class="mini-kpi-lbl">Est. Value</div></div>
        <div class="mini-kpi"><div class="mini-kpi-val">${items.filter(i => i.refId).length}</div><div class="mini-kpi-lbl">Ref. Matched</div></div>
      </div>
      <div class="mini-chart-row">
        <div class="mini-chart-card"><div class="mini-chart-title">By Category</div><canvas id="mc-category" width="220" height="150"></canvas></div>
        <div class="mini-chart-card"><div class="mini-chart-title">Suggested Zones</div><canvas id="mc-zones" width="220" height="150"></canvas></div>
        <div class="mini-chart-card"><div class="mini-chart-title">ABC Class</div><canvas id="mc-abc" width="220" height="150"></canvas></div>
        <div class="mini-chart-card"><div class="mini-chart-title">Stock Coverage (months)</div><canvas id="mc-coverage" width="220" height="150"></canvas></div>
      </div>`;

    setTimeout(() => {
      const mOpts = { responsive: false, maintainAspectRatio: false, animation: { duration: 400 }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a2030' } }, scales: { x: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', font: { size: 9 } } }, y: { grid: { color: '#1c2030' }, ticks: { color: '#555b78', font: { size: 9 } } } } };
      const cats = Object.keys(catCounts);
      const catCtx = document.getElementById('mc-category')?.getContext('2d');
      if (catCtx && cats.length) Utils.registerChart('mc-category', new Chart(catCtx, { type: 'doughnut', data: { labels: cats, datasets: [{ data: cats.map(c => catCounts[c]), backgroundColor: cats.map(c => (REF.CATEGORY_COLORS[c] || '#6366f1') + 'cc'), borderWidth: 0 }] }, options: { ...mOpts, plugins: { legend: { display: true, position: 'right', labels: { color: '#8892b0', boxWidth: 10, font: { size: 10 } } }, tooltip: { backgroundColor: '#1a2030' } }, cutout: '55%' } }));
      const zones = Object.keys(zoneCounts).sort();
      const zCtx = document.getElementById('mc-zones')?.getContext('2d');
      if (zCtx && zones.length) Utils.registerChart('mc-zones', new Chart(zCtx, { type: 'bar', data: { labels: zones.map(z => 'Zone ' + z), datasets: [{ data: zones.map(z => zoneCounts[z]), backgroundColor: zones.map(z => (REF.ZONES[z]?.color || '#6366f1') + 'cc'), borderRadius: 4 }] }, options: mOpts }));
      const abc = { A: 0, B: 0, C: 0 }; items.forEach(i => { if (abc[i.abcClass] !== undefined) abc[i.abcClass]++; });
      const abcCtx = document.getElementById('mc-abc')?.getContext('2d');
      if (abcCtx) Utils.registerChart('mc-abc', new Chart(abcCtx, { type: 'doughnut', data: { labels: ['Class A', 'B', 'C'], datasets: [{ data: [abc.A, abc.B, abc.C], backgroundColor: ['#10b981cc', '#f59e0bcc', '#f43f5ecc'], borderWidth: 0 }] }, options: { ...mOpts, plugins: { legend: { display: true, position: 'right', labels: { color: '#8892b0', boxWidth: 10, font: { size: 10 } } }, tooltip: { backgroundColor: '#1a2030' } }, cutout: '55%' } }));
      const cov = items.filter(i => i.stockMonths !== null).slice(0, 8);
      const covCtx = document.getElementById('mc-coverage')?.getContext('2d');
      if (covCtx && cov.length) Utils.registerChart('mc-coverage', new Chart(covCtx, { type: 'bar', data: { labels: cov.map(i => Utils.truncate(i.brand, 10)), datasets: [{ data: cov.map(i => i.stockMonths), backgroundColor: cov.map(i => i.stockMonths < 1 ? '#f43f5ecc' : i.stockMonths < 2 ? '#f59e0bcc' : '#10b981cc'), borderRadius: 3 }] }, options: mOpts }));
    }, 100);
  }

  // ─── PARSED TABLE (paste tab) ────────────────────────────────────────────
  function _renderParsedTable(items) {
    const container = document.getElementById('parsed-table-container');
    const abcBadge = c => `<span class="badge ${c === 'A' ? 'badge-success' : c === 'B' ? 'badge-warning' : 'badge-danger'}">${c}</span>`;
    const rows = items.map((item, i) => `
      <tr>
        <td>${item.id}</td>
        <td><div class="table-brand-name">${item.brand}</div><div class="table-brand-raw">${Utils.truncate(item.raw, 35)}</div></td>
        <td><span style="color:${REF.CATEGORY_COLORS[item.category] || '#8892b0'}">${item.category}</span></td>
        <td>${item.size}</td>
        <td class="text-right"><strong>${item.qty.toLocaleString()}</strong></td>
        <td><span class="zone-badge" style="background:${(REF.ZONES[item.suggestedZone]?.color || '#6366f1') + '25'};color:${REF.ZONES[item.suggestedZone]?.color || '#6366f1'}">Zone ${item.suggestedZone}</span></td>
        <td>${abcBadge(item.abcClass)}</td>
        <td>${item.price ? '₹' + item.price.toLocaleString() : '<span class="text-muted">—</span>'}</td>
        <td>${item.totalValue ? Utils.formatCurrency(item.totalValue) : '<span class="text-muted">—</span>'}</td>
        <td><span class="stock-months ${!item.stockMonths ? '' : item.stockMonths < 1 ? 'low-stock' : item.stockMonths > 4 ? 'overstock' : 'ok-stock'}">${item.stockMonths !== null ? item.stockMonths + ' mo' : '—'}</span></td>
      </tr>`).join('');
    container.innerHTML = `<div class="table-wrapper"><table class="data-table parsed-table"><thead><tr><th>ID</th><th>Brand</th><th>Category</th><th>Size</th><th>Qty</th><th>Zone</th><th>ABC</th><th>Price</th><th>Value</th><th>Coverage</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ─── STORAGE PLAN (paste tab) ────────────────────────────────────────────
  function _renderStoragePlan(items) {
    const zoneGroups = {};
    items.forEach(item => {
      const z = item.suggestedZone || 'C';
      (zoneGroups[z] = zoneGroups[z] || []).push(item);
    });
    const cards = Object.entries(zoneGroups).sort().map(([z, zItems]) => {
      const def = REF.ZONES[z] || { label: 'Zone ' + z, desc: '', color: '#6366f1' };
      const totalQty = zItems.reduce((s, i) => s + i.qty, 0);
      return `<div class="zone-plan-card" style="border-color:${def.color}30">
        <div class="zone-plan-header" style="background:${def.color}15;border-color:${def.color}30">
          <div class="zone-plan-badge" style="background:${def.color}">${def.label}</div>
          <div class="zone-plan-meta"><div class="zone-plan-desc">${def.desc}</div><div class="zone-plan-counts">${zItems.length} SKUs · ${totalQty.toLocaleString()} bottles</div></div>
        </div>
        <div class="zone-plan-items">${zItems.map(item => `<div class="zone-plan-item"><div class="zone-plan-item-name">${item.brand} <span class="zone-plan-size">${item.size}</span></div><div class="zone-plan-item-qty">${item.qty} bottles</div><div class="zone-plan-item-note">${Utils.truncate(item.storageNotes, 55)}</div></div>`).join('')}</div>
      </div>`;
    }).join('');
    document.getElementById('storage-plan').innerHTML = `
      <div class="storage-plan-header"><div class="storage-plan-title">🗺️ Recommended Storage Plan</div><div class="storage-plan-subtitle">Based on 12-month sales velocity</div></div>
      <div class="zone-plan-grid">${cards}</div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SHARED: Build Dataset + Run Pipeline
  // ═══════════════════════════════════════════════════════════════════════════

  function _buildDataset(items) {
    const TODAY = new Date();
    const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    const dateAgo = (d) => { const dt = new Date(TODAY); dt.setDate(dt.getDate() - d); return dt.toISOString().slice(0, 10); };
    const hotels = REF.HOTELS;

    const inventory = items.map((item, i) => ({
      sku_id: item.id, sku_name: item.brand + ' ' + item.size,
      brand: item.brand, category: item.category, zone: item.suggestedZone,
      rack_id: item.suggestedZone + '-' + String(rand(1, 5)).padStart(2, '0'),
      quantity_bottles: item.qty, quantity_cases: Math.ceil(item.qty / 12),
      price_per_bottle: item.price || rand(100, 800),
      total_value: item.totalValue || item.qty * (item.price || rand(100, 800)),
      bottle_size: item.size, alcohol_type: item.category,
      days_in_stock: item.receivedDate ? Math.round((TODAY - new Date(item.receivedDate)) / 86400000) : rand(5, 85),
      last_received_date: item.receivedDate || dateAgo(rand(5, 45)),
      supplier: item.supplier || 'Government Supply', abc_class: item.abcClass, condition: 'Good',
    }));

    const skuMaster = inventory.map(r => ({ sku_id: r.sku_id, sku_name: r.sku_name, brand: r.brand, category: r.category, bottle_size: r.bottle_size, price_per_bottle: r.price_per_bottle, supplier: r.supplier }));

    const zones = [...new Set(inventory.map(r => r.zone)), 'A', 'B', 'C', 'D', 'E'].filter((v, i, a) => a.indexOf(v) === i).sort();
    const warehouseLayout = [];
    let binId = 1;
    zones.forEach(z => {
      for (let rack = 1; rack <= 5; rack++) {
        for (let shelf = 1; shelf <= 4; shelf++) {
          const occ = inventory.filter(r => r.zone === z && r.rack_id === z + '-' + String(rack).padStart(2, '0'));
          warehouseLayout.push({ bin_id: 'BIN-' + String(binId++).padStart(4, '0'), zone: z, rack_id: z + '-' + String(rack).padStart(2, '0'), shelf, capacity_bottles: 120, occupied_bottles: occ.length && shelf === 1 ? Math.min(occ[0].quantity_bottles, 120) : rand(0, 40) });
        }
      }
    });

    const orders = [], dispatch = [];
    let ordId = 1, dspId = 1;

    inventory.forEach(invRow => {
      const ref = REF.SKUs.find(s => s.id === invRow.sku_id) || REF.SKUs.find(s => s.brand === invRow.brand);
      const dailyAvg = ref ? ref.avgMonthlySales / 30 : rand(1, 15);
      for (let day = 90; day >= 1; day--) {
        const dayQty = Math.max(0, Math.round(dailyAvg * (0.5 + Math.random())));
        if (dayQty <= 0 || Math.random() > 0.4) continue;
        const hotel = hotels[rand(0, hotels.length - 1)];
        const orderQty = dayQty + rand(0, 8);
        orders.push({ order_id: 'ORD-' + String(ordId++).padStart(6, '0'), hotel_name: hotel, sku_id: invRow.sku_id, sku_name: invRow.sku_name, brand: invRow.brand, category: invRow.category, bottle_size: invRow.bottle_size, quantity_ordered: orderQty, order_value: orderQty * invRow.price_per_bottle, order_date: dateAgo(day), status: day > 3 ? 'Completed' : 'Pending' });
        if (day > 3) dispatch.push({ dispatch_id: 'DSP-' + String(dspId++).padStart(6, '0'), order_id: 'ORD-' + String(ordId - 1).padStart(6, '0'), hotel_name: hotel, sku_id: invRow.sku_id, sku_name: invRow.sku_name, brand: invRow.brand, category: invRow.category, bottle_size: invRow.bottle_size, quantity_dispatched: dayQty, dispatch_value: dayQty * invRow.price_per_bottle, dispatch_date: dateAgo(day - rand(0, 2)), vehicle: 'TN-0' + rand(1, 3) + '-AB-' + rand(1000, 9999), driver: ['Rajan K', 'Murugan S', 'Kumar V', 'Selvam P'][rand(0, 3)], dispatch_time_minutes: rand(25, 90) });
      }
    });

    const employees = [
      { employee_id: 'EMP-001', employee_name: 'Rajan Kumar', role: 'Picker', shift: 'Morning', picks_per_hour: 42, accuracy_rate: 98.2, orders_completed: 820, performance_score: 94 },
      { employee_id: 'EMP-002', employee_name: 'Murugan S', role: 'Packer', shift: 'Morning', picks_per_hour: 38, accuracy_rate: 97.8, orders_completed: 760, performance_score: 91 },
      { employee_id: 'EMP-003', employee_name: 'Kumar V', role: 'Driver', shift: 'Day', picks_per_hour: 0, accuracy_rate: 99.0, orders_completed: 620, performance_score: 96 },
      { employee_id: 'EMP-004', employee_name: 'Selvam P', role: 'Picker', shift: 'Evening', picks_per_hour: 35, accuracy_rate: 96.5, orders_completed: 580, performance_score: 88 },
      { employee_id: 'EMP-005', employee_name: 'Priya R', role: 'Supervisor', shift: 'Morning', picks_per_hour: 0, accuracy_rate: 99.5, orders_completed: 0, performance_score: 95 },
    ];

    const vehicles = [
      { vehicle_id: 'VEH-001', vehicle: 'TN-01-AB-1234', type: 'Mini Truck', capacity: 500, trips: rand(40, 80) },
      { vehicle_id: 'VEH-002', vehicle: 'TN-02-CD-5678', type: 'Mini Truck', capacity: 500, trips: rand(35, 70) },
    ];

    return { inventory, orders, dispatch, employees, vehicles, warehouseLayout, skuMaster };
  }

  function _runPipeline() {
    GovSpirit.DataTransformer.transformAll(Store.getState().rawData);
    KPIEngine.calculate();
    ABCXYZEngine.classify();
    AgingEngine.analyze();
    UtilizationEngine.analyze();
    RecommendationEngine.generate();
    Store.setDataLoaded(true);
    EventBus.emit(Events.DATA_LOADED);
  }

  // ─── Public API ──────────────────────────────────────────────────────────
  return { render, mount, _switchTab, _switchSheet, _updateMapping, _loadDemo };
})();
