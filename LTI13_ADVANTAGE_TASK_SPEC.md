# LTI 1.3 + LTI Advantage (DL 2.0, AGS 2.0, NRPS 2.0) — Exact Implementation Task Spec

**Document owner:** Platform Engineering  
**Repo baseline checked:** `/workspace/ModernLMS` (latest commit)  
**Goal:** Define the precise build plan to make ModernLMS a production LTI 1.3 **Platform** with Advantage services, using standard Python libraries (no custom crypto/JWT code).

---

## 0) Normative scope (what must be implemented)

Implement support for:
- **LTI Core 1.3** (Platform role)
- **LTI Deep Linking 2.0**
- **LTI Assignment & Grade Services (AGS) 2.0**
- **LTI Names and Role Provisioning Services (NRPS) 2.0**

Treat all “MUST” requirements from those specs as in-scope for MVP-interop compliance.  
For optional/advanced items, mark explicitly as deferred.

---

## 1) Current-state gap check (against this repository)

## 1.1 What exists now (relevant)
- LMS domain model exists for:
  - courses, enrollments, assignments, submissions, grades
  - profiles/orgs/org_members
- Frontend + Supabase-backed app exists (`app.js`, `database_interactions.js`, `auth.js`, `admin.js`).
- Google OAuth login is present (no org OIDC/SAML in this code path).
- Database structure doc (`CURRENT_DATABASE_STRUCTURE.md`) lists no LTI-specific tables.

## 1.2 What is missing for LTI Platform
- No LTI endpoint surface (OIDC login initiation, launch, JWKS, AGS, NRPS, deep-link return handlers).
- No LTI registration/deployment entities in DB.
- No key rotation workflow and key storage metadata.
- No launch validation pipeline (state/nonce/JWT claims checks).
- No AGS line-item/score mapping.
- No NRPS membership endpoint implementation.
- No deep linking request/response flow.
- No LTI diagnostics UI/log viewer.

**Conclusion:** LTI 1.3 + Advantage is currently **not implemented**; this is a net-new backend capability set.

---

## 2) Required implementation architecture

## 2.1 Runtime and libraries (Python)
Use standard libraries; do not hand-roll JWT/JWK/OIDC primitives.

Recommended stack:
- Web framework: **FastAPI**
- JWT/JWS/JWK/OIDC validation: **Authlib** (or PyJWT + jwcrypto + strict validators)
- LTI helper library: **PyLTI1p3** (where it fits), plus explicit checks for claims/policies
- HTTP client for JWKS fetch: **httpx**
- Retry utilities: **tenacity**
- DB: Postgres (existing Supabase Postgres)

Hard requirement:
- All cryptographic signing/verification and key formatting must use maintained libraries.

## 2.2 Service boundary
Create a dedicated backend service/module for LTI (separate from browser JS).  
Frontend should only call admin APIs for configuration and diagnostics.

---

## 3) Database tasks (exact schema work)

Create these tables (new):

1. `lti_registrations`
- `id (uuid pk)`
- `org_id (uuid fk orgs.id)`
- `issuer (text not null)`
- `client_id (text not null)`
- `tool_name (text not null)`
- `auth_login_url (text)`
- `auth_token_url (text)`
- `jwks_url (text)`
- `deployment_defaults (jsonb)`
- `status (text: active|inactive)`
- unique `(org_id, issuer, client_id)`

2. `lti_deployments`
- `id (uuid pk)`
- `org_id (uuid fk)`
- `registration_id (uuid fk lti_registrations.id)`
- `deployment_id (text not null)`
- `scope_type (text: org|department|course)`
- `scope_ref (text/uuid)`
- `enabled_services (jsonb)`  // deep_linking, ags, nrps toggles
- unique `(registration_id, deployment_id, scope_type, scope_ref)`

3. `lti_platform_keys`
- `id (uuid pk)`
- `org_id (uuid fk)`
- `kid (text unique not null)`
- `alg (text not null default 'RS256')`
- `public_jwk (jsonb not null)`
- `private_key_ref (text not null)` // KMS/secret manager pointer
- `status (text: active|next|retired)`
- `valid_from (timestamptz)`
- `valid_to (timestamptz)`

4. `lti_state_nonce`
- `id (uuid pk)`
- `org_id (uuid fk)`
- `state (text unique not null)`
- `nonce (text unique not null)`
- `registration_id (uuid fk)`
- `deployment_id (text)`
- `created_at`
- `expires_at`
- `consumed_at`

5. `lti_launches`
- `id (uuid pk)`
- `org_id`
- `registration_id`
- `deployment_id`
- `course_id`
- `user_id`
- `message_type`
- `version`
- `resource_link_id`
- `raw_claims (jsonb)`
- `status (success|failed)`
- `error_code`
- `error_detail`
- `correlation_id`
- timestamps

