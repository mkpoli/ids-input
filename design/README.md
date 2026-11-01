# IDS UI

The design system behind the IDS Workshop and the pages beside it. It is plain CSS plus native
HTML controls, so a Svelte site, an Astro page or a static form can use the same palette and states
without a component runtime.

```
design/
  tokens.css   colour, type, space, shape, motion and layer tokens
  base.css     reset, document face, one focus ring, scrollbars, selection
  controls.css buttons, fields, checkbox, radio, switch, segmented, range, colour
  index.css    the three layers, in order
```

The reference page is `demo/design.html` (built to `/design.html`): every token and control in both
schemes, with contrast measured from the browser.

## Using it

Import the layer once, before the site's own CSS:

```css
@import 'ids-input/design.css';
```

In this repository:

```css
@import '../design/index.css';
```

The palette follows the reader's system scheme by default. A site that offers a switch sets
`data-theme="light"` or `data-theme="dark"` on the root:

```html
<html data-theme="dark">
```

Every token is a `light-dark()` pair and `color-scheme` chooses the side. A site can rebrand by
overriding tokens on the root; leave the control classes and states alone:

```css
:root {
  --ui-color-accent: light-dark(#7c2d2d, #e0a0a0);
  --ui-color-accent-hover: light-dark(#5f2020, #f0b8b8);
  --ui-font-sans: 'Inter', system-ui, sans-serif;
}
```

Use the system's classes rather than writing a local button or input style:

```html
<button class="ui-button" data-variant="primary" data-size="lg">Save</button>
<input class="ui-input" type="text" aria-describedby="hint" />
<label class="ui-check-row">
  <input class="ui-checkbox" type="checkbox" checked />
  <span>Include empty slots</span>
</label>
```

Variants are data attributes (`data-variant="primary" | "danger" | "quiet"`, `data-size="sm" | "lg" | "icon"`),
not extra classes. A toggle button uses `aria-pressed="true"`; the system styles that state. Do not
use a disabled class: use the `disabled` attribute.

## Tokens

`tokens.css` is the source of values; this table is the contract.

### Colour

| Token | Role |
| --- | --- |
| `--ui-color-canvas` | The page behind the content |
| `--ui-color-surface` | Panels, dialogs, controls |
| `--ui-color-surface-sunken` | Inset areas, segmented track, read-only fields |
| `--ui-color-surface-hover` / `--ui-color-surface-active` | Hover and pressed fills |
| `--ui-color-ink` | Primary text |
| `--ui-color-ink-soft` | Secondary text (library components) |
| `--ui-color-ink-muted` | Labels, hints, metadata |
| `--ui-color-border` / `--ui-color-border-strong` | Decorative lines and card edges |
| `--ui-color-control-border` / `--ui-color-control-border-hover` | The 3:1 boundary of an input or an unchecked box |
| `--ui-color-accent` / `--ui-color-accent-hover` / `--ui-color-accent-active` | Selection, primary buttons, checked fills |
| `--ui-color-accent-soft` | Selected rows, pressed buttons |
| `--ui-color-on-accent` | Text and marks on an accent fill |
| `--ui-color-focus` | The focus ring; currently the accent |
| `--ui-color-danger` / `--ui-color-danger-soft` / `--ui-color-on-danger` | Errors and destructive actions |
| `--ui-color-overlay` | Dialog backdrop |
| `--ui-color-toast-surface` / `--ui-color-toast-ink` | Toasts |
| `--ui-color-selection` / `--ui-color-selection-ink` | Text selection |
| `--ui-color-scrollbar` / `--ui-color-scrollbar-hover` | Scrollbars |
| `--ui-color-switch-thumb` | The off-state switch thumb |

`--ui-shadow-1` is a resting shadow; `--ui-shadow-2` is for popovers and dialogs.

### Type, space, shape and motion

| Token | Value |
| --- | --- |
| `--ui-text-2xs` … `--ui-text-2xl` | 11, 12, 13, 14, 16, 20, 28 px |
| `--ui-leading-tight` / `--ui-leading-normal` | 1.25 / 1.5 |
| `--ui-weight-medium` / `--ui-weight-semibold` / `--ui-weight-bold` | 500 / 600 / 650 |
| `--ui-space-3xs` … `--ui-space-4xl` | 2, 4, 6, 8, 10, 12, 16, 20, 24, 32 px |
| `--ui-radius-xs` … `--ui-radius-3xl`, `--ui-radius-pill` | 4, 6, 8, 10, 12, 14, 16, 999 px |
| `--ui-control-h-sm` / `-md` / `-lg` | 28, 32, 36 px |
| `--ui-checkbox-size` / `--ui-radio-size` | 18 px |
| `--ui-switch-width` / `--ui-switch-height` / `--ui-switch-thumb` | 40 / 24 / 18 px |
| `--ui-target-min` | 24 px |
| `--ui-ring-width` / `--ui-ring-offset` | 2 px / 2 px |
| `--ui-duration-fast` / `--ui-duration` | 120 ms / 160 ms |
| `--ui-z-chrome` … `--ui-z-toast` | 30, 40, 50, 60, 70 |

