import express from 'express';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {privileged,readKey,unseal,verifyTotp} from './mfa.js';
import {pool,tx,audit} from './db.js';
import {hashPassword,verifyPassword,validPassword,tokenHash,newToken} from './passwords.js';
import {roles,isUuid,canReadVessels,canWriteVessels,stationScope,canManage,canReadAudit} from './policy.js';
const app=express();
app.disable('x-powered-by');
if(process.env.TRUST_LOCAL_PROXY==='1')app.set('trust proxy','loopback');
const mfaKey=readKey(process.env.VW_MFA_KEY);
const localDemo=process.env.VW_LOCAL_HTTP==='1';
const browserOrigin=new URL(process.env.VW_BROWSER_ORIGIN??'https://localhost').origin;
if(localDemo&&browserOrigin!=='http://127.0.0.1:3000')throw Error('HTTP demo must use the loopback browser origin');
if(!localDemo&&!browserOrigin.startsWith('https://'))throw Error('HTTPS browser origin required');
const cookieName=localDemo?'vw_demo_session':'__Host-vw_session';
const cookieOptions={httpOnly:true,secure:!localDemo,sameSite:'strict',path:'/'};
app.use(helmet({strictTransportSecurity:localDemo?false:undefined,contentSecurityPolicy:{directives:{upgradeInsecureRequests:localDemo?null:[]}}}));
const browserToken=q=>{
 const values=(q.get('cookie')??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));
 if(values.length!==1)return null;
 const t=values[0].slice(cookieName.length+1);
 return /^[a-f0-9]{64}$/.test(t)?t:null;
};
const sameOrigin=q=>q.get('origin')===browserOrigin && !['cross-site','same-site'].includes(q.get('sec-fetch-site'));
const browserMutation=(q,r,n)=>{
 if(!sameOrigin(q)||q.get('x-vw-browser')!=='1')return r.status(403).json({error:'Browser origin validation failed'});
 if(!localDemo&&!q.secure)return r.status(403).json({error:'HTTPS required'});
 n();
};
app.use('/api',(q,r,n)=>{
 if(browserToken(q)&&!['GET','HEAD','OPTIONS'].includes(q.method))return browserMutation(q,r,n);
 n();
});
app.use(express.json({limit:'32kb'}));
app.use('/api',(_q,r,n)=>{r.set('Cache-Control','no-store');n();});
const error=(status,message)=>Object.assign(new Error(message),{status});
const fail=(status,message)=>{throw error(status,message);};
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max||/[\u0000-\u001f\u007f]/u.test(v))fail(400,'Invalid text field');return v.trim();};
const uuid=v=>{if(!isUuid(v))fail(400,'Invalid identifier');return v.toLowerCase();};
const page=q=>{if(q!==undefined&&(typeof q!=='string'||!/^\d{1,5}$/.test(q)))fail(400,'Invalid page');const n=Number(q??1);if(!Number.isSafeInteger(n)||n<1||n>10000)fail(400,'Invalid page');return (n-1)*50;};
const body=(q,allowed)=>{if(!q.is('application/json')||!q.body||typeof q.body!=='object'||Array.isArray(q.body))fail(400,'JSON object required');if(Object.keys(q.body).some(k=>!allowed.includes(k)))fail(400,'Unexpected request field');return q.body;};
const publicUser='id,username,full_name,role,station_id,active,must_change_password';
const publicVessel='id,internal_id,name,official_registration,owner_operator,vessel_type,station_id,profile_status,version,created_at,updated_at';
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false,message:{error:'Too many sign-in attempts. Try again later.'}});
const changeLimiter=rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:true,legacyHeaders:false,message:{error:'Too many password change attempts. Try again later.'}});
const stationActive=async(c,u)=>u.station_id===null||Boolean((await c.query('SELECT id FROM vw.stations WHERE id=$1 AND active',[u.station_id])).rowCount);
const dummyHash=await hashPassword(randomBytes(32).toString('hex'));
app.get('/api/health',async(_q,r)=>{try{await pool.query('SELECT 1');r.json({status:'ok'});}catch{r.status(503).json({status:'unavailable'});}});
const login=async(q,r)=>{
 const b=body(q,['username','password','otp']),username=text(b.username,64).toLowerCase();
 if(!/^[a-z0-9._-]{3,64}$/.test(username))fail(400,'Invalid credentials');
 if(typeof b.password!=='string'||Buffer.byteLength(b.password)>512)fail(400,'Invalid credentials');
 const result=await tx(async c=>{
  const u=(await c.query('SELECT *,login_blocked_until>clock_timestamp() AS login_blocked FROM vw.users WHERE username=$1 FOR UPDATE',[username])).rows[0];
  const eligible=u&&u.active&&!u.login_blocked&&await stationActive(c,u);
  // A generic response and similar password work for unknown, disabled and locked accounts.
  const valid=await verifyPassword(b.password,eligible?u.password_hash:dummyHash);
  const step=eligible&&valid&&privileged(u.role)&&u.mfa_secret_cipher?verifyTotp(unseal(u.mfa_secret_cipher,mfaKey,u.id),b.otp,u.mfa_last_step):null;
  if(!eligible||!valid||(privileged(u.role)&&step===null)){
   if(eligible)await c.query(`UPDATE vw.users SET
    failed_login_count=CASE WHEN login_blocked_until IS NOT NULL AND login_blocked_until<=clock_timestamp() THEN 1 ELSE LEAST(failed_login_count+1,5) END,
    login_blocked_until=CASE WHEN (login_blocked_until IS NULL AND failed_login_count>=4) THEN clock_timestamp()+interval '15 minutes' ELSE NULL END
    WHERE id=$1`,[u.id]);
   await audit(c,u,'login','session',null,'denied');return null;
  }
  if(step!==null)await c.query('UPDATE vw.users SET mfa_last_step=$1 WHERE id=$2',[step,u.id]);
  const token=newToken();
  await c.query('UPDATE vw.users SET failed_login_count=0,login_blocked_until=NULL WHERE id=$1',[u.id]);
  await c.query("DELETE FROM vw.sessions WHERE user_id=$1 AND (expires_at<=clock_timestamp() OR last_seen_at<=clock_timestamp()-interval '30 minutes')",[u.id]);
  await c.query("DELETE FROM vw.sessions WHERE token_hash IN (SELECT token_hash FROM vw.sessions WHERE user_id=$1 ORDER BY created_at DESC,token_hash OFFSET 4)",[u.id]);
  await c.query("INSERT INTO vw.sessions(token_hash,user_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '8 hours')",[tokenHash(token),u.id]);
  await audit(c,u,'login','session');
  return {token,user:{id:u.id,username:u.username,role:u.role,station_id:u.station_id,must_change_password:u.must_change_password}};
 });
 if(!result)fail(401,'Invalid credentials');
 if(q.path==='/api/browser/login'){r.cookie(cookieName,result.token,{...cookieOptions,maxAge:8*60*60*1000});return r.json({user:result.user});}
 r.json(result);
};
app.post('/api/auth/login',loginLimiter,login);
app.post('/api/browser/login',browserMutation,loginLimiter,login);
// Serialize requests for the same account and recheck session state after acquiring the account lock.
const protectedRoute=(action,handler,{allowChange=false}={})=>async(q,r)=>{
 const match=/^Bearer ([a-f0-9]{64})$/.exec(q.get('authorization')??'');
 const cookie=browserToken(q);
 if(cookie&&q.get('authorization'))fail(400,'Ambiguous credentials');
 const token=cookie??match?.[1];
 if(!token)fail(401,'Authentication required');
 if(cookie&&!localDemo&&!q.secure)fail(403,'HTTPS required');
 const key=tokenHash(token);
 const result=await tx(async c=>{
  const u=(await c.query('SELECT u.* FROM vw.users u JOIN vw.sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active FOR UPDATE OF u',[key])).rows[0];
  if(!u||!(await c.query("SELECT 1 FROM vw.sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>clock_timestamp() AND last_seen_at>clock_timestamp()-interval '30 minutes'",[key,u.id])).rowCount)return {status:401,data:{error:'Authentication required'}};
  if(privileged(u.role)&&!u.mfa_secret_cipher){await c.query('DELETE FROM vw.sessions WHERE user_id=$1',[u.id]);return {status:401,data:{error:'Authentication required'}};}
  if(!await stationActive(c,u)){await c.query('DELETE FROM vw.sessions WHERE user_id=$1',[u.id]);await audit(c,u,action,'request',null,'denied',{reason:'station_inactive'});return {status:403,data:{error:'Station unavailable'}};}
  await c.query('UPDATE vw.sessions SET last_seen_at=clock_timestamp() WHERE token_hash=$1',[key]);
  if(u.must_change_password&&!allowChange){await audit(c,u,action,'request',null,'denied');return {status:403,data:{error:'Change password first'}};}
  await c.query('SAVEPOINT action');
  try{return await handler(c,u,q,key);}
  catch(e){
   if(e.status&&e.status<500){await c.query('ROLLBACK TO SAVEPOINT action');await audit(c,u,action,'request',null,e.status===403||e.status===404?'denied':'failure');return {status:e.status,data:{error:e.message}};}
   throw e;
  }
 });
 if(cookie&&(result.status===401||((result.status??200)<400&&['logout','password.change'].includes(action))))r.clearCookie(cookieName,cookieOptions);
 r.status(result.status??200).json(result.data);
};
const ok=data=>({data});
app.get('/api/auth/me',protectedRoute('account.read',async(c,u)=>{await audit(c,u,'account.read','user',u.id);return ok({id:u.id,username:u.username,full_name:u.full_name,role:u.role,station_id:u.station_id,must_change_password:u.must_change_password});},{allowChange:true}));
app.post('/api/auth/logout',protectedRoute('logout',async(c,u,q,key)=>{await c.query('DELETE FROM vw.sessions WHERE token_hash=$1',[key]);await audit(c,u,'logout','session');return ok({logged_out:true});},{allowChange:true}));
app.post('/api/auth/change-password',changeLimiter,protectedRoute('password.change',async(c,u,q)=>{
 const b=body(q,['currentPassword','newPassword']);
 if(!validPassword(b.newPassword)||!await verifyPassword(b.currentPassword,u.password_hash)||b.currentPassword===b.newPassword)fail(400,'Current password incorrect or new password invalid');
 await c.query('UPDATE vw.users SET password_hash=$1,must_change_password=false,failed_login_count=0,login_blocked_until=NULL WHERE id=$2',[await hashPassword(b.newPassword),u.id]);
 await c.query('DELETE FROM vw.sessions WHERE user_id=$1',[u.id]);
 await audit(c,u,'password.change','user',u.id);return ok({changed:true,login_required:true});
},{allowChange:true}));
app.get('/api/dashboard',protectedRoute('dashboard.read',async(c,u)=>{
 const global=['regional','technical'].includes(u.role);
 const stations=(await c.query('SELECT id,code,name,active FROM vw.stations WHERE ($1::boolean OR id=$2::uuid) ORDER BY code',[global,u.station_id])).rows;
 const metrics={stations:stations.length};
 if(canReadVessels(u)){const counts=(await c.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE profile_status='active')::int AS active FROM vw.vessels WHERE ($1::boolean OR station_id=$2::uuid)",[u.role==='regional',u.station_id])).rows[0];metrics.vessels=counts.total;metrics.activeVessels=counts.active;}
 if(['regional','station'].includes(u.role))metrics.accounts=(await c.query('SELECT count(*)::int AS total FROM vw.users WHERE ($1::boolean OR station_id=$2::uuid)',[u.role==='regional',u.station_id])).rows[0].total;
 await audit(c,u,'dashboard.read','dashboard');return ok({role:u.role,scope:global?'regional':'station',stations,metrics,capabilities:{registry:canReadVessels(u),writeRegistry:canWriteVessels(u),accounts:['regional','station'].includes(u.role),audit:canReadAudit(u)}});
}));
app.get('/api/stations',protectedRoute('stations.list',async(c,u)=>{
 const global=['regional','technical'].includes(u.role);
 const rows=(await c.query('SELECT id,code,name,active FROM vw.stations WHERE ($1::boolean OR id=$2::uuid) ORDER BY code',[global,u.station_id])).rows;
 await audit(c,u,'stations.list','station');return ok(rows);
}));
app.get('/api/users',protectedRoute('users.list',async(c,u,q)=>{
 if(!['regional','station'].includes(u.role))fail(403,'Forbidden');
 const rows=(await c.query('SELECT '+publicUser+' FROM vw.users WHERE ($1::boolean OR station_id=$2::uuid) ORDER BY username LIMIT 50 OFFSET $3',[u.role==='regional',u.station_id,page(q.query.page)])).rows;
 await audit(c,u,'users.list','user');return ok(rows);
}));
app.post('/api/users',protectedRoute('users.create',async(c,u,q)=>{
 const b=body(q,['username','fullName','role','stationId','password']),username=text(b.username,64).toLowerCase(),fullName=text(b.fullName,120);
 if(!/^[a-z0-9._-]{3,64}$/.test(username)||!roles.includes(b.role)||!validPassword(b.password))fail(400,'Invalid account details');
 if(['regional','technical'].includes(b.role)&&b.stationId!=null)fail(400,'Regional and technical accounts cannot have station assignments');
 const station=['regional','technical'].includes(b.role)?null:uuid(b.stationId);
 if(!canManage(u,{role:b.role,station_id:station}))fail(403,'Forbidden');
 if(station&&!(await c.query('SELECT id FROM vw.stations WHERE id=$1 AND active',[station])).rowCount)fail(400,'Invalid station');
 const row=(await c.query('INSERT INTO vw.users(username,full_name,password_hash,role,station_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(username) DO NOTHING RETURNING '+publicUser,[username,fullName,await hashPassword(b.password),b.role,station])).rows[0];
 if(!row)fail(409,'Account cannot be created');
 await audit(c,u,'users.create','user',row.id);return {status:201,data:row};
}));
app.patch('/api/users/:id',protectedRoute('users.update',async(c,u,q)=>{
 const id=uuid(q.params.id),b=body(q,['active','resetPassword']);
 const target=(await c.query('SELECT '+publicUser+' FROM vw.users WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(!target||!canManage(u,target))fail(404,'Account not available');
 if(typeof b.active!=='boolean'&&b.resetPassword===undefined)fail(400,'No supported changes');
 if(b.active!==undefined&&typeof b.active!=='boolean')fail(400,'Invalid account status');
 if(b.resetPassword!==undefined&&!validPassword(b.resetPassword))fail(400,'Invalid reset password');
 const hash=b.resetPassword===undefined?null:await hashPassword(b.resetPassword);
 const row=(await c.query('UPDATE vw.users SET active=COALESCE($1,active),password_hash=COALESCE($2,password_hash),must_change_password=CASE WHEN $2::text IS NULL THEN must_change_password ELSE true END,failed_login_count=CASE WHEN $2::text IS NULL THEN failed_login_count ELSE 0 END,login_blocked_until=CASE WHEN $2::text IS NULL THEN login_blocked_until ELSE NULL END WHERE id=$3 RETURNING '+publicUser,[b.active??null,hash,id])).rows[0];
 await c.query('DELETE FROM vw.sessions WHERE user_id=$1',[id]);
 await audit(c,u,'users.update','user',id,'success',{active:row.active,password_reset:hash!==null});return ok(row);
}));
app.get('/api/vessels',protectedRoute('vessels.list',async(c,u,q)=>{
 if(!canReadVessels(u))fail(403,'Forbidden');
 const search=q.query.q===undefined?'':typeof q.query.q==='string'&&q.query.q.length<=180&&!/[\u0000-\u001f\u007f]/u.test(q.query.q)?q.query.q:fail(400,'Invalid search');
 const station=q.query.stationId===undefined?null:uuid(q.query.stationId);
 if(station&&!stationScope(u,station))fail(403,'Forbidden');
 const rows=(await c.query('SELECT '+publicVessel+' FROM vw.vessels WHERE ($1::boolean OR station_id=$2::uuid) AND ($3::uuid IS NULL OR station_id=$3) AND (strpos(lower(name),lower($4))>0 OR strpos(lower(official_registration),lower($4))>0 OR strpos(lower(internal_id),lower($4))>0 OR $4=\'\') ORDER BY name,id LIMIT 50 OFFSET $5',[u.role==='regional',u.station_id,station,search,page(q.query.page)])).rows;
 await audit(c,u,'vessels.list','vessel');return ok(rows);
}));
app.get('/api/vessels/:id',protectedRoute('vessels.read',async(c,u,q)=>{
 if(!canReadVessels(u))fail(403,'Forbidden');
 const id=uuid(q.params.id);
 const row=(await c.query('SELECT '+publicVessel+' FROM vw.vessels WHERE id=$1 AND ($2::boolean OR station_id=$3::uuid)',[id,u.role==='regional',u.station_id])).rows[0];
 if(!row)fail(404,'Vessel not available');
 await audit(c,u,'vessels.read','vessel',id);return ok(row);
}));
const vesselInput=b=>[text(b.name,180),text(b.officialRegistration,100),text(b.ownerOperator,180),text(b.vesselType,100)];
async function checkDuplicate(c,u,name,registration,id){
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended(lower(btrim($1)),71829303))',[name]);
 const registrationMatch=(await c.query('SELECT id FROM vw.vessels WHERE lower(btrim(official_registration))=lower(btrim($1)) AND ($2::uuid IS NULL OR id<>$2) LIMIT 1',[registration,id])).rowCount;
 const nameMatch=(await c.query('SELECT id FROM vw.vessels WHERE lower(btrim(name))=lower(btrim($1)) AND ($2::uuid IS NULL OR id<>$2) LIMIT 1',[name,id])).rowCount;
 if(registrationMatch||nameMatch)fail(409,'Potential duplicate requires authorized review; no record changed');
}
async function snapshot(c,row,u){
 await c.query('INSERT INTO vw.vessel_versions(vessel_id,version,snapshot,changed_by) VALUES($1,$2,$3,$4)',[row.id,row.version,JSON.stringify(row),u.id]);
}
app.post('/api/vessels',protectedRoute('vessels.create',async(c,u,q)=>{
 if(!canWriteVessels(u))fail(403,'Forbidden');
 const b=body(q,['name','officialRegistration','ownerOperator','vesselType','stationId']),v=vesselInput(b);
 if(b.stationId!==undefined&&uuid(b.stationId)!==u.station_id)fail(403,'Forbidden');
 if(!(await c.query('SELECT id FROM vw.stations WHERE id=$1 AND active',[u.station_id])).rowCount)fail(403,'Station unavailable');
 await checkDuplicate(c,u,v[0],v[1],null);
 const row=(await c.query('INSERT INTO vw.vessels(name,official_registration,owner_operator,vessel_type,station_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6) ON CONFLICT DO NOTHING RETURNING '+publicVessel,[...v,u.station_id,u.id])).rows[0];
 if(!row)fail(409,'Potential duplicate requires authorized review');
 await snapshot(c,row,u);await audit(c,u,'vessels.create','vessel',row.id);return {status:201,data:row};
}));
app.put('/api/vessels/:id',protectedRoute('vessels.update',async(c,u,q)=>{
 if(!canWriteVessels(u))fail(403,'Forbidden');
 const id=uuid(q.params.id),b=body(q,['name','officialRegistration','ownerOperator','vesselType','stationId','version','profileStatus']),v=vesselInput(b);
 if(!Number.isInteger(b.version)||b.version<1)fail(400,'Record version required');
 const current=(await c.query('SELECT '+publicVessel+' FROM vw.vessels WHERE id=$1 AND station_id=$2 FOR UPDATE',[id,u.station_id])).rows[0];
 if(!current)fail(404,'Vessel not available');
 if(current.version!==b.version)fail(409,'Record changed; refresh before editing');
 if(b.stationId!==undefined&&uuid(b.stationId)!==u.station_id)fail(403,'Forbidden');
 if(!['active','inactive'].includes(b.profileStatus))fail(400,'Invalid profile status');
 if(v[0].toLowerCase()!==current.name.toLowerCase()||v[1].toLowerCase()!==current.official_registration.toLowerCase())await checkDuplicate(c,u,v[0],v[1],id);
 let row;
 try{row=(await c.query('UPDATE vw.vessels SET name=$1,official_registration=$2,owner_operator=$3,vessel_type=$4,profile_status=$5,version=version+1,updated_at=now(),updated_by=$6 WHERE id=$7 RETURNING '+publicVessel,[...v,b.profileStatus,u.id,id])).rows[0];}
 catch(e){if(e.code==='23505')fail(409,'Potential duplicate requires authorized review');throw e;}
 await snapshot(c,row,u);await audit(c,u,'vessels.update','vessel',id,'success',{version:row.version});return ok(row);
}));
app.get('/api/audit',protectedRoute('audit.list',async(c,u,q)=>{
 if(!canReadAudit(u))fail(403,'Forbidden');
 const rows=(await c.query('SELECT id,actor_id,station_id,action,resource_type,resource_id,outcome,detail,recorded_at FROM vw.audit_events ORDER BY recorded_at DESC,id DESC LIMIT 50 OFFSET $1',[page(q.query.page)])).rows;
 await audit(c,u,'audit.list','audit');return ok(rows);
}));
app.use('/workspace',express.static(fileURLToPath(new URL('../web/',import.meta.url)),{index:'index.html',maxAge:0,setHeaders:r=>r.set('Cache-Control','no-store')}));
app.get('/',(_q,r)=>r.redirect('/workspace/'));
app.use((_q,r)=>r.status(404).json({error:'Not found'}));
app.use((e,_q,r,_n)=>{
 const status=e.status>=400&&e.status<500?e.status:500;
 if(['40P01','40001','55P03'].includes(e.code))return r.status(409).json({error:'Concurrent change; retry the request'});
 if(status===500)console.error('Request failed',e.code??e.name);
 r.status(status).json({error:status===500?'Internal server error':e.type==='entity.parse.failed'?'Invalid JSON':e.message});
});
// Refuse to run the application using an owner/superuser or an unexpected role.
const runtime=(await pool.query('SELECT current_user AS name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user')).rows[0];
const owner=(await pool.query("SELECT pg_has_role(current_user,nspowner,'MEMBER') AS member FROM pg_namespace WHERE nspname='vw'")).rows[0];
if(!runtime||runtime.name!=='vesselwatch_app'||runtime.rolsuper||runtime.rolbypassrls||runtime.rolcreaterole||runtime.rolcreatedb||!owner||owner.member){await pool.end();throw Error('Unsafe database runtime role; expected restricted vesselwatch_app');}
const server=app.listen(Number(process.env.PORT??3000),process.env.HOST??'127.0.0.1',()=>console.log('VesselWatch Phase 1 API listening'));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
