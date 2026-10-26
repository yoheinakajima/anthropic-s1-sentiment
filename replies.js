(()=>{
let REP=null,VIEW=[];const T=['Safety / existential-risk disclosures','Governance & founder control','Losses, burn & financing','Valuation & AI-bubble','Compute deals & partners','IPO timing & market impact','Revenue growth & profitability'];
const q=s=>document.querySelector(s),E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sh=t=>t.replace(' disclosures','').replace(' & profitability','').replace(' & market impact','');
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN,sg=v=>v==null||isNaN(v)?'–':(v>0?'+':'')+v.toFixed(2),pc=v=>v==null||isNaN(v)?'–':Math.round(v*100)+'%';
const mode=()=>q('input[name=rm]:checked').value,W=()=>q('#rw').checked,rs=p=>W()?p.replies.wmean:p.replies.mean;
const LY={font:{family:'system-ui',size:12},paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)'},CF={displaylogo:false,responsive:true};
const RG=[[0,'#d73027'],[0.5,'#fee08b'],[1,'#1a9850']];
async function load(){if(!REP)REP=(await (await fetch('data/replies.json')).json()).replies;return REP}
window.repliesUpdate=v=>{VIEW=v.filter(p=>p.hi&&p.replies&&p.replies.n>0);draw()};
function draw(){
  const m=mode(),P=VIEW,yi=Object.fromEntries(T.map((t,i)=>[t,i])),j=p=>((parseInt(p.id.slice(-4))%1000)/1000-.5)*.6,Y=P.map(p=>yi[p.topic]+j(p));
  const hov=p=>`<b>@${E(p.handle)}</b> · ${p.interactions} interactions<br>${E(p.summary).slice(0,90)}<br>orig ${sg(p.sentiment)} · replies ${sg(rs(p))} (n=${p.replies.n})<br>agree ${pc(p.replies.agree)} · disagree ${pc(p.replies.disagree)} · off-topic ${pc(p.replies.offtopic)} · drift ${pc(p.replies.drift)}`;
  const sz=P.map(p=>6+Math.sqrt(p.interactions)*.45),base={type:'scatter',mode:'markers',y:Y,customdata:P.map(p=>p.id),text:P.map(hov),hovertemplate:'%{text}<extra></extra>'};
  let tr=[],shapes=[],xt='Sentiment (−1 … +1)',xr=[-1.08,1.08];
  const orig=(c,op=.85)=>({...base,name:'Original',x:P.map(p=>p.sentiment),marker:{size:sz,color:c??P.map(p=>p.sentiment),colorscale:RG,cmin:-1,cmax:1,opacity:op,line:{width:.6,color:'#333'}}});
  const rdot=()=>({...base,name:'Replies',x:P.map(rs),marker:{size:sz,symbol:'circle-open',color:P.map(rs),colorscale:RG,cmin:-1,cmax:1,line:{width:2.5}}});
  if(m==='orig')tr=[orig()];
  if(m==='reply')tr=[orig(null,.35),rdot()];
  if(m==='delta'){tr=[orig(null,.4),{...rdot(),marker:{size:5,color:'#111'}}];
    P.forEach((p,i)=>{const d=rs(p)-p.sentiment;void d});}
  if(m==='agree'){xt='Disagree rate (share of sampled replies)';xr=[-.03,.7];
    tr=[{...base,x:P.map(p=>p.replies.disagree),marker:{size:sz,color:P.map(p=>p.replies.agree_of_opined??.5),colorscale:RG,cmin:0,cmax:1,line:{width:.6,color:'#333'},showscale:true,colorbar:{title:'agree÷(agree+disagree)',thickness:10}}}]}
  if(m==='combined')tr=[{...base,x:P.map(p=>p.replies.combined),marker:{size:sz,color:P.map(p=>p.replies.combined),colorscale:RG,cmin:-1,cmax:1,line:{width:.6,color:'#333'},showscale:true,colorbar:{title:'combined',thickness:10}}}];
  if(m==='drift'){xt='Topic drift (share of replies on a different topic)';xr=[-.03,1.05];
    tr=[{...base,x:P.map(p=>p.replies.drift),marker:{size:sz,color:P.map(p=>p.replies.offtopic),colorscale:[[0,'#2c7bb6'],[1,'#fdae61']],cmin:0,cmax:.6,line:{width:.6,color:'#333'},showscale:true,colorbar:{title:'off-topic stance',thickness:10}}}]}
  const ann=m==='delta'?P.filter(p=>Math.abs(rs(p)-p.sentiment)>.02).map((p,i)=>({x:rs(p),y:Y[P.indexOf(p)],ax:p.sentiment,ay:Y[P.indexOf(p)],xref:'x',yref:'y',axref:'x',ayref:'y',showarrow:true,arrowhead:2,arrowsize:1,arrowwidth:1.4,arrowcolor:rs(p)<p.sentiment?'#d73027':'#1a9850',text:''})):[];
  Plotly.react('rplot',tr,{...LY,margin:{l:200,r:20,t:10,b:45},showlegend:m==='reply',legend:{orientation:'h',y:1.05},annotations:ann,
    xaxis:{range:xr,title:xt,zeroline:true},yaxis:{tickvals:T.map((t,i)=>i),ticktext:T.map(t=>`${sh(t)} (${P.filter(p=>p.topic===t).length})`),range:[-.6,T.length-.4]}},CF);
  const el=q('#rplot');el.removeAllListeners?.('plotly_click');el.on('plotly_click',e=>window.openReplies(e.points[0].customdata));
  const n=P.reduce((a,p)=>a+p.replies.n,0),wa=k=>P.length?P.reduce((a,p)=>a+p.replies[k]*p.replies.n,0)/n:NaN;
  q('#rkpis').innerHTML=`<div class="kpi"><div class="l">Posts / replies scored</div><div class="v">${P.length} / ${n}</div></div>
   <div class="kpi"><div class="l">Avg original → replies</div><div class="v">${sg(mean(P.map(p=>p.sentiment)))} → ${sg(mean(P.map(rs)))}</div><div class="muted">${W()?'weighted':'plain'} reply mean per post</div></div>
   <div class="kpi"><div class="l">Agree / disagree</div><div class="v">${pc(wa('agree'))} / ${pc(wa('disagree'))}</div><div class="muted">of all scored replies</div></div>
   <div class="kpi"><div class="l">Topic drift</div><div class="v">${pc(wa('drift'))}</div><div class="muted">${pc(wa('offtopic'))} off-topic stance</div></div>`;
  topicTable(P);const sw=q('#sankeywrap');sw.hidden=m!=='drift';if(m==='drift')sankey(P);
}
function topicTable(P){
  q('#rtopic tbody').innerHTML=T.map(t=>{const ps=P.filter(p=>p.topic===t);if(!ps.length)return'';const n=ps.reduce((a,p)=>a+p.replies.n,0),wa=k=>ps.reduce((a,p)=>a+(p.replies[k]??0)*p.replies.n,0)/n;
   const ag=wa('agree'),dg=wa('disagree');
   return `<tr><td>${E(sh(t))}</td><td>${ps.length}</td><td>${n}</td><td>${sg(mean(ps.map(p=>p.sentiment)))}</td><td>${sg(mean(ps.map(p=>p.replies.mean)))}</td><td>${sg(mean(ps.map(p=>p.replies.wmean)))}</td><td>${sg(mean(ps.map(p=>rs(p)-p.sentiment)))}</td><td>${pc(ag)}</td><td>${pc(dg)}</td><td><b>${pc(ag/(ag+dg))}</b></td><td>${pc(wa('offtopic'))}</td><td>${pc(wa('drift'))}</td></tr>`}).join('');
}
async function sankey(P){
  const R=await load(),RT=[...T,'other'],f={};P.forEach(p=>(R[p.id]||[]).forEach(r=>{const k=p.topic+'|'+r.topic;f[k]=(f[k]||0)+1}));
  const lab=[...T.map(t=>sh(t)+' (post)'),...RT.map(t=>(t==='other'?'other':sh(t))+' (reply)')],ks=Object.keys(f);
  Plotly.react('sankey',[{type:'sankey',arrangement:'snap',node:{label:lab,pad:10,thickness:14,color:lab.map((l,i)=>i<T.length?'#d97757':'#7c8799')},
    link:{source:ks.map(k=>T.indexOf(k.split('|')[0])),target:ks.map(k=>T.length+RT.indexOf(k.split('|')[1])),value:ks.map(k=>f[k]),color:ks.map(k=>k.split('|')[0]===k.split('|')[1]?'rgba(26,152,80,.35)':'rgba(150,150,150,.25)')}}],
    {...LY,margin:{l:10,r:10,t:10,b:10}},CF);
}
window.openReplies=async id=>{const R=await load(),p=VIEW.find(x=>x.id===id)||(window.__ALL||[]).find(x=>x.id===id);const rs_=R[id]||[];if(!p)return;
  q('#ptitle').innerHTML=`<a href="${E(p.url)}" target="_blank" rel="noopener">@${E(p.handle)}</a> · ${E(p.summary)}<div class="muted">orig ${sg(p.sentiment)} · ${E(sh(p.topic))} · replies ${sg(p.replies.mean)} (weighted ${sg(p.replies.wmean)}) · agree ${pc(p.replies.agree)} · disagree ${pc(p.replies.disagree)} · drift ${pc(p.replies.drift)}</div>`;
  q('#pbody').innerHTML=rs_.length?rs_.map(r=>`<div class="rep"><div class="m"><a href="${E(r.url)}" target="_blank" rel="noopener">@${E(r.handle)}</a><span>${r.eng} eng</span><span class="st st-${r.stance}">${r.stance}</span><span>sent ${sg(r.sentiment)}</span><span>${E(r.topic==='other'?'other':sh(r.topic))}</span></div>${E(r.text)}</div>`).join(''):'<p>No replies sampled.</p>';
  q('#panel').hidden=false};
document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('#rmode input').forEach(i=>i.addEventListener('change',draw));q('#pclose').onclick=()=>q('#panel').hidden=true;
  document.addEventListener('keydown',e=>{if(e.key==='Escape')q('#panel').hidden=true});
  fetch('data/meta.json').then(r=>r.json()).then(m=>{if(m.replies)q('#rcaveats').innerHTML=`Sample: ${m.replies.kept} replies kept of ${m.replies.raw} fetched across ${m.replies.posts_with_replies} posts. `+m.replies.caveats.map(E).join(' ')})});
})();
