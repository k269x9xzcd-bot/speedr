import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'speedr_train';
const TRACK_KEY = 'speedr_train_track';
const MODEL = 'claude-haiku-4-5-20251001';
const SPEED_MAX = 600;
const BASELINE_WPM = 250;

const SUPABASE_URL  = 'https://reojrvyczjrdaobgnrod.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlb2pydnljempyZGFvYmducm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzAyODQsImV4cCI6MjA5NDAwNjI4NH0.RziEy75n6MS6SNl_nUqLOVRSG19TNEta9AvzrT0BB14';

const SEEN_KEY = 'speedr_seen_passages';
const SEEN_WIKI_MAX = 50;

function getSeenPassages() {
  try { const a = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}

function addSeenPassage(id) {
  if (!id) return;
  try {
    const seen = getSeenPassages();
    if (seen.includes(id)) return;
    seen.push(id);
    // Keep the last 50 Wikipedia entries but only the last 2 BAKED entries
    const wiki = seen.filter(s => !s.startsWith('baked:'));
    const baked = seen.filter(s => s.startsWith('baked:'));
    localStorage.setItem(SEEN_KEY, JSON.stringify([
      ...wiki.slice(-SEEN_WIKI_MAX),
      ...baked.slice(-2),
    ]));
  } catch {}
}

function randomFallback() {
  const bakedSeen = getSeenPassages().filter(s => s.startsWith('baked:'));
  const unseen = FALLBACK_PASSAGES.filter(p => !bakedSeen.includes('baked:' + p.id));
  const pool = unseen.length ? unseen : FALLBACK_PASSAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

const TRACKS = ['All', 'Science', 'History', 'Philosophy', 'Business'];
const TRACK_TOPICS = {
  Science:    ['Photosynthesis','Quantum_mechanics','DNA','Black_hole','Evolution','Vaccine','Climate_change','Neuroscience'],
  History:    ['Silk_Road','Roman_Empire','Industrial_Revolution','World_War_II','Renaissance','Mongol_Empire','Cold_War','French_Revolution'],
  Philosophy: ['Stoicism','Utilitarianism','Epistemology','Existentialism','Game_theory','Logic','Ethics','Consciousness'],
  Business:   ['Supply_chain','Compound_interest','Inflation','Stock_market','Entrepreneurship','Behavioral_economics','Network_effect','Venture_capital'],
};
function topicsForTrack(track) {
  if (track && TRACK_TOPICS[track]) return TRACK_TOPICS[track];
  return [...TRACK_TOPICS.Science, ...TRACK_TOPICS.History, ...TRACK_TOPICS.Philosophy, ...TRACK_TOPICS.Business];
}

const FALLBACK_PASSAGES = [
  { id:'ocean', title:'Ocean Currents', track:'Science', text:
    "Ocean currents are massive flows of seawater that move continuously through the world's oceans, shaping climate and supporting life. They are driven by a mix of wind, temperature, salinity, and the rotation of the Earth. Surface currents, like the Gulf Stream, are mostly powered by wind and carry warm water from the equator toward the poles. Deep currents move slowly along the seafloor, pushed by differences in water density: cold, salty water sinks while warmer water rises. Together these flows form a global conveyor belt that takes nearly a thousand years to complete one full cycle. Currents transport heat, nutrients, and oxygen, making them essential to weather patterns and marine ecosystems. They also influence storm intensity and the timing of seasons in coastal regions. Disruptions caused by warming temperatures and melting ice can weaken these flows, potentially shifting weather across entire continents. Scientists track currents using satellites, buoys, and submarines, watching for signs that the planet's vast circulatory system may be slowing down faster than expected."
  },
  { id:'silk', title:'The Silk Road', track:'History', text:
    "The Silk Road was not a single road but a vast network of trade routes that stretched across Asia, Europe, and Africa for more than fifteen hundred years. It linked dynasties in China to merchants in Persia, traders in Arabia, and markets in Venice, allowing goods, ideas, and even diseases to travel staggering distances. Silk, which gave the route its name, was prized in Rome and treated almost like currency, though spices, paper, jade, glass, and porcelain were equally important. Travelers crossed deserts, mountains, and bandit-controlled valleys, often joining caravans for protection during journeys that could last years. Cities like Samarkand and Kashgar grew rich as crossroads of language, religion, and cuisine. The Silk Road carried Buddhism into China, gunpowder toward Europe, and the bubonic plague into the medieval world. As ocean trade grew in the fifteenth century, the overland routes declined, but their cultural legacy remained. Many ideas we now take for granted, including printing, papermaking, and astronomy, spread along these dusty paths long before modern globalization began."
  },
  { id:'game', title:'Game Theory', track:'Philosophy', text:
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

function trimToSentences(text, maxWords = 220) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  let slice = words.slice(0, maxWords).join(' ');
  const lastEnd = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
  if (lastEnd > 40) slice = slice.slice(0, lastEnd + 1);
  return slice.trim();
}

async function fetchWikipediaPassage(track, maxTries = 10) {
  const seenSet = new Set(getSeenPassages());
  const pool = [...topicsForTrack(track)].sort(() => Math.random() - 0.5);
  for (const topic of pool.slice(0, maxTries)) {
    if (seenSet.has('wiki:' + topic.replace(/_/g, ' '))) continue;
    try {
      const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(topic), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      const data = await r.json();
      const title = data.title || topic.replace(/_/g, ' ');
      if (seenSet.has('wiki:' + title)) continue;
      let text = ((data && data.extract) || '').trim();
      if (!text) continue;
      if (text.split(/\s+/).filter(Boolean).length < 100) continue;
      text = trimToSentences(text, 220);
      const words = text.split(/\s+/).filter(Boolean).length;
      if (words < 100) continue;
      addSeenPassage('wiki:' + title);
      return { id: 'wiki:' + topic, title, text, words, track: track || 'All' };
    } catch { /* try next topic */ }
  }
  return null;
}

// -- Supabase (shared anonymous identity, same pattern as App.jsx) --------------
async function getAnonToken() {
  try {
    const stored = localStorage.getItem('speedr_anon_token');
    const expiry = parseInt(localStorage.getItem('speedr_anon_expiry') || '0', 10);
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

function userIdFromToken(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part)).sub || null;
  } catch { return null; }
}

async function saveTrainingRemote(row) {
  try {
    const token = await getAnonToken();
    if (!token) return;
    const user_id = userIdFromToken(token);
    if (!user_id) return;
    await fetch(SUPABASE_URL + '/rest/v1/saved_training', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + token, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id, ...row }),
    });
  } catch { /* non-fatal */ }
}

