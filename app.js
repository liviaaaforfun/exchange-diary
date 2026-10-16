/* Exchange Diary — editor (phase 1: spreads, paste, editing, lock & revise, overflow, autosave, backup files) */
"use strict";

/* ---------- fields ---------- */
const FIELDS=["date","weather","mood","diary","say","q","ans","notes"];   // notes are kept for later (sticky notes, photo captions), not shown on the page yet
const MULTI=new Set(["diary","say","notes"]);               // fields that keep line breaks
const FIELD_NAMES={date:"日期",weather:"天氣",mood:"心情",diary:"日記",say:"想對你說",q:"快問快答",ans:"回答"};
const PH={date:"2026/10/09",weather:"天氣",mood:"一句心情小語",diary:"在這裡寫日記…",say:"想對對方說的話",q:"問對方一個問題",ans:"回答…"};

const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const blankSide=()=>Object.fromEntries(FIELDS.map(f=>[f,""]));

document.documentElement.lang="zh-Hant-TW";
/* ---------- storage ----------
   One place per browser, decided once when the page opens: IndexedDB. Earlier versions quietly switched to localStorage
   whenever IndexedDB hiccuped, which could split a diary between two places and show an empty book. Now:
   · IndexedDB opens (with retries) → it is the only place used; a failed step is retried on a fresh connection, never sent elsewhere
   · IndexedDB is missing altogether → localStorage
   · IndexedDB is there but fails to open → "none": nothing is read from or written anywhere else, the page keeps retrying
     and reloads itself once the database opens (it must never show whatever an older version left in localStorage) */
const Store=(()=>{
  const DBN="exchange-diary",ST="kv",LP=DBN+":";let dbp=null,mode="",cur=null;
  /* let go of the database when the page goes away, so the next page (a reload, a new version) can open it straight away */
  addEventListener("pagehide",()=>{try{cur&&cur.close()}catch(e){}cur=null;dbp=null});
  /* a small trace of storage trouble, kept outside the diary so it can be read even when the database will not open */
  const trace=e=>{try{const a=JSON.parse(localStorage.getItem("ed-trace")||"[]");a.push([Date.now(),String(e&&e.name||e)+": "+String(e&&e.message||"").slice(0,90)]);localStorage.setItem("ed-trace",JSON.stringify(a.slice(-10)))}catch(x){}};
  const errs=[];const note=e=>{trace(e);if(errs.length<8) errs.push(String(e&&e.name||e)+": "+String(e&&e.message||"").slice(0,90))};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const openOnce=()=>new Promise((res,rej)=>{let r;try{r=indexedDB.open(DBN,1)}catch(e){rej(e);return}
    const t=setTimeout(()=>rej(new Error("open timed out")),8000);
    r.onupgradeneeded=()=>r.result.createObjectStore(ST);
    r.onsuccess=()=>{clearTimeout(t);const db=r.result;db.onversionchange=()=>{db.close();dbp=null};db.onclose=()=>{dbp=null};cur=db;res(db)};
    r.onerror=()=>{clearTimeout(t);rej(r.error)};r.onblocked=()=>note(new Error("open blocked"))});
  async function openDB(){
    if(dbp) return dbp;
    for(let i=0;i<3;i++){try{dbp=Promise.resolve(await openOnce());return dbp}catch(e){note(e);dbp=null;await wait(300*(i+1))}}
    throw new Error("IndexedDB unavailable");
  }
  const lsKeys=()=>{try{return Object.keys(localStorage).filter(k=>k.startsWith(LP)).map(k=>k.slice(LP.length))}catch(e){return []}};
  const lsGet=k=>{try{const v=localStorage.getItem(LP+k);return v?JSON.parse(v):undefined}catch(e){return undefined}};
  async function ready(){
    if(mode) return mode;
    if(typeof indexedDB==="undefined"||!indexedDB){mode="local";return mode}
    try{await openDB();mode="idb"}
    catch(e){mode="none";
      /* keep trying quietly; the moment the database opens, start over with the real diary */
      (async()=>{for(let i=0;i<40;i++){await wait(1500);try{await openOnce();location.reload();return}catch(x){}}})()}
    return mode;
  }
  /* one IndexedDB step; if the connection was lost (it happens on phones after the app was in the background), reopen and try once more */
  async function run(kind,fn){
    for(let i=0;i<2;i++){
      try{const db=await openDB();return await new Promise((res,rej)=>{const tx=db.transaction(ST,kind);let out;
        const q=fn(tx.objectStore(ST));if(q) q.onsuccess=()=>{out=q.result};
        tx.oncomplete=()=>res(out);tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error("aborted"))})}
      catch(e){note(e);dbp=null;if(i) throw e;await wait(200)}
    }
  }
  async function get(k){await ready();
    if(mode==="local") return lsGet(k);if(mode!=="idb") throw new Error("storage unavailable");
    return run("readonly",st=>st.get(k))}
  async function set(k,v){await ready();
    if(mode==="local"){try{localStorage.setItem(LP+k,JSON.stringify(v));return true}catch(e){note(e);return false}}
    if(mode!=="idb") return false;
    try{await run("readwrite",st=>{st.put(v,k)});return true}catch(e){return false}}
  async function del(k){await ready();
    if(mode==="local"){try{localStorage.removeItem(LP+k)}catch(e){}return}
    if(mode!=="idb") return;
    try{await run("readwrite",st=>{st.delete(k)})}catch(e){}}
  async function keys(){await ready();
    if(mode==="local") return lsKeys();if(mode!=="idb") throw new Error("storage unavailable");
    return (await run("readonly",st=>st.getAllKeys())).map(String)}
  /* what an older version may have left in localStorage while this browser uses IndexedDB */
  const legacy={keys:()=>mode==="idb"?lsKeys():[],get:lsGet};
  const traces=()=>{try{return JSON.parse(localStorage.getItem("ed-trace")||"[]")}catch(e){return []}};
  return {ready,get,set,del,keys,legacy,errs,traces,get mode(){return mode}};
})();

/* ---------- book model ---------- */
function newSpread(){return {id:uid(),state:"editing",them:blankSide(),me:blankSide()}}
function sampleSpread(){
  const s=newSpread();s.sample=true;
  Object.assign(s.them,{date:"2026/10/05",weather:"多雲轉晴",mood:"下班路上的晚霞很好看，可惜你不在",
    diary:"公司樓下新開了一間鯛魚燒，排隊的人好多。我買了紅豆和卡士達各一個，結果卡士達比較好吃，下次帶你去。\n晚上看完你推薦的那部電影，最後那段我真的有點鼻酸，但不要笑我。",
    say:"週末記得帶外套，氣象說會變冷。",q:"如果明天放假一天，你最想做什麼？",ans:"睡到自然醒，然後去吃早午餐！"});
  Object.assign(s.me,{date:"2026/10/07",weather:"晴",mood:"今天的雲好像棉花糖",
    diary:"收到你的日記了！鯛魚燒那段看得我好餓，卡士達口味我記住了。\n今天整理房間時找到我們第一次出去玩的票根，夾進這本日記裡剛剛好。下雨天去的那間咖啡店，你還記得名字嗎？",
    say:"電影的事我不會笑你，因為我也哭了。",q:"你最喜歡的季節是？",ans:""});
  return s;
}
function newBook(){
  return {app:"exchange-diary",version:1,id:uid(),title:"Exchange Diary",subtitle:"",names:{them:"",me:""},swap:false,fontNames:{},
    style:{theme:"country",...THEMES.country.def},fonts:{them:"jh1",me:"iansui"},
    spreads:[sampleSpread()],created:Date.now(),updated:Date.now()};
}
/* things on the page (phase 3): keep only what the editor knows how to draw */
function objsIn(a){
  if(!Array.isArray(a)) return [];
  const num=(v,d,lo,hi)=>Number.isFinite(+v)?Math.max(lo,Math.min(hi,+v)):d,str=v=>typeof v==="string"?v.slice(0,2000):"";
  const img=v=>typeof v==="string"&&/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v);
  const out=[];
  for(const o of a){
    if(!o||typeof o!=="object"||!["photo","note","tape","sticker"].includes(o.type)) continue;
    const n={id:str(o.id)||("o"+Math.random().toString(36).slice(2,9)),type:o.type,x:num(o.x,148,-40,336),y:num(o.y,105,-40,250),
      w:num(o.w,40,10,260),rot:num(o.rot,0,-180,180)};
    if(o.lock===true) n.lock=true;if(o.shadow===true) n.shadow=true;
    if(o.type==="photo"){if(!img(o.src)&&o.src!=="") continue;n.src=o.src||"";n.ar=num(o.ar,1.33,.1,10);
      n.frame=["polaroid","square","wide","bare"].includes(o.frame)?o.frame:"polaroid";n.cap=str(o.cap);
      if(o.cs!==undefined) n.cs=num(o.cs,1,.6,2);
      if(Array.isArray(o.capfx)){try{const L=tidyLines(o.capfx.map(l=>Array.isArray(l)?l.filter(r=>r&&typeof r.t==="string").map(r=>({t:r.t,k:String(r.k||"")})):[]),true);if(hasFx(L)&&linesText(L)===n.cap) n.capfx=L}catch(e){}}
      if(o.crop&&typeof o.crop==="object") n.crop={z:num(o.crop.z,1,1,6),x:num(o.crop.x,50,0,100),y:num(o.crop.y,50,0,100)}}
    if(o.type==="sticker"){if(!img(o.src)) continue;n.src=o.src;n.ar=num(o.ar,1,.1,10)}
    if(o.type==="note"){n.text=str(o.text);if(Array.isArray(o.fx)){try{const L=tidyLines(o.fx.map(l=>Array.isArray(l)?l.filter(r=>r&&typeof r.t==="string").map(r=>({t:r.t,k:String(r.k||"")})):[]),true);if(hasFx(L)&&linesText(L)===n.text) n.fx=L}catch(e){}}n.color=Math.round(num(o.color,0,0,4));if(o.fs!==undefined) n.fs=num(o.fs,.088,.03,.12)}
    if(o.type==="tape") n.pattern=Math.round(num(o.pattern,0,0,3));
    out.push(n);
  }
  return out;
}
/* fills gaps and drops unknown values, so old or hand-edited backup files still open */
/* the diary's own name is what the writers type under the big title; without one it is simply Exchange Diary */
const diaryName=()=>(book&&book.subtitle||"").trim()||"Exchange Diary";
function normalize(b){
  if(!b||typeof b!=="object"||!Array.isArray(b.spreads)) throw new Error("這不是 Exchange Diary 的備份檔。");
  if(!b.spreads.length) throw new Error("備份檔裡沒有任何跨頁。");
  const n=newBook(),str=v=>typeof v==="string"?v:"";
  const side=o=>{const sd=Object.fromEntries(FIELDS.map(f=>[f,str(o&&o[f])]));
    if(o&&o.fx&&typeof o.fx==="object") for(const f of FIELDS){const L=o.fx[f];
      if(!Array.isArray(L)||!L.every(l=>Array.isArray(l)&&l.every(r=>r&&typeof r.t==="string"))) continue;
      const T=tidyLines(L.map(l=>l.map(r=>({t:r.t,k:r.k}))),true);
      if(hasFx(T)&&linesText(T)===sd[f]){sd.fx=sd.fx||{};sd.fx[f]=T}}
    return sd};
  const st={...n.style,...(b.style||{})};
  if(!THEMES[st.theme]) Object.assign(st,{theme:"country"},THEMES.country.def);
  const T=THEMES[st.theme];
  for(const [k,obj] of [["color",T.colors],["layout",T.layouts],["frame",T.frames],["paper",T.papers]]) if(!obj[st[k]]) st[k]=T.def[k];
  if(!GRID[st.grid]) st.grid=T.def.grid;
  const font=v=>FONTS.some(f=>f.id===v)||(typeof v==="string"&&/^u:.{1,80}$/.test(v))?v:null;
  /* older files kept one line spacing / text size for the whole book: carry them over to every spread */
  const oldLine=[.9,1.12].includes(+b.lineScale)?+b.lineScale:1,oldText=[.9,1.1].includes(+b.textScale)?+b.textScale:1;
  const pitch=v=>+v>=LH_MIN-.01&&+v<=LH_MAX+.01?+v:null,pt=v=>+v>=PT_MIN&&+v<=PT_CAP?+v:null;
  return {...n,id:str(b.id)||n.id,title:n.title,subtitle:str(b.subtitle)||(str(b.title)&&b.title!==n.title?str(b.title):""),   // the big title is fixed; a renamed book keeps its name as the diary name
    names:{them:str(b.names&&b.names.them),me:str(b.names&&b.names.me)},style:st,swap:b.swap===true,
    fonts:{them:font(b.fonts&&b.fonts.them)||"jh1",me:font(b.fonts&&b.fonts.me)||"iansui"},
    fontNames:Object.fromEntries(Object.entries(b.fontNames&&typeof b.fontNames==="object"?b.fontNames:{}).filter(([k,v])=>/^u:/.test(k)&&typeof v==="string").map(([k,v])=>[k,v.slice(0,60)])),
    spreads:b.spreads.map(s=>{s=s||{};const o={id:str(s.id)||uid(),state:s.state==="done"?"done":"editing",them:side(s.them),me:side(s.me)};
      const lh=pitch(s.lh)||(oldLine!==1?(T.lineTarget||6.7)*oldLine:null);if(lh) o.lh=lh;
      const sz={};for(const k of ["them","me"]){const v=pt(s.size&&s.size[k]);if(v) sz[k]=v}
      if(!s.size&&oldText!==1){const L=pageGeom(lh,st).lhn;sz.them=sz.me=snap(defaultPt(L)*oldText)}
      if(Object.keys(sz).length) o.size=sz;
      const tr={};for(const k of ["them","me"]){const v=s.track&&s.track[k];if([0,2,3].includes(v)) tr[k]=v}
      if(Object.keys(tr).length) o.track=tr;
      if(+s.modified) o.modified=+s.modified;if(s.sample) o.sample=true;
      const ob=objsIn(s.objs);if(ob.length) o.objs=ob;
      if(s.notesDone&&typeof s.notesDone==="object"){const nd={};for(const k of ["them","me"]) if(Array.isArray(s.notesDone[k])) nd[k]=s.notesDone[k].filter(x=>typeof x==="string").slice(0,200);o.notesDone=nd}
      if(s.before&&typeof s.before==="object") o.before={them:side(s.before.them),me:side(s.before.me),objs:objsIn(s.before.objs)};
      return o}),
    created:+b.created||Date.now(),updated:Date.now()};
}

