import {passedReview} from './result-ready.mjs';
import {validateEditorial} from './editorial.mjs';
import {checkedSection,sectionRanges} from './draft-sections.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const hash = value => createHash('sha256').update(value).digest('hex');
export function youtubeUrl(value) {
  if (typeof value !== 'string' || value.length > 500) throw Error('Укажите ссылку YouTube.');
  let u; try { u = new URL(value); } catch { throw Error('Укажите ссылку YouTube.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw Error('Нужна HTTPS-ссылка YouTube.');
  let id;
  if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(u.hostname)) {
    id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(?:shorts|live|embed)\/([\w-]+)$/.exec(u.pathname)?.[1];
  }
  if (!/^[\w-]{11}$/.test(id ?? '')) throw Error('Нужна ссылка на одно видео YouTube.');
  return `https://www.youtube.com/watch?v=${id}`;
}

export function openSubmissions(filename, { dailyLimit = 10, authorLimit = 2, now = Date.now } = {}) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS authors (id TEXT PRIMARY KEY, key_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS owner_hidden_submissions (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY, author TEXT NOT NULL, url TEXT NOT NULL, created INTEGER NOT NULL,
      state TEXT NOT NULL, lease TEXT, heartbeat INTEGER, draft TEXT, error TEXT, reviewed INTEGER
    );`);
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('PRAGMA table_info(submissions)').all().some(c => c.name === 'cloud_audio_consent')) {
      db.exec('ALTER TABLE submissions ADD COLUMN cloud_audio_consent INTEGER NOT NULL DEFAULT 0');
    }
    for(const column of ['placement','publication','source_title'])if(!db.prepare('PRAGMA table_info(submissions)').all().some(c=>c.name===column))db.exec(`ALTER TABLE submissions ADD COLUMN ${column} TEXT`);
    const columns = db.prepare('PRAGMA table_info(submissions)').all().map(c => c.name);
    if (!columns.includes('candidate')) db.exec('ALTER TABLE submissions ADD COLUMN candidate TEXT');
    if (!columns.includes('sections')) db.exec("ALTER TABLE submissions ADD COLUMN sections TEXT NOT NULL DEFAULT '[]'");
    if (!columns.includes('checkpoint')) db.exec('ALTER TABLE submissions ADD COLUMN checkpoint TEXT');
    if (!columns.includes('recovery_count')) db.exec('ALTER TABLE submissions ADD COLUMN recovery_count INTEGER NOT NULL DEFAULT 0');
    if (!columns.includes('source')) db.exec("ALTER TABLE submissions ADD COLUMN source TEXT NOT NULL DEFAULT 'site'");
    if (!columns.includes('attempt')) db.exec('ALTER TABLE submissions ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1');
    db.exec("UPDATE submissions SET state='consent_required' WHERE state='queued' AND source='site' AND cloud_audio_consent=0");
    db.exec(`CREATE TABLE IF NOT EXISTS catalog_revision (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
      INSERT OR IGNORE INTO catalog_revision VALUES(1,0);
      CREATE TRIGGER IF NOT EXISTS catalog_after_publish AFTER UPDATE OF state,publication ON submissions
        WHEN (OLD.state='published' AND OLD.publication IS NOT NULL) OR (NEW.state='published' AND NEW.publication IS NOT NULL)
        BEGIN UPDATE catalog_revision SET revision=revision+1 WHERE id=1; END;
      CREATE TRIGGER IF NOT EXISTS catalog_after_insert AFTER INSERT ON submissions
        WHEN NEW.state='published' AND NEW.publication IS NOT NULL
        BEGIN UPDATE catalog_revision SET revision=revision+1 WHERE id=1; END;
      CREATE TRIGGER IF NOT EXISTS catalog_after_delete AFTER DELETE ON submissions
        WHEN OLD.state='published' AND OLD.publication IS NOT NULL
        BEGIN UPDATE catalog_revision SET revision=revision+1 WHERE id=1; END;`);
    db.exec(`UPDATE submissions SET state='failed',error='Не удалось подтвердить качество разбора.'
      WHERE state='review' AND source='site' AND NOT (
        json_type(draft,'$.review.pass') IS 'true' AND json_type(draft,'$.review.issues') IS 'array'
        AND json_array_length(draft,'$.review.issues')=0)`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  const revisionQuery = db.prepare('SELECT revision FROM catalog_revision WHERE id=1');
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const v = fn(); db.exec('COMMIT'); return v; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  return {
    publicationRevision: () => revisionQuery.get().revision,
    close: () => db.close(),
    limits: { dailyLimit, authorLimit },
    issue(days = 30) {
      const key = randomBytes(32).toString('base64url'), id = randomBytes(16).toString('hex');
      db.prepare('INSERT INTO authors VALUES (?,?,?)').run(id, hash(key), now() + days * 86400000);
      return { id, key };
    },
    revoke: id => db.prepare('DELETE FROM authors WHERE id=?').run(id),
    author: key => typeof key === 'string' && key.length < 100 ? db.prepare('SELECT id FROM authors WHERE key_hash=? AND expires>?').get(hash(key), now())?.id : undefined,
    create(author, input, consent, placement = null) {
      const url = youtubeUrl(input);
      if (consent !== true) throw Error('Подтвердите право на обработку видео.');
      return transaction(() => {
        const duplicate = db.prepare("SELECT id,placement FROM submissions WHERE url=? AND author=? AND state NOT IN ('rejected','failed')").get(url,author);
        if (duplicate) {
          if (placement?.collection || placement?.title || placement?.authors?.length || placement?.weapons?.length || placement?.newAccess==='report') {
            const saved = JSON.parse(duplicate.placement) || {};
            if (Object.keys(placement).some(key => key!=='requested' && JSON.stringify(saved[key])!==JSON.stringify(placement[key]))) {
              throw Error('Видео уже отправлено. Измените параметры существующей заявки в разделе «Мои видео» перед публикацией.');
            }
          }
          if (placement?.requested) {
            db.prepare("UPDATE submissions SET placement=json_set(COALESCE(placement,'{}'),'$.requested',json('true')) WHERE id=? AND state!='published'").run(duplicate.id);
          }
          return duplicate.id;
        }
        const since = now() - 86400000;
        if (db.prepare("SELECT count(*) AS n FROM submissions WHERE created>? AND source='site'").get(since).n >= dailyLimit ||
            db.prepare("SELECT count(*) AS n FROM submissions WHERE created>? AND author=? AND NOT (source='site' AND url=? AND state='failed')").get(since,author,url).n >= authorLimit)
          throw Error('Лимит на сегодня исчерпан. Попробуйте завтра.');
        const id = randomBytes(16).toString('hex');
        db.prepare("INSERT INTO submissions(id,author,url,created,state,cloud_audio_consent) VALUES(?,?,?,?,'queued',1)").run(id, author, url, now());
        if(placement)db.prepare('UPDATE submissions SET placement=? WHERE id=?').run(JSON.stringify(placement),id);
        return id;
      });
    },
    registerLocal(id, title, url) {
      if (!/^[a-f0-9]{32}$/.test(id) || typeof title !== 'string' || !title.trim() || title.length > 250) throw Error('Invalid local run');
      const link = url ? youtubeUrl(url) : '';
      db.prepare("INSERT INTO submissions(id,author,url,created,state,source,placement) VALUES(?,'skill',?,?,'queued','skill',?) ON CONFLICT(id) DO NOTHING")
        .run(id,link,now(),JSON.stringify({title}));
      const row = this.get(id);
      if (row.source !== 'skill' || row.url !== link) throw Error('Run conflict');
    },
    claimLocal(id) {
      const lease = randomBytes(16).toString('hex');
      const row = db.prepare("UPDATE submissions SET state='downloading',lease=?,heartbeat=? WHERE id=? AND source='skill' AND state='queued' RETURNING attempt").get(lease,now(),id);
      return row ? {lease,attempt:row.attempt} : null;
    },
    finishLocal(id,lease) {
      return db.prepare("UPDATE submissions SET state='local_ready',lease=NULL WHERE id=? AND lease=? AND source='skill'").run(id,lease).changes === 1;
    },
    control(id,action,attempt) {
      const sql = action === 'stop'
        ? "UPDATE submissions SET state='stopped',lease=NULL,error=NULL WHERE id=? AND attempt=? AND state IN ('queued','launching','downloading','transcribing','summarizing')"
        : action === 'retry'
        ? "UPDATE submissions SET state='queued',lease=NULL,error=NULL,heartbeat=NULL,attempt=attempt+1 WHERE id=? AND attempt=? AND (source='skill' OR cloud_audio_consent=1) AND state IN ('failed','stopped')"
        : null;
      if (!sql || db.prepare(sql).run(id,attempt).changes !== 1) throw Error('Статус изменился. Обновите список видео.');
    },
    list(author, owner = false) {
      const filter = owner ? 'WHERE id NOT IN (SELECT id FROM owner_hidden_submissions)' : 'WHERE author=?';
      return db.prepare(`SELECT id,url,created,state,error,source,attempt,json_extract(placement,'$.requested') AS requested,COALESCE(NULLIF(json_extract(publication,'$.report.title'),''),NULLIF(json_extract(placement,'$.title'),''),json_extract(draft,'$.presentation.title.text'),json_extract(draft,'$.title'),source_title) AS title FROM submissions ${filter} ORDER BY created DESC LIMIT 100`).all(...(owner ? [] : [author]));
    },
    publicList() { return db.prepare("SELECT id,draft FROM submissions WHERE state='published' ORDER BY created DESC LIMIT 100").all().map(r => ({ id: r.id, title: JSON.parse(r.draft).title })); },
    get(id) { const row = db.prepare('SELECT * FROM submissions WHERE id=?').get(id); return row ? { ...row, sections:JSON.parse(row.sections), candidate:JSON.parse(row.candidate), checkpoint:JSON.parse(row.checkpoint), draft: row.draft ? JSON.parse(row.draft) : null,placement:row.placement?JSON.parse(row.placement):null,publication:row.publication?JSON.parse(row.publication):null } : null; },
    publications() {return db.prepare("SELECT publication FROM submissions WHERE state='published' AND publication IS NOT NULL ORDER BY reviewed,id").all().map(r=>JSON.parse(r.publication));},
    place(id,author,placement,owner=false) {
      if(db.prepare("UPDATE submissions SET placement=? WHERE id=? AND state NOT IN ('published','rejected') AND (author=? OR ?=1)").run(JSON.stringify(placement),id,author??'',owner?1:0).changes!==1)throw Error('Запись недоступна для изменения.');
    },
    consent(id, author) {
      if (db.prepare("UPDATE submissions SET cloud_audio_consent=1,state='queued' WHERE id=? AND author=? AND state='consent_required'").run(id,author).changes !== 1) throw Error('Подтвердить обработку может только автор ожидающего задания.');
    },
    claim(cloud = false) {
      return transaction(() => {
        // A lost worker never silently repeats a billable API request.
        db.prepare("UPDATE submissions SET state='queued',lease=NULL,heartbeat=NULL,recovery_count=1,attempt=attempt+1 WHERE source='site' AND checkpoint IS NOT NULL AND recovery_count=0 AND state IN ('summarizing','downloading') AND heartbeat<?").run(now()-120000);
        db.prepare("UPDATE submissions SET state='failed',error='Обработка прервалась. Обратитесь к владельцу архива.',lease=NULL WHERE (state IN ('downloading','transcribing','summarizing') AND heartbeat<?) OR (state='launching' AND heartbeat<?)").run(now() - 120000, now() - 900000);
        if (db.prepare("SELECT 1 FROM submissions WHERE source='site' AND lease IS NOT NULL LIMIT 1").get()) return null;
        const row = db.prepare("SELECT * FROM submissions WHERE state='queued' AND cloud_audio_consent=1 ORDER BY created LIMIT 1").get();
        if (!row) return null;
        const lease = randomBytes(16).toString('hex');
        db.prepare("UPDATE submissions SET state=?,lease=?,heartbeat=? WHERE id=?").run(cloud ? 'launching' : 'downloading', lease, now(), row.id);
        return { ...row, sections:JSON.parse(row.sections), candidate:JSON.parse(row.candidate), checkpoint:JSON.parse(row.checkpoint), lease };
      });
    },
    begin(id, lease) { return db.prepare("UPDATE submissions SET state=CASE WHEN checkpoint IS NULL THEN 'downloading' ELSE 'summarizing' END,heartbeat=? WHERE id=? AND lease=? AND state='launching'").run(now(),id,lease).changes === 1; },
    heartbeat(id, lease) { return db.prepare('UPDATE submissions SET heartbeat=? WHERE id=? AND lease=?').run(now(), id, lease).changes === 1; },
    rememberTitle(id,title) {
      db.prepare("UPDATE submissions SET source_title=? WHERE id=? AND source_title IS NULL").run(title.slice(0,250),id);
    },
    saveTranscript(id, lease, checkpoint) {
      if (!checkpoint?.segments?.length || !Array.isArray(checkpoint.flags) || !Number.isFinite(checkpoint.duration) || checkpoint.duration <= 0 ||
          !checkpoint.provenance?.transcript_sha256 || typeof checkpoint.title !== 'string' ||
          checkpoint.segments.some((s,i) => s.id !== i || typeof s.text !== 'string' || !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start<0 || s.end<s.start || s.end>checkpoint.duration+1)) throw Error('Invalid transcript checkpoint');
      const json = JSON.stringify(checkpoint);
      const saved = db.prepare("UPDATE submissions SET checkpoint=?,state='summarizing',heartbeat=? WHERE id=? AND lease=? AND (checkpoint IS NULL OR checkpoint=?)").run(json,now(),id,lease,json);
      if (!saved.changes) throw Error('Transcript checkpoint conflict');
    },
    approveResult(id,author) {
      return db.prepare("UPDATE submissions SET placement=json_set(COALESCE(placement,'{}'),'$.approvedResult',json('true'),'$.requested',json('true')) WHERE id=? AND author=? AND state='review' AND json_extract(draft,'$.final_result')=1").run(id,author).changes===1;
    },
    saveCandidate(id,lease,candidate) {
      transaction(() => {
        const row=this.get(id);
        if (!row?.checkpoint || row.lease!==lease) throw Error('Worker lease lost');
        const editorial=validateEditorial(candidate,row.checkpoint,row.checkpoint.flags);
        const review=candidate.pendingReview;
        if (review !== undefined) {
          if (review?.pass!==false || !Array.isArray(review.issues) || !review.issues.length ||
              review.issues.some(issue=>typeof issue!=='string' || !issue.trim())) throw Error('Invalid pending review');
          if (row.candidate?.pendingReview?.issues.length <= review.issues.length) return;
          editorial.pendingReview={pass:false,issues:review.issues,notes:''};
        } else if (row.candidate) {
          if (row.candidate.pendingReview || JSON.stringify(row.candidate)===JSON.stringify(editorial)) return;
          throw Error('Candidate conflict');
        }
        db.prepare('UPDATE submissions SET candidate=? WHERE id=? AND lease=?').run(JSON.stringify(editorial),id,lease);
      });
    },
    saveSection(id,lease,section) {
      transaction(() => {
        const row = this.get(id);
        if (!row?.checkpoint || row.lease !== lease) throw Error('Worker lease lost');
        const {segments,flags} = row.checkpoint;
        if (![...sectionRanges(segments)].some(([a,b])=>a===section.first && b===section.last)) throw Error('Invalid draft interval');
        const checked = checkedSection(section,segments,section.first,section.last,flags);
        const previous = row.sections.find(s=>s.first===checked.first);
        if (previous && JSON.stringify(previous)!==JSON.stringify(checked)) throw Error('Draft section conflict');
        if (!previous) db.prepare('UPDATE submissions SET sections=? WHERE id=? AND lease=?').run(JSON.stringify([...row.sections,checked].sort((a,b)=>a.first-b.first)),id,lease);
      });
    },
    progress(id) {
      return db.prepare("SELECT author,state,source_title,json_array_length(sections) AS section_count,checkpoint IS NOT NULL AS has_transcript FROM submissions WHERE id=?").get(id);
    },
    stage(id, lease, state, title) {
      if (!['transcribing', 'summarizing'].includes(state)) throw Error('Invalid processing stage');
      if (db.prepare('UPDATE submissions SET state=?,heartbeat=?,source_title=COALESCE(?,source_title) WHERE id=? AND lease=?').run(state, now(), typeof title==='string' && title.trim() ? title.trim().slice(0,250) : null, id, lease).changes !== 1) throw Error('Worker lease lost');
    },
    finish(id, lease, draft) {
      if (!passedReview(draft)) throw Error('Editorial review incomplete');
      validateEditorial(draft,{segments:draft.segments,duration:draft.provenance?.audio_seconds ?? draft.segments?.at(-1)?.end},draft.flags);
      if (db.prepare("UPDATE submissions SET state='review',draft=?,candidate=NULL,sections='[]',checkpoint=NULL,lease=NULL WHERE id=? AND lease=?").run(JSON.stringify(draft), id, lease).changes !== 1) throw Error('Worker lease lost');
    },
    fail(id, lease) {
      const resumed = db.prepare("UPDATE submissions SET state='queued',lease=NULL,heartbeat=NULL,error=NULL,recovery_count=1,attempt=attempt+1 WHERE id=? AND lease=? AND checkpoint IS NOT NULL AND recovery_count=0").run(id,lease);
      if (resumed.changes) return;
      db.prepare("UPDATE submissions SET state='failed',error='Не удалось обработать видео. Владелец архива может проверить причину.',lease=NULL WHERE id=? AND lease=?").run(id, lease); },
    decide(id, publish, reviewed, publication = null) {
      return transaction(()=>{
      if (publish && reviewed !== true) throw Error('Проверьте текст, таймкоды и спорные фрагменты по источнику.');
      if (publish) {
        const row = db.prepare('SELECT draft FROM submissions WHERE id=?').get(id);
        const draft = row?.draft && JSON.parse(row.draft);
        if (!passedReview(draft)) throw Error('Проверка нашла замечания. Этот черновик нельзя опубликовать без исправления.');
      }
      if(publish&&publication){const row=db.prepare('SELECT url FROM submissions WHERE id=?').get(id);if(db.prepare("SELECT id FROM submissions WHERE url=? AND state='published' AND id<>?").get(row.url,id))throw Error('Это видео уже опубликовано.');}
      if (db.prepare("UPDATE submissions SET state=?,reviewed=?,publication=? WHERE id=? AND state='review'").run(publish ? 'published' : 'rejected', now(), publication?JSON.stringify(publication):null,id).changes !== 1) throw Error('Черновик уже изменён или ещё не готов.');
      });
    }
  };
}
