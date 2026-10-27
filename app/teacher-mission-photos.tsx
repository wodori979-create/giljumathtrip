import {useEffect,useRef,useState} from 'react';
import {LoaderCircle,RefreshCw} from 'lucide-react';
import {api} from '@/lib/trip-api';
import type {MissionSubmission} from '@/lib/trip';

type Page={items:MissionSubmission[];cursor:string|null;hasMore:boolean;index:number};
export default function TeacherMissionPhotos({code,missionId,demo=false,demoPhotos=[]}:{code:string;missionId:string;demo?:boolean;demoPhotos?:MissionSubmission[]}){
 const [page,setPage]=useState<Page>({items:[],cursor:null,hasMore:false,index:0}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 const cursors=useRef<Array<string|null>>([null]),active=useRef(true),generation=useRef(0),currentIndex=useRef(0);
 async function load(cursor:string|null,index:number){
  const own=++generation.current;setLoading(true);setError('');setMessage('');
  try{
   const offset=Number(cursor||0);
   const result=demo?{items:demoPhotos.slice(offset,offset+12),cursor:String(offset+12),hasMore:offset+12<demoPhotos.length}:await api('mission/submissions',{missionId,cursor});
   if(!active.current||own!==generation.current)return;
   if(index>currentIndex.current&&!result.items.length){setPage(previous=>({...previous,hasMore:false}));setMessage('마지막 사진까지 확인했어요.');return;}
   currentIndex.current=index;cursors.current=index===0?[null]:[...cursors.current.slice(0,index),cursor];
   setPage({items:result.items,cursor:result.cursor,hasMore:result.hasMore,index});
  }catch(e){if(active.current&&own===generation.current)setError((e as Error).message||'사진을 불러오지 못했어요.');}
  finally{if(active.current&&own===generation.current)setLoading(false);}
 }
 useEffect(()=>{active.current=true;void load(null,0);return()=>{active.current=false;generation.current++;};},[code,missionId,demo]);
 return <section className="card teacher-photo-page" aria-busy={loading}>
  <div className="photo-page-heading"><h2>학생 제출 사진</h2><button type="button" className="button outline" disabled={loading} onClick={()=>load(null,0)}><RefreshCw size={15}/> 새로고침</button></div>
  {error&&<p className="error" role="alert">{error}</p>}
  {loading&&<p className="photo-loading" role="status"><LoaderCircle size={18} className="spin"/> 사진을 불러오고 있어요.</p>}
  {page.items.length?<><p className="caption">{page.index+1}페이지 · 사진 {page.items.length}장</p><div className="submission-gallery">{page.items.map((photo,index)=><figure key={photo.id}><img loading="lazy" decoding="async" src={photo.photoUrl} alt={`${photo.studentName||'학생'}의 제출 사진 ${page.index*12+index+1}`}/><figcaption><strong className="submitter-name">{photo.studentName||'이름 없음'}</strong><time>{new Date(photo.submitted).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time></figcaption></figure>)}</div></>:!loading&&!error&&<p className="empty">아직 제출된 미션 사진이 없어요.</p>}
  {message&&<p role="status">{message}</p>}
  {(page.items.length>0||page.index>0)&&<div className="photo-page-controls"><button type="button" className="button outline" disabled={loading||page.index===0} onClick={()=>load(cursors.current[page.index-1]||null,page.index-1)}>이전 사진</button><span>{page.index+1}페이지</span><button type="button" className="button teal" disabled={loading||!page.hasMore} onClick={()=>load(page.cursor,page.index+1)}>다음 사진</button></div>}
 </section>;
}
