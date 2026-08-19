// Node unit tests for the diff engine (app/diff.js) — node --test, zero deps.
// Run: npm test   (or: node --test tools/test-diff.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  splitLines, diffLines, relTime, hunkHeader, diffHunksHtml, diffHint, diffTabBadgeHtml,
} from '../app/diff.js';

test('splitLines: normalizes CR/LF and drops a trailing empty line', () => {
  assert.deepEqual(splitLines('a\r\nb\n'), ['a', 'b']);
  assert.deepEqual(splitLines(''), []);
  assert.deepEqual(splitLines('one'), ['one']);
});

test('diffLines: identical text returns null', () => {
  assert.equal(diffLines('a\nb\nc\n', 'a\nb\nc\n'), null);
});

test('diffLines: single-line replacement yields +1 −1 in one hunk', () => {
  const d = diffLines('a\nb\nc\n', 'a\nX\nc\n');
  assert.ok(d);
  assert.equal(d.added, 1);
  assert.equal(d.removed, 1);
  assert.equal(d.hunks.length, 1);
});

test('diffLines: count lines added from empty and removed to empty', () => {
  const d1 = diffLines('', 'hello\nworld\n');
  assert.ok(d1);
  assert.equal(d1.added, 2);
  assert.equal(d1.removed, 0);
  const d2 = diffLines('x\n', '');
  assert.equal(d2.added, 0);
  assert.equal(d2.removed, 1);
});

test('diffLines: keeps a 3-line context window around changes', () => {
  const d = diffLines(
    'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10\n',
    'l1\nl2\nCHG\nl4\nl5\nl6\nl7\nl8\nl9\nl10\n',
  );
  assert.equal(d.hunks.length, 1);
  // ctx(2) + del + add + ctx(3)
  assert.equal(d.hunks[0].lines.length, 7);
});

test('diffLines: very large inputs fall back to all-changed (no giant DP table)', () => {
  const a = 'x\n'.repeat(2100);
  const b = 'y\n'.repeat(2100);
  const d = diffLines(a, b);
  assert.ok(d);
  assert.equal(d.added, 2100);
  assert.equal(d.removed, 2100);
});

test('hunkHeader: formats count-1 without a range', () => {
  assert.equal(
    hunkHeader({ oldStart: 1, oldCount: 3, newStart: 1, newCount: 3 }),
    '@@ -1,3 +1,3 @@',
  );
  assert.equal(
    hunkHeader({ oldStart: 2, oldCount: 1, newStart: 2, newCount: 1 }),
    '@@ -2 +2 @@',
  );
});

test('diffHunksHtml: renders a header plus add/delete lines', () => {
  const html = String(diffHunksHtml({
    hunks: [{
      oldStart: 2, newStart: 2, oldCount: 1, newCount: 1,
      lines: [['-', 2, 0, 'old'], ['+', 0, 2, 'new']],
    }],
  }));
  assert.ok(html.includes('diff-line del'));
  assert.ok(html.includes('diff-line add'));
  assert.ok(html.includes('@@ -2 +2 @@'));
});

test('diffHint: sums added/removed across diffs; empty when no changes', () => {
  assert.ok(String(diffHint([{ added: 2, removed: 1 }])).includes('+2'));
  assert.equal(diffHint([]), '');
  assert.equal(diffHint([{ added: 0, removed: 0 }]), '');
});

test('diffTabBadgeHtml: shows counts only when nonzero and unread', () => {
  assert.ok(String(diffTabBadgeHtml({ added: 2, removed: 1 }, true)).includes('+2'));
  assert.equal(diffTabBadgeHtml({ added: 2, removed: 1 }, false), '');
  assert.equal(diffTabBadgeHtml(null, true), '');
  assert.equal(diffTabBadgeHtml({ added: 0, removed: 0 }, true), '');
});

test('relTime: just-now for a fresh timestamp', () => {
  assert.equal(relTime(Date.now()), 'just now');
  assert.equal(relTime(Date.now() - 3 * 60 * 1000), '3 min ago');
});
