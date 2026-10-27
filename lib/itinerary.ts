import type {Event} from './trip';
const activity=(id:string,time:string,title:string,icon:string,gatherPlace='',missions:Event['missions']=[],place=''):Event=>({id,time,title,icon,place,gatherPlace,address:'',note:'',missions});
export const itineraryDays:Event[][]=[
 [
  activity('day1-departure','08:20','인원 점검 및 출발','bus','우리 반'),
  activity('day1-lunch','12:00','세계 음식 문화 체험 (점심 식사)','meal','',[{id:'food-photo',title:'음식과 사진찍기',description:'혼자 음식과 함께 사진을 찍어 제출해요.'}]),
  activity('day1-science','13:00','국립 과천 과학관 관람','museum','12시 40분 과천 국립과학관 1층 고양이 인형',[
   {id:'science-indoor-photo',title:'신기한 과학 조형물 찍기 · 실내',description:'모둠과 함께 실내의 신기한 과학 조형물을 찍어 1장을 제출해요.'},
   {id:'science-outdoor-photo',title:'신기한 과학 조형물 찍기 · 야외',description:'모둠과 함께 야외의 신기한 과학 조형물을 찍어 1장을 제출해요.'},
  ],'국립 과천 과학관'),
  activity('day1-everland-transfer','15:00','에버랜드로 이동','bus'),
  activity('day1-arrival','15:40','에버랜드 도착, 인원 점검 및 방 배정, 짐풀기','hotel'),
  activity('day1-everland-dinner','16:00','에버랜드 입장, 저녁 식사(밀쿠폰)','meal','8시 에버랜드 장미원 옆 분수대',[{id:'dinner-group-photo',title:'저녁 식사 사진 찍기',description:'모둠과 함께 저녁 식사 사진을 찍어 제출해요.'}]),
  activity('day1-return','22:00','숙소 복귀 및 취침 준비','hotel'),
  activity('day1-sleep','23:30','취침','hotel'),
 ],
 [
  activity('day2-wakeup','07:30','기상 및 활동 준비','hotel','7시 50분 방에서 준비 완료(아침 식사)'),
  activity('day2-breakfast','08:00','아침 식사 및 짐 정리','meal'),
  activity('day2-everland-lunch','09:50','에버랜드 입장, 점심 식사(밀쿠폰)','meal','12시 40분 에버랜드 장미원 옆 분수대',[{id:'lunch-group-photo',title:'점심 식사 사진 찍기',description:'모둠과 함께 점심 식사 사진을 찍어 제출해요.'}]),
  activity('day2-yeongneung-transfer','13:00','영릉으로 이동','bus'),
  activity('day2-yeongneung','13:40','세계유산 영릉 관람','museum','2시 40분 영릉 입구 이디아 커피 앞',[{id:'sejong-class-photo',title:'세종대왕과 함께 사진',description:'반 전체가 세종대왕과 함께 사진을 찍어 제출해요.'}],'세계유산 영릉'),
  activity('day2-andong-transfer','15:00','안동으로 이동','bus'),
  activity('day2-home','17:00','도착 및 귀가','bus'),
 ],
];
