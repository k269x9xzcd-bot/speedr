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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html, body, #root { height: 100%; }
  body { background: #0a0a0f; color: #e8e8f0; font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; overscroll-behavior: none; }
  input, textarea, button { font-family: inherit; }
  textarea { -webkit-appearance: none; }
  ::-webkit-scrollbar { display: none; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  .fade-up { animation: fadeUp 0.2s ease-out both; }
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
  return <span>{s.slice(0,i)}<span style={{color:'#e05252',fontWeight:500}}>{s[i]}</span>{s.slice(i+1)}{p}</span>;
}

function ChunkView({ chunk }) {
  if (!chunk) return null;
  return <span>{chunk.split(' ').map((w,i) => <React.Fragment key={i}>{i>0&&' '}<OrpWord word={w}/></React.Fragment>)}</span>;
}

async function fetchText(url) {
  const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url));
  const data = await res.json();
  const doc = new DOMParser().parseFromString(data.contents||'','text/html');
  doc.querySelectorAll('script,style,noscript,nav,footer,header,aside,form').forEach(n=>n.remove());
  const el = doc.querySelector('article,main,[role=main]') || doc.body;
  const paras = Array.from(el.querySelectorAll('p')).map(p=>p.textContent.trim()).filter(t=>t.length>30);
  return paras.length ? paras.join('\n\n') : (el.textContent||'').replace(/\s+/g,' ').trim();
}

