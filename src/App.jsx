import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// -- FEEDS ---------------------------------------------------------------------
const ALL_FEEDS = [
  { id:'npr-us',       name:'NPR News',           url:'https://feeds.npr.org/1001/rss.xml',                         category:'US' },
  { id:'gnews-us',     name:'Google News US',     url:'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',     category:'US' },
  { id:'bbc-world',    name:'BBC World',          url:'https://feeds.bbci.co.uk/news/world/rss.xml',                category:'World' },
  { id:'aljazeera',    name:'Al Jazeera',         url:'https://www.aljazeera.com/news/rss.xml',                     category:'World' },
  { id:'dw',           name:'DW News',            url:'https://rss.dw.com/rdf/rss-en-all',                          category:'World' },
  { id:'axios-pol',    name:'Axios',              url:'https://api.axios.com/feed/',                                category:'Politics' },
  { id:'guardian-pol', name:'The Guardian',       url:'https://www.theguardian.com/politics/rss',                   category:'Politics' },
  { id:'techcrunch',   name:'TechCrunch',         url:'https://techcrunch.com/feed/',                               category:'Business' },
  { id:'fortune',      name:'Fortune',            url:'https://fortune.com/feed/',                                  category:'Business' },
  { id:'fastco',       name:'Fast Company',       url:'https://www.fastcompany.com/latest/rss',                     category:'Business' },
  { id:'npr-health',   name:'NPR Health',         url:'https://feeds.npr.org/1128/rss.xml',                         category:'Health' },
  { id:'webmd',        name:'WebMD',              url:'https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC',category:'Health' },
  { id:'ew',           name:'Entertainment Weekly',url:'https://ew.com/feed/',                                      category:'Entertainment' },
  { id:'ars',          name:'Ars Technica',       url:'https://feeds.arstechnica.com/arstechnica/index',            category:'Science' },
  { id:'npr-sci',      name:'NPR Science',        url:'https://feeds.npr.org/1007/rss.xml',                         category:'Science' },
  { id:'nasa',         name:'NASA',               url:'https://www.nasa.gov/rss/dyn/breaking_news.rss',             category:'Science' },
  { id:'newscientist', name:'New Scientist',      url:'https://www.newscientist.com/feed/home/',                    category:'Science' },
  { id:'curbed-ny',    name:'Curbed NY',          url:'https://www.curbed.com/rss/index.xml',                       category:'Local' },
  { id:'gothamist',    name:'Gothamist',          url:'https://gothamist.com/feed',                                 category:'Local' },
  { id:'thecity',      name:'The City NYC',       url:'https://thecity.nyc/feed/',                                  category:'Local' },
  { id:'tribeca',      name:'Tribeca Citizen',    url:'https://tribecacitizen.com/feed/',                           category:'Local' },
  { id:'moneyprinter', name:'Money Printer',      url:'https://themoneyprinter.substack.com/feed',                  category:'Substack' },
  { id:'charlie',      name:'Charlie Garcia',     url:'https://charliepgarcia.substack.com/feed',                   category:'Substack' },
  { id:'cnet',         name:'CNET',               url:'https://www.cnet.com/rss/news/',                             category:'Tech' },
  { id:'wired',        name:'Wired',              url:'https://www.wired.com/feed/rss',                             category:'Tech' },
  { id:'macrumors',    name:'MacRumors',          url:'https://feeds.macrumors.com/MacRumors-All',                  category:'Tech' },
  { id:'mit-tech',     name:'MIT Tech Review',    url:'https://www.technologyreview.com/feed/',                     category:'Tech' },
  { id:'verge-tech',   name:'The Verge',          url:'https://www.theverge.com/rss/index.xml',                     category:'Tech' },
];

const CATEGORIES = ['All','US','World','Politics','Business','Tech','Health','Entertainment','Science','Local','Substack'];
const SUPABASE_RSS  = 'https://reojrvyczjrdaobgnrod.supabase.co/functions/v1/rss';
const SUPABASE_URL  = 'https://reojrvyczjrdaobgnrod.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlb2pydnljempyZGFvYmducm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzAyODQsImV4cCI6MjA5NDAwNjI4NH0.RziEy75n6MS6SNl_nUqLOVRSG19TNEta9AvzrT0BB14';
const ALLORIGINS   = 'https://api.allorigins.win/get?url=';
const RSS2JSON     = 'https://api.rss2json.com/v1/api.json?rss_url=';
const DEFAULT_ENABLED = ALL_FEEDS.map(f => f.id);
const CACHE_KEY    = 'speedr_feed_cache';
const CACHE_TS_KEY = 'speedr_feed_ts';
const CACHE_TTL    = 30 * 60 * 1000;

const DEFAULT_SETTINGS = {
  wpm: 280, chunkSize: 2, peripheralBefore: 0, peripheralAfter: 0,
  orpOn: true, orpColor: '#e05252', fontSize: 'medium',
  fontStyle: 'mono', variablePacing: true, showProgress: true,
};

const FONT_MAP = {
  mono:      "'JetBrains Mono','Courier New',monospace",
  condensed: "'Inter',system-ui,sans-serif",
  serif:     "Georgia,'Times New Roman',serif",
};

const FONT_SIZE_MAP = {
  small:'clamp(18px,4vw,26px)', medium:'clamp(24px,6vw,38px)',
  large:'clamp(30px,8vw,50px)', xlarge:'clamp(38px,10vw,62px)',
};

