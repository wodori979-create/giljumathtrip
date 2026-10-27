import {useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,Backpack,ChevronRight,GraduationCap,LoaderCircle,LockKeyhole,Users,X} from 'lucide-react';
import {CLASSROOMS,type Classroom} from '@/lib/classrooms';

export default function ClassroomEntry({role,busy,error,onClose,onEnter,onResetError}:{role:'student'|'teacher';busy:boolean;error:string;onClose:()=>void;onResetError:()=>void;onEnter:(room:Classroom,form:FormData)=>Promise<void>}) {
  const [room,setRoom]=useState<Classroom|null>(null);
  const teacher=role==='teacher';
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(room&&!busy)await onEnter(room,new FormData(event.currentTarget));}
  return <div className="modal-backdrop" onClick={onClose}><section className="modal login-modal classroom-entry" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={e=>e.stopPropagation()}>
    <button aria-label="닫기" className="close" disabled={busy} onClick={onClose}><X/></button>
    <span className={'modal-hero-icon '+(teacher?'yellow':'')}>{teacher?<GraduationCap size={34}/>:<Backpack size={34}/>}</span>
    <span className={'pill '+(teacher?'cream':'mint')}>{teacher?'선생님':'학생'} 입장</span>
    <h2 id="login-title">{room?room.name+'에 입장해요':'우리 반을 선택해 주세요'}</h2>
    <p>{room?(teacher?'이 반의 교사용 비밀번호를 입력해 주세요.':'선생님과 친구들이 알아볼 수 있게 이름을 적어 주세요.'):'1반부터 5반까지, 나의 여행 교실을 찾아요.'}</p>
    {!room?<div className="classroom-grid" role="group" aria-label="6학년 반 선택">{CLASSROOMS.map(item=><button type="button" key={item.id} onClick={()=>{onResetError();setRoom(item)}} className={'classroom-choice room-'+item.id}><span className="classroom-number">{item.id}<small>반</small></span><span><b>{item.name}</b><small>{teacher?'선생님 입장':'친구들과 함께하는 여행'}</small></span><ChevronRight size={18}/></button>)}</div>:<>
      <button type="button" className="text-btn classroom-back" disabled={busy} onClick={()=>{onResetError();setRoom(null)}}><ArrowLeft size={15}/> 다른 반 선택</button>
      <form key={room.id} onSubmit={submit}>
        {teacher?<label className="field"><span><LockKeyhole size={15}/> 교사용 비밀번호</span><input autoFocus name="password" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="비밀번호 4자리" required/><small>선택한 반의 선생님만 입장할 수 있어요.</small></label>:<label className="field"><span><Users size={15}/> 내 이름</span><input autoFocus name="name" autoComplete="name" maxLength={20} placeholder="이름을 입력해 주세요" required/><small>입장한 이름은 선생님께 제출 사진과 함께 보여요.</small></label>}
        {error&&<p className="error" role="alert">{error}</p>}
        <button className="button teal full" disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:<ArrowRight size={18}/>} {busy?'교실 문을 열고 있어요…':room.name+' 입장하기'}</button>
      </form>
    </>}
    <div className="classroom-privacy"><LockKeyhole size={13}/><span>일정·미션·집합 안내는 반마다 따로 보관해요.</span></div>
  </section></div>;
}
