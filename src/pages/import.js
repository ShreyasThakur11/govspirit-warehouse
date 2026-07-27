/**
 * GovSpirit Import page.
 *
 * Three ways in: open the sample depot, upload a spreadsheet, or paste a
 * free-text list. All three converge on the same analytics pipeline.
 *
 * Tabs follow the WAI-ARIA tabs pattern (roving tabindex, arrow-key
 * navigation, Home/End) rather than being buttons that merely look like tabs.
 */
(function initImportPage(GovSpirit) {
  'use strict';

  const {
    Html,
    Icons,
    Dom,
    Format,
    Store,
    Components,
    FileReader: Reader,
    SmartMapper,
    ListParser,
    DataValidator,
    ReferenceData,
    DemoData,
    SampleFile,
    Pipeline,
    Charts,
    Exporters,
  } = GovSpirit.require(
    'Html',
    'Icons',
    'Dom',
    'Format',
    'Store',
    'Components',
    'FileReader',
    'SmartMapper',
    'ListParser',
    'DataValidator',
    'ReferenceData',
    'DemoData',
    'SampleFile',
    'Pipeline',
    'Charts',
    'Exporters'
  );

  const { html, raw, setHTML, styleAttr, cx } = Html;

  const TABS = [
    { id: 'upload', label: 'Upload a file', icon: 'fileSpreadsheet', flag: 'Recommended' },
    { id: 'paste', label: 'Paste a list', icon: 'edit' },
  ];

  /* Entry points into the sample depot. Each one loads the same dataset and
     lands on the view that best shows what that part of the tool does, so a
     first-time reader can follow the work rather than hunt for it. */
  const SAMPLE_TOUR = [
    {
      view: 'executive',
      icon: 'dashboard',
      label: 'Executive summary',
      detail: 'Stock value, fill rate and the health score, with its components broken out',
    },
    {
      view: 'warehouse',
      icon: 'warehouse',
      label: 'Warehouse map',
      detail: 'Utilisation by zone and rack, down to the individual bin',
    },
    {
      view: 'recommendations',
      icon: 'lightbulb',
      label: 'Recommendations',
      detail: 'Ranked actions, each showing the rule and the threshold that triggered it',
    },
    {
      view: 'stockAging',
      icon: 'clock',
      label: 'Stock aging',
      detail: 'What has not moved, for how long, and what it is worth',
    },
  ];

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

  /* ── Page state ─────────────────────────────────────────────────────────
     Reset on every mount so returning to the page never shows a stale file. */
  let activeTab = 'upload';
  let sheets = [];
  let activeSheetIndex = 0;
  let mapping = {};
  let parsedItems = [];
  let validationResult = null;
  let disposers = [];

  const activeSheet = () => sheets[activeSheetIndex] || null;

  function resetState() {
    activeTab = 'upload';
    sheets = [];
    activeSheetIndex = 0;
    mapping = {};
    parsedItems = [];
    validationResult = null;
  }

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */

  function render() {
    return html`
      <div class="page-content">
        <div class="intro">
          <p class="intro-eyebrow">State excise depot analytics</p>
          <h1 class="intro-title" id="page-heading">Turn any stock file into a dashboard</h1>
          <p class="intro-lead">
            Upload a spreadsheet, however untidy, and GovSpirit detects the columns, structures the
            data and builds a full analytics dashboard. Everything runs in this browser tab: no file
            is ever uploaded to a server.
          </p>
        </div>

        <!-- ── Sample depot ───────────────────────────────────────────────
             Placed above the tabs on purpose. Most first-time readers have no
             spreadsheet to hand, and asking them to find one before they can
             see anything is the fastest way to lose them. -->
        <section class="sample" aria-labelledby="sample-heading">
          <div class="sample-head">
            <div>
              <h2 class="sample-title" id="sample-heading">Start with the sample depot</h2>
              <p class="sample-lead">
                A complete synthetic warehouse built from the ${ReferenceData.SKUS.length} reference
                brands: stock across every zone, three months of orders, dispatch records, a bin
                level layout, a damage register and cycle counts. The generator is seeded, so the
                figures are the same on every machine.
              </p>
            </div>
            <div class="sample-buttons">
              <button type="button" class="btn btn-primary btn-lg" id="btn-sample-open">
                ${Icons.render('dashboard', { size: 18 })} Open the sample dashboard
              </button>
              <button type="button" class="btn btn-subtle" id="btn-sample-download">
                ${Icons.render('download', { size: 16 })} Download the sample file
              </button>
            </div>
          </div>

          <p class="sample-note">
            The download carries the headers a depot actually prints, not the names this tool uses
            internally, so opening it puts the column mapper through the same work your own file
            will.
          </p>

          <ul class="sample-tour">
            ${SAMPLE_TOUR.map(
              (stop) => html`
                <li>
                  <button type="button" class="sample-stop" data-sample-view="${stop.view}">
                    <span class="sample-stop-icon">${Icons.render(stop.icon, { size: 18 })}</span>
                    <span class="sample-stop-text">
                      <span class="sample-stop-label">${stop.label}</span>
                      <span class="sample-stop-detail">${stop.detail}</span>
                    </span>
                    ${Icons.render('arrowRight', { size: 16, className: 'sample-stop-arrow' })}
                  </button>
                </li>
              `
            )}
          </ul>
        </section>

        <h2 class="section-heading">Or load your own data</h2>

        <div class="tabs" role="tablist" aria-label="Ways to load data">
          ${TABS.map(
            (tab) => html`
              <button
                type="button"
                class="tab"
                role="tab"
                id="tab-${tab.id}"
                aria-controls="panel-${tab.id}"
                aria-selected="${tab.id === activeTab ? 'true' : 'false'}"
                tabindex="${tab.id === activeTab ? '0' : '-1'}"
                data-tab="${tab.id}"
              >
                ${Icons.render(tab.icon, { size: 16 })} ${tab.label}
                ${tab.flag ? html`<span class="tab-hint">${tab.flag}</span>` : ''}
              </button>
            `
          )}
        </div>

        <!-- ── Upload ─────────────────────────────────────────────────── -->
        <div class="tab-panel" role="tabpanel" id="panel-upload" aria-labelledby="tab-upload">
          <button type="button" class="dropzone full-width" id="dropzone">
            <div>
              ${Icons.render('import', { size: 34, className: 'dropzone-icon' })}
              <span class="dropzone-title">Drop your file here</span>
              <span class="dropzone-hint">or select a file to upload</span>
              <span class="format-list">
                ${Reader.ACCEPTED_EXTENSIONS.map((ext) => html`<span class="format-tag">${ext}</span>`)}
              </span>
              <span class="dropzone-note">
                Works with any column layout. Messy headers, extra columns and multiple sheets are
                all handled. Maximum ${Reader.MAX_FILE_BYTES / 1024 / 1024} MB per file.
              </span>
            </div>
          </button>
          <input
            type="file"
            id="file-input"
            class="visually-hidden"
            accept="${Reader.ACCEPTED_EXTENSIONS.join(',')}"
            multiple
          />

          <div id="upload-status" role="status" aria-live="polite"></div>
          <div id="mapping-section" hidden></div>
        </div>

        <!-- ── Paste ──────────────────────────────────────────────────── -->
        <div class="tab-panel" role="tabpanel" id="panel-paste" aria-labelledby="tab-paste" hidden>
          <div class="paste-grid">
            <div class="editor">
              <div class="editor-header">
                <h2 class="panel-title">Your inventory list</h2>
                <div class="page-actions">
                  <button type="button" class="btn btn-subtle btn-sm" id="btn-example">
                    Load example
                  </button>
                  <button type="button" class="btn btn-subtle btn-sm" id="btn-clear-text">
                    Clear
                  </button>
                </div>
              </div>
              <label class="visually-hidden" for="list-input"
                >Inventory list, one item per line</label
              >
              <textarea
                id="list-input"
                class="control-textarea"
                spellcheck="false"
                placeholder="One item per line, for example:&#10;&#10;Royal Stag 180ml 200 bottles Zone A&#10;Kingfisher beer 650ml 300 nos&#10;Old Monk 750ml 80 units, Rack B3"
              ></textarea>
              <div class="editor-footer">
                <div class="syntax-hints">
                  <span class="syntax-hint">Brand name</span>
                  <span class="syntax-hint">Size</span>
                  <span class="syntax-hint">Quantity</span>
                  <span class="syntax-hint">Zone or rack</span>
                </div>
                <button type="button" class="btn btn-primary" id="btn-parse">
                  Parse and structure
                </button>
              </div>
            </div>

            <aside class="panel-body">
              <h2 class="panel-title">Recognised brands</h2>
              <div class="reference-list">
                ${ReferenceData.SKUS.slice(0, 8).map(
                  (sku) => html`
                    <div class="reference-row">
                      <span class="reference-class ref-abc-${sku.abcClass.toLowerCase()}"
                        >${sku.abcClass}</span
                      >
                      <span class="reference-name">${sku.brand}</span>
                      <span class="reference-size">${sku.size}</span>
                      <span class="reference-rate">${Format.number(sku.avgMonthlySales)}/mo</span>
                    </div>
                  `
                )}
                <p class="reference-more">
                  ${ReferenceData.SKUS.length - 8} more in the reference dataset
                </p>
              </div>
            </aside>
          </div>

          <div id="parsed-section" hidden></div>
        </div>

        <div class="notice mt-3">
          ${Icons.render('shield', { size: 18 })}
          <div>
            <p class="notice-title">Your data stays on this device</p>
            <p class="notice-body">
              GovSpirit is a static page. Files are read with the browser's own FileReader API and
              held in memory for the length of the session. There is no backend, no upload and no
              telemetry. Closing the tab discards everything.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════════════════════
     TABS
     ══════════════════════════════════════════════════════════════════ */

  function selectTab(tabId, { focus = false } = {}) {
    activeTab = tabId;
    TABS.forEach((tab) => {
      const button = document.getElementById(`tab-${tab.id}`);
      const panel = document.getElementById(`panel-${tab.id}`);
      const selected = tab.id === tabId;
      if (button) {
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected && focus) button.focus();
      }
      if (panel) panel.hidden = !selected;
    });
  }

  function bindTabs() {
    const bar = Dom.qs('.tabs');
    if (!bar) return;

    disposers.push(
      Dom.delegate(bar, '[role="tab"]', 'click', (event, button) => selectTab(button.dataset.tab))
    );

    disposers.push(
      Dom.on(bar, 'keydown', (event) => {
        const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
        if (!keys.includes(event.key)) return;
        event.preventDefault();

        const index = TABS.findIndex((tab) => tab.id === activeTab);
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = TABS.length - 1;

        selectTab(TABS[next].id, { focus: true });
      })
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     UPLOAD FLOW
     ══════════════════════════════════════════════════════════════════ */

  function bindUpload() {
    const zone = Dom.byId('dropzone');
    const input = Dom.byId('file-input');
    if (!zone || !input) return;

    disposers.push(Dom.on(zone, 'click', () => input.click()));
    disposers.push(Dom.on(input, 'change', () => handleFiles([...input.files])));

    ['dragenter', 'dragover'].forEach((type) => {
      disposers.push(
        Dom.on(zone, type, (event) => {
          event.preventDefault();
          zone.classList.add('is-dragging');
        })
      );
    });
    ['dragleave', 'dragend'].forEach((type) => {
      disposers.push(Dom.on(zone, type, () => zone.classList.remove('is-dragging')));
    });

    disposers.push(
      Dom.on(zone, 'drop', (event) => {
        event.preventDefault();
        zone.classList.remove('is-dragging');
        handleFiles([...(event.dataTransfer?.files || [])]);
      })
    );
  }

  async function handleFiles(files) {
    const accepted = files.filter(Reader.isAccepted);
    const status = Dom.byId('upload-status');

    if (files.length && !accepted.length) {
      Components.toast(
        `Unsupported file type. Accepted: ${Reader.ACCEPTED_EXTENSIONS.join(', ')}.`,
        'warning'
      );
      return;
    }
    if (!accepted.length) return;

    setHTML(status, Components.loadingState(`Reading ${accepted[0].name}…`));

    const { sheets: parsed, errors } = await Reader.processFiles(
      accepted,
      ({ file, status: s }) => {
        const label =
          s === 'done'
            ? `Parsed ${file}`
            : s === 'error'
              ? `Failed to read ${file}`
              : `Reading ${file}…`;
        setHTML(status, Components.loadingState(label));
      }
    );

    errors.forEach((error) => Components.toast(`${error.file}: ${error.message}`, 'error'));

    if (!parsed.length) {
      setHTML(
        status,
        Components.errorState({
          title: 'No readable data found',
          message:
            'Check that the file has a header row and at least one row of data, then try again.',
          retryLabel: 'Choose another file',
          retryId: 'btn-retry-upload',
        })
      );
      disposers.push(
        Dom.on(Dom.byId('btn-retry-upload'), 'click', () => {
          setHTML(status, '');
          Dom.byId('file-input')?.click();
        })
      );
      return;
    }

    sheets = parsed;
    activeSheetIndex = 0;
    mapping = SmartMapper.autoMap(sheets[0].columns);
    setHTML(status, '');
    renderMappingSection();
  }

  function renderMappingSection() {
    const container = Dom.byId('mapping-section');
    const sheet = activeSheet();
    if (!container || !sheet) return;

    container.hidden = false;
    setHTML(
      container,
      html`
        ${renderFileSummary(sheet)} ${sheets.length > 1 ? renderSheetTabs() : ''}

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Detected column mapping</h2>
              <p class="panel-subtitle">
                Confirm how each column in your file maps to a GovSpirit field. High-confidence
                matches are applied automatically; adjust anything that looks wrong.
              </p>
            </div>
            <button type="button" class="btn btn-subtle btn-sm" id="btn-reset-mapping">
              Reset to detected
            </button>
          </div>
          <div id="mapping-table-holder">${renderMappingTable(sheet)}</div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">
                Data preview
                <span class="text-muted" id="preview-count"></span>
              </h2>
              <p class="panel-subtitle">The first five rows after the mapping above is applied.</p>
            </div>
          </div>
          <div id="preview-holder">${renderPreview(sheet)}</div>
        </section>

        <div id="readiness-holder">${renderReadiness(sheet)}</div>

        <div class="commit-bar">
          <button type="button" class="btn btn-primary btn-lg" id="btn-generate-upload">
            Generate analytics dashboard
          </button>
          <p class="commit-note" id="commit-note"></p>
        </div>
      `
    );

    bindMappingEvents();
    updateReadiness();
    Dom.scrollIntoView(container);
  }

  function renderFileSummary(sheet) {
    const values = Object.values(mapping);
    const mapped = values.filter((m) => m.fieldId !== SmartMapper.SKIP);
    const high = mapped.filter((m) => m.confidence === 'high').length;

    return html`
      <div class="file-summary">
        <div class="file-identity">
          ${Icons.render('fileSpreadsheet', { size: 24 })}
          <div>
            <p class="file-name">${sheet.filename}</p>
            <p class="file-meta">
              ${Format.number(sheet.rowCount)} rows · ${sheet.columns.length} columns · sheet
              “${sheet.sheetName}”${sheet.truncated ? ' · truncated to the first 200,000 rows' : ''}
            </p>
          </div>
        </div>
        <dl class="file-stats">
          <div class="file-stat">
            <dd>${Format.number(sheet.rowCount)}</dd>
            <dt>Rows</dt>
          </div>
          <div class="file-stat">
            <dd>${mapped.length}</dd>
            <dt>Mapped</dt>
          </div>
          <div class="file-stat file-stat--positive">
            <dd>${high}</dd>
            <dt>Confident</dt>
          </div>
          <div class="file-stat file-stat--review">
            <dd>${mapped.length - high}</dd>
            <dt>Check these</dt>
          </div>
        </dl>
      </div>
    `;
  }

  function renderSheetTabs() {
    return html`
      <div class="sheet-tabs" role="tablist" aria-label="Sheets in this workbook">
        ${sheets.map(
          (sheet, index) => html`
            <button
              type="button"
              class="sheet-tab"
              role="tab"
              data-sheet="${index}"
              aria-selected="${index === activeSheetIndex ? 'true' : 'false'}"
            >
              ${sheet.sheetName}
              <span class="sheet-tab-count">${Format.number(sheet.rowCount)}</span>
            </button>
          `
        )}
      </div>
    `;
  }

  const CONFIDENCE_LABEL = {
    high: 'Auto',
    medium: 'Review',
    low: 'Check',
    manual: 'Manual',
    none: 'Skipped',
  };

  const CONFIDENCE_CLASS = {
    high: 'conf-high',
    medium: 'conf-med',
    low: 'conf-low',
    manual: 'conf-high',
    none: 'conf-skip',
  };

  function renderMappingTable(sheet) {
    return html`
      <div class="table-scroll" tabindex="0" role="region" aria-label="Column mapping, scrollable">
        <table class="data-table mapping-table">
          <caption class="visually-hidden">
            Each column in your file and the GovSpirit field it maps to
          </caption>
          <thead>
            <tr>
              <th scope="col">Your column</th>
              <th scope="col"><span class="visually-hidden">maps to</span></th>
              <th scope="col">GovSpirit field</th>
              <th scope="col">Confidence</th>
              <th scope="col" class="numeric">Match</th>
            </tr>
          </thead>
          <tbody>
            ${sheet.columns.map((header) => {
              const entry = mapping[header] || {
                fieldId: SmartMapper.SKIP,
                confidence: 'none',
                score: 0,
              };
              const sample = SmartMapper.columnSample(sheet.data, header, 3).join(', ');
              const selectId = `map-${header.replace(/[^a-zA-Z0-9]/g, '-')}`;

              return html`
                <tr
                  class="${cx('mapping-row', entry.fieldId === SmartMapper.SKIP && 'mapping-row--skipped')}"
                >
                  <td>
                    <span class="mapping-source">${header}</span>
                    <span class="mapping-sample">${sample || 'no sample values'}</span>
                  </td>
                  <td class="mapping-arrow" aria-hidden="true">→</td>
                  <td class="mapping-target">
                    <label class="visually-hidden" for="${selectId}">Map column ${header} to</label>
                    <select class="control-select" id="${selectId}" data-header="${header}">
                      ${SmartMapper.FIELDS.map(
                        (field) => html`
                          <option
                            value="${field.id}"
                            ${entry.fieldId === field.id ? raw('selected') : ''}
                          >
                            ${field.label}${field.required ? ' (required)' : ''}
                          </option>
                        `
                      )}
                      <option
                        value="${SmartMapper.SKIP}"
                        ${entry.fieldId === SmartMapper.SKIP ? raw('selected') : ''}
                      >
                        Skip this column
                      </option>
                    </select>
                  </td>
                  <td class="mapping-confidence">
                    <span class="conf-badge ${CONFIDENCE_CLASS[entry.confidence] || 'conf-skip'}">
                      ${CONFIDENCE_LABEL[entry.confidence] || 'Skipped'}
                    </span>
                  </td>
                  <td class="mapping-score numeric">
                    ${entry.score > 0 ? `${Math.round(entry.score * 100)}%` : 'N/A'}
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPreview(sheet) {
    const active = Object.entries(mapping)
      .filter(([, m]) => m.fieldId !== SmartMapper.SKIP)
      .map(([header, m]) => ({ header, ...m }));

    if (!active.length) {
      return Components.emptyState({
        title: 'No columns mapped yet',
        body: 'Use the dropdowns above to tell GovSpirit what each column contains.',
        icon: 'layers',
      });
    }

    return html`
      <div class="table-scroll" tabindex="0" role="region" aria-label="Data preview, scrollable">
        <table class="data-table preview-rows">
          <caption class="visually-hidden">
            First five rows after mapping
          </caption>
          <thead>
            <tr>
              ${active.map((m) => html`<th scope="col">${m.fieldLabel}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${sheet.data.slice(0, 5).map(
              (row) => html`
                <tr>
                  ${active.map((m) => {
                    const value = row[m.header];
                    const empty = value === null || value === undefined || value === '';
                    return html`<td>
                      ${empty ? raw('<span class="text-muted">N/A</span>') : String(value).slice(0, 60)}
                    </td>`;
                  })}
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderReadiness(sheet) {
    const mapped = Object.values(mapping).filter((m) => m.fieldId !== SmartMapper.SKIP).length;
    const pct = sheet.columns.length ? Math.round((mapped / sheet.columns.length) * 100) : 0;

    return html`
      <div class="readiness">
        <div
          class="progress-track"
          role="progressbar"
          aria-valuenow="${pct}"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Columns mapped"
        >
          <div class="progress-value" ${styleAttr({ width: `${pct}%` })}></div>
        </div>
        <p class="readiness-label">${mapped} of ${sheet.columns.length} columns mapped (${pct}%)</p>
      </div>
    `;
  }

  function updateReadiness() {
    const sheet = activeSheet();
    if (!sheet) return;

    const missing = SmartMapper.missingRequired(mapping);
    const button = Dom.byId('btn-generate-upload');
    const hint = Dom.byId('commit-note');
    const count = Dom.byId('preview-count');

    if (count) count.textContent = `showing 5 of ${Format.number(sheet.rowCount)} rows`;

    if (button) button.disabled = missing.length > 0;
    if (hint) {
      hint.textContent = missing.length
        ? `Map ${missing.join(' and ')} to continue.`
        : 'Ready. Everything is processed locally in this tab.';
    }
  }

  function bindMappingEvents() {
    const container = Dom.byId('mapping-section');
    if (!container) return;

    disposers.push(
      Dom.delegate(container, '.control-select[data-header]', 'change', (event, select) => {
        mapping = SmartMapper.reassign(mapping, select.dataset.header, select.value);
        refreshMappingViews();
      })
    );

    disposers.push(
      Dom.delegate(container, '.sheet-tab', 'click', (event, button) => {
        activeSheetIndex = Number(button.dataset.sheet);
        mapping = SmartMapper.autoMap(activeSheet().columns);
        renderMappingSection();
      })
    );

    disposers.push(
      Dom.on(Dom.byId('btn-reset-mapping'), 'click', () => {
        mapping = SmartMapper.autoMap(activeSheet().columns);
        refreshMappingViews();
        Components.toast('Mapping reset to the detected values.', 'info');
      })
    );

    disposers.push(Dom.on(Dom.byId('btn-generate-upload'), 'click', generateFromUpload));
  }

  /** Re-render only the parts that depend on the mapping, preserving scroll. */
  function refreshMappingViews() {
    const sheet = activeSheet();
    if (!sheet) return;
    setHTML(Dom.byId('mapping-table-holder'), renderMappingTable(sheet));
    setHTML(Dom.byId('preview-holder'), renderPreview(sheet));
    setHTML(Dom.byId('readiness-holder'), renderReadiness(sheet));
    updateReadiness();
  }

  function generateFromUpload() {
    const sheet = activeSheet();
    if (!sheet) return;

    const button = Dom.byId('btn-generate-upload');
    if (button) {
      button.disabled = true;
      button.textContent = 'Processing…';
    }

    // Yield a frame so the button state paints before the synchronous work.
    Dom.nextFrame(() => {
      try {
        const structured = SmartMapper.applyMapping(sheet.data, mapping);
        if (!structured.length) {
          throw new Error('No usable rows after mapping. Check the column assignments above.');
        }

        Store.setColumnMappings(mapping);
        const items = structured.map(toItem);
        loadDataset(items, `${sheet.filename} · ${sheet.sheetName}`, structured.length);
      } catch (err) {
        console.error('[Import] Upload processing failed:', err);
        Components.toast(err.message || 'Processing failed.', 'error');
        if (button) {
          button.disabled = false;
          button.textContent = 'Generate analytics dashboard';
        }
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     PASTE FLOW
     ══════════════════════════════════════════════════════════════════ */

  function bindSample() {
    disposers.push(Dom.on(Dom.byId('btn-sample-open'), 'click', () => openSample('executive')));
    disposers.push(Dom.on(Dom.byId('btn-sample-download'), 'click', downloadSample));

    document.querySelectorAll('[data-sample-view]').forEach((button) => {
      disposers.push(
        Dom.on(button, 'click', () => openSample(button.getAttribute('data-sample-view')))
      );
    });
  }

  function bindPaste() {
    const textarea = Dom.byId('list-input');

    disposers.push(
      Dom.on(Dom.byId('btn-example'), 'click', () => {
        if (textarea) {
          textarea.value = EXAMPLE_TEXT;
          textarea.focus();
        }
      })
    );

    disposers.push(
      Dom.on(Dom.byId('btn-clear-text'), 'click', () => {
        if (textarea) textarea.value = '';
        parsedItems = [];
        const section = Dom.byId('parsed-section');
        if (section) {
          section.hidden = true;
          setHTML(section, '');
        }
        textarea?.focus();
      })
    );

    disposers.push(Dom.on(Dom.byId('btn-parse'), 'click', handleParse));

    disposers.push(
      Dom.on(textarea, 'keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') handleParse();
      })
    );
  }

  function handleParse() {
    const text = Dom.byId('list-input')?.value?.trim();
    if (!text) {
      Components.toast('Enter at least one item first.', 'warning');
      return;
    }

    parsedItems = ListParser.parseText(text);
    if (!parsedItems.length) {
      Components.toast('Nothing could be parsed. Try the example format.', 'error');
      return;
    }

    renderParsedResults();
  }

  function renderParsedResults() {
    const section = Dom.byId('parsed-section');
    if (!section) return;

    const items = parsedItems;
    const recognised = items.filter((i) => i.confidence === 'high').length;
    const matched = items.filter((i) => i.refId).length;
    const warnings = ListParser.validate(items);
    const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
    const totalValue = items.reduce((sum, i) => sum + (i.totalValue || 0), 0);

    section.hidden = false;
    setHTML(
      section,
      html`
        <div class="result-header">
          <div>
            <h2 class="result-title">${items.length} items structured</h2>
            <p class="result-summary">
              ${recognised} brands recognised · ${matched} matched to reference data ·
              ${items.length - recognised} need a look
            </p>
          </div>
          <div class="page-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-export-parsed">
              Export CSV
            </button>
          </div>
        </div>

        ${
          warnings.length
            ? html`<div class="warning-list">
                ${warnings.slice(0, 5).map((warning) => html`<p>${warning.message}</p>`)}
                ${warnings.length > 5 ? html`<p>…and ${warnings.length - 5} more.</p>` : ''}
              </div>`
            : html`<p class="notice notice-positive">Every line parsed cleanly.</p>`
        }

        <div class="mini-metrics">
          <div class="mini-metric">
            <p>${Format.number(items.length)}</p>
            <p>Items</p>
          </div>
          <div class="mini-metric">
            <p>${Format.number(totalQty)}</p>
            <p>Total bottles</p>
          </div>
          <div class="mini-metric">
            <p>${totalValue ? Format.currency(totalValue) : 'N/A'}</p>
            <p>Estimated value</p>
          </div>
          <div class="mini-metric">
            <p>${matched}</p>
            <p>Reference matches</p>
          </div>
        </div>

        <div class="mini-charts">
          <div class="mini-chart">
            <h3 class="mini-chart-title">By category</h3>
            <div class="mini-chart-body"><canvas id="mc-category"></canvas></div>
          </div>
          <div class="mini-chart">
            <h3 class="mini-chart-title">Suggested zones</h3>
            <div class="mini-chart-body"><canvas id="mc-zones"></canvas></div>
          </div>
          <div class="mini-chart">
            <h3 class="mini-chart-title">ABC class</h3>
            <div class="mini-chart-body"><canvas id="mc-abc"></canvas></div>
          </div>
          <div class="mini-chart">
            <h3 class="mini-chart-title">Stock cover (months)</h3>
            <div class="mini-chart-body"><canvas id="mc-cover"></canvas></div>
          </div>
        </div>

        ${Components.dataTable({
          rows: items,
          caption: 'Parsed inventory items with suggested storage zones',
          maxRows: 200,
          columns: [
            { key: 'brand', label: 'Brand', format: (v, row) => brandCell(v, row) },
            { key: 'category', label: 'Category' },
            { key: 'size', label: 'Size' },
            { key: 'qty', label: 'Qty', numeric: true, format: (v) => Format.number(v) },
            { key: 'suggestedZone', label: 'Suggested zone', format: (v) => zoneCell(v) },
            { key: 'abcClass', label: 'ABC', format: (v) => abcCell(v) },
            {
              key: 'price',
              label: 'Price',
              numeric: true,
              format: (v) => (v ? Format.currencyExact(v) : 'N/A'),
            },
            {
              key: 'totalValue',
              label: 'Value',
              numeric: true,
              format: (v) => (v ? Format.currency(v) : 'N/A'),
            },
            { key: 'stockMonths', label: 'Cover', format: (v) => coverCell(v) },
          ],
        })}
        ${renderStoragePlan(items)}

        <div class="commit-bar">
          <button type="button" class="btn btn-primary btn-lg" id="btn-generate-paste">
            Generate full analytics dashboard
          </button>
          <p class="commit-note">
            Order and dispatch history will be projected from the 12-month reference sales curve so
            the dashboards have something to trend. Projected figures are labelled throughout.
          </p>
        </div>
      `
    );

    disposers.push(
      Dom.on(Dom.byId('btn-export-parsed'), 'click', () =>
        Exporters.downloadCSV(
          items.map((item) => ({
            id: item.id,
            brand: item.brand,
            category: item.category,
            size: item.size,
            quantity: item.qty,
            suggested_zone: item.suggestedZone,
            abc_class: item.abcClass,
            unit_price: item.price ?? '',
            total_value: item.totalValue ?? '',
            stock_cover_months: item.stockMonths ?? '',
            storage_notes: item.storageNotes,
          })),
          'parsed-list'
        )
      )
    );

    disposers.push(
      Dom.on(Dom.byId('btn-generate-paste'), 'click', () => {
        loadDataset(parsedItems, 'Pasted list', parsedItems.length);
      })
    );

    renderMiniCharts(items);
    Dom.scrollIntoView(section);
  }

  const brandCell = (value, row) =>
    html`<span class="item-name">${value}</span> <span class="item-source">${row.raw}</span>`;

  const zoneCell = (zone) => {
    const color = ReferenceData.zoneColor(zone);
    return html`<span class="zone-tag" ${styleAttr({ background: `${color}26`, color })}
      >Zone ${zone}</span
    >`;
  };

  const abcCell = (cls) =>
    Components.status(cls, cls === 'A' ? 'success' : cls === 'B' ? 'warning' : 'danger');

  const coverCell = (months) => {
    if (months === null || months === undefined) return 'N/A';
    const tone = months < 1 ? 'low-stock' : months > 4 ? 'overstock' : 'ok-stock';
    return html`<span class="stock-months ${tone}">${months} mo</span>`;
  };

  function renderStoragePlan(items) {
    const groups = new Map();
    items.forEach((item) => {
      const zone = item.suggestedZone || 'C';
      if (!groups.has(zone)) groups.set(zone, []);
      groups.get(zone).push(item);
    });

    const cards = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

    return html`
      <section class="storage-plan">
        <div class="section-intro">
          <h2 class="section-title">Recommended storage plan</h2>
          <p class="section-subtitle">
            Zone allocation derived from 12 months of reference sales velocity.
          </p>
        </div>
        <div class="zone-plan">
          ${cards.map(([zone, zoneItems]) => {
            const definition = ReferenceData.ZONES[zone] || {
              label: `Zone ${zone}`,
              desc: 'Unclassified',
            };
            const color = ReferenceData.zoneColor(zone);
            const qty = zoneItems.reduce((sum, i) => sum + i.qty, 0);

            return html`
              <article class="zone-card" ${styleAttr({ '--zone-colour': color })}>
                <div class="zone-card-header">
                  <span class="zone-card-title">${definition.label}</span>
                  <div>
                    <p class="zone-card-purpose">${definition.desc}</p>
                    <p class="zone-card-totals">
                      ${zoneItems.length} SKUs · ${Format.number(qty)} bottles
                    </p>
                  </div>
                </div>
                <div class="zone-card-items">
                  ${zoneItems.map(
                    (item) => html`
                      <div class="zone-item">
                        <p class="zone-item-name">
                          ${item.brand}<span class="zone-item-size">${item.size}</span>
                        </p>
                        <p class="zone-item-qty">${Format.number(item.qty)} bottles</p>
                        <p class="zone-item-note">${item.storageNotes}</p>
                      </div>
                    `
                  )}
                </div>
              </article>
            `;
          })}
        </div>
      </section>
    `;
  }

  function renderMiniCharts(items) {
    const byCategory = {};
    const byZone = {};
    const abc = { A: 0, B: 0, C: 0 };

    items.forEach((item) => {
      byCategory[item.category] = (byCategory[item.category] || 0) + item.qty;
      byZone[item.suggestedZone] = (byZone[item.suggestedZone] || 0) + 1;
      if (abc[item.abcClass] !== undefined) abc[item.abcClass] += 1;
    });

    const categories = Object.keys(byCategory);
    if (categories.length) {
      Charts.create(
        'mc-category',
        {
          type: 'doughnut',
          data: {
            labels: categories,
            datasets: [
              {
                data: categories.map((c) => byCategory[c]),
                backgroundColor: categories.map((c) => ReferenceData.categoryColor(c)),
                borderWidth: 0,
              },
            ],
          },
          options: { cutout: '58%' },
        },
        {
          preset: { noScales: true, legend: true, legendPos: 'right' },
          label: 'Bottles by category',
        }
      );
    }

    const zones = Object.keys(byZone).sort();
    if (zones.length) {
      Charts.create(
        'mc-zones',
        {
          type: 'bar',
          data: {
            labels: zones.map((z) => `Zone ${z}`),
            datasets: [
              {
                label: 'SKUs',
                data: zones.map((z) => byZone[z]),
                backgroundColor: zones.map((z) => ReferenceData.zoneColor(z)),
                borderRadius: 4,
              },
            ],
          },
        },
        { label: 'SKU count by suggested zone' }
      );
    }

    Charts.create(
      'mc-abc',
      {
        type: 'doughnut',
        data: {
          labels: ['Class A', 'Class B', 'Class C'],
          datasets: [
            {
              data: [abc.A, abc.B, abc.C],
              backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
              borderWidth: 0,
            },
          ],
        },
        options: { cutout: '58%' },
      },
      { preset: { noScales: true, legend: true, legendPos: 'right' }, label: 'ABC class split' }
    );

    const cover = items.filter((i) => i.stockMonths !== null).slice(0, 8);
    if (cover.length) {
      Charts.create(
        'mc-cover',
        {
          type: 'bar',
          data: {
            labels: cover.map((i) => i.brand),
            datasets: [
              {
                label: 'Months of cover',
                data: cover.map((i) => i.stockMonths),
                backgroundColor: cover.map((i) =>
                  i.stockMonths < 1 ? '#f43f5e' : i.stockMonths < 2 ? '#f59e0b' : '#10b981'
                ),
                borderRadius: 4,
              },
            ],
          },
        },
        { label: 'Months of stock cover by brand' }
      );
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     SHARED: items -> dataset -> pipeline
     ══════════════════════════════════════════════════════════════════ */

  /** Convert one mapped spreadsheet row into the internal item shape. */
  function toItem(row, index) {
    const qty = Math.max(1, Math.round(Format.toNumber(row.quantity, 0)) || 1);

    let size = null;
    if (row.size) {
      const text = String(row.size).trim();
      const match = /(\d+(?:\.\d+)?)\s*(ml|l|ltr|litre|liter)\b/i.exec(text);
      if (match) {
        const value = Number.parseFloat(match[1]);
        size = `${match[2].toLowerCase().startsWith('l') ? Math.round(value * 1000) : Math.round(value)}ml`;
      } else if (/^\d+$/.test(text)) {
        size = `${text}ml`;
      } else {
        size = text;
      }
    }

    const brand = String(row.brand ?? '').trim() || 'Unknown';
    const category = String(row.category ?? '').trim() || detectCategory(brand);
    const reference = ReferenceData.findByBrandSize(brand, size);

    let price = Format.toNumber(row.price, 0) || null;
    if (!price && reference) price = reference.price;

    const declaredValue = Format.toNumber(row.total_value, 0) || null;
    const suggestedZone = reference
      ? reference.suggestedZone
      : ReferenceData.defaultZoneFor(category);

    return {
      id: String(row.sku_id ?? '').trim() || `ITEM-${String(index + 1).padStart(4, '0')}`,
      brand,
      category,
      size: size || (category === 'Beer' ? '650ml' : '750ml'),
      qty,
      location: row.zone || row.rack || null,
      suggestedZone: normaliseZone(row.zone) || suggestedZone,
      abcClass: reference ? reference.abcClass : 'C',
      velocity: reference ? reference.velocity : 'Unknown',
      price,
      avgMonthlySales: reference ? reference.avgMonthlySales : null,
      stockMonths: reference?.avgMonthlySales
        ? Number((qty / reference.avgMonthlySales).toFixed(1))
        : null,
      storageNotes: reference ? reference.storageNotes : `Suggested Zone ${suggestedZone}.`,
      supplier: String(row.supplier ?? '').trim() || reference?.supplier || 'Unknown',
      receivedDate: row.received_date || null,
      totalValue: declaredValue || (price ? price * qty : null),
      refId: reference ? reference.id : null,
      raw: '',
    };
  }

  function normaliseZone(value) {
    if (!value) return null;
    const letter = String(value).toUpperCase().replace(/ZONE/g, '').trim().charAt(0);
    return /[A-F]/.test(letter) ? letter : null;
  }

  function detectCategory(name) {
    const n = String(name).toLowerCase();
    if (/whisk(y|ey)|scotch|bourbon/.test(n)) return 'Whisky';
    if (/\brum\b/.test(n)) return 'Rum';
    if (/beer|lager|ale|stout/.test(n)) return 'Beer';
    if (/wine|merlot|chardonnay|shiraz|sauvignon/.test(n)) return 'Wine';
    if (/vodka/.test(n)) return 'Vodka';
    if (/\bgin\b/.test(n)) return 'Gin';
    if (/brandy|cognac/.test(n)) return 'Brandy';
    return 'Unknown';
  }

  /**
   * Build a dataset from parsed items.
   *
   * The inventory is real: it comes from the operator's file. Orders and
   * dispatch are PROJECTED from the reference sales curve so the trend and
   * fulfilment views have something to show. The store records this in
   * `dataSource` and the dashboards display a standing notice, because a
   * projected fill rate must never be mistaken for a measured one.
   */
  function projectDataset(items) {
    const random = seededRandom(items.length * 7919 + 13);
    const int = (min, max) => Math.floor(random() * (max - min + 1)) + min;
    const today = Format.startOfToday();
    const dayAgo = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return Format.dayKey(d);
    };

    const inventory = items.map((item) => {
      const unitPrice = item.price || int(100, 800);
      const daysInStock = item.receivedDate
        ? Math.max(0, Format.daysBetween(item.receivedDate, today) ?? int(5, 85))
        : int(5, 85);

      return {
        sku_id: item.id,
        sku_name: `${item.brand} ${item.size}`,
        brand: item.brand,
        category: item.category,
        alcohol_type: item.category,
        bottle_size: item.size,
        zone: item.suggestedZone,
        rack_id: `${item.suggestedZone}${String(int(1, 5)).padStart(2, '0')}`,
        bin_id: `${item.suggestedZone}${String(int(1, 5)).padStart(2, '0')}-B${String(int(1, 10)).padStart(2, '0')}`,
        quantity_bottles: item.qty,
        quantity_cases: Math.ceil(item.qty / 12),
        unit_price: unitPrice,
        total_value: item.totalValue || item.qty * unitPrice,
        days_in_stock: daysInStock,
        last_received_date: item.receivedDate || dayAgo(daysInStock),
        last_dispatched_date: dayAgo(int(0, Math.max(1, Math.min(daysInStock, 30)))),
        supplier: item.supplier,
        condition: 'Good',
        is_active: 'Yes',
      };
    });

    const orders = [];
    const dispatchRows = [];
    let orderNumber = 1;
    let dispatchNumber = 1;

    inventory.forEach((row) => {
      const reference =
        ReferenceData.findByBrandSize(row.brand, row.bottle_size) ||
        ReferenceData.findByBrandSize(row.brand, null);
      const dailyAverage = reference ? reference.avgMonthlySales / 30 : int(1, 12);

      for (let day = 90; day >= 1; day -= 1) {
        if (random() > 0.4) continue;
        const quantity = Math.max(1, Math.round(dailyAverage * (0.5 + random())));
        const hotel = ReferenceData.HOTELS[int(0, ReferenceData.HOTELS.length - 1)];
        const orderId = `ORD-${String(orderNumber++).padStart(6, '0')}`;
        const completed = day > 3;

        orders.push({
          order_id: orderId,
          hotel_name: hotel,
          sku_id: row.sku_id,
          sku_name: row.sku_name,
          brand: row.brand,
          category: row.category,
          bottle_size: row.bottle_size,
          quantity_ordered: quantity + int(0, 8),
          quantity_fulfilled: completed ? quantity : 0,
          unit_price: row.unit_price,
          order_date: dayAgo(day),
          delivery_date: completed ? dayAgo(Math.max(0, day - int(0, 2))) : null,
          status: completed ? 'Completed' : 'Pending',
        });

        if (completed) {
          dispatchRows.push({
            dispatch_id: `DSP-${String(dispatchNumber++).padStart(6, '0')}`,
            order_id: orderId,
            hotel_name: hotel,
            sku_id: row.sku_id,
            sku_name: row.sku_name,
            brand: row.brand,
            category: row.category,
            quantity_dispatched: quantity,
            dispatch_value: quantity * row.unit_price,
            dispatch_date: dayAgo(Math.max(0, day - int(0, 2))),
            vehicle: `TN-0${int(1, 3)}-AB-${int(1000, 9999)}`,
            dispatch_time_minutes: int(25, 90),
          });
        }
      }
    });

    return { inventory, orders, dispatch: dispatchRows, skuMaster: inventory };
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function loadDataset(items, sourceLabel, rowCount) {
    Store.clearAllData();
    const dataset = projectDataset(items);
    Object.entries(dataset).forEach(([key, rows]) => Store.setRawData(key, rows));

    validationResult = DataValidator.validateAll(Store.rawData());
    Store.setValidation({
      warnings: validationResult.warnings,
      errors: validationResult.errors,
      score: validationResult.score,
    });

    const result = Pipeline.run({ source: `${sourceLabel} (order history projected)` });
    if (!result.ok) {
      Components.toast(
        `Analytics failed: ${result.error?.message || 'unknown error'}. See the console.`,
        'error'
      );
      return;
    }

    GovSpirit.Router.navigate('executive');
    Components.toast(`${Format.number(rowCount)} rows loaded. Dashboard ready.`, 'success');
  }

  /**
   * Generate the sample depot and land on a chosen view.
   *
   * @param {string} view Router view to open once the pipeline has run.
   */
  function openSample(view) {
    const buttons = [
      Dom.byId('btn-sample-open'),
      ...document.querySelectorAll('[data-sample-view]'),
    ].filter(Boolean);

    buttons.forEach((button) => {
      button.disabled = true;
    });
    Components.toast('Building the sample depot…', 'info', 4000);

    Dom.nextFrame(() => {
      Store.clearAllData();
      const dataset = DemoData.generate();
      Object.entries(dataset).forEach(([key, rows]) => Store.setRawData(key, rows));

      const result = Pipeline.run({ source: 'Sample depot' });
      buttons.forEach((button) => {
        button.disabled = false;
      });

      if (!result.ok) {
        Components.toast('Could not build the sample depot.', 'error');
        return;
      }

      GovSpirit.Router.navigate(view);
      Components.toast(
        `Sample depot loaded: ${Format.number(dataset.inventory.length)} inventory lines.`,
        'success'
      );
    });
  }

  /**
   * Write the sample out as a spreadsheet the uploader can read back, so the
   * mapping step can be tried without anyone needing a file of their own.
   */
  function downloadSample() {
    const button = Dom.byId('btn-sample-download');
    if (button) button.disabled = true;

    Dom.nextFrame(() => {
      const rows = SampleFile.rows();
      Exporters.downloadCSV(rows, 'govspirit-sample-depot', SampleFile.HEADERS);
      if (button) button.disabled = false;
      Components.toast(
        `Sample file saved: ${Format.number(rows.length)} rows. Upload it above to see the column mapping.`,
        'success',
        7000
      );
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     LIFECYCLE
     ══════════════════════════════════════════════════════════════════ */

  function mount() {
    bindTabs();
    bindUpload();
    bindPaste();
    bindSample();
    selectTab(activeTab);
  }

  function unmount() {
    disposers.forEach((dispose) => dispose());
    disposers = [];
    resetState();
  }

  GovSpirit.Pages = GovSpirit.Pages || {};
  GovSpirit.Pages.import = { title: 'Import data', render, mount, unmount };
})(window.GovSpirit);
