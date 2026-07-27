/**
 * Sample spreadsheet.
 *
 * The demo button loads a dataset straight into memory, which proves the
 * dashboard works but skips the part most people actually want to test: will
 * it read my file?
 *
 * So this builds a downloadable file that looks like a real depot export.
 * The headers are the ones depots use, not the canonical field names, and the
 * dates are day first as they are written here. Opening the download puts the
 * column mapper and the date parser through the same work a genuine upload
 * does. Every header below is present in the mapper's alias table, so the
 * match is exact rather than fuzzy.
 */
(function initSampleFile(GovSpirit) {
  'use strict';

  const { DemoData } = GovSpirit.require('DemoData');

  /** Source field on the demo row, and the header a depot would print. */
  const COLUMNS = Object.freeze([
    ['sku_id', 'Item Code'],
    ['sku_name', 'Product Description'],
    ['category', 'Type of Liquor'],
    ['bottle_size', 'Pack Size'],
    ['quantity_bottles', 'Closing Stock'],
    ['unit_price', 'Issue Price'],
    ['zone', 'Godown'],
    ['rack_id', 'Rack No'],
    ['supplier', 'Party Name'],
    ['last_received_date', 'GRN Date'],
  ]);

  const HEADERS = Object.freeze(COLUMNS.map(([, header]) => header));

  /** ISO to day first, the convention on Indian excise paperwork. */
  function dayFirst(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return value || '';
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  /**
   * @param {number} [seed] Passed through to the generator.
   * @returns {Array<Object>} Rows keyed by depot header, ready for CSV.
   */
  function rows(seed) {
    const dataset = DemoData.generate(seed ? { seed } : undefined);

    return dataset.inventory.map((line) => {
      const row = {};
      COLUMNS.forEach(([field, header]) => {
        row[header] = field === 'last_received_date' ? dayFirst(line[field]) : line[field];
      });
      return row;
    });
  }

  GovSpirit.SampleFile = { rows, HEADERS, COLUMNS };
})(window.GovSpirit);
