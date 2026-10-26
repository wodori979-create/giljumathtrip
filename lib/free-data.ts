import {defaultTrip, normalizeTrip, type Trip} from './trip';

export const MAX_PHOTO_BYTES=180000;
export const MAX_PHOTO_DATA=240023;
export const CLASS_CODE=/^[A-Z2-9]{8}$/;
export const MISSION_ID=/^[A-Za-z0-9_-]{1,100}$/;
export const teacherEmail=(code:string)=>`${code.toLowerCase()}@class.gilju-trip.invalid`;
export function check(ok:unknown,message:string):asserts ok {if(!ok)throw new Error(message);}
const text=(v:unknown,max:number)=>{check(typeof v==='string'&&v.length<=max,'입력 내용을 확인해 주세요.');return v.trim();};
export function validateTrip(raw:Trip):Trip {
  const trip=normalizeTrip(raw);
  check(Array.isArray(trip.days)&&trip.days.length===3,'3일차 일정을 확인해 주세요.');
  trip.className=text(trip.className,40);check(trip.className,'반 이름을 입력해 주세요.');
  trip.teacherName=text(trip.teacherName,40);trip.title=text(trip.title,100);
  trip.startDate=text(trip.startDate,10);check(!trip.startDate||/^\d{4}-\d{2}-\d{2}$/.test(trip.startDate),'날짜를 확인해 주세요.');
  check([1,2,3].includes(trip.activeDay),'여행 일차를 확인해 주세요.');
  const ids=new Set<string>();
  trip.days=trip.days.map(day=>{
    check(day.length<=20,'하루 일정은 20개까지 입력할 수 있어요.');
    return day.map(event=>{
      check(/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time),'일정 시간을 확인해 주세요.');
      const title=text(event.title,100);check(title,'일정 이름을 입력해 주세요.');
      check(event.missions.length<=8,'일정별 미션은 8개까지 추가할 수 있어요.');
      return {...event,id:text(event.id,100),title,place:text(event.place,100),gatherPlace:text(event.gatherPlace||'',150),address:text(event.address||'',200),note:text(event.note,200),icon:text(event.icon,20),missions:event.missions.map(m=>{
        const id=text(m.id,100),title=text(m.title,100);check(MISSION_ID.test(id)&&!ids.has(id)&&title,'미션 이름과 고유 번호를 확인해 주세요.');ids.add(id);
        return {id,title,description:text(m.description,1000)};
      })};
    }).sort((a,b)=>a.time.localeCompare(b.time));
  });
  return trip;
}
export const missionIds=(trip:Trip)=>trip.days.flatMap(day=>day.flatMap(event=>event.missions.map(m=>m.id)));
export function meetingData(input:any,photoId='') {
  const place=text(input.place,100),time=text(input.time,5),note=text(input.note,200);
  check(place,'소집 장소를 입력해 주세요.');check(/^([01]\d|2[0-3]):[0-5]\d$/.test(time),'모이는 시간을 확인해 주세요.');
  return {place,time,note,photoId};
}
export function encodeTrip(input:Trip,photoId='') {
  const trip=validateTrip(input),{days,meeting,...fields}=trip;
  const daysJson=JSON.stringify(days);check(new TextEncoder().encode(daysJson).length<=500000,'일정 내용이 너무 길어요.');
  return {...fields,daysJson,missionIds:missionIds(trip),meeting:meetingData(meeting,photoId)};
}
export function decodeTrip(data:any):Trip {
  return normalizeTrip({className:data.className,teacherName:data.teacherName,title:data.title,startDate:data.startDate,activeDay:data.activeDay,days:JSON.parse(data.daysJson),meeting:{...data.meeting,photoUrl:''}});
}
export function initialTrip(className:string) {return {...structuredClone(defaultTrip),className};}
