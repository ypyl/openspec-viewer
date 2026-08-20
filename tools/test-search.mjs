// Node unit tests for the content-search helpers (app/model.js) — node --test,
// zero deps. Run: npm test   (or: node --test tools/test-search.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';

import { searchLabel, searchTitle, snippetSegments } from '../app/model.js';

test('searchLabel: change pretty name / capability path / file path', () => {
  assert.equal(searchLabel('changes/mark-diff-as-read/design.md'), 'Mark Diff As Read');
  assert.equal(searchLabel('changes/archive/2026-08-19-mark-diff-as-read/design.md'), 'Mark Diff As Read');
  assert.equal(searchLabel('specs/acct/spec.md'), 'acct');
  assert.equal(searchLabel('config.yaml'), 'config.yaml');
});

test('searchTitle: change name + artifact segment, capability path, file', () => {
  assert.equal(searchTitle('changes/mark-diff-as-read/design.md'), 'Mark Diff As Read design.md');
  assert.equal(searchTitle('changes/archive/2026-08-19-mark-diff-as-read/tasks.md'), 'Mark Diff As Read tasks.md');
  assert.equal(searchTitle('specs/acct/spec.md'), 'acct');
  assert.equal(searchTitle('config.yaml'), 'config.yaml');
});

test('snippetSegments: context window around the first match with hit flags', () => {
  const text = 'l1\nl2\nl3\nl4\nl5\nl6\nl7\n';
  const { segments, line } = snippetSegments(text, [[6, 8]]);   // 'l3'
  assert.equal(line, 3);
  const hits = segments.filter(s => s.hit);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].t, 'l3');
  const joined = segments.map(s => s.t).join('');
  // ±2 context lines: window is lines 1..5, so l1 and l5 are present.
  assert.ok(joined.includes('l2'));
  assert.ok(joined.includes('l5'));
  assert.ok(!joined.includes('l6'));
});

test('snippetSegments: no ranges → top-of-document window, line 0', () => {
  const text = 'HEADER\na\nb\nc\nd\n';
  const { segments, line } = snippetSegments(text, []);
  assert.equal(line, 0);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].hit, false);
  assert.ok(segments[0].t.includes('HEADER'));
});

test('snippetSegments: merges multiple/adjacent ranges', () => {
  const text = 'l1\nl2\nl3\nl4\nl5\nl6\nl7\n';
  const { segments, line } = snippetSegments(text, [[6, 8], [9, 11]]);   // 'l3' + 'l4'
  assert.equal(line, 3);
  const hits = segments.filter(s => s.hit).map(s => s.t);
  assert.deepEqual(hits, ['l3', 'l4']);
});

test('snippetSegments: ranges beyond the window edge are clipped', () => {
  // A match on a later line is clipped to the document edge without error.
  const text = 'a\nb\nc\nd\ne\nf\ng\nh\ni\n';   // 'i' at offset 16..17
  const { segments } = snippetSegments(text, [[16, 17]]);
  const joined = segments.map(s => s.t).join('');
  assert.ok(joined.includes('i'));
  assert.ok(segments.some(s => s.hit));
});
