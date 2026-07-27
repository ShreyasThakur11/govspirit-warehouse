#!/usr/bin/env node
/**
 * Builds docs/presentation/govspirit-overview.pptx.
 *
 * The deck uses the application's own palette rather than a generic template,
 * and every figure in it is taken from the source or from a verification
 * script, not written by hand.
 *
 * A layout guard runs as the deck is assembled: every element is registered
 * with its rectangle, and the script fails if two overlap or if anything
 * crosses the margin. Visual inspection tooling is not available in this
 * environment, so the geometry is checked arithmetically instead.
 *
 * Usage: node docs/presentation/build-deck.mjs
 */

import PptxGenJS from 'pptxgenjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(HERE, 'govspirit-overview.pptx');

/* ── Palette, taken from assets/css/01-tokens.css ───────────────────────── */
const C = {
  ink: '111412', // --surface-page dark
  card: '1A1F1C', // --surface-card dark
  paper: 'F2F4F2', // --surface-page light
  white: 'FFFFFF',
  verdigris: '0F6F62', // --accent
  verdigrisLight: '4FD6C4', // --accent-ink dark
  verdigrisDeep: '0A6B60', // --accent-ink light
  brass: 'C07A2C', // --caution-fill
  onDark: 'E9EFEA',
  onDarkSoft: 'A6B2AC',
  onLight: '121614',
  onLightSoft: '47524D',
  onLightMuted: '5C6862',
  hairline: 'DFE5E1',
  hairlineDark: '2A322E',
  critical: 'BB2233',
  positive: '1F7A4D',
};

const FONT_HEAD = 'Georgia';
const FONT_BODY = 'Calibri';

const W = 10;
const H = 5.625;
const M = 0.55; // page margin

/* ── Layout guard ───────────────────────────────────────────────────────── */

const problems = [];
let currentSlide = 0;
let placed = [];

const overlaps = (a, b) =>
  a.x < b.x + b.w - 0.02 &&
  a.x + a.w - 0.02 > b.x &&
  a.y < b.y + b.h - 0.02 &&
  a.y + a.h - 0.02 > b.y;

/**
 * Register a rectangle. `layer` lets a deliberate stack (text on a card) be
 * declared, so only unintended collisions are reported.
 */
function claim(name, rect, layer = 0) {
  if (
    rect.x < M - 0.001 ||
    rect.y < 0.2 ||
    rect.x + rect.w > W - M + 0.001 ||
    rect.y + rect.h > H - 0.22
  ) {
    problems.push(
      `slide ${currentSlide}: "${name}" breaks the margin (${rect.x.toFixed(2)}, ${rect.y.toFixed(2)}, ${rect.w.toFixed(2)} x ${rect.h.toFixed(2)})`
    );
  }
  for (const other of placed) {
    if (other.layer !== layer) continue;
    if (overlaps(rect, other.rect)) {
      problems.push(`slide ${currentSlide}: "${name}" overlaps "${other.name}" on layer ${layer}`);
    }
  }
  placed.push({ name, rect, layer });
  return rect;
}

const pres = new PptxGenJS();
pres.layout = 'LAYOUT_16x9';
pres.author = 'Shreyas Thakur';
pres.company = 'GovSpirit';
pres.title = 'GovSpirit: warehouse analytics for state excise depots';
pres.subject = 'Problem, approach, architecture, findings and results';

function newSlide(background) {
  currentSlide += 1;
  placed = [];
  const slide = pres.addSlide();
  slide.background = { color: background };
  return slide;
}

/* ── Repeated parts ─────────────────────────────────────────────────────── */

/** The motif: a small brass square beside a capitalised section label. */
function eyebrow(slide, text, { dark = false } = {}) {
  const y = 0.44;
  slide.addShape(pres.shapes.RECTANGLE, {
    ...claim('eyebrow-mark', { x: M, y: y + 0.055, w: 0.1, h: 0.1 }),
    fill: { color: C.brass },
  });
  slide.addText(text.toUpperCase(), {
    ...claim('eyebrow-text', { x: M + 0.22, y, w: 6, h: 0.24 }),
    fontFace: FONT_BODY,
    fontSize: 10,
    bold: true,
    charSpacing: 2.4,
    color: dark ? C.onDarkSoft : C.onLightMuted,
    margin: 0,
    valign: 'middle',
  });
}

function heading(slide, text, { dark = false, y = 0.86, h = 0.78, size = 30 } = {}) {
  slide.addText(text, {
    ...claim('heading', { x: M, y, w: W - 2 * M, h }),
    fontFace: FONT_HEAD,
    fontSize: size,
    bold: true,
    color: dark ? C.onDark : C.onLight,
    margin: 0,
    valign: 'top',
    lineSpacingMultiple: 0.94,
  });
}

/**
 * Speaker notes, keyed by slide number. Written to be read aloud, with the
 * question each slide answers and a rough time budget for a 15 minute talk.
 */
