// osv-header: title, version badge, theme toggle, stats, review button.

import { html, computed } from '../../imports.js';
import { theme, allFiles, folders, activeFolderId, changeMeta, navDrawerOpen } from '../../app/state.js';
import { groupOf, changeOf, isArchived } from '../../app/render.js';

// Single source for the visible version badge (AGENTS.md keeps the version
// in the header badge, the first-line comment, and sw.js in sync).
export const VERSION = '3.7.0';

export class OsvHeader extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this.innerHTML = `
      <header>
        <div class="brand">
          <button type="button" class="nav-toggle" aria-label="Open navigation" aria-expanded="false" title="Open navigation">☰</button>
          <h1>OpenSpec <span class="dot">•</span> Local Viewer</h1>
          <span class="version">v${VERSION}</span>
          <button class="theme-btn" title="Following system theme — click to override">💻</button>
        </div>
        <osv-search></osv-search>
        <div class="side">
          <div class="stats"></div>
        </div>
      </header>`;

    const themeBtn = this.querySelector('.theme-btn');
    const statsEl = this.querySelector('.stats');
    const navToggle = this.querySelector('.nav-toggle');

    /* ---- Mobile navigation drawer toggle ---- */
    navToggle.addEventListener('click', () => { navDrawerOpen.value = !navDrawerOpen.value; });
    navDrawerOpen.effect(() => {
      const open = navDrawerOpen.value;
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      navToggle.title = open ? 'Close navigation (Esc)' : 'Open navigation';
    });

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

    /* ---- Stats (active folder) ---- */
    const stats = computed(() => {
      const all = allFiles.value;
      const active = [...new Set(all.filter(f => groupOf(f.rel) === 'Changes').map(f => changeOf(f.rel)))].length;
      const archived = [...changeMeta.value.values()].filter(m => isArchived(m.key)).length;
      const entry = folders.value.find(f => f.id === activeFolderId.value);
      const name = entry ? entry.name + (entry.suffix || '') : null;
      const live = folders.value.some(f => f.kind === 'pick');
      return html`${name ? html`<b>${name}</b> · ` : ''}` +
        html`<b>${all.length}</b> file${all.length === 1 ? '' : 's'} · ` +
        html`<b>${active}</b> active change${active === 1 ? '' : 's'} · <b>${archived}</b> archived` +
        (live ? html` · <span class="live-dot">● live</span>` : '');
    }, [allFiles, folders, activeFolderId, changeMeta]);
    stats.effect(() => { statsEl.innerHTML = stats.value; });
  }
}

customElements.define('osv-header', OsvHeader);
