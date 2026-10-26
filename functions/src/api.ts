import {getFirestore, type DocumentData} from 'firebase-admin/firestore';
import webpush from 'web-push';
import {defaultTrip, normalizeTrip, gatherTitle} from '../../lib/trip.js';
import {json, hash, random, passwordHash, check, str, time, validateTrip} from './validation.js';

const db = getFirestore();
const classes = db.collection('tripClasses');
const sessions = db.collection('tripSessions');
const uuid = /^[a-f0-9-]{36}$/;
const progressId = (token:string, id:string) => hash(`${token}:${id}`);

async function rateLimit(id:string, limit:number, windowMs:number) {
  const ref=db.collection('tripAttempts').doc(id);
  await db.runTransaction(async tx=>{
    const current=(await tx.get(ref)).data();
    const fresh=!current||current.until<Date.now();
    check(fresh||current.count<limit,'요청이 많아요. 잠시 후 다시 시도해 주세요.',429);
    tx.set(ref,{count:fresh?1:current.count+1,until:fresh?Date.now()+windowMs:current.until});
  });
}

export async function handle(req:Request, ip='local'):Promise<Response> {
  const url=new URL(req.url), path=url.pathname.replace(/^\/api\//,'');
  const upload=path==='photos'||path==='mission-photo';
  check(['GET','POST'].includes(req.method),'지원하지 않는 요청이에요.',405);
  if(req.method==='POST') {
    const origin=req.headers.get('origin');
    const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
    const local=process.env.FUNCTIONS_EMULATOR==='true';
    const allowed=origin&&(origin===`https://${project}.web.app`||origin===`https://${project}.firebaseapp.com`||(local&&/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)));
    check(!origin||allowed,'다른 사이트에서 요청할 수 없어요.',403);
    check(Number(req.headers.get('content-length')||0)<(upload?800000:100000),'입력 내용이 너무 길어요.');
  }
  // Firebase Hosting forwards only the __session cookie to dynamic backends.
  const cookie=req.headers.get('cookie')?.match(/(?:^|;\s*)__session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const token=cookie?await hash(cookie):'';
  const session=token?(await sessions.doc(token).get()).data():undefined;
  const liveSession=session&&session.expires>Date.now()?session:undefined;
  const body=req.method==='POST'&&!upload?await req.json() as any:{};
  const cookieHeader=(value:string,age=2592000)=>`__session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${url.protocol==='https:'?'; Secure':''}`;
  async function login(classId:string,role:'student'|'teacher') {
    const secret=random()+random(),sessionToken=await hash(secret),expires=Date.now()+30*86400000;
    const batch=db.batch();
    batch.set(sessions.doc(sessionToken),{classId,role,expires});
    batch.set(classes.doc(classId).collection('members').doc(sessionToken),{role,expires});
    await batch.commit();
    return json({ok:true},200,{'Set-Cookie':cookieHeader(secret)});
  }
  if(path==='create'&&req.method==='POST') {
    const password=str(body.password,100),className=str(body.className,40);
    check(password.length>=8,'교사용 비밀번호는 8자 이상 입력해 주세요.');check(className,'반 이름을 입력해 주세요.');
    await rateLimit(await hash('create:'+ip),10,3600000);
    const id=crypto.randomUUID(),code=random().slice(0,8).toUpperCase(),salt=random(),keys=webpush.generateVAPIDKeys();
    const passwordDigest=await passwordHash(password,salt);
    await db.runTransaction(async tx=>{
      const ref=db.collection('tripCodes').doc(code);
      check(!(await tx.get(ref)).exists,'반을 다시 만들어 주세요.',409);
      tx.create(ref,{classId:id});
      tx.create(classes.doc(id),{code,password:passwordDigest,salt,tripData:JSON.stringify({...defaultTrip,className}),vapidPublic:keys.publicKey,vapidPrivate:keys.privateKey,lastBroadcast:0});
    });
    return login(id,'teacher');
  }
  if(path==='join'&&req.method==='POST') {
    const code=str(body.code,8).toUpperCase(),role=body.role==='teacher'?'teacher':'student';
    check(/^[A-F0-9]{8}$/.test(code),'8자리 참여 코드를 확인해 주세요.');
    const aid=await hash(`join:${ip}:${code}:${role}`);
    await rateLimit(aid,8,900000);
    const codeEntry=(await db.collection('tripCodes').doc(code).get()).data();
    const c=codeEntry?(await classes.doc(codeEntry.classId).get()).data():undefined;
    check(c&&(role==='student'||await passwordHash(str(body.password,100),c.salt)===c.password),'참여 코드 또는 비밀번호가 맞지 않아요.',401);
    await db.collection('tripAttempts').doc(aid).delete();
    return login(codeEntry!.classId,role);
  }
  if(path==='session'&&!liveSession) return json({session:null});
  check(liveSession,'다시 입장해 주세요.',401);
  const classRef=classes.doc(liveSession.classId),c=(await classRef.get()).data();
  check(c,'반을 찾을 수 없어요.',404);
  const trip=normalizeTrip(JSON.parse(c.tripData)),teacher=liveSession.role==='teacher';
  const photoRef=(id:string)=>{check(uuid.test(id),'사진을 찾을 수 없어요.',404);return classRef.collection('photos').doc(id);};
  async function checkPhoto(photoUrl:string) {
    if(!photoUrl)return;
    check(/^\/api\/photos\/[a-f0-9-]{36}$/.test(photoUrl),'장소 사진을 다시 선택해 주세요.');
    const photo=(await photoRef(photoUrl.split('/').pop()!).get()).data();
    check(photo?.purpose==='meeting','우리 반 소집 장소용 사진을 선택해 주세요.',403);
  }
  const missionExists=(id:string)=>trip.days.some(day=>day.some(event=>event.missions.some(m=>m.id===id)));
  async function readPhoto(form:FormData) {
    const file=form.get('photo');check(file instanceof File,'사진을 선택해 주세요.');
    check(file.size>0&&file.size<=600000,'사진은 600KB 이하로 올려 주세요.');
    const bytes=Buffer.from(await file.arrayBuffer());
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
    check(jpeg||png||webp,'JPG, PNG, WebP 사진만 올릴 수 있어요.');
    return {contentType:jpeg?'image/jpeg':png?'image/png':'image/webp',bytes};
  }
  if(path.startsWith('photos/')&&req.method==='GET') {
    const photo=(await photoRef(path.slice(7)).get()).data();
    check(photo&&(photo.purpose==='meeting'||teacher||photo.ownerToken===token),'사진을 찾을 수 없어요.',404);
    return new Response(new Uint8Array(photo.bytes),{headers:{'Content-Type':photo.contentType,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
  }
  if(path.startsWith('alert/')&&req.method==='GET') {
    const id=path.slice(6);check(uuid.test(id),'알림을 찾을 수 없어요.',404);
    const alert=(await classRef.collection('alerts').doc(id).get()).data();check(alert,'소집 알림을 찾을 수 없어요.',404);
    return json({...alert,id,read:(alert.receipts||[]).includes(token),receipts:undefined});
  }
  if((path==='state'||path==='session')&&req.method==='GET') {
    const submissionQuery=teacher?classRef.collection('submissions'):classRef.collection('submissions').where('sessionToken','==',token);
    const [alerts,members,subscriptions,progress,submissions]=await Promise.all([
      classRef.collection('alerts').orderBy('created','desc').limit(20).get(),
      classRef.collection('members').get(),classRef.collection('subscriptions').get(),
      classRef.collection('progress').where('sessionToken','==',token).get(),submissionQuery.get()
    ]);
    const current=new Set(trip.days.flatMap(d=>d.flatMap(e=>e.missions.map(m=>m.id))));
    return json({role:liveSession.role,code:c.code,trip,
      alerts:alerts.docs.map(doc=>{const a=doc.data();return {id:doc.id,place:a.place,photoUrl:a.photoUrl||'',time:a.time,note:a.note,created:a.created,read:(a.receipts||[]).includes(token),...(teacher?{readCount:(a.receipts||[]).length}:{})};}),
      completedMissions:progress.docs.map(doc=>doc.data().missionId).filter(id=>current.has(id)),
      missionSubmissions:submissions.docs.map(doc=>({id:doc.id,missionId:doc.data().missionId as string,photoId:doc.data().photoId as string,submitted:doc.data().submitted as number})).filter(s=>current.has(s.missionId)).sort((a,b)=>b.submitted-a.submitted).map(s=>({id:s.id,missionId:s.missionId,photoUrl:'/api/photos/'+s.photoId,submitted:s.submitted})),
      vapidPublic:c.vapidPublic,studentCount:members.docs.filter(doc=>doc.data().role==='student'&&doc.data().expires>Date.now()).length,
      subscriberCount:subscriptions.size,pushEnabled:subscriptions.docs.some(doc=>doc.data().sessionToken===token)
    });
  }
  async function clearSubscriptions() {
    const subs=await classRef.collection('subscriptions').where('sessionToken','==',token).get();
    const batch=db.batch();subs.docs.forEach(doc=>batch.delete(doc.ref));await batch.commit();
  }
  if(path==='logout'&&req.method==='POST') {
    await clearSubscriptions();const batch=db.batch();batch.delete(sessions.doc(token));batch.delete(classRef.collection('members').doc(token));await batch.commit();
    return json({ok:true},200,{'Set-Cookie':cookieHeader('',0)});
  }
  if(path==='subscribe'&&req.method==='POST') {
    check(!teacher,'학생 모드에서 알림을 설정해 주세요.',403);const sub=body.subscription;
    check(sub&&typeof sub.endpoint==='string'&&sub.endpoint.length<=2000&&sub.keys,'알림 등록 정보를 확인해 주세요.');
    const endpoint=new URL(sub.endpoint),h=endpoint.hostname.toLowerCase();
    check(endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.port&&(h==='fcm.googleapis.com'||h==='web.push.apple.com'||h.endsWith('.push.apple.com')||h==='updates.push.services.mozilla.com'||h.endsWith('.notify.windows.com')),'지원하지 않는 알림 서비스예요.');
    check(/^[A-Za-z0-9_=-]{80,100}$/.test(sub.keys.p256dh)&&/^[A-Za-z0-9_=-]{20,30}$/.test(sub.keys.auth),'알림 인증 정보를 확인해 주세요.');
    await classRef.collection('subscriptions').doc(await hash(sub.endpoint)).set({sessionToken:token,subscription:{endpoint:sub.endpoint,keys:{p256dh:sub.keys.p256dh,auth:sub.keys.auth}}});
    return json({ok:true});
  }
  if(path==='unsubscribe'&&req.method==='POST') {await clearSubscriptions();return json({ok:true});}
  if(path==='ack'&&req.method==='POST') {
    check(!teacher,'학생만 확인할 수 있어요.',403);const id=str(body.id,40);check(uuid.test(id),'알림을 찾을 수 없어요.',404);
    const ref=classRef.collection('alerts').doc(id);
    await db.runTransaction(async tx=>{const a=(await tx.get(ref)).data();check(a,'알림을 찾을 수 없어요.',404);tx.update(ref,{receipts:[...new Set([...(a.receipts||[]),token])]});});
    return json({ok:true});
  }
  if(path==='mission'&&req.method==='POST') {
    check(!teacher,'학생만 미션 완료를 표시할 수 있어요.',403);const id=str(body.id,100);check(missionExists(id),'미션을 찾을 수 없어요.',404);check(typeof body.completed==='boolean','완료 여부를 확인해 주세요.');
    const ref=classRef.collection('progress').doc(await progressId(token,id));
    if(body.completed)await ref.set({sessionToken:token,missionId:id});else await ref.delete();return json({ok:true});
  }
  if(path==='mission-photo'&&req.method==='POST') {
    check(!teacher,'학생 모드에서 미션 사진을 제출해 주세요.',403);
    const form=await req.formData(),missionId=str(form.get('missionId'),100);check(missionExists(missionId),'미션을 찾을 수 없어요.',404);
    const photo=await readPhoto(form),id=await progressId(token,missionId),photoId=crypto.randomUUID(),submitted=Date.now();
    const ref=classRef.collection('submissions').doc(id);
    await db.runTransaction(async tx=>{
      const old=(await tx.get(ref)).data();
      tx.set(photoRef(photoId),{...photo,purpose:'mission',ownerToken:token});
      tx.set(ref,{missionId,sessionToken:token,photoId,submitted});
      tx.set(classRef.collection('progress').doc(id),{sessionToken:token,missionId});
      if(old)tx.delete(photoRef(old.photoId));
    });
    return json({ok:true,photoUrl:'/api/photos/'+photoId});
  }
  if(path==='mission-photo/remove'&&req.method==='POST') {
    check(!teacher,'본인의 미션 사진만 지울 수 있어요.',403);const missionId=str(body.missionId,100),id=await progressId(token,missionId),ref=classRef.collection('submissions').doc(id);
    await db.runTransaction(async tx=>{const old=(await tx.get(ref)).data();check(old&&old.sessionToken===token,'제출한 사진을 찾을 수 없어요.',404);tx.delete(ref);tx.delete(photoRef(old.photoId));tx.delete(classRef.collection('progress').doc(id));});
    return json({ok:true});
  }
  check(teacher,'선생님만 변경할 수 있어요.',403);
  if(path==='photos'&&req.method==='POST') {
    const photo=await readPhoto(await req.formData()),id=crypto.randomUUID();await photoRef(id).set({...photo,purpose:'meeting'});return json({photoUrl:'/api/photos/'+id});
  }
  if(path==='settings'&&req.method==='POST') {
    const next=validateTrip(body.trip);await checkPhoto(next.meeting.photoUrl);await classRef.update({tripData:JSON.stringify(next)});return json({ok:true});
  }
  if(path==='broadcast'&&req.method==='POST') {
    const place=str(body.place,100),photoUrl=str(body.photoUrl||'',100),meetingTime=time(body.time),note=str(body.note,200);
    check(place,'소집 장소를 입력해 주세요.');await checkPhoto(photoUrl);
    const id=crypto.randomUUID(),created=Date.now(),meeting={place,photoUrl,time:meetingTime,note};
    await db.runTransaction(async tx=>{
      const current=(await tx.get(classRef)).data();check(current,'반을 찾을 수 없어요.',404);
      check(!current.lastBroadcast||created-current.lastBroadcast>5000,'방금 알림을 보냈어요. 5초 후 다시 보내 주세요.',429);
      tx.create(classRef.collection('alerts').doc(id),{...meeting,created,receipts:[]});
      const next=normalizeTrip(JSON.parse(current.tripData));next.meeting=meeting;
      tx.update(classRef,{tripData:JSON.stringify(next),lastBroadcast:created});
    });
    const subs=await classRef.collection('subscriptions').get();let accepted=0,failed=0;
    await Promise.all(subs.docs.map(async doc=>{
      try {
        const details=webpush.generateRequestDetails(doc.data().subscription,JSON.stringify({id,title:gatherTitle(place),body:`${meetingTime}까지 ${note}`,image:photoUrl,url:'/?notice='+id}),{TTL:600,urgency:'high',vapidDetails:{subject:url.origin,publicKey:c.vapidPublic,privateKey:c.vapidPrivate}});
        const result=await fetch(details.endpoint,{method:details.method,headers:details.headers as HeadersInit,body:details.body as unknown as BodyInit,signal:AbortSignal.timeout(10000),redirect:'error'});
        if(result.ok)accepted++;else {failed++;if(result.status===404||result.status===410)await doc.ref.delete();}
      } catch {failed++;}
    }));
    return json({ok:true,accepted,failed,registered:subs.size});
  }
  return json({error:'요청을 찾을 수 없어요.'},404);
}
