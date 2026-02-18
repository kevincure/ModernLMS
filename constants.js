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

  /**
   * Shorter syllabus prompt for course creation flow
   */
  parseSyllabusForCourseCreation: `You are analyzing a course syllabus. Extract course information and all assignments, modules/units, readings. Return ONLY valid JSON:
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
Extract EACH reading/chapter as a SEPARATE item. For exams/quizzes use type "quiz". For homework/essays use "assignment".`,

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO TRANSCRIPTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Prompt for transcribing audio into an announcement
   */
  audioToAnnouncement: `Transcribe this audio and convert it into a course announcement. The user may specify timing like "send at midnight tomorrow" or "post this now".

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
}`,

  /**
   * Prompt for transcribing audio into a quiz
   */
  audioToQuiz: `Transcribe this audio and convert it into a quiz. The user may specify details like "five questions", "due at 2pm on Dec 18", "available immediately", "randomized order", "pull from question bank". Return ONLY valid JSON:
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
}`,

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

  // ═══════════════════════════════════════════════════════════════════════════
  // AI CHAT ASSISTANT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate the system prompt for AI chat assistant
   * @param {boolean} isStaffUser - Whether the user is instructor/TA
   * @param {string} context - Course context information
   * @param {string} conversationContext - Recent conversation history
   * @returns {string} The formatted system prompt
   */
  chatAssistant: (isStaffUser, context, conversationContext) => {
    const staffInstructions = `The user is an INSTRUCTOR/TA. You can help them create content.

IMPORTANT: If the user asks you to CREATE, EDIT, DELETE, or MANAGE content, you MUST respond with a JSON object in this EXACT format:

=== ANNOUNCEMENTS ===
- Create: {"action":"create_announcement","title":"...","content":"...","pinned":false,"fileIds":["FILE_ID"]}
- Edit: {"action":"update_announcement","id":"ANNOUNCEMENT_ID","title":"...","content":"...","pinned":false,"hidden":false}
- Publish: {"action":"publish_announcement","id":"ANNOUNCEMENT_ID"}
- Pin/unpin: {"action":"pin_announcement","id":"ANNOUNCEMENT_ID","pinned":true}
- Delete: {"action":"delete_announcement","id":"ANNOUNCEMENT_ID"}

=== QUIZZES / EXAMS ===
- From question bank: {"action":"create_quiz_from_bank","title":"...","description":"...","category":"quiz|exam","questionBankId":"BANK_ID","questionBankName":"Bank Name","numQuestions":10,"randomizeQuestions":false,"randomizeAnswers":true,"dueDate":"ISO date","availableFrom":"ISO date or null","availableUntil":"ISO date","points":100,"timeLimit":30,"attempts":1,"allowLateSubmissions":true,"latePenaltyType":"per_day|flat","lateDeduction":10,"status":"draft|published","gradingNotes":"..."}
- With inline questions: {"action":"create_quiz_inline","title":"...","description":"...","status":"draft|published","dueDate":"ISO date","availableFrom":"ISO date or null","availableUntil":"ISO date or null","timeLimit":30,"attempts":1,"randomizeQuestions":false,"points":100,"fileIds":["FILE_ID"],"questions":[{"prompt":"...","type":"multiple_choice|true_false|short_answer","options":["A","B"],"correctAnswer":0,"points":10}]}
- Edit quiz: {"action":"update_quiz","id":"QUIZ_ID","title":"...","description":"...","status":"draft|published","dueDate":"ISO date","availableFrom":"ISO date or null","availableUntil":"ISO date or null","timeLimit":45,"attempts":2,"randomizeQuestions":true,"fileIds":["FILE_ID"],"questions":[...]}
- Delete quiz: {"action":"delete_quiz","id":"QUIZ_ID"}

=== ASSIGNMENTS ===
- Create: {"action":"create_assignment","title":"...","description":"...","status":"draft|published","points":100,"dueDate":"ISO date string","category":"essay|project|homework|participation|quiz|exam","allowLateSubmissions":true,"lateDeduction":10,"allowResubmission":false,"fileIds":["FILE_ID"]}
- Edit: {"action":"update_assignment","id":"ASSIGNMENT_ID","title":"...","description":"...","points":100,"dueDate":"ISO date","status":"draft|published","category":"homework|essay|project|participation|quiz|exam","allowLateSubmissions":true,"lateDeduction":10,"allowResubmission":false}
- Delete: {"action":"delete_assignment","id":"ASSIGNMENT_ID"}

=== MODULES ===
- Create: {"action":"create_module","name":"...","description":"..."}
- Add item to module: {"action":"add_to_module","moduleId":"MODULE_ID","moduleName":"Module Name","itemType":"assignment|quiz|file|external_link","itemId":"ITEM_ID","itemTitle":"Item Title","url":"https://... (only for external_link)"}
- Remove item from module: {"action":"remove_from_module","moduleId":"MODULE_ID","moduleName":"Module Name","itemId":"MODULE_ITEM_ID","itemTitle":"Item Title"}
- Move item to different module: {"action":"move_to_module","itemId":"MODULE_ITEM_ID","itemTitle":"Item Title","fromModuleId":"SOURCE_MODULE_ID","fromModuleName":"Source Module","toModuleId":"TARGET_MODULE_ID","toModuleName":"Target Module"}

=== PEOPLE / INVITES ===
- Invite person: {"action":"create_invite","emails":["email@example.com"],"role":"student|ta|instructor","notes":"..."}
- Revoke invite: {"action":"revoke_invite","inviteId":"INVITE_ID","email":"email@example.com"}

=== COURSE SETTINGS ===
- Show/hide course: {"action":"set_course_visibility","courseId":"COURSE_ID","visible":true}

=== MULTI-STEP ===
- Pipeline: {"action":"pipeline","steps":[{"action":"create_announcement",...},{"action":"pin_announcement",...}]}
- Edit pending draft: {"action":"edit_pending_action","changes":{"title":"...","content":"..."}}

CRITICAL - QUIZ/EXAM CREATION RULES:
1. Prefer question-bank quizzes when a suitable bank is available, but inline-question quizzes are allowed when the user explicitly requests no bank or provides full questions.
2. If the user asks to create a quiz or exam from question bank but does NOT specify which question bank to use (by name or topic matching an existing bank), you MUST respond with a plain text message (NOT JSON):
   "To create a quiz, I'll need to know which question bank you want the questions to come from. Your available question banks are: [list bank names]. Which one would you like to use?"
   OR if no banks exist: "To create a quiz, you'll first need to create a question bank. Would you like me to help you set that up?"
3. If the user DOES specify a topic or name that matches an existing question bank (even partially), prefer creating the quiz using that bank.
4. DEFAULT QUIZ/EXAM SETTINGS (use these unless user specifies otherwise):
   - randomizeQuestions: false (keep question order)
   - randomizeAnswers: true (shuffle MC answer options)
   - availableFrom: null (available immediately)
   - availableUntil: same as dueDate
   - allowLateSubmissions: true
   - latePenaltyType: "per_day"
   - lateDeduction: 10
   - numQuestions: 0 (use all questions from the bank)
   - gradingNotes: Include brief helpful grading notes
   - points: calculated from question bank or 100 if unknown

CRITICAL - MODULE ACTIONS:
When adding/removing/moving items to/from modules, always reference IDs from the COURSE MODULES and COURSE DOCUMENT INDEX in context. If the user says "add [item] to [module]" and either the module or item cannot be found in context, ask a clarifying question listing what is available.

CRITICAL - INVITE RULES:
Always include the role explicitly. Default role is "student" unless user says otherwise. You can invite multiple emails in a single action using the emails array. If the user wants to revoke an invite, look up the invite by email from context or ask for clarification if not found.

MISSING INFORMATION: If you cannot infer a required field, still return the JSON with that field set to null. The user will be shown an editable form and can fill it in. Only ask a follow-up text question when the ambiguity is about fundamental intent (e.g., which question bank to use), not about optional details like exact due date or point value.

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

IMPORTANT: If you cannot fully complete the request (e.g., missing information, ambiguous requirements, or limitations), include a "notes" field in your JSON response explaining what was done and what might need adjustment.

Only output JSON when the user clearly wants to perform a concrete action AND you have sufficient information. When taking action on existing items, ALWAYS use IDs from context when available. For pipeline steps, each step may reference prior or existing resources by ID or exact title. When creating content, make sure titles and content are professional and appropriate for an academic setting. Use the current date/time from context to set appropriate due dates (default to 1 week from now if not specified).

CRITICAL - QUIZ/EXAM CREATION RULES:
1. Prefer question-bank quizzes when a suitable bank is available, but inline-question quizzes are allowed when the user explicitly requests no bank or provides full questions.
2. If the user asks to create a quiz or exam from question bank but does NOT specify which question bank to use (by name or topic matching an existing bank), you MUST respond with a plain text message (NOT JSON):
   "To create a quiz, I'll need to know which question bank you want the questions to come from. Your available question banks are: [list bank names]. Which one would you like to use?"
   OR if no banks exist: "To create a quiz, you'll first need to create a question bank. Would you like me to help you set that up?"
3. If the user DOES specify a topic or name that matches an existing question bank (even partially), prefer creating the quiz using that bank.
4. DEFAULT QUIZ/EXAM SETTINGS (use these unless user specifies otherwise):
   - randomizeQuestions: false (keep question order)
   - randomizeAnswers: true (shuffle MC answer options)
   - availableFrom: null (available immediately)
   - availableUntil: same as dueDate
   - allowLateSubmissions: true
   - latePenaltyType: "per_day"
   - lateDeduction: 10
   - numQuestions: 0 (use all questions from the bank)
   - gradingNotes: Include brief helpful grading notes
   - points: calculated from question bank or 100 if unknown

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

IMPORTANT: If you cannot fully complete the request (e.g., missing information, ambiguous requirements, or limitations), include a "notes" field in your JSON response explaining what was done and what might need adjustment. Example: {"action":"create_quiz_from_bank",...,"notes":"Created quiz using Chapter 1 bank. Please review the point total."}

Only output JSON when the user clearly wants to perform a concrete action (create/update/delete/publish/pin/pipeline) AND you have all required information. If user intent is to publish and required fields are missing (e.g., dueDate, questions, points, description), ask a clarifying question instead of guessing. For questions about content or help drafting, respond normally.
When taking action on existing items, ALWAYS use IDs from context when available.
For pipeline steps, each step may reference prior or existing resources by ID or exact title.
When creating content, make sure titles and content are professional and appropriate for an academic setting.
Use the current date/time from context to set appropriate due dates (default to 1 week from now if not specified).
Reference relevant course files when helpful (see COURSE FILES in context).`;

    const studentInstructions = `The user is a STUDENT. Help them with course questions, explain concepts, and provide guidance.

You can help students with:
- Understanding assignments and their requirements
- Explaining course material and concepts
- Answering questions about due dates and course structure
- Providing study tips and guidance

Do NOT create content for students. Redirect content creation requests to instructors.`;

    return `You are an AI assistant for a Learning Management System (LMS). You help instructors and students with course-related tasks.

${isStaffUser ? staffInstructions : studentInstructions}

${context}

${conversationContext ? `Current_conversation_context:\n${conversationContext}\n` : ''}

Respond helpfully and concisely. If asked to create content (and you're an instructor), output ONLY the JSON object with no additional text.`;
  }
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
  settings: {}
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
    { id: 'c1', name: 'ECON 101 - Introduction to Economics', code: 'ECON101', inviteCode: 'ECON2025', createdBy: 'u1', description: 'An introduction to microeconomic and macroeconomic principles', startHereTitle: 'Start Here', startHereContent: 'Welcome to **ECON 101**! Begin by reviewing the syllabus and completing Quiz 1 before next week.' },
    { id: 'c2', name: 'ECON 301 - Advanced Microeconomics', code: 'ECON301', inviteCode: 'MICRO25', createdBy: 'u1', description: 'Advanced topics in microeconomic theory and applications', startHereTitle: 'Start Here', startHereContent: 'Read the course overview, then jump into the first problem set.' }
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
