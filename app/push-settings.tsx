import {useEffect,useState} from 'react';
import {BellRing,CheckCircle2,Info,LoaderCircle} from 'lucide-react';
import {pushStatus,enablePush,disablePush,type PushStatus} from '@/lib/push';

export default function PushSettings({code,demo,onHelp}:{code:string;demo:boolean;onHelp:()=>void}) {
  const [status,setStatus]=useState<PushStatus|'checking'>('checking'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let active=true;if(demo){setStatus('disabled');return;}pushStatus(code).then(value=>active&&setStatus(value)).catch(()=>{if(active){setStatus('disabled');setError('알림 연결을 확인하지 못했어요. 다시 켜 주세요.');}});return()=>{active=false};},[code,demo]);
  async function toggle(){if(demo){onHelp();return;}setBusy(true);setError('');try{if(status==='enabled'){await disablePush(code);setStatus('disabled');}else setStatus(await enablePush(code));}catch(error){setError(error instanceof Error?error.message:'알림을 켜지 못했어요. 인터넷 연결을 확인해 주세요.');}finally{setBusy(false);}}
  const descriptions:Record<PushStatus|'checking',string>={
    checking:'휴대폰 알림 설정을 확인하고 있어요.',local:'로컬 확인 중이에요. 우리 반의 집합 안내는 모여라! 탭에 실시간으로 표시돼요.',enabled:'화면이 꺼져 있어도 집합 안내를 받을 수 있어요.',disabled:'알림을 허용하면 화면을 꺼도 선생님의 집합 안내를 받아요.',
    denied:'브라우저·휴대폰 설정에서 이 앱의 알림을 허용한 뒤 다시 열어 주세요.',install:'아이폰은 Safari에서 공유 → 홈 화면에 추가 후, 추가된 앱에서 알림을 켜 주세요.',
    unsupported:'이 브라우저는 푸시를 지원하지 않아요. Chrome 또는 홈 화면에 추가한 Safari 앱을 이용해 주세요.',unconfigured:'푸시 연결 준비 중이에요. 새 안내는 모여라! 탭에서 확인해 주세요.'
  };
  const action=['install','denied','unsupported','unconfigured','local'].includes(status)?onHelp:toggle;
  return <section className={'push-settings '+(status==='enabled'?'is-enabled':'')} aria-label="휴대폰 푸시 알림"><div className="push-settings-icon">{status==='enabled'?<CheckCircle2 size={24}/>:<BellRing size={24}/>}</div><div className="push-settings-copy"><b>{status==='local'?'우리 반 집합 안내를 확인해요':status==='enabled'?'휴대폰 알림이 켜졌어요':'선생님이 부르면, 바로 알 수 있게'}</b><p>{descriptions[status]}</p>{error&&<p className="push-error" role="alert">{error}</p>}</div><div className="push-settings-actions"><button className="button teal" type="button" onClick={action} disabled={busy||status==='checking'}>{busy?<LoaderCircle size={16} className="spin"/>:null}{status==='local'?'이용 안내':status==='enabled'?'알림 끄기':['install','denied','unsupported','unconfigured'].includes(status)?'설정 방법':'휴대폰 알림 켜기'}</button>{status!=='local'&&<button className="text-btn" type="button" onClick={onHelp}><Info size={14}/> 이용 안내</button>}</div></section>;
}
