import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const ALL_FEEDS = [
  { id:'npr-us',       name:'NPR News',             url:'https://feeds.npr.org/1001/rss.xml',                   category:'US' },
  { id:'reuters-us',   name:'Reuters',               url:'https://feeds.reuters.com/reuters/topNews',             category:'US' },
  { id:'bbc-world',    name:'BBC World',             url:'https://feeds.bbci.co.uk/news/world/rss.xml',          category:'World' },
  { id:'aljazeera',    name:'Al Jazeera',            url:'https://www.aljazeera.com/xml/rss/all.xml',            category:'World' },
  { id:'dw',           name:'DW News',               url:'https://rss.dw.com/rdf/rss-en-all',                    category:'World' },
  { id:'axios-pol',    name:'Axios',                 url:'https://api.axios.com/feed/',                          category:'Politics' },
  { id:'guardian-pol', name:'The Guardian',          url:'https://www.theguardian.com/politics/rss',             category:'Politics' },
  { id:'nyp-biz',      name:'NY Post Business',      url:'https://nypost.com/business/feed/',                    category:'Business' },
  { id:'verge',        name:'The Verge',             url:'https://www.theverge.com/rss/index.xml',               category:'Business' },
  { id:'npr-health',   name:'NPR Health',            url:'https://feeds.npr.org/1128/rss.xml',                   category:'Health' },
  { id:'nyp-ent',      name:'NY Post Entertainment', url:'https://nypost.com/entertainment/feed/',               category:'Entertainment' },
  { id:'ars',          name:'Ars Technica',          url:'https://feeds.arstechnica.com/arstechnica/index',      category:'Science' },
  { id:'npr-sci',      name:'NPR Science',           url:'https://feeds.npr.org/1007/rss.xml',                   category:'Science' },
  { id:'nyp-metro',    name:'NY Post Metro',         url:'https://nypost.com/metro/feed/',                       category:'Local' },
  { id:'gothamist',    name:'Gothamist',             url:'https://gothamist.com/feed',                           category:'Local' },
  { id:'ny1',          name:'Spectrum NY1',          url:'https://www.ny1.com/nyc/all-boroughs/rss.xml',         category:'Local' },
  { id:'moneyprinter', name:'Money Printer',         url:'https://themoneyprinter.substack.com/feed',            category:'Substack' },
  { id:'charlie',      name:'Charlie Garcia',        url:'https://charliepgarcia.substack.com/feed',             category:'Substack' },
];

const CATEGORIES = ['All','US','World','Politics','Business','Health','Entertainment','Science','Local','Substack'];
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
const ALLORIGINS = 'https://api.allorigins.win/get?url=';
const SUPABASE_RSS = 'https://reojrvyczjrdaobgnrod.supabase.co/functions/v1/rss';
const FEED_CACHE_MS = 5 * 60 * 1000;
const DEFAULT_ENABLED = ALL_FEEDS.map(f => f.id);

const DEFAULT_SETTINGS = {
  wpm: 280,
  chunkSize: 2,        // words per chunk: 1, 2, 3
  peripheralBefore: 0, // words shown dimmed before focal chunk
  peripheralAfter: 0,  // words shown dimmed after focal chunk
  orpOn: true,         // ORP highlight
  orpColor: '#e05252',
  fontSize: 'medium',  // small, medium, large, xlarge
  fontStyle: 'mono',   // mono, condensed, serif
  variablePacing: true,// slow down at punctuation
  darkBg: '#0d0d0d',
  showProgress: true,
};

const FONT_MAP = {
  mono:      "'JetBrains Mono', 'Courier New', monospace",
  condensed: "'Inter', system-ui, sans-serif",
  serif:     "Georgia, 'Times New Roman', serif",
};

const FONT_SIZE_MAP = {
  small:  'clamp(18px,4vw,28px)',
  medium: 'clamp(26px,6vw,42px)',
  large:  'clamp(32px,8vw,54px)',
  xlarge: 'clamp(40px,10vw,68px)',
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  html { height:100%; }
  body {
    height:100%;
    background:#0d0d0d;
    color:#e0e0e0;
    font-family:'Inter',system-ui,sans-serif;
    font-weight:300;
    -webkit-font-smoothing:antialiased;
    -moz-osx-font-smoothing:grayscale;
    overscroll-behavior:none;
    overflow:hidden;
    position:fixed;
    width:100%;
    -webkit-user-select:none;
    user-select:none;
  }
  #root { height:100%; }
  input,textarea,button { font-family:inherit; font-weight:300; }
  textarea,input { -webkit-user-select:text; user-select:text; }
  ::placeholder { color:#333333; }
  ::-webkit-scrollbar { display:none; }
  * { scrollbar-width:none; }
  @keyframes slideUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.15} }
  .slide-up { animation:slideUp 0.16s ease-out both; }
  .ui-layer { transition:none; }
  .ui-layer.hidden { opacity:0; pointer-events:none; }

  /* Landscape: fullscreen reader, instant hide everything else */
  @media (orientation:landscape) {
    .landscape-hide { display:none !important; }
    .landscape-reader {
      position:fixed !important; inset:0 !important; z-index:50 !important;
      border-radius:0 !important; border:none !important;
    }
    .landscape-words { font-size:clamp(28px,7vh,56px) !important; }
  }

  /* PWA / standalone: hide Safari chrome hint */
  @media (display-mode:standalone) {
    .safari-hint { display:none !important; }
  }
  /* ensure body fills exact screen */
  html, body, #root {
    height: 100%;
    height: 100dvh;
    max-height: 100dvh;
  }
