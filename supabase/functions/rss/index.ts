import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=300',
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Cache freshness: even with no etag/last-modified, treat cached XML <10 min old as valid (skip upstream).
const CACHE_TTL_MS = 10 * 60 * 1000;

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

function getAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["']`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
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

function resolveUrl(href: string, base: string): string {
  if (!href) return '';
  if (/^[a-z]+:\/\//i.test(href)) return href;
  if (!base) return href;
  try { return new URL(href, base).toString(); } catch { return href; }
}

// Find the first usable image URL for an item:
//   1. <enclosure type="image/*" url="..."> (rare but spec)
//   2. <media:content medium="image" url="...">  /  <media:thumbnail url="...">
//   3. First <img src="..."> inside description / content:encoded
function extractImage(block: string, base: string): string {
  let m = block.match(/<enclosure\b[^>]*\btype=["']image\/[^"']+["'][^>]*\burl=["']([^"']+)["']/i);
  if (m) return resolveUrl(m[1], base);
  m = block.match(/<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\/[^"']+["']/i);
  if (m) return resolveUrl(m[1], base);
  m = block.match(/<media:(?:content|thumbnail)\b[^>]*\burl=["']([^"']+)["']/i);
  if (m) return resolveUrl(m[1], base);
  const contentBlock = getRawTag(block, 'content:encoded') || getRawTag(block, 'description') || getRawTag(block, 'content') || getRawTag(block, 'summary');
  if (contentBlock) {
    const im = contentBlock.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    if (im) return resolveUrl(im[1], base);
  }
  return '';
}

function getChannelBase(xml: string): string {
  // Try atom <feed><link rel="alternate" href="..."> first, then RSS <channel><link>http://...</link>.
  const headXml = xml.slice(0, 4000);
  const atom = headXml.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (atom) return atom[1];
  const ch = headXml.match(/<channel\b[\s\S]*?<link\b[^>]*>([\s\S]*?)<\/link>/i);
  if (ch) {
    const t = ch[1].replace(/<[^>]+>/g, '').trim();
    if (t) return t;
  }
  return '';
}

function parseRSS(xml: string, feedName: string, category: string) {
  const isAtom = xml.includes('<feed') && !xml.includes('<rss');
  const itemTag = isAtom ? 'entry' : 'item';
  const base = getChannelBase(xml);
  const items: object[] = [];
  const regex = new RegExp(`<${itemTag}[\\s>][\\s\\S]*?<\/${itemTag}>`, 'gi');
  const blocks = xml.match(regex) || [];
  for (const block of blocks.slice(0, 20)) {
    const title = getTag(block, 'title');
    if (!title) continue;
    const rawLink = isAtom ? getLinkAtom(block) : getTag(block, 'link');
    const link = resolveUrl(rawLink, base);
    const description = stripHtml(getRawTag(block, 'description') || getRawTag(block, 'summary')).slice(0, 400);
    const contentEncoded = stripHtml(getRawTag(block, 'content:encoded'));
    const contentRaw = stripHtml(getRawTag(block, 'content'));
    const fullContent = contentEncoded.length > contentRaw.length ? contentEncoded : contentRaw;
    const pubDate = getTag(block, 'pubDate') || getTag(block, 'published') || getTag(block, 'updated') || '';
    const guid = getTag(block, 'guid') || getTag(block, 'id') || link || title;
    const image = extractImage(block, base);
    items.push({
      guid,
      title,
      link,
      description,
      fullContent: fullContent.length > description.length ? fullContent : '',
      pubDate,
      image,
      source: feedName,
      category,
    });
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

function jsonRes(body: unknown, status = 200, extraHeaders: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, ...extraHeaders, 'Content-Type': 'application/json' } });
}

function authedClient(req: Request) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });
}

// Service-role client — bypasses RLS, used only for the server-side feed cache table.
const serviceClient = SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

