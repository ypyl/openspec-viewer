## Purpose

Lets the user find any OpenSpec document by its content: a search box in the app header returns snippet results from across all sections, and each result deep-links into the matching artifact.

## Requirements

### Requirement: Search all artifact content

The system SHALL provide a fuzzy search that matches the user's query against the content of every artifact in the openspec tree — change artifacts (proposals, specs, design, tasks, metadata), standalone specs, archived changes, and configuration files — in addition to matching artifact names. A match found anywhere in an artifact's content SHALL cause that artifact to appear as a result, even when its name does not contain the query. Matches SHALL tolerate minor typos in the query.

#### Scenario: Match in a change's proposal body
- **WHEN** the user searches for a phrase that appears only inside a change proposal's body text
- **THEN** that change appears among the results with a snippet showing the phrase in context

#### Scenario: Match in a standalone spec
- **WHEN** the user searches for a phrase that appears only in a `specs/` capability document
- **THEN** that spec appears among the results

#### Scenario: Match in an archived change
- **WHEN** the user searches for a phrase that appears only in an archived change's documents
- **THEN** that archived change appears among the results

#### Scenario: Match in a configuration file
- **WHEN** the user searches for a phrase that appears only in a configuration file (e.g. the top-level config)
- **THEN** that configuration file appears among the results

#### Scenario: Typo-tolerant match
- **WHEN** the query contains a small typo relative to the matched text
- **THEN** the artifact still appears among the results

#### Scenario: Match only outside the name
- **WHEN** the query appears in an artifact's content but not in its file name or change name
- **THEN** the artifact appears among the results

### Requirement: Search box in the app header

The system SHALL present the search input at the top of the app so it is visible and reachable from any state. A keyboard shortcut SHALL focus the search input; pressing `Escape` SHALL clear the query and close the results. Queries shorter than three characters SHALL NOT produce results. The sidebar's existing name filter SHALL keep functioning independently of this content search.

#### Scenario: Keyboard shortcut focuses search
- **WHEN** the user presses the search shortcut without typing in any input field
- **THEN** the search input receives focus

#### Scenario: Escape clears and closes
- **WHEN** the user presses `Escape` while the search input is focused
- **THEN** the query is cleared and the results are closed

#### Scenario: One- or two-character query yields no results
- **WHEN** the query is one or two characters long
- **THEN** no results are shown

#### Scenario: Sidebar filter still works
- **WHEN** the user has an active content search in the header
- **THEN** the sidebar name filter still filters the artifact list by name

### Requirement: Results show snippets with match context

The system SHALL show search results in a dropdown beneath the search input, grouped by tree section in the standard order (Changes, Specs, Archive, Config). Each result SHALL identify its artifact — section, artifact type, and location (change name or file path) — and SHALL include a short snippet of the artifact's content around the match with the matched text visually highlighted. Results SHALL be capped to a bounded number, and when nothing matches the system SHALL show a clear empty state rather than stale or approximate results.

#### Scenario: Results are grouped by section
- **WHEN** a query produces matches in more than one section
- **THEN** the results are grouped under section headings in the order Changes, Specs, Archive, Config

#### Scenario: Result shows snippet with highlighted match
- **WHEN** a result is displayed
- **THEN** it shows the artifact's section, type and location, plus a snippet of surrounding content in which the matched text is visually highlighted

#### Scenario: No matches shows empty state
- **WHEN** a query of at least three characters matches no artifact content
- **THEN** the dropdown shows an empty state indicating no matches

### Requirement: Result opens the artifact at the match

The system SHALL open the artifact belonging to a clicked result in its usual surface: an artifact inside a change (active or archived) opens the change view with that artifact's tab active, and a standalone spec or configuration file opens directly. After opening, the artifact SHALL be scrolled to the first match; the matching text SHALL NOT be visually highlighted within the rendered artifact.

#### Scenario: Clicking a change result opens the change at that artifact
- **WHEN** the user clicks a result whose artifact lives inside a change (e.g. its design document)
- **THEN** the pane opens that change with the matching artifact's tab selected and scrolls to the matched text

#### Scenario: Clicking a spec result opens the spec
- **WHEN** the user clicks a result whose artifact is a standalone spec
- **THEN** the pane opens that spec and scrolls to the matched text

#### Scenario: Clicking a config result opens the config
- **WHEN** the user clicks a result whose artifact is a configuration file
- **THEN** the pane opens that file and scrolls to the matched text

#### Scenario: Clicking an archive result opens the archived change
- **WHEN** the user clicks a result whose artifact lives inside an archived change
- **THEN** the pane opens the archived change with the matching artifact's tab selected and scrolls to the matched text

### Requirement: Results track the current folder contents

The system SHALL base search results on the current state of the active folder: artifacts that appear, change, or are removed by its live folder scan SHALL be reflected in search results without reloading the page. Search SHALL also work for folders loaded through the file-upload fallback. Results SHALL never include artifacts from a non-active folder, even when another folder contains an artifact with the same relative path. Switching folders SHALL reset the search: the query is cleared and search then operates on the new active folder's contents.

#### Scenario: Newly added artifact becomes searchable
- **WHEN** a new artifact appears in the active folder during live monitoring
- **THEN** its content is included in subsequent searches without reloading the page

#### Scenario: Deleted artifact leaves the results
- **WHEN** an artifact is removed from the active folder during live monitoring
- **THEN** it no longer appears in search results

#### Scenario: Search works on uploaded folders
- **WHEN** the folder was loaded through the file-upload fallback rather than the folder picker
- **THEN** content search still returns results across all sections

#### Scenario: Search never mixes folders
- **WHEN** two folders contain an artifact with the same relative path and only the non-active one matches the query
- **THEN** no result is shown for the non-active folder's artifact

#### Scenario: Switching folders resets the search
- **WHEN** the user switches from folder A to folder B while a query is active
- **THEN** the query is cleared and no results are carried over from folder A
