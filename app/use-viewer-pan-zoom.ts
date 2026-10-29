import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent,type DragEvent,type RefObject} from 'react';

type Point={x:number;y:number;time:number};
export default function useViewerPanZoom(viewport:RefObject<HTMLDivElement|null>){
 const [zoom,setZoom]=useState(1),[dragging,setDragging]=useState(false);
 const currentZoom=useRef(1),points=useRef(new Map<number,Point>()),pinch=useRef<{distance:number;zoom:number}|null>(null),momentum=useRef(0);
 const velocity=useRef({x:0,y:0,time:0});
 const anchor=useRef<{x:number;y:number;localX:number;localY:number;bottom:boolean}|null>(null);
 function stop(){cancelAnimationFrame(momentum.current);momentum.current=0;}
 function reset(){stop();points.current.clear();pinch.current=null;anchor.current=null;currentZoom.current=1;setZoom(1);setDragging(false);}
 function zoomTo(value:number,clientX?:number,clientY?:number){
  const next=Math.max(1,Math.min(8,value)),box=viewport.current;if(next===currentZoom.current)return;
  if(box){const rect=box.getBoundingClientRect(),x=clientX===undefined?box.clientWidth/2:clientX-rect.left,y=clientY===undefined?box.clientHeight/2:clientY-rect.top;
   anchor.current={x:(box.scrollLeft+x)/box.scrollWidth,y:(box.scrollTop+y)/box.scrollHeight,localX:x,localY:y,bottom:box.scrollHeight>box.clientHeight+2&&box.scrollHeight-box.clientHeight-box.scrollTop<2};}
  currentZoom.current=next;setZoom(next);
 }
 useLayoutEffect(()=>{const box=viewport.current,position=anchor.current;if(!box||!position)return;box.scrollLeft=position.x*box.scrollWidth-position.localX;box.scrollTop=position.bottom?box.scrollHeight:position.y*box.scrollHeight-position.localY;anchor.current=null;},[zoom]);
 useEffect(()=>()=>stop(),[]);
 function pointerDown(event:PointerEvent<HTMLDivElement>){
  if(event.button!==0||(event.target as HTMLElement).closest('button,a,input'))return;
  stop();velocity.current={x:0,y:0,time:event.timeStamp};points.current.set(event.pointerId,{x:event.clientX,y:event.clientY,time:event.timeStamp});event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);
  if(points.current.size===2){const [a,b]=[...points.current.values()];pinch.current={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:currentZoom.current};}
 }
 function pointerMove(event:PointerEvent<HTMLDivElement>){
  const before=points.current.get(event.pointerId),box=viewport.current;if(!before||!box)return;
  event.preventDefault();points.current.set(event.pointerId,{x:event.clientX,y:event.clientY,time:event.timeStamp});
  if(points.current.size>=2&&pinch.current){const [a,b]=[...points.current.values()];zoomTo(pinch.current.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.current.distance,(a.x+b.x)/2,(a.y+b.y)/2);velocity.current={x:0,y:0,time:event.timeStamp};return;}
  const left=box.scrollLeft,top=box.scrollTop,elapsed=Math.max(1,event.timeStamp-before.time);
  box.scrollLeft+=before.x-event.clientX;box.scrollTop+=before.y-event.clientY;
  velocity.current={x:.5*velocity.current.x+.5*(box.scrollLeft-left)/elapsed,y:.5*velocity.current.y+.5*(box.scrollTop-top)/elapsed,time:event.timeStamp};
 }
 function pointerUp(event:PointerEvent<HTMLDivElement>){
  if(!points.current.delete(event.pointerId))return;
  pinch.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(points.current.size)return;
  setDragging(false);const speed=velocity.current;
  if(event.type==='pointercancel'||event.pointerType==='mouse'||event.timeStamp-speed.time>80)return;
  let last=performance.now(),x=speed.x,y=speed.y;
  const step=(now:number)=>{const box=viewport.current;if(!box)return;const elapsed=Math.min(32,now-last);last=now;const left=box.scrollLeft,top=box.scrollTop;box.scrollLeft+=x*elapsed;box.scrollTop+=y*elapsed;const friction=Math.pow(.9,elapsed/16.7);x*=friction;y*=friction;if((Math.abs(x)+Math.abs(y)>.03)&&(box.scrollLeft!==left||box.scrollTop!==top))momentum.current=requestAnimationFrame(step);};
  momentum.current=requestAnimationFrame(step);
 }
 return {zoom,reset,zoomIn:()=>{stop();zoomTo(currentZoom.current+.5);},zoomOut:()=>{stop();zoomTo(currentZoom.current-.5);},dragging,handlers:{onPointerDown:pointerDown,onPointerMove:pointerMove,onPointerUp:pointerUp,onPointerCancel:pointerUp,onLostPointerCapture:pointerUp,onDragStart:(event:DragEvent)=>event.preventDefault()}};
}
