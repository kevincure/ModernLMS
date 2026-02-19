# Campus LMS - Supabase Database Schema

## Overview
This document describes the Supabase PostgreSQL database schema for the Campus LMS application.

---

## Current Status (as of 2026-01-20)

### Row Level Security (RLS) Status
**ALL TABLES HAVE RLS ENABLED** with policies in place.

| Table | RLS | Policy Count |
|-------|-----|--------------|
| announcements | ✅ ENABLED | 2 |
| assignments | ✅ ENABLED | 2 |
| bank_questions | ✅ ENABLED | 2 |
| courses | ✅ ENABLED | 5 |
| enrollments | ✅ ENABLED | 6 |
| files | ✅ ENABLED | 2 |
| grade_categories | ✅ ENABLED | 2 |
| grade_criteria_scores | ✅ ENABLED | 2 |
| grades | ✅ ENABLED | 3 |
| invites | ✅ ENABLED | 2 |
| module_items | ✅ ENABLED | 2 |
| modules | ✅ ENABLED | 2 |
| notifications | ✅ ENABLED | 2 |
| profiles | ✅ ENABLED | 2 |
| question_banks | ✅ ENABLED | 2 |
| quiz_questions | ✅ ENABLED | 1 |
| quiz_submissions | ✅ ENABLED | 3 |
| quizzes | ✅ ENABLED | 2 |
| rubric_criteria | ✅ ENABLED | 1 |
| rubrics | ✅ ENABLED | 1 |
| submissions | ✅ ENABLED | 4 |

### Storage Buckets (RLS Enabled)
- **submissions**: User folder-based access (`{user_id}/...`)
- **course-files**: Enrollment-based access

---

## Tables

### profiles
User profiles, extends Supabase auth.users.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | - | References auth.users(id) |
| email | TEXT | - | User's email (unique) |
| name | TEXT | - | Display name |
| avatar | TEXT | NULL | Initials or URL |
| gemini_key | TEXT | NULL | User's Gemini API key |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `profiles_pkey`: PRIMARY KEY (id)
- `profiles_email_key`: UNIQUE (email)
- `profiles_id_fkey`: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE

**Triggers:**
- `on_profile_created`: AFTER INSERT - Processes pending invites
- `update_profiles_updated_at`: BEFORE UPDATE - Updates timestamp

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Profiles are viewable by authenticated users | SELECT | `auth.uid() IS NOT NULL` |
| Users can update own profile | UPDATE | `auth.uid() = id` |

---

### courses

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| name | TEXT | - | Course name |
| code | TEXT | - | Course code (e.g., "ECON101") |
| description | TEXT | NULL | |
| invite_code | TEXT | - | Unique code for joining |
| created_by | UUID (FK) | NULL | References profiles(id) |
| start_here_title | TEXT | 'Start Here' | Title for start section |
| start_here_content | TEXT | NULL | Markdown content |
| active | BOOLEAN | true | Whether course is active |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `courses_pkey`: PRIMARY KEY (id)
- `courses_invite_code_key`: UNIQUE (invite_code)
- `courses_created_by_fkey`: FOREIGN KEY (created_by) REFERENCES profiles(id)

**Triggers:**
- `update_courses_updated_at`: BEFORE UPDATE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Users can create courses | INSERT | `WITH CHECK (auth.uid() = created_by)` |
| Course creators can update their courses | UPDATE | `USING (created_by = auth.uid())` |
| Courses visible to enrolled users | SELECT | `EXISTS enrollment check OR created_by = auth.uid()` |
| Instructors can manage courses | ALL | `EXISTS enrollment as instructor/ta` |
| Users can view all courses | SELECT | `auth.uid() IS NOT NULL` (for join by invite code) |

**⚠️ IMPORTANT: Course Creation Flow**
When a user creates a course:
1. INSERT needs to work before enrollment exists
2. SELECT needs to return the newly created course
3. Then enrollment as instructor is created

This means policies must allow:
- INSERT when `created_by = auth.uid()` (no enrollment required)
- SELECT when `created_by = auth.uid()` OR enrolled

---

### enrollments
Maps users to courses with roles.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| user_id | UUID (FK) | NULL | References profiles(id) |
| course_id | UUID (FK) | NULL | References courses(id) |
| role | enrollment_role | 'student' | 'instructor', 'ta', or 'student' |
| enrolled_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `enrollments_pkey`: PRIMARY KEY (id)
- `enrollments_user_id_course_id_key`: UNIQUE (user_id, course_id)
- `enrollments_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
- `enrollments_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE

