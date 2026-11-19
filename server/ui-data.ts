import type { Report } from '$lib/types';
import { getAllReportSummaries } from './report-meta';

export const getSlugs = () => getAllReportSummaries().map(report => report.slug);
export const getReportCount = () => getAllReportSummaries().length;

export async function getReport(slug: string): Promise<Report | undefined> {
  const response = await fetch('/api/reports/' + encodeURIComponent(slug));
  if (!response.ok) return undefined;
  return response.json();
}
