import type { Attachment } from 'svelte/attachments';

const BOUND = 'data-reveal-bound';

function bindReveal(node: HTMLElement, delay?: number) {
	if (node.hasAttribute(BOUND)) return;
	node.setAttribute(BOUND, '');

	if (delay) node.style.animationDelay = `${delay}ms`;

	const show = () => {
		if (!node.isConnected) return;
		node.classList.add('is-visible');
	};

	if (typeof IntersectionObserver === 'undefined') {
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

	const checkNow = () => {
		if (node.classList.contains('is-visible')) return true;
		const rect = node.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) return false;
		const vh = window.innerHeight || document.documentElement.clientHeight;
		const margin = vh * 0.1;
		if (rect.top < vh - margin && rect.bottom > margin) {
			show();
			io.unobserve(node);
			return true;
		}
		return false;
	};

	io.observe(node);

	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			checkNow();
		});
	});
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

/** Для prerender-HTML: {@attach} иногда не успевает до первого paint. */
export function initPrerenderedReveals() {
	for (const node of document.querySelectorAll<HTMLElement>('.reveal')) {
		bindReveal(node);
	}
}
