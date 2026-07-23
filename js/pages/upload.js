/**
 * GovSpirit Upload Page
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.Pages = GovSpirit.Pages || {};

GovSpirit.Pages.upload = (function () {
  const { Utils, Store, EventBus, Events, FileReader: FR, ColumnMapper, DataValidator, DataTransformer, KPIEngine, ABCXYZEngine, AgingEngine, UtilizationEngine, RecommendationEngine, DemoData } = GovSpirit;

  let uploadedSheets = [];
  let confirmedMappings = {};

  function render() {
    return `
      <div class="page-upload">
        <div class="upload-hero">
          <div class="upload-logo">
            <div class="upload-logo-icon">🏛️</div>
            <div>
              <div class="upload-logo-title">GovSpirit</div>
              <div class="upload-logo-sub">Warehouse Intelligence Platform</div>
            </div>
          </div>
          <p class="upload-tagline">Upload your warehouse data and instantly generate enterprise-grade analytics, KPIs, and AI-powered recommendations.</p>
        </div>

        <div class="upload-grid">
          <div class="upload-main">
            <div class="upload-zone" id="upload-dropzone">
              <div class="upload-zone-icon">📂</div>
              <div class="upload-zone-title">Drop files here or click to upload</div>
              <div class="upload-zone-sub">Supports Excel (.xlsx, .xls) and CSV files<br>Upload one large ERP export or multiple individual files</div>
              <button class="btn btn-primary btn-lg mt-2" id="btn-browse-files">Browse Files</button>
              <input type="file" id="file-input" accept=".xlsx,.xls,.csv" multiple style="display:none">
            </div>

            <div id="upload-progress" style="display:none">
              <div class="progress-bar-wrap">
                <div class="progress-bar" id="progress-bar" style="width:0%"></div>
              </div>
              <div class="progress-label" id="progress-label">Processing...</div>
            </div>

            <div id="detected-files" style="display:none"></div>
            <div id="mapping-wizard" style="display:none"></div>
            <div id="validation-results" style="display:none"></div>

            <div id="upload-actions" style="display:none">
              <button class="btn btn-success btn-lg" id="btn-proceed">
                🚀 Generate Analytics Dashboard
              </button>
            </div>
          </div>

          <div class="upload-sidebar">
            <div class="upload-sidebar-section">
              <h3>📁 Supported Files</h3>
              <ul class="file-type-list">
                ${Object.entries(FR.getAllSignatures()).map(([k, v]) => `<li>${v.icon} ${v.label}</li>`).join('')}
              </ul>
            </div>
            <div class="upload-sidebar-section demo-section">
              <h3>🎮 Try with Demo Data</h3>
              <p>No files? Load our built-in realistic warehouse dataset to explore all features.</p>
              <button class="btn btn-accent btn-lg w-full" id="btn-demo">
                ⚡ Load Demo Data
              </button>
              <p class="demo-hint">Includes 200+ SKUs, 30 hotels, 90 days of orders, and warehouse layout</p>
            </div>
            <div class="upload-sidebar-section">
              <h3>🔒 Privacy</h3>
              <p>All data is processed entirely in your browser. Nothing is uploaded to any server.</p>
            </div>
          </div>
        </div>
      </div>`;
  }

  function mount() {
    // File upload events
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('btn-browse-files');

    browseBtn?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', (e) => handleFiles([...e.target.files]));

    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); handleFiles([...e.dataTransfer.files]); });

    // Demo data
    document.getElementById('btn-demo')?.addEventListener('click', loadDemoData);

    // Proceed button
    document.getElementById('btn-proceed')?.addEventListener('click', proceedToDashboard);
  }

  async function handleFiles(files) {
    if (!files.length) return;
    showProgress(true, 'Parsing files...');

    const results = await FR.processFiles(files, ({ file, progress, status }) => {
      document.getElementById('progress-bar').style.width = (progress * 100) + '%';
      document.getElementById('progress-label').textContent = `${status === 'done' ? '✓' : '⏳'} ${file}`;
    });

    uploadedSheets = results;
    showProgress(false);
    showDetectedFiles(results);
  }

  function showDetectedFiles(sheets) {
    const container = document.getElementById('detected-files');
    if (!sheets.length) { container.style.display = 'none'; return; }

    container.style.display = 'block';
    container.innerHTML = `
      <div class="detected-header"><h3>📋 Detected Files (${sheets.length} sheets)</h3></div>
      <div class="detected-grid">
        ${sheets.map((s, i) => `
          <div class="detected-card">
            <div class="detected-icon">${GovSpirit.FileReader.getAllSignatures()[s.detectedType]?.icon || '📄'}</div>
            <div class="detected-info">
              <div class="detected-name">${s.filename} ${s.sheetName !== 'Sheet1' ? '→ ' + s.sheetName : ''}</div>
              <div class="detected-type">${s.detectedLabel} — ${s.rowCount.toLocaleString()} rows</div>
              <div class="detected-confidence">
                <span class="conf-badge ${s.detectionScore >= 5 ? 'conf-high' : s.detectionScore >= 3 ? 'conf-med' : 'conf-low'}">
                  ${s.detectionScore >= 5 ? '✓ High confidence' : s.detectionScore >= 3 ? '~ Medium confidence' : '✗ Low confidence'}
                </span>
              </div>
            </div>
            <select class="type-override" data-sheet-index="${i}">
              ${Object.keys(FR.getAllSignatures()).map(t => `<option value="${t}" ${t === s.detectedType ? 'selected' : ''}>${FR.getAllSignatures()[t].label}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>
      <div class="mapping-confirm-bar">
        <button class="btn btn-primary" id="btn-show-mapping">Review Column Mappings →</button>
      </div>`;

    container.querySelectorAll('.type-override').forEach(sel => {
      sel.addEventListener('change', (e) => {
        uploadedSheets[parseInt(e.target.dataset.sheetIndex)].detectedType = e.target.value;
      });
    });

    document.getElementById('btn-show-mapping')?.addEventListener('click', showMappingWizard);
  }

  function showMappingWizard() {
    const container = document.getElementById('mapping-wizard');
    container.style.display = 'block';
    let html = '<div class="wizard-header"><h3>🗺️ Column Mapping Wizard</h3><p>Review and adjust how your columns map to standard fields. Auto-detected with confidence scores.</p></div>';

    uploadedSheets.forEach((sheet, idx) => {
      const { mappings, confidence } = ColumnMapper.mapColumns(sheet.detectedType, sheet.columns);
      confirmedMappings[idx] = mappings;
      html += ColumnMapper.buildMappingWizardHTML(sheet.detectedType, sheet.columns, mappings, confidence);
    });

    html += `<div class="mapping-confirm-bar"><button class="btn btn-primary" id="btn-confirm-mapping">✓ Confirm Mappings & Validate</button></div>`;
    container.innerHTML = html;

    container.querySelectorAll('.mapping-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const canonical = e.target.dataset.canonical;
        const sheetIdx = uploadedSheets.findIndex(s => s.detectedType === e.target.dataset.filetype);
        if (sheetIdx >= 0) confirmedMappings[sheetIdx][canonical] = e.target.value || null;
      });
    });

    document.getElementById('btn-confirm-mapping')?.addEventListener('click', validateAndLoad);
    container.scrollIntoView({ behavior: 'smooth' });
  }

  function validateAndLoad() {
    // Apply mappings and load into store
    uploadedSheets.forEach((sheet, idx) => {
      const mappings = confirmedMappings[idx] || {};
      const mapped = ColumnMapper.applyMappings(sheet.data, mappings);
      Store.setRawData(sheet.detectedType, mapped);
    });

    // Validate
    const rawData = Store.getState().rawData;
    const valResult = DataValidator.validateAll(rawData);
    Store.setValidation(valResult.warnings, valResult.errors, valResult.overallScore);

    // Show validation
    const valContainer = document.getElementById('validation-results');
    valContainer.style.display = 'block';
    valContainer.innerHTML = `<div class="validation-header"><h3>🔍 Data Validation Report</h3></div>${DataValidator.renderValidationReport(valResult)}`;

    // Show proceed button
    document.getElementById('upload-actions').style.display = 'block';
    valContainer.scrollIntoView({ behavior: 'smooth' });
  }

  function loadDemoData() {
    showProgress(true, 'Generating demo dataset...');
    setTimeout(() => {
      const data = DemoData.generate();
      Object.entries(data).forEach(([key, val]) => Store.setRawData(key, val));
      showProgress(false);

      // Show quick confirmation
      const container = document.getElementById('detected-files');
      container.style.display = 'block';
      container.innerHTML = `
        <div class="demo-loaded-banner">
          <div class="demo-loaded-icon">✅</div>
          <div>
            <div class="demo-loaded-title">Demo Data Loaded Successfully</div>
            <div class="demo-loaded-stats">
              ${data.inventory.length} inventory rows · ${data.orders.length} order lines · 
              ${data.dispatch.length} dispatch records · ${data.skuMaster.length} SKUs · 
              ${data.warehouseLayout.length} warehouse bins
            </div>
          </div>
        </div>`;

      document.getElementById('upload-actions').style.display = 'block';
    }, 500);
  }

  function proceedToDashboard() {
    showProgress(true, 'Running analytics engines...');
    setTimeout(() => {
      // Transform data
      DataTransformer.transformAll(Store.getState().rawData);

      // Run all analytics
      KPIEngine.calculate();
      ABCXYZEngine.classify();
      AgingEngine.analyze();
      UtilizationEngine.analyze();
      RecommendationEngine.generate();

      Store.setDataLoaded(true);
      showProgress(false);
      EventBus.emit(Events.DATA_LOADED);
      GovSpirit.App.navigate('executive');
    }, 800);
  }

  function showProgress(show, label = '') {
    const prog = document.getElementById('upload-progress');
    if (prog) {
      prog.style.display = show ? 'block' : 'none';
      if (label) document.getElementById('progress-label').textContent = label;
    }
  }

  return { render, mount };
})();
