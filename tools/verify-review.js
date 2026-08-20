/* End-to-end verification for the open-review-as-side-panel change.
 *
 * Run (from repo root):
 *   python -m http.server 8743
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli resize 1600 900
 *   playwright-cli run-code --filename=tools/verify-review.js
 *
 * Stubs the File System Access API with an in-memory tree, opens an artifact,
 * makes a real text selection + comment (auto-opens the review), then asserts
 * the review is a layout column that shrinks the pane on wide viewports and an
 * overlay that does NOT shrink the pane on narrow viewports.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };
  const ok = (s) => out.steps.push(s);

  const fsData = {
    'openspec/changes/alpha/proposal.md': {
      text: '# Alpha Proposal\n\nWe embed LLMs into business processes end to end. Fix this whole section carefully and thoroughly today.\n\n- [ ] Ship it\n', mtime: 1000,
    },
    'openspec/changes/alpha/design.md': { text: '# Design\n\nKeep it accessible and simple here.\n', mtime: 1100 },
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

    await page.setViewportSize({ width: 1600, height: 900 }); // wide: layout column active
    await page.goto('http://127.0.0.1:8743/index.html');
    ok('page loaded at 1600x900');
    await page.waitForFunction(() => window.startMonitoring && document.querySelector('osv-search .s-input'), null, { timeout: 8000 });
    await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
    ok('monitoring started');

    // Open the proposal artifact: click the change, then its proposal tab.
    const item = page.locator('osv-file-list .item').filter({ hasText: 'Alpha' }).first();
    await item.click();
    await page.waitForSelector('osv-pane .tab.proposal', { timeout: 8000 });
    await page.click('osv-pane .tab.proposal');
    await page.waitForSelector('osv-pane main .annotatable', { timeout: 8000 });
    ok('proposal rendered');

    const paneWidthWhenClosedWide = await page.$eval('osv-pane', el => el.getBoundingClientRect().width);
    // Closed column must occupy zero horizontal space.
    const reviewWidthClosed = await page.$eval('osv-review', el => getComputedStyle(el).width);
    const reviewInLayout = await page.evaluate(() => {
      const r = document.querySelector('osv-review');
      return r && r.parentElement && r.parentElement.classList.contains('layout');
    });
    if (!(/0px/.test(reviewWidthClosed))) err('closed osv-review width not 0: ' + reviewWidthClosed);
    if (!reviewInLayout) err('osv-review is not a child of .layout');
    ok('wide closed: osv-review width=' + reviewWidthClosed + ', inside .layout=' + reviewInLayout + ', pane=' + Math.round(paneWidthWhenClosedWide));

    // Real selection → comment → auto-open.
    await page.evaluate(() => {
      const annot = document.querySelector('osv-pane main .annotatable');
      const walker = document.createTreeWalker(annot, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node && !node.data.trim()) node = walker.nextNode();
      const start = 0; const end = Math.min(node.data.length, 24);
      const range = document.createRange();
      range.setStart(node, start); range.setEnd(node, end);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      document.querySelector('osv-pane main').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await page.waitForSelector('.ann-bubble .ann-add', { timeout: 5000 });
    await page.click('.ann-bubble .ann-add');
    await page.fill('.ann-bubble .ann-text', 'Fix this wording please');
    await page.click('.ann-bubble .ann-save');
    await page.waitForFunction(() => document.querySelector('osv-review .review-drawer.open'), null, { timeout: 5000 });
    await page.waitForTimeout(350); // let the width transition settle
    ok('review auto-opened after first comment');

    const drawerPosWide = await page.$eval('osv-review .review-drawer', el => getComputedStyle(el).position);
    const reviewWidthOpen = await page.$eval('osv-review', el => getComputedStyle(el).width);
    const paneWidthOpenWide = await page.$eval('osv-pane', el => el.getBoundingClientRect().width);
    const countBadge = await page.$eval('osv-header .review-count', el => el.textContent);
    const headerActive = await page.$eval('osv-header .review-btn', el => el.classList.contains('active'));
    const copyDisabled = await page.$eval('osv-review .copy-btn', el => el.disabled);
    const sendDisabled = await page.$eval('osv-review .send-btn', el => el.disabled);
    if (drawerPosWide !== 'static') err('wide drawer position should be static, got ' + drawerPosWide);
    if (!/380px/.test(reviewWidthOpen)) err('open osv-review width should be 380px, got ' + reviewWidthOpen);
    if (!(paneWidthOpenWide < paneWidthWhenClosedWide)) err('pane did not shrink on open: ' + paneWidthWhenClosedWide + ' -> ' + paneWidthOpenWide);
    if (countBadge !== '1') err('count badge should be 1, got ' + countBadge);
    if (!headerActive) err('header button not active while open');
    if (copyDisabled) err('copy-btn should be enabled (has comment)');
    if (sendDisabled) err('send-btn should be enabled (has comment)');
    ok('wide open: drawer position=' + drawerPosWide + ', review width=' + reviewWidthOpen + ', pane ' + Math.round(paneWidthWhenClosedWide) + '->' + Math.round(paneWidthOpenWide) + ' (shrunk=' + (paneWidthOpenWide < paneWidthWhenClosedWide) + '), badge=' + countBadge + ', headerActive=' + headerActive + ', copyEnabled=' + !copyDisabled + ', sendEnabled=' + !sendDisabled);

    // Close via ✕, pane expands back.
    await page.click('osv-review .review-close');
    await page.waitForTimeout(350);
    const paneWidthClosed2 = await page.$eval('osv-pane', el => el.getBoundingClientRect().width);
    const reopened = await page.evaluate(() => document.querySelector('osv-review .review-drawer').classList.contains('open'));
    if (reopened) err('drawer should be closed after ✕');
    if (Math.abs(paneWidthClosed2 - paneWidthWhenClosedWide) > 2) err('pane did not return to full width after close: ' + Math.round(paneWidthClosed2));
    ok('close: drawerClosed=' + !reopened + ', pane back to ' + Math.round(paneWidthClosed2));

    // Reopen via header button.
    await page.click('osv-header .review-btn');
    await page.waitForFunction(() => document.querySelector('osv-review .review-drawer.open'), null, { timeout: 3000 });
    await page.waitForTimeout(350);
    ok('reopened via header button');

    // ---- Narrow viewport: overlay fallback, pane NOT squeezed ----
    await page.setViewportSize({ width: 800, height: 700 }); // < 80em
    await page.waitForTimeout(100);
    const drawerPosNarrow = await page.$eval('osv-review .review-drawer', el => getComputedStyle(el).position);
    const paneWidthOpenNarrow = await page.$eval('osv-pane', el => el.getBoundingClientRect().width);
    // Close and measure the same pane width when the narrow overlay is hidden.
    await page.click('osv-review .review-close');
    await page.waitForTimeout(120);
    const paneWidthClosedNarrow = await page.$eval('osv-pane', el => el.getBoundingClientRect().width);
    if (drawerPosNarrow !== 'fixed') err('narrow drawer position should be fixed, got ' + drawerPosNarrow);
    if (Math.abs(paneWidthClosedNarrow - paneWidthOpenNarrow) > 2) err('narrow viewport: pane was squeezed by review (' + Math.round(paneWidthOpenNarrow) + ' -> ' + Math.round(paneWidthClosedNarrow) + ')');
    ok('narrow: drawer position=' + drawerPosNarrow + ', pane open=' + Math.round(paneWidthOpenNarrow) + ' closed=' + Math.round(paneWidthClosedNarrow) + ' (not squeezed=' + (Math.abs(paneWidthClosedNarrow - paneWidthOpenNarrow) <= 2) + ')');

    ok('ALL_STEPS=' + out.steps.length + ' ERRORS=' + out.errors.length);
    return out;
  } catch (e) {
    console.error('THREW: ' + e.message);
    return { steps: out.steps, errors: out.errors.concat(['threw: ' + e.message]) };
  }
}
