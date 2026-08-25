/* End-to-end test for desktop panel visibility (v3.9.0): at ≥62em the user
 * can hide/show the review panel via its own close control (the header no
 * longer has a review toggle) and the file list sidebar via a header toggle;
 * a hidden review shows a floating restore pill with the item count;
 * add/delete/copy stay fully possible (the drawer is never unmounted); the
 * sidebar keeps its selection when toggled; both choices persist across
 * reloads; and below 62em the toggles/pill/close control are absent and the
 * mobile auto behavior is unchanged even with a saved hidden choice.
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
      pillVisible: !document.querySelector('osv-review .review-pill').hidden,
      pillCount: (() => { const c = document.querySelector('osv-review .review-pill-count'); return c.hidden ? null : c.textContent.trim(); })(),
      headerReviewToggle: !!document.querySelector('.toggle-review'),
      closePresent: !!document.querySelector('osv-review .review-close'),
      sidebarTogglePressed: document.querySelector('.toggle-sidebar').getAttribute('aria-pressed'),
      rows: document.querySelectorAll('osv-review .rv-item').length,
      copyDisabled: document.querySelector('osv-review .copy-btn').disabled,
    };
  });
  const click = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel);

  const s1 = await state();
  out.steps.push('baseline: ' + JSON.stringify(s1));
  if (s1.hideReview || s1.hideSidebar) err('baseline should have no hide classes');
  if (!s1.drawerVisible || s1.reviewW !== 380) err('review panel should be a visible 380px column');
  if (s1.pillVisible) err('no pill should show while the panel is visible');
  if (!s1.closePresent) err('the review panel should show its own close control');
  if (s1.headerReviewToggle) err('the header must have no review toggle (moved onto the panel)');
  if (s1.sidebarTogglePressed !== 'false') err('sidebar toggle should start unpressed');

  // ---- 2) Add a whole-file comment (panel visible). ----
  await click('osv-pane .comment-toggle');
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.querySelector('osv-pane .cf-text').value = 'Rewrite in active voice.';
    document.querySelector('osv-pane .cf-save').click();
  });
  await page.waitForTimeout(250);
  let s = await state();
  out.steps.push('after-comment: ' + JSON.stringify(s));
  if (s.rows !== 1) err('should show 1 review row, got ' + s.rows);
  if (s.copyDisabled) err('copy should be enabled with a comment');

  // ---- 3) Close the review panel from its own close control: pane widens,
  //         pill appears with count. ----
  // Tag the drawer node so we can prove it is never unmounted (task 3.3).
  await page.evaluate(() => { document.querySelector('osv-review .review-drawer').dataset.tag = 'KEEP'; });
  await click('osv-review .review-close');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-hide-review: ' + JSON.stringify(s));
  if (!s.hideReview) err('body.hide-review should be set');
  if (s.drawerVisible) err('review drawer should be hidden');
  if (s.reviewW !== 0) err('review column should collapse to 0 width, got ' + s.reviewW);
  if (s.paneW < 700) err('pane should widen past the freed 380px column, got ' + s.paneW);
  if (!s.pillVisible || s.pillCount !== '1') err('pill should show with count 1, got visible=' + s.pillVisible + ' count=' + s.pillCount);
  if (s.headerReviewToggle) err('header must have no review toggle');

  // ---- 4) Add a comment WHILE hidden: still recorded (pill count grows). ----
  await click('osv-pane .comment-toggle');
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.querySelector('osv-pane .cf-text').value = 'Add acceptance criteria.';
    document.querySelector('osv-pane .cf-save').click();
  });
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-hidden-add: ' + JSON.stringify(s));
  if (s.pillCount !== '2') err('hidden add should raise pill count to 2, got ' + s.pillCount);

  // ---- 5) Restore via the pill: drawer back, delete + copy work. ----
  await click('osv-review .review-pill');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-restore: ' + JSON.stringify(s));
  if (s.hideReview) err('restore should clear body.hide-review');
  if (!s.drawerVisible || s.reviewW !== 380) err('drawer should be a 380px column again');
  if (s.pillVisible) err('pill should vanish once the panel is visible');
  if (s.rows !== 2) err('restored panel should hold both comments, got ' + s.rows);
  if (s.copyDisabled) err('copy must be enabled after restore');
  const kept = await page.evaluate(() => document.querySelector('osv-review .review-drawer').dataset.tag === 'KEEP');
  if (!kept) err('drawer DOM node should survive hide/show (never unmounted)');
  await click('osv-review .rv-item .rv-del');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-delete: ' + JSON.stringify(s));
  if (s.rows !== 1) err('delete should leave 1 row, got ' + s.rows);

  // ---- 6) Sidebar toggle: hides/shows, selection survives. ----
  await click('.toggle-sidebar');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-hide-sidebar: ' + JSON.stringify(s));
  if (!s.hideSidebar) err('body.hide-sidebar should be set');
  if (s.sidebarW !== 0) err('sidebar should collapse to 0 width, got ' + s.sidebarW);
  if (s.paneW < 600) err('pane should widen after hiding the sidebar, got ' + s.paneW);
  await click('.toggle-sidebar');
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
  await click('osv-review .review-close');
  await click('.toggle-sidebar');
  await page.waitForTimeout(200);
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(400);
  s = await state();
  out.steps.push('after-reload: ' + JSON.stringify(s));
  if (!s.hideReview || !s.hideSidebar) err('hidden states should survive reload');
  if (s.drawerVisible || s.sidebarW !== 0) err('panels should still be hidden after reload');
  if (!s.pillVisible) err('pill should return after reload');
  if (s.headerReviewToggle) err('header must have no review toggle after reload');
  if (s.sidebarTogglePressed !== 'true') err('sidebar toggle should read pressed after reload');
  await click('osv-review .review-pill');
  await page.waitForTimeout(250);
  s = await state();
  out.steps.push('after-reload-restore: ' + JSON.stringify(s));
  if (s.hideReview) err('restore after reload should clear body.hide-review');
  if (!s.drawerVisible) err('drawer should be visible again after reload-restore');
  if (!s.hideSidebar) err('sidebar choice should stay hidden while restoring the review');

  // ---- 8) Mobile (<62em): toggles and pill absent; saved choice has no effect. ----
  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForTimeout(250);
  s = await page.evaluate(() => {
    const vis = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display !== 'none' : null; };
    return {
      togglesVisible: vis('osv-header .panel-toggle'),
      pillVisible: vis('osv-review .review-pill'),
      reviewVisible: vis('osv-review'),
      closeVisible: (() => { const el = document.querySelector('osv-review .review-close'); return el ? el.getClientRects().length > 0 : false; })(),
      navToggleVisible: vis('osv-header .nav-toggle'),
    };
  });
  out.steps.push('mobile: ' + JSON.stringify(s));
  if (s.togglesVisible !== false) err('panel toggles should be hidden below 62em');
  if (s.pillVisible !== false) err('pill should be hidden below 62em');
  if (s.reviewVisible !== false) err('review should stay auto-hidden below 62em');
  if (s.closeVisible !== false) err('panel close control should be hidden below 62em');
  if (s.navToggleVisible !== true) err('nav drawer toggle should still exist below 62em');

  // Cleanup: drop the saved panel choice so other suites run with defaults.
  await page.evaluate(() => localStorage.removeItem('osviewer.panels'));

  out.ok = out.errors.length === 0;
  console.log('=== PANEL TOGGLE TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}