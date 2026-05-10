import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const PRESET_FEEDS = [
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews', category: 'News' },
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'News' },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', category: 'News' },
  { name: 'NYT', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', category: 'News' },
  { name: 'Politico', url: 'https://www.politico.com/rss/politicopicks.xml', category: 'Politics' },
  { name: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/latest.xml', category: 'News' },
  { name: 'HuffPost', url: 'https://www.huffpost.com/section/front-page/feed', category: 'News' },
];

const CORS = 'https://api.allorigins.win/get?url=';

function useTheme() {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = e => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
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
    if (ends || long || !words[i + 1]) {
      chunks.push(w);
      i++;
    } else {
      chunks.push(w + ' ' + words[i + 1]);
      i += 2;
    }
  }
  return chunks;
}

function delayMult(chunk) {
  const last = chunk[chunk.length - 1];
  if ('.!?'.includes(last)) return 1.8;
  if (',:;'.includes(last)) return 1.3;
  return 1;
}

function getOrp(word) {
  const s = word.replace(/[.,!?;:]+$/, '');
  const p = word.slice(s.length);
  const idx = Math.max(0, Math.floor(s.length * 0.3));
  return { before: s.slice(0, idx), mid: s[idx] || '', after: s.slice(idx + 1), punct: p };
}

function OrpWord({ word, color }) {
  const { before, mid, after, punct } = getOrp(word);
  return (
    <span>
      {before}
      <span style={{ color }}>{mid}</span>
      {after}{punct}
    </span>
  );
}

function ChunkView({ chunk, orpColor }) {
  if (!chunk) return null;
  const words = chunk.split(' ');
  return (
    <span>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          {i > 0 && ' '}
          <OrpWord word={w} color={orpColor} />
        </React.Fragment>
      ))}
    </span>
  );
}

async function fetchText(url) {
  const res = await fetch(CORS + encodeURIComponent(url));
  const data = await res.json();
  const html = data.contents || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,nav,footer,header,aside,form').forEach(n => n.remove());
  const el = doc.querySelector('article,main,[role=main]') || doc.body;
  const paras = Array.from(el.querySelectorAll('p')).map(p => p.textContent.trim()).filter(t => t.length > 30);
  return paras.length ? paras.join('\n\n') : (el.textContent || '').replace(/\s+/g, ' ').trim();
}

async function fetchRSS(url) {
  const res = await fetch(CORS + encodeURIComponent(url));
  const data = await res.json();
  const xml = new DOMParser().parseFromString(data.contents || '', 'text/xml');
  const items = Array.from(xml.querySelectorAll('item')).slice(0, 20);
  return items.map(item => ({
    title: item.querySelector('title')?.textContent || '',
    link: item.querySelector('link')?.textContent || '',
    description: item.querySelector('description')?.textContent?.replace(/<[^>]+>/g, '') || '',
    pubDate: item.querySelector('pubDate')?.textContent || '',
  })).filter(i => i.title);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 60000;
  if (diff < 60) return Math.round(diff) + 'm ago';
  if (diff < 1440) return Math.round(diff / 60) + 'h ago';
  return Math.round(diff / 1440) + 'd ago';
}

