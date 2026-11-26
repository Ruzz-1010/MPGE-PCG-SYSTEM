export function inspectionWorkspace({out,api,user,dashboard,node,card,table,button,field,choice,stationName,handle,message,isCurrent}){
 let closed=false,epoch=0,dirty=false,pending=null,timer=null,stale=false;
 const alive=e=>!closed&&isCurrent()&&(e===undefined||e===epoch);
 const stop=()=>{clearTimeout(timer);timer=null;};
 const dispose=()=>{closed=true;epoch++;stop();};
 const hasUnsaved=()=>dirty||Boolean(pending);
 const canLeave=()=>!hasUnsaved()||window.confirm('Inspection changes are not confirmed saved. Leave this screen?');
 const report=e=>{if(alive())handle(e);};
 const demo='THESIS SIMULATION ONLY — fictional checklist, attestation and clearance. Not an official PCG record or permission to depart.';
 const states=[['','All states'],['draft','Draft'],['submitted','Submitted'],['returned','Returned for correction'],['reviewed','Reviewed']];
 const answers=[['not_checked','Not checked'],['pass','Pass'],['fail','Fail'],['not_applicable','Not applicable']];
 const pDate=v=>v?new Date(v).toLocaleString():'—';
 function heading(title){const c=card(title);c.append(node('p',demo,'inspectionNotice'));out.replaceChildren(c);return c;}
 function textarea(label,value,max){const l=node('label',label),a=node('textarea');a.value=value??'';a.maxLength=max;l.append(a);return {l,a};}
 function checkbox(label){const l=node('label',undefined,'check'),i=node('input');i.type='checkbox';l.append(i,node('span',label));return {l,i};}
 async function list(page=1,state=''){
  if(!alive())return;stop();dirty=false;stale=false;const e=++epoch,c=heading('Vessel inspections');
  const bar=node('div',undefined,'inspectionToolbar'),sel=choice('Workflow state','state',states,state);
  bar.append(sel.label,button('Apply filter',()=>list(1,sel.input.value).catch(report)));
  if(dashboard.capabilities.createInspection)bar.append(button('New inspection',()=>newInspection().catch(report),false));
  if(dashboard.capabilities.setupChecklist)bar.append(button('Initialize fictional checklist',async()=>{try{await api('inspection-templates/demo',{method:'POST',data:{}});if(alive(e))message('Demo checklist available.');}catch(err){if(alive(e))report(err);}}));
  c.append(bar);
  const data=await api('inspections?page='+page+(state?'&state='+encodeURIComponent(state):''));if(!alive(e))return;
  const t=table(['Vessel','Station','Inspection time','Workflow','Revision','Action'],data.rows.map(r=>[r.vessel_name,stationName(r.station_id),pDate(r.inspected_at),r.workflow_state,r.version,'']));
  [...t.querySelectorAll('tbody tr')].forEach((tr,i)=>{if(data.rows[i])tr.lastElementChild.append(button('Open inspection',()=>detail(data.rows[i].id).catch(report)));});c.append(t);
  const row=node('div',undefined,'actions pagination'),prev=button('Previous',()=>list(page-1,state).catch(report)),next=button('Next',()=>list(page+1,state).catch(report));prev.disabled=page<=1;next.disabled=page*data.pageSize>=data.total;row.append(prev,node('span',data.total+' records · Page '+page),next);c.append(row);
 }
 async function newInspection(){
  if(!alive())return;const e=++epoch,c=heading('New inspection');c.append(button('Back',()=>list().catch(report)));
  const templates=await api('inspection-templates');if(!alive(e))return;
  if(!templates.length){c.append(node('p','No active fictional checklist. Ask an authorized Station or Regional Administrator to initialize one.'));return;}
  const search=field('Search active vessel','q','',180),bar=node('div',undefined,'inspectionToolbar'),results=node('div');
  bar.append(search.label,button('Find vessels',()=>find(1).catch(report)));c.append(bar,results);
  const find=async(page)=>{
   const d=await api('vessels?format=page&status=active&page='+page+'&q='+encodeURIComponent(search.input.value));if(!alive(e))return;
   results.replaceChildren();const f=node('form'),v=choice('Vessel','vesselId',d.rows.map(r=>[r.id,r.name+' · '+r.official_registration])),t=choice('Checklist','templateId',templates.map(x=>[x.id,x.name+' v'+x.version]));
   if(!d.rows.length){results.append(node('p','No active authorized vessel found.'));return;}
   const submit=node('button','Create inspection draft');f.append(v.label,t.label,submit);results.append(f);
   f.addEventListener('submit',async evt=>{evt.preventDefault();submit.disabled=true;try{const r=await api('inspections',{method:'POST',data:Object.fromEntries(new FormData(f))});if(alive(e)){message('Draft created.');await detail(r.id);}}catch(err){if(alive(e))report(err);}finally{submit.disabled=false;}});
   const row=node('div',undefined,'actions pagination'),prev=button('Previous',()=>find(page-1).catch(report)),next=button('Next',()=>find(page+1).catch(report));prev.disabled=page===1;next.disabled=page*d.pageSize>=d.total;row.append(prev,node('span','Page '+page),next);results.append(row);
  };await find(1);
 }
 async function detail(id){
  if(!alive())return;stop();dirty=false;stale=false;const e=++epoch,c=heading('Inspection detail');
  c.append(button('Back to inspections',()=>{if(canLeave())list().catch(report);}));
  let record=await api('inspections/'+id);if(!alive(e))return;
  c.append(node('h3',record.vessel_name));
  const meta=node('div',undefined,'inspectionMeta');for(const text of [stationName(record.station_id),pDate(record.inspected_at),'Inspector ID: '+record.inspector_id,'Workflow: '+record.workflow_state,'Revision: '+record.version])meta.append(node('span',text));c.append(meta);
  if(record.change_reason)c.append(node('p','Review/correction note: '+record.change_reason));
  const currentAnswers=new Map(record.answers.map(a=>[a.item_id,a])),edit=record.capabilities.edit;
  const form=node('form'),fields=[];
  const saveState=node('p','Server-confirmed revision '+record.version+' · '+pDate(record.revision_at),'saveState');saveState.setAttribute('role','status');
  c.append(saveState);
  for(const item of record.items){
   const old=currentAnswers.get(item.id),box=node('fieldset',undefined,'checklistItem'),legend=node('legend',item.ordinal+'. '+item.prompt+(item.required?' *':''));
   const a=choice('Response','answer',answers,old?.answer??'not_checked'),remarks=textarea('Remarks',old?.remarks,500);
   a.input.disabled=!edit;remarks.a.disabled=!edit;box.append(legend,a.label,remarks.l);form.append(box);fields.push({id:item.id,a:a.input,r:remarks.a});
  }
  const findings=textarea('Findings and observations',record.findings,2000);findings.a.disabled=!edit;form.append(findings.l);
  const values=()=>({version:record.version,findings:findings.a.value,answers:fields.map(f=>({itemId:f.id,answer:f.a.value,remarks:f.r.value}))});
  const schedule=()=>{stop();if(!alive(e)||stale)return;timer=setTimeout(()=>{save().catch(()=>{});},1000);};
  async function save(){
   stop();if(!alive(e)||!edit||stale)return false;
   if(pending){const saved=await pending;if(!saved||!alive(e)||stale)return false;if(dirty)return save();return true;}
   if(!dirty)return true;
   const data=values();dirty=false;saveState.textContent='Saving to server…';
   const job=(async()=>{try{
    const r=await api('inspections/'+id+'/draft',{method:'PUT',data});if(!alive(e))return false;record=r;meta.lastElementChild.textContent='Revision: '+r.version;
    saveState.textContent=dirty?'Unsaved changes — saving shortly':'Saved to server · Revision '+r.version+' · '+pDate(r.revision_at);
    if(dirty)schedule();return true;
   }catch(err){
    if(alive(e)){dirty=true;stale=err.status===409;saveState.textContent=stale?'Conflict: server version changed. Your entries are unsaved; reload only after reviewing/discarding them.':'Not saved — connection or validation error. Use Save draft to retry.';report(err);}return false;
   }})();pending=job;try{return await job;}finally{if(pending===job)pending=null;}
  }
  if(edit){
   form.addEventListener('input',ev=>{if(ev.target.type==='checkbox')return;dirty=true;saveState.textContent='Unsaved changes';schedule();});
   form.addEventListener('submit',e=>e.preventDefault());
   const controls=node('div',undefined,'actions');const saveBtn=button('Save draft',()=>save().catch(report),false);
   const ack=checkbox('I acknowledge this fictional submission; this is not a legal digital signature.');
   const submit=button('Submit for review',async()=>{
    if(!ack.i.checked){message('Confirm the simulated attestation before submitting.',true);return;}
    submit.disabled=true;stop();try{
     if(!await save()||dirty||stale||!alive(e))return;
     // Disable editing during transition; avoid silently losing newer input.
     for(const f of fields){f.a.disabled=true;f.r.disabled=true;}findings.a.disabled=true;saveBtn.disabled=true;
     await api('inspections/'+id+'/transition',{method:'POST',data:{version:record.version,action:'submit',attest:true}});
     if(alive(e)){message('Inspection submitted for review.');await detail(id);}
    }catch(err){if(alive(e)){report(err);for(const f of fields){f.a.disabled=false;f.r.disabled=false;}findings.a.disabled=false;saveBtn.disabled=false;}}finally{submit.disabled=false;}
   },false);
   form.append(ack.l);controls.append(saveBtn,submit,button('Reload saved record',()=>{if(canLeave())detail(id).catch(report);}));form.append(controls);
  }
  c.append(form);
  if(record.attestation)c.append(node('h3','Simulated attestation'),node('p',record.attestation.statement),node('p','Attested revision '+record.attestation.attested_version+' · '+pDate(record.attestation.created_at)));
  if(record.clearance)c.append(node('h3','Recorded demo clearance'),node('p',record.clearance.status.toUpperCase()+' (SIMULATED) · '+pDate(record.clearance.created_at)),node('p',record.clearance.reason));
  else c.append(node('p','Departure clearance: not recorded. Internal review is not departure authorization.','pending'));
  if(record.capabilities.review||record.capabilities.reopen){
   const section=node('section',undefined,'reviewBox'),reason=textarea('Review or correction reason','',1000);
   section.append(node('h3',record.capabilities.review?'Review submitted inspection':'Auditable follow-up correction'),reason.l);
   const actions=node('div',undefined,'actions');let working=false;
   const transition=async action=>{if(working)return;working=true;for(const b of actions.children)b.disabled=true;
    try{await api('inspections/'+id+'/transition',{method:'POST',data:{version:record.version,action,reason:reason.a.value}});if(alive(e)){message('Workflow updated.');await detail(id);}}catch(err){if(alive(e))report(err);}finally{working=false;for(const b of actions.children)b.disabled=false;}
   };
   if(record.capabilities.review)actions.append(button('Mark reviewed',()=>transition('review'),false),button('Return for correction',()=>transition('return')));
   if(record.capabilities.reopen)actions.append(button('Reopen for correction',()=>transition('reopen')));
   section.append(actions);c.append(section);
  }
  if(record.capabilities.demoClearance){
   const section=node('section',undefined,'reviewBox'),status=choice('Simulated decision','status',[['','Choose status'],['cleared','Cleared (DEMO)'],['hold','Hold (DEMO)'],['withdrawn','Withdraw demo decision']]),reason=textarea('Decision reason','',1000),ack=checkbox('I confirm this is fictional and has no legal effect.');
   const save=button('Record simulated decision',async()=>{save.disabled=true;try{
    await api('inspections/'+id+'/demo-clearance',{method:'POST',data:{version:record.version,status:status.input.value,reason:reason.a.value,acknowledgeSimulation:ack.i.checked,expectedEventId:record.clearance?.id??null}});
    if(alive(e)){message('Simulated decision recorded.');await detail(id);}
   }catch(err){if(alive(e))report(err);}finally{save.disabled=false;}},false);
   section.append(node('h3','Demo departure clearance'),node('p','No official authorization. No automatic Hold rule.','inspectionNotice'),status.label,reason.l,ack.l,save);c.append(section);
  }
  const history=card('Version history');history.classList.add('inspectionHistory');out.append(history);
  async function loadHistory(page=1){
   const h=await api('inspections/'+id+'/history?page='+page);if(!alive(e))return;history.replaceChildren(node('h2','Version history'),button('Refresh history',()=>loadHistory(1).catch(report)));
   const labels=new Map(record.items.map(i=>[i.id,i.prompt]));
   for(const r of h.rows){const d=node('details'),sum=node('summary','Revision '+r.version+' · '+r.workflow_state+' · '+pDate(r.created_at));d.append(sum,node('p','Actor ID: '+r.changed_by),node('p','Reason: '+(r.change_reason??'—')),node('pre',r.findings||'No findings recorded.'),table(['Item','Response','Remarks'],r.answers.map(a=>[labels.get(a.item_id)??a.item_id,a.answer,a.remarks])),table(['Attestation','Actor','Time'],r.attestations.map(a=>[a.statement,a.attested_by,pDate(a.created_at)])),table(['Simulated decision','Reason','Actor','Time'],r.clearanceEvents.map(a=>[a.status+' (DEMO)',a.reason,a.decided_by,pDate(a.created_at)])));history.append(d);}
   const row=node('div',undefined,'actions pagination'),prev=button('Previous',()=>loadHistory(page-1).catch(report)),next=button('Next',()=>loadHistory(page+1).catch(report));prev.disabled=page===1;next.disabled=page*h.pageSize>=h.total;row.append(prev,node('span','Page '+page+' · '+h.total+' revisions'),next);history.append(row);
  }await loadHistory();
 }
 return {start:()=>list(),dispose,canLeave,hasUnsaved};
}
