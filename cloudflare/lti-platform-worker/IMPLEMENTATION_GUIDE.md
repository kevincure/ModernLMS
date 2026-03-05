# ModernLMS LTI 1.3 / Advantage Setup & Test Guide

This document is the authoritative runbook for two audiences:

1. **Internal team** reproducing or re-validating the working end-to-end smoke test
2. **External tool providers** integrating an existing LTI 1.3 Advantage tool with ModernLMS

Scope: LTI 1.3 launch, Deep Linking 2.0, AGS (score passback), NRPS (roster).

---

## 0) What is already in this repo

| Path | Purpose |
|---|---|
| `cloudflare/lti-platform-worker/src/index.ts` | Cloudflare Worker — the LTI platform |
| `cloudflare/lti-platform-worker/wrangler.toml` | Worker config |
| `supabase/migrations/20260304_lti13_platform.sql` | Full schema (apply once) |
| `cloudflare/lti-test-tool/` | Local Node.js test tool (16 automated checks + manual flows) |

**Apply the migration in Supabase Query Editor before running anything.**

---

## 1) Internal team runbook (repeatable smoke test)

### 1.1 Deploy platform worker

From `cloudflare/lti-platform-worker`:

```bash
npm install
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put LTI_PLATFORM_ISSUER
npx wrangler secret put LTI_PRIVATE_JWK_ACTIVE_JSON
npx wrangler deploy
```

**Critical:** `LTI_PLATFORM_ISSUER` must be set to the deployed worker base URL exactly as it appears in the browser — no trailing slash:

```
https://modernlms-lti-platform.<account>.workers.dev
```

This value is used in token `aud` validation. If it does not exactly match the base URL that `PLATFORM_AGS_BASE` points to in the test tool `.env`, the token endpoint will return `unexpected "aud" claim value` and all AGS/NRPS calls will fail.

Verify deployment:
- `GET /healthz` → `{"status":"ok"}`
- `GET /.well-known/jwks.json` → `{"keys":[{...}]}`

---

### 1.2 Start local test tool + public tunnel

The test tool must be publicly reachable because:
- The Cloudflare Worker (on the edge) fetches the tool's JWKS to validate launch JWTs
- The browser follows OIDC redirects back to the tool

Terminal A — test tool server:
```bash
cd cloudflare/lti-test-tool
npm install
npm start
```

Terminal B — public tunnel (keep open the entire session):
```bash
cloudflared tunnel --url http://localhost:8788
```

Note the generated URL: `https://<random>.trycloudflare.com` — this is `TOOL_URL` for the rest of these steps. **Every time you restart the tunnel, the URL changes. Update both `.env` and the Supabase registration (section 1.4) when it changes.**

---

### 1.3 Configure test tool `.env`

Create `cloudflare/lti-test-tool/.env` (copy from `.env.example` and fill in):

```env
PORT=8788

# Tool public identity — MUST match Supabase lti_registrations.issuer
TOOL_ISSUER=https://YOUR-RANDOM.trycloudflare.com

# These must match lti_registrations.client_id and lti_deployments.deployment_id
TOOL_CLIENT_ID=modernlms-test-client
TOOL_DEPLOYMENT_ID=modernlms-deploy-1

# Real UUIDs from your Supabase database
TOOL_ORG_ID=replace-with-org-uuid
TOOL_COURSE_ID=replace-with-course-uuid
TOOL_USER_ID=replace-with-enrolled-user-uuid

# RSA private key in JWK format — generate once, keep stable
TOOL_PRIVATE_JWK_JSON={"kty":"RSA","n":"...","e":"AQAB","d":"...","alg":"RS256","kid":"tool-key-1"}

# Platform worker — use deployed workers.dev URL, NOT a local tunnel
PLATFORM_LOGIN_URL=https://modernlms-lti-platform.<account>.workers.dev/lti/oidc/login
PLATFORM_LAUNCH_URL=https://modernlms-lti-platform.<account>.workers.dev/lti/launch
PLATFORM_AGS_BASE=https://modernlms-lti-platform.<account>.workers.dev
PLATFORM_NRPS_BASE=https://modernlms-lti-platform.<account>.workers.dev
```

After editing `.env`, restart the test tool (`npm start`).

---

### 1.4 Create/refresh Supabase registration rows

Run these in Supabase Query Editor. Replace the placeholders with your real values.

**First-time insert:**

