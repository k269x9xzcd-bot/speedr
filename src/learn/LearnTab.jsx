import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getStore, listCourses, loadCourse, saveCourse, deleteCourse, buildAiCourse, buildGithubCourse,
  loadLessonDoc, lessonStatus, lessonProgress, courseCounts, nextLesson, resumePart, allLessons,
  recordQuiz, resetLesson, quizText, sourceUrl, linkBase,
} from './courses.js';
import { MdView } from './md.jsx';
import { C, mono, card, label, pill, pillOn, chip, btnP, btnG, field, mins, Bar, StatusDot, Sheet, Quiz, FormulaSheet } from './ui.jsx';

function useStore() {
  const [s, set] = useState(getStore);
  useEffect(() => { const f = () => set(getStore()); window.addEventListener('learn-store', f); return () => window.removeEventListener('learn-store', f); }, []);
  return s;
}
const SRC_LABEL = { wyandanch: 'Library', github: 'GitHub', ai: 'AI course' };

// ---------------------------------------------------------------------
// Lesson sheet: overview, parts, quiz, formulas, source — all in one place
// ---------------------------------------------------------------------
function LessonSheet({ course, lesson, store, wpm, onStart, onClose, onNextLesson }) {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState('overview'); // overview | quiz | formulas | source
  const [srcPart, setSrcPart] = useState(0);
  const load = useCallback(() => { setErr(''); setDoc(null); loadLessonDoc(course, lesson).then(setDoc).catch(e => setErr(e.message || 'Could not load lesson')); }, [course, lesson]);
  useEffect(() => { setMode('overview'); load(); }, [load]);

  const p = lessonProgress(store, course.id, lesson.id);
  const status = lessonStatus(store, course.id, lesson);
  const readCount = Object.keys(p.parts || {}).length;

  let body;
  if (err) body = <div style={{ textAlign: 'center', padding: '28px 0' }}><div style={{ color: '#777', fontSize: 13, marginBottom: 12 }}>{err}</div><button style={btnG} onClick={load}>Retry</button></div>;
  else if (!doc) body = <div style={{ textAlign: 'center', padding: '36px 0', color: '#555', fontSize: 13, animation: 'pulse 1.4s infinite' }}>{course.source === 'ai' ? 'Writing this lesson… (~20s, first time only)' : 'Loading lesson…'}</div>;
  else if (mode === 'quiz') body = (
    <Quiz text={quizText(doc)} onFinish={(s, of) => recordQuiz(course.id, lesson.id, s, of)}
      after={(s, of, passed, retry) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {passed ? <button style={btnP} onClick={onNextLesson}>Next lesson ›</button>
            : <button style={btnP} onClick={() => onStart(doc, 0)}>Reread lesson</button>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btnG, flex: 1 }} onClick={retry}>{passed ? 'New questions' : 'Retry quiz'}</button>
            <button style={{ ...btnG, flex: 1 }} onClick={() => setMode('overview')}>Lesson</button>
          </div>
        </div>
      )} />
  );
  else if (mode === 'formulas') body = <><button style={{ ...pill, marginBottom: 10 }} onClick={() => setMode('overview')}>‹ Lesson</button><FormulaSheet doc={doc} onOpenPart={i => { setSrcPart(i); setMode('source'); }} /></>;
  else if (mode === 'source') {
    const part = doc.parts[srcPart]; const url = sourceUrl(course, lesson, part?.title);
    body = (
      <>
        <button style={{ ...pill, marginBottom: 10 }} onClick={() => setMode('overview')}>‹ Lesson</button>
        <div style={{ fontSize: 15, color: '#eee', marginBottom: 10 }}>{part.title}</div>
        <MdView md={part.md} linkBase={linkBase(course)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button style={{ ...btnP, flex: 1 }} onClick={() => onStart(doc, srcPart)}>Speed read this part</button>
          {url && <a href={url} target="_blank" rel="noreferrer" style={{ ...btnG, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>↗</a>}
        </div>
      </>
    );
  } else {
    const resume = resumePart(store, course.id, lesson.id, doc.parts.length);
    const fx = doc.parts.reduce((a, x) => a + (x.formulas?.length || 0), 0);
    const primary = status === 'quiz' ? ['Take the quiz to finish', () => setMode('quiz')]
      : status === 'done' ? ['Read again', () => onStart(doc, 0)]
      : status === 'started' ? [`Resume · part ${resume + 1} of ${doc.parts.length}`, () => onStart(doc, resume)]
      : [`Start · ${mins(doc.words, wpm)} min`, () => onStart(doc, 0)];
    body = (
      <>
        <div style={{ fontSize: 20, color: '#f0f0f0', lineHeight: 1.3, marginBottom: 4 }}>{lesson.title}</div>
        {lesson.subtitle && <div style={{ fontSize: 13, color: C.mid, marginBottom: 10 }}>{lesson.subtitle}</div>}
        {lesson.desc && <div style={{ fontSize: 13, color: '#9a9a9a', lineHeight: 1.6, marginBottom: 12 }}>{lesson.desc}</div>}
        {lesson.concepts?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>{lesson.concepts.map(k => <span key={k} style={chip}>{k}</span>)}</div>}
        <div style={{ fontSize: 12, color: status === 'done' ? C.ok : C.dim, marginBottom: 12 }}>
          {status === 'done' ? `✓ Complete · quiz best ${Math.round((p.quiz?.best || 0) * 100)}%`
            : `${readCount}/${doc.parts.length} parts read · ${p.quiz ? `last quiz ${p.quiz.score}/${p.quiz.of}` : 'quiz not taken'}`}
        </div>
        <button style={{ ...btnP, width: '100%', marginBottom: 8 }} onClick={primary[1]}>{primary[0]}</button>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {status !== 'quiz' && <button style={{ ...btnG, flex: 1, fontSize: 13 }} onClick={() => setMode('quiz')}>{status === 'done' ? 'Quiz again' : 'Quiz me'}</button>}
          {fx > 0 && <button style={{ ...btnG, flex: 1, fontSize: 13, color: C.acc2, borderColor: '#2a2040' }} onClick={() => setMode('formulas')}><span style={{ fontFamily: mono }}>ƒ</span> {fx} formulas</button>}
        </div>
        <div style={label}>Parts · {doc.words.toLocaleString()} words</div>
        <div style={card}>
          {doc.parts.map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < doc.parts.length - 1 ? '1px solid #161616' : 'none' }}>
              <div onClick={() => onStart(doc, i)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                <StatusDot status={p.parts?.[i] ? 'done' : 'new'} size={18} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: C.txt, lineHeight: 1.35 }}>{x.title}</div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{mins(x.words, wpm)} min{x.formulas?.length ? ` · ${x.formulas.length} formulas` : ''}</div>
                </div>
              </div>
              <button onClick={() => { setSrcPart(i); setMode('source'); }} style={{ background: 'none', border: `1px solid ${C.bd}`, color: '#666', borderRadius: 10, fontSize: 11, padding: '6px 9px', cursor: 'pointer' }}>Text</button>
            </div>
          ))}
        </div>
        {doc.further?.length > 0 && <>
          <div style={label}>Further reading</div>
          <div style={{ ...card, padding: '4px 14px' }}>
            {doc.further.map((f, i) => <div key={i} style={{ padding: '10px 0', borderBottom: i < doc.further.length - 1 ? '1px solid #161616' : 'none', fontSize: 13, color: C.acc2 }}>{f.title}{f.note && <div style={{ fontSize: 12, color: C.dim, marginTop: 3, lineHeight: 1.5 }}>{f.note}</div>}</div>)}
          </div>
        </>}
        {sourceUrl(course, lesson) && <a href={sourceUrl(course, lesson)} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', fontSize: 12, color: C.acc2, textDecoration: 'none', padding: '6px 0 10px' }}>Open original ↗</a>}
        {(readCount > 0 || p.quiz) && <div onClick={() => resetLesson(course.id, lesson.id)} style={{ textAlign: 'center', fontSize: 11, color: '#3a3a3a', cursor: 'pointer', padding: 6 }}>Reset progress for this lesson</div>}
      </>
    );
  }
  return <Sheet open onClose={onClose} title={course.title}>{body}</Sheet>;
}

