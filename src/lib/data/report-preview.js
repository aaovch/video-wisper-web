import { isPrivateReport } from './report-access.js';
import { reportOverview } from '../report-overview.js';

// Highlight different parts of the five courses instead of their opening remarks.
const featuredChapters = new Map([
	['fehtovalnye-shkoly-v-germanii-aslamov', [3, 11, 14]],
	['dzhentlmenskiy-nabor-priemov-aslamov', [5, 13, 17]],
	['borba-i-polumech-aslamov', [9, 13, 24]],
	['fehtuy-kak-shveytsarets-vittenviller', [3, 15, 38]],
	['fehtuy-kak-tsiryulnik-folts', [4, 6, 13]]
]);

/** Explicit allowlist: source URLs, video IDs, tags and full material stay private. */
/** @param {{slug:string,title:string,subtitle?:string,duration?:number,chapterCount?:number,chapters?:{title:string}[],overview_theses?:string[],materials?:{exercises?:{items:unknown[]}[]},seminar_exercises?:{items:unknown[]}[],preview?:{topics:string[],exerciseCount:number}}} report
 * @param {readonly import('./collections').Collection[]} collections */
export function publicReportPreview(report, collections) {
	if (isPrivateReport(report.slug, collections)) {
		return { slug: report.slug, title: 'Закрытая запись', subtitle: '', duration: 0, chapterCount: 0, overview_theses: [] };
	}
	return {
		slug: report.slug,
		title: report.title,
		subtitle: report.subtitle ?? '',
		duration: report.duration ?? 0,
		chapterCount: report.chapterCount ?? report.chapters?.length ?? 0,
		overview_theses: reportOverview(report),
		preview: {
			topics: [...new Set(report.preview?.topics ??
				(featuredChapters.get(report.slug) ?? [0, 1, 2])
					.map(index => report.chapters?.[index]?.title).filter(/** @returns {title is string} */ title => Boolean(title))
			)].slice(0, 3),
			exerciseCount: report.preview?.exerciseCount ?? (report.materials?.exercises ?? report.seminar_exercises ?? [])
				.reduce((count, section) => count + section.items.length, 0)
		}
	};
}

/** A separate ID lets multiple keys replace the public synopsis with full search. */
/** @param {{slug:string,title:string,subtitle?:string,overview_theses?:string[]}} report */
export function publicPreviewDocument(report) {
	const text = [report.subtitle, ...report.overview_theses ?? []].filter(Boolean).join(' ');
	return {
		id: `preview:${report.slug}`, kind: 'report', reportSlug: report.slug,
		text, field_title: report.title, field_body: text, field_tags: ''
	};
}
