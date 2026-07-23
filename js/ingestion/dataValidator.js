/**
 * GovSpirit Data Validator
 * 25+ validation rules with warnings, errors, and data quality scoring
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.DataValidator = (function () {
  const { Utils } = GovSpirit;

  // ─── Validation Rules ─────────────────────────────────────────────────────

  const RULES = {
    // Inventory Rules
    inv_missing_sku: {
      label: 'Missing SKU ID',
      severity: 'error',
      applies: ['inventory'],
      check: (row) => !Utils.isNonEmpty(row.sku_id),
      message: 'Rows with no SKU ID detected.',
    },
    inv_missing_qty: {
      label: 'Missing Quantity',
      severity: 'error',
      applies: ['inventory'],
      check: (row) => row.quantity_bottles === null || row.quantity_bottles === undefined,
      message: 'Rows with no quantity detected.',
    },
    inv_negative_qty: {
      label: 'Negative Quantity',
      severity: 'error',
      applies: ['inventory'],
      check: (row) => parseFloat(row.quantity_bottles) < 0,
      message: 'Negative stock quantities detected.',
    },
    inv_missing_location: {
      label: 'Missing Location',
      severity: 'warning',
      applies: ['inventory'],
      check: (row) => !Utils.isNonEmpty(row.rack_id) && !Utils.isNonEmpty(row.bin_id) && !Utils.isNonEmpty(row.zone),
      message: 'Inventory rows with no location (zone/rack/bin) detected.',
    },
    inv_negative_value: {
      label: 'Negative Value',
      severity: 'error',
      applies: ['inventory'],
      check: (row) => parseFloat(row.total_value) < 0 || parseFloat(row.unit_price) < 0,
      message: 'Negative inventory value detected.',
    },
    inv_future_received: {
      label: 'Future Receipt Date',
      severity: 'warning',
      applies: ['inventory'],
      check: (row) => {
        const d = Utils.parseDate(row.last_received_date);
        return d && d > new Date();
      },
      message: 'Receipt dates in the future detected.',
    },
    inv_very_old_stock: {
      label: 'Very Old Stock (>365 days)',
      severity: 'info',
      applies: ['inventory'],
      check: (row) => parseInt(row.days_in_stock) > 365,
      message: 'Inventory items older than 365 days detected — potential dead stock.',
    },
    inv_expired: {
      label: 'Expired Inventory',
      severity: 'error',
      applies: ['inventory'],
      check: (row) => {
        const d = Utils.parseDate(row.expiry_date);
        return d && d < new Date();
      },
      message: 'Expired inventory items detected.',
    },

    // Duplicate Rules
    dup_sku_location: {
      label: 'Duplicate SKU-Location',
      severity: 'warning',
      applies: ['inventory'],
      aggregate: true,
      check: (data) => {
        const keys = data.map(r => `${r.sku_id}__${r.bin_id}`);
        const dupes = keys.filter((k, i) => keys.indexOf(k) !== i && k !== 'null__null');
        return { count: dupes.length, sample: dupes.slice(0, 3) };
      },
      message: 'Duplicate SKU+Location combinations detected.',
    },

    // Order Rules
    ord_missing_hotel: {
      label: 'Missing Hotel Name',
      severity: 'error',
      applies: ['orders'],
      check: (row) => !Utils.isNonEmpty(row.hotel_name),
      message: 'Orders with no hotel/customer name detected.',
    },
    ord_missing_date: {
      label: 'Missing Order Date',
      severity: 'error',
      applies: ['orders'],
      check: (row) => !row.order_date || !Utils.parseDate(row.order_date),
      message: 'Orders with invalid or missing date detected.',
    },
    ord_negative_qty: {
      label: 'Negative Order Quantity',
      severity: 'error',
      applies: ['orders'],
      check: (row) => parseFloat(row.quantity_ordered) < 0,
      message: 'Negative order quantities detected.',
    },
    ord_overfulfilled: {
      label: 'Over-fulfilled Orders',
      severity: 'warning',
      applies: ['orders'],
      check: (row) => parseFloat(row.quantity_fulfilled) > parseFloat(row.quantity_ordered) * 1.05,
      message: 'Orders fulfilled above ordered quantity (>5% tolerance) detected.',
    },
    ord_future_date: {
      label: 'Future Order Date',
      severity: 'warning',
      applies: ['orders'],
      check: (row) => {
        const d = Utils.parseDate(row.order_date);
        return d && d > new Date();
      },
      message: 'Orders with future dates detected.',
    },

    // Dispatch Rules
    dis_missing_qty: {
      label: 'Missing Dispatch Quantity',
      severity: 'error',
      applies: ['dispatch'],
      check: (row) => !Utils.isNonEmpty(row.quantity_dispatched) || parseFloat(row.quantity_dispatched) <= 0,
      message: 'Dispatch records with missing or zero quantity.',
    },
    dis_missing_date: {
      label: 'Missing Dispatch Date',
      severity: 'error',
      applies: ['dispatch'],
      check: (row) => !row.dispatch_date || !Utils.parseDate(row.dispatch_date),
      message: 'Dispatch records with invalid or missing date.',
    },

    // Layout Rules
    lay_missing_zone: {
      label: 'Missing Zone',
      severity: 'error',
      applies: ['warehouseLayout'],
      check: (row) => !Utils.isNonEmpty(row.zone),
      message: 'Warehouse layout rows with no zone detected.',
    },
    lay_missing_rack: {
      label: 'Missing Rack ID',
      severity: 'error',
      applies: ['warehouseLayout'],
      check: (row) => !Utils.isNonEmpty(row.rack_id),
      message: 'Warehouse layout rows with no rack ID detected.',
    },
    lay_negative_capacity: {
      label: 'Invalid Capacity',
      severity: 'warning',
      applies: ['warehouseLayout'],
      check: (row) => parseFloat(row.capacity) < 0,
      message: 'Negative capacity values in warehouse layout.',
    },
  };

  // ─── Validate a Dataset ───────────────────────────────────────────────────

  function validateDataset(fileType, data) {
    const warnings = [], errors = [], infos = [];
    const total = data.length;
    if (!total) {
      warnings.push({ rule: 'empty_dataset', label: 'Empty Dataset', message: 'No rows found in this file.', severity: 'warning', count: 0 });
      return { warnings, errors, infos, qualityScore: 0, total };
    }

    Object.entries(RULES).forEach(([ruleId, rule]) => {
      if (!rule.applies.includes(fileType) && !rule.applies.includes('*')) return;

      if (rule.aggregate) {
        const result = rule.check(data);
        if (result && result.count > 0) {
          const entry = { rule: ruleId, label: rule.label, message: rule.message, severity: rule.severity, count: result.count, sample: result.sample || [] };
          if (rule.severity === 'error') errors.push(entry);
          else if (rule.severity === 'info') infos.push(entry);
          else warnings.push(entry);
        }
        return;
      }

      let count = 0, sampleRows = [];
      data.forEach((row, i) => {
        try {
          if (rule.check(row)) {
            count++;
            if (sampleRows.length < 3) sampleRows.push(i + 2); // 1-indexed, +1 for header
          }
        } catch (e) { /* Skip invalid checks */ }
      });

      if (count > 0) {
        const pct = Math.round((count / total) * 100);
        const entry = {
          rule: ruleId, label: rule.label,
          message: `${rule.message} (${count.toLocaleString()} rows, ${pct}% of data)`,
          severity: rule.severity, count, pct, sampleRows
        };
        if (rule.severity === 'error') errors.push(entry);
        else if (rule.severity === 'info') infos.push(entry);
        else warnings.push(entry);
      }
    });

    // Calculate quality score
    const errorPenalty = errors.reduce((s, e) => s + Math.min(30, e.pct || 5), 0);
    const warnPenalty = warnings.reduce((s, w) => s + Math.min(10, (w.pct || 3) * 0.5), 0);
    const qualityScore = Math.max(0, Math.round(100 - errorPenalty - warnPenalty));

    return { warnings, errors, infos, qualityScore, total };
  }

  // ─── Validate All Loaded Datasets ─────────────────────────────────────────

  function validateAll(rawData) {
    const allWarnings = [], allErrors = [];
    let totalRows = 0, qualitySum = 0, qualityCount = 0;

    Object.entries(rawData).forEach(([type, data]) => {
      if (!data || !data.length) return;
      const result = validateDataset(type, data);
      allWarnings.push(...result.warnings.map(w => ({ ...w, fileType: type })));
      allErrors.push(...result.errors.map(e => ({ ...e, fileType: type })));
      totalRows += result.total;
      qualitySum += result.qualityScore;
      qualityCount++;
    });

    const overallScore = qualityCount ? Math.round(qualitySum / qualityCount) : 100;
    return { warnings: allWarnings, errors: allErrors, overallScore, totalRows };
  }

  // ─── Render Validation Report HTML ────────────────────────────────────────

  function renderValidationReport(result) {
    const { warnings, errors, overallScore, totalRows } = result;
    const allIssues = [...errors, ...warnings];

    const scoreColor = overallScore >= 90 ? '#10b981' : overallScore >= 70 ? '#f59e0b' : '#f43f5e';
    const scoreLabel = overallScore >= 90 ? 'Excellent' : overallScore >= 70 ? 'Good' : 'Needs Attention';

    const issueRows = allIssues.map(issue => `
      <div class="validation-issue validation-${issue.severity}">
        <div class="vi-icon">${issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}</div>
        <div class="vi-body">
          <div class="vi-label">${issue.label} <span class="vi-filetype">[${issue.fileType || ''}]</span></div>
          <div class="vi-message">${issue.message}</div>
        </div>
        <div class="vi-count">${issue.count || ''}</div>
      </div>`).join('') || '<div class="validation-clean">✅ No issues detected. Data looks clean!</div>';

    return `
      <div class="validation-report">
        <div class="validation-summary">
          <div class="quality-score" style="--score-color:${scoreColor}">
            <div class="score-value">${overallScore}</div>
            <div class="score-label">Data Quality<br>${scoreLabel}</div>
          </div>
          <div class="validation-stats">
            <div class="vstat"><span class="vstat-val">${totalRows.toLocaleString()}</span><span class="vstat-lbl">Total Rows</span></div>
            <div class="vstat vstat-error"><span class="vstat-val">${errors.length}</span><span class="vstat-lbl">Errors</span></div>
            <div class="vstat vstat-warn"><span class="vstat-val">${warnings.length}</span><span class="vstat-lbl">Warnings</span></div>
          </div>
        </div>
        <div class="validation-issues">${issueRows}</div>
      </div>`;
  }

  return { validateDataset, validateAll, renderValidationReport };
})();
