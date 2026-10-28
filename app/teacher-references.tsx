import {useEffect,useRef} from 'react';
import {FileText} from 'lucide-react';
import {api} from '@/lib/trip-api';
import {teacherMaterials} from '@/lib/teacher-materials';
import EventPhotoGallery,{type EventPhoto} from './event-photo-gallery';

export default function TeacherReferences(){
 const urls=useRef<string[]>([]),active=useRef(true),cached=useRef(new Map<string,EventPhoto>()),assets=useRef(new Map<string,Promise<string>>());
 useEffect(()=>{active.current=true;return()=>{active.current=false;urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];assets.current.clear();cached.current.clear();};},[]);
 function asset(key:string,fetchData:()=>Promise<string>){
  const existing=assets.current.get(key);if(existing)return existing;
  const request=fetchData().then(value=>{
   if(!active.current)throw new Error('참고자료 탭에서 다시 열어 주세요.');
   const [prefix,encoded]=value.split(','),bytes=Uint8Array.from(atob(encoded),character=>character.charCodeAt(0));
   const url=URL.createObjectURL(new Blob([bytes],{type:prefix.match(/^data:([^;]+)/)?.[1]||'application/octet-stream'}));urls.current.push(url);return url;
  }).catch(error=>{assets.current.delete(key);throw error;});
  assets.current.set(key,request);return request;
 }
 async function load(id:string,title:string):Promise<EventPhoto>{
  const existing=cached.current.get(id);if(existing)return existing;
  const data=await api('teacher/reference',{id});
  if(!active.current)throw new Error('참고자료 탭에서 다시 열어 주세요.');
  const photo:EventPhoto={src:id,alt:title,pageAspectRatio:teacherMaterials.find(material=>material.id===id)!.pageAspectRatio,pages:Array(data.pageCount).fill(''),
   loadPage:index=>asset(id+':page:'+index,()=>api('teacher/reference/page',{id,index})),
   loadOriginal:()=>asset(id+':pdf',()=>api('teacher/reference/pdf',{id})),
  };
  cached.current.set(id,photo);return photo;
 }
 return <section className="teacher-references"><div className="page-heading"><div><h1>참고자료</h1><p>파일을 누르면 전체화면으로 확인할 수 있어요.</p></div><FileText size={30} aria-hidden="true"/></div><section className="card reference-card"><h2>교사용 PDF 자료</h2><EventPhotoGallery photos={teacherMaterials.map(material=>({src:material.id,alt:material.title,pdfLabel:'PDF 참고자료',pageAspectRatio:material.pageAspectRatio,pages:Array(material.pageCount).fill(''),load:()=>load(material.id,material.title)}))}/></section></section>;
}
