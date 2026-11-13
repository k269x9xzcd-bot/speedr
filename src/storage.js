// Safe localStorage. iOS gives a PWA ~5 MB; a full store makes setItem throw QuotaExceededError,
// and a throw inside a React state updater takes the whole app down. Every write goes through here.

// Re-fetchable caches, in eviction order (cheapest to lose first).
const EVICT_PREFIXES = ['speedr_feed_cache', 'speedr_feed_ts', 'speedr_learn_doc_', 'speedr_learn_ai_', 'speedr_wl_meta'];
const LIBRARY_KEY = 'speedr_library';
const LIBRARY_TEXT_BUDGET = 1_200_000; // chars of article text kept on-device; older texts reload from the cloud

function evictCaches() {
  let freed = 0;
  try {
    for (const p of EVICT_PREFIXES) {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(p)) { freed += (localStorage.getItem(k) || '').length; localStorage.removeItem(k); }
      }
    }
  } catch {}
  return freed;
}

// Keep the newest article texts up to the budget. Older cloud-synced items keep metadata only
// (openLibraryArticle refetches their text); older local-only items are dropped — saveArticle also
// pushed them to the cloud, so a library sync brings them back.
export function fitLibrary(list) {
  if (!Array.isArray(list)) return [];
  let used = 0;
  const out = [];
  for (const a of list) {
    const len = a.text ? a.text.length : 0;
    if (!len || used + len <= LIBRARY_TEXT_BUDGET) { used += len; out.push(a); continue; }
    if (!String(a.id).startsWith('local_')) out.push({ ...a, text: '' });
  }
  return out;
}

export function lsSet(key, value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  try { localStorage.setItem(key, str); return true; } catch {}
  // Out of space: drop caches, shrink the library, retry once.
  evictCaches();
  try {
    if (key !== LIBRARY_KEY) {
      const lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(fitLibrary(lib).slice(0, 60)));
    }
  } catch {}
  try { localStorage.setItem(key, str); return true; } catch (e) { console.warn('storage full, skipped', key, e?.name); return false; }
}

export function saveLibrary(list) {
  const fitted = fitLibrary(list);
  if (lsSet(LIBRARY_KEY, fitted)) return fitted;
  // Still too big after evicting caches: keep fewer texts.
  const smaller = fitLibrary(fitted.slice(0, 40));
  lsSet(LIBRARY_KEY, smaller);
  return smaller;
}

// Run once at startup: if the store is already near the limit (as on a phone that has been
// crashing), trim it before anything else tries to write.
export function repairStorage() {
  try {
    let total = 0;
    for (const k of Object.keys(localStorage)) total += k.length + (localStorage.getItem(k) || '').length;
    if (total < 3_500_000) return;
    evictCaches();
    const lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
    localStorage.removeItem(LIBRARY_KEY);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(fitLibrary(lib)));
  } catch {}
}
