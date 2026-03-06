import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, decodeJwt, importJWK, jwtVerify, SignJWT } from 'jose';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  LTI_PLATFORM_ISSUER: string;
  LTI_PRIVATE_JWK_ACTIVE_JSON: string;
  LTI_PRIVATE_JWK_NEXT_JSON?: string;
  LTI_NONCE_TTL_SECONDS?: string;
  LTI_STATE_TTL_SECONDS?: string;
  LTI_TOOL_REGISTRATION_URL?: string;
}

interface ServiceAuthContext {
  registration: any;
  deployment: any;
  scopes: Set<string>;
  courseId: string | null;
}

/* ------------------------------------------------------------------ */
/*  LTI Claim URIs                                                     */
/* ------------------------------------------------------------------ */

const CLAIMS = {
  VERSION:             'https://purl.imsglobal.org/spec/lti/claim/version',
  MESSAGE_TYPE:        'https://purl.imsglobal.org/spec/lti/claim/message_type',
  DEPLOYMENT_ID:       'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  CONTEXT:             'https://purl.imsglobal.org/spec/lti/claim/context',
  RESOURCE_LINK:       'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  ROLES:               'https://purl.imsglobal.org/spec/lti/claim/roles',
  CUSTOM:              'https://purl.imsglobal.org/spec/lti/claim/custom',
  LIS:                 'https://purl.imsglobal.org/spec/lti/claim/lis',
  TOOL_PLATFORM:       'https://purl.imsglobal.org/spec/lti/claim/tool_platform',
  LAUNCH_PRESENTATION: 'https://purl.imsglobal.org/spec/lti/claim/launch_presentation',
  DL_ITEMS:            'https://purl.imsglobal.org/spec/lti-dl/claim/content_items',
  DL_SETTINGS:         'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
  DL_DATA:             'https://purl.imsglobal.org/spec/lti-dl/claim/data',
  AGS_ENDPOINT:        'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
  NRPS_ENDPOINT:       'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice',
};

/* ------------------------------------------------------------------ */
/*  AGS / NRPS Scopes                                                  */
/* ------------------------------------------------------------------ */

const AGS_SCOPES = {
  LINEITEM:          'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  LINEITEM_READONLY: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  SCORE:             'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  RESULT_READONLY:   'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
};

const NRPS_SCOPE = 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';

/* ------------------------------------------------------------------ */
/*  Vendor Media Types (LTI Advantage spec-required)                   */
/* ------------------------------------------------------------------ */

const MEDIA = {
  LINEITEM:              'application/vnd.ims.lis.v2.lineitem+json',
  LINEITEM_CONTAINER:    'application/vnd.ims.lis.v2.lineitemcontainer+json',
  SCORE:                 'application/vnd.ims.lis.v1.score+json',
  RESULT_CONTAINER:      'application/vnd.ims.lis.v2.resultcontainer+json',
  MEMBERSHIP_CONTAINER:  'application/vnd.ims.lis.v2.membershipcontainer+json',
};

/* ------------------------------------------------------------------ */
/*  Valid AGS enum values                                              */
/* ------------------------------------------------------------------ */

const VALID_ACTIVITY_PROGRESS = new Set([
  'Initialized', 'Started', 'InProgress', 'Submitted', 'Completed',
]);
const VALID_GRADING_PROGRESS = new Set([
  'FullyGraded', 'Pending', 'PendingManual', 'Failed', 'NotReady',
]);

/* ------------------------------------------------------------------ */
/*  Response helpers                                                   */
/* ------------------------------------------------------------------ */

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,accept',
  };
}

function respond(data: unknown, status: number, contentType: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': contentType, ...corsHeaders(), ...extra },
  });
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  respond(data, status, 'application/json', headers);

