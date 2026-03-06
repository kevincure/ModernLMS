# Local LTI Test Tool (actual runnable implementation)

This folder includes runnable code at `src/server.js` that can:
1. Start an LTI resource launch (OIDC flow)
2. Start an LTI deep-link launch
3. Emit deep-link items (link, ltiResourceLink, file)
4. Create AGS lineitem + post score
5. Call NRPS memberships endpoint
6. Run 25 automated spec-compliance checks via `/test-all`

## 1) Install
```bash
cd cloudflare/lti-test-tool
npm install
cp .env.example .env
```

## 2) Fill `.env`
Required values:
- `TOOL_CLIENT_ID` and `TOOL_DEPLOYMENT_ID` must match your platform registration/deployment row
- `TOOL_PRIVATE_JWK_JSON` must be the private key matching your tool JWKS
- `PLATFORM_LOGIN_URL`, `PLATFORM_LAUNCH_URL`, `PLATFORM_AGS_BASE`, `PLATFORM_NRPS_BASE` must point to your deployed worker

## 3) Run
```bash
npm start
```
Open `http://localhost:8788`.

## 4) Suggested setup sequence
1. In Supabase, register this tool issuer/client id in `lti_registrations`.
2. Insert a deployment row in `lti_deployments` with matching `deployment_id`.
3. Start test tool and click `Start resource launch`.
4. Confirm platform page shows `LTI launch ok`.
5. Click `Start deep-link launch`, then in tool UI choose `Emit deep links`.
6. Click `Post grade 8/10`.
7. Click `Get roster (NRPS)`.

## 5) SQL checks
```sql
select created_at, status, message_type, error_code
from lti_launches
order by created_at desc limit 20;

select created_at, content_title, content_item_type
from lti_deep_link_items
order by created_at desc limit 20;

select created_at, score_given, score_max, user_id
from lti_ags_scores
order by created_at desc limit 20;

select * from lti_ags_line_items order by created_at desc limit 20;
```

## 6) Automated test coverage (`/test-all`)

The 25 checks cover:
- **Token endpoint (3):** Happy path, missing jti rejected, jti replay rejected
- **AGS line items (5):** Content types, URL-format IDs, spec fields, container type, tag filter
- **AGS scores (3):** 204 response, gradingProgress validation, wrong Content-Type rejected
- **AGS results (4):** Content type, spec format, comment field, pagination Link header, wrong Accept rejected
- **NRPS (6):** Content type, response structure, dual roles, role filter, since filter, wrong Accept rejected
- **Platform (3):** JWKS endpoint, OpenID configuration (with all scopes), healthz

## 7) Known assumptions
- Uses UUIDs from `.env` for org/course/user — must match real Supabase data.
- The deep-link flow uses in-memory state (`pendingDlData`) so "Start Deep Link Launch" must precede "Emit Deep Links" in the same server session.
