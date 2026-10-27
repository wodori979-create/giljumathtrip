import {doc,setDoc,deleteDoc,serverTimestamp} from 'firebase/firestore';
import {auth,db,emulator} from './firebase-client';
import config from './push-config.json';
import {isStudentAccount} from './classrooms';

export type PushStatus='enabled'|'disabled'|'denied'|'unsupported'|'install'|'unconfigured'|'local';
export type PushResult={sent:number;failed:number;expired:number;skipped:number;warning?:string};
const subscriptionRef=(code:string,uid:string)=>doc(db,'sparkTrips',code,'pushSubscriptions',uid);
function prerequisite(preview=false):PushStatus|null {
  if(emulator&&!preview)return 'local';
  if(!preview&&(!config.serverUrl||!config.publicKey))return 'unconfigured';
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios&&!window.matchMedia('(display-mode: standalone)').matches&&!(navigator as Navigator&{standalone?:boolean}).standalone)return 'install';
  if(!window.isSecureContext||!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))return 'unsupported';
  if(Notification.permission==='denied')return 'denied';
  return null;
}
async function registration() {
  const worker=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
  if(worker.active)return worker;
  return Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('알림 준비에 시간이 걸려요. 잠시 후 다시 눌러 주세요.')),12000))]);
}
async function save(code:string,subscription:PushSubscription) {
  const user=auth.currentUser;if(!isStudentAccount(user))throw new Error('학생으로 우리 반에 입장해 주세요.');
  const value=subscription.toJSON();
  if(!value.endpoint||!value.keys?.p256dh||!value.keys?.auth)throw new Error('휴대폰 알림 정보를 만들지 못했어요.');
  await setDoc(subscriptionRef(code,user!.uid),{endpoint:value.endpoint,p256dh:value.keys.p256dh,auth:value.keys.auth,updatedAt:serverTimestamp()});
}
function publicKey() {
  const raw=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
export async function pushStatus(code:string):Promise<PushStatus> {
  const reason=prerequisite();if(reason)return reason;
  const sub=await(await registration()).pushManager.getSubscription();
  if(Notification.permission!=='granted'||!sub)return 'disabled';
  const key=sub.options.applicationServerKey;
  if(!key||new Uint8Array(key).join(',')!==publicKey().join(','))return 'disabled';
  await save(code,sub);return 'enabled';
}
export async function enablePush(code:string,preview=false):Promise<PushStatus> {
  const reason=prerequisite(preview);if(reason)return reason;
  // Request permission directly from the student's tap, before asynchronous database work.
  const permission=await Notification.requestPermission();
  if(permission!=='granted')return permission==='denied'?'denied':'disabled';
  if(preview)return 'enabled';
  const worker=await registration(),key=publicKey();let sub=await worker.pushManager.getSubscription();
  if(sub&&(!sub.options.applicationServerKey||new Uint8Array(sub.options.applicationServerKey).join(',')!==key.join(','))) {await sub.unsubscribe();sub=null;}
  if(!sub)sub=await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  try {await save(code,sub);}catch(error){await sub.unsubscribe().catch(()=>{});throw error;}
  return 'enabled';
}
export async function disablePush(code:string,{localOnly=false}:{localOnly?:boolean}={}) {
  const user=auth.currentUser;if(user&&!localOnly)await deleteDoc(subscriptionRef(code,user.uid));
  // Safari tabs can have a service worker without Web Push support.
  // Logout only cleans up this device; switching it off explicitly also removes server delivery.
  try {
    if('serviceWorker'in navigator) {
      const worker=await navigator.serviceWorker.getRegistration('/');
      const sub=await worker?.pushManager?.getSubscription?.();
      await sub?.unsubscribe();
    }
  }catch{/* Optional device cleanup must never block logout. */}
}
export async function sendPush(code:string,alertId:string):Promise<PushResult> {
  const totals:PushResult={sent:0,failed:0,expired:0,skipped:0};
  if(emulator)return {...totals,warning:'로컬 확인 중이에요. 실제 휴대폰 푸시는 보내지 않고, 우리 반 모여라! 탭에 안내를 표시했어요.'};
  if(!config.serverUrl)return {...totals,warning:'안내는 저장했지만 푸시 서버 연결이 아직 준비되지 않았어요.'};
  try {
    const user=auth.currentUser;if(!user||isStudentAccount(user))throw new Error('교사 로그인이 필요해요.');
    let pageToken='';
    for(let page=0;page<100;page++) {
      const token=await user.getIdToken();
      const response=await fetch(config.serverUrl+'/send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({code,alertId,...(pageToken?{pageToken}:{})}),signal:AbortSignal.timeout(25000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'푸시 서버 연결을 확인해 주세요.');
      for(const key of ['sent','failed','expired','skipped'] as const)totals[key]+=Number(data[key])||0;
      pageToken=data.nextPageToken||'';
      if(!pageToken)return {...totals,...(totals.failed?{warning:'일부 기기에 발송하지 못했어요. 푸시 다시 보내기를 눌러 주세요.'}:{})};
    }
    throw new Error('발송할 기기가 많아요. 푸시 다시 보내기를 눌러 이어서 보내 주세요.');
  }catch(error){return {...totals,warning:error instanceof Error?error.message:'푸시 발송에 실패했어요. 다시 보내기를 눌러 주세요.'};}
}
