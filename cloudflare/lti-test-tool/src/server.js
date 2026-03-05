import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { SignJWT, importJWK } from 'jose';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const PORT = Number(process.env.PORT || 8788);
const TOOL_ISSUER = process.env.TOOL_ISSUER;
const TOOL_CLIENT_ID = process.env.TOOL_CLIENT_ID;
const TOOL_DEPLOYMENT_ID = process.env.TOOL_DEPLOYMENT_ID;
const TOOL_PRIVATE_JWK_JSON = process.env.TOOL_PRIVATE_JWK_JSON;
const TOOL_ORG_ID = process.env.TOOL_ORG_ID;
const TOOL_COURSE_ID = process.env.TOOL_COURSE_ID;
const TOOL_USER_ID = process.env.TOOL_USER_ID;

const PLATFORM_LOGIN_URL = process.env.PLATFORM_LOGIN_URL;
const PLATFORM_LAUNCH_URL = process.env.PLATFORM_LAUNCH_URL;
const PLATFORM_AGS_BASE = process.env.PLATFORM_AGS_BASE;
const PLATFORM_NRPS_BASE = process.env.PLATFORM_NRPS_BASE;

if (!TOOL_ISSUER || !TOOL_CLIENT_ID || !TOOL_DEPLOYMENT_ID || !TOOL_PRIVATE_JWK_JSON || !PLATFORM_LOGIN_URL || !PLATFORM_LAUNCH_URL || !PLATFORM_AGS_BASE || !PLATFORM_NRPS_BASE || !TOOL_ORG_ID || !TOOL_COURSE_ID || !TOOL_USER_ID) {
  console.error('Missing required env vars; copy .env.example to .env and fill values');
  process.exit(1);
}

const toolPrivateJwk = JSON.parse(TOOL_PRIVATE_JWK_JSON);

/* ------------------------------------------------------------------ */
/*  Vendor media types (must match platform)                           */
/* ------------------------------------------------------------------ */

