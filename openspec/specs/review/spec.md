## Purpose

Lets the user collect highlighted text and comments across artifacts into a review panel, and fold them into a single LLM fix prompt. The review panel is a right-hand column of the application layout that the content pane makes room for, so the artifact under review stays visible while the panel is open.

## Requirements

### Requirement: Review panel is a layout column, not an overlay

The system SHALL render the review panel as a right-hand column that is part of the application layout rather than a fixed overlay on top of the content. When the panel is open, the content pane SHALL shrink to make room for the panel; when the panel is closed, the panel SHALL collapse to zero width and the content pane SHALL re-expand to fill the freed space. The panel SHALL NOT cover, hide, or overlap the artifact content at any point while it is open.

#### Scenario: Opening the panel shrinks the content pane
- **WHEN** the user opens the review panel with an artifact visible in the content pane
- **THEN** the content pane narrows to make room for the panel and the artifact remains fully visible beside it, without any part of the artifact being covered by the panel

#### Scenario: Closing the panel restores the content
- **WHEN** the user closes the review panel
- **THEN** the panel collapses to zero width and the content pane expands to fill the released space

#### Scenario: Panel never overlaps the artifact
- **WHEN** the panel is open
- **THEN** no portion of the rendered artifact is hidden behind the panel; the pane and the panel are side by side within the layout

### Requirement: Panel open/close shows a smooth reflow

The system SHALL animate the panel's width so that opening and closing the panel transitions smoothly, reflowing the content pane in place rather than snapping or sliding a full-height box over it. While the panel is open, the user SHALL remain able to scroll and interact with the content pane normally.

#### Scenario: Opening animates a reflow
- **WHEN** the user opens the review panel
- **THEN** the panel width and the content pane's width transition smoothly over a short duration, with no abrupt layout jump

#### Scenario: Interaction during open
- **WHEN** the review panel is open
- **THEN** the content pane remains scrollable and interactive alongside the panel

### Requirement: Usable on narrow screens

The system SHALL keep the content pane usable at viewport widths too narrow for a three-column layout (file list, content, review). At such widths, the review panel SHALL fall back to an acceptable behavior that does not permanently squeeze the artifact below a usable size; when closed at narrow widths, the content pane SHALL return to its full width.

#### Scenario: Panel falls back on narrow screens
- **WHEN** the viewport is too narrow for the file list, content, and review panel to sit side by side
- **THEN** the review panel opens without squeezing the content pane into an unusable width, or temporarily overlays it in a way that restores full width when closed

### Requirement: Existing review behavior preserved

The system SHALL preserve the review panel's existing behaviors and integrations:
the header review button and its comment-count badge reflect the open state and
comment count; the panel opens on its own when the user makes the first highlight;
and clicking a review item reveals the matching text's location in the artifact.
The panel SHALL keep a single **Copy prompt** action that is disabled until at
least one highlight has a comment. The panel SHALL remain reachable via the same
open/toggle triggers regardless of whether the layout treatment or the narrow-
screen fallback is active.

#### Scenario: First highlight opens the panel
- **WHEN** the user makes their first highlight without the panel already open
- **THEN** the panel opens (in whichever form matches the current viewport) and collects the new highlight

#### Scenario: Review items still reveal the comment location
- **WHEN** the user clicks a review item
- **THEN** the artifact opens (if needed) and scrolls to the text the comment refers to

#### Scenario: Actions reflect comment presence
- **WHEN** the panel holds no comments
- **THEN** the Copy prompt action is disabled

#### Scenario: Header button reflects open state
- **WHEN** the panel is open
- **THEN** the header review button shows its active state and clicking it closes the panel; clicking it again reopens it

### Requirement: Comment popup stays within the viewport

The system SHALL position the comment popup (the bubble shown when the user
selects text to add a highlight or comment) so that the entire popup is within
the visible viewport when it is first shown. The popup SHALL prefer to open just
below the selected text, but SHALL open above the selection when there is not
enough space below the anchor to fit the whole popup, and SHALL clamp within the
viewport horizontally and vertically so no part of it is off-screen. The popup
SHALL close when the user scrolls the content pane rather than remaining open in
a re-anchored or off-screen position.

