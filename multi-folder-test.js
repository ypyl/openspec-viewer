/* End-to-end test for multi-folder monitoring (proposal
   multi-folder-monitoring, v3.0.0): add two folders through the real rail
   + picker, switch via avatars, verify per-folder list/selection/tabs,
   same-path artifacts never mix, dedup on re-pick, close-active falls back to
   the next folder, background-change notices prefix the folder name, and
   uploads are session-only (never persisted, no dot, gone after reload).

   Run from repo root:
     python -m http.server 8743
     playwright-cli open http://127.0.0.1:8743/index.html
     playwright-cli run-code --filename=multi-folder-test.js
   Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const fsA = {
    'openspec/changes/alpha/proposal.md': { text: '# Alpha in A\n\nA-specific.\n', mtime: 1000 },
    'openspec/changes/alpha/design.md': { text: '# Design A\n', mtime: 1100 },
    'openspec/changes/gamma/proposal.md': { text: '# Gamma\n\nOnly in A.\n', mtime: 1200 },
    'openspec/specs/wa/spec.md': { text: '# WA Spec\n\nA flavour.\n', mtime: 1300 },
    'openspec/config.yaml': { text: 'extends: openspec\n', mtime: 1400 },
  };
  const fsB = {
    'openspec/changes/alpha/proposal.md': { text: '# Alpha in B\n\nB-specific.\n', mtime: 2000 },
    'openspec/changes/beta/proposal.md': { text: '# Beta\n\nOnly in B.\n', mtime: 2100 },
    'openspec/specs/wa/spec.md': { text: '# WA Spec\n\nB flavour.\n', mtime: 2200 },
  };

  // The stub FS mirrors the File System Access API. `_id` gives isSameEntry a
  // stable identity so the dedup path is exercised.
  await page.addInitScript(([A, B]) => {
    window.hasChange = (label) => [...document.querySelectorAll('.change-row')]
      .some(r => r.textContent.includes(label));
    window.__fsDataA = A;
    window.__fsDataB = B;
    const DirProto = {
      kind: 'directory',
      async queryPermission() { return 'granted'; },
      async isSameEntry(other) { return !!(other && other._id && other._id === this._id); },
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

  const clickAdd = async (which) => {
    await page.evaluate((w) => { window.showDirectoryPicker = async () => window.__makeFs(w); }, which);
    await page.evaluate(() => { document.querySelector('.rail-add').click(); });
  };

  // ---- Phase 1: add folder A through the rail + picker ----
  await clickAdd('A');
  await page.waitForFunction(() => window.folderCount() === 1);
  await page.waitForTimeout(300);
  let state = await page.evaluate(() => ({
    names: window.folderNames(),
    active: window.activeFolderId(),
    avatars: document.querySelectorAll('.rail-avatar').length,
    nameRow: document.querySelector('.folder-name') ? document.querySelector('.folder-name').textContent.trim() : null,
    gamma: hasChange('Gamma'),
    beta: hasChange('Beta'),
  }));
  out.steps.push('add-A: ' + JSON.stringify(state));
  if (state.avatars !== 1 || state.names.length !== 1 || state.names[0] !== 'repoA') err('rail should show one repoA avatar, got ' + JSON.stringify(state));
  if (!state.gamma || state.beta) err('A active: list should show gamma, not beta, got ' + JSON.stringify(state));
  if (!state.nameRow) err('name row should show the active folder');
  const idA = state.active;

  // ---- Phase 2: add folder B; dedup on re-picking A ----
  await clickAdd('B');
  await page.waitForFunction(() => window.folderCount() === 2);
  await page.waitForTimeout(300);
  state = await page.evaluate(() => ({
    names: window.folderNames(),
    activeName: window.folderName(window.activeFolderId()),
    avatars: document.querySelectorAll('.rail-avatar').length,
    gamma: hasChange('Gamma'),
    beta: hasChange('Beta'),
    alphaTitle: (() => {
      const p = document.querySelector('.pane-body .markdown h1, .pane-body h1');
      return p ? p.textContent.trim() : null;
    })(),
  }));
  out.steps.push('add-B: ' + JSON.stringify(state));
  if (state.avatars !== 2) err('rail should have two avatars, got ' + state.avatars);
  if (state.activeName !== 'repoB') err('B should be active after adding, got ' + state.activeName);
  if (!state.beta || state.gamma) err('B active: list should show beta, not gamma, got ' + JSON.stringify(state));
  if (!state.alphaTitle || !state.alphaTitle.includes('Alpha in B')) err('B active: alpha should be B\'s flavour, got ' + state.alphaTitle);

  // Re-pick A while B is open → dedup: no duplicate, switch to A.
  await clickAdd('A');
  await page.waitForTimeout(300);
  state = await page.evaluate(() => ({
    count: window.folderCount(),
    activeName: window.folderName(window.activeFolderId()),
  }));
  out.steps.push('dedup: ' + JSON.stringify(state));
  if (state.count !== 2) err('re-picking an open folder should not duplicate, got count ' + state.count);
  if (state.activeName !== 'repoA') err('re-picking A should switch to A, got ' + state.activeName);

  // ---- Phase 3: same-path artifacts never mix + tabs/selection per folder ----
  // Open alpha's design tab in A, switch to B, then back to A.
  await page.evaluate(async () => { await window.openChange('changes/alpha', 'changes/alpha/design.md'); });
  await page.waitForTimeout(150);
  state = await page.evaluate(() => ({
    tabs: document.querySelectorAll('.tabs .tab').length,
    activeTab: document.querySelector('.tab.active') ? document.querySelector('.tab.active').textContent.replace(/\s+/g, ' ').trim() : null,
  }));
  out.steps.push('A-open-alpha: ' + JSON.stringify(state));
  if (state.tabs < 2 || !state.activeTab || !state.activeTab.startsWith('Design')) err('A should hold alpha tabs with Design active, got ' + JSON.stringify(state));

  // Switch to B via its avatar, then back to A.
  await page.evaluate(() => {
    const av = [...document.querySelectorAll('.rail-avatar')].find(b => b.title && b.title.startsWith('repoB'));
    av.click();
  });
  await page.waitForTimeout(300);
  state = await page.evaluate(() => ({
    activeName: window.folderName(window.activeFolderId()),
    alphaTitle: (() => { const p = document.querySelector('.pane-body h1'); return p ? p.textContent.trim() : 'no-pane'; })(),
    beta: hasChange('Beta'),
  }));
  out.steps.push('switch-B: ' + JSON.stringify(state));
  if (state.activeName !== 'repoB') err('avatar click should switch to B, got ' + state.activeName);
  if (!state.alphaTitle.includes('Alpha in B')) err('B active should render B\'s alpha, got ' + state.alphaTitle);

  await page.evaluate(() => {
    const av = [...document.querySelectorAll('.rail-avatar')].find(b => b.title && b.title.startsWith('repoA'));
    av.click();
  });
  await page.waitForTimeout(300);
  state = await page.evaluate(() => ({
    activeName: window.folderName(window.activeFolderId()),
    tabs: document.querySelectorAll('.tabs .tab').length,
    activeTab: document.querySelector('.tab.active') ? document.querySelector('.tab.active').textContent.replace(/\s+/g, ' ').trim() : null,
    beta: hasChange('Beta'),
  }));
  out.steps.push('switch-back-A: ' + JSON.stringify(state));
  if (state.activeName !== 'repoA') err('avatar click should switch back to A, got ' + state.activeName);
  if (state.tabs < 2 || !state.activeTab || !state.activeTab.startsWith('Design')) err('A should restore its alpha tabs, got ' + JSON.stringify(state));
  if (state.beta) err('A active must never list B\'s beta, got beta listed');

  // ---- Phase 4: background change → prefixed notice + unread dot ----
  // Make B active again, then mutate A's file and scan A in the background.
  await page.evaluate(() => {
    const av = [...document.querySelectorAll('.rail-avatar')].find(b => b.title && b.title.startsWith('repoB'));
    av.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const d = window.__fsDataA['openspec/changes/alpha/proposal.md'];
    d.mtime = 9000;
    d.text = '# Alpha in A\n\nA-specific, now updated.\n';
  });
  const aId = await page.evaluate(() => {
    const av = [...document.querySelectorAll('.rail-avatar')].find(b => b.title && b.title.startsWith('repoA'));
    return av ? av.dataset.id : null;
  });
  if (!aId) { err('could not resolve A\'s folder id'); } else {
    await page.evaluate(async (id) => { await window.scanFolder(id); }, aId);
    await page.waitForFunction(() => document.querySelector('.toast') && document.querySelector('.toast').textContent.startsWith('repoA:'));
    await page.waitForFunction(() => {
      const av = [...document.querySelectorAll('.rail-avatar')].find(b => b.title && b.title.startsWith('repoA'));
      return av && !!av.querySelector('.rail-dot');
    });
    state = await page.evaluate(() => {
      const toast = document.querySelector('.toast') ? document.querySelector('.toast').textContent : null;
      const av = [...document.querySelectorAll('.rail-avatar')].find(b => b.title && b.title.startsWith('repoA'));
      return { toast, aDot: av ? !!av.querySelector('.rail-dot') : false, activeName: window.folderName(window.activeFolderId()) };
    });
    out.steps.push('background: ' + JSON.stringify(state));
    if (!state.toast || !state.toast.startsWith('repoA: ') || !state.toast.includes('updated')) err('background notice should be prefixed with the folder name, got ' + state.toast);
    if (!state.aDot) err('A\'s avatar should show the unread dot while A is not active');
    if (state.activeName !== 'repoB') err('background scan must not switch the active folder');
  }

  // ---- Phase 5: close the ACTIVE folder (B) → next-down (A) becomes active ----
  await page.evaluate(() => { document.querySelector('.folder-close').click(); });
  await page.waitForFunction(() => window.folderCount() === 1);
  await page.waitForTimeout(200);
  state = await page.evaluate(() => ({
    count: window.folderCount(),
    activeName: window.folderName(window.activeFolderId()),
    gamma: hasChange('Gamma'),
  }));
  out.steps.push('close-B: ' + JSON.stringify(state));
  if (state.count !== 1 || state.activeName !== 'repoA') err('closing B should leave A active, got ' + JSON.stringify(state));
  if (!state.gamma) err('A active after close should show its own artifacts, got gamma=' + state.gamma);

  // ---- Phase 6: uploads are session-only ----
  await page.evaluate(() => {
    const mk = (rel, text) => {
      const f = new File([text], rel.split('/').pop(), { type: 'text/markdown' });
      Object.defineProperty(f, 'webkitRelativePath', { value: 'uploaded-repo/openspec/' + rel });
      return f;
    };
    return window.addUploadFolder([
      mk('changes/zeta/proposal.md', '# Zeta\n\nUploaded.\n'),
      mk('changes/zeta/design.md', '# Design\n'),
    ]);
  });
  await page.waitForFunction(() => window.folderCount() === 2);
  await page.waitForTimeout(200);
  state = await page.evaluate(() => ({
    names: window.folderNames(),
    uploadAvatar: (() => { const av = [...document.querySelectorAll('.rail-avatar')].find(b => b.title.startsWith('uploaded-repo')); return av ? { upload: av.classList.contains('upload'), dot: !!av.querySelector('.rail-dot') } : null; })(),
    activeName: window.folderName(window.activeFolderId()),
  }));
  out.steps.push('upload: ' + JSON.stringify(state));
  if (!state.names.includes('uploaded-repo')) err('upload should appear in the rail, got ' + JSON.stringify(state.names));
  if (!state.uploadAvatar || !state.uploadAvatar.upload) err('upload avatar should be marked session-only (hollow), got ' + JSON.stringify(state.uploadAvatar));
  if (state.uploadAvatar && state.uploadAvatar.dot) err('upload avatar must never show an unread dot');
  if (state.activeName !== 'uploaded-repo') err('adding an upload should make it active, got ' + state.activeName);

  // Uploads are never persisted: no folder registry row of kind 'upload'.
  const rows = await page.evaluate(async () => {
    return await new Promise((res, rej) => {
      const q = indexedDB.open('osviewer', 3);
      q.onerror = () => rej(q.error);
      q.onsuccess = () => {
        const db = q.result;
        const tx = db.transaction('folders', 'readonly');
        const rq = tx.objectStore('folders').getAll();
        rq.onsuccess = () => res((rq.result || []).map(r => ({ id: r.id, kind: r.kind })));
        rq.onerror = () => rej(rq.error);
      };
    });
  });
  if (rows.some(r => r.kind === 'upload')) err('uploads must not be persisted in the folder registry, got ' + JSON.stringify(rows));

  // A real reload: the upload is gone (session-only) and the app boots cleanly.
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(400);
  state = await page.evaluate(() => ({
    names: window.folderNames(),
    uploadAvatar: [...document.querySelectorAll('.rail-avatar')].some(b => b.title && b.title.startsWith('uploaded-repo')),
  }));
  out.steps.push('after-reload: ' + JSON.stringify(state));
  if (state.uploadAvatar || state.names.includes('uploaded-repo')) err('upload must not be restored after reload, got ' + JSON.stringify(state));

  out.ok = out.errors.length === 0;
  console.log('=== MULTI-FOLDER TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}