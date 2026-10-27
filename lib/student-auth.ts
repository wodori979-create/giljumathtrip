import {signInWithEmailAndPassword,createUserWithEmailAndPassword,type Auth} from 'firebase/auth';
import {studentCredential} from './classrooms.ts';

const KNOWN='gilju-known-student-login-v1';
export async function signInStudent(auth:Auth,code:string,name:string){
 const {email,password}=await studentCredential(code,name);
 if(auth.currentUser?.email===email)return {user:auth.currentUser};
 let known=false;try{known=localStorage.getItem(KNOWN)===email;}catch{}
 const create=()=>createUserWithEmailAndPassword(auth,email,password);
 const login=()=>signInWithEmailAndPassword(auth,email,password);
 let credential;
 try{credential=await(known?login():create());}
 catch(error:any){
  if(!known&&error.code==='auth/email-already-in-use')credential=await login();
  else if(known&&['auth/invalid-credential','auth/user-not-found','auth/wrong-password'].includes(error.code)){
   try{credential=await create();}catch(created:any){if(created.code!=='auth/email-already-in-use')throw created;credential=await login();}
  }else throw error;
 }
 try{localStorage.setItem(KNOWN,email);}catch{}
 return credential;
}
