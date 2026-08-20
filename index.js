// index.js — app bootstrap (Plain Vanilla Web, no build step).
// Registers the web components and starts the app.

import './components/osv-header/osv-header.js';
import './components/osv-search/osv-search.js';
import './components/osv-file-list/osv-file-list.js';
import './components/osv-pane/osv-pane.js';
import './components/osv-review/osv-review.js';
import './components/osv-loading/osv-loading.js';
import './components/osv-toast/osv-toast.js';

import { loadHighlights } from './app/annotations.js';
import { autoReopen } from './app/store.js';
import { installTestBridge } from './app/testbridge.js';

// Restore persisted highlights before anything renders.
loadHighlights();

// Re-open the previously used folder on reload (File System Access API only).
autoReopen();

// Expose the e2e test API used by diff-test.js / migration-test.js.
installTestBridge();

// Service worker only makes sense over http(s); it must not fail on file://.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