/* ---------- paste parser lives in parse.js (PARSE.parse) ---------- */
const parsePasted=t=>PARSE.parse(t);

/* ---------- page markup ---------- */
function lbl(en,zh,no){return `<span class="lbl">${no?`<b class="no">${no}</b>`:""}<em>${en}</em><span>${zh}</span></span>`}
function fld(tag,f,cls="val"){return `<${tag} class="${cls}" data-field="${f}" data-ph="${PH[f]}"></${tag}>`}
function pageHTML(side){
  const ans=side==="them"?"my answer":"your answer";
  return `<article class="page" data-side="${side}" aria-label="${side==="them"?"左頁：對方":"右頁：我"}">
  <div class="paper">
    <svg class="deco" viewBox="0 0 148 210" preserveAspectRatio="none" aria-hidden="true"></svg>
    <div class="grid"></div>
    <div class="sheet">
      <div class="mast"><div class="mmeta"><span class="iss"></span><span class="mown">from · <span class="owner" data-side="${side}" aria-label="名字"></span></span><span class="pgno"></span></div><div class="mtitle"></div></div>
      <header class="f-head">
        <svg class="sprig" aria-hidden="true"><use href="#sprig"/></svg>
        <div class="edate" aria-hidden="true"><span class="mon"></span><span class="day"></span><small class="wd"></small><span class="wdl"></span></div>
        <div class="f-date"><span class="lbl"><em>date</em><span>日期</span></span>${fld("span","date")}</div>
        <div class="f-weather"><span class="lbl"><em>weather</em><span>天氣</span></span>${fld("span","weather")}</div>
        <svg class="sprig r" aria-hidden="true"><use href="#sprig"/></svg>
      </header>
      <section class="f-mood">${lbl("mood","心情")}${fld("p","mood")}</section>
      <section class="f-diary">${lbl("diary","日記","01")}${fld("div","diary")}</section>
      <section class="f-say">${lbl("to you","想對你說","02")}${fld("p","say")}</section>
      <section class="f-qa">${lbl("Q &amp; A","快問快答","03")}${fld("p","q","q")}
        <div class="ans"><span class="lbl"><em>${ans}</em></span>${fld("span","ans","a")}</div></section>
    </div>
    <div class="tag-wrap"><div class="tag"><svg aria-hidden="true"><use href="#sprig"/></svg><i class="from">from</i><span class="owner" data-side="${side}" aria-label="名字"></span></div></div>
    <div class="vtext" aria-hidden="true"><span>DAILY JOURNAL</span><span>交換日記</span></div>
    <div class="clay-layer" aria-hidden="true"></div>
    <div class="efoot" aria-hidden="true"><span>daily journal</span><i></i><span>my little moments</span><b class="pgno"></b></div>
    <div class="grain"></div><div class="gutter"></div>
    <div class="overflow-flag" hidden>放不下了：調小字級或行距，或刪減文字</div>
  </div>
</article>`;
}
spread.insertAdjacentHTML("beforeend",pageHTML("them")+pageHTML("me"));
const pages=[...spread.querySelectorAll(".page")];
for(const el of spread.querySelectorAll("[data-field],.owner")){el.contentEditable="true";el.spellcheck=false}

/* ---------- app state ---------- */
let book=null,cur=0,meta={};

/* ---------- styled text ----------
   A field is kept as plain text (side[field]) and, only when some words are styled, as lines of runs in side.fx[field]:
   [[{t:"text",k:"l b c1"}, …], …]. k holds tokens from FX_TOKENS only, so nothing but our own classes is ever rendered. */
const FX_GROUPS={size:["s","l","xl"],b:["b"],strike:["x"],color:["c1","c2","c3","c4"],hl:["h1","h2","h3","h4"]};
const FX_TOKENS=new Set(Object.values(FX_GROUPS).flat());
const cleanK=k=>[...new Set(String(k||"").split(/\s+/).filter(t=>FX_TOKENS.has(t)))].sort().join(" ");
const linesText=L=>L.map(l=>l.map(r=>r.t).join("")).join("\n");
const hasFx=L=>L.some(l=>l.some(r=>r.k));
function tidyLines(L,multi){
  if(!multi) L=[L.flat()];
  L=L.map(l=>{const out=[];for(const r of l){const t=r.t.replace(/ /g," ");if(!t) continue;const k=cleanK(r.k);
    const last=out[out.length-1];if(last&&last.k===k) last.t+=t;else out.push({t,k})}return out});
  while(L.length>1&&!L[L.length-1].length) L.pop();           // trailing empty lines
  const last=L[L.length-1];                                     // trailing spaces
  while(last.length){const r=last[last.length-1];r.t=r.t.replace(/\s+$/,"");if(r.t) break;last.pop()}
  return L;
}
/* DOM → lines of runs. P/DIV are lines and BR is a break, except the placeholder BR browsers leave at the end of a block */
function domLines(root,multi){
  const L=[[]];let pending=false;
  const brk=()=>{if(pending){L.push([]);pending=false}};
  const walk=(node,k)=>{for(const n of node.childNodes){
    if(n.nodeType===3){n.data.split("\n").forEach((part,i)=>{brk();if(i) L.push([]);if(part) L[L.length-1].push({t:part,k})});continue}
    if(n.nodeType!==1) continue;
    const tag=n.nodeName;
    if(tag==="BR"){const placeholder=!n.nextSibling&&(n.parentNode===root||/^(P|DIV)$/.test(n.parentNode.nodeName));if(!placeholder){brk();L.push([])}continue}
    let kk=k;
    for(const c of n.classList) if(c.startsWith("fx-")) kk+=" "+c.slice(3);
    if(tag==="B"||tag==="STRONG") kk+=" b";
    if(tag==="P"||tag==="DIV"){if(L[L.length-1].length||pending) L.push([]);pending=false;walk(n,kk);pending=true}
    else walk(n,kk);
  }};
  walk(root,"");
  return tidyLines(L,multi);
}
const runHTML=r=>r.k?`<span class="fx ${r.k.split(" ").map(t=>"fx-"+t).join(" ")}">${esc(r.t)}</span>`:esc(r.t);
function renderLines(el,L){
  if(el.dataset.field==="diary") el.innerHTML=linesText(L)?L.map(l=>`<p>${l.map(runHTML).join("")||"<br>"}</p>`).join(""):"";
  else el.innerHTML=L.map(l=>l.map(runHTML).join("")).join("\n");
}
const plainLines=t=>String(t||"").split("\n").map(l=>l?[{t:l,k:""}]:[]);
function fieldLines(sd,f){const L=sd.fx&&sd.fx[f];return L&&linesText(L)===sd[f]?L:plainLines(sd[f])}
function setField(el,sd){renderLines(el,fieldLines(sd,el.dataset.field))}
function readLines(el){return domLines(el,!el.dataset.field||MULTI.has(el.dataset.field))}   // sticky-note text keeps its lines
function storeLines(sd,f,L){
  sd[f]=linesText(L);
  if(hasFx(L)){sd.fx=sd.fx||{};sd.fx[f]=L}
  else if(sd.fx){delete sd.fx[f];if(!Object.keys(sd.fx).length) delete sd.fx}
}

/* sticky notes keep their words the same way: o.text plain, o.fx lines of runs only when something is styled */
const noteLines=o=>o.fx&&linesText(o.fx)===o.text?o.fx:plainLines(o.text);
const noteHTML=o=>noteLines(o).map(l=>l.map(runHTML).join("")).join("\n");
function noteStore(o,L){o.text=linesText(L);if(hasFx(L)) o.fx=L;else delete o.fx}
function noteRender(o){for(const t of document.querySelectorAll(`#spread .obj[data-oid="${o.id}"] .o-note .o-text`)) t.innerHTML=noteHTML(o)}
/* polaroid captions work the same way: o.cap plain, o.capfx only when something is styled; o.cs scales the size */
const capLines=o=>o.capfx&&linesText(o.capfx)===(o.cap||"")?o.capfx:plainLines(o.cap||"");
const capHTML=o=>capLines(o).map(l=>l.map(runHTML).join("")).join("\n");
function capStore(o,L){o.cap=linesText(L);if(hasFx(L)) o.capfx=L;else delete o.capfx}
function capRender(o){for(const t of document.querySelectorAll(`#spread .obj[data-oid="${o.id}"] .o-cap .o-text`)) t.innerHTML=capHTML(o)}
/* selection ↔ text offsets (a line break counts as one character, as in linesText) */
function textOffset(el,node,off){
  const r=document.createRange();r.setStart(el,0);r.setEnd(node,off);
  const box=document.createElement("div");box.appendChild(r.cloneContents());
  return linesText(domLines(box,true)).length;
}
function placeAt(el,off){
  if(el.dataset.field==="diary"){
    for(const p of el.querySelectorAll(":scope > p")){const n=p.textContent.length;
      if(off<=n){const tw=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let t;while((t=tw.nextNode())){if(off<=t.length) return [t,off];off-=t.length}return [p,0]}
      off-=n+1}
  }else{const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let t;while((t=tw.nextNode())){if(off<=t.length) return [t,off];off-=t.length}}
  return [el,el.childNodes.length];
}

/* ---------- the floating style bar ---------- */
const fxbar=$("#fxbar");let fxSel=null,barDown=false;
function grabSel(){
  const sel=getSelection();if(!sel.rangeCount||sel.isCollapsed){fxSel=null;return null}
  const r=sel.getRangeAt(0),startEl=r.startContainer.nodeType===1?r.startContainer:r.startContainer.parentNode;
  const el=startEl.closest&&startEl.closest('.spread [data-field],.objs .o-note .o-text,.objs .o-cap .o-text');
  if(!el||el.contentEditable!=="true"){fxSel=null;return null}
  const a=textOffset(el,r.startContainer,r.startOffset);
  let b=el.contains(r.endContainer)?textOffset(el,r.endContainer,r.endOffset):linesText(readLines(el)).length;
  if(b<=a){fxSel=null;return null}
  fxSel={el,a,b,rect:r.getBoundingClientRect()};return fxSel;
}
/* per character token sets for [a,b), skipping line breaks */
function fxChars(L){const out=[];L.forEach((l,i)=>{if(i) out.push(null);for(const r of l) for(const c of r.t) out.push({c,k:new Set(r.k?r.k.split(" "):[])})});return out}
function charsToLines(ch){const L=[[]];for(const x of ch){if(!x){L.push([]);continue}L[L.length-1].push({t:x.c,k:[...x.k].join(" ")})}return tidyLines(L,true)}
/* selection offsets count UTF-16 units (as the DOM does); fxChars holds whole characters, and an emoji or a
   rare character is two units — so turn a unit offset into a character index before slicing */
