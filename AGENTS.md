# video-wisper-web — агентам

Статичный SvelteKit-сайт (Svelte 5, adapter-static) с отчётами Video Wisper: смысловые блоки, тезисы, расшифровки, клиентский поиск (MiniSearch). Деплой — GitHub Pages через `.github/workflows/deploy.yml`.

Пайплайн, который порождает данные для сайта, живёт в родительской папке `video_wisper` — см. её `AGENTS.md` и `.cursor/rules/`.

## Команды

```powershell
npm run check              # svelte-check; данные/индекс не изменяет
npm test                   # vitest
npm run build              # индекс + prod-сборка в build/
npm run build-search-index # MiniSearch-индекс + report-meta.json
npm run verify-search-index -- <slug>  # проверка нового отчёта в индексе
npm run validate-site -- <slug>        # отчёт, sidecar, source, коллекции/sections
npm run qa-report -- <slug>            # полный gate: index + data + check + tests + build
npm run qa-report                      # тот же gate для всех отчётов (режим CI)
npm run inject-transcripts # legacy: sidecar-транскрипты из output/ (не нужен после build-report CLI)
```

## Данные

- `src/lib/data/reports/<slug>.json` — «худой» отчёт: без `segments`/`transcript`, с `has_transcript` и `source_stem`.
- `src/lib/data/transcripts/<slug>.json` — sidecar с сегментами; читают только билд-скрипты.
- `static/search/` и `static/transcripts/` — генерируются, в git не добавлять.
- Коллекции: `src/lib/data/collections.ts`; реестр отчётов: `src/lib/data/index.ts`.

## Локальный просмотр

`npm run preview` на Windows может не пробросить флаги в Vite (ищет `dist`). Запускать напрямую:

```powershell
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174 --outDir build
```

Проверку кириллицы в HTML делать с явным UTF-8 — `Invoke-WebRequest.Content` может ломать матчинг:

```powershell
$response = Invoke-WebRequest -Uri 'http://localhost:4174/reports/<slug>/' -UseBasicParsing
$ms = New-Object System.IO.MemoryStream
$response.RawContentStream.CopyTo($ms)
$html = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
```

## Git и push

- Git root — **эта папка** (`video-wisper-web`), не родительский `video_wisper`.
- Commit/push — **только по явной просьбе пользователя**.
- Основная ветка — `main`. Если пользователь говорит «в мастер» — пушить в `main` и сказать об этом.
- Перед коммитом: `git status --short --branch`, `git diff --stat`. Стадить только намеренные файлы; не цеплять чужие отчёты, preview-логи, line-ending-шум, сгенерированные артефакты.
- Пути с квадратными скобками — literal pathspec:

```powershell
git add -- ':(literal)src/routes/reports/[slug]/+page.svelte'
```

- Перед push: `npm run qa-report -- <slug>` успешен, staged diff содержит только ожидаемое.
- `.codex/`, `.claude/` — рабочие артефакты агентов, в git не добавлять.
