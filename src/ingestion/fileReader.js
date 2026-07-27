/**
 * GovSpirit spreadsheet and CSV reading.
 *
 * Everything happens in the browser: files are read with the FileReader API
 * and never transmitted. SheetJS is fetched on demand the first time a
 * workbook is opened rather than on page load.
 *
 * The CSV path is a real RFC 4180 parser. The previous `split(',')`
 * implementation corrupted any export containing a quoted comma (every address
 * column), a quoted newline (every remarks column), or CRLF line endings
 * (every file produced on Windows, which is all of them).
 */
(function initFileReader(GovSpirit) {
  'use strict';

  const { Exporters } = GovSpirit.require('Exporters');

  /** Reject absurd files early rather than freezing the tab. */
  const MAX_FILE_BYTES = 60 * 1024 * 1024; // 60 MB
  const MAX_ROWS_PER_SHEET = 200000;
  const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.csv', '.tsv', '.txt'];

  /**
   * Heuristics for guessing what a sheet contains. Scores combine file-name
   * hints with column-name hints; the highest score wins and the operator can
   * always override it in the UI.
   */
  const FILE_SIGNATURES = Object.freeze({
    inventory: {
      label: 'Inventory',
      icon: 'package',
      nameHints: ['inventory', 'stock', 'invent', 'current_stock', 'closing'],
      columnHints: [
        ['qty', 'quantity', 'stock', 'bottles'],
        ['bin', 'rack', 'location', 'zone'],
        ['sku', 'item', 'material', 'product'],
      ],
    },
    skuMaster: {
      label: 'SKU Master',
      icon: 'tag',
      nameHints: ['sku', 'master', 'product', 'material', 'item_master', 'pricelist'],
      columnHints: [
        ['sku', 'item', 'material'],
        ['brand', 'manufacturer'],
        ['price', 'cost', 'mrp'],
      ],
    },
    orders: {
      label: 'Hotel Orders',
      icon: 'listChecks',
      nameHints: ['order', 'hotel', 'request', 'purchase', 'indent'],
      columnHints: [
        ['order', 'request', 'indent'],
        ['hotel', 'customer', 'outlet', 'licensee'],
        ['date', 'order_date'],
      ],
    },
    dispatch: {
      label: 'Dispatch',
      icon: 'truck',
      nameHints: ['dispatch', 'delivery', 'shipment', 'outbound', 'challan'],
      columnHints: [
        ['dispatch', 'delivery', 'shipment', 'challan'],
        ['vehicle', 'truck', 'driver'],
        ['date', 'dispatch_date'],
      ],
    },
    warehouseLayout: {
      label: 'Warehouse Layout',
      icon: 'warehouse',
      nameHints: ['layout', 'warehouse', 'floor', 'rack', 'bin_master', 'godown'],
      columnHints: [
        ['zone', 'area'],
        ['rack', 'shelf'],
        ['capacity', 'bin', 'slot'],
      ],
    },
    goodsReceipt: {
      label: 'Goods Receipt',
      icon: 'import',
      nameHints: ['goods_receipt', 'receipt', 'grn', 'inbound', 'receiving'],
      columnHints: [
        ['receipt', 'grn', 'received'],
        ['supplier', 'vendor'],
        ['date', 'receipt_date'],
      ],
    },
    stockMovement: {
      label: 'Stock Movement',
      icon: 'refresh',
      nameHints: ['movement', 'transfer', 'relocation', 'move'],
      columnHints: [
        ['from', 'source'],
        ['to', 'destination'],
        ['movement', 'transfer', 'reason'],
      ],
    },
    suppliers: {
      label: 'Suppliers',
      icon: 'factory',
      nameHints: ['supplier', 'vendor', 'manufacturer', 'distillery'],
      columnHints: [
        ['supplier', 'vendor', 'manufacturer'],
        ['contact', 'phone', 'email'],
      ],
    },
    employees: {
      label: 'Employees',
      icon: 'users',
      nameHints: ['employee', 'staff', 'worker', 'personnel', 'roster'],
      columnHints: [
        ['employee', 'staff', 'name'],
        ['role', 'designation', 'position'],
        ['shift', 'schedule'],
      ],
    },
    damage: {
      label: 'Damage Register',
      icon: 'alertOctagon',
      nameHints: ['damage', 'broken', 'breakage', 'loss', 'defect'],
      columnHints: [
        ['damage', 'damaged', 'broken'],
        ['cause', 'reason'],
        ['qty_damaged', 'quantity_damaged'],
      ],
    },
    cycleCount: {
      label: 'Cycle Count',
      icon: 'hash',
      nameHints: ['cycle_count', 'stocktake', 'physical_count', 'verification'],
      columnHints: [
        ['physical', 'actual_qty', 'counted'],
        ['variance', 'difference'],
        ['system_qty', 'book_qty'],
      ],
    },
    returns: {
      label: 'Returns',
      icon: 'rotateBack',
      nameHints: ['return', 'returned', 'reversal', 'refusal'],
      columnHints: [
        ['return', 'returned'],
        ['reason', 'remarks'],
        ['qty_returned', 'quantity_returned'],
      ],
    },
  });

  const normaliseToken = (text) =>
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');

  /**
   * Guess the dataset type for a sheet.
   * @returns {{detectedType: string, detectedLabel: string, detectionScore: number}}
   */
  function detectFileType(sourceName, columns) {
    const name = normaliseToken(sourceName);
    const cols = (columns || []).map(normaliseToken);

    let bestType = 'inventory';
    let bestScore = 0;

    Object.entries(FILE_SIGNATURES).forEach(([type, signature]) => {
      let score = 0;
      signature.nameHints.forEach((hint) => {
        if (name.includes(hint)) score += 3;
      });
      signature.columnHints.forEach((group) => {
        if (group.some((hint) => cols.some((col) => col.includes(hint)))) score += 2;
      });
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    });

    return {
      detectedType: bestType,
      detectedLabel: FILE_SIGNATURES[bestType].label,
      detectionScore: bestScore,
    };
  }

  /* ── CSV ──────────────────────────────────────────────────────────────── */

  /** Pick the delimiter by counting candidates outside quoted regions. */
  function sniffDelimiter(sample) {
    const candidates = [',', ';', '\t', '|'];
    let best = ',';
    let bestCount = 0;

    candidates.forEach((delimiter) => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < sample.length; i += 1) {
        const char = sample[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === delimiter && !inQuotes) count += 1;
      }
      if (count > bestCount) {
        bestCount = count;
        best = delimiter;
      }
    });

    return best;
  }

  /**
   * RFC 4180 parser. Handles quoted fields containing the delimiter, escaped
   * double quotes (""), embedded newlines, and CR / LF / CRLF endings.
   * @returns {string[][]}
   */
  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    // Strip a UTF-8 BOM, which otherwise becomes part of the first header.
    const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];

      if (inQuotes) {
        if (char === '"') {
          if (input[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field);
        field = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && input[i + 1] === '\n') i += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  /** Make header names unique and non-empty so no column is silently lost. */
  function normaliseHeaders(rawHeaders) {
    const seen = new Map();
    return rawHeaders.map((header, index) => {
      let name = String(header ?? '').trim();
      if (!name) name = `Column ${index + 1}`;
      const count = seen.get(name) || 0;
      seen.set(name, count + 1);
      return count === 0 ? name : `${name} (${count + 1})`;
    });
  }

  function parseCSV(text, filename) {
    const delimiter = sniffDelimiter(text.slice(0, 8000));
    const matrix = parseDelimited(text, delimiter).filter((row) =>
      row.some((cell) => String(cell).trim() !== '')
    );

    if (matrix.length === 0) return [];

    const columns = normaliseHeaders(matrix[0]);
    const data = matrix.slice(1, MAX_ROWS_PER_SHEET + 1).map((values) => {
      const record = {};
      columns.forEach((column, i) => {
        const value = values[i];
        record[column] = value === undefined || value === '' ? null : String(value).trim();
      });
      return record;
    });

    return [
      {
        sheetName: 'Sheet1',
        filename,
        data,
        columns,
        rowCount: data.length,
        ...detectFileType(filename, columns),
      },
    ];
  }

  /* ── Workbooks ────────────────────────────────────────────────────────── */

  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(new Uint8Array(event.target.result));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsArrayBuffer(file);
    });
  }

  async function parseWorkbook(file) {
    // Shares the pinned, integrity-checked CDN entry with the export layer so
    // there is only one place to bump the version.
    const XLSXLib = await Exporters.loadScript(Exporters.CDN.xlsx);

    const bytes = await readAsArrayBuffer(file);
    const workbook = XLSXLib.read(bytes, { type: 'array', cellDates: true, dense: false });

    const sheets = [];
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;

      // `raw: false` returns display strings, which keeps 0-prefixed SKU codes
      // ("007412") intact instead of silently turning them into numbers.
      const json = XLSXLib.utils.sheet_to_json(sheet, {
        defval: null,
        raw: false,
        blankrows: false,
      });
      if (!json.length) return;

      const columns = normaliseHeaders(Object.keys(json[0]));
      const data = json.length > MAX_ROWS_PER_SHEET ? json.slice(0, MAX_ROWS_PER_SHEET) : json;

      sheets.push({
        sheetName,
        filename: file.name,
        data,
        columns,
        rowCount: data.length,
        truncated: json.length > MAX_ROWS_PER_SHEET,
        ...detectFileType(`${file.name}_${sheetName}`, columns),
      });
    });

    return sheets;
  }

  function isAccepted(file) {
    const name = String(file?.name || '').toLowerCase();
    return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  }

  /**
   * Parse a list of files into sheet descriptors.
   *
   * Never rejects: a failure on one file is reported through `onProgress` and
   * collected in the result so the operator can see exactly which file failed
   * and why, rather than losing the whole batch.
   *
   * @param {File[]} files
   * @param {(update: object) => void} [onProgress]
   * @returns {Promise<{sheets: object[], errors: {file: string, message: string}[]}>}
   */
  async function processFiles(files, onProgress) {
    const sheets = [];
    const errors = [];
    const total = files.length || 1;
    let done = 0;

    const report = (update) => {
      if (typeof onProgress === 'function') onProgress(update);
    };

    for (const file of files) {
      report({ file: file.name, progress: done / total, status: 'parsing' });

      try {
        if (!isAccepted(file)) {
          throw new Error('Unsupported file type. Use .xlsx, .xls, .csv or .tsv.');
        }
        if (file.size > MAX_FILE_BYTES) {
          throw new Error(
            `File is ${(file.size / 1024 / 1024).toFixed(0)} MB, above the ${
              MAX_FILE_BYTES / 1024 / 1024
            } MB limit.`
          );
        }
        if (file.size === 0) {
          throw new Error('File is empty.');
        }

        const lower = file.name.toLowerCase();
        const parsed =
          lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')
            ? parseCSV(await file.text(), file.name)
            : await parseWorkbook(file);

        if (parsed.length === 0) {
          throw new Error('No readable rows found. Check the sheet has a header row.');
        }

        sheets.push(...parsed);
        report({ file: file.name, progress: (done + 1) / total, status: 'done' });
      } catch (err) {
        console.error(`[FileReader] ${file.name}:`, err);
        errors.push({ file: file.name, message: err.message });
        report({
          file: file.name,
          progress: (done + 1) / total,
          status: 'error',
          error: err.message,
        });
      }

      done += 1;
    }

    return { sheets, errors };
  }

  GovSpirit.FileReader = {
    FILE_SIGNATURES,
    ACCEPTED_EXTENSIONS,
    MAX_FILE_BYTES,
    isAccepted,
    detectFileType,
    parseCSV,
    parseDelimited,
    processFiles,
    signatureFor: (type) => FILE_SIGNATURES[type] || null,
  };
})(window.GovSpirit);
