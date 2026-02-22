| ?column?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ## admin_audit_log
**Columns:** id (uuid) NOT NULL DEFAULT gen_random_uuid(), org_id (uuid) NOT NULL, actor_user_id (uuid) NOT NULL, action (text) NOT NULL, target_type (text), target_id (uuid), details (jsonb), created_at (timestamp with time zone) NOT NULL DEFAULT now()
**Policies:**
- **audit_log: admins can insert** [INSERT] roles=(public) PERMISSIVE WITH CHECK (is_org_admin_or_higher(org_id))
- **audit_log: superadmin can view** [SELECT] roles=(public) PERMISSIVE USING (is_org_superadmin(org_id))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ## announcements
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), course_id (uuid), title (text) NOT NULL, content (text), pinned (boolean) DEFAULT false, author_id (uuid), created_at (timestamp with time zone) DEFAULT now(), updated_at (timestamp with time zone) DEFAULT now(), hidden (boolean) DEFAULT false
**Policies:**
- **Enrolled see announcements** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = announcements.course_id) AND (enrollments.user_id = auth.uid())))))
- **Staff manage announcements** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = announcements.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ## assignment_overrides
**Columns:** id (uuid) NOT NULL DEFAULT gen_random_uuid(), assignment_id (uuid) NOT NULL, user_id (uuid) NOT NULL, due_date (timestamp with time zone), created_at (timestamp with time zone) NOT NULL DEFAULT now(), available_from (timestamp with time zone), available_until (timestamp with time zone), time_allowed (integer), time_limit (integer), submission_attempts (integer)
**Policies:**
- **overrides_all** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM (assignments a
     JOIN enrollments e ON (((e.course_id = a.course_id) AND (e.user_id = auth.uid()))))
  WHERE ((a.id = assignment_overrides.assignment_id) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **overrides_select** [SELECT] roles=(public) PERMISSIVE USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (assignments a
     JOIN enrollments e ON (((e.course_id = a.course_id) AND (e.user_id = auth.uid()))))
  WHERE ((a.id = assignment_overrides.assignment_id) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role])))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ## assignments
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), course_id (uuid), title (text) NOT NULL, description (text), points (integer) DEFAULT 100, status (content_status) DEFAULT 'draft'::content_status, due_date (timestamp with time zone), allow_late_submissions (boolean) DEFAULT true, late_deduction (integer) DEFAULT 10, allow_resubmission (boolean) DEFAULT true, category (text) DEFAULT 'homework'::text, created_by (uuid), created_at (timestamp with time zone) DEFAULT now(), updated_at (timestamp with time zone) DEFAULT now(), available_from (timestamp with time zone), available_until (timestamp with time zone), hidden (boolean) DEFAULT false, time_allowed (integer), assignment_type (text) DEFAULT 'essay'::text, grading_type (text) DEFAULT 'points'::text, submission_modalities (jsonb) DEFAULT '["text"]'::jsonb, allowed_file_types (jsonb) DEFAULT '[]'::jsonb, max_file_size_mb (integer) DEFAULT 50, question_bank_id (uuid), submission_attempts (integer), time_limit (integer), randomize_questions (boolean) DEFAULT false, visible_to_students (boolean) DEFAULT true, show_stats_to_students (boolean) DEFAULT false
**Policies:**
- **Enrolled see published assignments** [SELECT] roles=(public) PERMISSIVE USING ((((status = 'published'::content_status) AND (EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = assignments.course_id) AND (enrollments.user_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = assignments.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role])))))))
- **Staff manage assignments** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = assignments.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
 |
