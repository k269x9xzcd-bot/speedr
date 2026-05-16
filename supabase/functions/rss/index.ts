import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=300',
};

// Googlebot UA: some paywalled sites serve full article text to crawlers for SEO.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Hostname allowlist for `mode=raw` (full-HTML proxy — restricted to avoid being an open SSRF).
const RAW_ALLOWED = ['di.gg', 'digg.com'];
function rawAllowed(u: string): boolean {
  try { const h = new URL(u).hostname.toLowerCase(); return RAW_ALLOWED.some(d => h === d || h.endsWith('.' + d)); } catch { return false; }
}

function wordCount(s: string): number { return s ? s.trim().split(/\s+/).filter(Boolean).length : 0; }

function getTag(block: string, tag: string): string {
  const cdataMatch = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, 'i'));
  if (cdataMatch) return cdataMatch[1].trim();
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return match ? match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim() : '';
}

function getRawTag(block: string, tag: string): string {
  const cdataMatch = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, 'i'));
  if (cdataMatch) return cdataMatch[1].trim();
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/\s+/g, ' ').trim();
}

function extractParas(html: string): string {
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  for (const sel of [
    /class=["'][^"']*(?:article[^"']*body|post[^"']*content|entry[^"']*content|story[^"']*body)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article|section)/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
  ]) {
    const match = cleaned.match(sel);
    if (match) { const text = stripHtml(match[1]); if (text.length > 300) return text.slice(0, 8000); }
  }
  const paras = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => stripHtml(m[1])).filter(t => t.length > 40);
  if (paras.length > 2) return paras.join(' ').slice(0, 8000);
  return '';
}

function getLinkAtom(block: string): string {
  const altMatch = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (altMatch) return altMatch[1];
  const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (hrefMatch) return hrefMatch[1];
  return getTag(block, 'link');
}

function parseRSS(xml: string, feedName: string, category: string) {
  const isAtom = xml.includes('<feed') && !xml.includes('<rss');
  const itemTag = isAtom ? 'entry' : 'item';
  const items: object[] = [];
  const regex = new RegExp(`<${itemTag}[\\s>][\\s\\S]*?<\/${itemTag}>`, 'gi');
  const blocks = xml.match(regex) || [];
  for (const block of blocks.slice(0, 20)) {
    const title = getTag(block, 'title');
    if (!title) continue;
    const link = isAtom ? getLinkAtom(block) : getTag(block, 'link');
    const description = stripHtml(getRawTag(block, 'description') || getRawTag(block, 'summary')).slice(0, 400);
    const contentEncoded = stripHtml(getRawTag(block, 'content:encoded'));
    const contentRaw = stripHtml(getRawTag(block, 'content'));
    const fullContent = contentEncoded.length > contentRaw.length ? contentEncoded : contentRaw;
    const pubDate = getTag(block, 'pubDate') || getTag(block, 'published') || getTag(block, 'updated') || '';
    items.push({ title, link, description, fullContent: fullContent.length > description.length ? fullContent : '', pubDate, source: feedName, category });
  }
  return items;
}