6. `lti_ags_line_items`
- `id (uuid pk)`
- `org_id`
- `course_id`
- `assignment_id (fk assignments.id nullable)`
- `registration_id`
- `deployment_id`
- `lineitem_url (text unique)`
- `label`
- `score_max (numeric)`
- `resource_id`
- `tag`
- `created_by_launch_id`

7. `lti_ags_scores`
- `id (uuid pk)`
- `org_id`
- `line_item_id (fk lti_ags_line_items.id)`
- `user_id (fk profiles.id)`
- `score_given`
- `score_max`
- `activity_progress`
- `grading_progress`
- `timestamp_from_tool`
- `raw_payload (jsonb)`

8. `lti_nrps_requests`
- request/response audit for membership calls

9. `lti_deep_link_items`
- records of deep-link returns and created LMS placements

10. `lti_key_rotation_events`
- operator, old_kid, new_kid, cutover time, result

RLS requirements:
- Strict org scoping on all LTI tables.
- Only org superadmins can manage registration/deployment/keys.
- Launch/transaction logs readable by org superadmin and platform ops.

---

## 4) API and endpoint tasks

## 4.1 Public/platform endpoints
Implement endpoints (paths can vary, semantics cannot):

1. `GET /.well-known/jwks.json`
- Return active + next public keys during rotation window.

2. `GET /lti/oidc/login`
- Accept OIDC login initiation parameters.
- Validate required params.
- Create state+nonce.
- Redirect to tool auth URL.

3. `POST /lti/launch`
- Receive `id_token`.
- Validate signature, issuer, audience, nonce, exp/iat.
- Validate LTI version/message type/deployment claim.
- Resolve user/course context.
- Route based on message type:
  - resource launch
  - deep linking request

4. `POST /lti/deep-link/return`
- Validate deep-link response JWT.
- Materialize selected content into course as assignment/module item/external link.

## 4.2 AGS endpoints
5. `GET /lti/ags/courses/{course_id}/lineitems`
6. `POST /lti/ags/courses/{course_id}/lineitems`
7. `GET /lti/ags/lineitems/{lineitem_id}`
8. `PUT /lti/ags/lineitems/{lineitem_id}`
9. `DELETE /lti/ags/lineitems/{lineitem_id}`
10. `POST /lti/ags/lineitems/{lineitem_id}/scores`
11. `GET /lti/ags/lineitems/{lineitem_id}/results`

Enforce AGS scope claims and course/deployment alignment.

## 4.3 NRPS endpoint
12. `GET /lti/nrps/courses/{course_id}/memberships`
- Return memberships container with pagination.
- Role mapping from internal enrollment roles to LTI roles.

---

## 5) Launch validation tasks (exact checklist)

For every launch, enforce:
1. JWT signature valid using tool key/JWKS.
2. `iss` matches registered issuer.
3. `aud` includes configured client_id.
4. `exp` and `iat` valid with bounded skew.
5. nonce exists, not expired, single-use.
6. state/nonce linked to registration/deployment.
7. `https://purl.imsglobal.org/spec/lti/claim/version == 1.3.0`.
8. message type one of allowed LTI message types.
9. deployment claim present and matched to configured deployment.
10. target link URI and redirect URI policy checks.

Failure behavior:
- Fail closed.
- Record structured error in `lti_launches`.
- Return actionable diagnostic code (non-sensitive).

---

## 6) Admin UI tasks (tool registration + diagnostics)

In admin portal (`admin.html`/`admin.js`), add LTI section with pages:

1. **Registrations**
- list/create/edit/deactivate registrations
- verify JWKS fetch and show key metadata

2. **Deployments**
- create deployment bindings per org/department/course
- toggle DL/AGS/NRPS services

3. **Key Management**
- view active/next/retired keys
- trigger rotation workflow
- schedule cutover

4. **Diagnostics**
- launch logs table with filters (status, date, tool, course)
- launch detail drawer with claim summary and validation results
- AGS transaction logs and NRPS request logs

RBAC:
- superadmin only for write actions.
- read-only role optional for support staff.

---

## 7) Key rotation workflow tasks

Implement managed workflow:
1. Generate new keypair in KMS/secure store.
2. Insert key as `next`.
3. Publish in JWKS along with `active`.
4. At cutover, set new key `active`, old key `retired`.
5. Keep retired key in JWKS for grace period.
6. Remove retired key after grace period.
7. Log all steps in `lti_key_rotation_events`.

Add safety checks:
- cannot retire last valid key.
- cannot cutover if next key missing/invalid.

---

## 8) AGS mapping tasks (internal gradebook integration)

Internal entities already exist (`assignments`, `submissions`, `grades`).

