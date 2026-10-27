import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword,signInAnonymously} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,serverTimestamp,terminate,writeBatch} from 'firebase/firestore';
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
  const detailId=encodeURIComponent('10:30-박물관 관람'),detail={eventId:'10:30-박물관 관람',description:'자세한 관람 안내',photoId,updatedAt:serverTimestamp()};
  await denied(setDoc(path(s1,room1,'eventDetails',detailId),detail));
  await denied(setDoc(path(t2,room1,'eventDetails',detailId),detail));
  await setDoc(path(t1,room1,'eventDetails',detailId),detail);
  assert.equal((await getDoc(path(s1,room1,'eventDetails',detailId))).data().description,'자세한 관람 안내');
  await denied(getDoc(path(s2,room1,'eventDetails',detailId)));
  await denied(updateDoc(path(s1,room1,'eventDetails',detailId),{description:'학생 수정',updatedAt:serverTimestamp()}));
  const submission={studentUid:uid1,studentName:'김여행',missionId:'food-photo',photoData,submittedAt:serverTimestamp()};
  await denied(setDoc(path(s1,room1,'submissions',uid1+'_food-photo'),{...submission,studentName:'다른 학생'}));
  await setDoc(path(s1,room1,'submissions',uid1+'_food-photo'),submission);
  assert.equal((await getDoc(path(t1,room1,'submissions',uid1+'_food-photo'))).data().studentName,'김여행');
  await denied(getDoc(path(t2,room1,'submissions',uid1+'_food-photo')));
  assert.equal((await getDocs(collection(t2,'sparkTrips',room2.code,'submissions'))).size,0);
  const alertId=crypto.randomUUID();
  await setDoc(path(t1,room1,'alerts',alertId),{place:'1반 전용 소집 장소',time:'10:20',note:'1반만 모여요',photoId,createdAt:serverTimestamp()});
  assert.equal((await getDoc(path(s1,room1,'alerts',alertId))).data().place,'1반 전용 소집 장소');
  await denied(getDoc(path(s2,room1,'alerts',alertId)));
  assert.equal((await getDocs(collection(s2,'sparkTrips',room2.code,'alerts'))).size,0);
  await denied(deleteDoc(path(s1,room1,'alerts',alertId)));
  await denied(deleteDoc(path(t2,room1,'alerts',alertId)));
  await deleteDoc(path(t1,room1,'alerts',alertId));
  assert.equal((await getDoc(path(s1,room1,'alerts',alertId))).exists(),false,'Only the owning teacher may delete an alert; students see it removed');
  await setDoc(path(s1,room1,'progress',uid1),{completedMissions:['food-photo'],updatedAt:serverTimestamp()});
  await denied(getDoc(path(t2,room1,'progress',uid1)));
  await setDoc(path(s1,room1,'pushSubscriptions',uid1),{endpoint:'https://fcm.googleapis.com/fcm/send/local-test',p256dh:'A'.repeat(87),auth:'B'.repeat(22),updatedAt:serverTimestamp()});
  const sameClassPeer=client('peer-kick'),peerUid=(await signInAnonymously(sameClassPeer.auth)).user.uid;
  await setDoc(path(sameClassPeer.db,room1,'members',peerUid),{name:'다른 학생',joinedAt:serverTimestamp()});
  await denied(deleteDoc(path(sameClassPeer.db,room1,'members',uid1)));await denied(deleteDoc(path(t2,room1,'members',uid1)));
  const removal=writeBatch(t1);removal.delete(path(t1,room1,'members',uid1));removal.delete(path(t1,room1,'pushSubscriptions',uid1));await removal.commit();
  assert.equal((await getDoc(path(t1,room1,'members',uid1))).exists(),false);assert.equal((await getDoc(path(t1,room1,'pushSubscriptions',uid1))).exists(),false);
  await denied(getDoc(path(s1,room1)));await denied(setDoc(path(s1,room1,'progress',uid1),{completedMissions:['food-photo'],updatedAt:serverTimestamp()}));

  assert.equal((await getDoc(path(t1,room1,'submissions',uid1+'_food-photo'))).data().studentName,'김여행','Teacher retains submitter name after student leaves');
  console.log('PASS: all 5 real emulator teacher logins, wrong-class PIN rejection, required names, identical names isolated, teacher/student cross-class read/write denied, separate schedules/photos/missions/alerts/progress, submitter attribution, logout revocation, owning-teacher-only alert deletion, member-only event detail reads and teacher-only writes, owning-teacher-only removal and push cleanup.');
}finally{
  await Promise.all(clients.map(async c=>{await terminate(c.db);await deleteApp(c.app);}));
  await env.clearFirestore();await env.cleanup();
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/'+projectId+'/accounts',{method:'DELETE'});
}
