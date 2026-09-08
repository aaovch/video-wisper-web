/** Focus and background isolation for the existing filter sheet. */
export function modalFocus(node: HTMLElement) {
	const previous = document.activeElement as HTMLElement | null;
	const isolated: Array<{ element: HTMLElement; inert: boolean }> = [];
	let branch: HTMLElement = node;
	while (branch.parentElement) {
		for (const sibling of branch.parentElement.children) {
			if (sibling instanceof HTMLElement && sibling !== branch && !sibling.classList.contains('filter-backdrop')) {
				isolated.push({ element: sibling, inert: sibling.inert });
				sibling.inert = true;
			}
		}
		branch = branch.parentElement;
	}
	const focusable = () => [...node.querySelectorAll<HTMLElement>('button, input, a[href], select, textarea, [tabindex]')]
		.filter((element) => !element.matches(':disabled, [tabindex="-1"]') && element.getClientRects().length > 0);
	node.tabIndex = -1;
	queueMicrotask(() => (focusable()[0] ?? node).focus());
	function keydown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;
		const items = focusable();
		const first = items[0] ?? node;
		const last = items.at(-1) ?? node;
		if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
			event.preventDefault(); last.focus();
		} else if (!event.shiftKey && (document.activeElement === last || document.activeElement === node)) {
			event.preventDefault(); first.focus();
		}
	}
	node.addEventListener('keydown', keydown);
	return { destroy() {
		node.removeEventListener('keydown', keydown);
		for (const { element, inert } of isolated) element.inert = inert;
		if (previous?.isConnected) previous.focus();
	} };
}