Required mapping work:
1. Associate LMS assignments with AGS line items.
2. On tool score POST, map to user + assignment context.
3. Store raw score payload and normalized score.
4. Apply grade update policy (configurable):
   - replace score
   - keep highest
   - ignore if manually locked
5. Expose AGS results from stored grade state.

Audit:
- each score write includes correlation ID and actor context.

---

## 9) NRPS mapping tasks

Map internal roles to LTI roles:
- instructor -> Instructor
- ta -> TeachingAssistant
- student -> Learner

For membership response:
- include only users in resolved course context.
- respect org/course privacy mode for name/email claims.

---

## 10) Deep Linking tasks

1. Build deep-link request launch path for instructors.
2. Validate deep-link return JWT.
3. For each returned item:
- validate content type and URL/resource metadata
- create LMS object (external tool link / assignment placeholder / module item)
4. Persist created objects in `lti_deep_link_items` for traceability.

---

## 11) Test and conformance tasks

## 11.1 Automated tests
- Unit tests for JWT/claim validators.
- Integration tests for:
  - valid launch
  - invalid issuer/audience/nonce
  - expired token
  - wrong deployment_id
- AGS tests for line item CRUD + score posting + results retrieval.
- NRPS tests for role mapping and pagination.
- Deep linking tests for accepted/rejected content items.

## 11.2 Manual conformance matrix
Create checklist document mapping each implemented behavior to:
- LTI Core requirement
- DL requirement
- AGS requirement
- NRPS requirement
- test case evidence link

Exit criterion:
- no unresolved MUST-level items in matrix.

---

## 12) Security and operations tasks

1. Secrets and keys
- private keys only in secret manager/KMS.
- never store raw private key in plaintext DB.

2. Replay and abuse protections
- nonce TTL and single-use enforcement
- request rate limiting on launch and service endpoints

3. Observability
- structured logs with correlation IDs
- metrics: launches total/success/failure by tool, AGS latency/error rate, NRPS latency/error rate

4. Data retention
- keep raw launch/AGS payloads for configurable retention period.

---

## 13) Incremental delivery plan

## Phase A — foundation (2–3 sprints)
- DB schema + migrations
- registration/deployment APIs
- JWKS endpoint
- OIDC login + launch validation core

## Phase B — Advantage services (2–3 sprints)
- AGS endpoints + grade mapping
- NRPS endpoint + role mapping
- deep linking request/return flow

## Phase C — admin operations (1–2 sprints)
- admin UI for registration/deployment/keys
- diagnostics + logs UI
- key rotation workflow UI

## Phase D — hardening (1–2 sprints)
- conformance matrix closure
- security tests and load tests
- operational runbooks

---

## 14) Exact backlog tasks (copy-ready)

1. Create LTI schema migration for 10 new tables and indexes.
2. Implement JWKS endpoint with active+next key publication.
3. Implement registration CRUD API with org-scoped RBAC.
4. Implement deployment CRUD API with scope resolution.
5. Implement OIDC login initiation endpoint (state/nonce issuance).
6. Implement launch endpoint with strict claim validation pipeline.
7. Implement deep linking response validator and LMS content materializer.
8. Implement AGS line-item CRUD endpoints + DB persistence.
9. Implement AGS score POST endpoint with gradebook mapping.
10. Implement AGS results endpoint from normalized grade data.
11. Implement NRPS memberships endpoint with pagination and role mapping.
12. Build key rotation service + scheduled cutover and grace retirement.
13. Add admin UI: registrations, deployments, keys, diagnostics.
14. Add structured diagnostics logs and correlation IDs across all LTI flows.
15. Add unit/integration test suites for all MUST-path and failure-path behaviors.
16. Produce conformance checklist doc with evidence links and unresolved items list.

---

## 15) Definition of done for “LTI 1.3 Platform ready”

All conditions must be true:
- LTI 1.3 launch works end-to-end with strict validation.
- Deep Linking, AGS, NRPS endpoints are implemented and tested.
- Key rotation workflow proven in staging without downtime.
- Admin can register tools, scope deployments, and troubleshoot launch failures.
- Conformance matrix contains no open MUST-level gaps.
- Security review passes (key handling, replay protection, RBAC, audit logs).

---


## 16) Canonical field mapping: spec names -> current ModernLMS DB names

This section maps LTI/Advantage data concepts to existing tables in `CURRENT_DATABASE_STRUCTURE.md` and identifies gaps.

### 16.1 NRPS (rostering/memberships) mapping

