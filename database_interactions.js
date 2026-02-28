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
      // Exclude sensitive profile-only fields from the client payload.
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
      createdBy: c.created_by,
      startHereTitle: c.start_here_title,
      startHereContent: c.start_here_content,
      active: c.active,
      orgId: c.org_id || null,
      departmentId: c.department_id || null
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
      timeLimit: a.time_limit ?? a.time_allowed ?? null,
      // CC 1.4 grading fields — map from snake_case DB columns
      gradingType: a.grading_type || 'points',
      assignmentType: a.assignment_type || a.category || 'essay',
      submissionAttempts: a.submission_attempts || null,
      latePenaltyType: a.late_penalty_type || 'per_day',
      visibleToStudents: a.visible_to_students !== false,
      showStatsToStudents: a.show_stats_to_students === true,
      // Quiz-specific
      questionBankId: a.question_bank_id || null,
      numQuestions: a.num_questions || null,
      timeLimit: a.time_limit || null,
      randomizeQuestions: a.randomize_questions === true,
      // Essay-specific
      submissionModalities: a.submission_modalities || null,
      allowedFileTypes: a.allowed_file_types || null,
      maxFileSizeMb: a.max_file_size_mb || null,
      // Shared
      gradingNotes: a.grading_notes || null,
      blindGrading: a.blind_grading === true,
      // Group assignment
      isGroupAssignment: a.is_group_assignment === true,
      groupSetId: a.group_set_id || null,
      groupGradingMode: a.group_grading_mode || 'per_group',
      rubric: null
    }));

    appData.submissions = (submissionsRes.data || []).map(s => ({
      id: s.id,
      assignmentId: s.assignment_id,
      userId: s.user_id,
      text: s.content,
      fileName: s.file_name,
      filePath: s.file_path,
      submittedAt: s.submitted_at,
      groupId: s.group_id || null
    }));

    appData.grades = (gradesRes.data || []).map(g => {
      const rawFeedback = g.feedback || '';
      const isIncomplete = rawFeedback.startsWith('[INCOMPLETE]');
      return {
        submissionId: g.submission_id,
        score: g.score,
        feedback: isIncomplete ? rawFeedback.replace('[INCOMPLETE] ', '').replace('[INCOMPLETE]', '') : rawFeedback,
        released: g.released,
        gradedBy: g.graded_by,
        gradedAt: g.graded_at,
        excused: g.excused || false,
        incomplete: isIncomplete
      };
    });

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
      hidden: f.hidden || false,
      folder: f.folder || null
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
      timeLimit: o.time_limit ?? o.time_allowed ?? null
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

    // Calendar events (non-assignment)
    const calEventsRes = await supabaseClient.from('calendar_events').select('*').order('event_date', { ascending: true });
    if (calEventsRes.error) {
      console.warn('[Supabase] Error loading calendar_events:', calEventsRes.error.message);
    } else {
      appData.calendarEvents = (calEventsRes.data || []).map(ev => ({
        id: ev.id,
        courseId: ev.course_id,
        title: ev.title,
        eventDate: ev.event_date,
        eventType: ev.event_type || 'Event',
        description: ev.description || '',
        createdBy: ev.created_by,
        createdAt: ev.created_at
      }));
      console.log(`[Supabase] Loaded ${appData.calendarEvents.length} calendar_events`);
    }

    appData.settings = {};

    // ── Group Sets, Groups, Group Members ──────────────────────────────
    const [groupSetsRes, courseGroupsRes, groupMembersRes] = await Promise.all([
      supabaseClient.from('group_sets').select('*').order('created_at', { ascending: true }),
      supabaseClient.from('course_groups').select('*').order('name', { ascending: true }),
      supabaseClient.from('group_members').select('*')
    ]);
    [{ name: 'group_sets', res: groupSetsRes }, { name: 'course_groups', res: courseGroupsRes }, { name: 'group_members', res: groupMembersRes }]
      .forEach(({ name, res }) => { if (res.error) console.warn(`[Supabase] Error loading ${name}:`, res.error.message); });

    const groupMembersData = (groupMembersRes.data || []).map(gm => ({
      id: gm.id, groupId: gm.group_id, userId: gm.user_id, joinedAt: gm.joined_at
    }));
    appData.courseGroups = (courseGroupsRes.data || []).map(g => ({
      id: g.id, groupSetId: g.group_set_id, courseId: g.course_id, name: g.name, createdAt: g.created_at,
      members: groupMembersData.filter(gm => gm.groupId === g.id)
    }));
    appData.groupSets = (groupSetsRes.data || []).map(gs => ({
      id: gs.id, courseId: gs.course_id, name: gs.name, description: gs.description,
      createdBy: gs.created_by, createdAt: gs.created_at,
      groups: appData.courseGroups.filter(g => g.groupSetId === gs.id)
    }));
    appData.groupMembers = groupMembersData;
    console.log(`[Supabase] Loaded ${appData.groupSets.length} group_sets, ${appData.courseGroups.length} groups`);

    // ── Conversations / Messages ──────────────────────────────────────
    const [convosRes, convParticipantsRes, messagesRes] = await Promise.all([
      supabaseClient.from('conversations').select('*').order('updated_at', { ascending: false }),
      supabaseClient.from('conversation_participants').select('*'),
      supabaseClient.from('messages').select('*').order('created_at', { ascending: true })
    ]);
    [{ name: 'conversations', res: convosRes }, { name: 'conversation_participants', res: convParticipantsRes }, { name: 'messages', res: messagesRes }]
      .forEach(({ name, res }) => { if (res.error) console.warn(`[Supabase] Error loading ${name}:`, res.error.message); });

    const participants = (convParticipantsRes.data || []).map(cp => ({
      id: cp.id, conversationId: cp.conversation_id, userId: cp.user_id, lastReadAt: cp.last_read_at
    }));
    const allMessages = (messagesRes.data || []).map(m => ({
      id: m.id, conversationId: m.conversation_id, senderId: m.sender_id,
      content: m.content, createdAt: m.created_at
    }));
    appData.conversations = (convosRes.data || []).map(c => ({
      id: c.id, courseId: c.course_id, subject: c.subject, createdBy: c.created_by,
      createdAt: c.created_at, updatedAt: c.updated_at,
      participants: participants.filter(p => p.conversationId === c.id),
      messages: allMessages.filter(m => m.conversationId === c.id)
    }));
    appData.conversationParticipants = participants;
    appData.allMessages = allMessages;
    console.log(`[Supabase] Loaded ${appData.conversations.length} conversations, ${allMessages.length} messages`);

    // ── Notifications ────────────────────────────────────────────────
    const [notificationsRes, notifPrefsRes] = await Promise.all([
      supabaseClient.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseClient.from('notification_preferences').select('*')
    ]);
    if (notificationsRes.error) console.warn('[Supabase] Error loading notifications:', notificationsRes.error.message);
    if (notifPrefsRes.error) console.warn('[Supabase] Error loading notification_preferences:', notifPrefsRes.error.message);

    appData.notifications = (notificationsRes.data || []).map(n => ({
      id: n.id, userId: n.user_id, courseId: n.course_id, type: n.type,
      title: n.title, body: n.body, link: n.link, refId: n.ref_id,
      isRead: n.is_read, createdAt: n.created_at
    }));
    const myPrefs = (notifPrefsRes.data || []).find(p => p.user_id === appData.currentUser?.id);
    appData.notificationPreferences = myPrefs ? {
      gradeReleased: myPrefs.grade_released, assignmentDue: myPrefs.assignment_due,
      announcement: myPrefs.announcement, submissionReceived: myPrefs.submission_received,
      quizAvailable: myPrefs.quiz_available, messageReceived: myPrefs.message_received,
      groupCreated: myPrefs.group_created, dueDateReminder: myPrefs.due_date_reminder,
      reminderHoursBefore: myPrefs.reminder_hours_before
    } : null;
    console.log(`[Supabase] Loaded ${appData.notifications.length} notifications`);

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
    points: assignment.points || 0,
    status: assignment.status || 'draft',
    due_date: assignment.dueDate || null,
    available_from: assignment.availableFrom || null,
    available_until: assignment.availableUntil || null,
    allow_late_submissions: assignment.allowLateSubmissions !== false,
    late_deduction: assignment.lateDeduction || 10,
    late_penalty_type: assignment.latePenaltyType || 'per_day',
    allow_resubmission: assignment.allowResubmission !== false,
    submission_attempts: assignment.submissionAttempts || null,
    hidden: assignment.hidden || false,
    category: assignment.category || 'homework',
    grading_type: assignment.gradingType || 'points',
    assignment_type: assignment.assignmentType || 'essay',
    visible_to_students: assignment.visibleToStudents !== false,
    show_stats_to_students: assignment.showStatsToStudents === true,
    // Quiz-specific
    question_bank_id: assignment.questionBankId || null,
    time_limit: assignment.timeLimit || null,
    randomize_questions: assignment.randomizeQuestions === true,
    // Essay-specific
    submission_modalities: assignment.submissionModalities || null,
    allowed_file_types: assignment.allowedFileTypes || null,
    max_file_size_mb: assignment.maxFileSizeMb || null,
    // Group assignment
    is_group_assignment: assignment.isGroupAssignment || false,
    group_set_id: assignment.groupSetId || null,
    group_grading_mode: assignment.groupGradingMode || 'per_group',
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
    late_penalty_type: assignment.latePenaltyType || 'per_day',
    allow_resubmission: assignment.allowResubmission,
    submission_attempts: assignment.submissionAttempts || null,
    grading_type: assignment.gradingType || 'points',
    assignment_type: assignment.assignmentType || 'essay',
    hidden: assignment.hidden || false,
    category: assignment.category,
    visible_to_students: assignment.visibleToStudents !== false,
    show_stats_to_students: assignment.showStatsToStudents === true,
    // Quiz-specific
    question_bank_id: assignment.questionBankId || null,
    time_limit: assignment.timeLimit || null,
    randomize_questions: assignment.randomizeQuestions === true,
    // Essay-specific
    submission_modalities: assignment.submissionModalities || null,
    allowed_file_types: assignment.allowedFileTypes || null,
    max_file_size_mb: assignment.maxFileSizeMb || null,
    // Group assignment
    is_group_assignment: assignment.isGroupAssignment || false,
    group_set_id: assignment.groupSetId || null,
    group_grading_mode: assignment.groupGradingMode || 'per_group'
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


