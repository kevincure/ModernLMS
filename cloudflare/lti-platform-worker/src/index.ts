import { createClient } from '@supabase/supabase-js';
import {
  SignJWT,
  createRemoteJWKSet,
  exportJWK,
  importJWK,
  jwtVerify,
  decodeJwt,
  JWTPayload,
  JWK,
  KeyLike
} from 'jose';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  LTI_PLATFORM_ISSUER: string;
  LTI_PRIVATE_JWK_ACTIVE_JSON: string;
  LTI_PRIVATE_JWK_NEXT_JSON?: string;
  LTI_NONCE_TTL_SECONDS?: string;
  LTI_STATE_TTL_SECONDS?: string;
}

const CLAIMS = {
  VERSION: 'https://purl.imsglobal.org/spec/lti/claim/version',
  MESSAGE_TYPE: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  DEPLOYMENT_ID: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  CONTEXT: 'https://purl.imsglobal.org/spec/lti/claim/context',
  RESOURCE_LINK: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  DL_SETTINGS: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json' } });

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

const err = (message: string, status = 400) => json({ error: message }, status);

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toInt(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

async function parseForm(req: Request) {
  const ctype = req.headers.get('content-type') || '';
  if (!ctype.includes('application/x-www-form-urlencoded')) return null;
  return req.formData();
}

function roleToLti(role: string): string {
  if (role === 'instructor') return 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor';
  if (role === 'ta') return 'http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant';
  return 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';
}

async function getActiveSigningKey(env: Env) {
  const jwk = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON) as JWK;
  const key = await importJWK(jwk, 'RS256');
  return { key, kid: jwk.kid || 'active-kid' };
}

async function signPlatformJwt(env: Env, audience: string, payload: JWTPayload, kid: string) {
  const { key } = await getActiveSigningKey(env);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
    .setIssuer(env.LTI_PLATFORM_ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key as KeyLike);
}

async function resolveRegistration(supabase: any, issuer: string, clientId: string) {
  const { data, error } = await supabase
    .from('lti_registrations')
    .select('*')
    .eq('issuer', issuer)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function verifyToolIdToken(idToken: string, registration: any) {
  const jwksUrl = registration.jwks_url;
  if (!jwksUrl) throw new Error('Registration missing jwks_url');
  const JWKS = createRemoteJWKSet(new URL(jwksUrl));
  const { payload, protectedHeader } = await jwtVerify(idToken, JWKS, {
    issuer: registration.issuer,
    audience: registration.client_id
  });
  return { payload, protectedHeader };
}

function parseCourseIdFromContext(payload: any): string | null {
  const context = payload?.[CLAIMS.CONTEXT];
  return context?.id ? String(context.id) : null;
}

async function handleJwks(env: Env) {
  const activePrivate = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON);
  const activePublic = await exportJWK(await importJWK(activePrivate, 'RS256'));
  activePublic.kid = activePrivate.kid || 'active-kid';
  activePublic.use = 'sig';
  activePublic.alg = 'RS256';
  const keys: any[] = [activePublic];

  if (env.LTI_PRIVATE_JWK_NEXT_JSON) {
    const nextPrivate = JSON.parse(env.LTI_PRIVATE_JWK_NEXT_JSON);
    const nextPublic = await exportJWK(await importJWK(nextPrivate, 'RS256'));
    nextPublic.kid = nextPrivate.kid || 'next-kid';
    nextPublic.use = 'sig';
    nextPublic.alg = 'RS256';
    keys.push(nextPublic);
  }
  return json({ keys });
}

async function handleOidcLogin(req: Request, env: Env, supabase: any) {
  const url = new URL(req.url);
  const iss = url.searchParams.get('iss');
  const clientId = url.searchParams.get('client_id');
  const targetLinkUri = url.searchParams.get('target_link_uri');
  const loginHint = url.searchParams.get('login_hint');
  const ltiMessageHint = url.searchParams.get('lti_message_hint');
  if (!iss || !clientId || !targetLinkUri) return err('Missing iss/client_id/target_link_uri');

  const registration = await resolveRegistration(supabase, iss, clientId);
  if (!registration) return err('Unknown registration', 404);

  const state = randomToken();
  const nonce = randomToken();
  const ttlMs = toInt(env.LTI_STATE_TTL_SECONDS, 300) * 1000;

  const { error: snErr } = await supabase.from('lti_state_nonce').insert({
    org_id: registration.org_id,
    registration_id: registration.id,
    state,
    nonce,
    launch_redirect_uri: targetLinkUri,
    expires_at: new Date(Date.now() + ttlMs).toISOString()
  });
  if (snErr) return err(`Failed to persist state: ${snErr.message}`, 500);

  const redir = new URL(registration.auth_login_url);
  redir.searchParams.set('scope', 'openid');
  redir.searchParams.set('response_type', 'id_token');
  redir.searchParams.set('response_mode', 'form_post');
  redir.searchParams.set('prompt', 'none');
  redir.searchParams.set('client_id', registration.client_id);
  redir.searchParams.set('redirect_uri', targetLinkUri);
  redir.searchParams.set('state', state);
  redir.searchParams.set('nonce', nonce);
  if (loginHint) redir.searchParams.set('login_hint', loginHint);
  if (ltiMessageHint) redir.searchParams.set('lti_message_hint', ltiMessageHint);

  return Response.redirect(redir.toString(), 302);
}

async function handleLaunch(req: Request, supabase: any) {
  const form = await parseForm(req);
  if (!form) return err('Expected form body');
  const idToken = String(form.get('id_token') || '');
  const state = String(form.get('state') || '');
  if (!idToken || !state) return err('Missing id_token/state');

  const decoded = decodeJwt(idToken);
  const iss = String(decoded.iss || '');
  const aud = Array.isArray(decoded.aud) ? decoded.aud[0] : String(decoded.aud || '');
  const registration = await resolveRegistration(supabase, iss, aud);
  if (!registration) return err('Registration not found', 404);

  const { data: stateRow } = await supabase
    .from('lti_state_nonce')
    .select('*')
    .eq('state', state)
    .is('consumed_at', null)
    .maybeSingle();
  if (!stateRow) return err('Invalid state', 401);
  if (new Date(stateRow.expires_at).getTime() < Date.now()) return err('Expired state', 401);

  let payload: any;
  try {
    payload = (await verifyToolIdToken(idToken, registration)).payload;
  } catch (e: any) {
    await supabase.from('lti_launches').insert({
      org_id: registration.org_id,
      registration_id: registration.id,
      status: 'failed',
      error_code: 'jwt_verify_failed',
      error_detail: e.message,
      raw_claims: decoded
    });
    return err(`Token verify failed: ${e.message}`, 401);
  }

  if (payload.nonce !== stateRow.nonce) return err('Nonce mismatch', 401);
  if (payload[CLAIMS.VERSION] !== '1.3.0') return err('Invalid LTI version', 401);

  const msgType = payload[CLAIMS.MESSAGE_TYPE] as string;
  const deploymentId = payload[CLAIMS.DEPLOYMENT_ID] as string;
  const resourceLinkId = payload?.[CLAIMS.RESOURCE_LINK]?.id || null;
  const courseId = parseCourseIdFromContext(payload);
  const userId = (payload.sub as string) || null;

  await supabase.from('lti_state_nonce').update({ consumed_at: new Date().toISOString() }).eq('id', stateRow.id);

  const { data: launchRow } = await supabase.from('lti_launches').insert({
    org_id: registration.org_id,
    registration_id: registration.id,
    deployment_id: deploymentId,
    course_id: courseId,
    user_id: userId,
    message_type: msgType,
    lti_version: payload[CLAIMS.VERSION],
    resource_link_id: resourceLinkId,
    status: 'success',
    raw_claims: payload,
    correlation_id: crypto.randomUUID()
  }).select('*').single();

  if (msgType === 'LtiDeepLinkingRequest') {
    const settings = payload[CLAIMS.DL_SETTINGS] || {};
    return html(`<h2>Deep Linking Request Received</h2><p>Launch id: ${launchRow?.id || ''}</p><p>Return URL: ${settings.deep_link_return_url || registration.deep_link_return_url || ''}</p>`);
  }

  return html(`<h1>LTI launch ok</h1><p>Course: ${courseId || 'unknown'}</p><p>User: ${userId || 'unknown'}</p><p>Message type: ${msgType}</p>`);
}

async function handleDeepLinkReturn(req: Request, supabase: any) {
  const form = await parseForm(req);
  if (!form) return err('Expected form body');
  const jwt = String(form.get('JWT') || form.get('id_token') || '');
  if (!jwt) return err('Missing deep-link JWT');

  const decoded = decodeJwt(jwt);
  const iss = String(decoded.iss || '');
  const aud = Array.isArray(decoded.aud) ? decoded.aud[0] : String(decoded.aud || '');
  const registration = await resolveRegistration(supabase, iss, aud);
  if (!registration) return err('Registration not found', 404);

  const payload: any = (await verifyToolIdToken(jwt, registration)).payload;
  const items = payload['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'] || [];
  const deploymentId = payload[CLAIMS.DEPLOYMENT_ID] || null;
  const courseId = parseCourseIdFromContext(payload);

  for (const item of items) {
    await supabase.from('lti_deep_link_items').insert({
      org_id: registration.org_id,
      course_id: courseId,
      registration_id: registration.id,
      deployment_id: deploymentId,
      content_item_type: item.type || 'unknown',
      content_title: item.title || null,
      content_url: item.url || null,
      custom_claims: item.custom || {},
      created_lms_type: 'module_items',
      created_lms_id: null
    });
  }
  return html('<h3>Deep link applied.</h3>');
}

async function handleAgsLineitems(req: Request, supabase: any, courseId: string) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('lti_ags_line_items').select('*').eq('course_id', courseId);
    if (error) return err(error.message, 500);
    return json(data || []);
  }
  if (req.method === 'POST') {
    const body: any = await req.json();
    const { data, error } = await supabase.from('lti_ags_line_items').insert({
      org_id: body.org_id,
      course_id: courseId,
      registration_id: body.registration_id || null,
      deployment_id: body.deployment_id || null,
      assignment_id: body.assignment_id || null,
      lineitem_url: body.id || body.lineitem_url || crypto.randomUUID(),
      label: body.label || 'Line Item',
      score_max: body.scoreMaximum || body.score_max || 100,
      resource_id: body.resourceId || null,
      tag: body.tag || null
    }).select('*').single();
    if (error) return err(error.message, 500);
    return json(data, 201);
  }
  return err('Method not allowed', 405);
}

