# Database schema

Source: `remote_schema.sql` exported from Supabase/Postgres.

## Summary

- Schemas documented: **1** (mostly `public`)

- Tables: **28**

- Enum types: **6**

- SQL functions: **5**

- Foreign keys: **45**


## Enum types

### `public.content_status`

`draft`, `published`

### `public.enrollment_role`

`instructor`, `ta`, `student`

### `public.invite_status`

`pending`, `accepted`, `expired`

### `public.module_item_type`

`assignment`, `quiz`, `file`, `external_link`

### `public.notification_type`

`grade_released`, `assignment_due`, `announcement`, `submission_received`, `quiz_available`, `invite`

### `public.question_type`

`multiple_choice`, `true_false`, `short_answer`, `mc_single`, `mc_multi`, `essay`, `matching`, `ordering`


## Functions

- `public.handle_new_user()`

- `public.is_course_creator("p_course_id" "uuid")`

- `public.is_course_instructor("p_course_id" "uuid")`

- `public.process_pending_invites()`

- `public.update_updated_at()`


## Tables


### `public.academic_sessions`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"gen_random_uuid"()||
|title|"text"|NO|||
|type|"text"|NO|'schoolYear'::"text"||
|start_date|"date"|NO|||
|end_date|"date"|NO|||
|status|"text"|NO|'active'::"text"||
|updated_at|timestamp|NO|"now"()||



### `public.announcements`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|course_id|"uuid"|YES|||
|title|"text"|NO|||
|content|"text"|YES|||
|pinned|boolean|YES|false||
|author_id|"uuid"|YES|||
|created_at|timestamp|YES|"now"()||
|updated_at|timestamp|YES|"now"()||
|hidden|boolean|YES|false||


**Foreign keys (outgoing):**

- `"author_id"` → `public.profiles("id")`  (constraint `announcements_author_id_fkey`)

- `"course_id"` → `public.courses("id")`  (constraint `announcements_course_id_fkey`)



### `public.assignment_overrides`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"gen_random_uuid"()||
|assignment_id|"uuid"|NO|||
|user_id|"uuid"|NO|||
|due_date|timestamp|YES|||
|created_at|timestamp|NO|"now"()||
|available_from|timestamp|YES|||
|available_until|timestamp|YES|||
|time_allowed|integer|YES|||
|time_limit|integer|YES|||
|submission_attempts|integer|YES|||


**Foreign keys (outgoing):**

- `"assignment_id"` → `public.assignments("id")`  (constraint `assignment_overrides_assignment_id_fkey`)

- `"user_id"` → `public.profiles("id")`  (constraint `assignment_overrides_user_id_fkey`)



### `public.assignments`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|course_id|"uuid"|YES|||
|title|"text"|NO|||
|description|"text"|YES|||
|points|integer|YES|100||
|status|"public"."content_status"|YES|'draft'::"public"."content_status"||
|due_date|timestamp|YES|||
|allow_late_submissions|boolean|YES|true||
|late_deduction|integer|YES|10||
|allow_resubmission|boolean|YES|true||
|category|"text"|YES|'homework'::"text"||
|created_by|"uuid"|YES|||
|created_at|timestamp|YES|"now"()||
|updated_at|timestamp|YES|"now"()||
|available_from|timestamp|YES|||
|available_until|timestamp|YES|||
|hidden|boolean|YES|false||
|time_allowed|integer|YES|||
|assignment_type|"text"|YES|'essay'::"text"||
|grading_type|"text"|YES|'points'::"text"||
|submission_modalities|"jsonb"|YES|'["text"]'::"jsonb"||
|allowed_file_types|"jsonb"|YES|'[]'::"jsonb"||
|max_file_size_mb|integer|YES|50||
|question_bank_id|"uuid"|YES|||
|submission_attempts|integer|YES|||
|time_limit|integer|YES|||
|randomize_questions|boolean|YES|false||


**Table constraints (from CREATE TABLE):**

- `CONSTRAINT "assignments_assignment_type_check" CHECK (("assignment_type" = ANY (ARRAY['essay'::"text", 'quiz'::"text", 'no_submission'::"text"])))`

- `CONSTRAINT "assignments_grading_type_check" CHECK (("grading_type" = ANY (ARRAY['points'::"text", 'complete_incomplete'::"text", 'letter_grade'::"text"])))`


**Foreign keys (outgoing):**

- `"course_id"` → `public.courses("id")`  (constraint `assignments_course_id_fkey`)

- `"created_by"` → `public.profiles("id")`  (constraint `assignments_created_by_fkey`)

- `"question_bank_id"` → `public.question_banks("id")`  (constraint `assignments_question_bank_id_fkey`)