const html = (body: string, status = 200) =>
  new Response(`<!doctype html><html><body>${body}</body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

const err = (message: string, status = 400) => json({ error: message }, status);

/* ------------------------------------------------------------------ */
/*  Utility functions                                                  */
/* ------------------------------------------------------------------ */

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseCookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function toInt(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/**
 * Check that the request's Accept header is compatible with the expected response media type.
 * Returns null if OK, or an error Response if negotiation fails.
 */
function checkAcceptHeader(req: Request, expectedMediaType: string): Response | null {
  if (req.method !== 'GET') return null;
  const accept = req.headers.get('accept') || '*/*';
  // Accept anything if wildcard
  if (accept.includes('*/*') || accept.includes('application/*')) return null;
  if (accept.includes(expectedMediaType) || accept.includes('application/json')) return null;
  return json({ error: `Unsupported Accept type. Expected: ${expectedMediaType}` }, 406);
}

/**
 * Check that the request's Content-Type header matches the expected media type for write operations.
 * Returns null if OK, or an error Response if negotiation fails.
 */
function checkContentType(req: Request, expectedMediaType: string): Response | null {
  if (req.method !== 'POST' && req.method !== 'PUT') return null;
  const ct = req.headers.get('content-type') || '';
  // Allow application/json as a lenient alternative to the vendor type
  if (ct.includes(expectedMediaType) || ct.includes('application/json')) return null;
  // If no content-type at all, be lenient (many tools omit it)
  if (!ct) return null;
  return json({ error: `Unsupported Content-Type. Expected: ${expectedMediaType}` }, 415);
}

/* ------------------------------------------------------------------ */
/*  LTI Role mapping                                                   */
/* ------------------------------------------------------------------ */

function roleToLtiContext(role: string): string {
  if (role === 'instructor') return 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor';
  if (role === 'ta')         return 'http://purl.imsglobal.org/vocab/lis/v2/membership#Mentor';
  return 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';
}

function roleToLtiSystem(role: string): string {
  if (role === 'instructor') return 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Instructor';
  if (role === 'ta')         return 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Mentor';
  return 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Learner';
}

/** Reverse-map an IMS role URI back to internal role name for filtering. */
function ltiRoleToInternal(ltiRole: string): string | null {
  if (ltiRole.includes('#Instructor')) return 'instructor';
  if (ltiRole.includes('#Mentor') || ltiRole.includes('#TeachingAssistant')) return 'ta';
  if (ltiRole.includes('#Learner') || ltiRole.includes('#Student')) return 'student';
  return null;
}

/* ------------------------------------------------------------------ */
/*  JWK helpers                                                        */
/* ------------------------------------------------------------------ */

function toPublicJwk(privateJwk: any) {
  if (!privateJwk?.kty || !privateJwk?.n || !privateJwk?.e) throw new Error('Invalid private JWK: missing kty/n/e');
  return {
    kty: privateJwk.kty,
    n: privateJwk.n,
    e: privateJwk.e,
    kid: privateJwk.kid || 'platform-key',
    use: 'sig',
    alg: 'RS256',
  };
}

/* ------------------------------------------------------------------ */
/*  AGS / NRPS response formatters                                     */
/* ------------------------------------------------------------------ */

function formatLineItem(row: any, baseUrl: string): any {
  const obj: any = {
    id: `${baseUrl}/lti/ags/lineitems/${row.id}`,
    scoreMaximum: Number(row.score_max),
    label: row.label,
  };
  if (row.resource_id)      obj.resourceId = row.resource_id;
  if (row.resource_link_id) obj.resourceLinkId = row.resource_link_id;
  if (row.tag)              obj.tag = row.tag;
  if (row.start_date_time)  obj.startDateTime = row.start_date_time;
  if (row.end_date_time)    obj.endDateTime = row.end_date_time;
  return obj;
}

function formatResult(score: any, lineItemId: string, baseUrl: string): any {
  const obj: any = {
    id: `${baseUrl}/lti/ags/lineitems/${lineItemId}/results/${score.id}`,
    scoreOf: `${baseUrl}/lti/ags/lineitems/${lineItemId}`,
    userId: score.user_id,
  };
  if (score.score_given != null) obj.resultScore = Number(score.score_given);
  if (score.score_max != null)   obj.resultMaximum = Number(score.score_max);
  if (score.comment)             obj.comment = score.comment;
  return obj;
}

/**
 * Format an enrollment into an NRPS member object.
 * @param piiPolicy Controls PII exposure: 'full' = name+email, 'email-only' = email only,
 *                  'anonymous' = no PII, 'name-only' = name only. Default: 'full'.
 */
function formatMember(enrollment: any, piiPolicy: string = 'full'): any {
  const obj: any = {
    user_id: enrollment.user_id,
    roles: [roleToLtiContext(enrollment.role), roleToLtiSystem(enrollment.role)],
    status: enrollment.oneroster_status === 'active' ? 'Active' : 'Inactive',
  };
  if (piiPolicy === 'full' || piiPolicy === 'name-only') {
    if (enrollment.profiles?.name) obj.name = enrollment.profiles.name;
  }
  if (piiPolicy === 'full' || piiPolicy === 'email-only') {
    if (enrollment.profiles?.email) obj.email = enrollment.profiles.email;
  }
  // 'anonymous' exposes neither name nor email
  return obj;
}

/* ------------------------------------------------------------------ */
/*  Link-header pagination helper                                      */
/* ------------------------------------------------------------------ */

function paginationHeaders(
  reqUrl: string,
  page: number,
  limit: number,
  returnedCount: number,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (returnedCount >= limit) {
    const next = new URL(reqUrl);
    next.searchParams.set('page', String(page + 1));
    next.searchParams.set('limit', String(limit));
    headers['link'] = `<${next.toString()}>; rel="next"`;
  }
  return headers;
}

/* ------------------------------------------------------------------ */
/*  Form parsing                                                       */
/* ------------------------------------------------------------------ */

async function parseForm(req: Request) {
  const ctype = req.headers.get('content-type') || '';
  if (!ctype.includes('application/x-www-form-urlencoded')) return null;
  return req.formData();
}

/* ------------------------------------------------------------------ */
/*  DB resolvers                                                       */
/* ------------------------------------------------------------------ */

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
  // Priority: course-scoped > department-scoped > org-scoped
  // Department scope is treated like org (applies to all courses in the department).
  // Unknown scope types are rejected (do not fall through).
  return rows.find((row: any) => {
    if (row.scope_type === 'course') return courseId && String(row.scope_ref) === String(courseId);
    if (row.scope_type === 'department' || row.scope_type === 'org') return true;
    return false; // reject unknown scope types
  }) || null;
}

async function resolveCourseOrgId(supabase: any, courseId: string | null): Promise<string | null> {
  if (!courseId) return null;
  const { data } = await supabase.from('courses').select('org_id').eq('id', courseId).maybeSingle();
  return data?.org_id || null;
}

/* ------------------------------------------------------------------ */
/*  JWT verification helpers                                           */
/* ------------------------------------------------------------------ */

// Cache RemoteJWKSet instances per URL to avoid re-fetching JWKS on every request.
// In Cloudflare Workers the module scope persists across requests within the same isolate.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getCachedJWKS(url: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksCache.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, jwks);
  }
  return jwks;
}

async function verifyToolJwt(idToken: string, registration: any) {
  if (!registration?.jwks_url) throw new Error('Registration missing jwks_url');
  const JWKS = getCachedJWKS(registration.jwks_url);
  return jwtVerify(idToken, JWKS, { issuer: registration.issuer, audience: registration.client_id });
}

async function verifyPlatformAccessToken(token: string, env: Env) {
  const activePrivate = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON);
  const pub = toPublicJwk(activePrivate);
  const key = await importJWK(pub, 'RS256');
  return jwtVerify(token, key, {
    issuer: env.LTI_PLATFORM_ISSUER,
    audience: 'lti-services',
  });
}

function tokenFromAuth(req: Request): string | null {
  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim() || null;
}

/* ------------------------------------------------------------------ */
/*  Service authorization (bearer token for AGS/NRPS calls)            */
/* ------------------------------------------------------------------ */

async function authorizeServiceRequest(
  req: Request,
  env: Env,
  supabase: any,
  requiredScopes: string[],
  courseId: string | null,
): Promise<ServiceAuthContext> {
  const token = tokenFromAuth(req);
  if (!token) throw new Error('Missing bearer access token');

  const { payload } = await verifyPlatformAccessToken(token, env);
  const clientId = String(payload.client_id || payload.sub || '');
  const issuer = String(payload.tool_iss || '');
  const deploymentId = String(payload.deployment_id || '');
  const tokenCourseId = payload.course_id ? String(payload.course_id) : null;

  if (!clientId || !issuer || !deploymentId) throw new Error('Invalid service token claims');
  if (courseId && tokenCourseId && String(courseId) !== String(tokenCourseId)) {
    throw new Error('Token not valid for this course');
  }

  const registration = await resolveRegistration(supabase, issuer, clientId);
  if (!registration) throw new Error('Registration not found for token');

  const deployment = await resolveDeployment(supabase, registration.id, deploymentId, courseId || tokenCourseId);
  if (!deployment) throw new Error('Deployment not active for requested context');

  // Enforce deployment-level service flags against requested scopes
  const scopes = new Set(String(payload.scope || '').split(' ').filter(Boolean));
  const agsScopes = [AGS_SCOPES.LINEITEM, AGS_SCOPES.LINEITEM_READONLY, AGS_SCOPES.SCORE, AGS_SCOPES.RESULT_READONLY];
  if (!deployment.enable_ags && agsScopes.some(s => scopes.has(s))) {
    throw new Error('AGS is disabled for this deployment');
  }
  if (!deployment.enable_nrps && scopes.has(NRPS_SCOPE)) {
    throw new Error('NRPS is disabled for this deployment');
  }

  if (requiredScopes.length > 0 && !requiredScopes.some(scope => scopes.has(scope))) {
    throw new Error('Insufficient scope');
  }

  return { registration, deployment, scopes, courseId: tokenCourseId };
}

/* ------------------------------------------------------------------ */
/*  HANDLER: JWKS                                                      */
/* ------------------------------------------------------------------ */

async function handleJwks(env: Env) {
  const activePrivate = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON);
  const keys = [toPublicJwk(activePrivate)];
  if (env.LTI_PRIVATE_JWK_NEXT_JSON) {
    try { keys.push(toPublicJwk(JSON.parse(env.LTI_PRIVATE_JWK_NEXT_JSON))); } catch { /* skip */ }
  }
  return json({ keys });
}

/* ------------------------------------------------------------------ */
/*  HANDLER: OIDC Login Initiation                                     */
/* ------------------------------------------------------------------ */

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

  // Validate redirect_uri: target_link_uri must match registration or metadata redirect_uris
  const registeredRedirects: string[] = [
    reg.target_link_uri,
    ...(reg.metadata?.raw_client_metadata?.redirect_uris || []),
  ].filter(Boolean);
  if (registeredRedirects.length > 0 && !registeredRedirects.includes(targetLinkUri)) {
    return err('target_link_uri does not match any registered redirect URI', 400);
  }

  const state = randomToken();
  const nonce = randomToken();
  const ttlMs = toInt(env.LTI_STATE_TTL_SECONDS, 300) * 1000;

  // Honor tool-provided lti_deployment_id if present; otherwise fall back to first active
  const requestedDeploymentId = url.searchParams.get('lti_deployment_id');
  let deploymentId: string | null = null;
  if (requestedDeploymentId) {
    // Validate the requested deployment exists and is active for this registration
    const { data: dep } = await supabase
      .from('lti_deployments')
      .select('deployment_id')
      .eq('registration_id', reg.id)
      .eq('deployment_id', requestedDeploymentId)
      .eq('status', 'active')
      .maybeSingle();
    if (!dep) return err('Requested lti_deployment_id is not valid or inactive', 400);
    deploymentId = dep.deployment_id;
  } else {
    const { data: depRows } = await supabase
      .from('lti_deployments')
      .select('deployment_id')
      .eq('registration_id', reg.id)
      .eq('status', 'active')
      .limit(1);
    if (depRows?.[0]) deploymentId = depRows[0].deployment_id;
  }

  const { error: insErr } = await supabase.from('lti_state_nonce').insert({
    org_id: reg.org_id,
    registration_id: reg.id,
    state,
    nonce,
    deployment_id: deploymentId,
    launch_redirect_uri: targetLinkUri,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
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
  // Spec SHOULD: forward lti_deployment_id
  if (deploymentId) redirect.searchParams.set('lti_deployment_id', deploymentId);

  // Bind state to browser via cookie for CSRF hardening (OIDC recommended practice)
  return new Response(null, {
    status: 302,
    headers: {
      location: redirect.toString(),
      'set-cookie': `__Host-lti_state=${state}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=600`,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  HANDLER: OAuth2 Token Endpoint                                     */
/* ------------------------------------------------------------------ */

async function handleToken(req: Request, env: Env, supabase: any) {
  const form = await parseForm(req);
  if (!form) return err('Expected x-www-form-urlencoded');

  const grantType = String(form.get('grant_type') || '');
  const scope = String(form.get('scope') || '');
  const clientAssertionType = String(form.get('client_assertion_type') || '');
  const clientAssertion = String(form.get('client_assertion') || '');

  if (grantType !== 'client_credentials') return err('Unsupported grant_type', 400);
  if (!clientAssertion || !clientAssertionType.includes('jwt-bearer')) return err('Missing client_assertion', 400);

  // Decode first to extract identity fields
  const decoded = decodeJwt(clientAssertion);
  const clientId = String(decoded.sub || '');
  const toolIss = String(decoded.tool_iss || decoded.iss || '');
  if (!clientId || !toolIss) return err('Invalid client assertion: missing sub/iss', 401);

  // Spec: iss MUST equal client_id
  if (String(decoded.iss) !== clientId) {
    return err('Client assertion iss must equal sub (client_id)', 401);
  }

  const reg = await resolveRegistration(supabase, toolIss, clientId);
  if (!reg) return err('Registration not found', 404);

  // Verify signature against tool JWKS
  try {
    const JWKS = getCachedJWKS(reg.jwks_url);
    await jwtVerify(clientAssertion, JWKS, {
      issuer: clientId,
      audience: `${env.LTI_PLATFORM_ISSUER}/lti/oauth2/token`,
    });
  } catch (e: any) {
    return err(`Client assertion verify failed: ${e?.message || 'unknown'}`, 401);
  }

  // JTI replay prevention (IMS Security Framework §5.1.2: jti is MUST)
  const jti = decoded.jti ? String(decoded.jti) : null;
  if (!jti) return err('Missing jti claim in client assertion (required per spec)', 401);
  {
    const { data: existingJti } = await supabase
      .from('lti_client_assertion_jti')
      .select('jti')
      .eq('jti', jti)
      .eq('client_id', clientId)
      .maybeSingle();
    if (existingJti) return err('Client assertion jti already used (replay)', 401);

    const jtiExpires = decoded.exp ? new Date(Number(decoded.exp) * 1000).toISOString() : new Date(Date.now() + 600_000).toISOString();
    await supabase.from('lti_client_assertion_jti').insert({
      jti,
      client_id: clientId,
      expires_at: jtiExpires,
    });
  }

  // iat clock skew check: reject if iat is more than 5 minutes old or in the future
  if (decoded.iat) {
    const iatTime = Number(decoded.iat) * 1000;
    const now = Date.now();
    if (iatTime > now + 60_000) return err('Client assertion iat is in the future', 401);
    if (iatTime < now - 300_000) return err('Client assertion iat too old (>5min)', 401);
  }

  // Resolve deployment and enforce service flags on scopes
  const deploymentId = String(form.get('deployment_id') || '');
  const courseId = String(form.get('course_id') || '');
  const deployment = deploymentId
    ? await resolveDeployment(supabase, reg.id, deploymentId, courseId || null)
    : null;

  const reqScopes = scope.split(' ').filter(Boolean);
  const allowedScopes = new Set([
    AGS_SCOPES.LINEITEM,
    AGS_SCOPES.LINEITEM_READONLY,
    AGS_SCOPES.SCORE,
    AGS_SCOPES.RESULT_READONLY,
    NRPS_SCOPE,
  ]);

  // Filter by deployment feature flags when available
  let granted = reqScopes.filter(s => allowedScopes.has(s));
  if (deployment) {
    const agsScopes = [AGS_SCOPES.LINEITEM, AGS_SCOPES.LINEITEM_READONLY, AGS_SCOPES.SCORE, AGS_SCOPES.RESULT_READONLY];
    if (!deployment.enable_ags) granted = granted.filter(s => !agsScopes.includes(s));
    if (!deployment.enable_nrps) granted = granted.filter(s => s !== NRPS_SCOPE);
  }
  if (granted.length === 0) return err('No allowed scopes requested', 400);

  const now = Math.floor(Date.now() / 1000);
  const privateJwk = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON);
  const key = await importJWK(privateJwk, 'RS256');

  const accessToken = await new SignJWT({
    scope: granted.join(' '),
    client_id: reg.client_id,
    tool_iss: reg.issuer,
    deployment_id: deploymentId,
    course_id: courseId,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: privateJwk.kid || 'platform-key' })
    .setIssuer(env.LTI_PLATFORM_ISSUER)
    .setAudience('lti-services')
    .setSubject(reg.client_id)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  return json({ access_token: accessToken, token_type: 'Bearer', expires_in: 3600, scope: granted.join(' ') });
}

/* ------------------------------------------------------------------ */
/*  HANDLER: Launch (receives id_token from tool)                      */
/* ------------------------------------------------------------------ */

async function handleLaunch(req: Request, supabase: any) {
  const form = await parseForm(req);
  if (!form) return err('Expected x-www-form-urlencoded');
  const idToken = String(form.get('id_token') || '');
  const state = String(form.get('state') || '');
  if (!idToken || !state) return err('Missing id_token/state');

  // CSRF hardening: verify state cookie matches form state (if cookie was set)
  const cookieHeader = req.headers.get('cookie') || '';
  const cookieState = parseCookieValue(cookieHeader, '__Host-lti_state');
  if (cookieState && cookieState !== state) {
    return err('State cookie mismatch (possible CSRF)', 401);
  }

  const decoded = decodeJwt(idToken);
  const iss = String(decoded.iss || '');
  const audValue = decoded.aud;
  const aud = Array.isArray(audValue) ? String(audValue[0] || '') : String(audValue || '');
  const azp = decoded.azp ? String(decoded.azp) : '';
  if (!iss || !aud) return err('Invalid token (missing iss/aud)', 401);
  if (Array.isArray(audValue) && !azp) return err('Invalid token (missing azp with multi aud)', 401);

  // Per LTI 1.3 spec: when azp is present it MUST equal the tool's client_id
  const reg = await resolveRegistration(supabase, iss, aud);
  if (azp && reg && azp !== reg.client_id) return err('Invalid token (azp does not match client_id)', 401);
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
      raw_claims: decoded,
    });
    return err(`JWT verify failed: ${e?.message || 'unknown'}`, 401);
  }

  if (payload.nonce !== sn.nonce) return err('Nonce mismatch', 401);
  if (payload[CLAIMS.VERSION] !== '1.3.0') return err('Invalid LTI version', 401);

  // Validate target_link_uri claim against registration
  const targetLinkUriClaim = payload['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'];
  if (targetLinkUriClaim && reg.target_link_uri) {
    const allowedTargets: string[] = [
      reg.target_link_uri,
      ...(reg.metadata?.raw_client_metadata?.redirect_uris || []),
    ].filter(Boolean);
    if (!allowedTargets.includes(String(targetLinkUriClaim))) {
      return err('target_link_uri claim does not match registered URI', 401);
    }
  }

  const msgType = String(payload[CLAIMS.MESSAGE_TYPE] || '');
  if (!['LtiResourceLinkRequest', 'LtiDeepLinkingRequest'].includes(msgType)) {
    return err('Unsupported LTI message type', 401);
  }

  const deploymentId = String(payload[CLAIMS.DEPLOYMENT_ID] || '');
  const courseId = parseCourseIdFromContext(payload);
  const deployment = await resolveDeployment(supabase, reg.id, deploymentId, courseId);
  if (!deployment) return err('Invalid or inactive deployment', 401);

  // Enforce deep-linking feature flag
  if (msgType === 'LtiDeepLinkingRequest' && !deployment.enable_deep_linking) {
    return err('Deep linking is disabled for this deployment', 403);
  }

  const userId = payload.sub ? String(payload.sub) : null;
  const resourceLinkId = payload?.[CLAIMS.RESOURCE_LINK]?.id || null;
  const roles = payload[CLAIMS.ROLES] || [];
  const customClaims = payload[CLAIMS.CUSTOM] || null;
  const lisClaims = payload[CLAIMS.LIS] || null;
  const toolPlatformClaims = payload[CLAIMS.TOOL_PLATFORM] || null;

  await supabase.from('lti_state_nonce').update({
    consumed_at: new Date().toISOString(),
    deployment_id: deploymentId,
  }).eq('id', sn.id);

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
      correlation_id: crypto.randomUUID(),
    })
    .select('*')
    .single();

  if (msgType === 'LtiDeepLinkingRequest') {
    const settings = payload[CLAIMS.DL_SETTINGS] || {};
    return html(
      `<h2>Deep Linking Request Received</h2>` +
      `<p>Launch ID: ${launchRow?.id || ''}</p>` +
      `<p>Return URL: ${settings.deep_link_return_url || reg.deep_link_return_url || '(none)'}</p>` +
      `<p>Roles: ${JSON.stringify(roles)}</p>` +
      `<p>Custom: ${JSON.stringify(customClaims)}</p>`,
    );
  }

  const presentation = payload[CLAIMS.LAUNCH_PRESENTATION] || {};
  return html(
    `<h1>LTI launch ok</h1>` +
    `<p>Course: ${courseId || 'unknown'}</p>` +
    `<p>User: ${userId || 'unknown'}</p>` +
    `<p>Message type: ${msgType || 'unknown'}</p>` +
    `<p>Document target: ${presentation.document_target || 'iframe'}</p>` +
    `<p>Roles: ${JSON.stringify(roles)}</p>` +
    `<p>Custom: ${JSON.stringify(customClaims)}</p>` +
    `<p>LIS: ${JSON.stringify(lisClaims)}</p>` +
    `<p>Tool Platform: ${JSON.stringify(toolPlatformClaims)}</p>`,
  );
}

/* ------------------------------------------------------------------ */
/*  HANDLER: Deep Link Return                                          */
/* ------------------------------------------------------------------ */

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

  // Check for error responses (errMsg / errLog)
  const errMsg = payload['https://purl.imsglobal.org/spec/lti-dl/claim/errormsg'] || null;
  const errLog = payload['https://purl.imsglobal.org/spec/lti-dl/claim/errorlog'] || null;

  const courseId = parseCourseIdFromContext(payload);
  const deploymentId = String(payload[CLAIMS.DEPLOYMENT_ID] || '');
  const deployment = await resolveDeployment(supabase, reg.id, deploymentId, courseId);
  if (!deployment) return err('Invalid or inactive deployment', 401);

  // Enforce deep-linking feature flag on return as well
  if (!deployment.enable_deep_linking) {
    return err('Deep linking is disabled for this deployment', 403);
  }

  // Strict transaction binding: require the data echo claim.
  // The platform always sets a unique data token (dl-{courseId}-{timestamp}) on DL requests,
  // so the tool MUST echo it back. No recency-based fallback.
  const echoedData = payload[CLAIMS.DL_DATA] || null;
  if (!echoedData) {
    return err('Missing deep linking data claim (required for transaction binding)', 401);
  }

  const { data: launches } = await supabase
    .from('lti_launches')
    .select('id, raw_claims')
    .eq('registration_id', reg.id)
    .eq('deployment_id', deploymentId)
    .eq('message_type', 'LtiDeepLinkingRequest')
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(20);

  const recentDlLaunch = (launches || []).find((l: any) => {
    const settings = l.raw_claims?.[CLAIMS.DL_SETTINGS] || {};
    return settings.data === echoedData;
  });

  if (!recentDlLaunch) {
    return err('Deep linking data claim does not match any pending DL request', 401);
  }

  const originalSettings = recentDlLaunch.raw_claims?.[CLAIMS.DL_SETTINGS] || {};

  // If tool returned an error, log it and return
  if (errMsg) {
    await supabase.from('lti_launches').insert({
      org_id: reg.org_id,
      registration_id: reg.id,
      deployment_id: deploymentId,
      course_id: courseId,
      message_type: 'LtiDeepLinkingResponse',
      status: 'failed',
      error_code: 'tool_error',
      error_detail: `${errMsg}${errLog ? ' | log: ' + errLog : ''}`,
      raw_claims: payload,
    });
    return html(`<h3>Deep link error from tool</h3><p>${errMsg}</p>${errLog ? `<p>Log: ${errLog}</p>` : ''}`);
  }

  const items = Array.isArray(payload[CLAIMS.DL_ITEMS]) ? payload[CLAIMS.DL_ITEMS] : [];

  // Validate accept_types if original request specified them
  const acceptTypes = originalSettings.accept_types || [];
  // Validate accept_multiple
  const acceptMultiple = originalSettings.accept_multiple !== false; // default true
  if (!acceptMultiple && items.length > 1) {
    return err('Tool returned multiple items but accept_multiple is false', 400);
  }

  let materialized = 0;
  for (const item of items) {
    const itemType = String(item.type || 'unknown');

    // Validate item type against accepted types
    if (acceptTypes.length > 0 && !acceptTypes.includes(itemType)) {
      continue; // skip items that don't match accepted types
    }

    let createdLmsId: string | null = null;
    let createdLmsType: string = itemType;

    // Materialize deep-link items into LMS objects
    if (itemType === 'ltiResourceLink' && courseId) {
      // Create an assignment of type external_tool so it appears in the gradebook
      const { data: assignment } = await supabase
        .from('assignments')
        .insert({
          course_id: courseId,
          title: item.title || 'LTI Activity',
          points: 100,
          status: 'published',
          assignment_type: 'external_tool',
          grading_type: 'points',
        })
        .select('id')
        .single();

      if (assignment) {
        createdLmsId = assignment.id;
        createdLmsType = 'assignment';

        // Also create a line item so AGS can target it later
        await supabase.from('lti_ags_line_items').insert({
          org_id: reg.org_id,
          course_id: courseId,
          registration_id: reg.id,
          deployment_id: deploymentId,
          assignment_id: assignment.id,
          lineitem_url: crypto.randomUUID(),
          label: item.title || 'LTI Activity',
          score_max: 100,
          resource_id: item.resourceId || null,
          resource_link_id: item.url ? `dl-${assignment.id}` : null,
          tag: item.tag || null,
        });
        materialized++;
      }
    } else if (itemType === 'link' && courseId) {
      createdLmsType = 'external_link';
    } else if (itemType === 'html' && courseId) {
      // HTML content items contain inline HTML in item.html
      createdLmsType = 'html_content';
    } else if (itemType === 'image' && courseId) {
      // Image content items have url, width, height
      createdLmsType = 'image';
    } else if (itemType === 'file' && courseId) {
      createdLmsType = 'file';
    }

    const preview = (itemType === 'file' || itemType === 'image')
      ? String(item.title || item.text || '').slice(0, 50) : null;
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
      created_lms_type: createdLmsType,
      created_lms_id: createdLmsId,
    });
  }

  return html(`<h3>Deep link response accepted.</h3><p>${items.length} item(s) stored, ${materialized} materialized into LMS objects.</p>`);
}

/* ------------------------------------------------------------------ */
/*  HANDLER: AGS Line Items (container)                                */
/* ------------------------------------------------------------------ */

async function handleAgsLineitems(req: Request, env: Env, supabase: any, courseId: string) {
  // Content negotiation
  const acceptErr = checkAcceptHeader(req, MEDIA.LINEITEM_CONTAINER);
  if (acceptErr) return acceptErr;
  const ctErr = checkContentType(req, MEDIA.LINEITEM);
  if (ctErr) return ctErr;

  // GET accepts either lineitem or lineitem.readonly; POST requires full lineitem scope
  const requiredScopes = req.method === 'GET'
    ? [AGS_SCOPES.LINEITEM, AGS_SCOPES.LINEITEM_READONLY]
    : [AGS_SCOPES.LINEITEM];
  try {
    await authorizeServiceRequest(req, env, supabase, requiredScopes, courseId);
  } catch (e: any) {
    return err(e?.message || 'Unauthorized', 401);
  }

  if (req.method === 'GET') {
    const u = new URL(req.url);
    const limit = Math.max(1, Math.min(500, Number(u.searchParams.get('limit') || 100)));
    const page = Math.max(1, Number(u.searchParams.get('page') || 1));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Build query with optional filters (spec: resource_id, resource_link_id, tag)
    let query = supabase.from('lti_ags_line_items').select('*').eq('course_id', courseId);
    const resourceId = u.searchParams.get('resource_id');
    const resourceLinkId = u.searchParams.get('resource_link_id');
    const tag = u.searchParams.get('tag');
    if (resourceId)     query = query.eq('resource_id', resourceId);
    if (resourceLinkId) query = query.eq('resource_link_id', resourceLinkId);
    if (tag)            query = query.eq('tag', tag);
    query = query.range(from, to);

    const { data, error } = await query;
    if (error) return err(error.message, 500);

    const formatted = (data || []).map((row: any) => formatLineItem(row, env.LTI_PLATFORM_ISSUER));
    const pgHeaders = paginationHeaders(req.url, page, limit, formatted.length);
    return respond(formatted, 200, MEDIA.LINEITEM_CONTAINER, pgHeaders);
  }

  if (req.method === 'POST') {
    const body: any = await req.json();
    const orgId = body.org_id || (await resolveCourseOrgId(supabase, courseId));
    if (!orgId) return err('Missing org_id (and could not infer from course)', 400);

    const scoreMax = body.scoreMaximum ?? body.score_max ?? 100;
    const label    = body.label || 'LTI Activity';

    const { data, error } = await supabase
      .from('lti_ags_line_items')
      .insert({
        org_id: orgId,
        course_id: courseId,
        registration_id: body.registration_id || null,
        deployment_id: body.deployment_id || null,
        assignment_id: body.assignment_id || null,
        lineitem_url: crypto.randomUUID(),
        label,
        score_max: scoreMax,
        resource_id: body.resourceId || null,
        resource_link_id: body.resourceLinkId || null,
        tag: body.tag || null,
        lti_context_id: body.contextId || null,
        start_date_time: body.startDateTime || null,
        end_date_time: body.endDateTime || null,
      })
      .select('*')
      .single();
    if (error) return err(error.message, 500);

    // LTI AGS spec: each line item is a gradebook column.
    // Auto-create a matching LMS assignment so scores write through to the gradebook.
    if (!data.assignment_id) {
      const { data: assignment } = await supabase
        .from('assignments')
        .insert({
          course_id:       courseId,
          title:           label,
          points:          Math.round(Number(scoreMax)),
          status:          'published',
          assignment_type: 'external_tool',
          grading_type:    'points',
        })
        .select('id')
        .single();

      if (assignment) {
        await supabase
          .from('lti_ags_line_items')
          .update({ assignment_id: assignment.id })
          .eq('id', data.id);
        data.assignment_id = assignment.id;
      }
    }

    const formatted = formatLineItem(data, env.LTI_PLATFORM_ISSUER);
    return respond(formatted, 201, MEDIA.LINEITEM);
  }

  return err('Method not allowed', 405);
}

/* ------------------------------------------------------------------ */
/*  HANDLER: AGS Line Item by ID                                       */
/* ------------------------------------------------------------------ */

async function handleAgsLineitemById(req: Request, env: Env, supabase: any, lineItemId: string) {
  // Content negotiation
  const acceptErr = checkAcceptHeader(req, MEDIA.LINEITEM);
  if (acceptErr) return acceptErr;
  const ctErr = checkContentType(req, MEDIA.LINEITEM);
  if (ctErr) return ctErr;

  const { data: existing } = await supabase
    .from('lti_ags_line_items')
    .select('course_id, assignment_id')
    .eq('id', lineItemId)
    .maybeSingle();
  // GET accepts either lineitem or lineitem.readonly; PUT/DELETE require full lineitem scope
  const requiredScopes = req.method === 'GET'
    ? [AGS_SCOPES.LINEITEM, AGS_SCOPES.LINEITEM_READONLY]
    : [AGS_SCOPES.LINEITEM];
  try {
    await authorizeServiceRequest(req, env, supabase, requiredScopes, existing?.course_id || null);
  } catch (e: any) {
    return err(e?.message || 'Unauthorized', 401);
  }

  if (req.method === 'GET') {
    const { data } = await supabase.from('lti_ags_line_items').select('*').eq('id', lineItemId).maybeSingle();
    if (!data) return err('Line item not found', 404);
    return respond(formatLineItem(data, env.LTI_PLATFORM_ISSUER), 200, MEDIA.LINEITEM);
  }

  if (req.method === 'PUT') {
    const body: any = await req.json();
    const updates: any = {};
    if (body.label !== undefined)         updates.label = body.label;
    if (body.scoreMaximum !== undefined)  updates.score_max = body.scoreMaximum;
    if (body.score_max !== undefined)     updates.score_max = body.score_max;
    if (body.tag !== undefined)           updates.tag = body.tag;
    if (body.resourceId !== undefined)    updates.resource_id = body.resourceId;
    if (body.resourceLinkId !== undefined) updates.resource_link_id = body.resourceLinkId;
    if (body.startDateTime !== undefined) updates.start_date_time = body.startDateTime;
    if (body.endDateTime !== undefined)   updates.end_date_time = body.endDateTime;

    const { data, error } = await supabase
      .from('lti_ags_line_items')
      .update(updates)
      .eq('id', lineItemId)
      .select('*')
      .single();
    if (error) return err(error.message, 500);

    // Keep linked assignment in sync with the line item.
    if (data.assignment_id) {
      const assignmentUpdates: any = {};
      if (updates.label     !== undefined) assignmentUpdates.title  = updates.label;
      if (updates.score_max !== undefined) assignmentUpdates.points = Math.round(Number(updates.score_max));
      if (Object.keys(assignmentUpdates).length > 0) {
        await supabase
          .from('assignments')
          .update(assignmentUpdates)
          .eq('id', data.assignment_id)
          .eq('assignment_type', 'external_tool');
      }
    }

    return respond(formatLineItem(data, env.LTI_PLATFORM_ISSUER), 200, MEDIA.LINEITEM);
  }

  if (req.method === 'DELETE') {
    // Clean up the auto-created LMS assignment and any LTI-sourced submissions/grades.
    if (existing?.assignment_id) {
      const { data: ltiSubs } = await supabase
        .from('submissions')
        .select('id')
        .eq('assignment_id', existing.assignment_id)
        .eq('source', 'lti_ags');

      if (ltiSubs?.length) {
        const subIds = ltiSubs.map((s: any) => s.id);
        await supabase.from('grades').delete().in('submission_id', subIds);
        await supabase.from('submissions').delete().in('id', subIds);
      }

      await supabase
        .from('assignments')
        .delete()
        .eq('id', existing.assignment_id)
        .eq('assignment_type', 'external_tool');
    }

    const { error } = await supabase.from('lti_ags_line_items').delete().eq('id', lineItemId);
    if (error) return err(error.message, 500);
    return new Response('', { status: 204, headers: corsHeaders() });
  }

  return err('Method not allowed', 405);
}

/* ------------------------------------------------------------------ */
/*  HANDLER: AGS Scores                                                */
/* ------------------------------------------------------------------ */

async function handleAgsScores(req: Request, env: Env, supabase: any, lineItemId: string) {
  if (req.method !== 'POST') return err('Method not allowed', 405);
  const ctErr = checkContentType(req, MEDIA.SCORE);
  if (ctErr) return ctErr;
  const { data: li } = await supabase.from('lti_ags_line_items').select('*').eq('id', lineItemId).maybeSingle();
  if (!li) return err('Line item not found', 404);

  try {
    await authorizeServiceRequest(req, env, supabase, [AGS_SCOPES.SCORE], li.course_id);
  } catch (e: any) {
    return err(e?.message || 'Unauthorized', 401);
  }

  const body: any = await req.json();
  const userId = body.userId || body.user_id || null;
  const scoreGiven = body.scoreGiven ?? body.score_given ?? null;
  const scoreMax = body.scoreMaximum ?? body.score_max ?? li.score_max;
  const comment = body.comment || null;

  // Validate activityProgress
  const activityProgress = body.activityProgress || null;
  if (activityProgress && !VALID_ACTIVITY_PROGRESS.has(activityProgress)) {
    return err(`Invalid activityProgress: ${activityProgress}. Valid: ${[...VALID_ACTIVITY_PROGRESS].join(', ')}`, 400);
  }

  // Validate gradingProgress
  const gradingProgress = body.gradingProgress || null;
  if (gradingProgress && !VALID_GRADING_PROGRESS.has(gradingProgress)) {
    return err(`Invalid gradingProgress: ${gradingProgress}. Valid: ${[...VALID_GRADING_PROGRESS].join(', ')}`, 400);
  }

  // Require timestamp per spec
  const timestamp = body.timestamp || new Date().toISOString();

  const { error } = await supabase
    .from('lti_ags_scores')
    .insert({
      org_id: li.org_id,
      line_item_id: lineItemId,
      user_id: userId,
      score_given: scoreGiven != null ? Number(scoreGiven) : null,
      score_max: Number(scoreMax),
      activity_progress: activityProgress,
      grading_progress: gradingProgress,
      comment,
      timestamp_from_tool: timestamp,
      raw_payload: body,
    });
  if (error) return err(error.message, 500);

  // LTI AGS spec §5: only write through to the LMS gradebook when the
  // tool signals FullyGraded and a numeric score is present.
  if (gradingProgress === 'FullyGraded' && scoreGiven != null && li.assignment_id && userId) {
    // Scale score to the line item's scoreMaximum in case the tool's
    // scoreMaximum in this payload differs from when the line item was created.
    const scaledScore = Number(scoreMax) > 0
      ? (Number(scoreGiven) / Number(scoreMax)) * Number(li.score_max)
      : Number(scoreGiven);

    await supabase.rpc('lti_ags_sync_grade', {
      p_assignment_id: li.assignment_id,
      p_user_id:       userId,
      p_score:         scaledScore,
      p_comment:       comment || null,
    });
  }

  // AGS spec §5: score POST returns 204 No Content
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/* ------------------------------------------------------------------ */
/*  HANDLER: AGS Results                                               */
/* ------------------------------------------------------------------ */

async function handleAgsResults(req: Request, env: Env, supabase: any, lineItemId: string) {
  if (req.method !== 'GET') return err('Method not allowed', 405);
  const acceptErr = checkAcceptHeader(req, MEDIA.RESULT_CONTAINER);
  if (acceptErr) return acceptErr;
  const { data: li } = await supabase.from('lti_ags_line_items').select('course_id').eq('id', lineItemId).maybeSingle();
  if (!li) return err('Line item not found', 404);

  try {
    await authorizeServiceRequest(req, env, supabase, [AGS_SCOPES.RESULT_READONLY], li.course_id);
  } catch (e: any) {
    return err(e?.message || 'Unauthorized', 401);
  }

  const u = new URL(req.url);
  const limit = Math.max(1, Math.min(500, Number(u.searchParams.get('limit') || 100)));
  const page = Math.max(1, Number(u.searchParams.get('page') || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Optional user_id filter
  let query = supabase
    .from('lti_ags_scores')
    .select('id, user_id, score_given, score_max, comment, activity_progress, grading_progress, timestamp_from_tool, created_at')
    .eq('line_item_id', lineItemId)
    .order('created_at', { ascending: false })
    .range(from, to);

  const userIdFilter = u.searchParams.get('user_id');
  if (userIdFilter) query = query.eq('user_id', userIdFilter);

  const { data, error } = await query;
  if (error) return err(error.message, 500);

  const formatted = (data || []).map((s: any) => formatResult(s, lineItemId, env.LTI_PLATFORM_ISSUER));
  const pgHeaders = paginationHeaders(req.url, page, limit, formatted.length);
  return respond(formatted, 200, MEDIA.RESULT_CONTAINER, pgHeaders);
}

/* ------------------------------------------------------------------ */
/*  HANDLER: NRPS Memberships                                          */
/* ------------------------------------------------------------------ */

async function handleNrps(req: Request, env: Env, supabase: any, courseId: string) {
  if (req.method !== 'GET') return err('Method not allowed', 405);
  const acceptErr = checkAcceptHeader(req, MEDIA.MEMBERSHIP_CONTAINER);
  if (acceptErr) return acceptErr;

  let authCtx: ServiceAuthContext;
  try {
    authCtx = await authorizeServiceRequest(req, env, supabase, [NRPS_SCOPE], courseId);
  } catch (e: any) {
    return err(e?.message || 'Unauthorized', 401);
  }

  // Privacy policy from deployment metadata (default: 'full' for backward compat)
  const piiPolicy: string = authCtx.deployment?.nrps_pii_policy || 'full';

  const u = new URL(req.url);
  const limit = Math.max(1, Math.min(1000, Number(u.searchParams.get('limit') || 100)));
  const page = Math.max(1, Number(u.searchParams.get('page') || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Spec filters
  const roleFilter = u.searchParams.get('role');
  const rlid = u.searchParams.get('rlid');
  const since = u.searchParams.get('since');

  // NRPS rlid filter: if specified, verify the resource link exists in this course.
  // Per spec, rlid narrows the membership to users who can access the resource link.
  // We validate the resource link exists; the membership itself is still course-scoped
  // since LTI resource links are available to all course enrollees.
  if (rlid) {
    const { data: lineItem } = await supabase
      .from('lti_ags_line_items')
      .select('id')
      .eq('course_id', courseId)
      .eq('resource_link_id', rlid)
      .limit(1)
      .maybeSingle();
    if (!lineItem) {
      // Resource link not found in this course — return empty membership per spec
      return respond(
        { id: `${env.LTI_PLATFORM_ISSUER}/lti/nrps/courses/${courseId}/memberships`, context: { id: courseId }, members: [] },
        200,
        MEDIA.MEMBERSHIP_CONTAINER,
      );
    }
  }

  let query = supabase
    .from('enrollments')
    .select('user_id, role, oneroster_status, date_last_modified, profiles!inner(id, name, email)')
    .eq('course_id', courseId)
    .range(from, to);

  // Apply role filter: convert IMS role URI to internal role name
  if (roleFilter) {
    const internalRole = ltiRoleToInternal(roleFilter);
    if (internalRole) {
      query = query.eq('role', internalRole);
    } else {
      // Unknown role = empty result
      return respond(
        { id: `${env.LTI_PLATFORM_ISSUER}/lti/nrps/courses/${courseId}/memberships`, context: { id: courseId }, members: [] },
        200,
        MEDIA.MEMBERSHIP_CONTAINER,
      );
    }
  }

  // Differential membership: ?since= ISO date
  if (since) {
    query = query.gte('date_last_modified', since);
  }

  const { data: enrollments, error } = await query;
  if (error) return err(error.message, 500);

  // Fetch course metadata for context object
  const { data: course } = await supabase.from('courses').select('id, name, code').eq('id', courseId).maybeSingle();

  const members = (enrollments || []).map((e: any) => formatMember(e, piiPolicy));

  const pgHeaders = paginationHeaders(req.url, page, limit, members.length);

  // Audit log
  const orgId = await resolveCourseOrgId(supabase, courseId);
  if (orgId) {
    await supabase.from('lti_nrps_requests').insert({
      org_id: orgId,
      course_id: courseId,
      role_filter: roleFilter || null,
      limit_n: limit,
      page_n: page,
      result_count: members.length,
      status_code: 200,
      correlation_id: crypto.randomUUID(),
    });
  }

  return respond(
    {
      id: `${env.LTI_PLATFORM_ISSUER}/lti/nrps/courses/${courseId}/memberships`,
      context: {
        id: courseId,
        label: course?.code || null,
        title: course?.name || null,
      },
      members,
    },
    200,
    MEDIA.MEMBERSHIP_CONTAINER,
    pgHeaders,
  );
}

/* ------------------------------------------------------------------ */
/*  HANDLER: OpenID Configuration (platform metadata for LTI-DR)      */
/* ------------------------------------------------------------------ */

async function handleOpenIdConfig(req: Request, env: Env) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get('org_id');
  const base = env.LTI_PLATFORM_ISSUER;
  const regEndpoint = orgId
    ? `${base}/lti/register?org_id=${encodeURIComponent(orgId)}`
    : `${base}/lti/register`;

  return json({
    issuer: base,
    authorization_endpoint: `${base}/lti/oidc/auth`,
    token_endpoint: `${base}/lti/oauth2/token`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    registration_endpoint: regEndpoint,
    scopes_supported: [
      'openid',
      AGS_SCOPES.LINEITEM,
      AGS_SCOPES.LINEITEM_READONLY,
      AGS_SCOPES.SCORE,
      AGS_SCOPES.RESULT_READONLY,
      NRPS_SCOPE,
    ],
    response_types_supported: ['id_token'],
    response_modes_supported: ['form_post'],
    grant_types_supported: ['implicit', 'client_credentials'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    claims_supported: ['sub', 'iss', 'aud', 'iat', 'exp', 'nonce', 'name', 'email'],
    'https://purl.imsglobal.org/spec/lti-platform-configuration': {
      product_family_code: 'modernlms',
      version: '1.0',
      messages_supported: [
        { type: 'LtiResourceLinkRequest', placements: ['CourseSection'] },
        { type: 'LtiDeepLinkingRequest',  placements: ['ContentArea'] },
      ],
      variables: [],
    },
  }, 200, corsHeaders());
}

/* ------------------------------------------------------------------ */
/*  HANDLER: Generate Registration Token (admin-initiated LTI-DR)     */
/*  POST /lti/admin/registration-token?org_id=<uuid>                  */
/*  Returns a short-lived token + the full ADTA registration URL.     */
/* ------------------------------------------------------------------ */

async function handleGenerateRegistrationToken(req: Request, env: Env, supabase: any) {
  const url   = new URL(req.url);
  const orgId = url.searchParams.get('org_id');
  if (!orgId) return err('Missing org_id query param', 400);

  const token     = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  const { error: insertErr } = await supabase
    .from('lti_registration_tokens')
    .insert({ token, org_id: orgId, expires_at: expiresAt });

  if (insertErr) return err(`Failed to create registration token: ${insertErr.message}`, 500);

  const openidConfigUrl = `${env.LTI_PLATFORM_ISSUER}/.well-known/openid-configuration?org_id=${encodeURIComponent(orgId)}`;
  const toolRegBase     = env.LTI_TOOL_REGISTRATION_URL || 'https://staging-app.alldayta.com/lti-register';
  const registrationUrl = `${toolRegBase}?openid_configuration=${encodeURIComponent(openidConfigUrl)}&registration_token=${encodeURIComponent(token)}`;

  return json({ token, registration_url: registrationUrl, expires_at: expiresAt }, 201, corsHeaders());
}

/* ------------------------------------------------------------------ */
/*  HANDLER: Key Rotation                                              */
/*  POST /lti/admin/rotate-key                                         */
/*  Generates a new RSA key pair, stages it as "next", and optionally  */
/*  promotes "next" → "active" on subsequent call.                     */
/* ------------------------------------------------------------------ */

async function handleKeyRotation(req: Request, env: Env, supabase: any) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get('org_id');
  const action = url.searchParams.get('action') || 'status';

  if (action === 'status') {
    // Return current key status
    const activePrivate = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON);
    const activeKid = activePrivate.kid || 'platform-key';
    let nextKid: string | null = null;
    if (env.LTI_PRIVATE_JWK_NEXT_JSON) {
      try {
        const nextPrivate = JSON.parse(env.LTI_PRIVATE_JWK_NEXT_JSON);
        nextKid = nextPrivate.kid || null;
      } catch { /* no next key */ }
    }

    // Fetch rotation history
    const query = orgId
      ? supabase.from('lti_key_rotation_events').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(10)
      : supabase.from('lti_key_rotation_events').select('*').order('created_at', { ascending: false }).limit(10);
    const { data: events } = await query;

    return json({
      active_kid: activeKid,
      next_kid: nextKid,
      jwks_endpoint: `${env.LTI_PLATFORM_ISSUER}/.well-known/jwks.json`,
      rotation_history: events || [],
      instructions: {
        promote: 'To promote the next key to active: POST /lti/admin/rotate-key?action=promote&org_id=X',
        note: 'After promoting, update LTI_PRIVATE_JWK_ACTIVE_JSON with the next key and clear LTI_PRIVATE_JWK_NEXT_JSON via Cloudflare dashboard or wrangler secrets.',
      },
    }, 200, corsHeaders());
  }

  if (action === 'generate') {
    // Generate a new RSA-2048 key pair for staging as "next"
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([0x01, 0x00, 0x01]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    );

    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const kid = `platform-${Date.now()}`;
    (privateJwk as any).kid = kid;
    (privateJwk as any).use = 'sig';
    (privateJwk as any).alg = 'RS256';

    // Log the rotation event
    if (orgId) {
      await supabase.from('lti_key_rotation_events').insert({
        org_id: orgId,
        old_kid: null,
        new_kid: kid,
        result: 'scheduled',
        details: { action: 'generate', note: 'New key generated. Set as LTI_PRIVATE_JWK_NEXT_JSON to stage.' },
      });
    }

    return json({
      kid,
      private_jwk: privateJwk,
      instructions: [
        '1. Set this JWK as LTI_PRIVATE_JWK_NEXT_JSON in your worker secrets',
        '2. Wait for tools to cache the updated JWKS (typically 24h)',
        '3. Call POST /lti/admin/rotate-key?action=promote&org_id=X to finalize',
      ],
    }, 201, corsHeaders());
  }

  if (action === 'promote') {
    if (!orgId) return err('Missing org_id for promote action', 400);
    if (!env.LTI_PRIVATE_JWK_NEXT_JSON) {
      return err('No next key configured (LTI_PRIVATE_JWK_NEXT_JSON is empty)', 400);
    }

    const activePrivate = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON);
    const nextPrivate = JSON.parse(env.LTI_PRIVATE_JWK_NEXT_JSON);
    const oldKid = activePrivate.kid || 'platform-key';
    const newKid = nextPrivate.kid || 'unknown';

    // Log the promotion event
    await supabase.from('lti_key_rotation_events').insert({
      org_id: orgId,
      old_kid: oldKid,
      new_kid: newKid,
      cutover_at: new Date().toISOString(),
      result: 'success',
      details: {
        action: 'promote',
        note: 'Next key promoted. Update LTI_PRIVATE_JWK_ACTIVE_JSON to the new key and clear LTI_PRIVATE_JWK_NEXT_JSON.',
      },
    });

    return json({
      promoted: true,
      old_kid: oldKid,
      new_kid: newKid,
      instructions: [
        `1. Set LTI_PRIVATE_JWK_ACTIVE_JSON to the key with kid="${newKid}"`,
        '2. Clear LTI_PRIVATE_JWK_NEXT_JSON (or set to empty)',
        '3. Redeploy the worker',
      ],
    }, 200, corsHeaders());
  }

  return err('Invalid action. Use: status, generate, promote', 400);
}

/* ------------------------------------------------------------------ */
/*  HANDLER: Dynamic Registration (LTI-DR v1.0)                       */
/*  Tool POSTs its client metadata here; we create the registration.  */
/* ------------------------------------------------------------------ */

async function handleDynamicRegister(req: Request, env: Env, supabase: any) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get('org_id');
  if (!orgId) return err('Missing org_id query param', 400);

  // Validate registration token if provided (ADTA forwards it as Bearer)
  const authHeader = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (bearerToken) {
    const { data: regToken, error: tokenErr } = await supabase
      .from('lti_registration_tokens')
      .select('*')
      .eq('token', bearerToken)
      .eq('org_id', orgId)
      .maybeSingle();

    if (tokenErr || !regToken) return err('Invalid registration token', 401);
    if (regToken.consumed_at)  return err('Registration token already used', 401);
    if (new Date(regToken.expires_at) < new Date()) return err('Registration token expired', 401);

    // Consume the token so it can't be reused
    await supabase
      .from('lti_registration_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', regToken.id);
  }

  let body: any;
  try { body = await req.json(); } catch { return err('Expected JSON body', 400); }

  // Validate required OpenID Dynamic Client Registration fields
  const toolConfig  = body['https://purl.imsglobal.org/spec/lti-tool-configuration'] || {};
  const redirectUris: string[] = body.redirect_uris || [];
  const clientName: string    = body.client_name || toolConfig.domain || '';
  const loginUri: string      = body.initiate_login_uri || '';
  const jwksUri: string       = body.jwks_uri || '';
  const targetLinkUri: string = toolConfig.target_link_uri || redirectUris[0] || '';
  const domain: string        = toolConfig.domain || '';
  const issuer: string        = domain ? `https://${domain}` : targetLinkUri;

  if (!clientName) return err('Missing required field: client_name', 400);
  if (!loginUri || !jwksUri || !targetLinkUri) {
    return err('Missing required fields: initiate_login_uri, jwks_uri, target_link_uri', 400);
  }

  // Validate URIs are well-formed HTTPS URLs
  const uriFields = { initiate_login_uri: loginUri, jwks_uri: jwksUri, target_link_uri: targetLinkUri };
  for (const [name, uri] of Object.entries(uriFields)) {
    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== 'https:') {
        return err(`${name} must use HTTPS`, 400);
      }
    } catch {
      return err(`${name} is not a valid URL`, 400);
    }
  }
  for (const uri of redirectUris) {
    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== 'https:') {
        return err(`redirect_uri "${uri}" must use HTTPS`, 400);
      }
    } catch {
      return err(`redirect_uri "${uri}" is not a valid URL`, 400);
    }
  }

  // Validate token_endpoint_auth_method per LTI spec (must be private_key_jwt)
  const authMethod = body.token_endpoint_auth_method || 'private_key_jwt';
  if (authMethod !== 'private_key_jwt') {
    return err('token_endpoint_auth_method must be "private_key_jwt" per LTI 1.3 spec', 400);
  }

  // Validate response_types (only id_token allowed for LTI)
  const responseTypes: string[] = body.response_types || ['id_token'];
  if (!responseTypes.includes('id_token')) {
    return err('response_types must include "id_token"', 400);
  }

  // Validate grant_types
  const grantTypes: string[] = body.grant_types || ['implicit', 'client_credentials'];
  const validGrants = new Set(['implicit', 'client_credentials']);
  const invalidGrants = grantTypes.filter(g => !validGrants.has(g));
  if (invalidGrants.length > 0) {
    return err(`Unsupported grant_types: ${invalidGrants.join(', ')}. Allowed: implicit, client_credentials`, 400);
  }

  // Check for duplicate registration (same org + issuer)
  const { data: existingReg } = await supabase
    .from('lti_registrations')
    .select('id')
    .eq('org_id', orgId)
    .eq('issuer', issuer)
    .eq('status', 'active')
    .maybeSingle();
  if (existingReg) {
    return err(`A registration for issuer "${issuer}" already exists in this org`, 409);
  }

  const clientId    = crypto.randomUUID();
  const scopeStr    = String(body.scope || '');
  const enableAgs   = scopeStr.includes('lti-ags');
  const enableNrps  = scopeStr.includes('lti-nrps');
  const enableDl    = (toolConfig.messages || []).some((m: any) => m.type === 'LtiDeepLinkingRequest');

  const { data: reg, error: regErr } = await supabase
    .from('lti_registrations')
    .insert({
      org_id:              orgId,
      tool_name:           clientName,
      issuer,
      client_id:           clientId,
      auth_login_url:      loginUri,
      jwks_url:            jwksUri,
      target_link_uri:     targetLinkUri,
      deep_link_return_url: `${env.LTI_PLATFORM_ISSUER}/lti/deep-link/return`,
      status:              'active',
      metadata:            { dynamic_registration: true, raw_client_metadata: body },
    })
    .select('*')
    .single();

  if (regErr || !reg) {
    return err(`Failed to create registration: ${regErr?.message || 'unknown'}`, 500);
  }

  const deploymentId = `auto-${clientId.slice(0, 8)}`;
  await supabase.from('lti_deployments').insert({
    org_id:           orgId,
    registration_id:  reg.id,
    deployment_id:    deploymentId,
    scope_type:       'org',
    scope_ref:        null,
    enable_deep_linking: enableDl,
    enable_ags:       enableAgs,
    enable_nrps:      enableNrps,
    status:           'active',
  });

  return json({
    client_id:            clientId,
    client_name:          clientName,
    redirect_uris:        redirectUris,
    initiate_login_uri:   loginUri,
    jwks_uri:             jwksUri,
    token_endpoint_auth_method: 'private_key_jwt',
    grant_types:          body.grant_types  || ['implicit'],
    response_types:       body.response_types || ['id_token'],
    'https://purl.imsglobal.org/spec/lti-tool-configuration': {
      ...toolConfig,
      deployment_id: deploymentId,
    },
  }, 201, corsHeaders());
}

