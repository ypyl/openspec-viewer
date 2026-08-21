## MODIFIED Requirements

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
