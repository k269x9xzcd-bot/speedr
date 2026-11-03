// Course model + source adapters + progress store for the Learn tab.
//
// Every course, whatever its source, has the same shape:
//   { id, source, title, subtitle, filters?, units: [{ id, title, subtitle, lessons: [Lesson] }] }
//   Lesson: { id, title, subtitle?, desc?, concepts?, tags?, ...adapter fields }
// A lesson's content is markdown, split into parts at `## ` headings (see md.jsx).
// Adapters: 'wyandanch' (built in), 'github' (any markdown repo), 'ai' (Claude-generated).

import { parseDoc } from './md.jsx';

const STORE_KEY = 'speedr_learn_v1';
const DOC_PREFIX = 'speedr_learn_doc_';
const AI_PREFIX = 'speedr_learn_ai_';
const DOC_TTL = 7 * 24 * 3600e3;
export const PASS = 0.7;

// ---------- storage ----------
function lsGet(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

export function getStore() {
  const s = lsGet(STORE_KEY, null);
  if (s) return s;
  // one-time migration from the old Library → Curriculum module
  const fresh = { courses: {}, progress: {}, recent: null };
  const old = lsGet('speedr_wl_progress', null);
  if (old) {
    const p = {};
    for (const [slug, e] of Object.entries(old)) {
      p[slug] = { parts: e.sections || {}, done: e.done || null, last: e.last || null };
    }
    fresh.progress.wyandanch = p;
    fresh.recent = 'wyandanch';
  }
  lsSet(STORE_KEY, fresh);
  return fresh;
}
function saveStore(s) { lsSet(STORE_KEY, s); window.dispatchEvent(new Event('learn-store')); }
export function updateStore(fn) { const s = getStore(); fn(s); saveStore(s); return s; }

// ---------- progress ----------
export function lessonProgress(store, courseId, lessonId) {
  return store.progress?.[courseId]?.[lessonId] || { parts: {} };
}
// done | quiz (all parts read, quiz pending) | started | new
export function lessonStatus(store, courseId, lesson) {
  const p = lessonProgress(store, courseId, lesson.id);
  if (p.done) return 'done';
  const n = Object.keys(p.parts || {}).length;
  if (p.partCount && n >= p.partCount) return 'quiz';
  return n ? 'started' : 'new';
}
export function markPart(courseId, lessonId, part, partCount) {
  updateStore(s => {
    s.progress[courseId] = s.progress[courseId] || {};
    const p = s.progress[courseId][lessonId] || { parts: {} };
    p.parts[part] = true; p.partCount = partCount; p.lastPart = part; p.last = Date.now();
    s.progress[courseId][lessonId] = p; s.recent = courseId;
  });
}
export function touchLesson(courseId, lessonId, part) {
  updateStore(s => {
    s.progress[courseId] = s.progress[courseId] || {};
    const p = s.progress[courseId][lessonId] || { parts: {} };
    p.lastPart = part; p.last = Date.now();
    s.progress[courseId][lessonId] = p; s.recent = courseId;
  });
}
// returns true when the quiz passed and the lesson is now complete
export function recordQuiz(courseId, lessonId, score, of) {
  const passed = of > 0 && score / of >= PASS;
  updateStore(s => {
    s.progress[courseId] = s.progress[courseId] || {};
    const p = s.progress[courseId][lessonId] || { parts: {} };
    p.quiz = { score, of, ts: Date.now(), best: Math.max(score / of, p.quiz?.best || 0) };
    if (passed) p.done = p.done || Date.now();
    p.last = Date.now();
    s.progress[courseId][lessonId] = p; s.recent = courseId;
  });
  return passed;
}
export function resetLesson(courseId, lessonId) {
  updateStore(s => { if (s.progress[courseId]) delete s.progress[courseId][lessonId]; });
}

export const allLessons = (course) => course.units.flatMap(u => u.lessons);
export function courseCounts(store, course) {
  const ls = allLessons(course);
  return { done: ls.filter(l => lessonStatus(store, course.id, l) === 'done').length, total: ls.length };
}
// first unfinished lesson, preferring the one touched most recently
export function nextLesson(store, course) {
  const ls = allLessons(course);
  const prog = store.progress?.[course.id] || {};
  const open = ls.filter(l => !prog[l.id]?.done);
  if (!open.length) return null;
  const started = open.filter(l => prog[l.id]?.last).sort((a, b) => prog[b.id].last - prog[a.id].last);
  return started[0] || open[0];
}
export function lessonAfter(course, lessonId) {
  const ls = allLessons(course); const i = ls.findIndex(l => l.id === lessonId);
  return i >= 0 ? ls[i + 1] || null : null;
}
// part to resume at: first unread part after the last one touched
export function resumePart(store, courseId, lessonId, partCount) {
  const p = lessonProgress(store, courseId, lessonId);
  for (let i = 0; i < partCount; i++) if (!p.parts?.[i]) return i;
  return 0;
}

// ---------- quiz text: a sample of the whole lesson within the API's 8000-char cap ----------
export function quizText(doc, budget = 7800) {
  const parts = doc.parts;
  const total = parts.reduce((a, p) => a + p.text.length, 0) || 1;
  return parts.map(p => {
    const share = Math.max(300, Math.floor(budget * p.text.length / total));
    return `${p.title}.\n${p.text.slice(0, share)}`;
  }).join('\n\n').slice(0, budget);
}

// ---------- remote markdown with cache ----------
async function fetchMd(url, cacheKey) {
  const key = DOC_PREFIX + cacheKey;
  const c = lsGet(key, null);
  if (c && Date.now() - c.ts < DOC_TTL && c.md) return c.md;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const md = await r.text();
    lsSet(key, { ts: Date.now(), md });
    return md;
  } catch (e) { if (c?.md) return c.md; throw e; }
}
function toDoc(md) {
  const d = parseDoc(md);
  return { parts: d.sections, further: d.further, words: d.words };
}

