import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,serverTimestamp,query,where,onSnapshot} from 'firebase/firestore';
import {defaultTrip} from '../lib/trip.ts';

const env=await initializeTestEnvironment({projectId:'demo-gilju-trip',firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
const teacher=(uid,code)=>env.authenticatedContext(uid,{email:code.toLowerCase()+'@class.gilju-trip.invalid',firebase:{sign_in_provider:'password'}}).firestore();
const student=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'anonymous'}}).firestore();
const code='SAMPLE23',otherCode='OTHER234',owner=teacher('teacher-one',code),otherOwner=teacher('teacher-two',otherCode),s=student('student-one'),peer=student('student-two'),other=student('student-other'),stranger=student('stranger'),anonymous=env.unauthenticatedContext().firestore();
const path=(db,part='',id='')=>doc(db,'sparkTrips',code,...(part?[part,id]:[]));
const photo='data:image/jpeg;base64,/9j/2Q==',photo2='data:image/jpeg;base64,/9j/AA==',photoId='11111111-1111-4111-8111-111111111111',alertId='22222222-2222-4222-8222-222222222222';
function base(uid){const {days,meeting,...fields}=structuredClone(defaultTrip);return {...fields,ownerUid:uid,daysJson:JSON.stringify(days),missionIds:['museum-memory'],meeting:{place:meeting.place,time:meeting.time,note:meeting.note,photoId:''},createdAt:serverTimestamp(),updatedAt:serverTimestamp()};}
const submission=(uid='student-one',missionId='museum-memory',photoData=photo)=>({studentUid:uid,missionId,photoData,submittedAt:serverTimestamp()});
try {
  await env.clearFirestore();
  await assertFails(setDoc(path(s),base('student-one')));
  await assertSucceeds(setDoc(path(owner),base('teacher-one')));
  await assertSucceeds(setDoc(doc(otherOwner,'sparkTrips',otherCode),base('teacher-two')));
  await assertFails(getDoc(path(anonymous)));await assertFails(getDoc(path(stranger)));
  await assertFails(getDocs(collection(owner,'sparkTrips')));
  await assertFails(setDoc(path(s,'members','student-two'),{joinedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(s,'sparkTrips','MISSING2','members','student-one'),{joinedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(path(s,'members','student-one'),{joinedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(path(peer,'members','student-two'),{joinedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(doc(other,'sparkTrips',otherCode,'members','student-other'),{joinedAt:serverTimestamp()}));
  await assertSucceeds(getDoc(path(s)));await assertFails(updateDoc(path(s),{title:'student edit',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(path(owner),{title:'무료 배포 일정 검증',updatedAt:serverTimestamp()}));
  assert.equal((await getDoc(path(s))).data().title,'무료 배포 일정 검증');

  await assertFails(setDoc(path(s,'photos',photoId),{ownerUid:'student-one',photoData:photo,createdAt:serverTimestamp()}));
  await assertSucceeds(setDoc(path(owner,'photos',photoId),{ownerUid:'teacher-one',photoData:photo,createdAt:serverTimestamp()}));
  await assertSucceeds(getDoc(path(s,'photos',photoId)));await assertFails(getDoc(path(other,'photos',photoId)));await assertFails(getDoc(path(anonymous,'photos',photoId)));
  await assertFails(setDoc(path(s,'submissions','student-one_missing'),submission('student-one','missing')));
  await assertFails(setDoc(path(s,'submissions','student-two_museum-memory'),submission('student-two')));
  await assertFails(setDoc(path(s,'submissions','student-one_museum-memory'),submission('student-one','museum-memory','data:image/jpeg;base64,'+'A'.repeat(240024))));
  await assertSucceeds(setDoc(path(s,'submissions','student-one_museum-memory'),submission()));
  await assertSucceeds(getDoc(path(owner,'submissions','student-one_museum-memory')));
  await assertFails(getDoc(path(peer,'submissions','student-one_museum-memory')));await assertFails(getDoc(path(other,'submissions','student-one_museum-memory')));
  await assertFails(getDocs(collection(peer,'sparkTrips',code,'submissions')));
  assert.equal((await getDocs(query(collection(peer,'sparkTrips',code,'submissions'),where('studentUid','==','student-two')))).size,0);
  await assertSucceeds(setDoc(path(s,'submissions','student-one_museum-memory'),submission('student-one','museum-memory',photo2)));
  assert.equal((await getDoc(path(owner,'submissions','student-one_museum-memory'))).data().photoData,photo2);
  await assertFails(deleteDoc(path(peer,'submissions','student-one_museum-memory')));
  await assertSucceeds(setDoc(path(s,'progress','student-one'),{completedMissions:['museum-memory'],updatedAt:serverTimestamp()}));
  await assertFails(setDoc(path(s,'progress','student-two'),{completedMissions:[],updatedAt:serverTimestamp()}));
  await assertFails(setDoc(path(s,'progress','student-one'),{completedMissions:['missing'],updatedAt:serverTimestamp()}));
  await assertFails(getDoc(path(peer,'progress','student-one')));await assertSucceeds(getDoc(path(owner,'progress','student-one')));
  await assertSucceeds(deleteDoc(path(s,'submissions','student-one_museum-memory')));

  const received=new Promise((resolve,reject)=>{let stop=()=>{};const timer=setTimeout(()=>{stop();reject(new Error('Realtime gathering notice did not arrive'));},15000);stop=onSnapshot(collection(s,'sparkTrips',code,'alerts'),snapshot=>{if(snapshot.docs.some(d=>d.id===alertId)){clearTimeout(timer);stop();resolve();}},reject);});
  const notice={place:'박물관 정문 큰 시계 아래',time:'10:20',note:'짝꿍과 함께 사진 속 장소로 모여요.',photoId,createdAt:serverTimestamp()};
  await assertFails(setDoc(path(s,'alerts',alertId),notice));
  await assertFails(setDoc(path(otherOwner,'alerts',alertId),notice));
  await assertSucceeds(setDoc(path(owner,'alerts',alertId),notice));await received;
  assert.equal((await getDoc(path(s,'alerts',alertId))).data().note,notice.note);
  await assertFails(updateDoc(path(s,'alerts',alertId),{note:'tamper'}));
  await assertSucceeds(getDoc(path(s,'receipts',alertId+'_student-one')));
  await assertSucceeds(setDoc(path(s,'receipts',alertId+'_student-one'),{alertId,studentUid:'student-one',createdAt:serverTimestamp()}));
  await assertFails(setDoc(path(s,'receipts',alertId+'_student-two'),{alertId,studentUid:'student-two',createdAt:serverTimestamp()}));
  assert.equal((await getDocs(collection(owner,'sparkTrips',code,'receipts'))).size,1);
  await assertSucceeds(deleteDoc(path(s,'members','student-one')));await assertFails(getDoc(path(s)));await assertFails(getDoc(path(s,'photos',photoId)));
  console.log('PASS: Spark 교사/익명 학생 인증 규칙, 반 코드 참여, 일정 보호, 사진 크기 제한, 미션 사진 본인·교사 접근 및 교체·삭제, 다른 학생·다른 반 차단, 소집 안내 실시간 수신·확인, 로그아웃 접근 차단.');
} finally {await env.cleanup();}
