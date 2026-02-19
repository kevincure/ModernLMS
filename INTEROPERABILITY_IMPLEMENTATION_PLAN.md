# Interoperability Implementation Plan (Authoritative)

## Scope
This is the canonical implementation plan for standards interoperability in ModernLMS.

In scope:
1. **LTI 1.3 + LTI Advantage**
   - Deep Linking 2.0
   - Names and Roles Provisioning Services (NRPS) 2.0
   - Assignment and Grade Services (AGS) 2.0
2. **Standard SIS integration framework**
3. **OneRoster 1.2**
4. **Caliper 1.2**

Out of scope for this document:
- Non-standards vendor-specific custom APIs (unless wrapped by the adapter model in Section 7)
- UI polish details unrelated to interoperability behavior

---

## 1) Current Codebase Status (verified)

### 1.1 Present today
- Core LMS entities and CRUD behavior exist for courses, enrollments, assignments, submissions, grades, quizzes, files, etc. via client + Supabase.
- Authentication is Google OAuth through Supabase Auth.
- Gradebook CSV export exists (client-side export flow).
- Internal course-to-course content import modal exists (`openImportContentModal` / `executeImportContent`).
- A Supabase Edge function exists for Gemini usage.

### 1.2 Not present today
- No LTI endpoints (`/lti/login`, `/lti/launch`, `/lti/jwks`) and no LTI claim validation pipeline.
- No Deep Linking response signing flow.
- No NRPS membership service implementation.
- No AGS line items/results/scores implementation.
- No OneRoster 1.2 CSV or REST implementation.
- No Caliper 1.2 event envelope emitter/collector.

### 1.3 Verification note
A repository-wide search for `LTI`, `OneRoster`, `Caliper`, `NRPS`, and `AGS` returns planning-doc mentions only, not runtime implementation.

---

## 2) Critical Product Clarification Before Build

**Decision required:** Is ModernLMS implementing LTI as a **Tool**, **Platform**, or **both**?

- In common deployments:
  - LMS products are usually **Platforms** launching external tools.
  - AGS/NRPS are often exposed by the **Platform** to Tools.
  - Deep Linking requests are initiated by the **Platform** and responded to by a **Tool**.
- Your stated goal (“LTI 1.3 Platform status + Advantage”) implies Platform capability.

### Plan assumption used here
This plan implements **dual-role architecture**, but with **Platform-first delivery** because that aligns with an LMS product and your request.

---

## 3) Target Technical Architecture

## 3.1 New interop service boundary
Add a dedicated server-side Interop service (Edge functions + worker process or standalone service):
- Handles protocol endpoints and security.
- Owns token/key lifecycle.
- Handles async sync jobs and retries.
- Maintains source-to-local ID mapping.

Recommended local ports:
- Frontend app: `http://localhost:8000`
- Supabase local APIs: standard local stack
- Interop API service: `http://localhost:8787`
- Optional worker: `http://localhost:8788` (or queue consumer only)

## 3.2 Module layout
- `interop/lti/` (OIDC, launch, claims, deep linking, AGS, NRPS)
- `interop/sis/` (canonical schema + adapters)
- `interop/oneroster/` (csv/rest readers/writers)
- `interop/caliper/` (event mapper, envelope builder, transport)
- `interop/security/` (JWKs, JWT verify/sign, nonce/state store)
- `interop/jobs/` (queueing, retries, job logs)

## 3.3 Non-functional baselines
- All protocol operations logged with request IDs.
- All writes idempotent using stable external IDs + dedupe keys.
- All integrations tenant-scoped.

---

## 4) Database Additions (exact spec)

