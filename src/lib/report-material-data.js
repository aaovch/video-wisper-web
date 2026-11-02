/**
 * Single normalization contract for the site, index and validators.
 * @param {import('./types').Report} report
 * @returns {Required<import('./types').ReportMaterials>}
 */
export function getReportMaterials(report) {
	const visuals = [];
	if (report.infographic) visuals.push({ kind: /** @type {const} */ ('infographic'), ...report.infographic });
	if (report.exercise_memo) visuals.push({ kind: /** @type {const} */ ('exercise-memo'), ...report.exercise_memo });
	return {
		notes: report.materials?.notes ?? report.seminar_notes ?? [],
		exercises: report.materials?.exercises ?? report.seminar_exercises ?? [],
		glossary: report.materials?.glossary ?? report.glossary ?? [],
		visuals: report.materials?.visuals ?? visuals
	};
}

/** @param {number} start */
export function exerciseAnchor(start) {
	return `exercise-${Math.round(start * 100)}`;
}
