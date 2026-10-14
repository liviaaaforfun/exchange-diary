/* Exchange Diary — the three screens: 編輯 (edit), 讀日記 (read, a book you turn), 翻照片 (photos, a wall of every photo).
   Reading reuses the same open spread as editing, shown larger and read-only; page turns are drawn by an overlay
   made of copies of the pages, so the real spread underneath is already the new one when the animation ends. */
"use strict";

let view="edit",fromWall=false,wallNewest=true,wallScroll=0,turning=false;
const RM=matchMedia("(prefers-reduced-motion: reduce)");
const vstr=s=>spreadDate(s);
const fullDate=d=>{const m=String(d||"").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);return m?`${m[1]}/${pad(m[2])}/${pad(m[3])}`:""};

function setView(v,opts={}){
  if(v===view&&!opts.force) return;
  if(view==="photos") wallScroll=scrollY;
  view=v;document.body.classList.toggle("v-read",v==="read");document.body.classList.toggle("v-photos",v==="photos");
  for(const b of document.querySelectorAll(".views .view")){const on=b.dataset.view===v;b.classList.toggle("is-here",on);if(on) b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")}
  $("#wall").hidden=v!=="photos";
  if(v!=="read") fromWall=false;
  if(typeof select==="function"&&selId) select(null);
  if(typeof fxbar!=="undefined") fxbar.hidden=true;
  if(v==="photos"){renderWall();requestAnimationFrame(()=>scrollTo(0,opts.keepScroll?wallScroll:0))}
  else{renderSpread();if(v==="read") renderReader();scrollTo(0,0)}
}
document.querySelector(".views").addEventListener("click",e=>{const b=e.target.closest(".view");if(b) setView(b.dataset.view)});

/* ---------- reading ---------- */
function renderReader(){
  if(view!=="read") return;
  const s=book.spreads[cur],n=book.spreads.length;
  $("#rd-no").textContent=`No. ${pad(cur+1)}`;
  $("#rd-info").textContent=[spreadDate(s,true),`${cur+1} / ${n}`].filter(Boolean).join("　·　");
  $("#rd-back").hidden=!fromWall;
  $("#rd-prev").disabled=cur===0;$("#rd-next").disabled=cur===n-1;
  $("#rd-strip").innerHTML=book.spreads.map((sp,i)=>{
    const ph=(sp.objs||[]).find(o=>o.type==="photo"&&o.src);
    return `<button type="button" class="rd-th${i===cur?" on":""}" data-i="${i}" aria-label="第 ${i+1} 個跨頁"${i===cur?' aria-current="true"':""}><i${ph?` style="--ph:url('${imgURL(ph.src)}')"`:""}></i>No. ${pad(i+1)} · ${spreadDate(sp)||"--/--"}</button>`}).join("");
  const st=$("#rd-strip"),on=st.querySelector(".on");   // scroll only the strip, never the page
  if(on) st.scrollLeft=Math.max(0,on.offsetLeft-st.offsetLeft-(st.clientWidth-on.offsetWidth)/2);
}
/* page turn: desktop side by side → a leaf turns over the gutter; one page at a time → the old page slides away */
function turnTo(j){
  if(turning||j===cur||j<0||j>=book.spreads.length) return;
  const dir=j>cur?1:-1,both=posShow()==="both",animate=!RM.matches&&view==="read";
  let ov=null;
  if(animate){
    ov=spread.cloneNode(false);ov.removeAttribute("id");ov.classList.add("turn-ov");ov.setAttribute("aria-hidden","true");
    const L=pages[0].cloneNode(true),R=pages[1].cloneNode(true);
    if(both){
      const stay=dir>0?L:R,leafFront=dir>0?R:L;
      const slotS=document.createElement("div");slotS.className="t-slot "+(dir>0?"t-left":"t-right");slotS.appendChild(stay);
      const leaf=document.createElement("div");leaf.className="t-leaf "+(dir>0?"t-right":"t-left");
      const f=document.createElement("div");f.className="t-face t-front";f.appendChild(leafFront);
      const bk=document.createElement("div");bk.className="t-face t-back";leaf.append(f,bk);
      ov.append(slotS,leaf);ov.dataset.dir=dir>0?"next":"prev";
    }else{
      const vis=pages.find(p=>p.offsetParent);const c=(vis===pages[0]?L:R);
      const slot=document.createElement("div");slot.className="t-slot t-one";slot.appendChild(c);ov.append(slot);ov.dataset.dir=dir>0?"next":"prev";ov.classList.add("t-slide");
    }
    for(const x of ov.querySelectorAll("[contenteditable]")) x.removeAttribute("contenteditable");
    for(const x of ov.querySelectorAll("[id]")) x.removeAttribute("id");
  }
  cur=j;renderSpread();renderReader();
  if(!ov) return;
  if(both){   // the back of the turning leaf is the new page it lands on
    const land=(dir>0?pages[0]:pages[1]).cloneNode(true);
    for(const x of land.querySelectorAll("[contenteditable]")) x.removeAttribute("contenteditable");
    ov.querySelector(".t-back").appendChild(land);
  }
  spread.appendChild(ov);turning=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>ov.classList.add("go")));
  const done=()=>{ov.remove();turning=false};
  ov.addEventListener("transitionend",e=>{if(e.target===ov.querySelector(".t-leaf,.t-one")) done()},{once:false});
  setTimeout(()=>{if(ov.isConnected) done()},1100);
}
$("#rd-prev").addEventListener("click",()=>turnTo(cur-1));
$("#rd-next").addEventListener("click",()=>turnTo(cur+1));
$("#rd-strip").addEventListener("click",e=>{const b=e.target.closest(".rd-th");if(b) turnTo(+b.dataset.i)});
$("#rd-back").addEventListener("click",()=>setView("photos",{keepScroll:true}));
$("#rd-edit").addEventListener("click",()=>{setView("edit");
  const s=book.spreads[cur];if(s.state==="done") $("#btn-done").click();    // open it for changes, keeping a copy to go back to
});
document.addEventListener("keydown",e=>{
  if(view!=="read"||!$("#modal").hidden) return;
  if(e.target.closest&&e.target.closest("input,textarea,select,[contenteditable=true]")) return;
  if(e.key==="ArrowRight"||e.key==="PageDown"){e.preventDefault();turnTo(cur+1)}
  if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();turnTo(cur-1)}
});
/* swipe on touch screens */
let sw=null;
spread.addEventListener("touchstart",e=>{if(view!=="read"||e.touches.length!==1) return;sw={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()}},{passive:true});
spread.addEventListener("touchend",e=>{if(!sw) return;const t=e.changedTouches[0],dx=t.clientX-sw.x,dy=t.clientY-sw.y,fast=Date.now()-sw.t<700;sw=null;
  if(fast&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5) turnTo(cur+(dx<0?1:-1))},{passive:true});