// -- CSS ------------------------------------------------------------------------
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  html,body,#root{height:100%;height:100dvh;max-height:100dvh;}
  body{
    background:#0d0d0d;color:#e8e8e8;
    font-family:'Inter',system-ui,sans-serif;font-weight:300;
    -webkit-font-smoothing:antialiased;overscroll-behavior:none;
    overflow:hidden;position:fixed;width:100%;
    -webkit-user-select:none;user-select:none;
  }
  input,textarea,button{font-family:inherit;font-weight:300;}
  textarea,input{-webkit-user-select:text;user-select:text;}
  ::placeholder{color:#3a3a3a;}
  ::-webkit-scrollbar{display:none;}
  *{scrollbar-width:none;}

  @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.15}}
  @keyframes wordPop{0%{transform:scale(1)}40%{transform:scale(1.04)}100%{transform:scale(1)}}

  .slide-up{animation:slideUp 0.18s ease-out both;}
  .fade-in{animation:fadeIn 0.2s ease-out both;}
  .word-pop{animation:wordPop 0.12s ease-out;}

  .ui-faded{opacity:0;pointer-events:none;}
  .ui-layer{transition:opacity 0.25s ease;}

  @media(orientation:landscape){
    .ls-hide{display:none!important;}
    .ls-reader{position:fixed!important;inset:0!important;z-index:50!important;border-radius:0!important;border:none!important;background:#0d0d0d!important;}
    .ls-words{font-size:clamp(26px,7vh,52px)!important;}
  }
`;

// -- HOOKS ----------------------------------------------------------------------
function useOrientation() {
  const [ls, setLs] = useState(() => window.matchMedia('(orientation:landscape)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(orientation:landscape)');
    const h = e => setLs(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return ls;
}

function useSetting(key) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem('speedr_' + key); return s !== null ? JSON.parse(s) : DEFAULT_SETTINGS[key]; }
    catch { return DEFAULT_SETTINGS[key]; }
  });
  const set = useCallback(v => { setVal(v); localStorage.setItem('speedr_' + key, JSON.stringify(v)); }, [key]);
  return [val, set];
}

// -- TOKENIZER -----------------------------------------------------------------
function tokenize(text, chunkSize) {
  if (!text) return [];
  const words = text.replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  const out = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const endsSent = /[.!?]$/.test(w);
    const longWord = w.length > 12;
    if (chunkSize === 1 || endsSent || longWord || !words[i+1]) { out.push([w]); i++; }
    else if (chunkSize === 2) { out.push([w, words[i+1]].filter(Boolean)); i += 2; }
    else { out.push([w, words[i+1], words[i+2]].filter(Boolean)); i += 3; }
  }
  return out;
}

function chunkDelay(chunk, baseMs, variable) {
  if (!variable) return baseMs * chunk.length;
  const last = chunk[chunk.length-1];
  const mult = /[.!?]$/.test(last) ? 1.8 : /[,:;]$/.test(last) ? 1.3 : 1;
  return baseMs * chunk.length * mult;
}

// -- ORP DISPLAY ---------------------------------------------------------------
function OrpWord({ word, on, color }) {
  const s = word.replace(/[.,!?;:]+$/,'');
  const p = word.slice(s.length);
  const i = Math.max(0, Math.floor(s.length * 0.3));
  if (!on) return <span>{word}</span>;
  return <span>{s.slice(0,i)}<span style={{color,fontWeight:600}}>{s[i]}</span>{s.slice(i+1)}{p}</span>;
}

function ChunkDisplay({ chunk, settings, allChunks, idx }) {
  const font = FONT_MAP[settings.fontStyle];
  const size = FONT_SIZE_MAP[settings.fontSize];
  const before = [], after = [];
  if (settings.peripheralBefore > 0) {
    let wi = idx - 1, count = 0;
    while (wi >= 0 && count < settings.peripheralBefore) {
      allChunks[wi].forEach(w => { if (count < settings.peripheralBefore) { before.unshift(w); count++; } });
      wi--;
    }
  }
  if (settings.peripheralAfter > 0) {
    let wi = idx + 1, count = 0;
    while (wi < allChunks.length && count < settings.peripheralAfter) {
      allChunks[wi].forEach(w => { if (count < settings.peripheralAfter) { after.push(w); count++; } });
      wi++;
    }
  }
  return (
    <div style={{fontFamily:font,fontSize:size,textAlign:'center',lineHeight:1.3,letterSpacing:0.3,display:'flex',alignItems:'center',justifyContent:'center',gap:'0.35em',flexWrap:'nowrap'}}>
      {before.length > 0 && <span style={{color:'#2e2e2e',fontSize:'0.6em',flexShrink:0}}>{before.join(' ')}</span>}
      <span style={{color:'#f0f0f0'}}>
        {chunk.map((w,i) => <React.Fragment key={i}>{i>0&&' '}<OrpWord word={w} on={settings.orpOn} color={settings.orpColor}/></React.Fragment>)}
      </span>
      {after.length > 0 && <span style={{color:'#2e2e2e',fontSize:'0.6em',flexShrink:0}}>{after.join(' ')}</span>}
    </div>
  );
}

// -- FETCH UTILS ---------------------------------------------------------------
const JINA_BLOCKED = ['nypost.com','news.google.com','aljazeera.com','foxnews.com','wsj.com','nytimes.com'];
function isJinaBlocked(url) { try { return JINA_BLOCKED.some(d => new URL(url).hostname.includes(d)); } catch { return false; } }

function timeAgo(d) {
  if (!d) return '';
  const m = (Date.now() - new Date(d)) / 60000;
  if (m < 60) return Math.round(m) + 'm';
  if (m < 1440) return Math.round(m/60) + 'h';
  return Math.round(m/1440) + 'd';
}

async function stripJinaHeaders(text) {
  const lines = text.split('\n');
  const skip = ['Title:','URL:','Published','Source:','Author:','Description:','Markdown Content:'];
  let start = 0;
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const l = lines[i].trim();
    if (!l || skip.some(p => l.startsWith(p))) { start = i + 1; continue; }
    if (l.length > 60) { start = i; break; }
  }
  return lines.slice(start).join('\n').trim();
}

async function fetchViaSupabaseArticle(url) {
  const p = new URLSearchParams({ mode:'article', url, t:String(Date.now()) });
  const res = await fetch(SUPABASE_RSS + '?' + p, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error('Supabase ' + res.status);
  const data = await res.json();
  if (!data.text || data.words < 100) throw new Error('Too short: ' + data.words + 'w');
  return data.text;
}

async function fetchViaJina(url) {
  if (isJinaBlocked(url)) throw new Error('Jina blocked for this domain');
  const res = await fetch('https://r.jina.ai/' + url, {
    headers:{'Accept':'text/plain','X-Return-Format':'text','X-Timeout':'10'},
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('Jina ' + res.status);
  const text = await res.text();
  const clean = await stripJinaHeaders(text);
  if (clean.length < 200) throw new Error('Too short');
  return clean;
}

async function fetchViaAllOrigins(url) {
  const res = await fetch(ALLORIGINS + encodeURIComponent(url), { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  const html = data.contents || '';
  if (!html || html.length < 500) throw new Error('Empty');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,nav,footer,header,aside,form,.nav,.footer,.sidebar,.ad,.social,.paywall,iframe').forEach(n=>n.remove());
  for (const sel of ['article','main','[role=main]','.article-body','.post-content','.entry-content','.story-body','.body.markup']) {
    const el = doc.querySelector(sel);
    if (el) { const paras = Array.from(el.querySelectorAll('p')).map(p=>p.textContent.trim()).filter(t=>t.length>40); if (paras.length>2) return paras.join('\n\n'); }
  }
  const allParas = Array.from(doc.querySelectorAll('p')).map(p=>p.textContent.trim()).filter(t=>t.length>50);
  if (allParas.length > 2) return allParas.join('\n\n');
  throw new Error('No paragraphs');
}

async function fetchText(url) {
  try { const t = await fetchViaSupabaseArticle(url); if (t.length > 300) return t; } catch(e) { console.log('Supabase:', e.message); }
  try { const t = await fetchViaJina(url); if (t.length > 300) return t; } catch(e) { console.log('Jina:', e.message); }
  try { const t = await fetchViaAllOrigins(url); if (t.length > 200) return t; } catch(e) { console.log('AllOrigins:', e.message); }
  throw new Error('Could not extract article. Use the bookmarklet for paywalled sites.');
}

function decodeAllOrigins(raw) {
  if (raw && raw.startsWith('data:') && raw.includes('base64,')) { try { return atob(raw.split('base64,')[1]); } catch {} }
  return raw;
}

function parseRSSXML(xml, feed) {
  const isAtom = !!xml.match(/<feed[\s>]/);
  const items = Array.from(new DOMParser().parseFromString(xml,'text/xml').querySelectorAll(isAtom?'entry':'item')).slice(0,20);
  return items.map(item => {
    const get = sel => item.querySelector(sel)?.textContent?.trim() || '';
    const title = get('title');
    const link = isAtom ? (item.querySelector('link[rel=alternate]')?.getAttribute('href') || item.querySelector('link')?.getAttribute('href') || '') : get('link');
    const desc = (get('description') || get('summary')).replace(/<[^>]+>/g,'').trim();
    const full = (get('content') || '').replace(/<[^>]+>/g,'').trim();
    return { title, link, description:desc.slice(0,200), fullContent:full.length>desc.length?full:'', pubDate:get('pubDate')||get('published')||get('updated')||'', source:feed.name, category:feed.category, feedId:feed.id };
  }).filter(i=>i.title);
}

async function fetchRSSViaSupabase(feed) {
  const p = new URLSearchParams({ url:feed.url, name:feed.name, cat:feed.category, t:String(Math.floor(Date.now()/300000)) });
  const res = await fetch(SUPABASE_RSS + '?' + p, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error('Supabase ' + res.status);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.error || 'error');
  return data.items || [];
}

async function fetchRSSViaAllOrigins(feed) {
  const res = await fetch(ALLORIGINS + encodeURIComponent(feed.url) + '&t=' + Math.floor(Date.now()/300000), { signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  const xml = decodeAllOrigins(data.contents || '');
  if (!xml.includes('<item') && !xml.includes('<entry')) throw new Error('No items');
  return parseRSSXML(xml, feed);
}

async function fetchRSSViaCorsproxy(feed) {
  const res = await fetch('https://corsproxy.io/?' + encodeURIComponent(feed.url), { signal: AbortSignal.timeout(15000) });
  const xml = await res.text();
  if (!xml.includes('<item') && !xml.includes('<entry')) throw new Error('No items');
  return parseRSSXML(xml, feed);
}

async function fetchRSS(feed) {
  try { const i = await fetchRSSViaSupabase(feed); if (i.length>0) return i; } catch(e) { console.log(feed.name,'supabase:',e.message); }
  try { const i = await fetchRSSViaAllOrigins(feed); if (i.length>0) return i; } catch(e) { console.log(feed.name,'allorigins:',e.message); }
  try { const i = await fetchRSSViaCorsproxy(feed); if (i.length>0) return i; } catch(e) { console.log(feed.name,'corsproxy:',e.message); }
  throw new Error('All methods failed for ' + feed.name);
}

// -- UI COMPONENTS -------------------------------------------------------------
function Toggle({ on, onChange }) {
  return (
    <div onClick={()=>onChange(!on)} style={{width:44,height:26,borderRadius:13,flexShrink:0,background:on?'#7c6af7':'#1a1a1a',border:'1px solid '+(on?'#7c6af7':'#222'),position:'relative',cursor:'pointer',transition:'background 0.2s'}}>
      <div style={{position:'absolute',top:3,left:on?21:3,width:18,height:18,borderRadius:9,background:on?'#fff':'#555',transition:'left 0.2s,background 0.2s'}}/>
    </div>
  );
}

function StepControl({ value, onChange, min, max }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <button onClick={()=>onChange(Math.max(min,value-1))} style={{width:36,height:36,borderRadius:8,border:'1px solid #222',background:'#111',color:'#c0c0c0',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>-</button>
      <span style={{fontSize:16,color:'#e8e8e8',minWidth:20,textAlign:'center',fontVariantNumeric:'tabular-nums'}}>{value}</span>
      <button onClick={()=>onChange(Math.min(max,value+1))} style={{width:36,height:36,borderRadius:8,border:'1px solid #222',background:'#111',color:'#c0c0c0',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
    </div>
  );
}

function SettingRow({ label, subtitle, last, children }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',borderBottom:last?'none':'1px solid #141414',gap:12,minHeight:52}}>
      <div style={{flex:1}}>
        <div style={{fontSize:14,color:'#e0e0e0',fontWeight:400}}>{label}</div>
        {subtitle && <div style={{fontSize:11,color:'#777',marginTop:2}}>{subtitle}</div>}
      </div>
      <div style={{flexShrink:0}}>{children}</div>
    </div>
  );
}


async function getOrCreateAnonToken() {
  try {
    const stored = localStorage.getItem('speedr_anon_token');
    const expiry = parseInt(localStorage.getItem('speedr_anon_expiry') || '0');
    if (stored && Date.now() < expiry - 60000) return stored;
    const res = await fetch(SUPABASE_URL + '/auth/v1/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    const token = data.access_token;
    const exp = data.expires_at ? data.expires_at * 1000 : Date.now() + 3600000;
    if (token) {
      localStorage.setItem('speedr_anon_token', token);
      localStorage.setItem('speedr_anon_expiry', String(exp));
    }
    return token || null;
  } catch { return null; }
}

async function saveArticleRemote(title, text, url, source) {
  try {
    const token = await getOrCreateAnonToken();
    if (!token) return;
    await fetch(SUPABASE_RSS + '?mode=save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ title, text, url: url || null, source: source || null }),
    });
  } catch(e) { console.log('Remote save failed:', e.message); }
}

async function loadLibraryRemote() {
  try {
    const token = await getOrCreateAnonToken();
    if (!token) return [];
    const res = await fetch(SUPABASE_RSS + '?mode=library', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    const data = await res.json();
    return data.articles || [];
  } catch { return []; }
}

async function loadArticleTextRemote(id) {
  try {
    const token = await getOrCreateAnonToken();
    if (!token) return null;
    const res = await fetch(SUPABASE_RSS + '?mode=get&id=' + id, {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    const data = await res.json();
    return data.article || null;
  } catch { return null; }
}

async function deleteArticleRemote(id) {
  try {
    const token = await getOrCreateAnonToken();
    if (!token) return;
    await fetch(SUPABASE_RSS + '?mode=delete&id=' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token },
    });
  } catch {}
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  return (
    <button onClick={copy} style={{marginTop:10,width:'100%',padding:'13px',border:'1px solid '+(copied?'#50d89a':'#222'),borderRadius:12,fontSize:14,fontWeight:400,cursor:'pointer',background:copied?'#0f2a1a':'transparent',color:copied?'#50d89a':'#8b7fff',transition:'all 0.2s'}}>
      {copied ? 'Copied!' : (label||'Copy')}
    </button>
  );
}

// -- MAIN APP ------------------------------------------------------------------
export default function App() {
  const [tab, setTab] = useState('reader');
  const [inputTab, setInputTab] = useState('Paste');
  const [pasteText, setPasteText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState('');
  const [activeText, setActiveText] = useState('');
  const [activeTitle, setActiveTitle] = useState('');
  const [chunks, setChunks] = useState([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState([]); // [{title, text}]

  // News
  const [category, setCategory] = useState('All');
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedStatuses, setFeedStatuses] = useState({});
  const [showSources, setShowSources] = useState(false);
  const [prevNewsScroll, setPrevNewsScroll] = useState(0);
  const [customUrl, setCustomUrl] = useState('');
  const [extraFeeds, setExtraFeeds] = useState(() => { try { return JSON.parse(localStorage.getItem('speedr_custom')||'[]'); } catch { return []; } });
  const [enabledFeeds, setEnabledFeeds] = useState(() => { try { const s = localStorage.getItem('speedr_feeds'); return s ? JSON.parse(s) : DEFAULT_ENABLED; } catch { return DEFAULT_ENABLED; } });

  // Library
  const [library, setLibrary] = useState(() => { try { return JSON.parse(localStorage.getItem('speedr_library')||'[]'); } catch { return []; } });
  const [libLoading, setLibLoading] = useState(false);
  const [libSearch, setLibSearch] = useState('');
  const [toast, setToast] = useState('');

  // Settings
  const [wpm, setWpm] = useSetting('wpm');
  const [chunkSize, setChunkSize] = useSetting('chunkSize');
  const [peripheralBefore, setPeripheralBefore] = useSetting('peripheralBefore');
  const [peripheralAfter, setPeripheralAfter] = useSetting('peripheralAfter');
  const [orpOn, setOrpOn] = useSetting('orpOn');
  const [orpColor, setOrpColor] = useSetting('orpColor');
  const [fontSize, setFontSize] = useSetting('fontSize');
  const [fontStyle, setFontStyle] = useSetting('fontStyle');
  const [variablePacing, setVariablePacing] = useSetting('variablePacing');
  const [showProgress, setShowProgress] = useSetting('showProgress');

  const settings = { wpm, chunkSize, peripheralBefore, peripheralAfter, orpOn, orpColor, fontSize, fontStyle, variablePacing, showProgress };

  const landscape = useOrientation();
  const timerRef = useRef(null);
  const holdRef = useRef(false);
  const newsScrollRef = useRef(null);
  const wordRef = useRef(null);
  const baseDelay = 60000 / wpm;

  const allFeeds = useMemo(() => [...ALL_FEEDS, ...extraFeeds], [extraFeeds]);
  const activeFeeds = useMemo(() => allFeeds.filter(f => enabledFeeds.includes(f.id)), [allFeeds, enabledFeeds]);

  // Load text into reader
  const loadText = useCallback((text, title = '') => {
    const c = tokenize(text, chunkSize);
    setChunks(c); setIdx(0); setPlaying(false); setDone(false);
    setActiveText(text); setActiveTitle(title);
  }, [chunkSize]);

  useEffect(() => {
    if (activeText) { setChunks(tokenize(activeText, chunkSize)); setIdx(0); setPlaying(false); setDone(false); }
  }, [chunkSize]);

  // Playback
  useEffect(() => {
    if (!playing || !chunks.length) { clearTimeout(timerRef.current); return; }
    if (idx >= chunks.length) { setPlaying(false); setDone(true); return; }
    timerRef.current = setTimeout(() => setIdx(i => i+1), chunkDelay(chunks[idx], baseDelay, variablePacing));
    return () => clearTimeout(timerRef.current);
  }, [playing, idx, chunks, baseDelay, variablePacing]);

  // postMessage from bookmarklet
  useEffect(() => {
    const onMsg = e => {
      if (e.data?.speedrText?.length > 50) { loadText(e.data.speedrText, e.data.speedrTitle || 'Bookmarklet'); setTab('reader'); }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [loadText]);

  // Feed cache helpers
  const loadFromCache = () => {
    try {
      const ts = parseInt(localStorage.getItem(CACHE_TS_KEY)||'0');
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached && Date.now() - ts < CACHE_TTL * 4) return JSON.parse(cached);
    } catch {}
    return null;
  };
  const saveToCache = items => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(items)); localStorage.setItem(CACHE_TS_KEY, String(Date.now())); } catch {}
  };

  const loadFeeds = useCallback(async (feeds, force = false) => {
    const cached = loadFromCache();
    const cacheAge = Date.now() - parseInt(localStorage.getItem(CACHE_TS_KEY)||'0');
    const stale = cacheAge > CACHE_TTL;
    if (cached?.length && !force) { setFeedItems(cached); if (!stale) return; }
    else setFeedLoading(true);
    try {
      const res = await Promise.allSettled(feeds.map(async f => {
        try { const i = await fetchRSS(f); setFeedStatuses(p=>({...p,[f.id]:'ok'})); return i; }
        catch { setFeedStatuses(p=>({...p,[f.id]:'fail'})); return []; }
      }));
      const all = res.flatMap(r => r.status==='fulfilled'?r.value:[]);
      if (all.length > 0) { all.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate)); setFeedItems(all); saveToCache(all); }
    } catch {}
    finally { setFeedLoading(false); }
  }, []);

  useEffect(() => { if (tab==='news') loadFeeds(activeFeeds); if (tab==='library') loadLibrary(); }, [tab]);

  // Hold to read
  const onHoldStart = useCallback(e => {
    if (!chunks.length) return;
    e.preventDefault(); holdRef.current = true;
    if (idx >= chunks.length) { setIdx(0); setDone(false); }
    setPlaying(true);
  }, [chunks.length, idx]);

  const onHoldEnd = useCallback(e => {
    if (!holdRef.current) return;
    e.preventDefault(); holdRef.current = false; setPlaying(false);
  }, []);

  // Step back on tap-left, step forward on tap-right (portrait only, not playing)
  const onStageTap = useCallback(e => {
    if (landscape) return; // landscape uses hold
    if (playing) { setPlaying(false); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    if (x < third) { setIdx(i => Math.max(0, i-3)); }
    else if (x > third*2) { setIdx(i => Math.min(chunks.length-1, i+3)); }
    else { if (idx >= chunks.length) { setIdx(0); setDone(false); } setPlaying(true); }
  }, [landscape, playing, idx, chunks.length]);

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setFetchErr(''); setFetching(true);
    try {
      let u = urlInput.trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      const text = await fetchText(u);
      if (!text || text.length < 100) throw new Error('Could not extract article text.');
      loadText(text, u); setTab('reader');
    } catch(e) { setFetchErr(e.message); }
    finally { setFetching(false); }
  };

  const handleReadArticle = async item => {
    // Save scroll position
    if (newsScrollRef.current) setPrevNewsScroll(newsScrollRef.current.scrollTop);
    // Add to history
    if (activeText) setHistory(h => [{ title: activeTitle, text: activeText }, ...h.slice(0,9)]);
    setTab('reader');
    if (item.fullContent?.length > 500) { loadText(item.fullContent, item.title); saveArticle(item.title, item.fullContent, item.link, item.source); return; }
    setFetching(true);
    try {
      const text = await fetchText(item.link);
      const ft = text.length > 200 ? text : (item.fullContent || item.title + '. ' + item.description);
      loadText(ft, item.title);
      saveArticle(item.title, ft, item.link, item.source);
    } catch { loadText(item.fullContent || item.description || item.title, item.title); }
    finally { setFetching(false); }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

  const saveArticle = (title, text, url, source) => {
    if (!text || text.length < 50) return;
    const id = 'local_' + Date.now();
    const article = { id, title: title||'Untitled', text, url:url||'', source:source||'', word_count:text.trim().split(/\s+/).filter(Boolean).length, saved_at:new Date().toISOString() };
    setLibrary(prev => { const deduped=prev.filter(a=>a.title!==article.title); const next=[article,...deduped].slice(0,300); localStorage.setItem('speedr_library',JSON.stringify(next)); return next; });
    showToast('Saved to Library');
    saveArticleRemote(article.title, text, url, source).catch(()=>{});
  };

  const deleteArticle = (id) => {
    setLibrary(prev => { const next=prev.filter(a=>a.id!==id); localStorage.setItem('speedr_library',JSON.stringify(next)); return next; });
    if (!id.startsWith('local_')) deleteArticleRemote(id).catch(()=>{});
  };

  const loadLibrary = async () => {
    setLibLoading(true);
    const local = JSON.parse(localStorage.getItem('speedr_library')||'[]');
    setLibrary(local);
    try {
      const remote = await loadLibraryRemote();
      if (remote.length > 0) {
        const localMap = Object.fromEntries(local.map(a=>[a.id,a]));
        const merged = remote.map(r=>localMap[r.id]?{...r,text:localMap[r.id].text}:r);
        const remoteIds = new Set(remote.map(r=>r.id));
        const localOnly = local.filter(a=>a.id.startsWith('local_')&&!remoteIds.has(a.id));
        const all = [...merged,...localOnly].sort((a,b)=>new Date(b.saved_at)-new Date(a.saved_at));
        setLibrary(all); localStorage.setItem('speedr_library',JSON.stringify(all));
      }
    } catch {} finally { setLibLoading(false); }
  };

  const goBackToNews = () => {
    setTab('news');
    setTimeout(() => { if (newsScrollRef.current) newsScrollRef.current.scrollTop = prevNewsScroll; }, 50);
  };

  const toggleFeed = id => {
    const u = enabledFeeds.includes(id) ? enabledFeeds.filter(f=>f!==id) : [...enabledFeeds, id];
    setEnabledFeeds(u); localStorage.setItem('speedr_feeds', JSON.stringify(u));
  };

  const addCustomFeed = () => {
    if (!customUrl.trim()) return;
    const u = customUrl.trim();
    const name = u.replace(/^https?:\/\/(www\.)?/,'').split('/')[0];
    const id = 'custom_' + Date.now();
    const feed = { id, name, url:u, category:'Custom' };
    const updated = [...extraFeeds, feed];
    setExtraFeeds(updated); localStorage.setItem('speedr_custom', JSON.stringify(updated));
    setEnabledFeeds(p => { const n=[...p,id]; localStorage.setItem('speedr_feeds',JSON.stringify(n)); return n; });
    setCustomUrl('');
  };

  // Stats
  const progress = chunks.length ? (idx/chunks.length)*100 : 0;
  const totalWords = useMemo(() => activeText.trim().split(/\s+/).filter(Boolean).length, [activeText]);
  const wordsRead = useMemo(() => chunks.slice(0,idx).reduce((s,c)=>s+c.length,0), [chunks, idx]);
  const minsLeft = Math.max(0,(totalWords-wordsRead)/wpm).toFixed(1);
  const currentChunk = chunks[Math.min(idx,chunks.length-1)] || [];
  const visibleItems = category==='All' ? feedItems : feedItems.filter(i=>i.category===category);
  const uiFading = playing && !landscape;

  const bookmarkletCode = "javascript:(function(){var sel='.body.markup,article,.post-content,.article-body,.story-body,.entry-content,main,[role=main]';var el=document.querySelector(sel);var text=(el?el.innerText:document.body.innerText).trim();if(!text||text.length<100){alert('Speedr: no article text found.');return;}var w=window.open('https://k269x9xzcd-bot.github.io/speedr/','speedr');setTimeout(function(){w.postMessage({speedrText:text,speedrTitle:document.title},'*');},1800);})();";

  // -- RENDER -------------------------------------------------------------------
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',paddingTop:'env(safe-area-inset-top)',paddingLeft:'env(safe-area-inset-left)',paddingRight:'env(safe-area-inset-right)',background:'#0d0d0d',overflow:'hidden'}}>

        {/* TOP BAR */}
        <div className={`ls-hide ui-layer${uiFading?' ui-faded':''}`} style={{flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px 10px',borderBottom:'1px solid #141414'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {/* Back button when came from news */}
            {tab==='reader' && activeTitle && prevNewsScroll > 0 && (
              <button onClick={goBackToNews} style={{background:'none',border:'none',color:'#8b7fff',cursor:'pointer',fontSize:20,padding:'0 4px 0 0',lineHeight:1}}>{'<'}</button>
            )}
            <span style={{fontSize:20,fontWeight:500,letterSpacing:-0.8,color:'#f0f0f0'}}>speedr</span>
            {activeTitle && tab==='reader' && (
              <span style={{fontSize:12,color:'#444',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeTitle}</span>
            )}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {tab==='news' && <button onClick={()=>setShowSources(s=>!s)} style={showSources?pillActive:pill}>{showSources?'done':'sources'}</button>}
            {tab==='reader' && (
              <button
                onClick={()=>{ if(chunks.length){ if(playing){setPlaying(false);}else{if(idx>=chunks.length)setIdx(0);setPlaying(true);} } }}
                style={{...pill, color: chunks.length?(playing?'#fff':'#8b7fff'):'#333', borderColor: chunks.length?(playing?'#7c6af7':'#2a2a4a'):'#1a1a1a', background: playing?'#7c6af7':'transparent', cursor: chunks.length?'pointer':'default'}}
              >
                {playing ? 'pause' : 'focus'}
              </button>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div style={{flex:'1 1 0',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',padding:'12px 16px 0',display:'flex',flexDirection:'column',minHeight:0,maxHeight:'100%'}} ref={tab==='news'?newsScrollRef:null}>

          {/* -- READER -- */}
          {tab==='reader' && (
            <div key="reader" className="slide-up" style={{display:'flex',flexDirection:'column',flex:1,gap:10,paddingBottom:12}}>

              {/* Input card - fades while playing */}
              <div className={`ui-layer ls-hide${uiFading?' ui-faded':''}`} style={card}>
                <div style={{display:'flex',borderBottom:'1px solid #141414'}}>
                  {['Paste','URL'].map(t => (
                    <button key={t} style={{flex:1,padding:'12px 0',border:'none',background:'transparent',color:inputTab===t?'#8b7fff':'#555',fontSize:13,fontWeight:inputTab===t?500:300,cursor:'pointer',borderBottom:inputTab===t?'2px solid #8b7fff':'2px solid transparent',letterSpacing:0.3}} onClick={()=>setInputTab(t)}>{t}</button>
                  ))}
                </div>
                <div style={{padding:14}}>
                  {inputTab==='Paste' && <>
                    <textarea style={{...field,minHeight:90,resize:'none'}} placeholder="Paste text to read..." value={pasteText} onChange={e=>setPasteText(e.target.value)}/>
                    <div style={{display:'flex',gap:8,marginTop:10}}>
                      <button style={btnPrimary} onClick={()=>loadText(pasteText,'Pasted text')} disabled={!pasteText.trim()}>Load</button>
                      <button style={btnGhost} onClick={()=>{setPasteText('');setActiveText('');setChunks([]);setActiveTitle('');}}>Clear</button>
                    </div>
                  </>}
                  {inputTab==='URL' && <>
                    <div style={{display:'flex',gap:8}}>
                      <input style={{...field,fontSize:15}} type="url" placeholder="https://..." value={urlInput} onChange={e=>setUrlInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleFetchUrl()}/>
                      <button style={btnPrimary} onClick={handleFetchUrl} disabled={fetching||!urlInput.trim()}>{fetching?'...':'Fetch'}</button>
                    </div>
                    {fetchErr && <div style={{color:'#e05252',fontSize:12,marginTop:8,lineHeight:1.5}}>{fetchErr}</div>}
                    {fetching && <div style={{color:'#555',fontSize:12,marginTop:8,animation:'pulse 1.4s infinite'}}>Extracting article...</div>}
                  </>}
                </div>
              </div>

              {/* READER STAGE - fills available space */}
              <div
                onPointerDown={onHoldStart}
                onPointerUp={onHoldEnd}
                onPointerCancel={onHoldEnd}
                onPointerLeave={onHoldEnd}
                onClick={onStageTap}
                className={landscape ? 'ls-reader' : ''}
                style={{...card,flex:1,minHeight:landscape?0:180,cursor:'pointer',touchAction:'none',display:'flex',flexDirection:'column',marginBottom:0}}
              >
                {/* Zone hints - portrait only, not playing */}
                {!landscape && !playing && chunks.length > 0 && !done && (
                  <div style={{display:'flex',position:'absolute',top:0,left:0,right:0,height:'100%',pointerEvents:'none',zIndex:1,opacity:0.04}}>
                    <div style={{flex:1,background:'#fff',borderRadius:'16px 0 0 16px'}}/>
                    <div style={{flex:1}}/>
                    <div style={{flex:1,background:'#fff',borderRadius:'0 16px 16px 0'}}/>
                  </div>
                )}

                <div ref={wordRef} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 24px',position:'relative'}}>
                  {fetching ? (
                    <div style={{color:'#333',fontSize:14,animation:'pulse 1.4s infinite'}}>loading...</div>
                  ) : !chunks.length ? (
                    <div style={{textAlign:'center'}}>
                      <div style={{color:'#2a2a2a',fontSize:15,marginBottom:6}}>load text above</div>
                      <div style={{color:'#1a1a1a',fontSize:11}}>or tap news to browse articles</div>
                    </div>
                  ) : done ? (
                    <div style={{textAlign:'center',display:'flex',flexDirection:'column',gap:16,alignItems:'center'}}>
                      <div style={{color:'#50d89a',fontSize:18,fontWeight:400}}>finished</div>
                      <button onClick={e=>{e.stopPropagation();setIdx(0);setDone(false);setPlaying(true);}} style={{...btnPrimary,padding:'10px 24px',fontSize:13}}>Read again</button>
                      {history.length > 0 && (
                        <button onClick={e=>{e.stopPropagation();goBackToNews();}} style={{...btnGhost,padding:'10px 24px',fontSize:13}}>Back to news</button>
                      )}
                    </div>
                  ) : idx===0 && !playing ? (
                    <div style={{textAlign:'center'}}>
                      <div style={{color:'#2a2a2a',fontSize:15,marginBottom:4}}>hold to read</div>
                      <div style={{color:'#1a1a1a',fontSize:11}}>tap left/right to skip</div>
                    </div>
                  ) : (
                    <div className="ls-words">
                      <ChunkDisplay chunk={currentChunk} settings={settings} allChunks={chunks} idx={Math.min(idx,chunks.length-1)}/>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {showProgress && !done && (
                  <div style={{height:2,background:'#111',flexShrink:0}}>
                    <div style={{height:'100%',width:progress+'%',background:'#7c6af7',transition:'width 0.12s linear'}}/>
                  </div>
                )}

                {/* Stats row */}
                <div className={`ui-layer ls-hide${uiFading?' ui-faded':''}`} style={{display:'flex',justifyContent:'space-between',padding:'9px 16px',fontSize:12,color:'#3a3a3a',flexShrink:0,gap:6}}>
                  <span>{totalWords.toLocaleString()}w</span>
                  <span>{minsLeft}m</span>
                  <span>{Math.round(progress)}%</span>
                  {activeText&&<button onClick={e=>{e.stopPropagation();saveArticle(activeTitle,activeText,urlInput,'');}} style={{padding:'3px 10px',border:'1px solid #2a2a4a',borderRadius:10,background:'transparent',color:'#8b7fff',fontSize:11,cursor:'pointer'}}>Save</button>}
                  {activeText&&<button onClick={e=>{e.stopPropagation();navigator.clipboard?.writeText(activeText);showToast('Copied!');}} style={{padding:'3px 10px',border:'1px solid #1a1a1a',borderRadius:10,background:'transparent',color:'#555',fontSize:11,cursor:'pointer'}}>Copy</button>}
                </div>
              </div>

              {/* Speed slider */}
              <div className={`ui-layer ls-hide${uiFading?' ui-faded':''}`} style={{...card,padding:'14px 16px',marginBottom:0}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:12,color:'#777',minWidth:62,fontVariantNumeric:'tabular-nums'}}>{wpm} wpm</span>
                  <input type="range" min={100} max={700} step={10} value={wpm} onChange={e=>setWpm(+e.target.value)} style={{flex:1,accentColor:'#7c6af7',cursor:'pointer'}}/>
                  <span style={{fontSize:11,color:'#333',minWidth:28,textAlign:'right'}}>700</span>
                </div>
              </div>

            </div>
          )}

          {/* -- NEWS -- */}
          {tab==='news' && !showSources && (
            <div key="news" className="slide-up">
              {/* Category pills with fade edges */}
              <div style={{position:'relative',marginBottom:12}}>
                <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:2,WebkitMaskImage:'linear-gradient(to right, transparent 0, black 8px, black calc(100% - 24px), transparent 100%)'}}>
                  {CATEGORIES.map(cat => (
                    <button key={cat} style={{padding:'7px 14px',borderRadius:20,fontSize:13,border:'none',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontWeight:400,background:category===cat?'#7c6af7':'#111',color:category===cat?'#fff':'#c0c0c0',transition:'all 0.15s'}} onClick={()=>setCategory(cat)}>{cat}</button>
                  ))}
                </div>
              </div>

              <div style={card}>
                {feedLoading && feedItems.length===0 ? (
                  <div style={{padding:48,textAlign:'center',color:'#222',fontSize:14,animation:'pulse 1.4s infinite'}}>Loading...</div>
                ) : visibleItems.length===0 ? (
                  <div style={{padding:48,textAlign:'center'}}>
                    <div style={{color:'#222',fontSize:14,marginBottom:12}}>No articles</div>
                    <button style={btnPrimary} onClick={()=>loadFeeds(activeFeeds,true)}>Refresh</button>
                  </div>
                ) : visibleItems.map((item,i) => (
                  <div key={i} onClick={()=>handleReadArticle(item)} style={{padding:'14px 16px',borderBottom:i<visibleItems.length-1?'1px solid #111':'none',display:'flex',gap:12,cursor:'pointer',WebkitTapHighlightColor:'transparent'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:'#7c6af7',marginBottom:4,fontWeight:500,letterSpacing:0.3}}>{item.source} &nbsp; {timeAgo(item.pubDate)}</div>
                      <div style={{fontSize:15,color:'#e0e0e0',lineHeight:1.45,fontWeight:400}}>{item.title}</div>
                      {item.description && <div style={{fontSize:12,color:'#555',marginTop:4,lineHeight:1.5}}>{item.description.slice(0,120)}</div>}
                    </div>
                    <div style={{color:'#2a2a2a',fontSize:16,flexShrink:0,alignSelf:'center'}}>{'>'}</div>
                  </div>
                ))}
              </div>

              <button style={{...btnGhost,width:'100%',marginTop:4,marginBottom:12}} onClick={()=>loadFeeds(activeFeeds,true)}>
                {feedLoading ? 'Refreshing...' : 'Refresh feeds'}
              </button>
            </div>
          )}

          {/* -- SOURCES -- */}
          {tab==='news' && showSources && (
            <div key="sources" className="slide-up" style={{paddingBottom:12}}>
              {CATEGORIES.filter(c=>c!=='All').map(cat => {
                const catFeeds = allFeeds.filter(f=>f.category===cat);
                if (!catFeeds.length) return null;
                return (
                  <div key={cat} style={{...card,marginBottom:10}}>
                    <div style={{padding:'9px 16px',borderBottom:'1px solid #0f0f0f',fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5}}>{cat}</div>
                    {catFeeds.map((f,i) => {
                      const on = enabledFeeds.includes(f.id);
                      const st = feedStatuses[f.id];
                      return (
                        <div key={f.id} onClick={()=>toggleFeed(f.id)} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',borderBottom:i<catFeeds.length-1?'1px solid #0f0f0f':'none'}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,color:on?'#e0e0e0':'#555',fontWeight:400,transition:'color 0.15s'}}>{f.name}</div>
                            <div style={{fontSize:11,marginTop:2,color:st==='ok'?'#50d89a':st==='fail'?'#e05252':'#333'}}>{st==='ok'?'working':st==='fail'?'failed':'not tested'}</div>
                          </div>
                          <Toggle on={on} onChange={()=>toggleFeed(f.id)}/>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={card}>
                <div style={{padding:'9px 16px',borderBottom:'1px solid #0f0f0f',fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5}}>Add RSS feed</div>
                <div style={{padding:14,display:'flex',gap:8}}>
                  <input style={{...field,fontSize:14}} placeholder="https://publication.substack.com/feed" value={customUrl} onChange={e=>setCustomUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustomFeed()}/>
                  <button style={btnPrimary} onClick={addCustomFeed}>Add</button>
                </div>
              </div>
              <button style={{...btnPrimary,width:'100%',marginTop:8,marginBottom:8}} onClick={()=>{setShowSources(false);loadFeeds(activeFeeds,true);}}>Apply and refresh</button>
            </div>
          )}

          {/* -- SETTINGS -- */}
          {tab==='library' && (
            <div key="library" className="slide-up" style={{paddingBottom:12}}>
              <div style={{padding:48,textAlign:'center',color:'#555',fontSize:15}}>Library coming soon</div>
            </div>
          )}

          {tab==='settings' && (
            <div key="settings" className="slide-up" style={{paddingBottom:12}}>

              <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Reading</div>
              <div style={{...card,marginBottom:16}}>
                <SettingRow label="Speed" subtitle={wpm + ' WPM'}>
                  <div style={{display:'flex',alignItems:'center',gap:8,width:140}}>
                    <input type="range" min={100} max={700} step={10} value={wpm} onChange={e=>setWpm(+e.target.value)} style={{flex:1,accentColor:'#7c6af7'}}/>
                  </div>
                </SettingRow>
                <SettingRow label="Chunk size" subtitle="Words shown at once">
                  <StepControl value={chunkSize} onChange={setChunkSize} min={1} max={3}/>
                </SettingRow>
                <SettingRow label="Context before" subtitle="Dimmed preview words">
                  <StepControl value={peripheralBefore} onChange={setPeripheralBefore} min={0} max={5}/>
                </SettingRow>
                <SettingRow label="Context after" subtitle="Dimmed upcoming words">
                  <StepControl value={peripheralAfter} onChange={setPeripheralAfter} min={0} max={5}/>
                </SettingRow>
                <SettingRow label="Variable pacing" subtitle="Slow at punctuation">
                  <Toggle on={variablePacing} onChange={setVariablePacing}/>
                </SettingRow>
                <SettingRow label="Progress bar" last>
                  <Toggle on={showProgress} onChange={setShowProgress}/>
                </SettingRow>
              </div>

              <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Display</div>
              <div style={{...card,marginBottom:16}}>
                <SettingRow label="ORP highlight" subtitle="Marks recognition point">
                  <Toggle on={orpOn} onChange={setOrpOn}/>
                </SettingRow>
                <SettingRow label="Highlight color">
                  <div style={{display:'flex',gap:10}}>
                    {['#e05252','#a78bfa','#f0a500','#50d89a'].map(c => (
                      <div key={c} onClick={()=>setOrpColor(c)} style={{width:28,height:28,borderRadius:'50%',background:c,border:orpColor===c?'2px solid #fff':'2px solid transparent',cursor:'pointer',transition:'border 0.15s'}}/>
                    ))}
                  </div>
                </SettingRow>
                <SettingRow label="Font size">
                  <div style={{display:'flex',gap:6}}>
                    {[['small','S'],['medium','M'],['large','L'],['xlarge','XL']].map(([k,l]) => (
                      <button key={k} onClick={()=>setFontSize(k)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(fontSize===k?'#7c6af7':'#222'),background:fontSize===k?'#7c6af7':'transparent',color:fontSize===k?'#fff':'#c0c0c0',fontSize:13,fontWeight:400,cursor:'pointer',minWidth:40,minHeight:36}}>{l}</button>
                    ))}
                  </div>
                </SettingRow>
                <SettingRow label="Font style" last>
                  <div style={{display:'flex',gap:6}}>
                    {[['mono','Mono'],['condensed','Sans'],['serif','Serif']].map(([k,l]) => (
                      <button key={k} onClick={()=>setFontStyle(k)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(fontStyle===k?'#7c6af7':'#222'),background:fontStyle===k?'#7c6af7':'transparent',color:fontStyle===k?'#fff':'#c0c0c0',fontSize:13,fontWeight:400,cursor:'pointer',minWidth:44,minHeight:36}}>{l}</button>
                    ))}
                  </div>
                </SettingRow>
              </div>

              <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Bookmarklet</div>
              <div style={{...card,marginBottom:16}}>
                <div style={{padding:16}}>
                  <p style={{fontSize:13,color:'#b0b0b0',lineHeight:1.7,marginBottom:12}}>
                    On iPhone: bookmark any page in Safari, edit the bookmark, replace its URL with the code below. Tap it on any article to send the full text to Speedr - works on paywalled sites you are already logged into.
                  </p>
                  <textarea readOnly value={bookmarkletCode} rows={3} style={{...field,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#8b7fff',resize:'none'}}/>
                  <CopyButton text={bookmarkletCode} label="Copy bookmarklet code"/>
                </div>
              </div>

              {/* Reading history */}
              {history.length > 0 && <>
                <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Recent</div>
                <div style={{...card,marginBottom:16}}>
                  {history.map((h,i) => (
                    <div key={i} onClick={()=>{loadText(h.text,h.title);setTab('reader');}} style={{padding:'12px 16px',borderBottom:i<history.length-1?'1px solid #0f0f0f':'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                      <div style={{fontSize:14,color:'#c0c0c0',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.title||'Untitled'}</div>
                      <div style={{fontSize:11,color:'#333',flexShrink:0}}>{h.text.split(/\s+/).length} words</div>
                    </div>
                  ))}
                </div>
              </>}

            </div>
          )}
        </div>

        {/* BOTTOM TAB BAR */}
        <div className={`ls-hide ui-layer${uiFading?' ui-faded':''}`} style={{flexShrink:0,display:'flex',borderTop:'1px solid #141414',background:'#0d0d0d',paddingBottom:'env(safe-area-inset-bottom)',minHeight:58}}>
          {[['reader','R','Reader'],['news','N','News'],['library','B','Library'],['settings','\u2699','Settings']].map(([id,icon,label]) => (
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'10px 0 8px',border:'none',background:'transparent',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,WebkitTapHighlightColor:'transparent'}}>
              <span style={{fontSize:id==='settings'?20:19,fontFamily:id==='settings'?'inherit':"'JetBrains Mono',monospace",fontWeight:id==='settings'?400:500,color:tab===id?'#8b7fff':'#3a3a3a',transition:'color 0.15s'}}>{icon}</span>
              <span style={{fontSize:10,fontWeight:400,letterSpacing:0.5,color:tab===id?'#8b7fff':'#3a3a3a',transition:'color 0.15s'}}>{label}</span>
            </button>
          ))}
        </div>

      </div>
      {toast && (
        <div style={{position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',background:'#7c6af7',color:'#fff',padding:'9px 22px',borderRadius:20,fontSize:13,fontWeight:500,zIndex:300,whiteSpace:'nowrap',pointerEvents:'none',boxShadow:'0 4px 16px rgba(124,106,247,0.4)'}}>
          {toast}
        </div>
      )}
    </>
  );
}

const card = { background:'#111111',borderRadius:16,border:'1px solid #1a1a1a',overflow:'hidden',marginBottom:12 };
const field = { width:'100%',boxSizing:'border-box',padding:'12px 14px',background:'#080808',color:'#d8d8d8',border:'1px solid #1a1a1a',borderRadius:12,fontSize:16,fontFamily:"'Inter',sans-serif",fontWeight:300,outline:'none',WebkitAppearance:'none',display:'block' };
const btnPrimary = { padding:'12px 18px',border:'none',borderRadius:12,fontSize:14,fontWeight:400,cursor:'pointer',background:'#7c6af7',color:'#fff',whiteSpace:'nowrap',flexShrink:0,minHeight:44 };
const btnGhost = { padding:'12px 16px',border:'1px solid #1a1a1a',borderRadius:12,fontSize:14,fontWeight:300,cursor:'pointer',background:'transparent',color:'#c0c0c0',whiteSpace:'nowrap',minHeight:44 };
const pill = { padding:'7px 14px',border:'1px solid #1a1a1a',borderRadius:20,fontSize:12,fontWeight:400,cursor:'pointer',background:'transparent',color:'#c0c0c0' };
const pillActive = { ...pill,background:'#7c6af7',color:'#fff',border:'1px solid #7c6af7' };
