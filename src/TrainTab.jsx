import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'speedr_train';
const MODEL = 'claude-haiku-4-5-20251001';
const SPEED_MAX = 600;
const BASELINE_WPM = 250;

const PASSAGES = [
  { id:'ocean', title:'Ocean Currents', text:
    "Ocean currents are massive flows of seawater that move continuously through the world's oceans, shaping climate and supporting life. They are driven by a mix of wind, temperature, salinity, and the rotation of the Earth. Surface currents, like the Gulf Stream, are mostly powered by wind and carry warm water from the equator toward the poles. Deep currents move slowly along the seafloor, pushed by differences in water density: cold, salty water sinks while warmer water rises. Together these flows form a global conveyor belt that takes nearly a thousand years to complete one full cycle. Currents transport heat, nutrients, and oxygen, making them essential to weather patterns and marine ecosystems. They also influence storm intensity and the timing of seasons in coastal regions. Disruptions caused by warming temperatures and melting ice can weaken these flows, potentially shifting weather across entire continents. Scientists track currents using satellites, buoys, and submarines, watching for signs that the planet's vast circulatory system may be slowing down faster than expected."
  },
  { id:'silk', title:'The Silk Road', text:
    "The Silk Road was not a single road but a vast network of trade routes that stretched across Asia, Europe, and Africa for more than fifteen hundred years. It linked dynasties in China to merchants in Persia, traders in Arabia, and markets in Venice, allowing goods, ideas, and even diseases to travel staggering distances. Silk, which gave the route its name, was prized in Rome and treated almost like currency, though spices, paper, jade, glass, and porcelain were equally important. Travelers crossed deserts, mountains, and bandit-controlled valleys, often joining caravans for protection during journeys that could last years. Cities like Samarkand and Kashgar grew rich as crossroads of language, religion, and cuisine. The Silk Road carried Buddhism into China, gunpowder toward Europe, and the bubonic plague into the medieval world. As ocean trade grew in the fifteenth century, the overland routes declined, but their cultural legacy remained. Many ideas we now take for granted, including printing, papermaking, and astronomy, spread along these dusty paths long before modern globalization began."
  },
  { id:'game', title:'Game Theory', text:
    "Game theory is the mathematical study of strategic decision-making, where the outcome for each participant depends on the choices made by others. It began as a tool for analyzing parlor games like chess and poker but quickly grew into a framework used in economics, biology, political science, and computer science. A classic example is the prisoner's dilemma, in which two suspects, unable to communicate, must decide whether to cooperate or betray each other. Although both would benefit from staying silent, each is tempted to confess to avoid the worst possible outcome, leading to a result that is rational individually but poor collectively. This tension between self-interest and group benefit appears everywhere, from arms races to climate negotiations to bidding wars. Game theorists study equilibria, points where no player can improve by changing strategy alone, and use these models to predict behavior in markets, elections, and evolutionary biology. Modern researchers also explore games with incomplete information, repeated interactions, and learning algorithms, helping artificial intelligence systems navigate competitive environments and giving policymakers new tools for managing complex human conflicts."
  },
];

