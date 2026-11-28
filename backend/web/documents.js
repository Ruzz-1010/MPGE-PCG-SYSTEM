import {uploadFile,fileControls} from './file-utils.js';
export function documentWorkspace({out,api,dashboard,node,card,table,button,field,choice,stationName,handle,message,isCurrent}){
 let closed=false,epoch=0,uploading=false,dirty=false;
 const alive=e=>!closed&&isCurrent()&&(e===undefined||e===epoch);
 const report=e=>{if(alive())handle(e);};
 const dispose=()=>{closed=true;epoch++;};
 const hasUnsaved=()=>uploading||dirty;
 const canLeave=()=>!hasUnsaved()||window.confirm('Document changes or upload may not be confirmed. Leave this view?');
 const validity=[['','All date statuses'],['expired','Expired'],['due_today','Due today'],['expiring_soon','Expiring within 30 days'],['valid_by_date','Valid by recorded date'],['unknown','Unknown date'],['not_applicable','Not applicable']];
 const label=s=>validity.find(x=>x[0]===s)?.[1]??s;
 const stamp=v=>v?new Date(v).toLocaleString():'—';
 const banner='Fictional records only. Date validity and document verification are separate. An expired required record is a review warning, not an automatic Hold or official clearance.';
 function heading(t){const c=card(t);c.append(node('p',banner,'inspectionNotice'));out.replaceChildren(c);return c;}
 function status(s){const el=node('span',label(s),'validityStatus');el.dataset.status=s;return el;}
 function fileBox(file,e){return fileControls(file,{node,button,handle:report,alive:()=>alive(e)});}
 async function list(page=1,search='',filter=''){
  if(!alive())return;dirty=false;const e=++epoch,c=heading('Document library');
  const summary=await api('documents/expiry-summary');if(!alive(e))return;
  const metrics=node('div',undefined,'metrics');
  for(const [k,label] of [['total','Authorized records'],['expired_required','Expired required'],['due_30','Due in 30 days'],['due_7','Due in 7 days'],['due_1','Due tomorrow'],['unknown','Unknown dates']]){
   const box=node('div',undefined,'card metric');box.append(node('small',label),node('strong',summary.counts[k]));metrics.append(box);
  }c.append(metrics,node('small','Daily check: '+(summary.lastCheck?.check_date??'Not recorded')+' · Asia/Manila · Live date status on every lookup'));
  const q=field('Search vessel name or registration','q',search,180),s=choice('Date status','status',validity,filter),form=node('form',undefined,'inspectionToolbar'),apply=node('button','Search');
  form.append(q.label,s.label,apply);form.addEventListener('submit',ev=>{ev.preventDefault();list(1,q.input.value,s.input.value).catch(report);});c.append(form);
  if(dashboard.capabilities.writeDocuments)c.append(button('Register document',()=>selectVessel().catch(report),false));
  const params=new URLSearchParams({page:String(page),q:search});if(filter)params.set('status',filter);
  const data=await api('documents?'+params);if(!alive(e))return;
  const wrap=table(['Vessel','Type','Number','Expiry','Date status','Verification','Action'],data.rows.map(r=>[r.vessel_name,r.type,r.number,r.expiry_date,'',r.verification,'']));
  [...wrap.querySelectorAll('tbody tr')].forEach((tr,i)=>{const r=data.rows[i];if(!r)return;tr.children[4].append(status(r.date_status));if(r.review_warning)tr.children[4].append(node('small',' Required: review warning'));tr.lastElementChild.append(button('Open',()=>detail(r.id).catch(report)));});
  c.append(wrap);
  const row=node('div',undefined,'actions pagination'),prev=button('Previous',()=>list(page-1,search,filter).catch(report)),next=button('Next',()=>list(page+1,search,filter).catch(report));prev.disabled=page<=1;next.disabled=page*data.pageSize>=data.total;row.append(prev,node('span',data.total+' records · Page '+page),next);c.append(row);
 }
 async function selectVessel(){
  const e=++epoch,c=heading('Register document');c.append(button('Back',()=>list().catch(report)));
  const q=field('Find vessel','q','',180),f=node('form',undefined,'inspectionToolbar'),submit=node('button','Find'),results=node('div');f.append(q.label,submit);c.append(f,results);
  async function find(page=1){
   const d=await api('vessels?format=page&page='+page+'&q='+encodeURIComponent(q.input.value));if(!alive(e))return;
   results.replaceChildren();
   for(const v of d.rows){const row=node('div',undefined,'actions vesselChoice');row.append(node('span',v.name+' · '+v.official_registration),button('Select',()=>edit(null,v).catch(report)));results.append(row);}
   if(!d.rows.length)results.append(node('p','No authorized vessels found.'));
   const row=node('div',undefined,'actions pagination'),prev=button('Previous',()=>find(page-1).catch(report)),next=button('Next',()=>find(page+1).catch(report));prev.disabled=page<=1;next.disabled=page*d.pageSize>=d.total;row.append(prev,node('span','Page '+page),next);results.append(row);
  }
  f.addEventListener('submit',ev=>{ev.preventDefault();find().catch(report);});await find();
 }
 async function edit(old,v){
  const e=++epoch,c=heading(old?'Renew document':'Register document');dirty=false;c.append(button('Cancel',()=>{if(canLeave()){dirty=false;(old?detail(old.id):list()).catch(report);}}));
  c.append(node('h3',old?.vessel_name??v.name));
  const types=old?[]:await api('document-types');if(!alive(e))return;
  const form=node('form'),controls=[];
  let type,required;
  if(!old){
   type=choice('Fictional document type','typeId',types.map(t=>[t.id,t.name]));form.append(type.label);
   required=node('input');required.type='checkbox';const l=node('label',undefined,'check');l.append(required,node('span','Required for this fictional record'));form.append(l);
  }else form.append(node('p','Category: '+old.type+' · Renewal of revision '+old.version));
  const num=field('Document number','number',old?.number??'',120),issuer=field('Issuing authority','issuer',old?.issuer??'',180);num.input.required=issuer.input.required=true;
  const issue=field('Issue date (if recorded)','issueDate',old?.issue_date??'');issue.input.type='date';
  const kind=choice('Expiry information','expiryKind',[['dated','Date recorded'],['unknown','Unknown date'],['not_applicable','Not applicable']],old?.expiry_kind??'dated');
  const expiry=field('Expiry date','expiryDate',old?.expiry_date??'');expiry.input.type='date';
  function toggle(){expiry.input.disabled=kind.input.value!=='dated';expiry.input.required=kind.input.value==='dated';if(expiry.input.disabled)expiry.input.value='';}
  kind.input.addEventListener('change',toggle);toggle();
  const file=node('input');file.type='file';file.accept='application/pdf,image/png,image/jpeg';file.required=true;const fl=node('label','Scanned PDF, PNG or JPEG (max 20 MiB)');fl.append(file);
  const state=node('p','Choose a fictional scan.','saveState'),save=node('button',old?'Upload renewed version':'Register and upload');state.setAttribute('role','status');
  form.append(num.label,issuer.label,issue.label,kind.label,expiry.label,fl,state,save);c.append(form);
  form.addEventListener('input',()=>{dirty=true;});
  form.addEventListener('submit',async ev=>{ev.preventDefault();if(uploading)return;
   const f=file.files[0];if(!f||f.size>20*1024*1024){state.textContent='Choose a permitted file up to 20 MiB.';return;}
   const metadata={number:num.input.value,issuer:issuer.input.value,issueDate:issue.input.value||null,expiryDate:expiry.input.value||null,expiryKind:kind.input.value};
   if(old)metadata.version=old.version;else Object.assign(metadata,{vesselId:v.id,typeId:type.input.value,required:required.checked});
   uploading=true;save.disabled=true;state.textContent='Uploading…';
   try{const result=await uploadFile(old?'documents/'+old.id+'/renew':'documents',f,metadata,p=>{if(alive(e))state.textContent=p===100?'Bytes sent; validating and saving…':'Uploading '+(p??'')+'%';});if(alive(e)){dirty=false;message('Document saved and file linked.');await detail(result.id);}}
   catch(err){if(alive(e)){state.textContent='Not confirmed. Check the record before retrying. '+err.message;report(err);}}
   finally{uploading=false;save.disabled=false;}
  });
 }
 async function detail(id){
  const e=++epoch,c=heading('Document detail');dirty=false;c.append(button('Back to documents',()=>list().catch(report)));
  const d=await api('documents/'+id);if(!alive(e))return;
  c.append(node('h3',d.vessel_name+' · '+d.type),table(['Field','Value'],[['Number',d.number],['Issuing authority',d.issuer],['Issue date',d.issue_date],['Expiry date',d.expiry_date],['Version',d.version],['Station',stationName(d.station_id)],['Required',d.required?'Yes':'No'],['Verification',d.verification],['Review reason',d.review_reason]]),status(d.date_status));
  if(d.review_warning)c.append(node('p','Expired required document — authorized review needed. No automatic Hold.','inspectionNotice'));
  c.append(node('h3','Current file'),fileBox(d.file,e));
  if(d.capabilities.renew)c.append(button('Renew with new scan',()=>edit(d,null).catch(report),false));
  if(d.capabilities.review){
   const f=node('form'),sel=choice('Verification result','status',[['verified','Verified'],['rejected','Rejected'],['needs_review','Needs review']],d.verification),reason=field('Review reason','reason','',1000),save=node('button','Record verification');
   f.append(sel.label,reason.label,save);c.append(node('h3','Record review'),f);
   f.addEventListener('submit',async ev=>{ev.preventDefault();save.disabled=true;try{await api('documents/'+id+'/review',{method:'POST',data:{version:d.version,status:sel.input.value,reason:reason.input.value,expectedReviewId:d.review_id??null}});if(alive(e)){message('Verification recorded.');await detail(id);}}catch(err){if(alive(e))report(err);}finally{save.disabled=false;}});
  }
  const h=card('Version and verification history');out.append(h);
  const history=async(page=1)=>{const data=await api('documents/'+id+'/history?page='+page);if(!alive(e))return;h.replaceChildren(node('h2','Version and verification history'));
   for(const v of data.rows){const box=node('details',undefined,'documentRevision');box.append(node('summary','Revision '+v.version+' · '+stamp(v.created_at)),table(['Number','Issuer','Issue','Expiry','Recorded by'],[[v.number,v.issuer,v.issue_date,v.expiry_date,v.recorded_by]]),fileBox(v.file,e),table(['Verification','Reason','Reviewer','Time'],v.reviews.map(r=>[r.status,r.reason,r.reviewed_by,stamp(r.created_at)])));h.append(box);}
   const row=node('div',undefined,'actions pagination'),prev=button('Previous',()=>history(page-1).catch(report)),next=button('Next',()=>history(page+1).catch(report));prev.disabled=page<=1;next.disabled=page*data.pageSize>=data.total;row.append(prev,node('span','Page '+page+' · '+data.total+' revisions'),next);h.append(row);
  };await history();
 }
 return {start:()=>list(),dispose,canLeave,hasUnsaved};
}