async function handleAgsLineitemById(req: Request, supabase: any, lineItemId: string) {
  if (req.method === 'GET') {
    const { data } = await supabase.from('lti_ags_line_items').select('*').eq('id', lineItemId).maybeSingle();
    if (!data) return err('Not found', 404);
    return json(data);
  }
  if (req.method === 'PUT') {
    const body: any = await req.json();
    const { data, error } = await supabase.from('lti_ags_line_items').update({
      label: body.label,
      score_max: body.scoreMaximum ?? body.score_max,
      tag: body.tag
    }).eq('id', lineItemId).select('*').single();
    if (error) return err(error.message, 500);
    return json(data);
  }
  if (req.method === 'DELETE') {
    await supabase.from('lti_ags_line_items').delete().eq('id', lineItemId);
    return new Response('', { status: 204 });
  }
  return err('Method not allowed', 405);
}

async function handleAgsScores(req: Request, supabase: any, lineItemId: string) {
  if (req.method !== 'POST') return err('Method not allowed', 405);
  const body: any = await req.json();
  const { data: li } = await supabase.from('lti_ags_line_items').select('*').eq('id', lineItemId).single();
  if (!li) return err('Line item not found', 404);

  const userId = body.userId || body.user_id;
  const scoreGiven = Number(body.scoreGiven ?? body.score_given ?? 0);
  const scoreMax = Number(body.scoreMaximum ?? body.score_max ?? li.score_max);

  const { data: scoreRow, error: scoreErr } = await supabase.from('lti_ags_scores').insert({
    org_id: li.org_id,
    line_item_id: lineItemId,
    user_id: userId,
    score_given: scoreGiven,
    score_max: scoreMax,
    activity_progress: body.activityProgress || null,
    grading_progress: body.gradingProgress || null,
    timestamp_from_tool: body.timestamp || new Date().toISOString(),
    raw_payload: body
  }).select('*').single();
  if (scoreErr) return err(scoreErr.message, 500);
  return json(scoreRow, 201);
}

