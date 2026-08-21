## ADDED Requirements

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
