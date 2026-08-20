// app/search.js — Fuse-backed content search over the artifact corpus.
//
// The corpus is assembled by store.buildSearchCorpus (from the IndexedDB
// snapshots, with a live-read fallback for upload-mode folders) in memory;
// the Fuse index is rebuilt whenever searchVersion bumps (store.js bumps it
// when the folder's contents change). Pure text math lives in model.js and is
// covered by the node suite in tools/test-search.mjs.
//
// Browser-bound: imports Fuse via imports.js (window.Fuse).

import { Fuse } from '../imports.js';
import { searchVersion } from './state.js';
import { buildSearchCorpus } from './store.js';
import { groupOf } from './model.js';

const DEFAULT_OPTIONS = {
  keys: [{ name: 'title', weight: 3 }, { name: 'text', weight: 1 }],
  includeMatches: true,
  includeScore: true,
  minMatchCharLength: 3,
  ignoreLocation: true,
  // Strict: a term must be a near-exact match (still typo-tolerant, but a
  // loose substring alignment no longer counts).
  threshold: 0.25,
};

let cache = null;   // { version, fuse }

async function getFuse() {
  if (cache && cache.version === searchVersion.value) return cache.fuse;
  const docs = await buildSearchCorpus();
  cache = { version: searchVersion.value, fuse: new Fuse(docs, DEFAULT_OPTIONS) };
  return cache.fuse;
}

// Case-insensitive exact occurrences of a term in the raw text. Used for
// highlighting because Fuse's fuzzy match ranges are per-character and render
// as noise (scattered 1-2 char marks). Exact spans keep snippets clean.
function exactRanges(text, term) {
  const hay = text.toLowerCase();
  const needle = term.toLowerCase();
  const ranges = [];
  let from = 0, i;
  while ((i = hay.indexOf(needle, from)) !== -1) {
    ranges.push([i, i + needle.length]);
    from = i + needle.length;
  }
  return ranges;
}

// Search every artifact's content. The query is split into terms and an
// artifact is returned only when EVERY term matches (AND), so a query like
// "new item" does not surface artifacts that happen to contain just one of the
// words. Results are ordered by aggregated relevance (best first); each is
// { rel, group, score, ranges, text } where `ranges` are [start, end) offsets
// into the artifact's raw text (from exact term occurrences, or the fuzzy
// range when a term has no exact match). The caller renders snippets via
// model.snippetSegments and groups by `group`. Results are capped per group.
export async function searchContent(query, { perGroup = 24 } = {}) {
  const terms = (query || '').trim().split(/\s+/).filter(t => t.length >= 3);
  if (!terms.length) return [];
  const fuse = await getFuse();

  // Accumulate every term's matches per artifact, then intersect.
  const acc = new Map();   // rel -> { rel, group, score, ranges, text, _terms }
  for (const term of terms) {
    const hits = fuse.search(term);
    const seen = new Set();
    for (const h of hits) {
      const rel = h.item.rel;
      if (seen.has(rel)) continue;
      seen.add(rel);
      const textMatch = (h.matches || []).find(m => m.key === 'text');
      // Prefer exact occurrences; only fall back to Fuse's fuzzy range when a
      // term has no exact match in the artifact (e.g. a typo), dropping
      // 1-char fragments that would highlight as noise.
      let ranges = exactRanges(h.item.text, term);
      if (!ranges.length && textMatch) {
        ranges = textMatch.indices.map(([s, e]) => [s, e + 1]).filter(([s, e]) => e - s >= 3);
      }
      if (!acc.has(rel)) acc.set(rel, { rel, group: groupOf(rel) || 'Changes', score: 0, ranges: [], text: h.item.text, _terms: 0 });
      const rec = acc.get(rel);
      rec._terms += 1;
      rec.ranges.push(...ranges);
      rec.score += h.score ?? 1;   // lower is better; sum across terms
    }
  }

  // AND: keep only artifacts that matched every term.
  const results = [...acc.values()]
    .filter(r => r._terms === terms.length)
    .sort((a, b) => a.score - b.score || a.rel.localeCompare(b.rel));

  const counts = {};
  const out = [];
  for (const r of results) {
    if ((counts[r.group] || 0) >= perGroup) continue;
    counts[r.group] = (counts[r.group] || 0) + 1;
    out.push(r);
  }
  return out;
}