**Indexes:**
- `idx_enrollments_user`: (user_id)
- `idx_enrollments_course`: (course_id)

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Users can view their own enrollments | SELECT | `user_id = auth.uid()` |
| Users see own enrollments | SELECT | `user_id = auth.uid()` |
| Instructors see course enrollments | SELECT | `EXISTS instructor/ta enrollment in course` |
| Users can insert their own enrollments | INSERT | `user_id = auth.uid()` |
| Course creators can manage enrollments | ALL | `course.created_by = auth.uid()` |
| Instructors manage enrollments | ALL | `EXISTS instructor enrollment in course` |

---

### invites
Pending course invitations.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| course_id | UUID (FK) | NULL | References courses(id) |
| email | TEXT | - | Invited email |
| role | enrollment_role | 'student' | Role to assign |
| status | invite_status | 'pending' | 'pending', 'accepted', 'expired' |
| invited_by | UUID (FK) | NULL | References profiles(id) |
| created_at | TIMESTAMPTZ | now() | |
| accepted_at | TIMESTAMPTZ | NULL | |

**Constraints:**
- `invites_pkey`: PRIMARY KEY (id)
- `invites_course_id_email_key`: UNIQUE (course_id, email)
- `invites_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
- `invites_invited_by_fkey`: FOREIGN KEY (invited_by) REFERENCES profiles(id)

**Indexes:**
- `idx_invites_email`: (email)
- `idx_invites_course`: (course_id)

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Staff manage invites | ALL | `EXISTS instructor/ta enrollment in course` |
| Staff see course invites | SELECT | `EXISTS instructor/ta enrollment in course` |

---

### assignments

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| course_id | UUID (FK) | NULL | References courses(id) |
| title | TEXT | - | Assignment title |
| description | TEXT | NULL | Markdown description |
| points | INTEGER | 100 | Max points |
| status | content_status | 'draft' | 'draft' or 'published' |
| due_date | TIMESTAMPTZ | NULL | |
| allow_late_submissions | BOOLEAN | true | |
| late_deduction | INTEGER | 10 | Percentage per day |
| allow_resubmission | BOOLEAN | true | |
| category | TEXT | 'homework' | e.g., 'homework', 'essay', 'exam' |
| created_by | UUID (FK) | NULL | References profiles(id) |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `assignments_pkey`: PRIMARY KEY (id)
- `assignments_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
- `assignments_created_by_fkey`: FOREIGN KEY (created_by) REFERENCES profiles(id)

**Indexes:**
- `idx_assignments_course`: (course_id)

**Triggers:**
- `update_assignments_updated_at`: BEFORE UPDATE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Enrolled see published assignments | SELECT | `status = 'published' AND EXISTS enrollment` |
| Staff manage assignments | ALL | `EXISTS instructor/ta enrollment in course` |

---

### submissions
Student assignment submissions.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| assignment_id | UUID (FK) | NULL | References assignments(id) |
| user_id | UUID (FK) | NULL | References profiles(id) |
| content | TEXT | NULL | Submission text/content |
| file_name | TEXT | NULL | Uploaded file name |
| file_path | TEXT | NULL | Supabase storage path |
| submitted_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `submissions_pkey`: PRIMARY KEY (id)
- `submissions_assignment_id_user_id_key`: UNIQUE (assignment_id, user_id)
- `submissions_assignment_id_fkey`: FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
- `submissions_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE

**Indexes:**
- `idx_submissions_assignment`: (assignment_id)
- `idx_submissions_user`: (user_id)

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Staff see submissions | SELECT | `EXISTS instructor/ta enrollment in assignment's course` |
| Students can submit | INSERT | `user_id = auth.uid()` |
| Students can resubmit | UPDATE | `user_id = auth.uid()` |
| Students see own submissions | SELECT | `user_id = auth.uid()` |

---

### grades

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| submission_id | UUID (FK) | NULL | References submissions(id) |
| score | NUMERIC(5,2) | NULL | Points earned |
| feedback | TEXT | NULL | Instructor feedback |
| released | BOOLEAN | false | Visible to student |
| graded_by | UUID (FK) | NULL | References profiles(id) |
| graded_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `grades_pkey`: PRIMARY KEY (id)
- `grades_submission_id_key`: UNIQUE (submission_id)
- `grades_graded_by_fkey`: FOREIGN KEY (graded_by) REFERENCES profiles(id)
- `grades_submission_id_fkey`: FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Staff can grade | ALL | `EXISTS instructor/ta enrollment` |
| Staff see all grades | SELECT | `EXISTS instructor/ta enrollment` |
| Students see released grades | SELECT | `released = true AND submission.user_id = auth.uid()` |

