/* Exchange Diary — 印刷用 PDF (第 5 階段, first part: the inside pages).
   A book that can go to a print shop: trim size A5 or B6, 3 mm bleed on every side, optional crop marks,
   a title page and contents in front, page numbers, blank pages so every exchange opens as a left–right pair,
   and the page count padded for the binding. Pages are saved with the browser's print window, so the words stay
   vector text; where printing is not allowed, a 300 dpi picture PDF is offered instead. Built on export.js. */
"use strict";

const TRIM={A5:{w:148,h:210,label:"A5　148×210"},B6:{w:128,h:182,label:"B6　128×182"}};
const SLUG=8;                         // mm outside the bleed that holds the crop marks
const TOC_PER=14;                     // contents lines on one page
const MON_EN=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function printOpts(){return Object.assign({size:"A5",bind:"perfect",title:true,toc:true,num:true,bleed:3,marks:false,cover:true,paper:.1},book.print||{})}
/* spine width for perfect binding: leaves × paper thickness (a print shop may quote its own figure) */
const spineW=(o,plan)=>o.bind==="saddle"?0:Math.round(plan.total/2*(+o.paper||0)*10)/10;
const SPINE_TEXT=5;                   // mm: narrower spines carry no words
function bookRange(){
  const ds=book.spreads.flatMap(s=>[s.them.date,s.me.date]).map(d=>String(d||"").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)).filter(Boolean)
    .map(m=>`${m[1]}.${pad(m[2])}.${pad(m[3])}`).sort();
  if(!ds.length) return "";
  const a=ds[0],b=ds[ds.length-1];return a===b?a:`${a} — ${a.slice(0,4)===b.slice(0,4)?b.slice(5):b}`;
}

/* ---------- which page is which ----------
   Page 1 is a right-hand page. Every exchange must open on a left (even) page, so the pages in front are made
   an odd number; the end is padded to an even count (perfect binding) or a multiple of 4 (saddle stitch). */
function planPages(o){
  const n=book.spreads.length,tocPages=o.toc?Math.max(1,Math.ceil(n/TOC_PER)):0,front=[];
  if(o.title) front.push({kind:"title"});
  if(o.title&&tocPages%2) front.push({kind:"blank"});          // the back of the title page; contents then open on a right page
  for(let k=0;k<tocPages;k++) front.push({kind:"toc",part:k});
  if(front.length%2===0) front.push({kind:"blank"});
  const list=[...front];
  book.spreads.forEach((s,i)=>{list.push({kind:"diary",spread:i,side:0},{kind:"diary",spread:i,side:1})});
  const unit=o.bind==="saddle"?4:2;let pad0=0;
  while(list.length%unit){list.push({kind:"blank"});pad0++}
  list.forEach((p,k)=>{p.no=k+1;p.left=(k+1)%2===0});
  const first=front.length+1;                                    // page number of the first exchange
  return {list,front:front.length,blankEnd:pad0,tocPages,first,diary:n*2,total:list.length};
}

/* ---------- checks before sending to print ---------- */
const imgSize=new Map();
function natural(src){
  if(!imgSize.has(src)) imgSize.set(src,new Promise(res=>{const im=new Image();im.onload=()=>res({w:im.naturalWidth,h:im.naturalHeight});im.onerror=()=>res(null);im.src=src}));
  return imgSize.get(src);
}
async function printChecks(o){
  const out=[],scale=TRIM[o.size].w/148;
  for(const [i,s] of book.spreads.entries()){
    let gut=0,empty=0,low=[];
    for(const ob of s.objs||[]){
      if(typeof crossesGutter==="function"&&ob.type!=="tape"&&crossesGutter(ob)) gut++;
      if(ob.type==="photo"&&!ob.src) empty++;
      if((ob.type==="photo"||ob.type==="sticker")&&ob.src){
        const n=await natural(ob.src);if(!n) continue;
        let shown=ob.w;                                          // mm the picture is printed across
        if(ob.type==="photo"){const F=FRAMES[ob.frame]||FRAMES.polaroid,win=ob.frame==="bare"?ob.w:ob.w*(F.W-2*F.b)/F.W,c=ob.crop||{z:1};
          shown=win*Math.max(1,(ob.ar||1.33)/windowAspect(ob))*(c.z||1)}
        const dpi=Math.round(n.w*25.4/(shown*scale));
        if(dpi<200) low.push({id:ob.id,dpi,what:ob.type==="photo"?"照片":"貼紙"});
      }
    }
    const no=`No.${pad(i+1)}`;
    for(const l of low) out.push({i,id:l.id,msg:`${no} 的${l.what}放得太大，印出來約 ${l.dpi} dpi（建議 300 以上），可能會模糊`});
    if(gut) out.push({i,msg:`${no} 有 ${gut} 個物件跨過中縫，裝訂後中間那段可能看不到`});
    if(empty) out.push({i,msg:`${no} 有 ${empty} 張拍立得還沒放照片，會印成空白相框`});
    if(s.state!=="done") out.push({i,msg:`${no} 還在編輯中（不影響輸出，只是提醒）`,soft:true});
  }
  return out;
}

