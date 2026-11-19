import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { waitForVisibleVisit } from './visible-visit';

class Visibility extends EventTarget {
	visibilityState: DocumentVisibilityState = 'visible';
	set(value: DocumentVisibilityState) { this.visibilityState = value; this.dispatchEvent(new Event('visibilitychange')); }
}
beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }));
afterEach(() => vi.useRealTimers());
test('counts only once after ten seconds, never before', () => {
	const doc = new Visibility(), send = vi.fn();
	waitForVisibleVisit(send, doc);
	vi.advanceTimersByTime(9999); expect(send).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1); expect(send).toHaveBeenCalledTimes(1);
	doc.set('hidden'); doc.set('visible'); vi.advanceTimersByTime(20000);
	expect(send).toHaveBeenCalledTimes(1);
});
test('background time does not count and visible time resumes', () => {
	const doc = new Visibility(), send = vi.fn();
	doc.set('hidden'); waitForVisibleVisit(send, doc);
	vi.advanceTimersByTime(60000); expect(send).not.toHaveBeenCalled();
	doc.set('visible'); vi.advanceTimersByTime(4000); doc.set('hidden');
	vi.advanceTimersByTime(60000); expect(send).not.toHaveBeenCalled();
	doc.set('visible'); vi.advanceTimersByTime(5999); expect(send).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1); expect(send).toHaveBeenCalledTimes(1);
});
test('leaving discards unfinished time', () => {
	const doc = new Visibility(), send = vi.fn();
	const cancel = waitForVisibleVisit(send, doc);
	vi.advanceTimersByTime(9000); cancel();
	vi.advanceTimersByTime(60000); doc.set('hidden'); doc.set('visible');
	expect(send).not.toHaveBeenCalled();
	waitForVisibleVisit(send, doc); vi.advanceTimersByTime(9999); expect(send).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1); expect(send).toHaveBeenCalledTimes(1);
});
