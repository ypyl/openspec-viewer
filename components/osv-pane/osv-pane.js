// osv-pane: change tabs, breadcrumb + diff toggle, and the artifact/diff body.
// Renders into LIGHT DOM so document.getSelection() traverses text nodes for
// annotations. After every render it calls annotations.applyHighlights(rel) —
// the design's `onRendered` hook. Cross-component navigation arrives as
// document-level CustomEvents (from osv-file-list and annotations).

import { html, joinHtml } from '../../imports.js';
import {
  crumbFor, handleText, markdownPane, yamlPane, artifactOf, changeOf, groupOf,
} from '../../app/render.js';
import { diffViewHtml, diffToggleHtml, diffTabBadgeHtml, hashText } from '../../app/diff.js';
import {
  allFiles, currentRel, currentKey, changeMeta, diffInfo, diffViews,
  recentRels, paneCache, currentTabs, setCurrentTabs, searchMarks,
} from '../../app/state.js';
import { markRead as markReadStore, readFileText } from '../../app/store.js';
import { applyHighlights, hideAnnBubble, onSelection, repositionBubble, clearSearchMarks } from '../../app/annotations.js';

const WELCOME = `
  <div class="welcome">
    <div class="icon">📋</div>
    <h2>OpenSpec Local Viewer</h2>
    <p>Choose your repository folder (or the <code>openspec/</code> folder) to browse
    change proposals, designs, task lists, and specs.</p>
    <p>Everything stays on your machine; files are read with the File API and never uploaded.</p>
  </div>`;

