# Design QA

## Source

- Selected direction: option 3, an editorial HEMA archive with warm paper, serif display type, thin rules, burgundy accents, and Phosphor icons.
- Reference image: `C:\Users\aaovc\.codex\generated_images\019f6171-244a-74f2-beda-9ebac9be4143\exec-857a9188-55de-43b8-ac26-c1dfef197287.png`.
- Side-by-side comparison: `.codex/design-qa/comparison-desktop.jpg`.

## Captures

| Surface | Viewport | Route | Evidence |
| --- | --- | --- | --- |
| Collection | 1440 x 1024 | `/collections/lager-vladivostok/` | `.codex/design-qa/collection-desktop.jpg` |
| Collection | 390 x 844 | `/collections/lager-vladivostok/` | `.codex/design-qa/collection-mobile.jpg` |
| Report, YouTube | 1440 x 1024 | `/reports/gruppa-a-1-vvodnaya/?from=lager-vladivostok` | `.codex/design-qa/report-desktop.jpg` |
| Report, local video | 390 x 844 | `/reports/2026-06-20-18-39-45/` | `.codex/design-qa/report-mobile.jpg` |

## Visual checks

- Collection cards form a two-column editorial grid on desktop and a single column at 390 px; no horizontal overflow was detected.
- Collection sections are flat and numbered. The `kendzyu` analysis renders as `Заявляли / В боях` rows and stacks on mobile.
- Collection and report lock states use Phosphor icons, preserve password input, and have no emoji pictograms.
- Report header, one-paragraph summary, tags, duration, views, and the first three overview theses share the same editorial hierarchy as the collection.
- Desktop report keeps the player/search/table-of-contents rail on the left and semantic blocks on the right. Mobile starts with the player and remains one column.
- Chapters use a thin burgundy active marker; the content rail follows the active chapter without shifting the editorial grid.
- Additional materials render after chapters in the prescribed order. A report containing focus tabs exposed all three tab controls and one active tab panel.
- Reference and implementation were reviewed in the same comparison image. Color, typographic hierarchy, rule weight, spacing rhythm, and flat card treatment are consistent with option 3.

## Functional checks

- `?from=` is accepted only for a real collection membership; an invalid value falls back to `Лагерь Владивосток`.
- `?q=дистанция&t=2037#ch-9` preserved the query, timestamp, and hash; query highlighting and active-chapter synchronization were present.
- `Все тезисы` expanded from 3 to 5 theses.
- Report search accepted input and requests its index only on focus/input; there is no eager `onMount` preload.
- YouTube iframe and native local video were both rendered in browser QA.
- Normal collection, sectioned `lager-vladivostok`, analysis `kendzyu`, password collection `hema-theory`, and password report `/reports/metodichka/` were inspected.
- Browser console contained no errors. The YouTube route emitted one non-blocking hydration warning because the iframe `origin` differs between SSR and the local browser origin.

## Build checks

- `npm run check`: passed, 0 errors and 0 warnings.
- `npm run build`: passed. Existing Rollup large-chunk warnings remain informational.
- Existing report and collection JSON schemas, routes, canonical paths, and the standalone collection-constructor rule were not changed.

## Iteration: player before overview

- User reference: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-40800943-cd5b-4711-8908-09efdc181e27.png`.
- Comparison: `.codex/design-qa/report-main-placement-comparison.jpg`.
- Desktop capture: `.codex/design-qa/report-main-beside-video-desktop.jpg` at 1440 x 1024.
- Mobile capture: `.codex/design-qa/report-main-beside-video-mobile.jpg` at 390 x 844.
- Desktop: player and `Главное` begin on the same row; semantic blocks follow the overview in the reading column.
- Mobile: the player appears before the collapsed report navigation and `Главное`; no horizontal overflow was detected.

## Iteration: scoped semantic search

- User reference: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-1ddfba54-25aa-4fd5-94ea-e5d0f5f9634d.png`.
- Side-by-side comparison: `.codex/design-qa/scoped-search-comparison.jpg`.
- Collection capture: `.codex/design-qa/scoped-search-collection-desktop.jpg` at 1440 x 1024.
- Report capture: `.codex/design-qa/scoped-search-report-desktop.jpg` at 1440 x 1024.
- Collection search defaults to its 11 reports. Widening to the archive changed the result set and introduced reports outside the collection.
- Report search defaults to one report. Widening to `Лагерь Владивосток` changed the result set to multiple reports from that collection; `Весь архив` remains the third level.
- Header search mirrors the same default scope and exposes `В отчёте / В коллекции / Везде` on report pages.
- At 390 x 844 the three report scopes stack to one column at 266.8 px inside a 318.8 px search surface; no horizontal overflow was detected.
- Search-index loading remains lazy and begins on focus or input. Browser console contained no errors; the known local YouTube iframe hydration warning remains non-blocking.

