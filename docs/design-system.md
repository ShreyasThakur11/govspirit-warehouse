# Design system

[Documentation index](README.md)

## The rule

**Chrome recedes, data advances.**

Saturated colour does three jobs and no others: it marks a chart series, it
flags a status that needs attention, and it identifies something interactive.
Everything else is neutral. An operator reading a stock valuation should be
pulled to the figures, never to the furniture around them.

Version 1 broke this rule everywhere. Indigo-to-violet gradients on the logo,
the buttons, the page headings and the progress bars meant the interface was
the loudest thing on screen, competing with the charts it existed to present.

## Where the palette comes from

A bonded excise depot has a real material palette: green glass, brass fittings,
kraft paperwork, concrete floors. The interface borrows from it rather than
from the default blue that ships with every dashboard framework.

| Role        | Colour          | Reason                                                          |
| ----------- | --------------- | --------------------------------------------------------------- |
| Interactive | Verdigris       | Aged copper and bottle glass. Distinct from every status colour |
| Caution     | Brass           | The colour of the product, and the colour already on the floor  |
| Surfaces    | Warm green-grey | Sits under both without competing                               |

Status colours follow the paint already used in a warehouse, so they need no
legend: green is clear, amber is caution, red is stop. Colour is never the only
signal. Every status carries a word as well.

### Chart series

Eight hues at similar perceived lightness, so no series shouts over another,
muted enough to survive being printed in a report.

| Token        | Colour    | Name        |
| ------------ | --------- | ----------- |
| `--series-1` | `#0f6f62` | Verdigris   |
| `--series-2` | `#c07a2c` | Brass       |
| `--series-3` | `#4a7fa5` | Slate blue  |
| `--series-4` | `#8a5a7d` | Mulberry    |
| `--series-5` | `#5c8c4a` | Olive       |
| `--series-6` | `#b0563f` | Terracotta  |
| `--series-7` | `#6b6f9c` | Pewter blue |
| `--series-8` | `#3f8f88` | Sea green   |

`src/ui/charts.js` reads these from the stylesheet rather than holding its own
copy, so the charts and the interface cannot drift apart.

## Contrast is measured, not assumed

Every text colour carries the ratio it achieves, written into the stylesheet
beside it:

```css
--ink-muted: #7f8d87; /* 4.8:1 */
```

`scripts/check-contrast.mjs` parses those annotations, recomputes each ratio
from the actual hex values using the WCAG relative luminance formula, and fails
the build if an annotation is wrong or a pairing falls below 4.5:1.

This is not decoration. Four of the sixteen annotations were wrong when the
check was first run, and one was out by a full point. A comment claiming 4.7:1
is worse than no comment once someone nudges the hex.

| Theme | Lowest text ratio | Requirement |
| ----- | ----------------- | ----------- |
| Dark  | 4.82:1            | 4.5:1       |
| Light | 5.32:1            | 4.5:1       |

## Both themes are first class

Light is not a filter applied to dark. Each theme declares its own surfaces,
inks, washes and chart colours, and each was measured separately.

|                  | Dark      | Light     |
| ---------------- | --------- | --------- |
| Page             | `#111412` | `#f2f4f2` |
| Card             | `#1a1f1c` | `#ffffff` |
| Interactive text | `#4fd6c4` | `#0a6b60` |

The dark theme is a warm green-grey rather than black. Pure black raises
halation around small light text on an LCD, which matters when the reader is
working down a column of five-figure valuations.

The light theme uses warm paper for the page and white for the cards. It is the
working mode in a depot office and the only one that prints sensibly.

Theme selection follows the operating system until the reader makes an explicit
choice, after which the choice wins. An inline script in `<head>` applies the
stored value before first paint, so there is no flash of the wrong scheme.

## Type

Sizes are in `rem`, so they follow the reader's browser font setting. This is a
WCAG 1.4.4 requirement, and the previous stylesheet broke it by pinning
`html { font-size: 14px }`.

| Token                       | Size  | Use                             |
| --------------------------- | ----- | ------------------------------- |
| `--text-2xs`                | 11px  | Labels, captions, table headers |
| `--text-xs`                 | 12px  | Secondary body                  |
| `--text-sm`                 | 13px  | Body, controls                  |
| `--text-md`                 | 14px  | Default                         |
| `--text-lg`                 | 17px  | Panel and section titles        |
| `--text-xl` to `--text-3xl` | fluid | Page titles, headline figures   |

The three largest steps use `clamp()`, so they scale with the viewport instead
of jumping at a breakpoint.

Every numeric column sets `font-variant-numeric: tabular-nums`. In a table of
valuations, digits that do not line up are a legibility fault, not a
preference.

## Space and shape

An eight-point scale, with the page gutter on a `clamp()` so it grows smoothly
from 16px on a phone to 32px on a monitor rather than stepping.

Radii are restrained: 3px to 14px, with pills reserved for actual pills.
Heavily rounded panels read as consumer software. A reporting tool should sit
closer to a printed form.

## Component vocabulary

| Class                                            | Purpose                                                        |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `.panel`                                         | A titled container. Charts, tables and grouped content         |
| `.metric-card`                                   | A single headline figure with a label and optional trend       |
| `.data-table`                                    | Tabular data inside a focusable `.table-scroll`                |
| `.status`                                        | A short state word. Positive, caution, critical, info, neutral |
| `.notice`                                        | A standing explanation, such as the projected-data banner      |
| `.finding`                                       | One row in a list of observations                              |
| `.empty-state`, `.error-state`, `.loading-state` | The three non-happy paths                                      |

`scripts/check-classes.mjs` asserts that every class the markup emits is
defined somewhere in `assets/css`. An orphaned class is silent breakage: the
element renders, it just renders unstyled. The check found 146 during the 2.0
rewrite, including the import page tab strip, which had lost its styling
completely and was rendering as 22px-tall plain text.

## Icons

Fifty glyphs in a single inline SVG sprite, injected once at boot. No network
request, works from `file://`, and every glyph inherits `currentColor`.

Emoji were removed. They render differently on Windows, macOS and Android, they
cannot inherit colour or stroke weight, screen readers announce them literally
("classical building", "package", "skull"), and a control panel for a
government depot that speaks in cartoon pictograms does not read as an
instrument anyone should trust with a stock valuation.

Geometry is consistent: 24 by 24 viewBox, 1.75 stroke, round caps and joins,
optically matched to Inter alongside it.

## The mark

A depot gable seen head on, with three stacked bars inside it. The gable says
warehouse, the bars say measurement, and the tallest bar is brass rather than
verdigris so the mark reads as two-tone at 16px, where a single-colour outline
turns to mush.

The same geometry is used for the favicon, the boot screen, the sidebar and the
mobile topbar, so the identity is one shape at four sizes rather than four
approximations.

The State Emblem of India is deliberately not used. Its reproduction is
restricted under the State Emblem of India (Prohibition of Improper Use) Act,
2005, and an unofficial project has no standing to display it.

## Motion

Three durations (110ms, 180ms, 280ms) and two easings. Everything collapses to
0.01ms under `prefers-reduced-motion`, and any behaviour that depends on a
transition completing has a non-transition fallback, because a transition never
finishes in a backgrounded tab.
