/* End-to-end test for "whole-file review comments" (v2.18.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=whole-file-comment-test.js
 *
 * Verifies: adding a whole-file comment through the pane-bar 💬 button creates
 * a distinct kind:'file' row in the review panel (with an "entire artifact"
 * pill and no quoted snippet); the header button shows a count badge; the
 * generated prompt carries "Scope: entire artifact" with no Referenced text
 * line; a second comment on the same artifact appends (multiplicity); and the
 * file-kind comment persists with no range fields. Deleting via the review
 * drawer drops the header badge count (and removes the badge entirely with the
 * last comment) — regression for a stale count after whole-file comment delete.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const fsData = {
    'openspec/changes/foo/proposal.md': { text: '# Foo Proposal\n\nWe will build the thing.\n', mtime: 1000 },
    'openspec/changes/foo/tasks.md': { text: '- [ ] task one\n- [ ] task two\n', mtime: 1100 },
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
  } catch (e) { /* CDP unavailable */ }

  // Clear persisted highlights and snapshots, then reload so the app boots with
  // an empty highlights map (prior run-code invocations share this context).
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

  // ---- Fresh pick baseline ----
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForTimeout(300);

  // ---- Open the change's proposal (routes to the change view) ----
  await page.evaluate(async () => { await window.openFile('changes/foo/proposal.md'); });
  await page.waitForTimeout(400);

  // ---- 1) Add a whole-file comment via the header 💬 button + dialog ----
  await page.evaluate(() => {
    const btn = document.querySelector('osv-pane .comment-toggle');
    if (!btn) throw new Error('no comment-toggle button');
    btn.click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const ta = document.querySelector('osv-pane .cf-text');
    if (!ta) throw new Error('whole-file dialog did not open');
    ta.value = 'Rewrite in active voice throughout.';
    document.querySelector('osv-pane .cf-save').click();
  });
  await page.waitForTimeout(250);

  const snap = () => page.evaluate(() => {
    const row = document.querySelector('osv-review .rv-item.rv-file-comment');
    const btn = document.querySelector('osv-pane .comment-toggle');
    const count = btn && btn.querySelector('.comment-count');
    return {
      fileRow: !!row,
      pill: row ? (row.querySelector('.rv-pill') || {}).textContent.trim() : null,
      comment: row ? (row.querySelector('.rv-comment') || {}).textContent.trim() : null,
      file: row ? (row.querySelector('.rv-file') || {}).textContent.trim() : null,
      hasRangeImg: row ? !!row.querySelector('.rv-text') : false,
      badge: count ? count.textContent.trim() : null,
    };
  });

  let s = await snap();
  out.steps.push('after-add: ' + JSON.stringify(s));
  if (!s.fileRow) err('whole-file row should appear in the review panel');
  if (s.pill !== 'entire artifact') err('whole-file row should show an "entire artifact" pill, got ' + s.pill);
  if (s.comment !== 'Rewrite in active voice throughout.') err('row comment should match, got ' + s.comment);
  if (s.file !== 'changes/foo/proposal.md') err('row should name the proposal, got ' + s.file);
  if (s.hasRangeImg) err('whole-file row should NOT show a quoted text snippet');
  if (s.badge !== '1') err('header button badge should be 1, got ' + s.badge);

  // ---- 2) Prompt contains Scope: entire artifact and no Referenced text ----
  const prompt = await page.evaluate(() => window.buildPrompt && window.buildPrompt());
  out.steps.push('prompt: ' + String(prompt));
  if (!prompt) err('buildPrompt should return a prompt');
  if (!prompt || !prompt.includes('Scope: entire file')) err('prompt should include "Scope: entire file"');
  if (!prompt || !prompt.includes('Rewrite in active voice throughout.')) err('prompt should include the whole-file comment');
  if (prompt && prompt.includes('Referenced text')) err('whole-file comment should not carry a Referenced text line');

  // ---- 3) Multiplicity: a second whole-file comment on the same artifact ----
  await page.evaluate(() => { document.querySelector('osv-pane .comment-toggle').click(); });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.querySelector('osv-pane .cf-text').value = 'Add acceptance criteria.';
    document.querySelector('osv-pane .cf-save').click();
  });
  await page.waitForTimeout(250);
  s = await page.evaluate(() => {
    const rows = document.querySelectorAll('osv-review .rv-item.rv-file-comment');
    const count = document.querySelector('osv-pane .comment-toggle .comment-count');
    return { rows: rows.length, badge: count ? count.textContent.trim() : null };
  });
  out.steps.push('after-second: ' + JSON.stringify(s));
  if (s.rows !== 2) err('should show 2 whole-file rows, got ' + s.rows);
  if (s.badge !== '2') err('header badge should be 2, got ' + s.badge);

  // ---- 4) Persistence: kind:'file' with no range fields ----
  const list = await page.evaluate(() => {
    // Review items are stored per folder (osviewer.highlights.<folderId>).
    const key = Object.keys(localStorage).find(k => k.startsWith('osviewer.highlights.'));
    const o = JSON.parse(localStorage.getItem(key) || '{}');
    return o['changes/foo/proposal.md'] || [];
  });
  const fileComments = list.filter(h => h.kind === 'file');
  out.steps.push('persisted file comments: ' + fileComments.length);
  if (fileComments.length !== 2) err('should persist 2 file-kind comments, got ' + fileComments.length);
  const first = fileComments[0];
  if (first.start !== undefined || first.text !== undefined || first.lines !== undefined) {
    err('file-kind comment should not carry range fields');
  }
  if (!first.comment || !first.ts || !first.id) err('file-kind comment should carry id/comment/ts');

  // ---- 5) Delete via the review drawer: badge must drop (regression: the
  //         pane's 💬 count was only refreshed on save/tab-switch, so a
  //         delete left a stale count behind) ----
  await page.evaluate(() => {
    const del = document.querySelector('osv-review .rv-item.rv-file-comment .rv-del');
    if (del) del.click();
  });
  await page.waitForTimeout(250);
  s = await page.evaluate(() => {
    const rows = document.querySelectorAll('osv-review .rv-item.rv-file-comment');
    const toggle = document.querySelector('osv-pane .comment-toggle');
    const count = toggle && toggle.querySelector('.comment-count');
    return {
      rows: rows.length,
      badge: count ? count.textContent.trim() : null,
      hasClass: toggle ? toggle.classList.contains('has') : null,
    };
  });
  out.steps.push('after-delete: ' + JSON.stringify(s));
  if (s.rows !== 1) err('should show 1 whole-file row after delete, got ' + s.rows);
  if (s.badge !== '1') err('header badge should be 1 after delete, got ' + s.badge);
  if (s.hasClass !== true) err('comment-toggle should still carry .has while a comment remains');

  // ---- 6) Delete the last one: badge disappears entirely ----
  await page.evaluate(() => {
    const del = document.querySelector('osv-review .rv-item.rv-file-comment .rv-del');
    if (del) del.click();
  });
  await page.waitForTimeout(250);
  s = await page.evaluate(() => {
    const rows = document.querySelectorAll('osv-review .rv-item.rv-file-comment');
    const toggle = document.querySelector('osv-pane .comment-toggle');
    const count = toggle && toggle.querySelector('.comment-count');
    return {
      rows: rows.length,
      badge: count ? count.textContent.trim() : null,
      hasClass: toggle ? toggle.classList.contains('has') : null,
    };
  });
  out.steps.push('after-delete-all: ' + JSON.stringify(s));
  if (s.rows !== 0) err('should show 0 whole-file rows after delete, got ' + s.rows);
  if (s.badge !== null) err('badge should be gone after deleting the last comment, got ' + s.badge);
  if (s.hasClass !== false) err('comment-toggle should drop .has when no comment remains');

  out.ok = out.errors.length === 0;
  console.log('=== WHOLE-FILE COMMENT TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}
