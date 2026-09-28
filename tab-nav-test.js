/* End-to-end test for artifact footer navigation (add-artifact-footer-nav,
 * v3.18.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=tab-nav-test.js
 *
 * Verifies: the footer row renders after a change's artifact content, names the
 * adjacent artifacts by tab label, disables Previous on the first tab and Next
 * on the last, does not wrap around, opens the target scrolled to the top, and
 * leaves a pending diff's unread badge alone. Also verifies the row is absent
 * for a single-artifact change, for a main spec, and for config.yaml, and is
 * present for an archived change.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };
  const ok = (cond, msg) => { if (cond) out.steps.push('ok: ' + msg); else err(msg); };

  // Long enough to overflow the pane, so a scroll-to-top reset is observable.
  const long = (title, n) => '# ' + title + '\n\n' + Array.from(
    { length: n },
    (_, i) => `## Section ${i + 1}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.`).join('\n\n') + '\n';

  const fsData = {
    'openspec/config.yaml': { text: '# openspec config\n', mtime: 500 },
    'openspec/specs/acct/spec.md': { text: '# Acct Spec\n\nA capability.\n', mtime: 600 },
    'openspec/changes/foo/proposal.md': { text: long('Foo Proposal', 40), mtime: 1000 },
    'openspec/changes/foo/specs/feature/spec.md': { text: long('Feature Spec', 40), mtime: 1001 },
    'openspec/changes/foo/design.md': { text: long('Foo Design', 40), mtime: 1003 },
    'openspec/changes/foo/tasks.md': { text: '- [ ] task one\n', mtime: 1004 },
    'openspec/changes/foo/.openspec.yaml': { text: 'schema: spec-driven\n', mtime: 1005 },
    // Only one artifact → one tab → no footer row.
    'openspec/changes/solo/proposal.md': { text: '# Solo Proposal\n', mtime: 1500 },
    'openspec/changes/archive/2026-08-20-old/proposal.md': { text: '# Old Proposal\n', mtime: 3000 },
    'openspec/changes/archive/2026-08-20-old/design.md': { text: '# Old Design\n', mtime: 3001 },
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

  await page.evaluate(async () => {
    localStorage.removeItem('osviewer.highlights');
    const open = indexedDB.open('osviewer');
    await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
    const db = open.result;
    if (db.objectStoreNames.contains('snapshots')) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite');
        tx.objectStore('snapshots').clear();
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
  });
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  // ---- Fresh pick baseline (single folder) ----
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForFunction(() => window.folderCount && window.folderCount() === 1);
  await page.waitForTimeout(300);

  const navState = () => page.evaluate(() => {
    const nav = document.querySelector('osv-pane .tab-nav');
    if (!nav) return { present: false };
    const prev = nav.querySelector('.tab-nav-btn.prev');
    const next = nav.querySelector('.tab-nav-btn.next');
    const txt = (el) => el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
    return {
      present: true,
      prevLabel: txt(prev), prevDisabled: prev ? prev.disabled : null,
      nextLabel: txt(next), nextDisabled: next ? next.disabled : null,
    };
  });

  const activeTab = () => page.evaluate(() => {
    const tabs = [...document.querySelectorAll('osv-pane .tab')];
    return {
      labels: tabs.map(t => t.textContent.replace(/\s+/g, ' ').trim()),
      index: tabs.findIndex(t => t.classList.contains('active')),
      navAfterBody: (() => {
        const nav = document.querySelector('osv-pane .tab-nav');
        const body = document.querySelector('osv-pane .pane-body');
        return !!(nav && body && body.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING);
      })(),
    };
  });

  const clickNav = (which) => page.evaluate((w) => {
    document.querySelector(`osv-pane .tab-nav-btn.${w}`).click();
  }, which) && page.waitForTimeout(250);

  const openChange = (key) => page.evaluate(async (k) => { await window.openChange(k); }, key) && page.waitForTimeout(300);
  const openFile = (rel) => page.evaluate(async (r) => { await window.openFile(r); }, rel) && page.waitForTimeout(300);

  // ================= Multi-artifact change: row present, first tab =================
  await openChange('changes/foo');
  let n = await navState();
  let a = await activeTab();
  out.steps.push('foo-proposal tabs: ' + JSON.stringify(a.labels));
  out.steps.push('foo-proposal nav: ' + JSON.stringify(n));
  ok(a.labels.length === 5, 'change foo has 5 artifact tabs');
  ok(n.present, 'footer navigation row renders for a multi-artifact change');
  ok(a.navAfterBody, 'row sits after the artifact body in the document flow');
  ok(n.prevDisabled === true, 'first tab disables Previous');
  ok(n.nextDisabled === false, 'first tab enables Next');
  ok(n.nextLabel === 'Spec ›', `Next names the adjacent Spec tab, got ${JSON.stringify(n.nextLabel)}`);

  // ================= Move forward through every tab =================
  await clickNav('next');
  n = await navState(); a = await activeTab();
  ok(a.index === 1, 'Next advances to the Spec tab');
  ok(n.prevLabel === '‹ Proposal', `Previous names Proposal, got ${JSON.stringify(n.prevLabel)}`);
  ok(n.nextLabel === 'Design ›', `Next names Design, got ${JSON.stringify(n.nextLabel)}`);

  await clickNav('next');
  a = await activeTab();
  ok(a.index === 2, 'Next advances to the Design tab');

  await clickNav('next');
  a = await activeTab();
  ok(a.index === 3, 'Next advances to the Tasks tab');

  await clickNav('next');
  n = await navState(); a = await activeTab();
  ok(a.index === 4, 'Next advances to the Metadata tab');
  ok(n.nextDisabled === true, 'last tab disables Next');
  ok(n.prevLabel === '‹ Tasks', `Previous names Tasks on the last tab, got ${JSON.stringify(n.prevLabel)}`);

  // ================= No wraparound =================
  await clickNav('next');
  a = await activeTab();
  ok(a.index === 4, 'activating the disabled Next on the last tab does not wrap around');

  // ================= Previous walks back =================
  await clickNav('prev');
  a = await activeTab();
  ok(a.index === 3, 'Previous returns to the Tasks tab');

  // ================= Moving opens the target scrolled to its top =================
  await openChange('changes/foo');
  await clickNav('next'); // Spec (long)
  const scrolled = await page.evaluate(() => {
    const main = document.querySelector('osv-pane main');
    main.scrollTop = main.scrollHeight;
    return { before: main.scrollTop, overflow: main.scrollHeight > main.clientHeight };
  });
  ok(scrolled.overflow && scrolled.before > 0, `pane is scrollable and scrolled down (top=${scrolled.before})`);
  await clickNav('next'); // Design (long)
  const after = await page.evaluate(() => document.querySelector('osv-pane main').scrollTop);
  ok(after === 0, `moving with the footer opens the target scrolled to the top (got ${after})`);

  // ================= Absent for a single-artifact change =================
  await openChange('changes/solo');
  n = await navState();
  a = await activeTab();
  ok(a.labels.length === 1, 'change solo has a single artifact tab');
  ok(!n.present, 'single-artifact change shows no footer navigation row');

  // ================= Absent for standalone artifacts =================
  await openFile('specs/acct/spec.md');
  n = await navState();
  ok(!n.present, 'main spec shows no footer navigation row');

  await openFile('config.yaml');
  n = await navState();
  ok(!n.present, 'config.yaml shows no footer navigation row');

  // ================= Present for an archived change =================
  await openChange('changes/archive/2026-08-20-old');
  n = await navState();
  ok(n.present, 'archived change with more than one artifact shows the row');

  // ================= A pending diff stays unread after footer navigation =================
  await page.evaluate(() => {
    const d = window.__fsData['openspec/changes/foo/design.md'];
    d.mtime = 9000;
    d.text = d.text + '\n\n## Added later\n\nA new line.\n';
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(300);

  await openChange('changes/foo');
  await clickNav('next'); // Spec
  await clickNav('next'); // Design (has a pending diff)
  const design = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('osv-pane .tab')];
    const i = tabs.findIndex(t => t.classList.contains('active'));
    const designTab = tabs[i];
    return {
      index: i,
      scrollTop: document.querySelector('osv-pane main').scrollTop,
      hasBadge: !!(designTab && designTab.querySelector('.tab-diff')),
    };
  });
  ok(design.index === 2, 'footer navigation reached the Design tab with a pending diff');
  ok(design.scrollTop === 0, 'pending-diff target also opens scrolled to the top');
  ok(design.hasBadge, 'a pending diff stays unread after footer navigation (matches tab selection)');

  out.steps.push('DONE: ' + (out.errors.length === 0 ? 'PASS' : 'FAIL (' + out.errors.length + ' errors)'));
  return out;
}
