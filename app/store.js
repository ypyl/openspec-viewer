// app/store.js — data access: IndexedDB persistence, File System Access
// picking/scanning, content snapshots, and the live-monitoring poll loop.
//
// This module owns no DOM. Where a scan needs the pane to react (re-render the
// open file, update tab badges, show a "deleted" notice), it dispatches a
// document-level CustomEvent that the bootstrap (index.js) wires to osv-pane.

import { normPath, isRelevant, groupOf, changeOf } from './model.js';
import { handleText } from './render.js';
import { diffLines } from './diff.js';
import { pruneHighlights } from './annotations.js';
import {
  allFiles, currentRel, currentKey, dirHandle, recentRels,
  fileState, paneCache, diffInfo, freshDiffs, diffViews, setStorePrefix,
} from './state.js';
import { showToast } from '../components/osv-toast/osv-toast.js';
import { setLoading } from '../components/osv-loading/osv-loading.js';

/* ---------- IndexedDB (persisted handle + content snapshots) ---------- */

const IDB_NAME = 'osviewer';
const IDB_STORE = 'handles';
const IDB_SNAP = 'snapshots';  // last scan's artifact text, keyed by rel path

function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = () => {
      // Guard both stores: on a v1->v2 upgrade 'handles' already exists
      // and re-creating it throws ConstraintError, which would abort the
      // upgrade and break handle persistence for returning users.
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains(IDB_SNAP)) db.createObjectStore(IDB_SNAP, { keyPath: 'rel' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function saveHandle(handle) {
  try {
    const db = await idbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, 'dir');
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) { /* non-fatal */ }
}

export async function loadHandle() {
  try {
    const db = await idbOpen();
    return await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const r = tx.objectStore(IDB_STORE).get('dir');
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  } catch (e) { return null; }
}

// Content snapshots for change diffs. The File System Access API exposes
// no previous versions, so we store each artifact's raw text (plus the
// mtime it was read at) after every scan; the next scan line-diffs against
// it. These survive reloads, so diffs hold across page refreshes too.
export async function getSnapshot(rel) {
  const db = await idbOpen();
  return await new Promise((res, rej) => {
    const tx = db.transaction(IDB_SNAP, 'readonly');
    const r = tx.objectStore(IDB_SNAP).get(rel);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}

export async function putSnapshot(rel, snap) {
  const db = await idbOpen();
  await new Promise((res, rej) => {
    const tx = db.transaction(IDB_SNAP, 'readwrite');
    tx.objectStore(IDB_SNAP).put(snap);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function deleteSnapshot(rel) {
  const db = await idbOpen();
  await new Promise((res, rej) => {
    const tx = db.transaction(IDB_SNAP, 'readwrite');
    tx.objectStore(IDB_SNAP).delete(rel);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

async function clearSnapshots() {
  try {
    const db = await idbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_SNAP, 'readwrite');
      tx.objectStore(IDB_SNAP).clear();
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) { /* non-fatal */ }
}

/* ---------- File input fallback ---------- */

// Read a file's raw text by rel (File System handle or uploaded File).
export async function readFileText(rel) {
  const entry = allFiles.value.find(f => f.rel === rel);
  if (!entry) return '';
  const f = entry.handle;
  return typeof f.getFile === 'function' ? await (await f.getFile()).text() : await f.text();
}

export async function handlePickedFiles(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;
  // Remember the project/openspec prefix so prompts can show full paths.
  setStorePrefix(deriveUploadPrefix(files[0].webkitRelativePath || ''));
  stopMonitoring();
  await loadFiles(files.map(f => ({ rel: normPath(f.webkitRelativePath), handle: f })));
}

// Extract the leading 'project/openspec' path from a raw upload path.
function deriveUploadPrefix(rawPath) {
  const m = String(rawPath).match(/^(.*?\bopenspec\b)(?=\/|$)/);
  return m ? m[0] + '/' : '';
}

/* ---------- Loading ---------- */

export async function loadFiles(raw) {
  setLoading('Loading files…');
  try {
    allFiles.value = raw
      .filter(f => isRelevant(f.rel) && groupOf(f.rel))
      .sort((a, b) => a.rel.localeCompare(b.rel));
    paneCache.clear();
    fileState.clear();
    recentRels.value = new Set();
    diffInfo.clear();
    freshDiffs.clear();
    diffViews.clear();
    currentRel.value = null;
    currentKey.value = null;
    pruneHighlights();
    document.dispatchEvent(new CustomEvent('osv:auto-open'));
  } finally {
    setLoading(null);
  }
}

/* ---------- Live monitoring ---------- */

let pollTimer = null;      // setInterval id for the poll loop
let isScanning = false;    // guard against overlapping scans

export async function startMonitoring(handle, keepSnapshots) {
  dirHandle.value = handle;
  // The picked folder is the project root (use its name) or openspec itself.
  setStorePrefix(handle && handle.name && handle.name !== 'openspec'
    ? handle.name + '/openspec/'
    : 'openspec/');
  // Fresh pick: drop the previous folder's baseline and markers so the
  // first scan doesn't flag everything as newly changed. autoReopen on
  // reload keeps persisted snapshots so content diffs survive a refresh.
  if (!keepSnapshots) clearSnapshots();
  fileState.clear();
  recentRels.value = new Set();
  diffInfo.clear();
  freshDiffs.clear();
  diffViews.clear();
  await scan(true);
  if (!currentRel.value) document.dispatchEvent(new CustomEvent('osv:auto-open'));
  clearInterval(pollTimer);
  pollTimer = setInterval(() => scan(false), 10000);
}

export function stopMonitoring() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  dirHandle.value = null;
}

// Opens the folder picker at the last-used folder and starts monitoring.
export async function pickFolder() {
  await new Promise((resolve) => {
    const savedHandlePromise = loadHandle();
    savedHandlePromise.then(async (saved) => {
      let dir;
      try {
        // Open the picker at the previously used folder when possible.
        dir = await window.showDirectoryPicker({ startIn: saved || undefined });
      } catch (err) {
        if (err.name === 'AbortError') return resolve();   // user cancelled
        dir = await window.showDirectoryPicker();           // stale handle -> fresh
      }
      dirHandle.value = dir;
      saveHandle(dir);
      await startMonitoring(dir);
      resolve();
    });
  });
}

async function* walkDir(dir, prefix) {
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      yield* walkDir(entry, prefix + entry.name + '/');
    } else {
      yield [prefix + entry.name, entry];
    }
  }
}

export async function scan(initial) {
  if (!dirHandle.value || isScanning) return;
  isScanning = true;
  if (initial) setLoading('Reading folder…');
  let found = 0, lastUiAt = 0;
  try {
    const current = new Map();
    for await (const root of dirHandle.value.values()) {
      const rel0 = normPath(root.name);
      if (root.kind === 'directory') {
        // normPath can collapse the picked 'openspec' dir to ''; join without
        // a leading slash so startsWith('changes/') checks still match.
        const prefix = rel0 ? rel0 + '/' : '';
        for await (const [rel, handle] of walkDir(root, prefix)) {
          if (!isRelevant(rel) || !groupOf(rel)) continue;
          found++;
          const file = await handle.getFile();
          current.set(rel, { handle, lastModified: file.lastModified });
          const now = performance.now();
          if (initial && now - lastUiAt > 150) {
            lastUiAt = now;
            setLoading(`Reading folder… ${found} files`);
          }
        }
      } else {
        if (!isRelevant(rel0) || !groupOf(rel0)) continue;
        const file = await root.getFile();
        current.set(rel0, { handle: root, lastModified: file.lastModified });
      }
    }

    let changed = false;
    let activeChanged = false;
    const hadPrior = fileState.size > 0;   // false on the very first scan
    const updates = [];
    const diffsSeen = [];   // rels whose content diffed vs the persisted snapshot this scan
    let removals = 0;
    for (const [rel, info] of current) {
      const prev = fileState.get(rel);
      const modified = !prev || prev.lastModified !== info.lastModified;
      if (modified) {
        // Content-level diff against the persisted snapshot. The File System
        // Access API exposes no old versions, so snapshots are how we know
        // exactly what changed; they survive reloads, so diffs hold across
        // page refreshes too. IndexedDB failure just degrades to the
        // file-level markers below.
        try {
          const text = await handleText(info.handle);
          const snap = await getSnapshot(rel);
          if (snap && snap.text !== undefined && snap.text !== text) {
            const d = diffLines(snap.text, text);
            if (d) { diffInfo.set(rel, d); diffsSeen.push(rel); }
            else diffInfo.delete(rel);
          } else if (!snap) {
            diffInfo.delete(rel);   // first baseline — nothing to diff yet
          }
          await putSnapshot(rel, { rel, text, mtime: info.lastModified });
        } catch (e) { /* snapshotting unavailable — markers still work */ }
        paneCache.delete(rel);
      }
      if (!prev) {
        changed = true;
        if (hadPrior) updates.push(rel);
      } else if (prev.lastModified !== info.lastModified) {
        changed = true;
        if (hadPrior) updates.push(rel);
        if (rel === currentRel.value) activeChanged = true;
      }
    }
    for (const rel of fileState.keys()) {
      if (!current.has(rel)) {
        changed = true;
        paneCache.delete(rel);
        diffInfo.delete(rel);
        freshDiffs.delete(rel);
        diffViews.delete(rel);
        if (hadPrior) {
          removals++;
          try { await deleteSnapshot(rel); } catch (e) {}   // drop its diff baseline too
        }
      }
    }

    // The file currently open was deleted.
    if (currentRel.value && !fileState.has(currentRel.value) && !current.has(currentRel.value)) {
      currentRel.value = null;
      currentKey.value = null;
      document.dispatchEvent(new CustomEvent('osv:open-deleted'));
    }

    fileState.clear();
    current.forEach((v, k) => fileState.set(k, v));

    // Content diffs drive the same markers as file-level updates, and mark
    // their panes to auto-open the diff on first view.
    if (diffsSeen.length) {
      const fresh = diffsSeen.filter(rel => !recentRels.value.has(rel));
      diffsSeen.forEach(rel => freshDiffs.add(rel));
      if (fresh.length) recentRels.value = new Set([...recentRels.value, ...fresh]);
    }

    if (hadPrior && (updates.length || removals)) {
      const added = updates.filter(rel => !recentRels.value.has(rel));
      if (added.length) recentRels.value = new Set([...recentRels.value, ...added]);
      const parts = [];
      if (added.length) parts.push(`${added.length} artifact${added.length === 1 ? '' : 's'} updated`);
      if (removals) parts.push(`${removals} deleted`);
      if (parts.length) showToast(parts.join(' · '));
    } else if (!hadPrior && diffsSeen.length) {
      // Reload or re-open of the same folder: markers come from persisted
      // snapshots, so changes since the last visit still surface.
      showToast(`${diffsSeen.length} artifact${diffsSeen.length === 1 ? '' : 's'} changed since your last visit`);
    }

    if (changed && fileState.size) {
      allFiles.value = [...fileState.entries()]
        .map(([rel, info]) => ({ rel, handle: info.handle }))
        .sort((a, b) => a.rel.localeCompare(b.rel));
      if (activeChanged) document.dispatchEvent(new CustomEvent('osv:refresh-current'));
      // A sibling file diffed or a file was deleted: keep the change tabs'
      // diff badges in sync without swapping panes.
      if (currentKey.value) document.dispatchEvent(new CustomEvent('osv:refresh-tab-badges'));
    }
  } finally {
    isScanning = false;
    setLoading(null);
  }
}

/* ---------- Startup ---------- */

// Re-open the previously used folder on reload (File System Access API only).
export async function autoReopen() {
  if (!window.showDirectoryPicker) return;   // upload fallback has no persistent handle
  try {
    const saved = await loadHandle();
    if (!saved) return;
    if (await saved.queryPermission({ mode: 'read' }) === 'granted') {
      await startMonitoring(saved, true);   // keep snapshots: diffs span reloads
    }
  } catch (e) { /* non-fatal */ }
}
