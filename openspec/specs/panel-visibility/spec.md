# panel-visibility Specification

## Purpose

Lets the user choose which side panels (the review panel on the right and the file list sidebar on the left) are visible at desktop viewport widths, so reading and reviewing reclaim the pane's width on smaller windows. Narrow screens keep their automatic behavior untouched.

## Requirements

### Requirement: Header controls hide and show side panels at desktop widths

At viewport widths of 62em or more, the system SHALL provide a header visibility control for the file list sidebar — the navigation toggle (☰) in the top-left corner, present at all viewport widths (below 62em it opens the navigation drawer, see mobile-navigation) — and a header visibility control for the review panel — a matching corner toggle in the top-right, shown only at viewport widths of 62em or more. Each control SHALL toggle its panel between visible and hidden, SHALL indicate the current state of its panel, and SHALL NOT affect the folder rail, which SHALL remain in the layout at all times. Hiding a panel SHALL remove it from the layout so the content pane re-expands to fill the freed space; showing it SHALL restore it in place. Neither panel SHALL overlap the artifact content while visible.

#### Scenario: Hiding the review panel widens the pane
- **WHEN** the viewport is at least 62em wide and the user activates the review panel's header visibility control while the panel is visible
- **THEN** the review panel is removed from the layout, occupying no space, and the content pane expands to fill the freed width

#### Scenario: Showing the review panel restores it in place
- **WHEN** the viewport is at least 62em wide, the review panel is hidden, and the user activates its header visibility control to show it
- **THEN** the review panel returns as the right-hand layout column beside the content pane, and neither the panel nor the pane overlap

#### Scenario: Sidebar hides and shows the same way
- **WHEN** the viewport is at least 62em wide and the user activates the navigation toggle (☰)
- **THEN** the file list sidebar is hidden (pane expands) or shown (pane narrows) accordingly, and the folder rail remains pinned

#### Scenario: Controls reflect their panel's state
- **WHEN** the viewport is at least 62em wide
- **THEN** both header visibility controls indicate whether their panel is currently visible or hidden

#### Scenario: Controls are absent on narrow screens
- **WHEN** the viewport is narrower than 62em
- **THEN** the review panel's header visibility control is not shown (the panel is auto-hidden below 62em), and the sidebar's header visibility control presents the sidebar inside the navigation drawer (mobile-navigation) rather than collapsing it in place

### Requirement: All review workflows remain available while the panel is hidden

Hiding the review panel at a viewport width of 62em or more SHALL NOT remove, disable, or lose any review workflow. The user SHALL still be able to add range-based highlights and comments and whole-file comments while the panel is hidden, and deleting review items and copying the generated prompt SHALL be possible once the panel is shown again. Review items added while the panel is hidden SHALL appear in the panel when it is shown again, with no items lost.

#### Scenario: Adding comments while hidden still records them
- **WHEN** the review panel is hidden and the user adds a highlight with a comment
- **THEN** the item is recorded and appears in the review panel when the panel is shown again

#### Scenario: Delete and copy work after restore
- **WHEN** the review panel was hidden and is shown again with review items present
- **THEN** the user can delete individual review items and copy the prompt as if the panel had never been hidden

### Requirement: Sidebar stays reachable for navigation while hidden

While the file list sidebar is hidden at a viewport width of 62em or more, the system SHALL keep navigation to any artifact possible through the header content search, and the sidebar SHALL be showable again through its header visibility control. The open artifact's diff/new state SHALL continue to be shown through the pane's own indicators while the sidebar is hidden.

#### Scenario: Search still opens artifacts with the sidebar hidden
- **WHEN** the file list sidebar is hidden and the user searches for text and activates a result
- **THEN** the matching artifact opens in the content pane

#### Scenario: The sidebar can be shown again
- **WHEN** the file list sidebar is hidden and the user activates its header visibility control
- **THEN** the sidebar returns to the layout with its previous selection, group collapse state, and scroll preserved

### Requirement: Panel visibility choice persists

The user's visibility choice for the review panel and the file list sidebar SHALL be saved and restored on subsequent visits, applying across folders. The saved choice SHALL only take effect at viewport widths of 62em or more; below 62em the automatic narrow-screen behavior SHALL always win regardless of the saved choice.

#### Scenario: Hidden panels stay hidden after reload
- **WHEN** the user hides the review panel and the file list sidebar at a viewport width of at least 62em and then reloads the app
- **THEN** both panels load hidden, the header visibility controls reflect that state, and the pane spans the freed width

#### Scenario: Saved choice never changes narrow-screen behavior
- **WHEN** the user has saved a hidden state for a panel and visits the app at a viewport narrower than 62em
- **THEN** the narrow-screen automatic behavior is exactly as without the saved choice (the review panel hidden, the sidebar presented inside the navigation drawer)

### Requirement: Panels start visible until the user hides them

On a first visit — when no visibility choice is saved — the review panel and the file list sidebar SHALL be visible at viewport widths of 62em or more, identical to the pre-existing layout.

#### Scenario: First visit shows the previous layout
- **WHEN** a visitor opens the app at a viewport width of at least 62em with no saved panel visibility choice
- **THEN** the review panel and the file list sidebar are both visible exactly as before this capability existed