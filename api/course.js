// Serverless course generator for the Learn tab.
//   POST { action: 'outline', topic, level, size }  -> { outline: { title, subtitle, units: [{ title, summary, lessons: [{ title, summary, concepts }] }] } }
//   POST { action: 'lesson', course, unit, lesson, outline } -> { markdown }
// Keeps ANTHROPIC_API_KEY server-side; same origin lock as /api/questions.
// Model can be overridden with COURSE_MODEL in the Vercel project settings.

const MODEL = process.env.COURSE_MODEL || 'claude-haiku-4-5-20251001';

function hostOf(v) { try { return new URL(v).hostname.toLowerCase(); } catch { return ''; } }
const EXTRA_HOSTS = (process.env.ALLOWED_ORIGIN_HOSTS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
function isAllowedHost(h) {
  return h === 'myspeedr.vercel.app' || h === 'localhost' || h === '127.0.0.1' || EXTRA_HOSTS.includes(h);
}

const SIZES = { short: [3, 2], standard: [4, 3], deep: [6, 3] }; // [units, lessons per unit]
const LEVELS = { intro: 'a curious beginner with no background', intermediate: 'someone with working knowledge who wants depth', advanced: 'an experienced practitioner who wants rigor, nuance and formulas where relevant' };
const clip = (s, n) => (s == null ? '' : String(s)).slice(0, n);

async function claude(key, prompt, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error('Anthropic API error'), { detail: data });
  return (data.content || []).map(b => b.text || '').join('');
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = isAllowedHost(hostOf(origin)) || isAllowedHost(hostOf(req.headers.referer || ''));
  res.setHeader('Access-Control-Allow-Origin', allowed && origin ? origin : 'https://myspeedr.vercel.app');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!allowed) { res.status(403).json({ error: 'Forbidden' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  try {
    if (body.action === 'outline') {
      const topic = clip(body.topic, 300).trim();
      if (topic.length < 3) { res.status(400).json({ error: 'Topic is too short' }); return; }
      const [nu, nl] = SIZES[body.size] || SIZES.standard;
      const audience = LEVELS[body.level] || LEVELS.intermediate;
      const out = await claude(key,
        `Design a self-study course on: "${topic}".\nAudience: ${audience}.\n` +
        `Structure: exactly ${nu} units, each with ${nl} lessons, in a logical learning progression (foundations first, applications last). ` +
        `Each lesson is a ~5-minute read.\n` +
        `Output ONLY JSON (no prose, no code fences) of this shape:\n` +
        `{"title":"short course title","subtitle":"one line","units":[{"title":"...","summary":"one sentence","lessons":[{"title":"...","summary":"one sentence on what the reader will understand","concepts":["2-4 key terms"]}]}]}`,
        2000);
      const m = out.match(/\{[\s\S]*\}/);
      const o = m ? JSON.parse(m[0]) : null;
      if (!o || !Array.isArray(o.units) || !o.units.length || !o.units.every(u => Array.isArray(u.lessons) && u.lessons.length)) {
        res.status(502).json({ error: 'Could not build an outline — try rephrasing the topic' }); return;
      }
      o.units = o.units.slice(0, 8).map(u => ({ title: clip(u.title, 120), summary: clip(u.summary, 300),
        lessons: u.lessons.slice(0, 8).map(l => ({ title: clip(l.title, 140), summary: clip(l.summary, 300), concepts: (Array.isArray(l.concepts) ? l.concepts : []).slice(0, 5).map(c => clip(c, 60)) })) }));
      res.status(200).json({ outline: { title: clip(o.title, 120) || topic, subtitle: clip(o.subtitle, 200), units: o.units } });
      return;
    }

    if (body.action === 'lesson') {
      const c = body.course || {}, l = body.lesson || {};
      if (!l.title) { res.status(400).json({ error: 'Missing lesson' }); return; }
      const audience = LEVELS[c.level] || LEVELS.intermediate;
      const outline = (Array.isArray(body.outline) ? body.outline : []).slice(0, 60).map(t => '- ' + clip(t, 140)).join('\n');
      const md = await claude(key,
        `You are writing one lesson of the course "${clip(c.title, 120)}" (topic: ${clip(c.topic, 300)}). Audience: ${audience}.\n` +
        `Unit: ${clip(body.unit, 120)}\nLesson: ${clip(l.title, 140)}\nGoal: ${clip(l.summary, 300)}\nKey concepts: ${(l.concepts || []).map(x => clip(x, 60)).join(', ')}\n\n` +
        `Full course outline, for context (do not repeat other lessons' material):\n${outline}\n\n` +
        `Write the lesson in Markdown, 700-1000 words. It will be read with a one-word-at-a-time speed reader, so:\n` +
        `- Use 4-6 sections, each starting with a "## " heading. No "# " title.\n` +
        `- Write flowing prose paragraphs; use lists sparingly. No images, no HTML.\n` +
        `- Put any formula or code on its own line in backticks, e.g. \`P = F / (1 + r)^n\`, and explain it in words in the next sentence.\n` +
        `- Use concrete examples. Be accurate; if something is contested or uncertain, say so.\n` +
        `- End with a "## Key Takeaways" section of 3-5 bullet points.\n` +
        `Output only the Markdown.`,
        3000);
      const markdown = md.replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/, '').trim();
      if (markdown.length < 400) { res.status(502).json({ error: 'Lesson came back empty — try again' }); return; }
      res.status(200).json({ markdown });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(502).json({ error: 'Generation failed', detail: String(e.message || e) });
  }
}