## Iteration: minimal scoped search

- User reference: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-573aeac5-be92-4509-840d-0b8b1c0733f5.png`.
- Comparison: `.codex/design-qa/minimal-search-comparison.jpg`.
- Collection capture: `.codex/design-qa/minimal-search-collection-desktop.jpg` at 1440 x 1024.
- Report capture: `.codex/design-qa/minimal-search-report-desktop.jpg` at 1440 x 1024.
- Removed the duplicate masthead search, search heading, eyebrow, background panel, scope controls, counters, and shortcut hint.
- Idle state is one 58 px field on desktop and one 54 px field at 390 x 844.
- Scope is automatic and fixed by route: the collection query returned only reports from `lager-vladivostok`; the report query returned only `Группа А — 1. Вводная тренировка`.
- At 390 x 844 the search surface is 318.8 px wide with no horizontal overflow.

## Iteration: remove collection chrome

- User reference: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-652e51f7-6c03-4711-83d9-7714c192c102.png`.
- Comparison: `.codex/design-qa/clean-collection-comparison.jpg`.
- Desktop capture: `.codex/design-qa/clean-collection-desktop.jpg` at 1440 x 1024.
- Removed the collection facet pills, material/block/duration/view statistics row, and its separator.
- Removed the global masthead from collection and report routes; breadcrumbs remain the primary return path to the archive.
- Removed the long tag list from the report header while preserving duration, chapter count, and views.
- At 390 x 844 the collection starts at the top of the page, the search field is visible at 270.8 px, and no horizontal overflow was detected.

## Iteration: remove redundant collection heading

- User reference: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-b39f1a9e-4100-426c-a84f-2e4d3b7029bb.png`.
- Comparison: `.codex/design-qa/flat-collection-comparison.jpg`.
- Desktop capture: `.codex/design-qa/flat-collection-desktop.jpg` at 1440 x 1024.
- Ordinary collections now start the report-card grid immediately after search; `Материалы`, `Отчёты коллекции`, and the decorative section number were removed.
- Real section names remain visible in sectioned collections. `lager-vladivostok` still exposes `Группа А`, `Группа Б`, `Тренерский курс`, and `Семинары`.
- At 390 x 844 the 13 `almaty-2026` cards remain in one column with no horizontal overflow.

## Iteration: quieter report separators

- User reference: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-ab4c2099-5f46-42d7-b79a-6d6970867ab5.png`.
- Before/after comparison: `.codex/design-qa/report-lines-comparison.jpg` at 1440 x 1024.
- Removed the full-width rule below the report header, the rules above `Главное` and section headings, and the redundant rule above the first chapter.
- Removed the rule above the report contents rail; spacing and typographic hierarchy now separate these zones.
- Kept the search-field outline and separators between later semantic blocks because they communicate interactive and repeated structure.
- At 390 x 844 the report has no horizontal overflow and the removed rules remain absent.

## Iteration: deduplicate semantic-block numbering

- User reference: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-d9a078d3-5a1e-4d89-a886-eb6628fbeb5a.png`.
- Desktop capture: `.codex/design-qa/report-number-deduplicated.jpg` at 1440 x 1024.
- Removed the decorative `01` from the `Смысловые блоки` section heading and aligned that heading with the content column.
- Preserved chapter numbering, including `01` on the first semantic block.
- At 390 x 844 the section number remains absent, chapter numbering remains visible, and there is no horizontal overflow.

## Iteration: reveal all semantic matches

- User reference: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-326ba66f-c2fa-4d56-9f0c-cf115710a00f.png`.
- Desktop capture: `.codex/design-qa/archive-search-show-all.jpg` at 1440 x 1024.
- The initial search state still shows the three closest matches, followed by an explicit full-width `Показать все 30 совпадений` action.
- Activating the action changes the count from `3 из 30` to `30 из 30`, renders all 30 results, and changes the control to `Свернуть до 3 совпадений` with `aria-expanded="true"`.
- A new query or filter change collapses the list back to the three closest matches.
- At 390 x 844 the expanded list contains all 30 results, the action is 319 px wide, and there is no horizontal overflow.

