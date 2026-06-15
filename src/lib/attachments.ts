import type { Attachment } from 'svelte/attachments';

/**
 * Плавное появление элемента при попадании в вьюпорт.
 * Использование: <div class="reveal" {@attach reveal()}>…</div>
 */
export function reveal(options: { delay?: number } = {}): Attachment<HTMLElement> {
	return (node) => {
		if (options.delay) node.style.animationDelay = `${options.delay}ms`;

		// Без IntersectionObserver (на всякий случай) — просто показываем.
		if (typeof IntersectionObserver === 'undefined') {
			node.classList.add('is-visible');
			return;
		}

		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						node.classList.add('is-visible');
						io.unobserve(node);
					}
				}
			},
			{ rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
		);
		io.observe(node);

		return () => io.disconnect();
	};
}
