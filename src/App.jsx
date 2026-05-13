import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import TrainTab from './TrainTab';

function decodeHtmlEntities(str) {
  if (!str) return str;
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

function feedFavicon(url) {
  try { return 'https://www.google.com/s2/favicons?domain=' + new URL(url).hostname + '&sz=64'; }
  catch { return ''; }
}

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
  { id:'flipboard-news',name:'Flipboard News',    url:'https://flipboard.com/topic/news.rss',                       category:'US' },
  { id:'flipboard-tech',name:'Flipboard Tech',    url:'https://flipboard.com/topic/tech.rss',                       category:'Tech' },
  // -- additional feeds (sourced from rumca-js/RSS-Link-Database-2025, verified) --
  { id:'abc-us',        name:'ABC News',           url:'http://feeds.abcnews.com/abcnews/topstories',                category:'US' },
  { id:'cnn-intl',      name:'CNN',                url:'http://rss.cnn.com/rss/edition.rss',                         category:'US' },
  { id:'guardian-us',   name:'The Guardian US',    url:'https://www.theguardian.com/us-news/rss',                    category:'US' },
  { id:'skynews-world', name:'Sky News World',     url:'https://feeds.skynews.com/feeds/rss/world.xml',              category:'World' },
  { id:'bbc-news',      name:'BBC News',           url:'https://feeds.bbci.co.uk/news/rss.xml',                      category:'World' },
  { id:'bbc-asia',      name:'BBC Asia',           url:'https://feeds.bbci.co.uk/news/world/asia/rss.xml',           category:'World' },
  { id:'bbc-europe',    name:'BBC Europe',         url:'https://feeds.bbci.co.uk/news/world/europe/rss.xml',         category:'World' },
  { id:'bbc-africa',    name:'BBC Africa',         url:'https://feeds.bbci.co.uk/news/world/africa/rss.xml',         category:'World' },
  { id:'bbc-me',        name:'BBC Middle East',    url:'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',    category:'World' },
  { id:'scmp',          name:'South China Morning Post', url:'https://www.scmp.com/rss/4/feed',                      category:'World' },
  { id:'batimes',       name:'Buenos Aires Times', url:'https://www.batimes.com.ar/feed',                            category:'World' },
  { id:'guardian-world',name:'The Guardian World', url:'https://www.theguardian.com/world/rss',                      category:'World' },
  { id:'thehill',       name:'The Hill',           url:'https://thehill.com/feed',                                   category:'Politics' },
  { id:'politico-eu',   name:'Politico EU',        url:'https://www.politico.eu/feed',                               category:'Politics' },
  { id:'telegraph-biz', name:'Telegraph Business', url:'https://www.telegraph.co.uk/business/rss.xml',               category:'Business' },
  { id:'wired-biz',     name:'Wired Business',     url:'https://www.wired.com/feed/category/business/latest/rss',    category:'Business' },
  { id:'science-mag',   name:'Science Magazine',   url:'https://www.science.org/rss/news_current.xml',               category:'Science' },
  { id:'sciencedaily',  name:'ScienceDaily',       url:'https://www.sciencedaily.com/rss/all.xml',                   category:'Science' },
  { id:'physorg',       name:'Phys.org',           url:'https://phys.org/rss-feed',                                  category:'Science' },
  { id:'popsci',        name:'Popular Science',    url:'https://www.popsci.com/feed',                                category:'Science' },
  { id:'sciencenews',   name:'Science News',       url:'https://www.sciencenews.org/feed',                           category:'Science' },
  { id:'smithsonian',   name:'Smithsonian',        url:'https://www.smithsonianmag.com/rss/latest_articles/',        category:'Science' },
  { id:'404media',      name:'404 Media',          url:'https://www.404media.co/rss',                                category:'Tech' },
  { id:'androidauth',   name:'Android Authority',  url:'https://www.androidauthority.com/feed',                      category:'Tech' },
  { id:'engadget',      name:'Engadget',           url:'https://www.engadget.com/rss.xml',                           category:'Tech' },
  { id:'eff',           name:'EFF Deeplinks',      url:'https://www.eff.org/rss/updates.xml',                        category:'Tech' },
  { id:'eetimes',       name:'EE Times',           url:'https://eetimes.com/feed',                                   category:'Tech' },
  { id:'hackaday',      name:'Hackaday',           url:'https://hackaday.com/feed/',                                 category:'Tech' },
  { id:'bookriot',      name:'Book Riot',          url:'https://bookriot.com/feed',                                  category:'Entertainment' },
  { id:'bookbrowse',    name:'BookBrowse',         url:'https://www.bookbrowse.com/rss/book_news.rss',               category:'Entertainment' },
  // -- Premium (mostly paywalled — RSS gives headlines/summaries; full text via the fetch chain / bookmarklet) --
  { id:'wsj',           name:'WSJ World News',     url:'https://feeds.a.dj.com/rss/RSSWorldNews.xml',                category:'Premium' },
  { id:'nyt',           name:'New York Times',     url:'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',  category:'Premium' },
  { id:'atlantic',      name:'The Atlantic',       url:'https://feeds.feedburner.com/TheAtlantic',                   category:'Premium' },
  { id:'ft',            name:'Financial Times',    url:'https://www.ft.com/rss/home',                                category:'Premium' },
  { id:'newyorker',     name:'The New Yorker',     url:'https://www.newyorker.com/feed/everything',                  category:'Premium' },
  { id:'bloomberg',     name:'Bloomberg',          url:'https://feeds.bloomberg.com/news/rss.xml',                   category:'Premium' },
  { id:'barrons',       name:"Barron's",           url:'https://www.barrons.com/rss/rssheadlines',                   category:'Premium' },
  { id:'economist',     name:'The Economist',      url:'https://www.economist.com/feeds/print-sections/all-sections.xml', category:'Premium' },
];

const CATEGORIES = ['All','Digg AI','GitHub','US','World','Politics','Business','Tech','Health','Entertainment','Science','Local','Substack','Premium','Custom'];
const SUPABASE_RSS  = 'https://reojrvyczjrdaobgnrod.supabase.co/functions/v1/rss';
const SUPABASE_URL  = 'https://reojrvyczjrdaobgnrod.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlb2pydnljempyZGFvYmducm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzAyODQsImV4cCI6MjA5NDAwNjI4NH0.RziEy75n6MS6SNl_nUqLOVRSG19TNEta9AvzrT0BB14';
const ALLORIGINS   = 'https://api.allorigins.win/get?url=';
const RSS2JSON     = 'https://api.rss2json.com/v1/api.json?rss_url=';
const DEFAULT_ENABLED = ALL_FEEDS.map(f => f.id);
const CACHE_KEY    = 'speedr_feed_cache';
const CACHE_TS_KEY = 'speedr_feed_ts';
const CACHE_TTL    = 30 * 60 * 1000;

