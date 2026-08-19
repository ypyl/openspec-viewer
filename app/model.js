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

// Extract the leading 'project/openspec' path from a raw upload path
// (e.g. 'llmclip/openspec/specs/…' -> 'llmclip/openspec/').
export function derivePrefix(rawPath) {
  const m = String(rawPath).match(/^(.*?\bopenspec\b)(?=\/|$)/);
  return m ? m[0] + '/' : '';
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
