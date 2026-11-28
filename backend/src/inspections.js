import {states,answers,demoTemplateName,demoItems,demoStatement,canInspect,canReview,transition} from './inspection-policy.js';
import {audit} from './db.js';
import {receiveUpload,uploadMetadata} from './documents.js';

export function mountInspections(app,{protectedRoute,fail,body,uuid,page,ok,storage,raw}){
 const first=async(c,sql,params=[]) => (await c.query(sql,params)).rows[0];
 const note=(v,max=2000,required=false)=>{
  if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v)||(required&&!v.trim()))fail(400,'Invalid or missing note');
  return v.trim();
 };
 const allowed=(u)=>{if(!canInspect(u))fail(403,'Forbidden');};
 const version=(v)=>{if(!Number.isSafeInteger(v)||v<1||v>2147483646)fail(400,'Expected record version required');return v;};
 const scopeSql="($1::boolean OR i.station_id=$2::uuid) AND ($3::text IN ('regional','station') OR iv.workflow_state='reviewed' OR ($3='inspector' AND i.inspector_id=$4::uuid))";
 const scopeArgs=u=>[u.role==='regional',u.station_id,u.role,u.id];
 const baseSql=" FROM vw.inspections i JOIN vw.vessels v ON v.id=i.vessel_id JOIN LATERAL (SELECT * FROM vw.inspection_versions WHERE inspection_id=i.id ORDER BY version DESC LIMIT 1) iv ON true";
 const projection="i.id,i.vessel_id,i.station_id,i.inspector_id,i.template_id,i.inspected_at,v.name AS vessel_name,iv.id AS revision_id,iv.version,iv.workflow_state,iv.findings,iv.change_reason,iv.created_at AS revision_at";
 const getCurrent=async(c,u,id,lock=false)=>{
  allowed(u);
  if(lock)await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,71829306))",[id]);
  const row=await first(c,"SELECT "+projection+baseSql+" WHERE "+scopeSql+" AND i.id=$5",[...scopeArgs(u),id]);
  if(!row)fail(404,'Inspection not available');return row;
 };
 const getItems=async(c,id)=>(await c.query('SELECT id,item_code,prompt,ordinal,required FROM vw.checklist_items WHERE template_id=$1 ORDER BY ordinal',[id])).rows;
 const getAnswers=async(c,id)=>(await c.query('SELECT item_id,answer,remarks FROM vw.checklist_answers WHERE inspection_version_id=$1 ORDER BY item_id',[id])).rows;
 const clearance=async(c,id)=>await first(c,'SELECT id,status,reason,is_simulated,decided_by,created_at FROM vw.clearance_events WHERE inspection_version_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[id])??null;
 const evidence=async(c,id)=>(await c.query(`SELECT f.id,f.original_name,f.media_type,f.byte_size,f.sha256,f.scan_state,f.uploaded_by,f.created_at
  FROM vw.evidence_links e JOIN vw.private_files f ON f.id=e.file_id WHERE e.inspection_version_id=$1 ORDER BY e.created_at,e.id`,[id])).rows;
 async function details(c,u,row){
  const items=await getItems(c,row.template_id),responses=await getAnswers(c,row.revision_id);
  // A review copies the submitted content, not its attestation. Show the exact signed source revision.
  const attest=await first(c,`SELECT a.statement,a.attested_by,a.is_simulated,a.created_at,iv.version AS attested_version
  FROM vw.inspection_attestations a JOIN vw.inspection_versions iv ON iv.id=a.inspection_version_id
  WHERE iv.inspection_id=$1 AND (iv.version=$2 OR ($3::text='reviewed' AND iv.version=$2-1 AND iv.workflow_state='submitted'))
  ORDER BY iv.version DESC LIMIT 1`,[row.id,row.version,row.workflow_state])??null;
  return {...row,items,answers:responses,evidence:await evidence(c,row.revision_id),attestation:attest,clearance:await clearance(c,row.revision_id),
   capabilities:{edit:u.role==='inspector'&&u.id===row.inspector_id&&['draft','returned'].includes(row.workflow_state),review:canReview(u)&&u.station_id===row.station_id&&row.workflow_state==='submitted',reopen:canReview(u)&&u.station_id===row.station_id&&row.workflow_state==='reviewed',demoClearance:canReview(u)&&u.station_id===row.station_id&&row.workflow_state==='reviewed'}};
 }
 function validateResponses(items,input,complete){
  if(!Array.isArray(input)||input.length!==items.length)fail(400,'Supply exactly one answer per checklist item');
  const known=new Map(items.map(x=>[x.id,x])),seen=new Set();
  return input.map(a=>{
   if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['itemId','answer','remarks'].includes(k)))fail(400,'Invalid checklist response');
   const id=uuid(a.itemId),item=known.get(id);
   if(!item||seen.has(id)||!answers.includes(a.answer))fail(400,'Invalid or duplicate checklist item');
   seen.add(id);
   const remarks=note(a.remarks??'',500);
   if(complete&&item.required&&a.answer==='not_checked')fail(400,'Complete all required checklist items before submission');
   if(complete&&['fail','not_applicable'].includes(a.answer)&&!remarks)fail(400,'Explain failed or not-applicable items');
   return {item_id:id,answer:a.answer,remarks};
  });
 }
 async function append(c,u,row,state,findings,responses,reason=null){
  const revision=await first(c,'INSERT INTO vw.inspection_versions(inspection_id,template_id,version,workflow_state,findings,change_reason,changed_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,version,created_at',[row.id,row.template_id,row.version+1,state,findings,reason,u.id]);
  for(const a of responses)await c.query('INSERT INTO vw.checklist_answers(inspection_version_id,template_id,item_id,answer,remarks) VALUES($1,$2,$3,$4,$5)',[revision.id,row.template_id,a.item_id,a.answer,a.remarks]);
  if(row.revision_id)await c.query('INSERT INTO vw.evidence_links(file_id,inspection_version_id,attached_by,created_at) SELECT file_id,$1,attached_by,created_at FROM vw.evidence_links WHERE inspection_version_id=$2',[revision.id,row.revision_id]);
  return {...row,revision_id:revision.id,version:revision.version,revision_at:revision.created_at,workflow_state:state,findings,change_reason:reason};
 }
 app.get('/api/inspection-templates',protectedRoute('inspection.templates',async(c,u)=>{
  allowed(u);
  const rows=(await c.query('SELECT id,name,version FROM vw.checklist_templates WHERE active AND name=$1 ORDER BY version DESC',[demoTemplateName])).rows;
  return ok(rows);
 }));
 app.post('/api/inspection-templates/demo',protectedRoute('inspection.template.demo',async(c,u,q)=>{
  if(!['regional','station'].includes(u.role))fail(403,'Forbidden');body(q,[]);
  await c.query('SELECT pg_advisory_xact_lock(71829307)');
  let t=await first(c,'SELECT id,name,version FROM vw.checklist_templates WHERE name=$1 AND version=1',[demoTemplateName]);
  if(!t){
   t=await first(c,'INSERT INTO vw.checklist_templates(name,version,active,created_by) VALUES($1,1,true,$2) RETURNING id,name,version',[demoTemplateName,u.id]);
   for(let i=0;i<demoItems.length;i++)await c.query('INSERT INTO vw.checklist_items(template_id,item_code,prompt,ordinal) VALUES($1,$2,$3,$4)',[t.id,...demoItems[i],i+1]);
   await audit(c,u,'inspection.template.demo','checklist_template',t.id);
  }
  return ok(t);
 }));
 app.get('/api/inspections',protectedRoute('inspections.list',async(c,u,q)=>{
  allowed(u);
  const state=q.query.state??null;if(state!==null&&!states.includes(state))fail(400,'Invalid workflow state');
  const vesselId=q.query.vesselId===undefined?null:uuid(q.query.vesselId),offset=page(q.query.page);
  const where=' WHERE '+scopeSql+' AND ($5::text IS NULL OR iv.workflow_state=$5) AND ($6::uuid IS NULL OR i.vessel_id=$6)';
  const params=[...scopeArgs(u),state,vesselId];
  const rows=(await c.query("SELECT "+projection+baseSql+where+' ORDER BY i.inspected_at DESC,i.id LIMIT 50 OFFSET $7',[...params,offset])).rows.map(({findings,change_reason,...r})=>r);
  const total=(await first(c,'SELECT count(*)::int AS total'+baseSql+where,params)).total;
  await audit(c,u,'inspections.list','inspection');return ok({rows,total,page:offset/50+1,pageSize:50});
 }));
 app.post('/api/inspections',protectedRoute('inspections.create',async(c,u,q)=>{
  if(u.role!=='inspector')fail(403,'Forbidden');
  const b=body(q,['vesselId','templateId']),vid=uuid(b.vesselId),tid=uuid(b.templateId);
  const v=await first(c,"SELECT id,name FROM vw.vessels WHERE id=$1 AND station_id=$2 AND profile_status='active'",[vid,u.station_id]);
  if(!v)fail(404,'Vessel not available');
  const t=await first(c,'SELECT id FROM vw.checklist_templates WHERE id=$1 AND name=$2 AND active',[tid,demoTemplateName]);
  if(!t)fail(400,'Active demo checklist required');
  const items=await getItems(c,tid);if(!items.length||items.length>50)fail(409,'Checklist unavailable');
  const row=await first(c,'INSERT INTO vw.inspections(vessel_id,station_id,inspector_id,template_id,inspected_at) VALUES($1,$2,$3,$4,clock_timestamp()) RETURNING id,vessel_id,station_id,inspector_id,template_id,inspected_at',[vid,u.station_id,u.id,tid]);
  const saved=await append(c,u,{...row,vessel_name:v.name,version:0},'draft','',items.map(x=>({item_id:x.id,answer:'not_checked',remarks:''})));
  await audit(c,u,'inspections.create','inspection',row.id,'success',{version:1});return {status:201,data:await details(c,u,saved)};
 }));
 app.get('/api/inspections/:id',protectedRoute('inspections.read',async(c,u,q)=>{
  const row=await getCurrent(c,u,uuid(q.params.id));await audit(c,u,'inspections.read','inspection',row.id);return ok(await details(c,u,row));
 }));
 app.get('/api/inspections/:id/history',protectedRoute('inspections.history',async(c,u,q)=>{
  const row=await getCurrent(c,u,uuid(q.params.id)),offset=page(q.query.page);
  // Non-owner inspectors and records officers can see reviewed snapshots only.
  const full=['station','regional'].includes(u.role)||(u.role==='inspector'&&row.inspector_id===u.id);
  const where=" WHERE inspection_id=$1 AND ($2::boolean OR workflow_state='reviewed')";
  const rows=(await c.query('SELECT id,version,workflow_state,findings,change_reason,changed_by,created_at FROM vw.inspection_versions'+where+' ORDER BY version DESC LIMIT 50 OFFSET $3',[row.id,full,offset])).rows;
  for(const r of rows){r.answers=await getAnswers(c,r.id);r.evidence=await evidence(c,r.id);r.attestations=(await c.query('SELECT statement,attested_by,is_simulated,created_at FROM vw.inspection_attestations WHERE inspection_version_id=$1',[r.id])).rows;r.clearanceEvents=(await c.query('SELECT status,reason,decided_by,is_simulated,created_at FROM vw.clearance_events WHERE inspection_version_id=$1 ORDER BY created_at DESC,id DESC',[r.id])).rows;}
  const total=(await first(c,'SELECT count(*)::int AS total FROM vw.inspection_versions'+where,[row.id,full])).total;
  await audit(c,u,'inspections.history','inspection',row.id);return ok({rows,total,page:offset/50+1,pageSize:50});
 }));
 app.put('/api/inspections/:id/draft',protectedRoute('inspections.save',async(c,u,q)=>{
  const row=await getCurrent(c,u,uuid(q.params.id),true),b=body(q,['version','findings','answers']);
  const owner=u.role==='inspector'&&u.id===row.inspector_id;
  if(!owner)fail(403,'Forbidden');
  if(version(b.version)!==row.version||!transition(row.workflow_state,'save',owner,false))fail(409,'Inspection changed or is not editable; reload before saving');
  const findings=note(b.findings),responses=validateResponses(await getItems(c,row.template_id),b.answers,false);
  const saved=await append(c,u,row,'draft',findings,responses);
  await audit(c,u,'inspections.save','inspection',row.id,'success',{version:saved.version});return ok(await details(c,u,saved));
 }));
 app.post('/api/inspections/:id/transition',protectedRoute('inspections.transition',async(c,u,q)=>{
  const row=await getCurrent(c,u,uuid(q.params.id),true),b=body(q,['version','action','reason','attest']);
  const owner=u.role==='inspector'&&u.id===row.inspector_id,reviewer=canReview(u)&&u.station_id===row.station_id;
  if(!['submit','return','review','reopen'].includes(b.action))fail(400,'Invalid action');
  if(b.action==='submit'?!owner:!reviewer)fail(403,'Forbidden');
  const next=transition(row.workflow_state,b.action,owner,reviewer);
  if(version(b.version)!==row.version||!next)fail(409,'Inspection changed or action is not permitted in this state');
  const reason=note(b.reason??'',1000,['return','reopen'].includes(b.action));
  const responses=await getAnswers(c,row.revision_id);
  if(b.action==='submit'){
   if(b.attest!==true)fail(400,'Simulated attestation acknowledgement required');
   validateResponses(await getItems(c,row.template_id),responses.map(a=>({itemId:a.item_id,answer:a.answer,remarks:a.remarks??''})),true);
  }
  if(b.action==='review'&&!(await first(c,'SELECT id FROM vw.inspection_attestations WHERE inspection_version_id=$1 AND attested_by=$2 AND is_simulated',[row.revision_id,row.inspector_id])))fail(409,'Submission attestation missing');
  if(b.action==='reopen'){const last=await clearance(c,row.revision_id);if(last&&last.status!=='withdrawn')fail(409,'Withdraw the recorded demo clearance before reopening');}
  const saved=await append(c,u,row,next,row.findings,responses,reason||null);
  if(b.action==='submit')await c.query('INSERT INTO vw.inspection_attestations(inspection_version_id,attested_by,statement) VALUES($1,$2,$3)',[saved.revision_id,u.id,demoStatement]);
  await audit(c,u,'inspections.'+b.action,'inspection',row.id,'success',{version:saved.version});return ok(await details(c,u,saved));
 }));
 app.post('/api/inspections/:id/evidence',protectedRoute('inspections.evidence',async(c,u,q)=>{
  const row=await getCurrent(c,u,uuid(q.params.id),true);
  if(u.role!=='inspector'||u.id!==row.inspector_id)fail(403,'Forbidden');
  if(!['draft','returned'].includes(row.workflow_state))fail(409,'Evidence can only be added to an editable inspection');
  const b=uploadMetadata(q,fail);
  if(Object.keys(b).some(k=>!['filename','version'].includes(k)))fail(400,'Unexpected evidence field');
  if(version(b.version)!==row.version)fail(409,'Inspection changed; reload before adding evidence');
  const existing=await evidence(c,row.revision_id);
  if(existing.length>=10)fail(409,'Maximum 10 photos per inspection revision in this prototype');
  const upload=await receiveUpload(q,raw,fail,true,b);
  if(existing.some(f=>f.sha256===upload.meta.hash))fail(409,'Photo already attached');
  const file=await storage.store(c,u,upload.bytes,upload.meta);
  const saved=await append(c,u,row,row.workflow_state,row.findings,await getAnswers(c,row.revision_id),row.change_reason);
  await c.query('INSERT INTO vw.evidence_links(file_id,inspection_version_id,attached_by) VALUES($1,$2,$3)',[file.id,saved.revision_id,u.id]);
  await audit(c,u,'inspections.evidence','inspection',row.id,'success',{version:saved.version,fileId:file.id});
  return {status:201,data:await details(c,u,saved)};
 }));
 app.post('/api/inspections/:id/demo-clearance',protectedRoute('inspections.demo_clearance',async(c,u,q)=>{
  const row=await getCurrent(c,u,uuid(q.params.id),true),b=body(q,['version','status','reason','acknowledgeSimulation','expectedEventId']);
  if(!canReview(u)||u.station_id!==row.station_id)fail(403,'Forbidden');
  if(version(b.version)!==row.version||row.workflow_state!=='reviewed')fail(409,'Only the current reviewed revision is eligible');
  if(b.acknowledgeSimulation!==true||!['cleared','hold','withdrawn'].includes(b.status))fail(400,'Explicit simulation acknowledgement and status required');
  const reason=note(b.reason,1000,true),last=await clearance(c,row.revision_id);
  if((b.expectedEventId??null)!==(last?.id??null))fail(409,'Demo decision changed; reload before recording');
  if(b.status==='withdrawn'&&(!last||last.status==='withdrawn'))fail(409,'No active demo decision to withdraw');
  await c.query('INSERT INTO vw.clearance_events(inspection_version_id,decided_by,status,reason,is_simulated) VALUES($1,$2,$3,$4,true)',[row.revision_id,u.id,b.status,reason]);
  await audit(c,u,'inspections.demo_clearance','inspection',row.id,'success',{version:row.version,status:b.status,simulated:true});return ok(await details(c,u,row));
 }));
}
