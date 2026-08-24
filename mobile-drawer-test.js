/* End-to-end test for the mobile navigation drawer (v3.6.0): below 62em the
 * folder rail and the artifact list are hidden behind a slide-over drawer
 * (full pane width while closed); the header toggle opens it; picking a
 * file/folder closes it; Escape, backdrop, and the close button each close
 * it; sidebar selection/scroll survive open/close cycles; and at ≥62em no
 * toggle exists and the rail + sidebar are layout columns again.
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=mobile-drawer-test.js
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  // Folder A (monitored, stubbed picker): enough open changes that the
  // sidebar list overflows the drawer, so scroll preservation is observable.
  const fsA = {
    'openspec/config.yaml': { text: 'extends: openspec\n', mtime: 1000 },
    'openspec/config/schema.yaml': { text: 'baselines: []\n', mtime: 1100 },
    'openspec/specs/cap/spec.md': { text: '# Cap Spec\n\n## Requirements\n\n- REQ-1\n', mtime: 1200 },
    'openspec/changes/alpha/proposal.md': { text: '# Alpha Proposal\n\nGoal.\n', mtime: 1300 },
    'openspec/changes/alpha/design.md': { text: '# Design\n\nHow.\n', mtime: 1400 },
    'openspec/changes/alpha/tasks.md': { text: '- [ ] 1.1 Do it\n', mtime: 1500 },
  };
  for (let i = 0; i < 26; i++) {
    fsA[`openspec/changes/change-${String(i).padStart(2, '0')}/proposal.md`] =
      { text: `# Change ${i}\n\nStep ${i}.\n`, mtime: 2000 + i };
    fsA[`openspec/changes/change-${String(i).padStart(2, '0')}/design.md`] =
      { text: `# Design ${i}\n\nHow ${i}.\n`, mtime: 3000 + i };
  }

  await page.addInitScript(([A]) => {
    window.__fsDataA = A;
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
    window.__makeFs = () => makeDir('repoA', 'A', buildNode(A));
    window.showDirectoryPicker = async () => window.__makeFs();
  }, [fsA]);

  const CONSOLE = (msg) => { if (msg.type() === 'error') out.errors.push('CONSOLE: ' + msg.text()); };
  page.on('console', CONSOLE);

  // Narrow viewport (below the 62em / 992px desktop breakpoint).
  await page.setViewportSize({ width: 390, height: 700 });
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

  // Deterministic first-visit: clear persisted state, then open folder A.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForTimeout(400);

  const vis = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return 'missing';
    return getComputedStyle(el).visibility;
  }, sel);
  const drawerState = () => page.evaluate(() => {
    const d = document.querySelector('osv-nav-drawer');
    const pane = document.querySelector('osv-pane');
    const toggle = document.querySelector('.nav-toggle');
    const rail = document.querySelector('osv-folder-rail');
    const fileList = document.querySelector('osv-file-list');
    return {
      open: d ? d.classList.contains('open') : null,
      drawerVisibility: d ? getComputedStyle(d).visibility : null,
      paneWidth: pane ? Math.round(pane.getBoundingClientRect().width) : null,
      viewportWidth: window.innerWidth,
      toggleDisplay: toggle ? getComputedStyle(toggle).display : null,
      railVisibility: rail ? getComputedStyle(rail).visibility : null,
      listVisibility: fileList ? getComputedStyle(fileList).visibility : null,
    };
  });

  // ---- 1. Narrow screen: panels hidden behind the drawer, pane full width. ----
  let st = await drawerState();
  out.steps.push('closed-drawer: ' + JSON.stringify(st));
  if (st.drawerVisibility !== 'hidden') err('drawer should be hidden when closed, got ' + st.drawerVisibility);
  if (st.railVisibility !== 'hidden' || st.listVisibility !== 'hidden')
    err('rail/sidebar must be hidden behind the drawer, got ' + st.railVisibility + '/' + st.listVisibility);
  if (st.toggleDisplay === 'none') err('header nav toggle should be visible on a narrow screen');
  if (!st.paneWidth || st.paneWidth < 380) err('pane should span (near) full width when closed, got ' + st.paneWidth);

  // ---- 2. Toggle opens the drawer; rail + sidebar visible inside. ----
  await page.click('.nav-toggle');
  await page.waitForTimeout(400);
  st = await drawerState();
  const inside = await page.evaluate(() => ({
    avatars: document.querySelectorAll('osv-nav-drawer .rail-avatar').length,
    items: document.querySelectorAll('osv-nav-drawer .item[data-rel], osv-nav-drawer .item[data-key]').length,
    focusedClose: document.activeElement && document.activeElement.classList.contains('nav-close'),
    toggleExpanded: document.querySelector('.nav-toggle').getAttribute('aria-expanded'),
  }));
  out.steps.push('open-drawer: ' + JSON.stringify(Object.assign(st, inside)));
  if (!st.open) err('drawer should be open after toggling');
  if (inside.avatars < 1) err('drawer should show folder avatars, got ' + inside.avatars);
  if (inside.items < 1) err('drawer should show sidebar items, got ' + inside.items);
  if (!inside.focusedClose) err('focus should move to the drawer close button on open');
  if (inside.toggleExpanded !== 'true') err('toggle should report aria-expanded=true when open');

  // Make the sidebar scroll so scroll preservation is observable.
  const scrollTest = await page.evaluate(() => {
    const el = document.querySelector('osv-nav-drawer .list-scroll');
    el.scrollTop = el.scrollHeight;
    return { top: el.scrollTop, max: el.scrollHeight };
  });
  out.steps.push('scroll-set: ' + JSON.stringify(scrollTest));
  if (scrollTest.top <= 0) err('sidebar list should be scrollable inside the drawer, got ' + JSON.stringify(scrollTest));

  // ---- 3. Picking a file closes the drawer and shows it in the pane. ----
  await page.click('.item[data-rel="specs/cap/spec.md"]');
  await page.waitForTimeout(400);
  st = await drawerState();
  const picked = await page.evaluate(() => ({
    artifact: !!document.querySelector('.pane-body .markdown'),
    activeRow: !!document.querySelector('osv-nav-drawer .item.active[data-rel="specs/cap/spec.md"]'),
  }));
  out.steps.push('after-pick: ' + JSON.stringify(Object.assign(st, picked)));
  if (st.open) err('drawer should close after picking a file');
  if (!picked.artifact) err('picked artifact should show in the pane');
  if (!picked.activeRow) err('picked row should keep the active state');

  // ---- 4. Reopening preserves selection and scroll. ----
  await page.click('.nav-toggle');
  await page.waitForTimeout(400);
  const reopened = await page.evaluate(() => {
    const el = document.querySelector('osv-nav-drawer .list-scroll');
    return {
      scrollTop: el.scrollTop,
      activeRow: !!document.querySelector('osv-nav-drawer .item.active[data-rel="specs/cap/spec.md"]'),
    };
  });
  out.steps.push('reopened: ' + JSON.stringify(reopened));
  if (Math.abs(reopened.scrollTop - scrollTest.top) > 1) err('scrolled position should survive a close/reopen, got ' + reopened.scrollTop);
  if (!reopened.activeRow) err('selection should survive a close/reopen');

  // ---- 5. Escape closes and returns focus to the toggle. ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  st = await drawerState();
  const escFocus = await page.evaluate(() => document.activeElement &&
    document.activeElement.classList.contains('nav-toggle'));
  out.steps.push('esc-close: ' + JSON.stringify(Object.assign(st, { focusToggle: escFocus })));
  if (st.open) err('Escape should close the drawer');
  if (!escFocus) err('Escape should return focus to the header toggle');

  // ---- 6. Backdrop click closes. ----
  await page.click('.nav-toggle');
  await page.waitForTimeout(400);
  await page.click('.nav-backdrop', { position: { x: 380, y: 350 } });
  await page.waitForTimeout(400);
  st = await drawerState();
  out.steps.push('backdrop-close: ' + JSON.stringify(st));
  if (st.open) err('backdrop click should close the drawer');

  // ---- 7. Close button closes. ----
  await page.click('.nav-toggle');
  await page.waitForTimeout(400);
  await page.click('.nav-close');
  await page.waitForTimeout(400);
  st = await drawerState();
  out.steps.push('close-btn-close: ' + JSON.stringify(st));
  if (st.open) err('close button should close the drawer');

  // ---- 8. Choosing a folder from the drawer closes it (uploaded folder). ----
  // Real upload fallback (the path mobile users actually use — no
  // showDirectoryPicker on phones): drive the hidden #picker webkitdirectory
  // input through its change handler with a DataTransfer of files whose names
  // carry the full phone-repo/openspec/... paths (addUploadFolder reads
  // webkitRelativePath || name).
  await page.click('.nav-toggle');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['extends: openspec\n'], 'phone-repo/openspec/config.yaml', { type: 'text/plain' }));
    dt.items.add(new File(['# Cap\n\nReq.\n'], 'phone-repo/openspec/specs/cap/spec.md', { type: 'text/markdown' }));
    dt.items.add(new File(['# Beta Proposal\n\nGoal.\n'], 'phone-repo/openspec/changes/beta/proposal.md', { type: 'text/markdown' }));
    const input = document.querySelector('#picker');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  const afterUpload = await page.evaluate(() => ({
    avatars: document.querySelectorAll('osv-nav-drawer .rail-avatar').length,
    open: document.querySelector('osv-nav-drawer').classList.contains('open'),
    active: window.folderName(window.activeFolderId()),
  }));
  out.steps.push('uploaded: ' + JSON.stringify(afterUpload));
  if (afterUpload.avatars < 2) err('uploaded folder should add a second avatar, got ' + afterUpload.avatars);
  if (afterUpload.open) err('adding a folder (activating it) should close the drawer');
  if (afterUpload.active !== 'phone-repo') err('uploaded folder should become active, got ' + afterUpload.active);

  // Picking the OTHER folder's avatar closes the drawer and switches the view.
  await page.click('.nav-toggle');
  await page.waitForTimeout(400);
  await page.click('osv-nav-drawer .rail-avatar[title="repoA"]');
  await page.waitForTimeout(400);
  const folderPick = await page.evaluate(() => ({
    open: document.querySelector('osv-nav-drawer').classList.contains('open'),
    active: window.folderName(window.activeFolderId()),
  }));
  out.steps.push('after-folder-pick: ' + JSON.stringify(folderPick));
  if (folderPick.open) err('drawer should close after picking a folder');
  if (folderPick.active !== 'repoA') err('picked folder should become active, got ' + folderPick.active);

  // ---- 9. Desktop (≥62em): no toggle; rail + sidebar are layout columns. ----
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(400);
  const desktop = await page.evaluate(() => {
    const rail = document.querySelector('osv-folder-rail');
    const fileList = document.querySelector('osv-file-list');
    const drawer = document.querySelector('osv-nav-drawer');
    const toggle = document.querySelector('.nav-toggle');
    const railBox = rail.getBoundingClientRect();
    const listBox = fileList.getBoundingClientRect();
    return {
      toggleDisplay: toggle ? getComputedStyle(toggle).display : null,
      drawerDisplay: drawer ? getComputedStyle(drawer).display : null,
      railVisible: getComputedStyle(rail).visibility,
      railLeft: Math.round(railBox.left), railRight: Math.round(railBox.right),
      listLeft: Math.round(listBox.left),
    };
  });
  out.steps.push('desktop: ' + JSON.stringify(desktop));
  if (desktop.toggleDisplay !== 'none') err('nav toggle should be hidden at desktop widths, got ' + desktop.toggleDisplay);
  if (desktop.drawerDisplay !== 'contents') err('drawer should be display:contents at desktop widths, got ' + desktop.drawerDisplay);
  if (desktop.railVisible !== 'visible') err('rail should be visible at desktop widths');
  if (desktop.railRight > desktop.listLeft) err('rail and sidebar should be side-by-side columns at desktop widths');

  out.ok = out.errors.length === 0;
  console.log('=== MOBILE DRAWER TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}