export default function App() {
  const dark = useTheme();
  const C = dark ? {
    bg: '#0f0f13', surface: '#1a1a24', surface2: '#22222e',
    border: '#2a2a38', text: '#e8e8f0', muted: '#666680',
    accent: '#7c6af7', orpColor: '#e05252',
  } : {
    bg: '#f5f5f7', surface: '#ffffff', surface2: '#f0f0f5',
    border: '#dddde8', text: '#1a1a2e', muted: '#888899',
    accent: '#6c5ce7', orpColor: '#c0392b',
  };

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
  const [feeds, setFeeds] = useState(PRESET_FEEDS.slice(0, 4));
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [customFeedUrl, setCustomFeedUrl] = useState('');
  const [showAddFeed, setShowAddFeed] = useState(false);
  const timerRef = useRef(null);

  const baseDelay = 60000 / wpm;

  useEffect(() => {
    if (activeText) {
      const c = tokenize(activeText);
      setChunks(c);
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

  const loadFeed = useCallback(async (feedList) => {
    setFeedLoading(true);
    try {
      const results = await Promise.allSettled(feedList.map(f => fetchRSS(f.url).then(items => items.map(item => ({ ...item, source: f.name, category: f.category })))));
      const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      all.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      setFeedItems(all);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'news' && feedItems.length === 0) loadFeed(feeds);
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
    } catch (e) {
      setUrlError(e.message);
    } finally {
      setUrlLoading(false);
    }
  };

  const handleReadArticle = async (item) => {
    setTab('reader');
    if (item.link) {
      setUrlLoading(true);
      try {
        const text = await fetchText(item.link);
        setActiveText(text.length > 50 ? text : item.title + '. ' + item.description);
      } catch {
        setActiveText(item.title + '. ' + item.description);
      } finally {
        setUrlLoading(false);
      }
    } else {
      setActiveText(item.title + '. ' + item.description);
    }
  };

  const addCustomFeed = async () => {
    if (!customFeedUrl.trim()) return;
    const newFeed = { name: customFeedUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], url: customFeedUrl.trim(), category: 'Custom' };
    const updated = [...feeds, newFeed];
    setFeeds(updated);
    setCustomFeedUrl('');
    setShowAddFeed(false);
    loadFeed(updated);
  };

  const progress = chunks.length ? (idx / chunks.length) * 100 : 0;
  const totalWords = useMemo(() => activeText.trim().split(/\s+/).filter(Boolean).length, [activeText]);
  const wordsLeft = Math.max(0, totalWords - chunks.slice(0, idx).reduce((s, c) => s + c.split(' ').length, 0));
  const minsLeft = (wordsLeft / wpm).toFixed(1);
  const currentChunk = chunks[Math.min(idx, chunks.length - 1)] || '';
  const categories = ['All', ...Array.from(new Set(feeds.map(f => f.category)))];
  const filteredItems = activeCategory === 'All' ? feedItems : feedItems.filter(i => i.category === activeCategory);

  const bookmarkletCode = `javascript:(function(){var u=encodeURIComponent(location.href);window.open('https://k269x9xzcd-bot.github.io/speedr/?url='+u,'_blank');})();`;

  const s = {
    page: { minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui,-apple-system,sans-serif', paddingBottom: 64, transition: 'background 0.2s' },
    container: { maxWidth: 680, margin: '0 auto', padding: '0 16px' },
    topBar: { padding: '20px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    logo: { fontSize: 20, fontWeight: 600, letterSpacing: -0.5, color: C.text },
    card: { background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 14 },
    inputTabRow: { display: 'flex', borderBottom: `1px solid ${C.border}` },
    inputTabBtn: (active) => ({ flex: 1, padding: '10px 0', border: 'none', background: 'transparent', color: active ? C.accent : C.muted, fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent' }),
    textarea: { width: '100%', boxSizing: 'border-box', padding: 12, background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none' },
    urlInput: { flex: 1, padding: '10px 12px', background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: 'none', fontFamily: 'inherit' },
    btn: (primary) => ({ padding: '10px 16px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: primary ? C.accent : C.surface2, color: primary ? '#fff' : C.muted }),
    stage: { minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 24px', cursor: 'pointer', position: 'relative', userSelect: 'none' },
    chunkText: { fontSize: 'clamp(28px,7vw,42px)', fontFamily: 'ui-monospace,monospace', textAlign: 'center', lineHeight: 1.2, letterSpacing: 0.5 },
    progressWrap: { height: 3, background: C.surface2 },
    progressBar: { height: '100%', background: C.accent, transition: 'width 0.1s linear' },
    statRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 12, color: C.muted },
    sliderWrap: { padding: '0 14px 14px', display: 'flex', alignItems: 'center', gap: 10 },
    pill: (active) => ({ padding: '5px 12px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer', background: active ? C.accent : C.surface2, color: active ? '#fff' : C.muted, whiteSpace: 'nowrap' }),
    newsItem: { padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' },
    bottomTab: (active) => ({ flex: 1, padding: '10px 0 6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: active ? C.accent : C.muted }),
  };

  return (
    <div style={s.page}>
      {focusMode && (
        <div onClick={() => { togglePlay(); }} style={{ position: 'fixed', inset: 0, background: dark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, cursor: 'pointer' }}>
          <div style={{ ...s.chunkText, fontSize: 'clamp(32px,8vw,52px)' }}>
            {chunks.length ? <ChunkView chunk={currentChunk} orpColor={C.orpColor} /> : <span style={{ color: C.muted }}>no text loaded</span>}
          </div>
          <div style={{ width: '60%', height: 2, background: C.border, borderRadius: 1 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: C.accent, borderRadius: 1, transition: 'width 0.1s linear' }} />
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>{playing ? 'tap to pause' : 'tap to play'} &nbsp;-&nbsp; {minsLeft} min left</div>
          <button onClick={e => { e.stopPropagation(); setFocusMode(false); }} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: C.muted, fontSize: 24, cursor: 'pointer' }}>x</button>
        </div>
      )}

      <div style={s.container}>
        <div style={s.topBar}>
          <span style={s.logo}>speedr</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {tab === 'reader' && chunks.length > 0 && (
              <button onClick={() => setFocusMode(true)} style={{ ...s.btn(false), fontSize: 12, padding: '6px 12px' }}>focus</button>
            )}
          </div>
        </div>

        {tab === 'reader' && (
          <>
            <div style={s.card}>
              <div style={s.inputTabRow}>
                {['paste','url','bookmarklet'].map(t => (
                  <button key={t} style={s.inputTabBtn(inputTab===t)} onClick={() => setInputTab(t)}>{t}</button>
                ))}
              </div>
              <div style={{ padding: 12 }}>
                {inputTab === 'paste' && (
                  <>
                    <textarea style={s.textarea} rows={5} placeholder="Paste text to read..." value={pasteText} onChange={e => setPasteText(e.target.value)} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button style={s.btn(true)} onClick={() => setActiveText(pasteText)} disabled={!pasteText.trim()}>Load</button>
                      <button style={s.btn(false)} onClick={() => { setPasteText(''); setActiveText(''); setChunks([]); }}>Clear</button>
                    </div>
                  </>
                )}
                {inputTab === 'url' && (
                  <>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input style={s.urlInput} type="url" placeholder="https://example.com/article" value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFetchUrl()} />
                      <button style={s.btn(true)} onClick={handleFetchUrl} disabled={urlLoading || !urlInput.trim()}>{urlLoading ? '...' : 'Fetch'}</button>
                    </div>
                    {urlError && <div style={{ color: '#e05252', fontSize: 12, marginTop: 6 }}>{urlError}</div>}
                  </>
                )}
                {inputTab === 'bookmarklet' && (
                  <div>
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>
                      On iPhone: bookmark any page, edit the bookmark, replace its URL with the code below. Tap it on any page to read it in Speedr.
                    </div>
                    <textarea readOnly value={bookmarkletCode} rows={3} style={{ ...s.textarea, fontSize: 11, fontFamily: 'monospace', color: C.accent }} />
                  </div>
                )}
              </div>
            </div>

            <div style={s.card}>
              <div style={s.stage} onClick={togglePlay}>
                {!chunks.length ? (
                  <span style={{ color: C.muted, fontSize: 15 }}>load text above to begin</span>
                ) : idx === 0 && !playing ? (
                  <span style={{ color: C.muted, fontSize: 15 }}>tap to start</span>
                ) : (
                  <div style={s.chunkText}>
                    <ChunkView chunk={currentChunk} orpColor={C.orpColor} />
                  </div>
                )}
              </div>
              <div style={s.progressWrap}>
                <div style={{ ...s.progressBar, width: `${progress}%` }} />
              </div>
              <div style={s.statRow}>
                <span>{totalWords} words</span>
                <span>{minsLeft} min left</span>
                <span>{Math.round(progress)}% done</span>
              </div>
              <div style={s.sliderWrap}>
                <span style={{ fontSize: 12, color: C.muted, minWidth: 60 }}>{wpm} wpm</span>
                <input type="range" min={100} max={700} step={10} value={wpm} onChange={e => setWpm(+e.target.value)} style={{ flex: 1, accentColor: C.accent }} />
              </div>
            </div>
          </>
        )}

        {tab === 'news' && (
          <>
            <div style={{ display: 'flex', gap: 8, margin: '4px 0 14px', overflowX: 'auto', paddingBottom: 4 }}>
              {categories.map(cat => (
                <button key={cat} style={s.pill(activeCategory===cat)} onClick={() => setActiveCategory(cat)}>{cat}</button>
              ))}
            </div>

            <div style={s.card}>
              {feedLoading ? (
                <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 14 }}>Loading feeds...</div>
              ) : filteredItems.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 14 }}>No articles yet</div>
              ) : filteredItems.map((item, i) => (
                <div key={i} style={s.newsItem} onClick={() => handleReadArticle(item)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.accent, marginBottom: 3 }}>{item.source} - {timeAgo(item.pubDate)}</div>
                    <div style={{ fontSize: 14, color: C.text, lineHeight: 1.4 }}>{item.title}</div>
                  </div>
                  <span style={{ fontSize: 18, color: C.muted, flexShrink: 0 }}>{'>'}</span>
                </div>
              ))}
            </div>

            <div style={s.card}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Your feeds</div>
              {feeds.map((f, i) => (
                <div key={i} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: 14, color: C.text }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{f.category}</div>
                  </div>
                  <button onClick={() => { const updated = feeds.filter((_, j) => j !== i); setFeeds(updated); }} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16 }}>x</button>
                </div>
              ))}
              {showAddFeed ? (
                <div style={{ padding: 12, display: 'flex', gap: 8 }}>
                  <input style={s.urlInput} placeholder="RSS feed URL" value={customFeedUrl} onChange={e => setCustomFeedUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomFeed()} />
                  <button style={s.btn(true)} onClick={addCustomFeed}>Add</button>
                </div>
              ) : (
                <button onClick={() => setShowAddFeed(true)} style={{ padding: '10px 14px', background: 'none', border: 'none', color: C.accent, fontSize: 14, cursor: 'pointer', textAlign: 'left', width: '100%' }}>+ Add feed</button>
              )}
            </div>

            <button style={{ ...s.btn(false), width: '100%', marginTop: 4 }} onClick={() => loadFeed(feeds)}>Refresh feeds</button>
          </>
        )}

        {tab === 'settings' && (
          <div style={s.card}>
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Default speed: {wpm} WPM</div>
                <input type="range" min={100} max={700} step={10} value={wpm} onChange={e => setWpm(+e.target.value)} style={{ width: '100%', accentColor: C.accent }} />
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>ORP highlight color</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['#e05252','#a78bfa','#ef9f27','#34d399'].map(color => (
                  <div key={color} style={{ width: 28, height: 28, borderRadius: '50%', background: color, border: `2px solid ${C.orpColor === color ? C.text : 'transparent'}`, cursor: 'pointer' }} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                Theme follows your system preference (dark/light).<br />
                Tap anywhere on the reader to start or stop.<br />
                Use focus mode to remove all distractions.
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: 'flex', zIndex: 10 }}>
        {[['reader','R','Reader'],['news','N','News'],['settings','S','Settings']].map(([id, icon, label]) => (
          <button key={id} style={s.bottomTab(tab===id)} onClick={() => setTab(id)}>
            <span style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace' }}>{icon}</span>
            <span style={{ fontSize: 10 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
