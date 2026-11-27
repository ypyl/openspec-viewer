/* End-to-end test for the Changes "done" badge (v4.4.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=done-badge-test.js
 *
 * The badge marks a change that was applied but not archived: its tasks.md
 * exists and every task is checked. It is derived from file content, so this
 * suite proves both read paths that feed it — a folder read (fresh + ticked
 * tasks) and a re-open that only has persisted snapshots to go on — plus the
 * rows that must NOT carry it (open tasks, no tasks.md, archived changes).
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  // Four changes: applied (all checked), in progress (one open), no tasks.md,
  // and one already archived with all tasks checked.
  const fs = {
    'openspec/changes/applied/proposal.md': { text: '# Applied\n', mtime: 1000 },
    'openspec/changes/applied/tasks.md': { text: '# Tasks\n\n- [x] one\n- [x] two\n', mtime: 1000 },
    'openspec/changes/in-progress/proposal.md': { text: '# In progress\n', mtime: 1000 },
    'openspec/changes/in-progress/tasks.md': { text: '# Tasks\n\n- [x] one\n- [ ] two\n', mtime: 1000 },
    'openspec/changes/no-tasks/design.md': { text: '# No tasks\n', mtime: 1000 },
    'openspec/changes/archive/2026-01-01-old/proposal.md': { text: '# Old\n', mtime: 900 },
    'openspec/changes/archive/2026-01-01-old/tasks.md': { text: '# Tasks\n\n- [x] done\n', mtime: 900 },
    'openspec/specs/cap/spec.md': { text: '# Cap\n\n- REQ-1\n', mtime: 1100 },
  };

  await page.addInitScript(([files]) => {
    window.__fsData = files;
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
        getFile: async () => ({ lastModified: data.mtime, text: async () => data.text }),
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
    window.__makeFs = () => makeDir('repo', 'repo', buildNode(files));
  }, [fs]);

  const CONSOLE = (msg) => { if (msg.type() === 'error') out.errors.push('CONSOLE: ' + msg.text()); };
  page.on('console', CONSOLE);

  await page.goto('http://127.0.0.1:8743/index.html');
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    try { localStorage.clear(); } catch (e) {}
    // The badge must come from folder reads, not from the open-file watch.
    window.setAutoRefresh(false);
  });
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.setAutoRefresh(false));

  // change label -> 'BADGE' | null, read from the rendered rows.
  const badges = () => page.evaluate(() => {
    const rows = {};
    document.querySelectorAll('osv-file-list .item.change-row').forEach(r => {
      rows[(r.querySelector('.path') || {}).textContent || '?'] =
        r.querySelector('.done-badge') ? 'BADGE' : null;
    });
    return rows;
  });
  const badgeTitle = () => page.evaluate(() => {
    const b = document.querySelector('osv-file-list .done-badge');
    return b ? b.getAttribute('title') : null;
  });

  await page.evaluate(() => { window.showDirectoryPicker = async () => window.__makeFs(); });
  await page.evaluate(() => { document.querySelector('.rail-add').click(); });
  await page.waitForFunction(() => window.folderCount() === 1);
  await page.waitForTimeout(800);
  // The archive group is collapsed by default; expand it so its row is checked too.
  await page.evaluate(() => document.querySelector('.group-label[data-group="Archive"]').click());
  await page.waitForTimeout(600);

  const first = await badges();
  out.steps.push('first-read: ' + JSON.stringify(first));
  if (first['Applied'] !== 'BADGE') err('a fully checked tasks.md should badge its change as done, got ' + JSON.stringify(first));
  if (first['In Progress']) err('a change with an open task must not be badged done');
  if (first['No Tasks']) err('a change without tasks.md must not be badged done');
  if (first['Old']) err('an archived change never needs the done badge');
  const title = await badgeTitle();
  out.steps.push('badge-title: ' + JSON.stringify(title));
  if (!/2\/2 tasks done/.test(String(title))) err('the badge tooltip should carry the task count, got ' + JSON.stringify(title));

  // ---- Re-open: the badge is restored from snapshots, no file re-read ----
  await page.evaluate(() => window.startMonitoring(window.__makeFs(), true));
  await page.waitForTimeout(800);
  const reopened = await badges();
  out.steps.push('reopen: ' + JSON.stringify(reopened));
  if (reopened['Applied'] !== 'BADGE') err('the done badge must survive a re-open that only has snapshots, got ' + JSON.stringify(reopened));

  // ---- Finish the in-progress change: its badge appears after a reload ----
  await page.evaluate(() => {
    const d = window.__fsData['openspec/changes/in-progress/tasks.md'];
    d.mtime = 7777;
    d.text = '# Tasks\n\n- [x] one\n- [x] two\n';
  });
  await page.evaluate(() => { document.querySelector('.reload-btn').click(); });
  await page.waitForTimeout(900);
  const afterTick = await badges();
  out.steps.push('tasks-ticked: ' + JSON.stringify(afterTick));
  if (afterTick['In Progress'] !== 'BADGE') err('checking the last open task should badge the change done, got ' + JSON.stringify(afterTick));

  // ---- Deleting tasks.md drops the badge ----
  await page.evaluate(() => {
    delete window.__fsData['openspec/changes/applied/tasks.md'];
  });
  await page.evaluate(() => window.startMonitoring(window.__makeFs(), true));
  await page.waitForTimeout(900);
  const afterDelete = await badges();
  out.steps.push('tasks-deleted: ' + JSON.stringify(afterDelete));
  if (afterDelete['Applied']) err('removing tasks.md must drop the done badge, got ' + JSON.stringify(afterDelete));

  out.ok = out.errors.length === 0;
  console.log('=== DONE BADGE TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}