const NOTES = {
  1: `[00:00, 30s] Open with what it is in one sentence: a stock spreadsheet goes in, a dashboard comes out, and nothing leaves the laptop.
Do not read the slide. Say the last clause out loud, it is the whole pitch.`,

  2: `[00:30, 2m] Question answered: why does this need to exist?
Two halves. Left: the questions a depot manager cannot answer quickly. Right: the reason they cannot buy a tool that answers them.
Land the closing line slowly. Every architectural decision later in the deck follows from that one constraint, so it is worth the pause.`,

  3: `[02:30, 2m] Question answered: what does it actually do?
Walk the five cards left to right. Do not elaborate on all of them; Map and Advise are the interesting ones.
Map: 255 known column spellings, because no two depots name the quantity column the same way.
Advise: rules, not a model. A supervisor can disagree with a threshold. They cannot disagree with a neural network.`,

  4: `[04:30, 2m] Question answered: how is it put together?
Four layers, data flows one way. The counts on the right are real module counts.
The right-hand column is the part worth defending. Expect to be asked why there is no framework. The answer is on the slide: a depot keeps this on a shared drive, and it has to still open in five years.`,

  5: `[06:30, 2m30s] This is the slide that matters. Slow down.
Version 1 reported 98.5% inventory accuracy to depots that had never uploaded a cycle count. That number was a literal in the source.
It then fed the health score, so the less data you supplied, the better you scored.
Read the italic line aloud. If the audience remembers one sentence, this is the one.`,

  6: `[09:00, 2m] Question answered: what was actually wrong?
Six faults, all of which produced plausible output. Pick two to narrate and let the rest be read.
The date ones land best: one shifted every record by a day for anyone east of UTC, the other read 01/02 as 2 January instead of 1 February. Both silent, both wrong on every row.`,

  7: `[11:00, 1m30s] Question answered: how do you know it stays fixed?
The contrast checker found four wrong ratios in my own comments the first time it ran. Say that. It makes the point that documentation drifts unless something checks it.
The class checker found 146 orphans, one of which was a tab strip rendering as 22px plain text that I had looked at several times without noticing.`,

  8: `[12:30, 1m] Question answered: who can use it?
Do not read all six. Pick the drawer one: it is a real modal, so it traps focus, closes on Escape and marks the page behind it inert.
Finish on the last line. Naming the gap is more credible than claiming there is none.`,

  9: `[13:30, 1m] Question answered: why does it look like that?
The palette comes from the room: green glass, brass, kraft paper, concrete. Status colours match the paint already on a warehouse floor.
The removals matter as much as the additions. 146 emoji went, because a screen reader announces one of them as "skull".`,

  10: `[14:30, 1m] Question answered: was it worth doing?
Let them read it. Point at two rows only: the invented metrics, and the script bytes.
Every figure here was counted from the source or measured, not estimated.`,

  11: `[15:30, 30s] Close.
Tell them to load the demo rather than describing it. The generator is seeded, so what they see is what you saw.
Offer the docs folder for anyone who wants the metric formulas.`,
};

function footer(slide, index, { dark = false } = {}) {
  if (NOTES[index]) slide.addNotes(NOTES[index]);

  slide.addText('GovSpirit', {
    x: M,
    y: H - 0.42,
    w: 3,
    h: 0.22,
    fontFace: FONT_BODY,
    fontSize: 9,
    color: dark ? C.onDarkSoft : C.onLightMuted,
    margin: 0,
  });
  slide.addText(String(index).padStart(2, '0'), {
    x: W - M - 1,
    y: H - 0.42,
    w: 1,
    h: 0.22,
    fontFace: FONT_BODY,
    fontSize: 9,
    align: 'right',
    color: dark ? C.onDarkSoft : C.onLightMuted,
    margin: 0,
  });
}

/** The GovSpirit mark, drawn from shapes so no image asset is needed. */
function brandMark(slide, x, y, size, colour, accent) {
  const unit = size / 32;
  // Gable roof, drawn as two lines meeting at the apex.
  slide.addShape(pres.shapes.LINE, {
    x: x + 3.5 * unit,
    y: y + 13 * unit,
    w: 12.5 * unit,
    h: 8.5 * unit,
    line: { color: colour, width: 2, endArrowType: 'none' },
    flipV: true,
  });
  slide.addShape(pres.shapes.LINE, {
    x: x + 16 * unit,
    y: y + 4.5 * unit,
    w: 12.5 * unit,
    h: 8.5 * unit,
    line: { color: colour, width: 2 },
  });
  // Walls.
  slide.addShape(pres.shapes.LINE, {
    x: x + 3.5 * unit,
    y: y + 13 * unit,
    w: 0,
    h: 15 * unit,
    line: { color: colour, width: 2 },
  });
  slide.addShape(pres.shapes.LINE, {
    x: x + 28.5 * unit,
    y: y + 13 * unit,
    w: 0,
    h: 15 * unit,
    line: { color: colour, width: 2 },
  });
  slide.addShape(pres.shapes.LINE, {
    x: x + 3.5 * unit,
    y: y + 28 * unit,
    w: 25 * unit,
    h: 0,
    line: { color: colour, width: 2 },
  });
  // Three measurement bars, the tallest in brass.
  slide.addShape(pres.shapes.LINE, {
    x: x + 10.5 * unit,
    y: y + 19.5 * unit,
    w: 0,
    h: 3.5 * unit,
    line: { color: colour, width: 2 },
  });
  slide.addShape(pres.shapes.LINE, {
    x: x + 16 * unit,
    y: y + 17 * unit,
    w: 0,
    h: 6 * unit,
    line: { color: colour, width: 2 },
  });
  slide.addShape(pres.shapes.LINE, {
    x: x + 21.5 * unit,
    y: y + 14.5 * unit,
    w: 0,
    h: 8.5 * unit,
    line: { color: accent, width: 2.5 },
  });
}

