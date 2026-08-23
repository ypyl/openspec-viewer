// app/review-guide.js — vendored review guidance, distilled from the official
// OpenSpec reviewing docs. Shown to the user while reviewing a change: a per-
// tab guidance strip in the pane (GUIDE) and the two-minute checklist at the
// top of the review panel (CHECKLIST).
//
// Source: https://github.com/Fission-AI/OpenSpec/blob/main/docs/reviewing-changes.md
// Fetched: 2026-08-23 — re-distill this file when that doc changes.

// Per-artifact-kind review guidance. `flags` are the doc's red flags for that
// kind; the proposal's last flag is the official "stop and fix first" hint.
// `design` carries only the doc's own line (the technical approach — only for
// bigger changes) with no invented criteria, so its flags list stays empty.
export const GUIDE = {
  proposal: {
    question: 'Does this match what I actually asked for — and is anything sneaking in?',
    flags: [
      'It solves a slightly different problem than the one you asked for.',
      'The scope has grown — you asked for one thing and it now touches others.',
      "It's vague. \"Improve the settings page\" is not a scope; \"add a dark-mode toggle that respects the OS preference\" is.",
      'If this is wrong, stop here and fix the proposal before reading further.',
    ],
  },
  spec: {
    question: 'Would I be happy if the system did exactly — and only — this?',
    flags: [
      "A vague requirement (\"The system SHALL be fast\") can't be built or tested.",
      'A requirement with no scenario, or a scenario that does not test what it sits under.',
      "What's missing: the AI writes down what you said — your job is to notice what you forgot to say.",
    ],
  },
  design: {
    question: 'The technical approach (only for bigger changes).',
    flags: [],
  },
  tasks: {
    question: 'Is the plan of work sane — does it match the requirements you already accepted?',
    flags: [
      'A task with no matching requirement (where did that come from?).',
      "One giant \"implement the feature\" task that hides all the real decisions.",
      'A task that touches something outside the scope you just approved.',
    ],
  },
};

// Short display name per kind, used by the strip's collapsed line.
export const KIND_LABEL = {
  proposal: 'Proposal',
  spec: 'Spec delta',
  design: 'Design',
  tasks: 'Tasks',
};

// The official two-minute checklist, in the doc's order, checked by the
// human reviewer before sending the fix prompt.
export const CHECKLIST_TITLE = 'Two-minute checklist review';
export const CHECKLIST = [
  "The proposal's intent matches what I asked for.",
  'Nothing extra has crept into the scope.',
  'Every requirement is specific enough to test.',
  'Every requirement has a scenario that actually exercises it.',
  'The case I care about most is covered.',
  'Tasks map to requirements; nothing is mysterious or out of scope.',
  "I'd be comfortable if the AI built exactly this and nothing more.",
];