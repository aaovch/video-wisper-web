<script lang="ts">
	let { weapon }: { weapon: 'sabre-and-longsword' | 'feder' } = $props();
</script>

{#if weapon === 'sabre-and-longsword'}
<svg viewBox="0 0 505 200" aria-hidden="true">
  <g transform="translate(15 -2) scale(.93)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <!-- The edge and fuller converge into a single fine point. -->
    <path stroke-width="1.45" d="M87 122 C158 111 305 74 394 19 C370 48 295 83 218 104 C165 119 122 128 89 131"/>
    <path opacity=".68" stroke-width=".8" d="M94 125 C171 113 301 78 373 34"/>
    <path opacity=".32" stroke-width=".65" d="M105 132 Q178 118 228 103 M274 87 Q322 68 353 50"/>
    <!-- Slightly irregular strokes give the grip its texture. -->
    <path stroke-width="1.5" d="M87 122 Q66 129 46 137 Q40 140 38 136 Q34 133 33 138 Q32 143 39 148 Q45 151 50 146 L89 131"/>
    <path stroke-width=".9" d="M50 137l3 7m2-9 3 7m2-9 3 7m2-9 3 7m2-9 3 7m2-9 3 7"/>
    <!-- The knuckle guard carries the calligraphic flourish. -->
    <path stroke-width="1.7" d="M37 145 C38 166 63 174 81 157 C92 147 92 133 86 120 Q81 109 86 106 Q90 104 91 109"/>
    <path stroke-width=".75" d="M41 153 C51 170 77 164 85 145 M82 117 Q91 125 100 118"/>
    <path opacity=".55" stroke-width=".85" d="M42 148 C37 158 16 168 12 161 C8 154 26 153 29 160 C31 167 24 173 18 175"/>
  </g>
  <!-- Longsword in profile, with a central ridge, straight crossguard and two-handed grip. -->
  <g transform="translate(40 186) rotate(-14)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <path stroke-width="1.8" d="M93-7.2 Q194-6.4 313-4.8 L400-3.5 461 0 400 3.4 311 4.8 Q193 6.3 93 7.2Z"/>
    <path stroke-width=".9" d="M95 0 Q239-.9 353-.3 L447 0"/>
    <path stroke-width=".7" opacity=".5" d="M103 4.9 196 3.8 M213-4.6 274-3.9"/>
    <path stroke-width="1.8" d="M87-29 91-30 Q96-13 95 0 Q96 14 92 29 L88 28 Q91 13 90 1 Q91-13 87-29Z"/>
    <path stroke-width="1.6" d="M19-4.8 Q32-3.2 48-3.5 L89-5.8 90 5.8 48 3.5 Q32 3.2 19 5Z"/>
    <path stroke-width=".85" d="m25-3-2 6m10-6-2 6m11-6-2 6m11-7-2 7m11-7-2 7m11-8-2 8m11-8-2 8"/>
    <path stroke-width="1.6" d="M19-4.8 14-7.8 6-7 1-3 0 2 6 7 14 7.8 19 5Z"/>
    <path stroke-width=".8" d="m4-2 7-3 5 2-2 6-7 1Z"/>
  </g>
</svg>
{:else}
<svg viewBox="0 0 510 154" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="translate(15 119) rotate(-12)">
<!-- Feder in profile: rounded point, narrow blade, Schilt and two-handed grip. -->
<path stroke-width="1.55" d="M101-5.5 109-8 123-12 129-9 134-3.4 Q279-3 464-1.9 Q470-2 471 0 Q471 2 465 2.2 L134 3.4 128 9 123 11 109 7 101 5Z"/>
<path stroke-width=".7" opacity=".64" d="M137-.3 409-.6 M107 3.3l15 4.4 7-5.9 M152 4.6l91-.7"/>
<path stroke-width="1.6" d="M93-26q5 9 8 22l.6 8q.5 13-3 25l-3 2q2-14 1-26l-1-8q-1-11-5-21z"/>
<path stroke-width="1.45" d="M20-4.8q20 2 37 .9l38-2.1 1 11.5q-28-2.8-39-2.7-20 .4-37 2Z"/>
<path stroke-width=".85" d="m27-3-2 6m9-6-2 5m9-5-2 5m9-6-2 6m10-6-2 6m11-7-2 7m11-7-2 7m11-8-2 8"/>
<path stroke-width="1.5" d="M20-4.5 14-7.4 6-6 1-2v4l5 4 8 1.4 6-3Z"/><path stroke-width=".72" d="m4-1 8-3 5 2m-3-5-2 3"/>
</g></svg>
{/if}

<style>
	svg { display: block; width: 100%; height: auto; color: var(--ink-soft); pointer-events: none; }
</style>