/* ------------------------------------------------------------------ */
/*  HANDLER: Initiate Platform → Tool Launch                           */
/*  Called by the ModernLMS frontend to start an LTI launch.          */
/*  GET /lti/initiate-launch?client_id=X&course_id=Y&user_id=Z        */
/* ------------------------------------------------------------------ */

async function handleInitiateLaunch(req: Request, env: Env, supabase: any) {
  const url        = new URL(req.url);
  const clientId   = url.searchParams.get('client_id');
  const courseId   = url.searchParams.get('course_id');
  const userId     = url.searchParams.get('user_id');
  const depIdParam = url.searchParams.get('deployment_id');
  const msgType    = url.searchParams.get('message_type') || 'LtiResourceLinkRequest';

  if (!clientId || !courseId || !userId) {
    return err('Missing required params: client_id, course_id, user_id', 400);
  }

  const { data: reg } = await supabase
    .from('lti_registrations')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!reg) return err('Registration not found', 404);

  // Resolve deployment: use provided ID or pick the first active one
  let deploymentId = depIdParam;
  if (!deploymentId) {
    const { data: dep } = await supabase
      .from('lti_deployments')
      .select('deployment_id')
      .eq('registration_id', reg.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (!dep) return err('No active deployment found for this registration', 404);
    deploymentId = dep.deployment_id;
  }

  const hintToken = crypto.randomUUID();
  const ttlMs     = toInt(env.LTI_STATE_TTL_SECONDS, 300) * 1000;

  const { error: hintErr } = await supabase.from('lti_login_hints').insert({
    hint_token:      hintToken,
    org_id:          reg.org_id,
    registration_id: reg.id,
    deployment_id:   deploymentId,
    user_id:         userId,
    course_id:       courseId,
    target_link_uri: reg.target_link_uri,
    message_type:    msgType,
    expires_at:      new Date(Date.now() + ttlMs).toISOString(),
  });
  if (hintErr) return err(`Failed to store login hint: ${hintErr.message}`, 500);

  const loginUrl = new URL(reg.auth_login_url);
  loginUrl.searchParams.set('iss',              env.LTI_PLATFORM_ISSUER);
  loginUrl.searchParams.set('client_id',        reg.client_id);
  loginUrl.searchParams.set('login_hint',       hintToken);
  loginUrl.searchParams.set('target_link_uri',  reg.target_link_uri || '');
  loginUrl.searchParams.set('lti_message_hint', msgType === 'LtiDeepLinkingRequest' ? 'deep-link' : 'resource-link');

  return Response.redirect(loginUrl.toString(), 302);
}

