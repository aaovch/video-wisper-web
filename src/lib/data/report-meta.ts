import type { ReportSummary } from '$lib/types';
import raw from './report-meta.json';

const bySlug = new Map((raw as ReportSummary[]).map((r) => [r.slug, r]));

export function getReportSummary(slug: string): ReportSummary | undefined {
	return bySlug.get(slug);
}

export function getAllReportSummaries(): ReportSummary[] {
	return raw as ReportSummary[];
}
