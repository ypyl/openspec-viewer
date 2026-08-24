// app/state.js — application state.
//
// The view signals components import directly (allFiles, currentRel,
// recentRels, ...) are PROJECTIONS of the active folder. All authoritative
// per-folder runtime data lives in `folderData` (Map<folderId, folderState>);
// the activeFolderId effect mirrors the active folder into the view signals
// and swaps the shared caches, so components keep reading the same symbols
// they always did (design D1). Persisted per-folder UI state (highlights,
// collapsed groups) is hydrated from localStorage on switch. Selection and
// unread writes flow back to folderData through write-back effects.

import { signal, computed } from '../imports.js';
import { changeOf, prettyChangeName } from './model.js';

/* ---------- Theme (global, not per folder) ---------- */

export const theme = signal('system');   // 'dark' | 'light' | 'system'
try {
  const t = localStorage.getItem('osviewer.theme');
  if (t === 'dark' || t === 'light') theme.value = t;
} catch (e) {}

/* ---------- Mobile navigation drawer (global, in-memory) ---------- */

// Whether the slide-over navigation drawer (folder rail + artifact list) is
// open on narrow screens. In-memory only: always starts closed, is never
// persisted, and is closed automatically when a folder or artifact is picked.
export const navDrawerOpen = signal(false);

/* ---------- Folder registry ---------- */

// Reactive folder list: [{ id, name, kind, hue, suffix }] in add order.
// `kind` is 'pick' (File System Access, persisted + monitored) or 'upload'
// (webkitdirectory fallback, session-only). `hue` is the avatar color;
// `suffix` disambiguates same-named projects (#2, #3 ...).
export const folders = signal([]);
export const activeFolderId = signal(null);
// id -> boolean: does the folder have any unacknowledged change right now?
// Updated by store.js after every scan; drives the rail's unread dots.
export const folderUnread = signal(new Map());

// Authoritative per-folder runtime state, keyed by stable folder id (uuid,
// never a display name — renames keep snapshots). Contains the files list,
// unread set, selection, open-change tabs, and the non-reactive caches.
export const folderData = new Map();

export function currentFolderId() { return activeFolderId.value; }

export function activeState() {
  return activeFolderId.value ? folderData.get(activeFolderId.value) : null;
}

export function folderEntryFor(id) {
  return folders.value.find(f => f.id === id) || null;
}

export function activeFolderEntry() {
  return activeFolderId.value ? folderEntryFor(activeFolderId.value) : null;
}

export function createFolderState() {
  return {
    files: [],                 // [{ rel, handle }] sorted
    currentRel: null,          // selected artifact
    currentKey: null,          // selected change (active or archived)
    recentRels: new Set(),     // rels with unacknowledged changes
    fileState: new Map(),      // rel -> { handle, lastModified } change-detection snapshot
    paneCache: new Map(),      // rel -> rendered pane HTML
    diffInfo: new Map(),       // rel -> { hunks, added, removed, ts, hash }
    diffViews: new Map(),      // rel -> true when the pane shows the diff view
    currentTabs: [],           // open change view tabs
  };
}

export function registerFolderState(id) {
  if (!folderData.has(id)) folderData.set(id, createFolderState());
  return folderData.get(id);
}

// Deterministic avatar hue (0-360) from a project name, so same-letter
// projects stay visually distinct.
export function hueFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

/* ---------- Projected view signals (active folder) ---------- */

export const allFiles = signal([]);      // active folder's [{ rel, handle }]
export const currentRel = signal(null);  // selected artifact
export const currentKey = signal(null);  // selected change
export const dirHandle = signal(null);   // active folder's openspec root handle (null for uploads)
export const recentRels = signal(new Set()); // active folder's unread rels
export const collapsed = signal(new Set());  // active folder's collapsed groups
export const highlights = signal(new Map()); // active folder's review items (hydrated on switch)
export const staleTick = signal(0);          // bumped after a file renders so stale checks re-run
export const searchVersion = signal(0);      // bumped whenever the folder's contents could have changed
export const searchMarks = signal(new Map()); // transient search-match ranges (not persisted)

// Session-only review-guidance state (never persisted; cleared on folder
// switch — design D3/D4). expandedStripKinds: guide kinds whose red flags the
// user expanded; checklistTicks: change key -> Set of checked checklist indices.
export const expandedStripKinds = signal(new Set());
export const checklistTicks = signal(new Map());
export const checklistCollapsed = signal(false);

export const search = signal('');       // sidebar name filter — resets on folder switch

// The shared non-reactive caches — mirrors of the active folder's maps
// (swapped on switch; writes go through paneCachePut / setDiffView).
export const fileState = new Map();   // (kept for import compat; store.js uses folderData)
export const paneCache = new Map();
export const diffInfo = new Map();
export const diffViews = new Map();

// Tabs in the open change view (imperative, not reactive). Live binding for
// importers; setCurrentTabs also writes the active folder's copy.
export let currentTabs = [];
export function setCurrentTabs(t) {
  currentTabs = t;
  const st = activeState();
  if (st && st.currentTabs !== t) st.currentTabs = t;
}

// Project path prefix for prompts and uploaded files: 'openspec/' for a
// single folder, '<project>/openspec/' once more than one is open (design D6).
export let storePrefix = '';
export function setStorePrefix(p) { storePrefix = p; }

/* ---------- Derived state ---------- */

