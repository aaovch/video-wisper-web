import { archiveSite } from './site-metadata.js';

/** Обе публикации используют один интерфейс и свои названия. */
export const communityArchive = Boolean(import.meta.env.VITE_HEMA_SERVER);
export const SITE_NAME = communityArchive ? archiveSite.name : 'aaovch';
export const SITE_TAGLINE = communityArchive ? archiveSite.tagline : 'личный архив HEMA';
export const SITE_ORIGIN = import.meta.env.VITE_SITE_ORIGIN || (communityArchive ? archiveSite.origin : 'https://aaovch.github.io');
export const SITE_HOME_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const SITE_DESCRIPTION = communityArchive
	? archiveSite.description
	: 'Личный архив HEMA: коллекции тренировок, семинаров и боёв с поиском по смысловым блокам и таймкодам.';
