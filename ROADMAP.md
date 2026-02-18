# Campus LMS - Minimal Feature Roadmap (Current)

## ✅ Already Implemented (MVP v1.0)

### Core Features
- ✅ Google SSO authentication (no domain restrictions)
- ✅ Multiple courses per user with role-based access (instructor/TA/student)
- ✅ Course creation with email invitations
- ✅ Course joining via invite codes
- ✅ Assignment creation with draft/published/closed states
- ✅ Student submissions (text + file uploads)
- ✅ Staff grading with release gating
- ✅ AI-powered grading assistance (Gemini 3.0 Flash Preview)
- ✅ Gradebook (student view: released grades only, staff view: full matrix)
- ✅ Announcements/updates per course
- ✅ File uploads per course
- ✅ People management with pending invite tracking
- ✅ AI chat interface
- ✅ CSV gradebook export
- ✅ localStorage persistence

### UX Features
- ✅ Clean, minimal UI (ModernEditor-inspired)
- ✅ Floating toolbar navigation
- ✅ Top bar with course selector + user info
- ✅ Settings modal (Google Client ID + Gemini API Key)
- ✅ Keyboard shortcuts (ESC, Ctrl/Cmd+Enter)
- ✅ Toast notifications

---

## 🎯 Priority Features (MVP v1.1 - Essential for Teaching)

### 1. **Bulk Operations** (High Priority)
- [x] Bulk grade entry (paste from spreadsheet)
- [x] Bulk grade release (release all grades for an assignment at once)
- [x] Bulk student import (CSV upload)
- [x] Download all submissions as ZIP (placeholder; JSZip needed)

### 2. **Assignment Improvements** (High Priority)
- [ ] Assignment templates (reuse assignments across courses)
- [x] Late submission handling (accept after due date with indicator)
- [x] Submission history (view previous versions)
- [x] Allow resubmission toggle
- [x] Point deduction for late work
- [x] Rubrics (define grading criteria)

### 3. **Communication** (High Priority)
- [x] Email notifications (simulated) for:
  - New assignments posted
  - Grades released
- [ ] Assignment due soon (24h reminder)
- [ ] Announcements
- [x] In-app notification center
- [ ] Direct messaging (instructor ↔ student)

### 4. **Gradebook Enhancements** (Medium Priority)
- [x] Grade statistics (average, median, distribution)
- [ ] Curved grading support
- [ ] Extra credit assignments
- [ ] Dropped lowest grade(s) policy
- [x] Weighted categories (homework 30%, exams 70%, etc.)
- [ ] Letter grade calculator

### 5. **Quizzes** (Medium Priority)
- [x] Multiple choice questions
- [x] True/false questions
- [x] Short answer questions
- [x] Auto-grading for MC/TF
- [x] Time limits
- [x] Randomize question order
- [x] Question bank/pools

---

## 🚀 Nice-to-Have Features (MVP v2.0 - Polish)

### 6. **Calendar & Scheduling**
- [x] Course calendar view
- [ ] Assignment timeline visualization
- [ ] Office hours scheduling
- [ ] Sync with Google Calendar

### 7. **Content Organization**
- [x] Modules/weeks structure (with drag-and-drop reordering)
- [ ] Prerequisites (assignments unlock after others)
- [ ] Learning paths
- [ ] Tags for files/assignments

### 8. **Analytics & Insights**
- [ ] Student progress tracking
- [ ] At-risk student identification
- [ ] Assignment difficulty analysis (from grade distribution)
- [ ] Time-to-complete tracking
- [ ] Participation metrics

### 9. **AI-Native Experience (Highest Leverage)**
- [ ] **AI course setup wizard** (start with goals → generate syllabus, modules, grading policy)
- [x] **Natural language → LMS objects** (announcements, quizzes) with HITL confirmation + editable preview
- [x] **Unified AI chatbot** with tool use (create announcements, quizzes via natural language)
- [x] **Voice input in AI chat** (record audio → transcription with course context)
- [ ] **AI student help** (policy-aware Q&A + "ask the syllabus")
- [ ] **Second-look grading** (rubric-based review with confidence + escalation)
- [ ] **Auto study guides** (summaries, key terms, practice questions)
- [ ] **Accessibility assist** (reading level simplification + multilingual drafts)

### 9. **Collaboration**
- [ ] Group assignments
- [ ] Peer review system
- [ ] Discussion boards per course
- [ ] Student groups

### 10. **Accessibility**
- [ ] High contrast mode
- [ ] Screen reader optimization
- [ ] Keyboard navigation improvements
- [ ] Font size controls

