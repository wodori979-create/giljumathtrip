import {readFile} from 'node:fs/promises';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp,terminate} from 'firebase/firestore';
import {CLASSROOMS,teacherCredential} from '../lib/classrooms.ts';
import {defaultTrip} from '../lib/trip.ts';

const projectId='gilju-grade6-trip-2026';
if(!process.argv.includes('--confirm-live')||!process.argv.includes('--project='+projectId))throw Error('Explicit production project and --confirm-live are required.');
if(process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.FIRESTORE_EMULATOR_HOST)throw Error('Remove emulator environment variables before production provisioning.');
const config=JSON.parse(await readFile(new URL('../lib/firebase-config.json',import.meta.url),'utf8'));
if(config.projectId!==projectId)throw Error('Unexpected production project.');
const pins=JSON.parse(process.env.CLASSROOM_PINS_JSON||process.env.LOCAL_CLASSROOM_PINS_JSON||'{}');
if(!CLASSROOMS.every(room=>typeof pins[room.id]==='string'&&/^\d{4}$/.test(pins[room.id])))throw Error('Provide the five teacher PINs through private environment configuration.');
const app=initializeApp(config,'production-classroom-setup'),auth=getAuth(app),db=getFirestore(app);
try{
  for(const room of CLASSROOMS){
    const email=room.code.toLowerCase()+'@class.gilju-trip.invalid',password=await teacherCredential(room.code,pins[room.id]);
    let user;try{user=(await createUserWithEmailAndPassword(auth,email,password)).user;}catch(error){if(error.code!=='auth/email-already-in-use')throw error;user=(await signInWithEmailAndPassword(auth,email,password)).user;}
    const ref=doc(db,'sparkTrips',room.code);let existing;
    try{existing=await getDoc(ref);}catch(error){if(error.code!=='permission-denied')throw error;}
    if(existing?.exists()){
      if(existing.data().ownerUid!==user.uid||existing.data().className!==room.name)throw Error('Existing classroom ownership/name mismatch: '+room.name);
      console.log(room.name+': authenticated; existing production data preserved');continue;
    }
    const {days,meeting,...fields}=structuredClone(defaultTrip);
    await setDoc(ref,{...fields,className:room.name,ownerUid:user.uid,daysJson:JSON.stringify(days),missionIds:days.flatMap(day=>day.flatMap(event=>event.missions.map(m=>m.id))),meeting:{place:meeting.place,time:meeting.time,note:meeting.note,photoId:''},createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    console.log(room.name+': production classroom ready');
  }
}finally{await terminate(db);await deleteApp(app);}
