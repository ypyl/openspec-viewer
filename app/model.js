// app/model.js — pure, DOM-free model helpers: OpenSpec path/artifact/group
// classification and small text utilities.
//
// This module imports ONLY from lib/html-literal.js so it loads in a plain
// Node runtime (unlike the browser-bound modules, which read window globals
// through imports.js). The node --test suite in tools/test-*.mjs covers it.
// render.js re-exports these for the browser app.

import { html, joinHtml } from '../lib/html-literal.js';

/* ---------- Path / grouping helpers ---------- */

// Paths come in relative to the picked folder. If the repo root was picked,
// they start with "openspec/…"; strip any path up to and including the
// first "openspec" segment so browsing works from either the repo root or
// the openspec folder itself.
export function normPath(p) {
  const parts = p.split('/');
  const i = parts.indexOf('openspec');
  if (i >= 0) return parts.slice(i + 1).join('/');
  return p;
}

export function artifactOf(rel) {
  const name = rel.split('/').pop();
  if (name === 'proposal.md') return 'Proposal';
  if (name === 'design.md') return 'Design';
  if (name === 'tasks.md') return 'Tasks';
  if (name === 'config.yaml') return 'Config';
  if (name.endsWith('.openspec.yaml')) return 'Metadata';
  if (name.endsWith('spec.md')) return 'Spec';
  return 'Doc';
}

export function isRelevant(rel) {
  // .openspec.yaml is a real artifact; other dotfiles (like .gitkeep) are noise.
  return /\.(md|ya?ml|json)$/i.test(rel) &&
    (rel.endsWith('.openspec.yaml') || !rel.split('/').pop().startsWith('.'));
}

// A change's metadata file (OpenSpec keeps it at <change>/.openspec.yaml). It
// stays visible and readable but is excluded from unread/new tracking: it must
// not flag the change, count in a group counter, or gate acknowledging it.
export function isChangeMetadata(rel) {
  return rel.endsWith('.openspec.yaml');
}

export function isArchived(rel) {
  return rel.startsWith('changes/archive/');
}

// Only four sections. Archive lives under changes/archive per the
// standard openspec CLI layout; everything else is ignored.
export function groupOf(rel) {
  if (rel === 'config.yaml' || rel.startsWith('config/')) return 'Config';
  if (isArchived(rel)) return 'Archive';
  if (rel.startsWith('changes/')) return 'Changes';
  if (rel.startsWith('specs/')) return 'Specs';
  return null;
}

export function displayLabel(rel, group) {
  if (group === 'Changes') return rel.slice('changes/'.length);                 // <change>/<file…>
  if (group === 'Archive') return rel.slice('changes/archive/'.length);         // <date>-<change>/<file…>
  if (group === 'Specs') return rel.slice('specs/'.length).replace(/\/spec\.md$/, '');  // <capability>
  return rel;                                                                   // config.yaml
}

export function changeOf(rel) {
  if (isArchived(rel)) return rel.split('/').slice(0, 3).join('/');             // changes/archive/<name>
  if (rel.startsWith('changes/')) return rel.split('/').slice(0, 2).join('/');  // changes/<name>
  return null;
}

export function prettyChangeName(dir) {
  let n = dir, date = '';
  const m = n.match(/^(\d{4}-\d{2}-\d{2})-(.*)$/);
  if (m) { date = m[1]; n = m[2]; }
  const label = n.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return { label, date };
}

export function crumbFor(rel) {
  let segs = rel.split('/');
  // Spec files: show the capability path, not a trailing spec.md.
  if (segs.length > 1 && segs[segs.length - 1] === 'spec.md') segs = segs.slice(0, -1);
  return joinHtml(segs.map((seg, i) =>
    i === segs.length - 1
      ? html`<span class="file">${seg}</span>`
      : html`<span class="seg">${seg}</span><span class="sep">/</span>`));
}

/* ---------- Text utilities ---------- */

// 1-based line numbers in `raw` that contain `text`.
export function refLines(raw, text) {
  const out = [];
  if (text) raw.split('\n').forEach((line, i) => { if (line.includes(text)) out.push(i + 1); });
  return out;
}

export function snippet(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 90 ? t.slice(0, 90) + '…' : t;
}

/* ---------- Content-search helpers (pure, Fuse-backed) ---------- */

// Human-readable location of an artifact for search results: the change's
// pretty name for change/archive files, the capability path for specs, the
// file path otherwise.
export function searchLabel(rel) {
  const g = groupOf(rel);
  if (g === 'Changes' || g === 'Archive') {
    const parts = rel.split('/');
    const dir = g === 'Changes' ? parts[1] : parts[2];
    return prettyChangeName(dir).label;
  }
  if (g === 'Specs') return displayLabel(rel, g);
  return rel;
}

// Fuse title key: what a user is most likely to type. Change/archive artifacts
// index under the change's pretty name plus the artifact file; specs index
// under the capability path; everything else under its file path.
export function searchTitle(rel) {
  const g = groupOf(rel);
  if (g === 'Changes' || g === 'Archive') {
    const parts = rel.split('/');
    const dir = g === 'Changes' ? parts[1] : parts[2];
    return prettyChangeName(dir).label + ' ' + parts[parts.length - 1];
  }
  return searchLabel(rel);
}

// Build a snippet window around the first match. Returns
// { segments: [{ t, hit }], line } where `segments` is the window text split
// into plain/marked parts (the caller renders `hit` parts inside <mark> and
// html-escapes everything via html-literal) and `line` is the 1-based line of
// the first match (0 when there is no match). With no ranges the window is the
// first few lines of the document.
export function snippetSegments(text, ranges, contextLines = 2) {
  const lines = text.split('\n');
  if (!ranges.length) {
    return {
      segments: [{ t: lines.slice(0, Math.min(3, lines.length)).join('\n'), hit: false }],
      line: 0,
    };
  }
  // Normalize + merge overlapping ranges.
  const merged = [];
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0] || x[1] - y[1])) {
    if (b <= a) continue;
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  if (!merged.length) return { segments: [], line: 0 };
  // Locate the line containing the first match start.
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  let li = 0;
  while (li < starts.length - 1 && starts[li + 1] <= merged[0][0]) li++;
  const wStart = Math.max(0, li - contextLines);
  const wEnd = Math.min(lines.length - 1, li + contextLines);
  const winOff = starts[wStart];
  const winEnd = starts[wEnd] + lines[wEnd].length;
  const winText = text.slice(winOff, winEnd);
  const winRanges = merged
    .map(([a, b]) => [a - winOff, b - winOff])
    .filter(([a, b]) => b > 0 && a < winText.length)
    .map(([a, b]) => [Math.max(0, a), Math.min(winText.length, b)]);
  const segments = [];
  let pos = 0;
  for (const [a, b] of winRanges) {
    if (b <= a) continue;
    if (a > pos) segments.push({ t: winText.slice(pos, a), hit: false });
    segments.push({ t: winText.slice(a, b), hit: true });
    pos = b;
  }
  if (pos < winText.length) segments.push({ t: winText.slice(pos), hit: false });
  return { segments, line: li + 1 };
}
