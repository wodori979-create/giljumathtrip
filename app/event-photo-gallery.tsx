import {useLayoutEffect,useRef,useState} from 'react';
import {X,ZoomIn,ZoomOut} from 'lucide-react';
export type EventPhoto={src:string;alt:string};
export default function EventPhotoGallery({photos}:{photos:EventPhoto[]}){
 const dialog=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null);
 const [selected,setSelected]=useState<EventPhoto|null>(null),[zoom,setZoom]=useState(1),[width,setWidth]=useState(0),[fit,setFit]=useState(1);
 useLayoutEffect(()=>{if(selected){dialog.current?.showModal();dialog.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});}else dialog.current?.close();},[selected]);
 function open(photo:EventPhoto){setWidth(0);setZoom(1);setSelected(photo);}
 function close(){setSelected(null);}
 return <><div className="event-photo-gallery">{photos.map(photo=><button type="button" className="event-photo-card" key={photo.src} aria-label={photo.alt+' 크게 보기'} onClick={()=>open(photo)}><img loading="lazy" src={photo.src} alt={photo.alt}/><span>{photo.alt}<ZoomIn size={17}/></span></button>)}</div>
 <dialog ref={dialog} className="event-photo-viewer" aria-label={selected?.alt||'사진 크게 보기'} onCancel={event=>{event.preventDefault();close();}}><header><strong>{selected?.alt}</strong><button type="button" aria-label="확대 사진 닫기" onClick={close}><X size={23}/></button></header><div className="event-photo-tools"><button type="button" aria-label="사진 축소" disabled={zoom<=1} onClick={()=>setZoom(value=>Math.max(1,value-.5))}><ZoomOut size={20}/></button><span>{Math.round(zoom*100)}%</span><button type="button" aria-label="사진 확대" disabled={zoom>=4} onClick={()=>setZoom(value=>Math.min(4,value+.5))}><ZoomIn size={20}/></button><span>확대 후 사진을 밀어서 보세요.</span></div><div className="event-photo-viewport" ref={viewport}>{selected&&<img key={selected.src} src={selected.src} alt={selected.alt} style={width?{width:width*fit*zoom,maxWidth:'none'}:{maxWidth:'100%'}} onLoad={event=>{const image=event.currentTarget,box=viewport.current;if(!box)return;setWidth(image.naturalWidth);setFit(Math.min(1,(box.clientWidth-24)/image.naturalWidth,(box.clientHeight-24)/image.naturalHeight));}}/>}</div></dialog></>;
}
