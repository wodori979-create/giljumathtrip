import {Bus,ShieldCheck,Users,Ticket,Hotel,HeartPulse,PhoneCall} from 'lucide-react';

const groups=[
 {title:'친구와 함께, 단체 활동 안전',icon:Users,items:['짝꿍·모둠과 함께 이동하고 혼자 다른 곳으로 가지 않아요.','집합 시간과 장소를 확인하고, 이동 전후 인원 점검에 꼭 참여해요.','길을 잃으면 돌아다니지 말고 안전한 곳에 멈춰 선생님이나 안내 직원에게 도움을 요청해요.','장난으로 밀거나 뛰지 않고, 친구의 몸과 물건을 소중히 대해요.']},
 {title:'과학관·놀이공원에서',icon:Ticket,items:['시설의 안전 안내와 키·건강 상태 제한을 지키고 직원의 지시에 따라요.','놀이기구 안전장치를 임의로 풀지 않고, 완전히 멈춘 뒤 안내에 따라 내려요.','탑승 중 휴대폰을 꺼내 사진을 찍거나 몸·손을 밖으로 내밀지 않아요.','전시물과 체험 기구는 허용된 방법으로만 이용하고, 난간·울타리를 넘지 않아요.']},
 {title:'숙소에서',icon:Hotel,items:['방에 들어가면 비상구와 대피 경로를 먼저 확인해요.','창문·베란다·난간에 기대거나 올라가지 않고, 복도와 계단에서 뛰지 않아요.','허락 없이 방이나 숙소 밖으로 나가지 않고 취침 시간을 지켜요.','불장난을 하지 않고, 콘센트에 여러 기기를 무리하게 연결하지 않아요.']},
 {title:'음식·건강·가을 날씨',icon:HeartPulse,items:['식사 전과 화장실 이용 후 손을 깨끗이 씻어요.','음식 알레르기나 복용 약이 있으면 미리 선생님께 알려요. 약을 친구와 나눠 먹지 않아요.','편한 운동화를 신고, 아침저녁 추위에 대비해 겉옷을 챙겨요.','물을 자주 마시고, 어지럽거나 아프면 참지 말고 바로 선생님께 알려요.']},
];
export default function SafetyRules(){
 return <section className="safety-page" aria-labelledby="safety-title">
  <div className="page-heading"><div><h1 id="safety-title">안전수칙</h1><p>즐거운 수학여행, 안전이 가장 먼저예요.</p></div><ShieldCheck size={32} aria-hidden="true"/></div>
  <section className="safety-traffic" aria-labelledby="traffic-title"><span className="safety-priority">가장 중요해요</span><h2 id="traffic-title"><Bus size={26}/>교통안전, 꼭 지켜요!</h2><ul>
   <li><b>버스에서는 출발 전부터 도착할 때까지 안전띠를 꼭 매요.</b> 버스가 움직일 때는 자리에서 일어나거나 통로로 다니지 않아요.</li>
   <li><b>완전히 멈춘 뒤 차례대로 타고 내려요.</b> 손잡이를 잡고 발밑을 확인하며, 내린 뒤에는 차도에서 떨어진 안전한 곳으로 이동해요.</li>
   <li><b>버스 앞뒤로 갑자기 뛰어나가거나 바로 길을 건너지 않아요.</b> 운전자가 나를 못 볼 수 있어요. 버스 아래에 떨어진 물건은 직접 줍지 말고 선생님께 알려요.</li>
   <li><b>길을 건널 때는 멈추고, 양쪽을 살피고, 차가 멈췄는지 확인해요.</b> 횡단보도와 보행 신호를 지키고 선생님과 함께 건너요. 건너기 전 신호가 깜빡이면 다음 신호를 기다려요.</li>
   <li><b>걸으면서 휴대폰을 보거나 이어폰을 끼지 않아요.</b> 인도로 다니고, 주차장에서도 차량의 움직임을 잘 살펴요.</li>
   <li><b>운전 중인 기사님을 방해하지 않아요.</b> 창밖으로 손이나 머리를 내밀거나 물건을 던지지 않고, 짐은 안내받은 곳에 안전하게 놓아요.</li>
  </ul></section>
  <div className="safety-grid">{groups.map(({title,icon:Icon,items})=><section className="card safety-card" key={title}><h2><Icon size={23}/>{title}</h2><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></section>)}</div>
  <section className="safety-emergency" aria-labelledby="emergency-title"><h2 id="emergency-title"><PhoneCall size={24}/>위험하거나 아프면 바로 알려요</h2><p>가장 먼저 가까운 선생님이나 시설 직원에게 도움을 요청해요. 친구가 다치면 혼자 옮기거나 무리하게 구조하지 말고 어른을 불러요.</p><p>화재·연기 등 위험이 생기면 짐보다 몸을 먼저 챙기고, 선생님과 직원의 안내에 따라 안전한 곳으로 대피해요. 화재 때는 엘리베이터를 이용하지 않아요.</p><div className="safety-numbers"><span>화재·구조·응급환자 <b>119</b></span><span>범죄·긴급한 위험 <b>112</b></span></div><p>신고할 때는 <b>현재 위치, 무슨 일이 생겼는지, 다친 사람이 있는지</b>를 차분하게 알려요.</p></section>
 </section>;
}
