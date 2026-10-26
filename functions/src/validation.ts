import type {Trip} from '../../lib/trip.js';
export const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie',...headers}});
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
export const random=()=>crypto.randomUUID().replaceAll('-','');
export const hash=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
export async function passwordHash(p:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
export function check(ok:unknown,message:string,status=400):asserts ok{if(!ok)throw Object.assign(new Error(message),{status});}
export const str=(v:unknown,max=150)=>{check(typeof v==='string'&&v.length<=max,'입력 내용을 확인해 주세요.');return v.trim();};
export const time=(v:unknown)=>{const s=str(v,5);check(/^([01]\d|2[0-3]):[0-5]\d$/.test(s),'모이는 시간을 확인해 주세요.');return s;};
export function validateTrip(v:any):Trip{
 check(v&&Array.isArray(v.days)&&v.days.length===3,'일정을 확인해 주세요.');
 const className=str(v.className,40);check(className,'반 이름을 입력해 주세요.');const startDate=str(v.startDate,10);check(!startDate||/^\d{4}-\d{2}-\d{2}$/.test(startDate),'날짜를 확인해 주세요.');check([1,2,3].includes(v.activeDay),'여행 일차를 확인해 주세요.');
 const ids=new Set<string>();
 const trip={className,teacherName:str(v.teacherName,40),title:str(v.title,100),startDate,activeDay:v.activeDay,meeting:{place:str(v.meeting?.place,100),photoUrl:str(v.meeting?.photoUrl||'',100),time:time(v.meeting?.time),note:str(v.meeting?.note,200)},days:v.days.map((d:any[])=>{check(Array.isArray(d)&&d.length<=20,'하루 일정은 20개까지 입력할 수 있어요.');return d.map(e=>{
  const title=str(e.title,100);check(title,'일정 이름을 입력해 주세요.');
  check(!e.missions||(Array.isArray(e.missions)&&e.missions.length<=8),'일정별 미션은 8개까지 추가할 수 있어요.');
  const missions=(e.missions||[]).map((m:any)=>{const id=str(m.id,100),title=str(m.title,100);check(id&&title&&!ids.has(id),'미션 이름과 고유 번호를 확인해 주세요.');ids.add(id);return{id,title,description:str(m.description,1000)};});
  return{id:str(e.id,100),time:time(e.time),title,place:str(e.place,100),gatherPlace:str(e.gatherPlace||'',150),address:str(e.address||'',200),note:str(e.note,200),icon:str(e.icon,20),missions};}).sort((a,b)=>a.time.localeCompare(b.time));})};
 check(trip.meeting.place,'소집 장소 이름을 입력해 주세요.');return trip;
}
