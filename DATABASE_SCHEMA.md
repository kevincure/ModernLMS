# Campus LMS - Supabase Database Schema

## Overview
This document describes the Supabase PostgreSQL database schema for the Campus LMS application.

## Tables

### profiles
User profiles, extends Supabase auth.users.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | References auth.users(id) |
| email | TEXT | User's email (unique) |
| name | TEXT | Display name |
| avatar | TEXT | Initials or URL |
| gemini_key | TEXT | User's Gemini API key (encrypted) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### courses
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| name | TEXT | Course name (e.g., "ECON 101 - Introduction to Economics") |
| code | TEXT | Course code (e.g., "ECON101") |
| description | TEXT | Course description |
| invite_code | TEXT | Unique code for joining |
| created_by | UUID (FK) | References profiles(id) |
| start_here_title | TEXT | Title for start here section |
| start_here_content | TEXT | Markdown content |
| active | BOOLEAN | Whether course is active |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### enrollments
Maps users to courses with roles.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| user_id | UUID (FK) | References profiles(id) |
| course_id | UUID (FK) | References courses(id) |
| role | enrollment_role | 'instructor', 'ta', or 'student' |
| enrolled_at | TIMESTAMPTZ | |

**Unique constraint:** (user_id, course_id)

### invites
Pending course invitations.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| course_id | UUID (FK) | References courses(id) |
| email | TEXT | Invited email |
| role | enrollment_role | Role to assign |
| status | invite_status | 'pending', 'accepted', 'expired' |
| invited_by | UUID (FK) | References profiles(id) |
| created_at | TIMESTAMPTZ | |
| accepted_at | TIMESTAMPTZ | |

### assignments
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| course_id | UUID (FK) | References courses(id) |
| title | TEXT | Assignment title |
| description | TEXT | Markdown description |
| points | INTEGER | Max points (default 100) |
| status | content_status | 'draft' or 'published' |
| due_date | TIMESTAMPTZ | |
| allow_late_submissions | BOOLEAN | |
| late_deduction | INTEGER | Percentage per day |
| allow_resubmission | BOOLEAN | |
| category | TEXT | e.g., 'homework', 'essay', 'exam' |
| created_by | UUID (FK) | References profiles(id) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### submissions
Student assignment submissions.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| assignment_id | UUID (FK) | References assignments(id) |
| user_id | UUID (FK) | References profiles(id) |
| content | TEXT | Submission text/content |
| file_name | TEXT | Uploaded file name |
| file_path | TEXT | Supabase storage path |
| submitted_at | TIMESTAMPTZ | |

**Unique constraint:** (assignment_id, user_id)

### grades
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| submission_id | UUID (FK) | References submissions(id) |
| score | NUMERIC(5,2) | Points earned |
| feedback | TEXT | Instructor feedback |
| released | BOOLEAN | Visible to student |
| graded_by | UUID (FK) | References profiles(id) |
| graded_at | TIMESTAMPTZ | |

### rubrics
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| assignment_id | UUID (FK) | References assignments(id) - unique |
| created_at | TIMESTAMPTZ | |

### rubric_criteria
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| rubric_id | UUID (FK) | References rubrics(id) |
| name | TEXT | Criterion name |
| description | TEXT | |
| points | INTEGER | Max points for criterion |
| position | INTEGER | Display order |

### grade_criteria_scores
Per-criterion scores for rubric grading.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| grade_id | UUID (FK) | References grades(id) |
| criterion_id | UUID (FK) | References rubric_criteria(id) |
| score | NUMERIC(5,2) | |
| comment | TEXT | |

### quizzes
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| course_id | UUID (FK) | References courses(id) |
| title | TEXT | |
| description | TEXT | |
| status | content_status | 'draft' or 'published' |
| due_date | TIMESTAMPTZ | |
| time_limit | INTEGER | Minutes, NULL = unlimited |
| attempts_allowed | INTEGER | |
| randomize_questions | BOOLEAN | |
| question_pool_enabled | BOOLEAN | |
| question_select_count | INTEGER | Questions to show from pool |
| created_by | UUID (FK) | References profiles(id) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### quiz_questions
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| quiz_id | UUID (FK) | References quizzes(id) |
| type | question_type | 'multiple_choice', 'true_false', 'short_answer' |
| prompt | TEXT | Question text |
| options | JSONB | Array of option strings |
| correct_answer | JSONB | Index for MC, "True"/"False" for TF |
| points | INTEGER | |
| position | INTEGER | Display order |