async function fetchRSS(feed) {
  const res = await fetch(RSS2JSON + encodeURIComponent(feed.url));
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message||'Feed error');
  return (data.items||[]).slice(0,15).map(item => ({
    title: item.title||'',
    link: item.link||'',
    description: (item.description||'').replace(/<[^>]+>/g,'').slice(0,160),
    pubDate: item.pubDate||'',
    source: feed.name,
    category: feed.category,
    feedId: feed.id,
  }));
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
  const [focusMode, setFocusMode] = useState(false);
  const [category, setCategory] = useState('All');
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedStatuses, setFeedStatuses] = useState({});
  const [showSources, setShowSources] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [extraFeeds, setExtraFeeds] = useState(() => { try { return JSON.parse(localStorage.getItem('speedr_custom')||'[]'); } catch { return []; } });
  const [enabledFeeds, setEnabledFeeds] = useState(() => { try { const s = localStorage.getItem('speedr_feeds'); return s ? JSON.parse(s) : DEFAULT_ENABLED; } catch { return DEFAULT_ENABLED; } });
  const timerRef = useRef(null);

  const allFeeds = useMemo(() => [...ALL_FEEDS, ...extraFeeds], [extraFeeds]);
  const activeFeeds = useMemo(() => allFeeds.filter(f => enabledFeeds.includes(f.id)), [allFeeds, enabledFeeds]);
  const baseDelay = 60000 / wpm;

  useEffect(() => {
    if (activeText) { setChunks(tokenize(activeText)); setIdx(0); setPlaying(false); }
  }, [activeText]);

  useEffect(() => {
    if (!playing || !chunks.length) { clearTimeout(timerRef.current); return; }
    if (idx >= chunks.length) { setPlaying(false); return; }
    timerRef.current = setTimeout(() => setIdx(i=>i+1), delayMs(chunks[idx], baseDelay));
    return () => clearTimeout(timerRef.current);
  }, [playing, idx, chunks, baseDelay]);

  const loadFeeds = useCallback(async (feeds) => {
    setFeedLoading(true);
    setFeedStatuses({});
    const res = await Promise.allSettled(feeds.map(async f => {
      try {
        const items = await fetchRSS(f);
        setFeedStatuses(p => ({...p, [f.id]:'ok'}));
        return items;
      } catch { setFeedStatuses(p => ({...p, [f.id]:'fail'})); return []; }
    }));
    const all = res.flatMap(r => r.status==='fulfilled' ? r.value : []);
    all.sort((a,b) => new Date(b.pubDate)-new Date(a.pubDate));
    setFeedItems(all);
    setFeedLoading(false);
  }, []);

  useEffect(() => { if (tab==='news' && !feedItems.length) loadFeeds(activeFeeds); }, [tab]);

  const togglePlay = useCallback(() => {
    if (!chunks.length) return;
    if (idx >= chunks.length) setIdx(0);
    setPlaying(p => !p);
  }, [chunks.length, idx]);

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setFetchErr(''); setFetching(true);
    try {
      let u = urlInput.trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      const text = await fetchText(u);
      if (!text || text.length < 50) throw new Error('Could not extract text from that page.');
      setActiveText(text); setTab('reader');
    } catch(e) { setFetchErr(e.message); }
    finally { setFetching(false); }
  };

  const handleReadArticle = async (item) => {
    setTab('reader'); setFetching(true);
    try {
      const text = item.link ? await fetchText(item.link) : '';
      setActiveText(text.length > 100 ? text : item.title + '. ' + item.description);
    } catch { setActiveText(item.title + '. ' + item.description); }
    finally { setFetching(false); }
  };

  const toggleFeed = id => {
    const u = enabledFeeds.includes(id) ? enabledFeeds.filter(f=>f!==id) : [...enabledFeeds, id];
    setEnabledFeeds(u);
    localStorage.setItem('speedr_feeds', JSON.stringify(u));
  };

  const addCustomFeed = () => {
    if (!customUrl.trim()) return;
    const u = customUrl.trim();
    const name = u.replace(/^https?:\/\/(www\.)?/,'').split('/')[0];
    const id = 'custom_' + Date.now();
    const feed = { id, name, url: u, category:'Custom' };
    const updated = [...extraFeeds, feed];
    setExtraFeeds(updated);
    localStorage.setItem('speedr_custom', JSON.stringify(updated));
    setEnabledFeeds(p => { const n=[...p,id]; localStorage.setItem('speedr_feeds',JSON.stringify(n)); return n; });
    setCustomUrl('');
  };

  const progress = chunks.length ? (idx/chunks.length)*100 : 0;
  const totalWords = useMemo(() => activeText.trim().split(/\s+/).filter(Boolean).length, [activeText]);
  const wordsRead = chunks.slice(0,idx).reduce((s,c)=>s+c.split(' ').length,0);
  const minsLeft = Math.max(0,(totalWords-wordsRead)/wpm).toFixed(1);
  const currentChunk = chunks[Math.min(idx,chunks.length-1)]||'';
  const visibleItems = category==='All' ? feedItems : feedItems.filter(i=>i.category===category);
  const bookmarkletCode = "javascript:(function(){var u=encodeURIComponent(location.href);window.open('https://k269x9xzcd-bot.github.io/speedr/?url='+u,'_blank');})();";
  const done = chunks.length > 0 && idx >= chunks.length;

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {focusMode && (
        <div onClick={togglePlay} style={{
          position:'fixed', inset:0, background:'#000',
          zIndex:200, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:32,
          cursor:'pointer', padding:'0 32px',
          paddingTop:'env(safe-area-inset-top)',
          paddingBottom:'env(safe-area-inset-bottom)',
        }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'clamp(28px,8vw,52px)', textAlign:'center', lineHeight:1.3, color:'#e8e8f0', letterSpacing:0.5 }}>
            {chunks.length ? <ChunkView chunk={currentChunk}/> : <span style={{color:'#444'}}>no text loaded</span>}
          </div>
          <div style={{width:'50%',height:2,background:'#1a1a2e',borderRadius:1}}>
            <div style={{height:'100%',width:progress+'%',background:'#7c6af7',borderRadius:1,transition:'width 0.1s linear'}}/>
          </div>
          <div style={{fontSize:13,color:'#444',letterSpacing:0.5}}>
            {playing?'tap to pause':'tap to play'} &nbsp; {minsLeft} min left
          </div>
          <button onClick={e=>{e.stopPropagation();setFocusMode(false);setPlaying(false);}} style={{
            position:'absolute', top:'calc(env(safe-area-inset-top) + 16px)', right:20,
            background:'#111', border:'1px solid #222', color:'#666',
            width:36, height:36, borderRadius:18, fontSize:16, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>x</button>
        </div>
      )}

      <div style={{
        display:'flex', flexDirection:'column',
        minHeight:'100dvh',
        paddingTop:'env(safe-area-inset-top)',
        paddingBottom:'calc(env(safe-area-inset-bottom) + 64px)',
        background:'#0a0a0f',
      }}>

        <div style={{padding:'16px 20px 8px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0}}>
          <span style={{fontSize:22,fontWeight:600,letterSpacing:-0.8,color:'#f0f0f8',fontFamily:"'Inter',sans-serif"}}>
            speedr
          </span>
          <div style={{display:'flex',gap:8}}>
            {tab==='reader' && chunks.length>0 && (
              <button onClick={()=>{setFocusMode(true);setPlaying(true);}} style={btn2}>focus</button>
            )}
            {tab==='news' && (
              <button onClick={()=>setShowSources(s=>!s)} style={showSources?btn2active:btn2}>
                {showSources?'done':'sources'}
              </button>
            )}
          </div>
        </div>

        <div style={{flex:1, overflowY:'auto', padding:'0 16px', WebkitOverflowScrolling:'touch'}}>

          {tab==='reader' && (
            <div className="fade-up">
              <div style={card}>
                <div style={{display:'flex',borderBottom:'1px solid #16161e'}}>
                  {['paste','url','bookmarklet'].map(t => (
                    <button key={t} style={{
                      flex:1, padding:'12px 0', border:'none', background:'transparent',
                      color: inputTab===t ? '#7c6af7' : '#555570',
                      fontSize:13, fontWeight:500, cursor:'pointer',
                      borderBottom: inputTab===t ? '2px solid #7c6af7' : '2px solid transparent',
                      transition:'color 0.15s',
                    }} onClick={()=>setInputTab(t)}>{t}</button>
                  ))}
                </div>
                <div style={{padding:16}}>
                  {inputTab==='paste' && <>
                    <textarea
                      style={{...inputStyle, minHeight:120, resize:'vertical'}}
                      placeholder="Paste text to read..."
                      value={pasteText}
                      onChange={e=>setPasteText(e.target.value)}
                    />
                    <div style={{display:'flex',gap:8,marginTop:10}}>
                      <button style={primaryBtn} onClick={()=>setActiveText(pasteText)} disabled={!pasteText.trim()}>Load</button>
                      <button style={ghostBtn} onClick={()=>{setPasteText('');setActiveText('');setChunks([]);}}>Clear</button>
                    </div>
                  </>}
                  {inputTab==='url' && <>
                    <div style={{display:'flex',gap:8}}>
                      <input style={inputStyle} type="url" placeholder="https://example.com/article" value={urlInput} onChange={e=>setUrlInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleFetchUrl()} />
                      <button style={primaryBtn} onClick={handleFetchUrl} disabled={fetching||!urlInput.trim()}>{fetching?'...':'Fetch'}</button>
                    </div>
                    {fetchErr && <div style={{color:'#e05252',fontSize:12,marginTop:8}}>{fetchErr}</div>}
                  </>}
                  {inputTab==='bookmarklet' && <>
                    <p style={{fontSize:13,color:'#888890',lineHeight:1.7,marginBottom:12}}>
                      On iPhone: bookmark any page, edit it, replace the URL with the code below. Tap on any page to open in Speedr.
                    </p>
                    <textarea readOnly value={bookmarkletCode} rows={3} style={{...inputStyle,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'#7c6af7',resize:'none'}}/>
                  </>}
                </div>
              </div>

              {fetching && tab==='reader' && (
                <div style={{textAlign:'center',color:'#555570',fontSize:13,padding:'8px 0 16px',animation:'pulse 1.5s infinite'}}>Fetching article...</div>
              )}

              <div style={{...card, overflow:'hidden', cursor:'pointer'}} onClick={togglePlay}>
                <div style={{
                  minHeight:180, display:'flex', alignItems:'center', justifyContent:'center',
                  padding:'28px 28px 20px',
                }}>
                  {!chunks.length ? (
                    <span style={{color:'#333345',fontSize:16}}>load text above</span>
                  ) : done ? (
                    <span style={{color:'#34d399',fontSize:16}}>finished</span>
                  ) : idx===0 && !playing ? (
                    <span style={{color:'#444455',fontSize:16}}>tap to start</span>
                  ) : (
                    <div style={{
                      fontFamily:"'JetBrains Mono',monospace",
                      fontSize:'clamp(26px,6.5vw,40px)',
                      textAlign:'center', lineHeight:1.3, letterSpacing:0.3, color:'#f0f0f8',
                    }}>
                      <ChunkView chunk={currentChunk}/>
                    </div>
                  )}
                </div>

                <div style={{height:2,background:'#0f0f18'}}>
                  <div style={{height:'100%',width:progress+'%',background:'#7c6af7',transition:'width 0.1s linear'}}/>
                </div>

                <div style={{display:'flex',justifyContent:'space-between',padding:'10px 16px',fontSize:12,color:'#444458'}}>
                  <span>{totalWords} words</span>
                  <span>{minsLeft} min left</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>

              <div style={{...card, padding:'16px'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:13,color:'#555570',minWidth:64,fontVariantNumeric:'tabular-nums'}}>{wpm} wpm</span>
                  <input
                    type="range" min={100} max={700} step={10} value={wpm}
                    onChange={e=>setWpm(+e.target.value)}
                    style={{flex:1,accentColor:'#7c6af7',height:4,cursor:'pointer'}}
                  />
                  <span style={{fontSize:12,color:'#333345',minWidth:32,textAlign:'right'}}>700</span>
                </div>
              </div>
            </div>
          )}

          {tab==='news' && !showSources && (
            <div className="fade-up">
              <div style={{display:'flex',gap:6,margin:'4px 0 14px',overflowX:'auto',paddingBottom:2,msOverflowStyle:'none',scrollbarWidth:'none'}}>
                {CATEGORIES.map(cat => (
                  <button key={cat} style={{
                    padding:'7px 14px', borderRadius:20, fontSize:13, border:'none',
                    cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, fontWeight:500,
                    background: category===cat ? '#7c6af7' : '#13131c',
                    color: category===cat ? '#fff' : '#666680',
                    transition:'background 0.15s, color 0.15s',
                  }} onClick={()=>setCategory(cat)}>{cat}</button>
                ))}
              </div>

              <div style={card}>
                {feedLoading ? (
                  <div style={{padding:40,textAlign:'center',color:'#333345',fontSize:14,animation:'pulse 1.5s infinite'}}>Loading feeds...</div>
                ) : visibleItems.length===0 ? (
                  <div style={{padding:40,textAlign:'center',color:'#333345',fontSize:14}}>No articles. Try enabling more sources.</div>
                ) : visibleItems.map((item,i) => (
                  <div key={i} onClick={()=>handleReadArticle(item)} style={{
                    padding:'14px 16px', borderBottom:'1px solid #10101a',
                    display:'flex', gap:12, cursor:'pointer',
                    transition:'background 0.1s',
                  }}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:'#7c6af7',marginBottom:4,fontWeight:500}}>
                        {item.source} &nbsp;{timeAgo(item.pubDate)}
                      </div>
                      <div style={{fontSize:15,color:'#e0e0f0',lineHeight:1.45,fontWeight:500}}>{item.title}</div>
                      {item.description && <div style={{fontSize:12,color:'#444458',marginTop:4,lineHeight:1.5}}>{item.description.slice(0,120)}</div>}
                    </div>
                    <div style={{color:'#2a2a3a',fontSize:18,flexShrink:0,paddingTop:2}}>{'>'}</div>
                  </div>
                ))}
              </div>

              <button style={{...ghostBtn,width:'100%',marginTop:4,marginBottom:8}} onClick={()=>loadFeeds(activeFeeds)}>Refresh</button>
            </div>
          )}

          {tab==='news' && showSources && (
            <div className="fade-up">
              <p style={{fontSize:13,color:'#555570',margin:'4px 0 14px',lineHeight:1.6}}>Toggle sources. Tap Apply when done.</p>
              {CATEGORIES.filter(c=>c!=='All').map(cat => {
                const catFeeds = allFeeds.filter(f=>f.category===cat);
                if (!catFeeds.length) return null;
                return (
                  <div key={cat} style={{...card,marginBottom:12}}>
                    <div style={{padding:'10px 16px',borderBottom:'1px solid #10101a',fontSize:11,color:'#444458',fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>
                      {cat}
                    </div>
                    {catFeeds.map(f => {
                      const on = enabledFeeds.includes(f.id);
                      const st = feedStatuses[f.id];
                      return (
                        <div key={f.id} onClick={()=>toggleFeed(f.id)} style={{
                          padding:'13px 16px',display:'flex',alignItems:'center',gap:12,
                          borderBottom:'1px solid #10101a',cursor:'pointer',
                        }}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,color:on?'#e0e0f0':'#444458',fontWeight:500}}>{f.name}</div>
                            <div style={{fontSize:11,marginTop:2,color:st==='ok'?'#34d399':st==='fail'?'#e05252':'#2a2a3a'}}>
                              {st==='ok'?'working':st==='fail'?'failed':'not tested'}
                            </div>
                          </div>
                          <div style={{
                            width:44,height:26,borderRadius:13,flexShrink:0,
                            background:on?'#7c6af7':'#13131c',
                            border:'1px solid '+(on?'#7c6af7':'#222230'),
                            position:'relative',transition:'background 0.2s',
                          }}>
                            <div style={{
                              position:'absolute',top:3,left:on?21:3,
                              width:18,height:18,borderRadius:9,background:'#fff',
                              transition:'left 0.2s',
                            }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={card}>
                <div style={{padding:'10px 16px',borderBottom:'1px solid #10101a',fontSize:11,color:'#444458',fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>Add feed</div>
                <div style={{padding:14,display:'flex',gap:8}}>
                  <input style={inputStyle} placeholder="https://publication.substack.com/feed" value={customUrl} onChange={e=>setCustomUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustomFeed()}/>
                  <button style={primaryBtn} onClick={addCustomFeed}>Add</button>
                </div>
              </div>
              <button style={{...primaryBtn,width:'100%',marginTop:8,marginBottom:8}} onClick={()=>{setShowSources(false);loadFeeds(activeFeeds);}}>Apply and refresh</button>
            </div>
          )}

          {tab==='settings' && (
            <div className="fade-up">
              <div style={card}>
                <div style={{padding:16,borderBottom:'1px solid #10101a'}}>
                  <div style={{fontSize:13,color:'#555570',marginBottom:12}}>Reading speed: {wpm} WPM</div>
                  <input type="range" min={100} max={700} step={10} value={wpm} onChange={e=>setWpm(+e.target.value)} style={{width:'100%',accentColor:'#7c6af7'}}/>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#333345',marginTop:6}}>
                    <span>100</span><span>400</span><span>700</span>
                  </div>
                </div>
                <div style={{padding:16}}>
                  {[
                    ['Tap anywhere on reader','Start or stop playback'],
                    ['Focus button','Full screen distraction-free mode'],
                    ['ORP highlight','Red letter marks optimal reading point'],
                    ['News sources','Manage from the News tab'],
                  ].map(([k,v]) => (
                    <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'10px 0',borderBottom:'1px solid #10101a'}}>
                      <span style={{fontSize:14,color:'#e0e0f0',fontWeight:500}}>{k}</span>
                      <span style={{fontSize:12,color:'#444458',maxWidth:'50%',textAlign:'right',lineHeight:1.4}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{
          position:'fixed', bottom:0, left:0, right:0,
          background:'#0d0d14',
          borderTop:'1px solid #13131e',
          display:'flex',
          paddingBottom:'env(safe-area-inset-bottom)',
          zIndex:100,
        }}>
          {[['reader','Reader'],['news','News'],['settings','Settings']].map(([id,label]) => (
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:1, padding:'12px 0 10px', border:'none', background:'transparent',
              cursor:'pointer', display:'flex', flexDirection:'column',
              alignItems:'center', gap:4,
              color: tab===id ? '#7c6af7' : '#333345',
              transition:'color 0.15s',
            }}>
              <span style={{
                fontSize:18, fontFamily:"'JetBrains Mono',monospace", fontWeight:500,
                color: tab===id ? '#7c6af7' : '#2a2a3a',
              }}>
                {id==='reader'?'R':id==='news'?'N':'S'}
              </span>
              <span style={{fontSize:11,fontWeight:500,letterSpacing:0.3}}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

const card = {
  background:'#0f0f18',
  borderRadius:16,
  border:'1px solid #13131e',
  overflow:'hidden',
  marginBottom:12,
};

const inputStyle = {
  width:'100%', boxSizing:'border-box',
  padding:'12px 14px',
  background:'#0a0a12',
  color:'#e0e0f0',
  border:'1px solid #1a1a28',
  borderRadius:12,
  fontSize:16,
  fontFamily:"'Inter',sans-serif",
  outline:'none',
  WebkitAppearance:'none',
};

const primaryBtn = {
  padding:'12px 20px', border:'none', borderRadius:12,
  fontSize:14, fontWeight:600, cursor:'pointer',
  background:'#7c6af7', color:'#fff',
  whiteSpace:'nowrap', flexShrink:0,
  minHeight:44,
};

const ghostBtn = {
  padding:'12px 16px', border:'1px solid #1a1a28', borderRadius:12,
  fontSize:14, fontWeight:500, cursor:'pointer',
  background:'transparent', color:'#555570',
  whiteSpace:'nowrap', minHeight:44,
};

const btn2 = {
  padding:'7px 14px', border:'1px solid #1a1a28', borderRadius:20,
  fontSize:12, fontWeight:500, cursor:'pointer',
  background:'transparent', color:'#555570',
};

const btn2active = {
  ...btn2, background:'#7c6af7', color:'#fff', border:'1px solid #7c6af7',
};
