import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PASS } from './courses.js';

export const C = { bg: '#111111', bd: '#1a1a1a', acc: '#7c6af7', acc2: '#8b7fff', dim: '#555', mid: '#888', txt: '#e0e0e0', ok: '#50d89a' };
export const mono = "'JetBrains Mono',monospace";
export const card = { background: C.bg, borderRadius: 16, border: `1px solid ${C.bd}`, overflow: 'hidden', marginBottom: 12 };
export const label = { fontSize: 10, color: '#c0c0c0', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, padding: '0 4px 8px' };
export const pill = { padding: '7px 14px', border: `1px solid ${C.bd}`, borderRadius: 20, fontSize: 12, cursor: 'pointer', background: 'transparent', color: '#c0c0c0', whiteSpace: 'nowrap' };
export const pillOn = { ...pill, background: C.acc, color: '#fff', border: `1px solid ${C.acc}` };
export const chip = { fontSize: 11, padding: '4px 10px', borderRadius: 12, background: '#16142a', color: '#a99fff', border: '1px solid #2a2040' };
export const btnP = { padding: '13px 18px', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer', background: C.acc, color: '#fff', minHeight: 46 };
export const btnG = { padding: '12px 16px', border: `1px solid ${C.bd}`, borderRadius: 12, fontSize: 14, fontWeight: 300, cursor: 'pointer', background: 'transparent', color: '#c0c0c0', minHeight: 46 };
export const field = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: '#080808', color: '#d8d8d8', border: `1px solid ${C.bd}`, borderRadius: 12, fontSize: 16, outline: 'none', WebkitAppearance: 'none' };
export const mins = (w, wpm) => Math.max(1, Math.round(w / (wpm || 300)));

export const Bar = ({ v, h = 3 }) => (
  <div style={{ height: h, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
    <div style={{ width: `${Math.round(Math.min(1, v) * 100)}%`, height: '100%', background: C.acc, transition: 'width .3s' }} />
  </div>
);

// ✓ done · ? quiz pending · ◐ started · ○ new
export function StatusDot({ status, size = 22 }) {
  const s = { width: size, height: size, borderRadius: size / 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, boxSizing: 'border-box' };
  if (status === 'done') return <div style={{ ...s, background: C.acc, color: '#fff' }}>✓</div>;
  if (status === 'quiz') return <div style={{ ...s, border: `1.5px solid ${C.acc}`, color: C.acc2, fontFamily: mono }}>?</div>;
  if (status === 'started') return <div style={{ ...s, border: '1.5px solid #4a3f8a', background: 'linear-gradient(90deg,#4a3f8a 50%,transparent 50%)' }} />;
  return <div style={{ ...s, border: '1.5px solid #2a2a2a' }} />;
}

export function Sheet({ open, onClose, children, title }) {
  useEffect(() => {
    if (!open) return;
    const k = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  // Portal: ancestors use transform animations, which would trap position:fixed
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn .15s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#101010', borderRadius: '22px 22px 0 0', border: `1px solid ${C.bd}`, borderBottom: 'none', width: '100%', maxWidth: 560, maxHeight: '88dvh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 6px', flexShrink: 0 }}>
          <div style={{ flex: 1, fontSize: 12, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 36, height: 4, borderRadius: 2, background: '#2a2a2a' }} />
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#666', fontSize: 22, cursor: 'pointer', padding: '4px 4px 4px 12px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 16px 20px' }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

async function fetchQuiz(text) {
  const r = await fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 8000) }) });
  if (!r.ok) throw new Error('quiz ' + r.status);
  const d = await r.json();
  if (!Array.isArray(d?.questions)) throw new Error('quiz');
  return d.questions;
}

