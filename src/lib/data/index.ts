import type { Report } from '$lib/types';
import contextEngineering29min from './reports/context-engineering-29min.json';
import berezhnoyAi from './reports/berezhnoy-ai.json';
import hemaReflections from './reports/hema-reflections.json';
import llmDeepDiveKarpathy from './reports/llm-deep-dive-karpathy.json';
import longswordA from './reports/longsword-a.json';
import metodichka from './reports/metodichka.json';
import podlodkaSlm468 from './reports/podlodka-slm-468.json';
import podlodkaNaimAi482 from './reports/podlodka-naim-ai-482.json';
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
import podlodkaVectorSearch from './reports/podlodka-vector-search.json';
import software30 from './reports/software-3-0.json';
import woodcreekCh1 from './reports/woodcreek-ch1.json';
import poiskNovogoRuchya from './reports/poisk-novogo-ruchya.json';
import obsidianWikiKarpathy from './reports/obsidian-wiki-karpathy.json';
import kendzyuPravila1 from './reports/kendzyu-pravila-1.json';
import kendzyuSparringAliVov from './reports/kendzyu-sparring-ali-vov.json';
import kendzyuSparring1 from './reports/kendzyu-sparring-1.json';
import kendzyuSparringAliAndrey from './reports/kendzyu-sparring-ali-andrey.json';
import almatySparringAli2026 from './reports/almaty-sparring-ali-2026.json';
import almatySparring20262 from './reports/almaty-sparring-2026-2.json';
import kendzyuSparringOlegGolub from './reports/kendzyu-sparring-oleg-golub.json';
import kendzyuSparringVovaTimirbat from './reports/kendzyu-sparring-vova-timirbat.json';
import report20260620184353 from './reports/2026-06-20-18-43-53.json';
import report20260620183945 from './reports/2026-06-20-18-39-45.json';
import report20260620185936 from './reports/2026-06-20-185936.json';
import protivnikFehtuetNepravilno from './reports/protivnik-fehtuet-nepravilno.json';
import mcwilliams10Aspects from './reports/mcwilliams-10-aspects.json';
import psihologiyaTyazhestKlinicheskaya from './reports/psihologiya-tyazhest-klinicheskaya.json';
import psihologiya3Isterechnaya from './reports/psihologiya-3-isterechnaya.json';
import psihologiya4Depressivnaya from './reports/psihologiya-4-depressivnaya.json';
import psihologiya5ShizoidnayaParanoidnaya from './reports/psihologiya-5-shizoidnaya-paranoidnaya.json';
import psihologiya6Narcissicheskaya from './reports/psihologiya-6-narcissicheskaya.json';
import retentionClub from './reports/retention-club.json';
import kontseptsiyaMonitoringa from './reports/kontseptsiya-monitoringa.json';
import hemaPrednamerennyeEkspromtnye from './reports/hema-prednamerennye-ekspromtnye.json';
import fehtovatDolgoNeTravmirovatsya from './reports/fehtovat-dolgo-ne-travmirovatsya.json';
import optimizatsiyaParadRipostHema from './reports/optimizatsiya-parad-ripost-hema.json';
import tokarevSilovayaOfp2 from './reports/tokarev-silovaya-ofp-2.json';
import kompresiyaTaktikiLektsiya from './reports/kompresiya-taktiki-lektsiya.json';

// Порядок здесь = порядок карточек на главной.
const all: Report[] = [
	tokarevSilovayaOfp2 as Report,
	kompresiyaTaktikiLektsiya as Report,
	optimizatsiyaParadRipostHema as Report,
	fehtovatDolgoNeTravmirovatsya as Report,
	kontseptsiyaMonitoringa as Report,
	hemaPrednamerennyeEkspromtnye as Report,
	retentionClub as Report,
	mcwilliams10Aspects as Report,
	psihologiyaTyazhestKlinicheskaya as Report,
	psihologiya3Isterechnaya as Report,
	psihologiya4Depressivnaya as Report,
	psihologiya5ShizoidnayaParanoidnaya as Report,
	psihologiya6Narcissicheskaya as Report,
	protivnikFehtuetNepravilno as Report,
	report20260620185936 as Report,
	report20260620183945 as Report,
	report20260620184353 as Report,
	kendzyuSparringOlegGolub as Report,
	kendzyuSparringVovaTimirbat as Report,
	almatySparringAli2026 as Report,
	almatySparring20262 as Report,
	kendzyuSparringAliAndrey as Report,
	kendzyuSparring1 as Report,
	kendzyuSparringAliVov as Report,
	kendzyuPravila1 as Report,
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
	llmDeepDiveKarpathy as Report,
	contextEngineering29min as Report,
	obsidianWikiKarpathy as Report,
	podlodkaVectorSearch as Report,
	podlodkaSlm468 as Report,
	podlodkaNaimAi482 as Report,
	hemaReflections as Report,
	berezhnoyAi as Report,
	retention as Report,
	metodichka as Report,
	woodcreekCh1 as Report,
	poiskNovogoRuchya as Report
];

export const reports: Report[] = all;

export function getReport(slug: string): Report | undefined {
	return all.find((r) => r.slug === slug);
}

export function getSlugs(): string[] {
	return all.map((r) => r.slug);
}
