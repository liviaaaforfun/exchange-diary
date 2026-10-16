/* Exchange Diary — offline: keeps the tool's own files on the device so it opens without a network.
   The diary itself never passes through here (it lives in the browser's storage on the device). */
const CORE="ed-core-v2",FONTS="ed-fonts-v1";
const FILES=["./","index.html","styles.css","app.css","themes.js","parse.js","app.js","objects.js","views.js","export.js","print.js",
  "mobile.js","search.js","guide.js","logo.png","icon-small.svg","apple-touch-icon.png","libs/html-to-image.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CORE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CORE&&k!==FONTS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET") return;
  const u=new URL(r.url);
  /* fonts never change: keep the first copy */
  if(/\.woff2?$/.test(u.pathname)||u.hostname==="fonts.googleapis.com"||u.hostname==="fonts.gstatic.com"){
    e.respondWith(caches.open(FONTS).then(c=>c.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok||res.type==="opaque") c.put(r,res.clone());return res}))));
    return;
  }
  if(u.origin!==location.origin) return;
  /* the tool's own files: the newest from the network when there is one, the kept copy when there is not */
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CORE).then(c=>c.put(r,cp))}return res})
    .catch(()=>caches.match(r,{ignoreSearch:true}).then(hit=>hit||(r.mode==="navigate"?caches.match("index.html"):Response.error()))));
});
