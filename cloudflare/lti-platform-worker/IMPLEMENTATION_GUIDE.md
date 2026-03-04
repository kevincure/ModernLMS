# Cloudflare + Supabase LTI Platform: full setup + run

This folder now contains executable Worker code (`src/index.ts`) for:
- LTI Core launch endpoints
- Deep-link return endpoint
- AGS lineitems/scores/results endpoints
- NRPS memberships endpoint
- JWKS endpoint

## 1) Prerequisites
- Supabase project
- Cloudflare account + Wrangler CLI
- Domain/subdomain for platform endpoint (e.g. `lti.yourlms.com`)

## 2) Apply database migration
Run the SQL in:
- `supabase/migrations/20260304_lti13_platform.sql`

## 3) Install + configure Worker
```bash
cd cloudflare/lti-platform-worker
npm install
```

Create secrets:
```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put LTI_PLATFORM_ISSUER
wrangler secret put LTI_PRIVATE_JWK_ACTIVE_JSON
# optional during rotation
wrangler secret put LTI_PRIVATE_JWK_NEXT_JSON
```

`LTI_PRIVATE_JWK_ACTIVE_JSON` should be a full RSA private JWK (JSON string).

## 4) Deploy
```bash
npm run deploy
```

Endpoints after deploy:
- `GET /.well-known/jwks.json`
- `GET /lti/oidc/login`
- `POST /lti/launch`
- `POST /lti/deep-link/return`
- `GET|POST /lti/ags/courses/:courseId/lineitems`
- `GET|PUT|DELETE /lti/ags/lineitems/:lineItemId`
- `POST /lti/ags/lineitems/:lineItemId/scores`
- `GET /lti/ags/lineitems/:lineItemId/results`
- `GET /lti/nrps/courses/:courseId/memberships`

## 5) Register one test tool row in Supabase
Insert into `lti_registrations` and `lti_deployments`:
- issuer: tool issuer (e.g. `http://localhost:8788`)
- client_id: shared test client id
- auth_login_url: tool OIDC auth/login endpoint (or launch helper)
- jwks_url: tool public JWKS endpoint
- deployment_id: fixed deployment id used by tool

## 6) Key generation quick command (Node)
```bash
node -e "import('jose').then(async ({generateKeyPair,exportJWK})=>{const {privateKey,publicKey}=await generateKeyPair('RS256');console.log(JSON.stringify(await exportJWK(privateKey)));console.error(JSON.stringify(await exportJWK(publicKey)));})"
```
- Private JWK -> Cloudflare secret
- Public JWK -> `lti_platform_keys.public_jwk`

## 7) Important production notes
- Current worker is a complete baseline but still needs:
  - authz scopes per AGS/NRPS request
  - richer course/org resolution from claims
  - stronger deep-link materialization logic
  - stricter write authorization for AGS score writes
- Keep private keys in secrets only.