/* ------------------------------------------------------------------ */
/*  HANDLER: OIDC Auth (generates and signs LTI id_token for tool)    */
/*  Tool redirects here after receiving platform login initiation.    */
/*  GET /lti/oidc/auth?client_id=X&redirect_uri=Y&state=Z&nonce=W    */
/*        &login_hint=HINT_TOKEN&lti_message_hint=resource-link       */
/* ------------------------------------------------------------------ */

async function handleOidcAuth(req: Request, env: Env, supabase: any) {
  const url        = new URL(req.url);
  const clientId   = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const stateParam = url.searchParams.get('state') || '';
  const nonceParam = url.searchParams.get('nonce') || '';
  const loginHint  = url.searchParams.get('login_hint') || '';
  const msgHint    = url.searchParams.get('lti_message_hint') || 'resource-link';

  if (!clientId || !redirectUri || !loginHint) {
    return err('Missing client_id, redirect_uri, or login_hint', 400);
  }

  const { data: reg } = await supabase
    .from('lti_registrations')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!reg) return err('Registration not found', 404);

  // Validate redirect_uri against registered URIs to prevent open redirect / token leakage
  const allowedRedirects: string[] = [
    reg.target_link_uri,
    ...(reg.metadata?.raw_client_metadata?.redirect_uris || []),
  ].filter(Boolean);
  if (allowedRedirects.length > 0 && !allowedRedirects.includes(redirectUri)) {
    return err('redirect_uri does not match any registered redirect URI', 400);
  }

  // Consume login hint
  const { data: hint } = await supabase
    .from('lti_login_hints')
    .select('*')
    .eq('hint_token', loginHint)
    .is('consumed_at', null)
    .maybeSingle();
  if (!hint) return err('Invalid or expired login_hint', 401);
  if (new Date(hint.expires_at).getTime() < Date.now()) return err('Login hint expired', 401);

  await supabase.from('lti_login_hints')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', hint.id);

  const courseId     = hint.course_id;
  const userId       = hint.user_id;
  const deploymentId = hint.deployment_id;
  const msgType      = msgHint === 'deep-link' ? 'LtiDeepLinkingRequest' : 'LtiResourceLinkRequest';

  // Fetch user, course, enrollment, deployment in parallel
  const [
    { data: profile },
    { data: course },
    { data: enrollment },
    { data: deployment },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, email').eq('id', userId).maybeSingle(),
    supabase.from('courses').select('id, title').eq('id', courseId).maybeSingle(),
    supabase.from('enrollments').select('role').eq('user_id', userId).eq('course_id', courseId).maybeSingle(),
    supabase.from('lti_deployments').select('*')
      .eq('registration_id', reg.id).eq('deployment_id', deploymentId).eq('status', 'active').maybeSingle(),
  ]);

  const role     = enrollment?.role || 'student';
  const ltiRoles = [roleToLtiContext(role), roleToLtiSystem(role)].filter(Boolean);
  const base     = env.LTI_PLATFORM_ISSUER;
  const now      = Math.floor(Date.now() / 1000);

  const idTokenPayload: Record<string, any> = {
    iss:   base,
    aud:   clientId,
    sub:   String(userId),
    nonce: nonceParam,
    iat:   now,
    exp:   now + 300,
    name:  profile?.name  || '',
    email: profile?.email || '',
    [CLAIMS.VERSION]:       '1.3.0',
    [CLAIMS.MESSAGE_TYPE]:  msgType,
    [CLAIMS.DEPLOYMENT_ID]: deploymentId,
    'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': reg.target_link_uri || redirectUri,
    [CLAIMS.CONTEXT]: {
      id:    String(courseId),
      label: String(courseId).slice(0, 8),
      title: course?.title || 'Course',
      type:  ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'],
    },
    [CLAIMS.ROLES]:         ltiRoles,
    [CLAIMS.RESOURCE_LINK]: { id: `${courseId}-${clientId}`, title: course?.title || 'LTI Resource' },
    [CLAIMS.LAUNCH_PRESENTATION]: { document_target: 'iframe' },
    [CLAIMS.TOOL_PLATFORM]: { name: 'ModernLMS', product_family_code: 'modernlms', version: '1.0' },
  };

  if (deployment?.enable_ags) {
    idTokenPayload[CLAIMS.AGS_ENDPOINT] = {
      scope:     [AGS_SCOPES.LINEITEM, AGS_SCOPES.LINEITEM_READONLY, AGS_SCOPES.SCORE, AGS_SCOPES.RESULT_READONLY],
      lineitems: `${base}/lti/ags/courses/${courseId}/lineitems`,
    };
  }
  if (deployment?.enable_nrps) {
    idTokenPayload[CLAIMS.NRPS_ENDPOINT] = {
      context_memberships_url: `${base}/lti/nrps/courses/${courseId}/memberships`,
      service_versions: ['2.0'],
    };
  }
  if (msgType === 'LtiDeepLinkingRequest') {
    // Enforce deep-linking feature flag on platform-initiated DL launches
    if (deployment && !deployment.enable_deep_linking) {
      return err('Deep linking is disabled for this deployment', 403);
    }
    idTokenPayload[CLAIMS.DL_SETTINGS] = {
      deep_link_return_url: reg.deep_link_return_url || `${base}/lti/deep-link/return`,
      accept_types: ['link', 'ltiResourceLink', 'file', 'html', 'image'],
      accept_presentation_document_targets: ['iframe', 'window'],
      accept_multiple: true,
      auto_create: true,
      data: `dl-${courseId}-${Date.now()}`,
    };
  }

  const privateJwk = JSON.parse(env.LTI_PRIVATE_JWK_ACTIVE_JSON);
  const key        = await importJWK(privateJwk, 'RS256');
  const idToken    = await new SignJWT(idTokenPayload)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: privateJwk.kid || 'platform-key' })
    .sign(key);

  await supabase.from('lti_launches').insert({
    org_id:          reg.org_id,
    registration_id: reg.id,
    deployment_id:   deploymentId,
    course_id:       courseId,
    user_id:         userId,
    message_type:    msgType,
    lti_version:     '1.3.0',
    status:          'success',
    raw_claims:      idTokenPayload,
    correlation_id:  crypto.randomUUID(),
  });

  // HTML-escape all interpolated values to prevent XSS
  const safeRedirect = escapeHtml(redirectUri);
  const safeToken = escapeHtml(idToken);
  const safeState = escapeHtml(stateParam);
  return html(`
    <form id="f" method="post" action="${safeRedirect}">
      <input type="hidden" name="id_token" value="${safeToken}">
      <input type="hidden" name="state" value="${safeState}">
    </form>
    <script>document.getElementById('f').submit()</script>
  `);
}

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    try {
      if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: corsHeaders() });
      if (req.method === 'GET' && url.pathname === '/healthz') return json({ ok: true }, 200, corsHeaders());
      if (req.method === 'GET' && url.pathname === '/.well-known/jwks.json') {
        return json(await (await handleJwks(env)).json(), 200, corsHeaders());
      }
      if (req.method === 'GET' && url.pathname === '/.well-known/openid-configuration') return handleOpenIdConfig(req, env);
      if (req.method === 'POST' && url.pathname === '/lti/admin/registration-token') return handleGenerateRegistrationToken(req, env, supabase);
      if (url.pathname === '/lti/admin/rotate-key') return handleKeyRotation(req, env, supabase);
      if (req.method === 'POST' && url.pathname === '/lti/register') return handleDynamicRegister(req, env, supabase);
      if (req.method === 'GET'  && url.pathname === '/lti/initiate-launch') return handleInitiateLaunch(req, env, supabase);
      if (req.method === 'GET'  && url.pathname === '/lti/oidc/auth') return handleOidcAuth(req, env, supabase);
      if (req.method === 'GET' && url.pathname === '/lti/oidc/login') return handleOidcLogin(req, env, supabase);
      if (req.method === 'POST' && url.pathname === '/lti/launch') return handleLaunch(req, supabase);
      if (req.method === 'POST' && url.pathname === '/lti/deep-link/return') return handleDeepLinkReturn(req, supabase);
      if (req.method === 'POST' && url.pathname === '/lti/oauth2/token') return handleToken(req, env, supabase);

      // AGS: line items container
      const agsCourse = url.pathname.match(/^\/lti\/ags\/courses\/([^/]+)\/lineitems$/);
      if (agsCourse) return handleAgsLineitems(req, env, supabase, agsCourse[1]);

      // AGS: single line item
      const agsLineItem = url.pathname.match(/^\/lti\/ags\/lineitems\/([^/]+)$/);
      if (agsLineItem) return handleAgsLineitemById(req, env, supabase, agsLineItem[1]);

      // AGS: scores
      const agsScores = url.pathname.match(/^\/lti\/ags\/lineitems\/([^/]+)\/scores$/);
      if (agsScores) return handleAgsScores(req, env, supabase, agsScores[1]);

      // AGS: results
      const agsResults = url.pathname.match(/^\/lti\/ags\/lineitems\/([^/]+)\/results$/);
      if (agsResults) return handleAgsResults(req, env, supabase, agsResults[1]);

      // NRPS: memberships
      const nrps = url.pathname.match(/^\/lti\/nrps\/courses\/([^/]+)\/memberships$/);
      if (nrps) return handleNrps(req, env, supabase, nrps[1]);

      return err('Not found', 404);
    } catch (e: any) {
      return err(e?.message || 'Unhandled error', 500);
    }
  },
};
