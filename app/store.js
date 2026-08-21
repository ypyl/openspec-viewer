// app/store.js — data access: IndexedDB persistence, File System Access
// picking/scanning, content snapshots, and the live-monitoring poll loop.
//
// This module owns no DOM. Where a scan needs the pane to react (re-render the
// open file, update tab badges, show a "deleted" notice), it dispatches a
// document-level CustomEvent that the bootstrap (index.js) wires to osv-pane.

import { normPath, isRelevant, groupOf, changeOf, searchTitle } from './model.js';
import { handleText } from './render.js';
import { diffLines, hashText } from './diff.js';
import { pruneHighlights } from './annotations.js';
import {
  allFiles, currentRel, currentKey, dirHandle, recentRels,
  fileState, paneCache, diffInfo, diffViews, searchVersion, setStorePrefix,
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

// One transaction helper instead of per-op promise boilerplate. `fn` gets the
// object store and may return a request (its result is resolved on success);
// otherwise resolves when the transaction commits. Rejects on error.
async function storeTx(storeName, mode, fn) {
  const db = await idbOpen();
  return await new Promise((res, rej) => {
    const tx = db.transaction(storeName, mode);
    const r = fn(tx.objectStore(storeName));
    if (r) r.onsuccess = () => res(r.result);
    else tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function saveHandle(handle) {
  try { await storeTx(IDB_STORE, 'readwrite', s => { s.put(handle, 'dir'); }); }
  catch (e) { /* non-fatal */ }
}

export async function loadHandle() {
  try { return (await storeTx(IDB_STORE, 'readonly', s => s.get('dir'))) || null; }
  catch (e) { return null; }
}

export async function clearSavedHandle() {
  try { await storeTx(IDB_STORE, 'readwrite', s => s.delete('dir')); }
  catch (e) { /* non-fatal */ }
}

// Content snapshots for change diffs. The File System Access API exposes
// no previous versions, so we store each artifact's raw text (plus the
// mtime it was read at) after every scan; the next scan line-diffs against
// it. These survive reloads, so diffs hold across page refreshes too.
export async function getSnapshot(rel) {
  return (await storeTx(IDB_SNAP, 'readonly', s => s.get(rel))) || null;
}

export async function putSnapshot(rel, snap) {
  await storeTx(IDB_SNAP, 'readwrite', s => { s.put(snap); });
}

export async function deleteSnapshot(rel) {
  await storeTx(IDB_SNAP, 'readwrite', s => { s.delete(rel); });
}

// Acknowledge a rel's current content version as read (the version `hash` was
// computed from). Fire-and-forget and non-fatal like saveHandle: updates only
// readHash + unread on the snapshot row, preserving text/mtime. If no snapshot
// exists yet (a brand-new file opened before its first snapshot), read the live
// text so the row stays complete. Only this clears the persisted unread flag;
// the scan never does.
export async function markRead(rel, hash) {
  try {
    const snap = await getSnapshot(rel);
    if (snap) {
      await putSnapshot(rel, { ...snap, readHash: hash, unread: false });
    } else {
      await putSnapshot(rel, { rel, text: await readFileText(rel), mtime: Date.now(), readHash: hash, unread: false });
    }
  } catch (e) { /* non-fatal */ }
}

async function clearSnapshots() {
  try { await storeTx(IDB_SNAP, 'readwrite', s => { s.clear(); }); }
  catch (e) { /* non-fatal */ }
}

/* ---------- File input fallback ---------- */

// Read a file's raw text by rel (File System handle or uploaded File).
export async function readFileText(rel) {
  const entry = allFiles.value.find(f => f.rel === rel);
  if (!entry) return '';
  const f = entry.handle;
  return typeof f.getFile === 'function' ? await (await f.getFile()).text() : await f.text();
}

/* ---------- Search corpus ---------- */

// All persisted snapshots in one read; the search corpus is rebuilt from these
// (they already hold every scanned artifact's raw text) rather than re-reading
// files or persisting a second index.
async function getAllSnapshots() {
  try {
    const rows = await storeTx(IDB_SNAP, 'readonly', s => s.getAll());
    return new Map((rows || []).map(s => [s.rel, s]));
  } catch (e) { return new Map(); }
}

// One search record per artifact: { rel, title, text }. `text` comes from the
// persisted snapshot when present, else a live read (upload-mode folders have
// no snapshots).
export async function buildSearchCorpus() {
  const snaps = await getAllSnapshots();
  const out = [];
  for (const f of allFiles.value) {
    const snap = snaps.get(f.rel);
    let text = snap && snap.text !== undefined ? snap.text : null;
    if (text === null) {
      try { text = await readFileText(f.rel); } catch (e) { continue; }
    }
    out.push({ rel: f.rel, title: searchTitle(f.rel), text });
  }
  return out;
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
    searchVersion.value++;   // the corpus changed
    paneCache.clear();
    fileState.clear();
    recentRels.value = new Set();
    diffInfo.clear();
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
let baselineFresh = true;  // true only for the initial scan of a fresh pick (snapshots cleared)
let currentScan = null;    // AbortController for the user-cancellable initial folder read

export async function startMonitoring(handle, keepSnapshots) {
  // Abort any prior in-progress read so a fresh pick can't wedge behind it.
  if (currentScan) currentScan.abort();
  currentScan = new AbortController();
  dirHandle.value = handle;
  // The picked folder is the project root (use its name) or openspec itself.
  setStorePrefix(handle && handle.name && handle.name !== 'openspec'
    ? handle.name + '/openspec/'
    : 'openspec/');
  // Fresh pick: drop the previous folder's baseline and markers so the
  // first scan doesn't flag everything as newly changed. autoReopen on
  // reload keeps persisted snapshots so content diffs survive a refresh.
  if (!keepSnapshots) clearSnapshots();
  baselineFresh = !keepSnapshots;   // a fresh pick establishes the baseline (nothing is new);
                                    // a reload keeps snapshots, so genuinely-new files surface.
  fileState.clear();
  recentRels.value = new Set();
  diffInfo.clear();
  diffViews.clear();
  const status = await scan(true, currentScan.signal);
  currentScan = null;
  if (status === 'aborted') {
    // User cancelled the read: return to the true pre-read state — no folder
    // monitored, no stale list, and no persisted pointer so a reload doesn't
    // re-attempt the same slow read.
    dirHandle.value = null;
    allFiles.value = [];
    currentRel.value = null;
    currentKey.value = null;
    searchVersion.value++;   // the corpus changed (emptied)
    paneCache.clear();
    pruneHighlights();
    await clearSavedHandle();
    return;
  }
  baselineFresh = false;   // only the very first scan is the baseline; later scans flag new files
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

async function* walkDir(dir, prefix, signal) {
  for await (const entry of dir.values()) {
    if (signal && signal.aborted) return;   // cancellable: stop yielding on abort
    if (entry.kind === 'directory') {
      yield* walkDir(entry, prefix + entry.name + '/', signal);
    } else {
      yield [prefix + entry.name, entry];
    }
  }
}

export async function scan(initial, signal) {
  if (!dirHandle.value || isScanning) return;
  isScanning = true;
  const cancelled = () => !!(signal && signal.aborted);
  // The read is user-cancellable: the overlay's Cancel / Escape aborts currentScan.
  const cancelAction = { cancel: () => currentScan && currentScan.abort() };
  if (initial) setLoading('Reading folder…', cancelAction);
  let found = 0, lastUiAt = 0;
  let aborted = false;
  try {
    const current = new Map();
    for await (const root of dirHandle.value.values()) {
      if (cancelled()) { aborted = true; break; }
      const rel0 = normPath(root.name);
      if (root.kind === 'directory') {
        // normPath can collapse the picked 'openspec' dir to ''; join without
        // a leading slash so startsWith('changes/') checks still match.
        const prefix = rel0 ? rel0 + '/' : '';
        for await (const [rel, handle] of walkDir(root, prefix, signal)) {
          if (cancelled()) { aborted = true; break; }
          if (!isRelevant(rel) || !groupOf(rel)) continue;
          found++;
          const file = await handle.getFile();
          current.set(rel, { handle, lastModified: file.lastModified });
          const now = performance.now();
          if (initial && now - lastUiAt > 150) {
            lastUiAt = now;
            setLoading(`Reading folder… ${found} files`, cancelAction);
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
    let corpusChanged = false;   // any copied/removed snapshot dirties the search index
    const hadPrior = fileState.size > 0;   // false on the very first scan
    const updates = [];
    const diffsSeen = [];   // rels whose content diffed vs the persisted snapshot this scan
    let removals = 0;
    const prevUnread = recentRels.value;        // carry forward last scan's unread set
    const nextUnread = new Set(prevUnread);     // rebuilt by this scan, assigned back below
    for (const [rel, info] of current) {
      if (cancelled()) { aborted = true; break; }
      const prev = fileState.get(rel);
      const modified = !prev || prev.lastModified !== info.lastModified;
      if (modified) {
        corpusChanged = true;
        // Content-level diff against the persisted snapshot. The File System
        // Access API exposes no old versions, so snapshots are how we know
        // exactly what changed; they survive reloads, so diffs hold across
        // page refreshes too. IndexedDB failure just degrades to the
        // file-level markers below.
        try {
          const text = await handleText(info.handle);
          const snap = await getSnapshot(rel);
          let changedContent = false;
          if (snap && snap.text !== undefined && snap.text !== text) {
            const d = diffLines(snap.text, text);
            if (d) { diffInfo.set(rel, d); diffsSeen.push(rel); changedContent = true; }
            else diffInfo.delete(rel);
          } else if (!snap) {
            diffInfo.delete(rel);   // first baseline — nothing to diff yet
          }
          // Unread seeding (see design.md D2): a rel is unread iff there is an
          // unacknowledged change. Brand-new files appearing during operation
          // (no prior snapshot) are unread; files whose content changed and is
          // not the version in readHash are unread (a previously read file that
          // changes again re-flags); unchanged files keep their persisted unread
          // state. The fresh-pick baseline (!hadPrior, snapshots cleared) is read.
          // readHash drives re-flagging here; the persisted `unread` flag carries
          // unreadness across reloads once the snapshot has already advanced to
          // the unread version (indistinguishable from an unchanged file by
          // readHash alone).
          let isUnread;
          if (!snap) isUnread = !baselineFresh;   // a genuinely-new file is unread; the fresh-pick baseline is not
          else if (changedContent) isUnread = snap.readHash !== hashText(text);
          else isUnread = !!snap.unread;
          if (isUnread) nextUnread.add(rel); else nextUnread.delete(rel);
          await putSnapshot(rel, {
            rel, text, mtime: info.lastModified,
            readHash: snap ? snap.readHash : undefined,
            unread: isUnread,
          });
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
      if (cancelled()) { aborted = true; break; }
      if (!current.has(rel)) {
        changed = true;
        corpusChanged = true;
        paneCache.delete(rel);
        diffInfo.delete(rel);
        nextUnread.delete(rel);
        diffViews.delete(rel);
        if (hadPrior) {
          removals++;
          try { await deleteSnapshot(rel); } catch (e) {}   // drop its diff baseline too
        }
      }
    }

    if (aborted) return 'aborted';   // cancelled: commit nothing; the finally clears the overlay

    // The file currently open was deleted.
    if (currentRel.value && !fileState.has(currentRel.value) && !current.has(currentRel.value)) {
      currentRel.value = null;
      currentKey.value = null;
      document.dispatchEvent(new CustomEvent('osv:open-deleted'));
    }

    fileState.clear();
    current.forEach((v, k) => fileState.set(k, v));

    // Commit the unread set: last scan's set plus this scan's adds/removes,
    // keyed to the persisted readHash, so it survives reloads (on the first
    // scan after re-opening, old read pointers vs current text reseed it).
    recentRels.value = nextUnread;

    if (corpusChanged) searchVersion.value++;   // snapshots changed → rebuild the search index

    if (hadPrior && (updates.length || removals)) {
      const added = updates.filter(rel => !prevUnread.has(rel));
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
