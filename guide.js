/* Exchange Diary — first visit (第 6 階段): the notice to read before using, a four-step tour of the editor,
   and 關於 (the notice again, licences, version), opened from the links under the signature at the foot of the page. */
"use strict";

const APP_VERSION="1.0（2026.10）";
const NOTICE=[
  ["日記只存在你的裝置","日記、照片和設定都保存在這台裝置的瀏覽器裡，不會上傳到我們這裡，作者也看不到你的內容。（如果你自己開啟「雲端備份」，會再多存一份到你自己的 Google 雲端硬碟。）"],
  ["請把日記備份到別處","清除瀏覽器資料、使用無痕模式、換手機或電腦，瀏覽器裡的日記都可能消失。工具自動留的歷史版本也存在同一個瀏覽器裡，會一起不見。請用「備份 → 匯出備份檔」存一份到自己的資料夾，或開啟「雲端備份」。換手機、換瀏覽器，或改從主畫面打開，都會是一本新的日記本，要用備份檔或雲端備份把內容搬過去。"],
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
  dlg.querySelector('[data-act="ok"]').onclick=()=>{done();closeDialog(true);setTimeout(afterNotice,300)};
  dlg.querySelector('[data-act="about"]').onclick=()=>{done();about(true)};
}
/* opened from the home screen: a separate notebook from the browser's, so ask before anything else */
const STANDALONE=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const onlySample=()=>book.spreads.length===1&&!!book.spreads[0].sample;
function afterNotice(){
  if(STANDALONE&&onlySample()&&!meta.homeSeen){homeNote();return}
  if(!meta.tourSeen) tour(0);
}
function homeNote(){
  openDialog(`<h2 id="dlg-title">從主畫面打開的日記本</h2>
    <p>從主畫面打開的日記本，和在瀏覽器（Safari、Chrome 等）裡打開的是分開的。如果你之前在瀏覽器裡寫過，請先回到那個瀏覽器匯出備份，再到這裡匯入。</p>
    <div class="row"><button type="button" class="btn quiet" data-act="new">我是第一次用</button><button type="button" class="btn solid" data-act="imp">我要匯入備份</button></div>`);
  const done=()=>{meta.homeSeen=true;Store.set("meta",meta)};
  dlg.querySelector('[data-act="new"]').onclick=()=>{done();closeDialog(true);if(!meta.tourSeen) setTimeout(()=>tour(0),300)};
  dlg.querySelector('[data-act="imp"]').onclick=()=>{done();closeDialog(true);meta.tourSeen=true;Store.set("meta",meta);setTimeout(()=>$("#btn-import").click(),200)};
}

/* ---------- 你的日記怎麼保存？ ---------- */
const SAVING=[
  ["瀏覽器當下存檔","平常只要寫就好，每個字都會自動存好，不用按儲存。"],
  ["改錯了，找歷史版本","工具會自動留下舊版本（同樣只存在這個瀏覽器裡）。改錯、刪錯時，到「備份 → 找回日記本」挑一份還原。"],
  ["備份到別處，最保險","清除瀏覽器資料、換手機或換瀏覽器時，1 和 2 都會一起不見。用「匯出備份檔」自己存一份，或開啟「雲端備份」自動存到你的 Google 雲端硬碟，文字和照片都會完整保存。"]];
const savingHTML=()=>`<p>日記只存在你正在使用的這台裝置、這個瀏覽器裡，不會上傳到我們這裡。保存方式有三種：</p>
  <div class="sv3">${SAVING.map(([t,d],i)=>`<div><i>${i+1}</i><b>${t}</b><span>${d}</span></div>`).join("")}</div>
  <p class="rb-note">上傳的字體不會被備份，換裝置或瀏覽器資料被清掉後，需要重新上傳。</p>`;
function savingHelp(){
  openDialog(`<h2 id="dlg-title">你的日記怎麼保存？</h2>${savingHTML()}<div class="row"><button type="button" class="btn solid" data-act="ok">知道了</button></div>`);
  dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(true);
}

