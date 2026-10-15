/* Exchange Diary — things placed on the pages: photos, sticky notes, washi tape, stickers (phase 3).
   An object lives on the spread, not on one page: x and y are the centre in mm on the 296 × 210 open spread,
   as it is laid out with 他 on the left. With book.swap the spread is mirrored left to right, so an object
   stays with its person and keeps its distance from the outer edge.
   Each page has its own layer; an object is drawn in both, and each page clips its half,
   so something crossing the gutter shows whole side by side and split on a phone. */
"use strict";

const OBJ_W=296,OBJ_H=210,GUT=148;
const FRAMES={                                     // photo frames: real sizes in mm (paper, borders)
  polaroid:{name:"拍立得",W:54,H:86,b:4,bt:4,bb:20},
  square:{name:"方形",W:72,H:86,b:5,bt:5,bb:19},
  wide:{name:"寬幅",W:108,H:86,b:4.5,bt:4.5,bb:19.5},
  bare:{name:"無框"}
};
const NOTE_COLORS=["#f8eaa9","#f6d3d1","#d6e6d2","#d5e2ef","#ebe2f2"];
const TAPES=["plain","stripe","dot","diag"];
const DEF_W={polaroid:50,square:58,wide:80,bare:60,note:38,tape:52,sticker:30};
const TAPE_H=8;
let selId=null,lastTape=1,lastNote=0;
const uidO=()=>"o"+Math.random().toString(36).slice(2,9);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const objsOf=()=>{const s=book.spreads[cur];return s.objs||(s.objs=[])};
const findObj=id=>(book.spreads[cur].objs||[]).find(o=>o.id===id);
const isLocked=()=>book.spreads[cur].state==="done"||document.body.classList.contains("v-read");

/* ---------- geometry ---------- */
function objSize(o){
  if(o.type==="photo"){
    if(o.frame==="bare") return {w:o.w,h:o.w/(o.ar||1.33)};
    const F=FRAMES[o.frame]||FRAMES.polaroid;return {w:o.w,h:o.w*F.H/F.W};
  }
  if(o.type==="note") return {w:o.w,h:o.w};
  if(o.type==="tape") return {w:o.w,h:TAPE_H};
  return {w:o.w,h:o.w/(o.ar||1)};
}
const dispX=x=>book.swap?OBJ_W-x:x;                // stored ↔ shown (the mapping is its own inverse)
function extent(o){const {w,h}=objSize(o),r=(o.rot||0)*Math.PI/180;
  return {ex:(Math.abs(w*Math.cos(r))+Math.abs(h*Math.sin(r)))/2,ey:(Math.abs(w*Math.sin(r))+Math.abs(h*Math.cos(r)))/2}}
function crossesGutter(o){const X=dispX(o.x),{ex}=extent(o);return X-ex<GUT+1&&X+ex>GUT-1}
function overlaps(a,b){const A=extent(a),B=extent(b);
  return Math.abs(dispX(a.x)-dispX(b.x))<A.ex+B.ex&&Math.abs(a.y-b.y)<A.ey+B.ey}

/* photo framing: the picture covers its window, then zoom (z ≥ 1) and pan (x, y in %) */
function windowAspect(o){if(o.frame==="bare") return o.ar||1.33;const F=FRAMES[o.frame]||FRAMES.polaroid;return (F.W-2*F.b)/(F.H-F.bt-F.bb)}
const phAspect=o=>o.frame==="bare"?"":(()=>{const F=FRAMES[o.frame]||FRAMES.polaroid;return `aspect-ratio:${F.W-2*F.b}/${F.H-F.bt-F.bb};`})();
/* pictures are shown through short blob: addresses made once per picture, so pages and the photo wall are not
   rebuilt around strings of several hundred kilobytes each time they are drawn */
const blobURLs=new Map();
function imgURL(src){
  if(typeof src!=="string"||!src.startsWith("data:")) return src||"";
  let u=blobURLs.get(src);if(u) return u;
  try{const i=src.indexOf(","),head=src.slice(5,i),type=head.split(";")[0]||"image/jpeg",bin=/;base64/.test(head)?atob(src.slice(i+1)):decodeURIComponent(src.slice(i+1));
    const a=new Uint8Array(bin.length);for(let j=0;j<bin.length;j++) a[j]=bin.charCodeAt(j);u=URL.createObjectURL(new Blob([a],{type}))}
  catch(e){u=src}
  blobURLs.set(src,u);return u;
}
function photoBg(o){
  if(!o.src) return "";
  const c=o.crop||{z:1,x:50,y:50},bw=Math.max(1,(o.ar||1.33)/windowAspect(o))*c.z*100;
  return `background-image:url('${imgURL(o.src)}');background-size:${bw.toFixed(2)}% auto;background-position:${c.x.toFixed(1)}% ${c.y.toFixed(1)}%`;
}
let cropId=null;