export async function supabaseUpdateModuleItem(itemId, updates) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update module item: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating module item:', itemId, updates);

  const authUser = await debugAuthState('updateModuleItem');
  if (!authUser) {
    console.error('[Supabase] Cannot update module item: not authenticated');
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  const { data, error } = await supabaseClient.from('module_items').update(updates).eq('id', itemId).select().single();

  if (error) {
    console.error('[Supabase] Error updating module item:', error);
    if (showToast) showToast('Failed to update module item: ' + error.message, 'error');
    return null;
  }
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
    file_path: submission.filePath || null,
    group_id: submission.groupId || null
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
    graded_by: grade.gradedBy || appData.currentUser?.id,
    excused: grade.excused || false
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

/**
 * Upsert a profiles row for the signed-in user.
 * Called on every sign-in so invited users (who have an auth.users row but no
 * profiles row) get their row created automatically. Existing rows are updated
 * with fresh OAuth metadata (name, email).
 */
export async function supabaseEnsureProfile(user) {
  if (!supabaseClient || !user?.id) return;

  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
  const givenName = user.user_metadata?.given_name || null;
  const familyName = user.user_metadata?.family_name || null;

  const { error } = await supabaseClient.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      name: fullName,
      given_name: givenName,
      family_name: familyName,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  );

  if (error) {
    // Non-fatal: log and continue. The rest of the sign-in flow will still work
    // because the handle_new_user() trigger already created the profile row.
    console.warn('[Supabase] Could not upsert profile:', error.message);
  } else {
    console.log('[Supabase] Profile upserted for', user.email);
  }

  // Accept pending invites.  Try the SECURITY DEFINER RPC first (handles
  // org_members creation and org_invites deletion which need elevated
  // privileges).  Then run a client-side pass for anything the RPC missed
  // (e.g. if the RPC migration hasn't been applied yet, or for course-level
  // invites that the older RPC version didn't handle).
  const { error: rpcErr } = await supabaseClient.rpc('accept_pending_org_invites');
  if (rpcErr) {
    console.warn('[Supabase] accept_pending_org_invites RPC:', rpcErr.message);
  }
  await acceptPendingInvitesClientSide(user);
}

