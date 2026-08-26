/* End-to-end test for search keyboard shortcuts (v3.13.0): Ctrl+P / Cmd+P
 * focus and select the header search input without opening the browser's
 * native print dialog, from any app state; Ctrl+K / Cmd+K keep working.
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=search-hotkey-test.js
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const fsData = {
    'openspec/changes/alpha/proposal.md': {
      text: '# Alpha Proposal\n\n## Goal\n\nImprove the thing.\n',
      mtime: 1000,
    },
    'openspec/specs/cap/spec.md': { text: '# Cap Spec\n\nA capability.\n', mtime: 1100 },
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
        kind: 'directory',
        name,
        queryPermission: async () => 'granted',
        values: async function* () {
          for (const [d, c] of Object.entries(n.dirs)) yield makeDir(d, c);
          for (const [f, data] of Object.entries(n.files)) {
            yield {
              kind: 'file',
              name: f,
              getFile: async () => ({ lastModified: data.mtime, text: async () => data.text }),
            };
          }
        },
      };
    }
    window.__makeFs = () => makeDir('repo', buildNode());
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
  await page.reload({ ignoreCache: true });
  await page.waitForFunction(() => window.__makeFs !== undefined);
  await page.waitForTimeout(300);

  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForTimeout(200);

  const focused = () => page.evaluate(() => {
    const el = document.activeElement;
    return el ? (el.classList ? el.classList.contains('s-input') : false) : false;
  });
  const inputState = () => page.evaluate(() => {
    const i = document.querySelector('.s-input');
    return i ? { value: i.value, selStart: i.selectionStart, selEnd: i.selectionEnd } : null;
  });
  // Synthetic ctrl/meta+P: proves the listener calls preventDefault(), so the
  // browser's native print action never fires.
  const synthetic = (key, ctrl, meta) => page.evaluate(([k, c, m]) => {
    const ev = new KeyboardEvent('keydown', { key: k, ctrlKey: c, metaKey: m, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    return { prevented: ev.defaultPrevented, onInput: document.activeElement === document.querySelector('.s-input') };
  }, [key, ctrl, meta]);

  // ---- 1) Ctrl+P suppresses print and focuses search (empty input). ----
  let s = await synthetic('p', true, false);
  out.steps.push('ctrl-p-synthetic: ' + JSON.stringify(s));
  if (!s.prevented) err('Ctrl+P keydown must be default-prevented (no print dialog)');
  if (!s.onInput) err('Ctrl+P should focus the search input');
  if (!(await focused())) err('search input should own focus after Ctrl+P');

  // ---- 2) Real keypress: Ctrl+P focuses search and selects its contents. ----
  await page.keyboard.type('proposal');
  await page.waitForTimeout(200);
  const before = await inputState();
  out.steps.push('typed: ' + JSON.stringify(before));
  if (before.value !== 'proposal') err('typing into the focused search input should work, got: ' + before.value);
  await page.keyboard.press('Control+p');
  await page.waitForTimeout(100);
  const after = await inputState();
  out.steps.push('ctrl-p-reselect: ' + JSON.stringify(after));
  if (!(await focused())) err('Ctrl+P (real keypress) should keep focus in the search input');
  if (after.selStart !== 0 || after.selEnd !== after.value.length) {
    err('Ctrl+P should select the input contents, got selection ' + after.selStart + '..' + after.selEnd);
  }

  // ---- 3) Works from an open artifact: focus moves, artifact stays. ----
  await page.evaluate(async () => { await window.openFile('changes/alpha/proposal.md'); });
  await page.waitForTimeout(400);
  const artifactOpenBefore = await page.evaluate(() => !!document.querySelector('osv-pane .tab.active'));
  await page.keyboard.press('Control+p');
  await page.waitForTimeout(100);
  const artifactOpenAfter = await page.evaluate(() => !!document.querySelector('osv-pane .tab.active'));
  out.steps.push('with-artifact: ' + JSON.stringify({ before: artifactOpenBefore, after: artifactOpenAfter, focused: await focused() }));
  if (!artifactOpenBefore) err('setup: proposal should be open before the shortcut');
  if (!(await focused())) err('Ctrl+P should focus search with an artifact open');
  if (!artifactOpenAfter) err('the open artifact should stay open after Ctrl+P');

  // ---- 4) Ctrl+K still focuses search; Cmd variants work too. ----
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(100);
  out.steps.push('ctrl-k: focused=' + (await focused()));
  if (!(await focused())) err('Ctrl+K should still focus the search input');
  const metaP = await synthetic('p', false, true);
  const metaK = await synthetic('k', false, true);
  out.steps.push('meta-variants: ' + JSON.stringify({ p: metaP, k: metaK }));
  if (!metaP.prevented || !metaP.onInput) err('Cmd+P should also prevent print and focus search');
  if (!metaK.prevented || !metaK.onInput) err('Cmd+K should also focus search');

  out.ok = out.errors.length === 0;
  console.log('=== SEARCH HOTKEY TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}