/* ---------- drawing ---------- */
/* a page clips what hangs over its edge; it must never scroll its own content (focus or find-in-page could) */
pages.forEach(pg=>pg.addEventListener("scroll",()=>{pg.scrollTop=0;pg.scrollLeft=0}));
const layers=pages.map(pg=>{const d=document.createElement("div");d.className="objs";pg.appendChild(d);return d});
const posOff=pg=>pg.dataset.side==="them"?0:GUT;
function objHTML(o){
  const sel=o.id===selId&&!isLocked();
  const handles=sel?`<div class="o-sel">${o.lock?"":'<span class="o-rl"></span><i class="o-h o-rot" data-h="rot"></i><i class="o-h" data-h="nw"></i><i class="o-h" data-h="ne"></i><i class="o-h" data-h="sw"></i><i class="o-h" data-h="se"></i>'}</div>`:"";
  const person=dispX(o.x)<GUT?who("them"):who("me");
  const font=`font-family:var(--font-${dispX(o.x)<GUT?"them":"me"}),var(--fallback)`;
  let inner="";
  if(o.type==="photo"){
    const ph=`<div class="o-ph${o.src?"":" o-empty"}" style="${phAspect(o)}${photoBg(o)}">${o.src?"":'<button type="button" class="o-add">＋ 加入照片</button>'}</div>`;
    if(o.frame==="bare") inner=ph;
    else{const F=FRAMES[o.frame]||FRAMES.polaroid,k=o.w/F.W;
      inner=`<div class="o-frame" style="padding:calc(var(--mm)*${(F.bt*k).toFixed(2)}) calc(var(--mm)*${(F.b*k).toFixed(2)}) 0">
        ${ph}
        <div class="o-cap" style="height:calc(var(--mm)*${(F.bb*k).toFixed(2)});font-size:calc(var(--mm)*${(3.4*Math.sqrt(k)*(o.cs||1)).toFixed(2)});${font}"><span class="o-text" data-key="cap" data-ph="寫一句話…">${capHTML(o)}</span></div></div>`}
  }else if(o.type==="note"){
    inner=`<div class="o-note" style="background-color:${NOTE_COLORS[o.color||0]};font-size:calc(var(--mm)*${(o.w*(o.fs||.088)).toFixed(2)});${font}"><span class="o-text" data-key="text" data-ph="寫點什麼…">${noteHTML(o)}</span></div>`;
  }else if(o.type==="tape"){
    inner=`<div class="o-tape t-${TAPES[o.pattern||0]}"></div>`;
  }else inner=`<img class="o-img" src="${imgURL(o.src)}" alt="" draggable="false">`;
  return `<div class="obj ot-${o.type}${o.id===cropId?" o-cropping":""}${o.type==="photo"?" f-"+(o.frame||"polaroid"):""}${o.shadow?" o-shadow":""}${o.lock?" o-locked":""}${sel?" o-on":""}" data-oid="${o.id}" data-person="${person}">${inner}${handles}</div>`;
}
function placeEl(el,o,pg){
  const {w,h}=objSize(o),X=dispX(o.x)-posOff(pg);
  el.style.cssText+=`;left:calc(var(--mm)*${(X-w/2).toFixed(2)});top:calc(var(--mm)*${(o.y-h/2).toFixed(2)});width:calc(var(--mm)*${w.toFixed(2)});height:calc(var(--mm)*${h.toFixed(2)});transform:rotate(${(o.rot||0).toFixed(1)}deg);z-index:${el.dataset.z}`;
}
const OBJ_NAMES={photo:"照片",note:"便利貼",tape:"紙膠帶",sticker:"貼紙"};
function renderObjs(){
  const list=objsOf(),locked=isLocked(),ae=document.activeElement,refocus=ae&&ae.classList&&ae.classList.contains("obj")?ae.dataset.oid:null;
  layers.forEach((L,i)=>{
    const pg=pages[i];
    L.classList.toggle("is-locked",locked);
    L.innerHTML=list.map(objHTML).join("")+list.filter(crossesGutter).map(o=>`<button type="button" class="o-warn" data-oid="${o.id}" aria-label="跨過中縫的提醒">!</button>`).join("");
    L.querySelectorAll(".obj").forEach((el,j)=>{el.dataset.z=j+1;placeEl(el,list[j],pg)});
    L.querySelectorAll(".o-warn").forEach(b=>{const o=findObj(b.dataset.oid),{ex,ey}=extent(o);
      b.style.left=`calc(var(--mm)*${(dispX(o.x)+ex-posOff(pg)-1).toFixed(2)})`;b.style.top=`calc(var(--mm)*${(o.y-ey-1).toFixed(2)})`});
    L.querySelectorAll(".o-text").forEach(t=>{t.contentEditable=locked?"false":"true";t.spellcheck=false});
    /* keyboard: each object can be reached once, on the page it sits on (its copy on the other page is skipped) */
    if(!locked) L.querySelectorAll(".obj").forEach((el,j)=>{const o=list[j];if((dispX(o.x)<GUT?"them":"me")!==pg.dataset.side) return;
      const t=(o.type==="photo"&&o.cap)||(o.type==="note"&&o.text)||"";
      el.tabIndex=0;el.setAttribute("role","group");el.setAttribute("aria-roledescription","物件");
      el.setAttribute("aria-label",`${OBJ_NAMES[o.type]||"物件"}${t?"「"+t.replace(/\s+/g," ").slice(0,20)+"」":""}。方向鍵移動（加 Shift 一次 5 公釐），Enter 開啟操作列，Delete 刪除，Esc 取消選取`)});
  });
  if(refocus){const el=homeEl(refocus);if(el){refocusing=true;el.focus({preventScroll:true});refocusing=false}}
  syncObjBar();
}
let refocusing=false;
function homeEl(id){return layers.map(L=>L.querySelector(`.obj[data-oid="${id}"][tabindex]`)).find(Boolean)}
/* focus from the keyboard selects; Enter moves into the object's tool bar */
spread.addEventListener("focusin",e=>{const el=e.target;if(refocusing||!el.classList||!el.classList.contains("obj")||isLocked()||drag) return;
  if(el.matches(":focus-visible")) select(el.dataset.oid)});
