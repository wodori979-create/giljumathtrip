self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={title:'길주초 6학년, 여행중!',body:'선생님이 새 소집 안내를 보냈어요.',url:'/'};
 try{data={...data,...event.data.json()}}catch{}
 const options={body:data.body,icon:'/icon-192.png',badge:'/icon-192.png',tag:data.id||'trip-alert',requireInteraction:true,data:{url:data.url},vibrate:[200,100,200]};
 if(typeof data.image==='string'&&/^\/api\/photos\/[a-f0-9-]{36}$/.test(data.image))options.image=data.image;
 event.waitUntil(self.registration.showNotification(data.title,options));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const target=new URL(event.notification.data?.url||'/',self.location.origin);if(target.origin!==self.location.origin)return;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(c=>new URL(c.url).origin===target.origin);if(client){await client.navigate(target.href);return client.focus()}return self.clients.openWindow(target.href);}));
});
