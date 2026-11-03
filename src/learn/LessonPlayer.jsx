import React, { useState } from 'react';
import { getStore, lessonProgress, lessonAfter, recordQuiz, quizText, sourceUrl, linkBase } from './courses.js';
import { MdView } from './md.jsx';
import { C, mono, btnP, btnG, Sheet, Quiz, FormulaSheet } from './ui.jsx';

// Replaces the Paste/URL card while a lesson is playing in the Reader.
export function LessonHeader({ session, className, onCourse, onExit, onNotes, onJump }) {
  const { course, lesson, doc, part } = session;
  const read = lessonProgress(getStore(), course.id, lesson.id).parts || {};
  const hasFx = doc.parts.some(p => p.formulas?.length);
  return (
    <div className={className} style={{ background: '#111', borderRadius: 16, border: '1px solid #1a1a1a', padding: '12px 14px 12px', marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button onClick={onCourse} style={{ background: 'none', border: 'none', color: C.acc2, fontSize: 13, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}>‹ Course</button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{course.title}</div>
          <div style={{ fontSize: 13, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lesson.title}</div>
        </div>
        <button onClick={onNotes} aria-label="Notes" style={{ background: 'none', border: `1px solid ${hasFx ? '#2a2040' : '#1a1a1a'}`, color: hasFx ? C.acc2 : '#666', borderRadius: 10, fontSize: 12, padding: '5px 9px', cursor: 'pointer', fontFamily: hasFx ? mono : 'inherit' }}>{hasFx ? 'ƒ' : 'Text'}</button>
        <button onClick={onExit} aria-label="Exit lesson" style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {doc.parts.map((p, i) => (
          <div key={i} onClick={() => onJump(i)} title={p.title} style={{ flex: Math.max(1, p.words), height: 14, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: '100%', height: i === part ? 4 : 3, borderRadius: 2, background: i === part ? C.acc : read[i] ? '#4a3f8a' : '#222' }} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#666', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Part {part + 1} of {doc.parts.length} · {doc.parts[part].title}</div>
    </div>
  );
}

// Shown in the reader stage when a part finishes. Primary action sits on the right/bottom for one thumb.
export function LessonEnd({ session, onNext, onReread, onQuiz, onCourse }) {
  const { doc, part } = session;
  const last = part >= doc.parts.length - 1;
  const stop = e => e.stopPropagation();
  return (
    <div onPointerDown={stop} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch', position: 'relative', zIndex: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <div style={{ color: C.ok, fontSize: 13, marginBottom: 6 }}>✓ {last ? 'Lesson read' : `Part ${part + 1} of ${doc.parts.length} done`}</div>
        <div style={{ color: '#ddd', fontSize: 16, lineHeight: 1.35 }}>{last ? 'Take the quiz to complete it' : `Next: ${doc.parts[part + 1].title}`}</div>
      </div>
      <button style={btnP} onClick={last ? onQuiz : onNext}>{last ? 'Take quiz' : 'Next part ›'}</button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...btnG, flex: 1, fontSize: 13 }} onClick={onReread}>Reread</button>
        {!last && <button style={{ ...btnG, flex: 1, fontSize: 13 }} onClick={onQuiz}>Quiz now</button>}
        <button style={{ ...btnG, flex: 1, fontSize: 13 }} onClick={onCourse}>Course</button>
      </div>
    </div>
  );
}

// Quiz + notes overlays for the reader session.
export function LessonSheets({ session, sheet, setSheet, onStartPart, onNextLesson, onCourse }) {
  const [srcPart, setSrcPart] = useState(null);
  if (!sheet || !session) return null;
  const { course, lesson, doc, part } = session;
  if (sheet === 'quiz') {
    const next = lessonAfter(course, lesson.id);
    return (
      <Sheet open onClose={() => setSheet(null)} title={`Quiz · ${lesson.title}`}>
        <Quiz text={quizText(doc)} onFinish={(s, of) => recordQuiz(course.id, lesson.id, s, of)}
          after={(s, of, passed, retry) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {passed
                ? (next ? <button style={btnP} onClick={() => { setSheet(null); onNextLesson(next); }}>Next lesson · {next.title}</button>
                  : <button style={btnP} onClick={() => { setSheet(null); onCourse(); }}>Course complete — back to course</button>)
                : <button style={btnP} onClick={() => { setSheet(null); onStartPart(0); }}>Reread from the start</button>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...btnG, flex: 1 }} onClick={retry}>{passed ? 'New questions' : 'Retry quiz'}</button>
                <button style={{ ...btnG, flex: 1 }} onClick={() => { setSheet(null); onCourse(); }}>Course</button>
              </div>
            </div>
          )} />
      </Sheet>
    );
  }
  // notes: current part's source text + the lesson formula sheet
  const sp = srcPart ?? part;
  const url = sourceUrl(course, lesson, doc.parts[sp]?.title);
  const hasFx = doc.parts.some(p => p.formulas?.length);
  return (
    <Sheet open onClose={() => { setSheet(null); setSrcPart(null); }} title={lesson.title}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => setSrcPart(null) || setSheet('notes')} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: `1px solid ${sheet === 'notes' ? C.acc : '#1a1a1a'}`, background: sheet === 'notes' ? C.acc : 'transparent', color: sheet === 'notes' ? '#fff' : '#c0c0c0' }}>This part</button>
        {hasFx && <button onClick={() => setSheet('formulas')} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: `1px solid ${sheet === 'formulas' ? C.acc : '#1a1a1a'}`, background: sheet === 'formulas' ? C.acc : 'transparent', color: sheet === 'formulas' ? '#fff' : '#c0c0c0' }}><span style={{ fontFamily: mono }}>ƒ</span> Formula sheet</button>}
      </div>
      {sheet === 'formulas'
        ? <FormulaSheet doc={doc} onOpenPart={i => { setSrcPart(i); setSheet('notes'); }} />
        : <>
          <div style={{ fontSize: 15, color: '#eee', marginBottom: 10 }}>{doc.parts[sp].title}</div>
          <MdView md={doc.parts[sp].md} linkBase={linkBase(course)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {sp !== part && <button style={{ ...btnP, flex: 1 }} onClick={() => { setSheet(null); setSrcPart(null); onStartPart(sp); }}>Read this part</button>}
            {url && <a href={url} target="_blank" rel="noreferrer" style={{ ...btnG, flex: sp === part ? 1 : 0, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>Source ↗</a>}
          </div>
        </>}
    </Sheet>
  );
}
