import {useLayoutEffect,useRef} from 'react';

// Measure only the small schedule text rows; this does not fetch any app data.
export default function FitLine({text,maxFontSize=22}:{text:string;maxFontSize?:number}){
 const container=useRef<HTMLSpanElement>(null),content=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{
  let active=true,frame=0;
  const fit=()=>{
   const box=container.current,label=content.current;if(!active||!box||!label||!box.isConnected)return;
   const available=box.getBoundingClientRect().width;if(available<=0)return;
   label.style.fontSize=maxFontSize+'px';
   const natural=label.getBoundingClientRect().width;
   let size=natural>available?Math.max(.5,Math.floor(maxFontSize*available/natural*10)/10):maxFontSize;
   label.style.fontSize=size+'px';
   // Account for fractional glyph rounding without clipping the final character.
   while(size>.5&&label.getBoundingClientRect().width>available){size=Math.max(.5,Math.round((size-.1)*10)/10);label.style.fontSize=size+'px';}
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);};
  fit();const observer=new ResizeObserver(schedule);if(container.current)observer.observe(container.current);
  document.fonts.ready.then(()=>{if(active)schedule();});document.fonts.addEventListener('loadingdone',schedule);window.addEventListener('resize',schedule);
  return()=>{active=false;observer.disconnect();cancelAnimationFrame(frame);document.fonts.removeEventListener('loadingdone',schedule);window.removeEventListener('resize',schedule);};
 },[text,maxFontSize]);
 return <span ref={container} className="fit-line"><span ref={content} className="fit-line-text">{text}</span></span>;
}