const MEDIA = {
  LINEITEM:             'application/vnd.ims.lis.v2.lineitem+json',
  LINEITEM_CONTAINER:   'application/vnd.ims.lis.v2.lineitemcontainer+json',
  SCORE:                'application/vnd.ims.lis.v1.score+json',
  RESULT_CONTAINER:     'application/vnd.ims.lis.v2.resultcontainer+json',
  MEMBERSHIP_CONTAINER: 'application/vnd.ims.lis.v2.membershipcontainer+json',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toPublicJwk(privateJwk) {
  const { d, p, q, dp, dq, qi, oth, ...pub } = privateJwk;
  return {
    ...pub,
    use: 'sig',
    alg: pub.alg || 'RS256',
    kid: pub.kid || 'tool-key-1',
  };
}

function randomText() {
  return crypto.randomUUID();
}

// Stores the deepLinkData from the most recent DL launch so /emit-deep-links can echo it back
let pendingDlData = null;

/* ------------------------------------------------------------------ */
/*  JWT signing                                                        */
/* ------------------------------------------------------------------ */

async function signIdToken({
  nonce,
  targetLinkUri,
  messageType = 'LtiResourceLinkRequest',
  deepLinkReturnUrl = null,
  deepLinkData = null,
  userSub = TOOL_USER_ID,
  courseId = TOOL_COURSE_ID,
}) {
  const key = await importJWK(toolPrivateJwk, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: TOOL_ISSUER,
    aud: TOOL_CLIENT_ID,
    sub: userSub,
    nonce,
    iat: now,
    exp: now + 300,
    given_name: 'Demo',
    family_name: 'User',
    name: 'Demo User',
    email: 'demo@example.edu',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/message_type': messageType,
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': TOOL_DEPLOYMENT_ID,
    'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': targetLinkUri,
    'https://purl.imsglobal.org/spec/lti/claim/context': {
      id: courseId,
      label: 'DEMO101',
      title: 'Demo Course',
      type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'],
    },
    'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
      id: 'resource-link-1',
      title: 'Demo LTI Resource',
      description: 'A test resource link for LTI verification',
    },
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
      'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Learner',
    ],
    'https://purl.imsglobal.org/spec/lti/claim/custom': {
      test_custom_param: 'hello_from_tool',
    },
    'https://purl.imsglobal.org/spec/lti/claim/lis': {
      person_sourcedid: 'demo-user-sis-001',
      course_section_sourcedid: 'demo-course-section-001',
    },
    'https://purl.imsglobal.org/spec/lti/claim/tool_platform': {
      name: 'ModernLMS Test Tool',
      product_family_code: 'modernlms-test',
      version: '1.0',
    },
    'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
      lineitems: `${PLATFORM_AGS_BASE}/lti/ags/courses/${courseId}/lineitems`,
      lineitem: null,
      scope: [
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
        'https://purl.imsglobal.org/spec/lti-ags/scope/score',
        'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      ],
    },
    'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice': {
      context_memberships_url: `${PLATFORM_NRPS_BASE}/lti/nrps/courses/${courseId}/memberships`,
      service_versions: ['2.0'],
    },
  };

  if (messageType === 'LtiDeepLinkingRequest') {
    const dlSettings = {
      deep_link_return_url: deepLinkReturnUrl,
      accept_types: ['link', 'ltiResourceLink', 'file'],
      accept_presentation_document_targets: ['iframe', 'window'],
      accept_multiple: true,
      auto_create: true,
    };
    // Include data field for echo verification
    if (deepLinkData) dlSettings.data = deepLinkData;
    payload['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'] = dlSettings;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: toolPrivateJwk.kid || 'tool-key-1' })
    .setIssuer(TOOL_ISSUER)
    .setAudience(TOOL_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

/* ------------------------------------------------------------------ */
/*  OAuth2 service access token (with jti for replay prevention)       */
/* ------------------------------------------------------------------ */

async function getServiceAccessToken(courseId = TOOL_COURSE_ID) {
  const key = await importJWK(toolPrivateJwk, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const tokenEndpoint = `${PLATFORM_AGS_BASE}/lti/oauth2/token`;

  // Include jti (JWT ID) for replay prevention per spec
  const jti = crypto.randomUUID();

  const clientAssertion = await new SignJWT({ tool_iss: TOOL_ISSUER, jti })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: toolPrivateJwk.kid || 'tool-key-1' })
    .setIssuer(TOOL_CLIENT_ID)
    .setSubject(TOOL_CLIENT_ID)
    .setAudience(tokenEndpoint)
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);

  const scope = [
    'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
    'https://purl.imsglobal.org/spec/lti-ags/scope/score',
    'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
    'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
  ].join(' ');

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
    scope,
    deployment_id: TOOL_DEPLOYMENT_ID,
    course_id: courseId,
  });

  const resp = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const tokenBody = await resp.json();
  if (!resp.ok || !tokenBody.access_token) {
    throw new Error(`Token request failed: ${JSON.stringify(tokenBody)}`);
  }
  return tokenBody.access_token;
}

/* ------------------------------------------------------------------ */
/*  Routes: JWKS + Home                                                */
/* ------------------------------------------------------------------ */

app.get('/.well-known/jwks.json', (_req, res) => {
  res.json({ keys: [toPublicJwk(toolPrivateJwk)] });
});

app.get('/', (_req, res) => {
  res.send(`
    <h1>ModernLMS LTI 1.3 Test Tool</h1>
    <h3>Core Flows</h3>
    <ul>
      <li><a href="/start-resource-launch">Start resource launch</a></li>
      <li><a href="/start-deep-link-launch">Start deep-link launch</a></li>
      <li><a href="/tool-ui">Tool UI (manual tests)</a></li>
      <li><a href="/.well-known/jwks.json">JWKS</a></li>
    </ul>
    <h3>Spec Compliance Tests</h3>
    <ul>
      <li><a href="/test-all">Run ALL spec compliance tests</a></li>
    </ul>
  `);
});

