// Binary transfer and image preview; no credentials or private files persisted in browser storage.
export function uploadFile(path,file,metadata,onProgress=()=>{}){
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('POST','/api/'+path);xhr.timeout=60000;
  xhr.setRequestHeader('Content-Type','application/octet-stream');
  xhr.setRequestHeader('X-VW-Browser','1');
  xhr.setRequestHeader('X-VW-Metadata',encodeURIComponent(JSON.stringify({...metadata,filename:file.name})));
  xhr.upload.onprogress=e=>onProgress(e.lengthComputable?Math.round(e.loaded/e.total*100):null);
  xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{data={error:'Invalid server response'};}
   if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(Object.assign(new Error(data.error??'Upload failed'),{status:xhr.status}));
  };
  xhr.onerror=xhr.ontimeout=xhr.onabort=()=>reject(new Error('Upload not confirmed. Check the record before retrying.'));
  xhr.send(file);
 });
}
export function fileControls(file,{node,button,handle,alive=()=>true}){
 const wrap=node('div',undefined,'fileControls');
 if(!file){wrap.append(node('small','No file recorded.'));return wrap;}
 wrap.append(node('p',file.original_name+' · '+Math.ceil(Number(file.byte_size)/1024)+' KiB · '+file.scan_state));
 if(file.scan_state!=='accepted')return wrap;
 const actions=node('div',undefined,'actions');
 const get=async()=>{const r=await fetch('/api/files/'+encodeURIComponent(file.id),{credentials:'same-origin',cache:'no-store'});
  if(!r.ok){let m;try{m=(await r.json()).error;}catch{}throw Object.assign(new Error(m??'File unavailable'),{status:r.status});}return r.blob();};
 const dl=button('Download original',async()=>{dl.disabled=true;try{const blob=await get();if(!alive())return;
  const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=file.original_name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){if(alive())handle(e);}finally{dl.disabled=false;}});actions.append(dl);
 if(['image/png','image/jpeg'].includes(file.media_type)){
  const preview=button('Preview image',async()=>{preview.disabled=true;try{
   const blob=await get(),image=await createImageBitmap(new Blob([blob],{type:file.media_type}));try{if(!alive())return;
    const scale=Math.min(1,800/Math.max(image.width,image.height)),canvas=node('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.className='evidencePreview';canvas.setAttribute('aria-label','Preview of '+file.original_name);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);display.replaceChildren(canvas);
   }finally{image.close();}
  }catch(e){if(alive())handle(e);}finally{preview.disabled=false;}});
  const display=node('div');actions.append(preview,button('Hide preview',()=>display.replaceChildren()));wrap.append(actions,display);
 }else{wrap.append(actions,node('small','PDF is delivered as a private attachment; inline PDF preview is disabled.'));}
 return wrap;
}
