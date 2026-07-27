/**
 * GovSpirit number, currency and date formatting.
 *
 * Locale note: the platform targets Indian state excise warehouses, so numbers
 * use the Indian grouping system (1,23,456) and currency is abbreviated in
 * lakh/crore. Both are driven by the constants below rather than being
 * scattered through the codebase.
 *
 * Date note: dates are normalised to LOCAL midnight and day keys are built
 * from local calendar parts. The previous implementation used
 * `toISOString().slice(0, 10)`, which silently shifted every record by one day
 * for anyone east of UTC, including India (UTC+5:30), the entire target
 * audience.
 */
(function initFormat(GovSpirit) {
  'use strict';

  const LOCALE = 'en-IN';
  const CURRENCY_SYMBOL = '₹';
  const EMPTY = 'N/A';

  /* ── Numbers ──────────────────────────────────────────────────────────── */

  function isNumeric(value) {
    if (value === null || value === undefined || value === '') return false;
    return Number.isFinite(typeof value === 'number' ? value : Number(value));
  }

  function toNumber(value, fallback = 0) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (value === null || value === undefined || value === '') return fallback;
    // Tolerate "1,234.50", "₹1,234", "1 234" and trailing units from exports.
    const cleaned = String(value).replace(/[^\d.eE+-]/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function number(value, decimals = 0) {
    if (!isNumeric(value)) return EMPTY;
    return Number(value).toLocaleString(LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  /** Abbreviated Indian currency: ₹1.25 Cr, ₹4.80 L, ₹9,450.00 */
  function currency(value) {
    if (!isNumeric(value)) return EMPTY;
    const n = Number(value);
    const abs = Math.abs(n);
    if (abs >= 1e7) return `${CURRENCY_SYMBOL}${(n / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `${CURRENCY_SYMBOL}${(n / 1e5).toFixed(2)} L`;
    return CURRENCY_SYMBOL + number(n, 2);
  }

  /** Full, unabbreviated currency, used in CSV/Excel exports and tooltips. */
  function currencyExact(value) {
    if (!isNumeric(value)) return EMPTY;
    return CURRENCY_SYMBOL + number(value, 2);
  }

  function percent(value, decimals = 1) {
    if (!isNumeric(value)) return EMPTY;
    return `${Number(value).toFixed(decimals)}%`;
  }

  /** Compact form for dense KPI tiles: 12.4K, 3.1M. */
  function compact(value) {
    if (!isNumeric(value)) return EMPTY;
    const n = Number(value);
    const abs = Math.abs(n);
    if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return String(Math.round(n));
  }

  function integer(value) {
    if (!isNumeric(value)) return EMPTY;
    return number(Math.round(Number(value)), 0);
  }

  /* ── Dates ────────────────────────────────────────────────────────────── */

  // Excel stores dates as days since 1899-12-30. Valid range runs to year 9999.
  const EXCEL_EPOCH_OFFSET = 25569; // days between 1899-12-30 and 1970-01-01
  const EXCEL_MIN = 1;
  const EXCEL_MAX = 2958465;
  const MS_PER_DAY = 86400000;

  const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/;
  const COMPACT_RE = /^(\d{4})(\d{2})(\d{2})$/;
  const DMY_RE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/;

  function localMidnight(year, monthIndex, day) {
    const d = new Date(year, monthIndex, day, 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /**
   * Parse the many date shapes that arrive from ERP exports.
   *
   * Ambiguous slash dates are read DAY-FIRST (31/01/2026), which is the
   * convention in India and the rest of the Commonwealth. Native
   * `new Date('01/02/2026')` would read that as 2 January, a silent one-month
   * error on every record.
   *
   * @param {unknown} value
   * @returns {Date|null}
   */
  function parseDate(value) {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value < EXCEL_MIN || value > EXCEL_MAX) return null;
      const utc = new Date(Math.round((value - EXCEL_EPOCH_OFFSET) * MS_PER_DAY));
      if (Number.isNaN(utc.getTime())) return null;
      return localMidnight(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
    }

    const text = String(value).trim();
    if (!text) return null;

    // YYYYMMDD
    const compactMatch = COMPACT_RE.exec(text);
    if (compactMatch) {
      return localMidnight(
        Number(compactMatch[1]),
        Number(compactMatch[2]) - 1,
        Number(compactMatch[3])
      );
    }

    // DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY
    const dmyMatch = DMY_RE.exec(text);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      let year = Number(dmyMatch[3]);
      if (dmyMatch[3].length === 2) year += year < 70 ? 2000 : 1900;
      // If the first field cannot be a day but the second can, it was MM/DD.
      if (day > 12 && month <= 12) return localMidnight(year, month - 1, day);
      if (month > 12 && day <= 12) return localMidnight(year, day - 1, month);
      if (day <= 12 && month <= 12) return localMidnight(year, month - 1, day);
      return null;
    }

    // ISO and anything else the engine recognises.
    if (ISO_RE.test(text)) {
      const isoDate = new Date(text.length === 10 ? `${text}T00:00:00` : text);
      return Number.isNaN(isoDate.getTime()) ? null : isoDate;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /** Stable YYYY-MM-DD key built from LOCAL calendar parts (no UTC drift). */
  function dayKey(value) {
    const d = parseDate(value);
    if (!d) return null;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  /** Stable YYYY-MM key, used for month-over-month variability analysis. */
  function monthKey(value) {
    const key = dayKey(value);
    return key ? key.slice(0, 7) : null;
  }

  function formatDate(value, options) {
    const d = parseDate(value);
    if (!d) return EMPTY;
    return d.toLocaleDateString(LOCALE, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...options,
    });
  }

  function formatDateTime(value) {
    const d = parseDate(value);
    if (!d) return EMPTY;
    return d.toLocaleString(LOCALE, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Whole days between two dates, ignoring clock time. */
  function daysBetween(from, to) {
    const a = parseDate(from);
    const b = parseDate(to) || startOfToday();
    if (!a || !b) return null;
    const aMid = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const bMid = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((bMid - aMid) / MS_PER_DAY);
  }

  function startOfToday() {
    const now = new Date();
    return localMidnight(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function daysAgo(n) {
    const d = startOfToday();
    d.setDate(d.getDate() - n);
    return d;
  }

  /** Ascending list of the last `count` local day keys, ending today. */
  function lastNDayKeys(count = 30) {
    return Array.from({ length: count }, (_, i) => dayKey(daysAgo(count - 1 - i)));
  }

  /** Short axis label for a YYYY-MM-DD key: "14 Mar". */
  function shortDayLabel(key) {
    const d = parseDate(key);
    if (!d) return '';
    return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  }

  function minutes(value) {
    if (!isNumeric(value)) return EMPTY;
    return `${Math.round(Number(value))} min`;
  }

  GovSpirit.Format = {
    LOCALE,
    CURRENCY_SYMBOL,
    EMPTY,
    isNumeric,
    toNumber,
    number,
    integer,
    currency,
    currencyExact,
    percent,
    compact,
    parseDate,
    dayKey,
    monthKey,
    formatDate,
    formatDateTime,
    daysBetween,
    startOfToday,
    daysAgo,
    lastNDayKeys,
    shortDayLabel,
    minutes,
  };
})(window.GovSpirit);