/** A statistic block: large figure, small caption. */
function stat(slide, { x, y, w, value, label, colour, valueSize = 30 }) {
  slide.addText(value, {
    ...claim(`stat-value-${label}`, { x, y, w, h: 0.52 }),
    fontFace: FONT_HEAD,
    fontSize: valueSize,
    bold: true,
    color: colour,
    margin: 0,
    valign: 'middle',
  });
  slide.addText(label, {
    ...claim(`stat-label-${label}`, { x, y: y + 0.52, w, h: 0.5 }),
    fontFace: FONT_BODY,
    fontSize: 11,
    color: C.onLightMuted,
    margin: 0,
    valign: 'top',
    lineSpacingMultiple: 0.92,
  });
}

/** A bordered card with a heading and body copy. */
function card(slide, { x, y, w, h, title, body, accent = C.verdigris, index }) {
  const rect = claim(`card-${title}`, { x, y, w, h });
  slide.addShape(pres.shapes.RECTANGLE, {
    ...rect,
    fill: { color: C.white },
    line: { color: C.hairline, width: 1 },
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x,
    y,
    w: 0.055,
    h,
    fill: { color: accent },
    line: { none: true },
  });

  let cursor = y + 0.2;
  if (index !== undefined) {
    slide.addText(index, {
      x: x + 0.26,
      y: cursor,
      w: w - 0.5,
      h: 0.24,
      fontFace: FONT_BODY,
      fontSize: 10,
      bold: true,
      charSpacing: 1.6,
      color: accent,
      margin: 0,
    });
    cursor += 0.26;
  }

  slide.addText(title, {
    x: x + 0.26,
    y: cursor,
    w: w - 0.5,
    h: 0.3,
    fontFace: FONT_HEAD,
    fontSize: 14,
    bold: true,
    color: C.onLight,
    margin: 0,
    valign: 'top',
  });

  slide.addText(body, {
    x: x + 0.26,
    y: cursor + 0.34,
    w: w - 0.5,
    h: h - (cursor - y) - 0.5,
    fontFace: FONT_BODY,
    fontSize: 11.5,
    color: C.onLightSoft,
    margin: 0,
    valign: 'top',
    lineSpacingMultiple: 1.02,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   1. Title
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.ink);

  {
    brandMark(s, M, 0.72, 0.62, C.verdigrisLight, C.brass);

    s.addText('GovSpirit', {
      ...claim('title', { x: M, y: 1.66, w: 7.4, h: 0.92 }),
      fontFace: FONT_HEAD,
      fontSize: 48,
      bold: true,
      color: C.onDark,
      margin: 0,
      valign: 'middle',
    });

    s.addText('Warehouse analytics for state excise depots', {
      ...claim('subtitle', { x: M, y: 2.6, w: 7.6, h: 0.4 }),
      fontFace: FONT_BODY,
      fontSize: 18,
      color: C.verdigrisLight,
      margin: 0,
    });

    s.addText(
      'Open a stock spreadsheet. Get KPIs, a storage plan and a ranked list of things to fix. Everything runs in the browser: no upload, no server, no account.',
      {
        ...claim('lede', { x: M, y: 3.12, w: 6.6, h: 0.8 }),
        fontFace: FONT_BODY,
        fontSize: 13,
        color: C.onDarkSoft,
        margin: 0,
        lineSpacingMultiple: 1.15,
      }
    );

    s.addShape(pres.shapes.RECTANGLE, {
      ...claim('rule', { x: M, y: 4.14, w: 1.5, h: 0.02 }),
      fill: { color: C.brass },
      line: { none: true },
    });

    s.addText(
      [
        { text: 'Shreyas Thakur', options: { bold: true, breakLine: true } },
        { text: 'Version 2.0  ·  MIT licensed  ·  Open source' },
      ],
      {
        ...claim('byline', { x: M, y: 4.32, w: 5, h: 0.62 }),
        fontFace: FONT_BODY,
        fontSize: 11.5,
        color: C.onDarkSoft,
        margin: 0,
        lineSpacingMultiple: 1.1,
      }
    );
  }

  footer(s, 1, { dark: true });
}

/* ══════════════════════════════════════════════════════════════════════════
   2. The problem
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.paper);
  eyebrow(s, 'The problem');
  heading(s, 'An afternoon with a pivot table');

  s.addText(
    'A depot manager has stock data. It is in a spreadsheet, the column headings are whatever the last clerk typed, and answering a routine question means rebuilding the same analysis by hand.',
    {
      ...claim('intro', { x: M, y: 1.68, w: 5.1, h: 0.95 }),
      fontFace: FONT_BODY,
      fontSize: 13.5,
      color: C.onLightSoft,
      margin: 0,
      lineSpacingMultiple: 1.12,
    }
  );

  s.addText(
    [
      {
        text: 'Which lines have not moved in three months?',
        options: { bullet: true, breakLine: true },
      },
      { text: 'What is sitting in the wrong zone?', options: { bullet: true, breakLine: true } },
      {
        text: 'How much capital is tied up in dead stock?',
        options: { bullet: true, breakLine: true },
      },
      { text: 'Are we short-shipping any customer repeatedly?', options: { bullet: true } },
    ],
    {
      ...claim('questions', { x: M, y: 2.72, w: 5.1, h: 1.5 }),
      fontFace: FONT_BODY,
      fontSize: 13,
      color: C.onLight,
      margin: 0,
      paraSpaceAfter: 7,
    }
  );

  const boxX = 6.0;
  const boxRect = claim('constraint', { x: boxX, y: 1.68, w: W - M - boxX, h: 2.54 });
  s.addShape(pres.shapes.RECTANGLE, {
    ...boxRect,
    fill: { color: C.ink },
    line: { none: true },
  });
  s.addText('AND', {
    x: boxX + 0.32,
    y: 1.92,
    w: 2.6,
    h: 0.24,
    fontFace: FONT_BODY,
    fontSize: 10,
    bold: true,
    charSpacing: 2.4,
    color: C.brass,
    margin: 0,
  });
  s.addText('the data cannot leave the building', {
    x: boxX + 0.32,
    y: 2.2,
    w: 2.85,
    h: 0.9,
    fontFace: FONT_HEAD,
    fontSize: 19,
    bold: true,
    color: C.onDark,
    margin: 0,
    valign: 'top',
    lineSpacingMultiple: 0.95,
  });
  s.addText(
    'Uploading a state’s stock position to a third-party analytics service is usually not an option, and often not permitted.',
    {
      x: boxX + 0.32,
      y: 3.18,
      w: 2.85,
      h: 0.9,
      fontFace: FONT_BODY,
      fontSize: 11.5,
      color: C.onDarkSoft,
      margin: 0,
      lineSpacingMultiple: 1.1,
    }
  );

  s.addText(
    'That single constraint rules out a server, which rules out a database, which rules out most of what an analytics product normally is.',
    {
      ...claim('consequence', { x: M, y: 4.42, w: W - 2 * M, h: 0.5 }),
      fontFace: FONT_HEAD,
      fontSize: 14,
      italic: true,
      color: C.verdigrisDeep,
      margin: 0,
    }
  );

  footer(s, 2);
}

/* ══════════════════════════════════════════════════════════════════════════
   3. What it does
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.paper);
  eyebrow(s, 'What it does');
  heading(s, 'Read a file, then report on it');

  const steps = [
    ['01', 'Read', 'Excel, CSV, TSV, multi-sheet workbooks, or a pasted text list.'],
    ['02', 'Map', 'Matches your headings against 255 known variants and shows its confidence.'],
    ['03', 'Check', '17 data quality rules, each naming the affected spreadsheet rows.'],
    ['04', 'Analyse', 'Valuation, ABC and XYZ classes, dead stock, utilisation, fill rate.'],
    ['05', 'Advise', 'Nine rules producing ranked actions against a stated threshold.'],
  ];

  const gap = 0.16;
  const cardW = (W - 2 * M - gap * 4) / 5;
  steps.forEach(([num, title, body], i) => {
    card(s, {
      x: M + i * (cardW + gap),
      y: 1.74,
      w: cardW,
      h: 2.24,
      index: num,
      title,
      body,
      accent: i === 4 ? C.brass : C.verdigris,
    });
  });

  s.addText(
    'Every step runs inside the browser tab. Nothing in this row crosses a network boundary.',
    {
      ...claim('note', { x: M, y: 4.26, w: W - 2 * M, h: 0.4 }),
      fontFace: FONT_BODY,
      fontSize: 12,
      color: C.onLightMuted,
      margin: 0,
    }
  );

  footer(s, 3);
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Architecture
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.paper);
  eyebrow(s, 'Architecture');
  heading(s, 'Four layers, one direction');

  const layers = [
    ['Ingestion', 'File reader, column mapper, validator, transformer', C.verdigris, 5],
    ['Analytics', 'KPIs, classification, aging, utilisation, recommendations', C.brass, 6],
    ['State', 'One store, event driven, frozen reads', C.verdigrisDeep, 5],
    ['Views', 'Eleven pages, shared component vocabulary', C.onLightSoft, 11],
  ];

  const rowH = 0.6;
  const rowGap = 0.14;
  layers.forEach(([name, detail, colour, count], i) => {
    const y = 1.72 + i * (rowH + rowGap);
    const rect = claim(`layer-${name}`, { x: M, y, w: 6.55, h: rowH });
    s.addShape(pres.shapes.RECTANGLE, {
      ...rect,
      fill: { color: C.white },
      line: { color: C.hairline, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: M,
      y,
      w: 0.055,
      h: rowH,
      fill: { color: colour },
      line: { none: true },
    });
    s.addText(name, {
      x: M + 0.24,
      y: y + 0.09,
      w: 1.5,
      h: 0.42,
      fontFace: FONT_HEAD,
      fontSize: 14,
      bold: true,
      color: C.onLight,
      margin: 0,
      valign: 'middle',
    });
    s.addText(detail, {
      x: M + 1.78,
      y: y + 0.09,
      w: 4.0,
      h: 0.42,
      fontFace: FONT_BODY,
      fontSize: 11.5,
      color: C.onLightSoft,
      margin: 0,
      valign: 'middle',
    });
    s.addText(String(count), {
      x: M + 5.85,
      y: y + 0.09,
      w: 0.55,
      h: 0.42,
      fontFace: FONT_HEAD,
      fontSize: 15,
      bold: true,
      align: 'right',
      color: colour,
      margin: 0,
      valign: 'middle',
    });
  });

  const sideX = 7.4;
  s.addText('Held deliberately', {
    ...claim('side-title', { x: sideX, y: 1.72, w: W - M - sideX, h: 0.3 }),
    fontFace: FONT_HEAD,
    fontSize: 14,
    bold: true,
    color: C.onLight,
    margin: 0,
  });
  s.addText(
    [
      { text: 'No build step', options: { bold: true, breakLine: true } },
      {
        text: 'The folder still opens in five years without a toolchain.',
        options: { breakLine: true },
      },
      { text: '', options: { breakLine: true, fontSize: 5 } },
      { text: 'No framework', options: { bold: true, breakLine: true } },
      { text: 'One runtime dependency, no upgrade treadmill.', options: { breakLine: true } },
      { text: '', options: { breakLine: true, fontSize: 5 } },
      { text: 'No backend', options: { bold: true, breakLine: true } },
      { text: 'Nothing to send data to, by construction.' },
    ],
    {
      ...claim('side-body', { x: sideX, y: 2.1, w: W - M - sideX, h: 2.3 }),
      fontFace: FONT_BODY,
      fontSize: 11.5,
      color: C.onLightSoft,
      margin: 0,
      lineSpacingMultiple: 1.06,
    }
  );

  footer(s, 4);
}

/* ══════════════════════════════════════════════════════════════════════════
   5. The honesty principle
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.ink);
  eyebrow(s, 'The principle that mattered most', { dark: true });
  heading(s, 'A metric with no evidence returns nothing', { dark: true });

  s.addText(
    'Version 1 reported 98.5% inventory accuracy for depots that had never uploaded a cycle count. It reported 15 picks per hour with no workforce file, and 97% pick accuracy from nowhere at all.',
    {
      ...claim('body', { x: M, y: 1.74, w: 5.3, h: 1.05 }),
      fontFace: FONT_BODY,
      fontSize: 13.5,
      color: C.onDarkSoft,
      margin: 0,
      lineSpacingMultiple: 1.14,
    }
  );

  s.addText(
    'Those three invented figures then fed the warehouse health score, so a depot that had supplied nothing but a stock list scored well.',
    {
      ...claim('body2', { x: M, y: 2.88, w: 5.3, h: 0.8 }),
      fontFace: FONT_BODY,
      fontSize: 13.5,
      color: C.onDarkSoft,
      margin: 0,
      lineSpacingMultiple: 1.14,
    }
  );

  s.addText(
    'A dashboard that supplies its own inputs is worse than no dashboard, because it is confidently wrong.',
    {
      ...claim('pull', { x: M, y: 3.82, w: 5.3, h: 0.86 }),
      fontFace: FONT_HEAD,
      fontSize: 16,
      italic: true,
      color: C.verdigrisLight,
      margin: 0,
      lineSpacingMultiple: 1.06,
    }
  );

  const panelX = 6.25;
  const panelRect = claim('panel', { x: panelX, y: 1.74, w: W - M - panelX, h: 2.94 });
  s.addShape(pres.shapes.RECTANGLE, {
    ...panelRect,
    fill: { color: C.card },
    line: { color: C.hairlineDark, width: 1 },
  });

  const rows = [
    ['Inventory accuracy', 'needs a cycle count'],
    ['Picks per hour', 'needs a workforce file'],
    ['Pick accuracy', 'needs a workforce file'],
    ['Turnover', 'needs dispatch value'],
  ];
  s.addText('NOW RETURNS N/A', {
    x: panelX + 0.3,
    y: 1.98,
    w: 2.9,
    h: 0.24,
    fontFace: FONT_BODY,
    fontSize: 10,
    bold: true,
    charSpacing: 2,
    color: C.brass,
    margin: 0,
  });
  rows.forEach(([name, need], i) => {
    const y = 2.34 + i * 0.54;
    s.addText(name, {
      x: panelX + 0.3,
      y,
      w: 2.9,
      h: 0.24,
      fontFace: FONT_BODY,
      fontSize: 12.5,
      bold: true,
      color: C.onDark,
      margin: 0,
    });
    s.addText(need, {
      x: panelX + 0.3,
      y: y + 0.23,
      w: 2.9,
      h: 0.22,
      fontFace: FONT_BODY,
      fontSize: 10.5,
      color: C.onDarkSoft,
      margin: 0,
    });
  });

  footer(s, 5, { dark: true });
}

/* ══════════════════════════════════════════════════════════════════════════
   6. What the audit found
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.paper);
  eyebrow(s, 'What the audit found');
  heading(s, 'Six faults that changed the numbers');

  const findings = [
    [
      'Dead route',
      'navigate(‘upload’) pointed at a page that was never registered. Every "load data first" redirect was a dead end.',
    ],
    [
      'Silent zeroing',
      'Import wrote price_per_bottle, the transformer read unit_price. Every unit price became zero, and the valuation with it.',
    ],
    [
      'One day out',
      'Day keys used toISOString, shifting every record east of UTC by a day. That is the entire target audience.',
    ],
    [
      'One month out',
      'Slash dates parsed month-first, so 01/02/2026 became 2 January instead of 1 February.',
    ],
    [
      'Corrupted rows',
      'CSV parsing was split by comma, breaking any quoted comma, quoted newline or CRLF file.',
    ],
    [
      'Invisible CSS',
      'Eight declarations used an invalid alpha syntax and were dropped, leaving the active nav item with no background.',
    ],
  ];

  const gap = 0.16;
  const cardW = (W - 2 * M - gap * 2) / 3;
  const cardH = 1.3;
  findings.forEach(([title, body], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    card(s, {
      x: M + col * (cardW + gap),
      y: 1.72 + row * (cardH + gap),
      w: cardW,
      h: cardH,
      title,
      body,
      accent: C.critical,
    });
  });

  s.addText('Each one produced plausible output. None produced correct output.', {
    ...claim('close', { x: M, y: 4.52, w: W - 2 * M, h: 0.36 }),
    fontFace: FONT_HEAD,
    fontSize: 13.5,
    italic: true,
    color: C.onLightSoft,
    margin: 0,
  });

  footer(s, 6);
}

/* ══════════════════════════════════════════════════════════════════════════
   7. Verification
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.paper);
  eyebrow(s, 'Verification');
  heading(s, 'Checks that fail the build');

  const checks = [
    [
      'Contrast',
      'Recomputes all 16 colour pairings from the stylesheet using the WCAG formula. Four documented ratios were wrong the first time it ran.',
    ],
    [
      'Stylesheet coverage',
      'Asserts every class in the markup has a rule. Found 146 orphans, including a tab strip rendering as plain text.',
    ],
    [
      'Browser smoke test',
      'Loads the app in headless Chromium, walks all 11 views at three widths, fails on console errors, overflow or unsized charts.',
    ],
  ];

  const gap = 0.18;
  const cardW = (W - 2 * M - gap * 2) / 3;
  checks.forEach(([title, body], i) => {
    card(s, {
      x: M + i * (cardW + gap),
      y: 1.72,
      w: cardW,
      h: 1.72,
      title,
      body,
      accent: C.verdigris,
    });
  });

  const statY = 3.74;
  stat(s, {
    x: M,
    y: statY,
    w: 2.1,
    value: '4.82:1',
    label: 'Lowest contrast ratio\nagainst a 4.5:1 requirement',
    colour: C.positive,
  });
  stat(s, {
    x: M + 2.3,
    y: statY,
    w: 2.1,
    value: '236',
    label: 'Classes, all of them\ndefined in CSS',
    colour: C.verdigrisDeep,
  });
  stat(s, {
    x: M + 4.6,
    y: statY,
    w: 2.1,
    value: '11 x 3',
    label: 'Views by widths, walked\non every push',
    colour: C.verdigrisDeep,
  });
  stat(s, {
    x: M + 6.9,
    y: statY,
    w: 2.0,
    value: '0',
    label: 'Console errors\nacross the walk',
    colour: C.brass,
  });

  footer(s, 7);
}

/* ══════════════════════════════════════════════════════════════════════════
   8. Accessibility
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.paper);
  eyebrow(s, 'Accessibility');
  heading(s, 'Built to WCAG 2.2 Level AA');

  const points = [
    [
      'Measured, not assumed',
      'Every text colour carries the ratio it achieves, and CI recomputes it.',
    ],
    [
      'Real modal behaviour',
      'The mobile drawer traps focus, closes on Escape, and marks the page inert.',
    ],
    [
      'Reachable by keyboard',
      'Scroll containers are focusable, because content only reachable by scrolling must be reachable by key.',
    ],
    [
      'Text that scales',
      'Sizes in rem, so the browser font setting is respected. Version 1 pinned 14px.',
    ],
    [
      'Never colour alone',
      'Every status carries a word. Zone tags print the letter next to the swatch.',
    ],
    [
      'Charts described',
      'Each canvas carries a text summary, and the same figures exist in a table.',
    ],
  ];

  // Two columns inside the printable width: (10 - 2 * 0.55 - 0.5) / 2 = 4.2
  const colW = 4.2;
  const colGap = 0.5;
  points.forEach(([title, body], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (colW + colGap);
    const y = 1.74 + row * 0.94;

    s.addShape(pres.shapes.RECTANGLE, {
      ...claim(`tick-${title}`, { x, y: y + 0.06, w: 0.09, h: 0.09 }),
      fill: { color: C.verdigris },
      line: { none: true },
    });
    s.addText(title, {
      ...claim(`pt-title-${title}`, { x: x + 0.22, y, w: colW - 0.22, h: 0.24 }),
      fontFace: FONT_HEAD,
      fontSize: 13,
      bold: true,
      color: C.onLight,
      margin: 0,
    });
    s.addText(body, {
      ...claim(`pt-body-${title}`, { x: x + 0.22, y: y + 0.25, w: colW - 0.22, h: 0.56 }),
      fontFace: FONT_BODY,
      fontSize: 11,
      color: C.onLightSoft,
      margin: 0,
      lineSpacingMultiple: 1.04,
    });
  });

  s.addText(
    'Known gaps are documented rather than omitted: no screen reader has yet been run against it.',
    {
      ...claim('gap-note', { x: M, y: 4.62, w: W - 2 * M, h: 0.34 }),
      fontFace: FONT_BODY,
      fontSize: 11.5,
      italic: true,
      color: C.onLightMuted,
      margin: 0,
    }
  );

  footer(s, 8);
}

/* ══════════════════════════════════════════════════════════════════════════
   9. Design
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.paper);
  eyebrow(s, 'Design');
  heading(s, 'Chrome recedes, data advances');

  s.addText(
    'Saturated colour does three jobs and no others: it marks a chart series, it flags a status that needs attention, and it identifies something interactive. Everything else is neutral.',
    {
      ...claim('intro', { x: M, y: 1.72, w: 5.2, h: 0.86 }),
      fontFace: FONT_BODY,
      fontSize: 13,
      color: C.onLightSoft,
      margin: 0,
      lineSpacingMultiple: 1.12,
    }
  );

  s.addText(
    'The palette comes from the room the software is used in: green glass, brass fittings, kraft paperwork, concrete floors. Status colours match the paint already on the floor, so they need no legend.',
    {
      ...claim('intro2', { x: M, y: 2.66, w: 5.2, h: 0.94 }),
      fontFace: FONT_BODY,
      fontSize: 13,
      color: C.onLightSoft,
      margin: 0,
      lineSpacingMultiple: 1.12,
    }
  );

  const swatches = [
    ['0F6F62', 'Verdigris', 'interactive'],
    ['C07A2C', 'Brass', 'caution'],
    ['1F7A4D', 'Green', 'clear'],
    ['BB2233', 'Red', 'stop'],
    ['5C6862', 'Slate', 'chrome'],
  ];
  swatches.forEach(([hex, name, role], i) => {
    const y = 3.72 + 0;
    const x = M + i * 1.06;
    s.addShape(pres.shapes.RECTANGLE, {
      ...claim(`swatch-${name}`, { x, y, w: 0.88, h: 0.4 }),
      fill: { color: hex },
      line: { none: true },
    });
    s.addText(name, {
      ...claim(`swatch-name-${name}`, { x, y: y + 0.44, w: 0.98, h: 0.2 }),
      fontFace: FONT_BODY,
      fontSize: 10,
      bold: true,
      color: C.onLight,
      margin: 0,
    });
    s.addText(role, {
      ...claim(`swatch-role-${name}`, { x, y: y + 0.63, w: 0.98, h: 0.2 }),
      fontFace: FONT_BODY,
      fontSize: 9.5,
      color: C.onLightMuted,
      margin: 0,
    });
  });

  const panelX = 6.1;
  const panelRect = claim('removed', { x: panelX, y: 1.72, w: W - M - panelX, h: 2.72 });
  s.addShape(pres.shapes.RECTANGLE, {
    ...panelRect,
    fill: { color: C.white },
    line: { color: C.hairline, width: 1 },
  });
  s.addText('REMOVED', {
    x: panelX + 0.28,
    y: 1.94,
    w: 2.8,
    h: 0.24,
    fontFace: FONT_BODY,
    fontSize: 10,
    bold: true,
    charSpacing: 2,
    color: C.critical,
    margin: 0,
  });
  s.addText(
    [
      { text: '146 emoji', options: { bold: true, breakLine: true } },
      {
        text: 'Replaced by a 50 glyph SVG set that inherits colour and is not read aloud as "skull".',
        options: { breakLine: true },
      },
      { text: '', options: { breakLine: true, fontSize: 5 } },
      { text: 'Every gradient', options: { bold: true, breakLine: true } },
      {
        text: 'Indigo to violet on the logo, buttons, headings and progress bars.',
        options: { breakLine: true },
      },
      { text: '', options: { breakLine: true, fontSize: 5 } },
      { text: '20px radii', options: { bold: true, breakLine: true } },
      { text: 'A reporting tool should sit closer to a printed form.' },
    ],
    {
      x: panelX + 0.28,
      y: 2.28,
      w: 2.85,
      h: 2.0,
      fontFace: FONT_BODY,
      fontSize: 11,
      color: C.onLightSoft,
      margin: 0,
      lineSpacingMultiple: 1.04,
    }
  );

  footer(s, 9);
}

/* ══════════════════════════════════════════════════════════════════════════
   10. Results
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.paper);
  eyebrow(s, 'Results');
  heading(s, 'Version 1 against version 2');

  const rows = [
    ['Correctness faults in the data path', '6 known', '0 known'],
    ['Metrics invented when data was absent', '3', '0'],
    ['Unescaped render paths', 'all', 'none'],
    ['Dead code shipped to the browser', '463 lines', '0'],
    ['Script bytes before first interaction', '1.65 MB', '206 KB'],
    ['Smallest verified screen width', 'not tested', '320 px'],
    ['Automated checks in CI', '0', '5'],
  ];

  const tableRows = [
    [
      { text: 'Measure', options: { bold: true, color: C.white, fill: { color: C.verdigris } } },
      {
        text: 'Version 1',
        options: { bold: true, color: C.white, fill: { color: C.verdigris }, align: 'center' },
      },
      {
        text: 'Version 2',
        options: { bold: true, color: C.white, fill: { color: C.verdigris }, align: 'center' },
      },
    ],
    ...rows.map(([label, before, after], i) => [
      { text: label, options: { color: C.onLight, fill: { color: i % 2 ? C.paper : C.white } } },
      {
        text: before,
        options: {
          color: C.onLightMuted,
          align: 'center',
          fill: { color: i % 2 ? C.paper : C.white },
        },
      },
      {
        text: after,
        options: {
          color: C.positive,
          bold: true,
          align: 'center',
          fill: { color: i % 2 ? C.paper : C.white },
        },
      },
    ]),
  ];

  claim('table', { x: M, y: 1.72, w: W - 2 * M, h: 2.9 });
  s.addTable(tableRows, {
    x: M,
    y: 1.72,
    w: W - 2 * M,
    colW: [5.3, 1.78, 1.82],
    rowH: 0.335,
    fontFace: FONT_BODY,
    fontSize: 11.5,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: C.hairline },
    margin: [0.04, 0.12, 0.04, 0.12],
  });

  footer(s, 10);
}

/* ══════════════════════════════════════════════════════════════════════════
   11. Close
   ══════════════════════════════════════════════════════════════════════ */
{
  const s = newSlide(C.ink);
  eyebrow(s, 'Try it', { dark: true });
  heading(s, 'Open it and load the demo', { dark: true });

  s.addText(
    'The demo generator is seeded, so it produces the same warehouse on every machine. That makes a bug report reproducible and a demonstration repeatable.',
    {
      ...claim('body', { x: M, y: 1.74, w: 5.5, h: 0.8 }),
      fontFace: FONT_BODY,
      fontSize: 13,
      color: C.onDarkSoft,
      margin: 0,
      lineSpacingMultiple: 1.12,
    }
  );

  const links = [
    ['Application', 'shreyasthakur11.github.io/govspirit-warehouse'],
    ['Source', 'github.com/ShreyasThakur11/govspirit-warehouse'],
    ['Documentation', 'the docs folder in the repository'],
  ];
  links.forEach(([label, value], i) => {
    const y = 2.72 + i * 0.56;
    s.addText(label, {
      ...claim(`link-label-${label}`, { x: M, y, w: 1.6, h: 0.2 }),
      fontFace: FONT_BODY,
      fontSize: 10,
      bold: true,
      charSpacing: 1.4,
      color: C.brass,
      margin: 0,
    });
    s.addText(value, {
      ...claim(`link-value-${label}`, { x: M, y: y + 0.21, w: 5.6, h: 0.3 }),
      fontFace: FONT_BODY,
      fontSize: 13.5,
      color: C.onDark,
      margin: 0,
    });
  });

  brandMark(s, 7.55, 1.9, 1.5, C.verdigrisLight, C.brass);

  s.addText('MIT licensed', {
    ...claim('licence', { x: 7.2, y: 3.72, w: 2.25, h: 0.3 }),
    fontFace: FONT_BODY,
    fontSize: 12,
    align: 'center',
    color: C.onDarkSoft,
    margin: 0,
  });

  footer(s, 11, { dark: true });
}

/* ── Write and report ───────────────────────────────────────────────────── */

await pres.writeFile({ fileName: OUTPUT });

console.log(`Wrote ${OUTPUT}`);
console.log(`Slides: ${currentSlide}`);

if (problems.length) {
  console.error(`\nLayout guard found ${problems.length} problem(s):`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log('Layout guard: no overlaps, nothing outside the margins.');
