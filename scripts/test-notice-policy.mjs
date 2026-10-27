import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isCurrentNotice,incomingNotice} from '../lib/notice-policy.ts';
const created=Date.parse('2026-10-27T04:00:00Z'); // 13:00 in Korea
const alert={id:'fresh',place:'정문',time:'14:00',note:'집합',photoUrl:'',created,read:false};
test('fresh unread notices can open, while read, old or already-ended gatherings cannot',()=>{
 assert.equal(isCurrentNotice(alert,created+60000),true);
 assert.equal(isCurrentNotice({...alert,read:true},created+60000),false);
 assert.equal(isCurrentNotice(alert,created+600001),false);
 assert.equal(isCurrentNotice({...alert,time:'12:59'},created+60000),false);
 assert.equal(isCurrentNotice({...alert,created:0},created),false);
 assert.equal(isCurrentNotice({...alert,created:created+60000},created),false);
});
test('initial snapshot and delayed old snapshots do not become new entry popups',()=>{
 assert.equal(incomingNotice([alert],new Set(['fresh']),created-1,created+60000),undefined);
 assert.equal(incomingNotice([alert],new Set(),created+1000,created+60000),undefined);
 assert.equal(incomingNotice([alert],new Set(),created-1,created+60000)?.id,'fresh');
});
test('gathering deadlines use the creation day in Korea, including the UTC date boundary',()=>{
 const late={...alert,created:Date.parse('2026-10-26T15:01:00Z'),time:'00:03'};
 assert.equal(isCurrentNotice(late,Date.parse('2026-10-26T15:02:00Z')),true);
 assert.equal(isCurrentNotice(late,Date.parse('2026-10-26T15:04:00Z')),false);
});
