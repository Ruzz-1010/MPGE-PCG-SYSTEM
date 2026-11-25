import 'dotenv/config';
import pg from 'pg';
import {privileged,readKey,newSecret,base32,seal} from '../src/mfa.js';
const username=(process.env.MFA_USERNAME??'').trim().toLowerCase();
if(!/^[a-z0-9._-]{3,64}$/.test(username)||!process.env.MIGRATION_DATABASE_URL)throw Error('Set MFA_USERNAME and migration connection');
if(!process.stdout.isTTY)throw Error('Run interactively in a private terminal; never in CI or redirected logs');
const key=readKey(process.env.VW_MFA_KEY);
const c=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});
await c.connect();
try{
 await c.query('BEGIN');
 const u=(await c.query('SELECT id,role,active,mfa_secret_cipher FROM vw.users WHERE username=$1 FOR UPDATE',[username])).rows[0];
 if(!u||!u.active||!privileged(u.role))throw Error('Active privileged account required');
 if(u.mfa_secret_cipher&&process.env.MFA_REPLACE!=='confirmed')throw Error('Existing MFA: verified local recovery requires MFA_REPLACE=confirmed');
 const secret=newSecret();
 await c.query('UPDATE vw.users SET mfa_secret_cipher=$1,mfa_last_step=NULL,failed_login_count=0,login_blocked_until=NULL WHERE id=$2',[seal(secret,key,u.id),u.id]);
 await c.query('DELETE FROM vw.sessions WHERE user_id=$1',[u.id]);
 await c.query("INSERT INTO vw.audit_events(action,resource_type,resource_id,outcome,detail) VALUES('mfa.provision','user',$1,'success',jsonb_build_object('local_operator',true,'replacement',$2::boolean))",[u.id,Boolean(u.mfa_secret_cipher)]);
 await c.query('COMMIT');
 console.log('Private authenticator setup key (never share or record in logs): '+base32(secret));
 console.log('Use time-based 6-digit codes, SHA-1, 30 seconds. Keep the key private.');
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