## Iteration: additional materials beside the overview

- User reference: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-6ce40487-3e9f-46d8-b3f7-e19cc94eba31.png`.
- Comparison: `.codex/design-qa/additional-materials-comparison.jpg`.
- Desktop capture: `.codex/design-qa/additional-materials-near-overview.jpg` at 1440 x 1024.
- On standard reports, `Главное` and the collapsed additional-material list now share the row immediately below report search; semantic blocks follow both.
- Decorative section numbers were removed from both top headings so the columns read as one balanced introductory zone.
- Opening any accordion switches the introductory zone to one full-width column; the exercise body retains its two-column layout at desktop width.
- Reports with always-visible thematic focus tabs use the full-width stacked variant instead of squeezing rich content into the side column.
- At 390 x 844 the reading order is `Главное` → `Дополнительные материалы` → `Смысловые блоки`, with no horizontal overflow.

## Iteration: deduplicate the archive label

- User reference: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-6375a6a1-3d31-489c-a3bc-ce68f35694ea.png`.
- Desktop capture: `.codex/design-qa/archive-label-deduplicated.jpg` at 1440 x 1024.
- Removed the repeated `Личный архив HEMA` eyebrow above the main search heading.
- The descriptor remains once in the global masthead next to `aaovch`; the search heading moves up naturally without an empty label gap.
- At both 1440 x 1024 and 390 x 844 the phrase occurs once and there is no horizontal overflow.

## Iteration: stack additional materials below the overview

- Source visual truth: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-672d0df5-2f4f-4163-840a-0c794b9298b9.png`, with the user's instruction to replace the pictured side-by-side layout with a stacked reading order.
- Desktop implementation: `.codex/design-qa/report-materials-stacked-desktop.png` at 1440 x 1024, collapsed state.
- Desktop expanded-state implementation: `.codex/design-qa/report-materials-stacked-open-desktop.png` at 1440 x 1024.
- Mobile implementation: `.codex/design-qa/report-materials-stacked-mobile-collapsed.png` at 390 x 844; expanded infographic evidence is in `.codex/design-qa/report-materials-stacked-mobile-closed.png`.
- Full-view comparison: the source and desktop implementation were inspected together. The intentional change is visible: `Дополнительные материалы` now follows `Главное` in the same content column instead of occupying a parallel column.
- Focused comparison: no separate crop was needed because the overview heading, all material rows, the removed intermediate label, and the start of `Смысловые блоки` are legible in the desktop capture.
- Earlier P1: opening `Все тезисы` or a material accordion changed a two-column introductory layout and made the reading order feel unstable. Fix: the introductory region now always uses one column; both expanded states push subsequent content down in normal document flow.
- Earlier P2: `Инфографика и памятки` repeated the meaning of the `Инфографика` accordion immediately below it. Fix: the intermediate group heading was removed; `Инфографика` and `Памятка по упражнениям`, when present, remain independent accordion rows.
- Post-fix evidence: the desktop and mobile captures show the stacked order, and the browser DOM exposes only `Инфографика`, without the removed `Инфографика и памятки` label.
- Typography: the established serif hierarchy, sizes, weights, and line heights are unchanged.
- Spacing and layout rhythm: the new 34-48 px vertical gap separates `Главное` and `Дополнительные материалы`; accordion expansion no longer triggers a grid-column change.
- Colors and visual tokens: existing paper, ink, burgundy accent, and separator tokens are unchanged.
- Image quality and assets: the supplied infographic remains the original responsive raster asset; no placeholder or replacement asset was introduced.
- Copy and content: all material names remain unchanged except for removal of the redundant group label.
- Responsive and interaction checks: `Все тезисы` and `Инфографика` open and close correctly; the 390 px viewport has no horizontal overflow.
- Console: no errors; the existing local YouTube iframe hydration warning remains non-blocking and unrelated to this change.
- Remaining findings: no actionable P0, P1, or P2 issues. The visible keyboard-focus outline after clicking an accordion is intentional accessibility behavior.

## Iteration: adaptive search filters

- Source visual truth: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-f508bfd9-d1f5-4218-9766-5aa54465c54a.png` and the follow-up direction to move filters out of the permanently visible search row.
- Archive desktop results: `.codex/design-qa/archive-filters-results-desktop.png` at 1440 x 1024.
- Collection desktop results: `.codex/design-qa/collection-filters-desktop.png` at 1440 x 1024.
- Report desktop side sheet: `.codex/design-qa/report-zone-filters-desktop.png` at 1440 x 1024.
- Archive mobile bottom sheet: `.codex/design-qa/archive-filters-mobile-sheet.png` at 390 x 844.
- Initial state now contains only the search field and a compact `Фильтры` action; the old author/place/weapon controls no longer occupy the hero permanently.
- Archive results use a sticky right filter rail with author, place, weapon, and collection groups. Active values appear as removable chips under the query and immediately narrow both semantic results and the collection catalog.
- Collection results expose only collection-local choices: section filters for `lager-vladivostok` reduced `атака` from 120 fetched hits to 33 hits in `Группа Б`.
- Report results expose semantic zones. The tested report offered `Главы`, `Тезисы`, and `Расшифровка`; selecting `Тезисы` reduced the result set from 120 fetched hits to 37 thesis hits.
- Desktop report filters open as a 390 px right side sheet because the report search lives in the narrower reading column; the implementation avoids squeezing result cards into an unreadable third column.
- At 390 x 844 filters open as a scrollable bottom sheet, results retain the compact trigger, and the document width remains 375 px with no horizontal overflow.
- Search-index loading remains lazy and starts only after focus/input. The regenerated index contains report summaries, chapter explanations, individual theses, transcript segments, and additional-material entries.
- Typography, spacing, colors, controls, and iconography reuse the existing paper/ink/burgundy editorial system. No new image assets or placeholders were introduced.
- Interaction QA covered opening/closing both sheet variants, applying and removing checkbox filters, active chips, report-zone filtering, section filtering, result counts, and the existing show-all action.
- Console: no errors. The known local YouTube iframe hydration warning remains non-blocking and unrelated to filters.
- Remaining findings: no actionable P0, P1, or P2 issues.

