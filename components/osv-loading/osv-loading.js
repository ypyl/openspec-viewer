// osv-loading: full-screen overlay shown while scanning/monitoring a folder.
// Other modules call setLoading(msg, action?); passing a `{ cancel: fn }`
// action adds a Cancel button (and Escape accelerator) so an in-progress
// folder read can be aborted instead of leaving the UI stuck.

export class OsvLoading extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;
    this.innerHTML = `
      <div class="loading-overlay" hidden>
        <div class="loading-box">
          <div class="spinner" aria-hidden="true"></div>
          <span class="loading-msg"></span>
          <button type="button" class="loading-cancel" hidden>Cancel</button>
        </div>
      </div>`;
    this._overlay = this.querySelector('.loading-overlay');
    this._msg = this.querySelector('.loading-msg');
    this._cancel = this.querySelector('.loading-cancel');
    this._cancel.addEventListener('click', () => {
      const fn = this._cancelFn;
      this.clear();
      if (fn) fn();
    });
    // Escape aborts whenever a cancel is active. The overlay blocks pointer
    // clicks on the app, so a document-level key handler is the reliable path.
    this._onKey = (e) => {
      if (e.key === 'Escape' && this._cancelFn && !this._overlay.hidden) {
        e.preventDefault();
        const fn = this._cancelFn;
        this.clear();
        if (fn) fn();
      }
    };
    document.addEventListener('keydown', this._onKey);
  }
  set(msg, action) {
    const hasCancel = !!(action && action.cancel);
    if (this._overlay) {
      this._overlay.hidden = !msg;
      // Dialog semantics only while a cancel control is shown (the read is
      // switchable); a plain blocking load stays a plain overlay.
      if (hasCancel) {
        this._overlay.setAttribute('role', 'dialog');
        this._overlay.setAttribute('aria-modal', 'true');
      } else {
        this._overlay.removeAttribute('role');
        this._overlay.removeAttribute('aria-modal');
      }
    }
    if (this._msg) this._msg.textContent = msg;
    if (this._cancel) {
      this._cancelFn = hasCancel ? action.cancel : null;
      this._cancel.hidden = !hasCancel;
    }
  }
  clear() { this.set(null); }
}

customElements.define('osv-loading', OsvLoading);

export function setLoading(msg, action) {
  const el = document.querySelector('osv-loading');
  if (el) (msg ? el.set(msg, action) : el.clear());
}