/* ------------------------------------------------------------------ */
/*  Routes: OIDC Launch flows                                          */
/* ------------------------------------------------------------------ */

// Auth dispatch: platform redirects here after OIDC init; route to correct handler
// based on lti_message_hint (forwarding all query params).
app.get('/auth-dispatch', (req, res) => {
  const hint = String(req.query.lti_message_hint || '');
  const targetPath = hint === 'deep-link' ? '/deep-link-launch' : '/launch';
  const redirect = new URL(`http://localhost:${PORT}${targetPath}`);
  for (const [k, v] of Object.entries(req.query)) {
    redirect.searchParams.set(k, String(v));
  }
  res.redirect(redirect.toString());
});

app.get('/start-resource-launch', (_req, res) => {
  const targetLinkUri = `${TOOL_ISSUER}/launch`;
  const login = new URL(PLATFORM_LOGIN_URL);
  login.searchParams.set('iss', TOOL_ISSUER);
  login.searchParams.set('client_id', TOOL_CLIENT_ID);
  login.searchParams.set('login_hint', 'demo-login-hint');
  login.searchParams.set('lti_message_hint', 'resource-launch');
  login.searchParams.set('target_link_uri', targetLinkUri);
  res.redirect(login.toString());
});

app.get('/start-deep-link-launch', (_req, res) => {
  const targetLinkUri = `${TOOL_ISSUER}/deep-link-launch`;
  const login = new URL(PLATFORM_LOGIN_URL);
  login.searchParams.set('iss', TOOL_ISSUER);
  login.searchParams.set('client_id', TOOL_CLIENT_ID);
  login.searchParams.set('login_hint', 'demo-login-hint');
  login.searchParams.set('lti_message_hint', 'deep-link');
  login.searchParams.set('target_link_uri', targetLinkUri);
  res.redirect(login.toString());
});

app.get('/launch', async (req, res) => {
  const state = String(req.query.state || randomText());
  const nonce = String(req.query.nonce || randomText());
  const idToken = await signIdToken({ nonce, targetLinkUri: `${TOOL_ISSUER}/launch` });
  res.send(`
    <form id="f" method="post" action="${PLATFORM_LAUNCH_URL}">
      <input type="hidden" name="id_token" value="${idToken}" />
      <input type="hidden" name="state" value="${state}" />
    </form>
    <script>document.getElementById('f').submit()</script>
  `);
});

app.get('/deep-link-launch', async (req, res) => {
  const state = String(req.query.state || randomText());
  const nonce = String(req.query.nonce || randomText());
  const deepLinkReturnUrl = `${PLATFORM_AGS_BASE}/lti/deep-link/return`;
  const deepLinkData = 'echo-test-' + Date.now(); // data for echo verification
  pendingDlData = deepLinkData; // store so /emit-deep-links can echo it back
  const idToken = await signIdToken({
    nonce,
    targetLinkUri: `${TOOL_ISSUER}/deep-link-launch`,
    messageType: 'LtiDeepLinkingRequest',
    deepLinkReturnUrl,
    deepLinkData,
  });
  res.send(`
    <form id="f" method="post" action="${PLATFORM_LAUNCH_URL}">
      <input type="hidden" name="id_token" value="${idToken}" />
      <input type="hidden" name="state" value="${state}" />
    </form>
    <script>document.getElementById('f').submit()</script>
  `);
});

/* ------------------------------------------------------------------ */
/*  Routes: Tool UI (manual test buttons)                              */
/* ------------------------------------------------------------------ */

