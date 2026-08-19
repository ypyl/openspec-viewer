// app/state.js — application state.
//
// All reactive state lives in tiny-signals here and is imported directly by
// the components and logic modules (see design.md: we use a shared signals
// module rather than tiny-context for cross-component state — the app is one
// page, one flat layout, and no component is reusable outside it).
//
// Non-reactive, module-scoped data (diff/pane caches, the open tabs array)
// is also centralised here so components don't each hold a copy.

import { signal, computed } from '../imports.js';
import { changeOf, prettyChangeName } from './model.js';

/* ---------- Reactive state (tiny-signals) ---------- */

export const theme = signal('system');   // 'dark' | 'light' | 'system'
try {
  const t = localStorage.getItem('osviewer.theme');
  if (t === 'dark' || t === 'light') theme.value = t;
} catch (e) {}

export const allFiles = signal([]);    // [{ rel, handle }] handle = FileSystemFileHandle (monitored) or File (one-shot)
export const currentRel = signal(null); // selected artifact
export const currentKey = signal(null); // selected change (active or archived)
export const dirHandle = signal(null);  // FileSystemDirectoryHandle being monitored
export const recentRels = signal(new Set()); // rels with unacknowledged changes, keyed to the persisted readHash

// Archive is collapsed by default on first visit; the persisted choice lives in the signal.
let storedCollapsed = null;
try { storedCollapsed = localStorage.getItem('osviewer.collapsed'); } catch (e) {}
export const collapsed = signal(new Set(storedCollapsed === null ? ['Archive'] : safeParseCollapsed(storedCollapsed)));

export const search = signal('');
export const highlights = signal(new Map()); // rel -> [{ id, start, end, text, comment, ts, rel, lines }]
export const staleTick = signal(0);          // bumped after a file renders so stale checks re-run on the right content

function safeParseCollapsed(v) {
  try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

/* ---------- Non-reactive shared data (mutate via methods / setters) ---------- */

export const GROUPS = ['Changes', 'Specs', 'Archive', 'Config'];

export const fileState = new Map();  // rel -> { handle, lastModified } snapshot for change detection
export const paneCache = new Map();  // rel -> rendered pane HTML
export const diffInfo = new Map();   // rel -> { hunks, added, removed, ts, hash } line diff vs last snapshot
export const diffViews = new Map();  // rel -> true when the pane shows the diff view instead of the artifact

// Tabs in the open change view (imperative, not reactive). Importers read this
// live binding; replace it via setCurrentTabs.
export let currentTabs = [];
export function setCurrentTabs(t) { currentTabs = t; }

// Project path prefix for prompts and uploaded files, e.g. 'llmclip/openspec/' or 'openspec/'.
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
