// osv-folder-rail: the narrow icon column of opened folders — the add action
// at the top (＋), one avatar button per folder below (first letter inside,
// per-folder hue, unread dot, session-only hollow ring for uploads), active
// highlighted. Clicking an avatar switches the active folder; the + falls
// back to the webkitdirectory upload when the File System Access API is
// unavailable. The name/close affordance lives in osv-file-list's name row.

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