export interface TranscriptSegment {
	/** Тайм-код фразы в секундах */
	start: number;
	text: string;
}

export interface Chapter {
	/** Тайм-код начала блока в секундах */
	start: number;
	/** Якорная фраза, с которой реально начинается блок (опционально) */
	anchor?: string;
	title: string;
	summary: string;
	theses: string[];
}

/** Глава sidecar-файла транскрипта (src/lib/data/transcripts/<slug>.json). */
export interface TranscriptChapter {
	start: number;
	/** Фрагменты распознанной речи внутри блока (для поискового индекса) */
	segments: TranscriptSegment[];
}

/**
 * Sidecar с полной расшифровкой. Хранится отдельно от отчёта, чтобы страница
 * не тянула сегменты; клиент лениво грузит полный текст из
 * static/transcripts/<slug>.json, а главы — из соседнего <slug>.chapters.json.
 */
export interface ReportTranscript {
	transcript: string;
	chapters: TranscriptChapter[];
}

export type EmbedProvider = 'youtube' | 'rutube' | 'vimeo' | 'vk';

export interface GlossaryItem {
	term: string;
	definition: string;
}

export interface SeminarNoteSection {
	title: string;
	items: string[];
}

export interface SeminarExercise {
	start: number;
	text: string;
}

export interface SeminarExerciseSection {
	title: string;
	items: SeminarExercise[];
}

export interface FocusTabItem {
	start: number;
	title: string;
	summary: string;
	theses: string[];
}

export interface FocusTab {
	id: string;
	title: string;
	intro?: string[];
	items: FocusTabItem[];
}

export interface ReportInfographic {
	src: string;
	alt: string;
}

export interface ReportMaterialVisual extends ReportInfographic {
	kind: 'infographic' | 'exercise-memo' | 'other';
	label?: string;
}

/** Единый контракт дополнительных материалов независимо от формата исходного видео. */
export interface ReportMaterials {
	notes?: SeminarNoteSection[];
	exercises?: SeminarExerciseSection[];
	glossary?: GlossaryItem[];
	visuals?: ReportMaterialVisual[];
}

/** Видео встраивается одним из двух способов: */
export type VideoSource =
	| {
			/** Встраиваемый плеер (iframe). */
			provider: EmbedProvider;
			/** ID видео у провайдера (YouTube — 11-символьный id, VK — owner_id, Rutube/Vimeo — id ролика) */
			id: string;
			/** Локальная обложка карточки относительно base, если провайдер не даёт стабильное превью. */
			poster?: string;
			/** Токен `p` для приватной Rutube-ссылки. */
			privateToken?: string;
	  }
	| {
			/** Публичный файл на Яндекс.Диске: прямая ссылка резолвится в браузере. */
			provider: 'yadisk';
			/** Публичная ссылка вида https://disk.yandex.ru/i/XXXX */
			publicKey: string;
	  }
	| {
			/** Локальный файл в самом сайте (static/), отдаётся с того же домена. */
			provider: 'file';
			/** Путь относительно base, напр. "media/metodichka.mp4" */
			src: string;
			/** Постер-кадр относительно base, напр. "media/metodichka.jpg" */
			poster?: string;
	  };

export interface Report {
	/** URL-идентификатор отчёта */
	slug: string;
	/** Заголовок для карточки/страницы */
	title: string;
	/** Короткий подзаголовок */
	subtitle: string;
	/** Имя исходного файла из пайплайна */
	source_name: string;
	/** Каноническая папка output/<source_stem>, достаточная для воспроизводимой пересборки. */
	source_stem?: string;
	/** Якоря глав проверены относительно выбранного transcript run. */
	transcript_anchors_verified?: boolean;
	/** Ссылка на исходное видео, если отчёт сделан из внешнего источника */
	source_url?: string;
	/** Пояснение к разметке */
	note: string;
	/** Длительность видео в секундах */
	duration: number;
	/** Метки для карточки */
	tags: string[];
	/** Главные тезисы всего ролика */
	overview_theses: string[];
	/** Связный расширенный пересказ, когда одних тезисов недостаточно. */
	long_summary?: string;
	/** Смысловые блоки */
	chapters: Chapter[];
	/** Видео для встраивания (опционально) */
	video?: VideoSource;
	/** Дополнительные учебные материалы в общем формате. */
	materials?: ReportMaterials;
	/** @deprecated Совместимость со старыми отчётами; новые данные пишутся в materials. */
	glossary?: GlossaryItem[];
	/** @deprecated Совместимость со старыми отчётами; новые данные пишутся в materials.notes. */
	seminar_notes?: SeminarNoteSection[];
	/** @deprecated Совместимость со старыми отчётами; новые данные пишутся в materials.exercises. */
	seminar_exercises?: SeminarExerciseSection[];
	/** Дополнительные тематические срезы по отчёту */
	focus_tabs?: FocusTab[];
	/** @deprecated Совместимость со старыми отчётами; новые данные пишутся в materials.visuals. */
	infographic?: ReportInfographic;
	/** @deprecated Совместимость со старыми отчётами; новые данные пишутся в materials.visuals. */
	exercise_memo?: ReportInfographic;
	/** Есть ли полная расшифровка (сам текст лежит в static/transcripts/<slug>.json) */
	has_transcript?: boolean;
	/** Required by the report workflow; ordinary QA rejects incomplete cards. */
	search_cards_required?: boolean;
}

/** Лёгкая карточка отчёта — без глав и транскрипта (report-meta.json). */
export interface ReportSummary {
	slug: string;
	title: string;
	subtitle: string;
	tags?: string[];
	duration: number;
	/** Обрезаны до 2 при генерации — карточки больше не показывают */
	overview_theses: string[];
	chapterCount: number;
	video?: VideoSource;
}
