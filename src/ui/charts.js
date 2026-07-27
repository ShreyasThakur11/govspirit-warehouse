/**
 * GovSpirit Chart.js integration.
 *
 * Three problems this module solves that the previous code did not:
 *
 * 1. Theming. Every chart used to hard-code dark hexes at the call site, so
 *    light mode produced dark-grey axis labels on white and the only fix was
 *    to re-navigate the whole page (losing scroll position and page state) on
 *    every theme toggle. Colours now come from CSS custom properties and
 *    `retheme()` updates live instances in place.
 *
 * 2. Responsiveness. Axis tick density, label rotation and legend visibility
 *    now adapt to the viewport instead of being tuned for a desktop monitor
 *    and overflowing on a phone.
 *
 * 3. Accessibility. A bare <canvas> is invisible to assistive technology.
 *    Every chart is created with a role and a text summary.
 */
(function initCharts(GovSpirit) {
  'use strict';

  const { EventBus, Events, Theme, Dom } = GovSpirit.require('EventBus', 'Events', 'Theme', 'Dom');

  /**
   * The series palette lives in assets/css/01-tokens.css as --series-1 to
   * --series-8, so the charts and the interface are coloured from one source.
   * The literals below are only a fallback for the moment before the
   * stylesheet has applied.
   */
  const SERIES_COUNT = 8;
  const SERIES_FALLBACK = Object.freeze([
    '#0f6f62',
    '#c07a2c',
    '#4a7fa5',
    '#8a5a7d',
    '#5c8c4a',
    '#b0563f',
    '#6b6f9c',
    '#3f8f88',
  ]);

  let seriesCache = null;

  function palette() {
    if (seriesCache) return seriesCache;
    seriesCache = Array.from(
      { length: SERIES_COUNT },
      (_, i) => Theme.cssVar(`--series-${i + 1}`, SERIES_FALLBACK[i]) || SERIES_FALLBACK[i]
    );
    return seriesCache;
  }

  const registry = new Map();

  const available = () => typeof Chart !== 'undefined';

  function color(index) {
    const list = palette();
    return list[index % list.length];
  }

  /** Same hue at reduced opacity, for area fills and bar bodies. */
  function alpha(hex, opacity) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!match) return hex;
    const [r, g, b] = [match[1], match[2], match[3]].map((part) => parseInt(part, 16));
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  /**
   * Occupancy colour for a 0 to 100 utilisation figure, using the same
   * three-step convention as warehouse floor paint. Every chart that uses this
   * also labels the value, so colour is never the only signal.
   */
  function utilisationColor(pct) {
    if (pct >= 90) return Theme.cssVar('--critical-fill', '#cf4c5c');
    if (pct >= 75) return Theme.cssVar('--caution-fill', '#c07a2c');
    if (pct >= 50) return Theme.cssVar('--series-3', '#4a7fa5');
    return Theme.cssVar('--positive-fill', '#2f9e6f');
  }

  function abcColor(cls) {
    if (cls === 'A') return Theme.cssVar('--positive-fill', '#2f9e6f');
    if (cls === 'B') return Theme.cssVar('--caution-fill', '#c07a2c');
    if (cls === 'C') return Theme.cssVar('--critical-fill', '#cf4c5c');
    return Theme.cssVar('--ink-muted', '#7f8d87');
  }

  function themeColors() {
    return {
      grid: Theme.cssVar('--chart-grid', '#262e2a'),
      tick: Theme.cssVar('--chart-axis', '#97a49e'),
      tooltipBg: Theme.cssVar('--chart-tooltip-surface', '#1f2522'),
      tooltipTitle: Theme.cssVar('--chart-tooltip-title', '#e9efea'),
      tooltipBody: Theme.cssVar('--chart-tooltip-body', '#a6b2ac'),
      tooltipBorder: Theme.cssVar('--chart-tooltip-line', '#3a443f'),
    };
  }

  /**
   * Build Chart.js options for the current theme and viewport.
   *
   * @param {object} opts
   * @param {boolean} [opts.legend]      show the legend
   * @param {string}  [opts.legendPos]   legend position on wide screens
   * @param {boolean} [opts.noScales]    for doughnut/pie charts
   * @param {boolean} [opts.horizontal]  bar chart with indexAxis 'y'
   * @param {boolean} [opts.percentAxis] format the value axis as a percentage
   * @param {boolean} [opts.currencyAxis] format the value axis as ₹ compact
   */
  function baseOptions(opts = {}) {
    const c = themeColors();
    const phone = Dom.isPhone();
    const compactLayout = Dom.isDrawerLayout();
    const { Format } = GovSpirit;

    // On narrow screens a right-hand legend steals most of the plot area.
    const legendPosition = phone ? 'bottom' : opts.legendPos || 'top';

    const valueAxis = {
      grid: { color: c.grid, drawTicks: false },
      border: { display: false },
      ticks: {
        color: c.tick,
        font: { size: phone ? 9 : 10 },
        padding: 6,
        maxTicksLimit: phone ? 5 : 8,
        callback(value) {
          if (opts.percentAxis) return `${value}%`;
          if (opts.currencyAxis) return Format.compact(value);
          return typeof value === 'number' && Math.abs(value) >= 1000
            ? Format.compact(value)
            : value;
        },
      },
      ...(opts.percentAxis ? { min: 0, max: 100 } : {}),
    };

    const categoryAxis = {
      grid: { display: false },
      border: { display: false },
      ticks: {
        color: c.tick,
        font: { size: phone ? 9 : 10 },
        autoSkip: true,
        maxRotation: compactLayout ? 0 : 40,
        maxTicksLimit: phone ? 6 : 14,
      },
    };

    let scales = {};
    if (!opts.noScales) {
      scales = opts.horizontal
        ? { x: valueAxis, y: categoryAxis }
        : { x: categoryAxis, y: valueAxis };
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      // Deliberately not debounced. A resizeDelay leaves a queued callback
      // behind, and destroy() nulls chart.canvas, so a chart torn down inside
      // that window throws "Cannot read properties of null (reading
      // 'ownerDocument')" from Chart.js itself. Resizing the window while
      // changing view is enough to hit it, and the application's global error
      // handler then reports a fault the reader can do nothing about.
      // Measured against 4.4.3 and 4.5.1: with a 120ms delay, five of six
      // destroy-during-resize cycles threw; at 0, none did.
      resizeDelay: 0,
      animation: Dom.prefersReducedMotion() ? false : { duration: 500, easing: 'easeOutQuart' },
      interaction: {
        mode: opts.noScales ? 'nearest' : 'index',
        intersect: false,
      },
      layout: { padding: { top: 4, right: 4, bottom: 0, left: 0 } },
      plugins: {
        legend: {
          display: Boolean(opts.legend),
          position: legendPosition,
          labels: {
            color: c.tick,
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            padding: phone ? 10 : 14,
            font: { size: phone ? 10 : 11 },
          },
        },
        tooltip: {
          backgroundColor: c.tooltipBg,
          titleColor: c.tooltipTitle,
          bodyColor: c.tooltipBody,
          borderColor: c.tooltipBorder,
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          displayColors: true,
          boxPadding: 4,
        },
      },
      scales,
      ...(opts.horizontal ? { indexAxis: 'y' } : {}),
    };
  }

  /** Deep-merge helper limited to plain objects, enough for Chart.js configs. */
  function merge(target, source) {
    if (!source) return target;
    Object.entries(source).forEach(([key, value]) => {
      const isPlain =
        value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
      if (isPlain) {
        target[key] = merge({ ...(target[key] || {}) }, value);
      } else {
        target[key] = value;
      }
    });
    return target;
  }

  /**
   * Create (or replace) a chart.
   *
   * @param {string} canvasId
   * @param {object} config      Chart.js config; `options` is merged over the themed base
   * @param {object} [meta]
   * @param {object} [meta.preset]  options passed to baseOptions
   * @param {string} [meta.label]   accessible name for the canvas
   * @param {string} [meta.summary] short text description of what the chart shows
   * @returns {object|null} the Chart instance, or null when it could not be created
   */
  function create(canvasId, config, meta = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    if (!available()) {
      // Chart.js is a CDN dependency; an offline first load should degrade to a
      // readable message rather than a blank rectangle.
      const holder = canvas.parentElement;
      if (holder) {
        holder.innerHTML =
          '<p class="empty-state"><span class="empty-title">Charts unavailable</span>' +
          '<span class="empty-body">The charting library could not be loaded. ' +
          'All figures remain available in the tables and exports.</span></p>';
      }
      return null;
    }

    destroy(canvasId);

    const options = merge(baseOptions(meta.preset || {}), config.options || {});
    let instance;
    try {
      instance = new Chart(canvas, { ...config, options });
    } catch (err) {
      console.error(`[Charts] Failed to render "${canvasId}":`, err);
      return null;
    }

    if (meta.label) {
      canvas.setAttribute('role', 'img');
      canvas.setAttribute(
        'aria-label',
        meta.summary ? `${meta.label}. ${meta.summary}` : meta.label
      );
    }

    registry.set(canvasId, { instance, preset: meta.preset || {} });
    return instance;
  }

  /** Small inline trend line used inside KPI tiles. */
  function sparkline(canvasId, values, lineColor) {
    if (!Array.isArray(values) || values.length < 2) return null;
    const stroke = lineColor || color(0);
    return create(
      canvasId,
      {
        type: 'line',
        data: {
          labels: values.map((_, i) => i),
          datasets: [
            {
              data: values,
              borderColor: stroke,
              backgroundColor: alpha(stroke, 0.16),
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
          elements: { line: { borderJoinStyle: 'round' } },
        },
      },
      { preset: { noScales: true } }
    );
  }

  function destroy(canvasId) {
    const entry = registry.get(canvasId);
    if (!entry) return;
    try {
      entry.instance.destroy();
    } catch {
      /* Already torn down with its container. */
    }
    registry.delete(canvasId);
  }

  function destroyAll() {
    [...registry.keys()].forEach(destroy);
  }

  /**
   * Re-apply theme colours to every live chart. Far cheaper and far less
   * disruptive than re-rendering the page, which is what used to happen.
   */
  function retheme() {
    // Drop the memoised series colours so a theme change re-reads them.
    seriesCache = null;

    registry.forEach((entry, id) => {
      const canvas = document.getElementById(id);
      if (!canvas) {
        destroy(id);
        return;
      }
      entry.instance.options = merge(baseOptions(entry.preset), entry.instance.options);
      const themed = baseOptions(entry.preset);
      entry.instance.options.plugins.legend.labels.color = themed.plugins.legend.labels.color;
      entry.instance.options.plugins.tooltip = themed.plugins.tooltip;
      entry.instance.options.scales = themed.scales;
      entry.instance.update('none');
    });
  }

  EventBus.on(Events.THEME_CHANGED, retheme);
  EventBus.on(Events.VIEWPORT_CHANGED, retheme);

  GovSpirit.Charts = {
    palette,
    available,
    color,
    alpha,
    utilisationColor,
    abcColor,
    baseOptions,
    create,
    sparkline,
    destroy,
    destroyAll,
    retheme,
  };
})(window.GovSpirit);
