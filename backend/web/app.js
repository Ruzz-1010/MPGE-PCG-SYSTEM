const $=id=>document.getElementById(id);
const roleNames={regional:'Regional Administrator',station:'Station Administrator',inspector:'Inspector Personnel',records:'Records Officer',technical:'IT System Administrator'};
const metricNames={stations:'Authorized stations',vessels:'Registered vessels',activeVessels:'Active vessel profiles',accounts:'Authorized accounts'};
let user=null,dashboard=null,view='overview',generation=0,profileId=null,camera=null;
let filters={q:'',status:'',type:'',stationId:'',page:1};
function stopCamera(){if(camera){camera.getTracks().forEach(t=>t.stop());camera=null;}}
function selectView(id){stopCamera();view=id;profileId=null;nav();render().catch(handle);}
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;}
function message(text='',error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function show(id){for(const p of ['login','password','workspace'])$(p).hidden=p!==id;}
function reset(){stopCamera();generation++;user=null;dashboard=null;view='overview';profileId=null;filters={q:'',status:'',type:'',stationId:'',page:1};$('welcome').textContent='';$('scope').textContent='';$('nav').replaceChildren();$('content').replaceChildren();$('loginForm').reset();$('passwordForm').reset();show('login');}
async function api(path,{method='GET',data}={}){
 const headers={'X-VW-Browser':'1'};if(data!==undefined)headers['Content-Type']='application/json';
 const r=await fetch('/api/'+path,{method,headers,credentials:'same-origin',cache:'no-store',body:data===undefined?undefined:JSON.stringify(data)});
 const result=await r.json();if(!r.ok){const e=new Error(result.error??'Request failed');e.status=r.status;throw e;}return result;
}
function handle(e){if(e.status===401){reset();message('Session expired or credentials invalid. Please sign in.',true);}else message(e.message||'Unable to reach server.',true);}
function theme(value){if(!['graphite','cobalt','evergreen'].includes(value))value='graphite';document.documentElement.dataset.theme=value;$('theme').value=value;try{localStorage.setItem('vw-theme',value);}catch{}}
try{theme(localStorage.getItem('vw-theme')??'graphite');}catch{theme('graphite');}
$('theme').addEventListener('change',e=>theme(e.target.value));
function table(headers,rows){const wrap=node('div',undefined,'tablewrap'),t=node('table'),thead=node('thead'),hr=node('tr');for(const h of headers){const th=node('th',h);th.scope='col';hr.append(th);}thead.append(hr);t.append(thead);const body=node('tbody');for(const row of rows){const tr=node('tr');for(const field of row)tr.append(node('td',field??'—'));body.append(tr);}if(!rows.length){const tr=node('tr'),td=node('td','No authorized records found.');td.colSpan=headers.length;tr.append(td);body.append(tr);}t.append(body);wrap.append(t);return wrap;}
function card(title){const section=node('section',undefined,'card section');section.append(node('h2',title));return section;}
function nav(){const n=$('nav');n.replaceChildren();const tabs=[['overview','Overview'],...(dashboard.capabilities.registry?[['registry','Vessel registry'],['scan','QR lookup']]:[]),...(dashboard.capabilities.accounts?[['accounts','Accounts']]:[]),...(dashboard.capabilities.audit?[['audit','Audit history']]:[])];if(!tabs.some(t=>t[0]===view))view='overview';for(const [id,label] of tabs){const b=node('button',label,'secondary');b.type='button';if(view===id)b.setAttribute('aria-current','page');b.addEventListener('click',()=>selectView(id));n.append(b);}}
async function render(){stopCamera();const g=++generation,current=view,out=$('content');out.replaceChildren();if(!dashboard)return;
 if(current==='overview'){
  const metrics=node('div',undefined,'metrics');for(const [key,value] of Object.entries(dashboard.metrics)){const c=node('div',undefined,'metric card');c.append(node('small',metricNames[key]??key),node('strong',value));metrics.append(c);}out.append(metrics);
  const stations=card('Authorized station directory');stations.append(table(['Code','Station','Status'],dashboard.stations.map(s=>[s.code,s.name,s.active?'Active':'Inactive'])));out.append(stations);
  const pending=card('Development status');pending.append(node('p','Connected: authentication, scoped dashboard, vessel registry, QR identification, account directory and audit history where authorized.', 'pending'),node('p','Inspection and document write workflows, notifications, offline sync, photo uploads, reports, watchlists, communication and actual backup/recovery remain pending. Linked summaries display only recorded information.','pending'));out.append(pending);return;
 }
 if(current==='registry'){await registry(out);return;}
 if(current==='scan'){scanner(out);return;}
 const c=card(current==='accounts'?'Authorized accounts':'Regional audit history');out.append(c);const rows=await api(current==='accounts'?'users':'audit');if(g!==generation||view!==current)return;
 c.append(current==='accounts'?table(['Username','Name','Role','Status'],rows.map(r=>[r.username,r.full_name,roleNames[r.role]??r.role,r.active?'Active':'Inactive'])):table(['Time','Action','Resource','Outcome'],rows.map(r=>[new Date(r.recorded_at).toLocaleString(),r.action,r.resource_type,r.outcome])));c.append(node('small','First 50 authorized records.'));
}

function button(label,fn,secondary=true){const b=node('button',label,secondary?'secondary':undefined);b.type='button';b.addEventListener('click',fn);return b;}
function field(label,name,value='',max=180){const l=node('label',label),i=node('input');i.name=name;i.value=value;i.maxLength=max;l.append(i);return {label:l,input:i};}
function choice(label,name,options,value=''){const l=node('label',label),s=node('select');s.name=name;for(const [key,text] of options){const opt=node('option',text);opt.value=key;s.append(opt);}s.value=value;l.append(s);return {label:l,input:s};}
function titleRow(c,label,fn){const row=node('div',undefined,'actions');row.append(button(label,fn));c.append(row);}
function stationName(id){return dashboard?.stations.find(s=>s.id===id)?.name??'Recorded station';}
function openProfile(id){stopCamera();view='registry';profileId=id;nav();render().catch(handle);}
function registryBack(){profileId=null;render().catch(handle);}
async function registry(out){
 if(profileId){await profile(out,profileId);return;}
 const c=card('Vessel registry'),form=node('form',undefined,'registryFilters'),results=node('div');
 if(dashboard.capabilities.writeRegistry)titleRow(c,'Register vessel',()=>editVessel(out,null));
 const q=field('Search name, registration or internal ID','q',filters.q);
 const status=choice('Profile status','status',[['','All statuses'],['active','Active'],['inactive','Inactive']],filters.status);
 const type=field('Vessel type (exact)','type',filters.type,100);
 const station=choice('Station','stationId',[['','All authorized stations'],...dashboard.stations.map(s=>[s.id,s.name])],filters.stationId);
 const search=node('button','Search');form.append(q.label,status.label,type.label,station.label,search);c.append(form,results);out.append(c);
 const query=async()=>{
  const g=++generation;search.disabled=true;
  try{
   const params=new URLSearchParams({format:'page',page:String(filters.page)});
   for(const k of ['q','status','type','stationId'])if(filters[k])params.set(k,filters[k]);
   const d=await api('vessels?'+params);if(g!==generation||view!=='registry'||profileId)return;
   const wrap=table(['Vessel','Registration','Type','Station','Status','Action'],d.rows.map(r=>[r.name,r.official_registration,r.vessel_type,stationName(r.station_id),r.profile_status,'']));
   [...wrap.querySelectorAll('tbody tr')].forEach((tr,i)=>{if(d.rows[i])tr.lastElementChild.append(button('Open profile',()=>openProfile(d.rows[i].id)));});
   results.replaceChildren(wrap);
   const pages=Math.max(1,Math.ceil(d.total/d.pageSize));const p=node('div',undefined,'actions pagination');
   const prev=button('Previous',()=>{filters.page--;query();});prev.disabled=d.page<=1;
   const next=button('Next',()=>{filters.page++;query();});next.disabled=d.page>=pages;
   p.append(prev,node('span',d.total+' records · Page '+d.page+' of '+pages),next);results.append(p);
  }catch(e){if(g===generation)handle(e);}finally{search.disabled=false;}
 };
 form.addEventListener('submit',e=>{e.preventDefault();filters={...Object.fromEntries(new FormData(form)),page:1};query();});
 await query();
}
async function profile(out,id){
 const g=++generation;
 const v=await api('vessels/'+id);if(g!==generation||profileId!==id)return;
 const c=card(v.name);titleRow(c,'Back to registry',registryBack);
 const fields=[['VesselWatch ID',v.internal_id],['Official registration',v.official_registration],['Owner/operator',v.owner_operator],['Vessel type',v.vessel_type],['Assigned station',stationName(v.station_id)],['Profile status',v.profile_status],['Revision',v.version]];
 const details=node('dl',undefined,'profileGrid');for(const [k,val] of fields){const div=node('div');div.append(node('dt',k),node('dd',val));details.append(div);}c.append(details);
 if(dashboard.capabilities.writeRegistry)titleRow(c,'Edit profile / status',()=>editVessel(out,v));
 out.replaceChildren(c);
 const linked=await api('vessels/'+id+'/linked');if(g!==generation)return;
 const l=card('Linked records');l.append(node('p','Document date status is not legal validity. Clearance status is recorded simulation only.','pending'));
 l.append(node('h3','Document records'),table(['Type','Number','Expiry','Date status','Verification'],linked.documents.map(d=>[d.type,d.number,d.expiry_date,d.date_status,d.verification])));
 l.append(node('h3','Inspection history'),table(['Date','Station','Workflow','Recorded demo clearance'],linked.inspections.map(i=>[new Date(i.inspected_at).toLocaleString(),stationName(i.station_id),i.workflow_state,i.clearance_status??'Not recorded'])),node('small','Up to 50 authorized records per category. Empty results are not evidence of clearance or compliance.'));out.append(l);
 const qr=card('Vessel QR identifier');out.append(qr);await renderQr(qr,v,g);if(g!==generation)return;
 const h=card('Profile modification history');out.append(h);
 const history=async(page=1)=>{const data=await api('vessels/'+id+'/history?page='+page);if(g!==generation)return;
  const rows=data.rows.map(r=>[r.version,new Date(r.recorded_at).toLocaleString(),r.snapshot.name,r.snapshot.official_registration,r.snapshot.owner_operator,r.snapshot.vessel_type,r.snapshot.profile_status,r.changed_by]);
  h.replaceChildren(node('h2','Profile modification history'),table(['Version','Recorded','Name','Registration','Owner/operator','Type','Status','Actor ID'],rows));
  const p=node('div',undefined,'actions pagination'),prev=button('Previous',()=>history(page-1).catch(handle)),next=button('Next',()=>history(page+1).catch(handle));
  prev.disabled=page<=1;next.disabled=page*data.pageSize>=data.total;p.append(prev,node('span','Page '+page+' · '+data.total+' revisions'),next);h.append(p);
 };await history();
}
async function renderQr(c,v,g){
 const {qr}=await api('vessels/'+v.id+'/qr');if(g!==generation)return;
 c.replaceChildren(node('h2','Vessel QR identifier'),node('p','Opaque lookup code only. Authentication and station permissions are required.','pending'));
 if(qr){
  const label=node('div',undefined,'qrLabel'),image=node('img');image.src=qr.image;image.alt='QR code for vessel '+v.name;image.width=240;image.height=240;
  label.append(node('strong',v.name),node('small',v.internal_id),image,node('small',qr.payload));c.append(label);
  const actions=node('div',undefined,'actions'),download=node('a','Save QR image','download');download.href=qr.image;download.download='VesselWatch-'+v.id+'.png';
  actions.append(button('Print QR label',()=>{document.body.classList.add('printing');window.print();document.body.classList.remove('printing');}),download);c.append(actions);
 }else c.append(node('p','No active QR identifier.'));
 if(dashboard.capabilities.writeRegistry&&v.profile_status==='active'){
  const form=node('form',undefined,'qrActions'),reason=field('Reason for issue / revocation','reason','',240);reason.input.required=true;form.append(reason.label);
  const actions=node('div',undefined,'actions'),replace=button(qr?'Replace QR':'Issue QR',()=>mutate('replace'),false),revoke=button('Revoke QR',()=>mutate('revoke'));
  revoke.disabled=!qr;actions.append(replace,revoke);form.append(actions);c.append(form);
  const mutate=async action=>{if(!form.reportValidity())return;replace.disabled=true;revoke.disabled=true;
   try{await api('vessels/'+v.id+'/qr/'+action,{method:'POST',data:{reason:reason.input.value}});if(g===generation){message('QR '+(action==='replace'?'issued':'revoked')+'.');await renderQr(c,v,g);}}catch(e){if(g===generation)handle(e);}finally{replace.disabled=false;revoke.disabled=!qr;}
  };
 }
}
function editVessel(out,v){
 stopCamera();const g=++generation,c=card(v?'Edit vessel profile':'Register vessel');titleRow(c,'Cancel',()=>{if(v)openProfile(v.id);else registryBack();});
 const form=node('form'),defs=[['Vessel name','name',v?.name??'',180],['Official registration','officialRegistration',v?.official_registration??'',100],['Owner/operator','ownerOperator',v?.owner_operator??'',180],['Vessel type','vesselType',v?.vessel_type??'',100]];
 for(const [label,name,value,max] of defs){const f=field(label,name,value,max);f.input.required=true;form.append(f.label);}
 if(v)form.append(choice('Profile status','profileStatus',[['active','Active'],['inactive','Inactive (revokes QR)']],v.profile_status).label);
 const save=node('button',v?'Save changes':'Register vessel');form.append(node('p','Responsible station is determined by your authorized account. Duplicate names or registration numbers require review.','pending'),save);c.append(form);out.replaceChildren(c);
 form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{const data=Object.fromEntries(new FormData(form));if(v)data.version=v.version;const result=await api('vessels'+(v?'/'+v.id:''),{method:v?'PUT':'POST',data});if(g===generation){message(v?'Profile updated.':'Vessel registered with a unique QR.');openProfile(result.id);}}catch(err){if(g===generation)handle(err);}finally{save.disabled=false;}});
}
function scanner(out){
 const g=++generation,c=card('QR lookup'),form=node('form'),f=field('Enter VesselWatch QR payload','payload','',40);f.input.required=true;const submit=node('button','Look up QR');form.append(f.label,submit);c.append(node('p','Scan an approved QR, choose a QR image, or enter its VW1: identifier. No image is sent to the server. Use Vessel registry for name or ID lookup.','pending'),form);
 const result=node('p',undefined,'pending');c.append(result);out.append(c);
 let busy=false;
 const lookup=async payload=>{if(g!==generation||busy)return;busy=true;stopCamera();submit.disabled=true;try{const d=await api('qr/resolve',{method:'POST',data:{payload:payload.trim()}});if(g===generation)openProfile(d.vessel.id);}catch(e){if(g===generation)handle(e);}finally{busy=false;submit.disabled=false;}};
 form.addEventListener('submit',e=>{e.preventDefault();lookup(f.input.value);});
 const video=node('video');video.autoplay=true;video.muted=true;video.playsInline=true;video.hidden=true;video.className='scannerVideo';c.append(video);
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const decode=(source,w,h)=>{if(!w||!h||!ctx||typeof window.jsQR!=='function')return null;const scale=Math.min(1,900/Math.max(w,h));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));ctx.drawImage(source,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);return window.jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'})?.data??null;};
 const controls=node('div',undefined,'actions'),start=button('Start camera',async()=>{if(camera)return;start.disabled=true;try{
  if(!navigator.mediaDevices?.getUserMedia||!window.jsQR)throw Error('Camera scanner unavailable. Use a supported HTTPS browser, image or manual lookup.');
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  if(g!==generation){stream.getTracks().forEach(t=>t.stop());return;}
  camera=stream;video.srcObject=stream;video.hidden=false;await video.play();result.textContent='Point the camera at the QR code.';
  const tick=()=>{if(g!==generation||camera!==stream)return;try{const value=decode(video,video.videoWidth,video.videoHeight);if(value){video.hidden=true;lookup(value);return;}}catch{stopCamera();video.hidden=true;result.textContent='Unable to scan camera image.';return;}setTimeout(tick,180);};tick();
 }catch(e){stopCamera();video.hidden=true;result.textContent=e.message;}finally{start.disabled=false;}},false);
 const stop=button('Stop camera',()=>{stopCamera();video.hidden=true;result.textContent='Camera stopped.';});controls.append(start,stop);c.append(controls);
 const l=node('label','Choose a QR image (PNG or JPEG)'),file=node('input');file.type='file';file.accept='image/png,image/jpeg';l.append(file);c.append(l);
 file.addEventListener('change',async()=>{const selected=file.files[0];file.value='';if(!selected)return;stopCamera();video.hidden=true;if(selected.size>10*1024*1024||!['image/png','image/jpeg'].includes(selected.type)){result.textContent='Choose a PNG or JPEG image under 10 MiB.';return;}
  try{const image=await createImageBitmap(selected);let value;try{value=decode(image,image.width,image.height);}finally{image.close();}if(g!==generation)return;if(value)await lookup(value);else result.textContent='No readable QR found. Try another image or use manual lookup.';}catch{if(g===generation)result.textContent='Unable to read image.';}
 });
}
window.addEventListener('pagehide',stopCamera);

