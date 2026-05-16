// Serverless proxy for Claude comprehension-question generation.
// Keeps ANTHROPIC_API_KEY server-side. Set it in the Vercel project settings.

const MODEL = 'claude-haiku-4-5-20251001';

function hostOf(v) { try { return new URL(v).hostname.toLowerCase(); } catch { return ''; } }
// Exact-host allowlist. No `*.vercel.app` wildcard: this endpoint spends the
// server-side ANTHROPIC_API_KEY, so any vercel.app site must not be able to
// invoke it from the browser. Extra hosts (e.g. preview deploys) can be added
// via ALLOWED_ORIGIN_HOSTS (comma-separated) in the Vercel project settings.
const EXTRA_HOSTS = (process.env.ALLOWED_ORIGIN_HOSTS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
function isAllowedHost(h) {
  return h === 'myspeedr.vercel.app' || h === 'localhost' || h === '127.0.0.1' || EXTRA_HOSTS.includes(h);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = isAllowedHost(hostOf(origin)) || isAllowedHost(hostOf(req.headers.referer || ''));
  // Reflect the origin only when it's one of ours (best-effort anti-abuse; a non-browser caller can still spoof headers).
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
  const text = ((body && body.text) || '').toString().trim().slice(0, 8000);
  if (text.length < 50) { res.status(400).json({ error: 'Missing or too-short passage text' }); return; }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Generate exactly 4 multiple-choice comprehension questions about the passage below. Each question should test understanding, not trivia. Output ONLY a JSON array (no prose, no code fences) of this exact shape: [{"q":"...","choices":["a","b","c","d"],"answer":0}]. The "answer" field is the 0-based index of the correct choice.\n\nPassage:\n"""\n${text}\n"""`,
        }],
      }),
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'Anthropic API error', detail: data }); return; }
    const out = (data && data.content && data.content[0] && data.content[0].text) || '';
    const m = out.match(/\[[\s\S]*\]/);
    if (!m) { res.status(502).json({ error: 'Could not locate JSON in model output' }); return; }
    let arr;
    try { arr = JSON.parse(m[0]); } catch { res.status(502).json({ error: 'Model returned invalid JSON' }); return; }
    arr = (Array.isArray(arr) ? arr : []).filter(
      x => x && typeof x.q === 'string' && Array.isArray(x.choices) && x.choices.length >= 2
        && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.choices.length
    );
    if (arr.length < 3) { res.status(502).json({ error: 'Too few valid questions returned' }); return; }
    res.status(200).json({ questions: arr });
  } catch (e) {
    res.status(500).json({ error: 'Request failed', detail: String(e) });
  }
}
