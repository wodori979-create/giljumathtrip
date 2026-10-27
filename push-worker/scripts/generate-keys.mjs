import {createECDH} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const secret=new URL('../../work/push-keys.json',import.meta.url);
await mkdir(new URL('../../work/',import.meta.url),{recursive:true});
let keys;
try{keys=JSON.parse(await readFile(secret,'utf8'));}catch(error){
  if(error.code!=='ENOENT')throw error;
  const ec=createECDH('prime256v1');ec.generateKeys();
  keys={VAPID_PUBLIC_KEY:ec.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:ec.getPrivateKey().toString('base64url')};
  await writeFile(secret,JSON.stringify(keys),{mode:0o600,flag:'wx'});
}
const path=new URL('../../lib/push-config.json',import.meta.url),config=JSON.parse(await readFile(path,'utf8'));
config.publicKey=keys.VAPID_PUBLIC_KEY;
await writeFile(path,JSON.stringify(config,null,2)+'\n');
console.log('VAPID keys prepared. Only the public key was written to the app; private key remains in ignored work/.');
