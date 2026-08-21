/* End-to-end test for sidebar group collapse behavior (v2.16.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=collapse-test.js
 *
 * Verifies: Config (like Archive) is collapsed by default on first visit;
 * Changes/Specs stay expanded; a collapsed header still shows its item count;
 * clicking Config expands it and the choice persists across a reload; and the
 * Archive default is unchanged. localStorage is cleared once at the start so
 * the first-visit default applies deterministically.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const fsData = {
    'openspec/config.yaml': { text: 'extends: openspec\n', mtime: 1000 },
    'openspec/config/schema.yaml': { text: 'baselines: []\n', mtime: 1100 },
    'openspec/specs/acct/spec.md': { text: '# Acct Spec\n\nA capability.\n', mtime: 1200 },
    'openspec/changes/alpha/proposal.md': { text: '# Alpha Proposal\n\nGoal.\n', mtime: 1300 },
    'openspec/changes/alpha/design.md': { text: '# Design\n\nHow.\n', mtime: 1400 },
    'openspec/changes/archive/2025-01-01-beta/proposal.md': { text: '# Beta Proposal\n\nOld.\n', mtime: 1500 },
  };

  // Stub the File System Access API. localStorage is cleared explicitly right
  // before the first pick (below) so the first-visit default applies regardless
  // of any prior state in the persistent playwright session; keeping it here
  // avoids clearing again on the later persistence-reload. sessionStorage is
  // not used at all, as it survives across run-code invocations in the same tab.
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
        kind: 'directory', name,
        queryPermission: async () => 'granted',
        values: async function* () {
          for (const [d, c] of Object.entries(n.dirs)) yield makeDir(d, c);
          for (const [f, data] of Object.entries(n.files)) {
            yield { kind: 'file', name: f, getFile: async () => ({ lastModified: data.mtime, text: async () => data.text }) };
          }
        },
      };
    }
    window.__makeFs = () => makeDir('openspec', buildNode());
    window.showDirectoryPicker = async () => window.__makeFs();
  }, fsData);

  const CONSOLE = (msg) => { if (msg.type() === 'error') out.errors.push('CONSOLE: ' + msg.text()); };
  page.on('console', CONSOLE);

  await page.goto('http://127.0.0.1:8743/index.html');
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  // ---- Bypass a stale service-worker / HTTP cache (cache-first SW can serve
  // old on-disk modules; see diff-test.js / AGENTS.md). ----
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
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
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
    return {
      cfgCollapsed: cfg.classList.contains('collapsed'),
      cfgItems: document.querySelectorAll('.item[data-rel="config.yaml"], .item[data-rel="config/schema.yaml"]').length,
      stored: localStorage.getItem('osviewer.collapsed'),
    };
  });
  out.steps.push('after-click: ' + JSON.stringify(state));
  if (state.cfgCollapsed) err('Config header should be expanded after click');
  if (state.cfgItems !== 2) err('expanded Config should show both items, got ' + state.cfgItems);
  if (state.stored !== '["Archive"]') err('expanding Config should persist only Archive as collapsed, got ' + state.stored);

  // ---- Real reload: the persisted choice is honored (Config stays expanded,
  // Archive collapses), proving it beats the first-visit default. ----
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
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
  out.steps.push('after-reload: ' + JSON.stringify(state));
  if (state.cfgCollapsed !== false) err('persisted expanded Config should stay expanded after reload, got cfgCollapsed=' + state.cfgCollapsed);
  if (state.arcCollapsed !== true) err('Archive should stay collapsed after reload, got arcCollapsed=' + state.arcCollapsed);
  if (state.cfgItems !== 2) err('expanded Config should show items after reload, got ' + state.cfgItems);

  out.ok = out.errors.length === 0;
  console.log('=== COLLAPSE TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}