const PINNED_ARTICLES = [
  {
    id: 'pinned_rsvp_science',
    title: 'What is RSVP Reading?',
    source: 'Speedr Guide',
    word_count: 280,
    saved_at: '2020-01-01T00:00:00.000Z',
    pinned: true,
    text: `Rapid Serial Visual Presentation, or RSVP, is a reading method that displays words one at a time in a fixed position on screen. Instead of moving your eyes across a line of text, the text comes to you. This eliminates the single biggest time cost in traditional reading: saccades.

Saccades are the rapid eye movements your eyes make as they jump from word to word across a page. Research shows that the average reader spends nearly 80% of reading time on eye movement and repositioning, not on actual comprehension. RSVP removes that overhead entirely.

The technique was first studied seriously in the 1970s and gained mainstream attention when apps like Spritz and Spreeder demonstrated that ordinary readers could comfortably read at 400 to 600 words per minute with no loss of comprehension, compared to an average silent reading speed of around 250 words per minute.

Speedr uses a refinement called ORP, or Optimal Recognition Point. Research by Spritz Technologies found that each word has a specific letter where the eye naturally wants to focus to recognize the whole word fastest. Speedr highlights that letter in red to anchor your gaze, reducing the cognitive effort of processing each word.

Variable pacing is another key feature. Speedr slows slightly at punctuation and sentence boundaries, mimicking the natural rhythm of speech. This preserves comprehension at higher speeds by giving your brain the same structural cues it gets when listening.

Start at 250 to 300 WPM and read a few articles before pushing the speed up. Most users find a comfortable ceiling around 450 to 550 WPM with good comprehension. The Train tab gives you a structured way to measure and improve both speed and comprehension over time.

Studies published in Psychological Science and Reading Research Quarterly confirm that with regular practice, RSVP readers maintain comprehension scores equivalent to traditional readers at significantly higher speeds. The key is consistency. Even ten minutes of daily practice produces measurable improvement within two weeks.`
  },
  {
    id: 'pinned_how_to_read',
    title: 'How to Use the Reader',
    source: 'Speedr Guide',
    word_count: 220,
    saved_at: '2020-01-01T00:00:00.000Z',
    pinned: true,
    text: `The Speedr reader is designed for one-handed use on your phone. Here is how everything works.

To start reading, press and hold anywhere in the large dark reading area in the middle of the screen. Words will begin flowing as long as you hold. Release to pause. This hold-to-read mechanic means you are always in control and never lose your place.

The left 20% of the reader is a rewind zone. Press and hold there to move backward through the text at your current WPM speed. A single tap steps back one word. Use this when you lose a thread and want to catch a sentence you missed.

The right 30% of the reader is a fast forward zone. Press and hold to advance quickly, or tap once to step forward one word. Use this to skim past sections you already know.

The progress bar at the bottom of the reading area shows how far through the article you are. The stats row below it shows total word count, estimated minutes remaining, and percentage complete.

The WPM slider at the bottom controls your reading speed. You can adjust it mid-article. Most people start around 280 and work up over time.

Tap Save to store the article in your Library. Tap Copy to copy the full text. Tap Link to open the original source in your browser.

When you finish an article from the News tab, a Back button appears in the top left to return you to your feed.

The Focus button in the top right starts and pauses reading as an alternative to holding.`
  },
  {
    id: 'pinned_bookmarklet',
    title: 'Using the Bookmarklet',
    source: 'Speedr Guide',
    word_count: 180,
    saved_at: '2020-01-01T00:00:00.000Z',
    pinned: true,
    text: `The bookmarklet lets you send any article from Safari directly into Speedr, including paywalled articles you are already logged into. Here is how to set it up.

Open Speedr and go to Settings. Scroll to the Bookmarklet section and tap Copy Bookmarklet Code.

Now open Safari and navigate to any webpage. Tap the Share button at the bottom of the screen, then tap Add Bookmark. Save it with a name like Read in Speedr.

Next, open your bookmarks in Safari, find the bookmark you just created, and tap Edit. Delete the URL that is there and paste the bookmarklet code you copied from Speedr. Save it.

To use it: open any article in Safari, open your bookmarks, and tap Read in Speedr. The app will open automatically and the article text will load into the reader, ready to go.

The bookmarklet is smart about extraction. It looks for the main article body first, pulling only paragraph text and skipping navigation menus, footers, ads, and sidebars. This means you get clean readable text even on complex news sites.

It works on any site where you can read the article in Safari, including publications behind paywalls where you have a subscription.`
  },
  {
    id: 'pinned_news_train',
    title: 'News & Train Tabs',
    source: 'Speedr Guide',
    word_count: 190,
    saved_at: '2020-01-01T00:00:00.000Z',
    pinned: true,
    text: `The News tab aggregates articles from over 30 RSS sources across categories including US news, world news, politics, business, tech, health, science, and local New York coverage. You can also add any Substack or RSS feed you follow.

Tap the category pills at the top to filter by topic. Each article shows the source name and how long ago it was published. Tap any article to fetch the full text and load it into the reader automatically.

To manage your sources, tap Sources in the top right. Toggle individual feeds on or off. Green means the feed is working, red means it failed on the last refresh. Tap Apply and Refresh to reload with your updated selection.

To add a custom RSS feed or Substack, scroll to the bottom of the Sources panel and paste the feed URL. Most Substack publications have a feed at their URL slash feed.

The Train tab is a structured speed reading practice environment. Each session fetches a fresh Wikipedia article in your chosen topic track and generates four comprehension questions using AI. Your target WPM adapts automatically based on your comprehension scores. Hit 70% or above and your next session speeds up by 5%.

XP is awarded based on your speed and comprehension combined. Your streak counter tracks consecutive days of practice. All sessions are saved to the cloud so your progress persists across devices.`
  },
];

const ONBOARDING_SLIDES = [
  {
    title: 'Welcome to Speedr',
    body: 'Speedr uses RSVP — Rapid Serial Visual Presentation — to help you read faster by bringing words to your eyes instead of moving your eyes across a page. Most readers see 2–3x speed improvements with no loss of comprehension.',
    emoji: '⚡',
  },
  {
    title: 'The Science',
    body: 'Traditional reading wastes 80% of your time on eye movement. RSVP eliminates that. The red letter in each word marks the Optimal Recognition Point — the spot your brain uses to identify the word fastest.',
    emoji: '🧠',
  },
  {
    title: 'Get Started',
    body: 'Hold anywhere in the reading area to read. The left edge rewinds, the right edge fast-forwards. Browse News for articles, or use the bookmarklet to read anything from Safari. The Train tab tracks your progress.',
    emoji: '📖',
  },
];

const DEFAULT_SETTINGS = {
  wpm: 280, chunkSize: 2, peripheralBefore: 0, peripheralAfter: 0,
  orpOn: true, orpColor: '#e05252', fontSize: 'medium',
  fontStyle: 'mono', variablePacing: true, showProgress: true,
  hashMarksOn: true,
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
// Merge tiny words ("a", "to", "of"...) onto the next word so they don't flash alone.
function pairShortWords(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    const stem = w.replace(/[.,!?;:]+$/, '');
    const endsPunct = /[.,!?;:]$/.test(w);
    if (next && !endsPunct && stem.length > 0 && stem.length <= 2) {
      out.push(w + ' ' + next);
      i++;
    } else {
      out.push(w);
    }
  }
  return out;
}

