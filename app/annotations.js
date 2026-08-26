// app/annotations.js — text selection → highlight → comment flow, and the
// review panel's list builder.
//
// The pane renders into light DOM and calls applyHighlights() after each
// render (the design's `onRendered` hook lives in osv-pane). Selection and
// scroll listeners are attached by osv-pane to its <main>. Cross-component
// actions (open/focus the review drawer, reveal a comment) go out as
// document-level CustomEvents that index.js wires to the components.

import { html } from '../imports.js';
import { highlights, currentRel, staleTick, allFiles, searchMarks, activeFolderId, LEGACY_FOLDER_ID } from './state.js';
import { refLines, snippet } from './render.js';
import { readFileText } from './store.js';
import { showToast } from '../components/osv-toast/osv-toast.js';

/* ---------- Persistence (per folder, localStorage) ---------- */

const KEY = (id) => 'osviewer.highlights.' + id;

// One-time migration of the pre-multi-folder key (rel-keyed, single folder)
// into the legacy folder slot, so returning users keep their review items.
function migrateLegacyHighlights() {
  try {
    const old = localStorage.getItem('osviewer.highlights');
    if (old === null) return;
    if (localStorage.getItem(KEY(LEGACY_FOLDER_ID)) === null) localStorage.setItem(KEY(LEGACY_FOLDER_ID), old);
    localStorage.removeItem('osviewer.highlights');
  } catch (e) {}
}

function readHighlights(id) {
  try {
    const obj = JSON.parse(localStorage.getItem(KEY(id)) || '{}');
    const m = new Map();
    for (const [rel, list] of Object.entries(obj)) {
      if (Array.isArray(list)) m.set(rel, list);
    }
    return m;
  } catch (e) { return new Map(); }
}

// Boot: hydrate the active folder's items; before any folder is open this is
// the legacy folder (pre-multi-folder data).
export function loadHighlights() {
  migrateLegacyHighlights();
  highlights.value = readHighlights(activeFolderId.value || LEGACY_FOLDER_ID);
}

// Folder switch: hydrate the newly active folder's review items.
export function loadHighlightsForActive() {
  migrateLegacyHighlights();
  highlights.value = readHighlights(activeFolderId.value);
}

function persistHighlights() {
  const id = activeFolderId.value;
  if (!id) return;
  try {
    const obj = {};
    for (const [rel, list] of highlights.value) if (list.length) obj[rel] = list;
    localStorage.setItem(KEY(id), JSON.stringify(obj));
  } catch (e) {}
}

// Replace the highlights for one artifact; new Map so the signal fires.
export function setHighlights(rel, list) {
  const m = new Map(highlights.value);
  if (list.length) m.set(rel, list); else m.delete(rel);
  highlights.value = m;
  persistHighlights();
}

// Drop highlights whose artifact no longer exists (new folder / reload).
export function pruneHighlights() {
  const m = new Map();
  for (const [rel, list] of highlights.value) {
    if (allFiles.value.some(f => f.rel === rel)) m.set(rel, list);
  }
  highlights.value = m;
  persistHighlights();
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* ---------- Selection → floating toolbar ---------- */

let annBubble = null;   // floating selection toolbar / comment editor
let annPending = null;  // { start, end, text } awaiting a comment
let annRange = null;    // selection Range the bubble is tethered to
let annWhole = false;   // selection is on the change title → whole-file comment

const paneEl = () => document.querySelector('osv-pane');

function findAnnContainer(range) {
  const cNode = range.commonAncestorContainer;
  const cEl = cNode.nodeType === 1 ? cNode : cNode.parentElement;
  const container = cEl && cEl.closest('.annotatable');
  if (!container) return null;
  const startEl = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
  const endEl = range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement;
  if (!container.contains(startEl) || !container.contains(endEl)) return null;
  return container;
}

// Character offset of a boundary (node, offset) within root's text content.
// Counts text nodes directly (never Range.toString) so <br> and element
// boundaries don't shift offsets.
function textInSubtree(node) {
  if (node.nodeType === 3) return node.data.length;   // tree walker skips its own root
  let count = 0;
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) count += n.data.length;
  return count;
}
function textOffsetAt(root, node, offset) {
  if (node === root && node.nodeType === 1) {           // boundary at the container itself
    const before = node.childNodes[offset - 1];
    return before ? textInSubtree(before) : 0;
  }
  const w = document.createNodeIterator(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let acc = 0, n;
  while ((n = w.nextNode())) {
    if (n === node) {
      if (n.nodeType === 3) return acc + Math.min(offset, n.data.length);
      const before = n.childNodes[offset - 1];
      return acc + (before ? textInSubtree(before) : 0);
    }
    if (n.nodeType === 3) acc += n.data.length;
  }
  return acc;
}
function selOffsets(container, range) {
  const start = textOffsetAt(container, range.startContainer, range.startOffset);
  const end = textOffsetAt(container, range.endContainer, range.endOffset);
  const text = container.textContent.slice(start, end);
  return { start, end, text };
}

export function hideAnnBubble() {
  if (annBubble) { annBubble.remove(); annBubble = null; }
  annPending = null;
  annWhole = false;
}

// A selection wholly inside the change title (the change-head <h2>) — the
// trigger for a whole-file (kind:'file') comment, distinct from the .annotatable
// range flow (design D3).
function findTitleContainer(range) {
  const cNode = range.commonAncestorContainer;
  const cEl = cNode.nodeType === 1 ? cNode : cNode.parentElement;
  const title = cEl && cEl.closest('.change-title');
  if (!title) return null;
  const startEl = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
  const endEl = range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement;
  if (!title.contains(startEl) || !title.contains(endEl)) return null;
  return title;
}

function onSelect() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (findTitleContainer(range)) { showAnnBubble(range, null, true); return; }
  const container = findAnnContainer(range);
  if (!container) return;
  const info = selOffsets(container, range);
  if (!info.text.trim()) return;
  showAnnBubble(range, info, false);
}

