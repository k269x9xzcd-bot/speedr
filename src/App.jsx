import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const ALL_FEEDS = [
  { id:'npr-us',        name:'NPR News',          url:'https://feeds.npr.org/1001/rss.xml',                                    category:'US' },
  { id:'ap-us',         name:'AP News',            url:'https://apnews.com/rss',                                                category:'US' },
  { id:'bbc-world',     name:'BBC World',          url:'https://feeds.bbci.co.uk/news/world/rss.xml',                          category:'World' },
  { id:'aljazeera',     name:'Al Jazeera',         url:'https://www.aljazeera.com/xml/rss/all.xml',                            category:'World' },
  { id:'dw',            name:'DW News',            url:'https://rss.dw.com/rdf/rss-en-all',                                    category:'World' },
  { id:'politico',      name:'Politico',           url:'https://www.politico.com/rss/politics08.xml',                          category:'Politics' },
  { id:'guardian-pol',  name:'The Guardian',       url:'https://www.theguardian.com/politics/rss',                             category:'Politics' },
  { id:'nyp-biz',       name:'NY Post Business',   url:'https://nypost.com/business/feed/',                                    category:'Business' },
  { id:'verge',         name:'The Verge',          url:'https://www.theverge.com/rss/index.xml',                               category:'Business' },
  { id:'npr-health',    name:'NPR Health',         url:'https://feeds.npr.org/1128/rss.xml',                                   category:'Health' },
  { id:'nyp-ent',       name:'NY Post Entertainment', url:'https://nypost.com/entertainment/feed/',                            category:'Entertainment' },
  { id:'ars',           name:'Ars Technica',       url:'https://feeds.arstechnica.com/arstechnica/index',                      category:'Science' },
  { id:'npr-sci',       name:'NPR Science',        url:'https://feeds.npr.org/1007/rss.xml',                                   category:'Science' },
  { id:'nyp-metro',     name:'NY Post Metro',      url:'https://nypost.com/metro/feed/',                                       category:'Local' },
  { id:'gothamist',     name:'Gothamist',          url:'https://gothamist.com/feed',                                           category:'Local' },
  { id:'nbcny',         name:'NBC New York',       url:'https://www.nbcnewyork.com/feed/',                                     category:'Local' },
  { id:'moneyprinter',  name:'Money Printer',      url:'https://themoneyprinter.substack.com/feed',                            category:'Substack' },
  { id:'charlie',       name:'Charlie Garcia',     url:'https://charliepgarcia.substack.com/feed',                             category:'Substack' },
];

const CATEGORIES = ['All','US','World','Politics','Business','Health','Entertainment','Science','Local','Substack'];
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
const DEFAULT_ENABLED = ALL_FEEDS.map(f => f.id);

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 60000;
  if (diff < 60) return Math.round(diff) + 'm ago';
  if (diff < 1440) return Math.round(diff / 60) + 'h ago';
  return Math.round(diff / 1440) + 'd ago';
}

function tokenize(text) {
  if (!text) return [];
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const ends = /[.!?]$/.test(w);
    const long = w.length > 10;
    if (ends || long || !words[i+1]) { chunks.push(w); i++; }
    else { chunks.push(w + ' ' + words[i+1]); i += 2; }
  }
  return chunks;
}

function delayMult(chunk) {
  const last = chunk[chunk.length-1];
  if ('.!?'.includes(last)) return 1.8;
  if (',:;'.includes(last)) return 1.3;
  return 1;
}

function getOrp(word) {
  const s = word.replace(/[.,!?;:]+$/, '');
  const p = word.slice(s.length);
  const idx = Math.max(0, Math.floor(s.length * 0.3));
  return { before: s.slice(0, idx), mid: s[idx] || '', after: s.slice(idx+1), punct: p };
}

function OrpWord({ word }) {
  const { before, mid, after, punct } = getOrp(word);
  return (
    <span>
      {before}
      <span style={{ color: '#e05252' }}>{mid}</span>
      {after}{punct}
    </span>
  );
}

function ChunkView({ chunk }) {
  if (!chunk) return null;
  return (
    <span>
      {chunk.split(' ').map((w, i) => (
        <React.Fragment key={i}>
          {i > 0 && ' '}
          <OrpWord word={w} />
        </React.Fragment>
      ))}
    </span>
  );
}

