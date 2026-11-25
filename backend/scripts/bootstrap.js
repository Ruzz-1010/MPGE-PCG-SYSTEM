import 'dotenv/config';
import pg from 'pg';
import {hashPassword} from '../src/passwords.js';
const username=(process.env.BOOTSTRAP_USERNAME??'').trim().toLowerCase();
const name=(process.env.BOOTSTRAP_NAME??'').trim();
if(!/^[a-z0-9._-]{3,64}$/.test(username)||!name||name.length>120||!process.env.MIGRATION_DATABASE_URL)throw new Error('Set bootstrap username, name and migration database URL');
const hash=await hashPassword(process.env.BOOTSTRAP_PASSWORD);
const db=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});
await db.connect();
try{
 await db.query('BEGIN');
 await db.query('SELECT pg_advisory_xact_lock(71829302)');
 const r=await db.query("SELECT id FROM vw.users WHERE role='regional' LIMIT 1");
 if(r.rowCount)throw new Error('Regional account already exists; bootstrap is initial setup only');
 const u=(await db.query("INSERT INTO vw.users(username,full_name,password_hash,role,must_change_password) VALUES($1,$2,$3,'regional',false) RETURNING id",[username,name,hash])).rows[0];
 await db.query("INSERT INTO vw.audit_events(actor_id,action,resource_type,resource_id,outcome) VALUES($1,'bootstrap','user',$1::text,'success')",[u.id]);
 await db.query('COMMIT');console.log('Initial demo regional account created');
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
