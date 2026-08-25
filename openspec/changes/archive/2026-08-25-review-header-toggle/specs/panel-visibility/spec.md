## REMOVED Requirements

### Requirement: Review panel provides its own close control

**Reason**: Replaced by a header visibility control in v3.11.0, mirroring the sidebar's corner toggle. With a header toggle that opens and closes the panel, an in-panel close control is redundant.

**Migration**: Use the top-right header toggle to hide and show the review panel.

### Requirement: Hidden review panel shows a restore control with its count

**Reason**: Panel visibility is now fully symmetric with the sidebar — the header toggle is the sole affordance, so the floating restore pill and its count are removed. The item count remains available on the Copy prompt button's label while the panel is shown.

**Migration**: Use the top-right header toggle to show the review panel; read the item count from the panel's Copy prompt label.

## MODIFIED Requirements

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

### Requirement: Panel visibility choice persists

The user's visibility choice for the review panel and the file list sidebar SHALL be saved and restored on subsequent visits, applying across folders. The saved choice SHALL only take effect at viewport widths of 62em or more; below 62em the automatic narrow-screen behavior SHALL always win regardless of the saved choice.

#### Scenario: Hidden panels stay hidden after reload
- **WHEN** the user hides the review panel and the file list sidebar at a viewport width of at least 62em and then reloads the app
- **THEN** both panels load hidden, the header visibility controls reflect that state, and the pane spans the freed width

#### Scenario: Saved choice never changes narrow-screen behavior
- **WHEN** the user has saved a hidden state for a panel and visits the app at a viewport narrower than 62em
- **THEN** the narrow-screen automatic behavior is exactly as without the saved choice (the review panel hidden, the sidebar presented inside the navigation drawer)