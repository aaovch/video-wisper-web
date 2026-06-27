import type { Attachment } from 'svelte/attachments';

const BOUND = 'data-reveal-bound';

function inViewport(node: HTMLElement): boolean {
	const rect = node.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) return false;
	const vh = window.innerHeight || document.documentElement.clientHeight;
	const margin = vh * 0.1;
	return rect.top < vh - margin && rect.bottom > margin;
}

function bindReveal(node: HTMLElement, delay?: number) {
	if (node.hasAttribute(BOUND)) return;
	node.setAttribute(BOUND, '');

	if (delay) node.style.animationDelay = `${delay}ms`;

	function show() {
		if (!node.isConnected) return;
		node.classList.add('is-visible');
		if (document.documentElement.classList.contains('nav-instant')) {
			node.classList.add('reveal-static');
		}
	}

	if (typeof IntersectionObserver === 'undefined') {
		show();
		return;
	}

	if (inViewport(node)) {
		show();
		return;
	}

	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					show();
					io.unobserve(node);
				}
			}
		},
		{ rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
	);

	io.observe(node);
}

/** Ограничение stagger-задержки анимации (мс). */
export function revealDelay(index: number, step = 90, max = 360): number {
	return Math.min(index * step, max);
}

/**
 * Плавное появление элемента при попадании в вьюпорт.
 * Использование: <div class="reveal" {@attach reveal()}>…</div>
 */
export function reveal(options: { delay?: number } = {}): Attachment<HTMLElement> {
	return (node) => {
		bindReveal(node, options.delay);
		return () => node.removeAttribute(BOUND);
	};
}

/** Сразу показать reveal-блоки во viewport (без последующей анимации). */
export function flushVisibleReveals() {
	for (const node of document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)')) {
		if (inViewport(node)) {
			node.classList.add('is-visible', 'reveal-static');
		}
	}
}

/** Подхватить .reveal, которые ещё не связаны с {@attach reveal}. */
export function initPrerenderedReveals() {
	for (const node of document.querySelectorAll<HTMLElement>('.reveal:not([data-reveal-bound])')) {
		bindReveal(node);
	}
}

/** Включить режим мгновенного показа при client-side навигации. */
export function beginNavInstant() {
	document.documentElement.classList.add('nav-instant');
	flushVisibleReveals();
}

export function endNavInstant() {
	requestAnimationFrame(() => {
		document.documentElement.classList.remove('nav-instant');
	});
}
