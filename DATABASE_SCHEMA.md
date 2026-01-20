# Campus LMS - Supabase Database Schema

## Overview
This document describes the Supabase PostgreSQL database schema for the Campus LMS application.

---

## ⚠️ CRITICAL: Current Security Status

### Row Level Security (RLS) Status
**ALL TABLES HAVE RLS DISABLED.** Policies exist but are NOT being enforced.

| Table | RLS Status | Policies Defined |
|-------|------------|------------------|
| announcements | ❌ DISABLED | 2 policies |
| assignments | ❌ DISABLED | 2 policies |
| bank_questions | ❌ DISABLED | 0 policies |
| courses | ❌ DISABLED | 5 policies |
| enrollments | ❌ DISABLED | 6 policies |
| files | ❌ DISABLED | 2 policies |
| grade_categories | ❌ DISABLED | 2 policies |
| grade_criteria_scores | ❌ DISABLED | 0 policies |
| grades | ❌ DISABLED | 3 policies |
| invites | ❌ DISABLED | 2 policies |
| module_items | ❌ DISABLED | 1 policy |
| modules | ❌ DISABLED | 2 policies |
| notifications | ❌ DISABLED | 2 policies |
| profiles | ❌ DISABLED | 2 policies |
| question_banks | ❌ DISABLED | 0 policies |
| quiz_questions | ❌ DISABLED | 1 policy |
| quiz_submissions | ❌ DISABLED | 3 policies |
| quizzes | ❌ DISABLED | 2 policies |
| rubric_criteria | ❌ DISABLED | 1 policy |
| rubrics | ❌ DISABLED | 1 policy |
| submissions | ❌ DISABLED | 4 policies |

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

**Policies (not enforced - RLS disabled):**
- `Profiles are viewable by authenticated users` (SELECT)
- `Users can update own profile` (UPDATE)

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

**Policies (not enforced - RLS disabled):**
- `Course creators can update their courses` (UPDATE)
- `Courses visible to enrolled users` (SELECT)
- `Instructors can manage courses` (ALL)
- `Users can create courses` (INSERT)
- `Users can view all courses` (SELECT)

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

**Policies (not enforced - RLS disabled):**
- `Course creators can manage enrollments` (ALL)
- `Instructors manage enrollments` (ALL)
- `Instructors see course enrollments` (SELECT)
- `Users can insert their own enrollments` (INSERT)
- `Users can view their own enrollments` (SELECT)
- `Users see own enrollments` (SELECT)

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

**Policies (not enforced - RLS disabled):**
- `Staff manage invites` (ALL)
- `Staff see course invites` (SELECT)

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

**Policies (not enforced - RLS disabled):**
- `Enrolled see published assignments` (SELECT)
- `Staff manage assignments` (ALL)

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

**Policies (not enforced - RLS disabled):**
- `Staff see submissions` (SELECT)
- `Students can resubmit` (UPDATE)
- `Students can submit` (INSERT)
- `Students see own submissions` (SELECT)

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

**Policies (not enforced - RLS disabled):**
- `Staff can grade` (ALL)
- `Staff see all grades` (SELECT)
- `Students see released grades` (SELECT)

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

**Policies (not enforced - RLS disabled):**
- `See rubrics` (SELECT)

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

**Policies (not enforced - RLS disabled):**
- `See rubric criteria` (SELECT)

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

**Policies:** ⚠️ NONE DEFINED

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

**Note:** Exact columns depend on what migrations have been run. The above is the expected schema.

**Policies (not enforced - RLS disabled):**
- `Enrolled see published quizzes` (SELECT)
- `Staff manage quizzes` (ALL)

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

**Policies (not enforced - RLS disabled):**
- `See quiz questions` (SELECT)

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

**Policies (not enforced - RLS disabled):**
- `Staff see quiz submissions` (SELECT)
- `Students can submit quiz` (INSERT)
- `Students see own quiz submissions` (SELECT)

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