async function fetchText(url) {
  const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url));
  const data = await res.json();
  const html = data.contents || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,nav,footer,header,aside,form').forEach(n => n.remove());
  const el = doc.querySelector('article,main,[role=main]') || doc.body;
  const paras = Array.from(el.querySelectorAll('p')).map(p => p.textContent.trim()).filter(t => t.length > 30);
  return paras.length ? paras.join('\n\n') : (el.textContent || '').replace(/\s+/g, ' ').trim();
}

async function fetchRSS(feed) {
  const res = await fetch(RSS2JSON + encodeURIComponent(feed.url));
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'Feed error');
  return (data.items || []).slice(0, 15).map(item => ({
    title: item.title || '',
    link: item.link || '',
    description: (item.description || '').replace(/<[^>]+>/g, '').slice(0, 200),
    pubDate: item.pubDate || '',
    source: feed.name,
    category: feed.category,
    feedId: feed.id,
  }));
}

const C = {
  bg: '#0f0f13', surface: '#1a1a24', surface2: '#22222e',
  border: '#2a2a38', text: '#e8e8f0', muted: '#666680',
  accent: '#7c6af7', orpColor: '#e05252',
};

export default function App() {
  const [tab, setTab] = useState('reader');
  const [inputTab, setInputTab] = useState('paste');
  const [pasteText, setPasteText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
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
  const [enabledFeeds, setEnabledFeeds] = useState(() => {
    try {
      const saved = localStorage.getItem('speedr_feeds');
      return saved ? JSON.parse(saved) : DEFAULT_ENABLED;
    } catch { return DEFAULT_ENABLED; }
  });
  const [showSources, setShowSources] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [extraFeeds, setExtraFeeds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('speedr_custom') || '[]'); }
    catch { return []; }
  });

  const timerRef = useRef(null);
  const baseDelay = 60000 / wpm;

  const allFeeds = useMemo(() => [...ALL_FEEDS, ...extraFeeds], [extraFeeds]);
  const activeFeeds = useMemo(() => allFeeds.filter(f => enabledFeeds.includes(f.id)), [allFeeds, enabledFeeds]);

  useEffect(() => {
    if (activeText) {
      setChunks(tokenize(activeText));
      setIdx(0);
      setPlaying(false);
    }
  }, [activeText]);

  useEffect(() => {
    if (!playing || !chunks.length) return;
    if (idx >= chunks.length) { setPlaying(false); return; }
    const chunk = chunks[idx];
    const delay = baseDelay * chunk.split(' ').length * delayMult(chunk);
    timerRef.current = setTimeout(() => setIdx(i => i + 1), delay);
    return () => clearTimeout(timerRef.current);
  }, [playing, idx, chunks, baseDelay]);

  const loadFeeds = useCallback(async (feeds) => {
    setFeedLoading(true);
    setFeedStatuses({});
    const results = await Promise.allSettled(
      feeds.map(async f => {
        try {
          const items = await fetchRSS(f);
          setFeedStatuses(prev => ({ ...prev, [f.id]: 'ok' }));
          return items;
        } catch (e) {
          setFeedStatuses(prev => ({ ...prev, [f.id]: 'fail' }));
          return [];
        }
      })
    );
    const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    all.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    setFeedItems(all);
    setFeedLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'news') loadFeeds(activeFeeds);
  }, [tab]);

  const togglePlay = useCallback(() => {
    if (!chunks.length) return;
    if (idx >= chunks.length) setIdx(0);
    setPlaying(p => !p);
  }, [chunks.length, idx]);

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlError(''); setUrlLoading(true);
    try {
      let u = urlInput.trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      const text = await fetchText(u);
      if (!text || text.length < 50) throw new Error('Could not extract text from that page.');
      setActiveText(text);
      setTab('reader');
    } catch (e) { setUrlError(e.message); }
    finally { setUrlLoading(false); }
  };

  const handleReadArticle = async (item) => {
    setTab('reader');
    setUrlLoading(true);
    try {
      const text = item.link ? await fetchText(item.link) : '';
      setActiveText(text.length > 100 ? text : item.title + '. ' + item.description);
    } catch {
      setActiveText(item.title + '. ' + item.description);
    } finally { setUrlLoading(false); }
  };

  const toggleFeed = (id) => {
    const updated = enabledFeeds.includes(id)
      ? enabledFeeds.filter(f => f !== id)
      : [...enabledFeeds, id];
    setEnabledFeeds(updated);
    localStorage.setItem('speedr_feeds', JSON.stringify(updated));
  };

  const addCustomFeed = () => {
    if (!customUrl.trim()) return;
    const u = customUrl.trim();
    const name = u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    const id = 'custom_' + Date.now();
    const feed = { id, name, url: u, category: 'Custom' };
    const updated = [...extraFeeds, feed];
    setExtraFeeds(updated);
    setEnabledFeeds(prev => {
      const n = [...prev, id];
      localStorage.setItem('speedr_feeds', JSON.stringify(n));
      return n;
    });
    localStorage.setItem('speedr_custom', JSON.stringify(updated));
    setCustomUrl('');
  };

  const progress = chunks.length ? (idx / chunks.length) * 100 : 0;
  const totalWords = useMemo(() => activeText.trim().split(/\s+/).filter(Boolean).length, [activeText]);
  const wordsLeft = Math.max(0, totalWords - chunks.slice(0, idx).reduce((s, c) => s + c.split(' ').length, 0));
  const minsLeft = (wordsLeft / wpm).toFixed(1);
  const currentChunk = chunks[Math.min(idx, chunks.length - 1)] || '';
  const visibleItems = category === 'All' ? feedItems : feedItems.filter(i => i.category === category);
  const bookmarkletCode = "javascript:(function(){var u=encodeURIComponent(location.href);window.open('https://k269x9xzcd-bot.github.io/speedr/?url='+u,'_blank');})();";

  const s = {
    page: { minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui,-apple-system,sans-serif', paddingBottom: 64 },
    wrap: { maxWidth: 680, margin: '0 auto', padding: '0 16px' },
    topBar: { padding: '18px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    logo: { fontSize: 20, fontWeight: 600, letterSpacing: -0.5, color: C.text },
    card: { background: C.surface, borderRadius: 14, border: '1px solid ' + C.border, overflow: 'hidden', marginBottom: 14 },
    itab: (a) => ({ flex:1, padding:'9px 0', border:'none', background:'transparent', color: a ? C.accent : C.muted, fontSize:12, fontWeight: a?600:400, cursor:'pointer', borderBottom: a ? '2px solid '+C.accent : '2px solid transparent' }),
    textarea: { width:'100%', boxSizing:'border-box', padding:12, background:C.surface2, color:C.text, border:'1px solid '+C.border, borderRadius:10, fontSize:14, fontFamily:'inherit', resize:'vertical', outline:'none' },
    input: { flex:1, padding:'10px 12px', background:C.surface2, color:C.text, border:'1px solid '+C.border, borderRadius:10, fontSize:14, outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' },
    btn: (p) => ({ padding:'9px 16px', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', background: p ? C.accent : C.surface2, color: p ? '#fff' : C.muted }),
    stage: { minHeight:160, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 24px', cursor:'pointer', userSelect:'none' },
    chunkText: { fontSize:'clamp(28px,7vw,42px)', fontFamily:'ui-monospace,monospace', textAlign:'center', lineHeight:1.2, letterSpacing:0.5 },
    pill: (a) => ({ padding:'5px 12px', borderRadius:20, fontSize:12, border:'none', cursor:'pointer', background: a ? C.accent : C.surface2, color: a ? '#fff' : C.muted, whiteSpace:'nowrap', flexShrink:0 }),
    newsRow: { padding:'12px 14px', borderBottom:'1px solid '+C.border, display:'flex', gap:10, cursor:'pointer' },
    btab: (a) => ({ flex:1, padding:'10px 0 6px', border:'none', background:'transparent', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, color: a ? C.accent : C.muted }),
    toggle: (on) => ({ width:36, height:20, borderRadius:10, background: on ? C.accent : C.surface2, border:'1px solid '+(on?C.accent:C.border), position:'relative', cursor:'pointer', flexShrink:0, transition:'background 0.15s' }),
    toggleDot: (on) => ({ position:'absolute', top:2, left: on?16:2, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'left 0.15s' }),
  };

  return (
    <div style={s.page}>
      {focusMode && (
        <div onClick={togglePlay} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.96)', zIndex:100, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, cursor:'pointer' }}>
          <div style={{ ...s.chunkText, fontSize:'clamp(32px,8vw,52px)' }}>
            {chunks.length ? <ChunkView chunk={currentChunk} /> : <span style={{color:C.muted}}>no text loaded</span>}
          </div>
          <div style={{ width:'60%', height:2, background:C.border, borderRadius:1 }}>
            <div style={{ height:'100%', width:progress+'%', background:C.accent, transition:'width 0.1s linear' }} />
          </div>
          <div style={{ fontSize:12, color:C.muted }}>{playing ? 'tap to pause' : 'tap to play'} - {minsLeft} min left</div>
          <button onClick={e => { e.stopPropagation(); setFocusMode(false); setPlaying(false); }} style={{ position:'absolute', top:20, right:20, background:'none', border:'none', color:C.muted, fontSize:22, cursor:'pointer' }}>x</button>
        </div>
      )}

      <div style={s.wrap}>
        <div style={s.topBar}>
          <span style={s.logo}>speedr</span>
          <div style={{ display:'flex', gap:8 }}>
            {tab==='reader' && chunks.length > 0 && (
              <button onClick={() => { setFocusMode(true); setPlaying(true); }} style={{ ...s.btn(false), fontSize:12, padding:'6px 12px' }}>focus</button>
            )}
            {tab==='news' && (
              <button onClick={() => setShowSources(s => !s)} style={{ ...s.btn(showSources), fontSize:12, padding:'6px 12px' }}>
                {showSources ? 'done' : 'sources'}
              </button>
            )}
          </div>
        </div>

        {tab === 'reader' && (
          <>
            <div style={s.card}>
              <div style={{ display:'flex', borderBottom:'1px solid '+C.border }}>
                {['paste','url','bookmarklet'].map(t => (
                  <button key={t} style={s.itab(inputTab===t)} onClick={() => setInputTab(t)}>{t}</button>
                ))}
              </div>
              <div style={{ padding:12 }}>
                {inputTab === 'paste' && (
                  <>
                    <textarea style={s.textarea} rows={5} placeholder="Paste text to read..." value={pasteText} onChange={e => setPasteText(e.target.value)} />
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button style={s.btn(true)} onClick={() => setActiveText(pasteText)} disabled={!pasteText.trim()}>Load</button>
                      <button style={s.btn(false)} onClick={() => { setPasteText(''); setActiveText(''); setChunks([]); }}>Clear</button>
                    </div>
                  </>
                )}
                {inputTab === 'url' && (
                  <>
                    <div style={{ display:'flex', gap:8 }}>
                      <input style={s.input} type="url" placeholder="https://example.com/article" value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key==='Enter' && handleFetchUrl()} />
                      <button style={s.btn(true)} onClick={handleFetchUrl} disabled={urlLoading||!urlInput.trim()}>{urlLoading?'...':'Fetch'}</button>
                    </div>
                    {urlError && <div style={{ color:'#e05252', fontSize:12, marginTop:6 }}>{urlError}</div>}
                  </>
                )}
                {inputTab === 'bookmarklet' && (
                  <div>
                    <div style={{ fontSize:13, color:C.muted, marginBottom:10, lineHeight:1.6 }}>
                      On iPhone: bookmark any page, edit the bookmark, replace its URL with the code below. Tap it on any page to open in Speedr.
                    </div>
                    <textarea readOnly value={bookmarkletCode} rows={3} style={{ ...s.textarea, fontSize:11, fontFamily:'monospace', color:C.accent }} />
                  </div>
                )}
              </div>
            </div>

            {urlLoading && tab==='reader' && (
              <div style={{ textAlign:'center', color:C.muted, fontSize:13, padding:'12px 0' }}>Fetching article...</div>
            )}

            <div style={s.card}>
              <div style={s.stage} onClick={togglePlay}>
                {!chunks.length ? (
                  <span style={{ color:C.muted, fontSize:15 }}>load text above to begin</span>
                ) : idx===0 && !playing ? (
                  <span style={{ color:C.muted, fontSize:15 }}>tap to start</span>
                ) : (
                  <div style={s.chunkText}><ChunkView chunk={currentChunk} /></div>
                )}
              </div>
              <div style={{ height:3, background:C.surface2 }}>
                <div style={{ height:'100%', width:progress+'%', background:C.accent, transition:'width 0.1s linear' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', fontSize:12, color:C.muted }}>
                <span>{totalWords} words</span>
                <span>{minsLeft} min left</span>
                <span>{Math.round(progress)}% done</span>
              </div>
              <div style={{ padding:'0 14px 14px', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:12, color:C.muted, minWidth:60 }}>{wpm} wpm</span>
                <input type="range" min={100} max={700} step={10} value={wpm} onChange={e => setWpm(+e.target.value)} style={{ flex:1, accentColor:C.accent }} />
              </div>
            </div>
          </>
        )}

        {tab === 'news' && !showSources && (
          <>
            <div style={{ display:'flex', gap:6, margin:'4px 0 14px', overflowX:'auto', paddingBottom:4 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} style={s.pill(category===cat)} onClick={() => setCategory(cat)}>{cat}</button>
              ))}
            </div>

            <div style={s.card}>
              {feedLoading ? (
                <div style={{ padding:24, textAlign:'center', color:C.muted, fontSize:14 }}>Loading feeds...</div>
              ) : visibleItems.length === 0 ? (
                <div style={{ padding:24, textAlign:'center', color:C.muted, fontSize:14 }}>
                  No articles - try enabling more sources or refresh.
                </div>
              ) : visibleItems.map((item, i) => (
                <div key={i} style={s.newsRow} onClick={() => handleReadArticle(item)}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:C.accent, marginBottom:3 }}>{item.source} - {timeAgo(item.pubDate)}</div>
                    <div style={{ fontSize:14, color:C.text, lineHeight:1.4 }}>{item.title}</div>
                    {item.description && <div style={{ fontSize:12, color:C.muted, marginTop:4, lineHeight:1.4 }}>{item.description.slice(0,120)}...</div>}
                  </div>
                  <span style={{ fontSize:14, color:C.muted, flexShrink:0, paddingTop:2 }}>{'>'}</span>
                </div>
              ))}
            </div>

            <button style={{ ...s.btn(false), width:'100%' }} onClick={() => loadFeeds(activeFeeds)}>Refresh</button>
          </>
        )}

        {tab === 'news' && showSources && (
          <>
            <div style={{ fontSize:12, color:C.muted, margin:'4px 0 12px' }}>Toggle sources on/off. Changes save automatically.</div>

            {CATEGORIES.filter(c => c !== 'All').map(cat => {
              const catFeeds = allFeeds.filter(f => f.category === cat);
              if (!catFeeds.length) return null;
              return (
                <div key={cat} style={s.card}>
                  <div style={{ padding:'10px 14px', borderBottom:'1px solid '+C.border, fontSize:12, color:C.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>{cat}</div>
                  {catFeeds.map(f => {
                    const on = enabledFeeds.includes(f.id);
                    const status = feedStatuses[f.id];
                    return (
                      <div key={f.id} style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid '+C.border }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, color:C.text }}>{f.name}</div>
                          <div style={{ fontSize:11, color: status==='ok' ? '#34d399' : status==='fail' ? '#e05252' : C.muted }}>
                            {status==='ok' ? 'working' : status==='fail' ? 'failed' : 'not tested'}
                          </div>
                        </div>
                        <div style={s.toggle(on)} onClick={() => toggleFeed(f.id)}>
                          <div style={s.toggleDot(on)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div style={s.card}>
              <div style={{ padding:'10px 14px', borderBottom:'1px solid '+C.border, fontSize:12, color:C.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Add custom feed</div>
              <div style={{ padding:12, display:'flex', gap:8 }}>
                <input style={s.input} placeholder="https://publication.substack.com/feed" value={customUrl} onChange={e => setCustomUrl(e.target.value)} onKeyDown={e => e.key==='Enter' && addCustomFeed()} />
                <button style={s.btn(true)} onClick={addCustomFeed}>Add</button>
              </div>
            </div>

            <button style={{ ...s.btn(false), width:'100%', marginBottom:14 }} onClick={() => { setShowSources(false); loadFeeds(activeFeeds); }}>Apply and refresh</button>
          </>
        )}

        {tab === 'settings' && (
          <div style={s.card}>
            <div style={{ padding:16 }}>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:13, color:C.muted, marginBottom:8 }}>Default speed: {wpm} WPM</div>
                <input type="range" min={100} max={700} step={10} value={wpm} onChange={e => setWpm(+e.target.value)} style={{ width:'100%', accentColor:C.accent }} />
              </div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.8 }}>
                Theme: dark.<br />
                Tap anywhere on the reader to start or stop.<br />
                Tap focus to remove all distractions while reading.<br />
                Manage news sources from the News tab.
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:C.surface, borderTop:'1px solid '+C.border, display:'flex', zIndex:10 }}>
        {[['reader','R','Reader'],['news','N','News'],['settings','S','Settings']].map(([id,icon,label]) => (
          <button key={id} style={s.btab(tab===id)} onClick={() => setTab(id)}>
            <span style={{ fontSize:18, fontWeight:600, fontFamily:'monospace' }}>{icon}</span>
            <span style={{ fontSize:10 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
