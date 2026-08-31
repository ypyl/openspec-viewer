// Node unit tests for the path/artifact model (app/model.js) — node --test,
// zero deps. Run: npm test   (or: node --test tools/test-model.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normPath, artifactOf, artifactPhrase, isRelevant, isChangeMetadata, isArchived, groupOf, displayLabel,
  changeOf, prettyChangeName, compareArchiveDateDesc, crumbFor, refLines, snippet,
} from '../app/model.js';

test('normPath: strips any leading path up to the first openspec segment', () => {
  assert.equal(normPath('repo/openspec/specs/acct/spec.md'), 'specs/acct/spec.md');
  assert.equal(normPath('openspec/config.yaml'), 'config.yaml');
  // Picked folder is openspec itself — no leading openspec segment to strip.
  assert.equal(normPath('changes/alpha/proposal.md'), 'changes/alpha/proposal.md');
});

test('artifactOf: classifies known artifact names else Doc', () => {
  assert.equal(artifactOf('changes/a/proposal.md'), 'Proposal');
  assert.equal(artifactOf('changes/a/design.md'), 'Design');
  assert.equal(artifactOf('changes/a/tasks.md'), 'Tasks');
  assert.equal(artifactOf('config.yaml'), 'Config');
  assert.equal(artifactOf('changes/a/.openspec.yaml'), 'Metadata');
  assert.equal(artifactOf('specs/acct/spec.md'), 'Spec');
  assert.equal(artifactOf('changes/a/change.md'), 'Doc');
});

test('artifactPhrase: names the artifact kind for prose', () => {
  assert.equal(artifactPhrase('changes/a/proposal.md'), 'the whole proposal');
  assert.equal(artifactPhrase('specs/acct/spec.md'), 'the whole specification');
  assert.equal(artifactPhrase('changes/a/design.md'), 'the whole design');
  assert.equal(artifactPhrase('changes/a/tasks.md'), 'the whole tasks');
  assert.equal(artifactPhrase('changes/a/.openspec.yaml'), 'the whole metadata');
  assert.equal(artifactPhrase('config.yaml'), 'the whole configuration');
  assert.equal(artifactPhrase('changes/a/change.md'), 'the whole document');
});

test('isRelevant: md/yaml/json yes; dotfiles (except .openspec.yaml) no', () => {
  assert.ok(isRelevant('specs/a/spec.md'));
  assert.ok(isRelevant('config.yaml'));
  assert.ok(isRelevant('changes/a/.openspec.yaml'));
  assert.ok(!isRelevant('changes/a/.gitkeep'));
  assert.ok(!isRelevant('changes/a/notes.txt'));
});

test('isChangeMetadata: true only for a change\'s metadata file', () => {
  assert.ok(isChangeMetadata('changes/alpha/.openspec.yaml'));
  assert.ok(isChangeMetadata('changes/archive/2026-01-01-alpha/.openspec.yaml'));
  // Other artifacts and the root config are not metadata.
  assert.ok(!isChangeMetadata('changes/alpha/proposal.md'));
  assert.ok(!isChangeMetadata('changes/alpha/specs/acct/spec.md'));
  assert.ok(!isChangeMetadata('changes/alpha/design.md'));
  assert.ok(!isChangeMetadata('changes/alpha/tasks.md'));
  assert.ok(!isChangeMetadata('config.yaml'));
});

test('isArchived: true only under changes/archive/', () => {
  assert.ok(isArchived('changes/archive/2026-01-01-my-change/proposal.md'));
  assert.ok(!isArchived('changes/my-change/proposal.md'));
});

test('groupOf: maps to Config/Archive/Changes/Specs or null', () => {
  assert.equal(groupOf('config.yaml'), 'Config');
  assert.equal(groupOf('changes/a/proposal.md'), 'Changes');
  assert.equal(groupOf('changes/archive/d/proposal.md'), 'Archive');
  assert.equal(groupOf('specs/a/spec.md'), 'Specs');
  assert.equal(groupOf('docs/readme.md'), null);
});

test('displayLabel: truncates by group kind', () => {
  assert.equal(displayLabel('changes/a/proposal.md', 'Changes'), 'a/proposal.md');
  assert.equal(displayLabel('changes/archive/d/proposal.md', 'Archive'), 'd/proposal.md');
  assert.equal(displayLabel('specs/acct/spec.md', 'Specs'), 'acct');
  assert.equal(displayLabel('config.yaml', 'Config'), 'config.yaml');
});

test('changeOf: returns change key for active and archived, null otherwise', () => {
  assert.equal(changeOf('changes/alpha/proposal.md'), 'changes/alpha');
  assert.equal(changeOf('changes/archive/2026-01-01-d/proposal.md'), 'changes/archive/2026-01-01-d');
  assert.equal(changeOf('specs/a/spec.md'), null);
});

test('prettyChangeName: title-cases and extracts an optional date', () => {
  assert.deepEqual(prettyChangeName('my-change'), { label: 'My Change', date: '' });
  assert.deepEqual(prettyChangeName('2026-01-01-my-change'), { label: 'My Change', date: '2026-01-01' });
});

test('compareArchiveDateDesc: dates descend, undated last, input untouched', () => {
  const rows = [
    { key: 'a', date: '2026-08-19' },
    { key: 'b', date: '' },
    { key: 'c', date: '2026-08-21' },
    { key: 'd', date: '2026-08-20' },
    { key: 'e', date: '' },
  ];
  const sorted = rows.slice().sort(compareArchiveDateDesc);
  assert.deepEqual(sorted.map(r => r.key), ['c', 'd', 'a', 'b', 'e']);
  // Comparator (and sorting a copy) must not mutate the source array.
  assert.deepEqual(rows.map(r => r.key), ['a', 'b', 'c', 'd', 'e']);
});

test('compareArchiveDateDesc: same-date ties keep name-ascending order', () => {
  const rows = [
    { key: 'changes/archive/2026-08-20-alpha', date: '2026-08-20' },
    { key: 'changes/archive/2026-08-20-beta', date: '2026-08-20' },
  ];
  rows.sort(compareArchiveDateDesc);
  assert.deepEqual(rows.map(r => r.key), [
    'changes/archive/2026-08-20-alpha',
    'changes/archive/2026-08-20-beta',
  ]);
});

test('crumbFor: renders path segments and drops a trailing spec.md', () => {
  assert.ok(String(crumbFor('specs/acct/spec.md')).includes('acct'));
  assert.ok(!String(crumbFor('specs/acct/spec.md')).includes('spec.md'));
  assert.ok(String(crumbFor('changes/a/proposal.md')).includes('proposal.md'));
});

test('refLines: lists 1-based line numbers containing text', () => {
  assert.deepEqual(refLines('alpha\nbeta\nalpha2\n', 'alpha'), [1, 3]);
  assert.deepEqual(refLines('x\ny\n', ''), []);
});

test('snippet: collapses whitespace and truncates past 90 chars', () => {
  assert.equal(snippet('a  b\t c'), 'a b c');
  const long = 'word '.repeat(30);
  assert.ok(snippet(long).endsWith('…'));
  assert.ok(snippet(long).length <= 91);
});
