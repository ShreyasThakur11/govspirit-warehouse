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

  /* ── Demo dataset ─────────────────────────────────────────────────────── */

  await page.click('#btn-demo');
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
      // Views mount charts on the next frame, so allow a beat before measuring.
      await new Promise((resolve) => setTimeout(resolve, 350));

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
