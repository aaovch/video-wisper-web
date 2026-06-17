<script lang="ts">
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import type { VideoSource } from '$lib/types';

	let {
		video,
		seekTo = 0,
		onTime,
		onPlaying
	}: {
		video: VideoSource;
		seekTo?: number;
		onTime?: (time: number) => void;
		onPlaying?: (playing: boolean) => void;
	} = $props();

	const start = $derived(Math.max(0, Math.floor(seekTo)));

	const isNative = $derived(video.provider === 'file' || video.provider === 'yadisk');

	// --- Встраиваемые провайдеры iframe (rutube/vimeo: пересоздаём по тайм-коду) ---
	const iframeSrc = $derived.by(() => {
		const s = start;
		if (video.provider === 'rutube') {
			return `https://rutube.ru/play/embed/${video.id}/?t=${s}`;
		}
		if (video.provider === 'vimeo') {
			return `https://player.vimeo.com/video/${video.id}#t=${s}s`;
		}
		return '';
	});

	// --- YouTube: стабильный iframe + IFrame API (читаем время, перематываем через API) ---
	// id детерминирован (одинаков на SSR и клиенте), иначе YT.Player не найдёт iframe.
	const ytId = $derived(video.provider === 'youtube' ? `yt-${video.id}` : 'yt-player');
	// Адрес не зависит от seekTo: перемотка идёт через API, без перезагрузки плеера.
	const ytSrc = $derived(
		video.provider === 'youtube'
			? `https://www.youtube-nocookie.com/embed/${video.id}` +
					`?rel=0&playsinline=1&enablejsapi=1` +
					(browser ? `&origin=${encodeURIComponent(location.origin)}` : '')
			: ''
	);

	let ytPlayer = $state<any>(null);
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let ytApiPromise: Promise<void> | null = null;

	function loadYouTubeApi(): Promise<void> {
		const w = window as any;
		if (w.YT?.Player) return Promise.resolve();
		if (ytApiPromise) return ytApiPromise;
		ytApiPromise = new Promise<void>((resolve) => {
			const prev = w.onYouTubeIframeAPIReady;
			w.onYouTubeIframeAPIReady = () => {
				prev?.();
				resolve();
			};
			const tag = document.createElement('script');
			tag.src = 'https://www.youtube.com/iframe_api';
			document.head.appendChild(tag);
		});
		return ytApiPromise;
	}

	function emitYtTime() {
		try {
			const t = ytPlayer?.getCurrentTime?.();
			if (typeof t === 'number' && !Number.isNaN(t)) onTime?.(t);
		} catch {
			/* плеер ещё не готов */
		}
	}

	function startPoll() {
		if (pollTimer) return;
		pollTimer = setInterval(emitYtTime, 500);
	}

	function stopPoll() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	$effect(() => {
		if (video.provider !== 'youtube' || typeof window === 'undefined') return;
		let cancelled = false;
		loadYouTubeApi().then(() => {
			if (cancelled) return;
			const YT = (window as any).YT;
			ytPlayer = new YT.Player(ytId, {
				events: {
					onStateChange: (e: any) => {
						if (e.data === YT.PlayerState.PLAYING) {
							onPlaying?.(true);
							startPoll();
						} else {
							onPlaying?.(false);
							stopPoll();
							emitYtTime(); // зафиксировать позицию на паузе/перемотке
						}
					}
				}
			});
		});
		return () => {
			cancelled = true;
			stopPoll();
			try {
				ytPlayer?.destroy?.();
			} catch {
				/* noop */
			}
			ytPlayer = null;
		};
	});

	// Перемотка YouTube по клику на блок (через API, без пересоздания iframe).
	$effect(() => {
		const t = start;
		if (video.provider === 'youtube' && ytPlayer?.seekTo) {
			ytPlayer.seekTo(t, true);
			if (t > 0) ytPlayer.playVideo?.();
		}
	});

	// --- Нативное видео (file / yadisk) ---
	let videoEl = $state<HTMLVideoElement | null>(null);
	let directSrc = $state<string | null>(null);
	let poster = $state<string | null>(null);
	let failed = $state(false);

	// Локальный файл — путь известен сразу.
	$effect(() => {
		if (video.provider !== 'file') return;
		directSrc = `${base}/${video.src}`;
		poster = video.poster ? `${base}/${video.poster}` : null;
		failed = false;
	});

	// Яндекс.Диск — прямую ссылку резолвим в браузере.
	type YaSize = { url: string; name: string };
	function pickPoster(sizes?: YaSize[], preview?: string): string | null {
		if (sizes?.length) {
			for (const name of ['XXXL', 'XXL', 'XL', 'L', 'M']) {
				const hit = sizes.find((s) => s.name === name);
				if (hit) return hit.url;
			}
		}
		return preview ?? null;
	}

	$effect(() => {
		if (video.provider !== 'yadisk') return;
		const publicKey = video.publicKey;
		let cancelled = false;
		failed = false;
		directSrc = null;
		poster = null;

		const apiBase = 'https://cloud-api.yandex.net/v1/disk/public/resources';
		const key = encodeURIComponent(publicKey);

		fetch(`${apiBase}/download?public_key=${key}`)
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then((data: { href?: string }) => {
				if (cancelled) return;
				if (data.href) directSrc = data.href;
				else failed = true;
			})
			.catch(() => {
				if (!cancelled) failed = true;
			});

		fetch(`${apiBase}?public_key=${key}`)
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then((data: { sizes?: YaSize[]; preview?: string }) => {
				if (!cancelled) poster = pickPoster(data.sizes, data.preview);
			})
			.catch(() => {
				/* постер опционален */
			});

		return () => {
			cancelled = true;
		};
	});

	const fallbackUrl = $derived(video.provider === 'yadisk' ? video.publicKey : '');

	// Перемотка нативного видео по тайм-коду блока.
	$effect(() => {
		const t = start;
		if (isNative && videoEl && directSrc && t >= 0) {
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
	{#if isNative}
		{#if directSrc}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={videoEl}
				src={directSrc}
				poster={poster ?? undefined}
				controls
				preload="metadata"
				ontimeupdate={() => onTime?.(videoEl?.currentTime ?? 0)}
				onplay={() => onPlaying?.(true)}
				onpause={() => onPlaying?.(false)}
				onended={() => onPlaying?.(false)}
			></video>
		{:else if failed}
			<div class="state">
				<p>Не удалось загрузить видео в плеере.</p>
				{#if fallbackUrl}
					<a href={fallbackUrl} target="_blank" rel="noopener noreferrer"
						>Открыть на Яндекс.Диске →</a
					>
				{/if}
			</div>
		{:else}
			<div class="state"><p>Загрузка видео…</p></div>
		{/if}
	{:else if video.provider === 'youtube'}
		<iframe
			id={ytId}
			src={ytSrc}
			title="Видео"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
		></iframe>
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
		background: var(--screen);
		border: 1px solid var(--screen-edge);
		box-shadow: var(--shadow);
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
		color: #b8b0a0;
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-align: center;
		padding: 16px;
	}

	.state a {
		color: var(--accent-2);
	}
</style>
