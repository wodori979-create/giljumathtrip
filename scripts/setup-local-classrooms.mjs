import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc,serverTimestamp,terminate} from 'firebase/firestore';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {CLASSROOMS,teacherCredential} from '../lib/classrooms.ts';
import {defaultTrip} from '../lib/trip.ts';

export function localPins(){
  const pins=JSON.parse(process.env.LOCAL_CLASSROOM_PINS_JSON||'{}');
  if(!CLASSROOMS.every(room=>typeof pins[room.id]==='string'&&/^\d{4}$/.test(pins[room.id])))throw Error('Set all five teacher PINs in ignored .env.local (LOCAL_CLASSROOM_PINS_JSON).');
  return pins;
}
export async function setupLocalClassrooms(projectId='demo-gilju-trip',pins=localPins()) {
  if(!['demo-gilju-trip','demo-gilju-trip-classrooms-test'].includes(projectId))throw Error('This script only provisions the two explicitly allowed LOCAL emulator projects.');
  const app=initializeApp({projectId,apiKey:'demo-key',authDomain:'localhost'},'local-classroom-setup-'+Date.now());
  const auth=getAuth(app),db=getFirestore(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);
  try {
    for(const room of CLASSROOMS){
      const email=room.code.toLowerCase()+'@class.gilju-trip.invalid',password=await teacherCredential(room.code,pins[room.id]);
      let user;try{user=(await createUserWithEmailAndPassword(auth,email,password)).user;}catch(error){if(error.code!=='auth/email-already-in-use')throw error;user=(await signInWithEmailAndPassword(auth,email,password)).user;}
      const ref=doc(db,'sparkTrips',room.code);let existing;
      try{existing=await getDoc(ref);}catch(error){if(error.code!=='permission-denied')throw error;}
      if(existing?.exists()){if(existing.data().ownerUid!==user.uid||existing.data().className!==room.name)throw Error('Existing classroom ownership does not match '+room.name);console.log(room.name+': existing local data preserved');continue;}
      const {days,meeting,...fields}=structuredClone(defaultTrip);
      await setDoc(ref,{...fields,className:room.name,ownerUid:user.uid,daysJson:JSON.stringify(days),missionIds:days.flatMap(day=>day.flatMap(event=>event.missions.map(m=>m.id))),meeting:{place:meeting.place,time:meeting.time,note:meeting.note,photoId:''},createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      console.log(room.name+': local classroom ready');
    }
  }finally{await terminate(db);await deleteApp(app);}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))await setupLocalClassrooms();
