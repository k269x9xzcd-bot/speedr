import { lsSet as safeSet } from '../storage.js';
// "1,000 Nights" — Ray Bradbury's program: every night, one poem, one short story and one essay,
// drawn from different eras and fields. Texts live in Supabase (public.bradbury_items, public domain).
// The schedule is generated once from the catalog with a fixed seed and saved, so Night N never changes.

const SB_URL = 'https://reojrvyczjrdaobgnrod.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlb2pydnljempyZGFvYmducm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzAyODQsImV4cCI6MjA5NDAwNjI4NH0.RziEy75n6MS6SNl_nUqLOVRSG19TNEta9AvzrT0BB14';
const SCHED_KEY = 'speedr_bradbury_sched_v1';
const TEXT_PREFIX = 'speedr_learn_doc_bb_';
export const NIGHTS = 1000;
export const KINDS = ['poem', 'story', 'essay'];
export const KIND_LABEL = { poem: 'Poem', story: 'Story', essay: 'Essay' };
const PART_WORDS = 1500; // long stories/essays are split into parts of about this size

function lsGet(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function lsSet(k, v) { return safeSet(k, JSON.stringify(v)); }

async function rest(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` } });
  if (!r.ok) throw new Error('Library unavailable (' + r.status + ')');
  return r.json();
}

// ---------- catalog → fixed schedule ----------
async function fetchCatalog() {
  const cols = 'id,kind,title,author,year,era,field,word_count,line_count,source_url';
  const out = [];
  for (let off = 0; off < 10000; off += 1000) {
    const rows = await rest(`bradbury_items?select=${cols}&status=eq.ok&order=id&limit=1000&offset=${off}`);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function buildSchedule(catalog) {
  const rnd = mulberry32(19200822); // Bradbury's birthday
  // a nightly poem should be a poem, not an epic: keep 4–80 lines
  const pools = {
    poem: catalog.filter(x => x.kind === 'poem' && (x.line_count || 0) >= 4 && (x.line_count || 0) <= 80),
    story: catalog.filter(x => x.kind === 'story'),
    essay: catalog.filter(x => x.kind === 'essay'),
  };
  for (const k of KINDS) if (!pools[k].length) throw new Error('Library is empty');
  const q = {}, round = {};
  const refill = k => { round[k] = (round[k] || 0) + 1; q[k] = shuffle(pools[k], rnd); };
  KINDS.forEach(refill);
  // take the first item within a short look-ahead that satisfies `ok`, else the head of the queue
  const take = (k, ok) => {
    if (!q[k].length) refill(k);
    const n = Math.min(q[k].length, 25);
    let i = 0; for (; i < n; i++) if (ok(q[k][i])) break;
    if (i === n) i = 0;
    return { ...q[k].splice(i, 1)[0], round: round[k] };
  };
  const recent = { field: [], storyAuthor: [], poet: [] };
  const push = (a, v, max) => { a.push(v); if (a.length > max) a.shift(); };
  const nights = [];
  for (let n = 1; n <= NIGHTS; n++) {
    const essay = take('essay', x => !recent.field.includes(x.field));
    const story = take('story', x => !recent.storyAuthor.includes(x.author) && (x.era !== essay.era || x.author !== essay.author));
    const poem = take('poem', x => !recent.poet.includes(x.author) && x.era !== story.era && x.era !== essay.era);
    push(recent.field, essay.field, 3); push(recent.storyAuthor, story.author, 6); push(recent.poet, poem.author, 10);
    nights.push({ poem: slim(poem), story: slim(story), essay: slim(essay) });
  }
  return nights;
}
const slim = x => ({ id: x.id, t: x.title, a: x.author, y: x.year, e: x.era, f: x.field, w: x.word_count, l: x.line_count, r: x.round, s: x.source_url });

async function getSchedule() {
  const s = lsGet(SCHED_KEY, null);
  if (s?.nights?.length === NIGHTS) return s.nights;
  const nights = buildSchedule(await fetchCatalog());
  lsSet(SCHED_KEY, { built: Date.now(), nights });
  return nights;
}

// ---------- course shape ----------
export const BRADBURY_STUB = {
  id: 'bradbury', source: 'bradbury', builtin: true, unitNoun: 'night',
  title: '1,000 Nights', subtitle: "Ray Bradbury's program · a poem, a story and an essay every night",
};
export const yearLabel = y => (y == null ? '' : y < 0 ? `${-y} BC` : String(y));
export async function bradburyCourse() {
  const nights = await getSchedule();
  return {
    ...BRADBURY_STUB,
    attribution: { text: 'Public-domain texts via Project Gutenberg · Poems via PoetryDB (CC BY 4.0)', url: 'https://poetrydb.org' },
    units: nights.map((night, i) => ({
      id: 'n' + (i + 1), tag: String(i + 1), title: `Night ${i + 1}`,
      subtitle: KINDS.map(k => night[k].t).join(' · '),
      lessons: KINDS.map(k => {
        const x = night[k];
        return {
          id: `n${i + 1}-${k}`, kind: k, itemId: x.id, title: x.t,
          subtitle: [KIND_LABEL[k], x.a, yearLabel(x.y), k === 'essay' ? x.f : null].filter(Boolean).join(' · '),
          desc: `${KIND_LABEL[k]} · ${x.e}${x.r > 1 ? ' · second reading' : ''}`, words: x.w, src: x.s,
        };
      }),
    })),
  };
}

// ---------- lesson text → doc (parts) ----------
function part(title, text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return { title, md: text, text, words, formulas: [], hasTable: false, kind: 'body' };
}
export async function bradburyDoc(lesson) {
  const key = TEXT_PREFIX + lesson.itemId;
  let row = lsGet(key, null);
  if (!row) {
    const rows = await rest(`bradbury_items?select=id,kind,title,author,text,source_url&id=eq.${lesson.itemId}`);
    if (!rows.length) throw new Error('This piece is no longer in the library');
    row = rows[0];
    lsSet(key, row); // best effort — long texts may exceed the quota, which is fine
  }
  const paras = row.text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  let parts;
  if (lesson.kind === 'poem') parts = [part(row.title, row.text)];
  else {
    const chunks = []; let cur = [], n = 0;
    for (const p of paras) {
      cur.push(p); n += p.split(/\s+/).length;
      if (n >= PART_WORDS) { chunks.push(cur); cur = []; n = 0; }
    }
    if (cur.length) { // fold a short tail into the previous part
      if (chunks.length && n < PART_WORDS / 3) chunks[chunks.length - 1].push(...cur); else chunks.push(cur);
    }
    parts = chunks.length === 1 ? [part(row.title, chunks[0].join('\n\n'))]
      : chunks.map((c, i) => part(`Part ${i + 1} of ${chunks.length}`, c.join('\n\n')));
  }
  return { parts, further: [], words: parts.reduce((a, p) => a + p.words, 0), sourceUrl: row.source_url };
}

// ---------- nights progress + streak ----------
export function nightState(store, course) {
  const prog = store.progress?.bradbury || {};
  const nights = course.units.map((u, i) => {
    const dones = u.lessons.map(l => prog[l.id]?.done || 0);
    return { n: i + 1, unit: u, complete: dones.every(Boolean), doneAt: dones.every(Boolean) ? Math.max(...dones) : 0, read: dones.filter(Boolean).length };
  });
  const current = nights.find(x => !x.complete) || null;
  const completed = nights.filter(x => x.complete).length;
  // streak: consecutive calendar days (local) with at least one night finished, ending today or yesterday
  const day = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const days = new Set(nights.filter(x => x.doneAt).map(x => day(x.doneAt)));
  let streak = 0; const d = new Date();
  if (!days.has(day(d))) d.setDate(d.getDate() - 1);
  while (days.has(day(d))) { streak++; d.setDate(d.getDate() - 1); }
  const doneToday = days.has(day(Date.now()));
  return { nights, current, completed, streak, doneToday };
}
