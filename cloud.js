/* Exchange Diary — 雲端備份: a copy of the diary in the user's own Google Drive.
   Everything happens between this browser and Google. There is no server of ours in between; the page only ever
   asks Google for "the app's own hidden folder" (drive.appdata), which cannot see any other file in the user's Drive.
   Files in that folder:
     index.json              what is in the folder (diaries, versions, pictures)
     book-<id>.json          the latest copy of a diary (text, with pictures as img: keys)
     ver-<id>-<time>.json    older copies, at most 10 per diary
     img-<key>               one picture each, uploaded once
   Fonts are never uploaded. */
"use strict";
const CLOUD_CLIENT_ID="";   // the OAuth client ID from Google Cloud; while empty, cloud backup stays hidden
const Cloud=(()=>{
  const SCOPE="https://www.googleapis.com/auth/drive.appdata";
  const API="https://www.googleapis.com/drive/v3",UP="https://www.googleapis.com/upload/drive/v3";
  const VER_KEEP=10,VER_EVERY=6*3600e3,WAIT=10000;
  const available=!!CLOUD_CLIENT_ID||!!window.__cloudTest;
  const cfg=()=>meta.cloud||(meta.cloud={});
  const on=()=>available&&!!(meta&&meta.cloud&&meta.cloud.on);
  const saveMeta=()=>Store.set("meta",meta);
  const DEV=(()=>{const u=navigator.userAgent;
    const os=/iPhone/.test(u)?"iPhone":/iPad/.test(u)?"iPad":/Android/.test(u)?"Android":/Mac/.test(u)?"Mac":/Windows/.test(u)?"Windows":"";
    const br=/EdgiOS|Edg\//.test(u)?"Edge":/CriOS|Chrome\//.test(u)?"Chrome":/FxiOS|Firefox\//.test(u)?"Firefox":/Safari\//.test(u)?"Safari":"瀏覽器";
    const st=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
    return (os?os+" 的 ":"")+(st?"主畫面 App":br)})();
  const CLOUD_IC=`<svg class="cl-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.4 9.2 4.5 4.5 0 0 0 7 18z"/></svg>`;
  const fmt=t=>{const d=new Date(t);return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const mb=n=>(n/1048576).toFixed(n<1048576*10?1:0)+" MB";

  /* ---------- signing in: Google's own window; we only receive a short-lived pass for the hidden folder ---------- */
  let token=null,tokenExp=0,gisP=null;
  try{const t=JSON.parse(sessionStorage.getItem("ed-ct")||"null");if(t&&t.exp>Date.now()+60000){token=t.tk;tokenExp=t.exp}}catch(e){}
  const keepToken=()=>{try{token?sessionStorage.setItem("ed-ct",JSON.stringify({tk:token,exp:tokenExp})):sessionStorage.removeItem("ed-ct")}catch(e){}};
  function loadGIS(){
    if(window.google&&google.accounts&&google.accounts.oauth2) return Promise.resolve();
    return gisP||(gisP=new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;
      s.onload=()=>res();s.onerror=()=>{gisP=null;rej(new Error("gis"))};document.head.appendChild(s)}));
  }
  const hasToken=()=>!!token&&Date.now()<tokenExp-60000;
  /* must be called from a click: Google opens a small window */
  async function signIn(){
    if(hasToken()) return token;
    await loadGIS();
    return new Promise((res,rej)=>{
      const tc=google.accounts.oauth2.initTokenClient({client_id:CLOUD_CLIENT_ID,scope:SCOPE,
        callback:r=>{if(!r||r.error){rej(new Error(r&&r.error||"denied"));return}
          if(google.accounts.oauth2.hasGrantedAllScopes&&!google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE)){rej(new Error("scope"));return}
          token=r.access_token;tokenExp=Date.now()+(+r.expires_in||3600)*1000;keepToken();res(token)},
        error_callback:e=>rej(new Error(e&&e.type||"popup"))});
      tc.requestAccessToken({prompt:cfg().on?"":"consent"});
    });
  }

  /* ---------- talking to Google Drive ---------- */
  const cerr=(kind,msg)=>{const e=new Error(msg||kind);e.kind=kind;return e};
  async function req(method,url,body,headers={}){
    if(!hasToken()) throw cerr("auth");
    if(navigator.onLine===false) throw cerr("offline");
    let r;try{r=await fetch(url,{method,headers:{Authorization:"Bearer "+token,...headers},body})}catch(e){throw cerr("offline")}
    if(r.status===401){token=null;keepToken();throw cerr("auth")}
    if(!r.ok){let j={};try{j=await r.json()}catch(e){}
      const reason=(((j.error||{}).errors||[])[0]||{}).reason||"";
      if(reason==="storageQuotaExceeded"||reason==="quotaExceeded"&&r.status===403) throw cerr("full");
      throw cerr("http",r.status+" "+reason)}
    return r;
  }
  let files=null,index=null;
  async function list(){const out={};let pt="";
    do{const r=await req("GET",`${API}/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,size)${pt?"&pageToken="+encodeURIComponent(pt):""}`);
      const j=await r.json();for(const f of j.files||[]) out[f.name]=f;pt=j.nextPageToken||""}while(pt);
    return out}
  async function put(name,text,type="application/json"){
    const f=files[name];
    if(f){await req("PATCH",`${UP}/files/${f.id}?uploadType=media`,text,{"Content-Type":type});f.size=String(text.length);return f}
    const b="edb"+Math.random().toString(36).slice(2);
    const body=`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name,parents:["appDataFolder"]})}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n${text}\r\n--${b}--`;
    const r=await req("POST",`${UP}/files?uploadType=multipart&fields=id,name,size`,body,{"Content-Type":"multipart/related; boundary="+b});
    const j=await r.json();files[name]={id:j.id,name,size:j.size||String(text.length)};return files[name];
  }
  async function copy(from,to){const f=files[from];if(!f) return;
    const r=await req("POST",`${API}/files/${f.id}/copy?fields=id,name,size`,JSON.stringify({name:to,parents:["appDataFolder"]}),{"Content-Type":"application/json"});
    const j=await r.json();files[to]={id:j.id,name:to,size:j.size||f.size}}
  async function read(name){const f=files[name];if(!f) return null;const r=await req("GET",`${API}/files/${f.id}?alt=media`);return r.text()}
  async function drop(name){const f=files[name];if(!f) return;
    try{await req("DELETE",`${API}/files/${f.id}`)}catch(e){if(e.kind!=="http") throw e}delete files[name]}
  async function ensureIndex(fresh){
    if(fresh||!files) files=await list();
    if(fresh||!index){let j=null;try{j=JSON.parse(await read("index.json")||"null")}catch(e){}
      index=j&&j.books?j:{v:1,books:{},versions:[],imgs:[]}}
    index.imgs=(index.imgs||[]).filter(k=>files["img-"+k.slice(4)]);
    index.versions=(index.versions||[]).filter(v=>files[v.f]);
    for(const id of Object.keys(index.books)) if(!files["book-"+id+".json"]) delete index.books[id];
    return index;
  }
  const usedBytes=()=>Object.values(files||{}).reduce((n,f)=>n+(+f.size||0),0);

  /* ---------- state shown next to "已自動儲存" ---------- */
  let state="off",fullShown=false,retry=0,fails=0;
  function setState(s){state=s;render()}
  function render(){const el=document.getElementById("cloud-st");if(!el) return;
    if(!on()){el.innerHTML="";return}
    const t={need:["點一下繼續雲端備份",1,0],busy:["備份中…"],idle:["已備份到雲端"],offline:["等有網路再備份"],
      full:["雲端空間已滿，暫停備份",1,1],error:["雲端備份暫停，點這裡重試",1,1]}[state];
    if(!t){el.innerHTML="";return}
    el.innerHTML=`・${t[1]?`<button type="button" class="cl-b${t[2]?" warn":""}">${CLOUD_IC}${t[0]}</button>`:`<span>${CLOUD_IC}${t[0]}</span>`}`;
    const b=el.querySelector("button");if(b) b.onclick=()=>state==="full"?fullDialog():resume();
  }

  /* ---------- backing up ---------- */
  let timer=0,busy=null,again=false,pendingWhy="";
  function changed(){if(!on()) return;clearTimeout(timer);timer=setTimeout(()=>backup(),WAIT)}
  function noteVersion(why){if(/^(刪除|匯入|還原|換照片)/.test(why||"")) pendingWhy=why}
  function backup(){
    if(!on()||leaving) return Promise.resolve();
    if(busy){again=true;return busy}
    busy=(async()=>{
      try{
        if(!hasToken()){setState("need");return}
        setState("busy");
        await doBackup();fails=0;setState("idle");
      }catch(e){handle(e)}
      finally{busy=null;if(again){again=false;changed()}}
    })();
    return busy;
  }
  async function doBackup(){
    await ensureIndex();
    const rec=await Store.get("book:"+book.id);if(!rec||!Array.isArray(rec.spreads)) return;
    const text=JSON.stringify(rec),sig=sigOf(text),imgs=[...recImgs(rec)];
    const bk=index.books[book.id];
    if(bk&&bk.sig===sig&&!pendingWhy) return;
    for(const k of imgs) if(!index.imgs.includes(k)){const v=await Store.get(k);
      if(typeof v==="string"){await put("img-"+k.slice(4),v,"text/plain");index.imgs.push(k)}}
    const fname="book-"+book.id+".json";
    /* now and then, and before a big change, keep what the cloud had as an older version */
    if(bk&&files[fname]){
      const last=index.versions.filter(v=>v.book===book.id).reduce((m,v)=>Math.max(m,v.t),0);
      if(pendingWhy||Date.now()-last>VER_EVERY){const f=`ver-${book.id}-${bk.t}.json`;
        if(!files[f]){await copy(fname,f);index.versions.push({f,book:book.id,t:bk.t,why:pendingWhy,n:bk.n,name:bk.name,imgs:bk.imgs||[]})}
        pendingWhy="";delete cfg().pendingWhy}
    }
    await put(fname,text);
    index.books[book.id]={name:(rec.subtitle||"").trim(),n:rec.spreads.length,t:Date.now(),updated:+rec.updated||0,dev:DEV,sig,imgs};
    await prune();
    await put("index.json",JSON.stringify(index));
    cfg().last=Date.now();cfg().dev=DEV;saveMeta();
  }
  async function prune(){
    const byBook={};for(const v of index.versions)(byBook[v.book]=byBook[v.book]||[]).push(v);
    const keep=[];for(const vs of Object.values(byBook)){vs.sort((a,b)=>b.t-a.t);
      for(const [i,v] of vs.entries()){if(i<VER_KEEP) keep.push(v);else await drop(v.f)}}
    index.versions=keep;
    const used=new Set();for(const b of Object.values(index.books)) for(const k of b.imgs||[]) used.add(k);
    for(const v of keep) for(const k of v.imgs||[]) used.add(k);
    for(const k of [...index.imgs]) if(!used.has(k)){await drop("img-"+k.slice(4));index.imgs=index.imgs.filter(x=>x!==k)}
  }
  function handle(e){
    const k=e&&e.kind;console.warn("cloud",e);
    if(k==="auth"){token=null;keepToken();setState("need")}
    else if(k==="offline"){setState("offline")}
    else if(k==="full"){setState("full");clearTimeout(retry);retry=setTimeout(changed,10*60e3);if(!fullShown){fullShown=true;fullDialog()}}
    else{fails++;setState(fails>=3?"error":"offline");clearTimeout(retry);retry=setTimeout(changed,fails>=3?10*60e3:2*60e3)}
  }
  addEventListener("online",()=>{if(on()&&(state==="offline"||state==="error")) changed()});
  addEventListener("pagehide",()=>{if(on()&&timer&&hasToken()){clearTimeout(timer);timer=0;backup()}});

  /* ---------- bringing a diary back from the cloud ---------- */
  async function pull(fname){
    const rec=JSON.parse(await read(fname)||"null");if(!rec||!Array.isArray(rec.spreads)) throw cerr("http","empty");
    for(const k of recImgs(rec)){let have=null;try{have=await Store.get(k)}catch(e){}
      if(typeof have==="string") continue;const t=await read("img-"+k.slice(4));if(t&&!await Store.set(k,t)) throw cerr("space")}
    return rec;
  }
  async function restore(fname,id){
    await ensureIndex();
    const rec=await pull(fname);
    if(!loadFailed){clearTimeout(saveTimer);await save()}
    await queueSnap("從雲端還原前",id);leaving=true;await saving;
    if(!await Store.set("book:"+id,{...rec,id})){leaving=false;throw cerr("space")}
    await Store.set("current",id);
    meta.cloud.skipCheck=Date.now();
    /* an older version is coming back: the next backup keeps what the cloud has now as a version first */
    if(/^ver-/.test(fname)) meta.cloud.pendingWhy="還原舊版本前";
    await saveMeta();
    location.reload();
  }
  async function versions(){
    if(!on()||!hasToken()) return [];
    await ensureIndex();
    return index.versions.map(v=>({f:v.f,book:v.book,t:v.t,why:v.why?v.why.replace(/前$/,"前（雲端）"):"",n:v.n,name:v.name}));
  }

  /* ---------- the dialogs ---------- */
  const realBook=b=>b.spreads.some(s=>!s.sample&&(FIELDS.some(f=>(s.them[f]||"").trim()||(s.me[f]||"").trim())||(s.objs||[]).length));
  function privacyHTML(){return `<p>雲端備份是選用的功能，不開也可以正常使用。</p>
    <p>開啟後，日記（文字和照片）會存在<b>你自己的</b> Google 雲端硬碟裡一個專屬的隱藏資料夾，由 Google 保管。這個工具只能讀寫那個資料夾，碰不到你的其他檔案、信件和相簿。</p>
    <p>我們沒有伺服器，看不到你的日記，也不會取得你的 Email 或任何帳號資料。上傳的字體不會備份。</p>
    <p>想停止時，按「雲端備份 → 取消連結」；也可以到 Google 帳號的「第三方應用程式與服務」移除存取權。<a href="privacy.html" target="_blank" rel="noopener">完整的隱私權說明</a></p>`}
  function open(){on()?panel():intro()}
  function intro(){
    loadGIS().catch(()=>{});
    openDialog(`<h2 id="dlg-title">${CLOUD_IC}雲端備份</h2>
      <p>開啟後，日記會自動多存一份到<b>你自己的</b> Google 雲端硬碟。換手機、換電腦，或瀏覽器資料被清掉，都能從雲端拿回來，文字和照片都會保存。</p>
      <div class="cl-story">
        <p><b>我們就像一間文具店，賣給你一本交換日記本。</b></p>
        <p>開啟雲端備份，就像在你自己的 Google 櫃子裡，空出一格小抽屜放日記影本。保管櫃子的是 Google，不是文具店。</p>
        <p>連結時，你是直接跟 Google 登入，帳號密碼只有你和 Google 知道，文具店完全不知道。</p>
        <p>登入後，你只是同意一件事：<b>這本日記本可以把影本放進那一格抽屜。</b>其他抽屜（你的其他檔案、信件、照片）它都打不開。</p>
        <p>哪天不想用了，按「取消連結」，日記本就不能再放東西進去。抽屜裡的影本會留著，想清空也可以一起清掉。</p>
      </div>
      <p class="rb-note">上傳的字體不會備份。每次重新打開網頁時，要點一下「繼續雲端備份」讓 Google 確認是你。在別人的裝置上用完，記得取消連結。</p>
      <div class="row"><button type="button" class="btn quiet" data-act="no">先不要</button><button type="button" class="btn solid" data-act="go">連結 Google 帳號</button></div>`);
    dlg.querySelector('[data-act="no"]').onclick=()=>closeDialog(false);
    dlg.querySelector('[data-act="go"]').onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.textContent="等待 Google…";
      try{await signIn()}catch(err){b.disabled=false;b.textContent="連結 Google 帳號";toast("沒有完成 Google 連結，可以再試一次。");return}
      b.textContent="檢查雲端…";
      try{await ensureIndex(true)}catch(err){b.disabled=false;b.textContent="連結 Google 帳號";toast("現在連不上 Google 雲端，請稍後再試。");return}
      cfg().on=true;cfg().since=Date.now();await saveMeta();closeDialog(true);
      await afterSignIn(true)};
  }
  /* compare what is here with what is in the cloud before writing anything */
  async function afterSignIn(first){
    await ensureIndex(true);
    const local=await Store.get("book:"+book.id),lsig=local?sigOf(JSON.stringify(local)):"";
    const same=index.books[book.id];
    const others=Object.entries(index.books).filter(([id])=>id!==book.id).sort((a,b)=>b[1].t-a[1].t);
    if(same&&same.sig!==lsig&&same.updated>(+(local&&local.updated)||0)+2000&&!(meta.cloud.skipCheck>Date.now()-60e3)){newer(same);return}
    if(first&&others.length){if(!realBook(book)){offer(others[0]);return}both(others[0]);return}
    if(first) toast("雲端備份已開啟，日記會自動存到你的 Google 雲端硬碟。");
    backup();
  }
  const card=b=>`<div class="cl-card"><b>${esc(b.name||"（沒有名稱）")}</b><small>${b.n} 個跨頁・照片 ${(b.imgs||[]).length} 張・最後備份 ${fmt(b.t)}${b.dev?`<br>（從 ${esc(b.dev)} 備份）`:""}</small></div>`;
  function offer([id,b]){
    openDialog(`<h2 id="dlg-title">找到雲端上的日記</h2><p>你的 Google 雲端裡有一本日記，要拿到這個瀏覽器裡嗎？</p>${card(b)}
      <p class="rb-note">照片會一起下載。上傳的字體需要在這裡重新上傳。</p>
      <div class="row"><button type="button" class="btn quiet" data-act="no">先不要</button><button type="button" class="btn solid" data-act="yes">拿下來</button></div>`);
    dlg.querySelector('[data-act="no"]').onclick=()=>{closeDialog(false);backup()};
    dlg.querySelector('[data-act="yes"]').onclick=e=>getIt(e.currentTarget,id);
  }
  function both([id,b]){
    openDialog(`<h2 id="dlg-title">雲端和這台都有日記</h2><p>你的 Google 雲端裡已經有一本日記，這個瀏覽器裡也有一本。要打開哪一本呢？兩本都不會被刪掉。</p>
      <div class="cl-cmp"><div><b>雲端上的</b>${card(b)}</div><div><b>這台裝置上的</b>${card({name:book.subtitle,n:book.spreads.length,t:book.updated,imgs:[]}).replace(/・照片 0 張・最後備份/,"・最後修改")}</div></div>
      <div class="cl-opt"><button type="button" data-act="cloud"><b>打開雲端那本</b><small>這台的日記會留在「找回日記本」，也會一起備份到雲端</small></button>
      <button type="button" data-act="here"><b>繼續用這台的</b><small>把這台的日記備份上去，雲端那本也會留著</small></button></div>
      <div class="row"><button type="button" class="btn quiet" data-act="no">先不連結</button></div>`);
    dlg.querySelector('[data-act="no"]').onclick=async()=>{closeDialog(false);cfg().on=false;await saveMeta();setState("off")};
    dlg.querySelector('[data-act="here"]').onclick=()=>{closeDialog(true);backup()};
    dlg.querySelector('[data-act="cloud"]').onclick=async e=>{await backup();getIt(e.currentTarget,id)};
  }
  function newer(b){
    openDialog(`<h2 id="dlg-title">雲端上有比較新的內容</h2><p>這本日記在雲端上的版本比這台新，可能是你在另一台裝置寫過。</p>
      <div class="cl-cmp"><div><b>雲端上的</b>${card(b)}</div><div><b>這台裝置上的</b>${card({name:book.subtitle,n:book.spreads.length,t:book.updated,imgs:[]}).replace(/・照片 0 張・最後備份/,"・最後修改")}</div></div>
      <div class="cl-opt"><button type="button" class="rec" data-act="cloud"><b>用雲端的（建議）</b><small>這台現在的內容會先留一份歷史版本</small></button>
      <button type="button" data-act="here"><b>用這台的</b><small>雲端上的內容會留成一份雲端的歷史版本</small></button></div>`);
    dlg.querySelector('[data-act="here"]').onclick=()=>{closeDialog(true);pendingWhy="改用這台的內容前";backup()};
    dlg.querySelector('[data-act="cloud"]').onclick=e=>getIt(e.currentTarget,book.id);
  }
  async function getIt(btn,id){btn.disabled=true;const s=btn.querySelector("small")||btn;s.textContent="下載中…";
    try{await restore("book-"+id+".json",id)}catch(err){btn.disabled=false;s.textContent="下載失敗，請稍後再試";console.warn(err)}}
  async function resume(){
    try{await signIn()}catch(e){toast("沒有完成 Google 連結，可以再點一次。");return}
    setState("busy");
    try{await afterSignIn(false)}catch(e){handle(e)}
  }
  async function panel(){
    const lastT=cfg().last?fmt(cfg().last):"還沒有";
    const head=`<div class="cl-acct"><i>${CLOUD_IC}</i><div><b>已連結 Google 雲端硬碟</b><small>最後備份 ${lastT}${hasToken()?"・自動備份中":""}</small></div>
      ${hasToken()?"":`<button type="button" class="btn solid" data-act="resume">繼續雲端備份</button>`}</div>`;
    openDialog(`<h2 id="dlg-title">${CLOUD_IC}雲端備份</h2>${head}
      <h3 class="rb-h">雲端上的日記本</h3><ul class="rb-list" id="cl-books"><li class="rb-empty">${hasToken()?"讀取中…":"點「繼續雲端備份」後就能看到。"}</li></ul>
      <p class="rb-note">雲端上的舊版本，會和這台的一起列在「備份 → 找回日記本」。</p>
      <label class="cl-chk"><input type="checkbox" id="cl-wipe"> 取消連結時，同時刪除雲端上的日記</label>
      <div class="row"><button type="button" class="btn quiet danger" data-act="off" style="margin-right:auto">取消連結</button>${hasToken()?'<button type="button" class="btn quiet" data-act="now">立即備份</button>':""}<button type="button" class="btn solid" data-act="ok">關閉</button></div>`);
    dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(true);
    const r=dlg.querySelector('[data-act="resume"]');if(r) r.onclick=()=>{closeDialog(true);resume()};
    const n=dlg.querySelector('[data-act="now"]');if(n) n.onclick=async()=>{n.disabled=true;n.textContent="備份中…";pendingWhy=pendingWhy||"";await backup();n.textContent=state==="idle"?"已備份":"立即備份";n.disabled=false};
    dlg.querySelector('[data-act="off"]').onclick=async()=>{const wipe=$("#cl-wipe").checked;
      if(!await confirmBox("取消連結雲端備份？",wipe?"雲端上的日記和照片會全部刪除，這台的日記不受影響。":"之後不會再備份到雲端。雲端上已經存的日記會留著，這台的日記不受影響。","取消連結")) return;
      try{await disconnect(wipe);toast(wipe?"已取消連結，雲端上的日記也刪除了。":"已取消連結雲端備份。")}catch(e){toast("刪除雲端資料時出了問題，請稍後再試一次。")}};
    if(!hasToken()) return;
    try{await ensureIndex();const ul=$("#cl-books");if(!ul) return;
      const bs=Object.entries(index.books).sort((a,b)=>b[1].t-a[1].t);
      ul.innerHTML=bs.length?bs.map(([id,b])=>`<li><div><b>${esc(b.name||"（沒有名稱）")}</b><small>${b.n} 個跨頁・最後備份 ${fmt(b.t)}${b.dev?"・"+esc(b.dev):""}${id===book.id?"・目前打開中":""}</small></div>
        ${id===book.id?"":`<button type="button" class="btn quiet" data-get="${esc(id)}">打開</button>`}</li>`).join("")+`<li class="rb-empty">雲端共使用 ${mb(usedBytes())}</li>`
        :`<li class="rb-empty">雲端上還沒有日記，等一下就會備份上去。</li>`;
      ul.querySelectorAll("[data-get]").forEach(b=>b.onclick=async()=>{await backup();getIt(b,b.dataset.get)});
    }catch(e){handle(e)}
  }
  async function disconnect(wipe){
    if(wipe){if(!hasToken()) await signIn();files=await list();for(const n of Object.keys(files)) await drop(n)}
    try{if(token&&window.google&&google.accounts&&google.accounts.oauth2) google.accounts.oauth2.revoke(token,()=>{})}catch(e){}
    token=null;keepToken();files=null;index=null;clearTimeout(timer);
    cfg().on=false;delete meta.cloud.last;await saveMeta();setState("off");closeDialog(true);
  }
  function fullDialog(){
    openDialog(`<h2 id="dlg-title">Google 雲端空間滿了</h2>
      <p>你的 Google 雲端硬碟沒有空間了，所以<b>暫時沒辦法備份到雲端</b>。</p>
      <p>別擔心，<b>日記還是好好存在這台裝置上</b>，你可以照常寫，什麼都不會不見。</p>
      <ul class="dc-box"><li>清出 Google 空間後，工具會自動繼續備份，不用重新設定</li><li>清空間之前，建議先用「匯出備份檔」存一份</li>
      ${files?`<li>這個工具在雲端大約占 ${mb(usedBytes())}，大部分是照片</li>`:""}</ul>
      <p class="rb-note">Google 的空間是 Gmail、Google 相簿、雲端硬碟一起算的，可以到 Google 帳號的「儲存空間」看是什麼占比較多。</p>
      <div class="row"><button type="button" class="btn quiet" data-act="ok">知道了</button><button type="button" class="btn solid" data-act="exp">匯出備份檔</button></div>`);
    dlg.querySelector('[data-act="ok"]').onclick=()=>closeDialog(true);
    dlg.querySelector('[data-act="exp"]').onclick=()=>{closeDialog(true);setTimeout(()=>$("#btn-export").click(),150)};
  }

  /* ---------- once: a gentle nudge to keep a copy somewhere else ---------- */
  function maybeNudge(){
    if(meta.nudged||meta.exported||on()||loadFailed) return;
    if(book.spreads.filter(s=>!s.sample).length<3) return;
    meta.nudged=Date.now();saveMeta();
    const el=document.createElement("div");el.className="cl-nudge";el.setAttribute("role","dialog");el.setAttribute("aria-label","備份提醒");
    el.innerHTML=`<b>${CLOUD_IC}要不要把日記備份到別處？</b>你已經寫了 ${book.spreads.filter(s=>!s.sample).length} 個跨頁。日記現在只存在這個瀏覽器裡，${available?"開啟雲端備份，日記會自動多存一份到你自己的 Google 雲端硬碟；也可以匯出一個備份檔自己保存。":"匯出一個備份檔自己保存，換手機或清資料都不怕。"}
      <div class="row"><button type="button" class="btn quiet" data-act="later">之後再說</button>${available?'<button type="button" class="btn quiet" data-act="exp">匯出備份檔</button><button type="button" class="btn solid" data-act="cloud">開啟雲端備份</button>':'<button type="button" class="btn solid" data-act="exp">匯出備份檔</button>'}</div>`;
    document.body.appendChild(el);
    el.querySelector('[data-act="later"]').onclick=()=>el.remove();
    el.querySelector('[data-act="exp"]').onclick=()=>{el.remove();$("#btn-export").click()};
    const c=el.querySelector('[data-act="cloud"]');if(c) c.onclick=()=>{el.remove();open()};
  }

  function start(){
    const b=document.getElementById("btn-cloud");if(b){b.hidden=!available;b.onclick=()=>{$("#menu-backup").hidden=true;open()}}
    if(!on()){render();return}
    if(cfg().pendingWhy) pendingWhy=cfg().pendingWhy;
    loadGIS().catch(()=>{});
    if(hasToken()){setState("busy");afterSignIn(false).catch(handle)}else setState("need");
  }
  return {available,on,open,start,changed,noteVersion,backup,versions,restore,maybeNudge,privacyHTML,get state(){return state},_test:{ensureIndex,get index(){return index},get files(){return files}}};
})();