---

## 🔧 Technical Improvements

### Backend Migration (Required for Production) - ⚠️ IN PROGRESS
- [x] **Supabase backend** (PARTIALLY WORKING):
  - ✅ PostgreSQL database schema created (courses, profiles, enrollments, assignments, submissions, grades)
  - ✅ Storage bucket configured for file uploads
  - ⚠️ **Row-level security policies** - BLOCKING ISSUE (see below)
  - [ ] Realtime subscriptions
- [x] **Authentication** (PARTIALLY WORKING):
  - ✅ Google OAuth working - users can sign in
  - ✅ Profile creation working - `profiles` table populated on first login
  - ⚠️ **Supabase session not linked to database operations** - `auth.uid()` returns null
  - [ ] Role-based access control (RBAC)
- [ ] **Email service** (SendGrid/Mailgun/Resend)

### 🚨 CRITICAL BLOCKING ISSUE: RLS + auth.uid()

**Symptom**: Course creation hangs indefinitely after user logs in successfully.

**What's Working**:
- Google OAuth signs user in
- Profile row created in `profiles` table with correct `id` matching `auth.users.id`
- User ID example: `0ee10db1-d209-446b-9dbc-6ff4b5852de7`

**What's Failing**:
- `courses` table has RLS enabled with INSERT policy: `WITH CHECK (created_by = auth.uid())`
- When inserting a course, `auth.uid()` appears to return `null`
- The INSERT never completes (no error, just hangs)

**Root Cause Hypothesis**:
The Supabase client is not properly authenticated. Even though Google OAuth works, the Supabase client may be using an unauthenticated/anon session for database operations, causing `auth.uid()` to return `null` and the RLS policy to block the INSERT.

**Fix Required**:
1. After Google OAuth, exchange the Google ID token for a Supabase session using `supabase.auth.signInWithIdToken({ provider: 'google', token: googleIdToken })`
2. Or switch to Supabase's native Google OAuth flow
3. Verify the Supabase client has an active session before database operations

**Files to Check**:
- `js/supabase-init.js` - Client initialization
- Login/auth handling code - How Google token is processed
- Course creation code - Whether it uses authenticated client

### Performance
- [ ] Pagination (assignments, submissions, files)
- [ ] Lazy loading for large datasets
- [ ] Image optimization
- [ ] Caching strategy

### Mobile Experience
- [ ] Responsive design improvements
- [ ] Touch-optimized UI
- [ ] Mobile-specific navigation
- [ ] Progressive Web App (PWA) support

### Data Management
- [ ] Data export (full course backup)
- [ ] Data import (from other LMS platforms)
- [ ] Archive old courses
- [ ] Soft delete with restore

---

## 📊 Feature Priority Matrix

### Must Have (MVP v1.1)
1. Bulk grade operations
2. Email notifications
3. Late submission handling
4. Submission history

### Should Have (MVP v1.5)
5. Rubrics
6. Quizzes with auto-grading
7. Grade statistics
8. Weighted categories

### Nice to Have (MVP v2.0)
9. Calendar integration
10. Discussion boards
11. Group assignments
12. Analytics dashboard

---

## 🎨 Design Principles

Maintain these principles as features are added:

1. **Snappy**: Fast page loads, instant feedback, minimal loading states
2. **Clean**: White space, clear hierarchy, uncluttered
3. **Minimal**: Only essential features visible, advanced features tucked away
4. **Keyboard-first**: Power users should never need mouse
5. **Accessible**: WCAG AA compliant minimum
6. **Forgiving**: Undo/redo, confirmation dialogs, auto-save

---

## 🔥 Quick Wins (Easy Implementations)

These can be added quickly with high user impact:

- [x] **Assignment descriptions with Markdown support** (custom renderer)
- [ ] **Dark mode toggle** (CSS variables already in place)
- [ ] **Assignment due date countdown** ("Due in 3 days, 2 hours")
- [ ] **Grade entry via keyboard** (Tab through cells, Enter to save)
- [ ] **Quick actions menu** (right-click on assignments/students)
- [ ] **Recently viewed courses** (localStorage breadcrumbs)
- [ ] **Assignment duplication** (one-click copy)
- [x] **Search/filter** (files, modules, people, gradebook)
- [x] **Guided onboarding checklist** (first course setup in <5 minutes)
- [x] **Inline AI shortcuts** (generate rubric/quiz/announcement from a prompt)

---

## 📅 Suggested Implementation Order

### Phase 1: Core Teaching Tools (2-3 weeks)
- Bulk operations
- Email notifications
- Late submissions
- Rubrics