All tables include:
- `id UUID PK default gen_random_uuid()`
- `tenant_id UUID not null`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()` (triggered)

## 4.1 LTI registration + security tables
1. `interop_lti_registrations`
   - `tenant_id`
   - `direction` enum(`platform`,`tool`)
   - `issuer text not null`
   - `client_id text not null`
   - `deployment_id text not null`
   - `auth_login_url text`
   - `auth_token_url text`
   - `keyset_url text`
   - `jwks_cache_ttl_seconds int default 3600`
   - `enabled boolean default true`
   - unique `(tenant_id, issuer, client_id, deployment_id, direction)`

2. `interop_jwks_keys`
   - `tenant_id`
   - `use` enum(`sig`)
   - `alg text` (RS256 required initial)
   - `kid text not null`
   - `private_jwk jsonb` (encrypted at rest)
   - `public_jwk jsonb not null`
   - `status` enum(`active`,`retiring`,`retired`) default `active`
   - `not_before timestamptz`
   - `expires_at timestamptz`
   - unique `(tenant_id, kid)`

3. `interop_lti_nonce_state`
   - `tenant_id`
   - `nonce text`
   - `state text`
   - `issued_at timestamptz`
   - `consumed_at timestamptz`
   - index `(tenant_id, nonce)` + `(tenant_id, state)`

## 4.2 LTI mapping tables
4. `interop_lti_context_map`
   - `tenant_id`
   - `issuer`
   - `client_id`
   - `deployment_id`
   - `lti_context_id text`
   - `lti_context_label text`
   - `lti_context_title text`
   - `course_id uuid` (local)
   - unique `(tenant_id, issuer, client_id, deployment_id, lti_context_id)`

5. `interop_lti_resource_link_map`
   - `tenant_id`
   - `issuer`
   - `client_id`
   - `deployment_id`
   - `resource_link_id text`
   - `assignment_id uuid null`
   - `quiz_id uuid null`
   - unique `(tenant_id, issuer, client_id, deployment_id, resource_link_id)`

6. `interop_lti_line_items`
   - `tenant_id`
   - `issuer`
   - `client_id`
   - `deployment_id`
   - `context_map_id uuid`
   - `lineitem_url text`
   - `lineitem_id text`
   - `label text`
   - `score_max numeric`
   - `tag text`
   - `resource_id text`
   - `assignment_id uuid null`
   - `quiz_id uuid null`
   - unique `(tenant_id, issuer, client_id, deployment_id, lineitem_url)`

## 4.3 Canonical sync + mapping tables
7. `interop_id_map`
   - `tenant_id`
   - `source_system text` (`lti`,`sis`,`oneroster`,`caliper`)
   - `source_entity_type text` (`user`,`course`,`class`,`enrollment`,`lineitem`,...)
   - `source_id text`
   - `local_entity_type text`
   - `local_entity_id uuid`
   - `checksum text`
   - unique `(tenant_id, source_system, source_entity_type, source_id)`

8. `interop_sync_jobs`
   - `tenant_id`
   - `integration_type text` (`sis`,`oneroster`,`nrps`,`caliper_delivery`)
   - `mode text` (`full`,`incremental`,`dry_run`)
   - `status text` (`queued`,`running`,`succeeded`,`failed`,`partial`)
   - `started_at timestamptz`
   - `finished_at timestamptz`
   - `stats jsonb`

9. `interop_sync_errors`
   - `tenant_id`
   - `job_id uuid`
   - `source_row_ref text`
   - `error_code text`
   - `error_message text`
   - `payload jsonb`

## 4.4 Caliper tables
10. `interop_caliper_events`
   - `tenant_id`
   - `event_id text`
   - `event_time timestamptz`
   - `actor_ref text`
   - `action text`
   - `object_ref text`
   - `envelope jsonb`
   - `delivery_status text` (`pending`,`sent`,`failed`,`dead_letter`)
   - `attempt_count int default 0`
   - unique `(tenant_id, event_id)`

---

## 5) LTI 1.3 + Advantage Implementation Plan (VERY PRECISE)

## 5.1 Phase order for LTI
1. Core OIDC login + launch validation
2. Platform-side AGS endpoints
3. Platform-side NRPS endpoint
4. Tool-side Deep Linking response flow (if dual-role enabled)
5. Hardening and certification checks

## 5.2 Exact HTTP endpoints (Platform-first)

### 5.2.1 OIDC login initiation (Platform)
- `GET /api/lti/platform/login`

Required query params:
- `iss`
- `login_hint`
- `target_link_uri`
- `lti_message_hint` (optional)
- `client_id` (if required by partner)

Behavior:
1. Resolve registration by issuer/client_id.
2. Generate `state` and `nonce`, persist with TTL (10 min).
3. Redirect user-agent to partner auth endpoint with:
   - `response_type=id_token`
   - `response_mode=form_post`
   - `scope=openid`
   - `prompt=none`
   - `client_id`
   - `redirect_uri` (our launch URL)
   - `login_hint`
   - `nonce`
   - `state`
   - `lti_message_hint` passthrough when present.

Failure responses:
- 400 unknown issuer/client
- 400 missing required params
- 500 state persistence failure

### 5.2.2 Launch endpoint (Platform)
- `POST /api/lti/platform/launch`

Input:
- form field `id_token`
- form field `state`

Validation sequence (strict order):
1. Parse JWT header -> require `alg=RS256`, `kid` present.
2. Resolve registration by `iss`,`aud/client_id`,`deployment_id`.
3. Load partner JWKS (cached) and verify signature + `exp/iat` skew (±60s).
4. Verify `state` exists and unconsumed.
5. Verify `nonce` claim matches stored one-time value.
6. Verify required LTI claims:
   - `https://purl.imsglobal.org/spec/lti/claim/message_type`
   - `https://purl.imsglobal.org/spec/lti/claim/version`
   - `https://purl.imsglobal.org/spec/lti/claim/deployment_id`
   - `https://purl.imsglobal.org/spec/lti/claim/target_link_uri`
