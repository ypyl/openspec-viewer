/* End-to-end test for "whole-file review comments" (v3.12.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=whole-file-comment-test.js
 *
 * Verifies: selecting the change title and saving a comment creates a distinct
 * kind:'file' row in the review panel (with an "entire artifact" pill and no
 * quoted snippet); no header 💬 button exists anymore; the generated prompt
 * carries "Scope: entire file" with no Referenced text line; a second comment
 * on the same artifact appends (multiplicity); and the file-kind comment
 * persists with no range fields. Deleting via the review drawer removes the
 * rows.
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
    // Clear every per-folder highlight key (not just the legacy one) so a run
    // is hermetic even after other tests have populated other folders.
    Object.keys(localStorage)
      .filter(k => k.startsWith('osviewer.highlights'))
      .forEach(k => localStorage.removeItem(k));
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

  // ---- Select the change title to open the whole-file comment bubble ----
  const selectTitle = () => page.evaluate(() => {
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
  const saveTitleComment = (text) => page.evaluate((comment) => {
    const ta = document.querySelector('osv-pane .ann-text');
    if (!ta) throw new Error('no comment editor opened');
    ta.value = comment;
    document.querySelector('osv-pane .ann-save').click();
  }, text);

  // ---- 1) Add a whole-file comment by selecting the change title ----
  await selectTitle();
  await page.waitForTimeout(150);
  await saveTitleComment('Rewrite in active voice throughout.');
  await page.waitForTimeout(250);

  const snap = () => page.evaluate(() => {
    const row = document.querySelector('osv-review .rv-item.rv-file-comment');
    return {
      fileRow: !!row,
      pill: row ? (row.querySelector('.rv-pill') || {}).textContent.trim() : null,
      comment: row ? (row.querySelector('.rv-comment') || {}).textContent.trim() : null,
      file: row ? (row.querySelector('.rv-file') || {}).textContent.trim() : null,
      hasRangeImg: row ? !!row.querySelector('.rv-text') : false,
      noHeaderButton: !document.querySelector('osv-pane .comment-toggle'),
    };
  });

  let s = await snap();
  out.steps.push('after-add: ' + JSON.stringify(s));
  if (!s.fileRow) err('whole-file row should appear in the review panel');
  if (s.pill !== 'entire artifact') err('whole-file row should show an "entire artifact" pill, got ' + s.pill);
  if (s.comment !== 'Rewrite in active voice throughout.') err('row comment should match, got ' + s.comment);
  if (s.file !== 'changes/foo/proposal.md') err('row should name the proposal, got ' + s.file);
  if (s.hasRangeImg) err('whole-file row should NOT show a quoted text snippet');
  if (!s.noHeaderButton) err('the header comment button should be gone');

  // ---- 2) Prompt contains Scope: entire file and no Referenced text ----
  const prompt = await page.evaluate(() => window.buildPrompt && window.buildPrompt());
  out.steps.push('prompt: ' + String(prompt));
  if (!prompt) err('buildPrompt should return a prompt');
  if (!prompt || !prompt.includes('Scope: entire file')) err('prompt should include "Scope: entire file"');
  if (!prompt || !prompt.includes('Rewrite in active voice throughout.')) err('prompt should include the whole-file comment');
  if (prompt && prompt.includes('Referenced text')) err('whole-file comment should not carry a Referenced text line');

  // ---- 3) Multiplicity: a second whole-file comment on the same artifact ----
  await selectTitle();
  await page.waitForTimeout(150);
  await saveTitleComment('Add acceptance criteria.');
  await page.waitForTimeout(250);
  s = await page.evaluate(() => {
    const rows = document.querySelectorAll('osv-review .rv-item.rv-file-comment');
    return { rows: rows.length, noHeaderButton: !document.querySelector('osv-pane .comment-toggle') };
  });
  out.steps.push('after-second: ' + JSON.stringify(s));
  if (s.rows !== 2) err('should show 2 whole-file rows, got ' + s.rows);
  if (!s.noHeaderButton) err('the header comment button should be gone after a second comment');

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

  // ---- 5) Delete via the review drawer ----
  await page.evaluate(() => {
    const del = document.querySelector('osv-review .rv-item.rv-file-comment .rv-del');
    if (del) del.click();
  });
  await page.waitForTimeout(250);
  s = await page.evaluate(() => {
    const rows = document.querySelectorAll('osv-review .rv-item.rv-file-comment');
    return { rows: rows.length };
  });
  out.steps.push('after-delete: ' + JSON.stringify(s));
  if (s.rows !== 1) err('should show 1 whole-file row after delete, got ' + s.rows);

  // ---- 6) Delete the last one ----
  await page.evaluate(() => {
    const del = document.querySelector('osv-review .rv-item.rv-file-comment .rv-del');
    if (del) del.click();
  });
  await page.waitForTimeout(250);
  s = await page.evaluate(() => {
    const rows = document.querySelectorAll('osv-review .rv-item.rv-file-comment');
    return { rows: rows.length };
  });
  out.steps.push('after-delete-all: ' + JSON.stringify(s));
  if (s.rows !== 0) err('should show 0 whole-file rows after delete, got ' + s.rows);

  out.ok = out.errors.length === 0;
  console.log('=== WHOLE-FILE COMMENT TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}
