/* ═══════════════════════════════════════════════════════════════════════════════
   Quiz Logic Module for Campus LMS
   Quiz creation, editing, taking, and grading functionality
═══════════════════════════════════════════════════════════════════════════════ */

import {
  showToast, setHTML, setText, escapeHtml, generateId, openModal, closeModal,
  getQuizPoints, shuffleArray, setDateTimeSelectors, getDateTimeFromSelectors, formatDate
} from './ui_helpers.js';
import {
  supabaseCreateQuiz, supabaseUpdateQuiz, supabaseDeleteQuiz, supabaseUpsertQuizSubmission
} from './database_interactions.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════════

let appData = null;
let activeCourseId = null;
let quizDraftQuestions = [];
let currentEditQuizId = null;
let currentQuizTakingId = null;
let quizTimerInterval = null;
let quizTimeRemaining = null;
let aiQuizDraft = null;

// Callbacks
let renderAssignmentsCallback = null;
let renderHomeCallback = null;
let isStaffCallback = null;
let getUserByIdCallback = null;
let ensureModalsRenderedCallback = null;
let confirmCallback = null;

/**
 * Initialize the quiz module with dependencies
 */
export function initQuizModule(deps) {
  appData = deps.appData;
  renderAssignmentsCallback = deps.renderAssignments;
  renderHomeCallback = deps.renderHome;
  isStaffCallback = deps.isStaff;
  getUserByIdCallback = deps.getUserById;
  ensureModalsRenderedCallback = deps.ensureModalsRendered;
  confirmCallback = deps.confirm;
}

/**
 * Set the active course ID
 */
export function setActiveCourseForQuiz(courseId) {
  activeCourseId = courseId;
}

/**
 * Set AI quiz draft
 */