```sql
-- 1. Insert registration
INSERT INTO lti_registrations (
  org_id, tool_name, issuer, client_id,
  auth_login_url, auth_token_url, jwks_url,
  target_link_uri, deep_link_return_url, status, metadata
)
VALUES (
  'ORG_UUID',
  'Local LTI Test Tool',
  'https://YOUR-RANDOM.trycloudflare.com',
  'modernlms-test-client',
  'https://YOUR-RANDOM.trycloudflare.com/auth-dispatch',
  null,
  'https://YOUR-RANDOM.trycloudflare.com/.well-known/jwks.json',
  'https://YOUR-RANDOM.trycloudflare.com/launch',
  'https://modernlms-lti-platform.<account>.workers.dev/lti/deep-link/return',
  'active',
  '{}'::jsonb
);

-- 2. Get the registration id just created
SELECT id
FROM lti_registrations
WHERE org_id = 'ORG_UUID'
  AND client_id = 'modernlms-test-client'
ORDER BY created_at DESC
LIMIT 1;

-- 3. Insert deployment (use the id from step 2)
INSERT INTO lti_deployments (
  org_id, registration_id, deployment_id, scope_type, scope_ref,
  enable_deep_linking, enable_ags, enable_nrps, status
)
VALUES (
  'ORG_UUID',
  'REGISTRATION_UUID',
  'modernlms-deploy-1',
  'course',
  'COURSE_UUID',
  true, true, true,
  'active'
);
```

**When the tunnel URL changes (every tunnel restart):**

```sql
UPDATE lti_registrations
SET
  issuer         = 'https://NEW-RANDOM.trycloudflare.com',
  auth_login_url = 'https://NEW-RANDOM.trycloudflare.com/auth-dispatch',
  jwks_url       = 'https://NEW-RANDOM.trycloudflare.com/.well-known/jwks.json',
  target_link_uri = 'https://NEW-RANDOM.trycloudflare.com/launch',
  updated_at     = now()
WHERE org_id = 'ORG_UUID'
  AND client_id = 'modernlms-test-client';
```

**Critical:** `auth_login_url` must point to `/auth-dispatch`, not `/launch`.
The `/auth-dispatch` endpoint reads `lti_message_hint` to route the browser to
`/launch` (resource) or `/deep-link-launch` (deep linking). Using `/launch` directly
means deep-link launches always arrive as `LtiResourceLinkRequest` and no
`LtiDeepLinkingRequest` row ever gets stored — causing "No matching deep-link launch found"
when you try to emit deep links.

---

### 1.5 Execute smoke test — automated (16 checks)

```
http://localhost:8788/test-all
```

All 16 must show `"PASS"`. These cover: token endpoint, AGS content types, line item CRUD, score posting, grading progress validation, results format, pagination, NRPS content type, structure, dual roles, role filter, since filter.

---

### 1.6 Execute smoke test — browser flows (in order)

Open `http://localhost:8788/tool-ui` and do these in sequence:

**1. Start Resource Launch**
- Platform OIDC → `/auth-dispatch` → `/launch` → POST to `/lti/launch`
- Expected: `LTI launch ok` page showing `LtiResourceLinkRequest`

**2. Start Deep Link Launch**
- Platform OIDC → `/auth-dispatch` → `/deep-link-launch` → POST to `/lti/launch`
- Expected: `Deep Linking Request Received` page (NOT `LtiResourceLinkRequest`)
- This stores the `LtiDeepLinkingRequest` row and the data echo value in server memory
- **Must do this before Emit Deep Links**

**3. Emit Deep Links** (only works after step 2 in same server session)
- Posts `LtiDeepLinkingResponse` with two content items + correct data echo
- Expected: `Deep link response accepted` with item listing

**4. Post Grade 8/10**
- Server-side: token → create line item → post score
- Expected: JSON showing line item and score objects

**5. Get Roster (NRPS)**
- Server-side: token → GET memberships
- Expected: JSON with member array

---

### 1.7 Validate rows in Supabase

```sql
-- Launch records (expect LtiResourceLinkRequest + LtiDeepLinkingRequest both with status=success)
SELECT created_at, status, message_type, error_code, error_detail
FROM lti_launches
ORDER BY created_at DESC
LIMIT 20;

-- Deep link items stored
SELECT created_at, content_title, content_item_type
FROM lti_deep_link_items
ORDER BY created_at DESC
LIMIT 20;

-- AGS scores
SELECT created_at, score_given, score_max, user_id
FROM lti_ags_scores
ORDER BY created_at DESC
LIMIT 20;

-- NRPS requests
SELECT created_at, course_id, result_count, status_code
FROM lti_nrps_requests
ORDER BY created_at DESC
LIMIT 20;
```

---

### 1.8 Known pitfalls and fixes

