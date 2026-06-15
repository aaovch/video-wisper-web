export interface Chapter {
	/** Тайм-код начала блока в секундах */
	start: number;
	/** Якорная фраза, с которой реально начинается блок (опционально) */
	anchor?: string;
	title: string;
	summary: string;
	theses: string[];
}

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
	/** Полная расшифровка (опционально) */
	transcript?: string;
}
