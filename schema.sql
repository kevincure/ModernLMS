


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."content_status" AS ENUM (
    'draft',
    'published'
);


ALTER TYPE "public"."content_status" OWNER TO "postgres";


CREATE TYPE "public"."enrollment_role" AS ENUM (
    'instructor',
    'ta',
    'student'
);


ALTER TYPE "public"."enrollment_role" OWNER TO "postgres";


CREATE TYPE "public"."invite_status" AS ENUM (
    'pending',
    'accepted',
    'expired'
);


ALTER TYPE "public"."invite_status" OWNER TO "postgres";


CREATE TYPE "public"."module_item_type" AS ENUM (
    'assignment',
    'quiz',
    'file',
    'external_link'
);


ALTER TYPE "public"."module_item_type" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'grade_released',
    'assignment_due',
    'announcement',
    'submission_received',
    'quiz_available',
    'invite'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."question_type" AS ENUM (
    'multiple_choice',
    'true_false',
    'short_answer'
);


ALTER TYPE "public"."question_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 1) || 
          LEFT(COALESCE(split_part(NEW.raw_user_meta_data->>'full_name', ' ', 2), ''), 1))
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_course_creator"("p_course_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM courses
    WHERE id = p_course_id
      AND created_by = auth.uid()
  )
$$;


ALTER FUNCTION "public"."is_course_creator"("p_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_course_instructor"("p_course_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM enrollments
    WHERE course_id = p_course_id
      AND user_id = auth.uid()
      AND role IN ('instructor', 'ta')
  )
$$;


ALTER FUNCTION "public"."is_course_instructor"("p_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_pending_invites"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Find all pending invites for this user's email and create enrollments
  INSERT INTO public.enrollments (user_id, course_id, role)
  SELECT NEW.id, i.course_id, i.role
  FROM public.invites i
  WHERE i.email = NEW.email AND i.status = 'pending'
  ON CONFLICT (user_id, course_id) DO NOTHING;

  -- Mark invites as accepted
  UPDATE public.invites
  SET status = 'accepted', accepted_at = NOW()
  WHERE email = NEW.email AND status = 'pending';

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_pending_invites"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academic_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" DEFAULT 'schoolYear'::"text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."academic_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "course_id" "uuid",
    "title" "text" NOT NULL,
    "content" "text",
    "pinned" boolean DEFAULT false,
    "author_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "hidden" boolean DEFAULT false
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "due_date" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assignment_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "course_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "points" integer DEFAULT 100,
    "status" "public"."content_status" DEFAULT 'draft'::"public"."content_status",
    "due_date" timestamp with time zone,
    "allow_late_submissions" boolean DEFAULT true,
    "late_deduction" integer DEFAULT 10,
    "allow_resubmission" boolean DEFAULT true,
    "category" "text" DEFAULT 'homework'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_questions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "bank_id" "uuid",
    "type" "public"."question_type" NOT NULL,
    "prompt" "text" NOT NULL,
    "options" "jsonb",
    "correct_answer" "jsonb",
    "points" integer DEFAULT 1
);


ALTER TABLE "public"."bank_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "invite_code" "text" NOT NULL,
    "created_by" "uuid",
    "start_here_title" "text" DEFAULT 'Start Here'::"text",
    "start_here_content" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "start_here_links" "jsonb" DEFAULT '[]'::"jsonb",
    "oneroster_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "date_last_modified" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discussion_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "is_ai" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."discussion_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discussion_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "author_id" "uuid" NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "hidden" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."discussion_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "course_id" "uuid",
    "role" "public"."enrollment_role" DEFAULT 'student'::"public"."enrollment_role" NOT NULL,
    "enrolled_at" timestamp with time zone DEFAULT "now"(),
    "oneroster_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "date_last_modified" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "course_id" "uuid",
    "name" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" integer,
    "storage_path" "text" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "hidden" boolean DEFAULT false,
    "external_url" "text",
    "description" "text",
    "is_placeholder" boolean DEFAULT false,
    "is_youtube" boolean DEFAULT false
);