app.get('/tool-ui', (_req, res) => {
  res.send(`
    <h2>LTI 1.3 Advantage Test Tool</h2>
    <p>Course: ${TOOL_COURSE_ID} | User: ${TOOL_USER_ID}</p>

    <h3>Deep Linking</h3>
    <form method="post" action="/emit-deep-links"><button>Emit deep links (with data echo)</button></form>
    <form method="post" action="/emit-file-item"><button>Emit file item deep-link</button></form>

    <h3>AGS (Assignment & Grade Services)</h3>
    <form method="post" action="/post-grade"><button>Post grade 8/10</button></form>
    <form method="post" action="/test-ags-filtering"><button>Test AGS line item filtering</button></form>
    <form method="post" action="/test-ags-results"><button>Test AGS results format</button></form>

    <h3>NRPS (Names & Roles)</h3>
    <form method="get" action="/roster"><button>Get roster (full)</button></form>
    <form method="get" action="/roster-role-filter"><button>Get roster (Instructor role only)</button></form>
    <form method="get" action="/roster-since"><button>Get roster (differential/since)</button></form>

    <h3>All-in-One</h3>
    <form method="get" action="/test-all"><button>Run ALL compliance tests</button></form>
  `);
});

/* ------------------------------------------------------------------ */
/*  Routes: Deep Linking                                               */
/* ------------------------------------------------------------------ */

app.post('/emit-deep-links', async (_req, res) => {
  const nonce = randomText();
  const key = await importJWK(toolPrivateJwk, 'RS256');
  const dlPayload = {
    iss: TOOL_ISSUER,
    aud: TOOL_CLIENT_ID,
    sub: TOOL_USER_ID,
    nonce,
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': TOOL_DEPLOYMENT_ID,
    'https://purl.imsglobal.org/spec/lti/claim/context': { id: TOOL_COURSE_ID },
    // Data echo: tool echoes back whatever the platform set in the original DL request
    'https://purl.imsglobal.org/spec/lti-dl/claim/data': pendingDlData || '',
    'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': [
      { type: 'link', title: 'External reading link', url: 'https://example.org/reading' },
      { type: 'ltiResourceLink', title: 'Practice quiz placeholder', url: `${TOOL_ISSUER}/tool-ui` },
    ],
  };
  const jwt = await new SignJWT(dlPayload)
    .setProtectedHeader({ alg: 'RS256', kid: toolPrivateJwk.kid || 'tool-key-1', typ: 'JWT' })
    .setIssuer(TOOL_ISSUER)
    .setAudience(TOOL_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);

  res.send(`
    <form id="f" method="post" action="${PLATFORM_AGS_BASE}/lti/deep-link/return">
      <input type="hidden" name="JWT" value="${jwt}" />
    </form>
    <script>document.getElementById('f').submit()</script>
  `);
});

app.post('/emit-file-item', async (_req, res) => {
  const nonce = randomText();
  const key = await importJWK(toolPrivateJwk, 'RS256');
  const dlPayload = {
    iss: TOOL_ISSUER,
    aud: TOOL_CLIENT_ID,
    sub: TOOL_USER_ID,
    nonce,
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': TOOL_DEPLOYMENT_ID,
    'https://purl.imsglobal.org/spec/lti/claim/context': { id: TOOL_COURSE_ID },
    'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': [
      { type: 'file', title: 'sample-tool-file.txt', text: 'This file came from tool deep-link item and is used for preview testing.' },
    ],
  };

  const jwt = await new SignJWT(dlPayload)
    .setProtectedHeader({ alg: 'RS256', kid: toolPrivateJwk.kid || 'tool-key-1', typ: 'JWT' })
    .setIssuer(TOOL_ISSUER)
    .setAudience(TOOL_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);

  res.send(`
    <form id="f" method="post" action="${PLATFORM_AGS_BASE}/lti/deep-link/return">
      <input type="hidden" name="JWT" value="${jwt}" />
    </form>
    <script>document.getElementById('f').submit()</script>
  `);
});

/* ------------------------------------------------------------------ */
/*  Routes: AGS                                                        */
/* ------------------------------------------------------------------ */

