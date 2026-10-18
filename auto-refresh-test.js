/* End-to-end test for open-artifact auto-refresh (change auto-refresh-open-artifact, v4.2.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=auto-refresh-test.js
 *
 * Stubs the File System Access API with in-memory trees and logs every
 * getFile() call, then drives the real scan/render pipeline:
 *   - editing the displayed artifact refreshes the view in place and flags it
 *     unread, reading only that file;
 *   - an unopened sibling is never read and is left untouched;
 *   - the diff view is rebuilt against the previously observed content;
 *   - a background folder's artifact is left to its own read;
 *   - switching the displayed artifact moves the watch;
 *   - an auto-refreshed artifact is not reported as a new change by the reload
 *     control;
 *   - the reader's scroll position survives the refresh;
 *   - the watch timer itself fires without a manual tick.
 * The timer is disabled for most of the run for determinism and one watch tick
 * is driven with window.watchTick(); the last step re-enables it and waits.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };
  const ok = (cond, msg) => { if (cond) out.steps.push('ok: ' + msg); else err(msg); };

  const LONG = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`).join('\n');
  const A_OLD = '# Alpha\n\n' + LONG + '\n';
  const A_NEW = '# Alpha\n\n' + LONG + '\n\nNEW LINE\n';
  const D_OLD = '# Alpha Design\n\nOld design body.\n';
  const D_NEW = '# Alpha Design\n\nNew design body.\n';

  const fsA = {
    'openspec/changes/alpha/proposal.md': { text: A_OLD, mtime: 1000 },
    'openspec/changes/alpha/design.md': { text: D_OLD, mtime: 1001 },
    'openspec/changes/beta/proposal.md': { text: '# Beta\n\nBeta body.\n', mtime: 1002 },
  };
  const fsB = {
    'openspec/changes/gamma/proposal.md': { text: '# Gamma\n\nGamma body.\n', mtime: 2000 },
  };

  await page.addInitScript(([A, B]) => {
    window.__fsDataA = A;
    window.__fsDataB = B;
    window.__statLog = [];   // rels whose getFile() was called
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
        getFile: async () => { window.__statLog.push(data.rel); return { lastModified: data.mtime, text: async () => data.text }; },
      };
    }
    function buildNode(files) {
      const node = { dirs: {}, files: {} };
      for (const [p, data] of Object.entries(files)) {
        data.rel = p.replace(/^openspec\//, '');
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
    await new Promise((res) => { const r = indexedDB.deleteDatabase('osviewer'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
    try { localStorage.clear(); } catch (e) {}
  });
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined && window.watchTick !== undefined);
  await page.waitForTimeout(300);

  // Deterministic: drive ticks by hand; the timer is exercised at the end.
  await page.evaluate(() => window.setAutoRefresh(false));

  const tick = async () => { await page.evaluate(() => window.watchTick()); await page.waitForTimeout(300); };
  const statLog = () => page.evaluate(() => window.__statLog.slice());
  const resetStats = () => page.evaluate(() => { window.__statLog.length = 0; });
  const snapshotOf = (rel) => page.evaluate((r) => window.getSnapshot(r).then(s => s && s.text), rel);
  const snapshotIn = (id, rel) => page.evaluate(([i, r]) => window.getSnapshotIn(i, r).then(s => s && s.text), [id, rel]);
  const bodyText = () => page.evaluate(() => {
    const b = document.querySelector('osv-pane .pane-body');
    return b ? b.textContent : '';
  });
  const unreadCount = () => page.evaluate(() => document.querySelectorAll('osv-file-list .item.new').length);
  const mutate = (which, rel, mtime, text) => page.evaluate(([w, r, m, t]) => {
    const d = w === 'B' ? window.__fsDataB['openspec/' + r] : window.__fsDataA['openspec/' + r];
    d.mtime = m; d.text = t;
  }, [which, rel, mtime, text]);

  // ---- Add folder A; the first change's proposal is auto-opened ----
  await page.evaluate(() => { window.showDirectoryPicker = async () => window.__makeFs('A'); });
  await page.evaluate(() => { document.querySelector('.rail-add').click(); });
  await page.waitForFunction(() => window.folderCount() === 1);
  await page.waitForTimeout(400);
  const aId = await page.evaluate(() => window.activeFolderId());
  const openRel = await page.evaluate(() => window.currentRel());
  out.steps.push('baseline: ' + JSON.stringify({ aId, openRel }));
  ok(openRel === 'changes/alpha/proposal.md', `the first proposal is displayed, got ${JSON.stringify(openRel)}`);
  ok((await bodyText()).includes('Alpha'), 'the displayed view shows the artifact content');

  // ---- Editing the displayed artifact refreshes it in place ----
  await resetStats();
  await mutate('A', 'changes/alpha/proposal.md', 9001, A_NEW);
  await tick();
  const log1 = await statLog();
  const body1 = await bodyText();
  const snap1 = await snapshotOf('changes/alpha/proposal.md');
  out.steps.push('edit-open: ' + JSON.stringify({ log: log1, snap: snap1 }));
  ok(body1.includes('NEW LINE'), 'an external edit refreshes the displayed view in place');
  ok(log1.length > 0 && log1.every(r => r === 'changes/alpha/proposal.md'), 'only the displayed artifact is read, got ' + JSON.stringify(log1));
  ok(snap1 === A_NEW, 'the refreshed content is committed to the snapshot');
  ok((await unreadCount()) >= 1, 'the externally changed artifact is flagged unread');

  // ---- The diff view is rebuilt against the previously observed content ----
  const diffShown = await page.evaluate(() => {
    const t = document.querySelector('osv-pane .diff-toggle');
    if (!t) return null;
    t.click();
    return true;
  });
  await page.waitForTimeout(300);
  const diffText = await bodyText();
  out.steps.push('diff: ' + JSON.stringify({ diffShown, hasNew: diffText.includes('NEW LINE') }));
  ok(diffShown, 'the auto-refreshed artifact has a diff control');
  ok(diffText.includes('NEW LINE'), 'the diff view is rebuilt against the previous content');

  // ---- An unopened sibling is never read and is left untouched ----
  await resetStats();
  await mutate('A', 'changes/alpha/design.md', 9002, D_NEW);
  await tick();
  const log2 = await statLog();
  const designSnap = await snapshotOf('changes/alpha/design.md');
  out.steps.push('sibling: ' + JSON.stringify({ log: log2, designSnap }));
  ok(!log2.includes('changes/alpha/design.md'), 'the unopened sibling is not read, got ' + JSON.stringify(log2));
  ok(designSnap === D_OLD, 'the unopened sibling keeps its old snapshot');

  // ---- A background folder is left to its own read ----
  await page.evaluate(() => { window.showDirectoryPicker = async () => window.__makeFs('B'); });
  await page.evaluate(() => { document.querySelector('.rail-add').click(); });
  await page.waitForFunction(() => window.folderCount() === 2);
  await page.waitForTimeout(400);
  await resetStats();
  await mutate('A', 'changes/alpha/proposal.md', 9003, A_NEW + '\nANOTHER\n');
  await tick();
  const log3 = await statLog();
  const aSnapBackground = await snapshotIn(aId, 'changes/alpha/proposal.md');
  out.steps.push('background: ' + JSON.stringify({ log: log3, aSnap: aSnapBackground }));
  ok(!log3.includes('changes/alpha/proposal.md'), 'a background folder\'s artifact is not read, got ' + JSON.stringify(log3));
  ok(aSnapBackground === A_NEW, 'the background folder keeps its state until it is read again');

  // ---- Switching the displayed artifact moves the watch ----
  const clickAvatar = async (prefix) => {
    await page.evaluate((p) => {
      [...document.querySelectorAll('.rail-avatar')].find(b => b.title && b.title.startsWith(p)).click();
    }, prefix);
    await page.waitForTimeout(250);
  };
  await clickAvatar('repoA');
  await page.evaluate(() => window.openFile('changes/alpha/design.md'));
  await page.waitForTimeout(250);
  await resetStats();
  await mutate('A', 'changes/alpha/proposal.md', 9004, A_NEW + '\n\nTHIRD\n');
  await tick();
  const log4 = await statLog();
  const designSnap2 = await snapshotIn(aId, 'changes/alpha/design.md');
  out.steps.push('switch: ' + JSON.stringify({ log: log4, designSnap: designSnap2 }));
  ok(!log4.includes('changes/alpha/proposal.md'), 'the previously displayed artifact is no longer read, got ' + JSON.stringify(log4));
  ok(log4.includes('changes/alpha/design.md'), 'the newly displayed artifact is read');
  ok(designSnap2 === D_NEW, 'the newly displayed artifact refreshes with its own change');

  // ---- A refreshed artifact is not reported again by the reload control ----
  await page.evaluate(() => window.openFile('changes/alpha/proposal.md'));
  await page.waitForTimeout(250);
  await tick();   // pick up the step-6 change
  const unreadBeforeReload = await unreadCount();
  await page.evaluate(() => { document.querySelector('.reload-btn').click(); });
  await page.waitForTimeout(500);
  const unreadAfterReload = await unreadCount();
  const aSnapAfterReload = await snapshotOf('changes/alpha/proposal.md');
  out.steps.push('reload: ' + JSON.stringify({ unreadBeforeReload, unreadAfterReload, snap: aSnapAfterReload }));
  ok(unreadAfterReload <= unreadBeforeReload, 'a reload does not re-flag the already refreshed artifact');
  ok(aSnapAfterReload === A_NEW + '\n\nTHIRD\n', 'the refresh did not leave a phantom diff for the reload');

  // ---- The reader's scroll position survives the refresh ----
  // Switch back to the artifact (content) view so the body is tall enough to
  // scroll; the refresh must patch it without jumping to the top.
  const wasDiff = await page.evaluate(() => !!document.querySelector('osv-pane .pane-body .diff'));
  if (wasDiff) {
    await page.evaluate(() => document.querySelector('osv-pane .diff-toggle').click());
    await page.waitForTimeout(250);
  }
  const scrollBefore = await page.evaluate(() => {
    const m = document.querySelector('osv-pane main');
    m.scrollTop = 250;
    return m.scrollTop;
  });
  await mutate('A', 'changes/alpha/proposal.md', 9005, A_NEW + '\n\nTHIRD\n\nFOURTH\n');
  await tick();
  const scrollAfter = await page.evaluate(() => document.querySelector('osv-pane main').scrollTop);
  out.steps.push('scroll: ' + JSON.stringify({ scrollBefore, scrollAfter }));
  ok(scrollBefore > 0, 'the pane was scrolled before the refresh');
  ok(scrollAfter === scrollBefore, `the scroll position survives the refresh, got ${scrollAfter} vs ${scrollBefore}`);

  // ---- The watch timer itself fires ----
  await page.evaluate(() => window.setAutoRefresh(true));
  await mutate('A', 'changes/alpha/proposal.md', 9006, A_NEW + '\n\nTHIRD\n\nFOURTH\n\nFIFTH\n');
  await page.waitForTimeout(3800);
  const body5 = await bodyText();
  out.steps.push('timer: ' + JSON.stringify({ hasFifth: body5.includes('FIFTH') }));
  ok(body5.includes('FIFTH'), 'the watch timer refreshes the displayed artifact on its own');

  out.ok = out.errors.length === 0;
  console.log('=== AUTO-REFRESH TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}
