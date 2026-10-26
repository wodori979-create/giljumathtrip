import {initializeApp} from 'firebase/app';
import {getAuth, connectAuthEmulator} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator} from 'firebase/firestore';
import config from './firebase-config.json';

const emulator=import.meta.env.DEV&&import.meta.env.VITE_USE_FIREBASE_EMULATORS==='true';
export const firebaseApp=initializeApp(emulator?{...config,projectId:'demo-gilju-trip',apiKey:'demo-key',authDomain:'localhost'}:config);
export const auth=getAuth(firebaseApp);
export const db=getFirestore(firebaseApp);
if(emulator) {
  connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  connectFirestoreEmulator(db,'127.0.0.1',8080);
}
