/** The short overview is the same visible source for rendering and search. */
/** @param {{ overview_theses?: string[] }} report */
export function reportOverview(report) {
	return (report.overview_theses ?? []).slice(0, 3);
}
