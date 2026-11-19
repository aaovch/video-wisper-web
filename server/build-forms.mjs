import { build } from 'vite';
import { fileURLToPath } from 'node:url';

await build({
  configFile: false,
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL('../.codex/server-ui/_app/', import.meta.url)),
    emptyOutDir: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
    lib: {
      entry: fileURLToPath(new URL('./forms-client.js', import.meta.url)),
      name: 'ArchiveForms',
      formats: ['iife'],
      fileName: () => 'server-forms.js'
    }
  }
});
