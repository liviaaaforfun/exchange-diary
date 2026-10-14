/* Exchange Diary — phones (第 6 階段): the settings column becomes a sheet at the bottom of the screen
   (風格／文字／素材 tabs, pulled up when needed), and a double tap on the page zooms in for writing.
   Two-finger pinch and turn of objects lives in objects.js. */
"use strict";

const SMALL=matchMedia("(max-width:720px)");
const panel=document.querySelector(".panel");

/* ---------- the bottom sheet ---------- */
panel.insertAdjacentHTML("afterbegin",`<div class="sheet-h" id="sheet-h">
  <button type="button" class="grab" id="sheet-grab" aria-label="展開設定" aria-expanded="false"><i></i></button>
  <div class="sheet-tabs" role="tablist" aria-label="設定分頁">
    <button type="button" role="tab" data-tab="style">風格</button><button type="button" role="tab" data-tab="type">文字</button><button type="button" role="tab" data-tab="mat">素材</button>
  </div></div>`);
let sheetTab="type";
function sheet(open,tab){
  if(tab) sheetTab=tab;
  panel.dataset.tab=sheetTab;panel.classList.toggle("closed",!open);
  $("#sheet-grab").setAttribute("aria-expanded",String(open));$("#sheet-grab").setAttribute("aria-label",open?"收合設定":"展開設定");
  for(const b of panel.querySelectorAll(".sheet-tabs button")){const on=b.dataset.tab===sheetTab;b.classList.toggle("on",on);b.setAttribute("aria-selected",String(on&&open))}
  if(open){panel.scrollTop=0;requestAnimationFrame(()=>panel.querySelectorAll(".slide").forEach(slideSync))}
}
sheet(false);
panel.querySelector(".sheet-tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(!b) return;
  const open=panel.classList.contains("closed")||b.dataset.tab!==sheetTab;sheet(open,b.dataset.tab)});
$("#sheet-grab").addEventListener("click",()=>sheet(panel.classList.contains("closed")));
/* pull the handle row up to open, down to close */
let pull=null;
$("#sheet-h").addEventListener("touchstart",e=>{pull={y:e.touches[0].clientY,t:Date.now()}},{passive:true});
$("#sheet-h").addEventListener("touchend",e=>{if(!pull) return;const dy=e.changedTouches[0].clientY-pull.y;pull=null;
  if(dy<-30) sheet(true);else if(dy>30) sheet(false)},{passive:true});
/* a tap on the diary puts the sheet away */
document.addEventListener("pointerdown",e=>{if(!SMALL.matches||panel.classList.contains("closed")) return;
  if(e.target.closest(".panel,.modal,.objbar,.o-pop,.fxbar,#toast")) return;
  if(e.target.closest(".stage,.masthead")) sheet(false)});
/* while typing or while a toolbar is docked at the bottom, the sheet steps out of the way */
document.addEventListener("focusin",e=>{if(e.target.closest&&e.target.closest("#spread [contenteditable=true],.objs .o-text")){document.body.classList.add("typing");sheet(false)}});
document.addEventListener("focusout",()=>setTimeout(()=>{const a=document.activeElement;if(!(a&&a.closest&&a.closest("#spread [contenteditable=true],.objs .o-text"))) document.body.classList.remove("typing")},0));
const barsUp=()=>{const ob=document.querySelector(".objbar"),fx=document.querySelector("#fxbar");
  document.body.classList.toggle("bars-up",!!((ob&&!ob.hidden)||(fx&&!fx.hidden)))};
for(const el of [document.querySelector(".objbar"),document.querySelector("#fxbar")]) if(el) new MutationObserver(barsUp).observe(el,{attributes:true,attributeFilter:["hidden"]});
/* room at the bottom of the page for the closed sheet */
const sheetSize=()=>{const h=SMALL.matches?Math.round(panel.querySelector(".sheet-h").offsetHeight+panel.querySelector(".dock").offsetHeight+18):0;
  document.documentElement.style.setProperty("--sheet-h",h+"px")};
