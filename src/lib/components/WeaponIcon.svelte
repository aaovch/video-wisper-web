<script lang="ts">
	let { name }: { name: string } = $props();
	const paths: Record<string,string> = {
		'Длинный меч': 'M4 21l5-5m-4-3 6 6m-3-4L19 3l2-1-1 4L10 17',
		'Катана': 'M3 21l5-5m-2-2 4 4m-3-4Q15 9 20 2q0 5-11 15',
		'Меч и баклер': 'M3 20l4-5m-3-2 5 4m-3-3L18 2l-1 4-9 10 M20 16a4 4 0 1 1-8 0 4 4 0 1 1 8 0 M17 16a1 1 0 1 1-2 0 1 1 0 1 1 2 0',
		'Рапира': 'M4 21l5-6 12-13M5 12q6-2 7 5-4 3-7-5Zm0 2-2 1m8-2 2-1',
		'Сабля': 'M3 19l5-5m-4-2q-4 8 0 9l5-4m-4-5 5 5M7 13Q16 9 21 2q-2 7-12 13'
	};
</script>

{#if paths[name]}
	<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d={paths[name]} /></svg>
{/if}
