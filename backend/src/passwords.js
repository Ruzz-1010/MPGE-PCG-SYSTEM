import {randomBytes,scrypt as derive,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt = promisify(derive);
const options = {N:32768,r:8,p:3,maxmem:64*1024*1024};
export function validPassword(p){return typeof p==='string' && p.length>=14 && p.length<=128 && Buffer.byteLength(p)<=512;}
export async function hashPassword(p){
 if(!validPassword(p)) throw new Error('Password must be 14–128 characters (max 512 bytes)');
 const salt=randomBytes(16);
 const key=await scrypt(p,salt,64,options);
 return 'scrypt-v1:'+salt.toString('hex')+':'+key.toString('hex');
}
export async function verifyPassword(p,hash){
 if(typeof p!=='string'||Buffer.byteLength(p)>512||typeof hash!=='string')return false;
 const [v,s,k]=hash.split(':');
 if(v!=='scrypt-v1'||!s||!k||!/^[a-f0-9]{32}$/.test(s)||!/^[a-f0-9]{128}$/.test(k))return false;
 const key=await scrypt(p,Buffer.from(s,'hex'),64,options);
 return timingSafeEqual(key,Buffer.from(k,'hex'));
}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
