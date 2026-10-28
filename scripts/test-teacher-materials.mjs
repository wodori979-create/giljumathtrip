import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-gilju-trip-reference-test',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firestore.rules','utf8')}});
const codes=['GILJU6AA','GILJU6AB','GILJU6AC','GILJU6AD','GILJU6AE'];
try{
 await env.withSecurityRulesDisabled(async ctx=>{for(const code of codes){const db=ctx.firestore();await setDoc(doc(db,'sparkTrips',code),{ownerUid:'teacher-'+code});await setDoc(doc(db,'sparkTrips',code,'teacherMaterials','trip-reference'),{pdfData:'test',pageCount:4});await setDoc(doc(db,'sparkTrips',code,'teacherMaterials','trip-reference-page-1'),{imageData:'test'});for(const id of ['trip-reference-pdf-1','trip-info','trip-info-pdf-1','trip-info-page-11'])await setDoc(doc(db,'sparkTrips',code,'teacherMaterials',id),{test:true});await setDoc(doc(db,'sparkTrips',code,'members','student-'+code),{name:'학생'});}});
 for(const code of codes){
  const teacher=env.authenticatedContext('teacher-'+code).firestore(),student=env.authenticatedContext('student-'+code).firestore(),outsider=env.unauthenticatedContext().firestore();
  for(const id of ['trip-reference','trip-reference-page-1','trip-reference-pdf-1','trip-info','trip-info-pdf-1','trip-info-page-11']){
   await assertSucceeds(getDoc(doc(teacher,'sparkTrips',code,'teacherMaterials',id)));
   await assertFails(getDoc(doc(student,'sparkTrips',code,'teacherMaterials',id)));
   await assertFails(getDoc(doc(outsider,'sparkTrips',code,'teacherMaterials',id)));
   await assertFails(getDoc(doc(teacher,'sparkTrips',codes[(codes.indexOf(code)+1)%5],'teacherMaterials',id)));
  }
  await assertFails(setDoc(doc(teacher,'sparkTrips',code,'teacherMaterials','trip-reference'),{pdfData:'tamper'}));
 }
 console.log('PASS: all 5 teachers read own PDF/pages; students, anonymous users, other classes and client writes denied');
}finally{await env.clearFirestore();await env.cleanup();}
