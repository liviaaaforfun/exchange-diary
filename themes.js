/* Exchange Diary — styles, palettes and page decoration (shared by the editor and later the exports) */
"use strict";
let CUR=0;

const FONTS=[
  {id:"jh1",name:"清松手寫體 1",tag:"圓潤",family:"'JH1'",src:"GitHub · SIL OFL"},
  {id:"jh2",name:"清松手寫體 2",tag:"秀氣",family:"'JH2'",src:"GitHub · SIL OFL"},
  {id:"jh3",name:"清松手寫體 3",tag:"呆萌",family:"'JH3'",src:"GitHub · SIL OFL"},
  {id:"jh9",name:"清松手寫體 9",tag:"文青",family:"'JH9'",src:"GitHub · SIL OFL"},
  {id:"iansui",name:"芫荽",tag:"手寫",family:"'Iansui'",src:"Google Fonts · SIL OFL"},
  {id:"wenkai",name:"霞鶩文楷 TC",tag:"楷書手寫",family:"'LXGW WenKai TC'",src:"Google Fonts · SIL OFL"},
  {id:"cyly",name:"辰宇落雁體",tag:"手寫",family:"'CYLY'",src:"GitHub · SIL OFL"},
  {id:"huninn",name:"粉圓",tag:"圓體",family:"'Huninn'",src:"Google Fonts · SIL OFL"},
  {id:"goround",name:"昭源甜圓",tag:"圓體",family:"'Chiron GoRound TC'",src:"Google Fonts · SIL OFL"},
  {id:"notoserif",name:"Noto Serif TC",tag:"明體",family:"'Noto Serif TC'",src:"Google Fonts · SIL OFL"},
  {id:"cactus",name:"仙人掌明體",tag:"古典明體",family:"'Cactus Classical Serif'",src:"Google Fonts · SIL OFL"}
];
const GRID={lined:"橫線",square:"方格",dot:"點陣",none:"無格線"};
/* frame rectangle insets in mm (top, bottom, outer edge, gutter) and the padding from frame to grid */
const GEO={
  lace:  {ft:15,fb:14,fo:14,fg:17,gp:3, tagT:3.2,tagO:9},
  pearl: {ft:12,fb:11,fo:10,fg:14,gp:4, tagT:3.2,tagO:16},
  stripe:{ft:13,fb:11,fo:19,fg:13,gp:0, tagT:3.6,tagO:21},
  none:  {ft:13,fb:11,fo:11,fg:14,gp:0, tagT:3.6,tagO:11},
  wavy:  {ft:15,fb:15,fo:13,fg:15,gp:3, tagT:4.2,tagO:16, vx:4.6, vt:"#ffffff"},
  puffy: {ft:13,fb:13,fo:11,fg:13,gp:3, tagT:3.4,tagO:14, vx:4.2},
  plain: {ft:13,fb:12,fo:12,fg:14,gp:0, tagT:3.6,tagO:14, vx:4.6},
  bare:  {ft:17,fb:17,fo:16,fg:18,gp:0, tagT:7,tagO:18.5},
  hair:  {ft:15,fb:16,fo:14,fg:16,gp:4, tagT:6.6,tagO:18.5},
  corner:{ft:15,fb:16,fo:14,fg:16,gp:4, tagT:6.6,tagO:18.5},
  rule1: {ft:10,fb:12,fo:11,fg:14,gp:3.5,tagT:4,tagO:14},
  rule2: {ft:10,fb:12,fo:11,fg:14,gp:3.5,tagT:4,tagO:14},
  open:  {ft:11,fb:12,fo:13,fg:15,gp:0, tagT:4,tagO:14}
};
/* colour palettes: c1 = pattern colour (gingham, stripes), c2 = second accent (wave strip, margin rule), label = printed headings, rule = grid lines */
const COLORS={
  sage:   {name:"鼠尾草",   c1:"#9fb096",c2:"#cbb19a",label:"#87957f",rule:"rgba(128,146,124,.40)",base:"#ece6d7",tagBg:"#efe6d3",tagInk:"#5e6a58"},
  milktea:{name:"奶茶可可", c1:"#c2a68e",c2:"#9c7d68",label:"#9a826d",rule:"rgba(150,120,95,.34)", base:"#efe6da",tagBg:"#f0e3d4",tagInk:"#7a5f4c"},
  rose:   {name:"乾燥玫瑰", c1:"#d2aaa3",c2:"#a6b199",label:"#ab8781",rule:"rgba(176,132,125,.32)",base:"#f3e9e3",tagBg:"#f3e2dc",tagInk:"#875c56"},
  mist:   {name:"霧藍灰",   c1:"#a6b5c3",c2:"#cdb69e",label:"#8494a4",rule:"rgba(118,138,158,.36)",base:"#e9ebe8",tagBg:"#e4e8ea",tagInk:"#55667a"},
  olive:  {name:"橄欖奶油", c1:"#a8a67d",c2:"#d9bf86",label:"#878660",rule:"rgba(128,126,90,.36)", base:"#efe9d6",tagBg:"#ede6cc",tagInk:"#5e5d3d"},
  apricot:{name:"杏桃燕麥", c1:"#e0b79a",c2:"#b2a487",label:"#b08b74",rule:"rgba(186,140,110,.32)",base:"#f5e9de",tagBg:"#f6e4d5",tagInk:"#875c44"}
};
/* 粉彩文具 palettes: c1 main block colour, c2 accent, c3 soft background, sky = third pastel, ink = body text (deep colour instead of black) */
const PCOLORS={
  mint: {name:"薄荷莓果",c1:"#91cec6",c2:"#f2c3d6",c3:"#eedfef",sky:"#badaef",label:"#287d76",ink:"#2c5a56",rule:"rgba(206,184,212,.48)",tagBg:"#f3dce7",tagInk:"#287d76",cover:"#d9c4dc"},
  soda: {name:"蘇打藍",  c1:"#a9d2ec",c2:"#f6e19c",c3:"#e3edf6",sky:"#c9e8db",label:"#2d6f92",ink:"#2f4f66",rule:"rgba(170,196,222,.48)", tagBg:"#fbefc4",tagInk:"#2d6f92",cover:"#bcd6e8"},
  peach:{name:"蜜桃奶昔",c1:"#f5c2ad",c2:"#d9ccf1",c3:"#fbece6",sky:"#f8e1a6",label:"#ac5d49",ink:"#6a4237",rule:"rgba(232,196,184,.5)",tagBg:"#ebe2f8",tagInk:"#9a5442",cover:"#eecfc2"},
  grape:{name:"葡萄汽水",c1:"#c6b5e8",c2:"#bfe4d5",c3:"#f1ebf8",sky:"#f5cfe0",label:"#6955a3",ink:"#473d6c",rule:"rgba(204,194,230,.48)",tagBg:"#d9f0e6",tagInk:"#5c4a96",cover:"#d3c7ec"}
};
/* 日系生活誌 palettes: accent = dots and short rules, sub = second quiet tone, head = titles, label = grey notes, ink = body text */
const ECOLORS={
  sage:   {name:"鼠尾草霧藍",c1:"#9db8ac",c2:"#dce8ea",head:"#252525",label:"#999999",ink:"#2e2e2e",rule:"rgba(37,37,37,.08)",tagBg:"transparent",tagInk:"#252525",cover:"#dfe6e2"},
  ink:    {name:"墨黑",      c1:"#3a3a3a",c2:"#e7e5e1",head:"#252525",label:"#929292",ink:"#262626",rule:"rgba(37,37,37,.08)",tagBg:"transparent",tagInk:"#252525",cover:"#e3e3e0"},
  oat:    {name:"燕麥",      c1:"#c8b293",c2:"#f0e9dd",head:"#2b2724",label:"#9d958a",ink:"#34302c",rule:"rgba(70,52,30,.08)",tagBg:"transparent",tagInk:"#2b2724",cover:"#e8e1d5"},
  blue:   {name:"霧灰藍",    c1:"#8fa7b6",c2:"#dfe7ec",head:"#24292c",label:"#94a0a6",ink:"#2c3134",rule:"rgba(30,48,60,.08)",tagBg:"transparent",tagInk:"#24292c",cover:"#dbe3e7"},
  apricot:{name:"杏粉",      c1:"#e0b49e",c2:"#f6e8df",head:"#2b2523",label:"#a0928b",ink:"#332d2a",rule:"rgba(80,50,35,.08)",tagBg:"transparent",tagInk:"#2b2523",cover:"#ecdfd7"},
  matcha: {name:"抹茶",      c1:"#a6b086",c2:"#eceedf",head:"#262822",label:"#979a8c",ink:"#2f322b",rule:"rgba(50,60,30,.08)",tagBg:"transparent",tagInk:"#262822",cover:"#e2e5d6"}
};
/* 文學報刊 palettes: warm monochrome. head = masthead and rules, ink = body text, label = small caps, c1 = tiny ornaments */
const GCOLORS={
  ink:     {name:"墨黑",  head:"#1d1b18",ink:"#2a2723",label:"#7d766d",c1:"#a39686",c2:"#d9d1c4",rule:"rgba(29,27,24,.085)",tagBg:"transparent",tagInk:"#1d1b18",cover:"#d6cdbf"},
  sepia:   {name:"深褐",  head:"#2e2520",ink:"#3a302a",label:"#85776a",c1:"#a38f7a",c2:"#dccfbf",rule:"rgba(60,40,25,.09)",  tagBg:"transparent",tagInk:"#2e2520",cover:"#cbbca7"},
  charcoal:{name:"炭灰",  head:"#2a2a2a",ink:"#323232",label:"#858582",c1:"#9a9a95",c2:"#d6d5d0",rule:"rgba(30,30,30,.08)",  tagBg:"transparent",tagInk:"#2a2a2a",cover:"#d2d1cb"},
  claret:  {name:"酒紅墨",head:"#4a2326",ink:"#2f2826",label:"#8a7672",c1:"#8c5a5a",c2:"#e0cfcb",rule:"rgba(74,35,38,.08)",  tagBg:"transparent",tagInk:"#4a2326",cover:"#cbb6b1"}
};
const THEMES={
  country:{name:"法式鄉村",colors:COLORS,layouts:{A:"A 信紙",B:"B 側欄",C:"C 邊欄線"},frames:{lace:"蕾絲格紋",pearl:"珍珠雕花",stripe:"條紋書口",none:"無"},
           papers:{ivory:"象牙棉紙",cream:"米白手工紙",oat:"燕麥壓紋紙"},def:{color:"sage",layout:"A",frame:"lace",paper:"ivory",grid:"lined"}},
  pastel: {name:"粉彩文具",colors:PCOLORS,layouts:{P1:"D 日誌",P2:"E 網格"},frames:{wavy:"波浪框",puffy:"圓角色塊",plain:"無"},
           papers:{blush:"粉霧白",milk:"奶油白"},def:{color:"mint",layout:"P1",frame:"wavy",paper:"blush",grid:"square"}},
  editorial:{name:"日系生活誌",colors:ECOLORS,layouts:{F:"F 雜誌",G:"G 雙欄"},frames:{bare:"無",hair:"細線框",corner:"裁切角"},
           papers:{white:"純白",warm:"暖白",matte:"淡米白"},def:{color:"sage",layout:"F",frame:"bare",paper:"white",grid:"lined"},lineTarget:7.4},
  gazette:{name:"文學報刊",colors:GCOLORS,layouts:{H:"H 報刊",I:"I 文學"},frames:{rule2:"雙線框",rule1:"單線框",open:"無"},
           papers:{np1:"奶油米白",np2:"暖象牙白",np3:"淡灰褐"},def:{color:"ink",layout:"H",frame:"rule2",paper:"np1",grid:"lined"},lineTarget:7.0}
};
/* clay objects per page: x is measured from the page's outer edge, y from the top, s = size, all in mm */
const CLAY={them:[{o:"pencil",x:111,y:1,s:21,r:-6},{o:"cloud",x:2.5,y:190,s:17},{o:"sphere",x:55,y:4.6,s:6.5},{o:"ring",x:96,y:198.5,s:7}],
            me:  [{o:"heart",x:113,y:1.5,s:18,r:9},{o:"envelope",x:2.5,y:190,s:17,r:-7},{o:"star",x:57,y:3.6,s:8},{o:"sphere",x:98,y:198.5,s:6}]};
