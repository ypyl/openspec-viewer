/* Migration test: v2 database (single 'dir' handle + rel-keyed snapshots)
   must upgrade to v3 cleanly — the handle becomes the `legacy` folder row,
   snapshots are re-keyed to `folderId/rel`, read state survives, and the
   legacy localStorage highlights/collapse keys re-home under the legacy id.
   Regression for the multi-folder IDB v2->v3 migration (proposal
   multi-folder-monitoring, design D3).

   Run from repo root:
     python -m http.server 8743
     playwright-cli open http://127.0.0.1:8743/index.html
     playwright-cli run-code --filename=migration-test.js
   Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  const ctx = await page.context().browser().newContext();

  // Seed v2 state (and legacy localStorage keys) on the origin before the app
  // ever runs, via a route-stubbed first visit.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('osviewer.highlights', JSON.stringify({
        'changes/x/proposal.md': [{ id: 'h1', comment: 'keep me' }],
      }));
      localStorage.setItem('osviewer.collapsed', JSON.stringify(['Archive']));
    } catch (e) {}
  });
  const p1 = await ctx.newPage();
  await p1.route('**/index.html', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>seed</title>' }));
  await p1.goto('http://127.0.0.1:8743/index.html');
  await p1.unroute('**/index.html');
  await p1.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open('osviewer', 2);
      q.onupgradeneeded = () => {
        if (!q.result.objectStoreNames.contains('handles')) q.result.createObjectStore('handles');
        if (!q.result.objectStoreNames.contains('snapshots')) q.result.createObjectStore('snapshots', { keyPath: 'rel' });
      };
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction(['handles', 'snapshots'], 'readwrite');
      tx.objectStore('handles').put({ name: 'my-openspec-repo', kind: 'directory' }, 'dir');
      tx.objectStore('snapshots').put({ rel: 'changes/x/proposal.md', text: 'hello v2', mtime: 1, readHash: 7, unread: true });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  });
  await p1.close();
  out.steps.push('seeded v2 db (handle + snapshot) and legacy localStorage keys');

  // Real app: the module boot must migrate to v3 in the upgrade transaction.
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8743/index.html');
  await p.waitForTimeout(600);

  const state = await p.evaluate(async () => {
    const r = {};
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open('osviewer', 3);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    r.version = db.version;
    r.stores = [...db.objectStoreNames];
    const readAll = (store) => new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const q = tx.objectStore(store).getAll();
      q.onsuccess = () => res(q.result || []);
      q.onerror = () => rej(q.error);
    });
    r.folders = (await readAll('folders')).map(f => ({ id: f.id, name: f.name, kind: f.kind }));
    r.snaps = (await readAll('snapshots')).map(s =>
      ({ key: s.key, folderId: s.folderId, rel: s.rel, text: s.text, unread: s.unread, readHash: s.readHash }));
    r.legacyHighlights = localStorage.getItem('osviewer.highlights.legacy');
    r.oldHighlights = localStorage.getItem('osviewer.highlights');
    r.legacyCollapsed = localStorage.getItem('osviewer.collapsed.legacy');
    r.oldCollapsed = localStorage.getItem('osviewer.collapsed');
    db.close();
    return r;
  });
  out.steps.push('after-app-load: ' + JSON.stringify(state));

  if (state.version !== 3) err('DB should be at version 3, got ' + state.version);
  if (!state.stores.includes('folders') || !state.stores.includes('snapshots') || !state.stores.includes('handles')) {
    err('expected handles/folders/snapshots stores, got ' + state.stores.join(','));
  }
  const legacy = (state.folders || []).find(f => f.id === 'legacy');
  if (!legacy || legacy.name !== 'my-openspec-repo' || legacy.kind !== 'pick') {
    err('folders store should hold the legacy row from the v2 handle, got ' + JSON.stringify(state.folders));
  }
  const snap = (state.snaps || []).find(s => s.key === 'legacy/changes/x/proposal.md');
  if (!snap || snap.folderId !== 'legacy' || snap.rel !== 'changes/x/proposal.md') {
    err('snapshot should be re-keyed to legacy/changes/x/proposal.md, got ' + JSON.stringify(state.snaps));
  } else {
    if (snap.text !== 'hello v2') err('snapshot text should survive, got ' + snap.text);
    if (snap.unread !== true) err('snapshot unread state should survive, got ' + snap.unread);
    if (snap.readHash !== 7) err('snapshot readHash should survive, got ' + snap.readHash);
  }
  let hls = null;
  try { hls = JSON.parse(state.legacyHighlights || 'null'); } catch (e) {}
  if (!hls || !hls['changes/x/proposal.md'] || hls['changes/x/proposal.md'][0].id !== 'h1') {
    err('legacy highlights should re-home under the legacy folder id, got ' + state.legacyHighlights);
  }
  if (state.oldHighlights !== null) err('old rel-keyed highlights key should be removed');
  if (state.legacyCollapsed !== '["Archive"]') err('legacy collapse choice should re-home, got ' + state.legacyCollapsed);
  if (state.oldCollapsed !== null) err('old collapse key should be removed');
  await ctx.close();

  out.ok = out.errors.length === 0;
  console.log('=== MIGRATION TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}