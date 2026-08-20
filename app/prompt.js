// app/prompt.js — assemble the self-describing LLM prompt from the collected
// highlights + comments, and clipboard helpers.

import { storePrefix } from './state.js';
import { snippet } from './render.js';
import { allHighlights } from './annotations.js';

export function buildPrompt() {
  const items = allHighlights().filter(h => h.comment);
  if (!items.length) return null;
  const lines = [
    'Here are my review comments on my OpenSpec artifacts. Act on each comment based on what it asks:',
    '',
    '- If the comment asks me to fix, adjust, or edit the referenced text, apply that change.',
    '- If the comment is itself a question about the referenced text (e.g. "what does this mean?"), do NOT change the spec. Just answer / explain it in place.',
    '',
    'Where an edit is needed, also update any other artifacts in the same proposal that the change affects, so the whole proposal stays consistent.',
    '',
  ];
  items.forEach((h, i) => {
    lines.push(`${i + 1}. File: ${storePrefix}${h.rel}`);
    lines.push(`   Referenced text: "${snippet(h.text)}"`);
    lines.push(`   Comment: ${h.comment}`);
  });
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
