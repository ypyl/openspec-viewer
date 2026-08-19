// app/prompt.js — assemble the LLM fix prompt from collected highlights, and
// clipboard helpers.

import { storePrefix, changeMeta } from './state.js';
import { changeOf, snippet } from './render.js';
import { allHighlights } from './annotations.js';

export function buildPrompt() {
  const items = allHighlights();
  if (!items.some(h => h.comment)) return null;
  const lines = [
    'Please fix only the OpenSpec artifacts below, based on the provided review comments. Keep it simple and focused.',
    '',
    'Each artifact belongs to a change proposal. Read the whole proposal (all of its artifacts: proposal, specs, design, tasks) from the repository — they are not included here — and make each fix so all artifacts in the proposal stay consistent with each other.',
    '',
    'Rules:',
    '- Only change content referenced by a comment; preserve everything else exactly as-is.',
    '- Align each fix with the proposal the artifact belongs to (its proposal path is listed under the file).',
    '- If consistency requires it, fix the whole proposal so all its artifacts do not contradict each other.',
    '',
    '# Review comments',
  ];
  let prevRel = null, n = 0;
  for (const h of items) {
    if (h.rel !== prevRel) {
      prevRel = h.rel;
      n = 0;
      lines.push('', `## ${storePrefix}${h.rel}`);
      const key = changeOf(h.rel);
      const meta = key && changeMeta.value.get(key);
      const prop = meta && meta.proposalRel;
      if (prop) {
        lines.push(`Proposal: ${storePrefix}${prop}`);
        if (meta.files && meta.files.length) {
          lines.push('Artifacts in this proposal:');
          for (const f of meta.files) lines.push(`- ${storePrefix}${f.rel}`);
        }
      }
    }
    n++;
    lines.push(`${n}. ${h.comment || '(no comment — review this section for issues)'}`);
    lines.push(`   Referenced text: "${snippet(h.text)}"`);
  }
  return lines.join('\n');
}

export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove();
  return ok;
}