**Referenced by (incoming foreign keys):**

- `public.assignment_overrides("assignment_id")`  (constraint `assignment_overrides_assignment_id_fkey`)

- `public.quiz_submissions("assignment_id")`  (constraint `quiz_submissions_assignment_id_fkey`)

- `public.rubrics("assignment_id")`  (constraint `rubrics_assignment_id_fkey`)

- `public.submissions("assignment_id")`  (constraint `submissions_assignment_id_fkey`)



### `public.bank_questions`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|bank_id|"uuid"|YES|||
|type|"public"."question_type"|NO|||
|prompt|"text"|NO|||
|options|"jsonb"|YES|||
|correct_answer|"jsonb"|YES|||
|points|integer|YES|1||
|title|"text"|YES|||
|time_dependent|boolean|YES|false||
|time_limit|integer|YES|||
|feedback_general|"text"|YES|||
|feedback_correct|"text"|YES|||
|feedback_incorrect|"text"|YES|||
|hint|"text"|YES|||
|alt_text_required|boolean|YES|false||
|curriculum_alignment|"jsonb"|YES|'[]'::"jsonb"||
|shuffle_options|boolean|YES|false||
|partial_credit|"text"|YES|'all_or_nothing'::"text"||
|case_sensitive|boolean|YES|false||
|expected_length|integer|YES|||
|position|integer|YES|0||


**Table constraints (from CREATE TABLE):**

- `CONSTRAINT "bank_questions_partial_credit_check" CHECK (("partial_credit" = ANY (ARRAY['all_or_nothing'::"text", 'per_correct'::"text", 'penalize_incorrect'::"text"])))`


**Foreign keys (outgoing):**

- `"bank_id"` → `public.question_banks("id")`  (constraint `bank_questions_bank_id_fkey`)



### `public.courses`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|name|"text"|NO|||
|code|"text"|NO|||
|description|"text"|YES|||
|invite_code|"text"|NO|||
|created_by|"uuid"|YES|||
|start_here_title|"text"|YES|'Start Here'::"text"||
|start_here_content|"text"|YES|||
|active|boolean|YES|true||
|created_at|timestamp|YES|"now"()||
|updated_at|timestamp|YES|"now"()||
|start_here_links|"jsonb"|YES|'[]'::"jsonb"||
|oneroster_status|"text"|NO|'active'::"text"||
|date_last_modified|timestamp|NO|"now"()||


**Foreign keys (outgoing):**

- `"created_by"` → `public.profiles("id")`  (constraint `courses_created_by_fkey`)


**Referenced by (incoming foreign keys):**

- `public.announcements("course_id")`  (constraint `announcements_course_id_fkey`)

- `public.assignments("course_id")`  (constraint `assignments_course_id_fkey`)

- `public.discussion_threads("course_id")`  (constraint `discussion_threads_course_id_fkey`)

- `public.enrollments("course_id")`  (constraint `enrollments_course_id_fkey`)

- `public.files("course_id")`  (constraint `files_course_id_fkey`)

- `public.grade_categories("course_id")`  (constraint `grade_categories_course_id_fkey`)

- `public.grade_settings("course_id")`  (constraint `grade_settings_course_id_fkey`)

- `public.invites("course_id")`  (constraint `invites_course_id_fkey`)

- `public.modules("course_id")`  (constraint `modules_course_id_fkey`)

- `public.notifications("course_id")`  (constraint `notifications_course_id_fkey`)

- `public.question_banks("course_id")`  (constraint `question_banks_course_id_fkey`)

- `public.quizzes("course_id")`  (constraint `quizzes_course_id_fkey`)



### `public.discussion_replies`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"gen_random_uuid"()||
|thread_id|"uuid"|NO|||
|content|"text"|NO|||
|author_id|"uuid"|NO|||
|is_ai|boolean|NO|false||
|created_at|timestamp|NO|"now"()||


**Foreign keys (outgoing):**

- `"author_id"` → `public.profiles("id")`  (constraint `discussion_replies_author_id_fkey`)

- `"thread_id"` → `public.discussion_threads("id")`  (constraint `discussion_replies_thread_id_fkey`)



### `public.discussion_threads`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"gen_random_uuid"()||
|course_id|"uuid"|NO|||
|title|"text"|NO|||
|content|"text"|YES|||
|author_id|"uuid"|NO|||
|pinned|boolean|NO|false||
|hidden|boolean|NO|false||
|created_at|timestamp|NO|"now"()||


**Foreign keys (outgoing):**

- `"author_id"` → `public.profiles("id")`  (constraint `discussion_threads_author_id_fkey`)