---

### rubrics

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| assignment_id | UUID (FK) | NULL | References assignments(id) - unique |
| created_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `rubrics_pkey`: PRIMARY KEY (id)
- `rubrics_assignment_id_key`: UNIQUE (assignment_id)
- `rubrics_assignment_id_fkey`: FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| See rubrics | SELECT | `EXISTS enrollment in assignment's course` |

---

### rubric_criteria

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| rubric_id | UUID (FK) | NULL | References rubrics(id) |
| name | TEXT | - | Criterion name |
| description | TEXT | NULL | |
| points | INTEGER | - | Max points for criterion |
| position | INTEGER | 0 | Display order |

**Constraints:**
- `rubric_criteria_pkey`: PRIMARY KEY (id)
- `rubric_criteria_rubric_id_fkey`: FOREIGN KEY (rubric_id) REFERENCES rubrics(id) ON DELETE CASCADE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| See rubric criteria | SELECT | `EXISTS enrollment via rubric -> assignment -> course` |

---

### grade_criteria_scores
Per-criterion scores for rubric grading.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| grade_id | UUID (FK) | NULL | References grades(id) |
| criterion_id | UUID (FK) | NULL | References rubric_criteria(id) |
| score | NUMERIC(5,2) | NULL | |
| comment | TEXT | NULL | |

**Constraints:**
- `grade_criteria_scores_pkey`: PRIMARY KEY (id)
- `grade_criteria_scores_grade_id_criterion_id_key`: UNIQUE (grade_id, criterion_id)
- `grade_criteria_scores_criterion_id_fkey`: FOREIGN KEY (criterion_id) REFERENCES rubric_criteria(id) ON DELETE CASCADE
- `grade_criteria_scores_grade_id_fkey`: FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Staff manage criteria scores | ALL | `EXISTS instructor/ta enrollment` |
| Students see own released criteria scores | SELECT | `grade.released AND submission.user_id = auth.uid()` |

---

### quizzes

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| course_id | UUID (FK) | NULL | References courses(id) |
| title | TEXT | - | |
| description | TEXT | NULL | |
| status | content_status | 'draft' | 'draft' or 'published' |
| due_date | TIMESTAMPTZ | NULL | |
| time_limit | INTEGER | NULL | Minutes, NULL = unlimited |
| attempts_allowed | INTEGER | NULL | |
| randomize_questions | BOOLEAN | false | |
| question_pool_enabled | BOOLEAN | false | |
| question_select_count | INTEGER | NULL | Questions to show from pool |
| created_by | UUID (FK) | NULL | References profiles(id) |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Enrolled see published quizzes | SELECT | `status = 'published' AND EXISTS enrollment` |
| Staff manage quizzes | ALL | `EXISTS instructor/ta enrollment` |

---

### quiz_questions

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| quiz_id | UUID (FK) | NULL | References quizzes(id) |
| type | question_type | - | 'multiple_choice', 'true_false', 'short_answer' |
| prompt | TEXT | - | Question text |
| options | JSONB | NULL | Array of option strings |
| correct_answer | JSONB | NULL | Index for MC, "True"/"False" for TF |
| points | INTEGER | 1 | |
| position | INTEGER | 0 | Display order |

**Constraints:**
- `quiz_questions_pkey`: PRIMARY KEY (id)
- `quiz_questions_quiz_id_fkey`: FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| See quiz questions | SELECT | `EXISTS enrollment in quiz's course` |

---

### quiz_submissions

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| quiz_id | UUID (FK) | NULL | References quizzes(id) |
| user_id | UUID (FK) | NULL | References profiles(id) |
| answers | JSONB | NULL | { "question_id": "answer_value" } |
| score | NUMERIC(5,2) | NULL | |
| started_at | TIMESTAMPTZ | now() | |
| submitted_at | TIMESTAMPTZ | NULL | |
| attempt_number | INTEGER | 1 | |

