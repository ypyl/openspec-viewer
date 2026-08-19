// osv-file-list: folder picker, search, group sections, file/change rows.

import { html, computed } from '../../imports.js';
import {
  allFiles, currentRel, currentKey, recentRels, collapsed, search,
  changeMeta, diffInfo, highlights, GROUPS,
} from '../../app/state.js';
import { artifactOf, groupOf, changeOf, displayLabel } from '../../app/render.js';
import { diffHint } from '../../app/diff.js';
import { pickFolder, handlePickedFiles } from '../../app/store.js';

const FOLDER_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25V2.75A1.75 1.75 0 0014.25 1H1.75zM1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v10.5a.25.25 0 01-.25.25H1.75a.25.25 0 01-.25-.25V2.75zM3 4.75a.75.75 0 100 1.5.75.75 0 000-1.5zm3 0a.75.75 0 100 1.5.75.75 0 000-1.5zM3 8.5a.75.75 0 100 1.5.75.75 0 000-1.5zm3 0a.75.75 0 100 1.5.75.75 0 000-1.5zm3 0a.75.75 0 100 1.5.75.75 0 000-1.5zM8.5 12a.75.75 0 100 1.5.75.75 0 000-1.5zM11 8.5a.75.75 0 100 1.5.75.75 0 000-1.5zm3 0a.75.75 0 100 1.5.75.75 0 000-1.5zM3 12.25a.75.75 0 100 1.5.75.75 0 000-1.5zm3 0a.75.75 0 100 1.5.75.75 0 000-1.5zm3 0a.75.75 0 100 1.5.75.75 0 000-1.5zM11 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/></svg>';
const SEARCH_ICON = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M10.68 11.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04zM11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>';

export class OsvFileList extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;

    this.innerHTML = `
      <aside>
        <div class="controls">
          <button class="pick-btn">${FOLDER_ICON} Select Folder to Monitor</button>
          <input type="file" class="file-picker" webkitdirectory multiple />
          <div class="search-row">${SEARCH_ICON}<input class="search" type="text" placeholder="Filter files…  ( / )" autocomplete="off"></div>
        </div>
        <div class="list-scroll"></div>
      </aside>`;

    const pickBtn = this.querySelector('.pick-btn');
    const picker = this.querySelector('.file-picker');
    const searchEl = this.querySelector('.search');
    const listEl = this.querySelector('.list-scroll');

    /* ---- Folder picker ---- */
    pickBtn.addEventListener('click', async () => {
      if (window.showDirectoryPicker) await pickFolder();
      else picker.click();
    });
    picker.addEventListener('change', async e => {
      await handlePickedFiles(e.target.files);
      e.target.value = '';
    });

    /* ---- Search + / shortcut ---- */
    searchEl.addEventListener('input', () => { search.value = searchEl.value; });
    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== searchEl) {
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
      [allFiles, currentRel, currentKey, recentRels, collapsed, search, changeMeta, highlights]);
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
  }
}

customElements.define('osv-file-list', OsvFileList);

function toggleGroup(g) {
  const s = new Set(collapsed.value);
  if (s.has(g)) s.delete(g); else s.add(g);
  collapsed.value = s;
  try { localStorage.setItem('osviewer.collapsed', JSON.stringify([...s])); } catch (e) {}
}

function buildListHtml() {
  const q = search.value.trim().toLowerCase();
  const forceOpen = q.length > 0; // searching always expands groups

  const sections = [];
  for (const g of GROUPS) {
    if (g === 'Archive' || g === 'Changes') {
      // One row per change (active or archived), labeled with its name.
      const keys = [...new Set(allFiles.value
        .filter(f => groupOf(f.rel) === g)
        .map(f => changeOf(f.rel)))];
      const rows = keys.map(k => changeMeta.value.get(k))
        .filter(m => m && (!q || (m.label + ' ' + m.dir + ' ' + m.key).toLowerCase().includes(q)));
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

  let out = sections.length ? '' : '<div class="empty">No artifacts found.</div>';

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
        ${newCount ? html`<span class="group-new">+${newCount} new</span>` : ''}
        <span class="group-count">${items.length}</span>
      </div>`;
    if (!isCollapsed) {
      if (g === 'Archive' || g === 'Changes') {
        sec.rows.forEach(m => {
          const active = m.key === currentKey.value;
          const isNew = m.files.some(f => recentRels.value.has(f.rel));
          const cnt = m.files.reduce((s, f) => s + (highlights.value.get(f.rel) || []).length, 0);
          out += html`<div class="item change-row${active ? ' active' : ''}${isNew ? ' new' : ''}" data-key="${m.key}">
            ${isNew ? html`<span class="new-dot" title="Updated since last scan"></span>` : ''}
            <span class="path">${m.label}</span>
            ${cnt ? html`<span class="cmt-count">${cnt}</span>` : ''}
            ${diffHint(m.files.map(f => diffInfo.get(f.rel)).filter(Boolean))}
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
            ${isNew ? html`<span class="new-dot" title="Updated since last scan"></span>` : ''}
            <span class="path">${displayLabel(f.rel, g)}</span>
            ${cnt ? html`<span class="cmt-count">${cnt}</span>` : ''}
            ${diffHint([diffInfo.get(f.rel)].filter(Boolean))}
            ${badge}
          </div>`;
        });
      }
    }
  });

  return out;
}
