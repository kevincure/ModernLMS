# University LMS interoperability standards shortlist 

These are the standards we need to hit. We will create checklists and confirm for every component here.

---

## A. LTI (integrations) — target: LTI 1.3 + “LTI Advantage” services

### A1) **Learning Tools Interoperability® (LTI®) Core Specification v1.3**
**What it is:** The core launch + security model for integrating external tools into an LMS (OIDC + OAuth2/JWT-based).  
**You want to hit:** *Platform* (your LMS) support for LTI 1.3 launches
**Spec (Core):**
- LTI 1.3 spec: https://www.imsglobal.org/spec/lti/v1p3

Helpful companion pages:
- 1EdTech LTI overview hub: https://www.1edtech.org/standards/lti
- LTI Advantage certification procedures (useful for “what does it mean to be certified”): https://www.imsglobal.org/spec/lti/v1p3/cert

---

### A2) **LTI Advantage**

#### A2.1) **Learning Tools Interoperability® (LTI®) Deep Linking 2.0**
**What it is:** Lets instructors pick content/placements from a tool (content-item selection) and return a configured link back into the LMS.  
**Spec:**
- Deep Linking 2.0: https://www.imsglobal.org/spec/lti-dl/v2p0

#### A2.2) **Learning Tools Interoperability® (LTI®) Assignment and Grade Services (AGS) v2.0**
**What it is:** Gradebook column (line item) creation + score/grade passback + results.  
**Spec:**
- AGS v2.0: https://www.imsglobal.org/spec/lti-ags/v2p0

#### A2.3) **Learning Tools Interoperability® (LTI®) Names and Role Provisioning Services (NRPS) v2.0**
**What it is:** Roster/role access for a context (course/section), including role claims and membership-style lists.  
**Spec:**
- NRPS v2.0: https://www.imsglobal.org/spec/lti-nrps/v2p0

**Naming note:** Some pages also use “Names and Role Provisioning Services v2.0” / “Names and Roles…”; the canonical spec URL above is *lti-nrps v2p0*.

---

## B. Course export / import — target: Common Cartridge 1.4

### B1) **Common Cartridge® v1.4**
**What it is:** A standardized package format to export/import course content (and associated metadata/links) between systems.  
**You want to hit:** Import + export of CC 1.4 packages (at least the subset relevant to your product).

**Key docs:**
- Common Cartridge 1.4 Implementation Guide: https://www.imsglobal.org/spec/cc/v1p4/impl
- (Referenced from the impl guide) Common Cartridge 1.4 main spec landing: https://www.imsglobal.org/spec/v1p4/
- CC 1.4 overview & migration guide: https://www.imsglobal.org/cc/ccv1p4/overview/
- 1EdTech CC standard overview page: https://www.1edtech.org/standards/cc

**Pragmatic notes:**
- Many institutions care less about “perfect parity of every LMS feature” and more about reliable movement of **modules/files/links** (and sometimes question banks).
- CC often interacts with LTI because cartridges can contain **LTI links** (to tools) plus content.

---

## C. Quizzes / exams — target: QTI 3.0

### C1) **Question & Test Interoperability (QTI) v3.0**
**What it is:** A standard representation for assessment items and tests, plus usage/results reporting structures.  
**You want to hit:** Import/export of QTI 3.0 item banks and tests that match your authoring/delivery features.

**Key docs:**
- QTI 3.0 Overview: https://www.imsglobal.org/spec/qti/v3p0/oview
- QTI 3.0 Beginner’s Guide: https://www.imsglobal.org/spec/qti/v3p0/guide
- QTI 3.0 Best Practices & Implementation Guide (BPIG): https://www.imsglobal.org/spec/qti/v3p0/impl
- 1EdTech QTI documents index: https://www.1edtech.org/standards/qti/index

**Pragmatic notes:**
- QTI support can be “shallow” (basic MCQ/TF/short answer) or “deep” (complex interactions, scoring, metadata, outcomes). Universities vary a lot

---

## D. SIS rostering — target: OneRoster 1.2

### D1) **OneRoster v1.2**
**What it is:** Standardized exchange of orgs/courses/classes/enrollments/users, via **CSV** and/or **REST/JSON**, to sync SIS ↔ LMS (and related systems).  
**You want to hit:** Usually both *CSV binding* and *REST binding* (at least the endpoints/workflows your target SIS products require).

**Key docs:**
- OneRoster v1.2 spec landing: https://www.imsglobal.org/spec/oneroster/v1p2
- OneRoster v1.2 Implementation & Best Practices Guide: https://www.imsglobal.org/spec/oneroster/v1p2/impl
- OneRoster v1.2 CSV binding: https://www.imsglobal.org/spec/oneroster/v1p2/bind/csv
- 1EdTech OneRoster overview page: https://www.1edtech.org/standards/oneroster

**Pragmatic notes:**
- Universities often have existing SIS pipelines; the “minimum viable” integration is frequently **CSV imports** on a schedule, even if a REST integration is the long-run goal.
- Decide whether you will be **authoritative** (LMS is source of truth for some data) or purely **downstream** (SIS is source of truth). OneRoster can support either, but your product workflow must be consistent.
