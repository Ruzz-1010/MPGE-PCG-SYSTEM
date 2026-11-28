import {mkdir,lstat,open,unlink,mkdtemp,rm,writeFile,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,isAbsolute,join,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';

const run=promisify(execFile);
const MAX=20*1024*1024;
export const sha256=b=>createHash('sha256').update(b).digest('hex');
const error=(status,message)=>Object.assign(new Error(message),{status});
export const safeName=v=>{
 if(typeof v!=='string'||!v.trim()||v.length>180||/[\u0000-\u001f\u007f/\\]/u.test(v)||v==='.'||v==='..')throw error(400,'Invalid file name');
 return v.trim();
};
export function detectType(b){
 if(!Buffer.isBuffer(b)||b.length<8)return null;
 if(b.subarray(0,5).toString('ascii')==='%PDF-')return 'application/pdf';
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 return null;
}
export async function validateFile(b,name,{photo=false}={}){
 const filename=safeName(name);
 if(!Buffer.isBuffer(b)||!b.length||b.length>(photo?10*1024*1024:MAX))throw error(413,'File exceeds the permitted size');
 const type=detectType(b),ext=filename.toLowerCase().split('.').pop();
 if(!type||!(type==='application/pdf'?ext==='pdf':type==='image/png'?ext==='png':['jpg','jpeg'].includes(ext))||(photo&&type==='application/pdf'))throw error(400,'Permitted file type and matching extension required');
 if(type==='application/pdf'){
  const dir=await mkdtemp(join(tmpdir(),'vw-pdf-')),path=join(dir,'input.pdf');
  try{
   await writeFile(path,b,{mode:0o600,flag:'wx'});
   const opt={timeout:8000,maxBuffer:65536,windowsHide:true};
   const enc=await run('qpdf',['--show-encryption',path],opt);
   if(!enc.stdout.includes('File is not encrypted'))throw Error('Encrypted PDF');
   await run('qpdf',['--check',path],opt);
  }catch(e){if(e.code==='ENOENT')throw error(503,'PDF validator unavailable');throw error(400,'PDF structural validation failed or document is encrypted');}
  finally{await rm(dir,{recursive:true,force:true});}
 }else{
  try{
   const image=sharp(b,{limitInputPixels:16000000,failOn:'warning',animated:false});
   const m=await image.metadata();
   if(!m.width||!m.height||m.width*m.height>16000000||(m.pages??1)>1||m.format!==(type==='image/png'?'png':'jpeg'))throw Error('Unsupported image');
   await image.raw().toBuffer(); // full decode; do not modify original evidence
  }catch{throw error(400,'Image content validation failed');}
 }
 return {name:filename,type,size:b.length,hash:sha256(b)};
}
export async function createStorage(directory,publicDir){
 if(!directory||!isAbsolute(directory))throw Error('VW_PRIVATE_DIR must be absolute');
 const root=resolve(directory),pub=resolve(publicDir);
 const rel=relative(pub,root),reverse=relative(root,pub);
 const inside=r=>r===''||(!r.startsWith('..')&&!isAbsolute(r));
 if(inside(rel)||inside(reverse))throw Error('Private storage must be separate from web assets');
 await mkdir(root,{recursive:true,mode:0o700});
 const actual=await realpath(root),publicActual=await realpath(pub);
 if(inside(relative(publicActual,actual))||inside(relative(actual,publicActual)))throw Error('Resolved private storage overlaps web assets');
 const st=await lstat(root);if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0)throw Error('Private storage requires a private non-symlink directory (0700)');
 const pathFor=k=>{if(typeof k!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(k))throw Error('Invalid storage key');return join(root,k);};
 return {
  async store(c,u,b,meta){
   const key=randomUUID(),path=pathFor(key);
   const f=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
   try{await f.writeFile(b);await f.sync();}catch(e){await f.close();await unlink(path).catch(()=>{});throw e;}await f.close();
   const d=await open(root,constants.O_RDONLY|constants.O_DIRECTORY);try{await d.sync();}finally{await d.close();}
   // If SQL/commit later fails, retain the unreferenced blob for controlled orphan reconciliation.
   // Never delete a potentially committed file after an ambiguous network/commit failure.
   return (await c.query("INSERT INTO vw.private_files(storage_key,original_name,media_type,byte_size,sha256,scan_state,uploaded_by) VALUES($1,$2,$3,$4,$5,'accepted',$6) RETURNING id,original_name,media_type,byte_size,sha256,scan_state,created_at",[key,meta.name,meta.type,meta.size,meta.hash,u.id])).rows[0];
  },
  async read(row){
   if(row.scan_state!=='accepted')throw error(409,'File unavailable for download');
   let f;
   try{
    f=await open(pathFor(row.storage_key),constants.O_RDONLY|constants.O_NOFOLLOW);
    const st=await f.stat();
    if(!st.isFile()||st.size!==Number(row.byte_size)||st.size>MAX)throw Error('File size mismatch');
    const bytes=await f.readFile();
    if(bytes.length!==Number(row.byte_size)||sha256(bytes)!==row.sha256)throw Error('File integrity mismatch');
    return {bytes,name:row.original_name,type:row.media_type};
   }catch{throw error(409,'File unavailable or integrity check failed');}finally{await f?.close();}
  }
 };
}
