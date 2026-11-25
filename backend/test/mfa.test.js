import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {totp,verifyTotp,base32,seal,unseal,readKey,privileged} from '../src/mfa.js';
test('TOTP RFC 6238 six-digit truncation, replay and encrypted binding',()=>{
 const secret=Buffer.from('12345678901234567890');
 assert.equal(totp(secret,1),'287082');
 assert.equal(verifyTotp(secret,'287082',null,59000),1);
 assert.equal(verifyTotp(secret,'287082',1,59000),null);
 assert.equal(verifyTotp(secret,'bad',null,59000),null);
 assert.equal(base32(Buffer.from('foo')),'MZXW6');
 const k=readKey(randomBytes(32).toString('hex')),id=randomUUID();
 const cipher=seal(secret,k,id);
 assert.deepEqual(unseal(cipher,k,id),secret);
 assert.throws(()=>unseal(cipher,k,randomUUID()));
 assert.equal(privileged('technical'),true);assert.equal(privileged('inspector'),false);
});