app.post('/post-grade', async (_req, res) => {
  try {
    const accessToken = await getServiceAccessToken(TOOL_COURSE_ID);
    const lineitemsUrl = `${PLATFORM_AGS_BASE}/lti/ags/courses/${TOOL_COURSE_ID}/lineitems`;

    // Create line item with spec-compliant fields
    const createRes = await fetch(lineitemsUrl, {
      method: 'POST',
      headers: {
        'content-type': MEDIA.LINEITEM,
        accept: MEDIA.LINEITEM,
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        org_id: TOOL_ORG_ID,
        label: 'Demo AGS Item',
        scoreMaximum: 10,
        tag: 'test',
        resourceId: 'demo-resource-1',
        resourceLinkId: 'resource-link-1',
        startDateTime: new Date().toISOString(),
        endDateTime: new Date(Date.now() + 7 * 86400000).toISOString(),
      }),
    });
    const lineItem = await createRes.json();
    const lineItemId = lineItem.id;

    if (!lineItemId) return res.status(500).json({ createdLineItem: lineItem, error: 'Line item creation failed' });

    // Extract UUID from URL-format id
    const lineItemUuid = lineItem.id.split('/').pop();

    // Post score with spec-compliant fields including comment
    const scoreRes = await fetch(`${PLATFORM_AGS_BASE}/lti/ags/lineitems/${lineItemUuid}/scores`, {
      method: 'POST',
      headers: {
        'content-type': MEDIA.SCORE,
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userId: TOOL_USER_ID,
        scoreGiven: 8,
        scoreMaximum: 10,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        comment: 'Great work on this assignment!',
        timestamp: new Date().toISOString(),
      }),
    });

    // AGS spec: score POST returns 200 with empty body
    res.json({
      createdLineItem: lineItem,
      postedScore: { status: scoreRes.status, ok: scoreRes.ok },
      contentType: createRes.headers.get('content-type'),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'post-grade failed' });
  }
});

