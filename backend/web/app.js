const $=id=>document.getElementById(id);
const roleNames={regional:'Regional Administrator',station:'Station Administrator',inspector:'Inspector Personnel',records:'Records Officer',technical:'IT System Administrator'};
const metricNames={stations:'Authorized stations',vessels:'Registered vessels',activeVessels:'Active vessel profiles',accounts:'Authorized accounts'};
let user=null,dashboard=null,view='overview',generation=0;
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;}
function message(text='',error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function show(id){for(const p of ['login','password','workspace'])$(p).hidden=p!==id;}
function reset(){generation++;user=null;dashboard=null;view='overview';$('welcome').textContent='';$('scope').textContent='';$('nav').replaceChildren();$('content').replaceChildren();$('loginForm').reset();$('passwordForm').reset();show('login');}
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
function nav(){const n=$('nav');n.replaceChildren();const tabs=[['overview','Overview'],...(dashboard.capabilities.registry?[['registry','Vessel registry']]:[]),...(dashboard.capabilities.accounts?[['accounts','Accounts']]:[]),...(dashboard.capabilities.audit?[['audit','Audit history']]:[])];if(!tabs.some(t=>t[0]===view))view='overview';for(const [id,label] of tabs){const b=node('button',label,'secondary');b.type='button';if(view===id)b.setAttribute('aria-current','page');b.addEventListener('click',()=>{view=id;nav();render().catch(handle);});n.append(b);}}
async function render(){const g=++generation,current=view,out=$('content');out.replaceChildren();if(!dashboard)return;
 if(current==='overview'){
  const metrics=node('div',undefined,'metrics');for(const [key,value] of Object.entries(dashboard.metrics)){const c=node('div',undefined,'metric card');c.append(node('small',metricNames[key]??key),node('strong',value));metrics.append(c);}out.append(metrics);
  const stations=card('Authorized station directory');stations.append(table(['Code','Station','Status'],dashboard.stations.map(s=>[s.code,s.name,s.active?'Active':'Inactive'])));out.append(stations);
  const pending=card('Development status');pending.append(node('p','Connected: authentication, scoped dashboard, vessel registry, account directory and audit history where authorized. Registry write API exists; this workspace provides read-only views.', 'pending'),node('p','QR, inspections, document verification, notifications, offline sync, photo uploads, reports, watchlists, communication, and actual backup/recovery are not yet connected.','pending'));out.append(pending);return;
 }
 if(current==='registry'){
  const c=card('Vessel registry'),form=node('form',undefined,'search'),label=node('label','Search vessel name or registration'),input=node('input'),btn=node('button','Search'),results=node('div');input.name='q';input.maxLength=180;label.append(input);form.append(label,btn);c.append(form,results);out.append(c);
  const query=async()=>{const request=++generation;btn.disabled=true;try{const rows=await api('vessels?q='+encodeURIComponent(input.value));if(generation!==request||view!==current)return;results.replaceChildren(table(['Vessel','Registration','Type','Status'],rows.map(r=>[r.name,r.official_registration,r.vessel_type,r.profile_status])));results.append(node('small','First 50 matching records. Pagination controls are pending.'));}catch(e){if(generation===request)handle(e);}finally{btn.disabled=false;}};
  form.addEventListener('submit',e=>{e.preventDefault();query();});await query();return;
 }
 const c=card(current==='accounts'?'Authorized accounts':'Regional audit history');out.append(c);const rows=await api(current==='accounts'?'users':'audit');if(g!==generation||view!==current)return;
 c.append(current==='accounts'?table(['Username','Name','Role','Status'],rows.map(r=>[r.username,r.full_name,roleNames[r.role]??r.role,r.active?'Active':'Inactive'])):table(['Time','Action','Resource','Outcome'],rows.map(r=>[new Date(r.recorded_at).toLocaleString(),r.action,r.resource_type,r.outcome])));c.append(node('small','First 50 authorized records.'));
}
async function start(){const g=++generation;const current=await api('auth/me');if(g!==generation)return;user=current;if(user.must_change_password){show('password');return;}const d=await api('dashboard');if(g!==generation)return;dashboard=d;$('welcome').textContent=user.full_name||user.username;$('scope').textContent=(roleNames[user.role]??user.role)+' · '+(d.scope==='regional'?'Regional scope':d.stations[0]?.name??'Assigned station');show('workspace');nav();await render();}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,b=form.querySelector('button');b.disabled=true;message();try{const data=Object.fromEntries(new FormData(form));await api('browser/login',{method:'POST',data});form.reset();await start();}catch(err){handle(err);}finally{b.disabled=false;}});
$('passwordForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,b=form.querySelector('button');b.disabled=true;try{await api('auth/change-password',{method:'POST',data:Object.fromEntries(new FormData(form))});reset();message('Password updated. Please sign in again.');}catch(err){handle(err);}finally{b.disabled=false;}});
async function logout(){try{await api('auth/logout',{method:'POST'});reset();message('Signed out.');}catch(e){if(e.status===401){reset();message('Session ended.');}else handle(e);}}
$('logout').addEventListener('click',logout);$('passwordLogout').addEventListener('click',logout);
$('refresh').addEventListener('click',()=>{message();start().catch(handle);});
window.addEventListener('pageshow',e=>{if(e.persisted){reset();start().catch(err=>{if(err.status!==401)handle(err);});}});
start().catch(e=>{if(e.status!==401)handle(e);else reset();});
