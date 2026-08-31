// osv-file-list: name/close row for the active folder, search, group
// sections, file/change rows. The folder picker moved to osv-folder-rail.

import { html, computed } from '../../imports.js';
import {
  allFiles, currentRel, currentKey, recentRels, collapsed, search, activeFolderId,
  activeFolderEntry, folders, changeMeta, diffInfo, highlights, GROUPS,
} from '../../app/state.js';
import { artifactOf, groupOf, changeOf, displayLabel, compareArchiveDateDesc } from '../../app/render.js';
import { diffHint } from '../../app/diff.js';
import { closeFolder } from '../../app/store.js';

const SEARCH_ICON = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M10.68 11.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04zM11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>';

export class OsvFileList extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this.innerHTML = `
      <aside>
        <div class="controls">
          <div class="folder-row"></div>
          <div class="search-row">${SEARCH_ICON}<input class="search" type="text" placeholder="Filter files…  ( / )" autocomplete="off"></div>
        </div>
        <div class="list-scroll"></div>
      </aside>`;

    const folderRowEl = this.querySelector('.folder-row');
    const searchEl = this.querySelector('.search');
    const listEl = this.querySelector('.list-scroll');

    /* ---- Active folder name + close row ---- */
    const folderRow = computed(() => {
      const f = activeFolderEntry();
      if (!f) return html`<span class="folder-name muted">No folder</span>`;
      const label = f.name + (f.suffix || '');
      return html`
        <span class="folder-name" title="${label}">${label}</span>
        <button type="button" class="folder-close" title="Close folder — stop monitoring and forget it">✕</button>`;
    }, [folders, activeFolderId]);
    folderRow.effect(() => {
      folderRowEl.innerHTML = folderRow.value;
      const btn = folderRowEl.querySelector('.folder-close');
      if (btn) btn.addEventListener('click', () => {
        const id = activeFolderId.value;
        if (id) closeFolder(id);
      });
    });

    /* ---- Search + / shortcut ---- */
    searchEl.addEventListener('input', () => { search.value = searchEl.value; });
    document.addEventListener('keydown', e => {
      // '/ ' only hijacks when not already typing in an input, so the header
      // content-search box (and other inputs) keep receiving their characters.
      const typing = document.activeElement &&
        ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'));
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchEl.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchEl) {
        searchEl.value = '';
        search.value = '';
        searchEl.blur();
      }
    });

    /* ---- List render (patch-in-place; preserve scroll position) ---- */
    const listHtml = computed(buildListHtml,
      [allFiles, currentRel, currentKey, recentRels, collapsed, search, changeMeta, highlights, activeFolderId]);
    listHtml.effect(() => {
      const top = listEl.scrollTop;
      listEl.innerHTML = listHtml.value;
      listEl.scrollTop = top;
      listEl.querySelectorAll('.group-label').forEach(el =>
        el.addEventListener('click', () => toggleGroup(el.dataset.group)));
      listEl.querySelectorAll('.item[data-rel]').forEach(el =>
        el.addEventListener('click', () =>
          document.dispatchEvent(new CustomEvent('osv:select-rel', { detail: { rel: el.dataset.rel } }))));
      listEl.querySelectorAll('.item[data-key]').forEach(el =>
        el.addEventListener('click', () =>
          document.dispatchEvent(new CustomEvent('osv:select-change', { detail: { key: el.dataset.key } }))));
    });

    // Folder switch: the projection already reset the search signal; clear the
    // input element too so it never shows a stale query from another folder.
    this.clearSearchInput = () => { searchEl.value = ''; };
  }
}

customElements.define('osv-file-list', OsvFileList);

function toggleGroup(g) {
  const s = new Set(collapsed.value);
  if (s.has(g)) s.delete(g); else s.add(g);
  collapsed.value = s;
  const id = activeFolderId.value;
  if (id) {
    try { localStorage.setItem('osviewer.collapsed.' + id, JSON.stringify([...s])); } catch (e) {}
  }
}

