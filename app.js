/* ═══════════════════════════════════════════════════════════════════════════════
   Campus LMS - Complete Implementation
   Supabase-powered LMS with Google OAuth, courses, assignments, gradebook, AI
═══════════════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE IMPORTS
// These modules contain extracted functionality from app.js
// ═══════════════════════════════════════════════════════════════════════════════

// Constants - role definitions, AI prompts, default values, messages
import {
  ROLES,
  ROLE_LABELS,
  AI_PROMPTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  ASSIGNMENT_CATEGORIES
} from './constants.js';

// Database interactions - all Supabase CRUD operations
import {
  initDatabaseModule,
  loadDataFromSupabase,
  supabaseCreateCourse,
  supabaseUpdateCourse,
  supabaseCreateEnrollment,
  supabaseUpdateEnrollment,
  supabaseDeleteEnrollment,
  supabaseCreateAssignment,
  supabaseUpdateAssignment,
  supabaseDeleteAssignment,
  supabaseCreateSubmission,
  supabaseCreateGrade,
  supabaseUpsertGrade,
  supabaseCreateGradeCategory,
  supabaseUpdateGradeCategory,
  supabaseDeleteGradeCategory,
  supabaseCreateAnnouncement,
  supabaseUpdateAnnouncement,
  supabaseDeleteAnnouncement,
  supabaseCreateQuiz,
  supabaseUpdateQuiz,
  supabaseDeleteQuiz,
  supabaseUpsertQuizSubmission,
  supabaseCreateFile,
  supabaseUpdateFile,
  supabaseDeleteFile,
  supabaseCreateModule,
  supabaseUpdateModule,
  supabaseDeleteModule,
  supabaseCreateModuleItem,
  supabaseDeleteModuleItem,
  supabaseCreateRubric,
  supabaseUpdateRubric,
  supabaseDeleteRubric,
  supabaseCreateQuestionBank,
  supabaseUpdateQuestionBank,
  supabaseDeleteQuestionBank,
  supabaseCreateInvite,
  supabaseDeleteInvite,
  supabaseCreateDiscussionThread,
  supabaseUpdateDiscussionThread,
  supabaseDeleteDiscussionThread,
  supabaseCreateDiscussionReply,
  supabaseDeleteDiscussionReply,
  supabaseUpsertAssignmentOverride,
  supabaseDeleteAssignmentOverride,
  supabaseUpsertQuizTimeOverride,
  supabaseDeleteQuizTimeOverride,
  supabaseUpsertGradeSettings,
  callGeminiAPI,
  callGeminiAPIWithRetry,
  downloadOneRosterExport,
  initCaliperSensor,
  caliperSessionLogin,
  caliperViewPage,
  caliperAssignmentSubmit,
  caliperGradePosted,
  caliperQuizStart,
  caliperQuizComplete
} from './database_interactions.js';

// UI Helpers - DOM manipulation, formatting, markdown
import {
  initUIHelpers,
  setText,
  setHTML,
  escapeHtml,
  showToast,
  formatDate,
  formatDateShort,
  formatDateTime,
  renderMarkdown,
  generateId,
  generateInviteCode,
  getQuizPoints,
  confirm as showConfirmDialog
} from './ui_helpers.js';

// Auth - Google OAuth via Supabase
import {
  initAuthModule,
  signInWithGoogle,
  handleAuthStateChange,
  handleSignedIn,
  logout,
  showLoginScreen
} from './auth.js';

// AI Features - Gemini API integration, chat, content generation
import {
  initAiModule,
  sendAiMessage,
  confirmAiAction,
  rejectAiAction as rejectAiActionFromModule,
  buildAiContext,
  renderAiThread,
  clearAiThread,
  draftGradeWithAI,
  generateAiDraft,
  setActiveCourse as setAIActiveCourseId,
  setStudentViewMode as setAIStudentViewMode
} from './ai_features.js';

// Quiz Logic - quiz creation, taking, grading
import {
  initQuizModule,
  openQuizModal,
  saveQuiz,
  takeQuiz,
  submitQuiz,
  calculateQuizAutoScore,
  viewQuizSubmissions,
  saveQuizGrade,
  viewQuizSubmission,
  setActiveCourseForQuiz as setQuizActiveCourseId
} from './quiz_logic.js';

// File Handling - uploads, downloads, syllabus parsing
import {
  initFileHandlingModule,
  handleDragOver,
  handleDragLeave,
  handleSyllabusDrop,
  parseCourseSyllabus,
  openSyllabusParserModal,
  parseSyllabus,
  importParsedSyllabus,
  renderFiles,
  uploadFiles,
  uploadFile,
  deleteFile,
  toggleFileVisibility,
  fileToBase64,
  formatFileSize,
  convertPlaceholderToFile,
  convertPlaceholderToLink,
  getCourseCreationSyllabusData,
  getCourseCreationSyllabusFile,
  clearCourseCreationSyllabusData,
  setActiveCourseId as setFileActiveCourseId,
  setStudentViewMode as setFileStudentViewMode,
  viewFile
} from './file_handling.js';

// Modals - all modal HTML generation
import {
  initModalsModule,
  generateModals,
  setActiveCourseId as setModalsActiveCourseId
} from './modals.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE INITIALIZATION
// Initialize all imported modules with their dependencies
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize all modules with their dependencies
 * Call this after appData is set up and Supabase is initialized
 */
function initModules() {
  console.log('[Modules] Initializing imported modules...');

  // Get references to local functions that modules need
  const deps = {
    appData,
    supabaseClient,
    activeCourseId,
    studentViewMode,
    // UI Helpers
    showToast,
    escapeHtml,
    generateId,
    generateInviteCode,
    formatDate,
    formatDateTime,
    renderMarkdown,
    openModal,
    closeModal,
    setText,
    setHTML,
    confirm: showConfirmDialog,
    // Data helpers
    getCourseById,
    getUserById,
    isStaff,
    getQuizById,
    getAssignmentById,
    // Database functions
    supabaseCreateFile,
    supabaseUpdateFile,
    supabaseDeleteFile,
    supabaseCreateQuiz,
    supabaseUpdateQuiz,
    supabaseCreateAssignment,
    supabaseUpdateAssignment,
    supabaseCreateModule,
    supabaseUpdateModule,
    supabaseUpsertQuizSubmission,
    callGeminiAPI,
    callGeminiAPIWithRetry,
    parseAiJsonResponse,
    // Render callbacks
    renderModules,
    renderAssignments,
    renderFiles,
    renderUpdates,
    generateModals
  };

  // Initialize database module
  initDatabaseModule({
    supabaseClient,
    appData,
    showToast,
    getInitials
  });

  // Initialize UI helpers
  initUIHelpers();

  // Initialize auth module
  initAuthModule({
    supabaseClient,
    appData,
    loadDataFromSupabase,
    initApp,
    showToast,
    setHTML
  });

  // Initialize AI module
  initAiModule({
    appData,
    showToast,
    escapeHtml,
    generateId,
    formatDate,
    renderMarkdown,
    openModal,
    closeModal,
    setHTML,
    getCourseById,
    getUserById,
    isStaff,
    callGeminiAPI,
    callGeminiAPIWithRetry,
    parseAiJsonResponse,
    supabaseCreateAnnouncement,
    supabaseCreateQuiz,
    renderUpdates,
    renderHome,
    renderAssignments,
    renderModules,
    renderGradebook,
    renderPeople,
    renderCalendar
  });

  // Initialize quiz module
  initQuizModule({
    appData,
    showToast,
    escapeHtml,
    generateId,
    formatDate,
    openModal,
    closeModal,
    setHTML,
    setText,
    confirm: showConfirmDialog,
    getCourseById,
    getUserById,
    isStaff,
    supabaseCreateQuiz,
    supabaseUpdateQuiz,
    supabaseUpsertQuizSubmission,
    renderAssignments,
    renderModules
  });

  // Initialize file handling module
  initFileHandlingModule({
    appData,
    supabaseClient,
    showToast,
    escapeHtml,
    generateId,
    formatDate,
    renderMarkdown,
    openModal,
    closeModal,
    setText,
    setHTML,
    confirm: showConfirmDialog,
    getCourseById,
    getUserById,
    isStaff,
    supabaseCreateFile,
    supabaseUpdateFile,
    supabaseDeleteFile,
    supabaseCreateQuiz,
    supabaseCreateAssignment,
    supabaseCreateModule,
    callGeminiAPIWithRetry,
    parseAiJsonResponse,
    renderModules,
    generateModals
  });

  // Initialize modals module
  initModalsModule({
    appData,
    setHTML,
    escapeHtml
  });

  console.log('[Modules] All modules initialized');
}

/**
 * Update module state when active course changes
 */
function updateModuleActiveCourse(courseId) {
  setAIActiveCourseId(courseId);
  setQuizActiveCourseId(courseId);
  setFileActiveCourseId(courseId);
  setModalsActiveCourseId(courseId);
}

/**
 * Update module state when student view mode changes
 */
function updateModuleStudentViewMode(mode) {
  setFileStudentViewMode(mode);
  setAIStudentViewMode(mode);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOATING CONTEXT MENU SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

let _openMenuId = null;

function closeMenu() {
  if (_openMenuId) {
    const menu = document.getElementById(_openMenuId);
    if (menu) menu.classList.remove('menu-open');
    _openMenuId = null;
  }
}

function toggleMenu(event, menuId) {
  event.stopPropagation();

  // If this menu is already open, close it
  if (_openMenuId === menuId) {
    closeMenu();
    return;
  }

  // Close any currently open menu
  closeMenu();

  const menu = document.getElementById(menuId);
  if (!menu) return;

  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();

  // Horizontal: left-align to button's left edge; right-align to button if it would overflow viewport
  const menuWidth = Math.max(menu.offsetWidth || 190, 180);
  let left = rect.left;
  if (left + menuWidth > window.innerWidth - 8) {
    left = rect.right - menuWidth;
  }
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.right = 'auto';

  // Vertical: below button unless near bottom of viewport
  const estimatedMenuHeight = (menu.children.length || 4) * 38 + 12;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < estimatedMenuHeight + 8) {
    menu.style.top = 'auto';
    menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
  } else {
    menu.style.bottom = 'auto';
    menu.style.top = `${rect.bottom + 4}px`;
  }

  menu.classList.add('menu-open');
  _openMenuId = menuId;
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (_openMenuId && !e.target.closest('.floating-menu') && !e.target.closest('[data-menu-btn]')) {
    closeMenu();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenu();
});

window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;

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
  settings: {}
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
// SUPABASE CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Debug helper to verify auth state before operations
async function debugAuthState(operation = 'unknown') {
  if (!supabaseClient) {
    console.warn(`[Auth Debug - ${operation}] Supabase client not initialized`);
    return null;
  }

  try {
    // Use getSession() instead of getUser() - getSession() reads from local cache
    // while getUser() makes a network call that can hang during auth state changes
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error(`[Auth Debug - ${operation}] Error getting session:`, error);
      return null;
    }

    const user = session?.user;
    if (!user) {
      console.warn(`[Auth Debug - ${operation}] ⚠️ NO SESSION/USER - auth.uid() will be NULL`);
      return null;
    }

    // User is authenticated
    console.log(`[Auth Debug - ${operation}] ✓ Authenticated as:`, {
      id: user.id,
      email: user.email,
      role: user.role,
      aud: user.aud
    });

    console.log(`[Auth Debug - ${operation}] ✓ Session expires:`, new Date(session.expires_at * 1000).toISOString());

    return user;
  } catch (err) {
    console.error(`[Auth Debug - ${operation}] Exception:`, err);
    return null;
  }
}
// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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
    embedCode = `\n\n[Watch Video](${url})\n\n`;
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
  insertAtCursor(currentInsertTextareaId, `[${fileName}](#file-${fileId})`);
  closeModal('insertFileModal');
  showToast('File link inserted', 'success');
}