/* ---------- building the pages ---------- */
function onePage(sc,side,tag,si){                    // one page of a spread copy, alone
  const c=sc.cloneNode(true);c.classList.add("x-one");c.querySelectorAll(".page")[side?0:1].remove();
  /* each page's layer holds every object of the spread; drop the ones wholly on the other page
     (left in, they would make the print window shrink every page to fit them) */
  if(si!==undefined) for(const el of c.querySelectorAll(".obj")){const o=(book.spreads[si].objs||[]).find(x=>x.id===el.dataset.oid);if(!o) continue;
    const X=dispX(o.x),{ex}=extent(o);if(side?X+ex<=148:X-ex>=148) el.remove()}
  c.querySelectorAll(".gutter").forEach(e=>e.remove());     // a real book makes its own shadow at the fold
  uniqIds(c,tag);return c;
}
function bare(c){c.querySelectorAll(".sheet,.tag-wrap,.objs,.overflow-flag,.vtext,.efoot,.mast,.grid").forEach(e=>e.remove());return c}
function addTo(c,html){const d=document.createElement("div");d.className="pp-c";d.innerHTML=html;c.querySelector(".page").appendChild(d);return d}
function titleHTML(){
  return `<div class="pp-title"><b>${esc(diaryName())}</b><span class="who">${esc(book.names.them||"他")}　×　${esc(book.names.me||"我")}</span><span class="rng">${bookRange()}</span></div>`;
}
function tocHTML(part,plan){
  const rows=book.spreads.slice(part*TOC_PER,(part+1)*TOC_PER).map((s,j)=>{const i=part*TOC_PER+j,mood=String(s.them.mood||s.me.mood||"").replace(/[「」『』]/g,"").trim();
    return `<li><span class="no">No.${pad(i+1)}</span><span class="d">${spreadDate(s)||"--/--"}</span><span class="m">${esc(mood)}</span><span class="dots"></span><span class="p">${plan.first+i*2}</span></li>`}).join("");
  return `<div class="pp-toc">${part===0?`<h4>目錄<em>contents</em></h4>`:""}<ol>${rows}</ol></div>`;
}
/* the copy of a page that runs out into the bleed: paper and decoration only, stretched a little past the trim */
function backdrop(c){const k=bare(c.cloneNode(true));k.querySelectorAll(".clay-layer,.pp-c,.grain").forEach(e=>e.remove());uniqIds(k,"bd");return k}   // no fibre: it is cut away anyway, and it would double the file
function marksSVG(W,H,trim,b){
  const x1=SLUG+b,x2=SLUG+b+trim.w,y1=SLUG+b,y2=SLUG+b+trim.h,L=SLUG-1.5,s=[];
  for(const x of [x1,x2]){s.push(`M${x} 0V${L}`,`M${x} ${H}V${H-L}`)}
  for(const y of [y1,y2]){s.push(`M0 ${y}H${L}`,`M${W} ${y}H${W-L}`)}
  return `<svg class="pp-marks" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${s.join("")}" fill="none" stroke="#000" stroke-width=".1"/></svg>`;
}
/* the whole book as print boxes, in reading order */
function buildBook(o,plan){
  const trim=TRIM[o.size],b=+o.bleed||0,S=o.marks?SLUG:0;
  const W=trim.w+2*(b+S),H=trim.h+2*(b+S);
  const copies=snapshot(book.spreads.map((_,i)=>i));
  const base=copies[0]||cloneSpread(cur);
  const root=document.createElement("div");root.id="print-root";root.setAttribute("aria-hidden","true");
  plan.list.forEach((p,k)=>{
    let c;
    if(p.kind==="diary") c=onePage(copies[p.spread],p.side,"q"+k,p.spread);
    else{c=bare(onePage(base,p.left?0:1,"q"+k));c.querySelectorAll(".clay-layer").forEach(e=>e.remove());
      if(p.kind==="title") addTo(c,titleHTML());
      if(p.kind==="toc") addTo(c,tocHTML(p.part,plan));
      if(p.kind==="blank"){const pg=c.querySelector(".page");pg.querySelectorAll(".deco").forEach(e=>e.remove());pg.classList.add("pp-blank")}}
    const box=document.createElement("div");box.className="pp pp-book";box.style.width=W+"mm";box.style.height=H+"mm";
    if(b){const w=document.createElement("div");w.className="pp-bd";
      w.style.cssText=`left:${S}mm;top:${S}mm;width:${trim.w}mm;height:${trim.h}mm;transform:scale(${(trim.w+2*b)/trim.w},${(trim.h+2*b)/trim.h})`;
      mount(backdrop(c),trim.w+"mm",w);box.appendChild(w)}
    const t=document.createElement("div");t.className="pp-trim";t.style.cssText=`margin:${S+b}mm 0 0 ${S+b}mm;width:${trim.w}mm;height:${trim.h}mm`;
    mount(c,trim.w+"mm",t);box.appendChild(t);
    p.el=c;p.box=box;
    if(S) box.insertAdjacentHTML("beforeend",marksSVG(W,H,{w:trim.w,h:trim.h},b));
    root.appendChild(box);
  });
  return {root,W,H,trim};
}
/* ---------- the cover: back | spine | front, one sheet for perfect binding; front and back apart for saddle stitch ---------- */
function coverPage(base,which){
  const c=bare(onePage(base,which==="front"?1:0,"cv"+which));
  if(which==="front") addTo(c,`<div class="pp-cover f"><em>Exchange Diary</em><b>${esc(diaryName())}</b><span class="who">${esc(book.names.them||"他")}　×　${esc(book.names.me||"我")}</span><span class="rng">${bookRange()}</span></div>`);
  else addTo(c,`<div class="pp-cover k"><span class="q">交換心情，寫下生活</span><span class="meta">${book.spreads.length} 次交換${bookRange()?`　·　${bookRange()}`:""}</span></div>`);
  return c;
}
function coverMarks(W,H,xs,ys,spine){
  const L=SLUG-1.5,s=[];
  for(const x of xs){s.push(`M${x} 0V${L}`,`M${x} ${H}V${H-L}`)}
  for(const y of ys){s.push(`M0 ${y}H${L}`,`M${W} ${y}H${W-L}`)}
  return `<svg class="pp-marks" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${s.join("")}" fill="none" stroke="#000" stroke-width=".1"/>${spine?`<path d="${spine.map(x=>`M${x} ${L-4}V${L}M${x} ${H-L+4}V${H-L}`).join("")}" stroke="#000" stroke-width=".1" stroke-dasharray=".6 .4"/>`:""}</svg>`;
}
function buildCover(o,plan){
  const trim=TRIM[o.size],b=+o.bleed||0,S=o.marks?SLUG:0,sp=spineW(o,plan);
  const base=snapshot([0])[0]||cloneSpread(cur);
  const root=document.createElement("div");root.id="print-root";root.setAttribute("aria-hidden","true");
  const front=coverPage(base,"front"),back=coverPage(base,"back");
  const place=(box,c,x,L)=>{     // a page and the copy behind it that runs L mm past its left edge (bleed, or bleed and spine)
    L=L===undefined?b:L;
    if(L||b){const w=document.createElement("div");w.className="pp-bd";
      w.style.cssText=`left:${x-L}mm;top:${S}mm;width:${trim.w}mm;height:${trim.h}mm;transform:scale(${(trim.w+L+b)/trim.w},${(trim.h+2*b)/trim.h})`;
      mount(backdrop(c),trim.w+"mm",w);box.appendChild(w)}
    const t=document.createElement("div");t.className="pp-trim pp-abs";t.style.cssText=`left:${x}mm;top:${S+b}mm;width:${trim.w}mm;height:${trim.h}mm`;
    mount(c,trim.w+"mm",t);box.appendChild(t);return t};
  let W,H=trim.h+2*(b+S),boxes=[],ft,bt;
  if(o.bind==="saddle"){
    W=trim.w+2*(b+S);
    for(const [c,isF] of [[front,true],[back,false]]){const box=document.createElement("div");box.className="pp pp-book";box.style.width=W+"mm";box.style.height=H+"mm";
      const t=place(box,c,S+b);if(isF) ft=t;else bt=t;
      if(S) box.insertAdjacentHTML("beforeend",marksSVG(W,H,{w:trim.w,h:trim.h},b));boxes.push(box)}
  }else{
    W=2*trim.w+sp+2*(b+S);
    const box=document.createElement("div");box.className="pp pp-book pp-cv";box.style.width=W+"mm";box.style.height=H+"mm";
    bt=place(box,back,S+b);ft=place(box,front,S+b+trim.w+sp,sp+b);   // the front's paper and pattern carry on round the spine
    const spine=base.cloneNode(false);spine.removeAttribute("id");spine.className="spread pp-spine";
    spine.style.cssText+=`;position:absolute;display:block;left:${S+b+trim.w}mm;top:${S}mm;width:${sp}mm;height:${trim.h+2*b}mm;--sp:${sp}mm`;
    if(sp>=SPINE_TEXT) spine.innerHTML=`<span class="lb">${esc(diaryName())}<small>${(bookRange().slice(0,4))}</small></span>`;
    box.appendChild(spine);
    if(S) box.insertAdjacentHTML("beforeend",coverMarks(W,H,[S+b,W-S-b],[S+b,H-S-b],[S+b+trim.w,S+b+trim.w+sp]));
    boxes.push(box);
  }
  boxes.forEach(x=>root.appendChild(x));
  return {root,W,H,trim,spine:sp,front:ft,back:bt};
}
/* page numbers: in the page's own number slot when its style shows one, otherwise at the outer foot corner */
function numberPages(plan,o){
  for(const p of plan.list){
    const c=p.el;if(!c) continue;
    for(const n of c.querySelectorAll(".pgno")) n.textContent=n.closest(".mast")?`p. ${pad(p.no)}`:`p.${pad(p.no)}`;
    if(!o.num||p.kind==="title"||p.kind==="blank") continue;
    const own=[...c.querySelectorAll(".mast,.efoot")].some(e=>getComputedStyle(e).display!=="none"&&e.querySelector(".pgno"));
    if(!own) addTo(c,`<span class="pp-no ${p.left?"l":"r"}">${p.no}</span>`).classList.add("pp-c-no");
  }
}