// =====================================================================
// Adapter: Wyandanch Library (built in)
// =====================================================================
const WL_RAW = 'https://raw.githubusercontent.com/NickNemo17/wyandanch-library/HEAD';
const WL_SITE = 'https://wyandanchlibrary.com';
const WL_META_KEY = 'speedr_wl_meta';

function extractBlock(src, name) {
  const i = src.indexOf(`export const ${name}`);
  if (i < 0) return null;
  const start = src.indexOf('[', src.indexOf('=', i));
  let depth = 0, q = null;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  return null;
}
function literalToJson(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let v = ''; i++;
      while (i < s.length && s[i] !== c) {
        if (s[i] === '\\') { const n = s[i + 1]; v += n === 'n' ? '\n' : n; i += 2; continue; }
        v += s[i++];
      }
      i++; out += JSON.stringify(v); continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let id = '';
      while (i < s.length && /[\w$]/.test(s[i])) id += s[i++];
      let k = i; while (/\s/.test(s[k])) k++;
      out += s[k] === ':' ? JSON.stringify(id) : id;
      continue;
    }
    out += c; i++;
  }
  return out.replace(/,(\s*[\]}])/g, '$1');
}
function parseArr(src, name) {
  let b = extractBlock(src, name);
  if (!b) return [];
  if (name === 'levels') b = b.replace(/items:\s*allItems\.filter\([^\n]*\n/g, '\n');
  try { return JSON.parse(literalToJson(b)); } catch { return []; }
}
async function wlMeta() {
  const c = lsGet(WL_META_KEY, null);
  if (c && Date.now() - c.ts < 24 * 3600e3 && c.data?.items?.length) return c.data;
  try {
    const r = await fetch(`${WL_RAW}/lib/curriculum.ts`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const src = await r.text();
    const data = { items: parseArr(src, 'allItems'), tracks: parseArr(src, 'tracks'), levels: parseArr(src, 'levels'), queue: parseArr(src, 'readingQueue') };
    if (!data.items.length) throw new Error('parse');
    lsSet(WL_META_KEY, { ts: Date.now(), data });
    return data;
  } catch (e) { if (c?.data?.items?.length) return c.data; throw e; }
}
export const WYANDANCH_STUB = {
  id: 'wyandanch', source: 'wyandanch', builtin: true,
  title: 'Wyandanch Library', subtitle: 'Investing & quant finance · from Menger to machine learning',
};
async function wlCourse() {
  const m = await wlMeta();
  return {
    ...WYANDANCH_STUB,
    attribution: { text: 'Content © Nicholas Nemeth / Wyandanch Library, CC BY-NC-SA 4.0', url: WL_SITE },
    filters: m.tracks.map(t => ({ id: t.slug, label: t.title.replace(/^The /, '') })),
    upcoming: m.queue,
    units: m.levels.map(l => ({
      id: 'L' + l.number, title: l.title, subtitle: l.description, tag: String(l.number).padStart(2, '0'),
      lessons: m.items.filter(i => i.level === l.number).map(i => ({
        id: i.slug, title: i.title, subtitle: i.author, desc: i.description,
        concepts: i.keyConcepts || [], tags: i.tracks || [], level: i.level,
      })),
    })),
  };
}

// =====================================================================
// Adapter: any public GitHub repo of markdown files ("other libraries")
// =====================================================================
const SKIP = /(^|\/)(node_modules|\.github|\.vscode|dist|build|vendor)\/|(^|\/)(LICENSE|CHANGELOG|CODE_OF_CONDUCT|CONTRIBUTING|SECURITY)(\.\w+)?$/i;
const pretty = (s) => s.replace(/\.(md|mdx|markdown)$/i, '').replace(/^\d+[-_.\s]*/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export function parseRepoUrl(input) {
  const s = input.trim().replace(/\.git$/, '');
  let m = s.match(/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/tree\/([^/]+)\/?(.*))?/i);
  if (m) return { owner: m[1], repo: m[2], branch: m[3] || null, dir: (m[4] || '').replace(/\/$/, '') };
  m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m) return { owner: m[1], repo: m[2], branch: null, dir: '' };
  return null;
}
export async function buildGithubCourse(input) {
  const ref = parseRepoUrl(input);
  if (!ref) throw new Error('Enter a GitHub repo URL, e.g. github.com/owner/repo');
  const api = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  const info = await fetch(api).then(r => r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? 'Repo not found (must be public)' : 'GitHub error ' + r.status)));
  const branch = ref.branch || info.default_branch || 'main';
  const tree = await fetch(`${api}/git/trees/${encodeURIComponent(branch)}?recursive=1`).then(r => r.ok ? r.json() : Promise.reject(new Error('Could not list files')));
  const files = (tree.tree || [])
    .filter(f => f.type === 'blob' && /\.(md|mdx|markdown)$/i.test(f.path) && !SKIP.test(f.path))
    .filter(f => !ref.dir || f.path.startsWith(ref.dir + '/'))
    .map(f => f.path).sort(natural);
  const lessonsFiles = files.filter(p => !/(^|\/)readme\.md$/i.test(p) || files.length === 1);
  if (!lessonsFiles.length) throw new Error('No markdown files found in that repo');
  if (lessonsFiles.length > 300) throw new Error(`${lessonsFiles.length} files — too large; link a sub-folder instead`);
  const groups = new Map();
  for (const p of lessonsFiles) {
    const rel = ref.dir ? p.slice(ref.dir.length + 1) : p;
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(p);
  }
  const units = [...groups.entries()].sort((a, b) => natural(a[0], b[0])).map(([dir, paths], i) => ({
    id: 'u' + i, title: dir ? dir.split('/').map(pretty).join(' › ') : 'Main', tag: String(i + 1).padStart(2, '0'),
    lessons: paths.map(p => ({ id: p, title: pretty(p.split('/').pop()), path: p })),
  }));
  return {
    id: `gh:${ref.owner}/${ref.repo}${ref.dir ? '/' + ref.dir : ''}`, source: 'github',
    title: pretty(ref.dir ? ref.dir.split('/').pop() : info.name), subtitle: info.description || `${ref.owner}/${ref.repo}`,
    repo: `${ref.owner}/${ref.repo}`, branch, created: Date.now(),
    attribution: { text: `Source: github.com/${ref.owner}/${ref.repo}${info.license?.spdx_id ? ' · ' + info.license.spdx_id : ''}`, url: info.html_url },
    units,
  };
}

