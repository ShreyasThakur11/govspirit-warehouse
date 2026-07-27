# Presentation

[Documentation index](../README.md)

**[govspirit-overview.pptx](govspirit-overview.pptx)** is an 11 slide deck
covering the problem, the approach, the architecture, the findings and the
results. Speaker notes are embedded in the file, one set per slide, each with
the question that slide answers and a time budget for a 15 minute talk.

## Running order

| #   | Slide                                     | Answers                         | Time |
| --- | ----------------------------------------- | ------------------------------- | ---- |
| 1   | Title                                     | What is this?                   | 0:30 |
| 2   | An afternoon with a pivot table           | Why does it need to exist?      | 2:00 |
| 3   | Read a file, then report on it            | What does it do?                | 2:00 |
| 4   | Four layers, one direction                | How is it put together?         | 2:00 |
| 5   | A metric with no evidence returns nothing | What is the governing idea?     | 2:30 |
| 6   | Six faults that changed the numbers       | What was actually wrong?        | 2:00 |
| 7   | Checks that fail the build                | How do you know it stays fixed? | 1:30 |
| 8   | Built to WCAG 2.2 Level AA                | Who can use it?                 | 1:00 |
| 9   | Chrome recedes, data advances             | Why does it look like that?     | 1:00 |
| 10  | Version 1 against version 2               | Was it worth doing?             | 1:00 |
| 11  | Open it and load the demo                 | What now?                       | 0:30 |

Total, without questions: about 16 minutes.

## Cutting it down

**Five minutes:** slides 1, 2, 5, 10, 11. That is the problem, the governing
idea, the outcome and the link. Slide 5 is the one to keep if you can only keep
one.

**Ten minutes:** add 3 and 6.

**Technical audience:** add 4 and 7, and be ready for the question about why
there is no framework. The answer is on slide 4.

## Running the demonstration

Open the application, choose **Demo data**, and let it load before you speak
again. It takes about two seconds.

The generator is seeded, so the numbers on your screen are the numbers on
everyone else's. Two worth pointing at:

- **Executive summary** shows the health score computed from the components
  that have evidence, with the count of those components stated underneath.
- **Recommendations** shows ranked actions, each with the threshold that
  triggered it.

Toggle the theme while a chart is on screen. The charts follow without the page
reloading, which is the visible result of reading colours from CSS rather than
hard-coding them.

## Where the numbers come from

Every figure in the deck is counted from the source or produced by a
verification script. None is estimated.

| Figure                                                           | Source                                |
| ---------------------------------------------------------------- | ------------------------------------- |
| 255 column variants, 17 validation rules, 9 recommendation rules | Counted from the source files         |
| 4.82:1 lowest contrast, 16 pairings                              | `npm run check:contrast`              |
| 236 classes, 146 orphans found                                   | `npm run check:classes`               |
| 1.65 MB against 206 KB                                           | Byte counts of the four CDN bundles   |
| 463 lines of dead code                                           | `git show` of the two deleted modules |

## Rebuilding the deck

```bash
npm install --no-save pptxgenjs
node docs/presentation/build-deck.mjs
```

The build script carries a layout guard. Every element registers its rectangle,
and the script exits non-zero if two overlap or if anything crosses the margin.
It caught nine positioning faults on the first run.

Edit the content in `build-deck.mjs` rather than in PowerPoint, so the deck
stays reproducible and the figures stay tied to their sources.