/* ---------- the dialog ---------- */
$("#out-print").addEventListener("click",()=>{closeMenus();printDialog()});
function printDialog(){
  const o=printOpts();
  openDialog(`<h2 id="dlg-title">印刷用 PDF</h2>
    <p>產生可以交給客製化印刷廠的檔案：內頁一個 PDF、封面一個 PDF。文字是向量（放多大都清楚），照片維持上傳時的解析度，四邊含出血。</p>
    ${row("成品尺寸",xseg("size",Object.entries(TRIM).map(([k,v])=>[k,v.label]),o.size))}
    ${row("裝訂",xseg("bind",[["perfect","膠裝"],["saddle","騎馬釘"]],o.bind))}
    ${row("包含",`<div class="pp-chk"><label><input type="checkbox" data-k="cover"${o.cover?" checked":""}>封面・封底・書背</label><label><input type="checkbox" data-k="title"${o.title?" checked":""}>扉頁</label><label><input type="checkbox" data-k="toc"${o.toc?" checked":""}>目錄</label><label><input type="checkbox" data-k="num"${o.num?" checked":""}>頁碼</label></div>`)}
    ${row("印刷規格",`<div class="pp-chk"><label>出血 <input class="pp-num" type="number" min="0" max="5" step="0.5" data-k="bleed" value="${o.bleed}"> mm</label><label><input type="checkbox" data-k="marks"${o.marks?" checked":""}>裁切標記</label><label class="pp-paper">紙張厚度 <input class="pp-num" type="number" min="0.05" max="0.5" step="0.01" data-k="paper" value="${o.paper}"> mm</label></div>`)}
    <div class="pv" id="pv" aria-label="印刷預覽">
      <div class="pv-book" id="pv-book"><div class="pv-slot"></div><div class="pv-slot"></div><p class="pv-wait">正在準備預覽…</p></div>
      <div class="pv-bar"><span id="pv-a"></span><input type="range" id="pv-range" min="0" max="0" value="0" aria-label="翻到第幾頁"><span id="pv-b"></span></div>
      <p class="pv-cap" id="pv-cap" aria-live="polite"></p>
    </div>
    <dl class="pp-sum" id="pp-sum"></dl>
    <div class="pp-warn" id="pp-warn" hidden></div>
    <p class="x-note">裁切標記只有印刷廠要求時才需要勾。螢幕和印刷的顏色會有落差，螢光色、亮藍色差最多。</p>
    <div class="row"><button type="button" class="btn quiet" data-act="no">取消</button><button type="button" class="btn solid" data-act="yes">下一步</button></div>`);
  const read=()=>{const v=printOpts();v.size=segVal("size");v.bind=segVal("bind");
    dlg.querySelectorAll("[data-k]").forEach(e=>{v[e.dataset.k]=e.type==="checkbox"?e.checked:e.dataset.k==="paper"?Math.max(.05,Math.min(.5,+e.value||.1)):Math.max(0,Math.min(5,+e.value||0))});return v};
  let checks=[];
  const sync=()=>{const v=read(),pl=planPages(v),t=TRIM[v.size],b=v.bleed,S=v.marks?SLUG:0;
    const parts=[v.title?"扉頁 1":"",pl.tocPages?`目錄 ${pl.tocPages}`:"",`日記 ${pl.diary}`,(pl.front-(v.title?1:0)-pl.tocPages+pl.blankEnd)?`空白 ${pl.front-(v.title?1:0)-pl.tocPages+pl.blankEnd}`:""].filter(Boolean).join("、");
    $("#pp-sum").innerHTML=`<dt>總頁數</dt><dd>${pl.total} 頁（${parts}）${v.bind==="saddle"&&pl.total>48?`<small>騎馬釘超過 48 頁不好裝訂，建議改膠裝</small>`:""}</dd>
      <dt>日記開始</dt><dd>第 ${pl.first} 頁（左頁）</dd>
      ${v.cover&&v.bind!=="saddle"?`<dt>書背寬度</dt><dd>${spineW(v,pl)} mm${spineW(v,pl)<SPINE_TEXT?`<small>不到 ${SPINE_TEXT} mm，書背不印文字</small>`:""}</dd>`:""}
      <dt>檔案</dt><dd>${esc(stem())}-內頁-${v.size}.pdf<br><small class="ok">每頁 ${+(t.w+2*(b+S)).toFixed(1)} × ${+(t.h+2*(b+S)).toFixed(1)} mm（成品 ${t.w} × ${t.h}${b?`，四邊出血 ${b}`:""}${S?"，含裁切標記":""}）</small>
        ${v.cover?`<br>${esc(stem())}-封面-${v.size}.pdf<br><small class="ok">${v.bind==="saddle"?`封面、封底各一頁，每頁 ${+(t.w+2*(b+S)).toFixed(1)} × ${+(t.h+2*(b+S)).toFixed(1)} mm`:`封底＋書背＋封面展開一張，${+(2*t.w+spineW(v,pl)+2*(b+S)).toFixed(1)} × ${+(t.h+2*(b+S)).toFixed(1)} mm`}</small>`:""}</dd>`;
    dlg.querySelector(".pp-paper").hidden=!(v.cover&&v.bind!=="saddle");
    showChecks(v);clearTimeout(pvT);pvT=setTimeout(()=>pvBuild(v),250)};
  let seq=0,pvT=0;
  const showChecks=async v=>{const my=++seq;checks=await printChecks(v);if(my!==seq||!$("#pp-warn")) return;
    const hard=checks.filter(c=>!c.soft),soft=checks.filter(c=>c.soft),w=$("#pp-warn");
    w.hidden=!checks.length;
    const li=c=>`<li>${esc(c.msg)}　<button type="button" class="link" data-go="${checks.indexOf(c)}">前往</button></li>`;
    const open=soft.length>1?`<li class="soft">${soft.length===book.spreads.length?"所有跨頁":`No.${pad(soft[0].i+1)} 等 ${soft.length} 個跨頁`}還在編輯中（不影響輸出，只是提醒）</li>`:soft.map(c=>li(c).replace("<li>",'<li class="soft">')).join("");
    w.innerHTML=checks.length?`<b>${hard.length?`送印前請檢查（${hard.length}）`:"提醒"}</b><ul>${hard.map(li).join("")}${open}</ul>`:"";};
  wireSegs(sync);
  dlg.addEventListener("input",e=>{if(e.target.dataset.k) sync()});
  dlg.addEventListener("change",e=>{if(e.target.dataset.k) sync()});
  $("#pv-range").addEventListener("input",e=>pvShow(+e.target.value));
  closeHook=pvDrop;
  dlg.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(!g) return;const c=checks[+g.dataset.go];
    book.print=read();touch();closeDialog(false);if(typeof view!=="undefined"&&view!=="edit") setView("edit");
    cur=c.i;renderSpread();if(c.id&&typeof select==="function"&&book.spreads[cur].state!=="done") requestAnimationFrame(()=>select(c.id));scrollTo({top:0})});
  dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);
  dlg.querySelector('[data-act="yes"]').onclick=()=>{book.print=read();touch();pvDrop();printSteps(book.print)};
}

