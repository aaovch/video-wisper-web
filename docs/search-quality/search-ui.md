# Search UI contract

- Query, selected filters and expanded results live in the URL. Query edits replace the current history entry; opening a result creates a new entry. Returning restores the search state.
- Report search and chapter highlights use the same query. Clearing it removes highlights. The toolbar returns focus to the search input.
- Previous/next navigation counts unique destinations in the current report, not individual words or duplicate chapter/transcript hits. Overview and additional materials precede chapters; chapters follow document order, independent of representative passage timestamps. Controls are disabled at the boundaries and while loading.
- The selected chapter has a persistent label and border in addition to its word highlights. Navigating to it moves keyboard focus without triggering a video. Explicit playback links remain separate.
- Result breadcrumbs contain the report title once. A separate note identifies title-only, tag, prefix, corrected or semantic matches from actual search metadata.
- Snippets are unchanged source slices selected for query-word coverage. Word boundaries are preserved; ellipses indicate omitted text. Snippet selection does not change result ranking.
- Filter sheets move focus inside, isolate the background, trap Tab/Shift+Tab and restore focus on Escape/close.

## Regression checks

Unit coverage: `search-url-state.test.ts`, `search-fragments.test.ts`, `search-snippet.test.ts`. Full gate: `node scripts/qa-report.mjs --all`.

Browser cases:

1. Archive → «маска» → Enter → report → Back: original query and two results return.
2. Collection «Алматы 2026» → «дистанция» → filter «Сабля» → expand results → open a later item → Back: query, filter and expansion remain.
3. Report `sablya-8/?q=дистанция#ch-6`: query is populated, chapter visible below toolbar; next selects chapter 7, previous returns chapter 6; browser Back restores the selected chapter.
4. Change query to «подготовка», clear it, then enter a no-result query: no stale highlights or stale enabled navigation.
5. Filter keyboard loop and focus return. Desktop/mobile widths, dark/light themes and short viewport height.

Responsive browser testing is not a physical-device test. A real-phone check additionally covers the software keyboard, touch targets, viewport resizing and player/toolbar interaction.
