import type {StudentIdentity} from './trip';

// Each class/name now signs into one stable Firebase UID; receipts use that shared UID.
export function confirmationRoster(students:StudentIdentity[],confirmedUids:string[]){
  const confirmed=new Set(confirmedUids);
  return {
    confirmedStudents:students.filter(student=>confirmed.has(student.uid)),
    unconfirmedStudents:students.filter(student=>!confirmed.has(student.uid)),
  };
}
