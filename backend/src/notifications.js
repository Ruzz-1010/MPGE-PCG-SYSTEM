import {audit,tx} from './db.js';
import {todaySql} from './expiry.js';
import {admin,writer,demoPhone,maxAttempts} from './notification-policy.js';
const lock=c=>c.query('SELECT pg_advisory_xact_lock(71829311)');
const first=async(c,s,p=[]) => (await c.query(s,p)).rows[0];
const candidates=`SELECT dv.id AS document_version_id,d.vessel_id,v.station_id,
 CASE WHEN dv.expiry_date<${todaySql} THEN -1 WHEN dv.expiry_date=${todaySql} THEN 0
 WHEN dv.expiry_date=${todaySql}+1 THEN 1 WHEN dv.expiry_date<=${todaySql}+7 THEN 7 ELSE 30 END AS threshold_days
 FROM vw.documents d JOIN vw.vessels v ON v.id=d.vessel_id JOIN vw.stations s ON s.id=v.station_id
 JOIN LATERAL (SELECT id,expiry_date,expiry_kind FROM vw.document_versions WHERE document_id=d.id ORDER BY version DESC LIMIT 1) dv ON true
 WHERE s.active AND v.profile_status='active' AND dv.expiry_kind='dated' AND dv.expiry_date<=${todaySql}+30`;
const eligible=`WITH candidates AS (${candidates}), desired AS (
 SELECT c.document_version_id,c.threshold_days,'dashboard'::text AS channel,u.id AS recipient_user_id,NULL::uuid AS recipient_contact_id
 FROM candidates c JOIN vw.users u ON u.active AND (u.role='regional' OR (u.role IN ('station','records') AND u.station_id=c.station_id))
 UNION ALL
 SELECT c.document_version_id,c.threshold_days,'sms_demo',NULL::uuid,o.id FROM candidates c JOIN vw.owner_contacts o ON o.vessel_id=c.vessel_id
 WHERE o.is_demo AND o.sms_authorized AND o.verified_at IS NOT NULL AND o.phone_e164 ~ '^\\+120255501[0-9]{2}$'
 )`;
