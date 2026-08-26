## MODIFIED Requirements

### Requirement: User can add a whole-file review comment

The system SHALL let the user attach a review comment to an entire artifact
(rather than to a highlighted text range) by selecting the change title — the
heading shown at the top of the change view — in both the change section and
the archive section. Selecting the change title and entering a comment SHALL
create a whole-file comment for the artifact currently open in the view. Such a
comment SHALL apply to the whole document (for example structure, tone,
language, or formatting) and SHALL be stored alongside range-based highlights
without being anchored to any text range or rendered as a highlight in the
document. The user SHALL be able to add more than one whole-file comment to the
same artifact, and SHALL be able to do so without a dedicated header button.

#### Scenario: Adding a comment via the header button
- **WHEN** an artifact is open in a change view and the user selects the change title and enters a comment
- **THEN** a whole-file comment is created for the open artifact, distinct from any text-range highlight

#### Scenario: Adding a comment in an archived change
- **WHEN** an artifact is open in an archived change view and the user selects the change title and enters a comment
- **THEN** a whole-file comment is created for the open artifact

#### Scenario: Comment is created for the open artifact
- **WHEN** the user selects the change title while a particular artifact tab is active and enters a comment
- **THEN** the whole-file comment is attached to that active artifact, not to the change as a whole

#### Scenario: More than one comment per artifact
- **WHEN** the user adds a second whole-file comment to an artifact that already has one
- **THEN** both whole-file comments are kept for that artifact

#### Scenario: Comment is not anchored to a text range
- **WHEN** a whole-file comment exists for an artifact
- **THEN** it references no text range and is not shown as a highlight within the artifact's content

#### Scenario: No header button is required
- **WHEN** the user wants to add a whole-file comment to an artifact
- **THEN** a whole-file comment can be added by selecting the change title, without any header button
