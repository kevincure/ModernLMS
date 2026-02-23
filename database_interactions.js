/* ═══════════════════════════════════════════════════════════════════════════════
   Database Interactions for Campus LMS
   All Supabase CRUD operations and data loading functions
═══════════════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE STATE
// These will be set by the main app via initDatabaseModule()
// ═══════════════════════════════════════════════════════════════════════════════

let supabaseClient = null;
let appData = null;
let showToast = null;
let getInitials = null;

/**
 * Initialize the database module with required dependencies
 * @param {Object} deps - Dependencies object
 * @param {Object} deps.supabaseClient - Initialized Supabase client
 * @param {Object} deps.appData - Application data store reference
 * @param {Function} deps.showToast - Toast notification function
 * @param {Function} deps.getInitials - Get initials helper function
 */
export function initDatabaseModule(deps) {
  supabaseClient = deps.supabaseClient;
  appData = deps.appData;
  showToast = deps.showToast;
  getInitials = deps.getInitials;
}

/**
 * Update the supabase client reference (called after auth)
 * @param {Object} client - Supabase client
 */
export function setSupabaseClient(client) {
  supabaseClient = client;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH DEBUG HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Debug helper to verify auth state before operations
 * @param {string} operation - Name of the operation being performed
 * @returns {Promise<Object|null>} User object or null if not authenticated
 */
async function debugAuthState(operation = 'unknown') {
  if (!supabaseClient) {
    console.warn(`[Auth Debug - ${operation}] Supabase client not initialized`);
    return null;
  }

  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error(`[Auth Debug - ${operation}] Error getting session:`, error);
      return null;
    }

    const user = session?.user;
    if (!user) {
      console.warn(`[Auth Debug - ${operation}] No session/user - auth.uid() will be NULL`);
      return null;
    }

    console.log(`[Auth Debug - ${operation}] Authenticated as:`, {
      id: user.id,
      email: user.email,
      role: user.role,
      aud: user.aud
    });

    console.log(`[Auth Debug - ${operation}] Session expires:`,
      new Date(session.expires_at * 1000).toISOString());

    return user;
  } catch (err) {
    console.error(`[Auth Debug - ${operation}] Exception:`, err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load all data from Supabase for the current user
 * RLS policies will automatically filter data based on user's enrollments
 */
export async function loadDataFromSupabase() {
  if (!supabaseClient || !appData.currentUser) {
    console.log('[Supabase] Cannot load data: no client or user');
    return;
  }

  console.log('[Supabase] Loading data for user:', appData.currentUser.email);

  try {
    // Parallel fetch all data the user has access to (RLS will filter)
    const [
      profilesRes,
      coursesRes,
      enrollmentsRes,
      assignmentsRes,
      submissionsRes,
      gradesRes,
      announcementsRes,
      filesRes,
      quizzesRes,
      quizQuestionsRes,
      quizSubmissionsRes,
      modulesRes,
      moduleItemsRes,
      invitesRes,
      rubricRes,
      rubricCriteriaRes,
      gradeCategoriesRes,
      discussionThreadsRes,
      discussionRepliesRes,
      assignmentOverridesRes,
      quizTimeOverridesRes,
      gradeSettingsRes,
      questionBanksRes
    ] = await Promise.all([
      // Exclude gemini_key: sensitive, fetched separately only for own profile.
      // Row-level RLS (Section 1 migration) limits which profiles are visible.
      supabaseClient.from('profiles').select('id, email, name, avatar, given_name, family_name, created_at, updated_at'),
      supabaseClient.from('courses').select('*'),
      supabaseClient.from('enrollments').select('*'),
      supabaseClient.from('assignments').select('*'),
      supabaseClient.from('submissions').select('*'),
      supabaseClient.from('grades').select('*'),
      supabaseClient.from('announcements').select('*'),
      supabaseClient.from('files').select('*'),
      supabaseClient.from('quizzes').select('*'),
      supabaseClient.from('quiz_questions').select('*'),
      supabaseClient.from('quiz_submissions').select('*'),
      supabaseClient.from('modules').select('*'),
      supabaseClient.from('module_items').select('*'),
      supabaseClient.from('invites').select('*'),
      supabaseClient.from('rubrics').select('*'),
      supabaseClient.from('rubric_criteria').select('*'),
      supabaseClient.from('grade_categories').select('*'),
      supabaseClient.from('discussion_threads').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('discussion_replies').select('*').order('created_at', { ascending: true }),
      supabaseClient.from('assignment_overrides').select('*'),
      supabaseClient.from('quiz_time_overrides').select('*'),
      supabaseClient.from('grade_settings').select('*'),
      supabaseClient.from('question_banks').select('*')
    ]);

    // Log any errors
    const responses = [
      { name: 'profiles', res: profilesRes },
      { name: 'courses', res: coursesRes },
      { name: 'enrollments', res: enrollmentsRes },
      { name: 'assignments', res: assignmentsRes },
      { name: 'submissions', res: submissionsRes },
      { name: 'grades', res: gradesRes },
      { name: 'announcements', res: announcementsRes },
      { name: 'files', res: filesRes },
      { name: 'quizzes', res: quizzesRes },
      { name: 'quiz_questions', res: quizQuestionsRes },
      { name: 'quiz_submissions', res: quizSubmissionsRes },
      { name: 'modules', res: modulesRes },
      { name: 'module_items', res: moduleItemsRes },
      { name: 'invites', res: invitesRes },
      { name: 'rubrics', res: rubricRes },
      { name: 'rubric_criteria', res: rubricCriteriaRes },
      { name: 'grade_categories', res: gradeCategoriesRes },
      { name: 'discussion_threads', res: discussionThreadsRes },
      { name: 'discussion_replies', res: discussionRepliesRes },
      { name: 'assignment_overrides', res: assignmentOverridesRes },
      { name: 'quiz_time_overrides', res: quizTimeOverridesRes },
      { name: 'grade_settings', res: gradeSettingsRes },
      { name: 'question_banks', res: questionBanksRes }
    ];


    responses.forEach(({ name, res }) => {
      if (res.error) {
        console.warn(`[Supabase] Error loading ${name}:`, res.error.message);
      } else {
        console.log(`[Supabase] Loaded ${res.data?.length || 0} ${name}`);
      }
    });

    // Transform Supabase data to app format
    appData.users = (profilesRes.data || []).map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      avatar: p.avatar || getInitials(p.name),
      role: 'user'
    }));

    appData.courses = (coursesRes.data || []).map(c => ({
      id: c.id,
      name: c.name,
      code: c.code,
      description: c.description,
      inviteCode: c.invite_code,
      createdBy: c.created_by,
      startHereTitle: c.start_here_title,
      startHereContent: c.start_here_content,
      active: c.active
    }));

    appData.enrollments = (enrollmentsRes.data || []).map(e => ({
      userId: e.user_id,
      courseId: e.course_id,
      role: e.role
    }));

    appData.assignments = (assignmentsRes.data || []).map(a => ({
      id: a.id,
      courseId: a.course_id,
      title: a.title,
      description: a.description,
      points: a.points,
      status: a.status,
      dueDate: a.due_date,
      availableFrom: a.available_from,
      availableUntil: a.available_until,
      createdAt: a.created_at,
      allowLateSubmissions: a.allow_late_submissions,
      lateDeduction: a.late_deduction,
      allowResubmission: a.allow_resubmission,
      hidden: a.hidden || false,
      category: a.category,
      timeAllowed: a.time_allowed || null,
      // CC 1.4 grading fields — map from snake_case DB columns
      gradingType: a.grading_type || 'points',
      assignmentType: a.assignment_type || a.category || 'essay',
      submissionAttempts: a.submission_attempts || null,
      latePenaltyType: a.late_penalty_type || 'per_day',
      visibleToStudents: a.visible_to_students !== false,
      showStatsToStudents: a.show_stats_to_students === true,
      rubric: null
    }));

    appData.submissions = (submissionsRes.data || []).map(s => ({
      id: s.id,
      assignmentId: s.assignment_id,
      userId: s.user_id,
      text: s.content,
      fileName: s.file_name,
      filePath: s.file_path,
      submittedAt: s.submitted_at
    }));

    appData.grades = (gradesRes.data || []).map(g => ({
      submissionId: g.submission_id,
      score: g.score,
      feedback: g.feedback,
      released: g.released,
      gradedBy: g.graded_by,
      gradedAt: g.graded_at
    }));

    appData.announcements = (announcementsRes.data || []).map(a => ({
      id: a.id,
      courseId: a.course_id,
      title: a.title,
      content: a.content,
      pinned: a.pinned,
      hidden: a.hidden || false,
      authorId: a.author_id,
      createdAt: a.created_at
    }));

    appData.files = (filesRes.data || []).map(f => ({
      id: f.id,
      courseId: f.course_id,
      name: f.name,
      type: f.type || f.mime_type,
      size: f.size || f.size_bytes,
      storagePath: f.storage_path,
      uploadedBy: f.uploaded_by,
      uploadedAt: f.uploaded_at,
      externalUrl: f.external_url,
      description: f.description,
      isPlaceholder: f.is_placeholder,
      isYouTube: f.is_youtube,
      hidden: f.hidden || false
    }));

    // Transform quizzes with their questions
    const quizQuestions = quizQuestionsRes.data || [];
    appData.quizzes = (quizzesRes.data || []).map(q => ({
      id: q.id,
      courseId: q.course_id,
      title: q.title,
      description: q.description,
      status: q.status,
      dueDate: q.due_date,
      createdAt: q.created_at,
      timeLimit: q.time_limit,
      attempts: q.attempts_allowed,
      randomizeQuestions: q.randomize_questions,
      questionPoolEnabled: q.question_pool_enabled,
      questionSelectCount: q.question_select_count,
      questions: quizQuestions
        .filter(qq => qq.quiz_id === q.id)
        .sort((a, b) => a.position - b.position)
        .map(qq => ({
          id: qq.id,
          type: qq.type,
          prompt: qq.prompt,
          options: qq.options || [],
          correctAnswer: qq.correct_answer,
          points: qq.points
        }))
    }));

    appData.quizSubmissions = (quizSubmissionsRes.data || []).map(qs => ({
      id: qs.id,
      quizId: qs.quiz_id,
      userId: qs.user_id,
      answers: qs.answers,
      score: qs.score,
      startedAt: qs.started_at,
      submittedAt: qs.submitted_at,
      attemptNumber: qs.attempt_number
    }));

    // Transform modules with their items
    const moduleItems = moduleItemsRes.data || [];
    appData.modules = (modulesRes.data || []).map(m => ({
      id: m.id,
      courseId: m.course_id,
      name: m.name,
      position: m.position,
      hidden: m.hidden || false,
      items: moduleItems
        .filter(mi => mi.module_id === m.id)
        .sort((a, b) => a.position - b.position)
        .map(mi => ({
          id: mi.id,
          type: mi.type,
          refId: mi.ref_id,
          title: mi.title,
          url: mi.url,
          position: mi.position
        }))
    }));

    appData.invites = (invitesRes.data || []).map(i => ({
      id: i.id,
      courseId: i.course_id,
      email: i.email,
      role: i.role,
      status: i.status,
      invitedBy: i.invited_by,
      createdAt: i.created_at,
      sentAt: i.created_at
    }));

    // Rubrics (attach to assignments)
    const rubrics = rubricRes.data || [];
    const rubricCriteria = rubricCriteriaRes.data || [];
    rubrics.forEach(r => {
      const assignment = appData.assignments.find(a => a.id === r.assignment_id);
      if (assignment) {
        assignment.rubric = {
          id: r.id,
          criteria: rubricCriteria
            .filter(rc => rc.rubric_id === r.id)
            .sort((a, b) => a.position - b.position)
            .map(rc => ({
              id: rc.id,
              name: rc.name,
              description: rc.description,
              points: rc.points
            }))
        };
      }
    });

    // Store rubrics separately for compatibility
    appData.rubrics = rubrics.map(r => ({
      id: r.id,
      assignmentId: r.assignment_id,
      criteria: rubricCriteria
        .filter(rc => rc.rubric_id === r.id)
        .sort((a, b) => a.position - b.position)
        .map(rc => ({
          id: rc.id,
          name: rc.name,
          description: rc.description,
          points: rc.points
        }))
    }));

    appData.gradeCategories = (gradeCategoriesRes.data || []).map(gc => ({
      id: gc.id,
      courseId: gc.course_id,
      name: gc.name,
      weight: gc.weight
    }));

    // Discussion threads and replies
    const discussionReplies = discussionRepliesRes.data || [];
    appData.discussionThreads = (discussionThreadsRes.data || []).map(t => ({
      id: t.id,
      courseId: t.course_id,
      title: t.title,
      content: t.content,
      authorId: t.author_id,
      createdAt: t.created_at,
      pinned: t.pinned || false,
      hidden: t.hidden || false,
      replies: discussionReplies
        .filter(r => r.thread_id === t.id)
        .map(r => ({
          id: r.id,
          threadId: r.thread_id,
          content: r.content,
          authorId: r.author_id,
          isAi: r.is_ai || false,
          createdAt: r.created_at
        }))
    }));

    // Assignment overrides (per-student due dates)
    appData.assignmentOverrides = (assignmentOverridesRes.data || []).map(o => ({
      id: o.id,
      assignmentId: o.assignment_id,
      userId: o.user_id,
      dueDate: o.due_date,
      availableFrom: o.available_from || null,
      availableUntil: o.available_until || null,
      timeAllowed: o.time_allowed || null
    }));

    // Quiz time overrides (per-student time limits)
    appData.quizTimeOverrides = (quizTimeOverridesRes.data || []).map(o => ({
      id: o.id,
      quizId: o.quiz_id,
      userId: o.user_id,
      timeLimit: o.time_limit
    }));

    // Grade settings (letter grades, curve, extra credit)
    appData.gradeSettings = (gradeSettingsRes.data || []).map(gs => ({
      id: gs.id,
      courseId: gs.course_id,
      gradeScale: gs.grade_scale || 'letter',
      aMin: gs.a_min ?? 90,
      bMin: gs.b_min ?? 80,
      cMin: gs.c_min ?? 70,
      dMin: gs.d_min ?? 60,
      passMin: gs.pass_min ?? 60,
      hpMin: gs.hp_min ?? 80,
      hpPassMin: gs.hp_pass_min ?? 60,
      curve: gs.curve ?? 0,
      extraCreditEnabled: gs.extra_credit_enabled ?? false,
      showOverallToStudents: gs.show_overall_to_students ?? true
    }));

    // Question banks with their questions (stored as JSONB in question_banks.questions)
    appData.questionBanks = (questionBanksRes.data || []).map(b => {
      const questions = Array.isArray(b.questions) ? b.questions
        : (typeof b.questions === 'string' ? JSON.parse(b.questions || '[]') : []);
      return {
        id: b.id,
        courseId: b.course_id,
        name: b.name,
        description: b.description || null,
        defaultPointsPerQuestion: b.default_points_per_question || 1,
        randomize: b.randomize || false,
        createdBy: b.created_by,
        createdAt: b.created_at,
        questions
      };
    });

    appData.settings = {};

    // Security: filter submissions/grades so students can't see other students' data.
    // A user may be staff (instructor/TA) in some courses and a student in others —
    // handle this per-course: keep a submission if the current user submitted it, OR
    // if the current user is staff in the course that submission belongs to.
    if (appData.currentUser) {
      const staffCourseIds = new Set(
        appData.enrollments
          .filter(e => e.userId === appData.currentUser.id && ['instructor', 'ta'].includes(e.role))
          .map(e => e.courseId)
      );
      // Build a course-id lookup for assignments so we don't iterate assignments for every submission
      const assignmentCourse = Object.fromEntries(
        (appData.assignments || []).map(a => [a.id, a.courseId])
      );
      appData.submissions = appData.submissions.filter(s => {
        if (s.userId === appData.currentUser.id) return true; // always keep own submissions
        const courseId = assignmentCourse[s.assignmentId];
        return courseId && staffCourseIds.has(courseId); // keep if staff in that course
      });
      const mySubIds = new Set(appData.submissions.map(s => s.id));
      appData.grades = appData.grades.filter(g => mySubIds.has(g.submissionId));
    }

    console.log('[Supabase] Data loaded successfully');
    console.log('[Supabase] Summary:', {
      users: appData.users.length,
      courses: appData.courses.length,
      enrollments: appData.enrollments.length,
      assignments: appData.assignments.length,
      submissions: appData.submissions.length
    });

  } catch (err) {
    console.error('[Supabase] Error loading data:', err);
    if (showToast) showToast('Failed to load data from server', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE CONTENT DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Download a file from Supabase storage and return { base64, mimeType, sizeBytes }.
 * Returns null on error or if file is too large (>20 MB Gemini inline limit).
 */
export async function supabaseDownloadFileBlob(storagePath, declaredMimeType) {
  if (!supabaseClient || !storagePath) return null;
  try {
    const { data: blob, error } = await supabaseClient.storage.from('course-files').download(storagePath);
    if (error || !blob) return null;
    if (blob.size > 20 * 1024 * 1024) return { error: `File is too large (${(blob.size / 1048576).toFixed(1)} MB) to attach inline — max 20 MB.` };
    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);
    // Encode to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const mimeType = declaredMimeType || blob.type || 'application/octet-stream';
    return { base64, mimeType, sizeBytes: blob.size };
  } catch (e) {
    return { error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateCourse(course) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Creating course:', course.name);

  const authUser = await debugAuthState('createCourse');
  if (!authUser) {
    console.error('[Supabase] Cannot create course: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('courses').insert({
    id: course.id,
    name: course.name,
    code: course.code,
    description: course.description || null,
    invite_code: course.inviteCode,
    created_by: course.createdBy,
    start_here_title: course.startHereTitle || 'Start Here',
    start_here_content: course.startHereContent || null,
    active: course.active !== false
  }).select().single();

  if (error) {
    console.error('[Supabase] Error creating course:', error);
    if (showToast) showToast('Failed to save course to database', 'error');
    return null;
  }
  console.log('[Supabase] Course created:', data.id);
  return data;
}

export async function supabaseUpdateCourse(course) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Updating course:', course.id);

  const updateData = {
    name: course.name,
    code: course.code,
    description: course.description,
    start_here_title: course.startHereTitle,
    start_here_content: course.startHereContent,
    active: course.active
  };

  if (course.startHereLinks !== undefined) {
    updateData.start_here_links = course.startHereLinks;
  }

  const { data, error } = await supabaseClient.from('courses')
    .update(updateData)
    .eq('id', course.id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error updating course:', error);
    if (showToast) showToast('Failed to update course', 'error');
    return null;
  }
  console.log('[Supabase] Course updated');
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENROLLMENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateEnrollment(enrollment) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Creating enrollment:', enrollment.userId, enrollment.courseId);

  const authUser = await debugAuthState('createEnrollment');
  if (!authUser) {
    console.error('[Supabase] Cannot create enrollment: not authenticated');
    return null;
  }

  const { data, error } = await supabaseClient.from('enrollments').insert({
    user_id: enrollment.userId,
    course_id: enrollment.courseId,
    role: enrollment.role
  }).select().single();

  if (error) {
    console.error('[Supabase] Error creating enrollment:', error);
    return null;
  }
  console.log('[Supabase] Enrollment created');
  return data;
}

export async function supabaseDeleteEnrollment(userId, courseId) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Deleting enrollment:', userId, courseId);

  const { error } = await supabaseClient.from('enrollments')
    .delete()
    .eq('user_id', userId)
    .eq('course_id', courseId);

  if (error) {
    console.error('[Supabase] Error deleting enrollment:', error);
    if (showToast) showToast('Failed to remove from course', 'error');
    return null;
  }
  console.log('[Supabase] Enrollment deleted');
  return true;
}

export async function supabaseUpdateEnrollment(userId, courseId, role) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Updating enrollment role:', userId, courseId, role);

  const { data, error } = await supabaseClient.from('enrollments')
    .update({ role })
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error updating enrollment:', error);
    return null;
  }
  console.log('[Supabase] Enrollment updated');
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateAssignment(assignment) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create assignment: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating assignment:', assignment.title, 'for course:', assignment.courseId);

  const authUser = await debugAuthState('createAssignment');
  if (!authUser) {
    console.error('[Supabase] Cannot create assignment: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const modernPayload = {
    id: assignment.id,
    course_id: assignment.courseId,
    title: assignment.title,
    description: assignment.description || null,
    points: assignment.points || 100,
    status: assignment.status || 'draft',
    due_date: assignment.dueDate || null,
    available_from: assignment.availableFrom || null,
    available_until: assignment.availableUntil || null,
    allow_late_submissions: assignment.allowLateSubmissions !== false,
    late_deduction: assignment.lateDeduction || 10,
    allow_resubmission: assignment.allowResubmission !== false,
    hidden: assignment.hidden || false,
    category: assignment.category || 'homework',
    created_by: appData.currentUser?.id
  };

  const { data, error } = await supabaseClient.from('assignments').insert(modernPayload).select().single();

  if (error) {
    console.error('[Supabase] Error creating assignment:', error);
    if (showToast) showToast('Failed to save assignment: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Assignment created successfully:', data.id);
  return data;
}

export async function supabaseUpdateAssignment(assignment) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update assignment: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating assignment:', assignment.id);

  const authUser = await debugAuthState('updateAssignment');
  if (!authUser) {
    console.error('[Supabase] Cannot update assignment: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const modernPayload = {
    title: assignment.title,
    description: assignment.description,
    points: assignment.points,
    status: assignment.status,
    due_date: assignment.dueDate,
    available_from: assignment.availableFrom || null,
    available_until: assignment.availableUntil || null,
    allow_late_submissions: assignment.allowLateSubmissions,
    late_deduction: assignment.lateDeduction,
    allow_resubmission: assignment.allowResubmission,
    submission_attempts: assignment.submissionAttempts || null,
    grading_type: assignment.gradingType || 'points',
    assignment_type: assignment.assignmentType || 'essay',
    hidden: assignment.hidden || false,
    category: assignment.category,
    visible_to_students: assignment.visibleToStudents !== false,
    show_stats_to_students: assignment.showStatsToStudents === true
  };

  const { data, error } = await supabaseClient.from('assignments').update(modernPayload).eq('id', assignment.id).select().single();

  if (error) {
    console.error('[Supabase] Error updating assignment:', error);
    if (showToast) showToast('Failed to update assignment: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Assignment updated successfully');
  return data;
}

export async function supabaseDeleteAssignment(assignmentId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete assignment: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting assignment:', assignmentId);

  const authUser = await debugAuthState('deleteAssignment');
  if (!authUser) {
    console.error('[Supabase] Cannot delete assignment: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  const { error } = await supabaseClient.from('assignments').delete().eq('id', assignmentId);

  if (error) {
    console.error('[Supabase] Error deleting assignment:', error);
    if (showToast) showToast('Failed to delete assignment: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] Assignment deleted successfully');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateAnnouncement(announcement) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create announcement: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating announcement:', announcement.title);

  const authUser = await debugAuthState('createAnnouncement');
  if (!authUser) {
    console.error('[Supabase] Cannot create announcement: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('announcements').insert({
    id: announcement.id,
    course_id: announcement.courseId,
    title: announcement.title,
    content: announcement.content || null,
    pinned: announcement.pinned || false,
    hidden: announcement.hidden || false,
    author_id: announcement.authorId
  }).select().single();

  if (error) {
    console.error('[Supabase] Error creating announcement:', error);
    if (showToast) showToast('Failed to save announcement: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Announcement created successfully:', data.id);
  return data;
}

export async function supabaseUpdateAnnouncement(announcement) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update announcement: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating announcement:', announcement.id);

  const authUser = await debugAuthState('updateAnnouncement');
  if (!authUser) {
    console.error('[Supabase] Cannot update announcement: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('announcements').update({
    title: announcement.title,
    content: announcement.content,
    pinned: announcement.pinned,
    hidden: announcement.hidden || false
  }).eq('id', announcement.id).select().single();

  if (error) {
    console.error('[Supabase] Error updating announcement:', error);
    if (showToast) showToast('Failed to update announcement: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Announcement updated successfully');
  return data;
}

export async function supabaseDeleteAnnouncement(announcementId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete announcement: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting announcement:', announcementId);

  const authUser = await debugAuthState('deleteAnnouncement');
  if (!authUser) {
    console.error('[Supabase] Cannot delete announcement: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  const { error } = await supabaseClient.from('announcements').delete().eq('id', announcementId);

  if (error) {
    console.error('[Supabase] Error deleting announcement:', error);
    if (showToast) showToast('Failed to delete announcement: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] Announcement deleted successfully');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateModule(module) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create module: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating module:', module.name, 'for course:', module.courseId);

  const authUser = await debugAuthState('createModule');
  if (!authUser) {
    console.error('[Supabase] Cannot create module: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('modules').insert({
    id: module.id,
    course_id: module.courseId,
    name: module.name,
    position: module.position || 0,
    hidden: module.hidden || false
  }).select().single();

  if (error) {
    console.error('[Supabase] Error creating module:', error);
    if (showToast) showToast('Failed to save module: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Module created successfully:', data.id);
  return data;
}

export async function supabaseUpdateModule(module) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update module: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating module:', module.id);

  const authUser = await debugAuthState('updateModule');
  if (!authUser) {
    console.error('[Supabase] Cannot update module: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('modules').update({
    name: module.name,
    position: module.position,
    hidden: module.hidden || false
  }).eq('id', module.id).select().single();

  if (error) {
    console.error('[Supabase] Error updating module:', error);
    if (showToast) showToast('Failed to update module: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Module updated successfully');
  return data;
}

export async function supabaseDeleteModule(moduleId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete module: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting module:', moduleId);

  const authUser = await debugAuthState('deleteModule');
  if (!authUser) {
    console.error('[Supabase] Cannot delete module: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  const { error } = await supabaseClient.from('modules').delete().eq('id', moduleId);

  if (error) {
    console.error('[Supabase] Error deleting module:', error);
    if (showToast) showToast('Failed to delete module: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] Module deleted successfully');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE ITEM OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateModuleItem(item, moduleId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create module item: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating module item:', item.type, 'for module:', moduleId);

  const authUser = await debugAuthState('createModuleItem');
  if (!authUser) {
    console.error('[Supabase] Cannot create module item: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('module_items').insert({
    id: item.id,
    module_id: moduleId,
    type: item.type,
    ref_id: item.refId || null,
    title: item.title || null,
    url: item.url || null,
    position: item.position || 0
  }).select().single();

  if (error) {
    console.error('[Supabase] Error creating module item:', error);
    if (showToast) showToast('Failed to create module item: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Module item created successfully:', data.id);
  return data;
}

export async function supabaseDeleteModuleItem(itemId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete module item: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting module item:', itemId);

  const authUser = await debugAuthState('deleteModuleItem');
  if (!authUser) {
    console.error('[Supabase] Cannot delete module item: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  const { error } = await supabaseClient.from('module_items').delete().eq('id', itemId);

  if (error) {
    console.error('[Supabase] Error deleting module item:', error);
    if (showToast) showToast('Failed to delete module item: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] Module item deleted successfully');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBMISSION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateSubmission(submission) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create submission: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating submission for assignment:', submission.assignmentId);

  const authUser = await debugAuthState('createSubmission');
  if (!authUser) {
    console.error('[Supabase] Cannot create submission: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('submissions').upsert({
    id: submission.id,
    assignment_id: submission.assignmentId,
    user_id: submission.userId,
    content: submission.text || submission.content,
    file_name: submission.fileName || null,
    file_path: submission.filePath || null
  }, { onConflict: 'assignment_id,user_id' }).select().single();

  if (error) {
    console.error('[Supabase] Error creating submission:', error);
    if (showToast) showToast('Failed to save submission: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Submission created/updated successfully:', data.id);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRADE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateGrade(grade) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create grade: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating grade for submission:', grade.submissionId);

  const authUser = await debugAuthState('createGrade');
  if (!authUser) {
    console.error('[Supabase] Cannot create grade: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('grades').upsert({
    submission_id: grade.submissionId,
    score: grade.score,
    feedback: grade.feedback || null,
    released: grade.released || false,
    graded_by: grade.gradedBy || appData.currentUser?.id
  }, { onConflict: 'submission_id' }).select().single();

  if (error) {
    console.error('[Supabase] Error creating grade:', error);
    if (showToast) showToast('Failed to save grade: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Grade created/updated successfully');
  return data;
}

// Alias for backward compatibility
export const supabaseUpsertGrade = supabaseCreateGrade;

// ═══════════════════════════════════════════════════════════════════════════════
// INVITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateInvite(invite) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create invite: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating invite:', invite.email, 'for course:', invite.courseId);

  const authUser = await debugAuthState('createInvite');
  if (!authUser) {
    console.error('[Supabase] Cannot create invite: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('invites').insert({
    course_id: invite.courseId,
    email: invite.email,
    role: invite.role || 'student',
    status: 'pending',
    invited_by: appData.currentUser?.id
  }).select().single();

  if (error) {
    console.error('[Supabase] Error creating invite:', error);
    if (showToast) showToast('Failed to create invite: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Invite created successfully:', data.id);
  return data;
}

export async function supabaseDeleteInvite(inviteId) {
  if (!supabaseClient) {
    if (showToast) showToast('Database not connected', 'error');
    return false;
  }
  console.log('[Supabase] Deleting invite:', inviteId);

  try {
    const { data, error } = await supabaseClient
      .from('invites')
      .delete()
      .eq('id', inviteId)
      .select();

    if (error) {
      console.error('[Supabase] Error deleting invite:', error);
      if (showToast) showToast('Failed to revoke invite: ' + error.message, 'error');
      return false;
    }

    console.log('[Supabase] Invite deleted:', inviteId, 'rows affected:', data?.length || 0);
    return true;
  } catch (err) {
    console.error('[Supabase] Exception deleting invite:', err);
    if (showToast) showToast('Failed to revoke invite', 'error');
    return false;
  }
}

export async function supabaseUpdateInviteStatus(inviteId, status) {
  if (!supabaseClient) return false;
  console.log('[Supabase] Updating invite status:', inviteId, '->', status);
  const { error } = await supabaseClient.from('invites').update({ status }).eq('id', inviteId);
  if (error) {
    console.error('[Supabase] Error updating invite status:', error);
    return false;
  }
  return true;
}

/**
 * Copy a file within Supabase Storage and create a new file record.
 * Returns the new file object (app-format) or null on failure.
 */
export async function supabaseCopyStorageFile(sourceFile, destCourseId, uploadedBy) {
  if (!supabaseClient) return null;
  const newId = crypto.randomUUID();
  const newStoragePath = sourceFile.storagePath
    ? sourceFile.storagePath.replace(/^[^/]+\//, `${destCourseId}/`) + `-${Date.now()}`
    : null;

  if (sourceFile.storagePath && newStoragePath) {
    // Download blob then re-upload under the new path
    try {
      const { data: blob, error: dlErr } = await supabaseClient.storage
        .from('course-files').download(sourceFile.storagePath);
      if (dlErr || !blob) {
        console.warn('[Supabase] Could not download file for copy, creating record-only:', dlErr?.message);
      } else {
        const { error: ulErr } = await supabaseClient.storage
          .from('course-files').upload(newStoragePath, blob, { contentType: sourceFile.mimeType || 'application/octet-stream', upsert: false });
        if (ulErr) {
          console.warn('[Supabase] Could not re-upload file copy:', ulErr.message);
        }
      }
    } catch (e) {
      console.warn('[Supabase] Exception during file copy:', e);
    }
  }

  const newFile = {
    id: newId,
    courseId: destCourseId,
    name: sourceFile.name,
    mimeType: sourceFile.mimeType,
    sizeBytes: sourceFile.sizeBytes,
    storagePath: newStoragePath || sourceFile.storagePath, // fallback: share path (read-only duplicate)
    externalUrl: sourceFile.externalUrl || null,
    description: sourceFile.description || null,
    isPlaceholder: sourceFile.isPlaceholder || false,
    isYouTube: sourceFile.isYouTube || false,
    hidden: false,
    uploadedBy,
    uploadedAt: new Date().toISOString()
  };
  await supabaseCreateFile(newFile);
  return newFile;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROFILE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseUpdateUserGeminiKey(userId, geminiKey) {
  if (!supabaseClient) return false;
  console.log('[Supabase] Updating Gemini key for user:', userId);

  const { error } = await supabaseClient.from('profiles').update({
    gemini_key: geminiKey,
    updated_at: new Date().toISOString()
  }).eq('id', userId);

  if (error) {
    console.error('[Supabase] Error updating Gemini key:', error);
    if (showToast) showToast('Failed to save Gemini key to profile', 'error');
    return false;
  }
  console.log('[Supabase] Gemini key updated');
  return true;
}

export async function supabaseLoadUserGeminiKey(userId) {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient.from('profiles')
    .select('gemini_key')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Supabase] Error loading Gemini key:', error);
    return null;
  }
  return data?.gemini_key || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateQuiz(quiz) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create quiz: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating quiz:', quiz.title, 'for course:', quiz.courseId);

  const authUser = await debugAuthState('createQuiz');
  if (!authUser) {
    console.error('[Supabase] Cannot create quiz: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('quizzes').insert({
    id: quiz.id,
    course_id: quiz.courseId,
    title: quiz.title,
    description: quiz.description,
    status: quiz.status,
    due_date: quiz.dueDate,
    created_at: quiz.createdAt,
    time_limit: quiz.timeLimit,
    attempts: quiz.attempts,
    randomize_questions: quiz.randomizeQuestions,
    question_pool_enabled: quiz.questionPoolEnabled,
    question_select_count: quiz.questionSelectCount,
    questions: quiz.questions
  }).select().single();

  if (error) {
    console.error('[Supabase] Error creating quiz:', error);
    if (showToast) showToast('Failed to save quiz: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Quiz created successfully:', quiz.id);
  return data;
}

export async function supabaseUpdateQuiz(quiz) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update quiz: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating quiz:', quiz.id);

  const authUser = await debugAuthState('updateQuiz');
  if (!authUser) {
    console.error('[Supabase] Cannot update quiz: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('quizzes').update({
    title: quiz.title,
    description: quiz.description,
    status: quiz.status,
    due_date: quiz.dueDate,
    time_limit: quiz.timeLimit,
    attempts: quiz.attempts,
    randomize_questions: quiz.randomizeQuestions,
    question_pool_enabled: quiz.questionPoolEnabled,
    question_select_count: quiz.questionSelectCount,
    questions: quiz.questions
  }).eq('id', quiz.id).select().single();

  if (error) {
    console.error('[Supabase] Error updating quiz:', error);
    if (showToast) showToast('Failed to update quiz: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Quiz updated successfully:', quiz.id);
  return data;
}

export async function supabaseDeleteQuiz(quizId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete quiz: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting quiz:', quizId);

  const authUser = await debugAuthState('deleteQuiz');
  if (!authUser) {
    console.error('[Supabase] Cannot delete quiz: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  const { error } = await supabaseClient.from('quizzes').delete().eq('id', quizId);
  if (error) {
    console.error('[Supabase] Error deleting quiz:', error);
    if (showToast) showToast('Failed to delete quiz: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] Quiz deleted successfully:', quizId);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ SUBMISSION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseUpsertQuizSubmission(submission) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot save quiz submission: client not initialized');
    return null;
  }
  console.log('[Supabase] Saving quiz submission for quiz:', submission.quizId);

  const authUser = await debugAuthState('upsertQuizSubmission');
  if (!authUser) {
    console.error('[Supabase] Cannot save quiz submission: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('quiz_submissions').upsert({
    id: submission.id,
    quiz_id: submission.quizId,
    user_id: submission.userId,
    answers: submission.answers,
    score: submission.score,
    auto_score: submission.autoScore,
    graded: submission.graded,
    submitted_at: submission.submittedAt
  }).select().single();

  if (error) {
    console.error('[Supabase] Error saving quiz submission:', error);
    if (showToast) showToast('Failed to save quiz submission: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Quiz submission saved successfully');
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateFile(file) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create file: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating file:', file.name, 'for course:', file.courseId);

  const authUser = await debugAuthState('createFile');
  if (!authUser) {
    console.error('[Supabase] Cannot create file: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  // Prefer canonical schema fields (mime_type/size_bytes/storage_path), then fall back to legacy
  const modernPayload = {
    id: file.id,
    course_id: file.courseId,
    name: file.name,
    mime_type: file.mimeType || file.type || null,
    size_bytes: file.sizeBytes ?? file.size ?? null,
    storage_path: file.storagePath || null,
    uploaded_by: file.uploadedBy,
    uploaded_at: file.uploadedAt,
    external_url: file.externalUrl,
    description: file.description,
    is_placeholder: file.isPlaceholder,
    is_youtube: file.isYouTube,
    hidden: file.hidden || false
  };

  const { data, error } = await supabaseClient.from('files').insert(modernPayload).select().single();

  if (error) {
    console.error('[Supabase] Error creating file:', error);
    if (showToast) showToast('Failed to save file: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] File created successfully:', file.id);
  return data;
}

export async function supabaseDeleteFile(fileId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete file: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting file:', fileId);

  const authUser = await debugAuthState('deleteFile');
  if (!authUser) {
    console.error('[Supabase] Cannot delete file: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  // Find file first so we can remove corresponding storage object
  const { data: fileRecord, error: fileReadError } = await supabaseClient
    .from('files')
    .select('id, storage_path')
    .eq('id', fileId)
    .maybeSingle();

  if (fileReadError) {
    console.error('[Supabase] Error reading file before delete:', fileReadError);
    if (showToast) showToast('Failed to delete file: ' + fileReadError.message, 'error');
    return false;
  }

  if (fileRecord?.storage_path) {
    const { error: storageError } = await supabaseClient.storage
      .from('course-files')
      .remove([fileRecord.storage_path]);

    if (storageError) {
      console.error('[Supabase] Error deleting storage object:', storageError);
      if (showToast) showToast('Failed to delete file from storage: ' + storageError.message, 'error');
      return false;
    }
  }

  const { error } = await supabaseClient.from('files').delete().eq('id', fileId);
  if (error) {
    console.error('[Supabase] Error deleting file:', error);
    if (showToast) showToast('Failed to delete file: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] File deleted successfully:', fileId);
  return true;
}

export async function supabaseUpdateFile(file) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update file: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating file:', file.id);

  const authUser = await debugAuthState('updateFile');
  if (!authUser) {
    console.error('[Supabase] Cannot update file: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const modernPayload = {
    name: file.name,
    mime_type: file.mimeType || file.type || null,
    size_bytes: file.sizeBytes ?? file.size ?? null,
    storage_path: file.storagePath || null,
    external_url: file.externalUrl,
    description: file.description,
    is_placeholder: file.isPlaceholder,
    is_youtube: file.isYouTube,
    hidden: file.hidden || false
  };

  const { data, error } = await supabaseClient.from('files').update(modernPayload).eq('id', file.id).select().maybeSingle();

  if (!error && !data) {
    console.warn('[Supabase] File update affected 0 rows:', file.id);
    return null;
  }

  if (error) {
    console.error('[Supabase] Error updating file:', error);
    if (showToast) showToast('Failed to update file: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] File updated successfully');
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTION BANK OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateQuestionBank(bank) {
  if (!supabaseClient) {
    console.log('[Supabase] Storing question bank locally only');
    return bank;
  }
  console.log('[Supabase] Creating question bank:', bank.name);

  const authUser = await debugAuthState('createQuestionBank');
  if (!authUser) {
    console.error('[Supabase] Cannot create question bank: not authenticated');
    return bank;
  }

  const insertPayload = {
    id: bank.id,
    course_id: bank.courseId,
    name: bank.name,
    description: bank.description || null,
    questions: JSON.stringify(bank.questions || []),
    default_points_per_question: bank.defaultPointsPerQuestion || 1,
    randomize: bank.randomize || false,
    created_by: appData.currentUser?.id
  };

  const { data, error } = await supabaseClient.from('question_banks').insert(insertPayload).select().single();

  if (error) {
    console.error('[Supabase] Error creating question bank:', error);
    return bank;
  }
  console.log('[Supabase] Question bank created successfully');
  return data;
}

export async function supabaseUpdateQuestionBank(bank) {
  if (!supabaseClient) {
    console.log('[Supabase] Updating question bank locally only');
    return bank;
  }
  console.log('[Supabase] Updating question bank:', bank.id);

  const authUser = await debugAuthState('updateQuestionBank');
  if (!authUser) {
    return bank;
  }

  const updatePayload = {
    name: bank.name,
    description: bank.description,
    questions: JSON.stringify(bank.questions || []),
    default_points_per_question: bank.defaultPointsPerQuestion || 1,
    randomize: bank.randomize || false
  };

  const { data, error } = await supabaseClient.from('question_banks').update(updatePayload).eq('id', bank.id).select().single();

  if (error) {
    console.error('[Supabase] Error updating question bank:', error);
    return bank;
  }
  return data;
}

export async function supabaseDeleteQuestionBank(bankId) {
  if (!supabaseClient) {
    return true;
  }
  console.log('[Supabase] Deleting question bank:', bankId);

  const authUser = await debugAuthState('deleteQuestionBank');
  if (!authUser) {
    return true;
  }

  const { error } = await supabaseClient.from('question_banks').delete().eq('id', bankId);
  if (error) {
    console.error('[Supabase] Error deleting question bank:', error);
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRADE CATEGORY OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateGradeCategory(category) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Creating grade category:', category.name);

  const { data, error } = await supabaseClient.from('grade_categories').insert({
    id: category.id,
    course_id: category.courseId,
    name: category.name,
    weight: category.weight
  }).select().single();

  if (error) {
    console.error('[Supabase] Error creating grade category:', error);
    return null;
  }
  return data;
}

export async function supabaseUpdateGradeCategory(category) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Updating grade category:', category.id);

  const { data, error } = await supabaseClient.from('grade_categories').update({
    name: category.name,
    weight: category.weight
  }).eq('id', category.id).select().single();

  if (error) {
    console.error('[Supabase] Error updating grade category:', error);
    return null;
  }
  return data;
}

export async function supabaseDeleteGradeCategory(categoryId) {
  if (!supabaseClient) return true;
  console.log('[Supabase] Deleting grade category:', categoryId);

  const { error } = await supabaseClient.from('grade_categories').delete().eq('id', categoryId);
  if (error) {
    console.error('[Supabase] Error deleting grade category:', error);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUBRIC OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateRubric(assignmentId, criteria) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Creating rubric for assignment:', assignmentId);

  // First create the rubric
  const { data: rubric, error: rubricError } = await supabaseClient.from('rubrics').insert({
    assignment_id: assignmentId
  }).select().single();

  if (rubricError) {
    console.error('[Supabase] Error creating rubric:', rubricError);
    return null;
  }

  // Then create criteria
  if (criteria && criteria.length > 0) {
    const criteriaToInsert = criteria.map((c, idx) => ({
      rubric_id: rubric.id,
      name: c.name,
      description: c.description || '',
      points: c.points,
      position: idx
    }));

    const { error: criteriaError } = await supabaseClient.from('rubric_criteria').insert(criteriaToInsert);
    if (criteriaError) {
      console.error('[Supabase] Error creating rubric criteria:', criteriaError);
    }
  }

  return rubric;
}

export async function supabaseUpdateRubric(rubricId, criteria) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Updating rubric:', rubricId);

  // Delete existing criteria
  await supabaseClient.from('rubric_criteria').delete().eq('rubric_id', rubricId);

  // Insert new criteria
  if (criteria && criteria.length > 0) {
    const criteriaToInsert = criteria.map((c, idx) => ({
      rubric_id: rubricId,
      name: c.name,
      description: c.description || '',
      points: c.points,
      position: idx
    }));

    const { error } = await supabaseClient.from('rubric_criteria').insert(criteriaToInsert);
    if (error) {
      console.error('[Supabase] Error updating rubric criteria:', error);
      return null;
    }
  }

  return { id: rubricId };
}

export async function supabaseDeleteRubric(rubricId) {
  if (!supabaseClient) return true;
  console.log('[Supabase] Deleting rubric:', rubricId);

  // Criteria will be cascade deleted due to FK constraint
  const { error } = await supabaseClient.from('rubrics').delete().eq('id', rubricId);
  if (error) {
    console.error('[Supabase] Error deleting rubric:', error);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI AI API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Call Gemini API via Supabase Edge Function
 * @param {Array} contents - The contents array for the Gemini API
 * @param {Object|null} generationConfig - Optional generation config
 * @returns {Promise<Object>} The API response
 */
export async function callGeminiAPI(contents, generationConfig = null) {
  console.log('[Gemini] callGeminiAPI called, supabaseClient:', !!supabaseClient);

  if (!supabaseClient) {
    throw new Error('Database not connected');
  }

  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
  console.log('[Gemini] Session retrieved:', !!session, 'Error:', sessionError);

  if (!session) {
    throw new Error('Not authenticated - please sign in again');
  }

  console.log('[Gemini] Access token (first 20 chars):', session.access_token?.substring(0, 20));

  // Extra diagnostics for project/token mismatch (common source of 401 on Edge Functions)
  let tokenIssuer = null;
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1] || ''));
    tokenIssuer = payload.iss || null;
  } catch {
    // Ignore decode issues; token format can vary.
  }

  if (tokenIssuer && window.SUPABASE_URL && !tokenIssuer.startsWith(window.SUPABASE_URL)) {
    console.warn('[Gemini] Token issuer does not match configured SUPABASE_URL', {
      tokenIssuer,
      configuredUrl: window.SUPABASE_URL
    });
  }

  console.log('[Gemini] ▶ input:', contents);

  const { data, error } = await supabaseClient.functions.invoke('gemini', {
    body: { contents, generationConfig }
  });

  if (data) {
    const usage = data.usageMetadata || {};
    const cached = usage.cachedContentTokenCount ?? 0;
    const nonCached = (usage.promptTokenCount ?? 0) - cached;
    const out = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    console.log(`[Gemini] ⚡ tokens — input: ${usage.promptTokenCount ?? '?'} (non-cached: ${nonCached}, cached: ${cached}), output: ${usage.candidatesTokenCount ?? '?'}, thinking: ${usage.thoughtsTokenCount ?? 0}, total: ${usage.totalTokenCount ?? '?'}`);
    console.log('[Gemini] ◀ output:', out);
  }

  if (error) {
    const status = error.context?.status;
    let details = '';
    try {
      details = await error.context?.text?.() || '';
    } catch {
      // Ignore detail parsing issues
    }

    let errorMessage = error.message || `Gemini API error: ${status || 'unknown'}`;

    if (status === 401) {
      errorMessage += '. Unauthorized calling Edge Function. Check: (1) function is deployed to this same project, (2) function JWT verification config matches your expected auth mode, and (3) SUPABASE_URL/ANON_KEY belong to the same project as the logged-in session.';
      if (tokenIssuer) {
        errorMessage += ` Token issuer: ${tokenIssuer}`;
      }
    }

    if (details) {
      console.warn('[Gemini] Edge Function error details:', details);
    }

    throw new Error(errorMessage);
  }

  return data;
}

/**
 * Call Gemini API with retry logic
 * @param {Array} contents - The contents array for the Gemini API
 * @param {Object|null} generationConfig - Optional generation config
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object>} The API response
 */
export async function callGeminiAPIWithRetry(contents, generationConfig = null, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callGeminiAPI(contents, generationConfig);
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini] Attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISCUSSION BOARD
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateDiscussionThread(thread) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('discussion_threads').insert({
    id: thread.id,
    course_id: thread.courseId,
    title: thread.title,
    content: thread.content,
    author_id: thread.authorId,
    pinned: thread.pinned || false,
    hidden: thread.hidden || false
  }).select().single();
  if (error) { console.error('[Supabase] Create thread error:', error); showToast('Failed to create thread', 'error'); return null; }
  return data;
}

export async function supabaseUpdateDiscussionThread(thread) {
  if (!supabaseClient) return null;
  const { error } = await supabaseClient.from('discussion_threads').update({
    title: thread.title,
    content: thread.content,
    pinned: thread.pinned,
    hidden: thread.hidden
  }).eq('id', thread.id);
  if (error) { console.error('[Supabase] Update thread error:', error); showToast('Failed to update thread', 'error'); return false; }
  return true;
}

export async function supabaseDeleteDiscussionThread(threadId) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('discussion_threads').delete().eq('id', threadId);
  if (error) { console.error('[Supabase] Delete thread error:', error); showToast('Failed to delete thread', 'error'); return false; }
  return true;
}

export async function supabaseCreateDiscussionReply(reply) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('discussion_replies').insert({
    id: reply.id,
    thread_id: reply.threadId,
    content: reply.content,
    author_id: reply.authorId,
    is_ai: reply.isAi || false
  }).select().single();
  if (error) { console.error('[Supabase] Create reply error:', error); showToast('Failed to post reply', 'error'); return null; }
  return data;
}

export async function supabaseDeleteDiscussionReply(replyId) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('discussion_replies').delete().eq('id', replyId);
  if (error) { console.error('[Supabase] Delete reply error:', error); return false; }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseUpsertAssignmentOverride(override) {
  if (!supabaseClient) return null;
  const payload = {
    assignment_id: override.assignmentId,
    user_id: override.userId,
    due_date: override.dueDate || null,
    available_from: override.availableFrom || null,
    available_until: override.availableUntil || null,
    time_allowed: override.timeAllowed != null ? override.timeAllowed : null
  };
  const { data, error } = await supabaseClient.from('assignment_overrides').upsert(
    payload, { onConflict: 'assignment_id,user_id' }
  ).select().single();
  if (error) { console.error('[Supabase] Upsert override error:', error); showToast('Failed to save override', 'error'); return null; }
  return data;
}

export async function supabaseDeleteAssignmentOverride(assignmentId, userId) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('assignment_overrides')
    .delete().eq('assignment_id', assignmentId).eq('user_id', userId);
  if (error) { console.error('[Supabase] Delete override error:', error); return false; }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ TIME OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseUpsertQuizTimeOverride(override) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('quiz_time_overrides').upsert({
    quiz_id: override.quizId,
    user_id: override.userId,
    time_limit: override.timeLimit
  }, { onConflict: 'quiz_id,user_id' }).select().single();
  if (error) { console.error('[Supabase] Upsert quiz time override error:', error); showToast('Failed to save override', 'error'); return null; }
  return data;
}

export async function supabaseDeleteQuizTimeOverride(quizId, userId) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('quiz_time_overrides')
    .delete().eq('quiz_id', quizId).eq('user_id', userId);
  if (error) { console.error('[Supabase] Delete quiz override error:', error); return false; }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRADE SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseUpsertGradeSettings(settings) {
  if (!supabaseClient) return null;
  const payload = {
    course_id: settings.courseId,
    grade_scale: settings.gradeScale || 'letter',
    a_min: settings.aMin ?? null,
    b_min: settings.bMin ?? null,
    c_min: settings.cMin ?? null,
    d_min: settings.dMin ?? null,
    pass_min: settings.passMin ?? null,
    hp_min: settings.hpMin ?? null,
    hp_pass_min: settings.hpPassMin ?? null,
    curve: settings.curve ?? 0,
    extra_credit_enabled: settings.extraCreditEnabled ?? false,
    show_overall_to_students: settings.showOverallToStudents ?? true
  };
  const { data, error } = await supabaseClient.from('grade_settings').upsert(payload, { onConflict: 'course_id' }).select().single();
  if (error) { console.error('[Supabase] Upsert grade settings error:', error); showToast('Failed to save grade settings', 'error'); return null; }
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONEROSTER 1.2 EXPORT  (CSV — Rostering Service)
// Generates OneRoster-compliant CSV files from appData.
// Fields follow the OneRoster 1.2 Information Model.
// Required SQL before use: see DATABASE_SCHEMA.md § OneRoster Compliance.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert an array of objects to a CSV string.
 * @param {string[]} headers
 * @param {Object[]} rows  Each row's values are taken in header order.
 */
function toCsv(headers, rows) {
  const escape = v => {
    const s = (v === null || v === undefined) ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  const lines = [headers.join(',')];
  rows.forEach(row => lines.push(headers.map(h => escape(row[h])).join(',')));
  return lines.join('\r\n');
}

/**
 * Split a display name into givenName / familyName best-effort.
 * OneRoster 1.2 requires these as separate fields.
 */
function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length >= 2) {
    return { givenName: parts[0], familyName: parts.slice(1).join(' ') };
  }
  return { givenName: fullName || '', familyName: '' };
}

/** Map our role labels to OneRoster 1.2 role enum values. */
function toOneRosterRole(role) {
  return { instructor: 'teacher', ta: 'teaching assistant', student: 'student' }[role] || role;
}

/**
 * Generate all OneRoster 1.2 CSV files and trigger browser downloads.
 * Returns an object of { filename: csvString } for programmatic use.
 *
 * Schema gaps — these are defaulted/synthesised until the required SQL
 * migrations (see DATABASE_SCHEMA.md) add the actual columns:
 *   - status → always 'active'  (add status column to profiles/courses/enrollments)
 *   - dateLastModified → ISO 8601 now() stub  (add updated_at to enrollments & courses)
 *   - org/academicSession → single synthetic entry
 */
export function generateOneRosterExport(appDataRef) {
  const now = new Date().toISOString();

  // ── Org (synthetic — represents this LMS instance) ──────────────────────
  const ORG_ID = 'org-campus-lms';
  const orgsRows = [{
    sourcedId:        ORG_ID,
    status:           'active',
    dateLastModified: now,
    name:             'Campus LMS',
    type:             'school',
    identifier:       'campus-lms',
    parentSourcedId:  ''
  }];

  // ── AcademicSession (synthetic — current year) ───────────────────────────
  const year = new Date().getFullYear();
  const SESSION_ID = `session-${year}`;
  const academicSessionsRows = [{
    sourcedId:        SESSION_ID,
    status:           'active',
    dateLastModified: now,
    title:            `${year}–${year + 1} Academic Year`,
    type:             'schoolYear',
    startDate:        `${year}-08-01`,
    endDate:          `${year + 1}-05-31`,
    schoolYear:       `${year}`
  }];

  // ── Users (profiles) ─────────────────────────────────────────────────────
  const usersRows = (appDataRef.users || []).map(u => {
    const { givenName, familyName } = splitName(u.name);
    // Determine the user's primary role across all enrollments
    const roles = [...new Set(
      (appDataRef.enrollments || [])
        .filter(e => e.userId === u.id)
        .map(e => toOneRosterRole(e.role))
    )];
    return {
      sourcedId:        u.id,
      status:           u.status || 'active',
      dateLastModified: u.updatedAt || now,
      enabledUser:      'true',
      givenName,
      familyName,
      middleName:       '',
      identifier:       u.email,
      email:            u.email,
      username:         u.email,
      role:             roles.length === 1 ? roles[0] : (roles.includes('teacher') ? 'teacher' : 'student'),
      orgSourcedIds:    ORG_ID,
      grades:           ''
    };
  });

  // ── Courses (OneRoster Course = curriculum definition) ───────────────────
  const coursesRows = (appDataRef.courses || []).map(c => ({
    sourcedId:        c.id,
    status:           c.active === false ? 'tobedeleted' : 'active',
    dateLastModified: c.updatedAt || now,
    schoolYear:       SESSION_ID,
    title:            c.name,
    courseCode:       c.code,
    grades:           '',
    orgSourcedId:     ORG_ID
  }));

  // ── Classes (OneRoster Class = a section/offering of a Course) ───────────
  // We treat each Course as also its own Class (1-section-per-course model).
  const classesRows = (appDataRef.courses || []).map(c => ({
    sourcedId:        `class-${c.id}`,
    status:           c.active === false ? 'tobedeleted' : 'active',
    dateLastModified: c.updatedAt || now,
    title:            c.name,
    grade:            '',
    courseSourcedId:  c.id,
    classCode:        c.code,
    classType:        'scheduled',
    location:         '',
    schoolSourcedId:  ORG_ID,
    termSourcedIds:   SESSION_ID,
    subjectCodes:     '',
    periods:          ''
  }));

  // ── Enrollments ───────────────────────────────────────────────────────────
  let enrollmentCounter = 0;
  const enrollmentsRows = (appDataRef.enrollments || []).map(e => {
    enrollmentCounter++;
    return {
      sourcedId:        e.id || `enroll-${e.userId}-${e.courseId}`,
      status:           'active',
      dateLastModified: e.updatedAt || now,
      classSourcedId:   `class-${e.courseId}`,
      schoolSourcedId:  ORG_ID,
      userSourcedId:    e.userId,
      role:             toOneRosterRole(e.role),
      primary:          e.role === 'instructor' ? 'true' : 'false',
      beginDate:        '',
      endDate:          ''
    };
  });

  return {
    'orgs.csv':             toCsv(['sourcedId','status','dateLastModified','name','type','identifier','parentSourcedId'], orgsRows),
    'academicSessions.csv': toCsv(['sourcedId','status','dateLastModified','title','type','startDate','endDate','schoolYear'], academicSessionsRows),
    'users.csv':            toCsv(['sourcedId','status','dateLastModified','enabledUser','givenName','familyName','middleName','identifier','email','username','role','orgSourcedIds','grades'], usersRows),
    'courses.csv':          toCsv(['sourcedId','status','dateLastModified','schoolYear','title','courseCode','grades','orgSourcedId'], coursesRows),
    'classes.csv':          toCsv(['sourcedId','status','dateLastModified','title','grade','courseSourcedId','classCode','classType','location','schoolSourcedId','termSourcedIds','subjectCodes','periods'], classesRows),
    'enrollments.csv':      toCsv(['sourcedId','status','dateLastModified','classSourcedId','schoolSourcedId','userSourcedId','role','primary','beginDate','endDate'], enrollmentsRows),
  };
}

/**
 * Trigger browser download of all OneRoster CSVs as individual files.
 */
export function downloadOneRosterExport(appDataRef) {
  const files = generateOneRosterExport(appDataRef);
  Object.entries(files).forEach(([filename, csv]) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `oneroster_${filename}`; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALIPER ANALYTICS 1.2  (IMS Global / 1EdTech Sensor API)
// ═══════════════════════════════════════════════════════════════════════════════

let _caliperSensorId = null;
let _caliperEndpoint = null;
let _caliperDataVersion = 'http://purl.imsglobal.org/ctx/caliper/v1p2';

/**
 * Configure the Caliper sensor.  Call once after app init.
 * @param {string} sensorId  - URI identifying this LMS instance
 * @param {string} endpoint  - Caliper event store URL (POST endpoint)
 */
export function initCaliperSensor(sensorId, endpoint) {
  _caliperSensorId = sensorId;
  _caliperEndpoint = endpoint;
}

/**
 * Build and send a Caliper 1.2 event to the configured endpoint.
 * Silently no-ops if sensor is not configured.
 * @param {string} type    - Event type, e.g. 'SessionEvent'
 * @param {string} action  - Action verb, e.g. 'LoggedIn'
 * @param {Object} actor   - Caliper Person entity
 * @param {Object} object  - Entity being acted upon
 * @param {Object} [extra] - Additional event properties (generated, target, …)
 */
export async function emitCaliperEvent(type, action, actor, object, extra = {}) {
  if (!_caliperSensorId || !_caliperEndpoint) return;
  const event = {
    '@context': _caliperDataVersion,
    id: `urn:uuid:${crypto.randomUUID()}`,
    type,
    actor,
    action,
    object,
    eventTime: new Date().toISOString(),
    ...extra
  };
  const envelope = {
    sensor:      _caliperSensorId,
    sendTime:    new Date().toISOString(),
    dataVersion: _caliperDataVersion,
    data:        [event]
  };
  try {
    await fetch(_caliperEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope)
    });
  } catch (e) {
    console.warn('[Caliper] Failed to send event:', e.message);
  }
}

/** Build a Caliper Person entity from a user object. */
export function caliperPerson(user) {
  return { id: `urn:lms:user:${user.id}`, type: 'Person', name: user.name, email: user.email };
}

/** Build a Caliper SoftwareApplication entity (the LMS itself). */
export function caliperApp() {
  return { id: _caliperSensorId || 'urn:lms:app', type: 'SoftwareApplication', name: 'Campus LMS' };
}

/** Build a Caliper CourseSection entity from a course object. */
export function caliperCourse(course) {
  return { id: `urn:lms:course:${course.id}`, type: 'CourseSection', name: course.name, courseNumber: course.code };
}

/** Build a Caliper AssignableDigitalResource entity from an assignment. */
export function caliperAssignment(assignment) {
  return {
    id: `urn:lms:assignment:${assignment.id}`,
    type: 'AssignableDigitalResource',
    name: assignment.title,
    maxScore: assignment.points,
    dateToSubmit: assignment.dueDate
  };
}

/** Build a Caliper Assessment entity from a quiz. */
export function caliperAssessment(quiz) {
  return {
    id: `urn:lms:quiz:${quiz.id}`,
    type: 'Assessment',
    name: quiz.title,
    maxScore: quiz.points,
    maxAttempts: quiz.attempts || 1
  };
}

// ─── Convenience emitters ────────────────────────────────────────────────────

/** Emit SessionEvent/LoggedIn — call after successful authentication. */
export function caliperSessionLogin(user) {
  return emitCaliperEvent('SessionEvent', 'LoggedIn', caliperPerson(user), caliperApp());
}

/** Emit ViewEvent/Viewed — call on page/resource navigation. */
export function caliperViewPage(user, pageId, pageName) {
  return emitCaliperEvent('ViewEvent', 'Viewed', caliperPerson(user), {
    id: `urn:lms:page:${pageId}`, type: 'WebPage', name: pageName
  });
}

/** Emit AssignableEvent/Submitted — call when student submits an assignment. */
export function caliperAssignmentSubmit(user, assignment) {
  const actor = caliperPerson(user);
  const object = caliperAssignment(assignment);
  return emitCaliperEvent('AssignableEvent', 'Submitted', actor, object, {
    generated: {
      id: `urn:lms:attempt:${user.id}:${assignment.id}`,
      type: 'Attempt',
      assignee: actor,
      assignable: object,
      submittedAtTime: new Date().toISOString()
    }
  });
}

/** Emit GradeEvent/Graded — call when a grade is posted. */
export function caliperGradePosted(grader, assignment, scoreGiven, scoreMax) {
  return emitCaliperEvent('GradeEvent', 'Graded',
    grader ? caliperPerson(grader) : caliperApp(),
    caliperAssignment(assignment),
    {
      generated: {
        id: `urn:lms:score:${assignment.id}:${Date.now()}`,
        type: 'Score',
        scoreGiven,
        scoreMaximum: scoreMax
      }
    }
  );
}

/** Emit AssessmentEvent/Started — call when student begins a quiz. */
export function caliperQuizStart(user, quiz) {
  return emitCaliperEvent('AssessmentEvent', 'Started', caliperPerson(user), caliperAssessment(quiz));
}

/** Emit AssessmentEvent/Completed — call when student submits a quiz. */
export function caliperQuizComplete(user, quiz, scoreGiven) {
  const actor = caliperPerson(user);
  const object = caliperAssessment(quiz);
  return emitCaliperEvent('AssessmentEvent', 'Completed', actor, object, {
    generated: {
      id: `urn:lms:attempt:quiz:${user.id}:${quiz.id}`,
      type: 'Attempt',
      assignee: actor,
      assignable: object,
      submittedAtTime: new Date().toISOString(),
      ...(scoreGiven !== undefined ? { score: { type: 'Score', scoreGiven, scoreMaximum: quiz.points } } : {})
    }
  });
}
