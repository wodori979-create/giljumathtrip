// Fetch identities only: keep the full class roster independent of photo pagination.
// Firestore's REST projection avoids downloading every student's encoded photo.
export async function fetchMissionSubmitters({projectId,code,missionId,token,emulator=false}:{projectId:string;code:string;missionId:string;token:string;emulator?:boolean}):Promise<string[]>{
 const origin=emulator?'http://127.0.0.1:8080':'https://firestore.googleapis.com';
 const response=await fetch(`${origin}/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/sparkTrips/${encodeURIComponent(code)}:runQuery`,{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({structuredQuery:{from:[{collectionId:'submissions'}],select:{fields:[{fieldPath:'studentUid'}]},where:{fieldFilter:{field:{fieldPath:'missionId'},op:'EQUAL',value:{stringValue:missionId}}}}})
 });
 if(!response.ok){const data=await response.json().catch(()=>null);throw Object.assign(new Error('제출 명단을 불러오지 못했어요. 새로고침을 눌러 주세요.'),{code:({'PERMISSION_DENIED':'permission-denied','RESOURCE_EXHAUSTED':'resource-exhausted','UNAVAILABLE':'unavailable'} as Record<string,string>)[data?.error?.status]});}
 const rows=await response.json();
 return [...new Set<string>(rows.flatMap((row:any)=>{const uid=row.document?.fields?.studentUid?.stringValue;return typeof uid==='string'&&uid?[uid]:[];}))];
}
