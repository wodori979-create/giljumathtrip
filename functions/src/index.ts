import {initializeApp} from 'firebase-admin/app';
import {onRequest} from 'firebase-functions/v2/https';
import {logger} from 'firebase-functions';

initializeApp();
// Import after the Admin app is initialized (api.ts creates its Firestore client).
const api=import('./api.js');

export const tripApi=onRequest({region:'asia-northeast3',memory:'256MiB',cpu:1,minInstances:0,maxInstances:3,concurrency:40,timeoutSeconds:60,invoker:'public'},async(req,res)=>{
  try {
    const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
    const local=process.env.FUNCTIONS_EMULATOR==='true';
    const base=local?'http://127.0.0.1:5000':`https://${project}.web.app`;
    const headers=new Headers();
    for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
    const raw=req.rawBody;
    if(raw?.length&&raw.length>800000){res.status(413).json({error:'사진 또는 입력 내용이 너무 커요.'});return;}
    const request=new Request(new URL(req.originalUrl,base),{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:new Uint8Array(raw||[])})});
    const response=await(await api).handle(request,req.ip||'unknown');
    res.status(response.status);response.headers.forEach((value,key)=>res.setHeader(key,value));
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch(error:any) {
    if(!error.status)logger.error('tripApi request failed',{path:req.path,code:error.code||'internal',reason:error.message});
    res.set('Cache-Control','private, no-store').status(error.status||500).json({error:error.status?error.message:'연결에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'});
  }
});
