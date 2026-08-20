// osv-search: header content search with a grouped results dropdown. Typing a
// query fuzzy-matches every artifact's content (changes, specs, archive,
// config); clicking a result asks the pane to open the artifact at the match.

import { html, joinHtml } from '../../imports.js';
import { GROUPS, searchMarks } from '../../app/state.js';
import { artifactOf, searchLabel, snippetSegments } from '../../app/render.js';
import { searchContent } from '../../app/search.js';
import { clearSearchMarks } from '../../app/annotations.js';

const DEBOUNCE_MS = 120;
const MIN_LEN = 3;   // terms under 3 characters are noise; ignore them entirely
const PER_GROUP = 24;

export class OsvSearch extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this.innerHTML = `
      <div class="osv-search">
        <input class="s-input" type="text" placeholder="Search all artifacts…" aria-label="Search all artifacts" autocomplete="off" spellcheck="false">
        <div class="s-drop" hidden></div>
      </div>`;

    const input = this.querySelector('.s-input');
    const drop = this.querySelector('.s-drop');

    input.addEventListener('input', () => {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.run(input, drop), DEBOUNCE_MS);
    });
    input.addEventListener('focus', () => this.run(input, drop));
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        input.value = '';
        clearSearchMarks();
        drop.hidden = true;
        drop.innerHTML = '';
      }
    });

    // Ctrl+K / Cmd+K focuses search (command-palette convention).
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });

    // Clicking outside closes the dropdown (keeps the query; re-focus restores results).
    document.addEventListener('click', e => {
      if (!this.contains(e.target)) drop.hidden = true;
    });
  }

  // Debounced/focused search. async so a slow Fuse build doesn't block input;
  // re-checks the query before rendering so a stale response is dropped.
  async run(input, drop) {
    const q = input.value;
    if (q.length < MIN_LEN) return;
    const results = await searchContent(q);
    if (input.value.trim() !== q.trim()) return;   // query changed while searching
    if (!input.value.trim()) return;
    drop.hidden = false;
    drop.innerHTML = dropHtml(q, results);
    drop.querySelectorAll('.s-item').forEach(el => {
      const rel = el.dataset.rel;
      const ranges = JSON.parse(el.dataset.ranges || '[]');
      el.addEventListener('click', () => {
        searchMarks.value = new Map([[rel, ranges]]);
        document.dispatchEvent(new CustomEvent('osv:open-search-result', { detail: { rel, ranges } }));
        drop.hidden = true;
      });
    });
  }
}

customElements.define('osv-search', OsvSearch);

function dropHtml(q, results) {
  // Preserve tree order: Changes, Specs, Archive, Config.
  const sections = GROUPS
    .map(g => ({ g, items: results.filter(r => r.group === g) }))
    .filter(s => s.items.length);
  if (!sections.length) return html`<div class="s-empty">No matches for “${q}”.</div>`;
  const capped = sections.some(s => s.items.length >= PER_GROUP);
  return joinHtml([
    ...sections.map(sec => joinHtml([
      html`<div class="s-head g-${sec.g.toLowerCase()}">${sec.g}</div>`,
      ...sec.items.map(itemHtml),
    ])),
    capped ? html`<div class="s-more">Showing up to ${PER_GROUP} matches per section.</div>` : html``,
  ]);
}

function itemHtml(r) {
  const type = artifactOf(r.rel);
  const { segments } = snippetSegments(r.text, r.ranges);
  const snip = segments.length
    ? joinHtml(segments.map(s => s.hit ? html`<mark class="sq">${s.t}</mark>` : html`${s.t}`))
    : html``;
  return html`
    <button type="button" class="s-item" data-rel="${r.rel}" data-ranges="${JSON.stringify(r.ranges)}">
      <span class="s-line1"><span class="badge ${type.toLowerCase()}">${type}</span><span class="s-loc">${searchLabel(r.rel)}</span></span>
      <span class="s-snip">${snip}</span>
    </button>`;
}
