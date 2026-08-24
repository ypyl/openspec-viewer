// app/store.js — data access: IndexedDB persistence (folder registry +
// content snapshots), File System Access picking/scanning, and per-folder
// live-monitoring poll loops.
//
// Multi-folder model (design D1/D3/D4): every folder gets a stable uuid;
// snapshots are keyed by `folderId + '/' + rel` because two folders can
// contain the same relative path. The legacy single-folder handle/snapshots
// migrate into a deterministic `legacy` folder row on the IDB v2→v3 upgrade.
//
// This module owns no DOM. Where a scan needs the pane to react (re-render the
// open file, update tab badges, show a "deleted" notice), it dispatches a
// document-level CustomEvent that the bootstrap (index.js) wires to osv-pane.

import { normPath, isRelevant, isChangeMetadata, groupOf, changeOf, searchTitle } from './model.js';
import { handleText } from './render.js';
import { diffLines, hashText } from './diff.js';
import { pruneHighlights } from './annotations.js';
import {
  folders, activeFolderId, folderUnread, folderData, registerFolderState,
  folderEntryFor, currentFolderId, hueFor, allFiles, recentRels, searchVersion,
  diffInfo, diffViews, paneCache, currentRel, currentKey,
} from './state.js';
import { showToast } from '../components/osv-toast/osv-toast.js';
import { setLoading } from '../components/osv-loading/osv-loading.js';

function swapMap(dst, src) {
  dst.clear();
  src.forEach((v, k) => dst.set(k, v));
}

/* ---------- IndexedDB (folder registry + snapshots) ---------- */

const IDB_NAME = 'osviewer';
const IDB_VERSION = 3;
const IDB_LEGACY_HANDLE = 'handles';  // v1/v2 store; read only during migration
const IDB_FOLDERS = 'folders';        // keyPath 'id' — { id, name, kind, pickedHandle, rootHandle, lastActive }
const IDB_SNAP = 'snapshots';         // keyPath 'key' = folderId + '/' + rel

// The legacy single-folder entry id, used to re-home v1/v2 data (handle,
// snapshots, highlights, collapse state) so returning users keep everything.
export const LEGACY_FOLDER_ID = 'legacy';

