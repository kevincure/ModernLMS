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
  supabaseCreateModule, supabaseCreateModuleItem, supabaseDeleteModuleItem,
  supabaseCreateInvite, supabaseDeleteInvite,
  supabaseDeleteEnrollment,
  supabaseUpdateCourse
} from './database_interactions.js';
import { AI_PROMPTS, AI_CONFIG, AI_TOOL_REGISTRY } from './constants.js';

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

      // Add assignments
      const assignments = appData.assignments?.filter(a => a.courseId === activeCourseId) || [];
      if (assignments.length > 0) {
        context += `\nCOURSE ASSIGNMENTS (${assignments.length}):\n`;
        assignments.forEach(a => {
          const atype = a.assignmentType || 'essay';
          const gt = a.gradingType || 'points';
          const dueStr = a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'no due date';
          context += `- ID: ${a.id} | ${a.title} | type: ${atype} | grading: ${gt} | ${a.points ?? 0} pts | due: ${dueStr} | status: ${a.status}\n`;
        });
      }

      // Add quizzes
      const quizzes = appData.quizzes?.filter(q => q.courseId === activeCourseId) || [];
      if (quizzes.length > 0) {
        context += `\nCOURSE QUIZZES (${quizzes.length}):\n`;
        quizzes.forEach(q => {
          context += `- ID: ${q.id} | ${q.title} (due: ${new Date(q.dueDate).toLocaleDateString()}, status: ${q.status})\n`;
        });
      }

      // Add question banks
      const questionBanks = appData.questionBanks?.filter(qb => qb.courseId === activeCourseId) || [];
      if (questionBanks.length > 0) {
        context += `\nQUESTION BANKS (${questionBanks.length}):\n`;
        questionBanks.forEach(qb => {
          const qCount = qb.questions?.length || 0;
          context += `- ID: ${qb.id} | Name: "${qb.name}" | ${qCount} questions\n`;
        });
      } else {
        context += `\nQUESTION BANKS: None available\n`;
      }

      // Add files
      const files = appData.files?.filter(f => f.courseId === activeCourseId) || [];
      if (files.length > 0) {
        context += `\nCOURSE FILES (${files.length}):\n`;
        files.forEach(f => {
          context += `- ID: ${f.id} | ${f.name}${f.description ? ` - ${f.description}` : ''}\n`;
        });
      }

      context += '\nCOURSE DOCUMENT INDEX:\n';
      files.forEach(f => {
        context += `- FILE ${f.id}: ${f.name}${f.description ? ` | ${f.description}` : ''}\n`;
      });

      assignments.forEach(a => {
        const preview = (a.description || '').replace(/\s+/g, ' ').slice(0, 140);
        context += `- ASSIGNMENT ${a.id}: ${a.title}${preview ? ` | ${preview}` : ''}\n`;
      });

      quizzes.forEach(q => {
        const preview = (q.description || '').replace(/\s+/g, ' ').slice(0, 140);
        context += `- QUIZ ${q.id}: ${q.title}${preview ? ` | ${preview}` : ''}\n`;
      });

      // Add announcements
      const announcements = appData.announcements?.filter(a => a.courseId === activeCourseId) || [];
      if (announcements.length > 0) {
        context += `\nCOURSE ANNOUNCEMENTS (${announcements.length}):\n`;
        announcements
          .slice()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 10)
          .forEach(a => {
            context += `- ID: ${a.id} | ${a.title} (posted: ${new Date(a.createdAt).toLocaleDateString()}, pinned: ${!!a.pinned}, hidden: ${!!a.hidden})\n`;
          });

        announcements.slice(0, 10).forEach(a => {
          const preview = (a.content || '').replace(/\s+/g, ' ').slice(0, 140);
          context += `- ANNOUNCEMENT ${a.id}: ${a.title}${preview ? ` | ${preview}` : ''}\n`;
        });
      }

      // Add course roster summary
      const courseEnrollments = appData.enrollments?.filter(e => e.courseId === activeCourseId) || [];
      if (courseEnrollments.length > 0) {
        context += `\nCOURSE ROSTER (${courseEnrollments.length}):\n`;
        courseEnrollments.forEach(e => {
          const user = getUserByIdCallback ? getUserByIdCallback(e.userId) : null;
          const label = user?.name || user?.email || e.userId;
          context += `- ${label} (${e.role})\n`;
        });
      }

      // Add modules — include IDs and item details so AI can reference exact modules/items
      const modules = appData.modules?.filter(m => m.courseId === activeCourseId) || [];
      if (modules.length > 0) {
        context += `\nCOURSE MODULES (${modules.length}):\n`;
        modules.forEach(m => {
          context += `- ID: ${m.id} | Name: "${m.name}" (${m.items?.length || 0} items)\n`;
          (m.items || []).forEach(item => {
            let refTitle = item.title || '';
            if (item.refId && !refTitle) {
              if (item.type === 'assignment') refTitle = (appData.assignments || []).find(a => a.id === item.refId)?.title || '';
              else if (item.type === 'quiz') refTitle = (appData.quizzes || []).find(q => q.id === item.refId)?.title || '';
              else if (item.type === 'file') refTitle = (appData.files || []).find(f => f.id === item.refId)?.name || '';
            }
            context += `  - Item ID: ${item.id} | type: ${item.type}${item.refId ? ` | refId: ${item.refId}` : ''}${refTitle ? ` | title: "${refTitle}"` : ''}\n`;
          });
        });
      }
    }
  } else {
    context += 'No active course selected. Ask the user to open a course for course-specific actions.\n';
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
    create_quiz: 'quiz',
    create_quiz_inline: 'quiz',
    update_quiz: 'quiz_update',
    delete_quiz: 'quiz_delete',
    create_quiz_from_bank: 'quiz_from_bank',
    create_assignment: 'assignment',
    update_assignment: 'assignment_update',
    delete_assignment: 'assignment_delete',
    create_module: 'module',
    add_to_module: 'module_add_item',
    remove_from_module: 'module_remove_item',
    move_to_module: 'module_move_item',
    create_invite: 'invite_create',
    revoke_invite: 'invite_revoke',
    set_course_visibility: 'course_visibility'
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

  if (action === 'quiz' || action === 'quiz_update') {
    if (!operation.title && action === 'quiz') missing.push('title');
    if (!operation.dueDate) missing.push('dueDate');
    const questions = operation.questions;
    if (Array.isArray(questions) && questions.length === 0) missing.push('at least one question');
    if (action === 'quiz' && !Array.isArray(questions)) missing.push('questions');
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
    return `You are an AI assistant for an LMS helping a STUDENT. Help with course questions, explain concepts, and provide guidance on assignments. Do NOT create or modify course content — redirect those requests to instructors.\n\nRespond in plain text.\n\n${courseContext}`;
  }

  const toolList = AI_TOOL_REGISTRY.context_tools.map(t => {
    const paramStr = t.params ? `(${Object.entries(t.params).map(([k, v]) => `${k}: ${v}`).join(', ')})` : '';
    return `  - ${t.name}${paramStr}: ${t.description}`;
  }).join('\n');

  const actionList = AI_TOOL_REGISTRY.action_types.map(t =>
    `  - ${t.name}${t.dangerous ? ' ⚠️' : ''}: ${t.description}`
  ).join('\n');

  return `You are an AI assistant for an LMS (Learning Management System) helping an INSTRUCTOR manage course content. You look up real data via tools, then propose an action for the instructor to confirm.

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

MANDATORY PRE-ACTION RULES — ALWAYS call the relevant tool before acting:
- Before ANY invite/person action (revoke_invite, remove_person): call list_people to get the real inviteId/userId
- Before creating a quiz/exam from a bank: call list_question_banks to find the correct bank ID
- Before update/delete of any content: verify the item exists and get its real ID from the relevant list tool
- NEVER guess or hallucinate IDs — all IDs are validated server-side; wrong IDs show an error card, not an action card
- NEVER include raw UUIDs or database IDs in the "text" field of {"type":"answer"} responses — always refer to things by human-readable name, title, or email in prose. If you only have an ID, call the relevant tool first to look up the name.
- ACTION PAYLOAD FIELDS ARE DIFFERENT: you MUST include real database IDs (inviteId, userId, id, moduleId, etc.) in action JSON payloads — those fields are required for the action to execute and are never shown directly to the user as-is.

ALWAYS include human-readable label fields alongside every ID in action payloads:
- inviteId → also include email (from list_people result)
- userId → also include name and email (from list_people result)
- moduleId → also include moduleName (from list_modules result)
- itemId → also include itemTitle (from list_modules or list_assignments/quizzes/files)
- assignmentId or quizId → also include title

CLARIFICATION RULE — minimize ask_user:
- Only ask when you genuinely cannot proceed (e.g., multiple question banks match and user didn't specify)
- Do NOT ask about: due dates, points, grading type, modality, late policy, status — use defaults
- If a field is optional and unknown, set it to null; the instructor edits it in the confirmation form

DEFAULTS (use unless user specifies otherwise):
- Assignment: assignmentType:"essay", gradingType:"points", points:100, dueDate:1 week from now, status:"draft", allowLateSubmissions:true, latePenaltyType:"per_day", lateDeduction:10, allowResubmission:true, submissionAttempts:null
- no_submission type: no dueDate, no availability dates, always status:"draft"
- Quiz: attempts:1, randomizeQuestions:false, randomizeAnswers:true, timeLimit:null
- Announcement: pinned:false, status:"draft"
- Invite: role:"student"

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
      case 'list_assignments':   return `${result.length} assignment${result.length !== 1 ? 's' : ''}`;
      case 'list_question_banks':return `${result.length} bank${result.length !== 1 ? 's' : ''}`;
      case 'list_quizzes':       return `${result.length} quiz${result.length !== 1 ? 'zes' : ''}`;
      case 'list_files':         return `${result.length} file${result.length !== 1 ? 's' : ''}`;
      case 'list_announcements': return `${result.length} announcement${result.length !== 1 ? 's' : ''}`;
      case 'list_modules':       return `${result.length} module${result.length !== 1 ? 's' : ''}`;
      default:                   return `${result.length} item${result.length !== 1 ? 's' : ''}`;
    }
  }
  if (result.name) return result.name;
  return '';
}

/**
 * Execute a context tool — queries appData and returns JSON for Gemini to reason over.
 * These NEVER write to the DB; they are read-only.
 */
async function executeAiTool(toolName, params = {}) {
  if (!activeCourseId) return { error: 'No active course selected' };

  switch (toolName) {
    case 'list_assignments':
      return (appData.assignments || [])
        .filter(a => a.courseId === activeCourseId)
        .map(a => ({ id: a.id, title: a.title, type: a.assignmentType || 'essay', gradingType: a.gradingType || 'points', status: a.status, points: a.points, dueDate: a.dueDate }));

    case 'list_quizzes':
      return (appData.quizzes || [])
        .filter(q => q.courseId === activeCourseId)
        .map(q => ({ id: q.id, title: q.title, status: q.status, dueDate: q.dueDate, questionCount: (q.questions || []).length }));

    case 'list_files':
      return (appData.files || [])
        .filter(f => f.courseId === activeCourseId)
        .map(f => ({ id: f.id, name: f.name, type: f.type, size: f.size }));

    case 'list_modules':
      return (appData.modules || [])
        .filter(m => m.courseId === activeCourseId)
        .map(m => ({
          id: m.id, name: m.name,
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
        .map(a => ({ id: a.id, title: a.title, content: (a.content || a.body || ''), pinned: !!a.pinned, hidden: !!a.hidden, createdAt: a.createdAt }));

    case 'get_grade_categories':
      return (appData.gradeCategories || []).filter(c => c.courseId === activeCourseId);

    case 'get_grade_settings':
      return (appData.gradeSettings || []).find(s => s.courseId === activeCourseId) || null;

    case 'list_discussion_threads':
      return (appData.discussionThreads || [])
        .filter(t => t.courseId === activeCourseId)
        .map(t => ({ id: t.id, title: t.title, pinned: !!t.pinned, replyCount: (t.replies || []).length }));

    case 'get_question_bank': {
      const bank = (appData.questionBanks || []).find(b => b.id === params.bank_id && b.courseId === activeCourseId);
      if (!bank) return { error: 'Question bank not found' };
      return { id: bank.id, name: bank.name, questions: (bank.questions || []).map(q => ({ id: q.id, type: q.type, prompt: q.prompt, options: q.options, correctAnswer: q.correctAnswer, points: q.points })) };
    }

    case 'get_assignment': {
      const a = (appData.assignments || []).find(a => a.id === params.assignment_id && a.courseId === activeCourseId);
      return a || { error: 'Assignment not found' };
    }

    case 'get_quiz': {
      const q = (appData.quizzes || []).find(q => q.id === params.quiz_id && q.courseId === activeCourseId);
      return q || { error: 'Quiz not found' };
    }

    case 'get_file_content': {
      const f = (appData.files || []).find(f => f.id === params.file_id && f.courseId === activeCourseId);
      if (!f) return { error: 'File not found' };
      return { id: f.id, name: f.name, type: f.type, note: 'Full content requires fetching from storage — use the file name/description for context' };
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
  return null;
}

/**
 * The core multi-step AI loop. Runs tool calls until it gets an answer/action/ask_user.
 * Each tool step is shown as a pill in the chat thread.
 * Max MAX_STEPS iterations to prevent infinite loops.
 */
async function runAiLoop(contents, systemPrompt) {
  const MAX_STEPS = 6;
  let steps = 0;

  while (steps < MAX_STEPS) {
    steps++;

    const data = await callGeminiAPIWithRetry(contents, { temperature: AI_CONFIG.TEMPERATURE_CHAT });
    if (data.error) throw new Error(data.error.message);

    const rawReply = data.candidates[0].content.parts[0].text.trim();
    const cleaned = rawReply.replace(/^```json\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    let parsed = null;
    try { parsed = JSON.parse(cleaned); } catch { /* not JSON */ }

    // ── Direct text answer ────────────────────────────────────────────────────
    if (!parsed || parsed.type === 'answer') {
      aiThread.push({ role: 'assistant', content: parsed ? parsed.text : rawReply });
      renderAiThread();
      return;
    }

    // ── Tool call ─────────────────────────────────────────────────────────────
    if (parsed.type === 'tool_call') {
      const icon = { list_people:'👥', list_assignments:'📋', list_question_banks:'📚', get_question_bank:'📖', list_announcements:'📣', list_files:'📁', list_modules:'🗂️', list_quizzes:'📝', get_assignment:'📄', get_quiz:'❓', list_discussion_threads:'💬', get_grade_categories:'📊', get_grade_settings:'📊', get_file_content:'📄', list_discussion_threads:'💬' }[parsed.tool] || '🔍';
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

      // Feed result back as the next user turn so the loop continues
      contents = [
        ...contents,
        { role: 'model', parts: [{ text: rawReply }] },
        { role: 'user',  parts: [{ text: `TOOL_RESULT(${parsed.tool}): ${JSON.stringify(result)}\n\nContinue with the original task.` }] }
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
    } else {
      continue; // skip tool_step, pending actions, ask_user
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
    await runAiLoop(contents, systemPrompt);
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
  runAiLoop(resumeContents, msg.systemPrompt || '').finally(() => {
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
  } else if (action.action === 'pipeline' && Array.isArray(action.steps)) {
    aiThread.push({
      role: 'action',
      actionType: 'pipeline',
      data: {
        steps: action.steps,
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
    aiThread.push({
      role: 'action',
      actionType: 'announcement_update',
      data: {
        id: action.id,
        title: action.title,
        content: action.content,
        pinned: action.pinned,
        hidden: action.hidden,
        fileIds: action.fileIds || [],
        fileNames: action.fileNames || []
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'delete_announcement') {
    aiThread.push({
      role: 'action',
      actionType: 'announcement_delete',
      data: { id: action.id },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'publish_announcement') {
    aiThread.push({
      role: 'action',
      actionType: 'announcement_publish',
      data: { id: action.id },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'pin_announcement') {
    aiThread.push({
      role: 'action',
      actionType: 'announcement_pin',
      data: { id: action.id, pinned: action.pinned !== false },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'update_announcement') {
    aiThread.push({
      role: 'action',
      actionType: 'announcement_update',
      data: {
        id: action.id,
        title: action.title,
        content: action.content,
        pinned: action.pinned,
        hidden: action.hidden
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'delete_announcement') {
    aiThread.push({
      role: 'action',
      actionType: 'announcement_delete',
      data: { id: action.id },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'publish_announcement') {
    aiThread.push({
      role: 'action',
      actionType: 'announcement_publish',
      data: { id: action.id },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'pin_announcement') {
    aiThread.push({
      role: 'action',
      actionType: 'announcement_pin',
      data: { id: action.id, pinned: action.pinned !== false },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'create_quiz_from_bank') {
    const defaultDueDate = new Date(Date.now() + 86400000 * 7).toISOString();
    aiThread.push({
      role: 'action',
      actionType: 'quiz_from_bank',
      data: {
        title: action.title,
        description: action.description || '',
        category: action.category || 'quiz',
        questionBankId: action.questionBankId,
        questionBankName: action.questionBankName || '',
        numQuestions: action.numQuestions || 0,
        randomizeQuestions: action.randomizeQuestions !== undefined ? action.randomizeQuestions : false,
        randomizeAnswers: action.randomizeAnswers !== undefined ? action.randomizeAnswers : true,
        dueDate: action.dueDate || defaultDueDate,
        availableFrom: action.availableFrom || null,
        availableUntil: action.availableUntil || action.dueDate || defaultDueDate,
        points: action.points || 100,
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
      role: 'action',
      actionType: 'quiz',
      data: {
        title: action.title,
        description: action.description || '',
        dueDate: action.dueDate || new Date(Date.now() + 86400000 * 7).toISOString(),
        status: action.status || 'draft',
        timeLimit: action.timeLimit ?? 30,
        attempts: action.attempts ?? 1,
        randomizeQuestions: !!action.randomizeQuestions,
        availableFrom: action.availableFrom || null,
        availableUntil: action.availableUntil || null,
        allowLateSubmissions: action.allowLateSubmissions !== undefined ? !!action.allowLateSubmissions : true,
        latePenaltyType: action.latePenaltyType || 'per_day',
        lateDeduction: action.lateDeduction !== undefined ? action.lateDeduction : 10,
        questions: action.questions || [],
        fileIds: action.fileIds || [],
        fileNames: action.fileNames || []
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'update_quiz') {
    aiThread.push({
      role: 'action',
      actionType: 'quiz_update',
      data: {
        id: action.id,
        title: action.title,
        description: action.description,
        dueDate: action.dueDate,
        status: action.status,
        timeLimit: action.timeLimit,
        attempts: action.attempts,
        randomizeQuestions: action.randomizeQuestions,
        availableFrom: action.availableFrom,
        availableUntil: action.availableUntil,
        questions: action.questions,
        fileIds: action.fileIds || [],
        fileNames: action.fileNames || []
      },
      confirmed: false,
      rejected: false
    });
  } else if (action.action === 'delete_quiz') {
    aiThread.push({
      role: 'action',
      actionType: 'quiz_delete',
      data: { id: action.id },
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
  } else if (action.action === 'update_assignment') {
    aiThread.push({
      role: 'action',
      actionType: 'assignment_update',
      data: {
        id: action.id,
        title: action.title,
        description: action.description,
        points: action.points,
        dueDate: action.dueDate,
        status: action.status,
        category: action.category,
        allowLateSubmissions: action.allowLateSubmissions,
        lateDeduction: action.lateDeduction,
        allowResubmission: action.allowResubmission,
        notes: action.notes || ''
      },
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
    case 'module':
      return `Done! Created module ${b(d.name || 'Untitled')}. Add content from ${pageLink('modules', 'Modules')}.`;
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
    const quizDescription = appendFileLinksToContent(
      appendAvailabilityToDescription(resolved.description || '', resolved.availableFrom, resolved.availableUntil),
      resolved.fileIds
    );

    const newQuiz = {
      id: generateId(),
      courseId: activeCourseId,
      title: resolved.title,
      description: quizDescription,
      status: publish ? 'published' : (resolved.status || 'draft'),
      dueDate: resolved.dueDate || new Date(Date.now() + 86400000 * 7).toISOString(),
      createdAt: new Date().toISOString(),
      timeLimit: resolved.timeLimit ?? 30,
      attempts: resolved.attempts ?? 1,
      randomizeQuestions: !!resolved.randomizeQuestions,
      questionPoolEnabled: false,
      questionSelectCount: 0,
      questions: resolved.questions || []
    };
    const result = await supabaseCreateQuiz(newQuiz);
    if (!result) {
      showToast('Failed to save quiz to database', 'error');
      return false;
    }
    appData.quizzes.push(newQuiz);
    if (renderAssignmentsCallback) renderAssignmentsCallback();
    return true;
  }

  if (action === 'quiz_update') {
    const quiz = appData.quizzes.find(q => q.id === resolved.id && q.courseId === activeCourseId);
    if (!quiz) {
      showToast('Quiz not found for update', 'error');
      return false;
    }
    if (resolved.title !== undefined) quiz.title = resolved.title;
    if (resolved.description !== undefined || resolved.availableFrom || resolved.availableUntil || (resolved.fileIds && resolved.fileIds.length)) {
      const baseDescription = resolved.description !== undefined ? resolved.description : quiz.description;
      quiz.description = appendFileLinksToContent(
        appendAvailabilityToDescription(baseDescription, resolved.availableFrom, resolved.availableUntil),
        resolved.fileIds
      );
    }
    if (resolved.dueDate !== undefined) quiz.dueDate = resolved.dueDate;
    if (resolved.status !== undefined) quiz.status = resolved.status;
    if (publish) quiz.status = 'published';
    if (resolved.timeLimit !== undefined) quiz.timeLimit = resolved.timeLimit;
    if (resolved.attempts !== undefined) quiz.attempts = resolved.attempts;
    if (resolved.randomizeQuestions !== undefined) quiz.randomizeQuestions = !!resolved.randomizeQuestions;
    if (resolved.questions !== undefined) quiz.questions = resolved.questions;
    const result = await supabaseUpdateQuiz(quiz);
    if (!result) {
      showToast('Failed to update quiz', 'error');
      return false;
    }
    if (renderAssignmentsCallback) renderAssignmentsCallback();
    return true;
  }

  if (action === 'quiz_delete') {
    const success = await supabaseDeleteQuiz(resolved.id);
    if (!success) {
      showToast('Failed to delete quiz', 'error');
      return false;
    }
    appData.quizzes = appData.quizzes.filter(q => q.id !== resolved.id);
    appData.quizSubmissions = (appData.quizSubmissions || []).filter(s => s.quizId !== resolved.id);
    if (renderAssignmentsCallback) renderAssignmentsCallback();
    return true;
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
        'module_add_item': 'Module Item',
        'module_remove_item': 'Module Item',
        'module_move_item': 'Module Item',
        'invite_create': 'Invitation',
        'invite_revoke': 'Invitation',
        'person_remove': 'Person',
        'course_visibility': 'Course Visibility',
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
        'module_add_item': 'Add to',
        'module_remove_item': 'Remove from',
        'module_move_item': 'Move to',
        'invite_create': 'Send',
        'invite_revoke': 'Revoke',
        'person_remove': 'Remove',
        'course_visibility': msg.data?.visible === false ? 'Hide' : 'Show',
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
                ${['announcement', 'assignment', 'quiz', 'quiz_from_bank'].includes(msg.actionType) ? `
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

  // ─── ANNOUNCEMENT (update) ───────────────────────────────────────────────
  if (msg.actionType === 'announcement_update') {
    const ann = (appData.announcements || []).find(a => a.id === d.id);
    const resolvedTitle = d.title !== undefined ? d.title : (ann?.title || '');
    const resolvedContent = d.content !== undefined ? d.content : (ann?.content || '');
    const resolvedPinned = d.pinned !== undefined ? d.pinned : (ann?.pinned || false);
    return `
      <div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Editing: ${escapeHtml(ann?.title || d.id || '')}</div>
      ${field('Title', textInput('title', resolvedTitle))}
      ${field('Content', textarea('content', resolvedContent, 5))}
      <div style="margin-bottom:4px;">${checkboxInput('pinned', resolvedPinned, 'Pinned')}</div>
      <div style="margin-top:4px;">${checkboxInput('hidden', d.hidden, 'Hidden from students')}</div>
    `;
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

  // ─── QUIZ (inline) ───────────────────────────────────────────────────────
  if (msg.actionType === 'quiz') {
    return `
      ${field('Title', textInput('title', d.title))}
      ${field('Description', textarea('description', d.description, 2))}
      ${twoCol(
        field('Due Date', datetimeInput('dueDate', d.dueDate), 0),
        field('Points', numberInput('points', d.points ?? 100, 0, 9999), 0)
      )}
      ${twoCol(
        field('Time Limit (minutes)', numberInput('timeLimit', d.timeLimit ?? 30, 0, 600), 0),
        field('Attempts Allowed', numberInput('attempts', d.attempts ?? 1, 1, 99), 0)
      )}
      ${twoCol(
        field('Status', selectInput('status', d.status || 'draft', [['draft','Draft'],['published','Published']]), 0),
        field('Available From', datetimeInput('availableFrom', d.availableFrom), 0)
      )}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:8px;">
        <div>${checkboxInput('randomizeQuestions', d.randomizeQuestions, 'Randomize question order')}</div>
      </div>
      <div class="muted" style="font-size:0.85rem;">${d.questions?.length || 0} question${d.questions?.length !== 1 ? 's' : ''} included</div>
    `;
  }

  // ─── QUIZ (update) ───────────────────────────────────────────────────────
  if (msg.actionType === 'quiz_update') {
    const quiz = (appData.quizzes || []).find(q => q.id === d.id);
    return `
      <div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Editing: ${escapeHtml(quiz?.title || d.id || '')}</div>
      ${field('Title', textInput('title', d.title || quiz?.title || ''))}
      ${field('Description', textarea('description', d.description !== undefined ? d.description : (quiz?.description || ''), 2))}
      ${twoCol(
        field('Due Date', datetimeInput('dueDate', d.dueDate || quiz?.dueDate), 0),
        field('Status', selectInput('status', d.status || quiz?.status || 'draft', [['draft','Draft'],['published','Published'],['closed','Closed']]), 0)
      )}
      ${twoCol(
        field('Time Limit (min)', numberInput('timeLimit', d.timeLimit !== undefined ? d.timeLimit : (quiz?.timeLimit ?? 30), 0, 600), 0),
        field('Attempts', numberInput('attempts', d.attempts !== undefined ? d.attempts : (quiz?.attempts ?? 1), 1, 99), 0)
      )}
      <div>${checkboxInput('randomizeQuestions', d.randomizeQuestions !== undefined ? d.randomizeQuestions : !!quiz?.randomizeQuestions, 'Randomize question order')}</div>
    `;
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
      <div>${checkboxInput('allowResubmission', d.allowResubmission, 'Allow resubmission')}</div>
    `;
  }

  // ─── ASSIGNMENT (update) — CC 1.4 aligned ────────────────────────────────
  if (msg.actionType === 'assignment_update') {
    const a = (appData.assignments || []).find(a => a.id === d.id);
    return `
      <div class="muted" style="font-size:0.8rem; margin-bottom:8px;">Editing: ${escapeHtml(a?.title || d.id || '')}</div>
      ${field('Title', textInput('title', d.title !== undefined ? d.title : (a?.title || '')))}
      ${field('Description', textarea('description', d.description !== undefined ? d.description : (a?.description || ''), 3))}
      ${twoCol(
        field('Assignment Type', selectInput('assignmentType', d.assignmentType || a?.assignmentType || 'essay', [
          ['essay','Essay / Free Text'],['quiz','Quiz / Exam'],['no_submission','No Submission']
        ]), 0),
        field('Points', numberInput('points', d.points !== undefined ? d.points : (a?.points ?? 100), 0, 9999), 0)
      )}
      ${twoCol(
        field('Due Date', datetimeInput('dueDate', d.dueDate || a?.dueDate), 0),
        field('Status', selectInput('status', d.status || a?.status || 'draft', [['draft','Draft'],['published','Published'],['closed','Closed']]), 0)
      )}
      ${lateSection(
        d.allowLateSubmissions !== undefined ? d.allowLateSubmissions : (a?.allowLateSubmissions || false),
        d.lateDeduction !== undefined ? d.lateDeduction : (a?.lateDeduction ?? 10)
      )}
      <div>${checkboxInput('allowResubmission', d.allowResubmission !== undefined ? d.allowResubmission : (a?.allowResubmission || false), 'Allow resubmission')}</div>
    `;
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

  // ─── PIPELINE ────────────────────────────────────────────────────────────
  if (msg.actionType === 'pipeline') {
    const steps = Array.isArray(d.steps) ? d.steps : [];
    const stepsHtml = steps.map((step, i) => {
      const idText = step.id || step.quizId || step.announcementId || step.assignmentId || step.moduleId || '';
      const title = step.title || step.name || '';
      return `<li style="margin-bottom:6px;"><code>${escapeHtml(step.action || 'unknown')}</code>${title ? ` — <em>${escapeHtml(title)}</em>` : ''}${idText ? ` <span class="muted" style="font-size:0.8rem;">(${escapeHtml(idText)})</span>` : ''}</li>`;
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

  const questionCountEl = document.getElementById('aiQuestionCount');
  if (questionCountEl) questionCountEl.value = '5';

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
  const quizGroup = document.getElementById('aiQuizGroup');

  if (rubricGroup) rubricGroup.style.display = aiDraftType === 'rubric' ? 'block' : 'none';
  if (quizGroup) quizGroup.style.display = aiDraftType === 'quiz' ? 'block' : 'none';
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
  } else if (aiDraftType === 'quiz') {
    const countEl = document.getElementById('aiQuestionCount');
    const count = parseInt(countEl?.value, 10) || 5;
    systemPrompt = AI_PROMPTS.createQuiz(count);
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

  if (aiDraftType === 'quiz') {
    const questionsHtml = (aiDraft.questions || []).map((q, i) => `
      <div style="padding:8px; background:var(--bg-color); border-radius:var(--radius); margin-bottom:8px;">
        <div style="font-weight:500;">${i + 1}. ${escapeHtml(q.prompt)}</div>
        <div class="muted" style="font-size:0.85rem;">${q.type} · ${q.points} pts</div>
      </div>
    `).join('');

    preview.innerHTML = `
      <div class="card">
        <div class="card-title">${escapeHtml(aiDraft.title || 'Untitled quiz')}</div>
        ${aiDraft.description ? `<p class="muted">${escapeHtml(aiDraft.description)}</p>` : ''}
        <div style="margin-top:12px;">${questionsHtml}</div>
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
  } else if (aiDraftType === 'quiz') {
    // Store for quiz modal
    window.aiQuizDraft = aiDraft;
    closeModal('aiCreateModal');
    // Open quiz modal with draft
    if (window.openQuizModal) window.openQuizModal(null);
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