export const changeMeta = computed(() => {
  const m = new Map();
  const byKey = new Map();
  for (const f of allFiles.value) {
    const key = changeOf(f.rel);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(f);
  }
  for (const [key, files] of byKey) {
    const dir = key.split('/').pop();
    const { label, date } = prettyChangeName(dir);
    const proposal = files.find(f => f.rel.endsWith('/proposal.md'));
    m.set(key, { key, dir, label, date, proposalRel: proposal ? proposal.rel : null, files });
  }
  return m;
}, [allFiles]);

/* ---------- Per-folder persisted view state (localStorage) ---------- */

const LEGACY_FOLDER_ID = 'legacy';

// First-visit default: Archive and Config collapsed, like the pre-multi-folder
// app. The user's per-folder choice lives at osviewer.collapsed.<id>.
function loadCollapsed(id) {
  try {
    const v = localStorage.getItem('osviewer.collapsed.' + id);
    if (v !== null) {
      const a = JSON.parse(v);
      return new Set(Array.isArray(a) ? a.filter(x => typeof x === 'string') : []);
    }
  } catch (e) {}
  return new Set(['Archive', 'Config']);
}

// One-time migration of the pre-multi-folder collapse key into the legacy
// folder slot, so returning users keep their choice.
function migrateLegacyKeys() {
  try {
    const old = localStorage.getItem('osviewer.collapsed');
    if (old === null) return;
    if (localStorage.getItem('osviewer.collapsed.' + LEGACY_FOLDER_ID) === null) {
      localStorage.setItem('osviewer.collapsed.' + LEGACY_FOLDER_ID, old);
    }
    localStorage.removeItem('osviewer.collapsed');
  } catch (e) {}
}
migrateLegacyKeys();

export { LEGACY_FOLDER_ID };

/* ---------- Projection ---------- */

function swapMap(dst, src) {
  dst.clear();
  src.forEach((v, k) => dst.set(k, v));
}

function qualifyPrefix(entry) {
  return folders.value.length < 2 ? 'openspec/' : entry.name + '/openspec/';
}

// Mirror folderData[id] into the view signals. Called by the activeFolderId
// effect on switch and by store.js after a scan of the ACTIVE folder.
export function syncProjection(id) {
  const st = folderData.get(id);
  if (!st) return;
  const entry = folderEntryFor(id);
  allFiles.value = st.files;
  currentRel.value = st.currentRel;
  currentKey.value = st.currentKey;
  recentRels.value = st.recentRels;
  dirHandle.value = entry && entry.kind === 'pick' ? entry.rootHandle : null;
  swapMap(fileState, st.fileState);
  swapMap(paneCache, st.paneCache);
  swapMap(diffInfo, st.diffInfo);
  swapMap(diffViews, st.diffViews);
  setCurrentTabs(st.currentTabs);
  collapsed.value = loadCollapsed(id);
  search.value = '';
  searchMarks.value = new Map();
  setStorePrefix(entry ? qualifyPrefix(entry) : '');
  folderUnread.value = new Map(folderUnread.value).set(id, st.recentRels.size > 0);
}

// Clear the view signals to the pre-pick defaults (no active folder).
function clearProjection() {
  allFiles.value = [];
  currentRel.value = null;
  currentKey.value = null;
  recentRels.value = new Set();
  dirHandle.value = null;
  fileState.clear();
  paneCache.clear();
  diffInfo.clear();
  diffViews.clear();
  setCurrentTabs([]);
  collapsed.value = new Set();
  search.value = '';
  searchMarks.value = new Map();
  setStorePrefix('');
}

// The projection effect: swap the view to the newly active folder (or clear
// it when none is active) and tell the imperative surfaces to re-render.
activeFolderId.effect(() => {
  const id = activeFolderId.value;
  // The guide state is session-scoped per folder, so switching folders (or
  // closing the last one) resets both signals; reloads reset them implicitly.
  expandedStripKinds.value = new Set();
  checklistTicks.value = new Map();
  checklistCollapsed.value = false;
  if (!id) { clearProjection(); }
  else syncProjection(id);
  // Fire even when the last folder is closed (id null) so the imperative
  // surfaces (pane, file list, search) reset to their no-folder state.
  document.dispatchEvent(new CustomEvent('osv:folder-switched', { detail: { id } }));
});

/* ---------- Write-back effects (no projection drift) ---------- */

// Any direct write to the projected selection/unread signals (pane, list)
// flows back into the active folder's folderState. The guards prevent a loop
// when syncProjection mirrors folderState back into the signals.
currentRel.effect(() => {
  const st = activeState();
  if (st && st.currentRel !== currentRel.value) st.currentRel = currentRel.value;
});
currentKey.effect(() => {
  const st = activeState();
  if (st && st.currentKey !== currentKey.value) st.currentKey = currentKey.value;
});
recentRels.effect(() => {
  const id = activeFolderId.value;
  const st = activeState();
  if (st && st.recentRels !== recentRels.value) st.recentRels = recentRels.value;
  if (id && folderUnread.value.get(id) !== (recentRels.value.size > 0)) {
    folderUnread.value = new Map(folderUnread.value).set(id, recentRels.value.size > 0);
  }
});

/* ---------- Write-through helpers for the shared caches ---------- */

// osv-pane caches rendered HTML per artifact; write into both the active
// folder's folderState and the projected map so a switch-back stays instant.
export function paneCachePut(rel, html) {
  const st = activeState();
  if (st) st.paneCache.set(rel, html);
  paneCache.set(rel, html);
}

export function setDiffView(rel, v) {
  const st = activeState();
  if (st) st.diffViews.set(rel, v);
  diffViews.set(rel, v);
}

/* ---------- Non-reactive shared data (unchanged) ---------- */

export const GROUPS = ['Changes', 'Specs', 'Archive', 'Config'];