## Which control

| Need | Control | Why |
| --- | --- | --- |
| One option among several, submitted or saved together | Checkbox | Independent state; Space toggles |
| An immediate on/off setting | Switch | `role="switch"`, the change applies at once |
| One choice out of a few visible options | Radio group | Arrow keys move the choice |
| One choice out of two to four compact options | Segmented control | Native radios under the faces; arrow keys and one Tab stop |
| One colour from a small set | Swatch group | Tiles over native radios; the selected tile keeps an accent ring |
| One choice out of a longer list | Native select | The browser's list, search and typeahead |
| A free value | Text field or textarea | Native validation, autofill and input methods |
| A number in a range | Range | Arrow keys, Home and End come from the browser |
| A colour | Colour input | The platform picker |

A card is a container, not a control: `.ui-card` for the resting surface, `data-variant="sunken"`
for a quiet nested area, `data-variant="flat"` without a shadow, and `data-interactive` when the
whole card is the target. Cards take the standard padding and gap; add layout classes inside them.

A checkbox, radio and switch are native `<input>` elements. The system removes the browser's paint
with `appearance: none` and draws the box, dot or track; it does not replace the element with a div
and ARIA. Keep it that way: form submission, autofill, screen readers, forced-colours mode and the
keyboard all come with the element.

## States

| State | How it is expressed |
| --- | --- |
| Default | Surface fill, `--ui-color-control-border` boundary |
| Hover | Border darkens; surface shifts |
| Pressed | `--ui-color-surface-active`; toggle buttons use `aria-pressed="true"` |
| Checked | Accent fill, `--ui-color-on-accent` mark; the shape changes as well as the colour |
| Indeterminate | Native `indeterminate`; a horizontal mark |
| Focus | One 2 px ring, 2 px offset, `--ui-color-focus` |
| Disabled | `disabled` plus 45% opacity; the label stays readable |
| Invalid | `[aria-invalid="true"]` or `:user-invalid`; danger border, soft fill, error sentence |
| Read-only | Sunken fill; still focusable and selectable |

## Accessibility

The system is built and checked against these rules:

- Every control has a visible label, or an `aria-label` for an icon-only button.
- Tab reaches every control once. Space toggles a checkbox or switch; arrows move within a radio
  group, segmented control or select; Escape closes a dialog or menu.
- The focus ring stays visible on every surface and in both schemes (3:1 or better).
- State is never colour alone: the check mark, thumb position, dot, outline or a word carries it too.
- Text is at least 4.5:1 against its surface; boundaries that identify a control are at least 3:1.
- The control and its label together meet the 24 px target, with room around it.
- Hints describe a control through `aria-describedby`; they never become part of its name.
- `prefers-reduced-motion: reduce` collapses the controls' CSS transitions; forced-colours mode keeps the shapes.

`demo/check-design.js` checks these in Chromium: accessible names, keyboard operation, focus rings,
contrast, target sizes, the theme switch, reduced motion and forced colours. Run it against a dev
server:

```sh
IDS_URL=http://localhost:5178 CHROMIUM_PATH=/path/to/chrome bun demo/check-design.js
```

The browser check needs `playwright-core`, which this repository does not install for every clone.

## Libraries

Forms use native elements and no UI dependency. For this codebase that is the accessible choice:
a headless checkbox would still render a hidden input and a styled span, and the browser already
provides the checkbox.

[Bits UI](https://www.bits-ui.com/docs/getting-started) (2.20) and Melt UI (4.3) were considered for
the overlays. Both are solid Svelte 5 headless libraries. [Radix UI](https://www.radix-ui.com/primitives)
is React-only, so it does not fit the Svelte components here. The workshop's dialog is a native
`<dialog>` with an anchored popover variant and a mobile drawer, and its menus already implement
roving focus, so replacing them would be a separate change with its own review. If a menu grows
submenus, typeahead or a focus trap, Bits UI's Menu is the first candidate.

Tailwind was not adopted. The published Svelte components carry scoped CSS and the design system is
published as CSS custom properties and classes; requiring consumers to run Tailwind would add a
build step to every host page. The tokens work beside Tailwind if a site already uses it.

## Reusing it across sites

- Import `ids-input/design.css` and override tokens for the site's brand. Use `.ui-card` for
  panels rather than restating the border, radius, surface and shadow.
- Keep the `ui-*` class names and the states; site CSS should add layout, not repaint controls.
- For Svelte, `demo/ui/controls/` has the reference wiring for a checkbox, switch, radio group,
  segmented control, swatch group, text field and select. They have no dependency beyond Svelte and the global
  classes, so they can be copied into another Svelte app.
- The workshop's `--ids-*` component tokens are mapped onto `--ui-*` in `demo/app.css`, so the
  library components and the application share one palette. `--ids-control-border` is the 3:1
  boundary for a text field or a select; set it if a host theme replaces `--ids-line`.

## References

- [WCAG 2.2 — Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WCAG 2.2 — Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [ARIA Authoring Practices — Switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)
- [Bits UI — Getting Started](https://www.bits-ui.com/docs/getting-started)
