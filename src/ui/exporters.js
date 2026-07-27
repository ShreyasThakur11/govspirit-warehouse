/**
 * GovSpirit data export.
 *
 * The heavy export libraries (SheetJS ~450 kB, jsPDF + html2canvas ~600 kB)
 * are loaded on first use rather than on page load. Most sessions never export
 * anything, and shipping a megabyte of parser to every visitor to support an
 * optional button is a poor trade.
 *
 * CSV output is hardened against formula injection. A cell whose text begins
 * with =, +, -, @, tab or carriage return is interpreted as a formula by Excel
 * and LibreOffice; since this tool's exports are opened in exactly those
 * programs, and the values come from files the operator was sent by third
 * parties, the risk is concrete rather than theoretical.
 */
(function initExporters(GovSpirit) {
  'use strict';

  const { Format, Components } = GovSpirit.require('Format', 'Components');

  /* ── Lazy script loading ──────────────────────────────────────────────── */

  const loaded = new Map();

  /**
   * Load a script once and cache the promise.
   * @param {object} spec
   * @param {string} spec.src
   * @param {string} spec.global   property on window that proves it loaded
   * @param {string} [spec.integrity]
   */
  function loadScript({ src, global, integrity }) {
    if (window[global]) return Promise.resolve(window[global]);
    if (loaded.has(src)) return loaded.get(src);

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      if (integrity) script.integrity = integrity;
      script.onload = () =>
        window[global]
          ? resolve(window[global])
          : reject(new Error(`${global} missing after loading ${src}`));
      script.onerror = () => {
        loaded.delete(src);
        reject(new Error(`Could not load ${src}. Check your network connection.`));
      };
      document.head.appendChild(script);
    });

    loaded.set(src, promise);
    return promise;
  }

  /**
   * Pinned CDN bundles with Subresource Integrity digests. If jsDelivr ever
   * serves altered bytes for these exact versions the browser refuses to
   * execute them, which matters because these libraries get handed the
   * operator's inventory data.
   *
   * Regenerate a digest with:
   *   curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
   */
  const CDN = Object.freeze({
    xlsx: {
      src: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      global: 'XLSX',
      integrity: 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw',
    },
    jspdf: {
      src: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
      global: 'jspdf',
      integrity: 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk',
    },
    html2canvas: {
      src: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
      global: 'html2canvas',
      integrity: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H',
    },
  });

  /* ── File download ────────────────────────────────────────────────────── */

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Firefox aborts the download if the URL is revoked synchronously.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function timestamp() {
    return Format.dayKey(new Date()) || 'export';
  }

  function filenameFor(name, extension) {
    const safe = String(name || 'export')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `govspirit-${safe || 'export'}-${timestamp()}.${extension}`;
  }

  /* ── CSV ──────────────────────────────────────────────────────────────── */

  const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

  /** Serialise one value into an RFC 4180 field, neutralising formulas. */
  function csvCell(value) {
    if (value === null || value === undefined) return '';

    let text;
    if (value instanceof Date) text = Format.dayKey(value) || '';
    else if (typeof value === 'object') text = JSON.stringify(value);
    else text = String(value);

    // Prefix with an apostrophe so the spreadsheet treats it as literal text.
    if (FORMULA_TRIGGERS.test(text)) text = `'${text}`;

    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  /**
   * Flatten rows to CSV.
   * @param {object[]} rows
   * @param {string[]} [columns] explicit column order; inferred when omitted
   */
  function toCSV(rows, columns) {
    if (!Array.isArray(rows) || rows.length === 0) return '';

    // Union of keys across a sample, so sparse rows do not lose columns.
    const headers =
      columns ||
      [...new Set(rows.slice(0, 200).flatMap((row) => Object.keys(row || {})))].filter(Boolean);

    const lines = [headers.map(csvCell).join(',')];
    rows.forEach((row) => {
      lines.push(headers.map((header) => csvCell(row?.[header])).join(','));
    });
    return lines.join('\r\n');
  }

  function downloadCSV(rows, name, columns) {
    if (!Array.isArray(rows) || rows.length === 0) {
      Components.toast('There is nothing to export on this page yet.', 'warning');
      return false;
    }
    // The BOM makes Excel read the file as UTF-8, so ₹ and names with
    // diacritics survive the round trip.
    const blob = new Blob(['﻿', toCSV(rows, columns)], {
      type: 'text/csv;charset=utf-8;',
    });
    triggerDownload(blob, filenameFor(name, 'csv'));
    return true;
  }

  function downloadJSON(data, name) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    triggerDownload(blob, filenameFor(name, 'json'));
  }

  /* ── Excel ────────────────────────────────────────────────────────────── */

  /**
   * @param {Record<string, object[]>} sheets sheet name to rows
   * @param {string} name
   */
  async function downloadExcel(sheets, name) {
    const usable = Object.entries(sheets || {}).filter(
      ([, rows]) => Array.isArray(rows) && rows.length
    );
    if (usable.length === 0) {
      Components.toast('There is nothing to export yet.', 'warning');
      return false;
    }

    const dismiss = Components.toast('Preparing Excel workbook…', 'info', 30000);
    try {
      const XLSXLib = await loadScript(CDN.xlsx);
      const workbook = XLSXLib.utils.book_new();

      usable.forEach(([sheetName, rows]) => {
        const sheet = XLSXLib.utils.json_to_sheet(rows);
        // Excel sheet names are capped at 31 characters and reject : \ / ? * [ ]
        const safeName = sheetName.replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
        XLSXLib.utils.book_append_sheet(workbook, sheet, safeName);
      });

      XLSXLib.writeFile(workbook, filenameFor(name, 'xlsx'));
      dismiss();
      Components.toast('Workbook downloaded.', 'success');
      return true;
    } catch (err) {
      dismiss();
      console.error('[Export] Excel export failed:', err);
      Components.toast(`Excel export failed. ${err.message}`, 'error');
      return false;
    }
  }

  /* ── PDF ──────────────────────────────────────────────────────────────── */

  /**
   * Rasterise the current page region into a PDF. Not a substitute for a
   * proper report generator, but it matches what operators expect from a
   * "print this dashboard" button.
   */
  async function downloadPDF(elementId = 'main-content', name = 'dashboard') {
    const target = document.getElementById(elementId);
    if (!target) return false;

    const dismiss = Components.toast('Rendering PDF, this may take a moment…', 'info', 60000);
    try {
      const [canvasLib, pdfLib] = await Promise.all([
        loadScript(CDN.html2canvas),
        loadScript(CDN.jspdf),
      ]);

      const background = getComputedStyle(document.body).backgroundColor || '#ffffff';
      const canvas = await canvasLib(target, {
        backgroundColor: background,
        // Cap the scale so a long dashboard does not exhaust memory on mobile.
        scale: Math.min(2, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false,
        windowWidth: target.scrollWidth,
      });

      const { jsPDF } = pdfLib;
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [canvas.width, canvas.height],
        compress: true,
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(filenameFor(name, 'pdf'));

      dismiss();
      Components.toast('PDF downloaded.', 'success');
      return true;
    } catch (err) {
      dismiss();
      console.error('[Export] PDF export failed:', err);
      Components.toast(`PDF export failed. ${err.message}`, 'error');
      return false;
    }
  }

  GovSpirit.Exporters = {
    CDN,
    toCSV,
    downloadCSV,
    downloadJSON,
    downloadExcel,
    downloadPDF,
    loadScript,
    filenameFor,
  };
})(window.GovSpirit);