// =====================================================================
// Adapter: AI-generated course (outline now, lessons on demand)
// =====================================================================
async function callCourseApi(body) {
  const r = await fetch('/api/course', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Generation failed (' + r.status + ')');
  return d;
}
export async function buildAiCourse({ topic, level, size }) {
  const d = await callCourseApi({ action: 'outline', topic, level, size });
  const o = d.outline;
  return {
    id: 'ai:' + Date.now().toString(36), source: 'ai', title: o.title, subtitle: o.subtitle || topic,
    topic, level, created: Date.now(),
    attribution: { text: 'Generated by Claude — verify important facts against primary sources' },
    units: o.units.map((u, i) => ({
      id: 'u' + i, title: u.title, subtitle: u.summary || '', tag: String(i + 1).padStart(2, '0'),
      lessons: u.lessons.map((l, j) => ({ id: `u${i}l${j}`, title: l.title, desc: l.summary || '', concepts: l.concepts || [] })),
    })),
  };
}

// =====================================================================
// Dispatch
// =====================================================================
export function listCourses(store) {
  return [WYANDANCH_STUB, ...Object.values(store.courses || {}).sort((a, b) => (b.created || 0) - (a.created || 0))];
}
export async function loadCourse(id) {
  if (id === 'wyandanch') return wlCourse();
  const c = getStore().courses?.[id];
  if (!c) throw new Error('Course not found');
  return c;
}
export function saveCourse(course) { updateStore(s => { s.courses[course.id] = course; s.recent = course.id; }); }
export function deleteCourse(id) {
  updateStore(s => { delete s.courses[id]; delete s.progress[id]; if (s.recent === id) s.recent = null; });
  try { Object.keys(localStorage).filter(k => k.startsWith(AI_PREFIX + id)).forEach(k => localStorage.removeItem(k)); } catch {}
}

export async function loadLessonDoc(course, lesson) {
  if (course.source === 'wyandanch') {
    return toDoc(await fetchMd(`${WL_RAW}/content/level-${lesson.level}/${lesson.id}.mdx`, 'wl_' + lesson.id));
  }
  if (course.source === 'github') {
    const url = `https://raw.githubusercontent.com/${course.repo}/${encodeURIComponent(course.branch)}/${lesson.path.split('/').map(encodeURIComponent).join('/')}`;
    return toDoc(await fetchMd(url, 'gh_' + course.repo + '_' + lesson.path));
  }
  if (course.source === 'ai') {
    const key = AI_PREFIX + course.id + '_' + lesson.id;
    let md = lsGet(key, null);
    if (!md) {
      const unit = course.units.find(u => u.lessons.some(l => l.id === lesson.id));
      const d = await callCourseApi({
        action: 'lesson', course: { title: course.title, topic: course.topic, level: course.level },
        unit: unit?.title, lesson: { title: lesson.title, summary: lesson.desc, concepts: lesson.concepts },
        outline: allLessons(course).map(l => l.title),
      });
      md = d.markdown;
      lsSet(key, md);
    }
    return toDoc(md);
  }
  throw new Error('Unknown course source');
}

// Where "Source" links point for a lesson/part
export function sourceUrl(course, lesson, partTitle) {
  if (course.source === 'wyandanch') {
    const base = `${WL_SITE}/read/${lesson.id}`;
    return !partTitle || partTitle === 'Introduction' ? base : `${base}#:~:text=${encodeURIComponent(partTitle).replace(/-/g, '%2D')}`;
  }
  if (course.source === 'github') return `https://github.com/${course.repo}/blob/${course.branch}/${lesson.path}`;
  return null;
}
export function linkBase(course) { return course.source === 'wyandanch' ? WL_SITE : course.source === 'github' ? `https://github.com/${course.repo}/blob/${course.branch}` : null; }