#### Scenario: Popup opens below the anchor when there is room
- **WHEN** the user selects text whose anchor is high enough on screen that the
  popup can fit below it within the viewport
- **THEN** the popup is placed fully below the selected text and entirely within
  the viewport

#### Scenario: Popup flips above the anchor near the bottom of the screen
- **WHEN** the user selects text whose anchor is near the bottom of the viewport
  and there is not enough room to fit the popup below it
- **THEN** the popup is placed above the selected text, still fully within the
  viewport, so the user can see and interact with it

#### Scenario: Scrolling the pane closes the popup
- **WHEN** the user scrolls the content pane while the comment popup is open
- **THEN** the popup is dismissed, so it does not float, jump, or appear
  off-screen while the content moves

### Requirement: Comment popup uses generic, non-fix copy

The comment popup's editor SHALL present a neutral placeholder that does not
frame a comment as a fix request, so a highlight's comment is not implied to be
a change to make. The popup SHALL also provide a neutral save action and a
dismiss action, neither of which implies the comment must lead to an edit. The
copy SHALL communicate that a comment may be an observation, a question, or a
fix request alike.

#### Scenario: Placeholder is generic
- **WHEN** the user opens the comment popup on a selected highlight
- **THEN** the editor's placeholder is a neutral prompt such as "Add a comment…" rather than a fix-specific prompt such as "What should be fixed?"

#### Scenario: Actions are neutral
- **WHEN** the user opens the comment popup on a selected highlight
- **THEN** the popup offers a neutral save action and a dismiss action, and neither the actions nor their labels imply a fix request

### Requirement: Single self-describing prompt with one copy action

The system SHALL collect all highlights and comments into a single prompt and
expose exactly one action that copies that prompt to the clipboard. There SHALL be
no modal window for previewing or editing the prompt, and no mode selector: a
single prompt is generated regardless of the comments' intent. The action SHALL
confirm success by showing a toast.

#### Scenario: One copy action copies the prompt
- **WHEN** the review panel holds at least one comment and the user activates the Copy prompt action
- **THEN** the generated prompt is written to the clipboard and a toast confirms the copy

#### Scenario: No modal appears
- **WHEN** the user activates the Copy prompt action
- **THEN** no modal dialog opens; the prompt is not shown or edited anywhere in the UI

### Requirement: Prompt describes the review and disambiguates by intent

The generated prompt SHALL describe what the user reviewed by listing each comment
with its file path, the referenced text, and the comment. The prompt SHALL
instruct the model to act on each comment by intent: when a comment asks to
fix/adjust/edit the referenced text, apply the change; when a comment is itself a
question about the text, do **not** change the specification, and instead answer or
explain it in place. Where an edit is needed, the prompt SHALL also instruct the
model to update any other artifacts in the same proposal that the change affects,
so the whole proposal stays consistent. The prompt SHALL NOT instruct the model to
read the proposal from a repository or to restrict edits solely to referenced text.

#### Scenario: A fixing comment is applied
- **WHEN** a comment asks to change part of an artifact
- **THEN** the prompt asks the model to apply the change, and to keep the rest of the proposal consistent with it

#### Scenario: A question comment is answered without changes
- **WHEN** a comment is a question about the referenced text (e.g. "what does this mean?")
- **THEN** the prompt asks the model to explain or answer the question and to leave the specification unchanged

### Requirement: User can add a whole-file review comment

The system SHALL let the user attach a review comment to an entire artifact
(rather than to a highlighted text range) through a persistent, discoverable
button on the artifact's header. Such a comment SHALL apply to the whole
document (for example structure, tone, language, or formatting) and SHALL be
stored alongside range-based highlights without being anchored to any text
range or rendered as a highlight in the document. The user SHALL be able to add
more than one whole-file comment to the same artifact.

#### Scenario: Adding a comment via the header button
- **WHEN** the user activates the header comment button of an artifact and enters text
- **THEN** a whole-file comment is created for that artifact, distinct from any text-range highlight

#### Scenario: More than one comment per artifact
- **WHEN** the user adds a second whole-file comment to an artifact that already has one
- **THEN** both whole-file comments are kept for that artifact

