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
  supabaseCreateAnnouncement, supabaseCreateQuiz, supabaseCreateAssignment, supabaseCreateModule
} from './database_interactions.js';
import { AI_PROMPTS, AI_CONFIG } from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════════

let appData = null;
let activeCourseId = null;
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

      // Add assignments
      const assignments = appData.assignments?.filter(a => a.courseId === activeCourseId) || [];
      if (assignments.length > 0) {
        context += `\nCOURSE ASSIGNMENTS (${assignments.length}):\n`;
        assignments.forEach(a => {
          context += `- ${a.title} (${a.points} pts, due: ${new Date(a.dueDate).toLocaleDateString()}, status: ${a.status})\n`;
        });
      }

      // Add quizzes
      const quizzes = appData.quizzes?.filter(q => q.courseId === activeCourseId) || [];
      if (quizzes.length > 0) {
        context += `\nCOURSE QUIZZES (${quizzes.length}):\n`;
        quizzes.forEach(q => {
          context += `- ${q.title} (due: ${new Date(q.dueDate).toLocaleDateString()}, status: ${q.status})\n`;
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

      // Add modules
      const modules = appData.modules?.filter(m => m.courseId === activeCourseId) || [];
      if (modules.length > 0) {
        context += `\nCOURSE MODULES (${modules.length}):\n`;
        modules.forEach(m => {
          context += `- ${m.name} (${m.items?.length || 0} items)\n`;
        });
      }
    }
  }

  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a message to the AI assistant
 */
export async function sendAiMessage(audioBase64 = null) {
  const input = document.getElementById('aiInput');
  const message = audioBase64 ? '[Voice message]' : input?.value.trim();

  if (!message && !audioBase64) return;

  // Prevent double-sends while processing
  if (aiProcessing) return;
  aiProcessing = true;
  updateAiProcessingState();

  const isStaffUser = activeCourseId && isStaffCallback && isStaffCallback(appData.currentUser.id, activeCourseId);

  // Use enhanced context builder
  const context = buildAiContext();

  // Build conversation context from last 3 exchanges
  const conversationContext = aiThread.slice(-6).map(msg => {
    if (msg.role === 'user') return `User: ${msg.content}`;
    if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
    if (msg.role === 'action') return `Assistant: [Created ${msg.actionType}]`;
    return '';
  }).filter(Boolean).join('\n');

  const systemPrompt = AI_PROMPTS.chatAssistant(isStaffUser, context, conversationContext);

  aiThread.push({ role: 'user', content: audioBase64 ? '🎤 Voice message' : message });
  if (!audioBase64 && input) input.value = '';
  renderAiThread();

  try {
    let contents;

    if (audioBase64) {
      // Voice message - send audio to Gemini
      contents = [{
        parts: [
          { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
          { text: systemPrompt + '\n\nTranscribe and respond to this voice message:' }
        ]
      }];
    } else {
      contents = [{ parts: [{ text: systemPrompt + '\n\nUser: ' + message }] }];
    }

    const data = await callGeminiAPIWithRetry(contents, { temperature: AI_CONFIG.TEMPERATURE_CHAT });

    if (data.error) {
      throw new Error(data.error.message);
    }

    const reply = data.candidates[0].content.parts[0].text.trim();

    // Check if it's a JSON action
    if (reply.startsWith('{') && reply.includes('"action"')) {
      try {
        const action = JSON.parse(reply);
        handleAiAction(action);
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

/**
 * Handle AI action response
 */
function handleAiAction(action) {
  if (action.action === 'create_announcement') {
    aiThread.push({
      role: 'action',
      actionType: 'announcement',
      data: { title: action.title, content: action.content },
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
 * Confirm and execute an AI action
 */
export async function confirmAiAction(idx, publish = false) {
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

    const result = await supabaseCreateAnnouncement(announcement);
    if (!result) {
      showToast('Failed to save announcement to database', 'error');
      return;
    }

    appData.announcements.push(announcement);
    msg.wasPublished = publish;
    if (renderUpdatesCallback) renderUpdatesCallback();
    if (renderHomeCallback) renderHomeCallback();
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

    const result = await supabaseCreateQuiz(newQuiz);
    if (!result) {
      showToast('Failed to save quiz to database', 'error');
      return;
    }

    appData.quizzes.push(newQuiz);
    if (renderAssignmentsCallback) renderAssignmentsCallback();
    showToast('Quiz created as draft!', 'success');
  } else if (msg.actionType === 'quiz_from_bank') {
    const defaultDueDate = new Date(Date.now() + 86400000 * 7).toISOString();
    const newAssignment = {
      id: generateId(),
      courseId: activeCourseId,
      title: msg.data.title,
      description: msg.data.description || '',
      category: msg.data.category || 'quiz',
      points: msg.data.points || 100,
      dueDate: msg.data.dueDate || defaultDueDate,
      status: 'draft',
      allowLateSubmissions: msg.data.allowLateSubmissions !== false,
      latePenaltyType: msg.data.latePenaltyType || 'per_day',
      lateDeduction: msg.data.lateDeduction !== undefined ? msg.data.lateDeduction : 10,
      gradingNotes: msg.data.gradingNotes || '',
      allowResubmission: false,
      questionBankId: msg.data.questionBankId,
      numQuestions: msg.data.numQuestions || 0,
      randomizeQuestions: msg.data.randomizeQuestions || false,
      randomizeAnswers: msg.data.randomizeAnswers || true,
      createdAt: new Date().toISOString(),
      createdBy: appData.currentUser?.id
    };

    const result = await supabaseCreateAssignment(newAssignment);
    if (!result) {
      showToast('Failed to save quiz/exam to database', 'error');
      return;
    }

    appData.assignments.push(newAssignment);
    if (renderAssignmentsCallback) renderAssignmentsCallback();
    showToast(`${msg.data.category === 'exam' ? 'Exam' : 'Quiz'} created as draft!`, 'success');
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

    const result = await supabaseCreateAssignment(newAssignment);
    if (!result) {
      showToast('Failed to save assignment to database', 'error');
      return;
    }

    appData.assignments.push(newAssignment);
    if (renderAssignmentsCallback) renderAssignmentsCallback();
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

    const result = await supabaseCreateModule(newModule);
    if (!result) {
      showToast('Failed to save module to database', 'error');
      return;
    }

    appData.modules.push(newModule);
    if (renderModulesCallback) renderModulesCallback();
    showToast('Module created!', 'success');
  }

  msg.confirmed = true;
  renderAiThread();
}

/**
 * Reject an AI action
 */
export function rejectAiAction(idx) {
  const msg = aiThread[idx];
  if (!msg || msg.role !== 'action') return;
  msg.rejected = true;
  aiThread.push({ role: 'assistant', content: 'No problem! Let me know if you need anything else.' });
  renderAiThread();
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
    if (msg.role === 'assistant') {
      return `
        <div style="margin-bottom:16px; display:flex;">
          <div style="background:var(--bg-color); padding:12px 16px; border-radius:16px 16px 16px 4px; max-width:85%; border:1px solid var(--border-color);">
            <div class="markdown-content">${renderMarkdown(msg.content)}</div>
          </div>
        </div>
      `;
    }
    if (msg.role === 'action') {
      const actionLabel = {
        'announcement': 'Announcement',
        'quiz': 'Quiz',
        'quiz_from_bank': 'Quiz/Exam',
        'assignment': 'Assignment',
        'module': 'Module'
      }[msg.actionType] || 'Content';

      return `
        <div style="margin-bottom:16px; display:flex;">
          <div style="background:var(--primary-light); padding:16px; border-radius:16px 16px 16px 4px; max-width:90%; border:1px solid var(--primary);">
            <div style="font-weight:600; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.1rem;">📝</span> Create ${actionLabel}
            </div>
            ${renderActionPreview(msg, idx)}
            ${msg.confirmed ? `
              <div style="color:var(--success); font-weight:500;">✓ Created successfully${msg.wasPublished ? '' : ' as draft'}</div>
            ` : msg.rejected ? `
              <div style="color:var(--text-muted);">✗ Cancelled</div>
            ` : isLatest ? `
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
                <button class="btn btn-primary btn-sm" onclick="window.confirmAiAction(${idx}, false)">Create this</button>
                ${msg.actionType === 'announcement' ? `
                  <button class="btn btn-primary btn-sm" onclick="window.confirmAiAction(${idx}, true)">Create and Publish</button>
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
 * Render preview for an action
 */
function renderActionPreview(msg, idx) {
  if (msg.actionType === 'announcement') {
    return `
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label" style="font-size:0.85rem;">Title</label>
        <input type="text" class="form-input" value="${escapeHtml(msg.data.title)}" onchange="window.updateAiActionField(${idx}, 'title', this.value)">
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:0.85rem;">Content</label>
        <textarea class="form-textarea" rows="4" onchange="window.updateAiActionField(${idx}, 'content', this.value)">${escapeHtml(msg.data.content)}</textarea>
      </div>
    `;
  }
  if (msg.actionType === 'quiz') {
    return `
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label" style="font-size:0.85rem;">Title</label>
        <input type="text" class="form-input" value="${escapeHtml(msg.data.title)}" onchange="window.updateAiActionField(${idx}, 'title', this.value)">
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label" style="font-size:0.85rem;">Description</label>
        <textarea class="form-textarea" rows="2" onchange="window.updateAiActionField(${idx}, 'description', this.value)">${escapeHtml(msg.data.description || '')}</textarea>
      </div>
      <div class="muted" style="font-size:0.85rem;">${msg.data.questions?.length || 0} questions</div>
    `;
  }
  if (msg.actionType === 'quiz_from_bank') {
    return `
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label" style="font-size:0.85rem;">Title</label>
        <input type="text" class="form-input" value="${escapeHtml(msg.data.title)}" onchange="window.updateAiActionField(${idx}, 'title', this.value)">
      </div>
      <div class="muted" style="font-size:0.85rem;">From: ${escapeHtml(msg.data.questionBankName)} · ${msg.data.numQuestions || 'All'} questions</div>
    `;
  }
  if (msg.actionType === 'assignment') {
    return `
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label" style="font-size:0.85rem;">Title</label>
        <input type="text" class="form-input" value="${escapeHtml(msg.data.title)}" onchange="window.updateAiActionField(${idx}, 'title', this.value)">
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:0.85rem;">Description</label>
        <textarea class="form-textarea" rows="3" onchange="window.updateAiActionField(${idx}, 'description', this.value)">${escapeHtml(msg.data.description || '')}</textarea>
      </div>
    `;
  }
  if (msg.actionType === 'module') {
    return `
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:0.85rem;">Module Name</label>
        <input type="text" class="form-input" value="${escapeHtml(msg.data.name)}" onchange="window.updateAiActionField(${idx}, 'name', this.value)">
      </div>
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
  window.confirmAiAction = confirmAiAction;
  window.rejectAiAction = rejectAiAction;
  window.updateAiActionField = updateAiActionField;
  window.toggleAiRecording = toggleAiRecording;
  window.generateAiDraft = generateAiDraft;
  window.applyAiDraft = applyAiDraft;
  window.updateAiCreateType = updateAiCreateType;
  window.openAiCreateModal = openAiCreateModal;
}
