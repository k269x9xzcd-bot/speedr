import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Wyandanch Library curriculum module.
// Content: Nicholas Nemeth / Wyandanch Library, CC BY-NC-SA 4.0 — fetched at runtime
// from the public repo (never bundled), converted from MDX to plain text for RSVP.

const REPO_RAW = 'https://raw.githubusercontent.com/NickNemo17/wyandanch-library/HEAD';
const SITE = 'https://wyandanchlibrary.com';
const META_KEY = 'speedr_wl_meta';
const META_TTL = 24 * 60 * 60 * 1000;
const DOC_PREFIX = 'speedr_wl_doc_';
const DOC_TTL = 7 * 24 * 60 * 60 * 1000;
const PROGRESS_KEY = 'speedr_wl_progress';
const QUIZ_KEY = 'speedr_wl_quiz';

// ---------- storage helpers ----------
function lsGet(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

export function getWlProgress() { return lsGet(PROGRESS_KEY, {}); }
// sec: section index, or 'all' for a full read-through
export function markWlProgress(slug, sec, sectionCount) {
  const p = getWlProgress();
  const e = p[slug] || { sections: {} };
  if (sec === 'all') { for (let i = 0; i < (sectionCount || 0); i++) e.sections[i] = true; e.done = Date.now(); }
  else { e.sections[sec] = true; if (sectionCount && Object.keys(e.sections).length >= sectionCount) e.done = e.done || Date.now(); }
  e.last = Date.now();
  p[slug] = e; lsSet(PROGRESS_KEY, p);
  return p;
}

// ---------- curriculum.ts → data (safe literal parse, no eval) ----------
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
async function loadMeta(force) {
  const c = lsGet(META_KEY, null);
  if (!force && c && Date.now() - c.ts < META_TTL && c.data?.items?.length) return c.data;
  try {
    const r = await fetch(`${REPO_RAW}/lib/curriculum.ts`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const src = await r.text();
    const data = {
      items: parseArr(src, 'allItems'),
      tracks: parseArr(src, 'tracks'),
      topics: parseArr(src, 'topics'),
      levels: parseArr(src, 'levels'),
      queue: parseArr(src, 'readingQueue'),
    };
    if (!data.items.length) throw new Error('parse');
    lsSet(META_KEY, { ts: Date.now(), data });
    return data;
  } catch (e) {
    if (c?.data?.items?.length) return c.data; // stale cache beats nothing
    throw e;
  }
}

// ---------- MDX → sections of plain text ----------
const MATHY = /[=~≈≥≤<>σμαβγδεθλρΣ∑∫√∂^]|_\{|\b(exp|log|ln|Var|Cov|E)\(|\bE\[/;
// A bare line like "dX(t) = theta * (mu - X(t)) * dt + sigma * dW(t)" — formula, not prose
function isFormulaLine(t) {
  t = t.replace(/^\*\*|\*\*$/g, '').trim();
  if (!/=/.test(t) || t.length > 180 || /^[-*+>|#]/.test(t) || /\.$/.test(t)) return false;
  if (!/[*()^_\[\]σμαβλΣ√/]/.test(t)) return false;
  const words = t.match(/\b[a-z]{4,}\b/g) || [];
  return words.filter(w => !/^(theta|sigma|alpha|beta|gamma|delta|lambda|epsilon|kappa|sqrt|price|cost|flow|order|quantity|imbalance|portfolio|return|rate|time|sum|mean|var)$/i.test(w)).length <= 3;
}
function extractFormulas(md) {
  const out = [];
  let inCode = false, buf = [];
  for (const line of md.split('\n')) {
    if (line.trim().startsWith('```')) { if (inCode && buf.join('').trim()) out.push({ code: buf.join('\n'), block: true }); inCode = !inCode; buf = []; continue; }
    if (inCode) { buf.push(line); continue; }
    if (isFormulaLine(line.trim())) { out.push({ code: line.trim().replace(/^\*\*|\*\*$/g, '').replace(/`/g, '') }); continue; }
    for (const m of line.matchAll(/`([^`]+)`/g)) if (m[1].length > 2 && MATHY.test(m[1])) out.push({ code: m[1] });
    for (const m of line.matchAll(/\*\*([^*`]+=[^*`]+)\*\*/g)) if (MATHY.test(m[1]) && /[*()_^]/.test(m[1])) out.push({ code: m[1].trim() });
  }
  return out;
}
// Deep link to a section via a text fragment (Safari 16.1+, Chrome) — the site has no heading ids
function sectionUrl(slug, title) {
  const base = `${SITE}/read/${slug}`;
  if (!title || title === 'Introduction') return base;
  return `${base}#:~:text=${encodeURIComponent(title).replace(/-/g, '%2D')}`;
}

function mdInline(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^\w*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/\$\$?([^$]+)\$\$?/g, (_, m) => m.replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}^_\\]/g, ' '))
    .replace(/<[^>]+>/g, '')
    .replace(/ -- /g, ' — ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function mdToText(md) {
  const out = [];
  let inCode = false;
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) { if (!inCode) out.push('[code omitted]'); inCode = !inCode; continue; }
    if (inCode || !line || /^-{3,}$/.test(line) || /^\|?[\s:-]+\|[\s|:-]*$/.test(line)) continue;
    if (/living document/i.test(line)) continue;
    if (line.startsWith('|')) {
      const cells = line.split('|').map(x => mdInline(x)).filter(Boolean);
      if (cells.length) out.push(cells.join('; ') + '.');
      continue;
    }
    const h = line.match(/^#{1,6}\s+(.*)/);
    if (h) { out.push(mdInline(h[1]) + '.'); continue; }
    out.push(mdInline(line.replace(/^>\s?/, '').replace(/^([-*+]|\d+\.)\s+/, '')));
  }
  return out.filter(Boolean).join('\n\n');
}
function parseDoc(md) {
  const parts = md.split(/^## /m);
  const sections = [];
  const pre = parts.shift().trim();
  if (pre) sections.push({ title: 'Introduction', md: pre });
  for (const p of parts) {
    const nl = p.indexOf('\n');
    sections.push({ title: mdInline(nl < 0 ? p : p.slice(0, nl)), md: nl < 0 ? '' : p.slice(nl + 1).trim() });
  }
  const further = [];
  for (const s of sections) {
    s.text = mdToText(s.md);
    s.words = s.text ? s.text.split(/\s+/).filter(Boolean).length : 0;
    s.formulas = extractFormulas(s.md);
    s.hasTable = /^\s*\|.*\|\s*$/m.test(s.md);
    s.kind = /key takeaways/i.test(s.title) ? 'takeaways' : /further reading/i.test(s.title) ? 'further' : 'body';
    if (s.kind === 'takeaways') s.bullets = s.md.split('\n').filter(l => /^\s*[-*]\s/.test(l)).map(l => mdInline(l.replace(/^\s*[-*]\s+/, '')));
    if (s.kind === 'further') {
      for (const m of s.md.split('\n').filter(l => !/living document/i.test(l)).join('\n').matchAll(/\[([^\]]+)\]\(([^)]+)\)\s*(?:--|—|-)?\s*([^\n]*)/g)) {
        const slug = (m[2].match(/\/read\/([\w-]+)/) || [])[1];
        further.push({ title: m[1], slug, href: m[2], note: mdInline(m[3] || '') });
      }
    }
  }
  const readable = sections.filter(s => s.kind !== 'further' && s.words > 0);
  return { sections: readable, further, words: readable.reduce((a, s) => a + s.words, 0) };
}
async function loadDoc(item) {
  const key = DOC_PREFIX + item.slug;
  const c = lsGet(key, null);
  if (c && Date.now() - c.ts < DOC_TTL && c.md) return parseDoc(c.md);
  try {
    const r = await fetch(`${REPO_RAW}/content/level-${item.level}/${item.slug}.mdx`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const md = await r.text();
    lsSet(key, { ts: Date.now(), md });
    return parseDoc(md);
  } catch (e) {
    if (c?.md) return parseDoc(c.md);
    throw e;
  }
}

async function fetchQuiz(text) {
  const r = await fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 8000) }) });
  if (!r.ok) throw new Error('quiz ' + r.status);
  const d = await r.json();
  if (!Array.isArray(d?.questions)) throw new Error('quiz');
  return d.questions;
}

// ---------- source renderer: original markdown, formulas/tables intact ----------
const mono = "'JetBrains Mono',monospace";
function Inline({ t }) {
  const parts = []; let rest = t, k = 0;
  const re = /`([^`]+)`|\*\*(.+?)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)]+)\)/;
  while (rest) {
    const m = rest.match(re);
    if (!m) { parts.push(rest.replace(/ -- /g, ' — ')); break; }
    if (m.index) parts.push(rest.slice(0, m.index).replace(/ -- /g, ' — '));
    if (m[1] != null) parts.push(<code key={k++} style={{ fontFamily: mono, fontSize: '0.88em', background: '#16142a', color: '#c9c0ff', padding: '1px 5px', borderRadius: 5, wordBreak: 'break-word' }}>{m[1]}</code>);
    else if (m[2] != null) parts.push(<strong key={k++} style={{ color: '#e8e8e8', fontWeight: 500 }}><Inline t={m[2]} /></strong>);
    else if (m[3] != null) parts.push(<em key={k++}>{m[3]}</em>);
    else { const href = m[5].startsWith('/') ? SITE + m[5] : m[5]; parts.push(<a key={k++} href={href} target="_blank" rel="noreferrer" style={{ color: C.acc2 }}>{m[4]}</a>); }
    rest = rest.slice(m.index + m[0].length);
  }
  return <>{parts}</>;
}
function MdView({ md }) {
  const lines = md.split('\n'), out = []; let i = 0, k = 0;
  const P = { fontSize: 14, color: '#b8b8b8', lineHeight: 1.65, margin: '0 0 10px' };
  while (i < lines.length) {
    const l = lines[i], t = l.trim();
    if (!t || /^-{3,}$/.test(t) || /living document/i.test(t)) { i++; continue; }
    if (t.startsWith('```')) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i++]);
      i++;
      out.push(<pre key={k++} style={{ fontFamily: mono, fontSize: 12, color: '#c9c0ff', background: '#0b0a14', border: '1px solid #2a2040', borderRadius: 10, padding: 12, overflowX: 'auto', margin: '0 0 10px' }}>{buf.join('\n')}</pre>);
      continue;
    }
    if (t.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { const r = lines[i++].trim(); if (!/^\|?[\s:-]+\|[\s|:-]*$/.test(r)) rows.push(r.replace(/^\||\|$/g, '').split('|').map(c => c.trim())); }
      out.push(<div key={k++} style={{ overflowX: 'auto', margin: '0 0 12px' }}><table style={{ borderCollapse: 'collapse', fontSize: 12, color: '#b8b8b8', minWidth: '100%' }}><tbody>
        {rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ border: '1px solid #222', padding: '6px 8px', background: ri === 0 ? '#151515' : 'transparent', color: ri === 0 ? '#ddd' : undefined, verticalAlign: 'top' }}><Inline t={c} /></td>)}</tr>)}
      </tbody></table></div>);
      continue;
    }
    if (isFormulaLine(t)) { out.push(<div key={k++} style={{ fontFamily: mono, fontSize: 12.5, color: '#c9c0ff', background: '#0b0a14', border: '1px solid #2a2040', borderRadius: 10, padding: '9px 12px', margin: '0 0 10px', overflowX: 'auto', whiteSpace: 'nowrap' }}>{t.replace(/^\*\*|\*\*$/g, '').replace(/`/g, '')}</div>); i++; continue; }
    const h = t.match(/^(#{2,6})\s+(.*)/);
    if (h) { out.push(<div key={k++} style={{ fontSize: 14, color: '#e8e8e8', fontWeight: 500, margin: '14px 0 8px' }}><Inline t={h[2]} /></div>); i++; continue; }
    if (/^([-*+]|\d+\.)\s/.test(t)) {
      const ordered = /^\d+\./.test(t), items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s/.test(lines[i])) items.push(lines[i++].trim().replace(/^([-*+]|\d+\.)\s+/, ''));
      const L = ordered ? 'ol' : 'ul';
      out.push(<L key={k++} style={{ ...P, paddingLeft: 20 }}>{items.map((x, xi) => <li key={xi} style={{ marginBottom: 4 }}><Inline t={x} /></li>)}</L>);
      continue;
    }
    if (t.startsWith('>')) { out.push(<div key={k++} style={{ ...P, borderLeft: `2px solid ${C.acc}`, paddingLeft: 10, fontStyle: 'italic' }}><Inline t={t.replace(/^>\s?/, '')} /></div>); i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(\||#|```|>|[-*+]\s|\d+\.\s)/.test(lines[i].trim()) && !(para.length && isFormulaLine(lines[i].trim()))) para.push(lines[i++].trim());
    if (!para.length) { i++; continue; }
    out.push(<p key={k++} style={P}><Inline t={para.join(' ')} /></p>);
  }
  return <div>{out}</div>;
}

