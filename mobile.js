/* Exchange Diary — phones (第 6 階段): the settings column becomes a sheet at the bottom of the screen
   (風格／文字／素材 tabs, pulled up when needed).
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
new ResizeObserver(sheetSize).observe(panel);SMALL.addEventListener("change",sheetSize);

/* ---------- zooming ----------
   The phone's own two-finger zoom is used for writing larger; a double tap is left to the phone (it selects a word).
   (An earlier double-tap zoom of our own was removed on 10/14: it clashed with selecting words.) */
const zoom=()=>{};


/* the on-screen keyboard: browsers on phones lay it over the page without moving things fixed to the bottom,
   so the bars docked there (text styles, object tools) are lifted by its height and stay just above it */
const vv=window.visualViewport;
function kbLift(){
  if(!vv) return;
  const kb=SMALL.matches&&Math.abs(vv.scale-1)<.01?Math.max(0,Math.round(innerHeight-vv.height-vv.offsetTop)):0,up=kb>60;
  document.documentElement.style.setProperty("--kb",(up?kb:0)+"px");document.body.classList.toggle("kb-up",up);
}
if(vv){vv.addEventListener("resize",kbLift);vv.addEventListener("scroll",kbLift);kbLift()}
