/* Exchange Diary — first visit (第 6 階段): the notice to read before using, a four-step tour of the editor,
   and 關於 (the notice again, licences, version), opened from the links under the signature at the foot of the page. */
"use strict";

const APP_VERSION="1.0（2026.10）";
const NOTICE=[
  ["日記只存在你的裝置","日記、照片和設定都保存在這台裝置的瀏覽器裡，不會上傳到任何伺服器，作者也看不到你的內容。"],
  ["請定期備份","清除瀏覽器資料、使用無痕模式、換手機或電腦，資料都可能消失而且無法救回。請定期用「備份 → 匯出備份檔」存一份到自己的資料夾或雲端。"],
  ["作者不負保管責任","這個工具免費提供，照現況使用。因為裝置、瀏覽器或操作造成的資料遺失或損壞，作者無法負責，也沒有辦法幫你找回。"],
  ["內容與授權由你負責","放進日記的文字、照片、貼紙，以及自己上傳的字體，請確認你有權使用；要分享或拿去印刷前，也請先問過一起寫日記的人。"],
  ["輸出與印刷","螢幕和印刷的顏色會有落差；送印前請先確認印刷廠的規格。"]
];
const noticeHTML=()=>`<ol class="dc">${NOTICE.map(([t,d])=>`<li><b>${t}</b>${d}</li>`).join("")}</ol>`;
const FONT_CREDITS=[
  ["清松手寫體 1／2／3／9","Jason（Yu Ching Sung）"],
  ["辰宇落雁體","Wang Li-Yu、Liu Wei-Chen"],
  ["芫荽、霞鶩文楷 TC、粉圓、昭源甜圓、Noto Serif TC、仙人掌明體","經由 Google Fonts 提供，作者見 Google Fonts 各字體頁面"]
];

/* ---------- the notice before first use ---------- */
function firstRun(){
  openDialog(`<h2 id="dlg-title">使用前請先看看</h2>${noticeHTML()}
    <div class="row"><button type="button" class="link" data-act="about" style="margin-right:auto">看完整說明與授權</button><button type="button" class="btn solid" data-act="ok">我知道了，開始寫日記</button></div>`);
  dlg.querySelector('[data-act="ok"]').focus({preventScroll:true});dlg.scrollTop=0;
  const done=()=>{meta.noticeSeen=true;Store.set("meta",meta)};
  dlg.querySelector('[data-act="ok"]').onclick=()=>{done();closeDialog(true);if(!meta.tourSeen) setTimeout(()=>tour(0),300)};
  dlg.querySelector('[data-act="about"]').onclick=()=>{done();about(true)};
}

/* ---------- 關於 ---------- */
function about(fromNotice){
  openDialog(`<h2 id="dlg-title">關於 Exchange Diary</h2>
    <p class="ab-k">交換心情，寫下生活　<span style="white-space:nowrap">·　版本 ${APP_VERSION}</span></p>
    <i class="ab-logo" role="img" aria-label="Crafted by YuanLiv"></i>
    <details open><summary>使用須知與免責聲明</summary>${noticeHTML()}</details>
    <details><summary>內建字體（皆為 SIL Open Font License 1.1）</summary>
      <table class="ab-t">${FONT_CREDITS.map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>
      <p>OFL 字體可以免費使用、嵌入網頁與 PDF，也可以用在印刷品上，但不能單獨販售字體檔。</p></details>
    <details><summary>你上傳的字體</summary><p>只保存在這台裝置，不會放進備份檔，也不會放進翻書網頁或圖片（文字會畫成圖片）。存成 PDF 時，瀏覽器會把用到的字嵌入檔案，請確認字體授權允許。</p></details>
    <details><summary>程式元件</summary><p>html-to-image（MIT License），用來把頁面畫成圖片。</p></details>
    <div class="row"><button type="button" class="link" data-act="tour" style="margin-right:auto">重看使用說明</button><button type="button" class="btn solid" data-act="ok">${fromNotice?"我知道了，開始寫日記":"關閉"}</button></div>`);
  dlg.querySelector('[data-act="ok"]').focus({preventScroll:true});dlg.scrollTop=0;
  dlg.querySelector('[data-act="ok"]').onclick=()=>{closeDialog(true);if(fromNotice&&!meta.tourSeen) setTimeout(()=>tour(0),300)};
  dlg.querySelector('[data-act="tour"]').onclick=()=>{closeDialog(true);setTimeout(()=>tour(0),250)};
}
document.querySelector(".sig").insertAdjacentHTML("beforeend",`<div class="sig-links"><button type="button" class="link" id="lnk-tour">使用說明</button><button type="button" class="link" id="lnk-about">關於與授權</button></div>`);
$("#lnk-tour").addEventListener("click",()=>{if(typeof setView==="function"&&view!=="edit") setView("edit");scrollTo(0,0);setTimeout(()=>tour(0),200)});
$("#lnk-about").addEventListener("click",()=>about(false));

