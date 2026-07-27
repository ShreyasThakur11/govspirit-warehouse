/**
 * GovSpirit data quality rules.
 *
 * Returns structured findings only. Rendering lives in the import page, so the
 * validator stays testable and cannot become another place that concatenates
 * untrusted values into markup.
 */
(function initDataValidator(GovSpirit) {
  'use strict';

  const { Format, Collections } = GovSpirit.require('Format', 'Collections');

  const SEVERITY = Object.freeze({ ERROR: 'error', WARNING: 'warning', INFO: 'info' });

  /**
   * Each rule declares which datasets it applies to and either a row-level
   * `check` or an `aggregate` check that sees the whole table at once.
   */
  const RULES = Object.freeze([
    // ── Inventory ────────────────────────────────────────────────────────
    {
      id: 'inv_missing_sku',
      label: 'Missing SKU identifier',
      severity: SEVERITY.ERROR,
      applies: ['inventory'],
      message: 'Rows with no SKU or item code. These cannot be reconciled and will be dropped.',
      check: (row) => !String(row.sku_id ?? '').trim(),
    },
    {
      id: 'inv_missing_qty',
      label: 'Missing quantity',
      severity: SEVERITY.ERROR,
      applies: ['inventory'],
      message: 'Rows with no quantity value.',
      check: (row) =>
        row.quantity_bottles === null ||
        row.quantity_bottles === undefined ||
        row.quantity_bottles === '',
    },
    {
      id: 'inv_negative_qty',
      label: 'Negative quantity',
      severity: SEVERITY.ERROR,
      applies: ['inventory'],
      message: 'Negative stock quantities. These usually indicate an unposted issue note.',
      check: (row) => Format.toNumber(row.quantity_bottles, 0) < 0,
    },
    {
      id: 'inv_zero_price',
      label: 'Missing unit price',
      severity: SEVERITY.WARNING,
      applies: ['inventory'],
      message: 'Rows with no price. Valuation and ABC classification will understate these items.',
      check: (row) =>
        Format.toNumber(row.unit_price, 0) <= 0 && Format.toNumber(row.total_value, 0) <= 0,
    },
    {
      id: 'inv_missing_location',
      label: 'Missing storage location',
      severity: SEVERITY.WARNING,
      applies: ['inventory'],
      message: 'Rows with no zone, rack or bin. Slotting advice cannot be given for these.',
      check: (row) =>
        !String(row.zone ?? '').trim() &&
        !String(row.rack_id ?? '').trim() &&
        !String(row.bin_id ?? '').trim(),
    },
    {
      id: 'inv_future_received',
      label: 'Receipt date in the future',
      severity: SEVERITY.WARNING,
      applies: ['inventory'],
      message: 'Receipt dates later than today.',
      check: (row) => {
        const d = Format.parseDate(row.last_received_date);
        return Boolean(d && d > new Date());
      },
    },
    {
      id: 'inv_expired',
      label: 'Expired stock',
      severity: SEVERITY.ERROR,
      applies: ['inventory'],
      message: 'Items past their expiry date that are still shown as held.',
      check: (row) => {
        const d = Format.parseDate(row.expiry_date);
        return Boolean(d && d < Format.startOfToday());
      },
    },
    {
      id: 'inv_very_old',
      label: 'Stock older than a year',
      severity: SEVERITY.INFO,
      applies: ['inventory'],
      message: 'Items held for more than 365 days. Likely dead stock.',
      check: (row) => Format.toNumber(row.days_in_stock, 0) > 365,
    },
    {
      id: 'inv_duplicate_slot',
      label: 'Duplicate SKU and location',
      severity: SEVERITY.WARNING,
      applies: ['inventory'],
      message:
        'The same SKU appears more than once in the same bin. Duplicates are merged on import.',
      aggregate: (rows) => {
        const seen = new Set();
        let duplicates = 0;
        rows.forEach((row) => {
          const key = `${row.sku_id}__${row.bin_id}`;
          if (seen.has(key)) duplicates += 1;
          else seen.add(key);
        });
        return duplicates;
      },
    },

    // ── Orders ───────────────────────────────────────────────────────────
    {
      id: 'ord_missing_customer',
      label: 'Missing customer',
      severity: SEVERITY.ERROR,
      applies: ['orders'],
      message: 'Orders with no hotel or customer name. These are dropped on import.',
      check: (row) => !String(row.hotel_name ?? '').trim(),
    },
    {
      id: 'ord_missing_date',
      label: 'Missing or unreadable order date',
      severity: SEVERITY.ERROR,
      applies: ['orders'],
      message: 'Orders whose date could not be parsed. These are dropped on import.',
      check: (row) => !Format.parseDate(row.order_date),
    },
    {
      id: 'ord_overfulfilled',
      label: 'Fulfilled above ordered',
      severity: SEVERITY.WARNING,
      applies: ['orders'],
      message: 'Lines dispatched more than 5% above the ordered quantity.',
      check: (row) => {
        const ordered = Format.toNumber(row.quantity_ordered, 0);
        return ordered > 0 && Format.toNumber(row.quantity_fulfilled, 0) > ordered * 1.05;
      },
    },
    {
      id: 'ord_future_date',
      label: 'Order date in the future',
      severity: SEVERITY.WARNING,
      applies: ['orders'],
      message: 'Orders dated later than today.',
      check: (row) => {
        const d = Format.parseDate(row.order_date);
        return Boolean(d && d > new Date());
      },
    },

    // ── Dispatch ─────────────────────────────────────────────────────────
    {
      id: 'dis_missing_qty',
      label: 'Missing dispatch quantity',
      severity: SEVERITY.ERROR,
      applies: ['dispatch'],
      message: 'Dispatch records with no quantity. These are dropped on import.',
      check: (row) => Format.toNumber(row.quantity_dispatched, 0) <= 0,
    },
    {
      id: 'dis_missing_date',
      label: 'Missing dispatch date',
      severity: SEVERITY.ERROR,
      applies: ['dispatch'],
      message: 'Dispatch records whose date could not be parsed.',
      check: (row) => !Format.parseDate(row.dispatch_date),
    },

    // ── Layout ───────────────────────────────────────────────────────────
    {
      id: 'lay_missing_zone',
      label: 'Layout row without a zone',
      severity: SEVERITY.ERROR,
      applies: ['warehouseLayout'],
      message: 'Layout rows with no zone. Capacity for these bins is ignored.',
      check: (row) => !String(row.zone ?? '').trim(),
    },
    {
      id: 'lay_invalid_capacity',
      label: 'Invalid bin capacity',
      severity: SEVERITY.WARNING,
      applies: ['warehouseLayout'],
      message: 'Bins with zero or negative capacity. A default is substituted.',
      check: (row) =>
        row.capacity !== undefined &&
        row.capacity !== null &&
        Format.toNumber(row.capacity, 0) <= 0,
    },
  ]);

  /**
   * Run every applicable rule against one dataset.
   * @returns {{findings: object[], score: number, total: number}}
   */
  function validateDataset(datasetName, rows) {
    const data = Array.isArray(rows) ? rows : [];
    const total = data.length;

    if (total === 0) {
      return { findings: [], score: 100, total: 0 };
    }

    const findings = [];

    RULES.forEach((rule) => {
      if (!rule.applies.includes(datasetName)) return;

      let count = 0;
      const sampleRows = [];

      if (rule.aggregate) {
        count = rule.aggregate(data) || 0;
      } else {
        data.forEach((row, index) => {
          try {
            if (rule.check(row)) {
              count += 1;
              // +2 converts a zero-based index into the spreadsheet row number
              // the operator sees (one-based, plus the header row).
              if (sampleRows.length < 3) sampleRows.push(index + 2);
            }
          } catch {
            /* A malformed row must not abort the whole validation pass. */
          }
        });
      }

      if (count === 0) return;

      const percentage = Math.round(Collections.percentageOf(count, total));
      findings.push({
        rule: rule.id,
        label: rule.label,
        severity: rule.severity,
        message: rule.message,
        dataset: datasetName,
        count,
        percentage,
        sampleRows,
      });
    });

    // Errors are weighted more heavily than warnings, and each rule is capped
    // so one pervasive issue cannot drive the score below zero on its own.
    const errorPenalty = findings
      .filter((f) => f.severity === SEVERITY.ERROR)
      .reduce((sum, f) => sum + Math.min(30, Math.max(5, f.percentage)), 0);
    const warningPenalty = findings
      .filter((f) => f.severity === SEVERITY.WARNING)
      .reduce((sum, f) => sum + Math.min(10, Math.max(2, f.percentage * 0.5)), 0);

    const score = Collections.clamp(Math.round(100 - errorPenalty - warningPenalty), 0, 100);
    return { findings, score, total };
  }

  /**
   * Validate every populated dataset in the raw store.
   * @returns {{findings: object[], errors: object[], warnings: object[], score: number, totalRows: number}}
   */
  function validateAll(rawData) {
    const findings = [];
    let totalRows = 0;
    let scoreSum = 0;
    let scoredDatasets = 0;

    Object.entries(rawData || {}).forEach(([datasetName, rows]) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      const result = validateDataset(datasetName, rows);
      findings.push(...result.findings);
      totalRows += result.total;
      scoreSum += result.score;
      scoredDatasets += 1;
    });

    const severityRank = { error: 0, warning: 1, info: 2 };
    findings.sort(
      (a, b) => severityRank[a.severity] - severityRank[b.severity] || b.count - a.count
    );

    return {
      findings,
      errors: findings.filter((f) => f.severity === SEVERITY.ERROR),
      warnings: findings.filter((f) => f.severity === SEVERITY.WARNING),
      infos: findings.filter((f) => f.severity === SEVERITY.INFO),
      score: scoredDatasets ? Math.round(scoreSum / scoredDatasets) : 100,
      totalRows,
    };
  }

  GovSpirit.DataValidator = { SEVERITY, RULES, validateDataset, validateAll };
})(window.GovSpirit);
