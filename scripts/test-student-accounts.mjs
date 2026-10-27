import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInAnonymously,signOut,signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,doc,collection,getDoc,getDocs,setDoc,deleteDoc,serverTimestamp,runTransaction,terminate} from 'firebase/firestore';
import {studentCredential,teacherCredential} from '../lib/classrooms.ts';
import {signInStudent} from '../lib/student-auth.ts';
import {localPins,setupLocalClassrooms} from './setup-local-classrooms.mjs';
const projectId='demo-gilju-trip-classrooms-test',clients=[];
const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
function client(){const app=initializeApp({projectId,apiKey:'demo-key',authDomain:'localhost'},'student-account-'+clients.length),auth=getAuth(app),db=getFirestore(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);const c={app,auth,db};clients.push(c);return c;}
const ref=(c,code,part,id)=>doc(c.db,'sparkTrips',code,part,id);
const denied=p=>assert.rejects(p,e=>e.code==='permission-denied');
async function join(c,code,name){const {user}=await signInStudent(c.auth,code,name),profile=ref(c,code,'members',user.uid);await runTransaction(c.db,async tx=>{if(!(await tx.get(profile)).exists())tx.set(profile,{name:(await studentCredential(code,name)).name,joinedAt:serverTimestamp()});});return user.uid;}
try{
 await env.clearFirestore();await fetch('http://127.0.0.1:9099/emulator/v1/projects/'+projectId+'/accounts',{method:'DELETE'});const pins=localPins();await setupLocalClassrooms(projectId,pins);
 assert.deepEqual(await studentCredential('GILJU6AA','  김여행  '),await studentCredential('GILJU6AA','김여행'));
 assert.deepEqual(await studentCredential('GILJU6AA','김여행'.normalize('NFD')),await studentCredential('GILJU6AA','김여행'));
 const legacy=client();const legacyUid=(await signInAnonymously(legacy.auth)).user.uid;await denied(setDoc(ref(legacy,'GILJU6AA','members',legacyUid),{name:'김여행',joinedAt:serverTimestamp()}));
 const first=client(),second=client(),otherClass=client(),otherName=client(),teacher=client();
 const [uid,again]=await Promise.all([join(first,'GILJU6AA','김여행'),join(second,'GILJU6AA','  김여행  ')]);assert.equal(uid,again,'Concurrent first entry on separate devices must share one UID');
 const originalJoined=(await getDoc(ref(first,'GILJU6AA','members',uid))).data().joinedAt.toMillis();
 const differentClass=await join(otherClass,'GILJU6AB','김여행'),differentName=await join(otherName,'GILJU6AA','다른이름');assert.notEqual(uid,differentClass);assert.notEqual(uid,differentName);
 await denied(setDoc(ref(first,'GILJU6AB','members',uid),{name:'김여행',joinedAt:serverTimestamp()}));
 const submission=ref(first,'GILJU6AA','submissions',uid+'_food-photo');
 await setDoc(submission,{studentUid:uid,studentName:'김여행',missionId:'food-photo',photoData:'data:image/jpeg;base64,/9j/2Q==',submittedAt:serverTimestamp()});
 assert.equal((await getDoc(ref(second,'GILJU6AA','submissions',uid+'_food-photo'))).data().studentName,'김여행');
 await denied(getDoc(ref(otherClass,'GILJU6AA','submissions',uid+'_food-photo')));await denied(getDoc(ref(otherName,'GILJU6AA','submissions',uid+'_food-photo')));
 await setDoc(ref(first,'GILJU6AA','progress',uid),{completedMissions:['food-photo'],updatedAt:serverTimestamp()});assert.deepEqual((await getDoc(ref(second,'GILJU6AA','progress',uid))).data().completedMissions,['food-photo']);
 await signInWithEmailAndPassword(teacher.auth,'gilju6aa@class.gilju-trip.invalid',await teacherCredential('GILJU6AA',pins[1]));
 assert.equal((await getDocs(collection(teacher.db,'sparkTrips','GILJU6AA','members'))).size,2,'One record for shared name, one for different name');
 const alertId=crypto.randomUUID();await setDoc(ref(teacher,'GILJU6AA','alerts',alertId),{place:'우리 반',time:'12:00',note:'',photoId:'',createdAt:serverTimestamp()});
 for(const c of [first,second])await runTransaction(c.db,async tx=>{const receipt=ref(c,'GILJU6AA','receipts',alertId+'_'+uid);if(!(await tx.get(receipt)).exists())tx.set(receipt,{alertId,studentUid:uid,createdAt:serverTimestamp()});});
 assert.equal((await getDocs(collection(teacher.db,'sparkTrips','GILJU6AA','receipts'))).size,1);
 await signOut(first.auth);assert((await getDoc(ref(second,'GILJU6AA','members',uid))).exists(),'Signing out one device must keep other devices in class');
 assert.equal(await join(first,'GILJU6AA','김여행'),uid);assert.equal((await getDoc(ref(first,'GILJU6AA','members',uid))).data().joinedAt.toMillis(),originalJoined);assert((await getDoc(submission)).exists());
 await denied(deleteDoc(ref(otherName,'GILJU6AA','members',uid)));await deleteDoc(ref(teacher,'GILJU6AA','members',uid));await denied(getDoc(ref(second,'GILJU6AA','progress',uid)));
 assert.equal(await join(first,'GILJU6AA','김여행'),uid);assert((await getDoc(ref(first,'GILJU6AA','submissions',uid+'_food-photo'))).exists(),'Teacher removal and re-entry retain submitted photo');
 console.log('PASS: concurrent same-name sign-in, normalized names, shared photos/progress/receipts, one roster identity, different class/name isolation, logout/re-entry continuity, teacher removal and photo preservation.');
}finally{await Promise.all(clients.map(async c=>{await terminate(c.db);await deleteApp(c.app);}));await env.clearFirestore();await env.cleanup();await fetch('http://127.0.0.1:9099/emulator/v1/projects/'+projectId+'/accounts',{method:'DELETE'});}
