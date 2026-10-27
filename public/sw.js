self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let notice;try{notice=event.data.json();}catch{return;}
  if(!notice||!/^\w{8}$/.test(notice.code)||! /^[a-f0-9-]{36}$/.test(notice.notice))return;
  event.waitUntil(self.registration.showNotification(String(notice.title||'선생님이 부르셨어요!'),{
    body:String(notice.body||''),icon:'/icon-192.png',badge:'/icon-192.png',
    tag:'gilju-'+notice.code+'-'+notice.notice,renotify:false,
    data:{code:notice.code,notice:notice.notice},
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const data=event.notification.data;
  if(!data||! /^[a-f0-9-]{36}$/.test(data.notice))return;
  const url=new URL('/?notice='+encodeURIComponent(data.notice),self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows)if(new URL(client.url).origin===self.location.origin){
      await client.focus();client.postMessage({type:'GILJU_NOTICE',code:data.code,notice:data.notice});return;
    }
    await self.clients.openWindow(url);
  })());
});
