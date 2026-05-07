import { useState, useEffect, useRef, useCallback } from "react";

function tokenize(text) {
  const raw = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const chunks = [];
  let i = 0;
  while (i < raw.length) {
    const word = raw[i];
    const next = raw[i + 1];
    const endsChunk = /[.!?…]["']?$/.test(word) || !next || word.length > 10;
    if (endsChunk) {
      chunks.push(word);
      i += 1;
    } else {
      chunks.push(word + " " + next);
      i += 2;
    }
  }
  return chunks;
}

function chunkDelay(chunk, baseMs) {
  let mult = 1;
  if (/[.!?…]["']?$/.test(chunk)) mult = 1.8;
  else if (/[,;:—]/.test(chunk)) mult = 1.3;
  if (chunk.split(" ").some((w) => w.length > 10)) mult += 0.2;
  return baseMs * mult;
}

const CORS_PROXY = "https://api.allorigins.win/get?url=";

async function fetchPageText(url) {
  const res = await fetch(CORS_PROXY + encodeURIComponent(url));
  const data = await res.json();
  const html = data.contents;
  const doc = new DOMParser().parseFromString(html, "text/html");
  ["script","style","nav","header","footer","aside","noscript"].forEach(
    (tag) => doc.querySelectorAll(tag).forEach((el) => el.remove())
  );
  const main =
    doc.querySelector("article, main, [role='main'], .post-content, .entry-content") ||
    doc.body;
  return main.innerText || main.textContent || "";
}

function HighlightedChunk({ text }) {
  if (!text) return null;
  const words = text.split(" ");
  return (
    <span>
      {words.map((word, wi) => {
        const pos = Math.max(0, Math.floor(word.length * 0.3));
        return (
          <span key={wi}>
            {wi > 0 && " "}
            {word.slice(0, pos)}
            <span style={{ color: "#a78bfa" }}>{word[pos]}</span>
            {word.slice(pos + 1)}
          </span>
        );
      })}
    </span>
  );
}

export default function App() {
  const [tab, setTab] = useState("paste");
  const [pasteText, setPasteText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [chunks, setChunks] = useState([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wpm, setWpm] = useState(280);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);
  const wordsReadRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get("url");
    if (u) { setTab("url"); setUrlInput(u); }
  }, []);

  const loadText = useCallback((text) => {
    const cleaned = text.replace(/\r\n/g, "\n").trim();
    if (!cleaned) return;
    const c = tokenize(cleaned);
    setChunks(c);
    setIdx(0);
    setPlaying(false);
    setDone(false);
    wordsReadRef.current = 0;
  }, []);

  useEffect(() => {
    if (tab === "paste" && pasteText.trim()) loadText(pasteText);
  }, [pasteText, tab, loadText]);

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlError("");
    setUrlLoading(true);
    try {
      let u = urlInput.trim();
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      const text = await fetchPageText(u);
      if (!text || text.length < 50) throw new Error("Could not extract readable text from that page.");
      loadText(text);
    } catch (e) {
      setUrlError(e.message || "Failed to fetch page.");
    } finally {
      setUrlLoading(false);
    }
  };

  useEffect(() => {
    if (!playing || !chunks.length) return;
    if (idx >= chunks.length) { setPlaying(false); setDone(true); return; }
    const chunk = chunks[idx];
    const baseMs = (60 / wpm) * 1000 * chunk.split(" ").length;
    const delay = chunkDelay(chunk, baseMs);
    timerRef.current = setTimeout(() => {
      wordsReadRef.current += chunk.split(" ").length;
      setIdx((i) => i + 1);
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [playing, idx, chunks, wpm]);

  const togglePlay = () => {
    if (done) { setIdx(0); setDone(false); setPlaying(true); wordsReadRef.current = 0; return; }
    if (!chunks.length) return;
    setPlaying((p) => !p);
  };

  const restart = () => {
    clearTimeout(timerRef.current);
    setIdx(0); setPlaying(false); setDone(false); wordsReadRef.current = 0;
  };

  const stepBack = () => { if (!playing) setIdx((i) => Math.max(0, i - 3)); };

  const progress = chunks.length ? (idx / chunks.length) * 100 : 0;
  const totalWords = chunks.reduce((s, c) => s + c.split(" ").length, 0);
  const wordsLeft = chunks.slice(idx).reduce((s, c) => s + c.split(" ").length, 0);
  const minsLeft = Math.ceil(wordsLeft / wpm);
  const currentChunk = chunks[Math.min(idx, chunks.length - 1)] || "";

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>Speedr<span style={s.logoMuted}>.app</span></div>
        {chunks.length > 0 && (
          <button style={s.btnGhost} onClick={restart}>✕ Clear</button>
        )}
      </div>

      <div style={s.tabs}>
        {["paste", "url"].map((t) => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === "paste" ? "Paste Text" : "URL / Webpage"}
          </button>
        ))}
      </div>

      {tab === "paste" && (
        <div>
          <textarea
            style={s.textarea}
            placeholder="Paste any text here and it loads instantly…"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          {pasteText && (
            <div style={s.wordCount}>{pasteText.split(/\s+/).filter(Boolean).length} words</div>
          )}
        </div>
      )}

      {tab === "url" && (
        <div>
          <div style={s.urlRow}>
            <input
              style={s.urlInput}
              type="url"
              placeholder="https://example.com/article"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
            />
            <button
              style={{ ...s.btnPrimary, opacity: urlLoading || !urlInput.trim() ? 0.45 : 1 }}
              onClick={handleFetchUrl}
              disabled={urlLoading || !urlInput.trim()}
            >
              {urlLoading ? "…" : "Fetch"}
            </button>
          </div>
          {urlError && <div style={s.error}>{urlError}</div>}
          {urlLoading && <div style={s.loading}>Fetching article text…</div>}
        </div>
      )}

      {chunks.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={s.stage}>
            <div style={s.stageRule} />
            {done ? (
              <span style={{ color: "#34d399", fontSize: 15 }}>✓ Finished</span>
            ) : idx === 0 && !playing ? (
              <span style={{ color: "#888899", fontSize: 15 }}>Press ▶ to begin</span>
            ) : (
              <div style={s.chunkText}><HighlightedChunk text={currentChunk} /></div>
            )}
            <div style={s.stageMeta}>{idx} / {chunks.length} chunks</div>
          </div>

          <div style={s.progressWrap}>
            <div style={{ ...s.progressBar, width: `${progress}%` }} />
          </div>

          <div style={s.controls}>
            <button style={s.ctrlBtn} onClick={stepBack}>‹‹</button>
            <button style={s.ctrlBtnPlay} onClick={togglePlay}>
              {playing ? "||" : done ? "<<" : ">"}
            </button>
            <div style={s.speedGroup}>
              <button style={s.ctrlBtn} onClick={() => setWpm((w) => Math.max(80, w - 20))}>−</button>
              <div style={s.wpmLabel}>{wpm} <span style={s.wpmUnit}>wpm</span></div>
              <button style={s.ctrlBtn} onClick={() => setWpm((w) => Math.min(900, w + 20))}>+</button>
            </div>
          </div>

          <div style={s.statsRow}>
            <span>{totalWords} words</span>
            <span>·</span>
            <span>{wordsLeft} left</span>
            <span>·</span>
            <span>~{minsLeft} min</span>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#0b0b14",
    color: "#e6e6f0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    padding: "32px 20px",
    maxWidth: 760,
    margin: "0 auto",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  logo: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" },
  logoMuted: { color: "#888899", fontWeight: 400 },
  btnGhost: {
    background: "transparent",
    color: "#888899",
    border: "1px solid #25253a",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  btnPrimary: {
    background: "#a78bfa",
    color: "#0b0b14",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  tabs: { display: "flex", gap: 8, marginBottom: 16 },
  tab: {
    background: "transparent",
    color: "#888899",
    border: "1px solid #25253a",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 14,
    cursor: "pointer",
  },
  tabActive: { color: "#e6e6f0", borderColor: "#a78bfa" },
  textarea: {
    width: "100%",
    minHeight: 160,
    background: "#15151f",
    color: "#e6e6f0",
    border: "1px solid #25253a",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
  },
  wordCount: { color: "#888899", fontSize: 13, marginTop: 6 },
  urlRow: { display: "flex", gap: 8 },
  urlInput: {
    flex: 1,
    background: "#15151f",
    color: "#e6e6f0",
    border: "1px solid #25253a",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 15,
    fontFamily: "inherit",
  },
  error: { color: "#f87171", fontSize: 14, marginTop: 10 },
  loading: { color: "#888899", fontSize: 14, marginTop: 10 },
  stage: {
    background: "#15151f",
    border: "1px solid #25253a",
    borderRadius: 14,
    padding: "56px 24px",
    minHeight: 160,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  stageRule: {
    position: "absolute",
    top: "50%",
    left: "10%",
    right: "10%",
    height: 1,
    background: "#25253a",
    opacity: 0.4,
  },
  chunkText: { fontSize: 28, fontWeight: 500, textAlign: "center", lineHeight: 1.3 },
  stageMeta: {
    position: "absolute",
    bottom: 12,
    right: 16,
    color: "#888899",
    fontSize: 12,
  },
  progressWrap: {
    height: 4,
    background: "#25253a",
    borderRadius: 2,
    marginTop: 16,
    overflow: "hidden",
  },
  progressBar: { height: "100%", background: "#a78bfa", transition: "width 120ms linear" },
  controls: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  ctrlBtn: {
    background: "#15151f",
    color: "#e6e6f0",
    border: "1px solid #25253a",
    borderRadius: 8,
    width: 44,
    height: 44,
    fontSize: 16,
    cursor: "pointer",
  },
  ctrlBtnPlay: {
    background: "#a78bfa",
    color: "#0b0b14",
    border: "none",
    borderRadius: 8,
    width: 56,
    height: 44,
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
  },
  speedGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginLeft: 12,
  },
  wpmLabel: {
    minWidth: 78,
    textAlign: "center",
    fontSize: 14,
    fontWeight: 600,
  },
  wpmUnit: { color: "#888899", fontWeight: 400 },
  statsRow: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    color: "#888899",
    fontSize: 13,
    marginTop: 14,
  },
};