const state={theme:"country",color:"sage",layout:"A",frame:"lace",paper:"ivory",grid:"lined",them:"jh1",me:"iansui",show:"them"};
const $=s=>document.querySelector(s), spread=$("#spread");
const byId=id=>FONTS.find(f=>f.id===id);
const label=f=>f.name+(f.id.startsWith("jh")?"（"+f.tag+"）":"");

/* cotton-paper fibres, drawn once */
(function(){
  const c=document.createElement("canvas");c.width=c.height=420;const g=c.getContext("2d");let seed=7;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<520;i++){const x=r()*420,y=r()*420,l=4+r()*18,a=r()*Math.PI*2;g.strokeStyle=r()<.7?`rgba(120,98,70,${.05+r()*.09})`:`rgba(255,255,255,${.25+r()*.3})`;
    g.lineWidth=.4+r()*.6;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+Math.cos(a+.6)*l*.5,y+Math.sin(a+.6)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke()}
  for(let i=0;i<900;i++){g.fillStyle=`rgba(110,90,60,${r()*.07})`;g.fillRect(r()*420,r()*420,1,1)}
  try{spread.style.setProperty("--fiber",`url(${c.toDataURL()})`)}catch(e){spread.style.setProperty("--fiber","none")}
})();
const svgUrl=s=>`url("data:image/svg+xml,${encodeURIComponent(s)}")`;
spread.style.setProperty("--leaf",svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M1.5 8.5C1.5 4 4.5 1.5 8.5 1.5 8.5 5.5 6 8.5 1.5 8.5z'/></svg>`));
spread.style.setProperty("--wave",svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 4' preserveAspectRatio='none'><path d='M0 2C2 0 4 0 6 2S10 4 12 2' fill='none' stroke='black' stroke-width='.7'/></svg>`));

/* ---------- frame drawing, in page millimetres ---------- */
const PAL={ivory:{gingham:"#f4efe3",lace:"#fdfbf6",ridge:"#e3d8c4"},cream:{gingham:"#efe8d8",lace:"#fcf8f0",ridge:"#dfd2bc"},oat:{gingham:"#e9e0cf",lace:"#f8f2e6",ridge:"#d5c7ae"}};
function rectFor(side,g){const L=side==="them"?g.fo:g.fg, R=side==="them"?g.fg:g.fo; return [L,g.ft,148-R,210-g.fb]}
const EMB=`<filter id="emb" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="-.22" dy="-.22" stdDeviation=".12" flood-color="#ffffff" flood-opacity=".95"/><feDropShadow dx=".28" dy=".34" stdDeviation=".22" flood-color="#6b5a45" flood-opacity=".32"/></filter>
<filter id="deb" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx=".25" dy=".25" stdDeviation=".1" flood-color="#ffffff" flood-opacity=".9"/><feDropShadow dx="-.2" dy="-.25" stdDeviation=".18" flood-color="#6b5a45" flood-opacity=".28"/></filter>`;
function pearlRect(x0,y0,x1,y1,gap,w,col){
  return `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" rx="1.6" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="0 ${gap}" filter="url(#emb)"/>`;
}
function scallops(x0,y0,x1,y1,step,rad){
  let s="",dots="";const along=(ax,ay,bx,by)=>{const len=Math.hypot(bx-ax,by-ay),n=Math.max(1,Math.round(len/step));
    for(let i=0;i<n;i++){const t=i/n,cx=ax+(bx-ax)*t,cy=ay+(by-ay)*t;s+=`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${rad}"/>`;dots+=`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r=".62"/>`}};
  along(x0,y0,x1,y0);along(x1,y0,x1,y1);along(x1,y1,x0,y1);along(x0,y1,x0,y0);
  return {s,dots};
}
function corner(x,y,sx,sy,col){
  return `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="${col}" stroke-width=".55" stroke-linecap="round" filter="url(#emb)">
    <path d="M0 13C0 5.5 5.5 0 13 0"/><path d="M13 0C17.2 0 19.4 2.6 17.8 4.3 16.4 5.7 14.2 4.6 15.1 3"/><path d="M0 13C0 17.2 2.6 19.4 4.3 17.8 5.7 16.4 4.6 14.2 3 15.1"/>
    <path d="M3.3 9.4C4.6 7.4 6.6 6.2 9 6"/><path d="M9.4 3.3C7.4 4.6 6.2 6.6 6 9"/>
    <g fill="${col}" stroke="none"><circle cx="5.2" cy="5.2" r=".95"/><circle cx="7" cy="4.4" r=".7"/><circle cx="4.4" cy="7" r=".7"/><circle cx="21" cy="0" r=".55"/><circle cx="23.2" cy="0" r=".45"/><circle cx="0" cy="21" r=".55"/><circle cx="0" cy="23.2" r=".45"/></g></g>`;
}
/* Both pages draw their own decorations. Give every id inside a drawing a per-page name: with shared names, a page
   whose twin is hidden (one page at a time) would point at the hidden copy and lose its filters and patterns. */
function scopeIds(out,side){
  const ids=new Set([...out.matchAll(/\bid="([\w-]+)"/g)].map(m=>m[1]).filter(id=>!id.endsWith("-"+side)));
  for(const id of ids){const nid=`${id}-${side}`,re=new RegExp(`(id="|url\\(#|href="#)${id}(?=[")])`,"g");out=out.replace(re,`$1${nid}`)}
  return out;
}
function drawDeco(svg,side){
  const g=GEO[state.frame],p=PAL[state.paper],P=COLORS[state.color],[x0,y0,x1,y1]=rectFor(side,g);let out=`<defs>${EMB}`;
  if(state.frame==="lace"){
    out+=`<pattern id="gh-${side}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${p.gingham}"/><rect width="3" height="6" fill="${P.c1}" fill-opacity=".36"/><rect width="6" height="3" fill="${P.c1}" fill-opacity=".36"/></pattern></defs>`;
    out+=`<rect width="148" height="210" fill="url(#gh-${side})"/>`;
    const e=4.6,sc=scallops(x0-e,y0-e,x1+e,y1+e,4.4,2.55);
    out+=`<g fill="${p.lace}" filter="url(#emb)"><rect x="${x0-e}" y="${y0-e}" width="${x1-x0+2*e}" height="${y1-y0+2*e}"/>${sc.s}</g>`;
    out+=`<g fill="#ffffff" filter="url(#emb)">${sc.dots}</g>`;
    out+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" style="fill:var(--paper)" filter="url(#deb)"/>`;
    out+=pearlRect(x0-2.3,y0-2.3,x1+2.3,y1+2.3,1.7,.75,p.ridge);
  }else if(state.frame==="pearl"){
    out+=`</defs>`;
    const b=2.6; // a softly tinted band between the pearl line and the fine inner rule
    out+=`<path fill-rule="evenodd" fill="${P.c1}" fill-opacity=".30" filter="url(#deb)" d="M${x0} ${y0}H${x1}V${y1}H${x0}Z M${x0+b} ${y0+b}V${y1-b}H${x1-b}V${y0+b}Z"/>`;
    out+=pearlRect(x0,y0,x1,y1,1.8,1.05,p.lace);
    out+=`<rect x="${x0+b}" y="${y0+b}" width="${x1-x0-2*b}" height="${y1-y0-2*b}" fill="none" stroke="${P.c1}" stroke-width=".35" filter="url(#emb)"/>`;
    out+=`<rect x="${x0+b+1.2}" y="${y0+b+1.2}" width="${x1-x0-2*b-2.4}" height="${y1-y0-2*b-2.4}" fill="none" stroke="${P.c2}" stroke-width=".25" stroke-opacity=".8"/>`;
    const c=-1.6;
    out+=corner(x0+c,y0+c,1,1,P.label)+corner(x1-c,y0+c,-1,1,P.label)+corner(x0+c,y1-c,1,-1,P.label)+corner(x1-c,y1-c,-1,-1,P.label);
  }else if(state.frame==="stripe"){
    const B=11,outerLeft=side==="them";
    out+=`<pattern id="st-${side}" width="3.6" height="10" patternUnits="userSpaceOnUse"><rect width="3.6" height="10" fill="${P.base}"/><rect width="1.7" height="10" fill="${P.c1}" fill-opacity=".85"/></pattern></defs>`;
    out+=`<rect x="${outerLeft?0:148-B}" y="0" width="${B}" height="210" fill="url(#st-${side})"/>`;
    const w=2.2,r=2.6,edge=outerLeft?B:148-B,dir=outerLeft?1:-1;
    let path=`M${edge-dir*1.4} -1 L${edge+dir*w} -1`;
    for(let y=-1;y<211;y+=2*r){path+=` A${r} ${r} 0 0 ${outerLeft?0:1} ${edge+dir*w} ${y+2*r}`}
    path+=` L${edge-dir*1.4} 211 Z`;
    out+=`<path d="${path}" fill="${P.c2}" filter="url(#emb)"/>`;
    out+=`<line x1="${outerLeft?edge+w+4:x0}" y1="${y0-3.5}" x2="${outerLeft?x1:edge-w-4}" y2="${y0-3.5}" stroke="${p.ridge}" stroke-width=".8" stroke-linecap="round" stroke-dasharray="0 1.7" filter="url(#emb)"/>`;
  }else{out+=`</defs>`}
  svg.innerHTML=scopeIds(out,side);
}


/* ---------- 粉彩文具 drawing ---------- */
function roundRectPoints(x0,y0,x1,y1,r,step){
  const pts=[],push=(x,y,nx,ny)=>pts.push([x,y,nx,ny]);
  const edge=(ax,ay,bx,by,nx,ny)=>{const n=Math.max(1,Math.round(Math.hypot(bx-ax,by-ay)/step));for(let i=0;i<n;i++){const t=i/n;push(ax+(bx-ax)*t,ay+(by-ay)*t,nx,ny)}};
  const arc=(cx,cy,a0)=>{const n=Math.max(2,Math.round(r*Math.PI/2/step));for(let i=0;i<n;i++){const a=a0+i/n*Math.PI/2;push(cx+Math.cos(a)*r,cy+Math.sin(a)*r,Math.cos(a),Math.sin(a))}};
  edge(x0+r,y0,x1-r,y0,0,-1);arc(x1-r,y0+r,-Math.PI/2);edge(x1,y0+r,x1,y1-r,1,0);arc(x1-r,y1-r,0);
  edge(x1-r,y1,x0+r,y1,0,1);arc(x0+r,y1-r,Math.PI/2);edge(x0,y1-r,x0,y0+r,-1,0);arc(x0+r,y0+r,Math.PI);
  return pts;
}
function wobbly(x0,y0,x1,y1,r,amp,wl,seed){
  const pts=roundRectPoints(x0,y0,x1,y1,r,.8);let s=0,d="";
  pts.forEach((p,i)=>{if(i)s+=Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1]);
    const o=amp*(.65*Math.sin(2*Math.PI*s/wl+seed)+.35*Math.sin(2*Math.PI*s/(wl*2.7)+seed*1.7));
    d+=(i?"L":"M")+(p[0]+p[2]*o).toFixed(2)+" "+(p[1]+p[3]*o).toFixed(2)});
  return d+"Z";
}
spread.style.setProperty("--wavyblk",svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 40' preserveAspectRatio='none'><path d='${wobbly(3,3,197,37,12,1.6,26,1.3)}'/></svg>`));
function drawPastel(svg,side){
  const g=GEO[state.frame],P=PCOLORS[state.color],[x0,y0,x1,y1]=rectFor(side,g),outerLeft=side==="them";
  const X=v=>outerLeft?v:148-v; // x measured from the outer edge
  let out=`<defs><filter id="puff-${side}" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy=".7" stdDeviation="1.1" flood-color="${P.label}" flood-opacity=".16"/></filter></defs>`;
  const dots=(c)=>`<circle cx="${X(5.5)}" cy="122" r="1.3" fill="${c.c2}"/><circle cx="${X(7)}" cy="134" r="1.7" fill="none" stroke="#fff" stroke-width=".7"/><circle cx="${X(4.8)}" cy="168" r=".9" fill="${c.sky}"/>`+
    `<path d="M${X(6)-1.6} 150h3.2M${X(6)} 148.4v3.2" stroke="${c.c2}" stroke-width=".7" stroke-linecap="round"/>`;
  if(state.frame==="wavy"){
    out+=`<rect width="148" height="210" fill="${P.c1}"/>`;
    out+=`<path d="${wobbly(x0-1.5,y0-1.5,x1+1.5,y1+1.5,7,1.4,17,outerLeft?.4:2.1)}" style="fill:var(--paper)" stroke="#ffffff" stroke-width="1.6" filter="url(#puff-${side})"/>`;
    out+=dots(P);
  }else if(state.frame==="puffy"){
    out+=`<rect width="148" height="210" fill="${P.c3}"/>`;
    out+=`<rect x="${x0-1.5}" y="${y0-1.5}" width="${x1-x0+3}" height="${y1-y0+3}" rx="7" style="fill:var(--paper)" filter="url(#puff-${side})"/>`;
    out+=`<rect x="${x0-.6}" y="${y0-.6}" width="${x1-x0+1.2}" height="${y1-y0+1.2}" rx="6.2" fill="none" stroke="#ffffff" stroke-width=".9" opacity=".9"/>`;
    out+=dots({c2:P.c2,sky:P.c1});
  }
  svg.innerHTML=scopeIds(out,side);
}
function placeClay(layer,side){
  if(state.theme!=="pastel"){layer.innerHTML="";return}
  layer.innerHTML=CLAY[side].map(c=>{const pos=side==="them"?`left:calc(${c.x} * var(--mm))`:`right:calc(${c.x} * var(--mm))`;
    const flip=side==="me"&&c.o==="pencil"?" scaleX(-1)":"";
    return `<svg class="clay" viewBox="0 0 40 40" style="${pos};top:calc(${c.y} * var(--mm));width:calc(${c.s} * var(--mm));height:calc(${c.s} * var(--mm));transform:rotate(${c.r||0}deg)${flip}"><use href="#cl-${c.o}"/></svg>`}).join("");
}

/* ---------- 日系生活誌 drawing ---------- */
function drawEditorial(svg,side){
  const g=GEO[state.frame],P=ECOLORS[state.color],[x0,y0,x1,y1]=rectFor(side,g),outerLeft=side==="them";let out="";
  if(state.frame==="hair"){
    out+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" stroke="${P.label}" stroke-opacity=".55" stroke-width=".2"/>`;
  }else if(state.frame==="corner"){
    const L=6,k=(x,y,dx,dy)=>`<path d="M${x+dx*L} ${y}H${x}V${y+dy*L}" fill="none" stroke="${P.head}" stroke-width=".25"/>`;
    out+=k(x0,y0,1,1)+k(x1,y0,-1,1)+k(x0,y1,1,-1)+k(x1,y1,-1,-1);
    out+=`<circle cx="${outerLeft?x0+L+2.5:x1-L-2.5}" cy="${y0}" r=".7" fill="${P.c1}"/>`;
  }
  /* flat colour blocks: a pale chip behind the date with a small solid square, and an index tab on the fore-edge */
  const lh=LHN,top=g.ft+g.gp+lh,tx=g.fo+g.gp+2.5,X=(x,w)=>outerLeft?x:148-x-w;
  out+=`<rect x="${X(tx-4,34)}" y="${top-2}" width="34" height="${(lh*2+3).toFixed(2)}" fill="${P.c2}"/>`;
  out+=`<rect x="${X(tx-6.5,5.5)}" y="${top-4.5}" width="5.5" height="5.5" fill="${P.c1}"/>`;
  const tabY=g.ft+g.gp+lh*4,pg=String(CUR+1).padStart(2,"0");
  out+=`<rect x="${X(0,7)}" y="${tabY.toFixed(2)}" width="7" height="17" fill="${P.c1}"/>`;
  out+=`<text x="${outerLeft?3.6:148-3.6}" y="${(tabY+8.5).toFixed(2)}" text-anchor="middle" dominant-baseline="central" transform="rotate(${outerLeft?-90:90} ${outerLeft?3.6:148-3.6} ${(tabY+8.5).toFixed(2)})" font-family="Jost,sans-serif" font-size="2.3" letter-spacing=".5" fill="#ffffff">no. ${pg}</text>`;
  svg.innerHTML=scopeIds(out,side);
}
let LHN=6.7;
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"],WD=["sun.","mon.","tue.","wed.","thu.","fri.","sat."];
function updateEDates(){
  for(const pg of spread.querySelectorAll(".page")){
    const m=(pg.querySelector(".f-date .val").textContent||"").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/),ed=pg.querySelector(".edate");
    if(!m){ed.querySelector(".mon").textContent="";ed.querySelector(".day").textContent="";ed.querySelector(".wd").textContent="";ed.querySelector(".wdl").textContent="";continue}
    const d=new Date(+m[1],+m[2]-1,+m[3]);
    ed.querySelector(".mon").textContent=MONTHS[+m[2]-1]||"";ed.querySelector(".day").textContent=String(+m[3]).padStart(2,"0");ed.querySelector(".wd").textContent=isNaN(d)?"":WD[d.getDay()];ed.querySelector(".wdl").textContent=isNaN(d)?"":WDL[d.getDay()];
  }
}
spread.addEventListener("input",e=>{if(e.target.closest(".f-date"))updateEDates()});

/* ---------- 文學報刊 drawing ---------- */
function drawGazette(svg,side){
  const g=GEO[state.frame],P=GCOLORS[state.color],[x0,y0,x1,y1]=rectFor(side,g);let out="";
  if(state.frame==="rule1") out+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" stroke="${P.head}" stroke-width=".25"/>`;
  if(state.frame==="rule2") out+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" stroke="${P.head}" stroke-width=".6"/><rect x="${x0+1.2}" y="${y0+1.2}" width="${x1-x0-2.4}" height="${y1-y0-2.4}" fill="none" stroke="${P.head}" stroke-width=".18"/>`;
  svg.innerHTML=scopeIds(out,side);
}
const WDL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