## Iteration: filters on demand, full-width results

- Source visual truth: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-ab779103-ce14-4071-aafb-3727f8310f98.png`, where the persistent right filter rail competed with the results and consumed roughly a quarter of the page.
- Desktop collapsed state: `.codex/design-qa/search-filters-collapsed-desktop-new.jpg` at 1139 x 855 with query `укол`.
- Desktop drawer state: `.codex/design-qa/search-filters-drawer-desktop.jpg` at 1139 x 855.
- Mobile collapsed state: `.codex/design-qa/search-filters-collapsed-mobile.jpg` at 390 x 844; the count remains on one line and the page has no horizontal overflow.
- The source and implementation were inspected together. Results now use the complete reading width, while the count and one compact `Фильтры` action sit in the result header.
- Before a query, the compact filter action remains below the input for discoverability. After results appear, it moves into the result header and does not duplicate elsewhere.
- On desktop the action opens a 390 px right drawer over the page. On mobile it opens a scrollable bottom sheet. Closing either restores the full-width result list.
- Active values appear as removable chips below the query and the trigger shows the active-filter count. Applying `Пётр Васильев` changed the archive result count from `3 из 30` to `3 из 28` and narrowed the collection catalog.
- The same on-demand pattern was verified on the archive, collection, and report search. The report drawer exposes only semantic zones (`Главы`, `Тезисы`, `Расшифровка`).
- Typography, colors, search field, Phosphor iconography, and editorial result cards remain unchanged; no new assets were introduced.
- Console: no errors. The existing local YouTube iframe hydration warning remains non-blocking and unrelated to this change.
- Remaining findings: no actionable P0, P1, or P2 issues.

## Iteration: reveal all scoped-search matches

- Source visual truth: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-36f168d0-c818-431b-8341-408054f558c5.png`, showing five collection matches with no way to continue.
- Collection collapsed state: `.codex/design-qa/scoped-search-show-all-collection-collapsed.jpg` at 1139 x 855 with query `укол`.
- Collection action state: `.codex/design-qa/scoped-search-show-all-collection-button.jpg` at 1139 x 855.
- Report action state: `.codex/design-qa/scoped-search-show-all-report-button.jpg` at 1139 x 855 with query `атака`.
- Mobile action state: `.codex/design-qa/scoped-search-show-all-mobile.jpg` at 390 x 844.
- Full-view comparison: the supplied collection screen and the revised collection were inspected together. The first five result cards, editorial typography, actions, separators, and search hierarchy remain unchanged.
- Focused comparison: the post-result region was inspected separately because the missing continuation affordance was below the source viewport. A full-width `Показать все N совпадений` action now clearly separates search results from the collection content below.
- Activating the action in the collection changed `5 из 107` to `107 из 107` and rendered 107 result rows; the same report interaction changed `5 из 53` to `53 из 53`.
- The expanded action changes to `Свернуть до 5 совпадений`, rotates its caret, and restores the compact state. A new query or filter change also collapses the list automatically.
- Result totals now count unique visible semantic matches instead of raw duplicate index records. Russian singular/few/many labels were verified with `101 совпадение`, `53 совпадения`, and `107 совпадений`.
- Fonts and typography: unchanged; the new action reuses the existing archive search action size and editorial type treatment.
- Spacing and layout rhythm: the action uses the full result width and a 14 px top gap, preserving a clear transition into the collection or report content.
- Colors and visual tokens: existing paper, line, burgundy accent, radius, hover, and focus tokens are reused.
- Image quality and assets: no image assets were introduced or changed; the caret uses the existing Phosphor icon set.
- Copy and content: result cards are unchanged; only the continuation and collapse labels were added.
- Responsive and interaction checks: collection and report expand/collapse paths pass; the 390 x 844 viewport has no horizontal overflow.
- Console: no errors. The known local YouTube iframe hydration warning remains non-blocking and unrelated to this change.
- Remaining findings: no actionable P0, P1, or P2 issues.