| ## courses
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), name (text) NOT NULL, code (text) NOT NULL, description (text), invite_code (text) NOT NULL, created_by (uuid), start_here_title (text) DEFAULT 'Start Here'::text, start_here_content (text), active (boolean) DEFAULT true, created_at (timestamp with time zone) DEFAULT now(), updated_at (timestamp with time zone) DEFAULT now(), start_here_links (jsonb) DEFAULT '[]'::jsonb, oneroster_status (text) NOT NULL DEFAULT 'active'::text, date_last_modified (timestamp with time zone) NOT NULL DEFAULT now(), org_id (uuid), term (text) DEFAULT 'SPRING 2026'::text
**Policies:**
- **courses: delete** [DELETE] roles=(public) PERMISSIVE USING (((created_by = auth.uid()) OR is_instructor_in_course(id) OR ((org_id IS NOT NULL) AND is_org_superadmin(org_id))))
- **courses: insert** [INSERT] roles=(public) PERMISSIVE WITH CHECK (((created_by = auth.uid()) OR ((org_id IS NOT NULL) AND is_org_superadmin(org_id))))
- **courses: select** [SELECT] roles=(public) PERMISSIVE USING (((created_by = auth.uid()) OR is_enrolled_in_course(id) OR ((org_id IS NOT NULL) AND is_org_superadmin(org_id))))
- **courses: update** [UPDATE] roles=(public) PERMISSIVE USING (((created_by = auth.uid()) OR is_instructor_in_course(id) OR ((org_id IS NOT NULL) AND is_org_superadmin(org_id)))) WITH CHECK (((created_by = auth.uid()) OR is_instructor_in_course(id) OR ((org_id IS NOT NULL) AND is_org_superadmin(org_id))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ## discussion_replies
**Columns:** id (uuid) NOT NULL DEFAULT gen_random_uuid(), thread_id (uuid) NOT NULL, content (text) NOT NULL, author_id (uuid) NOT NULL, is_ai (boolean) NOT NULL DEFAULT false, created_at (timestamp with time zone) NOT NULL DEFAULT now()
**Policies:**
- **replies_delete** [DELETE] roles=(public) PERMISSIVE USING (((author_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (discussion_threads dt
     JOIN enrollments e ON (((e.course_id = dt.course_id) AND (e.user_id = auth.uid()))))
  WHERE ((dt.id = discussion_replies.thread_id) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role])))))))
- **replies_insert** [INSERT] roles=(public) PERMISSIVE WITH CHECK (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (discussion_threads dt
     JOIN enrollments e ON (((e.course_id = dt.course_id) AND (e.user_id = auth.uid()))))
  WHERE (dt.id = discussion_replies.thread_id)))))
- **replies_select** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM (discussion_threads dt
     JOIN enrollments e ON (((e.course_id = dt.course_id) AND (e.user_id = auth.uid()))))
  WHERE ((dt.id = discussion_replies.thread_id) AND ((dt.hidden = false) OR (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role])))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ## discussion_threads
