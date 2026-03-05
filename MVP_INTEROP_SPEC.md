# ModernLMS MVP Interoperability + Enterprise Readiness Spec

**Version:** 1.0  
**Audience:** Product, Engineering, Security, Solutions Engineering, Customer Success  
**Scope basis:** Founder requirements items 1–19 (this doc is the implementation blueprint)

---

## 0) Commercial & Packaging Model

### 0.1 Packaging tiers
- **Self-hosted (free):** Core LMS features, interoperability features, standards import/export tooling, SSO connectors, OneRoster pipelines, admin analytics.
- **Hosted SaaS (paid):** Same core as self-hosted, managed operations and support, priced at **50% below benchmark LMS hosted pricing**.
- **AI seat license (add-on):** Per-seat licensing for AI features (AlldayTA). AI entitlement is org-level feature-flagged and contract-governed.

### 0.2 Non-goals (for now)
- AI usage-based billing/metering for invoicing (contractual licensing only).
- Direct outbound SMTP delivery from ModernLMS for institutional student notifications (institution-owned delivery).

---

## 1) LTI 1.3 Platform + LTI Advantage (Deep Linking, AGS, NRPS)

## 1.1 Required standards support
Implement **LTI Platform** capabilities for:
- LTI 1.3 Core launches (OIDC login initiation, auth response, id_token validation)
- Advantage services:
  - **Deep Linking 2.0**
  - **Assignment & Grade Services (AGS) 2.0**
  - **Names & Role Provisioning Services (NRPS) 2.0**

## 1.2 Functional requirements
### A. Tool registration UI (admin)
- Create/edit/delete external tools per org.
- Required fields:
  - Tool name, issuer, client_id, login initiation URL, redirect URIs
  - JWKS URL or uploaded public key
  - Allowed deployment scopes (org-wide, department, course)
  - Advantage toggles (Deep Linking, AGS, NRPS)
  - Privacy mode (public profile / anonymous)
- Validation:
  - URI format validation
  - Duplicate client_id checks per org
  - Key format checks

### B. Deployment scoping
- Deploy registered tools at:
  - Org scope
  - Department/course-group scope
  - Course scope
- Effective scope resolution order:
  1) Course override
  2) Department override
  3) Org default

### C. Key rotation workflow
- Maintain active + next signing keys.
- JWKS endpoint publishes both during rotation window.
- Rotation steps:
  1) Generate next key pair
  2) Publish next key in JWKS
  3) Flip active key at scheduled cutover
  4) Keep old key during grace period
  5) Retire old key
- Track rotation events in audit log.

### D. Launch processing
- Validate issuer, audience/client_id, nonce, state, exp/iat.
- Validate signature using tool key/JWKS.
- Validate deployment_id and resource link context.
- Map claims to user+course context with org isolation.

### E. AGS support
- Create line items for gradable LTI resources.
- Receive and persist score passback.
- Return results when tool requests read access.
- Grade sync conflict policy:
  - Last-writer-wins OR configured source-of-truth by course.

### F. NRPS support
- Provide course membership roster with roles.
- Support pagination and role mapping.
- Respect privacy settings and least-privilege access.

### G. Deep Linking support
- Support instructor content selection from tool.
- Accept deep-link response JWT and create LMS resource placement.
- Validate content-item payload and title/url/resource metadata.

### H. Diagnostics & troubleshooting
Admin LTI diagnostics panel must show:
- Last 50 launches with status and error reason
- JWT claim viewer (redacted sensitive claims)
- Validation failures (nonce, signature, issuer mismatch)
- AGS request/response status for grade operations
- NRPS call logs and role mapping results
- Correlation ID per transaction

## 1.3 API/data model additions
- `lti_tools`
- `lti_deployments`
- `lti_keys`
- `lti_launch_logs`
- `lti_ags_line_items`
- `lti_ags_scores`
- `lti_nrps_requests`

## 1.4 Acceptance criteria
- Pass core LTI 1.3 launch test matrix.
- Deep Linking creates usable placements in courses.
- AGS line item + score passback verified in integration tests.
- NRPS roster retrieval validated with role accuracy.
- Key rotation performed in staging without launch outage.

---

## 2) Org-specific OIDC + SAML 2.0 + Google auth