`;

function useOrientation() {
  const [landscape, setLandscape] = useState(() => window.matchMedia('(orientation:landscape)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(orientation:landscape)');
    const h = e => setLandscape(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return landscape;
}

function useSetting(key) {
  const [val, setVal] = useState(() => {
    try {
      const saved = localStorage.getItem('speedr_' + key);
      return saved !== null ? JSON.parse(saved) : DEFAULT_SETTINGS[key];
    } catch { return DEFAULT_SETTINGS[key]; }
  });
  const set = useCallback(v => {
    setVal(v);
    localStorage.setItem('speedr_' + key, JSON.stringify(v));
  }, [key]);
  return [val, set];
}

function timeAgo(d) {
  if (!d) return '';
  const m = (Date.now() - new Date(d)) / 60000;
  if (m < 60) return Math.round(m) + 'm';
  if (m < 1440) return Math.round(m/60) + 'h';
  return Math.round(m/1440) + 'd';
}

function tokenize(text, chunkSize) {
  if (!text) return [];
  const words = text.replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  const out = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const endsSentence = /[.!?]$/.test(w);
    const longWord = w.length > 12;
    if (chunkSize === 1 || endsSentence || longWord || !words[i+1]) {
      out.push([w]);
      i++;
    } else if (chunkSize === 2) {
      out.push([w, words[i+1]].filter(Boolean));
      i += 2;
    } else {
      // chunk size 3
      out.push([w, words[i+1], words[i+2]].filter(Boolean));
      i += 3;
    }
  }
  return out;
}

function delayMs(chunk, baseMs, variablePacing) {
  if (!variablePacing) return baseMs * chunk.length;
  const last = chunk[chunk.length-1];
  const mult = '.!?'.includes(last[last.length-1]) ? 1.8 : ',:;'.includes(last[last.length-1]) ? 1.3 : 1;
  return baseMs * chunk.length * mult;
}

function OrpWord({ word, on, color }) {
  const s = word.replace(/[.,!?;:]+$/,'');
  const p = word.slice(s.length);
  const i = Math.max(0, Math.floor(s.length * 0.3));
  if (!on) return <span>{word}</span>;
  return <span>{s.slice(0,i)}<span style={{color, fontWeight:600}}>{s[i]}</span>{s.slice(i+1)}{p}</span>;
}

function ChunkDisplay({ chunk, settings, peripheral, allChunks, idx }) {
  const font = FONT_MAP[settings.fontStyle];
  const size = FONT_SIZE_MAP[settings.fontSize];

  // Peripheral words before
  const beforeWords = [];
  if (settings.peripheralBefore > 0) {
    let wi = idx - 1;
    let count = 0;
    while (wi >= 0 && count < settings.peripheralBefore) {
      const prevChunk = allChunks[wi];
      prevChunk.forEach(w => { if (count < settings.peripheralBefore) { beforeWords.unshift(w); count++; } });
      wi--;
    }
  }

  // Peripheral words after
  const afterWords = [];
  if (settings.peripheralAfter > 0) {
    let wi = idx + 1;
    let count = 0;
    while (wi < allChunks.length && count < settings.peripheralAfter) {
      const nextChunk = allChunks[wi];
      nextChunk.forEach(w => { if (count < settings.peripheralAfter) { afterWords.push(w); count++; } });
      wi++;
    }
  }

  return (
    <div style={{
      fontFamily: font,
      fontSize: size,
      textAlign:'center', lineHeight:1.3, letterSpacing:0.3,
      display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4em',
      flexWrap:'nowrap',
    }}>
      {beforeWords.length > 0 && (
        <span style={{color:'#c0c0c0', fontSize:'0.65em'}}>
          {beforeWords.join(' ')}
        </span>
      )}
      <span style={{color:'#f0f0f0'}}>
        {chunk.map((w, i) => (
          <React.Fragment key={i}>
            {i > 0 && ' '}
            <OrpWord word={w} on={settings.orpOn} color={settings.orpColor} />
          </React.Fragment>
        ))}
      </span>
      {afterWords.length > 0 && (
        <span style={{color:'#c0c0c0', fontSize:'0.65em'}}>
          {afterWords.join(' ')}
        </span>
      )}
    </div>
  );
}

async function stripJinaHeaders(text) {
  const lines = text.split('\n');
  const skip = ['Title:','URL:','Published','Source:','Author:','Description:'];
  let start = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const l = lines[i].trim();
    if (!l || skip.some(p => l.startsWith(p))) { start = i + 1; continue; }
    if (l.length > 60) { start = i; break; }
  }
  return lines.slice(start).join('\n').trim();
}

async function fetchViaJina(url) {
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
  const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url), {signal:AbortSignal.timeout(10000)});
  const data = await res.json();
  const html = data.contents || '';
  if (!html || html.length < 500) throw new Error('Empty');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,nav,footer,header,aside,form,.nav,.footer,.sidebar,.ad,.social,.comments,.newsletter,.paywall,iframe,video').forEach(n=>n.remove());
  for (const sel of ['article','main','[role=main]','.article-body','.post-content','.entry-content','.story-body','.article__body','.body.markup']) {
    const el = doc.querySelector(sel);
    if (el) {
      const paras = Array.from(el.querySelectorAll('p')).map(p=>p.textContent.trim()).filter(t=>t.length>40);
      if (paras.length > 2) return paras.join('\n\n');
    }
  }
  const allParas = Array.from(doc.querySelectorAll('p')).map(p=>p.textContent.trim()).filter(t=>t.length>50);
  if (allParas.length > 2) return allParas.join('\n\n');
  throw new Error('No paragraphs');
}

async function fetchText(url) {
  try { const t = await fetchViaJina(url); if (t.length > 300) return t; } catch(e) { console.log('Jina:', e.message); }
  try { const t = await fetchViaAllOrigins(url); if (t.length > 200) return t; } catch(e) { console.log('AllOrigins:', e.message); }
  throw new Error('Could not extract article. Use the bookmarklet for paywalled sites.');
}

function parseRSSXML(xmlStr, feed) {
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
  const isAtom = !!doc.querySelector('feed');
  const items = Array.from(doc.querySelectorAll(isAtom ? 'entry' : 'item')).slice(0, 20);
  return items.map(item => {
    const get = sel => item.querySelector(sel)?.textContent?.trim() || '';
    const title = get('title');
    const link = isAtom
      ? (item.querySelector('link[rel=alternate]')?.getAttribute('href') || item.querySelector('link')?.getAttribute('href') || get('link'))
      : get('link');
    const desc = (get('description') || get('summary')).replace(/<[^>]+>/g,'').trim();
    const fullText = (get('content') || '').replace(/<[^>]+>/g,'').trim();
    const pubDate = get('pubDate') || get('published') || get('updated') || '';
    return { title, link, description: desc.slice(0,200), fullContent: fullText.length > desc.length ? fullText : '', pubDate, source: feed.name, category: feed.category, feedId: feed.id };
  }).filter(i => i.title);
}

function decodeAllOriginsContent(raw) {
  // allorigins sometimes base64-encodes binary/RSS responses as data URIs
  if (raw && raw.startsWith('data:') && raw.includes('base64,')) {
    const b64 = raw.split('base64,')[1];
    try {
      return atob(b64);
    } catch(e) { return raw; }
  }
  return raw;
}

async function fetchRSSViaAllOrigins(feed) {
  const bust = '&t=' + Math.floor(Date.now() / 300000);
  const res = await fetch(ALLORIGINS + encodeURIComponent(feed.url) + bust, {
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error('allorigins HTTP ' + res.status);
  const data = await res.json();
  let xml = decodeAllOriginsContent(data.contents || '');
  if (!xml || xml.length < 100) throw new Error('Empty response');
  if (!xml.includes('<item') && !xml.includes('<entry')) throw new Error('No RSS items in response');
  return parseRSSXML(xml, feed);
}

async function fetchRSSViaRss2json(feed) {
  const bust = '&_=' + Math.floor(Date.now() / 300000);
  const res = await fetch(RSS2JSON + encodeURIComponent(feed.url) + '&count=20' + bust, {
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error('rss2json HTTP ' + res.status);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'rss2json error');
  return (data.items||[]).slice(0,20).map(item => {
    const full = (item.content||'').replace(/<[^>]+>/g,'').trim();
    const desc = (item.description||'').replace(/<[^>]+>/g,'').trim();
    return { title:item.title||'', link:item.link||'', description:desc.slice(0,200), fullContent:full.length>desc.length?full:'', pubDate:item.pubDate||'', source:feed.name, category:feed.category, feedId:feed.id };
  }).filter(i => i.title);
}

// Use a public CORS proxy that works better for RSS
async function fetchRSSViaCorsproxy(feed) {
  const url = 'https://corsproxy.io/?' + encodeURIComponent(feed.url);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('corsproxy HTTP ' + res.status);
  const xml = await res.text();
  if (!xml.includes('<item') && !xml.includes('<entry')) throw new Error('No RSS items');
  return parseRSSXML(xml, feed);
}

async function fetchRSSViaSupabase(feed) {
  const params = new URLSearchParams({
    url: feed.url,
    name: feed.name,
    cat: feed.category,
    t: String(Math.floor(Date.now() / 300000)), // 5min cache bust
  });
  const res = await fetch(SUPABASE_RSS + '?' + params, {
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('Supabase RSS HTTP ' + res.status);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.error || 'Supabase RSS error');
  return data.items || [];
}

async function fetchRSS(feed) {
  // 1. Supabase Edge Function (server-side fetch, no CORS issues)
  try {
    const items = await fetchRSSViaSupabase(feed);
    if (items.length > 0) return items;
  } catch(e) { console.log(feed.name + ' supabase:', e.message); }

  // 2. allorigins fallback
  try {
    const items = await fetchRSSViaAllOrigins(feed);
    if (items.length > 0) return items;
  } catch(e) { console.log(feed.name + ' allorigins:', e.message); }

  // 3. corsproxy fallback
  try {
    const items = await fetchRSSViaCorsproxy(feed);
    if (items.length > 0) return items;
  } catch(e) { console.log(feed.name + ' corsproxy:', e.message); }

  // 4. rss2json last resort
  try {
    const items = await fetchRSSViaRss2json(feed);
    if (items.length > 0) return items;
  } catch(e) { console.log(feed.name + ' rss2json:', e.message); }

  throw new Error('All methods failed for ' + feed.name);
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(()=>setCopied(false), 2000); });
  return (
    <button onClick={copy} style={{marginTop:10,width:'100%',padding:'12px',border:'none',borderRadius:12,fontSize:14,fontWeight:400,cursor:'pointer',background:copied?'#0f2a1a':'#111',color:copied?'#50d89a':'#8b7fff',border:'1px solid '+(copied?'#50d89a':'#1f1f1f'),transition:'all 0.2s'}}>
      {copied ? 'Copied!' : (label || 'Copy')}
    </button>
  );
}

function Toggle({ on, onChange }) {
  return (
    <div onClick={()=>onChange(!on)} style={{width:44,height:26,borderRadius:13,flexShrink:0,background:on?'#7c6af7':'#1a1a1a',border:'1px solid '+(on?'#7c6af7':'#555'),position:'relative',cursor:'pointer',transition:'background 0.2s'}}>
      <div style={{position:'absolute',top:3,left:on?21:3,width:18,height:18,borderRadius:9,background:on?'#fff':'#444',transition:'left 0.2s,background 0.2s'}}/>
    </div>
  );
}

function SettingRow({ label, subtitle, children }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',borderBottom:'1px solid #141414',gap:12}}>
      <div>
        <div style={{fontSize:14,color:'#e8e8e8',fontWeight:400}}>{label}</div>
        {subtitle && <div style={{fontSize:11,color:'#b0b0b0',marginTop:2}}>{subtitle}</div>}
      </div>
      <div style={{flexShrink:0}}>{children}</div>
    </div>
  );
}

function StepControl({ value, onChange, min, max, label }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <button onClick={()=>onChange(Math.max(min,value-1))} style={{width:28,height:28,borderRadius:6,border:'1px solid #222',background:'#111',color:'#c0c0c0',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>-</button>
      <span style={{fontSize:14,color:'#d8d8d8',minWidth:24,textAlign:'center'}}>{value}{label||''}</span>
      <button onClick={()=>onChange(Math.min(max,value+1))} style={{width:28,height:28,borderRadius:6,border:'1px solid #222',background:'#111',color:'#c0c0c0',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('reader');
  const [inputTab, setInputTab] = useState('paste');
  const [pasteText, setPasteText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState('');
  const [activeText, setActiveText] = useState('');
  const [chunks, setChunks] = useState([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [category, setCategory] = useState('All');
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedStatuses, setFeedStatuses] = useState({});
  const [showSources, setShowSources] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [extraFeeds, setExtraFeeds] = useState(() => { try { return JSON.parse(localStorage.getItem('speedr_custom')||'[]'); } catch { return []; } });
  const [enabledFeeds, setEnabledFeeds] = useState(() => { try { const s = localStorage.getItem('speedr_feeds'); return s ? JSON.parse(s) : DEFAULT_ENABLED; } catch { return DEFAULT_ENABLED; } });

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
  const lastFetchRef = useRef(0);

  const allFeeds = useMemo(() => [...ALL_FEEDS, ...extraFeeds], [extraFeeds]);
  const activeFeeds = useMemo(() => allFeeds.filter(f => enabledFeeds.includes(f.id)), [allFeeds, enabledFeeds]);
  const baseDelay = 60000 / wpm;

  useEffect(() => {
    if (activeText) { setChunks(tokenize(activeText, chunkSize)); setIdx(0); setPlaying(false); }
  }, [activeText, chunkSize]);

  useEffect(() => {
    if (!playing || !chunks.length) { clearTimeout(timerRef.current); return; }
    if (idx >= chunks.length) { setPlaying(false); return; }
    timerRef.current = setTimeout(() => setIdx(i=>i+1), delayMs(chunks[idx], baseDelay, variablePacing));
    return () => clearTimeout(timerRef.current);
  }, [playing, idx, chunks, baseDelay, variablePacing]);

  useEffect(() => {
    if (tab === 'news') {
      loadFeeds(activeFeeds);
    }
  }, [tab]);

  useEffect(() => {
    function onMessage(e) {
      if (e.data && typeof e.data.speedrText === 'string' && e.data.speedrText.length > 50) {
        setActiveText(e.data.speedrText); setTab('reader'); setInputTab('paste');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const loadFeeds = useCallback(async (feeds) => {
    setFeedLoading(true); setFeedStatuses({});
    const res = await Promise.allSettled(feeds.map(async f => {
      try { const items = await fetchRSS(f); setFeedStatuses(p=>({...p,[f.id]:'ok'})); return items; }
      catch { setFeedStatuses(p=>({...p,[f.id]:'fail'})); return []; }
    }));
    const all = res.flatMap(r => r.status==='fulfilled'?r.value:[]);
    all.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate));
    setFeedItems(all); setFeedLoading(false);
  }, []);

  const onHoldStart = useCallback((e) => {
    if (!chunks.length) return;
    e.preventDefault();
    holdRef.current = true;
    if (idx >= chunks.length) setIdx(0);
    setPlaying(true);
  }, [chunks.length, idx]);

  const onHoldEnd = useCallback((e) => {
    if (!holdRef.current) return;
    e.preventDefault();
    holdRef.current = false;
    setPlaying(false);
  }, []);

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setFetchErr(''); setFetching(true);
    try {
      let u = urlInput.trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      const text = await fetchText(u);
      if (!text || text.length < 100) throw new Error('Could not extract article text.');
      setActiveText(text); setTab('reader'); setInputTab('paste');
    } catch(e) { setFetchErr(e.message); }
    finally { setFetching(false); }
  };

  const handleReadArticle = async (item) => {
    setTab('reader');
    if (item.fullContent && item.fullContent.length > 300) { setActiveText(item.fullContent); return; }
    setFetching(true);
    try {
      const text = await fetchText(item.link);
      setActiveText(text.length > 200 ? text : (item.fullContent || item.title + '. ' + item.description));
    } catch { setActiveText(item.fullContent || item.title + '. ' + item.description); }
    finally { setFetching(false); }
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
    const feed = {id, name, url:u, category:'Custom'};
    const updated = [...extraFeeds, feed];
    setExtraFeeds(updated); localStorage.setItem('speedr_custom', JSON.stringify(updated));
    setEnabledFeeds(p=>{const n=[...p,id];localStorage.setItem('speedr_feeds',JSON.stringify(n));return n;});
    setCustomUrl('');
  };

  const progress = chunks.length ? (idx/chunks.length)*100 : 0;
  const totalWords = useMemo(() => activeText.trim().split(/\s+/).filter(Boolean).length, [activeText]);
  const wordsRead = chunks.slice(0,idx).reduce((s,c)=>s+c.length,0);
  const minsLeft = Math.max(0,(totalWords-wordsRead)/wpm).toFixed(1);
  const currentChunk = chunks[Math.min(idx,chunks.length-1)] || [];
  const done = chunks.length > 0 && idx >= chunks.length;
  const uiFaded = playing;
  const visibleItems = category==='All' ? feedItems : feedItems.filter(i=>i.category===category);

  const bookmarkletCode = "javascript:(function(){var sel='.body.markup,article,.post-content,.article-body,.story-body,.entry-content,main,[role=main]';var el=document.querySelector(sel);var text=(el?el.innerText:document.body.innerText).trim();if(!text||text.length<100){alert('Speedr: no article text found.');return;}var w=window.open('https://k269x9xzcd-bot.github.io/speedr/','speedr');setTimeout(function(){w.postMessage({speedrText:text},'*');},1800);})();";

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,display:'flex',flexDirection:'column',paddingTop:'env(safe-area-inset-top)',paddingLeft:'env(safe-area-inset-left)',paddingRight:'env(safe-area-inset-right)',background:'#0d0d0d',overflow:'hidden'}}>

        {/* TOP BAR */}
        <div className={`ui-layer landscape-hide${uiFaded?' hidden':''}`} style={{flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px 10px',borderBottom:'1px solid #141414'}}>
          <span style={{fontSize:20,fontWeight:500,letterSpacing:-0.8,color:'#f0f0f0'}}>speedr</span>
          <div style={{display:'flex',gap:8}}>
            {tab==='news' && (
              <button onClick={()=>setShowSources(s=>!s)} style={showSources?pillActive:pill}>
                {showSources?'done':'sources'}
              </button>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div style={{flex:'1 1 0',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',padding:'12px 16px 24px',display:'flex',flexDirection:'column',minHeight:0,maxHeight:'100%'}}>

          {/* READER */}
          {tab==='reader' && (
            <div key="reader" className="slide-up" style={{display:'flex',flexDirection:'column',flex:1,gap:12}}>

              {/* Input card */}
              <div className={`ui-layer landscape-hide${uiFaded?' hidden':''}`} style={card}>
                <div style={{display:'flex',borderBottom:'1px solid #141414'}}>
                  {['paste','url'].map(t => (
                    <button key={t} style={{flex:1,padding:'12px 0',border:'none',background:'transparent',color:inputTab===t?'#8b7fff':'#666',fontSize:13,fontWeight:400,cursor:'pointer',borderBottom:inputTab===t?'2px solid #8b7fff':'2px solid transparent'}} onClick={()=>setInputTab(t)}>{t}</button>
                  ))}
                </div>
                <div style={{padding:14}}>
                  {inputTab==='paste' && <>
                    <textarea style={{...field,minHeight:100,resize:'none'}} placeholder="Paste text to read..." value={pasteText} onChange={e=>setPasteText(e.target.value)}/>
                    <div style={{display:'flex',gap:8,marginTop:10}}>
                      <button style={btnPrimary} onClick={()=>setActiveText(pasteText)} disabled={!pasteText.trim()}>Load</button>
                      <button style={btnGhost} onClick={()=>{setPasteText('');setActiveText('');setChunks([]);}}>Clear</button>
                    </div>
                  </>}
                  {inputTab==='url' && <>
                    <div style={{display:'flex',gap:8}}>
                      <input style={{...field,fontSize:15}} type="url" placeholder="https://..." value={urlInput} onChange={e=>setUrlInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleFetchUrl()}/>
                      <button style={btnPrimary} onClick={handleFetchUrl} disabled={fetching||!urlInput.trim()}>{fetching?'...':'Fetch'}</button>
                    </div>
                    {fetchErr && <div style={{color:'#e05252',fontSize:12,marginTop:8,lineHeight:1.5}}>{fetchErr}</div>}
                    {fetching && <div style={{color:'#c0c0c0',fontSize:12,marginTop:8,animation:'pulse 1.4s infinite'}}>Extracting article...</div>}
                  </>}
                </div>
              </div>

              {/* READER STAGE */}
              <div
                onPointerDown={onHoldStart}
                onPointerUp={onHoldEnd}
                onPointerCancel={onHoldEnd}
                onPointerLeave={onHoldEnd}
                className={landscape ? 'landscape-reader' : ''}
                style={{...card,flex:(playing||landscape)?1:0,minHeight:(playing||landscape)?0:200,cursor:'pointer',touchAction:'none',transition:'flex 0.3s ease, min-height 0.3s ease',display:'flex',flexDirection:'column'}}
              >
                <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 28px'}}>
                  {fetching ? (
                    <div style={{color:'#c0c0c0',fontSize:14,animation:'pulse 1.4s infinite'}}>loading...</div>
                  ) : !chunks.length ? (
                    <span style={{color:'#c0c0c0',fontSize:15}}>load text above</span>
                  ) : done ? (
                    <span style={{color:'#50d89a',fontSize:16,fontWeight:400}}>done</span>
                  ) : idx===0 && !playing ? (
                    <span style={{color:'#c0c0c0',fontSize:15}}>hold to read</span>
                  ) : (
                    <div className="landscape-words">
                      <ChunkDisplay chunk={currentChunk} settings={settings} allChunks={chunks} idx={Math.min(idx,chunks.length-1)}/>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {showProgress && (
                  <div className={landscape?'landscape-hide':''} style={{height:2,background:'#1a1a1a',flexShrink:0}}>
                    <div style={{height:'100%',width:progress+'%',background:'#7c6af7',transition:'width 0.12s linear'}}/>
                  </div>
                )}

                {/* Stats */}
                {!uiFaded && !landscape && (
                  <div style={{display:'flex',justifyContent:'space-between',padding:'9px 16px',fontSize:12,color:'#c0c0c0',flexShrink:0}}>
                    <span>{totalWords.toLocaleString()} words</span>
                    <span>{minsLeft} min left</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                )}
              </div>

              {/* Speed slider */}
              <div className={`ui-layer landscape-hide${uiFaded?' hidden':''}`} style={{...card,padding:'14px 16px'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:13,color:'#b0b0b0',minWidth:58}}>{wpm} wpm</span>
                  <input type="range" min={100} max={700} step={10} value={wpm} onChange={e=>setWpm(+e.target.value)} style={{flex:1,accentColor:'#7c6af7',cursor:'pointer'}}/>
                </div>
              </div>

            </div>
          )}

          {/* NEWS */}
          {tab==='news' && !showSources && (
            <div key="news" className="slide-up">
              <div style={{display:'flex',gap:6,marginBottom:12,overflowX:'auto',paddingBottom:2}}>
                {CATEGORIES.map(cat => (
                  <button key={cat} style={{padding:'7px 14px',borderRadius:20,fontSize:13,border:'none',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontWeight:400,background:category===cat?'#7c6af7':'#111',color:category===cat?'#fff':'#999',transition:'all 0.15s'}} onClick={()=>setCategory(cat)}>{cat}</button>
                ))}
              </div>
              <div style={card}>
                {feedLoading ? (
                  <div style={{padding:48,textAlign:'center',color:'#c0c0c0',fontSize:14,animation:'pulse 1.4s infinite'}}>Loading...</div>
                ) : visibleItems.length===0 ? (
                  <div style={{padding:48,textAlign:'center',color:'#c0c0c0',fontSize:14}}>No articles. Enable sources or refresh.</div>
                ) : visibleItems.map((item,i) => (
                  <div key={i} onClick={()=>handleReadArticle(item)} style={{padding:'14px 16px',borderBottom:i<visibleItems.length-1?'1px solid #111':'none',display:'flex',gap:12,cursor:'pointer'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:'#7c6af7',marginBottom:5,fontWeight:500,letterSpacing:0.3}}>{item.source} &nbsp; {timeAgo(item.pubDate)}</div>
                      <div style={{fontSize:15,color:'#e8e8e8',lineHeight:1.45,fontWeight:400}}>{item.title}</div>
                      {item.description && <div style={{fontSize:12,color:'#c0c0c0',marginTop:4,lineHeight:1.5}}>{item.description.slice(0,120)}</div>}
                    </div>
                    <div style={{color:'#c0c0c0',fontSize:16,flexShrink:0,alignSelf:'center'}}>{'>'}</div>
                  </div>
                ))}
              </div>
              <button style={{...btnGhost,width:'100%',marginTop:4}} onClick={()=>loadFeeds(activeFeeds)}>Refresh feeds</button>
            </div>
          )}

          {/* SOURCES */}
          {tab==='news' && showSources && (
            <div key="sources" className="slide-up">
              {CATEGORIES.filter(c=>c!=='All').map(cat => {
                const catFeeds = allFeeds.filter(f=>f.category===cat);
                if (!catFeeds.length) return null;
                return (
                  <div key={cat} style={{...card,marginBottom:10}}>
                    <div style={{padding:'8px 16px',borderBottom:'1px solid #111',fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5}}>{cat}</div>
                    {catFeeds.map((f,i) => {
                      const on = enabledFeeds.includes(f.id);
                      const st = feedStatuses[f.id];
                      return (
                        <div key={f.id} onClick={()=>toggleFeed(f.id)} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',borderBottom:i<catFeeds.length-1?'1px solid #111':'none'}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,color:on?'#d8d8d8':'#666',fontWeight:400}}>{f.name}</div>
                            <div style={{fontSize:11,marginTop:2,color:st==='ok'?'#50d89a':st==='fail'?'#e05252':'#555'}}>{st==='ok'?'working':st==='fail'?'failed':'not tested'}</div>
                          </div>
                          <Toggle on={on} onChange={()=>toggleFeed(f.id)}/>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={card}>
                <div style={{padding:'8px 16px',borderBottom:'1px solid #111',fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5}}>Add RSS feed</div>
                <div style={{padding:14,display:'flex',gap:8}}>
                  <input style={{...field,fontSize:14}} placeholder="https://publication.substack.com/feed" value={customUrl} onChange={e=>setCustomUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustomFeed()}/>
                  <button style={btnPrimary} onClick={addCustomFeed}>Add</button>
                </div>
              </div>
              <button style={{...btnPrimary,width:'100%',marginTop:8,marginBottom:8}} onClick={()=>{setShowSources(false);loadFeeds(activeFeeds);}}>Apply and refresh</button>
            </div>
          )}

          {/* SETTINGS */}
          {tab==='settings' && (
            <div key="settings" className="slide-up">

              {/* Reading */}
              <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Reading</div>
              <div style={{...card,marginBottom:16}}>
                <SettingRow label="Speed" subtitle={wpm + ' WPM'}>
                  <div style={{display:'flex',alignItems:'center',gap:8,width:140}}>
                    <input type="range" min={100} max={700} step={10} value={wpm} onChange={e=>setWpm(+e.target.value)} style={{flex:1,accentColor:'#7c6af7'}}/>
                  </div>
                </SettingRow>
                <SettingRow label="Chunk size" subtitle="Words displayed at once">
                  <StepControl value={chunkSize} onChange={setChunkSize} min={1} max={3}/>
                </SettingRow>
                <SettingRow label="Peripheral before" subtitle="Dimmed words shown before">
                  <StepControl value={peripheralBefore} onChange={setPeripheralBefore} min={0} max={5}/>
                </SettingRow>
                <SettingRow label="Peripheral after" subtitle="Dimmed words shown after">
                  <StepControl value={peripheralAfter} onChange={setPeripheralAfter} min={0} max={5}/>
                </SettingRow>
                <SettingRow label="Variable pacing" subtitle="Pause longer at punctuation">
                  <Toggle on={variablePacing} onChange={setVariablePacing}/>
                </SettingRow>
                <SettingRow label="Show progress bar">
                  <Toggle on={showProgress} onChange={setShowProgress}/>
                </SettingRow>
              </div>

              {/* Display */}
              <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Display</div>
              <div style={{...card,marginBottom:16}}>
                <SettingRow label="ORP highlight" subtitle="Red letter at recognition point">
                  <Toggle on={orpOn} onChange={setOrpOn}/>
                </SettingRow>
                <SettingRow label="Highlight color">
                  <div style={{display:'flex',gap:8}}>
                    {['#e05252','#a78bfa','#f0a500','#50d89a'].map(c => (
                      <div key={c} onClick={()=>setOrpColor(c)} style={{width:24,height:24,borderRadius:'50%',background:c,border:orpColor===c?'2px solid #fff':'2px solid transparent',cursor:'pointer'}}/>
                    ))}
                  </div>
                </SettingRow>
                <SettingRow label="Font size">
                  <div style={{display:'flex',gap:6}}>
                    {['small','medium','large','xlarge'].map(s => (
                      <button key={s} onClick={()=>setFontSize(s)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid '+(fontSize===s?'#7c6af7':'#555'),background:fontSize===s?'#7c6af7':'transparent',color:fontSize===s?'#fff':'#555',fontSize:11,cursor:'pointer'}}>
                        {s[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                </SettingRow>
                <SettingRow label="Font style">
                  <div style={{display:'flex',gap:6}}>
                    {[['mono','Mono'],['condensed','Sans'],['serif','Serif']].map(([k,l]) => (
                      <button key={k} onClick={()=>setFontStyle(k)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid '+(fontStyle===k?'#7c6af7':'#555'),background:fontStyle===k?'#7c6af7':'transparent',color:fontStyle===k?'#fff':'#555',fontSize:11,cursor:'pointer'}}>{l}</button>
                    ))}
                  </div>
                </SettingRow>
              </div>

              {/* Bookmarklet */}
              <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Bookmarklet</div>
              <div style={{...card,marginBottom:16}}>
                <div style={{padding:16}}>
                  <p style={{fontSize:13,color:'#b8b8b8',lineHeight:1.7,marginBottom:12}}>
                    On iPhone: bookmark any page in Safari, edit the bookmark, replace its URL with the code below. Tap it on any article to send the text to Speedr instantly - works on paywalled sites you are already logged into.
                  </p>
                  <textarea readOnly value={bookmarkletCode} rows={3} style={{...field,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#8b7fff',resize:'none'}}/>
                  <CopyButton text={bookmarkletCode} label="Copy bookmarklet code"/>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* BOTTOM TAB BAR */}
        <div className={`landscape-hide${uiFaded?' hidden':''}`} style={{flexShrink:0,display:'flex',borderTop:'1px solid #1a1a1a',background:'#0d0d0d',paddingBottom:'env(safe-area-inset-bottom)',minHeight:60}}>
          {[['reader','R','Reader'],['news','N','News'],['settings','\u2699','']].map(([id,icon,label]) => (
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'12px 0 10px',border:'none',background:'transparent',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,transition:'color 0.15s'}}>
              <span style={{fontSize:id==='settings'?22:20,fontFamily:id==='settings'?'inherit':"'JetBrains Mono',monospace",fontWeight:id==='settings'?400:500,color:tab===id?'#8b7fff':'#666666'}}>{icon}</span>
              {label && <span style={{fontSize:10,fontWeight:400,letterSpacing:0.5,color:tab===id?'#8b7fff':'#666666'}}>{label}</span>}
            </button>
          ))}
        </div>

      </div>
    </>
  );
}

const card = { background:'#111111',borderRadius:16,border:'1px solid #1a1a1a',overflow:'hidden',marginBottom:12 };
const field = { width:'100%',boxSizing:'border-box',padding:'12px 14px',background:'#080808',color:'#d8d8d8',border:'1px solid #1a1a1a',borderRadius:12,fontSize:16,fontFamily:"'Inter',sans-serif",fontWeight:300,outline:'none',WebkitAppearance:'none',display:'block' };
const btnPrimary = { padding:'12px 18px',border:'none',borderRadius:12,fontSize:14,fontWeight:400,cursor:'pointer',background:'#7c6af7',color:'#fff',whiteSpace:'nowrap',flexShrink:0,minHeight:44 };
const btnGhost = { padding:'12px 16px',border:'1px solid #1a1a1a',borderRadius:12,fontSize:14,fontWeight:300,cursor:'pointer',background:'transparent',color:'#c0c0c0',whiteSpace:'nowrap',minHeight:44 };
const pill = { padding:'7px 14px',border:'1px solid #1a1a1a',borderRadius:20,fontSize:12,fontWeight:400,cursor:'pointer',background:'transparent',color:'#c0c0c0' };
const pillActive = { ...pill,background:'#7c6af7',color:'#fff',border:'1px solid #7c6af7' };
