// osv-pane: change tabs, breadcrumb + diff toggle, and the artifact/diff body.
// Renders into LIGHT DOM so document.getSelection() traverses text nodes for
// annotations. After every render it calls annotations.applyHighlights(rel) —
// the design's `onRendered` hook. Cross-component navigation arrives as
// document-level CustomEvents (from osv-file-list and annotations).

import { html, joinHtml } from '../../imports.js';
import {
  crumbFor, handleText, markdownPane, yamlPane, artifactOf, changeOf, groupOf, displayLabel,
  artifactPhrase,
} from '../../app/render.js';
import { diffViewHtml, diffToggleHtml, diffTabBadgeHtml, hashText } from '../../app/diff.js';
import {
  allFiles, currentRel, currentKey, changeMeta, diffInfo, diffViews,
  recentRels, paneCache, paneCachePut, setDiffView, currentTabs, setCurrentTabs, searchMarks, highlights,
  expandedStripKinds, activeFolderId,
} from '../../app/state.js';
import { markRead as markReadStore, readFileText } from '../../app/store.js';
import { applyHighlights, hideAnnBubble, onSelection, clearSearchMarks, saveFileComment } from '../../app/annotations.js';
import { showToast } from '../osv-toast/osv-toast.js';
import { GUIDE, KIND_LABEL } from '../../app/review-guide.js';

const WELCOME = `
  <div class="welcome">
    <div class="icon">📋</div>
    <h2>OpenSpec Local Viewer</h2>
    <p class="welcome-about">An offline browser for <a href="https://openspec.dev/" target="_blank" rel="noopener">OpenSpec</a> — read, diff, and review change proposals, specs, designs, and task lists entirely on your machine.</p>
    <p>Add a folder with the <b>＋</b> button in the left rail (or the
    <code>openspec/</code> folder) to browse change proposals, designs, task lists, and specs.
    Everything stays on your machine; files are read with the File API and never uploaded.</p>
  </div>`;

// How many whole-file (kind:'file') comments an artifact currently carries.
function wholeFileCount(rel) {
  return (highlights.value.get(rel) || []).filter(h => h.kind === 'file').length;
}

// Header 💬 button: opens the whole-file comment editor; a count badge shows how
// many general comments the artifact already has. Enabled in both artifact and
// diff views (a whole-file comment targets the artifact file regardless of view).
function commentToggleHtml(rel) {
  const n = wholeFileCount(rel);
  return html`<button class="comment-toggle${n ? ' has' : ''}" data-rel="${rel}" title="Comment on this whole artifact">💬${n ? html`<span class="comment-count">${n}</span>` : ''}</button>`;
}

// Which guide kind (if any) a change-artifact rel maps to. The metadata tab
// and anything outside a change's artifact set return null → no strip.
function guideKindOf(rel) {
  if (!rel) return null;
  if (rel.endsWith('/proposal.md')) return 'proposal';
  if (rel.includes('/specs/') && rel.endsWith('spec.md')) return 'spec';
  if (rel.endsWith('/design.md')) return 'design';
  if (rel.endsWith('/tasks.md')) return 'tasks';
  return null;
}

// Collapsed strip: the kind's guiding question on one line. Expanded: the
// kind's red flags below it. Kinds with no flags (design) stay one line.
// The chevron doubles as a labeled affordance (Show/Hide red flags) so the
// expandable content is discoverable without hovering.
function guideStripHtml(kind) {
  const g = GUIDE[kind];
  const expanded = expandedStripKinds.value.has(kind);
  const hasFlags = g.flags.length > 0;
  const action = expanded ? 'Hide' : 'Show';
  return html`
    <button class="guide-toggle${expanded ? ' expanded' : ''}" data-kind="${kind}"
            ${hasFlags ? html` aria-expanded="${expanded}"` : ''}
            ${hasFlags ? html` title="${action} review red flags for this artifact"` : ''}>
      <span class="guide-kind">${KIND_LABEL[kind]}</span>
      <span class="guide-question">${g.question}</span>
      ${hasFlags ? html`<span class="guide-chevron">${expanded ? '▾' : '▸'} <span class="guide-affordance">${action} red flags</span></span>` : ''}
    </button>
    ${expanded && hasFlags
      ? html`<ul class="guide-flags">${joinHtml(g.flags.map(f => html`<li>${f}</li>`))}</ul>`
      : ''}`;
}