## Iteration: explain non-literal search matches

- Source visual truth: `C:\Users\aaovc\AppData\Local\Temp\codex-clipboard-20845386-d1bf-4edb-a3da-4ed57a1eee77.png`, where `Глоссарий: Атака на подготовку` appeared without the query term or any explanation.
- Desktop implementation: `.codex/design-qa/search-match-explanation-desktop.jpg` at 1139 x 855.
- Mobile implementation: `.codex/design-qa/search-match-explanation-mobile.jpg` at 390 x 844.
- Full-view comparison: the source result card and revised collection results were inspected together. Existing breadcrumb, title, snippet, actions, rules, and editorial hierarchy remain unchanged.
- Focused comparison: the ambiguous-card region was inspected separately. Non-literal matches now receive one compact line between title and snippet: `Связано по смыслу` followed by the actual related indexed terms.
- The source example was verified with query `укол`; its explanation is `атака · удар`. Literal matches that already visibly highlight the query do not receive the extra line.
- Semantic expansion was tightened at the same time: multi-word concept phrases no longer split into generic standalone terms such as `оружие` or `подготовка`, reducing weak matches while preserving useful relations such as `укол` → `атака` / `удар`.
- The explanation is derived from the terms that actually matched the document, not generated placeholder copy. It is available on the archive, collection, and report result components.
- Fonts and typography: the established serif card typography remains unchanged; the explanation uses the existing small uppercase UI label style.
- Spacing and layout rhythm: the optional explanation adds a 7 px gap only to ambiguous cards and does not change literal-result density.
- Colors and visual tokens: existing burgundy accent and faint-ink tokens are reused; contrast remains secondary to the title and snippet.
- Image quality and assets: no image assets or custom drawings were introduced.
- Copy and content: explanations use concise Russian copy and up to three matched concepts; source snippets and titles remain intact.
- Responsive and interaction checks: desktop, collection, archive, report, and 390 x 844 mobile states pass with no horizontal overflow.
- Console: no errors. The known local YouTube iframe hydration warning remains non-blocking and unrelated to this change.
- Remaining findings: no actionable P0, P1, or P2 issues.

## Iteration: end-to-end search usability audit

