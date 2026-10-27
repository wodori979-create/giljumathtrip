import {signInWithEmailAndPassword,createUserWithEmailAndPassword,type Auth} from 'firebase/auth';
import {studentCredential} from './classrooms.ts';

export async function signInStudent(auth:Auth,code:string,name:string){
 const {email,password}=await studentCredential(code,name);
 try{return await signInWithEmailAndPassword(auth,email,password);}
 catch(error:any){
  if(!['auth/invalid-credential','auth/user-not-found','auth/wrong-password'].includes(error.code))throw error;
  try{return await createUserWithEmailAndPassword(auth,email,password);}
  catch(created:any){
   // Two devices may enter the same name for the first time together.
   if(created.code!=='auth/email-already-in-use')throw created;
   return await signInWithEmailAndPassword(auth,email,password);
  }
 }
}