/**
 * Client-side fallback for accepting pending invites.
 *
 * Handles both org-level (org_invites → org_members) and course-level
 * (invites → enrollments) acceptance.  Requires RLS policies that allow:
 *   • SELECT on org_invites for own email
 *   • INSERT on org_members when a pending org_invite exists
 *   • DELETE on org_invites for own email
 *   • SELECT on invites for own email          (existing policy)
 *   • INSERT on enrollments with pending invite (existing policy)
 *   • DELETE on invites for own email           (existing policy)
 *
 * Safe to call even if the RPC already handled everything — queries will
 * return no pending rows and the function becomes a no-op.
 */
async function acceptPendingInvitesClientSide(user) {
  if (!supabaseClient || !user?.email) return;
  const email = user.email.toLowerCase();

  // ── Org-level invites ──────────────────────────────────────────────────────
  try {
    const { data: orgInvites } = await supabaseClient
      .from('org_invites')
      .select('id, org_id, role, invited_by')
      .eq('email', email)
      .eq('status', 'pending');

    for (const inv of (orgInvites || [])) {
      const { error: memErr } = await supabaseClient.from('org_members').insert({
        org_id:     inv.org_id,
        user_id:    user.id,
        role:       inv.role,
        created_by: inv.invited_by || user.id
      });
      if (memErr) {
        console.warn('[Supabase] client-side org_members insert:', memErr.message);
        continue;  // skip delete if insert failed
      }
      const { error: delErr } = await supabaseClient
        .from('org_invites').delete().eq('id', inv.id);
      if (delErr) {
        console.warn('[Supabase] client-side org_invites delete:', delErr.message);
      }
    }
  } catch (e) {
    console.warn('[Supabase] client-side org invite acceptance:', e.message);
  }

  // ── Course-level invites ───────────────────────────────────────────────────
  try {
    const { data: courseInvites } = await supabaseClient
      .from('invites')
      .select('id, course_id, role')
      .eq('email', email)
      .eq('status', 'pending');

    for (const inv of (courseInvites || [])) {
      const { error: enrollErr } = await supabaseClient.from('enrollments').insert({
        user_id:   user.id,
        course_id: inv.course_id,
        role:      inv.role || 'student'
      });
      if (enrollErr) {
        console.warn('[Supabase] client-side enrollment insert:', enrollErr.message);
        continue;
      }
      const { error: delErr } = await supabaseClient
        .from('invites').delete().eq('id', inv.id);
      if (delErr) {
        console.warn('[Supabase] client-side invites delete:', delErr.message);
      }
    }
  } catch (e) {
    console.warn('[Supabase] client-side course invite acceptance:', e.message);
  }
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
    hidden: file.hidden || false,
    folder: file.folder || null
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
    hidden: file.hidden || false,
    folder: file.folder || null
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
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
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
    if (showToast) showToast('Failed to create question bank: ' + error.message, 'error');
    return null;
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
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return null;
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
    if (showToast) showToast('Failed to update question bank: ' + error.message, 'error');
    return null;
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
    if (showToast) showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  const { error } = await supabaseClient.from('question_banks').delete().eq('id', bankId);
  if (error) {
    console.error('[Supabase] Error deleting question bank:', error);
    if (showToast) showToast('Failed to delete question bank: ' + error.message, 'error');
    return false;
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
    time_limit: override.timeLimit != null ? override.timeLimit : null
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
// CALENDAR EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateCalendarEvent(ev) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('calendar_events').insert({
    id: ev.id,
    course_id: ev.courseId,
    title: ev.title,
    event_date: ev.eventDate,
    event_type: ev.eventType || 'Event',
    description: ev.description || null,
    created_by: ev.createdBy
  }).select().single();
  if (error) { console.error('[Supabase] Create calendar event error:', error); showToast('Failed to save event', 'error'); return null; }
  return data;
}