new ResizeObserver(sheetSize).observe(panel);SMALL.addEventListener("change",()=>{sheetSize();if(!SMALL.matches) zoom(false)});

/* ---------- double tap to write larger ---------- */
const bookEl=$("#book"),scroller=document.createElement("div");scroller.className="book-scroll";bookEl.before(scroller);scroller.appendChild(bookEl);
document.body.insertAdjacentHTML("beforeend",`<button type="button" class="zchip" id="zchip" hidden>放大書寫中・點兩下縮回</button><div class="zmini" id="zmini" hidden aria-hidden="true"><i></i></div>`);
function zoom(on,at){
  if(on===document.body.classList.contains("zoomed")) return;
  const r=bookEl.getBoundingClientRect(),fx=at?(at.x-r.left)/r.width:.5,fy=at?(at.y-r.top)/r.height:0;
  document.body.classList.toggle("zoomed",on);$("#zchip").hidden=!on;$("#zmini").hidden=!on;
  if(on&&at){const r2=bookEl.getBoundingClientRect(),s=scroller.getBoundingClientRect();
    scroller.scrollLeft=fx*r2.width-(at.x-s.left);scrollBy(0,r2.top+fy*r2.height-at.y)}
  if(typeof scheduleFit==="function") scheduleFit();
  mini();
}
function mini(){
  if(!document.body.classList.contains("zoomed")) return;
  const r=bookEl.getBoundingClientRect(),i=$("#zmini i");
  const x=scroller.scrollLeft/scroller.scrollWidth,w=scroller.clientWidth/scroller.scrollWidth;
  const top=Math.max(0,-r.top)/r.height,vis=(Math.min(innerHeight,r.bottom)-Math.max(0,r.top))/r.height;
  i.style.cssText=`left:${(x*100).toFixed(1)}%;width:${(w*100).toFixed(1)}%;top:${(top*100).toFixed(1)}%;height:${(Math.max(0,vis)*100).toFixed(1)}%`;
}
scroller.addEventListener("scroll",mini,{passive:true});addEventListener("scroll",mini,{passive:true});addEventListener("resize",mini);
$("#zchip").addEventListener("click",()=>zoom(false));
let lastTap=null;
bookEl.addEventListener("pointerup",e=>{
  if(!SMALL.matches||e.pointerType==="mouse"||(typeof view!=="undefined"&&view!=="edit")) return;
  if(e.target.closest(".obj,.o-warn,.objbar")){lastTap=null;return}
  const p={x:e.clientX,y:e.clientY,t:Date.now()};
  if(lastTap&&p.t-lastTap.t<320&&Math.hypot(p.x-lastTap.x,p.y-lastTap.y)<30){lastTap=null;e.preventDefault();
    const sel=getSelection();if(sel&&!document.body.classList.contains("zoomed")) sel.removeAllRanges();
    zoom(!document.body.classList.contains("zoomed"),p)}
  else lastTap=p;
});
/* zoom ends when leaving the editor */
const _setView=setView;
setView=function(v,o){if(v!=="edit") zoom(false);return _setView(v,o)};

/* the on-screen keyboard: browsers on phones lay it over the page without moving things fixed to the bottom,
   so the bars docked there (text styles, object tools) are lifted by its height and stay just above it */
const vv=window.visualViewport;
function kbLift(){
  if(!vv) return;
  const kb=SMALL.matches&&Math.abs(vv.scale-1)<.01?Math.max(0,Math.round(innerHeight-vv.height-vv.offsetTop)):0,up=kb>60;
  document.documentElement.style.setProperty("--kb",(up?kb:0)+"px");document.body.classList.toggle("kb-up",up);
}
if(vv){vv.addEventListener("resize",kbLift);vv.addEventListener("scroll",kbLift);kbLift()}
