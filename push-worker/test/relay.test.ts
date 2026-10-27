import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPushPayload} from '@block65/webcrypto-web-push';
import {decodeJwt,importJWK,jwtVerify} from 'jose';
import {createHandler,validEndpoint,type Env} from '../src/index.ts';

const now=Date.now(),code='SAMPLE23',id='22222222-2222-4222-8222-222222222222',uid='student-one';
const origin='https://gilju-grade6-trip-2026.web.app';
const env:Env={APP_ORIGIN:origin,FIREBASE_PROJECT_ID:'gilju-grade6-trip-2026',VAPID_SUBJECT:origin,VAPID_PRIVATE_KEY:'test-only',VAPID_PUBLIC_KEY:'test-only'};
const stamp=new Date(now).toISOString();
const field=(value:string)=>({stringValue:value});
const make=(name:string,fields:Record<string,unknown>)=>({name:'projects/test/databases/(default)/documents/sparkTrips/'+code+'/'+name,fields,updateTime:stamp});
function fixture(options:{owner?:string;member?:boolean;endpoint?:string;status?:number;prior?:string;old?:boolean;provider?:string;invalidJwt?:boolean}={}) {
  const requests:{url:string;init:RequestInit}[]=[],payloads:any[]=[];
  const docs:Record<string,any>={
    [code]:make('',{ownerUid:field(options.owner||'teacher-one')}),
    ['alerts/'+id]:make('alerts/'+id,{place:field('박물관 정문'),time:field('10:20'),note:field('사진 속 시계 앞에서 만나요.'),createdAt:{timestampValue:new Date(now-(options.old?700000:1000)).toISOString()}}),
    ['pushSubscriptions/'+uid]:make('pushSubscriptions/'+uid,{endpoint:field(options.endpoint||'https://fcm.googleapis.com/fcm/send/test'),p256dh:field('A'.repeat(87)),auth:field('B'.repeat(22))}),
  };
  if(options.member!==false)docs['members/'+uid]=make('members/'+uid,{});
  if(options.prior)docs['pushDispatches/'+id+'_'+uid]=make('pushDispatches/'+id+'_'+uid,{status:field(options.prior),updatedAt:{timestampValue:stamp}});
  const handler=createHandler({now:()=>now,verify:async()=>{if(options.invalidJwt)throw Error('invalid');return {uid:'teacher-one',provider:options.provider||'password'};},
    build:async(...args)=>{payloads.push(args);return {method:'POST',body:new Uint8Array(4096),headers:{authorization:'test-only',ttl:'600','content-encoding':'aes128gcm','content-length':'4096','content-type':'application/octet-stream'}};},
    fetch:async(input,init={})=>{
      const url=String(input);requests.push({url,init});
      if(!url.startsWith('https://firestore.googleapis.com/'))return new Response(null,{status:options.status||201});
      if(url.endsWith(':commit'))return Response.json({writeResults:[{updateTime:stamp}]});
      if(init.method==='DELETE')return Response.json({});
      if(url.includes('/pushSubscriptions?'))return Response.json({documents:[docs['pushSubscriptions/'+uid]]});
      const part=url.split('/sparkTrips/')[1],key=part===code?code:part?.slice(code.length+1);
      return docs[key]?Response.json(docs[key]):Response.json({error:{status:'NOT_FOUND'}},{status:404});
    },
  });
  const request=(body:any={code,alertId:id},headers:Record<string,string>={Authorization:'Bearer '+'a'.repeat(30),Origin:origin})=>new Request('https://relay.test/send',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  return {handler,request,requests,payloads};
}
test('Only real browser push endpoints pass the outbound allowlist',()=>{
  for(const url of ['https://fcm.googleapis.com/fcm/send/key','https://updates.push.services.mozilla.com/wpush/v2/key','https://wns.notify.windows.com/w/?token=key','https://web.push.apple.com/key'])assert.equal(validEndpoint(url),true);
  for(const url of ['http://fcm.googleapis.com/fcm/send/key','https://fcm.googleapis.com.evil.test/fcm/send/key','https://evil.test/@fcm.googleapis.com','https://fcm.googleapis.com:4430/fcm/send/key','https://user@fcm.googleapis.com/fcm/send/key','https://127.0.0.1/','https://firestore.googleapis.com/v1/'])assert.equal(validEndpoint(url),false);
});
test('CORS, missing login, forged login and student accounts cannot send',async()=>{
  let f=fixture();assert.equal((await f.handler(f.request({}, {Origin:'https://evil.test'}),env)).status,403);
  assert.equal((await f.handler(f.request({}, {}),env)).status,401);
  f=fixture({invalidJwt:true});assert.equal((await f.handler(f.request(),env)).status,401);
  f=fixture({provider:'anonymous'});assert.equal((await f.handler(f.request(),env)).status,403);assert.equal(f.requests.length,0);
});
test('Another class teacher and expired alerts cannot send',async()=>{
  let f=fixture({owner:'another-teacher'});assert.equal((await f.handler(f.request(),env)).status,403);assert.equal(f.payloads.length,0);
  f=fixture({old:true});assert.equal((await f.handler(f.request(),env)).status,400);assert.equal(f.payloads.length,0);
});
test('Payload and recipient are derived from protected Firestore, ignoring caller content',async()=>{
  const f=fixture();const response=await f.handler(f.request({code,alertId:id,title:'forged',endpoint:'https://evil.test/'}),env);
  assert.equal(response.status,200);assert.equal((await response.json() as any).sent,1);
  const data=JSON.parse(f.payloads[0][0].data);assert.equal(data.title,'박물관 정문으로 모여라!');assert.equal(data.body,'10:20까지 · 사진 속 시계 앞에서 만나요.');
  assert.equal(f.payloads[0][1].endpoint,'https://fcm.googleapis.com/fcm/send/test');
  assert.equal(f.requests.filter(r=>r.url.startsWith('https://fcm.'))[0].init.redirect,'manual');
  const claim=f.requests.find(r=>r.url.endsWith(':commit'));assert.deepEqual(JSON.parse(claim!.init.body as string).writes[0].currentDocument,{exists:false});
});
test('Completed dispatches are skipped, failed dispatches retry, removed members receive nothing',async()=>{
  let f=fixture({prior:'accepted'});assert.equal((await(await f.handler(f.request(),env)).json() as any).skipped,1);assert.equal(f.requests.filter(r=>r.url.startsWith('https://fcm.')).length,0);
  f=fixture({prior:'sending'});assert.equal((await(await f.handler(f.request(),env)).json() as any).skipped,1);
  f=fixture({prior:'failed'});assert.equal((await(await f.handler(f.request(),env)).json() as any).sent,1);
  f=fixture({member:false});assert.equal((await(await f.handler(f.request(),env)).json() as any).skipped,1);assert.equal(f.payloads.length,0);
});
test('Invalid endpoints never receive network traffic, expired subscriptions are removed, errors are reported',async()=>{
  let f=fixture({endpoint:'https://127.0.0.1/private'});assert.equal((await(await f.handler(f.request(),env)).json() as any).failed,1);assert.equal(f.payloads.length,0);
  f=fixture({status:410});assert.equal((await(await f.handler(f.request(),env)).json() as any).expired,1);assert.equal(f.requests.some(r=>r.init.method==='DELETE'),true);
  f=fixture({status:503});assert.equal((await(await f.handler(f.request(),env)).json() as any).failed,1);
  f=fixture({status:302});assert.equal((await(await f.handler(f.request(),env)).json() as any).failed,1);
});
test('Real WebCrypto payload is encrypted and its VAPID signature validates',async()=>{
  const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',vapid.privateKey),raw=await crypto.subtle.exportKey('raw',vapid.publicKey);
  const client=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const endpoint='https://fcm.googleapis.com/fcm/send/test';
  const b64=(v:ArrayBuffer|Uint8Array)=>Buffer.from(v instanceof ArrayBuffer?new Uint8Array(v):v).toString('base64url');
  const payload=await buildPushPayload({data:'박물관 정문으로 모여라!',options:{ttl:600,urgency:'high'}},{endpoint,expirationTime:null,keys:{p256dh:b64(await crypto.subtle.exportKey('raw',client.publicKey)),auth:b64(crypto.getRandomValues(new Uint8Array(16)))}},{subject:origin,publicKey:b64(raw),privateKey:jwk.d!});
  const headers=new Headers(payload.headers);assert.equal(headers.get('Content-Encoding'),'aes128gcm');
  const authorization=headers.get('Authorization')!,token=authorization.match(/t=([^, ]+)/)![1];
  assert.equal(decodeJwt(token).aud,new URL(endpoint).origin);
  await jwtVerify(token,await importJWK({...jwk,d:undefined,key_ops:['verify']},'ES256'),{audience:new URL(endpoint).origin});
  assert.equal(payload.body.byteLength,4096);
  assert.equal(Buffer.from(payload.body).includes(Buffer.from('박물관')),false);
});