spread.addEventListener("keydown",e=>{const el=e.target;if(!el.classList||!el.classList.contains("obj")) return;
  if(e.key==="Enter"||e.key===" "){e.preventDefault();select(el.dataset.oid);requestAnimationFrame(()=>{const b=bar.querySelector("button");if(b&&!bar.hidden) b.focus()})}});
/* during a drag only the moving object is restyled, so photos are not decoded again */
function restyle(o){
  layers.forEach((L,i)=>{const el=L.querySelector(`.obj[data-oid="${o.id}"]`);if(el) placeEl(el,o,pages[i])});
}

/* ---------- adding ---------- */
function targetPos(){const v=posShow();return v==="both"?who(panelWho):v}   // the page position new things go to
function addObj(o,at){
  const pos=targetPos(),X=at?at.X:(pos==="them"?74:222)+(Math.random()*16-8);
  o.id=uidO();o.x=dispX(X);o.y=at?at.Y:96+Math.random()*24;
  if(o.rot===undefined) o.rot=Math.round(Math.random()*8-4);
  const s=book.spreads[cur];(s.objs||(s.objs=[])).push(o);
  if(o.type==="tape") tapeOnTop(o);
  s.modified=Date.now();delete s.sample;selId=o.id;renderObjs();touch();
  if(o.type==="note") focusText(o.id,"text");
}
function focusText(id,key){const el=liveEl(id),t=el&&el.querySelector(`.o-text[data-key="${key}"]`);if(!t) return;
  t.focus({preventScroll:true});const r=document.createRange();r.selectNodeContents(t);r.collapse(false);const g=getSelection();g.removeAllRanges();g.addRange(r)}
function tapeOnTop(t){            // tape is there to hold things down: keep it above whatever it touches
  const a=objsOf(),i=a.indexOf(t);let top=i;
  a.forEach((o,j)=>{if(o!==t&&j>top&&overlaps(o,t)) top=j});
  if(top>i){a.splice(i,1);a.splice(top,0,t)}
}

