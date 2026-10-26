import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultTrip,normalizeTrip} from '../lib/trip.ts';

const origin=process.env.LOCAL_APP_ORIGIN||'http://127.0.0.1:5000';
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'These checks must run locally.');
function client(){let cookie='';return async(path,body,expected=200)=>{
 const multipart=body instanceof FormData;
 const response=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:origin,...(body===undefined||multipart?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:multipart?body:JSON.stringify(body)});
 if(response.headers.get('set-cookie')){cookie=response.headers.get('set-cookie').split(';')[0];assert.match(cookie,/^__session=/,'Firebase Hosting forwards __session cookies');assert.match(response.headers.get('set-cookie'),/HttpOnly/);}
 assert.match(response.headers.get('cache-control')||'',/no-store/);
 const result=response.headers.get('content-type')?.startsWith('image/')?new Uint8Array(await response.arrayBuffer()):await response.json();
 assert.equal(response.status,expected,typeof result==='object'?JSON.stringify(result):String(result));return result;
};}
const teacher=client(),student=client(),peer=client(),otherTeacher=client(),otherStudent=client(),anonymous=client();
const old=normalizeTrip({...structuredClone(defaultTrip),rules:['old rule'],meeting:{place:'시계 아래',time:'12:00',note:'기다려요',address:'old address'},days:defaultTrip.days.map(d=>d.map(({missions,...event})=>event))});
assert.equal(old.rules,undefined);assert.equal(old.meeting.address,undefined);assert.deepEqual(old.days[0][0].missions,[]);
await anonymous('state',undefined,401);
const csrf=await fetch(origin+'/api/create',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({className:'bad origin',password:'local-checks-only'})});assert.equal(csrf.status,403);
await teacher('create',{className:'로컬 검증반',password:'local-checks-only-2026'});
let state=await teacher('state');assert.equal(state.trip.rules,undefined);assert.equal(state.trip.meeting.address,undefined);assert.equal(state.trip.phone,undefined);
await student('join',{role:'student',code:state.code});
await peer('join',{role:'student',code:state.code});
await student('settings',{trip:state.trip},403);
await otherTeacher('create',{className:'다른 검증반',password:'other-local-checks-2026'});await otherStudent('join',{role:'student',code:(await otherTeacher('state')).code});

const trip=structuredClone(state.trip);
trip.days[0][0].gatherPlace='학교 운동장, 버스 옆';
trip.days[0][0].missions=[{id:'local-mission-one',title:'짝꿍과 준비물 확인',description:'물과 수첩을 서로 확인해요.'},{id:'local-mission-two',title:'오늘의 기대 나누기',description:'짝꿍과 한 가지씩 이야기해요.'}];
await teacher('settings',{trip});
assert.equal((await student('state')).trip.days[0][0].missions[0].title,'짝꿍과 준비물 확인');
assert.equal((await student('state')).trip.days[0][0].gatherPlace,'학교 운동장, 버스 옆');
await student('mission',{id:'local-mission-one',completed:true});await student('mission',{id:'local-mission-one',completed:true});assert.deepEqual((await student('state')).completedMissions,['local-mission-one']);
await teacher('mission',{id:'local-mission-one',completed:true},403);await otherStudent('mission',{id:'local-mission-one',completed:true},404);
await student('mission',{id:'local-mission-one',completed:false});assert.deepEqual((await student('state')).completedMissions,[]);
const duplicate=structuredClone(trip);duplicate.days[0][0].missions[1].id='local-mission-one';await teacher('settings',{trip:duplicate},400);

