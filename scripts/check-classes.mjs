#!/usr/bin/env node
/**
 * Stylesheet coverage check.
 *
 * Collects every class name the markup emits (from `class="..."` attributes in
 * the page modules and index.html, from the `cx()` helper, and from classList
 * calls) and asserts that each one is defined somewhere in assets/css.
 *
 * A class with no rule behind it is silent breakage: the element still
 * renders, it just renders unstyled, and nothing else in the build complains.
 * This check caught 146 orphaned names during the 2.0 rewrite, including the
 * import page tab strip, which had lost its styling entirely and was rendering
 * as 22px-tall plain text.
 *
 * Usage: node scripts/check-classes.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CSS_DIR = join('assets', 'css');
const JS_DIR = 'src';
const EXTRA_FILES = ['index.html'];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  );
}

/* ── Classes defined in the stylesheets ─────────────────────────────────── */

const defined = new Set();
for (const file of readdirSync(CSS_DIR)) {
  const css = readFileSync(join(CSS_DIR, file), 'utf8');
  for (const match of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(match[1]);
}

/* ── Classes referenced from markup ─────────────────────────────────────── */

const used = new Map();
const note = (cls, file) => {
  if (!used.has(cls)) used.set(cls, new Set());
  used.get(cls).add(file);
};

const sources = [...walk(JS_DIR).filter((f) => f.endsWith('.js')), ...EXTRA_FILES];

for (const file of sources) {
  const text = readFileSync(file, 'utf8');

  // Static class attributes. Attributes holding a template interpolation are
  // skipped, since their value is not knowable without running the code.
  for (const match of text.matchAll(/class="([^"$]*)"/g)) {
    for (const cls of match[1].split(/\s+/).filter(Boolean)) note(cls, file);
  }

  // cx('panel', condition && 'panel--tall')
  for (const match of text.matchAll(/cx\(([^)]*)\)/g)) {
    for (const literal of match[1].matchAll(/'([a-zA-Z][\w-]*)'/g)) note(literal[1], file);
  }

  // classList.add('is-open') and className = 'toast toast-info'
  for (const match of text.matchAll(
    /(?:classList\.(?:add|toggle|remove)\(|className\s*=\s*)[`']([a-zA-Z][\w-]*)/g
  )) {
    note(match[1], file);
  }
}

/* ── Report ─────────────────────────────────────────────────────────────── */

const orphans = [...used.entries()]
  .filter(([cls]) => !defined.has(cls))
  .sort(([a], [b]) => a.localeCompare(b));

if (orphans.length === 0) {
  console.log(`All ${used.size} classes referenced in markup are defined in CSS.`);
} else {
  console.error(`${orphans.length} class(es) used in markup but not defined in any stylesheet:\n`);
  for (const [cls, files] of orphans) {
    console.error(`  ${cls.padEnd(28)} ${[...files].join(', ')}`);
  }
  process.exitCode = 1;
}
