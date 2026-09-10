# Design QA — chapter transcript reader

## Source

- Reference: `C:\Users\aaovc\.codex\generated_images\01a08639-b767-7b93-8fde-9fcb6da7d953\exec-de222f1f-f27b-4d0d-af85-005353283ed7.png`
- Implementation: `C:\Users\aaovc\Desktop\pet projects\video_wisper\video-wisper-web\.codex\design-qa\transcript-reader-open.png`
- Closed state: `C:\Users\aaovc\Desktop\pet projects\video_wisper\video-wisper-web\.codex\design-qa\chapter-card-closed.png`
- Side-by-side comparison: `C:\Users\aaovc\Desktop\pet projects\video_wisper\video-wisper-web\.codex\design-qa\comparison.png`

## Capture

- URL: `http://127.0.0.1:4180/reports/tsena-adaptatsii-tehnicheskogo-priema/`
- Browser: Codex in-app browser
- Viewport: 504 × 742 CSS pixels
- Screenshot: 504 × 742 pixels at 1× density
- State: dark theme; chapter 07 in the closed report and in the full-height reading mode

## Comparison

The implementation preserves the reference hierarchy and interaction: the transcript action sits directly below the chapter title, the reader replaces report chrome with a calm single-column surface, and persistent back/progress/next controls frame the text. Type scale, warm dark palette, terracotta actions, timecode treatment, rules, and readable measure closely match the source while using the existing site tokens and fonts.

## Findings and iteration history

1. P1 — The first implementation used an inline accordion, which did not create the focused reading experience selected in the reference. Replaced it with a dedicated modal reader.
2. P2 — The first reader pass exposed the report behind the modal to assistive technology. Switched the overlay to the native modal dialog, which traps focus and makes background content inert.
3. P2 — Long single ASR segments could render as one dense paragraph. Reduced the reading threshold and added sentence-boundary coverage so long speech is divided without dropping or rewriting words.
4. Verified the closed CTA, lazy transcript loading, next-block transition, Escape return, background inertness, and focus restoration in the real local report.

## Local scenario pass — 2026-09-10

- All 12 chapter CTAs open the matching heading and progress value. Every chapter contains 2–5 cleaned paragraphs; no text was empty or horizontally clipped.
- The continuous 01 → 12 flow keeps the reader open, resets scroll between chapters, changes the final action to “Вернуться к конспекту”, and restores focus to the chapter 12 CTA.
- Escape and “К конспекту” both close the native dialog and restore focus to the originating chapter CTA.
- A unique transcript-only query (“когда чуваки влетели”) returns chapter 07, opens its reader, and highlights the matching words in the transcript.
- A reader timecode closes the reader, activates chapter 07, scrolls to it, and starts the player handoff at the chapter time.
- Lazy-loading states were exercised against a stopped local server: loading appears, the failure is announced as an alert, and “Попробовать ещё раз” succeeds after the server returns.
- Responsive passes at 390 × 844, 768 × 900, and 1280 × 900 show no horizontal overflow or clipped controls. Touch targets for back and next are 44 px high.
- Light and dark themes use the expected paper/ink tokens and preserve identical reader geometry.
- The browser console contains no warnings or errors after the interaction pass.
- Corpus coverage: all 160 reports currently have transcripts and all 160 chapter sidecars have non-empty chapter segments, so production fixtures do not expose the no-transcript or empty-chapter variants. Their guarded render paths remain covered structurally rather than by a live fixture.
- Automated gate: `svelte-check` reports 0 errors and 0 warnings; Vitest reports 104 passed and 10 skipped; the production static build succeeds.

## Resolved finding

1. P2 — Keyboard focus previously visited `body` and then the `dialog` after the final reader action. The reader now explicitly wraps Tab from the final action to “К конспекту” and Shift+Tab back to the final action. The same loop was verified with the dynamically rendered “Попробовать ещё раз” control in the error state.

## Post-fix verification

- `svelte-check`: 0 errors, 0 warnings.
- Focus order in the ready state: “К конспекту” → timecode → “Следующий блок” → “К конспекту”; reverse wrapping also passes.
- Focus order in the error state includes “Попробовать ещё раз” and still wraps in both directions.
- The focused transcript unit suite passes: 4/4.
- The full report gate currently stops on the unrelated fencing-corpus coverage assertion (118 current HEMA slugs versus the test floor of 128) after concurrent removals appeared elsewhere in the shared worktree. The transcript-reader checks themselves pass.

Final result: passed
