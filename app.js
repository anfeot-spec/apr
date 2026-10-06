const db = window.supabase.createClient(
  'https://ywcfkvzssgibahkzbweo.supabase.co',
  'sb_publishable_PuVKjyIFI6N5V9pIQlDi7Q_92Yi7AGa'
);
let responses = [];
let scaleSuggestions = [];
const $ = id => document.getElementById(id);
const average = (data,key) => data.length ? data.reduce((sum,item)=>sum + Number(item[key]),0)/data.length : 0;
const valueLabel = (n,type) => type === 'money' ? new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(n) : new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(n);
const escapeHtml = text => text.replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function renderScaleSuggestions(){
  $('suggestion-count').textContent=`${scaleSuggestions.length} propuesta${scaleSuggestions.length===1?'':'s'}`;
  $('suggestion-list').innerHTML=scaleSuggestions.map(suggestion=>`<article class="suggestion-item">${escapeHtml(suggestion)}</article>`).join('');
}

async function loadResponses(){
  const {data,error}=await db.rpc('get_apr_points',{selected_edition:null,selected_gender:null,selected_age:null});
  if(error){console.error('No se han podido cargar las respuestas.',error);return;}
  responses=data || [];
  updateEditionFilter();
  render();
}

async function loadScaleSuggestions(){
  const {data,error}=await db.from('scale_suggestions').select('content').order('created_at',{ascending:false});
  if(error){console.error('No se han podido cargar las sugerencias.',error);return;}
  scaleSuggestions=(data || []).map(item=>item.content);
  renderScaleSuggestions();
}