- `"course_id"` → `public.courses("id")`  (constraint `discussion_threads_course_id_fkey`)


**Referenced by (incoming foreign keys):**

- `public.discussion_replies("thread_id")`  (constraint `discussion_replies_thread_id_fkey`)



### `public.enrollments`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|user_id|"uuid"|YES|||
|course_id|"uuid"|YES|||
|role|"public"."enrollment_role"|NO|'student'::"public"."enrollment_role"||
|enrolled_at|timestamp|YES|"now"()||
|oneroster_status|"text"|NO|'active'::"text"||
|date_last_modified|timestamp|NO|"now"()||


**Foreign keys (outgoing):**

- `"course_id"` → `public.courses("id")`  (constraint `enrollments_course_id_fkey`)

- `"user_id"` → `public.profiles("id")`  (constraint `enrollments_user_id_fkey`)



### `public.files`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|course_id|"uuid"|YES|||
|name|"text"|NO|||
|mime_type|"text"|YES|||
|size_bytes|integer|YES|||
|storage_path|"text"|NO|||
|uploaded_by|"uuid"|YES|||
|uploaded_at|timestamp|YES|"now"()||
|hidden|boolean|YES|false||
|external_url|"text"|YES|||
|description|"text"|YES|||
|is_placeholder|boolean|YES|false||
|is_youtube|boolean|YES|false||


**Foreign keys (outgoing):**

- `"course_id"` → `public.courses("id")`  (constraint `files_course_id_fkey`)

- `"uploaded_by"` → `public.profiles("id")`  (constraint `files_uploaded_by_fkey`)



### `public.grade_categories`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|course_id|"uuid"|YES|||
|name|"text"|NO|||
|weight|numeric(5,4)|YES|0||


**Foreign keys (outgoing):**

- `"course_id"` → `public.courses("id")`  (constraint `grade_categories_course_id_fkey`)



### `public.grade_criteria_scores`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|grade_id|"uuid"|YES|||
|criterion_id|"uuid"|YES|||
|score|numeric(5,2)|YES|||
|comment|"text"|YES|||


**Foreign keys (outgoing):**

- `"criterion_id"` → `public.rubric_criteria("id")`  (constraint `grade_criteria_scores_criterion_id_fkey`)

- `"grade_id"` → `public.grades("id")`  (constraint `grade_criteria_scores_grade_id_fkey`)



### `public.grade_settings`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"gen_random_uuid"()||
|course_id|"uuid"|NO|||
|a_min|numeric|NO|90||
|b_min|numeric|NO|80||
|c_min|numeric|NO|70||
|d_min|numeric|NO|60||
|curve|numeric|NO|0||
|extra_credit_enabled|boolean|NO|false||
|created_at|timestamp|NO|"now"()||


**Foreign keys (outgoing):**

- `"course_id"` → `public.courses("id")`  (constraint `grade_settings_course_id_fkey`)



### `public.grades`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|submission_id|"uuid"|YES|||
|score|numeric(5,2)|YES|||
|feedback|"text"|YES|||
|released|boolean|YES|false||
|graded_by|"uuid"|YES|||
|graded_at|timestamp|YES|"now"()||


**Foreign keys (outgoing):**

- `"graded_by"` → `public.profiles("id")`  (constraint `grades_graded_by_fkey`)

- `"submission_id"` → `public.submissions("id")`  (constraint `grades_submission_id_fkey`)


**Referenced by (incoming foreign keys):**

- `public.grade_criteria_scores("grade_id")`  (constraint `grade_criteria_scores_grade_id_fkey`)



### `public.invites`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|course_id|"uuid"|YES|||
|email|"text"|NO|||
|role|"public"."enrollment_role"|NO|'student'::"public"."enrollment_role"||
|status|"public"."invite_status"|YES|'pending'::"public"."invite_status"||
|invited_by|"uuid"|YES|||
|created_at|timestamp|YES|"now"()||
|accepted_at|timestamp|YES|||


**Foreign keys (outgoing):**

- `"course_id"` → `public.courses("id")`  (constraint `invites_course_id_fkey`)

- `"invited_by"` → `public.profiles("id")`  (constraint `invites_invited_by_fkey`)



### `public.module_items`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|module_id|"uuid"|YES|||
|type|"public"."module_item_type"|NO|||
|ref_id|"uuid"|YES|||
|title|"text"|YES|||
|url|"text"|YES|||
|position|integer|YES|0||


**Foreign keys (outgoing):**

- `"module_id"` → `public.modules("id")`  (constraint `module_items_module_id_fkey`)