**Note:** The `hidden` column does NOT exist yet. See SQL Migrations section.

**Constraints:**
- `announcements_pkey`: PRIMARY KEY (id)
- `announcements_author_id_fkey`: FOREIGN KEY (author_id) REFERENCES profiles(id)
- `announcements_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE

**Indexes:**
- `idx_announcements_course`: (course_id)

**Triggers:**
- `update_announcements_updated_at`: BEFORE UPDATE

**Policies (not enforced - RLS disabled):**
- `Enrolled see announcements` (SELECT)
- `Staff manage announcements` (ALL)

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

**Note:** The following columns do NOT exist yet: `hidden`, `external_url`, `description`, `is_placeholder`, `is_youtube`. See SQL Migrations section.

**Constraints:**
- `files_pkey`: PRIMARY KEY (id)
- `files_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
- `files_uploaded_by_fkey`: FOREIGN KEY (uploaded_by) REFERENCES profiles(id)

**Indexes:**
- `idx_files_course`: (course_id)

**Policies (not enforced - RLS disabled):**
- `Enrolled see files` (SELECT)
- `Staff manage files` (ALL)

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

**Note:** The `hidden` column does NOT exist yet. See SQL Migrations section.

**Constraints:**
- `modules_pkey`: PRIMARY KEY (id)
- `modules_course_id_fkey`: FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE

**Indexes:**
- `idx_modules_course`: (course_id)

**Policies (not enforced - RLS disabled):**
- `Enrolled see modules` (SELECT)
- `Staff manage modules` (ALL)

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

**Policies (not enforced - RLS disabled):**
- `See module items` (SELECT)

⚠️ **Missing policies:** No INSERT/UPDATE/DELETE policies for staff

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

**Policies (not enforced - RLS disabled):**
- `Enrolled see grade categories` (SELECT)
- `Staff manage grade categories` (ALL)

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

**Policies (not enforced - RLS disabled):**
- `Users manage own notifications` (UPDATE)
- `Users see own notifications` (SELECT)

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

**Policies:** ⚠️ NONE DEFINED

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

**Policies:** ⚠️ NONE DEFINED

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

**Current Policies:**
| Name | Operation | Definition |
|------|-----------|------------|
| users manage own submissions pn4br_0 | SELECT | `(storage.foldername(name))[1] = (auth.uid())::text` |
| users manage own submissions pn4br_1 | INSERT | `(storage.foldername(name))[1] = (auth.uid())::text` |
| users manage own submissions pn4br_2 | UPDATE | `(storage.foldername(name))[1] = (auth.uid())::text` |

**Expected behavior:** Users can only access files in their own folder (`{user_id}/...`).

✅ These policies look correct.

---

### course-files
Private bucket for course materials (syllabi, resources, etc.).

**Current Policies:**
| Name | Operation | Definition |
|------|-----------|------------|
| enrolled users read files 4knl1h_0 | SELECT | See below |

**Policy definition:**
```sql
(EXISTS ( SELECT 1
   FROM (files f
     JOIN enrollments e ON ((e.course_id = f.course_id)))
  WHERE ((f.storage_path = f.name) AND (e.user_id = auth.uid()))))
```

⚠️ **BUG:** The condition `f.storage_path = f.name` is incorrect!
- `storage_path` contains the full path (e.g., `courses/abc123/document.pdf`)
- `name` is the bucket object name being accessed
- These rarely match, so this policy often fails

**Missing policies:**
- No INSERT policy for staff to upload files
- No DELETE policy for staff to remove files

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

## SQL Migrations Required

### 1. CRITICAL: Enable RLS on All Tables

```sql
-- Enable RLS on all tables
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_criteria_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
```

### 2. Add Missing Policies

