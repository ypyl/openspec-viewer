// app/store.js — data access: IndexedDB persistence (folder registry +
// content snapshots), File System Access picking/scanning, and on-demand
// folder reads (add, re-open, manual reload).
//
// Multi-folder model (design D1/D3/D4): every folder gets a stable uuid;
// snapshots are keyed by `folderId + '/' + rel` because two folders can
// contain the same relative path. The legacy single-folder handle/snapshots
// migrate into a deterministic `legacy` folder row on the IDB v2→v3 upgrade.
//
// This module owns no DOM. Where a scan needs the pane to react (re-render the
// open file, update tab badges, show a "deleted" notice), it dispatches a
// document-level CustomEvent that the bootstrap (index.js) wires to osv-pane.

import { normPath, isRelevant, isChangeMetadata, groupOf, changeOf, searchTitle, parseGitIdentity, uploadRelation, mayEnterDir } from './model.js';
import { handleText } from './render.js';
import { diffLines, hashText } from './diff.js';
import { pruneHighlights } from './annotations.js';
import {
  folders, activeFolderId, folderUnread, folderData, registerFolderState,
  folderEntryFor, currentFolderId, hueFor, allFiles, recentRels, searchVersion,
  diffInfo, diffViews, paneCache, currentRel, currentKey, navDrawerOpen,
  collapsed, GROUPS,
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

// Acknowledge every unread artifact in the active folder at once (the
// sidebar's "Mark all as read" control). Each unread artifact is marked read
// against its current content, then the folder's unread set and the signals
// derived from it are cleared. Returns how many artifacts were acknowledged.
export async function markAllRead() {
  const folderId = activeFolderId.value;
  const st = folderId ? folderData.get(folderId) : null;
  if (!st || !st.recentRels.size) return 0;
  const rels = [...st.recentRels];
  for (const rel of rels) {
    try { await markRead(rel, hashText(await readFileText(rel)), folderId); }
    catch (e) { /* non-fatal */ }
  }
  st.recentRels = new Set();
  recentRels.value = st.recentRels;
  folderUnread.value = new Map(folderUnread.value).set(folderId, false);
  // The pane's tab badges and diff toggle are imperative, not reactive.
  document.dispatchEvent(new CustomEvent('osv:refresh-tab-badges'));
  showToast(`Marked ${rels.length} artifact${rels.length === 1 ? '' : 's'} as read`);
  return rels.length;
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
// return its display entry. Captures the folder identity once, at open time
// (show-folder-identity D1/D2/D3): the pick relation ('repo' when the picked
// folder resolved to its openspec/ child, 'root' when it is itself an openspec
// root) and — for repo picks with a readable .git — the origin URL + branch,
// best-effort: any read failure yields git: null and never blocks the folder.
async function registerPickFolder(handle, root) {
  const id = genId();
  const name = handle.name || 'folder';
  const relation = root === handle ? 'root' : 'repo';
  let git = null;
  if (relation === 'repo') {
    try {
      const gitDir = await handle.getDirectoryHandle('.git');
      const [config, head] = await Promise.all([
        (await (await gitDir.getFileHandle('config')).getFile()).text(),
        (await (await gitDir.getFileHandle('HEAD')).getFile()).text(),
      ]);
      git = parseGitIdentity(config, head);
    } catch (e) { git = null; }
  }
  const entry = { id, name, kind: 'pick', relation, git, hue: hueFor(name), suffix: nameSuffix(name) };
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
  navDrawerOpen.value = false; // any folder activation dismisses the drawer
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
  // in the picker), e.g. 'my-repo/openspec/...' -> 'my-repo'. Pick relation
  // from the uploaded paths (show-folder-identity D2): a segment after the
  // first equal to 'openspec' means a repo root was uploaded. Uploads are
  // session-only so they never carry git identity.
  const uploadPaths = files.map(f => f.webkitRelativePath || f.name);
  const base = uploadPaths[0].split('/')[0] || 'upload';
  const id = genId();
  const entry = {
    id, name: base, kind: 'upload', git: null,
    relation: uploadRelation(uploadPaths),
    hue: hueFor(base), suffix: nameSuffix(base),
  };
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

// Close = forget: remove from the rail, stop reading, delete persisted
// snapshots + folder row. When the closed folder was active, the next folder
// down the rail becomes active (or `opts.reactivate`, e.g. after cancelling
// a folder add — see spec change-monitoring "Cancel an in-progress folder
// read").
export async function closeFolder(folderId, opts = {}) {
  const idx = folders.value.findIndex(f => f.id === folderId);
  if (idx < 0 && !folderData.has(folderId)) return;
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

/* ---------- Folder reads (per folder) ---------- */

const scanning = new Set();       // folderIds mid-scan (overlap guard)
const scanAborters = new Map();   // folderId -> AbortController (reads are cancellable)
const baselineFresh = new Set();  // folderIds whose NEXT scan is a fresh baseline (nothing is new)
const folderHandles = new Map();  // id -> { pickedHandle, rootHandle }

async function* walkDir(dir, prefix, signal, mayEnter) {
  for await (const entry of dir.values()) {
    if (signal && signal.aborted) return;
    if (entry.kind === 'directory') {
      const p = prefix + entry.name + '/';
      if (mayEnter && !mayEnter(p)) continue;   // prune subtrees outside the read scope
      yield* walkDir(entry, p, signal, mayEnter);
    } else {
      yield [prefix + entry.name, entry];
    }
  }
}

// How many files a scoped read stats at once. Bounded so a slow share is not
// flooded, but >1 so the round trips overlap instead of queueing.
const STAT_CONCURRENCY = 8;

// Read lastModified for each [rel, handle] with bounded concurrency. A slow
// filesystem (WSL/9p, network shares) pays one round trip per file; running a
// few at a time overlaps that latency. Files that fail to stat are skipped.
async function statEntries(entries, signal, onProgress) {
  const out = new Map();
  for (let i = 0; i < entries.length; i += STAT_CONCURRENCY) {
    if (signal && signal.aborted) break;
    const chunk = entries.slice(i, i + STAT_CONCURRENCY);
    const stats = await Promise.all(chunk.map(async ([rel, handle]) => {
      try {
        const file = await handle.getFile();
        return [rel, { handle, lastModified: file.lastModified }];
      } catch (e) { return null; }
    }));
    for (const s of stats) if (s) out.set(s[0], s[1]);
    if (onProgress) onProgress(out.size);
  }
  return out;
}

// Run the initial read for a folder. `keepSnapshots` treats it as
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
  return 'ok';
}

// The groups a reload should read: every expanded group, plus the group of the
// artifact/change currently open (so what is on screen stays current).
function activeReadScope(st) {
  const scope = new Set(GROUPS.filter(g => !collapsed.value.has(g)));
  if (st && st.currentRel) scope.add(groupOf(st.currentRel));
  if (st && st.currentKey) scope.add(groupOf(st.currentKey));
  scope.delete(null);
  return scope;
}

// Rescan the active folder on demand (the header's Reload control). Only the
// active folder is read; every other open folder keeps the state from its own
// last scan. The read is scoped to the groups the user is viewing (see
// change-monitoring "Read only the groups being viewed"). Session-only uploads
// have no folder to re-read, so they no-op. `initial: true` shows the reading
// overlay, whose cancel aborts this read.
export async function reloadActiveFolder() {
  const id = activeFolderId.value;
  const entry = id && folderEntryFor(id);
  if (!entry || entry.kind !== 'pick') return;
  const abort = new AbortController();
  scanAborters.set(id, abort);
  try {
    await scan(id, true, abort.signal, { toast: true, groups: activeReadScope(folderData.get(id)) });
  } finally {
    scanAborters.delete(id);
  }
}

// Read one group of the active folder. Called when the user expands a collapsed
// group, so what is shown reflects the folder's current contents. Quiet — the
// group simply appears; the reading indicator covers the wait.
export async function readActiveGroup(group) {
  const id = activeFolderId.value;
  const entry = id && folderEntryFor(id);
  if (!entry || entry.kind !== 'pick' || !group) return;
  const abort = new AbortController();
  scanAborters.set(id, abort);
  try {
    await scan(id, true, abort.signal, { toast: false, groups: new Set([group]) });
  } finally {
    scanAborters.delete(id);
  }
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
  let lastUiAt = 0, aborted = false;
  // Read scope: the groups this read walks. Default is every group (a folder's
  // first read); a reload narrows it to the viewed groups and an expand to one
  // (see change-monitoring "Read only the groups being viewed").
  const scope = opts.groups instanceof Set ? opts.groups : new Set(GROUPS);
  const mayEnter = (p) => mayEnterDir(p, scope);
  const inScope = (rel) => scope.has(groupOf(rel));
  try {
    // 1. Enumerate the in-scope files, pruning subtrees outside the scope.
    // rootHandle is already the resolved openspec root, so walking it yields
    // paths relative to openspec/ with no prefix to strip.
    const entries = [];
    for await (const [rel, handle] of walkDir(handles.rootHandle, '', signal, mayEnter)) {
      if (cancelled()) { aborted = true; break; }
      if (!isRelevant(rel) || !inScope(rel)) continue;
      entries.push([rel, handle]);
    }
    if (aborted) return 'aborted';

    // 2. Stat them with bounded concurrency (progress for big folders).
    const current = await statEntries(entries, signal, (n) => {
      if (!initial) return;
      const now = performance.now();
      if (now - lastUiAt > 150) {
        lastUiAt = now;
        setLoading(`Reading folder… ${n} files`, cancelAction);
      }
    });
    if (cancelled()) return 'aborted';

    // 3. Diff/unread for the walked files only. Rels in unwalked groups keep
    // their entries, diffs, unread, and counters.
    const scopePrior = [...st.fileState.keys()].filter(inScope);
    const hadPrior = scopePrior.length > 0;   // false on the very first read
    let changed = false, activeChangedFor = false, corpusChanged = false;
    const updates = [];
    const diffsSeen = [];
    let removals = 0;
    const prevUnread = st.recentRels;
    // Rebuilt for the walked groups, assigned to st.recentRels below; unwalked
    // groups keep their unread. Metadata paths are never unread (see
    // change-monitoring spec) so drop any carried over.
    const nextUnread = new Set([...prevUnread].filter(rel => !isChangeMetadata(rel) && !inScope(rel)));
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

    // Removals are only detectable within the walked groups.
    for (const rel of scopePrior) {
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

    // Merge: keep unwalked groups' entries, replace the walked groups'.
    const merged = new Map();
    for (const [rel, info] of st.fileState) if (!inScope(rel)) merged.set(rel, info);
    for (const [rel, info] of current) merged.set(rel, info);
    st.fileState = merged;
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
    const entry = { id: row.id, name: row.name || 'folder', kind: 'pick', relation: row.relation, git: row.git || null, hue: hueFor(row.name || 'folder'), suffix: row.suffix || '' };
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