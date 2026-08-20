// osv-review: review drawer — collected highlights/comments and the
// Copy-fix / Send-to-LLM actions.

import { html, computed } from '../../imports.js';
import { currentRel, highlights, staleTick } from '../../app/state.js';
import { buildReviewHtml, allHighlights, deleteHighlight, revealComment } from '../../app/annotations.js';
import { buildPrompt, copyText } from '../../app/prompt.js';
import { showToast } from '../osv-toast/osv-toast.js';

export class OsvReview extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this.innerHTML = `
      <div class="review-drawer open" aria-label="Review">
        <div class="review-head">
          <div>
            <div class="review-title">Review</div>
            <div class="review-file"></div>
          </div>
        </div>
        <div class="review-list"></div>
        <div class="review-actions">
          <button class="review-action primary copy-btn" disabled>📋 Copy fix</button>
          <button class="review-action send-btn" disabled>🤖 Send to LLM</button>
        </div>
      </div>`;

    this._fileEl = this.querySelector('.review-file');
    this._listEl = this.querySelector('.review-list');
    this._copyBtn = this.querySelector('.copy-btn');
    this._sendBtn = this.querySelector('.send-btn');

    /* ---- Render the review list + actions from highlights ---- */
    const reviewHtml = computed(buildReviewHtml, [currentRel, highlights, staleTick]);
    reviewHtml.effect(() => {
      const items = allHighlights();
      const files = new Set(items.map(h => h.rel)).size;
      this._fileEl.textContent = items.length
        ? `${items.length} comment${items.length === 1 ? '' : 's'} · ${files} file${files === 1 ? '' : 's'}`
        : '';
      this._listEl.innerHTML = reviewHtml.value;
      this._listEl.querySelectorAll('.rv-del').forEach(b =>
        b.addEventListener('click', () => deleteHighlight(b.dataset.rel, b.dataset.id)));
      this._listEl.querySelectorAll('.rv-item').forEach(item =>
        item.addEventListener('click', e => {
          if (e.target.closest('.rv-del')) return;
          revealComment(item.dataset.rel, item.dataset.id);
        }));
      const hasComments = items.some(h => h.comment);
      this._copyBtn.disabled = !hasComments;
      this._sendBtn.disabled = !hasComments;
      const hint = hasComments ? '' : 'Add a comment first';
      this._copyBtn.title = hint;
      this._sendBtn.title = hint;
    });

    /* ---- Actions ---- */
    this._copyBtn.addEventListener('click', async () => {
      const prompt = await buildPrompt();
      if (!prompt) return;
      const ok = await copyText(prompt);
      showToast(ok ? 'Fix prompt copied to clipboard' : 'Copy failed — use Send to LLM', ok ? undefined : 'error');
    });
    this._sendBtn.addEventListener('click', async () => {
      const prompt = await buildPrompt();
      if (!prompt) return;
      document.dispatchEvent(new CustomEvent('osv:show-prompt', { detail: { text: prompt } }));
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