const image=await readFile(new URL('../public/icon-192.png',import.meta.url));
function photoForm(bytes=image,type='image/png'){const form=new FormData();form.append('photo',new Blob([bytes],{type}),'place.png');return form;}
await student('photos',photoForm(),403);
await teacher('photos',photoForm(new TextEncoder().encode('<html>fake image</html>'),'image/jpeg'),400);
const uploaded=await teacher('photos',photoForm());assert.match(uploaded.photoUrl,/^\/api\/photos\/[a-f0-9-]{36}$/);
const path=uploaded.photoUrl.replace('/api/','');
assert.deepEqual(Buffer.from(await student(path)),image);
await anonymous(path,undefined,401);await otherStudent(path,undefined,404);
await otherTeacher('broadcast',{place:'시계 아래',photoUrl:uploaded.photoUrl,time:'10:20',note:'여기로 모여요'},403);

function missionForm(missionId='local-mission-one'){const form=photoForm();form.append('missionId',missionId);return form;}
await teacher('mission-photo',missionForm(),403);await student('mission-photo',missionForm('missing-mission'),404);
const missionUpload=await student('mission-photo',missionForm());const missionPath=missionUpload.photoUrl.replace('/api/','');
assert.deepEqual(Buffer.from(await student(missionPath)),image);assert.deepEqual(Buffer.from(await teacher(missionPath)),image);
await peer(missionPath,undefined,404);await otherStudent(missionPath,undefined,404);await anonymous(missionPath,undefined,401);
assert.equal((await peer('state')).missionSubmissions.length,0);assert.equal((await student('state')).missionSubmissions[0].photoUrl,missionUpload.photoUrl);
assert.equal((await teacher('state')).missionSubmissions[0].missionId,'local-mission-one');assert.deepEqual((await student('state')).completedMissions,['local-mission-one']);
await teacher('broadcast',{place:'버스 옆',photoUrl:missionUpload.photoUrl,time:'10:20',note:'안내'},403);
await peer('mission-photo/remove',{missionId:'local-mission-one'},404);await teacher('mission-photo/remove',{missionId:'local-mission-one'},403);
const replacement=await student('mission-photo',missionForm());assert.notEqual(replacement.photoUrl,missionUpload.photoUrl);assert.equal((await teacher('state')).missionSubmissions.length,1);await student(missionPath,undefined,404);
await student('mission-photo/remove',{missionId:'local-mission-one'});assert.equal((await teacher('state')).missionSubmissions.length,0);assert.deepEqual((await student('state')).completedMissions,[]);await teacher(replacement.photoUrl.replace('/api/',''),undefined,404);

await teacher('broadcast',{place:'기념품점 옆 큰 시계 아래',photoUrl:uploaded.photoUrl,time:'10:20',note:'사진 속 장소에서 짝꿍과 기다려요.'});
const received=await student('state');assert.equal(received.trip.meeting.photoUrl,uploaded.photoUrl);assert.equal(received.alerts[0].photoUrl,uploaded.photoUrl);assert.equal(received.alerts[0].time,'10:20');assert.equal(received.alerts[0].note,'사진 속 장소에서 짝꿍과 기다려요.');assert.equal(received.alerts[0].address,undefined);
assert.equal(received.pushEnabled,false);assert.equal(received.alerts[0].read,false);assert.equal((await student('alert/'+received.alerts[0].id)).photoUrl,uploaded.photoUrl);await otherStudent('alert/'+received.alerts[0].id,undefined,404);
await student('ack',{id:received.alerts[0].id});assert.equal((await teacher('state')).alerts[0].readCount,1);
await new Promise(resolve=>setTimeout(resolve,5100));
await teacher('broadcast',{place:'버스 앞',photoUrl:'',time:'11:00',note:'다음 장소로 출발해요.'});
const history=await student('state');assert.equal(history.trip.meeting.photoUrl,'');assert.equal(history.alerts[1].photoUrl,uploaded.photoUrl);assert.deepEqual(Buffer.from(await student(path)),image);
await student('logout',{});await student(path,undefined,401);
console.log('PASS: 일정별 소집 장소, 미션 자동 목록·완료·사진 제출·교체·삭제, 제출 사진의 본인/교사 접근 보호, 타 학생/타 반 격리, 사진 포함 소집 알림함·개별 알림 조회·확인 표시, 과거 사진 보존.');
