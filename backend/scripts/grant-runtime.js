import 'dotenv/config';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
if(!process.env.MIGRATION_DATABASE_URL)throw Error('MIGRATION_DATABASE_URL is required');
const c=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});
await c.connect();
try{
 await c.query('BEGIN');
 await c.query(await readFile(new URL('../migrations/runtime-grants.sql',import.meta.url),'utf8'));
 await c.query('COMMIT');
 console.log('Foundation runtime grants applied; future-module tables remain inaccessible');
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