### quiz_submissions
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| quiz_id | UUID (FK) | References quizzes(id) |
| user_id | UUID (FK) | References profiles(id) |
| answers | JSONB | { "question_id": "answer_value" } |
| score | NUMERIC(5,2) | |
| started_at | TIMESTAMPTZ | |
| submitted_at | TIMESTAMPTZ | |
| attempt_number | INTEGER | |

### announcements
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| course_id | UUID (FK) | References courses(id) |
| title | TEXT | |
| content | TEXT | Markdown content |
| pinned | BOOLEAN | |
| hidden | BOOLEAN | Hidden from students (default false) |
| author_id | UUID (FK) | References profiles(id) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### files
Course file metadata (actual files in Supabase Storage).
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| course_id | UUID (FK) | References courses(id) |
| name | TEXT | Display name |
| type | TEXT | File extension or type |
| size | INTEGER | File size in bytes |
| storage_path | TEXT | Path in 'course-files' bucket |
| uploaded_by | UUID (FK) | References profiles(id) |
| uploaded_at | TIMESTAMPTZ | |
| external_url | TEXT | URL for external links |
| description | TEXT | Optional description |
| is_placeholder | BOOLEAN | True if placeholder entry |
| is_youtube | BOOLEAN | True if YouTube embed |
| hidden | BOOLEAN | Hidden from students (default false) |

### modules
Content organization units (weeks, topics).
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| course_id | UUID (FK) | References courses(id) |
| name | TEXT | e.g., "Week 1: Introduction" |
| position | INTEGER | Display order |
| hidden | BOOLEAN | Hidden from students (default false) |
| created_at | TIMESTAMPTZ | |

### module_items
Items within modules.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| module_id | UUID (FK) | References modules(id) |
| type | module_item_type | 'assignment', 'quiz', 'file', 'external_link' |
| ref_id | UUID | References assignment, quiz, or file |
| title | TEXT | For external_link type |
| url | TEXT | For external_link type |
| position | INTEGER | Display order |

### grade_categories
Weighted grading categories.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| course_id | UUID (FK) | References courses(id) |
| name | TEXT | e.g., "Homework", "Exams" |
| weight | NUMERIC(5,4) | e.g., 0.30 = 30% |

### notifications
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| user_id | UUID (FK) | References profiles(id) |
| type | notification_type | See enum below |
| title | TEXT | |
| message | TEXT | |
| course_id | UUID (FK) | References courses(id) |
| ref_id | UUID | Related entity |
| read | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

### question_banks
Reusable question pools.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| course_id | UUID (FK) | References courses(id) |
| name | TEXT | |
| created_at | TIMESTAMPTZ | |

### bank_questions
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| bank_id | UUID (FK) | References question_banks(id) |
| type | question_type | |
| prompt | TEXT | |
| options | JSONB | |
| correct_answer | JSONB | |
| points | INTEGER | |

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

## Storage Buckets

### course-files
Private bucket for course materials.
- Policy: Enrolled users can read files for their courses

### submissions
Private bucket for student submissions.
- Policy: Users can manage files in their own folder (`{user_id}/...`)

## Row Level Security (RLS)

All tables have RLS enabled. Key policies:

- **profiles**: Authenticated users can read all; users can update own
- **courses**: Visible to enrolled users; instructors can manage
- **enrollments**: Users see own; instructors see all in their courses
- **assignments**: Enrolled see published; staff see all and can manage
- **submissions**: Students see own; staff see all in their courses
- **grades**: Students see own released grades; staff see all
- **quizzes**: Same as assignments
- **announcements**: Enrolled can read; staff can manage
- **files**: Enrolled can read; staff can manage
- **notifications**: Users see/manage own only

## Triggers

### on_auth_user_created
Creates a profile when a new user signs up.

### on_profile_created
Processes pending invites and creates enrollments.

### update_*_updated_at
Updates `updated_at` timestamp on row changes.

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
| `isPlaceholder` | `is_placeholder` |
| `isYouTube` | `is_youtube` |
| `externalUrl` | `external_url` |
| etc. | etc. |

## SQL Migrations

If you need to add the `hidden` column to existing tables, run these in Supabase SQL Editor:

```sql
-- Add hidden column to announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;

-- Add hidden column to modules
ALTER TABLE modules ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;

-- Add columns to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_youtube BOOLEAN DEFAULT false;

-- If your files table uses mime_type/size_bytes instead of type/size, rename them:
-- ALTER TABLE files RENAME COLUMN mime_type TO type;
-- ALTER TABLE files RENAME COLUMN size_bytes TO size;
```
