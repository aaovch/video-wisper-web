import type { Report } from '$lib/types';
import berezhnoyAi from './reports/berezhnoy-ai.json';
import hemaReflections from './reports/hema-reflections.json';
import longswordA from './reports/longsword-a.json';
import metodichka from './reports/metodichka.json';
import retention from './reports/retention.json';
import sablyaA2 from './reports/sablya-a-2.json';
import sablyaA3 from './reports/sablya-a-3.json';
import sablyaA5 from './reports/sablya-a-5.json';
import sablyaA7 from './reports/sablya-a-7.json';
import sablyaA9 from './reports/sablya-a-9.json';
import sablya8 from './reports/sablya-8.json';
import sablya10 from './reports/sablya-10.json';
import sablya12 from './reports/sablya-12.json';
import sablya4 from './reports/sablya-4.json';
import sablya6 from './reports/sablya-6.json';
import sablyaVvodnaya from './reports/sablya-vvodnaya.json';
import software30 from './reports/software-3-0.json';

// Порядок здесь = порядок карточек на главной.
const all: Report[] = [
	sablyaVvodnaya as Report,
	sablyaA2 as Report,
	sablyaA3 as Report,
	sablya4 as Report,
	sablyaA5 as Report,
	sablya6 as Report,
	sablyaA7 as Report,
	sablya8 as Report,
	sablyaA9 as Report,
	sablya10 as Report,
	sablya12 as Report,
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
