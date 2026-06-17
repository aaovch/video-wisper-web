import type { Report } from '$lib/types';
import berezhnoyAi from './reports/berezhnoy-ai.json';
import hemaReflections from './reports/hema-reflections.json';
import longswordA from './reports/longsword-a.json';
import metodichka from './reports/metodichka.json';
import retention from './reports/retention.json';
import sablyaA3 from './reports/sablya-a-3.json';
import software30 from './reports/software-3-0.json';

// Порядок здесь = порядок карточек на главной.
const all: Report[] = [
	sablyaA3 as Report,
	longswordA as Report,
	software30 as Report,
	hemaReflections as Report,
	berezhnoyAi as Report,
	retention as Report,
	metodichka as Report
];

export const reports: Report[] = all;

export function getReport(slug: string): Report | undefined {
	return all.find((r) => r.slug === slug);
}

export function getSlugs(): string[] {
	return all.map((r) => r.slug);
}
