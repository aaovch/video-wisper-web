# Video Wisper — Web

Статичный сайт-галерея на **SvelteKit** (`adapter-static`) с отчётами, которые
генерирует [Video Wisper](https://github.com/aaovch): смысловые блоки, тезисы и
расшифровки видео. Готов к публикации на **GitHub Pages**.

## Что внутри

- **Главная** (`/`) — галерея всех отчётов.
- **Страница отчёта** (`/reports/<slug>/`) — главные тезисы, содержание,
  смысловые блоки с тайм-кодами и (опционально) полная расшифровка.
- Данные лежат в `src/lib/data/reports/*.json` — по одному файлу на видео.

## Локальный запуск

```bash
npm install
npm run dev
```

Откроется на http://localhost:5173.

Сборка статики в папку `build/`:

```bash
npm run build
npm run preview   # локальный предпросмотр собранной статики
```

## Добавить новый отчёт

1. Положите JSON в `src/lib/data/reports/<slug>.json` по форме `src/lib/types.ts`
   (`slug`, `title`, `subtitle`, `overview_theses`, `chapters[]`, …).
   Удобно взять за основу `data/semantic_chapters/*.json` из основного проекта.
2. Импортируйте его в `src/lib/data/index.ts` и добавьте в массив `all`
   (порядок в массиве = порядок карточек на главной).

## Публикация на GitHub Pages

Сайт публикуется автоматически через GitHub Actions
(`.github/workflows/deploy.yml`) при пуше в ветку `main`.

Один раз после первого пуша:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Дождитесь, пока завершится workflow «Deploy to GitHub Pages».

Сайт будет доступен по адресу `https://aaovch.github.io/<repo>/`.
Базовый путь `/<repo>` workflow подставляет автоматически (`BASE_PATH`), поэтому
все ссылки используют `import { base } from '$app/paths'` и работают как локально,
так и на Pages.

> Если опубликуете в репозиторий `aaovch.github.io` (user-site), сайт будет в
> корне домена — тогда `BASE_PATH` не нужен (можно убрать `env` в workflow).

## Стек

- SvelteKit 2 + Svelte 5 (рунический режим)
- `@sveltejs/adapter-static` — полностью статическая сборка (prerender)
- Vite 6, TypeScript
