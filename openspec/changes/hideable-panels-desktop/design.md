## Context

See proposal.md — Why. The app's layout at ≥62em is four pinned flex columns in `.layout` (folder rail 60px, file list 280–340px, pane flex:1 capped at 980px, review 380px); below 62em the rail and sidebar move into the `osv-nav-drawer` (mobile-friendly-hideable-panels) and the review panel is hidden outright (hide-review-panel-mobile). There is no user-initiated way to hide a panel at ≥62em today — the review drawer's `open` class is static and only mobile media queries hide panels. The current `review` spec even forbids a header review control; this change's delta amends that.

Key existing patterns this builds on:
- **Signals + effects** (tiny-signals) with document-level CustomEvents for cross-component pokes; components patch their own DOM in place.
- **Persistence precedents**: the theme persists via `localStorage` (`osviewer.theme`); `navDrawerOpen` is session-only; highlights persist per folder.
- **Breakpoint-scoped CSS**: every component hides/reshapes itself at 62em via `@media`, and `osv-nav-drawer` is `display: contents` at ≥62em so its children stay `.layout` flex items.
- The review item count is already computed once (osv-review's `buildReviewHtml` items) for the Copy prompt label.

## Goals / Non-Goals

**Goals:**
- User-controlled hide/show of the review panel and the file list at ≥62em, via two header toggles; review also restorable via a floating pill with the item count.
- The review drawer is never dismantled while hidden — the same DOM nodes stay in place so add/delete/copy keep working and scroll/selection survive.
- Panel choice persists across reloads (global preference, like theme), but with zero effect below 62em.
- Pane reflows to full width through pure CSS; no layout JS, no `:has()`, no new dependencies, no new component files.

**Non-Goals:**
- No rail toggle (60px toolbar-like column; near-zero payoff).
- No review pill on mobile, no toggles on mobile — narrow screens keep their unconditional auto behavior.
- No animated/collapsed-width panel (instant reflow is the chosen UX; the idle "smooth reflow" requirement is amended in the review delta).
- No drag-resize, no overlay slide-in, no per-folder persistence of panel state.

## Decisions

### 1. Two signals, one persisted JSON blob, hydrated at boot

`app/state.js` gains `reviewHidden = signal(false)` and `sidebarHidden = signal(false)`, plus a boot-time hydration that reads `localStorage['osviewer.panels']` (`{ review, sidebar }`) and an effect that writes it back on change — the same shape as the theme persistence. Global (not per folder): panel visibility is a window/workflow preference, unlike group-collapse state which stays per folder. Why not session-only like `navDrawerOpen`? The drawer is transient one-shot chrome; a panel preference is a setup-style choice the user makes once for a small laptop — theme is the closer precedent.

### 2. Body classes + media-scoped CSS instead of `[hidden]`

A single effect applies `body.hide-review` / `body.hide-sidebar` classes; CSS rules inside `@media (min-width: 62em)` hide `osv-review` / `osv-file-list` (`display: none`). The pane (`flex: 1`) re-expands automatically — no loop, no recomputation. `[hidden]` was rejected because the elements carry `display: flex`, which beats the UA's `[hidden]` rule without `!important`; a body class keeps the cascade explicit and follows the codebase's existing breakpoint-scoped style. The media query also makes the persistence *self-scoping*: a saved hidden state has no effect below 62em, so the mobile auto behavior stays unconditional with no extra guard code.

### 3. The restore pill lives inside osv-review

`osv-review` renders both faces: the existing `.review-drawer` (visible) and, when `reviewHidden`, a floating pill button. The pill's count is the same `items.length` already computed for the Copy prompt label — one counting path, so the pill and the drawer can never disagree. Clicking the pill sets `reviewHidden = false`; the drawer element was never removed from the DOM (only hidden by CSS), so its `_listEl` handlers, scroll, and checklist survive. Placing the pill in the drawer component (rather than the header) keeps the minimized-state UI with the thing it restores, mirroring how the drawer already owns its own list/actions.

### 4. Header toggles in the existing `side` cluster

Two compact icon buttons (aria-pressed, title tooltips) join the header's right `side` column next to the stats — col3 is a 380px grid cell at ≥62em, so there is room. They follow the `nav-toggle` pattern exactly: click flips the signal, an `effect` syncs `aria-pressed`, and CSS `display: none` below 62em. Placement in `side` (not the brand row) keeps the title area clean and groups layout controls with the other window-level chrome.

### 5. Sidebar hidden ⇒ search-driven navigation (accepted trade-off)

While `osv-file-list` is hidden, the header content search remains the navigation surface (it already deep-links into any artifact) and the pane-bar diff badge still reports the open file's state. No pill for the sidebar: unlike the review panel it carries no actions and no count worth surfacing — a pill would be noise. The sidebar keeps its DOM (selection/scroll/collapse survive hide/show), matching the mobile-drawer design's "never re-parent or rebuild" rationale.

### 6. Instant reflow, no width animation

Hiding is `display: none` — the pane snaps to full width, no transition. The prior "smooth reflow" requirement (animate width) is dormant: the app has no review close control today, so the requirement was never exercised; the delta spec amends it to describe the actual UX (in-place reflow, animation optional). Adding an animated width-collapse would mean a width state machine and fights `display: none`'s simplicity for zero functional gain.

## Risks / Trade-offs

- [A hidden review panel (or sidebar) restores differently than a user expects after a reload] → The pill + header toggle are the two restore paths; first-visit default is visible; both hidden states persist honestly so reload is consistent with what the user left.
- [Sidebar hidden hides unread/live-dot signal and group counters] → Accepted: pane-bar diff badge still marks the open file; search covers navigation; the sidebar toggle returns the full picture in one click. Spec'd in panel-visibility.
- [Persisted state interacts with folder switches] → It is global by design; switching folders never resets or conflicts with panel state (only mobile breakpoints can mask it, and only below 62em).
- [New header buttons crowd col3 on 992–1200px widths] → Col3 is 380px; two 30px icon buttons plus stats fit; tooltips carry the labels; the header is `flex-wrap` on narrow widths below 62em where the buttons are hidden anyway.
- [Existing e2e runs at the default 1280×720 desktop viewport with no saved state] → Default remains panels-visible, so existing suites are unaffected; the new e2e clears `osviewer.panels` and drives toggles explicitly.

## Migration Plan

Deploy is the standard push-to-master → GitHub Pages flow; the v3.8.0 version bump rides the same commit (index.html first-line comment, header badge `VERSION`, sw.js `CACHE_VERSION`). Rollback is a git revert of that commit. No data migration: one new localStorage key, absent for existing users ⇒ default (panels visible) until first toggle; `osviewer.panels` is inert below 62em and ignored by the app if malformed (hydration wraps parsing in try/catch like `readHighlights`).

## Open Questions

None — persistence scope (global vs per-folder), pill count semantics (all items, mirroring the drawer), and the instant-reflow UX were resolved here and are encoded in the specs.