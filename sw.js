// offline help for the trip page: the page itself network-first, libraries/tiles/photos cache-first
const V = 'hk-shell-v1', T = 'hk-tiles-v1', MAX = 1800;
const SHELL = ['./hk.html', './toilets.json', './icon-192.png', './banner.jpg'];
const STATIC = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const TILES = /^https:\/\/(tiles\.openfreemap\.org|upload\.wikimedia\.org|[abc]\.tile\.openstreetmap\.org)\//;
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('hk-') && k !== V && k !== T).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
async function trim(){ const c = await caches.open(T), ks = await c.keys(); for(const k of ks.slice(0, Math.max(0, ks.length - MAX))) await c.delete(k); }
async function cacheFirst(req, name){ const c = await caches.open(name), hit = await c.match(req); if(hit) return hit;
  // <img>/<script> ask without CORS; these hosts allow it, and a CORS copy is not quota-padded like an opaque one
  const res = await fetch(req.mode === 'no-cors' ? new Request(req.url, {mode:'cors', credentials:'omit'}) : req);
  if(res && res.ok) c.put(req.url, res.clone()).then(() => { if(name === T && Math.random() < .02) trim(); }).catch(() => {});
  return res; }
async function netFirst(req){ const c = await caches.open(V);
  try{ const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]); if(res && res.ok) c.put(req.url.split('?')[0], res.clone()).catch(() => {}); return res; }
  catch(err){ const hit = await c.match(req, {ignoreSearch:true}); if(hit) return hit; return fetch(req); } }
self.addEventListener('fetch', e => { const r = e.request; if(r.method !== 'GET') return; const u = r.url;
  if(u.startsWith(self.location.origin + '/')){ if(u.includes('/hk-trip/')) e.respondWith(netFirst(r)); return; }
  if(STATIC.test(u)) e.respondWith(cacheFirst(r, V).catch(() => fetch(r)));
  else if(TILES.test(u)) e.respondWith(cacheFirst(r, T).catch(() => fetch(r))); });
