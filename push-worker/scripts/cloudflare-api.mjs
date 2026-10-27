import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
export async function cloudflare(path,init={}) {
  let token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token){
    if(!process.env.XDG_CONFIG_HOME)throw Error('Set XDG_CONFIG_HOME to the directory used for wrangler login.');
    const toml=await readFile(join(process.env.XDG_CONFIG_HOME,'.wrangler','config','default.toml'),'utf8');
    token=toml.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  }
  if(!token)throw Error('Run wrangler login first.');
  const response=await fetch('https://api.cloudflare.com/client/v4'+path,{...init,headers:{Authorization:'Bearer '+token,...init.headers},signal:AbortSignal.timeout(60000)});
  const data=await response.json();
  if(!response.ok||!data.success)throw Object.assign(Error('Cloudflare '+response.status+': '+(data.errors||[]).map(e=>`${e.code} ${e.message}`).join('; ')),{status:response.status});
  return data.result;
}
export const accountPath='/accounts/'+config.account_id;
if(process.argv.includes('--inspect')){
  for(const path of ['/user',accountPath+'/workers/subdomain',accountPath+'/subscriptions']){
    try{
      const data=await cloudflare(path);
      console.log(path.endsWith('/user')?{emailVerified:data.verified_email}:path.endsWith('/subscriptions')?{subscriptions:data.map(s=>({state:s.state,price:s.price,product:s.rate_plan?.id}))}:{subdomain:data.subdomain});
    }catch(e){console.log(e.message);}
  }
}