async function attempt(c,id,outcome,detail,actor=null){
 await c.query('INSERT INTO vw.notification_attempts(notification_id,attempt_no,outcome,detail,actor_id) SELECT $1,COALESCE(max(attempt_no),0)+1,$2,$3,$4 FROM vw.notification_attempts WHERE notification_id=$1',[id,outcome,detail,actor]);
}
export async function generateNotices(c,u=null){
 await lock(c);
 // Cancel only undelivered obsolete notices; preserve delivered/acknowledged history.
 const obsolete=await c.query(eligible+` UPDATE vw.notifications n SET state='cancelled'
 WHERE n.state IN ('queued','failed') AND NOT EXISTS (SELECT 1 FROM desired d WHERE d.document_version_id=n.document_version_id AND d.threshold_days=n.threshold_days AND d.channel=n.channel AND d.recipient_user_id IS NOT DISTINCT FROM n.recipient_user_id AND d.recipient_contact_id IS NOT DISTINCT FROM n.recipient_contact_id)
 RETURNING n.id`);
 for(const x of obsolete.rows)await attempt(c,x.id,'cancelled','Superseded or recipient no longer eligible',u?.id);
 const created=await c.query(eligible+` INSERT INTO vw.notifications(document_version_id,threshold_days,channel,recipient_user_id,recipient_contact_id)
 SELECT document_version_id,threshold_days,channel,recipient_user_id,recipient_contact_id FROM desired ON CONFLICT DO NOTHING RETURNING id`);
 if(created.rowCount||obsolete.rowCount)await audit(c,u,'notifications.generate','notification',null,'success',{created:created.rowCount,cancelled:obsolete.rowCount});
 return {created:created.rowCount,cancelled:obsolete.rowCount};
}
export const runNotifications=()=>tx(c=>generateNotices(c));
export function mountNotifications(app,{protectedRoute,fail,body,uuid,page,ok}){
 const allow=u=>{if(!admin(u))fail(403,'Forbidden');};
 const fields=`n.id,n.channel,n.threshold_days,n.state,n.created_at,n.acknowledged_at,v.id AS vessel_id,v.name AS vessel_name,v.owner_operator,v.station_id,d.id AS document_id,dt.name AS document_type,d.required,dv.number,dv.version,dv.expiry_date::text,
 CASE WHEN n.channel='sms_demo' THEN 'Fictional recipient ••••'||right(o.phone_e164,4) ELSE 'Your inbox' END AS recipient`;
 const joins=` FROM vw.notifications n JOIN vw.document_versions dv ON dv.id=n.document_version_id JOIN vw.documents d ON d.id=dv.document_id JOIN vw.vessels v ON v.id=d.vessel_id JOIN vw.document_types dt ON dt.id=d.type_id LEFT JOIN vw.owner_contacts o ON o.id=n.recipient_contact_id`;
 const scope=`((n.channel='dashboard' AND n.recipient_user_id=$1 AND ($2::boolean OR v.station_id=$3::uuid)) OR (n.channel='sms_demo' AND ($2::boolean OR v.station_id=$3::uuid)))`;
 const args=u=>[u.id,u.role==='regional',u.station_id];
 const getNotice=async(c,u,id)=>{
  allow(u);const r=await first(c,'SELECT '+fields+joins+' WHERE '+scope+' AND n.id=$4',[...args(u),id]);if(!r)fail(404,'Notice not available');return r;
 };
 app.get('/api/notifications',protectedRoute('notifications.list',async(c,u,q)=>{
  allow(u);const channel=q.query.channel??'dashboard',state=q.query.state??null,offset=page(q.query.page);
  if(!['dashboard','sms_demo'].includes(channel)||state!==null&&!['queued','failed','sent_demo','acknowledged','cancelled'].includes(state))fail(400,'Invalid filter');
  const where=' WHERE '+scope+' AND n.channel=$4 AND ($5::text IS NULL OR n.state=$5)',p=[...args(u),channel,state];
  const rows=(await c.query('SELECT '+fields+joins+where+' ORDER BY n.created_at DESC,n.id LIMIT 50 OFFSET $6',[...p,offset])).rows;
  const total=(await first(c,'SELECT count(*)::int AS total'+joins+where,p)).total;
  await audit(c,u,'notifications.list','notification');return ok({rows,total,page:offset/50+1,pageSize:50});
 }));
 app.get('/api/notifications/:id',protectedRoute('notifications.read',async(c,u,q)=>{
  const r=await getNotice(c,u,uuid(q.params.id));
  const history=(await c.query('SELECT attempt_no,outcome,detail,actor_id,created_at FROM vw.notification_attempts WHERE notification_id=$1 ORDER BY attempt_no DESC',[r.id])).rows;
  await audit(c,u,'notifications.read','notification',r.id);return ok({...r,history});
 }));
 app.post('/api/notifications/refresh',protectedRoute('notifications.refresh',async(c,u,q)=>{
  if(u.role!=='regional')fail(403,'Forbidden');body(q,[]);return ok(await generateNotices(c,u));
 }));
 app.post('/api/notifications/:id/action',protectedRoute('notifications.action',async(c,u,q)=>{
  allow(u);const b=body(q,['action','expectedState','expectedAttempts','note']),id=uuid(q.params.id);
  const before=await getNotice(c,u,id);
  await lock(c);
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,71829309))',[before.document_id]);
  await generateNotices(c); // serialize against scheduling and revalidate current revision
  const r=await getNotice(c,u,id);
  const prior=(await first(c,'SELECT count(*)::int AS n FROM vw.notification_attempts WHERE notification_id=$1',[id])).n;
  if(r.state!==b.expectedState||b.expectedAttempts!==prior)fail(409,'Notice changed; reload first');
  if(typeof b.note!=='string'||b.note.length>500||!b.note.trim()||/[\u0000-\u001f\u007f]/u.test(b.note))fail(400,'Action note required');
  let state;
  if(b.action==='acknowledge'&&r.channel==='dashboard'&&r.state==='queued')state='acknowledged';
  else if(['simulate_success','simulate_failure'].includes(b.action)&&r.channel==='sms_demo'&&writer(u)&&['queued','failed'].includes(r.state)){
   const count=(await first(c,"SELECT count(*)::int AS n FROM vw.notification_attempts WHERE notification_id=$1 AND outcome IN ('sent_demo','failed')",[id])).n;
   if(count>=maxAttempts)fail(409,'Demo retry limit reached');
   state=b.action==='simulate_success'?'sent_demo':'failed';
  }else fail(403,'Action not permitted');
  await c.query("UPDATE vw.notifications SET state=$2,acknowledged_at=CASE WHEN $2='acknowledged' THEN clock_timestamp() ELSE NULL END,acknowledged_by=CASE WHEN $2='acknowledged' THEN $3::uuid ELSE NULL END WHERE id=$1",[id,state,u.id]);
  await attempt(c,id,state,b.note.trim(),u.id);await audit(c,u,'notifications.'+state,'notification',id);return ok({id,state});
 }));
 app.get('/api/demo-contacts/:vesselId',protectedRoute('notifications.contacts',async(c,u,q)=>{
  allow(u);const id=uuid(q.params.vesselId);
  const v=await first(c,'SELECT id FROM vw.vessels WHERE id=$1 AND ($2::boolean OR station_id=$3::uuid)',[id,u.role==='regional',u.station_id]);if(!v)fail(404,'Vessel not available');
  return ok((await c.query("SELECT id,'Fictional recipient ••••'||right(phone_e164,4) AS label,sms_authorized,verified_at FROM vw.owner_contacts WHERE vessel_id=$1 AND is_demo AND phone_e164 ~ '^\\+120255501[0-9]{2}$' ORDER BY id",[id])).rows);
 }));
 app.post('/api/demo-contacts/:vesselId',protectedRoute('notifications.contact.create',async(c,u,q)=>{
  if(!writer(u))fail(403,'Forbidden');const id=uuid(q.params.vesselId),b=body(q,['suffix','acknowledgeDemo']);await lock(c);
  if(b.acknowledgeDemo!==true||typeof b.suffix!=='string'||!/^\d{2}$/.test(b.suffix))fail(400,'Choose two fictional digits and confirm simulation');
  const phone='+120255501'+b.suffix;if(!demoPhone(phone))fail(400,'Fictional number required');
  const v=await first(c,'SELECT id FROM vw.vessels WHERE id=$1 AND station_id=$2',[id,u.station_id]);if(!v)fail(404,'Vessel not available');
  const r=await first(c,'INSERT INTO vw.owner_contacts(vessel_id,phone_e164,verified_at,sms_authorized,recorded_by,is_demo) VALUES($1,$2,clock_timestamp(),true,$3,true) ON CONFLICT(vessel_id,phone_e164) DO NOTHING RETURNING id',[id,phone,u.id]);if(!r)fail(409,'Demo recipient already exists');
  await audit(c,u,'notifications.contact.create','owner_contact',r.id,'success',{simulated:true});await generateNotices(c,u);return {status:201,data:r};
 }));
 app.post('/api/demo-contacts/:vesselId/:contactId/disable',protectedRoute('notifications.contact.disable',async(c,u,q)=>{
  if(!writer(u))fail(403,'Forbidden');body(q,[]);await lock(c);const vid=uuid(q.params.vesselId),cid=uuid(q.params.contactId);
  const r=await first(c,"UPDATE vw.owner_contacts o SET sms_authorized=false FROM vw.vessels v WHERE o.id=$1 AND o.vessel_id=$2 AND v.id=o.vessel_id AND v.station_id=$3 AND o.is_demo AND o.phone_e164 ~ '^\\+120255501[0-9]{2}$' RETURNING o.id",[cid,vid,u.station_id]);if(!r)fail(404,'Demo recipient not available');
  await audit(c,u,'notifications.contact.disable','owner_contact',cid);await generateNotices(c,u);return ok({id:cid});
 }));
}
