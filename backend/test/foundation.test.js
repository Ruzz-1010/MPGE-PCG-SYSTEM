import test from 'node:test';
import assert from 'node:assert/strict';
import {canReadVessels,canWriteVessels,stationScope,canManage,canReadAudit,isUuid} from '../src/policy.js';
import {hashPassword,verifyPassword,validPassword,newToken,tokenHash} from '../src/passwords.js';
test('station and role restrictions',()=>{
 const a={id:'a',role:'station',station_id:'A'};
 assert.equal(stationScope(a,'B'),false);
 assert.equal(stationScope({role:'regional',station_id:null},'B'),true);
 assert.equal(canManage(a,{id:'b',role:'inspector',station_id:'A'}),true);
 assert.equal(canManage(a,{id:'b',role:'regional',station_id:null}),false);
 assert.equal(canManage(a,{id:'b',role:'records',station_id:'B'}),false);
 assert.equal(canManage(a,a),false);
 assert.equal(canWriteVessels({role:'inspector'}),false);
 assert.equal(canReadVessels({role:'technical'}),false);
 assert.equal(canReadAudit(a),false);
 assert.equal(isUuid('not-a-uuid'),false);
});
test('password hashing and opaque token handling',async()=>{
 const p='fictional-test-password';
 assert.equal(validPassword('short'),false);
 const a=await hashPassword(p),b=await hashPassword(p);
 assert.notEqual(a,b);
 assert.equal(await verifyPassword(p,a),true);
 assert.equal(await verifyPassword('wrong',a),false);
 assert.equal(await verifyPassword(p,'bad-hash'),false);
 const token=newToken();
 assert.match(token,/^[a-f0-9]{64}$/);
 assert.notEqual(tokenHash(token),token);
});
