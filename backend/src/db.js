import 'dotenv/config';
import pg from 'pg';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,statement_timeout:10000});
pool.on('error',()=>console.error('Idle database connection failed'));
export async function tx(fn){
 const c=await pool.connect();
 try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}
 catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function audit(c,u,action,type,id,outcome='success',detail={}){
 await c.query('INSERT INTO vw.audit_events(actor_id,station_id,action,resource_type,resource_id,outcome,detail) VALUES($1,$2,$3,$4,$5,$6,$7)',
 [u?.id??null,u?.station_id??null,action,type,id??null,outcome,JSON.stringify(detail)]);
}