export async function supabaseDeleteCalendarEvent(eventId) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('calendar_events').delete().eq('id', eventId);
  if (error) { console.error('[Supabase] Delete calendar event error:', error); showToast('Failed to delete event', 'error'); return false; }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load the latest feature flag state for the user's org.
 * Uses a SECURITY DEFINER RPC (get_org_feature_flags) so regular org members
 * can read flags without direct admin_audit_log access.
 * Returns an object like { ai_enabled: true, discussion_enabled: true }.
 */
export async function supabaseLoadFeatureFlags(orgId) {
  if (!supabaseClient || !orgId) return {};
  try {
    const { data, error } = await supabaseClient.rpc('get_org_feature_flags', { p_org_id: orgId });
    if (error) { console.warn('[Supabase] loadFeatureFlags RPC error:', error.message); return {}; }
    if (!data || typeof data !== 'object') return {};
    // Normalise: jsonb values may arrive as booleans or strings
    const flags = {};
    Object.entries(data).forEach(([k, v]) => {
      flags[k] = v === true || v === 'true';
    });
    return flags;
  } catch (err) {
    console.warn('[Supabase] loadFeatureFlags error:', err);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP SET OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateGroupSet(groupSet) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('group_sets').insert({
    id: groupSet.id,
    course_id: groupSet.courseId,
    name: groupSet.name,
    description: groupSet.description || null,
    created_by: appData.currentUser?.id
  }).select().single();
  if (error) { console.error('[Supabase] Create group set error:', error); showToast('Failed to create group set', 'error'); return null; }
  return data;
}

export async function supabaseUpdateGroupSet(groupSet) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('group_sets')
    .update({ name: groupSet.name, description: groupSet.description || null })
    .eq('id', groupSet.id).select().single();
  if (error) { console.error('[Supabase] Update group set error:', error); showToast('Failed to update group set', 'error'); return null; }
  return data;
}

