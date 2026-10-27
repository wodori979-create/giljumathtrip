import {CLASSROOM_SESSION_KEY} from './session-key';
import type {State} from './trip';
let pending:Promise<typeof import('./trip-store')>|undefined;
function store(){return pending??=(import('./trip-store').catch(()=>{pending=undefined;throw new Error('교실 연결 파일을 불러오지 못했어요. 인터넷 연결을 확인하고 상단 새로고침을 눌러 주세요.');}));}
export function warmConnection(){void store().catch(()=>{});}
export async function api(path:string,body?:any):Promise<any>{
 // With no selected classroom there is no restorable app session. Leave Firebase
 // off the welcome-screen download path; Firebase still restores its own auth.
 if(path==='session'){try{if(!localStorage.getItem(CLASSROOM_SESSION_KEY))return {session:null};}catch{}}
 return (await store()).api(path,body);
}
export function watchState(onState:(state:State)=>void,onError:(error:Error)=>void,onRemoved?:()=>void){
 let active=true,stop:(()=>void)|undefined;
 void store().then(client=>{if(active)stop=client.watchState(onState,onError,onRemoved);}).catch(error=>{if(active)onError(error instanceof Error?error:new Error('교실 연결을 확인해 주세요.'));});
 return()=>{active=false;stop?.();};
}
export async function uploadMeetingPhoto(blob:Blob){return(await store()).uploadMeetingPhoto(blob);}
export async function uploadMissionPhoto(missionId:string,blob:Blob){return(await store()).uploadMissionPhoto(missionId,blob);}