async function fetchViaWayback(url: string): Promise<string> {
  try {
    const r = await fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(url), { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return '';
    const j = await r.json();
    const snap = j && j.archived_snapshots && j.archived_snapshots.closest;
    if (!snap || snap.available !== true || String(snap.status) !== '200' || !snap.url) return '';
    const res = await fetch(snap.url, { headers: HEADERS, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return '';
    return extractParas(await res.text());
  } catch { return ''; }
}

async function fetchArticleDirect(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return '';
    return extractParas(await res.text());
  } catch { return ''; }
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function authedClient(req: Request) {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode');

  // -- LIBRARY: save article --
  if (mode === 'save' && req.method === 'POST') {
    const supabase = authedClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const body = await req.json();
    const { error } = await supabase.from('saved_articles').insert({
      user_id: user.id,
      title: body.title,
      url: body.url || null,
      source: body.source || null,
      text: body.text,
      word_count: body.text?.split(/\s+/).filter(Boolean).length || 0,
    });
    if (error) return jsonRes({ error: error.message }, 500);
    return jsonRes({ status: 'ok' });
  }

  // -- LIBRARY: list articles --
  if (mode === 'library' && req.method === 'GET') {
    const supabase = authedClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const { data, error } = await supabase.from('saved_articles')
      .select('id, title, url, source, word_count, saved_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('saved_at', { ascending: false })
      .limit(100);
    if (error) return jsonRes({ error: error.message }, 500);
    return jsonRes({ status: 'ok', articles: data });
  }

  // -- LIBRARY: get article text --
  if (mode === 'get' && req.method === 'GET') {
    const supabase = authedClient(req);
    const articleId = url.searchParams.get('id');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const { data, error } = await supabase.from('saved_articles')
      .select('*')
      .eq('id', articleId)
      .eq('user_id', user.id)
      .single();
    if (error) return jsonRes({ error: error.message }, 404);
    return jsonRes({ status: 'ok', article: data });
  }

  // -- LIBRARY: delete article --
  if (mode === 'delete' && req.method === 'DELETE') {
    const supabase = authedClient(req);
    const articleId = url.searchParams.get('id');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    await supabase.from('saved_articles').update({ is_deleted: true }).eq('id', articleId).eq('user_id', user.id);
    return jsonRes({ status: 'ok' });
  }

  // -- FEEDS: list custom feeds + enabled toggle state --
  if (mode === 'feeds-list' && req.method === 'GET') {
    const supabase = authedClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const [feedsRes, prefsRes] = await Promise.all([
      supabase.from('user_feeds').select('id, url, name, category, created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('user_feed_prefs').select('enabled_feed_ids, updated_at').eq('user_id', user.id).maybeSingle(),
    ]);
    if (feedsRes.error) return jsonRes({ error: feedsRes.error.message }, 500);
    return jsonRes({
      status: 'ok',
      feeds: feedsRes.data || [],
      enabled: prefsRes.data?.enabled_feed_ids || null,
      enabled_updated_at: prefsRes.data?.updated_at || null,
    });
  }

  // -- FEEDS: add custom feed (upsert on user_id+url) --
  if (mode === 'feeds-add' && req.method === 'POST') {
    const supabase = authedClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const body = await req.json();
    if (!body.url || !body.name) return jsonRes({ error: 'Missing url or name' }, 400);
    const { data, error } = await supabase.from('user_feeds')
      .upsert({
        user_id: user.id,
        url: body.url,
        name: body.name,
        category: body.category || 'Custom',
      }, { onConflict: 'user_id,url' })
      .select('id, url, name, category, created_at')
      .single();
    if (error) return jsonRes({ error: error.message }, 500);
    return jsonRes({ status: 'ok', feed: data });
  }

  // -- FEEDS: remove custom feed --
  if (mode === 'feeds-remove' && req.method === 'POST') {
    const supabase = authedClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const body = await req.json();
    if (!body.id) return jsonRes({ error: 'Missing id' }, 400);
    const { error } = await supabase.from('user_feeds').delete().eq('id', body.id).eq('user_id', user.id);
    if (error) return jsonRes({ error: error.message }, 500);
    return jsonRes({ status: 'ok' });
  }

  // -- FEEDS: upsert enabled-feed selection --
  if (mode === 'feeds-prefs' && req.method === 'POST') {
    const supabase = authedClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const body = await req.json();
    if (!Array.isArray(body.enabled)) return jsonRes({ error: 'enabled must be string[]' }, 400);
    const { error } = await supabase.from('user_feed_prefs')
      .upsert({ user_id: user.id, enabled_feed_ids: body.enabled, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return jsonRes({ error: error.message }, 500);
    return jsonRes({ status: 'ok' });
  }

  // -- RAW HTML FETCH (allowlisted hosts only — for scraping pages like di.gg/ai) --
  if (mode === 'raw') {
    const rawUrl = url.searchParams.get('url') || '';
    if (!rawUrl) return jsonRes({ error: 'Missing url' }, 400);
    if (!rawAllowed(rawUrl)) return jsonRes({ status: 'error', error: 'Host not allowlisted' }, 403);
    try {
      const res = await fetch(rawUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return jsonRes({ status: 'error', error: 'HTTP ' + res.status }, 502);
      const html = await res.text();
      return jsonRes({ status: 'ok', html });
    } catch (e) {
      return jsonRes({ status: 'error', error: String(e) }, 502);
    }
  }

  // -- ARTICLE TEXT FETCH --  (Wayback static snapshot -> Googlebot live fetch)
  if (mode === 'article') {
    const articleUrl = url.searchParams.get('url');
    if (!articleUrl) return jsonRes({ error: 'Missing url' }, 400);
    let text = await fetchViaWayback(articleUrl);
    if (wordCount(text) < 150) {
      const direct = await fetchArticleDirect(articleUrl);
      if (wordCount(direct) > wordCount(text)) text = direct;
    }
    return jsonRes({ status: 'ok', text, words: wordCount(text) });
  }

  // -- RSS FEED --
  const feedUrl = url.searchParams.get('url');
  const feedName = url.searchParams.get('name') || 'Unknown';
  const category = url.searchParams.get('cat') || 'News';
  if (!feedUrl) return jsonRes({ error: 'Missing url param' }, 400);

  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Speedr/1.0)', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}`);
    const xml = await res.text();
    if (!xml || xml.length < 100) throw new Error('Empty feed response');
    const items = parseRSS(xml, feedName, category);
    if (items.length === 0) throw new Error('No items parsed from feed');
    return jsonRes({ status: 'ok', items, count: items.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonRes({ status: 'error', error: msg }, 502);
  }
});
