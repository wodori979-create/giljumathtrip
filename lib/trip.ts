import {itineraryDays} from './itinerary.ts';
export const APP_NAME = '길주초 6학년, 여행중!';
export type Mission = { id: string; title: string; description: string };
export type Event = { id: string; time: string; title: string; place: string; gatherPlace: string; address: string; note: string; icon: string; lodging?:string; missions: Mission[] };
export type Meeting = { place: string; photoUrl: string; time: string; note: string };
export type Trip = { className: string; teacherName: string; title: string; startDate: string; activeDay: number; meeting: Meeting; days: Event[][] };
export type StudentIdentity = {uid:string;name:string};
export type StudentMember = StudentIdentity & {joined:number};
export type Alert = Meeting & { id: string; created: number; read?: boolean; readCount?: number; confirmedStudents?:StudentIdentity[]; unconfirmedStudents?:StudentIdentity[] };
export type MissionSubmission = { id: string; missionId: string; photoUrl: string; submitted: number; studentName?:string };
export type State = { role: 'student'|'teacher'; code: string; trip: Trip; alerts: Alert[]; completedMissions: string[]; missionSubmissions: MissionSubmission[]; studentCount: number; students?:StudentMember[]; missionSubmissionsReady?:boolean; studentName?:string };
export const defaultTrip: Trip = {
 className:'6학년 2반',teacherName:'담임 선생님',title:'길주초 6학년 수학여행',startDate:'',activeDay:1,
 meeting:{place:'',photoUrl:'',time:'',note:''},
 days:itineraryDays,
};
export const mapUrl = (address: string) => `https://map.kakao.com/link/search/${encodeURIComponent(address)}`;
export function gatherTitle(place: string): string {
 const last = place.trim().charCodeAt(place.trim().length - 1), final = last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0;
 return `${place}${final && final !== 8 ? '으로' : '로'} 모여라!`;
}
// Keep older local class data readable without bringing back removed screens.
export function normalizeTrip(raw: any): Trip {
 const { rules: _rules, ...rest } = raw;
 return {...rest, meeting:{place:raw.meeting?.place||'',time:raw.meeting?.time||'',note:raw.meeting?.note||'',photoUrl:raw.meeting?.photoUrl||''},days:raw.days.map((day:any[])=>day.map(e=>({...e,gatherPlace:e.gatherPlace||'',missions:e.missions||[]})))};
}
