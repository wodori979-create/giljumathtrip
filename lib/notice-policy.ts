import type {Alert} from './trip';

// Gathering times belong to the alert's creation date in Korea.
export function isCurrentNotice(alert:Alert,now=Date.now()):boolean{
 if(alert.read||!Number.isFinite(alert.created)||alert.created<=0||alert.created>now+30000||now-alert.created>600000)return false;
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(alert.time))return false;
 const day=new Date(alert.created+9*3600000),[hour,minute]=alert.time.split(':').map(Number);
 const deadline=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),hour-9,minute+1);
 return now<deadline;
}
export function incomingNotice(alerts:Alert[],knownIds:Set<string>,enteredAt:number,now=Date.now()):Alert|undefined{
 return alerts.find(alert=>!knownIds.has(alert.id)&&alert.created>=enteredAt&&isCurrentNotice(alert,now));
}
