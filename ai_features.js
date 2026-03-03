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
  supabaseCreateAssignment, supabaseUpdateAssignment, supabaseDeleteAssignment,
  supabaseCreateModule, supabaseUpdateModule, supabaseCreateModuleItem, supabaseDeleteModuleItem,
  supabaseCreateInvite, supabaseDeleteInvite,
  supabaseDeleteEnrollment,
  supabaseUpdateCourse,
  supabaseUpdateFile,
  supabaseCreateQuestionBank, supabaseUpdateQuestionBank, supabaseDeleteQuestionBank,
  supabaseCreateCalendarEvent, supabaseUpdateCalendarEvent, supabaseDeleteCalendarEvent,
  supabaseDownloadFileBlob,
  supabaseCreateGroupSet, supabaseCreateCourseGroup, supabaseDeleteGroupSet,
  supabaseAddGroupMember,
  supabaseCreateMessage,
  supabaseSendDirectMessage,
  supabaseSendReplyMessage,
  supabaseGetCourseRecipients,
  supabaseCreateDiscussionThread,
  supabaseUpdateDiscussionThread,
  supabaseDeleteDiscussionThread,
  supabaseCreateDiscussionReply,
  supabaseNotifyCourseStudents
} from './database_interactions.js';
import { AI_PROMPTS, AI_CONFIG, AI_TOOL_REGISTRY } from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT MODE: read-only tools students may call (enforced in code, not prompt)
// ═══════════════════════════════════════════════════════════════════════════════
const STUDENT_TOOLS = [
  'list_assignments', 'list_files', 'list_modules',
  'list_announcements', 'list_discussion_threads', 'get_assignment',
  'get_file_content', 'get_grade_categories', 'get_grade_settings',
  'list_group_sets', 'get_group_set',
  'list_people', 'list_conversations', 'get_start_here'
];

// Actions students are allowed to perform (messaging only)
const STUDENT_ACTIONS = ['send_message', 'reply_message'];

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
let renderDiscussionCallback = null;
let renderFilesCallback = null;
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
  renderDiscussionCallback = deps.renderDiscussion;
  renderFilesCallback = deps.renderFiles;
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


function getUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  } catch {
    return 'local';
  }
}

