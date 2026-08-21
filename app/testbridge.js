// app/testbridge.js — exposes an end-to-end test API on window.
//
// The browser tests (diff-test.js, migration-test.js, collapse-test.js, ...)
// drive the real scan, snapshot, and render pipeline. window.startMonitoring
// keeps the historical single-folder signature (handle, keepSnapshots): the
// FIRST call adds the folder through the real pick flow; later calls re-open
// the SAME folder (re-resolving the stubbed tree), which is how the tests
// simulate reloads without minting a new folder id and losing persisted
// snapshots / per-folder view state.

import {
  startMonitoring, scan, getSnapshot, putSnapshot, deleteSnapshot,
  resolveOpenSpecRoot, addPickedFolder, activateFolder, rehandleFolder,
  addUploadFolder,
} from './store.js';
import { folders, activeFolderId, folderData } from './state.js';
import { buildPrompt } from './prompt.js';

const pane = () => document.querySelector('osv-pane');

export function installTestBridge() {
  window.startMonitoring = async (handle, keepSnapshots) => {
    const root = await resolveOpenSpecRoot(handle);
    if (!root) return;
    let target = folders.value.find(f => f.kind === 'pick');
    if (!target) {
      const entry = await addPickedFolder(handle);
      return entry ? entry.id : null;
    }
    // Re-open the same folder over the (possibly mutated) stubbed tree.
    rehandleFolder(target.id, handle, root);
    activateFolder(target.id);
    return startMonitoring(target.id, !!keepSnapshots);
  };
  window.scan = (initial, signal) => scan(activeFolderId.value, initial, signal, {});
  window.scanFolder = (id) => scan(id, false, null, {});   // scan any folder (background)
  window.addUploadFolder = addUploadFolder;
  window.getSnapshot = (rel) => getSnapshot(activeFolderId.value, rel);
  window.putSnapshot = (rel, snap) => putSnapshot(activeFolderId.value, rel, snap);
  window.deleteSnapshot = (rel) => deleteSnapshot(activeFolderId.value, rel);
  window.openFile = (rel) => pane() && pane().openFile(rel);
  window.openChange = (key, initialRel) => pane() && pane().openChange(key, initialRel);
  window.buildPrompt = buildPrompt;
  window.folderNames = () => folders.value.map(f => (f.name + (f.suffix || '')));
  window.railAvatars = () => document.querySelectorAll('.rail-avatar').length;
  // Test helpers for the multi-folder suite.
  window.folderCount = () => folders.value.length;
  window.activeFolderId = () => activeFolderId.value;
  window.folderName = (id) => {
    const f = folders.value.find(x => x.id === id);
    return f ? f.name + (f.suffix || '') : null;
  };
  window.folderData = folderData;
}