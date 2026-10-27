import {readFile,writeFile} from 'node:fs/promises';
import {cloudflare,config,accountPath} from './cloudflare-api.mjs';
const keys=JSON.parse(await readFile(new URL('../../work/push-keys.json',import.meta.url),'utf8'));
const compiled=await readFile(new URL('../../work/push-worker/index.mjs',import.meta.url),'utf8');
const form=new FormData();
form.set('metadata',new Blob([JSON.stringify({main_module:'index.mjs',compatibility_date:config.compatibility_date,observability:{enabled:false},
  bindings:[...Object.entries(config.vars).map(([name,text])=>({name,text,type:'plain_text'})),{name:'VAPID_PUBLIC_KEY',text:keys.VAPID_PUBLIC_KEY,type:'plain_text'},{name:'VAPID_PRIVATE_KEY',text:keys.VAPID_PRIVATE_KEY,type:'secret_text'}],
  tags:['gilju-trip-free-push']})],{type:'application/json'}));
form.set('index.mjs',new Blob([compiled],{type:'application/javascript+module'}),'index.mjs');
const result=await cloudflare(accountPath+'/workers/scripts/'+config.name,{method:'PUT',body:form});
console.log({worker:config.name,startupTimeMs:result.startup_time_ms,version:result.deployment_id||result.id});
let domain;
try{domain=await cloudflare(accountPath+'/workers/subdomain');}catch(e){if(e.status!==404)throw e;}
if(!domain?.subdomain)domain=await cloudflare(accountPath+'/workers/subdomain',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({subdomain:'gilju-trip-wodori979'})});
await cloudflare(accountPath+'/workers/scripts/'+config.name+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
const url=`https://${config.name}.${domain.subdomain}.workers.dev`;
const path=new URL('../../lib/push-config.json',import.meta.url),publicConfig=JSON.parse(await readFile(path,'utf8'));
publicConfig.serverUrl=url;await writeFile(path,JSON.stringify(publicConfig,null,2)+'\n');
console.log({serverUrl:url,privateKey:'stored as Cloudflare secret; never published in the app'});
