import {useEffect,useId,useRef,useState} from 'react';
import {LoaderCircle,RefreshCw} from 'lucide-react';
import {api} from '@/lib/trip-api';
import type {MissionSubmission,StudentMember} from '@/lib/trip';

type Page={items:MissionSubmission[];cursor:string|null;hasMore:boolean;index:number};
export default function TeacherMissionPhotos({code,missionId,title,eventLabel,description,demo=false,demoPhotos=[],students=[]}:{code:string;missionId:string;title:string;eventLabel:string;description:string;students?:StudentMember[];demo?:boolean;demoPhotos?:MissionSubmission[]}){
 const [page,setPage]=useState<Page>({items:[],cursor:null,hasMore:false,index:0}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [submitters,setSubmitters]=useState<string[]|null>(null),[showRoster,setShowRoster]=useState(false),[rosterLoading,setRosterLoading]=useState(false),[rosterError,setRosterError]=useState(''),[rosterRefresh,setRosterRefresh]=useState(0);
 const rosterId=useId();
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
 useEffect(()=>{
  if(!showRoster)return;
  let current=true;setRosterLoading(true);setRosterError('');setSubmitters(null);
  const request=demo?Promise.resolve(students.filter(student=>demoPhotos.some(photo=>photo.studentName===student.name)).map(student=>student.uid)):api('mission/submitters',{missionId});
  request.then(uids=>{if(current)setSubmitters(uids);}).catch(e=>{if(current)setRosterError(e.message||'제출 명단을 불러오지 못했어요.');}).finally(()=>{if(current)setRosterLoading(false);});
  return()=>{current=false;};
 },[showRoster,code,missionId,demo,rosterRefresh]);
 const submitted=students.filter(student=>submitters?.includes(student.uid)),missing=students.filter(student=>!submitters?.includes(student.uid));
 return <><div className="page-heading mission-photo-heading"><div><p>{eventLabel}</p><div className="mission-title-controls"><h1>{title}</h1><button type="button" className="button teal" aria-expanded={showRoster} aria-controls={rosterId} onClick={()=>setShowRoster(value=>!value)}>{showRoster?'제출확인 닫기':'제출확인'}</button></div>{description&&<p>{description}</p>}</div></div><section className="card teacher-photo-page" aria-busy={loading}>
  <div className="photo-page-heading"><h2>학생 제출 사진</h2><button type="button" className="button outline" disabled={loading||rosterLoading&&showRoster} onClick={()=>{void load(null,0);if(showRoster)setRosterRefresh(value=>value+1);}}><RefreshCw size={15}/> 새로고침</button></div>
  {error&&<p className="error" role="alert">{error}</p>}
  {loading&&<p className="photo-loading" role="status"><LoaderCircle size={18} className="spin"/> 사진을 불러오고 있어요.</p>}
  {showRoster&&<section id={rosterId} className="mission-submission-roster" aria-label="미션 제출 명단" aria-busy={rosterLoading}>
   {rosterLoading&&<p role="status"><LoaderCircle size={16} className="spin"/> 명단을 불러오고 있어요.</p>}
   {rosterError&&<p className="error" role="alert">{rosterError}<button type="button" className="button outline" onClick={()=>setRosterRefresh(value=>value+1)}>다시 불러오기</button></p>}
   {submitters!==null&&<>
   <p className="caption">앱에 입장한 학생 기준 · 사진을 제출하면 제출자로 표시돼요.</p>
   <div className="mission-roster-columns">{[{title:'제출',items:submitted},{title:'미제출',items:missing}].map(group=><div className="mission-roster-group" key={group.title}><h3>{group.title} <span>{group.items.length}명</span></h3>{group.items.length?<ul>{group.items.map(student=><li key={student.uid}>{student.name}</li>)}</ul>:<p>없음</p>}</div>)}</div>
  </>}
  </section>}
  {page.items.length?<><p className="caption">{page.index+1}페이지 · 사진 {page.items.length}장</p><div className="submission-gallery">{page.items.map((photo,index)=><figure key={photo.id}><img loading="lazy" decoding="async" src={photo.photoUrl} alt={`${photo.studentName||'학생'}의 제출 사진 ${page.index*12+index+1}`}/><figcaption><strong className="submitter-name">{photo.studentName||'이름 없음'}</strong><time>{new Date(photo.submitted).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time></figcaption></figure>)}</div></>:!loading&&!error&&<p className="empty">아직 제출된 미션 사진이 없어요.</p>}
  {message&&<p role="status">{message}</p>}
  {(page.items.length>0||page.index>0)&&<div className="photo-page-controls"><button type="button" className="button outline" disabled={loading||page.index===0} onClick={()=>load(cursors.current[page.index-1]||null,page.index-1)}>이전 사진</button><span>{page.index+1}페이지</span><button type="button" className="button teal" disabled={loading||!page.hasMore} onClick={()=>load(page.cursor,page.index+1)}>다음 사진</button></div>}
 </section></>;
}
