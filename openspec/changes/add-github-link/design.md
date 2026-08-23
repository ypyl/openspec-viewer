## Context

See proposal.md - Why. The folder rail (`components/osv-folder-rail`) is the app's left icon column: static markup in `connectedCallback` holds the add-folder button (＋) and a hidden file picker; below it a reactive list of avatar buttons re-renders from tiny-signals on folder changes. The rail's CSS already defines the add button's look (40×40 rounded square, dashed border, transparent background, muted color with a hover tint).

The change adds one static link to that column. It is deliberately not part of the reactive avatar list, so folder changes never touch it.

## Goals / Non-Goals

**Goals:**
- A GitHub-mark link at the bottom of the folder rail that opens `https://github.com/ypyl/openspec-viewer` in a new tab.
- Visually identical to the add button except for the icon, including the hover state, in both rail layouts (full-height column ≥ 992px, horizontal strip below).
- Zero new dependencies, zero network at runtime, no impact on serving/offline.

**Non-Goals:**
- No header/other placement, no star/fork counts, no repo metadata fetching, no configurable URL.
- No changes to monitoring, file list, search, or review behavior.

## Decisions

**1. Static anchor in the rail's initial markup, not in the reactive list.**
The link is rendered once alongside the add button in `connectedCallback` (an `<a>` after `.rail-list`), never re-created by the avatar `computed`/`effect`. Rationale: it is permanent chrome; mounting it in the reactive list would re-create the anchor on every folder change and risk the patch-in-place scroll/focus guarantees for no benefit. An anchor needs no click listener — `href` + `target` are native.

**2. Same shape via shared CSS, icon via inlined SVG.**
The `.rail-add` rules are shared by grouping the selector (`osv-folder-rail .rail-add, osv-folder-rail .rail-github { … }`), which guarantees the "same as the plus button" requirement by construction; only the hover color rule and the inner content differ. The GitHub mark is the canonical `mark-github` path from primer/octicons (BSD-licensed), inlined as an SVG with `fill: currentColor` and sized ~20px so it follows the button's muted color → brighter on hover exactly like the ＋ glyph. `margin-top: auto` on the anchor pins it to the bottom of the rail column regardless of how many avatars exist.

**Alternatives considered:** a `<button>` with click handler — worse (needs JS for what a link does natively, loses middle-click semantics); an `<img src="icons/...">` — adds a file and a cached asset for one icon, and can't inherit `currentColor`; copy the ＋ button's look with new bespoke CSS — duplicates rules and lets the two drift apart.

**3. New-tab semantics and label.**
`target="_blank" rel="noopener"`, `title` + `aria-label` = "OpenSpec Viewer on GitHub" (matches the parenthetical in the user's request and covers the accessibility requirement).

**4. New `app-chrome` capability.**
The delta spec lives under `specs/app-chrome/spec.md`; `app-delivery`, `project-switcher`, etc. are untouched (see proposal.md - Capabilities).

## Risks / Trade-offs

- [Inline SVG repeats an icon path in HTML where the app otherwise has no inline SVGs] → It is a single, static, official path; no icon system exists to reuse, and a vendored asset file is heavier than the ~800-byte path. If the app later grows icon needs, extract to a shared icon module.
- [Narrow viewport: "left bottom corner" collapses to "end of the horizontal strip"] → Accepted; the strip is the entire rail on narrow screens, so its right end is the closest faithful reading. Spec already covers it ("remains clickable").
- [Version bump mis-sync (3 markers)] → All three markers are bumped in the same commit, per the version policy; the tasks keep them in one group.

## Migration Plan

Single commit, no data or serving changes. Rollback is a revert of that commit, which also reverts the version bump so the markers stay consistent.