function tokenize(text, chunkSize) {
  if (!text) return [];
  const words = pairShortWords(text.replace(/\s+/g,' ').trim().split(' ').filter(Boolean));
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
function splitOrp(word) {
  const stem = word.replace(/[.,!?;:]+$/, '');
  const punct = word.slice(stem.length);
  if (!stem) return { pre:'', orp: word.slice(0, 1) || '', post: word.slice(1) };
  const i = nudgeOffSpace(stem, Math.min(Math.max(0, Math.floor(stem.length * 0.3)), stem.length - 1));
  return { pre: stem.slice(0, i), orp: stem[i], post: stem.slice(i + 1) + punct };
}

function OrpWord({ word, on, color }) {
  if (!on) return <span>{word}</span>;
  const { pre, orp, post } = splitOrp(word);
  return <span>{pre}<span style={{color,fontWeight:600}}>{orp}</span>{post}</span>;
}

function nudgeOffSpace(s, idx) {
  while (idx < s.length - 1 && /\s/.test(s[idx])) idx++;
  return idx;
}

function SingleWordChunk({ word, font, baseSize, orpColor, orpOn, hashMarksOn }) {
  const s = word.replace(/[.,!?;:]+$/, '');
  const punct = word.slice(s.length);
  const orpIdx = nudgeOffSpace(s, Math.max(0, Math.min(Math.floor(s.length * 0.35), s.length - 1)));
  const pre = s.slice(0, orpIdx);
  const orp = s[orpIdx] || '';
  const post = s.slice(orpIdx + 1) + punct;
  const scaledSize = s.length > 11
    ? `clamp(18px, ${Math.max(3, 7 - (s.length - 11) * 0.25)}vw, ${Math.max(22, 44 - (s.length - 11) * 2)}px)`
    : baseSize;

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

  return (
    <div ref={containerRef} style={{position:'absolute', inset:0, display:'flex', alignItems:'center', fontFamily:font, fontSize:scaledSize, fontWeight:500, letterSpacing:0.3, whiteSpace:'nowrap', userSelect:'none'}}>
      {/* Hash marks — vertical anchor reaching toward the stage edges, centered on the measured ORP letter */}
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
      {/* Word split into pre / ORP / post anchored at 35% */}
      <span style={{flex:'0 0 35%', textAlign:'right', color:'#f0f0f0', paddingRight:1}}>{pre}</span>
      <span ref={orpRef} style={{flex:'0 0 auto', color: orpOn ? orpColor : '#f0f0f0', fontWeight:600}}>{orp}</span>
      <span style={{flex:'0 0 65%', textAlign:'left', color:'#f0f0f0', paddingLeft:1}}>{post}</span>
    </div>
  );
}

function ChunkDisplay({ chunk, settings }) {
  const font = FONT_MAP[settings.fontStyle];
  const baseSize = FONT_SIZE_MAP[settings.fontSize];

  if (chunk.length === 1) {
    return <SingleWordChunk word={chunk[0]} font={font} baseSize={baseSize} orpColor={settings.orpColor} orpOn={settings.orpOn} hashMarksOn={settings.hashMarksOn}/>;
  }

  // Multi-word chunk — centered, no anchor, no hashmarks
  return (
    <div style={{fontFamily:font, fontSize:baseSize, textAlign:'center', lineHeight:1.3, letterSpacing:0.3, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35em', flexWrap:'nowrap', whiteSpace:'nowrap', color:'#f0f0f0'}}>
      {chunk.map((w,i) => <React.Fragment key={i}>{i>0&&' '}<OrpWord word={w} on={settings.orpOn} color={settings.orpColor}/></React.Fragment>)}
    </div>
  );
}

// -- FETCH UTILS ---------------------------------------------------------------
const JINA_BLOCKED = ['nypost.com','news.google.com','aljazeera.com','foxnews.com','wsj.com','nytimes.com'];
function isJinaBlocked(url) { try { return JINA_BLOCKED.some(d => new URL(url).hostname.includes(d)); } catch { return false; } }

function timeAgo(d) {
  if (!d) return '';
  const m = (Date.now() - new Date(d)) / 60000;
  if (!isFinite(m) || m < 0) return '';
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
  return decodeHtmlEntities(data.text);
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
  return decodeHtmlEntities(clean);
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
    if (el) { const paras = Array.from(el.querySelectorAll('p')).map(p=>p.textContent.trim()).filter(t=>t.length>40); if (paras.length>2) return decodeHtmlEntities(paras.join('\n\n')); }
  }
  const allParas = Array.from(doc.querySelectorAll('p')).map(p=>p.textContent.trim()).filter(t=>t.length>50);
  if (allParas.length > 2) return decodeHtmlEntities(allParas.join('\n\n'));
  throw new Error('No paragraphs');
}

const PAYWALL_PHRASES = ['subscribe to continue', 'create a free account', "you've reached your limit", 'sign in to read', 'subscribe for full access'];
function wordCount(s) { return s ? s.trim().split(/\s+/).filter(Boolean).length : 0; }
function looksTruncated(text) {
  if (!text) return true;
  if (wordCount(text) < 200) return true;
  const lower = text.toLowerCase();
  return PAYWALL_PHRASES.some(p => lower.includes(p));
}

async function fetchViaArchivePh(url) {
  const res = await fetch(ALLORIGINS + encodeURIComponent('https://archive.ph/newest/' + url), { signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => ({}));
  const html = data.contents || '';
  if (!html || html.length < 800) throw new Error('not archived');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,nav,footer,header,aside,form,iframe,.nav,.footer,.sidebar,.ad,.social').forEach(n => n.remove());
  for (const sel of ['article','[itemprop=articleBody]','.article-body','.post-content','.entry-content','.story-body','.body.markup','main','[role=main]']) {
    const el = doc.querySelector(sel);
    if (el) { const paras = Array.from(el.querySelectorAll('p')).map(p => p.textContent.trim()).filter(t => t.length > 40); if (paras.length > 2) return decodeHtmlEntities(paras.join('\n\n')); }
  }
  const allParas = Array.from(doc.querySelectorAll('p')).map(p => p.textContent.trim()).filter(t => t.length > 50);
  if (allParas.length > 2) return decodeHtmlEntities(allParas.join('\n\n'));
  throw new Error('no article text');
}

// -- Digg ("di.gg") aggregator scrape (Next.js RSC payload — fragile, best-effort) ----
function jsUnescape(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === 'n') { out += '\n'; i += 2; }
      else if (n === 't') { out += '\t'; i += 2; }
      else if (n === 'r') { out += '\r'; i += 2; }
      else if (n === 'u') { const cp = parseInt(s.slice(i + 2, i + 6), 16); out += isNaN(cp) ? n : String.fromCharCode(cp); i += 6; }
      else { out += n; i += 2; }
    } else { out += c; i++; }
  }
  return out;
}
function extractJsonArrayAfter(str, key) {
  const m = str.indexOf('"' + key + '":[');
  if (m < 0) return null;
  const start = str.indexOf('[', m);
  let depth = 0, inStr = false;
  for (let j = start; j < str.length; j++) {
    const ch = str[j];
    if (inStr) { if (ch === '\\') { j++; } else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return str.slice(start, j + 1); }
  }
  return null;
}
function diggRscChunks(html) {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map(x => x[1]);
}
async function fetchDiggHtml(url) {
  // 1. Supabase edge fn — server-side fetch, returns the *raw* HTML (RSC chunks intact)
  try {
    const p = new URLSearchParams({ mode: 'raw', url, t: String(Date.now()) });
    const res = await fetch(SUPABASE_RSS + '?' + p, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const html = data.html || data.text || '';
      if (html && html.length >= 500) return html;
    }
  } catch {}
  // 2. AllOrigins
  try {
    const res = await fetch(ALLORIGINS + encodeURIComponent(url) + '&t=' + Math.floor(Date.now() / 300000), { signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => ({}));
    const html = data.contents || '';
    if (html && html.length >= 500) return html;
  } catch {}
  // 3. corsproxy.io
  try {
    const res = await fetch('https://corsproxy.io/?' + encodeURIComponent(url), { signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    if (html && html.length >= 500) return html;
  } catch {}
  return '';
}
async function fetchDiggStories(which) {
  const url = which === 'ai' ? 'https://di.gg/ai' : 'https://di.gg';
  const html = await fetchDiggHtml(url);
  if (!html) return [];
  // 1. RSC payload (may be stripped by the proxy)
  const chunks = diggRscChunks(html);
  if (chunks.length) {
    const arrText = extractJsonArrayAfter(jsUnescape(chunks.join('')), 'items');
    if (arrText) {
      try {
        const arr = JSON.parse(arrText);
        if (Array.isArray(arr) && arr.length > 0) {
          return arr.slice(0, 30).map((c, i) => ({
            title: ((c && (c.title || c.sourceTitle)) || '').toString().trim(),
            description: ((c && (c.tldr || c.summary || c.reason)) || '').toString().trim(),
            link: 'https://di.gg/ai/' + ((c && (c.clusterUrlId || c.clusterId)) || ''),
            pubDate: (c && c.createdAt) || '',
            source: 'Digg AI',
            diggCount: (c && (c.postCount || c.diggs)) || 0,
            rank: (c && c.rank) || i + 1,
            isDigg: true,
          })).filter(it => it.title);
        }
      } catch {}
    }
  }
  // 2. Fallback: parse the rendered HTML — stories render as anchors to /ai/{id} with title + tldr inline
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const results = [];
  for (const a of Array.from(doc.querySelectorAll('a[href*="/ai/"]'))) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/\/ai\/([a-z0-9_-]+)/i);
    if (!m) continue;
    const id = m[1];
    if (results.find(r => r.link.includes(id))) continue;
    const text = a.textContent.trim();
    if (text.length < 20) continue;
    const sentenceEnd = text.search(/\.\s+[A-Z]/);
    const title = sentenceEnd > 20 ? text.slice(0, sentenceEnd + 1).trim() : text.slice(0, 100).trim();
    const description = sentenceEnd > 20 ? text.slice(sentenceEnd + 2).trim().slice(0, 300) : '';
    results.push({ title, description, link: 'https://di.gg/ai/' + id, pubDate: '', source: 'Digg AI', diggCount: 0, rank: results.length + 1, isDigg: true });
    if (results.length >= 30) break;
  }
  return results;
}
async function fetchGitHubStories() {
  const html = await fetchDiggHtml('https://di.gg/ai');
  if (!html) return [];
  // 1. RSC payload — githubMostStarred7d (gives star counts + notable starrers)
  const chunks = diggRscChunks(html);
  if (chunks.length) {
    const arrText = extractJsonArrayAfter(jsUnescape(chunks.join('')), 'githubMostStarred7d');
    if (arrText) {
      try {
        const arr = JSON.parse(arrText);
        if (Array.isArray(arr) && arr.length > 0) {
          return arr.slice(0, 30).map((r, i) => {
            const repo = ((r && r.full_name) || '').toString().trim();
            const stars = (r && r.stargazers_count) || 0;
            const followers = (r && Array.isArray(r.starrers) ? r.starrers : []).map(s => (s && (s.display_name || s.username)) || '').filter(Boolean).slice(0, 3);
            return {
              title: ((r && r.description) || repo).toString().trim(),
              description: repo + (r && r.language ? ' · ' + r.language : '') + (followers.length ? ' · ★ ' + followers.join(', ') : ''),
              repo, stars,
              link: repo ? 'https://github.com/' + repo : '',
              pubDate: (r && r.most_recent_star_at) || '',
              source: '★ ' + (stars ? stars.toLocaleString() : '0'),
              rank: i + 1, isGitHub: true,
            };
          }).filter(it => it.repo);
        }
      } catch {}
    }
  }
  // 2. Fallback: scrape github.com links out of the rendered HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const results = [];
  for (const a of Array.from(doc.querySelectorAll('a[href*="github.com/"]'))) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/github\.com\/([^/?#]+\/[^/?#]+)/);
    if (!m) continue;
    const repo = m[1];
    if (results.find(r => r.repo === repo)) continue;
    const text = a.textContent.trim();
    if (text.length < 10) continue;
    results.push({ title: repo, description: text.slice(0, 200), repo, link: 'https://github.com/' + repo, pubDate: '', source: 'GitHub · Digg AI', rank: results.length + 1, isGitHub: true });
    if (results.length >= 20) break;
  }
  return results;
}
async function resolveDiggSource(diggUrl) {
  try {
    if (!diggUrl || !diggUrl.includes('di.gg')) return null;
    const res = await fetch(ALLORIGINS + encodeURIComponent(diggUrl), { signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => ({}));
    const html = data.contents || '';
    if (!html) return null;
    const externalHost = href => { try { const h = new URL(href, 'https://di.gg').hostname.toLowerCase(); return (h && !h.endsWith('di.gg') && !h.endsWith('digg.com') && !h.includes('vercel')) ? h : null; } catch { return null; } };
    const social = href => /\b(x\.com|twitter\.com|t\.co|youtube\.com|youtu\.be|reddit\.com)\b/i.test(href);
    // 1. rendered outbound <a> tags
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a[target="_blank"][href], a[rel*="noopener"][href]')).map(a => a.getAttribute('href')).filter(externalHost);
    for (const href of anchors) if (!social(href)) { try { return new URL(href, 'https://di.gg').href; } catch { return href; } }
    for (const href of anchors) { try { return new URL(href, 'https://di.gg').href; } catch { return href; } }
    // 2. "url":"https://..." in the RSC payload (the cluster's source posts)
    const chunks = diggRscChunks(html);
    if (chunks.length) {
      const urls = [...jsUnescape(chunks.join('')).matchAll(/"url":"(https?:\/\/[^"]+)"/g)].map(m => m[1]).filter(externalHost);
      for (const href of urls) if (!social(href)) return href;
      if (urls.length) return urls[0];
    }
    return null;
  } catch { return null; }
}

async function fetchText(url) {
  let best = '';
  const good = t => t && wordCount(t) >= 200 && !PAYWALL_PHRASES.some(p => t.toLowerCase().includes(p));
  // Jina (JS-rendered) → AllOrigins (fast) → archive.ph → Supabase edge fn (Googlebot UA)
  for (const [label, fn] of [['Jina', fetchViaJina], ['AllOrigins', fetchViaAllOrigins], ['archive.ph', fetchViaArchivePh], ['Supabase', fetchViaSupabaseArticle]]) {
    try {
      const t = await fn(url);
      if (t && wordCount(t) > wordCount(best)) best = t;
      if (good(best)) return best;
    } catch (e) { console.log(label + ':', e && e.message); }
  }
  if (best && wordCount(best) > 30) return best; // best-effort — caller surfaces the "may be truncated" banner
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
    const title = decodeHtmlEntities(get('title'));
    const link = isAtom ? (item.querySelector('link[rel=alternate]')?.getAttribute('href') || item.querySelector('link')?.getAttribute('href') || '') : get('link');
    const desc = decodeHtmlEntities((get('description') || get('summary')).replace(/<[^>]+>/g,'').trim());
    const full = (get('content') || '').replace(/<[^>]+>/g,'').trim();
    return { title, link, description:desc.slice(0,200), fullContent:decodeHtmlEntities(full.length>desc.length?full:''), pubDate:get('pubDate')||get('published')||get('updated')||'', source:feed.name, category:feed.category, feedId:feed.id };
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
  const [activeArticleUrl, setActiveArticleUrl] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('speedr_onboarded'));
  const [onboardSlide, setOnboardSlide] = useState(0);
  const [chunks, setChunks] = useState([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [immersionHint, setImmersionHint] = useState(false);
  const [history, setHistory] = useState([]); // [{title, text}]

  // News
  const [category, setCategory] = useState('All');
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [diggItems, setDiggItems] = useState([]);
  const [diggLoading, setDiggLoading] = useState(false);
  const [githubItems, setGithubItems] = useState([]);
  const [githubLoading, setGithubLoading] = useState(false);
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
  const [hashMarksOn, setHashMarksOn] = useSetting('hashMarksOn');

  const settings = { wpm, chunkSize, peripheralBefore, peripheralAfter, orpOn, orpColor, fontSize, fontStyle, variablePacing, showProgress, hashMarksOn };

  const landscape = useOrientation();
  const timerRef = useRef(null);
  const holdRef = useRef(false);
  const newsScrollRef = useRef(null);
  const wordRef = useRef(null);
  const rewindRef = useRef(null);
  const fastFwdRef = useRef(null);
  const holdTimerRef = useRef(null);
  const baseDelay = 60000 / wpm;

  // iOS Safari: nudge the address bar away on load (no-op in standalone PWA)
  useEffect(() => {
    document.body.style.position = 'static';
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowY = 'auto';
    window.scrollTo(0, 1);
    const t = setTimeout(() => {
      document.body.style.position = '';
      document.body.style.overflowY = 'hidden';
      document.documentElement.style.overflowY = 'hidden';
      window.scrollTo(0, 0);
    }, 150);
    return () => clearTimeout(t);
  }, []);

  const allFeeds = useMemo(() => [...ALL_FEEDS, ...extraFeeds], [extraFeeds]);
  const activeFeeds = useMemo(() => allFeeds.filter(f => enabledFeeds.includes(f.id)), [allFeeds, enabledFeeds]);

  // Load text into reader
  const loadText = useCallback((text, title = '') => {
    const clean = decodeHtmlEntities(text);
    const c = tokenize(clean, chunkSize);
    setChunks(c); setIdx(0); setPlaying(false); setDone(false); setIsFocused(false);
    setActiveText(clean); setActiveTitle(title);
  }, [chunkSize]);

  const finishOnboarding = () => {
    localStorage.setItem('speedr_onboarded', '1');
    setShowOnboarding(false);
    const article = PINNED_ARTICLES[0];
    loadText(article.text, article.title);
    setTab('reader');
  };

  useEffect(() => {
    if (activeText) { setChunks(tokenize(activeText, chunkSize)); setIdx(0); setPlaying(false); setDone(false); }
  }, [chunkSize]);

  // Leaving the reader pauses playback (the bottom tab bar stays tappable while faded)
  useEffect(() => { if (tab !== 'reader') { setPlaying(false); setIsFocused(false); } }, [tab]);

  // Playback
  useEffect(() => {
    if (!playing || !chunks.length) { clearTimeout(timerRef.current); return; }
    if (idx >= chunks.length) { setPlaying(false); setDone(true); setIsFocused(false); return; }
    timerRef.current = setTimeout(() => setIdx(i => i+1), chunkDelay(chunks[idx], baseDelay, variablePacing));
    return () => clearTimeout(timerRef.current);
  }, [playing, idx, chunks, baseDelay, variablePacing]);

  // Stop any seek/playback timers if the app unmounts mid-press
  useEffect(() => () => { clearInterval(rewindRef.current); clearInterval(fastFwdRef.current); clearTimeout(timerRef.current); clearTimeout(holdTimerRef.current); }, []);

  // postMessage from bookmarklet
  useEffect(() => {
    const onMsg = e => {
      if (e.data?.speedrText?.length > 50) {
        loadText(e.data.speedrText, e.data.speedrTitle || 'Bookmarklet');
        setTab('reader');
        // Dismiss onboarding if showing
        if (localStorage.getItem('speedr_onboarded') !== '1') {
          localStorage.setItem('speedr_onboarded', '1');
          setShowOnboarding(false);
        }
        // Immersion mode: fade the chrome, show only the word on black
        setIsFocused(true);
        setImmersionHint(false);
        setTimeout(() => {
          setImmersionHint(true);
          setTimeout(() => setImmersionHint(false), 2500);
        }, 3000);
      }
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

  const refreshNews = () => {
    if (category === 'Digg AI') { setDiggLoading(true); fetchDiggStories('ai').then(setDiggItems).catch(() => setDiggItems([])).finally(() => setDiggLoading(false)); }
    else if (category === 'GitHub') { setGithubLoading(true); fetchGitHubStories().then(setGithubItems).catch(() => setGithubItems([])).finally(() => setGithubLoading(false)); }
    else loadFeeds(activeFeeds, true);
  };
  // Digg AI / GitHub are live rankings off di.gg/ai — refetch on each visit
  useEffect(() => { if (tab === 'news' && (category === 'Digg AI' || category === 'GitHub')) refreshNews(); }, [tab, category]);

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setFetchErr(''); setFetching(true);
    try {
      let u = urlInput.trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      const text = await fetchText(u);
      if (!text || text.length < 100) throw new Error('Could not extract article text.');
      loadText(decodeHtmlEntities(text), u); setActiveArticleUrl(u); setTab('reader');
    } catch(e) { setFetchErr(e.message); }
    finally { setFetching(false); }
  };

  const handleReadArticle = async item => {
    setActiveArticleUrl(item.link || '');
    // Save scroll position
    if (newsScrollRef.current) setPrevNewsScroll(newsScrollRef.current.scrollTop);
    // Add to history
    if (activeText) setHistory(h => [{ title: activeTitle, text: activeText }, ...h.slice(0,9)]);
    setTab('reader');
    // Digg AI story: resolve the cluster's original source URL, run it through the fetch chain
    if (item.isDigg) {
      setFetching(true);
      try {
        const src = await resolveDiggSource(item.link);
        if (src) {
          const text = await fetchText(src).catch(() => '');
          if (text && wordCount(text) >= 100) { loadText(decodeHtmlEntities(text), item.title); setActiveArticleUrl(src); saveArticle(item.title, text, src, 'Digg AI'); return; }
        }
        loadText(((item.title||'') + '\n\n' + (item.description||'')).trim() || (item.title||'Digg story'), item.title || 'Digg story');
        setActiveArticleUrl(src || item.link || '');
      } finally { setFetching(false); }
      return;
    }
    // GitHub trending: open the repo page through the fetch chain
    if (item.isGitHub) {
      const repoUrl = item.link || ('https://github.com/' + (item.repo || ''));
      setActiveArticleUrl(repoUrl);
      setFetching(true);
      try {
        const text = await fetchText(repoUrl).catch(() => '');
        if (text && wordCount(text) >= 100) { loadText(decodeHtmlEntities(text), item.title || item.repo); saveArticle(item.title || item.repo, text, repoUrl, 'GitHub'); return; }
        loadText(((item.repo||'') + '\n\n' + (item.title||'') + (item.description ? '\n\n' + item.description : '')).trim() || (item.repo||'GitHub repo'), item.repo || item.title || 'GitHub repo');
      } finally { setFetching(false); }
      return;
    }
    if (item.fullContent?.length > 500) { loadText(decodeHtmlEntities(item.fullContent), item.title); saveArticle(item.title, item.fullContent, item.link, item.source); return; }
    setFetching(true);
    try {
      const text = await fetchText(item.link);
      const ft = text.length > 200 ? text : (item.fullContent || item.title + '. ' + item.description);
      loadText(decodeHtmlEntities(ft), item.title);
      saveArticle(item.title, ft, item.link, item.source);
    } catch { loadText(decodeHtmlEntities(item.fullContent || item.description || item.title), item.title); }
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

  const openLibraryArticle = async (a) => {
    let text = a.text;
    if (!text && !a.id.startsWith('local_')) {
      showToast('Loading...');
      const art = await loadArticleTextRemote(a.id).catch(() => null);
      text = art && art.text;
      if (text) {
        setLibrary(prev => {
          const next = prev.map(x => x.id === a.id ? { ...x, text } : x);
          localStorage.setItem('speedr_library', JSON.stringify(next));
          return next;
        });
      }
    }
    if (!text) { showToast('Could not load article'); return; }
    if (activeText) setHistory(h => [{ title: activeTitle, text: activeText }, ...h.slice(0, 9)]);
    loadText(text, a.title);
    setActiveArticleUrl(a.url || '');
    setTab('reader');
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
  const uiFading = isFocused && !landscape;
  const articleTruncated = tab==='reader' && !!activeText && !!activeArticleUrl && (totalWords < 200 || PAYWALL_PHRASES.some(p => activeText.toLowerCase().includes(p)));

  // Keep the status-bar / theme color pure black, and go full black behind the app while focused
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#000000');
    document.documentElement.style.background = uiFading ? '#000000' : '#0d0d0d';
  }, [uiFading]);

  const bookmarkletCode = `javascript:(function(){
  var title = document.title.replace(/\\s+[\\|\\-–—]\\s+.*$/, '').trim();
  var text = '';
  var candidates = [
    '.article-body','.post-content','.entry-content','.story-body',
    '.body.markup','.article__body','.article-content','.post-body',
    '.content-body','[data-testid="article-body"]','article','[role=main]','main'
  ];
  for (var i = 0; i < candidates.length; i++) {
    var el = document.querySelector(candidates[i]);
    if (!el) continue;
    var ps = Array.from(el.querySelectorAll('p, li')).filter(function(p) {
      var t = p.innerText.trim();
      return t.length > 40 && !/subscribe|sign.?up|newsletter|follow us|read more|advertisement/i.test(t);
    });
    if (ps.length > 3) {
      text = ps.map(function(p) { return p.innerText.trim(); }).join('\\n\\n');
      break;
    }
  }
  if (!text) {
    var ps = Array.from(document.querySelectorAll('p')).filter(function(p) {
      var t = p.innerText.trim();
      return t.length > 40 && !/subscribe|sign.?up|newsletter|follow us|advertisement/i.test(t);
    });
    text = ps.map(function(p) { return p.innerText.trim(); }).join('\\n\\n');
  }
  if (!text || text.length < 100) {
    alert('Speedr: no article text found. Make sure you are logged in if this is a paywalled article.');
    return;
  }
  if (text.split(/\\s+/).length < 150) {
    alert('Speedr: only ' + text.split(/\\s+/).length + ' words found. You may be hitting a paywall — make sure you are logged in.');
    return;
  }
  var w = window.open('https://myspeedr.vercel.app/', 'speedr');
  var attempts = 0;
  var send = function() {
    attempts++;
    try { w.postMessage({ speedrText: text, speedrTitle: title }, '*'); } catch(e) {}
    if (attempts < 3) setTimeout(send, 800);
  };
  setTimeout(send, 800);
})();`.replace(/\n\s*/g, '');

  // -- RENDER -------------------------------------------------------------------
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',paddingTop:'env(safe-area-inset-top)',paddingLeft:'env(safe-area-inset-left)',paddingRight:'env(safe-area-inset-right)',background:uiFading?'#000000':'#0d0d0d',transition:'background 0.25s ease',overflow:'hidden',height:'100dvh'}}>

        {/* TOP BAR */}
        <div onClick={()=>{ if (uiFading) setIsFocused(false); }} className="ls-hide ui-layer" style={{flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px 10px',borderBottom:'1px solid #141414',opacity:uiFading?0.07:1,transition:'opacity 0.25s ease',pointerEvents:'auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {/* Back button when came from news */}
            {tab==='reader' && activeTitle && prevNewsScroll > 0 && (
              <button onClick={goBackToNews} style={{background:'none',border:'none',color:'#8b7fff',cursor:'pointer',fontSize:20,padding:'0 4px 0 0',lineHeight:1}}>{'<'}</button>
            )}
            <div style={{display:'flex', alignItems:'baseline', gap:0}}>
              <span style={{color:'#7c6af7', fontSize:26, lineHeight:1}}>⚡</span>
              <span style={{color:'#f0f0f0', fontSize:20, fontWeight:500, fontFamily:"'JetBrains Mono', monospace", letterSpacing:'-0.5px', marginLeft:-2}}>peedr</span>
            </div>
            {activeTitle && tab==='reader' && (
              <span style={{fontSize:12,color:'#444',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeTitle}</span>
            )}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {tab==='news' && <button onClick={()=>setShowSources(s=>!s)} style={showSources?pillActive:pill}>{showSources?'done':'sources'}</button>}
            {tab==='reader' && (
              <button
                onClick={(e)=>{ e.stopPropagation(); if(chunks.length){ if(playing){setPlaying(false);setIsFocused(false);}else{if(idx>=chunks.length){setIdx(0);setDone(false);}setPlaying(true);setIsFocused(true);} } }}
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
                className={landscape ? 'ls-reader' : ''}
                style={{...card,flex:1,minHeight:landscape?0:180,cursor:'pointer',touchAction:'none',display:'flex',flexDirection:'column',marginBottom:0,position:'relative'}}
              >
                {/* Seek / hold zones — only active while there's text and we're not on the finished screen */}
                {chunks.length > 0 && !done && (<>
                  {/* LEFT ZONE — rewind */}
                  <div
                    onPointerDown={e => { e.stopPropagation(); if (!chunks.length) return; setIdx(i => Math.max(0, i - 1)); rewindRef.current = setInterval(() => setIdx(i => Math.max(0, i - 1)), 60000 / wpm); }}
                    onPointerUp={e => { e.stopPropagation(); clearInterval(rewindRef.current); }}
                    onPointerLeave={e => { e.stopPropagation(); clearInterval(rewindRef.current); }}
                    onPointerCancel={e => { e.stopPropagation(); clearInterval(rewindRef.current); }}
                    style={{position:'absolute', left:0, top:0, width:'20%', height:'100%', zIndex:10, touchAction:'none'}}
                  />
                  {/* MIDDLE ZONE — hold to read / tap to pause */}
                  <div
                    onPointerDown={e => { if (!chunks.length) return; e.preventDefault(); holdRef.current = true; if (idx >= chunks.length) { setIdx(0); setDone(false); } setPlaying(true); clearTimeout(holdTimerRef.current); holdTimerRef.current = setTimeout(() => { if (holdRef.current) setIsFocused(true); }, 120); }}
                    onPointerUp={e => { if (!holdRef.current) return; e.preventDefault(); clearTimeout(holdTimerRef.current); holdRef.current = false; setPlaying(false); setIsFocused(false); }}
                    onPointerLeave={e => { if (!holdRef.current) return; e.preventDefault(); clearTimeout(holdTimerRef.current); holdRef.current = false; setPlaying(false); setIsFocused(false); }}
                    onPointerCancel={e => { clearTimeout(holdTimerRef.current); holdRef.current = false; setPlaying(false); setIsFocused(false); }}
                    style={{position:'absolute', left:'20%', top:0, width:'50%', height:'100%', zIndex:10, touchAction:'none'}}
                  />
                  {/* RIGHT ZONE — fast forward */}
                  <div
                    onPointerDown={e => { e.stopPropagation(); if (!chunks.length) return; setIdx(i => Math.min(chunks.length - 1, i + 1)); fastFwdRef.current = setInterval(() => setIdx(i => Math.min(chunks.length - 1, i + 1)), 60000 / wpm); }}
                    onPointerUp={e => { e.stopPropagation(); clearInterval(fastFwdRef.current); }}
                    onPointerLeave={e => { e.stopPropagation(); clearInterval(fastFwdRef.current); }}
                    onPointerCancel={e => { e.stopPropagation(); clearInterval(fastFwdRef.current); }}
                    style={{position:'absolute', right:0, top:0, width:'30%', height:'100%', zIndex:10, touchAction:'none'}}
                  />
                </>)}

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
                    <div className="ls-words" style={{width:'100%'}}>
                      <ChunkDisplay chunk={currentChunk} settings={settings}/>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {showProgress && !done && (
                  <div style={{height:2,background:'#111',flexShrink:0}}>
                    <div style={{height:'100%',width:progress+'%',background:'#7c6af7',transition:'width 0.12s linear'}}/>
                  </div>
                )}
              </div>

              {/* Stats row — standalone, between reader stage and speed slider */}
              <div className={`ui-layer ls-hide${uiFading?' ui-faded':''}`} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 4px',fontSize:12,color:'#3a3a3a',gap:6}}>
                <span>{totalWords.toLocaleString()}w</span>
                <span>{minsLeft}m</span>
                <span>{Math.round(progress)}%</span>
                {activeText&&<button onClick={()=>saveArticle(activeTitle,activeText,urlInput,'')} style={{padding:'3px 10px',border:'1px solid #2a2a4a',borderRadius:10,background:'transparent',color:'#8b7fff',fontSize:11,cursor:'pointer'}}>Save</button>}
                {activeText&&<button onClick={()=>{navigator.clipboard?.writeText(activeText);showToast('Copied!');}} style={{padding:'3px 10px',border:'1px solid #1a1a1a',borderRadius:10,background:'transparent',color:'#555',fontSize:11,cursor:'pointer'}}>Copy</button>}
                {activeArticleUrl&&<a href={activeArticleUrl} target='_blank' rel='noreferrer' style={{padding:'3px 10px',border:'1px solid #1a1a1a',borderRadius:10,color:'#555',fontSize:11,cursor:'pointer',textDecoration:'none'}}>Link</a>}
              </div>

              {/* Speed slider */}
              <div className={`ui-layer ls-hide${uiFading?' ui-faded':''}`} style={{...card,padding:'14px 16px',marginBottom:0}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:12,color:'#777',minWidth:62,fontVariantNumeric:'tabular-nums'}}>{wpm} wpm</span>
                  <input type="range" min={100} max={700} step={10} value={wpm} onChange={e=>setWpm(+e.target.value)} style={{flex:1,accentColor:'#7c6af7',cursor:'pointer'}}/>
                  <span style={{fontSize:11,color:'#333',minWidth:28,textAlign:'right'}}>700</span>
                </div>
              </div>

              {/* Truncated / paywalled article fallback */}
              {articleTruncated && (
                <div className={`ui-layer ls-hide${uiFading?' ui-faded':''}`} style={{...card,padding:'12px 14px',marginTop:10,marginBottom:0,display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{fontSize:12,color:'#888',lineHeight:1.5}}>Article may be truncated — try the bookmarklet for full text.</div>
                  <a href={activeArticleUrl} target="_blank" rel="noreferrer" style={{...btnGhost,textAlign:'center',textDecoration:'none',color:'#8b7fff',borderColor:'#2a2a4a'}}>Open in Safari →</a>
                </div>
              )}

            </div>
          )}

          {/* -- NEWS -- */}
          {tab==='news' && !showSources && (
            <div key="news" className="slide-up">
              {/* Category pills with fade edges */}
              <div style={{position:'relative',marginBottom:12}}>
                <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:2,WebkitMaskImage:'linear-gradient(to right, transparent 0, black 8px, black calc(100% - 24px), transparent 100%)'}}>
                  {CATEGORIES.filter(cat => cat !== 'Custom' || extraFeeds.length > 0).map(cat => (
                    <button key={cat} style={{padding:'7px 14px',borderRadius:20,fontSize:13,border:'none',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontWeight:400,background:category===cat?'#7c6af7':'#111',color:category===cat?'#fff':'#c0c0c0',transition:'all 0.15s'}} onClick={()=>setCategory(cat)}>{cat}</button>
                  ))}
                </div>
              </div>

              <div style={card}>
                {(()=>{
                  const isGh = category==='GitHub', isDg = category==='Digg AI', special = isGh || isDg;
                  const newsList = isGh ? githubItems : isDg ? diggItems : visibleItems;
                  const newsBusy = isGh ? (githubLoading && githubItems.length===0) : isDg ? (diggLoading && diggItems.length===0) : (feedLoading && feedItems.length===0);
                  return newsBusy ? (
                  <div style={{padding:48,textAlign:'center',color:'#222',fontSize:14,animation:'pulse 1.4s infinite'}}>Loading...</div>
                ) : newsList.length===0 ? (
                  <div style={{padding:48,textAlign:'center'}}>
                    <div style={{color:'#222',fontSize:14,marginBottom:12}}>{special ? `Couldn't load ${category} right now` : 'No articles'}</div>
                    <button style={btnPrimary} onClick={refreshNews}>Refresh</button>
                  </div>
                ) : newsList.map((item,i) => {
                  const feed = (item.isDigg || item.isGitHub) ? null : allFeeds.find(f => f.id === item.feedId || f.name === item.source);
                  const fav = feed ? feedFavicon(feed.url) : '';
                  return (
                  <div key={i} onClick={()=>handleReadArticle(item)} style={{padding:'14px 16px',borderBottom:i<newsList.length-1?'1px solid #111':'none',display:'flex',gap:12,cursor:'pointer',WebkitTapHighlightColor:'transparent'}}>
                    {fav && <img src={fav} alt="" width={18} height={18} loading="lazy" onError={e=>{e.currentTarget.style.display='none';}} style={{flexShrink:0,alignSelf:'flex-start',marginTop:2,borderRadius:4,opacity:0.85}}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:item.isGitHub?'#f0a500':'#7c6af7',marginBottom:4,fontWeight:500,letterSpacing:0.3}}>{item.source}{item.isDigg && item.diggCount ? ` · ${item.diggCount}` : ''} &nbsp; {timeAgo(item.pubDate)}</div>
                      <div style={{fontSize:15,color:'#e0e0e0',lineHeight:1.45,fontWeight:400}}>{item.title}</div>
                      {item.description && <div style={{fontSize:12,color:'#555',marginTop:4,lineHeight:1.5}}>{item.description.slice(0,140)}</div>}
                    </div>
                    <div style={{color:'#2a2a2a',fontSize:16,flexShrink:0,alignSelf:'center'}}>{'>'}</div>
                  </div>
                  );
                }); })()}
              </div>

              <button style={{...btnGhost,width:'100%',marginTop:4,marginBottom:12}} onClick={refreshNews}>
                {((category==='Digg AI') ? diggLoading : (category==='GitHub') ? githubLoading : feedLoading) ? 'Refreshing...' : 'Refresh'}
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
              <input
                style={{...field,marginBottom:12}}
                placeholder="Search saved articles..."
                value={libSearch}
                onChange={e=>setLibSearch(e.target.value)}
              />
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Getting Started</div>
                <div style={{background:'#0f0e1a',borderRadius:16,border:'1px solid #2a2040',overflow:'hidden',marginBottom:12}}>
                  {PINNED_ARTICLES.map((a,i) => (
                    <div key={a.id} onClick={()=>{ loadText(a.text, a.title); setActiveArticleUrl(''); setTab('reader'); }} style={{padding:'14px 16px',borderBottom:i<PINNED_ARTICLES.length-1?'1px solid #1a1830':'none',display:'flex',gap:12,alignItems:'center',cursor:'pointer'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,color:'#c0b8ff',fontWeight:400,lineHeight:1.4}}>{a.title}</div>
                        <div style={{fontSize:11,color:'#4a4060',marginTop:3}}>{a.word_count} words · Speedr Guide</div>
                      </div>
                      <div style={{color:'#3a3060',fontSize:16,flexShrink:0}}>›</div>
                    </div>
                  ))}
                </div>
              </div>
              {libLoading && library.length===0 ? (
                <div style={{padding:48,textAlign:'center',color:'#333',fontSize:14,animation:'pulse 1.4s infinite'}}>Loading...</div>
              ) : library.filter(a=>!libSearch||a.title.toLowerCase().includes(libSearch.toLowerCase())).length===0 ? (
                <div style={{padding:48,textAlign:'center'}}>
                  <div style={{color:'#333',fontSize:15,marginBottom:8}}>No saved articles</div>
                  <div style={{color:'#222',fontSize:13,lineHeight:1.6}}>Articles save automatically when you read from News. Tap Save in the reader.</div>
                </div>
              ) : (
                <div style={card}>
                  {library.filter(a=>!libSearch||a.title.toLowerCase().includes(libSearch.toLowerCase())).map((a,i,arr) => (
                    <div key={a.id} style={{padding:'14px 16px',borderBottom:i<arr.length-1?'1px solid #111':'none',display:'flex',gap:12,alignItems:'flex-start'}}>
                      <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>openLibraryArticle(a)}>
                        <div style={{fontSize:14,color:'#e0e0e0',fontWeight:400,lineHeight:1.4}}>{a.title}</div>
                        <div style={{fontSize:11,color:'#555',marginTop:4}}>
                          {a.source ? a.source + ' - ' : ''}{(a.word_count||0).toLocaleString()} words - {timeAgo(a.saved_at)}
                        </div>
                      </div>
                      <button onClick={()=>deleteArticle(a.id)} style={{background:'none',border:'none',color:'#2a2a2a',cursor:'pointer',fontSize:20,lineHeight:1,padding:'0 4px',flexShrink:0}}>x</button>
                    </div>
                  ))}
                </div>
              )}
              {library.length > 0 && (
                <button style={{...btnGhost,width:'100%',marginTop:4}} onClick={loadLibrary}>
                  {libLoading ? 'Syncing...' : 'Sync with cloud'}
                </button>
              )}
            </div>
          )}

          {tab==='train' && <div className="slide-up" style={{paddingBottom:12}}><TrainTab readerWpm={wpm}/></div>}

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
                <SettingRow label="Focus hashmarks" subtitle="Vertical anchor for eye lock">
                  <Toggle on={hashMarksOn} onChange={setHashMarksOn}/>
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

              <div style={{fontSize:10,color:'#c0c0c0',fontWeight:500,textTransform:'uppercase',letterSpacing:1.5,padding:'0 4px 8px'}}>Help</div>
              <div style={{...card,marginBottom:16}}>
                <div style={{padding:16}}>
                  <button onClick={()=>{setOnboardSlide(0);setShowOnboarding(true);}} style={{width:'100%',padding:'13px',border:'1px solid #2a2a4a',borderRadius:12,fontSize:14,fontWeight:400,cursor:'pointer',background:'transparent',color:'#8b7fff'}}>Show Welcome Guide</button>
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
        <div className="ls-hide ui-layer" style={{flexShrink:0,display:'flex',borderTop:'1px solid #141414',background:'#0d0d0d',paddingBottom:'env(safe-area-inset-bottom)',minHeight:58,zIndex:10,opacity:uiFading?0.07:1,transition:'opacity 0.25s ease',pointerEvents:'auto'}}>
          {[['reader','R','Reader'],['news','N','News'],['library','B','Library'],['train','\u26a1','Train'],['settings','\u2699','Settings']].map(([id,icon,label]) => (
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'10px 0 8px',border:'none',background:'transparent',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,WebkitTapHighlightColor:'transparent'}}>
              <span style={{fontSize:(id==='settings'||id==='train')?20:19,fontFamily:(id==='settings'||id==='train')?'inherit':"'JetBrains Mono',monospace",fontWeight:(id==='settings'||id==='train')?400:500,color:tab===id?'#8b7fff':'#3a3a3a',transition:'color 0.15s'}}>{icon}</span>
              <span style={{fontSize:10,fontWeight:400,letterSpacing:0.5,color:tab===id?'#8b7fff':'#3a3a3a',transition:'color 0.15s'}}>{label}</span>
            </button>
          ))}
        </div>

      </div>
      {showOnboarding && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:500,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0 0 env(safe-area-inset-bottom)'}}>
          <div style={{background:'#111',borderRadius:'24px 24px 0 0',border:'1px solid #1a1a1a',width:'100%',maxWidth:480,padding:'32px 24px 24px',display:'flex',flexDirection:'column',gap:24}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:48,marginBottom:16}}>{ONBOARDING_SLIDES[onboardSlide].emoji}</div>
              <div style={{fontSize:20,fontWeight:500,color:'#f0f0f0',marginBottom:12}}>{ONBOARDING_SLIDES[onboardSlide].title}</div>
              <div style={{fontSize:14,color:'#888',lineHeight:1.7}}>{ONBOARDING_SLIDES[onboardSlide].body}</div>
            </div>
            <div style={{display:'flex',justifyContent:'center',gap:8}}>
              {ONBOARDING_SLIDES.map((_,i) => (
                <div key={i} style={{width:6,height:6,borderRadius:3,background:i===onboardSlide?'#7c6af7':'#2a2a2a',transition:'background 0.2s'}}/>
              ))}
            </div>
            {onboardSlide < ONBOARDING_SLIDES.length - 1 ? (
              <button onClick={()=>setOnboardSlide(s=>s+1)} style={{width:'100%',padding:'16px',border:'none',borderRadius:14,fontSize:15,fontWeight:500,cursor:'pointer',background:'#7c6af7',color:'#fff'}}>Next</button>
            ) : (
              <button onClick={finishOnboarding} style={{width:'100%',padding:'16px',border:'none',borderRadius:14,fontSize:15,fontWeight:500,cursor:'pointer',background:'#7c6af7',color:'#fff'}}>Start Reading</button>
            )}
            <button onClick={finishOnboarding} style={{background:'none',border:'none',color:'#333',fontSize:13,cursor:'pointer',padding:0}}>Skip</button>
          </div>
        </div>
      )}
      {immersionHint && uiFading && (
        <div style={{position:'fixed',bottom:96,left:'50%',transform:'translateX(-50%)',background:'rgba(255,255,255,0.06)',color:'#888',padding:'7px 16px',borderRadius:18,fontSize:12,zIndex:280,whiteSpace:'nowrap',pointerEvents:'none',animation:'fadeIn 0.4s ease'}}>
          tap to show controls
        </div>
      )}
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