function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction;
      const hadLegacySnap = db.objectStoreNames.contains(IDB_SNAP);
      if (!db.objectStoreNames.contains(IDB_LEGACY_HANDLE)) db.createObjectStore(IDB_LEGACY_HANDLE);
      if (!db.objectStoreNames.contains(IDB_FOLDERS)) db.createObjectStore(IDB_FOLDERS, { keyPath: 'id' });

      // v2 snapshots were keyed by rel path alone. v3 re-keys them to
      // `folderId/rel` (two folders can share a rel). Read the legacy rows
      // through a drained cursor FIRST — deleting a store that still has an
      // open cursor is not safe — then rebuild with the composite keyPath.
      // All of this is atomic with the version bump: a failure aborts the
      // upgrade and nothing is half-migrated.
      const legacyRows = [];
      const mint = () => {
        const foldersStore = tx.objectStore(IDB_FOLDERS);
        tx.objectStore(IDB_LEGACY_HANDLE).get('dir').onsuccess = (e) => {
          const saved = e.target.result;
          // Re-home the v1/v2 saved handle (key 'dir') into the legacy row.
          if (saved) foldersStore.put({ id: LEGACY_FOLDER_ID, name: saved.name || 'folder', kind: 'pick', pickedHandle: saved });
          if (hadLegacySnap && legacyRows.length) {
            const snapStore = tx.objectStore(IDB_SNAP);
            for (const row of legacyRows) {
              const rel = row && row.rel ? row.rel : '';
              snapStore.put({ ...row, key: LEGACY_FOLDER_ID + '/' + rel, folderId: LEGACY_FOLDER_ID });
            }
          }
        };
      };

      if (hadLegacySnap) {
        const cur = tx.objectStore(IDB_SNAP).openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { legacyRows.push(c.value); c.continue(); return; }
          db.deleteObjectStore(IDB_SNAP);
          db.createObjectStore(IDB_SNAP, { keyPath: 'key' });
          mint();
        };
      } else {
        if (!db.objectStoreNames.contains(IDB_SNAP)) db.createObjectStore(IDB_SNAP, { keyPath: 'key' });
        mint();
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

// Warm the store open + run any pending IDB migration at boot, independently
// of whether folders can be restored (upload-only sessions still need the
// schema in place). Fire-and-forget from index.js.
export async function initStore() {
  try { await idbOpen(); } catch (e) { /* non-fatal: storage unavailable */ }
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

/* ---------- Folder registry persistence ---------- */

export async function getFolderEntries() {
  try { return (await storeTx(IDB_FOLDERS, 'readonly', s => s.getAll())) || []; }
  catch (e) { return []; }
}

export async function saveFolderEntry(row) {
  try { await storeTx(IDB_FOLDERS, 'readwrite', s => { s.put(row); }); }
  catch (e) { /* non-fatal */ }
}

export async function deleteFolderEntry(id) {
  try { await storeTx(IDB_FOLDERS, 'readwrite', s => { s.delete(id); }); }
  catch (e) { /* non-fatal */ }
}

// Remember which folder was active so reloads restore it (fire-and-forget).
export async function setFolderLastActive(id) {
  try {
    const rows = await getFolderEntries();
    const row = rows.find(r => r.id === id);
    if (row) await saveFolderEntry({ ...row, lastActive: Date.now() });
  } catch (e) { /* non-fatal */ }
}

/* ---------- Snapshot persistence (per folder) ---------- */

function snapKey(folderId, rel) { return folderId + '/' + rel; }

export async function getSnapshot(folderId = currentFolderId(), rel) {
  if (!folderId) return null;
  try { return (await storeTx(IDB_SNAP, 'readonly', s => s.get(snapKey(folderId, rel)))) || null; }
  catch (e) { return null; }
}

export async function putSnapshot(folderId = currentFolderId(), rel, snap) {
  if (!folderId) return;
  await storeTx(IDB_SNAP, 'readwrite', s => { s.put({ ...snap, key: snapKey(folderId, rel), folderId, rel }); });
}

export async function deleteSnapshot(folderId = currentFolderId(), rel) {
  if (!folderId) return;
  await storeTx(IDB_SNAP, 'readwrite', s => { s.delete(snapKey(folderId, rel)); });
}

export async function getAllSnapshots() {
  try { return (await storeTx(IDB_SNAP, 'readonly', s => s.getAll())) || []; }
  catch (e) { return []; }
}

// Delete every snapshot row that belongs to a folder (close = forget).
export async function clearFolderSnapshots(folderId) {
  try {
    await storeTx(IDB_SNAP, 'readwrite', s => {
      const cur = s.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) {
          if (c.value && c.value.folderId === folderId) c.delete();
          c.continue();
        }
      };
    });
  } catch (e) { /* non-fatal */ }
}

/* ---------- Read helpers ---------- */

// Read a file's raw text by rel (File System handle or uploaded File).
export async function readFileText(rel) {
  const entry = allFiles.value.find(f => f.rel === rel);
  return entry ? await handleText(entry.handle) : '';
}

// Acknowledge a rel's current content version as read (the version `hash` was
// computed from). Identical to the pre-multi-folder behavior but scoped to a
// folder id (default: the active folder). Only this clears the persisted
// unread flag; the scan never does.
export async function markRead(rel, hash, folderId = currentFolderId()) {
  if (hash == null || !folderId) return;
  try {
    const snap = await getSnapshot(folderId, rel);
    if (snap) {
      await putSnapshot(folderId, rel, { ...snap, readHash: hash, unread: false });
    } else {
      await putSnapshot(folderId, rel, {
        rel, text: await readFileText(rel), mtime: Date.now(), readHash: hash, unread: false,
      });
    }
  } catch (e) { /* non-fatal */ }
}

/* ---------- Search corpus ---------- */