**Columns:** id (uuid) NOT NULL DEFAULT gen_random_uuid(), course_id (uuid) NOT NULL, title (text) NOT NULL, content (text), author_id (uuid) NOT NULL, pinned (boolean) NOT NULL DEFAULT false, hidden (boolean) NOT NULL DEFAULT false, created_at (timestamp with time zone) NOT NULL DEFAULT now()
**Policies:**
- **threads_delete** [DELETE] roles=(public) PERMISSIVE USING (((author_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.course_id = discussion_threads.course_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role])))))))
- **threads_insert** [INSERT] roles=(public) PERMISSIVE WITH CHECK (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.course_id = discussion_threads.course_id) AND (e.user_id = auth.uid()))))))
- **threads_select** [SELECT] roles=(public) PERMISSIVE USING (((hidden = false) OR (EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.course_id = discussion_threads.course_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role])))))))
- **threads_update** [UPDATE] roles=(public) PERMISSIVE USING (((author_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.course_id = discussion_threads.course_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role])))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ## enrollments
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), user_id (uuid), course_id (uuid), role (enrollment_role) NOT NULL DEFAULT 'student'::enrollment_role, enrolled_at (timestamp with time zone) DEFAULT now(), oneroster_status (text) NOT NULL DEFAULT 'active'::text, date_last_modified (timestamp with time zone) NOT NULL DEFAULT now()
**Policies:**
- **enrollments: delete** [DELETE] roles=(public) PERMISSIVE USING ((is_course_creator(course_id) OR is_course_instructor(course_id) OR (course_id IN ( SELECT get_superadmin_course_ids() AS get_superadmin_course_ids))))
- **enrollments: insert** [INSERT] roles=(public) PERMISSIVE WITH CHECK (((user_id = auth.uid()) OR is_course_creator(course_id) OR is_course_instructor(course_id) OR (course_id IN ( SELECT get_superadmin_course_ids() AS get_superadmin_course_ids))))
- **enrollments: select** [SELECT] roles=(public) PERMISSIVE USING (((user_id = auth.uid()) OR is_course_creator(course_id) OR is_course_instructor(course_id) OR (course_id IN ( SELECT get_superadmin_course_ids() AS get_superadmin_course_ids))))
- **enrollments: update** [UPDATE] roles=(public) PERMISSIVE USING ((is_course_creator(course_id) OR is_course_instructor(course_id) OR (course_id IN ( SELECT get_superadmin_course_ids() AS get_superadmin_course_ids)))) WITH CHECK ((is_course_creator(course_id) OR is_course_instructor(course_id) OR (course_id IN ( SELECT get_superadmin_course_ids() AS get_superadmin_course_ids))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ## files
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), course_id (uuid), name (text) NOT NULL, mime_type (text), size_bytes (integer), storage_path (text) NOT NULL, uploaded_by (uuid), uploaded_at (timestamp with time zone) DEFAULT now(), hidden (boolean) DEFAULT false, external_url (text), description (text), is_placeholder (boolean) DEFAULT false, is_youtube (boolean) DEFAULT false
**Policies:**
- **Enrolled see files** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = files.course_id) AND (enrollments.user_id = auth.uid())))))
- **Staff manage files** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = files.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ## grade_categories
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), course_id (uuid), name (text) NOT NULL, weight (numeric(5,4)) DEFAULT 0
**Policies:**
- **Enrolled see grade categories** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = grade_categories.course_id) AND (enrollments.user_id = auth.uid())))))
- **Staff manage grade categories** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = grade_categories.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ## grade_settings
**Columns:** id (uuid) NOT NULL DEFAULT gen_random_uuid(), course_id (uuid) NOT NULL, a_min (numeric) NOT NULL DEFAULT 90, b_min (numeric) NOT NULL DEFAULT 80, c_min (numeric) NOT NULL DEFAULT 70, d_min (numeric) NOT NULL DEFAULT 60, curve (numeric) NOT NULL DEFAULT 0, extra_credit_enabled (boolean) NOT NULL DEFAULT false, created_at (timestamp with time zone) NOT NULL DEFAULT now(), grade_scale (text) DEFAULT 'letter'::text, pass_min (numeric) DEFAULT 60, hp_min (numeric) DEFAULT 80, hp_pass_min (numeric) DEFAULT 60
**Policies:**
- **grade_settings_all** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.course_id = grade_settings.course_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **grade_settings_select** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.course_id = grade_settings.course_id) AND (e.user_id = auth.uid())))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ## grades
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), submission_id (uuid), score (numeric(5,2)), feedback (text), released (boolean) DEFAULT false, graded_by (uuid), graded_at (timestamp with time zone) DEFAULT now()
**Policies:**
- **Staff can grade** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM ((submissions s
     JOIN assignments a ON ((a.id = s.assignment_id)))
     JOIN enrollments e ON ((e.course_id = a.course_id)))
  WHERE ((s.id = grades.submission_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **Staff can insert grades** [INSERT] roles=(public) PERMISSIVE WITH CHECK ((EXISTS ( SELECT 1
   FROM ((submissions s
     JOIN assignments a ON ((a.id = s.assignment_id)))
     JOIN enrollments e ON ((e.course_id = a.course_id)))
  WHERE ((s.id = grades.submission_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **Staff see all grades** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM ((submissions s
     JOIN assignments a ON ((a.id = s.assignment_id)))
     JOIN enrollments e ON ((e.course_id = a.course_id)))
  WHERE ((s.id = grades.submission_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **Students see released grades** [SELECT] roles=(public) PERMISSIVE USING (((released = true) AND (EXISTS ( SELECT 1
   FROM submissions
  WHERE ((submissions.id = grades.submission_id) AND (submissions.user_id = auth.uid()))))))
                                                                                                                                                                                                                                                                                                                                                           |
| ## invites
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), course_id (uuid), email (text) NOT NULL, role (enrollment_role) NOT NULL DEFAULT 'student'::enrollment_role, status (invite_status) DEFAULT 'pending'::invite_status, invited_by (uuid), created_at (timestamp with time zone) DEFAULT now(), accepted_at (timestamp with time zone)
**Policies:**
- **Staff manage invites** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = invites.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **Staff see course invites** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = invites.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ## module_items
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), module_id (uuid), type (module_item_type) NOT NULL, ref_id (uuid), title (text), url (text), position (integer) DEFAULT 0
**Policies:**
- **See module items** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM modules m
  WHERE ((m.id = module_items.module_id) AND (EXISTS ( SELECT 1
           FROM enrollments
          WHERE ((enrollments.course_id = m.course_id) AND (enrollments.user_id = auth.uid()))))))))
- **Staff manage module items** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM (modules m
     JOIN enrollments e ON ((e.course_id = m.course_id)))
  WHERE ((m.id = module_items.module_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ## modules
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), course_id (uuid), name (text) NOT NULL, position (integer) DEFAULT 0, created_at (timestamp with time zone) DEFAULT now(), hidden (boolean) DEFAULT false
**Policies:**
- **Enrolled see modules** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = modules.course_id) AND (enrollments.user_id = auth.uid())))))
- **Staff manage modules** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = modules.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ## org_members
**Columns:** id (uuid) NOT NULL DEFAULT gen_random_uuid(), org_id (uuid) NOT NULL, user_id (uuid) NOT NULL, role (org_member_role) NOT NULL DEFAULT 'member'::org_member_role, created_at (timestamp with time zone) NOT NULL DEFAULT now(), updated_at (timestamp with time zone) NOT NULL DEFAULT now(), created_by (uuid), sourced_id (text) DEFAULT (id)::text, oneroster_status (text) NOT NULL DEFAULT 'active'::text
**Policies:**
- **org_members: superadmin full access delete** [DELETE] roles=(public) PERMISSIVE USING (is_org_superadmin(org_id))
- **org_members: superadmin full access insert** [INSERT] roles=(public) PERMISSIVE WITH CHECK (is_org_superadmin(org_id))
- **org_members: superadmin full access select** [SELECT] roles=(public) PERMISSIVE USING (is_org_superadmin(org_id))
- **org_members: superadmin full access update** [UPDATE] roles=(public) PERMISSIVE USING (is_org_superadmin(org_id))
- **org_members: users see own membership** [SELECT] roles=(public) PERMISSIVE USING ((user_id = auth.uid()))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ## orgs
**Columns:** id (uuid) NOT NULL DEFAULT gen_random_uuid(), sourced_id (text) DEFAULT (id)::text, name (text) NOT NULL, type (text) NOT NULL DEFAULT 'school'::text, identifier (text), parent_id (uuid), status (text) NOT NULL DEFAULT 'active'::text, updated_at (timestamp with time zone) NOT NULL DEFAULT now(), numeric_id (integer) DEFAULT nextval('orgs_numeric_id_seq'::regclass)
**Policies:**
No policies defined
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ## profiles
**Columns:** id (uuid) NOT NULL, email (text) NOT NULL, name (text) NOT NULL, avatar (text), created_at (timestamp with time zone) DEFAULT now(), updated_at (timestamp with time zone) DEFAULT now(), gemini_key (text), sourced_id (text) DEFAULT (id)::text, given_name (text), family_name (text), oneroster_status (text) NOT NULL DEFAULT 'active'::text, date_last_modified (timestamp with time zone) NOT NULL DEFAULT now()
**Policies:**
- **Profiles are viewable by authenticated users** [SELECT] roles=(public) PERMISSIVE USING ((auth.role() = 'authenticated'::text))
- **Users can update own profile** [UPDATE] roles=(public) PERMISSIVE USING ((auth.uid() = id))
- **profiles: org superadmin can read all** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM get_superadmin_org_ids() get_superadmin_org_ids(get_superadmin_org_ids))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ## question_banks
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), course_id (uuid), name (text) NOT NULL, created_at (timestamp with time zone) DEFAULT now(), description (text), default_points_per_question (numeric(5,2)) DEFAULT 1, randomize (boolean) DEFAULT false, created_by (uuid), questions (jsonb) DEFAULT '[]'::jsonb, updated_at (timestamp with time zone) DEFAULT now()
**Policies:**
- **Enrolled see question banks** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = question_banks.course_id) AND (enrollments.user_id = auth.uid())))))
- **Staff manage question banks** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = question_banks.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ## quiz_questions
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), quiz_id (uuid), type (question_type) NOT NULL, prompt (text) NOT NULL, options (jsonb), correct_answer (jsonb), points (integer) DEFAULT 1, position (integer) DEFAULT 0
**Policies:**
- **See quiz questions** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_questions.quiz_id) AND (((q.status = 'published'::content_status) AND (EXISTS ( SELECT 1
           FROM enrollments
          WHERE ((enrollments.course_id = q.course_id) AND (enrollments.user_id = auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM enrollments
          WHERE ((enrollments.course_id = q.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ## quiz_submissions
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), quiz_id (uuid), user_id (uuid), answers (jsonb), score (numeric(5,2)), started_at (timestamp with time zone) DEFAULT now(), submitted_at (timestamp with time zone), attempt_number (integer) DEFAULT 1, assignment_id (uuid)
**Policies:**
- **Staff see quiz submissions** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM (quizzes q
     JOIN enrollments e ON ((e.course_id = q.course_id)))
  WHERE ((q.id = quiz_submissions.quiz_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **Students can submit quiz** [INSERT] roles=(public) PERMISSIVE WITH CHECK ((user_id = auth.uid()))
- **Students see own quiz submissions** [SELECT] roles=(public) PERMISSIVE USING ((user_id = auth.uid()))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ## quiz_time_overrides
**Columns:** id (uuid) NOT NULL DEFAULT gen_random_uuid(), quiz_id (uuid) NOT NULL, user_id (uuid) NOT NULL, time_limit (integer), created_at (timestamp with time zone) NOT NULL DEFAULT now()
**Policies:**
- **quiz_overrides_all** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM (quizzes q
     JOIN enrollments e ON (((e.course_id = q.course_id) AND (e.user_id = auth.uid()))))
  WHERE ((q.id = quiz_time_overrides.quiz_id) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **quiz_overrides_select** [SELECT] roles=(public) PERMISSIVE USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (quizzes q
     JOIN enrollments e ON (((e.course_id = q.course_id) AND (e.user_id = auth.uid()))))
  WHERE ((q.id = quiz_time_overrides.quiz_id) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role])))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ## quizzes
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), course_id (uuid), title (text) NOT NULL, description (text), status (content_status) DEFAULT 'draft'::content_status, due_date (timestamp with time zone), time_limit (integer), attempts_allowed (integer) DEFAULT 1, randomize_questions (boolean) DEFAULT false, question_pool_enabled (boolean) DEFAULT false, question_select_count (integer), created_by (uuid), created_at (timestamp with time zone) DEFAULT now(), updated_at (timestamp with time zone) DEFAULT now()
**Policies:**
- **Enrolled see published quizzes** [SELECT] roles=(public) PERMISSIVE USING ((((status = 'published'::content_status) AND (EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = quizzes.course_id) AND (enrollments.user_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = quizzes.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role])))))))
- **Staff manage quizzes** [ALL] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = quizzes.course_id) AND (enrollments.user_id = auth.uid()) AND (enrollments.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ## rubric_criteria
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), rubric_id (uuid), name (text) NOT NULL, description (text), points (integer) NOT NULL, position (integer) DEFAULT 0
**Policies:**
- **See rubric criteria** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM (rubrics r
     JOIN assignments a ON ((a.id = r.assignment_id)))
  WHERE ((r.id = rubric_criteria.rubric_id) AND (EXISTS ( SELECT 1
           FROM enrollments
          WHERE ((enrollments.course_id = a.course_id) AND (enrollments.user_id = auth.uid()))))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ## rubrics
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), assignment_id (uuid), created_at (timestamp with time zone) DEFAULT now()
**Policies:**
- **See rubrics** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = rubrics.assignment_id) AND (EXISTS ( SELECT 1
           FROM enrollments
          WHERE ((enrollments.course_id = a.course_id) AND (enrollments.user_id = auth.uid()))))))))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ## submissions