| LTI NRPS concept | Spec field examples | ModernLMS source | Notes |
|---|---|---|---|
| Context (course) | `context.id`, `context.label`, `context.title` | `courses.id`, `courses.code`, `courses.name` | Direct mapping |
| Membership user id | `user_id` | `profiles.id` | Use stable UUID as subject key |
| Membership status | `status` | `enrollments` row existence + active semantics | Add explicit inactive handling policy |
| Membership roles | `roles[]` | `enrollments.role` (`instructor`,`ta`,`student`) | Map to LTI roles (Instructor/TeachingAssistant/Learner) |
| Person name | `name`, `given_name`, `family_name` | `profiles.name` (single field) | If split names required, derive or add columns |
| Person email | `email` | `profiles.email` | Apply privacy controls per deployment |
| Org/course scope | membership container URL scope | `orgs` + `courses` + `enrollments` | Enforce org isolation + deployment scope |

**NRPS DB readiness:**
- ✅ Core roster entities exist (`courses`, `profiles`, `enrollments`).
- ⚠️ Missing protocol/audit/config entities (`lti_deployments`, `lti_nrps_requests`, state/nonce, registration metadata).

### 16.2 AGS (gradebook) mapping

| LTI AGS concept | Spec field examples | ModernLMS source | Notes |
|---|---|---|---|
| Line item | `id`, `label`, `scoreMaximum`, `resourceId`, `tag` | `assignments` (+ new `lti_ags_line_items`) | Existing `assignments.points` -> `scoreMaximum` |
| Result user | `userId` | `profiles.id` | Must resolve via course enrollment |
| Score payload | `scoreGiven`, `scoreMaximum`, `activityProgress`, `gradingProgress`, `timestamp` | `grades.score`, `assignments.points`, `grades.graded_at` + new `lti_ags_scores.raw_payload` | Keep raw payload for audit/debug |
| Submission reference | `result` linkage | `submissions.id` + `grades.submission_id` | Map when assignment is submission-backed |
| Grade release state | tool/platform status | `grades.released` | Define policy for unreleased grades |
| Course context | line item container scope | `courses.id` | Validate deployment->course alignment |

**AGS DB readiness:**
- ✅ Core grading entities exist (`assignments`, `submissions`, `grades`, `grade_categories`, `grade_settings`).
- ⚠️ Missing LTI protocol mapping/audit tables (`lti_ags_line_items`, `lti_ags_scores`, launch logs).

### 16.3 Deep Linking 2.0 mapping

| LTI DL concept | Spec field examples | ModernLMS destination | Notes |
|---|---|---|---|
| Deep link return envelope | JWT with content items | new `lti_deep_link_items` + `lti_launches` | Persist original response metadata |
| LTI link item | `type=ltiResourceLink`, title, url/custom params | `module_items` (external_link), optional `assignments` placeholder | Keep launch URL + custom params in metadata JSON |
| File/link placement | content item metadata | `files` or `module_items` | Depends on item type |
| Course placement scope | deployment/context | `courses.id`, `modules.id` | Respect deployment scope restrictions |
| Created-by traceability | message claims | `created_by` fields + `lti_deep_link_items` | Required for diagnostics |

**Deep Linking DB readiness:**
- ✅ Destination entities exist (`modules`, `module_items`, `assignments`, `files`).
- ⚠️ Missing DL transaction/audit entities (`lti_deep_link_items`, launch claim storage).

### 16.4 OneRoster-aligned internal mapping (for your parallel interoperability track)

Although OneRoster implementation is outside this LTI-only doc, your current DB maps well to SIS entities:

| OneRoster concept | ModernLMS table |
|---|---|
| org | `orgs` |
| user | `profiles` |
| enrollment | `enrollments` + `org_members` |
| class/course | `courses` |
| result/grade | `grades` + `assignments` + `submissions` |
| term/session | `courses.term` (minimum), may need normalized term table later |

**OneRoster readiness note:** core entities exist, but production sync still needs connector/job metadata tables and reconciliation artifacts.

### 16.5 Final readiness verdict: can current DB handle everything needed?

- **For core academic objects (roster, course, assignments, grades, module placements):** **Yes** — existing schema is a strong base.
- **For LTI 1.3 + Advantage protocol compliance, diagnostics, and operations:** **No, not yet** — you must add the LTI-specific tables listed in Section 3.
- **For OneRoster operational sync quality (retry/reconcile/run history):** **No, not yet** — add integration run/state tables in the OneRoster implementation spec.

So the correct implementation stance is:
1. Reuse current domain tables for business data.
2. Add LTI protocol/config/audit tables for standards compliance and supportability.
3. Add interoperability job/run tables for roster/grade sync reliability.


## Appendix A — repository evidence used in this gap check
- `CURRENT_DATABASE_STRUCTURE.md`: no LTI registration/deployment/key/launch tables listed.
- `auth.js`: Google OAuth sign-in flow present; no LTI launch auth processing.
- `admin.js`/`admin.html`: no LTI admin registration/deployment/diagnostics interfaces.
- `database_interactions.js`: no LTI endpoint/service integration calls.
- `app.js`: no LTI launch/service handling paths.

