/**
 * GovSpirit File Reader — Parses Excel/CSV files using SheetJS
 * Detects file type based on column patterns and file names.
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.FileReader = (function () {
  const { Utils } = GovSpirit;

  // ─── File Type Detection Signatures ──────────────────────────────────────

  const FILE_SIGNATURES = {
    inventory: {
      label: 'Inventory',
      icon: '📦',
      required: ['quantity', 'location', 'sku'],
      nameHints: ['inventory', 'stock', 'invent', 'current_stock'],
      columnHints: [['qty', 'quantity', 'stock'], ['bin', 'rack', 'location'], ['sku', 'item', 'material', 'product']],
    },
    skuMaster: {
      label: 'SKU Master',
      icon: '🏷️',
      required: ['sku', 'brand'],
      nameHints: ['sku', 'master', 'product', 'material', 'item_master'],
      columnHints: [['sku', 'item', 'material'], ['brand', 'manufacturer'], ['price', 'cost', 'value']],
    },
    orders: {
      label: 'Hotel Orders',
      icon: '🛒',
      required: ['hotel', 'date', 'quantity'],
      nameHints: ['order', 'hotel', 'request', 'purchase'],
      columnHints: [['order', 'request'], ['hotel', 'customer', 'outlet'], ['date', 'order_date']],
    },
    dispatch: {
      label: 'Dispatch',
      icon: '🚛',
      required: ['dispatch', 'quantity'],
      nameHints: ['dispatch', 'delivery', 'shipment', 'outbound'],
      columnHints: [['dispatch', 'delivery', 'shipment'], ['vehicle', 'truck', 'driver'], ['date', 'dispatch_date']],
    },
    warehouseLayout: {
      label: 'Warehouse Layout',
      icon: '🗺️',
      required: ['zone', 'rack'],
      nameHints: ['layout', 'warehouse', 'floor', 'rack', 'bin_master'],
      columnHints: [['zone', 'area'], ['rack', 'shelf'], ['bin', 'slot', 'location']],
    },
    goodsReceipt: {
      label: 'Goods Receipt',
      icon: '📥',
      required: ['receipt', 'received'],
      nameHints: ['goods_receipt', 'receipt', 'gr', 'inbound', 'receiving'],
      columnHints: [['receipt', 'gr', 'received'], ['supplier', 'vendor'], ['date', 'receipt_date']],
    },
    stockMovement: {
      label: 'Stock Movement',
      icon: '🔄',
      required: ['from', 'to', 'movement'],
      nameHints: ['movement', 'transfer', 'relocation', 'move'],
      columnHints: [['from', 'source', 'from_location'], ['to', 'destination', 'to_location'], ['movement', 'transfer', 'reason']],
    },
    suppliers: {
      label: 'Suppliers',
      icon: '🏭',
      required: ['supplier'],
      nameHints: ['supplier', 'vendor', 'manufacturer'],
      columnHints: [['supplier', 'vendor', 'manufacturer'], ['contact', 'phone', 'email']],
    },
    employees: {
      label: 'Employees',
      icon: '👤',
      required: ['employee', 'name'],
      nameHints: ['employee', 'staff', 'worker', 'personnel'],
      columnHints: [['employee', 'staff', 'name'], ['role', 'designation', 'position'], ['shift', 'schedule']],
    },
    damage: {
      label: 'Damage Register',
      icon: '💔',
      required: ['damage'],
      nameHints: ['damage', 'broken', 'loss', 'defect'],
      columnHints: [['damage', 'damaged', 'broken'], ['cause', 'reason'], ['quantity_damaged', 'qty_damaged']],
    },
    cycleCount: {
      label: 'Cycle Count',
      icon: '🔢',
      required: ['count', 'physical'],
      nameHints: ['cycle_count', 'count', 'stocktake', 'physical_count'],
      columnHints: [['count', 'physical_qty', 'actual_qty'], ['variance', 'difference'], ['system_qty', 'book_qty']],
    },
    returns: {
      label: 'Returns',
      icon: '↩️',
      required: ['return'],
      nameHints: ['return', 'returned', 'reversal', 'refusal'],
      columnHints: [['return', 'returned', 'reversal'], ['reason', 'remarks'], ['quantity_returned', 'qty_returned']],
    },
  };

  // ─── Detect File Type ─────────────────────────────────────────────────────

  function detectFileType(filename, columns) {
    const lower = filename.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const lowerCols = columns.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, '_'));

    let bestType = null, bestScore = 0;

    Object.entries(FILE_SIGNATURES).forEach(([type, sig]) => {
      let score = 0;

      // Name hints
      sig.nameHints.forEach(hint => { if (lower.includes(hint)) score += 3; });

      // Column pattern matching
      sig.columnHints.forEach(group => {
        const matched = group.some(hint => lowerCols.some(col => col.includes(hint)));
        if (matched) score += 2;
      });

      if (score > bestScore) { bestScore = score; bestType = type; }
    });

    return { type: bestType || 'inventory', score: bestScore, label: FILE_SIGNATURES[bestType || 'inventory']?.label || 'Unknown' };
  }

  // ─── Parse File ───────────────────────────────────────────────────────────

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      if (typeof XLSX === 'undefined') {
        reject(new Error('SheetJS (XLSX) library not loaded. Check your internet connection.'));
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });

          const results = [];

          workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
            if (!json.length) return;

            const columns = Object.keys(json[0]);
            const detection = detectFileType(file.name + '_' + sheetName, columns);

            results.push({
              sheetName,
              filename: file.name,
              data: json,
              columns,
              rowCount: json.length,
              detectedType: detection.type,
              detectedLabel: detection.label,
              detectionScore: detection.score,
            });
          });

          resolve(results);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file: ' + file.name));
      reader.readAsArrayBuffer(file);
    });
  }

  // ─── Parse CSV ────────────────────────────────────────────────────────────

  function parseCSV(text, filename) {
    const lines = text.trim().split('\n');
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i] !== undefined ? values[i].trim().replace(/"/g, '') : null; });
      return row;
    });
    const detection = detectFileType(filename, headers);
    return [{ sheetName: 'Sheet1', filename, data, columns: headers, rowCount: data.length, ...detection }];
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; }
      else if (line[i] === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += line[i]; }
    }
    result.push(current);
    return result;
  }

  // ─── Handle Multiple Files ────────────────────────────────────────────────

  async function processFiles(files, onProgress) {
    const allResults = [];
    let processed = 0;

    for (const file of files) {
      try {
        onProgress && onProgress({ file: file.name, progress: processed / files.length, status: 'parsing' });

        let results;
        if (file.name.toLowerCase().endsWith('.csv')) {
          const text = await file.text();
          results = parseCSV(text, file.name);
        } else {
          results = await parseFile(file);
        }

        allResults.push(...results);
        processed++;
        onProgress && onProgress({ file: file.name, progress: processed / files.length, status: 'done' });
      } catch (err) {
        console.error(`[FileReader] Failed to parse ${file.name}:`, err);
        onProgress && onProgress({ file: file.name, progress: processed / files.length, status: 'error', error: err.message });
        processed++;
      }
    }

    return allResults;
  }

  // ─── Get File Type Signature ──────────────────────────────────────────────

  function getFileSignature(type) {
    return FILE_SIGNATURES[type] || null;
  }

  function getAllSignatures() {
    return FILE_SIGNATURES;
  }

  return { processFiles, parseFile, parseCSV, detectFileType, getFileSignature, getAllSignatures };
})();
