import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const ALL_FEEDS = [
  { id:'npr-us',       name:'NPR News',             url:'https://feeds.npr.org/1001/rss.xml',                   category:'US' },
  { id:'ap-us',        name:'AP News',               url:'https://apnews.com/rss',                               category:'US' },
  { id:'bbc-world',    name:'BBC World',             url:'https://feeds.bbci.co.uk/news/world/rss.xml',          category:'World' },
  { id:'aljazeera',    name:'Al Jazeera',            url:'https://www.aljazeera.com/xml/rss/all.xml',            category:'World' },
  { id:'dw',           name:'DW News',               url:'https://rss.dw.com/rdf/rss-en-all',                    category:'World' },
  { id:'politico',     name:'Politico',              url:'https://www.politico.com/rss/politics08.xml',          category:'Politics' },
  { id:'guardian-pol', name:'The Guardian',          url:'https://www.theguardian.com/politics/rss',             category:'Politics' },
  { id:'nyp-biz',      name:'NY Post Business',      url:'https://nypost.com/business/feed/',                    category:'Business' },
  { id:'verge',        name:'The Verge',             url:'https://www.theverge.com/rss/index.xml',               category:'Business' },
  { id:'npr-health',   name:'NPR Health',            url:'https://feeds.npr.org/1128/rss.xml',                   category:'Health' },
  { id:'nyp-ent',      name:'NY Post Entertainment', url:'https://nypost.com/entertainment/feed/',               category:'Entertainment' },
  { id:'ars',          name:'Ars Technica',          url:'https://feeds.arstechnica.com/arstechnica/index',      category:'Science' },
  { id:'npr-sci',      name:'NPR Science',           url:'https://feeds.npr.org/1007/rss.xml',                   category:'Science' },
  { id:'nyp-metro',    name:'NY Post Metro',         url:'https://nypost.com/metro/feed/',                       category:'Local' },
  { id:'gothamist',    name:'Gothamist',             url:'https://gothamist.com/feed',                           category:'Local' },
  { id:'nbcny',        name:'NBC New York',          url:'https://www.nbcnewyork.com/feed/',                     category:'Local' },
  { id:'moneyprinter', name:'Money Printer',         url:'https://themoneyprinter.substack.com/feed',            category:'Substack' },
  { id:'charlie',      name:'Charlie Garcia',        url:'https://charliepgarcia.substack.com/feed',             category:'Substack' },
];

const CATEGORIES = ['All','US','World','Politics','Business','Health','Entertainment','Science','Local','Substack'];
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
const DEFAULT_ENABLED = ALL_FEEDS.map(f => f.id);

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
    letter-spacing:0.01em;
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
  ::placeholder { color:#444444; }
  ::-webkit-scrollbar { display:none; }
  * { scrollbar-width:none; }
  @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.15} }
  .slide-up { animation:slideUp 0.18s ease-out both; }
  .ui-layer { transition:opacity 0.3s ease, transform 0.3s ease; }
  .ui-layer.hidden { opacity:0; pointer-events:none; transform:translateY(-4px); }
  @media (orientation:landscape) {
    .reader-stage { height:calc(100dvh - 100px) !important; }
  }