async function start(){const g=++generation;const current=await api('auth/me');if(g!==generation)return;user=current;if(user.must_change_password){show('password');return;}const d=await api('dashboard');if(g!==generation)return;dashboard=d;$('welcome').textContent=user.full_name||user.username;$('scope').textContent=(roleNames[user.role]??user.role)+' · '+(d.scope==='regional'?'Regional scope':d.stations[0]?.name??'Assigned station');show('workspace');nav();await render();}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,b=form.querySelector('button');b.disabled=true;message();try{const data=Object.fromEntries(new FormData(form));await api('browser/login',{method:'POST',data});form.reset();await start();}catch(err){handle(err);}finally{b.disabled=false;}});
$('passwordForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,b=form.querySelector('button');b.disabled=true;try{await api('auth/change-password',{method:'POST',data:Object.fromEntries(new FormData(form))});reset();message('Password updated. Please sign in again.');}catch(err){handle(err);}finally{b.disabled=false;}});
async function logout(){stopCamera();try{await api('auth/logout',{method:'POST'});reset();message('Signed out.');}catch(e){if(e.status===401){reset();message('Session ended.');}else handle(e);}}
$('logout').addEventListener('click',logout);$('passwordLogout').addEventListener('click',logout);
$('refresh').addEventListener('click',()=>{message();start().catch(handle);});
window.addEventListener('pageshow',e=>{if(e.persisted){reset();start().catch(err=>{if(err.status!==401)handle(err);});}});
start().catch(e=>{if(e.status!==401)handle(e);else reset();});
