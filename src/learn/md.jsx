import React from 'react';

// Markdown → RSVP plain text, section split, formula extraction, and a safe
// React renderer for the original source (formulas, tables, lists intact).

const C = { acc: '#7c6af7', acc2: '#8b7fff' };

// ---------- MDX → sections of plain text ----------
export const MATHY = /[=~≈≥≤<>σμαβγδεθλρΣ∑∫√∂^]|_\{|\b(exp|log|ln|Var|Cov|E)\(|\bE\[/;
// A bare line like "dX(t) = theta * (mu - X(t)) * dt + sigma * dW(t)" — formula, not prose
export function isFormulaLine(t) {
  t = t.replace(/^\*\*|\*\*$/g, '').trim();
  if (!/=/.test(t) || t.length > 180 || /^[-*+>|#]/.test(t) || /\.$/.test(t)) return false;
  if (!/[*()^_\[\]σμαβλΣ√/]/.test(t)) return false;
  const words = t.match(/\b[a-z]{4,}\b/g) || [];
  return words.filter(w => !/^(theta|sigma|alpha|beta|gamma|delta|lambda|epsilon|kappa|sqrt|price|cost|flow|order|quantity|imbalance|portfolio|return|rate|time|sum|mean|var)$/i.test(w)).length <= 3;
}
export function extractFormulas(md) {
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

export function mdInline(s) {
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
export function mdToText(md) {
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
export function parseDoc(md) {
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

// ---------- source renderer: original markdown, formulas/tables intact ----------
const mono = "'JetBrains Mono',monospace";
function Inline({ t, linkBase }) {
  const parts = []; let rest = t, k = 0;
  const re = /`([^`]+)`|\*\*(.+?)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)]+)\)/;
  while (rest) {
    const m = rest.match(re);
    if (!m) { parts.push(rest.replace(/ -- /g, ' — ')); break; }
    if (m.index) parts.push(rest.slice(0, m.index).replace(/ -- /g, ' — '));
    if (m[1] != null) parts.push(<code key={k++} style={{ fontFamily: mono, fontSize: '0.88em', background: '#16142a', color: '#c9c0ff', padding: '1px 5px', borderRadius: 5, wordBreak: 'break-word' }}>{m[1]}</code>);
    else if (m[2] != null) parts.push(<strong key={k++} style={{ color: '#e8e8e8', fontWeight: 500 }}><Inline t={m[2]} linkBase={linkBase} /></strong>);
    else if (m[3] != null) parts.push(<em key={k++}>{m[3]}</em>);
    else { const href = m[5].startsWith('/') && linkBase ? linkBase + m[5] : m[5]; parts.push(<a key={k++} href={href} target="_blank" rel="noreferrer" style={{ color: C.acc2 }}>{m[4]}</a>); }
    rest = rest.slice(m.index + m[0].length);
  }
  return <>{parts}</>;
}
export function MdView({ md, linkBase }) {
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
        {rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ border: '1px solid #222', padding: '6px 8px', background: ri === 0 ? '#151515' : 'transparent', color: ri === 0 ? '#ddd' : undefined, verticalAlign: 'top' }}><Inline linkBase={linkBase} t={c} /></td>)}</tr>)}
      </tbody></table></div>);
      continue;
    }
    if (isFormulaLine(t)) { out.push(<div key={k++} style={{ fontFamily: mono, fontSize: 12.5, color: '#c9c0ff', background: '#0b0a14', border: '1px solid #2a2040', borderRadius: 10, padding: '9px 12px', margin: '0 0 10px', overflowX: 'auto', whiteSpace: 'nowrap' }}>{t.replace(/^\*\*|\*\*$/g, '').replace(/`/g, '')}</div>); i++; continue; }
    const h = t.match(/^(#{2,6})\s+(.*)/);
    if (h) { out.push(<div key={k++} style={{ fontSize: 14, color: '#e8e8e8', fontWeight: 500, margin: '14px 0 8px' }}><Inline linkBase={linkBase} t={h[2]} /></div>); i++; continue; }
    if (/^([-*+]|\d+\.)\s/.test(t)) {
      const ordered = /^\d+\./.test(t), items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s/.test(lines[i])) items.push(lines[i++].trim().replace(/^([-*+]|\d+\.)\s+/, ''));
      const L = ordered ? 'ol' : 'ul';
      out.push(<L key={k++} style={{ ...P, paddingLeft: 20 }}>{items.map((x, xi) => <li key={xi} style={{ marginBottom: 4 }}><Inline linkBase={linkBase} t={x} /></li>)}</L>);
      continue;
    }
    if (t.startsWith('>')) { out.push(<div key={k++} style={{ ...P, borderLeft: `2px solid ${C.acc}`, paddingLeft: 10, fontStyle: 'italic' }}><Inline linkBase={linkBase} t={t.replace(/^>\s?/, '')} /></div>); i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(\||#|```|>|[-*+]\s|\d+\.\s)/.test(lines[i].trim()) && !(para.length && isFormulaLine(lines[i].trim()))) para.push(lines[i++].trim());
    if (!para.length) { i++; continue; }
    out.push(<p key={k++} style={P}><Inline linkBase={linkBase} t={para.join(' ')} /></p>);
  }
  return <div>{out}</div>;
}

