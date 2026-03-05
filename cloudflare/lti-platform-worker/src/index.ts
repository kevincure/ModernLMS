import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, decodeJwt, importJWK, jwtVerify, SignJWT } from 'jose';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  LTI_PLATFORM_ISSUER: string;
  LTI_PRIVATE_JWK_ACTIVE_JSON: string;
  LTI_PRIVATE_JWK_NEXT_JSON?: string;
  LTI_NONCE_TTL_SECONDS?: string;
  LTI_STATE_TTL_SECONDS?: string;
}

interface ServiceAuthContext {
  registration: any;
  deployment: any;
  scopes: Set<string>;
  courseId: string | null;
}

const CLAIMS = {
  VERSION: 'https://purl.imsglobal.org/spec/lti/claim/version',
  MESSAGE_TYPE: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  DEPLOYMENT_ID: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  CONTEXT: 'https://purl.imsglobal.org/spec/lti/claim/context',
  RESOURCE_LINK: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  DL_ITEMS: 'https://purl.imsglobal.org/spec/lti-dl/claim/content_items',
  DL_SETTINGS: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
  LAUNCH_PRESENTATION: 'https://purl.imsglobal.org/spec/lti/claim/launch_presentation'
};

const AGS_SCOPES = {
  LINEITEM: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  LINEITEM_READONLY: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  SCORE: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  RESULT_READONLY: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly'
};

const NRPS_SCOPE = 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json', ...headers } });