7. Reject replay by marking nonce consumed atomically.

Post-validation behavior:
- Upsert user identity mapping (`sub` + issuer/client/deployment tuple).
- Upsert/create context mapping to local course.
- Create app session and redirect:
  - Resource launch -> `/app?course={id}&lti=1`
  - Deep link launch -> `/lti/deep-link-picker?...`

### 5.2.3 JWKS endpoint (if acting as Tool or signing responses)
- `GET /api/lti/jwks.json`

Behavior:
- Return active and retiring public keys only.
- Include proper `kid`, `kty`, `n`, `e`, `alg`, `use`.

### 5.2.4 NRPS endpoint (Platform service)
- `GET /api/lti/nrps/contexts/{contextId}/memberships`

Auth:
- OAuth2 access token with scope:
  - `https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly`

Behavior:
- Validate token, tenant, registration binding.
- Return paginated memberships with `Link` headers (`rel="next"`) when needed.
- Normalize roles to IMS role URIs.

### 5.2.5 AGS endpoints (Platform service)
- `GET /api/lti/ags/contexts/{contextId}/lineitems`
- `POST /api/lti/ags/contexts/{contextId}/lineitems`
- `GET /api/lti/ags/lineitems/{lineitemId}`
- `PUT /api/lti/ags/lineitems/{lineitemId}`
- `DELETE /api/lti/ags/lineitems/{lineitemId}`
- `GET /api/lti/ags/lineitems/{lineitemId}/results`
- `POST /api/lti/ags/lineitems/{lineitemId}/scores`

Scope checks:
- lineitem read: `.../lineitem.readonly`
- lineitem write: `.../lineitem`
- result read: `.../result.readonly`
- score write: `.../score`

Score handling:
- `scoreGiven`, `scoreMaximum`, `activityProgress`, `gradingProgress`, `userId`, `timestamp`.
- Idempotency key from `(lineitemId,userId,timestamp)`.
- Write to local grade/submission model with source marker `source='lti_ags'`.

## 5.3 Deep Linking 2.0 (Tool-role path)

Endpoints:
- `POST /api/lti/tool/deep-link/launch`
- `POST /api/lti/tool/deep-link/respond`

Flow:
1. Validate deep-link launch token as in 5.2.2.
2. Render picker UI with internal resources.
3. User selects items -> service builds `content_items`.
4. Sign JWT response using our private key and post to `deep_link_return_url`.

Supported item types (initial):
- `ltiResourceLink`
- `link`

## 5.4 Claim mapping matrix (required)

Map claims to local model:
- `sub` -> user external principal key (`interop_id_map`)
- `name`,`given_name`,`family_name`,`email` -> profile fields (non-authoritative depending on policy)
- `context.id` -> course map key
- `resource_link.id` -> assignment/quiz map key
- `roles[]` -> local role (`instructor`,`ta`,`student`) using deterministic precedence

