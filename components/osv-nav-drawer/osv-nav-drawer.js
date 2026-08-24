// osv-nav-drawer: mobile-only slide-over that owns the folder rail and the
// artifact list. On ≥62em it is `display: contents` (see the CSS) so both
// panels stay inside .layout as columns exactly as on desktop; below 62em it
// becomes a fixed drawer (backdrop + panel) that hides both panels until the
// header toggle opens it, giving the content pane full width.
//
// The rail and sidebar are wrapped here ONCE at upgrade time and never move
// again, so sidebar selection, scroll, group collapse state, focus, and open
// tabs survive every open/close cycle (no subtree rebuilds — tiny-signals).
// Picking a folder (activateFolder in store.js) or an artifact (the existing
// osv:select-rel / osv:select-change events) closes the drawer.

import { navDrawerOpen } from '../../app/state.js';

export class OsvNavDrawer extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    // Shell: backdrop + panel (title row with close button); the existing
    // children (<osv-folder-rail>, <osv-file-list>) move into the panel.
    // Modules are deferred, so they are not yet upgraded when this runs and
    // initialize exactly once, inside the panel.
    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';

    const title = document.createElement('span');
    title.className = 'nav-title';
    title.textContent = 'OpenSpec';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'nav-close';
    close.setAttribute('aria-label', 'Close navigation');
    close.textContent = '✕';

    const head = document.createElement('div');
    head.className = 'nav-head';
    head.append(title, close);

    const panel = document.createElement('div');
    panel.className = 'nav-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Navigation');
    panel.append(head);
    while (this.firstElementChild) panel.appendChild(this.firstElementChild);
    this.replaceChildren(backdrop, panel);

    const toggleEl = () => document.querySelector('.nav-toggle');
    const closeDrawer = (returnFocus) => {
      if (!navDrawerOpen.value) return;
      navDrawerOpen.value = false;
      if (returnFocus) {
        const t = toggleEl();
        if (t) t.focus();
      }
    };

    /* ---- Open/close from the signal ---- */
    navDrawerOpen.effect(() => {
      const open = navDrawerOpen.value;
      this.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      if (open) close.focus();
    });

    /* ---- Close affordances: backdrop, close button, Escape ---- */
    backdrop.addEventListener('click', () => closeDrawer(false));
    close.addEventListener('click', () => closeDrawer(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navDrawerOpen.value) closeDrawer(true);
    });

    /* ---- Picking an artifact/change from the drawer closes it ---- */
    const onPick = () => closeDrawer(false);
    document.addEventListener('osv:select-rel', onPick);
    document.addEventListener('osv:select-change', onPick);
  }
}

customElements.define('osv-nav-drawer', OsvNavDrawer);