// Gap between the bubble and its anchor, matching the original spacing.
const BUBBLE_GAP = 8;

// Place the comment bubble within the viewport, preferring to sit just below
// the selection and flipping above it when there is not enough room below.
// Also clamps horizontally using the bubble's measured size. The bubble is
// position:fixed, so rect is viewport-relative and no offset math is needed.
function positionBubble(bub, range) {
  const rect = range.getBoundingClientRect();
  const w = bub.offsetWidth;
  const h = bub.offsetHeight;
  let top;
  if (rect.bottom + BUBBLE_GAP + h <= innerHeight) {
    top = rect.bottom + BUBBLE_GAP;
  } else {
    top = Math.max(BUBBLE_GAP, rect.top - h - BUBBLE_GAP);
  }
  const left = Math.max(BUBBLE_GAP, Math.min(rect.left, innerWidth - w - BUBBLE_GAP));
  bub.style.left = left + 'px';
  bub.style.top = top + 'px';
}

function showAnnBubble(range, info, whole) {
  hideAnnBubble();
  annWhole = whole;
  const bub = document.createElement('div');
  bub.className = 'ann-bubble';
  bub.innerHTML = '<button type="button" class="ann-add">💬 Comment</button>';
  // Append before positioning so offsetWidth/offsetHeight are measurable; the
  // bubble is position:fixed, so appending causes no layout reflow.
  const host = paneEl() || document.body;
  host.appendChild(bub);
  positionBubble(bub, range);
  annBubble = bub;
  annPending = info;
  annRange = range;
  bub.querySelector('.ann-add').addEventListener('click', () => {
    const placeholder = annWhole ? 'Add a comment about the whole artifact…' : 'Add a comment…';
    bub.innerHTML = `
      <textarea class="ann-text" rows="3" placeholder="${placeholder}"></textarea>
      <div class="ann-actions">
        <button type="button" class="ann-cancel">Cancel</button>
        <button type="button" class="ann-save">Save comment</button>
      </div>`;
    // The editor is taller than the single "Comment" button; recompute the
    // position against the expanded height so the actions stay in view (flips
    // above the anchor near the bottom of the viewport).
    if (annRange) positionBubble(bub, annRange);
    bub.querySelector('.ann-cancel').addEventListener('click', hideAnnBubble);
    bub.querySelector('.ann-save').addEventListener('click', saveAnnComment);
    const ta = bub.querySelector('.ann-text');
    ta.focus();
    ta.addEventListener('keydown', e => {
      // Enter saves (Ctrl/Cmd+Enter too); Shift+Enter inserts a newline.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveAnnComment();
      }
      if (e.key === 'Escape') hideAnnBubble();
    });
  });
}

async function saveAnnComment() {
  if (annWhole) { saveWholeFileComment(); return; }
  const rel = currentRel.value;
  if (!rel || !annPending) return;
  const ta = annBubble && annBubble.querySelector('.ann-text');
  const comment = ta ? ta.value.trim() : '';
  const { start, end, text } = annPending;
  const list = highlights.value.get(rel) || [];
  if (list.some(h => h.start < end && start < h.end)) {
    showToast('Selection overlaps an existing highlight', 'error');
    hideAnnBubble();
    return;
  }
  // Store the file path and the raw lines referencing the text so the
  // highlight can be re-anchored after a reload.
  let lines = [];
  try { lines = refLines(await readFileText(rel), text); } catch (e) {}
  list.push({ id: uid(), start, end, text, comment, ts: Date.now(), rel, lines });
  setHighlights(rel, list);
  hideAnnBubble();
  try { window.getSelection().removeAllRanges(); } catch (e) {}
  applyHighlights(rel);
  showToast(comment ? 'Comment added' : 'Highlight added');
}

