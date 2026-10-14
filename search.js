/* Exchange Diary — 全書搜尋 (第 6 階段): a magnifier at the end of the spread tabs opens a search box under them.
   Every field of both pages, sticky notes and photo captions are searched as you type; a result opens its spread,
   and the words found are marked for a while with boxes drawn over the page (the writing itself is never touched).
   A small bar at the top steps to the previous / next result or ends the search. */
"use strict";

const SEARCH_FIELDS=["date","weather","mood","diary","say","q","ans"];
const SVG_LENS='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4.5 4.5"/></svg>';
$(".stage-bar").insertAdjacentHTML("beforeend",`<button type="button" class="sbtn" id="sbtn" aria-label="搜尋整本日記" aria-expanded="false" title="搜尋整本日記">${SVG_LENS}</button>`);
$(".stage-bar").insertAdjacentHTML("afterend",`<div class="srch" id="srch" hidden role="search">
  <div class="sr-box">${SVG_LENS}<label class="sr-only" for="sr-in">搜尋整本日記</label><input id="sr-in" type="search" autocomplete="off" spellcheck="false" placeholder="搜尋整本日記，例如：電影、海邊"><button type="button" class="sr-x" id="sr-x" aria-label="關閉搜尋">×</button></div>
  <p class="sr-n" id="sr-n" aria-live="polite"></p><ol class="sr-list" id="sr-list" role="listbox" aria-label="搜尋結果" tabindex="0"></ol></div>`);
document.body.insertAdjacentHTML("beforeend",`<div class="sr-bar" id="sr-bar" hidden role="status"><span id="sr-pos"></span><button type="button" data-step="-1" aria-label="上一筆">‹</button><button type="button" data-step="1" aria-label="下一筆">›</button><button type="button" data-step="0" aria-label="結束搜尋">✕</button></div>`);

let hits=[],hitAt=-1,hitQ="",srPick=0;
const fold=t=>String(t||"").toLowerCase();
function find(q){
  const out=[],Q=fold(q);if(!Q) return out;
  const scan=(t,base)=>{const T=fold(t);let k=T.indexOf(Q);while(k>=0){out.push({...base,t:String(t),k});k=T.indexOf(Q,k+Q.length)}};
  book.spreads.forEach((s,i)=>{
    for(const p of ["them","me"]) for(const f of SEARCH_FIELDS) scan(s[p][f],{i,p,f,label:`${PERSON[p]}的日記・${FIELD_NAMES[f]}`});
    for(const o of s.objs||[]){
      const pos=(book.swap?296-o.x:o.x)<148?"them":"me",p=who(pos);
      if(o.type==="note") scan(o.text,{i,p,oid:o.id,key:"text",label:`${PERSON[p]}的便利貼`});
      if(o.type==="photo"&&o.cap) scan(o.cap,{i,p,oid:o.id,key:"cap",label:`${PERSON[p]}的拍立得說明`});
    }
  });
  return out;
}
const snip=(h,n)=>{const a=Math.max(0,h.k-14),b=Math.min(h.t.length,h.k+n+22),cut=x=>esc(x).replace(/\n+/g," ");
  return (a?"…":"")+cut(h.t.slice(a,h.k))+"<mark>"+cut(h.t.slice(h.k,h.k+n))+"</mark>"+cut(h.t.slice(h.k+n,b))+(b<h.t.length?"…":"")};
function list(){
  const q=$("#sr-in").value.trim();hitQ=q;hits=find(q);srPick=0;
  const spreads=new Set(hits.map(h=>h.i)).size;
  $("#sr-n").textContent=!q?"":hits.length?`找到 ${hits.length} 筆，在 ${spreads} 個跨頁`:"沒有找到";
  $("#sr-list").innerHTML=hits.map((h,n)=>`<li role="option" id="sr-o${n}" data-n="${n}" aria-selected="${n===srPick}"><div class="sr-meta"><b>No.${pad(h.i+1)}</b><span>${spreadDate(book.spreads[h.i])||"--/--"}</span><span>${h.label}</span></div><p>${snip(h,q.length)}</p></li>`).join("");
}
function mark(n){srPick=n;$("#sr-list").querySelectorAll("li").forEach(li=>li.setAttribute("aria-selected",String(+li.dataset.n===n)));
  const li=$(`#sr-o${n}`);if(li){const L=$("#sr-list");if(li.offsetTop<L.scrollTop) L.scrollTop=li.offsetTop;else if(li.offsetTop+li.offsetHeight>L.scrollTop+L.clientHeight) L.scrollTop=li.offsetTop+li.offsetHeight-L.clientHeight}}
