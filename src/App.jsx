import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const COLORS = {
  bg: '#0f0f13',
  surface: '#1a1a24',
  surfaceAlt: '#22222e',
  border: '#2a2a38',
  text: '#e8e8f0',
  textDim: '#9090a0',
  accent: '#7c6af7',
  accentSoft: '#a78bfa',
};

function tokenize(text) {
  if (!text) return [];
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const w1 = words[i];
    const endsSentence = /[.!?]$/.test(w1);
    const longWord = w1.length > 10;
    if (endsSentence || longWord) {
      chunks.push(w1);
      i += 1;
      continue;
    }
    if (i + 1 < words.length) {
      const w2 = words[i + 1];
      chunks.push(w1 + ' ' + w2);
      i += 2;
    } else {
      chunks.push(w1);
      i += 1;
    }
  }
  return chunks;
}

function chunkDelayMultiplier(chunk) {
  if (!chunk) return 1;
  const last = chunk[chunk.length - 1];
  if (last === '.' || last === '!' || last === '?') return 1.8;
  if (last === ',' || last === ':' || last === ';') return 1.3;
  return 1;
}

function getOrpIndex(word) {
  const len = word.length;
  if (len <= 1) return 0;
  return Math.max(0, Math.min(len - 1, Math.floor(len * 0.3)));
}

function OrpWord({ word }) {
  const stripped = word.replace(/[.,!?;:]+$/, '');
  const punct = word.slice(stripped.length);
  const idx = getOrpIndex(stripped);
  const before = stripped.slice(0, idx);
  const mid = stripped.slice(idx, idx + 1);
  const after = stripped.slice(idx + 1);
  return (
    <span>
      {before}
      <span style={{ color: COLORS.accentSoft }}>{mid}</span>
      {after}
      {punct}
    </span>
  );
}

function ChunkDisplay({ chunk }) {
  if (!chunk) {
    return (
      <span style={{ color: COLORS.textDim, fontSize: 28 }}>ready</span>
    );
  }
  const parts = chunk.split(' ');
  return (
    <span>
      {parts.map((w, i) => (
        <React.Fragment key={i}>
          {i > 0 && ' '}
          <OrpWord word={w} />
        </React.Fragment>
      ))}
    </span>
  );
}

async function fetchArticleText(url) {
  const proxy = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
  const res = await fetch(proxy);
  if (!res.ok) throw new Error('Fetch failed: ' + res.status);
  const data = await res.json();
  const html = data && data.contents ? data.contents : '';
  if (!html) throw new Error('Empty response');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript, nav, footer, header, aside, form').forEach((n) => n.remove());
  const article = doc.querySelector('article') || doc.querySelector('main') || doc.body;
  const paragraphs = Array.from(article.querySelectorAll('p'))
    .map((p) => p.textContent.trim())
    .filter((t) => t.length > 30);
  let text = paragraphs.join('\n\n');
  if (!text) {
    text = (article.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return text;
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 14px',
        background: active ? COLORS.surface : 'transparent',
        color: active ? COLORS.text : COLORS.textDim,
        border: 'none',
        borderBottom: active ? '2px solid ' + COLORS.accent : '2px solid transparent',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: 0.3,
      }}
    >
      {children}
    </button>
  );
}

