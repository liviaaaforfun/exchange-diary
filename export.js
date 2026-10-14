/* Exchange Diary — 輸出: 圖片 (PNG), PDF (the browser's own print → save as PDF, or a picture PDF where printing is not allowed),
   翻書網頁 (one HTML file to send to someone).
   Every export starts from a sheet: a copy of one spread made off screen at a fixed size, both pages showing, nothing editable.
   Pictures are drawn with html-to-image (libs/html-to-image.js, MIT) from those copies. Fonts are only ever drawn into
   pictures; no font file is ever written into an exported file. */
"use strict";

const XP=700;                   // css px of one page in a sheet; pictures are drawn at 2× (1400 px a page, about 240 dpi on A5)
let xStop=false;
const SAFARI=/^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);

/* ---------- sheets ---------- */
const xStage=document.createElement("div");xStage.className="x-stage";xStage.setAttribute("aria-hidden","true");document.body.appendChild(xStage);

/* ids inside a copy get a suffix, so many copies can live in one document (printing) without borrowing each other's gradients */
function uniqIds(c,k){
  const map={};for(const e of c.querySelectorAll("[id]")){map[e.id]=`${e.id}-x${k}`;e.id=map[e.id]}
  const re=/url\(\s*(["']?)#([^"')\s]+)\1\s*\)/g;
  for(const e of c.querySelectorAll("*")) for(const a of e.attributes){
    if((a.name==="href"||a.name==="xlink:href")&&a.value[0]==="#"){const id=a.value.slice(1);if(map[id]) a.value="#"+map[id]}
    else if(a.value.includes("url(")) a.value=a.value.replace(re,(m,q,id)=>map[id]?`url(#${map[id]})`:m);
  }
}
/* <use> pointing at a symbol outside the copy (the sprig) becomes a copy of that drawing, so pictures and prints carry it */
function inlineUses(c){
  for(const u of c.querySelectorAll("use")){
    const ref=(u.getAttribute("href")||u.getAttribute("xlink:href")||"").slice(1);if(!ref||c.querySelector(`[id="${ref}"]`)) continue;
    const sym=document.getElementById(ref);if(!sym) continue;
    const g=document.createElementNS("http://www.w3.org/2000/svg","svg");
    if(sym.getAttribute("viewBox")) g.setAttribute("viewBox",sym.getAttribute("viewBox"));
    g.setAttribute("width","100%");g.setAttribute("height","100%");g.innerHTML=sym.innerHTML;u.replaceWith(g);
  }
}
function cloneSpread(k){
  const c=spread.cloneNode(true);
  c.removeAttribute("id");c.classList.add("is-locked");c.dataset.show="both";
  c.querySelectorAll(".turn-ov,.o-sel,.o-warn,.o-add,.overflow-flag").forEach(e=>e.remove());
  c.querySelectorAll("[contenteditable]").forEach(e=>e.removeAttribute("contenteditable"));
  c.querySelectorAll(".is-over").forEach(e=>e.classList.remove("is-over"));
  c.querySelectorAll(".o-on,.o-cropping").forEach(e=>e.classList.remove("o-on","o-cropping"));
  c.querySelectorAll(".objs").forEach(e=>e.classList.add("is-locked"));
  c.querySelectorAll(".page").forEach(p=>p.removeAttribute("aria-label"));
  inlineUses(c);uniqIds(c,k);
  return c;
}
/* copies of the given spreads; the editor is put back exactly as it was */
function snapshot(list){
  if(typeof selId!=="undefined"&&selId) select(null);
  if(typeof cropId!=="undefined"&&cropId) endCrop();
  const keep=cur,out=[];
  for(const i of list){if(cur!==i){cur=i;renderSpread()}out.push(cloneSpread(i))}
  if(cur!==keep){cur=keep;renderSpread()}
  return out;
}
function mount(c,width,host){
  const b=document.createElement("div");b.className="book x-book";b.dataset.show="both";b.style.width=width;
  b.appendChild(c);(host||xStage).appendChild(b);return b;
}

/* ---------- drawing a sheet into a picture ---------- */
let libP=null;
function libReady(){
  if(window.htmlToImage) return Promise.resolve();
  return libP=libP||new Promise((res,rej)=>{const s=document.createElement("script");s.src="libs/html-to-image.js";
    s.onload=()=>res();s.onerror=()=>{libP=null;rej(new Error("lib"))};document.head.appendChild(s)});
}
const fontData=new Map();   // font url (or user font id) → data: URL, kept for the session
const blobData=bl=>new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=rej;f.readAsDataURL(bl)});
function fontURL(url){
  if(!fontData.has(url)) fontData.set(url,fetch(url).then(r=>{if(!r.ok) throw new Error(r.status);return r.blob()}).then(blobData).catch(e=>{fontData.delete(url);throw e}));
  return fontData.get(url);
}
let rulesP=null;
/* every @font-face the page knows; Google's stylesheet cannot be read across origins, so its text is fetched and parsed here */
function fontRules(){
  return rulesP=rulesP||(async()=>{
    const out=[];
    const walk=(rules,base)=>{for(const r of rules){if(r instanceof CSSFontFaceRule) out.push({r,base});else if(r.styleSheet) try{walk(r.styleSheet.cssRules,r.styleSheet.href||base)}catch(e){}}};
    for(const sh of document.styleSheets){
      const base=sh.href||location.href;
      try{walk(sh.cssRules,base)}
      catch(e){try{const t=await (await fetch(sh.href)).text(),css=new CSSStyleSheet();css.replaceSync(t);walk(css.cssRules,base)}catch(e2){}}
    }
    if(!out.length) rulesP=null;
    return out;
  })();
}
async function fontCSS(node){
  const fams=new Set(),backs=new Set(),chars=new Set();      // first choices; fallbacks (only their sliced parts are taken)
  for(const el of [node,...node.querySelectorAll("*")]){const l=getComputedStyle(el).fontFamily.split(",").map(f=>f.trim().replace(/["']/g,"")).filter(Boolean);
    if(l[0]) fams.add(l[0]);for(const f of l.slice(1)) backs.add(f)}
  for(const ch of node.textContent) chars.add(ch.codePointAt(0));
  for(const ch of "0123456789./–-·") chars.add(ch.codePointAt(0));
  const hit=ur=>ur.split(",").some(p=>{const m=p.trim().replace(/^U\+/i,"").split("-");let a,b;
    if(m[0].includes("?")){a=parseInt(m[0].replace(/\?/g,"0"),16);b=parseInt(m[0].replace(/\?/g,"F"),16)}else{a=parseInt(m[0],16);b=m[1]?parseInt(m[1],16):a}
    for(const c of chars) if(c>=a&&c<=b) return true;return false});
  const jobs=[];
  for(const {r,base} of await fontRules()){
    const fam=r.style.getPropertyValue("font-family").replace(/["']/g,"").trim(),ur=r.style.getPropertyValue("unicode-range");
    if(!fams.has(fam)&&!(ur&&backs.has(fam))) continue;
    if(ur&&!hit(ur)) continue;
    const m=r.cssText.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);if(!m) continue;
    jobs.push(fontURL(new URL(m[1],base).href).then(d=>r.cssText.replace(m[0],`url("${d}")`)).catch(()=>""));
  }
  /* fonts of your own: drawn into the picture from this browser's copy, never written out as a file */
  for(const f of userFonts){const fam=ufFamily(f.id);if(!fams.has(fam)) continue;
    if(!fontData.has(f.id)) fontData.set(f.id,Store.get("font:"+f.id).then(buf=>blobData(new Blob([buf]))));
    jobs.push(fontData.get(f.id).then(d=>`@font-face{font-family:'${fam}';src:url("${d}")}`).catch(()=>""));
  }
  return (await Promise.all(jobs)).join("\n");
}
/* html-to-image copies ::before/::after but not ::first-letter (the drop cap): make it a real element */
function firstLetters(b){
  for(const el of b.querySelectorAll(".val > p:first-child")){
    const fl=getComputedStyle(el,"::first-letter");if(fl.float==="none"&&fl.fontSize===getComputedStyle(el).fontSize) continue;
    const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let t=w.nextNode();while(t&&!t.data.trim()) t=w.nextNode();if(!t) continue;
    const i=t.data.search(/\S/),ch=String.fromCodePoint(t.data.codePointAt(i)),rest=t.splitText(i);rest.data=rest.data.slice(ch.length);
    const sp=document.createElement("span");sp.textContent=ch;
    for(const k of ["float","font-family","font-weight","font-style","font-size","line-height","margin-top","margin-right","margin-bottom","margin-left","padding-top","padding-right","padding-bottom","padding-left","color","vertical-align"]) sp.style.setProperty(k,fl.getPropertyValue(k));
    rest.before(sp);el.classList.add("x-fl");
  }
}
async function draw(b,pr,fibre){
  await libReady();
  firstLetters(b);
  /* svg parts coloured with var(): give them their plain colours, the picture cannot see the page's variables */
  for(const el of b.querySelectorAll("svg [style*='var(']")){const cs=getComputedStyle(el);
    el.setAttribute("style",el.getAttribute("style").replace(/(fill|stroke|stop-color)\s*:\s*([^;]*var\([^;]*)/g,(m,p)=>`${p}:${cs.getPropertyValue(p)}`))}
  const opt={pixelRatio:pr,skipFonts:true,fontEmbedCSS:await fontCSS(b),cacheBust:false,
    width:b.offsetWidth,height:b.offsetHeight,filter:n=>!(n.classList&&n.classList.contains("grain"))};
  if(SAFARI) try{await htmlToImage.toCanvas(b,opt)}catch(e){}     // Safari paints images inside the picture only on the second pass
  const cv=await htmlToImage.toCanvas(b,opt);
  return fibre?grain(b,cv,pr):cv;
}
/* the paper's fibre is a blend layer html-to-image cannot draw; it is laid over the finished picture instead.
   Only for JPEG/WebP pictures: in a PNG the noise makes the file several times bigger. */
let grainImg=null;
async function grain(b,cv,pr){
  const g=b.querySelector(".grain");if(!g) return cv;
  const cs=getComputedStyle(g);if(cs.display==="none") return cv;
  const urls=[...cs.backgroundImage.matchAll(/url\("((?:[^"\\]|\\.)*)"\)/g)].map(m=>m[1].replace(/\\(.)/g,"$1")).filter(u=>u.startsWith("data:image/svg+xml"));
  if(!urls.length) return cv;
  try{
    grainImg=grainImg||new Map();
    const ctx=cv.getContext("2d"),op=parseFloat(cs.opacity)||1;
    for(const u of urls.reverse()){
      if(!grainImg.has(u)) grainImg.set(u,await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=u}));
      const im=grainImg.get(u),sz=cs.backgroundSize.split(",")[0].trim();
      let tw=(im.naturalWidth||180)*pr,th=(im.naturalHeight||180)*pr;
      const m=sz.match(/^([\d.]+)px(?:\s+([\d.]+)px)?/);if(m){tw=+m[1]*pr;th=(m[2]?+m[2]:+m[1]*(im.naturalHeight/im.naturalWidth||1))*pr}
      const tile=document.createElement("canvas");tile.width=Math.max(1,Math.round(tw));tile.height=Math.max(1,Math.round(th));tile.getContext("2d").drawImage(im,0,0,tile.width,tile.height);
      ctx.save();ctx.globalAlpha=op;ctx.globalCompositeOperation="multiply";ctx.fillStyle=ctx.createPattern(tile,"repeat");
      for(const p of b.querySelectorAll(".page")){const r=p.getBoundingClientRect(),o=b.getBoundingClientRect();ctx.fillRect((r.left-o.left)*pr,(r.top-o.top)*pr,r.width*pr,r.height*pr)}
      ctx.restore();
    }
  }catch(e){}
  return cv;
}
/* one part of a picture on its own canvas, on white (JPEG has no transparency) */
function crop(cv,x,w){const c=document.createElement("canvas");c.width=w;c.height=cv.height;const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,w,c.height);g.drawImage(cv,x,0,w,cv.height,0,0,w,cv.height);return c}
const halves=cv=>{const h=Math.round(cv.width/2);return [crop(cv,0,h),crop(cv,h,cv.width-h)]};
const toBlob=(cv,type,q)=>new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error("blob")),type,q));
async function compact(cv){   // the smallest picture the browser can make: WebP where it can, JPEG otherwise
  let d=cv.toDataURL("image/webp",.84);if(!d.startsWith("data:image/webp")) d=cv.toDataURL("image/jpeg",.86);return d}