// Whole-file comment from a change-title selection. No range is stored; it
// targets the artifact currently open under the title. Nothing is written when
// no artifact is active (design D2/D3).
function saveWholeFileComment() {
  const rel = currentRel.value;
  const ta = annBubble && annBubble.querySelector('.ann-text');
  const comment = ta ? ta.value.trim() : '';
  if (!rel) {
    showToast('No artifact is open to comment on', 'error');
  } else if (comment) {
    saveFileComment(rel, comment);
    showToast('Comment added');
  }
  hideAnnBubble();
  try { window.getSelection().removeAllRanges(); } catch (e) {}
}

// Append a whole-file (entire-artifact) review comment. Not anchored to a text
// range (kind:'file'), so it has no start/end/text/lines and never goes stale.
export function saveFileComment(rel, comment) {
  if (!rel || !comment) return;
  const list = highlights.value.get(rel) || [];
  list.push({ kind: 'file', id: uid(), comment, ts: Date.now(), rel });
  setHighlights(rel, list);
}

/* ---------- Applying highlight marks ---------- */

function findTextNodeAt(root, offset) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n, acc = 0, last = null;
  while ((n = w.nextNode())) {
    last = n;
    if (acc + n.data.length > offset) return [n, offset - acc];
    acc += n.data.length;
  }
  if (last && offset === acc) return [last, last.data.length];
  return null;
}

function wrapTextNode(node, from, to, cls, h) {
  if (to <= from) return;
  const mark = document.createElement('mark');
  mark.className = cls;
  if (h) {
    mark.dataset.id = h.id;
    mark.title = h.comment || 'Highlight';
    mark.addEventListener('click', () => focusComment(h.id));
  }
  const text = node.data;
  const frag = document.createDocumentFragment();
  if (from > 0) frag.appendChild(document.createTextNode(text.slice(0, from)));
  mark.appendChild(document.createTextNode(text.slice(from, to)));
  frag.appendChild(mark);
  if (to < text.length) frag.appendChild(document.createTextNode(text.slice(to)));
  node.parentNode.replaceChild(frag, node);
}

// The text nodes intersecting [start, end), each with the sub-range to wrap.
// Collected first, then mutated, so the live NodeIterator never revisits the
// fragment nodes we insert (which caused an infinite wrap loop). A <mark>
// never spans a block boundary (that would nest a <li> inside <mark> and break
// the DOM) because each intersecting text node is wrapped on its own.
function rangeNodes(container, start, end) {
  const sn = findTextNodeAt(container, start);
  const en = findTextNodeAt(container, end);
  if (!sn || !en) return null;
  const nodes = [];
  if (sn[0] === en[0]) {
    nodes.push({ node: sn[0], from: sn[1], to: en[1] });
  } else {
    const w = document.createNodeIterator(container, NodeFilter.SHOW_TEXT);
    let n, seen = false;
    while ((n = w.nextNode())) {
      if (n === sn[0]) seen = true;
      if (!seen) continue;
      nodes.push({
        node: n,
        from: n === sn[0] ? sn[1] : 0,
        to: n === en[0] ? en[1] : n.data.length,
      });
      if (n === en[0]) break;
    }
  }
  return nodes;
}

function wrapHighlight(container, h) {
  const t = container.textContent;
  if (!h.text || h.start < 0 || h.end > t.length || h.start >= h.end) return null;
  let start = h.start, end = h.end;
  // Re-anchor when the file changed and the old offsets no longer line up.
  if (t.slice(start, end) !== h.text) {
    const idx = t.indexOf(h.text);
    if (idx === -1) return null;
    start = idx;
    end = idx + h.text.length;
    h.start = start;
    h.end = end;
  }
  const nodes = rangeNodes(container, start, end);
  if (!nodes) return null;
  for (const p of nodes) wrapTextNode(p.node, p.from, p.to, 'hl', h);
  return nodes.length ? nodes[0].node : null;
}

// Transient search marks: same range machinery, distinct class, no persistence
// and no click/review behavior. Offsets are relative to the artifact's raw text.
function wrapSearchRange(container, start, end) {
  const t = container.textContent;
  if (start < 0 || end > t.length || start >= end) return null;
  const nodes = rangeNodes(container, start, end);
  if (!nodes) return null;
  for (const p of nodes) wrapTextNode(p.node, p.from, p.to, 'sq', null);
  return nodes.length ? nodes[0].node : null;
}

function unwrapMark(mark) {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
}

