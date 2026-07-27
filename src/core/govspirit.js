/**
 * GovSpirit namespace root.
 *
 * The application ships as plain <script> files with no bundler so that it can
 * be opened straight from the filesystem. Every module is an IIFE that attaches
 * itself to this single global. This file must load first; everything else
 * assumes `window.GovSpirit` already exists.
 */
window.GovSpirit = window.GovSpirit || {};

GovSpirit.VERSION = '2.0.0';

/**
 * Modules declare their dependencies through this helper rather than reaching
 * into the namespace at definition time. That keeps load-order mistakes loud
 * instead of producing a silent `undefined` three calls later.
 *
 * @param {...string} names
 * @returns {object} the requested modules, keyed by name
 */
GovSpirit.require = function require(...names) {
  const resolved = {};
  const missing = [];

  names.forEach((name) => {
    if (GovSpirit[name] === undefined) missing.push(name);
    else resolved[name] = GovSpirit[name];
  });

  if (missing.length) {
    throw new Error(
      `[GovSpirit] Missing dependencies: ${missing.join(', ')}. ` +
        'Check the script order in index.html.'
    );
  }

  return resolved;
};
