// osv-header: title, version badge, theme toggle, stats, review button.

import { html, computed } from '../../imports.js';
import { theme, allFiles, dirHandle, changeMeta, highlights } from '../../app/state.js';
import { groupOf, changeOf, isArchived } from '../../app/render.js';

// Single source for the visible version badge (AGENTS.md keeps the version
// in the header badge, the first-line comment, and sw.js in sync).
export const VERSION = '2.2.0';

export class OsvHeader extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this.innerHTML = `
      <header>
        <h1>OpenSpec <span class="dot">•</span> Local Viewer</h1>
        <span class="version">v${VERSION}</span>
        <button class="theme-btn" title="Following system theme — click to override">💻</button>
        <div class="stats"></div>
        <button class="review-btn" title="Review comments across all artifacts">💬<span class="review-count" hidden></span></button>
      </header>`;

    const themeBtn = this.querySelector('.theme-btn');
    const statsEl = this.querySelector('.stats');
    const reviewBtn = this.querySelector('.review-btn');
    const reviewCount = this.querySelector('.review-count');

    /* ---- Theme ---- */
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const resolved = () => theme.value === 'system' ? (mql.matches ? 'dark' : 'light') : theme.value;
    const applyTheme = () => {
      document.documentElement.dataset.theme = resolved();
      const icons = { dark: '☀️', light: '🌙', system: '💻' };
      const titles = {
        dark: 'Switch to light theme',
        light: 'Switch to dark theme',
        system: 'Following system theme — click to override',
      };
      themeBtn.textContent = icons[theme.value];
      themeBtn.title = titles[theme.value];
      try { localStorage.setItem('osviewer.theme', theme.value); } catch (e) {}
    };
    const cycle = { dark: 'light', light: 'system', system: 'dark' };
    themeBtn.addEventListener('click', () => { theme.value = cycle[theme.value]; });
    mql.addEventListener('change', () => { if (theme.value === 'system') applyTheme(); });
    theme.effect(applyTheme);

    /* ---- Stats ---- */
    const stats = computed(() => {
      const all = allFiles.value;
      const active = [...new Set(all.filter(f => groupOf(f.rel) === 'Changes').map(f => changeOf(f.rel)))].length;
      const archived = [...changeMeta.value.values()].filter(m => isArchived(m.key)).length;
      return html`<b>${all.length}</b> file${all.length === 1 ? '' : 's'} · ` +
        html`<b>${active}</b> active change${active === 1 ? '' : 's'} · <b>${archived}</b> archived` +
        (dirHandle.value ? html` · <span class="live-dot">● live</span>` : '');
    }, [allFiles, dirHandle, changeMeta]);
    stats.effect(() => { statsEl.innerHTML = stats.value; });

    /* ---- Review count + button ---- */
    const updateCount = () => {
      const items = [...highlights.value.values()].reduce((s, l) => s + l.length, 0);
      reviewCount.textContent = items;
      reviewCount.hidden = items === 0;
    };
    highlights.addEventListener('change', updateCount);
    updateCount();
    reviewBtn.addEventListener('click', () =>
      document.dispatchEvent(new CustomEvent('osv:toggle-review')));
    document.addEventListener('osv:review-visibility', e =>
      reviewBtn.classList.toggle('active', !!e.detail.open));
  }
}

customElements.define('osv-header', OsvHeader);