### `public.modules`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|course_id|"uuid"|YES|||
|name|"text"|NO|||
|position|integer|YES|0||
|created_at|timestamp|YES|"now"()||
|hidden|boolean|YES|false||


**Foreign keys (outgoing):**

- `"course_id"` → `public.courses("id")`  (constraint `modules_course_id_fkey`)


**Referenced by (incoming foreign keys):**

- `public.module_items("module_id")`  (constraint `module_items_module_id_fkey`)



### `public.notifications`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|user_id|"uuid"|YES|||
|type|"public"."notification_type"|NO|||
|title|"text"|NO|||
|message|"text"|YES|||
|course_id|"uuid"|YES|||
|ref_id|"uuid"|YES|||
|read|boolean|YES|false||
|created_at|timestamp|YES|"now"()||


**Foreign keys (outgoing):**

- `"course_id"` → `public.courses("id")`  (constraint `notifications_course_id_fkey`)

- `"user_id"` → `public.profiles("id")`  (constraint `notifications_user_id_fkey`)



### `public.orgs`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"gen_random_uuid"()||
|sourced_id|"text"|YES|||
|name|"text"|NO|||
|type|"text"|NO|'school'::"text"||
|identifier|"text"|YES|||
|parent_id|"uuid"|YES|||
|status|"text"|NO|'active'::"text"||
|updated_at|timestamp|NO|"now"()||


**Foreign keys (outgoing):**

- `"parent_id"` → `public.orgs("id")`  (constraint `orgs_parent_id_fkey`)


**Referenced by (incoming foreign keys):**

- `public.orgs("parent_id")`  (constraint `orgs_parent_id_fkey`)



### `public.profiles`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|||
|email|"text"|NO|||
|name|"text"|NO|||
|avatar|"text"|YES|||
|created_at|timestamp|YES|"now"()||
|updated_at|timestamp|YES|"now"()||
|gemini_key|"text"|YES|||
|sourced_id|"text"|YES|||
|given_name|"text"|YES|||
|family_name|"text"|YES|||
|oneroster_status|"text"|NO|'active'::"text"||
|date_last_modified|timestamp|NO|"now"()||


**Foreign keys (outgoing):**

- `"id"` → `auth.users("id")`  (constraint `profiles_id_fkey`)


**Referenced by (incoming foreign keys):**

- `public.announcements("author_id")`  (constraint `announcements_author_id_fkey`)

- `public.assignment_overrides("user_id")`  (constraint `assignment_overrides_user_id_fkey`)

- `public.assignments("created_by")`  (constraint `assignments_created_by_fkey`)

- `public.courses("created_by")`  (constraint `courses_created_by_fkey`)

- `public.discussion_replies("author_id")`  (constraint `discussion_replies_author_id_fkey`)

- `public.discussion_threads("author_id")`  (constraint `discussion_threads_author_id_fkey`)

- `public.enrollments("user_id")`  (constraint `enrollments_user_id_fkey`)

- `public.files("uploaded_by")`  (constraint `files_uploaded_by_fkey`)

- `public.grades("graded_by")`  (constraint `grades_graded_by_fkey`)

- `public.invites("invited_by")`  (constraint `invites_invited_by_fkey`)

- `public.notifications("user_id")`  (constraint `notifications_user_id_fkey`)

- `public.question_banks("created_by")`  (constraint `question_banks_created_by_fkey`)

- `public.quiz_submissions("user_id")`  (constraint `quiz_submissions_user_id_fkey`)

- `public.quiz_time_overrides("user_id")`  (constraint `quiz_time_overrides_user_id_fkey`)

- `public.quizzes("created_by")`  (constraint `quizzes_created_by_fkey`)

- `public.submissions("user_id")`  (constraint `submissions_user_id_fkey`)



### `public.question_banks`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|course_id|"uuid"|YES|||
|name|"text"|NO|||
|created_at|timestamp|YES|"now"()||
|description|"text"|YES|||
|default_points_per_question|numeric(5,2)|YES|1||
|randomize|boolean|YES|false||
|created_by|"uuid"|YES|||
|questions|"jsonb"|YES|'[]'::"jsonb"||
|updated_at|timestamp|YES|"now"()||


**Foreign keys (outgoing):**

- `"course_id"` → `public.courses("id")`  (constraint `question_banks_course_id_fkey`)

- `"created_by"` → `public.profiles("id")`  (constraint `question_banks_created_by_fkey`)


**Referenced by (incoming foreign keys):**

- `public.assignments("question_bank_id")`  (constraint `assignments_question_bank_id_fkey`)

- `public.bank_questions("bank_id")`  (constraint `bank_questions_bank_id_fkey`)



