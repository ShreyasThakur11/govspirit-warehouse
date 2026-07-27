#!/usr/bin/env node
/**
 * Contrast verification.
 *
 * Reads assets/css/01-tokens.css, finds every ink token annotated with a
 * `/* N.N:1 *\/` comment, recomputes the ratio against the surface that token
 * is measured on, and fails if either the annotation is wrong or the pairing
 * falls below the WCAG 2.2 AA threshold for body text.
 *
 * The point is that the numbers written in the stylesheet stay true. A comment
 * claiming 4.7:1 is worse than no comment at all once someone nudges the hex.
 *
 * Formulae are taken directly from the specification:
 *   relative luminance  https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *   contrast ratio      https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *   SC 1.4.3 Contrast (Minimum), Level AA, 4.5:1 for body text
 *                       https://www.w3.org/TR/WCAG22/#contrast-minimum
 *
 * Usage: node scripts/check-contrast.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = join(HERE, '..', 'assets', 'css', '01-tokens.css');

const AA_BODY_TEXT = 4.5;

/**
 * Annotations record the measured ratio to one decimal place. Comparing that
 * way (rather than with an absolute tolerance) avoids an exact-boundary value
 * such as 17.65 failing purely because binary floating point stores it a
 * fraction below the true decimal. The epsilon nudges such values onto the
 * correct side of the rounding boundary.
 */
const toOneDecimal = (value) => Math.round(value * 10 + 1e-9) / 10;

/** sRGB channel to linear light. */
function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const css = readFileSync(TOKENS_FILE, 'utf8');

/** Pull a custom property value out of a named theme block. */
function readToken(themeSelector, token) {
  const block = css.split(themeSelector)[1];
  if (!block) throw new Error(`Theme block "${themeSelector}" not found in 01-tokens.css`);
  const match = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
  if (!match) throw new Error(`Token "${token}" not found under "${themeSelector}"`);
  return match[1];
}

/** Pull the documented ratio out of the trailing comment on a token line. */
function readAnnotation(themeSelector, token) {
  const block = css.split(themeSelector)[1];
  const match = new RegExp(`${token}:\\s*#[0-9a-fA-F]{6};\\s*/\\* *([0-9.]+):1`).exec(block);
  return match ? Number(match[1]) : null;
}

const DARK = "[data-theme='dark'] {";
const LIGHT = "[data-theme='light'] {";

/**
 * Each entry pairs an ink token with the surface it is measured against.
 * The dark inks are measured on --surface-card, the lightest surface in the
 * dark theme that carries body text, so the result holds everywhere darker.
 */
const PAIRS = [
  [DARK, '--ink-strong', '--surface-card'],
  [DARK, '--ink', '--surface-card'],
  [DARK, '--ink-soft', '--surface-card'],
  [DARK, '--ink-muted', '--surface-card'],
  [DARK, '--accent-ink', '--surface-chrome'],
  [DARK, '--positive-ink', '--surface-card'],
  [DARK, '--caution-ink', '--surface-card'],
  [DARK, '--critical-ink', '--surface-card'],
  [LIGHT, '--ink-strong', '--surface-card'],
  [LIGHT, '--ink', '--surface-card'],
  [LIGHT, '--ink-soft', '--surface-card'],
  [LIGHT, '--ink-muted', '--surface-card'],
  [LIGHT, '--accent-ink', '--surface-card'],
  [LIGHT, '--positive-ink', '--surface-card'],
  [LIGHT, '--caution-ink', '--surface-card'],
  [LIGHT, '--critical-ink', '--surface-card'],
];

let failures = 0;
let lowest = Infinity;

const themeName = (selector) => (selector === DARK ? 'dark ' : 'light');

console.log('WCAG 2.2 SC 1.4.3 Contrast (Minimum), Level AA, threshold 4.5:1\n');
console.log(
  `${'theme'.padEnd(6)} ${'token'.padEnd(16)} ${'measured'.padStart(9)} ${'noted'.padStart(6)}  result`
);
console.log('-'.repeat(62));

for (const [theme, inkToken, surfaceToken] of PAIRS) {
  const ink = readToken(theme, inkToken);
  const surface = readToken(theme, surfaceToken);
  const measured = contrastRatio(ink, surface);
  const noted = readAnnotation(theme, inkToken);

  lowest = Math.min(lowest, measured);

  const problems = [];
  if (measured < AA_BODY_TEXT) problems.push(`below AA (${AA_BODY_TEXT}:1)`);
  if (noted === null) problems.push('no documented ratio');
  else if (toOneDecimal(measured) !== toOneDecimal(noted)) {
    problems.push(`annotation says ${noted}, measured ${toOneDecimal(measured)}`);
  }

  if (problems.length) failures += 1;

  console.log(
    `${themeName(theme).padEnd(6)} ${inkToken.replace('--', '').padEnd(16)} ` +
      `${measured.toFixed(2).padStart(9)} ${String(noted ?? 'none').padStart(6)}  ` +
      (problems.length ? `FAIL: ${problems.join('; ')}` : 'pass')
  );
}

console.log('-'.repeat(62));
console.log(`Lowest ratio across all text tokens: ${lowest.toFixed(2)}:1`);

if (failures > 0) {
  console.error(`\n${failures} contrast check(s) failed.`);
  process.exit(1);
}

console.log('\nAll text tokens meet WCAG 2.2 AA and every documented ratio is accurate.');