async function fetchFeedXmlCached(feedUrl: string): Promise<{ xml: string; cached: boolean }> {
  let cached: { etag: string | null; last_modified: string | null; xml: string | null; fetched_at: string | null } | null = null;
  if (serviceClient) {
    const { data } = await serviceClient.from('feed_cache')
      .select('etag, last_modified, xml, fetched_at')
      .eq('url', feedUrl)
      .maybeSingle();
    cached = data;
  }

  // Hard cache hit: cached XML newer than CACHE_TTL_MS → skip upstream entirely.
  if (cached?.xml && cached.fetched_at) {
    const age = Date.now() - Date.parse(cached.fetched_at);
    if (age < CACHE_TTL_MS) return { xml: cached.xml, cached: true };
  }

  const condHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; Speedr/1.0)',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  };
  if (cached?.etag) condHeaders['If-None-Match'] = cached.etag;
  if (cached?.last_modified) condHeaders['If-Modified-Since'] = cached.last_modified;

  const res = await fetch(feedUrl, { headers: condHeaders, signal: AbortSignal.timeout(10000) });

  if (res.status === 304 && cached?.xml) {
    if (serviceClient) {
      await serviceClient.from('feed_cache')
        .update({ fetched_at: new Date().toISOString() })
        .eq('url', feedUrl);
    }
    return { xml: cached.xml, cached: true };
  }

  if (!res.ok) {
    // Upstream failed but we have a cached copy — serve stale rather than erroring.
    if (cached?.xml) return { xml: cached.xml, cached: true };
    throw new Error(`Feed returned HTTP ${res.status}`);
  }

  const xml = await res.text();
  if (!xml || xml.length < 100) {
    if (cached?.xml) return { xml: cached.xml, cached: true };
    throw new Error('Empty feed response');
  }

  if (serviceClient) {
    await serviceClient.from('feed_cache').upsert({
      url: feedUrl,
      etag: res.headers.get('etag'),
      last_modified: res.headers.get('last-modified'),
      xml,
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'url' });
  }

  return { xml, cached: false };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode');

  if (mode === 'save' && req.method === 'POST') {
    const supabase = authedClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const body = await req.json();
    const { error } = await supabase.from('saved_articles').insert({
      user_id: user.id, title: body.title, url: body.url || null, source: body.source || null,
      text: body.text, word_count: body.text?.split(/\s+/).filter(Boolean).length || 0,
    });
    if (error) return jsonRes({ error: error.message }, 500);
    return jsonRes({ status: 'ok' });
  }

  if (mode === 'library' && req.method === 'GET') {
    const supabase = authedClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const { data, error } = await supabase.from('saved_articles')
      .select('id, title, url, source, word_count, saved_at')
      .eq('user_id', user.id).eq('is_deleted', false)
      .order('saved_at', { ascending: false }).limit(100);
    if (error) return jsonRes({ error: error.message }, 500);
    return jsonRes({ status: 'ok', articles: data });
  }

  if (mode === 'get' && req.method === 'GET') {
    const supabase = authedClient(req);
    const articleId = url.searchParams.get('id');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const { data, error } = await supabase.from('saved_articles')
      .select('*').eq('id', articleId).eq('user_id', user.id).single();
    if (error) return jsonRes({ error: error.message }, 404);
    return jsonRes({ status: 'ok', article: data });
  }

  if (mode === 'delete' && req.method === 'DELETE') {
    const supabase = authedClient(req);
    const articleId = url.searchParams.get('id');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    await supabase.from('saved_articles').update({ is_deleted: true }).eq('id', articleId).eq('user_id', user.id);
    return jsonRes({ status: 'ok' });
  }

  if (mode === 'feeds-list' && req.method === 'GET') {
    const supabase = authedClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const [feedsRes, prefsRes] = await Promise.all([
      supabase.from('user_feeds').select('id, url, name, category, created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('user_feed_prefs').select('enabled_feed_ids, updated_at').eq('user_id', user.id).maybeSingle(),
    ]);
    if (feedsRes.error) return jsonRes({ error: feedsRes.error.message }, 500);
    return jsonRes({ status: 'ok', feeds: feedsRes.data || [], enabled: prefsRes.data?.enabled_feed_ids || null, enabled_updated_at: prefsRes.data?.updated_at || null });
  }

  if (mode === 'feeds-add' && req.method === 'POST') {
    const supabase = authedClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401);
    const body = await req.json();
    if (!body.url || !body.name) return jsonRes({ error: 'Missing url or name' }, 400);
    const { data, error } = await supabase.from('user_feeds')
      .upsert({ user_id: user.id, url: body.url, name: body.name, category: body.category || 'Custom' }, { onConflict: 'user_id,url' })
      .select('id, url, name, category, created_at').single();
    if (error) return jsonRes({ error: error.message }, 500);
    return jsonRes({ status: 'ok', feed: data });
  }

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

  if (mode === 'raw') {
    const rawUrl = url.searchParams.get('url') || '';
    if (!rawUrl) return jsonRes({ error: 'Missing url' }, 400);
    if (!rawAllowed(rawUrl)) return jsonRes({ status: 'error', error: 'Host not allowlisted' }, 403);
    try {
      const res = await fetch(rawUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return jsonRes({ status: 'error', error: 'HTTP ' + res.status }, 502);
      const html = await res.text();
      return jsonRes({ status: 'ok', html });
    } catch (e) { return jsonRes({ status: 'error', error: String(e) }, 502); }
  }

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

  // -- RSS FEED (cached) --
  const feedUrl = url.searchParams.get('url');
  const feedName = url.searchParams.get('name') || 'Unknown';
  const category = url.searchParams.get('cat') || 'News';
  if (!feedUrl) return jsonRes({ error: 'Missing url param' }, 400);

  try {
    const { xml, cached } = await fetchFeedXmlCached(feedUrl);
    const items = parseRSS(xml, feedName, category);
    if (items.length === 0) throw new Error('No items parsed from feed');
    return jsonRes({ status: 'ok', items, count: items.length, cached });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonRes({ status: 'error', error: msg }, 502);
  }
});
