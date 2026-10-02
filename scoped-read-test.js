/* End-to-end test for scoped folder reads (change scoped-folder-reads, v4.1.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=scoped-read-test.js
 *
 * Stubs the File System Access API with an in-memory tree that has a large
 * archive/, then counts getFile() (stat) calls to prove the read scope:
 *   - the first read covers every group (including collapsed Archive);
 *   - a reload with Archive collapsed does not stat archive files and does not
 *     pick up an archive change;
 *   - expanding Archive reads it and surfaces the change and its counter;
 *   - the open artifact's group is read even when its group is collapsed.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const ARC = 120;
  const arcRel = (i) => `changes/archive/2026-01-01-arc-${i}/proposal.md`;
  const fsA = {
    'openspec/changes/alpha/proposal.md': { text: '# Alpha\n\nFirst.\n', mtime: 1000 },
    'openspec/specs/cap/spec.md': { text: '# Cap\n\n- REQ-1\n', mtime: 1100 },
  };
  for (let i = 0; i < ARC; i++) {
    fsA[`openspec/${arcRel(i)}`] = { text: `# Arc ${i}\n\nbody ${i}\n`, mtime: 2000 + i };
  }

  await page.addInitScript(([A]) => {
    window.__fsDataA = A;
    window.__statCount = 0;   // getFile() calls — one per stat round trip
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
        return fileHandle(name, d);
      },
      async *values() {
        const n = this._node;
        for (const [d, c] of Object.entries(n.dirs)) yield makeDir(d, this._id + '/' + d, c);
        for (const [f, data] of Object.entries(n.files)) yield fileHandle(f, data);
      },
    };
    function fileHandle(name, data) {
      return {
        kind: 'file', name,
        getFile: async () => { window.__statCount++; return { lastModified: data.mtime, text: async () => data.text }; },
      };
    }
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
    window.__makeFs = () => makeDir('repoA', 'A', buildNode(A));
  }, [fsA]);

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
    try { localStorage.clear(); } catch (e) {}   // default collapse state, no cross-test leakage
  });
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  const resetStats = () => page.evaluate(() => { window.__statCount = 0; });
  const statCount = () => page.evaluate(() => window.__statCount);
  const clickReload = async () => {
    await page.evaluate(() => { document.querySelector('.reload-btn').click(); });
    await page.waitForTimeout(500);
  };
  const clickGroup = async (g) => {
    await page.evaluate((name) => { document.querySelector(`.group-label[data-group="${name}"]`).click(); }, g);
    await page.waitForTimeout(500);
  };
  const snapshotOf = (rel) => page.evaluate((r) => window.getSnapshot(r).then(s => s && s.text), rel);

  // ---- First read covers every group ----
  await page.evaluate(() => { window.showDirectoryPicker = async () => window.__makeFs(); });
  await page.evaluate(() => { document.querySelector('.rail-add').click(); });
  await page.waitForFunction(() => window.folderCount() === 1);
  await page.waitForTimeout(500);
  const firstStats = await statCount();
  const arcSnapFirst = await snapshotOf(arcRel(0));
  out.steps.push('first-read: ' + JSON.stringify({ stats: firstStats, arcSnapshot: arcSnapFirst }));
  if (firstStats < ARC) err(`first read should stat every group, got ${firstStats} (expected >= ${ARC})`);
  if (!arcSnapFirst) err('first read should snapshot archive artifacts (collapsed groups included)');

  // ---- Mutate an archive artifact; reload with Archive collapsed ----
  await page.evaluate((rel) => {
    const d = window.__fsDataA['openspec/' + rel];
    d.mtime = 9999;
    d.text = '# Arc 0\n\nEDITED while collapsed\n';
  }, arcRel(0));
  await resetStats();
  await clickReload();
  const scopedStats = await statCount();
  const arcSnapScoped = await snapshotOf(arcRel(0));
  out.steps.push('scoped-reload: ' + JSON.stringify({ stats: scopedStats, arcSnapshot: arcSnapScoped }));
  if (scopedStats >= ARC) err(`a reload with Archive collapsed should not stat archive files, got ${scopedStats}`);
  if (arcSnapScoped !== '# Arc 0\n\nbody 0\n') err('a collapsed archive change must not be picked up by a reload, got ' + JSON.stringify(arcSnapScoped));

  // ---- Expand Archive: it is read, the change surfaces, the counter updates ----
  await clickGroup('Archive');
  const arcSnapExpanded = await snapshotOf(arcRel(0));
  const archiveLabel = await page.evaluate(() => {
    const l = document.querySelector('.group-label[data-group="Archive"]');
    const row = document.querySelector('.change-row.new');
    return {
      collapsed: l ? l.classList.contains('collapsed') : null,
      counter: l && l.querySelector('.group-new') ? l.querySelector('.group-new').textContent.trim() : null,
      newRows: document.querySelectorAll('.item.new').length,
      hasEditedRow: !!(row && row.textContent.includes('arc 0')),
    };
  });
  out.steps.push('archive-expand: ' + JSON.stringify({ arcSnapshot: arcSnapExpanded, ...archiveLabel }));
  if (arcSnapExpanded !== '# Arc 0\n\nEDITED while collapsed\n') err('expanding Archive should read it and pick up the change, got ' + JSON.stringify(arcSnapExpanded));
  if (archiveLabel.collapsed) err('Archive should be expanded after the click');
  if (!archiveLabel.counter) err('the Archive counter should reflect the unread change after the read');

  // ---- The open artifact's group is read even when collapsed ----
  await clickGroup('Archive');   // collapse the (now read) bulk again
  await page.evaluate(() => window.openFile('specs/cap/spec.md'));
  await page.waitForTimeout(150);
  await clickGroup('Specs');   // collapse it (it was expanded)
  await page.evaluate(() => {
    const d = window.__fsDataA['openspec/specs/cap/spec.md'];
    d.mtime = 8888;
    d.text = '# Cap\n\n- REQ-1\n- REQ-2 (added while collapsed)\n';
  });
  await resetStats();
  await clickReload();
  const specStats = await statCount();
  const specSnap = await snapshotOf('specs/cap/spec.md');
  out.steps.push('open-group: ' + JSON.stringify({ stats: specStats, specSnapshot: specSnap }));
  if (specSnap !== '# Cap\n\n- REQ-1\n- REQ-2 (added while collapsed)\n') err('the open artifact\'s group must be read even when collapsed, got ' + JSON.stringify(specSnap));
  if (specStats >= ARC) err('the reload should still skip the collapsed-and-unread archive bulk, got ' + specStats);

  out.ok = out.errors.length === 0;
  console.log('=== SCOPED READ TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}