const BAKED = {
  ocean: [
    { q:'What primarily drives surface currents like the Gulf Stream?', choices:['Water density','Wind','Tides','Earth\'s gravity'], answer:1 },
    { q:'About how long does the global conveyor belt take to complete one cycle?', choices:['100 years','500 years','~1,000 years','10,000 years'], answer:2 },
    { q:'What causes deep ocean currents to move?', choices:['Wind','Tides','Density differences from temperature and salinity','The moon'], answer:2 },
    { q:'According to the passage, what might disrupt these flows?', choices:['Warmer temps and melting ice','Overfishing','Volcanic eruptions','Magnetic field shifts'], answer:0 },
  ],
  silk: [
    { q:'The Silk Road was best described as:', choices:['A single paved road','A network of trade routes','A sea-only route','A railway'], answer:1 },
    { q:'Which of these traveled along the Silk Road?', choices:['Only silk','Goods, ideas, and diseases','Only Roman armies','Only spices'], answer:1 },
    { q:'Why did overland Silk Road trade decline in the 15th century?', choices:['War destroyed the routes','Ocean trade grew','Silk went out of fashion','Borders closed'], answer:1 },
    { q:'Which two cities are named as crossroads on the route?', choices:['Rome and Cairo','Venice and Beijing','Samarkand and Kashgar','Mecca and Delhi'], answer:2 },
  ],
  game: [
    { q:'In the prisoner\'s dilemma, why do both suspects often confess?', choices:['They feel guilty','Police force them','Each tries to avoid the worst personal outcome','They communicate freely'], answer:2 },
    { q:'Game theory originated as a tool for analyzing:', choices:['Wars','Elections','Parlor games like chess','Stock markets'], answer:2 },
    { q:'An equilibrium in game theory is a state where:', choices:['Every player wins equally','No player can improve by changing strategy alone','The game ends','Players always cooperate'], answer:1 },
    { q:'Which is NOT mentioned as a use of modern game theory?', choices:['AI competitive environments','Evolutionary biology','Climate negotiations','Plate tectonics'], answer:3 },
  ],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const base = { s_score:0, c_score:0, target_wpm:0, sessions:[] };
    if (!raw) return base;
    return { ...base, ...JSON.parse(raw) };
  } catch { return { s_score:0, c_score:0, target_wpm:0, sessions:[] }; }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

async function generateQuestions(passage) {
  const key = localStorage.getItem('anthropic_key') || localStorage.getItem('speedr_anthropic_key');
  if (!key) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':key,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{
          role:'user',
          content:`Generate exactly 4 multiple-choice comprehension questions about the passage below. Each question should test understanding, not trivia. Output ONLY a JSON array (no prose, no code fences) of this exact shape: [{"q":"...","choices":["a","b","c","d"],"answer":0}]. The "answer" field is the 0-based index of the correct choice.\n\nPassage:\n"""\n${passage.text}\n"""`
        }],
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text = data?.content?.[0]?.text || '';
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr) || arr.length < 1) return null;
    return arr.filter(x => x && typeof x.q === 'string' && Array.isArray(x.choices) && Number.isInteger(x.answer));
  } catch { return null; }
}

