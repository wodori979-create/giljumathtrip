import {onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signInAnonymously,signOut} from 'firebase/auth';
import {collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,query,where,orderBy,limit,serverTimestamp,writeBatch,runTransaction,onSnapshot,type DocumentData,type DocumentSnapshot,type QuerySnapshot,type Query} from 'firebase/firestore';
import {auth,db} from './firebase-client';
import {type State,type Trip,type Meeting,type Alert} from './trip';
import {CLASS_CODE,MAX_PHOTO_BYTES,MAX_PHOTO_DATA,check,teacherEmail,initialTrip,encodeTrip,decodeTrip,meetingData} from './free-data';
import {sendPush,disablePush} from './push';

const KEY='gilju-trip-spark-class';
const ready=new Promise<void>(resolve=>{const unsubscribe=onAuthStateChanged(auth,()=>{unsubscribe();resolve();});});
const photos=new Map<string,Promise<string>>(),photoRefs=new Map<string,string>();
const milliseconds=(v:any)=>v?.toMillis?.()||0;
const classRef=(code:string)=>doc(db,'sparkTrips',code);
const bucket=(code:string,name:string)=>collection(db,'sparkTrips',code,name);
const item=(code:string,name:string,id:string)=>doc(db,'sparkTrips',code,name,id);
const storedCode=()=>localStorage.getItem(KEY)||'';
function context() {const code=storedCode(),user=auth.currentUser;check(user&&CLASS_CODE.test(code),'우리 반에 다시 입장해 주세요.');return {code,user,ref:classRef(code)};}
function friendly(error:any):Error {
  const messages:Record<string,string>={
    'auth/invalid-credential':'참여 코드 또는 교사용 비밀번호가 맞지 않아요.','auth/wrong-password':'교사용 비밀번호를 확인해 주세요.',
    'auth/user-not-found':'참여 코드 또는 교사용 비밀번호가 맞지 않아요.','auth/too-many-requests':'요청이 많아요. 잠시 후 다시 시도해 주세요.',
    'auth/network-request-failed':'인터넷 연결을 확인해 주세요.','auth/operation-not-allowed':'로그인 설정을 확인해 주세요.',
    'auth/weak-password':'교사용 비밀번호는 8자 이상 입력해 주세요.','permission-denied':'반 참여 권한을 확인해 주세요. 코드가 맞는지 확인하고 다시 입장해 주세요.',
    'resource-exhausted':'무료 사용량 한도에 도달했어요. 잠시 후 다시 확인해 주세요.','unavailable':'인터넷 연결이 불안정해요. 다시 시도해 주세요.'
  };
  return new Error(messages[error.code]||error.message||'잠시 후 다시 시도해 주세요.');
}
function resolvePhoto(code:string,id:string) {
  if(!id)return Promise.resolve('');const key=code+'/'+id;
  if(!photos.has(key))photos.set(key,getDoc(item(code,'photos',id)).then(snapshot=>{
    const photo=snapshot.data()?.photoData||'';if(photo)photoRefs.set(photo,key);return photo;
  }).catch(error=>{photos.delete(key);throw error;}));
  return photos.get(key)!;
}
function photoId(code:string,url:string) {if(!url)return '';const key=photoRefs.get(url);check(typeof key==='string'&&key.startsWith(code+'/'),'우리 반 장소 사진을 다시 선택해 주세요.');return key.slice(code.length+1);}
function validatePhoto(photoData:string) {check(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photoData)&&photoData.length<=MAX_PHOTO_DATA,'사진이 너무 커요. 더 작은 사진을 선택해 주세요.');}
async function photoData(blob:Blob) {
  check(blob.size>0&&blob.size<=MAX_PHOTO_BYTES&&blob.type==='image/jpeg','사진을 다시 선택해 주세요.');
  const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(new Error('사진을 읽지 못했어요.'));reader.readAsDataURL(blob);});
  validatePhoto(data);return data;
}
type Parts={base:DocumentSnapshot;alerts:QuerySnapshot;progress:DocumentSnapshot;submissions:QuerySnapshot;receipts:QuerySnapshot;members:QuerySnapshot|null};
async function assemble(code:string,uid:string,parts:Parts):Promise<State> {
  const raw=parts.base.data();check(raw,'반을 찾을 수 없어요.');const teacher=raw.ownerUid===uid,trip=decodeTrip(raw),valid=new Set(raw.missionIds as string[]);
  trip.meeting.photoUrl=await resolvePhoto(code,raw.meeting.photoId);
  const receipts=parts.receipts.docs.map(doc=>doc.data());
  const alerts=await Promise.all(parts.alerts.docs.map(async doc=>{
    const a=doc.data();return {id:doc.id,place:a.place,time:a.time,note:a.note,photoUrl:await resolvePhoto(code,a.photoId),created:milliseconds(a.createdAt),read:receipts.some(r=>r.alertId===doc.id&&r.studentUid===uid),...(teacher?{readCount:receipts.filter(r=>r.alertId===doc.id).length}:{})};
  }));
  return {role:teacher?'teacher':'student',code,trip,alerts,
    completedMissions:(parts.progress.data()?.completedMissions||[]).filter((id:string)=>valid.has(id)),
    missionSubmissions:parts.submissions.docs.map(doc=>({id:doc.id,...doc.data()} as DocumentData)).filter(s=>valid.has(s.missionId)).sort((a,b)=>milliseconds(b.submittedAt)-milliseconds(a.submittedAt)).map(s=>({id:s.id,missionId:s.missionId,photoUrl:s.photoData,submitted:milliseconds(s.submittedAt)})),
    studentCount:parts.members?.docs.filter(doc=>doc.id!==raw.ownerUid).length||0};
}
function queries(code:string,uid:string,teacher:boolean) {
  return {alerts:query(bucket(code,'alerts'),orderBy('createdAt','desc'),limit(20)),
    submissions:teacher?bucket(code,'submissions'):query(bucket(code,'submissions'),where('studentUid','==',uid)),
    receipts:teacher?bucket(code,'receipts'):query(bucket(code,'receipts'),where('studentUid','==',uid))};
}
async function readState():Promise<State> {
  await ready;const {code,user,ref}=context(),base=await getDoc(ref);check(base.exists(),'반을 찾을 수 없어요.');const teacher=base.data().ownerUid===user.uid,q=queries(code,user.uid,teacher);
  const [alerts,progress,submissions,receipts,members]=await Promise.all([getDocs(q.alerts),getDoc(item(code,'progress',user.uid)),getDocs(q.submissions),getDocs(q.receipts),teacher?getDocs(bucket(code,'members')):Promise.resolve(null)]);
  return assemble(code,user.uid,{base,alerts,progress,submissions,receipts,members});
}
// Firestore listeners receive only changes; no five-second polling of photos or state.
export function watchState(onState:(state:State)=>void,onError:(error:Error)=>void) {
  const {code,user}=context(),parts:Partial<Parts>={members:null};let active=true,generation=0,started=false;
  const stops:Array<()=>void>=[];
  const emit=()=>{if(!active||!parts.base||!parts.alerts||!parts.progress||!parts.submissions||!parts.receipts)return;const own=++generation;assemble(code,user.uid,parts as Parts).then(state=>{if(active&&own===generation)onState(state)}).catch(e=>active&&onError(friendly(e)));};
  const listenQuery=(key:'alerts'|'submissions'|'receipts'|'members',q:Query)=>stops.push(onSnapshot(q,snapshot=>{parts[key]=snapshot;emit();},error=>active&&onError(friendly(error))));
  stops.push(onSnapshot(classRef(code),snapshot=>{
    if(!snapshot.exists()){onError(new Error('반을 찾을 수 없어요.'));return;}parts.base=snapshot;
    if(!started){started=true;const teacher=snapshot.data().ownerUid===user.uid,q=queries(code,user.uid,teacher);listenQuery('alerts',q.alerts);listenQuery('submissions',q.submissions);listenQuery('receipts',q.receipts);if(teacher)listenQuery('members',bucket(code,'members'));
      stops.push(onSnapshot(item(code,'progress',user.uid),p=>{parts.progress=p;emit();},e=>active&&onError(friendly(e))));}
    emit();
  },error=>active&&onError(friendly(error))));
  return ()=>{active=false;stops.forEach(stop=>stop());};
}

