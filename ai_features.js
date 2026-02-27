/* ═══════════════════════════════════════════════════════════════════════════════
   AI Features Module for Campus LMS
   Gemini API integration, AI chat, content creation, and grading assistance
═══════════════════════════════════════════════════════════════════════════════ */

import {
  showToast, setHTML, escapeHtml, renderMarkdown, generateId,
  openModal, closeModal, fileToBase64
} from './ui_helpers.js';
import {
  callGeminiAPI, callGeminiAPIWithRetry,
  supabaseCreateAnnouncement, supabaseUpdateAnnouncement, supabaseDeleteAnnouncement,
  supabaseCreateQuiz, supabaseUpdateQuiz, supabaseDeleteQuiz,
  supabaseCreateAssignment, supabaseUpdateAssignment, supabaseDeleteAssignment,
  supabaseCreateModule, supabaseUpdateModule, supabaseCreateModuleItem, supabaseDeleteModuleItem,
  supabaseCreateInvite, supabaseDeleteInvite,
  supabaseDeleteEnrollment,
  supabaseUpdateCourse,
  supabaseUpdateFile,
  supabaseCreateQuestionBank, supabaseUpdateQuestionBank, supabaseDeleteQuestionBank,
  supabaseCreateCalendarEvent,
  supabaseDownloadFileBlob,
  supabaseCreateGroupSet, supabaseCreateCourseGroup, supabaseDeleteGroupSet,
  supabaseAddGroupMember,
  supabaseCreateConversation, supabaseAddConversationParticipant, supabaseCreateMessage
} from './database_interactions.js';
import { AI_PROMPTS, AI_CONFIG, AI_TOOL_REGISTRY } from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT MODE: read-only tools students may call (enforced in code, not prompt)
// ═══════════════════════════════════════════════════════════════════════════════
const STUDENT_TOOLS = [
  'list_assignments', 'list_quizzes', 'list_files', 'list_modules',
  'list_announcements', 'list_discussion_threads', 'get_assignment',
  'get_file_content', 'get_grade_categories', 'get_grade_settings',
  'list_group_sets', 'get_group_set'
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════════

let appData = null;
let activeCourseId = null;
let studentViewMode = false;
let aiThread = [];
let aiProcessing = false;
let aiDraft = null;
let aiDraftType = 'announcement';
let aiRubricDraft = null;
let aiQuizDraft = null;

// AI recording state
let aiMediaRecorder = null;
let aiAudioChunks = [];
let aiRecording = false;

// Callback functions
let renderUpdatesCallback = null;
let renderHomeCallback = null;
let renderAssignmentsCallback = null;
let renderModulesCallback = null;
let renderGradebookCallback = null;
let renderPeopleCallback = null;
let renderCalendarCallback = null;
let isStaffCallback = null;
let getCourseByIdCallback = null;
let getUserByIdCallback = null;

/**
 * Initialize the AI features module with dependencies
 */
export function initAiModule(deps) {
  appData = deps.appData;
  renderUpdatesCallback = deps.renderUpdates;
  renderHomeCallback = deps.renderHome;
  renderAssignmentsCallback = deps.renderAssignments;
  renderModulesCallback = deps.renderModules;
  renderGradebookCallback = deps.renderGradebook;
  renderPeopleCallback = deps.renderPeople;
  renderCalendarCallback = deps.renderCalendar;
  isStaffCallback = deps.isStaff;
  getCourseByIdCallback = deps.getCourseById;
  getUserByIdCallback = deps.getUserById;
}

/**
 * Set the active course ID
 */
export function setActiveCourse(courseId) {
  activeCourseId = courseId;
}

/**
 * Set student view mode — when true the AI behaves as if the user is a student
 * (no content creation even for instructor accounts)
 */
export function setStudentViewMode(mode) {
  studentViewMode = !!mode;
}

/**
 * Get the AI thread
 */
export function getAiThread() {
  return aiThread;
}

/**
 * Clear the AI thread
 */
export function clearAiThread() {
  aiThread = [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build context for AI assistant
 */
export function buildAiContext() {
  let context = `Current date/time: ${new Date().toLocaleString()}\n\n`;

  if (activeCourseId && getCourseByIdCallback) {
    const course = getCourseByIdCallback(activeCourseId);
    if (course) {
      context += `CURRENT COURSE: ${course.name}\n`;
      context += course.description ? `Description: ${course.description}\n` : '';

      const currentEnrollment = appData.enrollments?.find(
        e => e.userId === appData.currentUser?.id && e.courseId === activeCourseId
      );
      if (currentEnrollment?.role) {
        context += `Your role in this course: ${currentEnrollment.role}\n`;
      }

      // Counts only — IDs and content are fetched via tools at query time.
      // This keeps the context small and forces fresh lookups for accurate IDs.
      const aiCtxIsStaff = isStaffCallback && isStaffCallback(appData.currentUser?.id, activeCourseId) && !studentViewMode;
      const assignments   = (appData.assignments   || []).filter(a => a.courseId === activeCourseId && (aiCtxIsStaff || (a.status === 'published' && !a.hidden && (a.assignmentType || 'essay') !== 'no_submission')));
      const quizzes       = (appData.quizzes       || []).filter(q => q.courseId === activeCourseId && (aiCtxIsStaff || q.status === 'published'));
      const questionBanks = (appData.questionBanks || []).filter(b => b.courseId === activeCourseId);
      const files         = (appData.files         || []).filter(f => f.courseId === activeCourseId && !f.isPlaceholder && (aiCtxIsStaff || !f.hidden));
      const modules       = (appData.modules       || []).filter(m => m.courseId === activeCourseId && (aiCtxIsStaff || !m.hidden));
      const announcements = (appData.announcements || []).filter(a => a.courseId === activeCourseId && (aiCtxIsStaff || !a.hidden));
      const enrolled      = (appData.enrollments   || []).filter(e => e.courseId === activeCourseId);
      const invites       = aiCtxIsStaff ? (appData.invites || []).filter(i => i.courseId === activeCourseId && i.status === 'pending') : [];
      const qTotal        = questionBanks.reduce((s, b) => s + (b.questions?.length || 0), 0);

      context += `\nCOURSE CONTENTS — call the relevant tool to get IDs, titles, and full content:\n`;
      context += `- assignments: ${assignments.length}\n`;
      context += `- quizzes: ${quizzes.length}\n`;
      context += `- question banks: ${questionBanks.length} (${qTotal} questions total)\n`;
      context += `- files: ${files.length}\n`;
      context += `- modules: ${modules.length}\n`;
      context += `- announcements: ${announcements.length}\n`;
      context += `- enrolled users: ${enrolled.length}${invites.length ? `, ${invites.length} pending invite${invites.length !== 1 ? 's' : ''}` : ''}\n`;
    }
  } else {
    context += 'No active course selected.\n';
  }

  if (appData.currentUser) {
    context += `\nCurrent user: ${appData.currentUser.name || appData.currentUser.email}\n`;
  }

  const pending = getLatestPendingAction();
  if (pending) {
    context += `\nPENDING AI ACTION DRAFT:\n`;
    context += `- Type: ${pending.msg.actionType}\n`;
    context += `- Editable fields: ${JSON.stringify(pending.msg.data)}\n`;
    context += 'You may return {"action":"edit_pending_action","changes":{...}} to modify this draft before confirmation.\n';
  }

  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a message to the AI assistant
 */


function normalizeAiOperationAction(action) {
  const map = {
    create_announcement: 'announcement',
    update_announcement: 'announcement_update',
    delete_announcement: 'announcement_delete',
    publish_announcement: 'announcement_publish',
    pin_announcement: 'announcement_pin',
    create_quiz_from_bank: 'quiz_from_bank',
    create_assignment: 'assignment',
    update_assignment: 'assignment_update',
    delete_assignment: 'assignment_delete',
    create_module: 'module',
    update_module: 'module_update',
    set_module_visibility: 'module_visibility',
    add_to_module: 'module_add_item',
    remove_from_module: 'module_remove_item',
    move_to_module: 'module_move_item',
    rename_file: 'file_rename',
    set_file_folder: 'file_folder',
    set_file_visibility: 'file_visibility',
    create_question_bank: 'question_bank_create',
    update_question_bank: 'question_bank_update',
    add_questions_to_bank: 'question_bank_add_questions',
    delete_question_bank: 'question_bank_delete',
    delete_question_from_bank: 'question_delete_from_bank',
    update_start_here: 'start_here_update',
    create_invite: 'invite_create',
    revoke_invite: 'invite_revoke',
    set_course_visibility: 'course_visibility',
    create_calendar_event: 'calendar_event_create'
  };
  return map[action] || action;
}

function getLatestPendingAction() {
  for (let i = aiThread.length - 1; i >= 0; i--) {
    const msg = aiThread[i];
    if (msg?.role === 'action' && !msg.confirmed && !msg.rejected) {
      return { msg, idx: i };
    }
  }
  return null;
}

function applyAiEditToPendingAction(action) {
  const pending = getLatestPendingAction();
  if (!pending) {
    aiThread.push({ role: 'assistant', content: 'There is no pending draft action to edit right now.' });
    return;
  }

  if (!action.changes || typeof action.changes !== 'object') {
    aiThread.push({ role: 'assistant', content: 'No valid changes were provided for the pending action.' });
    return;
  }

  Object.assign(pending.msg.data, action.changes);
  aiThread.push({ role: 'assistant', content: 'Updated the pending draft with your requested edits. Review and confirm when ready.' });
}

function resolveOperationReferences(operation) {
  const op = { ...operation };

  if (!activeCourseId) return op;

  if (!op.id && op.announcementId) op.id = op.announcementId;
  if (!op.id && op.quizId) op.id = op.quizId;

  if (!op.id && op.announcementTitle && Array.isArray(appData.announcements)) {
    const found = appData.announcements.find(a => a.courseId === activeCourseId && a.title?.toLowerCase() === String(op.announcementTitle).toLowerCase());
    if (found) op.id = found.id;
  }

  if (!op.id && op.quizTitle && Array.isArray(appData.quizzes)) {
    const found = appData.quizzes.find(q => q.courseId === activeCourseId && q.title?.toLowerCase() === String(op.quizTitle).toLowerCase());
    if (found) op.id = found.id;
  }

  if (!op.id && op.assignmentId) op.id = op.assignmentId;
  if (!op.id && op.assignmentTitle && Array.isArray(appData.assignments)) {
    const found = appData.assignments.find(a => a.courseId === activeCourseId && a.title?.toLowerCase() === String(op.assignmentTitle).toLowerCase());
    if (found) op.id = found.id;
  }

  if ((!op.fileIds || op.fileIds.length === 0) && Array.isArray(op.fileNames) && Array.isArray(appData.files)) {
    const names = op.fileNames.map(n => String(n).toLowerCase());
    op.fileIds = appData.files
      .filter(f => f.courseId === activeCourseId && names.includes(String(f.name || '').toLowerCase()))
      .map(f => f.id);
  }

  return op;
}

function appendFileLinksToContent(content, fileIds) {
  if (!Array.isArray(fileIds) || fileIds.length === 0) return content || '';
  const lines = fileIds.map(id => {
    const file = (appData.files || []).find(f => f.id === id);
    if (!file) return null;
    return `- [📄 ${file.name}](#file-${file.id})`;
  }).filter(Boolean);

  if (!lines.length) return content || '';
  const base = (content || '').trim();
  const docsBlock = `\n\n### Related Documents\n${lines.join('\n')}`;
  return base + docsBlock;
}

function appendAvailabilityToDescription(description, availableFrom, availableUntil) {
  if (!availableFrom && !availableUntil) return description || '';
  const availabilityLines = [];
  if (availableFrom) availabilityLines.push(`- Available from: ${availableFrom}`);
  if (availableUntil) availabilityLines.push(`- Available until: ${availableUntil}`);
  const base = (description || '').trim();
  const availabilityBlock = `\n\n### Availability Window\n${availabilityLines.join('\n')}`;
  return `${base}${availabilityBlock}`.trim();
}

function getMissingPublishRequirements(operation, publish = false) {
  const action = normalizeAiOperationAction(operation?.action);
  const wantsPublish = publish || operation?.status === 'published' || action === 'announcement_publish';
  if (!wantsPublish) return [];

  const missing = [];
  if (action === 'announcement' || action === 'announcement_update' || action === 'announcement_publish') {
    if (action === 'announcement_publish') {
      const existing = (appData.announcements || []).find(a => a.id === operation.id && a.courseId === activeCourseId);
      if (!existing) missing.push('announcement id');
      if (existing && !existing.title) missing.push('title');
      if (existing && !existing.content) missing.push('content');
      return missing;
    }
    if (!operation.title) missing.push('title');
    if (!operation.content) missing.push('content');
    return missing;
  }

  if (action === 'assignment') {
    if (!operation.title) missing.push('title');
    if (!operation.description) missing.push('description');
    if (operation.points === undefined || operation.points === null) missing.push('points');
    if (!operation.dueDate) missing.push('dueDate');
    return missing;
  }

  return [];
}
// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-STEP AI ENGINE
// Flow: user message → buildSystemPrompt → runAiLoop → [tool_call → result → loop]
//       → action (Take Action Card) | answer (text bubble) | ask_user (inline input)
// The AI never touches the DB; it only emits JSON. Deterministic code executes actions.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build system prompt dynamically from AI_TOOL_REGISTRY so it always reflects
 * current capabilities with zero extra work when new tools/actions are added.
 */
function buildSystemPrompt(isStaff, courseContext) {
  if (!isStaff) {
    const studentToolList = STUDENT_TOOLS.map(name => {
      const t = AI_TOOL_REGISTRY.context_tools.find(ct => ct.name === name);
      if (!t) return '';
      const paramStr = t.params ? `(${Object.entries(t.params).map(([k, v]) => `${k}: ${v}`).join(', ')})` : '';
      return `  - ${t.name}${paramStr}: ${t.description}`;
    }).filter(Boolean).join('\n');
    return `You are an AI assistant for an LMS helping a STUDENT. Help with course questions, explain concepts, and provide guidance.

⚠️ OUTPUT FORMAT — CRITICAL:
Output ONLY a single valid JSON object. No text before or after.
- To answer: {"type":"answer","text":"Your response here"}
- To look up course data: {"type":"tool_call","tool":"tool_name","params":{},"step_label":"📋 Looking up..."}

AVAILABLE READ-ONLY TOOLS (you may ONLY call these):
${studentToolList}

You may NOT create, update, or delete any content. If asked, explain only instructors can modify content.
NEVER include raw UUIDs in answer text — refer to things by name/title only.

${courseContext}`;
  }

  const toolList = AI_TOOL_REGISTRY.context_tools.map(t => {
    const paramStr = t.params ? `(${Object.entries(t.params).map(([k, v]) => `${k}: ${v}`).join(', ')})` : '';
    return `  - ${t.name}${paramStr}: ${t.description}`;
  }).join('\n');

  const actionList = AI_TOOL_REGISTRY.action_types.map(t =>
    `  - ${t.name}${t.dangerous ? ' ⚠️' : ''}: ${t.description}`
  ).join('\n');

  return `You are an AI assistant for an LMS (Learning Management System) helping an INSTRUCTOR manage course content. You look up real data via tools, then propose an action for the instructor to confirm.

⚠️ OUTPUT FORMAT — CRITICAL:
- Output ONLY a single valid JSON object. No text before or after the JSON. No explanation outside the JSON.
- If you need to explain something, put it inside the "text" field of a {"type":"answer"} object.
- If you need to call a tool, output ONLY the tool_call JSON — do not add any prose explanation.

ALWAYS respond with ONLY a single valid JSON object in exactly one of these formats:

1. Direct text answer (for questions/explanations, or when no action is needed):
{"type":"answer","text":"Your response here"}

2. Tool call — look up real IDs/data before acting. You WILL see the result and can call more tools before your final output:
{"type":"tool_call","tool":"tool_name","params":{"key":"value"},"step_label":"👥 Looking up people and invites..."}

3. Ask user for clarification — ONLY when intent is fundamentally ambiguous and defaults cannot apply:
{"type":"ask_user","question":"Which question bank should I use? Available: Bank A, Bank B"}

4. Action — creates a Take Action Card for the instructor to review and confirm (you never touch the DB):
{"type":"action","action":"action_name",...all required fields...}

AVAILABLE TOOLS (call these first to look up real IDs — never guess IDs):
${toolList}

AVAILABLE ACTIONS (* = required field):
${actionList}

MANDATORY PRE-ACTION RULES — the COURSE CONTEXT only provides item counts, NOT IDs. You MUST call a tool to get real IDs before every action:
- Before update/delete assignment: call list_assignments → use the returned id
- Before update/delete announcement: call list_announcements → use the returned id
- Before update/delete quiz: call list_quizzes → use the returned id
- Before update_module or set_module_visibility: call list_modules → use the returned module id
- Before add_to_module/remove_from_module/move_to_module: call list_modules → use the returned moduleId/itemId
- Before rename_file or set_file_visibility: call list_files → use the returned file id
- Before update_question_bank, add_questions_to_bank, delete_question_bank: call list_question_banks → use the returned bank id
- Before delete_question_from_bank: call list_question_banks → then call get_question_bank(bank_id) → use the returned question id
- Before ANY invite/person action (revoke_invite, remove_person): call list_people → use the returned inviteId/userId
- Before creating a quiz/exam from a bank: call list_question_banks → use the returned id
- Standalone quiz actions (create_quiz/create_quiz_inline) are deprecated. To create a quiz, ALWAYS use create_assignment with assignmentType:"quiz" (and questionBankId) or create_quiz_from_bank.
- Before get_student_grades: call list_people → pass the returned userId as the user_id param
- NEVER guess or hallucinate IDs — all IDs are validated server-side; wrong IDs show an error card, not an action card
- NEVER include raw UUIDs or database IDs in the "text" field of any answer — always refer to things by human-readable name, title, or email.
  ❌ WRONG: "There are two announcements: 'Andy' (ID: f42c0e22-...) and 'Chad' (ID: 65570f8d-...)"
  ✓ RIGHT: "There are two guest lecture announcements: one for Andy Esteves and one for Chad Kogar. Which did you mean?"
- ACTION PAYLOAD FIELDS ARE DIFFERENT: you MUST include the real database "id" (or inviteId/userId/moduleId/fileId/bankId) field in every action JSON payload. These are machine fields, not shown to users. The COURSE CONTEXT only shows counts — you MUST call the relevant list tool first to obtain the real ID.
  ❌ WRONG update_assignment: {"type":"action","action":"update_assignment","title":"New Title"}  ← missing id; call list_assignments first
  ✓ RIGHT update_assignment: {"type":"action","action":"update_assignment","id":"the-uuid-from-list_assignments","title":"New Title"}
  ❌ WRONG update_announcement: {"type":"action","action":"update_announcement","title":"New Title"}  ← missing id; call list_announcements first
  ✓ RIGHT update_announcement: {"type":"action","action":"update_announcement","id":"the-uuid-from-list_announcements","title":"New Title"}
  ❌ WRONG revoke_invite: {"type":"action","action":"revoke_invite","email":"x@x.com"}  ← missing inviteId; call list_people first
  ✓ RIGHT revoke_invite: {"type":"action","action":"revoke_invite","inviteId":"the-uuid-from-list_people","email":"x@x.com"}

ALWAYS include human-readable label fields alongside every ID in action payloads:
- inviteId → also include email (from list_people result)
- userId → also include name and email (from list_people result)
- moduleId → also include moduleName (from list_modules result)
- itemId → also include itemTitle (from list_modules or list_assignments/quizzes/files)
- fileId → also include fileName (from list_files result)
- bankId → also include bankName (from list_question_banks result)
- questionId → also include questionPrompt (from get_question_bank result)

OUT-OF-SCOPE REQUESTS — respond with an answer, do NOT use an action:
- Creating a new course, importing content from another course, or editing course name/code/description/metadata: tell the instructor these must be done manually in Course Settings.
- Editing the gradebook (grade categories, weights, letter thresholds, or changing a student's grade): tell the instructor "For security reasons, grade and gradebook changes must be made directly in the Gradebook." Do NOT use any grade-editing action.

VIEWING ANALYTICS AND GRADES — use tools then answer, no action needed:
- To show analytics for an assignment: call get_assignment_analytics(assignment_id) → then answer with the stats
- To show a student's grades: call list_people → get the userId → call get_student_grades(user_id) → then answer with their grades. Never emit an action for viewing read-only data.

QUESTION BANK QUESTION TYPES (7 supported types for create_question_bank / add_questions_to_bank):
- multiple_choice: options array + correctAnswer (index or value)
- true_false: correctAnswer:"true" or "false"
- short_answer: correctAnswer is a string or array of acceptable answers
- essay: no correctAnswer (manually graded)
- fill_in_blank: correctAnswer is the expected text
- matching: options array of {left,right} pairs
- ordering: options array to put in correct order, correctAnswer is the ordered array

CLARIFICATION RULE — minimize ask_user:
- Only ask when you genuinely cannot proceed (e.g., multiple question banks match and user didn't specify)
- Do NOT ask about: due dates, points, grading type, modality, late policy, status — use defaults
- If a field is optional and unknown, set it to null; the instructor edits it in the confirmation form
- NEVER use ask_user to say "I need to call list_people" or "can you tell me the ID?" — JUST CALL THE TOOL instead. Calling tools is always available to you.

DEFAULTS (use unless user specifies otherwise):
- Assignment: assignmentType:"essay", gradingType:"points", points:100, dueDate:1 week from now, status:"draft", allowLateSubmissions:true, latePenaltyType:"per_day", lateDeduction:10, allowResubmission:true, submissionAttempts:null, description: always write a concise one-sentence description summarising what students must do — never leave it blank
- no_submission type: no dueDate, no availability dates, always status:"draft"
- Quiz: attempts:1, randomizeQuestions:false, randomizeAnswers:true, timeLimit:null
- Announcement: pinned:false, status:"draft"
- Invite: role:"student"
- update_start_here: title:"Start Here" (unless user specifies otherwise)

DATE/TIME RULES — CRITICAL:
- The "Current date/time" in the course context is already in the user's LOCAL time zone. Use it as local time.
- All date/time fields (dueDate, availableFrom, availableUntil, eventDate) must be output as LOCAL time WITHOUT a trailing Z or timezone offset.
  ✓ RIGHT: "2025-09-15T14:00:00"  (local 2pm, no Z)
  ❌ WRONG: "2025-09-15T14:00:00.000Z"  (this is interpreted as UTC, shifts display time by timezone offset)
  ❌ WRONG: "2025-09-15T14:00:00+05:00"  (do not include offset)
- When a user says "2pm" they mean 2pm in their local time — output T14:00:00 with no suffix.
- EXTRACT DATES FROM CONTENT: If the user pastes announcement/message text that contains a date/time (e.g. "next Saturday, March 7th, 2026, at 2:00 PM"), parse it and use it as the eventDate. Do NOT leave the date blank or ask for it if it appears in the pasted text.
  Example: "add this to the calendar: we meet next Saturday March 7 at 2pm" → eventDate:"2026-03-07T14:00:00"
- For relative dates like "next Saturday", resolve them relative to the Current date/time in the course context.

CONTENT FORMATTING (markdown supported in description/content fields):
- **bold**, *italic*, ## headers, - bullet lists
- Link files: [📄 filename](#file-FILE_ID)

${courseContext}`;
}

/**
 * Summarize a tool result into a short human-readable string for the step bubble.
 */
function summarizeToolResult(toolName, result) {
  if (!result) return '';
  if (result.error) return `error: ${result.error}`;
  if (Array.isArray(result)) {
    switch (toolName) {
      case 'list_people': {
        const enrolled = result.filter(p => p.status === 'enrolled').length;
        const pending = result.filter(p => p.status === 'pending_invite').length;
        return `${enrolled} enrolled${pending ? `, ${pending} pending` : ''}`;
      }
      case 'list_assignments':        return `${result.length} assignment${result.length !== 1 ? 's' : ''}`;
      case 'list_question_banks':     return `${result.length} bank${result.length !== 1 ? 's' : ''}`;
      case 'list_quizzes':            return `${result.length} quiz${result.length !== 1 ? 'zes' : ''}`;
      case 'list_files':              return `${result.length} file${result.length !== 1 ? 's' : ''}`;
      case 'list_announcements':      return `${result.length} announcement${result.length !== 1 ? 's' : ''}`;
      case 'list_modules':            return `${result.length} module${result.length !== 1 ? 's' : ''}`;
      default:                        return `${result.length} item${result.length !== 1 ? 's' : ''}`;
    }
  }
  if (result._inlineData) return `${result.name} (${(result.sizeBytes/1024).toFixed(0)} KB attached)`;
  if (toolName === 'get_assignment_analytics') return `${result.submittedCount}/${result.totalEnrolled} submitted${result.averageScore != null ? `, avg ${result.averageScore}/${result.points}` : ''}`;
  if (toolName === 'get_student_grades') return `${result.student?.name || 'Student'} — ${result.grades?.length || 0} grade${result.grades?.length !== 1 ? 's' : ''}`;
  if (toolName === 'get_question_bank') return `${result.questions?.length || 0} question${result.questions?.length !== 1 ? 's' : ''}`;
  if (result.name) return result.name;
  return '';
}

/**
 * Execute a context tool — queries appData and returns JSON for Gemini to reason over.
 * These NEVER write to the DB; they are read-only.
 */
/** Guess MIME type from filename extension for common file types. */
function guessMimeType(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  return ({
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', html: 'text/html',
    tex: 'text/plain', latex: 'text/plain', bib: 'text/plain',
    json: 'application/json', xml: 'application/xml'
  }[ext]) || 'application/octet-stream';
}

/** Extract plain text from a docx file given as a base64 string. */
async function extractDocxText(base64) {
  if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const zip = await JSZip.loadAsync(bytes);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('word/document.xml not found');
  const xml = await xmlFile.async('string');
  // Strip XML tags, normalize whitespace, preserve paragraph breaks
  return xml
    .replace(/<w:p[ >]/g, '\n<w:p>')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Extract plain text from a pptx file given as a base64 string. */
async function extractPptxText(base64) {
  if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)[0]), nb = parseInt(b.match(/\d+/)[0]);
      return na - nb;
    });
  const parts = [];
  for (const slidePath of slideFiles) {
    const xml = await zip.file(slidePath).async('string');
    // Extract text from <a:t> tags
    const texts = [];
    const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let m;
    while ((m = re.exec(xml)) !== null) texts.push(m[1]);
    const slideNum = slidePath.match(/\d+/)[0];
    if (texts.length) parts.push(`[Slide ${slideNum}]\n${texts.join(' ')}`);
  }
  return parts.join('\n\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

async function executeAiTool(toolName, params = {}) {
  if (!activeCourseId) return { error: 'No active course selected' };

  // Determine if the current user is effectively staff (controls visibility of hidden items)
  const isStaffUser = isStaffCallback && isStaffCallback(appData.currentUser?.id, activeCourseId);
  const effectiveIsStaff = isStaffUser && !studentViewMode;

  switch (toolName) {
    case 'list_assignments':
      return (appData.assignments || [])
        .filter(a => a.courseId === activeCourseId)
        .filter(a => effectiveIsStaff || (a.status === 'published' && !a.hidden && (a.assignmentType || 'essay') !== 'no_submission'))
        .map(a => ({ id: a.id, title: a.title, type: a.assignmentType || 'essay', gradingType: a.gradingType || 'points', status: a.status, points: a.points, dueDate: a.dueDate, isGroupAssignment: !!a.isGroupAssignment, groupSetId: a.groupSetId || null }));

    case 'list_quizzes':
      return (appData.quizzes || [])
        .filter(q => q.courseId === activeCourseId)
        .filter(q => effectiveIsStaff || q.status === 'published')
        .map(q => ({ id: q.id, title: q.title, status: q.status, dueDate: q.dueDate, questionCount: (q.questions || []).length }));

    case 'list_files':
      return (appData.files || [])
        .filter(f => f.courseId === activeCourseId)
        .filter(f => effectiveIsStaff || !f.hidden)
        .map(f => ({ id: f.id, name: f.name, type: f.type, size: f.size, hidden: !!f.hidden, folder: f.folder || null }));

    case 'list_modules':
      return (appData.modules || [])
        .filter(m => m.courseId === activeCourseId)
        .filter(m => effectiveIsStaff || !m.hidden)
        .map(m => ({
          id: m.id, name: m.name, hidden: !!m.hidden,
          items: (m.items || []).map(i => ({
            id: i.id, type: i.type, refId: i.refId,
            title: i.title
              || (appData.assignments || []).find(a => a.id === i.refId)?.title
              || (appData.quizzes || []).find(q => q.id === i.refId)?.title
              || (appData.files || []).find(f => f.id === i.refId)?.name || ''
          }))
        }));

    case 'list_people': {
      const enrolled = (appData.enrollments || [])
        .filter(e => e.courseId === activeCourseId)
        .map(e => {
          const u = (appData.users || []).find(u => u.id === e.userId);
          return { userId: e.userId, name: u?.name || '(unknown)', email: u?.email || '', role: e.role, status: 'enrolled' };
        });
      const pending = (appData.invites || [])
        .filter(i => i.courseId === activeCourseId && i.status === 'pending')
        .map(i => ({ inviteId: i.id, email: i.email, role: i.role || 'student', status: 'pending_invite' }));
      return [...enrolled, ...pending];
    }

    case 'list_question_banks':
      return (appData.questionBanks || [])
        .filter(b => b.courseId === activeCourseId)
        .map(b => ({ id: b.id, name: b.name, questionCount: (b.questions || []).length, totalPoints: (b.questions || []).reduce((s, q) => s + (parseFloat(q.points) || 1), 0) }));

    case 'list_announcements':
      return (appData.announcements || [])
        .filter(a => a.courseId === activeCourseId)
        .filter(a => effectiveIsStaff || !a.hidden)
        .map(a => ({ id: a.id, title: a.title, content: (a.content || a.body || ''), pinned: !!a.pinned, hidden: !!a.hidden, createdAt: a.createdAt }));

    case 'get_grade_categories':
      return (appData.gradeCategories || []).filter(c => c.courseId === activeCourseId);

    case 'get_grade_settings':
      return (appData.gradeSettings || []).find(s => s.courseId === activeCourseId) || null;

    case 'list_discussion_threads':
      return (appData.discussionThreads || [])
        .filter(t => t.courseId === activeCourseId)
        .map(t => ({ id: t.id, title: t.title, pinned: !!t.pinned, replyCount: (t.replies || []).length }));

    case 'list_group_sets':
      return (appData.groupSets || [])
        .filter(gs => gs.courseId === activeCourseId)
        .map(gs => {
          const groups = (appData.courseGroups || []).filter(g => g.groupSetId === gs.id);
          return {
            id: gs.id, name: gs.name, description: gs.description || '',
            groupCount: groups.length,
            groups: groups.map(g => ({ id: g.id, name: g.name, memberCount: (g.members || []).length }))
          };
        });

    case 'get_group_set': {
      const gsId = params.group_set_id || params.groupSetId || params.id;
      const gs = (appData.groupSets || []).find(s => s.id === gsId && s.courseId === activeCourseId);
      if (!gs) return { error: 'Group set not found — call list_group_sets first to get the id' };
      const groups = (appData.courseGroups || []).filter(g => g.groupSetId === gs.id);
      return {
        id: gs.id, name: gs.name, description: gs.description || '',
        groups: groups.map(g => ({
          id: g.id, name: g.name,
          members: (g.members || []).map(m => {
            const u = (appData.users || []).find(u => u.id === m.userId);
            return { userId: m.userId, name: u?.name || '(unknown)', email: u?.email || '' };
          })
        }))
      };
    }

    case 'get_question_bank': {
      const bankId = params.bank_id || params.bankId || params.id;
      const bank = (appData.questionBanks || []).find(b => b.id === bankId && b.courseId === activeCourseId);
      if (!bank) return { error: 'Question bank not found — call list_question_banks first to get the id' };
      return { id: bank.id, name: bank.name, questions: (bank.questions || []).map(q => ({ id: q.id, type: q.type, prompt: q.prompt, options: q.options, correctAnswer: q.correctAnswer, points: q.points })) };
    }

    case 'get_assignment': {
      const assignmentId = params.assignment_id || params.assignmentId || params.id;
      const a = (appData.assignments || []).find(a => a.id === assignmentId && a.courseId === activeCourseId);
      return a || { error: 'Assignment not found — call list_assignments first to get the id' };
    }

    case 'get_quiz': {
      const quizId = params.quiz_id || params.quizId || params.id;
      const q = (appData.quizzes || []).find(q => q.id === quizId && q.courseId === activeCourseId);
      return q || { error: 'Quiz not found — call list_quizzes first to get the id' };
    }

    case 'get_assignment_analytics': {
      const assignId = params.assignment_id || params.assignmentId || params.id;
      if (!assignId) return { error: 'Missing assignment_id — call list_assignments first to get the id' };
      const a = (appData.assignments || []).find(a => a.id === assignId && a.courseId === activeCourseId);
      if (!a) return { error: 'Assignment not found' };
      const enrolledStudents = (appData.enrollments || []).filter(e => e.courseId === activeCourseId && e.role === 'student');
      const submissions = (appData.submissions || []).filter(s => s.assignmentId === assignId);
      const submittedUserIds = new Set(submissions.map(s => s.userId));
      const grades = (appData.grades || []).filter(g => submissions.find(s => s.id === g.submissionId));
      const scoredGrades = grades.filter(g => g.score !== null && g.score !== undefined);
      const scores = scoredGrades.map(g => g.score);
      const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;
      return {
        assignmentId: assignId,
        title: a.title,
        points: a.points,
        totalEnrolled: enrolledStudents.length,
        submittedCount: submittedUserIds.size,
        notSubmittedCount: enrolledStudents.filter(e => !submittedUserIds.has(e.userId)).length,
        gradedCount: scoredGrades.length,
        ungradedCount: submissions.length - scoredGrades.length,
        averageScore: avgScore ? parseFloat(avgScore) : null,
        highScore: scores.length ? Math.max(...scores) : null,
        lowScore: scores.length ? Math.min(...scores) : null
      };
    }

    case 'get_student_grades': {
      const userId = params.user_id || params.userId;
      if (!userId) return { error: 'Missing user_id — call list_people first to get the userId' };
      const enrollment = (appData.enrollments || []).find(e => e.userId === userId && e.courseId === activeCourseId);
      if (!enrollment) return { error: 'User is not enrolled in this course' };
      const u = (appData.users || []).find(u => u.id === userId);
      const submissions = (appData.submissions || []).filter(s => s.userId === userId);
      const subIds = new Set(submissions.map(s => s.id));
      const grades = (appData.grades || []).filter(g => subIds.has(g.submissionId));
      const buildScoreDisplay = (score, gradingType, points) => {
        if (score === null || score === undefined) return 'Not graded';
        if (gradingType === 'complete_incomplete') return score == 1 ? 'Complete' : 'Incomplete';
        if (gradingType === 'letter_grade') return String(score);
        return `${score}/${points} pts`;
      };
      const results = submissions.map(s => {
        const a = (appData.assignments || []).find(a => a.id === s.assignmentId && a.courseId === activeCourseId);
        if (!a) return null;
        const grade = grades.find(g => g.submissionId === s.id);
        const gradingType = a.gradingType || 'points';
        const score = grade ? grade.score : null;
        return {
          assignmentId: a.id,
          assignmentTitle: a.title,
          assignmentType: a.assignmentType || 'essay',
          gradingType,
          points: a.points,
          score,
          scoreDisplay: buildScoreDisplay(score, gradingType, a.points),
          released: grade ? grade.released : false,
          submittedAt: s.submittedAt
        };
      }).filter(Boolean);
      // Also include assignments with no submission
      const submittedAssignIds = new Set(submissions.map(s => s.assignmentId));
      const courseAssignments = (appData.assignments || []).filter(
        a => a.courseId === activeCourseId && a.status === 'published' && (a.assignmentType || 'essay') !== 'no_submission'
      );
      const notSubmitted = courseAssignments
        .filter(a => !submittedAssignIds.has(a.id))
        .map(a => ({
          assignmentId: a.id,
          assignmentTitle: a.title,
          assignmentType: a.assignmentType || 'essay',
          gradingType: a.gradingType || 'points',
          points: a.points,
          score: null,
          scoreDisplay: 'Not submitted',
          released: false,
          submittedAt: null
        }));
      return {
        student: { userId, name: u?.name || '', email: u?.email || '' },
        grades: [...results, ...notSubmitted]
      };
    }

    case 'get_file_content': {
      const fileId = params.file_id || params.fileId || params.id;
      const f = (appData.files || []).find(f => f.id === fileId && f.courseId === activeCourseId);
      if (!f) return { error: 'File not found' };
      if (f.isPlaceholder || f.isYoutube) return { id: f.id, name: f.name, note: 'External link or video — no downloadable content.' };
      if (!f.storagePath) return { id: f.id, name: f.name, note: 'No storage path for this file.' };
      // Normalize mimeType — f.type may be just an extension (e.g. "pdf") from older uploads
      let mimeType = f.type || '';
      if (!mimeType.includes('/')) mimeType = guessMimeType(f.name) || 'application/octet-stream';
      const result = await supabaseDownloadFileBlob(f.storagePath, mimeType);
      if (!result || result.error) return { id: f.id, name: f.name, error: result?.error || 'Download failed.' };
      const mt = result.mimeType;
      // Text-based types: decode to string and return as _textContent (more reliable than inlineData)
      if (mt.startsWith('text/') || mt === 'application/json' || mt === 'application/xml') {
        try {
          const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
          const text = new TextDecoder('utf-8').decode(bytes);
          return { id: f.id, name: f.name, mimeType: mt, sizeBytes: result.sizeBytes, _textContent: text };
        } catch {
          // Fall through to inlineData if decode fails
        }
      }
      // Images and PDFs: send as inline data (supported by gemini-2.5-flash)
      if (mt.startsWith('image/') || mt === 'application/pdf') {
        return { id: f.id, name: f.name, mimeType: mt, sizeBytes: result.sizeBytes, _inlineData: { mimeType: mt, data: result.base64 } };
      }
      // docx: extract text via JSZip
      if (mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          const text = await extractDocxText(result.base64);
          return { id: f.id, name: f.name, mimeType: mt, sizeBytes: result.sizeBytes, _textContent: text };
        } catch (e) {
          return { id: f.id, name: f.name, error: `Could not extract text from docx: ${e.message}` };
        }
      }
      // pptx: extract slide text via JSZip
      if (mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        try {
          const text = await extractPptxText(result.base64);
          return { id: f.id, name: f.name, mimeType: mt, sizeBytes: result.sizeBytes, _textContent: text };
        } catch (e) {
          return { id: f.id, name: f.name, error: `Could not extract text from pptx: ${e.message}` };
        }
      }
      // Unsupported binary types (xlsx, etc.)
      return { id: f.id, name: f.name, error: `File type "${mt}" cannot be read by the AI. Supported: PDF, images, text files, docx, and pptx.` };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Validate an action payload before creating the Take Action Card.
 * Returns an error string if invalid, null if valid.
 */
function validateActionPayload(payload) {
  if (!activeCourseId) return 'No active course selected';
  const { action } = payload;

  if (action === 'update_assignment' || action === 'delete_assignment') {
    if (!payload.id) return 'Missing assignment id';
    if (!(appData.assignments || []).find(a => a.id === payload.id && a.courseId === activeCourseId))
      return `Assignment "${payload.id}" not found in this course — use list_assignments to find the correct id`;
  }
  if (action === 'update_quiz' || action === 'delete_quiz') {
    if (!payload.id) return 'Missing quiz id';
    if (!(appData.quizzes || []).find(q => q.id === payload.id && q.courseId === activeCourseId))
      return `Quiz "${payload.id}" not found in this course`;
  }
  if (['update_announcement','delete_announcement','publish_announcement','pin_announcement'].includes(action)) {
    if (!payload.id) return 'Missing announcement id';
    if (!(appData.announcements || []).find(a => a.id === payload.id && a.courseId === activeCourseId))
      return `Announcement "${payload.id}" not found in this course`;
  }
  if (action === 'revoke_invite') {
    const id = payload.inviteId || payload.id;
    if (!id) return 'Missing inviteId — call list_people first to get the real invite id';
    if (!(appData.invites || []).find(i => i.id === id && i.courseId === activeCourseId))
      return `Invite not found (id: ${id}) — call list_people to get the current invite list`;
  }
  if (action === 'remove_person') {
    const uid = payload.userId || payload.id;
    if (!uid) return 'Missing userId — call list_people first';
    if (!(appData.enrollments || []).find(e => e.userId === uid && e.courseId === activeCourseId))
      return `User "${uid}" is not enrolled in this course`;
  }
  if (action === 'create_quiz_from_bank' && payload.questionBankId) {
    if (!(appData.questionBanks || []).find(b => b.id === payload.questionBankId && b.courseId === activeCourseId))
      return `Question bank "${payload.questionBankId}" not found — use list_question_banks`;
  }
  if (['update_question_bank','add_questions_to_bank','delete_question_bank'].includes(action)) {
    const bankId = payload.id || payload.bankId;
    if (!bankId) return 'Missing bank id — call list_question_banks first';
    if (!(appData.questionBanks || []).find(b => b.id === bankId && b.courseId === activeCourseId))
      return `Question bank "${bankId}" not found — use list_question_banks`;
  }
  if (action === 'delete_question_from_bank') {
    if (!payload.bankId) return 'Missing bankId — call list_question_banks then get_question_bank first';
    if (!payload.questionId) return 'Missing questionId — call get_question_bank to get the question id';
    const bank = (appData.questionBanks || []).find(b => b.id === payload.bankId && b.courseId === activeCourseId);
    if (!bank) return `Question bank "${payload.bankId}" not found — use list_question_banks`;
    if (!(bank.questions || []).find(q => q.id === payload.questionId))
      return `Question "${payload.questionId}" not found in this bank — call get_question_bank to see current questions`;
  }
  if (action === 'update_module' || action === 'set_module_visibility') {
    const moduleId = payload.moduleId || payload.id;
    if (!moduleId) return 'Missing moduleId — call list_modules first';
    if (!(appData.modules || []).find(m => m.id === moduleId && m.courseId === activeCourseId))
      return `Module "${moduleId}" not found — use list_modules`;
  }
  if (action === 'rename_file' || action === 'set_file_visibility' || action === 'set_file_folder') {
    const fileId = payload.fileId || payload.id;
    if (!fileId) return 'Missing fileId — call list_files first';
    if (!(appData.files || []).find(f => f.id === fileId && f.courseId === activeCourseId))
      return `File "${fileId}" not found — use list_files`;
  }
  if (action === 'delete_group_set') {
    const gsId = payload.id || payload.groupSetId;
    if (!gsId) return 'Missing group set id — call list_group_sets first';
    if (!(appData.groupSets || []).find(gs => gs.id === gsId && gs.courseId === activeCourseId))
      return `Group set "${gsId}" not found — use list_group_sets`;
  }
  if (action === 'auto_assign_groups') {
    const gsId = payload.groupSetId || payload.id;
    if (!gsId) return 'Missing groupSetId — call list_group_sets first';
    if (!(appData.groupSets || []).find(gs => gs.id === gsId && gs.courseId === activeCourseId))
      return `Group set "${gsId}" not found — use list_group_sets`;
  }
  if (action === 'send_message') {
    const ids = Array.isArray(payload.recipientIds) ? payload.recipientIds : [];
    if (ids.length === 0) return 'No recipientIds — call list_people first';
    if (!payload.message && !payload.content) return 'Missing message content';
  }
  if ((action === 'create_assignment' || action === 'update_assignment') && payload.isGroupAssignment && payload.groupSetId) {
    if (!(appData.groupSets || []).find(gs => gs.id === payload.groupSetId && gs.courseId === activeCourseId))
      return `Group set "${payload.groupSetId}" not found — use list_group_sets`;
  }
  return null;
}

/**
 * The core multi-step AI loop. Runs tool calls until it gets an answer/action/ask_user.
 * Each tool step is shown as a pill in the chat thread.
 * Max MAX_STEPS iterations to prevent infinite loops.
 */
async function runAiLoop(contents, systemPrompt, isStaffUser = true) {
  const MAX_STEPS = 6;
  let steps = 0;

  while (steps < MAX_STEPS) {
    steps++;

    const data = await callGeminiAPIWithRetry(contents, { temperature: AI_CONFIG.TEMPERATURE_CHAT });
    if (data.error) throw new Error(data.error.message);

    const rawReply = data.candidates[0].content.parts[0].text.trim();
    const cleaned = rawReply.replace(/^```json\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    // ── Parse JSON — robust extraction handles mixed text+JSON responses ─────
    // Gemini sometimes outputs a prose explanation followed by (or mixed with)
    // a JSON object. Walk the string to find every top-level {...} block,
    // parse each, then pick the highest-priority type so a tool_call wins
    // over a plain answer even when mixed with natural language.
    const TYPE_PRIORITY = { tool_call: 4, action: 3, ask_user: 2, answer: 1 };
    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Extract all top-level JSON blocks
      let depth = 0, blockStart = -1;
      let best = null, bestPriority = 0;
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') { if (depth === 0) blockStart = i; depth++; }
        else if (cleaned[i] === '}' && depth > 0) {
          depth--;
          if (depth === 0 && blockStart !== -1) {
            try {
              const candidate = JSON.parse(cleaned.slice(blockStart, i + 1));
              const p = TYPE_PRIORITY[candidate.type] || 0;
              if (p > bestPriority) { best = candidate; bestPriority = p; }
            } catch { /* malformed block — skip */ }
            blockStart = -1;
          }
        }
      }
      parsed = best;
    }

    // ── Bad JSON → retry with correction prompt ────────────────────────────────
    if (!parsed) {
      contents = [
        ...contents,
        { role: 'model', parts: [{ text: rawReply }] },
        { role: 'user',  parts: [{ text: 'ERROR: Your response was not valid JSON. Output ONLY a single valid JSON object with no other text. Try again.' }] }
      ];
      continue;
    }

    // ── Normalize: AI sometimes uses tool name as `type` instead of tool_call ─
    // e.g. {"type":"get_file_content","params":{...}} instead of the correct
    // {"type":"tool_call","tool":"get_file_content","params":{...}}
    const KNOWN_TOOLS = ['list_assignments','list_quizzes','list_files','list_modules','list_people',
      'list_question_banks','list_announcements','list_discussion_threads','get_grade_categories',
      'get_grade_settings','get_question_bank','get_assignment','get_quiz','get_file_content'];
    if (parsed.type && !['tool_call','action','ask_user','answer'].includes(parsed.type) && KNOWN_TOOLS.includes(parsed.type)) {
      parsed = { type: 'tool_call', tool: parsed.type, params: parsed.params || {}, step_label: parsed.step_label || '' };
    }

    // Normalize: AI sometimes uses action name as `type` instead of `action`
    // e.g. {"type":"create_question_bank",...} instead of
    // {"type":"action","action":"create_question_bank",...}
    const RESERVED_TYPES = ['tool_call', 'action', 'ask_user', 'answer'];
    const ACTION_TYPES = new Set((AI_TOOL_REGISTRY.action_types || []).map(actionType => actionType.name));
    if (parsed.type && !RESERVED_TYPES.includes(parsed.type) && !parsed.action && ACTION_TYPES.has(parsed.type)) {
      parsed = { ...parsed, type: 'action', action: parsed.type };
    }

    // Normalize: {"type":"pipeline","actions":[...]} → {"type":"action","action":"pipeline","steps":[...]}
    if (parsed.type === 'pipeline') {
      parsed = { type: 'action', action: 'pipeline', steps: parsed.actions || parsed.steps || [] };
    }

    // Normalize: pipeline with "actions" array instead of "steps"
    if (parsed.type === 'action' && parsed.action === 'pipeline' && !parsed.steps && Array.isArray(parsed.actions)) {
      parsed = { ...parsed, steps: parsed.actions };
    }

    // ── Direct text answer ────────────────────────────────────────────────────
    if (parsed.type === 'answer') {
      aiThread.push({ role: 'assistant', content: parsed.text });
      renderAiThread();
      return;
    }

    // ── Tool call ─────────────────────────────────────────────────────────────
    if (parsed.type === 'tool_call') {
      // Enforce student tool restrictions in code (not just prompt)
      if (!isStaffUser && !STUDENT_TOOLS.includes(parsed.tool)) {
        aiThread.push({ role: 'assistant', content: 'I can only look up course information as a student.' });
        renderAiThread();
        return;
      }
      const icon = { list_people:'👥', list_assignments:'📋', list_question_banks:'📚', get_question_bank:'📖', list_announcements:'📣', list_files:'📁', list_modules:'🗂️', list_quizzes:'📝', get_assignment:'📄', get_quiz:'❓', list_discussion_threads:'💬', get_grade_categories:'📊', get_grade_settings:'📊', get_file_content:'📄' }[parsed.tool] || '🔍';
      const stepMsg = {
        role: 'tool_step',
        tool: parsed.tool,
        stepLabel: parsed.step_label || `${icon} Calling ${parsed.tool.replace(/_/g, ' ')}…`,
        result: null,
        resultSummary: null
      };
      aiThread.push(stepMsg);
      renderAiThread();

      const result = await executeAiTool(parsed.tool, parsed.params || {});
      stepMsg.result = result;
      stepMsg.resultSummary = summarizeToolResult(parsed.tool, result);
      renderAiThread();

      // Feed result back as the next user turn so the loop continues.
      // For get_file_content, attach the file as a multimodal inline data part so
      // Gemini can read PDFs, DOCX, PPTX, images, etc. directly instead of decoded text.
      const toolResultParts = [];
      if (result._inlineData) {
        toolResultParts.push({ text: `TOOL_RESULT(${parsed.tool}): File "${result.name}" (${result.mimeType}, ${(result.sizeBytes/1024).toFixed(0)} KB) is attached below. Read and analyze its full content.` });
        toolResultParts.push({ inlineData: result._inlineData });
      } else if (result._textContent !== undefined) {
        toolResultParts.push({ text: `TOOL_RESULT(${parsed.tool}): File "${result.name}" (${result.mimeType}, ${(result.sizeBytes/1024).toFixed(0)} KB) content:\n\n${result._textContent}\n\nContinue with the original task.` });
      } else {
        toolResultParts.push({ text: `TOOL_RESULT(${parsed.tool}): ${JSON.stringify(result)}\n\nContinue with the original task.` });
      }
      contents = [
        ...contents,
        { role: 'model', parts: [{ text: rawReply }] },
        { role: 'user',  parts: toolResultParts }
      ];
      continue;
    }

    // ── Ask user ──────────────────────────────────────────────────────────────
    if (parsed.type === 'ask_user') {
      aiThread.push({ role: 'ask_user', question: parsed.question, pendingContents: contents, systemPrompt });
      renderAiThread();
      return;
    }

    // ── Action ────────────────────────────────────────────────────────────────
    if (parsed.type === 'action') {
      // Block all write actions for students — enforced in code, not just prompt
      if (!isStaffUser) {
        aiThread.push({ role: 'assistant', content: 'I can help you look up information, but only instructors can create or modify course content.' });
        renderAiThread();
        return;
      }
      const validationError = validateActionPayload(parsed);
      if (validationError) {
        aiThread.push({ role: 'assistant', content: `I couldn't set up that action: ${validationError}` });
        renderAiThread();
        return;
      }
      handleAiAction(parsed);
      renderAiThread();
      return;
    }

    // ── Fallback: treat as plain text ─────────────────────────────────────────
    aiThread.push({ role: 'assistant', content: rawReply });
    renderAiThread();
    return;
  }

  aiThread.push({ role: 'assistant', content: 'I ran out of steps trying to complete that. Please try again with a more specific request.' });
  renderAiThread();
}

/**
 * Build Gemini-format conversation history from aiThread,
 * excluding the most-recently-added message (current user turn just pushed).
 * Consecutive same-role turns are merged to satisfy Gemini's alternating requirement.
 * HTML is stripped from assistant messages so Gemini doesn't echo markup.
 */
function buildGeminiHistory() {
  const history = [];
  const previousMessages = aiThread.slice(0, -1); // exclude current user msg

  for (const msg of previousMessages) {
    if (msg.hidden) continue;
    let role, text;
    if (msg.role === 'user') {
      role = 'user';
      text = msg.content;
    } else if (msg.role === 'assistant') {
      // Strip HTML tags so confirmed-action success messages don't get echoed
      // back verbatim (Gemini confuses rendered HTML with its own prior output)
      role = 'model';
      text = (msg.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
    } else if (msg.role === 'action' && msg.confirmed) {
      // Emit a brief action summary; deliberately NOT merged with the follow-up
      // success-message assistant turn so Gemini gets two clean separate turns
      // The success message assistant turn comes right after and is handled above.
      // We skip emitting a model turn here — the assistant success message already
      // covers it. Skipping avoids the confusing merge.
      continue;
    } else if (msg.role === 'action' && msg.rejected) {
      role = 'model';
      text = `I proposed a "${msg.actionType}" action but the instructor cancelled it.`;
    } else if (msg.role === 'tool_step' && msg.result !== null) {
      // Re-emit tool call + result as model/user turns so the model retains
      // exact IDs (file IDs, assignment IDs, etc.) across follow-up messages.
      const toolCallJson = JSON.stringify({ type: 'tool_call', tool: msg.tool });
      let resultText;
      if (msg.result._inlineData) {
        // Binary file: just record name/type so the model knows it was read
        resultText = `TOOL_RESULT(${msg.tool}): File "${msg.result.name}" (${msg.result.mimeType}) was read as binary.`;
      } else if (msg.result._textContent !== undefined) {
        resultText = `TOOL_RESULT(${msg.tool}): ${JSON.stringify({ name: msg.result.name, mimeType: msg.result.mimeType })}\n\n${msg.result._textContent.slice(0, 2000)}`;
      } else {
        resultText = `TOOL_RESULT(${msg.tool}): ${JSON.stringify(msg.result)}`;
      }
      // Append model turn (tool call) — merge with prior model turn if possible
      const lastModel = history[history.length - 1];
      if (lastModel && lastModel.role === 'model') {
        lastModel.parts[0].text += '\n\n' + toolCallJson;
      } else {
        history.push({ role: 'model', parts: [{ text: toolCallJson }] });
      }
      // Append user turn (tool result) — always separate
      history.push({ role: 'user', parts: [{ text: resultText }] });
      continue;
    } else {
      continue; // skip pending actions, ask_user, incomplete tool_steps
    }
    const last = history[history.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += '\n\n' + text;
    } else {
      history.push({ role, parts: [{ text }] });
    }
  }
  return history;
}

export async function sendAiMessage(audioBase64 = null) {
  const input = document.getElementById('aiInput');
  const message = audioBase64 ? '[Voice message]' : input?.value.trim();
  if (!message && !audioBase64) return;
  if (aiProcessing) return;

  aiProcessing = true;
  updateAiProcessingState();

  const isStaffUser = activeCourseId && isStaffCallback && isStaffCallback(appData.currentUser.id, activeCourseId);
  const effectiveIsStaff = isStaffUser && !studentViewMode;

  aiThread.push({ role: 'user', content: audioBase64 ? '🎤 Voice message' : message });
  if (!audioBase64 && input) input.value = '';
  renderAiThread();

  try {
    const systemPrompt = buildSystemPrompt(effectiveIsStaff, buildAiContext());
    let contents;
    if (audioBase64) {
      contents = [{
        parts: [
          { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
          { text: systemPrompt + '\n\nTranscribe this voice message then respond as instructed:' }
        ]
      }];
    } else {
      const geminiHistory = buildGeminiHistory();
      if (geminiHistory.length === 0) {
        // First message: embed system prompt in user turn
        contents = [{ role: 'user', parts: [{ text: systemPrompt + '\n\nUser: ' + message }] }];
      } else {
        // Subsequent messages: system prompt anchor + history + current message
        contents = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: '{"type":"answer","text":"Understood. I will follow these instructions."}' }] },
          ...geminiHistory,
          { role: 'user', parts: [{ text: message }] }
        ];
      }
    }
    await runAiLoop(contents, systemPrompt, effectiveIsStaff);
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

/**
 * Handle the user's response to an ask_user message — resumes the AI loop.
 */
export function sendAiFollowup(idx) {
  const msg = aiThread[idx];
  if (!msg || msg.role !== 'ask_user' || msg.answered) return;

  const inputEl = document.getElementById(`aiFollowupInput_${idx}`);
  const answer = inputEl?.value.trim();
  if (!answer) return;

  msg.answered = true;
  aiThread.push({ role: 'user', content: answer });
  renderAiThread();

  const resumeContents = [
    ...(msg.pendingContents || []),
    { role: 'user', parts: [{ text: `USER_ANSWER: ${answer}\n\nContinue with the original task.` }] }
  ];

  aiProcessing = true;
  updateAiProcessingState();
  const isStaffUser = activeCourseId && isStaffCallback && isStaffCallback(appData.currentUser?.id, activeCourseId);
  const effectiveIsStaff = isStaffUser && !studentViewMode;
  runAiLoop(resumeContents, msg.systemPrompt || '', effectiveIsStaff).finally(() => {
    aiProcessing = false;
    updateAiProcessingState();
  });
}

/**
 * Handle AI action response
 */
function handleAiAction(action) {
  if (action.action === 'edit_pending_action') {
    applyAiEditToPendingAction(action);
  } else if (action.action === 'pipeline' && (Array.isArray(action.steps) || Array.isArray(action.actions))) {
    aiThread.push({
      role: 'action',
      actionType: 'pipeline',
      data: {
        steps: action.steps || action.actions || [],
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'create_announcement') {
    aiThread.push({
      role: 'action',
      actionType: 'announcement',
      data: { title: action.title, content: action.content, pinned: action.pinned === true, fileIds: action.fileIds || [], fileNames: action.fileNames || [] },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'update_announcement') {
    const d = { id: action.id };
    ['title','content','pinned','hidden','fileIds','fileNames'].forEach(k => { if (k in action) d[k] = action[k]; });
    if (!('fileIds' in d)) d.fileIds = [];
    if (!('fileNames' in d)) d.fileNames = [];
    aiThread.push({ role: 'action', actionType: 'announcement_update', data: d, confirmed: false, rejected: false });
  } else if (action.action === 'delete_announcement') {
    aiThread.push({ role: 'action', actionType: 'announcement_delete', data: { id: action.id }, confirmed: false, rejected: false });
  } else if (action.action === 'publish_announcement') {
    aiThread.push({ role: 'action', actionType: 'announcement_publish', data: { id: action.id }, confirmed: false, rejected: false });
  } else if (action.action === 'pin_announcement') {
    aiThread.push({ role: 'action', actionType: 'announcement_pin', data: { id: action.id, pinned: action.pinned !== false }, confirmed: false, rejected: false });
  } else if (action.action === 'create_quiz_from_bank') {
    const defaultDueDate = new Date(Date.now() + 86400000 * 7).toISOString();
    // AI may send questionCount instead of numQuestions, or questionBankName instead of questionBankId
    const numQuestions = action.numQuestions || action.questionCount || 0;
    const bankName = action.questionBankName || action.bankName || '';
    // Resolve bankId from name if not provided
    let questionBankId = action.questionBankId || null;
    if (!questionBankId && bankName) {
      const found = (window.appData?.questionBanks || []).find(
        b => b.name.toLowerCase() === bankName.toLowerCase() && b.courseId === (window.activeCourseId || '')
      );
      if (found) questionBankId = found.id;
    }
    const gradingType = action.gradingType || 'points';
    aiThread.push({
      role: 'action',
      actionType: 'quiz_from_bank',
      data: {
        title: action.title,
        description: action.description || '',
        category: action.category || 'quiz',
        questionBankId,
        questionBankName: bankName,
        numQuestions,
        randomizeQuestions: action.randomizeQuestions !== undefined ? action.randomizeQuestions : false,
        randomizeAnswers: action.randomizeAnswers !== undefined ? action.randomizeAnswers : true,
        dueDate: action.dueDate || defaultDueDate,
        availableFrom: action.availableFrom || null,
        availableUntil: action.availableUntil || action.dueDate || defaultDueDate,
        points: gradingType === 'complete_incomplete' ? 1 : (action.points || 100),
        gradingType,
        requiredCorrectAnswers: action.requiredCorrectAnswers || null,
        status: action.status || 'draft',
        allowLateSubmissions: action.allowLateSubmissions !== undefined ? action.allowLateSubmissions : true,
        latePenaltyType: action.latePenaltyType || 'per_day',
        lateDeduction: action.lateDeduction !== undefined ? action.lateDeduction : 10,
        gradingNotes: action.gradingNotes || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'create_quiz' || action.action === 'create_quiz_inline') {
    aiThread.push({
      role: 'assistant',
      content: 'Standalone quiz creation is deprecated. I can create this as a Quiz/Exam assignment instead using create_assignment with assignmentType="quiz" and a question bank.'
    });
  } else if (action.action === 'update_quiz' || action.action === 'delete_quiz') {
    aiThread.push({
      role: 'assistant',
      content: 'Standalone quiz updates/deletes are deprecated. Please manage quizzes through assignment-based quiz/exam items.'
    });
  } else if (action.action === 'create_assignment') {
    aiThread.push({
      role: 'action',
      actionType: 'assignment',
      data: {
        title: action.title,
        description: action.description || '',
        gradingNotes: action.gradingNotes || '',
        // CC 1.4 fields
        assignmentType: action.assignmentType || 'essay',
        gradingType: action.gradingType || 'points',
        submissionModalities: action.submissionModalities || ['text'],
        allowedFileTypes: action.allowedFileTypes || [],
        maxFileSizeMb: action.maxFileSizeMb || 50,
        questionBankId: action.questionBankId || null,
        submissionAttempts: action.submissionAttempts ?? null,
        timeLimit: action.timeLimit || null,
        randomizeQuestions: action.randomizeQuestions || false,
        points: action.points ?? 100,
        dueDate: action.dueDate || new Date(Date.now() + 86400000 * 7).toISOString(),
        availableFrom: action.availableFrom || null,
        availableUntil: action.availableUntil || null,
        status: action.status || 'draft',
        category: action.assignmentType === 'quiz' ? 'quiz' : 'essay',
        allowLateSubmissions: action.allowLateSubmissions,
        latePenaltyType: action.latePenaltyType || 'per_day',
        lateDeduction: action.lateDeduction,
        allowResubmission: action.allowResubmission,
        fileIds: action.fileIds || [],
        fileNames: action.fileNames || [],
        // Group assignment fields
        isGroupAssignment: !!action.isGroupAssignment,
        groupSetId: action.groupSetId || null,
        groupGradingMode: action.groupGradingMode || 'per_group',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'create_question_bank') {
    // Normalize questions: AI sometimes uses questionPrompt/questionType instead of prompt/type
    const normalizedQuestions = (action.questions || []).map(q => ({
      type: q.type || q.questionType || 'true_false',
      prompt: q.prompt || q.questionPrompt || q.question || '',
      options: q.options || undefined,
      correctAnswer: q.correctAnswer,
      points: q.points || 1,
      ...(q.caseSensitive !== undefined ? { caseSensitive: q.caseSensitive } : {}),
      ...(q.shuffleOptions !== undefined ? { shuffleOptions: q.shuffleOptions } : {}),
      ...(q.partialCredit ? { partialCredit: q.partialCredit } : {}),
      ...(q.feedbackCorrect ? { feedbackCorrect: q.feedbackCorrect } : {}),
      ...(q.feedbackIncorrect ? { feedbackIncorrect: q.feedbackIncorrect } : {}),
    }));
    aiThread.push({
      role: 'action',
      actionType: 'question_bank_create',
      data: {
        name: action.name || action.bankName || '',
        description: action.description || '',
        questions: normalizedQuestions,
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'update_question_bank') {
    const bankId = action.id || action.bankId;
    const bank = (appData.questionBanks || []).find(b => b.id === bankId);
    const d = { id: bankId };
    if ('name' in action) d.name = action.name;
    if ('description' in action) d.description = action.description;
    d.bankName = bank?.name || '';
    aiThread.push({ role: 'action', actionType: 'question_bank_update', data: d, confirmed: false, rejected: false });
  } else if (action.action === 'add_questions_to_bank') {
    const bankId = action.id || action.bankId;
    const bank = (appData.questionBanks || []).find(b => b.id === bankId);
    aiThread.push({
      role: 'action',
      actionType: 'question_bank_add_questions',
      data: {
        id: bankId,
        bankName: action.bankName || bank?.name || '',
        questions: action.questions || [],
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'delete_question_bank') {
    const bankId = action.id || action.bankId;
    const bank = (appData.questionBanks || []).find(b => b.id === bankId);
    aiThread.push({
      role: 'action',
      actionType: 'question_bank_delete',
      data: { id: bankId, bankName: bank?.name || '', notes: action.notes || '' },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'delete_question_from_bank') {
    aiThread.push({
      role: 'action',
      actionType: 'question_delete_from_bank',
      data: {
        bankId: action.bankId,
        questionId: action.questionId,
        questionPrompt: action.questionPrompt || '',
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
  } else if (action.action === 'update_module') {
    const moduleId = action.moduleId || action.id;
    aiThread.push({
      role: 'action',
      actionType: 'module_update',
      data: {
        moduleId,
        moduleName: action.moduleName || '',
        name: action.name || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'set_module_visibility') {
    const moduleId = action.moduleId || action.id;
    aiThread.push({
      role: 'action',
      actionType: 'module_visibility',
      data: {
        moduleId,
        moduleName: action.moduleName || '',
        hidden: action.hidden !== false && action.hidden !== undefined ? !!action.hidden : false,
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'rename_file') {
    const fileId = action.fileId || action.id;
    aiThread.push({
      role: 'action',
      actionType: 'file_rename',
      data: {
        fileId,
        oldName: action.oldName || '',
        newName: action.newName || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'set_file_visibility') {
    const fileId = action.fileId || action.id;
    aiThread.push({
      role: 'action',
      actionType: 'file_visibility',
      data: {
        fileId,
        fileName: action.fileName || '',
        hidden: action.hidden !== false && action.hidden !== undefined ? !!action.hidden : false,
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'set_file_folder') {
    const fileId = action.fileId || action.id;
    aiThread.push({
      role: 'action',
      actionType: 'file_folder',
      data: {
        fileId,
        fileName: action.fileName || '',
        folder: action.folder || null,
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'update_start_here') {
    aiThread.push({
      role: 'action',
      actionType: 'start_here_update',
      data: {
        title: action.title || 'Start Here',
        content: action.content || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'update_assignment') {
    aiThread.push({
      role: 'action',
      actionType: 'assignment_update',
      data: (() => {
        // Only store fields the AI explicitly included — these are the changed ones
        const d = { id: action.id };
        ['title','description','points','dueDate','status','category','assignmentType',
         'gradingType','allowLateSubmissions','lateDeduction','allowResubmission',
         'submissionAttempts','isGroupAssignment','groupSetId','groupGradingMode','notes'].forEach(k => { if (k in action) d[k] = action[k]; });
        return d;
      })(),
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'delete_assignment') {
    aiThread.push({
      role: 'action',
      actionType: 'assignment_delete',
      data: { id: action.id },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'add_to_module') {
    aiThread.push({
      role: 'action',
      actionType: 'module_add_item',
      data: {
        moduleId: action.moduleId || null,
        moduleName: action.moduleName || '',
        itemType: action.itemType || 'assignment',
        itemId: action.itemId || null,
        itemTitle: action.itemTitle || '',
        url: action.url || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'remove_from_module') {
    aiThread.push({
      role: 'action',
      actionType: 'module_remove_item',
      data: {
        moduleId: action.moduleId || null,
        moduleName: action.moduleName || '',
        itemId: action.itemId || null,
        itemTitle: action.itemTitle || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'move_to_module') {
    aiThread.push({
      role: 'action',
      actionType: 'module_move_item',
      data: {
        itemId: action.itemId || null,
        itemTitle: action.itemTitle || '',
        fromModuleId: action.fromModuleId || null,
        fromModuleName: action.fromModuleName || '',
        toModuleId: action.toModuleId || null,
        toModuleName: action.toModuleName || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'create_invite') {
    const emails = Array.isArray(action.emails)
      ? action.emails
      : (action.email ? [action.email] : []);
    aiThread.push({
      role: 'action',
      actionType: 'invite_create',
      data: {
        emails,
        role: action.role || 'student',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'revoke_invite') {
    aiThread.push({
      role: 'action',
      actionType: 'invite_revoke',
      data: {
        inviteId: action.inviteId || null,
        email: action.email || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'remove_person') {
    aiThread.push({
      role: 'action',
      actionType: 'person_remove',
      data: {
        userId: action.userId || null,
        name: action.name || '',
        email: action.email || '',
        role: action.role || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'set_course_visibility') {
    aiThread.push({
      role: 'action',
      actionType: 'course_visibility',
      data: {
        courseId: action.courseId || activeCourseId,
        visible: action.visible !== false,
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'create_calendar_event') {
    aiThread.push({
      role: 'action',
      actionType: 'calendar_event_create',
      data: {
        title: action.title || '',
        eventDate: action.eventDate || action.date || '',
        eventType: action.eventType || action.type || 'Event',
        description: action.description || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'create_group_set') {
    aiThread.push({
      role: 'action',
      actionType: 'group_set_create',
      data: {
        name: action.name || '',
        description: action.description || '',
        groupCount: action.groupCount || 4,
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'delete_group_set') {
    const gsId = action.id || action.groupSetId;
    const gs = (appData.groupSets || []).find(s => s.id === gsId);
    aiThread.push({
      role: 'action',
      actionType: 'group_set_delete',
      data: { id: gsId, name: action.name || gs?.name || '', notes: action.notes || '' },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'auto_assign_groups') {
    const gsId = action.groupSetId || action.id;
    const gs = (appData.groupSets || []).find(s => s.id === gsId);
    aiThread.push({
      role: 'action',
      actionType: 'group_auto_assign',
      data: { groupSetId: gsId, groupSetName: action.groupSetName || gs?.name || '', notes: action.notes || '' },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'send_message') {
    const recipientIds = Array.isArray(action.recipientIds) ? action.recipientIds : (action.recipientId ? [action.recipientId] : []);
    aiThread.push({
      role: 'action',
      actionType: 'send_message',
      data: {
        recipientIds,
        subject: action.subject || '',
        message: action.message || action.content || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else {
    aiThread.push({ role: 'assistant', content: JSON.stringify(action) });
  }

  // Show notes if present
  if (action.notes) {
    aiThread.push({ role: 'assistant', content: `**Note:** ${action.notes}` });
  }
}

/**
 * Update AI action field value
 */
export function updateAiActionField(idx, field, value) {
  const msg = aiThread[idx];
  if (!msg || msg.role !== 'action') return;
  msg.data[field] = value;
}

/**
 * Flush any pending edits from focused DOM inputs into msg.data before executing.
 * Handles the case where the user clicks Accept while still focused in a text field
 * (the onchange/oninput may not have fired for the focused element yet).
 */
function syncAiActionFromDom(idx) {
  const msg = aiThread[idx];
  if (!msg || msg.role !== 'action') return;
  // Directly read DOM values instead of relying on event dispatch
  document.querySelectorAll(`[data-ai-idx="${idx}"]`).forEach(el => {
    const fieldName = el.dataset.aiField;
    if (!fieldName) return;
    if (fieldName === '__emails__') {
      msg.data.emails = el.value.split(',').map(s => s.trim()).filter(Boolean);
    } else if (el.type === 'checkbox') {
      msg.data[fieldName] = el.checked;
    } else if (el.type === 'number') {
      const n = parseFloat(el.value);
      if (!isNaN(n)) msg.data[fieldName] = n;
    } else if (el.type === 'datetime-local') {
      if (el.value) msg.data[fieldName] = new Date(el.value).toISOString();
    } else {
      msg.data[fieldName] = el.value;
    }
  });
}

/**
 * Generate a natural-language confirmation message after an AI action succeeds.
 */
function pageLink(page, label) {
  return `<a href="#" onclick="event.preventDefault(); window.navigateAndClose && window.navigateAndClose('${escapeHtml(page)}')" style="color:var(--primary); text-decoration:underline; font-weight:500;">${escapeHtml(label)}</a>`;
}

function b(text) { return `<strong>${escapeHtml(String(text))}</strong>`; }

function generateActionConfirmation(msg, publish = false) {
  const d = msg.data || {};
  const wasPublished = publish || d.status === 'published';
  const pubSpan = wasPublished
    ? `It's now <strong>published</strong> and visible to students.`
    : `It's saved as a <strong>draft</strong>.`;

  switch (msg.actionType) {
    case 'announcement':
      return `Done! Created announcement ${b(d.title || 'Untitled')}${d.pinned ? ' and pinned it to the top' : ''}. ${pubSpan} View it in ${pageLink('updates', 'Announcements')}.`;
    case 'announcement_update':
      return `Done! Updated the announcement. View it in ${pageLink('updates', 'Announcements')}.`;
    case 'announcement_delete':
      return `Done! The announcement has been permanently deleted.`;
    case 'announcement_publish':
      return `Done! The announcement is now <strong>published</strong> and visible to students. See ${pageLink('updates', 'Announcements')}.`;
    case 'announcement_pin':
      return `Done! The announcement has been <strong>${d.pinned !== false ? 'pinned' : 'unpinned'}</strong>. See ${pageLink('updates', 'Announcements')}.`;
    case 'assignment': {
      const due = d.dueDate ? new Date(d.dueDate).toLocaleDateString() : 'as set';
      return `Done! Created assignment ${b(d.title || 'Untitled')} (${escapeHtml(String(d.points || 100))} pts, due ${escapeHtml(due)}). ${pubSpan} View it in ${pageLink('assignments', 'Assignments')}.`;
    }
    case 'assignment_update':
      return `Done! Updated the assignment. View it in ${pageLink('assignments', 'Assignments')}.`;
    case 'assignment_delete':
      return `Done! The assignment has been permanently deleted.`;
    case 'quiz':
    case 'quiz_from_bank':
      return `Done! Created quiz/exam ${b(d.title || 'Untitled')}. ${pubSpan} View it in ${pageLink('assignments', 'Assignments')}.`;
    case 'quiz_update':
      return `Done! Updated the quiz. View it in ${pageLink('assignments', 'Assignments')}.`;
    case 'quiz_delete':
      return `Done! The quiz has been permanently deleted.`;
    case 'question_bank_create': {
      const qCount = (d.questions || []).length;
      return `Done! Created question bank ${b(d.name || 'Untitled')} with ${qCount} question${qCount !== 1 ? 's' : ''}.`;
    }
    case 'question_bank_update':
      return `Done! Updated question bank ${b(d.bankName || d.name || '')}.`;
    case 'question_bank_add_questions': {
      const added = (d.questions || []).length;
      return `Done! Added ${added} question${added !== 1 ? 's' : ''} to ${b(d.bankName || 'the question bank')}.`;
    }
    case 'question_bank_delete':
      return `Done! Question bank ${b(d.bankName || '')} has been permanently deleted.`;
    case 'question_delete_from_bank':
      return `Done! The question has been removed from the bank.`;
    case 'module':
      return `Done! Created module ${b(d.name || 'Untitled')}. Add content from ${pageLink('modules', 'Modules')}.`;
    case 'module_update':
      return `Done! Module renamed to ${b(d.name || 'Untitled')}. See ${pageLink('modules', 'Modules')}.`;
    case 'module_visibility':
      return `Done! Module ${b(d.moduleName || '')} is now <strong>${d.hidden ? 'hidden from' : 'visible to'}</strong> students. See ${pageLink('modules', 'Modules')}.`;
    case 'file_rename':
      return `Done! File renamed to ${b(d.newName || '')}.`;
    case 'file_visibility':
      return `Done! File ${b(d.fileName || '')} is now <strong>${d.hidden ? 'hidden from' : 'visible to'}</strong> students.`;
    case 'file_folder':
      return `Done! File ${b(d.fileName || '')} ${d.folder ? `moved to folder ${b(d.folder)}` : 'removed from folder'}.`;
    case 'start_here_update':
      return `Done! The Start Here message has been updated. View it on the ${pageLink('home', 'Course Home')}.`;
    case 'module_add_item': {
      const mod = (appData.modules || []).find(m => m.id === d.moduleId);
      const resolvedItemTitle = d.itemTitle
        || (appData.assignments || []).find(a => a.id === d.itemId)?.title
        || (appData.quizzes || []).find(q => q.id === d.itemId)?.title
        || (appData.files || []).find(f => f.id === d.itemId)?.name
        || 'the item';
      return `Done! Added ${b(resolvedItemTitle)} to module ${b(d.moduleName || mod?.name || 'module')}. See ${pageLink('modules', 'Modules')}.`;
    }
    case 'module_remove_item': {
      const mod = (appData.modules || []).find(m => m.id === d.moduleId);
      return `Done! Removed ${b(d.itemTitle || 'the item')} from module ${b(d.moduleName || mod?.name || 'module')}. See ${pageLink('modules', 'Modules')}.`;
    }
    case 'module_move_item': {
      const toMod = (appData.modules || []).find(m => m.id === d.toModuleId);
      return `Done! Moved ${b(d.itemTitle || 'the item')} to ${b(d.toModuleName || toMod?.name || 'the new module')}. See ${pageLink('modules', 'Modules')}.`;
    }
    case 'invite_create': {
      const count = Array.isArray(d.emails) ? d.emails.length : 1;
      const emailList = Array.isArray(d.emails) ? d.emails.join(', ') : (d.emails || '');
      return `Done! Sent ${count} invitation${count !== 1 ? 's' : ''} to ${b(emailList)} as ${escapeHtml(d.role || 'student')}. Manage from ${pageLink('people', 'People')}.`;
    }
    case 'invite_revoke': {
      const inv = (appData.invites || []).find(i => i.id === (d.inviteId || d.id));
      const revokedEmail = d.email || inv?.email || '';
      return `Done! The invitation${revokedEmail ? ` for ${b(revokedEmail)}` : ''} has been revoked. Manage invites from ${pageLink('people', 'People')}.`;
    }
    case 'person_remove': {
      const removedUser = (appData.users || []).find(u => u.id === d.userId);
      const removedName = d.name || removedUser?.name || d.email || removedUser?.email || 'The person';
      return `Done! ${b(removedName)} has been removed from the course. See ${pageLink('people', 'People')}.`;
    }
    case 'course_visibility':
      return `Done! The course is now <strong>${d.visible !== false ? 'visible to students' : 'hidden from students'}</strong>.`;
    case 'calendar_event_create': {
      const evDate = d.eventDate ? new Date(d.eventDate).toLocaleString() : '';
      return `Done! Added ${b(d.title)} (${escapeHtml(d.eventType || 'Event')}) to the ${pageLink('calendar', 'Calendar')}${evDate ? ` on ${escapeHtml(evDate)}` : ''}.`;
    }
    case 'group_set_create':
      return `Done! Created group set ${b(d.name)} with ${d.groupCount || 4} groups. Manage from ${pageLink('groups', 'Groups')}.`;
    case 'group_set_delete':
      return `Done! Group set ${b(d.name || '')} has been permanently deleted.`;
    case 'group_auto_assign':
      return `Done! Students have been auto-assigned to groups in ${b(d.groupSetName || '')}. See ${pageLink('groups', 'Groups')}.`;
    case 'send_message':
      return `Done! Message sent. View the conversation in ${pageLink('inbox', 'Inbox')}.`;
    default:
      return `Done! The action was completed successfully.`;
  }
}

/**
 * Confirm and execute an AI action
 */
export async function confirmAiAction(idx, publish = false) {
  // Flush any in-progress edits (handles user clicking Accept while still focused in a field)
  syncAiActionFromDom(idx);

  const msg = aiThread[idx];
  if (!msg || msg.role !== 'action') return;

  if (msg.actionType === 'pipeline') {
    for (const step of (msg.data.steps || [])) {
      const missing = getMissingPublishRequirements(step, false);
      if (missing.length) {
        aiThread.push({ role: 'assistant', content: `Before I can publish this pipeline step (${step.action || 'unknown'}), I still need: ${missing.join(', ')}.` });
        renderAiThread();
        return;
      }
      const ok = await executeAiOperation(step, false);
      if (!ok) {
        showToast(`Pipeline stopped on step: ${step.action || 'unknown'}`, 'error');
        return;
      }
    }
    msg.confirmed = true;
    aiThread.push({ role: 'assistant', content: `Done! I completed all ${(msg.data.steps || []).length} steps in the pipeline successfully.` });
    renderAiThread();
    return;
  } else {
    const operation = { action: msg.actionType, ...msg.data };
    const missing = getMissingPublishRequirements(operation, publish);
    if (missing.length) {
      aiThread.push({ role: 'assistant', content: `Before publishing, I still need: ${missing.join(', ')}.` });
      renderAiThread();
      return;
    }
    const ok = await executeAiOperation(operation, publish);
    if (!ok) return;
  }

  msg.confirmed = true;
  aiThread.push({ role: 'assistant', content: generateActionConfirmation(msg, publish), isHtml: true });
  renderAiThread();
}

async function executeAiOperation(operation, publish = false) {
  const resolved = resolveOperationReferences(operation || {});
  const action = normalizeAiOperationAction(resolved.action);

  if (action === 'announcement') {
    const announcement = {
      id: generateId(),
      courseId: activeCourseId,
      title: resolved.title,
      content: appendFileLinksToContent(resolved.content, resolved.fileIds),
      pinned: false,
      hidden: !publish,
      authorId: appData.currentUser.id,
      createdAt: new Date().toISOString()
    };
    const result = await supabaseCreateAnnouncement(announcement);
    if (!result) {
      showToast('Failed to save announcement to database', 'error');
      return false;
    }
    appData.announcements.push(announcement);
    if (renderUpdatesCallback) renderUpdatesCallback();
    if (renderHomeCallback) renderHomeCallback();
    return true;
  }

  if (action === 'announcement_update') {
    const announcement = appData.announcements.find(a => a.id === resolved.id && a.courseId === activeCourseId);
    if (!announcement) {
      showToast('Announcement not found for update', 'error');
      return false;
    }
    if (resolved.title !== undefined) announcement.title = resolved.title;
    if (resolved.content !== undefined) announcement.content = appendFileLinksToContent(resolved.content, resolved.fileIds);
    if (resolved.pinned !== undefined) announcement.pinned = !!resolved.pinned;
    if (resolved.hidden !== undefined) announcement.hidden = !!resolved.hidden;
    const result = await supabaseUpdateAnnouncement(announcement);
    if (!result) {
      showToast('Failed to update announcement', 'error');
      return false;
    }
    if (renderUpdatesCallback) renderUpdatesCallback();
    if (renderHomeCallback) renderHomeCallback();
    return true;
  }

  if (action === 'announcement_publish') {
    return await executeAiOperation({ action: 'announcement_update', id: resolved.id, hidden: false }, false);
  }

  if (action === 'announcement_pin') {
    return await executeAiOperation({ action: 'announcement_update', id: resolved.id, pinned: resolved.pinned !== false }, false);
  }

  if (action === 'announcement_delete') {
    const success = await supabaseDeleteAnnouncement(resolved.id);
    if (!success) {
      showToast('Failed to delete announcement', 'error');
      return false;
    }
    appData.announcements = appData.announcements.filter(a => a.id !== resolved.id);
    if (renderUpdatesCallback) renderUpdatesCallback();
    if (renderHomeCallback) renderHomeCallback();
    return true;
  }

  if (action === 'quiz') {
    showToast('Standalone quiz creation is deprecated. Use a Quiz/Exam assignment with a question bank.', 'error');
    return false;
  }
  if (action === 'quiz_update' || action === 'quiz_delete') {
    showToast('Standalone quiz updates/deletes are deprecated. Use assignment-based quiz/exam items.', 'error');
    return false;
  }

  if (action === 'quiz_from_bank') {
    const defaultDueDate = new Date(Date.now() + 86400000 * 7).toISOString();
    const newAssignment = {
      id: generateId(),
      courseId: activeCourseId,
      title: resolved.title,
      description: resolved.description || '',
      category: resolved.category || 'quiz',
      points: resolved.points || 100,
      dueDate: resolved.dueDate || defaultDueDate,
      status: 'draft',
      allowLateSubmissions: resolved.allowLateSubmissions !== false,
      latePenaltyType: resolved.latePenaltyType || 'per_day',
      lateDeduction: resolved.lateDeduction !== undefined ? resolved.lateDeduction : 10,
      gradingNotes: resolved.gradingNotes || '',
      allowResubmission: false,
      questionBankId: resolved.questionBankId,
      numQuestions: resolved.numQuestions || 0,
      randomizeQuestions: resolved.randomizeQuestions || false,
      randomizeAnswers: resolved.randomizeAnswers || true,
      createdAt: new Date().toISOString(),
      createdBy: appData.currentUser?.id
    };
    const result = await supabaseCreateAssignment(newAssignment);
    if (!result) {
      showToast('Failed to save quiz/exam to database', 'error');
      return false;
    }
    appData.assignments.push(newAssignment);
    if (renderAssignmentsCallback) renderAssignmentsCallback();
    return true;
  }

  if (action === 'assignment') {
    const atype = resolved.assignmentType || 'essay';
    const legacyCat = atype === 'quiz' ? 'quiz' : atype === 'no_submission' ? 'participation' : 'essay';
    const newAssignment = {
      id: generateId(),
      courseId: activeCourseId,
      title: resolved.title,
      description: appendFileLinksToContent(resolved.description || '', resolved.fileIds),
      gradingNotes: resolved.gradingNotes || '',
      // CC 1.4 / QTI 3.0 fields
      assignmentType: atype,
      gradingType: resolved.gradingType || 'points',
      submissionModalities: resolved.submissionModalities || ['text'],
      allowedFileTypes: resolved.allowedFileTypes || [],
      maxFileSizeMb: resolved.maxFileSizeMb || 50,
      questionBankId: resolved.questionBankId || null,
      submissionAttempts: resolved.submissionAttempts ?? null,
      timeLimit: resolved.timeLimit || null,
      randomizeQuestions: resolved.randomizeQuestions || false,
      points: resolved.points ?? 100,
      status: publish ? 'published' : (resolved.status || 'draft'),
      hidden: !publish && resolved.status !== 'published',
      dueDate: resolved.dueDate || new Date(Date.now() + 86400000 * 7).toISOString(),
      availableFrom: resolved.availableFrom || null,
      availableUntil: resolved.availableUntil || null,
      createdAt: new Date().toISOString(),
      category: legacyCat,
      allowLateSubmissions: resolved.allowLateSubmissions !== undefined ? !!resolved.allowLateSubmissions : (atype !== 'no_submission'),
      latePenaltyType: resolved.latePenaltyType || 'per_day',
      lateDeduction: resolved.lateDeduction !== undefined ? resolved.lateDeduction : 10,
      allowResubmission: resolved.allowResubmission !== undefined ? !!resolved.allowResubmission : false,
      // Group assignment fields
      isGroupAssignment: !!resolved.isGroupAssignment,
      groupSetId: resolved.groupSetId || null,
      groupGradingMode: resolved.groupGradingMode || 'per_group',
      createdBy: appData.currentUser?.id
    };
    const result = await supabaseCreateAssignment(newAssignment);
    if (!result) {
      showToast('Failed to save assignment to database', 'error');
      return false;
    }
    appData.assignments.push(newAssignment);
    if (renderAssignmentsCallback) renderAssignmentsCallback();
    return true;
  }

  if (action === 'module') {
    if (!appData.modules) appData.modules = [];
    const courseModules = appData.modules.filter(m => m.courseId === activeCourseId);
    const maxPosition = courseModules.length > 0 ? Math.max(...courseModules.map(m => m.position)) + 1 : 0;
    const newModule = {
      id: generateId(),
      courseId: activeCourseId,
      name: resolved.name,
      position: maxPosition,
      items: []
    };
    const result = await supabaseCreateModule(newModule);
    if (!result) {
      showToast('Failed to save module to database', 'error');
      return false;
    }
    appData.modules.push(newModule);
    if (renderModulesCallback) renderModulesCallback();
    return true;
  }

  if (action === 'question_bank_create') {
    if (!appData.questionBanks) appData.questionBanks = [];
    const newBank = {
      id: generateId(),
      courseId: activeCourseId,
      name: resolved.name || 'New Question Bank',
      description: resolved.description || '',
      questions: (resolved.questions || []).map(q => ({ id: generateId(), ...q })),
      createdBy: appData.currentUser?.id,
      createdAt: new Date().toISOString()
    };
    const result = await supabaseCreateQuestionBank(newBank);
    if (!result) {
      showToast('Failed to save question bank to database', 'error');
      return false;
    }
    appData.questionBanks.push(newBank);
    return true;
  }

  if (action === 'question_bank_update') {
    const bank = (appData.questionBanks || []).find(b => b.id === resolved.id && b.courseId === activeCourseId);
    if (!bank) { showToast('Question bank not found', 'error'); return false; }
    if (resolved.name !== undefined) bank.name = resolved.name;
    if (resolved.description !== undefined) bank.description = resolved.description;
    const result = await supabaseUpdateQuestionBank(bank);
    if (!result) { showToast('Failed to update question bank', 'error'); return false; }
    return true;
  }

  if (action === 'question_bank_add_questions') {
    const bankId = resolved.id || resolved.bankId;
    const bank = (appData.questionBanks || []).find(b => b.id === bankId && b.courseId === activeCourseId);
    if (!bank) { showToast('Question bank not found', 'error'); return false; }
    const newQuestions = (resolved.questions || []).map(q => ({ id: generateId(), ...q }));
    bank.questions = [...(bank.questions || []), ...newQuestions];
    const result = await supabaseUpdateQuestionBank(bank);
    if (!result) { showToast('Failed to update question bank', 'error'); return false; }
    return true;
  }

  if (action === 'question_bank_delete') {
    const bankId = resolved.id || resolved.bankId;
    const success = await supabaseDeleteQuestionBank(bankId);
    if (!success) { showToast('Failed to delete question bank', 'error'); return false; }
    appData.questionBanks = (appData.questionBanks || []).filter(b => b.id !== bankId);
    return true;
  }

  if (action === 'question_delete_from_bank') {
    const bank = (appData.questionBanks || []).find(b => b.id === resolved.bankId && b.courseId === activeCourseId);
    if (!bank) { showToast('Question bank not found', 'error'); return false; }
    bank.questions = (bank.questions || []).filter(q => q.id !== resolved.questionId);
    const result = await supabaseUpdateQuestionBank(bank);
    if (!result) { showToast('Failed to update question bank', 'error'); return false; }
    return true;
  }

  if (action === 'module_update') {
    const moduleId = resolved.moduleId || resolved.id;
    const mod = (appData.modules || []).find(m => m.id === moduleId && m.courseId === activeCourseId);
    if (!mod) { showToast('Module not found', 'error'); return false; }
    if (resolved.name) mod.name = resolved.name;
    const result = await supabaseUpdateModule(mod);
    if (!result) { showToast('Failed to update module', 'error'); return false; }
    if (renderModulesCallback) renderModulesCallback();
    return true;
  }

  if (action === 'module_visibility') {
    const moduleId = resolved.moduleId || resolved.id;
    const mod = (appData.modules || []).find(m => m.id === moduleId && m.courseId === activeCourseId);
    if (!mod) { showToast('Module not found', 'error'); return false; }
    mod.hidden = !!resolved.hidden;
    const result = await supabaseUpdateModule(mod);
    if (!result) { showToast('Failed to update module visibility', 'error'); return false; }
    if (renderModulesCallback) renderModulesCallback();
    return true;
  }

  if (action === 'file_rename') {
    const fileId = resolved.fileId || resolved.id;
    const file = (appData.files || []).find(f => f.id === fileId && f.courseId === activeCourseId);
    if (!file) { showToast('File not found', 'error'); return false; }
    file.name = resolved.newName || file.name;
    const result = await supabaseUpdateFile(file);
    if (!result) { showToast('Failed to rename file', 'error'); return false; }
    return true;
  }

  if (action === 'file_visibility') {
    const fileId = resolved.fileId || resolved.id;
    const file = (appData.files || []).find(f => f.id === fileId && f.courseId === activeCourseId);
    if (!file) { showToast('File not found', 'error'); return false; }
    file.hidden = !!resolved.hidden;
    const result = await supabaseUpdateFile(file);
    if (!result) { showToast('Failed to update file visibility', 'error'); return false; }
    return true;
  }

  if (action === 'file_folder') {
    const fileId = resolved.fileId || resolved.id;
    const file = (appData.files || []).find(f => f.id === fileId && f.courseId === activeCourseId);
    if (!file) { showToast('File not found', 'error'); return false; }
    file.folder = resolved.folder || null;
    const result = await supabaseUpdateFile(file);
    if (!result) { showToast('Failed to update file folder', 'error'); return false; }
    return true;
  }

  if (action === 'start_here_update') {
    const course = (appData.courses || []).find(c => c.id === activeCourseId);
    if (!course) { showToast('Course not found', 'error'); return false; }
    course.startHereTitle = resolved.title || 'Start Here';
    course.startHereContent = resolved.content || '';
    const result = await supabaseUpdateCourse(course);
    if (!result) { showToast('Failed to update Start Here message', 'error'); return false; }
    if (renderHomeCallback) renderHomeCallback();
    return true;
  }

  if (action === 'assignment_update') {
    const assignment = (appData.assignments || []).find(a => a.id === resolved.id && a.courseId === activeCourseId);
    if (!assignment) { showToast('Assignment not found', 'error'); return false; }
    if (resolved.title !== undefined) assignment.title = resolved.title;
    if (resolved.description !== undefined) assignment.description = appendFileLinksToContent(resolved.description, resolved.fileIds);
    if (resolved.points !== undefined) assignment.points = resolved.points;
    if (resolved.dueDate !== undefined) assignment.dueDate = resolved.dueDate;
    if (resolved.status !== undefined) assignment.status = resolved.status;
    if (publish) assignment.status = 'published';
    // CC 1.4 fields
    if (resolved.assignmentType !== undefined) {
      assignment.assignmentType = resolved.assignmentType;
      assignment.category = resolved.assignmentType === 'quiz' ? 'quiz' : resolved.assignmentType === 'no_submission' ? 'participation' : 'essay';
    }
    if (resolved.gradingType !== undefined) assignment.gradingType = resolved.gradingType;
    if (resolved.allowLateSubmissions !== undefined) assignment.allowLateSubmissions = !!resolved.allowLateSubmissions;
    if (resolved.lateDeduction !== undefined) assignment.lateDeduction = resolved.lateDeduction;
    if (resolved.allowResubmission !== undefined) assignment.allowResubmission = !!resolved.allowResubmission;
    if (resolved.submissionAttempts !== undefined) assignment.submissionAttempts = resolved.submissionAttempts;
    if (resolved.isGroupAssignment !== undefined) assignment.isGroupAssignment = !!resolved.isGroupAssignment;
    if (resolved.groupSetId !== undefined) assignment.groupSetId = resolved.groupSetId;
    if (resolved.groupGradingMode !== undefined) assignment.groupGradingMode = resolved.groupGradingMode;
    const result = await supabaseUpdateAssignment(assignment);
    if (!result) { showToast('Failed to update assignment', 'error'); return false; }
    if (renderAssignmentsCallback) renderAssignmentsCallback();
    if (renderGradebookCallback) renderGradebookCallback();
    return true;
  }

  if (action === 'assignment_delete') {
    const success = await supabaseDeleteAssignment(resolved.id);
    if (!success) { showToast('Failed to delete assignment', 'error'); return false; }
    appData.assignments = (appData.assignments || []).filter(a => a.id !== resolved.id);
    if (renderAssignmentsCallback) renderAssignmentsCallback();
    if (renderGradebookCallback) renderGradebookCallback();
    return true;
  }

  if (action === 'module_add_item') {
    if (!resolved.moduleId || !resolved.itemId) {
      showToast('Missing module or item information', 'error');
      return false;
    }
    const mod = (appData.modules || []).find(m => m.id === resolved.moduleId);
    if (!mod) { showToast('Module not found', 'error'); return false; }
    if (!mod.items) mod.items = [];
    const newItem = {
      id: generateId(),
      type: resolved.itemType || 'assignment',
      refId: resolved.itemType === 'external_link' ? null : resolved.itemId,
      title: resolved.itemType === 'external_link' ? resolved.itemTitle : undefined,
      url: resolved.itemType === 'external_link' ? resolved.url : undefined,
      position: mod.items.length
    };
    await supabaseCreateModuleItem(newItem, resolved.moduleId);
    mod.items.push(newItem);
    if (renderModulesCallback) renderModulesCallback();
    return true;
  }

  if (action === 'module_remove_item') {
    if (!resolved.moduleId || !resolved.itemId) {
      showToast('Missing module or item information', 'error');
      return false;
    }
    const mod = (appData.modules || []).find(m => m.id === resolved.moduleId);
    if (!mod) { showToast('Module not found', 'error'); return false; }
    await supabaseDeleteModuleItem(resolved.itemId);
    mod.items = (mod.items || []).filter(i => i.id !== resolved.itemId);
    mod.items.forEach((item, i) => { item.position = i; });
    if (renderModulesCallback) renderModulesCallback();
    return true;
  }

  if (action === 'module_move_item') {
    if (!resolved.fromModuleId || !resolved.toModuleId || !resolved.itemId) {
      showToast('Missing move information', 'error');
      return false;
    }
    const fromMod = (appData.modules || []).find(m => m.id === resolved.fromModuleId);
    const toMod = (appData.modules || []).find(m => m.id === resolved.toModuleId);
    if (!fromMod || !toMod) { showToast('Module not found', 'error'); return false; }
    const itemIdx = (fromMod.items || []).findIndex(i => i.id === resolved.itemId);
    if (itemIdx === -1) { showToast('Item not found in source module', 'error'); return false; }
    const [movedItem] = fromMod.items.splice(itemIdx, 1);
    movedItem.position = (toMod.items || []).length;
    if (!toMod.items) toMod.items = [];
    toMod.items.push(movedItem);
    fromMod.items.forEach((item, i) => { item.position = i; });
    // Persist move via direct DB call
    await supabaseCreateModuleItem({ ...movedItem, position: movedItem.position }, resolved.toModuleId);
    await supabaseDeleteModuleItem(resolved.itemId);
    if (renderModulesCallback) renderModulesCallback();
    return true;
  }

  if (action === 'invite_create') {
    if (!activeCourseId) { showToast('No active course', 'error'); return false; }
    const emails = Array.isArray(resolved.emails) ? resolved.emails : [];
    if (emails.length === 0) { showToast('No emails provided', 'error'); return false; }
    if (!appData.invites) appData.invites = [];
    let successCount = 0;
    for (const email of emails) {
      const existingUser = (appData.users || []).find(u => u.email === email);
      if (existingUser) {
        const alreadyEnrolled = (appData.enrollments || []).find(
          e => e.userId === existingUser.id && e.courseId === activeCourseId
        );
        if (!alreadyEnrolled) {
          // Import supabaseCreateEnrollment via callback
          showToast(`${email} is already a registered user — enroll them from the People tab`, 'info');
          continue;
        }
      }
      const invite = {
        courseId: activeCourseId,
        email: email.trim(),
        role: resolved.role || 'student',
        status: 'pending',
        sentAt: new Date().toISOString()
      };
      const result = await supabaseCreateInvite(invite);
      if (result) {
        appData.invites.push({ ...invite, id: result.id || invite.id });
        successCount++;
      }
    }
    if (successCount > 0) {
      showToast(`Invited ${successCount} person${successCount > 1 ? 's' : ''}`, 'success');
      if (renderPeopleCallback) renderPeopleCallback();
    }
    return successCount > 0;
  }

  if (action === 'invite_revoke') {
    let inviteId = resolved.inviteId;
    if (!inviteId && resolved.email) {
      const inv = (appData.invites || []).find(
        i => i.email === resolved.email && i.courseId === activeCourseId && i.status === 'pending'
      );
      if (inv) inviteId = inv.id;
    }
    if (!inviteId) { showToast('Invite not found', 'error'); return false; }
    await supabaseDeleteInvite(inviteId);
    appData.invites = (appData.invites || []).filter(i => i.id !== inviteId);
    if (renderPeopleCallback) renderPeopleCallback();
    return true;
  }

  if (action === 'person_remove') {
    const userId = resolved.userId;
    if (!userId) { showToast('User ID missing', 'error'); return false; }
    const enrollment = (appData.enrollments || []).find(e => e.userId === userId && e.courseId === activeCourseId);
    if (!enrollment) { showToast('User is not enrolled in this course', 'error'); return false; }
    await supabaseDeleteEnrollment(userId, activeCourseId);
    appData.enrollments = (appData.enrollments || []).filter(
      e => !(e.userId === userId && e.courseId === activeCourseId)
    );
    if (renderPeopleCallback) renderPeopleCallback();
    return true;
  }

  if (action === 'course_visibility') {
    const courseId = resolved.courseId || activeCourseId;
    const course = (appData.courses || []).find(c => c.id === courseId);
    if (!course) { showToast('Course not found', 'error'); return false; }
    course.active = resolved.visible !== false;
    const result = await supabaseUpdateCourse(course);
    if (!result) { showToast('Failed to update course visibility', 'error'); return false; }
    showToast(course.active ? 'Course is now visible to students' : 'Course is now hidden from students', 'success');
    return true;
  }

  if (action === 'calendar_event_create') {
    if (!activeCourseId) { showToast('No active course', 'error'); return false; }
    if (!resolved.title) { showToast('Event title is required', 'error'); return false; }
    if (!resolved.eventDate) { showToast('Event date is required', 'error'); return false; }
    const ev = {
      id: generateId(),
      courseId: activeCourseId,
      title: resolved.title,
      eventDate: resolved.eventDate,
      eventType: resolved.eventType || 'Event',
      description: resolved.description || '',
      createdBy: appData.currentUser?.id,
      createdAt: new Date().toISOString()
    };
    const saved = await supabaseCreateCalendarEvent(ev);
    if (!saved) return false;
    if (!appData.calendarEvents) appData.calendarEvents = [];
    appData.calendarEvents.push(ev);
    if (window.renderCalendar) window.renderCalendar();
    showToast('Calendar event added', 'success');
    return true;
  }

  if (action === 'group_set_create') {
    if (!activeCourseId) { showToast('No active course', 'error'); return false; }
    if (!resolved.name) { showToast('Group set name is required', 'error'); return false; }
    const gsId = generateId();
    const saved = await supabaseCreateGroupSet({ id: gsId, courseId: activeCourseId, name: resolved.name, description: resolved.description || '' });
    if (!saved) { showToast('Failed to create group set', 'error'); return false; }
    const gs = { id: gsId, courseId: activeCourseId, name: resolved.name, description: resolved.description || '', createdBy: appData.currentUser?.id, createdAt: new Date().toISOString() };
    if (!appData.groupSets) appData.groupSets = [];
    appData.groupSets.push(gs);
    // Create individual groups
    const count = resolved.groupCount || 4;
    for (let i = 1; i <= count; i++) {
      const gId = generateId();
      const groupSaved = await supabaseCreateCourseGroup({ id: gId, groupSetId: gsId, courseId: activeCourseId, name: `Group ${i}` });
      if (groupSaved) {
        if (!appData.courseGroups) appData.courseGroups = [];
        appData.courseGroups.push({ id: gId, groupSetId: gsId, courseId: activeCourseId, name: `Group ${i}`, createdAt: new Date().toISOString(), members: [] });
      }
    }
    showToast(`Group set "${resolved.name}" created with ${count} groups!`, 'success');
    return true;
  }

  if (action === 'group_set_delete') {
    const gsId = resolved.id || resolved.groupSetId;
    if (!gsId) { showToast('Missing group set id', 'error'); return false; }
    const ok = await supabaseDeleteGroupSet(gsId);
    if (!ok) { showToast('Failed to delete group set', 'error'); return false; }
    appData.courseGroups = (appData.courseGroups || []).filter(g => g.groupSetId !== gsId);
    appData.groupSets = (appData.groupSets || []).filter(gs => gs.id !== gsId);
    showToast('Group set deleted', 'success');
    return true;
  }

  if (action === 'group_auto_assign') {
    const gsId = resolved.groupSetId || resolved.id;
    if (!gsId) { showToast('Missing group set id', 'error'); return false; }
    const groups = (appData.courseGroups || []).filter(g => g.groupSetId === gsId);
    if (groups.length === 0) { showToast('No groups in this set', 'error'); return false; }
    // Find unassigned students
    const assignedUserIds = new Set(groups.flatMap(g => (g.members || []).map(m => m.userId)));
    const students = (appData.enrollments || [])
      .filter(e => e.courseId === activeCourseId && e.role === 'student' && !assignedUserIds.has(e.userId))
      .map(e => e.userId);
    if (students.length === 0) { showToast('All students are already assigned', 'info'); return true; }
    // Shuffle
    const shuffled = [...students];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // Round-robin assign
    let idx2 = 0;
    for (const userId of shuffled) {
      const group = groups[idx2 % groups.length];
      const saved = await supabaseAddGroupMember(group.id, userId);
      if (saved) {
        if (!group.members) group.members = [];
        group.members.push({ id: saved.id, groupId: group.id, userId, joinedAt: new Date().toISOString() });
      }
      idx2++;
    }
    showToast(`${shuffled.length} students auto-assigned!`, 'success');
    return true;
  }

  if (action === 'send_message') {
    if (!activeCourseId) { showToast('No active course', 'error'); return false; }
    const recipientIds = Array.isArray(resolved.recipientIds) ? resolved.recipientIds : [];
    if (recipientIds.length === 0) { showToast('No recipients specified', 'error'); return false; }
    if (!resolved.message) { showToast('Message content is required', 'error'); return false; }
    // Create conversation
    const convId = generateId();
    const convResult = await supabaseCreateConversation({ id: convId, courseId: activeCourseId, subject: resolved.subject || null });
    if (!convResult) { showToast('Failed to create conversation', 'error'); return false; }
    // Add participants (self + recipients)
    const allParticipantIds = [appData.currentUser.id, ...recipientIds.filter(id => id !== appData.currentUser.id)];
    for (const uid of allParticipantIds) {
      await supabaseAddConversationParticipant(convId, uid);
    }
    // Send the message
    const msgId = generateId();
    await supabaseCreateMessage({ id: msgId, conversationId: convId, senderId: appData.currentUser.id, content: resolved.message });
    // Update local state
    if (!appData.conversations) appData.conversations = [];
    appData.conversations.push({
      id: convId, courseId: activeCourseId, subject: resolved.subject || null,
      createdBy: appData.currentUser.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      participants: allParticipantIds.map(uid => ({ conversationId: convId, userId: uid })),
      messages: [{ id: msgId, conversationId: convId, senderId: appData.currentUser.id, content: resolved.message, createdAt: new Date().toISOString() }]
    });
    showToast('Message sent!', 'success');
    return true;
  }

  showToast(`Unsupported AI action: ${action}`, 'error');
  return false;
}

/**
 * Reject an AI action
 */
export function rejectAiAction(idx) {
  // Prefer exact index to avoid stale-index issues after rerenders
  let msg = aiThread[idx];
  if (!msg || msg.role !== 'action') {
    msg = [...aiThread].reverse().find(m => m.role === 'action' && !m.hidden && !m.confirmed && !m.rejected);
  }
  if (!msg || msg.role !== 'action') return;

  if (!msg.confirmed && !msg.rejected) msg.rejected = true;
  msg.hidden = true;
  aiThread.push({ role: 'assistant', content: 'No problem - canceled that proposal and no changes have been made.' });
  try {
    renderAiThread();
  } catch (e) {
    console.error('[rejectAiAction] renderAiThread failed:', e);
    // Force a minimal re-render so the cancel is at least reflected
    const el = document.getElementById('aiThread');
    if (el) el.innerHTML = '<div class="muted" style="padding:20px; text-align:center;">Action cancelled. Refresh AI panel to continue.</div>';
  }
}

/**
 * Update AI processing state in UI
 */
export function updateAiProcessingState() {
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

  // Show/hide thinking indicator
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

/**
 * Render the AI conversation thread
 */
export function renderAiThread() {
  const html = aiThread.map((msg, idx) => {
    if (msg.hidden) return "";

    const isLatest = idx === aiThread.length - 1 ||
      (msg.role === 'action' && !msg.confirmed && !msg.rejected);

    if (msg.role === 'user') {
      return `
        <div style="margin-bottom:16px; display:flex; justify-content:flex-end;">
          <div style="background:var(--primary-light); padding:12px 16px; border-radius:16px 16px 4px 16px; max-width:85%;">
            ${escapeHtml(msg.content)}
          </div>
        </div>
      `;
    }

    // ── Tool step pill — shows what the AI is looking up ────────────────────
    if (msg.role === 'tool_step') {
      const done = msg.result !== null;
      const hasError = done && msg.result?.error;
      const statusIcon = done ? (hasError ? '✗' : '✓') : '⏳';
      const summary = msg.resultSummary ? ` — ${escapeHtml(msg.resultSummary)}` : '';
      return `
        <div style="margin-bottom:6px; display:flex;">
          <div style="background:var(--bg-color); padding:5px 14px; border-radius:20px; font-size:0.82rem; color:var(--text-muted); border:1px solid var(--border-color); display:flex; align-items:center; gap:6px;">
            <span>${statusIcon}</span>
            <span>${escapeHtml(msg.stepLabel || msg.tool)}</span>
            ${summary ? `<span style="opacity:0.65;">${summary}</span>` : ''}
          </div>
        </div>
      `;
    }

    // ── Ask user — inline clarification input ────────────────────────────────
    if (msg.role === 'ask_user') {
      return `
        <div style="margin-bottom:16px; display:flex;">
          <div style="background:var(--bg-color); padding:12px 16px; border-radius:16px 16px 16px 4px; max-width:85%; border:1px solid var(--border-color);">
            <div style="margin-bottom:10px; font-size:0.95rem;">${escapeHtml(msg.question)}</div>
            ${!msg.answered ? `
              <div style="display:flex; gap:8px;">
                <input type="text" class="form-input" id="aiFollowupInput_${idx}" placeholder="Type your answer…" style="flex:1;" onkeydown="if(event.key==='Enter') window.sendAiFollowup(${idx})">
                <button class="btn btn-primary btn-sm" onclick="window.sendAiFollowup(${idx})">Send</button>
              </div>
            ` : `<div class="muted" style="font-size:0.82rem;">Answered ✓</div>`}
          </div>
        </div>
      `;
    }

    if (msg.role === 'assistant') {
      return `
        <div style="margin-bottom:16px; display:flex;">
          <div style="background:var(--bg-color); padding:12px 16px; border-radius:16px 16px 16px 4px; max-width:85%; border:1px solid var(--border-color);">
            <div class="markdown-content">${msg.isHtml ? msg.content : renderMarkdown(msg.content)}</div>
          </div>
        </div>
      `;
    }
    if (msg.role === 'action') {
      const actionLabel = {
        'announcement': 'Announcement',
        'announcement_update': 'Announcement',
        'announcement_delete': 'Announcement',
        'announcement_publish': 'Announcement',
        'announcement_pin': 'Announcement',
        'quiz': 'Quiz',
        'quiz_update': 'Quiz',
        'quiz_delete': 'Quiz',
        'quiz_from_bank': 'Quiz/Exam',
        'assignment': 'Assignment',
        'assignment_update': 'Assignment',
        'assignment_delete': 'Assignment',
        'module': 'Module',
        'module_update': 'Module',
        'module_visibility': 'Module',
        'module_add_item': 'Module Item',
        'module_remove_item': 'Module Item',
        'module_move_item': 'Module Item',
        'file_rename': 'File',
        'file_folder': 'File',
        'file_visibility': 'File',
        'question_bank_create': 'Question Bank',
        'question_bank_update': 'Question Bank',
        'question_bank_add_questions': 'Question Bank',
        'question_bank_delete': 'Question Bank',
        'question_delete_from_bank': 'Question',
        'start_here_update': 'Start Here Message',
        'invite_create': 'Invitation',
        'invite_revoke': 'Invitation',
        'person_remove': 'Person',
        'course_visibility': 'Course Visibility',
        'calendar_event_create': 'Calendar Event',
        'pipeline': 'Automation Pipeline'
      }[msg.actionType] || 'Content';

      const actionVerb = {
        'announcement': 'Create',
        'announcement_update': 'Update',
        'announcement_delete': 'Delete',
        'announcement_publish': 'Publish',
        'announcement_pin': msg.data?.pinned === false ? 'Unpin' : 'Pin',
        'quiz': 'Create',
        'quiz_update': 'Update',
        'quiz_delete': 'Delete',
        'quiz_from_bank': 'Create',
        'assignment': 'Create',
        'assignment_update': 'Update',
        'assignment_delete': 'Delete',
        'module': 'Create',
        'module_update': 'Rename',
        'module_visibility': msg.data?.hidden ? 'Hide' : 'Show',
        'module_add_item': 'Add to',
        'module_remove_item': 'Remove from',
        'module_move_item': 'Move to',
        'file_rename': 'Rename',
        'file_folder': 'Set Folder',
        'file_visibility': msg.data?.hidden ? 'Hide' : 'Show',
        'question_bank_create': 'Create',
        'question_bank_update': 'Update',
        'question_bank_add_questions': 'Add to',
        'question_bank_delete': 'Delete',
        'question_delete_from_bank': 'Delete from Bank',
        'start_here_update': 'Update',
        'invite_create': 'Send',
        'invite_revoke': 'Revoke',
        'person_remove': 'Remove',
        'course_visibility': msg.data?.visible === false ? 'Hide' : 'Show',
        'calendar_event_create': 'Add',
        'pipeline': 'Run'
      }[msg.actionType] || 'Run';

      return `
        <div style="margin-bottom:16px; display:flex;">
          <div style="background:var(--primary-light); padding:16px; border-radius:16px 16px 16px 4px; max-width:90%; border:1px solid var(--primary);">
            <div style="font-weight:600; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.1rem;">📝</span> ${actionVerb} ${actionLabel}
            </div>
            ${!msg.confirmed && !msg.rejected ? renderActionPreview(msg, idx) : ''}
            ${msg.confirmed ? `
              <div style="color:var(--success); font-weight:500;">✓ Completed successfully</div>
            ` : msg.rejected ? `
              <div style="color:var(--text-muted);">✗ Cancelled</div>
            ` : isLatest ? `
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
                <button class="btn btn-primary btn-sm" onclick="window.confirmAiAction(${idx}, false)">${actionVerb}${['Create','Update'].includes(actionVerb) ? ' (Draft)' : ''}</button>
                ${['announcement', 'assignment', 'quiz', 'quiz_from_bank', 'question_bank_create'].includes(msg.actionType) ? `
                  <button class="btn btn-primary btn-sm" onclick="window.confirmAiAction(${idx}, true)">${actionVerb === 'Create' ? 'Create and Publish' : 'Save and Publish'}</button>
                ` : ''}
                <button class="btn btn-secondary btn-sm" onclick="window.rejectAiAction(${idx})">Cancel</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
    return '';
  }).join('');

  setHTML('aiThread', html || '<div class="muted" style="padding:20px; text-align:center;">Ask me anything about your course, or say "create an announcement about..." or "create a quiz on..."</div>');
  scrollAiThreadToBottom();
}

/**
 * Return a human-readable description of a single pipeline step.
 */
function describeStep(step) {
  const a = step.action || '';
  const title = step.title || step.name || '';
  const module = step.moduleName || '';
  const bank = step.bankName || '';
  switch (a) {
    case 'create_assignment':
      return `Create assignment: "${title}"${step.assignmentType ? ` (${step.assignmentType})` : ''}`;
    case 'update_assignment':
      return `Update assignment: "${title}"`;
    case 'delete_assignment':
      return `Delete assignment: "${title}"`;
    case 'create_quiz_from_bank':
      return `Create quiz: "${title}"${bank ? ` from bank "${bank}"` : ''}`;
    case 'create_question_bank':
      return `Create question bank: "${title}"${step.questions ? ` (${step.questions.length} questions)` : ''}`;
    case 'add_questions_to_bank':
      return `Add questions to bank: "${bank || title}"`;
    case 'delete_question_bank':
      return `Delete question bank: "${bank || title}"`;
    case 'create_announcement':
      return `Create announcement: "${title}"`;
    case 'update_announcement':
      return `Update announcement: "${title}"`;
    case 'delete_announcement':
      return `Delete announcement: "${title}"`;
    case 'create_module':
      return `Create module: "${title}"`;
    case 'update_module':
      return `Rename module: "${step.moduleName || title}"${step.name ? ` → "${step.name}"` : ''}`;
    case 'set_module_visibility':
      return `${step.hidden ? 'Hide' : 'Show'} module: "${module || title}"`;
    case 'add_to_module':
      return `Add "${step.itemTitle || title}" to module: "${module}"`;
    case 'remove_from_module':
      return `Remove "${step.itemTitle || title}" from module: "${module}"`;
    case 'move_to_module':
      return `Move item to module: "${step.toModuleId || ''}"`;
    case 'invite_person':
      return `Invite: ${step.email || title}${step.role ? ` as ${step.role}` : ''}`;
    case 'revoke_invite':
      return `Revoke invite: ${step.email || title}`;
    case 'remove_person':
      return `Remove person: ${step.name || step.email || title}`;
    case 'create_calendar_event':
      return `Add calendar event: "${title}"${step.eventDate ? ` on ${new Date(step.eventDate).toLocaleDateString()}` : ''}`;
    case 'set_assignment_visibility':
      return `${step.hidden ? 'Hide' : 'Show'} assignment: "${step.assignmentTitle || title}"`;
    case 'set_course_visibility':
      return `${step.visible ? 'Show' : 'Hide'} course from students`;
    case 'update_start_here':
      return `Update Start Here page`;
    case 'create_group_set':
      return `Create group set: "${title}"${step.groupCount ? ` (${step.groupCount} groups)` : ''}`;
    case 'delete_group_set':
      return `Delete group set: "${step.name || title}"`;
    case 'auto_assign_groups':
      return `Auto-assign students to: "${step.groupSetName || title}"`;
    case 'send_message':
      return `Send message${step.subject ? `: "${step.subject}"` : ''}`;
    default:
      return title ? `${a.replace(/_/g, ' ')}: "${title}"` : a.replace(/_/g, ' ');
  }
}

/**
 * Render preview for an action — all fields are editable
 */
function renderActionPreview(msg, idx) {
  const d = msg.data;

  // Helper: convert ISO date string to datetime-local input value
  function toDatetimeLocal(iso) {
    if (!iso) return '';
    try {
      const dt = new Date(iso);
      // Adjust for local timezone
      const offset = dt.getTimezoneOffset() * 60000;
      return new Date(dt.getTime() - offset).toISOString().slice(0, 16);
    } catch { return ''; }
  }

  // Helper: row of two columns
  function twoCol(a, b) {
    return `<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">${a}${b}</div>`;
  }

  function field(label, inputHtml, mb = 12) {
    return `<div class="form-group" style="margin-bottom:${mb}px;"><label class="form-label" style="font-size:0.85rem;">${label}</label>${inputHtml}</div>`;
  }

  function textInput(fieldName, val) {
    return `<input type="text" class="form-input" data-ai-idx="${idx}" data-ai-field="${fieldName}" value="${escapeHtml(val || '')}" oninput="window.updateAiActionField(${idx}, '${fieldName}', this.value)">`;
  }

  function textarea(fieldName, val, rows = 3) {
    return `<textarea class="form-textarea" rows="${rows}" data-ai-idx="${idx}" data-ai-field="${fieldName}" oninput="window.updateAiActionField(${idx}, '${fieldName}', this.value)">${escapeHtml(val || '')}</textarea>`;
  }

  function numberInput(fieldName, val, min = 0, max = 9999) {
    return `<input type="number" class="form-input" data-ai-idx="${idx}" data-ai-field="${fieldName}" value="${val !== null && val !== undefined ? val : ''}" min="${min}" max="${max}" oninput="window.updateAiActionField(${idx}, '${fieldName}', Number(this.value))">`;
  }

  function datetimeInput(fieldName, val) {
    return `<input type="datetime-local" class="form-input" data-ai-idx="${idx}" data-ai-field="${fieldName}" value="${toDatetimeLocal(val)}" onchange="window.updateAiActionField(${idx}, '${fieldName}', new Date(this.value).toISOString())">`;
  }

  function selectInput(fieldName, val, options) {
    const opts = options.map(([v, l]) => `<option value="${v}" ${val === v ? 'selected' : ''}>${l}</option>`).join('');
    return `<select class="form-input" data-ai-idx="${idx}" data-ai-field="${fieldName}" onchange="window.updateAiActionField(${idx}, '${fieldName}', this.value)">${opts}</select>`;
  }

  function checkboxInput(fieldName, checked, label) {
    return `<label style="display:flex; align-items:center; gap:8px; font-size:0.9rem; cursor:pointer;">
      <input type="checkbox" ${checked ? 'checked' : ''} onchange="window.updateAiActionField(${idx}, '${fieldName}', this.checked)"> ${label}
    </label>`;
  }

  function lateSection(allowLate, lateDeduction) {
    return `
      <div style="margin-bottom:12px;">${checkboxInput('allowLateSubmissions', allowLate, 'Allow late submissions')}</div>
      ${allowLate ? `<div style="margin-bottom:12px;">
        ${field('Late penalty (% per day)', numberInput('lateDeduction', lateDeduction, 0, 100), 0)}
      </div>` : ''}
    `;
  }

  // ─── ANNOUNCEMENT (create) ───────────────────────────────────────────────
  if (msg.actionType === 'announcement') {
    return `
      ${field('Title', textInput('title', d.title))}
      ${field('Content', textarea('content', d.content, 5))}
      <div style="margin-bottom:4px;">${checkboxInput('pinned', d.pinned, 'Pin to top of announcements')}</div>
    `;
  }

  // ─── ANNOUNCEMENT (update) — only show fields the AI actually changed ────
  if (msg.actionType === 'announcement_update') {
    const ann = (appData.announcements || []).find(a => a.id === d.id);
    let html = `<div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Editing: ${escapeHtml(ann?.title || d.id || '')}</div>`;
    if ('title' in d) html += field('Title', textInput('title', d.title));
    if ('content' in d) html += field('Content', textarea('content', d.content, 5));
    if ('pinned' in d) html += `<div style="margin-bottom:4px;">${checkboxInput('pinned', d.pinned, 'Pinned')}</div>`;
    if ('hidden' in d) html += `<div style="margin-top:4px;">${checkboxInput('hidden', d.hidden, 'Hidden from students')}</div>`;
    return html;
  }

  // ─── ANNOUNCEMENT simple ops ─────────────────────────────────────────────
  if (msg.actionType === 'announcement_delete') {
    const ann = (appData.announcements || []).find(a => a.id === d.id);
    return `<div class="muted" style="font-size:0.9rem;">Delete announcement: <strong>${escapeHtml(ann?.title || d.id || '')}</strong></div>`;
  }
  if (msg.actionType === 'announcement_publish') {
    const ann = (appData.announcements || []).find(a => a.id === d.id);
    return `<div class="muted" style="font-size:0.9rem;">Publish announcement: <strong>${escapeHtml(ann?.title || d.id || '')}</strong></div>`;
  }
  if (msg.actionType === 'announcement_pin') {
    const ann = (appData.announcements || []).find(a => a.id === d.id);
    return `<div class="muted" style="font-size:0.9rem;">${d.pinned === false ? 'Unpin' : 'Pin'} announcement: <strong>${escapeHtml(ann?.title || d.id || '')}</strong></div>`;
  }

  // ─── QUIZ (update) — only show fields the AI actually changed ────────────
  if (msg.actionType === 'quiz_update') {
    const quiz = (appData.quizzes || []).find(q => q.id === d.id);
    let html = `<div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Editing: ${escapeHtml(quiz?.title || d.id || '')}</div>`;
    if ('title' in d) html += field('Title', textInput('title', d.title));
    if ('description' in d) html += field('Description', textarea('description', d.description, 2));
    if ('dueDate' in d) html += field('Due Date', datetimeInput('dueDate', d.dueDate));
    if ('status' in d) html += field('Status', selectInput('status', d.status, [['draft','Draft'],['published','Published'],['closed','Closed']]));
    if ('timeLimit' in d) html += field('Time Limit (min)', numberInput('timeLimit', d.timeLimit, 0, 600));
    if ('attempts' in d) html += field('Attempts', numberInput('attempts', d.attempts, 1, 99));
    if ('randomizeQuestions' in d) html += `<div>${checkboxInput('randomizeQuestions', d.randomizeQuestions, 'Randomize question order')}</div>`;
    return html;
  }

  // ─── QUIZ (delete) ───────────────────────────────────────────────────────
  if (msg.actionType === 'quiz_delete') {
    const quiz = (appData.quizzes || []).find(q => q.id === d.id);
    return `<div class="muted" style="font-size:0.9rem;">Delete quiz: <strong>${escapeHtml(quiz?.title || d.id || '')}</strong></div>`;
  }

  // ─── QUIZ FROM BANK ───────────────────────────────────────────────────────
  if (msg.actionType === 'quiz_from_bank') {
    const banks = (appData.questionBanks || []).filter(qb => qb.courseId === activeCourseId);
    const bankOptions = banks.map(b => [b.id, `${b.name} (${b.questions?.length || 0} questions)`]);
    return `
      ${field('Title', textInput('title', d.title))}
      ${field('Description', textarea('description', d.description, 2))}
      ${field('Question Bank', banks.length
        ? selectInput('questionBankId', d.questionBankId || '', bankOptions)
        : `<div class="muted">No question banks available — create one first.</div>`
      )}
      ${twoCol(
        field('Number of Questions (0 = all)', numberInput('numQuestions', d.numQuestions ?? 0, 0, 999), 0),
        field('Points', numberInput('points', d.points ?? 100, 0, 9999), 0)
      )}
      ${twoCol(
        field('Due Date', datetimeInput('dueDate', d.dueDate), 0),
        field('Time Limit (min)', numberInput('timeLimit', d.timeLimit ?? 30, 0, 600), 0)
      )}
      ${twoCol(
        field('Attempts', numberInput('attempts', d.attempts ?? 1, 1, 99), 0),
        field('Status', selectInput('status', d.status || 'draft', [['draft','Draft'],['published','Published']]), 0)
      )}
      ${twoCol(
        field('Category', selectInput('category', d.category || 'quiz', [['quiz','Quiz'],['exam','Exam']]), 0),
        field('Late Penalty (%/day)', numberInput('lateDeduction', d.lateDeduction ?? 10, 0, 100), 0)
      )}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:4px;">
        <div>${checkboxInput('randomizeQuestions', d.randomizeQuestions, 'Randomize question order')}</div>
        <div>${checkboxInput('randomizeAnswers', d.randomizeAnswers !== false, 'Randomize answer options')}</div>
      </div>
      <div>${checkboxInput('allowLateSubmissions', d.allowLateSubmissions !== false, 'Allow late submissions')}</div>
    `;
  }

  // ─── ASSIGNMENT (create) — CC 1.4 aligned ────────────────────────────────
  if (msg.actionType === 'assignment') {
    return `
      ${field('Title', textInput('title', d.title))}
      ${field('Description / Prompt', textarea('description', d.description, 4))}
      ${twoCol(
        field('Assignment Type', selectInput('assignmentType', d.assignmentType || 'essay', [
          ['essay','Essay / Free Text'],['quiz','Quiz / Exam'],['no_submission','No Submission']
        ]), 0),
        field('Grading Type', selectInput('gradingType', d.gradingType || 'points', [
          ['points','Points'],['complete_incomplete','Complete / Incomplete'],['letter_grade','Letter Grade']
        ]), 0)
      )}
      ${twoCol(
        field('Points', numberInput('points', d.points ?? 100, 0, 9999), 0),
        field('Due Date', datetimeInput('dueDate', d.dueDate), 0)
      )}
      ${twoCol(
        field('Status', selectInput('status', d.status || 'draft', [['draft','Draft'],['published','Published']]), 0),
        field('Submission Attempts (blank = unlimited)', numberInput('submissionAttempts', d.submissionAttempts ?? '', 1, 99), 0)
      )}
      ${lateSection(d.allowLateSubmissions, d.lateDeduction ?? 10)}
      <div style="margin-bottom:12px;">${checkboxInput('allowResubmission', d.allowResubmission, 'Allow resubmission')}</div>
      <div style="margin-bottom:12px;">${checkboxInput('isGroupAssignment', d.isGroupAssignment, 'Group Assignment')}</div>
      ${d.isGroupAssignment ? (() => {
        const groupSets = (appData.groupSets || []).filter(gs => gs.courseId === activeCourseId);
        const gsOptions = groupSets.map(gs => [gs.id, gs.name]);
        return `
          ${field('Group Set', gsOptions.length ? selectInput('groupSetId', d.groupSetId || '', gsOptions) : '<div class="muted">No group sets — create one first</div>')}
          ${field('Grading Mode', selectInput('groupGradingMode', d.groupGradingMode || 'per_group', [['per_group','One grade per group'],['individual','Individual grades']]))}
        `;
      })() : ''}
    `;
  }

  // ─── ASSIGNMENT (update) — only show fields the AI actually changed ────────
  if (msg.actionType === 'assignment_update') {
    const a = (appData.assignments || []).find(a => a.id === d.id);
    let html = `<div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Editing: ${escapeHtml(a?.title || d.id || '')}</div>`;
    if ('title' in d) html += field('Title', textInput('title', d.title));
    if ('description' in d) html += field('Description', textarea('description', d.description, 3));
    if ('assignmentType' in d) html += field('Assignment Type', selectInput('assignmentType', d.assignmentType, [
      ['essay','Essay / Free Text'],['quiz','Quiz / Exam'],['no_submission','No Submission']
    ]));
    if ('gradingType' in d) html += field('Grading Type', selectInput('gradingType', d.gradingType, [
      ['points','Points'],['complete_incomplete','Complete / Incomplete'],['letter_grade','Letter Grade']
    ]));
    if ('points' in d) html += field('Points', numberInput('points', d.points, 0, 9999));
    if ('dueDate' in d) html += field('Due Date', datetimeInput('dueDate', d.dueDate));
    if ('status' in d) html += field('Status', selectInput('status', d.status, [['draft','Draft'],['published','Published'],['closed','Closed']]));
    if ('allowLateSubmissions' in d) html += `<div style="margin-bottom:12px;">${checkboxInput('allowLateSubmissions', d.allowLateSubmissions, 'Allow late submissions')}</div>`;
    if ('lateDeduction' in d) html += field('Late penalty (%/day)', numberInput('lateDeduction', d.lateDeduction, 0, 100));
    if ('allowResubmission' in d) html += `<div>${checkboxInput('allowResubmission', d.allowResubmission, 'Allow resubmission')}</div>`;
    if ('submissionAttempts' in d) html += field('Submission Attempts (blank=unlimited)', numberInput('submissionAttempts', d.submissionAttempts, 1, 99));
    if ('isGroupAssignment' in d) {
      html += `<div style="margin-bottom:12px;">${checkboxInput('isGroupAssignment', d.isGroupAssignment, 'Group Assignment')}</div>`;
      if (d.isGroupAssignment) {
        const groupSets = (appData.groupSets || []).filter(gs => gs.courseId === activeCourseId);
        const gsOptions = groupSets.map(gs => [gs.id, gs.name]);
        if ('groupSetId' in d || gsOptions.length) html += field('Group Set', gsOptions.length ? selectInput('groupSetId', d.groupSetId || '', gsOptions) : '<div class="muted">No group sets</div>');
        if ('groupGradingMode' in d) html += field('Grading Mode', selectInput('groupGradingMode', d.groupGradingMode || 'per_group', [['per_group','One grade per group'],['individual','Individual grades']]));
      }
    }
    return html;
  }

  // ─── ASSIGNMENT (delete) ─────────────────────────────────────────────────
  if (msg.actionType === 'assignment_delete') {
    const a = (appData.assignments || []).find(a => a.id === d.id);
    return `<div class="muted" style="font-size:0.9rem;">Delete assignment: <strong>${escapeHtml(a?.title || d.id || '')}</strong></div>`;
  }

  // ─── MODULE (create) ─────────────────────────────────────────────────────
  if (msg.actionType === 'module') {
    return field('Module Name', textInput('name', d.name), 0);
  }

  // ─── MODULE ADD ITEM ─────────────────────────────────────────────────────
  if (msg.actionType === 'module_add_item') {
    const modules = (appData.modules || []).filter(m => m.courseId === activeCourseId);
    const moduleOptions = modules.map(m => [m.id, m.name]);
    const typeOptions = [['assignment','Assignment'],['quiz','Quiz'],['file','File'],['external_link','External Link']];
    const currentType = d.itemType || 'assignment';
    let itemOptions = [];
    if (currentType === 'assignment') {
      itemOptions = (appData.assignments || []).filter(a => a.courseId === activeCourseId).map(a => [a.id, a.title]);
    } else if (currentType === 'quiz') {
      itemOptions = (appData.quizzes || []).filter(q => q.courseId === activeCourseId).map(q => [q.id, q.title]);
    } else if (currentType === 'file') {
      itemOptions = (appData.files || []).filter(f => f.courseId === activeCourseId).map(f => [f.id, f.name]);
    }
    return `
      ${field('Module', modules.length ? selectInput('moduleId', d.moduleId || '', moduleOptions) : '<div class="muted">No modules available</div>')}
      ${field('Item Type', `<select class="form-input" onchange="window.updateAiActionField(${idx}, 'itemType', this.value); window.renderAiThread();">${typeOptions.map(([v,l]) => `<option value="${v}" ${currentType===v?'selected':''}>${l}</option>`).join('')}</select>`)}
      ${currentType === 'external_link'
        ? field('URL', textInput('url', d.url)) + field('Link Title', textInput('itemTitle', d.itemTitle))
        : field('Item', itemOptions.length ? selectInput('itemId', d.itemId || '', itemOptions) : `<div class="muted">No ${currentType}s available</div>`)
      }
    `;
  }

  // ─── MODULE REMOVE ITEM ──────────────────────────────────────────────────
  if (msg.actionType === 'module_remove_item') {
    const mod = (appData.modules || []).find(m => m.id === d.moduleId);
    return `
      <div class="muted" style="font-size:0.9rem;">Remove <strong>${escapeHtml(d.itemTitle || d.itemId || '')}</strong> from module <strong>${escapeHtml(d.moduleName || mod?.name || '')}</strong></div>
    `;
  }

  // ─── MODULE MOVE ITEM ────────────────────────────────────────────────────
  if (msg.actionType === 'module_move_item') {
    const modules = (appData.modules || []).filter(m => m.courseId === activeCourseId);
    const destOptions = modules.filter(m => m.id !== d.fromModuleId).map(m => [m.id, m.name]);
    return `
      <div class="muted" style="font-size:0.9rem; margin-bottom:12px;">
        Move <strong>${escapeHtml(d.itemTitle || '')}</strong> from <em>${escapeHtml(d.fromModuleName || '')}</em>
      </div>
      ${field('Destination Module', destOptions.length ? selectInput('toModuleId', d.toModuleId || '', destOptions) : '<div class="muted">No other modules available</div>')}
    `;
  }

  // ─── INVITE CREATE ───────────────────────────────────────────────────────
  if (msg.actionType === 'invite_create') {
    const emailsVal = Array.isArray(d.emails) ? d.emails.join(', ') : '';
    return `
      ${field('Email address(es)', `<input type="text" class="form-input" data-ai-idx="${idx}" data-ai-field="__emails__" value="${escapeHtml(emailsVal)}" placeholder="email1@example.com, email2@example.com" oninput="window.updateAiActionField(${idx}, 'emails', this.value.split(',').map(s=>s.trim()).filter(Boolean))">`)}
      ${field('Role', selectInput('role', d.role || 'student', [['student','Student'],['ta','Teaching Assistant'],['instructor','Instructor']]), 0)}
    `;
  }

  // ─── INVITE REVOKE ───────────────────────────────────────────────────────
  if (msg.actionType === 'invite_revoke') {
    const inv = (appData.invites || []).find(i => i.id === (d.inviteId || d.id));
    const displayEmail = d.email || inv?.email || d.inviteId || '';
    const displayRole = inv?.role || d.role || '';
    const roleLabel = displayRole ? ` (${displayRole === 'ta' ? 'Teaching Assistant' : displayRole.charAt(0).toUpperCase() + displayRole.slice(1)})` : '';
    return `
      <div class="muted" style="font-size:0.9rem;">Revoke invitation for: <strong>${escapeHtml(displayEmail)}</strong>${escapeHtml(roleLabel)}</div>
    `;
  }

  // ─── PERSON REMOVE ───────────────────────────────────────────────────────
  if (msg.actionType === 'person_remove') {
    const user = (appData.users || []).find(u => u.id === d.userId);
    const enrollment = (appData.enrollments || []).find(e => e.userId === d.userId && e.courseId === activeCourseId);
    const displayName = d.name || user?.name || d.email || user?.email || d.userId || '';
    const displayEmail = d.email || user?.email || '';
    const displayRole = d.role || enrollment?.role || '';
    const roleLabel = displayRole ? ` (${displayRole === 'ta' ? 'Teaching Assistant' : displayRole.charAt(0).toUpperCase() + displayRole.slice(1)})` : '';
    return `
      <div class="muted" style="font-size:0.9rem;">Remove <strong>${escapeHtml(displayName)}</strong>${displayEmail && displayEmail !== displayName ? ` &lt;${escapeHtml(displayEmail)}&gt;` : ''}${escapeHtml(roleLabel)} from this course.</div>
      <div style="margin-top:8px; font-size:0.82rem; color:var(--danger, #c00);">⚠️ This will unenroll them immediately. Their submissions and grades are kept.</div>
    `;
  }

  // ─── COURSE VISIBILITY ───────────────────────────────────────────────────
  if (msg.actionType === 'course_visibility') {
    const course = (appData.courses || []).find(c => c.id === (d.courseId || activeCourseId));
    return `
      <div class="muted" style="font-size:0.9rem; margin-bottom:12px;">Course: <strong>${escapeHtml(course?.name || '')}</strong></div>
      <div>${checkboxInput('visible', d.visible !== false, 'Visible to students')}</div>
    `;
  }

  // ─── QUESTION BANK (create) ──────────────────────────────────────────────
  if (msg.actionType === 'question_bank_create') {
    const qs = d.questions || [];
    const qHtml = qs.map((q, i) => {
      const opts = (q.options || []).map((opt, oi) => {
        const isCorrect = q.correctAnswer === oi || q.correctAnswer === opt || q.correctAnswer === String(oi);
        return `<div style="padding:2px 0; padding-left:16px; color:${isCorrect ? 'var(--success, #059669)' : 'var(--text-muted)'};">${isCorrect ? '✓' : '✗'} ${escapeHtml(String(opt))}</div>`;
      }).join('');
      return `
        <div style="padding:8px 0; border-bottom:1px solid var(--border-light);">
          <div style="font-size:0.85rem; font-weight:500;">${i + 1}. ${escapeHtml(q.prompt || q.question || '')}</div>
          ${opts}
          ${q.correctAnswer !== undefined && !q.options?.length ? `<div style="padding-left:16px; color:var(--success, #059669); font-size:0.82rem;">Answer: ${escapeHtml(String(q.correctAnswer))}</div>` : ''}
        </div>`;
    }).join('');
    return `
      ${field('Bank Name', textInput('name', d.name))}
      ${field('Description', textarea('description', d.description, 2))}
      <div style="font-size:0.82rem; font-weight:600; margin-bottom:6px; color:var(--text-muted);">${qs.length} QUESTION${qs.length !== 1 ? 'S' : ''}</div>
      ${qs.length ? `<div style="max-height:260px; overflow-y:auto; border:1px solid var(--border-light); border-radius:var(--radius); padding:0 10px; font-size:0.83rem;">${qHtml}</div>` : ''}
    `;
  }

  // ─── QUESTION BANK (update metadata) ─────────────────────────────────────
  if (msg.actionType === 'question_bank_update') {
    const bank = (appData.questionBanks || []).find(b => b.id === d.id);
    let html = `<div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Editing: ${escapeHtml(d.bankName || bank?.name || d.id || '')}</div>`;
    if ('name' in d) html += field('Bank Name', textInput('name', d.name));
    if ('description' in d) html += field('Description', textarea('description', d.description, 2));
    return html;
  }

  // ─── QUESTION BANK (add questions) ───────────────────────────────────────
  if (msg.actionType === 'question_bank_add_questions') {
    const bank = (appData.questionBanks || []).find(b => b.id === d.id);
    return `
      <div class="muted" style="font-size:0.9rem; margin-bottom:8px;">Adding to: <strong>${escapeHtml(d.bankName || bank?.name || '')}</strong></div>
      <div class="muted" style="font-size:0.85rem;">${(d.questions || []).length} new question${(d.questions || []).length !== 1 ? 's' : ''} to append</div>
    `;
  }

  // ─── QUESTION BANK (delete) ───────────────────────────────────────────────
  if (msg.actionType === 'question_bank_delete') {
    const bank = (appData.questionBanks || []).find(b => b.id === d.id);
    const qCount = bank?.questions?.length || 0;
    return `
      <div class="muted" style="font-size:0.9rem;">Delete question bank: <strong>${escapeHtml(d.bankName || bank?.name || d.id || '')}</strong></div>
      ${qCount > 0 ? `<div style="margin-top:6px; font-size:0.82rem; color:var(--danger, #c00);">⚠️ This will permanently delete ${qCount} question${qCount !== 1 ? 's' : ''}.</div>` : ''}
    `;
  }

  // ─── QUESTION DELETE FROM BANK ────────────────────────────────────────────
  if (msg.actionType === 'question_delete_from_bank') {
    const bank = (appData.questionBanks || []).find(b => b.id === d.bankId);
    return `
      <div class="muted" style="font-size:0.9rem;">Delete question from bank: <strong>${escapeHtml(bank?.name || d.bankId || '')}</strong></div>
      <div style="margin-top:8px; font-size:0.9rem; padding:8px; background:var(--bg-secondary, #f5f5f5); border-radius:6px;">${escapeHtml(d.questionPrompt || d.questionId || '')}</div>
    `;
  }

  // ─── MODULE (update/rename) ───────────────────────────────────────────────
  if (msg.actionType === 'module_update') {
    return `
      <div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Renaming module: <em>${escapeHtml(d.moduleName || '')}</em></div>
      ${field('New Name', textInput('name', d.name), 0)}
    `;
  }

  // ─── MODULE VISIBILITY ────────────────────────────────────────────────────
  if (msg.actionType === 'module_visibility') {
    return `
      <div class="muted" style="font-size:0.9rem; margin-bottom:10px;">Module: <strong>${escapeHtml(d.moduleName || d.moduleId || '')}</strong></div>
      <div>${checkboxInput('hidden', d.hidden, 'Hidden from students')}</div>
    `;
  }

  // ─── FILE RENAME ─────────────────────────────────────────────────────────
  if (msg.actionType === 'file_rename') {
    return `
      <div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Current name: <em>${escapeHtml(d.oldName || '')}</em></div>
      ${field('New Name', textInput('newName', d.newName), 0)}
    `;
  }

  // ─── FILE VISIBILITY ─────────────────────────────────────────────────────
  if (msg.actionType === 'file_visibility') {
    return `
      <div class="muted" style="font-size:0.9rem; margin-bottom:10px;">File: <strong>${escapeHtml(d.fileName || d.fileId || '')}</strong></div>
      <div>${checkboxInput('hidden', d.hidden, 'Hidden from students')}</div>
    `;
  }

  // ─── FILE FOLDER ────────────────────────────────────────────────────────
  if (msg.actionType === 'file_folder') {
    return `
      <div class="muted" style="font-size:0.9rem; margin-bottom:10px;">File: <strong>${escapeHtml(d.fileName || d.fileId || '')}</strong></div>
      ${field('Folder', textInput('folder', d.folder || ''), 0)}
    `;
  }

  // ─── START HERE UPDATE ───────────────────────────────────────────────────
  if (msg.actionType === 'start_here_update') {
    return `
      ${field('Title', textInput('title', d.title))}
      ${field('Welcome Message', textarea('content', d.content, 5))}
    `;
  }

  // ─── CALENDAR EVENT CREATE ───────────────────────────────────────────────
  if (msg.actionType === 'calendar_event_create') {
    const dtLocal = toDatetimeLocal(d.eventDate); // "YYYY-MM-DDTHH:MM" or ""
    const datePart = dtLocal ? dtLocal.slice(0, 10) : '';
    const timePart = dtLocal ? dtLocal.slice(11, 16) : '14:00';
    const dateTimeInputs = `
      <div style="display:flex; gap:8px;">
        <input type="date" class="form-input" style="flex:1;" id="aiCalEvtDate_${idx}" value="${escapeHtml(datePart)}"
          onchange="(function(el){const t=document.getElementById('aiCalEvtTime_${idx}');window.updateAiActionField(${idx},'eventDate',new Date(el.value+'T'+(t?t.value:'14:00')+':00').toISOString());})(this)">
        <input type="time" class="form-input" style="width:130px;" id="aiCalEvtTime_${idx}" value="${escapeHtml(timePart)}" step="1800"
          onchange="(function(el){const d=document.getElementById('aiCalEvtDate_${idx}');window.updateAiActionField(${idx},'eventDate',new Date((d?d.value:'2000-01-01')+'T'+el.value+':00').toISOString());})(this)">
      </div>`;
    return `
      ${field('Title', textInput('title', d.title))}
      ${field('Date & Time', dateTimeInputs)}
      ${field('Event Type', selectInput('eventType', d.eventType || 'Event', [['Class','Class'],['Lecture','Special Lecture'],['Office Hours','Office Hours'],['Exam','Exam'],['Event','Other']]))}
      ${field('Description', textarea('description', d.description, 2))}
    `;
  }

  // ─── GROUP SET (create) ──────────────────────────────────────────────────
  if (msg.actionType === 'group_set_create') {
    return `
      ${field('Group Set Name', textInput('name', d.name))}
      ${field('Description', textInput('description', d.description || ''))}
      ${field('Number of Groups', numberInput('groupCount', d.groupCount || 4, 1, 50))}
    `;
  }

  // ─── GROUP SET (delete) ─────────────────────────────────────────────────
  if (msg.actionType === 'group_set_delete') {
    const gs = (appData.groupSets || []).find(s => s.id === d.id);
    const groupCount = (appData.courseGroups || []).filter(g => g.groupSetId === d.id).length;
    return `
      <div class="muted" style="font-size:0.9rem;">Delete group set: <strong>${escapeHtml(d.name || gs?.name || d.id || '')}</strong></div>
      ${groupCount > 0 ? `<div style="margin-top:6px; font-size:0.82rem; color:var(--danger, #c00);">This will permanently delete ${groupCount} group${groupCount !== 1 ? 's' : ''} and all member assignments.</div>` : ''}
    `;
  }

  // ─── GROUP AUTO-ASSIGN ──────────────────────────────────────────────────
  if (msg.actionType === 'group_auto_assign') {
    const gs = (appData.groupSets || []).find(s => s.id === d.groupSetId);
    const groups = (appData.courseGroups || []).filter(g => g.groupSetId === d.groupSetId);
    const assignedUserIds = new Set(groups.flatMap(g => (g.members || []).map(m => m.userId)));
    const unassignedCount = (appData.enrollments || [])
      .filter(e => e.courseId === activeCourseId && e.role === 'student' && !assignedUserIds.has(e.userId)).length;
    return `
      <div class="muted" style="font-size:0.9rem;">Auto-assign students to: <strong>${escapeHtml(d.groupSetName || gs?.name || '')}</strong></div>
      <div class="muted" style="font-size:0.85rem; margin-top:6px;">${groups.length} group${groups.length !== 1 ? 's' : ''} · ${unassignedCount} unassigned student${unassignedCount !== 1 ? 's' : ''}</div>
    `;
  }

  // ─── SEND MESSAGE ───────────────────────────────────────────────────────
  if (msg.actionType === 'send_message') {
    const recipientNames = (d.recipientIds || []).map(uid => {
      const u = (appData.users || []).find(u => u.id === uid);
      return u ? escapeHtml(u.name) : uid;
    }).join(', ');
    return `
      <div class="muted" style="font-size:0.85rem; margin-bottom:8px;">To: <strong>${recipientNames || '(none)'}</strong></div>
      ${d.subject ? field('Subject', textInput('subject', d.subject)) : ''}
      ${field('Message', textarea('message', d.message, 4))}
    `;
  }

  // ─── PIPELINE ────────────────────────────────────────────────────────────
  if (msg.actionType === 'pipeline') {
    const steps = Array.isArray(d.steps) ? d.steps : [];
    const stepsHtml = steps.map((step) => {
      return `<li style="margin-bottom:6px;">${escapeHtml(describeStep(step))}</li>`;
    }).join('');
    return `
      <div class="muted" style="font-size:0.9rem; margin-bottom:8px;">${steps.length} step${steps.length !== 1 ? 's' : ''}</div>
      <ol style="margin:0; padding-left:20px; font-size:0.9rem;">${stepsHtml}</ol>
    `;
  }

  return '';
}

/**
 * Scroll AI thread to bottom
 */
function scrollAiThreadToBottom() {
  setTimeout(() => {
    const thread = document.getElementById('aiThread');
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
      if (thread.parentElement) {
        thread.parentElement.scrollTop = thread.parentElement.scrollHeight;
      }
    }
  }, 50);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI VOICE RECORDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Toggle AI voice recording
 */
export function toggleAiRecording() {
  if (aiRecording) {
    stopAiRecording();
  } else {
    startAiRecording();
  }
}

/**
 * Start AI voice recording
 */
export async function startAiRecording() {
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

    const recordIcon = document.getElementById('aiRecordIcon');
    const recordText = document.getElementById('aiRecordText');
    const recordBtn = document.getElementById('aiRecordBtn');

    if (recordIcon) recordIcon.textContent = '⏹️';
    if (recordText) recordText.textContent = 'Stop';
    if (recordBtn) recordBtn.classList.add('recording');

    showToast('Recording...', 'info');

  } catch (err) {
    console.error('Recording error:', err);
    showToast('Could not access microphone: ' + err.message, 'error');
  }
}

/**
 * Stop AI voice recording
 */
export function stopAiRecording() {
  if (aiMediaRecorder && aiMediaRecorder.state === 'recording') {
    aiMediaRecorder.stop();
    aiRecording = false;

    const recordIcon = document.getElementById('aiRecordIcon');
    const recordText = document.getElementById('aiRecordText');
    const recordBtn = document.getElementById('aiRecordBtn');

    if (recordIcon) recordIcon.textContent = '🎤';
    if (recordText) recordText.textContent = 'Record';
    if (recordBtn) recordBtn.classList.remove('recording');

    showToast('Sending voice message...', 'info');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI GRADING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Draft a grade with AI assistance
 */
export async function draftGradeWithAI(submissionId, assignmentId) {
  const submission = appData.submissions.find(s => s.id === submissionId);
  const assignment = appData.assignments.find(a => a.id === assignmentId);

  if (!submission || !assignment) {
    showToast('Submission or assignment not found', 'error');
    return;
  }

  const rubric = assignment.rubric || null;
  const prompt = AI_PROMPTS.gradeSubmission(assignment, submission, rubric);

  try {
    showToast('Drafting grade with AI...', 'info');

    const contents = [{ parts: [{ text: prompt }] }];
    const data = await callGeminiAPI(contents, {
      responseMimeType: "application/json",
      temperature: AI_CONFIG.TEMPERATURE_GRADING
    });

    if (data.error) {
      throw new Error(data.error.message);
    }

    const text = data.candidates[0].content.parts[0].text;

    // Try to parse JSON from response
    let result;
    try {
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

    const scoreEl = document.getElementById('gradeScore');
    const feedbackEl = document.getElementById('gradeFeedback');

    if (scoreEl) scoreEl.value = result.score;
    if (feedbackEl) feedbackEl.value = result.feedback;

    showToast('AI draft ready! Review and edit as needed.', 'success');

  } catch (err) {
    console.error('AI grading error:', err);
    showToast('AI drafting failed: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI CONTENT CREATION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Open AI create modal
 */
export function openAiCreateModal(type = 'announcement', assignmentId = null) {
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

  const promptEl = document.getElementById('aiCreatePrompt');
  if (promptEl) promptEl.value = '';

  updateAiCreateType();
  renderAiDraftPreview();
  openModal('aiCreateModal');
}

/**
 * Update AI create type selection
 */
export function updateAiCreateType() {
  const typeSelect = document.getElementById('aiCreateType');
  if (typeSelect) aiDraftType = typeSelect.value;

  const rubricGroup = document.getElementById('aiRubricGroup');

  if (rubricGroup) rubricGroup.style.display = aiDraftType === 'rubric' ? 'block' : 'none';
}

/**
 * Generate AI draft for content creation
 */
export async function generateAiDraft() {
  const promptEl = document.getElementById('aiCreatePrompt');
  const prompt = promptEl?.value.trim();

  if (!prompt) {
    showToast('Add a prompt to guide the AI', 'error');
    return;
  }

  const course = activeCourseId && getCourseByIdCallback ? getCourseByIdCallback(activeCourseId) : null;
  let systemPrompt = '';

  if (aiDraftType === 'announcement') {
    systemPrompt = AI_PROMPTS.createAnnouncement;
  } else {
    const assignmentSelect = document.getElementById('aiRubricAssignment');
    const assignmentId = assignmentSelect?.value;
    if (!assignmentId) {
      showToast('Select an assignment for the rubric', 'error');
      return;
    }
    const assignment = appData.assignments.find(a => a.id === assignmentId);
    systemPrompt = AI_PROMPTS.createRubric(assignment ? assignment.points : 100);
  }

  const contextualPrompt = `
Course: ${course ? course.name : 'Unknown'}
Prompt: ${prompt}
${systemPrompt}
`;

  try {
    showToast('Generating draft with AI...', 'info');
    const contents = [{ parts: [{ text: contextualPrompt }] }];
    const data = await callGeminiAPI(contents, {
      responseMimeType: "application/json",
      temperature: AI_CONFIG.TEMPERATURE_CHAT
    });

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

/**
 * Parse AI JSON response
 */
export function parseAiJsonResponse(text) {
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

/**
 * Normalize AI draft response
 */
function normalizeAiDraft(draft, type) {
  if (!draft || typeof draft !== 'object') return draft;

  if (type === 'announcement') {
    return {
      title: typeof draft.title === 'string' ? draft.title : '',
      content: typeof draft.content === 'string' ? draft.content : ''
    };
  }


  if (type === 'rubric') {
    return {
      criteria: Array.isArray(draft.criteria) ? draft.criteria : []
    };
  }

  return draft;
}

/**
 * Render AI draft preview
 */
export function renderAiDraftPreview() {
  const preview = document.getElementById('aiDraftPreview');
  if (!preview) return;

  if (!aiDraft) {
    preview.innerHTML = '<div class="muted">Generate a draft to preview it here.</div>';
    return;
  }

  if (aiDraftType === 'announcement') {
    preview.innerHTML = `
      <div class="card">
        <div class="card-title">${escapeHtml(aiDraft.title || 'Untitled announcement')}</div>
        <div class="markdown-content">${renderMarkdown(aiDraft.content || '')}</div>
      </div>
    `;
    return;
  }

  if (aiDraftType === 'rubric') {
    const criteriaHtml = (aiDraft.criteria || []).map(c => `
      <div style="padding:8px; background:var(--bg-color); border-radius:var(--radius); margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between;">
          <span style="font-weight:500;">${escapeHtml(c.name)}</span>
          <span>${c.points} pts</span>
        </div>
        <div class="muted" style="font-size:0.85rem;">${escapeHtml(c.description || '')}</div>
      </div>
    `).join('');

    preview.innerHTML = `<div class="card">${criteriaHtml}</div>`;
  }
}

/**
 * Apply AI draft
 */
export function applyAiDraft() {
  if (!aiDraft) {
    showToast('No draft to apply', 'error');
    return;
  }

  if (aiDraftType === 'announcement') {
    // Pre-fill announcement modal
    const titleEl = document.getElementById('announcementTitle');
    const contentEl = document.getElementById('announcementContent');
    if (titleEl) titleEl.value = aiDraft.title || '';
    if (contentEl) contentEl.value = aiDraft.content || '';
    closeModal('aiCreateModal');
    openModal('announcementModal');
  } else if (aiDraftType === 'rubric') {
    // Store for rubric use
    window.aiRubricDraft = aiDraft;
    showToast('Rubric draft saved. Open assignment to apply.', 'success');
    closeModal('aiCreateModal');
  }
}

/**
 * Get current AI draft
 */
export function getAiDraft() {
  return aiDraft;
}

/**
 * Get current AI quiz draft
 */
export function getAiQuizDraft() {
  return aiQuizDraft;
}

/**
 * Set AI quiz draft
 */
export function setAiQuizDraft(draft) {
  aiQuizDraft = draft;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT GLOBAL FUNCTIONS FOR ONCLICK HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

// Make functions available globally for inline onclick handlers
if (typeof window !== 'undefined') {
  window.sendAiMessage = sendAiMessage;
  window.sendAiFollowup = sendAiFollowup;
  window.confirmAiAction = confirmAiAction;
  window.rejectAiAction = rejectAiAction;
  window.updateAiActionField = updateAiActionField;
  window.renderAiThread = renderAiThread;
  window.toggleAiRecording = toggleAiRecording;
  window.generateAiDraft = generateAiDraft;
  window.applyAiDraft = applyAiDraft;
  window.updateAiCreateType = updateAiCreateType;
  window.openAiCreateModal = openAiCreateModal;
}
