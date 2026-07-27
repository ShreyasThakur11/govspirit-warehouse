/**
 * Shared presentational components.
 *
 * Everything here returns escaped markup through the `html` tagged template,
 * so a page module cannot accidentally place raw spreadsheet content into the
 * document.
 */
(function initComponents(GovSpirit) {
  'use strict';

  const { Html, Format, Dom, Icons } = GovSpirit.require('Html', 'Format', 'Dom', 'Icons');
  const { html, raw, styleAttr, cx } = Html;

  /** Accent colours available to a metric card, keyed by meaning. */
  const ACCENTS = {
    neutral: 'var(--ink-muted)',
    accent: 'var(--accent-ink)',
    positive: 'var(--positive-ink)',
    caution: 'var(--caution-ink)',
    critical: 'var(--critical-ink)',
  };

  const accentFor = (tone) => ACCENTS[tone] || ACCENTS.neutral;

  /* ── Page header ──────────────────────────────────────────────────────── */

  function pageHeader({ title, subtitle, actions }) {
    return html`
      <header class="page-header">
        <div>
          <h1 class="page-title">${title}</h1>
          ${subtitle ? html`<p class="page-subtitle">${subtitle}</p>` : ''}
        </div>
        ${actions ? html`<div class="page-actions">${actions}</div>` : ''}
      </header>
    `;
  }

  /* ── Metric card ──────────────────────────────────────────────────────── */

  /**
   * @param {object} spec
   * @param {string} spec.id        unique on the page, used for the spark canvas
   * @param {string} spec.label
   * @param {string|number} spec.value
   * @param {string} [spec.note]
   * @param {string} [spec.icon]    icon key from Icons.PATHS
   * @param {string} [spec.tone]    key of ACCENTS
   * @param {number[]} [spec.spark] series for the inline trend line
   */
  function metricCard({ id, label, value, note, icon, tone = 'neutral', spark }) {
    const hasSpark = Array.isArray(spark) && spark.length > 1;
    return html`
      <article class="metric-card" ${styleAttr({ '--metric-accent': accentFor(tone) })}>
        <div class="metric-head">
          ${icon ? Icons.render(icon, { size: 16 }) : ''}
          <h2 class="metric-label">${label}</h2>
        </div>
        <p class="metric-value">${value}</p>
        ${note ? html`<p class="metric-note">${note}</p>` : ''}
        ${
          hasSpark
            ? html`<div class="metric-spark">
                <canvas
                  id="spark-${id}"
                  role="img"
                  aria-label="${label}, trend across the last ${spark.length} days"
                ></canvas>
              </div>`
            : ''
        }
      </article>
    `;
  }

  /* ── Panels ───────────────────────────────────────────────────────────── */

  function panelHeader({ title, subtitle, actions }) {
    return html`
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${title}</h2>
          ${subtitle ? html`<p class="panel-subtitle">${subtitle}</p>` : ''}
        </div>
        ${actions ? html`<div class="panel-actions">${actions}</div>` : ''}
      </div>
    `;
  }

  /**
   * A panel whose body is a chart canvas.
   *
   * `summary` becomes the canvas accessible description, which is the only
   * thing assistive technology can convey about a bitmap chart.
   */
  function chartPanel({ id, title, subtitle, summary, actions, tall = false }) {
    return html`
      <section class="${cx('panel', tall && 'panel--tall')}">
        ${panelHeader({ title, subtitle, actions })}
        <div class="panel-chart">
          <canvas id="${id}" role="img" aria-label="${summary || title}"></canvas>
        </div>
      </section>
    `;
  }

  /** A panel whose body is arbitrary markup. */
  function panel({ title, subtitle, actions, body, flush = false }) {
    return html`
      <section class="panel">
        ${panelHeader({ title, subtitle, actions })}
        ${flush ? body : html`<div class="panel-body">${body}</div>`}
      </section>
    `;
  }

  /* ── Data table ───────────────────────────────────────────────────────── */

  /**
   * An accessible, horizontally scrollable table.
   *
   * The scroll container is focusable and labelled, because content reachable
   * only by scrolling must also be reachable from the keyboard (WCAG 2.1.1).
   * The first column is a row header so assistive technology announces which
   * record each cell belongs to.
   *
   * @param {object} spec
   * @param {object[]} spec.rows
   * @param {Array<{key:string,label:string,format?:Function,numeric?:boolean}>} spec.columns
   * @param {string} spec.caption
   * @param {number} [spec.maxRows]
   * @param {string} [spec.emptyTitle]
   * @param {string} [spec.emptyBody]
   */
  function dataTable({ rows, columns, caption, maxRows = 100, emptyTitle, emptyBody }) {
    const all = Array.isArray(rows) ? rows : [];

    if (all.length === 0) {
      return emptyState({
        title: emptyTitle || 'Nothing to show yet',
        body: emptyBody || 'Load a dataset to populate this table.',
        icon: 'inbox',
      });
    }

    const visible = all.slice(0, maxRows);
    const hidden = all.length - visible.length;

    return html`
      <div class="table-scroll" tabindex="0" role="region" aria-label="${caption}, scrollable">
        <table class="data-table data-table--pinned">
          <caption class="visually-hidden">
            ${caption}
          </caption>
          <thead>
            <tr>
              ${columns.map(
                (col) =>
                  html`<th scope="col" class="${cx(col.numeric && 'numeric')}">${col.label}</th>`
              )}
            </tr>
          </thead>
          <tbody>
            ${visible.map(
              (row) => html`
                <tr>
                  ${columns.map((col, index) => {
                    const value = row[col.key];
                    const content = col.format ? col.format(value, row) : (value ?? Format.EMPTY);
                    const classes = cx(col.numeric && 'numeric');
                    return index === 0
                      ? html`<th scope="row" class="${classes}">${content}</th>`
                      : html`<td class="${classes}">${content}</td>`;
                  })}
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
      ${
        hidden > 0
          ? html`<p class="table-note">
              Showing ${Format.number(visible.length)} of ${Format.number(all.length)} rows. Export
              the table to see the rest.
            </p>`
          : ''
      }
    `;
  }

  /* ── States ───────────────────────────────────────────────────────────── */

  function emptyState({ title = 'No data available', body, icon = 'inbox' } = {}) {
    return html`
      <div class="empty-state">
        ${Icons.render(icon, { size: 32 })}
        <p class="empty-title">${title}</p>
        ${body ? html`<p class="empty-body">${body}</p>` : ''}
      </div>
    `;
  }

  function errorState({ title = 'Something went wrong', message, retryLabel, retryId }) {
    return html`
      <div class="error-state" role="alert">
        ${Icons.render('alertTriangle', { size: 28 })}
        <p class="error-title">${title}</p>
        ${message ? html`<p class="error-body">${message}</p>` : ''}
        ${
          retryId
            ? html`<button type="button" class="btn btn-secondary btn-sm" id="${retryId}">
                ${retryLabel || 'Try again'}
              </button>`
            : ''
        }
      </div>
    `;
  }

  function loadingState(message = 'Working') {
    return html`
      <div class="loading-state" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p class="loading-text">${message}</p>
      </div>
    `;
  }

  /* ── Small parts ──────────────────────────────────────────────────────── */

  function status(text, variant = 'neutral') {
    return html`<span class="status status-${variant}">${text}</span>`;
  }

  function notice({ tone = 'info', icon = 'info', title, body }) {
    return html`
      <div class="notice notice-${tone}">
        ${Icons.render(icon, { size: 18 })}
        <div>
          <p class="notice-title">${title}</p>
          <p class="notice-body">${body}</p>
        </div>
      </div>
    `;
  }

  function finding({ tone = 'info', icon = 'info', title, body }) {
    return html`
      <li class="finding finding-${tone}">
        ${Icons.render(icon, { size: 16 })}
        <div>
          <p class="finding-title">${title}</p>
          <p class="finding-body">${body}</p>
        </div>
      </li>
    `;
  }

  function progressBar({ value, label }) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    return html`
      <div
        class="progress-track"
        role="progressbar"
        aria-valuenow="${clamped}"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="${label}"
      >
        <div class="progress-value" ${styleAttr({ width: `${clamped}%` })}></div>
      </div>
    `;
  }

  /* ── Toasts ───────────────────────────────────────────────────────────── */

  const TOAST_ICON = {
    success: 'checkCircle',
    error: 'alertOctagon',
    warning: 'alertTriangle',
    info: 'info',
  };

  function toastRegion() {
    let region = document.getElementById('toast-region');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toast-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    return region;
  }

  /**
   * Show a transient message, announced to assistive technology.
   * Returns a function that dismisses it early.
   *
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'} [type]
   * @param {number} [duration] milliseconds
   */
  function toast(message, type = 'info', duration) {
    const region = toastRegion();
    // Errors interrupt. Everything else waits for a pause in speech.
    region.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const element = document.createElement('div');
    element.className = `toast toast-${type}`;
    Html.setHTML(
      element,
      html`${Icons.render(TOAST_ICON[type] || 'info', { size: 18 })}<span>${message}</span>`
    );

    region.appendChild(element);
    Dom.nextFrame(() => element.classList.add('is-visible'));

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      element.classList.remove('is-visible');
      setTimeout(() => element.remove(), Dom.prefersReducedMotion() ? 0 : 200);
    };

    setTimeout(remove, duration ?? (type === 'error' ? 6000 : 3600));
    return remove;
  }

  GovSpirit.Components = {
    accentFor,
    pageHeader,
    metricCard,
    panel,
    panelHeader,
    chartPanel,
    dataTable,
    emptyState,
    errorState,
    loadingState,
    status,
    notice,
    finding,
    progressBar,
    toast,
    html,
    raw,
  };
})(window.GovSpirit);