export function setAiQuizDraft(draft) {
  aiQuizDraft = draft;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ CREATION/EDITING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a default question of the specified type
 */
export function createDefaultQuestion(type = 'multiple_choice') {
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

/**
 * Open the quiz modal for creating or editing a quiz
 */
export function openQuizModal(quizId = null) {
  if (ensureModalsRenderedCallback) ensureModalsRenderedCallback();
  currentEditQuizId = quizId;
  const quiz = quizId ? appData.quizzes.find(q => q.id === quizId) : null;

  const draft = !quiz && aiQuizDraft ? aiQuizDraft : null;

  const titleEl = document.getElementById('quizModalTitle');
  const quizTitleEl = document.getElementById('quizTitle');
  const descEl = document.getElementById('quizDescription');

  if (titleEl) titleEl.textContent = quiz ? 'Edit Quiz' : 'New Quiz';
  if (quizTitleEl) quizTitleEl.value = quiz ? quiz.title : (draft?.title || '');
  if (descEl) descEl.value = quiz ? quiz.description || '' : (draft?.description || '');

  setDateTimeSelectors('quizDueDate', 'quizDueHour', 'quizDueMinute', 'quizDueAmPm', quiz ? quiz.dueDate : null);

  const statusEl = document.getElementById('quizStatus');
  const timeLimitEl = document.getElementById('quizTimeLimit');
  const attemptsEl = document.getElementById('quizAttempts');
  const randomizeEl = document.getElementById('quizRandomize');
  const poolEnabledEl = document.getElementById('quizPoolEnabled');
  const poolCountEl = document.getElementById('quizPoolCount');

  if (statusEl) statusEl.value = quiz ? quiz.status : 'draft';
  if (timeLimitEl) timeLimitEl.value = quiz ? quiz.timeLimit || '' : '';
  if (attemptsEl) attemptsEl.value = quiz ? quiz.attempts || '' : '';
  if (randomizeEl) randomizeEl.checked = quiz ? quiz.randomizeQuestions === true : true;
  if (poolEnabledEl) poolEnabledEl.checked = quiz ? quiz.questionPoolEnabled === true : false;
  if (poolCountEl) poolCountEl.value = quiz ? quiz.questionSelectCount || '' : '';

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

/**
 * Toggle visibility of question pool fields
 */
export function toggleQuizPoolFields() {
  const enabled = document.getElementById('quizPoolEnabled')?.checked;
  const poolGroup = document.getElementById('quizPoolCountGroup');
  if (poolGroup) {
    poolGroup.style.display = enabled ? 'block' : 'none';
  }
}

/**
 * Render quiz questions in the editor
 */
export function renderQuizQuestions() {
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
              <input type="text" class="form-input" value="${escapeHtml(opt)}" oninput="window.updateQuizOption(${index}, ${optIndex}, this.value)" placeholder="Option ${optIndex + 1}">
            </div>
          `).join('')}
          <div class="form-group">
            <label class="form-label">Correct answer</label>
            <select class="form-select" onchange="window.updateQuizQuestion(${index}, 'correctAnswer', this.value)">
              ${q.options.map((opt, optIndex) => `
                <option value="${optIndex}" ${parseInt(q.correctAnswer) === optIndex ? 'selected' : ''}>${escapeHtml(opt) || `Option ${optIndex + 1}`}</option>
              `).join('')}
            </select>
          </div>
        </div>
      `;
    } else if (q.type === 'true_false') {
      optionsHtml = `
        <div class="form-group">
          <label class="form-label">Correct answer</label>
          <select class="form-select" onchange="window.updateQuizQuestion(${index}, 'correctAnswer', this.value)">
            <option value="True" ${q.correctAnswer === 'True' ? 'selected' : ''}>True</option>
            <option value="False" ${q.correctAnswer === 'False' ? 'selected' : ''}>False</option>
          </select>
        </div>
      `;
    } else {
      optionsHtml = `
        <div class="form-group">
          <label class="form-label">Sample answer (optional)</label>
          <textarea class="form-textarea" rows="2" oninput="window.updateQuizQuestion(${index}, 'correctAnswer', this.value)" placeholder="Add a reference answer">${escapeHtml(q.correctAnswer || '')}</textarea>
        </div>
      `;
    }

    const imagePreview = q.imageUrl ? `<div style="margin:8px 0;"><img src="${escapeHtml(q.imageUrl)}" style="max-width:100%; max-height:200px; border-radius:var(--radius); border:1px solid var(--border-light);" alt="Question image"></div>` : '';

    return `
      <div class="quiz-question-card">
        <div class="quiz-question-header">
          <div class="form-group">
            <label class="form-label">Question ${index + 1}</label>
            <input type="text" class="form-input" value="${escapeHtml(q.prompt)}" oninput="window.updateQuizQuestion(${index}, 'prompt', this.value)" placeholder="Write the question...">
          </div>
          <div class="form-group" style="margin-top:4px;">
            <input type="text" class="form-input" value="${escapeHtml(q.imageUrl || '')}" oninput="window.updateQuizQuestion(${index}, 'imageUrl', this.value)" placeholder="Image URL (optional)" style="font-size:0.85rem;">
          </div>
          ${imagePreview}
          <div class="quiz-question-meta">
            <select class="form-select" onchange="window.updateQuizQuestion(${index}, 'type', this.value)">
              ${typeOptions}
            </select>
            <input type="number" class="form-input" value="${q.points}" min="1" oninput="window.updateQuizQuestion(${index}, 'points', this.value)" placeholder="Points">
            <button class="btn btn-secondary btn-sm" onclick="window.removeQuizQuestion(${index})">Remove</button>
          </div>
        </div>
        ${optionsHtml}
      </div>
    `;
  }).join('');

  updateQuizPointsTotal();
}

/**
 * Update a quiz question field
 */
export function updateQuizQuestion(index, field, value) {
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

  if (field === 'imageUrl') {
    question.imageUrl = value || null;
    // Re-render to show/hide preview
    renderQuizQuestions();
    return;
  }

  question[field] = value;
}

/**
 * Update a quiz option text
 */
export function updateQuizOption(questionIndex, optionIndex, value) {
  const question = quizDraftQuestions[questionIndex];
  if (!question || !question.options) return;
  question.options[optionIndex] = value;
}

/**
 * Add a new quiz question
 */
export function addQuizQuestion() {
  quizDraftQuestions.push(createDefaultQuestion());
  renderQuizQuestions();
}

/**
 * Remove a quiz question
 */
