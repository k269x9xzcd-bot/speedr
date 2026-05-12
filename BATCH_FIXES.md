# Speedr — Batch Fixes & Features
> Drop this file in ~/Desktop/speedr and implement all items below in one or more commits.

---

## 1. Train — No Repeat Articles
- Track seen Wikipedia article IDs in `localStorage` under key `speedr_seen_passages` (array, cap at 50)
- In `fetchWikipediaPassage()`, shuffle the topic pool and skip any topic whose Wikipedia title is already in the seen list
- After a passage is successfully loaded and displayed, add its title to the seen list
- On fallback passages (BAKED), also track by `id` so same fallback doesn't repeat consecutively

---

## 2. Train — Skip/Regenerate Button
- On the reading phase in TrainTab, add a "Skip" ghost button below the MiniReader
- Tapping it fetches a new article without submitting a session or counting XP
- Style: same as the ghost `Done` button, label "New Article", subtle, doesn't interfere with reading
- The skipped article's ID gets added to the seen list so it won't reappear

---

## 3. Train — Offline/Poor Connection Fallback
- Wrap `fetchWikipediaPassage()` in a timeout (5 seconds max)
- If it times out or throws, fall back to a BAKED passage not yet seen this session
- Show a subtle inline indicator `"offline — using cached passage"` in the loading phase label
- Don't show an error or block the user

---

## 4. Disable Pinch-to-Zoom
In `index.html`, update the viewport meta tag to:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

---

## 5. Hashmark Jumps on Rotation
- In `ChunkDisplay` (App.jsx) and `MiniReader` (TrainTab.jsx), the `useEffect` that measures `orpCenter` via `getBoundingClientRect()` currently only fires on render
- Add a `ResizeObserver` on `containerRef` that re-measures and updates `orpCenter` whenever the container size changes (catches orientation changes immediately)
- Also add a `window resize` event listener as a fallback
- Clean up both observers in the `useEffect` return

---

## 6. Hold-to-Read Fade Not Working
Full rewrite of the fade mechanism in App.jsx:

- Replace `const uiFading = playing && !landscape` with a dedicated state: `const [isFocused, setIsFocused] = useState(false)`
- `const uiFading = isFocused && !landscape`
- In the MIDDLE zone `onPointerDown`: call `setIsFocused(true)` AND `setPlaying(true)`
- In the MIDDLE zone `onPointerUp/Leave/Cancel`: call `setIsFocused(false)` AND `setPlaying(false)`
- In the Focus button `onClick`: when activating focus, call `setIsFocused(true)`; when deactivating, call `setIsFocused(false)`
- When `done === true` (article finished): call `setIsFocused(false)`
- When `loadText()` is called: call `setIsFocused(false)`
- Elements that should fade to `opacity:0, pointerEvents:'none'` when `uiFading`: input card, speed slider card, stats row
- Elements that should fade to `opacity:0.07` but KEEP `pointerEvents:'auto'` when `uiFading`: top bar, bottom tab bar (so user can still tap to exit)
- All transitions: `transition: 'opacity 0.25s ease'`
- Verify the `uiFading` declaration comes AFTER the `isFocused` useState line (fixes TDZ crash)

---

## 7. Remove Peripheral Context Words
- In `ChunkDisplay` (App.jsx), for single-word chunks, remove the faded before/after peripheral context word spans entirely
- Only show the current word with ORP anchor — no surrounding context
- For multi-word chunks (chunkSize > 1), keep as-is
- Also remove any peripheral word rendering from `MiniReader` in TrainTab.jsx

---

## 8. Short Word Pairing
- In the tokenizer/chunker in App.jsx, after splitting text into words, post-process the word array:
- If a word is 1–2 characters long (e.g. "a", "I", "to", "of", "in", "is", "at", "by"), pair it with the next word and display them together as a single chunk
- Implement this as a `pairShortWords(words)` function that returns a new array where short words are joined with their successor via a non-breaking space
- Apply this before passing words to the chunk display
- Exception: don't pair if the short word ends a sentence (followed by period/punctuation)

---

## 9. Robust Article Fetch Chain
In App.jsx fetch pipeline:

**Step 1 — Jina** (existing, JS-rendered)
↓ if result < 200 words

**Step 2 — AllOrigins** (existing, fast)
↓ if result < 200 words

**Step 3 — archive.ph** (new)
- Fetch `https://archive.ph/newest/${encodeURIComponent(url)}`
- Extract article text from the archived page
- Handle 404s gracefully (not all articles are archived)
↓ if result < 200 words

**Step 4 — Supabase Edge Function with Googlebot spoof** (update existing)
- Add `'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'` header to the Edge Function fetch
↓ if still < 200 words

**Step 5 — Fallback UI**
- Show article with what we have (even if short)
- Add a prominent "Open in Safari →" button below the reader that opens the original URL
- Show a subtle banner: `"Article may be truncated — try the bookmarklet for full text"`