- Fresh evidence folder: `.codex/audit/search-flow/`.
- Desktop archive: `18-home-final.jpg` at 1440 x 1024. The initial result set is compact, highlights Russian word forms, exposes filters on demand, and keeps `Open block` separate from `Watch from`.
- Desktop collection: `11-collection-fixed.jpg` at 1440 x 1024. Query `инициатива` highlights `инициативу` and other inflected forms directly; weak semantic-only expansion was bounded and the visible total fell from 104 raw-style matches to 23 useful unique results.
- Desktop report: `12-report-search-fixed.jpg`, `13-report-open-fixed.jpg`, and `14-report-seek-fixed.jpg`. Duplicate chapter hits are collapsed, the complete 26-result list expands without duplicate keys or repeated headings, and labels distinguish `Открыть блок` from `Смотреть с ...`.
- Navigation behavior: opening a result now updates `?q=` and `#ch-N` without starting the player; choosing a timestamp adds `?t=`, seeks one second inside the target chapter to avoid boundary drift, starts playback, and activates the correct chapter.
- Collection context: `from=lager-vladivostok` survives both result actions and the report breadcrumb returns to the originating collection.
- Accessibility: Escape closes both desktop drawers and mobile bottom sheets, focus returns to the filter trigger, and mobile result actions measure 44 px high.
- Mobile collection: `15-mobile-collection-fixed.jpg` at 390 x 844. Mobile report: `16-mobile-report-fixed.jpg` and `17-mobile-seek-fixed.jpg`. Both have `scrollWidth === clientWidth`; the player becomes sticky only after timestamp playback begins and leaves the target chapter unobscured.
- Search-index quality: report-level context no longer leaks into every chapter/thesis/transcript document, semantic-only additions are capped, and morphology-aware snippets/highlighting explain Russian inflections without an unnecessary semantic label.
- Console: the duplicate-key error found while expanding report results was fixed. The only remaining browser message is the pre-existing non-blocking YouTube iframe hydration warning.
- Automated verification: `npm run check`, `npm run verify-search-index -- vid-20260708-200742`, and `npm run build` pass.
- Remaining findings: no actionable P0, P1, or P2 search-flow issues.

final result: passed
## Iteration: compact three-column collection grid

- Source visual truth: `C:\Users\aaovc\.codex\generated_images\019f68b3-0b7e-78b2-b962-99ef8a15fda2\exec-3c51be49-bf69-44cc-ba28-9b14a63e3c22.png`.
- Implementation screenshot: `C:\Users\aaovc\.codex\visualizations\2026\07\16\019f68b3-0b7e-78b2-b962-99ef8a15fda2\implemented-collection-1117x815-final.png`.
- Combined comparison: `C:\Users\aaovc\.codex\visualizations\2026\07\16\019f68b3-0b7e-78b2-b962-99ef8a15fda2\design-qa-comparison-final.png`.
- Viewport and state: 1117 x 815 desktop, empty collection search, real report content and posters.
- Full-view comparison: the compact one-line hero, 50 px search field, three equal columns, 16:9 posters, restrained metadata, two-line title/summary treatment, burgundy links, and thin row rules match the selected direction.
- Focused comparison: no extra crop was required because the combined 2274 x 871 image keeps the hero, search, card typography, imagery, links, and separators legible.
- Content constraint: the mock shows six illustrative reports, while the real collection has four; the implementation keeps the real four and lets the second row fill naturally as content grows.
- Fonts and typography: the existing Fraunces, Newsreader, and JetBrains Mono stack remains intact; desktop titles and summaries are clamped for consistent rhythm.
- Spacing and layout: three columns above 1080 px, two columns at 1000 x 800, and one column at 760 x 800, with no horizontal overflow.
- Colors and assets: existing paper, ink, line, burgundy tokens, Phosphor icons, and real poster URLs are retained; no substitute assets were introduced.
- Copy and interactions: production Russian copy remains unchanged; scoped search returned five results for `силовая` after lazy index loading.
- Console and validation: no browser errors; `npm run check` passed with 0 errors and 0 warnings; `npm run build` passed.
- Comparison history: the first pass kept a desktop breadcrumb and taller hero; the final pass hides that breadcrumb on desktop, restores it on mobile, reduces hero/search spacing, and clamps long real titles.
- Remaining findings: no actionable P0, P1, or P2 differences; real copy creates minor P3 height variation compared with illustrative titles.

final result: passed
