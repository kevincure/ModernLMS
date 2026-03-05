# ModernLMS LTI 1.3 / Advantage Setup & Test Guide

This document replaces the old implementation notes with a practical runbook for two audiences:

1. **Internal team members** reproducing the working end-to-end smoke test (the exact path already validated)
2. **External tool providers** integrating an existing LTI 1.3 tool with ModernLMS as platform

Scope covered:
- LTI 1.3 launch
- Deep Linking 2.0
- AGS score passback
- NRPS memberships

---

## 0) What is already in this repo

- Cloudflare Worker platform code: `cloudflare/lti-platform-worker/src/index.ts`
- Worker config: `cloudflare/lti-platform-worker/wrangler.toml`
- Supabase LTI schema migration: `supabase/migrations/20260304_lti13_platform.sql`
- Local test tool: `cloudflare/lti-test-tool/`

Required precondition:
- Apply the LTI migration SQL in Supabase Query Editor before running tests.

---

## 1) Internal team runbook (repeatable smoke test)

This is the fastest way for a teammate to verify the baseline works.

## 1.1 Deploy platform worker

From `cloudflare/lti-platform-worker`:

```bash
npm install
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put LTI_PLATFORM_ISSUER
npx wrangler secret put LTI_PRIVATE_JWK_ACTIVE_JSON
npx wrangler deploy
```

Set `LTI_PLATFORM_ISSUER` to deployed worker base URL, e.g.
`https://modernlms-lti-platform.<account>.workers.dev`

Verify:
- `GET /healthz`
- `GET /.well-known/jwks.json`

---

## 1.2 Start local test tool + public tunnel

Terminal A:

```bash
cd cloudflare/lti-test-tool
npm install
npm start
```

Terminal B (public URL for local tool):

```bash
cloudflared tunnel --url http://localhost:8788
```

Use the generated `https://<random>.trycloudflare.com` URL as `TOOL_ISSUER`.

---

## 1.3 Configure test tool `.env`

Create `.env` in `cloudflare/lti-test-tool`:

```env
PORT=8788
TOOL_ISSUER=https://YOUR-TOOL-PUBLIC-URL
TOOL_CLIENT_ID=modernlms-test-client
TOOL_DEPLOYMENT_ID=modernlms-deploy-1
TOOL_PRIVATE_JWK_JSON={"kty":"RSA","n":"...","e":"AQAB","d":"...","p":"...","q":"...","dp":"...","dq":"...","qi":"...","alg":"RS256","kid":"tool-key-1"}

PLATFORM_LOGIN_URL=https://modernlms-lti-platform.<account>.workers.dev/lti/oidc/login
PLATFORM_LAUNCH_URL=https://modernlms-lti-platform.<account>.workers.dev/lti/launch
PLATFORM_AGS_BASE=https://modernlms-lti-platform.<account>.workers.dev
PLATFORM_NRPS_BASE=https://modernlms-lti-platform.<account>.workers.dev
```

Critical:
- `TOOL_ISSUER` must match tunnel URL exactly
- tool must expose `/.well-known/jwks.json`
- `TOOL_CLIENT_ID` and `TOOL_DEPLOYMENT_ID` must match Supabase rows

---

## 1.4 Create/refresh Supabase LTI registration rows

Use these values from your environment:
- `org_id`
- `course_id`
- tunnel URL

Insert registration:

```sql
insert into lti_registrations (
  org_id, tool_name, issuer, client_id, auth_login_url, auth_token_url, jwks_url,
  target_link_uri, deep_link_return_url, status, metadata
)
values (
  'ORG_UUID',
  'Local LTI Test Tool',
  'https://YOUR-TOOL-PUBLIC-URL',
  'modernlms-test-client',
  'https://YOUR-TOOL-PUBLIC-URL/launch',
  null,
  'https://YOUR-TOOL-PUBLIC-URL/.well-known/jwks.json',
  'https://YOUR-TOOL-PUBLIC-URL/launch',
  'https://modernlms-lti-platform.<account>.workers.dev/lti/deep-link/return',
  'active',
  '{}'::jsonb
);
```

Get registration id:

```sql
select id
from lti_registrations
where org_id = 'ORG_UUID'
  and issuer = 'https://YOUR-TOOL-PUBLIC-URL'
  and client_id = 'modernlms-test-client'
order by created_at desc
limit 1;
```

Insert deployment (course scoped):

```sql
insert into lti_deployments (
  org_id, registration_id, deployment_id, scope_type, scope_ref,
  enable_deep_linking, enable_ags, enable_nrps, status
)
values (
  'ORG_UUID',
  'REGISTRATION_UUID',
  'modernlms-deploy-1',
  'course',
  'COURSE_UUID',
  true, true, true,
  'active'
);
```

If tunnel URL changes, update registration instead of reinserting:

```sql
update lti_registrations
set issuer = 'https://NEW.trycloudflare.com',
    auth_login_url = 'https://NEW.trycloudflare.com/launch',
    jwks_url = 'https://NEW.trycloudflare.com/.well-known/jwks.json',
    target_link_uri = 'https://NEW.trycloudflare.com/launch',
    updated_at = now()
where org_id = 'ORG_UUID'
  and client_id = 'modernlms-test-client';
```

---

## 1.5 Execute smoke test actions

Open tool home and click these, in order:
1. Start resource launch
2. Start deep-link launch
3. Emit deep links
4. Post grade 8/10
5. Get roster (NRPS)

Expected UI outcomes:
- Launch: `LTI launch ok`
- Deep link: `Deep link response accepted.`
- Grade: line item + score object returned
- Roster: members payload returned

---

## 1.6 Validate in Supabase (must-pass queries)

```sql
select created_at, status, message_type, error_code
from lti_launches
order by created_at desc
limit 20;
```

```sql
select created_at, content_title, content_item_type
from lti_deep_link_items
order by created_at desc
limit 20;
```

```sql
select created_at, score_given, score_max, user_id
from lti_ags_scores
order by created_at desc
limit 20;
```

```sql
select created_at, course_id, result_count, status_code
from lti_nrps_requests
order by created_at desc
limit 20;
```

Success criteria:
- launch rows present with `status=success`
- deep-link rows created for selected items
- AGS score row inserted
- NRPS request row inserted with `status_code=200`

---

## 1.7 Known pitfalls and fixes

1. `/.well-known/jwks.json` 1101 on platform worker
- Ensure worker code uses public `n/e` extraction from JWK (no private key export requirement)

2. `invalid input syntax for type uuid: demo-course-1`
- Replace hardcoded demo IDs in test tool with real course/user UUIDs

3. `Missing org_id (and could not infer from course)`
- Pass real `org_id` or ensure `course_id` is real and exists

4. Tunnel URL changed
- Update `lti_registrations` issuer/login/jwks and `.env` `TOOL_ISSUER`

---

## 2) External tool provider integration guide (existing tools)

This section is for partners integrating their own LTI tool against ModernLMS.

## 2.1 What external tool team needs from ModernLMS

Platform metadata to provide tool team:
- Platform issuer: `https://modernlms-lti-platform.<account>.workers.dev` (or custom domain)
- Platform JWKS URL: `https://modernlms-lti-platform.<account>.workers.dev/.well-known/jwks.json`
- OIDC login initiation endpoint: `https://modernlms-lti-platform.<account>.workers.dev/lti/oidc/login`
- Launch endpoint: `https://modernlms-lti-platform.<account>.workers.dev/lti/launch`
- AGS endpoints (lineitems/scores/results)
- NRPS endpoint pattern: `/lti/nrps/courses/{courseId}/memberships`

Provision per-tool values in ModernLMS:
- `issuer` (tool issuer)
- `client_id`
- `auth_login_url`
- `jwks_url`
- `deployment_id`
- scope (`org`/`course`)

---

## 2.2 What ModernLMS needs from external tool team

Require from tool provider:
- Tool issuer URL
- Tool client ID
- Tool JWKS URL (publicly reachable)
- Tool launch/login URL
- One test deployment ID
- Deep linking support confirmation (if used)
- AGS scopes requested
- NRPS usage confirmation

---

## 2.3 External provider conformance smoke checks

Must validate with provider:
1. LTI resource launch works in iframe
2. Deep Linking creates expected LMS resource(s)
3. AGS line item creation and score passback succeed
4. NRPS memberships endpoint returns expected roster

Evidence expected:
- HTTP logs/correlation IDs
- rows in `lti_launches`, `lti_ags_scores`, `lti_deep_link_items`, `lti_nrps_requests`

---

## 2.4 Support/debug checklist for partner onboarding

When debugging partner launch failures, collect:
- `iss`, `aud(client_id)`, `deployment_id`
- nonce/state validity
- token expiration skew
- tool JWKS fetch status
- exact `error_code` from `lti_launches`

Run:

```sql
select created_at, status, error_code, error_detail, message_type, deployment_id
from lti_launches
order by created_at desc
limit 50;
```

---

## 3) Operational recommendations

1. For repeated internal testing, use named tunnel/static hostname (avoid rotating quick-tunnel URLs)
2. Keep one permanent test org/course/deployment for regression smoke tests
3. Save a known-good `.env` template in internal runbook (without secrets)
4. Add CI smoke tests later for launch + AGS + NRPS to prevent regressions

---

## 4) Quick status checklist (copy/paste)

- [ ] Worker deployed and `/healthz` returns OK
- [ ] Platform JWKS endpoint returns keys
- [ ] Tool JWKS endpoint returns keys
- [ ] Registration row active
- [ ] Deployment row active for target course
- [ ] Resource launch success
- [ ] Deep link success
- [ ] AGS score success
- [ ] NRPS success
- [ ] SQL evidence captured