function MiniReader({ text, targetWpm, onFinish }) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(true);
  const startRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (!startRef.current) { onFinish(targetWpm); return; }
    const now = performance.now();
    const pausedMs = pausedTotalRef.current + (paused && pausedAtRef.current ? (now - pausedAtRef.current) : 0);
    const elapsedMs = Math.max(1, now - startRef.current - pausedMs);
    const actual = Math.round(words.length / (elapsedMs / 60000));
    onFinish(actual);
  }, [paused, words.length, onFinish, targetWpm]);

  useEffect(() => {
    if (idx >= words.length) { finish(); return; }
    if (paused || !started) return;
    const t = setTimeout(() => setIdx(i => i + 1), Math.max(20, 60000 / targetWpm));
    return () => clearTimeout(t);
  }, [idx, paused, started, targetWpm, words.length, finish]);

  useEffect(() => {
    if (!started) return;
    if (paused) pausedAtRef.current = performance.now();
    else if (pausedAtRef.current) {
      pausedTotalRef.current += performance.now() - pausedAtRef.current;
      pausedAtRef.current = 0;
    }
  }, [paused, started]);

  const begin = () => {
    if (!started) { setStarted(true); startRef.current = performance.now(); }
    setPaused(false);
  };

  const w = words[Math.min(idx, words.length - 1)] || '';
  const orpIdx = Math.min(Math.max(1, Math.floor(w.length / 3)), Math.max(0, w.length - 1));
  const pre = w.slice(0, orpIdx);
  const orp = w[orpIdx] || '';
  const post = w.slice(orpIdx + 1);
  const progress = Math.min(100, (idx / words.length) * 100);

  return (
    <div style={{...card, padding:'24px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:18}}>
      <div style={{width:'100%', height:3, background:'#1a1a1a', borderRadius:2, overflow:'hidden'}}>
        <div style={{width:progress+'%', height:'100%', background:'#7c6af7', transition:'width 0.1s linear'}}/>
      </div>
      <div style={{minHeight:88, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'JetBrains Mono',monospace", fontSize:'clamp(28px,7vw,44px)', fontWeight:500, letterSpacing:0.2, color:'#e8e8e8'}}>
        <span>{pre}</span><span style={{color:'#e05252'}}>{orp}</span><span>{post}</span>
      </div>
      <div style={{display:'flex', gap:10}}>
        <button onClick={paused ? begin : ()=>setPaused(true)} style={btnGhost}>{!started ? 'Start Reading' : (paused ? 'Resume' : 'Pause')}</button>
        <button onClick={finish} style={btnPrimary}>Done</button>
      </div>
      <div style={{fontSize:11, color:'#3a3a3a', letterSpacing:1}}>{Math.round(targetWpm)} WPM TARGET</div>
    </div>
  );
}

function ScoreBar({ label, value, max, suffix }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{padding:'14px 16px', borderBottom:'1px solid #0f0f0f'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
        <div style={{fontSize:13, color:'#c0c0c0', fontWeight:400}}>{label}</div>
        <div style={{fontSize:13, color:'#e8e8e8', fontFamily:"'JetBrains Mono',monospace"}}>{value || 0}{suffix}</div>
      </div>
      <div style={{height:6, background:'#0a0a0a', borderRadius:3, overflow:'hidden'}}>
        <div style={{width:pct+'%', height:'100%', background:'linear-gradient(90deg,#7c6af7,#a78bfa)', transition:'width 0.4s ease'}}/>
      </div>
    </div>
  );
}

export default function TrainTab({ readerWpm }) {
  const [state, setState] = useState(loadState);
  const [phase, setPhase] = useState('home');
  const [passage, setPassage] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [actualWpm, setActualWpm] = useState(0);
  const [comp, setComp] = useState(0);
  const [loadingQ, setLoadingQ] = useState(false);
  const [lastTarget, setLastTarget] = useState(0);
  const [nextTarget, setNextTarget] = useState(0);
  const [sessionWpm, setSessionWpm] = useState(BASELINE_WPM);

  const hasBaseline = !!(state.sessions && state.sessions.length > 0);
  const targetWpm = hasBaseline ? (state.target_wpm || BASELINE_WPM) : BASELINE_WPM;

  const start = async () => {
    const p = PASSAGES[Math.floor(Math.random() * PASSAGES.length)];
    setPassage(p);
    setSessionWpm(targetWpm);
    setLoadingQ(true);
    setPhase('reading');
    const qs = await generateQuestions(p);
    const final = (qs && qs.length >= 3) ? qs : BAKED[p.id];
    setQuestions(final);
    setAnswers(new Array(final.length).fill(-1));
    setLoadingQ(false);
  };

  const onReaderFinish = useCallback((wpm) => {
    setActualWpm(wpm);
    setPhase('questions');
  }, []);

  const submit = () => {
    const correct = answers.reduce((acc, a, i) => acc + (a === questions[i].answer ? 1 : 0), 0);
    const c = Math.round((correct / questions.length) * 100);
    setComp(c);
    const usedWpm = sessionWpm;
    const newSession = { wpm: actualWpm, comp: c, target: usedWpm, ts: Date.now() };
    const sessions = [...(state.sessions || []), newSession];
    const last5 = sessions.slice(-5);
    const s_score = Math.round(last5.reduce((s,x) => s + (x.wpm||0), 0) / last5.length);
    const c_score = Math.round(last5.reduce((s,x) => s + (x.comp||0), 0) / last5.length);
    const newTarget = c >= 70 ? Math.round(usedWpm * 1.05) : usedWpm;
    setLastTarget(usedWpm);
    setNextTarget(newTarget);
    const next = { s_score, c_score, target_wpm: newTarget, sessions };
    setState(next);
    saveState(next);
    setPhase('results');
  };

  const reset = () => { setPhase('home'); setPassage(null); setQuestions([]); setAnswers([]); setActualWpm(0); setComp(0); };

  const allAnswered = answers.length > 0 && answers.every(a => a >= 0);

  return (
    <div>
      {phase === 'home' && (
        <>
          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Your Scores</div>
          <div style={{...card, marginBottom:16}}>
            <ScoreBar label="Speed" value={state.s_score} max={SPEED_MAX} suffix=" WPM"/>
            <div style={{...{padding:'14px 16px'}}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
                <div style={{fontSize:13, color:'#c0c0c0', fontWeight:400}}>Comprehension</div>
                <div style={{fontSize:13, color:'#e8e8e8', fontFamily:"'JetBrains Mono',monospace"}}>{state.c_score || 0}%</div>
              </div>
              <div style={{height:6, background:'#0a0a0a', borderRadius:3, overflow:'hidden'}}>
                <div style={{width:Math.min(100,state.c_score||0)+'%', height:'100%', background:'linear-gradient(90deg,#7c6af7,#a78bfa)', transition:'width 0.4s ease'}}/>
              </div>
            </div>
          </div>

          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Session</div>
          <div style={{...card, marginBottom:16, padding:16}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
              <div>
                <div style={{fontSize:13, color:'#c0c0c0'}}>{hasBaseline ? 'Target speed' : 'Baseline test'}</div>
                <div style={{fontSize:11, color:'#3a3a3a', marginTop:2}}>{hasBaseline ? 'Adapts as comprehension improves' : 'Starts at 250 WPM'}</div>
              </div>
              <div style={{fontSize:22, color:'#8b7fff', fontFamily:"'JetBrains Mono',monospace", fontWeight:500}}>{targetWpm} <span style={{fontSize:11,color:'#3a3a3a'}}>WPM</span></div>
            </div>
            <button onClick={start} style={{...btnPrimary, width:'100%', fontSize:15, minHeight:48}}>{hasBaseline ? 'Start Session' : 'Start Baseline Test'}</button>
          </div>

          {state.sessions && state.sessions.length > 0 && (
            <>
              <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Recent Sessions</div>
              <div style={{...card, marginBottom:16}}>
                {state.sessions.slice(-5).reverse().map((s, i) => (
                  <div key={i} style={{padding:'12px 16px', borderBottom: i < Math.min(4, state.sessions.length-1) ? '1px solid #0f0f0f' : 'none', display:'flex', justifyContent:'space-between', fontSize:13}}>
                    <div style={{color:'#c0c0c0'}}>{new Date(s.ts).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</div>
                    <div style={{color:'#e8e8e8', fontFamily:"'JetBrains Mono',monospace"}}>{s.wpm} WPM · {s.comp}%</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {phase === 'reading' && passage && (
        <>
          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>{passage.title}</div>
          <div style={{...card, padding:16, marginBottom:12}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
              <div style={{fontSize:13, color:'#c0c0c0'}}>Speed</div>
              <div style={{fontSize:14, color:'#8b7fff', fontFamily:"'JetBrains Mono',monospace"}}>{sessionWpm} WPM</div>
            </div>
            <input type="range" min={100} max={600} step={10} value={sessionWpm} onChange={e=>setSessionWpm(+e.target.value)} style={{width:'100%', accentColor:'#7c6af7'}}/>
          </div>
          <MiniReader key={passage.id} text={passage.text} targetWpm={sessionWpm} onFinish={onReaderFinish}/>
        </>
      )}

      {phase === 'questions' && (
        <>
          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Comprehension Check</div>
          {loadingQ && (
            <div style={{...card, padding:16, marginBottom:12, color:'#c0c0c0', fontSize:13}}>Generating questions…</div>
          )}
          {!loadingQ && questions.map((q, qi) => (
            <div key={qi} style={{...card, padding:16, marginBottom:12}}>
              <div style={{fontSize:14, color:'#e8e8e8', marginBottom:12, lineHeight:1.5}}>{qi+1}. {q.q}</div>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {q.choices.map((c, ci) => {
                  const sel = answers[qi] === ci;
                  return (
                    <button key={ci} onClick={()=>{ const a=[...answers]; a[qi]=ci; setAnswers(a); }}
                      style={{textAlign:'left', padding:'12px 14px', borderRadius:10, border:'1px solid '+(sel?'#7c6af7':'#1a1a1a'), background: sel?'rgba(124,106,247,0.12)':'transparent', color: sel?'#fff':'#c0c0c0', fontSize:13, fontWeight:300, cursor:'pointer', minHeight:44}}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!loadingQ && questions.length > 0 && (
            <button onClick={submit} disabled={!allAnswered}
              style={{...btnPrimary, width:'100%', fontSize:15, minHeight:48, opacity: allAnswered?1:0.45, marginTop:4}}>
              Submit Answers
            </button>
          )}
        </>
      )}

      {phase === 'results' && (
        <>
          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Results</div>
          <div style={{...card, padding:20, marginBottom:16, textAlign:'center'}}>
            <div style={{display:'flex', justifyContent:'space-around', marginBottom:18}}>
              <div>
                <div style={{fontSize:11, color:'#3a3a3a', letterSpacing:1, marginBottom:6}}>SPEED</div>
                <div style={{fontSize:32, fontFamily:"'JetBrains Mono',monospace", color:'#8b7fff', fontWeight:500}}>{actualWpm}</div>
                <div style={{fontSize:11, color:'#3a3a3a'}}>WPM</div>
              </div>
              <div>
                <div style={{fontSize:11, color:'#3a3a3a', letterSpacing:1, marginBottom:6}}>COMPREHENSION</div>
                <div style={{fontSize:32, fontFamily:"'JetBrains Mono',monospace", color:'#8b7fff', fontWeight:500}}>{comp}%</div>
                <div style={{fontSize:11, color:'#3a3a3a'}}>{comp >= 70 ? 'great' : 'keep going'}</div>
              </div>
            </div>
            <div style={{padding:'12px 14px', background:'#0a0a0a', borderRadius:10, fontSize:12, color:'#c0c0c0'}}>
              {nextTarget > lastTarget
                ? <>Comprehension ≥ 70%. Target speed: <span style={{color:'#8b7fff'}}>{lastTarget} → {nextTarget} WPM</span> (+5%)</>
                : <>Target speed stays at <span style={{color:'#8b7fff'}}>{lastTarget} WPM</span>. Aim for ≥ 70% to level up.</>}
            </div>
          </div>

          <div style={{...card, marginBottom:16}}>
            <ScoreBar label="Speed (avg)" value={state.s_score} max={SPEED_MAX} suffix=" WPM"/>
            <div style={{padding:'14px 16px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
                <div style={{fontSize:13, color:'#c0c0c0'}}>Comprehension (avg)</div>
                <div style={{fontSize:13, color:'#e8e8e8', fontFamily:"'JetBrains Mono',monospace"}}>{state.c_score || 0}%</div>
              </div>
              <div style={{height:6, background:'#0a0a0a', borderRadius:3, overflow:'hidden'}}>
                <div style={{width:Math.min(100,state.c_score||0)+'%', height:'100%', background:'linear-gradient(90deg,#7c6af7,#a78bfa)'}}/>
              </div>
            </div>
          </div>

          <div style={{display:'flex', gap:10}}>
            <button onClick={reset} style={{...btnGhost, flex:1}}>Done</button>
            <button onClick={start} style={{...btnPrimary, flex:1}}>Train Again</button>
          </div>
        </>
      )}
    </div>
  );
}

const card = { background:'#111111', borderRadius:16, border:'1px solid #1a1a1a', overflow:'hidden', marginBottom:12 };
const btnPrimary = { padding:'12px 18px', border:'none', borderRadius:12, fontSize:14, fontWeight:400, cursor:'pointer', background:'#7c6af7', color:'#fff', whiteSpace:'nowrap', flexShrink:0, minHeight:44 };
const btnGhost = { padding:'12px 16px', border:'1px solid #1a1a1a', borderRadius:12, fontSize:14, fontWeight:300, cursor:'pointer', background:'transparent', color:'#c0c0c0', whiteSpace:'nowrap', minHeight:44 };