export class OsvPane extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this._main = document.createElement('main');
    this._main.innerHTML = WELCOME;
    this.appendChild(this._main);

    /* ---- Whole-file comment editor (native <dialog>) ---- */
    this._cf = document.createElement('dialog');
    this._cf.className = 'cf-dialog';
    this._cf.innerHTML = `
      <div class="cf-title">Comment on <span class="cf-rel"></span></div>
      <div class="cf-body">
        <textarea class="cf-text" rows="4"></textarea>
        <div class="cf-actions">
          <button type="button" class="cf-cancel">Cancel</button>
          <button type="button" class="cf-save">Save comment</button>
        </div>
      </div>`;
    this.appendChild(this._cf);
    this._cf.querySelector('.cf-cancel').addEventListener('click', () => this._cf.close());
    this._cf.querySelector('.cf-save').addEventListener('click', () => this.saveCommentDialog());
    this._cf.querySelector('.cf-text').addEventListener('keydown', e => {
      // Enter saves (Ctrl/Cmd+Enter too); Shift+Enter inserts a newline.
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.saveCommentDialog(); }
      if (e.key === 'Escape') this._cf.close();
    });

    // Placeholder names the artifact kind (proposal/design/tasks/…); updated
    // per-open in openCommentDialog.
    this._cfText = this._cf.querySelector('.cf-text');
    this._cfText.placeholder = 'Add a comment about ' + artifactPhrase('') + '…';

    /* ---- Selection / annotation listeners on the scroll container ---- */
    this._main.addEventListener('mouseup', onSelection);
    this._main.addEventListener('keyup', onSelection);
    // Scrolling dismisses the floating comment bubble (anchoring it is
    // visually unstable and it can jump off-screen once the anchor scrolls).
    this._main.addEventListener('scroll', () => hideAnnBubble(), { passive: true });

    /* ---- Diff/Artifact toggle + whole-file comment (delegated within the pane) ---- */
    this._main.addEventListener('click', async e => {
      const ct = e.target.closest('.comment-toggle');
      if (ct) { this.openCommentDialog(ct.dataset.rel); return; }
      const gs = e.target.closest('.guide-toggle');
      if (gs) { this.toggleGuideStrip(gs.dataset.kind); return; }
      const b = e.target.closest('.diff-toggle');
      if (!b) return;
      const rel = b.dataset.rel;
      const showingDiff = !diffViews.get(rel);
      setDiffView(rel, showingDiff);
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
      this.scrollToMark(`mark.hl[data-id="${id}"]`);
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
      this.scrollToMark('mark.sq');
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
    // Opening an archived change acknowledges all of its artifacts at once
    // (design D1/D2): archived changes are history, not review targets, so a
    // single open clears every unread marker and the Archive group counter.
    // Active changes keep per-tab acknowledgment in acknowledgeShown below.
    const isArchive = key.startsWith('changes/archive/');
    if (isArchive) {
      this.acknowledgeArchivedChange(meta).catch(() => {});
    }
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
      push(s.rel, specs.length === 1 ? 'Spec'
        : `Spec · ${displayLabel(s.rel.slice(s.rel.indexOf('/specs/') + 1), 'Specs')}`);
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
      ${isArchive ? '' : html`<div class="guide-strip" hidden></div>`}
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
    this.refreshGuideStrip();
    this._main.querySelectorAll('.tab').forEach(b =>
      b.classList.toggle('active', +b.dataset.i === i));
    this.refreshToggle(t.rel);
    this.refreshCommentToggle(t.rel);
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
    paneCachePut(rel, pane);
    return pane;
  }

  paneBarHtml(crumb, rel) {
    return html`<div class="pane-bar">${crumb}<span class="comment-toggle-slot">${commentToggleHtml(rel)}</span><span class="diff-toggle-slot">${diffToggleHtml(rel, diffInfo.get(rel), diffViews.get(rel), recentRels.value.has(rel))}</span></div>`;
  }

  // Patch the guidance strip for the current tab (design D2/D3). Archive
  // changes carry no strip element; standalone artifacts and the metadata tab
  // hide it once the rel resolves to no kind.
  refreshGuideStrip() {
    const strip = this._main.querySelector('.guide-strip');
    if (!strip) return;
    const kind = guideKindOf(currentRel.value);
    strip.hidden = kind == null;
    strip.innerHTML = kind == null ? '' : guideStripHtml(kind);
  }

  // Expand/collapse the active tab's strip and remember the choice per kind
  // for the rest of the session (design D3).
  toggleGuideStrip(kind) {
    const s = new Set(expandedStripKinds.value);
    if (s.has(kind)) s.delete(kind); else s.add(kind);
    expandedStripKinds.value = s;
    this.refreshGuideStrip();
  }

  // Re-render just the comment toggle after a tab switch or a save.
  refreshCommentToggle(rel) {
    const slot = this._main.querySelector('.comment-toggle-slot');
    if (slot) slot.innerHTML = commentToggleHtml(rel);
  }

  // Open the whole-file comment editor for an artifact.
  openCommentDialog(rel) {
    if (!rel) return;
    this._cfRel = rel;
    this._cf.querySelector('.cf-rel').textContent = rel;
    const ta = this._cfText;
    ta.value = '';
    ta.placeholder = 'Add a comment about ' + artifactPhrase(rel) + '…';
    this._cf.showModal();
    ta.focus();
  }

  saveCommentDialog() {
    const rel = this._cfRel;
    const comment = this._cf.querySelector('.cf-text').value.trim();
    if (rel && comment) {
      saveFileComment(rel, comment);
      this.refreshCommentToggle(rel);
      showToast('Comment added');
    }
    this._cf.close();
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

  // After the active folder switches: re-render whatever the new folder had
  // selected (or auto-open its first change when it has no selection yet).
  handleFolderSwitched() {
    hideAnnBubble();
    if (this._cf && this._cf.open) this._cf.close();
    // No folder left open: drop back to the initial welcome screen.
    if (!activeFolderId.value) {
      this._main.innerHTML = WELCOME;
      this._body = null;
      return;
    }
    if (currentRel.value || currentKey.value) this.rerenderCurrent();
    else this.autoOpenFirst();
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

  // Scroll the first match for `selector` (a highlight or search mark) into view.
  scrollToMark(selector) {
    const mark = this._main.querySelector(selector);
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

  // Mark every artifact of an archived change read against its current content
  // (design D2). Metadata files are already never unread, so skip them. Uses the
  // same markRead path as a normal read; recentRels reactivity clears the
  // Archive markers and group counter. Fire-and-forget and non-fatal.
  async acknowledgeArchivedChange(meta) {
    for (const f of meta.files) {
      if (f.rel.endsWith('.openspec.yaml')) continue;
      try { await this.markRead(f.rel, hashText(await readFileText(f.rel))); }
      catch (e) { /* non-fatal */ }
    }
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
