import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
const id='22222222-2222-4222-8222-222222222222',origin='https://gilju-grade6-trip-2026.web.app';
function setup(windows=[]){const events={},notifications=[],opened=[];const self={location:{origin},addEventListener:(n,f)=>events[n]=f,registration:{showNotification:async(...v)=>notifications.push(v)},clients:{claim:async()=>{},matchAll:async()=>windows,openWindow:async u=>opened.push(u)},skipWaiting:()=>{}};runInNewContext(source,{self,URL});return {events,notifications,opened};}
test('Background push creates a visible notification with the specific alert ID',async()=>{const f=setup();let work;f.events.push({data:{json:()=>({title:'박물관 정문으로 모여라!',body:'10:20까지',code:'SAMPLE23',notice:id})},waitUntil:p=>work=p});await work;assert.equal(f.notifications.length,1);assert.equal(f.notifications[0][1].data.notice,id);assert.equal(f.notifications[0][1].body,'10:20까지');});
test('Malformed pushes cannot open arbitrary URLs or create notifications',()=>{const f=setup();f.events.push({data:{json:()=>({code:'../bad',notice:'https://evil.test'})},waitUntil:()=>assert.fail()});assert.equal(f.notifications.length,0);});
test('Notification tap opens the specific alert on the same Firebase origin',async()=>{const f=setup();let work;f.events.notificationclick({notification:{close:()=>{},data:{code:'SAMPLE23',notice:id,url:'https://evil.test'}},waitUntil:p=>work=p});await work;assert.equal(f.opened[0],origin+'/?notice='+id);});
test('Notification tap focuses an open app and tells it which alert to display',async()=>{let focused=false,message;const f=setup([{url:origin+'/',focus:async()=>{focused=true},postMessage:v=>message=v}]);let work;f.events.notificationclick({notification:{close:()=>{},data:{code:'SAMPLE23',notice:id}},waitUntil:p=>work=p});await work;assert.equal(focused,true);assert.equal(message.type,'GILJU_NOTICE');assert.equal(message.notice,id);assert.equal(f.opened.length,0);});