ALTER TABLE "public"."files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grade_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "course_id" "uuid",
    "name" "text" NOT NULL,
    "weight" numeric(5,4) DEFAULT 0
);


ALTER TABLE "public"."grade_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grade_criteria_scores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "grade_id" "uuid",
    "criterion_id" "uuid",
    "score" numeric(5,2),
    "comment" "text"
);


ALTER TABLE "public"."grade_criteria_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grade_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "a_min" numeric DEFAULT 90 NOT NULL,
    "b_min" numeric DEFAULT 80 NOT NULL,
    "c_min" numeric DEFAULT 70 NOT NULL,
    "d_min" numeric DEFAULT 60 NOT NULL,
    "curve" numeric DEFAULT 0 NOT NULL,
    "extra_credit_enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."grade_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grades" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "submission_id" "uuid",
    "score" numeric(5,2),
    "feedback" "text",
    "released" boolean DEFAULT false,
    "graded_by" "uuid",
    "graded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."grades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "course_id" "uuid",
    "email" "text" NOT NULL,
    "role" "public"."enrollment_role" DEFAULT 'student'::"public"."enrollment_role" NOT NULL,
    "status" "public"."invite_status" DEFAULT 'pending'::"public"."invite_status",
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone
);


ALTER TABLE "public"."invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."module_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "module_id" "uuid",
    "type" "public"."module_item_type" NOT NULL,
    "ref_id" "uuid",
    "title" "text",
    "url" "text",
    "position" integer DEFAULT 0
);


ALTER TABLE "public"."module_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "course_id" "uuid",
    "name" "text" NOT NULL,
    "position" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "hidden" boolean DEFAULT false
);


ALTER TABLE "public"."modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "type" "public"."notification_type" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "course_id" "uuid",
    "ref_id" "uuid",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."oneroster_enrollments" AS
 SELECT ("id")::"text" AS "sourcedId",
    "oneroster_status" AS "status",
    "date_last_modified" AS "dateLastModified",
        CASE ("role")::"text"
            WHEN 'instructor'::"text" THEN 'teacher'::"text"
            WHEN 'ta'::"text" THEN 'teaching assistant'::"text"
            ELSE ("role")::"text"
        END AS "role",
    ("course_id")::"text" AS "classSourcedId",
    ("user_id")::"text" AS "userSourcedId"
   FROM "public"."enrollments";


ALTER VIEW "public"."oneroster_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orgs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sourced_id" "text" GENERATED ALWAYS AS (("id")::"text") STORED,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'school'::"text" NOT NULL,
    "identifier" "text",
    "parent_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."orgs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "avatar" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "gemini_key" "text",
    "sourced_id" "text" GENERATED ALWAYS AS (("id")::"text") STORED,
    "given_name" "text",
    "family_name" "text",
    "oneroster_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "date_last_modified" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_banks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "course_id" "uuid",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."question_banks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_questions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "quiz_id" "uuid",
    "type" "public"."question_type" NOT NULL,
    "prompt" "text" NOT NULL,
    "options" "jsonb",
    "correct_answer" "jsonb",
    "points" integer DEFAULT 1,
    "position" integer DEFAULT 0
);


ALTER TABLE "public"."quiz_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_submissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "quiz_id" "uuid",
    "user_id" "uuid",
    "answers" "jsonb",
    "score" numeric(5,2),
    "started_at" timestamp with time zone DEFAULT "now"(),
    "submitted_at" timestamp with time zone,
    "attempt_number" integer DEFAULT 1
);


ALTER TABLE "public"."quiz_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_time_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quiz_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "time_limit" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quiz_time_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quizzes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "course_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "public"."content_status" DEFAULT 'draft'::"public"."content_status",
    "due_date" timestamp with time zone,
    "time_limit" integer,
    "attempts_allowed" integer DEFAULT 1,
    "randomize_questions" boolean DEFAULT false,
    "question_pool_enabled" boolean DEFAULT false,
    "question_select_count" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quizzes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubric_criteria" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "rubric_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "points" integer NOT NULL,
    "position" integer DEFAULT 0
);