/* ---------- files ---------- */
function stem(){return diaryName().replace(/[\\/:*?"<>|]+/g,"").trim()||"Exchange Diary"}
function saveFile(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000);return url}
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){let c=~0;for(let i=0;i<u.length;i++) c=CRC[(c^u[i])&255]^(c>>>8);return ~c>>>0}
/* a plain zip (stored, not compressed: pictures are compressed already) */
async function zipOf(files){
  const enc=new TextEncoder(),parts=[],central=[],d=new Date();let off=0;
  const tm=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  for(const [name,blob] of files){
    const data=new Uint8Array(await blob.arrayBuffer()),nm=enc.encode(name),crc=crc32(data);
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(10,tm,true);h.setUint16(12,dt,true);
    h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nm.length,true);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(12,tm,true);c.setUint16(14,dt,true);
    c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    parts.push(h,nm,data);central.push(c,nm);off+=30+nm.length+data.length;
  }
  const size=central.reduce((s,x)=>s+x.byteLength,0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,e],{type:"application/zip"});
}
/* a PDF of JPEG pictures, one picture a page, page size in mm */
function pdfOf(pics,wmm,hmm,title){
  const enc=new TextEncoder(),chunks=[],offs=[];let len=0;
  const put=x=>{const u=typeof x==="string"?enc.encode(x):x;chunks.push(u);len+=u.length};
  const pt=mm=>(mm*72/25.4).toFixed(2),W=pt(wmm),H=pt(hmm),n=pics.length;
  const start=id=>{offs[id]=len;put(`${id} 0 obj\n`)};
  put("%PDF-1.4\n%âãÏÓ\n");
  start(1);put("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  start(2);put(`<< /Type /Pages /Count ${n} /Kids [${pics.map((_,k)=>`${3+k*3} 0 R`).join(" ")}] >>\nendobj\n`);
  pics.forEach((p,k)=>{const pg=3+k*3,ct=pg+1,im=pg+2,s=`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    start(pg);put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>\nendobj\n`);
    start(ct);put(`<< /Length ${s.length} >>\nstream\n${s}\nendstream\nendobj\n`);
    start(im);put(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`);put(p.jpg);put("\nendstream\nendobj\n")});
  const info=3+n*3,hex=[...String(title||"")].map(ch=>{const c=ch.codePointAt(0);if(c<0x10000) return c.toString(16).padStart(4,"0");const v=c-0x10000;return ((v>>10)+0xD800).toString(16)+((v&0x3FF)+0xDC00).toString(16)}).join("");
  start(info);put(`<< /Title <FEFF${hex}> /Producer (Exchange Diary) >>\nendobj\n`);
  const x=len;put(`xref\n0 ${info+1}\n0000000000 65535 f \n`+offs.slice(1).map(o=>String(o).padStart(10,"0")+" 00000 n \n").join(""));
  put(`trailer\n<< /Size ${info+1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${x}\n%%EOF\n`);
  return new Blob(chunks,{type:"application/pdf"});
}
async function jpgOf(cv){return {jpg:new Uint8Array(await (await toBlob(cv,"image/jpeg",.9)).arrayBuffer()),w:cv.width,h:cv.height}}

/* ---------- dialogs ---------- */
const xseg=(name,opts,val)=>`<div class="slide" data-name="${name}"><i class="thumb" aria-hidden="true"></i>${opts.map(([v,t])=>`<button type="button" data-v="${v}" aria-pressed="${v===val}">${t}</button>`).join("")}</div>`;
function wireSegs(onchange){
  dlg.querySelectorAll(".slide[data-name]").forEach(s=>{slideSync(s);
    s.addEventListener("click",e=>{const b=e.target.closest("button");if(!b) return;s.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));slideSync(s);onchange&&onchange()})});
  onchange&&onchange();
}
const segVal=name=>{const b=dlg.querySelector(`.slide[data-name="${name}"] [aria-pressed="true"]`);return b&&b.dataset.v};
const row=(cap,html,cls="")=>`<div class="x-row ${cls}"><span class="cap">${cap}</span>${html}</div>`;
function closeMenus(){document.querySelectorAll(".menu").forEach(m=>{m.hidden=true;m.previousElementSibling.setAttribute("aria-expanded","false")})}
const allIdx=()=>book.spreads.map((_,i)=>i);
const curPerson=()=>{const v=effShow();return v==="both"?panelWho:v};

/* progress while pictures are made; closing the dialog stops the work */
function progress(title){
  xStop=false;
  openDialog(`<h2 id="dlg-title">${title}</h2><p id="x-msg">準備中…</p><div class="x-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="x-fill"></i></div>
    <div class="row"><button type="button" class="btn quiet" data-act="no">取消</button></div>`,()=>{xStop=true});
  dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);
  return (k,n,msg)=>{const f=$("#x-fill");if(!f) return;f.style.width=`${Math.round(k/n*100)}%`;f.parentNode.setAttribute("aria-valuenow",String(Math.round(k/n*100)));$("#x-msg").textContent=msg||`正在處理第 ${Math.min(k+1,n)} / ${n} 個跨頁…`};
}
/* draw each spread in turn; fn(canvas, spread index) */
async function eachPicture(idx,title,pr,fn,fibre){
  const step=progress(title);
  try{
    await libReady();
    for(let k=0;k<idx.length;k++){
      if(xStop) return false;
      step(k,idx.length);
      /* laid out at the width the page has on screen, so lines break exactly where the writer saw them; drawn larger instead */
      const live=pages.find(p=>p.offsetParent),w=live?Math.max(240,Math.round(live.getBoundingClientRect().width)):XP;
      const [c]=snapshot([idx[k]]),b=mount(c,`${w*2}px`);
      try{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(r));await fn(await draw(b,pr*XP/w,fibre),idx[k])}finally{b.remove()}
    }
    step(idx.length,idx.length,"完成");
    return !xStop;
  }catch(e){
    if(!xStop){closeDialog(false);openDialog(`<h2 id="dlg-title">沒有完成</h2><p>${e&&e.message==="lib"?"畫圖片的工具沒有載入成功，請確認網路連線後再試一次。":"製作圖片時出了問題。可以重新整理頁面再試一次；如果一直失敗，請改用「PDF」。"}</p>
      <div class="row"><button type="button" class="btn solid" data-act="ok">知道了</button></div>`);dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(true)}
    return false;
  }
}
function finished(title,text,preview){
  closeDialog(true);
  openDialog(`<h2 id="dlg-title">${title}</h2><p>${text}</p>${preview?`<img class="x-prev" src="${preview}" alt="輸出的圖片">`:""}
    <div class="row"><button type="button" class="btn solid" data-act="ok">完成</button></div>`);
  dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(true);
}

/* ---------- 圖片 ---------- */
$("#out-png").addEventListener("click",()=>{closeMenus();
  const n=book.spreads.length,p=curPerson();
  openDialog(`<h2 id="dlg-title">存成圖片</h2>
    <p>存成 PNG 圖片，適合傳給朋友或放上社群。圖片和畫面上看到的一樣（不含編輯用的提示）。</p>
    ${row("範圍",xseg("range",[["page","這一頁"],["spread","這個跨頁"],["all","整本"]],"spread"))}
    ${row("哪一頁",xseg("who",[["them","他的日記"],["me","我的日記"]],p),"x-who")}
    ${row("每張",xseg("form",[["spread","一個跨頁"],["page","一頁"]],"spread"),"x-form")}
    <p class="x-note" id="x-note"></p>
    <div class="row"><button type="button" class="btn quiet" data-act="no">取消</button><button type="button" class="btn solid" data-act="yes">存成圖片</button></div>`);
  const sync=()=>{const r=segVal("range");dlg.querySelector(".x-who").hidden=r!=="page";dlg.querySelector(".x-form").hidden=r!=="all";
    dlg.querySelectorAll(".slide[data-name]").forEach(slideSync);
    $("#x-note").textContent=r==="all"?`整本 ${n} 個跨頁，會下載一個 .zip 壓縮檔，裡面是 ${segVal("form")==="page"?n*2:n} 張圖片。`:"會下載一張 PNG 圖片。"};
  wireSegs(sync);
  dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);
  dlg.querySelector('[data-act="yes"]').onclick=()=>{const r=segVal("range");pngExport(r,r==="page"?segVal("who"):null,segVal("form"))};
});
async function pngExport(range,person,form){
  const files=[],name=stem(),one=range!=="all";
  const ok=await eachPicture(one?[cur]:allIdx(),"正在製作圖片",2,async(cv,i)=>{
    if(range==="page"){const side=who(person),[L,R]=halves(cv);files.push([`${name} No.${pad(i+1)} ${PERSON[person]}.png`,await toBlob(side==="them"?L:R,"image/png")]);return}
    if(form==="page"&&!one){const [L,R]=halves(cv);files.push([`${pad(i*2+1)}.png`,await toBlob(L,"image/png")],[`${pad(i*2+2)}.png`,await toBlob(R,"image/png")])}
    else files.push([one?`${name} No.${pad(i+1)}.png`:`No.${pad(i+1)}.png`,await toBlob(cv,"image/png")]);
  });
  if(!ok) return;
  if(one){const url=saveFile(files[0][1],files[0][0]);
    finished("圖片已存好",`已開始下載「${esc(files[0][0])}」。如果沒有開始下載，可以在下面的圖片上按右鍵（手機請長按）另存圖片。`,url)}
  else{const z=await zipOf(files),zn=`${name}.zip`;saveFile(z,zn);
    finished("圖片已存好",`已開始下載「${esc(zn)}」（${(z.size/1048576).toFixed(1)} MB，共 ${files.length} 張）。解壓縮後就是一張張的 PNG 圖片，檔名就是頁碼或跨頁編號。`)}
}

/* ---------- PDF: the browser's print window, saved as PDF ---------- */
function pdfSteps(first){
  const ua=navigator.userAgent;
  const dest=IOS?"在列印畫面用兩指把預覽頁<b>放大</b>，再按右上角的<b>分享</b> → <b>儲存到「檔案」</b>。"
    :SAFARI?"在列印視窗左下角按 <b>PDF ▾</b> → 選 <b>儲存為 PDF</b>。"
    :/Firefox\//.test(ua)?"「目的地」選 <b>儲存為 PDF</b>。"
    :/Android/.test(ua)?"在最上面選印表機的地方，選 <b>儲存為 PDF</b>，再按 <b>PDF</b> 圖示。"
    :/Edg\//.test(ua)?"「印表機」選 <b>另存為 PDF</b>。":"「目的地」選 <b>另存為 PDF</b>。";
  return `<ol class="x-steps">
    <li>${first||"按下面的「開啟列印視窗」。"}</li>
    <li>${dest}</li>
    <li>${IOS?"如果預覽看起來被裁切，回上一步把紙張改成對應的大小。":`打開「更多設定」確認：<b>邊界：無</b>、<b>縮放：預設（100%）</b>、勾選<b>背景圖形</b>。紙張大小會自動帶入，不用改。`}</li>
    <li>${IOS?"選好要存放的資料夾，按<b>儲存</b>。":"按<b>儲存</b>，選好要存放的資料夾。"}</li></ol>`;
}
$("#out-pdf").addEventListener("click",()=>{closeMenus();
  const n=book.spreads.length;
  openDialog(`<h2 id="dlg-title">存成 PDF</h2>
    <p>用瀏覽器的列印功能存成 PDF：文字是真正的文字（可以搜尋、放大也清楚），適合保存或拿去列印。</p>
    ${row("範圍",xseg("range",[["spread","這個跨頁"],["all","整本"]],"spread"))}
    ${row("版面",xseg("form",[["spread","跨頁"],["page","單頁"]],"spread"))}
    <p class="x-note" id="x-note"></p>
    <h3 class="x-h">接下來的步驟</h3>${pdfSteps()}
    <div class="row"><button type="button" class="link x-alt" data-act="img">列印視窗打不開？改存圖片版 PDF（僅供螢幕閱讀）</button><span class="x-sp"></span><button type="button" class="btn quiet" data-act="no">取消</button><button type="button" class="btn solid" data-act="yes">開啟列印視窗</button></div>`);
  wireSegs(()=>{$("#x-note").textContent=(segVal("range")==="all"?`整本 ${n} 個跨頁，`:"")+(segVal("form")==="page"?"每一頁一張紙，A5 大小（148 × 210 mm）。":"左右兩頁放在同一張紙上，296 × 210 mm（差不多是 A4 橫放）。")});
  dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);
  dlg.querySelector('[data-act="yes"]').onclick=()=>printPDF(segVal("range"),segVal("form"));
  dlg.querySelector('[data-act="img"]').onclick=()=>imagePDF(segVal("range"),segVal("form"));
});
async function printPDF(range,form){
  const idx=range==="all"?allIdx():[cur];
  closeDialog(true);
  document.getElementById("print-root")?.remove();document.getElementById("print-page")?.remove();
  const root=document.createElement("div");root.id="print-root";root.setAttribute("aria-hidden","true");
  snapshot(idx).forEach(c=>{
    if(form==="page") for(const side of [0,1]){   // one page alone in a narrow copy, so nothing is wider than the paper
        const one=side?c:c.cloneNode(true);one.classList.add("x-one");one.querySelectorAll(".page")[side?0:1].remove();
        if(!side) uniqIds(one,"a");
        const pp=document.createElement("div");pp.className="pp pp-page";root.appendChild(pp);mount(one,"148mm",pp)}
    else{const pp=document.createElement("div");pp.className="pp pp-spread";root.appendChild(pp);mount(c,"296mm",pp)}
  });
  document.body.appendChild(root);
  const st=document.createElement("style");st.id="print-page";st.textContent=`@page{size:${form==="page"?"148mm 210mm":"296mm 210mm"};margin:0}`;document.head.appendChild(st);
  toast("正在準備列印…");
  try{await document.fonts.ready}catch(e){}
  await Promise.all([...root.querySelectorAll("img")].map(im=>im.decode?im.decode().catch(()=>{}):0));
  await new Promise(r=>setTimeout(r,250));
  document.body.classList.add("printing");
  let fired=false;const on=()=>{fired=true};addEventListener("beforeprint",on);
  const cleanup=()=>{removeEventListener("afterprint",cleanup);document.body.classList.remove("printing");root.remove();st.remove();$("#toast").hidden=true};
  addEventListener("afterprint",cleanup);
  try{window.print()}catch(e){}
  setTimeout(()=>{removeEventListener("beforeprint",on);
    if(!fired){cleanup();
      openDialog(`<h2 id="dlg-title">列印視窗打不開</h2><p>現在開啟工具的地方（例如預覽框）不允許開啟列印視窗。可以改存「圖片版 PDF」：版面和字體完全一樣，但文字不能選取、檔案比較大。<b>僅供螢幕閱讀，不適合送印。</b></p>
        <div class="row"><button type="button" class="btn quiet" data-act="no">取消</button><button type="button" class="btn solid" data-act="yes">存圖片版 PDF</button></div>`);
      dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);dlg.querySelector('[data-act="yes"]').onclick=()=>imagePDF(range,form)}
  },600);
}
async function imagePDF(range,form){
  const pics=[],idx=range==="all"?allIdx():[cur];
  const ok=await eachPicture(idx,"正在製作 PDF",2,async cv=>{
    if(form==="page"){const [L,R]=halves(cv);pics.push(await jpgOf(L),await jpgOf(R))}else pics.push(await jpgOf(crop(cv,0,cv.width)))},true);
  if(!ok) return;
  const name=`${stem()}${range==="all"?"":` No.${pad(cur+1)}`}.pdf`,pdf=pdfOf(pics,form==="page"?148:296,210,diaryName());
  saveFile(pdf,name);
  finished("PDF 已存好",`已開始下載「${esc(name)}」（${(pdf.size/1048576).toFixed(1)} MB）。這是圖片版 PDF，每一頁都是一張圖片，僅供螢幕閱讀，不適合送印。`);
}

/* ---------- 翻書網頁: one HTML file with every page as a picture ---------- */
$("#out-book").addEventListener("click",()=>{closeMenus();
  const n=book.spreads.length;
  openDialog(`<h2 id="dlg-title">翻書網頁</h2>
    <p>把整本日記做成一個 HTML 檔，傳給對方後用瀏覽器打開就能一頁一頁翻（電腦上像翻書，手機上左右滑）。不需要網路，也不需要安裝任何東西。</p>
    <p>每一頁會存成圖片放進檔案裡，字體不會被放進去，所以用自己上傳的字體也可以安心分享。檔案大約 ${Math.max(1,Math.round(n*.7))}–${Math.max(2,Math.round(n*1.3))} MB（${n} 個跨頁，照片多會比較大）。</p>
    <div class="row"><button type="button" class="btn quiet" data-act="no">取消</button><button type="button" class="btn solid" data-act="yes">製作翻書網頁</button></div>`);
  dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);
  dlg.querySelector('[data-act="yes"]').onclick=bookExport;
});
async function bookExport(){
  const pages=[];
  const ok=await eachPicture(allIdx(),"正在製作翻書網頁",1.6,async(cv,i)=>{const [L,R]=halves(cv),s=book.spreads[i];
    pages.push({l:await compact(L),r:await compact(R),no:`No. ${pad(i+1)}`,d:spreadDate(s,true),
      a:[`${PERSON[who("them")]}的日記`,`${PERSON[who("me")]}的日記`]})},true);
  if(!ok) return;
  let logo="";try{logo=await blobData(await (await fetch("logo.png")).blob())}catch(e){}
  const html=flipHTML({title:diaryName(),sub:"",cover:getComputedStyle($("#book")).backgroundColor,pages,logo});
  const blob=new Blob([html],{type:"text/html"}),name=`${stem()}.html`;saveFile(blob,name);
  finished("翻書網頁已存好",`已開始下載「${esc(name)}」（${(blob.size/1048576).toFixed(1)} MB）。把這個檔案傳給對方（LINE、Email、雲端硬碟都可以），對方下載後用瀏覽器打開就能翻閱。`);
}
function flipHTML(d){
  const data=JSON.stringify({...d,logo:undefined}).replace(/</g,"\\u003c");
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.title)}</title>
<style>
:root{--bg:#ece6dc;--ink:#2b2724;--muted:#7a7068;--line:#cfc5b6}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Serif TC","Songti TC","PMingLiU",serif}
body{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:28px 16px 40px}
header{text-align:center;margin-bottom:18px}
h1{font-size:clamp(22px,4vw,34px);font-weight:600;letter-spacing:.06em;margin:0}
.sub{color:var(--muted);margin:6px 0 0;font-size:15px}
.info{display:flex;gap:14px;justify-content:center;align-items:baseline;margin-top:12px;color:var(--muted);font-size:14px;font-family:system-ui,sans-serif}
.info b{color:var(--ink);font-weight:600;letter-spacing:.06em}
.book{position:relative;width:min(100%,1100px,calc((100vh - 220px) * 1.43));padding:1.1%;background:${d.cover};border-radius:6px;box-shadow:0 18px 36px -16px rgba(60,40,20,.45)}
.sp{position:relative;display:grid;grid-template-columns:1fr 1fr;aspect-ratio:296/210;perspective:2600px}
.sp img,.ov img{display:block;width:100%;height:100%;object-fit:cover;user-select:none;-webkit-user-drag:none}
.ov{position:absolute;inset:0;pointer-events:none}
.slot,.leaf{position:absolute;top:0;bottom:0;width:50%}
.l{left:0}.r{right:0}
.leaf{transform-style:preserve-3d;transition:transform .8s cubic-bezier(.45,.05,.25,1)}
.leaf.r{transform-origin:0 50%}.leaf.l{transform-origin:100% 50%}
.go .leaf.r{transform:rotateY(-180deg)}.go .leaf.l{transform:rotateY(180deg)}
.face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.back{transform:rotateY(180deg)}
.face::after{content:"";position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,.18),transparent 40%);opacity:0;transition:opacity .8s}
.go .front::after{opacity:1}
.nav{display:flex;gap:12px;justify-content:center;align-items:center;margin-top:18px;font-family:system-ui,sans-serif}
button{font:inherit;font-size:15px;border:1px solid var(--ink);background:transparent;color:var(--ink);border-radius:999px;min-width:44px;min-height:44px;padding:6px 18px;cursor:pointer}
button:disabled{opacity:.35;cursor:default}
button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.cnt{min-width:7em;text-align:center;color:var(--muted);font-size:14px}
footer{margin-top:auto;padding-top:36px;display:flex;justify-content:center}
footer i{display:block;width:180px;max-width:50vw;aspect-ratio:860/130;background:var(--ink);-webkit-mask:var(--logo) center/contain no-repeat;mask:var(--logo) center/contain no-repeat;opacity:.12}
@media (max-width:720px){
  .book{width:min(100%,460px,calc((100vh - 240px) * .72));padding:2%}
  .sp{grid-template-columns:1fr;aspect-ratio:148/210;overflow:hidden}
  .sp img.hide{display:none}
  .ov .one{position:absolute;inset:0;transition:transform .45s ease,opacity .45s ease}
  .go.next .one{transform:translateX(-35%);opacity:0}.go.prev .one{transform:translateX(35%);opacity:0}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body>
<header><h1 id="t"></h1><p class="sub" id="s"></p><div class="info"><b id="no"></b><span id="dt"></span></div></header>
<main class="book"><div class="sp" id="sp"><img id="L" alt=""><img id="R" alt=""></div></main>
<nav class="nav" aria-label="翻頁"><button type="button" id="prev" aria-label="上一頁">‹</button><span class="cnt" id="cnt" aria-live="polite"></span><button type="button" id="next" aria-label="下一頁">›</button></nav>
${d.logo?`<footer><i role="img" aria-label="Crafted by YuanLiv" style="--logo:url('${d.logo}')"></i></footer>`:""}
<script id="data" type="application/json">${data}</script>
<script>
"use strict";
var D=JSON.parse(document.getElementById("data").textContent),P=D.pages,ONE=matchMedia("(max-width:720px)"),RM=matchMedia("(prefers-reduced-motion: reduce)");
var at=0,busy=false;   /* at = page number from 0 (left of spread 0, right of spread 0, left of spread 1, …) */
var $=function(id){return document.getElementById(id)};
$("t").textContent=D.title;$("s").textContent=D.sub;$("s").hidden=!D.sub;document.title=D.title;
function src(k){var s=P[k>>1];return k%2?s.r:s.l}
function show(){
  var i=at>>1,s=P[i],one=ONE.matches;
  $("L").src=s.l;$("R").src=s.r;$("L").alt=s.no+" 左頁："+s.a[0];$("R").alt=s.no+" 右頁："+s.a[1];
  $("L").className=one&&at%2?"hide":"";$("R").className=one&&!(at%2)?"hide":"";
  $("no").textContent=s.no;$("dt").textContent=s.d||"";
  $("cnt").textContent=one?(at+1)+" / "+P.length*2+" 頁":(i+1)+" / "+P.length;
  $("prev").disabled=one?at===0:i===0;$("next").disabled=one?at===P.length*2-1:i===P.length-1;
}
function img(u){var m=new Image();m.src=u;m.alt="";return m}
function go(dir){
  if(busy)return;var one=ONE.matches,from=at,to;
  if(one){to=at+dir;if(to<0||to>=P.length*2)return}else{to=((at>>1)+dir)*2;if(to<0||to>=P.length*2)return}
  var sp=$("sp"),ov=null;
  if(!RM.matches){
    ov=document.createElement("div");ov.className="ov";
    if(one){var c=document.createElement("div");c.className="one";c.appendChild(img(src(from)));ov.appendChild(c);ov.classList.add(dir>0?"next":"prev")}
    else{var i=from>>1,stay=document.createElement("div");stay.className="slot "+(dir>0?"l":"r");stay.appendChild(img(dir>0?P[i].l:P[i].r));
      var leaf=document.createElement("div");leaf.className="leaf "+(dir>0?"r":"l");
      var f=document.createElement("div");f.className="face front";f.appendChild(img(dir>0?P[i].r:P[i].l));
      var b=document.createElement("div");b.className="face back";b.appendChild(img(dir>0?P[to>>1].l:P[to>>1].r));
      leaf.appendChild(f);leaf.appendChild(b);ov.appendChild(stay);ov.appendChild(leaf)}
  }
  at=to;show();if(!ov)return;
  sp.appendChild(ov);busy=true;
  requestAnimationFrame(function(){requestAnimationFrame(function(){ov.classList.add("go")})});
  var done=function(){if(ov.parentNode)ov.remove();busy=false};
  ov.addEventListener("transitionend",function(e){if(e.target.classList.contains("leaf")||e.target.classList.contains("one"))done()});
  setTimeout(done,1100);
}
$("prev").onclick=function(){go(-1)};$("next").onclick=function(){go(1)};
addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key==="PageDown"){e.preventDefault();go(1)}if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();go(-1)}});
var sw=null,sp=$("sp");
sp.addEventListener("touchstart",function(e){if(e.touches.length===1)sw={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()}},{passive:true});
sp.addEventListener("touchend",function(e){if(!sw)return;var t=e.changedTouches[0],dx=t.clientX-sw.x,dy=t.clientY-sw.y,fast=Date.now()-sw.t<700;sw=null;
  if(fast&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)go(dx<0?1:-1)},{passive:true});
sp.addEventListener("click",function(e){var r=sp.getBoundingClientRect();go(e.clientX-r.left<r.width/2?-1:1)});
(ONE.addEventListener?ONE.addEventListener("change",function(){if(!ONE.matches)at=at&~1;show()}):0);
show();
</script></body></html>`;
}
