// osv-review: review drawer — collected highlights/comments and the
// Copy-fix / Send-to-LLM actions.

import { html, joinHtml, computed } from '../../imports.js';
import { currentRel, currentKey, highlights, staleTick, checklistTicks, checklistCollapsed, reviewHidden } from '../../app/state.js';
import { buildReviewHtml, deleteHighlight, revealComment } from '../../app/annotations.js';
import { buildPrompt, copyText } from '../../app/prompt.js';
import { showToast } from '../osv-toast/osv-toast.js';
import { CHECKLIST, CHECKLIST_TITLE } from '../../app/review-guide.js';

// The two-minute checklist block: a collapsible header (title + progress +
// chevron) over the seven items from the vendored guide. Reads the active
// change's session ticks; empty when the change is archived or not selected.
function renderChecklistHtml(key) {
  const ticks = checklistTicks.value.get(key) || new Set();
  const checked = ticks.size;
  const collapsed = checklistCollapsed.value;
  return html`
    <button class="cl-toggle" aria-expanded="${!collapsed}" title="${collapsed ? 'Expand' : 'Collapse'} the checklist">
      <span class="cl-title">${CHECKLIST_TITLE}</span>
      <span class="cl-progress">${checked} of ${CHECKLIST.length}</span>
      <span class="cl-chevron">${collapsed ? '▸' : '▾'}</span>
    </button>
    ${collapsed ? '' : html`<ul class="cl-list">
      ${joinHtml(CHECKLIST.map((item, i) =>
        html`<li class="cl-item${ticks.has(i) ? ' checked' : ''}" data-i="${i}">
          <span class="cl-box" aria-hidden="true">${ticks.has(i) ? '✓' : ''}</span>
          <span class="cl-text">${item}</span>
        </li>`))}
    </ul>`}`;
}

export class OsvReview extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this.innerHTML = `
      <div class="review-drawer open" aria-label="Review">
        <div class="review-checklist" hidden></div>
        <div class="review-list"></div>
        <div class="review-actions">
          <button class="review-action primary copy-btn" disabled>📋 Copy prompt</button>
        </div>
      </div>
      <button type="button" class="review-pill" hidden>💬<span class="review-pill-count" hidden></span></button>`;

    this._listEl = this.querySelector('.review-list');
    this._checklistEl = this.querySelector('.review-checklist');
    this._copyBtn = this.querySelector('.copy-btn');

    /* ---- Render the review list + actions from highlights ---- */
    const review = computed(buildReviewHtml, [currentRel, highlights, staleTick]);
    review.effect(() => {
      const items = review.value.items;
      const files = new Set(items.map(h => h.rel)).size;
      const n = items.length;
      // The count lives on the action (the panel has no separate header):
      // "Copy prompt · 3 comments · 1 file", plain label while empty.
      this._copyBtn.textContent = n
        ? `📋 Copy prompt · ${n} comment${n === 1 ? '' : 's'} · ${files} file${files === 1 ? '' : 's'}`
        : '📋 Copy prompt';
      this._listEl.innerHTML = review.value.html;
      this._listEl.querySelectorAll('.rv-del').forEach(b =>
        b.addEventListener('click', () => deleteHighlight(b.dataset.rel, b.dataset.id)));
      this._listEl.querySelectorAll('.rv-item').forEach(item =>
        item.addEventListener('click', e => {
          if (e.target.closest('.rv-del')) return;
          revealComment(item.dataset.rel, item.dataset.id);
        }));
      const hasComments = items.some(h => h.comment);
      this._copyBtn.disabled = !hasComments;
      const hint = hasComments ? '' : 'Add a comment first';
      this._copyBtn.title = hint;
    });

    /* ---- Restore pill for the hidden panel (panel-visibility, v3.8.0) ----
         Shown whenever the drawer is hidden at ≥62em; the count mirrors the
         same `items` already computed for the Copy prompt label, so the pill
         and the drawer never disagree. Hidden below 62em by CSS (the whole
         panel is auto-hidden there; nothing to restore). */
    this._pill = this.querySelector('.review-pill');
    this._pillCount = this._pill.querySelector('.review-pill-count');
    const syncPill = () => {
      const n = review.value.items.length;
      this._pill.hidden = !reviewHidden.value;
      this._pillCount.hidden = n === 0;
      if (n) this._pillCount.textContent = n;
      this._pill.setAttribute('aria-label', n
        ? `Show review panel (${n} comment${n === 1 ? '' : 's'})`
        : 'Show review panel');
    };
    review.effect(syncPill);        // item count / current view changes
    reviewHidden.effect(syncPill);  // hide/show toggles (review.value stays current)
    this._pill.addEventListener('click', () => { reviewHidden.value = false; });

    /* ---- The two-minute checklist (session-scoped per change, design D4) ----
         Shown only while an active change's artifact is open; absent for
         standalone artifacts, main specs, and archived changes. Ticks are
         keyed by change in the session Map, never persisted. */
    const checklist = computed(() => {
      const key = currentKey.value;
      if (!key || key.startsWith('changes/archive/')) return '';
      return renderChecklistHtml(key);
    }, [currentKey, checklistTicks, checklistCollapsed]);
    checklist.effect(() => {
      const h = checklist.value;
      this._checklistEl.hidden = !h;
      if (h) this._checklistEl.innerHTML = h;
    });
    this._checklistEl.addEventListener('click', e => {
      if (e.target.closest('.cl-toggle')) {
        checklistCollapsed.value = !checklistCollapsed.value;
        return;
      }
      const item = e.target.closest('.cl-item');
      if (!item) return;
      const key = currentKey.value;
      if (!key) return;
      const i = +item.dataset.i;
      const m = new Map(checklistTicks.value);
      const s = new Set(m.get(key) || []);
      if (s.has(i)) s.delete(i); else s.add(i);
      if (s.size) m.set(key, s); else m.delete(key);
      checklistTicks.value = m;
    });

    /* ---- Actions ---- */
    this._copyBtn.addEventListener('click', async () => {
      const prompt = await buildPrompt();
      if (!prompt) return;
      const ok = await copyText(prompt);
      showToast(ok ? 'Prompt copied to clipboard' : 'Copy failed', ok ? undefined : 'error');
    });

    /* ---- Focus a review item (panel is always visible) ---- */
    document.addEventListener('osv:focus-review', e => this.focus(e.detail.id));
  }

  focus(id) {
    const item = this._listEl.querySelector(`[data-id="${id}"]`);
    if (item) {
      item.scrollIntoView({ block: 'center' });
      item.classList.add('flash');
      setTimeout(() => item.classList.remove('flash'), 1400);
    }
  }
}

customElements.define('osv-review', OsvReview);