// ---------------------------------------------------------------------
// New course sheet: AI-generated or an existing library (GitHub markdown)
// ---------------------------------------------------------------------
function NewCourseSheet({ onClose, onCreated }) {
  const [kind, setKind] = useState('ai');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('intermediate');
  const [size, setSize] = useState('standard');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState(null);
  const go = async () => {
    setBusy(true); setErr('');
    try { setDraft(kind === 'ai' ? await buildAiCourse({ topic, level, size }) : await buildGithubCourse(url)); }
    catch (e) { setErr(e.message || 'Something went wrong'); }
    setBusy(false);
  };
  if (draft) return (
    <Sheet open onClose={onClose} title="Preview">
      <div style={{ fontSize: 19, color: '#f0f0f0', marginBottom: 4 }}>{draft.title}</div>
      <div style={{ fontSize: 13, color: C.mid, marginBottom: 14, lineHeight: 1.5 }}>{draft.subtitle}</div>
      <div style={{ ...card, padding: '4px 14px' }}>
        {draft.units.map((u, i) => (
          <div key={u.id} style={{ padding: '10px 0', borderBottom: i < draft.units.length - 1 ? '1px solid #161616' : 'none' }}>
            <div style={{ fontSize: 13, color: C.txt, marginBottom: 6 }}><span style={{ fontFamily: mono, color: '#555', marginRight: 8 }}>{u.tag}</span>{u.title}</div>
            {u.lessons.slice(0, 12).map(l => <div key={l.id} style={{ fontSize: 12, color: '#777', padding: '2px 0 2px 26px' }}>{l.title}</div>)}
            {u.lessons.length > 12 && <div style={{ fontSize: 12, color: '#444', padding: '2px 0 2px 26px' }}>+{u.lessons.length - 12} more</div>}
          </div>
        ))}
      </div>
      <button style={{ ...btnP, width: '100%', marginBottom: 8 }} onClick={() => { saveCourse(draft); onCreated(draft.id); }}>{kind === 'ai' ? 'Start this course' : 'Add course'}</button>
      <button style={{ ...btnG, width: '100%' }} onClick={() => setDraft(null)}>{kind === 'ai' ? 'Change & regenerate' : 'Back'}</button>
    </Sheet>
  );
  const Seg = ({ val, set, opts }) => <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>{opts.map(([id, l]) => <button key={id} style={val === id ? pillOn : pill} onClick={() => set(id)}>{l}</button>)}</div>;
  return (
    <Sheet open onClose={onClose} title="New course">
      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#0a0a0a', border: `1px solid ${C.bd}`, borderRadius: 12, marginBottom: 16 }}>
        {[['ai', 'Generate with AI'], ['github', 'Add a library']].map(([id, l]) => <button key={id} onClick={() => { setKind(id); setErr(''); }} style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: 9, fontSize: 13, cursor: 'pointer', background: kind === id ? C.acc : 'transparent', color: kind === id ? '#fff' : '#777' }}>{l}</button>)}
      </div>
      {kind === 'ai' ? <>
        <div style={label}>Topic</div>
        <textarea style={{ ...field, minHeight: 72, resize: 'none', marginBottom: 14 }} placeholder="e.g. Credit cycles and distressed debt investing" value={topic} onChange={e => setTopic(e.target.value)} />
        <div style={label}>Level</div>
        <Seg val={level} set={setLevel} opts={[['intro', 'Intro'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]} />
        <div style={label}>Length</div>
        <Seg val={size} set={setSize} opts={[['short', '6 lessons'], ['standard', '12 lessons'], ['deep', '18 lessons']]} />
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, marginBottom: 14 }}>You'll see the outline before anything is saved. Lessons are written the first time you open them.</div>
        <button style={{ ...btnP, width: '100%' }} disabled={busy || topic.trim().length < 3} onClick={go}>{busy ? 'Designing outline…' : 'Generate outline'}</button>
      </> : <>
        <div style={label}>GitHub repo or folder</div>
        <input style={{ ...field, marginBottom: 10 }} placeholder="github.com/owner/repo" value={url} onChange={e => setUrl(e.target.value)} autoCapitalize="off" autoCorrect="off" />
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: 14 }}>Any public repo of Markdown files works. Folders become units, files become lessons, <span style={{ fontFamily: mono }}>##</span> headings become parts. Link a sub-folder (…/tree/main/docs) to narrow it.</div>
        <button style={{ ...btnP, width: '100%' }} disabled={busy || !url.trim()} onClick={go}>{busy ? 'Reading repo…' : 'Preview course'}</button>
      </>}
      {err && <div style={{ color: '#e05252', fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>{err}</div>}
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Course page: Continue + units accordion. Lessons open as a sheet.
// ---------------------------------------------------------------------
function CoursePage({ course, store, wpm, onBack, onStartLesson, openLessonId, clearOpenLesson }) {
  const [sheet, setSheet] = useState(null);
  const [filter, setFilter] = useState('all');
  const nl = nextLesson(store, course);
  const [open, setOpen] = useState(() => new Set([course.units.find(u => u.lessons.some(l => l.id === nl?.id))?.id || course.units[0]?.id]));
  useEffect(() => {
    if (!openLessonId) return;
    const l = allLessons(course).find(x => x.id === openLessonId);
    if (l) setSheet(l);
    clearOpenLesson?.();
  }, [openLessonId]);
  const { done, total } = courseCounts(store, course);
  const toggle = id => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const startNext = () => { const l = nextLesson(store, course); if (l) onStartLesson(course, l); };
  const after = (lesson) => { const ls = allLessons(course); return ls[ls.findIndex(l => l.id === lesson.id) + 1]; };

  return (
    <div>
      <div onClick={onBack} style={{ color: C.acc2, fontSize: 13, padding: '2px 4px 12px', cursor: 'pointer' }}>‹ Courses</div>
      <div style={{ ...card, padding: 18, background: '#0f0e1a', borderColor: '#2a2040' }}>
        <div style={{ fontSize: 10, color: '#6a5fb0', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{SRC_LABEL[course.source]}</div>
        <div style={{ fontSize: 20, color: '#ece8ff', lineHeight: 1.25, marginBottom: 4 }}>{course.title}</div>
        <div style={{ fontSize: 12, color: '#6a6090', marginBottom: 14, lineHeight: 1.5 }}>{course.subtitle}</div>
        <Bar v={total ? done / total : 0} />
        <div style={{ fontSize: 11, color: '#6a6090', margin: '6px 0 14px' }}>{done} of {total} lessons complete</div>
        {nl ? (
          <button style={{ ...btnP, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }} onClick={startNext}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{done || lessonStatus(store, course.id, nl) !== 'new' ? 'Continue' : 'Start'} · {nl.title}</span><span>›</span>
          </button>
        ) : <div style={{ textAlign: 'center', color: C.ok, fontSize: 14 }}>✓ Course complete</div>}
      </div>

      {course.filters?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
          {[{ id: 'all', label: 'All' }, ...course.filters].map(f => <button key={f.id} style={filter === f.id ? pillOn : pill} onClick={() => { setFilter(f.id); if (f.id !== 'all') setOpen(new Set(course.units.map(u => u.id))); }}>{f.label}</button>)}
        </div>
      )}

      <div style={card}>
        {course.units.map((u, ui) => {
          const lessons = filter === 'all' ? u.lessons : u.lessons.filter(l => l.tags?.includes(filter));
          if (!lessons.length) return null;
          const d = lessons.filter(l => lessonStatus(store, course.id, l) === 'done').length;
          const isOpen = open.has(u.id);
          return (
            <div key={u.id} style={{ borderBottom: ui < course.units.length - 1 ? '1px solid #161616' : 'none' }}>
              <div onClick={() => toggle(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ fontFamily: mono, fontSize: 13, color: d === lessons.length ? C.acc2 : '#444', width: 22 }}>{u.tag}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: C.txt }}>{u.title}</div>
                  {!isOpen && u.subtitle && <div style={{ fontSize: 12, color: C.dim, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.subtitle}</div>}
                </div>
                <div style={{ fontSize: 11, color: '#444' }}>{d}/{lessons.length}</div>
                <div style={{ color: '#444', fontSize: 12, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</div>
              </div>
              {isOpen && lessons.map(l => {
                const st = lessonStatus(store, course.id, l), isNext = l.id === nl?.id;
                return (
                  <div key={l.id} onClick={() => setSheet(l)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px 11px 50px', cursor: 'pointer', background: isNext ? '#13112a' : 'transparent' }}>
                    <StatusDot status={st} size={18} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: st === 'done' ? '#8a8a8a' : C.txt, lineHeight: 1.35 }}>{l.title}</div>
                      {(l.subtitle || st === 'quiz') && <div style={{ fontSize: 11, color: st === 'quiz' ? C.acc2 : C.dim, marginTop: 2 }}>{st === 'quiz' ? 'Quiz to finish' : l.subtitle}</div>}
                    </div>
                    {isNext && <div style={{ fontSize: 10, color: C.acc2, letterSpacing: 1 }}>NEXT</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {course.upcoming?.length > 0 && <>
        <div style={label}>Coming to this library</div>
        <div style={{ ...card, padding: '4px 16px' }}>{course.upcoming.map((b, i) => <div key={i} style={{ padding: '9px 0', fontSize: 13, color: '#777', borderBottom: i < course.upcoming.length - 1 ? '1px solid #161616' : 'none' }}>{b.title} <span style={{ color: '#444' }}>· {b.author}</span></div>)}</div>
      </>}
      {course.attribution && <div style={{ fontSize: 10, color: '#3a3a3a', textAlign: 'center', lineHeight: 1.6, padding: '4px 12px 10px' }}>
        {course.attribution.url ? <a href={course.attribution.url} target="_blank" rel="noreferrer" style={{ color: '#444' }}>{course.attribution.text}</a> : course.attribution.text}
      </div>}
      {!course.builtin && <div onClick={() => { if (confirm(`Delete "${course.title}" and its progress?`)) { deleteCourse(course.id); onBack(); } }} style={{ textAlign: 'center', fontSize: 12, color: '#5a2a2a', cursor: 'pointer', padding: 8 }}>Delete course</div>}

      {sheet && <LessonSheet course={course} lesson={sheet} store={store} wpm={wpm} onClose={() => setSheet(null)}
        onStart={(doc, part) => { setSheet(null); onStartLesson(course, sheet, part, doc); }}
        onNextLesson={() => { const n = after(sheet); setSheet(n || null); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------
// Learn tab root
// ---------------------------------------------------------------------
export default function LearnTab({ wpm, view, setView, session, onResume, onStartLesson }) {
  const store = useStore();
  const [courses, setCourses] = useState({}); // id -> loaded course
  const [errs, setErrs] = useState({});
  const [newOpen, setNewOpen] = useState(false);
  const list = listCourses(store);
  const ids = list.map(c => c.id).join('|');

  useEffect(() => {
    list.forEach(c => {
      loadCourse(c.id).then(full => setCourses(m => ({ ...m, [c.id]: full }))).catch(e => setErrs(m => ({ ...m, [c.id]: e.message })));
    });
  }, [ids]);

  const active = view?.courseId && courses[view.courseId];
  if (view?.courseId) {
    if (!active) return errs[view.courseId]
      ? <div style={{ padding: 40, textAlign: 'center', color: '#666', fontSize: 14 }}>{errs[view.courseId]}<div><button style={{ ...btnG, marginTop: 14 }} onClick={() => setView(null)}>Back</button></div></div>
      : <div style={{ padding: 48, textAlign: 'center', color: '#333', fontSize: 14, animation: 'pulse 1.4s infinite' }}>Loading course…</div>;
    return <CoursePage course={active} store={store} wpm={wpm} onBack={() => setView(null)} onStartLesson={onStartLesson}
      openLessonId={view.lessonId} clearOpenLesson={() => setView({ courseId: view.courseId })} />;
  }

  const recent = courses[store.recent] || null;
  const recentNext = recent && nextLesson(store, recent);
  return (
    <div style={{ paddingBottom: 12 }}>
      {session && (
        <div onClick={onResume} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderColor: '#2a2040' }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: C.acc, boxShadow: `0 0 8px ${C.acc}` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.dim }}>In progress · part {session.part + 1} of {session.doc.parts.length}</div>
            <div style={{ fontSize: 14, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.lesson.title}</div>
          </div>
          <div style={{ color: C.acc2, fontSize: 13 }}>Resume ›</div>
        </div>
      )}

      {recent && recentNext && !session && (
        <div style={{ ...card, padding: 18, background: '#0f0e1a', borderColor: '#2a2040' }}>
          <div style={{ fontSize: 10, color: '#6a5fb0', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Up next · {recent.title}</div>
          <div style={{ fontSize: 18, color: '#ece8ff', lineHeight: 1.3, marginBottom: 14 }}>{recentNext.title}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btnP, flex: 1 }} onClick={() => onStartLesson(recent, recentNext)}>Continue</button>
            <button style={btnG} onClick={() => setView({ courseId: recent.id })}>Course</button>
          </div>
        </div>
      )}

      <div style={{ ...label, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Courses</span>
      </div>
      <div style={card}>
        {list.map((c, i) => {
          const full = courses[c.id];
          const cnt = full ? courseCounts(store, full) : null;
          return (
            <div key={c.id} onClick={() => setView({ courseId: c.id })} style={{ padding: '14px 16px', borderBottom: i < list.length - 1 ? '1px solid #161616' : 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                <div style={{ fontSize: 15, color: C.txt, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>{SRC_LABEL[c.source]}</div>
              </div>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subtitle}</div>
              {cnt ? <><Bar v={cnt.total ? cnt.done / cnt.total : 0} /><div style={{ fontSize: 11, color: '#444', marginTop: 5 }}>{cnt.done}/{cnt.total} lessons</div></>
                : <div style={{ fontSize: 11, color: errs[c.id] ? '#7a3a3a' : '#333' }}>{errs[c.id] || 'Loading…'}</div>}
            </div>
          );
        })}
      </div>
      <button style={{ ...btnG, width: '100%', borderStyle: 'dashed', color: C.acc2, borderColor: '#2a2040' }} onClick={() => setNewOpen(true)}>+ New course</button>

      {newOpen && <NewCourseSheet onClose={() => setNewOpen(false)} onCreated={id => { setNewOpen(false); setView({ courseId: id }); }} />}
    </div>
  );
}