export class OsvPane extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this._main = document.createElement('main');
    this._main.innerHTML = WELCOME;
    this.appendChild(this._main);

    /* ---- Selection / annotation listeners on the scroll container ---- */
    this._main.addEventListener('mouseup', onSelection);
    this._main.addEventListener('keyup', onSelection);
    this._main.addEventListener('scroll', repositionBubble, { passive: true });

    /* ---- Diff/Artifact toggle (delegated within the pane) ---- */
    this._main.addEventListener('click', async e => {
      const b = e.target.closest('.diff-toggle');
      if (!b) return;
      const rel = b.dataset.rel;
      const showingDiff = !diffViews.get(rel);
      diffViews.set(rel, showingDiff);
      // Opening the diff view acknowledges the artifact (see acknowledgeShown).
      if (showingDiff) await this.markRead(rel, diffInfo.get(rel) && diffInfo.get(rel).hash);
      this.refreshToggle(rel);
      if (this._body && this._main.contains(this._body)) {
        this._body.innerHTML = await this.viewFor(rel);
        applyHighlights(rel);
        this._main.scrollTop = 0;
      }
    });

    /* ---- Navigation / refresh events from other components & store ---- */
    document.addEventListener('osv:select-rel', e => { clearSearchMarks(); this.openFile(e.detail.rel); });
    document.addEventListener('osv:select-change', e => { clearSearchMarks(); this.openChange(e.detail.key); });
    document.addEventListener('osv:auto-open', () => this.autoOpenFirst());
    document.addEventListener('osv:refresh-current', () => this.rerenderCurrent());
    document.addEventListener('osv:refresh-tab-badges', () => this.refreshTabBadges());
    document.addEventListener('osv:open-deleted', () => this.showDeleted());
    document.addEventListener('osv:reveal', async e => {
      const { rel, id } = e.detail;
      if (rel !== currentRel.value) await this.openFile(rel);
      this.scrollToMark(id);
    });

    // Content-search result: open the artifact at its match, then scroll to it.
    document.addEventListener('osv:open-search-result', async e => {
      const { rel, ranges } = e.detail;
      searchMarks.value = new Map([[rel, ranges]]);
      const key = changeOf(rel);
      if (key && currentKey.value === key) {
        const idx = currentTabs.findIndex(t => t.rel === rel);
        if (idx >= 0 && currentRel.value === rel) applyHighlights(rel);
        else if (idx >= 0) await this.activateTab(idx);
        else await this.openChange(key, rel);
      } else if (key) {
        await this.openChange(key, rel);
      } else if (currentRel.value !== rel) {
        await this.openFile(rel);
      } else {
        applyHighlights(rel);
      }
      this.scrollToSearchMark();
    });

    // Re-apply transient marks when the query is cleared or a new result is
    // chosen (the search component mutates searchMarks; applyHighlights reads it).
    searchMarks.addEventListener('change', () => {
      const rel = currentRel.value;
      if (rel) applyHighlights(rel);
    });
  }

  async openFile(rel) {
    const entry = allFiles.value.find(f => f.rel === rel);
    if (!entry) return;
    hideAnnBubble();
    const key = changeOf(rel);
    if (key) { this.openChange(key, rel); return; }
    currentRel.value = rel;
    currentKey.value = null;
    // The artifact is now viewed; the diff toggle may still show NEW until
    // the user actually switches to the diff view (handled in acknowledgeShown).
    this._main.innerHTML = this.paneBarHtml(html`<div class="crumb">${crumbFor(rel)}</div>`, rel)
      + '<div class="pane-body pane-loading">Loading…</div>';
    this._body = this._main.querySelector('.pane-body');
    this._body.classList.remove('pane-loading');
    this._body.innerHTML = await this.viewFor(rel);
    applyHighlights(rel);
    this._main.scrollTop = 0;
    await this.acknowledgeShown(rel);
  }

  async openChange(key, initialRel) {
    const meta = changeMeta.value.get(key);
    if (!meta) return;
    hideAnnBubble();
    currentKey.value = key;
    currentRel.value = initialRel || meta.proposalRel || null;

    // Tabs in order: proposal, specs…, design, tasks, metadata
    const tabs = [];
    const push = (rel, label) => { if (rel) tabs.push({ rel, label }); };
    const prop = meta.files.find(f => f.rel.endsWith('/proposal.md'));
    const specs = meta.files
      .filter(f => f.rel.includes('/specs/') && f.rel.endsWith('spec.md'))
      .sort((a, b) => a.rel.localeCompare(b.rel));
    const design = meta.files.find(f => f.rel.endsWith('/design.md'));
    const tasks = meta.files.find(f => f.rel.endsWith('/tasks.md'));
    const metaYaml = meta.files.find(f => f.rel.endsWith('.openspec.yaml'));
    push(prop && prop.rel, 'Proposal');
    specs.forEach(s => {
      const cap = s.rel.slice(s.rel.indexOf('/specs/') + 1)
        .replace(/^specs\//, '').replace(/\/spec\.md$/, '');
      push(s.rel, specs.length === 1 ? 'Spec' : `Spec · ${cap}`);
    });
    push(design && design.rel, 'Design');
    push(tasks && tasks.rel, 'Tasks');
    push(metaYaml && metaYaml.rel, 'Metadata');
    setCurrentTabs(tabs);

    const tabBar = joinHtml(tabs.map((t, i) =>
      html`<button class="tab ${artifactOf(t.rel).toLowerCase()}${t.rel === currentRel.value ? ' active' : ''}" data-i="${i}">${t.label}${diffTabBadgeHtml(diffInfo.get(t.rel), recentRels.value.has(t.rel))}</button>`));

    this._main.innerHTML = html`
      ${this.paneBarHtml(html`<div class="crumb">${crumbFor(meta.key)}</div>`, currentRel.value)}
      <div class="change-head">
        <h2>${meta.label}</h2>
        ${meta.date ? html`<span class="date-badge">${meta.date}</span>` : ''}
      </div>
      <div class="tabs">${tabBar}</div>
      <div class="pane-body pane-loading">Loading…</div>`;

    this._body = this._main.querySelector('.pane-body');
    this._main.querySelectorAll('.tab').forEach(btn =>
      btn.addEventListener('click', () => this.activateTab(+btn.dataset.i)));

    const start = Math.max(0, tabs.findIndex(t => t.rel === currentRel.value));
    await this.activateTab(start);
  }

  async activateTab(i) {
    const t = currentTabs[i];
    if (!t) return;
    currentRel.value = t.rel;
    this._main.querySelectorAll('.tab').forEach(b =>
      b.classList.toggle('active', +b.dataset.i === i));
    this.refreshToggle(t.rel);
    this._body.className = 'pane-body';
    this._body.innerHTML = await this.viewFor(t.rel);
    applyHighlights(t.rel);
    this._main.scrollTop = 0;
    await this.acknowledgeShown(t.rel);
  }

  async viewFor(rel) {
    return diffViews.get(rel) && diffInfo.get(rel) ? diffViewHtml(diffInfo.get(rel)) : await this.paneHtml(rel);
  }

  async paneHtml(rel) {
    if (paneCache.has(rel)) return paneCache.get(rel);
    const entry = allFiles.value.find(f => f.rel === rel);
    if (!entry) return '<div class="empty">File not found.</div>';
    const text = await handleText(entry.handle);
    const name = rel.split('/').pop();
    // config.yaml renders raw only — the metadata card is redundant with the
    // file's own schema/context/rules keys. Metadata files keep the card.
    const isConfig = rel === 'config.yaml';
    const pane = (name.endsWith('.yaml') || name.endsWith('.yml'))
      ? yamlPane(text, !isConfig) : markdownPane(rel, text);
    paneCache.set(rel, pane);
    return pane;
  }

  paneBarHtml(crumb, rel) {
    return html`<div class="pane-bar">${crumb}<span class="diff-toggle-slot">${diffToggleHtml(rel, diffInfo.get(rel), diffViews.get(rel), recentRels.value.has(rel))}</span></div>`;
  }

  // Re-render just the toggle after a tab switch or a click.
  refreshToggle(rel) {
    const slot = this._main.querySelector('.diff-toggle-slot');
    if (slot) slot.innerHTML = diffToggleHtml(rel, diffInfo.get(rel), diffViews.get(rel), recentRels.value.has(rel));
  }

  // Live updates: re-render only the tab diff badges (no pane reload).
  refreshTabBadges() {
    const bar = this._main.querySelector('.tabs');
    if (!bar) return;
    currentTabs.forEach((t, i) => {
      const btn = bar.querySelector(`.tab[data-i="${i}"]`);
      if (!btn) return;
      const old = btn.querySelector('.tab-diff');
      if (old) old.remove();
      const badge = diffTabBadgeHtml(diffInfo.get(t.rel), recentRels.value.has(t.rel));
      if (badge) btn.insertAdjacentHTML('beforeend', badge);
    });
  }

  async rerenderCurrent() {
    if (currentKey.value) await this.openChange(currentKey.value, currentRel.value);
    else if (currentRel.value) await this.openFile(currentRel.value);
  }

  async autoOpenFirst() {
    const first = allFiles.value.find(f =>
      groupOf(f.rel) === 'Changes' && f.rel.endsWith('/proposal.md'))
      || allFiles.value.find(f => groupOf(f.rel) === 'Changes')
      || allFiles.value[0];
    if (first) await this.openFile(first.rel);
  }

  showDeleted() {
    this._main.innerHTML = '<div class="empty" style="margin-top:2rem">The open file was deleted while monitoring.</div>';
    this._body = null;
  }

  scrollToMark(id) {
    const mark = this._main.querySelector(`mark.hl[data-id="${id}"]`);
    if (mark) {
      mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
      mark.classList.add('active');
      setTimeout(() => mark.classList.remove('active'), 1400);
    }
  }

  // Scroll the first search match into view when a search result opens.
  scrollToSearchMark() {
    const mark = this._main.querySelector('mark.sq');
    if (mark) {
      mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
      mark.classList.add('active');
      setTimeout(() => mark.classList.remove('active'), 1400);
    }
  }

  // Acknowledge the currently shown view of rel once the user has seen
  // everything there is to see (see design.md D4): the diff view always
  // acknowledges; the artifact view acknowledges only when there is no pending
  // diff for the artifact — its content is then the whole change (e.g. a
  // brand-new file). A pending diff keeps the artifact unread until opened.
  async acknowledgeShown(rel) {
    const di = diffInfo.get(rel);
    if (diffViews.get(rel) && di) {
      await this.markRead(rel, di.hash);
    } else if (!di) {
      try { await this.markRead(rel, hashText(await readFileText(rel))); }
      catch (e) { /* non-fatal */ }
    }
    // else: artifact view with a pending diff → stay unread
  }

  async markRead(rel, hash) {
    if (hash == null) return;
    await markReadStore(rel, hash);
    if (recentRels.value.has(rel)) {
      const s = new Set(recentRels.value);
      s.delete(rel);
      recentRels.value = s;
    }
    // Tab count badges are imperative (not reactive) — drop the read file's
    // +a −r label on the fly; the file list updates via recentRels reactivity.
    this.refreshTabBadges();
  }
}

customElements.define('osv-pane', OsvPane);
