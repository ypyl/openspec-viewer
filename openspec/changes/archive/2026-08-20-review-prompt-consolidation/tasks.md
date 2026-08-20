## 1. Prompt rewrite

- [x] 1.1 Rewrite `buildPrompt()` in `app/prompt.js`: drop the "read the whole proposal from the repository" preamble and the strict "only change the referenced text" rule; keep the per-file `##` heading + numbered `File` / `Referenced text` / `Comment` listing; add the self-describing instruction (fix → apply, question → explain without changes, edits keep the proposal consistent).
- [x] 1.2 Confim `buildPrompt()` still returns `null` when no highlight has a comment, and still reads fine when it does.

## 2. Single copy action, remove the modal

- [x] 2.1 In `components/osv-review/osv-review.js`, replace the two action buttons with a single **Copy prompt** primary button; on click await `buildPrompt()`, then `copyText()`, then a toast; keep the "disabled until a comment exists" gate; remove the Send-to-LLM button and its `osv:show-prompt` dispatch. Update copy/toast strings.
- [x] 2.2 Delete the modal surface: remove `<osv-prompt-modal>` and `osv-prompt-modal.js` and its CSS from the repo, drop its import in `index.js`, and remove its `<osv-prompt-modal>` element and any `osv:show-prompt`/Escape-key listener wiring from `index.html`. Remove the `osv-prompt-modal` CSS import from `index.css` if referenced.

## 3. Version bump

- [x] 3.1 Bump to **v2.12.0** in the same commit across all three markers: the `index.html` first-line comment, the header badge (`<span class="version">`), and `sw.js` `CACHE_VERSION`.

## 4. Verification

- [x] 4.1 Serve the app (`python -m http.server 8743`) and verify via playwright-cli: open an artifact, add a highlight with a fixing comment, confirm the single Copy button copies the prompt with the fixing instruction to the clipboard; add a separate question comment and confirm the copied prompt carries the "do not change the spec / explain" instruction; confirm no modal ever appears.
- [x] 4.2 Run the existing e2e/unit tests (`tools/test-*.mjs`, and `diff-test.js`/`migration-test.js` via playwright-cli) to confirm the prompt changes regressed nothing else.
