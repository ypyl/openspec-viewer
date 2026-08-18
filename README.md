# OpenSpec Local Viewer

A single-file, offline viewer for [OpenSpec](https://openspec.dev/) artifacts.
One `index.html` with no build step and no dependencies beyond CDN scripts.

**Try it live:** https://ypyl.github.io/openspec-viewer/

## What it does

- Browse changes, archived changes, specs, and config from your `openspec/` folder.
- **Live monitoring** (Chrome/Edge): picks a folder via the File System Access API
  and polls every 10 seconds, so added, modified, and deleted artifacts appear
  without reloading. Open files hot-refresh in place.
- **Change diffs**: every scan snapshots artifact content, so when the monitor
  detects a change you get a line-by-line diff (added/removed lines) above the
  artifact, plus +/− counts in the sidebar. Snapshots live in IndexedDB, so the
  diff still appears after a page reload.
- Open a change to see its artifacts as tabs: Proposal, Spec(s), Design, Tasks, Metadata.
- **Review mode**: select text in an artifact and add a comment; highlights are kept
  per file, then collected with the artifact content into a single LLM fix prompt
  (copy it or open it in a new tab).
- Dark and light themes, collapsible sidebar sections, and a filter box.
- Everything reads locally — nothing is uploaded.

## Install

Download [`index.html`](index.html) and save it anywhere. It is a single self-contained
file — no build step, no npm install, no server.

On the hosted version you can also **install it as an app**: open
https://ypyl.github.io/openspec-viewer/ and use the browser's install option
(install icon in the address bar). The page then loads fully offline.

## Usage

1. Open `index.html` in Chrome or Edge (works from `file://`, no server needed).
2. Click **Select Folder to Monitor** and choose your repository root or the `openspec/` folder.
3. The picker reopens at your last-chosen folder (persisted via IndexedDB).

In browsers without the File System Access API, the folder picker falls back to a
one-shot read without live updates.

## Development

The entire app lives in `index.html` (HTML + CSS + JS). Edit it and refresh.