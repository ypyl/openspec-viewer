/* End-to-end test for "mark an archived spec/change as read when opened" (v2.17.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=archive-read-test.js
 *
 * Verifies: opening an archived change acknowledges ALL of its artifacts at
 * once — clearing the change-row unread marker and the Archive group counter —
 * and that this stays read across a reload (keepSnapshots); and that an ACTIVE
 * change is NOT bulk-acknowledged (an unread sibling stays unread when the
 * active change is opened). The Archive group is expanded at the start so its
 * per-change rows render (it is collapsed by default).
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const fsData = {
    'openspec/changes/archive/2025-01-01-old/proposal.md': { text: '# Old Proposal\n\nShipped.\n', mtime: 1000 },
    'openspec/changes/archive/2025-01-01-old/design.md': { text: '# Old Design\n\nHow.\n', mtime: 1100 },
    'openspec/changes/archive/2025-01-01-old/tasks.md': { text: '- [x] done\n', mtime: 1200 },
    'openspec/changes/active-1/proposal.md': { text: '# Active Proposal\n\nWIP.\n', mtime: 1300 },
    'openspec/changes/active-1/design.md': { text: '# Active Design\n\nDraft.\n', mtime: 1400 },
    'openspec/specs/acct/spec.md': { text: '# Acct Spec\n\nA capability.\n', mtime: 1500 },
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
  } catch (e) { /* CDP unavailable */ }
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  // The persistent playwright context carries IndexedDB across run-code
  // invocations, so a prior run's snapshots can make a repeated run look like
  // nothing changed. Clear the snapshots store so every run starts from a true
  // fresh baseline (matches what a cleared browser profile would see).
  await page.evaluate(async () => {
    const open = indexedDB.open('osviewer');
    await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
    const db = open.result;
    if (!db.objectStoreNames.contains('snapshots')) { db.close(); return; }
    await new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      tx.objectStore('snapshots').clear();
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  // ---- Fresh pick baseline, then expand the Archive group so its rows render ----
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const arc = document.querySelector('.group-label[data-group="Archive"]');
    if (arc && arc.classList.contains('collapsed')) arc.click();
  });
  await page.waitForTimeout(150);

  const snap = () => page.evaluate(() => {
    const archiveRow = document.querySelector('.change-row[data-key="changes/archive/2025-01-01-old"]');
    const activeRow = document.querySelector('.change-row[data-key="changes/active-1"]');
    const archiveG = document.querySelector('.group-label[data-group="Archive"]');
    const changesG = document.querySelector('.group-label[data-group="Changes"]');
    const cn = (g) => g && g.querySelector('.group-new') ? g.querySelector('.group-new').textContent.trim() : null;
    return {
      archiveNew: archiveRow ? archiveRow.classList.contains('new') : null,
      activeNew: activeRow ? activeRow.classList.contains('new') : null,
      archiveCounter: cn(archiveG),
      changesCounter: cn(changesG),
    };
  });

  let s = await snap();
  out.steps.push('baseline: ' + JSON.stringify(s));
  if (s.archiveNew !== false) err('fresh baseline archive change should be read, got archiveNew=' + s.archiveNew);
  if (s.archiveCounter) err('fresh baseline Archive counter should be empty, got ' + s.archiveCounter);
  if (s.activeNew !== false) err('fresh baseline active change should be read, got activeNew=' + s.activeNew);

  // ---- Make all 3 archived artifacts unread + the active sibling unread
  // (mutate in place so the running directory handle sees the change) ----
  await page.evaluate(() => {
    const arc = (p, text, mtime) => { const d = window.__fsData[p]; d.text = text; d.mtime = mtime; };
    arc('openspec/changes/archive/2025-01-01-old/proposal.md', '# Old Proposal\n\nShipped, revised.\n', 2000);
    arc('openspec/changes/archive/2025-01-01-old/design.md', '# Old Design\n\nHow, revised.\n', 2001);
    arc('openspec/changes/archive/2025-01-01-old/tasks.md', '- [x] done\n- [x] all done\n', 2002);
    const ad = window.__fsData['openspec/changes/active-1/design.md'];
    ad.text = '# Active Design\n\nDraft, revised.\n'; ad.mtime = 2003;
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(250);
  s = await snap();
  out.steps.push('unread: ' + JSON.stringify(s));
  if (s.archiveNew !== true) err('archived change should be unread after mutating it, got archiveNew=' + s.archiveNew);
  if (!s.archiveCounter || !s.archiveCounter.includes('unread')) err('Archive group counter should show unread, got ' + s.archiveCounter);
  if (s.activeNew !== true) err('active change (unread design sibling) should be unread, got activeNew=' + s.activeNew);
  if (!s.changesCounter || !s.changesCounter.includes('unread')) err('Changes counter should show the unread active change, got ' + s.changesCounter);

  // ---- Open ONE artifact inside the archived change -> whole change read at once ----
  await page.evaluate(async () => { await window.openFile('changes/archive/2025-01-01-old/tasks.md'); });
  await page.waitForTimeout(400); // bulk acknowledge is async fire-and-forget
  s = await snap();
  out.steps.push('after-archive-open: ' + JSON.stringify(s));
  if (s.archiveNew !== false) err('opening an archived change should clear its unread marker at once, got archiveNew=' + s.archiveNew);
  if (s.archiveCounter) err('Archive group counter should clear after opening the archived change, got ' + s.archiveCounter);
  if (s.activeNew !== true) err('active change sibling should remain unread, got activeNew=' + s.activeNew);
  if (!s.changesCounter || !s.changesCounter.includes('unread')) err('Changes counter should still show the unread active change, got ' + s.changesCounter);

  // ---- Reload (keepSnapshots): archived change stays read ----
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), true); });
  await page.waitForTimeout(300);
  s = await snap();
  out.steps.push('after-reload: ' + JSON.stringify(s));
  if (s.archiveNew !== false) err('archived change should stay read across reload, got archiveNew=' + s.archiveNew);
  if (s.archiveCounter) err('Archive counter should stay cleared across reload, got ' + s.archiveCounter);

  // ---- Active change is NOT bulk-acknowledged: opening it leaves the sibling unread ----
  await page.evaluate(async () => { await window.openChange('changes/active-1', 'changes/active-1/proposal.md'); });
  await page.waitForTimeout(300);
  s = await page.evaluate(() => {
    const activeRow = document.querySelector('.change-row[data-key="changes/active-1"]');
    const changesG = document.querySelector('.group-label[data-group="Changes"]');
    return {
      activeNew: activeRow ? activeRow.classList.contains('new') : null,
      changesCounter: changesG && changesG.querySelector('.group-new') ? changesG.querySelector('.group-new').textContent.trim() : null,
    };
  });
  out.steps.push('active-open: ' + JSON.stringify(s));
  if (s.activeNew !== true) err('opening an active change should NOT bulk-acknowledge its unread sibling, got activeNew=' + s.activeNew);
  if (!s.changesCounter || !s.changesCounter.includes('unread')) err('Changes counter should keep the unread sibling, got ' + s.changesCounter);

  out.ok = out.errors.length === 0;
  console.log('=== ARCHIVE READ TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}