app.post('/test-ags-filtering', async (_req, res) => {
  try {
    const accessToken = await getServiceAccessToken(TOOL_COURSE_ID);
    const base = `${PLATFORM_AGS_BASE}/lti/ags/courses/${TOOL_COURSE_ID}/lineitems`;

    // Create two line items with different tags
    await fetch(base, {
      method: 'POST',
      headers: { 'content-type': MEDIA.LINEITEM, authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ org_id: TOOL_ORG_ID, label: 'Homework 1', scoreMaximum: 100, tag: 'homework', resourceId: 'hw-1' }),
    });
    await fetch(base, {
      method: 'POST',
      headers: { 'content-type': MEDIA.LINEITEM, authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ org_id: TOOL_ORG_ID, label: 'Quiz 1', scoreMaximum: 50, tag: 'quiz', resourceId: 'quiz-1' }),
    });

    // Test filter by tag
    const byTag = await fetch(`${base}?tag=homework`, {
      headers: { accept: MEDIA.LINEITEM_CONTAINER, authorization: `Bearer ${accessToken}` },
    });
    const byTagItems = await byTag.json();

    // Test filter by resource_id
    const byRes = await fetch(`${base}?resource_id=quiz-1`, {
      headers: { accept: MEDIA.LINEITEM_CONTAINER, authorization: `Bearer ${accessToken}` },
    });
    const byResItems = await byRes.json();

    // Test pagination Link header
    const paginated = await fetch(`${base}?limit=1`, {
      headers: { accept: MEDIA.LINEITEM_CONTAINER, authorization: `Bearer ${accessToken}` },
    });
    const linkHeader = paginated.headers.get('link');

    res.json({
      filterByTag: { count: byTagItems.length, contentType: byTag.headers.get('content-type') },
      filterByResourceId: { count: byResItems.length, contentType: byRes.headers.get('content-type') },
      pagination: { linkHeader, itemCount: (await paginated.json()).length },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/test-ags-results', async (_req, res) => {
  try {
    const accessToken = await getServiceAccessToken(TOOL_COURSE_ID);
    const base = `${PLATFORM_AGS_BASE}/lti/ags/courses/${TOOL_COURSE_ID}/lineitems`;

    // Create a line item and post a score
    const createRes = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': MEDIA.LINEITEM, authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ org_id: TOOL_ORG_ID, label: 'Results Test', scoreMaximum: 100 }),
    });
    const lineItem = await createRes.json();
    const lineItemUuid = lineItem.id.split('/').pop();

    await fetch(`${PLATFORM_AGS_BASE}/lti/ags/lineitems/${lineItemUuid}/scores`, {
      method: 'POST',
      headers: { 'content-type': MEDIA.SCORE, authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        userId: TOOL_USER_ID,
        scoreGiven: 85,
        scoreMaximum: 100,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        comment: 'Well done',
        timestamp: new Date().toISOString(),
      }),
    });

    // Fetch results (spec format)
    const resultsRes = await fetch(`${PLATFORM_AGS_BASE}/lti/ags/lineitems/${lineItemUuid}/results`, {
      headers: { accept: MEDIA.RESULT_CONTAINER, authorization: `Bearer ${accessToken}` },
    });
    const results = await resultsRes.json();

    res.json({
      contentType: resultsRes.headers.get('content-type'),
      results,
      specFields: results.length > 0 ? {
        hasId: !!results[0].id,
        hasScoreOf: !!results[0].scoreOf,
        hasUserId: !!results[0].userId,
        hasResultScore: results[0].resultScore !== undefined,
        hasResultMaximum: results[0].resultMaximum !== undefined,
        hasComment: !!results[0].comment,
      } : 'no results',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Routes: NRPS                                                       */
/* ------------------------------------------------------------------ */

app.get('/roster', async (_req, res) => {
  try {
    const accessToken = await getServiceAccessToken(TOOL_COURSE_ID);
    const r = await fetch(`${PLATFORM_NRPS_BASE}/lti/nrps/courses/${TOOL_COURSE_ID}/memberships`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: MEDIA.MEMBERSHIP_CONTAINER,
      },
    });
    const body = await r.json();
    res.json({
      contentType: r.headers.get('content-type'),
      linkHeader: r.headers.get('link'),
      data: body,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'roster failed' });
  }
});

app.get('/roster-role-filter', async (_req, res) => {
  try {
    const accessToken = await getServiceAccessToken(TOOL_COURSE_ID);
    const role = encodeURIComponent('http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor');
    const r = await fetch(
      `${PLATFORM_NRPS_BASE}/lti/nrps/courses/${TOOL_COURSE_ID}/memberships?role=${role}`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: MEDIA.MEMBERSHIP_CONTAINER,
        },
      },
    );
    const body = await r.json();
    res.json({
      filter: 'Instructor',
      contentType: r.headers.get('content-type'),
      memberCount: body.members?.length || 0,
      data: body,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/roster-since', async (_req, res) => {
  try {
    const accessToken = await getServiceAccessToken(TOOL_COURSE_ID);
    const since = new Date(Date.now() - 7 * 86400000).toISOString(); // last 7 days
    const r = await fetch(
      `${PLATFORM_NRPS_BASE}/lti/nrps/courses/${TOOL_COURSE_ID}/memberships?since=${encodeURIComponent(since)}`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: MEDIA.MEMBERSHIP_CONTAINER,
        },
      },
    );
    const body = await r.json();
    res.json({
      filter: `since=${since}`,
      contentType: r.headers.get('content-type'),
      memberCount: body.members?.length || 0,
      data: body,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Routes: Comprehensive test runner                                  */
/* ------------------------------------------------------------------ */

app.get('/test-all', async (_req, res) => {
  const results = {};
  const pass = (name) => { results[name] = { status: 'PASS' }; };
  const fail = (name, detail) => { results[name] = { status: 'FAIL', detail }; };

  try {
    // 1. Token endpoint (jti + scope enforcement)
    let accessToken;
    try {
      accessToken = await getServiceAccessToken(TOOL_COURSE_ID);
      pass('token_endpoint');
    } catch (e) {
      fail('token_endpoint', e.message);
      return res.json({ results, summary: 'Stopped: token endpoint failed' });
    }

    // 2. AGS: Create line item with spec fields
    const lineitemsUrl = `${PLATFORM_AGS_BASE}/lti/ags/courses/${TOOL_COURSE_ID}/lineitems`;
    const createRes = await fetch(lineitemsUrl, {
      method: 'POST',
      headers: { 'content-type': MEDIA.LINEITEM, authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ org_id: TOOL_ORG_ID, label: 'Compliance Test', scoreMaximum: 100, tag: 'compliance', resourceId: 'comp-1' }),
    });
    const lineItem = await createRes.json();
    const createCT = createRes.headers.get('content-type') || '';
    if (createCT.includes('vnd.ims.lis.v2.lineitem')) pass('ags_lineitem_content_type');
    else fail('ags_lineitem_content_type', `Got: ${createCT}`);

    if (lineItem.id && lineItem.id.startsWith('http')) pass('ags_lineitem_id_is_url');
    else fail('ags_lineitem_id_is_url', `Got: ${lineItem.id}`);

    if (lineItem.scoreMaximum !== undefined) pass('ags_lineitem_spec_fields');
    else fail('ags_lineitem_spec_fields', 'Missing scoreMaximum');

    // 3. AGS: List line items with container content type
    const listRes = await fetch(lineitemsUrl, {
      headers: { accept: MEDIA.LINEITEM_CONTAINER, authorization: `Bearer ${accessToken}` },
    });
    const listCT = listRes.headers.get('content-type') || '';
    if (listCT.includes('vnd.ims.lis.v2.lineitemcontainer')) pass('ags_container_content_type');
    else fail('ags_container_content_type', `Got: ${listCT}`);

    // 4. AGS: Filter by tag
    const tagRes = await fetch(`${lineitemsUrl}?tag=compliance`, {
      headers: { accept: MEDIA.LINEITEM_CONTAINER, authorization: `Bearer ${accessToken}` },
    });
    const tagItems = await tagRes.json();
    if (tagItems.length > 0 && tagItems.every(i => i.tag === 'compliance')) pass('ags_filter_by_tag');
    else fail('ags_filter_by_tag', `Got ${tagItems.length} items`);

    // 5. AGS: Post score
    const lineItemUuid = lineItem.id.split('/').pop();
    const scoreRes = await fetch(`${PLATFORM_AGS_BASE}/lti/ags/lineitems/${lineItemUuid}/scores`, {
      method: 'POST',
      headers: { 'content-type': MEDIA.SCORE, authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        userId: TOOL_USER_ID, scoreGiven: 90, scoreMaximum: 100,
        activityProgress: 'Completed', gradingProgress: 'FullyGraded',
        comment: 'Compliance test score', timestamp: new Date().toISOString(),
      }),
    });
    if (scoreRes.status === 200) pass('ags_score_post');
    else fail('ags_score_post', `Status: ${scoreRes.status}`);

    // 6. AGS: Invalid gradingProgress rejected
    const badGradeRes = await fetch(`${PLATFORM_AGS_BASE}/lti/ags/lineitems/${lineItemUuid}/scores`, {
      method: 'POST',
      headers: { 'content-type': MEDIA.SCORE, authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        userId: TOOL_USER_ID, scoreGiven: 50, scoreMaximum: 100,
        activityProgress: 'Completed', gradingProgress: 'InvalidValue',
        timestamp: new Date().toISOString(),
      }),
    });
    if (badGradeRes.status === 400) pass('ags_validates_grading_progress');
    else fail('ags_validates_grading_progress', `Status: ${badGradeRes.status}`);

    // 7. AGS: Results format
    const resultsRes = await fetch(`${PLATFORM_AGS_BASE}/lti/ags/lineitems/${lineItemUuid}/results`, {
      headers: { accept: MEDIA.RESULT_CONTAINER, authorization: `Bearer ${accessToken}` },
    });
    const resultsCT = resultsRes.headers.get('content-type') || '';
    if (resultsCT.includes('vnd.ims.lis.v2.resultcontainer')) pass('ags_results_content_type');
    else fail('ags_results_content_type', `Got: ${resultsCT}`);

    const resultsData = await resultsRes.json();
    if (resultsData.length > 0 && resultsData[0].scoreOf && resultsData[0].userId) pass('ags_results_spec_format');
    else fail('ags_results_spec_format', `Fields: ${JSON.stringify(Object.keys(resultsData[0] || {}))}`);

    // 8. AGS: Pagination Link header
    const pgRes = await fetch(`${lineitemsUrl}?limit=1`, {
      headers: { accept: MEDIA.LINEITEM_CONTAINER, authorization: `Bearer ${accessToken}` },
    });
    const pgLink = pgRes.headers.get('link');
    if (pgLink && pgLink.includes('rel="next"')) pass('ags_pagination_link_header');
    else fail('ags_pagination_link_header', `Link: ${pgLink}`);

    // 9. NRPS: Content type
    const nrpsRes = await fetch(`${PLATFORM_NRPS_BASE}/lti/nrps/courses/${TOOL_COURSE_ID}/memberships`, {
      headers: { authorization: `Bearer ${accessToken}`, accept: MEDIA.MEMBERSHIP_CONTAINER },
    });
    const nrpsCT = nrpsRes.headers.get('content-type') || '';
    if (nrpsCT.includes('vnd.ims.lis.v2.membershipcontainer')) pass('nrps_content_type');
    else fail('nrps_content_type', `Got: ${nrpsCT}`);

    const nrpsData = await nrpsRes.json();
    if (nrpsData.context?.id && nrpsData.members) pass('nrps_response_structure');
    else fail('nrps_response_structure', `Keys: ${JSON.stringify(Object.keys(nrpsData))}`);

    // 10. NRPS: System roles included
    if (nrpsData.members?.length > 0) {
      const roles = nrpsData.members[0].roles || [];
      const hasSystem = roles.some(r => r.includes('institution/person'));
      const hasContext = roles.some(r => r.includes('membership#'));
      if (hasSystem && hasContext) pass('nrps_dual_roles');
      else fail('nrps_dual_roles', `Roles: ${JSON.stringify(roles)}`);
    } else {
      fail('nrps_dual_roles', 'No members returned');
    }

    // 11. NRPS: Role filter
    const roleFilter = encodeURIComponent('http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor');
    const roleRes = await fetch(
      `${PLATFORM_NRPS_BASE}/lti/nrps/courses/${TOOL_COURSE_ID}/memberships?role=${roleFilter}`,
      { headers: { authorization: `Bearer ${accessToken}`, accept: MEDIA.MEMBERSHIP_CONTAINER } },
    );
    if (roleRes.status === 200) pass('nrps_role_filter');
    else fail('nrps_role_filter', `Status: ${roleRes.status}`);

    // 12. NRPS: Differential membership (?since=)
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const sinceRes = await fetch(
      `${PLATFORM_NRPS_BASE}/lti/nrps/courses/${TOOL_COURSE_ID}/memberships?since=${encodeURIComponent(since)}`,
      { headers: { authorization: `Bearer ${accessToken}`, accept: MEDIA.MEMBERSHIP_CONTAINER } },
    );
    if (sinceRes.status === 200) pass('nrps_since_filter');
    else fail('nrps_since_filter', `Status: ${sinceRes.status}`);

    // Summary
    const total = Object.keys(results).length;
    const passed = Object.values(results).filter(r => r.status === 'PASS').length;
    const failed = total - passed;

    res.json({ summary: `${passed}/${total} passed, ${failed} failed`, results });
  } catch (e) {
    res.status(500).json({ error: e.message, results });
  }
});

/* ------------------------------------------------------------------ */
/*  Start server                                                       */
/* ------------------------------------------------------------------ */

app.listen(PORT, () => {
  console.log(`LTI 1.3 Advantage test tool on http://localhost:${PORT}`);
});
