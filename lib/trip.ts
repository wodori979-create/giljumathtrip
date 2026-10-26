export const APP_NAME = '길주초 6학년, 여행중!';
export type Mission = { id: string; title: string; description: string };
export type Event = { id: string; time: string; title: string; place: string; gatherPlace: string; address: string; note: string; icon: string; missions: Mission[] };
export type Meeting = { place: string; photoUrl: string; time: string; note: string };
export type Trip = { className: string; teacherName: string; title: string; startDate: string; activeDay: number; meeting: Meeting; days: Event[][] };
export type Alert = Meeting & { id: string; created: number; read?: boolean; readCount?: number };
export type MissionSubmission = { id: string; missionId: string; photoUrl: string; submitted: number };
export type State = { role: 'student'|'teacher'; code: string; trip: Trip; alerts: Alert[]; completedMissions: string[]; missionSubmissions: MissionSubmission[]; studentCount: number };
const event = (time: string, title: string, icon: string, place = '', address = '', note = '', missions: Mission[] = [], gatherPlace = ''): Event => ({id: `${time}-${title}`,time,title,icon,place,gatherPlace,address,note,missions});
export const defaultTrip: Trip = {
 className:'6학년 2반',teacherName:'담임 선생님',title:'함께라서 더 즐거운 수학여행',startDate:'',activeDay:1,
 meeting:{place:'박물관 정문, 큰 시계 아래',photoUrl:'',time:'10:20',note:'사진 속 장소를 찾아 짝꿍과 함께 기다려요.'},
 days:[
  [event('08:30','학교에서 출발','bus','학교 정문','','',[],'학교 정문 앞 버스 옆'),event('10:30','박물관 관람','museum','국립중앙박물관','','새로운 이야기를 만나러 가요.',[{id:'museum-memory',title:'가장 기억에 남는 유물 찾기',description:'마음에 드는 유물 한 점을 골라, 이름과 인상 깊었던 이유를 짝꿍에게 이야기해 보세요.'}],'박물관 정문, 큰 시계 아래'),event('12:00','점심 식사','meal'),event('14:00','우리 반 체험 활동','camera'),event('17:00','숙소로 이동','hotel')],
  [event('08:00','아침 식사','meal'),event('10:30','문화 탐방','museum'),event('12:00','점심 식사','meal'),event('14:00','친구와 체험 활동','camera'),event('18:00','저녁 식사','meal')],
  [event('08:00','아침 식사','meal'),event('09:30','짐 정리와 방 점검','hotel'),event('11:00','여행 마무리','camera'),event('12:00','점심 식사','meal'),event('15:00','학교 도착','bus')],
 ],
};
export const mapUrl = (address: string) => `https://map.kakao.com/link/search/${encodeURIComponent(address)}`;
export function gatherTitle(place: string): string {
 const last = place.trim().charCodeAt(place.trim().length - 1), final = last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0;
 return `${place}${final && final !== 8 ? '으로' : '로'} 모여라!`;
}
// Keep older local class data readable without bringing back removed screens.
export function normalizeTrip(raw: any): Trip {
 const { rules: _rules, ...rest } = raw;
 return {...rest, meeting:{place:raw.meeting?.place||'',time:raw.meeting?.time||'10:20',note:raw.meeting?.note||'',photoUrl:raw.meeting?.photoUrl||''},days:raw.days.map((day:any[])=>day.map(e=>({...e,gatherPlace:e.gatherPlace||'',missions:e.missions||[]})))};
}
