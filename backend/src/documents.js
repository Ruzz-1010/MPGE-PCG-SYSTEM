import {audit} from './db.js';
import {currentDocs,validity,todaySql} from './expiry.js';
import {validateFile} from './private-files.js';
import {canReadVessels,canWriteVessels} from './policy.js';
let uploads=0;
// Read binary only after session and record-scope checks. Two concurrent uploads per process.
export function uploadMetadata(q,fail){
 if(!q.is('application/octet-stream'))fail(415,'Binary upload required');
 const header=q.get('x-vw-metadata');
 if(!header||header.length>6000)fail(400,'Missing or oversized upload metadata');
 let data;try{data=JSON.parse(decodeURIComponent(header));}catch{fail(400,'Invalid upload metadata');}
 if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Invalid upload metadata');
 return data;
}
export async function receiveUpload(q,raw,fail,photo=false,data=uploadMetadata(q,fail)){
 if(uploads>=2)fail(429,'Upload capacity busy; retry later');
 uploads++;
 try{
  await new Promise((resolve,reject)=>raw(q,{},e=>e?reject(e):resolve()));
  const meta=await validateFile(q.body,data.filename,{photo});
  return {data,meta,bytes:q.body};
 }finally{uploads--;}
}
export function mountDocuments(app,{protectedRoute,fail,body,uuid,page,ok,storage,raw}){
 const one=async(c,s,p=[]) => (await c.query(s,p)).rows[0];
 const read=u=>{if(!canReadVessels(u))fail(403,'Forbidden');};
 const write=u=>{if(!canWriteVessels(u))fail(403,'Forbidden');};
 const keys=(b,allowed)=>{if(Object.keys(b).some(k=>!allowed.includes(k)))fail(400,'Unexpected upload field');};
 const note=(v,max,required=true)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u001f\u007f]/u.test(v)||(required&&!v.trim()))fail(400,'Invalid or missing text');return v.trim();};
 const date=v=>{if(v===null||v==='')return null;if(typeof v!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)||v<'1900-01-01'||v>'2200-12-31')fail(400,'Invalid date');const d=new Date(v+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)fail(400,'Invalid calendar date');return v;};
 const rev=v=>{if(!Number.isInteger(v)||v<1||v>2147483646)fail(400,'Expected version required');return v;};
 const whereScope="($1::boolean OR v.station_id=$2::uuid)";
 const scope=u=>[u.role==='regional',u.station_id];
 const fields=`d.id,d.vessel_id,v.name AS vessel_name,v.station_id,dt.name AS type,dt.id AS type_id,d.required,d.created_at,
 dv.id AS version_id,dv.version,dv.number,dv.issuer,dv.issue_date::text,dv.expiry_date::text,dv.expiry_kind,dv.file_id,dv.recorded_by,dv.created_at AS version_at,
 dr.id AS review_id,COALESCE(dr.status,'needs_review') AS verification,dr.reason AS review_reason,
 ${validity} AS date_status,(dv.expiry_date-${todaySql}) AS days_to_expiry,
 (d.required AND dv.expiry_kind='dated' AND dv.expiry_date<${todaySql}) AS review_warning`;
 const current=async(c,u,id,lock=false)=>{
  read(u);if(lock){write(u);await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,71829309))',[id]);}
  const r=await one(c,'SELECT '+fields+currentDocs+' WHERE '+whereScope+' AND d.id=$3',[...scope(u),id]);
  if(!r)fail(404,'Document not available');return r;
 };
 const fileMeta=async(c,id)=>id?await one(c,'SELECT id,original_name,media_type,byte_size,sha256,scan_state,uploaded_by,created_at FROM vw.private_files WHERE id=$1',[id]):null;
 async function details(c,u,r){return {...r,file:await fileMeta(c,r.file_id),capabilities:{renew:canWriteVessels(u),review:canWriteVessels(u)}};}
 const validate=(b,type)=>{
  const number=note(b.number,120),issuer=note(b.issuer,180),issue=date(b.issueDate??null),expiry=date(b.expiryDate??null),kind=b.expiryKind;
  if(!['dated','unknown','not_applicable'].includes(kind)||(kind==='dated')!==(expiry!==null)||(issue&&expiry&&expiry<issue)||(kind==='not_applicable'&&type.expiry_expected))fail(400,'Invalid issue or expiry information');
  return [number,issuer,issue,expiry,kind];
 };
 app.get('/api/document-types',protectedRoute('documents.types',async(c,u)=>{
  read(u);return ok((await c.query('SELECT id,code,name,expiry_expected FROM vw.document_types WHERE active ORDER BY name')).rows);
 }));
 app.get('/api/documents',protectedRoute('documents.list',async(c,u,q)=>{
  read(u);const offset=page(q.query.page);
  const search=q.query.q===undefined?'':note(q.query.q,180,false);
  const status=q.query.status??null;if(status!==null&&!['expired','due_today','expiring_soon','valid_by_date','unknown','not_applicable'].includes(status))fail(400,'Invalid date status');
  const vessel=q.query.vesselId===undefined?null:uuid(q.query.vesselId);
  const where=' WHERE '+whereScope+" AND (strpos(lower(v.name),lower($3))>0 OR strpos(lower(v.official_registration),lower($3))>0 OR $3='') AND ($4::text IS NULL OR ("+validity+")=$4) AND ($5::uuid IS NULL OR d.vessel_id=$5)";
  const params=[...scope(u),search,status,vessel];
  const rows=(await c.query('SELECT '+fields+currentDocs+where+' ORDER BY dv.expiry_date NULLS LAST,d.id LIMIT 50 OFFSET $6',[...params,offset])).rows;
  const total=(await one(c,'SELECT count(*)::int AS total'+currentDocs+where,params)).total;
  await audit(c,u,'documents.list','document');return ok({rows,total,page:offset/50+1,pageSize:50});
 }));
 app.get('/api/documents/expiry-summary',protectedRoute('documents.expiry_summary',async(c,u)=>{
  read(u);
  const counts=await one(c,`SELECT count(*)::int AS total,count(*) FILTER(WHERE d.required AND dv.expiry_date<${todaySql})::int AS expired_required,
  count(*) FILTER(WHERE dv.expiry_date=${todaySql}+30)::int AS due_30,count(*) FILTER(WHERE dv.expiry_date=${todaySql}+7)::int AS due_7,
  count(*) FILTER(WHERE dv.expiry_date=${todaySql}+1)::int AS due_1,count(*) FILTER(WHERE dv.expiry_kind='unknown')::int AS unknown
  ${currentDocs} WHERE ${whereScope}`,scope(u));
  const check=await one(c,'SELECT check_date::text,completed_at FROM vw.expiration_checks ORDER BY check_date DESC LIMIT 1');
  return ok({counts,lastCheck:check??null,timezone:'Asia/Manila',warningOnly:true});
 }));
 app.post('/api/documents',protectedRoute('documents.create',async(c,u,q)=>{
  write(u);
  // Metadata header is parsed only after authentication; validate scoped vessel before storage.
  const b=uploadMetadata(q,fail);
  keys(b,['filename','vesselId','typeId','required','number','issuer','issueDate','expiryDate','expiryKind']);
  const vid=uuid(b.vesselId),tid=uuid(b.typeId);
  if(typeof b.required!=='boolean')fail(400,'Required indicator must be explicit');
  const vessel=await one(c,'SELECT id FROM vw.vessels WHERE id=$1 AND station_id=$2',[vid,u.station_id]);if(!vessel)fail(404,'Vessel not available');
  const type=await one(c,'SELECT id,expiry_expected FROM vw.document_types WHERE id=$1 AND active',[tid]);if(!type)fail(400,'Active fictional document type required');
  const values=validate(b,type);
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,71829310))",[vid+':'+tid]);
  if(await one(c,`SELECT d.id ${currentDocs} WHERE d.vessel_id=$1 AND d.type_id=$2 AND lower(btrim(dv.number))=lower(btrim($3))`,[vid,tid,values[0]]))fail(409,'Potential duplicate document; review existing record or renew');
  const upload=await receiveUpload(q,raw,fail,false,b);
  const file=await storage.store(c,u,upload.bytes,upload.meta);
  const doc=await one(c,'INSERT INTO vw.documents(vessel_id,type_id,required,created_by) VALUES($1,$2,$3,$4) RETURNING id',[vid,tid,b.required,u.id]);
  await c.query('INSERT INTO vw.document_versions(document_id,version,number,issuer,issue_date,expiry_date,expiry_kind,file_id,recorded_by) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8)',[doc.id,...values,file.id,u.id]);
  await audit(c,u,'documents.create','document',doc.id,'success',{version:1,fileId:file.id});
  return {status:201,data:await details(c,u,await current(c,u,doc.id))};
 }));
 app.get('/api/documents/:id',protectedRoute('documents.read',async(c,u,q)=>{
  const r=await current(c,u,uuid(q.params.id));await audit(c,u,'documents.read','document',r.id);return ok(await details(c,u,r));
 }));
 app.get('/api/documents/:id/history',protectedRoute('documents.history',async(c,u,q)=>{
  const r=await current(c,u,uuid(q.params.id)),offset=page(q.query.page);
  const rows=(await c.query('SELECT id,version,number,issuer,issue_date::text,expiry_date::text,expiry_kind,file_id,recorded_by,created_at FROM vw.document_versions WHERE document_id=$1 ORDER BY version DESC LIMIT 50 OFFSET $2',[r.id,offset])).rows;
  for(const v of rows){v.file=await fileMeta(c,v.file_id);v.reviews=(await c.query('SELECT id,status,reason,reviewed_by,created_at FROM vw.document_reviews WHERE document_version_id=$1 ORDER BY created_at DESC,id DESC',[v.id])).rows;}
  const total=(await one(c,'SELECT count(*)::int AS total FROM vw.document_versions WHERE document_id=$1',[r.id])).total;
  await audit(c,u,'documents.history','document',r.id);return ok({rows,total,page:offset/50+1,pageSize:50});
 }));
 app.post('/api/documents/:id/renew',protectedRoute('documents.renew',async(c,u,q)=>{
  const r=await current(c,u,uuid(q.params.id),true);
  const b=uploadMetadata(q,fail);
  keys(b,['filename','version','number','issuer','issueDate','expiryDate','expiryKind']);
  if(rev(b.version)!==r.version)fail(409,'Document changed; reload before renewal');
  const type=await one(c,'SELECT expiry_expected FROM vw.document_types WHERE id=$1 AND active',[r.type_id]);if(!type)fail(409,'Document type unavailable');
  const values=validate(b,type);
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,71829310))",[r.vessel_id+':'+r.type_id]);
  if(await one(c,`SELECT d.id ${currentDocs} WHERE d.vessel_id=$1 AND d.type_id=$2 AND lower(btrim(dv.number))=lower(btrim($3)) AND d.id<>$4`,[r.vessel_id,r.type_id,values[0],r.id]))fail(409,'Potential duplicate document; review existing record');
  const upload=await receiveUpload(q,raw,fail,false,b);
  const file=await storage.store(c,u,upload.bytes,upload.meta);
  await c.query('INSERT INTO vw.document_versions(document_id,version,number,issuer,issue_date,expiry_date,expiry_kind,file_id,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[r.id,r.version+1,...values,file.id,u.id]);
  await audit(c,u,'documents.renew','document',r.id,'success',{version:r.version+1,fileId:file.id});
  return ok(await details(c,u,await current(c,u,r.id)));
 }));
 app.post('/api/documents/:id/review',protectedRoute('documents.review',async(c,u,q)=>{
  const r=await current(c,u,uuid(q.params.id),true),b=body(q,['version','status','reason','expectedReviewId']);
  if(rev(b.version)!==r.version||(b.expectedReviewId??null)!==(r.review_id??null))fail(409,'Document or review changed; reload first');
  if(!['verified','rejected','needs_review'].includes(b.status))fail(400,'Invalid verification state');
  const reason=note(b.reason??'',1000,b.status!=='verified');
  if(b.status==='verified'){
   if(!r.file_id)fail(409,'No validated file attached');
   const f=await one(c,'SELECT * FROM vw.private_files WHERE id=$1',[r.file_id]);await storage.read(f);
  }
  await c.query('INSERT INTO vw.document_reviews(document_version_id,reviewed_by,status,reason) VALUES($1,$2,$3,$4)',[r.version_id,u.id,b.status,reason||null]);
  await audit(c,u,'documents.review','document',r.id,'success',{version:r.version,status:b.status});
  return ok(await details(c,u,await current(c,u,r.id)));
 }));
 app.get('/api/files/:id',protectedRoute('files.download',async(c,u,q)=>{
  read(u);const id=uuid(q.params.id);
  // Resolve authorization through the exact linked record, not uploader or knowledge of file UUID.
  const f=await one(c,`SELECT f.* FROM vw.private_files f WHERE f.id=$1 AND (
  EXISTS(SELECT 1 FROM vw.document_versions dv JOIN vw.documents d ON d.id=dv.document_id JOIN vw.vessels v ON v.id=d.vessel_id
   WHERE (dv.file_id=f.id OR EXISTS(SELECT 1 FROM vw.evidence_links el WHERE el.document_version_id=dv.id AND el.file_id=f.id)) AND ($2::boolean OR v.station_id=$3::uuid))
  OR EXISTS(SELECT 1 FROM vw.evidence_links el JOIN vw.inspection_versions iv ON iv.id=el.inspection_version_id JOIN vw.inspections i ON i.id=iv.inspection_id
   JOIN LATERAL (SELECT workflow_state FROM vw.inspection_versions WHERE inspection_id=i.id ORDER BY version DESC LIMIT 1) latest ON true
   WHERE el.file_id=f.id AND ($2::boolean OR i.station_id=$3::uuid)
   AND ($4::text IN ('regional','station') OR ($4='inspector' AND i.inspector_id=$5::uuid) OR (iv.workflow_state='reviewed' AND latest.workflow_state='reviewed')))
  )`,[id,...scope(u),u.role,u.id]);
  if(!f)fail(404,'File not available');
  const file=await storage.read(f);
  await audit(c,u,'files.download','private_file',id);return {file};
 }));
}
