// osv-toast: transient notification (bottom-right). One at a time;
// auto-removes after a few seconds. Other modules call showToast().

export class OsvToast extends HTMLElement {
  constructor() { super(); this._timer = null; }
  connectedCallback() {
    if (this._init) return;
    this._init = true;
  }
  show(msg, type) {
    if (this._el) this._el.remove();
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' error' : '');
    t.textContent = msg;
    this.appendChild(t);
    this._el = t;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { t.remove(); this._el = null; }, 5000);
  }
}

customElements.define('osv-toast', OsvToast);

export function showToast(msg, type) {
  const el = document.querySelector('osv-toast');
  if (el) el.show(msg, type);
}