async function handleAgsResults(req: Request, supabase: any, lineItemId: string) {
  if (req.method !== 'GET') return err('Method not allowed', 405);
  const { data, error } = await supabase.from('lti_ags_scores').select('*').eq('line_item_id', lineItemId).order('created_at', { ascending: false });
  if (error) return err(error.message, 500);
  return json(data || []);
}

async function handleNrps(req: Request, supabase: any, courseId: string) {
  if (req.method !== 'GET') return err('Method not allowed', 405);
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || 100)));
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('user_id, role, profiles!inner(id, name, email)')
    .eq('course_id', courseId)
    .range(from, to);
  if (error) return err(error.message, 500);

  const members = (enrollments || []).map((e: any) => ({
    user_id: e.user_id,
    roles: [roleToLti(e.role)],
    status: 'Active',
    name: e.profiles?.name || null,
    email: e.profiles?.email || null
  }));

  return json({ id: courseId, context: { id: courseId }, members });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    if (req.method === 'GET' && url.pathname === '/healthz') return json({ ok: true });
    if (req.method === 'GET' && url.pathname === '/.well-known/jwks.json') return handleJwks(env);
    if (req.method === 'GET' && url.pathname === '/lti/oidc/login') return handleOidcLogin(req, env, supabase);
    if (req.method === 'POST' && url.pathname === '/lti/launch') return handleLaunch(req, supabase);
    if (req.method === 'POST' && url.pathname === '/lti/deep-link/return') return handleDeepLinkReturn(req, supabase);

    const agsCourse = url.pathname.match(/^\/lti\/ags\/courses\/([^/]+)\/lineitems$/);
    if (agsCourse) return handleAgsLineitems(req, supabase, agsCourse[1]);

    const agsLineitem = url.pathname.match(/^\/lti\/ags\/lineitems\/([^/]+)$/);
    if (agsLineitem) return handleAgsLineitemById(req, supabase, agsLineitem[1]);

    const agsScores = url.pathname.match(/^\/lti\/ags\/lineitems\/([^/]+)\/scores$/);
    if (agsScores) return handleAgsScores(req, supabase, agsScores[1]);

    const agsResults = url.pathname.match(/^\/lti\/ags\/lineitems\/([^/]+)\/results$/);
    if (agsResults) return handleAgsResults(req, supabase, agsResults[1]);

    const nrps = url.pathname.match(/^\/lti\/nrps\/courses\/([^/]+)\/memberships$/);
    if (nrps) return handleNrps(req, supabase, nrps[1]);

    return err('Not found', 404);
  }
};
