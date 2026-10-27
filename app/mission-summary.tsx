import {useLayoutEffect,useRef,useState} from 'react';
import {Target} from 'lucide-react';
import type {Mission} from '@/lib/trip';
import FitLine from './fit-line';
export default function MissionSummary({missions,onOpen}:{missions:Mission[];onOpen:()=>void}){
 const row=useRef<HTMLDivElement>(null),probe=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 const [inline,setInline]=useState(false);
 const titles=missions.map(m=>m.title).join('\n');
 useLayoutEffect(()=>{
  const measure=()=>{if(!row.current||!probe.current||!button.current)return;const longest=Math.max(0,...Array.from(probe.current.children,e=>e.getBoundingClientRect().width));setInline(longest+button.current.getBoundingClientRect().width+24<=row.current.clientWidth);};
  const observer=new ResizeObserver(measure);if(row.current)observer.observe(row.current);if(probe.current)observer.observe(probe.current);measure();document.fonts.addEventListener('loadingdone',measure);
  return()=>{observer.disconnect();document.fonts.removeEventListener('loadingdone',measure);};
 },[titles]);
 if(!missions.length)return null;
 return <div className="schedule-mission-summary"><span><Target size={15}/>{missions.length}개의 여행 미션</span><div className={'mission-summary-row '+(inline?'mission-summary-inline':'')} ref={row}><div className="summary-mission-lines">{missions.map(m=><FitLine key={m.id} text={m.title}/>)}</div><button ref={button} type="button" className="mission-shortcut" onClick={onOpen}>바로가기</button><div ref={probe} className="mission-width-probe" aria-hidden="true">{missions.map(m=><span key={m.id}>{m.title}</span>)}</div></div></div>;
}
