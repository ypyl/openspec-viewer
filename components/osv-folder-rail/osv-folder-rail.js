// osv-folder-rail: the narrow icon column of opened folders — the add action
// at the top (＋), one avatar button per folder below (first letter inside,
// per-folder hue, unread dot, session-only hollow ring for uploads), active
// highlighted, and a GitHub link at the bottom. Clicking an avatar switches
// the active folder; the + falls back to the webkitdirectory upload when the
// File System Access API is unavailable. The name/close affordance lives in
// osv-file-list's name row.

import { html, joinHtml, computed } from '../../imports.js';
import { folders, activeFolderId, folderUnread } from '../../app/state.js';
import { pickFolder, addUploadFolder, activateFolder } from '../../app/store.js';

export class OsvFolderRail extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this.innerHTML = `
      <nav class="folder-rail" aria-label="Open folders">
        <button type="button" class="rail-add" title="Add folder to monitor">＋</button>
        <input type="file" id="picker" class="file-picker" webkitdirectory multiple />
        <div class="rail-list"></div>
        <a class="rail-github" href="https://github.com/ypyl/openspec-viewer"
           target="_blank" rel="noopener"
           title="OpenSpec Viewer on GitHub" aria-label="OpenSpec Viewer on GitHub">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"
               aria-hidden="true"><path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"/></svg>
        </a>
      </nav>`;

    const addBtn = this.querySelector('.rail-add');
    const picker = this.querySelector('.file-picker');

    /* ---- Add: folder picker, or upload when the API is missing ---- */
    addBtn.addEventListener('click', async () => {
      if (window.showDirectoryPicker) await pickFolder();
      else picker.click();
    });
    picker.addEventListener('change', async e => {
      await addUploadFolder(e.target.files);
      e.target.value = '';
    });

    /* ---- Avatar list (patch-in-place; preserve the rail's scroll) ---- */
    const listEl = this.querySelector('.rail-list');
    const railHtml = computed(buildRailHtml, [folders, activeFolderId, folderUnread]);
    railHtml.effect(() => {
      const top = listEl.scrollTop;
      listEl.innerHTML = railHtml.value;
      listEl.scrollTop = top;
      listEl.querySelectorAll('.rail-avatar').forEach(el =>
        el.addEventListener('click', () => activateFolder(el.dataset.id)));
    });
  }
}

customElements.define('osv-folder-rail', OsvFolderRail);

// One avatar button per opened folder. The first letter of the project name
// sits inside; the full name (with collision suffix) is the tooltip. A green
// dot marks folders with unacknowledged changes (never for session-only
// uploads, which get a hollow ring instead). html-literal encodes the name.
function buildRailHtml() {
  return joinHtml(folders.value.map(f => {
    const active = f.id === activeFolderId.value;
    const unread = f.kind !== 'upload' && !!folderUnread.value.get(f.id);
    const letter = (f.name || '?').charAt(0).toUpperCase();
    return html`
      <button type="button" class="rail-avatar${active ? ' active' : ''}${f.kind === 'upload' ? ' upload' : ''}"
        data-id="${f.id}" title="${f.name}${f.suffix || ''}" style="--hue:${f.hue}">
        <span class="rail-letter">${letter}</span>
        ${unread ? html`<span class="rail-dot" title="Unread changes"></span>` : ''}
      </button>`;
  }));
}