`;

function timeAgo(d) {
  if (!d) return '';
  const m = (Date.now() - new Date(d)) / 60000;
  if (m < 60) return Math.round(m) + 'm';
  if (m < 1440) return Math.round(m/60) + 'h';
  return Math.round(m/1440) + 'd';
}

function tokenize(text) {
  if (!text) return [];
  const words = text.replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  const out = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (/[.!?]$/.test(w) || w.length > 10 || !words[i+1]) { out.push(w); i++; }
    else { out.push(w + ' ' + words[i+1]); i += 2; }
  }
  return out;
}

function delayMs(chunk, baseMs) {
  const last = chunk[chunk.length-1];
  const mult = '.!?'.includes(last) ? 1.8 : ',:;'.includes(last) ? 1.3 : 1;
  return baseMs * chunk.split(' ').length * mult;
}

function OrpWord({ word }) {
  const s = word.replace(/[.,!?;:]+$/,'');
  const p = word.slice(s.length);
  const i = Math.max(0, Math.floor(s.length * 0.3));
  return (
    <span>
      {s.slice(0,i)}
      <span style={{color:'#ff4444',fontWeight:700}}>{s[i]}</span>
      {s.slice(i+1)}{p}
    </span>
  );
}

function ChunkView({ chunk }) {
  if (!chunk) return null;
  return (
    <span>
      {chunk.split(' ').map((w,i) => (
        <React.Fragment key={i}>{i>0&&' '}<OrpWord word={w}/></React.Fragment>
      ))}
    </span>
  );
}

async function fetchText(url) {
  // r.jina.ai returns clean article text, bypasses most news site blocks
  const res = await fetch('https://r.jina.ai/' + url, {
    headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' }
  });
  if (!res.ok) throw new Error('Fetch failed: ' + res.status);
  const text = await res.text();
  if (!text || text.length < 100) throw new Error('No content found.');
  // Strip any Jina metadata header lines (Title:, URL:, etc.)
  const lines = text.split('\n');
  const startIdx = lines.findIndex((l, i) => i > 3 && l.trim().length > 0 && !l.startsWith('Title:') && !l.startsWith('URL:') && !l.startsWith('Published') && !l.startsWith('Source:'));
  return lines.slice(Math.max(0, startIdx)).join('\n').trim();
}

async function fetchRSS(feed) {
  const res = await fetch(RSS2JSON + encodeURIComponent(feed.url));
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'Feed error');
  return (data.items || []).slice(0, 15).map(item => {
    const fullContent = (item.content || '').replace(/<[^>]+>/g,'').trim();
    const desc = (item.description || '').replace(/<[^>]+>/g,'').trim();
    return {
      title: item.title || '',
      link: item.link || '',
      description: desc.slice(0, 200),
      fullContent: fullContent.length > desc.length ? fullContent : '',
      pubDate: item.pubDate || '',
      source: feed.name,
      category: feed.category,
      feedId: feed.id,
    };
  });
}


function CopyButton({ text }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} style={{
      marginTop:10, width:'100%', padding:'12px', border:'none',
      borderRadius:12, fontSize:14, fontWeight:600, cursor:'pointer',
      background: copied ? '#0f2a1a' : '#222222',
      color: copied ? '#50d89a' : '#8b7fff',
      border: '1px solid ' + (copied ? '#50d89a' : '#333333'),
      transition:'all 0.2s',
    }}>
      {copied ? 'Copied!' : 'Copy bookmarklet code'}
    </button>
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
  const [wpm, setWpm] = useState(280);
  const [category, setCategory] = useState('All');
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedStatuses, setFeedStatuses] = useState({});
  const [showSources, setShowSources] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [extraFeeds, setExtraFeeds] = useState(() => { try { return JSON.parse(localStorage.getItem('speedr_custom')||'[]'); } catch { return []; } });
  const [enabledFeeds, setEnabledFeeds] = useState(() => { try { const s = localStorage.getItem('speedr_feeds'); return s ? JSON.parse(s) : DEFAULT_ENABLED; } catch { return DEFAULT_ENABLED; } });

  const timerRef = useRef(null);
  const holdRef = useRef(false);

  const allFeeds = useMemo(() => [...ALL_FEEDS, ...extraFeeds], [extraFeeds]);
  const activeFeeds = useMemo(() => allFeeds.filter(f => enabledFeeds.includes(f.id)), [allFeeds, enabledFeeds]);
  const baseDelay = 60000 / wpm;

  useEffect(() => {
    if (activeText) { setChunks(tokenize(activeText)); setIdx(0); setPlaying(false); }
  }, [activeText]);

  useEffect(() => {
    if (!playing || !chunks.length) { clearTimeout(timerRef.current); return; }
    if (idx >= chunks.length) { setPlaying(false); return; }
    timerRef.current = setTimeout(() => setIdx(i => i+1), delayMs(chunks[idx], baseDelay));
    return () => clearTimeout(timerRef.current);
  }, [playing, idx, chunks, baseDelay]);

  const loadFeeds = useCallback(async (feeds) => {
    setFeedLoading(true); setFeedStatuses({});
    const res = await Promise.allSettled(feeds.map(async f => {
      try { const items = await fetchRSS(f); setFeedStatuses(p=>({...p,[f.id]:'ok'})); return items; }
      catch { setFeedStatuses(p=>({...p,[f.id]:'fail'})); return []; }
    }));
    const all = res.flatMap(r => r.status==='fulfilled' ? r.value : []);
    all.sort((a,b) => new Date(b.pubDate)-new Date(a.pubDate));
    setFeedItems(all); setFeedLoading(false);
  }, []);

  useEffect(() => { if (tab==='news' && !feedItems.length) loadFeeds(activeFeeds); }, [tab]);

  // Receive text from bookmarklet via postMessage
  useEffect(() => {
    function onMessage(e) {
      if (e.data && typeof e.data.speedrText === 'string' && e.data.speedrText.length > 50) {
        setActiveText(e.data.speedrText);
        setTab('reader');
        setInputTab('paste');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Hold-to-read handlers
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
      if (!text || text.length < 100) throw new Error('Could not extract article. Try pasting text directly.');
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
    const feed = { id, name, url: u, category:'Custom' };
    const updated = [...extraFeeds, feed];
    setExtraFeeds(updated); localStorage.setItem('speedr_custom', JSON.stringify(updated));
    setEnabledFeeds(p => { const n=[...p,id]; localStorage.setItem('speedr_feeds',JSON.stringify(n)); return n; });
    setCustomUrl('');
  };

  const progress = chunks.length ? (idx/chunks.length)*100 : 0;
  const totalWords = useMemo(() => activeText.trim().split(/\s+/).filter(Boolean).length, [activeText]);
  const wordsRead = chunks.slice(0,idx).reduce((s,c)=>s+c.split(' ').length,0);
  const minsLeft = Math.max(0,(totalWords-wordsRead)/wpm).toFixed(1);
  const currentChunk = chunks[Math.min(idx,chunks.length-1)]||'';
  const done = chunks.length > 0 && idx >= chunks.length;
  const visibleItems = category==='All' ? feedItems : feedItems.filter(i=>i.category===category);
  const bookmarkletCode = "javascript:(function(){var el=document.querySelector('.body.markup, article, .post-content, .article-body, main, [role=main]');var text=el?el.innerText:document.body.innerText;var w=window.open('https://k269x9xzcd-bot.github.io/speedr/','_blank');setTimeout(function(){w.postMessage({speedrText:text},'*');},1800);})();";

  // When playing, fade the UI layers
  const uiFaded = playing;

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div style={{
        position:'fixed', inset:0,
        display:'flex', flexDirection:'column',
        paddingTop:'env(safe-area-inset-top)',
        paddingLeft:'env(safe-area-inset-left)',
        paddingRight:'env(safe-area-inset-right)',
        background:'#0d0d0d',
      }}>

        {/* TOP BAR */}
        <div className={`ui-layer${uiFaded?' hidden':''}`} style={{
          flexShrink:0,
          display:'flex',justifyContent:'space-between',alignItems:'center',
          padding:'14px 20px 10px',
          borderBottom:'1px solid #1c1c1c',
        }}>
          <span style={{fontSize:20,fontWeight:600,letterSpacing:-0.8,color:'#e5e5e5'}}>speedr</span>
          <div style={{display:'flex',gap:8}}>
            {tab==='news' && (
              <button onClick={()=>setShowSources(s=>!s)} style={showSources?pillActive:pill}>
                {showSources?'done':'sources'}
              </button>
            )}
          </div>
        </div>

        {/* CONTENT AREA */}
        <div style={{
          flex:1, overflowY:'auto', overflowX:'hidden',
          WebkitOverflowScrolling:'touch',
          padding:'12px 16px',
          display:'flex', flexDirection:'column',
        }}>

          {/* READER TAB */}
          {tab==='reader' && (
            <div key="reader" className="slide-up" style={{display:'flex',flexDirection:'column',flex:1,gap:12}}>

              {/* Input card - fades when playing */}
              <div className={`ui-layer${uiFaded?' hidden':''}`} style={card}>
                <div style={{display:'flex',borderBottom:'1px solid #1e1e1e'}}>
                  {['paste','url','bookmarklet'].map(t => (
                    <button key={t} style={{
                      flex:1,padding:'12px 0',border:'none',background:'transparent',
                      color:inputTab===t?'#8b7fff':'#777777',
                      fontSize:13,fontWeight:500,cursor:'pointer',
                      borderBottom:inputTab===t?'2px solid #8b7fff':'2px solid transparent',
                    }} onClick={()=>setInputTab(t)}>{t}</button>
                  ))}
                </div>
                <div style={{padding:14}}>
                  {inputTab==='paste' && <>
                    <textarea style={{...field,minHeight:100,resize:'none'}}
                      placeholder="Paste text to read..."
                      value={pasteText} onChange={e=>setPasteText(e.target.value)}/>
                    <div style={{display:'flex',gap:8,marginTop:10}}>
                      <button style={btnPrimary} onClick={()=>setActiveText(pasteText)} disabled={!pasteText.trim()}>Load</button>
                      <button style={btnGhost} onClick={()=>{setPasteText('');setActiveText('');setChunks([]);}}>Clear</button>
                    </div>
                  </>}
                  {inputTab==='url' && <>
                    <div style={{display:'flex',gap:8}}>
                      <input style={{...field,fontSize:15}} type="url" placeholder="https://..."
                        value={urlInput} onChange={e=>setUrlInput(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&handleFetchUrl()}/>
                      <button style={btnPrimary} onClick={handleFetchUrl} disabled={fetching||!urlInput.trim()}>
                        {fetching?'...':'Fetch'}
                      </button>
                    </div>
                    {fetchErr && <div style={{color:'#ff6b6b',fontSize:12,marginTop:8,lineHeight:1.5}}>{fetchErr}</div>}
                    {fetching && <div style={{color:'#737373',fontSize:12,marginTop:8,animation:'pulse 1.4s infinite'}}>Extracting article...</div>}
                  </>}
                  {inputTab==='bookmarklet' && <>
                    <p style={{fontSize:13,color:'#8a8a8a',lineHeight:1.7,marginBottom:12}}>
                      On iPhone: bookmark any page, edit it, replace the URL with this code. Tap the button to copy it.
                    </p>
                    <textarea readOnly value={bookmarkletCode} rows={3}
                      style={{...field,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#8b7fff',resize:'none'}}/>
                    <CopyButton text={bookmarkletCode} />
                  </>}
                </div>
              </div>

              {/* READER STAGE - expands to fill when playing */}
              <div
                onPointerDown={onHoldStart}
                onPointerUp={onHoldEnd}
                onPointerCancel={onHoldEnd}
                onPointerLeave={onHoldEnd}
                style={{
                  ...card,
                  flex: playing ? 1 : 0,
                  minHeight: playing ? 0 : 200,
                  cursor:'pointer',
                  touchAction:'none',
                  transition:'flex 0.3s ease, min-height 0.3s ease',
                  display:'flex',flexDirection:'column',
                }}
              >
                <div className="reader-stage" style={{
                  flex:1,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  padding:'0 28px',
                  minHeight: playing ? 0 : 160,
                }}>
                  {fetching ? (
                    <div style={{color:'#737373',fontSize:14,animation:'pulse 1.4s infinite'}}>loading...</div>
                  ) : !chunks.length ? (
                    <div style={{textAlign:'center'}}>
                      <div style={{color:'#525252',fontSize:15,marginBottom:8}}>load text above</div>
                    </div>
                  ) : done ? (
                    <span style={{color:'#50d89a',fontSize:18,fontWeight:600}}>done</span>
                  ) : idx===0 && !playing ? (
                    <div style={{textAlign:'center'}}>
                      <div style={{color:'#737373',fontSize:15,marginBottom:6}}>hold to read</div>
                      <div style={{color:'#525252',fontSize:12}}>release to pause</div>
                    </div>
                  ) : (
                    <div style={{
                      fontFamily:"'JetBrains Mono',monospace",
                      fontSize:'clamp(28px,7vw,48px)',
                      textAlign:'center',lineHeight:1.3,
                      letterSpacing:0.3,color:'#e8e8e8',
                      fontWeight:500,
                    }}>
                      <ChunkView chunk={currentChunk}/>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{height:3,background:'#222222',flexShrink:0}}>
                  <div style={{height:'100%',width:progress+'%',background:'#7c6af7',transition:'width 0.12s linear'}}/>
                </div>

                {/* Stats - fade when playing */}
                <div className={`ui-layer${uiFaded?' hidden':''}`}
                  style={{display:'flex',justifyContent:'space-between',padding:'10px 16px',fontSize:12,color:'#8a8a8a',flexShrink:0}}>
                  <span>{totalWords.toLocaleString()} words</span>
                  <span>{minsLeft} min left</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>

              {/* Speed slider - fades when playing */}
              <div className={`ui-layer${uiFaded?' hidden':''}`} style={{...card,padding:'14px 16px'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:13,color:'#909090',minWidth:58,fontVariantNumeric:'tabular-nums'}}>{wpm} wpm</span>
                  <input type="range" min={100} max={700} step={10} value={wpm}
                    onChange={e=>setWpm(+e.target.value)}
                    style={{flex:1,accentColor:'#8b7fff',cursor:'pointer'}}/>
                </div>
              </div>

              {/* Release hint while playing */}
              {playing && (
                <div style={{
                  textAlign:'center',fontSize:12,color:'#525252',
                  paddingBottom:8,flexShrink:0,
                  letterSpacing:0.5,
                }}>release to pause</div>
              )}
            </div>
          )}

          {/* NEWS TAB */}
          {tab==='news' && !showSources && (
            <div key="news" className="slide-up">
              <div style={{display:'flex',gap:6,marginBottom:12,overflowX:'auto',paddingBottom:2}}>
                {CATEGORIES.map(cat => (
                  <button key={cat} style={{
                    padding:'7px 14px',borderRadius:20,fontSize:13,border:'none',
                    cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontWeight:500,
                    background:category===cat?'#7c6af7':'#1f1f1f',
                    color:category===cat?'#fff':'#8a8a8a',
                    transition:'all 0.15s',
                  }} onClick={()=>setCategory(cat)}>{cat}</button>
                ))}
              </div>
              <div style={card}>
                {feedLoading ? (
                  <div style={{padding:48,textAlign:'center',color:'#8a8a8a',fontSize:14,animation:'pulse 1.4s infinite'}}>Loading...</div>
                ) : visibleItems.length===0 ? (
                  <div style={{padding:48,textAlign:'center',color:'#8a8a8a',fontSize:14}}>No articles. Enable sources or refresh.</div>
                ) : visibleItems.map((item,i) => (
                  <div key={i} onClick={()=>handleReadArticle(item)} style={{
                    padding:'14px 16px',
                    borderBottom:i<visibleItems.length-1?'1px solid #1c1c1c':'none',
                    display:'flex',gap:12,cursor:'pointer',
                  }}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:'#7c6af7',marginBottom:5,fontWeight:600,letterSpacing:0.3}}>
                        {item.source} &nbsp; {timeAgo(item.pubDate)}
                      </div>
                      <div style={{fontSize:15,color:'#e5e5e5',lineHeight:1.45,fontWeight:500}}>{item.title}</div>
                      {item.description && (
                        <div style={{fontSize:12,color:'#737373',marginTop:5,lineHeight:1.5}}>{item.description.slice(0,120)}</div>
                      )}
                    </div>
                    <div style={{color:'#525252',fontSize:16,flexShrink:0,alignSelf:'center'}}>{'>'}</div>
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
                    <div style={{padding:'9px 16px',borderBottom:'1px solid #1c1c1c',fontSize:10,color:'#8a8a8a',fontWeight:700,textTransform:'uppercase',letterSpacing:1.2}}>{cat}</div>
                    {catFeeds.map((f,i) => {
                      const on = enabledFeeds.includes(f.id);
                      const st = feedStatuses[f.id];
                      return (
                        <div key={f.id} onClick={()=>toggleFeed(f.id)} style={{
                          padding:'12px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',
                          borderBottom:i<catFeeds.length-1?'1px solid #191924':'none',
                        }}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,color:on?'#e5e5e5':'#737373',fontWeight:500,transition:'color 0.15s'}}>{f.name}</div>
                            <div style={{fontSize:11,marginTop:2,color:st==='ok'?'#4ade80':st==='fail'?'#f87171':'#525252'}}>
                              {st==='ok'?'working':st==='fail'?'failed':'not tested'}
                            </div>
                          </div>
                          <div style={{
                            width:44,height:26,borderRadius:13,flexShrink:0,
                            background:on?'#7c6af7':'#222222',
                            border:'1px solid '+(on?'#7c6af7':'#333333'),
                            position:'relative',transition:'background 0.2s',
                          }}>
                            <div style={{
                              position:'absolute',top:3,left:on?21:3,
                              width:18,height:18,borderRadius:9,
                              background:on?'#fff':'#737373',
                              transition:'left 0.2s,background 0.2s',
                            }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={card}>
                <div style={{padding:'9px 16px',borderBottom:'1px solid #1c1c1c',fontSize:10,color:'#8a8a8a',fontWeight:700,textTransform:'uppercase',letterSpacing:1.2}}>Add RSS feed</div>
                <div style={{padding:14,display:'flex',gap:8}}>
                  <input style={{...field,fontSize:14}} placeholder="https://publication.substack.com/feed"
                    value={customUrl} onChange={e=>setCustomUrl(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&addCustomFeed()}/>
                  <button style={btnPrimary} onClick={addCustomFeed}>Add</button>
                </div>
              </div>
              <button style={{...btnPrimary,width:'100%',marginTop:8,marginBottom:8}} onClick={()=>{setShowSources(false);loadFeeds(activeFeeds);}}>
                Apply and refresh
              </button>
            </div>
          )}

          {/* SETTINGS */}
          {tab==='settings' && (
            <div key="settings" className="slide-up">
              <div style={card}>
                <div style={{padding:'14px 16px',borderBottom:'1px solid #1c1c1c'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                    <span style={{fontSize:14,color:'#e5e5e5',fontWeight:500}}>Reading speed</span>
                    <span style={{fontSize:14,color:'#8b7fff',fontWeight:600}}>{wpm} WPM</span>
                  </div>
                  <input type="range" min={100} max={700} step={10} value={wpm}
                    onChange={e=>setWpm(+e.target.value)} style={{width:'100%',accentColor:'#8b7fff'}}/>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8a8a8a',marginTop:6}}>
                    <span>100</span><span>400</span><span>700</span>
                  </div>
                </div>
                {[
                  ['Hold to read','Press and hold the reader to play, release to pause'],
                  ['Landscape','Rotate your phone to read full-screen'],
                  ['Red letter','Marks the optimal recognition point per word'],
                  ['News sources','Manage feeds in the News tab'],
                  ['Bookmarklet','Send any webpage to Speedr via Safari'],
                ].map(([k,v],i,arr) => (
                  <div key={k} style={{
                    display:'flex',justifyContent:'space-between',alignItems:'flex-start',
                    padding:'13px 16px',gap:16,
                    borderBottom:i<arr.length-1?'1px solid #191924':'none',
                  }}>
                    <span style={{fontSize:14,color:'#e5e5e5',fontWeight:500,flexShrink:0}}>{k}</span>
                    <span style={{fontSize:12,color:'#737373',textAlign:'right',lineHeight:1.5}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM TAB BAR */}
        <div className={`ui-layer${uiFaded?' hidden':''}`} style={{
          flexShrink:0,
          display:'flex',
          borderTop:'1px solid #1c1c1c',
          background:'#0d0d0d',
          paddingBottom:'env(safe-area-inset-bottom)',
        }}>
          {[['reader','R','Reader'],['news','N','News'],['settings','S','Settings']].map(([id,icon,label]) => (
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:1,padding:'12px 0 10px',border:'none',background:'transparent',cursor:'pointer',
              display:'flex',flexDirection:'column',alignItems:'center',gap:3,
              transition:'color 0.15s',
            }}>
              <span style={{
                fontSize:20,fontFamily:"'JetBrains Mono',monospace",fontWeight:500,
                color:tab===id?'#8b7fff':'#525252',
              }}>{icon}</span>
              <span style={{fontSize:10,fontWeight:500,letterSpacing:0.5,color:tab===id?'#8b7fff':'#525252'}}>{label}</span>
            </button>
          ))}
        </div>

      </div>
    </>
  );
}

const card = {
  background:'#141414',borderRadius:16,
  border:'1px solid #1e1e1e',overflow:'hidden',
};
const field = {
  width:'100%',boxSizing:'border-box',padding:'12px 14px',
  background:'#0a0a0a',color:'#e0e0e0',
  border:'1px solid #1e1e1e',borderRadius:12,
  fontSize:16,fontFamily:"'Inter',sans-serif",fontWeight:300,
  outline:'none',WebkitAppearance:'none',display:'block',
};
const btnPrimary = {
  padding:'12px 18px',border:'none',borderRadius:12,
  fontSize:14,fontWeight:400,cursor:'pointer',
  background:'#7c6af7',color:'#fff',whiteSpace:'nowrap',
  flexShrink:0,minHeight:44,
};
const btnGhost = {
  padding:'12px 16px',border:'1px solid #1e1e1e',borderRadius:12,
  fontSize:14,fontWeight:300,cursor:'pointer',
  background:'transparent',color:'#888888',
  whiteSpace:'nowrap',minHeight:44,
};
const pill = {
  padding:'7px 14px',border:'1px solid #1e1e1e',borderRadius:20,
  fontSize:12,fontWeight:400,cursor:'pointer',
  background:'transparent',color:'#888888',
};
const pillActive = {
  ...pill,background:'#7c6af7',color:'#fff',border:'1px solid #7c6af7',
};
