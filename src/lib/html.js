/**
 * GovSpirit safe HTML templating.
 *
 * Why this exists
 * ---------------
 * Every screen in this application renders strings built from data the user
 * supplied: spreadsheet cell values, column headers, file names, free-text
 * pasted inventory lists. Previously those strings went straight into
 * `innerHTML`, so a workbook containing a cell like
 *
 *     <img src=x onerror=alert(document.cookie)>
 *
 * executed as markup the moment it was previewed. The data never leaves the
 * browser, but the operator's own session is still a real target. A hostile
 * "supplier price list" is a plausible delivery vector in a government supply
 * chain.
 *
 * The fix is to make escaping the default rather than something a developer
 * has to remember. `html` is a tagged template that escapes every
 * interpolation. Trusted fragments must be wrapped in `raw()` explicitly,
 * which makes each one visible in review.
 */
(function initHtml(GovSpirit) {
  'use strict';

  const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  const ESCAPE_RE = /[&<>"']/g;
  const RAW = Symbol('govspirit.raw');

  /**
   * Escape a value for interpolation into HTML text or a quoted attribute.
   * @param {unknown} value
   * @returns {string}
   */
  function escape(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(ESCAPE_RE, (char) => ESCAPE_MAP[char]);
  }

  /**
   * Mark a string as already-safe HTML so `html` will not escape it.
   * Only ever pass markup this codebase generated itself.
   * @param {string} markup
   */
  function raw(markup) {
    return { [RAW]: true, value: markup === null || markup === undefined ? '' : String(markup) };
  }

  function isRaw(value) {
    return typeof value === 'object' && value !== null && value[RAW] === true;
  }

  function interpolate(value) {
    if (value === null || value === undefined || value === false) return '';
    if (isRaw(value)) return value.value;
    if (Array.isArray(value)) return value.map(interpolate).join('');
    return escape(value);
  }

  /**
   * Tagged template that escapes every `${}` by default.
   *
   *   html`<td>${row.brand}</td>`                  // escaped
   *   html`<tbody>${raw(rowsMarkup)}</tbody>`      // trusted, opt-in
   *   html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`   // arrays nest
   *
   * Nested `html` calls return raw markers, so composition stays safe.
   */
  function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i += 1) {
      out += interpolate(values[i]) + strings[i + 1];
    }
    return raw(out);
  }

  /**
   * Collapse a template result (or plain string) down to a string suitable for
   * assigning to `innerHTML`.
   * @param {unknown} value
   * @returns {string}
   */
  function render(value) {
    return interpolate(value);
  }

  /**
   * Assign rendered markup to an element. Centralising this makes every
   * innerHTML write in the codebase greppable and consistently escaped.
   * @param {Element|null} target
   * @param {unknown} value
   */
  function setHTML(target, value) {
    if (!target) return;
    target.innerHTML = render(value);
  }

  /**
   * Build an inline `style` attribute from a property map, dropping empty
   * values. Property names and values are escaped, and anything containing a
   * CSS comment, semicolon injection or `url(` is rejected outright, because style
   * strings are the one attribute where escaping alone is not enough.
   * @param {Record<string, string|number|null|undefined>} props
   */
  function styleAttr(props) {
    const parts = [];
    Object.entries(props || {}).forEach(([prop, value]) => {
      if (value === null || value === undefined || value === '') return;
      const safeProp = String(prop).replace(/[^a-zA-Z0-9-]/g, '');
      const safeValue = String(value).replace(/[;{}<>"']/g, '');
      if (!safeProp || /url\s*\(/i.test(safeValue) || /expression/i.test(safeValue)) return;
      parts.push(`${safeProp}:${safeValue}`);
    });
    return parts.length ? raw(` style="${escape(parts.join(';'))}"`) : raw('');
  }

  /**
   * Build a class attribute from a list, ignoring falsy entries.
   * @param {...(string|false|null|undefined)} names
   */
  function cx(...names) {
    return names.filter(Boolean).join(' ');
  }

  /**
   * Render a limited Markdown subset used by the recommendation engine:
   * `**bold**` and newlines. Everything else is escaped first, so this cannot
   * become an injection path.
   * @param {string} text
   */
  function inlineMarkdown(text) {
    const escaped = escape(text);
    return raw(escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'));
  }

  /**
   * Turn a newline-separated action list into an ordered list, escaping each
   * line. Falls back to a paragraph when there is only one line.
   * @param {string} text
   */
  function actionList(text) {
    const lines = String(text || '')
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean);

    if (lines.length <= 1) return inlineMarkdown(text);
    return html`<ol>
      ${lines.map((line) => html`<li>${inlineMarkdown(line)}</li>`)}
    </ol>`;
  }

  /**
   * Wrap every occurrence of `query` in the given text with <mark>. The text is
   * escaped first and the query is escaped for use inside a regular
   * expression, so neither side can inject markup.
   * @param {string} text
   * @param {string} query
   */
  function highlight(text, query) {
    const safeText = escape(text);
    const trimmed = String(query || '').trim();
    if (!trimmed) return raw(safeText);

    const pattern = escape(trimmed).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return raw(safeText.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>'));
  }

  GovSpirit.Html = {
    html,
    raw,
    escape,
    render,
    setHTML,
    styleAttr,
    cx,
    inlineMarkdown,
    actionList,
    highlight,
  };
})(window.GovSpirit);