**Constraints:**
- `quiz_submissions_pkey`: PRIMARY KEY (id)
- `quiz_submissions_quiz_id_fkey`: FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
- `quiz_submissions_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Staff see quiz submissions | SELECT | `EXISTS instructor/ta enrollment` |
| Students can submit quiz | INSERT | `user_id = auth.uid()` |
| Students see own quiz submissions | SELECT | `user_id = auth.uid()` |

---

### announcements

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| course_id | UUID (FK) | NULL | References courses(id) |
| title | TEXT | - | |
| content | TEXT | NULL | Markdown content |
| pinned | BOOLEAN | false | |
| author_id | UUID (FK) | NULL | References profiles(id) |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `announcements_pkey`: PRIMARY KEY (id)
- `announcements_author_id_fkey`: FOREIGN KEY (author_id) REFERENCES profiles(id)
- `announcements_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE

**Indexes:**
- `idx_announcements_course`: (course_id)

**Triggers:**
- `update_announcements_updated_at`: BEFORE UPDATE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Enrolled see announcements | SELECT | `EXISTS enrollment in course` |
| Staff manage announcements | ALL | `EXISTS instructor/ta enrollment` |

---

### files
Course file metadata (actual files in Supabase Storage).

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| course_id | UUID (FK) | NULL | References courses(id) |
| name | TEXT | - | Display name |
| mime_type | TEXT | NULL | MIME type (e.g., 'application/pdf') |
| size_bytes | INTEGER | NULL | File size in bytes |
| storage_path | TEXT | - | Path in 'course-files' bucket |
| uploaded_by | UUID (FK) | NULL | References profiles(id) |
| uploaded_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `files_pkey`: PRIMARY KEY (id)
- `files_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
- `files_uploaded_by_fkey`: FOREIGN KEY (uploaded_by) REFERENCES profiles(id)

**Indexes:**
- `idx_files_course`: (course_id)

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Enrolled see files | SELECT | `EXISTS enrollment in course` |
| Staff manage files | ALL | `EXISTS instructor/ta enrollment` |

---

### modules
Content organization units (weeks, topics).

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| course_id | UUID (FK) | NULL | References courses(id) |
| name | TEXT | - | e.g., "Week 1: Introduction" |
| position | INTEGER | 0 | Display order |
| created_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `modules_pkey`: PRIMARY KEY (id)
- `modules_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE

**Indexes:**
- `idx_modules_course`: (course_id)

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Enrolled see modules | SELECT | `EXISTS enrollment in course` |
| Staff manage modules | ALL | `EXISTS instructor/ta enrollment` |

---

### module_items
Items within modules.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| module_id | UUID (FK) | NULL | References modules(id) |
| type | module_item_type | - | 'assignment', 'quiz', 'file', 'external_link' |
| ref_id | UUID | NULL | References assignment, quiz, or file |
| title | TEXT | NULL | For external_link type |
| url | TEXT | NULL | For external_link type |
| position | INTEGER | 0 | Display order |

**Constraints:**
- `module_items_pkey`: PRIMARY KEY (id)
- `module_items_module_id_fkey`: FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| See module items | SELECT | `EXISTS enrollment via module -> course` |
| Staff manage module items | ALL | `EXISTS instructor/ta enrollment` |

---

### grade_categories
Weighted grading categories.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| course_id | UUID (FK) | NULL | References courses(id) |
| name | TEXT | - | e.g., "Homework", "Exams" |
| weight | NUMERIC(5,4) | 0 | e.g., 0.30 = 30% |

**Constraints:**
- `grade_categories_pkey`: PRIMARY KEY (id)
- `grade_categories_course_id_name_key`: UNIQUE (course_id, name)
- `grade_categories_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Enrolled see grade categories | SELECT | `EXISTS enrollment in course` |
| Staff manage grade categories | ALL | `EXISTS instructor/ta enrollment` |

---

### notifications

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| user_id | UUID (FK) | NULL | References profiles(id) |
| type | notification_type | - | See enum below |
| title | TEXT | - | |
| message | TEXT | NULL | |
| course_id | UUID (FK) | NULL | References courses(id) |
| ref_id | UUID | NULL | Related entity |
| read | BOOLEAN | false | |
| created_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `notifications_pkey`: PRIMARY KEY (id)
- `notifications_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
- `notifications_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE

**Indexes:**
- `idx_notifications_user`: (user_id)

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Users manage own notifications | UPDATE | `user_id = auth.uid()` |
| Users see own notifications | SELECT | `user_id = auth.uid()` |

---

### question_banks
Reusable question pools.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| course_id | UUID (FK) | NULL | References courses(id) |
| name | TEXT | - | |
| created_at | TIMESTAMPTZ | now() | |

**Constraints:**
- `question_banks_pkey`: PRIMARY KEY (id)
- `question_banks_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Enrolled see question banks | SELECT | `EXISTS enrollment in course` |
| Staff manage question banks | ALL | `EXISTS instructor/ta enrollment` |