/* images: scaled down to what print needs (about 300 dpi at the size they are used) */
function readImage(file,max,keepAlpha){
  return new Promise((res,rej)=>{
    if(!/^image\//.test(file.type)) return rej(new Error("這個檔案不是圖片。"));
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{const sc=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.round(img.naturalWidth*sc),h=Math.round(img.naturalHeight*sc);
      const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d");
      if(!keepAlpha){g.fillStyle="#fff";g.fillRect(0,0,w,h)}
      g.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);
      const png=keepAlpha&&file.type!=="image/jpeg";
      res({src:c.toDataURL(png?"image/png":"image/jpeg",.86),ar:w/h})};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("讀不到這張圖片（HEIC 等格式請先轉成 JPG 或 PNG）。"))};
    img.src=url;
  });
}
const picker=document.createElement("input");picker.type="file";picker.accept="image/*";picker.hidden=true;document.body.appendChild(picker);
function pick(kind,at,slot){
  picker.value="";
  picker.onchange=async()=>{const f=picker.files[0];if(!f) return;
    try{
      if(slot){const o=findObj(slot);if(!o) return;const im=await readImage(f,1600,false);o.src=im.src;o.ar=im.ar;delete o.crop;
        book.spreads[cur].modified=Date.now();renderObjs();touch();return}
      if(kind==="sticker"){const im=await readImage(f,1200,true);addObj({type:"sticker",src:im.src,ar:im.ar,w:DEF_W.sticker,shadow:true},at)}
      else{const im=await readImage(f,1600,false);addObj({type:"photo",frame:"polaroid",src:im.src,ar:im.ar,w:DEF_W.polaroid,shadow:true,cap:""},at)}
    }catch(e){toast(e.message)}};
  picker.click();
}
$("#mat-photo").addEventListener("click",()=>pick("photo"));
$("#mat-sticker").addEventListener("click",()=>pick("sticker"));
$("#mat-note").addEventListener("click",()=>addObj({type:"note",color:lastNote,w:DEF_W.note,shadow:true,text:""}));
$("#mat-tape").addEventListener("click",()=>addObj({type:"tape",pattern:lastTape,w:DEF_W.tape,rot:-8-Math.round(Math.random()*6)}));

/* drop photos straight onto a page */
function dropPoint(e){const pg=e.target.closest&&e.target.closest(".page");if(!pg) return null;
  const r=pg.getBoundingClientRect(),mm=r.width/148;return {X:(e.clientX-r.left)/mm+posOff(pg),Y:clamp((e.clientY-r.top)/mm,10,200)}}
spread.addEventListener("dragover",e=>{if(isLocked()||!e.dataTransfer||![...e.dataTransfer.types].includes("Files")) return;e.preventDefault();e.dataTransfer.dropEffect="copy"});
spread.addEventListener("drop",async e=>{if(isLocked()) return;const f=e.dataTransfer&&e.dataTransfer.files[0];if(!f) return;e.preventDefault();
  const at=dropPoint(e);
  try{const im=await readImage(f,1600,false);addObj({type:"photo",frame:"polaroid",src:im.src,ar:im.ar,w:DEF_W.polaroid,shadow:true,cap:""},at)}catch(err){toast(err.message)}});

/* ---------- selecting, moving, resizing, turning ---------- */
let drag=null;
function select(id){if(selId===id) return;if(cropId&&cropId!==id) cropId=null;selId=id;closePops();renderObjs()}
document.addEventListener("click",e=>{const a=e.target.closest(".o-add");if(!a||isLocked()) return;
  const el=a.closest(".obj");select(el.dataset.oid);pick("photo",null,el.dataset.oid)});
/* two fingers on a selected object: pinch to resize, turn to rotate (snaps to straight near 0°) */
const touches=new Map();
const pinchState=()=>{const [a,b]=[...touches.values()];return {d:Math.hypot(b.x-a.x,b.y-a.y)||1,a:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI}};
document.addEventListener("pointerdown",e=>{
  if(e.pointerType!=="touch") return;
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size===2&&selId&&!isLocked()){const o=findObj(selId);if(!o||o.lock) return;
    const s=pinchState();drag={o,mode:"pinch",d0:s.d,a0:s.a,w0:o.w,r0:o.rot||0,moved:true};hideBar();e.preventDefault();e.stopImmediatePropagation()}
},true);
const dropTouch=e=>{if(!touches.delete(e.pointerId)) return;
  if(drag&&drag.mode==="pinch"&&touches.size<2){const o=drag.o;drag=null;book.spreads[cur].modified=Date.now();renderObjs();touch();syncObjBar()}};
