import {test} from 'node:test';
import assert from 'node:assert/strict';
import {confirmationRoster} from '../lib/student-status.ts';
const students=[{uid:'a',name:'김여행'},{uid:'b',name:'김여행'},{uid:'c',name:'이친구'}];
test('confirmation roster distinguishes students with identical names by UID',()=>{
 const result=confirmationRoster(students,['b']);
 assert.deepEqual(result.confirmedStudents,[students[1]]);
 assert.deepEqual(result.unconfirmedStudents,[students[0],students[2]]);
});
test('only current participants count; duplicate or departed receipts do not inflate totals',()=>{
 const result=confirmationRoster(students,['a','a','departed']);
 assert.equal(result.confirmedStudents.length,1);
 assert.equal(result.unconfirmedStudents.length,2);
 assert.equal(result.confirmedStudents.length+result.unconfirmedStudents.length,students.length);
});
test('empty, unread and fully read classrooms remain distinct',()=>{
 assert.deepEqual(confirmationRoster([],['departed']),{confirmedStudents:[],unconfirmedStudents:[]});
 assert.equal(confirmationRoster(students,[]).unconfirmedStudents.length,3);
 assert.equal(confirmationRoster(students,students.map(s=>s.uid)).unconfirmedStudents.length,0);
});