async function loadTrainingRemote() {
  try {
    const token = await getAnonToken();
    if (!token) return [];
    const user_id = userIdFromToken(token);
    if (!user_id) return [];
    const res = await fetch(SUPABASE_URL + '/rest/v1/saved_training?select=*&user_id=eq.' + encodeURIComponent(user_id) + '&order=created_at.desc&limit=5', {
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// -- Stable client id (localStorage + long-lived cookie fallback) --------------
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function setCookie(name, value) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 10);
  document.cookie = name + '=' + value + '; expires=' + expires.toUTCString() + '; path=/; SameSite=Lax';
}

function getUserId() {
  // NOTE: uses its own key, not speedr_anon_token — that one holds a rotating Supabase JWT.
  let id = localStorage.getItem('speedr_uid') || getCookie('speedr_uid');
  if (!id) {
    id = 'anon_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
  localStorage.setItem('speedr_uid', id);
  setCookie('speedr_uid', id);
  return id;
}

// -- Train profile sync (XP / streak / scores) ---------------------------------
async function saveTrainProfile(state) {
  try {
    const userId = getUserId();
    await fetch(SUPABASE_URL + '/rest/v1/speedr_train_profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        xp_total: state.xp_total || 0,
        streak_days: state.streak_days || 0,
        last_session_date: state.last_session_date || null,
        s_score: state.s_score || 0,
        c_score: state.c_score || 0,
        target_wpm: state.target_wpm || 0,
        track: state.track || 'all',
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {}
}

async function loadTrainProfile() {
  try {
    const userId = getUserId();
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/speedr_train_profile?user_id=eq.' + encodeURIComponent(userId) + '&limit=1',
      { headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return rows && rows[0] ? rows[0] : null;
  } catch { return null; }
}

// -- XP + streaks --------------------------------------------------------------
function todayStr() { return new Date().toISOString().slice(0, 10); }
function dayDiff(from, to) {
  const a = new Date(from + 'T00:00:00Z'), b = new Date(to + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}
function computeXp(actualWpm, comp) { return Math.round((actualWpm || 0) * ((comp || 0) / 100) * 10); }
function nextStreak(prevStreak, lastDate, today) {
  if (!lastDate) return 1;
  const d = dayDiff(lastDate, today);
  if (d <= 0) return prevStreak || 1;
  if (d === 1) return (prevStreak || 0) + 1;
  return 1;
}

const BASE_STATE = {
  s_score:0, c_score:0, target_wpm:0, sessions:[],
  xp_total:0, streak_days:0, last_session_date:null,
  sessionInProgress:false, inProgress:null,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...BASE_STATE };
    return { ...BASE_STATE, ...JSON.parse(raw) };
  } catch { return { ...BASE_STATE }; }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function parseQuestions(text) {
  try {
    const m = (text || '').match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return null;
    const out = arr.filter(x => x && typeof x.q === 'string' && Array.isArray(x.choices) && x.choices.length >= 2 && Number.isInteger(x.answer));
    return out.length >= 3 ? out : null;
  } catch { return null; }
}

async function generateQuestions(passage) {
  // Preferred path: serverless proxy that keeps the Anthropic key server-side.
  try {
    const r = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: passage.text }),
    });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data && data.questions) && data.questions.length >= 3) return data.questions;
    }
  } catch { /* proxy unavailable (e.g. plain `vite dev`) — fall back to direct mode */ }

  // Fallback: direct browser call using a locally-stored key (useful for local dev).
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
    return parseQuestions(data && data.content && data.content[0] && data.content[0].text);
  } catch { return null; }
}

