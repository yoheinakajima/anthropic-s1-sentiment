const $=s=>document.querySelector(s);
const TOPICS=['Safety / existential-risk disclosures','Governance & founder control','Losses, burn & financing','Valuation & AI-bubble','Compute deals & partners','IPO timing & market impact','Revenue growth & profitability'];
let ALL=[],META={},view=[],sortK='interactions',sortD=-1,page=0;const PER=25;
const cls=s=>s>0.15?'pos':s<-0.15?'neg':'neu';const COL={pos:'#1a9850',neu:'#a3a3a3',neg:'#d73027'};
const fmt=n=>n==null?'–':n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':String(n);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const minVal=()=>{const v=+$('#min').value;return v<=0?0:Math.round(10**v)};
const sel=id=>[...$(id).selectedOptions].map(o=>o.value);
async function init(){
  [ALL,META]=await Promise.all([fetch('data/posts.json').then(r=>r.json()),fetch('data/meta.json').then(r=>r.json())]);
  ALL.forEach(p=>{p.language=p.language||'unknown'});window.__ALL=ALL;
  $('#updated').textContent=`Last updated ${new Date(META.last_updated).toLocaleString()} · ${META.counts.total} posts.`;
  $('#topic').innerHTML=TOPICS.map(t=>`<option>${t}</option>`).join('');
  const langs=Object.entries(ALL.reduce((a,p)=>(a[p.language]=(a[p.language]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]);
  $('#lang').innerHTML=langs.map(([l,n])=>`<option value="${esc(l)}">${esc(l)} (${n})</option>`).join('');
  $('#method-text').innerHTML=`<p>Posts were collected with read-only X searches (many keyword, account and language variants, sliced by day) from Sep 1 to Oct 28, 2026. Reposts and off-topic posts were removed.</p>
   <p><b>Scoring:</b> ${META.counts.hand} posts (every post with 100+ interactions) were read and scored by hand. The other ${META.counts.keyword} were scored by simple keyword rules, which are coarse and pull toward neutral. Use the "Scoring method" filter to compare.</p>
   <p><b>Coverage:</b> ${esc(META.coverage)}</p><ul>${META.caveats.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
   ${META.last_update_note?`<p class="muted">Last refresh: ${esc(META.last_update_note)}</p>`:''}`;
  const ds=ALL.map(p=>p.date).sort();$('#d0').value=$('#d0').min=$('#d1').min=ds[0];$('#d1').value=$('#d0').max=$('#d1').max=ds.at(-1);
  document.querySelectorAll('.filters input,.filters select').forEach(e=>e.addEventListener('input',()=>{page=0;update()}));
  $('#reset').onclick=()=>{$('#q').value='';$('#min').value=2;$('#smin').value=-1;$('#smax').value=1;$('#d0').value=ds[0];$('#d1').value=ds.at(-1);
    ['#topic','#lang'].forEach(i=>[...$(i).options].forEach(o=>o.selected=false));$('#method').value='';page=0;update()};
  document.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;sortD=sortK===k?-sortD:(['handle','topic','summary','language','method'].includes(k)?1:-1);sortK=k;page=0;table()});
  $('#prev').onclick=()=>{if(page>0){page--;table()}};$('#next').onclick=()=>{if((page+1)*PER<view.length){page++;table()}};
  $('#csv').onclick=downloadCSV;update();
}
function filter(){
  const q=$('#q').value.trim().toLowerCase().replace(/^@/,''),mn=minVal(),s0=Math.min(+$('#smin').value,+$('#smax').value),s1=Math.max(+$('#smin').value,+$('#smax').value),
   d0=$('#d0').value,d1=$('#d1').value,ts=sel('#topic'),ls=sel('#lang'),m=$('#method').value;
  $('#minv').textContent=mn;$('#sv').textContent=`${s0.toFixed(2)} to ${s1.toFixed(2)}`;
  return ALL.filter(p=>p.interactions>=mn&&p.sentiment>=s0&&p.sentiment<=s1&&(!d0||p.date>=d0)&&(!d1||p.date<=d1)&&(!ts.length||ts.includes(p.topic))&&(!ls.length||ls.includes(p.language))&&(!m||p.method===m)&&(!q||(p.summary+' '+p.handle+' '+p.topic).toLowerCase().includes(q)));
}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const wavg=ps=>{const w=ps.reduce((a,p)=>a+p.interactions+1,0);return w?ps.reduce((a,p)=>a+p.sentiment*(p.interactions+1),0)/w:NaN};
function update(){view=filter();kpis();scatter();bars();timeline();table();window.repliesUpdate?.(view)}
function kpis(){
  const n=view.length,c={pos:0,neu:0,neg:0};view.forEach(p=>c[cls(p.sentiment)]++);const pct=k=>n?Math.round(100*c[k]/n):0;
  const sg=v=>isNaN(v)?'–':(v>0?'+':'')+v.toFixed(2);
  $('#kpis').innerHTML=`<div class="kpi"><div class="l">Posts</div><div class="v">${n}</div><div class="muted">${fmt(view.reduce((a,p)=>a+p.interactions,0))} interactions</div></div>
  <div class="kpi"><div class="l">Positive / neutral / negative</div><div class="v">${pct('pos')}<small>%</small> / ${pct('neu')}<small>%</small> / ${pct('neg')}<small>%</small></div>
   <div class="split"><span style="flex:${c.pos};background:${COL.pos}"></span><span style="flex:${c.neu};background:${COL.neu}"></span><span style="flex:${c.neg};background:${COL.neg}"></span></div></div>
  <div class="kpi"><div class="l">Average sentiment</div><div class="v">${sg(avg(view.map(p=>p.sentiment)))}</div><div class="muted">each post counts once</div></div>
  <div class="kpi"><div class="l">Weighted sentiment</div><div class="v">${sg(wavg(view))}</div><div class="muted">weighted by interactions</div></div>`;
}
const L={margin:{l:10,r:10,t:10,b:40},font:{family:'system-ui',size:12},paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)'};const CFG={displaylogo:false,responsive:true};
const short=t=>t.replace(' disclosures','').replace(' & profitability','').replace(' & market impact','');
function scatter(){
  const yi=Object.fromEntries(TOPICS.map((t,i)=>[t,i]));const jit=p=>((parseInt(p.id.slice(-4))%1000)/1000-.5)*.6;
  const tr={type:'scattergl',mode:'markers',x:view.map(p=>p.sentiment),y:view.map(p=>yi[p.topic]+jit(p)),customdata:view.map(p=>p.url),
    text:view.map(p=>`<b>@${esc(p.handle)}</b> · ${p.date} · ${fmt(p.interactions)} interactions<br>${esc(p.summary).replace(/(.{1,80})(\s|$)/g,'$1<br>')}<i>${p.method==='hand'?'hand-scored':'keyword-scored'} · sentiment ${p.sentiment}</i>`),
    hovertemplate:'%{text}<extra></extra>',marker:{size:view.map(p=>4+Math.sqrt(p.interactions)*.7),color:view.map(p=>p.sentiment),colorscale:[[0,'#d73027'],[0.5,'#fee08b'],[1,'#1a9850']],cmin:-1,cmax:1,opacity:.7,line:{width:.5,color:'#333'}}};
  const means=TOPICS.map(t=>avg(view.filter(p=>p.topic===t).map(p=>p.sentiment)));
  const m={type:'scatter',mode:'markers',x:means,y:TOPICS.map((t,i)=>i),marker:{symbol:'diamond',size:13,color:'#111'},hovertemplate:'Topic average %{x:.2f}<extra></extra>'};
  Plotly.react('scatter',[tr,m],{...L,margin:{l:200,r:10,t:10,b:45},showlegend:false,xaxis:{range:[-1.08,1.08],title:'Sentiment (−1 negative … +1 positive)',zeroline:true},
    yaxis:{tickvals:TOPICS.map((t,i)=>i),ticktext:TOPICS.map(t=>`${short(t)} (${view.filter(p=>p.topic===t).length})`),range:[-.6,TOPICS.length-.4]}},CFG);
  const el=$('#scatter');el.removeAllListeners?.('plotly_click');el.on('plotly_click',e=>{const u=e.points[0].customdata;if(u)window.open(u,'_blank','noopener')});
}
function bars(){
  const k=['neg','neu','pos'],nm={neg:'Negative',neu:'Neutral',pos:'Positive'};
  Plotly.react('bars',k.map(c=>({type:'bar',orientation:'h',name:nm[c],marker:{color:COL[c]},y:TOPICS.map(short),x:TOPICS.map(t=>view.filter(p=>p.topic===t&&cls(p.sentiment)===c).length)})),
   {...L,barmode:'stack',margin:{l:170,r:10,t:10,b:30},legend:{orientation:'h',y:-.15}},CFG);
  const a=TOPICS.map(t=>avg(view.filter(p=>p.topic===t).map(p=>p.sentiment))),w=TOPICS.map(t=>wavg(view.filter(p=>p.topic===t)));
  Plotly.react('avg',[{type:'bar',orientation:'h',name:'Average',y:TOPICS.map(short),x:a,marker:{color:'#7c8799'}},{type:'bar',orientation:'h',name:'Weighted by interactions',y:TOPICS.map(short),x:w,marker:{color:'#d97757'}}],
   {...L,barmode:'group',margin:{l:170,r:10,t:10,b:30},xaxis:{range:[-1,1],zeroline:true},legend:{orientation:'h',y:-.15}},CFG);
}
function timeline(){
  const by={};view.forEach(p=>(by[p.date]=by[p.date]||[]).push(p));const ds=Object.keys(by).sort();
  const ev=(META.events||[]);
  Plotly.react('time',[{type:'bar',x:ds,y:ds.map(d=>by[d].length),yaxis:'y2',name:'Posts',marker:{color:'rgba(70,130,180,.25)'}},
    {type:'scatter',mode:'lines+markers',x:ds,y:ds.map(d=>avg(by[d].map(p=>p.sentiment))),name:'Avg sentiment',line:{color:'#111'},marker:{size:5},hovertemplate:'%{x}: %{y:.2f}<extra></extra>'}],
   {...L,margin:{l:50,r:50,t:30,b:40},legend:{orientation:'h',y:1.12},yaxis:{title:'Avg sentiment',range:[-1,1],zeroline:true},yaxis2:{overlaying:'y',side:'right',title:'Posts',showgrid:false},
    shapes:ev.map(e=>({type:'line',x0:e.date,x1:e.date,yref:'paper',y0:0,y1:1,line:{color:'#d73027',dash:'dot',width:1}})),
    annotations:ev.map((e,i)=>({x:e.date,yref:'paper',y:i%2?.92:1.0,text:e.label,showarrow:false,font:{size:10,color:'#b02a22'},xanchor:'left'}))},CFG);
}
function table(){
  const s=[...view].sort((a,b)=>{const x=a[sortK]??-1e9,y=b[sortK]??-1e9;return (x>y?1:x<y?-1:0)*sortD});
  document.querySelectorAll('th').forEach(th=>th.className=th.dataset.k===sortK?(sortD>0?'asc':'desc'):'');
  $('#tbl tbody').innerHTML=s.slice(page*PER,(page+1)*PER).map(p=>`<tr data-id="${p.id}" class="${p.replies?.n?'hasrep':''}"><td>${p.date}</td><td><a href="${esc(p.url)}" target="_blank" rel="noopener">@${esc(p.handle)}</a></td><td>${esc(short(p.topic))}</td>
   <td><span class="pill" style="background:${COL[cls(p.sentiment)]}">${p.sentiment>0?'+':''}${p.sentiment}</span></td><td>${fmt(p.interactions)}</td><td>${fmt(p.views)}</td><td>${esc(p.language)}</td><td>${p.method}</td><td>${esc(p.summary)}${p.replies?.n?` <span class="rbadge">💬 ${p.replies.n}</span>`:''}</td></tr>`).join('');
  document.querySelectorAll('#tbl tbody tr.hasrep').forEach(tr=>tr.onclick=e=>{if(e.target.tagName!=='A')window.openReplies?.(tr.dataset.id)});
  $('#tcount').textContent=`(${view.length})`;$('#pinfo').textContent=view.length?`${page*PER+1}–${Math.min((page+1)*PER,view.length)} of ${view.length}`:'No posts match';
}
function downloadCSV(){
  const k=['url','handle','date','interactions','views','language','sentiment','topic','method','summary'];
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;const b=new Blob([[k.join(','),...view.map(p=>k.map(x=>q(p[x])).join(','))].join('\n')],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='anthropic_s1_posts_filtered.csv';a.click();
}
init().catch(e=>{document.body.insertAdjacentHTML('afterbegin',`<p style="color:red;padding:20px">Failed to load data: ${esc(e.message)}. Serve this folder over HTTP (e.g. python -m http.server).</p>`);console.error(e)});