// The search index is built from the ACTIVE folder's persisted snapshots only
// (with a live-read fallback for upload-mode folders, which have no
// snapshots). Two folders can share a rel path; the folderId filter keeps
// results from mixing.
export async function buildSearchCorpus() {
  const rows = await getAllSnapshots();
  const fid = currentFolderId();
  const snaps = new Map();
  if (fid) for (const s of rows) if (s.folderId === fid) snaps.set(s.rel, s);
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

/* ---------- Folder identity / lifecycle ---------- */

function genId() {
  return (crypto.randomUUID && crypto.randomUUID())
    || 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Display suffix (#2, #3 ...) for a folder whose project name is already in
// the rail — two checkouts of the same repo, for example.
function nameSuffix(name) {
  const n = folders.value.filter(f => f.name === name).length;
  return n ? '#' + (n + 1) : '';
}

// Add a folder to the registry (rail + in-memory state + persisted row) and
// return its display entry.
async function registerPickFolder(handle, root) {
  const id = genId();
  const name = handle.name || 'folder';
  const entry = { id, name, kind: 'pick', hue: hueFor(name), suffix: nameSuffix(name) };
  registerFolderState(id);
  folderHandles.set(id, { pickedHandle: handle, rootHandle: root });
  folderUnread.value = new Map(folderUnread.value).set(id, false);
  folders.value = [...folders.value, entry];
  await saveFolderEntry({ ...entry, pickedHandle: handle, rootHandle: root });
  return entry;
}

// Resolve the openspec root to scan. If `dir` holds an 'openspec'
// subdirectory (a repo root was picked), that's the root; otherwise, if `dir`
// itself is an openspec root (changes/, specs/, or config.yaml directly
// inside), use it as is. Returns the root handle, or null when the picked
// folder is neither.
export async function resolveOpenSpecRoot(dir) {
  let looksLikeRoot = false;
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      if (entry.name === 'openspec') return entry;   // repo root -> openspec/
      if (entry.name === 'changes' || entry.name === 'specs') looksLikeRoot = true;
    } else if (entry.name === 'config.yaml') {
      looksLikeRoot = true;
    }
  }
  return looksLikeRoot ? dir : null;
}

export function activateFolder(id) {
  if (!folderData.has(id)) return;
  activeFolderId.value = id;   // the projection effect swaps the view
  setFolderLastActive(id);     // fire-and-forget
}

// Point an existing folder at a (re-resolved) root handle. Used by the test
// bridge when a stubbed directory tree needs a rescan with the same folder id.
export function rehandleFolder(id, pickedHandle, rootHandle) {
  folderHandles.set(id, { pickedHandle, rootHandle });
}

// Pick flow (the rail's + button): resolve the root, dedup by filesystem
// identity, add, activate, and run the cancillable initial scan.
export async function addPickedFolder(handle) {
  const root = await resolveOpenSpecRoot(handle);
  if (!root) {
    showToast('No OpenSpec project found (looking for openspec/)');
    return null;
  }
  // The same filesystem entry is already open → switch to it, don't duplicate.
  for (const f of folders.value) {
    if (f.kind !== 'pick') continue;
    const h = folderHandles.get(f.id);
    if (h && h.rootHandle && typeof h.rootHandle.isSameEntry === 'function') {
      try { if (await h.rootHandle.isSameEntry(root)) { activateFolder(f.id); return f; } } catch (e) {}
    }
  }
  const entry = await registerPickFolder(handle, root);
  const prevActive = activeFolderId.value;
  activateFolder(entry.id);
  await startMonitoring(entry.id, false, { reactivate: prevActive });
  return entry;
}

// Opens the folder picker and starts monitoring. Returns the new entry, or
// null when the user cancelled.
export async function pickFolder() {
  let dir;
  try {
    dir = await window.showDirectoryPicker();
  } catch (err) {
    if (err.name === 'AbortError') return null;
    dir = await window.showDirectoryPicker();   // stale handle -> fresh
  }
  return addPickedFolder(dir);
}

// Upload fallback (no File System Access API): session-only folder entry,
// never persisted, never live-monitored, no unread dot. Dedups against other
// uploads by the normalized set of artifact paths.
export function addUploadFolder(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return null;
  const raw = files.map(f => ({ rel: normPath(f.webkitRelativePath || f.name), handle: f }));
  const filtered = raw.filter(f => isRelevant(f.rel) && groupOf(f.rel)).sort((a, b) => a.rel.localeCompare(b.rel));
  if (!filtered.length) { showToast('No artifacts found in the uploaded folder'); return null; }
  const relSet = filtered.map(f => f.rel).join('\n');  for (const f of folders.value) {
    if (f.kind !== 'upload') continue;
    const st = folderData.get(f.id);
    if (st && st.files.map(x => x.rel).join('\n') === relSet) {
      activateFolder(f.id);
      return f;
    }
  }
  // Project name = the first segment of the upload path (the folder chosen
  // in the picker), e.g. 'my-repo/openspec/...' -> 'my-repo'.
  const uploadPath = String((files[0] && (files[0].webkitRelativePath || files[0].name)) || '');
  const base = uploadPath.split('/')[0] || 'upload';
  const id = genId();
  const entry = { id, name: base, kind: 'upload', hue: hueFor(base), suffix: nameSuffix(base) };
  registerFolderState(id);
  const st = folderData.get(id);
  st.files = filtered;
  folderHandles.set(id, null);
  folderUnread.value = new Map(folderUnread.value).set(id, false);
  folders.value = [...folders.value, entry];
  activateFolder(id);
  pruneHighlights();
  if (!st.currentRel) document.dispatchEvent(new CustomEvent('osv:auto-open'));
  return entry;
}

// Stop polling a folder (and drop any in-flight scan controller).
function stopTimer(folderId) {
  const t = pollTimers.get(folderId);
  if (t) { clearInterval(t); pollTimers.delete(folderId); }
}

// Close = forget: remove from the rail, stop monitoring, delete persisted
// snapshots + folder row. When the closed folder was active, the next folder
// down the rail becomes active (or `opts.reactivate`, e.g. after cancelling
// a folder add — see spec change-monitoring "Cancel an in-progress folder
// read").
export async function closeFolder(folderId, opts = {}) {
  const idx = folders.value.findIndex(f => f.id === folderId);
  if (idx < 0 && !folderData.has(folderId)) return;
  stopTimer(folderId);
  const a = scanAborters.get(folderId);
  if (a) a.abort();
  scanAborters.delete(folderId);
  scanning.delete(folderId);
  try { await clearFolderSnapshots(folderId); } catch (e) {}
  try { await deleteFolderEntry(folderId); } catch (e) {}
  folderHandles.delete(folderId);
  folderData.delete(folderId);
  const wasActive = activeFolderId.value === folderId;
  const unread = new Map(folderUnread.value);
  unread.delete(folderId);
  folderUnread.value = unread;
  const remaining = folders.value.filter(f => f.id !== folderId).map(f => f.id);
  folders.value = folders.value.filter(f => f.id !== folderId);
  if (wasActive) {
    const target = (opts.reactivate && remaining.includes(opts.reactivate)) ? opts.reactivate
      : (remaining[idx] || remaining[remaining.length - 1] || null);
    if (target) activateFolder(target);
    else activeFolderId.value = null;
  }
}

/* ---------- Live monitoring (per folder) ---------- */

const pollTimers = new Map();     // folderId -> setInterval
const scanning = new Set();       // folderIds mid-scan (overlap guard)
const scanAborters = new Map();   // folderId -> AbortController (initial reads are cancellable)
const baselineFresh = new Set();  // folderIds whose NEXT scan is a fresh baseline (nothing is new)
const folderHandles = new Map();  // id -> { pickedHandle, rootHandle }

async function* walkDir(dir, prefix, signal) {
  for await (const entry of dir.values()) {
    if (signal && signal.aborted) return;
    if (entry.kind === 'directory') {
      yield* walkDir(entry, prefix + entry.name + '/', signal);
    } else {
      yield [prefix + entry.name, entry];
    }
  }
}

// Run the initial read + poll loop for a folder. `keepSnapshots` treats it as
// a re-open (diff baselines and read state persist so changes since the last
// visit surface); a fresh add clears the folder's snapshots and baselines
// nothing as new. `opts.toast === false` suppresses scan toasts (autoReopen
// aggregates them itself). `opts.reactivate` is the folder to fall back to if
// the user cancels this folder's initial read.
export async function startMonitoring(folderId, keepSnapshots = false, opts = {}) {
  const entry = folderEntryFor(folderId);
  const handles = folderHandles.get(folderId);
  if (!entry || !handles) return null;
  if (scanAborters.has(folderId)) scanAborters.get(folderId).abort();
  const abort = new AbortController();
  scanAborters.set(folderId, abort);
  const st = registerFolderState(folderId);
  if (!keepSnapshots) await clearFolderSnapshots(folderId);
  if (keepSnapshots) baselineFresh.delete(folderId);
  else baselineFresh.add(folderId);
  st.fileState.clear();
  st.recentRels = new Set();
  st.diffInfo.clear();
  st.diffViews.clear();
  const status = await scan(folderId, true, abort.signal, { toast: opts.toast !== false });
  scanAborters.delete(folderId);
  if (status === 'aborted') {
    // User cancelled the read: the folder must not linger (per the
    // change-monitoring spec). closeFolder re-activates opts.reactivate.
    await closeFolder(folderId, { reactivate: opts.reactivate });
    return 'aborted';
  }
  baselineFresh.delete(folderId);
  if (activeFolderId.value === folderId && !st.currentRel) {
    document.dispatchEvent(new CustomEvent('osv:auto-open'));
  }
  stopTimer(folderId);
  pollTimers.set(folderId, setInterval(() => scan(folderId, false, null, { toast: true }), 10000));
  return 'ok';
}

export async function scan(folderId, initial, signal, opts = {}) {
  const entry = folderEntryFor(folderId);
  const st = folderData.get(folderId);
  const handles = folderHandles.get(folderId);
  if (!entry || !st || !handles || entry.kind !== 'pick') return 'skipped';
  if (scanning.has(folderId)) return 'skipped';
  scanning.add(folderId);
  const active = activeFolderId.value === folderId;
  const cancelled = () => !!(signal && signal.aborted);
  const cancelAction = { cancel: () => { const a = scanAborters.get(folderId); if (a) a.abort(); } };
  if (initial) setLoading('Reading folder…', cancelAction);
  let found = 0, lastUiAt = 0, aborted = false;
  try {
    const current = new Map();
    // rootHandle is already the resolved openspec root, so walking it yields
    // paths relative to openspec/ with no prefix to strip.
    for await (const [rel, handle] of walkDir(handles.rootHandle, '', signal)) {
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

    let changed = false, activeChangedFor = false, corpusChanged = false;
    const hadPrior = st.fileState.size > 0;   // false on the very first scan
    const updates = [];
    const diffsSeen = [];
    let removals = 0;
    const prevUnread = st.recentRels;
    // Rebuilt by this scan, assigned to st.recentRels below. Metadata paths
    // are never unread (see change-monitoring spec) so drop any carried over.
    const nextUnread = new Set([...prevUnread].filter(rel => !isChangeMetadata(rel)));
    for (const [rel, info] of current) {
      if (cancelled()) { aborted = true; break; }
      const prev = st.fileState.get(rel);
      const modified = !prev || prev.lastModified !== info.lastModified;
      if (modified) {
        corpusChanged = true;
        try {
          const text = await handleText(info.handle);
          const snap = await getSnapshot(folderId, rel);
          let changedContent = false;
          if (snap && snap.text !== undefined && snap.text !== text) {
            const d = diffLines(snap.text, text);
            if (d) { st.diffInfo.set(rel, d); diffsSeen.push(rel); changedContent = true; }
            else st.diffInfo.delete(rel);
          } else if (!snap) {
            st.diffInfo.delete(rel);   // first baseline — nothing to diff yet
          }
          let isUnread;
          if (isChangeMetadata(rel)) isUnread = false;
          else if (!snap) isUnread = !baselineFresh.has(folderId);   // fresh picks are read
          else if (changedContent) isUnread = snap.readHash !== hashText(text);
          else isUnread = !!snap.unread;
          if (isUnread) nextUnread.add(rel); else nextUnread.delete(rel);
          await putSnapshot(folderId, rel, {
            rel, text, mtime: info.lastModified,
            readHash: snap ? snap.readHash : undefined,
            unread: isUnread,
          });
        } catch (e) { /* snapshotting unavailable — markers still work */ }
        st.paneCache.delete(rel);
      }
      if (!prev) {
        changed = true;
        if (hadPrior) updates.push(rel);
      } else if (prev.lastModified !== info.lastModified) {
        changed = true;
        if (hadPrior) updates.push(rel);
        if (rel === st.currentRel) activeChangedFor = true;
      }
    }

    for (const rel of [...st.fileState.keys()]) {
      if (cancelled()) { aborted = true; break; }
      if (!current.has(rel)) {
        changed = true;
        corpusChanged = true;
        st.paneCache.delete(rel);
        st.diffInfo.delete(rel);
        nextUnread.delete(rel);
        st.diffViews.delete(rel);
        if (hadPrior) {
          removals++;
          try { await deleteSnapshot(folderId, rel); } catch (e) {}   // drop its diff baseline too
        }
      }
    }

    if (aborted) return 'aborted';   // cancelled: commit nothing; finally clears the overlay

    // The file currently open in the ACTIVE folder was deleted.
    if (active && st.currentRel && !st.fileState.has(st.currentRel) && !current.has(st.currentRel)) {
      st.currentRel = null;
      st.currentKey = null;
      currentRel.value = null;
      currentKey.value = null;
      document.dispatchEvent(new CustomEvent('osv:open-deleted'));
    }

    st.fileState.clear();
    current.forEach((v, k) => st.fileState.set(k, v));
    st.recentRels = nextUnread;

    if (corpusChanged) searchVersion.value++;   // snapshots changed → rebuild the search index

    if (changed) {
      st.files = [...st.fileState.entries()]
        .map(([rel, info]) => ({ rel, handle: info.handle }))
        .sort((a, b) => a.rel.localeCompare(b.rel));
    }

    // Mirror the committed state into the projected signals when this folder
    // is the one on screen; background folders update their rail dot only.
    // The caches are swapped wholesale (they are small and only read by the
    // components at render time, after the events dispatched below).
    if (active) {
      // Swaps first: the signal assignments below re-render the list/pane
      // synchronously, and those renders read the cache maps.
      swapMap(diffInfo, st.diffInfo);
      swapMap(diffViews, st.diffViews);
      swapMap(paneCache, st.paneCache);
      allFiles.value = st.files;
      recentRels.value = st.recentRels;
    }
    folderUnread.value = new Map(folderUnread.value).set(folderId, st.recentRels.size > 0);

    // Notices: background folders are named so the user knows which project
    // changed; the active folder keeps the historical wording.
    if (opts.toast !== false) {
      if (hadPrior && (updates.length || removals)) {
        const added = updates.filter(rel => !prevUnread.has(rel));
        const parts = [];
        if (added.length) parts.push(`${added.length} artifact${added.length === 1 ? '' : 's'} updated`);
        if (removals) parts.push(`${removals} deleted`);
        if (parts.length) showToast((active ? '' : entry.name + ': ') + parts.join(' · '));
      } else if (!hadPrior && diffsSeen.length) {
        // Re-open of the same folder: changes since the last visit surface
        // from persisted snapshots.
        showToast((active ? '' : entry.name + ': ')
          + `${diffsSeen.length} artifact${diffsSeen.length === 1 ? '' : 's'} changed since your last visit`);
      }
    }

    if (changed && st.fileState.size) {
      if (active && activeChangedFor) document.dispatchEvent(new CustomEvent('osv:refresh-current'));
      // A sibling file diffed or a file was deleted: keep the change tabs'
      // diff badges in sync without swapping panes.
      if (active && st.currentKey) document.dispatchEvent(new CustomEvent('osv:refresh-tab-badges'));
    }
  } finally {
    scanning.delete(folderId);
    if (!scanning.size) setLoading(null);   // another folder may still be reading
  }
}

/* ---------- Startup ---------- */

// Restore every persisted folder whose permission is still granted, resume
// monitoring for each, then activate the last-active one. Changes since the
// last visit are reported in ONE aggregated notice; folders with revoked
// permission are listed as skipped (see project-switcher spec).
export async function autoReopen() {
  if (!window.showDirectoryPicker) return;   // upload fallback has no persisted entries
  const entries = await getFolderEntries();
  if (!entries.length) return;
  const granted = [];
  const skipped = [];
  for (const row of entries) {
    if (row.kind !== 'pick') continue;
    const h = row.pickedHandle || row.rootHandle;
    let ok = false;
    try { ok = !!(h && (await h.queryPermission({ mode: 'read' })) === 'granted'); } catch (e) {}
    if (!ok) { skipped.push(row.name); continue; }
    granted.push(row);
  }
  const changedNames = [];
  await Promise.all(granted.map(async (row) => {
    const entry = { id: row.id, name: row.name || 'folder', kind: 'pick', hue: hueFor(row.name || 'folder'), suffix: row.suffix || '' };
    registerFolderState(row.id);
    folderHandles.set(row.id, { pickedHandle: row.pickedHandle, rootHandle: row.rootHandle });
    folderUnread.value = new Map(folderUnread.value).set(row.id, false);
    folders.value = [...folders.value, entry];
    const status = await startMonitoring(row.id, true, { toast: false });
    if (status === 'aborted') return;
    const st = folderData.get(row.id);
    if (st && st.recentRels.size) changedNames.push(row.name || 'folder');
  }));
  // Activate the last-active folder (or the first restored one).
  const ordered = granted.slice().sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
  const target = ordered.find(r => folders.value.some(f => f.id === r.id)) || null;
  if (target) activateFolder(target.id);
  else if (folders.value.length) activateFolder(folders.value[0].id);
  const parts = [];
  if (changedNames.length) parts.push(`${changedNames.join(', ')}: artifacts changed since your last visit`);
  if (skipped.length) parts.push(`${skipped.length} folder${skipped.length === 1 ? '' : 's'} skipped (permission revoked)`);
  if (parts.length) showToast(parts.join(' · '));
}