| Error | Cause | Fix |
|---|---|---|
| `unexpected "aud" claim value` | `LTI_PLATFORM_ISSUER` secret ≠ `PLATFORM_AGS_BASE` value | Re-run `wrangler secret put LTI_PLATFORM_ISSUER` with exact workers.dev URL, redeploy |
| `No matching deep-link launch found` | `auth_login_url` points to `/launch` instead of `/auth-dispatch`, so no `LtiDeepLinkingRequest` stored | Update Supabase registration `auth_login_url` to `TUNNEL/auth-dispatch` |
| `Deep linking data claim does not match` | `/emit-deep-links` clicked without doing "Start Deep Link Launch" first in same server session | Always do "Start Deep Link Launch" before "Emit Deep Links" — they share in-memory data |
| `Cannot GET /auth-dispatch` | Test tool running old code before the auth-dispatch commit | `git pull`, restart test tool |
| `<!DOCTYPE` in token endpoint response | `PLATFORM_AGS_BASE` pointing to a dead/expired trycloudflare.com tunnel | Update `.env` PLATFORM_* vars to deployed workers.dev URL |
| `Missing org_id` | `TOOL_ORG_ID` not set or not a real UUID | Set real org UUID from your Supabase database |
| `invalid input syntax for type uuid` | Placeholder IDs like `demo-course-1` still in `.env` | Replace all TOOL_ORG_ID / TOOL_COURSE_ID / TOOL_USER_ID with real UUIDs |
| `Registration not found` / `Invalid or inactive deployment` | Registration row `issuer` doesn't match `TOOL_ISSUER` in `.env` | Tunnel URL changed — run the UPDATE SQL in 1.4 |

---

## 2) External tool provider integration guide

This is what to send to a third-party tool team (Kaltura, H5P, Scorm Cloud, custom, etc.).

### 2.1 What to give the tool provider (your platform config)

Send them these values. Replace `<account>` with your Cloudflare account subdomain.

```
Platform Issuer:
  https://modernlms-lti-platform.<account>.workers.dev

Platform JWKS URL (to validate tokens you send them):
  https://modernlms-lti-platform.<account>.workers.dev/.well-known/jwks.json

OIDC Login Initiation URL:
  https://modernlms-lti-platform.<account>.workers.dev/lti/oidc/login

Launch / Redirect URI:
  https://modernlms-lti-platform.<account>.workers.dev/lti/launch

Deep Link Return URL:
  https://modernlms-lti-platform.<account>.workers.dev/lti/deep-link/return

Token Endpoint (client_credentials for AGS/NRPS):
  https://modernlms-lti-platform.<account>.workers.dev/lti/oauth2/token

AGS Line Items Base (per course):
  https://modernlms-lti-platform.<account>.workers.dev/lti/ags/courses/{courseId}/lineitems

NRPS Memberships Base (per course):
  https://modernlms-lti-platform.<account>.workers.dev/lti/nrps/courses/{courseId}/memberships

Supported LTI version: 1.3.0
Supported message types: LtiResourceLinkRequest, LtiDeepLinkingRequest
```

---

### 2.2 What to ask for from the tool provider

Request these from them before you can register them:

```
Required:
  1. Tool Issuer URL          (their base domain, e.g. https://tool.vendor.com)
  2. Client ID                (they assign this, or you agree on one)
  3. Tool JWKS URL            (must be publicly reachable from the internet)
  4. OIDC Auth / Redirect URL (where platform sends the browser after OIDC init)
  5. Deployment ID            (you can agree on any string, e.g. "modernlms-prod-1")
  6. Target Link URI          (their main launch URL)

Optional but confirm:
  7. Does it support Deep Linking 2.0? (if you want to let faculty browse/add content)
  8. Does it request AGS scopes? (lineitem, score, result.readonly)
  9. Does it request NRPS? (contextmembership.readonly)
```

---

### 2.3 How to register them in ModernLMS

Once you have their values, insert into Supabase:

```sql
-- 1. Insert registration
INSERT INTO lti_registrations (
  org_id, tool_name, issuer, client_id,
  auth_login_url, auth_token_url, jwks_url,
  target_link_uri, deep_link_return_url, status, metadata
)
VALUES (
  'YOUR_ORG_UUID',
  'Vendor Tool Name',
  'https://tool.vendor.com',                          -- their issuer
  'client-id-they-gave-you',
  'https://tool.vendor.com/lti/login',                -- their OIDC auth URL
  null,
  'https://tool.vendor.com/.well-known/jwks.json',   -- their JWKS
  'https://tool.vendor.com/lti/launch',              -- their launch URL
  'https://modernlms-lti-platform.<account>.workers.dev/lti/deep-link/return',
  'active',
  '{}'::jsonb
);

-- 2. Get the registration id
SELECT id FROM lti_registrations
WHERE client_id = 'client-id-they-gave-you'
ORDER BY created_at DESC LIMIT 1;

-- 3. Insert deployment (scope to a course for testing)
INSERT INTO lti_deployments (
  org_id, registration_id, deployment_id, scope_type, scope_ref,
  enable_deep_linking, enable_ags, enable_nrps, status
)
VALUES (
  'YOUR_ORG_UUID',
  'REGISTRATION_UUID',
  'modernlms-prod-1',        -- agreed deployment ID
  'course',
  'COURSE_UUID',
  true, true, true,
  'active'
);
```

