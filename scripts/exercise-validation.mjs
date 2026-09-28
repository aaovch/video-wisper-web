/** Validate the reviewed, timestamped exercise list used by the report card and search. */
export function validateExercises(report, sidecar) {
	const errors = [];
	const warnings = [];
	const sections = report.materials?.exercises ?? report.seminar_exercises;
	if (sections === undefined) return { errors, warnings };
	if (!Array.isArray(sections)) return { errors: ['exercises must be an array'], warnings };
	const anchors = new Set();
	const segmentStarts = sidecar?.chapters?.flatMap((chapter) => chapter.segments?.map((segment) => segment.start) ?? []) ?? [];
	for (const [sectionIndex, section] of sections.entries()) {
		const sectionPath = `exercises[${sectionIndex}]`;
		if (!section || typeof section.title !== 'string' || !section.title.trim()) errors.push(`${sectionPath}.title is empty`);
		if (!Array.isArray(section?.items) || section.items.length === 0) {
			errors.push(`${sectionPath}.items is empty`);
			continue;
		}
		for (const [itemIndex, item] of section.items.entries()) {
			const itemPath = `${sectionPath}.items[${itemIndex}]`;
			if (!item || typeof item.text !== 'string' || !item.text.trim()) errors.push(`${itemPath}.text is empty`);
			const start = item?.start;
			if (typeof start !== 'number' || !Number.isFinite(start) || start < 0 || (Number.isFinite(report.duration) && start >= report.duration)) {
				errors.push(`${itemPath}.start is outside the video`);
				continue;
			}
			const anchor = Math.round(start * 100);
			if (anchors.has(anchor)) errors.push(`${itemPath}.start duplicates an exercise anchor`);
			anchors.add(anchor);
			if (segmentStarts.length && segmentStarts.every((segmentStart) => Math.abs(start - segmentStart) > 10)) {
				warnings.push(`${itemPath}.start is over 10 seconds from the nearest transcript segment`);
			}
		}
	}
	return { errors, warnings };
}