#### Scenario: Comment is not anchored to a text range
- **WHEN** a whole-file comment exists for an artifact
- **THEN** it references no text range and is not shown as a highlight within the artifact's content

### Requirement: Whole-file comments appear in the review panel

The system SHALL show whole-file comments in the review panel alongside
range-based highlights, visually distinguished from range highlights, and SHALL
NOT display a quoted text snippet for a whole-file comment. A whole-file comment
SHALL NOT be reported as stale when the artifact's content changes. Clicking a
whole-file comment item in the review panel SHALL open the artifact it refers to.

#### Scenario: Whole-file comment is shown and distinguished
- **WHEN** the review panel contains a whole-file comment
- **THEN** it appears in the panel with a distinct marker or icon that identifies it as applying to the entire artifact, rather than a quoted text snippet

#### Scenario: Whole-file comment is never stale
- **WHEN** an artifact that has a whole-file comment has since changed
- **THEN** the comment is not reported as stale

#### Scenario: Clicking a whole-file comment opens the artifact
- **WHEN** the user clicks a whole-file comment item in the review panel
- **THEN** the artifact it refers to opens, if it is not already open

### Requirement: Whole-file comments fold into the fix prompt

The system SHALL include whole-file comments in the generated fix prompt, where
each entry SHALL identify the artifact's file path and the comment and SHALL
indicate that the comment applies to the entire artifact rather than to a
referenced text snippet. Entries for whole-file comments SHALL participate in
the same numbered sequence as range-comment entries, so the panel and the prompt
stay aligned in order.

#### Scenario: Prompt marks whole-artifact scope
- **WHEN** the user copies the prompt while a whole-file comment exists
- **THEN** the prompt lists the artifact and the comment and marks it as applying to the entire artifact, with no referenced-text snippet

#### Scenario: Numbering stays in sync with the panel
- **WHEN** the review panel shows N review items of either kind
- **THEN** the prompt numbers the same N items in the same order as the panel

### Requirement: Review items are scoped to the active folder

Review items (text-range highlights and whole-file comments) SHALL be stored and shown per folder. The review panel and the header's comment-count badge SHALL reflect the active folder's items only; switching folders SHALL swap the panel's contents without losing either folder's items. Items recorded before this change existed SHALL be treated as belonging to the folder that was open at the time (the migrated legacy folder) and SHALL continue to appear in it.

#### Scenario: Switching folders swaps the review panel
- **WHEN** the user switches from a folder with comments to a folder without
- **THEN** the review panel shows the second folder's items (none) and the first folder's comments remain stored

#### Scenario: Same-path artifacts keep separate review items
- **WHEN** two folders contain the same relative artifact path and the user comments on it in one folder
- **THEN** only that folder's review panel shows the comment; the other folder's panel does not

#### Scenario: Existing reviews survive in the migrated folder
- **WHEN** a user with pre-existing highlights/comments upgrades the app
- **THEN** those items appear in the folder that was open before the upgrade (restored as the legacy folder), not in any newly added folder

### Requirement: Prompt paths are folder-qualified

The copied review prompt SHALL identify each referenced file in a way that is unambiguous when more than one folder is open: paths of artifacts inside a folder's openspec root SHALL be prefixed with that folder's project name (e.g. `openspec-viewer/openspec/changes/…`), so prompts applied across repos can locate the right file.

#### Scenario: Prompt paths include the project name
- **WHEN** the user copies the review prompt while multiple folders are open
- **THEN** each listed artifact path is prefixed with the project name of the folder it belongs to

#### Scenario: Single-folder prompts keep relative paths
- **WHEN** exactly one folder is open and the user copies the review prompt
- **THEN** artifact paths keep the historical `openspec/…` relative form, with no project-name prefix

### Requirement: Review guidance strip on active change artifact tabs

The system SHALL show a review-guidance strip directly above an active change's artifact content, between the tab bar and the content, when the opened artifact is a proposal, a spec delta, a design, or a task list. The strip SHALL present the guiding question for that artifact's kind (for example, for a proposal, whether the proposal matches what the user actually asked for). The strip SHALL NOT appear for a change's metadata file, for archived changes, for main specs, or for config files.

