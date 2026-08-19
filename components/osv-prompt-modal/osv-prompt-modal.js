// osv-prompt-modal: the generated LLM fix prompt, with copy / open-in-new-tab.

import { copyText } from '../../app/prompt.js';
import { showToast } from '../osv-toast/osv-toast.js';

export class OsvPromptModal extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this.innerHTML = `
      <div class="modal" hidden>
        <div class="modal-box">
          <div class="modal-head">
            <h3>LLM fix prompt</h3>
            <button class="review-close" title="Close">✕</button>
          </div>
          <textarea class="prompt-text" spellcheck="false" placeholder="Generated fix prompt…"></textarea>
          <div class="modal-actions">
            <p class="modal-hint">Paste the prompt into any LLM; it returns the corrected file. Highlights &amp; comments stay local.</p>
            <button class="review-action primary copy-btn">📋 Copy</button>
            <button class="review-action open-btn">Open in new tab</button>
          </div>
        </div>
      </div>`;

    this._modal = this.querySelector('.modal');
    this._text = this.querySelector('.prompt-text');

    this.querySelector('.review-close').addEventListener('click', () => this.close());
    this._modal.addEventListener('click', e => { if (e.target === this._modal) this.close(); });
    this.querySelector('.copy-btn').addEventListener('click', async () => {
      const ok = await copyText(this._text.value);
      showToast(ok ? 'Prompt copied to clipboard' : 'Copy failed', ok ? undefined : 'error');
    });
    this.querySelector('.open-btn').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([this._text.value], { type: 'text/plain;charset=utf-8' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });

    document.addEventListener('osv:show-prompt', e => this.show(e.detail.text));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !this._modal.hidden) this.close();
    });
  }

  show(text) {
    this._text.value = text;
    this._modal.hidden = false;
  }
  close() { this._modal.hidden = true; }
}

customElements.define('osv-prompt-modal', OsvPromptModal);
