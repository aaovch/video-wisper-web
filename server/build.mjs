import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
for (const [script,args,env] of [
  ['scripts/build-search-index.mjs',[],{HEMA_INDEX_DIR:'.codex/private-index'}],
  ['node_modules/vite/bin/vite.js',['build'],{HEMA_SERVER_UI:'1',VITE_HEMA_SERVER:'1',BASE_PATH:''}],
  ['server/build-forms.mjs',[],{}],
  ['server/site-test.mjs',[],{}],
  ['server/public-preview-test.mjs',[],{}],
  ['server/submissions/submissions-test.mjs',[],{}],
  ['server/submissions/publication-test.mjs',[],{}],
  ['server/submissions/report-format-test.mjs',[],{}],
  ['server/submissions/material-policy-test.mjs',[],{}],
  ['server/submissions/remote-test.mjs',[],{}],
  ['server/submissions/editorial-workflow-test.mjs',[],{}],
  ['server/submissions/editorial-api-test.mjs',[],{}],
  ['server/submissions/transcription-test.mjs',[],{}],
  ['server/owner-access-test.mjs',[],{}],
  ['server/password-admin-test.mjs',[],{}],
  ['server/metadata-test.mjs',[],{}]
]) {
  const result = spawnSync(process.execPath,[script,...args],{cwd,env:{...process.env,...env},stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