### `public.quiz_questions`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|quiz_id|"uuid"|YES|||
|type|"public"."question_type"|NO|||
|prompt|"text"|NO|||
|options|"jsonb"|YES|||
|correct_answer|"jsonb"|YES|||
|points|integer|YES|1||
|position|integer|YES|0||


**Foreign keys (outgoing):**

- `"quiz_id"` → `public.quizzes("id")`  (constraint `quiz_questions_quiz_id_fkey`)



### `public.quiz_submissions`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|quiz_id|"uuid"|YES|||
|user_id|"uuid"|YES|||
|answers|"jsonb"|YES|||
|score|numeric(5,2)|YES|||
|started_at|timestamp|YES|"now"()||
|submitted_at|timestamp|YES|||
|attempt_number|integer|YES|1||
|assignment_id|"uuid"|YES|||


**Foreign keys (outgoing):**

- `"assignment_id"` → `public.assignments("id")`  (constraint `quiz_submissions_assignment_id_fkey`)

- `"quiz_id"` → `public.quizzes("id")`  (constraint `quiz_submissions_quiz_id_fkey`)

- `"user_id"` → `public.profiles("id")`  (constraint `quiz_submissions_user_id_fkey`)



### `public.quiz_time_overrides`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"gen_random_uuid"()||
|quiz_id|"uuid"|NO|||
|user_id|"uuid"|NO|||
|time_limit|integer|YES|||
|created_at|timestamp|NO|"now"()||


**Foreign keys (outgoing):**

- `"quiz_id"` → `public.quizzes("id")`  (constraint `quiz_time_overrides_quiz_id_fkey`)

- `"user_id"` → `public.profiles("id")`  (constraint `quiz_time_overrides_user_id_fkey`)



### `public.quizzes`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|course_id|"uuid"|YES|||
|title|"text"|NO|||
|description|"text"|YES|||
|status|"public"."content_status"|YES|'draft'::"public"."content_status"||
|due_date|timestamp|YES|||
|time_limit|integer|YES|||
|attempts_allowed|integer|YES|1||
|randomize_questions|boolean|YES|false||
|question_pool_enabled|boolean|YES|false||
|question_select_count|integer|YES|||
|created_by|"uuid"|YES|||
|created_at|timestamp|YES|"now"()||
|updated_at|timestamp|YES|"now"()||


**Foreign keys (outgoing):**

- `"course_id"` → `public.courses("id")`  (constraint `quizzes_course_id_fkey`)

- `"created_by"` → `public.profiles("id")`  (constraint `quizzes_created_by_fkey`)


**Referenced by (incoming foreign keys):**

- `public.quiz_questions("quiz_id")`  (constraint `quiz_questions_quiz_id_fkey`)

- `public.quiz_submissions("quiz_id")`  (constraint `quiz_submissions_quiz_id_fkey`)

- `public.quiz_time_overrides("quiz_id")`  (constraint `quiz_time_overrides_quiz_id_fkey`)



### `public.rubric_criteria`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|rubric_id|"uuid"|YES|||
|name|"text"|NO|||
|description|"text"|YES|||
|points|integer|NO|||
|position|integer|YES|0||


**Foreign keys (outgoing):**

- `"rubric_id"` → `public.rubrics("id")`  (constraint `rubric_criteria_rubric_id_fkey`)


**Referenced by (incoming foreign keys):**

- `public.grade_criteria_scores("criterion_id")`  (constraint `grade_criteria_scores_criterion_id_fkey`)



### `public.rubrics`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|assignment_id|"uuid"|YES|||
|created_at|timestamp|YES|"now"()||


**Foreign keys (outgoing):**

- `"assignment_id"` → `public.assignments("id")`  (constraint `rubrics_assignment_id_fkey`)


**Referenced by (incoming foreign keys):**

- `public.rubric_criteria("rubric_id")`  (constraint `rubric_criteria_rubric_id_fkey`)



### `public.submissions`

|Column|Type|Nullable|Default|Notes|
|---|---|---|---|---|
|id|"uuid"|NO|"extensions"."uuid_generate_v4"()||
|assignment_id|"uuid"|YES|||
|user_id|"uuid"|YES|||
|content|"text"|YES|||
|file_name|"text"|YES|||
|file_path|"text"|YES|||
|submitted_at|timestamp|YES|"now"()||


**Foreign keys (outgoing):**

- `"assignment_id"` → `public.assignments("id")`  (constraint `submissions_assignment_id_fkey`)

- `"user_id"` → `public.profiles("id")`  (constraint `submissions_user_id_fkey`)


**Referenced by (incoming foreign keys):**

- `public.grades("submission_id")`  (constraint `grades_submission_id_fkey`)