// One question at a time. onFinish(score, of) fires once; `after(score, of, passed)` renders the result actions.
export function Quiz({ text, onFinish, after }) {
  const [qs, setQs] = useState(null);
  const [state, setState] = useState('loading');
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [score, setScore] = useState(0);
  const run = async () => {
    setState('loading'); setI(0); setPick(null); setScore(0);
    try { setQs(await fetchQuiz(text)); setState('q'); } catch { setState('error'); }
  };
  useEffect(() => { run(); }, [text]);

  if (state === 'loading') return <div style={{ padding: '40px 0', textAlign: 'center', color: '#555', fontSize: 13, animation: 'pulse 1.4s infinite' }}>Writing questions…</div>;
  if (state === 'error') return <div style={{ padding: '24px 0', textAlign: 'center' }}><div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>Couldn't generate a quiz.</div><button style={btnG} onClick={run}>Try again</button></div>;
  if (state === 'done') {
    const passed = score / qs.length >= PASS;
    return (
      <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
        <div style={{ fontSize: 40, color: passed ? C.ok : '#e0a052', fontFamily: mono, marginBottom: 6 }}>{score}/{qs.length}</div>
        <div style={{ fontSize: 15, color: C.txt, marginBottom: 4 }}>{passed ? 'Lesson complete' : 'Not quite'}</div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 20 }}>{passed ? 'Nice — progress saved.' : `${Math.ceil(PASS * qs.length)} of ${qs.length} needed to complete the lesson.`}</div>
        {after?.(score, qs.length, passed, run)}
      </div>
    );
  }
  const q = qs[i], shown = pick !== null;
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>{qs.map((_, k) => <div key={k} style={{ flex: 1, height: 3, borderRadius: 2, background: k < i ? C.acc : k === i ? '#4a3f8a' : '#1e1e1e' }} />)}</div>
      <div style={{ fontSize: 16, color: '#ececec', lineHeight: 1.5, marginBottom: 14 }}>{q.q}</div>
      {q.choices.map((c, j) => {
        const right = j === q.answer, mine = pick === j;
        const bg = shown && right ? '#13261a' : mine ? '#2a1414' : '#0b0b0b';
        const bc = shown && right ? '#2f6b42' : mine ? '#6b2f2f' : C.bd;
        return <div key={j} onClick={() => { if (shown) return; setPick(j); if (right) setScore(s => s + 1); }} style={{ padding: '13px 14px', marginBottom: 8, borderRadius: 12, border: `1px solid ${bc}`, background: bg, fontSize: 14, color: '#cfcfcf', lineHeight: 1.45, cursor: shown ? 'default' : 'pointer' }}>{c}</div>;
      })}
      {shown && <button style={{ ...btnP, width: '100%', marginTop: 6 }} onClick={() => {
        if (i + 1 < qs.length) { setI(i + 1); setPick(null); }
        else { setState('done'); onFinish?.(score, qs.length); }
      }}>{i + 1 < qs.length ? 'Next question' : 'See result'}</button>}
    </div>
  );
}

export function FormulaSheet({ doc, onOpenPart }) {
  const groups = doc.parts.map((p, i) => ({ p, i })).filter(x => x.p.formulas?.length);
  if (!groups.length) return <div style={{ color: C.dim, fontSize: 13, padding: '8px 0' }}>No formulas in this lesson.</div>;
  return groups.map(({ p, i }) => (
    <div key={i} style={{ padding: '8px 0 6px', borderBottom: '1px solid #161616' }}>
      <div onClick={() => onOpenPart?.(i)} style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, cursor: onOpenPart ? 'pointer' : 'default' }}>{p.title}{onOpenPart ? ' ›' : ''}</div>
      {p.formulas.map((f, j) => <div key={j} style={{ fontFamily: mono, fontSize: 12, color: '#c9c0ff', background: '#0b0a14', border: '1px solid #1e1a33', borderRadius: 8, padding: '7px 10px', marginBottom: 6, whiteSpace: f.block ? 'pre' : 'normal', overflowX: 'auto', wordBreak: 'break-word' }}>{f.code}</div>)}
    </div>
  ));
}
