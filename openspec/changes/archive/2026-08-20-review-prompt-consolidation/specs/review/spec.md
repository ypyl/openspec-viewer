## MODIFIED Requirements

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

## ADDED Requirements

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
