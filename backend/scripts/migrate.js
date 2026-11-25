import 'dotenv/config';
import pg from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(!process.env.MIGRATION_DATABASE_URL)throw new Error('MIGRATION_DATABASE_URL is required');
const db=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});
await db.connect();
try{
 await db.query('SELECT pg_advisory_lock(71829301)');
 await db.query('CREATE TABLE IF NOT EXISTS public.vesselwatch_migrations (filename text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz DEFAULT now())');
 const dir=new URL('../migrations/',import.meta.url);
 for(const name of (await readdir(dir)).filter(x=>/^\d+_.*\.sql$/.test(x)).sort()){
  const sql=await readFile(new URL(name,dir),'utf8');
  const checksum=createHash('sha256').update(sql).digest('hex');
  const existing=(await db.query('SELECT checksum FROM public.vesselwatch_migrations WHERE filename=$1',[name])).rows[0];
  if(existing){if(existing.checksum!==checksum)throw new Error('Applied migration was edited: '+name);continue;}
  await db.query('BEGIN');
  try{await db.query(sql);await db.query('INSERT INTO public.vesselwatch_migrations(filename,checksum) VALUES($1,$2)',[name,checksum]);await db.query('COMMIT');console.log('Applied '+name);}
  catch(e){await db.query('ROLLBACK');throw e;}
 }
}finally{await db.end();}