ALTER TABLE "public"."rubric_criteria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubrics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "assignment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rubrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "assignment_id" "uuid",
    "user_id" "uuid",
    "content" "text",
    "file_name" "text",
    "file_path" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academic_sessions"
    ADD CONSTRAINT "academic_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_overrides"
    ADD CONSTRAINT "assignment_overrides_assignment_id_user_id_key" UNIQUE ("assignment_id", "user_id");



ALTER TABLE ONLY "public"."assignment_overrides"
    ADD CONSTRAINT "assignment_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_questions"
    ADD CONSTRAINT "bank_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discussion_replies"
    ADD CONSTRAINT "discussion_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discussion_threads"
    ADD CONSTRAINT "discussion_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_user_id_course_id_key" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grade_categories"
    ADD CONSTRAINT "grade_categories_course_id_name_key" UNIQUE ("course_id", "name");



ALTER TABLE ONLY "public"."grade_categories"
    ADD CONSTRAINT "grade_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grade_criteria_scores"
    ADD CONSTRAINT "grade_criteria_scores_grade_id_criterion_id_key" UNIQUE ("grade_id", "criterion_id");



ALTER TABLE ONLY "public"."grade_criteria_scores"
    ADD CONSTRAINT "grade_criteria_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grade_settings"
    ADD CONSTRAINT "grade_settings_course_id_key" UNIQUE ("course_id");



ALTER TABLE ONLY "public"."grade_settings"
    ADD CONSTRAINT "grade_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_submission_id_key" UNIQUE ("submission_id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_course_id_email_key" UNIQUE ("course_id", "email");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_items"
    ADD CONSTRAINT "module_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orgs"
    ADD CONSTRAINT "orgs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_banks"
    ADD CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_submissions"
    ADD CONSTRAINT "quiz_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_time_overrides"
    ADD CONSTRAINT "quiz_time_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_time_overrides"
    ADD CONSTRAINT "quiz_time_overrides_quiz_id_user_id_key" UNIQUE ("quiz_id", "user_id");



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubric_criteria"
    ADD CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubrics"
    ADD CONSTRAINT "rubrics_assignment_id_key" UNIQUE ("assignment_id");



ALTER TABLE ONLY "public"."rubrics"
    ADD CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_assignment_id_user_id_key" UNIQUE ("assignment_id", "user_id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_announcements_course" ON "public"."announcements" USING "btree" ("course_id");



CREATE INDEX "idx_assignments_course" ON "public"."assignments" USING "btree" ("course_id");



CREATE INDEX "idx_enrollments_course" ON "public"."enrollments" USING "btree" ("course_id");



CREATE INDEX "idx_enrollments_user" ON "public"."enrollments" USING "btree" ("user_id");



CREATE INDEX "idx_files_course" ON "public"."files" USING "btree" ("course_id");



CREATE INDEX "idx_invites_course" ON "public"."invites" USING "btree" ("course_id");



CREATE INDEX "idx_invites_email" ON "public"."invites" USING "btree" ("email");



CREATE INDEX "idx_modules_course" ON "public"."modules" USING "btree" ("course_id");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_quizzes_course" ON "public"."quizzes" USING "btree" ("course_id");



CREATE INDEX "idx_submissions_assignment" ON "public"."submissions" USING "btree" ("assignment_id");



CREATE INDEX "idx_submissions_user" ON "public"."submissions" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "on_profile_created" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."process_pending_invites"();



CREATE OR REPLACE TRIGGER "update_announcements_updated_at" BEFORE UPDATE ON "public"."announcements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_assignments_updated_at" BEFORE UPDATE ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_courses_updated_at" BEFORE UPDATE ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_quizzes_updated_at" BEFORE UPDATE ON "public"."quizzes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_overrides"
    ADD CONSTRAINT "assignment_overrides_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_overrides"
    ADD CONSTRAINT "assignment_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bank_questions"
    ADD CONSTRAINT "bank_questions_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."question_banks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."discussion_replies"
    ADD CONSTRAINT "discussion_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."discussion_replies"
    ADD CONSTRAINT "discussion_replies_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."discussion_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discussion_threads"
    ADD CONSTRAINT "discussion_threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."discussion_threads"
    ADD CONSTRAINT "discussion_threads_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."grade_categories"
    ADD CONSTRAINT "grade_categories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grade_criteria_scores"
    ADD CONSTRAINT "grade_criteria_scores_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "public"."rubric_criteria"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grade_criteria_scores"
    ADD CONSTRAINT "grade_criteria_scores_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grade_settings"
    ADD CONSTRAINT "grade_settings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."module_items"
    ADD CONSTRAINT "module_items_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orgs"
    ADD CONSTRAINT "orgs_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."orgs"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_banks"
    ADD CONSTRAINT "question_banks_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_submissions"
    ADD CONSTRAINT "quiz_submissions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_submissions"
    ADD CONSTRAINT "quiz_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_time_overrides"
    ADD CONSTRAINT "quiz_time_overrides_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_time_overrides"
    ADD CONSTRAINT "quiz_time_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."rubric_criteria"
    ADD CONSTRAINT "rubric_criteria_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rubrics"
    ADD CONSTRAINT "rubrics_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Course creators can add enrollments" ON "public"."enrollments" FOR INSERT WITH CHECK ("public"."is_course_creator"("course_id"));



CREATE POLICY "Course creators can update their courses" ON "public"."courses" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Courses visible to enrolled or created" ON "public"."courses" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "courses"."id") AND ("enrollments"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Enrolled see announcements" ON "public"."announcements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "announcements"."course_id") AND ("enrollments"."user_id" = "auth"."uid"())))));



CREATE POLICY "Enrolled see bank questions" ON "public"."bank_questions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."question_banks" "qb"
     JOIN "public"."enrollments" "e" ON (("e"."course_id" = "qb"."course_id")))
  WHERE (("qb"."id" = "bank_questions"."bank_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "Enrolled see files" ON "public"."files" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "files"."course_id") AND ("enrollments"."user_id" = "auth"."uid"())))));



CREATE POLICY "Enrolled see grade categories" ON "public"."grade_categories" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "grade_categories"."course_id") AND ("enrollments"."user_id" = "auth"."uid"())))));



