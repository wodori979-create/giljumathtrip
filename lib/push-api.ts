export type {PushStatus} from './push';
let loaded:typeof import('./push')|undefined;
async function client(){return loaded??=(await import('./push'));}
export async function pushStatus(code:string){return(await client()).pushStatus(code);}
export function enablePush(code:string,preview=false){
 // Preserve the direct user gesture required for Notification.requestPermission.
 if(loaded)return loaded.enablePush(code,preview);
 void client().catch(()=>{});return Promise.reject(new Error('알림 연결을 준비하고 있어요. 잠시 후 다시 눌러 주세요.'));
}
export async function disablePush(code:string){return(await client()).disablePush(code);}