## 2.1 Identity provider model
Support per-org authentication strategies:
- Google OAuth (existing)
- OIDC enterprise IdP
- SAML 2.0 enterprise IdP

## 2.2 Requirements
- Org admin can configure one or multiple IdPs.
- Domain routing or org slug routing to correct login options.
- JIT provisioning policy options:
  - Just-in-time account creation allowed/blocked
  - Role assignment default for new users
- Account linking:
  - Existing profile link via verified email / immutable external subject
- SSO fallback logic:
  - If org IdP unavailable, controlled fallback to Google/local policy

## 2.3 Security requirements
- Signed SAML assertions validation
- OIDC issuer/audience/signature validation
- Replay protection, nonce/state handling
- Clock skew tolerance policy
- Cert/key rotation support for each org IdP

## 2.4 Data model additions
- `org_identity_providers`
- `org_auth_policies`
- `auth_login_audit`
- `external_identities`

## 2.5 Acceptance criteria
- End-to-end login works for Google, OIDC, SAML per org.
- Org can force-only enterprise IdP login.
- Cert/key rotation can be applied without lockout.

---

## 3) Common Cartridge 1.4 + QTI 3.0 import/export (server-managed)

## 3.1 Scope
Build **server-side** import/export and validation pipeline for:
- Common Cartridge 1.4 (course package)
- QTI 3.0 (assessment content)

## 3.2 Export requirements
- Export selectable course scope:
  - Full course
  - Date-ranged content
  - Module subset
- Include where supported:
  - Modules, pages/content, files, links, assignments metadata, quizzes/tests (QTI payload), rubrics metadata (where representable)
- Produce package manifest and checksums.
- Emit compatibility report listing:
  - fully exported
  - partially exported
  - unsupported elements

## 3.3 Import requirements
- Upload package to server, queue import job.
- Parse/validate manifest and package structure.
- Dry-run mode before commit:
  - detect unsupported or lossy mappings
  - duplicate handling strategy
- Import modes:
  - create new course
  - merge into existing course
- Conflict policies:
  - rename duplicates
  - overwrite by explicit admin setting

## 3.4 Validation requirements
- Schema and structural checks for CC/QTI packages.
- Semantic validation:
  - broken links
  - missing files
  - invalid references
- Per-run validation report persisted.

## 3.5 Data model/job artifacts
- `interop_packages`
- `interop_validations`
- `interop_mappings`
- `interop_import_runs`
- `interop_export_runs`

## 3.6 Acceptance criteria
- Successful import/export of reference corpus packages.
- Deterministic validation reports.
- No browser-only package processing paths.

---

## 4) OneRoster 1.2 for rostering + gradebook sync

## 4.1 Integration modes
- **CSV mode** (scheduled import/export)
- **REST mode** (API integration)

## 4.2 Entities in scope
- Organizations
- Users
- Courses/classes
- Enrollments
- Academic sessions/terms
- Results/grades

## 4.3 Sync direction
- Rostering: SIS -> LMS
- Gradebook sync: LMS -> SIS (configurable)
- Optional inbound grade updates if institution requires

## 4.4 Reconciliation & conflict handling
- Source-of-truth policy per data domain:
  - identity (IdP)
  - enrollment/class structure (SIS/OneRoster)
  - grades (course policy)
- Drift reporting:
  - unknown users
  - missing classes
  - orphan enrollments
  - grade push failures

## 4.5 Connector config (admin)
- Connection profile fields:
  - mode (CSV/REST)
  - endpoint/bucket config
  - credentials
  - schedule
  - scope filters (term, department)
- Test connection + sample fetch preview.

## 4.6 Acceptance criteria
- Initial full roster load + incremental updates succeed.
- Gradebook passback verified for representative grading events.
- Sync run reports and drift reports available in admin UI.

---

## 5) Durable server-side interoperability jobs (run history, retries, reruns)

> Founder clarification: primary interoperability focus is OneRoster + SSO (plus standards import/export where enabled).

## 5.1 Job platform requirements
- Queue-backed async execution.
- Durable state machine:
  - queued, running, retrying, succeeded, failed, cancelled
- Retry policy per job type (exponential backoff + max attempts).
- Idempotency key per logical operation.
- Dead-letter queue for terminal failures.

