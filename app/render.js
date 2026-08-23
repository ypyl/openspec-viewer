// app/render.js — artifact renderers and markdown/YAML/frontmatter handling.
// Browser-bound (uses marked/js-yaml/DOMPurify via imports.js). The pure path/
// group/text helpers live in app/model.js and are re-exported here so existing
// importers (state.js, store.js, components) keep working unchanged.

import { html, htmlRaw, joinHtml } from '../imports.js';
import { marked, jsyaml, DOMPurify } from '../imports.js';
import {
  normPath, artifactOf, artifactPhrase, isRelevant, isChangeMetadata, isArchived, groupOf, displayLabel,
  changeOf, prettyChangeName, crumbFor, refLines, snippet,
  searchLabel, searchTitle, snippetSegments,
} from './model.js';

// Re-export the pure model helpers for the browser app.
export {
  normPath, artifactOf, artifactPhrase, isRelevant, isChangeMetadata, isArchived, groupOf, displayLabel,
  changeOf, prettyChangeName, crumbFor, refLines, snippet,
  searchLabel, searchTitle, snippetSegments,
};

// Read raw text from a FileSystemFileHandle or an uploaded File.
export async function handleText(h) {
  return typeof h.getFile === 'function' ? await (await h.getFile()).text() : await h.text();
}

/* ---------- Frontmatter ---------- */

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: null, body: text };
  let meta = null;
  try { meta = jsyaml.load(m[1]); } catch (e) { meta = { _error: e.message }; }
  return { meta, body: text.slice(m[0].length) };
}

export function metaCard(rows) {
  return html`<div class="meta-card"><h3>Metadata</h3><table class="meta-table">${
    joinHtml(rows.map(([k, v]) => html`<tr><td>${k}</td><td>${v}</td></tr>`))}</table></div>`;
}

/* ---------- Renderers ---------- */

export function yamlPane(text, showMeta = true) {
  let card = '';
  if (showMeta) {
    try {
      const data = jsyaml.load(text);
      if (data && typeof data === 'object') {
        card = metaCard(Object.entries(data).map(([k, v]) =>
          [k, v === null ? 'null' : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)]));
      }
    } catch (err) {
      card = html`<div class="meta-error">YAML parse failed: ${err.message}</div>`;
    }
  }
  return html`${card}<pre class="yaml-view annotatable">${text}</pre>`;
}

export function markdownPane(rel, text) {
  const { meta, body } = parseFrontmatter(text);

  let metaHtml = '';
  if (meta && typeof meta === 'object' && !meta._error) {
    const rows = Object.entries(meta).map(([k, v]) =>
      html`<tr><td>${k}</td><td>${
        v === null || v === undefined ? '' :
        typeof v === 'object' ? html`<pre class="yaml-view" style="padding:6px">${JSON.stringify(v, null, 2)}</pre>` :
        v}</td></tr>`);
    metaHtml = html`<div class="meta-card"><h3>${artifactOf(rel)} metadata</h3><table class="meta-table">${joinHtml(rows)}</table></div>`;
  } else if (meta && meta._error) {
    metaHtml = html`<div class="meta-card"><h3>Frontmatter</h3><div class="meta-error">Could not parse: ${meta._error}</div></div>`;
  }

  // Tasks progress
  const tasks = body.match(/^\s*[-*]\s+\[([ xX])\]/gm) || [];
  let progressHtml = '';
  if (tasks.length) {
    const done = tasks.filter(t => /\[[xX]\]/.test(t)).length;
    const pct = Math.round(done / tasks.length * 100);
    progressHtml = html`<div class="progress">${done}/${tasks.length} tasks done · ${pct}%</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;
  }

  const safe = DOMPurify.sanitize(marked.parse(body, { breaks: true })
    .replace(/<li>\[([ xX])\]\s*</g, (m, s) =>
      `<li class="task-${(s === 'x' || s === 'X') ? 'done' : 'open'}"><input type="checkbox" ${s !== ' ' ? 'checked' : ''} disabled>`));

  return html`${progressHtml}${metaHtml}<div class="markdown annotatable">${htmlRaw(safe)}</div>`;
}
