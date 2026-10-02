/* End-to-end test for on-demand reload (change replace-polling-with-reload, v4.0.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=reload-test.js
 *
 * Stubs the File System Access API with two in-memory trees, then drives the
 * real pick -> scan -> snapshot pipeline and clicks the header's Reload
 * control (the ⟳ button that replaced the 10s polling loop):
 *   - the control is disabled with no folder and for session-only uploads,
 *     and enabled for a picked folder;
 *   - activating it rescans the active folder and refreshes the list, diffs,
 *     unread markers, and snapshots in place;
 *   - it scans ONLY the active folder (a background folder's snapshot is
 *     untouched until that folder is itself reloaded).
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const fsA = {
    'openspec/changes/alpha/proposal.md': { text: '# Alpha\n\nFirst.\n', mtime: 1000 },
    'openspec/specs/cap/spec.md': { text: '# Cap\n\n- REQ-1\n', mtime: 1100 },
  };
  const fsB = {
    'openspec/changes/beta/proposal.md': { text: '# Beta\n\nB first.\n', mtime: 2000 },
  };

  // The stub mirrors the File System Access API: getDirectoryHandle/
  // getFileHandle (openspec-root resolution + git identity), values()
  // (directory walk), queryPermission, and isSameEntry (pick dedup).
  await page.addInitScript(([A, B]) => {
    window.__fsDataA = A;
    window.__fsDataB = B;
    const DirProto = {
      kind: 'directory',
      async queryPermission() { return 'granted'; },
      async isSameEntry(other) { return !!(other && other._id && other._id === this._id); },
      async getDirectoryHandle(name) {
        const c = this._node.dirs[name];
        if (!c) { const e = new Error('not found'); e.name = 'NotFoundError'; throw e; }
        return makeDir(name, this._id + '/' + name, c);
      },
      async getFileHandle(name) {
        const d = this._node.files[name];
        if (!d) { const e = new Error('not found'); e.name = 'NotFoundError'; throw e; }
        return { kind: 'file', name, getFile: async () => ({ lastModified: d.mtime, text: async () => d.text }) };
      },
      async *values() {
        const n = this._node;
        for (const [d, c] of Object.entries(n.dirs)) yield makeDir(d, this._id + '/' + d, c);
        for (const [f, data] of Object.entries(n.files)) {
          yield {
            kind: 'file',
            name: f,
            getFile: async () => ({ lastModified: data.mtime, text: async () => data.text }),
          };
        }
      },
    };
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
    function makeDir(name, id, n) {
      return Object.assign(Object.create(DirProto), { name, _id: id, _node: n });
    }
    window.__makeFs = (which) =>
      which === 'B' ? makeDir('repoB', 'B', buildNode(B)) : makeDir('repoA', 'A', buildNode(A));
  }, [fsA, fsB]);

  const CONSOLE = (msg) => { if (msg.type() === 'error') out.errors.push('CONSOLE: ' + msg.text()); };
  page.on('console', CONSOLE);

  await page.goto('http://127.0.0.1:8743/index.html');
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  // Bypass a stale service-worker / HTTP cache so the test exercises the
  // current on-disk modules (the SW serves same-origin assets cache-first).
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
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  const reloadState = () => page.evaluate(() => {
    const b = document.querySelector('.reload-btn');
    return b ? { exists: true, disabled: b.disabled, title: b.title } : { exists: false };
  });
  const clickReload = async () => {
    await page.evaluate(() => { document.querySelector('.reload-btn').click(); });
    await page.waitForTimeout(400);
  };
  const clickAvatar = async (prefix) => {
    await page.evaluate((p) => {
      [...document.querySelectorAll('.rail-avatar')].find(b => b.title && b.title.startsWith(p)).click();
    }, prefix);
    await page.waitForTimeout(200);
  };
  const snapshotOf = (rel) => page.evaluate((r) => window.getSnapshot(r).then(s => s && s.text), rel);

  // ---- No folder open: the control is present but disabled ----
  let s = await reloadState();
  out.steps.push('no-folder: ' + JSON.stringify(s));
  if (!s.exists) err('reload button should exist in the header');
  if (!s.disabled) err('reload button should be disabled with no folder');

  // ---- Add folder A through the real rail + picker ----
  await page.evaluate(() => { window.showDirectoryPicker = async () => window.__makeFs('A'); });
  await page.evaluate(() => { document.querySelector('.rail-add').click(); });
  await page.waitForFunction(() => window.folderCount() === 1);
  await page.waitForTimeout(300);
  s = await reloadState();
  out.steps.push('pick-a: ' + JSON.stringify(s));
  if (s.disabled) err('reload button should be enabled for a picked folder');

  const baselineNew = await page.evaluate(() => document.querySelectorAll('.item.new').length);
  if (baselineNew !== 0) err('a fresh pick should have no new markers, got ' + baselineNew);

  // ---- Mutate A, then RELOAD via the control ----
  await page.evaluate(() => {
    const d = window.__fsDataA['openspec/changes/alpha/proposal.md'];
    d.mtime = 3000;
    d.text = '# Alpha\n\nFirst edited.\n';
  });
  await clickReload();
  const afterReload = await page.evaluate(() => ({
    newItems: document.querySelectorAll('.item.new').length,
    newDots: document.querySelectorAll('.new-dot').length,
    toggles: document.querySelectorAll('.diff-toggle').length,
    toggle: (document.querySelector('.diff-toggle') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(),
  }));
  const aSnap1 = await snapshotOf('changes/alpha/proposal.md');
  out.steps.push('after-reload-a: ' + JSON.stringify({ ...afterReload, snap: aSnap1 }));
  if (afterReload.newItems === 0) err('reloading should mark the changed artifact as new');
  if (afterReload.newDots === 0) err('reloading should add an unread dot for the changed artifact');
  if (!afterReload.toggles) err('reloading should surface a diff for the changed artifact');
  if (aSnap1 !== '# Alpha\n\nFirst edited.\n') err('reload should commit the new snapshot, got ' + JSON.stringify(aSnap1));

  // ---- Add folder B; mutate A again while B is active; reload (B) ----
  await page.evaluate(() => { window.showDirectoryPicker = async () => window.__makeFs('B'); });
  await page.evaluate(() => { document.querySelector('.rail-add').click(); });
  await page.waitForFunction(() => window.folderCount() === 2);
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const d = window.__fsDataA['openspec/changes/alpha/proposal.md'];
    d.mtime = 4000;
    d.text = '# Alpha\n\nFirst edited AGAIN.\n';
  });
  await clickReload();   // active folder is B — A must NOT be scanned

  await clickAvatar('repoA');
  const aSnap2 = await snapshotOf('changes/alpha/proposal.md');
  const aMarker = await page.evaluate(() => ({
    itemNew: document.querySelectorAll('.item.new').length > 0,
  }));
  out.steps.push('a-after-reload-b: ' + JSON.stringify({ snap: aSnap2, ...aMarker }));
  if (aSnap2 !== '# Alpha\n\nFirst edited.\n') err('reloading B must not rescan A: A snapshot changed to ' + JSON.stringify(aSnap2));
  if (!aMarker.itemNew) err('A should keep its earlier unread marker while unscanned');

  // Reload A itself: now the second edit is picked up.
  await clickReload();
  const aSnap3 = await snapshotOf('changes/alpha/proposal.md');
  out.steps.push('a-after-reload-a2: ' + JSON.stringify({ snap: aSnap3 }));
  if (aSnap3 !== '# Alpha\n\nFirst edited AGAIN.\n') err('reloading A should pick up the second edit, got ' + JSON.stringify(aSnap3));

  // ---- Session-only upload: the control is disabled ----
  await page.evaluate(() => {
    const mk = (rel, text) => {
      const f = new File([text], rel.split('/').pop(), { lastModified: 5 });
      Object.defineProperty(f, 'webkitRelativePath', { value: rel });
      return f;
    };
    window.addUploadFolder([mk('uploaded-repo/openspec/changes/u/proposal.md', '# U\n')]);
  });
  await page.waitForTimeout(250);
  s = await reloadState();
  out.steps.push('upload: ' + JSON.stringify(s));
  if (!s.disabled) err('reload button should be disabled for a session-only upload');

  out.ok = out.errors.length === 0;
  console.log('=== RELOAD TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}