// ---------- UI ----------
const C = { bg: '#111111', bd: '#1a1a1a', acc: '#7c6af7', acc2: '#8b7fff', dim: '#555', mid: '#888', txt: '#e0e0e0' };
const card = { background: C.bg, borderRadius: 16, border: `1px solid ${C.bd}`, overflow: 'hidden', marginBottom: 12 };
const label = { fontSize: 10, color: '#c0c0c0', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, padding: '0 4px 8px' };
const pill = { padding: '7px 14px', border: `1px solid ${C.bd}`, borderRadius: 20, fontSize: 12, cursor: 'pointer', background: 'transparent', color: '#c0c0c0', whiteSpace: 'nowrap' };
const pillOn = { ...pill, background: C.acc, color: '#fff', border: `1px solid ${C.acc}` };
const chip = { fontSize: 11, padding: '4px 10px', borderRadius: 12, background: '#16142a', color: '#a99fff', border: '1px solid #2a2040' };
const btnP = { padding: '12px 18px', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer', background: C.acc, color: '#fff', minHeight: 44 };
const btnG = { padding: '12px 16px', border: `1px solid ${C.bd}`, borderRadius: 12, fontSize: 14, fontWeight: 300, cursor: 'pointer', background: 'transparent', color: '#c0c0c0', minHeight: 44 };
const row = (last) => ({ padding: '14px 16px', borderBottom: last ? 'none' : '1px solid #161616', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' });

const mins = (w, wpm) => Math.max(1, Math.round(w / (wpm || 300)));
const Bar = ({ v }) => (
  <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
    <div style={{ width: `${Math.round(v * 100)}%`, height: '100%', background: C.acc, transition: 'width .3s' }} />
  </div>
);
const Check = ({ on, partial }) => (
  <div style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, border: `1.5px solid ${on ? C.acc : partial ? '#4a3f8a' : '#2a2a2a'}`, background: on ? C.acc : 'transparent', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : partial ? '·' : ''}</div>
);

function Quiz({ text, quizKey }) {
  const [qs, setQs] = useState(null);
  const [ans, setAns] = useState({});
  const [state, setState] = useState('idle');
  const run = async () => {
    setState('loading'); setAns({});
    try { setQs(await fetchQuiz(text)); setState('ready'); } catch { setState('error'); }
  };
  const answered = qs ? Object.keys(ans).length : 0;
  const score = qs ? qs.filter((q, i) => ans[i] === q.answer).length : 0;
  useEffect(() => {
    if (qs && answered === qs.length) { const m = lsGet(QUIZ_KEY, {}); m[quizKey] = { score, of: qs.length, ts: Date.now() }; lsSet(QUIZ_KEY, m); }
  }, [answered]);
  if (state === 'idle') return <button style={{ ...btnG, width: '100%' }} onClick={run}>Quiz me on this</button>;
  if (state === 'loading') return <div style={{ padding: 20, textAlign: 'center', color: '#444', fontSize: 13, animation: 'pulse 1.4s infinite' }}>Writing questions…</div>;
  if (state === 'error') return <button style={{ ...btnG, width: '100%' }} onClick={run}>Quiz failed — retry</button>;
  return (
    <div style={{ ...card, padding: 16 }}>
      {qs.map((q, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: C.txt, lineHeight: 1.5, marginBottom: 8 }}>{i + 1}. {q.q}</div>
          {q.choices.map((c, j) => {
            const picked = ans[i] === j, shown = ans[i] !== undefined, right = j === q.answer;
            const bg = shown && right ? '#13261a' : picked ? '#2a1414' : '#0b0b0b';
            const bc = shown && right ? '#2f6b42' : picked ? '#6b2f2f' : C.bd;
            return <div key={j} onClick={() => !shown && setAns(a => ({ ...a, [i]: j }))} style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 10, border: `1px solid ${bc}`, background: bg, fontSize: 13, color: '#c8c8c8', cursor: shown ? 'default' : 'pointer' }}>{c}</div>;
          })}
        </div>
      ))}
      {answered === qs.length && <div style={{ textAlign: 'center', fontSize: 14, color: C.acc2 }}>{score}/{qs.length} correct · <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={run}>new set</span></div>}
    </div>
  );
}

