## Purpose

Defines how the OpenSpec Local Viewer is distributed and loaded at runtime: served over HTTP(S) only, hosted on GitHub Pages, installable as an offline-capable PWA, with all runtime dependencies vendored locally and version markers kept in sync.

## Requirements

### Requirement: App is served over HTTP(S)

The system SHALL function only when served over an HTTP(S) origin using ES modules. Opening the app from a `file://` URL MUST NOT produce a functioning application; the page SHALL instead show a clear message explaining that a web server is required.

#### Scenario: Served over HTTP
- **WHEN** the app is served over HTTP(S) and loaded in a browser
- **THEN** the app boots normally and all features are available

#### Scenario: Opened from file://
- **WHEN** the page is opened directly from the filesystem via a `file://` URL
- **THEN** the app does not boot and the page displays a message that an HTTP(S) server is required

### Requirement: Single-page application structure

The system SHALL consist of exactly one HTML page. All application navigation (selecting files, changes, tabs, diff views) SHALL happen within that page without URL-routed multi-page navigation.

#### Scenario: All navigation stays in one page
- **WHEN** the user browses files, opens changes, switches tabs, or toggles diff views
- **THEN** the browser URL does not navigate to different pages and the single page remains loaded

### Requirement: ES module loading

The application SHALL load its behavior as ES modules from a single module entry point in the HTML document. Scripts SHALL NOT be inlined in the HTML other than the pre-paint theme bootstrap and vendored legacy-format libraries.

#### Scenario: Module graph loads from server
- **WHEN** the page loads over HTTP(S)
- **THEN** the browser loads the module entry point and its imported module graph from the same origin

### Requirement: No runtime CDN dependency

The application SHALL load all runtime libraries from local vendored files. It SHALL NOT fetch library code from external CDNs at runtime.

#### Scenario: Offline with no external requests
- **WHEN** the app is used offline after an initial load
- **THEN** no external CDN requests are attempted and all libraries resolve from local files

### Requirement: Offline support via service worker

The system SHALL register a service worker that precaches the full application asset graph (HTML shell, modules, styles, libraries, icons, manifest) and serves assets cache-first with navigation requests network-first. The service worker cache version SHALL be tied to the application version so each release deploys a fresh cache.

#### Scenario: Offline reload after install
- **WHEN** the app was loaded once online (service worker installed) and is then reloaded offline
- **THEN** the full app loads from the service worker cache and remains functional

#### Scenario: New release refreshes the cache
- **WHEN** a new version with a bumped cache version is deployed
- **THEN** the service worker installs the new asset set, deletes old caches, and the updated app loads

### Requirement: Installable web app

The system SHALL be installable as a PWA from the served origin, providing a web app manifest and icons, and SHALL expose the app version in the header badge.

#### Scenario: Install as app
- **WHEN** the user uses the browser's install control on the served origin
- **THEN** the browser offers to install the app as a PWA and it opens with the manifest metadata

### Requirement: Version markers stay in sync

The three version markers — the HTML first-line comment, the header badge, and the service worker cache version — SHALL always reflect the same application version, bumped together in the same commit as the feature or fix that changes them.

#### Scenario: Release ships matching markers
- **WHEN** a release is deployed
- **THEN** the first-line comment, the header badge, and the service worker cache version all show the same version, and the badge matches the deployed commit