function cut(ch,u){let n=0,i=0;for(;i<ch.length&&n<u;i++) n+=ch[i]?ch[i].c.length:1;return i}
function fxState(){
  if(!fxSel) return {};
  const all=fxChars(readLines(fxSel.el)),ch=all.slice(cut(all,fxSel.a),cut(all,fxSel.b)).filter(Boolean),st={};
  for(const v of FX_TOKENS) st[v]=ch.length>0&&ch.every(x=>x.k.has(v));
  return st;
}
function applyFx(op,v){
  if(!fxSel) return;
  const {el,a,b}=fxSel,s=book.spreads[cur];if(s.state==="done") return;
  const f=el.dataset.field,note=!f&&typeof findObj==="function"?findObj(el.closest(".obj").dataset.oid):null;
  if(!f&&!note) return;
  const ch=fxChars(readLines(el)),seg=ch.slice(cut(ch,a),cut(ch,b)).filter(Boolean);
  if(op==="clear") seg.forEach(x=>x.k.clear());
  else{
    const group=FX_GROUPS[op],on=seg.every(x=>x.k.has(v));
    for(const x of seg){for(const t of group) x.k.delete(t);if(!on) x.k.add(v)}
  }
  let L=charsToLines(ch);
  if(note&&el.dataset.key==="cap"){capStore(note,L);s.modified=Date.now();capRender(note)}
  else if(note){noteStore(note,L);s.modified=Date.now();noteRender(note)}
  else{if(!MULTI.has(f)) L=tidyLines(L,false);const side=who(el.closest(".page").dataset.side);
    storeLines(s[side],f,L);s.modified=Date.now();delete s.sample;renderLines(el,fieldLines(s[side],f))}
  const sel=getSelection(),r=document.createRange(),[n1,o1]=placeAt(el,a),[n2,o2]=placeAt(el,b);
  try{r.setStart(n1,o1);r.setEnd(n2,o2);sel.removeAllRanges();sel.addRange(r)}catch(e){}
  grabSel();showBar();touch();scheduleFit();
}
/* phones. Where the browser tells us the keyboard is open (a normal browser tab), the bar sits on top of the
   keyboard like a notes app's format bar. Where it cannot tell (inside some app previews), the bar floats by the
   words, on the side the phone's own copy/paste menu is not: that menu goes above the words when there is room
   and below them when the words are near the top of the screen. */
let visMax=0,visW=0;
const kbOpen=()=>{const vv=window.visualViewport;if(!vv) return false;
  const vis=vv.height*vv.scale,wid=Math.round(vv.width*vv.scale);
  if(Math.abs(wid-visW)>20){visW=wid;visMax=0}                     // turned the phone: start over
  if(vis>visMax) visMax=vis;
  return vis<visMax*.78};
if(window.visualViewport) kbOpen();
if(window.visualViewport) visualViewport.addEventListener("resize",()=>{const a=document.activeElement;
  if(!(a&&a.isContentEditable)) visMax=Math.max(visMax,visualViewport.height*visualViewport.scale)});
/* phones: a round 「Aa」 button sits by the selection (or on top of the keyboard); a tap opens the style card above it,
   in two rows (size, bold, strike, clear / four colours, four highlighters) */
const fxaa=document.createElement("button");fxaa.type="button";fxaa.className="fxaa";fxaa.id="fxaa";fxaa.textContent="Aa";
fxaa.setAttribute("aria-label","文字樣式");fxaa.setAttribute("aria-expanded","false");fxaa.hidden=true;document.body.appendChild(fxaa);
let fxOpen=false;
fxaa.addEventListener("pointerdown",e=>{e.preventDefault();barDown=true});fxaa.addEventListener("mousedown",e=>e.preventDefault());
fxaa.addEventListener("click",()=>{fxOpen=!fxOpen;fxaa.setAttribute("aria-expanded",String(fxOpen));showBar();
  /* the card should not sit on the words being styled: move the page up a little when it would */
  if(fxOpen&&fxSel){const c=fxbar.getBoundingClientRect(),r=fxSel.rect;if(r.bottom>c.top-6&&r.top<c.bottom) scrollBy(0,r.bottom-c.top+18)}});
function phoneBar(R){
  const vv=window.visualViewport,sc=vv?vv.scale||1:1,kb=!!(vv&&kbOpen());
  const vL=vv?vv.offsetLeft:0,vT=vv?vv.offsetTop:0,vW=vv?vv.width:innerWidth,vB=vv?vv.offsetTop+vv.height:innerHeight;
  const S=48,G=12,px=n=>n/sc;                                       // sizes on screen, turned into page units
  fxaa.hidden=false;fxaa.classList.toggle("on",fxOpen);
  let aT;
  if(kb) aT=vB-px(S+G);
  else{const MENU=58,menuBelow=(R.top-vT)*sc<150;
    aT=R.bottom+px(14+(menuBelow?MENU:0));if(aT+px(S)>vB-px(8)) aT=R.top-px(S+14+(menuBelow?0:MENU));
    aT=Math.max(vT+px(8),Math.min(aT,vB-px(S+8)))}
  const aL=vL+vW-px(S+14),tf=sc!==1?`scale(${1/sc})`:"";
  Object.assign(fxaa.style,{top:aT+"px",left:aL+"px",transform:tf});
  fxbar.hidden=!fxOpen;if(!fxOpen) return;
  fxbar.style.width=Math.min(380,vW*sc-24)+"px";fxbar.style.transform=tf;
  const cH=fxbar.offsetHeight;let cT;
  if(!kb&&aT>=R.bottom){cT=aT+px(S+8);if(cT+px(cH)>vB-px(8)) cT=R.top-px(cH+14)}   // button under the words: card under the button
  else{cT=aT-px(cH+8);if(cT<vT+px(8)) cT=aT+px(S+8)}
  fxbar.style.top=cT+"px";fxbar.style.left=(vL+vW-px(14)-px(Math.min(380,vW*sc-24)))+"px";
}
function showBar(){
  if(!fxSel){fxbar.hidden=true;fxaa.hidden=true;fxOpen=false;fxaa.setAttribute("aria-expanded","false");return}
  const st=fxState();
  for(const btn of fxbar.querySelectorAll("button[data-v]")) btn.setAttribute("aria-pressed",String(!!st[btn.dataset.v]));
  fxbar.hidden=false;
  const R=fxSel.rect,w=fxbar.offsetWidth,h=fxbar.offsetHeight;
  if(innerWidth<=720){phoneBar(R);return}
  fxaa.hidden=true;fxbar.style.width="";fxbar.style.transform="";
  let top=R.top-h-10;if(top<8||!fxSel.el.dataset.field) top=R.bottom+10;
  fxbar.style.top=Math.min(top,innerHeight-h-8)+"px";
  fxbar.style.left=Math.max(8,Math.min(innerWidth-w-8,R.left+R.width/2-w/2))+"px";
}
/* the words move when the page scrolls or the keyboard opens: the bar follows them */
const fxFollow=()=>{if((!fxbar.hidden||!fxaa.hidden)&&!barDown){grabSel();showBar()}};
addEventListener("scroll",fxFollow,{passive:true});addEventListener("resize",fxFollow);
if(window.visualViewport){visualViewport.addEventListener("resize",fxFollow);visualViewport.addEventListener("scroll",fxFollow)}
document.addEventListener("selectionchange",()=>{if(barDown) return;grabSel();showBar()});
fxbar.addEventListener("pointerdown",e=>{e.preventDefault();barDown=true});
document.addEventListener("pointerup",()=>{setTimeout(()=>{barDown=false},0)});
fxbar.addEventListener("click",e=>{const b=e.target.closest("button");if(!b) return;applyFx(b.dataset.op,b.dataset.v)});
addEventListener("scroll",()=>{if(!fxbar.hidden&&fxSel){const sel=getSelection();if(sel.rangeCount) fxSel.rect=sel.getRangeAt(0).getBoundingClientRect();showBar()}},{passive:true});
addEventListener("resize",()=>{fxSel=null;fxbar.hidden=true});


/* ---------- line spacing (per spread) and text size (per page) ----------
   Line spacing is the paper's ruling, so both pages of a spread share it; it is kept as the line pitch in mm
   so it survives a change of frame. Text size is in pt, as it would print; until someone sets it, it follows the lines. */
const MM2PT=72/25.4,LH_MIN=4.5,LH_MAX=10,PT_MIN=7,PT_CAP=16;
const snap=v=>Math.round(v*2)/2;
const defaultPt=lhn=>lhn*.55*MM2PT;
const maxPt=lhn=>Math.min(PT_CAP,Math.floor(lhn*.95*MM2PT*2)/2);   // up to 95% of the line pitch (was 80%, 10/15)
function pageGeom(lh,st=book.style){
  const g=GEO[st.frame],gt=g.ft+g.gp,gb=g.fb+g.gp,avail=210-gt-gb,T=THEMES[st.theme];
  const minR=Math.ceil(avail/LH_MAX),maxR=Math.floor(avail/LH_MIN);
  const rows=Math.max(minR,Math.min(maxR,Math.round(avail/(lh||T.lineTarget||6.7))));
  return {g,gt,gb,avail,rows,minR,maxR,lhn:avail/rows};
}
function sizeOf(s,side,lhn){const v=s.size&&s.size[side];return Math.max(PT_MIN,Math.min(maxPt(lhn),v||defaultPt(lhn)))}
const fmtPt=v=>`${(Math.round(v*10)/10).toFixed(1).replace(/\.0$/,"")} pt`;
const TRACK=["-0.04em",null,"0.06em","0.12em"];          // 緊・標準・寬・更寬; 標準 leaves each style's own spacing
const trackOf=(s,p)=>{const v=s.track&&s.track[p];return v===undefined?1:v};
let panelWho="them";                                      // whose type the text card is showing
function syncSteppers(){
  const s=book.spreads[cur],geo=pageGeom(s.lh),locked=s.state==="done",p=panelWho;
  for(const b of $("#who").querySelectorAll("button")) b.setAttribute("aria-pressed",String(b.dataset.v===p));
  orderButtons($("#who"));slideSync($("#who"));
  $("#font-sel").value=book.fonts[p];
  const r=$("#step-rows"),[rFewer,rMore]=r.querySelectorAll(".arw");
  r.querySelector("output").textContent=`${geo.rows} 行`;
  rMore.disabled=locked||geo.rows>=geo.maxR;rFewer.disabled=locked||geo.rows<=geo.minR;
  const z=$("#step-size"),v=sizeOf(s,p,geo.lhn),[dn,up]=z.querySelectorAll(".arw");
  z.querySelector("output").textContent=fmtPt(v);
  dn.disabled=locked||v<=PT_MIN+.01;up.disabled=locked||v>=maxPt(geo.lhn)-.01;
  for(const b of $("#track").querySelectorAll("button")){b.setAttribute("aria-pressed",String(+b.dataset.v===trackOf(s,p)));b.disabled=locked}
  slideSync($("#track"));
  $("#size-reset").disabled=locked||!(s.lh||s.size||s.track);
}
/* switches list 他 and 我 in the order they sit on the page */
function orderButtons(seg){
  const t=seg.querySelector('[data-v="them"]'),m=seg.querySelector('[data-v="me"]');if(!t||!m) return;
  const first=book.swap?m:t,second=book.swap?t:m;
  if(second.previousElementSibling!==first) seg.insertBefore(first,second);
}