export function removeQuizQuestion(index) {
  quizDraftQuestions.splice(index, 1);
  if (quizDraftQuestions.length === 0) {
    quizDraftQuestions.push(createDefaultQuestion());
  }
  renderQuizQuestions();
}

/**
 * Update the quiz points total display
 */
export function updateQuizPointsTotal() {
  const total = quizDraftQuestions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
  const el = document.getElementById('quizPointsTotal');
  if (el) el.textContent = total.toFixed(1);
}

/**
 * Save the quiz
 */
export async function saveQuiz() {
  const title = document.getElementById('quizTitle')?.value.trim();
  const description = document.getElementById('quizDescription')?.value.trim();
  const dueDate = getDateTimeFromSelectors('quizDueDate', 'quizDueHour', 'quizDueMinute', 'quizDueAmPm');
  const status = document.getElementById('quizStatus')?.value;
  const timeLimit = parseInt(document.getElementById('quizTimeLimit')?.value, 10) || 0;
  const attempts = parseInt(document.getElementById('quizAttempts')?.value, 10) || 0;
  const randomizeQuestions = document.getElementById('quizRandomize')?.checked;
  const questionPoolEnabled = document.getElementById('quizPoolEnabled')?.checked;
  const questionSelectCount = parseInt(document.getElementById('quizPoolCount')?.value, 10) || 0;

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

  let result;
  if (isNewQuiz) {
    result = await supabaseCreateQuiz(quizData);
  } else {
    result = await supabaseUpdateQuiz(quizData);
  }
  if (!result) return;

  const existingIndex = appData.quizzes.findIndex(q => q.id === quizData.id);
  if (existingIndex >= 0) {
    appData.quizzes[existingIndex] = quizData;
  } else {
    appData.quizzes.push(quizData);
  }

  closeModal('quizModal');
  if (renderAssignmentsCallback) renderAssignmentsCallback();
  if (renderHomeCallback) renderHomeCallback();
  showToast('Quiz saved!', 'success');
}

/**
 * Delete a quiz
 */
