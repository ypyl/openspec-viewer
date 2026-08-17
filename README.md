# OpenSpec Local Viewer

A single-file, offline viewer for [OpenSpec](https://openspec.dev/) artifacts.
One `index.html` with no build step and no dependencies beyond CDN scripts.

**Try it live:** https://ypyl.github.io/openspec-viewer/

## What it does

- Browse changes, archived changes, specs, and config from your `openspec/` folder.
- **Live monitoring** (Chrome/Edge): picks a folder via the File System Access API
  and polls every 30 seconds, so added, modified, and deleted artifacts appear
  without reloading. Open files hot-refresh in place.
- Open a change to see its artifacts as tabs: Proposal, Spec(s), Design, Tasks, Metadata.
- Dark and light themes, collapsible sidebar sections, and a filter box.
- Everything reads locally — nothing is uploaded.

## Install

Download [`index.html`](index.html) and save it anywhere. It is a single self-contained
file — no build step, no npm install, no server.

## Usage

1. Open `index.html` in Chrome or Edge (works from `file://`, no server needed).
2. Click **Select Folder to Monitor** and choose your repository root or the `openspec/` folder.
3. The picker reopens at your last-chosen folder (persisted via IndexedDB).

In browsers without the File System Access API, the folder picker falls back to a
one-shot read without live updates.

## Development

The entire app lives in `index.html` (HTML + CSS + JS). Edit it and refresh.