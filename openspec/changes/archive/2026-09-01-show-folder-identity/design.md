## Context

The app shows only a project name per folder (rail avatar + sidebar name row), so same-named folders are indistinguishable. Browsers never expose absolute filesystem paths, so identity must come from what the app can already see: the pick relation (repo root vs. openspec root, computed today in `resolveOpenSpecRoot` but discarded) and, for repo-root picks, the git remote/branch readable from the picked repo root. See proposal.md - Why. Folder entries are plain objects persisted as whole rows in the `folders` IndexedDB store (`saveFolderEntry` puts `{ ...entry, pickedHandle, rootHandle }`), so new display fields ride along with no schema change. Rehydrate (`autoReopen`) rebuilds entries explicitly and must carry the new fields.

## Goals / Non-Goals

**Goals:**
- Every open folder shows an identity line (pick relation; git origin + branch when known) under its name in the sidebar, and in the rail avatar tooltip.
- Identity survives reloads via the persisted folder row.
- Capture happens once at open time — zero cost afterwards, no re-reads on reload.

**Non-Goals:**
- No absolute-path display (impossible; platform hides it).
- No worktree gitdir following (the `.git` file points at the main repo's path — out of scope).
- No content fingerprint identity, no prompt/LLM-context identity (display only).
- No UI for re-capturing identity, no per-folder opt-out.

## Decisions

**D1: Identity fields live on the folder entry, persisted whole.**
`relation` (`'repo' | 'root'`) and `git: { origin, branch } | null` become fields of the entry object. `saveFolderEntry` already persists the whole row, so they survive reloads with zero schema/migration work. Old rows simply lack them → identity line hidden, behavior unchanged. Alternative considered: a lookup table keyed by folder id — rejected, redundant with the row the app already persists.

**D2: Relation is derived from the existing root resolution, not re-detected.**
`resolveOpenSpecRoot(dir)` already returns either the `openspec/` child (repo-root pick) or `dir` itself (openspec-root pick). Relation = `root === dir ? 'root' : 'repo'`. For uploads, derive from `webkitRelativePath`: a segment after the first one equal to `openspec` → repo relation, else root relation. No new directory reads.

**D3: Git identity is captured once, best-effort, at register time — never blocking.**
For repo-root picks only, read `.git/config` (origin URL) and `.git/HEAD` (branch) from the picked handle with `getFileHandle`/`getFile`/`text()`, parsed with a small regex (section `[remote "origin"]` → `url = ...`; `ref: refs/heads/<name>`). Whole thing wrapped in one try/catch: any failure (worktree `.git` file, gitless folder, revoked permission, odd layout) → `git: null`, folder opens anyway and shows relation only. Alternative considered: re-reading on every reload for freshness — rejected, needs permission re-prompts and buys nothing for a static identity. Alternative considered: worktree gitdir following for absolute main-repo paths — rejected as scope creep.

**D4: Display — one sub-line in the name row, tooltip text in the rail.**
Sidebar `folder-row` renders the existing name plus a muted sub-line (relation phrase; git origin + branch appended when present). Rail avatar `title` becomes `name[suffix] — identity`. Both patch-in-place through the existing computed/effects; the sub-line only appears when identity exists, so rows for legacy folders keep today's height. Phrases:
- repo pick, has git: `openspec/ · github.com/acme/myrepo · main`
- repo pick, no git: `openspec/`
- root pick: `openspec root`
Uploads use the same phrases from the derived relation, never a git part.

## Risks / Trade-offs

- [Git read fails (worktrees, gitless dirs, permission quirks)] → fail closed to `git: null`; relation still shows; folder open never blocked.
- [Two same-named folders from one repo's worktrees stay indistinguishable (same remote, own branch shown)] → branch differentiates; absolute worktree path is unreachable by platform, accepted limit.
- [Name row grows taller with the sub-line] → small muted sub-line (11px), legacy rows unaffected; layout is flex-based, no fixed heights.
- [Persisted rows predate the fields] → no migration; those folders show name-only until re-picked. Acceptable degrade, spec allows "every folder that has it".

## Migration Plan

No IDB schema change, no serving change, no new dependency. Deploy is the normal push; rollback is reverting the commit (SW cache bump included in the same commit per AGENTS.md).