Role precedence when multiple roles provided:
1. Instructor
2. TeachingAssistant
3. Learner

## 5.5 Security hard requirements
- RS256 only in v1.
- No `none`/HS* acceptance.
- Strict `kid` matching; fail closed on JWKS ambiguity.
- Nonce/state TTL 10 minutes; single use enforced.
- Launch replay detection persisted in DB.
- Token clock skew max ±60s.
- Audit log every launch verdict (accepted/rejected reason).

## 5.6 Operational hard requirements
- JWKS cache with background refresh and emergency invalidate endpoint.
- Per-tenant rate limits for launch and AGS/NRPS endpoints.
- Structured logs with `tenant_id`, `registration_id`, `request_id`.

---

## 6) Best Localhost Testing Plan for LTI 1.3 + Advantage

This section is the executable local validation baseline.

## 6.1 Local components
- ModernLMS frontend at `localhost:8000`
- Interop API at `localhost:8787`
- Local DB + Supabase stack
- Optional tunnel (`ngrok http 8787`) for external sandbox callbacks

## 6.2 Test fixtures to create
- `fixtures/lti/registrations.json` (2 test tenants)
- `fixtures/lti/jwks_partner.json` (partner signing key)
- `fixtures/lti/launch_resource_valid.jwt`
- `fixtures/lti/launch_deeplink_valid.jwt`
- negative fixtures:
  - expired token
  - wrong audience
  - wrong deployment_id
  - nonce replay token

## 6.3 Automated test suites

### Unit tests
- JWT verifier rejects bad alg/kid/aud/exp.
- claim mapper resolves roles and context correctly.
- nonce/state repository enforces single-use.

### Integration tests
- `/login` produces redirect with expected params.
- `/launch` consumes state and creates local session.
- AGS score post mutates grade records.
- NRPS returns expected roster payload and pagination.

### Contract tests
- JSON schema validation of NRPS and AGS responses.
- Deep Linking response JWT shape and signed headers.

## 6.4 Manual localhost runbook (step-by-step)

1. Start stack:
   - frontend
   - interop API
   - DB
2. Seed registration + keys.
3. Simulate login init request with curl.
4. Simulate launch POST with valid `id_token`.
5. Confirm redirected session lands in intended course.
6. Request AGS lineitems and create one lineitem.
7. Post AGS score and confirm gradebook change.
8. Request NRPS memberships and verify role mapping.
9. Replay same launch token and confirm rejection.

## 6.5 Command-level smoke examples (expected to script)
- `curl -i "http://localhost:8787/api/lti/platform/login?..."` -> `302` redirect
- `curl -i -X POST http://localhost:8787/api/lti/platform/launch -d "id_token=...&state=..."` -> `302` app redirect
- `curl -i -H "Authorization: Bearer <token>" http://localhost:8787/api/lti/ags/contexts/<id>/lineitems` -> `200`
- `curl -i -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/vnd.ims.lis.v1.score+json" .../scores` -> `200/201`
- `curl -i -H "Authorization: Bearer <token>" .../memberships` -> `200`

## 6.6 Performance targets (local acceptance)
- Launch p95 < 500ms (excluding external redirect latency)
- AGS score POST p95 < 300ms for single score
- NRPS page fetch p95 < 400ms for page size 100

## 6.7 Security test checklist (must pass)
- replay (same nonce/state) blocked
- wrong `iss` blocked
- wrong `aud` blocked
- wrong `kid` blocked
- expired token blocked
- scope mismatch blocked for AGS/NRPS

---

## 7) SIS Integration Framework (detailed)

## 7.1 Canonical SIS data model
Canonical entities and required fields:
- User: external_id, email, given_name, family_name, status
- Org: external_id, name, type
- AcademicSession: external_id, title, start_date, end_date
- Course: external_id, title, course_code, org_id
- Class/Section: external_id, course_id, session_id
- Enrollment: external_id, class_id, user_id, role, status