CREATE POLICY "Enrolled see modules" ON "public"."modules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "modules"."course_id") AND ("enrollments"."user_id" = "auth"."uid"())))));



CREATE POLICY "Enrolled see published assignments" ON "public"."assignments" FOR SELECT USING (((("status" = 'published'::"public"."content_status") AND (EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "assignments"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "assignments"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"])))))));



CREATE POLICY "Enrolled see published quizzes" ON "public"."quizzes" FOR SELECT USING (((("status" = 'published'::"public"."content_status") AND (EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "quizzes"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "quizzes"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"])))))));



CREATE POLICY "Enrolled see question banks" ON "public"."question_banks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "question_banks"."course_id") AND ("enrollments"."user_id" = "auth"."uid"())))));



CREATE POLICY "Instructors can manage courses" ON "public"."courses" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "courses"."id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = 'instructor'::"public"."enrollment_role")))));



CREATE POLICY "Profiles are viewable by authenticated users" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "See module items" ON "public"."module_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."modules" "m"
  WHERE (("m"."id" = "module_items"."module_id") AND (EXISTS ( SELECT 1
           FROM "public"."enrollments"
          WHERE (("enrollments"."course_id" = "m"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "See quiz questions" ON "public"."quiz_questions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quizzes" "q"
  WHERE (("q"."id" = "quiz_questions"."quiz_id") AND ((("q"."status" = 'published'::"public"."content_status") AND (EXISTS ( SELECT 1
           FROM "public"."enrollments"
          WHERE (("enrollments"."course_id" = "q"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
           FROM "public"."enrollments"
          WHERE (("enrollments"."course_id" = "q"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))))))));



CREATE POLICY "See rubric criteria" ON "public"."rubric_criteria" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."rubrics" "r"
     JOIN "public"."assignments" "a" ON (("a"."id" = "r"."assignment_id")))
  WHERE (("r"."id" = "rubric_criteria"."rubric_id") AND (EXISTS ( SELECT 1
           FROM "public"."enrollments"
          WHERE (("enrollments"."course_id" = "a"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "See rubrics" ON "public"."rubrics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."id" = "rubrics"."assignment_id") AND (EXISTS ( SELECT 1
           FROM "public"."enrollments"
          WHERE (("enrollments"."course_id" = "a"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Staff can delete enrollments" ON "public"."enrollments" FOR DELETE USING (("public"."is_course_creator"("course_id") OR "public"."is_course_instructor"("course_id")));



CREATE POLICY "Staff can grade" ON "public"."grades" USING ((EXISTS ( SELECT 1
   FROM (("public"."submissions" "s"
     JOIN "public"."assignments" "a" ON (("a"."id" = "s"."assignment_id")))
     JOIN "public"."enrollments" "e" ON (("e"."course_id" = "a"."course_id")))
  WHERE (("s"."id" = "grades"."submission_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff can update enrollments" ON "public"."enrollments" FOR UPDATE USING (("public"."is_course_creator"("course_id") OR "public"."is_course_instructor"("course_id")));



CREATE POLICY "Staff manage announcements" ON "public"."announcements" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "announcements"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff manage assignments" ON "public"."assignments" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "assignments"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff manage bank questions" ON "public"."bank_questions" USING ((EXISTS ( SELECT 1
   FROM ("public"."question_banks" "qb"
     JOIN "public"."enrollments" "e" ON (("e"."course_id" = "qb"."course_id")))
  WHERE (("qb"."id" = "bank_questions"."bank_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff manage criteria scores" ON "public"."grade_criteria_scores" USING ((EXISTS ( SELECT 1
   FROM ((("public"."grades" "g"
     JOIN "public"."submissions" "s" ON (("s"."id" = "g"."submission_id")))
     JOIN "public"."assignments" "a" ON (("a"."id" = "s"."assignment_id")))
     JOIN "public"."enrollments" "e" ON (("e"."course_id" = "a"."course_id")))
  WHERE (("g"."id" = "grade_criteria_scores"."grade_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff manage files" ON "public"."files" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "files"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff manage grade categories" ON "public"."grade_categories" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "grade_categories"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff manage invites" ON "public"."invites" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "invites"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff manage module items" ON "public"."module_items" USING ((EXISTS ( SELECT 1
   FROM ("public"."modules" "m"
     JOIN "public"."enrollments" "e" ON (("e"."course_id" = "m"."course_id")))
  WHERE (("m"."id" = "module_items"."module_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff manage modules" ON "public"."modules" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "modules"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff manage question banks" ON "public"."question_banks" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "question_banks"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff manage quizzes" ON "public"."quizzes" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "quizzes"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff see all grades" ON "public"."grades" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."submissions" "s"
     JOIN "public"."assignments" "a" ON (("a"."id" = "s"."assignment_id")))
     JOIN "public"."enrollments" "e" ON (("e"."course_id" = "a"."course_id")))
  WHERE (("s"."id" = "grades"."submission_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff see course enrollments" ON "public"."enrollments" FOR SELECT USING (("public"."is_course_creator"("course_id") OR "public"."is_course_instructor"("course_id")));



CREATE POLICY "Staff see course invites" ON "public"."invites" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "invites"."course_id") AND ("enrollments"."user_id" = "auth"."uid"()) AND ("enrollments"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff see quiz submissions" ON "public"."quiz_submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."quizzes" "q"
     JOIN "public"."enrollments" "e" ON (("e"."course_id" = "q"."course_id")))
  WHERE (("q"."id" = "quiz_submissions"."quiz_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Staff see submissions" ON "public"."submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."enrollments" "e" ON (("e"."course_id" = "a"."course_id")))
  WHERE (("a"."id" = "submissions"."assignment_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "Students can resubmit" ON "public"."submissions" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Students can submit" ON "public"."submissions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Students can submit quiz" ON "public"."quiz_submissions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Students see own quiz submissions" ON "public"."quiz_submissions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Students see own released criteria scores" ON "public"."grade_criteria_scores" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."grades" "g"
     JOIN "public"."submissions" "s" ON (("s"."id" = "g"."submission_id")))
  WHERE (("g"."id" = "grade_criteria_scores"."grade_id") AND ("s"."user_id" = "auth"."uid"()) AND ("g"."released" = true)))));



CREATE POLICY "Students see own submissions" ON "public"."submissions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Students see released grades" ON "public"."grades" FOR SELECT USING ((("released" = true) AND (EXISTS ( SELECT 1
   FROM "public"."submissions"
  WHERE (("submissions"."id" = "grades"."submission_id") AND ("submissions"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create courses" ON "public"."courses" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can insert own enrollments" ON "public"."enrollments" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view all courses" ON "public"."courses" FOR SELECT USING (true);



CREATE POLICY "Users manage own notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own enrollments" ON "public"."enrollments" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignment_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discussion_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discussion_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."grade_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."grade_criteria_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."grade_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "grade_settings_all" ON "public"."grade_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "grade_settings"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "grade_settings_select" ON "public"."grade_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "grade_settings"."course_id") AND ("e"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."grades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."module_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "overrides_all" ON "public"."assignment_overrides" USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."enrollments" "e" ON ((("e"."course_id" = "a"."course_id") AND ("e"."user_id" = "auth"."uid"()))))
  WHERE (("a"."id" = "assignment_overrides"."assignment_id") AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "overrides_select" ON "public"."assignment_overrides" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."enrollments" "e" ON ((("e"."course_id" = "a"."course_id") AND ("e"."user_id" = "auth"."uid"()))))
  WHERE (("a"."id" = "assignment_overrides"."assignment_id") AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"])))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."question_banks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quiz_overrides_all" ON "public"."quiz_time_overrides" USING ((EXISTS ( SELECT 1
   FROM ("public"."quizzes" "q"
     JOIN "public"."enrollments" "e" ON ((("e"."course_id" = "q"."course_id") AND ("e"."user_id" = "auth"."uid"()))))
  WHERE (("q"."id" = "quiz_time_overrides"."quiz_id") AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"]))))));



CREATE POLICY "quiz_overrides_select" ON "public"."quiz_time_overrides" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."quizzes" "q"
     JOIN "public"."enrollments" "e" ON ((("e"."course_id" = "q"."course_id") AND ("e"."user_id" = "auth"."uid"()))))
  WHERE (("q"."id" = "quiz_time_overrides"."quiz_id") AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"])))))));



ALTER TABLE "public"."quiz_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_time_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quizzes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "replies_delete" ON "public"."discussion_replies" FOR DELETE USING ((("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."discussion_threads" "dt"
     JOIN "public"."enrollments" "e" ON ((("e"."course_id" = "dt"."course_id") AND ("e"."user_id" = "auth"."uid"()))))
  WHERE (("dt"."id" = "discussion_replies"."thread_id") AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"])))))));



CREATE POLICY "replies_insert" ON "public"."discussion_replies" FOR INSERT WITH CHECK ((("author_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."discussion_threads" "dt"
     JOIN "public"."enrollments" "e" ON ((("e"."course_id" = "dt"."course_id") AND ("e"."user_id" = "auth"."uid"()))))
  WHERE ("dt"."id" = "discussion_replies"."thread_id")))));



CREATE POLICY "replies_select" ON "public"."discussion_replies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."discussion_threads" "dt"
     JOIN "public"."enrollments" "e" ON ((("e"."course_id" = "dt"."course_id") AND ("e"."user_id" = "auth"."uid"()))))
  WHERE (("dt"."id" = "discussion_replies"."thread_id") AND (("dt"."hidden" = false) OR ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"])))))));



ALTER TABLE "public"."rubric_criteria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rubrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "threads_delete" ON "public"."discussion_threads" FOR DELETE USING ((("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "discussion_threads"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"])))))));



CREATE POLICY "threads_insert" ON "public"."discussion_threads" FOR INSERT WITH CHECK ((("author_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "discussion_threads"."course_id") AND ("e"."user_id" = "auth"."uid"()))))));



CREATE POLICY "threads_select" ON "public"."discussion_threads" FOR SELECT USING ((("hidden" = false) OR (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "discussion_threads"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"])))))));



CREATE POLICY "threads_update" ON "public"."discussion_threads" FOR UPDATE USING ((("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "discussion_threads"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND ("e"."role" = ANY (ARRAY['instructor'::"public"."enrollment_role", 'ta'::"public"."enrollment_role"])))))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_course_creator"("p_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_course_creator"("p_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_course_creator"("p_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_course_instructor"("p_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_course_instructor"("p_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_course_instructor"("p_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_pending_invites"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_pending_invites"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_pending_invites"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."academic_sessions" TO "anon";
GRANT ALL ON TABLE "public"."academic_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."academic_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."assignment_overrides" TO "anon";
GRANT ALL ON TABLE "public"."assignment_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."bank_questions" TO "anon";
GRANT ALL ON TABLE "public"."bank_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_questions" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."discussion_replies" TO "anon";
GRANT ALL ON TABLE "public"."discussion_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."discussion_replies" TO "service_role";



GRANT ALL ON TABLE "public"."discussion_threads" TO "anon";
GRANT ALL ON TABLE "public"."discussion_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."discussion_threads" TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT ALL ON TABLE "public"."grade_categories" TO "anon";
GRANT ALL ON TABLE "public"."grade_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."grade_categories" TO "service_role";



GRANT ALL ON TABLE "public"."grade_criteria_scores" TO "anon";
GRANT ALL ON TABLE "public"."grade_criteria_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."grade_criteria_scores" TO "service_role";



GRANT ALL ON TABLE "public"."grade_settings" TO "anon";
GRANT ALL ON TABLE "public"."grade_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."grade_settings" TO "service_role";



GRANT ALL ON TABLE "public"."grades" TO "anon";
GRANT ALL ON TABLE "public"."grades" TO "authenticated";
GRANT ALL ON TABLE "public"."grades" TO "service_role";



GRANT ALL ON TABLE "public"."invites" TO "anon";
GRANT ALL ON TABLE "public"."invites" TO "authenticated";
GRANT ALL ON TABLE "public"."invites" TO "service_role";



GRANT ALL ON TABLE "public"."module_items" TO "anon";
GRANT ALL ON TABLE "public"."module_items" TO "authenticated";
GRANT ALL ON TABLE "public"."module_items" TO "service_role";



GRANT ALL ON TABLE "public"."modules" TO "anon";
GRANT ALL ON TABLE "public"."modules" TO "authenticated";
GRANT ALL ON TABLE "public"."modules" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."oneroster_enrollments" TO "anon";
GRANT ALL ON TABLE "public"."oneroster_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."oneroster_enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."orgs" TO "anon";
GRANT ALL ON TABLE "public"."orgs" TO "authenticated";
GRANT ALL ON TABLE "public"."orgs" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."question_banks" TO "anon";
GRANT ALL ON TABLE "public"."question_banks" TO "authenticated";
GRANT ALL ON TABLE "public"."question_banks" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_questions" TO "anon";
GRANT ALL ON TABLE "public"."quiz_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_questions" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_submissions" TO "anon";
GRANT ALL ON TABLE "public"."quiz_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_time_overrides" TO "anon";
GRANT ALL ON TABLE "public"."quiz_time_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_time_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."quizzes" TO "anon";
GRANT ALL ON TABLE "public"."quizzes" TO "authenticated";
GRANT ALL ON TABLE "public"."quizzes" TO "service_role";



GRANT ALL ON TABLE "public"."rubric_criteria" TO "anon";
GRANT ALL ON TABLE "public"."rubric_criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."rubric_criteria" TO "service_role";



GRANT ALL ON TABLE "public"."rubrics" TO "anon";
GRANT ALL ON TABLE "public"."rubrics" TO "authenticated";
GRANT ALL ON TABLE "public"."rubrics" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







