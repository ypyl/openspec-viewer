// osv-loading: full-screen overlay shown while scanning/monitoring a folder.
// Other modules call setLoading().

export class OsvLoading extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;
    this.innerHTML = `
      <div class="loading-overlay" hidden>
        <div class="loading-box">
          <div class="spinner" aria-hidden="true"></div>
          <span class="loading-msg"></span>
        </div>
      </div>`;
    this._overlay = this.querySelector('.loading-overlay');
    this._msg = this.querySelector('.loading-msg');
  }
  set(msg) {
    if (this._overlay) this._overlay.hidden = !msg;
    if (this._msg) this._msg.textContent = msg;
  }
  clear() { this.set(null); }
}

customElements.define('osv-loading', OsvLoading);

export function setLoading(msg) {
  const el = document.querySelector('osv-loading');
  if (el) (msg ? el.set(msg) : el.clear());
}