## 7.2 Connector interface contract
Each adapter must implement:
- `validateConfig(config)`
- `discoverCapabilities()`
- `fetchSnapshot(cursor?)`
- `fetchDelta(sinceToken)`
- `normalize(record) -> canonical`
- `upsertBatch(canonicalRecords)`
- `exportBatch(entityType, cursor?)`

## 7.3 Sync engine behavior
- Supports `dry_run` diff preview.
- Batch size default 500.
- Retry policy: exponential backoff (5 attempts).
- Partial-failure mode writes successful rows and logs failures.
- Idempotency via `interop_id_map` + checksum change detection.

## 7.4 Admin operations
- Per-connector schedule (cron).
- “Run now” action.
- Last successful cursor token persisted.
- CSV error download for failed rows.

---

## 8) OneRoster 1.2 Plan (detailed)

## 8.1 Phase A: CSV package support
Import and export zipped CSV for:
- `users.csv`
- `orgs.csv`
- `courses.csv`
- `classes.csv`
- `enrollments.csv`
- `academicSessions.csv`

Validation rules:
- required headers must be exact
- all `sourcedId` values unique by file
- foreign key references must exist
- roles must map to supported internal enum

Commit mode:
- parse -> validate -> stage -> commit transaction by entity order:
  1. orgs
  2. sessions
  3. users
  4. courses
  5. classes
  6. enrollments

## 8.2 Phase B: REST 1.2 support
- OAuth2 bearer auth.
- `/ims/oneroster/v1p2/users` etc. client/publisher depending on deployment role.
- Pagination and filtering support (`limit`, `offset`, and vendor variants as adapter shims).

## 8.3 Testing
- golden CSV bundles (valid)
- mutation bundles (missing columns, bad refs, bad role)
- roundtrip export/import checksum validation

---

## 9) Caliper 1.2 Plan (detailed)

## 9.1 Event taxonomy to emit
- SessionEvent: login/logout
- NavigationEvent: course/module/item navigation
- AssessmentEvent: attempt started/submitted
- GradeEvent/Outcome-like mapping: grade posted/released

## 9.2 Event envelope requirements
Each event includes:
- `@context`
- `id`
- `type`
- `actor`
- `action`
- `object`
- `eventTime`
- `edApp`
- `group`/`membership` where available

## 9.3 Delivery pipeline
- Insert event in `interop_caliper_events` as `pending`.
- Background dispatcher sends to configured endpoint.
- Retry 1m, 5m, 15m, 60m.
- Move to `dead_letter` after max retries.

## 9.4 Privacy + governance
- Tenant-level event enable/disable toggles.
- Optional pseudonymous actor IDs.
- Retention policy default 90 days.

## 9.5 Testing
- schema validation tests for every event class
- transport retry tests with mocked 500 responses
- dead-letter transition tests

---

## 10) Consolidated delivery timeline

Milestone 0: Design freeze (1 week)
- Finalize LTI role decision and endpoint contracts.

Milestone 1: LTI core launch (2 weeks)
- `/login`, `/launch`, JWT verify, state/nonce replay protection.

Milestone 2: AGS + NRPS (2 weeks)
- lineitems/results/scores + memberships endpoint.

Milestone 3: Deep Linking (1 week)
- picker + signed deep-link response.

Milestone 4: SIS core framework (2 weeks)
- canonical adapters + sync engine + dry-run.

Milestone 5: OneRoster CSV + REST (2 weeks)
- CSV package first, REST next.

Milestone 6: Caliper pipeline (1 week)
- event mapping + emitter + retries.

Milestone 7: Hardening (1 week)
- load tests, security tests, runbooks.

---

## 11) Definition of Done
1. LTI launch success against localhost simulator and at least one real sandbox.
2. AGS score posts deterministically update local grade state.
3. NRPS membership responses align with roster and role mapping.
4. OneRoster CSV roundtrip passes referential integrity checks.
5. Caliper events validate against 1.2 schema and deliver with retries.
6. All required security checks pass (replay, issuer/audience, scope).

---

## 12) Supersession statement
This file supersedes interoperability planning fragments in other roadmap/implementation docs. Those docs should keep only concise references pointing here.