const doneBtn = { padding:'12px 16px', border:'1px solid #1a1a1a', borderRadius:12, fontSize:14, fontWeight:300, cursor:'pointer', background:'transparent', color:'#555', whiteSpace:'nowrap', minHeight:44 };

function MiniReader({ text, targetWpm, onFinish, onReadingChange, hashMarksOn = true, orpColor = '#e05252' }) {
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

  const isReading = started && !paused;
  useEffect(() => { if (onReadingChange) onReadingChange(isReading); }, [isReading, onReadingChange]);

  const orpRef = useRef(null);
  const containerRef = useRef(null);
  const [orpCenter, setOrpCenter] = useState(null);
  const measureOrp = useCallback(() => {
    if (orpRef.current && containerRef.current) {
      const cr = containerRef.current.getBoundingClientRect();
      const or = orpRef.current.getBoundingClientRect();
      const center = or.left + or.width / 2 - cr.left;
      if (center > 0) setOrpCenter(center);
    }
  }, []);
  useEffect(() => { measureOrp(); }); // re-measure on each word
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measureOrp());
    ro.observe(el);
    const onResize = () => measureOrp();
    window.addEventListener('resize', onResize);
    return () => { ro.disconnect(); window.removeEventListener('resize', onResize); };
  }, [measureOrp]);

  const w = words[Math.min(idx, words.length - 1)] || '';
  const stem = w.replace(/[.,!?;:]+$/, '');
  const punct = w.slice(stem.length);
  let orpIdx = stem ? Math.max(0, Math.min(Math.floor(stem.length * 0.35), stem.length - 1)) : 0;
  while (orpIdx < stem.length - 1 && /\s/.test(stem[orpIdx])) orpIdx++;
  const pre = stem.slice(0, orpIdx);
  const orp = stem[orpIdx] || w[0] || '';
  const post = stem.slice(orpIdx + 1) + punct;
  const progress = Math.min(100, (idx / words.length) * 100);

  return (
    <div style={{...card, padding:'24px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:18}}>
      <div style={{width:'100%', height:3, background:'#1a1a1a', borderRadius:2, overflow:'hidden'}}>
        <div style={{width:progress+'%', height:'100%', background:'#7c6af7', transition:'width 0.1s linear'}}/>
      </div>
      <div ref={containerRef} style={{position:'relative', width:'100%', minHeight:88, display:'flex', alignItems:'center', fontFamily:mono, fontSize:'clamp(28px,7vw,44px)', fontWeight:500, letterSpacing:0.2, color:'#e8e8e8', whiteSpace:'nowrap'}}>
        {hashMarksOn && orpCenter !== null && (
          <>
            <div style={{position:'absolute', left:orpCenter, top:0, height:'calc(50% - 20px)', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', gap:3, pointerEvents:'none', zIndex:1}}>
              <div style={{width:2, height:7, borderRadius:1, background:orpColor, opacity:0.35}}/>
              <div style={{width:2, height:14, borderRadius:1, background:orpColor, opacity:0.75}}/>
            </div>
            <div style={{position:'absolute', left:orpCenter, bottom:0, height:'calc(50% - 20px)', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', gap:3, pointerEvents:'none', zIndex:1}}>
              <div style={{width:2, height:14, borderRadius:1, background:orpColor, opacity:0.75}}/>
              <div style={{width:2, height:7, borderRadius:1, background:orpColor, opacity:0.35}}/>
            </div>
          </>
        )}
        <span style={{flex:'0 0 35%', textAlign:'right', paddingRight:1}}>{pre}</span>
        <span ref={orpRef} style={{flex:'0 0 auto', color:orpColor, fontWeight:600}}>{orp}</span>
        <span style={{flex:'0 0 65%', textAlign:'left', paddingLeft:1}}>{post}</span>
      </div>
      <div style={{display:'flex', gap:10, opacity: isReading ? 0.12 : 1, transition:'opacity 0.3s ease'}}>
        <button onClick={()=>{ if (window.confirm('Are you sure? Your progress will be lost.')) finish(); }} style={doneBtn}>Done</button>
        <button onClick={paused ? begin : ()=>setPaused(true)} style={btnGhost}>{!started ? 'Start Reading' : (paused ? 'Resume' : 'Pause')}</button>
      </div>
      <div style={{fontSize:11, color:'#3a3a3a', letterSpacing:1, opacity: isReading ? 0 : 1, transition:'opacity 0.3s ease'}}>{Math.round(targetWpm)} WPM TARGET</div>
    </div>
  );
}

function ScoreBar({ label, value, max, suffix }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{padding:'14px 16px', borderBottom:'1px solid #0f0f0f'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
        <div style={{fontSize:13, color:'#c0c0c0', fontWeight:400}}>{label}</div>
        <div style={{fontSize:13, color:'#e8e8e8', fontFamily:mono}}>{value || 0}{suffix}</div>
      </div>
      <div style={{height:6, background:'#0a0a0a', borderRadius:3, overflow:'hidden'}}>
        <div style={{width:pct+'%', height:'100%', background:'linear-gradient(90deg,#7c6af7,#a78bfa)', transition:'width 0.4s ease'}}/>
      </div>
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div style={{...card, flex:1, marginBottom:0, padding:'14px 12px', textAlign:'center'}}>
      <div style={{fontSize:22, fontFamily:mono, color:'#8b7fff', fontWeight:500}}>{value}</div>
      <div style={{fontSize:10, color:'#3a3a3a', letterSpacing:1, marginTop:2}}>{label}</div>
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
  const [xpEarned, setXpEarned] = useState(0);
  const [lastTarget, setLastTarget] = useState(0);
  const [nextTarget, setNextTarget] = useState(0);
  const [sessionWpm, setSessionWpm] = useState(BASELINE_WPM);
  const [track, setTrack] = useState(() => { try { return localStorage.getItem(TRACK_KEY) || 'All'; } catch { return 'All'; } });
  const [remoteSessions, setRemoteSessions] = useState([]);
  const [reading, setReading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Fetching passage...');

  const hasBaseline = !!(state.sessions && state.sessions.length > 0);
  const targetWpm = hasBaseline ? (state.target_wpm || BASELINE_WPM) : BASELINE_WPM;

  useEffect(() => { if (phase === 'home') loadTrainingRemote().then(setRemoteSessions); }, [phase]);

  // On a fresh device (no local progress) try to restore the profile from Supabase
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      loadTrainProfile().then(profile => {
        if (profile) {
          const restored = {
            ...BASE_STATE,
            xp_total: profile.xp_total || 0,
            streak_days: profile.streak_days || 0,
            last_session_date: profile.last_session_date || null,
            s_score: profile.s_score || 0,
            c_score: profile.c_score || 0,
            target_wpm: profile.target_wpm || 0,
            track: profile.track || 'all',
          };
          setState(restored);
          saveState(restored);
        }
      });
    }
  }, []);

  const changeTrack = (t) => { setTrack(t); try { localStorage.setItem(TRACK_KEY, t); } catch {} };

  const patchInProgress = useCallback((patch) => {
    setState(prev => {
      const next = { ...prev, sessionInProgress: true, inProgress: { ...(prev.inProgress || {}), ...patch } };
      saveState(next);
      return next;
    });
  }, []);

  const clearInProgress = useCallback(() => {
    setState(prev => {
      const next = { ...prev, sessionInProgress: false, inProgress: null };
      saveState(next);
      return next;
    });
  }, []);

  const start = async () => {
    setPhase('loading');
    setLoadingMsg('Fetching passage...');
    setActualWpm(0);
    setComp(0);
    setXpEarned(0);
    setQuestions([]);
    setAnswers([]);
    setSessionWpm(targetWpm);

    // Try Wikipedia with a 5s timeout — failure means we're offline / blocked
    let p = null, offline = false;
    try {
      p = await Promise.race([
        fetchWikipediaPassage(track),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]);
    } catch { offline = true; }

    let final = null;
    if (p) { try { final = await generateQuestions(p); } catch {} }

    if (!final || final.length < 3) {
      const bakedSeen = getSeenPassages().filter(s => s.startsWith('baked:'));
      const unseenBaked = FALLBACK_PASSAGES.filter(pb => !bakedSeen.includes('baked:' + pb.id));
      if (offline && unseenBaked.length === 0) { setPhase('nopassage'); return; }
      p = randomFallback();
      final = BAKED[p.id];
      if (offline) setLoadingMsg('offline — using cached passage');
    }

    const blank = new Array(final.length).fill(-1);
    if (p && p.id && p.id.startsWith('wiki:')) addSeenPassage('wiki:' + p.title);
    else if (p) addSeenPassage('baked:' + p.id);
    setPassage(p);
    setQuestions(final);
    setAnswers(blank);
    setPhase('reading');
    patchInProgress({ phase:'reading', passage:p, sessionWpm:targetWpm, actualWpm:0, questions:final, answers:blank });
  };

  const skipArticle = () => {
    if (passage) {
      if (passage.id && passage.id.startsWith('wiki:')) addSeenPassage('wiki:' + passage.title);
      else addSeenPassage('baked:' + passage.id);
    }
    start();
  };

  const resumeSession = () => {
    const ip = state.inProgress;
    if (!ip) return;
    const p = ip.passage || (ip.passageId && FALLBACK_PASSAGES.find(x => x.id === ip.passageId)) || randomFallback();
    const qs = (ip.questions && ip.questions.length) ? ip.questions : (BAKED[p.id] || null);
    if (!qs) { start(); return; }
    setPassage(p);
    setSessionWpm(ip.sessionWpm || targetWpm);
    setActualWpm(ip.actualWpm || 0);
    setComp(0);
    setXpEarned(0);
    setQuestions(qs);
    setAnswers(Array.isArray(ip.answers) && ip.answers.length === qs.length ? ip.answers : new Array(qs.length).fill(-1));
    setPhase(ip.phase === 'questions' ? 'questions' : 'reading');
  };

  const onReaderFinish = useCallback((wpm) => {
    setReading(false);
    setActualWpm(wpm);
    setPhase('questions');
    patchInProgress({ phase:'questions', actualWpm:wpm });
  }, [patchInProgress]);

  const setAnswer = (qi, val) => {
    const a = [...answers];
    a[qi] = val;
    setAnswers(a);
    patchInProgress({ answers: a });
  };

  const submit = () => {
    const correct = answers.reduce((acc, a, i) => acc + (a === questions[i].answer ? 1 : 0), 0);
    const c = Math.round((correct / questions.length) * 100);
    const usedWpm = sessionWpm;
    const xp = computeXp(actualWpm, c);
    setComp(c);
    setXpEarned(xp);
    const newSession = { wpm: actualWpm, comp: c, target: usedWpm, ts: Date.now() };
    const sessions = [...(state.sessions || []), newSession];
    const last5 = sessions.slice(-5);
    const s_score = Math.round(last5.reduce((s,x) => s + (x.wpm||0), 0) / last5.length);
    const c_score = Math.round(last5.reduce((s,x) => s + (x.comp||0), 0) / last5.length);
    const newTarget = c >= 70 ? Math.round(usedWpm * 1.05) : usedWpm;
    setLastTarget(usedWpm);
    setNextTarget(newTarget);
    const today = todayStr();
    const streak_days = nextStreak(state.streak_days, state.last_session_date, today);
    const xp_total = (state.xp_total || 0) + xp;
    const next = {
      ...state, s_score, c_score, target_wpm: newTarget, sessions,
      xp_total, streak_days, last_session_date: today,
      sessionInProgress:false, inProgress:null,
    };
    setState(next);
    saveState(next);
    saveTrainProfile(next);
    saveTrainingRemote({
      passage_title: (passage && passage.title) || 'Untitled',
      passage_track: (passage && passage.track) || track,
      target_wpm: usedWpm,
      actual_wpm: actualWpm,
      comprehension: c,
      xp_earned: xp,
    });
    setPhase('results');
  };

  const reset = () => { clearInProgress(); setReading(false); setPhase('home'); setPassage(null); setQuestions([]); setAnswers([]); setActualWpm(0); setComp(0); setXpEarned(0); };

  const allAnswered = answers.length > 0 && answers.every(a => a !== -1);

  const recent = remoteSessions.length
    ? remoteSessions.map(r => ({
        title: r.passage_title || 'Untitled', sub: (r.passage_track || 'All'),
        wpm: r.actual_wpm || 0, comp: r.comprehension || 0, xp: r.xp_earned || 0,
        date: r.created_at ? new Date(r.created_at).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : '',
      }))
    : (state.sessions || []).slice(-5).reverse().map(s => ({
        title: 'Training session', sub: '—',
        wpm: s.wpm || 0, comp: s.comp || 0, xp: computeXp(s.wpm, s.comp),
        date: s.ts ? new Date(s.ts).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : '',
      }));

  return (
    <div>
      <style>{`@keyframes xpPop{0%{transform:scale(0.4);opacity:0}55%{transform:scale(1.18);opacity:1}100%{transform:scale(1);opacity:1}}`}</style>

      {phase === 'home' && (
        <>
          <div style={{display:'flex', gap:12, marginBottom:16}}>
            <StatCard value={(state.xp_total || 0).toLocaleString()} label="TOTAL XP"/>
            <StatCard value={state.streak_days || 0} label="DAY STREAK"/>
          </div>

          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Your Scores</div>
          <div style={{...card, marginBottom:16}}>
            <ScoreBar label="Speed" value={state.s_score} max={SPEED_MAX} suffix=" WPM"/>
            <div style={{padding:'14px 16px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
                <div style={{fontSize:13, color:'#c0c0c0', fontWeight:400}}>Comprehension</div>
                <div style={{fontSize:13, color:'#e8e8e8', fontFamily:mono}}>{state.c_score || 0}%</div>
              </div>
              <div style={{height:6, background:'#0a0a0a', borderRadius:3, overflow:'hidden'}}>
                <div style={{width:Math.min(100,state.c_score||0)+'%', height:'100%', background:'linear-gradient(90deg,#7c6af7,#a78bfa)', transition:'width 0.4s ease'}}/>
              </div>
            </div>
          </div>

          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Track</div>
          <div style={{...card, marginBottom:16, padding:12, display:'flex', gap:6, flexWrap:'wrap'}}>
            {TRACKS.map(t => (
              <button key={t} onClick={()=>changeTrack(t)}
                style={{flex:'1 1 60px', padding:'8px 8px', borderRadius:8, border:'1px solid '+(track===t?'#7c6af7':'#222'), background: track===t?'#7c6af7':'transparent', color: track===t?'#fff':'#c0c0c0', fontSize:12, fontWeight:400, cursor:'pointer', minHeight:36}}>
                {t}
              </button>
            ))}
          </div>

          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Session</div>
          <div style={{...card, marginBottom:16, padding:16}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
              <div>
                <div style={{fontSize:13, color:'#c0c0c0'}}>{state.sessionInProgress ? 'Session in progress' : (hasBaseline ? 'Target speed' : 'Baseline test')}</div>
                <div style={{fontSize:11, color:'#3a3a3a', marginTop:2}}>{state.sessionInProgress ? 'Pick up where you left off' : (hasBaseline ? `${track} · adapts as comprehension improves` : 'Starts at 250 WPM')}</div>
              </div>
              <div style={{fontSize:22, color:'#8b7fff', fontFamily:mono, fontWeight:500}}>{(state.sessionInProgress && state.inProgress?.sessionWpm) || targetWpm} <span style={{fontSize:11,color:'#3a3a3a'}}>WPM</span></div>
            </div>
            {state.sessionInProgress && state.inProgress ? (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                <button onClick={resumeSession} style={{...btnPrimary, width:'100%', fontSize:15, minHeight:48}}>Resume Session</button>
                <button onClick={()=>{ if (window.confirm('Discard the in-progress session and start over?')) start(); }} style={{...btnGhost, width:'100%'}}>Start New Session</button>
              </div>
            ) : (
              <button onClick={start} style={{...btnPrimary, width:'100%', fontSize:15, minHeight:48}}>{hasBaseline ? 'Start Session' : 'Start Baseline Test'}</button>
            )}
          </div>

          {recent.length > 0 && (
            <>
              <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Recent sessions</div>
              <div style={{...card, marginBottom:16}}>
                {recent.map((s, i) => (
                  <div key={i} style={{padding:'12px 16px', borderBottom: i < recent.length-1 ? '1px solid #0f0f0f' : 'none', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, fontSize:13}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{color:'#d8d8d8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.title}</div>
                      <div style={{color:'#3a3a3a', fontSize:11, marginTop:2}}>{s.sub}{s.date ? ` · ${s.date}` : ''}</div>
                    </div>
                    <div style={{textAlign:'right', flexShrink:0, fontFamily:mono, fontSize:12, lineHeight:1.5}}>
                      <div style={{color:'#e8e8e8'}}>{s.wpm} WPM</div>
                      <div style={{color:'#8b7fff'}}>{s.comp}% · +{s.xp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {phase === 'loading' && (
        <>
          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Preparing</div>
          <div style={{...card, padding:'40px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:14}}>
            <div style={{fontFamily:mono, fontSize:13, color:'#8b7fff', letterSpacing:1, animation:'pulse 1.2s ease-in-out infinite'}}>{loadingMsg.toUpperCase()}</div>
            <div style={{fontSize:12, color:'#3a3a3a'}}>{track === 'All' ? 'Pulling a fresh article and writing questions' : `Pulling a ${track.toLowerCase()} article and writing questions`}</div>
          </div>
        </>
      )}

      {phase === 'nopassage' && (
        <>
          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Offline</div>
          <div style={{...card, padding:'32px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:16, textAlign:'center'}}>
            <div style={{fontSize:32}}>📡</div>
            <div style={{fontSize:15, color:'#e0e0e0', fontWeight:400}}>No signal</div>
            <div style={{fontSize:13, color:'#555', lineHeight:1.6}}>All cached passages have been used. Connect to the internet to load new articles.</div>
            <button onClick={start} style={{...btnPrimary, width:'100%'}}>Retry</button>
            <button onClick={reset} style={{...btnGhost, width:'100%'}}>Back</button>
          </div>
        </>
      )}

      {phase === 'reading' && passage && (
        <>
          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px', opacity: reading ? 0 : 1, pointerEvents: reading ? 'none' : 'auto', transition:'opacity 0.3s ease'}}>{passage.title}{passage.words ? ` · ${passage.words} words` : ''}</div>
          <div style={{...card, padding:16, marginBottom:12, opacity: reading ? 0 : 1, pointerEvents: reading ? 'none' : 'auto', transition:'opacity 0.3s ease'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
              <div style={{fontSize:13, color:'#c0c0c0'}}>Speed</div>
              <div style={{fontSize:14, color:'#8b7fff', fontFamily:mono}}>{sessionWpm} WPM</div>
            </div>
            <input type="range" min={100} max={600} step={10} value={sessionWpm} onChange={e=>setSessionWpm(+e.target.value)} style={{width:'100%', accentColor:'#7c6af7'}}/>
          </div>
          <MiniReader key={passage.id} text={passage.text} targetWpm={sessionWpm} onFinish={onReaderFinish} onReadingChange={setReading} hashMarksOn={true} orpColor="#e05252"/>
          <button onClick={skipArticle} style={{...doneBtn, width:'100%', marginTop:12, opacity: reading ? 0 : 1, pointerEvents: reading ? 'none' : 'auto', transition:'opacity 0.3s ease'}}>New Article</button>
        </>
      )}

      {phase === 'questions' && (
        <>
          <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Comprehension Check</div>
          {questions.map((q, qi) => (
            <div key={qi} style={{...card, padding:16, marginBottom:12}}>
              <div style={{fontSize:14, color:'#e8e8e8', marginBottom:12, lineHeight:1.5}}>{qi+1}. {q.q}</div>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {q.choices.map((c, ci) => {
                  const sel = answers[qi] === ci;
                  return (
                    <button key={ci} onClick={()=>setAnswer(qi, ci)}
                      style={{textAlign:'left', padding:'12px 14px', borderRadius:10, border:'1px solid '+(sel?'#7c6af7':'#1a1a1a'), background: sel?'rgba(124,106,247,0.12)':'transparent', color: sel?'#fff':'#c0c0c0', fontSize:13, fontWeight:300, cursor:'pointer', minHeight:44}}>
                      {c}
                    </button>
                  );
                })}
              </div>
              <button onClick={()=>setAnswer(qi, -2)}
                style={{marginTop:10, background:'transparent', border:'none', color: answers[qi]===-2?'#8b7fff':'#555', fontSize:12, fontWeight:300, cursor:'pointer', padding:'4px 2px', textDecoration: answers[qi]===-2?'none':'underline'}}>
                {answers[qi]===-2 ? 'Skipped — counts as wrong' : "Skip / Don't know"}
              </button>
            </div>
          ))}
          {questions.length > 0 && (
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
            <div style={{display:'flex', justifyContent:'center', marginBottom:18}}>
              <div style={{animation:'xpPop 0.55s cubic-bezier(.2,1.4,.4,1) both', fontFamily:mono, fontWeight:500, fontSize:34, color:'#8b7fff'}}>+{xpEarned.toLocaleString()} XP</div>
            </div>
            <div style={{display:'flex', justifyContent:'space-around', marginBottom:18}}>
              <div>
                <div style={{fontSize:11, color:'#3a3a3a', letterSpacing:1, marginBottom:6}}>SPEED</div>
                <div style={{fontSize:30, fontFamily:mono, color:'#e8e8e8', fontWeight:500}}>{actualWpm}</div>
                <div style={{fontSize:11, color:'#3a3a3a'}}>WPM</div>
              </div>
              <div>
                <div style={{fontSize:11, color:'#3a3a3a', letterSpacing:1, marginBottom:6}}>COMPREHENSION</div>
                <div style={{fontSize:30, fontFamily:mono, color:'#e8e8e8', fontWeight:500}}>{comp}%</div>
                <div style={{fontSize:11, color:'#3a3a3a'}}>{comp >= 70 ? 'great' : 'keep going'}</div>
              </div>
              <div>
                <div style={{fontSize:11, color:'#3a3a3a', letterSpacing:1, marginBottom:6}}>STREAK</div>
                <div style={{fontSize:30, fontFamily:mono, color:'#e8e8e8', fontWeight:500}}>{state.streak_days || 0}</div>
                <div style={{fontSize:11, color:'#3a3a3a'}}>{(state.streak_days || 0) === 1 ? 'day' : 'days'}</div>
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
                <div style={{fontSize:13, color:'#e8e8e8', fontFamily:mono}}>{state.c_score || 0}%</div>
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

const mono = "'JetBrains Mono',monospace";
const card = { background:'#111111', borderRadius:16, border:'1px solid #1a1a1a', overflow:'hidden', marginBottom:12 };
const btnPrimary = { padding:'12px 18px', border:'none', borderRadius:12, fontSize:14, fontWeight:400, cursor:'pointer', background:'#7c6af7', color:'#fff', whiteSpace:'nowrap', flexShrink:0, minHeight:44 };
const btnGhost = { padding:'12px 16px', border:'1px solid #1a1a1a', borderRadius:12, fontSize:14, fontWeight:300, cursor:'pointer', background:'transparent', color:'#c0c0c0', whiteSpace:'nowrap', minHeight:44 };