/* ---------- 關於 ---------- */
function about(fromNotice){
  openDialog(`<h2 id="dlg-title">關於 Exchange Diary</h2>
    <p class="ab-k">交換心情，寫下生活　<span style="white-space:nowrap">·　版本 ${APP_VERSION}</span></p>
    <i class="ab-logo" role="img" aria-label="Crafted by YuanLiv"></i>
    <details open><summary>使用須知與免責聲明</summary>${noticeHTML()}</details>
    <details><summary>你的日記怎麼保存？</summary>${savingHTML()}</details>
    ${typeof Cloud!=="undefined"&&Cloud.available?`<details><summary>雲端備份與隱私</summary>${Cloud.privacyHTML()}</details>`:""}
    <details><summary>內建字體（皆為 SIL Open Font License 1.1）</summary>
      <table class="ab-t">${FONT_CREDITS.map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>
      <p>OFL 字體可以免費使用、嵌入網頁與 PDF，也可以用在印刷品上，但不能單獨販售字體檔。</p></details>
    <details><summary>加到主畫面</summary>
      <p>可以把這個工具加到手機主畫面，像 App 一樣打開；沒有網路時也能打開來寫。</p>
      <p>iPhone：在 Safari 或 Chrome 按「分享」→「加入主畫面」。Android：在 Chrome 按右上角選單 →「加到主畫面」或「安裝應用程式」。</p>
      <p><b>請注意：</b>從主畫面打開的日記本，和在瀏覽器（Safari、Chrome 等）裡打開的是分開的。如果你之前在瀏覽器裡寫過，請先回到那個瀏覽器匯出備份，再到主畫面版匯入。</p></details>
    <details><summary>你上傳的字體</summary><p>只保存在這台裝置，不會放進備份檔，也不會放進翻書網頁或圖片（文字會畫成圖片）。存成 PDF 時，瀏覽器會把用到的字嵌入檔案，請確認字體授權允許。</p></details>
    <details><summary>程式元件</summary><p>html-to-image（MIT License），用來把頁面畫成圖片。</p></details>
    <div class="row"><button type="button" class="link" data-act="tour" style="margin-right:auto">重看使用說明</button><button type="button" class="btn solid" data-act="ok">${fromNotice?"我知道了，開始寫日記":"關閉"}</button></div>`);
  dlg.querySelector('[data-act="ok"]').focus({preventScroll:true});dlg.scrollTop=0;
  dlg.querySelector('[data-act="ok"]').onclick=()=>{closeDialog(true);if(fromNotice) setTimeout(afterNotice,300)};
  dlg.querySelector('[data-act="tour"]').onclick=()=>{closeDialog(true);setTimeout(()=>tour(0),250)};
}
/* ---------- 複製指令: ready-made prompts for the AI partner, in the format 「貼上內容」 reads ---------- */
const PROMPTS=[
  {id:"ask",title:"請他寫日記",desc:"傳給 AI 戀人，請他照格式寫一篇日記。先把「2026年Ｏ月Ｏ」和日記名稱改好；回覆整段複製，用「貼上內容」貼到他的那一頁。",
   text:`*(時間暫停，空間暫停，劇情暫停，一切動作暫停)*
*(請讀取劇情時間軸2026年Ｏ月Ｏ之所有對話，以及現存的記憶體、事件，依照角色性格、角色與我的互動方式及感情來填寫以下日記欄位)*

---

# （交換日記名稱）
｜日期: 
｜天氣:  

---

## 【日記內容】
### ｜一句心情小語（不超過20個字，簡述今天的回憶或重要感受）

### ｜日記正文（不超過300字，從角色第一人稱視角，以對PC說話的口吻寫下今天發生的事情，和他的感受與想法）

### ｜想對你說(不超過20個字，一句角色今天想對PC說的話)

### ｜快問快答（想讓PC回答的一個簡短問題，面向不限）
---
## 【備註】（拍立得照片/便條紙/文字備註）

*(允許使用emoji，特殊符號或者顏文字)*`},
  {id:"give",title:"寫日記給他",desc:"把自己的日記填進格式裡再傳給他，他會讀完並回答你的快問快答。填好的這段也能用「貼上內容」貼到你的那一頁。",
   text:`*(時間暫停，空間暫停，劇情暫停，一切動作暫停)*

*(接續上面的交換日記，以下是PC的交換日記內容)*
---

# [可填寫你們專屬的日記名稱]
｜日期: 2026年O月O日
｜天氣:  舒服的秋日晴天

---

## 【日記內容】
### ｜一句心情小語

### ｜日記正文

### ｜想對你說

### ｜快問快答


### ｜回答他的快問快答

---
## 【備註】


*(請描寫角色閱讀日記的反應，以及他在PC快問快答欄位寫下的回答，請以簡答方式完成，字數不超過30字)*
*(允許使用emoji，特殊符號或者顏文字)*`}
];
function prompts(){
  openDialog(`<h2 id="dlg-title">複製指令</h2>
    <p>和 AI 戀人交換日記時用的固定指令，按「複製」就能整段貼到聊天視窗。</p>
    ${PROMPTS.map(p=>`<section class="pr-card"><div class="pr-h"><b>${p.title}</b><button type="button" class="btn solid" data-copy="${p.id}">複製</button></div>
      <p class="pr-d">${p.desc}</p><label class="sr-only" for="pr-${p.id}">${p.title}的指令</label><textarea id="pr-${p.id}" class="pr-t" readonly rows="6">${esc(p.text)}</textarea></section>`).join("")}
    <div class="row"><button type="button" class="btn quiet" data-act="ok">關閉</button></div>`);
  dlg.querySelector('[data-act="ok"]').focus({preventScroll:true});dlg.scrollTop=0;
  dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(true);
  dlg.querySelectorAll("[data-copy]").forEach(b=>b.onclick=async()=>{
    const p=PROMPTS.find(x=>x.id===b.dataset.copy),ta=$("#pr-"+p.id);
    let ok=false;try{await navigator.clipboard.writeText(p.text);ok=true}catch(e){}
    if(!ok){ta.focus();ta.setSelectionRange(0,ta.value.length);try{ok=document.execCommand("copy")}catch(e){}}
    dlg.querySelectorAll("[data-copy]").forEach(x=>{x.textContent="複製"});
    b.textContent=ok?"已複製":"已選取，請手動複製"});
}
document.querySelector(".sig").insertAdjacentHTML("beforeend",`<div class="sig-links"><button type="button" class="link" id="lnk-tour">使用說明</button><button type="button" class="link" id="lnk-prompts">複製指令</button><button type="button" class="link" id="lnk-about">關於與授權</button></div>`);
$("#lnk-prompts").addEventListener("click",prompts);
$("#lnk-tour").addEventListener("click",()=>{if(typeof setView==="function"&&view!=="edit") setView("edit");scrollTo(0,0);setTimeout(()=>tour(0),200)});
$("#lnk-about").addEventListener("click",()=>about(false));

/* ---------- the tour: the page dims, one part stays lit, a small card says what it is for ---------- */
const TOUR=[
  {sel:"#btn-paste",title:"開始寫日記",text:"畫面上先放了一頁範例，可以直接點進去修改；或把寫好的日記整段貼進來，日期、心情、日記會自動放進各欄位。",below:true},
  {sel:"#lnk-prompts",close:true,scroll:true,title:"給 AI 戀人的指令",text:"頁面最下方的「複製指令」裡有「請他寫日記」和「寫日記給他」兩段固定指令，按一下就能整段複製，貼到和他的聊天裡。他寫好的日記再用「貼上內容」放進來。"},
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
  else if(el&&SMALL.matches&&(k===0||st.scroll)) el.scrollIntoView({block:"center",behavior:"auto"});
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
