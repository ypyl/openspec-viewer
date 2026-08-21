/* End-to-end test for sidebar group collapse behavior (v2.16.0, updated for
 * multi-folder v3.0.0): Config (like Archive) is collapsed by default on
 * first visit; Changes/Specs stay expanded; a collapsed header still shows
 * its item count; clicking Config expands it; the choice persists per folder
 * (osviewer.collapsed.<folderId>) across a same-folder re-open; and a second
 * folder gets its own independent collapse state.
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=collapse-test.js
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const fsA = {
    'openspec/config.yaml': { text: 'extends: openspec\n', mtime: 1000 },
    'openspec/config/schema.yaml': { text: 'baselines: []\n', mtime: 1100 },
    'openspec/specs/acct/spec.md': { text: '# Acct Spec\n\nA capability.\n', mtime: 1200 },
    'openspec/changes/alpha/proposal.md': { text: '# Alpha Proposal\n\nGoal.\n', mtime: 1300 },
    'openspec/changes/alpha/design.md': { text: '# Design\n\nHow.\n', mtime: 1400 },
    'openspec/changes/archive/2025-01-01-beta/proposal.md': { text: '# Beta Proposal\n\nOld.\n', mtime: 1500 },
  };
  const fsB = {
    'openspec/config.yaml': { text: 'extends: openspec\n', mtime: 1000 },
    'openspec/specs/acct/spec.md': { text: '# Acct Spec\n\nB copy.\n', mtime: 2000 },
  };

  // Stub the File System Access API with two identifiable trees.
  await page.addInitScript(([A, B]) => {
    window.__fsDataA = A;
    window.__fsDataB = B;
    function buildNode(files) {
      const node = { dirs: {}, files: {} };
      for (const [p, data] of Object.entries(files)) {
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
    const DirProto = {
      kind: 'directory',
      async queryPermission() { return 'granted'; },
      async isSameEntry(other) { return !!(other && other._id && other._id === this._id); },
      async *values() {
        for (const [d, c] of Object.entries(this._node.dirs)) yield makeDir(d, this._id + '/' + d, c);
        for (const [f, data] of Object.entries(this._node.files)) {
          yield { kind: 'file', name: f, getFile: async () => ({ lastModified: data.mtime, text: async () => data.text }) };
        }
      },
    };
    function makeDir(name, id, n) {
      return Object.assign(Object.create(DirProto), { name, _id: id, _node: n });
    }
    window.__makeFs = (which) =>
      which === 'B' ? makeDir('repoB', 'B', buildNode(B)) : makeDir('repoA', 'A', buildNode(A));
    window.showDirectoryPicker = async () => window.__makeFs('A');
  }, [fsA, fsB]);

  const CONSOLE = (msg) => { if (msg.type() === 'error') out.errors.push('CONSOLE: ' + msg.text()); };
  page.on('console', CONSOLE);

  await page.goto('http://127.0.0.1:8743/index.html');
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  // ---- Bypass a stale service-worker / HTTP cache (see diff-test.js). ----
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
  } catch (e) { /* CDP unavailable — SW/unregister + hard reload still help */ }
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  // Clear any persisted collapse state and hard-reload so modules re-import
  // with empty localStorage -> deterministic first-visit defaults.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  // This first pick exercises the first-visit defaults.
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs('A'), false); });
  await page.waitForTimeout(300);

  let state = await page.evaluate(() => {
    const hdr = (g) => document.querySelector(`.group-label[data-group="${g}"]`);
    const cfg = hdr('Config'); const arc = hdr('Archive');
    const chg = hdr('Changes'); const specs = hdr('Specs');
    return {
      cfgCollapsed: cfg ? cfg.classList.contains('collapsed') : null,
      arcCollapsed: arc ? arc.classList.contains('collapsed') : null,
      chgCollapsed: chg ? chg.classList.contains('collapsed') : null,
      specsCollapsed: specs ? specs.classList.contains('collapsed') : null,
      cfgCount: cfg && cfg.querySelector('.group-count') ? cfg.querySelector('.group-count').textContent.trim() : null,
      arcCount: arc && arc.querySelector('.group-count') ? arc.querySelector('.group-count').textContent.trim() : null,
      cfgItems: document.querySelectorAll('.item[data-rel="config.yaml"], .item[data-rel="config/schema.yaml"]').length,
    };
  });
  out.steps.push('first-visit: ' + JSON.stringify(state));
  if (state.cfgCollapsed !== true) err('Config header should be collapsed on first visit, got cfgCollapsed=' + state.cfgCollapsed);
  if (state.arcCollapsed !== true) err('Archive header should stay collapsed on first visit, got arcCollapsed=' + state.arcCollapsed);
  if (state.chgCollapsed !== false) err('Changes header should stay expanded, got chgCollapsed=' + state.chgCollapsed);
  if (state.specsCollapsed !== false) err('Specs header should stay expanded, got specsCollapsed=' + state.specsCollapsed);
  if (state.cfgCount !== '2') err('collapsed Config header should show its count 2, got ' + state.cfgCount);
  if (state.arcCount !== '1') err('collapsed Archive header should show its count 1, got ' + state.arcCount);
  if (state.cfgItems !== 0) err('collapsed Config items should be hidden, got ' + state.cfgItems);

  // ---- Click Config: expands, hides the collapsed class, shows the items ----
  await page.evaluate(() => { document.querySelector('.group-label[data-group="Config"]').click(); });
  await page.waitForTimeout(150);
  state = await page.evaluate(() => {
    const cfg = document.querySelector('.group-label[data-group="Config"]');
    const key = Object.keys(localStorage).find(k => k.startsWith('osviewer.collapsed.'));
    return {
      cfgCollapsed: cfg.classList.contains('collapsed'),
      cfgItems: document.querySelectorAll('.item[data-rel="config.yaml"], .item[data-rel="config/schema.yaml"]').length,
      stored: key ? localStorage.getItem(key) : null,
    };
  });
  out.steps.push('after-click: ' + JSON.stringify(state));
  if (state.cfgCollapsed) err('Config header should be expanded after click');
  if (state.cfgItems !== 2) err('expanded Config should show both items, got ' + state.cfgItems);
  if (state.stored !== '["Archive"]') err('expanding Config should persist only Archive as collapsed, got ' + state.stored);

  // ---- Persistence: a same-folder re-open (the reload equivalent) keeps the
  // choice, because the folder id is preserved → per-folder key is read back.
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs('A'), true); });
  await page.waitForTimeout(300);
  state = await page.evaluate(() => {
    const cfg = document.querySelector('.group-label[data-group="Config"]');
    const arc = document.querySelector('.group-label[data-group="Archive"]');
    return {
      cfgCollapsed: cfg ? cfg.classList.contains('collapsed') : null,
      arcCollapsed: arc ? arc.classList.contains('collapsed') : null,
      cfgItems: document.querySelectorAll('.item[data-rel="config.yaml"], .item[data-rel="config/schema.yaml"]').length,
    };
  });
  out.steps.push('reopen: ' + JSON.stringify(state));
  if (state.cfgCollapsed !== false) err('persisted expanded Config should stay expanded on the same folder re-open, got ' + state.cfgCollapsed);
  if (state.arcCollapsed !== true) err('Archive should stay collapsed after re-open, got ' + state.arcCollapsed);
  if (state.cfgItems !== 2) err('expanded Config should show items after re-open, got ' + state.cfgItems);

  // ---- Per-folder isolation: folder B gets its own defaults (Config
  // collapsed), A keeps its expanded Config. ----
  await page.evaluate(() => { window.showDirectoryPicker = async () => window.__makeFs('B'); });
  await page.evaluate(() => { document.querySelector('.rail-add').click(); });
  await page.waitForFunction(() => window.folderCount() === 2);
  await page.waitForTimeout(300);
  state = await page.evaluate(() => {
    const cfg = document.querySelector('.group-label[data-group="Config"]');
    return { cfgCollapsed: cfg ? cfg.classList.contains('collapsed') : null };
  });
  out.steps.push('folder-B: ' + JSON.stringify(state));
  if (state.cfgCollapsed !== true) err('folder B should show its own first-visit default (Config collapsed), got ' + state.cfgCollapsed);

  await page.evaluate(() => {
    const av = [...document.querySelectorAll('.rail-avatar')].find(b => b.title && b.title.startsWith('repoA'));
    if (av) av.click();
  });
  await page.waitForTimeout(300);
  state = await page.evaluate(() => {
    const cfg = document.querySelector('.group-label[data-group="Config"]');
    return { cfgCollapsed: cfg ? cfg.classList.contains('collapsed') : null };
  });
  out.steps.push('back-to-A: ' + JSON.stringify(state));
  if (state.cfgCollapsed !== false) err('switching back to A should restore its expanded Config, got ' + state.cfgCollapsed);

  out.ok = out.errors.length === 0;
  console.log('=== COLLAPSE TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}