// index.js — app bootstrap (Plain Vanilla Web, no build step).
// Registers the web components and starts the app.

import './components/osv-folder-rail/osv-folder-rail.js';
import './components/osv-header/osv-header.js';
import './components/osv-search/osv-search.js';
import './components/osv-file-list/osv-file-list.js';
import './components/osv-pane/osv-pane.js';
import './components/osv-review/osv-review.js';
import './components/osv-loading/osv-loading.js';
import './components/osv-toast/osv-toast.js';

import { loadHighlights, loadHighlightsForActive } from './app/annotations.js';
import { autoReopen, initStore } from './app/store.js';
import { installTestBridge } from './app/testbridge.js';

// Restore persisted highlights (the legacy folder's items on first load).
loadHighlights();

// Open IndexedDB and run any pending schema migration so the app always boots
// on the current schema, then re-open previously used folders (File System
// Access API only).
initStore();
autoReopen();

// Expose the e2e test API used by diff-test.js / migration-test.js.
installTestBridge();

// Folder switching: the projection effect (app/state.js) already swapped the
// view signals; here the imperative surfaces re-render. Order matters —
// review items hydrate before the pane renders so highlight marks apply, and
// the pane restores the new folder's selection before the search inputs clear.
document.addEventListener('osv:folder-switched', () => {
  loadHighlightsForActive();
  const paneEl = document.querySelector('osv-pane');
  if (paneEl) paneEl.handleFolderSwitched();
  const listEl = document.querySelector('osv-file-list');
  if (listEl) listEl.clearSearchInput();
  const searchEl = document.querySelector('osv-search');
  if (searchEl) searchEl.resetForFolderSwitch();
});

// Service worker only makes sense over http(s); it must not fail on file://.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}