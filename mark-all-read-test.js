/* End-to-end test for the sidebar "Mark all as read" control (v3.20.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=mark-all-read-test.js
 *
 * Verifies: the control renders between the folder name and the close button,
 * is disabled while nothing is unread, is enabled with an unread count once
 * artifacts change, and one click clears every unread indicator at once
 * (sidebar rows, group counter, rail dot, pane tab badges, diff toggle badge)
 * and persists across a reload.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };
  const ok = (cond, msg) => { if (cond) out.steps.push('ok: ' + msg); else err(msg); };

  const fsData = {
    'openspec/config.yaml': { text: '# openspec config\n', mtime: 500 },
    'openspec/specs/acct/spec.md': { text: '# Acct Spec\n\nA capability.\n', mtime: 600 },
    'openspec/changes/alpha/proposal.md': { text: '# Alpha Proposal\n\nBuild it.\n', mtime: 1000 },
    'openspec/changes/alpha/design.md': { text: '# Alpha Design\n\nHow.\n', mtime: 1001 },
    'openspec/changes/beta/proposal.md': { text: '# Beta Proposal\n\nOther.\n', mtime: 2000 },
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

  // ---- Baseline: fresh pick, nothing unread ----
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForFunction(() => window.folderCount && window.folderCount() === 1);
  await page.waitForTimeout(300);

  const rowState = () => page.evaluate(() => {
    const row = document.querySelector('osv-file-list .folder-row');
    const name = row && row.querySelector('.folder-name');
    const mark = row && row.querySelector('.folder-mark-read');
    const close = row && row.querySelector('.folder-close');
    const before = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    return {
      hasName: !!name, hasMark: !!mark, hasClose: !!close,
      text: mark ? mark.textContent.trim() : null,
      disabled: mark ? mark.disabled : null,
      title: mark ? mark.title : null,
      between: before(name, mark) && before(mark, close),
    };
  });

  const unreadState = () => page.evaluate(() => {
    const g = document.querySelector('osv-file-list .group-new');
    const toast = document.querySelector('osv-toast .toast');
    return {
      listNew: document.querySelectorAll('osv-file-list .item.new').length,
      dots: document.querySelectorAll('osv-file-list .new-dot').length,
      hints: document.querySelectorAll('osv-file-list .diff-hint').length,
      groupNew: g ? g.textContent.replace(/\s+/g, ' ').trim() : null,
      railDot: document.querySelectorAll('.rail-dot').length,
      tabBadges: document.querySelectorAll('osv-pane .tab-diff').length,
      toggleNew: document.querySelectorAll('osv-pane .diff-toggle .diff-new').length,
      toggleCounts: document.querySelectorAll('osv-pane .diff-toggle .dh-add, osv-pane .diff-toggle .dh-del').length,
      toast: toast ? toast.textContent.trim() : null,
    };
  });

  let r = await rowState();
  out.steps.push('baseline row: ' + JSON.stringify(r));
  ok(r.hasMark, 'the "Mark all as read" control renders in the folder row');
  ok(r.text === 'Mark all as read', `the control reads "Mark all as read", got ${JSON.stringify(r.text)}`);
  ok(r.between, 'the control sits between the folder name and the close button');
  ok(r.disabled === true, 'the control is disabled while nothing is unread');
  ok(r.title === 'Nothing unread in this folder', `disabled title explains why, got ${JSON.stringify(r.title)}`);

  let u = await unreadState();
  ok(u.listNew === 0 && u.railDot === 0 && u.groupNew === null, 'baseline shows no unread indicators');

  // ---- Mutate three artifacts, rescan ----
  await page.evaluate(() => {
    const a = window.__fsData['openspec/changes/alpha/proposal.md'];
    a.mtime = 9001; a.text = '# Alpha Proposal\n\nBuild it well.\n\n- [ ] more\n';
    const b = window.__fsData['openspec/changes/alpha/design.md'];
    b.mtime = 9002; b.text = '# Alpha Design\n\nHow, revised.\n';
    const c = window.__fsData['openspec/changes/beta/proposal.md'];
    c.mtime = 9003; c.text = '# Beta Proposal\n\nOther, revised.\n';
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(300);

  r = await rowState();
  u = await unreadState();
  out.steps.push('after-mutation row: ' + JSON.stringify(r));
  out.steps.push('after-mutation unread: ' + JSON.stringify(u));
  ok(u.listNew === 2, `two change rows are marked unread, got ${u.listNew}`);
  ok(u.dots === 2 && u.hints === 2, 'both unread rows carry a dot and a diff hint');
  ok(u.groupNew !== null && u.groupNew.includes('2'), `Changes group counter reads +2 unread, got ${JSON.stringify(u.groupNew)}`);
  ok(u.railDot === 1, 'the rail avatar shows the unread dot');
  ok(r.disabled === false, 'the control is enabled once artifacts are unread');
  ok(r.title === 'Mark all 3 unread artifacts as read', `title counts unread artifacts, got ${JSON.stringify(r.title)}`);

  // ---- Open a change so the pane shows its own read indicators ----
  await page.evaluate(async () => { await window.openChange('changes/alpha'); });
  await page.waitForTimeout(400);
  u = await unreadState();
  out.steps.push('pane-before: ' + JSON.stringify(u));
  ok(u.tabBadges === 2, `both changed tabs carry a diff badge, got ${u.tabBadges}`);
  ok(u.toggleNew === 1, 'the diff toggle carries the NEW badge');

  // ---- One click clears everything ----
  await page.evaluate(() => { document.querySelector('osv-file-list .folder-mark-read').click(); });
  await page.waitForTimeout(600);

  u = await unreadState();
  r = await rowState();
  out.steps.push('after-mark-all: ' + JSON.stringify(u));
  ok(u.listNew === 0 && u.dots === 0 && u.hints === 0, 'no unread rows remain in the sidebar');
  ok(u.groupNew === null, 'the Changes group counter is cleared');
  ok(u.railDot === 0, 'the rail unread dot is cleared');
  ok(u.tabBadges === 0, 'the pane tab diff badges are cleared');
  ok(u.toggleNew === 0 && u.toggleCounts === 0, 'the diff toggle badge and counts are cleared');
  ok(u.toast === 'Marked 3 artifacts as read', `a toast reports the count, got ${JSON.stringify(u.toast)}`);
  ok(r.disabled === true, 'the control goes back to disabled once everything is read');

  // ---- Diffs stay viewable, only the unread markers clear ----
  const stillDiffable = await page.evaluate(() => document.querySelector('osv-pane .diff-toggle') !== null);
  ok(stillDiffable, 'the diff stays available after marking read (only unread state clears)');

  // ---- Read state survives a reload (keepSnapshots = reload equivalent) ----
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), true); });
  await page.waitForTimeout(500);
  u = await unreadState();
  r = await rowState();
  out.steps.push('after-reload: ' + JSON.stringify(u));
  ok(u.listNew === 0 && u.railDot === 0, 'marked-read state persists across a reload');
  ok(r.disabled === true, 'the control is still disabled after the reload');

  out.steps.push('DONE: ' + (out.errors.length === 0 ? 'PASS' : 'FAIL (' + out.errors.length + ' errors)'));
  return out;
}