/* ---------- the tour: the page dims, one part stays lit, a small card says what it is for ---------- */
const TOUR=[
  {sel:"#btn-paste",title:"貼上日記",text:"把寫好的日記整段貼進來，日期、心情、日記會自動放進各欄位。也可以直接點頁面打字。",below:true},
  {sel:'.card[aria-labelledby="h-type"]',tab:"type",title:"調整文字",text:"字體、字級、行數都在這裡；在頁面上選取文字，還能加粗、換顏色、畫螢光筆。"},
  {sel:'.card[aria-labelledby="h-mat"]',tab:"mat",title:"放上素材",text:"照片、便利貼、紙膠帶和貼紙。拖曳移動、拉四角縮放、上方圓點旋轉；手機上也可以兩指縮放、轉動。"},
  {sel:".dock",close:true,title:"完成與輸出",text:"寫好按「完成這次交換」鎖定；「輸出」存成圖片、PDF 或翻書網頁；記得用「備份」定期存一份。"}
];
let tourAt=-1;
function tourEnd(){tourAt=-1;document.querySelectorAll(".cm-hole,.cm-tip,.cm-block").forEach(e=>e.remove());removeEventListener("resize",tourPlace);removeEventListener("scroll",tourPlace);
  meta.tourSeen=true;Store.set("meta",meta);if(SMALL.matches&&typeof sheet==="function") sheet(false)}
function tour(k){
  if(k<0||k>=TOUR.length){tourEnd();return}
  const first=tourAt<0;tourAt=k;const st=TOUR[k];
  if(SMALL.matches&&typeof sheet==="function"){if(st.tab) sheet(true,st.tab);else if(st.close||k===0) sheet(false)}
  if(first){document.body.insertAdjacentHTML("beforeend",`<div class="cm-block"></div><div class="cm-hole"></div><div class="cm-tip" role="dialog" aria-modal="true" aria-labelledby="cm-t"></div>`);
    addEventListener("resize",tourPlace);addEventListener("scroll",tourPlace,{passive:true})}
  const tip=document.querySelector(".cm-tip"),n=TOUR.length;
  tip.innerHTML=`<small>${k+1} / ${n}</small><h3 id="cm-t">${st.title}</h3><p>${st.text}</p>
    <div class="cm-row"><div class="cm-dots" aria-hidden="true">${TOUR.map((_,i)=>`<i class="${i===k?"on":""}"></i>`).join("")}</div>
    ${k<n-1?`<button type="button" class="link" data-cm="skip">略過</button>`:""}${k?`<button type="button" class="btn quiet" data-cm="prev">上一步</button>`:""}<button type="button" class="btn solid" data-cm="next">${k===n-1?"開始寫吧":"下一步"}</button></div>`;
  tip.querySelector('[data-cm="next"]').onclick=()=>tour(k+1);
  tip.querySelector('[data-cm="prev"]')?.addEventListener("click",()=>tour(k-1));
  tip.querySelector('[data-cm="skip"]')?.addEventListener("click",tourEnd);
  const el=document.querySelector(st.sel);
  if(el&&!SMALL.matches) el.scrollIntoView({block:"center",behavior:"auto"});
  else if(el&&SMALL.matches&&k===0) el.scrollIntoView({block:"center",behavior:"auto"});
  requestAnimationFrame(()=>{tourPlace();tip.querySelector('[data-cm="next"]').focus()});
}
function tourPlace(){
  if(tourAt<0) return;const st=TOUR[tourAt],el=document.querySelector(st.sel),hole=document.querySelector(".cm-hole"),tip=document.querySelector(".cm-tip");if(!el) return;
  const r=el.getBoundingClientRect();
  hole.style.cssText=`left:${r.left-8}px;top:${r.top-8}px;width:${r.width+16}px;height:${r.height+16}px`;
  const W=tip.offsetWidth,H=tip.offsetHeight;let x,y;
  if(SMALL.matches||st.below){x=Math.min(innerWidth-W-12,Math.max(12,r.left+r.width/2-W/2));y=r.bottom+18;if(y+H>innerHeight-10) y=Math.max(10,r.top-H-18)}
  else{x=r.left-W-24;if(x<12) x=Math.min(innerWidth-W-12,r.right+24);y=Math.max(12,Math.min(innerHeight-H-12,r.top))}
  tip.style.left=x+"px";tip.style.top=y+"px";
}
document.addEventListener("keydown",e=>{if(tourAt<0) return;
  if(e.key==="Escape"){e.preventDefault();tourEnd()}
  else if(e.key==="ArrowRight"&&!e.target.closest("input,textarea,[contenteditable=true]")) tour(tourAt+1)
  else if(e.key==="ArrowLeft"&&!e.target.closest("input,textarea,[contenteditable=true]")) tour(tourAt-1)});
