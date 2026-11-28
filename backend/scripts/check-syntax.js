import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const dir of ['src','web','scripts','fixtures','test','integration']){
 for(const name of (await readdir(dir)).filter(n=>n.endsWith('.js'))){
  const result=spawnSync(process.execPath,['--check',dir+'/'+name],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
 }
}
console.log('JavaScript syntax checks passed');
