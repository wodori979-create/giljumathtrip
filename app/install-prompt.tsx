import {useEffect,useRef,useState} from 'react';
import {Download,MoreVertical,Share,Smartphone,X} from 'lucide-react';

type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
const HIDDEN='gilju-install-hidden-v1',LATER='gilju-install-later-v1';
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;
function dismissed(){try{return localStorage.getItem(HIDDEN)==='true'||sessionStorage.getItem(LATER)==='true';}catch{return false;}}

export default function InstallPrompt(){
 const dialog=useRef<HTMLDialogElement>(null),pending=useRef<InstallEvent|null>(null),closed=useRef(false);
 const [open,setOpen]=useState(false),[canInstall,setCanInstall]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const mobile=ios||/Android/i.test(navigator.userAgent);
 useEffect(()=>{
  if(!mobile||standalone())return;
  if(!dismissed())setOpen(true);
  const offer=(event:Event)=>{if(standalone()||closed.current||dismissed())return;event.preventDefault();pending.current=event as InstallEvent;setCanInstall(true);setMessage('');setOpen(true);};
  const installed=()=>{pending.current=null;setCanInstall(false);setOpen(false);};
  const media=window.matchMedia('(display-mode: standalone)');
  const changed=()=>{if(standalone())installed();};
  window.addEventListener('beforeinstallprompt',offer);window.addEventListener('appinstalled',installed);media.addEventListener?.('change',changed);
  return()=>{window.removeEventListener('beforeinstallprompt',offer);window.removeEventListener('appinstalled',installed);media.removeEventListener?.('change',changed);};
 },[mobile]);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();else if(!open&&dialog.current?.open)dialog.current.close();},[open]);
 function close(permanent=false){closed.current=true;try{sessionStorage.setItem(LATER,'true');if(permanent)localStorage.setItem(HIDDEN,'true');}catch{}setOpen(false);}
 async function install(){
  const event=pending.current;if(!event||busy)return;setBusy(true);setMessage('');
  try{
   // Chrome requires the native prompt to be invoked directly by this tap.
   await event.prompt();const choice=await event.userChoice;pending.current=null;setCanInstall(false);
   if(choice.outcome==='accepted')setOpen(false);else close();
  }catch{pending.current=null;setCanInstall(false);setMessage('설치 창을 열지 못했어요. 아래 방법으로 홈 화면에 추가해 주세요.');}
  finally{setBusy(false);}
 }
 if(!mobile)return null;
 return <dialog ref={dialog} className="install-dialog" aria-labelledby="install-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
  <button className="install-close" aria-label="설치 안내 닫기" onClick={()=>close()}><X size={20}/></button>
  <div className="install-symbol"><Smartphone size={30}/></div><h2 id="install-title">홈 화면에 여행 앱을 담아요</h2>
  <p>아이콘을 누르면 우리 반 여행 수첩을 바로 열 수 있어요.</p>
  {ios?<ol><li><Share size={19}/><span>Safari의 <b>공유</b> 버튼을 눌러요.</span></li><li><span className="install-step">＋</span><span><b>홈 화면에 추가</b> → <b>추가</b>를 눌러요.<small>안 보이면 공유 메뉴를 아래로 내려 보세요.</small></span></li><li><Smartphone size={19}/><span>홈 화면의 <b>길주초 여행중!</b> 아이콘으로 열어요.</span></li></ol>:<><ol><li><MoreVertical size={19}/><span>Chrome의 <b>⋮ 메뉴</b>를 눌러요.</span></li><li><Download size={19}/><span><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택해요.</span></li></ol>{canInstall&&<button className="button teal full" disabled={busy} onClick={install}><Download size={18}/>{busy?'설치 창 여는 중…':'앱 설치'}</button>}</>}
  {message&&<p className="install-message" role="status">{message}</p>}
  <div className="install-actions"><button className="text-btn" onClick={()=>close()}>나중에</button><button className="text-btn" onClick={()=>close(true)}>다시 보지 않기</button></div>
 </dialog>;
}