### Phase 2: Assessment Tools (2-3 weeks)
- Quizzes
- Grade statistics
- Weighted categories
- Submission history

### Phase 3: Communication (1-2 weeks)
- Direct messaging
- Discussion boards
- Notification center

### Phase 3.5: AI-Native Flows (1-2 weeks)
- AI course setup wizard
- ✅ Natural language → LMS objects (HITL confirm + editable)
- ✅ Unified AI chatbot with tool use
- ✅ Voice input in AI chat
- AI study guides + student help

### Phase 4: Organization (1-2 weeks)
- Calendar
- Modules
- Prerequisites

### Phase 5: Backend Migration (3-4 weeks)
- Supabase setup
- Data migration
- Real authentication
- File storage

### Phase 6: Polish (ongoing)
- Mobile optimization
- Analytics
- Accessibility
- Performance

---

## 💡 Innovation Opportunities

Features that could differentiate this LMS:

1. **AI Teaching Assistant**: 
   - Auto-generate quiz questions from lecture notes
   - Suggest grade adjustments based on class performance
   - Flag potentially plagiarized submissions
   - Draft feedback for common mistakes

2. **Smart Deadlines**:
   - Analyze student schedules across courses
   - Suggest optimal due dates
   - Auto-adjust based on class progress

3. **Micro-credentials**:
   - Digital badges for achievements
   - Skill tracking across courses
   - Portfolio generation

4. **Version Control for Submissions**:
   - Git-style diff viewing
   - Rollback to previous versions
   - Track incremental progress

5. **Collaborative Grading**:
   - Multiple TAs grade same submission
   - Consensus scoring
   - Calibration sessions

---

## 🚫 Explicitly Out of Scope

Don't add these (they bloat the product):

- Video conferencing (use Zoom/Teams)
- Learning content authoring (use existing tools)
- Proctoring services (privacy concerns)
- Social networking features (not a focus)
- Gamification (can feel forced)
- LTI integrations (adds complexity)

---

## Success Metrics

Track these to measure if the LMS is working:

1. **Usage**: Daily active users, time spent
2. **Completion**: Assignment submission rate, late submission rate
3. **Grading**: Time to grade, feedback quality (length/AI usage)
4. **Satisfaction**: NPS from students and instructors
5. **Performance**: Page load times, error rates

---

*This roadmap is a living document. Prioritize based on user feedback and real teaching needs.*

---

## Pending Integrations (Added)

### Pangram AI / Turnitin
Integrate with Pangram AI or Turnitin for AI-generated content detection and plagiarism analysis on student submissions. Hook into the submission flow so results appear alongside the grade panel in `gradeSubmission()`.

### Autograding
Support automated grading for code submissions (Gradescope-style or custom test runners). Define test cases per assignment, run them against submitted files server-side via an edge function, and write scores back to the `grades` table automatically.

### Common Cartridge (IMS CC) Transfer
Import and export courses in IMS Common Cartridge 1.3 format for compatibility with Canvas, Blackboard, Moodle, etc. The import modal skeleton already exists (`openImportContentModal`); needs full CC XML parsing and mapping to the app data model.

### Process File Text for AI Context
Extract text from uploaded course files (PDF via PDF.js, DOCX via mammoth.js, TXT directly) and pass extracted content into `buildAiContext()` so the AI assistant can answer questions about course readings. Needs either client-side parsing or a server-side edge function writing to a `file_text` column on the `files` table.

## Accessibility Remediation (WCAG 2.1 AA)

Audit findings — none are launch blockers but should be addressed before a public release:

- **Focus-visible outlines** — `.tool-btn` and `.btn` need an explicit `outline` on `:focus-visible`; currently relying on browser default which some resets strip
- **Color contrast** — `var(--text-muted)` on white background is ~3.8:1; needs to reach 4.5:1 for body-size text; audit all `.muted` / `.hint` text
- **Toast announcements** — `#toast` has `role="status"`; verify it re-announces on repeated messages (may need a DOM swap trick to force re-read)
- **Toolbar keyboard nav** — arrow keys should move focus between `.tool-btn` items; currently only Tab cycles through them
- **`aria-expanded`** — dropdowns (new-assignment dropdown, etc.) need `aria-expanded` toggled on open/close
- **Modal focus trap** — `openModal()` does not trap Tab focus inside the overlay; Tab can escape to background content
- **Form `aria-describedby`** — inputs with `.hint` text beneath them should link to that hint via `aria-describedby`
- **Video embed titles** — YouTube `<iframe>` elements need a `title` attribute; no caption or transcript support yet
