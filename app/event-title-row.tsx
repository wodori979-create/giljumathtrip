import {useLayoutEffect,useRef,useState} from 'react';
import {ChevronRight} from 'lucide-react';
import FitLine from './fit-line';
export default function EventTitleRow({title,onOpen,compact=false}:{title:string;onOpen:()=>void;compact?:boolean}){
 const row=useRef<HTMLHeadingElement>(null),probe=useRef<HTMLSpanElement>(null),button=useRef<HTMLButtonElement>(null);
 const [inline,setInline]=useState(false);
 useLayoutEffect(()=>{
  const measure=()=>{if(row.current&&probe.current&&button.current)setInline(probe.current.getBoundingClientRect().width+button.current.getBoundingClientRect().width+24<=row.current.clientWidth);};
  const observer=new ResizeObserver(measure);if(row.current)observer.observe(row.current);if(probe.current)observer.observe(probe.current);measure();document.fonts.addEventListener('loadingdone',measure);
  return()=>{observer.disconnect();document.fonts.removeEventListener('loadingdone',measure);};
 },[title]);
 return <h3 ref={row} className={'event-name-row '+(inline||compact?'event-name-inline':'')+(compact?' event-title-compact':'')}><FitLine text={title} maxFontSize={compact?18:22}/><button ref={button} type="button" className="event-more-button" aria-label={title+' 자세히 보기'} onClick={onOpen}>자세히 보기<ChevronRight size={16}/></button><span className="event-title-probe-box" aria-hidden="true"><span ref={probe}>{title}</span></span></h3>;
}