function buildListHtml() {
  const q = search.value.trim().toLowerCase();
  const forceOpen = q.length > 0; // searching always expands groups

  // No folder open: point at the add action instead of an artifact list.
  if (!activeFolderId.value) {
    return '<div class="empty">Add a folder with the <b>＋</b> button in the left rail to start monitoring.</div>';
  }

  const sections = [];
  for (const g of GROUPS) {
    if (g === 'Archive' || g === 'Changes') {
      // One row per change (active or archived), labeled with its name.
      const keys = [...new Set(allFiles.value
        .filter(f => groupOf(f.rel) === g)
        .map(f => changeOf(f.rel)))];
      const rows = keys.map(k => changeMeta.value.get(k))
        .filter(m => m && (!q || (m.label + ' ' + m.dir + ' ' + m.key).toLowerCase().includes(q)));
      if (g === 'Archive') rows.sort(compareArchiveDateDesc); // newest first, undated last
      if (rows.length) sections.push({ g, rows });
    } else {
      const items = allFiles.value.filter(f => {
        if (groupOf(f.rel) !== g) return false;
        if (q && !f.rel.toLowerCase().includes(q)) return false;
        return true;
      });
      if (items.length) sections.push({ g, items });
    }
  }

  let out = sections.length ? '' : '<div class="empty">No artifacts found in this folder.</div>';

  sections.forEach(sec => {
    const g = sec.g;
    const items = sec.items || sec.rows;
    const isCollapsed = collapsed.value.has(g) && !forceOpen;
    const stickyCls = g === 'Changes' ? ' sticky' : '';
    const newCount = (g === 'Changes' || g === 'Archive')
      ? sec.rows.filter(r => r.files.some(f => recentRels.value.has(f.rel))).length
      : items.filter(f => recentRels.value.has(f.rel)).length;
    out += html`
      <div class="group-label g-${g.toLowerCase()}${stickyCls}${isCollapsed ? ' collapsed' : ''}" data-group="${g}">
        <span class="chevron">▾</span>
        <span class="group-name">${g}</span>
        ${newCount ? html`<span class="group-new">+${newCount} unread</span>` : ''}
        <span class="group-count">${items.length}</span>
      </div>`;
    if (!isCollapsed) {
      if (g === 'Archive' || g === 'Changes') {
        sec.rows.forEach(m => {
          const active = m.key === currentKey.value;
          const isNew = m.files.some(f => recentRels.value.has(f.rel));
          const cnt = m.files.reduce((s, f) => s + (highlights.value.get(f.rel) || []).length, 0);
          out += html`<div class="item change-row${active ? ' active' : ''}${isNew ? ' new' : ''}" data-key="${m.key}">
            ${isNew ? html`<span class="new-dot" title="Unread changes"></span>` : ''}
            <span class="path">${m.label}</span>
            ${cnt ? html`<span class="cmt-count">${cnt}</span>` : ''}
            ${diffHint(m.files.filter(f => recentRels.value.has(f.rel)).map(f => diffInfo.get(f.rel)).filter(Boolean))}
            ${m.date ? html`<span class="date">${m.date}</span>` : ''}
          </div>`;
        });
      } else {
        sec.items.forEach(f => {
          const active = f.rel === currentRel.value;
          const isNew = recentRels.value.has(f.rel);
          const cnt = (highlights.value.get(f.rel) || []).length;
          // Specs/Config sections need no badge — the section color says it.
          const badge = (g === 'Specs' || g === 'Config') ? '' :
            html`<span class="badge ${artifactOf(f.rel).toLowerCase()}">${artifactOf(f.rel)}</span>`;
          out += html`<div class="item${active ? ' active' : ''}${isNew ? ' new' : ''}" data-rel="${f.rel}">
            ${isNew ? html`<span class="new-dot" title="Unread changes"></span>` : ''}
            <span class="path">${displayLabel(f.rel, g)}</span>
            ${cnt ? html`<span class="cmt-count">${cnt}</span>` : ''}
            ${diffHint(recentRels.value.has(f.rel) ? [diffInfo.get(f.rel)].filter(Boolean) : [])}
            ${badge}
          </div>`;
        });
      }
    }
  });

  return out;
}