function openSearch(on){
  $("#srch").hidden=!on;$("#sbtn").classList.toggle("on",on);$("#sbtn").setAttribute("aria-expanded",String(on));
  if(on){const i=$("#sr-in");i.focus();i.select();if(i.value) list()}
}
$("#sbtn").addEventListener("click",()=>openSearch($("#srch").hidden));
$("#sr-x").addEventListener("click",()=>{openSearch(false);$("#sbtn").focus()});
$("#sr-in").addEventListener("input",list);
$("#sr-in").addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"&&hits.length){e.preventDefault();mark(Math.min(hits.length-1,srPick+1))}
  else if(e.key==="ArrowUp"&&hits.length){e.preventDefault();mark(Math.max(0,srPick-1))}
  else if(e.key==="Enter"&&hits.length){e.preventDefault();go(srPick)}
  else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();openSearch(false);$("#sbtn").focus()}
});
$("#sr-list").addEventListener("click",e=>{const li=e.target.closest("li");if(li) go(+li.dataset.n)});

/* ---------- going to a result ---------- */
function clearMarks(){document.querySelectorAll(".sr-hl").forEach(e=>e.remove())}
function endSearch(){clearMarks();$("#sr-bar").hidden=true;hitAt=-1}
function go(n){
  if(!hits[n]) return;
  hitAt=n;const h=hits[n];
  openSearch(false);
  if(typeof view!=="undefined"&&view==="photos") setView("read");
  if(cur!==h.i){cur=h.i;renderSpread()}
  if(effShow()!=="both"&&effShow()!==h.p){state.show=h.p;applyStyle()}
  $("#sr-pos").textContent=innerWidth<=720?`第 ${n+1} / ${hits.length} 筆`:`「${hitQ.length>8?hitQ.slice(0,8)+"…":hitQ}」第 ${n+1} / ${hits.length} 筆`;
  $("#sr-bar").hidden=false;
  requestAnimationFrame(()=>requestAnimationFrame(()=>srDraw(h)));
}
/* boxes over the words found, in the book's own coordinates so they scroll with it */
function srDraw(h){
  clearMarks();
  const pos=who(h.p),pg=document.querySelector(`#spread .page[data-side="${pos}"]`);if(!pg||!pg.offsetParent) return;
  let el=null;
  if(h.f) el=pg.querySelector(`[data-field="${h.f}"]`);
  else{const o=pg.querySelector(`.obj[data-oid="${h.oid}"] .o-text[data-key="${h.key}"]`);el=o}
  if(!el) return;
  const len=hitQ.length,[n1,o1]=placeAt(el,h.k),[n2,o2]=placeAt(el,h.k+len),r=document.createRange();
  try{r.setStart(n1,o1);r.setEnd(n2,o2)}catch(e){return}
  const bk=$("#book"),B=bk.getBoundingClientRect(),rects=[...r.getClientRects()].filter(x=>x.width>1);if(!rects.length) return;
  for(const x of rects){const d=document.createElement("div");d.className="sr-hl";
    d.style.cssText=`left:${x.left-B.left-2}px;top:${x.top-B.top-1}px;width:${x.width+4}px;height:${x.height+2}px`;bk.appendChild(d)}
  const y=rects[0].top+rects[0].height/2;
  if(y<90||y>innerHeight-120) scrollBy({top:y-innerHeight/2,behavior:RM.matches?"auto":"smooth"});
}
$("#sr-bar").addEventListener("click",e=>{const b=e.target.closest("button");if(!b) return;const s=+b.dataset.step;
  if(!s){endSearch();return}
  if(hits.length) go((hitAt+s+hits.length)%hits.length)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#sr-bar").hidden&&$("#modal").hidden&&$("#srch").hidden) endSearch()});
/* the marks belong to one layout: typing, turning a page or resizing clears them (the bar stays to step on) */
document.addEventListener("input",e=>{if(e.target.closest&&e.target.closest("#spread")) clearMarks()});
addEventListener("resize",clearMarks);
const _rs=renderSpread;renderSpread=function(){clearMarks();return _rs.apply(this,arguments)};
