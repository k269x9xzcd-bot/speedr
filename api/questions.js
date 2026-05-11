// Serverless proxy for Claude comprehension-question generation.
// Keeps ANTHROPIC_API_KEY server-side. Set it in the Vercel project settings.

const MODEL = 'claude-haiku-4-5-20251001';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

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
      x => x && typeof x.q === 'string' && Array.isArray(x.choices) && x.choices.length >= 2 && Number.isInteger(x.answer)
    );
    if (arr.length < 3) { res.status(502).json({ error: 'Too few valid questions returned' }); return; }
    res.status(200).json({ questions: arr });
  } catch (e) {
    res.status(500).json({ error: 'Request failed', detail: String(e) });
  }
}
