import type {StudentIdentity} from './trip';

// Match Firebase UIDs rather than names: classmates may share the same name.
export function confirmationRoster(students:StudentIdentity[],confirmedUids:string[]){
  const confirmed=new Set(confirmedUids);
  return {
    confirmedStudents:students.filter(student=>confirmed.has(student.uid)),
    unconfirmedStudents:students.filter(student=>!confirmed.has(student.uid)),
  };
}
