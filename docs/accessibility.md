# Accessibility

[Documentation index](README.md)

Target: **WCAG 2.2 Level AA**.

This page records what was done and how it can be checked. It is a statement of
work, not a certification. Nothing here replaces testing with real assistive
technology and real users.

## Automated checks in CI

| Check               | Command                  | Enforces                                                                     |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| Contrast            | `npm run check:contrast` | All 16 text pairings at 4.5:1 or better, and every documented ratio accurate |
| Stylesheet coverage | `npm run check:classes`  | No unstyled element caused by an orphaned class                              |

The contrast check parses `assets/css/01-tokens.css`, recomputes each ratio
from the hex values using the WCAG relative luminance formula, and fails on any
drift.

```
Lowest ratio across all text tokens: 4.82:1
All text tokens meet WCAG 2.2 AA and every documented ratio is accurate.
```

## Perceivable

**1.1.1 Non-text content.** Every chart canvas carries `role="img"` and an
`aria-label` summarising what it shows, including the leading values. Icons are
`aria-hidden` when they sit beside a text label and carry an `aria-label` when
they are the only content of a control.

**1.3.1 Info and relationships.** Landmarks throughout: `banner`, `navigation`,
`main`, `complementary`. Tables use `<caption>`, `scope="col"` on headers, and
`scope="row"` on the first cell of each row, so a screen reader announces which
record a cell belongs to. Form controls are associated with `<label for>`.

**1.4.1 Use of colour.** Colour never carries meaning alone. Every status pill
contains a word, zone tags print the zone letter next to the swatch, and chart
values are labelled.

**1.4.3 Contrast.** Verified above.

**1.4.4 Resize text.** All type is in `rem` and follows the browser font
setting. The previous stylesheet pinned `html { font-size: 14px }`, which
defeated it.

**1.4.10 Reflow.** No horizontal scrolling at 320px on any of the eleven views.
Verified by walking every view at 320, 375, 768, 1024 and 1280 and asserting
that `documentElement.scrollWidth` does not exceed the viewport. Wide tables
scroll inside their own container, which is the permitted exception.

**1.4.11 Non-text contrast.** Borders, focus rings and control boundaries clear
3:1.

**1.4.12 Text spacing.** Line height, spacing and letter spacing are set in
relative units and the layout tolerates the user stylesheet override.

## Operable

**2.1.1 Keyboard.** Everything is reachable and operable from the keyboard.
Table scroll containers carry `tabindex="0"` and a `role="region"` label,
because content reachable only by scrolling must also be reachable by keyboard.

**2.1.2 No keyboard trap.** The navigation drawer is the only trapping surface,
and it is a genuine modal: Escape closes it, and focus returns to the control
that opened it.

**2.4.1 Bypass blocks.** A skip link is the first focusable element.

**2.4.3 Focus order.** The closed drawer is marked `inert`, so its eleven
off-screen buttons are not in the tab order. The collapsed filter panel is
`inert` for the same reason.

This one needed care. The stylesheet sets `visibility: hidden` on the closed
drawer, but that arrives through a transition, and a transition does not settle
while a tab is backgrounded. Relying on CSS alone left the buttons focusable.
`inert` applies synchronously and is the actual guarantee.

**2.4.7 Focus visible.** A single 2px ring on `:focus-visible` across
everything focusable. Version 1 styled only `.btn`, leaving links, selects and
inputs with a default the dark theme all but erased.

**2.5.8 Target size (minimum).** All controls are at least 24 by 24 CSS pixels.
Most are 44 by 44, reducing to 42 below 640px and 40 below 400px. Verified by
walking every view and measuring each rendered control.

## Understandable

**3.1.1 Language.** `<html lang="en">`.

**3.2.3 Consistent navigation.** The sidebar order and grouping do not change
between views.

**3.3.1 Error identification.** Validation findings state the rule, the count,
the percentage of rows affected, and up to three spreadsheet row numbers,
adjusted for the header row so the number matches what is on screen in Excel.

**3.3.2 Labels or instructions.** Every control has a visible label or an
associated `visually-hidden` one.

## Robust

**4.1.2 Name, role, value.** `aria-expanded` on the drawer, filter and export
toggles. `aria-current="page"` on the active navigation item. `aria-selected`
on tabs. `aria-disabled` on views that need data, with an explanation.

**4.1.3 Status messages.** Toasts announce through a live region: `polite`
normally, `assertive` for errors. Search results announce their count. The
filter chip list is a live region.

## Patterns implemented in full

**Tabs** on the import page follow the WAI-ARIA authoring practice: roving
tabindex, Left and Right arrows to move, Home and End to jump, `aria-selected`
and `aria-controls` wired to the panels.

**Modal drawer** below 1024px: `role="dialog"`, `aria-modal="true"`, focus trap
on Tab and Shift+Tab, Escape to close, `inert` on the background, focus
restored on close.

**Menu** for export: `aria-haspopup="menu"`, `aria-expanded`, Escape to close
and return focus, click outside to dismiss.

## Preferences honoured

| Preference               | Effect                                                                          |
| ------------------------ | ------------------------------------------------------------------------------- |
| `prefers-reduced-motion` | All animation reduced to 0.01ms, smooth scrolling disabled, chart animation off |
| `prefers-contrast: more` | Muted text is promoted to the secondary ink, borders to the strong border       |
| `prefers-color-scheme`   | Followed until the reader makes an explicit choice                              |

Any behaviour that would otherwise depend on a transition completing has a
timeout fallback, so reduced motion never leaves an element stuck.

## Known gaps

Stated plainly rather than omitted.

- **Not yet tested with a screen reader in anger.** The semantics are correct by
  inspection, but NVDA, JAWS and VoiceOver each behave differently and no
  substitute exists for running them.
- **No automated axe or Lighthouse run in CI.** Planned, see [the roadmap](roadmap.md).
- **Charts are canvas.** The accessible name summarises the leading values, but
  a reader cannot explore a canvas point by point. Every chart is backed by a
  table or an export containing the same figures.
- **No high-contrast Windows theme testing.** Forced colours mode has not been
  verified.

## Reproducing the checks

```bash
npm run check:contrast     # 16 pairings against the WCAG formula
npm run check:classes      # no unstyled elements
```

For reflow and target size, open the application, then in the browser console:

```js
// Walk every view at the current viewport and report any overflow
[
  'import',
  'executive',
  'inventory',
  'warehouse',
  'dispatch',
  'hotels',
  'brandSupplier',
  'stockAging',
  'employees',
  'recommendations',
  'search',
].forEach((page) => {
  GovSpirit.Router.navigate(page);
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) console.warn(page, 'overflows');
});
```
