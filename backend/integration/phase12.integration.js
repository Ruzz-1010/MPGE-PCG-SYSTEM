import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {hashPassword,tokenHash} from '../src/passwords.js';
import {privileged,readKey,newSecret,seal,totp} from '../src/mfa.js';

const ownerUrl=process.env.MIGRATION_DATABASE_URL;
const runtimeUrl=process.env.DATABASE_URL;
const api=process.env.API_URL;
if(process.env.VW_TEST_ALLOW!=='1'||!ownerUrl||!runtimeUrl||!api||
 new URL(ownerUrl).pathname!=='/vesselwatch_demo'||new URL(runtimeUrl).pathname!=='/vesselwatch_demo'||
 !['api','localhost','127.0.0.1'].includes(new URL(api).hostname)){
 throw Error('Run only against a disposable vesselwatch_demo environment with VW_TEST_ALLOW=1');
}
const owner=new pg.Pool({connectionString:ownerUrl});
const runtime=new pg.Pool({connectionString:runtimeUrl});
const tag=randomBytes(5).toString('hex');
const password=randomBytes(24).toString('hex');
const nextPassword=randomBytes(24).toString('hex');
const hash=await hashPassword(password);
const one=async(c,s,p=[]) => (await c.query(s,p)).rows[0];
const call=async(method,path,payload,token)=>{
 const headers={};
 if(payload!==undefined)headers['Content-Type']='application/json';
 if(token)headers.Authorization='Bearer '+token;
 const res=await fetch(api+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
 const data=await res.json();
 return {status:res.status,data};
};
const expect=async(status,...args)=>{
 const r=await call(...args);
 assert.equal(r.status,status,args[0]+' '+args[1]);
 return r.data;
};
const sqlReject=async(c,code,s,p=[])=>{
 await c.query('SAVEPOINT check_reject');
 try{
  await assert.rejects(()=>c.query(s,p),e=>e.code===code);
 }finally{await c.query('ROLLBACK TO SAVEPOINT check_reject');await c.query('RELEASE SAVEPOINT check_reject');}
};
const stationA=(await one(owner,"SELECT id FROM vw.stations WHERE code='DEMO-1'")).id;
const stationB=(await one(owner,"SELECT id FROM vw.stations WHERE code='DEMO-2'")).id;
const makeUser=async(role,station)=>one(owner,'INSERT INTO vw.users(username,full_name,password_hash,role,station_id,must_change_password) VALUES($1,$2,$3,$4,$5,false) RETURNING id,username',
 ['test_'+tag+'_'+role+(station===stationB?'b':''),'Synthetic '+role,hash,role,station]);
const regional=await makeUser('regional',null);
const station=await makeUser('station',stationA);
const inspector=await makeUser('inspector',stationA);
const recordsB=await makeUser('records',stationB);
const technical=await makeUser('technical',null);
const secrets=new Map(),key=readKey(process.env.VW_MFA_KEY);
for(const u of [regional,station,technical]){const secret=newSecret();secrets.set(u.id,secret);await owner.query('UPDATE vw.users SET mfa_secret_cipher=$1 WHERE id=$2',[seal(secret,key,u.id),u.id]);}
const loginPayload=(u,p=password)=>({username:u.username,password:p,...(secrets.has(u.id)?{otp:totp(secrets.get(u.id),Math.floor(Date.now()/30000))}:{})});
const login=async(u,p=password)=> (await expect(200,'POST','/api/auth/login',loginPayload(u,p))).token;
let vessel;
let aToken;
test('schema: 36 tables, four tracked migrations and deny-by-default grants',async()=>{
 const names=(await owner.query("SELECT tablename FROM pg_tables WHERE schemaname='vw'")).rows.map(r=>r.tablename);
 assert.equal(names.length,36);
 for(const n of ['vessels','qr_identifiers','inspections','document_versions','notifications','sync_requests','evidence_links','monthly_reports','list_reviews','users','audit_events','restore_tests','announcements','internal_messages'])assert.ok(names.includes(n),n);
 assert.equal(Number((await one(owner,'SELECT count(*) AS n FROM public.vesselwatch_migrations')).n),4);
 assert.equal(Number((await one(owner,'SELECT count(*) AS n FROM vw.stations')).n),9);
 const role=await one(runtime,"SELECT current_user AS who, rolsuper FROM pg_roles WHERE rolname=current_user");
 assert.equal(role.who,'vesselwatch_app');assert.equal(role.rolsuper,false);
 await assert.rejects(()=>runtime.query('SELECT * FROM vw.owner_contacts'),e=>e.code==='42501');
 await assert.rejects(()=>runtime.query('SELECT * FROM vw.clearance_events'),e=>e.code==='42501');
 await assert.rejects(()=>runtime.query("UPDATE vw.audit_events SET action='bad' WHERE false"),e=>e.code==='42501');
 await assert.rejects(()=>runtime.query('DELETE FROM vw.vessel_versions WHERE false'),e=>e.code==='42501');
});
test('API: authentication, least privilege, registry history and conflict handling',async()=>{
 await expect(200,'GET','/api/health');
 await expect(401,'GET','/api/vessels');
 await expect(401,'POST','/api/auth/login',{username:station.username,password:'wrong'});
 aToken=await login(station);const rToken=await login(regional),iToken=await login(inspector),bToken=await login(recordsB),tToken=await login(technical);
 const body={name:'Synthetic vessel '+tag,officialRegistration:'DEMO-'+tag,ownerOperator:'Fictional operator',vesselType:'Demo'};
 await expect(403,'POST','/api/vessels',body,iToken);
 await expect(403,'POST','/api/vessels',{...body,stationId:stationB},aToken);
 vessel=await expect(201,'POST','/api/vessels',body,aToken);
 assert.equal(vessel.station_id,stationA);assert.equal(vessel.version,1);
 await expect(409,'POST','/api/vessels',{...body,name:'Duplicate '+tag,officialRegistration:' demo-'+tag+' '},aToken);
 await expect(404,'GET','/api/vessels/'+vessel.id,undefined,bToken);
 await expect(403,'GET','/api/vessels?stationId='+stationA,undefined,bToken);
 await expect(403,'GET','/api/vessels',undefined,tToken);
 const regionalFound=await expect(200,'GET','/api/vessels?q='+tag,undefined,rToken);
 assert.ok(regionalFound.some(v=>v.id===vessel.id));
 const update={...body,ownerOperator:'Fictional revised operator',version:1,profileStatus:'active'};
 const changed=await expect(200,'PUT','/api/vessels/'+vessel.id,update,aToken);assert.equal(changed.version,2);
 await expect(409,'PUT','/api/vessels/'+vessel.id,update,aToken);
 assert.equal(Number((await one(owner,'SELECT count(*) n FROM vw.vessel_versions WHERE vessel_id=$1',[vessel.id])).n),2);
 assert.equal(Number((await one(owner,"SELECT count(*) n FROM vw.audit_events WHERE resource_id=$1 AND action IN ('vessels.create','vessels.update') AND outcome='success'",[vessel.id])).n),2);
 await expect(403,'GET','/api/audit',undefined,iToken);
 await expect(200,'GET','/api/audit',undefined,rToken);
 await expect(403,'POST','/api/users',{username:'bad_'+tag,fullName:'Invalid escalation',role:'regional',password},aToken);
 const account=await expect(201,'POST','/api/users',{username:'new_'+tag,fullName:'Synthetic new inspector',role:'inspector',stationId:stationA,password},aToken);
 const newToken=await login(account);
 await expect(403,'GET','/api/vessels',undefined,newToken);
 await expect(200,'POST','/api/auth/change-password',{currentPassword:password,newPassword:nextPassword},newToken);
 await expect(401,'GET','/api/auth/me',undefined,newToken);
 const newLogin=await login(account,nextPassword);
 await expect(200,'GET','/api/vessels',undefined,newLogin);
 await expect(200,'PATCH','/api/users/'+account.id,{active:false},aToken);
 await expect(401,'GET','/api/auth/me',undefined,newLogin);
 await owner.query("UPDATE vw.sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[tokenHash(bToken)]);
 await expect(401,'GET','/api/auth/me',undefined,bToken);
 await expect(200,'POST','/api/auth/logout',undefined,iToken);
 await expect(401,'GET','/api/auth/me',undefined,iToken);
});
test('feature constraints: QR, checklist, documents, notification dedup, sync, gated decisions, backup and messaging',async()=>{
 assert.ok(vessel,'API fixture must exist');
 const c=await owner.connect();
 const insert=async(s,p=[])=>one(c,s,p);
 try{
  await c.query('BEGIN');
  const qr=await insert('INSERT INTO vw.qr_identifiers(vessel_id,issued_by) VALUES($1,$2) RETURNING id',[vessel.id,station.id]);
  await sqlReject(c,'23505','INSERT INTO vw.qr_identifiers(vessel_id,issued_by) VALUES($1,$2)',[vessel.id,station.id]);
  await c.query('UPDATE vw.qr_identifiers SET revoked_at=now(),revoked_by=$2 WHERE id=$1',[qr.id,station.id]);
  await c.query('INSERT INTO vw.qr_identifiers(vessel_id,issued_by) VALUES($1,$2)',[vessel.id,station.id]);
  const template=await insert("INSERT INTO vw.checklist_templates(name,version,created_by) VALUES($1,1,$2) RETURNING id",['Demo '+tag,station.id]);
  const other=await insert("INSERT INTO vw.checklist_templates(name,version,created_by) VALUES($1,1,$2) RETURNING id",['Other '+tag,station.id]);
  const item=await insert("INSERT INTO vw.checklist_items(template_id,item_code,prompt,ordinal) VALUES($1,'D1','Synthetic item',1) RETURNING id",[template.id]);
  const otherItem=await insert("INSERT INTO vw.checklist_items(template_id,item_code,prompt,ordinal) VALUES($1,'D2','Other item',1) RETURNING id",[other.id]);
  const insp=await insert('INSERT INTO vw.inspections(vessel_id,station_id,inspector_id,template_id,inspected_at) VALUES($1,$2,$3,$4,now()) RETURNING id',[vessel.id,stationA,inspector.id,template.id]);
  const ver=await insert("INSERT INTO vw.inspection_versions(inspection_id,template_id,version,workflow_state,changed_by) VALUES($1,$2,1,'draft',$3) RETURNING id",[insp.id,template.id,inspector.id]);
  await sqlReject(c,'23503',"INSERT INTO vw.checklist_answers(inspection_version_id,template_id,item_id,answer) VALUES($1,$2,$3,'pass')",[ver.id,template.id,otherItem.id]);
  await c.query("INSERT INTO vw.checklist_answers(inspection_version_id,template_id,item_id,answer) VALUES($1,$2,$3,'pass')",[ver.id,template.id,item.id]);
  await sqlReject(c,'23514',"INSERT INTO vw.clearance_events(inspection_version_id,decided_by,status,reason,is_simulated) VALUES($1,$2,'cleared','Test',false)",[ver.id,station.id]);
  await sqlReject(c,'23514',"INSERT INTO vw.inspection_attestations(inspection_version_id,attested_by,statement,is_simulated) VALUES($1,$2,'Test',false)",[ver.id,inspector.id]);
  const typ=await insert('INSERT INTO vw.document_types(code,name) VALUES($1,$2) RETURNING id',['D-'+tag,'Synthetic type']);
  const doc=await insert('INSERT INTO vw.documents(vessel_id,type_id,required,created_by) VALUES($1,$2,true,$3) RETURNING id',[vessel.id,typ.id,station.id]);
  const file=await insert("INSERT INTO vw.private_files(original_name,media_type,byte_size,sha256,uploaded_by) VALUES('demo.pdf','application/pdf',100,$1,$2) RETURNING id",['a'.repeat(64),station.id]);
  await sqlReject(c,'23514',"INSERT INTO vw.private_files(original_name,media_type,byte_size,sha256,uploaded_by) VALUES('bad.exe','application/octet-stream',100,$1,$2)",['a'.repeat(64),station.id]);
  await sqlReject(c,'23514',"INSERT INTO vw.document_versions(document_id,version,number,issuer,expiry_kind,recorded_by) VALUES($1,1,'D','Demo','dated',$2)",[doc.id,station.id]);
  const dv=await insert("INSERT INTO vw.document_versions(document_id,version,number,issuer,expiry_date,expiry_kind,file_id,recorded_by) VALUES($1,1,'D','Demo',current_date+7,'dated',$2,$3) RETURNING id",[doc.id,file.id,station.id]);
  await sqlReject(c,'23514','INSERT INTO vw.evidence_links(file_id,attached_by) VALUES($1,$2)',[file.id,station.id]);
  await c.query('INSERT INTO vw.evidence_links(file_id,inspection_version_id,attached_by) VALUES($1,$2,$3)',[file.id,ver.id,inspector.id]);
  const alert="INSERT INTO vw.notifications(document_version_id,threshold_days,channel,recipient_user_id) VALUES($1,7,'dashboard',$2)";
  await c.query(alert,[dv.id,station.id]);await sqlReject(c,'23505',alert,[dv.id,station.id]);
  await sqlReject(c,'23514',"INSERT INTO vw.notifications(document_version_id,threshold_days,channel,recipient_user_id) VALUES($1,7,'sms_demo',$2)",[dv.id,station.id]);
  const device=randomUUID(),request=randomUUID();
  const sync="INSERT INTO vw.sync_requests(actor_id,device_id,client_request_id,payload_sha256) VALUES($1,$2,$3,$4)";
  await c.query(sync,[inspector.id,device,request,'b'.repeat(64)]);await sqlReject(c,'23505',sync,[inspector.id,device,request,'b'.repeat(64)]);
  await sqlReject(c,'23514',"INSERT INTO vw.list_reviews(vessel_id,recorded_by,kind,state,reason,is_simulated) VALUES($1,$2,'blacklist_demo','active_demo','Test',false)",[vessel.id,station.id]);
  await sqlReject(c,'23514',"INSERT INTO vw.backup_runs(state) VALUES('succeeded')");
  const bk=await insert("INSERT INTO vw.backup_runs(state) VALUES('running') RETURNING id");
  await sqlReject(c,'23514',"INSERT INTO vw.restore_tests(backup_id,tested_by,state) VALUES($1,$2,'passed')",[bk.id,technical.id]);
  await sqlReject(c,'23514',"INSERT INTO vw.monthly_reports(period_start,counting_rule,inspected_count,cleared_count,held_count,pending_count) VALUES('2026-11-02','demo',1,0,0,1)");
  const msg=await insert("INSERT INTO vw.internal_messages(sender_id,subject,body) VALUES($1,'Demo','Synthetic message') RETURNING id",[station.id]);
  await c.query('INSERT INTO vw.message_recipients(message_id,recipient_id) VALUES($1,$2)',[msg.id,inspector.id]);
  await sqlReject(c,'23505','INSERT INTO vw.message_recipients(message_id,recipient_id) VALUES($1,$2)',[msg.id,inspector.id]);
  await sqlReject(c,'23514',"INSERT INTO vw.announcements(publisher_id,title,body,audience,state) VALUES($1,'Demo','Test','all_stations','published')",[station.id]);
 }finally{await c.query('ROLLBACK');c.release();}
});
test('hardening: inactive station, idle timeout, bounded sessions, input and DB permission controls',async()=>{
 await assert.rejects(()=>runtime.query("UPDATE vw.users SET role='regional' WHERE false"),e=>e.code==='42501');
 await assert.rejects(()=>runtime.query("UPDATE vw.users SET station_id=NULL WHERE false"),e=>e.code==='42501');
 await assert.rejects(()=>runtime.query("UPDATE vw.vessels SET station_id=station_id WHERE false"),e=>e.code==='42501');
 await assert.rejects(()=>runtime.query("UPDATE vw.vessels SET created_by=created_by WHERE false"),e=>e.code==='42501');
 await expect(400,'PATCH','/api/users/'+inspector.id,{role:'regional',active:true},aToken);
 await expect(400,'POST','/api/vessels',{name:'Bad '+tag,officialRegistration:'X',ownerOperator:'Demo',vesselType:'Demo',createdBy:regional.id},aToken);
 await expect(400,'GET','/api/vessels?page=1&page=2',undefined,aToken);
 const old=await login(inspector);
 await owner.query("UPDATE vw.sessions SET last_seen_at=now()-interval '31 minutes' WHERE token_hash=$1",[tokenHash(old)]);
 await expect(401,'GET','/api/auth/me',undefined,old);
 const fresh=await login(inspector);
 await owner.query('UPDATE vw.stations SET active=false WHERE id=$1',[stationA]);
 try{
  await expect(403,'GET','/api/auth/me',undefined,fresh);
  await expect(401,'POST','/api/auth/login',{username:inspector.username,password});
 }finally{await owner.query('UPDATE vw.stations SET active=true WHERE id=$1',[stationA]);}
 await expect(401,'GET','/api/auth/me',undefined,fresh);
 const tokens=[];for(let i=0;i<6;i++)tokens.push(await login(inspector));
 await expect(401,'GET','/api/auth/me',undefined,tokens[0]);
 await expect(200,'GET','/api/auth/me',undefined,tokens[5]);
 assert.equal(Number((await one(owner,'SELECT count(*) n FROM vw.sessions WHERE user_id=$1',[inspector.id])).n),5);
});
test('hardening: persistent per-account failed login throttle and reset recovery',async()=>{
 for(let i=0;i<5;i++)await expect(401,'POST','/api/auth/login',{username:recordsB.username,password:'wrong'});
 const locked=await one(owner,'SELECT failed_login_count,login_blocked_until>now() AS blocked FROM vw.users WHERE id=$1',[recordsB.id]);
 assert.equal(locked.failed_login_count,5);assert.equal(locked.blocked,true);
 await expect(401,'POST','/api/auth/login',{username:recordsB.username,password});
 await owner.query("UPDATE vw.users SET login_blocked_until=now()-interval '1 second' WHERE id=$1",[recordsB.id]);
 await expect(401,'POST','/api/auth/login',{username:recordsB.username,password:'wrong'});
 assert.equal((await one(owner,'SELECT failed_login_count FROM vw.users WHERE id=$1',[recordsB.id])).failed_login_count,1);
 await login(recordsB);
 assert.equal((await one(owner,'SELECT failed_login_count FROM vw.users WHERE id=$1',[recordsB.id])).failed_login_count,0);
});
test('MFA, browser cookie, origin checks and scoped dashboard',async()=>{
 const u=await makeUser('station',stationB);
 await expect(401,'POST','/api/auth/login',{username:u.username,password});
 const secret=newSecret();await owner.query('UPDATE vw.users SET mfa_secret_cipher=$1 WHERE id=$2',[seal(secret,key,u.id),u.id]);
 const payload={username:u.username,password,otp:totp(secret,Math.floor(Date.now()/30000))};
 const headers={'Content-Type':'application/json','Origin':'http://127.0.0.1:3000','X-VW-Browser':'1'};
 const request=(path,opts={})=>fetch(api+path,{...opts,signal:AbortSignal.timeout(20000)});
 let res=await request('/api/browser/login',{method:'POST',headers:{...headers,Origin:'https://example.invalid'},body:JSON.stringify(payload)});assert.equal(res.status,403);
 res=await request('/api/browser/login',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(res.status,200);
 const data=await res.json();assert.equal(data.token,undefined);assert.equal(data.user.role,'station');
 const set=res.headers.get('set-cookie');assert.match(set,/HttpOnly/i);assert.match(set,/SameSite=Strict/i);
 const cookie=set.split(';')[0];
 res=await request('/api/dashboard',{headers:{Cookie:cookie}});assert.equal(res.status,200);const dash=await res.json();assert.equal(dash.stations.length,1);assert.equal(dash.stations[0].id,stationB);assert.equal(dash.capabilities.registry,true);
 await expect(401,'POST','/api/auth/login',payload);
 res=await request('/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://example.invalid','X-VW-Browser':'1'}});assert.equal(res.status,403);
 res=await request('/api/auth/logout',{method:'POST',headers:{...headers,Cookie:cookie}});assert.equal(res.status,200);assert.match(res.headers.get('set-cookie'),/Expires=/i);
 res=await request('/api/dashboard',{headers:{Cookie:cookie}});assert.equal(res.status,401);
 const page=await request('/workspace/');assert.equal(page.status,200);assert.match(await page.text(),/VesselWatch/);
});
test.after(async()=>{await owner.end();await runtime.end();});