**Paywall detection:**
After any fetch, if word count < 200 OR text contains any of: `["subscribe to continue", "create a free account", "you've reached your limit", "sign in to read", "subscribe for full access"]` — show the "Open in Safari" fallback banner

---

## 10. Add Paywalled RSS Sources
Add the following feeds to the source list in App.jsx (or wherever RSS sources are defined). These will benefit from the robust fetch chain in item #9:

```
WSJ:          https://feeds.a.dj.com/rss/RSSWorldNews.xml
NYT:          https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml
The Atlantic: https://feeds.feedburner.com/TheAtlantic
Wired:        https://www.wired.com/feed/rss
FT:           https://www.ft.com/rss/home
New Yorker:   https://www.newyorker.com/feed/everything
Bloomberg:    https://feeds.bloomberg.com/news/rss.xml
Barron's:     https://www.barrons.com/rss/rssheadlines
The Economist:https://www.economist.com/feeds/print-sections/all-sections.xml
```

Add these under a "Premium" sub-label within their relevant categories (Business, World, Tech, etc.) or as a new "Premium" category pill.

---

## 11. Add AI + Digg News Categories
Add two new category pills in the News tab: **"AI"** and **"Digg"**

**AI category — source: `https://di.gg/ai`**
- Fetch the page via Jina or the Supabase Edge Function (it's JS-rendered)
- Parse the story list: each item has a title, summary, link (`https://di.gg/ai/{id}`), hours ago, and engagement counts
- Display top 20-30 stories ranked by their position on the page
- Refresh on each visit to the AI category (it's a live ranking)
- When user taps an article, resolve the `di.gg/ai/{id}` link to the original source URL, then run through the normal fetch chain

**Digg category — source: `https://digg.com`**
- Same approach — fetch and parse top stories
- If URLs overlap with di.gg/ai in future, deduplicate

---

## 12. Replace Header Text Logo with PWA Icon
In App.jsx top bar, replace the plain `"speedr"` text with:
```jsx
<img src="/icon-192.png" alt="speedr" style={{height:28, width:'auto', borderRadius:6}} />
```
Keep it left-aligned where the text currently sits. Remove the text node entirely.

---

## 13. Bookmarklet Black Immersion Mode
When a `speedrText` postMessage is received in App.jsx:

1. Load the text and switch to reader tab (already implemented)
2. Dismiss onboarding if showing (already implemented)
3. Additionally, activate immersion mode:
   - Set `isFocused(true)` immediately so the UI fades out
   - Set `document.documentElement.style.background = '#000000'`
   - Hide top bar, input card, stats row, speed slider, bottom tab bar via `uiFading` (opacity 0, pointer-events none)
   - Only the reader stage word display remains visible on pure black
   - Add a one-time subtle hint after 3 seconds: `"tap to show controls"` that fades in and out once
   - Tapping the non-zone area (or the dimmed top/bottom bars) restores the UI by setting `isFocused(false)`

---

## 14. TrainTab MiniReader — ORP + Hashmarks + Fade
Apply the same treatment as the main reader to MiniReader in TrainTab.jsx:

**ORP anchor layout:**
- Replace the centered word display with the same `pre / orp-letter / post` flex layout anchored at 35%
- `pre`: `flex: '0 0 35%', textAlign: 'right'`
- `orp`: `ref={orpRef}`, colored, fontWeight 600
- `post`: `flex: '0 0 65%', textAlign: 'left'`
- `containerRef` on outer div, measure `orpCenter` via `getBoundingClientRect()`
- `ResizeObserver` for rotation (same as item #5)

**Hashmarks:**
- Same tick implementation as main reader (14px + 7px ticks, 0.75/0.35 opacity)
- Positioned at measured `orpCenter`, top half and bottom half with `calc(50% - 20px)` clearance
- Color: `#e05252` (same as ORP letter)

**Fade during reading:**
- `isReading = started && !paused`
- Word count/WPM label: `opacity: isReading ? 0 : 1`
- Buttons row (Done + Start Reading): `opacity: isReading ? 0.12 : 1`
- Pass `onReadingChange(bool)` prop up to TrainTab
- In TrainTab, track `const [isReading, setIsReading] = useState(false)`
- Speed slider card: `opacity: isReading ? 0 : 1, pointerEvents: isReading ? 'none' : 'auto'`
- Passage title header: `opacity: isReading ? 0 : 1, pointerEvents: isReading ? 'none' : 'auto'`
- All transitions: `transition: 'opacity 0.3s ease'`

---

*End of batch. Implement all items, then run `npm run build` to verify no errors before committing. Commit message: "Batch: train fixes, reader improvements, new sources, immersion mode, ORP/hashmark polish"*
