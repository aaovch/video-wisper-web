<script lang="ts">
	import type { VideoSource } from '$lib/types';

	let { video, seekTo = 0 }: { video: VideoSource; seekTo?: number } = $props();

	const start = $derived(Math.max(0, Math.floor(seekTo)));

	// --- Встраиваемые провайдеры (iframe) ---
	const iframeSrc = $derived.by(() => {
		const s = start;
		if (video.provider === 'youtube') {
			return `https://www.youtube-nocookie.com/embed/${video.id}?start=${s}&rel=0&autoplay=${s > 0 ? 1 : 0}`;
		}
		if (video.provider === 'rutube') {
			return `https://rutube.ru/play/embed/${video.id}/?t=${s}`;
		}
		if (video.provider === 'vimeo') {
			return `https://player.vimeo.com/video/${video.id}#t=${s}s`;
		}
		return '';
	});

	// --- Яндекс.Диск: прямая ссылка резолвится в браузере ---
	let videoEl = $state<HTMLVideoElement | null>(null);
	let directSrc = $state<string | null>(null);
	let failed = $state(false);
	const fallbackUrl = $derived(video.provider === 'yadisk' ? video.publicKey : '');

	$effect(() => {
		if (video.provider !== 'yadisk') return;
		const publicKey = video.publicKey;
		let cancelled = false;
		failed = false;
		directSrc = null;

		const api =
			'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' +
			encodeURIComponent(publicKey);

		fetch(api)
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then((data: { href?: string }) => {
				if (cancelled) return;
				if (data.href) directSrc = data.href;
				else failed = true;
			})
			.catch(() => {
				if (!cancelled) failed = true;
			});

		return () => {
			cancelled = true;
		};
	});

	// Перемотка нативного видео по тайм-коду блока.
	$effect(() => {
		const t = start;
		if (video.provider === 'yadisk' && videoEl && directSrc && t >= 0) {
			const el = videoEl;
			const seek = () => {
				try {
					el.currentTime = t;
					if (t > 0) void el.play();
				} catch {
					/* перемотаем, когда появятся метаданные */
				}
			};
			if (el.readyState >= 1) seek();
			else el.addEventListener('loadedmetadata', seek, { once: true });
		}
	});
</script>

<div class="player">
	{#if video.provider === 'yadisk'}
		{#if directSrc}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={videoEl} src={directSrc} controls preload="metadata"></video>
		{:else if failed}
			<div class="state">
				<p>Не удалось загрузить видео в плеере.</p>
				<a href={fallbackUrl} target="_blank" rel="noopener noreferrer"
					>Открыть на Яндекс.Диске →</a
				>
			</div>
		{:else}
			<div class="state"><p>Загрузка видео…</p></div>
		{/if}
	{:else}
		{#key iframeSrc}
			<iframe
				src={iframeSrc}
				title="Видео"
				loading="lazy"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowfullscreen
			></iframe>
		{/key}
	{/if}
</div>

<style>
	.player {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: var(--radius);
		overflow: hidden;
		border: 1px solid var(--border);
		background: #000;
	}

	iframe,
	video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}

	.state {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 15px;
		text-align: center;
		padding: 16px;
	}
</style>