document.addEventListener("pointerup",dropTouch,true);document.addEventListener("pointercancel",dropTouch,true);
document.addEventListener("pointermove",e=>{
  if(!touches.has(e.pointerId)) return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(!drag||drag.mode!=="pinch"||touches.size<2) return;
  e.preventDefault();e.stopImmediatePropagation();
  const s=pinchState(),d=drag,o=d.o;
  o.w=clamp(d.w0*s.d/d.d0,10,260);
  let r=d.r0+(s.a-d.a0);while(r>180) r-=360;while(r<-180) r+=360;if(Math.abs(r)<3) r=0;o.rot=Math.round(r*10)/10;
  restyle(o);
},{capture:true,passive:false});
document.addEventListener("pointerdown",e=>{
  if(e.target.closest(".objbar,.o-pop,.o-warn,#toast,.modal,.o-add")) return;
  const el=e.target.closest(".obj");
  if(!el||isLocked()){if(selId&&!e.target.closest(".objbar")){select(null)}return}
  const o=findObj(el.dataset.oid);if(!o) return;
  const handle=e.target.closest(".o-h");
  if(selId!==o.id){select(o.id)}
  // typing in a note or caption: a press on text of the selected object goes to the text
  const zone=e.target.closest(".o-note,.o-cap"),txt=zone&&zone.querySelector(".o-text");
  const onWords=!!e.target.closest(".o-text");
  if(!handle&&txt&&onWords&&document.activeElement===txt) return;          // typing: let the press select words
  if(o.lock) return;
  if(cropId===o.id&&e.target.closest(".o-ph")){
    const ph=e.target.closest(".o-ph"),r=ph.getBoundingClientRect();
    drag={o,mode:"pan",sx:e.clientX,sy:e.clientY,c0:{...(o.crop||{z:1,x:50,y:50})},pw:r.width,phh:r.height,moved:false};e.preventDefault();return}
  if(cropId&&cropId!==o.id) endCrop();
  const live=layers.map(L=>L.querySelector(`.obj[data-oid="${o.id}"]`)).find(x=>x&&x.offsetParent&&x.getBoundingClientRect().width);
  const pg=(live||el).closest(".page"),mm=pg.getBoundingClientRect().width/148,r=(live||el).getBoundingClientRect();
  drag={o,mode:handle?handle.dataset.h:"move",sx:e.clientX,sy:e.clientY,x0:o.x,y0:o.y,w0:o.w,cx:r.left+r.width/2,cy:r.top+r.height/2,mm,moved:false,text:txt,onWords};
  if(handle||!onWords) e.preventDefault();
  hideBar();
});
document.addEventListener("pointermove",e=>{
  if(!drag) return;const d=drag,o=d.o,dx=e.clientX-d.sx,dy=e.clientY-d.sy;
  if(!d.moved&&Math.hypot(dx,dy)<4) return;
  d.moved=true;e.preventDefault();
  if(d.mode==="pan"){
    const c=o.crop=o.crop||{...d.c0},iw=d.pw*Math.max(1,(o.ar||1.33)/windowAspect(o))*c.z,ih=iw/(o.ar||1.33);
    c.x=iw>d.pw+1?clamp(d.c0.x-dx/(iw-d.pw)*100,0,100):50;c.y=ih>d.phh+1?clamp(d.c0.y-dy/(ih-d.phh)*100,0,100):50;
    layers.forEach(L=>{const p=L.querySelector(`.obj[data-oid="${o.id}"] .o-ph`);if(p) p.style.backgroundPosition=`${c.x.toFixed(1)}% ${c.y.toFixed(1)}%`});return}
  if(d.mode==="move"){o.x=clamp(d.x0+(book.swap?-1:1)*dx/d.mm,-20,OBJ_W+20);o.y=clamp(d.y0+dy/d.mm,-20,OBJ_H+20)}
  else if(d.mode==="rot"){let a=Math.atan2(e.clientY-d.cy,e.clientX-d.cx)*180/Math.PI+90;if(a>180) a-=360;if(Math.abs(a)<3) a=0;o.rot=Math.round(a*10)/10}
  else{const r0=Math.hypot(d.sx-d.cx,d.sy-d.cy)||1,r1=Math.hypot(e.clientX-d.cx,e.clientY-d.cy);o.w=clamp(d.w0*r1/r0,10,260)}
  restyle(o);
});
document.addEventListener("pointerup",e=>{
  if(!drag) return;const d=drag;drag=null;
  if(d.moved&&d.mode==="pan"){book.spreads[cur].modified=Date.now();touch();syncObjBar();return}
  if(d.moved){if(d.o.type==="tape") tapeOnTop(d.o);book.spreads[cur].modified=Date.now();renderObjs();touch()}
  else if(d.text&&d.o.id===selId){const el=liveEl(d.o.id),t=el&&el.querySelector(`.o-text[data-key="${d.text.dataset.key}"]`);
    if(t&&document.activeElement!==t) focusText(d.o.id,d.text.dataset.key)}
  syncObjBar();
});
document.addEventListener("keydown",e=>{
  if(!selId||isLocked()) return;
  if(e.target.closest&&e.target.closest("[contenteditable=true],input,textarea,select")) return;
  const o=findObj(selId);if(!o) return;
  if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();act("del");return}
  const step=e.shiftKey?5:1,m={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(m&&!o.lock){e.preventDefault();o.x+=m[0]*step*(book.swap?-1:1);o.y+=m[1]*step;renderObjs();touch()}
  if(e.key==="Escape"){if(cropId) endCrop();else select(null)}
});
spread.addEventListener("wheel",e=>{const ph=e.target.closest(".o-cropping .o-ph");if(!ph) return;e.preventDefault();zoomCrop(e.deltaY<0?1:-1)},{passive:false});
function zoomCrop(dir){const o=findObj(cropId);if(!o) return;const c=o.crop=o.crop||{z:1,x:50,y:50};
  c.z=clamp(Math.round((c.z+dir*.15)*100)/100,1,4);book.spreads[cur].modified=Date.now();renderObjs();touch()}