/* ---------- preview: the finished book, trimmed, one opening at a time; look only, nothing to click ---------- */
let pv=null;
function pvDrop(){if(pv){for(const [t,home] of pv.shown) home.appendChild(t);pv.root.remove();pv=null}}
async function pvBuild(v){
  if(!$("#pv-book")) return;
  const keep=pv&&pv.at||0;pvDrop();
  const plan=planPages(v),bk=buildBook(v,plan),hold=document.createElement("div");hold.className="pv-root";
  bk.root.removeAttribute("id");hold.appendChild(bk.root);
  let cv=null;if(v.cover){cv=buildCover(v,plan);cv.root.removeAttribute("id");hold.appendChild(cv.root)}
  xStage.appendChild(hold);numberPages(plan,v);
  const pages=plan.list.map(p=>({t:p.box.querySelector(".pp-trim"),home:p.box,p})),N=plan.total,sp=[];
  const F=cv?{t:cv.front,home:cv.front.parentNode,name:"封面"}:null,B=cv?{t:cv.back,home:cv.back.parentNode,name:"封底"}:null;
  if(F) sp.push([null,F]);
  sp.push([null,pages[0]]);for(let k=1;k<N;k+=2) sp.push([pages[k],k+1<N?pages[k+1]:null]);
  if(B) sp.push([B,null]);
  pv={root:hold,plan,trim:bk.trim,sp,shown:[],at:Math.min(keep,sp.length-1)};
  try{await document.fonts.ready}catch(e){}
  if(!pv||!$("#pv-book")) return;
  const r=$("#pv-range");r.max=String(sp.length-1);r.value=String(pv.at);
  $("#pv-a").textContent=F?"封面":"第 1 頁";$("#pv-b").textContent=B?"封底":`第 ${N} 頁`;
  pvShow(pv.at);
}
const pvName=e=>e.name||(e.p.kind==="title"?"扉頁":e.p.kind==="toc"?"目錄":e.p.kind==="blank"?"空白頁":`No.${pad(e.p.spread+1)}`);
function pvShow(at){
  if(!pv) return;pv.at=at;
  for(const [t,home] of pv.shown) home.appendChild(t);
  pv.shown=[];
  const bookEl=$("#pv-book"),slots=bookEl.querySelectorAll(".pv-slot"),pair=pv.sp[at];
  const w=Math.floor((bookEl.clientWidth-2)/2),pxmm=96/25.4;
  bookEl.style.setProperty("--pw",w+"px");bookEl.style.setProperty("--ph",Math.round(w*pv.trim.h/pv.trim.w)+"px");
  bookEl.style.setProperty("--s",(w/(pv.trim.w*pxmm)).toFixed(5));
  bookEl.classList.add("ready");
  slots.forEach((slot,j)=>{const e=pair[j];slot.classList.toggle("empty",!e);
    if(!e) return;slot.appendChild(e.t);pv.shown.push([e.t,e.home])});
  const es=pair.filter(Boolean),nos=es.filter(e=>e.p).map(e=>e.p.no);
  const names=[...new Set(es.map(pvName))].join("・");
  $("#pv-cap").textContent=nos.length?`${nos.length>1?`第 ${nos[0]}–${nos[1]} 頁`:`第 ${nos[0]} 頁`}　${names}`:names;
}

