import {displayTime} from '../../lib/time.ts';
import {createRemoteJWKSet, jwtVerify} from 'jose';
import {buildPushPayload} from '@block65/webcrypto-web-push';

export interface Env {
  FIREBASE_PROJECT_ID: string;
  APP_ORIGIN: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}
type Identity = {uid: string; provider: string};
type Field = {stringValue?: string; timestampValue?: string};
type Document = {name: string; fields: Record<string, Field>; updateTime: string};
type Dependencies = {
  fetch: typeof fetch;
  verify: (token: string, project: string) => Promise<Identity>;
  build: typeof buildPushPayload;
  now: () => number;
};
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const defaults: Dependencies = {
  fetch: (...args) => fetch(...args),
  async verify(token, project) {
    const {payload} = await jwtVerify(token, keys, {issuer: `https://securetoken.google.com/${project}`, audience: project, algorithms: ['RS256']});
    if (!payload.sub || payload.sub.length > 128) throw new Error('Invalid subject');
    return {uid: payload.sub, provider: (payload.firebase as {sign_in_provider?: string})?.sign_in_provider || ''};
  },
  build: buildPushPayload,
  now: Date.now,
};
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {super(message);this.status=status;}
}
const string = (value: string): Field => ({stringValue: value});
const text = (doc: Document, key: string) => doc.fields?.[key]?.stringValue || '';
const time = (doc: Document, key: string) => Date.parse(doc.fields?.[key]?.timestampValue || '');
const validId = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
const validAlert = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9-]{36}$/.test(s);

// Restrict outbound traffic to actual browser push services. Never follow redirects.
export function validEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.hash && (
      (u.hostname === 'fcm.googleapis.com' && /^\/(fcm|wp)\//.test(u.pathname)) ||
      (/^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/.test(u.hostname) && u.pathname.startsWith('/wpush/')) ||
      (/^([a-z0-9-]+\.)*notify\.windows\.com$/.test(u.hostname) && u.pathname.startsWith('/')) ||
      (u.hostname === 'web.push.apple.com' && u.pathname.startsWith('/'))
    );
  } catch {return false;}
}
function title(place: string) {
  const c = place.charCodeAt(place.length - 1), tail = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
  return `${place}${tail && tail !== 8 ? '으로' : '로'} 모여라!`;
}

