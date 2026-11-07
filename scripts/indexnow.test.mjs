import test from 'node:test';
import assert from 'node:assert/strict';
import { changedUrls, submit } from './indexnow.mjs';

test('only new, changed and removed pages are submitted', () => {
  assert.deepEqual(changedUrls({'https://example.com/':'a','https://example.com/old/':'b','https://example.com/changed/':'old'}, {'https://example.com/':'a','https://example.com/new/':'c','https://example.com/changed/':'new'}), ['https://example.com/new/','https://example.com/changed/','https://example.com/old/']);
});
test('accepts receipts, distinguishes pending validation and rejects errors', async () => {
  const payload={host:'example.com',key:'12345678',urlList:['https://example.com/']};
  for (const status of [200,202]) {
    const result=await submit(payload,async (url, options)=>{
      assert.equal(url,'https://www.bing.com/indexnow');
      assert.deepEqual(JSON.parse(options.body),payload);
      return new Response('',{status});
    });
    assert.equal(result.status,status);
    assert.equal(result.pending,status===202);
  }
  await assert.rejects(submit(payload,async()=>new Response('invalid',{status:403})),/403/);
});
test('refuses off-host URLs before transmitting',async()=>{
  await assert.rejects(submit({host:'example.com',key:'12345678',urlList:['https://elsewhere.com/']},()=>{throw Error('must not fetch')}),/host/);
});
