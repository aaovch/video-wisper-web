import type { Report } from '$lib/types';
import metodichka from './reports/metodichka.json';
import retention from './reports/retention.json';

// Порядок здесь = порядок карточек на главной.
const all: Report[] = [retention as Report, metodichka as Report];

export const reports: Report[] = all;

export function getReport(slug: string): Report | undefined {
	return all.find((r) => r.slug === slug);
}

export function getSlugs(): string[] {
	return all.map((r) => r.slug);
}