---

### bank_questions

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID (PK) | uuid_generate_v4() | |
| bank_id | UUID (FK) | NULL | References question_banks(id) |
| type | question_type | - | |
| prompt | TEXT | - | |
| options | JSONB | NULL | |
| correct_answer | JSONB | NULL | |
| points | INTEGER | 1 | |

**Constraints:**
- `bank_questions_pkey`: PRIMARY KEY (id)
- `bank_questions_bank_id_fkey`: FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE

**RLS Policies:**
| Name | Command | Definition |
|------|---------|------------|
| Enrolled see bank questions | SELECT | `EXISTS enrollment via bank -> course` |
| Staff manage bank questions | ALL | `EXISTS instructor/ta enrollment` |

---

## Enums

### enrollment_role
- `instructor`
- `ta`
- `student`

### invite_status
- `pending`
- `accepted`
- `expired`

### content_status
- `draft`
- `published`

### question_type
- `multiple_choice`
- `true_false`
- `short_answer`

### module_item_type
- `assignment`
- `quiz`
- `file`
- `external_link`

### notification_type
- `grade_released`
- `assignment_due`
- `announcement`
- `submission_received`
- `quiz_available`
- `invite`

---

## Storage Buckets

### submissions
Private bucket for student assignment submissions.

**Policies:**
| Name | Operation | Definition |
|------|-----------|------------|
| users manage own submissions | SELECT, INSERT, UPDATE | `(storage.foldername(name))[1] = (auth.uid())::text` |

Users can only access files in their own folder (`{user_id}/...`).

---

### course-files
Private bucket for course materials.

**Current Policies:**
| Name | Operation | Definition |
|------|-----------|------------|
| enrolled_users_read_course_files | SELECT | Joins files table with enrollments |
| Staff upload/delete | INSERT, DELETE | Checks instructor/ta enrollment via course_id folder |

**Important path convention used by app upload code:**
- Storage object key format is `courses/{course_id}/{file_id}_{file_name}`.
- Therefore, policies that parse `storage.foldername(name)` must treat:
  - `[1]` as literal `'courses'`
  - `[2]` as `course_id` (UUID)
- Casting `[1]::uuid` will fail with PostgreSQL `22P02`.

**Important schema note for `public.files` table:**
- Canonical columns are `mime_type`, `size_bytes`, and `storage_path`.
- Some historical environments used `type` and `size` instead.
- If you see `PGRST204` like "Could not find the 'size' column", the API payload/schema is mismatched.

---

## Database Functions & Triggers

### Functions

#### update_updated_at()
Updates the `updated_at` timestamp when a row is modified.

#### process_pending_invites()
Called after a profile is created. Finds pending invites for the user's email and creates enrollments.

### Triggers

| Table | Trigger | Event | Function |
|-------|---------|-------|----------|
| profiles | on_profile_created | AFTER INSERT | process_pending_invites() |
| profiles | update_profiles_updated_at | BEFORE UPDATE | update_updated_at() |
| courses | update_courses_updated_at | BEFORE UPDATE | update_updated_at() |
| assignments | update_assignments_updated_at | BEFORE UPDATE | update_updated_at() |
| announcements | update_announcements_updated_at | BEFORE UPDATE | update_updated_at() |

---

## JavaScript Field Mapping

The app uses camelCase in JavaScript but snake_case in PostgreSQL:

| JavaScript | PostgreSQL |
|------------|------------|
| `courseId` | `course_id` |
| `userId` | `user_id` |
| `dueDate` | `due_date` |
| `createdAt` | `created_at` |
| `allowLateSubmissions` | `allow_late_submissions` |
| `storagePath` | `storage_path` |
| `mimeType` | `mime_type` |
| `sizeBytes` | `size_bytes` |
| `uploadedBy` | `uploaded_by` |
| `uploadedAt` | `uploaded_at` |

---

## Known Issues & Required Fixes

### 🚨 CRITICAL: auth.uid() Returns NULL (UNRESOLVED)

**Symptom:** Course creation hangs indefinitely. No error, no timeout, just never completes.