/* ---------- style ---------- */
const CYCLE={layout:()=>THEMES[book.style.theme].layouts,frame:()=>THEMES[book.style.theme].frames,paper:()=>THEMES[book.style.theme].papers,grid:()=>GRID};
function buildControls(){
  const T=THEMES[book.style.theme];
  $("#color-dots").innerHTML=Object.entries(T.colors).map(([id,c])=>`<button type="button" role="radio" data-v="${id}" aria-label="${c.name}" title="${c.name}"><i style="background:linear-gradient(135deg,${c.c1} 50%,${c.c2} 50%)"></i></button>`).join("");
}
function syncControls(){
  const st=book.style,T=THEMES[st.theme];
  for(const b of $("#theme-tabs").querySelectorAll("button")) b.setAttribute("aria-selected",String(b.dataset.v===st.theme));
  for(const b of $("#color-dots").querySelectorAll("button")) b.setAttribute("aria-checked",String(b.dataset.v===st.color));
  $("#color-name").textContent=T.colors[st.color].name;
  for(const c of document.querySelectorAll(".cycler")){const opts=CYCLE[c.dataset.key]();c.querySelector("output").textContent=opts[st[c.dataset.key]]}
  for(const b of $("#seg-show").querySelectorAll("button")) b.setAttribute("aria-pressed",String(b.dataset.v===effShow()));
  orderButtons($("#seg-show"));slideSync($("#seg-show"));
  syncSteppers();
}
function applyStyle(){
  Object.assign(state,book.style,{them:book.fonts[who("them")],me:book.fonts[who("me")]});CUR=cur;
  const T=THEMES[state.theme],P=T.colors[state.color],pastel=state.theme==="pastel",editorial=state.theme==="editorial",gazette=state.theme==="gazette",bk=$("#book");
  for(const [k,v] of [["--label",P.label],["--rule",P.rule],["--c1",P.c1],["--c2",P.c2],["--tag-bg",P.tagBg],["--tag-ink",P.tagInk]]) spread.style.setProperty(k,v);
  if(pastel){for(const [k,v] of [["--c3",P.c3],["--sky",P.sky],["--pink",P.ink],["--blk",`color-mix(in srgb,${P.c1} 42%,#fff)`]]) spread.style.setProperty(k,v);bk.style.setProperty("--cover",P.cover)}
  else if(editorial||gazette){spread.style.setProperty("--pink",P.ink);spread.style.setProperty("--head",P.head);bk.style.setProperty("--cover",P.cover)}
  else{spread.style.removeProperty("--pink");bk.style.removeProperty("--cover")}
  Object.assign(spread.dataset,{theme:state.theme,color:state.color,layout:state.layout,frame:state.frame,paper:state.paper,grid:state.grid,show:posShow()});bk.dataset.show=posShow();
  $("#gswap").hidden=effShow()!=="both";
  const s=book.spreads[cur],{g,gt,gb,lhn}=pageGeom(s.lh);LHN=lhn;
  const set=(k,v)=>spread.style.setProperty(k,v);
  set("--gt",gt);set("--gb",gb);set("--go",g.fo+g.gp);set("--gg",g.fg+g.gp);set("--tag-t",g.tagT);set("--tag-o",g.tagO);set("--vx",g.vx||4.6);set("--vt",g.vt||P.label);
  set("--lhn",LHN.toFixed(4));
  for(const pg of pages){const p=who(pg.dataset.side),t=TRACK[trackOf(s,p)];
    pg.style.setProperty("--fsn",(sizeOf(s,p,LHN)/MM2PT).toFixed(3));
    if(t){pg.dataset.ls="";pg.style.setProperty("--ls",t)}else{delete pg.dataset.ls;pg.style.removeProperty("--ls")}}
  set("--font-them",famOf(state.them));set("--font-me",famOf(state.me));
  for(const pg of pages){(pastel?drawPastel:editorial?drawEditorial:gazette?drawGazette:drawDeco)(pg.querySelector(".deco"),pg.dataset.side);placeClay(pg.querySelector(".clay-layer"),pg.dataset.side)}
  syncControls();
  scheduleFit();
  if(typeof syncObjBar==="function") requestAnimationFrame(syncObjBar);
}

/* ---------- who is on which page ----------
   The two page elements are positions: data-side "them" = left, "me" = right. book.swap puts 我 on the left.
   who(pos) gives the person on a page; the mapping is its own inverse, so who(person) is also that person's page. */
const who=pos=>book&&book.swap?(pos==="them"?"me":"them"):pos;
const PERSON={them:"他",me:"我"};

/* ---------- which page is shown ---------- */
const PHONE=matchMedia("(max-width:720px)");
const effShow=()=>PHONE.matches&&state.show==="both"?who("them"):state.show;   // a person, or "both"
const posShow=()=>{const v=effShow();return v==="both"?v:who(v)};                // the page position to show
/* move a sliding switch's thumb under its pressed button; no animation the first time */
function slideSync(seg){
  const on=seg.querySelector('button[aria-pressed="true"]'),t=seg.querySelector(".thumb");if(!t) return;
  if(!on||!on.offsetWidth){t.style.width="0";return}
  t.style.left=on.offsetLeft+"px";t.style.width=on.offsetWidth+"px";
  if(!seg.classList.contains("ready")) requestAnimationFrame(()=>seg.classList.add("ready"));
}

/* ---------- rendering ---------- */
function shortDate(d){const m=String(d||"").match(/\d{4}\D+(\d{1,2})\D+(\d{1,2})/);return m?`${pad(m[1])}/${pad(m[2])}`:""}
/* a spread's date: written the same day, so one date; two only when the pages really differ */
function spreadDate(s,full){
  const f=d=>{const m=String(d||"").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);return m?(full?`${m[1]}/`:"")+`${pad(m[2])}/${pad(m[3])}`:""};
  const a=f(s.them.date),b=f(s.me.date);
  return a&&b&&a!==b?`${a} – ${full&&a.slice(0,4)===b.slice(0,4)?b.slice(5):b}`:a||b;
}
const fmtDay=t=>{const d=new Date(t);return `${pad(d.getMonth()+1)}/${pad(d.getDate())}`};
/* 外觀: light unless the writer turns the light off; remembered on this device only */
const LOOK_NAME={light:"淺色",dark:"深色"};
function setLook(m,say){
  const b=$("#look");if(m!=="dark") m="light";
  document.documentElement.dataset.theme=m;b.dataset.mode=m;
  b.setAttribute("aria-label",m==="dark"?"切換成淺色":"切換成深色");b.title=m==="dark"?"切換成淺色":"切換成深色";b.setAttribute("aria-pressed",String(m==="dark"));
  try{localStorage.setItem("ed-look",m)}catch(e){}
  if(say) toast(`已切換成${LOOK_NAME[m]}`);
}
$("#look").addEventListener("click",()=>setLook($("#look").dataset.mode==="dark"?"light":"dark",true));
(()=>{let m="light";try{m=localStorage.getItem("ed-look")||"light"}catch(e){}setLook(m)})();
/* keep the open spread's leaf in sight by scrolling the row only (never the page); fade the edge that has more */
function chipsInView(){
  const row=$("#chips"),c=row.querySelector('[aria-selected="true"]');if(!row) return;
  if(c){const l=c.offsetLeft-row.offsetLeft,r=l+c.offsetWidth;if(l<row.scrollLeft+8) row.scrollLeft=l-8;else if(r>row.scrollLeft+row.clientWidth-48) row.scrollLeft=r-row.clientWidth+48}
  chipFade();
}
function chipFade(){const row=$("#chips");row.classList.toggle("more-r",row.scrollLeft+row.clientWidth<row.scrollWidth-2);row.classList.toggle("more-l",row.scrollLeft>2)}
function refreshNav(){
  /* each spread is a small desk-calendar leaf: No. on top, the day large, the month below; a dot says done (filled) or still open */
  const MON=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  $("#chips").innerHTML=book.spreads.map((s,i)=>{const m=String(s.them.date||s.me.date||"").match(/\d{4}\D+(\d{1,2})\D+(\d{1,2})/),done=s.state==="done";
    return `<button type="button" role="tab" class="chip${done?" done":""}" data-i="${i}" aria-selected="${i===cur}" aria-label="第 ${i+1} 個跨頁，${spreadDate(s,true)||"未填日期"}，${done?"已完成":"編輯中"}" title="${done?"已完成":"編輯中"}">
      <em>No.${pad(i+1)}</em>${m&&+m[1]>=1&&+m[1]<=12?`<strong>${pad(m[2])}</strong><small>${MON[m[1]-1]}</small>`:`<strong class="nd">未填</strong><small>&nbsp;</small>`}<u aria-hidden="true"></u></button>`}).join("");
  chipsInView();
  $("#move-prev").disabled=cur===0;$("#move-next").disabled=cur===book.spreads.length-1;
  $("#sample-note").hidden=true;          // the first-visit tour says this instead (guide.js)
}
/* finished spreads are locked; "修改" opens one again and keeps a copy to fall back on */
function applyLock(){
  fxSel=null;fxbar.hidden=true;
  const s=book.spreads[cur],locked=s.state==="done",revising=!locked&&!!s.before;
  spread.classList.toggle("is-locked",locked);
  const ro=locked||document.body.classList.contains("v-read");      // reading is never editing
  for(const el of spread.querySelectorAll("[data-field],.owner")) el.contentEditable=ro?"false":"true";
  const when=s.modified?`最後修改 ${fmtDay(s.modified)}`:"";
  /* the state is shown by the leaf's dot and the dock's buttons; the words stay for screen readers, the date sits quietly in the dock */
  $("#spread-state").textContent=`第 ${cur+1} 個跨頁：${locked?"已完成":revising?"修改中，改完按「完成修改」，或還原成修改前":"編輯中"}${when?"，"+when:""}`;
  $("#spread-when").textContent=when?`No. ${pad(cur+1)}　${when}`:"";
  $("#btn-done").textContent=locked?"修改這個跨頁":revising?"完成修改":"完成這次交換";
  $("#btn-revert").hidden=!revising;
  $("#btn-paste").disabled=locked;
  syncSteppers();
  if(typeof objsLockChanged==="function") objsLockChanged();
}
function renderSpread(){
  const s=book.spreads[cur];
  for(const pg of pages){const p=who(pg.dataset.side);for(const el of pg.querySelectorAll("[data-field]")) setField(el,s[p]);
    pg.setAttribute("aria-label",`${pg.dataset.side==="them"?"左頁":"右頁"}：${PERSON[p]}的日記`);
    pg.querySelector(".ans .lbl em").textContent=p==="them"?"my answer":"your answer"}
  for(const o of spread.querySelectorAll(".owner")) o.textContent=book.names[who(o.dataset.side)]||"";
  for(const pg of pages){
    const n=cur*2+(pg.dataset.side==="them"?1:2);
    pg.querySelector(".iss").textContent=`No. ${pad(cur+1)}`;
    pg.querySelector(".mast .pgno").textContent=`p. ${pad(n)}`;
    pg.querySelector(".efoot .pgno").textContent=`p.${pad(n)}`;
    pg.querySelector(".mtitle").textContent=diaryName();
  }
  updateEDates();applyStyle();refreshNav();applyLock();
  if(typeof objsChanged==="function") objsChanged();
}
function renderAll(){
  if(book.title&&book.title!=="Exchange Diary"&&!book.subtitle) book.subtitle=book.title;book.title="Exchange Diary";
  $("#book-sub").value=book.subtitle||"";buildControls();renderSpread();
}

/* ---------- overflow: the writer sets the size; we only say when it does not fit ---------- */
let fitRaf=0;
function scheduleFit(){cancelAnimationFrame(fitRaf);fitRaf=requestAnimationFrame(()=>pages.forEach(fitPage))}
function fitPage(pg){
  if(!pg.offsetParent) return;                       // hidden on phones; fitted again when shown
  const sheet=pg.querySelector(".sheet"),diary=pg.querySelector(".f-diary");
  const o=sheet.scrollHeight>sheet.clientHeight+1||diary.scrollHeight>diary.clientHeight+1;pg.classList.toggle("is-over",o);pg.querySelector(".overflow-flag").hidden=!o;
}
if(document.fonts){document.fonts.addEventListener("loadingdone",scheduleFit);document.fonts.ready.then(scheduleFit)}
window.addEventListener("resize",scheduleFit);

/* ---------- saving ---------- */
let saveTimer=0;
const status=(t,warn)=>{const s=$("#save-txt")||$("#save-status");s.textContent=t;s.classList.toggle("warn",!!warn)};
function touch(){book.updated=Date.now();status("儲存中…");clearTimeout(saveTimer);saveTimer=setTimeout(save,500)}
/* closing the tab right after a change should not lose it */
addEventListener("pagehide",()=>{if(saveTimer){clearTimeout(saveTimer);saveTimer=0;save()}});
/* photos and stickers are stored once each under their own key ("img:…"); the book record keeps only the keys,
   so saving after every few words writes a few kilobytes instead of every picture again */
