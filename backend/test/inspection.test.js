import test from 'node:test';
import assert from 'node:assert/strict';
import {transition,canInspect,canReview} from '../src/inspection-policy.js';
test('inspection transition policy separates ownership and review',()=>{
 assert.equal(transition('draft','save',true,false),'draft');
 assert.equal(transition('draft','submit',true,false),'submitted');
 assert.equal(transition('submitted','return',false,true),'returned');
 assert.equal(transition('returned','save',true,false),'draft');
 assert.equal(transition('returned','submit',true,false),'submitted');
 assert.equal(transition('submitted','review',false,true),'reviewed');
 assert.equal(transition('reviewed','reopen',false,true),'returned');
 assert.equal(transition('reviewed','save',true,false),null);
 assert.equal(transition('draft','review',false,true),null);
 assert.equal(transition('submitted','review',true,false),null);
 assert.equal(canInspect({role:'technical'}),false);
 assert.equal(canReview({role:'regional'}),false);
});
