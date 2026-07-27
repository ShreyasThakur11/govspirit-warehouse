#!/usr/bin/env node
/**
 * Browser smoke test.
 *
 * Loads the application in headless Chromium, generates the seeded demo
 * dataset, walks every view, and fails on any console error, unhandled
 * rejection, failed request, horizontal overflow or unrendered chart.
 *
 * This exists because static analysis cannot catch the failure that actually
 * happens in a no-bundler codebase: a script listed in the wrong order in
 * index.html. That produces a runtime throw, a blank view, and a completely
 * clean lint run.
 *
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 * Default base URL: http://127.0.0.1:4173
 */

import puppeteer from 'puppeteer';

const BASE_URL = process.argv[2] || 'http://127.0.0.1:4173';

const VIEWS = [
  'import',
  'executive',
  'inventory',
  'warehouse',
  'dispatch',
  'hotels',
  'brandSupplier',
  'stockAging',
  'employees',
  'recommendations',
  'search',
];

/** Widths that must not produce a horizontal scrollbar. */
const WIDTHS = [320, 768, 1280];

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`  FAIL  ${message}`);
};
const pass = (message) => console.log(`  ok    ${message}`);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    // Third-party CDN failures are reported but not fatal: the application is
    // designed to degrade when they are unreachable, and CI networks vary.
    const url = request.url();
    if (!url.startsWith(BASE_URL)) return;
    failedRequests.push(`${url} (${request.failure()?.errorText})`);
  });

  await page.setViewport({ width: 1280, height: 900 });

  console.log(`\nLoading ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 45000 });

  /* ── Boot ─────────────────────────────────────────────────────────────── */

  const booted = await page.evaluate(() => ({
    namespace: typeof window.GovSpirit,
    modules: Object.keys(window.GovSpirit || {}).length,
    bootScreenGone: !document.getElementById('boot-screen'),
    spriteMounted: Boolean(document.getElementById('govspirit-icon-sprite')),
    navItems: document.querySelectorAll('#sidebar .nav-item').length,
    heading: document.querySelector('#main-content h1')?.textContent || null,
  }));

  if (booted.namespace !== 'object') fail('GovSpirit namespace was not created');
  else pass(`namespace present with ${booted.modules} modules`);

  if (!booted.bootScreenGone) fail('boot screen was not dismissed');
  else pass('boot screen dismissed');

  if (!booted.spriteMounted) fail('icon sprite was not injected');
  else pass('icon sprite injected');

  if (booted.navItems !== VIEWS.length) {
    fail(`sidebar shows ${booted.navItems} items, expected ${VIEWS.length}`);
  } else pass(`sidebar shows all ${VIEWS.length} views`);

  if (!booted.heading) fail('import view rendered no heading');
  else pass(`landed on "${booted.heading}"`);

  /* ── Sample file ──────────────────────────────────────────────────────────
     The download is the only path that feeds the mapper without a human
     picking a file, so assert that every depot header it writes still resolves
     to the field it is meant to. A rename in the alias table would otherwise
     silently downgrade the sample to fuzzy matching.                         */

  const mapped = await page.evaluate(() => {
    const rows = window.GovSpirit.SampleFile.rows();
    const headers = window.GovSpirit.SampleFile.HEADERS;
    return {
      rowCount: rows.length,
      headers,
      mapping: window.GovSpirit.SmartMapper.autoMap(headers),
      sampleDate: rows[0]['GRN Date'],
    };
  });

  const EXPECTED_FIELDS = {
    'Item Code': 'sku_id',
    'Product Description': 'brand',
    'Type of Liquor': 'category',
    'Pack Size': 'size',
    'Closing Stock': 'quantity',
    'Issue Price': 'price',
    Godown: 'zone',
    'Rack No': 'rack',
    'Party Name': 'supplier',
    'GRN Date': 'received_date',
  };

  if (mapped.rowCount === 0) fail('sample file produced no rows');
  else pass(`sample file: ${mapped.rowCount} rows, ${mapped.headers.length} columns`);

  let mappingClean = true;
  for (const [header, expected] of Object.entries(EXPECTED_FIELDS)) {
    const entry = mapped.mapping?.[header];
    if (entry?.fieldId !== expected) {
      fail(`sample header "${header}" mapped to ${entry?.fieldId || 'nothing'}, want ${expected}`);
      mappingClean = false;
    } else if (entry.confidence !== 'high') {
      fail(`sample header "${header}" matched ${expected} at ${entry.confidence} confidence`);
      mappingClean = false;
    }
  }
  if (mappingClean) {
    pass(`all ${Object.keys(EXPECTED_FIELDS).length} sample headers map at high confidence`);
  }

  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(mapped.sampleDate || '')) {
    fail(`sample dates are not day first: ${mapped.sampleDate}`);
  } else pass(`sample dates are day first (${mapped.sampleDate})`);

  // Serialise, re-read and run the pipeline, which is what happens when the
  // download is dropped back onto the uploader. Nothing here is stubbed.
  const roundTrip = await page.evaluate(() => {
    const G = window.GovSpirit;
    const rows = G.SampleFile.rows();
    const csv = G.Exporters.toCSV(rows, G.SampleFile.HEADERS);
    // parseCSV returns a sheet list, the same shape a workbook produces.
    const sheet = G.FileReader.parseCSV(csv, 'sample.csv')[0];
    const canonical = G.SmartMapper.applyMapping(sheet.data, G.SmartMapper.autoMap(sheet.columns));

    G.Store.clearAllData();
    G.Store.setRawData('inventory', canonical);
    const result = G.Pipeline.run({ source: 'Round trip' });
    const state = G.Store.getState();

    return {
      ok: result.ok,
      parsedRows: sheet.data.length,
      detectedType: sheet.type ?? null,
      canonicalRows: canonical.length,
      inventory: state.processedData.inventory.length,
      value: state.kpis.inventoryValue,
      bottles: state.kpis.totalBottles,
      writtenBottles: rows.reduce((sum, row) => sum + Number(row['Closing Stock'] || 0), 0),
      missingRequired: G.SmartMapper.missingRequired(G.SmartMapper.autoMap(G.SampleFile.HEADERS)),
      firstDate: canonical[0]?.received_date ?? null,
    };
  });

  if (roundTrip.missingRequired.length) {
    fail(`sample file is missing required fields: ${roundTrip.missingRequired.join(', ')}`);
  } else pass('sample file satisfies every required field');

  if (!roundTrip.ok || roundTrip.inventory !== mapped.rowCount) {
    fail(
      `sample round trip lost rows: wrote ${mapped.rowCount}, read ${roundTrip.parsedRows}, ` +
        `mapped ${roundTrip.canonicalRows}, processed ${roundTrip.inventory}`
    );
  } else pass(`sample round trip preserved all ${roundTrip.inventory} rows through the pipeline`);

  if (!Number.isFinite(roundTrip.value) || roundTrip.value <= 0) {
    fail(`sample round trip produced no stock value: ${roundTrip.value}`);
  } else pass(`sample round trip valued the stock at ${Math.round(roundTrip.value)}`);

  // Row counts can survive while quantities quietly do not, so compare the
  // bottles written into the file against the bottles the dashboard reports.
  if (roundTrip.bottles !== roundTrip.writtenBottles) {
    fail(
      `sample round trip lost stock: wrote ${roundTrip.writtenBottles} bottles, ` +
        `dashboard reports ${roundTrip.bottles}`
    );
  } else pass(`sample round trip preserved all ${roundTrip.bottles} bottles`);

  await page.reload({ waitUntil: 'networkidle2' });

  /* ── Sample depot ─────────────────────────────────────────────────────── */

  await page.click('#btn-sample-open');
  await page.waitForFunction(() => window.GovSpirit.Store.getState().isDataLoaded, {
    timeout: 20000,
  });

  const loaded = await page.evaluate(() => {
    const state = window.GovSpirit.Store.getState();
    return {
      inventory: state.processedData.inventory.length,
      orders: state.processedData.orders.length,
      dispatch: state.processedData.dispatch.length,
      zones: state.processedData.zones.length,
      recommendations: state.recommendations.length,
      fillRate: state.kpis.fillRate,
      accuracy: state.kpis.inventoryAccuracy,
      health: state.kpis.warehouseHealthScore,
    };
  });

  if (loaded.inventory === 0) fail('demo dataset produced no inventory');
  else pass(`demo dataset: ${loaded.inventory} inventory lines, ${loaded.orders} order lines`);

  if (loaded.zones < 3) fail(`demo dataset used only ${loaded.zones} zones, expected 3 or more`);
  else pass(`stock distributed across ${loaded.zones} zones`);

  if (loaded.recommendations === 0) fail('no recommendations were generated');
  else pass(`${loaded.recommendations} recommendations generated`);

  // Guard the class of defect where a metric silently becomes nonsense.
  for (const [name, value] of Object.entries({
    fillRate: loaded.fillRate,
    accuracy: loaded.accuracy,
    health: loaded.health,
  })) {
    if (value === null) continue; // null is a valid, documented outcome
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      fail(`${name} is out of range: ${value}`);
    }
  }
  pass('headline percentages are within range');

  /* ── Every view, at every width ───────────────────────────────────────── */

  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 900 });

    for (const view of VIEWS) {
      await page.evaluate((name) => window.GovSpirit.Router.navigate(name), view);

      // Views mount charts a frame after the markup lands. Waiting on the
      // condition rather than on a fixed delay keeps this honest on a loaded
      // CI runner, where a fixed 350ms is sometimes not enough and the run
      // fails on views that were merely slow.
      await page
        .waitForFunction(
          () => {
            const main = document.getElementById('main-content');
            if (!main || !main.querySelector('h1')) return false;
            return [...main.querySelectorAll('canvas')].every((c) => c.width > 0);
          },
          { timeout: 10000, polling: 50 }
        )
        .catch(() => {}); // fall through to the assertions, which report properly

      const result = await page.evaluate(() => {
        const main = document.getElementById('main-content');
        const viewportWidth = document.documentElement.clientWidth;
        const text = main.innerText;
        return {
          heading: main.querySelector('h1')?.textContent || null,
          overflow: document.documentElement.scrollWidth > viewportWidth + 1,
          canvases: main.querySelectorAll('canvas').length,
          blankCanvases: [...main.querySelectorAll('canvas')].filter((c) => c.width === 0).length,
          brokenValues: (text.match(/NaN|\[object Object\]|undefined/g) || []).length,
        };
      });

      const label = `${view} @ ${width}px`;

      if (!result.heading) fail(`${label}: no heading rendered`);
      if (result.overflow) fail(`${label}: horizontal overflow`);
      if (result.blankCanvases > 0) fail(`${label}: ${result.blankCanvases} chart(s) not sized`);
      if (result.brokenValues > 0) fail(`${label}: ${result.brokenValues} broken value(s) in text`);
    }

    pass(`all ${VIEWS.length} views clean at ${width}px`);
  }

  /* ── Clipped chrome text ──────────────────────────────────────────────────
     Strings in the shell are ours, not the operator's, so any of them being
     cut off is a defect rather than unavoidable truncation of long user data.
     The sidebar tagline overflowed its container this way and the only signal
     was a screenshot.                                                        */

  for (const width of [1280, 768, 375]) {
    await page.setViewport({ width, height: 900 });
    await new Promise((resolve) => setTimeout(resolve, 250));

    const clipped = await page.evaluate(() => {
      const found = [];
      document.querySelectorAll('#sidebar *, #topbar *').forEach((el) => {
        if (el.children.length > 0) return; // only leaf nodes hold text
        const text = (el.textContent || '').trim();
        if (!text) return;
        // .visually-hidden is clipped to a 1px box on purpose: that is how the
        // screen-reader-only pattern works, and it is not a layout fault.
        if (el.closest('.visually-hidden')) return;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return;
        if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
          found.push(
            `${el.className || el.tagName}: "${text.slice(0, 40)}" needs ${el.scrollWidth}px, has ${el.clientWidth}px`
          );
        }
      });
      return found;
    });

    if (clipped.length) clipped.forEach((c) => fail(`clipped chrome text @ ${width}px: ${c}`));
    else pass(`no clipped chrome text at ${width}px`);
  }

  /* ── Theme ────────────────────────────────────────────────────────────── */

  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluate(() => window.GovSpirit.Router.navigate('executive'));
  await new Promise((resolve) => setTimeout(resolve, 300));

  const themes = await page.evaluate(async () => {
    const read = () => ({
      attr: document.documentElement.getAttribute('data-theme'),
      background: getComputedStyle(document.body).backgroundColor,
    });
    window.GovSpirit.Theme.set('light');
    await new Promise((r) => setTimeout(r, 250));
    const light = read();
    window.GovSpirit.Theme.set('dark');
    await new Promise((r) => setTimeout(r, 250));
    return { light, dark: read() };
  });

  if (themes.light.background === themes.dark.background) {
    fail('theme toggle did not change the page background');
  } else {
    pass(`theme toggle works (${themes.light.background} / ${themes.dark.background})`);
  }

  /* ── Runtime errors ───────────────────────────────────────────────────── */

  if (pageErrors.length) pageErrors.forEach((e) => fail(`uncaught error: ${e}`));
  else pass('no uncaught errors');

  if (consoleErrors.length) consoleErrors.forEach((e) => fail(`console error: ${e}`));
  else pass('no console errors');

  if (failedRequests.length) failedRequests.forEach((r) => fail(`failed request: ${r}`));
  else pass('no failed same-origin requests');
} finally {
  await browser.close();
}

console.log('');
if (failures.length) {
  console.error(`Smoke test failed with ${failures.length} problem(s).`);
  process.exit(1);
}
console.log('Smoke test passed.');