```sql
-- Policies for question_banks
CREATE POLICY "Enrolled see question banks"
  ON question_banks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = question_banks.course_id
        AND enrollments.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff manage question banks"
  ON question_banks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = question_banks.course_id
        AND enrollments.user_id = auth.uid()
        AND enrollments.role IN ('instructor', 'ta')
    )
  );

-- Policies for bank_questions
CREATE POLICY "Enrolled see bank questions"
  ON bank_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM question_banks qb
      JOIN enrollments e ON e.course_id = qb.course_id
      WHERE qb.id = bank_questions.bank_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff manage bank questions"
  ON bank_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM question_banks qb
      JOIN enrollments e ON e.course_id = qb.course_id
      WHERE qb.id = bank_questions.bank_id
        AND e.user_id = auth.uid()
        AND e.role IN ('instructor', 'ta')
    )
  );

-- Policies for grade_criteria_scores
CREATE POLICY "Staff manage criteria scores"
  ON grade_criteria_scores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM grades g
      JOIN submissions s ON s.id = g.submission_id
      JOIN assignments a ON a.id = s.assignment_id
      JOIN enrollments e ON e.course_id = a.course_id
      WHERE g.id = grade_criteria_scores.grade_id
        AND e.user_id = auth.uid()
        AND e.role IN ('instructor', 'ta')
    )
  );

CREATE POLICY "Students see own released criteria scores"
  ON grade_criteria_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM grades g
      JOIN submissions s ON s.id = g.submission_id
      WHERE g.id = grade_criteria_scores.grade_id
        AND s.user_id = auth.uid()
        AND g.released = true
    )
  );

-- Policy for module_items management
CREATE POLICY "Staff manage module items"
  ON module_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN enrollments e ON e.course_id = m.course_id
      WHERE m.id = module_items.module_id
        AND e.user_id = auth.uid()
        AND e.role IN ('instructor', 'ta')
    )
  );
```

### 3. Fix Storage Policy for course-files

Run this in Supabase Dashboard > Storage > course-files > Policies:

**Delete the existing broken policy** (`enrolled users read files 4knl1h_0`), then create:

```sql
-- Policy: Enrolled users can read course files
-- For SELECT operations on course-files bucket
CREATE POLICY "enrolled_users_read_course_files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'course-files'
  AND EXISTS (
    SELECT 1 FROM files f
    JOIN enrollments e ON e.course_id = f.course_id
    WHERE f.storage_path = name
      AND e.user_id = auth.uid()
  )
);

-- Policy: Staff can upload course files
CREATE POLICY "staff_upload_course_files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-files'
  AND EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.course_id = (storage.foldername(name))[1]::uuid
      AND e.user_id = auth.uid()
      AND e.role IN ('instructor', 'ta')
  )
);

-- Policy: Staff can delete course files
CREATE POLICY "staff_delete_course_files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-files'
  AND EXISTS (
    SELECT 1 FROM files f
    JOIN enrollments e ON e.course_id = f.course_id
    WHERE f.storage_path = name
      AND e.user_id = auth.uid()
      AND e.role IN ('instructor', 'ta')
  )
);
```

### 4. Optional: Add Extended File Columns

If you want external links, YouTube embeds, and visibility control:

```sql
-- Add extended columns to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_youtube BOOLEAN DEFAULT false;

-- Add hidden column to announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;

-- Add hidden column to modules
ALTER TABLE modules ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
```

---

## Summary of Issues to Fix

| Priority | Issue | Fix |
|----------|-------|-----|
| 🔴 Critical | RLS disabled on all tables | Run migration #1 |
| 🔴 Critical | course-files storage policy broken | Run migration #3 |
| 🟡 Medium | Missing policies on 3 tables | Run migration #2 |
| 🟢 Optional | Missing columns for extended features | Run migration #4 |

---

## After Applying Migrations

Once you've run the SQL migrations, verify:

1. Go to Authentication > Policies in Supabase Dashboard
2. Each table should show "RLS Enabled"
3. Test as a student user that they can only see their own data
4. Test as an instructor that they can manage course content