**Columns:** id (uuid) NOT NULL DEFAULT uuid_generate_v4(), assignment_id (uuid), user_id (uuid), content (text), file_name (text), file_path (text), submitted_at (timestamp with time zone) DEFAULT now()
**Policies:**
- **Staff can create manual submissions** [INSERT] roles=(public) PERMISSIVE WITH CHECK ((EXISTS ( SELECT 1
   FROM (assignments a
     JOIN enrollments e ON ((e.course_id = a.course_id)))
  WHERE ((a.id = submissions.assignment_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **Staff can update submissions in their courses** [UPDATE] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM (assignments a
     JOIN enrollments e ON ((e.course_id = a.course_id)))
  WHERE ((a.id = submissions.assignment_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **Staff see submissions** [SELECT] roles=(public) PERMISSIVE USING ((EXISTS ( SELECT 1
   FROM (assignments a
     JOIN enrollments e ON ((e.course_id = a.course_id)))
  WHERE ((a.id = submissions.assignment_id) AND (e.user_id = auth.uid()) AND (e.role = ANY (ARRAY['instructor'::enrollment_role, 'ta'::enrollment_role]))))))
- **Students can resubmit** [UPDATE] roles=(public) PERMISSIVE USING ((user_id = auth.uid()))
- **Students can submit** [INSERT] roles=(public) PERMISSIVE WITH CHECK ((user_id = auth.uid()))
- **Students see own submissions** [SELECT] roles=(public) PERMISSIVE USING ((user_id = auth.uid()))
                                                                                                                                                                                                                                                                                                                                                                                                                         |
