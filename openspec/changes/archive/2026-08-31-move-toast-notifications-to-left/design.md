## Context

The toast is a fixed-position element (`components/osv-toast/osv-toast.css`) anchored `right: 16px; bottom: 16px` as a direct child of `<body>`, so `position: fixed` is viewport-relative. Two layout facts shape the placement:

- The folder rail is a full-height left column of `--rail-w: 60px` on viewports ≥62em; below that it collapses to a horizontal strip at the top.
- The review drawer is a reserved right-hand column (`--review-w: 380px`) on ≥62em; the current CSS compensates with `body:has(.review-drawer.open)` shifting the toast to `right: 376px`.

See proposal.md — Why for motivation.

## Goals / Non-Goals

**Goals:**
- Toast notifications anchored in the bottom-left corner at all viewport widths.
- Toast never overlaps the left folder rail on wide screens.
- Remove the now-obsolete review-drawer offset rule.
- Keep toast behavior (one-at-a-time, ~5s auto-dismiss, error variant, slide-in animation) untouched.

**Non-Goals:**
- No changes to toast content, timing, stacking, or the `showToast()` API.
- No changes to layout of any other component.

## Decisions

**1. Anchor with `left` instead of `right`, and clear the rail on wide screens.**
Replace `right: 16px` with `left: 16px` as the base, and add a `≥62em` rule `left: calc(var(--rail-w) + 16px)`. `--rail-w` already exists in `styles/variables.css` and is the canonical rail width, so the offset stays in sync automatically if the rail ever changes size.

*Alternatives considered:* a fixed `left: 76px` — rejected: duplicates the rail width constant and drifts if `--rail-w` changes. Offsetting below the 62em breakpoint — rejected: below 62em the rail is a top strip, so the bottom-left corner is free; `left: 16px` is correct there.

**2. Delete the `body:has(.review-drawer.open)` override.**
Its only purpose was to keep the right-anchored toast clear of the right-side drawer. A left-anchored toast never intersects the drawer, so the rule is dead code.

*Alternatives considered:* keeping it (harmless but misleading, and it would pin the toast away from the left edge it is now supposed to occupy — it must go).

**3. Comments only in the toast JS/CSS header.**
`components/osv-toast/osv-toast.js` and the CSS header comment both say "bottom-right"; update the wording to "bottom-left". No logic changes.

**4. Version bump MINOR.**
The toast's on-screen position is user-visible, so per project policy this is a visible change: bump all three markers (index.html first-line comment, `osv-header` `VERSION`, sw.js `CACHE_VERSION`) in the same commit. Not MAJOR — nothing breaks and no layout overhauls.

## Risks / Trade-offs

- [Toast could overlap the rail if the rail hides/shows dynamically] → Mitigation: the rail is always present per panel-visibility spec, and the offset is driven by the shared `--rail-w` token; if rail presence ever becomes conditional, gate the offset on the same condition.
- [Stale service worker serves the old CSS to returning users] → Mitigation: bump `CACHE_VERSION` in the same commit so the shell re-fetches assets; verify the header badge after deploy.
- [Mobile viewport: toast may cover content at the bottom-left] → Mitigation: unchanged trade-off from today's bottom-right placement; toasts are transient and auto-dismiss in 5s. None of the interactive controls live at the bottom-left edge on narrow screens.

## Migration Plan

Deploy: push to `master` (auto-deploy to GitHub Pages), verify the header badge and the new toast position. Rollback: revert the CSS change and version bump; the previous shell is restored on next deploy.

## Open Questions

None.