function filteredResponses(){
  const edition=$('filter-edition').value, gender=$('filter-gender').value, age=$('filter-age').value;
  return responses.filter(r => (!edition || r.edition===edition) && (!gender || (r.gender || 'Sin respuesta')===gender) && (!age || (r.age || 'Sin respuesta')===age));
}
function bins(data,key,bins){
  return bins.map(([label,min,max]) => ({label,count:data.filter(r=>Number(r[key])>=min && Number(r[key])<max).length}));
}
function categories(data,key){
  const all={}; data.forEach(r=>{const value=r[key] || 'Sin respuesta';all[value]=(all[value]||0)+1});
  return Object.entries(all).map(([label,count])=>({label,count}));
}
function renderBars(id, values){
  const max=Math.max(...values.map(v=>v.count),1);
  $(id).innerHTML=values.map(v=>`<div class="bar-row"><span class="bar-label">${v.label}</span><div class="bar-track"><div class="bar-fill" style="width:${v.count/max*100}%"></div></div><span class="bar-value">${v.count}</span></div>`).join('');
}
function renderScatter(data){
  const host=$('scatter-chart');
  if(!data.length){host.innerHTML='';return;}
  const width=Math.max(host.clientWidth,300), height=Math.max(host.clientHeight,280);
  const m={top:26,right:28,bottom:48,left:62};
  const xVals=data.map(d=>d.term), yVals=data.map(d=>d.gain), rVals=data.map(d=>d.investment);
  const steppedDomain=(values,step)=>[Math.max(0,Math.floor(Math.min(...values)/step)*step-step),Math.ceil(Math.max(...values)/step)*step+step];
  const nextNiceStep=step=>{const power=10**Math.floor(Math.log10(step)),scaled=step/power;return scaled<2?2*power:scaled<5?5*power:10*power};
  let xStep=3,x1=Math.ceil(Math.max(...xVals)/xStep)*xStep+xStep;
  while(x1/xStep+1>10){xStep=nextNiceStep(xStep);x1=Math.ceil(Math.max(...xVals)/xStep)*xStep+xStep}
  let yStep=2,yDomain=steppedDomain(yVals,yStep);
  while((yDomain[1]-yDomain[0])/yStep+1>10){yStep=nextNiceStep(yStep);yDomain=steppedDomain(yVals,yStep)}
  const x0=0,y0=yDomain[0],y1=yDomain[1];
  const scale=(v,a,b,c,d)=>c+(v-a)*(d-c)/(b-a);
  const x=v=>scale(v,x0,x1,m.left,width-m.right), y=v=>scale(v,y0,y1,height-m.bottom,m.top);
  const radius=v=>4+(Math.sqrt(v)-Math.sqrt(Math.min(...rVals)))/(Math.max(Math.sqrt(Math.max(...rVals))-Math.sqrt(Math.min(...rVals)),1))*13;
  const meanX=average(data,'term'),meanY=average(data,'gain'),meanInvestment=average(data,'investment');
  const ticks=(a,b,step)=>Array.from({length:Math.round((b-a)/step)+1},(_,i)=>a+i*step);
  const fmt=v=>Math.round(v).toLocaleString('es-ES');
  const meanFmt=v=>Number(v.toFixed(1)).toLocaleString('es-ES');
  const xTicks=ticks(x0,x1,xStep),yTicks=ticks(y0,y1,yStep);
  const gridX=xTicks.map(v=>`<line class="grid-line" x1="${x(v)}" x2="${x(v)}" y1="${m.top}" y2="${height-m.bottom}"/><text x="${x(v)}" y="${height-m.bottom+20}" text-anchor="middle">${fmt(v)}</text>`).join('');
  const gridY=yTicks.map(v=>`<line class="grid-line" x1="${m.left}" x2="${width-m.right}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.left-9}" y="${y(v)+4}" text-anchor="end">${fmt(v)}%</text>`).join('');
  const dots=data.map((d,i)=>`<circle class="dot" cx="${x(d.term)}" cy="${y(d.gain)}" r="${radius(d.investment)}"><title>Respuesta ${i+1}: ${d.term} meses, ${d.gain}% de revalorización mínima, ${valueLabel(d.investment,'money')} € de inversión mínima</title></circle>`).join('');
  const meanDot=`<circle class="mean-dot" cx="${x(meanX)}" cy="${y(meanY)}" r="${radius(meanInvestment)}"><title>Medias: ${meanFmt(meanX)} meses, ${meanFmt(meanY)}% de revalorización mínima y ${valueLabel(meanInvestment,'money')} € de inversión mínima</title></circle>`;
  host.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Plazo máximo en meses, revalorización mínima en porcentaje y tamaño del punto según inversión mínima"><line class="axis-line" x1="${m.left}" x2="${width-m.right}" y1="${height-m.bottom}" y2="${height-m.bottom}"/><line class="axis-line" x1="${m.left}" x2="${m.left}" y1="${m.top}" y2="${height-m.bottom}"/>${gridX}${gridY}<line class="mean-line" x1="${x(meanX)}" x2="${x(meanX)}" y1="${m.top}" y2="${height-m.bottom}"/><text class="mean-label" x="${Math.min(x(meanX)+5,width-135)}" y="${m.top+12}">Media: ${meanFmt(meanX)} meses</text><line class="mean-line" x1="${m.left}" x2="${width-m.right}" y1="${y(meanY)}" y2="${y(meanY)}"/><text class="mean-label" x="${m.left+5}" y="${Math.max(y(meanY)-6,m.top+26)}">Media: ${meanFmt(meanY)}%</text>${dots}${meanDot}<text class="axis-title" x="${(m.left+width-m.right)/2}" y="${height-4}" text-anchor="middle">Plazo máximo (meses)</text><text class="axis-title" transform="translate(15 ${(m.top+height-m.bottom)/2}) rotate(-90)" text-anchor="middle">Revalorización mínima (%)</text></svg>`;
}
function render(){
  const data=filteredResponses();
  $('response-count').textContent=`${data.length} respuesta${data.length===1?'':'s'} mostrada${data.length===1?'':'s'}`;
  $('empty-state').hidden=Boolean(data.length);
  $('summary-cards').innerHTML=[['Revalorización mínima media',average(data,'gain'),'%' ],['Plazo máximo medio',average(data,'term'),'meses'],['Inversión mínima media',average(data,'investment'),'€']].map(([label,value,unit])=>`<article class="summary-card"><p>${label}</p><strong>${valueLabel(value,unit==='€'?'money':'number')}</strong><span>${unit}</span></article>`).join('');
  renderScatter(data);
  renderBars('gain-chart',bins(data,'gain',[['Menos de 10%',0,10],['10–11,9%',10,12],['12–14,9%',12,15],['15% o más',15,Infinity]]));
  renderBars('term-chart',bins(data,'term',[['Hasta 6',0,7],['7–12',7,13],['13–18',13,19],['Más de 18',19,Infinity]]));
  renderBars('investment-chart',bins(data,'investment',[['Menos de 1.000 €',0,1000],['1.000–1.999 €',1000,2000],['2.000–4.999 €',2000,5000],['5.000 € o más',5000,Infinity]]));
  renderBars('edition-chart',categories(data,'edition'));
}
function updateEditionFilter(){
  const select=$('filter-edition'), current=select.value;
  const editions=[...new Set(responses.map(r=>r.edition))];
  select.innerHTML='<option value="">Todas las ediciones</option>'+editions.map(x=>`<option>${x}</option>`).join('');select.value=current;
}
$('survey-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  if(!form.checkValidity()){form.reportValidity();return;}
  const data=Object.fromEntries(new FormData(form));
  ['gain','term','investment'].forEach(k=>data[k]=Number(data[k]));
  const {error}=await db.from('apr_responses').insert({
    gain:data.gain,term:data.term,investment:data.investment,edition:data.edition,
    gender:data.gender || null,age:data.age || null
  });
  if(error){$('form-status').textContent='No se ha podido enviar la respuesta. Inténtalo de nuevo.';console.error(error);return;}
  form.reset();$('form-status').textContent='Gracias. Tu respuesta ya se ha añadido a los resultados.';
  await loadResponses();
  setTimeout(()=>$('form-status').textContent='',6000);
});
['filter-edition','filter-gender','filter-age'].forEach(id=>$(id).addEventListener('change',render));
$('clear-filters').addEventListener('click',()=>{['filter-edition','filter-gender','filter-age'].forEach(id=>$(id).value='');render()});
$('scale-suggestion-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const field=$('scale-suggestion'),suggestion=field.value.trim();
  if(!suggestion){field.reportValidity();return;}
  const {error}=await db.from('scale_suggestions').insert({content:suggestion});
  if(error){$('suggestion-status').textContent='No se ha podido publicar la sugerencia. Inténtalo de nuevo.';console.error(error);return;}
  field.value='';
  $('suggestion-status').textContent='Tu sugerencia se ha publicado.';
  await loadScaleSuggestions();
  setTimeout(()=>$('suggestion-status').textContent='',6000);
});
$('year').textContent=new Date().getFullYear();updateEditionFilter();render();
renderScaleSuggestions();
Promise.all([loadResponses(),loadScaleSuggestions()]);
window.addEventListener('resize',()=>renderScatter(filteredResponses()));