function printSteps(o,done){
  const t=TRIM[o.size],cv=o.cover;done=done||{};
  openDialog(`<h2 id="dlg-title">存成印刷用 PDF</h2>
    <p>${cv?"內頁和封面是兩個檔案，要各存一次。":""}按下按鈕會開啟瀏覽器的列印視窗，紙張大小已經設定好（含出血），照下面的步驟存檔就好。</p>
    <h3 class="x-h">步驟</h3>${pdfSteps(cv?"按下面的「① 存內頁 PDF」，存好後再按「② 存封面 PDF」，兩次都照 2–4 步。":"按下面的「存內頁 PDF」。")}
    <div class="pp-saves">
      <button type="button" class="btn ${done.inside?"quiet":"solid"}" data-save="inside">${cv?"① ":""}存內頁 PDF${done.inside?"　✓":""}</button>
      ${cv?`<button type="button" class="btn ${done.cover||!done.inside?"quiet":"solid"}" data-save="cover">② 存封面 PDF${done.cover?"　✓":""}</button>`:""}
    </div>
    <p class="x-note">交給印刷廠時告訴對方：成品 ${t.w}×${t.h} mm、${o.bleed?`四邊出血 ${o.bleed} mm、`:""}${o.bind==="saddle"?"騎馬釘":"膠裝"}${cv&&o.bind!=="saddle"?`、書背約 ${spineW(o,planPages(o))} mm（以印刷廠報價的書背寬度為準，不同時請調整紙張厚度重新產生封面）`:""}。</p>
    <div class="row"><button type="button" class="link x-alt" data-act="img">列印視窗打不開？改存 300 dpi 圖片版</button><span class="x-sp"></span><button type="button" class="btn quiet" data-act="no">上一步</button><button type="button" class="btn quiet" data-act="done">完成</button></div>`);
  dlg.querySelector('[data-act="no"]').onclick=()=>printDialog();
  dlg.querySelector('[data-act="done"]').onclick=()=>closeDialog(true);
  dlg.querySelectorAll("[data-save]").forEach(b=>b.onclick=()=>printBook(o,b.dataset.save,done));
  dlg.querySelector('[data-act="img"]').onclick=()=>{
    if(!cv) return printImages(o,"inside");
    openDialog(`<h2 id="dlg-title">300 dpi 圖片版</h2><p>要存哪一個檔案？</p>
      <div class="pp-saves"><button type="button" class="btn solid" data-img="inside">存內頁</button><button type="button" class="btn solid" data-img="cover">存封面</button></div>
      <div class="row"><button type="button" class="btn quiet" data-act="no">上一步</button></div>`);
    dlg.querySelector('[data-act="no"]').onclick=()=>printSteps(o);
    dlg.querySelectorAll("[data-img]").forEach(b=>b.onclick=()=>printImages(o,b.dataset.img));
  };
}
async function prepare(o,which){
  document.getElementById("print-root")?.remove();document.getElementById("print-page")?.remove();
  const plan=planPages(o),bk=which==="cover"?buildCover(o,plan):buildBook(o,plan);
  document.body.appendChild(bk.root);if(which!=="cover") numberPages(plan,o);
  try{await document.fonts.ready}catch(e){}
  await new Promise(r=>setTimeout(r,250));
  return {plan,...bk};
}
async function printBook(o,which,done){
  closeDialog(true);toast(which==="cover"?"正在準備封面…":"正在準備內頁…");
  const {root,W,H}=await prepare(o,which);
  const st=document.createElement("style");st.id="print-page";st.textContent=`@page{size:${W}mm ${H}mm;margin:0}`;document.head.appendChild(st);
  document.body.classList.add("printing");
  let fired=false;const on=()=>{fired=true};addEventListener("beforeprint",on);
  const cleanup=()=>{removeEventListener("afterprint",cleanup);document.body.classList.remove("printing");root.remove();st.remove();$("#toast").hidden=true};
  const after=()=>{cleanup();if(o.cover) setTimeout(()=>printSteps(o,{...(done||{}),[which]:true}),300)};   // back to the steps, the saved file ticked
  addEventListener("afterprint",after,{once:true});
  try{window.print()}catch(e){}
  setTimeout(()=>{removeEventListener("beforeprint",on);
    if(!fired){removeEventListener("afterprint",after);cleanup();
      openDialog(`<h2 id="dlg-title">列印視窗打不開</h2><p>現在開啟工具的地方（例如預覽框）不允許開啟列印視窗。可以改存「300 dpi 圖片版」：每一頁是 300 dpi 的圖片，含出血，大部分數位印刷可以接受，但文字不是向量。也可以換一個能開列印視窗的瀏覽器再試一次。</p>
        <div class="row"><button type="button" class="btn quiet" data-act="no">取消</button><button type="button" class="btn solid" data-act="yes">存 300 dpi 圖片版</button></div>`);
      dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);dlg.querySelector('[data-act="yes"]').onclick=()=>printImages(o,which)}
  },600);
}
/* where the print window is not allowed: every print box drawn at 300 dpi into a picture PDF */
async function printImages(o,which){
  const step=progress(which==="cover"?"正在製作 300 dpi 封面":"正在製作 300 dpi 內頁");
  let root=null;
  try{
    await libReady();
    const bk=await prepare(o,which);root=bk.root;
    const pics=[],boxes=[...root.querySelectorAll(".pp")],pr=300/96;
    for(let k=0;k<boxes.length;k++){
      if(xStop) return;
      step(k,boxes.length,`正在處理第 ${k+1} / ${boxes.length} 頁…`);
      const cv=await draw(boxes[k],pr,false);pics.push(await jpgOf(crop(cv,0,cv.width)));
    }
    const part=which==="cover"?"封面":"內頁",name=`${stem()}-${part}-${o.size}.pdf`,pdf=pdfOf(pics,bk.W,bk.H,diaryName());
    saveFile(pdf,name);
    finished("印刷檔已存好",`已開始下載「${esc(name)}」（${(pdf.size/1048576).toFixed(1)} MB，${pics.length} 頁）。這是 300 dpi 圖片版，交給印刷廠時可以註明「${part}為 300 dpi 點陣圖」。${which!=="cover"&&o.cover?"封面請回到「印刷用 PDF」另外存。":""}`);
  }catch(e){if(!xStop){closeDialog(false);toast("製作印刷檔時出了問題，請重新整理後再試一次。")}}
  finally{root&&root.remove()}
}