function Button({ onClick, disabled, children, primary, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 18px',
        background: primary ? COLORS.accent : COLORS.surfaceAlt,
        color: COLORS.text,
        border: '1px solid ' + (primary ? COLORS.accent : COLORS.border),
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontSize: 16,
        fontWeight: 600,
        fontFamily: 'monospace',
        minWidth: 56,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState('paste');
  const [pasteText, setPasteText] = useState('');
  const [url, setUrl] = useState('');
  const [activeText, setActiveText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [wpm, setWpm] = useState(350);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const chunks = useMemo(() => tokenize(activeText), [activeText]);
  const totalWords = useMemo(() => {
    if (!activeText) return 0;
    return activeText.trim().split(/\s+/).filter(Boolean).length;
  }, [activeText]);

  const baseDelay = 60000 / wpm;

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (index >= chunks.length) {
      setPlaying(false);
      return;
    }
    const chunk = chunks[index];
    const wordsInChunk = chunk ? chunk.split(' ').length : 1;
    const mult = chunkDelayMultiplier(chunk);
    const delay = baseDelay * wordsInChunk * mult;
    timerRef.current = setTimeout(() => {
      setIndex((i) => i + 1);
    }, delay);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, index, chunks, baseDelay]);

  const handleLoadPaste = useCallback(() => {
    setActiveText(pasteText);
    setIndex(0);
    setPlaying(false);
  }, [pasteText]);

  const handleFetchUrl = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setFetchError('');
    try {
      const text = await fetchArticleText(url.trim());
      if (!text) throw new Error('No readable text found');
      setActiveText(text);
      setIndex(0);
      setPlaying(false);
    } catch (err) {
      setFetchError(err.message || 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [url]);

  const togglePlay = useCallback(() => {
    if (chunks.length === 0) return;
    if (index >= chunks.length) setIndex(0);
    setPlaying((p) => !p);
  }, [chunks.length, index]);

  const stepBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 3));
  }, []);

  const clearAll = useCallback(() => {
    setPlaying(false);
    setIndex(0);
    setActiveText('');
    setPasteText('');
    setUrl('');
    setFetchError('');
  }, []);

  const currentChunk = chunks[index] || '';
  const progress = chunks.length > 0 ? Math.min(100, (index / chunks.length) * 100) : 0;
  const wordsRead = useMemo(() => {
    if (!chunks.length) return 0;
    let count = 0;
    for (let i = 0; i < index && i < chunks.length; i += 1) {
      count += chunks[i].split(' ').length;
    }
    return count;
  }, [chunks, index]);
  const wordsLeft = Math.max(0, totalWords - wordsRead);
  const minsLeft = wpm > 0 ? wordsLeft / wpm : 0;
  const percentDone = totalWords > 0 ? Math.round((wordsRead / totalWords) * 100) : 0;

  const bookmarkletCode =
    "javascript:(function(){var t=document.body.innerText;var w=window.open('https://k269x9xzcd-bot.github.io/speedr/','_blank');setTimeout(function(){if(w){w.postMessage({speedrText:t},'*');}},800);})();";

  useEffect(() => {
    function handleMessage(e) {
      if (e && e.data && typeof e.data.speedrText === 'string') {
        setActiveText(e.data.speedrText);
        setPasteText(e.data.speedrText);
        setTab('paste');
        setIndex(0);
        setPlaying(false);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        padding: '24px 16px 64px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <header style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 0.5 }}>
            Speedr
          </h1>
          <p style={{ margin: '4px 0 0', color: COLORS.textDim, fontSize: 14 }}>
            RSVP speed reader
          </p>
        </header>

        <div
          style={{
            background: COLORS.surface,
            borderRadius: 12,
            border: '1px solid ' + COLORS.border,
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', borderBottom: '1px solid ' + COLORS.border }}>
            <Tab active={tab === 'paste'} onClick={() => setTab('paste')}>
              Paste Text
            </Tab>
            <Tab active={tab === 'url'} onClick={() => setTab('url')}>
              URL / Webpage
            </Tab>
          </div>

          <div style={{ padding: 16 }}>
            {tab === 'paste' && (
              <div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste text to read..."
                  rows={6}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: 12,
                    background: COLORS.surfaceAlt,
                    color: COLORS.text,
                    border: '1px solid ' + COLORS.border,
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <Button onClick={handleLoadPaste} primary disabled={!pasteText.trim()}>
                    Load
                  </Button>
                  <Button onClick={clearAll}>x</Button>
                </div>
              </div>
            )}

            {tab === 'url' && (
              <div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: 12,
                    background: COLORS.surfaceAlt,
                    color: COLORS.text,
                    border: '1px solid ' + COLORS.border,
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <Button onClick={handleFetchUrl} primary disabled={!url.trim() || loading}>
                    {loading ? '...' : 'Fetch'}
                  </Button>
                  <Button onClick={clearAll}>x</Button>
                </div>
                {fetchError && (
                  <div style={{ marginTop: 10, color: '#ff7676', fontSize: 13 }}>
                    {fetchError}
                  </div>
                )}
                <div style={{ marginTop: 10, color: COLORS.textDim, fontSize: 12 }}>
                  Uses api.allorigins.win as a CORS proxy. Some sites block scraping.
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            background: COLORS.surface,
            borderRadius: 12,
            border: '1px solid ' + COLORS.border,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              textAlign: 'center',
              minHeight: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 8px',
              letterSpacing: 0.5,
            }}
          >
            <ChunkDisplay chunk={currentChunk} />
          </div>

          <div
            style={{
              height: 4,
              background: COLORS.surfaceAlt,
              borderRadius: 2,
              overflow: 'hidden',
              marginTop: 12,
            }}
          >
            <div
              style={{
                height: '100%',
                width: progress + '%',
                background: COLORS.accent,
                transition: 'width 0.15s linear',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18 }}>
            <Button onClick={stepBack} disabled={index === 0}>{'<<'}</Button>
            <Button onClick={togglePlay} primary disabled={chunks.length === 0}>
              {playing ? '||' : '>'}
            </Button>
          </div>

          <div style={{ marginTop: 18 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: COLORS.textDim,
                marginBottom: 6,
              }}
            >
              <span>Speed</span>
              <span>{wpm} WPM</span>
            </div>
            <input
              type="range"
              min={100}
              max={700}
              step={10}
              value={wpm}
              onChange={(e) => setWpm(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: COLORS.accent }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              marginTop: 18,
              padding: 12,
              background: COLORS.surfaceAlt,
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            <Stat label="Words" value={totalWords} />
            <Stat label="Mins left" value={minsLeft.toFixed(1)} />
            <Stat label="WPM" value={wpm} />
            <Stat label="Done" value={percentDone + '%'} />
          </div>
        </div>

        <div
          style={{
            background: COLORS.surface,
            borderRadius: 12,
            border: '1px solid ' + COLORS.border,
            padding: 16,
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 14, letterSpacing: 0.3 }}>
            Safari bookmarklet
          </h3>
          <p style={{ margin: '0 0 10px', color: COLORS.textDim, fontSize: 13, lineHeight: 1.5 }}>
            Drag this link to your bookmarks bar. Tap it on any page to send the text to Speedr.
          </p>
          <a
            href={bookmarkletCode}
            onClick={(e) => e.preventDefault()}
            style={{
              display: 'inline-block',
              padding: '8px 14px',
              background: COLORS.surfaceAlt,
              color: COLORS.accentSoft,
              borderRadius: 6,
              border: '1px solid ' + COLORS.border,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Send to Speedr
          </a>
          <details style={{ marginTop: 12, color: COLORS.textDim, fontSize: 12 }}>
            <summary style={{ cursor: 'pointer' }}>iOS instructions</summary>
            <ol style={{ margin: '8px 0 0 18px', padding: 0, lineHeight: 1.6 }}>
              <li>Bookmark any page in Safari.</li>
              <li>Edit the bookmark and replace the URL with the code below.</li>
              <li>Tap the bookmark while reading any article.</li>
            </ol>
            <textarea
              readOnly
              value={bookmarkletCode}
              rows={3}
              style={{
                marginTop: 8,
                width: '100%',
                boxSizing: 'border-box',
                padding: 8,
                background: COLORS.bg,
                color: COLORS.text,
                border: '1px solid ' + COLORS.border,
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 11,
              }}
            />
          </details>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color: COLORS.text, fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