function confirmInsertExternalFile() {
  const url = document.getElementById('insertFileExternalUrl').value.trim();
  const name = document.getElementById('insertFileExternalName').value.trim() || url;
  if (!url) {
    showToast('Please enter a URL', 'error');
    return;
  }
  insertAtCursor(currentInsertTextareaId, `[${name}](${url})`);
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
      <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('${textareaId}')" title="Insert Link">Link</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('${textareaId}')" title="Insert File">File</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('${textareaId}')" title="Insert Video">Video</button>
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


// Helper functions for 12-hour time selector
// ── Date + time helpers ──────────────────────────────────────────────────────
// New approach: one date input + one <input type="time"> (24 h, HH:MM).
// Defaults to 23:59 when no time is stored, which shows as 11:59 PM locally.

function getDateTimeFromInputs(dateId, timeId) {
  const dateEl = document.getElementById(dateId);
  if (!dateEl || !dateEl.value) return null;
  const timeEl = document.getElementById(timeId);
  const timeVal = (timeEl && timeEl.value) ? timeEl.value : '23:59';
  const [year, month, day] = dateEl.value.split('-').map(Number);
  const [hour, minute] = timeVal.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function setDateTimeInputs(dateId, timeId, isoDateString) {
  const pad = n => String(n).padStart(2, '0');
  const dateEl = document.getElementById(dateId);
  const timeEl = document.getElementById(timeId);
  if (!dateEl) return;
  if (!isoDateString) {
    dateEl.value = '';
    if (timeEl) timeEl.value = '23:59';
    return;
  }
  const d = new Date(isoDateString);
  dateEl.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (timeEl) timeEl.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Legacy 3-select helper (quiz modal still uses select elements) ───────────
function getDateTimeFromSelectors(dateId, hourId, minuteId, ampmId) {
  const dateEl = document.getElementById(dateId);
  if (!dateEl || !dateEl.value) return null;
  let hour = parseInt(document.getElementById(hourId).value, 10);
  const minute = document.getElementById(minuteId).value;
  const ampm = document.getElementById(ampmId).value;
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  const [year, month, day] = dateEl.value.split('-').map(Number);
  return new Date(year, month - 1, day, hour, parseInt(minute, 10), 0, 0).toISOString();
}

function setDateTimeSelectors(dateId, hourId, minuteId, ampmId, isoDateString) {
  const pad = n => String(n).padStart(2, '0');
  const dateEl = document.getElementById(dateId);
  const hourEl = document.getElementById(hourId);
  const minuteEl = document.getElementById(minuteId);
  const ampmEl = document.getElementById(ampmId);
  if (!dateEl) return;
  if (!isoDateString) {
    dateEl.value = '';
    if (hourEl) hourEl.value = '11';
    if (minuteEl) minuteEl.value = '59';
    if (ampmEl) ampmEl.value = 'PM';
    return;
  }
  const d = new Date(isoDateString);
  dateEl.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  let hours = d.getHours();
  const mins = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  let roundedMin = Math.round(mins / 15) * 15;
  if (roundedMin === 60) roundedMin = 0;
  if (hourEl) hourEl.value = hours.toString();
  if (minuteEl) minuteEl.value = mins >= 57 ? '59' : roundedMin.toString().padStart(2, '0');
  if (ampmEl) ampmEl.value = ampm;
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

function getQuizById(id) {
  return appData.quizzes.find(q => q.id === id);
}

function getAssignmentById(id) {
  return appData.assignments.find(a => a.id === id);
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

  // Restore Caliper sensor config from localStorage
  const savedCaliperEndpoint = localStorage.getItem('caliperEndpoint');
  const savedCaliperSensorId = localStorage.getItem('caliperSensorId') || 'campus-lms';
  if (savedCaliperEndpoint) {
    initCaliperSensor(savedCaliperSensorId, savedCaliperEndpoint);
  }

  // Caliper: emit SessionEvent/LoggedIn (no-ops if sensor not configured)
  caliperSessionLogin(appData.currentUser);

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

  // Keep extracted modules (AI/quiz/files/modals) in sync on initial bootstrap.
  if (activeCourseId) {
    updateModuleActiveCourse(activeCourseId);
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
  updateModuleActiveCourse(courseId); // Notify modules of course change
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
  renderDiscussion();
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

function renderMarkdownWithLinkedFiles(markdownText) {
  const html = renderMarkdown(markdownText || '');
  return html.replace(/href="#file-([^"]+)"/g, (m, fileId) => `href="#" onclick="openLinkedFile('${fileId}'); return false;"`);
}

function openLinkedFile(fileId) {
  if (!fileId) return;
  if (window.viewFile) {
    window.viewFile(fileId);
  }
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

  // Re-render the target page to pick up any data changes since last visit
  if (appData.currentUser) {
    const pageRenders = {
      courses:     renderCourses,
      home:        renderHome,
      updates:     renderUpdates,
      assignments: renderAssignments,
      calendar:    renderCalendar,
      modules:     renderModules,
      files:       renderFiles,
      gradebook:   renderGradebook,
      people:      renderPeople,
      discussion:  renderDiscussion,
    };
    if (pageRenders[page]) pageRenders[page]();
  }

  // Caliper: emit ViewEvent for the page being navigated to
  if (appData.currentUser) {
    const pageNames = { home: 'Home', assignments: 'Assignments', gradebook: 'Gradebook',
      modules: 'Modules', files: 'Files', people: 'People', discussion: 'Discussion',
      updates: 'Announcements', calendar: 'Calendar', courses: 'Courses' };
    if (pageNames[page]) caliperViewPage(appData.currentUser, page, pageNames[page]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COURSES PAGE
// ═══════════════════════════════════════════════════════════════════════════════

let showInactiveCourses = false;

function showInactiveCoursesSection() {
  showInactiveCourses = true;
  renderCourses();
}

function hideInactiveCoursesSection() {
  showInactiveCourses = false;
  renderCourses();
}

function renderCourses() {
  const allCourses = getUserCourses(appData.currentUser.id);
  const activeCourses = allCourses.filter(c => c.active !== false);
  const inactiveCourses = allCourses.filter(c => c.active === false);

  const actionsHTML = `
    <button class="btn btn-primary" onclick="openModal('createCourseModal')">Create Course</button>
    <button class="btn btn-secondary" onclick="openModal('joinCourseModal')">Join Course</button>
  `;
  setHTML('coursesActions', actionsHTML);

  const courseCard = (c, dimmed) => {
    const roleLabels = { instructor: 'Instructor', ta: 'Teaching Assistant', student: 'Student' };
    const roleLabel = roleLabels[c.role] || c.role;
    const isActiveCourse = c.id === activeCourseId;
    return `
      <div class="card" style="${isActiveCourse ? 'border:1.5px solid var(--primary);' : ''}${dimmed ? 'opacity:0.65;' : ''}">
        <div class="card-header">
          <div>
            <div class="card-title">
              ${escapeHtml(c.name)}
              ${dimmed ? ' <span style="font-size:0.7rem; font-weight:600; background:var(--border-color); color:var(--text-muted); padding:2px 7px; border-radius:10px; vertical-align:middle;">INACTIVE</span>' : ''}
            </div>
            <div class="muted">${escapeHtml(c.code)} · ${roleLabel}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            ${isActiveCourse ? '' : `<button class="btn btn-primary btn-sm" onclick="switchCourse('${c.id}')">Open</button>`}
            ${c.role === 'instructor' ? `
              <button class="btn btn-secondary btn-sm" onclick="openEditCourseModal('${c.id}')">Edit</button>
              <button class="btn btn-secondary btn-sm" onclick="openCloneCourseModal('${c.id}')">Clone</button>
            ` : ''}
          </div>
        </div>
        ${c.description ? `<div style="margin-top:8px;" class="muted">${escapeHtml(c.description)}</div>` : ''}
      </div>
    `;
  };

  let html = '';

  if (activeCourses.length === 0 && !showInactiveCourses) {
    html = '<div class="empty-state"><div class="empty-state-title">No active courses</div><div class="empty-state-text">Create a course or join one with an invite code</div></div>';
  } else {
    html = activeCourses.map(c => courseCard(c, false)).join('');
  }

  // Inactive courses section
  if (inactiveCourses.length > 0) {
    if (showInactiveCourses) {
      html += `<div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border-color);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <span class="muted" style="font-size:0.9rem; font-weight:600;">Inactive / Archived Courses (${inactiveCourses.length})</span>
          <button class="btn btn-secondary btn-sm" onclick="hideInactiveCoursesSection()">Hide</button>
        </div>
        ${inactiveCourses.map(c => courseCard(c, true)).join('')}
      </div>`;
    } else {
      html += `<div style="margin-top:16px; text-align:center;">
        <button class="btn btn-secondary btn-sm" onclick="showInactiveCoursesSection()">
          Show ${inactiveCourses.length} inactive course${inactiveCourses.length > 1 ? 's' : ''}
        </button>
      </div>`;
    }
  }

  setHTML('coursesList', html);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLONE COURSE
// ═══════════════════════════════════════════════════════════════════════════════

let cloneSourceCourseId = null;

function openCloneCourseModal(courseId) {
  cloneSourceCourseId = courseId;
  const source = getCourseById(courseId);
  if (!source) return;
  ensureModalsRendered();
  const nameEl = document.getElementById('cloneCourseNameInput');
  const codeEl = document.getElementById('cloneCourseCodeInput');
  const infoEl = document.getElementById('cloneCourseSourceInfo');
  if (nameEl) nameEl.value = `${source.name} (Copy)`;
  if (codeEl) codeEl.value = `${source.code}-COPY`;
  if (infoEl) infoEl.textContent = `Cloning from: ${source.name} (${source.code})`;
  openModal('cloneCourseModal');
}

async function cloneCourse() {
  const name = document.getElementById('cloneCourseNameInput')?.value.trim();
  const code = document.getElementById('cloneCourseCodeInput')?.value.trim();
  const cloneAssignments = document.getElementById('cloneAssignments')?.checked !== false;
  const cloneQuizzes = document.getElementById('cloneQuizzes')?.checked !== false;
  const cloneModules = document.getElementById('cloneModules')?.checked !== false;
  const cloneQBanks = document.getElementById('cloneQBanks')?.checked !== false;
  const cloneAnnouncements = document.getElementById('cloneAnnouncements')?.checked || false;

  if (!name || !code) {
    showToast('Please fill in course name and code', 'error');
    return;
  }

  const source = getCourseById(cloneSourceCourseId);
  if (!source) { showToast('Source course not found', 'error'); return; }

  const newCourseId = generateId();
  const newInviteCode = generateInviteCode();

  const newCourse = {
    id: newCourseId,
    name,
    code,
    description: source.description || '',
    inviteCode: newInviteCode,
    createdBy: appData.currentUser.id,
    startHereTitle: source.startHereTitle || 'Start Here',
    startHereContent: source.startHereContent || `Welcome to ${name}.`
  };

  await supabaseCreateCourse(newCourse);
  appData.courses.push(newCourse);

  const enrollment = { userId: appData.currentUser.id, courseId: newCourseId, role: 'instructor' };
  await supabaseCreateEnrollment(enrollment);
  appData.enrollments.push(enrollment);

  // Build ID maps for cross-referencing
  const assignmentIdMap = {};
  const quizIdMap = {};
  const bankIdMap = {};

  // Clone question banks first (quizzes may reference them)
  if (cloneQBanks) {
    const banks = (appData.questionBanks || []).filter(b => b.courseId === cloneSourceCourseId);
    for (const bank of banks) {
      const newBankId = generateId();
      bankIdMap[bank.id] = newBankId;
      const newBank = {
        id: newBankId,
        courseId: newCourseId,
        name: bank.name,
        questions: (bank.questions || []).map(q => ({ ...q, id: generateId(), bankId: newBankId })),
        createdAt: new Date().toISOString()
      };
      if (!appData.questionBanks) appData.questionBanks = [];
      await supabaseCreateQuestionBank(newBank);
      appData.questionBanks.push(newBank);
    }
  }

  // Clone assignments
  if (cloneAssignments) {
    const assignments = (appData.assignments || []).filter(a => a.courseId === cloneSourceCourseId);
    for (const a of assignments) {
      const newId = generateId();
      assignmentIdMap[a.id] = newId;
      const newAssignment = {
        ...a,
        id: newId,
        courseId: newCourseId,
        status: 'draft',
        dueDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        createdAt: new Date().toISOString(),
        // remap question bank if cloned
        questionBankId: a.questionBankId && bankIdMap[a.questionBankId] ? bankIdMap[a.questionBankId] : a.questionBankId
      };
      await supabaseCreateAssignment(newAssignment);
      appData.assignments.push(newAssignment);
    }
  }

  // Clone quizzes
  if (cloneQuizzes) {
    const quizzes = (appData.quizzes || []).filter(q => q.courseId === cloneSourceCourseId);
    for (const q of quizzes) {
      const newId = generateId();
      quizIdMap[q.id] = newId;
      const newQuiz = {
        ...q,
        id: newId,
        courseId: newCourseId,
        status: 'draft',
        dueDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        createdAt: new Date().toISOString(),
        questions: (q.questions || []).map(qq => ({ ...qq, id: generateId() }))
      };
      await supabaseCreateQuiz(newQuiz);
      appData.quizzes.push(newQuiz);
    }
  }

  // Clone announcements (as drafts/hidden)
  if (cloneAnnouncements) {
    const announcements = (appData.announcements || []).filter(a => a.courseId === cloneSourceCourseId);
    for (const ann of announcements) {
      const newAnn = {
        ...ann,
        id: generateId(),
        courseId: newCourseId,
        hidden: true,
        pinned: false,
        authorId: appData.currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await supabaseCreateAnnouncement(newAnn);
      appData.announcements.push(newAnn);
    }
  }

  // Clone modules (and remap item references)
  if (cloneModules) {
    const modules = (appData.modules || []).filter(m => m.courseId === cloneSourceCourseId)
      .sort((a, b) => a.position - b.position);
    for (const mod of modules) {
      const newMod = {
        id: generateId(),
        courseId: newCourseId,
        name: mod.name,
        position: mod.position,
        hidden: mod.hidden || false,
        items: []
      };
      await supabaseCreateModule(newMod);
      // Clone items, remapping IDs
      for (const item of (mod.items || [])) {
        let newRefId = item.refId;
        if (item.type === 'assignment' && assignmentIdMap[item.refId]) newRefId = assignmentIdMap[item.refId];
        if (item.type === 'quiz' && quizIdMap[item.refId]) newRefId = quizIdMap[item.refId];
        const newItem = {
          id: generateId(),
          type: item.type,
          refId: newRefId,
          title: item.title,
          url: item.url,
          position: item.position
        };
        await supabaseCreateModuleItem(newItem, newMod.id);
        newMod.items.push(newItem);
      }
      appData.modules.push(newMod);
    }
  }

  closeModal('cloneCourseModal');
  renderCourses();
  showToast(`Course "${name}" created successfully! It's hidden from students until you publish it.`, 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAG AND DROP HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════


function onSyllabusFileSelected() {
  const input = document.getElementById('courseCreationSyllabus');
  if (!input || !input.files.length) return;
  const file = input.files[0];
  const dropZone = document.getElementById('syllabusDropZone');
  if (dropZone) {
    // Keep the file input in the DOM so parseCourseSyllabus can read files
    dropZone.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap;">
        <span style="font-size:1.5rem;">📄</span>
        <div style="text-align:left;">
          <div style="font-weight:500;">${escapeHtml(file.name)}</div>
          <div class="muted" style="font-size:0.8rem;">${(file.size / 1024).toFixed(1)} KB · Click Parse to extract course info &amp; modules</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); parseCourseSyllabus();">Parse</button>
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); clearSyllabusUpload();">✕</button>
      </div>
      <input type="file" id="courseCreationSyllabus" accept=".pdf,.doc,.docx,.txt,.tex" style="display:none;" onchange="onSyllabusFileSelected()">
    `;
    // Re-attach the selected file to the new hidden input via DataTransfer
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      const newInput = document.getElementById('courseCreationSyllabus');
      if (newInput) newInput.files = dt.files;
    } catch (_) { /* DataTransfer unavailable in some environments */ }
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
      <input type="file" id="courseCreationSyllabus" accept=".pdf,.doc,.docx,.txt,.tex" style="display:none;" onchange="onSyllabusFileSelected()">
    `;
  }
  const status = document.getElementById('courseCreationSyllabusStatus');
  if (status) status.innerHTML = '';
  clearCourseCreationSyllabusData();
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
    const validTypes = ['.pdf', '.doc', '.docx', '.txt', '.tex'];
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
      <input type="file" id="syllabusFile" accept=".pdf,.doc,.docx,.txt,.tex" style="display:none;" onchange="onSyllabusParserFileSelected()">
    `;
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
  const parsedSyllabusData = getCourseCreationSyllabusData();
  const hasSyllabusData = parsedSyllabusData && parsedSyllabusData.modules;
  const checkedModules = document.querySelectorAll('.course-creation-module-check:checked');
  const selectedModuleIndices = new Set(Array.from(checkedModules).map(el => parseInt(el.dataset.index)));

  // Set up Start Here content - with syllabus reference if created via syllabus upload
  let startHereContent = `Welcome to ${name}.`;
  let startHereLinks = [];

  // If syllabus was uploaded, save it as a file and add to pinned essentials
  const syllabusInput = document.getElementById('courseCreationSyllabus');
  const syllabusFile = syllabusInput?.files?.[0] || getCourseCreationSyllabusFile();
  let syllabusFileId = null;
  if (syllabusFile) {
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

      if (uploadError || !uploadData?.path) {
        console.error('[createCourse] Failed to upload syllabus file:', uploadError);
        showToast('Could not upload syllabus file to storage. Course will still be created.', 'warning');
      } else {
        syllabusFileData.storagePath = uploadData.path;

        // Save file metadata only after successful upload
        const savedSyllabusFile = await supabaseCreateFile(syllabusFileData);
        if (savedSyllabusFile) {
          appData.files.push(syllabusFileData);
          startHereLinks.push({ label: 'Syllabus', fileId: syllabusFileId });
        }
      }
    }
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

    for (const [modIndex, mod] of parsedSyllabusData.modules.entries()) {
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
          await supabaseCreateQuiz(newQuiz);
          appData.quizzes.push(newQuiz);
          refId = newQuiz.id;
        } else if (item.type === 'reading') {
          const newFile = {
            id: generateId(),
            courseId: courseId,
            name: item.title,
            type: 'placeholder',
            size: 0,
            hidden: true,
            isPlaceholder: true,
            description: item.description || '',
            uploadedBy: appData.currentUser.id,
            uploadedAt: new Date().toISOString()
          };
          await supabaseCreateFile(newFile);
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
          await supabaseCreateAssignment(newAssignment);
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
      for (const moduleItem of newModule.items) {
        await supabaseCreateModuleItem(moduleItem, newModule.id);
      }
      appData.modules.push(newModule);
      modulesImported++;
    }
  }


  activeCourseId = courseId;
  updateModuleActiveCourse(courseId);

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
  clearCourseCreationSyllabusData();
}

async function joinCourse() {
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

  const enrollment = {
    userId: appData.currentUser.id,
    courseId: course.id,
    role: 'student'
  };

  // Save to Supabase
  const result = await supabaseCreateEnrollment(enrollment);
  if (!result) {
    showToast('Failed to join course', 'error');
    return;
  }

  // Update local state
  appData.enrollments.push(enrollment);
  activeCourseId = course.id;
  updateModuleActiveCourse(course.id);

  closeModal('joinCourseModal');
  renderAll();
  navigateTo('home');
  showToast('Successfully joined course!', 'success');
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

  // Recent announcements — pinned first, then by date descending
  const updates = appData.announcements
    .filter(a => a.courseId === activeCourseId)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
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
            return `<a href="#" onclick="openFile('${file.id}'); return false;" class="pill pill-link">${escapeHtml(link.label)}</a>`;
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

async function saveStartHere() {
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

  // Save to Supabase
  const result = await supabaseUpdateCourse(course);
  if (!result) {
    return; // Error already shown
  }

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
    const visibilityText = a.hidden ? 'Make Visible' : 'Hide from Students';
    const hiddenBadge = a.hidden
      ? '<span style="padding:4px 8px; background:var(--danger-light); color:var(--danger); border-radius:4px; font-size:0.75rem; font-weight:600;">Hidden</span>'
      : '';

    const announcementMenu = effectiveStaff ? `
      <button class="btn btn-secondary btn-sm" data-menu-btn onclick="toggleMenu(event, 'menu-ann-${a.id}')">☰</button>
      <div id="menu-ann-${a.id}" class="floating-menu">
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); toggleAnnouncementVisibility('${a.id}')">${visibilityText}</button>
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); editAnnouncement('${a.id}')">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); deleteAnnouncement('${a.id}')" style="color:var(--danger);">Delete</button>
      </div>
    ` : '';

    return `
      <div class="card" data-announcement-id="${a.id}" style="${a.hidden ? 'opacity:0.7; border-style:dashed;' : ''} transition: background-color 0.3s ease;">
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(a.title)} ${a.pinned ? '📌' : ''} ${hiddenBadge}</div>
            <div class="muted">${author ? escapeHtml(author.name) : 'Unknown'} · ${formatDate(a.createdAt)}</div>
          </div>
          ${effectiveStaff ? `
            <div style="display:flex; gap:8px; align-items:center;">
              ${announcementMenu}
            </div>
          ` : ''}
        </div>
        <div class="markdown-content">${renderMarkdownWithLinkedFiles(a.content)}</div>
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
  ensureModalsRendered();
  showConfirmDialog('Delete this update?', async () => {
    // Delete from Supabase
    const success = await supabaseDeleteAnnouncement(id);
    if (!success) return;

    // Update local state
    appData.announcements = appData.announcements.filter(a => a.id !== id);
  
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

  const _now = new Date();
  const assignments = appData.assignments
    .filter(a => a.courseId === activeCourseId)
    .filter(a => {
      if (effectiveStaff) return true;
      if (a.status !== 'published' || a.hidden) return false;
      // Hide from students until availableFrom has passed
      if (a.availableFrom && _now < new Date(a.availableFrom)) return false;
      return true;
    })
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

    // Status and visibility badges for staff
    const isHiddenAssignment = !!a.hidden || a.status !== 'published';
    const assignmentVisibilityText = isHiddenAssignment ? 'Make Visible' : 'Hide from Students';
    const nowMs = Date.now();
    const availFrom = a.availableFrom ? new Date(a.availableFrom) : null;
    const availUntil = a.availableUntil ? new Date(a.availableUntil) : null;
    const notYetAvail = effectiveStaff && !isHiddenAssignment && availFrom && nowMs < availFrom.getTime();
    const availEnded = effectiveStaff && !isHiddenAssignment && availUntil && nowMs > availUntil.getTime();

    let visibilityBadge = '';
    if (effectiveStaff) {
      if (isHiddenAssignment) {
        visibilityBadge = `<span style="padding:4px 8px; background:var(--danger-light); color:var(--danger); border-radius:4px; font-size:0.75rem; font-weight:600;">Hidden</span>`;
      } else if (notYetAvail) {
        visibilityBadge = `<span style="padding:4px 8px; background:#fef3c7; color:#92400e; border-radius:4px; font-size:0.75rem; font-weight:600;" title="Opens ${availFrom.toLocaleString()}">Not Yet Visible</span>`;
      } else if (availEnded && !a.allowLateSubmissions) {
        visibilityBadge = `<span style="padding:4px 8px; background:#fee2e2; color:#991b1b; border-radius:4px; font-size:0.75rem; font-weight:600;" title="Closed ${availUntil.toLocaleString()}">Availability Ended</span>`;
      } else if (availEnded && a.allowLateSubmissions) {
        visibilityBadge = `<span style="padding:4px 8px; background:#fef3c7; color:#92400e; border-radius:4px; font-size:0.75rem; font-weight:600;">Late Submissions Open</span>`;
      }
    }

    const assignmentMenu = effectiveStaff ? `
      <button class="btn btn-secondary btn-sm" data-menu-btn onclick="toggleMenu(event, 'menu-assign-${a.id}')">☰</button>
      <div id="menu-assign-${a.id}" class="floating-menu">
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); viewSubmissions('${a.id}')">Submissions (${submissionCount})</button>
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); toggleAssignmentVisibility('${a.id}')">${assignmentVisibilityText}</button>
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); editAssignment('${a.id}')">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); deleteAssignment('${a.id}')" style="color:var(--danger);">Delete</button>
      </div>
    ` : '';

    return `
      <div class="card" style="${isPlaceholder ? 'border-style:dashed; opacity:0.9;' : ''} ${isHiddenAssignment ? 'opacity:0.7; border-style:dashed;' : ''}">
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(a.title)} ${visibilityBadge}</div>
            <div class="muted">${formatDueDate(a.dueDate)} · ${a.points} points${a.externalUrl ? ' · External Link' : ''}${notYetAvail ? ` · Opens ${availFrom.toLocaleDateString()}` : ''}${availEnded ? ` · Closed ${availUntil.toLocaleDateString()}` : ''}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            ${effectiveStaff ? assignmentMenu : mySubmission ? `
              <button class="btn btn-secondary btn-sm" onclick="viewMySubmission('${a.id}')">View Submission</button>
            ` : a.status === 'published' && !isPast ? `
              <button class="btn btn-primary btn-sm" onclick="submitAssignment('${a.id}')">Submit</button>
            ` : ''}
          </div>
        </div>
        <div class="markdown-content">${renderMarkdownWithLinkedFiles(a.description)}</div>
        ${a.externalUrl ? `<div style="margin-top:8px;"><a href="${escapeHtml(a.externalUrl)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Open External Link</a></div>` : ''}
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

    const statusBadge = q.status === 'closed' ? '<span style="padding:4px 8px; background:var(--border-color); color:var(--text-muted); border-radius:4px; font-size:0.75rem; font-weight:600;">CLOSED</span>' : '';

    // Single visibility badge for staff — replaces DRAFT label
    const visibilityBadge = effectiveStaff && q.status !== 'published' ?
      `<span style="padding:4px 8px; background:var(--danger-light); color:var(--danger); border-radius:4px; font-size:0.75rem; font-weight:600; cursor:pointer;" onclick="toggleQuizVisibility('${q.id}')" title="Click to publish">Hidden</span>` : '';

    const myTimeOverride = (appData.quizTimeOverrides || []).find(o => o.quizId === q.id && o.userId === appData.currentUser.id);
    const effectiveTimeLimit = myTimeOverride ? myTimeOverride.timeLimit : q.timeLimit;
    const timeLimitLabel = effectiveTimeLimit
      ? `${effectiveTimeLimit} min once you begin${myTimeOverride ? ' (personalized)' : ''}`
      : 'No time limit';
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
          <div style="display:flex; gap:8px; align-items:center;">
            ${effectiveStaff ? `
              <button class="btn btn-secondary btn-sm" data-menu-btn onclick="toggleMenu(event, 'menu-quiz-${q.id}')">&#9776;</button>
              <div id="menu-quiz-${q.id}" class="floating-menu">
                <button class="btn btn-secondary btn-sm" onclick="closeMenu(); viewQuizSubmissions('${q.id}')">Submissions (${submissions.length})</button>
                <button class="btn btn-secondary btn-sm" onclick="closeMenu(); openQuizTimeOverridesModal('${q.id}')">Time Overrides</button>
                <button class="btn btn-secondary btn-sm" onclick="closeMenu(); viewQuizDetails('${q.id}')">Preview</button>
                <button class="btn btn-secondary btn-sm" onclick="closeMenu(); openQuizModal('${q.id}')">Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="closeMenu(); deleteQuiz('${q.id}')" style="color:var(--danger);">Delete</button>
              </div>
            ` : latestSubmission ? `
              <button class="btn btn-secondary btn-sm" onclick="viewQuizSubmission('${q.id}')">View Submission</button>
              ${!isPast && (!attemptsAllowed || attemptsLeft > 0) ? `<button class="btn btn-primary btn-sm" onclick="takeQuiz('${q.id}')">Retake</button>` : ''}
            ` : q.status === 'published' && !isPast ? `
              <button class="btn btn-primary btn-sm" onclick="takeQuiz('${q.id}')">Take Quiz</button>
            ` : ''}
          </div>
        </div>
        <div class="markdown-content">${renderMarkdownWithLinkedFiles(q.description || '')}</div>
      </div>
    `;
  }).join('');

  const sections = [];
  if (assignments.length > 0) {
    sections.push(assignmentCards);
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
  setHTML('calendarActions', `
    <button class="btn btn-secondary" onclick="exportCalendarICS()">Export .ics</button>
  `);

  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  const effectiveStaff = isStaffUser && !studentViewMode;
  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - 7);
  const end = new Date();
  end.setDate(now.getDate() + 45);

  const items = [
    ...appData.assignments
      .filter(a => a.courseId === activeCourseId)
      .filter(a => effectiveStaff || a.status === 'published')
      .map(a => ({ type: 'Assignment', title: a.title, dueDate: a.dueDate, status: a.status })),
    ...appData.quizzes
      .filter(q => q.courseId === activeCourseId)
      .filter(q => effectiveStaff || q.status === 'published')
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

function exportCalendarICS() {
  if (!activeCourseId) return;
  const course = getCourseById(activeCourseId);
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);

  const items = [
    ...(appData.assignments || [])
      .filter(a => a.courseId === activeCourseId && (isStaffUser || a.status === 'published') && a.dueDate)
      .map(a => ({ title: `[Assignment] ${a.title}`, date: new Date(a.dueDate), description: a.description || '' })),
    ...(appData.quizzes || [])
      .filter(q => q.courseId === activeCourseId && (isStaffUser || q.status === 'published') && q.dueDate)
      .map(q => ({ title: `[Quiz] ${q.title}`, date: new Date(q.dueDate), description: q.description || '' }))
  ];

  function icsDate(d) {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function icsEscape(s) {
    return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}@modernlms`;

  const events = items.map(item => {
    const start = icsDate(item.date);
    const end = icsDate(new Date(item.date.getTime() + 3600000)); // 1 hour duration
    return [
      'BEGIN:VEVENT',
      `UID:${uid()}`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${icsEscape(item.title)}`,
      item.description ? `DESCRIPTION:${icsEscape(item.description.slice(0, 500))}` : '',
      'END:VEVENT'
    ].filter(Boolean).join('\r\n');
  }).join('\r\n');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ModernLMS//EN',
    `X-WR-CALNAME:${icsEscape(course.name)}`,
    'CALSCALE:GREGORIAN',
    events,
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(course.code || 'course').replace(/\s+/g, '_')}_calendar.ics`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Calendar exported!', 'success');
}

function normalizeContentStatus(status) {
  // DB enum supports draft/published only
  if (status === 'closed') return 'published';
  if (status === 'active') return 'published';
  return status || 'draft';
}

async function createAssignment() {
  const title = document.getElementById('assignmentTitle').value.trim();
  const description = document.getElementById('assignmentDescription').value.trim();
  const category = document.getElementById('assignmentCategory').value;
  const points = parseInt(document.getElementById('assignmentPoints').value);
  const dueDate = getDateTimeFromSelectors('assignmentDueDate', 'assignmentDueHour', 'assignmentDueMinute', 'assignmentDueAmPm');
  const status = normalizeContentStatus(document.getElementById('assignmentStatus').value);
  const allowLate = document.getElementById('assignmentAllowLate').checked;
  const lateDeduction = parseInt(document.getElementById('assignmentLateDeduction').value) || 0;
  const allowResubmit = document.getElementById('assignmentAllowResubmit').checked;
  const blindGrading = document.getElementById('assignmentBlindGrading')?.checked || false;

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
    hidden: status !== 'published',
    dueDate: new Date(dueDate).toISOString(),
    createdAt: new Date().toISOString(),
    allowLateSubmissions: allowLate,
    lateDeduction: lateDeduction,
    allowResubmission: allowResubmit,
    blindGrading: blindGrading,
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
  document.getElementById('assignmentStatus').value = assignment ? normalizeContentStatus(assignment.status) : 'draft';
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
  const status = normalizeContentStatus(document.getElementById('assignmentStatus').value);
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
  assignment.hidden = status !== 'published';
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


  closeModal('assignmentModal');
  resetAssignmentModal();
  renderAssignments();
  renderHome();
  showToast('Assignment updated!', 'success');
}

function editAssignment(assignmentId) {
  openNewAssignmentModal(assignmentId);
}

function openDeadlineOverridesFromModal() {
  if (currentNewAssignmentEditId) {
    openDeadlineOverridesModal(currentNewAssignmentEditId);
  }
}

function deleteAssignment(assignmentId) {
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  if (!assignment) return;

  ensureModalsRendered();
  showConfirmDialog(`Delete "${assignment.title}"? This will also delete all submissions.`, async () => {
    // Delete from Supabase
    const success = await supabaseDeleteAssignment(assignmentId);
    if (!success) return;

    // Update local state
    appData.assignments = appData.assignments.filter(a => a.id !== assignmentId);
    appData.submissions = appData.submissions.filter(s => s.assignmentId !== assignmentId);
  
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

  ensureModalsRendered();
  showConfirmDialog(`Delete "${bank.name}"? This cannot be undone.`, async () => {
    await supabaseDeleteQuestionBank(bankId);
    appData.questionBanks = appData.questionBanks.filter(b => b.id !== bankId);
  
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
    document.getElementById('newAssignmentStatus').value = normalizeContentStatus(assignment.status || 'draft');
    document.getElementById('newAssignmentAllowLate').checked = assignment.allowLateSubmissions !== false;
    document.getElementById('newAssignmentLatePenaltyType').value = assignment.latePenaltyType || 'per_day';
    document.getElementById('newAssignmentLatePenalty').value = assignment.lateDeduction || 10;
    document.getElementById('newAssignmentGradingNotes').value = assignment.gradingNotes || '';
    document.getElementById('newAssignmentAllowResubmit').checked = assignment.allowResubmission !== false;
    const taEl = document.getElementById('newAssignmentTimeAllowed');
    if (taEl) taEl.value = assignment.timeAllowed || '';

    // Question bank settings
    if (assignment.questionBankId) {
      document.getElementById('newAssignmentQuestionBank').value = assignment.questionBankId;
    }
    document.getElementById('newAssignmentNumQuestions').value = assignment.numQuestions || '';
    document.getElementById('newAssignmentRandomizeQuestions').checked = assignment.randomizeQuestions !== false;
    document.getElementById('newAssignmentRandomizeAnswers').checked = assignment.randomizeAnswers !== false;

    // Dates — convert ISO (UTC) → local datetime string for datetime-local inputs
    const toLocalDtInput = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    document.getElementById('newAssignmentAvailableFrom').value = toLocalDtInput(assignment.availableFrom);
    document.getElementById('newAssignmentAvailableUntil').value = toLocalDtInput(assignment.availableUntil);
    document.getElementById('newAssignmentDueDate').value = toLocalDtInput(assignment.dueDate);

    handleNewAssignmentTypeChange();
  } else {
    resetNewAssignmentModal();
  }

  // Show "Deadline Overrides" button only when editing an existing assignment
  const overridesBtn = document.getElementById('newAssignmentOverridesBtn');
  if (overridesBtn) overridesBtn.style.display = assignmentId ? 'inline-flex' : 'none';

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
  // Default availableFrom = now, due = 1 week from now at 23:59 (local time)
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const nowDtLocal = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById('newAssignmentAvailableFrom').value = nowDtLocal;
  document.getElementById('newAssignmentAvailableUntil').value = '';
  const due = new Date();
  due.setDate(due.getDate() + 7);
  document.getElementById('newAssignmentDueDate').value = `${due.getFullYear()}-${pad(due.getMonth()+1)}-${pad(due.getDate())}T23:59`;
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
  const taEl = document.getElementById('newAssignmentTimeAllowed');
  if (taEl) taEl.value = '';

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

// Auto-fill availableUntil to match due date when late submissions are off
function syncAvailableUntilToDueDate() {
  const allowLate = document.getElementById('newAssignmentAllowLate');
  const untilEl = document.getElementById('newAssignmentAvailableUntil');
  if (!untilEl) return;
  // Only auto-sync if late submissions are not allowed
  if (allowLate && allowLate.checked) {
    untilEl.value = '';
    return;
  }
  const dueDtEl = document.getElementById('newAssignmentDueDate');
  if (!dueDtEl || !dueDtEl.value) return;
  untilEl.value = dueDtEl.value;
}
window.syncAvailableUntilToDueDate = syncAvailableUntilToDueDate;

async function saveNewAssignment() {
  const type = document.getElementById('newAssignmentType').value;
  const title = document.getElementById('newAssignmentTitle').value.trim();
  const description = document.getElementById('newAssignmentDescription').value.trim();
  const introNotes = document.getElementById('newAssignmentIntroNotes').value.trim();
  const points = parseInt(document.getElementById('newAssignmentPoints').value) || 100;
  const availableFrom = document.getElementById('newAssignmentAvailableFrom').value;
  const availableUntil = document.getElementById('newAssignmentAvailableUntil').value;
  const dueDate = document.getElementById('newAssignmentDueDate').value || null;
  const status = normalizeContentStatus(document.getElementById('newAssignmentStatus').value);
  const allowLate = document.getElementById('newAssignmentAllowLate').checked;
  const latePenaltyType = document.getElementById('newAssignmentLatePenaltyType').value;
  const latePenalty = parseInt(document.getElementById('newAssignmentLatePenalty').value) || 0;
  const gradingNotes = document.getElementById('newAssignmentGradingNotes').value.trim();
  const allowResubmit = document.getElementById('newAssignmentAllowResubmit').checked;
  const taRaw = document.getElementById('newAssignmentTimeAllowed')?.value;
  const timeAllowed = taRaw ? parseInt(taRaw) : null;

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

  // Date validation
  if (availableFrom && availableUntil && new Date(availableFrom) > new Date(availableUntil)) {
    showToast('Available from cannot be after available until', 'error');
    return;
  }
  if (availableUntil && new Date(dueDate) > new Date(availableUntil)) {
    showToast('Due date cannot be after available until', 'error');
    return;
  }
  if (availableFrom && new Date(availableFrom) > new Date(dueDate)) {
    showToast('Available from cannot be after the due date', 'error');
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
    assignment.hidden = status !== 'published';
    assignment.allowLateSubmissions = allowLate;
    assignment.latePenaltyType = latePenaltyType;
    assignment.lateDeduction = latePenalty;
    assignment.gradingNotes = gradingNotes;
    assignment.allowResubmission = allowResubmit;
    assignment.questionBankId = questionBankId;
    assignment.numQuestions = numQuestions;
    assignment.randomizeQuestions = randomizeQuestions;
    assignment.randomizeAnswers = randomizeAnswers;
    assignment.timeAllowed = timeAllowed;

    const result = await supabaseUpdateAssignment(assignment);
    if (!result) {
      Object.assign(assignment, original);
      return;
    }

  
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
      hidden: status !== 'published',
      allowLateSubmissions: allowLate,
      latePenaltyType: latePenaltyType,
      lateDeduction: latePenalty,
      gradingNotes: gradingNotes,
      allowResubmission: allowResubmit,
      questionBankId: questionBankId,
      numQuestions: numQuestions,
      randomizeQuestions: randomizeQuestions,
      randomizeAnswers: randomizeAnswers,
      timeAllowed: timeAllowed,
      createdAt: new Date().toISOString(),
      createdBy: appData.currentUser?.id
    };

    const result = await supabaseCreateAssignment(newAssignment);
    if (result) {
      appData.assignments.push(newAssignment);
    

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
  if (!assignment) {
    showToast('Assignment not found', 'error');
    return;
  }

  const now = new Date();

  if (assignment.availableFrom && now < new Date(assignment.availableFrom)) {
    showToast('This assignment is not available yet', 'error');
    return;
  }

  if (assignment.availableUntil && now > new Date(assignment.availableUntil)) {
    showToast('This assignment is closed (past available-until)', 'error');
    return;
  }
  
  // Check if past due and late submissions not allowed
  const dueDate = new Date(assignment.dueDate);
  
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
  // Caliper: AssignableEvent/Submitted
  caliperAssignmentSubmit(appData.currentUser, assignment);

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

  // Build metadata analytics
  const totalStudents = appData.enrollments.filter(e => e.courseId === activeCourseId && e.role === 'student').length;
  const submittedCount = submissions.length;
  const completionPct = totalStudents > 0 ? ((submittedCount / totalStudents) * 100).toFixed(0) : 0;
  const lateCount = submissions.filter(s => assignment.dueDate && new Date(s.submittedAt) > new Date(assignment.dueDate)).length;
  const gradedSubmissions = submissions.filter(s => appData.grades.find(g => g.submissionId === s.id));
  const gradedCount = gradedSubmissions.length;

  // Grade distribution
  const allScores = gradedSubmissions.map(s => {
    const g = appData.grades.find(gr => gr.submissionId === s.id);
    return g ? g.score : null;
  }).filter(s => s !== null);

  let gradeStats = '';
  if (allScores.length > 0) {
    const avg = (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1);
    const sorted = [...allScores].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? ((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(1)
      : sorted[Math.floor(sorted.length / 2)].toFixed(1);
    const minS = Math.min(...allScores);
    const maxS = Math.max(...allScores);
    const pct = (avg / assignment.points * 100).toFixed(1);
    // Grade distribution buckets
    const buckets = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const gs = (appData.gradeSettings || []).find(g => g.courseId === activeCourseId);
    allScores.forEach(sc => {
      const p = (sc / assignment.points) * 100;
      if (gs) {
        if (p >= gs.aMin) buckets.A++;
        else if (p >= gs.bMin) buckets.B++;
        else if (p >= gs.cMin) buckets.C++;
        else if (p >= gs.dMin) buckets.D++;
        else buckets.F++;
      }
    });
    const bucketHtml = gs ? Object.entries(buckets).map(([letter, count]) => {
      const barWidth = allScores.length > 0 ? (count / allScores.length * 100).toFixed(0) : 0;
      return `<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
        <span style="width:16px; font-weight:700; color:${getGradeColor(letter)};">${letter}</span>
        <div style="flex:1; height:16px; background:var(--border-light); border-radius:8px; overflow:hidden;">
          <div style="height:100%; width:${barWidth}%; background:${getGradeColor(letter)}; border-radius:8px;"></div>
        </div>
        <span class="muted" style="width:30px;">${count}</span>
      </div>`;
    }).join('') : '';
    gradeStats = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-bottom:16px;">
        <div style="text-align:center; padding:12px; background:var(--bg-color); border-radius:var(--radius);">
          <div style="font-size:1.5rem; font-weight:700;">${avg}</div>
          <div class="muted">Average (${pct}%)</div>
        </div>
        <div style="text-align:center; padding:12px; background:var(--bg-color); border-radius:var(--radius);">
          <div style="font-size:1.5rem; font-weight:700;">${median}</div>
          <div class="muted">Median</div>
        </div>
        <div style="text-align:center; padding:12px; background:var(--bg-color); border-radius:var(--radius);">
          <div style="font-size:1.5rem; font-weight:700;">${minS}–${maxS}</div>
          <div class="muted">Range</div>
        </div>
      </div>
      ${gs ? `<div style="margin-bottom:16px;"><div style="font-weight:600; margin-bottom:8px;">Grade Distribution</div>${bucketHtml}</div>` : ''}
    `;
  }

  const metadataHtml = `
    <div class="card" style="margin-bottom:16px; background:var(--primary-light);">
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:12px; margin-bottom:${allScores.length > 0 ? '16px' : '0'};">
        <div style="text-align:center;">
          <div style="font-size:1.8rem; font-weight:700;">${completionPct}%</div>
          <div class="muted">Completion (${submittedCount}/${totalStudents})</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.8rem; font-weight:700;">${gradedCount}</div>
          <div class="muted">Graded</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.8rem; font-weight:700; color:${lateCount > 0 ? 'var(--warning, #d97706)' : 'inherit'}">${lateCount}</div>
          <div class="muted">Late</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.8rem; font-weight:700;">${totalStudents - submittedCount}</div>
          <div class="muted">Not Submitted</div>
        </div>
      </div>
      ${gradeStats}
    </div>
  `;

  const html = `
    <div class="modal-overlay visible" id="submissionsModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title">Submissions: ${assignment.title}</h2>
          <button class="modal-close" onclick="closeModal('submissionsModal')">&times;</button>
        </div>
        <div class="modal-body">
          ${metadataHtml}
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

async function saveGrade(submissionId) {
  const score = parseFloat(document.getElementById('gradeScore').value);
  const feedback = document.getElementById('gradeFeedback').value.trim();
  const released = document.getElementById('gradeReleased').checked;

  if (isNaN(score) || !feedback) {
    showToast('Please provide score and feedback', 'error');
    return;
  }

  // Remove existing grade if any from local state
  appData.grades = appData.grades.filter(g => g.submissionId !== submissionId);

  // Create new grade
  const gradeObj = {
    submissionId: submissionId,
    score: score,
    feedback: feedback,
    released: released,
    gradedBy: appData.currentUser.id,
    gradedAt: new Date().toISOString()
  };

  // Save to Supabase
  await supabaseUpsertGrade(gradeObj);

  appData.grades.push(gradeObj);
  // Caliper: GradeEvent/Graded
  const gradedAssignment = appData.assignments.find(a => {
    const sub = appData.submissions.find(s => s.id === submissionId);
    return sub && a.id === sub.assignmentId;
  });
  if (gradedAssignment) caliperGradePosted(appData.currentUser, gradedAssignment, score, gradedAssignment.points);
  closeModal('gradeModal');
  closeModal('submissionsModal');
  renderGradebook();
  showToast('Grade saved!', 'success');
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


function deleteQuiz(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  ensureModalsRendered();
  showConfirmDialog(`Delete "${quiz.title}"? This will also delete all submissions.`, async () => {
    // Delete from Supabase
    const success = await supabaseDeleteQuiz(quizId);
    if (!success) return;

    // Update local state
    appData.quizzes = appData.quizzes.filter(q => q.id !== quizId);
    appData.quizSubmissions = appData.quizSubmissions.filter(s => s.quizId !== quizId);
  
    renderAssignments();
    renderHome();
    showToast('Quiz deleted', 'success');
  });
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
      let itemIcon = '';
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
        if (itemData) itemTitle = itemData.name;
      } else if (item.type === 'page') {
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
             onclick="${item.type === 'file' ? `openModuleFile('${item.refId}', event)` : ''}"
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

    const moduleVisText = mod.hidden ? 'Make Visible' : 'Hide from Students';
    const moduleHiddenBadge = mod.hidden
      ? '<span style="padding:4px 8px; background:var(--danger-light); color:var(--danger); border-radius:4px; font-size:0.75rem; font-weight:600; margin-left:8px;">Hidden</span>'
      : '';

    const moduleMenu = effectiveStaff ? `
      <button class="btn btn-secondary btn-sm" data-menu-btn onclick="toggleMenu(event, 'menu-mod-${mod.id}')">☰</button>
      <div id="menu-mod-${mod.id}" class="floating-menu">
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); toggleModuleVisibility('${mod.id}')">${moduleVisText}</button>
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); openAddModuleItemModal('${mod.id}')">Add Item</button>
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); editModule('${mod.id}')">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="closeMenu(); deleteModule('${mod.id}')" style="color:var(--danger);">Delete</button>
      </div>
    ` : '';

    return `
      <div class="module-card ${effectiveStaff ? 'draggable' : ''}" style="${mod.hidden ? 'opacity:0.7; border-style:dashed;' : ''}"
           draggable="${effectiveStaff}"
           data-module-id="${mod.id}"
           ondragstart="handleModuleDragStart(event)"
           ondragover="handleModuleDragOver(event)"
           ondrop="handleModuleDrop(event)"
           ondragend="handleModuleDragEnd(event)">
        <div class="module-header">
          <h3 class="module-title">${escapeHtml(mod.name)} ${moduleHiddenBadge}</h3>
          ${effectiveStaff ? `
            <div class="module-actions">
              ${moduleMenu}
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

function openModuleFile(fileId, event) {
  if (event?.target?.closest('.module-item-actions')) return;
  viewFile(fileId);
}

function isAssignmentVisibleInGradebook(assignment) {
  if (!assignment || assignment.courseId !== activeCourseId) return false;

  // Show active/published/closed assignments and anything that has passed
  // availability/due windows (treated as closed for grading visibility).
  const now = Date.now();
  const status = (assignment.status || '').toLowerCase();
  const published = status === 'published' || status === 'active' || status === 'closed';
  const closedByUntil = assignment.availableUntil && new Date(assignment.availableUntil).getTime() <= now;
  const closedByDue = assignment.dueDate && new Date(assignment.dueDate).getTime() <= now;
  return published || closedByUntil || closedByDue;
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

async function handleModuleDrop(event) {
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

  // Update positions in local state and Supabase
  for (let i = 0; i < modules.length; i++) {
    const mod = appData.modules.find(x => x.id === modules[i].id);
    if (mod && mod.position !== i) {
      mod.position = i;
      await supabaseUpdateModule(mod);
    }
  }

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

async function handleModuleItemDrop(event) {
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

  // Persist to Supabase - update the module_item's module_id if it changed
  if (sourceModule.id !== targetModule.id) {
    // Item moved to different module - update module_id
    await supabaseClient.from('module_items').update({
      module_id: targetModule.id,
      position: movedItem.position
    }).eq('id', movedItem.id);
  }

  // Update positions for source module items
  for (const item of sourceModule.items) {
    await supabaseClient.from('module_items').update({ position: item.position }).eq('id', item.id);
  }

  // Update positions for target module items (if different from source)
  if (sourceModule.id !== targetModule.id) {
    for (const item of targetModule.items) {
      await supabaseClient.from('module_items').update({ position: item.position }).eq('id', item.id);
    }
  }

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


  closeModal('moduleModal');
  renderModules();
  showToast(moduleId ? 'Module updated!' : 'Module created!', 'success');
}

function editModule(moduleId) {
  openModuleModal(moduleId);
}

function deleteModule(moduleId) {
  ensureModalsRendered();
  showConfirmDialog('Delete this module and all its items?', async () => {
    // Delete from Supabase
    const success = await supabaseDeleteModule(moduleId);
    if (!success) return;

    // Update local state
    appData.modules = appData.modules.filter(m => m.id !== moduleId);
  
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


  renderModules();
  showToast(module.hidden ? 'Module hidden from students' : 'Module visible to students', 'info');
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


  renderModules();
  showToast('Item removed from module', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI SYLLABUS PARSER
// ═══════════════════════════════════════════════════════════════════════════════


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

    const contents = [{
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: audioData
          }
        },
        { text: systemPrompt }
      ]
    }];

    const data = await callGeminiAPI(contents, { responseMimeType: "application/json", temperature: 0.2 });
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

async function applyAudioParsedResult() {
  if (!parsedAudioData) {
    showToast('No parsed data to apply', 'error');
    return;
  }

  if (parsedAudioData.outputType === 'announcement' && parsedAudioData.announcement) {
    const ann = parsedAudioData.announcement;

    const newAnnouncement = {
      id: generateId(),
      courseId: activeCourseId,
      title: ann.title || 'Untitled Announcement',
      content: ann.content || '',
      pinned: false,
      authorId: appData.currentUser.id,
      createdAt: new Date().toISOString(),
      scheduledFor: ann.scheduledFor || null
    };

    // Save to Supabase
    const result = await supabaseCreateAnnouncement(newAnnouncement);
    if (!result) {
      return; // Error already shown
    }

    appData.announcements.push(newAnnouncement);
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

    // Save to Supabase
    const result = await supabaseCreateQuiz(newQuiz);
    if (!result) {
      return; // Error already shown
    }

    appData.quizzes.push(newQuiz);
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

  // Student selector dropdown — anonymize if blind grading
  const isBlindForDropdown = !!assignment.blindGrading;
  document.getElementById('speedGraderStudentSelect').innerHTML = speedGraderStudents.map((s, i) => {
    const status = s.grade ? '✓' : (s.submission ? '○' : '—');
    const label = isBlindForDropdown ? `Student ${i + 1}` : (s.user ? s.user.name : 'Unknown');
    return `<option value="${i}" ${i === currentSpeedGraderStudentIndex ? 'selected' : ''}>${status} ${label}</option>`;
  }).join('');

  // Student info — hide identity if blind grading is enabled
  const isBlind = !!assignment.blindGrading;
  const displayName = isBlind ? `Student ${currentSpeedGraderStudentIndex + 1} (Anonymous)` : (student ? student.name : 'Unknown Student');
  const displayEmail = isBlind ? '' : (student ? student.email : '');
  const displayAvatar = isBlind ? '🙈' : (student ? student.avatar : '?');
  document.getElementById('speedGraderStudentInfo').innerHTML = `
    <div class="user-avatar" style="width:48px; height:48px; font-size:1.2rem;">${displayAvatar}</div>
    <div>
      <div style="font-weight:600; font-size:1.1rem;">${displayName}</div>
      ${displayEmail ? `<div class="muted">${displayEmail}</div>` : ''}
      ${isBlind ? '<div class="muted" style="font-size:0.8rem;">🙈 Blind grading — student identity hidden</div>' : ''}
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

    const contents = [{ parts: [{ text: prompt }] }];
    const data = await callGeminiAPI(contents, { responseMimeType: "application/json", temperature: 0.2 });
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

async function saveSpeedGraderGrade() {
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

  // Remove existing grade from local state
  appData.grades = appData.grades.filter(g => g.submissionId !== current.submission.id);

  // Create new grade
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

  // Save to Supabase
  await supabaseUpsertGrade(gradeObj);

  appData.grades.push(gradeObj);

  // Update local state
  current.grade = gradeObj;

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
  debugGradebookAssignmentVisibility();

  if (isStaffUser) {
    renderStaffGradebook();
  } else {
    renderStudentGradebook();
  }
}

function debugGradebookAssignmentVisibility() {
  const now = Date.now();
  const relevant = (appData.assignments || []).filter(a => a.courseId === activeCourseId);
  const details = relevant.map(a => {
    const status = (a.status || '').toLowerCase();
    const publishedLike = status === 'published' || status === 'active' || status === 'closed';
    const closedByUntil = !!(a.availableUntil && new Date(a.availableUntil).getTime() <= now);
    const closedByDue = !!(a.dueDate && new Date(a.dueDate).getTime() <= now);
    const visible = isAssignmentVisibleInGradebook(a);
    const reasons = [];
    if (publishedLike) reasons.push('status');
    if (closedByUntil) reasons.push('availableUntil<=now');
    if (closedByDue) reasons.push('dueDate<=now');
    return {
      id: a.id,
      title: a.title,
      status: a.status,
      hidden: !!a.hidden,
      dueDate: a.dueDate,
      availableFrom: a.availableFrom,
      availableUntil: a.availableUntil,
      visible,
      reasons: reasons.join('|') || 'none'
    };
  });

  console.groupCollapsed('[Gradebook Debug] Assignment visibility');
  console.log('activeCourseId:', activeCourseId);
  console.log('total assignments in course:', relevant.length);
  console.table(details);
  console.groupEnd();
}

function renderStudentGradebook() {
  setHTML('gradebookActions', '');
  
  const assignments = appData.assignments
    .filter(a => isAssignmentVisibleInGradebook(a))
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

  const gradeSettings = (appData.gradeSettings || []).find(gs => gs.courseId === activeCourseId);

  // Actions with search
  setHTML('gradebookActions', `
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
      <input type="text" class="form-input" placeholder="Search students..." value="${escapeHtml(gradebookSearch)}" onkeyup="updateGradebookSearch(this.value)" style="width:200px;">
      <button class="btn btn-secondary" onclick="openCategoryWeightsModal()">Category Weights ${hasWeights ? '✓' : ''}</button>
      <button class="btn btn-secondary" onclick="openGradeSettingsModal()">Grade Settings ${gradeSettings ? '✓' : ''}</button>
      <button class="btn btn-secondary" onclick="exportGradebook()">Export CSV</button>
    </div>
  `);

  const assignments = appData.assignments
    .filter(a => isAssignmentVisibleInGradebook(a))
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

  if (assignments.length === 0) {
    setHTML('gradebookWrap', '<div class="empty-state-text">No assignments yet</div>');
    return;
  }

  if (students.length === 0 && gradebookSearch) {
    setHTML('gradebookWrap', '<div class="empty-state-text">No students match your search</div>');
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
  
  // Display statistics cards (collapsed by default)
  let statsHTML = `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header" style="cursor:pointer; user-select:none;" onclick="toggleGradebookStats(this)">
        <div class="card-title" style="margin:0;">Assignment Statistics</div>
        <span id="gradebookStatsChevron" style="font-size:0.85rem; color:var(--text-muted);">&#9654; Show</span>
      </div>
      <div id="gradebookStatsBody" style="display:none; padding-top:12px;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
  `;

  assignmentStats.forEach(stat => {
    statsHTML += `
      <div style="padding:12px; background:var(--bg-color); border-radius:var(--radius); border:1px solid var(--border-color);">
        <div style="font-weight:600; font-size:0.9rem; margin-bottom:8px;">${stat.assignment.title}</div>
        <div style="font-size:0.85rem; color:var(--text-muted);">
          <div>Average: <strong>${stat.average}/${stat.assignment.points}</strong></div>
          <div>Median: ${stat.median}</div>
          <div>Range: ${stat.min}&ndash;${stat.max}</div>
          <div>Graded: ${stat.count}/${students.length}</div>
        </div>
      </div>
    `;
  });

  statsHTML += '</div></div></div>';
  
  // For the gradebook header, flag which assignments have blind grading on
  const table = `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:var(--bg-color); border-bottom:2px solid var(--border-color);">
            <th style="padding:12px; text-align:left; position:sticky; left:0; background:var(--bg-color);">Student</th>
            ${assignments.map(a => `<th style="padding:12px; text-align:center; min-width:120px;">${a.title}${a.blindGrading ? ' 🙈' : ''}<br><span class="muted" style="font-weight:normal;">(${a.points}pts)</span></th>`).join('')}
            <th style="padding:12px; text-align:center;">Total</th>
            <th style="padding:12px; text-align:center;">%</th>
            ${gradeSettings ? '<th style="padding:12px; text-align:center;">Grade</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${students.length === 0 ? `
            <tr>
              <td colspan="${assignments.length + 2 + (gradeSettings ? 1 : 0)}" style="padding:24px; text-align:center; color:var(--text-muted);">
                No students enrolled yet
              </td>
            </tr>
          ` : students.map((student, studentIdx) => {
            let totalScore = 0;
            let totalPoints = 0;

            const row = `
              <tr style="border-bottom:1px solid var(--border-light);">
                <td style="padding:12px; position:sticky; left:0; background:var(--bg-card);">${student.name}</td>
                ${assignments.map(a => {
                  const submission = appData.submissions.find(s => s.assignmentId === a.id && s.userId === student.id);
                  const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;
                  // Blind grading: use anonymous ID in click handler label but real IDs in function call
                  const displayName = a.blindGrading ? `Student ${studentIdx + 1}` : student.name;

                  if (grade) {
                    totalScore += grade.score;
                    totalPoints += a.points;
                    return `<td style="padding:12px; text-align:center; cursor:pointer;" onclick="openManualGradeModal('${student.id}', '${a.id}')" title="Click to edit grade for ${escapeHtml(displayName)}">${grade.score} ${grade.released ? '' : '🔒'}</td>`;
                  }
                  return `<td style="padding:12px; text-align:center; cursor:pointer;" class="muted" onclick="openManualGradeModal('${student.id}', '${a.id}')" title="Click to add grade for ${escapeHtml(displayName)}">—</td>`;
                }).join('')}
                <td style="padding:12px; text-align:center; font-weight:600;">${totalPoints > 0 ? `${totalScore}/${totalPoints}` : '—'}</td>
                ${(() => {
                  if (totalPoints === 0) return '<td style="padding:12px; text-align:center;">—</td>' + (gradeSettings ? '<td style="padding:12px; text-align:center;">—</td>' : '');
                  const curvedScore = Math.min(totalScore + (gradeSettings ? (gradeSettings.curve || 0) * totalPoints / 100 : 0), totalPoints);
                  const pct = (curvedScore / totalPoints) * 100;
                  const pctStr = pct.toFixed(1) + '%' + (gradeSettings?.curve ? ` (+${gradeSettings.curve}% curve)` : '');
                  const letterGrade = gradeSettings ? getLetterGrade(pct, gradeSettings) : null;
                  return `<td style="padding:12px; text-align:center; font-weight:600;">${pctStr}</td>` +
                    (gradeSettings ? `<td style="padding:12px; text-align:center; font-weight:700; color:${getGradeColor(letterGrade)};">${letterGrade}</td>` : '');
                })()}
              </tr>
            `;
            return row;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="muted" style="margin-top:12px; font-size:0.85rem;">🔒 = Grade not yet released to student · 🙈 = Blind grading enabled</div>
  `;
  
  setHTML('gradebookWrap', statsHTML + table);
}

function toggleGradebookStats(headerEl) {
  const body = document.getElementById('gradebookStatsBody');
  const chevron = document.getElementById('gradebookStatsChevron');
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  if (chevron) chevron.innerHTML = isHidden ? '&#9660; Hide' : '&#9654; Show';
}

function getLetterGrade(pct, settings) {
  if (!settings) return '—';
  if (pct >= settings.aMin) return 'A';
  if (pct >= settings.bMin) return 'B';
  if (pct >= settings.cMin) return 'C';
  if (pct >= settings.dMin) return 'D';
  return 'F';
}

function getGradeColor(letter) {
  const colors = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#dc2626', F: '#991b1b' };
  return colors[letter] || 'inherit';
}

function openGradeSettingsModal() {
  const existing = (appData.gradeSettings || []).find(gs => gs.courseId === activeCourseId) || {};
  const modalHtml = `
    <div class="modal-overlay" id="gradeSettingsModal" style="display:flex;">
      <div class="modal" style="max-width:480px;">
        <div class="modal-header">
          <h2 class="modal-title">Grade Settings</h2>
          <button class="modal-close" onclick="closeModal('gradeSettingsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div style="font-weight:600; margin-bottom:12px;">Letter Grade Cutoffs (minimum %)</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label">A (min %)</label>
              <input type="number" class="form-input" id="gs_aMin" min="0" max="100" value="${existing.aMin ?? 90}">
            </div>
            <div class="form-group">
              <label class="form-label">B (min %)</label>
              <input type="number" class="form-input" id="gs_bMin" min="0" max="100" value="${existing.bMin ?? 80}">
            </div>
            <div class="form-group">
              <label class="form-label">C (min %)</label>
              <input type="number" class="form-input" id="gs_cMin" min="0" max="100" value="${existing.cMin ?? 70}">
            </div>
            <div class="form-group">
              <label class="form-label">D (min %)</label>
              <input type="number" class="form-input" id="gs_dMin" min="0" max="100" value="${existing.dMin ?? 60}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Grade Curve (add % points to all scores)</label>
            <input type="number" class="form-input" id="gs_curve" min="0" max="100" value="${existing.curve ?? 0}" placeholder="0 = no curve">
            <div class="hint">E.g. enter 5 to add 5 percentage points to everyone's score.</div>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="gs_extraCredit" ${existing.extraCreditEnabled ? 'checked' : ''}>
              Enable extra credit (scores above 100% shown as bonus)
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('gradeSettingsModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveGradeSettings()">Save</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', modalHtml);
}

async function saveGradeSettings() {
  const settings = {
    courseId: activeCourseId,
    aMin: parseFloat(document.getElementById('gs_aMin').value) || 90,
    bMin: parseFloat(document.getElementById('gs_bMin').value) || 80,
    cMin: parseFloat(document.getElementById('gs_cMin').value) || 70,
    dMin: parseFloat(document.getElementById('gs_dMin').value) || 60,
    curve: parseFloat(document.getElementById('gs_curve').value) || 0,
    extraCreditEnabled: document.getElementById('gs_extraCredit').checked
  };
  const result = await supabaseUpsertGradeSettings(settings);
  if (result) {
    if (!appData.gradeSettings) appData.gradeSettings = [];
    const idx = appData.gradeSettings.findIndex(gs => gs.courseId === activeCourseId);
    if (idx >= 0) appData.gradeSettings[idx] = { id: result.id, ...settings };
    else appData.gradeSettings.push({ id: result.id, ...settings });
    closeModal('gradeSettingsModal');
    renderGradebook();
    showToast('Grade settings saved!', 'success');
  }
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
    await supabaseCreateSubmission(submission);
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


  closeModal('manualGradeModal');
  renderGradebook();
  showToast('Grade saved', 'success');
}

function exportGradebook() {
  const assignments = appData.assignments
    .filter(a => isAssignmentVisibleInGradebook(a))
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


function rejectAiAction(idx) {
  let msg = aiThread[idx];
  if (!msg || msg.role !== 'action') {
    msg = [...aiThread].reverse().find(m => m.role === 'action' && !m.hidden && !m.confirmed && !m.rejected);
  }
  if (!msg || msg.role !== 'action') return;

  if (!msg.confirmed && !msg.rejected) msg.rejected = true;
  msg.hidden = true;
  aiThread.push({ role: 'assistant', content: 'No problem - canceled that proposal and no changes have been made.' });
  renderAiThread();
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
  if (modal) {
    modal.classList.remove('visible');
    // Also clear inline display style (used by dynamically-injected modals like overrides)
    if (modal.style.display) modal.style.display = '';
  }

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

function saveSettings() {
  // Caliper sensor configuration
  const caliperEndpoint = document.getElementById('settingsCaliperEndpoint')?.value?.trim() || '';
  const caliperSensorId = document.getElementById('settingsCaliperSensorId')?.value?.trim() || 'campus-lms';
  localStorage.setItem('caliperEndpoint', caliperEndpoint);
  localStorage.setItem('caliperSensorId', caliperSensorId);
  if (caliperEndpoint) {
    initCaliperSensor(caliperSensorId, caliperEndpoint);
  }

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

async function updateCourse() {
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

  // Save to Supabase
  const result = await supabaseUpdateCourse(course);
  if (!result) {
    return; // Error already shown
  }

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

async function executeImportContent() {
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

  showToast('Importing content...', 'info');
  let importedCount = 0;

  if (selectedTypes.includes('assignments')) {
    const assignments = appData.assignments.filter(a => a.courseId === sourceCourseId);
    for (const assignment of assignments) {
      const newAssignment = {
        ...assignment,
        id: generateId(),
        courseId: activeCourseId,
        status: 'draft',
        createdAt: new Date().toISOString()
      };
      await supabaseCreateAssignment(newAssignment);
      appData.assignments.push(newAssignment);
      importedCount++;
    }
  }

  if (selectedTypes.includes('quizzes')) {
    const quizzes = appData.quizzes.filter(q => q.courseId === sourceCourseId);
    for (const quiz of quizzes) {
      const newQuiz = {
        ...quiz,
        id: generateId(),
        courseId: activeCourseId,
        status: 'draft',
        createdAt: new Date().toISOString(),
        questions: (quiz.questions || []).map(q => ({
          ...q,
          id: generateId()
        }))
      };
      await supabaseCreateQuiz(newQuiz);
      appData.quizzes.push(newQuiz);
      importedCount++;
    }
  }

  if (selectedTypes.includes('announcements')) {
    const announcements = appData.announcements.filter(a => a.courseId === sourceCourseId);
    for (const announcement of announcements) {
      const newAnnouncement = {
        ...announcement,
        id: generateId(),
        courseId: activeCourseId,
        authorId: appData.currentUser.id,
        createdAt: new Date().toISOString(),
        pinned: false
      };
      await supabaseCreateAnnouncement(newAnnouncement);
      appData.announcements.push(newAnnouncement);
      importedCount++;
    }
  }

  if (selectedTypes.includes('files')) {
    const files = appData.files.filter(f => f.courseId === sourceCourseId);
    for (const file of files) {
      const newFile = {
        ...file,
        id: generateId(),
        courseId: activeCourseId,
        uploadedBy: appData.currentUser.id,
        uploadedAt: new Date().toISOString()
      };
      await supabaseCreateFile(newFile);
      appData.files.push(newFile);
      importedCount++;
    }
  }

  if (selectedTypes.includes('categoryWeights') && appData.gradeCategories) {
    const weights = appData.gradeCategories.filter(w => w.courseId === sourceCourseId);
    // Remove existing categories for this course
    const existingCategories = appData.gradeCategories.filter(w => w.courseId === activeCourseId);
    for (const cat of existingCategories) {
      await supabaseDeleteGradeCategory(cat.id);
    }
    appData.gradeCategories = appData.gradeCategories.filter(w => w.courseId !== activeCourseId);

    for (const weight of weights) {
      const newCategory = {
        ...weight,
        id: generateId(),
        courseId: activeCourseId
      };
      await supabaseCreateGradeCategory(newCategory);
      appData.gradeCategories.push(newCategory);
    }
    importedCount += weights.length;
  }

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

  reader.onload = async function(event) {
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

    for (const email of emails) {
      if (!email || !email.includes('@')) {
        errors += 1;
        continue;
      }

      let user = appData.users.find(u => u.email === email);
      if (user) {
        const existing = appData.enrollments.find(e => e.userId === user.id && e.courseId === activeCourseId);
        if (existing) {
          await supabaseUpdateEnrollment(user.id, activeCourseId, defaultRole);
          existing.role = defaultRole;
        } else {
          const enrollment = {
            userId: user.id,
            courseId: activeCourseId,
            role: defaultRole
          };
          const result = await supabaseCreateEnrollment(enrollment);
          if (result) {
            appData.enrollments.push(enrollment);
          }
        }
        added += 1;
        continue;
      }

      if (!appData.invites) appData.invites = [];
      const invite = {
        courseId: activeCourseId,
        email: email,
        role: defaultRole,
        status: 'pending',
        sentAt: new Date().toISOString()
      };
      const result = await supabaseCreateInvite(invite);
      if (result) {
        appData.invites.push({ ...invite, id: result.id });
      }
      invited += 1;
    }

    closeModal('bulkStudentImportModal');
    renderPeople();
    showToast(`Imported ${added} students, invited ${invited}. ${errors} errors.`, errors ? 'error' : 'success');
  };

  reader.onerror = function() {
    showToast('Failed to read CSV file', 'error');
  };

  reader.readAsText(file);
}

async function addPersonToCourse() {
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
      // Update role in Supabase
      const result = await supabaseUpdateEnrollment(user.id, activeCourseId, role);
      if (result) {
        existing.role = role;
        showToast(`Updated ${user.name}'s role to ${role}`, 'success');
      }
    } else {
      // Add enrollment to Supabase
      const enrollment = {
        userId: user.id,
        courseId: activeCourseId,
        role: role
      };
      const result = await supabaseCreateEnrollment(enrollment);
      if (result) {
        appData.enrollments.push(enrollment);
        showToast(`Added ${user.name} as ${role}`, 'success');
      }
    }
  } else {
    // User doesn't exist - create invite in Supabase
    if (!appData.invites) appData.invites = [];

    const invite = {
      courseId: activeCourseId,
      email: email,
      role: role,
      status: 'pending',
      sentAt: new Date().toISOString()
    };
    const result = await supabaseCreateInvite(invite);
    if (result) {
      appData.invites.push({ ...invite, id: result.id });
      showToast(`Invitation sent to ${email}`, 'success');
    }
  }

  closeModal('addPersonModal');
  renderPeople();
}

function removePersonFromCourse(userId, courseId) {
  const user = getUserById(userId);

  // Ensure modals exist before calling confirm
  if (!document.getElementById('confirmModal')) {
    generateModals();
  }

  showConfirmDialog(`Remove ${user.name} from this course?`, async () => {
    // Delete from Supabase
    const result = await supabaseDeleteEnrollment(userId, courseId);
    if (!result) {
      return; // Error already shown
    }

    // Update local state
    appData.enrollments = appData.enrollments.filter(e => !(e.userId === userId && e.courseId === courseId));
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

  showConfirmDialog(`Revoke invitation for ${invite.email}?`, async () => {
    // Delete from Supabase
    const success = await supabaseDeleteInvite(inviteId);
    if (!success) return;

    // Remove from local state
    appData.invites = appData.invites.filter(i => i.id !== inviteId);
  
    renderPeople();
    showToast('Invitation revoked', 'success');
  });
}
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

async function saveRubric() {
  if (!currentRubricAssignment) return;

  const assignment = appData.assignments.find(a => a.id === currentRubricAssignment);
  const totalPoints = rubricCriteria.reduce((sum, c) => sum + (parseFloat(c.points) || 0), 0);

  if (Math.abs(totalPoints - assignment.points) > 0.1) {
    showToast('Rubric points must equal assignment points', 'error');
    return;
  }

  if (!appData.rubrics) appData.rubrics = [];

  // Check for existing rubric
  const existingRubric = appData.rubrics.find(r => r.assignmentId === currentRubricAssignment);

  if (existingRubric) {
    // Update existing rubric in Supabase
    await supabaseUpdateRubric(existingRubric.id, rubricCriteria);
    existingRubric.criteria = JSON.parse(JSON.stringify(rubricCriteria));
  } else {
    // Create new rubric in Supabase
    const result = await supabaseCreateRubric(currentRubricAssignment, rubricCriteria);
    if (result) {
      appData.rubrics.push({
        id: result.id,
        assignmentId: currentRubricAssignment,
        criteria: JSON.parse(JSON.stringify(rubricCriteria))
      });
      assignment.rubric = result.id;
    }
  }

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

async function saveCategoryWeights() {
  const inputs = document.querySelectorAll('.category-weight');
  let total = 0;

  const weights = [];
  inputs.forEach(input => {
    const weight = parseFloat(input.value) || 0;
    total += weight;
    weights.push({
      id: generateId(),
      courseId: activeCourseId,
      name: input.dataset.category,
      weight: weight / 100
    });
  });

  if (Math.abs(total - 100) > 0.1) {
    showToast('Weights must add up to 100%', 'error');
    return;
  }

  // Delete old weights for this course from Supabase
  const existingCategories = appData.gradeCategories.filter(c => c.courseId === activeCourseId);
  for (const cat of existingCategories) {
    if (cat.id) {
      await supabaseDeleteGradeCategory(cat.id);
    }
  }

  // Remove old weights for this course from local state
  appData.gradeCategories = appData.gradeCategories.filter(c => c.courseId !== activeCourseId);

  // Add new weights to Supabase and local state
  for (const weight of weights) {
    await supabaseCreateGradeCategory(weight);
    appData.gradeCategories.push(weight);
  }

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

async function processBulkGrades() {
  const data = document.getElementById('bulkGradeData').value.trim();
  const release = document.getElementById('bulkGradeRelease').checked;

  if (!data) {
    showToast('Please paste grade data', 'error');
    return;
  }

  const lines = data.split('\n').filter(l => l.trim());
  let imported = 0;
  let errors = 0;

  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 2) {
      errors++;
      continue;
    }

    const email = parts[0];
    const score = parseFloat(parts[1]);
    const feedback = parts[2] || 'No feedback provided';

    if (isNaN(score)) {
      errors++;
      continue;
    }

    // Find user
    const user = appData.users.find(u => u.email === email);
    if (!user) {
      errors++;
      continue;
    }

    // Find submission
    const submission = appData.submissions.find(s =>
      s.assignmentId === currentBulkAssignmentId && s.userId === user.id
    );

    if (!submission) {
      errors++;
      continue;
    }

    // Remove existing grade from local state
    appData.grades = appData.grades.filter(g => g.submissionId !== submission.id);

    // Create new grade
    const gradeObj = {
      submissionId: submission.id,
      score: score,
      feedback: feedback,
      released: release,
      gradedBy: appData.currentUser.id,
      gradedAt: new Date().toISOString()
    };

    // Save to Supabase
    await supabaseUpsertGrade(gradeObj);

    appData.grades.push(gradeObj);
    imported++;
  }

  closeModal('bulkGradeModal');
  renderGradebook();
  showToast(`Imported ${imported} grades. ${errors} errors.`, imported > 0 ? 'success' : 'error');

  document.getElementById('bulkGradeData').value = '';
  document.getElementById('bulkGradeRelease').checked = false;
}

function bulkReleaseGrades(assignmentId) {
  ensureModalsRendered();
  showConfirmDialog('Release all grades for this assignment to students?', () => {
    const submissions = appData.submissions.filter(s => s.assignmentId === assignmentId);
    let released = 0;
    
    submissions.forEach(submission => {
      const grade = appData.grades.find(g => g.submissionId === submission.id);
      if (grade && !grade.released) {
        grade.released = true;
        released++;
        
      }
    });
    
  
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

async function toggleAssignmentVisibility(assignmentId) {
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  if (!assignment) return;

  const originalStatus = assignment.status;
  const originalHidden = assignment.hidden;
  const shouldHide = !(assignment.hidden || assignment.status !== 'published');

  assignment.hidden = shouldHide;
  assignment.status = shouldHide ? 'draft' : 'published';

  const result = await supabaseUpdateAssignment(assignment);
  if (!result) {
    assignment.status = originalStatus;
    assignment.hidden = originalHidden;
    showToast('Failed to update assignment visibility', 'error');
    return;
  }

  renderAssignments();
  showToast(shouldHide ? 'Assignment hidden from students' : 'Assignment visible to students', 'success');
}

function toggleQuizVisibility(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  const wasPublished = quiz.status === 'published';
  quiz.status = wasPublished ? 'draft' : 'published';


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
  updateModuleStudentViewMode(studentViewMode); // also calls setAIStudentViewMode
  // Clear AI thread so professor-view history doesn't bleed into student view and vice versa
  clearAiThread();
  renderAiThread();
  renderTopBarViewToggle();
  renderAll();
  showToast(studentViewMode ? 'Viewing as student' : 'Back to instructor view', 'info');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISCUSSION BOARD
// ═══════════════════════════════════════════════════════════════════════════════

let activeDiscussionThreadId = null; // null = thread list; string = thread detail
let discussionAiDraft = null; // { threadId, text, originalText } — pending AI reply draft
// Expose draft so inline oninput handler can mutate it
Object.defineProperty(window, 'discussionAiDraft', {
  get() { return discussionAiDraft; },
  set(v) { discussionAiDraft = v; }
});

function renderDiscussion() {
  if (!activeCourseId) {
    setText('discussionSubtitle', 'Select a course');
    setHTML('discussionActions', '');
    setHTML('discussionContent', '<div class="empty-state-text">No active course</div>');
    return;
  }
  const course = getCourseById(activeCourseId);
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId) && !studentViewMode;

  if (activeDiscussionThreadId) {
    renderDiscussionThread(isStaffUser, course);
  } else {
    renderDiscussionList(isStaffUser, course);
  }
}

function renderDiscussionList(isStaffUser, course) {
  setText('discussionSubtitle', course.name);
  setHTML('discussionActions', isStaffUser ? `
    <button class="btn btn-primary" onclick="openCreateDiscussionThreadModal()">New Thread</button>
  ` : `
    <button class="btn btn-primary" onclick="openCreateDiscussionThreadModal()">Start Discussion</button>
  `);

  const threads = (appData.discussionThreads || [])
    .filter(t => t.courseId === activeCourseId && (!t.hidden || isStaffUser))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  if (threads.length === 0) {
    setHTML('discussionContent', '<div class="empty-state"><div class="empty-state-title">No discussions yet</div><div class="empty-state-text">Be the first to start a conversation!</div></div>');
    return;
  }

  const html = threads.map(t => {
    const author = getUserById(t.authorId);
    const replyCount = (t.replies || []).length;
    return `
      <div class="card" style="cursor:pointer; ${t.hidden ? 'opacity:0.6;' : ''}" onclick="openDiscussionThread('${t.id}')">
        <div class="card-header">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              ${t.pinned ? '<span style="font-size:0.7rem; background:var(--primary); color:#fff; padding:2px 7px; border-radius:10px; font-weight:700; letter-spacing:0.05em;">PINNED</span>' : ''}
              ${t.hidden ? '<span style="font-size:0.7rem; background:var(--warning,#f59e0b); color:#fff; padding:2px 7px; border-radius:10px; font-weight:700; letter-spacing:0.05em;">Hidden</span>' : ''}
              <div class="card-title" style="margin:0;">${escapeHtml(t.title)}</div>
            </div>
            <div class="muted" style="font-size:0.85rem; margin-top:4px;">
              ${escapeHtml(author?.name || 'Unknown')} · ${formatDate(t.createdAt)} · ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}
            </div>
          </div>
          ${isStaffUser ? `
            <div style="display:flex; gap:6px;" onclick="event.stopPropagation()">
              <button class="btn btn-secondary btn-sm" onclick="toggleDiscussionPin('${t.id}')">${t.pinned ? 'Unpin' : 'Pin'}</button>
              <button class="btn btn-secondary btn-sm" onclick="toggleDiscussionHide('${t.id}')">${t.hidden ? 'Show' : 'Hide'}</button>
              <button class="btn btn-danger btn-sm" onclick="deleteDiscussionThread('${t.id}')">Delete</button>
            </div>
          ` : ''}
        </div>
        ${t.content ? `<div class="muted" style="margin-top:8px; white-space:pre-wrap; overflow:hidden; max-height:3.6em;">${escapeHtml(t.content.slice(0, 200))}${t.content.length > 200 ? '…' : ''}</div>` : ''}
      </div>
    `;
  }).join('');

  setHTML('discussionContent', html);
}

function renderDiscussionThread(isStaffUser, course) {
  const thread = (appData.discussionThreads || []).find(t => t.id === activeDiscussionThreadId);
  if (!thread) { activeDiscussionThreadId = null; renderDiscussion(); return; }

  setText('discussionSubtitle', course.name + ' › ' + thread.title);
  setHTML('discussionActions', `<button class="btn btn-secondary" onclick="closeDiscussionThread()">← All Threads</button>`);

  const author = getUserById(thread.authorId);
  const repliesHtml = (thread.replies || []).map(r => {
    const rAuthor = getUserById(r.authorId);
    const canDelete = isStaffUser || r.authorId === appData.currentUser.id;
    const aiLabel = r.isAi ? (r.aiEdited ? 'AI · Edited' : 'AI') : null;
    return `
      <div class="card" style="margin-bottom:8px; ${r.isAi ? 'border-color:var(--primary); background:var(--primary-light);' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <strong>${escapeHtml(rAuthor?.name || 'Unknown')}</strong>
            ${r.isAi ? `<span style="font-size:0.75rem; background:var(--primary); color:#fff; padding:1px 6px; border-radius:8px; margin-left:6px;">${aiLabel}</span>` : ''}
            <span class="muted" style="font-size:0.85rem; margin-left:8px;">${formatDate(r.createdAt)}</span>
          </div>
          ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="deleteDiscussionReply('${r.id}', '${thread.id}')">Delete</button>` : ''}
        </div>
        <div class="markdown-content" style="margin-top:8px;">${renderMarkdown(r.content)}</div>
      </div>
    `;
  }).join('') || '<div class="muted" style="padding:12px 0;">No replies yet. Be the first to reply!</div>';

  // AI draft preview (shown after Ask AI, before the user posts)
  const draft = discussionAiDraft && discussionAiDraft.threadId === thread.id ? discussionAiDraft : null;
  const aiDraftHtml = draft ? `
    <div class="card" style="margin-bottom:16px; border-color:var(--primary); background:var(--primary-light);">
      <div style="font-weight:600; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
        🤖 AI Suggested Reply
        <span style="font-size:0.75rem; background:var(--primary); color:#fff; padding:1px 8px; border-radius:8px;">Review &amp; edit before posting</span>
      </div>
      <textarea class="form-textarea" id="aiDraftTextarea" rows="6" oninput="discussionAiDraft.text=this.value">${escapeHtml(draft.text)}</textarea>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="btn btn-primary" onclick="postAiDraftReply('${thread.id}')">Post</button>
        <button class="btn btn-secondary" onclick="dismissAiDraft()">Don't post</button>
      </div>
    </div>
  ` : '';

  setHTML('discussionContent', `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h2 style="margin:0 0 4px;">${escapeHtml(thread.title)}</h2>
          <div class="muted">${escapeHtml(author?.name || 'Unknown')} · ${formatDate(thread.createdAt)}</div>
        </div>
        ${isStaffUser ? `
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="toggleDiscussionPin('${thread.id}')">${thread.pinned ? 'Unpin' : 'Pin'}</button>
            <button class="btn btn-secondary btn-sm" onclick="toggleDiscussionHide('${thread.id}')">${thread.hidden ? 'Show' : 'Hide'}</button>
          </div>
        ` : ''}
      </div>
      ${thread.content ? `<div class="markdown-content" style="margin-top:12px;">${renderMarkdown(thread.content)}</div>` : ''}
    </div>

    <div style="margin-bottom:16px;">
      <div style="font-weight:600; margin-bottom:8px;">${(thread.replies || []).length} Repl${(thread.replies || []).length === 1 ? 'y' : 'ies'}</div>
      ${repliesHtml}
    </div>

    ${aiDraftHtml}

    <div class="card">
      <div style="font-weight:600; margin-bottom:8px;">Add Reply</div>
      <textarea class="form-textarea" id="discussionReplyInput" rows="4" placeholder="Write your reply… or use Ask AI to draft one"></textarea>
      <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="postDiscussionReply('${thread.id}')">Post Reply</button>
        <button class="btn btn-secondary" id="discussionAiBtn" onclick="postDiscussionAiReply('${thread.id}')">Ask AI</button>
      </div>
    </div>
  `);
}

function openDiscussionThread(threadId) {
  activeDiscussionThreadId = threadId;
  renderDiscussion();
}

function closeDiscussionThread() {
  activeDiscussionThreadId = null;
  renderDiscussion();
}

function closeDiscussionThreadModal() {
  document.getElementById('discussionThreadModal')?.remove();
}

function openCreateDiscussionThreadModal() {
  if (!activeCourseId) return;
  // Remove any stale copy before inserting a fresh one
  closeDiscussionThreadModal();
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId) && !studentViewMode;
  const modalHtml = `
    <div class="modal-overlay" id="discussionThreadModal" style="display:flex;">
      <div class="modal" style="max-width:600px;">
        <div class="modal-header">
          <h2 class="modal-title">New Discussion Thread</h2>
          <button class="modal-close" onclick="closeDiscussionThreadModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input type="text" class="form-input" id="newThreadTitle" placeholder="Thread title…">
          </div>
          <div class="form-group">
            <label class="form-label">Content (optional)</label>
            <textarea class="form-textarea" id="newThreadContent" rows="4" placeholder="Add context, question, or prompt…"></textarea>
          </div>
          ${isStaffUser ? `
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="newThreadPinned"> Pin this thread
            </label>
          </div>` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeDiscussionThreadModal()">Cancel</button>
          <button class="btn btn-primary" onclick="createDiscussionThread()">Create Thread</button>
        </div>
      </div>
    </div>
  `;
  const container = document.getElementById('modalsContainer');
  container.insertAdjacentHTML('beforeend', modalHtml);
  setTimeout(() => document.getElementById('newThreadTitle')?.focus(), 50);
}

function createDiscussionThread() {
  const title = document.getElementById('newThreadTitle')?.value.trim();
  if (!title) { showToast('Thread title required', 'error'); return; }
  const content = document.getElementById('newThreadContent')?.value.trim();
  const pinned = document.getElementById('newThreadPinned')?.checked || false;

  const thread = {
    id: generateId(),
    courseId: activeCourseId,
    title,
    content: content || null,
    authorId: appData.currentUser.id,
    createdAt: new Date().toISOString(),
    pinned,
    hidden: false,
    replies: []
  };

  // Optimistic update — don't block UI on Supabase
  if (!appData.discussionThreads) appData.discussionThreads = [];
  appData.discussionThreads.unshift(thread);
  closeDiscussionThreadModal();
  openDiscussionThread(thread.id);
  showToast('Thread created!', 'success');
  supabaseCreateDiscussionThread(thread); // fire and don't await
}

function postDiscussionReply(threadId) {
  const input = document.getElementById('discussionReplyInput');
  const content = input?.value.trim();
  if (!content) { showToast('Reply cannot be empty', 'error'); return; }

  const reply = {
    id: generateId(),
    threadId,
    content,
    authorId: appData.currentUser.id,
    isAi: false,
    createdAt: new Date().toISOString()
  };

  // Optimistic update
  const thread = (appData.discussionThreads || []).find(t => t.id === threadId);
  if (thread) {
    if (!thread.replies) thread.replies = [];
    thread.replies.push(reply);
  }
  if (input) input.value = '';
  renderDiscussion();
  showToast('Reply posted!', 'success');
  supabaseCreateDiscussionReply(reply); // fire and don't await
}

async function postDiscussionAiReply(threadId) {
  const thread = (appData.discussionThreads || []).find(t => t.id === threadId);
  if (!thread) return;

  const questionInput = document.getElementById('discussionReplyInput');
  const question = questionInput?.value.trim();
  if (!question) { showToast('Type your question or context first, then click Ask AI', 'error'); return; }

  const btn = document.getElementById('discussionAiBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Thinking…'; }

  try {
    const course = getCourseById(activeCourseId);
    // Build full course context: professor, TAs, course info
    const enrollments = (appData.enrollments || []).filter(e => e.courseId === activeCourseId);
    const instructorEnrollment = enrollments.find(e => e.role === 'instructor');
    const instructorUser = instructorEnrollment ? getUserById(instructorEnrollment.userId) : null;
    const taUsers = enrollments
      .filter(e => e.role === 'ta')
      .map(e => getUserById(e.userId))
      .filter(Boolean);

    const isCurrentUserStaff = isStaff(appData.currentUser.id, activeCourseId) && !studentViewMode;
    const roleNote = isCurrentUserStaff
      ? 'The user is an instructor or TA.'
      : 'The user is a student.';

    const systemPrompt = [
      `You are a helpful academic assistant for the course "${course?.name || 'this course'}".`,
      instructorUser ? `Professor: ${instructorUser.name}.` : '',
      taUsers.length ? `Teaching Assistants: ${taUsers.map(t => t.name).join(', ')}.` : '',
      course?.description ? `Course description: ${course.description}` : '',
      roleNote,
      'Write a reply that stands alone and would make sense posted directly in the discussion thread.',
      'Be clear, concise, and helpful. Do not mention that you are an AI in the reply body itself.'
    ].filter(Boolean).join(' ');

    const threadContext = `Discussion thread: "${thread.title}"\n${thread.content ? 'Thread content: ' + thread.content + '\n' : ''}User input/question: ${question}`;

    const contents = [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + threadContext }] }];
    const response = await callGeminiAPIWithRetry(contents);
    const aiText = response?.candidates?.[0]?.content?.parts?.[0]?.text || 'I was unable to generate a response.';

    // Show draft for review — don't post immediately
    discussionAiDraft = { threadId, text: aiText, originalText: aiText };
    if (questionInput) questionInput.value = '';
    renderDiscussion();
  } catch (err) {
    showToast('Failed to get AI response', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Ask AI'; }
  }
}

function postAiDraftReply(threadId) {
  const textarea = document.getElementById('aiDraftTextarea');
  const text = textarea?.value?.trim() || discussionAiDraft?.text?.trim();
  if (!text) return;

  const wasEdited = discussionAiDraft && text !== discussionAiDraft.originalText;

  const reply = {
    id: generateId(),
    threadId,
    content: text,
    authorId: appData.currentUser.id,
    isAi: true,
    aiEdited: wasEdited,
    createdAt: new Date().toISOString()
  };

  // Optimistic update
  const thread = (appData.discussionThreads || []).find(t => t.id === threadId);
  if (thread) {
    if (!thread.replies) thread.replies = [];
    thread.replies.push(reply);
  }
  discussionAiDraft = null;
  renderDiscussion();
  showToast(wasEdited ? 'Edited AI reply posted!' : 'AI reply posted!', 'success');
  supabaseCreateDiscussionReply(reply); // fire and don't await
}

function dismissAiDraft() {
  discussionAiDraft = null;
  renderDiscussion();
}

async function toggleDiscussionPin(threadId) {
  const thread = (appData.discussionThreads || []).find(t => t.id === threadId);
  if (!thread) return;
  thread.pinned = !thread.pinned;
  const ok = await supabaseUpdateDiscussionThread(thread);
  if (ok) renderDiscussion();
}

async function toggleDiscussionHide(threadId) {
  const thread = (appData.discussionThreads || []).find(t => t.id === threadId);
  if (!thread) return;
  thread.hidden = !thread.hidden;
  const ok = await supabaseUpdateDiscussionThread(thread);
  if (ok) renderDiscussion();
}

function deleteDiscussionThread(threadId) {
  ensureModalsRendered();
  showConfirmDialog('Delete this thread and all its replies?', () => {
    appData.discussionThreads = (appData.discussionThreads || []).filter(t => t.id !== threadId);
    if (activeDiscussionThreadId === threadId) activeDiscussionThreadId = null;
    renderDiscussion();
    showToast('Thread deleted', 'success');
    supabaseDeleteDiscussionThread(threadId);
  });
}

function deleteDiscussionReply(replyId, threadId) {
  ensureModalsRendered();
  showConfirmDialog('Delete this reply?', () => {
    const thread = (appData.discussionThreads || []).find(t => t.id === threadId);
    if (thread) thread.replies = (thread.replies || []).filter(r => r.id !== replyId);
    renderDiscussion();
    showToast('Reply deleted', 'success');
    supabaseDeleteDiscussionReply(replyId);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI OVERLAY PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function toggleAiOverlay() {
  const overlay = document.getElementById('aiOverlay');
  if (!overlay) return;
  const isOpen = overlay.style.display !== 'none';
  overlay.style.display = isOpen ? 'none' : 'block';

  // Update toolbar button active state
  const btn = document.getElementById('aiOverlayBtn');
  if (btn) btn.classList.toggle('active', !isOpen);

  if (!isOpen) {
    // Focus the input when opening
    setTimeout(() => {
      const input = document.getElementById('aiInput');
      if (input) input.focus();
    }, 50);
  }
}

/**
 * Navigate to a page and close the AI overlay — used in AI confirmation links
 */
function navigateAndClose(page) {
  const overlay = document.getElementById('aiOverlay');
  if (overlay) overlay.style.display = 'none';
  const btn = document.getElementById('aiOverlayBtn');
  if (btn) btn.classList.remove('active');
  navigateTo(page);
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
          View as Student
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
// WINDOW ASSIGNMENTS FOR ONCLICK HANDLERS
// Since this is loaded as a module, functions must be explicitly assigned to window
// ═══════════════════════════════════════════════════════════════════════════════

// Navigation, modals, and AI overlay
window.navigateTo = navigateTo;
window.toggleAiOverlay = toggleAiOverlay;
window.navigateAndClose = navigateAndClose;
window.openModal = openModal;
window.closeModal = closeModal;
window.openImportContentModal = openImportContentModal;
window.executeImportContent = executeImportContent;
window.openLinkedFile = openLinkedFile;

// Course management
window.createCourse = createCourse;
window.joinCourse = joinCourse;
window.updateCourse = updateCourse;
window.switchCourse = switchCourse;
window.showInactiveCoursesSection = showInactiveCoursesSection;
window.hideInactiveCoursesSection = hideInactiveCoursesSection;

// Start Here section
window.addStartHereLink = addStartHereLink;
window.saveStartHere = saveStartHere;
window.openStartHereModal = openStartHereModal;
window.toggleStartHereLinkType = toggleStartHereLinkType;
window.updateStartHereLink = updateStartHereLink;
window.removeStartHereLink = removeStartHereLink;

// Announcements
window.createAnnouncement = createAnnouncement;
window.editAnnouncement = editAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.saveAnnouncementChanges = saveAnnouncementChanges;
window.viewAnnouncement = viewAnnouncement;
window.toggleAnnouncementVisibility = toggleAnnouncementVisibility;

// Assignments
window.createAssignment = createAssignment;
window.editAssignment = editAssignment;
window.deleteAssignment = deleteAssignment;
window.saveAssignmentChanges = saveAssignmentChanges;
window.saveNewAssignment = saveNewAssignment;
window.openNewAssignmentModal = openNewAssignmentModal;
window.resetNewAssignmentModal = resetNewAssignmentModal;
window.openDeadlineOverridesFromModal = openDeadlineOverridesFromModal;
window.handleNewAssignmentTypeChange = handleNewAssignmentTypeChange;
window.openAssignmentModal = openAssignmentModal;
window.toggleAssignmentVisibility = toggleAssignmentVisibility;
window.openCreateAssignmentTypeModal = openCreateAssignmentTypeModal;
window.handleCreateTypeChange = handleCreateTypeChange;
window.confirmCreateType = confirmCreateType;

// Submissions and grading
window.submitAssignment = submitAssignment;
window.saveSubmission = saveSubmission;
window.viewSubmissions = viewSubmissions;
window.gradeSubmission = gradeSubmission;
window.saveGrade = saveGrade;
window.openManualGradeModal = openManualGradeModal;
window.saveManualGrade = saveManualGrade;
window.exportGradebook = exportGradebook;
window.toggleGradebookStats = toggleGradebookStats;

// Speed Grader
window.openSpeedGrader = openSpeedGrader;
window.speedGraderSelectStudent = speedGraderSelectStudent;
window.speedGraderPrev = speedGraderPrev;
window.speedGraderNext = speedGraderNext;
window.speedGraderDraftWithAI = speedGraderDraftWithAI;
window.saveSpeedGraderGrade = saveSpeedGraderGrade;
window.calculateSpeedGraderRubricTotal = calculateSpeedGraderRubricTotal;

// Question Banks
window.openQuestionBankModal = openQuestionBankModal;
window.openCreateQuestionBankForm = openCreateQuestionBankForm;
window.editQuestionBank = editQuestionBank;
window.deleteQuestionBank = deleteQuestionBank;
window.addQuestionToBankForm = addQuestionToBankForm;
window.editQuestionInBank = editQuestionInBank;
window.removeQuestionFromBank = removeQuestionFromBank;
window.openQuestionEditor = openQuestionEditor;
window.changeQuestionType = changeQuestionType;
window.addQuestionOption = addQuestionOption;
window.removeQuestionOption = removeQuestionOption;
window.cancelQuestionEdit = cancelQuestionEdit;
window.saveQuestionEdit = saveQuestionEdit;
window.saveQuestionBank = saveQuestionBank;

// Quizzes
window.toggleQuizPoolFields = toggleQuizPoolFields;
window.updateQuizQuestion = updateQuizQuestion;
window.updateQuizOption = updateQuizOption;
window.addQuizQuestion = addQuizQuestion;
window.removeQuizQuestion = removeQuizQuestion;
window.deleteQuiz = deleteQuiz;
window.toggleQuizVisibility = toggleQuizVisibility;
window.viewQuizDetails = viewQuizDetails;
window.viewQuizSubmission = viewQuizSubmission;

// Modules
window.openModuleModal = openModuleModal;
window.saveModule = saveModule;
window.editModule = editModule;
window.deleteModule = deleteModule;
window.toggleModuleVisibility = toggleModuleVisibility;
window.openAddModuleItemModal = openAddModuleItemModal;
window.updateAddItemOptions = updateAddItemOptions;
window.addModuleItem = addModuleItem;
window.removeModuleItem = removeModuleItem;

// Module drag and drop
window.handleModuleDragStart = handleModuleDragStart;
window.handleModuleDragOver = handleModuleDragOver;
window.handleModuleDrop = handleModuleDrop;
window.handleModuleDragEnd = handleModuleDragEnd;
window.handleModuleItemDragStart = handleModuleItemDragStart;
window.handleModuleItemDragOver = handleModuleItemDragOver;
window.handleModuleItemDrop = handleModuleItemDrop;
window.handleModuleItemDragEnd = handleModuleItemDragEnd;

// Rubrics
window.openRubricModal = openRubricModal;
window.addRubricCriterion = addRubricCriterion;
window.removeRubricCriterion = removeRubricCriterion;
window.updateRubricCriterion = updateRubricCriterion;
window.saveRubric = saveRubric;
window.calculateRubricScore = calculateRubricScore;

// Category Weights
window.openCategoryWeightsModal = openCategoryWeightsModal;
window.updateTotalWeight = updateTotalWeight;
window.saveCategoryWeights = saveCategoryWeights;

// Bulk operations
window.openBulkStudentImportModal = openBulkStudentImportModal;
window.processBulkStudentImport = processBulkStudentImport;
window.openBulkGradeModal = openBulkGradeModal;
window.processBulkGrades = processBulkGrades;
window.bulkReleaseGrades = bulkReleaseGrades;

// People management
window.openAddPersonModal = openAddPersonModal;
window.addPersonToCourse = addPersonToCourse;
window.removePersonFromCourse = removePersonFromCourse;
window.revokeInvite = revokeInvite;

// Settings
window.saveSettings = saveSettings;
window.openEditCourseModal = openEditCourseModal;
window.downloadOneRosterExport = downloadOneRosterExport;
window._appData = appData; // reference for modal inline handlers (e.g. OneRoster export)

// Clone course
window.openCloneCourseModal = openCloneCourseModal;
window.cloneCourse = cloneCourse;

// Calendar export
window.exportCalendarICS = exportCalendarICS;

// Editor toolbar and insert
window.insertLink = insertLink;
window.insertVideo = insertVideo;
window.insertFileLink = insertFileLink;
window.openInsertLinkModal = openInsertLinkModal;
window.confirmInsertLink = confirmInsertLink;
window.openInsertVideoModal = openInsertVideoModal;
window.previewInsertVideo = previewInsertVideo;
window.confirmInsertVideo = confirmInsertVideo;
window.openInsertFileModal = openInsertFileModal;
window.selectFileForInsert = selectFileForInsert;
window.confirmInsertExternalFile = confirmInsertExternalFile;

// External links
window.openExternalLinkModal = openExternalLinkModal;
window.saveExternalLink = saveExternalLink;

// AI features
window.toggleAiRecording = toggleAiRecording;
window.startAiRecording = startAiRecording;
window.stopAiRecording = stopAiRecording;
window.updateAiCreateType = updateAiCreateType;
window.openAiCreateModal = openAiCreateModal;
window.applyAiDraft = applyAiDraft;

// Audio recording
window.openAudioInputModal = openAudioInputModal;
window.startAudioRecording = startAudioRecording;
window.stopAudioRecording = stopAudioRecording;
window.transcribeAudio = transcribeAudio;
window.applyAudioParsedResult = applyAudioParsedResult;

// Unified content creation
window.openUnifiedContentModal = openUnifiedContentModal;
window.createFromUnified = createFromUnified;
window.toggleNewAssignmentDropdown = toggleNewAssignmentDropdown;
window.closeNewAssignmentDropdown = closeNewAssignmentDropdown;

// Student view
window.toggleStudentView = toggleStudentView;

// Search and sort
window.updateModulesSearch = updateModulesSearch;
window.updateFilesSearch = updateFilesSearch;
window.updateFilesSort = updateFilesSort;
window.updateGradebookSearch = updateGradebookSearch;
window.updatePeopleSearch = updatePeopleSearch;

// File handling
window.handleFilesDrop = handleFilesDrop;
window.viewFile = viewFile;
window.updateFileUploadPreview = updateFileUploadPreview;
window.openModuleFile = openModuleFile;

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ TIME OVERRIDES (per-student time limits)
// ═══════════════════════════════════════════════════════════════════════════════

function openQuizTimeOverridesModal(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  // Remove any existing instance so we start clean
  const existing = document.getElementById('quizTimeOverridesModal');
  if (existing) existing.remove();

  const students = appData.enrollments
    .filter(e => e.courseId === activeCourseId && e.role === 'student')
    .map(e => getUserById(e.userId))
    .filter(u => u)
    .sort((a, b) => a.name.localeCompare(b.name));

  const existingOverrides = (appData.quizTimeOverrides || []).filter(o => o.quizId === quizId);
  const defaultLabel = quiz.timeLimit ? `${quiz.timeLimit} min (default)` : 'No limit (default)';

  const rowsHtml = students.map(s => {
    const override = existingOverrides.find(o => o.userId === s.id);
    return `
      <tr>
        <td style="padding:8px;">${escapeHtml(s.name)}</td>
        <td style="padding:8px;" class="muted">${defaultLabel}</td>
        <td style="padding:8px;">
          <input type="number" class="form-input" style="width:120px;" min="1" max="600"
            id="qto_${s.id}" value="${override?.timeLimit || ''}" placeholder="min">
        </td>
        <td style="padding:8px;">
          ${override ? `<button class="btn btn-danger btn-sm" onclick="removeQuizTimeOverride('${quizId}', '${s.id}')">Remove</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const modalHtml = `
    <div class="modal-overlay" id="quizTimeOverridesModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title">Time Overrides — ${escapeHtml(quiz.title)}</h2>
          <button class="modal-close" onclick="closeModal('quizTimeOverridesModal')">&times;</button>
        </div>
        <div class="modal-body" style="max-height:60vh; overflow-y:auto;">
          ${students.length === 0 ? '<div class="muted">No students enrolled.</div>' : `
            <p class="muted" style="margin-bottom:12px;">Set custom time limits for individual students. Leave blank to use the default. Set to 0 for unlimited time.</p>
            <table style="width:100%; border-collapse:collapse;">
              <thead><tr style="text-align:left;">
                <th style="padding:8px; border-bottom:1px solid var(--border-color);">Student</th>
                <th style="padding:8px; border-bottom:1px solid var(--border-color);">Default</th>
                <th style="padding:8px; border-bottom:1px solid var(--border-color);">Custom (minutes)</th>
                <th style="padding:8px; border-bottom:1px solid var(--border-color);"></th>
              </tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          `}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizTimeOverridesModal')">Close</button>
          <button class="btn btn-primary" onclick="saveQuizTimeOverrides('${quizId}')">Save All</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', modalHtml);
  openModal('quizTimeOverridesModal');
}

async function saveQuizTimeOverrides(quizId) {
  const students = appData.enrollments
    .filter(e => e.courseId === activeCourseId && e.role === 'student')
    .map(e => getUserById(e.userId))
    .filter(u => u);

  for (const s of students) {
    const input = document.getElementById(`qto_${s.id}`);
    if (!input || input.value === '') continue;
    const timeLimit = parseInt(input.value, 10);
    const override = { quizId, userId: s.id, timeLimit: timeLimit || null };
    const result = await supabaseUpsertQuizTimeOverride(override);
    if (result) {
      if (!appData.quizTimeOverrides) appData.quizTimeOverrides = [];
      const idx = appData.quizTimeOverrides.findIndex(o => o.quizId === quizId && o.userId === s.id);
      if (idx >= 0) appData.quizTimeOverrides[idx].timeLimit = override.timeLimit;
      else appData.quizTimeOverrides.push({ id: result.id, ...override });
    }
  }
  closeModal('quizTimeOverridesModal');
  showToast('Time overrides saved!', 'success');
}

async function removeQuizTimeOverride(quizId, userId) {
  const ok = await supabaseDeleteQuizTimeOverride(quizId, userId);
  if (ok) {
    appData.quizTimeOverrides = (appData.quizTimeOverrides || []).filter(
      o => !(o.quizId === quizId && o.userId === userId)
    );
    closeModal('quizTimeOverridesModal');
    openQuizTimeOverridesModal(quizId);
    showToast('Override removed', 'success');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEADLINE OVERRIDES (per-student deadlines)
// ═══════════════════════════════════════════════════════════════════════════════

function openDeadlineOverridesModal(assignmentId) {
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  if (!assignment) return;

  // Remove any stale instance so we always start fresh
  const existingEl = document.getElementById('deadlineOverridesModal');
  if (existingEl) existingEl.remove();

  const students = appData.enrollments
    .filter(e => e.courseId === activeCourseId && e.role === 'student')
    .map(e => getUserById(e.userId))
    .filter(u => u)
    .sort((a, b) => a.name.localeCompare(b.name));

  const invitedEmails = (appData.invites || [])
    .filter(i => i.courseId === activeCourseId && i.status === 'pending' && (!i.role || i.role === 'student'))
    .map(i => ({ id: 'invited_' + i.id, name: i.email + ' (invited)', email: i.email }));

  const allPeople = [...students, ...invitedEmails];
  const existingOverrides = (appData.assignmentOverrides || []).filter(o => o.assignmentId === assignmentId);

  // Helper to format datetime-local value from ISO string (local time)
  function toLocalDtLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const defaultDueFmt = assignment.dueDate ? toLocalDtLocal(assignment.dueDate) : '';
  const defaultFromFmt = assignment.availableFrom ? toLocalDtLocal(assignment.availableFrom) : '';
  const defaultUntilFmt = assignment.availableUntil ? toLocalDtLocal(assignment.availableUntil) : '';
  const defaultTimeAllowed = assignment.timeAllowed || '';

  const rowsHtml = allPeople.map(p => {
    const ov = existingOverrides.find(o => o.userId === p.id);
    const dueFmt = ov?.dueDate ? toLocalDtLocal(ov.dueDate) : '';
    const fromFmt = ov?.availableFrom ? toLocalDtLocal(ov.availableFrom) : '';
    const untilFmt = ov?.availableUntil ? toLocalDtLocal(ov.availableUntil) : '';
    const taFmt = ov?.timeAllowed != null ? ov.timeAllowed : '';
    return `
      <tr style="border-bottom:1px solid var(--border-light);">
        <td style="padding:8px; font-weight:500;">${escapeHtml(p.name)}</td>
        <td style="padding:6px;">
          <input type="datetime-local" class="form-input" style="width:180px; font-size:0.85rem;"
            id="ov_due_${p.id}" value="${dueFmt}" placeholder="${escapeHtml(defaultDueFmt)}">
        </td>
        <td style="padding:6px;">
          <input type="datetime-local" class="form-input" style="width:180px; font-size:0.85rem;"
            id="ov_from_${p.id}" value="${fromFmt}" placeholder="${escapeHtml(defaultFromFmt)}">
        </td>
        <td style="padding:6px;">
          <input type="datetime-local" class="form-input" style="width:180px; font-size:0.85rem;"
            id="ov_until_${p.id}" value="${untilFmt}" placeholder="${escapeHtml(defaultUntilFmt)}">
        </td>
        <td style="padding:6px;">
          <input type="number" class="form-input" style="width:90px; font-size:0.85rem;" min="1"
            id="ov_ta_${p.id}" value="${taFmt}" placeholder="${defaultTimeAllowed || 'min'}">
        </td>
        <td style="padding:6px;">
          ${ov ? `<button class="btn btn-danger btn-sm" onclick="removeDeadlineOverride('${assignmentId}', '${p.id}')">Remove</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const modalHtml = `
    <div class="modal-overlay" id="deadlineOverridesModal">
      <div class="modal" style="max-width:1000px;">
        <div class="modal-header">
          <h2 class="modal-title">Student Overrides — ${escapeHtml(assignment.title)}</h2>
          <button class="modal-close" onclick="closeModal('deadlineOverridesModal')">&times;</button>
        </div>
        <div class="modal-body" style="max-height:65vh; overflow-y:auto;">
          ${allPeople.length === 0 ? '<div class="muted">No students enrolled yet.</div>' : `
            <p class="muted" style="margin-bottom:12px;">Set per-student overrides. Leave blank to use the assignment default. Time Allowed = minutes from when they start.</p>
            <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; min-width:800px;">
              <thead><tr style="text-align:left; background:var(--bg-color);">
                <th style="padding:8px; border-bottom:2px solid var(--border-color);">Student</th>
                <th style="padding:8px; border-bottom:2px solid var(--border-color);">Custom Deadline<br><span class="muted" style="font-weight:normal; font-size:0.8rem;">default: ${formatDate(assignment.dueDate)}</span></th>
                <th style="padding:8px; border-bottom:2px solid var(--border-color);">Available From<br><span class="muted" style="font-weight:normal; font-size:0.8rem;">default: ${assignment.availableFrom ? formatDate(assignment.availableFrom) : 'now'}</span></th>
                <th style="padding:8px; border-bottom:2px solid var(--border-color);">Available Until<br><span class="muted" style="font-weight:normal; font-size:0.8rem;">default: ${assignment.availableUntil ? formatDate(assignment.availableUntil) : 'always'}</span></th>
                <th style="padding:8px; border-bottom:2px solid var(--border-color);">Time Allowed (min)<br><span class="muted" style="font-weight:normal; font-size:0.8rem;">default: ${assignment.timeAllowed ? assignment.timeAllowed + ' min' : 'unlimited'}</span></th>
                <th style="padding:8px; border-bottom:2px solid var(--border-color);"></th>
              </tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            </div>
          `}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('deadlineOverridesModal')">Close</button>
          <button class="btn btn-primary" onclick="saveDeadlineOverrides('${assignmentId}')">Save All</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', modalHtml);
  openModal('deadlineOverridesModal');
}

async function saveDeadlineOverrides(assignmentId) {
  const students = appData.enrollments
    .filter(e => e.courseId === activeCourseId && e.role === 'student')
    .map(e => getUserById(e.userId))
    .filter(u => u);
  const invitedEmails = (appData.invites || [])
    .filter(i => i.courseId === activeCourseId && i.status === 'pending' && (!i.role || i.role === 'student'))
    .map(i => ({ id: 'invited_' + i.id }));
  const allPeople = [...students, ...invitedEmails];

  for (const p of allPeople) {
    const dueInput = document.getElementById(`ov_due_${p.id}`);
    const fromInput = document.getElementById(`ov_from_${p.id}`);
    const untilInput = document.getElementById(`ov_until_${p.id}`);
    const taInput = document.getElementById(`ov_ta_${p.id}`);
    if (!dueInput) continue;

    const dueVal = dueInput.value;
    const fromVal = fromInput ? fromInput.value : '';
    const untilVal = untilInput ? untilInput.value : '';
    const taVal = taInput ? taInput.value : '';

    // Only save if at least one field has been set
    if (dueVal || fromVal || untilVal || taVal) {
      const override = {
        assignmentId,
        userId: p.id,
        dueDate: dueVal ? new Date(dueVal).toISOString() : null,
        availableFrom: fromVal ? new Date(fromVal).toISOString() : null,
        availableUntil: untilVal ? new Date(untilVal).toISOString() : null,
        timeAllowed: taVal ? parseInt(taVal) : null
      };
      const result = await supabaseUpsertAssignmentOverride(override);
      if (result) {
        if (!appData.assignmentOverrides) appData.assignmentOverrides = [];
        const idx = appData.assignmentOverrides.findIndex(o => o.assignmentId === assignmentId && o.userId === p.id);
        if (idx >= 0) Object.assign(appData.assignmentOverrides[idx], override);
        else appData.assignmentOverrides.push({ id: result.id, ...override });
      }
    }
  }
  closeModal('deadlineOverridesModal');
  showToast('Overrides saved!', 'success');
}

async function removeDeadlineOverride(assignmentId, userId) {
  const ok = await supabaseDeleteAssignmentOverride(assignmentId, userId);
  if (ok) {
    appData.assignmentOverrides = (appData.assignmentOverrides || []).filter(
      o => !(o.assignmentId === assignmentId && o.userId === userId)
    );
    closeModal('deadlineOverridesModal');
    openDeadlineOverridesModal(assignmentId);
    showToast('Override removed', 'success');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility functions
window.debugAuthState = debugAuthState;
window.viewSubmissionHistory = viewSubmissionHistory;
window.scrollAiThreadToBottom = scrollAiThreadToBottom;
window.updateAiActionField = updateAiActionField;
window.rejectAiAction = rejectAiActionFromModule;

// Grade settings
window.openGradeSettingsModal = openGradeSettingsModal;
window.saveGradeSettings = saveGradeSettings;

// Quiz time overrides
window.openQuizTimeOverridesModal = openQuizTimeOverridesModal;
window.saveQuizTimeOverrides = saveQuizTimeOverrides;
window.removeQuizTimeOverride = removeQuizTimeOverride;

// Deadline overrides
window.openDeadlineOverridesModal = openDeadlineOverridesModal;
window.saveDeadlineOverrides = saveDeadlineOverrides;
window.removeDeadlineOverride = removeDeadlineOverride;

// Discussion board
window.openDiscussionThread = openDiscussionThread;
window.closeDiscussionThread = closeDiscussionThread;
window.openCreateDiscussionThreadModal = openCreateDiscussionThreadModal;
window.closeDiscussionThreadModal = closeDiscussionThreadModal;
window.createDiscussionThread = createDiscussionThread;
window.postDiscussionReply = postDiscussionReply;
window.postDiscussionAiReply = postDiscussionAiReply;
window.postAiDraftReply = postAiDraftReply;
window.dismissAiDraft = dismissAiDraft;
window.toggleDiscussionPin = toggleDiscussionPin;
window.toggleDiscussionHide = toggleDiscussionHide;
window.deleteDiscussionThread = deleteDiscussionThread;
window.deleteDiscussionReply = deleteDiscussionReply;

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

  // Initialize all imported modules
  initModules();

  // Listen for auth state changes (handles INITIAL_SESSION on page refresh and SIGNED_IN after OAuth)
  // IMPORTANT: Defer async work outside Supabase's auth callback to avoid lock contention.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    setTimeout(() => {
      handleAuthStateChange(event, session);
    }, 0);
  });

  // NOTE: We rely on onAuthStateChange with INITIAL_SESSION instead of checkExistingSession()
  // to avoid double-bootstrap race conditions

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
