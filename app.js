/* ═══════════════════════════════════════════════════════════════════════════════
   Campus LMS - Complete Implementation
   Supabase-powered LMS with Google OAuth, courses, assignments, gradebook, AI
═══════════════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

let supabaseClient = null;

function initSupabase() {
  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_ANON_KEY;

  if (!url || url === 'YOUR_SUPABASE_PROJECT_URL' || !key || key === 'YOUR_SUPABASE_ANON_KEY') {
    console.error('[Supabase] Configuration missing! Please update config.js with your Supabase credentials.');
    showConfigError();
    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(url, key);
    console.log('[Supabase] Client initialized successfully');
    return true;
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err);
    return false;
  }
}

function showConfigError() {
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = `
        <strong>Configuration Required</strong><br>
        Please update <code>config.js</code> with your Supabase credentials:<br>
        <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code>
      `;
    }
    const signInBtn = document.getElementById('googleSignInBtn');
    if (signInBtn) signInBtn.disabled = true;
  }
}

// Global debug function - call window.checkAuth() from browser console to verify auth state
window.checkAuth = async function() {
  console.log('=== Supabase Auth Debug ===');

  if (!supabaseClient) {
    console.error('Supabase client not initialized');
    return { authenticated: false, reason: 'client not initialized' };
  }

  try {
    // Check user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError) {
      console.error('Error getting user:', userError);
      return { authenticated: false, reason: 'error', error: userError };
    }

    if (!user) {
      console.warn('⚠️ NOT AUTHENTICATED - auth.uid() will return NULL');
      console.warn('All RLS policies requiring auth.uid() will FAIL');
      return { authenticated: false, reason: 'no user' };
    }

    // Check session
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    console.log('✓ User ID:', user.id);
    console.log('✓ Email:', user.email);
    console.log('✓ Provider:', user.app_metadata?.provider || 'unknown');
    console.log('✓ Role:', user.role);

    if (session) {
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const minutesRemaining = Math.round((expiresAt - now) / 60000);
      console.log('✓ Session expires:', expiresAt.toISOString(), `(${minutesRemaining} minutes remaining)`);
      console.log('✓ Access token (first 50 chars):', session.access_token?.substring(0, 50) + '...');
    } else {
      console.warn('⚠️ No session found');
    }

    // Check local app state
    console.log('---');
    console.log('App state user:', appData.currentUser);

    // Verify IDs match
    if (appData.currentUser && appData.currentUser.id !== user.id) {
      console.error('⚠️ ID MISMATCH! App user ID:', appData.currentUser.id, '!== Supabase user ID:', user.id);
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        provider: user.app_metadata?.provider
      },
      session: session ? {
        expiresAt: new Date(session.expires_at * 1000).toISOString()
      } : null
    };
  } catch (err) {
    console.error('Exception checking auth:', err);
    return { authenticated: false, reason: 'exception', error: err.message };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Style Theme - Always use Editorial style
// ═══════════════════════════════════════════════════════════════════════════════
(function initStyleTheme() {
  // Always apply style-1 (Editorial) as the default and only style
  document.documentElement.classList.add('style-1');

  if (document.body) {
    document.body.classList.add('style-1');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('style-1');
    });
  }
})();

const ALLOWED_DOMAINS = ['university.edu', 'demo.edu'];

// Default data structure
const defaultData = {
  currentUser: null,
  users: [
    { id: 'u1', name: 'Dr. Sarah Chen', email: 'schen@university.edu', role: 'instructor', avatar: 'SC' },
    { id: 'u2', name: 'Michael Park', email: 'mpark@university.edu', role: 'ta', avatar: 'MP' },
    { id: 'u3', name: 'Emma Wilson', email: 'ewilson@student.edu', role: 'student', avatar: 'EW' },
    { id: 'u4', name: 'James Rodriguez', email: 'jrodriguez@student.edu', role: 'student', avatar: 'JR' },
    { id: 'u5', name: 'Aisha Patel', email: 'apatel@student.edu', role: 'student', avatar: 'AP' }
  ],
  courses: [
    { id: 'c1', name: 'ECON 101 - Introduction to Economics', code: 'ECON101', inviteCode: 'ECON2025', createdBy: 'u1', description: 'An introduction to microeconomic and macroeconomic principles', startHereTitle: 'Start Here', startHereContent: 'Welcome to **ECON 101**! Begin by reviewing the syllabus and completing Quiz 1 before next week.' },
    { id: 'c2', name: 'ECON 301 - Advanced Microeconomics', code: 'ECON301', inviteCode: 'MICRO25', createdBy: 'u1', description: 'Advanced topics in microeconomic theory and applications', startHereTitle: 'Start Here', startHereContent: 'Read the course overview, then jump into the first problem set.' }
  ],
  enrollments: [
    { userId: 'u1', courseId: 'c1', role: 'instructor' },
    { userId: 'u1', courseId: 'c2', role: 'instructor' },
    { userId: 'u2', courseId: 'c1', role: 'ta' },
    { userId: 'u3', courseId: 'c1', role: 'student' },
    { userId: 'u4', courseId: 'c1', role: 'student' },
    { userId: 'u5', courseId: 'c1', role: 'student' },
    { userId: 'u3', courseId: 'c2', role: 'student' }
  ],
  assignments: [
    { 
      id: 'a1', 
      courseId: 'c1', 
      title: 'Problem Set 1: Supply and Demand', 
      description: 'Complete problems 1-10 from Chapter 2. Show all work.',
      points: 100,
      status: 'published',
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      allowLateSubmissions: true,
      lateDeduction: 10,
      allowResubmission: true,
      category: 'homework',
      rubric: null
    },
    { 
      id: 'a2', 
      courseId: 'c1', 
      title: 'Economic Analysis Essay', 
      description: 'Write a 1500-word analysis of a current economic issue.',
      points: 150,
      status: 'published',
      dueDate: new Date(Date.now() + 86400000 * 14).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      allowLateSubmissions: false,
      lateDeduction: 0,
      allowResubmission: false,
      category: 'essay',
      rubric: null
    },
    { 
      id: 'a3', 
      courseId: 'c2', 
      title: 'Game Theory Problem Set', 
      description: 'Solve the Nash equilibrium problems.',
      points: 100,
      status: 'draft',
      dueDate: new Date(Date.now() + 86400000 * 10).toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      allowLateSubmissions: true,
      lateDeduction: 5,
      allowResubmission: true,
      category: 'homework',
      rubric: null
    }
  ],
  submissions: [
    { id: 's1', assignmentId: 'a1', userId: 'u3', text: 'My solution to problem set 1...', fileName: null, fileData: null, submittedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 's2', assignmentId: 'a1', userId: 'u4', text: 'Here are my answers...', fileName: 'answers.pdf', fileData: null, submittedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 's3', assignmentId: 'a2', userId: 'u3', text: 'Economic analysis essay draft...', fileName: null, fileData: null, submittedAt: new Date(Date.now() - 3600000).toISOString() }
  ],
  grades: [
    { submissionId: 's1', score: 92, feedback: 'Excellent work! Clear explanations.', released: true, gradedBy: 'u1', gradedAt: new Date().toISOString() },
    { submissionId: 's2', score: 78, feedback: 'Good effort, but problem 7 needs more detail.', released: false, gradedBy: 'u2', gradedAt: new Date().toISOString() }
  ],
  announcements: [
    { id: 'an1', courseId: 'c1', title: 'Welcome to ECON 101!', content: 'Welcome! Please review the syllabus and complete the first assignment by next Friday.', pinned: true, authorId: 'u1', createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: 'an2', courseId: 'c1', title: 'Office Hours Update', content: 'Office hours moved to Wednesdays 2-4pm.', pinned: false, authorId: 'u1', createdAt: new Date(Date.now() - 86400000).toISOString() }
  ],
  files: [
    { id: 'f1', courseId: 'c1', name: 'Course Syllabus.pdf', type: 'pdf', size: 245000, uploadedBy: 'u1', uploadedAt: new Date(Date.now() - 86400000 * 10).toISOString() },
    { id: 'f2', courseId: 'c1', name: 'Week 1 Slides.pptx', type: 'pptx', size: 1200000, uploadedBy: 'u1', uploadedAt: new Date(Date.now() - 86400000 * 7).toISOString() }
  ],
  rubrics: [
    // { id, assignmentId, criteria: [{ name, points, description }] }
  ],
  quizzes: [
    {
      id: 'q1',
      courseId: 'c1',
      title: 'Quiz 1: Market Basics',
      description: 'Short quiz on supply and demand basics.',
      status: 'published',
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      timeLimit: 20,
      attempts: 2,
      randomizeQuestions: true,
      questionPoolEnabled: true,
      questionSelectCount: 3,
      questions: [
        { id: 'q1-1', type: 'multiple_choice', prompt: 'What happens to quantity demanded when price increases?', options: ['Increases', 'Decreases', 'Stays the same', 'Becomes zero'], correctAnswer: 1, points: 2 },
        { id: 'q1-2', type: 'true_false', prompt: 'A price ceiling can create a shortage.', options: ['True', 'False'], correctAnswer: 'True', points: 2 },
        { id: 'q1-3', type: 'multiple_choice', prompt: 'Equilibrium occurs where?', options: ['Supply equals demand', 'Demand exceeds supply', 'Supply exceeds demand', 'Demand is zero'], correctAnswer: 0, points: 2 },
        { id: 'q1-4', type: 'short_answer', prompt: 'In one sentence, define opportunity cost.', options: [], correctAnswer: '', points: 4 }
      ]
    }
  ],
  quizQuestions: [
    // { id, quizId, type: 'multiple_choice'|'true_false'|'short_answer', question, options: [], correctAnswer, points }
  ],
  quizSubmissions: [
    // { id, quizId, userId, answers: {}, score, submittedAt }
  ],
  gradeCategories: [
    // { courseId, name, weight } - e.g., { courseId: 'c1', name: 'Homework', weight: 0.3 }
  ],
  invites: [
    // { courseId, email, status: 'pending'|'accepted', sentAt }
  ],
  modules: [
    // { id, courseId, name, position, items: [{ id, type: 'assignment'|'quiz'|'file'|'page', refId, position }] }
  ],
  questionBanks: [
    // { id, courseId, name, questions: [{ id, type, prompt, options, correctAnswer, points }] }
  ],
  settings: {
    geminiKey: '',
    googleClientId: ''
  }
};

// State - Initialize with empty structure (will be populated from Supabase)
let appData = JSON.parse(JSON.stringify(defaultData)); // Deep copy
let activeCourseId = null;
let aiThread = [];
let quizDraftQuestions = [];
let currentEditQuizId = null;
let currentQuizTakingId = null;
let quizTimerInterval = null;
let quizTimeRemaining = null;
let aiDraft = null;
let aiDraftType = 'announcement';
let aiRubricDraft = null;
let aiQuizDraft = null;
let currentSpeedGraderAssignmentId = null;
let currentSpeedGraderStudentIndex = 0;
let speedGraderStudents = [];
let mediaRecorder = null;
let audioChunks = [];
let draggedModuleItem = null;
let studentViewMode = false; // For professor/TA to toggle student view
let aiProcessing = false; // Track AI processing state
let dataLoading = false; // Track data loading state

// ═══════════════════════════════════════════════════════════════════════════════
// DATA PERSISTENCE - SUPABASE
// ═══════════════════════════════════════════════════════════════════════════════

// Load all data from Supabase for the current user
async function loadDataFromSupabase() {
  if (!supabaseClient || !appData.currentUser) {
    console.log('[Supabase] Cannot load data: no client or user');
    return;
  }

  dataLoading = true;
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
      role: 'user' // Role is per-enrollment, not global
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
      rubric: null // Will be populated separately
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
      sentAt: i.created_at // Alias for template compatibility
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

    // Store rubrics separately too for compatibility
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

    // Settings from Gemini key (stored in window config)
    appData.settings = {
      geminiKey: window.GEMINI_API_KEY_API_KEY || ''
    };

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
    showToast('Failed to load data from server', 'error');
  } finally {
    dataLoading = false;
  }
}

// Legacy function - now a no-op for compatibility (Supabase handles persistence)
function loadData() {
  console.log('[Data] loadData called - returning current appData (Supabase mode)');
  return appData;
}

// Save data to Supabase (called after mutations)
// This is a debounced sync - actual saves happen via specific Supabase calls
function saveData(data) {
  console.log('[Data] saveData called - data persisted via Supabase');
  // In Supabase mode, individual operations save directly to the database
  // This function is kept for compatibility but doesn't use localStorage
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Debug helper to verify auth state before operations
async function debugAuthState(operation = 'unknown') {
  if (!supabaseClient) {
    console.warn(`[Auth Debug - ${operation}] Supabase client not initialized`);
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error) {
      console.error(`[Auth Debug - ${operation}] Error getting user:`, error);
      return null;
    }

    if (!user) {
      console.warn(`[Auth Debug - ${operation}] ⚠️ NO USER - auth.uid() will be NULL`);
      console.warn(`[Auth Debug - ${operation}] RLS policies requiring auth.uid() will FAIL`);
      return null;
    }

    // User is authenticated
    console.log(`[Auth Debug - ${operation}] ✓ Authenticated as:`, {
      id: user.id,
      email: user.email,
      role: user.role,
      aud: user.aud
    });

    // Also check the session
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      console.log(`[Auth Debug - ${operation}] ✓ Session valid, expires:`, new Date(session.expires_at * 1000).toISOString());
    } else {
      console.warn(`[Auth Debug - ${operation}] ⚠️ No session found (token may be expired)`);
    }

    return user;
  } catch (err) {
    console.error(`[Auth Debug - ${operation}] Exception:`, err);
    return null;
  }
}

// Course operations
async function supabaseCreateCourse(course) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Creating course:', course.name);

  // Verify auth state before attempting insert
  const authUser = await debugAuthState('createCourse');
  if (!authUser) {
    console.error('[Supabase] Cannot create course: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
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
    showToast('Failed to save course to database', 'error');
    return null;
  }
  console.log('[Supabase] Course created:', data.id);
  return data;
}

async function supabaseUpdateCourse(course) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Updating course:', course.id);

  const { data, error } = await supabaseClient.from('courses').update({
    name: course.name,
    code: course.code,
    description: course.description,
    start_here_title: course.startHereTitle,
    start_here_content: course.startHereContent,
    active: course.active
  }).eq('id', course.id).select().single();

  if (error) {
    console.error('[Supabase] Error updating course:', error);
    showToast('Failed to update course', 'error');
    return null;
  }
  console.log('[Supabase] Course updated');
  return data;
}

// Enrollment operations
async function supabaseCreateEnrollment(enrollment) {
  if (!supabaseClient) return null;
  console.log('[Supabase] Creating enrollment:', enrollment.userId, enrollment.courseId);

  // Verify auth state before attempting insert
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

// Assignment operations
async function supabaseCreateAssignment(assignment) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create assignment: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating assignment:', assignment.title, 'for course:', assignment.courseId);

  // Verify auth state before attempting insert
  const authUser = await debugAuthState('createAssignment');
  if (!authUser) {
    console.error('[Supabase] Cannot create assignment: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting assignments.insert with created_by:', appData.currentUser?.id);
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
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to save assignment: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Assignment created successfully:', data.id);
  return data;
}

async function supabaseUpdateAssignment(assignment) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update assignment: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating assignment:', assignment.id);

  // Verify auth state before attempting update
  const authUser = await debugAuthState('updateAssignment');
  if (!authUser) {
    console.error('[Supabase] Cannot update assignment: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting assignments.update for id:', assignment.id);
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
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to update assignment: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Assignment updated successfully');
  return data;
}

async function supabaseDeleteAssignment(assignmentId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete assignment: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting assignment:', assignmentId);

  // Verify auth state before attempting delete
  const authUser = await debugAuthState('deleteAssignment');
  if (!authUser) {
    console.error('[Supabase] Cannot delete assignment: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  console.log('[Supabase] Attempting assignments.delete for id:', assignmentId);
  const { error } = await supabaseClient.from('assignments').delete().eq('id', assignmentId);

  if (error) {
    console.error('[Supabase] Error deleting assignment:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to delete assignment: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] Assignment deleted successfully');
  return true;
}

// Announcement operations
async function supabaseCreateAnnouncement(announcement) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create announcement: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating announcement:', announcement.title, 'for course:', announcement.courseId);

  // Verify auth state before attempting insert
  const authUser = await debugAuthState('createAnnouncement');
  if (!authUser) {
    console.error('[Supabase] Cannot create announcement: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting announcements.insert with author_id:', announcement.authorId);
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
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to save announcement: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Announcement created successfully:', data.id);
  return data;
}

async function supabaseUpdateAnnouncement(announcement) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update announcement: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating announcement:', announcement.id);

  // Verify auth state before attempting update
  const authUser = await debugAuthState('updateAnnouncement');
  if (!authUser) {
    console.error('[Supabase] Cannot update announcement: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting announcements.update for id:', announcement.id);
  const { data, error } = await supabaseClient.from('announcements').update({
    title: announcement.title,
    content: announcement.content,
    pinned: announcement.pinned,
    hidden: announcement.hidden || false
  }).eq('id', announcement.id).select().single();

  if (error) {
    console.error('[Supabase] Error updating announcement:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to update announcement: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Announcement updated successfully');
  return data;
}

async function supabaseDeleteAnnouncement(announcementId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete announcement: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting announcement:', announcementId);

  // Verify auth state before attempting delete
  const authUser = await debugAuthState('deleteAnnouncement');
  if (!authUser) {
    console.error('[Supabase] Cannot delete announcement: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  console.log('[Supabase] Attempting announcements.delete for id:', announcementId);
  const { error } = await supabaseClient.from('announcements').delete().eq('id', announcementId);

  if (error) {
    console.error('[Supabase] Error deleting announcement:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to delete announcement: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] Announcement deleted successfully');
  return true;
}

// Module operations
async function supabaseCreateModule(module) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create module: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating module:', module.name, 'for course:', module.courseId);

  // Verify auth state before attempting insert
  const authUser = await debugAuthState('createModule');
  if (!authUser) {
    console.error('[Supabase] Cannot create module: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting modules.insert');
  const { data, error } = await supabaseClient.from('modules').insert({
    id: module.id,
    course_id: module.courseId,
    name: module.name,
    position: module.position || 0,
    hidden: module.hidden || false
  }).select().single();

  if (error) {
    console.error('[Supabase] Error creating module:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to save module: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Module created successfully:', data.id);
  return data;
}

async function supabaseUpdateModule(module) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update module: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating module:', module.id);

  // Verify auth state before attempting update
  const authUser = await debugAuthState('updateModule');
  if (!authUser) {
    console.error('[Supabase] Cannot update module: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting modules.update for id:', module.id);
  const { data, error } = await supabaseClient.from('modules').update({
    name: module.name,
    position: module.position,
    hidden: module.hidden || false
  }).eq('id', module.id).select().single();

  if (error) {
    console.error('[Supabase] Error updating module:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to update module: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Module updated successfully');
  return data;
}

async function supabaseDeleteModule(moduleId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete module: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting module:', moduleId);

  // Verify auth state before attempting delete
  const authUser = await debugAuthState('deleteModule');
  if (!authUser) {
    console.error('[Supabase] Cannot delete module: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  console.log('[Supabase] Attempting modules.delete for id:', moduleId);
  const { error } = await supabaseClient.from('modules').delete().eq('id', moduleId);

  if (error) {
    console.error('[Supabase] Error deleting module:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to delete module: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] Module deleted successfully');
  return true;
}

// Module item operations
async function supabaseCreateModuleItem(item, moduleId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create module item: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating module item:', item.type, 'for module:', moduleId);

  // Verify auth state before attempting insert
  const authUser = await debugAuthState('createModuleItem');
  if (!authUser) {
    console.error('[Supabase] Cannot create module item: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting module_items.insert');
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
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to create module item: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Module item created successfully:', data.id);
  return data;
}

async function supabaseDeleteModuleItem(itemId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete module item: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting module item:', itemId);

  // Verify auth state before attempting delete
  const authUser = await debugAuthState('deleteModuleItem');
  if (!authUser) {
    console.error('[Supabase] Cannot delete module item: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  console.log('[Supabase] Attempting module_items.delete for id:', itemId);
  const { error } = await supabaseClient.from('module_items').delete().eq('id', itemId);

  if (error) {
    console.error('[Supabase] Error deleting module item:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to delete module item: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] Module item deleted successfully');
  return true;
}

// Submission operations
async function supabaseCreateSubmission(submission) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create submission: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating submission for assignment:', submission.assignmentId, 'user:', submission.userId);

  // Verify auth state before attempting upsert
  const authUser = await debugAuthState('createSubmission');
  if (!authUser) {
    console.error('[Supabase] Cannot create submission: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting submissions.upsert');
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
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to save submission: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Submission created/updated successfully:', data.id);
  return data;
}

// Grade operations
async function supabaseCreateGrade(grade) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create grade: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating grade for submission:', grade.submissionId);

  // Verify auth state before attempting upsert
  const authUser = await debugAuthState('createGrade');
  if (!authUser) {
    console.error('[Supabase] Cannot create grade: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting grades.upsert with graded_by:', grade.gradedBy || appData.currentUser?.id);
  const { data, error } = await supabaseClient.from('grades').upsert({
    submission_id: grade.submissionId,
    score: grade.score,
    feedback: grade.feedback || null,
    released: grade.released || false,
    graded_by: grade.gradedBy || appData.currentUser?.id
  }, { onConflict: 'submission_id' }).select().single();

  if (error) {
    console.error('[Supabase] Error creating grade:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to save grade: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Grade created/updated successfully');
  return data;
}

// Invite operations
async function supabaseCreateInvite(invite) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create invite: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating invite:', invite.email, 'for course:', invite.courseId);

  // Verify auth state before attempting insert
  const authUser = await debugAuthState('createInvite');
  if (!authUser) {
    console.error('[Supabase] Cannot create invite: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting invites.insert with invited_by:', appData.currentUser?.id);
  const { data, error } = await supabaseClient.from('invites').insert({
    course_id: invite.courseId,
    email: invite.email,
    role: invite.role || 'student',
    status: 'pending',
    invited_by: appData.currentUser?.id
  }).select().single();

  if (error) {
    console.error('[Supabase] Error creating invite:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to create invite: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Invite created successfully:', data.id);
  return data;
}

async function supabaseDeleteInvite(inviteId) {
  if (!supabaseClient) {
    showToast('Database not connected', 'error');
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
      showToast('Failed to revoke invite: ' + error.message, 'error');
      return false;
    }

    console.log('[Supabase] Invite deleted:', inviteId, 'rows affected:', data?.length || 0);
    return true;
  } catch (err) {
    console.error('[Supabase] Exception deleting invite:', err);
    showToast('Failed to revoke invite', 'error');
    return false;
  }
}

// User profile operations
async function supabaseUpdateUserGeminiKey(userId, geminiKey) {
  if (!supabaseClient) return false;
  console.log('[Supabase] Updating Gemini key for user:', userId);

  const { error } = await supabaseClient.from('profiles').update({
    gemini_key: geminiKey,
    updated_at: new Date().toISOString()
  }).eq('id', userId);

  if (error) {
    console.error('[Supabase] Error updating Gemini key:', error);
    showToast('Failed to save Gemini key to profile', 'error');
    return false;
  }
  console.log('[Supabase] Gemini key updated');
  return true;
}

async function supabaseLoadUserGeminiKey(userId) {
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

// Quiz operations
async function supabaseCreateQuiz(quiz) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create quiz: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating quiz:', quiz.title, 'for course:', quiz.courseId);

  // Verify auth state before attempting insert
  const authUser = await debugAuthState('createQuiz');
  if (!authUser) {
    console.error('[Supabase] Cannot create quiz: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting quizzes.insert');
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
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to save quiz: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Quiz created successfully:', quiz.id);
  return data;
}

async function supabaseUpdateQuiz(quiz) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update quiz: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating quiz:', quiz.id);

  // Verify auth state before attempting update
  const authUser = await debugAuthState('updateQuiz');
  if (!authUser) {
    console.error('[Supabase] Cannot update quiz: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting quizzes.update for id:', quiz.id);
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
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to update quiz: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Quiz updated successfully:', quiz.id);
  return data;
}

async function supabaseDeleteQuiz(quizId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete quiz: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting quiz:', quizId);

  // Verify auth state before attempting delete
  const authUser = await debugAuthState('deleteQuiz');
  if (!authUser) {
    console.error('[Supabase] Cannot delete quiz: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  console.log('[Supabase] Attempting quizzes.delete for id:', quizId);
  const { error } = await supabaseClient.from('quizzes').delete().eq('id', quizId);
  if (error) {
    console.error('[Supabase] Error deleting quiz:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to delete quiz: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] Quiz deleted successfully:', quizId);
  return true;
}

// Quiz submission operations
async function supabaseUpsertQuizSubmission(submission) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot save quiz submission: client not initialized');
    return null;
  }
  console.log('[Supabase] Saving quiz submission for quiz:', submission.quizId, 'user:', submission.userId);

  // Verify auth state before attempting upsert
  const authUser = await debugAuthState('upsertQuizSubmission');
  if (!authUser) {
    console.error('[Supabase] Cannot save quiz submission: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting quiz_submissions.upsert');
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
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to save quiz submission: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] Quiz submission saved successfully');
  return data;
}

// File operations
async function supabaseCreateFile(file) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot create file: client not initialized');
    return null;
  }
  console.log('[Supabase] Creating file:', file.name, 'for course:', file.courseId);

  // Verify auth state before attempting insert
  const authUser = await debugAuthState('createFile');
  if (!authUser) {
    console.error('[Supabase] Cannot create file: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting files.insert with uploaded_by:', file.uploadedBy);
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
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to save file: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] File created successfully:', file.id);
  return data;
}

async function supabaseDeleteFile(fileId) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot delete file: client not initialized');
    return false;
  }
  console.log('[Supabase] Deleting file:', fileId);

  // Verify auth state before attempting delete
  const authUser = await debugAuthState('deleteFile');
  if (!authUser) {
    console.error('[Supabase] Cannot delete file: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return false;
  }

  console.log('[Supabase] Attempting files.delete for id:', fileId);
  const { error } = await supabaseClient.from('files').delete().eq('id', fileId);
  if (error) {
    console.error('[Supabase] Error deleting file:', error);
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to delete file: ' + error.message, 'error');
    return false;
  }
  console.log('[Supabase] File deleted successfully:', fileId);
  return true;
}

async function supabaseUpdateFile(file) {
  if (!supabaseClient) {
    console.error('[Supabase] Cannot update file: client not initialized');
    return null;
  }
  console.log('[Supabase] Updating file:', file.id);

  // Verify auth state before attempting update
  const authUser = await debugAuthState('updateFile');
  if (!authUser) {
    console.error('[Supabase] Cannot update file: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return null;
  }

  console.log('[Supabase] Attempting files.update for id:', file.id);
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
    console.error('[Supabase] Error details - code:', error.code, 'message:', error.message, 'hint:', error.hint);
    showToast('Failed to update file: ' + error.message, 'error');
    return null;
  }
  console.log('[Supabase] File updated successfully');
  return data;
}

// Question Bank operations
async function supabaseCreateQuestionBank(bank) {
  if (!supabaseClient) {
    console.log('[Supabase] Storing question bank locally only');
    return bank;
  }
  console.log('[Supabase] Creating question bank:', bank.name);

  const authUser = await debugAuthState('createQuestionBank');
  if (!authUser) {
    console.error('[Supabase] Cannot create question bank: not authenticated');
    return bank; // Return local copy
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
    // Continue with local storage
    return bank;
  }
  console.log('[Supabase] Question bank created successfully');
  return data;
}

async function supabaseUpdateQuestionBank(bank) {
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

async function supabaseDeleteQuestionBank(bankId) {
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
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Content editor toolbar functions for inserting links, files, and videos
let currentInsertTextareaId = null;

function insertAtCursor(textareaId, text) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);

  textarea.value = before + text + after;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
}

function openInsertLinkModal(textareaId) {
  currentInsertTextareaId = textareaId;
  ensureInsertModalsRendered();
  document.getElementById('insertLinkUrl').value = '';
  document.getElementById('insertLinkText').value = '';
  openModal('insertLinkModal');
  document.getElementById('insertLinkUrl').focus();
}

function confirmInsertLink() {
  const url = document.getElementById('insertLinkUrl').value.trim();
  const text = document.getElementById('insertLinkText').value.trim() || 'Link';
  if (!url) {
    showToast('Please enter a URL', 'error');
    return;
  }
  insertAtCursor(currentInsertTextareaId, `[${text}](${url})`);
  closeModal('insertLinkModal');
}

function openInsertVideoModal(textareaId) {
  currentInsertTextareaId = textareaId;
  ensureInsertModalsRendered();
  document.getElementById('insertVideoUrl').value = '';
  document.getElementById('insertVideoPreview').innerHTML = '<div class="muted">Paste a YouTube or Vimeo URL to preview</div>';
  openModal('insertVideoModal');
  document.getElementById('insertVideoUrl').focus();
}

function previewInsertVideo() {
  const url = document.getElementById('insertVideoUrl').value.trim();
  const preview = document.getElementById('insertVideoPreview');

  if (!url) {
    preview.innerHTML = '<div class="muted">Paste a YouTube or Vimeo URL to preview</div>';
    return;
  }

  const videoId = extractYouTubeId(url);
  if (videoId) {
    preview.innerHTML = `
      <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:var(--radius);">
        <iframe src="https://www.youtube.com/embed/${videoId}"
          style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>
      </div>
    `;
  } else if (url.includes('vimeo.com')) {
    const vimeoId = url.split('/').pop().split('?')[0];
    preview.innerHTML = `
      <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:var(--radius);">
        <iframe src="https://player.vimeo.com/video/${vimeoId}"
          style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen></iframe>
      </div>
    `;
  } else {
    preview.innerHTML = '<div class="muted">Could not detect video platform. Supported: YouTube, Vimeo</div>';
  }
}

function extractYouTubeId(url) {
  if (!url) return null;
  if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1].split('?')[0].split('&')[0];
  } else if (url.includes('v=')) {
    return url.split('v=')[1].split('&')[0].split('?')[0];
  } else if (url.includes('embed/')) {
    return url.split('embed/')[1].split('?')[0].split('&')[0];
  }
  return null;
}

function confirmInsertVideo() {
  const url = document.getElementById('insertVideoUrl').value.trim();
  if (!url) {
    showToast('Please enter a video URL', 'error');
    return;
  }

  const videoId = extractYouTubeId(url);
  let embedCode = '';

  if (videoId) {
    // YouTube embed - use iframe syntax that renderMarkdown will handle
    embedCode = `\n\n<div class="video-embed"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>\n\n`;
  } else if (url.includes('vimeo.com')) {
    const vimeoId = url.split('/').pop().split('?')[0];
    embedCode = `\n\n<div class="video-embed"><iframe src="https://player.vimeo.com/video/${vimeoId}" frameborder="0" allowfullscreen></iframe></div>\n\n`;
  } else {
    embedCode = `\n\n[📹 Watch Video](${url})\n\n`;
  }

  insertAtCursor(currentInsertTextareaId, embedCode);
  closeModal('insertVideoModal');
}

function openInsertFileModal(textareaId) {
  currentInsertTextareaId = textareaId;
  ensureInsertModalsRendered();

  // Populate file list from course
  const fileList = document.getElementById('insertFileList');
  const courseFiles = activeCourseId ? appData.files.filter(f => f.courseId === activeCourseId && !f.isPlaceholder) : [];

  if (courseFiles.length === 0) {
    fileList.innerHTML = '<div class="muted" style="padding:12px;">No files in this course yet. Use "External URL" below.</div>';
  } else {
    fileList.innerHTML = courseFiles.map(f => `
      <div class="file-select-item" style="display:flex; align-items:center; gap:8px; padding:8px; border-radius:var(--radius); cursor:pointer; border:1px solid var(--border-light);"
           onclick="selectFileForInsert('${f.id}', '${escapeHtml(f.name)}')"
           onmouseover="this.style.background='var(--primary-light)'"
           onmouseout="this.style.background=''">
        <span>📄</span>
        <span style="flex:1">${escapeHtml(f.name)}</span>
        <span class="muted" style="font-size:0.8rem;">${f.type || 'file'}</span>
      </div>
    `).join('');
  }

  document.getElementById('insertFileExternalUrl').value = '';
  document.getElementById('insertFileExternalName').value = '';
  openModal('insertFileModal');
}

function selectFileForInsert(fileId, fileName) {
  insertAtCursor(currentInsertTextareaId, `[📄 ${fileName}](#file-${fileId})`);
  closeModal('insertFileModal');
  showToast('File link inserted', 'success');
}

function confirmInsertExternalFile() {
  const url = document.getElementById('insertFileExternalUrl').value.trim();
  const name = document.getElementById('insertFileExternalName').value.trim() || 'File';
  if (!url) {
    showToast('Please enter a URL', 'error');
    return;
  }
  insertAtCursor(currentInsertTextareaId, `[📄 ${name}](${url})`);
  closeModal('insertFileModal');
}

// Ensure insert modals are in DOM
function ensureInsertModalsRendered() {
  if (document.getElementById('insertLinkModal')) return;

  const modalsHtml = `
    <!-- Insert Link Modal -->
    <div class="modal-overlay" id="insertLinkModal">
      <div class="modal" style="max-width:450px;">
        <div class="modal-header">
          <h2 class="modal-title">Insert Link</h2>
          <button class="modal-close" onclick="closeModal('insertLinkModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">URL</label>
            <input type="url" class="form-input" id="insertLinkUrl" placeholder="https://example.com">
          </div>
          <div class="form-group">
            <label class="form-label">Link Text</label>
            <input type="text" class="form-input" id="insertLinkText" placeholder="Click here">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('insertLinkModal')">Cancel</button>
          <button class="btn btn-primary" onclick="confirmInsertLink()">Insert</button>
        </div>
      </div>
    </div>

    <!-- Insert Video Modal -->
    <div class="modal-overlay" id="insertVideoModal">
      <div class="modal" style="max-width:550px;">
        <div class="modal-header">
          <h2 class="modal-title">Insert Video</h2>
          <button class="modal-close" onclick="closeModal('insertVideoModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">YouTube or Vimeo URL</label>
            <input type="url" class="form-input" id="insertVideoUrl" placeholder="https://youtube.com/watch?v=..." oninput="previewInsertVideo()">
          </div>
          <div class="form-group">
            <label class="form-label">Preview</label>
            <div id="insertVideoPreview" style="background:var(--bg-color); border-radius:var(--radius); min-height:100px; display:flex; align-items:center; justify-content:center;">
              <div class="muted">Paste a YouTube or Vimeo URL to preview</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('insertVideoModal')">Cancel</button>
          <button class="btn btn-primary" onclick="confirmInsertVideo()">Insert Video</button>
        </div>
      </div>
    </div>

    <!-- Insert File Modal -->
    <div class="modal-overlay" id="insertFileModal">
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <h2 class="modal-title">Insert File Link</h2>
          <button class="modal-close" onclick="closeModal('insertFileModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Course Files</label>
            <div id="insertFileList" style="max-height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div>
          </div>
          <hr style="margin:16px 0; border:none; border-top:1px solid var(--border-light);">
          <div class="form-group">
            <label class="form-label">Or Link External URL</label>
            <input type="url" class="form-input" id="insertFileExternalUrl" placeholder="https://example.com/document.pdf" style="margin-bottom:8px;">
            <input type="text" class="form-input" id="insertFileExternalName" placeholder="File name (optional)">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('insertFileModal')">Cancel</button>
          <button class="btn btn-primary" onclick="confirmInsertExternalFile()">Insert External Link</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalsHtml);
}

// Legacy functions for compatibility - redirect to modals
function insertLink(textareaId) {
  openInsertLinkModal(textareaId);
}

function insertVideo(textareaId) {
  openInsertVideoModal(textareaId);
}

function insertFileLink(textareaId) {
  openInsertFileModal(textareaId);
}

function renderEditorToolbar(textareaId) {
  return `
    <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('${textareaId}')" title="Insert Link">🔗 Link</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('${textareaId}')" title="Insert File">📄 File</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('${textareaId}')" title="Insert Video">📹 Video</button>
    </div>
  `;
}

function formatInlineMarkdown(text) {
  let output = escapeHtml(text);
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return output;
}

function renderMarkdown(text) {
  if (!text) return '';

  // Preserve video embeds and other safe HTML blocks
  const preservedBlocks = [];
  let working = text;

  // Preserve video embeds (YouTube/Vimeo iframes)
  working = working.replace(/<div class="video-embed">[\s\S]*?<\/div>/g, (match) => {
    const index = preservedBlocks.length;
    preservedBlocks.push(match);
    return `@@PRESERVED${index}@@`;
  });

  // Also handle raw YouTube/Vimeo URLs and convert to embeds
  working = working.replace(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?/g, (match, videoId) => {
    const index = preservedBlocks.length;
    preservedBlocks.push(`<div class="video-embed"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`);
    return `@@PRESERVED${index}@@`;
  });

  working = working.replace(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/g, (match, videoId) => {
    const index = preservedBlocks.length;
    preservedBlocks.push(`<div class="video-embed"><iframe src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`);
    return `@@PRESERVED${index}@@`;
  });

  // Preserve code blocks
  const codeBlocks = [];
  working = working.replace(/```([\s\S]*?)```/g, (match, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(code);
    return `@@CODEBLOCK${index}@@`;
  });

  const lines = working.split('\n');
  let html = '';
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  lines.forEach(line => {
    if (/^###\s+/.test(line)) {
      closeList();
      html += `<h4>${formatInlineMarkdown(line.replace(/^###\s+/, ''))}</h4>`;
      return;
    }
    if (/^##\s+/.test(line)) {
      closeList();
      html += `<h3>${formatInlineMarkdown(line.replace(/^##\s+/, ''))}</h3>`;
      return;
    }
    if (/^#\s+/.test(line)) {
      closeList();
      html += `<h2>${formatInlineMarkdown(line.replace(/^#\s+/, ''))}</h2>`;
      return;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${formatInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`;
      return;
    }
    if (line.trim() === '') {
      closeList();
      return;
    }
    closeList();
    html += `<p>${formatInlineMarkdown(line)}</p>`;
  });

  closeList();

  // Restore code blocks
  codeBlocks.forEach((code, index) => {
    const safeCode = escapeHtml(code);
    html = html.replace(`@@CODEBLOCK${index}@@`, `<pre><code>${safeCode}</code></pre>`);
  });

  // Restore preserved blocks (video embeds, etc.)
  preservedBlocks.forEach((block, index) => {
    html = html.replace(`<p>@@PRESERVED${index}@@</p>`, block);
    html = html.replace(`@@PRESERVED${index}@@`, block);
  });

  return html;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid date';

  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / 86400000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 0 && days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Format due dates for assignments/quizzes - handles future dates properly
function formatDueDate(dateString) {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid date';

  const now = new Date();
  // Reset both to start of day for accurate day calculation
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = dueDay - nowDay;
  const days = Math.round(diffMs / 86400000);

  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return 'Due yesterday';
  if (days > 1 && days <= 14) return `Due in ${days} days`;
  if (days < -1 && days >= -14) return `Due ${Math.abs(days)} days ago`;
  return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Helper functions for 12-hour time selector
function getDateTimeFromSelectors(dateId, hourId, minuteId, ampmId) {
  const dateVal = document.getElementById(dateId).value;
  if (!dateVal) return null;

  let hour = parseInt(document.getElementById(hourId).value, 10);
  const minute = document.getElementById(minuteId).value;
  const ampm = document.getElementById(ampmId).value;

  // Convert to 24-hour format
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const date = new Date(dateVal + 'T' + hour.toString().padStart(2, '0') + ':' + minute + ':00');
  return date.toISOString();
}

function setDateTimeSelectors(dateId, hourId, minuteId, ampmId, isoDateString) {
  if (!isoDateString) {
    document.getElementById(dateId).value = '';
    document.getElementById(hourId).value = '11';
    document.getElementById(minuteId).value = '59';
    document.getElementById(ampmId).value = 'PM';
    return;
  }

  const date = new Date(isoDateString);
  const dateStr = date.toISOString().slice(0, 10);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  // Convert to 12-hour format
  hours = hours % 12;
  if (hours === 0) hours = 12;

  // Round minutes to nearest 15-min interval
  const roundedMinutes = Math.round(minutes / 15) * 15;
  const minuteStr = (roundedMinutes === 60 ? 0 : roundedMinutes).toString().padStart(2, '0');

  document.getElementById(dateId).value = dateStr;
  document.getElementById(hourId).value = hours.toString();
  document.getElementById(minuteId).value = minuteStr;
  document.getElementById(ampmId).value = ampm;
}

// Format date/time for AI preview display
function formatTimeForDisplay(isoDateString) {
  if (!isoDateString) return 'Not set';
  const date = new Date(isoDateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getCurrentUser() {
  return appData.currentUser;
}

function getUserById(id) {
  return appData.users.find(u => u.id === id);
}

function getCourseById(id) {
  return appData.courses.find(c => c.id === id);
}

function getUserRole(userId, courseId) {
  const enrollment = appData.enrollments.find(e => e.userId === userId && e.courseId === courseId);
  return enrollment ? enrollment.role : null;
}

function isStaff(userId, courseId) {
  const role = getUserRole(userId, courseId);
  return role === 'instructor' || role === 'ta';
}

function getUserCourses(userId) {
  return appData.enrollments
    .filter(e => e.userId === userId)
    .map(e => ({ ...getCourseById(e.courseId), role: e.role }))
    .filter(c => c.id);
}

function generateId() {
  // Generate a proper UUID v4 for Supabase compatibility
  return crypto.randomUUID();
}

function getQuizPoints(quiz) {
  if (!quiz || !quiz.questions) return 0;
  const total = quiz.questions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
  if (quiz.questionPoolEnabled && quiz.questionSelectCount && quiz.questions.length > 0) {
    const avg = total / quiz.questions.length;
    return Math.round(avg * quiz.questionSelectCount * 10) / 10;
  }
  return total;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

// Sign in with Google via Supabase Auth
async function signInWithGoogle() {
  if (!supabaseClient) {
    console.error('[Auth] Supabase not initialized');
    showLoginError('Supabase not configured. Please check config.js');
    return;
  }

  console.log('[Auth] Starting Google OAuth sign-in...');
  showLoginLoading(true);

  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.SITE_URL || window.location.origin
      }
    });

    if (error) {
      console.error('[Auth] OAuth error:', error);
      showLoginError(error.message);
      showLoginLoading(false);
      return;
    }

    console.log('[Auth] OAuth initiated, redirecting to Google...');
    // The page will redirect to Google, then back to our app
  } catch (err) {
    console.error('[Auth] Sign-in error:', err);
    showLoginError('Failed to sign in. Please try again.');
    showLoginLoading(false);
  }
}

// Handle auth state changes (called on page load and after OAuth redirect)
async function handleAuthStateChange(event, session) {
  console.log('[Auth] Auth state changed:', event, session?.user?.email);

  if (event === 'SIGNED_IN' && session?.user) {
    await handleSignedIn(session.user);
  } else if (event === 'SIGNED_OUT') {
    handleSignedOut();
  } else if (event === 'INITIAL_SESSION' && session?.user) {
    // User was already signed in (page refresh)
    await handleSignedIn(session.user);
  }
}

// Handle successful sign-in
async function handleSignedIn(user) {
  console.log('[Auth] User signed in:', user.email);

  // Map Supabase user to app user format
  appData.currentUser = {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.email.split('@')[0],
    avatar: getInitials(user.user_metadata?.full_name || user.email)
  };

  console.log('[Auth] Current user set:', appData.currentUser);

  // Load data from Supabase
  await loadDataFromSupabase();

  // Load user's Gemini key from Supabase profile
  const userGeminiKey = await supabaseLoadUserGeminiKey(user.id);
  if (userGeminiKey) {
    console.log('[Auth] Loaded Gemini key from user profile');
    appData.settings.geminiKey = userGeminiKey;
    // Set on window for immediate use (takes priority over config.js)
    window.GEMINI_API_KEY = userGeminiKey;
  }

  // Initialize the app UI
  initApp();
}

// Handle sign-out
function handleSignedOut() {
  console.log('[Auth] User signed out');
  appData.currentUser = null;
  appData = JSON.parse(JSON.stringify(defaultData)); // Reset data
  activeCourseId = null;
  showLoginScreen();
}

// Sign out
async function logout() {
  console.log('[Auth] Logging out...');

  if (supabaseClient) {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('[Auth] Logout error:', error);
    }
  }

  appData.currentUser = null;
  activeCourseId = null;
  showLoginScreen();
}

// Show login screen
function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appContainer').setAttribute('aria-hidden', 'true');
  showLoginLoading(false);
  hideLoginError();
}

// Show/hide login loading state
function showLoginLoading(show) {
  const loadingEl = document.getElementById('loginLoading');
  const btnEl = document.getElementById('googleSignInBtn');
  if (loadingEl) loadingEl.style.display = show ? 'block' : 'none';
  if (btnEl) btnEl.disabled = show;
}

// Show login error
function showLoginError(message) {
  const errorEl = document.getElementById('loginError');
  if (errorEl) {
    errorEl.style.display = 'block';
    errorEl.textContent = message;
  }
}

// Hide login error
function hideLoginError() {
  const errorEl = document.getElementById('loginError');
  if (errorEl) errorEl.style.display = 'none';
}

// Check for existing session on page load
async function checkExistingSession() {
  if (!supabaseClient) {
    console.log('[Auth] No Supabase client, showing login');
    showLoginScreen();
    return;
  }

  console.log('[Auth] Checking for existing session...');

  const { data: { session }, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error('[Auth] Error getting session:', error);
    showLoginScreen();
    return;
  }

  if (session?.user) {
    console.log('[Auth] Found existing session for:', session.user.email);
    await handleSignedIn(session.user);
  } else {
    console.log('[Auth] No existing session');
    showLoginScreen();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function initApp() {
  if (!appData.currentUser) {
    console.log('[App] No current user, showing login screen');
    showLoginScreen();
    return;
  }

  console.log('[App] Initializing app for user:', appData.currentUser.email);

  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appContainer').setAttribute('aria-hidden', 'false');

  // Set user info in top bar
  setText('userAvatarTop', appData.currentUser.avatar);
  setText('userNameTop', appData.currentUser.name);
  setText('userEmailTop', appData.currentUser.email);

  // Load user's courses
  const courses = getUserCourses(appData.currentUser.id);
  console.log('[App] User courses:', courses.length);

  if (courses.length > 0 && !activeCourseId) {
    activeCourseId = courses[0].id;
  }

  populateCourseSelector();
  renderAll();
  navigateTo('courses');

  console.log('[App] App initialized successfully');
}

function populateCourseSelector() {
  const courses = getUserCourses(appData.currentUser.id);
  const select = document.getElementById('courseSelect');

  if (!select) {
    return;
  }
  
  if (courses.length === 0) {
    select.innerHTML = '<option value="">No courses</option>';
    return;
  }
  
  select.innerHTML = courses.map(c => 
    `<option value="${c.id}" ${c.id === activeCourseId ? 'selected' : ''}>${c.name} (${c.role})</option>`
  ).join('');
}

function switchCourse(courseId) {
  activeCourseId = courseId;
  populateCourseSelector();
  renderAll();
  navigateTo('home');
}

function renderAll() {
  populateCourseSelector(); // Update dropdown
  renderTopBarCourse();
  renderTopBarActions();
  renderTopBarViewToggle();
  renderCourses();
  renderHome();
  renderUpdates();
  renderAssignments();
  renderCalendar();
  renderModules();
  renderFiles();
  renderGradebook();
  renderPeople();
}

function renderTopBarActions() {
  // Show/hide import button in sidebar based on user role
  const importToolBtn = document.getElementById('importToolBtn');
  if (importToolBtn) {
    const isStaffUser = activeCourseId && isStaff(appData.currentUser?.id, activeCourseId);
    importToolBtn.style.display = isStaffUser && !studentViewMode ? 'inline-flex' : 'none';
  }

  // Hide People, Files, Settings buttons in student view mode OR for actual students
  const peopleBtn = document.querySelector('[data-page="people"]');
  const filesBtn = document.querySelector('[data-page="files"]');
  const settingsBtn = document.querySelector('[onclick="openModal(\'settingsModal\')"]');

  const isStaffUser = activeCourseId && isStaff(appData.currentUser?.id, activeCourseId);
  const shouldHide = studentViewMode || (activeCourseId && !isStaffUser);

  if (shouldHide) {
    if (peopleBtn) peopleBtn.style.display = 'none';
    if (filesBtn) filesBtn.style.display = 'none';
    if (settingsBtn) settingsBtn.style.display = 'none';
  } else {
    if (peopleBtn) peopleBtn.style.display = 'inline-flex';
    if (filesBtn) filesBtn.style.display = 'inline-flex';
    if (settingsBtn) settingsBtn.style.display = 'inline-flex';
  }
}

function renderTopBarCourse() {
  const titleEl = document.getElementById('activeCourseTitle');
  const subtitleEl = document.getElementById('activeCourseSubtitle');
  if (!titleEl || !subtitleEl) return;

  if (!activeCourseId) {
    titleEl.textContent = 'Select a course';
    subtitleEl.textContent = 'Choose a course from the Courses tab';
    studentViewMode = false; // Reset view mode when no course selected
    renderTopBarViewToggle();
    return;
  }

  const course = getCourseById(activeCourseId);
  if (course) {
    titleEl.textContent = course.name;
    // Show "You are a student" when in student view mode, otherwise show actual role
    let roleDisplay;
    if (studentViewMode) {
      roleDisplay = 'You are a student';
    } else {
      const role = getUserRole(appData.currentUser?.id, activeCourseId);
      const roleLabels = {
        'instructor': 'You are the instructor',
        'ta': 'You are a TA',
        'student': 'You are a student'
      };
      roleDisplay = roleLabels[role] || role;
    }
    subtitleEl.textContent = `${course.code} · ${roleDisplay}`;
  } else {
    titleEl.textContent = 'Select a course';
    subtitleEl.textContent = 'Choose a course from the Courses tab';
  }

  // Update view toggle button
  renderTopBarViewToggle();
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function navigateTo(page) {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  // Clear AI thread when leaving AI page
  if (page !== 'ai' && aiThread.length > 0) {
    aiThread = [];
    renderAiThread();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COURSES PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderCourses() {
  const allCourses = getUserCourses(appData.currentUser.id);
  // Filter out inactive courses
  const courses = allCourses.filter(c => c.active !== false);
  
  const actionsHTML = `
    <button class="btn btn-primary" onclick="openModal('createCourseModal')">Create Course</button>
    <button class="btn btn-secondary" onclick="openModal('joinCourseModal')">Join Course</button>
  `;
  setHTML('coursesActions', actionsHTML);
  
  if (courses.length === 0) {
    setHTML('coursesList', '<div class="empty-state"><div class="empty-state-title">No courses yet</div><div class="empty-state-text">Create a course or join one with an invite code</div></div>');
    return;
  }
  
  const html = courses.map(c => {
    // Format role label
    const roleLabels = {
      'instructor': 'You are the instructor',
      'ta': 'You are a TA',
      'student': 'You are a student'
    };
    const roleLabel = roleLabels[c.role] || c.role;

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${c.name}</div>
            <div class="muted">${c.code} · ${roleLabel}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="switchCourse('${c.id}')">Open</button>
            ${c.role === 'instructor' ? `
              <button class="btn btn-secondary btn-sm" onclick="openEditCourseModal('${c.id}')">Edit</button>
            ` : ''}
          </div>
        </div>
        ${c.description ? `<div style="margin-top:8px;" class="muted">${c.description}</div>` : ''}
      </div>
    `;
  }).join('');
  
  setHTML('coursesList', html);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAG AND DROP HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

function handleDragOver(e, dropZoneId) {
  e.preventDefault();
  e.stopPropagation();
  const dropZone = document.getElementById(dropZoneId);
  if (dropZone) {
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'var(--primary-light)';
  }
}

function handleDragLeave(e, dropZoneId) {
  e.preventDefault();
  e.stopPropagation();
  const dropZone = document.getElementById(dropZoneId);
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = '';
  }
}

function handleSyllabusDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropZone = document.getElementById('syllabusDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = '';
  }

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    const validTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(ext)) {
      showToast('Please upload a PDF, DOC, or TXT file', 'error');
      return;
    }
    // Transfer dropped file to the hidden input
    const input = document.getElementById('courseCreationSyllabus');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    onSyllabusFileSelected();
  }
}

function onSyllabusFileSelected() {
  const input = document.getElementById('courseCreationSyllabus');
  if (input.files.length > 0) {
    const file = input.files[0];
    const dropZone = document.getElementById('syllabusDropZone');
    if (dropZone) {
      dropZone.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:12px;">
          <span style="font-size:1.5rem;">📄</span>
          <div style="text-align:left;">
            <div style="font-weight:500;">${escapeHtml(file.name)}</div>
            <div class="muted" style="font-size:0.8rem;">${(file.size / 1024).toFixed(1)} KB</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); parseCourseSyllabus();">Parse</button>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); clearSyllabusUpload();">✕</button>
        </div>
      `;
    }
  }
}

function clearSyllabusUpload() {
  const input = document.getElementById('courseCreationSyllabus');
  if (input) input.value = '';
  const dropZone = document.getElementById('syllabusDropZone');
  if (dropZone) {
    dropZone.innerHTML = `
      <div style="margin-bottom:8px;">📄</div>
      <div style="font-weight:500;">Drag & drop syllabus here</div>
      <div class="muted" style="font-size:0.85rem;">or click to browse (PDF, DOC, TXT)</div>
      <input type="file" id="courseCreationSyllabus" accept=".pdf,.doc,.docx,.txt" style="display:none;" onchange="onSyllabusFileSelected()">
    `;
  }
  const status = document.getElementById('courseCreationSyllabusStatus');
  if (status) status.innerHTML = '';
  courseCreationSyllabusData = null;
}

// Handlers for the syllabus parser modal drop zone
function handleSyllabusParserDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropZone = document.getElementById('syllabusParserDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = '';
  }

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    const validTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(ext)) {
      showToast('Please upload a PDF, DOC, or TXT file', 'error');
      return;
    }
    const input = document.getElementById('syllabusFile');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    onSyllabusParserFileSelected();
  }
}

function onSyllabusParserFileSelected() {
  const input = document.getElementById('syllabusFile');
  if (input.files.length > 0) {
    const file = input.files[0];
    const dropZone = document.getElementById('syllabusParserDropZone');
    if (dropZone) {
      dropZone.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:12px;">
          <span style="font-size:1.5rem;">📄</span>
          <div style="text-align:left;">
            <div style="font-weight:500;">${escapeHtml(file.name)}</div>
            <div class="muted" style="font-size:0.8rem;">${(file.size / 1024).toFixed(1)} KB</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); clearSyllabusParserUpload();">✕</button>
        </div>
      `;
    }
  }
}

function clearSyllabusParserUpload() {
  const input = document.getElementById('syllabusFile');
  if (input) input.value = '';
  const dropZone = document.getElementById('syllabusParserDropZone');
  if (dropZone) {
    dropZone.innerHTML = `
      <div style="margin-bottom:8px;">📄</div>
      <div style="font-weight:500;">Drag & drop syllabus here</div>
      <div class="muted" style="font-size:0.85rem;">or click to browse (PDF, DOC, TXT)</div>
      <input type="file" id="syllabusFile" accept=".pdf,.doc,.docx,.txt" style="display:none;" onchange="onSyllabusParserFileSelected()">
    `;
  }
}

// Store parsed syllabus data for course creation
let courseCreationSyllabusData = null;

async function parseCourseSyllabus() {
  const apiKey = window.GEMINI_API_KEY || appData.settings.geminiKey;
  if (!apiKey) {
    showToast('Gemini API key not configured. Add GEMINI_API_KEY to config.js or configure in Settings.', 'error');
    return;
  }

  const fileInput = document.getElementById('courseCreationSyllabus');
  if (!fileInput.files.length) {
    showToast('Please select a syllabus file', 'error');
    return;
  }

  const statusEl = document.getElementById('courseCreationSyllabusStatus');
  statusEl.innerHTML = '<div class="ai-spinner" style="display:inline-block; width:16px; height:16px; margin-right:8px;"></div> Parsing syllabus...';

  const file = fileInput.files[0];
  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || 'application/octet-stream';

    const systemPrompt = `You are analyzing a course syllabus. Extract course information and all assignments, modules/units, readings. Return ONLY valid JSON:
{
  "courseInfo": {
    "name": "Course name",
    "code": "Course code (e.g., ECON 101)",
    "instructor": "Instructor name if found",
    "description": "Course description if found"
  },
  "modules": [
    {
      "name": "Module/Week/Unit name",
      "items": [
        { "type": "assignment" | "quiz" | "reading", "title": "Item title", "description": "Brief description", "dueDate": "ISO date or null", "points": 100 }
      ]
    }
  ]
}
Extract EACH reading/chapter as a SEPARATE item. For exams/quizzes use type "quiz". For homework/essays use "assignment".`;

    const requestBody = {
      contents: [{
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: systemPrompt }
        ]
      }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
    };

    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) },
      3
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.candidates[0].content.parts[0].text;
    const parsed = parseAiJsonResponse(text);
    courseCreationSyllabusData = parsed;

    // Auto-fill course info
    if (parsed.courseInfo) {
      if (parsed.courseInfo.name && !document.getElementById('courseName').value) {
        document.getElementById('courseName').value = parsed.courseInfo.name;
      }
      if (parsed.courseInfo.code && !document.getElementById('courseCode').value) {
        document.getElementById('courseCode').value = parsed.courseInfo.code;
      }
      if (parsed.courseInfo.description && !document.getElementById('courseDescription').value) {
        document.getElementById('courseDescription').value = parsed.courseInfo.description;
      }
    }

    // Show modules preview
    if (parsed.modules && parsed.modules.length > 0) {
      let totalItems = 0;
      parsed.modules.forEach(m => totalItems += (m.items || []).length);

      const previewEl = document.getElementById('courseCreationModulesPreview');
      const listEl = document.getElementById('courseCreationModulesList');
      previewEl.style.display = 'block';

      listEl.innerHTML = parsed.modules.map((mod, idx) => `
        <label style="display:flex; align-items:center; gap:8px; padding:4px 0;">
          <input type="checkbox" checked class="course-creation-module-check" data-index="${idx}">
          <span>${escapeHtml(mod.name)} <span class="muted">(${(mod.items || []).length} items)</span></span>
        </label>
      `).join('');

      statusEl.innerHTML = `<span style="color:var(--success);">✓ Found ${parsed.modules.length} modules, ${totalItems} items</span>`;
    } else {
      statusEl.innerHTML = '<span style="color:var(--warning);">No modules found in syllabus</span>';
    }

  } catch (err) {
    console.error('Syllabus parsing error:', err);
    statusEl.innerHTML = `<span style="color:var(--error);">Error: ${err.message}</span>`;
    courseCreationSyllabusData = null;
  }
}

async function createCourse() {
  const name = document.getElementById('courseName').value.trim();
  const code = document.getElementById('courseCode').value.trim();
  const description = document.getElementById('courseDescription')?.value.trim() || '';
  const emailsText = document.getElementById('courseEmails').value.trim();

  if (!name || !code) {
    showToast('Please fill in course name and code', 'error');
    return;
  }

  const courseId = generateId();
  const inviteCode = generateInviteCode();

  // Check if we have parsed syllabus data and should create modules
  const hasSyllabusData = courseCreationSyllabusData && courseCreationSyllabusData.modules;
  const checkedModules = document.querySelectorAll('.course-creation-module-check:checked');
  const selectedModuleIndices = new Set(Array.from(checkedModules).map(el => parseInt(el.dataset.index)));

  // Set up Start Here content - with syllabus reference if created via syllabus upload
  let startHereContent = `Welcome to ${name}.`;
  let startHereLinks = [];

  // If syllabus was uploaded, save it as a file and add to pinned essentials
  const syllabusInput = document.getElementById('courseCreationSyllabus');
  let syllabusFileId = null;
  if (syllabusInput && syllabusInput.files.length > 0) {
    const syllabusFile = syllabusInput.files[0];
    syllabusFileId = generateId();
    const syllabusFileData = {
      id: syllabusFileId,
      courseId: courseId,
      name: syllabusFile.name,
      type: syllabusFile.name.split('.').pop(),
      size: syllabusFile.size,
      storagePath: `courses/${courseId}/${syllabusFileId}_${syllabusFile.name}`,
      uploadedBy: appData.currentUser.id,
      uploadedAt: new Date().toISOString()
    };

    // Try to upload to Supabase Storage
    if (supabaseClient) {
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('course-files')
        .upload(syllabusFileData.storagePath, syllabusFile, { cacheControl: '3600', upsert: false });

      if (uploadData) {
        syllabusFileData.storagePath = uploadData.path;
      }
    }

    // Save file metadata
    await supabaseCreateFile(syllabusFileData);
    appData.files.push(syllabusFileData);

    // Add syllabus to pinned essentials
    startHereLinks.push({ label: 'Syllabus', fileId: syllabusFileId });
  }

  if (hasSyllabusData && selectedModuleIndices.size > 0) {
    startHereContent = `Welcome to ${name}.\n\nThis course was set up from the uploaded syllabus. Review the modules below for course content.`;
  }

  const course = {
    id: courseId,
    name: name,
    code: code,
    description: description,
    inviteCode: inviteCode,
    createdBy: appData.currentUser.id,
    startHereContent: startHereContent,
    startHereLinks: startHereLinks
  };

  // Save to Supabase
  await supabaseCreateCourse(course);

  // Update local state
  appData.courses.push(course);

  const enrollment = {
    userId: appData.currentUser.id,
    courseId: courseId,
    role: 'instructor'
  };

  // Save enrollment to Supabase
  await supabaseCreateEnrollment(enrollment);

  // Update local state
  appData.enrollments.push(enrollment);

  // Initialize invites array if it doesn't exist
  if (!appData.invites) appData.invites = [];

  // Process email invites (supports comma, semicolon, or newline delimiters)
  if (emailsText) {
    const emails = emailsText.split(/[\n,;]+/).map(e => e.trim()).filter(e => e && e.includes('@'));

    for (const email of emails) {
      // Check if user exists
      let user = appData.users.find(u => u.email === email);

      if (user) {
        // User exists - auto-enroll if not already enrolled
        const existing = appData.enrollments.find(e => e.userId === user.id && e.courseId === courseId);
        if (!existing) {
          const studentEnrollment = {
            userId: user.id,
            courseId: courseId,
            role: 'student'
          };
          await supabaseCreateEnrollment(studentEnrollment);
          appData.enrollments.push(studentEnrollment);
        }
      } else {
        // User doesn't exist - create invite (default to student role)
        const invite = {
          courseId: courseId,
          email: email,
          role: 'student',
          status: 'pending',
          sentAt: new Date().toISOString()
        };
        await supabaseCreateInvite(invite);
        appData.invites.push(invite);
      }
    }
  }

  // Import modules from parsed syllabus if available
  let modulesImported = 0;
  let itemsImported = 0;

  if (hasSyllabusData && selectedModuleIndices.size > 0) {
    if (!appData.modules) appData.modules = [];

    for (const [modIndex, mod] of courseCreationSyllabusData.modules.entries()) {
      if (!selectedModuleIndices.has(modIndex)) continue;

      const courseModules = appData.modules.filter(m => m.courseId === courseId);
      const maxPosition = courseModules.length > 0 ? Math.max(...courseModules.map(m => m.position)) + 1 : 0;

      const newModule = {
        id: generateId(),
        courseId: courseId,
        name: mod.name,
        position: maxPosition + modulesImported,
        items: []
      };

      // Create items for this module
      for (const item of (mod.items || [])) {
        let refId = null;

        if (item.type === 'quiz') {
          const newQuiz = {
            id: generateId(),
            courseId: courseId,
            title: item.title,
            description: item.description || 'Placeholder - add questions',
            status: 'draft',
            dueDate: item.dueDate || new Date(Date.now() + 86400000 * 14).toISOString(),
            createdAt: new Date().toISOString(),
            timeLimit: 30,
            attempts: 1,
            questions: [],
            isPlaceholder: true
          };
          appData.quizzes.push(newQuiz);
          refId = newQuiz.id;
        } else if (item.type === 'reading') {
          const newFile = {
            id: generateId(),
            courseId: courseId,
            name: item.title,
            type: 'placeholder',
            size: 0,
            visible: false,
            isPlaceholder: true,
            description: item.description || '',
            uploadedBy: appData.currentUser.id,
            uploadedAt: new Date().toISOString()
          };
          appData.files.push(newFile);
          refId = newFile.id;
        } else {
          const newAssignment = {
            id: generateId(),
            courseId: courseId,
            title: item.title,
            description: item.description || 'Placeholder - add instructions',
            category: 'homework',
            points: item.points || 100,
            status: 'draft',
            dueDate: item.dueDate || new Date(Date.now() + 86400000 * 14).toISOString(),
            createdAt: new Date().toISOString(),
            isPlaceholder: true
          };
          appData.assignments.push(newAssignment);
          refId = newAssignment.id;
        }

        if (refId) {
          newModule.items.push({
            id: generateId(),
            type: item.type === 'reading' ? 'file' : item.type,
            refId: refId,
            position: newModule.items.length
          });
          itemsImported++;
        }
      }

      await supabaseCreateModule(newModule);
      appData.modules.push(newModule);
      modulesImported++;
    }
  }

  saveData(appData);
  activeCourseId = courseId;

  closeModal('createCourseModal');
  renderAll();
  navigateTo('home');

  let toastMsg = `Course created! Invite code: ${inviteCode}`;
  if (modulesImported > 0) {
    toastMsg += ` (${modulesImported} modules, ${itemsImported} items imported)`;
  }
  showToast(toastMsg, 'success');

  // Clear form and syllabus data
  document.getElementById('courseName').value = '';
  document.getElementById('courseCode').value = '';
  document.getElementById('courseEmails').value = '';
  if (document.getElementById('courseDescription')) {
    document.getElementById('courseDescription').value = '';
  }
  if (document.getElementById('courseCreationSyllabus')) {
    document.getElementById('courseCreationSyllabus').value = '';
  }
  if (document.getElementById('courseCreationSyllabusStatus')) {
    document.getElementById('courseCreationSyllabusStatus').innerHTML = '';
  }
  if (document.getElementById('courseCreationModulesPreview')) {
    document.getElementById('courseCreationModulesPreview').style.display = 'none';
  }
  courseCreationSyllabusData = null;
}

function joinCourse() {
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  
  if (!code) {
    showToast('Please enter an invite code', 'error');
    return;
  }
  
  const course = appData.courses.find(c => c.inviteCode === code);
  
  if (!course) {
    showToast('Invalid invite code', 'error');
    return;
  }
  
  const existing = appData.enrollments.find(e => 
    e.userId === appData.currentUser.id && e.courseId === course.id
  );
  
  if (existing) {
    showToast('You are already enrolled in this course', 'error');
    return;
  }
  
  appData.enrollments.push({
    userId: appData.currentUser.id,
    courseId: course.id,
    role: 'student'
  });
  
  saveData(appData);
  activeCourseId = course.id;
  
  closeModal('joinCourseModal');
  renderAll();
  navigateTo('home');
  showToast('Successfully joined course!', 'success');
}

function generateInviteCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderHome() {
  if (!activeCourseId) {
    setText('homeTitle', 'Home');
    setText('homeSubtitle', 'Select a course to get started');
    setHTML('homeUpcoming', '<div class="empty-state-text">No active course</div>');
    setHTML('homeUpdates', '<div class="empty-state-text">No active course</div>');
    setHTML('homeStartHere', '');
    return;
  }
  
  const course = getCourseById(activeCourseId);
  setText('homeTitle', 'Home');
  setText('homeSubtitle', ''); // Course name is already in the top bar

  renderStartHere(course);
  
  // Upcoming assignments + quizzes
  const upcomingAssignments = appData.assignments
    .filter(a => a.courseId === activeCourseId && a.status === 'published')
    .filter(a => new Date(a.dueDate) > new Date())
    .map(a => ({ type: 'Assignment', title: a.title, dueDate: a.dueDate }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  
  const upcomingQuizzes = appData.quizzes
    .filter(q => q.courseId === activeCourseId && q.status === 'published')
    .filter(q => new Date(q.dueDate) > new Date())
    .map(q => ({ type: 'Quiz', title: q.title, dueDate: q.dueDate }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  
  const upcoming = [...upcomingAssignments, ...upcomingQuizzes]
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);
  
  // Get parent card elements for visibility control
  const upcomingContainer = document.getElementById('homeUpcoming');
  const updatesContainer = document.getElementById('homeUpdates');
  const upcomingCard = upcomingContainer?.closest('.card');
  const updatesCard = updatesContainer?.closest('.card');

  if (upcoming.length === 0) {
    // Hide the entire Upcoming card when empty
    if (upcomingCard) upcomingCard.style.display = 'none';
  } else {
    if (upcomingCard) upcomingCard.style.display = '';
    const html = upcoming.map(item => `
      <div style="padding:12px; border-bottom:1px solid var(--border-light);">
        <div style="font-weight:500;">${item.title}</div>
        <div class="muted" style="font-size:0.85rem;">${item.type} · ${formatDueDate(item.dueDate)}</div>
      </div>
    `).join('');
    setHTML('homeUpcoming', html);
  }

  // Recent announcements (clickable)
  const updates = appData.announcements
    .filter(a => a.courseId === activeCourseId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (updates.length === 0) {
    // Hide the entire Recent Announcements card when empty
    if (updatesCard) updatesCard.style.display = 'none';
  } else {
    if (updatesCard) updatesCard.style.display = '';
    const html = updates.map(u => {
      const author = getUserById(u.authorId);
      return `
        <button class="update-item" onclick="viewAnnouncement('${u.id}')" style="display:block; width:100%; text-align:left; padding:12px; border:none; border-bottom:1px solid var(--border-light); background:transparent; cursor:pointer;">
          <div style="font-weight:500;">${escapeHtml(u.title)} ${u.pinned ? '📌' : ''}</div>
          <div class="muted" style="font-size:0.85rem;">${author ? escapeHtml(author.name) : 'Unknown'} · ${formatDate(u.createdAt)}</div>
        </button>
      `;
    }).join('');
    setHTML('homeUpdates', html);
  }
}

function viewAnnouncement(announcementId) {
  navigateTo('updates');
  // Scroll to the announcement after a brief delay for render
  setTimeout(() => {
    const el = document.querySelector(`[data-announcement-id="${announcementId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.backgroundColor = 'var(--primary-light)';
      setTimeout(() => el.style.backgroundColor = '', 1500);
    }
  }, 100);
}

function renderStartHere(course) {
  const isStaffUser = isStaff(appData.currentUser.id, course.id);
  const effectiveStaff = isStaffUser && !studentViewMode;
  const startHereTitle = course.startHereTitle || 'Start Here';
  // Default welcome message with course name
  const defaultContent = `Welcome to ${course.name}.`;
  const startHereContent = course.startHereContent || defaultContent;

  // Determine role label for display
  let roleLabel = '';
  if (studentViewMode) {
    roleLabel = 'You are a student';
  } else {
    const enrollment = appData.enrollments.find(e => e.userId === appData.currentUser.id && e.courseId === course.id);
    if (enrollment) {
      const roleLabels = {
        'instructor': 'You are the instructor',
        'ta': 'You are a TA',
        'student': 'You are a student'
      };
      roleLabel = roleLabels[enrollment.role] || '';
    }
  }

  // Use only user-added links (stored in course.startHereLinks)
  const pinnedLinks = course.startHereLinks || [];

  const pinnedHtml = pinnedLinks.length
    ? `<div class="start-here-links">${pinnedLinks.map((link, idx) => {
        // Support both URL links and file links
        if (link.fileId) {
          const file = appData.files.find(f => f.id === link.fileId);
          if (file) {
            return `<a href="#" onclick="openFile('${file.id}'); return false;" class="pill pill-link">📄 ${escapeHtml(link.label)}</a>`;
          }
          return ''; // File not found
        }
        return `<a href="${escapeHtml(link.url)}" target="_blank" class="pill pill-link">${escapeHtml(link.label)}</a>`;
      }).join('')}</div>`
    : '';

  const pinnedSection = pinnedLinks.length ? `
    <div style="margin-top:12px;">
      <div class="muted" style="margin-bottom:6px;">Pinned essentials</div>
      ${pinnedHtml}
    </div>
  ` : '';

  setHTML('homeStartHere', `
    ${roleLabel ? `<div style="margin-bottom:12px; padding:8px 12px; background:var(--primary-light); border-radius:var(--radius); font-weight:500; color:var(--primary);">${roleLabel}</div>` : ''}
    <div class="card">
      <div class="card-header">
        <div class="card-title">${startHereTitle}</div>
        ${effectiveStaff ? `<button class="btn btn-secondary btn-sm" onclick="openStartHereModal('${course.id}')">Edit</button>` : ''}
      </div>
      <div class="markdown-content">${renderMarkdown(startHereContent)}</div>
      ${pinnedSection}
    </div>
  `);
}

// Temporary storage for pinned links being edited
let startHereLinksEditing = [];

function openStartHereModal(courseId) {
  const course = getCourseById(courseId);
  if (!course) return;
  ensureModalsRendered();
  document.getElementById('startHereCourseId').value = courseId;
  document.getElementById('startHereTitle').value = course.startHereTitle || 'Start Here';
  const defaultContent = `Welcome to ${course.name}.`;
  document.getElementById('startHereContent').value = course.startHereContent || defaultContent;

  // Initialize links editing array
  startHereLinksEditing = [...(course.startHereLinks || [])];
  renderStartHereLinksEditor();

  openModal('startHereModal');
}

function renderStartHereLinksEditor() {
  const container = document.getElementById('startHereLinksEditor');
  if (!container) return;

  const courseId = document.getElementById('startHereCourseId')?.value;
  const courseFiles = courseId ? appData.files.filter(f => f.courseId === courseId) : [];

  if (startHereLinksEditing.length === 0) {
    container.innerHTML = '<div class="muted">No pinned links yet.</div>';
  } else {
    container.innerHTML = startHereLinksEditing.map((link, idx) => {
      const isFile = !!link.fileId;
      const fileOptions = courseFiles.map(f =>
        `<option value="${f.id}" ${link.fileId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
      ).join('');

      return `
        <div class="start-here-link-row" style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
          <input type="text" class="form-input" style="flex:1; min-width:100px;" value="${escapeHtml(link.label || '')}" placeholder="Label" onchange="updateStartHereLink(${idx}, 'label', this.value)">
          <select class="form-select" style="width:80px;" onchange="toggleStartHereLinkType(${idx}, this.value)">
            <option value="url" ${!isFile ? 'selected' : ''}>URL</option>
            <option value="file" ${isFile ? 'selected' : ''}>File</option>
          </select>
          ${isFile ? `
            <select class="form-select" style="flex:2; min-width:150px;" onchange="updateStartHereLink(${idx}, 'fileId', this.value)">
              <option value="">Select a file...</option>
              ${fileOptions}
            </select>
          ` : `
            <input type="text" class="form-input" style="flex:2; min-width:150px;" value="${escapeHtml(link.url || '')}" placeholder="https://..." onchange="updateStartHereLink(${idx}, 'url', this.value)">
          `}
          <button class="btn btn-secondary btn-sm" onclick="removeStartHereLink(${idx})" title="Remove">&times;</button>
        </div>
      `;
    }).join('');
  }
}

function toggleStartHereLinkType(idx, type) {
  if (startHereLinksEditing[idx]) {
    if (type === 'file') {
      delete startHereLinksEditing[idx].url;
      startHereLinksEditing[idx].fileId = '';
    } else {
      delete startHereLinksEditing[idx].fileId;
      startHereLinksEditing[idx].url = '';
    }
    renderStartHereLinksEditor();
  }
}

function addStartHereLink() {
  startHereLinksEditing.push({ label: '', url: '' });
  renderStartHereLinksEditor();
}

function updateStartHereLink(idx, field, value) {
  if (startHereLinksEditing[idx]) {
    startHereLinksEditing[idx][field] = value;
  }
}

function removeStartHereLink(idx) {
  startHereLinksEditing.splice(idx, 1);
  renderStartHereLinksEditor();
}

function saveStartHere() {
  const courseId = document.getElementById('startHereCourseId').value;
  const title = document.getElementById('startHereTitle').value.trim();
  const content = document.getElementById('startHereContent').value.trim();
  const course = getCourseById(courseId);
  if (!course) return;

  course.startHereTitle = title || 'Start Here';
  course.startHereContent = content;
  // Save only valid links (label required, and either url or fileId must be filled)
  // Also ensure URLs have proper protocol
  course.startHereLinks = startHereLinksEditing
    .filter(link =>
      link.label && link.label.trim() && (
        (link.url && link.url.trim()) || (link.fileId && link.fileId.trim())
      )
    )
    .map(link => {
      if (link.url) {
        return { ...link, url: ensureUrlProtocol(link.url) };
      }
      return link;
    });
  saveData(appData);

  closeModal('startHereModal');
  renderHome();
  showToast('Start Here updated', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATES (ANNOUNCEMENTS) PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderUpdates() {
  if (!activeCourseId) {
    setText('updatesSubtitle', 'Select a course');
    setHTML('updatesActions', '');
    setHTML('updatesList', '<div class="empty-state-text">No active course</div>');
    return;
  }

  const course = getCourseById(activeCourseId);
  setText('updatesSubtitle', course.name);

  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  const effectiveStaff = isStaffUser && !studentViewMode;

  if (effectiveStaff) {
    setHTML('updatesActions', `
      <button class="btn btn-primary" onclick="openModal('announcementModal')">New Announcement</button>
    `);
  } else {
    setHTML('updatesActions', '');
  }

  let announcements = appData.announcements
    .filter(a => a.courseId === activeCourseId)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  // Hide hidden announcements from students
  if (!effectiveStaff) {
    announcements = announcements.filter(a => !a.hidden);
  }

  if (announcements.length === 0) {
    setHTML('updatesList', '<div class="empty-state"><div class="empty-state-title">No announcements yet</div></div>');
    return;
  }

  const html = announcements.map(a => {
    const author = getUserById(a.authorId);
    const visibilityText = a.hidden ? 'Hidden' : 'Hide from Students';
    return `
      <div class="card" data-announcement-id="${a.id}" style="${a.hidden ? 'opacity:0.7; border-style:dashed;' : ''} transition: background-color 0.3s ease;">
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(a.title)} ${a.pinned ? '📌' : ''}</div>
            <div class="muted">${author ? escapeHtml(author.name) : 'Unknown'} · ${formatDate(a.createdAt)}</div>
          </div>
          ${effectiveStaff ? `
            <div style="display:flex; gap:8px; align-items:center;">
              <button class="btn btn-secondary btn-sm" onclick="toggleAnnouncementVisibility('${a.id}')" style="padding:4px 8px;">${visibilityText}</button>
              <button class="btn btn-secondary btn-sm" onclick="editAnnouncement('${a.id}')">Edit</button>
              <button class="btn btn-secondary btn-sm" onclick="deleteAnnouncement('${a.id}')">Delete</button>
            </div>
          ` : ''}
        </div>
        <div class="markdown-content">${renderMarkdown(a.content)}</div>
      </div>
    `;
  }).join('');

  setHTML('updatesList', html);
}

async function toggleAnnouncementVisibility(id) {
  const announcement = appData.announcements.find(a => a.id === id);
  if (!announcement) return;

  const originalHidden = announcement.hidden;
  announcement.hidden = !announcement.hidden;

  // Persist to Supabase
  const result = await supabaseUpdateAnnouncement(announcement);
  if (!result) {
    // Rollback on failure
    announcement.hidden = originalHidden;
    showToast('Failed to update announcement visibility', 'error');
    return;
  }

  saveData(appData);
  renderUpdates();
  renderHome();
  showToast(announcement.hidden ? 'Announcement hidden' : 'Announcement published', 'info');
}

async function createAnnouncement() {
  const title = document.getElementById('announcementTitle').value.trim();
  const content = document.getElementById('announcementContent').value.trim();
  const pinned = document.getElementById('announcementPinned').checked;

  if (!title || !content) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  const announcement = {
    id: generateId(),
    courseId: activeCourseId,
    title: title,
    content: content,
    pinned: pinned,
    authorId: appData.currentUser.id,
    createdAt: new Date().toISOString()
  };

  try {
    // Save to Supabase
    const result = await supabaseCreateAnnouncement(announcement);
    if (!result) {
      return; // Error already shown by supabase function
    }

    // Update local state
    appData.announcements.push(announcement);
    saveData(appData);

    closeModal('announcementModal');
    resetAnnouncementModal();
    renderUpdates();
    renderHome();
    showToast('Announcement posted!', 'success');
  } catch (err) {
    console.error('[createAnnouncement] Error:', err);
    showToast('Failed to create announcement: ' + err.message, 'error');
  }
}

function deleteAnnouncement(id) {
  confirm('Delete this update?', async () => {
    // Delete from Supabase
    await supabaseDeleteAnnouncement(id);

    // Update local state
    appData.announcements = appData.announcements.filter(a => a.id !== id);
    saveData(appData);
    renderUpdates();
    renderHome();
    showToast('Announcement deleted', 'success');
  });
}

let currentEditAnnouncementId = null;

function editAnnouncement(id) {
  currentEditAnnouncementId = id;
  const announcement = appData.announcements.find(a => a.id === id);
  
  if (!announcement) return;
  ensureModalsRendered();
  
  // Reuse the announcement modal
  document.getElementById('announcementTitle').value = announcement.title;
  document.getElementById('announcementContent').value = announcement.content;
  document.getElementById('announcementPinned').checked = announcement.pinned || false;
  
  // Change modal title and button text
  document.getElementById('announcementModalTitle').textContent = 'Edit Announcement';
  document.getElementById('announcementSubmitBtn').textContent = 'Save Changes';
  
  openModal('announcementModal');
}

function resetAnnouncementModal() {
  currentEditAnnouncementId = null;
  document.getElementById('announcementModalTitle').textContent = 'New Announcement';
  document.getElementById('announcementSubmitBtn').textContent = 'Post';
  document.getElementById('announcementTitle').value = '';
  document.getElementById('announcementContent').value = '';
  document.getElementById('announcementPinned').checked = false;
}

async function saveAnnouncementChanges() {
  if (currentEditAnnouncementId) {
    await updateAnnouncement();
  } else {
    await createAnnouncement();
  }
}

async function updateAnnouncement() {
  if (!currentEditAnnouncementId) return;

  const announcement = appData.announcements.find(a => a.id === currentEditAnnouncementId);
  if (!announcement) return;

  const title = document.getElementById('announcementTitle').value.trim();
  const content = document.getElementById('announcementContent').value.trim();
  const pinned = document.getElementById('announcementPinned').checked;

  if (!title || !content) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  // Store original values in case we need to rollback
  const originalTitle = announcement.title;
  const originalContent = announcement.content;
  const originalPinned = announcement.pinned;

  announcement.title = title;
  announcement.content = content;
  announcement.pinned = pinned;

  // Save to Supabase
  const result = await supabaseUpdateAnnouncement(announcement);
  if (!result) {
    // Rollback local changes
    announcement.title = originalTitle;
    announcement.content = originalContent;
    announcement.pinned = originalPinned;
    return;
  }
  saveData(appData);

  closeModal('announcementModal');
  resetAnnouncementModal();

  renderUpdates();
  renderHome();
  showToast('Announcement saved', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderAssignments() {
  if (!activeCourseId) {
    setText('assignmentsSubtitle', 'Select a course');
    setHTML('assignmentsActions', '');
    setHTML('assignmentsList', '<div class="empty-state-text">No active course</div>');
    return;
  }
  
  const course = getCourseById(activeCourseId);
  setText('assignmentsSubtitle', course.name);
  
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  
  if (isStaffUser && !studentViewMode) {
    setHTML('assignmentsActions', `
      <button class="btn btn-secondary" onclick="openQuestionBankModal()">Question Banks</button>
      <button class="btn btn-primary" onclick="openNewAssignmentModal()">New Assignment</button>
    `);
  } else {
    setHTML('assignmentsActions', '');
  }
  
  // When in student view mode, show as student would see
  const effectiveStaff = isStaffUser && !studentViewMode;

  const assignments = appData.assignments
    .filter(a => a.courseId === activeCourseId)
    .filter(a => effectiveStaff || a.status === 'published')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const quizzes = appData.quizzes
    .filter(q => q.courseId === activeCourseId)
    .filter(q => effectiveStaff || q.status === 'published')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  if (assignments.length === 0 && quizzes.length === 0) {
    setHTML('assignmentsList', '<div class="empty-state"><div class="empty-state-title">No assignments or quizzes yet</div></div>');
    return;
  }
  
  const assignmentCards = assignments.map(a => {
    const dueDate = new Date(a.dueDate);
    const isPast = dueDate < new Date();
    const mySubmission = appData.submissions.find(s => s.assignmentId === a.id && s.userId === appData.currentUser.id);
    const submissionCount = appData.submissions.filter(s => s.assignmentId === a.id).length;
    const isPlaceholder = a.isPlaceholder;

    let statusBadge = '';
    if (a.status === 'draft') statusBadge = '<span style="padding:4px 8px; background:var(--warning-light); color:var(--warning); border-radius:4px; font-size:0.75rem; font-weight:600;">DRAFT</span>';
    if (a.status === 'closed') statusBadge = '<span style="padding:4px 8px; background:var(--border-color); color:var(--text-muted); border-radius:4px; font-size:0.75rem; font-weight:600;">CLOSED</span>';

    // Visibility indicator for staff
    const visibilityBadge = effectiveStaff && a.status !== 'published' ?
      `<span style="padding:4px 8px; background:var(--danger-light); color:var(--danger); border-radius:4px; font-size:0.75rem; font-weight:600; cursor:pointer;" onclick="toggleAssignmentVisibility('${a.id}')" title="Click to publish">Hidden</span>` : '';

    return `
      <div class="card" ${isPlaceholder ? 'style="border-style:dashed; opacity:0.9;"' : ''}>
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(a.title)} ${statusBadge} ${visibilityBadge}</div>
            <div class="muted">${formatDueDate(a.dueDate)} · ${a.points} points${a.externalUrl ? ' · 🔗 External Link' : ''}</div>
          </div>
          <div style="display:flex; gap:8px;">
            ${effectiveStaff ? `
              <button class="btn btn-secondary btn-sm" onclick="viewSubmissions('${a.id}')">Submissions (${submissionCount})</button>
              <button class="btn btn-secondary btn-sm" onclick="editAssignment('${a.id}')">Edit</button>
              <button class="btn btn-secondary btn-sm" onclick="deleteAssignment('${a.id}')" style="color:var(--danger);">Delete</button>
            ` : mySubmission ? `
              <button class="btn btn-secondary btn-sm" onclick="viewMySubmission('${a.id}')">View Submission</button>
            ` : a.status === 'published' && !isPast ? `
              <button class="btn btn-primary btn-sm" onclick="submitAssignment('${a.id}')">Submit</button>
            ` : ''}
          </div>
        </div>
        <div class="markdown-content">${renderMarkdown(a.description)}</div>
        ${a.externalUrl ? `<div style="margin-top:8px;"><a href="${escapeHtml(a.externalUrl)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">🔗 Open External Link</a></div>` : ''}
      </div>
    `;
  }).join('');

  const quizCards = quizzes.map(q => {
    const dueDate = new Date(q.dueDate);
    const isPast = dueDate < new Date();
    const quizPoints = getQuizPoints(q);
    const submissions = appData.quizSubmissions.filter(s => s.quizId === q.id);
    const mySubmissions = submissions.filter(s => s.userId === appData.currentUser.id);
    const latestSubmission = mySubmissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
    const attemptsUsed = mySubmissions.length;
    const attemptsAllowed = q.attempts ? q.attempts : null;
    const attemptsLeft = attemptsAllowed ? Math.max(attemptsAllowed - attemptsUsed, 0) : null;
    const isPlaceholder = q.isPlaceholder;

    let statusBadge = '';
    if (q.status === 'draft') statusBadge = '<span style="padding:4px 8px; background:var(--warning-light); color:var(--warning); border-radius:4px; font-size:0.75rem; font-weight:600;">DRAFT</span>';
    if (q.status === 'closed') statusBadge = '<span style="padding:4px 8px; background:var(--border-color); color:var(--text-muted); border-radius:4px; font-size:0.75rem; font-weight:600;">CLOSED</span>';

    // Visibility indicator for staff
    const visibilityBadge = effectiveStaff && q.status !== 'published' ?
      `<span style="padding:4px 8px; background:var(--danger-light); color:var(--danger); border-radius:4px; font-size:0.75rem; font-weight:600; cursor:pointer;" onclick="toggleQuizVisibility('${q.id}')" title="Click to publish">Hidden</span>` : '';

    const timeLimitLabel = q.timeLimit ? `${q.timeLimit} min` : 'No time limit';
    const attemptsLabel = attemptsAllowed ? `${attemptsLeft} of ${attemptsAllowed} left` : 'Unlimited attempts';
    const submissionStatus = latestSubmission
      ? (latestSubmission.released ? `Score: ${latestSubmission.score}/${quizPoints}` : 'Submitted · awaiting review')
      : 'Not started';

    return `
      <div class="card" ${isPlaceholder ? 'style="border-style:dashed; opacity:0.9;"' : ''}>
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(q.title)} ${statusBadge} ${visibilityBadge}</div>
            <div class="muted">${formatDueDate(q.dueDate)} · ${quizPoints} points · ${timeLimitLabel}</div>
            <div class="muted" style="font-size:0.85rem;">${attemptsLabel} · ${submissionStatus}</div>
          </div>
          <div style="display:flex; gap:8px;">
            ${effectiveStaff ? `
              <button class="btn btn-secondary btn-sm" onclick="viewQuizSubmissions('${q.id}')">Submissions (${submissions.length})</button>
              <button class="btn btn-secondary btn-sm" onclick="openQuizModal('${q.id}')">Edit</button>
              <button class="btn btn-secondary btn-sm" onclick="viewQuizDetails('${q.id}')" title="View full quiz details">👁️ Preview</button>
              <button class="btn btn-secondary btn-sm" onclick="deleteQuiz('${q.id}')" style="color:var(--danger);">Delete</button>
            ` : latestSubmission ? `
              <button class="btn btn-secondary btn-sm" onclick="viewQuizSubmission('${q.id}')">View Submission</button>
              ${!isPast && (!attemptsAllowed || attemptsLeft > 0) ? `<button class="btn btn-primary btn-sm" onclick="takeQuiz('${q.id}')">Retake</button>` : ''}
            ` : q.status === 'published' && !isPast ? `
              <button class="btn btn-primary btn-sm" onclick="takeQuiz('${q.id}')">Take Quiz</button>
            ` : ''}
          </div>
        </div>
        <div class="markdown-content">${renderMarkdown(q.description || '')}</div>
      </div>
    `;
  }).join('');

  const sections = [];
  if (assignments.length > 0) {
    sections.push(`
      <div class="section-header">Assignments</div>
      ${assignmentCards}
    `);
  }
  if (quizzes.length > 0) {
    sections.push(`
      <div class="section-header">Quizzes</div>
      ${quizCards}
    `);
  }

  setHTML('assignmentsList', sections.join(''));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderCalendar() {
  if (!activeCourseId) {
    setText('calendarSubtitle', 'Select a course');
    setHTML('calendarActions', '');
    setHTML('calendarList', '<div class="empty-state-text">No active course</div>');
    return;
  }
  
  const course = getCourseById(activeCourseId);
  setText('calendarSubtitle', course.name);
  setHTML('calendarActions', '');
  
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - 7);
  const end = new Date();
  end.setDate(now.getDate() + 45);
  
  const items = [
    ...appData.assignments
      .filter(a => a.courseId === activeCourseId)
      .filter(a => isStaffUser || a.status === 'published')
      .map(a => ({ type: 'Assignment', title: a.title, dueDate: a.dueDate, status: a.status })),
    ...appData.quizzes
      .filter(q => q.courseId === activeCourseId)
      .filter(q => isStaffUser || q.status === 'published')
      .map(q => ({ type: 'Quiz', title: q.title, dueDate: q.dueDate, status: q.status }))
  ].filter(item => {
    const date = new Date(item.dueDate);
    return date >= start && date <= end;
  });
  
  if (items.length === 0) {
    setHTML('calendarList', '<div class="empty-state"><div class="empty-state-title">No upcoming work</div></div>');
    return;
  }
  
  const grouped = items.reduce((acc, item) => {
    const dateKey = new Date(item.dueDate).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});
  
  const orderedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
  
  const html = orderedDates.map(dateKey => `
    <div class="calendar-day">
      <div class="calendar-date">${new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      <div class="calendar-items">
        ${grouped[dateKey].map(item => `
          <div class="calendar-item">
            <div class="calendar-item-type">${item.type}</div>
            <div class="calendar-item-title">${item.title}</div>
            ${item.status === 'draft' ? '<span class="calendar-badge">Draft</span>' : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
  
  setHTML('calendarList', html);
}

async function createAssignment() {
  const title = document.getElementById('assignmentTitle').value.trim();
  const description = document.getElementById('assignmentDescription').value.trim();
  const category = document.getElementById('assignmentCategory').value;
  const points = parseInt(document.getElementById('assignmentPoints').value);
  const dueDate = getDateTimeFromSelectors('assignmentDueDate', 'assignmentDueHour', 'assignmentDueMinute', 'assignmentDueAmPm');
  const status = document.getElementById('assignmentStatus').value;
  const allowLate = document.getElementById('assignmentAllowLate').checked;
  const lateDeduction = parseInt(document.getElementById('assignmentLateDeduction').value) || 0;
  const allowResubmit = document.getElementById('assignmentAllowResubmit').checked;

  if (!title || !description || !points || !dueDate) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  const assignmentId = generateId();
  const assignment = {
    id: assignmentId,
    courseId: activeCourseId,
    title: title,
    description: description,
    category: category,
    points: points,
    status: status,
    dueDate: new Date(dueDate).toISOString(),
    createdAt: new Date().toISOString(),
    allowLateSubmissions: allowLate,
    lateDeduction: lateDeduction,
    allowResubmission: allowResubmit,
    rubric: null
  };

  try {
    // Save to Supabase
    const result = await supabaseCreateAssignment(assignment);
    if (!result) {
      return; // Error already shown by supabase function
    }

    // Update local state
    appData.assignments.push(assignment);
    saveData(appData);

    closeModal('assignmentModal');
    resetAssignmentModal();
    renderAssignments();
    renderHome();
    showToast('Assignment created!', 'success');
  } catch (err) {
    console.error('[createAssignment] Error:', err);
    showToast('Failed to create assignment: ' + err.message, 'error');
  }
}

function openCreateAssignmentTypeModal() {
  ensureModalsRendered();
  // Create simple type selector modal
  if (!document.getElementById('createTypeModal')) {
    const modalHtml = `
      <div class="modal-overlay" id="createTypeModal">
        <div class="modal" style="max-width:400px;">
          <div class="modal-header">
            <h2 class="modal-title">Create New</h2>
            <button class="modal-close" onclick="closeModal('createTypeModal')">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">What would you like to create?</label>
              <select class="form-select" id="createTypeSelect" onchange="handleCreateTypeChange()">
                <option value="homework">Homework</option>
                <option value="essay">Essay</option>
                <option value="project">Project</option>
                <option value="exam">Exam</option>
                <option value="quiz">Quiz</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal('createTypeModal')">Cancel</button>
            <button class="btn btn-primary" onclick="confirmCreateType()">Continue</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }
  document.getElementById('createTypeSelect').value = 'homework';
  openModal('createTypeModal');
}

function handleCreateTypeChange() {
  // Could add dynamic hints here if needed
}

function confirmCreateType() {
  const type = document.getElementById('createTypeSelect').value;
  closeModal('createTypeModal');

  if (type === 'quiz') {
    openQuizModal();
  } else {
    openAssignmentModal();
    document.getElementById('assignmentCategory').value = type;
  }
}

let currentEditAssignmentId = null;

function openAssignmentModal(assignmentId = null) {
  ensureModalsRendered();
  currentEditAssignmentId = assignmentId;
  const assignment = assignmentId ? appData.assignments.find(a => a.id === assignmentId) : null;

  document.getElementById('assignmentModalTitle').textContent = assignment ? 'Edit Assignment' : 'New Assignment';
  document.getElementById('assignmentSubmitBtn').textContent = assignment ? 'Save Changes' : 'Create';
  document.getElementById('assignmentTitle').value = assignment ? assignment.title : '';
  document.getElementById('assignmentDescription').value = assignment ? assignment.description : '';
  document.getElementById('assignmentCategory').value = assignment ? assignment.category : 'homework';
  document.getElementById('assignmentPoints').value = assignment ? assignment.points : '100';
  setDateTimeSelectors('assignmentDueDate', 'assignmentDueHour', 'assignmentDueMinute', 'assignmentDueAmPm', assignment ? assignment.dueDate : null);
  document.getElementById('assignmentStatus').value = assignment ? assignment.status : 'draft';
  document.getElementById('assignmentAllowLate').checked = assignment ? assignment.allowLateSubmissions !== false : true;
  document.getElementById('assignmentLateDeduction').value = assignment ? assignment.lateDeduction || 0 : '10';
  document.getElementById('assignmentAllowResubmit').checked = assignment ? assignment.allowResubmission !== false : true;

  openModal('assignmentModal');
}

function resetAssignmentModal() {
  currentEditAssignmentId = null;
  document.getElementById('assignmentModalTitle').textContent = 'New Assignment';
  document.getElementById('assignmentSubmitBtn').textContent = 'Create';
  document.getElementById('assignmentTitle').value = '';
  document.getElementById('assignmentDescription').value = '';
  document.getElementById('assignmentCategory').value = 'homework';
  document.getElementById('assignmentPoints').value = '100';
  setDateTimeSelectors('assignmentDueDate', 'assignmentDueHour', 'assignmentDueMinute', 'assignmentDueAmPm', null);
  document.getElementById('assignmentStatus').value = 'draft';
  document.getElementById('assignmentAllowLate').checked = true;
  document.getElementById('assignmentLateDeduction').value = '10';
  document.getElementById('assignmentAllowResubmit').checked = true;
}

async function saveAssignmentChanges() {
  if (currentEditAssignmentId) {
    await updateAssignment();
  } else {
    await createAssignment();
  }
}

async function updateAssignment() {
  if (!currentEditAssignmentId) return;

  const assignment = appData.assignments.find(a => a.id === currentEditAssignmentId);
  if (!assignment) return;

  const title = document.getElementById('assignmentTitle').value.trim();
  const description = document.getElementById('assignmentDescription').value.trim();
  const category = document.getElementById('assignmentCategory').value;
  const points = parseInt(document.getElementById('assignmentPoints').value);
  const dueDate = getDateTimeFromSelectors('assignmentDueDate', 'assignmentDueHour', 'assignmentDueMinute', 'assignmentDueAmPm');
  const status = document.getElementById('assignmentStatus').value;
  const allowLate = document.getElementById('assignmentAllowLate').checked;
  const lateDeduction = parseInt(document.getElementById('assignmentLateDeduction').value) || 0;
  const allowResubmit = document.getElementById('assignmentAllowResubmit').checked;

  if (!title || !description || !points || !dueDate) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  const previousStatus = assignment.status;

  // Store original values for rollback
  const original = { ...assignment };

  assignment.title = title;
  assignment.description = description;
  assignment.category = category;
  assignment.points = points;
  assignment.status = status;
  assignment.dueDate = new Date(dueDate).toISOString();
  assignment.allowLateSubmissions = allowLate;
  assignment.lateDeduction = lateDeduction;
  assignment.allowResubmission = allowResubmit;

  // Save to Supabase
  const result = await supabaseUpdateAssignment(assignment);
  if (!result) {
    // Rollback
    Object.assign(assignment, original);
    return;
  }
  saveData(appData);

  closeModal('assignmentModal');
  resetAssignmentModal();
  renderAssignments();
  renderHome();
  showToast('Assignment updated!', 'success');
}

function editAssignment(assignmentId) {
  openAssignmentModal(assignmentId);
}

function deleteAssignment(assignmentId) {
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  if (!assignment) return;

  confirm(`Delete "${assignment.title}"? This will also delete all submissions.`, async () => {
    // Delete from Supabase
    const success = await supabaseDeleteAssignment(assignmentId);
    if (!success) return;

    // Update local state
    appData.assignments = appData.assignments.filter(a => a.id !== assignmentId);
    appData.submissions = appData.submissions.filter(s => s.assignmentId !== assignmentId);
    saveData(appData);
    renderAssignments();
    renderHome();
    showToast('Assignment deleted', 'success');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTION BANK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

let currentEditQuestionBankId = null;
let questionBankDraftQuestions = [];

function openQuestionBankModal() {
  ensureModalsRendered();
  renderQuestionBankList();
  openModal('questionBankModal');
}

function renderQuestionBankList() {
  const banks = (appData.questionBanks || []).filter(b => b.courseId === activeCourseId);

  let html = '';
  if (banks.length === 0) {
    html = '<div style="text-align:center; padding:40px; color:var(--text-secondary);">No question banks yet. Create one to get started.</div>';
  } else {
    html = '<div style="display:flex; flex-direction:column; gap:12px;">';
    banks.forEach(bank => {
      const questionCount = (bank.questions || []).length;
      html += `
        <div class="card" style="padding:16px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600;">${escapeHtml(bank.name)}</div>
            <div style="font-size:0.875rem; color:var(--text-secondary);">${questionCount} question${questionCount !== 1 ? 's' : ''}${bank.description ? ' · ' + escapeHtml(bank.description) : ''}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="editQuestionBank('${bank.id}')">Edit</button>
            <button class="btn btn-secondary btn-sm" onclick="deleteQuestionBank('${bank.id}')">Delete</button>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  setHTML('questionBankModalBody', html);
}

function openCreateQuestionBankForm() {
  currentEditQuestionBankId = null;
  questionBankDraftQuestions = [];

  document.getElementById('questionBankEditTitle').textContent = 'New Question Bank';
  document.getElementById('questionBankName').value = '';
  document.getElementById('questionBankDescription').value = '';
  document.getElementById('questionBankSaveBtn').textContent = 'Create Bank';

  renderQuestionBankQuestions();
  closeModal('questionBankModal');
  openModal('questionBankEditModal');
}

function editQuestionBank(bankId) {
  const bank = appData.questionBanks.find(b => b.id === bankId);
  if (!bank) return;

  currentEditQuestionBankId = bankId;
  questionBankDraftQuestions = JSON.parse(JSON.stringify(bank.questions || []));

  document.getElementById('questionBankEditTitle').textContent = 'Edit Question Bank';
  document.getElementById('questionBankName').value = bank.name;
  document.getElementById('questionBankDescription').value = bank.description || '';
  document.getElementById('questionBankSaveBtn').textContent = 'Save Changes';

  renderQuestionBankQuestions();
  closeModal('questionBankModal');
  openModal('questionBankEditModal');
}

function deleteQuestionBank(bankId) {
  const bank = appData.questionBanks.find(b => b.id === bankId);
  if (!bank) return;

  confirm(`Delete "${bank.name}"? This cannot be undone.`, async () => {
    await supabaseDeleteQuestionBank(bankId);
    appData.questionBanks = appData.questionBanks.filter(b => b.id !== bankId);
    saveData(appData);
    renderQuestionBankList();
    showToast('Question bank deleted', 'success');
  });
}

function renderQuestionBankQuestions() {
  const container = document.getElementById('questionBankQuestionsContainer');
  if (!container) return;

  if (questionBankDraftQuestions.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary); border:1px dashed var(--border); border-radius:var(--radius);">No questions yet. Click "Add Question" to create one.</div>';
    return;
  }

  let html = '';
  questionBankDraftQuestions.forEach((q, index) => {
    const typeLabel = q.type === 'true_false' ? 'True/False' : q.type === 'multiple_choice' ? 'Multiple Choice' : 'Written/Rubric';
    html += `
      <div class="card" style="padding:12px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <span style="font-size:0.75rem; background:var(--primary-light); color:var(--primary); padding:2px 8px; border-radius:999px;">${typeLabel}</span>
            <span style="margin-left:8px; font-weight:500;">${q.points || 1} pt${(q.points || 1) !== 1 ? 's' : ''}</span>
          </div>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-secondary btn-sm" onclick="editQuestionInBank(${index})">Edit</button>
            <button class="btn btn-secondary btn-sm" onclick="removeQuestionFromBank(${index})">Remove</button>
          </div>
        </div>
        <div style="font-size:0.9rem;">${escapeHtml(q.prompt || q.question || 'No question text')}</div>
        ${q.type === 'multiple_choice' && q.options ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">Options: ${q.options.length}, Correct: ${q.correctAnswer || 'Not set'}</div>` : ''}
        ${q.type === 'true_false' ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">Correct: ${q.correctAnswer === true || q.correctAnswer === 'true' ? 'True' : 'False'}</div>` : ''}
        ${q.gradingNotes ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">Grading notes: ${escapeHtml(q.gradingNotes.substring(0, 50))}${q.gradingNotes.length > 50 ? '...' : ''}</div>` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

function addQuestionToBankForm() {
  const newQuestion = {
    id: generateId(),
    type: 'multiple_choice',
    prompt: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    points: 1,
    introNotes: '',
    gradingNotes: ''
  };
  questionBankDraftQuestions.push(newQuestion);
  openQuestionEditor(questionBankDraftQuestions.length - 1);
}

function editQuestionInBank(index) {
  openQuestionEditor(index);
}

function removeQuestionFromBank(index) {
  questionBankDraftQuestions.splice(index, 1);
  renderQuestionBankQuestions();
}

let currentEditQuestionIndex = null;

function openQuestionEditor(index) {
  currentEditQuestionIndex = index;
  const question = questionBankDraftQuestions[index];

  // Build a simple inline editor form
  const container = document.getElementById('questionBankQuestionsContainer');

  let optionsHtml = '';
  if (question.type === 'multiple_choice') {
    const options = question.options || ['', '', '', ''];
    optionsHtml = `
      <div class="form-group">
        <label class="form-label">Answer Options</label>
        ${options.map((opt, i) => `
          <div style="display:flex; gap:8px; margin-bottom:4px; align-items:center;">
            <input type="radio" name="correctAnswer" value="${i}" ${question.correctAnswer === i ? 'checked' : ''}>
            <input type="text" class="form-input" id="questionOption${i}" value="${escapeHtml(opt)}" placeholder="Option ${i + 1}">
            ${i >= 2 ? `<button class="btn btn-secondary btn-sm" onclick="removeQuestionOption(${i})">×</button>` : ''}
          </div>
        `).join('')}
        <button class="btn btn-secondary btn-sm" style="margin-top:4px;" onclick="addQuestionOption()">+ Add Option</button>
        <div class="hint" style="margin-top:4px;">Select the radio button next to the correct answer</div>
      </div>
    `;
  } else if (question.type === 'true_false') {
    optionsHtml = `
      <div class="form-group">
        <label class="form-label">Correct Answer</label>
        <select class="form-select" id="questionCorrectTF">
          <option value="true" ${question.correctAnswer === true || question.correctAnswer === 'true' ? 'selected' : ''}>True</option>
          <option value="false" ${question.correctAnswer === false || question.correctAnswer === 'false' ? 'selected' : ''}>False</option>
        </select>
      </div>
    `;
  } else {
    // Written/rubric type
    optionsHtml = `
      <div class="form-group">
        <label class="form-label">Rubric / Grading Criteria</label>
        <textarea class="form-textarea" id="questionRubric" rows="3" placeholder="Describe how this question should be graded...">${escapeHtml(question.rubric || '')}</textarea>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="card" style="padding:16px; background:var(--surface);">
      <h4 style="margin-bottom:12px;">Edit Question</h4>
      <div class="form-group">
        <label class="form-label">Question Type</label>
        <select class="form-select" id="questionType" onchange="changeQuestionType()">
          <option value="multiple_choice" ${question.type === 'multiple_choice' ? 'selected' : ''}>Multiple Choice</option>
          <option value="true_false" ${question.type === 'true_false' ? 'selected' : ''}>True/False</option>
          <option value="written" ${question.type === 'written' ? 'selected' : ''}>Written/Rubric</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Question Text</label>
        <textarea class="form-textarea" id="questionPrompt" rows="2" placeholder="Enter the question...">${escapeHtml(question.prompt || question.question || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Points</label>
        <input type="number" class="form-input" id="questionPoints" value="${question.points || 1}" min="1" style="width:100px;">
      </div>
      <div id="questionTypeSpecificFields">
        ${optionsHtml}
      </div>
      <div class="form-group">
        <label class="form-label">Intro Notes (shown to students)</label>
        <textarea class="form-textarea" id="questionIntroNotes" rows="2" placeholder="Optional context or hints for students...">${escapeHtml(question.introNotes || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Grading Notes (private - for instructors only)</label>
        <textarea class="form-textarea" id="questionGradingNotes" rows="2" placeholder="Notes for graders...">${escapeHtml(question.gradingNotes || '')}</textarea>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="cancelQuestionEdit()">Cancel</button>
        <button class="btn btn-primary" onclick="saveQuestionEdit()">Save Question</button>
      </div>
    </div>
  `;
}

function changeQuestionType() {
  const type = document.getElementById('questionType').value;
  questionBankDraftQuestions[currentEditQuestionIndex].type = type;

  // Reset type-specific fields
  if (type === 'multiple_choice') {
    questionBankDraftQuestions[currentEditQuestionIndex].options = ['', '', '', ''];
    questionBankDraftQuestions[currentEditQuestionIndex].correctAnswer = 0;
  } else if (type === 'true_false') {
    questionBankDraftQuestions[currentEditQuestionIndex].correctAnswer = true;
  }

  openQuestionEditor(currentEditQuestionIndex);
}

function addQuestionOption() {
  const question = questionBankDraftQuestions[currentEditQuestionIndex];
  if (!question.options) question.options = [];

  // Save current values first
  const currentOptions = [];
  let i = 0;
  while (document.getElementById(`questionOption${i}`)) {
    currentOptions.push(document.getElementById(`questionOption${i}`).value);
    i++;
  }
  question.options = currentOptions;
  question.options.push('');

  // Get selected correct answer
  const selected = document.querySelector('input[name="correctAnswer"]:checked');
  if (selected) question.correctAnswer = parseInt(selected.value);

  openQuestionEditor(currentEditQuestionIndex);
}

function removeQuestionOption(index) {
  const question = questionBankDraftQuestions[currentEditQuestionIndex];

  // Save current values first
  const currentOptions = [];
  let i = 0;
  while (document.getElementById(`questionOption${i}`)) {
    currentOptions.push(document.getElementById(`questionOption${i}`).value);
    i++;
  }
  question.options = currentOptions;
  question.options.splice(index, 1);

  // Adjust correct answer if needed
  if (question.correctAnswer >= question.options.length) {
    question.correctAnswer = question.options.length - 1;
  }

  openQuestionEditor(currentEditQuestionIndex);
}

function cancelQuestionEdit() {
  // If it was a new question with no content, remove it
  const question = questionBankDraftQuestions[currentEditQuestionIndex];
  if (!question.prompt && !question.question) {
    questionBankDraftQuestions.splice(currentEditQuestionIndex, 1);
  }
  currentEditQuestionIndex = null;
  renderQuestionBankQuestions();
}

function saveQuestionEdit() {
  const question = questionBankDraftQuestions[currentEditQuestionIndex];

  question.prompt = document.getElementById('questionPrompt').value.trim();
  question.points = parseInt(document.getElementById('questionPoints').value) || 1;
  question.introNotes = document.getElementById('questionIntroNotes').value.trim();
  question.gradingNotes = document.getElementById('questionGradingNotes').value.trim();

  if (question.type === 'multiple_choice') {
    const options = [];
    let i = 0;
    while (document.getElementById(`questionOption${i}`)) {
      options.push(document.getElementById(`questionOption${i}`).value);
      i++;
    }
    question.options = options;
    const selected = document.querySelector('input[name="correctAnswer"]:checked');
    question.correctAnswer = selected ? parseInt(selected.value) : 0;
  } else if (question.type === 'true_false') {
    question.correctAnswer = document.getElementById('questionCorrectTF').value === 'true';
  } else if (question.type === 'written') {
    question.rubric = document.getElementById('questionRubric').value.trim();
  }

  if (!question.prompt) {
    showToast('Please enter question text', 'error');
    return;
  }

  currentEditQuestionIndex = null;
  renderQuestionBankQuestions();
}

async function saveQuestionBank() {
  const name = document.getElementById('questionBankName').value.trim();
  const description = document.getElementById('questionBankDescription').value.trim();

  if (!name) {
    showToast('Please enter a bank name', 'error');
    return;
  }

  if (currentEditQuestionBankId) {
    // Update existing bank
    const bank = appData.questionBanks.find(b => b.id === currentEditQuestionBankId);
    if (bank) {
      bank.name = name;
      bank.description = description;
      bank.questions = questionBankDraftQuestions;
      await supabaseUpdateQuestionBank(bank);
    }
  } else {
    // Create new bank
    const newBank = {
      id: generateId(),
      courseId: activeCourseId,
      name: name,
      description: description,
      questions: questionBankDraftQuestions,
      createdAt: new Date().toISOString()
    };
    appData.questionBanks.push(newBank);
    await supabaseCreateQuestionBank(newBank);
  }

  saveData(appData);
  closeModal('questionBankEditModal');
  showToast(currentEditQuestionBankId ? 'Question bank updated' : 'Question bank created', 'success');

  // Refresh the list if returning to it
  currentEditQuestionBankId = null;
  questionBankDraftQuestions = [];
  openQuestionBankModal();
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW ASSIGNMENT MODAL (with type dropdown)
// ═══════════════════════════════════════════════════════════════════════════════

let currentNewAssignmentEditId = null;

function openNewAssignmentModal(assignmentId = null) {
  ensureModalsRendered();
  currentNewAssignmentEditId = assignmentId;

  // Populate question bank dropdown
  populateQuestionBankDropdown();

  if (assignmentId) {
    // Editing existing assignment
    const assignment = appData.assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    document.getElementById('newAssignmentModalTitle').textContent = 'Edit Assignment';
    document.getElementById('newAssignmentSubmitBtn').textContent = 'Save Changes';
    document.getElementById('newAssignmentType').value = assignment.category || 'essay';
    document.getElementById('newAssignmentTitle').value = assignment.title || '';
    document.getElementById('newAssignmentDescription').value = assignment.description || '';
    document.getElementById('newAssignmentIntroNotes').value = assignment.introNotes || '';
    document.getElementById('newAssignmentPoints').value = assignment.points || 100;
    document.getElementById('newAssignmentStatus').value = assignment.status || 'draft';
    document.getElementById('newAssignmentAllowLate').checked = assignment.allowLateSubmissions !== false;
    document.getElementById('newAssignmentLatePenaltyType').value = assignment.latePenaltyType || 'per_day';
    document.getElementById('newAssignmentLatePenalty').value = assignment.lateDeduction || 10;
    document.getElementById('newAssignmentGradingNotes').value = assignment.gradingNotes || '';
    document.getElementById('newAssignmentAllowResubmit').checked = assignment.allowResubmission !== false;

    // Question bank settings
    if (assignment.questionBankId) {
      document.getElementById('newAssignmentQuestionBank').value = assignment.questionBankId;
    }
    document.getElementById('newAssignmentNumQuestions').value = assignment.numQuestions || '';
    document.getElementById('newAssignmentRandomizeQuestions').checked = assignment.randomizeQuestions !== false;
    document.getElementById('newAssignmentRandomizeAnswers').checked = assignment.randomizeAnswers !== false;

    // Dates
    if (assignment.availableFrom) {
      document.getElementById('newAssignmentAvailableFrom').value = assignment.availableFrom.split('T')[0];
    }
    if (assignment.availableUntil) {
      document.getElementById('newAssignmentAvailableUntil').value = assignment.availableUntil.split('T')[0];
    }
    setDateTimeSelectors('newAssignmentDueDate', 'newAssignmentDueHour', 'newAssignmentDueMinute', 'newAssignmentDueAmPm', assignment.dueDate);

    handleNewAssignmentTypeChange();
  } else {
    resetNewAssignmentModal();
  }

  openModal('newAssignmentModal');
}

function resetNewAssignmentModal() {
  currentNewAssignmentEditId = null;
  document.getElementById('newAssignmentModalTitle').textContent = 'New Assignment';
  document.getElementById('newAssignmentSubmitBtn').textContent = 'Create Assignment';
  document.getElementById('newAssignmentType').value = 'essay';
  document.getElementById('newAssignmentTitle').value = '';
  document.getElementById('newAssignmentDescription').value = '';
  document.getElementById('newAssignmentIntroNotes').value = '';
  document.getElementById('newAssignmentPoints').value = '100';
  document.getElementById('newAssignmentAvailableFrom').value = '';
  document.getElementById('newAssignmentAvailableUntil').value = '';
  setDateTimeSelectors('newAssignmentDueDate', 'newAssignmentDueHour', 'newAssignmentDueMinute', 'newAssignmentDueAmPm', null);
  document.getElementById('newAssignmentStatus').value = 'draft';
  document.getElementById('newAssignmentAllowLate').checked = true;
  document.getElementById('newAssignmentLatePenaltyType').value = 'per_day';
  document.getElementById('newAssignmentLatePenalty').value = '10';
  document.getElementById('newAssignmentGradingNotes').value = '';
  document.getElementById('newAssignmentAllowResubmit').checked = true;
  document.getElementById('newAssignmentQuestionBank').value = '';
  document.getElementById('newAssignmentNumQuestions').value = '';
  document.getElementById('newAssignmentRandomizeQuestions').checked = true;
  document.getElementById('newAssignmentRandomizeAnswers').checked = true;

  handleNewAssignmentTypeChange();
}

function populateQuestionBankDropdown() {
  const banks = (appData.questionBanks || []).filter(b => b.courseId === activeCourseId);
  const select = document.getElementById('newAssignmentQuestionBank');
  if (!select) return;

  let html = '<option value="">-- Select a question bank --</option>';
  banks.forEach(bank => {
    const count = (bank.questions || []).length;
    html += `<option value="${bank.id}">${escapeHtml(bank.name)} (${count} questions)</option>`;
  });
  select.innerHTML = html;
}

function handleNewAssignmentTypeChange() {
  const type = document.getElementById('newAssignmentType').value;
  const questionBankSection = document.getElementById('questionBankSection');

  if (type === 'quiz' || type === 'exam') {
    questionBankSection.style.display = 'block';
  } else {
    questionBankSection.style.display = 'none';
  }
}

async function saveNewAssignment() {
  const type = document.getElementById('newAssignmentType').value;
  const title = document.getElementById('newAssignmentTitle').value.trim();
  const description = document.getElementById('newAssignmentDescription').value.trim();
  const introNotes = document.getElementById('newAssignmentIntroNotes').value.trim();
  const points = parseInt(document.getElementById('newAssignmentPoints').value) || 100;
  const availableFrom = document.getElementById('newAssignmentAvailableFrom').value;
  const availableUntil = document.getElementById('newAssignmentAvailableUntil').value;
  const dueDate = getDateTimeFromSelectors('newAssignmentDueDate', 'newAssignmentDueHour', 'newAssignmentDueMinute', 'newAssignmentDueAmPm');
  const status = document.getElementById('newAssignmentStatus').value;
  const allowLate = document.getElementById('newAssignmentAllowLate').checked;
  const latePenaltyType = document.getElementById('newAssignmentLatePenaltyType').value;
  const latePenalty = parseInt(document.getElementById('newAssignmentLatePenalty').value) || 0;
  const gradingNotes = document.getElementById('newAssignmentGradingNotes').value.trim();
  const allowResubmit = document.getElementById('newAssignmentAllowResubmit').checked;

  // Quiz/Exam specific
  let questionBankId = null;
  let numQuestions = null;
  let randomizeQuestions = true;
  let randomizeAnswers = true;

  if (type === 'quiz' || type === 'exam') {
    questionBankId = document.getElementById('newAssignmentQuestionBank').value;
    numQuestions = parseInt(document.getElementById('newAssignmentNumQuestions').value) || 0;
    randomizeQuestions = document.getElementById('newAssignmentRandomizeQuestions').checked;
    randomizeAnswers = document.getElementById('newAssignmentRandomizeAnswers').checked;

    if (!questionBankId) {
      showToast('Please select a question bank for quiz/exam', 'error');
      return;
    }
  }

  if (!title) {
    showToast('Please enter a title', 'error');
    return;
  }

  if (!dueDate) {
    showToast('Please set a due date', 'error');
    return;
  }

  if (currentNewAssignmentEditId) {
    // Update existing assignment
    const assignment = appData.assignments.find(a => a.id === currentNewAssignmentEditId);
    if (!assignment) return;

    const original = { ...assignment };

    assignment.title = title;
    assignment.description = description;
    assignment.category = type;
    assignment.introNotes = introNotes;
    assignment.points = points;
    assignment.availableFrom = availableFrom ? new Date(availableFrom).toISOString() : null;
    assignment.availableUntil = availableUntil ? new Date(availableUntil).toISOString() : null;
    assignment.dueDate = new Date(dueDate).toISOString();
    assignment.status = status;
    assignment.allowLateSubmissions = allowLate;
    assignment.latePenaltyType = latePenaltyType;
    assignment.lateDeduction = latePenalty;
    assignment.gradingNotes = gradingNotes;
    assignment.allowResubmission = allowResubmit;
    assignment.questionBankId = questionBankId;
    assignment.numQuestions = numQuestions;
    assignment.randomizeQuestions = randomizeQuestions;
    assignment.randomizeAnswers = randomizeAnswers;

    const result = await supabaseUpdateAssignment(assignment);
    if (!result) {
      Object.assign(assignment, original);
      return;
    }

    saveData(appData);
    closeModal('newAssignmentModal');
    resetNewAssignmentModal();
    renderAssignments();
    renderHome();
    showToast('Assignment updated!', 'success');
  } else {
    // Create new assignment
    const newAssignment = {
      id: generateId(),
      courseId: activeCourseId,
      title: title,
      description: description,
      category: type,
      introNotes: introNotes,
      points: points,
      availableFrom: availableFrom ? new Date(availableFrom).toISOString() : null,
      availableUntil: availableUntil ? new Date(availableUntil).toISOString() : null,
      dueDate: new Date(dueDate).toISOString(),
      status: status,
      allowLateSubmissions: allowLate,
      latePenaltyType: latePenaltyType,
      lateDeduction: latePenalty,
      gradingNotes: gradingNotes,
      allowResubmission: allowResubmit,
      questionBankId: questionBankId,
      numQuestions: numQuestions,
      randomizeQuestions: randomizeQuestions,
      randomizeAnswers: randomizeAnswers,
      createdAt: new Date().toISOString(),
      createdBy: appData.currentUser?.id
    };

    const result = await supabaseCreateAssignment(newAssignment);
    if (result) {
      appData.assignments.push(newAssignment);
      saveData(appData);

      // Notify students if published
      if (status === 'published') {
        const students = appData.enrollments
          .filter(e => e.courseId === activeCourseId && e.role === 'student')
          .map(e => e.userId);

        students.forEach(studentId => {
          addNotification(studentId, 'assignment', 'New Assignment Posted',
            `${title} is now available`, activeCourseId);
        });
      }

      closeModal('newAssignmentModal');
      resetNewAssignmentModal();
      renderAssignments();
      renderHome();
      showToast('Assignment created!', 'success');
    }
  }
}

function submitAssignment(assignmentId) {
  openModal('submitModal');
  document.getElementById('submitModalAssignmentId').value = assignmentId;
}

function saveSubmission() {
  const assignmentId = document.getElementById('submitModalAssignmentId').value;
  const text = document.getElementById('submissionText').value.trim();
  const fileInput = document.getElementById('submissionFile');
  
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  
  // Check if past due and late submissions not allowed
  const dueDate = new Date(assignment.dueDate);
  const now = new Date();
  
  if (now > dueDate && !assignment.allowLateSubmissions) {
    showToast('This assignment is past due and does not accept late submissions', 'error');
    return;
  }
  
  // Check if resubmission allowed
  const existingSubmission = appData.submissions.find(s => 
    s.assignmentId === assignmentId && s.userId === appData.currentUser.id
  );
  
  if (existingSubmission && !assignment.allowResubmission) {
    showToast('This assignment does not allow resubmissions', 'error');
    return;
  }
  
  if (!text && !fileInput.files[0]) {
    showToast('Please provide submission text or upload a file', 'error');
    return;
  }
  
  const submission = {
    id: generateId(),
    assignmentId: assignmentId,
    userId: appData.currentUser.id,
    text: text,
    fileName: null,
    fileData: null,
    submittedAt: new Date().toISOString()
  };
  
  if (fileInput.files[0]) {
    const file = fileInput.files[0];
    submission.fileName = file.name;
    
    // For small files (< 1MB), store as base64
    if (file.size < 1048576) {
      const reader = new FileReader();
      reader.onload = function(e) {
        submission.fileData = e.target.result;
        appData.submissions.push(submission);
        saveData(appData);
        
        closeModal('submitModal');
        renderAssignments();
        showToast('Submission saved!', 'success');
        document.getElementById('submissionText').value = '';
        fileInput.value = '';
      };
      reader.readAsDataURL(file);
      return;
    } else {
      // For large files, just store metadata
      showToast('Large file - metadata only stored (implement Supabase storage for production)', 'info');
    }
  }
  
  appData.submissions.push(submission);
  saveData(appData);
  
  closeModal('submitModal');
  renderAssignments();
  
  const lateDeduction = calculateLateDeduction(assignment, submission.submittedAt);
  if (lateDeduction > 0) {
    showToast(`Submission saved! Note: ${lateDeduction}% late penalty applies`, 'success');
  } else {
    showToast('Submission saved!', 'success');
  }
  
  document.getElementById('submissionText').value = '';
  fileInput.value = '';
}

function viewSubmissions(assignmentId) {
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  const submissions = appData.submissions.filter(s => s.assignmentId === assignmentId);
  
  const html = `
    <div class="modal-overlay visible" id="submissionsModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title">Submissions: ${assignment.title}</h2>
          <button class="modal-close" onclick="closeModal('submissionsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="closeModal('submissionsModal'); openSpeedGrader('${assignmentId}')">⚡ SpeedGrader</button>
            <button class="btn btn-secondary btn-sm" onclick="openBulkGradeModal('${assignmentId}')">📋 Bulk Import Grades</button>
            <button class="btn btn-secondary btn-sm" onclick="bulkReleaseGrades('${assignmentId}')">🔓 Release All Grades</button>
            <button class="btn btn-secondary btn-sm" onclick="downloadAllSubmissions('${assignmentId}')">📥 Download All (ZIP)</button>
          </div>
          ${submissions.length === 0 ? '<div class="empty-state-text">No submissions yet</div>' : submissions.map(s => {
            const student = getUserById(s.userId);
            const grade = appData.grades.find(g => g.submissionId === s.id);
            const dueDate = new Date(assignment.dueDate);
            const submitDate = new Date(s.submittedAt);
            const isLate = submitDate > dueDate;
            const lateDeduction = calculateLateDeduction(assignment, s.submittedAt);
            
            return `
              <div class="card">
                <div class="card-header">
                  <div>
                    <div class="card-title">${student ? student.name : 'Unknown'} ${isLate ? '⚠️ LATE' : ''}</div>
                    <div class="muted">
                      Submitted ${formatDate(s.submittedAt)}
                      ${isLate && lateDeduction > 0 ? ` · ${lateDeduction}% late penalty` : ''}
                    </div>
                  </div>
                  <div style="display:flex; gap:8px; align-items:center;">
                    ${grade ? `<span class="muted">${grade.score}/${assignment.points} ${grade.released ? '' : '🔒'}</span>` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="viewSubmissionHistory('${assignmentId}', '${s.userId}')">History</button>
                    <button class="btn btn-primary btn-sm" onclick="gradeSubmission('${s.id}', '${assignmentId}')">Grade</button>
                  </div>
                </div>
                <div>${s.text || '<em class="muted">No text submission</em>'}</div>
                ${s.fileName ? `<div class="muted" style="margin-top:8px;">📎 ${s.fileName}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML += html;
}

function downloadAllSubmissions(assignmentId) {
  showToast('ZIP download would be implemented with JSZip library', 'info');
  // In production: use JSZip to create ZIP of all submissions
}

function gradeSubmission(submissionId, assignmentId) {
  const submission = appData.submissions.find(s => s.id === submissionId);
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  const student = getUserById(submission.userId);
  const existingGrade = appData.grades.find(g => g.submissionId === submissionId);
  
  // Check if assignment has a rubric
  const rubric = appData.rubrics?.find(r => r.assignmentId === assignmentId);
  
  let rubricHTML = '';
  if (rubric) {
    rubricHTML = `
      <div class="card" style="margin-bottom:16px; background:var(--bg-color);">
        <div style="font-weight:600; margin-bottom:12px;">Grading Rubric</div>
        ${rubric.criteria.map((criterion, idx) => `
          <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <strong>${criterion.name}</strong>
              <span>${criterion.points} pts</span>
            </div>
            ${criterion.description ? `<div class="muted" style="font-size:0.85rem;">${criterion.description}</div>` : ''}
            <input type="number" class="form-input" id="rubricCriterion${idx}" 
                   min="0" max="${criterion.points}" step="0.1" 
                   placeholder="0-${criterion.points}"
                   style="margin-top:4px;">
          </div>
        `).join('')}
        <button class="btn btn-secondary btn-sm" onclick="calculateRubricScore('${assignmentId}')" style="width:100%; margin-top:8px;">Calculate Total from Rubric</button>
      </div>
    `;
  }
  
  const html = `
    <div class="modal-overlay visible" id="gradeModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title">Grade Submission: ${student ? student.name : 'Unknown'}</h2>
          <button class="modal-close" onclick="closeModal('gradeModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="card" style="margin-bottom:16px; background:var(--bg-color);">
            <div style="font-weight:600; margin-bottom:8px;">${assignment.title}</div>
            <div>${submission.text || '<em class="muted">No text submission</em>'}</div>
            ${submission.fileName ? `<div class="muted" style="margin-top:8px;">📎 ${submission.fileName}</div>` : ''}
          </div>
          
          ${rubricHTML}
          
          <div class="form-group">
            <label class="form-label">Score (out of ${assignment.points})</label>
            <input type="number" class="form-input" id="gradeScore" min="0" max="${assignment.points}" value="${existingGrade ? existingGrade.score : ''}" placeholder="0">
          </div>
          
          <div class="form-group">
            <label class="form-label">Feedback</label>
            <textarea class="form-textarea" id="gradeFeedback" placeholder="Provide feedback...">${existingGrade ? existingGrade.feedback : ''}</textarea>
          </div>
          
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="gradeReleased" ${existingGrade ? (existingGrade.released ? 'checked' : '') : ''}>
              <span>Release grade to student</span>
            </label>
          </div>
          
          <div style="margin-top:16px;">
            <button class="btn btn-secondary" onclick="draftGradeWithAI('${submissionId}', '${assignmentId}')">✨ Draft with AI</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('gradeModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveGrade('${submissionId}')">Save Grade</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML += html;
}

function calculateRubricScore(assignmentId) {
  const rubric = appData.rubrics?.find(r => r.assignmentId === assignmentId);
  if (!rubric) return;
  
  let total = 0;
  let allFilled = true;
  
  rubric.criteria.forEach((criterion, idx) => {
    const input = document.getElementById(`rubricCriterion${idx}`);
    if (input && input.value) {
      total += parseFloat(input.value) || 0;
    } else {
      allFilled = false;
    }
  });
  
  if (!allFilled) {
    showToast('Please fill in all rubric criteria', 'error');
    return;
  }
  
  document.getElementById('gradeScore').value = total.toFixed(1);
  showToast('Score calculated from rubric', 'success');
}

function saveGrade(submissionId) {
  const score = parseFloat(document.getElementById('gradeScore').value);
  const feedback = document.getElementById('gradeFeedback').value.trim();
  const released = document.getElementById('gradeReleased').checked;
  
  if (isNaN(score) || !feedback) {
    showToast('Please provide score and feedback', 'error');
    return;
  }
  
  // Remove existing grade if any
  appData.grades = appData.grades.filter(g => g.submissionId !== submissionId);
  
  // Add new grade
  appData.grades.push({
    submissionId: submissionId,
    score: score,
    feedback: feedback,
    released: released,
    gradedBy: appData.currentUser.id,
    gradedAt: new Date().toISOString()
  });
  
  saveData(appData);
  closeModal('gradeModal');
  closeModal('submissionsModal');
  renderGradebook();
  showToast('Grade saved!', 'success');
}

async function draftGradeWithAI(submissionId, assignmentId) {
  const apiKey = window.GEMINI_API_KEY || appData.settings.geminiKey;
  
  if (!apiKey) {
    showToast('Gemini API key not configured. Add GEMINI_API_KEY to config.js or configure in Settings.', 'error');
    return;
  }
  
  const submission = appData.submissions.find(s => s.id === submissionId);
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  
  const prompt = `You are grading a student submission for an assignment.

Assignment: ${assignment.title}
Description: ${assignment.description}
Points possible: ${assignment.points}

Student submission:
${submission.text || 'No text submission provided'}

Please provide a grade and feedback. Respond ONLY with valid JSON in this format:
{"score": <number>, "feedback": "<string>"}

The score should be between 0 and ${assignment.points}. The feedback should be constructive and specific.`;

  try {
    showToast('Drafting grade with AI...', 'info');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const text = data.candidates[0].content.parts[0].text;
    
    // Try to parse JSON from response
    let result;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : text);
    } catch (parseErr) {
      // Fallback: extract score and feedback manually
      const scoreMatch = text.match(/score["']?\s*:\s*(\d+)/i);
      const feedbackMatch = text.match(/feedback["']?\s*:\s*["'](.*?)["']/is);
      
      result = {
        score: scoreMatch ? parseInt(scoreMatch[1]) : Math.floor(assignment.points * 0.85),
        feedback: feedbackMatch ? feedbackMatch[1] : text
      };
    }
    
    document.getElementById('gradeScore').value = result.score;
    document.getElementById('gradeFeedback').value = result.feedback;
    showToast('AI draft ready! Review and edit as needed.', 'success');
    
  } catch (err) {
    console.error('AI grading error:', err);
    showToast('AI drafting failed: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZZES
// ═══════════════════════════════════════════════════════════════════════════════

function createDefaultQuestion(type = 'multiple_choice') {
  if (type === 'true_false') {
    return {
      id: generateId(),
      type,
      prompt: '',
      options: ['True', 'False'],
      correctAnswer: 'True',
      points: 1,
      sampleAnswer: ''
    };
  }
  
  if (type === 'short_answer') {
    return {
      id: generateId(),
      type,
      prompt: '',
      options: [],
      correctAnswer: '',
      points: 1,
      sampleAnswer: ''
    };
  }
  
  return {
    id: generateId(),
    type,
    prompt: '',
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
    correctAnswer: 0,
    points: 1,
    sampleAnswer: ''
  };
}

function openQuizModal(quizId = null) {
  ensureModalsRendered();
  currentEditQuizId = quizId;
  const quiz = quizId ? appData.quizzes.find(q => q.id === quizId) : null;
  
  const draft = !quiz && aiQuizDraft ? aiQuizDraft : null;
  
  document.getElementById('quizModalTitle').textContent = quiz ? 'Edit Quiz' : 'New Quiz';
  document.getElementById('quizTitle').value = quiz ? quiz.title : (draft?.title || '');
  document.getElementById('quizDescription').value = quiz ? quiz.description || '' : (draft?.description || '');
  setDateTimeSelectors('quizDueDate', 'quizDueHour', 'quizDueMinute', 'quizDueAmPm', quiz ? quiz.dueDate : null);
  document.getElementById('quizStatus').value = quiz ? quiz.status : 'draft';
  document.getElementById('quizTimeLimit').value = quiz ? quiz.timeLimit || '' : '';
  document.getElementById('quizAttempts').value = quiz ? quiz.attempts || '' : '';
  document.getElementById('quizRandomize').checked = quiz ? quiz.randomizeQuestions === true : true;
  document.getElementById('quizPoolEnabled').checked = quiz ? quiz.questionPoolEnabled === true : false;
  document.getElementById('quizPoolCount').value = quiz ? quiz.questionSelectCount || '' : '';
  
  quizDraftQuestions = quiz
    ? JSON.parse(JSON.stringify(quiz.questions || []))
    : (draft?.questions?.map(q => ({
      id: q.id || generateId(),
      type: q.type || 'multiple_choice',
      prompt: q.prompt || '',
      options: q.options || (q.type === 'multiple_choice' ? ['Option 1', 'Option 2'] : []),
      correctAnswer: q.correctAnswer ?? (q.type === 'true_false' ? 'True' : 0),
      points: parseFloat(q.points) || 1,
      sampleAnswer: ''
    })) || [createDefaultQuestion()]);
  
  aiQuizDraft = null;
  toggleQuizPoolFields();
  renderQuizQuestions();
  openModal('quizModal');
}

function toggleQuizPoolFields() {
  const enabled = document.getElementById('quizPoolEnabled').checked;
  const poolGroup = document.getElementById('quizPoolCountGroup');
  if (poolGroup) {
    poolGroup.style.display = enabled ? 'block' : 'none';
  }
}

function renderQuizQuestions() {
  const list = document.getElementById('quizQuestionsList');
  if (!list) return;
  
  list.innerHTML = quizDraftQuestions.map((q, index) => {
    const typeOptions = `
      <option value="multiple_choice" ${q.type === 'multiple_choice' ? 'selected' : ''}>Multiple choice</option>
      <option value="true_false" ${q.type === 'true_false' ? 'selected' : ''}>True / False</option>
      <option value="short_answer" ${q.type === 'short_answer' ? 'selected' : ''}>Short answer</option>
    `;
    
    let optionsHtml = '';
    if (q.type === 'multiple_choice') {
      optionsHtml = `
        <div class="quiz-options">
          ${q.options.map((opt, optIndex) => `
            <div class="quiz-option-row">
              <input type="text" class="form-input" value="${opt}" oninput="updateQuizOption(${index}, ${optIndex}, this.value)" placeholder="Option ${optIndex + 1}">
            </div>
          `).join('')}
          <div class="form-group">
            <label class="form-label">Correct answer</label>
            <select class="form-select" onchange="updateQuizQuestion(${index}, 'correctAnswer', this.value)">
              ${q.options.map((opt, optIndex) => `
                <option value="${optIndex}" ${parseInt(q.correctAnswer) === optIndex ? 'selected' : ''}>${opt || `Option ${optIndex + 1}`}</option>
              `).join('')}
            </select>
          </div>
        </div>
      `;
    } else if (q.type === 'true_false') {
      optionsHtml = `
        <div class="form-group">
          <label class="form-label">Correct answer</label>
          <select class="form-select" onchange="updateQuizQuestion(${index}, 'correctAnswer', this.value)">
            <option value="True" ${q.correctAnswer === 'True' ? 'selected' : ''}>True</option>
            <option value="False" ${q.correctAnswer === 'False' ? 'selected' : ''}>False</option>
          </select>
        </div>
      `;
    } else {
      optionsHtml = `
        <div class="form-group">
          <label class="form-label">Sample answer (optional)</label>
          <textarea class="form-textarea" rows="2" oninput="updateQuizQuestion(${index}, 'correctAnswer', this.value)" placeholder="Add a reference answer">${q.correctAnswer || ''}</textarea>
        </div>
      `;
    }
    
    return `
      <div class="quiz-question-card">
        <div class="quiz-question-header">
          <div class="form-group">
            <label class="form-label">Question ${index + 1}</label>
            <input type="text" class="form-input" value="${q.prompt}" oninput="updateQuizQuestion(${index}, 'prompt', this.value)" placeholder="Write the question...">
          </div>
          <div class="quiz-question-meta">
            <select class="form-select" onchange="updateQuizQuestion(${index}, 'type', this.value)">
              ${typeOptions}
            </select>
            <input type="number" class="form-input" value="${q.points}" min="1" oninput="updateQuizQuestion(${index}, 'points', this.value)" placeholder="Points">
            <button class="btn btn-secondary btn-sm" onclick="removeQuizQuestion(${index})">Remove</button>
          </div>
        </div>
        ${optionsHtml}
      </div>
    `;
  }).join('');
  
  updateQuizPointsTotal();
}

function updateQuizQuestion(index, field, value) {
  const question = quizDraftQuestions[index];
  if (!question) return;
  
  if (field === 'type') {
    quizDraftQuestions[index] = createDefaultQuestion(value);
    renderQuizQuestions();
    return;
  }
  
  if (field === 'points') {
    question.points = parseFloat(value) || 0;
    updateQuizPointsTotal();
    return;
  }
  
  if (field === 'correctAnswer' && question.type === 'multiple_choice') {
    question.correctAnswer = parseInt(value, 10);
    return;
  }
  
  question[field] = value;
}

function updateQuizOption(questionIndex, optionIndex, value) {
  const question = quizDraftQuestions[questionIndex];
  if (!question || !question.options) return;
  question.options[optionIndex] = value;
}

function addQuizQuestion() {
  quizDraftQuestions.push(createDefaultQuestion());
  renderQuizQuestions();
}

function removeQuizQuestion(index) {
  quizDraftQuestions.splice(index, 1);
  if (quizDraftQuestions.length === 0) {
    quizDraftQuestions.push(createDefaultQuestion());
  }
  renderQuizQuestions();
}

function updateQuizPointsTotal() {
  const total = quizDraftQuestions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
  const el = document.getElementById('quizPointsTotal');
  if (el) el.textContent = total.toFixed(1);
}

async function saveQuiz() {
  const title = document.getElementById('quizTitle').value.trim();
  const description = document.getElementById('quizDescription').value.trim();
  const dueDate = getDateTimeFromSelectors('quizDueDate', 'quizDueHour', 'quizDueMinute', 'quizDueAmPm');
  const status = document.getElementById('quizStatus').value;
  const timeLimit = parseInt(document.getElementById('quizTimeLimit').value, 10) || 0;
  const attempts = parseInt(document.getElementById('quizAttempts').value, 10) || 0;
  const randomizeQuestions = document.getElementById('quizRandomize').checked;
  const questionPoolEnabled = document.getElementById('quizPoolEnabled').checked;
  const questionSelectCount = parseInt(document.getElementById('quizPoolCount').value, 10) || 0;

  if (!title || !dueDate) {
    showToast('Please fill in title and due date', 'error');
    return;
  }

  if (quizDraftQuestions.length === 0) {
    showToast('Add at least one question', 'error');
    return;
  }

  if (questionPoolEnabled && (!questionSelectCount || questionSelectCount > quizDraftQuestions.length)) {
    showToast('Question pool count must be between 1 and total questions', 'error');
    return;
  }

  for (const question of quizDraftQuestions) {
    if (!question.prompt.trim() || !question.points) {
      showToast('Each question needs text and points', 'error');
      return;
    }

    if (question.type === 'multiple_choice') {
      if (question.options.some(opt => !opt.trim())) {
        showToast('Fill in all multiple choice options', 'error');
        return;
      }
      if (question.correctAnswer === null || question.correctAnswer === undefined) {
        showToast('Select a correct answer for each multiple choice question', 'error');
        return;
      }
    }
  }

  const isNewQuiz = !currentEditQuizId;
  const quizData = {
    id: currentEditQuizId || generateId(),
    courseId: activeCourseId,
    title,
    description,
    status,
    dueDate: new Date(dueDate).toISOString(),
    createdAt: currentEditQuizId ? appData.quizzes.find(q => q.id === currentEditQuizId)?.createdAt : new Date().toISOString(),
    timeLimit: timeLimit || null,
    attempts: attempts || null,
    randomizeQuestions,
    questionPoolEnabled,
    questionSelectCount: questionPoolEnabled ? questionSelectCount : null,
    questions: JSON.parse(JSON.stringify(quizDraftQuestions))
  };

  // Save to Supabase
  let result;
  if (isNewQuiz) {
    result = await supabaseCreateQuiz(quizData);
  } else {
    result = await supabaseUpdateQuiz(quizData);
  }
  if (!result) {
    return; // Error already shown
  }

  const existingIndex = appData.quizzes.findIndex(q => q.id === quizData.id);
  const previousStatus = existingIndex >= 0 ? appData.quizzes[existingIndex].status : null;

  if (existingIndex >= 0) {
    appData.quizzes[existingIndex] = quizData;
  } else {
    appData.quizzes.push(quizData);
  }
  
  saveData(appData);
  
  closeModal('quizModal');
  renderAssignments();
  renderHome();
  showToast('Quiz saved!', 'success');
}

function deleteQuiz(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  confirm(`Delete "${quiz.title}"? This will also delete all submissions.`, async () => {
    // Delete from Supabase
    const success = await supabaseDeleteQuiz(quizId);
    if (!success) return;

    // Update local state
    appData.quizzes = appData.quizzes.filter(q => q.id !== quizId);
    appData.quizSubmissions = appData.quizSubmissions.filter(s => s.quizId !== quizId);
    saveData(appData);
    renderAssignments();
    renderHome();
    showToast('Quiz deleted', 'success');
  });
}

function takeQuiz(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;
  
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  if (!isStaffUser && quiz.status !== 'published') {
    showToast('This quiz is not published yet', 'error');
    return;
  }
  
  const attemptsUsed = appData.quizSubmissions.filter(s => s.quizId === quizId && s.userId === appData.currentUser.id).length;
  if (quiz.attempts && attemptsUsed >= quiz.attempts) {
    showToast('No attempts left for this quiz', 'error');
    return;
  }
  
  if (new Date(quiz.dueDate) < new Date()) {
    showToast('This quiz is past due', 'error');
    return;
  }
  
  currentQuizTakingId = quizId;
  renderQuizTakeModal(quiz);
  openModal('quizTakeModal');
}

function renderQuizTakeModal(quiz) {
  const container = document.getElementById('quizTakeQuestions');
  if (!container) return;
  
  let questions = JSON.parse(JSON.stringify(quiz.questions || []));
  if (quiz.questionPoolEnabled && quiz.questionSelectCount && quiz.questionSelectCount < questions.length) {
    questions = shuffleArray(questions).slice(0, quiz.questionSelectCount);
  }
  
  if (quiz.randomizeQuestions) {
    questions = shuffleArray(questions);
  }
  
  container.dataset.questions = JSON.stringify(questions);
  container.innerHTML = questions.map((q, index) => {
    if (q.type === 'multiple_choice') {
      return `
        <div class="quiz-question-block">
          <div class="quiz-question-title">${index + 1}. ${q.prompt}</div>
          ${q.options.map((opt, optIndex) => `
            <label class="quiz-answer-option">
              <input type="radio" name="quizQuestion${index}" value="${optIndex}">
              <span>${opt}</span>
            </label>
          `).join('')}
        </div>
      `;
    }
    
    if (q.type === 'true_false') {
      return `
        <div class="quiz-question-block">
          <div class="quiz-question-title">${index + 1}. ${q.prompt}</div>
          ${['True', 'False'].map(option => `
            <label class="quiz-answer-option">
              <input type="radio" name="quizQuestion${index}" value="${option}">
              <span>${option}</span>
            </label>
          `).join('')}
        </div>
      `;
    }
    
    return `
      <div class="quiz-question-block">
        <div class="quiz-question-title">${index + 1}. ${q.prompt}</div>
        <textarea class="form-textarea" rows="3" id="quizAnswer${index}" placeholder="Your answer..."></textarea>
      </div>
    `;
  }).join('');
  
  const points = getQuizPoints({ questions });
  setText('quizTakeTitle', quiz.title);
  setText('quizTakeMeta', `${points} points · ${quiz.timeLimit ? quiz.timeLimit + ' min' : 'No time limit'}`);
  
  startQuizTimer(quiz.timeLimit);
}

function startQuizTimer(timeLimit) {
  const timerEl = document.getElementById('quizTimer');
  if (quizTimerInterval) {
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;
  }
  
  if (!timeLimit) {
    if (timerEl) timerEl.textContent = 'No time limit';
    return;
  }
  
  quizTimeRemaining = timeLimit * 60;
  if (timerEl) timerEl.textContent = formatTimer(quizTimeRemaining);
  
  quizTimerInterval = setInterval(() => {
    quizTimeRemaining -= 1;
    if (timerEl) timerEl.textContent = formatTimer(quizTimeRemaining);
    if (quizTimeRemaining <= 0) {
      clearInterval(quizTimerInterval);
      quizTimerInterval = null;
      showToast('Time is up! Submitting quiz.', 'info');
      submitQuiz();
    }
  }, 1000);
}

async function submitQuiz() {
  const quiz = appData.quizzes.find(q => q.id === currentQuizTakingId);
  const container = document.getElementById('quizTakeQuestions');
  if (!quiz || !container) return;

  const questions = JSON.parse(container.dataset.questions || '[]');
  const answers = {};

  questions.forEach((q, index) => {
    if (q.type === 'short_answer') {
      answers[q.id] = document.getElementById(`quizAnswer${index}`).value.trim();
    } else {
      const selected = document.querySelector(`input[name="quizQuestion${index}"]:checked`);
      answers[q.id] = selected ? selected.value : null;
    }
  });

  const { autoScore, needsManual } = calculateQuizAutoScore(questions, answers);
  const totalPoints = getQuizPoints({ questions });

  const submission = {
    id: generateId(),
    quizId: quiz.id,
    userId: appData.currentUser.id,
    answers,
    questions,
    autoScore,
    score: autoScore,
    needsManual,
    graded: !needsManual,
    released: !needsManual,
    feedback: '',
    submittedAt: new Date().toISOString(),
    gradedAt: needsManual ? null : new Date().toISOString(),
    gradedBy: needsManual ? null : 'auto'
  };

  // Save to Supabase
  await supabaseUpsertQuizSubmission(submission);

  appData.quizSubmissions.push(submission);
  saveData(appData);
  
  if (quizTimerInterval) {
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;
  }
  
  if (!needsManual) {
    showToast(`Quiz submitted! Score: ${autoScore}/${totalPoints}`, 'success');
  } else {
    showToast('Quiz submitted! Awaiting review.', 'success');
  }
  
  closeModal('quizTakeModal');
  renderAssignments();
}

function calculateQuizAutoScore(questions, answers) {
  let autoScore = 0;
  let needsManual = false;
  
  questions.forEach(q => {
    const points = parseFloat(q.points) || 0;
    if (q.type === 'multiple_choice') {
      const selectedIndex = parseInt(answers[q.id], 10);
      if (selectedIndex === parseInt(q.correctAnswer, 10)) {
        autoScore += points;
      }
    } else if (q.type === 'true_false') {
      if (answers[q.id] === q.correctAnswer) {
        autoScore += points;
      }
    } else {
      needsManual = true;
    }
  });
  
  return { autoScore, needsManual };
}

function viewQuizSubmissions(quizId) {
  ensureModalsRendered();
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;
  
  const submissions = appData.quizSubmissions
    .filter(s => s.quizId === quizId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  
  const list = document.getElementById('quizSubmissionsList');
  if (!list) return;
  
  if (submissions.length === 0) {
    list.innerHTML = '<div class="empty-state-text">No submissions yet</div>';
  } else {
    list.innerHTML = submissions.map(submission => {
      const student = getUserById(submission.userId);
      const status = submission.released ? `Score: ${submission.score}` : 'Needs review';
      return `
        <div class="submission-row">
          <div>
            <div style="font-weight:600;">${student ? student.name : 'Unknown'}</div>
            <div class="muted">${formatDate(submission.submittedAt)} · ${status}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="openQuizGradeModal('${quizId}', '${submission.id}')">Grade</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  document.getElementById('quizSubmissionsTitle').textContent = `Quiz Submissions: ${quiz.title}`;
  openModal('quizSubmissionsModal');
}

function openQuizGradeModal(quizId, submissionId) {
  ensureModalsRendered();
  const quiz = appData.quizzes.find(q => q.id === quizId);
  const submission = appData.quizSubmissions.find(s => s.id === submissionId);
  if (!quiz || !submission) return;
  
  const student = getUserById(submission.userId);
  const answersList = document.getElementById('quizGradeAnswers');
  const scoreInput = document.getElementById('quizGradeScore');
  const feedbackInput = document.getElementById('quizGradeFeedback');
  
  document.getElementById('quizGradeTitle').textContent = `Grade Quiz: ${student ? student.name : 'Student'}`;
  const totalPoints = getQuizPoints({ questions: submission.questions });
  document.getElementById('quizGradePoints').textContent = `${totalPoints} pts total`;
  
  answersList.innerHTML = submission.questions.map((q, index) => {
    const answer = submission.answers[q.id];
    let answerText = '';
    if (q.type === 'multiple_choice') {
      const selectedIndex = parseInt(answer, 10);
      answerText = answer !== null && !Number.isNaN(selectedIndex) ? q.options[selectedIndex] : 'No answer';
    } else if (q.type === 'true_false') {
      answerText = answer || 'No answer';
    } else {
      answerText = answer || 'No answer';
    }
    
    return `
      <div class="quiz-answer-review">
        <div class="quiz-answer-question">${index + 1}. ${q.prompt}</div>
        <div class="quiz-answer-response">Answer: ${answerText}</div>
      </div>
    `;
  }).join('');
  
  scoreInput.value = submission.score || submission.autoScore || 0;
  feedbackInput.value = submission.feedback || '';
  document.getElementById('quizGradeSubmissionId').value = submission.id;
  document.getElementById('quizGradeQuizId').value = quizId;
  
  openModal('quizGradeModal');
}

function saveQuizGrade() {
  const submissionId = document.getElementById('quizGradeSubmissionId').value;
  const quizId = document.getElementById('quizGradeQuizId').value;
  const score = parseFloat(document.getElementById('quizGradeScore').value) || 0;
  const feedback = document.getElementById('quizGradeFeedback').value.trim();
  
  const submission = appData.quizSubmissions.find(s => s.id === submissionId);
  if (!submission) return;
  
  submission.score = score;
  submission.feedback = feedback;
  submission.released = true;
  submission.needsManual = false;
  submission.gradedAt = new Date().toISOString();
  submission.gradedBy = appData.currentUser.id;
  
  saveData(appData);
  
  const quiz = appData.quizzes.find(q => q.id === quizId);
  closeModal('quizGradeModal');
  renderAssignments();
  viewQuizSubmissions(quizId);
  showToast('Quiz graded!', 'success');
}

function viewQuizSubmission(quizId) {
  ensureModalsRendered();
  const quiz = appData.quizzes.find(q => q.id === quizId);
  const submissions = appData.quizSubmissions
    .filter(s => s.quizId === quizId && s.userId === appData.currentUser.id)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  
  const latest = submissions[0];
  if (!quiz || !latest) return;
  
  const list = document.getElementById('quizReviewList');
  if (!list) return;
  
  const totalPoints = getQuizPoints({ questions: latest.questions });
  document.getElementById('quizReviewTitle').textContent = `${quiz.title} · ${latest.released ? `Score ${latest.score}/${totalPoints}` : 'Awaiting review'}`;
  
  list.innerHTML = latest.questions.map((q, index) => {
    const answer = latest.answers[q.id];
    let answerText = '';
    if (q.type === 'multiple_choice') {
      const selectedIndex = parseInt(answer, 10);
      answerText = answer !== null && !Number.isNaN(selectedIndex) ? q.options[selectedIndex] : 'No answer';
    } else if (q.type === 'true_false') {
      answerText = answer || 'No answer';
    } else {
      answerText = answer || 'No answer';
    }
    
    return `
      <div class="quiz-answer-review">
        <div class="quiz-answer-question">${index + 1}. ${q.prompt}</div>
        <div class="quiz-answer-response">Your answer: ${answerText}</div>
      </div>
    `;
  }).join('');
  
  openModal('quizReviewModal');
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function shuffleArray(list) {
  return list.slice().sort(() => Math.random() - 0.5);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULES PAGE
// ═══════════════════════════════════════════════════════════════════════════════

let modulesSearch = '';

function updateModulesSearch(value) {
  modulesSearch = value.toLowerCase();
  renderModules();
}

function renderModules() {
  if (!activeCourseId) {
    setText('modulesSubtitle', 'Select a course');
    setHTML('modulesActions', '');
    setHTML('modulesList', '<div class="empty-state-text">No active course</div>');
    return;
  }

  const course = getCourseById(activeCourseId);
  setText('modulesSubtitle', course.name);

  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  const effectiveStaff = isStaffUser && !studentViewMode;

  if (!appData.modules) appData.modules = [];

  // Actions with search
  setHTML('modulesActions', `
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
      <input type="text" class="form-input" placeholder="Search modules..." value="${escapeHtml(modulesSearch)}" onkeyup="updateModulesSearch(this.value)" style="width:200px;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      ${effectiveStaff ? `
        <button class="btn btn-primary" onclick="openModuleModal()">New Module</button>
        <button class="btn btn-secondary" onclick="openSyllabusParserModal()">Import from Syllabus</button>
      ` : ''}
    </div>
  `);

  let modules = appData.modules
    .filter(m => m.courseId === activeCourseId)
    .sort((a, b) => a.position - b.position);

  // Hide hidden modules from students
  if (!effectiveStaff) {
    modules = modules.filter(m => !m.hidden);
  }

  // Filter by search - search module names and item titles
  if (modulesSearch) {
    modules = modules.filter(mod => {
      // Check module name
      if (mod.name.toLowerCase().includes(modulesSearch)) return true;
      // Check items in module
      const items = mod.items || [];
      return items.some(item => {
        if (item.type === 'assignment') {
          const a = appData.assignments.find(a => a.id === item.refId);
          return a && a.title.toLowerCase().includes(modulesSearch);
        } else if (item.type === 'quiz') {
          const q = appData.quizzes.find(q => q.id === item.refId);
          return q && q.title.toLowerCase().includes(modulesSearch);
        } else if (item.type === 'file') {
          const f = appData.files.find(f => f.id === item.refId);
          return f && f.name.toLowerCase().includes(modulesSearch);
        } else if (item.type === 'page') {
          return (item.title || '').toLowerCase().includes(modulesSearch);
        }
        return false;
      });
    });
  }

  if (modules.length === 0) {
    setHTML('modulesList', modulesSearch
      ? '<div class="empty-state"><div class="empty-state-text">No modules match your search</div></div>'
      : `
      <div class="empty-state">
        <div class="empty-state-title">No modules yet</div>
      </div>
    `);
    return;
  }

  const html = modules.map((mod, modIndex) => {
    const items = (mod.items || []).sort((a, b) => a.position - b.position);

    const itemsHtml = items.map((item, itemIndex) => {
      let itemData = null;
      let itemIcon = '📄';
      let itemTitle = 'Unknown Item';
      let statusBadge = '';

      if (item.type === 'assignment') {
        itemData = appData.assignments.find(a => a.id === item.refId);
        itemIcon = '📝';
        if (itemData) {
          itemTitle = itemData.title;
          statusBadge = itemData.status === 'draft' ? '<span class="status-badge draft">(draft)</span>' : '';
        }
      } else if (item.type === 'quiz') {
        itemData = appData.quizzes.find(q => q.id === item.refId);
        itemIcon = '❓';
        if (itemData) {
          itemTitle = itemData.title;
          statusBadge = itemData.status === 'draft' ? '<span class="status-badge draft">(draft)</span>' : '';
        }
      } else if (item.type === 'file') {
        itemData = appData.files.find(f => f.id === item.refId);
        itemIcon = '📁';
        if (itemData) itemTitle = itemData.name;
      } else if (item.type === 'page') {
        itemIcon = '📃';
        itemTitle = item.title || 'Untitled Page';
      }

      if (!itemData && item.type !== 'page') {
        return ''; // Item was deleted
      }

      // Check if file is hidden
      const fileHidden = item.type === 'file' && itemData && itemData.hidden;
      if (!effectiveStaff && fileHidden) return ''; // Hide hidden files from students

      const fileVisText = fileHidden ? 'Hidden' : 'Hide from Students';

      return `
        <div class="module-item ${effectiveStaff ? 'draggable' : ''}" style="${fileHidden ? 'opacity:0.6;' : ''}"
             draggable="${effectiveStaff}"
             data-module-id="${mod.id}"
             data-item-id="${item.id}"
             ondragstart="handleModuleItemDragStart(event)"
             ondragover="handleModuleItemDragOver(event)"
             ondrop="handleModuleItemDrop(event)"
             ondragend="handleModuleItemDragEnd(event)">
          <span class="module-item-icon">${itemIcon}</span>
          <span class="module-item-title">${escapeHtml(itemTitle)} ${statusBadge}</span>
          ${effectiveStaff ? `
            <div class="module-item-actions">
              ${item.type === 'file' ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); toggleFileVisibility('${item.refId}')">${fileVisText}</button>` : ''}
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); removeModuleItem('${mod.id}', '${item.id}')">Remove</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    const moduleVisText = mod.hidden ? 'Hidden' : 'Hide from Students';

    return `
      <div class="module-card ${effectiveStaff ? 'draggable' : ''}" style="${mod.hidden ? 'opacity:0.7; border-style:dashed;' : ''}"
           draggable="${effectiveStaff}"
           data-module-id="${mod.id}"
           ondragstart="handleModuleDragStart(event)"
           ondragover="handleModuleDragOver(event)"
           ondrop="handleModuleDrop(event)"
           ondragend="handleModuleDragEnd(event)">
        <div class="module-header">
          <h3 class="module-title">${escapeHtml(mod.name)}</h3>
          ${effectiveStaff ? `
            <div class="module-actions">
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); toggleModuleVisibility('${mod.id}')">${moduleVisText}</button>
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openAddModuleItemModal('${mod.id}')">Add Item</button>
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); editModule('${mod.id}')">Edit</button>
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); deleteModule('${mod.id}')">Delete</button>
            </div>
          ` : ''}
        </div>
        <div class="module-items" data-module-id="${mod.id}">
          ${itemsHtml || '<div class="module-empty">No items in this module</div>'}
        </div>
      </div>
    `;
  }).join('');

  setHTML('modulesList', html);
}

// Module drag-and-drop handlers
function handleModuleDragStart(event) {
  event.dataTransfer.setData('text/plain', event.target.dataset.moduleId);
  event.dataTransfer.effectAllowed = 'move';
  event.target.classList.add('dragging');
}

function handleModuleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function handleModuleDrop(event) {
  event.preventDefault();
  const draggedId = event.dataTransfer.getData('text/plain');
  const targetEl = event.target.closest('.module-card');
  if (!targetEl) return;

  const targetId = targetEl.dataset.moduleId;
  if (draggedId === targetId) return;

  const modules = appData.modules.filter(m => m.courseId === activeCourseId).sort((a, b) => a.position - b.position);
  const draggedIndex = modules.findIndex(m => m.id === draggedId);
  const targetIndex = modules.findIndex(m => m.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1) return;

  // Reorder
  const [removed] = modules.splice(draggedIndex, 1);
  modules.splice(targetIndex, 0, removed);

  // Update positions
  modules.forEach((m, i) => {
    const mod = appData.modules.find(x => x.id === m.id);
    if (mod) mod.position = i;
  });

  saveData(appData);
  renderModules();
}

function handleModuleDragEnd(event) {
  event.target.classList.remove('dragging');
}

// Module item drag-and-drop handlers
function handleModuleItemDragStart(event) {
  event.stopPropagation();
  draggedModuleItem = {
    moduleId: event.target.dataset.moduleId,
    itemId: event.target.dataset.itemId
  };
  event.dataTransfer.setData('text/plain', JSON.stringify(draggedModuleItem));
  event.dataTransfer.effectAllowed = 'move';
  event.target.classList.add('dragging');
}

function handleModuleItemDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = 'move';
}

function handleModuleItemDrop(event) {
  event.preventDefault();
  event.stopPropagation();

  if (!draggedModuleItem) return;

  const targetEl = event.target.closest('.module-item');
  const targetModuleEl = event.target.closest('.module-items') || event.target.closest('.module-card');

  if (!targetModuleEl) return;

  const targetModuleId = targetModuleEl.dataset.moduleId;
  const sourceModule = appData.modules.find(m => m.id === draggedModuleItem.moduleId);
  const targetModule = appData.modules.find(m => m.id === targetModuleId);

  if (!sourceModule || !targetModule) return;

  const sourceItemIndex = sourceModule.items.findIndex(i => i.id === draggedModuleItem.itemId);
  if (sourceItemIndex === -1) return;

  const [movedItem] = sourceModule.items.splice(sourceItemIndex, 1);

  if (targetEl) {
    const targetItemId = targetEl.dataset.itemId;
    const targetItemIndex = targetModule.items.findIndex(i => i.id === targetItemId);
    targetModule.items.splice(targetItemIndex, 0, movedItem);
  } else {
    targetModule.items.push(movedItem);
  }

  // Update positions
  sourceModule.items.forEach((item, i) => item.position = i);
  targetModule.items.forEach((item, i) => item.position = i);

  saveData(appData);
  renderModules();
}

function handleModuleItemDragEnd(event) {
  event.target.classList.remove('dragging');
  draggedModuleItem = null;
}

function openModuleModal(moduleId = null) {
  generateModals();
  const module = moduleId ? appData.modules.find(m => m.id === moduleId) : null;

  document.getElementById('moduleModalTitle').textContent = module ? 'Edit Module' : 'New Module';
  document.getElementById('moduleName').value = module ? module.name : '';
  document.getElementById('moduleId').value = moduleId || '';

  openModal('moduleModal');
}

async function saveModule() {
  const moduleId = document.getElementById('moduleId').value;
  const name = document.getElementById('moduleName').value.trim();

  if (!name) {
    showToast('Module name is required', 'error');
    return;
  }

  if (!appData.modules) appData.modules = [];

  if (moduleId) {
    // Update existing module
    const module = appData.modules.find(m => m.id === moduleId);
    if (module) {
      module.name = name;
      await supabaseUpdateModule(module);
    }
  } else {
    // Create new module
    const courseModules = appData.modules.filter(m => m.courseId === activeCourseId);
    const maxPosition = courseModules.length > 0 ? Math.max(...courseModules.map(m => m.position)) + 1 : 0;

    const newModule = {
      id: generateId(),
      courseId: activeCourseId,
      name: name,
      position: maxPosition,
      items: []
    };

    await supabaseCreateModule(newModule);
    appData.modules.push(newModule);
  }

  saveData(appData);
  closeModal('moduleModal');
  renderModules();
  showToast(moduleId ? 'Module updated!' : 'Module created!', 'success');
}

function editModule(moduleId) {
  openModuleModal(moduleId);
}

function deleteModule(moduleId) {
  confirm('Delete this module and all its items?', async () => {
    // Delete from Supabase
    await supabaseDeleteModule(moduleId);

    // Update local state
    appData.modules = appData.modules.filter(m => m.id !== moduleId);
    saveData(appData);
    renderModules();
    showToast('Module deleted', 'success');
  });
}

async function toggleModuleVisibility(moduleId) {
  const module = appData.modules.find(m => m.id === moduleId);
  if (!module) return;

  const originalHidden = module.hidden;
  module.hidden = !module.hidden;

  // Persist to Supabase
  const result = await supabaseUpdateModule(module);
  if (!result) {
    // Rollback on failure
    module.hidden = originalHidden;
    showToast('Failed to update module visibility', 'error');
    return;
  }

  saveData(appData);
  renderModules();
  showToast(module.hidden ? 'Module hidden from students' : 'Module visible to students', 'info');
}

async function toggleFileVisibility(fileId) {
  const file = appData.files.find(f => f.id === fileId);
  if (!file) return;

  const originalHidden = file.hidden;
  file.hidden = !file.hidden;

  // Persist to Supabase
  const result = await supabaseUpdateFile(file);
  if (!result) {
    // Rollback on failure
    file.hidden = originalHidden;
    showToast('Failed to update file visibility', 'error');
    return;
  }

  saveData(appData);
  renderModules();
  renderFiles();
  showToast(file.hidden ? 'File hidden from students' : 'File visible to students', 'info');
}

function openAddModuleItemModal(moduleId) {
  generateModals();
  document.getElementById('addItemModuleId').value = moduleId;
  document.getElementById('addItemType').value = 'assignment';
  updateAddItemOptions();
  openModal('addModuleItemModal');
}

function updateAddItemOptions() {
  const type = document.getElementById('addItemType').value;
  const select = document.getElementById('addItemRef');

  let options = [];

  if (type === 'assignment') {
    const assignments = appData.assignments.filter(a => a.courseId === activeCourseId);
    options = assignments.map(a => `<option value="${a.id}">${a.title}${a.status === 'draft' ? ' (draft)' : ''}</option>`);
  } else if (type === 'quiz') {
    const quizzes = appData.quizzes.filter(q => q.courseId === activeCourseId);
    options = quizzes.map(q => `<option value="${q.id}">${q.title}${q.status === 'draft' ? ' (draft)' : ''}</option>`);
  } else if (type === 'file') {
    const files = appData.files.filter(f => f.courseId === activeCourseId);
    options = files.map(f => `<option value="${f.id}">${f.name}</option>`);
  }

  select.innerHTML = options.length > 0 ? options.join('') : '<option value="">No items available</option>';
}

async function addModuleItem() {
  const moduleId = document.getElementById('addItemModuleId').value;
  const type = document.getElementById('addItemType').value;
  const refId = document.getElementById('addItemRef').value;

  if (!refId) {
    showToast('Please select an item to add', 'error');
    return;
  }

  const module = appData.modules.find(m => m.id === moduleId);
  if (!module) return;

  // Check if item already exists in module
  if (module.items.some(i => i.refId === refId && i.type === type)) {
    showToast('This item is already in the module', 'error');
    return;
  }

  const maxPosition = module.items.length > 0 ? Math.max(...module.items.map(i => i.position)) + 1 : 0;

  const newItem = {
    id: generateId(),
    type: type,
    refId: refId,
    position: maxPosition
  };

  // Save to Supabase
  await supabaseCreateModuleItem(newItem, moduleId);

  // Update local state
  module.items.push(newItem);
  saveData(appData);

  closeModal('addModuleItemModal');
  renderModules();
  showToast('Item added to module!', 'success');
}

async function removeModuleItem(moduleId, itemId) {
  const module = appData.modules.find(m => m.id === moduleId);
  if (!module) return;

  // Delete from Supabase
  await supabaseDeleteModuleItem(itemId);

  // Update local state
  module.items = module.items.filter(i => i.id !== itemId);
  module.items.forEach((item, i) => item.position = i);

  saveData(appData);
  renderModules();
  showToast('Item removed from module', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI SYLLABUS PARSER
// ═══════════════════════════════════════════════════════════════════════════════

function openSyllabusParserModal() {
  generateModals();
  document.getElementById('syllabusFile').value = '';
  document.getElementById('syllabusText').value = '';
  document.getElementById('syllabusParsedPreview').innerHTML = '<div class="muted">Upload a syllabus or paste text to extract modules and assignments</div>';
  openModal('syllabusParserModal');
}

async function parseSyllabus() {
  const apiKey = window.GEMINI_API_KEY || appData.settings.geminiKey;
  if (!apiKey) {
    showToast('Gemini API key not configured. Add GEMINI_API_KEY to config.js or configure in Settings.', 'error');
    return;
  }

  const fileInput = document.getElementById('syllabusFile');
  const textInput = document.getElementById('syllabusText').value.trim();

  const systemPrompt = `You are analyzing a course syllabus. Extract all assignments, modules/units, readings, and due dates. Return ONLY valid JSON with the following structure:
{
  "courseInfo": {
    "name": "Course name if found",
    "code": "Course code if found (e.g., ECON 101)",
    "instructor": "Instructor name if found",
    "description": "Course description if found"
  },
  "modules": [
    {
      "name": "Module/Week/Unit name",
      "items": [
        {
          "type": "assignment" | "quiz" | "reading",
          "title": "Item title",
          "description": "Brief description if available",
          "dueDate": "ISO date string if available, or null",
          "points": "number if available, or 100"
        }
      ]
    }
  ]
}

IMPORTANT RULES:
1. Extract EACH reading/textbook chapter/article as a SEPARATE item with type "reading"
   - If syllabus says "Read chapters 1-3", create THREE separate reading items: "Chapter 1", "Chapter 2", "Chapter 3"
   - If syllabus lists "Smith (2020), Jones (2019)", create TWO separate reading items
2. For exams, quizzes, midterms, finals, or tests: set type to "quiz"
3. For homework, problem sets, essays, papers, projects: set type to "assignment"
4. Group items by week/module/unit as presented in the syllabus
5. Extract course metadata (name, code, instructor) if available at the top of the syllabus`;

  let requestBody;

  // If file uploaded, send as base64 inline data to Gemini
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || 'application/octet-stream';

      requestBody = {
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            { text: systemPrompt }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      };
    } catch (err) {
      showToast('Could not read file: ' + err.message, 'error');
      return;
    }
  } else if (textInput) {
    // Use pasted text
    requestBody = {
      contents: [{ parts: [{ text: systemPrompt + '\n\nSYLLABUS:\n' + textInput }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    };
  } else {
    showToast('Please upload a syllabus file or paste syllabus text', 'error');
    return;
  }

  try {
    // Show processing notification with warning
    const preview = document.getElementById('syllabusParsedPreview');
    preview.innerHTML = `
      <div style="text-align:center; padding:40px;">
        <div class="ai-spinner" style="margin:0 auto 16px;"></div>
        <div style="font-weight:600; margin-bottom:8px;">🔄 Parsing syllabus with AI...</div>
        <div class="muted">This may take up to a minute. Please do not close this window.</div>
      </div>
    `;
    showToast('Parsing syllabus... please wait', 'info');

    // Use retry logic
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      },
      3
    );

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    const text = data.candidates[0].content.parts[0].text;
    const parsed = parseAiJsonResponse(text);

    renderSyllabusParsedPreview(parsed);
    showToast('Syllabus parsed! Review and import.', 'success');

  } catch (err) {
    console.error('Syllabus parsing error:', err);
    showToast('Syllabus parsing failed: ' + err.message, 'error');
    const preview = document.getElementById('syllabusParsedPreview');
    preview.innerHTML = `<div class="muted">Parsing failed. Please try again.</div>`;
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

let parsedSyllabusData = null;

function renderSyllabusParsedPreview(parsed) {
  parsedSyllabusData = parsed;
  const preview = document.getElementById('syllabusParsedPreview');

  if (!parsed || !parsed.modules || parsed.modules.length === 0) {
    preview.innerHTML = '<div class="muted">No modules found in syllabus</div>';
    return;
  }

  const getItemIcon = (type) => {
    switch(type) {
      case 'quiz': return '❓';
      case 'reading': return '📖';
      case 'file': return '📄';
      default: return '📝';
    }
  };

  const getItemLabel = (type) => {
    switch(type) {
      case 'quiz': return 'Quiz';
      case 'reading': return 'Reading';
      case 'file': return 'File';
      default: return 'Assignment';
    }
  };

  // Show course info if extracted
  let courseInfoHtml = '';
  if (parsed.courseInfo) {
    const info = parsed.courseInfo;
    const hasInfo = info.name || info.code || info.instructor;
    if (hasInfo) {
      courseInfoHtml = `
        <div class="card" style="margin-bottom:16px; background:var(--primary-light);">
          <div class="card-header"><strong>Course Information Detected</strong></div>
          <div style="padding:12px;">
            ${info.name ? `<div><strong>Name:</strong> ${escapeHtml(info.name)}</div>` : ''}
            ${info.code ? `<div><strong>Code:</strong> ${escapeHtml(info.code)}</div>` : ''}
            ${info.instructor ? `<div><strong>Instructor:</strong> ${escapeHtml(info.instructor)}</div>` : ''}
            ${info.description ? `<div style="margin-top:8px;"><strong>Description:</strong> ${escapeHtml(info.description.substring(0, 200))}${info.description.length > 200 ? '...' : ''}</div>` : ''}
          </div>
        </div>
      `;
    }
  }

  // Count items by type
  let readingCount = 0, assignmentCount = 0, quizCount = 0;
  parsed.modules.forEach(mod => {
    (mod.items || []).forEach(item => {
      if (item.type === 'reading') readingCount++;
      else if (item.type === 'quiz') quizCount++;
      else assignmentCount++;
    });
  });

  const summaryHtml = `
    <div style="margin-bottom:12px; padding:8px 12px; background:var(--bg-color); border-radius:var(--radius); font-size:0.9rem;">
      Found: <strong>${parsed.modules.length}</strong> modules,
      <strong>${readingCount}</strong> readings,
      <strong>${assignmentCount}</strong> assignments,
      <strong>${quizCount}</strong> quizzes
    </div>
  `;

  const html = parsed.modules.map((mod, modIndex) => `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-header">
        <label style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" checked data-module-index="${modIndex}" class="syllabus-module-check">
          <strong>${escapeHtml(mod.name)}</strong>
          <span class="muted" style="font-size:0.85rem;">(${(mod.items || []).length} items)</span>
        </label>
      </div>
      <div style="padding:12px;">
        ${(mod.items || []).map((item, itemIndex) => `
          <label style="display:flex; align-items:center; gap:8px; padding:4px 0; flex-wrap:wrap;">
            <input type="checkbox" checked data-module-index="${modIndex}" data-item-index="${itemIndex}" class="syllabus-item-check">
            <span>${getItemIcon(item.type)}</span>
            <span>${escapeHtml(item.title)}</span>
            <span style="padding:2px 6px; background:var(--${item.type === 'reading' ? 'primary' : 'warning'}-light); color:var(--${item.type === 'reading' ? 'primary' : 'warning'}); border-radius:4px; font-size:0.7rem;">${getItemLabel(item.type)}</span>
            ${item.dueDate ? `<span class="muted" style="font-size:0.85rem;">Due: ${new Date(item.dueDate).toLocaleDateString()}</span>` : ''}
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  preview.innerHTML = courseInfoHtml + summaryHtml + html + `
    <div class="hint" style="margin:16px 0; padding:12px; background:var(--primary-light); border-radius:var(--radius);">
      <strong>💡 Placeholders will be created as hidden (draft) by default.</strong><br>
      You can edit them, use AI to fill in content, or upload files. Click the visibility badge on each item to publish when ready.
    </div>
    <button class="btn btn-primary" onclick="importParsedSyllabus()" style="margin-top:8px;">Import Selected Items</button>
  `;
}

function importParsedSyllabus() {
  if (!parsedSyllabusData || !parsedSyllabusData.modules) {
    showToast('No parsed data to import', 'error');
    return;
  }

  if (!appData.modules) appData.modules = [];

  let modulesCreated = 0;
  let itemsCreated = 0;
  let placeholdersCreated = 0;

  const checkedModules = document.querySelectorAll('.syllabus-module-check:checked');
  const checkedModuleIndices = new Set(Array.from(checkedModules).map(el => parseInt(el.dataset.moduleIndex)));

  const checkedItems = document.querySelectorAll('.syllabus-item-check:checked');
  const checkedItemsMap = {};
  checkedItems.forEach(el => {
    const modIdx = parseInt(el.dataset.moduleIndex);
    const itemIdx = parseInt(el.dataset.itemIndex);
    if (!checkedItemsMap[modIdx]) checkedItemsMap[modIdx] = new Set();
    checkedItemsMap[modIdx].add(itemIdx);
  });

  parsedSyllabusData.modules.forEach((mod, modIndex) => {
    if (!checkedModuleIndices.has(modIndex)) return;

    const courseModules = appData.modules.filter(m => m.courseId === activeCourseId);
    const maxPosition = courseModules.length > 0 ? Math.max(...courseModules.map(m => m.position)) + 1 : 0;

    const newModule = {
      id: generateId(),
      courseId: activeCourseId,
      name: mod.name,
      position: maxPosition + modulesCreated,
      items: []
    };

    (mod.items || []).forEach((item, itemIndex) => {
      if (!checkedItemsMap[modIndex] || !checkedItemsMap[modIndex].has(itemIndex)) return;

      let refId = null;

      if (item.type === 'quiz') {
        // Create quiz placeholder
        const newQuiz = {
          id: generateId(),
          courseId: activeCourseId,
          title: item.title,
          description: item.description || '📌 Placeholder - use AI or edit manually to add questions',
          status: 'draft',
          dueDate: item.dueDate || new Date(Date.now() + 86400000 * 14).toISOString(),
          createdAt: new Date().toISOString(),
          timeLimit: 30,
          attempts: 1,
          randomizeQuestions: false,
          questionPoolEnabled: false,
          questionSelectCount: 0,
          questions: [],
          isPlaceholder: true  // Mark as placeholder
        };
        appData.quizzes.push(newQuiz);
        refId = newQuiz.id;
        placeholdersCreated++;

        newModule.items.push({
          id: generateId(),
          type: 'quiz',
          refId: refId,
          position: newModule.items.length
        });
      } else if (item.type === 'reading' || item.type === 'file') {
        // Create file placeholder
        const newFile = {
          id: generateId(),
          courseId: activeCourseId,
          name: item.title,
          type: 'placeholder',
          size: 0,
          visible: false,  // Hidden by default
          isPlaceholder: true,
          description: item.description || '',
          uploadedBy: appData.currentUser.id,
          uploadedAt: new Date().toISOString()
        };
        appData.files.push(newFile);
        refId = newFile.id;
        placeholdersCreated++;

        newModule.items.push({
          id: generateId(),
          type: 'file',
          refId: refId,
          position: newModule.items.length
        });
      } else {
        // Create assignment placeholder
        const newAssignment = {
          id: generateId(),
          courseId: activeCourseId,
          title: item.title,
          description: item.description || '📌 Placeholder - edit to add full assignment details',
          points: item.points || 100,
          status: 'draft',
          dueDate: item.dueDate || new Date(Date.now() + 86400000 * 14).toISOString(),
          createdAt: new Date().toISOString(),
          allowLateSubmissions: true,
          lateDeduction: 10,
          allowResubmission: false,
          category: 'homework',
          rubric: null,
          isPlaceholder: true  // Mark as placeholder
        };
        appData.assignments.push(newAssignment);
        refId = newAssignment.id;
        placeholdersCreated++;

        newModule.items.push({
          id: generateId(),
          type: 'assignment',
          refId: refId,
          position: newModule.items.length
        });
      }

      itemsCreated++;
    });

    appData.modules.push(newModule);
    modulesCreated++;
  });

  saveData(appData);
  closeModal('syllabusParserModal');
  renderModules();
  renderAssignments();
  renderFiles();
  showToast(`Imported ${modulesCreated} modules with ${placeholdersCreated} placeholders! Click visibility badges to publish.`, 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI AUDIO INPUT
// ═══════════════════════════════════════════════════════════════════════════════

function openAudioInputModal() {
  generateModals();
  document.getElementById('audioFile').value = '';
  document.getElementById('audioPreview').innerHTML = '';
  document.getElementById('audioTranscription').value = '';
  document.getElementById('audioOutputType').value = 'announcement';
  document.getElementById('audioParsedPreview').innerHTML = '<div class="muted">Record or upload audio to transcribe and create LMS objects</div>';
  updateAudioRecordingState(false);
  openModal('audioInputModal');
}

function updateAudioRecordingState(isRecording) {
  const startBtn = document.getElementById('audioStartRecording');
  const stopBtn = document.getElementById('audioStopRecording');

  if (startBtn) startBtn.style.display = isRecording ? 'none' : 'inline-flex';
  if (stopBtn) stopBtn.style.display = isRecording ? 'inline-flex' : 'none';
}

async function startAudioRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);

      document.getElementById('audioPreview').innerHTML = `
        <audio controls src="${audioUrl}" style="width:100%;"></audio>
        <div class="muted" style="margin-top:8px;">Recording complete. Click "Transcribe" to process.</div>
      `;

      // Store blob for later use
      document.getElementById('audioPreview').dataset.audioBlob = audioUrl;
      window.lastRecordedAudioBlob = audioBlob;

      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    updateAudioRecordingState(true);
    showToast('Recording started...', 'info');

  } catch (err) {
    console.error('Audio recording error:', err);
    showToast('Could not access microphone: ' + err.message, 'error');
  }
}

function stopAudioRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    updateAudioRecordingState(false);
    showToast('Recording stopped', 'success');
  }
}

async function transcribeAudio() {
  const apiKey = window.GEMINI_API_KEY || appData.settings.geminiKey;
  if (!apiKey) {
    showToast('Gemini API key not configured. Add GEMINI_API_KEY to config.js or configure in Settings.', 'error');
    return;
  }

  let audioData = null;
  let mimeType = 'audio/webm';

  // Check for uploaded file first
  const fileInput = document.getElementById('audioFile');
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    mimeType = file.type || 'audio/webm';
    audioData = await fileToBase64(file);
  } else if (window.lastRecordedAudioBlob) {
    audioData = await fileToBase64(window.lastRecordedAudioBlob);
  }

  if (!audioData) {
    showToast('Please record or upload audio first', 'error');
    return;
  }

  const outputType = document.getElementById('audioOutputType').value;

  let systemPrompt = '';
  if (outputType === 'announcement') {
    systemPrompt = `Transcribe this audio and convert it into a course announcement. The user may specify timing like "send at midnight tomorrow" or "post this now".

FORMATTING for content (supports markdown):
- Use **bold** for emphasis, *italic* for terms
- Use bullet lists with "- item" format
- Use headers with ## or ###
- Embed YouTube videos by placing the full URL on its own line
- Use \`code\` for inline code

Return ONLY valid JSON:
{
  "transcription": "The full transcription of the audio",
  "announcement": {
    "title": "A clear title for the announcement",
    "content": "The announcement content with markdown formatting as appropriate",
    "scheduledFor": "ISO date string if a specific time was mentioned, or null for immediate"
  }
}`;
  } else {
    systemPrompt = `Transcribe this audio and convert it into a quiz. The user may specify details like "five questions", "due at 2pm on Dec 18", "available immediately", "randomized order", "pull from question bank". Return ONLY valid JSON:
{
  "transcription": "The full transcription of the audio",
  "quiz": {
    "title": "Quiz title",
    "description": "Quiz description",
    "dueDate": "ISO date string if mentioned",
    "availableFrom": "ISO date string if mentioned, or null for immediate",
    "timeLimit": "number in minutes if mentioned, or 0 for unlimited",
    "randomizeQuestions": true/false,
    "questionBankName": "Name of question bank if mentioned, or null",
    "questionCount": "number of questions to include"
  }
}`;
  }

  try {
    showToast('Transcribing audio with Gemini...', 'info');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: audioData
              }
            },
            { text: systemPrompt }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    const text = data.candidates[0].content.parts[0].text;
    const parsed = parseAiJsonResponse(text);

    // Show transcription
    document.getElementById('audioTranscription').value = parsed.transcription || '';

    // Render preview
    renderAudioParsedPreview(parsed, outputType);
    showToast('Audio transcribed successfully!', 'success');

  } catch (err) {
    console.error('Audio transcription error:', err);
    showToast('Transcription failed: ' + err.message, 'error');
  }
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let parsedAudioData = null;

function renderAudioParsedPreview(parsed, outputType) {
  parsedAudioData = { ...parsed, outputType };
  const preview = document.getElementById('audioParsedPreview');

  if (outputType === 'announcement' && parsed.announcement) {
    const ann = parsed.announcement;
    preview.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(ann.title || 'Untitled')}</div>
        </div>
        <div class="markdown-content">${renderMarkdown(ann.content || '')}</div>
        ${ann.scheduledFor ? `<div class="muted" style="margin-top:12px;">📅 Scheduled for: ${new Date(ann.scheduledFor).toLocaleString()}</div>` : '<div class="muted" style="margin-top:12px;">📤 Ready to post immediately</div>'}
      </div>
      <button class="btn btn-primary" onclick="applyAudioParsedResult()" style="margin-top:16px;">Create Announcement</button>
    `;
  } else if (outputType === 'quiz' && parsed.quiz) {
    const quiz = parsed.quiz;
    preview.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(quiz.title || 'Untitled Quiz')}</div>
        </div>
        <div class="markdown-content">${renderMarkdown(quiz.description || '')}</div>
        <div style="margin-top:12px;">
          ${quiz.dueDate ? `<div class="muted">📅 Due: ${new Date(quiz.dueDate).toLocaleString()}</div>` : ''}
          ${quiz.availableFrom ? `<div class="muted">🔓 Available from: ${new Date(quiz.availableFrom).toLocaleString()}</div>` : '<div class="muted">🔓 Available immediately</div>'}
          ${quiz.timeLimit ? `<div class="muted">⏱️ Time limit: ${quiz.timeLimit} minutes</div>` : ''}
          ${quiz.randomizeQuestions ? '<div class="muted">🔀 Questions randomized</div>' : ''}
          ${quiz.questionBankName ? `<div class="muted">📚 Pull from: ${escapeHtml(quiz.questionBankName)}</div>` : ''}
          ${quiz.questionCount ? `<div class="muted">📝 ${quiz.questionCount} questions</div>` : ''}
        </div>
      </div>
      <button class="btn btn-primary" onclick="applyAudioParsedResult()" style="margin-top:16px;">Create Quiz</button>
    `;
  } else {
    preview.innerHTML = '<div class="muted">Could not parse audio content</div>';
  }
}

function applyAudioParsedResult() {
  if (!parsedAudioData) {
    showToast('No parsed data to apply', 'error');
    return;
  }

  if (parsedAudioData.outputType === 'announcement' && parsedAudioData.announcement) {
    const ann = parsedAudioData.announcement;

    appData.announcements.push({
      id: generateId(),
      courseId: activeCourseId,
      title: ann.title || 'Untitled Announcement',
      content: ann.content || '',
      pinned: false,
      authorId: appData.currentUser.id,
      createdAt: new Date().toISOString(),
      scheduledFor: ann.scheduledFor || null
    });

    saveData(appData);
    closeModal('audioInputModal');
    renderUpdates();
    showToast('Announcement created!', 'success');

  } else if (parsedAudioData.outputType === 'quiz' && parsedAudioData.quiz) {
    const quiz = parsedAudioData.quiz;

    const newQuiz = {
      id: generateId(),
      courseId: activeCourseId,
      title: quiz.title || 'Untitled Quiz',
      description: quiz.description || '',
      status: 'draft',
      dueDate: quiz.dueDate || new Date(Date.now() + 86400000 * 7).toISOString(),
      createdAt: new Date().toISOString(),
      timeLimit: quiz.timeLimit || 0,
      attempts: 1,
      randomizeQuestions: quiz.randomizeQuestions || false,
      questionPoolEnabled: !!quiz.questionBankName,
      questionSelectCount: quiz.questionCount || 5,
      questions: []
    };

    appData.quizzes.push(newQuiz);
    saveData(appData);
    closeModal('audioInputModal');

    // Open quiz editor
    openQuizModal(newQuiz.id);
    showToast('Quiz created! Add questions to complete it.', 'success');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPEEDGRADER
// ═══════════════════════════════════════════════════════════════════════════════

function openSpeedGrader(assignmentId) {
  currentSpeedGraderAssignmentId = assignmentId;

  const assignment = appData.assignments.find(a => a.id === assignmentId);
  if (!assignment) {
    showToast('Assignment not found', 'error');
    return;
  }

  // Get all students who have submitted
  const submissions = appData.submissions.filter(s => s.assignmentId === assignmentId);
  const studentIds = [...new Set(submissions.map(s => s.userId))];

  // Get all enrolled students for this course
  const enrolledStudents = appData.enrollments
    .filter(e => e.courseId === assignment.courseId && e.role === 'student')
    .map(e => e.userId);

  // Create list of all students (submitted + not submitted)
  speedGraderStudents = enrolledStudents.map(userId => {
    const user = getUserById(userId);
    const submission = submissions.find(s => s.userId === userId);
    const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;

    return {
      userId,
      user,
      submission,
      grade
    };
  }).sort((a, b) => {
    // Sort by: ungraded with submission first, then graded, then no submission
    const aScore = a.submission ? (a.grade ? 2 : 0) : 3;
    const bScore = b.submission ? (b.grade ? 2 : 0) : 3;
    return aScore - bScore;
  });

  currentSpeedGraderStudentIndex = 0;

  generateModals();
  renderSpeedGrader();
  openModal('speedGraderModal');
}

function renderSpeedGrader() {
  const assignment = appData.assignments.find(a => a.id === currentSpeedGraderAssignmentId);
  if (!assignment || speedGraderStudents.length === 0) {
    showToast('No students to grade', 'error');
    closeModal('speedGraderModal');
    return;
  }

  const current = speedGraderStudents[currentSpeedGraderStudentIndex];
  const student = current.user;
  const submission = current.submission;
  const grade = current.grade;

  // Count graded vs total
  const gradedCount = speedGraderStudents.filter(s => s.grade).length;
  const submittedCount = speedGraderStudents.filter(s => s.submission).length;

  document.getElementById('speedGraderTitle').textContent = `SpeedGrader: ${assignment.title}`;

  document.getElementById('speedGraderNav').innerHTML = `
    <button class="btn btn-secondary" onclick="speedGraderPrev()" ${currentSpeedGraderStudentIndex === 0 ? 'disabled' : ''}>← Previous</button>
    <div class="speedgrader-progress">
      <span>${currentSpeedGraderStudentIndex + 1} of ${speedGraderStudents.length}</span>
      <span class="muted">(${gradedCount} graded / ${submittedCount} submitted)</span>
    </div>
    <button class="btn btn-secondary" onclick="speedGraderNext()" ${currentSpeedGraderStudentIndex === speedGraderStudents.length - 1 ? 'disabled' : ''}>Next →</button>
  `;

  // Student selector dropdown
  document.getElementById('speedGraderStudentSelect').innerHTML = speedGraderStudents.map((s, i) => {
    const status = s.grade ? '✓' : (s.submission ? '○' : '—');
    return `<option value="${i}" ${i === currentSpeedGraderStudentIndex ? 'selected' : ''}>${status} ${s.user ? s.user.name : 'Unknown'}</option>`;
  }).join('');

  // Student info
  document.getElementById('speedGraderStudentInfo').innerHTML = `
    <div class="user-avatar" style="width:48px; height:48px; font-size:1.2rem;">${student ? student.avatar : '?'}</div>
    <div>
      <div style="font-weight:600; font-size:1.1rem;">${student ? student.name : 'Unknown Student'}</div>
      <div class="muted">${student ? student.email : ''}</div>
    </div>
  `;

  // Submission content
  if (submission) {
    const lateDeduction = calculateLateDeduction(assignment, submission.submittedAt);
    const isLate = lateDeduction > 0;

    document.getElementById('speedGraderSubmission').innerHTML = `
      <div class="submission-header">
        <span>Submitted: ${formatDate(submission.submittedAt)}</span>
        ${isLate ? `<span class="status-badge" style="background:var(--warning);">⚠️ LATE (-${lateDeduction}%)</span>` : ''}
        ${submission.fileName ? `<span class="muted">📎 ${submission.fileName}</span>` : ''}
      </div>
      <div class="submission-content">${submission.text || '<em class="muted">No text submission</em>'}</div>
    `;
  } else {
    document.getElementById('speedGraderSubmission').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">No submission yet</div>
      </div>
    `;
  }

  // Rubric if exists
  const rubric = assignment.rubric ? appData.rubrics.find(r => r.id === assignment.rubric) : null;
  if (rubric && rubric.criteria) {
    document.getElementById('speedGraderRubric').innerHTML = `
      <div class="rubric-section">
        <h4>Rubric</h4>
        ${rubric.criteria.map((c, i) => `
          <div class="rubric-criterion">
            <div class="rubric-criterion-header">
              <span>${escapeHtml(c.name)}</span>
              <span>${c.points} pts</span>
            </div>
            <input type="number" class="form-input rubric-score-input" id="rubricScore_${i}"
                   data-max="${c.points}" min="0" max="${c.points}"
                   value="${grade ? (grade.rubricScores && grade.rubricScores[i] !== undefined ? grade.rubricScores[i] : '') : ''}"
                   placeholder="0-${c.points}">
            <div class="muted" style="font-size:0.85rem;">${escapeHtml(c.description || '')}</div>
          </div>
        `).join('')}
        <button class="btn btn-secondary btn-sm" onclick="calculateSpeedGraderRubricTotal()" style="margin-top:8px;">Calculate Total</button>
      </div>
    `;
  } else {
    document.getElementById('speedGraderRubric').innerHTML = '';
  }

  // Grade form
  document.getElementById('speedGraderScore').value = grade ? grade.score : '';
  document.getElementById('speedGraderScore').max = assignment.points;
  document.getElementById('speedGraderScoreMax').textContent = `/ ${assignment.points}`;
  document.getElementById('speedGraderFeedback').value = grade ? grade.feedback : '';
  document.getElementById('speedGraderRelease').checked = grade ? grade.released : false;

  // Disable grading if no submission
  const gradeBtn = document.getElementById('speedGraderSaveBtn');
  const aiBtn = document.getElementById('speedGraderAiBtn');
  if (!submission) {
    gradeBtn.disabled = true;
    aiBtn.disabled = true;
  } else {
    gradeBtn.disabled = false;
    aiBtn.disabled = false;
  }
}

function speedGraderSelectStudent(index) {
  currentSpeedGraderStudentIndex = parseInt(index);
  renderSpeedGrader();
}

function speedGraderPrev() {
  if (currentSpeedGraderStudentIndex > 0) {
    currentSpeedGraderStudentIndex--;
    renderSpeedGrader();
  }
}

function speedGraderNext() {
  if (currentSpeedGraderStudentIndex < speedGraderStudents.length - 1) {
    currentSpeedGraderStudentIndex++;
    renderSpeedGrader();
  }
}

function calculateSpeedGraderRubricTotal() {
  const rubricInputs = document.querySelectorAll('.rubric-score-input');
  let total = 0;

  rubricInputs.forEach(input => {
    const val = parseFloat(input.value) || 0;
    const max = parseFloat(input.dataset.max) || 0;
    total += Math.min(val, max);
  });

  document.getElementById('speedGraderScore').value = total;
}

async function speedGraderDraftWithAI() {
  const current = speedGraderStudents[currentSpeedGraderStudentIndex];
  if (!current.submission) {
    showToast('No submission to grade', 'error');
    return;
  }

  const apiKey = window.GEMINI_API_KEY || appData.settings.geminiKey;
  if (!apiKey) {
    showToast('Gemini API key not configured', 'error');
    return;
  }

  const assignment = appData.assignments.find(a => a.id === currentSpeedGraderAssignmentId);
  const rubric = assignment.rubric ? appData.rubrics.find(r => r.id === assignment.rubric) : null;

  let rubricContext = '';
  if (rubric && rubric.criteria) {
    rubricContext = '\n\nRubric criteria:\n' + rubric.criteria.map(c => `- ${c.name} (${c.points} pts): ${c.description}`).join('\n');
  }

  const prompt = `Grade this student submission for the assignment "${assignment.title}".
Assignment description: ${assignment.description}
Max points: ${assignment.points}
${rubricContext}

Student submission:
${current.submission.text || 'No text submitted'}

Provide a score (0-${assignment.points}) and constructive feedback. Return JSON:
{"score": <number>, "feedback": "<string>"}`;

  try {
    showToast('Drafting grade with AI...', 'info');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const result = parseAiJsonResponse(data.candidates[0].content.parts[0].text);

    document.getElementById('speedGraderScore').value = result.score;
    document.getElementById('speedGraderFeedback').value = result.feedback;
    showToast('AI draft ready! Review and save.', 'success');

  } catch (err) {
    console.error('AI grading error:', err);
    showToast('AI drafting failed: ' + err.message, 'error');
  }
}

function saveSpeedGraderGrade() {
  const current = speedGraderStudents[currentSpeedGraderStudentIndex];
  if (!current.submission) {
    showToast('No submission to grade', 'error');
    return;
  }

  const score = parseFloat(document.getElementById('speedGraderScore').value);
  const feedback = document.getElementById('speedGraderFeedback').value.trim();
  const release = document.getElementById('speedGraderRelease').checked;

  if (isNaN(score)) {
    showToast('Please enter a valid score', 'error');
    return;
  }

  const assignment = appData.assignments.find(a => a.id === currentSpeedGraderAssignmentId);

  // Apply late deduction if applicable
  let finalScore = score;
  const lateDeduction = calculateLateDeduction(assignment, current.submission.submittedAt);
  if (lateDeduction > 0) {
    finalScore = Math.round(score * (1 - lateDeduction / 100) * 10) / 10;
  }

  // Get rubric scores if applicable
  let rubricScores = null;
  const rubricInputs = document.querySelectorAll('.rubric-score-input');
  if (rubricInputs.length > 0) {
    rubricScores = Array.from(rubricInputs).map(input => parseFloat(input.value) || 0);
  }

  // Remove existing grade
  appData.grades = appData.grades.filter(g => g.submissionId !== current.submission.id);

  // Add new grade
  const gradeObj = {
    submissionId: current.submission.id,
    score: finalScore,
    feedback: feedback,
    released: release,
    gradedBy: appData.currentUser.id,
    gradedAt: new Date().toISOString()
  };

  if (rubricScores) {
    gradeObj.rubricScores = rubricScores;
  }

  appData.grades.push(gradeObj);

  // Update local state
  current.grade = gradeObj;

  saveData(appData);
  showToast(`Grade saved${lateDeduction > 0 ? ` (${lateDeduction}% late penalty applied)` : ''}!`, 'success');

  // Auto-advance to next ungraded
  const nextUngraded = speedGraderStudents.findIndex((s, i) => i > currentSpeedGraderStudentIndex && s.submission && !s.grade);
  if (nextUngraded !== -1) {
    currentSpeedGraderStudentIndex = nextUngraded;
    renderSpeedGrader();
  } else {
    renderSpeedGrader();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILES PAGE
// ═══════════════════════════════════════════════════════════════════════════════

let filesSearch = '';
let filesSort = 'date-desc';

function updateFilesSearch(value) {
  filesSearch = value.toLowerCase();
  renderFiles();
}

function updateFilesSort(value) {
  filesSort = value;
  renderFiles();
}

function renderFiles() {
  if (!activeCourseId) {
    setText('filesSubtitle', 'Select a course');
    setHTML('filesActions', '');
    setHTML('filesList', '<div class="empty-state-text">No active course</div>');
    return;
  }

  const course = getCourseById(activeCourseId);
  setText('filesSubtitle', course.name);

  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);

  // Actions with search and sort
  setHTML('filesActions', `
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
      <input type="text" class="form-input" placeholder="Search files..." value="${escapeHtml(filesSearch)}" onkeyup="updateFilesSearch(this.value)" style="width:200px;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      <select class="form-select" onchange="updateFilesSort(this.value)" style="width:150px;">
        <option value="date-desc" ${filesSort === 'date-desc' ? 'selected' : ''}>Newest first</option>
        <option value="date-asc" ${filesSort === 'date-asc' ? 'selected' : ''}>Oldest first</option>
        <option value="name-asc" ${filesSort === 'name-asc' ? 'selected' : ''}>Name A-Z</option>
        <option value="name-desc" ${filesSort === 'name-desc' ? 'selected' : ''}>Name Z-A</option>
        <option value="size-desc" ${filesSort === 'size-desc' ? 'selected' : ''}>Largest first</option>
        <option value="size-asc" ${filesSort === 'size-asc' ? 'selected' : ''}>Smallest first</option>
      </select>
      ${isStaffUser ? `<button class="btn btn-primary" onclick="openModal('fileUploadModal')">Upload File</button>` : ''}
    </div>
  `);

  const effectiveStaff = isStaffUser && !studentViewMode;

  let files = appData.files.filter(f => f.courseId === activeCourseId);

  // Hide hidden files from students
  if (!effectiveStaff) {
    files = files.filter(f => !f.hidden);
  }

  // Filter by search
  if (filesSearch) {
    files = files.filter(f => f.name.toLowerCase().includes(filesSearch));
  }

  // Sort
  files.sort((a, b) => {
    switch (filesSort) {
      case 'date-asc': return new Date(a.uploadedAt) - new Date(b.uploadedAt);
      case 'date-desc': return new Date(b.uploadedAt) - new Date(a.uploadedAt);
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'size-asc': return a.size - b.size;
      case 'size-desc': return b.size - a.size;
      default: return 0;
    }
  });

  if (files.length === 0) {
    setHTML('filesList', filesSearch
      ? '<div class="empty-state"><div class="empty-state-text">No files match your search</div></div>'
      : '<div class="empty-state"><div class="empty-state-title">No files yet</div></div>');
    return;
  }

  const html = files.map(f => {
    const uploader = getUserById(f.uploadedBy);
    const isExternal = f.externalUrl;
    const isPlaceholder = f.isPlaceholder;
    const isHidden = f.hidden;

    // Visibility badge for staff
    const visibilityText = isHidden ? 'Hidden' : 'Hide from Students';
    const visibilityBadge = effectiveStaff
      ? `<button class="btn btn-secondary btn-sm" onclick="toggleFileVisibility('${f.id}')" style="padding:2px 8px; margin-left:8px;">${visibilityText}</button>`
      : '';

    const icon = isExternal && f.isYouTube ? '📺' : isExternal ? '🔗' : isPlaceholder ? '📋' : '📄';

    return `
      <div class="card" style="${isPlaceholder ? 'border-style:dashed; opacity:0.9;' : ''} ${isHidden ? 'opacity:0.7;' : ''}">
        <div class="card-header">
          <div style="flex:1;">
            <div class="card-title">${icon} ${escapeHtml(f.name)} ${visibilityBadge}</div>
            <div class="muted">
              ${isExternal ? 'External link' : isPlaceholder ? 'Placeholder - upload or add link' : formatFileSize(f.size)}
              · ${uploader ? 'Added by ' + uploader.name : ''} on ${formatDate(f.uploadedAt)}
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            ${isExternal && f.externalUrl ? `
              <a href="${escapeHtml(f.externalUrl)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">
                ${f.isYouTube ? '▶ Watch' : '🔗 Open'}
              </a>
            ` : ''}
            ${effectiveStaff && isPlaceholder ? `
              <button class="btn btn-secondary btn-sm" onclick="convertPlaceholderToFile('${f.id}')">📎 Upload File</button>
              <button class="btn btn-secondary btn-sm" onclick="convertPlaceholderToLink('${f.id}')">🔗 Add Link</button>
            ` : ''}
            ${effectiveStaff ? `<button class="btn btn-secondary btn-sm" onclick="deleteFile('${f.id}')">Delete</button>` : ''}
          </div>
        </div>
        ${isExternal && f.isYouTube ? `
          <div style="margin-top:12px;">
            <iframe width="100%" height="315" src="${escapeHtml(f.externalUrl)}" frameborder="0" allowfullscreen style="border-radius:var(--radius);"></iframe>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  setHTML('filesList', html);
}

function convertPlaceholderToFile(fileId) {
  const file = appData.files.find(f => f.id === fileId);
  if (!file) return;

  // Open file upload and associate with this placeholder
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      file.name = uploadedFile.name;
      file.type = uploadedFile.name.split('.').pop();
      file.size = uploadedFile.size;
      file.isPlaceholder = false;
      file.hidden = false;
      // Persist to Supabase
      await supabaseUpdateFile(file);
      saveData(appData);
      renderFiles();
      renderModules();
      showToast('File uploaded!', 'success');
    }
  };
  input.click();
}

async function convertPlaceholderToLink(fileId) {
  const file = appData.files.find(f => f.id === fileId);
  if (!file) return;

  // Open prompt for URL
  const url = prompt('Enter external URL (YouTube links will auto-convert to embed):');
  if (url) {
    const convertedUrl = convertYouTubeUrl(url);
    file.externalUrl = convertedUrl;
    file.isYouTube = convertedUrl !== url;
    file.isPlaceholder = false;
    file.type = 'external';
    file.hidden = false;
    // Persist to Supabase
    await supabaseUpdateFile(file);
    saveData(appData);
    renderFiles();
    renderModules();
    showToast('External link added!', 'success');
  }
}

// Store files selected for upload
let pendingUploadFiles = [];

function handleFilesDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropZone = document.getElementById('fileDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = '';
  }

  const files = Array.from(e.dataTransfer.files);
  if (files.length > 50) {
    showToast('Maximum 50 files allowed at once', 'error');
    pendingUploadFiles = files.slice(0, 50);
  } else {
    pendingUploadFiles = files;
  }
  updateFileUploadPreview();
}

function updateFileUploadPreview() {
  const fileInput = document.getElementById('fileUpload');
  const preview = document.getElementById('fileUploadPreview');
  if (!preview) return;

  // If files came from input, use those
  if (fileInput && fileInput.files.length > 0) {
    const files = Array.from(fileInput.files);
    if (files.length > 50) {
      showToast('Maximum 50 files allowed at once', 'error');
      pendingUploadFiles = files.slice(0, 50);
    } else {
      pendingUploadFiles = files;
    }
  }

  if (pendingUploadFiles.length === 0) {
    preview.innerHTML = '';
    return;
  }

  preview.innerHTML = `
    <div style="font-weight:500; margin-bottom:8px;">${pendingUploadFiles.length} file${pendingUploadFiles.length > 1 ? 's' : ''} selected:</div>
    <div style="max-height:150px; overflow-y:auto; border:1px solid var(--border-light); border-radius:var(--radius); padding:8px;">
      ${pendingUploadFiles.map(f => `<div class="muted" style="font-size:0.85rem; padding:2px 0;">📄 ${escapeHtml(f.name)} (${formatFileSize(f.size)})</div>`).join('')}
    </div>
  `;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function uploadFiles() {
  if (pendingUploadFiles.length === 0) {
    showToast('Please select files to upload', 'error');
    return;
  }

  if (!supabaseClient) {
    showToast('Database not connected', 'error');
    return;
  }

  // Verify auth state before attempting upload
  const authUser = await debugAuthState('uploadFiles');
  if (!authUser) {
    console.error('[uploadFiles] Cannot upload: not authenticated');
    showToast('Not authenticated - please sign in again', 'error');
    return;
  }

  const totalFiles = pendingUploadFiles.length;
  showToast(`Uploading ${totalFiles} file${totalFiles > 1 ? 's' : ''}...`, 'info');

  let successCount = 0;
  let errorCount = 0;

  for (const file of pendingUploadFiles) {
    try {
      const fileId = generateId();
      const storagePath = `courses/${activeCourseId}/${fileId}_${file.name}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('course-files')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('[uploadFiles] Storage upload error:', uploadError);
        // If storage bucket doesn't exist, just save metadata
        if (!uploadError.message.includes('Bucket not found') && uploadError.statusCode !== '404') {
          errorCount++;
          continue;
        }
      }

      const fileData = {
        id: fileId,
        courseId: activeCourseId,
        name: file.name,
        type: file.name.split('.').pop(),
        size: file.size,
        storagePath: uploadData?.path || storagePath,
        uploadedBy: appData.currentUser.id,
        uploadedAt: new Date().toISOString()
      };

      // Save metadata to Supabase
      const result = await supabaseCreateFile(fileData);
      if (result) {
        appData.files.push(fileData);
        successCount++;
      } else {
        errorCount++;
      }
    } catch (err) {
      console.error('[uploadFiles] Error uploading file:', file.name, err);
      errorCount++;
    }
  }

  saveData(appData);
  closeModal('fileUploadModal');
  renderFiles();

  // Reset state
  pendingUploadFiles = [];
  const fileInput = document.getElementById('fileUpload');
  if (fileInput) fileInput.value = '';
  const preview = document.getElementById('fileUploadPreview');
  if (preview) preview.innerHTML = '';

  if (errorCount === 0) {
    showToast(`${successCount} file${successCount > 1 ? 's' : ''} uploaded!`, 'success');
  } else {
    showToast(`Uploaded ${successCount}, failed ${errorCount}`, errorCount > successCount ? 'error' : 'warning');
  }
}

// Legacy single file upload function (kept for compatibility)
async function uploadFile() {
  await uploadFiles();
}

function deleteFile(id) {
  confirm('Delete this file?', async () => {
    // Delete from Supabase
    await supabaseDeleteFile(id);

    appData.files = appData.files.filter(f => f.id !== id);
    saveData(appData);
    renderFiles();
    showToast('File deleted', 'success');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRADEBOOK PAGE
// ═══════════════════════════════════════════════════════════════════════════════

let gradebookSearch = '';

function updateGradebookSearch(value) {
  gradebookSearch = value.toLowerCase();
  renderGradebook();
}

function renderGradebook() {
  if (!activeCourseId) {
    setText('gradebookSubtitle', 'Select a course');
    setHTML('gradebookActions', '');
    setHTML('gradebookWrap', '<div class="empty-state-text">No active course</div>');
    return;
  }

  const course = getCourseById(activeCourseId);
  setText('gradebookSubtitle', course.name);

  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);

  if (isStaffUser) {
    renderStaffGradebook();
  } else {
    renderStudentGradebook();
  }
}

function renderStudentGradebook() {
  setHTML('gradebookActions', '');
  
  const assignments = appData.assignments
    .filter(a => a.courseId === activeCourseId && a.status === 'published')
    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
  
  if (assignments.length === 0) {
    setHTML('gradebookWrap', '<div class="empty-state-text">No assignments yet</div>');
    return;
  }
  
  let totalScore = 0;
  let totalPoints = 0;
  
  const html = assignments.map(a => {
    const submission = appData.submissions.find(s => s.assignmentId === a.id && s.userId === appData.currentUser.id);
    const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;
    
    let status = 'Not submitted';
    let score = '—';
    let feedback = '';
    
    if (submission) {
      if (grade && grade.released) {
        status = 'Graded';
        score = `${grade.score}/${a.points}`;
        feedback = grade.feedback;
        totalScore += grade.score;
        totalPoints += a.points;
      } else if (grade && !grade.released) {
        status = 'Submitted (grading in progress)';
      } else {
        status = 'Submitted';
      }
    }
    
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${a.title}</div>
            <div class="muted">${status} · ${a.category}</div>
          </div>
          <div style="font-size:1.2rem; font-weight:600;">${score}</div>
        </div>
        ${feedback ? `<div style="margin-top:12px; padding:12px; background:var(--bg-color); border-radius:var(--radius);"><strong>Feedback:</strong> ${feedback}</div>` : ''}
      </div>
    `;
  }).join('');
  
  const percentage = totalPoints > 0 ? ((totalScore / totalPoints) * 100).toFixed(1) : '—';
  const weightedGrade = calculateWeightedGrade(appData.currentUser.id, activeCourseId);
  
  let summary = `
    <div class="card" style="background:var(--primary-light); border-color:var(--primary); margin-bottom:16px;">
      <div class="card-header">
        <div class="card-title">Overall Grade</div>
        <div style="font-size:1.5rem; font-weight:600;">${percentage}%</div>
      </div>
      <div class="muted">${totalScore} / ${totalPoints} points</div>
  `;
  
  if (weightedGrade !== null) {
    summary += `<div style="margin-top:12px; padding:12px; background:white; border-radius:var(--radius);">
      <strong>Weighted Grade:</strong> ${weightedGrade.toFixed(1)}%
      <div class="muted" style="font-size:0.85rem; margin-top:4px;">Based on category weights</div>
    </div>`;
  }
  
  summary += '</div>';
  
  setHTML('gradebookWrap', summary + html);
}

function renderStaffGradebook() {
  const hasWeights = appData.gradeCategories && appData.gradeCategories.some(c => c.courseId === activeCourseId);

  // Actions with search
  setHTML('gradebookActions', `
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
      <input type="text" class="form-input" placeholder="Search students..." value="${escapeHtml(gradebookSearch)}" onkeyup="updateGradebookSearch(this.value)" style="width:200px;">
      <button class="btn btn-secondary" onclick="openCategoryWeightsModal()">Category Weights ${hasWeights ? '✓' : ''}</button>
      <button class="btn btn-secondary" onclick="exportGradebook()">Export CSV</button>
    </div>
  `);

  const assignments = appData.assignments
    .filter(a => a.courseId === activeCourseId)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  let students = appData.enrollments
    .filter(e => e.courseId === activeCourseId && e.role === 'student')
    .map(e => getUserById(e.userId))
    .filter(u => u)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filter by search
  if (gradebookSearch) {
    students = students.filter(s =>
      s.name.toLowerCase().includes(gradebookSearch) ||
      s.email.toLowerCase().includes(gradebookSearch)
    );
  }

  if (students.length === 0 || assignments.length === 0) {
    setHTML('gradebookWrap', gradebookSearch
      ? '<div class="empty-state-text">No students match your search</div>'
      : '<div class="empty-state-text">No students or assignments yet</div>');
    return;
  }
  
  // Calculate statistics for each assignment
  const assignmentStats = assignments.map(assignment => {
    const grades = [];
    students.forEach(student => {
      const submission = appData.submissions.find(s => s.assignmentId === assignment.id && s.userId === student.id);
      const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;
      if (grade) grades.push(grade.score);
    });
    
    if (grades.length === 0) {
      return { assignment, average: 0, median: 0, min: 0, max: 0, count: 0 };
    }
    
    grades.sort((a, b) => a - b);
    const average = grades.reduce((sum, g) => sum + g, 0) / grades.length;
    const median = grades.length % 2 === 0 
      ? (grades[grades.length / 2 - 1] + grades[grades.length / 2]) / 2
      : grades[Math.floor(grades.length / 2)];
    
    return {
      assignment,
      average: average.toFixed(1),
      median: median.toFixed(1),
      min: Math.min(...grades),
      max: Math.max(...grades),
      count: grades.length
    };
  });
  
  // Display statistics cards
  let statsHTML = '<div class="card" style="margin-bottom:20px; background:var(--primary-light);">';
  statsHTML += '<div class="card-title">Assignment Statistics</div>';
  statsHTML += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-top:12px;">';
  
  assignmentStats.forEach(stat => {
    statsHTML += `
      <div style="padding:12px; background:white; border-radius:var(--radius); border:1px solid var(--border-color);">
        <div style="font-weight:600; font-size:0.9rem; margin-bottom:8px;">${stat.assignment.title}</div>
        <div style="font-size:0.85rem; color:var(--text-muted);">
          <div>Average: <strong>${stat.average}/${stat.assignment.points}</strong></div>
          <div>Median: ${stat.median}</div>
          <div>Range: ${stat.min}-${stat.max}</div>
          <div>Graded: ${stat.count}/${students.length}</div>
        </div>
      </div>
    `;
  });
  
  statsHTML += '</div></div>';
  
  const table = `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:var(--bg-color); border-bottom:2px solid var(--border-color);">
            <th style="padding:12px; text-align:left; position:sticky; left:0; background:var(--bg-color);">Student</th>
            ${assignments.map(a => `<th style="padding:12px; text-align:center; min-width:120px;">${a.title}<br><span class="muted" style="font-weight:normal;">(${a.points}pts)</span></th>`).join('')}
            <th style="padding:12px; text-align:center;">Total</th>
            <th style="padding:12px; text-align:center;">Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(student => {
            let totalScore = 0;
            let totalPoints = 0;
            
            const row = `
              <tr style="border-bottom:1px solid var(--border-light);">
                <td style="padding:12px; position:sticky; left:0; background:var(--bg-card);">${student.name}</td>
                ${assignments.map(a => {
                  const submission = appData.submissions.find(s => s.assignmentId === a.id && s.userId === student.id);
                  const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;

                  if (grade) {
                    totalScore += grade.score;
                    totalPoints += a.points;
                    return `<td style="padding:12px; text-align:center; cursor:pointer;" onclick="openManualGradeModal('${student.id}', '${a.id}')" title="Click to edit grade">${grade.score} ${grade.released ? '' : '🔒'}</td>`;
                  }
                  return `<td style="padding:12px; text-align:center; cursor:pointer;" class="muted" onclick="openManualGradeModal('${student.id}', '${a.id}')" title="Click to add grade">—</td>`;
                }).join('')}
                <td style="padding:12px; text-align:center; font-weight:600;">${totalPoints > 0 ? `${totalScore}/${totalPoints}` : '—'}</td>
                <td style="padding:12px; text-align:center; font-weight:600;">${totalPoints > 0 ? ((totalScore / totalPoints) * 100).toFixed(1) + '%' : '—'}</td>
              </tr>
            `;
            return row;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="muted" style="margin-top:12px; font-size:0.85rem;">🔒 = Grade not yet released to student</div>
  `;
  
  setHTML('gradebookWrap', statsHTML + table);
}

// Manual grade entry modal
let manualGradeStudentId = null;
let manualGradeAssignmentId = null;

function openManualGradeModal(studentId, assignmentId) {
  manualGradeStudentId = studentId;
  manualGradeAssignmentId = assignmentId;

  const student = getUserById(studentId);
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  if (!student || !assignment) return;

  // Find existing grade if any
  const submission = appData.submissions.find(s => s.assignmentId === assignmentId && s.userId === studentId);
  const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;

  // Create modal if it doesn't exist
  if (!document.getElementById('manualGradeModal')) {
    const modalHtml = `
      <div class="modal-overlay" id="manualGradeModal">
        <div class="modal" style="max-width:400px;">
          <div class="modal-header">
            <h2 class="modal-title" id="manualGradeTitle">Add Grade</h2>
            <button class="modal-close" onclick="closeModal('manualGradeModal')">&times;</button>
          </div>
          <div class="modal-body">
            <div id="manualGradeInfo" class="muted" style="margin-bottom:16px;"></div>
            <div class="form-group">
              <label class="form-label">Score</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="number" class="form-input" id="manualGradeScore" min="0" style="width:100px;">
                <span id="manualGradeMax">/ 100</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Feedback (optional)</label>
              <textarea class="form-textarea" id="manualGradeFeedback" rows="3" placeholder="Add feedback..."></textarea>
            </div>
            <div class="form-group">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="manualGradeReleased" checked>
                <span>Release grade to student</span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal('manualGradeModal')">Cancel</button>
            <button class="btn btn-primary" onclick="saveManualGrade()">Save Grade</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  document.getElementById('manualGradeTitle').textContent = grade ? 'Edit Grade' : 'Add Grade';
  document.getElementById('manualGradeInfo').textContent = `${student.name} · ${assignment.title}`;
  document.getElementById('manualGradeMax').textContent = `/ ${assignment.points}`;
  document.getElementById('manualGradeScore').value = grade ? grade.score : '';
  document.getElementById('manualGradeScore').max = assignment.points;
  document.getElementById('manualGradeFeedback').value = grade ? (grade.feedback || '') : '';
  document.getElementById('manualGradeReleased').checked = grade ? grade.released : true;

  openModal('manualGradeModal');
}

async function saveManualGrade() {
  const score = parseFloat(document.getElementById('manualGradeScore').value);
  const feedback = document.getElementById('manualGradeFeedback').value.trim();
  const released = document.getElementById('manualGradeReleased').checked;
  const assignment = appData.assignments.find(a => a.id === manualGradeAssignmentId);

  if (isNaN(score) || score < 0) {
    showToast('Please enter a valid score', 'error');
    return;
  }

  if (score > assignment.points) {
    showToast(`Score cannot exceed ${assignment.points} points`, 'error');
    return;
  }

  // Check if submission exists, if not create a placeholder
  let submission = appData.submissions.find(s => s.assignmentId === manualGradeAssignmentId && s.userId === manualGradeStudentId);

  if (!submission) {
    // Create a manual/placeholder submission
    submission = {
      id: generateId(),
      assignmentId: manualGradeAssignmentId,
      userId: manualGradeStudentId,
      text: '[Manual grade entry]',
      fileName: null,
      fileData: null,
      submittedAt: new Date().toISOString(),
      isManual: true
    };
    appData.submissions.push(submission);

    // Save submission to Supabase
    await supabaseUpsertSubmission(submission);
  }

  // Update or create grade
  let existingGrade = appData.grades.find(g => g.submissionId === submission.id);

  if (existingGrade) {
    existingGrade.score = score;
    existingGrade.feedback = feedback;
    existingGrade.released = released;
    existingGrade.gradedBy = appData.currentUser.id;
    existingGrade.gradedAt = new Date().toISOString();
  } else {
    existingGrade = {
      submissionId: submission.id,
      score: score,
      feedback: feedback,
      released: released,
      gradedBy: appData.currentUser.id,
      gradedAt: new Date().toISOString()
    };
    appData.grades.push(existingGrade);
  }

  // Save grade to Supabase
  await supabaseUpsertGrade(existingGrade);
  saveData(appData);

  closeModal('manualGradeModal');
  renderGradebook();
  showToast('Grade saved', 'success');
}

function exportGradebook() {
  const assignments = appData.assignments
    .filter(a => a.courseId === activeCourseId)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  
  const students = appData.enrollments
    .filter(e => e.courseId === activeCourseId && e.role === 'student')
    .map(e => getUserById(e.userId))
    .filter(u => u);
  
  let csv = 'Student,Email,' + assignments.map(a => a.title).join(',') + ',Total\n';
  
  students.forEach(student => {
    let totalScore = 0;
    let totalPoints = 0;
    let row = `${student.name},${student.email},`;
    
    assignments.forEach(a => {
      const submission = appData.submissions.find(s => s.assignmentId === a.id && s.userId === student.id);
      const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;
      
      if (grade) {
        totalScore += grade.score;
        totalPoints += a.points;
        row += `${grade.score}/${a.points},`;
      } else {
        row += ',';
      }
    });
    
    row += `${totalScore}/${totalPoints}\n`;
    csv += row;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gradebook.csv';
  a.click();
  
  showToast('Gradebook exported!', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PEOPLE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

let peopleSearch = '';

function updatePeopleSearch(value) {
  peopleSearch = value.toLowerCase();
  renderPeopleList();
}

function renderPeopleList() {
  if (!activeCourseId) return;

  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);

  let people = appData.enrollments
    .filter(e => e.courseId === activeCourseId)
    .map(e => ({ ...getUserById(e.userId), role: e.role }))
    .filter(p => p.id)
    .sort((a, b) => {
      const roleOrder = { instructor: 0, ta: 1, student: 2 };
      if (roleOrder[a.role] !== roleOrder[b.role]) return roleOrder[a.role] - roleOrder[b.role];
      return a.name.localeCompare(b.name);
    });

  // Filter by search
  if (peopleSearch) {
    people = people.filter(p =>
      p.name.toLowerCase().includes(peopleSearch) ||
      p.email.toLowerCase().includes(peopleSearch)
    );
  }

  let html = '';

  const grouped = {
    instructor: people.filter(p => p.role === 'instructor'),
    ta: people.filter(p => p.role === 'ta'),
    student: people.filter(p => p.role === 'student')
  };

  // Get pending invites (also filtered by search), grouped by role
  let allPendingInvites = isStaffUser && appData.invites
    ? appData.invites.filter(i => i.courseId === activeCourseId && i.status === 'pending')
    : [];

  if (peopleSearch) {
    allPendingInvites = allPendingInvites.filter(inv =>
      inv.email.toLowerCase().includes(peopleSearch)
    );
  }

  // Group invites by role (default to 'student' if no role specified)
  const invitesByRole = {
    instructor: allPendingInvites.filter(i => i.role === 'instructor'),
    ta: allPendingInvites.filter(i => i.role === 'ta'),
    student: allPendingInvites.filter(i => !i.role || i.role === 'student')
  };

  // Helper function to render a single person row
  const renderPersonRow = (p, idx, total, isInvite = false) => {
    if (isInvite) {
      return `
        <div style="display:flex; align-items:center; padding:12px 16px; gap:12px; background:var(--warning-light); ${idx < total - 1 ? 'border-bottom:1px solid var(--warning);' : ''}">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:500; font-size:0.95rem;">${escapeHtml(p.email)}</div>
            <div style="font-size:0.8rem; color:var(--warning);">Invited ${formatDate(p.sentAt)} · Awaiting sign-up</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="revokeInvite('${p.id}')" style="padding:4px 12px; color:var(--danger);">Revoke</button>
        </div>
      `;
    } else {
      return `
        <div style="display:flex; align-items:center; padding:12px 16px; gap:12px; ${idx < total - 1 ? 'border-bottom:1px solid var(--border-light);' : ''}">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:500; font-size:0.95rem;">${p.name}</div>
            <div class="muted" style="font-size:0.8rem;">${p.email}</div>
          </div>
          ${isStaffUser && p.id !== appData.currentUser.id ? `
            <button class="btn btn-secondary btn-sm" onclick="removePersonFromCourse('${p.id}', '${activeCourseId}')" style="padding:4px 12px;">Remove</button>
          ` : ''}
        </div>
      `;
    }
  };

  // Helper function to render a section with invites at top
  const renderSectionWithInvites = (title, members, invites) => {
    const totalCount = members.length + invites.length;
    if (totalCount === 0) return '';

    const allItems = [...invites.map(i => ({ ...i, isInvite: true })), ...members.map(m => ({ ...m, isInvite: false }))];

    return `
      <div style="margin-bottom:32px;">
        <h3 style="font-family:var(--font-serif); font-size:1.1rem; margin-bottom:12px; color:var(--text-color);">
          ${title} (${members.length}${invites.length > 0 ? ` + ${invites.length} pending` : ''})
        </h3>
        <div style="background:white; border:1px solid var(--border-light); border-radius:var(--radius); overflow:hidden;">
          ${allItems.map((item, idx) => renderPersonRow(item, idx, allItems.length, item.isInvite)).join('')}
        </div>
      </div>
    `;
  };

  // Render in order: Instructors, TAs, Students - each with their pending invites at top
  html += renderSectionWithInvites('Instructors', grouped.instructor, invitesByRole.instructor);
  html += renderSectionWithInvites('Teaching Assistants', grouped.ta, invitesByRole.ta);
  html += renderSectionWithInvites('Students', grouped.student, invitesByRole.student);

  setHTML('peopleList', html || '<div class="empty-state-text">No people in this course</div>');
}

function renderPeople() {
  if (!activeCourseId) {
    setText('peopleSubtitle', 'Select a course');
    setHTML('peopleActions', '');
    setHTML('peopleList', '<div class="empty-state-text">No active course</div>');
    return;
  }

  const course = getCourseById(activeCourseId);
  setText('peopleSubtitle', course.name);

  let people = appData.enrollments
    .filter(e => e.courseId === activeCourseId)
    .map(e => ({ ...getUserById(e.userId), role: e.role }))
    .filter(p => p.id)
    .sort((a, b) => {
      const roleOrder = { instructor: 0, ta: 1, student: 2 };
      if (roleOrder[a.role] !== roleOrder[b.role]) return roleOrder[a.role] - roleOrder[b.role];
      return a.name.localeCompare(b.name);
    });

  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);

  // Actions with search
  setHTML('peopleActions', `
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
      <input type="text" class="form-input" id="peopleSearchInput" placeholder="Search people..." value="${escapeHtml(peopleSearch)}" oninput="updatePeopleSearch(this.value)" style="width:200px;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      ${isStaffUser ? `
        <button class="btn btn-primary btn-sm" onclick="openAddPersonModal()">Add Person</button>
        <button class="btn btn-secondary btn-sm" onclick="openBulkStudentImportModal()">Import Students</button>
        <div class="muted">Invite code: <strong>${course.inviteCode}</strong></div>
      ` : ''}
    </div>
  `);

  // Filter by search
  if (peopleSearch) {
    people = people.filter(p =>
      p.name.toLowerCase().includes(peopleSearch) ||
      p.email.toLowerCase().includes(peopleSearch)
    );
  }
  
  // Show as clean table instead of blocky cards
  let html = '';

  const grouped = {
    instructor: people.filter(p => p.role === 'instructor'),
    ta: people.filter(p => p.role === 'ta'),
    student: people.filter(p => p.role === 'student')
  };

  // Get pending invites (also filtered by search), grouped by role
  let allPendingInvites = isStaffUser && appData.invites
    ? appData.invites.filter(i => i.courseId === activeCourseId && i.status === 'pending')
    : [];

  if (peopleSearch) {
    allPendingInvites = allPendingInvites.filter(inv =>
      inv.email.toLowerCase().includes(peopleSearch)
    );
  }

  // Group invites by role (default to 'student' if no role specified)
  const invitesByRole = {
    instructor: allPendingInvites.filter(i => i.role === 'instructor'),
    ta: allPendingInvites.filter(i => i.role === 'ta'),
    student: allPendingInvites.filter(i => !i.role || i.role === 'student')
  };

  // Helper function to render a single person row
  const renderPersonRow = (p, idx, total, isInvite = false) => {
    const bgColor = isInvite ? 'var(--warning-light)' : 'white';
    const borderColor = isInvite ? 'var(--warning)' : 'var(--border-light)';

    if (isInvite) {
      return `
        <div style="display:flex; align-items:center; padding:12px 16px; gap:12px; background:var(--warning-light); ${idx < total - 1 ? 'border-bottom:1px solid var(--warning);' : ''}">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:500; font-size:0.95rem;">${escapeHtml(p.email)}</div>
            <div style="font-size:0.8rem; color:var(--warning);">Invited ${formatDate(p.sentAt)} · Awaiting sign-up</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="revokeInvite('${p.id}')" style="padding:4px 12px; color:var(--danger);">Revoke</button>
        </div>
      `;
    } else {
      return `
        <div style="display:flex; align-items:center; padding:12px 16px; gap:12px; ${idx < total - 1 ? 'border-bottom:1px solid var(--border-light);' : ''}">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:500; font-size:0.95rem;">${p.name}</div>
            <div class="muted" style="font-size:0.8rem;">${p.email}</div>
          </div>
          ${isStaffUser && p.id !== appData.currentUser.id ? `
            <button class="btn btn-secondary btn-sm" onclick="removePersonFromCourse('${p.id}', '${activeCourseId}')" style="padding:4px 12px;">Remove</button>
          ` : ''}
        </div>
      `;
    }
  };

  // Helper function to render a section with invites at top
  const renderSectionWithInvites = (title, members, invites) => {
    const totalCount = members.length + invites.length;
    if (totalCount === 0) return '';

    const allItems = [...invites.map(i => ({ ...i, isInvite: true })), ...members.map(m => ({ ...m, isInvite: false }))];

    return `
      <div style="margin-bottom:32px;">
        <h3 style="font-family:var(--font-serif); font-size:1.1rem; margin-bottom:12px; color:var(--text-color);">
          ${title} (${members.length}${invites.length > 0 ? ` + ${invites.length} pending` : ''})
        </h3>
        <div style="background:white; border:1px solid var(--border-light); border-radius:var(--radius); overflow:hidden;">
          ${allItems.map((item, idx) => renderPersonRow(item, idx, allItems.length, item.isInvite)).join('')}
        </div>
      </div>
    `;
  };

  // Render in order: Instructors, TAs, Students - each with their pending invites at top
  html += renderSectionWithInvites('Instructors', grouped.instructor, invitesByRole.instructor);
  html += renderSectionWithInvites('Teaching Assistants', grouped.ta, invitesByRole.ta);
  html += renderSectionWithInvites('Students', grouped.student, invitesByRole.student);

  setHTML('peopleList', html || '<div class="empty-state-text">No people in this course</div>');
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PAGE - Unified Chatbot with Tool Use
// ═══════════════════════════════════════════════════════════════════════════════

let aiRecording = false;
let aiMediaRecorder = null;
let aiAudioChunks = [];
let pendingAiAction = null;

function renderAiThread() {
  const html = aiThread.map((msg, idx) => {
    if (msg.role === 'user') {
      return `
        <div style="margin-bottom:16px; display:flex; justify-content:flex-end;">
          <div style="background:var(--primary); color:white; padding:12px 16px; border-radius:16px 16px 4px 16px; max-width:80%;">
            ${escapeHtml(msg.content)}
          </div>
        </div>
      `;
    } else if (msg.role === 'assistant') {
      return `
        <div style="margin-bottom:16px;">
          <div style="background:var(--bg-color); padding:12px 16px; border-radius:16px 16px 16px 4px; max-width:80%; border:1px solid var(--border-color);">
            <div class="markdown-content">${renderMarkdown(msg.content)}</div>
          </div>
        </div>
      `;
    } else if (msg.role === 'action') {
      // Pending action with HITL confirmation - editable before acceptance
      const isLatest = idx === aiThread.length - 1 && !msg.confirmed && !msg.rejected;
      const actionIcon = msg.actionType === 'announcement' ? '' : msg.actionType === 'quiz' ? '' : msg.actionType === 'assignment' ? '' : msg.actionType === 'module' ? '' : '';
      const actionLabel = msg.actionType === 'announcement' ? 'Create Announcement' : msg.actionType === 'quiz' ? 'Create Quiz' : msg.actionType === 'assignment' ? 'Create Assignment' : msg.actionType === 'module' ? 'Create Module' : 'Action';

      return `
        <div style="margin-bottom:16px;">
          <div style="background:var(--primary-light); padding:16px; border-radius:var(--radius); border:2px solid var(--primary);">
            <div style="font-weight:600; margin-bottom:8px; color:var(--primary);">
              ${actionLabel}
            </div>
            <div style="background:white; padding:12px; border-radius:var(--radius); margin-bottom:12px;">
              ${msg.confirmed || msg.rejected ? `
                ${msg.actionType === 'announcement' ? `
                  <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(msg.data.title)}</div>
                  <div class="markdown-content">${renderMarkdown(msg.data.content)}</div>
                ` : msg.actionType === 'quiz' ? `
                  <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(msg.data.title)}</div>
                  <div class="muted">${(msg.data.questions || []).length} questions</div>
                  <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="viewQuizDetails('${msg.createdId || ''}')">View Quiz Details</button>
                ` : msg.actionType === 'assignment' ? `
                  <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(msg.data.title)}</div>
                  <div class="muted">${msg.data.points} points · ${msg.data.category}</div>
                ` : msg.actionType === 'module' ? `
                  <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(msg.data.name)}</div>
                  ${msg.data.description ? `<div class="muted">${escapeHtml(msg.data.description)}</div>` : ''}
                ` : ''}
              ` : `
                ${msg.actionType === 'announcement' ? `
                  <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label" style="font-size:0.85rem;">Title</label>
                    <input type="text" class="form-input" id="aiAction${idx}Title" value="${escapeHtml(msg.data.title)}" onchange="updateAiActionField(${idx}, 'title', this.value)">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label" style="font-size:0.85rem;">Content (supports Markdown)</label>
                    <textarea class="form-textarea" id="aiAction${idx}Content" rows="6" onchange="updateAiActionField(${idx}, 'content', this.value)">${escapeHtml(msg.data.content)}</textarea>
                  </div>
                ` : msg.actionType === 'quiz' ? `
                  <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label" style="font-size:0.85rem;">Title</label>
                    <input type="text" class="form-input" id="aiAction${idx}Title" value="${escapeHtml(msg.data.title)}" onchange="updateAiActionField(${idx}, 'title', this.value)">
                  </div>
                  <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label" style="font-size:0.85rem;">Description</label>
                    <textarea class="form-textarea" id="aiAction${idx}Description" rows="2" onchange="updateAiActionField(${idx}, 'description', this.value)">${escapeHtml(msg.data.description || '')}</textarea>
                  </div>
                  <div style="margin-top:12px; border-top:1px solid var(--border-light); padding-top:12px;">
                    <div class="form-label" style="font-size:0.85rem; margin-bottom:8px;">Questions (${(msg.data.questions || []).length})</div>
                    <div style="max-height:300px; overflow-y:auto;">
                    ${(msg.data.questions || []).map((q, qIdx) => `
                      <div style="background:var(--bg-color); padding:10px; border-radius:var(--radius); margin-bottom:8px;">
                        <div style="font-weight:500; margin-bottom:4px;">Q${qIdx + 1}. ${escapeHtml(q.prompt)}</div>
                        <div class="muted" style="font-size:0.8rem;">${q.type.replace('_', ' ')} - ${q.points} pts</div>
                        ${q.type === 'multiple_choice' ? `
                          <div style="margin-top:6px; font-size:0.85rem;">
                            ${q.options.map((opt, i) => `<div style="${i === q.correctAnswer ? 'color:var(--success); font-weight:500;' : ''}">${i === q.correctAnswer ? '✓' : '○'} ${escapeHtml(opt)}</div>`).join('')}
                          </div>
                        ` : q.type === 'true_false' ? `
                          <div style="margin-top:6px; font-size:0.85rem;">
                            <div style="${q.correctAnswer === 'True' ? 'color:var(--success); font-weight:500;' : ''}">○ True</div>
                            <div style="${q.correctAnswer === 'False' ? 'color:var(--success); font-weight:500;' : ''}">○ False</div>
                          </div>
                        ` : `<div class="muted" style="font-size:0.85rem; margin-top:4px; font-style:italic;">Short answer question</div>`}
                      </div>
                    `).join('')}
                    </div>
                  </div>
                ` : msg.actionType === 'assignment' ? `
                  <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label" style="font-size:0.85rem;">Title</label>
                    <input type="text" class="form-input" id="aiAction${idx}Title" value="${escapeHtml(msg.data.title)}" onchange="updateAiActionField(${idx}, 'title', this.value)">
                  </div>
                  <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label" style="font-size:0.85rem;">Description</label>
                    <textarea class="form-textarea" id="aiAction${idx}Description" rows="3" onchange="updateAiActionField(${idx}, 'description', this.value)">${escapeHtml(msg.data.description || '')}</textarea>
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div class="form-group" style="margin-bottom:0;">
                      <label class="form-label" style="font-size:0.85rem;">Points</label>
                      <input type="number" class="form-input" value="${msg.data.points || 100}" onchange="updateAiActionField(${idx}, 'points', parseInt(this.value))">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                      <label class="form-label" style="font-size:0.85rem;">Category</label>
                      <select class="form-select" onchange="updateAiActionField(${idx}, 'category', this.value)">
                        <option value="homework" ${msg.data.category === 'homework' ? 'selected' : ''}>Homework</option>
                        <option value="project" ${msg.data.category === 'project' ? 'selected' : ''}>Project</option>
                        <option value="essay" ${msg.data.category === 'essay' ? 'selected' : ''}>Essay</option>
                        <option value="exam" ${msg.data.category === 'exam' ? 'selected' : ''}>Exam</option>
                      </select>
                    </div>
                  </div>
                ` : msg.actionType === 'module' ? `
                  <div class="form-group" style="margin-bottom:12px;">
                    <label class="form-label" style="font-size:0.85rem;">Module Name</label>
                    <input type="text" class="form-input" id="aiAction${idx}Name" value="${escapeHtml(msg.data.name)}" onchange="updateAiActionField(${idx}, 'name', this.value)">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label" style="font-size:0.85rem;">Description (optional)</label>
                    <textarea class="form-textarea" id="aiAction${idx}Description" rows="2" onchange="updateAiActionField(${idx}, 'description', this.value)">${escapeHtml(msg.data.description || '')}</textarea>
                  </div>
                ` : ''}
              `}
            </div>
            ${msg.confirmed ? `
              <div style="color:var(--success); font-weight:500;">✓ Created successfully${msg.wasPublished ? '' : ' as draft'}</div>
            ` : msg.rejected ? `
              <div style="color:var(--text-muted);">✗ Cancelled</div>
            ` : isLatest ? `
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="confirmAiAction(${idx}, false)">Create this</button>
                ${msg.actionType === 'announcement' ? `
                  <button class="btn btn-primary btn-sm" onclick="confirmAiAction(${idx}, true)">Create and Publish</button>
                ` : ''}
                <button class="btn btn-secondary btn-sm" onclick="rejectAiAction(${idx})">Cancel</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
    return '';
  }).join('');

  setHTML('aiThread', html || '<div class="muted" style="padding:20px; text-align:center;">Ask me anything about your course, or say "create an announcement about..." or "create a quiz on..."</div>');

  // Scroll to bottom after render
  scrollAiThreadToBottom();
}

function scrollAiThreadToBottom() {
  // Use setTimeout to ensure DOM has updated
  setTimeout(() => {
    const thread = document.getElementById('aiThread');
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
      // Also scroll parent container if it exists
      if (thread.parentElement) {
        thread.parentElement.scrollTop = thread.parentElement.scrollHeight;
      }
    }
  }, 50);
}

function updateAiActionField(idx, field, value) {
  const msg = aiThread[idx];
  if (!msg || msg.role !== 'action') return;
  msg.data[field] = value;
}

async function confirmAiAction(idx, publish = false) {
  const msg = aiThread[idx];
  if (!msg || msg.role !== 'action') return;

  if (msg.actionType === 'announcement') {
    const announcement = {
      id: generateId(),
      courseId: activeCourseId,
      title: msg.data.title,
      content: msg.data.content,
      pinned: false,
      hidden: !publish,
      authorId: appData.currentUser.id,
      createdAt: new Date().toISOString()
    };

    // Save to Supabase
    const result = await supabaseCreateAnnouncement(announcement);
    if (!result) {
      showToast('Failed to save announcement to database', 'error');
      return;
    }

    appData.announcements.push(announcement);
    msg.wasPublished = publish;
    saveData(appData);
    renderUpdates();
    renderHome();
    showToast(publish ? 'Announcement published!' : 'Announcement created as draft!', 'success');
  } else if (msg.actionType === 'quiz') {
    const newQuiz = {
      id: generateId(),
      courseId: activeCourseId,
      title: msg.data.title,
      description: msg.data.description || '',
      status: 'draft',
      dueDate: msg.data.dueDate || new Date(Date.now() + 86400000 * 7).toISOString(),
      createdAt: new Date().toISOString(),
      timeLimit: msg.data.timeLimit || 30,
      attempts: msg.data.attempts || 1,
      randomizeQuestions: false,
      questionPoolEnabled: false,
      questionSelectCount: 0,
      questions: msg.data.questions || []
    };

    // Save to Supabase
    const result = await supabaseCreateQuiz(newQuiz);
    if (!result) {
      showToast('Failed to save quiz to database', 'error');
      return;
    }

    appData.quizzes.push(newQuiz);
    saveData(appData);
    renderAssignments();
    showToast('Quiz created as draft! Click Preview to see full details.', 'success');
  } else if (msg.actionType === 'assignment') {
    const newAssignment = {
      id: generateId(),
      courseId: activeCourseId,
      title: msg.data.title,
      description: msg.data.description || '',
      points: msg.data.points || 100,
      status: 'draft',
      dueDate: msg.data.dueDate || new Date(Date.now() + 86400000 * 7).toISOString(),
      createdAt: new Date().toISOString(),
      category: msg.data.category || 'homework',
      allowLateSubmissions: false,
      lateDeduction: 0,
      allowResubmission: false
    };

    // Save to Supabase
    const result = await supabaseCreateAssignment(newAssignment);
    if (!result) {
      showToast('Failed to save assignment to database', 'error');
      return;
    }

    appData.assignments.push(newAssignment);
    saveData(appData);
    renderAssignments();
    showToast('Assignment created as draft!', 'success');
  } else if (msg.actionType === 'module') {
    if (!appData.modules) appData.modules = [];
    const courseModules = appData.modules.filter(m => m.courseId === activeCourseId);
    const maxPosition = courseModules.length > 0 ? Math.max(...courseModules.map(m => m.position)) + 1 : 0;

    const newModule = {
      id: generateId(),
      courseId: activeCourseId,
      name: msg.data.name,
      position: maxPosition,
      items: []
    };

    // Save to Supabase
    const result = await supabaseCreateModule(newModule);
    if (!result) {
      showToast('Failed to save module to database', 'error');
      return;
    }

    appData.modules.push(newModule);
    saveData(appData);
    renderModules();
    showToast('Module created!', 'success');
  }

  msg.confirmed = true;
  renderAiThread();
}

function rejectAiAction(idx) {
  const msg = aiThread[idx];
  if (!msg || msg.role !== 'action') return;
  msg.rejected = true;
  aiThread.push({ role: 'assistant', content: 'No problem! Let me know if you need anything else.' });
  renderAiThread();
}

async function sendAiMessage(audioBase64 = null) {
  const input = document.getElementById('aiInput');
  const message = audioBase64 ? '[Voice message]' : input.value.trim();

  if (!message && !audioBase64) return;

  const apiKey = window.GEMINI_API_KEY || appData.settings.geminiKey;

  if (!apiKey) {
    showToast('Gemini API key not configured. Add GEMINI_API_KEY to config.js or configure in Settings.', 'error');
    return;
  }

  // Prevent double-sends while processing
  if (aiProcessing) return;
  aiProcessing = true;
  updateAiProcessingState();

  const isStaffUser = activeCourseId && isStaff(appData.currentUser.id, activeCourseId);

  // Use enhanced context builder
  const context = buildAiContext();

  // Build conversation context from last 3 exchanges
  const conversationContext = aiThread.slice(-6).map(msg => {
    if (msg.role === 'user') return `User: ${msg.content}`;
    if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
    if (msg.role === 'action') return `Assistant: [Created ${msg.actionType}]`;
    return '';
  }).filter(Boolean).join('\n');

  const systemPrompt = `You are an AI assistant for a Learning Management System (LMS). You help instructors and students with course-related tasks.

${isStaffUser ? `The user is an INSTRUCTOR/TA. You can help them create content.

IMPORTANT: If the user asks you to CREATE an announcement, quiz, assignment, or module, you MUST respond with a JSON object in this EXACT format:
- For announcements: {"action":"create_announcement","title":"...","content":"..."}
- For quizzes: {"action":"create_quiz","title":"...","description":"...","dueDate":"ISO date string","questions":[{"type":"multiple_choice","prompt":"...","options":["A","B","C","D"],"correctAnswer":0,"points":10},...]}
- For assignments: {"action":"create_assignment","title":"...","description":"...","points":100,"dueDate":"ISO date string","category":"homework"}
- For modules: {"action":"create_module","name":"...","description":"..."}

FORMATTING for announcement/assignment content (supports markdown):
- Use **bold** for emphasis, *italic* for terms
- Use bullet lists with "- item" format
- Use headers with ## or ###
- Link to course files: [📄 filename](#file-FILE_ID) where FILE_ID is from the COURSE FILES list
- Link to external URLs: [link text](https://url)
- Embed YouTube videos: just paste the full YouTube URL on its own line, it will auto-embed
- Use \`code\` for inline code or \`\`\` for code blocks

Question types: multiple_choice, true_false, short_answer
For true_false, correctAnswer should be "True" or "False"
For multiple_choice, correctAnswer should be the index (0-based)

IMPORTANT: If you cannot fully complete the request (e.g., missing information, ambiguous requirements, or limitations), include a "notes" field in your JSON response explaining what was done and what might need adjustment. Example: {"action":"create_quiz",...,"notes":"Created 5 questions. Some topics were unclear, please review question 3."}

Only output the JSON when the user clearly wants to CREATE something. For questions about content or help drafting, respond normally.
When creating content, make sure titles and content are professional and appropriate for an academic setting.
Use the current date/time from context to set appropriate due dates (default to 1 week from now if not specified).
Reference relevant course files when helpful (see COURSE FILES in context).` : `The user is a STUDENT. Help them with course questions, explain concepts, and provide guidance.

You can help students with:
- Understanding assignments and their requirements
- Explaining course material and concepts
- Answering questions about due dates and course structure
- Providing study tips and guidance

Do NOT create content for students. Redirect content creation requests to instructors.`}

${context}

${conversationContext ? `Current_conversation_context:\n${conversationContext}\n` : ''}

Respond helpfully and concisely. If asked to create content (and you're an instructor), output ONLY the JSON object with no additional text.`;

  aiThread.push({ role: 'user', content: audioBase64 ? '🎤 Voice message' : message });
  if (!audioBase64) input.value = '';
  renderAiThread();

  try {
    let requestBody;

    if (audioBase64) {
      // Voice message - send audio to Gemini
      requestBody = {
        contents: [{
          parts: [
            { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
            { text: systemPrompt + '\n\nTranscribe and respond to this voice message:' }
          ]
        }],
        generationConfig: { temperature: 0.4 }
      };
    } else {
      requestBody = {
        contents: [{ parts: [{ text: systemPrompt + '\n\nUser: ' + message }] }],
        generationConfig: { temperature: 0.4 }
      };
    }

    // Use retry logic for API calls
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      },
      3
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const reply = data.candidates[0].content.parts[0].text.trim();

    // Check if it's a JSON action
    if (reply.startsWith('{') && reply.includes('"action"')) {
      try {
        const action = JSON.parse(reply);
        if (action.action === 'create_announcement') {
          aiThread.push({
            role: 'action',
            actionType: 'announcement',
            data: { title: action.title, content: action.content },
            confirmed: false,
            rejected: false
          });
        } else if (action.action === 'create_quiz') {
          aiThread.push({
            role: 'action',
            actionType: 'quiz',
            data: {
              title: action.title,
              description: action.description || '',
              dueDate: action.dueDate || new Date(Date.now() + 86400000 * 7).toISOString(),
              questions: action.questions || []
            },
            confirmed: false,
            rejected: false
          });
        } else if (action.action === 'create_assignment') {
          aiThread.push({
            role: 'action',
            actionType: 'assignment',
            data: {
              title: action.title,
              description: action.description || '',
              points: action.points || 100,
              dueDate: action.dueDate || new Date(Date.now() + 86400000 * 7).toISOString(),
              category: action.category || 'homework',
              notes: action.notes || ''
            },
            confirmed: false,
            rejected: false
          });
        } else if (action.action === 'create_module') {
          aiThread.push({
            role: 'action',
            actionType: 'module',
            data: {
              name: action.name,
              description: action.description || '',
              notes: action.notes || ''
            },
            confirmed: false,
            rejected: false
          });
        } else {
          aiThread.push({ role: 'assistant', content: reply });
        }
        // Show notes if present
        if (action.notes) {
          aiThread.push({ role: 'assistant', content: `**Note:** ${action.notes}` });
        }
      } catch (e) {
        aiThread.push({ role: 'assistant', content: reply });
      }
    } else {
      aiThread.push({ role: 'assistant', content: reply });
    }

    renderAiThread();

  } catch (err) {
    console.error('AI error:', err);
    showToast('AI request failed: ' + err.message, 'error');
    aiThread.push({ role: 'assistant', content: `Sorry, I encountered an error: ${err.message}` });
    renderAiThread();
  } finally {
    aiProcessing = false;
    updateAiProcessingState();
  }
}

function updateAiProcessingState() {
  const sendBtn = document.getElementById('aiSendBtn');
  const spinner = document.getElementById('aiProcessingSpinner');
  const input = document.getElementById('aiInput');
  const thread = document.getElementById('aiThread');

  if (sendBtn) {
    sendBtn.disabled = aiProcessing;
    sendBtn.textContent = aiProcessing ? '...' : 'Send';
  }
  if (spinner) {
    spinner.style.display = aiProcessing ? 'inline-flex' : 'none';
  }
  if (input) {
    input.disabled = aiProcessing;
  }

  // Show/hide thinking indicator in the thread
  let thinkingIndicator = document.getElementById('aiThinkingIndicator');
  if (aiProcessing) {
    if (!thinkingIndicator && thread) {
      const indicator = document.createElement('div');
      indicator.id = 'aiThinkingIndicator';
      indicator.style.cssText = 'margin-bottom:16px; display:flex; align-items:center; gap:12px;';
      indicator.innerHTML = `
        <div style="background:var(--bg-color); padding:12px 16px; border-radius:16px 16px 16px 4px; border:1px solid var(--border-color); display:flex; align-items:center; gap:10px;">
          <div class="ai-spinner-small" style="border-top-color:var(--primary);"></div>
          <span class="muted">Thinking...</span>
        </div>
      `;
      thread.appendChild(indicator);
      thread.parentElement.scrollTop = thread.parentElement.scrollHeight;
    }
  } else {
    if (thinkingIndicator) {
      thinkingIndicator.remove();
    }
  }
}

function toggleAiRecording() {
  if (aiRecording) {
    stopAiRecording();
  } else {
    startAiRecording();
  }
}

async function startAiRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    aiAudioChunks = [];

    aiMediaRecorder = new MediaRecorder(stream);

    aiMediaRecorder.ondataavailable = (event) => {
      aiAudioChunks.push(event.data);
    };

    aiMediaRecorder.onstop = async () => {
      const audioBlob = new Blob(aiAudioChunks, { type: 'audio/webm' });
      stream.getTracks().forEach(track => track.stop());

      // Convert to base64 and send
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        sendAiMessage(base64);
      };
      reader.readAsDataURL(audioBlob);
    };

    aiMediaRecorder.start();
    aiRecording = true;

    document.getElementById('aiRecordIcon').textContent = '⏹️';
    document.getElementById('aiRecordText').textContent = 'Stop';
    document.getElementById('aiRecordBtn').classList.add('recording');

    showToast('Recording...', 'info');

  } catch (err) {
    console.error('Recording error:', err);
    showToast('Could not access microphone: ' + err.message, 'error');
  }
}

function stopAiRecording() {
  if (aiMediaRecorder && aiMediaRecorder.state === 'recording') {
    aiMediaRecorder.stop();
    aiRecording = false;

    document.getElementById('aiRecordIcon').textContent = '🎤';
    document.getElementById('aiRecordText').textContent = 'Record';
    document.getElementById('aiRecordBtn').classList.remove('recording');

    // Show sending notification
    showToast('Sending voice message...', 'info');
  }
}

function openAiCreateModal(type = 'announcement', assignmentId = null) {
  generateModals();
  aiDraftType = type;
  aiDraft = null;
  aiRubricDraft = assignmentId ? { assignmentId } : null;
  
  const typeSelect = document.getElementById('aiCreateType');
  if (typeSelect) typeSelect.value = type;
  
  const assignmentSelect = document.getElementById('aiRubricAssignment');
  if (assignmentSelect) {
    const assignments = appData.assignments.filter(a => a.courseId === activeCourseId);
    assignmentSelect.innerHTML = assignments.length
      ? assignments.map(a => `<option value="${a.id}">${a.title}</option>`).join('')
      : '<option value="">No assignments available</option>';
    if (assignmentId) assignmentSelect.value = assignmentId;
  }
  
  document.getElementById('aiCreatePrompt').value = '';
  document.getElementById('aiQuestionCount').value = '5';
  updateAiCreateType();
  renderAiDraftPreview();
  openModal('aiCreateModal');
}

function updateAiCreateType() {
  aiDraftType = document.getElementById('aiCreateType').value;
  const rubricGroup = document.getElementById('aiRubricGroup');
  const quizGroup = document.getElementById('aiQuizGroup');
  if (rubricGroup) rubricGroup.style.display = aiDraftType === 'rubric' ? 'block' : 'none';
  if (quizGroup) quizGroup.style.display = aiDraftType === 'quiz' ? 'block' : 'none';
}

async function generateAiDraft() {
  const apiKey = window.GEMINI_API_KEY || appData.settings.geminiKey;
  if (!apiKey) {
    showToast('Gemini API key not configured. Add GEMINI_API_KEY to config.js or configure in Settings.', 'error');
    return;
  }
  
  const prompt = document.getElementById('aiCreatePrompt').value.trim();
  if (!prompt) {
    showToast('Add a prompt to guide the AI', 'error');
    return;
  }
  
  const course = activeCourseId ? getCourseById(activeCourseId) : null;
  let systemPrompt = '';

  if (aiDraftType === 'announcement') {
    systemPrompt = `Create a course announcement. Return ONLY valid JSON with keys: title, content.

FORMATTING for content (supports markdown):
- Use **bold** for emphasis, *italic* for terms
- Use bullet lists with "- item" format
- Use headers with ## or ###
- Embed YouTube videos by placing the full URL on its own line (it will auto-embed)
- Use \`code\` for inline code

Example: {"title":"...","content":"..."} - do not wrap in code fences or extra text.`;
  } else if (aiDraftType === 'quiz') {
    const count = parseInt(document.getElementById('aiQuestionCount').value, 10) || 5;
    systemPrompt = `Create a quiz as JSON with keys: title, description, questions (array). Each question must include type ("multiple_choice"|"true_false"|"short_answer"), prompt, options (array, for multiple_choice only), correctAnswer (index for multiple_choice, "True"/"False" for true_false, empty string for short_answer), points (number). Provide ${count} questions. Return only JSON (no markdown). Example: {"title":"...","description":"...","questions":[{"type":"multiple_choice","prompt":"...","options":["A","B"],"correctAnswer":0,"points":2}]}.`;
  } else {
    const assignmentId = document.getElementById('aiRubricAssignment').value;
    if (!assignmentId) {
      showToast('Select an assignment for the rubric', 'error');
      return;
    }
    const assignment = appData.assignments.find(a => a.id === assignmentId);
    systemPrompt = `Create a grading rubric for this assignment. Return ONLY JSON with key criteria (array). Each criterion must include name, points, description. Total points should sum to ${assignment ? assignment.points : 100}. Example: {"criteria":[{"name":"...","points":10,"description":"..."}]}.`;
  }
  
  const contextualPrompt = `
Course: ${course ? course.name : 'Unknown'}
Prompt: ${prompt}
${systemPrompt}
`;
  
  try {
    showToast('Generating draft with AI...', 'info');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: contextualPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4
        }
      })
    });
    
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const text = data.candidates[0].content.parts[0].text;
    aiDraft = normalizeAiDraft(parseAiJsonResponse(text), aiDraftType);
    renderAiDraftPreview();
    showToast('Draft ready! Review before applying.', 'success');
  } catch (err) {
    console.error('AI draft error:', err);
    showToast('AI draft failed: ' + err.message, 'error');
  }
}

function parseAiJsonResponse(text) {
  if (!text) {
    throw new Error('AI response was empty.');
  }

  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json/i, '```');
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }

  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return JSON.parse(cleaned);
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  }

  throw new Error('AI response was not valid JSON.');
}

function normalizeAiDraft(draft, type) {
  if (!draft || typeof draft !== 'object') return draft;

  if (type === 'announcement') {
    return {
      title: typeof draft.title === 'string' ? draft.title : '',
      content: typeof draft.content === 'string' ? draft.content : ''
    };
  }

  if (type === 'quiz') {
    return {
      title: typeof draft.title === 'string' ? draft.title : '',
      description: typeof draft.description === 'string' ? draft.description : '',
      questions: Array.isArray(draft.questions) ? draft.questions : []
    };
  }

  if (type === 'rubric') {
    return {
      criteria: Array.isArray(draft.criteria) ? draft.criteria : []
    };
  }

  return draft;
}

function renderAiDraftPreview() {
  const preview = document.getElementById('aiDraftPreview');
  if (!preview) return;
  
  if (!aiDraft) {
    preview.innerHTML = '<div class="muted">Generate a draft to preview it here.</div>';
    return;
  }
  
  if (aiDraftType === 'announcement') {
    preview.innerHTML = `
      <div class="card">
        <div class="card-title">${aiDraft.title || 'Untitled announcement'}</div>
        <div class="markdown-content">${renderMarkdown(aiDraft.content || '')}</div>
      </div>
    `;
    return;
  }
  
  if (aiDraftType === 'quiz') {
    preview.innerHTML = `
      <div class="card">
        <div class="card-title">${aiDraft.title || 'Untitled quiz'}</div>
        <div class="markdown-content">${renderMarkdown(aiDraft.description || '')}</div>
        <div class="muted" style="margin-top:8px;">${(aiDraft.questions || []).length} questions</div>
      </div>
    `;
    return;
  }
  
  preview.innerHTML = `
    <div class="card">
      <div class="card-title">Rubric draft</div>
      <ul>
        ${(aiDraft.criteria || []).map(c => `<li>${escapeHtml(c.name || 'Criterion')} (${c.points || 0} pts)</li>`).join('')}
      </ul>
    </div>
  `;
}

function applyAiDraft() {
  if (!aiDraft) {
    showToast('Generate a draft first', 'error');
    return;
  }
  
  if (aiDraftType === 'announcement') {
    ensureModalsRendered();
    document.getElementById('announcementTitle').value = aiDraft.title || '';
    document.getElementById('announcementContent').value = aiDraft.content || '';
    closeModal('aiCreateModal');
    openModal('announcementModal');
    return;
  }
  
  if (aiDraftType === 'quiz') {
    aiQuizDraft = aiDraft;
    closeModal('aiCreateModal');
    openQuizModal();
    return;
  }
  
  const assignmentId = document.getElementById('aiRubricAssignment').value;
  if (!assignmentId) {
    showToast('Select an assignment for the rubric', 'error');
    return;
  }
  aiRubricDraft = { assignmentId, criteria: aiDraft.criteria || [] };
  closeModal('aiCreateModal');
  openRubricModal(assignmentId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════

function ensureModalsRendered() {
  if (!document.getElementById('announcementModal')) {
    generateModals();
  }
}

// Track the element that was focused before modal opened (for accessibility)
let modalPreviousFocus = null;

function openModal(id) {
  if (!document.getElementById(id)) {
    generateModals();
  }
  const modal = document.getElementById(id);
  if (modal) {
    // Save currently focused element to restore later (WCAG 2.4.3)
    modalPreviousFocus = document.activeElement;

    modal.classList.add('visible');

    // Set ARIA attributes for accessibility
    const dialog = modal.querySelector('.modal');
    if (dialog) {
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');

      // Find the modal title and set aria-labelledby
      const title = dialog.querySelector('.modal-title');
      if (title) {
        const titleId = title.id || `${id}-title`;
        title.id = titleId;
        dialog.setAttribute('aria-labelledby', titleId);
      }
    }

    // Focus first focusable element (WCAG 2.4.3)
    setTimeout(() => {
      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length > 0) focusable[0].focus();
    }, 50);
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('visible');

  if (id === 'quizTakeModal' && quizTimerInterval) {
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;
  }

  // Restore focus to previously focused element (WCAG 2.4.3)
  if (modalPreviousFocus && typeof modalPreviousFocus.focus === 'function') {
    modalPreviousFocus.focus();
    modalPreviousFocus = null;
  }
}

// Escape key handler for modals (WCAG 2.1.1 - Keyboard)
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const visibleModal = document.querySelector('.modal-overlay.visible');
    if (visibleModal) {
      closeModal(visibleModal.id);
    }
  }
});

function generateModals() {
  // Get modules for external link dropdown
  const modules = (appData.modules || []).filter(m => m.courseId === activeCourseId);
  const moduleOptions = modules.length
    ? modules.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')
    : '<option value="">No modules available</option>';

  setHTML('modalsContainer', `
    <!-- Unified Content Creation Modal -->
    <div class="modal-overlay" id="unifiedContentModal">
      <div class="modal" style="max-width:600px;">
        <div class="modal-header">
          <h2 class="modal-title">Create New Content</h2>
          <button class="modal-close" onclick="closeModal('unifiedContentModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px;">
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('assignment')">
              <div style="font-size:1.5rem; margin-bottom:8px;">📝</div>
              <div class="demo-title">Assignment</div>
              <div class="demo-sub">Homework, essays, projects</div>
            </button>
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('quiz')">
              <div style="font-size:1.5rem; margin-bottom:8px;">❓</div>
              <div class="demo-title">Quiz</div>
              <div class="demo-sub">Multiple choice, true/false</div>
            </button>
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('announcement')">
              <div style="font-size:1.5rem; margin-bottom:8px;">📢</div>
              <div class="demo-title">Announcement</div>
              <div class="demo-sub">Announcements for students</div>
            </button>
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('file')">
              <div style="font-size:1.5rem; margin-bottom:8px;">📄</div>
              <div class="demo-title">File</div>
              <div class="demo-sub">Upload documents</div>
            </button>
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('external-link')">
              <div style="font-size:1.5rem; margin-bottom:8px;">🔗</div>
              <div class="demo-title">External Link</div>
              <div class="demo-sub">YouTube, websites</div>
            </button>
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('ai-assist')">
              <div style="font-size:1.5rem; margin-bottom:8px;">✨</div>
              <div class="demo-title">AI Generate</div>
              <div class="demo-sub">Draft with AI assistance</div>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('unifiedContentModal')">Cancel</button>
        </div>
      </div>
    </div>

    <!-- External Link Modal -->
    <div class="modal-overlay" id="externalLinkModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add External Link</h2>
          <button class="modal-close" onclick="closeModal('externalLinkModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px; padding:12px; background:var(--primary-light); border-radius:var(--radius);">
            💡 YouTube links are automatically converted to embeds for inline viewing.
          </div>
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="externalLinkTitle" placeholder="e.g., Lecture Video #1">
          </div>
          <div class="form-group">
            <label class="form-label">URL</label>
            <input type="url" class="form-input" id="externalLinkUrl" placeholder="https://...">
          </div>
          <div class="form-group">
            <label class="form-label">Add to</label>
            <select class="form-select" id="externalLinkType" onchange="document.getElementById('externalLinkModuleGroup').style.display = this.value === 'module' ? 'block' : 'none';">
              <option value="file">Files (as external link)</option>
              <option value="module">Module item</option>
            </select>
          </div>
          <div class="form-group" id="externalLinkModuleGroup" style="display:none;">
            <label class="form-label">Select Module</label>
            <select class="form-select" id="externalLinkModuleSelect">
              ${moduleOptions}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('externalLinkModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveExternalLink()">Add Link</button>
        </div>
      </div>
    </div>

    <!-- Announcement Modal -->
    <div class="modal-overlay" id="announcementModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="announcementModalTitle">New Announcement</h2>
          <button class="modal-close" onclick="closeModal('announcementModal'); resetAnnouncementModal();">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="announcementTitle" placeholder="Enter title">
          </div>
          <div class="form-group">
            <label class="form-label">Content</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('announcementContent')" title="Insert Link">🔗 Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('announcementContent')" title="Insert File">📄 File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('announcementContent')" title="Insert Video">📹 Video</button>
            </div>
            <textarea class="form-textarea" id="announcementContent" placeholder="Write your update... (supports Markdown)"></textarea>
            <div class="hint" style="margin-top:4px;">Supports Markdown: **bold**, *italic*, [link](url)</div>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="announcementPinned">
              <span>Pin this announcement</span>
            </label>
            <div class="hint">Pinned announcements appear at the top of the Announcements page</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('announcementModal'); resetAnnouncementModal();">Cancel</button>
          <button class="btn btn-primary" id="announcementSubmitBtn" onclick="saveAnnouncementChanges()">Post</button>
        </div>
      </div>
    </div>

    <!-- Create Course Modal -->
    <div class="modal-overlay" id="createCourseModal">
      <div class="modal" style="max-width:600px;">
        <div class="modal-header">
          <h2 class="modal-title">Create Course</h2>
          <button class="modal-close" onclick="closeModal('createCourseModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="padding:12px; background:var(--primary-light); border-radius:var(--radius); margin-bottom:16px;">
            <label class="form-label" style="margin-bottom:8px;">Quick Start: Upload Syllabus (optional)</label>
            <div id="syllabusDropZone" class="drop-zone"
                 ondragover="handleDragOver(event, 'syllabusDropZone')"
                 ondragleave="handleDragLeave(event, 'syllabusDropZone')"
                 ondrop="handleSyllabusDrop(event)"
                 onclick="document.getElementById('courseCreationSyllabus').click()"
                 style="border:2px dashed var(--border-color); border-radius:var(--radius); padding:24px; text-align:center; cursor:pointer; transition:all 0.2s;">
              <div style="margin-bottom:8px;">📄</div>
              <div style="font-weight:500;">Drag & drop syllabus here</div>
              <div class="muted" style="font-size:0.85rem;">or click to browse (PDF, DOC, TXT)</div>
              <input type="file" id="courseCreationSyllabus" accept=".pdf,.doc,.docx,.txt" style="display:none;" onchange="onSyllabusFileSelected()">
            </div>
            <div id="courseCreationSyllabusStatus" style="margin-top:8px;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Course Name</label>
            <input type="text" class="form-input" id="courseName" placeholder="e.g., ECON 101 - Introduction to Economics">
          </div>
          <div class="form-group">
            <label class="form-label">Course Code</label>
            <input type="text" class="form-input" id="courseCode" placeholder="e.g., ECON101">
          </div>
          <div class="form-group">
            <label class="form-label">Description (optional)</label>
            <textarea class="form-textarea" id="courseDescription" placeholder="Course description..." rows="2"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Student Emails (optional)</label>
            <textarea class="form-textarea" id="courseEmails" placeholder="Enter emails separated by commas, semicolons, or newlines:
student1@university.edu, student2@university.edu" rows="3"></textarea>
            <div class="hint">Students will be invited to join the course</div>
          </div>
          <div id="courseCreationModulesPreview" style="display:none;">
            <label class="form-label">Modules to Create from Syllabus</label>
            <div id="courseCreationModulesList" style="max-height:200px; overflow-y:auto; border:1px solid var(--border-light); border-radius:var(--radius); padding:8px;"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('createCourseModal')">Cancel</button>
          <button class="btn btn-primary" onclick="createCourse()">Create Course</button>
        </div>
      </div>
    </div>

    <!-- Join Course Modal -->
    <div class="modal-overlay" id="joinCourseModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Join Course</h2>
          <button class="modal-close" onclick="closeModal('joinCourseModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Invite Code</label>
            <input type="text" class="form-input" id="joinCode" placeholder="Enter 6-character code" style="text-transform:uppercase;">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('joinCourseModal')">Cancel</button>
          <button class="btn btn-primary" onclick="joinCourse()">Join</button>
        </div>
      </div>
    </div>

    <!-- Assignment Modal -->
    <div class="modal-overlay" id="assignmentModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="assignmentModalTitle">New Assignment</h2>
          <button class="modal-close" onclick="closeModal('assignmentModal'); resetAssignmentModal();">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="assignmentTitle" placeholder="Enter title">
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('assignmentDescription')" title="Insert Link">🔗 Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('assignmentDescription')" title="Insert File">📄 File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('assignmentDescription')" title="Insert Video">📹 Video</button>
            </div>
            <textarea class="form-textarea" id="assignmentDescription" placeholder="Describe the assignment... (supports Markdown)"></textarea>
            <div class="hint" style="margin-top:4px;">Supports Markdown: **bold**, *italic*, [link](url)</div>
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" id="assignmentCategory">
              <option value="homework">Homework</option>
              <option value="quiz">Quiz</option>
              <option value="exam">Exam</option>
              <option value="essay">Essay</option>
              <option value="project">Project</option>
              <option value="participation">Participation</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Points</label>
            <input type="number" class="form-input" id="assignmentPoints" value="100" min="1">
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" class="form-input" id="assignmentDueDate" style="margin-bottom:8px;">
            <div style="display:flex; gap:8px; align-items:center;">
              <select class="form-select" id="assignmentDueHour" style="width:auto;">
                <option value="12">12</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
                <option value="11">11</option>
              </select>
              <span>:</span>
              <select class="form-select" id="assignmentDueMinute" style="width:auto;">
                <option value="00">00</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
              </select>
              <select class="form-select" id="assignmentDueAmPm" style="width:auto;">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="assignmentStatus">
              <option value="draft">Draft (not visible to students)</option>
              <option value="published">Published</option>
              <option value="closed">Closed (no new submissions)</option>
            </select>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="assignmentAllowLate" checked>
              <span>Allow late submissions</span>
            </label>
          </div>
          <div class="form-group" id="lateDeductionGroup">
            <label class="form-label">Late Deduction (% per day)</label>
            <input type="number" class="form-input" id="assignmentLateDeduction" value="10" min="0" max="100">
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="assignmentAllowResubmit" checked>
              <span>Allow resubmission</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('assignmentModal'); resetAssignmentModal();">Cancel</button>
          <button class="btn btn-primary" id="assignmentSubmitBtn" onclick="saveAssignmentChanges()">Create</button>
        </div>
      </div>
    </div>

    <!-- Quiz Modal -->
    <div class="modal-overlay" id="quizModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title" id="quizModalTitle">New Quiz</h2>
          <button class="modal-close" onclick="closeModal('quizModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Quiz Title</label>
            <input type="text" class="form-input" id="quizTitle" placeholder="e.g., Week 2 Quiz">
          </div>
          <div class="form-group">
            <label class="form-label">Description (optional)</label>
            <textarea class="form-textarea" id="quizDescription" placeholder="Add instructions..." rows="3"></textarea>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Due Date</label>
              <input type="date" class="form-input" id="quizDueDate" style="margin-bottom:8px;">
              <div style="display:flex; gap:8px; align-items:center;">
                <select class="form-select" id="quizDueHour" style="width:auto;">
                  <option value="12">12</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                  <option value="11">11</option>
                </select>
                <span>:</span>
                <select class="form-select" id="quizDueMinute" style="width:auto;">
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
                <select class="form-select" id="quizDueAmPm" style="width:auto;">
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" id="quizStatus">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Time Limit (minutes)</label>
              <input type="number" class="form-input" id="quizTimeLimit" min="0" placeholder="e.g., 30">
            </div>
            <div class="form-group">
              <label class="form-label">Attempts Allowed</label>
              <input type="number" class="form-input" id="quizAttempts" min="0" placeholder="Leave blank for unlimited">
            </div>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="quizRandomize" checked>
              <span>Randomize question order</span>
            </label>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="quizPoolEnabled" onchange="toggleQuizPoolFields()">
              <span>Use question pool (random subset)</span>
            </label>
          </div>
          <div class="form-group" id="quizPoolCountGroup" style="display:none;">
            <label class="form-label">Questions to show</label>
            <input type="number" class="form-input" id="quizPoolCount" min="1" placeholder="e.g., 5">
          </div>
          <div class="card" style="padding:16px; margin-top:16px;">
            <div class="card-title">Questions</div>
            <div id="quizQuestionsList" class="quiz-questions-list"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
              <button class="btn btn-secondary btn-sm" onclick="addQuizQuestion()">Add Question</button>
              <div class="muted">Total Points: <span id="quizPointsTotal">0</span></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveQuiz()">Save Quiz</button>
        </div>
      </div>
    </div>

    <!-- Quiz Take Modal -->
    <div class="modal-overlay" id="quizTakeModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="quizTakeTitle">Take Quiz</h2>
            <div class="muted" id="quizTakeMeta"></div>
          </div>
          <div class="quiz-timer" id="quizTimer">No time limit</div>
          <button class="modal-close" onclick="closeModal('quizTakeModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div id="quizTakeQuestions" class="quiz-take-list"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizTakeModal')">Cancel</button>
          <button class="btn btn-primary" onclick="submitQuiz()">Submit Quiz</button>
        </div>
      </div>
    </div>

    <!-- Quiz Submissions Modal -->
    <div class="modal-overlay" id="quizSubmissionsModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title" id="quizSubmissionsTitle">Quiz Submissions</h2>
          <button class="modal-close" onclick="closeModal('quizSubmissionsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div id="quizSubmissionsList"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizSubmissionsModal')">Close</button>
        </div>
      </div>
    </div>

    <!-- Quiz Grade Modal -->
    <div class="modal-overlay" id="quizGradeModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="quizGradeTitle">Grade Quiz</h2>
            <div class="muted" id="quizGradePoints"></div>
          </div>
          <button class="modal-close" onclick="closeModal('quizGradeModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="quizGradeSubmissionId">
          <input type="hidden" id="quizGradeQuizId">
          <div id="quizGradeAnswers" class="quiz-grade-list"></div>
          <div class="form-group">
            <label class="form-label">Score</label>
            <input type="number" class="form-input" id="quizGradeScore" min="0" placeholder="Enter score">
          </div>
          <div class="form-group">
            <label class="form-label">Feedback (optional)</label>
            <textarea class="form-textarea" id="quizGradeFeedback" rows="3" placeholder="Leave feedback..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizGradeModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveQuizGrade()">Save Grade</button>
        </div>
      </div>
    </div>

    <!-- Quiz Review Modal -->
    <div class="modal-overlay" id="quizReviewModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title" id="quizReviewTitle">Quiz Submission</h2>
          <button class="modal-close" onclick="closeModal('quizReviewModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div id="quizReviewList" class="quiz-grade-list"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizReviewModal')">Close</button>
        </div>
      </div>
    </div>

    <!-- Submit Assignment Modal -->
    <div class="modal-overlay" id="submitModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Submit Assignment</h2>
          <button class="modal-close" onclick="closeModal('submitModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="submitModalAssignmentId">
          <div class="form-group">
            <label class="form-label">Submission Text</label>
            <textarea class="form-textarea" id="submissionText" placeholder="Enter your submission..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Upload File (optional)</label>
            <input type="file" class="form-input" id="submissionFile">
            <div class="hint">Files under 1MB stored locally. Larger files: metadata only.</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('submitModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveSubmission()">Submit</button>
        </div>
      </div>
    </div>

    <!-- File Upload Modal -->
    <div class="modal-overlay" id="fileUploadModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Upload Files</h2>
          <button class="modal-close" onclick="closeModal('fileUploadModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Select Files (up to 50)</label>
            <div id="fileDropZone"
                 style="border:2px dashed var(--border-color); border-radius:var(--radius); padding:32px; text-align:center; cursor:pointer; transition: all 0.2s;"
                 ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'; this.style.background='var(--primary-light)';"
                 ondragleave="this.style.borderColor='var(--border-color)'; this.style.background='';"
                 ondrop="handleFilesDrop(event)"
                 onclick="document.getElementById('fileUpload').click()">
              <div style="font-size:2rem; margin-bottom:8px; opacity:0.5;">📁</div>
              <div style="font-weight:500; margin-bottom:4px;">Drag and drop files here</div>
              <div class="muted">or click to browse</div>
            </div>
            <input type="file" class="form-input" id="fileUpload" multiple style="display:none;" onchange="updateFileUploadPreview()">
            <div id="fileUploadPreview" style="margin-top:12px;"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('fileUploadModal')">Cancel</button>
          <button class="btn btn-primary" onclick="uploadFiles()">Upload</button>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div class="modal-overlay" id="settingsModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Settings</h2>
          <button class="modal-close" onclick="closeModal('settingsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="padding:16px; background:var(--success-light, #e8f5e9); border-radius:var(--radius); margin-bottom:16px;">
            <div style="font-weight:600; margin-bottom:8px;">Authentication</div>
            <div class="hint">
              Signed in with Google.<br>
              User: <strong>${appData.currentUser?.email || 'Not signed in'}</strong>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="settingsGeminiKey">Gemini API Key (AI Features)</label>
            <input type="password" class="form-input" id="settingsGeminiKey"
                   placeholder="AIza..."
                   value="${window.GEMINI_API_KEY || appData.settings.geminiKey || ''}"
                   autocomplete="off" spellcheck="false">
            <div class="hint">
              ${window.GEMINI_API_KEY ? '✓ Loaded (saved to your profile)' : 'For AI features. Get from Google AI Studio. Your key is securely stored in your profile.'}
            </div>
          </div>
          
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('settingsModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveSettings()">Save</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="startHereModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title">Edit Start Here</h2>
          <button class="modal-close" onclick="closeModal('startHereModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="startHereCourseId">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="startHereTitle" placeholder="Start Here">
          </div>
          <div class="form-group">
            <label class="form-label">Intro content (supports Markdown)</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('startHereContent')" title="Insert Link">🔗 Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('startHereContent')" title="Insert File">📄 File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('startHereContent')" title="Insert Video">📹 Video</button>
            </div>
            <textarea class="form-textarea" id="startHereContent" rows="4" placeholder="Welcome message..."></textarea>
            <div class="hint" style="margin-top:4px;">Supports Markdown: **bold**, *italic*, [link](url)</div>
          </div>
          <div class="form-group">
            <label class="form-label">Pinned essentials</label>
            <div class="hint" style="margin-bottom:8px;">Add essential links for students (syllabus, office hours, etc.)</div>
            <div id="startHereLinksEditor"></div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addStartHereLink()" style="margin-top:8px;">+ Add link</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('startHereModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveStartHere()">Save</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="aiCreateModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title">AI Create</h2>
          <button class="modal-close" onclick="closeModal('aiCreateModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Create</label>
              <select class="form-select" id="aiCreateType" onchange="updateAiCreateType()">
                <option value="announcement">Announcement</option>
                <option value="quiz">Quiz</option>
                <option value="rubric">Rubric</option>
              </select>
            </div>
            <div class="form-group" id="aiQuizGroup">
              <label class="form-label">Question count</label>
              <input type="number" class="form-input" id="aiQuestionCount" min="1" value="5">
            </div>
          </div>
          <div class="form-group" id="aiRubricGroup" style="display:none;">
            <label class="form-label">Assignment</label>
            <select class="form-select" id="aiRubricAssignment"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Prompt</label>
            <textarea class="form-textarea" id="aiCreatePrompt" rows="4" placeholder="Describe what you want the AI to draft..."></textarea>
          </div>
          <div class="card" style="padding:16px; margin-top:12px;">
            <div class="card-title">Preview</div>
            <div id="aiDraftPreview" class="ai-preview"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('aiCreateModal')">Cancel</button>
          <button class="btn btn-secondary" onclick="generateAiDraft()">Generate Draft</button>
          <button class="btn btn-primary" onclick="applyAiDraft()">Use Draft</button>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div class="modal-overlay" id="confirmModal">
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <h2 class="modal-title" id="confirmTitle">Confirm</h2>
          <button class="modal-close" onclick="closeModal('confirmModal')">&times;</button>
        </div>
        <div class="modal-body">
          <p id="confirmMessage"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('confirmModal')">Cancel</button>
          <button class="btn btn-primary" id="confirmButton">Confirm</button>
        </div>
      </div>
    </div>

    <!-- Edit Course Modal -->
    <div class="modal-overlay" id="editCourseModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Edit Course</h2>
          <button class="modal-close" onclick="closeModal('editCourseModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Course Name</label>
            <input type="text" class="form-input" id="editCourseName" placeholder="e.g., ECON 101 - Introduction to Economics">
          </div>
          <div class="form-group">
            <label class="form-label">Course Code</label>
            <input type="text" class="form-input" id="editCourseCode" placeholder="e.g., ECON101">
          </div>
          <div class="form-group">
            <label class="form-label">Description (optional)</label>
            <textarea class="form-textarea" id="editCourseDescription" placeholder="Course description..." rows="3"></textarea>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="editCourseActive" checked>
              <span>Course is active</span>
            </label>
            <div class="hint">Inactive courses are hidden from the course list but data is preserved</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('editCourseModal')">Cancel</button>
          <button class="btn btn-primary" onclick="updateCourse()">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- Import Content Modal -->
    <div class="modal-overlay" id="importContentModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Import Content</h2>
          <button class="modal-close" onclick="closeModal('importContentModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Select Source Course</label>
            <select class="form-select" id="importSourceCourse">
              <option value="">-- Select a course --</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Content to import</label>
            <select class="form-select" id="importContentTypes" multiple size="6">
              <option value="assignments" selected>Assignments</option>
              <option value="quizzes" selected>Quizzes</option>
              <option value="announcements">Announcements</option>
              <option value="files">Files</option>
              <option value="categoryWeights">Grade Category Weights</option>
            </select>
            <div class="hint">Hold Ctrl (Windows) or ⌘ (Mac) to select multiple items.</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('importContentModal')">Cancel</button>
          <button class="btn btn-primary" onclick="executeImportContent()">Import Selected Content</button>
        </div>
      </div>
    </div>

    <!-- Add Person Modal -->
    <div class="modal-overlay" id="addPersonModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add Person to Course</h2>
          <button class="modal-close" onclick="closeModal('addPersonModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="addPersonEmail">Email Address</label>
            <input type="email" class="form-input" id="addPersonEmail" placeholder="student@university.edu" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" id="addPersonRole">
              <option value="student">Student</option>
              <option value="ta">Teaching Assistant</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('addPersonModal')">Cancel</button>
          <button class="btn btn-primary" onclick="addPersonToCourse()">Add Person</button>
        </div>
      </div>
    </div>

    <!-- Bulk Student Import Modal -->
    <div class="modal-overlay" id="bulkStudentImportModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Import Students</h2>
          <button class="modal-close" onclick="closeModal('bulkStudentImportModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:12px;">
            Upload a file with email addresses (comma-delimited or one per row).
          </div>
          <div class="form-group">
            <label class="form-label">CSV File</label>
            <input type="file" class="form-input" id="bulkStudentFile" accept=".csv,text/csv">
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" id="bulkStudentRole">
              <option value="student" selected>Student</option>
              <option value="ta">Teaching Assistant</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('bulkStudentImportModal')">Cancel</button>
          <button class="btn btn-primary" onclick="processBulkStudentImport()">Import</button>
        </div>
      </div>
    </div>

    <!-- Bulk Grade Modal -->
    <div class="modal-overlay" id="bulkGradeModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="bulkGradeTitle">Bulk Grade Entry</h2>
          <button class="modal-close" onclick="closeModal('bulkGradeModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:12px;">
            Paste data from spreadsheet. Format: Student Email, Score, Feedback (one per line)
          </div>
          <div class="form-group">
            <label class="form-label">Paste Grade Data</label>
            <textarea class="form-textarea" id="bulkGradeData" placeholder="student1@example.com, 95, Excellent work
student2@example.com, 87, Good job
student3@example.com, 92, Well done" rows="10"></textarea>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="bulkGradeRelease">
              <span>Release all grades to students</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('bulkGradeModal')">Cancel</button>
          <button class="btn btn-primary" onclick="processBulkGrades()">Import Grades</button>
        </div>
      </div>
    </div>

    <!-- Category Weights Modal -->
    <div class="modal-overlay" id="categoryWeightsModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Grade Category Weights</h2>
          <button class="modal-close" onclick="closeModal('categoryWeightsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px;">
            Set the weight for each category. Weights must add up to 100%.
          </div>
          <div id="categoryWeightsList"></div>
          <div style="margin-top:12px; padding:12px; background:var(--bg-color); border-radius:var(--radius);">
            <strong>Total: <span id="totalWeight">0</span>%</strong>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('categoryWeightsModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveCategoryWeights()">Save Weights</button>
        </div>
      </div>
    </div>

    <!-- Rubric Modal -->
    <div class="modal-overlay" id="rubricModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Create Rubric</h2>
          <button class="modal-close" onclick="closeModal('rubricModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px;">
            Define grading criteria. Points for each criterion must add up to the assignment's total points.
          </div>
          <button class="btn btn-secondary btn-sm" onclick="openAiCreateModal('rubric', currentRubricAssignment)">AI Draft Rubric</button>
          <div id="rubricCriteriaList"></div>
          <button class="btn btn-secondary" style="margin-top:12px; width:100%;" onclick="addRubricCriterion()">+ Add Criterion</button>
          <div style="margin-top:12px; padding:12px; background:var(--bg-color); border-radius:var(--radius);">
            <strong>Total Points: <span id="rubricTotalPoints">0</span> / <span id="rubricMaxPoints">100</span></strong>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('rubricModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveRubric()">Save Rubric</button>
        </div>
      </div>
    </div>

    <!-- Module Modal -->
    <div class="modal-overlay" id="moduleModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="moduleModalTitle">New Module</h2>
          <button class="modal-close" onclick="closeModal('moduleModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="moduleId">
          <div class="form-group">
            <label class="form-label">Module Name</label>
            <input type="text" class="form-input" id="moduleName" placeholder="e.g., Week 1: Introduction">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('moduleModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveModule()">Save Module</button>
        </div>
      </div>
    </div>

    <!-- Add Module Item Modal -->
    <div class="modal-overlay" id="addModuleItemModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add Item to Module</h2>
          <button class="modal-close" onclick="closeModal('addModuleItemModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="addItemModuleId">
          <div class="form-group">
            <label class="form-label">Item Type</label>
            <select class="form-select" id="addItemType" onchange="updateAddItemOptions()">
              <option value="assignment">Assignment</option>
              <option value="quiz">Quiz</option>
              <option value="file">File</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Select Item</label>
            <select class="form-select" id="addItemRef"></select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('addModuleItemModal')">Cancel</button>
          <button class="btn btn-primary" onclick="addModuleItem()">Add Item</button>
        </div>
      </div>
    </div>

    <!-- Syllabus Parser Modal -->
    <div class="modal-overlay" id="syllabusParserModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title">Import from Syllabus</h2>
          <button class="modal-close" onclick="closeModal('syllabusParserModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px;">
            Upload a syllabus file or paste syllabus text. AI will extract modules, assignments, and quizzes as drafts.
          </div>
          <div class="form-group">
            <label class="form-label">Upload Syllabus</label>
            <div id="syllabusParserDropZone" class="drop-zone"
                 ondragover="handleDragOver(event, 'syllabusParserDropZone')"
                 ondragleave="handleDragLeave(event, 'syllabusParserDropZone')"
                 ondrop="handleSyllabusParserDrop(event)"
                 onclick="document.getElementById('syllabusFile').click()"
                 style="border:2px dashed var(--border-color); border-radius:var(--radius); padding:24px; text-align:center; cursor:pointer; transition:all 0.2s;">
              <div style="margin-bottom:8px;">📄</div>
              <div style="font-weight:500;">Drag & drop syllabus here</div>
              <div class="muted" style="font-size:0.85rem;">or click to browse (PDF, DOC, TXT)</div>
              <input type="file" id="syllabusFile" accept=".pdf,.doc,.docx,.txt" style="display:none;" onchange="onSyllabusParserFileSelected()">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Or Paste Syllabus Text</label>
            <textarea class="form-textarea" id="syllabusText" rows="6" placeholder="Paste syllabus content here..."></textarea>
          </div>
          <button class="btn btn-primary" onclick="parseSyllabus()" style="margin-bottom:16px;">Parse with AI</button>
          <div class="card" style="padding:16px; max-height:400px; overflow-y:auto;">
            <div class="card-title">Parsed Content</div>
            <div id="syllabusParsedPreview"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('syllabusParserModal')">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Audio Input Modal -->
    <div class="modal-overlay" id="audioInputModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title">Voice Command</h2>
          <button class="modal-close" onclick="closeModal('audioInputModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px;">
            Record or upload audio to create announcements or quizzes. Say things like "send an announcement at midnight tomorrow about the exam" or "create a quiz with five questions, due at 2pm on Dec 18".
          </div>
          <div class="form-group">
            <label class="form-label">Output Type</label>
            <select class="form-select" id="audioOutputType">
              <option value="announcement">Announcement</option>
              <option value="quiz">Quiz</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Record Audio</label>
            <div style="display:flex; gap:8px; margin-bottom:12px;">
              <button class="btn btn-primary" id="audioStartRecording" onclick="startAudioRecording()">🎤 Start Recording</button>
              <button class="btn btn-secondary" id="audioStopRecording" onclick="stopAudioRecording()" style="display:none;">⏹️ Stop Recording</button>
            </div>
            <div id="audioPreview"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Or Upload Audio File</label>
            <input type="file" class="form-input" id="audioFile" accept="audio/*">
          </div>
          <button class="btn btn-primary" onclick="transcribeAudio()" style="margin-bottom:16px;">Transcribe with AI</button>
          <div class="form-group">
            <label class="form-label">Transcription</label>
            <textarea class="form-textarea" id="audioTranscription" rows="3" readonly placeholder="Transcription will appear here..."></textarea>
          </div>
          <div class="card" style="padding:16px;">
            <div class="card-title">Preview</div>
            <div id="audioParsedPreview"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('audioInputModal')">Cancel</button>
        </div>
      </div>
    </div>

    <!-- SpeedGrader Modal -->
    <div class="modal-overlay" id="speedGraderModal">
      <div class="modal" style="max-width:1100px; height:90vh;">
        <div class="modal-header">
          <h2 class="modal-title" id="speedGraderTitle">SpeedGrader</h2>
          <button class="modal-close" onclick="closeModal('speedGraderModal')">&times;</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; height:calc(100% - 120px); overflow:hidden;">
          <div id="speedGraderNav" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border-color);"></div>
          <div style="margin:12px 0;">
            <select class="form-select" id="speedGraderStudentSelect" onchange="speedGraderSelectStudent(this.value)" style="width:100%;"></select>
          </div>
          <div style="display:flex; gap:24px; flex:1; overflow:hidden;">
            <div style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
              <div id="speedGraderStudentInfo" style="display:flex; align-items:center; gap:12px; padding:12px 0;"></div>
              <div id="speedGraderSubmission" style="flex:1; overflow-y:auto; padding:16px; background:var(--bg-color); border-radius:var(--radius);"></div>
            </div>
            <div style="width:350px; display:flex; flex-direction:column; gap:16px; overflow-y:auto;">
              <div id="speedGraderRubric"></div>
              <div class="form-group">
                <label class="form-label">Score</label>
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="number" class="form-input" id="speedGraderScore" min="0" style="width:100px;">
                  <span id="speedGraderScoreMax">/ 100</span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Feedback</label>
                <textarea class="form-textarea" id="speedGraderFeedback" rows="5" placeholder="Provide feedback..."></textarea>
              </div>
              <div class="form-group">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" id="speedGraderRelease">
                  <span>Release grade to student</span>
                </label>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary" id="speedGraderAiBtn" onclick="speedGraderDraftWithAI()">✨ AI Draft</button>
                <button class="btn btn-primary" id="speedGraderSaveBtn" onclick="saveSpeedGraderGrade()">Save & Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Question Bank Modal -->
    <div class="modal-overlay" id="questionBankModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title" id="questionBankModalTitle">Question Banks</h2>
          <button class="modal-close" onclick="closeModal('questionBankModal')">&times;</button>
        </div>
        <div class="modal-body" id="questionBankModalBody">
          <!-- Content rendered dynamically -->
        </div>
        <div class="modal-footer" id="questionBankModalFooter">
          <button class="btn btn-secondary" onclick="closeModal('questionBankModal')">Close</button>
          <button class="btn btn-primary" onclick="openCreateQuestionBankForm()">New Question Bank</button>
        </div>
      </div>
    </div>

    <!-- Question Bank Edit Modal -->
    <div class="modal-overlay" id="questionBankEditModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title" id="questionBankEditTitle">New Question Bank</h2>
          <button class="modal-close" onclick="closeModal('questionBankEditModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Bank Name</label>
            <input type="text" class="form-input" id="questionBankName" placeholder="e.g., Chapter 1 Questions">
          </div>
          <div class="form-group">
            <label class="form-label">Description (optional)</label>
            <textarea class="form-textarea" id="questionBankDescription" rows="2" placeholder="Description of this question bank..."></textarea>
          </div>
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <label class="form-label" style="margin:0;">Questions</label>
              <button class="btn btn-secondary btn-sm" onclick="addQuestionToBankForm()">+ Add Question</button>
            </div>
            <div id="questionBankQuestionsContainer">
              <!-- Questions rendered here -->
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('questionBankEditModal'); openQuestionBankModal();">Cancel</button>
          <button class="btn btn-primary" id="questionBankSaveBtn" onclick="saveQuestionBank()">Save Bank</button>
        </div>
      </div>
    </div>

    <!-- New Assignment Modal (direct creation with type) -->
    <div class="modal-overlay" id="newAssignmentModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title" id="newAssignmentModalTitle">New Assignment</h2>
          <button class="modal-close" onclick="closeModal('newAssignmentModal'); resetNewAssignmentModal();">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Assignment Type</label>
            <select class="form-select" id="newAssignmentType" onchange="handleNewAssignmentTypeChange()">
              <option value="essay">Essay</option>
              <option value="project">Project</option>
              <option value="homework">Homework</option>
              <option value="participation">Participation</option>
              <option value="quiz">Quiz</option>
              <option value="exam">Exam</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="newAssignmentTitle" placeholder="Enter title">
          </div>
          <div class="form-group">
            <label class="form-label">Description / Instructions</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('newAssignmentDescription')" title="Insert Link">🔗 Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('newAssignmentDescription')" title="Insert File">📄 File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('newAssignmentDescription')" title="Insert Video">📹 Video</button>
            </div>
            <textarea class="form-textarea" id="newAssignmentDescription" placeholder="Describe the assignment... (supports Markdown)"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Intro Notes (visible to students before starting)</label>
            <textarea class="form-textarea" id="newAssignmentIntroNotes" rows="2" placeholder="Optional notes shown to students before they begin..."></textarea>
          </div>

          <!-- Question Bank Section (for Quiz/Exam) -->
          <div id="questionBankSection" style="display:none; background:var(--surface); padding:16px; border-radius:var(--radius); margin-bottom:16px;">
            <h4 style="margin-bottom:12px;">Question Bank Settings</h4>
            <div class="form-group">
              <label class="form-label">Select Question Bank</label>
              <select class="form-select" id="newAssignmentQuestionBank">
                <option value="">-- Select a question bank --</option>
              </select>
              <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="openQuestionBankModal()">Manage Question Banks</button>
            </div>
            <div class="form-group">
              <label class="form-label">Number of Questions</label>
              <input type="number" class="form-input" id="newAssignmentNumQuestions" value="10" min="1" placeholder="Number of questions to include">
              <div class="hint">Leave blank or 0 to include all questions from the bank</div>
            </div>
            <div class="form-group">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="newAssignmentRandomizeQuestions" checked>
                <span>Randomize question order</span>
              </label>
            </div>
            <div class="form-group">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="newAssignmentRandomizeAnswers" checked>
                <span>Randomize answer choices</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Points</label>
            <input type="number" class="form-input" id="newAssignmentPoints" value="100" min="1">
          </div>

          <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">Available From</label>
              <input type="date" class="form-input" id="newAssignmentAvailableFrom">
            </div>
            <div class="form-group">
              <label class="form-label">Available Until</label>
              <input type="date" class="form-input" id="newAssignmentAvailableUntil">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" class="form-input" id="newAssignmentDueDate" style="margin-bottom:8px;">
            <div style="display:flex; gap:8px; align-items:center;">
              <select class="form-select" id="newAssignmentDueHour" style="width:auto;">
                <option value="12">12</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
                <option value="11" selected>11</option>
              </select>
              <span>:</span>
              <select class="form-select" id="newAssignmentDueMinute" style="width:auto;">
                <option value="00">00</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
                <option value="59" selected>59</option>
              </select>
              <select class="form-select" id="newAssignmentDueAmPm" style="width:auto;">
                <option value="AM">AM</option>
                <option value="PM" selected>PM</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="newAssignmentStatus">
              <option value="draft">Draft (not visible to students)</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="newAssignmentAllowLate" checked>
              <span>Allow late submissions</span>
            </label>
          </div>

          <div id="latePenaltySection">
            <div class="form-group">
              <label class="form-label">Late Penalty Type</label>
              <select class="form-select" id="newAssignmentLatePenaltyType">
                <option value="per_day">Percentage per day late</option>
                <option value="flat">Flat percentage overall</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Penalty Amount (%)</label>
              <input type="number" class="form-input" id="newAssignmentLatePenalty" value="10" min="0" max="100">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Grading Notes (private - only visible to instructors)</label>
            <textarea class="form-textarea" id="newAssignmentGradingNotes" rows="2" placeholder="Notes for graders (rubric guidance, common issues to watch for, etc.)"></textarea>
          </div>

          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="newAssignmentAllowResubmit" checked>
              <span>Allow resubmission</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('newAssignmentModal'); resetNewAssignmentModal();">Cancel</button>
          <button class="btn btn-primary" id="newAssignmentSubmitBtn" onclick="saveNewAssignment()">Create Assignment</button>
        </div>
      </div>
    </div>
  `);
}

async function saveSettings() {
  const geminiInput = document.getElementById('settingsGeminiKey')?.value.trim();

  // Only save if user explicitly entered a value (don't overwrite config.js with empty)
  if (geminiInput) {
    appData.settings.geminiKey = geminiInput;
    // Also set it on window for immediate use
    window.GEMINI_API_KEY = geminiInput;
    console.log('[Settings] Gemini API key updated');

    // Save to Supabase user profile
    if (appData.currentUser?.id) {
      await supabaseUpdateUserGeminiKey(appData.currentUser.id, geminiInput);
    }
  }


  saveData(appData);
  closeModal('settingsModal');
  showToast('Settings saved!', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

let currentEditCourseId = null;

function openEditCourseModal(courseId) {
  currentEditCourseId = courseId;
  const course = getCourseById(courseId);
  
  if (!course) return;
  
  // Ensure modals are rendered
  if (!document.getElementById('editCourseModal')) {
    generateModals();
  }
  
  document.getElementById('editCourseName').value = course.name || '';
  document.getElementById('editCourseCode').value = course.code || '';
  document.getElementById('editCourseDescription').value = course.description || '';
  
  // Add checkbox for active/inactive status
  const statusCheckbox = document.getElementById('editCourseActive');
  if (statusCheckbox) {
    statusCheckbox.checked = course.active !== false; // default to active
  }
  
  openModal('editCourseModal');
}

function updateCourse() {
  if (!currentEditCourseId) return;
  
  const course = getCourseById(currentEditCourseId);
  if (!course) return;
  
  course.name = document.getElementById('editCourseName').value.trim();
  course.code = document.getElementById('editCourseCode').value.trim();
  course.description = document.getElementById('editCourseDescription').value.trim();
  course.active = document.getElementById('editCourseActive').checked;
  
  if (!course.name || !course.code) {
    showToast('Please fill in course name and code', 'error');
    return;
  }
  
  saveData(appData);
  closeModal('editCourseModal');
  renderAll();
  showToast('Course updated', 'success');
}

function openImportContentModal() {
  ensureModalsRendered();
  const courses = getUserCourses(appData.currentUser.id).filter(c => c.role === 'instructor' && c.id !== activeCourseId);
  const options = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const select = document.getElementById('importSourceCourse');
  if (select) {
    select.innerHTML = '<option value="">-- Select a course --</option>' + options;
  }
  openModal('importContentModal');
}

function executeImportContent() {
  const sourceCourseId = document.getElementById('importSourceCourse').value;
  const typesSelect = document.getElementById('importContentTypes');
  const selectedTypes = typesSelect ? Array.from(typesSelect.selectedOptions).map(opt => opt.value) : [];

  if (!sourceCourseId) {
    showToast('Please select a source course', 'error');
    return;
  }

  if (!activeCourseId) {
    showToast('No active course', 'error');
    return;
  }

  if (selectedTypes.length === 0) {
    showToast('Select at least one content type to import', 'error');
    return;
  }

  let importedCount = 0;

  if (selectedTypes.includes('assignments')) {
    const assignments = appData.assignments.filter(a => a.courseId === sourceCourseId);
    assignments.forEach(assignment => {
      const newAssignment = {
        ...assignment,
        id: generateId(),
        courseId: activeCourseId,
        status: 'draft',
        createdAt: new Date().toISOString()
      };
      appData.assignments.push(newAssignment);
      importedCount++;
    });
  }

  if (selectedTypes.includes('quizzes')) {
    const quizzes = appData.quizzes.filter(q => q.courseId === sourceCourseId);
    quizzes.forEach(quiz => {
      appData.quizzes.push({
        ...quiz,
        id: generateId(),
        courseId: activeCourseId,
        status: 'draft',
        createdAt: new Date().toISOString(),
        questions: (quiz.questions || []).map(q => ({
          ...q,
          id: generateId()
        }))
      });
      importedCount++;
    });
  }

  if (selectedTypes.includes('announcements')) {
    const announcements = appData.announcements.filter(a => a.courseId === sourceCourseId);
    announcements.forEach(announcement => {
      appData.announcements.push({
        ...announcement,
        id: generateId(),
        courseId: activeCourseId,
        authorId: appData.currentUser.id,
        createdAt: new Date().toISOString(),
        pinned: false
      });
      importedCount++;
    });
  }

  if (selectedTypes.includes('files')) {
    const files = appData.files.filter(f => f.courseId === sourceCourseId);
    files.forEach(file => {
      appData.files.push({
        ...file,
        id: generateId(),
        courseId: activeCourseId,
        uploadedBy: appData.currentUser.id,
        uploadedAt: new Date().toISOString()
      });
      importedCount++;
    });
  }

  if (selectedTypes.includes('categoryWeights') && appData.gradeCategories) {
    const weights = appData.gradeCategories.filter(w => w.courseId === sourceCourseId);
    appData.gradeCategories = appData.gradeCategories.filter(w => w.courseId !== activeCourseId);
    weights.forEach(weight => {
      appData.gradeCategories.push({
        ...weight,
        courseId: activeCourseId
      });
    });
    importedCount += weights.length;
  }

  saveData(appData);
  closeModal('importContentModal');
  renderAll();
  showToast(`Imported ${importedCount} items`, 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM CONFIRMATION DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function openAddPersonModal() {
  ensureModalsRendered();
  document.getElementById('addPersonEmail').value = '';
  document.getElementById('addPersonRole').value = 'student';
  openModal('addPersonModal');
}

function openBulkStudentImportModal() {
  ensureModalsRendered();
  const fileInput = document.getElementById('bulkStudentFile');
  if (fileInput) fileInput.value = '';
  const roleSelect = document.getElementById('bulkStudentRole');
  if (roleSelect) roleSelect.value = 'student';
  openModal('bulkStudentImportModal');
}

function processBulkStudentImport() {
  const fileInput = document.getElementById('bulkStudentFile');
  const defaultRole = document.getElementById('bulkStudentRole').value;

  if (!activeCourseId) {
    showToast('No active course', 'error');
    return;
  }

  if (!fileInput || !fileInput.files[0]) {
    showToast('Please upload a CSV file', 'error');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function(event) {
    const text = event.target.result;

    // Support both comma-delimited and row-delimited formats
    // Split by newlines first, then by commas within each line
    const rawLines = text.split('\n').map(line => line.trim()).filter(line => line);

    // Extract all emails from the file (handles both formats)
    const emails = [];
    rawLines.forEach((line, index) => {
      // Skip header row if it looks like a header
      if (index === 0 && line.toLowerCase().includes('email')) {
        return;
      }
      // Split each line by comma to handle comma-delimited emails
      const parts = line.split(',').map(part => part.trim()).filter(part => part);
      parts.forEach(part => {
        // Only add if it looks like an email
        if (part.includes('@')) {
          emails.push(part);
        }
      });
    });

    if (!emails.length) {
      showToast('No valid email addresses found', 'error');
      return;
    }

    let added = 0;
    let invited = 0;
    let errors = 0;

    emails.forEach(email => {
      if (!email || !email.includes('@')) {
        errors += 1;
        return;
      }

      let user = appData.users.find(u => u.email === email);
      if (user) {
        const existing = appData.enrollments.find(e => e.userId === user.id && e.courseId === activeCourseId);
        if (existing) {
          existing.role = defaultRole;
        } else {
          appData.enrollments.push({
            userId: user.id,
            courseId: activeCourseId,
            role: defaultRole
          });
        }
        added += 1;
        return;
      }

      if (!appData.invites) appData.invites = [];
      appData.invites.push({
        courseId: activeCourseId,
        email: email,
        role: defaultRole,
        status: 'pending',
        sentAt: new Date().toISOString()
      });
      invited += 1;
    });

    saveData(appData);
    closeModal('bulkStudentImportModal');
    renderPeople();
    showToast(`Imported ${added} students, invited ${invited}. ${errors} errors.`, errors ? 'error' : 'success');
  };

  reader.onerror = function() {
    showToast('Failed to read CSV file', 'error');
  };

  reader.readAsText(file);
}

function addPersonToCourse() {
  const email = document.getElementById('addPersonEmail').value.trim();
  const role = document.getElementById('addPersonRole').value;
  
  if (!email) {
    showToast('Please enter an email address', 'error');
    return;
  }
  
  if (!activeCourseId) {
    showToast('No active course', 'error');
    return;
  }
  
  // Check if user exists
  let user = appData.users.find(u => u.email === email);
  
  if (user) {
    // User exists - check if already enrolled
    const existing = appData.enrollments.find(e => e.userId === user.id && e.courseId === activeCourseId);
    if (existing) {
      // Update role
      existing.role = role;
      showToast(`Updated ${user.name}'s role to ${role}`, 'success');
    } else {
      // Add enrollment
      appData.enrollments.push({
        userId: user.id,
        courseId: activeCourseId,
        role: role
      });
      showToast(`Added ${user.name} as ${role}`, 'success');
    }
  } else {
    // User doesn't exist - create invite
    if (!appData.invites) appData.invites = [];
    
    appData.invites.push({
      courseId: activeCourseId,
      email: email,
      role: role,
      status: 'pending',
      sentAt: new Date().toISOString()
    });
    
    showToast(`Invitation sent to ${email}`, 'success');
  }
  
  saveData(appData);
  closeModal('addPersonModal');
  renderPeople();
}

function removePersonFromCourse(userId, courseId) {
  const user = getUserById(userId);

  // Ensure modals exist before calling confirm
  if (!document.getElementById('confirmModal')) {
    generateModals();
  }

  confirm(`Remove ${user.name} from this course?`, () => {
    appData.enrollments = appData.enrollments.filter(e => !(e.userId === userId && e.courseId === courseId));
    saveData(appData);
    renderPeople();
    showToast(`Removed ${user.name}`, 'success');
  });
}

function revokeInvite(inviteId) {
  const invite = appData.invites.find(i => i.id === inviteId);
  if (!invite) return;

  // Ensure modals exist before calling confirm
  if (!document.getElementById('confirmModal')) {
    generateModals();
  }

  confirm(`Revoke invitation for ${invite.email}?`, async () => {
    // Delete from Supabase
    const success = await supabaseDeleteInvite(inviteId);
    if (!success) return;

    // Remove from local state
    appData.invites = appData.invites.filter(i => i.id !== inviteId);
    saveData(appData);
    renderPeople();
    showToast('Invitation revoked', 'success');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM CONFIRMATION DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function confirm(message, callback) {
  generateModals(); // Ensure modals are rendered
  document.getElementById('confirmTitle').textContent = 'Confirm Action';
  document.getElementById('confirmMessage').textContent = message;
  
  const confirmBtn = document.getElementById('confirmButton');
  
  // Remove old event listeners by cloning
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  
  newConfirmBtn.addEventListener('click', () => {
    closeModal('confirmModal');
    if (callback) callback();
  });
  
  openModal('confirmModal');
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUBRICS
// ═══════════════════════════════════════════════════════════════════════════════

let currentRubricAssignment = null;
let rubricCriteria = [];

function openRubricModal(assignmentId) {
  ensureModalsRendered();
  currentRubricAssignment = assignmentId;
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  
  if (!assignment) return;
  
  // Check if assignment already has a rubric
  const existingRubric = appData.rubrics?.find(r => r.assignmentId === assignmentId);
  
  if (aiRubricDraft && aiRubricDraft.assignmentId === assignmentId && aiRubricDraft.criteria?.length) {
    rubricCriteria = JSON.parse(JSON.stringify(aiRubricDraft.criteria));
    aiRubricDraft = null;
  } else if (existingRubric) {
    rubricCriteria = JSON.parse(JSON.stringify(existingRubric.criteria)); // Deep copy
  } else {
    rubricCriteria = [
      { name: 'Criterion 1', points: assignment.points / 4, description: '' }
    ];
  }
  
  document.getElementById('rubricMaxPoints').textContent = assignment.points;
  renderRubricCriteria();
  openModal('rubricModal');
}

function renderRubricCriteria() {
  let html = '';
  let totalPoints = 0;
  
  rubricCriteria.forEach((criterion, index) => {
    totalPoints += parseFloat(criterion.points) || 0;
    
    html += `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <input type="text" class="form-input" value="${criterion.name}" 
                 onchange="updateRubricCriterion(${index}, 'name', this.value)" 
                 placeholder="Criterion name" style="flex:1; margin-right:8px;">
          <input type="number" class="form-input" value="${criterion.points}" 
                 onchange="updateRubricCriterion(${index}, 'points', this.value)" 
                 placeholder="Points" style="width:80px; margin-right:8px;">
          <button class="btn btn-secondary btn-sm" onclick="removeRubricCriterion(${index})" style="padding:8px;">✕</button>
        </div>
        <textarea class="form-textarea" rows="2" 
                  onchange="updateRubricCriterion(${index}, 'description', this.value)"
                  placeholder="Description (optional)">${criterion.description || ''}</textarea>
      </div>
    `;
  });
  
  document.getElementById('rubricCriteriaList').innerHTML = html;
  document.getElementById('rubricTotalPoints').textContent = totalPoints.toFixed(1);
  
  // Color code total
  const maxPoints = parseFloat(document.getElementById('rubricMaxPoints').textContent);
  const totalEl = document.getElementById('rubricTotalPoints');
  if (Math.abs(totalPoints - maxPoints) < 0.1) {
    totalEl.style.color = 'var(--success)';
  } else {
    totalEl.style.color = 'var(--danger)';
  }
}

function addRubricCriterion() {
  rubricCriteria.push({
    name: `Criterion ${rubricCriteria.length + 1}`,
    points: 0,
    description: ''
  });
  renderRubricCriteria();
}

function removeRubricCriterion(index) {
  rubricCriteria.splice(index, 1);
  renderRubricCriteria();
}

function updateRubricCriterion(index, field, value) {
  if (field === 'points') {
    rubricCriteria[index][field] = parseFloat(value) || 0;
  } else {
    rubricCriteria[index][field] = value;
  }
  renderRubricCriteria();
}

function saveRubric() {
  if (!currentRubricAssignment) return;
  
  const assignment = appData.assignments.find(a => a.id === currentRubricAssignment);
  const totalPoints = rubricCriteria.reduce((sum, c) => sum + (parseFloat(c.points) || 0), 0);
  
  if (Math.abs(totalPoints - assignment.points) > 0.1) {
    showToast('Rubric points must equal assignment points', 'error');
    return;
  }
  
  if (!appData.rubrics) appData.rubrics = [];
  
  // Remove existing rubric for this assignment
  appData.rubrics = appData.rubrics.filter(r => r.assignmentId !== currentRubricAssignment);
  
  // Add new rubric
  const rubricId = generateId();
  appData.rubrics.push({
    id: rubricId,
    assignmentId: currentRubricAssignment,
    criteria: JSON.parse(JSON.stringify(rubricCriteria)) // Deep copy
  });
  
  // Update assignment to reference rubric
  assignment.rubric = rubricId;
  
  saveData(appData);
  closeModal('rubricModal');
  renderAssignments();
  showToast('Rubric saved', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEIGHTED GRADE CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

function openCategoryWeightsModal() {
  ensureModalsRendered();
  if (!appData.gradeCategories) appData.gradeCategories = [];
  
  const courseCategories = appData.gradeCategories.filter(c => c.courseId === activeCourseId);
  const existingCategories = new Set(courseCategories.map(c => c.name));
  
  // Get all unique categories used in assignments
  const allCategories = [...new Set(
    appData.assignments
      .filter(a => a.courseId === activeCourseId)
      .map(a => a.category)
  )];
  
  // Create category inputs
  let html = '';
  allCategories.forEach(category => {
    const existing = courseCategories.find(c => c.name === category);
    const weight = existing ? existing.weight * 100 : 0;
    
    html += `
      <div class="form-group">
        <label class="form-label">${category.charAt(0).toUpperCase() + category.slice(1)}</label>
        <input type="number" class="form-input category-weight" data-category="${category}" value="${weight}" min="0" max="100" step="1">
      </div>
    `;
  });
  
  setHTML('categoryWeightsList', html);
  
  // Update total when inputs change
  document.querySelectorAll('.category-weight').forEach(input => {
    input.addEventListener('input', updateTotalWeight);
  });
  
  updateTotalWeight();
  openModal('categoryWeightsModal');
}

function updateTotalWeight() {
  const inputs = document.querySelectorAll('.category-weight');
  let total = 0;
  inputs.forEach(input => {
    total += parseFloat(input.value) || 0;
  });
  document.getElementById('totalWeight').textContent = total.toFixed(1);
  
  // Color code the total
  const totalEl = document.getElementById('totalWeight');
  if (Math.abs(total - 100) < 0.1) {
    totalEl.style.color = 'var(--success)';
  } else {
    totalEl.style.color = 'var(--danger)';
  }
}

function saveCategoryWeights() {
  const inputs = document.querySelectorAll('.category-weight');
  let total = 0;
  
  const weights = [];
  inputs.forEach(input => {
    const weight = parseFloat(input.value) || 0;
    total += weight;
    weights.push({
      courseId: activeCourseId,
      name: input.dataset.category,
      weight: weight / 100
    });
  });
  
  if (Math.abs(total - 100) > 0.1) {
    showToast('Weights must add up to 100%', 'error');
    return;
  }
  
  // Remove old weights for this course
  appData.gradeCategories = appData.gradeCategories.filter(c => c.courseId !== activeCourseId);
  
  // Add new weights
  appData.gradeCategories.push(...weights);
  
  saveData(appData);
  closeModal('categoryWeightsModal');
  renderGradebook();
  showToast('Category weights saved', 'success');
}

function calculateWeightedGrade(userId, courseId) {
  if (!appData.gradeCategories) return null;
  
  const categoryWeights = appData.gradeCategories.filter(c => c.courseId === courseId);
  if (categoryWeights.length === 0) return null;
  
  const assignments = appData.assignments.filter(a => a.courseId === courseId);
  const categoryScores = {};
  
  // Calculate score for each category
  categoryWeights.forEach(cw => {
    const categoryAssignments = assignments.filter(a => a.category === cw.name);
    let totalScore = 0;
    let totalPoints = 0;
    
    categoryAssignments.forEach(assignment => {
      const submission = appData.submissions.find(s => s.assignmentId === assignment.id && s.userId === userId);
      const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;
      
      if (grade && grade.released) {
        totalScore += grade.score;
        totalPoints += assignment.points;
      }
    });
    
    if (totalPoints > 0) {
      categoryScores[cw.name] = {
        percentage: (totalScore / totalPoints) * 100,
        weight: cw.weight
      };
    }
  });
  
  // Calculate weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  
  Object.values(categoryScores).forEach(cs => {
    weightedSum += cs.percentage * cs.weight;
    totalWeight += cs.weight;
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK OPERATIONS & ADVANCED FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

let currentBulkAssignmentId = null;

function openBulkGradeModal(assignmentId) {
  ensureModalsRendered();
  currentBulkAssignmentId = assignmentId;
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  document.getElementById('bulkGradeTitle').textContent = `Bulk Grade: ${assignment.title}`;
  openModal('bulkGradeModal');
}

function processBulkGrades() {
  const data = document.getElementById('bulkGradeData').value.trim();
  const release = document.getElementById('bulkGradeRelease').checked;
  
  if (!data) {
    showToast('Please paste grade data', 'error');
    return;
  }
  
  const lines = data.split('\n').filter(l => l.trim());
  let imported = 0;
  let errors = 0;
  
  lines.forEach(line => {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 2) {
      errors++;
      return;
    }
    
    const email = parts[0];
    const score = parseFloat(parts[1]);
    const feedback = parts[2] || 'No feedback provided';
    
    if (isNaN(score)) {
      errors++;
      return;
    }
    
    // Find user
    const user = appData.users.find(u => u.email === email);
    if (!user) {
      errors++;
      return;
    }
    
    // Find submission
    const submission = appData.submissions.find(s => 
      s.assignmentId === currentBulkAssignmentId && s.userId === user.id
    );
    
    if (!submission) {
      errors++;
      return;
    }
    
    // Remove existing grade
    appData.grades = appData.grades.filter(g => g.submissionId !== submission.id);
    
    // Add new grade
    appData.grades.push({
      submissionId: submission.id,
      score: score,
      feedback: feedback,
      released: release,
      gradedBy: appData.currentUser.id,
      gradedAt: new Date().toISOString()
    });
    
    imported++;
  });
  
  saveData(appData);
  closeModal('bulkGradeModal');
  renderGradebook();
  showToast(`Imported ${imported} grades. ${errors} errors.`, imported > 0 ? 'success' : 'error');
  
  document.getElementById('bulkGradeData').value = '';
  document.getElementById('bulkGradeRelease').checked = false;
}

function bulkReleaseGrades(assignmentId) {
  confirm('Release all grades for this assignment to students?', () => {
    const submissions = appData.submissions.filter(s => s.assignmentId === assignmentId);
    let released = 0;
    
    submissions.forEach(submission => {
      const grade = appData.grades.find(g => g.submissionId === submission.id);
      if (grade && !grade.released) {
        grade.released = true;
        released++;
        
      }
    });
    
    saveData(appData);
    renderGradebook();
    showToast(`Released ${released} grades`, 'success');
  });
}

function viewSubmissionHistory(assignmentId, userId) {
  const submissions = appData.submissions
    .filter(s => s.assignmentId === assignmentId && s.userId === userId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  const student = getUserById(userId);
  
  const html = `
    <div class="modal-overlay visible" id="submissionHistoryModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title">Submission History: ${student.name}</h2>
          <button class="modal-close" onclick="closeModal('submissionHistoryModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="muted" style="margin-bottom:16px;">Assignment: ${assignment.title}</div>
          ${submissions.length === 0 ? '<div class="empty-state-text">No submissions yet</div>' : submissions.map((s, idx) => {
            const grade = appData.grades.find(g => g.submissionId === s.id);
            return `
              <div class="card" style="background:${idx === 0 ? 'var(--primary-light)' : 'var(--bg-color)'};">
                <div class="card-header">
                  <div>
                    <div class="card-title">${idx === 0 ? '📌 Current Submission' : `Submission ${submissions.length - idx}`}</div>
                    <div class="muted">Submitted ${formatDate(s.submittedAt)}</div>
                  </div>
                  ${grade ? `<span class="muted">${grade.score}/${assignment.points}</span>` : ''}
                </div>
                <div>${s.text || '<em class="muted">No text submission</em>'}</div>
                ${s.fileName ? `<div class="muted" style="margin-top:8px;">📎 ${s.fileName}</div>` : ''}
                ${grade && grade.feedback ? `<div style="margin-top:12px; padding:12px; background:var(--bg-card); border-radius:var(--radius);"><strong>Feedback:</strong> ${grade.feedback}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('submissionHistoryModal')">Close</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML += html;
}

function calculateLateDeduction(assignment, submittedAt) {
  if (!assignment.allowLateSubmissions) return 0;
  if (!assignment.lateDeduction) return 0;
  
  const dueDate = new Date(assignment.dueDate);
  const submitDate = new Date(submittedAt);
  
  if (submitDate <= dueDate) return 0;
  
  const daysLate = Math.ceil((submitDate - dueDate) / 86400000);
  const deduction = Math.min(daysLate * assignment.lateDeduction, 100);
  
  return deduction;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED CONTENT CREATION
// ═══════════════════════════════════════════════════════════════════════════════

function openUnifiedContentModal() {
  ensureModalsRendered();
  openModal('unifiedContentModal');
}

function createFromUnified(type) {
  closeModal('unifiedContentModal');
  if (type === 'assignment') {
    openAssignmentModal();
  } else if (type === 'quiz') {
    openQuizModal();
  } else if (type === 'announcement') {
    openAnnouncementModal();
  } else if (type === 'file') {
    openModal('fileUploadModal');
  } else if (type === 'external-link') {
    openExternalLinkModal();
  } else if (type === 'ai-assist') {
    openAiCreateModal();
  }
}

// New Assignment dropdown functions
function toggleNewAssignmentDropdown() {
  const dropdown = document.getElementById('newAssignmentDropdown');
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
}

function closeNewAssignmentDropdown() {
  const dropdown = document.getElementById('newAssignmentDropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('newAssignmentDropdown');
  const btn = document.getElementById('newAssignmentBtn');
  if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXTERNAL LINK SUPPORT
// ═══════════════════════════════════════════════════════════════════════════════

function openExternalLinkModal(prefillData = null) {
  ensureModalsRendered();
  document.getElementById('externalLinkTitle').value = prefillData?.title || '';
  document.getElementById('externalLinkUrl').value = prefillData?.url || '';
  document.getElementById('externalLinkType').value = prefillData?.type || 'module';
  openModal('externalLinkModal');
}

function ensureUrlProtocol(url) {
  if (!url) return url;
  url = url.trim();
  // If URL doesn't start with a protocol, add https://
  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url) && !/^tel:/i.test(url)) {
    return 'https://' + url;
  }
  return url;
}

function convertYouTubeUrl(url) {
  if (!url) return url;

  // Ensure URL has protocol before processing
  url = ensureUrlProtocol(url);

  // Convert YouTube watch URLs to embed URLs
  const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (watchMatch) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }

  // Already an embed URL
  if (url.includes('youtube.com/embed/')) {
    return url;
  }

  return url;
}

function saveExternalLink() {
  const title = document.getElementById('externalLinkTitle').value.trim();
  let url = document.getElementById('externalLinkUrl').value.trim();
  const type = document.getElementById('externalLinkType').value;

  if (!title || !url) {
    showToast('Please fill in title and URL', 'error');
    return;
  }

  // Ensure URL has a protocol
  url = ensureUrlProtocol(url);

  // Auto-convert YouTube URLs to embed format
  const convertedUrl = convertYouTubeUrl(url);
  const isYouTube = convertedUrl !== url;

  if (type === 'file') {
    // Create a file entry with external URL
    appData.files.push({
      id: generateId(),
      courseId: activeCourseId,
      name: title,
      type: 'external',
      size: 0,
      externalUrl: convertedUrl,
      isYouTube: isYouTube,
      uploadedBy: appData.currentUser.id,
      uploadedAt: new Date().toISOString()
    });
    saveData(appData);
    closeModal('externalLinkModal');
    renderFiles();
    showToast('External link added to files!', 'success');
  } else if (type === 'module') {
    // Create a module item with external URL
    const moduleId = document.getElementById('externalLinkModuleSelect')?.value;
    if (moduleId) {
      const module = appData.modules.find(m => m.id === moduleId);
      if (module) {
        module.items.push({
          id: generateId(),
          type: 'external',
          title: title,
          externalUrl: convertedUrl,
          isYouTube: isYouTube,
          position: module.items.length
        });
        saveData(appData);
        closeModal('externalLinkModal');
        renderModules();
        showToast('External link added to module!', 'success');
        return;
      }
    }
    showToast('Please select a module', 'error');
  } else if (type === 'announcement') {
    // Add link to announcement content
    const linkMarkdown = isYouTube
      ? `\n\n📺 **Video:** [${title}](${convertedUrl})`
      : `\n\n🔗 **Link:** [${title}](${convertedUrl})`;

    const contentArea = document.getElementById('announcementContent');
    if (contentArea) {
      contentArea.value += linkMarkdown;
    }
    closeModal('externalLinkModal');
    showToast('Link added to announcement content', 'success');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISIBILITY TOGGLES
// ═══════════════════════════════════════════════════════════════════════════════

function toggleAssignmentVisibility(assignmentId) {
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  if (!assignment) return;

  const wasPublished = assignment.status === 'published';
  assignment.status = wasPublished ? 'draft' : 'published';

  saveData(appData);
  renderAssignments();
  showToast(wasPublished ? 'Assignment hidden from students' : 'Assignment published!', 'success');
}

function toggleQuizVisibility(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  const wasPublished = quiz.status === 'published';
  quiz.status = wasPublished ? 'draft' : 'published';

  saveData(appData);
  renderAssignments();
  showToast(wasPublished ? 'Quiz hidden from students' : 'Quiz published!', 'success');
}

// Note: toggleFileVisibility is defined at line ~4951 - this duplicate was removed

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW QUIZ DETAILS (Full Preview)
// ═══════════════════════════════════════════════════════════════════════════════

function viewQuizDetails(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  const questions = quiz.questions || [];
  const totalPoints = getQuizPoints(quiz);

  const questionsHtml = questions.map((q, idx) => {
    let optionsHtml = '';
    if (q.type === 'multiple_choice') {
      optionsHtml = `<div class="quiz-options" style="margin-top:8px;">
        ${q.options.map((opt, i) => `
          <div style="padding:4px 8px; ${i === q.correctAnswer ? 'background:var(--success-light); border-radius:4px;' : ''}">
            ${i === q.correctAnswer ? '✓' : '○'} ${escapeHtml(opt)}
          </div>
        `).join('')}
      </div>`;
    } else if (q.type === 'true_false') {
      optionsHtml = `<div style="margin-top:8px;">
        <div style="padding:4px 8px; ${q.correctAnswer === 'True' ? 'background:var(--success-light); border-radius:4px;' : ''}">
          ${q.correctAnswer === 'True' ? '✓' : '○'} True
        </div>
        <div style="padding:4px 8px; ${q.correctAnswer === 'False' ? 'background:var(--success-light); border-radius:4px;' : ''}">
          ${q.correctAnswer === 'False' ? '✓' : '○'} False
        </div>
      </div>`;
    } else {
      optionsHtml = `<div class="muted" style="margin-top:8px; font-style:italic;">Short answer question${q.correctAnswer ? ` (Sample: ${escapeHtml(q.correctAnswer)})` : ''}</div>`;
    }

    return `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <strong>Q${idx + 1}. ${escapeHtml(q.prompt)}</strong>
          <span class="muted">${q.points} pts</span>
        </div>
        <div class="muted" style="font-size:0.85rem;">${q.type.replace('_', ' ')}</div>
        ${optionsHtml}
      </div>
    `;
  }).join('');

  const html = `
    <div class="modal-overlay visible" id="quizDetailsModal">
      <div class="modal" style="max-width:800px; max-height:90vh;">
        <div class="modal-header">
          <h2 class="modal-title">Quiz Preview: ${escapeHtml(quiz.title)}</h2>
          <button class="modal-close" onclick="closeModal('quizDetailsModal')">&times;</button>
        </div>
        <div class="modal-body" style="max-height:70vh; overflow-y:auto;">
          <div class="card" style="background:var(--primary-light); margin-bottom:16px;">
            <div class="card-header">
              <div>
                <div class="card-title">Quiz Settings</div>
              </div>
              <div style="text-align:right;">
                <div><strong>${totalPoints} points</strong></div>
                <div class="muted">${questions.length} questions</div>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-top:12px;">
              <div><strong>Due:</strong> ${formatDate(quiz.dueDate)}</div>
              <div><strong>Time Limit:</strong> ${quiz.timeLimit ? quiz.timeLimit + ' min' : 'None'}</div>
              <div><strong>Attempts:</strong> ${quiz.attempts || 'Unlimited'}</div>
              <div><strong>Randomize:</strong> ${quiz.randomizeQuestions ? 'Yes' : 'No'}</div>
              <div><strong>Status:</strong> ${quiz.status}</div>
              ${quiz.questionPoolEnabled ? `<div><strong>Pool:</strong> ${quiz.questionSelectCount} of ${questions.length}</div>` : ''}
            </div>
          </div>

          <div class="section-header">Questions</div>
          ${questionsHtml || '<div class="muted">No questions added yet</div>'}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizDetailsModal')">Close</button>
          <button class="btn btn-primary" onclick="closeModal('quizDetailsModal'); openQuizModal('${quizId}')">Edit Quiz</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalsContainer').innerHTML += html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT VIEW TOGGLE
// ═══════════════════════════════════════════════════════════════════════════════

function toggleStudentView() {
  studentViewMode = !studentViewMode;
  // Clear AI thread when switching views
  aiThread = [];
  renderAiThread();
  renderTopBarViewToggle();
  renderAll();
  showToast(studentViewMode ? 'Viewing as student' : 'Back to instructor view', 'info');
}

function renderTopBarViewToggle() {
  const container = document.getElementById('viewToggleContainer');
  if (!container) return;

  const isStaffUser = activeCourseId && isStaff(appData.currentUser.id, activeCourseId);

  if (isStaffUser) {
    if (studentViewMode) {
      // Show exit button only - role indicator is shown on Home page
      container.innerHTML = `
        <button class="btn btn-primary" onclick="toggleStudentView()" style="font-size:0.85rem; padding:6px 12px;">
          Exit Student View
        </button>
      `;
    } else {
      container.innerHTML = `
        <button class="btn btn-secondary" onclick="toggleStudentView()" style="font-size:0.85rem; padding:6px 12px;">
          Student View
        </button>
      `;
    }
    container.style.display = 'block';
  } else {
    container.innerHTML = '';
    container.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API RETRY LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 503 Service Unavailable
      if (response.status === 503 || response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        showToast(`AI service busy, retrying in ${waitTime/1000}s...`, 'info');
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        showToast(`Network error, retrying in ${waitTime/1000}s...`, 'info');
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED AI CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

function buildAiContext() {
  if (!activeCourseId) return '';

  const course = getCourseById(activeCourseId);
  const role = getUserRole(appData.currentUser.id, activeCourseId);
  const students = appData.enrollments.filter(e => e.courseId === activeCourseId && e.role === 'student');
  const assignments = appData.assignments.filter(a => a.courseId === activeCourseId);
  const quizzes = appData.quizzes.filter(q => q.courseId === activeCourseId);
  const modules = (appData.modules || []).filter(m => m.courseId === activeCourseId);
  const files = appData.files.filter(f => f.courseId === activeCourseId);
  const instructor = appData.enrollments.find(e => e.courseId === activeCourseId && e.role === 'instructor');
  const instructorUser = instructor ? getUserById(instructor.userId) : null;

  // Get course timezone (default to user's local)
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formattedDate = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Build assignment list with due dates
  const assignmentList = assignments.map(a => {
    const dueDate = new Date(a.dueDate);
    const isPast = dueDate < now;
    return `- "${a.title}" (${a.points} pts, due ${dueDate.toLocaleDateString()}${isPast ? ' - PAST DUE' : ''}, status: ${a.status})`;
  }).join('\n');

  // Build quiz list with due dates
  const quizList = quizzes.map(q => {
    const dueDate = new Date(q.dueDate);
    const isPast = dueDate < now;
    return `- "${q.title}" (${getQuizPoints(q)} pts, due ${dueDate.toLocaleDateString()}${isPast ? ' - PAST DUE' : ''}, status: ${q.status})`;
  }).join('\n');

  // Build module list
  const moduleList = modules.map(m => `- "${m.name}" (${m.items?.length || 0} items)`).join('\n');

  // Build file list with IDs for reference
  const fileList = files.map(f => {
    const desc = f.description ? ` - ${f.description}` : '';
    return `- "${f.name}" (id: ${f.id}, type: ${f.type}${f.externalUrl ? ', external' : ''}${desc})`;
  }).join('\n');

  return `
COURSE CONTEXT (use this for accurate information):
- Course Name: ${course.name}
- Course Code: ${course.code}
- Course Description: ${course.description || 'No description'}
- Instructor: ${instructorUser ? instructorUser.name : 'Unknown'}
- Your Role: ${role}
- Number of Students: ${students.length}

CURRENT DATE/TIME: ${formattedDate}
TIME ZONE: ${timeZone}

MODULES (${modules.length}):
${moduleList || 'No modules yet'}

ASSIGNMENTS (${assignments.length}):
${assignmentList || 'No assignments yet'}

QUIZZES (${quizzes.length}):
${quizList || 'No quizzes yet'}

COURSE FILES (${files.length}) - Use these file IDs to link to files in announcements/content:
${fileList || 'No files yet'}

`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Boot] Page loaded, initializing...');

  // Initialize Supabase client
  if (!initSupabase()) {
    console.error('[Boot] Failed to initialize Supabase');
    // Still show login screen so user can see the error
    showLoginScreen();
    return;
  }

  // Listen for auth state changes
  supabaseClient.auth.onAuthStateChange(handleAuthStateChange);

  // Check for existing session (handles page refresh and OAuth redirect)
  await checkExistingSession();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // ESC closes modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.visible').forEach(m => m.classList.remove('visible'));
      if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
      }
    }

    // Ctrl/Cmd+Enter sends AI message (or just Enter when in AI input)
    if (e.key === 'Enter' && !e.shiftKey) {
      if (document.activeElement?.id === 'aiInput') {
        e.preventDefault();
        sendAiMessage();
      }
    }
  });

  // Add keypress listener specifically for AI input
  setTimeout(() => {
    const aiInput = document.getElementById('aiInput');
    if (aiInput) {
      aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendAiMessage();
        }
      });
    }
  }, 500);

  console.log('[Boot] Initialization complete');
});