export async function supabaseDeleteGroupSet(id) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('group_sets').delete().eq('id', id);
  if (error) { console.error('[Supabase] Delete group set error:', error); showToast('Failed to delete group set', 'error'); return false; }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE GROUP OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateCourseGroup(group) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('course_groups').insert({
    id: group.id,
    group_set_id: group.groupSetId,
    course_id: group.courseId,
    name: group.name
  }).select().single();
  if (error) { console.error('[Supabase] Create group error:', error); showToast('Failed to create group', 'error'); return null; }
  return data;
}

export async function supabaseUpdateCourseGroup(group) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('course_groups')
    .update({ name: group.name })
    .eq('id', group.id).select().single();
  if (error) { console.error('[Supabase] Update group error:', error); showToast('Failed to update group', 'error'); return null; }
  return data;
}

export async function supabaseDeleteCourseGroup(id) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('course_groups').delete().eq('id', id);
  if (error) { console.error('[Supabase] Delete group error:', error); showToast('Failed to delete group', 'error'); return false; }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP MEMBER OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseAddGroupMember(groupId, userId) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('group_members').insert({
    group_id: groupId,
    user_id: userId
  }).select().single();
  if (error) { console.error('[Supabase] Add group member error:', error); return null; }
  return data;
}

export async function supabaseRemoveGroupMember(groupId, userId) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('group_members')
    .delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) { console.error('[Supabase] Remove group member error:', error); return false; }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATION / MESSAGING OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateConversation(conv) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('conversations').insert({
    id: conv.id,
    course_id: conv.courseId,
    subject: conv.subject || null,
    created_by: appData.currentUser?.id
  }).select().single();
  if (error) { console.error('[Supabase] Create conversation error:', error); showToast('Failed to create conversation', 'error'); return null; }
  return data;
}