const html = (body: string, status = 200) =>
  new Response(`<!doctype html><html><body>${body}</body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

const err = (message: string, status = 400) => json({ error: message }, status);

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toInt(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function roleToLti(role: string): string {
  if (role === 'instructor') return 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor';
  if (role === 'ta') return 'http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant';
  return 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';
}

function toPublicJwk(privateJwk: any) {
  if (!privateJwk?.kty || !privateJwk?.n || !privateJwk?.e) throw new Error('Invalid private JWK: missing kty/n/e');
  return {
    kty: privateJwk.kty,
    n: privateJwk.n,
    e: privateJwk.e,
    kid: privateJwk.kid || 'platform-key',
    use: 'sig',
    alg: 'RS256'
  };
}

async function parseForm(req: Request) {
  const ctype = req.headers.get('content-type') || '';
  if (!ctype.includes('application/x-www-form-urlencoded')) return null;
  return req.formData();
}

function parseCourseIdFromContext(payload: any): string | null {
  const ctx = payload?.[CLAIMS.CONTEXT];
  return ctx?.id ? String(ctx.id) : null;
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

async function resolveDeployment(supabase: any, registrationId: string, deploymentId: string, courseId: string | null) {
  if (!deploymentId) return null;
  const { data, error } = await supabase
    .from('lti_deployments')
    .select('*')
    .eq('registration_id', registrationId)
    .eq('deployment_id', deploymentId)
    .eq('status', 'active');
  if (error) throw error;

  const rows = data || [];
  return rows.find((row: any) => {
    if (row.scope_type === 'org') return true;
    if (row.scope_type === 'course') return courseId && String(row.scope_ref) === String(courseId);
    return true;
  }) || null;
}

async function resolveCourseOrgId(supabase: any, courseId: string | null): Promise<string | null> {
  if (!courseId) return null;
  const { data } = await supabase.from('courses').select('org_id').eq('id', courseId).maybeSingle();
  return data?.org_id || null;
}

async function verifyToolJwt(idToken: string, registration: any) {
  if (!registration?.jwks_url) throw new Error('Registration missing jwks_url');
  const JWKS = createRemoteJWKSet(new URL(registration.jwks_url));
  return jwtVerify(idToken, JWKS, { issuer: registration.issuer, audience: registration.client_id });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization'
  };
}

function tokenFromAuth(req: Request): string | null {
  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim() || null;
}

async function verifyPlatformAccessToken(token: string, env: Env) {
  const activePrivate = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON);
  const pub = toPublicJwk(activePrivate);
  const key = await importJWK(pub, 'RS256');
  return jwtVerify(token, key, {
    issuer: env.LTI_PLATFORM_ISSUER,
    audience: 'lti-services'
  });
}

function hasScope(scopes: Set<string>, scope: string) {
  return scopes.has(scope);
}

async function authorizeServiceRequest(
  req: Request,
  env: Env,
  supabase: any,
  requiredScopes: string[],
  courseId: string | null
): Promise<ServiceAuthContext> {
  const token = tokenFromAuth(req);
  if (!token) throw new Error('Missing bearer access token');

  const { payload } = await verifyPlatformAccessToken(token, env);
  const clientId = String(payload.client_id || payload.sub || '');
  const issuer = String(payload.tool_iss || '');
  const deploymentId = String(payload.deployment_id || '');
  const tokenCourseId = payload.course_id ? String(payload.course_id) : null;

  if (!clientId || !issuer || !deploymentId) throw new Error('Invalid service token claims');
  if (courseId && tokenCourseId && String(courseId) !== String(tokenCourseId)) throw new Error('Token not valid for this course');

  const registration = await resolveRegistration(supabase, issuer, clientId);
  if (!registration) throw new Error('Registration not found for token');

  const deployment = await resolveDeployment(supabase, registration.id, deploymentId, courseId || tokenCourseId);
  if (!deployment) throw new Error('Deployment not active for requested context');

  const scopes = new Set(String(payload.scope || '').split(' ').filter(Boolean));
  if (requiredScopes.length > 0 && !requiredScopes.some(scope => hasScope(scopes, scope))) {
    throw new Error('Insufficient scope');
  }

  return { registration, deployment, scopes, courseId: tokenCourseId };
}

async function handleJwks(env: Env) {
  const activePrivate = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON);
  const keys = [toPublicJwk(activePrivate)];
  if (env.LTI_PRIVATE_JWK_NEXT_JSON) keys.push(toPublicJwk(JSON.parse(env.LTI_PRIVATE_JWK_NEXT_JSON)));
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

  const reg = await resolveRegistration(supabase, iss, clientId);
  if (!reg) return err('Unknown registration', 404);

  const state = randomToken();
  const nonce = randomToken();
  const ttlMs = toInt(env.LTI_STATE_TTL_SECONDS, 300) * 1000;

  const { error: insErr } = await supabase.from('lti_state_nonce').insert({
    org_id: reg.org_id,
    registration_id: reg.id,
    state,
    nonce,
    launch_redirect_uri: targetLinkUri,
    expires_at: new Date(Date.now() + ttlMs).toISOString()
  });
  if (insErr) return err(`Failed to save state/nonce: ${insErr.message}`, 500);

  const redirect = new URL(reg.auth_login_url);
  redirect.searchParams.set('scope', 'openid');
  redirect.searchParams.set('response_type', 'id_token');
  redirect.searchParams.set('response_mode', 'form_post');
  redirect.searchParams.set('prompt', 'none');
  redirect.searchParams.set('client_id', reg.client_id);
  redirect.searchParams.set('redirect_uri', targetLinkUri);
  redirect.searchParams.set('state', state);
  redirect.searchParams.set('nonce', nonce);
  if (loginHint) redirect.searchParams.set('login_hint', loginHint);
  if (ltiMessageHint) redirect.searchParams.set('lti_message_hint', ltiMessageHint);

  return Response.redirect(redirect.toString(), 302);
}

async function handleToken(req: Request, env: Env, supabase: any) {
  const form = await parseForm(req);
  if (!form) return err('Expected x-www-form-urlencoded');

  const grantType = String(form.get('grant_type') || '');
  const scope = String(form.get('scope') || '');
  const clientAssertionType = String(form.get('client_assertion_type') || '');
  const clientAssertion = String(form.get('client_assertion') || '');

  if (grantType !== 'client_credentials') return err('Unsupported grant_type', 400);
  if (!clientAssertion || !clientAssertionType.includes('jwt-bearer')) return err('Missing client_assertion', 400);

  const decoded = decodeJwt(clientAssertion);
  const clientId = String(decoded.sub || decoded.iss || '');
  const toolIss = String(decoded.tool_iss || decoded.iss || '');
  if (!clientId || !toolIss) return err('Invalid client assertion', 401);

  const reg = await resolveRegistration(supabase, toolIss, clientId);
  if (!reg) return err('Registration not found', 404);

  try {
    const JWKS = createRemoteJWKSet(new URL(reg.jwks_url));
    await jwtVerify(clientAssertion, JWKS, {
      issuer: clientId,
      audience: `${env.LTI_PLATFORM_ISSUER}/lti/oauth2/token`
    });
  } catch (e: any) {
    return err(`Client assertion verify failed: ${e?.message || 'unknown'}`, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const reqScopes = scope.split(' ').filter(Boolean);
  const allowedScopes = new Set([
    AGS_SCOPES.LINEITEM,
    AGS_SCOPES.LINEITEM_READONLY,
    AGS_SCOPES.SCORE,
    AGS_SCOPES.RESULT_READONLY,
    NRPS_SCOPE
  ]);
  const granted = reqScopes.filter(s => allowedScopes.has(s));
  if (granted.length === 0) return err('No allowed scopes requested', 400);

  const privateJwk = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON);
  const key = await importJWK(privateJwk, 'RS256');
  const deploymentId = String(form.get('deployment_id') || '');
  const courseId = String(form.get('course_id') || '');

  const accessToken = await new SignJWT({
    scope: granted.join(' '),
    client_id: reg.client_id,
    tool_iss: reg.issuer,
    deployment_id: deploymentId,
    course_id: courseId
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: privateJwk.kid || 'platform-key' })
    .setIssuer(env.LTI_PLATFORM_ISSUER)
    .setAudience('lti-services')
    .setSubject(reg.client_id)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);

  return json({ access_token: accessToken, token_type: 'Bearer', expires_in: 300, scope: granted.join(' ') });
}

async function handleLaunch(req: Request, supabase: any) {
  const form = await parseForm(req);
  if (!form) return err('Expected x-www-form-urlencoded');
  const idToken = String(form.get('id_token') || '');
  const state = String(form.get('state') || '');
  if (!idToken || !state) return err('Missing id_token/state');

  const decoded = decodeJwt(idToken);
  const iss = String(decoded.iss || '');
  const audValue = decoded.aud;
  const aud = Array.isArray(audValue) ? String(audValue[0] || '') : String(audValue || '');
  const azp = decoded.azp ? String(decoded.azp) : '';
  if (!iss || !aud) return err('Invalid token (missing iss/aud)', 401);
  if (Array.isArray(audValue) && !azp) return err('Invalid token (missing azp with multi aud)', 401);

  const reg = await resolveRegistration(supabase, iss, aud);
  if (!reg) return err('Registration not found', 404);

  const { data: sn } = await supabase
    .from('lti_state_nonce')
    .select('*')
    .eq('state', state)
    .eq('registration_id', reg.id)
    .is('consumed_at', null)
    .maybeSingle();

  if (!sn) return err('Invalid state', 401);
  if (new Date(sn.expires_at).getTime() < Date.now()) return err('Expired state', 401);

  let payload: any;
  try {
    payload = (await verifyToolJwt(idToken, reg)).payload;
  } catch (e: any) {
    await supabase.from('lti_launches').insert({
      org_id: reg.org_id,
      registration_id: reg.id,
      status: 'failed',
      error_code: 'jwt_verify_failed',
      error_detail: e?.message || 'verify failed',
      raw_claims: decoded
    });
    return err(`JWT verify failed: ${e?.message || 'unknown'}`, 401);
  }

  if (payload.nonce !== sn.nonce) return err('Nonce mismatch', 401);
  if (payload[CLAIMS.VERSION] !== '1.3.0') return err('Invalid LTI version', 401);

  const msgType = String(payload[CLAIMS.MESSAGE_TYPE] || '');
  if (!['LtiResourceLinkRequest', 'LtiDeepLinkingRequest'].includes(msgType)) return err('Unsupported LTI message type', 401);

  const deploymentId = String(payload[CLAIMS.DEPLOYMENT_ID] || '');
  const courseId = parseCourseIdFromContext(payload);
  const deployment = await resolveDeployment(supabase, reg.id, deploymentId, courseId);
  if (!deployment) return err('Invalid or inactive deployment', 401);

  const userId = payload.sub ? String(payload.sub) : null;
  const resourceLinkId = payload?.[CLAIMS.RESOURCE_LINK]?.id || null;

  await supabase.from('lti_state_nonce').update({ consumed_at: new Date().toISOString(), deployment_id: deploymentId }).eq('id', sn.id);

  const { data: launchRow } = await supabase
    .from('lti_launches')
    .insert({
      org_id: reg.org_id,
      registration_id: reg.id,
      deployment_id: deploymentId,
      course_id: courseId,
      user_id: userId,
      message_type: msgType,
      lti_version: payload[CLAIMS.VERSION],
      resource_link_id: resourceLinkId,
      status: 'success',
      raw_claims: payload,
      correlation_id: crypto.randomUUID()
    })
    .select('*')
    .single();

  if (msgType === 'LtiDeepLinkingRequest') {
    const settings = payload[CLAIMS.DL_SETTINGS] || {};
    return html(`<h2>Deep Linking Request Received</h2><p>Launch ID: ${launchRow?.id || ''}</p><p>Return URL: ${settings.deep_link_return_url || reg.deep_link_return_url || '(none)'}</p>`);
  }

  const presentation = payload[CLAIMS.LAUNCH_PRESENTATION] || {};
  return html(`<h1>LTI launch ok</h1><p>Course: ${courseId || 'unknown'}</p><p>User: ${userId || 'unknown'}</p><p>Message type: ${msgType || 'unknown'}</p><p>Document target: ${presentation.document_target || 'iframe'}</p>`);
}

async function handleDeepLinkReturn(req: Request, supabase: any) {
  const form = await parseForm(req);
  if (!form) return err('Expected x-www-form-urlencoded');
  const jwt = String(form.get('JWT') || form.get('id_token') || '');
  if (!jwt) return err('Missing deep-link JWT');

  const decoded = decodeJwt(jwt);
  const iss = String(decoded.iss || '');
  const aud = Array.isArray(decoded.aud) ? String(decoded.aud[0]) : String(decoded.aud || '');
  const reg = await resolveRegistration(supabase, iss, aud);
  if (!reg) return err('Registration not found', 404);

  const payload: any = (await verifyToolJwt(jwt, reg)).payload;
  if (payload[CLAIMS.VERSION] !== '1.3.0') return err('Invalid LTI version', 401);
  if (payload[CLAIMS.MESSAGE_TYPE] !== 'LtiDeepLinkingResponse') return err('Invalid message type for deep-link return', 401);

  const courseId = parseCourseIdFromContext(payload);
  const deploymentId = String(payload[CLAIMS.DEPLOYMENT_ID] || '');
  const deployment = await resolveDeployment(supabase, reg.id, deploymentId, courseId);
  if (!deployment) return err('Invalid or inactive deployment', 401);

  const { data: recentDlLaunch } = await supabase
    .from('lti_launches')
    .select('id')
    .eq('registration_id', reg.id)
    .eq('deployment_id', deploymentId)
    .eq('course_id', courseId)
    .eq('message_type', 'LtiDeepLinkingRequest')
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!recentDlLaunch) return err('No matching deep-link launch found', 401);

  const items = Array.isArray(payload[CLAIMS.DL_ITEMS]) ? payload[CLAIMS.DL_ITEMS] : [];

  for (const item of items) {
    const itemType = String(item.type || 'unknown');
    const preview = itemType === 'file' ? String(item.title || item.text || '').slice(0, 50) : null;
    await supabase.from('lti_deep_link_items').insert({
      org_id: reg.org_id,
      course_id: courseId,
      registration_id: reg.id,
      deployment_id: deploymentId,
      launch_id: recentDlLaunch.id,
      content_item_type: itemType,
      content_title: item.title || null,
      content_url: item.url || null,
      custom_claims: { ...item, file_preview_50: preview },
      created_lms_type: itemType,
      created_lms_id: null
    });
  }

  return html('<h3>Deep link response accepted.</h3>');
}

async function handleAgsLineitems(req: Request, env: Env, supabase: any, courseId: string) {
  try {
    await authorizeServiceRequest(req, env, supabase, [AGS_SCOPES.LINEITEM, AGS_SCOPES.LINEITEM_READONLY], courseId);
  } catch (e: any) {
    return err(e?.message || 'Unauthorized', 401);
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('lti_ags_line_items').select('*').eq('course_id', courseId);
    if (error) return err(error.message, 500);
    return json(data || []);
  }
  if (req.method === 'POST') {
    const body: any = await req.json();
    const orgId = body.org_id || (await resolveCourseOrgId(supabase, courseId));
    if (!orgId) return err('Missing org_id (and could not infer from course)', 400);
    const { data, error } = await supabase
      .from('lti_ags_line_items')
      .insert({
        org_id: orgId,
        course_id: courseId,
        registration_id: body.registration_id || null,
        deployment_id: body.deployment_id || null,
        assignment_id: body.assignment_id || null,
        lineitem_url: body.id || body.lineitem_url || crypto.randomUUID(),
        label: body.label || 'Line Item',
        score_max: body.scoreMaximum ?? body.score_max ?? 100,
        resource_id: body.resourceId || null,
        tag: body.tag || null,
        lti_context_id: body.contextId || null
      })
      .select('*')
      .single();
    if (error) return err(error.message, 500);
    return json(data, 201);
  }
  return err('Method not allowed', 405);
}

async function handleAgsLineitemById(req: Request, env: Env, supabase: any, lineItemId: string) {
  const { data: existing } = await supabase.from('lti_ags_line_items').select('course_id').eq('id', lineItemId).maybeSingle();
  try {
    await authorizeServiceRequest(req, env, supabase, [AGS_SCOPES.LINEITEM, AGS_SCOPES.LINEITEM_READONLY], existing?.course_id || null);
  } catch (e: any) {
    return err(e?.message || 'Unauthorized', 401);
  }

  if (req.method === 'GET') {
    const { data } = await supabase.from('lti_ags_line_items').select('*').eq('id', lineItemId).maybeSingle();
    if (!data) return err('Line item not found', 404);
    return json(data);
  }
  if (req.method === 'PUT') {
    const body: any = await req.json();
    const { data, error } = await supabase
      .from('lti_ags_line_items')
      .update({ label: body.label, score_max: body.scoreMaximum ?? body.score_max, tag: body.tag, resource_id: body.resourceId ?? undefined })
      .eq('id', lineItemId)
      .select('*')
      .single();
    if (error) return err(error.message, 500);
    return json(data);
  }
  if (req.method === 'DELETE') {
    const { error } = await supabase.from('lti_ags_line_items').delete().eq('id', lineItemId);
    if (error) return err(error.message, 500);
    return new Response('', { status: 204 });
  }
  return err('Method not allowed', 405);
}

async function handleAgsScores(req: Request, env: Env, supabase: any, lineItemId: string) {
  if (req.method !== 'POST') return err('Method not allowed', 405);
  const { data: li } = await supabase.from('lti_ags_line_items').select('*').eq('id', lineItemId).maybeSingle();
  if (!li) return err('Line item not found', 404);

  try {
    await authorizeServiceRequest(req, env, supabase, [AGS_SCOPES.SCORE], li.course_id);
  } catch (e: any) {
    return err(e?.message || 'Unauthorized', 401);
  }

  const body: any = await req.json();
  const userId = body.userId || body.user_id || null;
  const scoreGiven = Number(body.scoreGiven ?? body.score_given ?? 0);
  const scoreMax = Number(body.scoreMaximum ?? body.score_max ?? li.score_max);

  const { data, error } = await supabase
    .from('lti_ags_scores')
    .insert({
      org_id: li.org_id,
      line_item_id: lineItemId,
      user_id: userId,
      score_given: scoreGiven,
      score_max: scoreMax,
      activity_progress: body.activityProgress || null,
      grading_progress: body.gradingProgress || null,
      timestamp_from_tool: body.timestamp || new Date().toISOString(),
      raw_payload: body
    })
    .select('*')
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}

async function handleAgsResults(req: Request, env: Env, supabase: any, lineItemId: string) {
  if (req.method !== 'GET') return err('Method not allowed', 405);
  const { data: li } = await supabase.from('lti_ags_line_items').select('course_id').eq('id', lineItemId).maybeSingle();
  if (!li) return err('Line item not found', 404);

  try {
    await authorizeServiceRequest(req, env, supabase, [AGS_SCOPES.RESULT_READONLY], li.course_id);
  } catch (e: any) {
    return err(e?.message || 'Unauthorized', 401);
  }

  const { data, error } = await supabase
    .from('lti_ags_scores')
    .select('user_id, score_given, score_max, activity_progress, grading_progress, timestamp_from_tool, created_at')
    .eq('line_item_id', lineItemId)
    .order('created_at', { ascending: false });
  if (error) return err(error.message, 500);
  return json(data || []);
}

async function handleNrps(req: Request, env: Env, supabase: any, courseId: string) {
  if (req.method !== 'GET') return err('Method not allowed', 405);

  try {
    await authorizeServiceRequest(req, env, supabase, [NRPS_SCOPE], courseId);
  } catch (e: any) {
    return err(e?.message || 'Unauthorized', 401);
  }

  const u = new URL(req.url);
  const limit = Math.max(1, Math.min(1000, Number(u.searchParams.get('limit') || 100)));
  const page = Math.max(1, Number(u.searchParams.get('page') || 1));
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

  const orgId = await resolveCourseOrgId(supabase, courseId);
  if (orgId) {
    await supabase.from('lti_nrps_requests').insert({
      org_id: orgId,
      course_id: courseId,
      role_filter: null,
      limit_n: limit,
      page_n: page,
      result_count: members.length,
      status_code: 200,
      correlation_id: crypto.randomUUID()
    });
  }

  return json({ id: courseId, context: { id: courseId }, members });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    try {
      if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: corsHeaders() });
      if (req.method === 'GET' && url.pathname === '/healthz') return json({ ok: true }, 200, corsHeaders());
      if (req.method === 'GET' && url.pathname === '/.well-known/jwks.json') return json(await (await handleJwks(env)).json(), 200, corsHeaders());
      if (req.method === 'GET' && url.pathname === '/lti/oidc/login') return handleOidcLogin(req, env, supabase);
      if (req.method === 'POST' && url.pathname === '/lti/launch') return handleLaunch(req, supabase);
      if (req.method === 'POST' && url.pathname === '/lti/deep-link/return') return handleDeepLinkReturn(req, supabase);
      if (req.method === 'POST' && url.pathname === '/lti/oauth2/token') return handleToken(req, env, supabase);

      const agsCourse = url.pathname.match(/^\/lti\/ags\/courses\/([^/]+)\/lineitems$/);
      if (agsCourse) return handleAgsLineitems(req, env, supabase, agsCourse[1]);

      const agsLineItem = url.pathname.match(/^\/lti\/ags\/lineitems\/([^/]+)$/);
      if (agsLineItem) return handleAgsLineitemById(req, env, supabase, agsLineItem[1]);

      const agsScores = url.pathname.match(/^\/lti\/ags\/lineitems\/([^/]+)\/scores$/);
      if (agsScores) return handleAgsScores(req, env, supabase, agsScores[1]);

      const agsResults = url.pathname.match(/^\/lti\/ags\/lineitems\/([^/]+)\/results$/);
      if (agsResults) return handleAgsResults(req, env, supabase, agsResults[1]);

      const nrps = url.pathname.match(/^\/lti\/nrps\/courses\/([^/]+)\/memberships$/);
      if (nrps) return handleNrps(req, env, supabase, nrps[1]);

      return err('Not found', 404);
    } catch (e: any) {
      return err(e?.message || 'Unhandled error', 500);
    }
  }
};