**Confirmed Working:**
- Google OAuth login works - user signs in successfully
- Profile row is created in `profiles` table with correct ID
- Example profile: `{"id": "0ee10db1-d209-446b-9dbc-6ff4b5852de7", "email": "kevincure@gmail.com", "name": "Kevin Bryan"}`
- The profile ID matches `auth.users.id` in Supabase Auth

**The Problem:**
The INSERT policy on `courses` table is:
```sql
WITH CHECK (created_by = auth.uid())
```

But when the app tries to insert a course, `auth.uid()` returns `NULL`, so the policy evaluates to:
```sql
'0ee10db1-d209-446b-9dbc-6ff4b5852de7' = NULL  -- always false
```

**Root Cause:**
The Supabase JavaScript client is NOT authenticated, even though the user logged in via Google OAuth. The Google OAuth flow creates a user in `auth.users`, but the Supabase client itself doesn't have a session set.

**Why This Happens:**
When using Google Sign-In (gapi.auth2) directly instead of Supabase's OAuth:
1. User signs in with Google → gets Google ID token
2. App calls a custom endpoint or edge function to create profile in `profiles`
3. BUT the Supabase client was never given the user's session
4. So all subsequent database calls are made as "anonymous"
5. `auth.uid()` in RLS policies returns `null`

**Fix Required:**
After Google OAuth success, the app MUST either:

**Option A: Exchange Google token for Supabase session**
```javascript
// After getting Google ID token
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'google',
  token: googleIdToken,
  nonce: 'OPTIONAL_NONCE'  // if using PKCE
});
// Now supabase client is authenticated, auth.uid() will work
```

**Option B: Use Supabase's native Google OAuth**
```javascript
// Instead of gapi.auth2, use Supabase's OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin
  }
});
```

**Files to Check:**
1. `js/supabase-init.js` - How client is created
2. Login handling code - Look for how Google token is used
3. Look for `signInWithIdToken` or `signInWithOAuth` - if missing, that's the bug

**Verification Test:**
Add this debug code before course creation:
```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log('Supabase user:', user);  // If null, auth.uid() will be null
```

---

### Issue: Course Creation Hangs (if auth works)

**Problem:** When creating a course, the INSERT succeeds but `.select().single()` hangs because:
1. User inserts course with `created_by = auth.uid()`
2. Supabase tries to SELECT the inserted row to return it
3. SELECT policies require enrollment to exist
4. But enrollment is created AFTER course creation
5. Result: SELECT times out/hangs

**Solution:** The courses SELECT policy must include `created_by = auth.uid()`:

```sql
-- Drop and recreate the "Courses visible to enrolled users" policy
DROP POLICY IF EXISTS "Courses visible to enrolled users" ON courses;

CREATE POLICY "Courses visible to enrolled or created"
ON courses FOR SELECT
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM enrollments
    WHERE enrollments.course_id = courses.id
      AND enrollments.user_id = auth.uid()
  )
);
```

Alternatively, ensure "Users can view all courses" policy works:
```sql
-- This simple policy allows any authenticated user to see any course
-- (needed for join-by-invite-code flow anyway)
DROP POLICY IF EXISTS "Users can view all courses" ON courses;

CREATE POLICY "Users can view all courses"
ON courses FOR SELECT
USING (auth.uid() IS NOT NULL);
```

### Issue: Enrollment Creation After Course

**Problem:** When creating enrollment for a new course:
1. "Course creators can manage enrollments" needs to check courses.created_by
2. "Instructors manage enrollments" needs existing enrollment

**Solution:** Ensure the course creator policy works:
```sql
DROP POLICY IF EXISTS "Course creators can manage enrollments" ON enrollments;

CREATE POLICY "Course creators can manage enrollments"
ON enrollments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = enrollments.course_id
      AND courses.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = enrollments.course_id
      AND courses.created_by = auth.uid()
  )
);
```

---

## Complete Policy Fix SQL

Run this in Supabase SQL Editor to fix course creation:

```sql
-- Fix courses SELECT to allow creators to see their courses
DROP POLICY IF EXISTS "Courses visible to enrolled users" ON courses;
DROP POLICY IF EXISTS "Courses visible to enrolled or created" ON courses;

CREATE POLICY "Courses visible to enrolled or created"
ON courses FOR SELECT
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM enrollments
    WHERE enrollments.course_id = courses.id
      AND enrollments.user_id = auth.uid()
  )
);

-- Ensure users can create courses (simple check)
DROP POLICY IF EXISTS "Users can create courses" ON courses;

CREATE POLICY "Users can create courses"
ON courses FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
);

-- Fix course creators can manage their enrollments
DROP POLICY IF EXISTS "Course creators can manage enrollments" ON enrollments;

CREATE POLICY "Course creators can manage enrollments"
ON enrollments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = enrollments.course_id
      AND courses.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = enrollments.course_id
      AND courses.created_by = auth.uid()
  )
);
```

---

## Quick Reference: Policy Patterns

### Allow authenticated users
```sql
USING (auth.uid() IS NOT NULL)
```

### User owns the row
```sql
USING (user_id = auth.uid())
```

### User created the parent entity
```sql
USING (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = table.course_id
      AND courses.created_by = auth.uid()
  )
)
```

### User is enrolled in course
```sql
USING (
  EXISTS (
    SELECT 1 FROM enrollments
    WHERE enrollments.course_id = table.course_id
      AND enrollments.user_id = auth.uid()
  )
)
```

### User is staff (instructor/ta) in course
```sql
USING (
  EXISTS (
    SELECT 1 FROM enrollments
    WHERE enrollments.course_id = table.course_id
      AND enrollments.user_id = auth.uid()
      AND enrollments.role IN ('instructor', 'ta')
  )
)
```

---

## OneRoster 1.2 Compliance

### Current Status

The app generates a **client-side OneRoster 1.2 CSV export** (see `generateOneRosterExport` /
`downloadOneRosterExport` in `database_interactions.js`). The export produces 6 CSV files:

| File | OneRoster Entity | Notes |
|------|-----------------|-------|
| `orgs.csv` | Org | Synthetic single-org (`org-campus-lms`) |
| `academicSessions.csv` | AcademicSession | Single session for current school year |
| `users.csv` | User | All `profiles` rows; name split into givenName/familyName |
| `courses.csv` | Course | Maps `courses` table |
| `classes.csv` | Class | 1-section-per-course model |
| `enrollments.csv` | Enrollment | Maps `enrollments`; role enum mapped to OneRoster values |

### Gaps vs. Full OneRoster 1.2 Spec

The following gaps exist between the current schema and full OneRoster 1.2 server compliance.
They do **not** block CSV export but would be required for a certified OneRoster REST API.

#### REST API Architecture (not yet implemented)
OneRoster 1.2 defines **three independent services**, each with a separate base path:
- **Rostering Service** — `GET /ims/oneroster/rostering/v1p2/...`
- **Gradebook Service** — `GET /ims/oneroster/gradebook/v1p2/...`
- **Resources Service** — `GET /ims/oneroster/resources/v1p2/...`

Conformance requires **22 core Rostering endpoints** (Table 4.1 of the conformance guide).

#### Data Model Gaps

| Gap | Current | OneRoster 1.2 Required |
|-----|---------|------------------------|
| `sourcedId` | `id` (UUID) | Explicit `sourcedId` field |
| `status` on all entities | Not stored | `'active'` or `'tobedeleted'` |
| `dateLastModified` on all entities | Not stored | ISO-8601 timestamp |
| User `givenName` / `familyName` | Single `name` string | Separate given/family (split on export) |
| User `userMasterIdentifier` | Not stored | New in 1.2: canonical universal ID (optional) |
| User preferred names | Not stored | `preferredFirstName`, `preferredLastName` (optional, new in 1.2) |
| `orgs` table | None (synthetic) | Persistent `orgs` table with `sourcedId` |
| `academicSessions` table | None (synthetic) | Persistent `academicSessions` table |
| Class `periods` | Not stored | New in 1.2, optional |
| Class `subjectCodes` | Not stored | New in 1.2, optional |
| Role enum | `instructor`, `ta`, `student` | `teacher`, `teaching assistant`, `student` |
| REST API | Not implemented | OAuth 2.0 Bearer-token endpoints |

### Required SQL Migrations (for full server compliance)

