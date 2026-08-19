/* End-to-end test for content-level change diffs (v1.11.0, extended in v1.12.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=diff-test.js
 *
 * Stubs the File System Access API with an in-memory tree, then exercises the
 * real scan -> snapshot (IndexedDB) -> line-diff -> render pipeline:
 * fresh-pick baseline, in-session mutation, flat (non-change) artifacts, the
 * breadcrumb Diff/Artifact toggle (default view is the artifact, never the
 * diff), NEW badges, per-tab diff badges (+a −r), live badge updates when a
 * sibling file in the open change diffs, and the reload-equivalent
 * keepSnapshots path.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const fsData = {
    'openspec/changes/alpha/proposal.md': {
      text: '# Alpha Proposal\n\n## Goal\n\nImprove the thing.\n\n## Tasks\n\n- [ ] Ship it\n',
      mtime: 1000,
    },
    'openspec/changes/alpha/design.md': { text: '# Design\n\nKeep it simple.\n', mtime: 1100 },
    'openspec/changes/alpha/tasks.md': { text: '- [ ] do it\n', mtime: 1200 },
    'openspec/changes/alpha/change.md': { text: '# Change\n\nSummary here.\n', mtime: 1300 },
    'openspec/specs/cap/spec.md': {
      text: '# Cap Spec\n\n## Requirements\n\n- REQ-1\n- REQ-2\n\n## Notes\n\nKeep notes here.\n',
      mtime: 1400,
    },
    'openspec/config.yaml': { text: 'extends: openspec\n', mtime: 1500 },
  };

  await page.addInitScript((files) => {
    window.__fsData = files;
    function buildNode() {
      const node = { dirs: {}, files: {} };
      for (const [p, data] of Object.entries(window.__fsData)) {
        const segs = p.split('/');
        let cur = node;
        for (let i = 0; i < segs.length - 1; i++) {
          const s = segs[i];
          if (!cur.dirs[s]) cur.dirs[s] = { dirs: {}, files: {} };
          cur = cur.dirs[s];
        }
        cur.files[segs[segs.length - 1]] = data;
      }
      return node;
    }
    function makeDir(name, n) {
      return {
        kind: 'directory',
        name,
        queryPermission: async () => 'granted',
        values: async function* () {
          for (const [d, c] of Object.entries(n.dirs)) yield makeDir(d, c);
          for (const [f, data] of Object.entries(n.files)) {
            yield {
              kind: 'file',
              name: f,
              getFile: async () => ({ lastModified: data.mtime, text: async () => data.text }),
            };
          }
        },
      };
    }
    window.__makeFs = () => makeDir('repo', buildNode());
    window.showDirectoryPicker = async () => window.__makeFs();
  }, fsData);

  const CONSOLE = (msg) => { if (msg.type() === 'error') out.errors.push('CONSOLE: ' + msg.text()); };
  page.on('console', CONSOLE);

  await page.goto('http://127.0.0.1:8743/index.html');
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  // ---- Bypass a stale service-worker / HTTP cache from earlier sessions so the
  // test always exercises the current on-disk modules (see AGENTS.md: the SW
  // serves same-origin assets cache-first, so local edits can look stale). ----
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  });
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Network.clearBrowserCookies');
  } catch (e) { /* CDP unavailable — the SW/unregister + hard reload still help */ }
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  // ---- Session 1: fresh pick, baseline scan ----
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForTimeout(200);
  let state = await page.evaluate(() => ({
    newDots: document.querySelectorAll('.item.new').length,
    toggles: document.querySelectorAll('.diff-toggle').length,
    diffs: document.querySelectorAll('.diff').length,
    hasBar: !!document.querySelector('.pane-bar .crumb'),
  }));
  out.steps.push('baseline: ' + JSON.stringify(state));
  if (state.newDots !== 0) err('baseline should have no new markers');
  if (state.toggles !== 0 || state.diffs !== 0) err('baseline should have no diff UI');
  if (!state.hasBar) err('pane bar with breadcrumb should render');

  // ---- Mutate the proposal (2 lines changed, 2 added) ----
  await page.evaluate(() => {
    const d = window.__fsData['openspec/changes/alpha/proposal.md'];
    d.mtime = 2000;
    d.text = '# Alpha Proposal\n\n## Goal\n\nImprove the thing thoroughly.\n\n## Tasks\n\n- [x] Ship it\n- [ ] Ship it well\n- [ ] Update docs\n';
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(200);

  state = await page.evaluate(() => {
    const b = document.querySelector('.diff-toggle');
    return {
      // default view is the artifact, not the diff
      diffShown: document.querySelector('.diff') !== null,
      artifactShown: !!document.querySelector('.pane-body .markdown'),
      toggle: b ? b.textContent.replace(/\s+/g, ' ').trim() : null,
      toggleNew: b ? !!b.querySelector('.diff-new') : false,
      adds: b ? b.querySelectorAll('.dh-add').length : 0,
      del: b ? b.querySelectorAll('.dh-del').length : 0,
      tabs: [...document.querySelectorAll('.tab')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
    };
  });
  out.steps.push('after-mutation: ' + JSON.stringify(state));
  if (state.diffShown) err('diff must NOT be shown by default (only on toggle)');
  if (!state.artifactShown) err('artifact view should be the default');
  if (!state.toggle || !state.toggle.includes('Diff') || !state.toggle.includes('+4') || !state.toggle.includes('−2')) {
    err('toggle should read "Diff +4 −2", got ' + state.toggle);
  }
  if (!state.toggleNew) err('unseen diff should carry a NEW badge');
  const proposalTab = state.tabs.find(t => t.startsWith('Proposal'));
  const designTab = state.tabs.find(t => t.startsWith('Design'));
  const tasksTab = state.tabs.find(t => t.startsWith('Tasks'));
  if (!proposalTab || !proposalTab.includes('+4') || !proposalTab.includes('−2')) err('Proposal tab should carry the +4 −2 badge, got ' + proposalTab);
  if (designTab && designTab !== 'Design') err('Design tab should have no diff badge yet, got ' + designTab);
  if (tasksTab && tasksTab !== 'Tasks') err('Tasks tab should have no diff badge yet, got ' + tasksTab);

  // ---- Click the toggle: diff view ----
  await page.evaluate(() => { document.querySelector('.diff-toggle').click(); });
  await page.waitForTimeout(150);
  state = await page.evaluate(() => ({
    diffShown: document.querySelector('.diff') !== null,
    addLines: document.querySelectorAll('.diff-line.add').length,
    delLines: document.querySelectorAll('.diff-line.del').length,
    hasHdr: document.querySelector('.diff-line.hdr') !== null,
    toggle: document.querySelector('.diff-toggle').textContent.replace(/\s+/g, ' ').trim(),
    diffTs: document.querySelector('.diff-ts') ? document.querySelector('.diff-ts').textContent : null,
  }));
  out.steps.push('toggle-on: ' + JSON.stringify(state));
  if (!state.diffShown) err('diff view should show after toggling');
  if (state.addLines !== 4) err('expected 4 added lines, got ' + state.addLines);
  if (state.delLines !== 2) err('expected 2 deleted lines, got ' + state.delLines);
  if (!state.hasHdr) err('diff should include hunk header');
  if (!state.toggle.startsWith('Artifact')) err('toggle should now offer to switch back, got ' + state.toggle);

  // ---- After reading the diff, the read file's tab badge and list hints clear ----
  state = await page.evaluate(() => {
    const alpha = [...document.querySelectorAll('.change-row[data-key]')].find(r => r.dataset.key === 'changes/alpha');
    const toggle = document.querySelector('.diff-toggle');
    return {
      activeTab: document.querySelector('.tab.active') ? document.querySelector('.tab.active').textContent.replace(/\s+/g, ' ').trim() : null,
      alphaNew: alpha ? alpha.classList.contains('new') : false,
      alphaHint: alpha && alpha.querySelector('.diff-hint') ? alpha.querySelector('.diff-hint').textContent.trim() : null,
      toggleCount: toggle ? (!!toggle.querySelector('.dh-add') || !!toggle.querySelector('.dh-del')) : false,
    };
  });
  out.steps.push('read-clears-labels: ' + JSON.stringify(state));
  if (state.activeTab !== 'Proposal') err('reading a diff should clear its tab count badge, got ' + state.activeTab);
  if (state.alphaNew) err('a change with all files read should lose its unread marker');
  if (state.alphaHint) err('list hint should show only unread changes, got ' + state.alphaHint);
  if (state.toggleCount) err('reading a diff should clear its +a −r counts on the toggle button');

  // ---- Toggle back: artifact view ----
  await page.evaluate(() => { document.querySelector('.diff-toggle').click(); });
  await page.waitForTimeout(150);
  state = await page.evaluate(() => ({
    diffShown: document.querySelector('.diff') !== null,
    artifactShown: !!document.querySelector('.pane-body .markdown'),
  }));
  out.steps.push('toggle-off: ' + JSON.stringify(state));
  if (state.diffShown) err('diff should hide after toggling back');
  if (!state.artifactShown) err('artifact view should return after toggling back');

  // ---- Mutate a spec (flat item, not open) ----
  await page.evaluate(() => {
    const d = window.__fsData['openspec/specs/cap/spec.md'];
    d.mtime = 3000;
    d.text = '# Cap Spec\n\n## Requirements\n\n- REQ-1\n- REQ-2\n- REQ-3\n\n## Notes\n\nKeep notes here.\n';
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(200);
  state = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.item[data-rel]')].find(i => i.dataset.rel === 'specs/cap/spec.md');
    return {
      itemHint: item && item.querySelector('.diff-hint') ? item.querySelector('.diff-hint').textContent.trim() : null,
      itemNew: item ? item.classList.contains('new') : false,
    };
  });
  out.steps.push('spec-mutation: ' + JSON.stringify(state));
  if (state.itemHint !== '+1') err('expected spec hint "+1", got ' + state.itemHint);
  if (!state.itemNew) err('spec item should keep its new marker while unopened');

  // ---- Open the spec: toggle appears with NEW badge, diff toggle works ----
  await page.evaluate(async () => { await window.openFile('specs/cap/spec.md'); });
  await page.waitForTimeout(150);
  state = await page.evaluate(() => ({
    toggle: document.querySelector('.diff-toggle') ? document.querySelector('.diff-toggle').textContent.replace(/\s+/g, ' ').trim() : null,
    toggleNew: document.querySelector('.diff-toggle') ? !!document.querySelector('.diff-toggle .diff-new') : false,
    diffShown: document.querySelector('.diff') !== null,
  }));
  out.steps.push('spec-open: ' + JSON.stringify(state));
  if (!state.toggle || !state.toggle.includes('+1')) err('spec toggle should show +1');
  if (!state.toggleNew) err('spec diff should be marked NEW on first open');
  if (state.diffShown) err('spec diff should not auto-show');
  await page.evaluate(() => { document.querySelector('.diff-toggle').click(); });
  await page.waitForTimeout(150);
  state = await page.evaluate(() => ({
    diffShown: document.querySelector('.diff') !== null,
    specAdds: document.querySelectorAll('.diff-line.add').length,
  }));
  out.steps.push('spec-toggle: ' + JSON.stringify(state));
  if (!state.diffShown || state.specAdds !== 1) err('spec diff should show 1 added line, got ' + JSON.stringify(state));

  // ---- Session 2: same folder re-opened (keepSnapshots) with another change ----
  await page.evaluate(() => {
    const d = window.__fsData['openspec/changes/alpha/design.md'];
    d.mtime = 4000;
    d.text = '# Design\n\nKeep it simple, but document the architecture.\n';
  });
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), true); });
  await page.waitForTimeout(200);
  state = await page.evaluate(() => ({
    toast: document.querySelector('.toast') ? document.querySelector('.toast').textContent : null,
    newItems: document.querySelectorAll('.item.new').length,
  }));
  out.steps.push('session2: ' + JSON.stringify(state));
  if (!state.toast || !state.toast.includes('since your last visit')) err('expected session2 toast, got ' + state.toast);
  if (state.newItems < 1) err('expected new markers after re-open with persisted snapshots');

  // ---- Design tab: NEW badge until viewed; toggle shows its diff ----
  await page.evaluate(async () => { await window.openChange('changes/alpha', 'changes/alpha/design.md'); });
  await page.waitForTimeout(150);
  state = await page.evaluate(() => ({
    toggle: document.querySelector('.diff-toggle') ? document.querySelector('.diff-toggle').textContent.replace(/\s+/g, ' ').trim() : null,
    toggleNew: document.querySelector('.diff-toggle') ? !!document.querySelector('.diff-toggle .diff-new') : false,
    diffShown: document.querySelector('.diff') !== null,
  }));
  out.steps.push('design-tab: ' + JSON.stringify(state));
  if (!state.toggle || !state.toggle.includes('+1')) err('design should show a toggle, got ' + state.toggle);
  if (!state.toggleNew) err('design diff should be marked NEW before being viewed');
  if (state.diffShown) err('design diff should not auto-show');
  await page.evaluate(() => { document.querySelector('.diff-toggle').click(); });
  await page.waitForTimeout(150);
  state = await page.evaluate(() => ({
    addLines: document.querySelectorAll('.diff-line.add').length,
    delLines: document.querySelectorAll('.diff-line.del').length,
    hasHdr: document.querySelector('.diff-line.hdr') !== null,
  }));
  out.steps.push('design-diff: ' + JSON.stringify(state));
  if (state.addLines !== 1 || state.delLines !== 1) {
    err('design diff should be +1 −1, got ' + JSON.stringify(state));
  }
  if (!state.hasHdr) err('design diff should include hunk header');

  // ---- Sibling diff while the change view is open: tab badge updates live - -
  // The Tasks file is not the active tab, so the pane must NOT reload; only the
  // tab badge should gain the new +1 count.
  await page.evaluate(() => {
    const d = window.__fsData['openspec/changes/alpha/tasks.md'];
    d.mtime = 5000;
    d.text = '- [ ] do it\n- [ ] also this\n';
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(200);
  state = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.tab')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
    active: document.querySelector('.tab.active') ? document.querySelector('.tab.active').textContent.replace(/\s+/g, ' ').trim() : null,
    diffShown: !!document.querySelector('.pane-body .diff'),
    toggle: document.querySelector('.diff-toggle') ? document.querySelector('.diff-toggle').textContent.replace(/\s+/g, ' ').trim() : null,
  }));
  out.steps.push('tasks-live: ' + JSON.stringify(state));
  const liveTasks = state.tabs.find(t => t.startsWith('Tasks'));
  if (!liveTasks || !liveTasks.includes('+1')) err('Tasks tab should gain a +1 badge live, got ' + liveTasks);
  if (!state.active || !state.active.startsWith('Design')) err('active tab should stay Design after a sibling diff, got ' + state.active);
  if (!state.diffShown) err('active pane should keep its current view (design diff) after a sibling diff');
  if (!state.toggle || !state.toggle.startsWith('Artifact')) err('diff toggle should stay untouched after a sibling diff, got ' + state.toggle);

  // ================= Read-state scenarios (mark-diff-as-read) =================
  // Adding a new file to the stub requires a re-pick (the running directory
  // handle is a static snapshot), which is exactly a reload: startMonitoring
  // with keepSnapshots re-reads the tree and rescans.

  // ---- R1: a brand-new artifact is unread; opening its content acknowledges it ----
  await page.evaluate(() => {
    window.__fsData['openspec/specs/epsilon/spec.md'] = { text: '# Epsilon Spec\n\nA new capability spec.\n', mtime: 6000 };
  });
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), true); });
  await page.waitForTimeout(250);
  state = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.item[data-rel]')].find(i => i.dataset.rel === 'specs/epsilon/spec.md');
    const gl = [...document.querySelectorAll('.group-label')].find(l => l.dataset.group === 'Specs');
    return {
      itemNew: item ? item.classList.contains('new') : false,
      counter: gl && gl.querySelector('.group-new') ? gl.querySelector('.group-new').textContent.trim() : null,
    };
  });
  out.steps.push('r1-new: ' + JSON.stringify(state));
  if (!state.itemNew) err('brand-new spec should be unread, got ' + JSON.stringify(state));
  if (!state.counter || !state.counter.includes('unread')) err('Specs counter should show "+N unread", got ' + state.counter);

  await page.evaluate(async () => { await window.openFile('specs/epsilon/spec.md'); });
  await page.waitForTimeout(250);
  state = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.item[data-rel]')].find(i => i.dataset.rel === 'specs/epsilon/spec.md');
    const gl = [...document.querySelectorAll('.group-label')].find(l => l.dataset.group === 'Specs');
    return {
      itemNew: item ? item.classList.contains('new') : false,
      counter: gl && gl.querySelector('.group-new') ? gl.querySelector('.group-new').textContent.trim() : null,
      artifactShown: !!document.querySelector('.pane-body .markdown'),
    };
  });
  out.steps.push('r1-open: ' + JSON.stringify(state));
  if (state.itemNew) err('opening a brand-new artifact content should acknowledge it, got new=' + state.itemNew);
  if (state.counter) err('Specs unread counter should clear after reading the new spec, got ' + state.counter);
  if (!state.artifactShown) err('brand-new file should show its artifact view');

  // ---- R2: read state survives a reload (keepSnapshots) ----
  // The just-read epsilon stays read; a change with an unread file stays unread.
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), true); });
  await page.waitForTimeout(250);
  state = await page.evaluate(() => {
    const eps = document.querySelector('.item[data-rel="specs/epsilon/spec.md"]');
    const alpha = [...document.querySelectorAll('.change-row[data-key]')].find(r => r.dataset.key === 'changes/alpha');
    return {
      epsNew: eps ? eps.classList.contains('new') : false,
      alphaNew: alpha ? alpha.classList.contains('new') : false,
    };
  });
  out.steps.push('r2-reload: ' + JSON.stringify(state));
  if (state.epsNew) err('read spec should stay read across reload, got epsNew=' + state.epsNew);
  if (!state.alphaNew) err('unread change (unread tasks) should stay unread across reload, got alphaNew=' + state.alphaNew);

  // ---- R3: editing a read file re-flags it unread ----
  await page.evaluate(() => {
    const d = window.__fsData['openspec/specs/epsilon/spec.md'];
    d.mtime = 7000;
    d.text = '# Epsilon Spec\n\nA new capability spec, revised.\n\n- REQ-add\n';
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(200);
  state = await page.evaluate(() => {
    const item = document.querySelector('.item[data-rel="specs/epsilon/spec.md"]');
    const gl = [...document.querySelectorAll('.group-label')].find(l => l.dataset.group === 'Specs');
    return {
      itemNew: item ? item.classList.contains('new') : false,
      counter: gl && gl.querySelector('.group-new') ? gl.querySelector('.group-new').textContent.trim() : null,
    };
  });
  out.steps.push('r3-reflag: ' + JSON.stringify(state));
  if (!state.itemNew) err('editing a read file should re-flag it unread, got ' + JSON.stringify(state));
  if (!state.counter || !state.counter.includes('unread')) err('Specs counter should reappear, got ' + state.counter);

  // ---- R4: two changes while unread collapse to the latest change only ----
  // Read epsilon (baseline acknowledged), then edit it twice without reading:
  // unread stays a single marker and the shown diff is only the latest change.
  await page.evaluate(async () => { await window.openFile('specs/epsilon/spec.md'); });
  await page.waitForTimeout(150);
  await page.evaluate(() => { document.querySelector('.diff-toggle').click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { document.querySelector('.diff-toggle').click(); }); // back to artifact, keep it read
  await page.waitForTimeout(150);
  await page.evaluate(async () => { await window.openFile('specs/cap/spec.md'); }); // move active away
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const d = window.__fsData['openspec/specs/epsilon/spec.md'];
    d.mtime = 7001; d.text += '// first-edit-marker\n';
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const d = window.__fsData['openspec/specs/epsilon/spec.md'];
    d.mtime = 7002; d.text = d.text.replace('// first-edit-marker', '// second-edit-marker');
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(200);
  state = await page.evaluate(() => {
    const item = document.querySelector('.item[data-rel="specs/epsilon/spec.md"]');
    return { itemNew: item ? item.classList.contains('new') : false };
  });
  out.steps.push('r4-twice-unread: ' + JSON.stringify(state));
  if (!state.itemNew) err('epsilon should be unread after two edits, got ' + JSON.stringify(state));
  await page.evaluate(async () => { await window.openFile('specs/epsilon/spec.md'); });
  await page.waitForTimeout(150);
  await page.evaluate(() => { document.querySelector('.diff-toggle').click(); });
  await page.waitForTimeout(200);
  state = await page.evaluate(() => ({
    addLines: document.querySelectorAll('.diff-line.add').length,
    delLines: document.querySelectorAll('.diff-line.del').length,
    diffText: (document.querySelector('.diff-view') || {}).textContent || '',
  }));
  out.steps.push('r4-latest-diff: ' + JSON.stringify(state));
  if (state.addLines !== 1 || state.delLines !== 1) err('only the latest change should be diffed (expected +1 −1), got ' + JSON.stringify(state));
  if (!state.diffText.includes('second-edit-marker')) err('latest diff should contain the second-edit-marker');

  // ---- R5: a file edited while its artifact view is open stays unread ----
  // cap is open in its artifact view (never toggled); editing it live re-renders
  // but the "diff exists -> don't acknowledge" branch keeps it unread.
  await page.evaluate(async () => { await window.openFile('specs/cap/spec.md'); });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const d = window.__fsData['openspec/specs/cap/spec.md'];
    d.mtime = 10000;
    d.text = '# Cap Spec\n\n## Requirements\n\n- REQ-1\n- REQ-2\n- REQ-3\n- REQ-4\n\n## Notes\n\nKeep notes here.\n';
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(250);
  state = await page.evaluate(() => {
    const item = document.querySelector('.item[data-rel="specs/cap/spec.md"]');
    return {
      itemNew: item ? item.classList.contains('new') : false,
      artifactShown: !!document.querySelector('.pane-body .markdown'),
    };
  });
  out.steps.push('r5-live-artifact: ' + JSON.stringify(state));
  if (!state.itemNew) err('a file edited while its artifact view is open should stay unread, got ' + JSON.stringify(state));

  out.ok = out.errors.length === 0;
  console.log('=== DIFF TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}