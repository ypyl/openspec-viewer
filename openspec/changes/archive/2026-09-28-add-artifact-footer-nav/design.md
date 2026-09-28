## Context

See `proposal.md` for motivation and `specs/artifact-navigation/spec.md` for the required behavior.

Current state that shapes the approach:

- `osv-pane` renders into light DOM. `main` is the only scroll container in the pane and holds the pane bar, the change heading, the artifact tab bar, the guidance strip, and `.pane-body`.
- `openChange` builds the change view in a single template write and then calls `activateTab`, which sets the active tab, renders the body via `viewFor`, applies annotation highlights, resets `main.scrollTop` to 0, and acknowledges the artifact.
- Rendered artifact HTML is cached in `paneCache` by `paneHtml`. `app/render.js` produces that HTML and must stay free of navigation concerns.
- Tab order and labels already live in the `currentTabs` signal, built by `openChange`.
- `main` already has one delegated click listener that branches on `.guide-toggle` and `.diff-toggle`.

## Goals / Non-Goals

**Goals:**

- Add the footer row with the smallest possible change, reusing the existing tab state and tab-switching path.
- Keep cached artifact HTML and the artifact renderers untouched.
- Make footer navigation and tab selection indistinguishable in behavior.

**Non-Goals:**

- A sticky or pinned navigation surface. The problem is the handoff at the end of a document, not reachability while reading.
- Continuing from a change's last artifact into the next change. Deferred; it needs an ordering source the pane does not have today.
- Keyboard shortcuts for navigation.
- Any change to how artifacts are read, diffed, or acknowledged.

## Decisions

**In-flow row at the end of the artifact content, not a pinned bar and not sticky tabs.**
A pinned bar or sticky tab bar solves mid-document reachability and permanently consumes vertical space. The reported friction is finishing one document and starting the next, which the end of the document is the natural place to answer. Alternatives considered: sticky tab bar (rejected, wrong problem), pinned bottom bar (rejected, permanent space cost), duplicating the tab bar at the foot (rejected, the row only needs the two adjacent destinations).

**The footer is a sibling of `.pane-body`, rendered once by `openChange`.**
`.pane-body`'s content comes from `paneCache` and the renderers in `app/render.js`. Putting navigation inside it would enter the cache and force invalidation, and would leak navigation concerns into the render layer. A sibling element inside the scroll container keeps cached content pure and keeps the footer in the document flow, so it lands after the artifact content without any positioning.

**Reuse `currentTabs` and `activateTab(i)` instead of adding navigation state.**
`activateTab` already switches the active tab, renders the body, applies highlights, scrolls to the top, and acknowledges the artifact under the existing change-monitoring rules. A footer that calls it cannot drift from the tab bar in order, labels, or read state. No new signal, no new cache.

**Clicks go through the existing delegated listener on `main`.**
The listener already handles `.guide-toggle` and `.diff-toggle`. One more branch keeps the handler count flat and survives the footer being replaced by a re-render, since the listener lives on the container rather than on the buttons.

**Refresh the footer in place from `activateTab`; never re-create it.**
Only the labels and the two disabled states change between tabs. This follows the project's patch-in-place convention and keeps selection, focus, and scroll behavior stable. Live tab-badge refreshes must leave the footer alone.

**Disabled at the ends, and the whole row is hidden when the change has fewer than two artifacts.**
A disabled control still communicates which direction exists; a row of two disabled controls is noise. The hidden case covers single-artifact changes where there is nothing to navigate.

**Standalone artifacts need no new branch.**
`openFile` renders no tab bar, so it renders no footer either. The condition for showing the footer is the same as the condition for having tabs.

## Risks / Trade-offs

- **A short artifact puts the row high in the viewport, which can read as clutter.** → The position is identical for every artifact, so it stays predictable, and a top border separates it from content.
- **A re-render replaces the footer, so any per-element state would be lost.** → The footer holds no state; labels and disabled states are recomputed from `currentTabs` and the active artifact each time.
- **The footer could drift from the tab bar if it derived its own order.** → It derives everything from `currentTabs` and defers switching to `activateTab`, so there is a single source of truth.
- **Long tab labels on narrow screens could crowd the row.** → Let the row wrap and keep the controls compact.

## Migration Plan

Not applicable: no data, schema, or stored-state change. The version markers move to **v3.18.0** in the same commit (`index.html` first-line comment, header badge, `sw.js` `CACHE_VERSION`), which also rotates the service worker cache so returning users receive the new shell.
