import {useEffect,useRef,useState} from 'react';
import {LoaderCircle} from 'lucide-react';

export default function PdfPage({index,count,title,ratio,loadPage,root}:{index:number;count:number;title:string;ratio:number;loadPage:(index:number)=>Promise<string>;root:HTMLElement|null}){
 const container=useRef<HTMLElement>(null);
 const [src,setSrc]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true,started=false;
  setError('');
  async function read(){if(started)return;started=true;try{const url=await loadPage(index);if(active)setSrc(url);}catch(error){if(active)setError((error as Error).message||'페이지를 불러오지 못했어요.');}}
  if(index===0||!('IntersectionObserver'in window))void read();
  const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){void read();observer?.disconnect();}},{root,rootMargin:'200px'}):null;
  if(container.current)observer?.observe(container.current);
  return()=>{active=false;observer?.disconnect();};
 },[index,loadPage,root,retry]);
 return <figure ref={container}><div className="pdf-page-surface" style={{aspectRatio:ratio}}>{src?<img src={src} alt={`${title} · ${index+1}페이지`} decoding="async"/>:error?<div className="pdf-page-status" role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>페이지 다시 불러오기</button></div>:<div className="pdf-page-status" role="status"><LoaderCircle size={22} className="spin"/><span>{index+1}페이지 불러오는 중…</span></div>}</div><figcaption>{index+1} / {count}페이지</figcaption></figure>;
}