export async function uploadMeetingPhoto(blob:Blob) {
  try {const {code,user}=context(),data=await photoData(blob),id=crypto.randomUUID();await setDoc(item(code,'photos',id),{photoData:data,ownerUid:user.uid,createdAt:serverTimestamp()});const key=code+'/'+id;photos.set(key,Promise.resolve(data));photoRefs.set(data,key);return data;}catch(e){throw friendly(e);}
}
export async function uploadMissionPhoto(missionId:string,blob:Blob) {
  try {
    const {code,user,ref}=context(),data=await photoData(blob),progress=item(code,'progress',user.uid);
    await runTransaction(db,async tx=>{const [base,current]=await Promise.all([tx.get(ref),tx.get(progress)]),ids=base.data()?.missionIds||[];check(ids.includes(missionId),'미션을 찾을 수 없어요.');
      const completed=(current.data()?.completedMissions||[]).filter((id:string)=>ids.includes(id));
      tx.set(item(code,'submissions',user.uid+'_'+missionId),{studentUid:user.uid,missionId,photoData:data,submittedAt:serverTimestamp()});
      tx.set(progress,{completedMissions:[...new Set([...completed,missionId])],updatedAt:serverTimestamp()});
    });
  }catch(e){throw friendly(e);}
}
function newCode() {const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(8)),v=>alphabet[v%32]).join('');}
export async function api(path:string,body?:any):Promise<any> {
  try {
    await ready;
    if(path==='create') {
      const name=String(body.className||'').trim(),password=String(body.password||'');check(name&&name.length<=40,'반 이름을 입력해 주세요.');check(password.length>=8&&password.length<=100,'교사용 비밀번호는 8자 이상 입력해 주세요.');
      const code=newCode(),credential=await createUserWithEmailAndPassword(auth,teacherEmail(code),password);
      try {await setDoc(classRef(code),{...encodeTrip(initialTrip(name)),ownerUid:credential.user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});}catch(error){await credential.user.delete().catch(()=>{});throw error;}
      localStorage.setItem(KEY,code);return {ok:true};
    }
    if(path==='join') {
      const code=String(body.code||'').trim().toUpperCase();check(CLASS_CODE.test(code),'8자리 참여 코드를 확인해 주세요.');
      if(body.role==='teacher') {await signInWithEmailAndPassword(auth,teacherEmail(code),String(body.password||''));const c=await getDoc(classRef(code));check(c.data()?.ownerUid===auth.currentUser!.uid,'교사용 참여 정보를 확인해 주세요.');}
      else {if(auth.currentUser&&!auth.currentUser.isAnonymous)await signOut(auth);const credential=await signInAnonymously(auth);await setDoc(item(code,'members',credential.user.uid),{joinedAt:serverTimestamp()});}
      localStorage.setItem(KEY,code);return {ok:true};
    }
    if(path==='session') {
      if(!auth.currentUser||!storedCode())return {session:null};
      try {return await readState();}catch(error:any){if(error.code==='permission-denied'||error.message==='반을 찾을 수 없어요.'){localStorage.removeItem(KEY);return {session:null};}throw error;}
    }
    if(path==='state')return readState();
    const {code,user,ref}=context();
    if(path==='logout') {if(user.isAnonymous){await disablePush(code);await deleteDoc(item(code,'members',user.uid));}localStorage.removeItem(KEY);await signOut(auth);photos.clear();photoRefs.clear();return {ok:true};}
    if(path==='settings') {const trip=body.trip as Trip;await updateDoc(ref,{...encodeTrip(trip,photoId(code,trip.meeting.photoUrl)),updatedAt:serverTimestamp()});return {ok:true};}
    if(path==='broadcast') {
      const meeting=meetingData(body,photoId(code,body.photoUrl||'')),id=crypto.randomUUID(),batch=writeBatch(db);
      batch.set(item(code,'alerts',id),{...meeting,createdAt:serverTimestamp()});batch.update(ref,{meeting,updatedAt:serverTimestamp()});await batch.commit();return {ok:true,alertId:id,push:await sendPush(code,id)};
    }
    if(path==='push/retry')return {ok:true,alertId:body.id,push:await sendPush(code,body.id)};
    if(path==='ack') {const receipt=item(code,'receipts',body.id+'_'+user.uid);await runTransaction(db,async tx=>{if(!(await tx.get(receipt)).exists())tx.set(receipt,{alertId:body.id,studentUid:user.uid,createdAt:serverTimestamp()});});return {ok:true};}
    if(path==='mission'||path==='mission-photo/remove') {
      const missionId=String(body.id||body.missionId||''),progress=item(code,'progress',user.uid);
      await runTransaction(db,async tx=>{
        const [base,current]=await Promise.all([tx.get(ref),tx.get(progress)]),ids=base.data()?.missionIds||[];
        if(path==='mission')check(ids.includes(missionId),'미션을 찾을 수 없어요.');
        const completed=(current.data()?.completedMissions||[]).filter((id:string)=>ids.includes(id)&&id!==missionId);
        if(path==='mission'&&body.completed)completed.push(missionId);
        tx.set(progress,{completedMissions:completed,updatedAt:serverTimestamp()});
        if(path==='mission-photo/remove')tx.delete(item(code,'submissions',user.uid+'_'+missionId));
      });return {ok:true};
    }
    if(path.startsWith('alert/')) {
      const id=path.slice(6),snapshot=await getDoc(item(code,'alerts',id));check(snapshot.exists(),'소집 안내를 찾을 수 없어요.');const a=snapshot.data();
      return {id,place:a.place,time:a.time,note:a.note,photoUrl:await resolvePhoto(code,a.photoId),created:milliseconds(a.createdAt),read:(await getDoc(item(code,'receipts',id+'_'+user.uid))).exists()} as Alert;
    }
    throw new Error('요청을 찾을 수 없어요.');
  }catch(error){throw friendly(error);}
}
