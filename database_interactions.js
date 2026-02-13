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
      gradeCategoriesRes
    ] = await Promise.all([
      supabaseClient.from('profiles').select('*'),
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
      supabaseClient.from('grade_categories').select('*')
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
      { name: 'grade_categories', res: gradeCategoriesRes }
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
      createdAt: a.created_at,
      allowLateSubmissions: a.allow_late_submissions,
      lateDeduction: a.late_deduction,
      allowResubmission: a.allow_resubmission,
      category: a.category,
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

    appData.settings = {};

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

  const { data, error } = await supabaseClient.from('assignments').insert({
    id: assignment.id,
    course_id: assignment.courseId,
    title: assignment.title,
    description: assignment.description || null,
    points: assignment.points || 100,
    status: assignment.status || 'draft',
    due_date: assignment.dueDate || null,
    allow_late_submissions: assignment.allowLateSubmissions !== false,
    late_deduction: assignment.lateDeduction || 10,
    allow_resubmission: assignment.allowResubmission !== false,
    category: assignment.category || 'homework',
    created_by: appData.currentUser?.id
  }).select().single();

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

  const { data, error } = await supabaseClient.from('assignments').update({
    title: assignment.title,
    description: assignment.description,
    points: assignment.points,
    status: assignment.status,
    due_date: assignment.dueDate,
    allow_late_submissions: assignment.allowLateSubmissions,
    late_deduction: assignment.lateDeduction,
    allow_resubmission: assignment.allowResubmission,
    category: assignment.category
  }).eq('id', assignment.id).select().single();

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

  const { data, error } = await supabaseClient.from('files').insert({
    id: file.id,
    course_id: file.courseId,
    name: file.name,
    type: file.type,
    size: file.size,
    uploaded_by: file.uploadedBy,
    uploaded_at: file.uploadedAt,
    external_url: file.externalUrl,
    description: file.description,
    is_placeholder: file.isPlaceholder,
    is_youtube: file.isYouTube,
    hidden: file.hidden || false
  }).select().single();

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

  const { data, error } = await supabaseClient.from('files').update({
    name: file.name,
    type: file.type,
    size: file.size,
    external_url: file.externalUrl,
    description: file.description,
    is_placeholder: file.isPlaceholder,
    is_youtube: file.isYouTube,
    hidden: file.hidden || false
  }).eq('id', file.id).select().single();

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

  const { data, error } = await supabaseClient.from('question_banks').insert({
    id: bank.id,
    course_id: bank.courseId,
    name: bank.name,
    description: bank.description || null,
    questions: JSON.stringify(bank.questions || []),
    created_by: appData.currentUser?.id
  }).select().single();

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

  const { data, error } = await supabaseClient.from('question_banks').update({
    name: bank.name,
    description: bank.description,
    questions: JSON.stringify(bank.questions || [])
  }).eq('id', bank.id).select().single();

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

  const supabaseUrl = window.SUPABASE_URL;
  const anonKey = window.SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/gemini`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Supabase Edge gateway may require the anon key even when a user JWT is provided.
      ...(anonKey ? { 'apikey': anonKey } : {}),
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ contents, generationConfig })
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Gemini API error: ${response.status}`;

    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.error || errorMessage;
    } catch {
      // Keep fallback message when body is not JSON
    }

    if (response.status === 401) {
      errorMessage += '. Unauthorized calling Edge Function. Verify function JWT settings and ensure request includes Authorization bearer token + anon apikey.';
    }

    throw new Error(errorMessage);
  }

  return response.json();
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