function endCrop(){if(!cropId) return;cropId=null;renderObjs()}

/* text on notes and polaroid captions */
document.addEventListener("input",e=>{const t=e.target.closest&&e.target.closest(".objs .o-text");if(!t) return;
  const o=findObj(t.closest(".obj").dataset.oid);if(!o) return;
  if(t.dataset.key==="text") noteStore(o,readLines(t));          // sticky notes keep styled words
  else if(t.dataset.key==="cap") capStore(o,readLines(t));       // so do polaroid captions
  // keep the twin on the other page in step
  layers.forEach(L=>{const x=L.querySelector(`.obj[data-oid="${o.id}"] .o-text[data-key="${t.dataset.key}"]`);if(x&&x!==t){if(t.dataset.key==="text") x.innerHTML=noteHTML(o);else if(t.dataset.key==="cap") x.innerHTML=capHTML(o);else x.textContent=o[t.dataset.key]}});
  book.spreads[cur].modified=Date.now();touch()});
document.addEventListener("paste",e=>{const t=e.target.closest&&e.target.closest(".objs .o-text");if(!t) return;e.preventDefault();
  document.execCommand("insertText",false,(e.clipboardData.getData("text/plain")||""))});

/* ---------- the bar over a selected object ---------- */
const bar=document.createElement("div");bar.className="objbar";bar.setAttribute("role","toolbar");bar.setAttribute("aria-label","物件操作");bar.hidden=true;document.body.appendChild(bar);
bar.addEventListener("keydown",e=>{if(e.key==="Escape"&&selId){const el=homeEl(selId);if(el){e.preventDefault();e.stopPropagation();el.focus()}}});
function barHTML(o){
  const g=x=>`<span class="g">${x}</span>`,b=(act,txt,on,cls="")=>`<button type="button" data-act="${act}" class="${cls}"${on!==undefined?` aria-pressed="${on}"`:""}>${txt}</button>`;
  let first="";
  if(o.type==="photo"&&o.id===cropId) return g(b("zout","縮小")+b("zin","放大"))+`<span class="g hint-g">拖曳照片調整位置</span>`+g(b("cropdone","完成",true));
  if(o.type==="photo") first=g(b("frame",`${FRAMES[o.frame||"polaroid"].name} ▾`)+(o.src?b("crop","取景"):""))+
    ((o.frame||"polaroid")!=="bare"?`<span class="g" role="group" aria-label="說明文字大小">${b("capdn","字−")}${b("capup","字＋")}</span>`:"");
  if(o.type==="note") first=`<span class="g dots">${NOTE_COLORS.map((c,i)=>`<button type="button" data-act="color" data-v="${i}" aria-label="便利貼顏色 ${i+1}" aria-pressed="${(o.color||0)===i}"><i style="background:${c}"></i></button>`).join("")}</span>`;
  if(o.type==="tape") first=`<span class="g dots">${TAPES.map((t,i)=>`<button type="button" data-act="pattern" data-v="${i}" aria-label="紙膠帶花樣 ${i+1}" aria-pressed="${(o.pattern||0)===i}"><i class="tw t-${t}"></i></button>`).join("")}</span>`;
  if(o.lock) return g(b("lock","解除鎖定",true));
  return first+g(b("layer","圖層 ▾"))+g(b("dup","複製"))+g(b("lock","鎖定",false)+(o.type!=="tape"?b("shadow","陰影",!!o.shadow):""))+g(b("del","刪除",undefined,"dl"));
}
function hideBar(){bar.hidden=true;closePops()}
function liveEl(id){return layers.map(L=>L.querySelector(`.obj[data-oid="${id}"]`)).find(x=>x&&x.offsetParent&&x.getBoundingClientRect().width>0)}
function syncObjBar(){
  const o=selId&&findObj(selId);
  if(!o||isLocked()||drag){if(!o&&selId) selId=null;hideBar();return}
  bar.innerHTML=barHTML(o);bar.hidden=false;
  if(PHONE.matches){bar.style.left="";bar.style.top="";return}
  const el=liveEl(o.id);if(!el){bar.hidden=true;return}
  const r=el.getBoundingClientRect(),w=bar.offsetWidth,h=bar.offsetHeight;
  let top=r.top-h-(PHONE.matches?14:46);if(top<8) top=r.bottom+14;     // clear of the turning knob
  bar.style.top=Math.min(top,innerHeight-h-8)+"px";bar.style.left=clamp(r.left+r.width/2-w/2,8,innerWidth-w-8)+"px";
}
addEventListener("scroll",()=>{if(!bar.hidden) syncObjBar()},{passive:true});
addEventListener("resize",()=>{if(!bar.hidden) syncObjBar()});
bar.addEventListener("pointerdown",e=>e.preventDefault());

