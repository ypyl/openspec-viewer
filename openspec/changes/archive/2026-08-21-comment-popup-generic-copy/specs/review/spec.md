## ADDED Requirements

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
