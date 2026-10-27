import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword,signInAnonymously} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,serverTimestamp,terminate} from 'firebase/firestore';
import {CLASSROOMS,teacherCredential,studentName} from '../lib/classrooms.ts';
import {localPins,setupLocalClassrooms} from './setup-local-classrooms.mjs';

const projectId='demo-gilju-trip-classrooms-test',clients=[];
const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
const path=(db,room,part='',id='')=>doc(db,'sparkTrips',room.code,...(part?[part,id]:[]));
function client(name){const app=initializeApp({projectId,apiKey:'demo-key',authDomain:'localhost'},name+'-'+Date.now()),auth=getAuth(app),db=getFirestore(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);const c={app,auth,db};clients.push(c);return c;}
const denied=p=>assert.rejects(p,e=>e.code==='permission-denied');
const pins=localPins();
try {
  await env.clearFirestore();
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/'+projectId+'/accounts',{method:'DELETE'});
  await setupLocalClassrooms(projectId,pins);
  const teachers=[],students=[];
  for(const room of CLASSROOMS){
    const t=client('teacher-'+room.id),s=client('student-'+room.id);
    await signInWithEmailAndPassword(t.auth,room.code.toLowerCase()+'@class.gilju-trip.invalid',await teacherCredential(room.code,pins[room.id]));
    assert.equal((await getDoc(path(t.db,room))).data().className,room.name);
    const pupil=(await signInAnonymously(s.auth)).user;
    await denied(getDoc(path(s.db,room)));
    await denied(setDoc(path(s.db,room,'members',pupil.uid),{joinedAt:serverTimestamp()}));
    await denied(setDoc(path(s.db,room,'members',pupil.uid),{name:' ',joinedAt:serverTimestamp()}));
    await setDoc(path(s.db,room,'members',pupil.uid),{name:'김여행',joinedAt:serverTimestamp()});
    assert.equal((await getDoc(path(s.db,room,'members',pupil.uid))).data().name,'김여행');
    teachers.push(t);students.push(s);
  }
  for(let i=0;i<5;i++)for(let j=0;j<5;j++)if(i!==j){
    await denied(getDoc(path(teachers[i].db,CLASSROOMS[j])));
    await denied(getDoc(path(students[i].db,CLASSROOMS[j])));
    await denied(getDocs(collection(teachers[i].db,'sparkTrips',CLASSROOMS[j].code,'members')));
  }
  const probe=client('wrong-password');
  await assert.rejects(signInWithEmailAndPassword(probe.auth,CLASSROOMS[1].code.toLowerCase()+'@class.gilju-trip.invalid',await teacherCredential(CLASSROOMS[1].code,pins[1])),e=>e.code==='auth/invalid-credential'||e.code==='auth/wrong-password');
  assert.throws(()=>studentName('   '));assert.throws(()=>studentName('가'.repeat(21)));
  assert.equal(studentName('  김여행  '),'김여행');
  const room1=CLASSROOMS[0],room2=CLASSROOMS[1],t1=teachers[0].db,t2=teachers[1].db,s1=students[0].db,s2=students[1].db,uid1=students[0].auth.currentUser.uid;
  await updateDoc(path(t1,room1),{title:'1반만의 여행 일정',updatedAt:serverTimestamp()});
  assert.notEqual((await getDoc(path(t2,room2))).data().title,'1반만의 여행 일정');
  await denied(updateDoc(path(t2,room1),{title:'다른 반 변경',updatedAt:serverTimestamp()}));
  await denied(updateDoc(path(t1,room1),{className:'6학년 2반',updatedAt:serverTimestamp()}));
  await denied(updateDoc(path(s1,room1),{title:'학생 변경',updatedAt:serverTimestamp()}));
  const photoId=crypto.randomUUID(),photoData='data:image/jpeg;base64,/9j/2Q==';
  await setDoc(path(t1,room1,'photos',photoId),{ownerUid:teachers[0].auth.currentUser.uid,photoData,createdAt:serverTimestamp()});
  assert.equal((await getDoc(path(s1,room1,'photos',photoId))).data().photoData,photoData);
  await denied(getDoc(path(t2,room1,'photos',photoId)));await denied(getDoc(path(s2,room1,'photos',photoId)));
  const submission={studentUid:uid1,studentName:'김여행',missionId:'museum-memory',photoData,submittedAt:serverTimestamp()};
  await denied(setDoc(path(s1,room1,'submissions',uid1+'_museum-memory'),{...submission,studentName:'다른 학생'}));
  await setDoc(path(s1,room1,'submissions',uid1+'_museum-memory'),submission);
  assert.equal((await getDoc(path(t1,room1,'submissions',uid1+'_museum-memory'))).data().studentName,'김여행');
  await denied(getDoc(path(t2,room1,'submissions',uid1+'_museum-memory')));
  assert.equal((await getDocs(collection(t2,'sparkTrips',room2.code,'submissions'))).size,0);
  const alertId=crypto.randomUUID();
  await setDoc(path(t1,room1,'alerts',alertId),{place:'1반 전용 소집 장소',time:'10:20',note:'1반만 모여요',photoId,createdAt:serverTimestamp()});
  assert.equal((await getDoc(path(s1,room1,'alerts',alertId))).data().place,'1반 전용 소집 장소');
  await denied(getDoc(path(s2,room1,'alerts',alertId)));
  assert.equal((await getDocs(collection(s2,'sparkTrips',room2.code,'alerts'))).size,0);
  await setDoc(path(s1,room1,'progress',uid1),{completedMissions:['museum-memory'],updatedAt:serverTimestamp()});
  await denied(getDoc(path(t2,room1,'progress',uid1)));
  await deleteDoc(path(s1,room1,'members',uid1));await denied(getDoc(path(s1,room1)));
  assert.equal((await getDoc(path(t1,room1,'submissions',uid1+'_museum-memory'))).data().studentName,'김여행','Teacher retains submitter name after student leaves');
  console.log('PASS: all 5 real emulator teacher logins, wrong-class PIN rejection, required names, identical names isolated, teacher/student cross-class read/write denied, separate schedules/photos/missions/alerts/progress, submitter attribution, logout revocation.');
}finally{
  await Promise.all(clients.map(async c=>{await terminate(c.db);await deleteApp(c.app);}));
  await env.clearFirestore();await env.cleanup();
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/'+projectId+'/accounts',{method:'DELETE'});
}
