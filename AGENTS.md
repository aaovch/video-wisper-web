# video-wisper-web — агентам

Статичный SvelteKit-сайт (Svelte 5, adapter-static) с отчётами Video Wisper: смысловые блоки, тезисы, расшифровки, клиентский поиск (MiniSearch). Деплой — GitHub Pages через `.github/workflows/deploy.yml`.

Пайплайн, который порождает данные для сайта, живёт в родительской папке `video_wisper` — см. её `AGENTS.md` и `.cursor/rules/`.

## Команды

```powershell
npm run check              # svelte-check; данные/индекс не изменяет
npm test                   # vitest
npm run test:search-lab     # сравнительный поиск: 114 запросов, 330 сценариев; артефакты в .codex/search-lab
npm run test:search-fencing # парное сравнение обогащения: 32 фехтовальных запроса + опечатки, реальные коллекции и UI-расширение
npm run test:search-ranking # четыре варианта: текущий, полные главы, покрытие индексированных полей, сочетание
npm run test:search-lab -- --neural # дополнительно локальные E5 + RRF + reranker (Python ONNX; см. docs/search-quality/deep-study.md)
npm run build              # индекс + prod-сборка в build/
npm run build-search-index # MiniSearch-индекс + report-meta.json
npm run verify-search-index -- <slug>  # проверка нового отчёта в индексе
npm run validate-site -- <slug>        # отчёт, sidecar, source, коллекции/sections
npm run qa-report -- <slug>            # полный gate: index + data + check + tests + build
npm run qa-report                      # тот же gate для всех отчётов (режим CI)
npm run inject-transcripts # legacy: sidecar-транскрипты из output/ (не нужен после build-report CLI)
```

## Данные

### Обогащение поискового индекса при подготовке записи

- Проверенные связи источников: `docs/search-quality/source-links.md`. Сборка проверяет хеши обеих глав; при изменении источника пересмотреть связь. Ссылки сохраняют область поиска и оцениваются отдельно от Hit@5.

- Текущий workflow карточек, JSON-аудит и восстановление: `docs/search-quality/workflow.md`. Для полной подготовки записи: `node scripts/qa-report.mjs <slug> --require-search-cards` (прямой Node сохраняет флаг на Windows). Обычный QA проверяет все имеющиеся карточки; отсутствие допускается только без `search_cards_required`. Все фехтовальные коллекции требуют полного покрытия через постоянный тест.
- Диагностика составных вопросов: `docs/search-quality/multi-source.md`. `VITE_SEARCH_CANDIDATE_LIMIT` — только офлайн-эксперимент, по умолчанию не задавать.

- Контракт и результаты пилота: `docs/search-quality/enrichment.md`.
- Полное фехтовальное покрытие и различие ситуационных/буквальных карточек: `docs/search-quality/all-fencing.md`. `cards-cli.mjs prepare-context` создаёт буквальный кандидат, не заменяя рабочие карточки; импорт и QA обязательны.
- Предметные карточки включены по умолчанию; историческая ревизия 113 глав: `docs/search-quality/expanded-pilot.md`. Первый эксперимент сохранён в `docs/search-quality/situation-pilot.md`. Для отката индекса: `SEARCH_CARDS=0`. Не использовать раскрытые контрольные вопросы как новый holdout и не выдавать частичное покрытие за обработку всех глав.
- `prepare` прикладывает терминологические подсказки из снимка канонического HEMA-словаря; обновление и ограничения: `docs/search-quality/hema-dictionary.md`. Подсказки не заменяют цитаты главы; не выводить именованный пресет из совпавших свойств.
- Поиск альтернативных названий использует только проверенные пресеты из `search-techniques.ts`; не включать весь словарь автоматически (например, «окно» неоднозначно). Контракт и парный тест: `docs/search-quality/technique-aliases.md`.
- Числовые токены запроса нельзя fuzzy-исправлять или игнорировать; проверка слабых совпадений и отклонённые пороги: `docs/search-quality/no-answer.md`.
- После финальной правки глав: `node scripts/search-enrichment/cli.mjs prepare <slug> --dry-run`, затем без `--dry-run`. JSON-пакет источника сохраняется в `.codex/search-enrichment/`.
- Агент читает пакет и составляет контекст и 1–5 вопросов к каждой главе, строго с цитатами-основаниями. Не читать поисковые тесты для составления вопросов. Генерация выполняется агентом при подготовке отчёта, не браузером и не сборщиком.
- Кандидат импортировать через `node scripts/search-enrichment/cli.mjs import <slug> <candidate.json> --dry-run`, затем тот же вызов без `--dry-run`; проверять exit code и JSON `ok`.
- Версионируемый sidecar: `src/lib/data/search-enrichment/<slug>.json`. Изменение исходной главы делает его устаревшим; обновить sidecar перед сборкой. Для сравнения без дополнений: `$env:SEARCH_ENRICHMENT='0'`; после эксперимента удалить эту переменную.
- Отсутствующий sidecar допустим; публикация не зависит от доступности LLM. Новые дополнения проверять на независимых от генерации вопросах и отрицательных примерах. Наличие точной цитаты не доказывает смысловую корректность автоматически.

- `src/lib/data/reports/<slug>.json` — «худой» отчёт: без `segments`/`transcript`, с `has_transcript` и `source_stem`.
- `src/lib/data/transcripts/<slug>.json` — sidecar с сегментами; читают только билд-скрипты.
- `static/search/` и `static/transcripts/` — генерируются, в git не добавлять.
- Коллекции: `src/lib/data/collections.ts`; реестр отчётов: `src/lib/data/index.ts`.

## Локальный просмотр

Полная поисковая подготовка закрепляется полем отчёта `search_cards_required: true` через
Python `build-report --require-search-cards`. Обычный аудит и сборка индекса требуют все главы.
Подготовка и восстановление: `docs/search-quality/workflow.md`; проверка полного покрытия выбранных
коллекций включена в `npm test`. `SEARCH_CARDS=0` предназначен только для сравнительного эксперимента.

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
