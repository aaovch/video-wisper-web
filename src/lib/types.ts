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
	/** Фрагменты распознанной речи внутри блока (для поиска и перемотки) */
	segments?: TranscriptSegment[];
}

export type EmbedProvider = 'youtube' | 'rutube' | 'vimeo';

/** Видео встраивается одним из двух способов: */
export type VideoSource =
	| {
			/** Встраиваемый плеер (iframe). */
			provider: EmbedProvider;
			/** ID видео у провайдера (YouTube — 11-символьный id, Rutube/Vimeo — id ролика) */
			id: string;
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
	/** Пояснение к разметке */
	note: string;
	/** Длительность видео в секундах */
	duration: number;
	/** Метки для карточки */
	tags: string[];
	/** Главные тезисы всего ролика */
	overview_theses: string[];
	/** Смысловые блоки */
	chapters: Chapter[];
	/** Видео для встраивания (опционально) */
	video?: VideoSource;
	/** Полная расшифровка (опционально) */
	transcript?: string;
}

/** Лёгкая карточка отчёта — без глав и транскрипта (report-meta.json). */
export interface ReportSummary {
	slug: string;
	title: string;
	subtitle: string;
	duration: number;
	overview_theses: string[];
	chapterCount: number;
	video?: VideoSource;
}