#### Scenario: Strip appears on a proposal tab
- **WHEN** the user opens the Proposal tab of an active change
- **THEN** a guidance strip is shown above the proposal's content presenting the proposal-specific guiding question

#### Scenario: No strip on the metadata tab
- **WHEN** the user opens the Metadata tab of an active change
- **THEN** no guidance strip is shown above the metadata content

#### Scenario: No strip for archived changes or main specs
- **WHEN** the user opens an archived change or a main spec outside any change
- **THEN** no guidance strip is shown

#### Scenario: Guidance renders without network access
- **WHEN** the user opens a change artifact while the app has no network connection
- **THEN** the guidance strip still renders its question and red flags

### Requirement: Strip expands to reveal red flags and remembers expand state

The system SHALL make the guidance strip collapsible: when collapsed it SHALL show only the guiding question; when expanded it SHALL additionally show that artifact kind's review red flags (for example, for a proposal: a different problem than asked for, scope creep, or vagueness). The expanded/collapsed choice SHALL persist across tab switches within the session, consistently across tabs of the same artifact kind: expanding the strip on one spec tab SHALL leave it expanded when the user moves to another spec tab.

#### Scenario: Expanding the strip reveals red flags
- **WHEN** the user expands the guidance strip on a spec tab
- **THEN** the strip shows the spec review red flags in addition to the guiding question

#### Scenario: Expand state carries across same-kind tabs
- **WHEN** the user expands the strip on one spec tab and switches to another spec tab of the same change
- **THEN** the strip is still expanded, showing the spec red flags

### Requirement: Proposal strip warns to stop on a wrong proposal

The proposal strip, when expanded, SHALL include guidance based on the official review method: when the proposal does not match what the user asked for, the user should stop and fix the proposal before reviewing further artifacts.

#### Scenario: Expanded proposal strip contains the stop hint
- **WHEN** the user expands the guidance strip on a Proposal tab
- **THEN** the strip states that a wrong proposal should be fixed before moving on to the other artifacts

### Requirement: Two-minute checklist in the review panel

The system SHALL show, at the top of the review panel above the collected comments, a seven-item review checklist drawn from the official review method, where each item is independently checkable and a progress count shows how many of the seven items are checked. The checklist SHALL be shown while an active change's artifact is open and SHALL NOT be shown for standalone artifacts, main specs, or archived changes.

#### Scenario: Checklist appears with seven items on a change
- **WHEN** an active change's artifact is open and the review panel is visible
- **THEN** the panel shows seven checkable review items with a progress count

#### Scenario: Checking an item updates the progress count
- **WHEN** the user checks two of the seven checklist items
- **THEN** the progress count reflects two of seven checked

#### Scenario: No checklist outside a change
- **WHEN** the user opens a main spec or an archived change while the review panel is visible
- **THEN** the panel shows no checklist section

### Requirement: Checklist state is session-scoped per change

The system SHALL keep each change's checklist ticks in memory for the browser session only: switching between changes SHALL keep each change's own ticks and restore them when switching back; switching folders or reloading the page SHALL clear all checklist ticks. Checklist state SHALL NOT be written to persistent storage.

#### Scenario: Ticks survive switching between changes
- **WHEN** the user ticks several items on change A, switches to change B, then switches back to change A in the same session
- **THEN** change A shows its original ticks and change B shows none the user did not tick there

#### Scenario: Tick state clears after a reload
- **WHEN** the user ticks checklist items and reloads the page
- **THEN** all checklist items are unticked

### Requirement: Checklist never gates or enters the copied prompt

The checklist SHALL NOT affect the review panel's Copy prompt action in any way: the action's enabled state SHALL depend only on the presence of comments, an incomplete checklist SHALL NOT block copying, and the copied prompt SHALL contain only the review comments (with their referenced text and scope) and SHALL NOT include checklist items or tick state.

#### Scenario: Copy works with an incomplete checklist
- **WHEN** the review panel holds at least one comment but some checklist items are unchecked
- **THEN** the Copy prompt action is enabled and copies the comment prompt containing no checklist content

#### Scenario: Empty checklist does not enable copy
- **WHEN** the review panel holds no comments regardless of checklist state
- **THEN** the Copy prompt action stays disabled
