/** Accumulate visible time for one recording; cancellation discards unfinished time. */
export function waitForVisibleVisit(send: () => void, doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> = document): () => void {
	let remaining = 10_000;
	let started: number | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	const cancel = () => {
		stopped = true;
		clearTimeout(timer);
		doc.removeEventListener('visibilitychange', update);
	};
	function update() {
		if (stopped) return;
		clearTimeout(timer);
		const now = performance.now();
		if (started !== undefined) remaining -= now - started;
		started = undefined;
		if (doc.visibilityState !== 'visible') return;
		if (remaining <= 0) {
			cancel();
			send();
			return;
		}
		started = now;
		timer = setTimeout(update, remaining);
	}
	doc.addEventListener('visibilitychange', update);
	update();
	return cancel;
}
