import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {safeName,detectType,validateFile,createStorage,sha256} from '../src/private-files.js';
import {demoPdf} from '../fixtures/demo-pdf.js';

test('file validation: actual decoding, PDF structure, extension and size gates',async()=>{
 const png=await sharp({create:{width:12,height:12,channels:3,background:'#ffffff'}}).png().toBuffer();
 assert.equal(detectType(png),'image/png');
 assert.equal((await validateFile(png,'fictional.png',{photo:true})).hash,sha256(png));
 assert.equal((await validateFile(demoPdf(),'fictional.pdf')).type,'application/pdf');
 assert.throws(()=>safeName('../outside.pdf'),e=>e.status===400);
 await assert.rejects(()=>validateFile(png,'wrong.pdf'),e=>e.status===400);
 await assert.rejects(()=>validateFile(png.subarray(0,12),'broken.png'),e=>e.status===400);
 await assert.rejects(()=>validateFile(Buffer.from('%PDF-1.4\nnot-a-document'),'broken.pdf'),e=>e.status===400);
 await assert.rejects(()=>validateFile(demoPdf(),'photo.pdf',{photo:true}),e=>e.status===400);
 await assert.rejects(()=>validateFile(Buffer.alloc(10*1024*1024+1),'large.jpg',{photo:true}),e=>e.status===413);
});
test('private storage: exclusive opaque path and checksum verification',async()=>{
 const root=await mkdtemp(join(tmpdir(),'vw-storage-test-')),pub=join(root,'web'),dir=join(root,'private');
 try{
  await mkdir(pub);
  const store=await createStorage(dir,pub);
  await assert.rejects(()=>createStorage(join(pub,'bad'),pub));
  const bytes=await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).png().toBuffer(),meta=await validateFile(bytes,'photo.png');
  let row;
  const client={query:async(_sql,p)=>{row={id:'fixture',storage_key:p[0],original_name:p[1],media_type:p[2],byte_size:p[3],sha256:p[4],scan_state:'accepted'};return {rows:[row]};}};
  await store.store(client,{id:'synthetic'},bytes,meta);
  assert.deepEqual((await store.read(row)).bytes,bytes);
  await writeFile(join(dir,row.storage_key),Buffer.alloc(bytes.length,7));
  await assert.rejects(()=>store.read(row),e=>e.status===409);
  await assert.rejects(()=>store.read({...row,storage_key:'../web/index.html'}),e=>e.status===409);
 }finally{await rm(root,{recursive:true,force:true});}
});
