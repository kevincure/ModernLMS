/* ═══════════════════════════════════════════════════════════════════════════════
   Constants and AI Prompts for Campus LMS
   All configuration constants, role definitions, and AI system prompts
═══════════════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════════════
// USER ROLES
// ═══════════════════════════════════════════════════════════════════════════════

export const ROLES = {
  INSTRUCTOR: 'instructor',
  TA: 'ta',
  STUDENT: 'student'
};

export const ROLE_LABELS = {
  [ROLES.INSTRUCTOR]: 'Instructor',
  [ROLES.TA]: 'Teaching Assistant',
  [ROLES.STUDENT]: 'Student'
};

export const ROLE_DISPLAY_LABELS = {
  [ROLES.INSTRUCTOR]: 'You are the instructor',
  [ROLES.TA]: 'You are a TA',
  [ROLES.STUDENT]: 'You are a student'
};

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT & QUIZ STATUS
// ═══════════════════════════════════════════════════════════════════════════════

export const STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed'
};

export const INVITE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted'
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ QUESTION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  SHORT_ANSWER: 'short_answer'
};

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const ASSIGNMENT_CATEGORIES = {
  HOMEWORK: 'homework',
  ESSAY: 'essay',
  PROJECT: 'project',
  PARTICIPATION: 'participation'
};

// ═══════════════════════════════════════════════════════════════════════════════
// LATE PENALTY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const LATE_PENALTY_TYPES = {
  PER_DAY: 'per_day',
  FLAT: 'flat'
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULTS = {
  ASSIGNMENT_POINTS: 100,
  LATE_DEDUCTION: 10,
  QUIZ_TIME_LIMIT: 20,
  QUIZ_ATTEMPTS: 2,
  START_HERE_TITLE: 'Start Here'
};

// ═══════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

export const FILE_SETTINGS = {
  VALID_SYLLABUS_TYPES: ['.pdf', '.doc', '.docx', '.txt'],
  MAX_FILE_SIZE_MB: 10,
  CACHE_CONTROL: '3600'
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const AI_CONFIG = {
  TEMPERATURE_GRADING: 0.2,
  TEMPERATURE_CHAT: 0.4,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROMPTS - GRADING
// ═══════════════════════════════════════════════════════════════════════════════

export const AI_PROMPTS = {
  /**
   * Generate a prompt for AI-assisted grading of a submission
   * @param {Object} assignment - The assignment object
   * @param {Object} submission - The submission object
   * @param {Object|null} rubric - Optional rubric with criteria
   * @returns {string} The formatted prompt
   */
  gradeSubmission: (assignment, submission, rubric = null) => {
    let rubricContext = '';
    if (rubric && rubric.criteria) {
      rubricContext = '\n\nRubric criteria:\n' + rubric.criteria.map(c =>
        `- ${c.name} (${c.points} pts): ${c.description}`
      ).join('\n');
    }

    return `You are grading a student submission for an assignment.

Assignment: ${assignment.title}
Description: ${assignment.description}
Points possible: ${assignment.points}
${rubricContext}

Student submission:
${submission.text || 'No text submission provided'}

Please provide a grade and feedback. Respond ONLY with valid JSON in this format:
{"score": <number>, "feedback": "<string>"}

The score should be between 0 and ${assignment.points}. The feedback should be constructive and specific.`;
  },

  /**
   * Generate a prompt for SpeedGrader AI drafting
   * @param {Object} assignment - The assignment object
   * @param {Object} submission - The submission object
   * @param {Object|null} rubric - Optional rubric with criteria
   * @returns {string} The formatted prompt
   */
  speedGraderDraft: (assignment, submission, rubric = null) => {
    let rubricContext = '';
    if (rubric && rubric.criteria) {
      rubricContext = '\n\nRubric criteria:\n' + rubric.criteria.map(c =>
        `- ${c.name} (${c.points} pts): ${c.description}`
      ).join('\n');
    }

    return `Grade this student submission for the assignment "${assignment.title}".
Assignment description: ${assignment.description}
Max points: ${assignment.points}
${rubricContext}

Student submission:
${submission.text || 'No text submitted'}

Provide a score (0-${assignment.points}) and constructive feedback. Return JSON:
{"score": <number>, "feedback": "<string>"}`;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SYLLABUS PARSING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * System prompt for parsing syllabus documents
   */
  parseSyllabus: `You are analyzing a course syllabus. Extract all assignments, modules/units, readings, and due dates. Return ONLY valid JSON with the following structure:
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
5. Extract course metadata (name, code, instructor) if available at the top of the syllabus`,

  // ═══════════════════════════════════════════════════════════════════════════
  // AI CONTENT CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Prompt for creating an announcement via AI
   */
  createAnnouncement: `Create a course announcement. Return ONLY valid JSON with keys: title, content.

FORMATTING for content (supports markdown):
- Use **bold** for emphasis, *italic* for terms
- Use bullet lists with "- item" format
- Use headers with ## or ###
- Embed YouTube videos by placing the full URL on its own line (it will auto-embed)
- Use \`code\` for inline code

Example: {"title":"...","content":"..."} - do not wrap in code fences or extra text.`,

  /**
   * Prompt for creating a quiz via AI
   * @param {number} questionCount - Number of questions to generate
   * @returns {string} The formatted prompt
   */
  createQuiz: (questionCount = 5) =>
    `Create a quiz as JSON with keys: title, description, questions (array). Each question must include type ("multiple_choice"|"true_false"|"short_answer"), prompt, options (array, for multiple_choice only), correctAnswer (index for multiple_choice, "True"/"False" for true_false, empty string for short_answer), points (number). Provide ${questionCount} questions. Return only JSON (no markdown). Example: {"title":"...","description":"...","questions":[{"type":"multiple_choice","prompt":"...","options":["A","B"],"correctAnswer":0,"points":2}]}.`,

  /**
   * Prompt for creating a rubric via AI
   * @param {number} totalPoints - Total points the rubric should sum to
   * @returns {string} The formatted prompt
   */
  createRubric: (totalPoints = 100) =>
    `Create a grading rubric for this assignment. Return ONLY JSON with key criteria (array). Each criterion must include name, points, description. Total points should sum to ${totalPoints}. Example: {"criteria":[{"name":"...","points":10,"description":"..."}]}.`,

};