const imgKeys=new Map();let savedImgs=new Set();
function packBook(){
  const used=new Set(),news=new Map();
  const po=o=>{if(!o||typeof o.src!=="string"||!o.src.startsWith("data:")) return o;
    let k=imgKeys.get(o.src);if(!k){k="img:"+Date.now().toString(36)+Math.random().toString(36).slice(2,9);imgKeys.set(o.src,k)}
    used.add(k);if(!savedImgs.has(k)) news.set(k,o.src);return {...o,src:k}};
  const ps=sp=>{const r={...sp};if(Array.isArray(sp.objs)) r.objs=sp.objs.map(po);if(sp.before&&typeof sp.before==="object") r.before=ps(sp.before);return r};
  return {data:{...book,appVer:APP_VER,spreads:book.spreads.map(ps)},used,news};
}
async function unpackBook(b){
  if(!b||!Array.isArray(b.spreads)) return b;
  const keys=new Set(),jobs=[];
  const fill=o=>{if(o&&typeof o.src==="string"&&o.src.startsWith("img:")){const k=o.src;keys.add(k);
    jobs.push(Store.get(k).then(v=>{o.src=typeof v==="string"?v:"";if(o.src) imgKeys.set(o.src,k)}))}};
  for(const sp of b.spreads){(sp.objs||[]).forEach(fill);if(sp.before) (sp.before.objs||[]).forEach(fill)}
  await Promise.all(jobs);savedImgs=keys;return b;
}
let saving=Promise.resolve();
function save(){saveTimer=0;return saving=saving.then(saveNow,saveNow)}
let loadFailed=false,failedId="";   // the saved diary could not be read: never write over it
let leaving=false;                   // switching to another diary: the page is about to reload
async function saveNow(){
  if(leaving) return false;
  if(loadFailed){status("上次的日記沒有讀取成功，已暫停自動儲存",true);return false}
  const {data,used,news}=packBook();let ok=true;
  for(const [k,v] of news){if(await Store.set(k,v)) savedImgs.add(k);else{ok=false;break}}
  ok=ok&&await Store.set("book:"+book.id,data)&&await Store.set("current",book.id);
  if(ok){const keep=snapImgs();for(const k of [...savedImgs]) if(!used.has(k)){savedImgs.delete(k);if(!keep.has(k)) Store.del(k)}}
  if(ok) writeMirror(data);
  if(ok&&typeof Cloud!=="undefined"){Cloud.changed();Cloud.maybeNudge()}
  if(ok&&Date.now()-lastSnap(book.id)>SNAP_EVERY) queueSnap("自動保存");
  const t=new Date();status(ok?`已自動儲存 ${pad(t.getHours())}:${pad(t.getMinutes())}`:"裝置空間不足，無法自動儲存，請先匯出備份",!ok);
  return ok;
}

/* ---------- 備用副本: the diary's text written a second time into localStorage, a separate part of the browser.
   Chrome has been seen to empty a site's IndexedDB while leaving localStorage alone; this lets the words come back.
   Text only (photos stay as img: keys); one entry per diary, the three most recent kept. ---------- */
const MIR="ed-mirror:";
function writeMirror(data){
  try{const s=JSON.stringify({id:data.id,t:Date.now(),v:APP_VER,data});if(s.length>2.4e6) return;
    localStorage.setItem(MIR+data.id,s);
    const all=mirrors();if(all.length>3) for(const m of all.slice(3)) localStorage.removeItem(MIR+m.id)}catch(e){}
}
function mirrors(){const out=[];try{for(const k of Object.keys(localStorage)) if(k.startsWith(MIR)){try{const m=JSON.parse(localStorage.getItem(k));
  if(m&&m.data&&Array.isArray(m.data.spreads)&&m.id) out.push(m)}catch(e){}}}catch(e){}return out.sort((a,b)=>b.t-a.t)}

/* ---------- 自動副本: earlier copies of the diary kept in this browser, so an update or a slip never loses it.
   A copy is the stored record (text only, photos stay under their img: keys and are kept while any copy uses them). ---------- */
const APP_VER="2026.10.16h";
const SNAP_PER_BOOK=12,SNAP_TOTAL=40,SNAP_EVERY=12*3600e3;
let snapIdx=[];   // [{k,book,t,why,n,name,sig,imgs}]
const snapImgs=()=>{const s=new Set();for(const x of snapIdx) for(const k of x.imgs) s.add(k);return s};
const lastSnap=id=>snapIdx.reduce((m,x)=>x.book===id&&x.t>m?x.t:m,0);
const sigOf=str=>{let h=0;for(let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))|0;return str.length+":"+h};
function recImgs(data){const s=new Set(),add=o=>{if(o&&typeof o.src==="string"&&o.src.startsWith("img:")) s.add(o.src)};
  for(const sp of data.spreads||[]){if(!sp) continue;(sp.objs||[]).forEach(add);if(sp.before) (sp.before.objs||[]).forEach(add)}return s}
async function loadSnaps(){try{const v=await Store.get("snaps");snapIdx=Array.isArray(v)?v.filter(x=>x&&typeof x.k==="string"&&Array.isArray(x.imgs)):[]}catch(e){snapIdx=[]}}
function queueSnap(why,id){return saving=saving.then(()=>keepCopy(why,id),()=>keepCopy(why,id))}
async function keepCopy(why,id){
  try{
    id=id||book.id;const data=await Store.get("book:"+id);
    if(!data||!Array.isArray(data.spreads)) return false;
    const sig=sigOf(JSON.stringify(data)),prev=snapIdx.filter(x=>x.book===id).sort((a,b)=>b.t-a.t)[0];
    if(prev&&prev.sig===sig) return true;                          // this content is already kept
    const t=Date.now(),k="snap:"+id+":"+t;
    if(!await Store.set(k,data)) return false;
    const all=[...snapIdx,{k,book:id,t,why,n:data.spreads.length,name:String(data.subtitle||"").trim(),sig,imgs:[...recImgs(data)]}].sort((a,b)=>b.t-a.t);
    const keep=[],drop=[],per={};
    for(const x of all){per[x.book]=(per[x.book]||0)+1;(per[x.book]<=SNAP_PER_BOOK&&keep.length<SNAP_TOTAL?keep:drop).push(x)}
    if(!await Store.set("snaps",keep)){Store.del(k);return false}
    snapIdx=keep;
    if(typeof Cloud!=="undefined") Cloud.noteVersion(why);
    if(drop.length){
      /* photos of a dropped copy go only when nothing else uses them: the open diary, another copy, or another diary in this browser */
      const used=new Set([...savedImgs,...snapImgs()]);
      for(const bk of (await Store.keys()).filter(x=>x.startsWith("book:"))){try{const b=await Store.get(bk);if(b) for(const i of recImgs(b)) used.add(i)}catch(e){}}
      for(const x of drop){await Store.del(x.k);for(const i of x.imgs) if(!used.has(i)) await Store.del(i)}
    }
    return true;
  }catch(e){console.error(e);return false}
}
/* make sure what is on screen is stored, then keep a copy of it (before deleting, importing, restoring…) */
async function guard(why){if(!loadFailed&&!leaving){clearTimeout(saveTimer);await save()}await queueSnap(why,loadFailed?failedId:book.id)}

/* ---------- editing on the page ---------- */
spread.addEventListener("input",e=>{
  const o=e.target.closest(".owner");
  if(o){const v=o.textContent.replace(/\s+/g," ").trim();book.names[who(o.dataset.side)]=v;
    for(const t of spread.querySelectorAll(`.owner[data-side="${o.dataset.side}"]`)) if(t!==o) t.textContent=v;
    if(!v) o.textContent="";touch();return}
  const el=e.target.closest("[data-field]");if(!el) return;
  const side=who(el.closest(".page").dataset.side),s=book.spreads[cur];
  storeLines(s[side],el.dataset.field,readLines(el));const v=s[side][el.dataset.field];
  s.modified=Date.now();delete s.sample;
  if(!v) el.innerHTML="";
  if(el.dataset.field==="date"){updateEDates();refreshNav()}
  $("#sample-note").hidden=true;touch();scheduleFit();
});
spread.addEventListener("keydown",e=>{
  const el=e.target.closest("[data-field],.owner");
  if(el&&e.key==="Enter"&&!(el.dataset&&MULTI.has(el.dataset.field))){e.preventDefault();el.blur()}
  if(el&&(e.ctrlKey||e.metaKey)&&/^[biu]$/i.test(e.key)){e.preventDefault();if(e.key.toLowerCase()==="b"&&el.dataset.field&&grabSel()) applyFx("b","b")}
});
spread.addEventListener("paste",e=>{
  const el=e.target.closest("[data-field],.owner");if(!el) return;
  e.preventDefault();
  let t=(e.clipboardData||window.clipboardData).getData("text/plain")||"";
  if(!(el.dataset.field&&MULTI.has(el.dataset.field))) t=t.replace(/\s*\n\s*/g," ");
  if(!document.execCommand("insertText",false,t)){const sel=getSelection();if(sel.rangeCount){const r=sel.getRangeAt(0);r.deleteContents();r.insertNode(document.createTextNode(t));r.collapse(false)}el.dispatchEvent(new Event("input",{bubbles:true}))}
});
spread.addEventListener("focusout",e=>{     // tidy the diary into one paragraph per line so drop caps and indents stay right
  const el=e.target.closest('[data-field="diary"]');if(el) setField(el,book.spreads[cur][who(el.closest(".page").dataset.side)]);
});

/* ---------- toolbar ---------- */
$("#chips").addEventListener("scroll",chipFade,{passive:true});addEventListener("resize",()=>chipFade());
$("#chips").addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b) return;cur=+b.dataset.i;renderSpread()});
$("#add-spread").addEventListener("click",()=>{const n=newSpread(),c=book.spreads[cur];
  if(c.lh) n.lh=c.lh;if(c.size) n.size={...c.size};if(c.track) n.track={...c.track};
  book.spreads.splice(cur+1,0,n);cur++;renderSpread();touch();
  requestAnimationFrame(chipsInView)});
function move(d){const j=cur+d;if(j<0||j>=book.spreads.length) return;const a=book.spreads;[a[cur],a[j]]=[a[j],a[cur]];cur=j;renderSpread();touch()}
$("#move-prev").addEventListener("click",()=>move(-1));
$("#move-next").addEventListener("click",()=>move(1));
$("#del-spread").addEventListener("click",async()=>{
  const ok=await confirmBox("刪除這個跨頁？",`第 ${cur+1} 個跨頁的兩頁內容都會刪除。（刪除前會自動留一份副本，可在「備份 → 找回日記本」還原。）`,"刪除");
  if(!ok) return;
  await guard("刪除跨頁前");
  book.spreads.splice(cur,1);if(!book.spreads.length) book.spreads.push(newSpread());
  cur=Math.min(cur,book.spreads.length-1);renderSpread();touch();
});

/* settings column */
$("#book-sub").addEventListener("input",e=>{book.subtitle=e.target.value;for(const t of spread.querySelectorAll(".mtitle")) t.textContent=diaryName();touch()});
$("#theme-tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(!b||b.dataset.v===book.style.theme) return;
  book.style={theme:b.dataset.v,...THEMES[b.dataset.v].def};buildControls();applyStyle();touch()});
$("#color-dots").addEventListener("click",e=>{const b=e.target.closest("button");if(!b) return;book.style.color=b.dataset.v;applyStyle();touch()});
for(const c of document.querySelectorAll(".cycler")) c.addEventListener("click",e=>{const b=e.target.closest(".arw");if(!b) return;
  const key=c.dataset.key,ids=Object.keys(CYCLE[key]()),i=ids.indexOf(book.style[key]);
  book.style[key]=ids[(i+ +b.dataset.d+ids.length)%ids.length];applyStyle();touch()});
$("#seg-show").addEventListener("click",e=>{const b=e.target.closest("button");if(!b) return;state.show=b.dataset.v;meta.show=state.show;Store.set("meta",meta);
  if(state.show!=="both") panelWho=state.show;applyStyle()});
