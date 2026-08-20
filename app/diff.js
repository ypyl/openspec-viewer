// app/diff.js — line diff computation and diff-view HTML builders (pure
// functions; no DOM mutation).

import { html, joinHtml } from '../lib/html-literal.js';

export function splitLines(s) {
  const t = String(s).replace(/\r\n?/g, '\n');
  if (t === '') return [];
  const lines = t.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();   // drop the trailing empty line
  return lines;
}

// Fast, dependency-free 53-bit string hash (cyrb53) over the normalized text
// (same line-ending normalization as splitLines). Fingerprints the exact
// content version a file was acknowledged at; see components/osv-pane for the
// unread/read model.
export function hashText(s) {
  const t = String(s).replace(/\r\n?/g, '\n');
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < t.length; i++) {
    const ch = t.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// Line-by-line diff (LCS with a 3-line context window). Returns null for
// identical texts. Fine for small artifacts; very large files degrade to a
// single all-changed hunk instead of a giant DP table.
export function diffLines(oldText, newText) {
  const a = splitLines(oldText), b = splitLines(newText);
  if (a.join('\n') === b.join('\n')) return null;
  const n = a.length, m = b.length;
  const ops = [];
  if (n * m > 4000000) {
    for (let i = 0; i < n; i++) ops.push(['-', i]);
    for (let j = 0; j < m; j++) ops.push(['+', j]);
  } else {
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { ops.push(['=', i, j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(['-', i]); i++; }
      else { ops.push(['+', j]); j++; }
    }
    while (i < n) { ops.push(['-', i]); i++; }
    while (j < m) { ops.push(['+', j]); j++; }
  }

  // Keep CLOSE lines of context around each change, then group the
  // contiguous marked runs into hunks.
  const CLOSE = 3;
  const max = ops.length;
  const marked = new Uint8Array(max);
  for (let k = 0; k < max; k++) {
    if (ops[k][0] === '=') continue;
    for (let t = Math.max(0, k - CLOSE); t <= Math.min(max - 1, k + CLOSE); t++) marked[t] = 1;
  }
  const hunks = [];
  let oldPos = 0, newPos = 0;   // 0-based positions consumed so far
  let k = 0;
  while (k < max) {
    if (!marked[k]) {
      if (ops[k][0] !== '+') oldPos++;
      if (ops[k][0] !== '-') newPos++;
      k++;
      continue;
    }
    const oldStart = oldPos + 1, newStart = newPos + 1;
    const lines = [];
    let oc = 0, nc = 0;         // old/new line counts inside this hunk
    while (k < max && marked[k]) {
      const t = ops[k][0];
      if (t === '=') { lines.push([' ', oldPos + 1, newPos + 1, a[ops[k][1]]]); oldPos++; newPos++; oc++; nc++; }
      else if (t === '-') { lines.push(['-', oldPos + 1, 0, a[ops[k][1]]]); oldPos++; oc++; }
      else { lines.push(['+', 0, newPos + 1, b[ops[k][1]]]); newPos++; nc++; }
      k++;
    }
    hunks.push({ oldStart, newStart, oldCount: oc, newCount: nc, lines });
  }
  let added = 0, removed = 0;
  for (const h of hunks) for (const l of h.lines) {
    if (l[0] === '+') added++;
    if (l[0] === '-') removed++;
  }
  // hash of the NEW text: the exact version acknowledging this diff marks read.
  return { hunks, added, removed, ts: Date.now(), hash: hashText(newText) };
}

export function relTime(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + (h === 1 ? ' hr ago' : ' hrs ago');
  const d = Math.floor(h / 24);
  return d + (d === 1 ? ' day ago' : ' days ago');
}

export function hunkHeader(h) {
  const f = (start, count) => count === 1 ? String(start) : `${start},${count}`;
  return `@@ -${f(h.oldStart, h.oldCount)} +${f(h.newStart, h.newCount)} @@`;
}

// Unified diff lines for one diff result (shared by every view).
export function diffHunksHtml(di) {
  return joinHtml(di.hunks.map(h => html`
    <div class="diff-line hdr"><span class="ln">@@</span><span class="sign"></span><span class="code">${hunkHeader(h)}</span></div>
    ${joinHtml(h.lines.map(l => {
      const [t, oln, nln, text] = l;
      const cls = t === '+' ? 'add' : t === '-' ? 'del' : 'ctx';
      return html`<div class="diff-line ${cls}"><span class="ln">${t === '+' ? nln : oln}</span><span class="sign">${t}</span><span class="code">${text}</span></div>`;
    }))}
  `));
}

// The diff VIEW for an artifact — replaces the artifact pane when toggled on.
// Stays out of .annotatable so highlight offsets keep matching the rendered content.
// Pure: takes the diff result as an argument (callers pass diffInfo.get(rel)).
export function diffViewHtml(di) {
  if (!di) return '';
  return html`<div class="diff">
    <div class="diff-head">
      <span>Unified diff</span>
      ${di.added ? html`<b class="dh-add">+${di.added}</b>` : ''}
      ${di.removed ? html`<b class="dh-del">−${di.removed}</b>` : ''}
      <span class="diff-ts">${relTime(di.ts)}</span>
    </div>
    <pre class="diff-view">${diffHunksHtml(di)}</pre>
  </div>`;
}

// The Diff/Artifact toggle shown next to the breadcrumb when the artifact
// has a recorded diff. A "NEW" badge marks diffs the user hasn't seen yet.
// Pure: takes its data as arguments (di, active = diff view shown, unread =
// the artifact has an unacknowledged change) instead of reading state maps.
export function diffToggleHtml(rel, di, active, unread) {
  if (!di) return '';
  const showNew = unread && !active;
  // +a −r counts also clear once the artifact is read, matching the tab badge
  // and the file-list hint: they represent an unacknowledged change.
  return html`<button class="diff-toggle${active ? ' active' : ''}" data-rel="${rel}" title="Toggle artifact / diff view">
    ${active ? 'Artifact' : 'Diff'}
    ${showNew ? html`<span class="diff-new">NEW</span>` : ''}
    ${unread && di.added ? html`<b class="dh-add">+${di.added}</b>` : ''}
    ${unread && di.removed ? html`<b class="dh-del">−${di.removed}</b>` : ''}
  </button>`;
}

// Shared +a −r badge bodies: the <b> spans emitted inside a container.
function diffCountsHtml(added, removed) {
  return joinHtml([
    added ? html`<b class="dh-add">+${added}</b>` : html``,
    added && removed ? ' ' : '',
    removed ? html`<b class="dh-del">−${removed}</b>` : html``,
  ]);
}

// Compact +a −r counts next to an artifact or change in the list.
export function diffHint(diffs) {
  let a = 0, r = 0;
  for (const d of diffs) { a += d.added; r += d.removed; }
  if (!a && !r) return '';
  return html`<span class="diff-hint" title="Line changes since last snapshot">${diffCountsHtml(a, r)}</span>`;
}

// Compact +a −r counts for a change tab; empty when that file has no diff or
// its change has been acknowledged (seen). unread = the rel has an
// unacknowledged change.
export function diffTabBadgeHtml(di, unread) {
  if (!di || !unread || (!di.added && !di.removed)) return '';
  return html`<span class="tab-diff">${diffCountsHtml(di.added, di.removed)}</span>`;
}