// ═══════════════════════════════════════════════════════════════════════════════
// AI TOOL REGISTRY  — single source of truth for AI tools and actions
// To add a new capability: (1) add entry here, (2) add handler in executeAiTool()
// or handleAiAction(), (3) add action card renderer in renderActionPreview().
// The system prompt is built dynamically from this registry at call time.
// ═══════════════════════════════════════════════════════════════════════════════

export const AI_TOOL_REGISTRY = {
  version: '1.3',

  // Context tools: AI calls these to look up real IDs and current data.
  // Each result is fed back into the conversation before the AI emits an action.
  context_tools: [
    { name: 'list_assignments',         description: 'All assignments (id, title, assignmentType, gradingType, status, points, dueDate, isGroupAssignment, groupSetId)' },
    { name: 'list_quizzes',             description: 'All standalone quizzes (id, title, status, dueDate, questionCount)' },
    { name: 'list_files',               description: 'All uploaded files (id, name, type, size, hidden, folder)' },
    { name: 'list_modules',             description: 'Module structure with item IDs, titles, and hidden status' },
    { name: 'list_people',              description: 'Enrolled users AND pending invites. Enrolled rows: {userId, name, email, role, status:"enrolled"}. Pending invite rows: {inviteId, email, role, status:"pending_invite"}. ALWAYS call this before any invite or person action.' },
    { name: 'list_question_banks',      description: 'All question banks (id, name, questionCount, totalPoints)' },
    { name: 'list_announcements',       description: 'All announcements (id, title, pinned, hidden, createdAt)' },
    { name: 'get_grade_categories',     description: 'Grade categories and weights for this course (read-only)' },
    { name: 'get_grade_settings',       description: 'Letter grade thresholds and curve settings (read-only)' },
    { name: 'list_discussion_threads',  description: 'Discussion threads (id, title, pinned, replyCount)' },
    { name: 'list_group_sets',          description: 'All group sets in this course (id, name, description, groupCount, groups[{id, name, memberCount}])' },
    { name: 'get_question_bank',        description: 'Full question list for a bank (includes question IDs)', params: { bank_id: 'string' } },
    { name: 'get_assignment',           description: 'Full assignment details including rubric', params: { assignment_id: 'string' } },
    { name: 'get_quiz',                 description: 'Full quiz with all questions', params: { quiz_id: 'string' } },
    { name: 'get_file_content',         description: 'Read text content of a file (PDF/doc)', params: { file_id: 'string' } },
    { name: 'get_assignment_analytics', description: 'Submission and grade stats for an assignment (submittedCount, averageScore, ungradedCount, etc.)', params: { assignment_id: 'string' } },
    { name: 'get_student_grades',       description: 'All grades for a specific enrolled student in this course', params: { user_id: 'string' } },
    { name: 'get_group_set',            description: 'Full group set details including groups and their members', params: { group_set_id: 'string' } }
  ],

  // Action types: AI emits one of these → system renders a Take Action Card →
  // user clicks Confirm → deterministic code executes (AI never touches the DB).
  action_types: [
    // Assignments
    { name: 'create_assignment',       description: 'Create a new assignment (essay / quiz / no_submission). For group assignments set isGroupAssignment=true, groupSetId (from list_group_sets), and groupGradingMode (per_group or individual)',  fields: 'title, description, assignmentType, gradingType, points, dueDate, status, submissionModalities, allowLateSubmissions, lateDeduction, allowResubmission, submissionAttempts, gradingNotes, questionBankId, timeLimit, randomizeQuestions, availableFrom, availableUntil, fileIds, isGroupAssignment, groupSetId, groupGradingMode' },
    { name: 'update_assignment',       description: 'Edit an existing assignment. Can also toggle group assignment settings.',  fields: 'id*, title, description, points, dueDate, status, assignmentType, gradingType, allowLateSubmissions, lateDeduction, allowResubmission, isGroupAssignment, groupSetId, groupGradingMode' },
    { name: 'delete_assignment',       description: 'Permanently delete an assignment',   dangerous: true,    fields: 'id*' },
    // Quizzes
    { name: 'create_quiz_from_bank',   description: 'Create quiz/exam linked to a question bank',            fields: 'title, description, category, questionBankId*, numQuestions, randomizeQuestions, randomizeAnswers, dueDate, availableFrom, availableUntil, points, timeLimit, attempts, allowLateSubmissions, status, gradingNotes' },
    // Question Banks
    { name: 'create_question_bank',    description: 'Create a new question bank with questions. Supported question types: multiple_choice, true_false, short_answer, essay, fill_in_blank, matching, ordering', fields: 'name* (bank title — use "name" NOT "bankName"), description, questions:[{type* (use "type" NOT "questionType"), prompt* (use "prompt" NOT "questionPrompt"), options, correctAnswer, points}]' },
    { name: 'update_question_bank',    description: 'Edit question bank name or description',                 fields: 'id* (from list_question_banks), name, description' },
    { name: 'add_questions_to_bank',   description: 'Append new questions to an existing question bank',      fields: 'id* (from list_question_banks), bankName, questions:[{type,prompt,options,correctAnswer,points}]' },
    { name: 'delete_question_bank',    description: 'Permanently delete a question bank', dangerous: true,   fields: 'id* (from list_question_banks)' },
    { name: 'delete_question_from_bank', description: 'Delete a single question from a question bank', dangerous: true, fields: 'bankId* (from list_question_banks), questionId* (from get_question_bank), questionPrompt' },
    // Announcements
    { name: 'create_announcement',     description: 'Create a new announcement',                             fields: 'title, content, pinned, status, fileIds' },
    { name: 'update_announcement',     description: 'Edit an existing announcement (title, content, pinning, visibility)', fields: 'id*, title, content, pinned, hidden' },
    { name: 'delete_announcement',     description: 'Permanently delete announcement',    dangerous: true,   fields: 'id*' },
    { name: 'publish_announcement',    description: 'Publish a draft announcement (make visible to students)', fields: 'id*' },
    { name: 'pin_announcement',        description: 'Pin or unpin announcement',                             fields: 'id*, pinned (boolean)' },
    // Modules
    { name: 'create_module',           description: 'Create a new module',                                   fields: 'name, description' },
    { name: 'update_module',           description: 'Rename a module',                                       fields: 'moduleId* (from list_modules), moduleName (old name for display), name (new name)' },
    { name: 'set_module_visibility',   description: 'Show or hide a module from students',                   fields: 'moduleId* (from list_modules), moduleName, hidden (boolean — true=hidden, false=visible)' },
    { name: 'add_to_module',           description: 'Add item to a module',                                  fields: 'moduleId*, moduleName, itemType (assignment|quiz|file|external_link), itemId, itemTitle, url (external_link only)' },
    { name: 'remove_from_module',      description: 'Remove item from a module',                             fields: 'moduleId*, itemId* (module item id), itemTitle' },
    { name: 'move_to_module',          description: 'Move item between modules',                             fields: 'itemId*, fromModuleId*, toModuleId*' },
    // Files
    { name: 'rename_file',             description: 'Rename a file',                                         fields: 'fileId* (from list_files), oldName, newName' },
    { name: 'set_file_folder',         description: 'Move a file into a folder (or remove from folder)',      fields: 'fileId* (from list_files), fileName, folder (string or null to remove)' },
    { name: 'set_file_visibility',     description: 'Show or hide a file from students',                     fields: 'fileId* (from list_files), fileName, hidden (boolean — true=hidden, false=visible)' },
    // People
    { name: 'create_invite',           description: 'Invite people to the course by email',                  fields: 'emails (array), role (student|ta|instructor)' },
    { name: 'revoke_invite',           description: 'Revoke a pending invite — REQUIRES list_people first to get inviteId', dangerous: true, fields: 'inviteId* (from list_people), email' },
    { name: 'remove_person',           description: 'Remove enrolled user from course',   dangerous: true,   fields: 'userId* (from list_people), name' },
    // Course
    { name: 'update_start_here',       description: 'Edit the Start Here / Welcome message shown on the course home page', fields: 'title, content (markdown supported)' },
    { name: 'set_course_visibility',   description: 'Show or hide the entire course from students',          fields: 'visible (boolean)' },
    // Calendar
    { name: 'create_calendar_event',   description: 'Add a non-assignment calendar entry (class, lecture, office hours, etc.)', fields: 'title, eventDate (ISO 8601), eventType (Class|Lecture|Office Hours|Exam|Event), description' },
    // Groups
    { name: 'create_group_set',        description: 'Create a new group set with N groups. Students can be auto-assigned afterwards.', fields: 'name*, description, groupCount (number of groups to create, default 4)' },
    { name: 'delete_group_set',        description: 'Permanently delete a group set and all its groups', dangerous: true, fields: 'id* (from list_group_sets), name' },
    { name: 'auto_assign_groups',      description: 'Randomly assign all unassigned students to groups in a set (round-robin)', fields: 'groupSetId* (from list_group_sets), groupSetName' },
    // Messaging
    { name: 'send_message',            description: 'Send a direct message to one or more users in this course', fields: 'recipientIds* (array of user IDs from list_people), subject, message*' },
    { name: 'pipeline',                description: 'Execute multiple actions in sequence',                  fields: 'steps (array of action objects)' }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT DATA STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_DATA = {
  currentUser: null,
  users: [],
  courses: [],
  enrollments: [],
  assignments: [],
  submissions: [],
  grades: [],
  announcements: [],
  files: [],
  rubrics: [],
  quizzes: [],
  quizQuestions: [],
  quizSubmissions: [],
  gradeCategories: [],
  invites: [],
  modules: [],
  questionBanks: [],
  settings: {},
  // Groups
  groupSets: [],
  courseGroups: [],
  groupMembers: [],
  // Messaging
  conversations: [],
  conversationParticipants: [],
  allMessages: [],
  // Notifications
  notifications: [],
  notificationPreferences: null
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO/SAMPLE DATA (for development/testing)
// ═══════════════════════════════════════════════════════════════════════════════

export const SAMPLE_DATA = {
  users: [
    { id: 'u1', name: 'Dr. Sarah Chen', email: 'schen@university.edu', role: ROLES.INSTRUCTOR, avatar: 'SC' },
    { id: 'u2', name: 'Michael Park', email: 'mpark@university.edu', role: ROLES.TA, avatar: 'MP' },
    { id: 'u3', name: 'Emma Wilson', email: 'ewilson@student.edu', role: ROLES.STUDENT, avatar: 'EW' },
    { id: 'u4', name: 'James Rodriguez', email: 'jrodriguez@student.edu', role: ROLES.STUDENT, avatar: 'JR' },
    { id: 'u5', name: 'Aisha Patel', email: 'apatel@student.edu', role: ROLES.STUDENT, avatar: 'AP' }
  ],
  courses: [
    { id: 'c1', name: 'ECON 101 - Introduction to Economics', code: 'ECON101', createdBy: 'u1', description: 'An introduction to microeconomic and macroeconomic principles', startHereTitle: 'Start Here', startHereContent: 'Welcome to **ECON 101**! Begin by reviewing the syllabus and completing Quiz 1 before next week.' },
    { id: 'c2', name: 'ECON 301 - Advanced Microeconomics', code: 'ECON301', createdBy: 'u1', description: 'Advanced topics in microeconomic theory and applications', startHereTitle: 'Start Here', startHereContent: 'Read the course overview, then jump into the first problem set.' }
  ],
  enrollments: [
    { userId: 'u1', courseId: 'c1', role: ROLES.INSTRUCTOR },
    { userId: 'u1', courseId: 'c2', role: ROLES.INSTRUCTOR },
    { userId: 'u2', courseId: 'c1', role: ROLES.TA },
    { userId: 'u3', courseId: 'c1', role: ROLES.STUDENT },
    { userId: 'u4', courseId: 'c1', role: ROLES.STUDENT },
    { userId: 'u5', courseId: 'c1', role: ROLES.STUDENT },
    { userId: 'u3', courseId: 'c2', role: ROLES.STUDENT }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

export const ERROR_MESSAGES = {
  NOT_AUTHENTICATED: 'Not authenticated - please sign in again',
  DATABASE_NOT_CONNECTED: 'Database not connected',
  SUPABASE_NOT_CONFIGURED: 'Supabase not configured. Please check config.js',
  FAILED_TO_SAVE: 'Failed to save to database',
  FAILED_TO_UPDATE: 'Failed to update',
  FAILED_TO_DELETE: 'Failed to delete',
  AI_RESPONSE_EMPTY: 'AI response was empty.',
  AI_RESPONSE_INVALID_JSON: 'AI response was not valid JSON.',
  ALREADY_ENROLLED: 'You are already enrolled in this course'
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUCCESS MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

export const SUCCESS_MESSAGES = {
  GRADE_SAVED: 'Grade saved!',
  AI_DRAFT_READY: 'AI draft ready! Review and edit as needed.',
  SYLLABUS_PARSED: 'Syllabus parsed! Review and import.',
  AUDIO_TRANSCRIBED: 'Audio transcribed successfully!',
  DRAFT_READY: 'Draft ready! Review before applying.'
};

// ═══════════════════════════════════════════════════════════════════════════════
// UI CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const UI_CONFIG = {
  TOAST_DURATION_MS: 3000,
  STYLE_THEME: 'style-1' // Editorial theme
};
