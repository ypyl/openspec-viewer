/* End-to-end test for "review guidance" (add-review-guidance, v3.2.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=review-guidance-test.js
 *
 * Verifies: the guidance strip renders on Proposal/Spec/Design/Tasks tabs of
 * an active change with the right question per kind, expands to red flags
 * (proposal includes the "stop and fix first" hint), stays expanded across two
 * spec tabs; no strip on the Metadata tab, on config.yaml, on a main spec, or
 * on an archived change. The review checklist shows 7 items + progress on a
 * change, ticks survive change A→B→A switching, clear after reload, and never
 * appear for main specs / archived changes. Copy prompt stays disabled with
 * zero comments regardless of checklist state and never includes checklist
 * content once comments exist.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };
  const ok = (cond, msg) => { if (cond) out.steps.push('ok: ' + msg); else err(msg); };

  const fsData = {
    'openspec/config.yaml': { text: '# openspec config\n', mtime: 500 },
    'openspec/specs/acct/spec.md': { text: '# Acct Spec\n\nA capability.\n', mtime: 600 },
    'openspec/changes/foo/proposal.md': { text: '# Foo Proposal\n\nBuild the thing.\n', mtime: 1000 },
    'openspec/changes/foo/specs/feature/spec.md': { text: '# Feature Spec\n\n## ADDED Requirements\n', mtime: 1001 },
    'openspec/changes/foo/specs/auth/spec.md': { text: '# Auth Spec\n\n## ADDED Requirements\n', mtime: 1002 },
    'openspec/changes/foo/design.md': { text: '# Foo Design\n\nTechnical approach.\n', mtime: 1003 },
    'openspec/changes/foo/tasks.md': { text: '- [ ] task one\n', mtime: 1004 },
    'openspec/changes/foo/.openspec.yaml': { text: 'schema: spec-driven\n', mtime: 1005 },
    'openspec/changes/bar/proposal.md': { text: '# Bar Proposal\n\nBuild the other thing.\n', mtime: 2000 },
    'openspec/changes/bar/tasks.md': { text: '- [ ] bar task\n', mtime: 2001 },
    'openspec/changes/archive/2026-08-20-old/proposal.md': { text: '# Old Proposal\n', mtime: 3000 },
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

  // Fresh baseline: no persisted review items or snapshots.
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

  // ---- Fresh pick baseline (single folder) ----
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForFunction(() => window.folderCount && window.folderCount() === 1);
  await page.waitForTimeout(300);

  const stripState = () => page.evaluate(() => {
    const strip = document.querySelector('osv-pane .guide-strip');
    if (!strip) return { present: false };
    const toggle = strip.querySelector('.guide-toggle');
    const txt = (el) => {
      if (!el) return null;
      const t = el.textContent;
      return t == null ? null : t.trim();
    };
    return {
      present: true,
      hidden: !!strip.hidden,
      kind: toggle ? txt(toggle.querySelector('.guide-kind')) : null,
      question: toggle ? txt(toggle.querySelector('.guide-question')) : null,
      flags: strip.querySelectorAll('.guide-flags li').length,
      expanded: toggle ? toggle.classList.contains('expanded') : false,
      chevron: toggle ? (txt(toggle.querySelector('.guide-chevron')) || '') : null,
    };
  });

  const checklistState = () => page.evaluate(() => {
    const el = document.querySelector('osv-review .review-checklist');
    return {
      present: !!el,
      hidden: el ? !!el.hidden : true,
      progress: el && el.querySelector('.cl-progress') ? el.querySelector('.cl-progress').textContent.trim() : null,
      items: el ? el.querySelectorAll('.cl-item').length : 0,
      checked: el ? el.querySelectorAll('.cl-item.checked').length : 0,
      title: el && el.querySelector('.cl-title') ? el.querySelector('.cl-title').textContent.trim() : null,
    };
  });

  const copyDisabled = () => page.evaluate(() =>
    document.querySelector('osv-review .copy-btn') && document.querySelector('osv-review .copy-btn').disabled);

  const btnLabel = () => page.evaluate(() =>
    document.querySelector('osv-review .copy-btn').textContent.trim());

  const openChange = (key) => page.evaluate(async (k) => { await window.openChange(k); }, key) && page.waitForTimeout(250);
  const openFile = (rel) => page.evaluate(async (r) => { await window.openFile(r); }, rel) && page.waitForTimeout(250);

  // ================= Change foo — proposal tab =================
  await openChange('changes/foo');
  let s = await stripState();
  let c = await checklistState();
  out.steps.push('foo-proposal strip: ' + JSON.stringify(s));
  out.steps.push('foo-proposal checklist: ' + JSON.stringify(c));
  ok(s.present && !s.hidden && s.kind === 'Proposal', 'strip visible on proposal tab, kind=Proposal');
  ok((s.question || '').includes('match what I actually asked'), 'proposal question shows the intent question');
  ok(s.flags === 0 && !s.expanded, 'strip starts collapsed (question only, no flags)');
  ok((s.chevron || '').includes('Show red flags'), 'collapsed strip advertises the expandable red flags');
  ok(c.present && !c.hidden && c.items === 7 && c.progress === '0 of 7', 'checklist shows 7 items, 0 of 7 on a change');
  ok(c.title === 'Two-minute checklist review', 'checklist header is titled Two-minute checklist review');
  ok(await page.evaluate(() => !document.querySelector('osv-review .review-title')), 'redundant Review heading is removed');
  ok(await page.evaluate(() => !document.querySelector('osv-review .review-head')), 'no stray comments-count header element');
  ok(await page.evaluate(() => {
    const cl = document.querySelector('osv-review .review-checklist');
    const lst = document.querySelector('osv-review .review-list');
    return cl && lst && cl.compareDocumentPosition(lst) & Node.DOCUMENT_POSITION_FOLLOWING;
  }), 'checklist sits above the comment list');
  ok(await copyDisabled() === true, 'copy disabled with no comments even with checklist shown');
  ok((await btnLabel()) === '📋 Copy prompt', 'copy button shows a plain label with no comments');

  // ================= Expand proposal flags =================
  await page.evaluate(() => document.querySelector('osv-pane .guide-toggle').click());
  await page.waitForTimeout(150);
  s = await stripState();
  const flagsText = await page.evaluate(() =>
    [...document.querySelectorAll('osv-pane .guide-flags li')].map(li => li.textContent).join(' | '));
  ok(s.expanded && s.flags === 4, 'expanding reveals the 4 proposal red flags');
  ok((s.chevron || '').includes('Hide red flags'), 'expanded strip advertises hiding the red flags');
  ok(flagsText.includes('stop here and fix the proposal before reading further'), 'proposal flags carry the official stop hint');
  ok(await copyDisabled() === true, 'copy still disabled after ticking nothing');

  // ================= Spec tabs (two) — sticky expand per kind =================
  await page.evaluate(() => document.querySelectorAll('osv-pane .tab')[1].click());
  await page.waitForTimeout(250);
  s = await stripState();
  ok(s.kind === 'Spec delta' && !s.expanded, 'spec tab 1 starts collapsed (proposal expansion is per-kind)');
  await page.evaluate(() => document.querySelector('osv-pane .guide-toggle').click());
  await page.waitForTimeout(150);
  s = await stripState();
  ok(s.kind === 'Spec delta' && s.expanded && s.flags === 3, 'expanding the spec strip reveals the 3 spec red flags');
  await page.evaluate(() => document.querySelectorAll('osv-pane .tab')[2].click());
  await page.waitForTimeout(250);
  s = await stripState();
  ok(s.kind === 'Spec delta' && s.expanded, 'expand state carries across to spec tab 2');

  // Ticks on spec tab (still change foo).
  await page.evaluate(() => {
    document.querySelectorAll('osv-review .cl-item')[0].click();
    document.querySelectorAll('osv-review .cl-item')[2].click();
  });
  await page.waitForTimeout(150);
  c = await checklistState();
  ok(c.progress === '2 of 7' && c.checked === 2, 'ticking two items updates progress to 2 of 7');

  // ================= Collapse / expand the checklist =================
  await page.evaluate(() => document.querySelector('osv-review .cl-toggle').click());
  await page.waitForTimeout(150);
  c = await checklistState();
  ok(c.items === 0 && c.progress === '2 of 7', 'collapsing hides the items but keeps the progress');
  await page.evaluate(() => document.querySelector('osv-review .cl-toggle').click());
  await page.waitForTimeout(150);
  c = await checklistState();
  ok(c.items === 7 && c.checked === 2, 'expanding restores the 7 items with ticks intact');

  // ================= Design tab =================
  await page.evaluate(() => document.querySelectorAll('osv-pane .tab')[3].click());
  await page.waitForTimeout(250);
  s = await stripState();
  ok(s.kind === 'Design' && (s.question || '').includes('technical approach') && s.chevron === '', 'design tab: doc-faithful minimal line, no expand affordance');

  // ================= Tasks tab =================
  await page.evaluate(() => document.querySelectorAll('osv-pane .tab')[4].click());
  await page.waitForTimeout(250);
  s = await stripState();
  ok(s.kind === 'Tasks' && (s.question || '').includes('plan of work sane'), 'tasks tab shows the tasks question');

  // ================= Metadata tab — no strip =================
  await page.evaluate(() => document.querySelectorAll('osv-pane .tab')[5].click());
  await page.waitForTimeout(250);
  s = await stripState();
  ok(s.present && s.hidden, 'metadata tab hides the strip');

  // ================= A → B → A tick memory =================
  await openChange('changes/bar');
  c = await checklistState();
  ok(c.progress === '0 of 7', 'change bar starts unticked');
  await openChange('changes/foo');
  c = await checklistState();
  ok(c.progress === '2 of 7' && c.checked === 2, 'switching back to foo restores its 2 ticks');

  // ================= Reload clears ticks =================
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForTimeout(300);
  await openChange('changes/foo');
  c = await checklistState();
  ok(c.progress === '0 of 7', 'reload resets all checklist ticks');

  // ================= Main spec / config / archive — no guidance =================
  await openFile('specs/acct/spec.md');
  s = await stripState(); c = await checklistState();
  ok(!s.present, 'main spec: no guide strip');
  ok(!c.present || c.hidden, 'main spec: no checklist');

  await openFile('config.yaml');
  s = await stripState(); c = await checklistState();
  ok(!s.present, 'config.yaml: no guide strip');
  ok(!c.present || c.hidden, 'config.yaml: no checklist');

  await openChange('changes/archive/2026-08-20-old');
  s = await stripState(); c = await checklistState();
  ok(!s.present, 'archived change: no guide strip');
  ok(!c.present || c.hidden, 'archived change: no checklist');

  // ================= Copy prompt: comments only, never checklist =================
  await openChange('changes/foo');
  await page.evaluate(() => {
    const title = document.querySelector('osv-pane .change-head h2.change-title');
    if (!title) throw new Error('no change title');
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(title);
    sel.removeAllRanges();
    sel.addRange(range);
    document.querySelector('osv-pane main').dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true }));
    const bub = document.querySelector('osv-pane .ann-bubble');
    if (!bub) throw new Error('no whole-file comment bubble after title selection');
    bub.querySelector('.ann-add').click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const ta = document.querySelector('osv-pane .ann-text');
    if (!ta) throw new Error('whole-file comment editor did not open');
    ta.value = 'Make the scope clearer.';
    document.querySelector('osv-pane .ann-save').click();
  });
  await page.waitForTimeout(250);
  ok(await copyDisabled() === false, 'copy enabled once a comment exists (regardless of checklist)');
  ok((await btnLabel()).includes('1 comment · 1 file'), 'copy button folds in the comment and file counts');
  const prompt = await page.evaluate(() => window.buildPrompt() || '');
  ok(prompt.includes('Make the scope clearer.'), 'prompt includes the comment');
  const leaky = /checklist|Two-minute|Nothing extra has crept/i.test(prompt);
  ok(!leaky, 'prompt contains no checklist content');

  out.steps.push('prompt: ' + prompt.split('\n')[0]);
  out.steps.push('DONE: ' + (out.errors.length === 0 ? 'PASS' : 'FAIL (' + out.errors.length + ' errors)'));
  return out;
}