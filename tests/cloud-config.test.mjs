import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCloudStore} from '../cloud-client.mjs';
test('disabled cloud makes no requests and preserves restrictive CSP',async()=>{const original=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('must not request');};try{assert.equal(await createCloudStore(),null);assert.equal(calls,0);assert.match(await readFile(new URL('../index.html',import.meta.url),'utf8'),/connect-src 'none'/);}finally{globalThis.fetch=original;}});
test('unsafe origins and secret-looking keys cannot configure cloud client',async()=>{for(const url of ['http://abc.supabase.co/','https://example.com/','https://abc.supabase.co/path','https://name@abc.supabase.co/','https://abc.supabase.co/?x=y','https://abc.supabase.co:8443/'])await assert.rejects(createCloudStore({enabled:true,url,publishableKey:'sb_publishable_test'}));for(const publishableKey of ['sb_secret_test','service_role','eyJhbGciOi'])await assert.rejects(createCloudStore({enabled:true,url:'https://abc.supabase.co/',publishableKey}));});