export default function CurriculumModule({ onRead, wpm, progressTick }) {
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState(() => localStorage.getItem('speedr_wl_mode') || 'levels');
  const [view, setView] = useState({ name: 'home' }); // home | group | item
  const [stack, setStack] = useState([]);
  const [doc, setDoc] = useState(null);
  const [docErr, setDocErr] = useState('');
  const [search, setSearch] = useState('');
  const [progress, setProgress] = useState(getWlProgress);
  const [panel, setPanel] = useState(null); // {i, kind:'quiz'|'src'}
  const [showFx, setShowFx] = useState(false);

  useEffect(() => { setProgress(getWlProgress()); }, [progressTick]);
  const init = useCallback((force) => { setErr(''); loadMeta(force).then(setMeta).catch(() => setErr('Could not load the curriculum.')); }, []);
  useEffect(() => { init(false); }, [init]);
  useEffect(() => { try { localStorage.setItem('speedr_wl_mode', mode); } catch {} }, [mode]);

  const items = meta?.items || [];
  const bySlug = useMemo(() => Object.fromEntries(items.map(i => [i.slug, i])), [items]);
  const isDone = (s) => !!progress[s]?.done;
  const isPartial = (s) => !isDone(s) && Object.keys(progress[s]?.sections || {}).length > 0;
  const doneCount = (list) => list.filter(i => isDone(i.slug)).length;
  const nextUp = items.find(i => !isDone(i.slug));

  const go = (v) => { setStack(s => [...s, view]); setView(v); setPanel(null); setShowFx(false); window.scrollTo?.(0, 0); };
  const back = () => { const n = [...stack]; const v = n.pop(); setStack(n); setView(v || { name: 'home' }); setPanel(null); setShowFx(false); };
  const openItem = (slug) => bySlug[slug] && go({ name: 'item', slug });

  useEffect(() => {
    if (view.name !== 'item') return;
    setDoc(null); setDocErr(''); setPanel(null); setShowFx(false);
    loadDoc(bySlug[view.slug]).then(setDoc).catch(() => setDocErr('Could not load this reading.'));
  }, [view, bySlug]);

  const groups = useMemo(() => {
    if (!meta) return [];
    if (mode === 'levels') return meta.levels.map(l => ({ key: 'L' + l.number, tag: String(l.number).padStart(2, '0'), title: l.title, sub: l.description, list: items.filter(i => i.level === l.number) }));
    if (mode === 'tracks') return meta.tracks.map(t => ({ key: t.slug, tag: t.icon, title: t.title, sub: t.subtitle, desc: t.description, list: items.filter(i => i.tracks?.includes(t.slug)) }));
    if (mode === 'topics') return meta.topics.map(t => ({ key: t.slug, tag: '›', title: t.title, sub: t.description, list: items.filter(i => i.topics?.includes(t.slug)) }));
    return [];
  }, [meta, mode, items]);

  const read = (item, sec, text, title) => onRead({ slug: item.slug, sec, sectionCount: doc?.sections.length || 0, text, title, url: sec === 'all' ? `${SITE}/read/${item.slug}` : sectionUrl(item.slug, doc?.sections[sec]?.title) });
  const toggle = (i, kind) => setPanel(p => p && p.i === i && p.kind === kind ? null : { i, kind });

  if (err) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: '#555', fontSize: 14, marginBottom: 16 }}>{err}</div>
      <button style={btnG} onClick={() => init(true)}>Retry</button>
    </div>
  );
  if (!meta) return <div style={{ padding: 48, textAlign: 'center', color: '#333', fontSize: 14, animation: 'pulse 1.4s infinite' }}>Loading curriculum…</div>;

  const BackBar = ({ title }) => (
    <div onClick={back} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 12px', color: C.acc2, fontSize: 13, cursor: 'pointer' }}>‹ {title}</div>
  );
  const ItemRow = ({ i, last, showLevel }) => (
    <div style={row(last)} onClick={() => openItem(i.slug)}>
      <Check on={isDone(i.slug)} partial={isPartial(i.slug)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: C.txt, lineHeight: 1.4 }}>{i.title}</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{showLevel ? `L${i.level} · ` : ''}{i.author}</div>
      </div>
      <div style={{ color: '#333', fontSize: 16 }}>›</div>
    </div>
  );
  const Footer = () => (
    <div style={{ fontSize: 10, color: '#333', lineHeight: 1.6, textAlign: 'center', padding: '8px 12px 4px' }}>
      Content © Nicholas Nemeth / <a href={SITE} target="_blank" rel="noreferrer" style={{ color: '#444' }}>Wyandanch Library</a>, <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer" style={{ color: '#444' }}>CC BY-NC-SA 4.0</a>. Reformatted for RSVP.
    </div>
  );

  // ---------- ITEM ----------
  if (view.name === 'item') {
    const item = bySlug[view.slug];
    const idx = items.indexOf(item);
    const prev = items[idx - 1], next = items[idx + 1];
    const pSecs = progress[item.slug]?.sections || {};
    const takeaways = doc?.sections.find(s => s.kind === 'takeaways');
    return (
      <div>
        <BackBar title={stack.length ? 'Back' : 'Curriculum'} />
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 11, color: C.acc2, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Level {item.level}</div>
          <div style={{ fontSize: 20, color: '#f0f0f0', lineHeight: 1.3, marginBottom: 4 }}>{item.title}</div>
          <div style={{ fontSize: 13, color: C.mid, marginBottom: 12 }}>{item.author}</div>
          <div style={{ fontSize: 13, color: '#9a9a9a', lineHeight: 1.6, marginBottom: 14 }}>{item.description}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>{(item.keyConcepts || []).map(k => <span key={k} style={chip}>{k}</span>)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(item.tracks || []).map(t => { const tr = meta.tracks.find(x => x.slug === t); return <span key={t} onClick={() => { setMode('tracks'); go({ name: 'group', mode: 'tracks', key: t }); }} style={{ ...pill, padding: '4px 10px', fontSize: 11 }}>{tr?.title || t}</span>; })}
          </div>
        </div>

        {docErr && <div style={{ padding: 24, textAlign: 'center', color: '#555', fontSize: 13 }}>{docErr}</div>}
        {!doc && !docErr && <div style={{ padding: 32, textAlign: 'center', color: '#333', fontSize: 13, animation: 'pulse 1.4s infinite' }}>Loading reading…</div>}
        {doc && <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button style={{ ...btnP, flex: 1 }} onClick={() => read(item, 'all', doc.sections.map(s => s.title + '.\n\n' + s.text).join('\n\n'), item.title)}>
              Speed read all · {mins(doc.words, wpm)} min
            </button>
            <button style={btnG} onClick={() => { let p; if (isDone(item.slug)) { p = getWlProgress(); delete p[item.slug]; lsSet(PROGRESS_KEY, p); } else p = markWlProgress(item.slug, 'all', doc.sections.length); setProgress({ ...p }); }}>
              {isDone(item.slug) ? 'Undo' : 'Mark done'}
            </button>
          </div>

          {doc.sections.some(s => s.formulas.length) && <>
            <div onClick={() => setShowFx(v => !v)} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: '#0f0e1a', borderColor: '#2a2040' }}>
              <div style={{ fontFamily: mono, color: C.acc2, fontSize: 16 }}>ƒ</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#e0dcff' }}>Formula sheet</div>
                <div style={{ fontSize: 11, color: '#6a6090', marginTop: 3 }}>{doc.sections.reduce((a, s) => a + s.formulas.length, 0)} formulas — keep open while you speed read</div>
              </div>
              <div style={{ color: '#4a4060', fontSize: 16 }}>{showFx ? '▾' : '›'}</div>
            </div>
            {showFx && <div style={{ ...card, padding: '6px 14px' }}>
              {doc.sections.map((s, i) => s.formulas.length ? (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #161616' }}>
                  <div onClick={() => toggle(i, 'src')} style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, cursor: 'pointer' }}>{s.title} ›</div>
                  {s.formulas.map((f, j) => <div key={j} style={{ fontFamily: mono, fontSize: 12, color: '#c9c0ff', background: '#0b0a14', border: '1px solid #1e1a33', borderRadius: 8, padding: '7px 10px', marginBottom: 6, whiteSpace: f.block ? 'pre' : 'normal', overflowX: 'auto', wordBreak: 'break-word' }}>{f.code}</div>)}
                </div>
              ) : null)}
            </div>}
          </>}

          <div style={label}>Sections · {doc.words.toLocaleString()} words</div>
          <div style={card}>
            {doc.sections.map((s, i, arr) => (
              <div key={i} style={{ borderBottom: i < arr.length - 1 ? '1px solid #161616' : 'none' }}>
                <div style={{ ...row(true), paddingRight: 8 }}>
                  <div onClick={() => read(item, i, s.title + '.\n\n' + s.text, `${item.title} — ${s.title}`)} style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <Check on={!!pSecs[i]} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: C.txt }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{s.words} words · {mins(s.words, wpm)} min</div>
                    </div>
                  </div>
                  {[['src', s.formulas.length ? `ƒ ${s.formulas.length}` : s.hasTable ? '▦ Src' : 'Src'], ['quiz', 'Quiz']].map(([kind, lbl]) => {
                    const on = panel?.i === i && panel.kind === kind, hot = kind === 'src' && (s.formulas.length || s.hasTable);
                    return <button key={kind} onClick={() => toggle(i, kind)} style={{ background: 'none', border: `1px solid ${on ? C.acc : hot ? '#2a2040' : C.bd}`, color: on || hot ? C.acc2 : '#555', borderRadius: 10, fontSize: 11, padding: '6px 9px', marginLeft: 4, cursor: 'pointer', fontFamily: kind === 'src' && s.formulas.length ? mono : 'inherit' }}>{lbl}</button>;
                  })}
                </div>
                {panel?.i === i && panel.kind === 'quiz' && <div style={{ padding: '0 12px 12px' }}><Quiz key={item.slug + i} text={s.text} quizKey={`${item.slug}#${i}`} /></div>}
                {panel?.i === i && panel.kind === 'src' && (
                  <div style={{ padding: '4px 16px 14px', borderTop: '1px solid #161616', background: '#0c0c0c' }}>
                    <MdView md={s.md} />
                    <a href={sectionUrl(item.slug, s.title)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.acc2, textDecoration: 'none' }}>Open this section on wyandanchlibrary.com ↗</a>
                  </div>
                )}
              </div>
            ))}
          </div>

          {takeaways?.bullets?.length > 0 && <>
            <div style={label}>Key takeaways</div>
            <div style={{ ...card, padding: '12px 16px' }}>
              {takeaways.bullets.map((b, i) => <div key={i} style={{ fontSize: 13, color: '#a8a8a8', lineHeight: 1.6, padding: '6px 0', borderBottom: i < takeaways.bullets.length - 1 ? '1px solid #161616' : 'none' }}>{b}</div>)}
            </div>
          </>}

          {doc.further.length > 0 && <>
            <div style={label}>Further reading</div>
            <div style={card}>
              {doc.further.map((f, i, arr) => (
                <div key={i} style={row(i === arr.length - 1)} onClick={() => f.slug && bySlug[f.slug] ? openItem(f.slug) : window.open(f.href, '_blank')}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: C.acc2 }}>{f.title}</div>
                    {f.note && <div style={{ fontSize: 12, color: C.dim, marginTop: 4, lineHeight: 1.5 }}>{f.note}</div>}
                  </div>
                  <div style={{ color: '#333', fontSize: 16 }}>›</div>
                </div>
              ))}
            </div>
          </>}
        </>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button style={{ ...btnG, flex: 1, opacity: prev ? 1 : 0.3, fontSize: 12 }} disabled={!prev} onClick={() => prev && setView({ name: 'item', slug: prev.slug })}>‹ {prev?.title || 'Previous'}</button>
          <button style={{ ...btnG, flex: 1, opacity: next ? 1 : 0.3, fontSize: 12 }} disabled={!next} onClick={() => next && setView({ name: 'item', slug: next.slug })}>{next?.title || 'Next'} ›</button>
        </div>
        <a href={`${SITE}/read/${item.slug}`} target="_blank" rel="noreferrer" style={{ ...btnG, display: 'block', textAlign: 'center', textDecoration: 'none', color: C.acc2, borderColor: '#2a2a4a', marginBottom: 8 }}>Open on wyandanchlibrary.com →</a>
        <Footer />
      </div>
    );
  }

  // ---------- GROUP ----------
  if (view.name === 'group') {
    const g = groups.find(x => x.key === view.key) || (() => {
      // group opened from a track chip while groups were computed for another mode
      const t = meta.tracks.find(x => x.slug === view.key);
      return t ? { key: t.slug, tag: t.icon, title: t.title, sub: t.subtitle, desc: t.description, list: items.filter(i => i.tracks?.includes(t.slug)) } : null;
    })();
    if (!g) return <BackBar title="Curriculum" />;
    return (
      <div>
        <BackBar title="Curriculum" />
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 12, color: C.acc2, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{g.tag}</div>
          <div style={{ fontSize: 18, color: '#f0f0f0', marginBottom: 6 }}>{g.title}</div>
          <div style={{ fontSize: 13, color: '#9a9a9a', lineHeight: 1.6, marginBottom: 12 }}>{g.desc || g.sub}</div>
          <Bar v={g.list.length ? doneCount(g.list) / g.list.length : 0} />
          <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>{doneCount(g.list)} of {g.list.length} complete</div>
        </div>
        <div style={card}>{g.list.map((i, k) => <ItemRow key={i.slug} i={i} last={k === g.list.length - 1} showLevel={view.mode !== 'levels'} />)}</div>
        <Footer />
      </div>
    );
  }

  // ---------- HOME ----------
  const q = search.trim().toLowerCase();
  const results = q ? items.filter(i => [i.title, i.author, i.description, ...(i.keyConcepts || [])].join(' ').toLowerCase().includes(q)) : null;
  return (
    <div>
      <div style={{ background: '#0f0e1a', borderRadius: 16, border: '1px solid #2a2040', padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#6a5fb0', fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>&gt; from Menger to machine learning_</div>
        <div style={{ fontSize: 18, color: '#e8e4ff', marginBottom: 4 }}>Wyandanch Library</div>
        <div style={{ fontSize: 12, color: '#6a6090', marginBottom: 14 }}>{items.length} readings · {meta.levels.length} levels · investing & quant finance</div>
        <Bar v={items.length ? doneCount(items) / items.length : 0} />
        <div style={{ fontSize: 11, color: '#6a6090', marginTop: 6, marginBottom: nextUp ? 14 : 0 }}>{doneCount(items)} of {items.length} complete</div>
        {nextUp && (
          <button style={{ ...btnP, width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => openItem(nextUp.slug)}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isPartial(nextUp.slug) ? 'Continue' : 'Up next'}: {nextUp.title}</span><span>›</span>
          </button>
        )}
      </div>

      <input style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: '#080808', color: '#d8d8d8', border: `1px solid ${C.bd}`, borderRadius: 12, fontSize: 16, outline: 'none', marginBottom: 12 }}
        placeholder="Search titles, authors, concepts…" value={search} onChange={e => setSearch(e.target.value)} />

      {results ? (
        results.length ? <div style={card}>{results.map((i, k) => <ItemRow key={i.slug} i={i} last={k === results.length - 1} showLevel />)}</div>
          : <div style={{ padding: 32, textAlign: 'center', color: '#333', fontSize: 14 }}>No matches</div>
      ) : <>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
          {[['levels', 'Levels'], ['tracks', 'Tracks'], ['topics', 'Topics'], ['queue', 'Coming soon']].map(([id, l]) => (
            <button key={id} style={mode === id ? pillOn : pill} onClick={() => setMode(id)}>{l}</button>
          ))}
        </div>
        {mode === 'queue' ? (
          <div style={card}>
            {meta.queue.map((b, k) => (
              <div key={k} style={{ ...row(k === meta.queue.length - 1), cursor: 'default' }}>
                <div style={{ fontSize: 12, color: '#333', fontFamily: "'JetBrains Mono',monospace", width: 20 }}>{String(k + 1).padStart(2, '0')}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, color: '#9a9a9a' }}>{b.title}</div><div style={{ fontSize: 11, color: '#444', marginTop: 3 }}>{b.author}</div></div>
              </div>
            ))}
          </div>
        ) : (
          <div style={card}>
            {groups.map((g, k) => {
              const d = doneCount(g.list);
              return (
                <div key={g.key} style={{ ...row(k === groups.length - 1), alignItems: 'flex-start' }} onClick={() => go({ name: 'group', mode, key: g.key })}>
                  <div style={{ fontSize: 13, color: d === g.list.length && d ? C.acc2 : '#444', fontFamily: "'JetBrains Mono',monospace", width: 24, paddingTop: 1 }}>{g.tag}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: C.txt }}>{g.title}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 3, lineHeight: 1.4, marginBottom: 8 }}>{g.sub}</div>
                    <Bar v={g.list.length ? d / g.list.length : 0} />
                  </div>
                  <div style={{ fontSize: 11, color: '#444', paddingTop: 2 }}>{d}/{g.list.length}</div>
                </div>
              );
            })}
          </div>
        )}
      </>}
      <Footer />
    </div>
  );
}
