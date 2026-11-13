// offline help for the trip page: the page itself network-first, libraries/tiles/photos cache-first
const V = 'hk-shell-v4', T = 'hk-tiles-v1', MAX = 1800;
// the libraries are requested before this worker controls the first visit, so fetch them here as well
const SHELL = ['./', './hk.html', './toilets.json', './icon-192.png', './banner.jpg', './walk.png',
  './ride-mtr.png', './ride-taxi.png', './ride-bus.png', './ride-tram.png', './ride-ferry.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js',
  'https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js',
  'https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap'];
const STATIC = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const TILES = /^https:\/\/(tiles\.openfreemap\.org|upload\.wikimedia\.org|([abc]\.)?tile\.openstreetmap\.org)\//;
// the map style and tile index are small, change over time and everything else depends on them
const FRESH = /^https:\/\/tiles\.openfreemap\.org\/(styles\/|planet$)/, KEEP = /\/(styles|fonts|sprites)\/|\/planet$/;
// vector tiles live under a weekly version folder; drop it from the cache key so tiles saved before the trip still match afterwards
const tkey = u => u.replace(/(\/planet\/)[^/]+\//, '$1_/');
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.match(u).then(hit => hit || fetch(u, u.startsWith('http') ? {mode:'cors', credentials:'omit'} : {}).then(r => { if(r.ok) return c.put(u, r); })).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('hk-') && k !== V && k !== T).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
async function trim(){ const c = await caches.open(T), ks = (await c.keys()).filter(k => !KEEP.test(k.url)); for(const k of ks.slice(0, Math.max(0, ks.length - MAX))) await c.delete(k); }
async function cacheFirst(req, name, key){ const c = await caches.open(name), hit = await c.match(key, {ignoreVary:true}); if(hit) return hit;
  // <img>/<script> ask without CORS; these hosts allow it, and a CORS copy is not quota-padded like an opaque one
  const res = await fetch(req.mode === 'no-cors' ? new Request(req.url, {mode:'cors', credentials:'omit'}) : req);
  if(res && res.ok) c.put(key, res.clone()).then(() => { if(name === T && Math.random() < .02) trim(); }).catch(() => {});
  return res; }
// network first; a slow (4 s) or failing network is answered from the cache, and a late fresh copy is still stored
async function netFirst(e, req, name, key){ const c = await caches.open(name);
  // the page always checks for a newer copy instead of using the browser's 10-minute copy
  const net = fetch(name === V ? req.url : req, name === V ? {cache:'no-cache', credentials:'same-origin'} : undefined).then(res => { if(res && res.ok) return c.put(key, res.clone()).catch(() => {}).then(() => res); return res; });
  e.waitUntil(net.then(() => {}, () => {}));
  const cached = () => c.match(key, {ignoreSearch:true, ignoreVary:true});
  try{ const res = await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]);
    if(res && !res.ok && res.status >= 500){ const hit = await cached(); if(hit) return hit; }
    return res; }
  catch(err){ const hit = await cached(); if(hit) return hit; return net; } }
self.addEventListener('fetch', e => { const r = e.request; if(r.method !== 'GET') return; const u = r.url;
  if(u.startsWith(self.location.origin + '/')){ if(u.includes('/hk-trip/')) e.respondWith(netFirst(e, r, V, u.split(/[?#]/)[0])); return; }
  if(FRESH.test(u)) e.respondWith(netFirst(e, r, T, u));
  else if(STATIC.test(u)) e.respondWith(cacheFirst(r, V, u).catch(() => fetch(r)));
  else if(TILES.test(u)) e.respondWith(cacheFirst(r, T, tkey(u)).catch(() => fetch(r))); });