PHONE.addEventListener("change",()=>{if(book) applyStyle()});
addEventListener("resize",()=>document.querySelectorAll(".slide").forEach(slideSync));
/* ---------- fonts of your own: read in this browser, kept only on this device, never in backup files ---------- */
let userFonts=[];                                            // [{id,name,size}]; the files themselves are stored under "font:"+id
const FONT_UP="__up",FONT_MANAGE="__manage";
const isUserFont=id=>typeof id==="string"&&id.startsWith("u:");
const ufFamily=id=>{let h=5381;for(const c of id) h=((h<<5)+h+c.codePointAt(0))>>>0;return "UF-"+h.toString(36)};
function famOf(id){if(isUserFont(id)) return `'${ufFamily(id)}'`;return (byId(id)||FONTS[0]).family}
async function loadUserFont(id,buf){const ff=new FontFace(ufFamily(id),buf);await ff.load();document.fonts.add(ff)}
function buildFontSelect(){
  const sel=$("#font-sel"),names=book&&book.fontNames||{},used=book?[book.fonts.them,book.fonts.me]:[];
  const opt=(v,t)=>`<option value="${esc(v)}">${esc(t)}</option>`;
  let h=`<optgroup label="內建字體">${FONTS.map(f=>opt(f.id,label(f))).join("")}</optgroup>`;
  const mine=userFonts.map(f=>opt(f.id,f.name));
  for(const id of used) if(isUserFont(id)&&!userFonts.some(f=>f.id===id)) mine.push(opt(id,`${names[id]||"自訂字體"}（這台裝置沒有，請重新上傳）`));
  if(mine.length) h+=`<optgroup label="我的字體">${mine.join("")}</optgroup>`;
  h+=`<optgroup label="自訂">${opt(FONT_UP,"＋ 上傳字體…（只保存於本機）")}${userFonts.length?opt(FONT_MANAGE,"管理我的字體…"):""}</optgroup>`;
  sel.innerHTML=h;
  if(book) sel.value=book.fonts[panelWho];
}
const fontPicker=document.createElement("input");fontPicker.type="file";fontPicker.accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2";fontPicker.hidden=true;document.body.appendChild(fontPicker);
fontPicker.addEventListener("change",async()=>{
  const f=fontPicker.files[0];fontPicker.value="";if(!f) return;
  const ext=(f.name.match(/\.([a-z0-9]+)$/i)||[])[1]||"";
  if(/^(ttc|otc|dfont)$/i.test(ext)){toast("這是字體集合檔（.ttc），瀏覽器無法直接使用，請改用單一的 .ttf 或 .otf 檔。");return}
  if(!/^(ttf|otf|woff2?)$/i.test(ext)){toast("請選擇 .ttf、.otf、.woff 或 .woff2 字體檔。");return}
  const name=f.name.replace(/\.[^.]+$/,"").slice(0,60),id=`u:${name}|${f.size}`;
  try{const buf=await f.arrayBuffer();await loadUserFont(id,buf);
    if(!userFonts.some(x=>x.id===id)){userFonts.push({id,name,size:f.size});await Store.set("font:"+id,buf);await Store.set("fontlist",userFonts)}
  }catch(e){toast("這個字體檔讀不出來，可能已損壞或格式不支援。");return}
  book.fonts[panelWho]=id;(book.fontNames=book.fontNames||{})[id]=name;
  buildFontSelect();applyStyle();touch();
  toast(`已加入「${name}」，只保存在這台裝置。請確認字體授權允許你這樣使用。`);
});
function manageFonts(){
  const row=f=>`<div class="uf-row"><span>${esc(f.name)}<small>${(f.size/1048576).toFixed(1)} MB</small></span><button type="button" class="link danger" data-del="${esc(f.id)}">刪除</button></div>`;
  openDialog(`<h2 id="dlg-title">我的字體</h2>
    <p>這些字體只保存在這台裝置的瀏覽器裡，不會放進備份檔，分享備份檔也不會把字體帶出去。想在手機或其他裝置使用，請把字體檔存到那台裝置後，在字體選單再上傳一次。</p>
    <div class="uf-list">${userFonts.map(row).join("")}</div>
    <div class="row"><button type="button" class="btn solid" data-act="ok">完成</button></div>`);
  dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(true);
  dlg.querySelector(".uf-list").addEventListener("click",async e=>{const b=e.target.closest("[data-del]");if(!b) return;
    const id=b.dataset.del;userFonts=userFonts.filter(f=>f.id!==id);await Store.set("fontlist",userFonts);await Store.set("font:"+id,null);
    for(const ff of [...document.fonts]) if(ff.family.replace(/["']/g,"")===ufFamily(id)) document.fonts.delete(ff);
    b.closest(".uf-row").remove();buildFontSelect();applyStyle();
    if(!userFonts.length) closeDialog(true)});
}
$("#font-sel").addEventListener("change",e=>{
  const v=e.target.value;
  if(v===FONT_UP||v===FONT_MANAGE){e.target.value=book.fonts[panelWho];if(v===FONT_UP) fontPicker.click();else manageFonts();return}
  book.fonts[panelWho]=v;applyStyle();touch()});
async function loadUserFonts(){
  try{const list=await Store.get("fontlist");userFonts=Array.isArray(list)?list:[]}catch(e){userFonts=[]}
  const ok=[];
  for(const f of userFonts){try{const buf=await Store.get("font:"+f.id);if(buf instanceof ArrayBuffer){await loadUserFont(f.id,buf);ok.push(f)}}catch(e){}}
  userFonts=ok;buildFontSelect();
}
function setWho(p){if(p!==panelWho){panelWho=p;syncSteppers()}}
$("#who").addEventListener("click",e=>{const b=e.target.closest("button");if(b) setWho(b.dataset.v)});
spread.addEventListener("focusin",e=>{const pg=e.target.closest(".page");if(pg) setWho(who(pg.dataset.side))});
$("#step-rows").addEventListener("click",e=>{const b=e.target.closest(".arw");if(!b||b.disabled) return;
  const s=book.spreads[cur];if(s.state==="done") return;
  const geo=pageGeom(s.lh),rows=Math.max(geo.minR,Math.min(geo.maxR,geo.rows+ +b.dataset.d));
  s.lh=geo.avail/rows;
  const mx=maxPt(s.lh);if(s.size) for(const k in s.size) if(s.size[k]>mx) s.size[k]=mx;   // set sizes cannot be taller than the new lines
  applyStyle();touch()});
$("#step-size").addEventListener("click",e=>{const b=e.target.closest(".arw");if(!b||b.disabled) return;
  const s=book.spreads[cur],p=panelWho;if(s.state==="done") return;
  const lhn=pageGeom(s.lh).lhn,v=Math.max(PT_MIN,Math.min(maxPt(lhn),snap(sizeOf(s,p,lhn))+ +b.dataset.d));
  s.size={...(s.size||{}),[p]:v};applyStyle();touch()});
$("#track").addEventListener("click",e=>{const b=e.target.closest("button");if(!b||b.disabled) return;
  const s=book.spreads[cur],p=panelWho,v=+b.dataset.v;if(s.state==="done") return;
  s.track={...(s.track||{})};if(v===1) delete s.track[p];else s.track[p]=v;if(!Object.keys(s.track).length) delete s.track;
  applyStyle();touch()});
$("#size-reset").addEventListener("click",()=>{const s=book.spreads[cur];if(s.state==="done") return;delete s.lh;delete s.size;delete s.track;applyStyle();touch()});

/* swap left and right for the whole book (side-by-side view, wider screens) */
let toastTimer=0;
function toast(text,undo){const t=$("#toast");t.querySelector("span").textContent=text;t.hidden=false;
  const u=$("#toast-undo");u.hidden=!undo;u.onclick=()=>{t.hidden=true;undo&&undo()};
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true},6000)}
function swapSides(){book.swap=!book.swap;renderSpread();touch()}
$("#gswap").addEventListener("click",()=>{swapSides();
  toast(`已對調：我的日記在${book.swap?"左":"右"}頁`,()=>{swapSides();toast(`已復原：我的日記在${book.swap?"左":"右"}頁`)})});

/* action dock */
const copySides=s=>JSON.parse(JSON.stringify({them:s.them,me:s.me,objs:s.objs||[]}));
$("#btn-done").addEventListener("click",()=>{
  const s=book.spreads[cur];
  if(s.state==="done"){s.before=copySides(s);s.state="editing";applyLock();refreshNav();touch();
    const f=spread.querySelector('.page:not([style*="display: none"]) [data-field="diary"]');f&&f.focus();return}
  if(s.before) s.modified=Date.now();
  delete s.before;delete s.sample;s.state="done";if(!s.modified) s.modified=Date.now();
  applyLock();refreshNav();touch();
});
$("#btn-revert").addEventListener("click",async()=>{
  const s=book.spreads[cur];if(!s.before) return;
  if(!await confirmBox("還原成修改前？","這次修改的內容會被捨棄，跨頁回到按「修改」之前的樣子。","還原")) return;
  await guard("還原修改前");
  s.them=s.before.them;s.me=s.before.me;s.objs=s.before.objs||[];delete s.before;s.state="done";renderSpread();touch();
});
function toggleMenu(btn,menu,open){menu.hidden=!open;btn.setAttribute("aria-expanded",String(open));
  /* inside the phone's scrolling sheet the menu would be cut off: lift it out above the button */
  menu.style.cssText="";
  if(open&&getComputedStyle(menu.closest(".panel")||document.body).overflowY!=="visible"&&menu.closest(".panel")){
    const r=btn.getBoundingClientRect(),w=Math.max(r.width,200);
    menu.style.cssText=`position:fixed;bottom:${innerHeight-r.top+6}px;top:auto;left:${Math.max(8,Math.min(r.right-w,innerWidth-w-8))}px;right:auto;width:${w}px;max-height:${r.top-16}px;overflow:auto`}
  if(open){const f=menu.querySelector("button:not(:disabled)");f&&f.focus()}}
for(const [b,m] of [["#btn-output","#menu-output"],["#btn-backup","#menu-backup"]]){
  const btn=$(b),menu=$(m);
  btn.addEventListener("click",e=>{e.stopPropagation();const open=menu.hidden;document.querySelectorAll(".menu").forEach(x=>{x.hidden=true});document.querySelectorAll("[aria-haspopup]").forEach(x=>x.setAttribute("aria-expanded","false"));toggleMenu(btn,menu,open)});
}
document.addEventListener("click",e=>{if(!e.target.closest(".menu-wrap")) document.querySelectorAll(".menu").forEach(m=>{m.hidden=true;m.previousElementSibling.setAttribute("aria-expanded","false")})});
document.addEventListener("keydown",e=>{if(e.key==="Escape") document.querySelectorAll(".menu:not([hidden])").forEach(m=>{m.hidden=true;m.previousElementSibling.setAttribute("aria-expanded","false");m.previousElementSibling.focus()})});

/* ---------- dialogs ---------- */
const modal=$("#modal"),dlg=$("#dlg");let lastFocus=null,closeHook=null;
function openDialog(html,hook){lastFocus=document.activeElement;
  {const m=lastFocus&&lastFocus.closest&&lastFocus.closest(".menu-wrap");if(m) lastFocus=m.querySelector("button")}   // a menu item goes away with its menu
  dlg.innerHTML=html;modal.hidden=false;closeHook=hook||null;
  const f=dlg.querySelector("[autofocus],textarea,input,button");f&&f.focus()}
function closeDialog(v){modal.hidden=true;dlg.innerHTML="";const h=closeHook;closeHook=null;h&&h(v);lastFocus&&lastFocus.focus&&lastFocus.focus()}
modal.addEventListener("click",e=>{if(e.target===modal) closeDialog(false)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden) closeDialog(false)});
/* Tab stays inside an open dialog (and inside the tour's card) */
function trapTab(e,box){if(e.key!=="Tab"||!box) return;
  const f=[...box.querySelectorAll('button,[href],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&x.offsetParent);if(!f.length) return;
  const a=f[0],z=f[f.length-1];
  if(!box.contains(document.activeElement)){e.preventDefault();a.focus()}
  else if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}
document.addEventListener("keydown",e=>{if(!modal.hidden) trapTab(e,dlg);else trapTab(e,document.querySelector(".cm-tip"))});
function confirmBox(title,text,okLabel){
  return new Promise(res=>{openDialog(`<h2 id="dlg-title">${esc(title)}</h2><p>${esc(text)}</p>
    <div class="row"><button type="button" class="btn quiet" data-act="no" autofocus>取消</button><button type="button" class="btn danger" data-act="yes">${esc(okLabel)}</button></div>`,res);
    dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);dlg.querySelector('[data-act="yes"]').onclick=()=>closeDialog(true)});
}

/* paste */
$("#btn-paste").addEventListener("click",()=>{if(book.spreads[cur].state==="done") return;
  let side=effShow()==="me"?"me":"them";
  openDialog(`<h2 id="dlg-title">貼上日記內容</h2>
    <p>把日記整段貼進來，工具會自動找出日期、天氣、心情、日記、想對你說和快問快答。Markdown 的標題、｜、【】、粗體都看得懂；只會覆蓋找到的欄位。</p>
    <div class="ctl"><span class="cap">貼到</span><div class="slide" id="paste-side"><i class="thumb" aria-hidden="true"></i><button type="button" data-v="them">他的日記（${book.swap?"右":"左"}）</button><button type="button" data-v="me">我的日記（${book.swap?"左":"右"}）</button></div></div>
    <label class="sr-only" for="paste-text">要貼上的文字</label>
    <textarea id="paste-text" placeholder="日期：2026/10/07&#10;天氣：晴&#10;心情：今天的雲好像棉花糖&#10;日記：&#10;（正文，可以很多段）&#10;想對你說：&#10;（內容）&#10;快問快答：你最喜歡的季節是？"></textarea>
    <dl class="detect" id="paste-detect"></dl>
    <div class="row"><button type="button" class="btn quiet" data-act="no">取消</button><button type="button" class="btn solid" data-act="yes" disabled>填入</button></div>`);
  const ta=$("#paste-text"),seg=$("#paste-side"),okB=dlg.querySelector('[data-act="yes"]');
  const mark=()=>{orderButtons(seg);seg.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===side)));slideSync(seg)};
  const preview=()=>{const r=parsePasted(ta.value);
    if(!ta.value.trim()){$("#paste-detect").innerHTML="";okB.disabled=true;return}
    let h=["date","weather","mood","diary","say","q"].map(k=>`<dt>${FIELD_NAMES[k]}</dt><dd class="${r[k]?"":"miss"}">${r[k]?esc(r[k].split("\n")[0])+(r[k].includes("\n")?` …（共 ${r[k].split("\n").length} 段）`:""):"沒有找到，保持不變"}</dd>`).join("");
    if(r.ans) h+=`<dt>${FIELD_NAMES.ans}</dt><dd>${esc(r.ans)}</dd>`;
    if(r.ansOther) h+=`<dt>回答對方</dt><dd>${esc(r.ansOther)}（填到${side==="them"?"我":"他"}的日記的快問快答下面）</dd>`;
    if(r.name) h+=`<dt>名字</dt><dd>${esc(r.name)}${book.names[side]?"（頁面已有名字，不會覆蓋）":""}</dd>`;
    if(r.notes) h+=`<dt>備註</dt><dd>先收起來，之後可做成便條紙或拍立得（共 ${r.notes.split("\n").length} 行）</dd>`;
    $("#paste-detect").innerHTML=h;
    okB.disabled=!["date","weather","mood","diary","say","q","ans","ansOther"].some(k=>r[k])};
  seg.onclick=e=>{const b=e.target.closest("button");if(b){side=b.dataset.v;mark();preview()}};
  ta.addEventListener("input",preview);mark();
  dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);
  okB.onclick=()=>{const r=parsePasted(ta.value),s=book.spreads[cur];
    for(const k of FIELDS) if(r[k]){s[side][k]=r[k];if(s[side].fx) delete s[side].fx[k]}
    if(s[side].fx&&!Object.keys(s[side].fx).length) delete s[side].fx;
    if(r.ansOther){const o=side==="them"?"me":"them";s[o].ans=r.ansOther;if(s[o].fx){delete s[o].fx.ans;if(!Object.keys(s[o].fx).length) delete s[o].fx}}
    if(r.name&&!book.names[side]) book.names[side]=r.name;
    s.modified=Date.now();
    delete s.sample;closeDialog(true);renderSpread();touch();
    if(effShow()!=="both"){state.show=side;applyStyle()}};
  ta.focus();
});

