## Context

The app is a vanilla SPA (no build step) with a hand-rolled layout: `.layout` (flex column below 62em, flex row at ≥62em) holds `osv-folder-rail`, `osv-file-list`, `osv-pane`, `osv-review`. Below 62em the rail collapses to a horizontal avatar strip and the sidebar gets `max-height: 42vh`, but both stay on screen and squeeze the pane. Components patch their own subtrees in place (tiny-signals `computed` + `effect`), list/rail renders already preserve scrollTop, and everything is keyed to the existing 62em (md) breakpoint. The review panel's narrow-screen behavior (full-width section below the content) is a separate concern that this change keeps untouched. Motivation: see proposal.md — Why.

## Goals / Non-Goals

**Goals:**
- Hide the folder rail and artifact list behind a left slide-over drawer below 62em; full pane width while closed.
- Open via a header toggle (mobile only); close via toggle, Escape, backdrop click, close button, or picking an item.
- Zero visual/behavioral change at ≥62em; panels stay exactly as today.
- Preserve sidebar selection, scroll, collapse state, focus, and open tabs across open/close cycles (DOM nodes never rebuilt or re-parented after startup).

**Non-Goals:**
- No full modal focus trap, swipe-to-close gestures, or drag-resizable drawer.
- No change to the review panel's narrow-screen behavior (v2.4.0 treatment stays).
- No new dependencies, no persistence changes, no desktop-layout changes.
- No `screenshot.png` re-shoot (desktop visuals unchanged); no serving/install changes (app-delivery untouched).

## Decisions

### 1. One dedicated `osv-nav-drawer` component owns the panels

`index.html` changes once: the two panels move inside a new `<osv-nav-drawer>` element within `.layout` (direct children as today, just wrapped). The drawer's `connectedCallback` wraps its children in a `.nav-panel` shell and adds the backdrop and close button. Modules are deferred, so the drawer upgrades before the wrapped children's `connectedCallback` runs; the panels initialize **inside** the panel exactly once and never move again — selection, scroll, focus, and open tabs survive by construction.
- *Alternative considered:* re-parenting the panels into the drawer on every breakpoint change (matchMedia + move). Rejected: it reorders DOM at runtime, risks `connectedCallback` re-entry, and violates "patch in place".
- *Alternative considered:* a plain `<div class="nav-drawer">` + logic in `index.js`. Rejected: `index.js` is bootstrap; UI behavior belongs in a `osv-` component per project convention (and register/import/SW wiring is required either way).

### 2. Desktop uses `display: contents`; mobile uses a fixed slide-over

At ≥62em, `osv-nav-drawer { display: contents }` makes the rail and sidebar participate in `.layout` as flex items exactly as they do today (same order: rail, sidebar, pane, review; same borders/widths), so the desktop layout is literally unchanged. Below 62em the drawer becomes a `position: fixed` full-viewport layer: a translucent `.nav-backdrop` + a `.nav-panel` (`width: min(86vw, 360px)`) that translates off-canvas when closed and slides in when `.open`. `visibility: hidden` while closed removes the panels from layout **and** from the tab order.
- *Alternative considered:* toggling `display: none`/`flex` on panels per breakpoint. Rejected: it would drop the old mobile "stacked sections" layout the panels currently have and doesn't give a drawer at all.
- The rail keeps its existing <62em horizontal-strip CSS inside the panel (top strip, scrollable avatars); the sidebar fills the remaining panel height (`max-height: none`), keeping its desktop-ish list behavior in a drawer context.

### 3. A single `navDrawerOpen` signal drives everything

`app/state.js` gains `navDrawerOpen = signal(false)` (no persistence; always starts closed). The header toggle flips it; `activateFolder()` in `app/store.js` sets it to `false` on every folder activation — which covers rail clicks, the folder picker, same-folder-reswitch, close-folder "next active", and reload-restore with a single line, so choosing a folder always dismisses the drawer. The drawer component reacts to the signal via `effect`: toggles `.open`/body scroll lock, syncs `aria-expanded`-style state, and swaps the toggle's visual state. Existing document events `osv:select-rel` and `osv:select-change` (dispatched by `osv-file-list` when a file/change is picked) close the drawer the same way, so artifact picks dismiss it without touching the panel components.
- *Alternative considered:* a separate `osv:select-folder` event dispatched by the rail. Rejected: folding the close into `activateFolder` is less code and covers programmatic activations too; the rail stays untouched.

### 4. Escape, backdrop, and close button handled by the drawer component

The drawer listens for `Escape` (while open), backdrop clicks, and its close button; each sets `navDrawerOpen.value = false`. On Escape-close, focus returns to the header toggle (single `.nav-toggle` in the document). On open, focus moves to the close button (deliberately not the search input — auto-focusing an input pops the on-screen keyboard on phones).
- *Alternative considered:* `role="dialog"` + `aria-modal` full focus trap. Rejected for now (non-goal): backdrop + Escape + focus return cover the common flows; a full trap adds inert-handling across sibling components for marginal benefit in a desktop-first tool.

### 5. Header toggle

`osv-header` gains a hamburger `.nav-toggle` button (☰) before the title, `aria-expanded` and `aria-label` kept in sync with the signal via the existing effect pattern, hidden by CSS at ≥62em. The header's ≥62em grid math is untouched because the toggle is invisible there.

### 6. Wiring per repo conventions

New files follow the existing rules: register `./components/osv-nav-drawer/osv-nav-drawer.js` in `index.js`, `@import` its CSS in `index.css`, and add both to `sw.js` SHELL. Version bump to **v3.6.0** (MINOR — user-visible feature) in the same commit across `index.html` first-line comment, `osv-header.js` `VERSION`, and `sw.js` `CACHE_VERSION`.

## Risks / Trade-offs

- [Header search centering at ≥62em depends on `.layout`'s flex children staying rail/sidebar/pane/review; `display: contents` could subtly alter how the flex sizes them] → Run the existing e2e suite at the default desktop viewport (1280×720 ≥62em) and eyeball 1440×900; the flex order and widths are unchanged, so order/widths are expected to match.
- [Wrapping children in `connectedCallback` races with child upgrade if scripts ever stop being deferred] → Modules are deferred by spec; guard with the `_init` pattern used by every component; the wrap happens once, before the children's own upgrade callbacks.
- [`visibility: hidden` when closed also removes the panels from the tab order] → Intended for mobile a11y (nothing behind the drawer is tab-reachable while closed); the toggle is a standard button and remains reachable.
- [No full focus trap: background remains tabbable while the drawer is open] → Backdrop covers pointer input; Escape returns focus to the toggle; a full trap is a documented non-goal.
- [Body scroll lock while open could shift the backdrop layout on scrollbar-gutter browsers] → Cosmetic and momentary; `overflow: hidden` is applied only while the drawer is open on narrow screens.
- [Existing e2e tests click sidebar items directly; at a narrow viewport they would fail] → They run at playwright's default 1280×720 (desktop layout, unchanged); the new drawer e2e sets its own narrow viewport and drives through the drawer.

## Migration Plan

Deploy is the standard push-to-master → GitHub Pages flow; the version bump rides the same commit. Rollback is a git revert of that commit. No data migration: the change adds one in-memory signal and no persistence writes, so `app-delivery` is untouched and existing users see the new drawer on next load (SW cache bumps via `CACHE_VERSION`).

## Open Questions

None — the Deferred Greenfield option (persisting drawer state) is explicitly not needed; the drawer always starts closed and state preservation is guaranteed by never moving panel DOM.