## 5.2 Run history & logs
- Persist run metadata:
  - job type, org, initiator, started/ended timestamps
  - attempt count, status, correlation ID
  - summary stats and artifacts
- Structured logs with searchable fields.
- Downloadable run report (JSON/CSV).

## 5.3 Rerun controls
- Rerun from previous config.
- Rerun failed subset only.
- Cancel in-flight jobs where safe.

## 5.4 UI requirements
Admin panel pages:
- Integrations overview
- Job runs list (filter by type/status/date)
- Run detail page (timeline + errors + artifacts)
- Retry/rerun action buttons (RBAC-gated)

## 5.5 Acceptance criteria
- Job retries behave deterministically.
- Duplicate reruns do not duplicate side effects.
- Operators can identify and reprocess failed records quickly.

---

## 6) Notifications -> university-managed email policy

## 6.1 Product model
- LMS generates notification events and deep links.
- University controls whether/how events become email.
- ModernLMS does **not** directly send student email in MVP.

## 6.2 Required outputs
- Notification webhook/event feed with payload:
  - org_id, user_id, event_type, object_ref, title, body, deep_link, timestamp
- Event catalog (announcement, assignment posted, due-soon, grade released, discussion reply, etc.)
- User preference fields captured in LMS for eligibility decisions.

## 6.3 Admin controls
- Map event types to export policy (enabled/disabled)
- Include/exclude role groups
- Link template controls (course links, object links)

## 6.4 Acceptance criteria
- University endpoint receives correctly signed event payloads.
- Links in payload route user to exact in-app destination.

---

## 7) Subscribable calendar iCal feed

## 7.1 Requirements
- Provide per-user and per-course ICS feed URLs.
- Tokenized feed URLs with revocation/rotation.
- Event coverage:
  - assignments due dates
  - quiz/exam windows
  - course calendar events
- Timezone-correct output.

## 7.2 Acceptance criteria
- Feed works in Google Calendar/Outlook/Apple Calendar.
- Token revocation invalidates old URL immediately.

---

## 8) AlldayTA AI native integration (assume core AI already built)

## 8.1 In-scope glue work
- Ensure native LMS surfaces call existing AI service paths.
- RBAC and org feature flag enforcement already in place.
- Integrate AI outputs with assignments, quizzes, grading, file context.

## 8.2 Acceptance criteria
- AI features accessible only when org flag allows.
- Existing AlldayTA outcomes visible in LMS workflows.

---

## 9) In-app audio recording/upload/post + transcription

## 9.1 Requirements
- Browser audio recording UI (start/pause/stop/re-record).
- Upload pipeline to file storage.
- Attach audio to discussion posts/submissions/messages.
- Async transcription job with status states.
- Transcript editing and moderation controls.

## 9.2 Acceptance criteria
- Audio playable in app.
- Transcript appears after processing with retry on transient failure.

---

## 10) Standards ingestion/export server-managed only

## 10.1 Requirements
- Disable client-only parsing/processing for standards packages.
- Browser only uploads/downloads and polls job status.
- Validation and mapping execute server-side jobs.

## 10.2 Acceptance criteria
- All CC/QTI processing occurs in server logs/job history.

---

## 11) Operational SLO features

## 11.1 Backup/restore
- Scheduled backups with retention policy.
- Backup verification checks.
- Documented restore runbook and periodic restore drill.

## 11.2 Migration safety
- Migration preflight checks.
- Roll-forward/rollback scripts.
- Change freeze windows during high-risk periods.

## 11.3 Incident visibility
- Status page with component-level health.
- Incident timeline, severity, owner, and postmortem links.

## 11.4 Acceptance criteria
- Defined RPO/RTO targets met in staged drills.

---

## 12) Repository plugins for file selection

## 12.1 Plugin framework
- Plugin interface for connectors:
  - Local server files
  - URL fetch
  - Google Drive / OneDrive / Dropbox
  - Institution-managed repositories
- Admin enable/disable per repository type and org.

## 12.2 Policy controls
- Allowed repositories by org.
- File size/type constraints.
- Domain allowlist for URL ingestion.
- Data handling constraints by repository type.

## 12.3 Acceptance criteria
- Admin can enforce repository policy without code changes.

---

## 13) Change management documentation package

