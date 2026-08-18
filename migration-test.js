/* Migration test: v1 database (handles store with saved folder) must upgrade
   to v2 cleanly — the saved handle keeps working (picker startIn + auto-reopen)
   and the snapshots store is created. Regression for the v1->v2 upgrade bug
   in v1.10.0 where createObjectStore('handles') threw ConstraintError and
   aborted the upgrade, breaking handle persistence for returning users.

   Run from repo root:
     python -m http.server 8743
     playwright-cli open http://127.0.0.1:8743/index.html
     playwright-cli run-code --filename=migration-test.js
   Serves as: async page => { ... } single function expression. */
async page => {
  const out = { steps: [], errors: [] };
  const err = (msg) => { out.errors.push(msg); console.error('FAIL: ' + msg); };

  // Fresh context so the origin has no leftovers; seed the v1 database via a
  // route-stubbed first visit (the real app never runs there).
  const ctx = await page.context().browser().newContext();
  const p1 = await ctx.newPage();
  await p1.route('**/index.html', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>seed</title>' }));
  await p1.goto('http://127.0.0.1:8743/index.html');
  await p1.unroute('**/index.html');
  await p1.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open('osviewer', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('handles');
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put({ name: 'my-openspec-repo', kind: 'directory' }, 'dir');
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  });
  await p1.close();
  out.steps.push('seeded v1 db with saved handle');

  // Real app: autoReopen/loadHandle must upgrade to v2 without losing the handle.
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8743/index.html');
  await p.waitForTimeout(400);

  const state = await p.evaluate(async () => {
    const r = {};
    try { const saved = await loadHandle(); r.saved = saved ? { name: saved.name } : null; }
    catch (e) { r.savedErr = String(e); }
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open('osviewer', 2);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    r.version = db.version;
    r.stores = [...db.objectStoreNames];
    await putSnapshot('changes/x/proposal.md', { rel: 'changes/x/proposal.md', text: 'hello', mtime: 1 });
    r.snap = await getSnapshot('changes/x/proposal.md');
    await deleteSnapshot('changes/x/proposal.md');
    r.snapAfterDelete = await getSnapshot('changes/x/proposal.md');
    return r;
  });
  out.steps.push('after-reload: ' + JSON.stringify(state));

  if (!state.saved || state.saved.name !== 'my-openspec-repo') {
    err('loadHandle should return the v1-saved folder after upgrade, got ' + JSON.stringify(state.saved));
  }
  if (state.version !== 2) err('DB should be at version 2, got ' + state.version);
  if (!state.stores.includes('handles') || !state.stores.includes('snapshots')) {
    err('expected both stores after upgrade, got ' + state.stores.join(','));
  }
  if (!state.snap || state.snap.text !== 'hello') err('snapshots store should be usable after upgrade');
  if (state.snapAfterDelete !== null) err('deleteSnapshot should remove the snapshot');
  await ctx.close();

  out.ok = out.errors.length === 0;
  console.log('=== MIGRATION TEST RESULT ===');
  console.log(JSON.stringify(out, null, 1));
  return out;
}