import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {X,ZoomIn,ZoomOut,FileText,ExternalLink,LoaderCircle} from 'lucide-react';
import PdfPage from './pdf-page';
import useViewerPanZoom from './use-viewer-pan-zoom';
export type EventPhoto={src:string;alt:string;pages?:string[];pageAspectRatio?:number;pdfLabel?:string;load?:()=>Promise<EventPhoto>;loadPage?:(index:number)=>Promise<string>;loadOriginal?:()=>Promise<string>};
export default function EventPhotoGallery({photos}:{photos:EventPhoto[]}){
 const dialog=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null),request=useRef(0);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[originalBusy,setOriginalBusy]=useState(false),[originalUrl,setOriginalUrl]=useState('');
 const [selected,setSelected]=useState<EventPhoto|null>(null),[width,setWidth]=useState(0),[fit,setFit]=useState(1);
 const navigation=useViewerPanZoom(viewport),{zoom}=navigation;
 useEffect(()=>()=>{request.current++;},[]);
 useLayoutEffect(()=>{if(!selected)return;const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=before;};},[!!selected]);
 useLayoutEffect(()=>{if(selected){dialog.current?.showModal();viewport.current?.scrollTo(0,0);dialog.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});}else dialog.current?.close();},[selected]);
 useLayoutEffect(()=>{
  if(!selected||!window.visualViewport)return;
  const screen=window.visualViewport;
  const fitScreen=()=>{const element=dialog.current;if(!element)return;element.style.width=screen.width+'px';element.style.height=screen.height+'px';element.style.top=screen.offsetTop+'px';element.style.left=screen.offsetLeft+'px';};
  fitScreen();screen.addEventListener('resize',fitScreen);screen.addEventListener('scroll',fitScreen);
  return()=>{screen.removeEventListener('resize',fitScreen);screen.removeEventListener('scroll',fitScreen);};
 },[selected]);
 async function open(photo:EventPhoto){
  const own=++request.current;setError('');setOriginalUrl('');setOriginalBusy(false);setWidth(0);navigation.reset();setSelected(photo);setLoading(!!photo.load);
  if(!photo.load)return;
  try{const ready=await photo.load();if(request.current===own)setSelected(ready);}catch(e){if(request.current===own)setError((e as Error).message||'자료를 불러오지 못했어요. 다시 눌러 주세요.');}finally{if(request.current===own)setLoading(false);}
 }
 function close(){navigation.reset();request.current++;setSelected(null);setLoading(false);setError('');setOriginalBusy(false);setOriginalUrl('');}
 async function openOriginal(){
  if(!selected?.loadOriginal)return;
  const own=request.current,popup=window.open('about:blank','_blank');
  if(popup){popup.opener=null;popup.document.body.textContent='원본 PDF를 불러오고 있어요.';}
  setOriginalBusy(true);setError('');
  try{const url=await selected.loadOriginal();if(popup&&!popup.closed)popup.location.replace(url);if(request.current===own)setOriginalUrl(url);}catch(e){popup?.close();if(request.current===own)setError((e as Error).message||'원본 PDF를 불러오지 못했어요. 다시 눌러 주세요.');}finally{if(request.current===own)setOriginalBusy(false);}
 }
 return <><div className="event-photo-gallery">{photos.map(photo=><button type="button" className="event-photo-card" key={photo.src} disabled={loading} aria-label={photo.alt+' 크게 보기'} onClick={()=>open(photo)}>{photo.pages?<div className="event-pdf-cover"><FileText size={48}/><b>{photo.pdfLabel||'PDF 가이드맵'}</b><small>{photo.pages.length}페이지 · 눌러서 전체화면 보기</small></div>:<img loading="lazy" src={photo.src} alt={photo.alt}/>}<span>{photo.alt}<ZoomIn size={17}/></span></button>)}</div>
 <dialog ref={dialog} className="event-photo-viewer" aria-label={selected?.alt||'사진 크게 보기'} onCancel={event=>{event.preventDefault();close();}}>
  <header><strong>{selected?.alt}</strong><button type="button" aria-label="전체화면 닫기" onClick={close}><X size={23}/></button></header>
  <div className="event-photo-tools">
   {selected?.pages&&<><span>{selected.pages.length}페이지 · 아래로 스크롤해서 보세요.</span>{!loading&&!(error&&selected.load)&&(selected.loadOriginal&&!originalUrl?<button type="button" className="pdf-original-button" disabled={originalBusy} onClick={openOriginal}>{originalBusy?'원본 PDF 불러오는 중…':'원본 PDF 열기'}<ExternalLink size={15}/></button>:<a href={originalUrl||selected.src} target="_blank" rel="noopener noreferrer">원본 PDF 열기<ExternalLink size={15}/></a>)}</>}
   <div className="event-photo-zoom" role="group" aria-label="화면 배율"><button type="button" aria-label="사진 축소" disabled={zoom<=1} onClick={navigation.zoomOut}><ZoomOut size={20}/></button><span>{Math.round(zoom*100)}%</span><button type="button" aria-label="사진 확대" disabled={zoom>=8} onClick={navigation.zoomIn}><ZoomIn size={20}/></button></div><span>두 손가락으로 확대 · 한 손가락으로 이동</span>
  </div>
  {error&&<div className="pdf-load-error" role="alert"><p>{error}</p>{selected?.load&&<button type="button" onClick={()=>open(selected)}>자료 다시 불러오기</button>}</div>}
  <div className={'event-photo-viewport '+(navigation.dragging?'is-panning':'')} ref={viewport} {...navigation.handlers} tabIndex={0} aria-label="자료 스크롤 영역">
   {loading?<div className="pdf-page-status" role="status"><LoaderCircle size={24} className="spin"/><span>자료를 불러오고 있어요.</span></div>:!(error&&selected?.load)&&selected?.pages?<div className="pdf-page-stack" style={{width:`${zoom*100}%`}}>{selected.pages.map((src,index)=>selected.loadPage?<PdfPage key={index} index={index} count={selected.pages!.length} title={selected.alt} ratio={selected.pageAspectRatio||595/841} loadPage={selected.loadPage} root={viewport.current}/>:<figure key={src}><img loading={index===0?'eager':'lazy'} decoding="async" src={src} alt={`${selected.alt} · ${index+1}페이지`} style={{aspectRatio:`auto ${selected.pageAspectRatio||595/841}`}}/><figcaption>{index+1} / {selected.pages!.length}페이지</figcaption></figure>)}</div>:!(error&&selected?.load)&&selected&&<img key={selected.src} src={selected.src} alt={selected.alt} style={width?{width:width*fit*zoom,maxWidth:'none'}:{maxWidth:'100%'}} onLoad={event=>{const image=event.currentTarget,box=viewport.current;if(!box)return;setWidth(image.naturalWidth);setFit(Math.max(.01,Math.min(1,(box.clientWidth-24)/image.naturalWidth,(box.clientHeight-24)/image.naturalHeight)));}}/>}
  </div>
 </dialog></>;
}
