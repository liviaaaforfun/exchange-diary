/* Exchange Diary — reads pasted diary text into fields.
   Accepts plain "標籤：內容" lines and Markdown-style notes: # headings, ｜ or | markers, 【】 brackets,
   > quotes, list bullets, **bold**, ~~strike~~, --- rules, emoji, labels with extra words ("一句心情小語", "日記正文"). */
"use strict";
const PARSE=(()=>{
  /* which field a label belongs to; checked in this order, first match wins */
  const RULES=[
    ["notes",/備註|附註|附記|補充|^ps\b|^p\.s\./i],
    ["ansOther",/回答(?:他|她|你|妳|您|對方)/],   // the answer to the OTHER page's question: it goes on that page
    ["ans",/我的回答|回答|答覆/],
    ["q",/快問快答|快問|問答|提問|問題|question/i],
    ["say",/想對你說|想對妳說|想對您說|想說的話|給你的話|給妳的話|悄悄話|to\s*you/i],
    ["mood",/心情|mood/i],
    ["weather",/天氣|weather/i],
    ["date",/日期|date/i],
    ["diary",/日記|正文|內容|diary/i]
  ];
  const SINGLE=new Set(["date","weather","mood","q","ans","ansOther"]);
  const keyOf=label=>{const t=label.trim();if(!t||t.length>14) return null;for(const [k,re] of RULES) if(re.test(t)) return k;return null};
  /* strip Markdown and decorative markers from the start/end of a line */
  const lead=/^\s*(?:#{1,6}\s*|>\s*|[-*+•·・]\s+|\d+[.)、]\s+)*/;
  const deco=s=>s.replace(/^[\s｜|│【〔\[(（「『“"*_]+/,"").replace(/[\s】〕\])）」』”"*_]+$/,"");
  const inline=s=>s.replace(/\*\*(.+?)\*\*/g,"$1").replace(/__(.+?)__/g,"$1").replace(/~~(.+?)~~/g,"$1").replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g,"$1$2").replace(/`([^`]*)`/g,"$1");
  const isRule=s=>/^\s*([-*_=]\s*){3,}$/.test(s);
  const isHeading=s=>/^\s*#{1,6}\s/.test(s);
  const hasMarker=s=>/^\s*(?:#{1,6}\s*)?[｜|│【〔\[]/.test(s);

  function normDate(v){
    const m=v.match(/(\d{4})\s*[年/.\-]\s*(\d{1,2})\s*[月/.\-]\s*(\d{1,2})\s*日?/);
    return m?`${m[1]}/${m[2].padStart(2,"0")}/${m[3].padStart(2,"0")}`:v;
  }

  function parse(text){
    const out={},lines=String(text).replace(/\r\n?/g,"\n").split("\n");
    let key=null,title="",sawField=false;
    const add=(k,v)=>{out[k]=(out[k]===undefined||out[k]===""?"":out[k]+"\n")+v};
    for(const raw of lines){
      if(isRule(raw)) continue;
      if(/^\s*\*\s*[（(].*[）)]\s*\*\s*$/.test(raw)) continue;   /* *(…)* lines are instructions to the AI, not diary text */
      const heading=isHeading(raw),marked=hasMarker(raw);
      const body=inline(raw.replace(lead,""));
      const clean=deco(body);
      /* the first top-level heading before any field is the page title, not a field */
      if(/^\s*#\s/.test(raw)&&!sawField){if(!title) title=clean;key=null;continue}
      /* "標籤：內容" / "標籤: 內容" on one line */
      const m=clean.match(/^([^：:]{1,14})[：:]\s*(.*)$/);
      if(m&&(heading||marked||deco(m[1]).length<=8)){
        const k=keyOf(deco(m[1]));
        if(k){key=k;sawField=true;out[k]=m[2].trim();continue}
      }
      /* a heading, a marked line, or a short bare label naming a field; its content follows on the next lines */
      if(heading||marked||(clean.length<=8&&!/[。，！？、]/.test(clean))){
        /* a heading may carry a hint in brackets: "｜日記正文（不超過300字…）", "【備註】（拍立得照片…）" */
        const k=keyOf(clean)||((heading||marked)&&keyOf(deco(body.replace(/\s*[（(][^（）()]*[）)]\s*$/,""))));
        if(k){key=k;sawField=true;if(out[k]===undefined) out[k]="";continue}
        if(heading){key=null;continue}   /* an unknown heading closes the current field */
      }
      if(key) add(key,key==="notes"?raw.replace(lead,"").trim():body.trim());   /* notes keep their ~~strike~~ marks for later */
    }
    const res={};
    for(const [k,v] of Object.entries(out)){
      let parts=v.split("\n").map(s=>s.trim());
      let val=SINGLE.has(k)?parts.filter(Boolean).join(" "):parts.filter(Boolean).join("\n");
      if(k==="date"){val=normDate(val);if(/[OＯ○〇]月|月[OＯ○〇]/.test(val)) val=""}   /* "2026年O月O日" left unfilled */
      if(val) res[k]=val;
    }
    if(/可填寫|日記名稱/.test(title)) title="";   /* the template's placeholder was left as it is */
    /* "周家小日記・周元的那一頁" → a name for the page */
    const nm=title.match(/(?:・|·|\s|^)([^・·\s]{1,8})的(?:那一頁|這一頁|頁面|日記|一頁)/);
    if(nm) res.name=nm[1];
    if(title) res.title=title;
    return res;
  }
  return {parse,normDate};
})();
if(typeof module!=="undefined") module.exports=PARSE;
