/* End-to-end verification for content search (fuzzy-content-search change).
 *
 * Run (from repo root):
 *   python -m http.server 8743
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=verify-search.js
 *
 * Stubs the File System Access API with an in-memory tree (like diff-test.js),
 * then exercises the real search pipeline end-to-end: content matches across
 * sections (change proposal, spec, archive, config), typo tolerance, grouped
 * dropdown with highlighted snippets, clicking a result opens the artifact with
 * the matched text highlighted in the pane, Escape clearing, and live-monitor
 * add/remove reflected in results without reload.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };
  const ok = (s) => out.steps.push(s);

  const fsData = {
    'openspec/changes/alpha/proposal.md': {
      text: '# Alpha Proposal\n\nWe embed LLMs into business processes end to end.\n\n- [ ] Ship it\n', mtime: 1000,
    },
    'openspec/changes/alpha/design.md': { text: '# Design\n\nKeep it accessible and simple.\n', mtime: 1100 },
    'openspec/specs/auth/spec.md': { text: '# Auth Spec\n\nUsers authenticate with a signed token.\n', mtime: 1400 },
    'openspec/changes/archive/2026-01-01-old-change/proposal.md': {
      text: '# Old Change\n\nA legacy archived proposal about data migrations.\n', mtime: 2000,
    },
    'openspec/specs/ops/spec.md': { text: '# Ops\n\nPlan the process for each deployment week.\n', mtime: 2100 },
    'openspec/config.yaml': { text: 'extends: openspec\nplugins: [search]\n', mtime: 1500 },
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('PAGE ERROR: ' + msg.text());
  });

  try {
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
      window.__makeFs = () => makeDir('repo', buildNode());
      window.showDirectoryPicker = async () => window.__makeFs();
    }, fsData);

    await page.goto('http://127.0.0.1:8743/index.html');
    ok('page loaded');
    await page.waitForFunction(() => window.startMonitoring && document.querySelector('osv-search .s-input'), null, { timeout: 8000 });
    ok('app ready with search input');
    await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
    ok('monitoring started');

    const fill = (q) => page.fill('osv-search .s-input', q);
    const items = () => page.$$eval('osv-search .s-drop .s-item', els => els.map(e => e.textContent));
    const heads = () => page.$$eval('osv-search .s-drop .s-head', els => els.map(e => e.textContent));
    const dropMarks = () => page.$$eval('osv-search .s-drop mark.sq', els => els.length);
    const paneMarks = () => page.$$eval('osv-pane mark.sq', els => els.length);
    const paneText = () => page.$eval('osv-pane', el => el.textContent);
    const waitResults = async (label, expected) => {
      ok('searching: ' + label);
      // Wait for a result specific to THIS query, so a stale result still in
      // the dropdown during the debounce window can't satisfy the wait.
      await page.waitForSelector(`osv-search .s-drop .s-item:has-text("${expected}")`, { timeout: 8000 });
    };

    // 1. Content match in a change proposal body (not its name)
    await fill('embed LLMs into');
    await waitResults('embed LLMs into', 'Alpha');
    let its = await items();
    if (!its.some(t => t.includes('Alpha'))) err('change proposal not found by content');
    ok('change body search -> ' + JSON.stringify(its.slice(0, 2)));

    // 2. Sections are grouped in tree order
    ok('dropdown sections: ' + JSON.stringify(await heads()));

    // 3. Snippet has highlighted match
    const dm = await dropMarks();
    ok('snippet marks: ' + dm);
    if (dm < 1) err('no highlighted match in snippet');

    // 4. Typo tolerance
    await fill('embd llms into');
    await waitResults('typo', 'Alpha');
    its = await items();
    if (!its.some(t => t.includes('Alpha'))) err('typo-tolerant match failed');
    ok('typo match -> ' + JSON.stringify(its.slice(0, 2)));

    // 5. Spec match
    await fill('signed token');
    await waitResults('spec', 'Auth Spec');
    its = await items();
    if (!its.some(t => t.includes('Auth Spec'))) err('spec match failed');
    ok('spec search -> ' + JSON.stringify(its.slice(0, 2)));

    // 6. Config match
    await fill('search plugins');
    await waitResults('config', 'config.yaml');
    its = await items();
    if (!its.some(t => t.includes('config.yaml'))) err('config match failed');
    ok('config search -> ' + JSON.stringify(its.slice(0, 2)));

    // 7. Archive match
    await fill('data migrations');
    await waitResults('archive', 'Old Change');
    its = await items();
    if (!its.some(t => t.includes('Old Change'))) err('archive match failed');
    ok('archive search -> ' + JSON.stringify(its.slice(0, 2)));

    // 7b. AND semantics: an artifact matching only ONE term of a phrase is
    //     excluded (the 'ops' doc has 'process' but not 'business').
    await fill('business process');
    await waitResults('and semantics', 'Alpha');
    its = await items();
    if (!its.some(t => t.includes('Alpha'))) err('multi-word query should match the full match');
    if (its.some(t => t.includes('Ops'))) err('multi-word query matched a doc containing only one term');
    ok('and semantics: single-term doc excluded -> ' + JSON.stringify(its.slice(0, 3)));

    // 8. Click a spec result -> opens the file with match highlighted
    await fill('signed token');
    await waitResults('spec click', 'Auth Spec');
    await page.click('osv-search .s-drop .s-item:has-text("Auth Spec")');
    await page.waitForTimeout(250);
    ok('spec open marks: ' + (await paneMarks()));
    if (!(await paneText()).includes('Auth Spec')) err('spec did not open after result click');
    if ((await paneMarks()) < 1) err('no pane mark.sq after opening a spec result');

    // 9. Click a change result -> opens the change at the Proposal tab
    await fill('embed LLMs');
    await waitResults('change click', 'Alpha');
    await page.click('osv-search .s-drop .s-item:has-text("Alpha Propos")');
    await page.waitForTimeout(250);
    ok('change open marks: ' + (await paneMarks()));
    const pt = await paneText();
    if (!pt.includes('Alpha Proposal')) err('change view did not open to the proposal');
    if ((await paneMarks()) < 1) err('no pane mark.sq after opening a change result');

    // 10. Escape clears the query and the pane marks
    await page.click('osv-search .s-input');
    await page.press('osv-search .s-input', 'Escape');
    await page.waitForTimeout(150);
    const cleared = await paneMarks();
    ok('marks after Escape clear: ' + cleared);
    if (cleared !== 0) err('search marks not cleared on Escape');
    if (await page.inputValue('osv-search .s-input') !== '') err('Escape did not clear the input');

    // 11. Live add appears in results without reload (recreate the fs tree
    //     like diff-test.js does so the scan sees the new file).
    await page.evaluate(() => {
      window.__fsData['openspec/specs/newcap/spec.md'] = { text: '# New Cap\n\nBrand-new fresh content here.\n', mtime: 9000 };
    });
    await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), true); });
    await fill('fresh content here');
    await waitResults('live add', 'New Cap');
    its = await items();
    if (!its.some(t => t.includes('New Cap'))) err('live-added artifact not searchable');
    ok('live-add search -> ' + JSON.stringify(its.slice(0, 2)));

    // 12. Live remove leaves the results
    await page.evaluate(() => { delete window.__fsData['openspec/specs/newcap/spec.md']; });
    await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), true); });
    await fill('fresh content here');
    await page.waitForSelector('osv-search .s-drop .s-empty', { timeout: 8000 });
    its = await items();
    if (its.some(t => t.includes('New Cap'))) err('live-deleted artifact still searchable');
    ok('live-remove -> empty state, items=' + its.length);

    ok('done');
  } catch (e) {
    err('THREW: ' + (e && e.message));
  }

  console.log('=== SEARCH TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}
