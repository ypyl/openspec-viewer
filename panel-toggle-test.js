/* End-to-end test for desktop panel visibility (v3.11.0): each side panel has
 * exactly one corner toggle in the header — a ☰ (top-left) hides/shows the
 * file list sidebar, a matching ☰ (top-right) hides/shows the review panel.
 * There is no in-panel close control and no floating restore pill: the
 * toggles are the sole affordances. Add/delete/copy stay fully possible (the
 * drawer is never unmounted); the sidebar keeps its selection when toggled;
 * both choices persist across reloads; and below 62em the review toggle and
 * ☰-pill/close are absent while the ☰ keeps its drawer role, with the mobile
 * auto behavior unchanged even with a saved hidden choice.
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=panel-toggle-test.js
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const fsData = {
    'openspec/changes/foo/proposal.md': { text: '# Foo Proposal\n\nWe will build the thing.\n', mtime: 1000 },
    'openspec/changes/foo/tasks.md': { text: '- [ ] task one\n', mtime: 1100 },
    'openspec/specs/acct/spec.md': { text: '# Acct Spec\n\nA capability.\n', mtime: 1200 },
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

  // Narrow DESKTOP viewport: ≥62em (992px) so the desktop layout rules apply,
  // but narrow enough that the panel toggles matter (the "dead zone").
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto('http://127.0.0.1:8743/index.html');
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  // ---- Fresh state: no saved panel choice, no highlights. ----
  await page.evaluate(async () => {
    localStorage.removeItem('osviewer.panels');
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

  // ---- Bypass a stale service-worker / HTTP cache (see diff-test.js), ----
  // ---- then reload twice so the async SW unregistration can't serve ----
  // ---- the old cached shell on the first reload. ----
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
  } catch (e) { /* CDP unavailable */ }
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForTimeout(300);
  await page.evaluate(async () => { await window.openFile('changes/foo/proposal.md'); });
  await page.waitForTimeout(400);

  const state = () => page.evaluate(() => {
    const bodyHide = (c) => document.body.classList.contains(c);
    const rect = (sel, root) => (root || document).querySelector(sel)?.getBoundingClientRect();
    return {
      hideReview: bodyHide('hide-review'),
      hideSidebar: bodyHide('hide-sidebar'),
      reviewW: Math.round(rect('osv-review').width),
      drawerVisible: rect('osv-review .review-drawer', null) && getComputedStyle(document.querySelector('osv-review .review-drawer')).display !== 'none',
      paneW: Math.round(rect('osv-pane').width),
      sidebarW: Math.round(rect('osv-file-list').width),
      pillGone: !document.querySelector('osv-review .review-pill'),
      closeGone: !document.querySelector('osv-review .review-close'),
      reviewTogglePresent: !!document.querySelector('.toggle-review'),
      reviewTogglePressed: (() => { const t = document.querySelector('.toggle-review'); return t ? t.getAttribute('aria-pressed') : null; })(),
      sidebarTogglePressed: document.querySelector('.nav-toggle').getAttribute('aria-pressed'),
      sidebarToggleGone: !document.querySelector('.toggle-sidebar'),
      rows: document.querySelectorAll('osv-review .rv-item').length,
      copyDisabled: document.querySelector('osv-review .copy-btn').disabled,
    };
  });
  const click = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel);
  // Whole-file comment via change title selection (v3.12.0): the old header 💬
  // button and .cf-text popup were removed — select the change title, then
  // type into .ann-text and save with .ann-save (as in whole-file-comment-test).
  const selectTitleForComment = () => page.evaluate(() => {
    const title = document.querySelector('osv-pane .change-head h2.change-title');
    if (!title) throw new Error('no change title found');
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(title);
    sel.removeAllRanges();
    sel.addRange(range);
    document.querySelector('osv-pane main').dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true }));
    const bub = document.querySelector('osv-pane .ann-bubble');
    if (!bub) throw new Error('no comment bubble after title selection');
    bub.querySelector('.ann-add').click();
  });
  const saveComment = (text) => page.evaluate((comment) => {
    const ta = document.querySelector('osv-pane .ann-text');
    if (!ta) throw new Error('no comment editor opened');
    ta.value = comment;
    document.querySelector('osv-pane .ann-save').click();
  }, text);

  const s1 = await state();
  out.steps.push('baseline: ' + JSON.stringify(s1));
  if (s1.hideReview || s1.hideSidebar) err('baseline should have no hide classes');
  if (!s1.drawerVisible || s1.reviewW !== 380) err('review panel should be a visible 380px column');
  if (!s1.pillGone) err('no restore pill should exist in v3.11.0');
  if (!s1.closeGone) err('no in-panel close control should exist in v3.11.0');
  if (!s1.reviewTogglePresent) err('the header should have the review toggle (☰, top-right)');
  if (s1.reviewTogglePressed !== 'false') err('review toggle should start unpressed');
  if (s1.sidebarToggleGone) { /* ok */ } else err('the top-right sidebar toggle should be removed (☰ replaces it)');
  if (s1.sidebarTogglePressed !== 'false') err('nav toggle should start unpressed');

  // ---- 2) Add a whole-file comment (panel visible). ----
  await selectTitleForComment();
  await page.waitForTimeout(150);
  await saveComment('Rewrite in active voice.');
  await page.waitForTimeout(250);
  let s = await state();
  out.steps.push('after-comment: ' + JSON.stringify(s));
  if (s.rows !== 1) err('should show 1 review row, got ' + s.rows);
  if (s.copyDisabled) err('copy should be enabled with a comment');

  // ---- 3) Hide the review panel via the top-right toggle: pane widens,
  //         no pill appears. ----
  // Tag the drawer node so we can prove it is never unmounted.
  await page.evaluate(() => { document.querySelector('osv-review .review-drawer').dataset.tag = 'KEEP'; });
  await click('.toggle-review');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-hide-review: ' + JSON.stringify(s));
  if (!s.hideReview) err('body.hide-review should be set');
  if (s.drawerVisible) err('review drawer should be hidden');
  if (s.reviewW !== 0) err('review column should collapse to 0 width, got ' + s.reviewW);
  if (s.paneW < 700) err('pane should widen past the freed 380px column, got ' + s.paneW);
  if (s.reviewTogglePressed !== 'true') err('review toggle should read pressed=true');
  if (!s.pillGone) err('no pill may appear when the review panel is hidden');

  // ---- 4) Add a comment WHILE hidden: still recorded (shown after restore). ----
  await selectTitleForComment();
  await page.waitForTimeout(150);
  await saveComment('Add acceptance criteria.');
  await page.waitForTimeout(250);

  // ---- 5) Restore via the toggle: drawer back, delete + copy work. ----
  await click('.toggle-review');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-restore: ' + JSON.stringify(s));
  if (s.hideReview) err('restore should clear body.hide-review');
  if (!s.drawerVisible || s.reviewW !== 380) err('drawer should be a 380px column again');
  if (s.reviewTogglePressed !== 'false') err('review toggle should read unpressed after restore');
  if (s.rows !== 2) err('restored panel should hold both comments (incl. the one added while hidden), got ' + s.rows);
  if (s.copyDisabled) err('copy must be enabled after restore');
  const kept = await page.evaluate(() => document.querySelector('osv-review .review-drawer').dataset.tag === 'KEEP');
  if (!kept) err('drawer DOM node should survive hide/show (never unmounted)');
  await click('osv-review .rv-item .rv-del');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-delete: ' + JSON.stringify(s));
  if (s.rows !== 1) err('delete should leave 1 row, got ' + s.rows);

  // ---- 6) Sidebar toggle (the ☰ nav toggle at desktop): hides/shows, selection survives. ----
  await click('osv-header .nav-toggle');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-hide-sidebar: ' + JSON.stringify(s));
  if (!s.hideSidebar) err('body.hide-sidebar should be set');
  if (s.sidebarW !== 0) err('sidebar should collapse to 0 width, got ' + s.sidebarW);
  if (s.paneW < 600) err('pane should widen after hiding the sidebar, got ' + s.paneW);
  await click('osv-header .nav-toggle');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-show-sidebar: ' + JSON.stringify(s));
  if (s.hideSidebar) err('showing the sidebar should clear body.hide-sidebar');
  if (s.sidebarW < 200) err('sidebar should be back at width, got ' + s.sidebarW);
  const tabActive = await page.evaluate(() => document.querySelector('osv-pane .tab.active')?.textContent || '');
  out.steps.push('active-tab: ' + tabActive);
  if (!tabActive.includes('Proposal')) err('open change/tab should survive sidebar toggling, got tab ' + tabActive);

  // ---- 7) Persistence: both hidden states survive a reload. ----
  // (The stub folder handle is gone across reloads, so review items do not
  // rehydrate here — the panel state itself, which is global, must.)
  await click('.toggle-review');
  await click('osv-header .nav-toggle');
  await page.waitForTimeout(200);
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(400);
  s = await state();
  out.steps.push('after-reload: ' + JSON.stringify(s));
  if (!s.hideReview || !s.hideSidebar) err('hidden states should survive reload');
  if (s.drawerVisible || s.sidebarW !== 0) err('panels should still be hidden after reload');
  if (s.reviewTogglePressed !== 'true' || s.sidebarTogglePressed !== 'true') err('both toggles should read pressed after reload');
  if (!s.pillGone) err('no pill may appear after reload either');
  await click('.toggle-review');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-reload-restore: ' + JSON.stringify(s));
  if (s.hideReview) err('restore after reload should clear body.hide-review');
  if (!s.drawerVisible) err('drawer should be visible again after reload-restore');
  if (!s.hideSidebar) err('sidebar choice should stay hidden while restoring the review');

  // ---- 8) Mobile (<62em): review toggle, pill, close all absent; saved choice has no effect. ----
  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForTimeout(250);
  s = await page.evaluate(() => {
    const vis = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display !== 'none' : null; };
    return {
      reviewToggleVisible: vis('osv-header .toggle-review'),
      navToggleVisible: vis('osv-header .nav-toggle'),
      pillGone: !document.querySelector('osv-review .review-pill'),
      closeGone: !document.querySelector('osv-review .review-close'),
      reviewVisible: vis('osv-review'),
    };
  });
  out.steps.push('mobile: ' + JSON.stringify(s));
  if (s.reviewToggleVisible !== false) err('review toggle should be hidden below 62em');
  if (s.navToggleVisible !== true) err('☰ should stay visible below 62em (drawer toggle)');
  if (!s.pillGone || !s.closeGone) err('no pill or in-panel close may exist at any width');
  if (s.reviewVisible !== false) err('review should stay auto-hidden below 62em');

  // Cleanup: drop the saved panel choice so other suites run with defaults.
  await page.evaluate(() => localStorage.removeItem('osviewer.panels'));

  out.ok = out.errors.length === 0;
  console.log('=== PANEL TOGGLE TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}