/* small menus that open under a bar button, and the gutter note */
let pop=null;
function closePops(){if(pop){pop.remove();pop=null}}
function openPop(anchor,html,onPick){
  closePops();pop=document.createElement("div");pop.className="o-pop";pop.innerHTML=html;document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect();
  pop.style.left=clamp(r.left,8,innerWidth-pop.offsetWidth-8)+"px";
  pop.style.top=(r.bottom+6+pop.offsetHeight>innerHeight?r.top-pop.offsetHeight-6:r.bottom+6)+"px";
  if(onPick) pop.addEventListener("click",e=>{const b=e.target.closest("button[data-v]");if(b){onPick(b.dataset.v);closePops()}});
}
document.addEventListener("pointerdown",e=>{if(pop&&!e.target.closest(".o-pop,.objbar,.o-warn")) closePops()});
document.addEventListener("click",e=>{
  const w=e.target.closest(".o-warn");if(!w) return;
  openPop(w,`<b>跨過中縫</b><p>膠裝時中縫附近約數 mm 會被吃進書背，這個物件印出來可能被切掉一部分。</p>`);
});
function act(a,v,btn){
  const s=book.spreads[cur],a2=s.objs||[],o=findObj(selId);if(!o) return;
  const i=a2.indexOf(o);
  if(a==="del"){a2.splice(i,1);selId=null}
  else if(a==="dup"){const c=JSON.parse(JSON.stringify(o));c.id=uidO();c.x+=book.swap?-6:6;c.y+=6;c.lock=false;a2.push(c);selId=c.id}
  else if(a==="lock") o.lock=!o.lock;
  else if(a==="crop"){cropId=o.id;renderObjs();return}
  else if(a==="cropdone"){endCrop();return}
  else if(a==="zin"||a==="zout"){zoomCrop(a==="zin"?1:-1);return}
  else if(a==="shadow") o.shadow=!o.shadow;
  else if(a==="capdn"||a==="capup"){const c=Math.round(((o.cs||1)+(a==="capup"?.1:-.1))*10)/10;o.cs=Math.max(.6,Math.min(2,c));if(o.cs===1) delete o.cs}
  else if(a==="color"){o.color=+v;lastNote=+v}
  else if(a==="pattern"){o.pattern=+v;lastTape=+v}
  else if(a==="frame"){
    openPop(btn,Object.entries(FRAMES).map(([k,F])=>`<button type="button" data-v="${k}" aria-pressed="${(o.frame||"polaroid")===k}">${F.name}</button>`).join(""),k=>{
      if(k===o.frame) return;o.w=DEF_W[k];o.frame=k;s.modified=Date.now();renderObjs();touch()});return}
  else if(a==="layer"){
    openPop(btn,[["top","移到最上層"],["up","上一層"],["down","下一層"],["bottom","移到最下層"]].map(([k,t])=>`<button type="button" data-v="${k}">${t}</button>`).join(""),k=>{
      const j=a2.indexOf(o);a2.splice(j,1);
      const n=k==="top"?a2.length:k==="bottom"?0:k==="up"?Math.min(a2.length,j+1):Math.max(0,j-1);
      a2.splice(n,0,o);s.modified=Date.now();renderObjs();touch()});return}
  s.modified=Date.now();renderObjs();touch();
}
bar.addEventListener("click",e=>{const b=e.target.closest("button[data-act]");if(b) act(b.dataset.act,b.dataset.v,b)});

/* hooks the editor calls */
function objsChanged(){selId=null;cropId=null;hideBar();renderObjs();syncNotesCount()}
function objsLockChanged(){const locked=isLocked();for(const b of document.querySelectorAll(".mats button")) b.disabled=locked;if(locked){selId=null;cropId=null}renderObjs();syncNotesCount()}

/* ---------- notes kept from pasted diaries → sticky notes or polaroid captions ----------
   A note item is a heading line (📎 便條紙…, 📷 拍立得…, a line ending in a colon) and the lines under it. */