function formatLocalDateTime(iso) {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleString();
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build context for AI assistant
 */
export function buildAiContext() {
  const tz = getUserTimeZone();
  let context = `Current date/time (local): ${new Date().toLocaleString()}\nTime zone: ${tz}\n\n`; 

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
      const questionBanks = (appData.questionBanks || []).filter(b => b.courseId === activeCourseId);
      const files         = (appData.files         || []).filter(f => f.courseId === activeCourseId && !f.isPlaceholder && (aiCtxIsStaff || !f.hidden));
      const modules       = (appData.modules       || []).filter(m => m.courseId === activeCourseId && (aiCtxIsStaff || !m.hidden));
      const announcements = (appData.announcements || []).filter(a => a.courseId === activeCourseId && (aiCtxIsStaff || !a.hidden));
      const enrolled      = (appData.enrollments   || []).filter(e => e.courseId === activeCourseId);
      const invites       = aiCtxIsStaff ? (appData.invites || []).filter(i => i.courseId === activeCourseId && i.status === 'pending') : [];
      const qTotal        = questionBanks.reduce((s, b) => s + (b.questions?.length || 0), 0);

      context += `\nCOURSE CONTENTS — call the relevant tool to get IDs, titles, and full content:\n`;
      context += `- assignments: ${assignments.length}\n`;
      context += `- question banks: ${questionBanks.length} (${qTotal} questions total)\n`;
      context += `- files: ${files.length}\n`;
      context += `- modules: ${modules.length}\n`;
      context += `- announcements: ${announcements.length}\n`;
      context += `- enrolled users: ${enrolled.length}${invites.length ? `, ${invites.length} pending invite${invites.length !== 1 ? 's' : ''}` : ''}\n`;

      const conversations = (appData.conversations || []).filter(c => c.courseId === activeCourseId);
      if (conversations.length > 0) {
        context += `- inbox conversations: ${conversations.length} (call list_conversations to read them)\n`;
      }
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
    delete_announcement: 'delete',
    create_quiz_from_bank: 'quiz_from_bank',
    create_assignment: 'assignment',
    update_assignment: 'assignment_update',
    delete_assignment: 'delete',
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
    delete_question_bank: 'delete',
    delete_question_from_bank: 'delete',
    update_start_here: 'start_here_update',
    create_invite: 'invite_create',
    revoke_invite: 'invite_revoke',
    set_course_visibility: 'course_visibility',
    create_calendar_event: 'calendar_event_create',
    update_calendar_event: 'calendar_event_update',
    delete_calendar_event: 'delete',
    create_discussion_thread: 'discussion_thread_create',
    update_discussion_thread: 'discussion_thread_update',
    delete_discussion_thread: 'delete',
    pin_discussion_thread: 'discussion_thread_pin',
    reply_discussion_thread: 'discussion_thread_reply',
    create_group_set: 'group_set_create',
    delete_group_set: 'delete',
    auto_assign_groups: 'group_auto_assign',
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

  if (op.groupSetId && Array.isArray(appData.groupSets)) {
    const gs = appData.groupSets.find(g => g.id === op.groupSetId && g.courseId === activeCourseId);
    if (!gs) {
      const byName = appData.groupSets.find(g => g.courseId === activeCourseId && g.name?.toLowerCase() === String(op.groupSetId).toLowerCase());
      if (byName) op.groupSetId = byName.id;
    }
  }

  return op;
}

/**
 * Resolve ${result_N.field} template references in a pipeline step.
 * The AI may emit references like "groupSetId": "${result_0.id}" meaning
 * "use the id from the result of step 0". This function replaces those
 * template strings with actual values from previous step results.
 */
function resolvePipelineStepRefs(step, results, allSteps) {
  const resolved = { ...step };
  for (const key of Object.keys(resolved)) {
    const val = resolved[key];
    if (typeof val !== 'string') continue;
    // Match patterns like ${result_0.id}, ${result_1.name}, etc.
    let replaced = val.replace(/\$\{result_(\d+)\.(\w+)\}/g, (match, idxStr, field) => {
      const rIdx = parseInt(idxStr, 10);
      if (rIdx < results.length && results[rIdx] && results[rIdx][field] !== undefined) {
        return results[rIdx][field];
      }
      return match; // leave unresolved if not available
    });
    // Also match ${result.action_name.field} — AI sometimes references by action name
    if (allSteps) {
      replaced = replaced.replace(/\$\{result\.(\w+)\.(\w+)\}/g, (match, actionName, field) => {
        const stepIdx = allSteps.findIndex(s => s.action === actionName);
        if (stepIdx >= 0 && stepIdx < results.length && results[stepIdx] && results[stepIdx][field] !== undefined) {
          return results[stepIdx][field];
        }
        return match;
      });
    }
    // Also match $steps[N].field (no braces) — Gemini sometimes uses this format
    replaced = replaced.replace(/\$steps\[(\d+)\]\.(\w+)/g, (match, idxStr, field) => {
      const rIdx = parseInt(idxStr, 10);
      if (rIdx < results.length && results[rIdx] && results[rIdx][field] !== undefined) {
        return results[rIdx][field];
      }
      return match;
    });
    resolved[key] = replaced;
  }
  return resolved;
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
  const wantsPublish = publish || operation?.status === 'published';
  if (!wantsPublish) return [];

  const missing = [];
  if (action === 'announcement' || action === 'announcement_update') {
    const existing = action === 'announcement_update'
      ? (appData.announcements || []).find(a => a.id === operation.id && a.courseId === activeCourseId)
      : null;
    const title = operation.title ?? existing?.title;
    const content = operation.content ?? existing?.content;
    if (!title) missing.push('title');
    if (!content) missing.push('content');
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
// MULTI-STEP AI ENGINE — Gemini native function calling
// Flow: user message → buildSystemInstruction + buildFunctionDeclarations
//       → runAiLoop → [functionCall → result → loop]
//       → action (Take Action Card) | text (chat bubble) | ask_user (inline input)
// The AI never touches the DB; it only emits function calls. Deterministic code executes actions.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Gemini function‑declaration parameter schemas for each action type ──────
const STR = { type: 'string' };
const NUM = { type: 'number' };
const BOOL = { type: 'boolean' };
const STR_ARRAY = { type: 'array', items: { type: 'string' } };
const QUESTION_ITEM = {
  type: 'object',
  properties: {
    type:          { type: 'string', description: 'multiple_choice|true_false|short_answer|essay|fill_in_blank|matching|ordering' },
    prompt:        { type: 'string', description: 'The question text' },
    options:       { type: 'array', items: { type: 'string' }, description: 'Answer options (for multiple_choice, matching, ordering)' },
    correctAnswer: { type: 'string', description: 'Correct answer index/value' },
    points:        { type: 'number', description: 'Points for this question' }
  },
  required: ['type', 'prompt']
};
const QUESTION_ARRAY = { type: 'array', items: QUESTION_ITEM };
const PIPELINE_STEP = {
  type: 'object',
  properties: {
    action: { type: 'string', description: 'Action name (e.g. create_assignment)' }
  },
  description: 'An action step — include all fields required by that action'
};

const ACTION_PARAM_SCHEMAS = {
  // Assignments
  create_assignment: {
    type: 'object',
    properties: {
      title: STR, description: STR, assignmentType: { type: 'string', description: 'essay|quiz|no_submission' },
      gradingType: { type: 'string', description: 'points|complete_incomplete|letter_grade|not_graded' },
      points: NUM, dueDate: { type: 'string', description: 'ISO 8601 local datetime, no Z' },
      status: { type: 'string', description: 'draft|published' },
      submissionModalities: STR_ARRAY, allowLateSubmissions: BOOL, lateDeduction: NUM,
      allowResubmission: BOOL, submissionAttempts: NUM, gradingNotes: STR,
      questionBankId: STR, timeLimit: NUM, randomizeQuestions: BOOL,
      availableFrom: STR, availableUntil: STR, fileIds: STR_ARRAY,
      isGroupAssignment: BOOL, groupSetId: STR, groupGradingMode: { type: 'string', description: 'per_group|individual' }
    },
    required: ['title']
  },
  update_assignment: {
    type: 'object',
    properties: {
      id: STR, title: STR, description: STR, points: NUM, dueDate: STR,
      status: STR, assignmentType: STR, gradingType: STR,
      allowLateSubmissions: BOOL, lateDeduction: NUM, allowResubmission: BOOL,
      isGroupAssignment: BOOL, groupSetId: STR, groupGradingMode: STR
    },
    required: ['id']
  },
  delete_assignment: { type: 'object', properties: { id: STR }, required: ['id'] },

  // Quizzes from bank
  create_quiz_from_bank: {
    type: 'object',
    properties: {
      title: STR, description: STR, category: STR, questionBankId: STR,
      numQuestions: NUM, randomizeQuestions: BOOL, randomizeAnswers: BOOL,
      dueDate: STR, availableFrom: STR, availableUntil: STR,
      points: NUM, timeLimit: NUM, attempts: NUM, allowLateSubmissions: BOOL,
      status: STR, gradingNotes: STR
    },
    required: ['questionBankId']
  },

  // Question Banks
  create_question_bank: {
    type: 'object',
    properties: { name: STR, description: STR, questions: QUESTION_ARRAY },
    required: ['name']
  },
  update_question_bank: {
    type: 'object',
    properties: { id: STR, name: STR, description: STR },
    required: ['id']
  },
  add_questions_to_bank: {
    type: 'object',
    properties: { id: STR, bankName: STR, questions: QUESTION_ARRAY },
    required: ['id', 'questions']
  },
  delete_question_bank: { type: 'object', properties: { id: STR }, required: ['id'] },
  delete_question_from_bank: {
    type: 'object',
    properties: { bankId: STR, questionId: STR, questionPrompt: STR },
    required: ['bankId', 'questionId']
  },

  // Announcements
  create_announcement: {
    type: 'object',
    properties: { title: STR, content: STR, pinned: BOOL, status: STR, fileIds: STR_ARRAY },
    required: ['title', 'content']
  },
  update_announcement: {
    type: 'object',
    properties: { id: STR, title: STR, content: STR, pinned: BOOL, hidden: BOOL },
    required: ['id']
  },
  delete_announcement: { type: 'object', properties: { id: STR }, required: ['id'] },

  // Modules
  create_module: {
    type: 'object',
    properties: { name: STR, description: STR },
    required: ['name']
  },
  update_module: {
    type: 'object',
    properties: { moduleId: STR, moduleName: STR, name: { type: 'string', description: 'New name' } },
    required: ['moduleId', 'name']
  },
  set_module_visibility: {
    type: 'object',
    properties: { moduleId: STR, moduleName: STR, hidden: BOOL },
    required: ['moduleId', 'hidden']
  },
  add_to_module: {
    type: 'object',
    properties: {
      moduleId: STR, moduleName: STR,
      itemType: { type: 'string', description: 'assignment|quiz|file|external_link' },
      itemId: STR, itemTitle: STR, url: STR
    },
    required: ['moduleId', 'itemType']
  },
  remove_from_module: {
    type: 'object',
    properties: { moduleId: STR, itemId: STR, itemTitle: STR },
    required: ['moduleId', 'itemId']
  },
  move_to_module: {
    type: 'object',
    properties: { itemId: STR, fromModuleId: STR, toModuleId: STR },
    required: ['itemId', 'fromModuleId', 'toModuleId']
  },

  // Files
  rename_file: {
    type: 'object',
    properties: { fileId: STR, oldName: STR, newName: STR },
    required: ['fileId', 'newName']
  },
  set_file_folder: {
    type: 'object',
    properties: { fileId: STR, fileName: STR, folder: STR },
    required: ['fileId']
  },
  set_file_visibility: {
    type: 'object',
    properties: { fileId: STR, fileName: STR, hidden: BOOL },
    required: ['fileId', 'hidden']
  },

  // People
  create_invite: {
    type: 'object',
    properties: { emails: STR_ARRAY, role: { type: 'string', description: 'student|ta|instructor' } },
    required: ['emails']
  },
  revoke_invite: {
    type: 'object',
    properties: { inviteId: STR, email: STR },
    required: ['inviteId']
  },

  // Course
  update_start_here: {
    type: 'object',
    properties: { title: STR, content: STR },
    required: ['content']
  },
  set_course_visibility: {
    type: 'object',
    properties: { visible: BOOL },
    required: ['visible']
  },

  // Calendar
  create_calendar_event: {
    type: 'object',
    properties: {
      title: STR,
      eventDate: { type: 'string', description: 'ISO 8601 local datetime' },
      eventType: { type: 'string', description: 'Class|Lecture|Office Hours|Exam|Event' },
      description: STR
    },
    required: ['title', 'eventDate']
  },
  update_calendar_event: {
    type: 'object',
    properties: { id: STR, title: STR, eventDate: STR, eventType: STR, description: STR },
    required: ['id']
  },
  delete_calendar_event: {
    type: 'object',
    properties: { id: STR, title: STR },
    required: ['id']
  },

  // Groups
  create_group_set: {
    type: 'object',
    properties: { name: STR, description: STR, groupCount: NUM },
    required: ['name']
  },
  delete_group_set: {
    type: 'object',
    properties: { id: STR, name: STR },
    required: ['id']
  },
  auto_assign_groups: {
    type: 'object',
    properties: { groupSetId: STR, groupSetName: STR },
    required: ['groupSetId']
  },

  // Discussion threads
  create_discussion_thread: {
    type: 'object',
    properties: { title: STR, content: STR, pinned: BOOL },
    required: ['title']
  },
  update_discussion_thread: {
    type: 'object',
    properties: { id: STR, title: STR, content: STR },
    required: ['id']
  },
  delete_discussion_thread: {
    type: 'object',
    properties: { id: STR, threadTitle: STR },
    required: ['id']
  },
  pin_discussion_thread: {
    type: 'object',
    properties: { id: STR, threadTitle: STR, pinned: BOOL },
    required: ['id', 'pinned']
  },
  reply_discussion_thread: {
    type: 'object',
    properties: { threadId: STR, threadTitle: STR, content: STR },
    required: ['threadId', 'content']
  },

  // Messaging
  send_message: {
    type: 'object',
    properties: { recipientIds: STR_ARRAY, message: STR },
    required: ['recipientIds', 'message']
  },
  reply_message: {
    type: 'object',
    properties: { conversationId: STR, message: STR },
    required: ['conversationId', 'message']
  },

  // Unified delete
  delete: {
    type: 'object',
    properties: {
      targetType: { type: 'string', description: 'assignment|announcement|question_bank|question_from_bank|calendar_event|group_set|discussion_thread' },
      id: STR,
      bankId: STR,
      questionId: STR,
      title: STR,
      name: STR,
      threadTitle: STR,
      questionPrompt: STR
    },
    required: ['targetType']
  },

  // Pipeline
  pipeline: {
    type: 'object',
    properties: {
      steps: { type: 'array', items: PIPELINE_STEP, description: 'Ordered list of actions to execute' },
      notes: STR
    },
    required: ['steps']
  }
};

/**
 * Build Gemini function declarations from AI_TOOL_REGISTRY.
 * Returns the `tools` array for the Gemini API request.
 */
function buildFunctionDeclarations(isStaff) {
  const declarations = [];

  // Context tools (read-only lookups)
  const contextTools = isStaff
    ? AI_TOOL_REGISTRY.context_tools
    : AI_TOOL_REGISTRY.context_tools.filter(t => STUDENT_TOOLS.includes(t.name));

  for (const tool of contextTools) {
    const decl = { name: tool.name, description: tool.description };
    if (tool.params && Object.keys(tool.params).length) {
      decl.parameters = {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.params).map(([k]) => [k, { type: 'string', description: k.replace(/_/g, ' ') }])
        ),
        required: Object.keys(tool.params)
      };
    }
    declarations.push(decl);
  }

  // Action types
  const actionTypes = isStaff
    ? AI_TOOL_REGISTRY.action_types
    : AI_TOOL_REGISTRY.action_types.filter(t => STUDENT_ACTIONS.includes(t.name));

  for (const action of actionTypes) {
    const schema = ACTION_PARAM_SCHEMAS[action.name];
    const decl = { name: action.name, description: action.description };
    if (schema) decl.parameters = schema;
    declarations.push(decl);
  }

  // ask_user — available to both roles
  declarations.push({
    name: 'ask_user',
    description: 'Ask the user a clarification question when intent is fundamentally ambiguous and defaults cannot apply',
    parameters: {
      type: 'object',
      properties: { question: { type: 'string', description: 'The question to ask the user' } },
      required: ['question']
    }
  });

  return [{ function_declarations: declarations }];
}

/**
 * Build system instruction for Gemini.
 * Contains behavioral rules only — tool/action definitions are in function declarations.
 */
function buildSystemInstruction(isStaff) {
  if (!isStaff) {
    return `You are an AI assistant for an LMS helping a STUDENT. Help with course questions, explain concepts, provide guidance, and help send or reply to messages.

Call the available tools to look up real IDs before taking any action — never guess IDs.
You may send messages and reply to messages. You may NOT create or modify any other content (assignments, quizzes, grades, etc.).

COMMUNICATION CHANNEL RULES:
- "message all students" / "notify everyone" → create_announcement
- "message" a specific student by name → send_message (call list_people first for their user ID)
- "reply" to an existing conversation → reply_message (call list_conversations first)
- "post to discussion" / "start a thread" → create_discussion_thread
- "reply to a discussion" → reply_discussion_thread (call list_discussion_threads first)

When responding with plain text, NEVER include raw UUIDs — refer to things by name/title only.
`;
  }

  return `You are an AI assistant for an LMS helping an INSTRUCTOR manage course content. You look up real data via tools, then propose an action for the instructor to confirm. You never touch the database — you propose actions that the instructor reviews and confirms.

When no function call is needed, respond with plain text (for questions, explanations, confirmations).

MANDATORY PRE-ACTION RULES — the COURSE CONTEXT only provides item counts, NOT IDs. You MUST call a lookup tool to get real IDs before every action:
- Before update/delete assignment → call list_assignments
- Before update/delete announcement → call list_announcements
- Before update_module or set_module_visibility → call list_modules
- Before add_to_module/remove_from_module/move_to_module → call list_modules
- Before rename_file or set_file_visibility → call list_files
- Before update/add_to/delete question_bank → call list_question_banks
- Before delete actions: call the relevant lookup first (e.g., list_assignments/list_announcements/list_calendar_events/list_discussion_threads/list_group_sets; and get_question_bank for question_from_bank).
- Before invite actions (revoke_invite) → call list_people
- Before creating a quiz from a bank → call list_question_banks
- Before get_student_grades → call list_people to get userId
- Standalone quiz creation is deprecated. Use create_assignment with assignmentType:"quiz" or create_quiz_from_bank.
- NEVER guess IDs — wrong IDs cause errors.
- NEVER include raw UUIDs in text responses — always use human-readable names/titles.

ALWAYS include human-readable labels alongside IDs in action payloads:
- inviteId → also include email
- userId → also include name and email
- moduleId → also include moduleName
- itemId → also include itemTitle
- fileId → also include fileName
- bankId → also include bankName
- questionId → also include questionPrompt

OUT-OF-SCOPE — respond with text, do NOT call an action:
- Creating a new course, importing content, editing course name/code/description → "done manually in Course Settings"
- Editing gradebook (categories, weights, letter thresholds, changing grades) → "grade changes must be made directly in the Gradebook"

VIEWING ANALYTICS AND GRADES — use tools then respond with text, no action needed:
- Assignment analytics → call get_assignment_analytics → respond with stats
- Student grades → call list_people → get_student_grades → respond with grades

COMMUNICATION CHANNEL RULES:
- "message all students" / "notify everyone" → create_announcement
- "message" a specific student by name → send_message (call list_people first)
- "reply" to existing conversation → reply_message (call list_conversations first)
- "post to discussion" → create_discussion_thread
- "reply to a discussion" → reply_discussion_thread (call list_discussion_threads first)

QUESTION BANK QUESTION TYPES (7 types for create_question_bank / add_questions_to_bank):
- multiple_choice: options array + correctAnswer (index or value)
- true_false: correctAnswer:"true" or "false"
- short_answer: correctAnswer is a string or array of acceptable answers
- essay: no correctAnswer (manually graded)
- fill_in_blank: correctAnswer is the expected text
- matching: options array of {left,right} pairs
- ordering: options array in correct order, correctAnswer is the ordered array

CLARIFICATION RULE — minimize ask_user:
- Only ask when genuinely ambiguous (e.g. multiple question banks match)
- Do NOT ask about: due dates, points, grading type, modality, late policy, status — use defaults
- Optional unknown fields → set to null; the instructor edits in the confirmation form
- NEVER call ask_user to say "I need to call list_people" — JUST CALL THE TOOL.

DEFAULTS (use unless user specifies otherwise):
- Assignment: assignmentType:"essay", gradingType:"points", points:100, dueDate:1 week from now, status:"draft", allowLateSubmissions:true, latePenaltyType:"per_day", lateDeduction:10, allowResubmission:true, submissionAttempts:null, description: always write a concise one-sentence description — never leave blank
- no_submission type: no dueDate, no availability dates, always status:"draft"
- Quiz: attempts:1, randomizeQuestions:false, randomizeAnswers:true, timeLimit:null
- Announcement: pinned:false, status:"draft"
- Invite: role:"student"
- update_start_here: title:"Start Here" (unless user specifies)

DATE/TIME RULES — CRITICAL:
- "Current date/time" in course context is already in the user's LOCAL time zone.
- All date/time fields must be LOCAL time WITHOUT trailing Z or timezone offset.
- Use the local timezone from the initial context turn when interpreting due dates/times.
  ✓ RIGHT: "2025-09-15T14:00:00"
  ❌ WRONG: "2025-09-15T14:00:00.000Z" or "2025-09-15T14:00:00+05:00"
- "2pm" = T14:00:00 with no suffix.
- EXTRACT DATES FROM CONTENT: if user pastes text with a date/time, parse it.
  Example: "add to calendar: we meet next Saturday March 7 at 2pm" → eventDate:"2026-03-07T14:00:00"
- Relative dates → resolve relative to the Current date/time in course context.

CONTENT FORMATTING (markdown supported):
- **bold**, *italic*, ## headers, - bullet lists
- Link files: [📄 filename](#file-FILE_ID)
`;
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
        .map(a => ({ id: a.id, title: a.title, type: a.assignmentType || 'essay', gradingType: a.gradingType || 'points', status: a.status, points: a.points, dueDate: a.dueDate, dueDateLocal: formatLocalDateTime(a.dueDate), isGroupAssignment: !!a.isGroupAssignment, groupSetId: a.groupSetId || null }));


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
      if (!a) return { error: 'Assignment not found — call list_assignments first to get the id' };
      return { ...a, dueDateLocal: formatLocalDateTime(a.dueDate), availableFromLocal: formatLocalDateTime(a.availableFrom), availableUntilLocal: formatLocalDateTime(a.availableUntil) };
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

    case 'get_start_here': {
      const course = getCourseByIdCallback ? getCourseByIdCallback(activeCourseId) : null;
      if (!course) return { error: 'Course not found' };
      return {
        title: course.startHereTitle || 'Start Here',
        content: course.startHereContent || ''
      };
    }

    case 'list_conversations': {
      const convos = (appData.conversations || []).filter(c => c.courseId === activeCourseId);
      return convos.map(c => {
        const otherParticipants = (c.participants || [])
          .filter(p => p.userId !== appData.currentUser?.id)
          .map(p => {
            const u = (appData.users || []).find(u => u.id === p.userId);
            return u ? { userId: p.userId, name: u.name, email: u.email } : { userId: p.userId };
          });
        const lastMsg = (c.messages || []).slice(-1)[0];
        return {
          conversationId: c.id,
          subject: c.subject || null,
          participants: otherParticipants,
          messageCount: (c.messages || []).length,
          lastMessage: lastMsg ? { from: lastMsg.senderId === appData.currentUser?.id ? 'you' : (appData.users || []).find(u => u.id === lastMsg.senderId)?.name || lastMsg.senderId, content: lastMsg.content.slice(0, 120), sentAt: lastMsg.createdAt } : null,
          updatedAt: c.updatedAt
        };
      });
    }

    case 'list_calendar_events': {
      const events = (appData.calendarEvents || []).filter(ev => ev.courseId === activeCourseId);
      return events.map(ev => ({
        id: ev.id,
        title: ev.title,
        eventDate: ev.eventDate,
        eventDateLocal: formatLocalDateTime(ev.eventDate),
        eventType: ev.eventType || 'Event',
        description: ev.description || ''
      }));
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Try to auto-correct a mistyped UUID by finding the closest match in a list.
 * Returns the corrected ID if a close match is found (Levenshtein distance <= 3), else null.
 */
function fuzzyMatchId(givenId, validIds) {
  if (!givenId || !validIds.length) return null;
  // Exact match — no correction needed
  if (validIds.includes(givenId)) return givenId;
  // Simple character-by-character distance for UUIDs (fast, good enough for 1-2 digit errors)
  let bestId = null, bestDist = 4; // max tolerance
  for (const vid of validIds) {
    if (vid.length !== givenId.length) continue;
    let dist = 0;
    for (let i = 0; i < vid.length && dist < bestDist; i++) {
      if (vid[i] !== givenId[i]) dist++;
    }
    if (dist < bestDist) { bestDist = dist; bestId = vid; }
  }
  return bestId;
}

/**
 * Auto-correct UUID fields in an action payload before validation.
 * If the AI got a UUID slightly wrong (1-2 chars off), fix it silently.
 */
function autoCorrectActionIds(payload) {
  if (!activeCourseId) return;
  const { action } = payload;

  const correctField = (field, items) => {
    if (!payload[field]) return;
    const validIds = items.map(i => i.id);
    if (validIds.includes(payload[field])) return;
    const corrected = fuzzyMatchId(payload[field], validIds);
    if (corrected) payload[field] = corrected;
  };

  const courseAnnouncements = (appData.announcements || []).filter(a => a.courseId === activeCourseId);
  const courseAssignments = (appData.assignments || []).filter(a => a.courseId === activeCourseId);
  const courseModules = (appData.modules || []).filter(m => m.courseId === activeCourseId);
  const courseFiles = (appData.files || []).filter(f => f.courseId === activeCourseId);
  const courseBanks = (appData.questionBanks || []).filter(b => b.courseId === activeCourseId);
  const courseGroupSets = (appData.groupSets || []).filter(gs => gs.courseId === activeCourseId);

  if (['update_announcement','delete_announcement'].includes(action)) {
    correctField('id', courseAnnouncements);
  }
  if (['update_assignment','delete_assignment'].includes(action)) {
    correctField('id', courseAssignments);
  }
  if (['update_module','set_module_visibility'].includes(action)) {
    if (payload.moduleId) correctField('moduleId', courseModules);
    else correctField('id', courseModules);
  }
  if (['rename_file','set_file_visibility','set_file_folder'].includes(action)) {
    if (payload.fileId) correctField('fileId', courseFiles);
    else correctField('id', courseFiles);
  }
  if (['update_question_bank','add_questions_to_bank','delete_question_bank'].includes(action)) {
    if (payload.bankId) correctField('bankId', courseBanks);
    else correctField('id', courseBanks);
  }
  if (action === 'delete_group_set' || action === 'auto_assign_groups') {
    if (payload.groupSetId) correctField('groupSetId', courseGroupSets);
    else correctField('id', courseGroupSets);
  }

  if (action === 'delete') {
    const tt = payload.targetType;
    if (tt === 'announcement') correctField('id', courseAnnouncements);
    if (tt === 'assignment') correctField('id', courseAssignments);
    if (tt === 'question_bank') correctField('id', courseBanks);
    if (tt === 'group_set') correctField('id', courseGroupSets);
    if (tt === 'discussion_thread') {
      const threads = (appData.discussionThreads || []).filter(t => t.courseId === activeCourseId);
      correctField('id', threads);
    }
    if (tt === 'calendar_event') {
      const events = (appData.calendarEvents || []).filter(e => e.courseId === activeCourseId);
      correctField('id', events);
    }
  }

  const courseThreads = (appData.discussionThreads || []).filter(t => t.courseId === activeCourseId);
  if (['update_discussion_thread','delete_discussion_thread','pin_discussion_thread'].includes(action)) {
    correctField('id', courseThreads);
  }
  if (action === 'reply_discussion_thread') {
    if (payload.threadId) correctField('threadId', courseThreads);
    else correctField('id', courseThreads);
  }
}

/**
 * Validate an action payload before creating the Take Action Card.
 * Returns an error string if invalid, null if valid.
 */
function validateActionPayload(payload) {
  // Auto-correct slightly wrong UUIDs before validation
  autoCorrectActionIds(payload);
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
  if (['update_announcement','delete_announcement'].includes(action)) {
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
    if (!payload.message && !payload.content && !payload.messageContent) return 'Missing message content';
  }
  if (action === 'reply_message') {
    if (!payload.conversationId) return 'Missing conversationId — call list_conversations first';
    if (!payload.message && !payload.content && !payload.messageContent) return 'Missing message content';
  }
  if (['update_discussion_thread','delete_discussion_thread','pin_discussion_thread'].includes(action)) {
    if (!payload.id) return 'Missing discussion thread id — call list_discussion_threads first';
    if (!(appData.discussionThreads || []).find(t => t.id === payload.id && t.courseId === activeCourseId))
      return `Discussion thread "${payload.id}" not found — use list_discussion_threads`;
  }
  if (action === 'reply_discussion_thread') {
    const threadId = payload.threadId || payload.id;
    if (!threadId) return 'Missing threadId — call list_discussion_threads first';
    if (!(appData.discussionThreads || []).find(t => t.id === threadId && t.courseId === activeCourseId))
      return `Discussion thread "${threadId}" not found — use list_discussion_threads`;
    if (!payload.content && !payload.message) return 'Missing reply content';
  }
  if ((action === 'create_assignment' || action === 'update_assignment') && payload.isGroupAssignment && payload.groupSetId) {
    if (!(appData.groupSets || []).find(gs => gs.id === payload.groupSetId && gs.courseId === activeCourseId))
      return `Group set "${payload.groupSetId}" not found — use list_group_sets`;
  }
  if (action === 'update_calendar_event' || action === 'delete_calendar_event') {
    if (!payload.id) return 'Missing calendar event id — call list_calendar_events first';
    if (!(appData.calendarEvents || []).find(ev => ev.id === payload.id && ev.courseId === activeCourseId))
      return `Calendar event "${payload.id}" not found — use list_calendar_events`;
  }
  return null;
}

/**
 * The core multi-step AI loop. Runs tool calls until it gets an answer/action/ask_user.
 * Each tool step is shown as a pill in the chat thread.
 * Max MAX_STEPS iterations to prevent infinite loops.
 */
async function runAiLoop(contents, systemInstruction, tools, isStaffUser = true) {
  let steps = 0;

  // Sets of known names for dispatching function calls
  const CONTEXT_TOOL_NAMES = new Set(AI_TOOL_REGISTRY.context_tools.map(t => t.name));
  const ACTION_NAMES = new Set([
    ...(AI_TOOL_REGISTRY.action_types || []).map(a => a.name),
    'pipeline', 'edit_pending_action'
  ]);

  const TOOL_ICONS = {
    list_people:'👥', list_assignments:'📋', list_question_banks:'📚', get_question_bank:'📖',
    list_announcements:'📣', list_files:'📁', list_modules:'🗂️',
    get_assignment:'📄', list_discussion_threads:'💬', get_grade_categories:'📊',
    get_grade_settings:'📊', get_file_content:'📄', list_conversations:'✉️',
    get_assignment_analytics:'📊', get_student_grades:'📊', list_group_sets:'👥',
    get_group_set:'👥', get_start_here:'🏠', list_calendar_events:'📅'
  };

  while (steps < AI_CONFIG.MAX_STEPS) {
    steps++;

    const data = await callGeminiAPIWithRetry({
      contents,
      systemInstruction,
      tools,
      toolConfig: { function_calling_config: { mode: 'AUTO' } },
      generationConfig: { temperature: AI_CONFIG.TEMPERATURE_CHAT, maxOutputTokens: 8192 }
    });
    if (data.error) throw new Error(data.error.message);

    const candidate = data.candidates[0];
    const parts = candidate.content.parts || [];

    // ── Check for function call ────────────────────────────────────────────
    const fnCallPart = parts.find(p => p.functionCall);

    if (!fnCallPart) {
      // Text response — direct answer
      const text = parts.map(p => p.text || '').join('');
      aiThread.push({ role: 'assistant', content: text });
      renderAiThread();
      return;
    }

    const { name: fnName, args: fnArgs } = fnCallPart.functionCall;

    // ── Context tool (read-only lookup) ──────────────────────────────────
    if (CONTEXT_TOOL_NAMES.has(fnName)) {
      // Enforce student tool restrictions in code
      if (!isStaffUser && !STUDENT_TOOLS.includes(fnName)) {
        aiThread.push({ role: 'assistant', content: 'I can only look up course information as a student.' });
        renderAiThread();
        return;
      }

      const icon = TOOL_ICONS[fnName] || '🔍';
      const stepMsg = {
        role: 'tool_step',
        tool: fnName,
        stepLabel: `${icon} Calling ${fnName.replace(/_/g, ' ')}…`,
        result: null,
        resultSummary: null
      };
      aiThread.push(stepMsg);
      renderAiThread();

      const result = await executeAiTool(fnName, fnArgs || {});
      stepMsg.result = result;
      stepMsg.resultSummary = summarizeToolResult(fnName, result);
      renderAiThread();

      // Build function response — use native functionCall/functionResponse turns
      const modelTurn = { role: 'model', parts: [fnCallPart] };

      // For binary files (PDF, images), attach inline data as a separate user turn
      // since functionResponse content must be JSON.
      if (result._inlineData) {
        const meta = { fileName: result.name, mimeType: result.mimeType, sizeKB: Math.round(result.sizeBytes / 1024) };
        contents = [
          ...contents,
          modelTurn,
          { role: 'function', parts: [{ functionResponse: { name: fnName, response: { name: fnName, content: meta } } }] },
          { role: 'user', parts: [
            { text: `Content of "${result.name}" (${result.mimeType}):` },
            { inlineData: result._inlineData }
          ]}
        ];
      } else if (result._textContent !== undefined) {
        const textResult = { fileName: result.name, mimeType: result.mimeType, content: result._textContent };
        contents = [
          ...contents,
          modelTurn,
          { role: 'function', parts: [{ functionResponse: { name: fnName, response: { name: fnName, content: textResult } } }] }
        ];
      } else {
        contents = [
          ...contents,
          modelTurn,
          { role: 'function', parts: [{ functionResponse: { name: fnName, response: { name: fnName, content: result } } }] }
        ];
      }
      continue;
    }

    // ── ask_user ─────────────────────────────────────────────────────────
    if (fnName === 'ask_user') {
      aiThread.push({
        role: 'ask_user',
        question: fnArgs?.question || 'Could you clarify?',
        pendingContents: contents,
        systemInstruction,
        tools
      });
      renderAiThread();
      return;
    }

    // ── Action (proposed change for user confirmation) ───────────────────
    if (ACTION_NAMES.has(fnName)) {
      // Students can only use whitelisted actions (messaging)
      if (!isStaffUser && !STUDENT_ACTIONS.includes(fnName)) {
        aiThread.push({ role: 'assistant', content: 'I can help you look up information, but only instructors can create or modify course content.' });
        renderAiThread();
        return;
      }

      const actionPayload = { type: 'action', action: fnName, ...(fnArgs || {}) };
      const validationError = validateActionPayload(actionPayload);
      if (validationError) {
        // Feed validation error back via functionResponse so the model can fix it
        contents = [
          ...contents,
          { role: 'model', parts: [fnCallPart] },
          { role: 'function', parts: [{ functionResponse: { name: fnName, response: { name: fnName, content: { error: validationError } } } }] }
        ];
        continue;
      }

      handleAiAction(actionPayload);
      renderAiThread();
      return;
    }

    // ── Unknown function call — treat as text ────────────────────────────
    const fallbackText = parts.map(p => p.text || '').join('') || `I called an unexpected function (${fnName}). Please try again.`;
    aiThread.push({ role: 'assistant', content: fallbackText });
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
/**
 * Build Gemini-format conversation history from aiThread using native function calling format.
 * Excludes the most-recently-added message (current user turn just pushed).
 * Tool steps become functionCall/functionResponse pairs.
 */
function buildGeminiHistory() {
  const history = [];
  const previousMessages = aiThread.slice(0, -1);

  for (const msg of previousMessages) {
    if (msg.hidden) continue;

    if (msg.role === 'user') {
      const last = history[history.length - 1];
      if (last && last.role === 'user') {
        last.parts[0].text += '\n\n' + msg.content;
      } else {
        history.push({ role: 'user', parts: [{ text: msg.content }] });
      }
    } else if (msg.role === 'assistant') {
      const text = (msg.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const last = history[history.length - 1];
      if (last && last.role === 'model') {
        last.parts.push({ text });
      } else {
        history.push({ role: 'model', parts: [{ text }] });
      }
    } else if (msg.role === 'action' && msg.confirmed) {
      continue;
    } else if (msg.role === 'action' && msg.rejected) {
      history.push({ role: 'model', parts: [{ text: `I proposed a "${msg.actionType}" action but the instructor cancelled it.` }] });
    } else if (msg.role === 'tool_step' && msg.result !== null) {
      // Re-emit as native functionCall → functionResponse turns
      const fnCallPart = { functionCall: { name: msg.tool, args: {} } };
      history.push({ role: 'model', parts: [fnCallPart] });

      let responseContent;
      if (msg.result._inlineData) {
        responseContent = { fileName: msg.result.name, mimeType: msg.result.mimeType, note: 'Binary file was read.' };
      } else if (msg.result._textContent !== undefined) {
        responseContent = { fileName: msg.result.name, mimeType: msg.result.mimeType, content: msg.result._textContent.slice(0, 2000) };
      } else {
        responseContent = msg.result;
      }
      history.push({
        role: 'function',
        parts: [{ functionResponse: { name: msg.tool, response: { name: msg.tool, content: responseContent } } }]
      });
    }
    // skip pending actions, ask_user, incomplete tool_steps
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
    const courseContext = buildAiContext();
    const systemInstruction = { parts: [{ text: buildSystemInstruction(effectiveIsStaff) }] };
    const tools = buildFunctionDeclarations(effectiveIsStaff);
    let contents;

    if (audioBase64) {
      contents = [
        { role: 'user', parts: [{ text: `INTERNAL COURSE CONTEXT (not user-visible):\n${courseContext}` }] },
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
            { text: 'Transcribe this voice message then respond as instructed.' }
          ]
        }
      ];
    } else {
      const geminiHistory = buildGeminiHistory();
      contents = [
        { role: 'user', parts: [{ text: `INTERNAL COURSE CONTEXT (not user-visible):\n${courseContext}` }] },
        ...geminiHistory,
        { role: 'user', parts: [{ text: message }] }
      ];
    }

    await runAiLoop(contents, systemInstruction, tools, effectiveIsStaff);
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
    { role: 'user', parts: [{ text: answer }] }
  ];

  aiProcessing = true;
  updateAiProcessingState();
  const isStaffUser = activeCourseId && isStaffCallback && isStaffCallback(appData.currentUser?.id, activeCourseId);
  const effectiveIsStaff = isStaffUser && !studentViewMode;
  const systemInstruction = msg.systemInstruction || { parts: [{ text: buildSystemInstruction(effectiveIsStaff) }] };
  const tools = msg.tools || buildFunctionDeclarations(effectiveIsStaff);
  runAiLoop(resumeContents, systemInstruction, tools, effectiveIsStaff).finally(() => {
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
  } else if (action.action === 'delete') {
    const targetType = action.targetType || action.target_type || action.type || '';
    aiThread.push({
      role: 'action',
      actionType: 'delete',
      data: {
        targetType,
        id: action.id || null,
        bankId: action.bankId || null,
        questionId: action.questionId || null,
        title: action.title || '',
        name: action.name || '',
        threadTitle: action.threadTitle || '',
        questionPrompt: action.questionPrompt || '',
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
        name: action.newName || action.name || '',
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
    const file = (appData.files || []).find(f => f.id === fileId);
    aiThread.push({
      role: 'action',
      actionType: 'file_rename',
      data: {
        fileId,
        oldName: action.oldName || action.fileName || file?.name || '',
        fileName: action.fileName || file?.name || '',
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
  } else if (action.action === 'update_calendar_event') {
    aiThread.push({
      role: 'action',
      actionType: 'calendar_event_update',
      data: {
        id: action.id || '',
        title: action.title,
        eventDate: action.eventDate || action.date,
        eventType: action.eventType,
        description: action.description,
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'delete_calendar_event') {
    aiThread.push({
      role: 'action',
      actionType: 'calendar_event_delete',
      data: {
        id: action.id || '',
        title: action.title || '',
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
        message: action.message || action.content || action.messageContent || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'reply_message') {
    aiThread.push({
      role: 'action',
      actionType: 'reply_message',
      data: {
        conversationId: action.conversationId || '',
        message: action.message || action.content || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'create_discussion_thread') {
    aiThread.push({
      role: 'action',
      actionType: 'discussion_thread_create',
      data: {
        title: action.title || '',
        content: action.content || '',
        pinned: !!action.pinned,
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'update_discussion_thread') {
    const d = { id: action.id };
    if ('title' in action) d.title = action.title;
    if ('content' in action) d.content = action.content;
    d.threadTitle = action.threadTitle || '';
    aiThread.push({ role: 'action', actionType: 'discussion_thread_update', data: d, confirmed: false, rejected: false });
  } else if (action.action === 'delete_discussion_thread') {
    aiThread.push({
      role: 'action',
      actionType: 'discussion_thread_delete',
      data: { id: action.id, threadTitle: action.threadTitle || '', notes: action.notes || '' },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'pin_discussion_thread') {
    aiThread.push({
      role: 'action',
      actionType: 'discussion_thread_pin',
      data: { id: action.id, threadTitle: action.threadTitle || '', pinned: action.pinned !== false, notes: action.notes || '' },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'reply_discussion_thread') {
    aiThread.push({
      role: 'action',
      actionType: 'discussion_thread_reply',
      data: {
        threadId: action.threadId || action.id || '',
        threadTitle: action.threadTitle || '',
        content: action.content || action.message || '',
        notes: action.notes || ''
      },
      confirmed: false,
      rejected: false
    });
  } else {
    // Unknown action — this is handled by the hard check in sendAiMessage
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
  // Sync split date+time inputs for calendar events
  const dateEl = document.getElementById(`aiCalEvtDate_${idx}`);
  const timeEl = document.getElementById(`aiCalEvtTime_${idx}`);
  if (dateEl && dateEl.value) {
    const t = timeEl ? timeEl.value : '14:00';
    msg.data.eventDate = new Date(dateEl.value + 'T' + t + ':00').toISOString();
  }
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
    case 'discussion_thread_create':
      return `Done! The discussion thread has been created. View it on the ${pageLink('discussion', 'Discussion Board')}.`;
    case 'discussion_thread_update':
      return `Done! The discussion thread has been updated. View it on the ${pageLink('discussion', 'Discussion Board')}.`;
    case 'discussion_thread_delete':
      return `Done! The discussion thread has been deleted.`;
    case 'discussion_thread_pin':
      return `Done! The thread has been ${data.pinned !== false ? 'pinned' : 'unpinned'}. View it on the ${pageLink('discussion', 'Discussion Board')}.`;
    case 'discussion_thread_reply':
      return `Done! Your reply has been posted to the discussion thread. View it on the ${pageLink('discussion', 'Discussion Board')}.`;
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
    case 'course_visibility':
      return `Done! The course is now <strong>${d.visible !== false ? 'visible to students' : 'hidden from students'}</strong>.`;
    case 'calendar_event_create': {
      const evDate = d.eventDate ? new Date(d.eventDate).toLocaleString() : '';
      return `Done! Added ${b(d.title)} (${escapeHtml(d.eventType || 'Event')}) to the ${pageLink('calendar', 'Calendar')}${evDate ? ` on ${escapeHtml(evDate)}` : ''}.`;
    }
    case 'calendar_event_update':
      return `Done! Updated calendar event ${b(d.title || '')}. See the ${pageLink('calendar', 'Calendar')}.`;
    case 'calendar_event_delete':
      return `Done! Deleted calendar event ${b(d.title || '')} from the ${pageLink('calendar', 'Calendar')}.`;
    case 'group_set_create':
      return `Done! Created group set ${b(d.name)} with ${d.groupCount || 4} groups. Manage from ${pageLink('assignments', 'Assignments')} > Groups.`;
    case 'group_set_delete':
      return `Done! Group set ${b(d.name || '')} has been permanently deleted.`;
    case 'group_auto_assign':
      return `Done! Students have been auto-assigned to groups in ${b(d.groupSetName || '')}. See ${pageLink('assignments', 'Assignments')} > Groups.`;
    case 'send_message':
      return `Done! Message sent. View the conversation in ${pageLink('inbox', 'Inbox')}.`;
    case 'reply_message':
      return `Done! Reply sent. View the conversation in ${pageLink('inbox', 'Inbox')}.`;
    case 'delete':
      return `Done! Deleted ${b(d.targetType || 'item')}${d.title ? `: ${b(d.title)}` : ''}.`;
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
    const pipelineResults = []; // collect results from each step
    const allSteps = msg.data.steps || [];
    for (const step of allSteps) {
      // Resolve ${result_N.field} and ${result.action_name.field} template references
      const resolvedStep = resolvePipelineStepRefs(step, pipelineResults, allSteps);
      const missing = getMissingPublishRequirements(resolvedStep, false);
      if (missing.length) {
        aiThread.push({ role: 'assistant', content: `Before I can publish this pipeline step (${resolvedStep.action || 'unknown'}), I still need: ${missing.join(', ')}.` });
        renderAiThread();
        return;
      }
      const ok = await executeAiOperation(resolvedStep, false);
      if (!ok) {
        showToast(`Pipeline stopped on step: ${resolvedStep.action || 'unknown'}`, 'error');
        return;
      }
      // Store result for subsequent steps (ok is true or a result object)
      pipelineResults.push(typeof ok === 'object' ? ok : {});
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


  if (action === 'delete') {
    const legacyMap = {
      delete_announcement: 'announcement',
      delete_assignment: 'assignment',
      delete_question_bank: 'question_bank',
      delete_question_from_bank: 'question_from_bank',
      delete_calendar_event: 'calendar_event',
      delete_group_set: 'group_set',
      delete_discussion_thread: 'discussion_thread'
    };
    const tt = resolved.targetType || legacyMap[resolved.action];
    if (tt === 'announcement') return await executeAiOperation({ action: 'announcement_delete', id: resolved.id }, false);
    if (tt === 'assignment') return await executeAiOperation({ action: 'assignment_delete', id: resolved.id }, false);
    if (tt === 'question_bank') return await executeAiOperation({ action: 'question_bank_delete', id: resolved.id }, false);
    if (tt === 'calendar_event') return await executeAiOperation({ action: 'calendar_event_delete', id: resolved.id, title: resolved.title }, false);
    if (tt === 'group_set') return await executeAiOperation({ action: 'group_set_delete', id: resolved.id, name: resolved.name }, false);
    if (tt === 'discussion_thread') return await executeAiOperation({ action: 'discussion_thread_delete', id: resolved.id, threadTitle: resolved.threadTitle }, false);
    if (tt === 'question_from_bank') return await executeAiOperation({ action: 'question_delete_from_bank', bankId: resolved.bankId, questionId: resolved.questionId, questionPrompt: resolved.questionPrompt }, false);
    showToast(`Unsupported delete targetType: ${tt || 'unknown'}`, 'error');
    return false;
  }

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
    // Notify students when published
    if (publish && !announcement.hidden) {
      supabaseNotifyCourseStudents(activeCourseId, 'announcement', 'New announcement: ' + announcement.title, (announcement.content || '').slice(0, 100), 'updates', announcement.id);
    }
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
    // Notify students when published
    if (newAssignment.status === 'published' && !newAssignment.hidden) {
      supabaseNotifyCourseStudents(activeCourseId, 'assignment', 'New assignment: ' + newAssignment.title, (newAssignment.description || '').slice(0, 100), 'assignments', newAssignment.id);
    }
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
    if (renderFilesCallback) renderFilesCallback();
    return true;
  }

  if (action === 'file_visibility') {
    const fileId = resolved.fileId || resolved.id;
    const file = (appData.files || []).find(f => f.id === fileId && f.courseId === activeCourseId);
    if (!file) { showToast('File not found', 'error'); return false; }
    file.hidden = !!resolved.hidden;
    const result = await supabaseUpdateFile(file);
    if (!result) { showToast('Failed to update file visibility', 'error'); return false; }
    if (renderFilesCallback) renderFilesCallback();
    return true;
  }

  if (action === 'file_folder') {
    const fileId = resolved.fileId || resolved.id;
    const file = (appData.files || []).find(f => f.id === fileId && f.courseId === activeCourseId);
    if (!file) { showToast('File not found', 'error'); return false; }
    file.folder = resolved.folder || null;
    const result = await supabaseUpdateFile(file);
    if (!result) { showToast('Failed to update file folder', 'error'); return false; }
    if (renderFilesCallback) renderFilesCallback();
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
    if (renderCalendarCallback) renderCalendarCallback();
    if (renderHomeCallback) renderHomeCallback();
    showToast('Calendar event added', 'success');
    return true;
  }

  if (action === 'calendar_event_update') {
    const ev = (appData.calendarEvents || []).find(e => e.id === resolved.id);
    if (!ev) { showToast('Calendar event not found', 'error'); return false; }
    if (resolved.title !== undefined) ev.title = resolved.title;
    if (resolved.eventDate !== undefined) ev.eventDate = resolved.eventDate;
    if (resolved.eventType !== undefined) ev.eventType = resolved.eventType;
    if (resolved.description !== undefined) ev.description = resolved.description;
    const result = await supabaseUpdateCalendarEvent(ev);
    if (!result) { showToast('Failed to update event', 'error'); return false; }
    if (renderCalendarCallback) renderCalendarCallback();
    if (renderHomeCallback) renderHomeCallback();
    showToast('Calendar event updated', 'success');
    return true;
  }

  if (action === 'calendar_event_delete') {
    const ok = await supabaseDeleteCalendarEvent(resolved.id);
    if (!ok) { showToast('Failed to delete event', 'error'); return false; }
    appData.calendarEvents = (appData.calendarEvents || []).filter(ev => ev.id !== resolved.id);
    if (renderCalendarCallback) renderCalendarCallback();
    if (renderHomeCallback) renderHomeCallback();
    showToast('Calendar event deleted', 'success');
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
    return { id: gsId, name: resolved.name };
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
    const msgContent = resolved.message || resolved.content || resolved.messageContent;
    if (!msgContent) { showToast('Message content is required', 'error'); return false; }
    // Send one conversation per recipient using the SECURITY DEFINER RPC
    for (const recipientId of recipientIds) {
      const result = await supabaseSendDirectMessage(activeCourseId, recipientId, null, msgContent);
      if (!result) continue;
      const convoId = result.conversation_id;
      const msgId = result.message_id;
      let convo = (appData.conversations || []).find(c => c.id === convoId);
      if (!convo) {
        convo = {
          id: convoId, courseId: activeCourseId, subject: null,
          createdBy: appData.currentUser.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          participants: [
            { conversationId: convoId, userId: appData.currentUser.id },
            { conversationId: convoId, userId: recipientId }
          ],
          messages: []
        };
        if (!appData.conversations) appData.conversations = [];
        appData.conversations.unshift(convo);
      }
      convo.messages.push({ id: msgId, conversationId: convoId, senderId: appData.currentUser.id, content: msgContent, createdAt: new Date().toISOString() });
      convo.updatedAt = new Date().toISOString();
    }
    showToast('Message sent!', 'success');
    return true;
  }

  if (action === 'reply_message') {
    if (!activeCourseId) { showToast('No active course', 'error'); return false; }
    const { conversationId, message, content, messageContent } = resolved;
    const msgContent = message || content || messageContent;
    if (!conversationId) { showToast('No conversationId — call list_conversations first', 'error'); return false; }
    if (!msgContent) { showToast('Message content is required', 'error'); return false; }
    // Use SECURITY DEFINER RPC: inserts message and notifies other participants
    const result = await supabaseSendReplyMessage(conversationId, msgContent);
    if (!result) return false;
    const msgId = result.message_id;
    const convo = (appData.conversations || []).find(c => c.id === conversationId);
    if (convo) {
      convo.messages.push({ id: msgId, conversationId, senderId: appData.currentUser.id, content: msgContent, createdAt: new Date().toISOString() });
      convo.updatedAt = new Date().toISOString();
    }
    showToast('Reply sent!', 'success');
    return true;
  }

  if (action === 'discussion_thread_create') {
    const thread = {
      id: generateId(),
      courseId: activeCourseId,
      title: resolved.title || 'Untitled Thread',
      content: resolved.content || null,
      authorId: appData.currentUser.id,
      createdAt: new Date().toISOString(),
      pinned: !!resolved.pinned,
      hidden: false,
      replies: []
    };
    const saved = await supabaseCreateDiscussionThread(thread);
    if (!saved) { showToast('Failed to create discussion thread', 'error'); return false; }
    if (!appData.discussionThreads) appData.discussionThreads = [];
    appData.discussionThreads.unshift(thread);
    if (renderDiscussionCallback) renderDiscussionCallback();
    showToast('Discussion thread created!', 'success');
    return true;
  }

  if (action === 'discussion_thread_update') {
    const thread = (appData.discussionThreads || []).find(t => t.id === resolved.id && t.courseId === activeCourseId);
    if (!thread) { showToast('Discussion thread not found', 'error'); return false; }
    if (resolved.title !== undefined) thread.title = resolved.title;
    if (resolved.content !== undefined) thread.content = resolved.content;
    const ok = await supabaseUpdateDiscussionThread(thread);
    if (!ok) { showToast('Failed to update discussion thread', 'error'); return false; }
    if (renderDiscussionCallback) renderDiscussionCallback();
    showToast('Discussion thread updated!', 'success');
    return true;
  }

  if (action === 'discussion_thread_delete') {
    const deleted = await supabaseDeleteDiscussionThread(resolved.id);
    if (!deleted) { showToast('Failed to delete discussion thread', 'error'); return false; }
    appData.discussionThreads = (appData.discussionThreads || []).filter(t => t.id !== resolved.id);
    if (renderDiscussionCallback) renderDiscussionCallback();
    showToast('Discussion thread deleted', 'success');
    return true;
  }

  if (action === 'discussion_thread_pin') {
    const thread = (appData.discussionThreads || []).find(t => t.id === resolved.id && t.courseId === activeCourseId);
    if (!thread) { showToast('Discussion thread not found', 'error'); return false; }
    thread.pinned = resolved.pinned !== false;
    const ok = await supabaseUpdateDiscussionThread(thread);
    if (!ok) { showToast('Failed to update thread pin', 'error'); return false; }
    if (renderDiscussionCallback) renderDiscussionCallback();
    showToast(thread.pinned ? 'Thread pinned' : 'Thread unpinned', 'success');
    return true;
  }

  if (action === 'discussion_thread_reply') {
    const threadId = resolved.threadId || resolved.id;
    const thread = (appData.discussionThreads || []).find(t => t.id === threadId && t.courseId === activeCourseId);
    if (!thread) { showToast('Discussion thread not found', 'error'); return false; }
    const reply = {
      id: generateId(),
      threadId,
      content: resolved.content || resolved.message || '',
      authorId: appData.currentUser.id,
      isAi: false,
      createdAt: new Date().toISOString()
    };
    const saved = await supabaseCreateDiscussionReply(reply);
    if (!saved) { showToast('Failed to post reply', 'error'); return false; }
    if (!thread.replies) thread.replies = [];
    thread.replies.push(reply);
    if (renderDiscussionCallback) renderDiscussionCallback();
    showToast('Reply posted to discussion!', 'success');
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
        'course_visibility': 'Course Visibility',
        'calendar_event_create': 'Calendar Event',
        'calendar_event_update': 'Calendar Event',
        'calendar_event_delete': 'Calendar Event',
        'discussion_thread_create': 'Discussion Thread',
        'discussion_thread_update': 'Discussion Thread',
        'discussion_thread_delete': 'Discussion Thread',
        'discussion_thread_pin': 'Discussion Thread',
        'discussion_thread_reply': 'Discussion Reply',
        'send_message': 'Message',
        'reply_message': 'Message',
        'delete': 'Delete',
        'group_set_create': 'Group Set',
        'group_set_delete': 'Group Set',
        'group_auto_assign': 'Groups',
        'pipeline': 'Automation Pipeline'
      }[msg.actionType] || 'Content';

      // Determine the right verb for announcement_update based on what's being changed
      const getAnnouncementUpdateVerb = (data) => {
        if (!data) return 'Update';
        const hasContentChange = 'title' in data || 'content' in data;
        const hasHiddenChange = 'hidden' in data;
        if (hasHiddenChange && !hasContentChange) return 'Change Visibility';
        return 'Update';
      };

      const actionVerb = {
        'announcement': 'Create',
        'announcement_update': getAnnouncementUpdateVerb(msg.data),
        'announcement_delete': 'Delete',
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
        'course_visibility': msg.data?.visible === false ? 'Hide' : 'Show',
        'calendar_event_create': 'Add',
        'calendar_event_update': 'Update',
        'calendar_event_delete': 'Delete',
        'discussion_thread_create': 'Create',
        'discussion_thread_update': 'Update',
        'discussion_thread_delete': 'Delete',
        'discussion_thread_pin': msg.data?.pinned === false ? 'Unpin' : 'Pin',
        'discussion_thread_reply': 'Post',
        'send_message': 'Send',
        'reply_message': 'Reply',
        'delete': 'Delete',
        'group_set_create': 'Create',
        'group_set_delete': 'Delete',
        'group_auto_assign': 'Auto-assign',
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
                <button class="btn btn-primary btn-sm" onclick="window.confirmAiAction(${idx}, false)">${actionVerb}${actionVerb === 'Create' ? ' (Draft)' : ''}</button>
                ${['announcement', 'assignment', 'quiz', 'quiz_from_bank', 'question_bank_create'].includes(msg.actionType) && ['Create','Update'].includes(actionVerb) ? `
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
    case 'create_calendar_event':
      return `Add calendar event: "${title}"${step.eventDate ? ` on ${new Date(step.eventDate).toLocaleDateString()}` : ''}`;
    case 'update_calendar_event':
      return `Update calendar event: "${title}"`;
    case 'delete_calendar_event':
      return `Delete calendar event: "${title}"`;
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
    case 'auto_assign_groups': {
      let gsLabel = step.groupSetName || title || step.groupSetId || '';
      // Clean up template refs like ${result_0.id}
      if (gsLabel.includes('${')) gsLabel = '';
      return `Auto-assign students to${gsLabel ? `: "${gsLabel}"` : ' groups'}`;
    }
    case 'send_message':
      return `Send message`;
    case 'reply_message':
      return `Reply to conversation`;
    case 'delete':
      return `Delete ${step.targetType || 'item'}${step.title ? `: "${step.title}"` : ''}`;
    case 'create_discussion_thread':
      return `Create discussion thread: "${title}"`;
    case 'update_discussion_thread':
      return `Update discussion thread: "${title}"`;
    case 'delete_discussion_thread':
      return `Delete discussion thread: "${title}"`;
    case 'pin_discussion_thread':
      return `${step.pinned === false ? 'Unpin' : 'Pin'} discussion thread: "${title}"`;
    case 'reply_discussion_thread':
      return `Reply to discussion thread: "${title}"`;
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
    const hasContentChange = 'title' in d || 'content' in d;
    let html = `<div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Editing: ${escapeHtml(ann?.title || d.id || '')}</div>`;
    if ('title' in d) html += field('Title', textInput('title', d.title));
    if ('content' in d) html += field('Content', textarea('content', d.content, 5));
    if ('pinned' in d) html += `<div style="margin-bottom:4px;">${checkboxInput('pinned', d.pinned, 'Pinned')}</div>`;
    // Show visibility as a label, not a checkbox — the button verb (Hide/Show) handles it
    if ('hidden' in d && !hasContentChange) {
      html += `<div class="muted" style="font-size:0.9rem; margin-top:4px;">This will <strong>${d.hidden ? 'hide' : 'show'}</strong> the announcement ${d.hidden ? 'from' : 'to'} students.</div>`;
    }
    return html;
  }

  // ─── ANNOUNCEMENT simple ops ─────────────────────────────────────────────
  if (msg.actionType === 'announcement_delete') {
    const ann = (appData.announcements || []).find(a => a.id === d.id);
    return `<div class="muted" style="font-size:0.9rem;">Delete announcement: <strong>${escapeHtml(ann?.title || d.id || '')}</strong></div>`;
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

  // ─── COURSE VISIBILITY ───────────────────────────────────────────────────
  if (msg.actionType === 'course_visibility') {
    const course = (appData.courses || []).find(c => c.id === (d.courseId || activeCourseId));
    return `
      <div class="muted" style="font-size:0.9rem; margin-bottom:12px;">Course: <strong>${escapeHtml(course?.name || '')}</strong></div>
      <div class="muted" style="font-size:0.9rem;">This will <strong>${d.visible !== false ? 'show' : 'hide'}</strong> the course ${d.visible !== false ? 'to' : 'from'} students.</div>
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
      <div class="muted" style="font-size:0.9rem;">This will <strong>${d.hidden ? 'hide' : 'show'}</strong> the module ${d.hidden ? 'from' : 'to'} students.</div>
    `;
  }

  // ─── FILE RENAME ─────────────────────────────────────────────────────────
  if (msg.actionType === 'file_rename') {
    const fileId = d.fileId || d.id;
    const file = (appData.files || []).find(f => f.id === fileId);
    const currentName = d.oldName || d.fileName || file?.name || '';
    return `
      <div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Current name: <em>${escapeHtml(currentName)}</em></div>
      ${field('New Name', textInput('newName', d.newName), 0)}
    `;
  }

  // ─── FILE VISIBILITY ─────────────────────────────────────────────────────
  if (msg.actionType === 'file_visibility') {
    return `
      <div class="muted" style="font-size:0.9rem; margin-bottom:10px;">File: <strong>${escapeHtml(d.fileName || d.fileId || '')}</strong></div>
      <div class="muted" style="font-size:0.9rem;">This will <strong>${d.hidden ? 'hide' : 'show'}</strong> the file ${d.hidden ? 'from' : 'to'} students.</div>
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

  // ─── CALENDAR EVENT (update) ──────────────────────────────────────────────
  if (msg.actionType === 'calendar_event_update') {
    const ev = (appData.calendarEvents || []).find(e => e.id === d.id);
    let html = `<div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Editing: ${escapeHtml(ev?.title || d.title || d.id || '')}</div>`;
    if (d.title !== undefined) html += field('Title', textInput('title', d.title));
    if (d.eventDate !== undefined) {
      const dtLocal = toDatetimeLocal(d.eventDate);
      const datePart = dtLocal ? dtLocal.slice(0, 10) : '';
      const timePart = dtLocal ? dtLocal.slice(11, 16) : '14:00';
      html += field('Date & Time', `<div style="display:flex; gap:8px;">
        <input type="date" class="form-input" style="flex:1;" id="aiCalEvtDate_${idx}" value="${escapeHtml(datePart)}"
          onchange="(function(el){const t=document.getElementById('aiCalEvtTime_${idx}');window.updateAiActionField(${idx},'eventDate',new Date(el.value+'T'+(t?t.value:'14:00')+':00').toISOString());})(this)">
        <input type="time" class="form-input" style="width:130px;" id="aiCalEvtTime_${idx}" value="${escapeHtml(timePart)}" step="1800"
          onchange="(function(el){const d=document.getElementById('aiCalEvtDate_${idx}');window.updateAiActionField(${idx},'eventDate',new Date((d?d.value:'2000-01-01')+'T'+el.value+':00').toISOString());})(this)">
      </div>`);
    }
    if (d.eventType !== undefined) html += field('Event Type', selectInput('eventType', d.eventType || 'Event', [['Class','Class'],['Lecture','Special Lecture'],['Office Hours','Office Hours'],['Exam','Exam'],['Event','Other']]));
    if (d.description !== undefined) html += field('Description', textarea('description', d.description, 2));
    return html;
  }

  // ─── CALENDAR EVENT (delete) ──────────────────────────────────────────────
  if (msg.actionType === 'calendar_event_delete') {
    const ev = (appData.calendarEvents || []).find(e => e.id === d.id);
    return `<div class="muted" style="font-size:0.9rem;">Delete calendar event: <strong>${escapeHtml(ev?.title || d.title || d.id || '')}</strong></div>`;
  }


  // ─── UNIFIED DELETE ───────────────────────────────────────────────────────
  if (msg.actionType === 'delete') {
    const tt = d.targetType || '';
    const label = d.title || d.name || d.threadTitle || d.questionPrompt || d.id || '';
    return `<div class="muted" style="font-size:0.9rem;">Delete <strong>${escapeHtml(tt || 'item')}</strong>${label ? `: <strong>${escapeHtml(label)}</strong>` : ''}</div>`;
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
      ${field('Message', textarea('message', d.message, 4))}
    `;
  }

  // ─── REPLY MESSAGE ───────────────────────────────────────────────────────
  if (msg.actionType === 'reply_message') {
    const convo = (appData.conversations || []).find(c => c.id === d.conversationId);
    const otherNames = convo
      ? (convo.participants || []).filter(p => p.userId !== appData.currentUser?.id).map(p => {
          const u = (appData.users || []).find(u => u.id === p.userId);
          return u ? escapeHtml(u.name) : p.userId;
        }).join(', ')
      : d.conversationId;
    return `
      <div class="muted" style="font-size:0.85rem; margin-bottom:8px;">Reply to conversation with: <strong>${otherNames}</strong></div>
      ${field('Message', textarea('message', d.message, 4))}
    `;
  }

  // ─── DISCUSSION THREAD (create) ──────────────────────────────────────────
  if (msg.actionType === 'discussion_thread_create') {
    return `
      ${field('Title', textInput('title', d.title))}
      ${field('Content', textarea('content', d.content, 4))}
      <div style="margin-bottom:4px;">${checkboxInput('pinned', d.pinned, 'Pin thread')}</div>
    `;
  }

  // ─── DISCUSSION THREAD (update) ─────────────────────────────────────────
  if (msg.actionType === 'discussion_thread_update') {
    const thread = (appData.discussionThreads || []).find(t => t.id === d.id);
    let html = `<div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Editing: ${escapeHtml(thread?.title || d.threadTitle || d.id || '')}</div>`;
    if ('title' in d) html += field('Title', textInput('title', d.title));
    if ('content' in d) html += field('Content', textarea('content', d.content, 4));
    return html;
  }

  // ─── DISCUSSION THREAD (delete) ─────────────────────────────────────────
  if (msg.actionType === 'discussion_thread_delete') {
    const thread = (appData.discussionThreads || []).find(t => t.id === d.id);
    return `<div class="muted" style="font-size:0.9rem;">Delete discussion thread: <strong>${escapeHtml(thread?.title || d.threadTitle || d.id || '')}</strong></div>
      <div style="margin-top:6px; font-size:0.82rem; color:var(--danger, #c00);">This will permanently delete the thread and all its replies.</div>`;
  }

  // ─── DISCUSSION THREAD (pin/unpin) ──────────────────────────────────────
  if (msg.actionType === 'discussion_thread_pin') {
    const thread = (appData.discussionThreads || []).find(t => t.id === d.id);
    return `<div class="muted" style="font-size:0.9rem;">${d.pinned !== false ? 'Pin' : 'Unpin'} discussion thread: <strong>${escapeHtml(thread?.title || d.threadTitle || d.id || '')}</strong></div>`;
  }

  // ─── DISCUSSION THREAD (reply) ──────────────────────────────────────────
  if (msg.actionType === 'discussion_thread_reply') {
    const thread = (appData.discussionThreads || []).find(t => t.id === d.threadId);
    return `
      <div class="muted" style="font-size:0.85rem; margin-bottom:8px;">Reply to: <strong>${escapeHtml(thread?.title || d.threadTitle || '')}</strong></div>
      ${field('Reply', textarea('content', d.content, 4))}
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
    const data = await callGeminiAPI({
      contents,
      generationConfig: { responseMimeType: "application/json", temperature: AI_CONFIG.TEMPERATURE_CHAT }
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
  window.clearAiHistory = function() {
    clearAiThread();
    renderAiThread();
  };
}
