import {useEffect,useRef,useState,type ReactNode} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {X,Share2,Copy,Check} from 'lucide-react';

function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLButtonElement>('button')?.focus();const handle=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();onClose();}if(e.key==='Tab'){const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href]')||[]),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',handle,true);return()=>{document.removeEventListener('keydown',handle,true);previous?.focus();};},[onClose]);
 return <div className="modal-backdrop" onClick={onClose}><section ref={ref} className="modal travel-guide" role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><button className="close" aria-label="닫기" onClick={onClose}><X/></button><h2>{title}</h2>{children}</section></div>;
}
export function ShareTrip(){
 const [open,setOpen]=useState(false),[copied,setCopied]=useState(false),[message,setMessage]=useState('');
 const url='https://gilju-grade6-trip-2026.web.app/';
 async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setMessage('링크를 복사했어요.');}catch{setMessage('아래 링크를 길게 누르거나 선택해서 복사해 주세요.');}}
 async function share(){if(!navigator.share){await copy();return;}try{await navigator.share({title:'길주초 6학년, 여행중!',url});}catch(e){if((e as Error).name!=='AbortError')setMessage('공유가 어려우면 링크를 복사해 주세요.');}}
 return <><button className="button outline welcome-share" onClick={()=>setOpen(true)}><Share2 size={17}/><span>QR · 링크 공유</span></button>{open&&<Dialog title="함께 여행할 친구에게 공유해요" onClose={()=>setOpen(false)}><p>QR 코드를 카메라로 비추거나 링크를 보내 주세요.</p><div className="share-qr"><QRCodeSVG value={url} size={208} level="M" marginSize={4} title="길주초 여행 앱 접속 QR 코드"/></div><label className="field"><span>앱 링크</span><input readOnly value={url} onFocus={e=>e.target.select()}/></label><div className="guide-actions"><button className="button outline" onClick={copy}>{copied?<Check size={17}/>:<Copy size={17}/>} 링크 복사</button><button className="button teal" onClick={share}><Share2 size={17}/> 공유하기</button></div><p role="status">{message}</p></Dialog>}</>;
}