Deliver these documents (versioned, customer-ready templates):
1. Pilot plan (scope, success criteria, timeline)
2. Integration checklist (SSO, SIS, roster sync, grade passback)
3. Role-based training guides (admin/instructor/TA/student)
4. Cutover plan (term boundaries, rollback path)
5. Adoption KPI definitions and tracking cadence
6. Governance cadence plan (weekly launch, quarterly review)

Acceptance criteria: docs complete, reviewed, and reusable per institution.

---

## 14) SLA + institutional analytics package (admin)

## 14.1 Required analytics outputs
- Institution-level summary report
- Engagement trends (participation, late submissions, risk indicators)
- Course/program comparisons
- Intervention tracking outcomes
- Export/API for research/accreditation workflows

## 14.2 Delivery requirements
- Scheduled report generation
- Download (CSV/XLSX/PDF where applicable)
- API endpoints for institutional BI ingestion

## 14.3 Acceptance criteria
- Reports align with defined metric dictionary (Section 18).

---

## 15) Full org isolation

Status from founder: base DB isolation already implemented (separate DBs/self-host path).  
Required follow-through:
- Validate no cross-org access at app/API/worker layers.
- Include integration tests for org boundary enforcement.
- Verify per-org key/config segregation for SSO and OneRoster credentials.

---

## 16) Policy & compliance package

## 16.1 Required policy artifacts
- FERPA posture statement and controls map
- DPA terms template
- Retention/deletion policy
- Data residency stance and options
- Encryption and key management policy
- Subprocessors list + update process
- AI policy (training data use, model behavior boundaries, human oversight)

## 16.2 Operationalization
- Policies linked to enforceable system controls.
- Evidence collection checklist for security review/procurement.

---

## 17) Nice-to-have roadmap items

Track as post-MVP epics:
- Item-specific grading analytics improvements
- Attendance tracking option
- Peer review workflow
- Conditional release/learning paths by module/assignment rules

---

## 18) Metric dictionary (admin analytics contract)

Create a single governed metric dictionary with:
- Metric name
- Definition
- SQL/event logic
- Grain (course/org/user/day)
- Owner
- Refresh cadence
- Caveats

Minimum required metrics:
- Active instructors
- Active students
- Submission rate
- On-time vs late submission rate
- Grade release latency
- Discussion participation rate
- At-risk student indicator definition
- AI seat utilization
- Support ticket trend linkage field

Acceptance criteria: every admin report metric maps to dictionary entry.

---

## 19) Plugin security details

## 19.1 Security controls
- OAuth token encryption at rest
- Scope minimization per plugin
- Secret rotation support
- Malware scanning integration hook
- MIME/type and file size validation
- Content quarantine flow for suspicious files
- Access logging for import actions

## 19.2 Governance controls
- Admin policy console for plugin permissions
- Connector risk tier labels
- Per-plugin audit events
- Emergency global disable switch

Acceptance criteria: security review signoff for each connector before GA.

---

## Delivery plan (prioritized)

### Phase 1 (MVP critical)
1. LTI 1.3 + Advantage + tooling ops (Section 1)
2. Org-specific OIDC/SAML + Google federation (Section 2)
3. OneRoster rostering + gradebook sync (Section 4)
4. Durable job framework for interoperability + standards flows (Section 5)
5. Server-managed standards ingestion/export baseline (Sections 3 + 10)

### Phase 2 (pilot hardening)
6. Notifications event handoff to university email policy (Section 6)
7. iCal subscriptions (Section 7)
8. Audio + transcription (Section 9)
9. SLO operationalization (Section 11)

### Phase 3 (enterprise readiness)
10. Repo plugins + security hardening (Sections 12 + 19)
11. Change management package (Section 13)
12. SLA analytics + metric dictionary completion (Sections 14 + 18)
13. Policy evidence and compliance docs (Section 16)

### Phase 4 (post-MVP)
14. Nice-to-have pedagogical features (Section 17)

---

## Engineering definition of done (global)
For each section above, completion requires:
1. Functional implementation
2. Admin/user UI where applicable
3. API contract + schema documentation
4. Audit logging and RBAC checks
5. Integration tests and failure-path tests
6. Operational runbook (support + incident handling)
7. Customer-facing documentation updates