```sql
-- Add OneRoster metadata columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sourced_id TEXT GENERATED ALWAYS AS (id::text) STORED;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS given_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS family_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS oneroster_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_last_modified TIMESTAMPTZ NOT NULL DEFAULT now();

-- Auto-populate given/family name from existing `name` column (one-time backfill)
UPDATE profiles
  SET given_name  = split_part(name, ' ', 1),
      family_name = TRIM(SUBSTR(name, STRPOS(name, ' ')))
  WHERE given_name IS NULL;

-- Add metadata to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS oneroster_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS date_last_modified TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add metadata to enrollments
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS oneroster_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS date_last_modified TIMESTAMPTZ NOT NULL DEFAULT now();

-- Normalize role values for OneRoster (view for export)
CREATE OR REPLACE VIEW oneroster_enrollments AS
  SELECT
    id::text                                        AS "sourcedId",
    oneroster_status                                AS "status",
    date_last_modified                              AS "dateLastModified",
    CASE role::text
      WHEN 'instructor' THEN 'teacher'
      WHEN 'ta'         THEN 'teaching assistant'
      ELSE role::text
    END                                             AS "role",
    course_id::text                                 AS "classSourcedId",
    user_id::text                                   AS "userSourcedId"
  FROM enrollments;

-- Persistent orgs table
CREATE TABLE IF NOT EXISTS orgs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sourced_id  TEXT GENERATED ALWAYS AS (id::text) STORED,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'school', -- school | district | local | state | national
  identifier  TEXT,
  parent_id   UUID REFERENCES orgs(id),
  status      TEXT NOT NULL DEFAULT 'active',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Persistent academicSessions table
CREATE TABLE IF NOT EXISTS academic_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'schoolYear', -- schoolYear | semester | gradingPeriod | term
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Role Mapping

| App role | OneRoster `role` value |
|----------|------------------------|
| `instructor` | `teacher` |
| `ta` | `teaching assistant` |
| `student` | `student` |

---

## Caliper Analytics 1.2

### Overview

Caliper support is implemented in `database_interactions.js` as a lightweight client-side
sensor targeting the **IMS Global / 1EdTech Caliper Analytics 1.2** specification.
When a Caliper endpoint URL is configured (Settings → Caliper Analytics Endpoint),
events are `POST`ed as JSON envelopes to the LRS via `POST /send`.

### Metric Profiles Implemented

| Profile | Events emitted |
|---------|---------------|
| Session Profile | `SessionEvent / LoggedIn` |
| Reading Profile | `ViewEvent / Viewed` (page navigation) |
| Assignable Profile | `AssignableEvent / Submitted` |
| Grading Profile | `GradeEvent / Graded` |
| Assessment Profile | `AssessmentEvent / Started`, `AssessmentEvent / Completed` |

### Configuration

Set in **Settings modal** and persisted in `localStorage`:
- `caliperEndpoint` — LRS endpoint URL (e.g. `https://lrs.example.com/caliper/v1p2/send`)
- `caliperSensorId` — Sensor identifier string (default: `campus-lms`)

The sensor is initialized on app start if a saved endpoint is found.

### Instrumented Events

| Lifecycle point | Profile | Caliper event type | Action |
|---|---|---|---|
| User login | Session | `SessionEvent` | `LoggedIn` |
| Page navigation | Reading | `ViewEvent` | `Viewed` |
| Assignment submission | Assignable | `AssignableEvent` | `Submitted` |
| Grade posted | Grading | `GradeEvent` | `Graded` |
| Quiz started | Assessment | `AssessmentEvent` | `Started` |
| Quiz completed | Assessment | `AssessmentEvent` | `Completed` |

### Envelope Format (Caliper 1.2)

```json
{
  "sensor": "campus-lms",
  "sendTime": "2026-02-18T12:00:00.000Z",
  "dataVersion": "http://purl.imsglobal.org/ctx/caliper/v1p2",
  "data": [
    {
      "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
      "id": "urn:uuid:<uuid>",
      "type": "AssessmentEvent",
      "actor": { "id": "urn:campus-lms:user:<userId>", "type": "Person" },
      "action": "Started",
      "object": { "id": "urn:campus-lms:quiz:<quizId>", "type": "Assessment", "name": "..." },
      "eventTime": "2026-02-18T12:00:00.000Z"
    }
  ]
}
```

### Future Work (for certified Caliper 1.2 compliance)

- Add `membership` (course enrollment context) to all events
- Add `session` object referencing the active `SessionEvent`
- Support `federatedSession` for LTI contexts
- Add `Authorization: Bearer <token>` header support in `emitCaliperEvent`
- Implement `NavigationEvent` with `navigatedFrom` for page transitions
- Persist events locally when offline and flush on reconnect
- Emit `Forum/Posted` events for discussion board posts
- Emit `ToolUseEvent` for AI chat interactions