// Re-apply highlights for one artifact after a render. Looks up the pane's
// .annotatable element (the onRendered hook is the pane calling this).
export function applyHighlights(rel) {
  const pane = paneEl();
  const container = pane && pane.querySelector('.annotatable');
  if (!container) return;
  container.querySelectorAll('mark.sq').forEach(unwrapMark);
  container.querySelectorAll('mark.hl').forEach(unwrapMark);
  for (const h of highlights.value.get(rel) || []) wrapHighlight(container, h);
  for (const [s, e] of searchMarks.value.get(rel) || []) wrapSearchRange(container, s, e);
  // The open file has now been rendered; re-check staleness against it.
  // (Signals update synchronously, so without this the review panel would
  //  compare against the previous file's content right after a switch.)
  staleTick.value++;
}

// Drop all transient search marks (e.g. when the search query is cleared).
export function clearSearchMarks() { searchMarks.value = new Map(); }

/* ---------- Review coordination ---------- */

// Clicking a mark in the pane focuses the matching review item.
export function focusComment(id) {
  document.dispatchEvent(new CustomEvent('osv:focus-review', { detail: { id } }));
}

// Jump from a review item to the text in the file, opening it first if needed.
export function revealComment(rel, id) {
  document.dispatchEvent(new CustomEvent('osv:reveal', { detail: { rel, id } }));
}

// A highlight is stale only when its referenced text is absent from the
// currently rendered view of its file. Compare against the rendered text
// (not the raw markdown) so formatting like bullets, bold and code still
// matches after a reload. Only the open file can be checked this way.
function currentStaleIds() {
  const ids = new Set();
  if (!currentRel.value) return ids;
  const pane = paneEl();
  const el = pane && pane.querySelector('.annotatable');
  if (!el) return ids;
  const t = el.textContent;
  for (const h of highlights.value.get(currentRel.value) || []) {
    // Whole-file comments are not anchored to a range, so they never go stale.
    if (h.kind === 'file') continue;
    const ok = h.text && (t.includes(h.text) || t.slice(h.start, h.end) === h.text);
    if (!ok) ids.add(h.id);
  }
  return ids;
}

// Every highlight across every artifact, oldest first.
export function allHighlights() {
  const out = [];
  for (const [rel, list] of highlights.value) {
    if (!list.length) continue;
    for (const h of list) out.push({ rel, ...h });
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

// Review drawer content + its item list in one pass (so the caller doesn't
// recompute allHighlights for the header count). Returns { html, items }.
export function buildReviewHtml() {
  const items = allHighlights();
  if (!items.length) {
    return { items, html: '<div class="rv-empty">Select text in any artifact and press <b>💬 Comment</b> to flag it for fixing. Or select the <b>change title</b> to comment on a whole artifact (structure, tone, formatting).<br><br>Comments from all files are collected into a single fix prompt for an LLM.</div>' };
  }
  const stale = currentStaleIds();
  return { items, html: items.map((h, i) => {
    if (h.kind === 'file') {
      // Whole-file comment: no quoted snippet, distinct marker, never stale.
      return html`
        <div class="rv-item rv-file-comment" data-id="${h.id}" data-rel="${h.rel}">
          <div class="rv-num">📄</div>
          <div class="rv-body">
            <div class="rv-file">${h.rel}</div>
            <div class="rv-pill">entire artifact</div>
            <div class="rv-comment">${h.comment}</div>
          </div>
          <button class="rv-del" title="Delete" data-rel="${h.rel}" data-id="${h.id}">✕</button>
        </div>`;
    }
    return html`
    <div class="rv-item${stale.has(h.id) ? ' stale' : ''}" data-id="${h.id}" data-rel="${h.rel}">
      <div class="rv-num">${i + 1}</div>
      <div class="rv-body">
        <div class="rv-file">${h.rel}</div>
        <div class="rv-text">${snippet(h.text)}</div>
        <div class="rv-comment">${h.comment ? h.comment : html`<span class="rv-nocomment">no comment</span>`}</div>
        ${stale.has(h.id) ? html`<div class="rv-stale">text not found in current content</div>` : ''}
      </div>
      <button class="rv-del" title="Delete" data-rel="${h.rel}" data-id="${h.id}">✕</button>
    </div>`;
  }).join('') };
}

export function deleteHighlight(rel, id) {
  const list = (highlights.value.get(rel) || []).filter(h => h.id !== id);
  setHighlights(rel, list);
  applyHighlights(rel);
}

/* ---------- Selection listeners (attached by osv-pane's <main>) ---------- */

export function onSelection() { onSelect(); }

// Clicking outside the bubble dismisses it.
document.addEventListener('mousedown', e => {
  if (annBubble && !annBubble.contains(e.target)) hideAnnBubble();
});
