#!/usr/bin/env node
/**
 * Shipping completeness check.
 *
 * Asserts that every local file index.html references is actually committed,
 * and that its case matches exactly.
 *
 * Both failure modes are invisible on a developer machine and fatal in
 * production. A `.gitignore` pattern of `data/` silently excluded `src/data/`,
 * so the reference dataset and the demo generator never reached the
 * repository, and the deployed site loaded without them. Windows and macOS
 * also match filenames case-insensitively, where a Linux web server does not.
 *
 * Usage: node scripts/check-shipped.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, basename, join } from 'node:path';

const html = readFileSync('index.html', 'utf8');
const refs = [...html.matchAll(/(?:src|href)="((?:src|assets)\/[^"]+)"/g)].map((m) => m[1]);

const tracked = new Set(
  execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
);

let problems = 0;

for (const ref of refs) {
  const dir = dirname(ref);
  const file = basename(ref);

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    console.error(`  missing directory   ${ref}`);
    problems += 1;
    continue;
  }

  if (!entries.includes(file)) {
    const insensitive = entries.find((e) => e.toLowerCase() === file.toLowerCase());
    if (insensitive) {
      console.error(`  case mismatch       ${ref} exists on disk as ${join(dir, insensitive)}`);
    } else {
      console.error(`  not on disk         ${ref}`);
    }
    problems += 1;
    continue;
  }

  if (!tracked.has(ref)) {
    let reason = 'untracked';
    try {
      reason = execFileSync('git', ['check-ignore', '-v', ref], { encoding: 'utf8' }).trim();
    } catch {
      /* Not ignored, simply never added. */
    }
    console.error(`  not in the repo     ${ref}  (${reason})`);
    problems += 1;
  }
}

if (problems > 0) {
  console.error(
    `\n${problems} of ${refs.length} referenced files would be missing from a fresh clone.`
  );
  process.exit(1);
}

console.log(
  `All ${refs.length} files referenced by index.html are present, correctly cased and committed.`
);