---

### 2.4 What to tell the tool provider to test (iframe integration)

Send this as a test checklist to their integration engineer:

---

> **ModernLMS LTI 1.3 Integration Test Checklist**
>
> Platform OIDC Login URL: `https://modernlms-lti-platform.<account>.workers.dev/lti/oidc/login`
> Deployment ID: `modernlms-prod-1` (or whatever you agreed)
> Client ID: `<agreed client ID>`
>
> **Test 1 — Resource Launch in iframe**
> Trigger a resource launch from our platform. Your tool should receive a POST to your
> launch URL with `id_token` and `state`. The `id_token` JWT will contain:
> - `iss` = our platform issuer
> - `aud` = your client ID
> - `https://purl.imsglobal.org/spec/lti/claim/message_type` = `LtiResourceLinkRequest`
> - `https://purl.imsglobal.org/spec/lti/claim/context` with course ID and title
> - `https://purl.imsglobal.org/spec/lti/claim/roles` with learner/instructor roles
> Verify your tool renders correctly inside an iframe with no X-Frame-Options block.
>
> **Test 2 — Deep Linking (if supported)**
> Trigger a deep-link launch. Your tool should receive `LtiDeepLinkingRequest` and
> present a content picker. After selection, POST a `LtiDeepLinkingResponse` JWT to:
> `https://modernlms-lti-platform.<account>.workers.dev/lti/deep-link/return`
> Echo back the `data` value from `deep_linking_settings` exactly.
>
> **Test 3 — AGS Score Passback (if supported)**
> After a learner interaction, your tool should:
> 1. POST to the token endpoint with `client_credentials` + signed JWT (`aud` = token endpoint URL)
> 2. Create a line item under the AGS `lineitems` URL from the launch claims
> 3. POST a score to `{lineitem}/scores`
>
> **Test 4 — NRPS Roster (if supported)**
> GET the memberships URL from the launch claims with the access token.
> Expect `application/vnd.ims.lis.v2.membershipcontainer+json` back.

---

### 2.5 Debug checklist for failed partner launches

Run this query first:

```sql
SELECT created_at, status, error_code, error_detail, message_type, deployment_id
FROM lti_launches
ORDER BY created_at DESC
LIMIT 50;
```

Common errors and what they mean:

| `error_code` | Meaning |
|---|---|
| `jwt_verify_failed` | Tool's JWKS URL unreachable, or key mismatch, or wrong `iss`/`aud` |
| `registration_not_found` | `iss` + `client_id` not in `lti_registrations` |
| `invalid_deployment` | No active `lti_deployments` row for that registration + course |
| `nonce_invalid` / `state_invalid` | Tool replayed a request, or OIDC flow broken |
| `invalid_lti_version` | Tool sending LTI 1.1 or wrong version string |

Also check: is their JWKS URL reachable from the public internet (not behind a VPN)?

---

## 3) Operational notes

1. **Stable tunnel for internal testing:** Run `cloudflared tunnel login` and create a named tunnel so the URL doesn't rotate on every restart
2. **One permanent test org/course/deployment:** Keep a fixed test course UUID so you never need to re-insert deployments
3. **`LTI_PLATFORM_ISSUER` secret:** This is the only secret that must exactly match `PLATFORM_AGS_BASE` — double-check it after any domain change
4. **JTI replay prevention:** The platform tracks `jti` values in `lti_client_assertion_jti`. If you get replay errors in tests, the table may have stale entries; they expire automatically based on token `exp`

---

## 4) Quick status checklist

- [ ] Migration applied in Supabase
- [ ] Worker deployed, `/healthz` returns OK
- [ ] Platform JWKS returns keys at `/.well-known/jwks.json`
- [ ] `LTI_PLATFORM_ISSUER` secret matches deployed workers.dev URL exactly
- [ ] Test tool `.env` PLATFORM_* vars all point to workers.dev (not a tunnel)
- [ ] Test tool tunnel running, `TOOL_ISSUER` in `.env` matches tunnel URL
- [ ] Supabase registration `issuer` matches `TOOL_ISSUER`
- [ ] Supabase registration `auth_login_url` ends in `/auth-dispatch`
- [ ] Supabase registration `jwks_url` matches tunnel URL + `/.well-known/jwks.json`
- [ ] `/test-all` returns 16/16 PASS
- [ ] Resource launch shows `LtiResourceLinkRequest`
- [ ] Deep-link launch shows `Deep Linking Request Received` (NOT resource link)
- [ ] Emit deep links (after deep-link launch) shows `Deep link response accepted`
- [ ] Post grade shows score object
- [ ] Get roster shows members