/* export */
function fileName(){const t=new Date();return `${diaryName().replace(/[\\/:*?"<>|]+/g,"").trim()||"Exchange Diary"}-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}.diary`}
$("#btn-export").addEventListener("click",()=>{$("#menu-backup").hidden=true;meta.exported=Date.now();Store.set("meta",meta);
  const json=JSON.stringify(book,null,1),name=fileName(),small=json.length<1.5e6,mb=(json.length/1048576).toFixed(1);
  try{const url=URL.createObjectURL(new Blob([json],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}catch(e){}
  /* where downloads are blocked (some app previews, some phones) there are two more ways out:
     the phone's share sheet (save to Files, send to yourself), and copying the whole text */
  const file=(()=>{try{return new File([json],name,{type:"application/json"})}catch(e){return null}})();
  const canShare=!!(file&&navigator.canShare&&(()=>{try{return navigator.canShare({files:[file]})}catch(e){return false}})());
  openDialog(`<h2 id="dlg-title">匯出備份</h2>
    <p>已開始下載「${esc(name)}」（約 ${mb} MB）。這個檔案包含整本日記本，之後可以用「匯入備份」打開，或在另一台裝置繼續編輯。</p>
    <p>如果沒有開始下載：${canShare?"按「分享／存到檔案」存到手機的「檔案」或傳給自己；也可以":"可以"}按「複製全部內容」，貼到記事本後存成 .diary 檔${small?"":"（內容較大，貼上可能要等一下）"}。</p>
    ${small?`<label class="sr-only" for="export-text">備份內容</label><textarea id="export-text" readonly>${esc(json)}</textarea>`:""}
    <p class="err" id="export-msg" hidden></p>
    <div class="row">${canShare?'<button type="button" class="btn quiet" data-act="share">分享／存到檔案</button>':""}<button type="button" class="btn quiet" data-act="copy">複製全部內容</button><button type="button" class="btn solid" data-act="ok">完成</button></div>`);
  const msg=t=>{const p=$("#export-msg");p.textContent=t;p.hidden=!t};
  dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(true);
  dlg.querySelector('[data-act="copy"]').onclick=async e=>{
    try{await navigator.clipboard.writeText(json);e.target.textContent="已複製";msg("")}
    catch(err){const ta=$("#export-text");if(ta){ta.focus();ta.select();e.target.textContent="已選取，請手動複製"}else msg("這裡不允許複製這麼多文字。請改用電腦的瀏覽器開啟本工具再匯出。")}};
  const sh=dlg.querySelector('[data-act="share"]');
  if(sh) sh.onclick=async()=>{try{await navigator.share({files:[file],title:name})}catch(err){if(err&&err.name!=="AbortError") msg("這裡無法開啟分享，請改用「複製全部內容」。")}};
});

/* import */
$("#btn-import").addEventListener("click",()=>{$("#menu-backup").hidden=true;
  openDialog(`<h2 id="dlg-title">匯入備份</h2>
    <p>選擇之前匯出的 .diary 檔，或把備份內容貼在下面。匯入後會取代目前畫面上的日記本。</p>
    <div class="row start"><label class="sr-only" for="import-file">選擇備份檔</label><input type="file" id="import-file" accept=".diary,.json,application/json"></div>
    <label class="sr-only" for="import-text">備份內容</label><textarea id="import-text" placeholder="或把備份內容貼在這裡"></textarea>
    <p class="err" id="import-err" hidden></p>
    <div class="row"><button type="button" class="btn quiet" data-act="no">取消</button><button type="button" class="btn solid" data-act="yes">匯入</button></div>`);
  const err=t=>{const p=$("#import-err");p.textContent=t;p.hidden=!t};
  /* a file's text is kept aside rather than put in the box: a backup with many photos can be close to 100 MB */
  let fileText="";
  $("#import-file").addEventListener("change",e=>{const f=e.target.files[0];if(!f) return;const r=new FileReader();fileText="";
    r.onload=()=>{fileText=r.result;const ta=$("#import-text");ta.value="";ta.placeholder=`已讀取「${f.name}」（${(f.size/1048576).toFixed(1)} MB），按「匯入」開始`;e.target.dataset.ready="1";err("")};
    r.onerror=()=>err("讀不到這個檔案，請再選一次。");r.readAsText(f)});
  $("#import-text").addEventListener("input",()=>{fileText=""});
  dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);
  dlg.querySelector('[data-act="yes"]').onclick=async()=>{
    let nb;
    try{nb=normalize(JSON.parse(fileText||$("#import-text").value))}
    catch(e){err(e instanceof SyntaxError?"內容不是完整的備份檔，請確認有全部複製。":e.message);return}
    await guard("匯入前");
    const oldId=loadFailed?"":book.id;loadFailed=false;book=nb;cur=0;closeDialog(true);buildFontSelect();renderAll();
    save().then(ok=>{if(ok&&oldId&&oldId!==book.id) Store.del("book:"+oldId)});
    const miss=[book.fonts.them,book.fonts.me].filter(id=>isUserFont(id)&&!userFonts.some(f=>f.id===id));
    if(miss.length) toast(`這本日記用了「${miss.map(id=>book.fontNames[id]||"自訂字體").join("、")}」，這台裝置還沒有，請在字體選單重新上傳。`);
  };
});

/* first-run notice */
$("#notice-ok").addEventListener("click",()=>{$("#notice").hidden=true;meta.noticeSeen=true;Store.set("meta",meta)});

/* ---------- start ---------- */
/* the browser's database would not open: show the page, write nothing, ask for a fresh start */
function storageDown(e){
  console.error(e);meta={};book=newBook();loadFailed=true;failedId="";renderAll();
  status("瀏覽器的資料庫暫時打不開，這次不會儲存",true);
  openDialog(`<h2 id="dlg-title">暫時打不開日記資料</h2>
    <p>這次瀏覽器還沒讓工具讀取保存的日記。為了不覆蓋你的日記，這次<b>不會儲存</b>任何內容，原本的日記也不會被動到。</p>
    <p>工具會在背景繼續嘗試，一打開就自動重新載入。如果一分鐘後還是這樣，請關掉這個分頁再重新打開，或把瀏覽器完全關閉後再開。</p>
    <div class="row"><button type="button" class="btn quiet" data-act="ok">先看看</button><button type="button" class="btn solid" data-act="re">重新整理</button></div>`);
  dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(false);
  dlg.querySelector('[data-act="re"]').onclick=()=>location.reload();
}
(async function start(){
  let saved,id;
  try{
    if(await Store.ready()==="none") throw new Error("IndexedDB unavailable");
    meta=(await Store.get("meta"))||{};
    id=await Store.get("current");saved=id?await Store.get("book:"+id):null;
  }catch(e){storageDown(e);return}
  /* the database came back empty but the backup text is here: put the diary back before anything else is written */
  let fromMirror=null;
  if(!saved){try{const have=new Set((await Store.keys()).filter(k=>k.startsWith("book:")).map(k=>k.slice(5)));
    const m=mirrors().filter(x=>!have.has(x.id)).sort((a,b)=>b.data.spreads.length-a.data.spreads.length||b.t-a.t)[0];
    if(m&&await Store.set("book:"+m.id,m.data)&&await Store.set("current",m.id)){saved=m.data;id=m.id;fromMirror=m}}catch(e){console.error(e)}}
  /* when this browser's diary space was first used: tells a new or cleared space from an old one */
  if(!meta.since){meta.since=Date.now();meta.sinceVer=APP_VER;Store.set("meta",meta)}
  if(fromMirror){meta.noticeSeen=true;meta.tourSeen=true;meta.mirrorRestored=Date.now();Store.set("meta",meta)}
  state.show=["them","me","both"].includes(meta.show)?meta.show:"both";
  if(state.show!=="both") panelWho=state.show;
  await loadSnaps();
  /* a new version of the page (or an older one still cached): keep a copy of the diary as it was, before anything is written */
  if(saved){if(meta.ver!==APP_VER||saved.appVer!==APP_VER) await keepCopy(meta.ver&&meta.ver!==APP_VER?`更新前（${meta.ver} 版）`:"更新前",id);
    else if(Date.now()-lastSnap(id)>SNAP_EVERY) await keepCopy("自動保存",id)}
  if(meta.ver!==APP_VER){meta.ver=APP_VER;Store.set("meta",meta)}
  try{book=saved?normalize(await unpackBook(saved)):newBook()}catch(e){book=newBook();loadFailed=!!saved;failedId=id;console.error(e)}
  await loadUserFonts();
  {const miss=[book.fonts.them,book.fonts.me].filter(id=>isUserFont(id)&&!userFonts.some(f=>f.id===id));
   if(miss.length) setTimeout(()=>toast(`這本日記用了「${miss.map(id=>book.fontNames[id]||"自訂字體").join("、")}」，這台裝置還沒有，請在字體選單重新上傳。`),800)}
  renderAll();
  if(!loadFailed&&typeof Cloud!=="undefined") Cloud.start();
  if(!meta.noticeSeen&&typeof firstRun==="function") setTimeout(firstRun,400);
  if(loadFailed){status("上次的日記沒有讀取成功，已暫停自動儲存",true);setTimeout(()=>recoverBooks(true),600);return}
  if(!saved){
    /* nothing marked as current, but older diaries may still be in this browser: offer them before starting fresh */
    const others=[...(await Store.keys()),...Store.legacy.keys()].filter(k=>k.startsWith("book:"));
    if(others.length){setTimeout(()=>recoverBooks(false,true),900);status("找到之前的日記本");return}
    await save();
  } else {status("已載入上次的內容");writeMirror(saved)}
  if(fromMirror){const lost=book.spreads.reduce((n,s)=>n+(s.objs||[]).filter(o=>o.type==="photo"&&!o.src).length,0);
    setTimeout(()=>{openDialog(`<h2 id="dlg-title">日記救回來了</h2>
      <p>這次打開時，瀏覽器把這個網站的資料清掉了（電腦或手機空間不足時，瀏覽器有時會這樣做）。</p>
      <p>還好工具有另外多留一份文字，「${esc((book.subtitle||"").trim()||"日記")}」的 <b>${book.spreads.length} 個跨頁文字都救回來了</b>。</p>
      <ul class="dc-box">${lost?`<li>${lost} 張照片沒辦法一起救回：照片框和說明文字都還在，點一下照片框就能重新放上</li>`:""}<li>上傳的字體需要重新上傳</li></ul>
      <p class="rb-note">為了不再發生，建議現在就把日記「備份到別處」。</p>
      <div class="row"><button type="button" class="btn quiet" data-act="ok">知道了</button><button type="button" class="btn solid" data-act="exp">匯出備份檔</button></div>`);
      dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(true);
      dlg.querySelector('[data-act="exp"]').onclick=()=>{closeDialog(true);setTimeout(()=>$("#btn-export").click(),150)}},700)}
  /* ask the browser to keep this site's storage when the device runs low on space */
  try{if(navigator.storage&&navigator.storage.persist&&!(await navigator.storage.persisted())) navigator.storage.persist().catch(()=>{})}catch(e){}
})();

/* ---------- 找回日記本: every diary this browser still keeps ---------- */
async function recoverBooks(failed,found){
  let ids=[];try{ids=(await Store.keys()).filter(k=>k.startsWith("book:")).map(k=>k.slice(5))}catch(e){}
  /* diaries an older version left in the browser's other storage place (localStorage) */
  const lids=Store.legacy.keys().filter(k=>k.startsWith("book:")).map(k=>k.slice(5));
  const list=[];
  for(const id of lids){const b=Store.legacy.get("book:"+id);if(!b||!Array.isArray(b.spreads)) continue;
    list.push({id,legacy:true,name:(b.subtitle||"").trim()||"（沒有名稱）",n:b.spreads.length,
      when:b.updated?new Date(b.updated):null,first:(b.spreads.find(x=>x&&x.them&&x.them.date)||{them:{}}).them.date||""})}
  for(const id of ids){try{const b=await Store.get("book:"+id);if(!b||!Array.isArray(b.spreads)) continue;
    list.push({id,name:(b.subtitle||"").trim()||"（沒有名稱）",n:b.spreads.length,
      when:b.updated?new Date(b.updated):null,first:(b.spreads.find(x=>x&&x.them&&x.them.date)||{them:{}}).them.date||""})}catch(e){}}
  list.sort((a,b)=>(b.when||0)-(a.when||0));
  const fmt=d=>d?`${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`:"";
  const lead=failed?"<p>上次的日記沒有讀取成功。為了保護你的資料，這次不會自動儲存，原本的內容也還在這台裝置上。</p>"
    :found?"<p>這個瀏覽器裡還有之前寫的日記本，要打開哪一本？</p>":`<p>改錯、刪錯，或日記不見了，都可以在這裡找回來。<button type="button" class="link" data-act="how">日記怎麼保存？</button></p>`;
  const tagOf=src=>src==="cloud"?`<span class="vtag cloud">☁ 雲端</span>`:`<span class="vtag">這台</span>`;
  const whyOf=w=>!w?"":/^更新前/.test(w)?"網頁更新前":w;
  const vrow=v=>`<li><div><b>${fmt(new Date(v.t))}${tagOf(v.src)}</b><small>${[v.book!==book.id?esc(v.name||"（沒有名稱）"):"",whyOf(v.why),v.n+" 個跨頁"].filter(Boolean).map(x=>x).join("・")}</small></div>
      <button type="button" class="btn quiet" ${v.src==="cloud"?`data-cver="${esc(v.f)}" data-book="${esc(v.book)}"`:`data-snap="${esc(v.k)}"`}>還原</button></li>`;
  const local=[...snapIdx].map(x=>({...x,src:"here"}));
  const cloudOn=typeof Cloud!=="undefined"&&Cloud.on();
  openDialog(`<h2 id="dlg-title">找回日記本</h2>${lead}
    <h3 class="rb-h">你的日記本</h3>
    ${list.length?`<ul class="rb-list">${list.map(x=>`<li><div><b>${esc(x.name)}</b><small>${x.n} 個跨頁${x.first?"・從 "+esc(x.first):""}${x.when?"・最後修改 "+fmt(x.when):""}${x.legacy?"・存在瀏覽器的另一個位置":x.id===book.id&&!failed?"・目前打開中":""}</small></div>
      ${x.legacy?`<button type="button" class="btn solid" data-legacy="${esc(x.id)}">打開</button>`
        :`<button type="button" class="btn${x.id===book.id&&!failed?" quiet":" solid"}" data-open="${esc(x.id)}"${x.id===book.id&&!failed?" disabled":""}>打開</button>`}</li>`).join("")}</ul>`
      :"<p>這個瀏覽器裡沒有其他日記本。如果你是在別的瀏覽器或從主畫面寫的，請到那裡打開。</p>"}
    <h3 class="rb-h">歷史版本<small>工具自動留的${cloudOn?"，這台和雲端各最多 12、10 份":"，最多 12 份"}</small></h3>
    <ul class="rb-list" id="rb-vers">${local.length?local.sort((a,b)=>b.t-a.t).map(vrow).join(""):`<li class="rb-empty">還沒有歷史版本，寫一陣子之後就會有了。</li>`}</ul>
    ${cloudOn?"":`<div class="rb-away"><b>想換手機、清資料也不怕？</b>這些歷史版本都在這個瀏覽器裡，瀏覽器資料被清掉時會一起不見。把日記備份到別處更保險：
      <div class="row"><button type="button" class="btn quiet" data-act="exp">匯出備份檔</button>${typeof Cloud!=="undefined"&&Cloud.available?'<button type="button" class="btn quiet" data-act="cloud">開啟雲端備份</button>':""}</div></div>`}
    <p class="rb-more">遇到問題？<button type="button" class="link" data-act="diag">複製檢查資訊</button>給開發者</p><p class="rb-note" id="rb-diag" hidden></p>
    <div class="row">${found?'<button type="button" class="btn quiet" data-act="new">開一本新的</button>':""}<button type="button" class="btn solid" data-act="ok">關閉</button></div>`);
  dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(false);
  {const h=dlg.querySelector('[data-act="how"]');if(h) h.onclick=()=>{closeDialog(false);setTimeout(()=>typeof savingHelp==="function"&&savingHelp(),120)}}
  {const h=dlg.querySelector('[data-act="exp"]');if(h) h.onclick=()=>{closeDialog(false);setTimeout(()=>$("#btn-export").click(),120)}}
  {const h=dlg.querySelector('[data-act="cloud"]');if(h) h.onclick=()=>{closeDialog(false);setTimeout(()=>Cloud.open(),120)}}
  dlg.querySelector('[data-act="diag"]').onclick=async e=>{const r=await diagReport(),t=JSON.stringify(r,null,1),p=$("#rb-diag");
    try{await navigator.clipboard.writeText(t);e.target.textContent="已複製"}catch(err){p.hidden=false;p.textContent=t;e.target.textContent="請手動複製下面的文字"}};
  /* versions kept in the cloud join the same list, newest first */
  if(cloudOn) Cloud.versions().then(cv=>{const ul=$("#rb-vers");if(!ul||!cv||!cv.length) return;
    const all=[...local,...cv.map(v=>({...v,src:"cloud"}))].sort((a,b)=>b.t-a.t);ul.innerHTML=all.map(vrow).join("");bindVers()}).catch(()=>{});
  const nw=dlg.querySelector('[data-act="new"]');if(nw) nw.onclick=async()=>{closeDialog(true);await save()};
  const go=async id=>{if(!loadFailed){clearTimeout(saveTimer);await save()}leaving=true;await saving;await Store.set("current",id);location.reload()};
  dlg.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>go(b.dataset.open));
  /* bring a diary over from localStorage: copy its record and pictures, never delete the original */
  dlg.querySelectorAll("[data-legacy]").forEach(b=>b.onclick=async()=>{
    const lid=b.dataset.legacy,rec=Store.legacy.get("book:"+lid);if(!rec) return;
    let nid=lid;try{if(await Store.get("book:"+lid)) nid=lid+"-r"+Date.now().toString(36)}catch(e){toast("現在無法寫入，請重新整理後再試");return}
    for(const k of recImgs(rec)){const v=Store.legacy.get(k);if(typeof v==="string"&&!await Store.set(k,v)){toast("裝置空間不足，無法搬過來");return}}
    if(!await Store.set("book:"+nid,{...rec,id:nid})){toast("裝置空間不足，無法搬過來");return}
    go(nid)});
  dlg.querySelectorAll("[data-mirror]").forEach(b=>b.onclick=async()=>{
    const m=mirrors().find(x=>x.id===b.dataset.mirror);if(!m) return;
    if(!await confirmBox("還原備用副本？",`日記本「${(m.data.subtitle||"").trim()||"（沒有名稱）"}」會回到 ${fmt(new Date(m.t))} 的文字內容。現在的內容會先另存一份副本。`,"還原")) return;
    if(!loadFailed){clearTimeout(saveTimer);await save()}
    await queueSnap("還原前",m.id);leaving=true;await saving;
    if(!await Store.set("book:"+m.id,m.data)){leaving=false;toast("現在無法寫入，請重新整理後再試");return}
    await Store.set("current",m.id);location.reload()});
  bindVers();
  function bindVers(){
  dlg.querySelectorAll("[data-cver]").forEach(b=>b.onclick=async()=>{
    if(!await confirmBox("還原雲端的版本？","日記本會回到雲端上這個版本的樣子（照片會一起下載）。現在的內容會先另存一份歷史版本。","還原")) return;
    b.disabled=true;b.textContent="下載中…";try{await Cloud.restore(b.dataset.cver,b.dataset.book)}catch(e){b.disabled=false;b.textContent="還原";toast("現在沒辦法從雲端下載，請稍後再試")}});
  dlg.querySelectorAll("[data-snap]").forEach(b=>b.onclick=async()=>{
    const x=snapIdx.find(s=>s.k===b.dataset.snap);if(!x) return;
    if(!await confirmBox("還原這份副本？",`日記本會回到 ${fmt(new Date(x.t))} 的樣子。現在的內容會先另存一份副本，之後想改回來也可以。`,"還原")) return;
    const data=await Store.get(x.k);if(!data||!Array.isArray(data.spreads)){toast("這份副本讀不到了");return}
    if(!loadFailed&&x.book===book.id){clearTimeout(saveTimer);await save()}
    await queueSnap("還原前",x.book);leaving=true;await saving;
    if(!await Store.set("book:"+x.book,data)){leaving=false;toast("裝置空間不足，無法還原");return}
    await Store.set("current",x.book);location.reload()});
  }
}
/* storage facts only — never diary text — so a lost diary can be traced */
async function diagReport(){
  const f=t=>t?fmt2(new Date(t)):"",ua=navigator.userAgent;
  const how=(matchMedia("(display-mode: standalone)").matches||navigator.standalone===true)?"主畫面":
    /CriOS/.test(ua)?"Chrome（iPhone）":/FxiOS/.test(ua)?"Firefox（iPhone）":/EdgiOS/.test(ua)?"Edge（iPhone）":
    /iPhone|iPad/.test(ua)&&!/Safari\//.test(ua)?"App 內建瀏覽器":/iPhone|iPad/.test(ua)?"Safari":
    /Edg\//.test(ua)?"Edge":/Chrome\//.test(ua)?"Chrome":/Firefox\//.test(ua)?"Firefox":/Safari\//.test(ua)?"Safari":"其他";
  let keys=[];try{keys=await Store.keys()}catch(e){}
  const books=[];for(const k of keys.filter(k=>k.startsWith("book:"))){try{const b=await Store.get(k);books.push({id:k.slice(5),n:b&&Array.isArray(b.spreads)?b.spreads.length:-1,updated:f(b&&b.updated),created:f(b&&b.created),ver:b&&b.appVer||""})}catch(e){books.push({id:k.slice(5),err:String(e)})}}
  let persisted="不明",est="";try{persisted=(await navigator.storage.persisted())?"已開啟":"未開啟";const q=await navigator.storage.estimate();est=`${(q.usage/1048576).toFixed(1)} MB / ${(q.quota/1048576).toFixed(0)} MB`}catch(e){}
  return {app:APP_VER,at:f(Date.now()),site:location.origin+location.pathname,how,ua:ua.slice(0,160),since:f(meta.since)||"不明",sinceVer:meta.sinceVer||"",lastVer:meta.ver||"",
    noticeSeen:!!meta.noticeSeen,current:await Store.get("current").catch(()=>"?")||"",store:Store.mode,
    legacy:{keys:Store.legacy.keys().length,books:Store.legacy.keys().filter(k=>k.startsWith("book:")).map(k=>{const b=Store.legacy.get(k);return {id:k.slice(5),n:b&&b.spreads?b.spreads.length:-1,updated:f(b&&b.updated)}})},open:book&&book.id,loadFailed,storeErrors:Store.errs,traces:Store.traces().map(([t,m])=>f(t)+" "+m),mirrors:mirrors().map(m=>({id:m.id,t:f(m.t),n:m.data.spreads.length})),mirrorRestored:f(meta.mirrorRestored),persisted,usage:est,
    keys:{total:keys.length,book:books.length,img:keys.filter(k=>k.startsWith("img:")).length,snap:keys.filter(k=>k.startsWith("snap:")).length,font:keys.filter(k=>k.startsWith("font:")).length},
    books,copies:snapIdx.map(x=>({book:x.book,t:f(x.t),why:x.why,n:x.n}))};
}
const fmt2=d=>`${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
$("#btn-recover").addEventListener("click",()=>{$("#menu-backup").hidden=true;recoverBooks(false)});
