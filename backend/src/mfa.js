import {randomBytes,createCipheriv,createDecipheriv,createHmac,timingSafeEqual} from 'node:crypto';
export const privileged=role=>['regional','station','technical'].includes(role);
export const readKey=hex=>{if(typeof hex!=='string'||! /^[a-f0-9]{64}$/i.test(hex))throw Error('VW_MFA_KEY must be a random 32-byte hex key');return Buffer.from(hex,'hex');};
export function newSecret(){return randomBytes(20);}
export function base32(bytes){const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let n=0,b=0,out='';for(const byte of bytes){b=(b<<8)|byte;n+=8;while(n>=5){out+=a[(b>>>(n-5))&31];n-=5;}}if(n)out+=a[(b<<(5-n))&31];return out;}
export function seal(secret,key,id){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(id));return [iv,cipher.update(secret),cipher.final(),cipher.getAuthTag()].map(b=>b.toString('hex')).join(':');}
export function unseal(value,key,id){const [iv,body,end,tag]=value.split(':').map(x=>Buffer.from(x,'hex'));const d=createDecipheriv('aes-256-gcm',key,iv);d.setAAD(Buffer.from(id));d.setAuthTag(tag);return Buffer.concat([d.update(Buffer.concat([body,end])),d.final()]);}
export function totp(secret,step){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const h=createHmac('sha1',secret).update(counter).digest(),offset=h[h.length-1]&15;return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');}
export function verifyTotp(secret,code,lastStep=null,now=Date.now()){if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;const step=Math.floor(now/30000);for(const s of [step,step-1,step+1])if(s>=0&&(lastStep===null||s>Number(lastStep))&&timingSafeEqual(Buffer.from(totp(secret,s)),Buffer.from(code)))return s;return null;}