function noteItems(text){
  const items=[];let it=null;
  const EMO=/^[\u2190-\u2BFF\u{1F000}-\u{1FAFF}]/u,lines=String(text||"").split("\n").map(l=>l.trim()).filter(Boolean);
  const byEmoji=lines.some(l=>EMO.test(l));          // with 📎 📷 🖊 headings, a colon inside a note does not start a new one
  for(const t of lines){
    const head=byEmoji?EMO.test(t):(/[：:]$/.test(t)&&t.length<=40);
    if(head||!it){it={head:head?t.replace(/[：:]\s*$/,""):"",body:[]};items.push(it);if(!head) it.body.push(t)}
    else it.body.push(t);
  }
  for(const i of items){
    i.key=(i.head+"|"+i.body.join("")).slice(0,80);
    i.kind=/拍立得|照片|相片|📷/.test(i.head)?"pola":"note";
    const clean=s=>s.replace(/~~/g,"");
    i.text=clean(i.body.join("\n")||i.head);
    const q=[...i.body.join("\n").matchAll(/「([^」]{1,26})」/g)].map(m=>m[1]);
    i.cap=clean(q.length?q[q.length-1]:(i.body[0]||i.head)).slice(0,26);
  }
  return items;
}
function pendingNotes(){
  const s=book.spreads[cur],done=s.notesDone||{};
  return ["them","me"].map(p=>({p,items:noteItems(s[p].notes).filter(i=>!(done[p]||[]).includes(i.key))})).filter(g=>g.items.length);
}
function syncNotesCount(){
  const n=pendingNotes().reduce((a,g)=>a+g.items.length,0),c=$("#notes-cnt");
  c.textContent=n;c.hidden=!n;$("#mat-notes").disabled=isLocked()||!n;
  $("#mat-notes").title=n?`${n} 則備註可以放上頁面`:"貼上的日記裡沒有備註";
}
$("#mat-notes").addEventListener("click",()=>{
  const groups=pendingNotes();if(!groups.length||isLocked()) return;
  let k=0;const choice=[];
  const html=groups.map(g=>`<h3 class="n-who">${PERSON[g.p]}的日記</h3>`+g.items.map(i=>{const n=k++;choice[n]={g,i,v:i.kind};
    return `<div class="n-item"><div class="n-txt">${i.head?`<b>${esc(i.head)}</b>`:""}<span>${esc(i.text.split("\n").slice(0,3).join(" "))}</span></div>
      <div class="slide small n-pick" data-n="${n}"><i class="thumb" aria-hidden="true"></i><button type="button" data-v="note">便利貼</button><button type="button" data-v="pola">拍立得說明</button><button type="button" data-v="skip">略過</button></div></div>`}).join("")).join("");
  openDialog(`<h2 id="dlg-title">把備註放上頁面</h2>
    <p>這些是貼上日記時收起來的備註。每則選一種做法：便利貼會寫上整段文字；拍立得說明會放一張空的拍立得，下方寫上引號裡的那句話，之後再放照片。</p>
    <div class="n-list">${html}</div>
    <div class="row"><button type="button" class="btn quiet" data-act="no">取消</button><button type="button" class="btn solid" data-act="yes">放上頁面</button></div>`);
  const sync=()=>dlg.querySelectorAll(".n-pick").forEach(seg=>{const c=choice[+seg.dataset.n];
    seg.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===c.v)));slideSync(seg)});
  sync();requestAnimationFrame(sync);
  dlg.querySelector(".n-list").addEventListener("click",e=>{const b=e.target.closest(".n-pick button");if(!b) return;choice[+b.closest(".n-pick").dataset.n].v=b.dataset.v;sync()});
  dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);
  dlg.querySelector('[data-act="yes"]').onclick=()=>{
    const s=book.spreads[cur],done=s.notesDone=s.notesDone||{},a=s.objs||(s.objs=[]);let placed=0;const step={them:0,me:0};
    for(const c of choice){
      const p=c.g.p;(done[p]=done[p]||[]).push(c.i.key);if(c.v==="skip") continue;
      const SPOTS=[[-22,62],[22,112],[-18,164],[24,46],[-24,128],[18,176]],sp=SPOTS[step[p]++%SPOTS.length];
      const pos=who(p),X=(pos==="them"?74:222)+sp[0]*(pos==="them"?1:-1),Y=sp[1];
      const base={id:uidO(),x:dispX(X),y:Y,rot:Math.round(Math.random()*8-4)};
      if(c.v==="note"){const n=c.i.text.length+c.i.text.split("\n").length*6,w=clamp(34+n*.22,38,64);
        a.push({...base,type:"note",color:0,w,shadow:true,text:c.i.text,fs:Math.min(.088,Math.sqrt(.6724/(Math.max(n,1)*1.8)))})}
      else a.push({...base,type:"photo",frame:"polaroid",src:"",ar:46/62,w:DEF_W.polaroid,shadow:true,cap:c.i.cap});
      placed++;
    }
    s.modified=Date.now();delete s.sample;closeDialog(true);selId=null;renderObjs();syncNotesCount();touch();
    if(placed) toast(`已放上 ${placed} 則備註，可以拖曳到想要的位置`);
  };
});
