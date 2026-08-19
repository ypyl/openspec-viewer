// app/testbridge.js — exposes an end-to-end test API on window.
//
// The browser tests (diff-test.js, migration-test.js) drive the real scan,
// snapshot, and render pipeline. In the old single-file app these functions
// were global; now they live in modules, so we re-expose the exact set the
// e2e tests call (pure-logic unit tests live in tools/test-*.mjs instead).
// The DOM hooks map to the osv-pane component's methods.

import {
  startMonitoring, scan, loadHandle, getSnapshot, putSnapshot, deleteSnapshot,
} from './store.js';

const pane = () => document.querySelector('osv-pane');

export function installTestBridge() {
  window.startMonitoring = startMonitoring;
  window.scan = scan;
  window.loadHandle = loadHandle;
  window.getSnapshot = getSnapshot;
  window.putSnapshot = putSnapshot;
  window.deleteSnapshot = deleteSnapshot;
  window.openFile = (rel) => pane() && pane().openFile(rel);
  window.openChange = (key, initialRel) => pane() && pane().openChange(key, initialRel);
}
