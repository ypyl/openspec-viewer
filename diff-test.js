/* End-to-end test for content-level change diffs (v1.10.0).
 *
 * Run (from repo root):
 *   python -m http.server 8743        # serve the app
 *   playwright-cli open http://127.0.0.1:8743/index.html
 *   playwright-cli run-code --filename=diff-test.js
 *
 * Stubs the File System Access API with an in-memory tree, then exercises the
 * real scan -> snapshot (IndexedDB) -> line-diff -> render pipeline:
 * fresh-pick baseline, in-session mutation, flat (non-change) artifacts,
 * auto-open of fresh diffs, and the reload-equivalent keepSnapshots path.
 * Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const fsData = {
    'openspec/changes/alpha/proposal.md': {
      text: '# Alpha Proposal\n\n## Goal\n\nImprove the thing.\n\n## Tasks\n\n- [ ] Ship it\n',
      mtime: 1000,
    },
    'openspec/changes/alpha/design.md': { text: '# Design\n\nKeep it simple.\n', mtime: 1100 },
    'openspec/changes/alpha/tasks.md': { text: '- [ ] do it\n', mtime: 1200 },
    'openspec/changes/alpha/change.md': { text: '# Change\n\nSummary here.\n', mtime: 1300 },
    'openspec/specs/cap/spec.md': {
      text: '# Cap Spec\n\n## Requirements\n\n- REQ-1\n- REQ-2\n\n## Notes\n\nKeep notes here.\n',
      mtime: 1400,
    },
    'openspec/config.yaml': { text: 'extends: openspec\n', mtime: 1500 },
  };

  // Stub the File System Access API before the app loads.
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

  // ---- Unit tests against the page's own functions ----
  const unit = await page.evaluate(() => {
    const r = {};
    r.identical = diffLines('a\nb\nc\n', 'a\nb\nc\n') === null;
    const d1 = diffLines('a\nb\nc\n', 'a\nX\nc\n');
    r.replace = d1.added === 1 && d1.removed === 1 && d1.hunks.length === 1;
    r.hdr = d1.hunks[0].oldStart === 1 && d1.hunks[0].newStart === 1 &&
            hunkHeader(d1.hunks[0]) === '@@ -1,3 +1,3 @@';
    const d2 = diffLines('', 'hello\nworld\n');
    r.fromEmpty = d2 && d2.added === 2 && d2.removed === 0;
    const d3 = diffLines('x\n', '');
    r.toEmpty = d3 && d3.added === 0 && d3.removed === 1;
    const d4 = diffLines('l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10\n', 'l1\nl2\nCHG\nl4\nl5\nl6\nl7\nl8\nl9\nl10\n');
    r.context = d4.hunks.length === 1 && d4.hunks[0].lines.length === 7;   // ctx(2)+del+add+ctx(3)
    const blk = diffBlock({ hunks: [{ oldStart: 2, newStart: 2, oldCount: 1, newCount: 1, lines: [['-', 2, 0, 'old'], ['+', 0, 2, 'new']] }], added: 1, removed: 1, ts: Date.now() - 60000 }, true);
    const s = String(blk);
    r.block = s.includes('details class="diff" open') && s.includes('+1') && s.includes('−1') &&
              s.includes('diff-line del') && s.includes('diff-line add') && s.includes('@@ -2 +2 @@');
    r.hint = String(diffHint([{ added: 2, removed: 1 }])).includes('+2') && diffHint([]) === '';
    return r;
  });
  out.steps.push('unit: ' + JSON.stringify(unit));
  for (const [k, v] of Object.entries(unit)) if (!v) err('unit check ' + k);

  // ---- Session 1: fresh pick, baseline scan ----
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), false); });
  await page.waitForTimeout(200);
  let state = await page.evaluate(() => ({
    newDots: document.querySelectorAll('.item.new').length,
    hints: document.querySelectorAll('.diff-hint').length,
    diffs: document.querySelectorAll('details.diff').length,
    rows: document.querySelectorAll('.item.change-row').length,
  }));
  out.steps.push('baseline: ' + JSON.stringify(state));
  if (state.newDots !== 0) err('baseline should have no new markers');
  if (state.hints !== 0 || state.diffs !== 0) err('baseline should have no diffs');

  // ---- Mutate the proposal (2 lines changed, 2 added) ----
  await page.evaluate(() => {
    const d = window.__fsData['openspec/changes/alpha/proposal.md'];
    d.mtime = 2000;
    d.text = '# Alpha Proposal\n\n## Goal\n\nImprove the thing thoroughly.\n\n## Tasks\n\n- [x] Ship it\n- [ ] Ship it well\n- [ ] Update docs\n';
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(200);

  state = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.item.change-row')].find(r => r.textContent.includes('Alpha'));
    return {
      hint: row ? row.querySelector('.diff-hint').textContent : null,
      diffOpen: document.querySelector('details.diff[open]') !== null,
      addLines: document.querySelectorAll('details.diff .diff-line.add').length,
      delLines: document.querySelectorAll('details.diff .diff-line.del').length,
      hasAddedText: [...document.querySelectorAll('details.diff .diff-line.add')].some(l => l.textContent.includes('Ship it well')),
      hasHdr: document.querySelector('details.diff .diff-line.hdr') ? document.querySelector('details.diff .diff-line.hdr').textContent : null,
    };
  });
  out.steps.push('after-mutation: ' + JSON.stringify(state));
  if (state.hint !== '+4 −2') err('expected change-row hint "+4 −2", got ' + state.hint);
  if (!state.diffOpen) err('diff should auto-open on the active (open) file');
  if (state.addLines !== 4) err('expected 4 added lines, got ' + state.addLines);
  if (state.delLines !== 2) err('expected 2 deleted lines, got ' + state.delLines);
  if (!state.hasAddedText) err('added line content missing');

  // ---- Mutate a spec (flat item, not open) ----
  await page.evaluate(() => {
    const d = window.__fsData['openspec/specs/cap/spec.md'];
    d.mtime = 3000;
    d.text = '# Cap Spec\n\n## Requirements\n\n- REQ-1\n- REQ-2\n- REQ-3\n\n## Notes\n\nKeep notes here.\n';
  });
  await page.evaluate(async () => { await window.scan(false); });
  await page.waitForTimeout(200);
  state = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.item[data-rel]')].find(i => i.dataset.rel === 'specs/cap/spec.md');
    return {
      itemHint: item && item.querySelector('.diff-hint') ? item.querySelector('.diff-hint').textContent.trim() : null,
      itemNew: item ? item.classList.contains('new') : false,
      groupNews: [...document.querySelectorAll('.group-new')].map(g => g.textContent),
    };
  });
  out.steps.push('spec-mutation: ' + JSON.stringify(state));
  if (state.itemHint !== '+1') err('expected spec hint "+1", got ' + state.itemHint);
  if (!state.itemNew) err('spec item should keep its new marker while unopened');
  if (!state.groupNews.some(t => t.includes('new'))) err('expected a section new-counter');

  // ---- Open the spec: its diff should auto-open on first view ----
  await page.evaluate(async () => { await window.openFile('specs/cap/spec.md'); });
  await page.waitForTimeout(150);
  state = await page.evaluate(() => ({
    specDiffOpen: document.querySelector('details.diff') ? document.querySelector('details.diff').open : null,
    specAdds: document.querySelectorAll('details.diff .diff-line.add').length,
  }));
  out.steps.push('spec-open: ' + JSON.stringify(state));
  if (!state.specDiffOpen) err('spec diff should auto-open on first view');
  if (state.specAdds !== 1) err('expected 1 added line in spec diff, got ' + state.specAdds);

  // ---- Session 2: same folder re-opened (keepSnapshots) with another change ----
  await page.evaluate(() => {
    const d = window.__fsData['openspec/changes/alpha/design.md'];
    d.mtime = 4000;
    d.text = '# Design\n\nKeep it simple, but document the architecture.\n';
  });
  await page.evaluate(async () => { await window.startMonitoring(window.__makeFs(), true); });
  await page.waitForTimeout(200);
  state = await page.evaluate(() => ({
    toast: document.querySelector('.toast') ? document.querySelector('.toast').textContent : null,
    newItems: document.querySelectorAll('.item.new').length,
  }));
  out.steps.push('session2: ' + JSON.stringify(state));
  if (!state.toast || !state.toast.includes('since your last visit')) err('expected session2 toast, got ' + state.toast);
  if (state.newItems < 1) err('expected new markers after re-open with persisted snapshots');

  out.ok = out.errors.length === 0;
  console.log('=== DIFF TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}