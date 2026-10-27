export const CLASSROOMS = [
  {id:1,code:'GILJU6AA',name:'6학년 1반'},
  {id:2,code:'GILJU6AB',name:'6학년 2반'},
  {id:3,code:'GILJU6AC',name:'6학년 3반'},
  {id:4,code:'GILJU6AD',name:'6학년 4반'},
  {id:5,code:'GILJU6AE',name:'6학년 5반'},
] as const;
export type Classroom = typeof CLASSROOMS[number];
export const classroomByCode=(code:string)=>CLASSROOMS.find(room=>room.code===code);
export function classroomById(id:unknown):Classroom {
  const room=CLASSROOMS.find(room=>room.id===Number(id));
  if(!room)throw new Error('1반부터 5반 중 우리 반을 선택해 주세요.');
  return room;
}
export function studentName(value:unknown) {
  const name=typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
  if(!name||name.length>20||/[\u0000-\u001f\u007f]/.test(name))throw new Error('이름을 1~20자로 입력해 주세요.');
  return name;
}
// Firebase receives a full-length credential; the PIN itself is never embedded in the app.
// This is a credential encoding, not an increase in the four-digit PIN's strength.
export async function teacherCredential(code:string,pin:unknown) {
  if(typeof pin!=='string'||!/^\d{4}$/.test(pin))throw new Error('교사용 비밀번호 4자리를 입력해 주세요.');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('gilju-trip-teacher-v1:'+code+':'+pin));
  return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
}