export function deleteQuiz(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  const doDelete = async () => {
    const success = await supabaseDeleteQuiz(quizId);
    if (!success) return;

    appData.quizzes = appData.quizzes.filter(q => q.id !== quizId);
    appData.quizSubmissions = appData.quizSubmissions.filter(s => s.quizId !== quizId);

    if (renderAssignmentsCallback) renderAssignmentsCallback();
    if (renderHomeCallback) renderHomeCallback();
    showToast('Quiz deleted', 'success');
  };

  if (confirmCallback) {
    confirmCallback(`Delete "${quiz.title}"? This will also delete all submissions.`, doDelete);
  } else {
    doDelete();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ TAKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start taking a quiz
 */
export function takeQuiz(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  const isStaffUser = isStaffCallback && isStaffCallback(appData.currentUser.id, activeCourseId);
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

/**
 * Render the quiz taking modal
 */
export function renderQuizTakeModal(quiz) {
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
    const type = q.type || 'mc_single';
    const pts = parseFloat(q.points) || 1;
    const hintHtml = q.hint ? `<div class="quiz-hint" style="margin-top:4px;"><button class="btn btn-secondary btn-sm" style="font-size:0.8rem;" onclick="this.nextElementSibling.style.display='block';this.style.display='none';">Show Hint</button><div style="display:none; margin-top:4px; padding:8px; background:var(--surface); border-radius:4px; font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(q.hint)}</div></div>` : '';
    const imageHtml = q.imageUrl ? `<div style="margin:8px 0;"><img src="${escapeHtml(q.imageUrl)}" style="max-width:100%; max-height:300px; border-radius:var(--radius);" alt="Question image"></div>` : '';

    if (type === 'mc_single' || type === 'multiple_choice') {
      let opts = q.options || [];
      if (q.shuffleOptions) opts = [...opts].sort(() => Math.random() - 0.5);
      return `
        <div class="quiz-question-block">
          <div class="quiz-question-title">${index + 1}. ${escapeHtml(q.prompt)} <span style="font-size:0.8rem; color:var(--text-secondary);">(${pts} pt${pts!==1?'s':''})</span></div>
          ${imageHtml}
          ${hintHtml}
          ${opts.map((opt, optIndex) => `
            <label class="quiz-answer-option">
              <input type="radio" name="quizQuestion${index}" value="${optIndex}">
              <span>${escapeHtml(typeof opt === 'object' ? opt.text || '' : opt)}</span>
            </label>
          `).join('')}
        </div>
      `;
    }

    if (type === 'mc_multi') {
      let opts = q.options || [];
      if (q.shuffleOptions) opts = [...opts].sort(() => Math.random() - 0.5);
      return `
        <div class="quiz-question-block">
          <div class="quiz-question-title">${index + 1}. ${escapeHtml(q.prompt)} <span style="font-size:0.8rem; color:var(--text-secondary);">(${pts} pt${pts!==1?'s':''} — select all that apply)</span></div>
          ${imageHtml}
          ${hintHtml}
          ${opts.map((opt, optIndex) => `
            <label class="quiz-answer-option">
              <input type="checkbox" name="quizQuestion${index}" value="${optIndex}">
              <span>${escapeHtml(typeof opt === 'object' ? opt.text || '' : opt)}</span>
            </label>
          `).join('')}
        </div>
      `;
    }

    if (type === 'true_false') {
      return `
        <div class="quiz-question-block">
          <div class="quiz-question-title">${index + 1}. ${escapeHtml(q.prompt)} <span style="font-size:0.8rem; color:var(--text-secondary);">(${pts} pt${pts!==1?'s':''})</span></div>
          ${imageHtml}
          ${hintHtml}
          ${['True', 'False'].map(option => `
            <label class="quiz-answer-option">
              <input type="radio" name="quizQuestion${index}" value="${option}">
              <span>${option}</span>
            </label>
          `).join('')}
        </div>
      `;
    }

    if (type === 'short_answer') {
      return `
        <div class="quiz-question-block">
          <div class="quiz-question-title">${index + 1}. ${escapeHtml(q.prompt)} <span style="font-size:0.8rem; color:var(--text-secondary);">(${pts} pt${pts!==1?'s':''})</span></div>
          ${imageHtml}
          ${hintHtml}
          <input type="text" class="form-input" id="quizAnswer${index}" placeholder="Type your answer here...">
        </div>
      `;
    }

    if (type === 'matching') {
      const pairs = Array.isArray(q.options) && typeof q.options[0] === 'object' ? q.options : [];
      const targets = [...pairs.map(p => p.target)].sort(() => Math.random() - 0.5);
      return `
        <div class="quiz-question-block">
          <div class="quiz-question-title">${index + 1}. ${escapeHtml(q.prompt)} <span style="font-size:0.8rem; color:var(--text-secondary);">(${pts} pt${pts!==1?'s':''})</span></div>
          ${imageHtml}
          ${hintHtml}
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">
            <div style="font-size:0.8rem; color:var(--text-secondary); padding-bottom:4px;">Source</div>
            <div style="font-size:0.8rem; color:var(--text-secondary); padding-bottom:4px;">Match</div>
            ${pairs.map((p, pi) => `
              <div style="padding:6px 0;">${escapeHtml(p.source)}</div>
              <select class="form-select" id="quizMatch${index}_${pi}" style="margin:2px 0;">
                <option value="">-- Select --</option>
                ${targets.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
              </select>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (type === 'ordering') {
      const items = Array.isArray(q.options) ? [...q.options] : [];
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      return `
        <div class="quiz-question-block">
          <div class="quiz-question-title">${index + 1}. ${escapeHtml(q.prompt)} <span style="font-size:0.8rem; color:var(--text-secondary);">(${pts} pt${pts!==1?'s':''} — drag to reorder or use dropdowns)</span></div>
          ${hintHtml}
          <div id="quizOrder${index}" style="display:flex; flex-direction:column; gap:4px; margin-top:8px;">
            ${shuffled.map((item, si) => `
              <div style="display:flex; gap:8px; align-items:center; padding:6px; background:var(--surface); border-radius:4px; border:1px solid var(--border);">
                <span style="font-size:0.85rem; flex:1;">${escapeHtml(item)}</span>
                <select class="form-select" id="quizOrdPos${index}_${si}" style="width:80px;">
                  ${items.map((_, pi) => `<option value="${pi+1}" ${pi===si?'selected':''}>${pi+1}</option>`).join('')}
                </select>
              </div>
            `).join('')}
          </div>
          <div class="hint" style="margin-top:4px;">Set the position number (1 = first) for each item</div>
        </div>
      `;
    }

    // Essay / Written (catch-all)
    const rows = q.expectedLength || 4;
    return `
      <div class="quiz-question-block">
        <div class="quiz-question-title">${index + 1}. ${escapeHtml(q.prompt)} <span style="font-size:0.8rem; color:var(--text-secondary);">(${pts} pt${pts!==1?'s':''} — manual grading)</span></div>
        ${hintHtml}
        <textarea class="form-textarea" rows="${Math.min(rows, 20)}" id="quizAnswer${index}" placeholder="Your answer..."></textarea>
      </div>
    `;
  }).join('');

  const points = getQuizPoints({ questions });
  setText('quizTakeTitle', quiz.title);
  setText('quizTakeMeta', `${points} points · ${quiz.timeLimit ? quiz.timeLimit + ' min' : 'No time limit'}`);

  startQuizTimer(quiz.timeLimit);
}

/**
 * Start the quiz timer
 */
export function startQuizTimer(timeLimit) {
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

/**
 * Format seconds as mm:ss
 */
function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Submit the quiz
 */
export async function submitQuiz() {
  const quiz = appData.quizzes.find(q => q.id === currentQuizTakingId);
  const container = document.getElementById('quizTakeQuestions');
  if (!quiz || !container) return;

  const questions = JSON.parse(container.dataset.questions || '[]');
  const answers = {};

  questions.forEach((q, index) => {
    const type = q.type || 'multiple_choice';

    if (type === 'short_answer' || type === 'essay' || type === 'written_response') {
      const el = document.getElementById(`quizAnswer${index}`);
      answers[q.id] = el ? el.value.trim() : '';
      return;
    }

    if (type === 'matching') {
      const pairs = Array.isArray(q.options) ? q.options : [];
      const matchMap = {};
      pairs.forEach((pair, pairIndex) => {
        const selectEl = document.getElementById(`quizMatch${index}_${pairIndex}`);
        const source = typeof pair === 'object' ? pair.source : `pair_${pairIndex}`;
        matchMap[source] = selectEl ? selectEl.value : '';
      });
      answers[q.id] = matchMap;
      return;
    }

    if (type === 'ordering') {
      const orderRows = Array.from(document.querySelectorAll(`#quizOrder${index} > div`));
      const ordering = orderRows.map((row, rowIndex) => {
        const label = row.querySelector('span')?.textContent?.trim() || '';
        const position = row.querySelector('select')?.value || String(rowIndex + 1);
        return { item: label, position: parseInt(position, 10) || (rowIndex + 1) };
      });
      answers[q.id] = ordering;
      return;
    }

    const selected = document.querySelector(`input[name="quizQuestion${index}"]:checked`);
    answers[q.id] = selected ? selected.value : null;
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

  const savedSubmission = await supabaseUpsertQuizSubmission(submission);
  if (!savedSubmission) {
    showToast('Failed to submit quiz. Please try again.', 'error');
    return;
  }

  const existingIdx = appData.quizSubmissions.findIndex(s => s.id === submission.id);
  if (existingIdx >= 0) appData.quizSubmissions[existingIdx] = submission;
  else appData.quizSubmissions.push(submission);


  if (quizTimerInterval) {
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;
  }

  // Mastery mode: recycle wrong answers until threshold met
  if (quiz.masteryMode) {
    const threshold = quiz.masteryThreshold || 5;
    // Count correct answers (only auto-gradable types count)
    let correctCount = 0;
    const wrongQuestions = [];
    questions.forEach(q => {
      const type = q.type || 'multiple_choice';
      const answer = answers[q.id];
      let isCorrect = false;
      if (type === 'multiple_choice') {
        isCorrect = parseInt(answer, 10) === parseInt(q.correctAnswer, 10);
      } else if (type === 'true_false') {
        isCorrect = answer === q.correctAnswer;
      }
      if (isCorrect) correctCount++;
      else wrongQuestions.push(q);
    });

    if (correctCount >= threshold) {
      // Passed mastery!
      submission.score = 1;  // Complete
      submission.graded = true;
      submission.released = true;
      showToast(`Mastery achieved! ${correctCount}/${questions.length} correct (needed ${threshold})`, 'success');
      closeModal('quizTakeModal');
      if (renderAssignmentsCallback) renderAssignmentsCallback();
    } else {
      // Recycle wrong questions
      showToast(`${correctCount} correct so far (need ${threshold}). Recycling ${wrongQuestions.length} wrong answers...`, 'info');
      // Rebuild quiz with only wrong questions
      const recycledQuiz = {
        ...quiz,
        questions: wrongQuestions.sort(() => Math.random() - 0.5)
      };
      setTimeout(() => {
        renderQuizTakeModal(recycledQuiz);
      }, 1500);
    }
    return;
  }

  if (!needsManual) {
    showToast(`Quiz submitted! Score: ${autoScore}/${totalPoints}`, 'success');
  } else {
    showToast('Quiz submitted! Awaiting review.', 'success');
  }

  closeModal('quizTakeModal');
  if (renderAssignmentsCallback) renderAssignmentsCallback();
}

/**
 * Calculate auto-score for quiz
 */
export function calculateQuizAutoScore(questions, answers) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ GRADING & VIEWING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * View quiz submissions (instructor)
 */
export function viewQuizSubmissions(quizId) {
  if (ensureModalsRenderedCallback) ensureModalsRenderedCallback();
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  const submissions = appData.quizSubmissions
    .filter(s => s.quizId === quizId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  const list = document.getElementById('quizSubmissionsList');
  if (!list) return;

  const titleEl = document.getElementById('quizSubmissionsTitle');
  if (titleEl) titleEl.textContent = `Quiz Submissions: ${quiz.title}`;

  if (submissions.length === 0) {
    list.innerHTML = '<div class="empty-state-text">No submissions yet</div>';
  } else {
    list.innerHTML = submissions.map(submission => {
      const student = getUserByIdCallback ? getUserByIdCallback(submission.userId) : null;
      const status = submission.released ? `Score: ${submission.score}` : 'Needs review';
      return `
        <div class="submission-row">
          <div>
            <div style="font-weight:600;">${student ? escapeHtml(student.name) : 'Unknown'}</div>
            <div class="muted">${formatDate(submission.submittedAt)} · ${status}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="window.openQuizGradeModal('${quizId}', '${submission.id}')">Grade</button>
          </div>
        </div>
      `;
    }).join('');
  }

  openModal('quizSubmissionsModal');
}

/**
 * Open quiz grade modal
 */
export function openQuizGradeModal(quizId, submissionId) {
  if (ensureModalsRenderedCallback) ensureModalsRenderedCallback();
  const quiz = appData.quizzes.find(q => q.id === quizId);
  const submission = appData.quizSubmissions.find(s => s.id === submissionId);
  if (!quiz || !submission) return;

  const student = getUserByIdCallback ? getUserByIdCallback(submission.userId) : null;

  const titleEl = document.getElementById('quizGradeTitle');
  const pointsEl = document.getElementById('quizGradePoints');
  const answersList = document.getElementById('quizGradeAnswers');
  const scoreInput = document.getElementById('quizGradeScore');
  const feedbackInput = document.getElementById('quizGradeFeedback');
  const submissionIdInput = document.getElementById('quizGradeSubmissionId');
  const quizIdInput = document.getElementById('quizGradeQuizId');

  if (titleEl) titleEl.textContent = `Grade Quiz: ${student ? student.name : 'Student'}`;

  const totalPoints = getQuizPoints({ questions: submission.questions });
  if (pointsEl) pointsEl.textContent = `${totalPoints} pts total`;

  if (answersList) {
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
          <div class="quiz-answer-question">${index + 1}. ${escapeHtml(q.prompt)}</div>
          <div class="quiz-answer-response">Answer: ${escapeHtml(answerText)}</div>
        </div>
      `;
    }).join('');
  }

  if (scoreInput) scoreInput.value = submission.score || submission.autoScore || 0;
  if (feedbackInput) feedbackInput.value = submission.feedback || '';
  if (submissionIdInput) submissionIdInput.value = submission.id;
  if (quizIdInput) quizIdInput.value = quizId;

  openModal('quizGradeModal');
}

/**
 * Save quiz grade
 */
export async function saveQuizGrade() {
  const submissionId = document.getElementById('quizGradeSubmissionId')?.value;
  const quizId = document.getElementById('quizGradeQuizId')?.value;
  const score = parseFloat(document.getElementById('quizGradeScore')?.value) || 0;
  const feedback = document.getElementById('quizGradeFeedback')?.value.trim();

  const submission = appData.quizSubmissions.find(s => s.id === submissionId);
  if (!submission) return;

  const updatedSubmission = {
    ...submission,
    score,
    feedback,
    released: true,
    needsManual: false,
    gradedAt: new Date().toISOString(),
    gradedBy: appData.currentUser.id
  };

  const saved = await supabaseUpsertQuizSubmission(updatedSubmission);
  if (!saved) {
    showToast('Failed to save quiz grade', 'error');
    return;
  }

  const idx = appData.quizSubmissions.findIndex(s => s.id === submissionId);
  if (idx >= 0) appData.quizSubmissions[idx] = updatedSubmission;

  closeModal('quizGradeModal');
  if (renderAssignmentsCallback) renderAssignmentsCallback();
  viewQuizSubmissions(quizId);
  showToast('Quiz graded!', 'success');
}

/**
 * View own quiz submission (student)
 */
export function viewQuizSubmission(quizId) {
  if (ensureModalsRenderedCallback) ensureModalsRenderedCallback();
  const quiz = appData.quizzes.find(q => q.id === quizId);
  const submissions = appData.quizSubmissions
    .filter(s => s.quizId === quizId && s.userId === appData.currentUser.id)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  const latest = submissions[0];
  if (!quiz || !latest) return;

  const list = document.getElementById('quizReviewList');
  const titleEl = document.getElementById('quizReviewTitle');
  if (!list) return;

  const totalPoints = getQuizPoints({ questions: latest.questions });
  if (titleEl) titleEl.textContent = `${quiz.title} · ${latest.released ? `Score ${latest.score}/${totalPoints}` : 'Awaiting review'}`;

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
        <div class="quiz-answer-question">${index + 1}. ${escapeHtml(q.prompt)}</div>
        <div class="quiz-answer-response">Your answer: ${escapeHtml(answerText)}</div>
      </div>
    `;
  }).join('');

  openModal('quizReviewModal');
}

/**
 * Toggle quiz visibility
 */
export async function toggleQuizVisibility(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;

  const originalStatus = quiz.status;
  quiz.status = quiz.status === 'published' ? 'draft' : 'published';

  const result = await supabaseUpdateQuiz(quiz);
  if (!result) {
    quiz.status = originalStatus;
    showToast('Failed to update quiz visibility', 'error');
    return;
  }

  if (renderAssignmentsCallback) renderAssignmentsCallback();
  showToast(quiz.status === 'published' ? 'Quiz published' : 'Quiz unpublished', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT GLOBAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  window.openQuizModal = openQuizModal;
  window.toggleQuizPoolFields = toggleQuizPoolFields;
  window.updateQuizQuestion = updateQuizQuestion;
  window.updateQuizOption = updateQuizOption;
  window.addQuizQuestion = addQuizQuestion;
  window.removeQuizQuestion = removeQuizQuestion;
  window.saveQuiz = saveQuiz;
  window.deleteQuiz = deleteQuiz;
  window.takeQuiz = takeQuiz;
  window.submitQuiz = submitQuiz;
  window.viewQuizSubmissions = viewQuizSubmissions;
  window.openQuizGradeModal = openQuizGradeModal;
  window.saveQuizGrade = saveQuizGrade;
  window.viewQuizSubmission = viewQuizSubmission;
  window.toggleQuizVisibility = toggleQuizVisibility;
}