export async function supabaseAddConversationParticipant(conversationId, userId) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('conversation_participants').insert({
    conversation_id: conversationId,
    user_id: userId
  }).select().single();
  if (error) { console.error('[Supabase] Add participant error:', error); return null; }
  return data;
}

export async function supabaseCreateMessage(msg) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('messages').insert({
    id: msg.id,
    conversation_id: msg.conversationId,
    sender_id: appData.currentUser?.id,
    content: msg.content
  }).select().single();
  if (error) { console.error('[Supabase] Create message error:', error); showToast('Failed to send message', 'error'); return null; }

  // Update conversation updated_at
  await supabaseClient.from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', msg.conversationId);

  return data;
}

export async function supabaseSendDirectMessage(courseId, recipientId, subject, content) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.rpc('send_direct_message', {
    p_course_id: courseId,
    p_recipient_id: recipientId,
    p_subject: subject || null,
    p_content: content
  });
  if (error) { console.error('[Supabase] send_direct_message error:', error); showToast('Failed to send message', 'error'); return null; }
  return data;
}

export async function supabaseGetCourseRecipients(courseId) {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient.rpc('get_course_recipients', {
    p_course_id: courseId
  });
  if (error) { console.error('[Supabase] get_course_recipients error:', error); return []; }
  return (data || []).map(r => ({
    id: r.user_id,
    name: r.name,
    email: r.email,
    role: r.role,
    avatar: r.avatar
  }));
}

export async function supabaseSendReplyMessage(conversationId, content) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.rpc('send_reply_message', {
    p_conversation_id: conversationId,
    p_content: content
  });
  if (error) { console.error('[Supabase] send_reply_message error:', error); showToast('Failed to send reply', 'error'); return null; }
  return data;
}

export async function supabaseMarkConversationRead(conversationId) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', appData.currentUser?.id);
  if (error) { console.error('[Supabase] Mark read error:', error); return false; }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function supabaseCreateNotification(notif) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('notifications').insert({
    user_id: notif.userId,
    course_id: notif.courseId || null,
    type: notif.type,
    title: notif.title,
    body: notif.body || null,
    link: notif.link || null,
    ref_id: notif.refId || null
  }).select().single();
  if (error) { console.error('[Supabase] Create notification error:', error); return null; }
  return data;
}

export async function supabaseNotifyCourseStudents(courseId, type, title, body, link, refId) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.rpc('notify_course_students', {
    p_course_id: courseId,
    p_type: type,
    p_title: title,
    p_body: body || null,
    p_link: link || null,
    p_ref_id: refId || null
  });
  if (error) { console.error('[Supabase] Notify course students error:', error); return false; }
  return true;
}

export async function supabaseMarkNotificationRead(id) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('notifications')
    .update({ is_read: true }).eq('id', id);
  if (error) { console.error('[Supabase] Mark notification read error:', error); return false; }
  return true;
}

export async function supabaseMarkAllNotificationsRead() {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('notifications')
    .update({ is_read: true })
    .eq('user_id', appData.currentUser?.id)
    .eq('is_read', false);
  if (error) { console.error('[Supabase] Mark all read error:', error); return false; }
  return true;
}

export async function supabaseDeleteNotification(id) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from('notifications').delete().eq('id', id);
  if (error) { console.error('[Supabase] Delete notification error:', error); return false; }
  return true;
}

export async function supabaseUpsertNotificationPreferences(prefs) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('notification_preferences').upsert({
    user_id: appData.currentUser?.id,
    grade_released: prefs.gradeReleased ?? true,
    assignment_due: prefs.assignmentDue ?? true,
    announcement: prefs.announcement ?? true,
    submission_received: prefs.submissionReceived ?? true,
    quiz_available: prefs.quizAvailable ?? true,
    message_received: prefs.messageReceived ?? true,
    group_created: prefs.groupCreated ?? true,
    due_date_reminder: prefs.dueDateReminder ?? true,
    reminder_hours_before: prefs.reminderHoursBefore ?? 24
  }, { onConflict: 'user_id' }).select().single();
  if (error) { console.error('[Supabase] Upsert notification prefs error:', error); showToast('Failed to save notification preferences', 'error'); return null; }
  return data;
}
