/**
 * GovSpirit icon set.
 *
 * A single inline SVG sprite, injected once at boot. No network request, no
 * icon font, works from `file://`, and every glyph inherits `currentColor`
 * so it themes for free.
 *
 * Why not emoji: emoji render differently on every platform (Segoe UI Emoji on
 * Windows, Apple Color Emoji on macOS, Noto on Android), they cannot inherit
 * colour or stroke weight, they are announced literally by screen readers
 * ("classical building", "package"), and a control panel for a government
 *  * depot that speaks in cartoon pictograms does not read as an instrument
 * anyone should trust with stock valuations.
 *
 * Geometry: 24×24 viewBox, 1.75 stroke, round caps and joins. Optically
 * consistent with the Inter text alongside it.
 */
(function initIcons(GovSpirit) {
  'use strict';

  const { Html } = GovSpirit.require('Html');

  const PATHS = Object.freeze({
    /* ── Navigation ─────────────────────────────────────────────────────── */
    import: 'M12 15V3m0 0L8 7m4-4 4 4M3 15v3a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-3',
    dashboard: 'M3.5 3.5h6v7h-6zM14.5 3.5h6v4h-6zM14.5 11.5h6v9h-6zM3.5 14.5h6v6h-6z',
    package: 'M21 8.5 12 3.5 3 8.5m18 0-9 5m9-5v7l-9 5m0-7-9-5m9 5v7m-9-12v7l9 5M7.5 6l9 5',
    warehouse: 'M3 21V9l9-5 9 5v12M3 21h18M7 21v-6h4v6M14 15h3v3h-3z',
    truck:
      'M3 16V6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10M15 8h3.6a1 1 0 0 1 .86.5L21 11v5M3 16h2m6 0h4m4 0h2M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    building:
      'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 21V9h3a1 1 0 0 1 1 1v11M3 21h18M7.5 7h2M7.5 11h2M7.5 15h2M12.5 7h.5M12.5 11h.5M12.5 15h.5M9 21v-3h2v3',
    factory:
      'M3 21V10l5 3.5V10l5 3.5V10l5 3.5V21M3 21h18M3 10 4 4h3l1 6M7.5 17h2M12.5 17h2M17 17h1.5',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.5 2',
    users:
      'M15.5 20v-1.5a3.5 3.5 0 0 0-3.5-3.5H6.5A3.5 3.5 0 0 0 3 18.5V20M9.25 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM21 20v-1.5a3.5 3.5 0 0 0-2.6-3.38M16 4.13a3.5 3.5 0 0 1 0 6.74',
    lightbulb:
      'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.85.94 1 1.55l.1.65h5l.1-.65c.15-.61.5-1.15 1-1.55A6 6 0 0 0 12 3Z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',

    /* ── Chrome ─────────────────────────────────────────────────────────── */
    menu: 'M4 7h16M4 12h16M4 17h16',
    filter: 'M4 5h16l-6.2 7.3v5.4L10.2 20v-7.7L4 5Z',
    download: 'M12 3v11m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
    chevronDown: 'm6 9 6 6 6-6',
    chevronRight: 'm9 6 6 6-6 6',
    arrowRight: 'M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5',
    close: 'M6 6l12 12M18 6 6 18',
    externalLink: 'M14 4h6v6M20 4l-8.5 8.5M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4',
    refresh: 'M20 11a8 8 0 1 0-.8 4.5M20 5v6h-6',

    /* ── Status ─────────────────────────────────────────────────────────── */
    checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12.2l2.4 2.4 4.6-4.9',
    alertTriangle: 'M12 4.5 2.8 20h18.4L12 4.5ZM12 10v4M12 17.2h.01',
    alertOctagon: 'M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2L8.2 3ZM12 8v4.5M12 16h.01',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
    inbox:
      'M20 12h-4l-1.5 3h-5L8 12H4M6.4 4.5h11.2a2 2 0 0 1 1.85 1.24L21 12v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l1.55-6.26A2 2 0 0 1 6.4 4.5Z',
    lock: 'M6 10.5h12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19v-7A1.5 1.5 0 0 1 6 10.5ZM8 10.5V7a4 4 0 0 1 8 0v3.5',
    shield: 'M12 21s7-3.2 7-9V5.8L12 3 5 5.8V12c0 5.8 7 9 7 9ZM9 12l2 2 4-4',

    /* ── Data and metrics ───────────────────────────────────────────────── */
    banknote:
      'M3 6.5h18v11H3zM12 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6.5 9.5h.01M17.5 14.5h.01',
    target:
      'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
    gauge: 'M12 15.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM13.1 12.9 17 8.5M4 19a9 9 0 1 1 16 0',
    calendar: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4',
    timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 1.5M9.5 2.5h5',
    layers: 'M12 3 3 7.5l9 4.5 9-4.5L12 3ZM3 12.5 12 17l9-4.5M3 17 12 21.5 21 17',
    tag: 'M11.6 3H20v8.4l-8.9 8.9a1.5 1.5 0 0 1-2.12 0l-6.28-6.28a1.5 1.5 0 0 1 0-2.12L11.6 3ZM16.5 7.5h.01',
    barChart: 'M4 20V10M10 20V4M16 20v-7M4 20h16',
    trendingUp: 'M3 16.5 9 10.5l4 4L21 6.5M21 6.5h-5M21 6.5v5',
    archiveX:
      'M3 7h18M4.5 7v11.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V7M4.5 7 6 3.5h12L19.5 7M10 11.5l4 4M14 11.5l-4 4',
    rotateBack: 'M4 11a8 8 0 1 1 1.2 4.2M4 5v6h6',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    mapPin:
      'M12 21s6.5-5.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.6 12 21 12 21ZM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    hash: 'M6 9h13M5 15h13M10.5 4 8.5 20M16 4l-2 16',
    database:
      'M12 8.5c4.4 0 8-1.23 8-2.75S16.4 3 12 3 4 4.23 4 5.75 7.6 8.5 12 8.5ZM4 5.75v12.5C4 19.77 7.6 21 12 21s8-1.23 8-2.75V5.75M4 12c0 1.52 3.6 2.75 8 2.75s8-1.23 8-2.75',
    fileSpreadsheet:
      'M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3ZM13.5 3v5.5H19M8.5 12.5h7M8.5 16h7M12 12.5V16',
    edit: 'M4 20h4.5L19 9.5a2.12 2.12 0 0 0-3-3L5.5 17 4 20ZM14.5 8l1.5 1.5',
    listChecks:
      'M10 6h11M10 12h11M10 18h11M3 6l1.5 1.5L7.5 4.5M3 12l1.5 1.5L7.5 10.5M3 18l1.5 1.5L7.5 16.5',
    print:
      'M7 9V3.5h10V9M7 17.5H5.5A1.5 1.5 0 0 1 4 16v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1.5 1.5 0 0 1-1.5 1.5H17M7 14h10v6.5H7z',
    ruler: 'M15.5 2.5 21.5 8.5 8.5 21.5 2.5 15.5 15.5 2.5ZM12 6l2 2M9 9l2 2M6 12l2 2',
    boxes: 'M6.5 3.5h5v5h-5zM12.5 3.5h5v5h-5zM3.5 10.5h5v5h-5zM9.5 10.5h5v5h-5zM15.5 10.5h5v5h-5z',
  });

  const SPRITE_ID = 'govspirit-icon-sprite';

  /** Inject the sprite once. Idempotent. */
  function mountSprite() {
    if (document.getElementById(SPRITE_ID)) return;

    const symbols = Object.entries(PATHS)
      .map(
        ([name, d]) =>
          `<symbol id="gs-${name}" viewBox="0 0 24 24" fill="none" ` +
          `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" ` +
          `stroke-linejoin="round"><path d="${d}"/></symbol>`
      )
      .join('');

    const holder = document.createElement('div');
    holder.id = SPRITE_ID;
    holder.setAttribute('aria-hidden', 'true');
    // Removed from layout entirely rather than display:none, which some
    // browsers historically treated as "do not render referenced symbols".
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>`;
    document.body.prepend(holder);
  }

  const has = (name) => Object.prototype.hasOwnProperty.call(PATHS, name);

  /**
   * Render an icon.
   *
   * Decorative by default (`aria-hidden`), because in almost every case the
   * icon sits beside a real text label. Pass `label` only when the icon is the
   * sole content of a control that has no other accessible name.
   *
   * @param {string} name  key of PATHS
   * @param {object} [options]
   * @param {number} [options.size]  pixel size, default 18
   * @param {string} [options.label] accessible name; omit for decorative icons
   * @param {string} [options.className]
   */
  function render(name, { size = 18, label = null, className = '' } = {}) {
    if (!has(name)) {
      console.warn(`[Icons] Unknown icon "${name}".`);
      return Html.raw('');
    }

    const classes = `icon${className ? ` ${Html.escape(className)}` : ''}`;
    const a11y = label
      ? `role="img" aria-label="${Html.escape(label)}"`
      : 'aria-hidden="true" focusable="false"';

    return Html.raw(
      `<svg class="${classes}" width="${Number(size)}" height="${Number(size)}" ${a11y}>` +
        `<use href="#gs-${Html.escape(name)}"/></svg>`
    );
  }

  /**
   * The GovSpirit mark.
   *
   * A depot gable seen head on, with three stacked bars inside it. The gable
   * says warehouse, the bars say measurement, and the tallest bar is brass
   * rather than verdigris so the mark reads as two-tone at 16px, where a
   * single-colour outline turns to mush.
   *
   * Drawn inline rather than through the sprite because it carries two colours
   * and two stroke weights.
   */
  function brandMark(size = 28) {
    return Html.raw(
      `<svg class="brand-mark" width="${Number(size)}" height="${Number(size)}" ` +
        'viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">' +
        '<path d="M3.5 13 16 4.5 28.5 13v13.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V13Z" ' +
        'stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>' +
        '<path d="M10.5 23v-3.5M16 23v-6" stroke="currentColor" stroke-width="2.1" ' +
        'stroke-linecap="round" opacity="0.55"/>' +
        '<path d="M21.5 23v-8.5" stroke="var(--brand-accent, #c07a2c)" stroke-width="2.4" ' +
        'stroke-linecap="round"/></svg>'
    );
  }

  GovSpirit.Icons = { PATHS, mountSprite, render, brandMark, has };
})(window.GovSpirit);
