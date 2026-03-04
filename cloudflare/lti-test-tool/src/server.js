import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { SignJWT, importJWK } from 'jose';

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const PORT = Number(process.env.PORT || 8788);
const TOOL_ISSUER = process.env.TOOL_ISSUER;
const TOOL_CLIENT_ID = process.env.TOOL_CLIENT_ID;
const TOOL_DEPLOYMENT_ID = process.env.TOOL_DEPLOYMENT_ID;
const TOOL_PRIVATE_JWK_JSON = process.env.TOOL_PRIVATE_JWK_JSON;
const PLATFORM_LOGIN_URL = process.env.PLATFORM_LOGIN_URL;
const PLATFORM_LAUNCH_URL = process.env.PLATFORM_LAUNCH_URL;

if (!TOOL_ISSUER || !TOOL_CLIENT_ID || !TOOL_DEPLOYMENT_ID || !TOOL_PRIVATE_JWK_JSON || !PLATFORM_LOGIN_URL || !PLATFORM_LAUNCH_URL) {
  console.error('Missing required env vars; copy .env.example to .env and fill values');
  process.exit(1);
}

const toolPrivateJwk = JSON.parse(TOOL_PRIVATE_JWK_JSON);

async function signIdToken({ nonce, targetLinkUri, messageType = 'LtiResourceLinkRequest', deepLinkReturnUrl = null, userSub = 'demo-user-1', courseId = 'demo-course-1' }) {
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
      title: 'Demo Course'
    },
    'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
      id: 'resource-link-1',
      title: 'Demo LTI Resource'
    },
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'
    ],
    'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
      lineitems: `${process.env.PLATFORM_AGS_BASE}/lti/ags/courses/${courseId}/lineitems`,
      lineitem: null,
      scope: [
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
        'https://purl.imsglobal.org/spec/lti-ags/scope/score',
        'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly'
      ]
    },
    'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice': {
      context_memberships_url: `${process.env.PLATFORM_NRPS_BASE}/lti/nrps/courses/${courseId}/memberships`,
      service_versions: ['2.0']
    }
  };

  if (messageType === 'LtiDeepLinkingRequest') {
    payload['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'] = {
      deep_link_return_url: deepLinkReturnUrl,
      accept_types: ['link', 'ltiResourceLink'],
      accept_presentation_document_targets: ['iframe', 'window'],
      auto_create: true
    };
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: toolPrivateJwk.kid || 'tool-key-1' })
    .setIssuer(TOOL_ISSUER)
    .setAudience(TOOL_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

app.get('/', (_req, res) => {
  res.send(`
    <h1>ModernLMS LTI Test Tool</h1>
    <ul>
      <li><a href="/start-resource-launch">Start resource launch</a></li>
      <li><a href="/start-deep-link-launch">Start deep-link launch</a></li>
      <li><a href="/tool-ui">Tool UI</a></li>
    </ul>
  `);
});

app.get('/start-resource-launch', (req, res) => {
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
  const deepLinkReturnUrl = `${process.env.PLATFORM_AGS_BASE}/lti/deep-link/return`;
  const idToken = await signIdToken({
    nonce,
    targetLinkUri: `${TOOL_ISSUER}/deep-link-launch`,
    messageType: 'LtiDeepLinkingRequest',
    deepLinkReturnUrl
  });

  res.send(`
    <form id="f" method="post" action="${PLATFORM_LAUNCH_URL}">
      <input type="hidden" name="id_token" value="${idToken}" />
      <input type="hidden" name="state" value="${state}" />
    </form>
    <script>document.getElementById('f').submit()</script>
  `);
});

app.get('/tool-ui', (_req, res) => {
  res.send(`
    <h2>LTI launch ok</h2>
    <p>Use buttons to emulate deep links and AGS score passback.</p>
    <form method="post" action="/emit-deep-links">
      <button>Emit deep links</button>
    </form>
    <form method="post" action="/post-grade">
      <button>Post grade 8/10</button>
    </form>
    <form method="get" action="/roster">
      <button>Get roster (NRPS)</button>
    </form>
  `);
});

app.post('/emit-deep-links', async (_req, res) => {
  const nonce = randomText();
  const key = await importJWK(toolPrivateJwk, 'RS256');
  const dlPayload = {
    iss: TOOL_ISSUER,
    aud: TOOL_CLIENT_ID,
    sub: 'demo-user-1',
    nonce,
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': TOOL_DEPLOYMENT_ID,
    'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': [
      { type: 'link', title: 'External reading link', url: 'https://example.org/reading' },
      { type: 'ltiResourceLink', title: 'Practice quiz placeholder', url: `${TOOL_ISSUER}/tool-ui` }
    ]
  };
  const jwt = await new SignJWT(dlPayload)
    .setProtectedHeader({ alg: 'RS256', kid: toolPrivateJwk.kid || 'tool-key-1', typ: 'JWT' })
    .setIssuer(TOOL_ISSUER)
    .setAudience(TOOL_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);

  res.send(`
    <form id="f" method="post" action="${process.env.PLATFORM_AGS_BASE}/lti/deep-link/return">
      <input type="hidden" name="JWT" value="${jwt}" />
    </form>
    <script>document.getElementById('f').submit()</script>
  `);
});

app.post('/post-grade', async (_req, res) => {
  const lineitemsUrl = `${process.env.PLATFORM_AGS_BASE}/lti/ags/courses/demo-course-1/lineitems`;
  const createRes = await fetch(lineitemsUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      org_id: null,
      label: 'Demo AGS Item',
      scoreMaximum: 10,
      assignment_id: null
    })
  });
  const lineItem = await createRes.json();
  const lineItemId = lineItem.id;

  const scoreRes = await fetch(`${process.env.PLATFORM_AGS_BASE}/lti/ags/lineitems/${lineItemId}/scores`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      userId: 'demo-user-1',
      scoreGiven: 8,
      scoreMaximum: 10,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: new Date().toISOString()
    })
  });

  const score = await scoreRes.json();
  res.json({ createdLineItem: lineItem, postedScore: score });
});

app.get('/roster', async (_req, res) => {
  const r = await fetch(`${process.env.PLATFORM_NRPS_BASE}/lti/nrps/courses/demo-course-1/memberships`);
  const body = await r.text();
  res.type('application/json').send(body);
});

function randomText() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

app.listen(PORT, () => {
  console.log(`LTI test tool on http://localhost:${PORT}`);
});