/* ---------- the photo wall ---------- */
function wallItems(){
  const out=[];
  book.spreads.forEach((s,i)=>(s.objs||[]).forEach(o=>{
    if(o.type!=="photo"||!o.src) return;
    const onLeft=(book.swap?296-o.x:o.x)<148,person=onLeft?who("them"):who("me"),d=fullDate(s[person].date)||fullDate(s.them.date)||fullDate(s.me.date);
    out.push({o,i,d,key:(d||"0000/00/00")+"|"+pad(i)+"|"+pad(Math.round(o.y))});
  }));
  out.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  return wallNewest?out.reverse():out;
}
const ROT=[-2.4,1.7,-1.1,2.5,-1.9,1.2,-1.5,2.1,-.8,1.6];
function renderWall(){
  const items=wallItems();
  $("#wall-count").textContent=items.length?`共 ${items.length} 張照片・點照片打開那一頁`:"";
  $("#wall-sort").textContent=wallNewest?"最新在前 ⇅":"最舊在前 ⇅";$("#wall-sort").hidden=items.length<2;
  $("#wall-empty").hidden=!!items.length;
  /* masonry that keeps time order left to right: each card goes to the shortest column */
  const g=$("#wall-grid"),cols=Math.max(2,Math.min(4,Math.floor((g.clientWidth||900)/240))),hs=Array(cols).fill(0),bins=Array.from({length:cols},()=>[]);
  const ratio=o=>o.frame==="wide"?62/99:o.frame==="square"?1:o.frame==="bare"?1/(o.ar||1.33):62/46;
  const html=items.map((it,k)=>{const o=it.o,ar=o.frame==="wide"?"99/62":o.frame==="square"?"1":o.frame==="bare"?String(o.ar||1.33):"46/62";
    return `<button type="button" class="wcard${o.frame==="bare"?" bare":""}" data-i="${it.i}" data-oid="${o.id}" style="--r:${ROT[k%ROT.length]}deg">
      <span class="wimg" style="aspect-ratio:${ar};${photoBg(o)}"></span>
      <span class="wc"><span>${esc(o.cap||"")}</span><small>No. ${pad(it.i+1)}${it.d?" · "+it.d.slice(5):""}</small></span></button>`});
  items.forEach((it,k)=>{const c=hs.indexOf(Math.min(...hs));bins[c].push(html[k]);hs[c]+=ratio(it.o)+.3});
  g.style.setProperty("--cols",cols);
  g.innerHTML=bins.map(b=>`<div class="wcol">${b.join("")}</div>`).join("");
}
$("#wall-sort").addEventListener("click",()=>{wallNewest=!wallNewest;renderWall()});
let wallW=0;addEventListener("resize",()=>{if(view==="photos"&&Math.abs(innerWidth-wallW)>40){wallW=innerWidth;renderWall()}});
$("#wall-grid").addEventListener("click",e=>{const c=e.target.closest(".wcard");if(!c) return;
  cur=+c.dataset.i;fromWall=true;setView("read",{force:true});
  requestAnimationFrame(()=>requestAnimationFrame(()=>glow(c.dataset.oid)));
});
addEventListener("resize",()=>document.querySelectorAll(".glow").forEach(g=>g.remove()));   // a glow is placed for one layout only
function glow(id){
  const el=liveEl(id);if(!el) return;
  el.scrollIntoView({block:"center",behavior:RM.matches?"auto":"smooth"});
  const bk=$("#book"),r=el.getBoundingClientRect(),b=bk.getBoundingClientRect(),g=document.createElement("div");
  g.className="glow";g.style.cssText=`left:${r.left-b.left-8}px;top:${r.top-b.top-8}px;width:${r.width+16}px;height:${r.height+16}px`;
  bk.appendChild(g);setTimeout(()=>g.classList.add("fade"),2600);setTimeout(()=>g.remove(),3600);
}

/* keep the reader in step when the editor changes the current spread */
const _renderSpread=renderSpread;
renderSpread=function(){_renderSpread();if(view==="read") renderReader()};
for(const b of document.querySelectorAll(".views .view")) b.classList.toggle("is-here",b.dataset.view==="edit");