// Dependency injection is used only by local tests; production always uses signed Firebase JWTs.
export function createHandler(overrides: Partial<Dependencies> = {}) {
  const deps = {...defaults, ...overrides};
  return async function handle(request: Request, env: Env): Promise<Response> {
    let stage='request';
    const origin = request.headers.get('Origin');
    const allowedOrigins = [env.APP_ORIGIN, `https://${env.FIREBASE_PROJECT_ID}.firebaseapp.com`];
    const cors: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin',
    };
    if (origin && allowedOrigins.includes(origin)) cors['Access-Control-Allow-Origin'] = origin;
    const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: cors});
    try {
      if (origin && !allowedOrigins.includes(origin)) throw new HttpError(403, '허용되지 않은 앱 주소예요.');
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: {...cors, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400'}});
      if (request.method === 'GET' && url.pathname === '/health') return reply({ok: true, configured: !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY, project: env.FIREBASE_PROJECT_ID});
      if (request.method !== 'POST' || url.pathname !== '/send') throw new HttpError(404, '요청을 찾을 수 없어요.');
      if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) throw new HttpError(503, '푸시 서버를 준비하고 있어요.');
      const token = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];
      if (!token) throw new HttpError(401, '교사 로그인이 필요해요.');
      let identity: Identity;
      try {identity = await deps.verify(token, env.FIREBASE_PROJECT_ID);} catch {throw new HttpError(401, '교사 로그인을 다시 확인해 주세요.');}
      if (identity.provider !== 'password') throw new HttpError(403, '선생님만 집합 알림을 보낼 수 있어요.');
      if (Number(request.headers.get('Content-Length')) > 4096) throw new HttpError(413, '요청이 너무 커요.');
      const bodyText = await request.text();
      if (new TextEncoder().encode(bodyText).length > 4096) throw new HttpError(413, '요청이 너무 커요.');
      let body: {code?: string; alertId?: string; pageToken?: string};
      try {body = JSON.parse(bodyText);} catch {throw new HttpError(400, '요청 형식을 확인해 주세요.');}
      if (!body || typeof body !== 'object' || !/^[A-Z2-9]{8}$/.test(body.code || '') || !validAlert(body.alertId) ||
        (body.pageToken !== undefined && (typeof body.pageToken !== 'string' || body.pageToken.length > 2048))) throw new HttpError(400, '반 코드와 집합 안내를 확인해 주세요.');
      const {code, alertId} = body;
      const root = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
      const api = `https://firestore.googleapis.com/v1/${root}`;
      const path = `sparkTrips/${code}`;
      const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
      async function firestore(suffix: string, init: RequestInit = {}) {
        return deps.fetch(api + suffix, {...init, headers, redirect: 'manual', signal: AbortSignal.timeout(10000)});
      }
      async function get(suffix: string, optional = false): Promise<Document | null> {
        const r = await firestore(suffix);
        if (optional && r.status === 404) return null;
        if (!r.ok) throw new HttpError(r.status === 403 ? 403 : 502, '반 자료에 접근하지 못했어요.');
        return await r.json() as Document;
      }
      stage='class';const base = await get('/' + path);
      if (!base || text(base, 'ownerUid') !== identity.uid) throw new HttpError(403, '이 반의 선생님만 알림을 보낼 수 있어요.');
      stage='alert';const alert = await get(`/${path}/alerts/${alertId}`);
      if (!alert || !Number.isFinite(time(alert, 'createdAt')) || deps.now() - time(alert, 'createdAt') > 600000 || time(alert, 'createdAt') > deps.now() + 30000) throw new HttpError(400, '10분이 지난 안내예요. 새 집합 안내를 보내 주세요.');
      const place = text(alert, 'place'), meetingTime = text(alert, 'time'), note = text(alert, 'note');
      if (!place || place.length > 100 || note.length > 200 || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(meetingTime)) throw new HttpError(400, '집합 안내 내용을 확인해 주세요.');
      const qs = new URLSearchParams({pageSize: '5', orderBy: '__name__'});
      if (body.pageToken) qs.set('pageToken', body.pageToken);
      stage='subscriptions';const list = await firestore(`/${path}/pushSubscriptions?${qs}`);
      if (!list.ok) throw new HttpError(502, '알림을 허용한 기기를 확인하지 못했어요.');
      stage='subscription-list';const page = await list.json() as {documents?: Document[]; nextPageToken?: string};
      const result = {sent: 0, failed: 0, expired: 0, skipped: 0, nextPageToken: page.nextPageToken || ''};
      // Five per request keeps native encryption and subrequests within the Workers Free limits.
      stage='dispatch';await Promise.all((page.documents || []).map(async subscription => {
        const uid = subscription.name.split('/').pop() || '';
        try {
          if (!validId(uid)) {result.skipped++; return;}
          const member = await get(`/${path}/members/${uid}`, true);
          if (!member) {result.skipped++; return;}
          const endpoint = text(subscription, 'endpoint'), p256dh = text(subscription, 'p256dh'), auth = text(subscription, 'auth');
          if (!validEndpoint(endpoint) || !/^[A-Za-z0-9_-]{87}$/.test(p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(auth)) {result.failed++; return;}
          const payload = await deps.build({data: JSON.stringify({title: title(place), body: `${displayTime(meetingTime)}까지 · ${note}`, code, notice: alertId}), options: {ttl: 600, urgency: 'high'}},
            {endpoint, expirationTime: null, keys: {p256dh, auth}}, {subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY});
          const dispatchPath = `${path}/pushDispatches/${alertId}_${uid}`;
          const previous = await get('/' + dispatchPath, true);
          if (previous && (text(previous, 'status') === 'accepted' || text(previous, 'status') === 'expired' || (text(previous, 'status') === 'sending' && deps.now() - time(previous, 'updatedAt') < 45000))) {result.skipped++; return;}
          const fields = {alertId: string(alertId), studentUid: string(uid), status: string('sending')};
          const claim = await firestore(':commit', {method: 'POST', body: JSON.stringify({writes: [{update: {name: `${root}/${dispatchPath}`, fields}, currentDocument: previous ? {updateTime: previous.updateTime} : {exists: false}, updateTransforms: [{fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME'}]}]})});
          if (claim.status === 409 || claim.status === 412) {result.skipped++; return;}
          if (!claim.ok) throw new Error('Unable to claim dispatch');
          const claimData = await claim.json() as {writeResults: {updateTime: string}[]};
          let status = 'failed';
          try {
            const sent = await deps.fetch(endpoint, {...payload, redirect: 'manual', signal: AbortSignal.timeout(10000)});
            await sent.body?.cancel();
            if (sent.ok) {result.sent++; status = 'accepted';}
            else if ([404, 410].includes(sent.status)) {result.expired++; status = 'expired'; await firestore(`/${path}/pushSubscriptions/${uid}?currentDocument.updateTime=${encodeURIComponent(subscription.updateTime)}`, {method: 'DELETE'});}
            else result.failed++;
          } catch {result.failed++;}
          await firestore(':commit', {method: 'POST', body: JSON.stringify({writes: [{update: {name: `${root}/${dispatchPath}`, fields: {...fields, status: string(status)}}, currentDocument: {updateTime: claimData.writeResults[0].updateTime}, updateTransforms: [{fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME'}]}]})});
        } catch {result.failed++;}
      }));
      return reply({ok: true, ...result});
    } catch (error) {
      return reply({error: error instanceof HttpError ? error.message : '푸시 발송 서버에 연결하지 못했어요.',...(error instanceof HttpError?{}:{diagnostic:stage+':'+(error instanceof Error?error.name:'unknown')})}, error instanceof HttpError ? error.status : 502);
    }
  };
}
export default {fetch: createHandler()};
