/* =============================================================================
   AI Course Setup Wizard
   "Create Course with AI Help" — guided import replacing separate syllabus
   and course-import flows. Only active when ai_enabled feature flag is on.
============================================================================= */

// Module dependencies (injected via init)
let appData = null;
let supabaseClient = null;
let showToast = null;
let escapeHtml = null;
let generateId = null;
let formatDate = null;
let openModal = null;
let closeModal = null;
let setHTML = null;
let setText = null;
let getCourseById = null;
let getUserById = null;
let isStaff = null;
let callGeminiAPIWithRetry = null;
let parseAiJsonResponse = null;
let fileToBase64 = null;
// Database helpers (reuse existing AI action surface)
let supabaseCreateCourse = null;
let supabaseCreateEnrollment = null;
let supabaseCreateFile = null;
let supabaseUpdateFile = null;
let supabaseCreateAssignment = null;
let supabaseCreateModule = null;
let supabaseCreateModuleItem = null;
let supabaseCreateGradeCategory = null;
let supabaseCreateCalendarEvent = null;
let supabaseCreateQuestionBank = null;
let supabaseCopyStorageFile = null;
// Render callbacks
let renderAllCallback = null;
let navigateToCallback = null;
let updateModuleActiveCourseCallback = null;
let getUserCoursesCallback = null;
let switchCourseCallback = null;
let generateModalsCallback = null;

// ─── Wizard state ────────────────────────────────────────────────────────────
const STEPS = ['intake', 'import', 'upload', 'organize', 'assignments', 'grading', 'calendar', 'summary'];
let wizState = resetWizState();

function resetWizState() {
  return {
    step: 'intake',
    // intake
    syllabusFile: null,
    syllabusData: null,       // parsed JSON from AI
    courseName: '',
    courseCode: '',
    courseDescription: '',
    studentEmails: '',
    // import
    importSourceCourseId: null,
    importTypes: new Set(['assignments', 'question_banks', 'modules', 'files']),
    importedIds: { assignments: {}, files: {}, banks: {}, modules: {} },
    // upload
    uploadedFiles: [],        // File objects user adds
    // organize
    fileOrgPlan: [],          // [{fileId, fileName, folder, moduleName, moduleId}]
    modulePlan: [],           // [{name, fileIds:[]}]
    // assignments
    assignmentPlan: [],       // [{title, description, dueDate, points, status, assignmentType, ...}]
    // grading
    gradingPlan: [],          // [{name, weight}]
    // calendar
    calendarPlan: [],         // [{title, eventDate, eventType, description}]
    // execution
    courseId: null,
    createdAssignmentIds: {},
    createdModuleIds: {},
    executing: false,
  };
}

// ─── Public init ─────────────────────────────────────────────────────────────
export function initAiCourseSetupModule(deps) {
  appData = deps.appData;
  supabaseClient = deps.supabaseClient;
  showToast = deps.showToast;
  escapeHtml = deps.escapeHtml;
  generateId = deps.generateId;
  formatDate = deps.formatDate;
  openModal = deps.openModal;
  closeModal = deps.closeModal;
  setHTML = deps.setHTML;
  setText = deps.setText;
  getCourseById = deps.getCourseById;
  getUserById = deps.getUserById;
  isStaff = deps.isStaff;
  callGeminiAPIWithRetry = deps.callGeminiAPIWithRetry;
  parseAiJsonResponse = deps.parseAiJsonResponse;
  fileToBase64 = deps.fileToBase64;
  supabaseCreateCourse = deps.supabaseCreateCourse;
  supabaseCreateEnrollment = deps.supabaseCreateEnrollment;
  supabaseCreateFile = deps.supabaseCreateFile;
  supabaseUpdateFile = deps.supabaseUpdateFile;
  supabaseCreateAssignment = deps.supabaseCreateAssignment;
  supabaseCreateModule = deps.supabaseCreateModule;
  supabaseCreateModuleItem = deps.supabaseCreateModuleItem;
  supabaseCreateGradeCategory = deps.supabaseCreateGradeCategory;
  supabaseCreateCalendarEvent = deps.supabaseCreateCalendarEvent;
  supabaseCreateQuestionBank = deps.supabaseCreateQuestionBank;
  supabaseCopyStorageFile = deps.supabaseCopyStorageFile;
  renderAllCallback = deps.renderAll;
  navigateToCallback = deps.navigateTo;
  updateModuleActiveCourseCallback = deps.updateModuleActiveCourse;
  getUserCoursesCallback = deps.getUserCourses;
  switchCourseCallback = deps.switchCourse;
  generateModalsCallback = deps.generateModals;

  // Window exports for onclick handlers in wizard HTML
  window.aiSetupNextStep = aiSetupNextStep;
  window.aiSetupPrevStep = aiSetupPrevStep;
  window.aiSetupGoToStep = aiSetupGoToStep;
  window.aiSetupClose = aiSetupClose;
  window.aiSetupParseSyllabus = aiSetupParseSyllabus;
  window.aiSetupSyllabusFileSelected = aiSetupSyllabusFileSelected;
  window.aiSetupSyllabusDrop = aiSetupSyllabusDrop;
  window.aiSetupClearSyllabus = aiSetupClearSyllabus;
  window.aiSetupToggleImportType = aiSetupToggleImportType;
  window.aiSetupImportSourceChanged = aiSetupImportSourceChanged;
  window.aiSetupUploadFileSelected = aiSetupUploadFileSelected;
  window.aiSetupUploadDrop = aiSetupUploadDrop;
  window.aiSetupRemoveUploadFile = aiSetupRemoveUploadFile;
  window.aiSetupMoveFile = aiSetupMoveFile;
  window.aiSetupEditAssignment = aiSetupEditAssignment;
  window.aiSetupRemoveAssignment = aiSetupRemoveAssignment;
  window.aiSetupEditGradeCategory = aiSetupEditGradeCategory;
  window.aiSetupRemoveGradeCategory = aiSetupRemoveGradeCategory;
  window.aiSetupEditCalendarEvent = aiSetupEditCalendarEvent;
  window.aiSetupRemoveCalendarEvent = aiSetupRemoveCalendarEvent;
  window.aiSetupExecute = aiSetupExecute;
}

// ─── Open wizard ─────────────────────────────────────────────────────────────
export function openAiCourseSetupWizard() {
  // Ensure modals (including wizard modal) are rendered in DOM
  if (!document.getElementById('aiCourseSetupModal') && generateModalsCallback) {
    generateModalsCallback();
  }
  wizState = resetWizState();
  renderWizard();
  openModal('aiCourseSetupModal');
}

function aiSetupClose() {
  closeModal('aiCourseSetupModal');
}

// ─── Step navigation ─────────────────────────────────────────────────────────
function currentStepIndex() { return STEPS.indexOf(wizState.step); }

function aiSetupNextStep() {
  const idx = currentStepIndex();
  if (idx < STEPS.length - 1) {
    const nextStep = STEPS[idx + 1];
    // Validate current step before proceeding
    if (wizState.step === 'intake' && !validateIntake()) return;
    // On transition to organize, generate AI plan if we have syllabus data
    if (nextStep === 'organize') generateOrganizePlan();
    if (nextStep === 'assignments') generateAssignmentPlan();
    if (nextStep === 'grading') generateGradingPlan();
    if (nextStep === 'calendar') generateCalendarPlan();
    wizState.step = nextStep;
    renderWizard();
  }
}

function aiSetupPrevStep() {
  const idx = currentStepIndex();
  if (idx > 0) {
    wizState.step = STEPS[idx - 1];
    renderWizard();
  }
}

function aiSetupGoToStep(step) {
  if (STEPS.includes(step)) {
    wizState.step = step;
    renderWizard();
  }
}

function validateIntake() {
  const name = document.getElementById('wizCourseName')?.value.trim();
  const code = document.getElementById('wizCourseCode')?.value.trim();
  if (!name || !code) {
    showToast('Please fill in course name and code', 'error');
    return false;
  }
  wizState.courseName = name;
  wizState.courseCode = code;
  wizState.courseDescription = document.getElementById('wizCourseDesc')?.value.trim() || '';
  wizState.studentEmails = document.getElementById('wizCourseEmails')?.value.trim() || '';
  return true;
}

// ─── Master render ───────────────────────────────────────────────────────────
function renderWizard() {
  const body = document.getElementById('aiSetupWizBody');
  if (!body) return;

  // Update step indicators
  STEPS.forEach((s, i) => {
    const el = document.getElementById(`wizStep_${s}`);
    if (!el) return;
    el.className = 'wiz-step-dot';
    if (s === wizState.step) el.classList.add('wiz-active');
    else if (i < currentStepIndex()) el.classList.add('wiz-done');
  });

  // Render step content
  switch (wizState.step) {
    case 'intake': body.innerHTML = renderIntakeStep(); break;
    case 'import': body.innerHTML = renderImportStep(); break;
    case 'upload': body.innerHTML = renderUploadStep(); break;
    case 'organize': body.innerHTML = renderOrganizeStep(); break;
    case 'assignments': body.innerHTML = renderAssignmentsStep(); break;
    case 'grading': body.innerHTML = renderGradingStep(); break;
    case 'calendar': body.innerHTML = renderCalendarStep(); break;
    case 'summary': body.innerHTML = renderSummaryStep(); break;
  }

  // Footer buttons
  const footer = document.getElementById('aiSetupWizFooter');
  if (footer) {
    const idx = currentStepIndex();
    const isFirst = idx === 0;
    const isLast = idx === STEPS.length - 1;
    footer.innerHTML = `
      <button class="btn btn-secondary" onclick="aiSetupClose()">Cancel</button>
      <div style="display:flex;gap:8px;">
        ${!isFirst ? '<button class="btn btn-secondary" onclick="aiSetupPrevStep()">Back</button>' : ''}
        ${!isLast ? '<button class="btn btn-primary" onclick="aiSetupNextStep()">Continue</button>' : ''}
        ${isLast ? '<button class="btn btn-primary" onclick="aiSetupExecute()" id="wizExecuteBtn">Create Course</button>' : ''}
      </div>
    `;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 1: INTAKE
// ═════════════════════════════════════════════════════════════════════════════
function renderIntakeStep() {
  const sd = wizState.syllabusData;
  const sf = wizState.syllabusFile;
  const syllabusStatus = sd
    ? `<div style="color:var(--success);margin-top:8px;">Parsed: ${sd.modules?.length || 0} modules, ${(sd.modules || []).reduce((s,m) => s + (m.items||[]).length, 0)} items</div>`
    : '';
  const syllabusFileDisplay = sf
    ? `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-color);border-radius:var(--radius);margin-top:8px;">
         <span>📄 ${escapeHtml(sf.name)} (${(sf.size/1024).toFixed(1)} KB)</span>
         ${!sd ? '<button class="btn btn-primary btn-sm" onclick="aiSetupParseSyllabus()">Parse</button>' : ''}
         <button class="btn btn-secondary btn-sm" onclick="aiSetupClearSyllabus()">Remove</button>
       </div>${syllabusStatus}`
    : '';

  return `
    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 4px;">Step 1: Course Information</h3>
      <p class="muted" style="margin:0;font-size:0.85rem;">Upload a syllabus and the AI will auto-fill course details, modules, assignments, grading, and schedule.</p>
    </div>
    <div class="form-group" style="padding:12px;background:var(--primary-light);border-radius:var(--radius);margin-bottom:16px;">
      <label class="form-label">Upload Syllabus (recommended)</label>
      <div id="wizSyllabusDropZone"
           style="border:2px dashed var(--border-color);border-radius:var(--radius);padding:24px;text-align:center;cursor:pointer;transition:all 0.2s;"
           ondragover="event.preventDefault();this.style.borderColor='var(--primary)';this.style.background='rgba(99,102,241,0.08)';"
           ondragleave="this.style.borderColor='var(--border-color)';this.style.background='';"
           ondrop="aiSetupSyllabusDrop(event)"
           onclick="document.getElementById('wizSyllabusInput').click()">
        <div style="font-weight:500;">Drag & drop syllabus here</div>
        <div class="muted" style="font-size:0.85rem;">or click to browse (PDF, DOC, TXT)</div>
        <input type="file" id="wizSyllabusInput" accept=".pdf,.doc,.docx,.txt,.tex" style="display:none;" onchange="aiSetupSyllabusFileSelected()">
      </div>
      ${syllabusFileDisplay}
      <div id="wizSyllabusParseStatus" style="margin-top:8px;"></div>
    </div>
    <div class="form-group">
      <label class="form-label" for="wizCourseName">Course Name *</label>
      <input type="text" class="form-input" id="wizCourseName" placeholder="e.g., ECON 101 - Introduction to Economics" value="${escapeHtml(wizState.courseName)}">
    </div>
    <div class="form-group">
      <label class="form-label" for="wizCourseCode">Course Code *</label>
      <input type="text" class="form-input" id="wizCourseCode" placeholder="e.g., ECON101" value="${escapeHtml(wizState.courseCode)}">
    </div>
    <div class="form-group">
      <label class="form-label" for="wizCourseDesc">Description (optional)</label>
      <textarea class="form-textarea" id="wizCourseDesc" placeholder="Course description..." rows="2">${escapeHtml(wizState.courseDescription)}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label" for="wizCourseEmails">Student Emails (optional)</label>
      <textarea class="form-textarea" id="wizCourseEmails" placeholder="Enter emails separated by commas or newlines" rows="2">${escapeHtml(wizState.studentEmails)}</textarea>
      <div class="hint">Students will be invited to join the course</div>
    </div>
  `;
}

// Syllabus handlers
function aiSetupSyllabusDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById('wizSyllabusDropZone');
  if (dz) { dz.style.borderColor = 'var(--border-color)'; dz.style.background = ''; }
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!['.pdf','.doc','.docx','.txt','.tex'].includes(ext)) {
      showToast('Please upload a PDF, DOC, or TXT file', 'error');
      return;
    }
    wizState.syllabusFile = file;
    renderWizard();
  }
}

function aiSetupSyllabusFileSelected() {
  const input = document.getElementById('wizSyllabusInput');
  if (input?.files?.length) {
    wizState.syllabusFile = input.files[0];
    renderWizard();
  }
}

function aiSetupClearSyllabus() {
  wizState.syllabusFile = null;
  wizState.syllabusData = null;
  renderWizard();
}

async function aiSetupParseSyllabus() {
  const file = wizState.syllabusFile;
  if (!file) { showToast('No syllabus file selected', 'error'); return; }

  const statusEl = document.getElementById('wizSyllabusParseStatus');
  if (statusEl) statusEl.innerHTML = '<div class="ai-spinner" style="display:inline-block;width:16px;height:16px;margin-right:8px;"></div> Parsing syllabus with AI...';

  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || 'application/octet-stream';

    const systemPrompt = `You are analyzing a course syllabus to set up an LMS course. Extract EVERYTHING needed. Return ONLY valid JSON:
{
  "courseInfo": {
    "name": "Full course name",
    "code": "Course code (e.g. ECON 101)",
    "instructor": "Instructor name",
    "description": "2-4 sentence course description"
  },
  "modules": [
    {
      "name": "Module/Week/Unit name",
      "items": [
        {
          "type": "assignment|quiz|reading",
          "title": "Item title",
          "description": "What students need to do",
          "dueDate": "YYYY-MM-DDThh:mm:ss.000Z or null",
          "points": 100
        }
      ]
    }
  ],
  "gradingPolicy": {
    "categories": [
      { "name": "Category name (e.g. Homework, Exams, Participation)", "weight": 20 }
    ]
  },
  "schedule": {
    "classMeetings": [
      { "dayOfWeek": "Monday", "time": "10:00 AM" }
    ],
    "startDate": "YYYY-MM-DD or null",
    "endDate": "YYYY-MM-DD or null",
    "exams": [
      { "title": "Midterm Exam", "date": "YYYY-MM-DDThh:mm:ss.000Z" }
    ]
  }
}
Rules:
- type: "assignment" for homework/essays/projects, "quiz" for tests/quizzes/exams, "reading" for chapters/readings
- Create a module for each week, unit, topic, or logical grouping
- Extract grading weights/categories if mentioned (e.g. "Homework 30%, Exams 40%")
- Extract class meeting days/times and exam dates
- If no due date found, use null
- If no points specified, estimate based on weight`;

    const contents = [{
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: systemPrompt }
      ]
    }];

    const data = await callGeminiAPIWithRetry({ contents, generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } });
    if (data.error) throw new Error(data.error.message);

    const text = data.candidates[0].content.parts[0].text;
    const parsed = parseAiJsonResponse(text);
    wizState.syllabusData = parsed;

    // Auto-fill course info
    if (parsed.courseInfo) {
      if (parsed.courseInfo.name && !wizState.courseName) wizState.courseName = parsed.courseInfo.name;
      if (parsed.courseInfo.code && !wizState.courseCode) wizState.courseCode = parsed.courseInfo.code;
      if (parsed.courseInfo.description && !wizState.courseDescription) wizState.courseDescription = parsed.courseInfo.description;
    }

    showToast('Syllabus parsed successfully!', 'success');
    renderWizard();
  } catch (err) {
    console.error('AI Course Setup: syllabus parse error', err);
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--error);">Parse error: ${escapeHtml(err.message)}</span>`;
    wizState.syllabusData = null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 2: IMPORT FROM PRIOR COURSE (optional)
// ═════════════════════════════════════════════════════════════════════════════
function renderImportStep() {
  const sourceCourses = getUserCoursesCallback
    ? getUserCoursesCallback(appData.currentUser.id).filter(c => c.role === 'instructor')
    : [];

  const typeLabels = {
    assignments: 'Assignments',
    question_banks: 'Question Banks',
    modules: 'Modules',
    files: 'Files',
    announcements: 'Announcements'
  };

  // Build items preview if source selected
  let itemsPreview = '';
  if (wizState.importSourceCourseId) {
    const sid = wizState.importSourceCourseId;
    const sections = {
      assignments: (appData.assignments || []).filter(a => a.courseId === sid),
      question_banks: (appData.questionBanks || []).filter(b => b.courseId === sid),
      modules: (appData.modules || []).filter(m => m.courseId === sid),
      files: (appData.files || []).filter(f => f.courseId === sid && !f.isPlaceholder),
      announcements: (appData.announcements || []).filter(a => a.courseId === sid)
    };
    let counts = [];
    for (const [type, items] of Object.entries(sections)) {
      if (wizState.importTypes.has(type) && items.length > 0) {
        counts.push(`${items.length} ${typeLabels[type].toLowerCase()}`);
      }
    }
    itemsPreview = counts.length
      ? `<div style="margin-top:12px;padding:8px 12px;background:var(--bg-color);border-radius:var(--radius);font-size:0.85rem;">Will import: ${counts.join(', ')}</div>`
      : '<div class="muted" style="margin-top:8px;font-size:0.85rem;">No items found for selected types.</div>';
  }

  return `
    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 4px;">Step 2: Import from Prior Course (optional)</h3>
      <p class="muted" style="margin:0;font-size:0.85rem;">Copy content from an existing course. This clones files, assignments, question banks, and modules. Skip this if starting fresh.</p>
    </div>
    <div class="form-group">
      <label class="form-label">Import from course</label>
      <select class="form-input" id="wizImportSource" onchange="aiSetupImportSourceChanged()">
        <option value="">-- Skip (don't import) --</option>
        ${sourceCourses.map(c => `<option value="${c.id}" ${wizState.importSourceCourseId === c.id ? 'selected' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`).join('')}
      </select>
    </div>
    ${wizState.importSourceCourseId ? `
    <fieldset class="form-group" style="border:none;padding:0;margin:0;">
      <legend class="form-label">Content to import</legend>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
        ${Object.entries(typeLabels).map(([key, label]) => `
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;background:var(--bg-color);border:1px solid var(--border-color);border-radius:6px;padding:6px 10px;font-size:0.875rem;">
            <input type="checkbox" ${wizState.importTypes.has(key) ? 'checked' : ''} onchange="aiSetupToggleImportType('${key}', this.checked)"> ${label}
          </label>
        `).join('')}
      </div>
      <div class="hint" style="margin-top:8px;">By default, this clones assignments, question banks, modules, and files. Announcements are optional.</div>
    </fieldset>
    ${itemsPreview}
    ` : ''}
  `;
}

function aiSetupImportSourceChanged() {
  const sel = document.getElementById('wizImportSource');
  wizState.importSourceCourseId = sel?.value || null;
  renderWizard();
}

function aiSetupToggleImportType(type, checked) {
  if (checked) wizState.importTypes.add(type);
  else wizState.importTypes.delete(type);
  renderWizard();
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 3: UPLOAD FILES
// ═════════════════════════════════════════════════════════════════════════════
function renderUploadStep() {
  const fileList = wizState.uploadedFiles.map((f, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--bg-color);border-radius:var(--radius);margin-bottom:4px;">
      <span>📄</span>
      <span style="flex:1;">${escapeHtml(f.name)} <span class="muted">(${(f.size/1024).toFixed(1)} KB)</span></span>
      <button class="btn btn-secondary btn-sm" onclick="aiSetupRemoveUploadFile(${i})">Remove</button>
    </div>
  `).join('');

  return `
    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 4px;">Step 3: Upload Course Files</h3>
      <p class="muted" style="margin:0;font-size:0.85rem;">Add any files you want for this course (slides, readings, handouts). Don't worry, you can add more later — the AI will automatically sort these into the right folders and modules for you.</p>
    </div>
    <div class="form-group">
      <div id="wizUploadDropZone"
           style="border:2px dashed var(--border-color);border-radius:var(--radius);padding:32px;text-align:center;cursor:pointer;transition:all 0.2s;"
           ondragover="event.preventDefault();this.style.borderColor='var(--primary)';this.style.background='rgba(99,102,241,0.08)';"
           ondragleave="this.style.borderColor='var(--border-color)';this.style.background='';"
           ondrop="aiSetupUploadDrop(event)"
           onclick="document.getElementById('wizUploadInput').click()">
        <div style="font-weight:500;">Drag and drop files here</div>
        <div class="muted">or click to browse (any file type, up to 50 files)</div>
      </div>
      <input type="file" id="wizUploadInput" multiple style="display:none;" onchange="aiSetupUploadFileSelected()" accept=".pdf,.doc,.docx,.txt,.tex,.png,.jpg,.jpeg,.gif,.webp,.svg,.ppt,.pptx,.xls,.xlsx,.zip">
    </div>
    ${fileList ? `<div style="margin-top:12px;"><div style="font-weight:600;font-size:0.85rem;margin-bottom:8px;">Files to upload (${wizState.uploadedFiles.length})</div>${fileList}</div>` : ''}
    <div style="margin-top:16px;padding:12px;background:var(--primary-light);border-radius:var(--radius);">
      <strong>What are "folders" and "modules"?</strong>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:0.85rem;color:var(--text-secondary);">
        <li><strong>Folders</strong> (like "Slides", "Readings", "Syllabus") organize files in the Files area — think of them as filing cabinets.</li>
        <li><strong>Modules</strong> (like "Week 1: Supply & Demand") are the learning sequence students follow — they contain links to files, assignments, and other content.</li>
      </ul>
    </div>
  `;
}

function aiSetupUploadDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById('wizUploadDropZone');
  if (dz) { dz.style.borderColor = 'var(--border-color)'; dz.style.background = ''; }
  const files = Array.from(e.dataTransfer.files);
  wizState.uploadedFiles.push(...files);
  renderWizard();
}

function aiSetupUploadFileSelected() {
  const input = document.getElementById('wizUploadInput');
  if (input?.files?.length) {
    wizState.uploadedFiles.push(...Array.from(input.files));
    renderWizard();
  }
}

function aiSetupRemoveUploadFile(index) {
  wizState.uploadedFiles.splice(index, 1);
  renderWizard();
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4: ORGANIZE FILES INTO FOLDERS + MODULES (AI-proposed, user-editable)
// ═════════════════════════════════════════════════════════════════════════════
function generateOrganizePlan() {
  // Build list of all files: imported + newly uploaded + syllabus
  const allFiles = [];
  // Imported files (already in appData after import step execution was triggered)
  const importedFileIds = Object.values(wizState.importedIds.files || {});
  for (const fid of importedFileIds) {
    const f = (appData.files || []).find(ff => ff.id === fid);
    if (f) allFiles.push({ id: f.id, name: f.name, source: 'imported' });
  }
  // Uploaded files (not yet saved)
  for (let i = 0; i < wizState.uploadedFiles.length; i++) {
    allFiles.push({ id: `upload_${i}`, name: wizState.uploadedFiles[i].name, source: 'upload', index: i });
  }
  // Syllabus file
  if (wizState.syllabusFile) {
    allFiles.push({ id: 'syllabus', name: wizState.syllabusFile.name, source: 'syllabus' });
  }

  // Folder classification using filename heuristics
  const folderRules = [
    { pattern: /syllabus/i, folder: 'Syllabus' },
    { pattern: /slide|ppt|presentation|lecture/i, folder: 'Slides' },
    { pattern: /reading|article|chapter|textbook|paper/i, folder: 'Readings' },
    { pattern: /handout|worksheet|exercise|activity/i, folder: 'Handouts' },
    { pattern: /exam|midterm|final|quiz|test/i, folder: 'Exams' },
    { pattern: /\.pptx?$/i, folder: 'Slides' },
    { pattern: /\.xlsx?$/i, folder: 'Spreadsheets' },
  ];

  wizState.fileOrgPlan = allFiles.map(f => {
    let folder = 'Course Documents';
    for (const rule of folderRules) {
      if (rule.pattern.test(f.name)) { folder = rule.folder; break; }
    }
    if (f.source === 'syllabus') folder = 'Syllabus';
    return { ...f, folder, moduleName: null };
  });

  // If syllabus has module divisions, propose module placement
  if (wizState.syllabusData?.modules?.length) {
    wizState.modulePlan = wizState.syllabusData.modules.map(m => ({
      name: m.name,
      fileIds: []
    }));
    // Add a "Course Documents" module for syllabus
    wizState.modulePlan.push({ name: 'Course Documents', fileIds: [] });
    // Place syllabus in Course Documents module
    const syllabusEntry = wizState.fileOrgPlan.find(f => f.source === 'syllabus');
    if (syllabusEntry) {
      syllabusEntry.moduleName = 'Course Documents';
    }
  } else {
    wizState.modulePlan = [];
  }

  // For ambiguous files (defaulted to "Course Documents"), try AI classification
  // by inspecting the start of the document for uploaded PDF/DOC files
  classifyAmbiguousFiles();
}

async function classifyAmbiguousFiles() {
  const ambiguous = wizState.fileOrgPlan.filter(f => f.folder === 'Course Documents' && f.source === 'upload');
  if (ambiguous.length === 0) return;

  // Try to classify ambiguous files by reading their first page/content via AI
  const classifiableFiles = [];
  for (const f of ambiguous) {
    const file = wizState.uploadedFiles[f.index];
    if (!file) continue;
    const ext = file.name.split('.').pop().toLowerCase();
    if (['pdf', 'doc', 'docx', 'txt', 'tex'].includes(ext)) {
      classifiableFiles.push({ orgEntry: f, file });
    }
  }

  if (classifiableFiles.length === 0) return;

  // Build a batch classification request
  try {
    const fileDescs = classifiableFiles.map(cf => cf.file.name).join(', ');
    const modulesContext = wizState.modulePlan.length > 0
      ? `Available modules: ${wizState.modulePlan.map(m => m.name).join(', ')}.`
      : '';

    // For each classifiable file, read start and ask AI to classify
    for (const cf of classifiableFiles.slice(0, 10)) { // limit to 10 files to avoid API overload
      try {
        const base64Data = await fileToBase64(cf.file);
        const mimeType = cf.file.type || 'application/octet-stream';
        const prompt = `Look at the beginning of this document and classify it into one of these folder categories: Slides, Readings, Handouts, Exams, Syllabus, Course Documents. ${modulesContext}
Return ONLY JSON: {"folder": "CategoryName"${wizState.modulePlan.length > 0 ? ', "module": "ModuleName or null"' : ''}}`;
        const contents = [{
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt }
          ]
        }];
        const data = await callGeminiAPIWithRetry({ contents, generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } });
        if (!data.error) {
          const result = parseAiJsonResponse(data.candidates[0].content.parts[0].text);
          if (result.folder) cf.orgEntry.folder = result.folder;
          if (result.module && wizState.modulePlan.some(m => m.name === result.module)) {
            cf.orgEntry.moduleName = result.module;
          }
        }
      } catch (_) { /* keep default classification on failure */ }
    }
    renderWizard(); // Re-render with updated classifications
  } catch (_) { /* silently fall back to heuristic classification */ }
}

function renderOrganizeStep() {
  const folders = [...new Set(wizState.fileOrgPlan.map(f => f.folder))].sort();
  const moduleNames = wizState.modulePlan.map(m => m.name);

  if (wizState.fileOrgPlan.length === 0) {
    return `
      <div style="margin-bottom:20px;">
        <h3 style="margin:0 0 4px;">Step 4: Organize Files</h3>
        <p class="muted" style="margin:0;font-size:0.85rem;">No files to organize. Continue to the next step.</p>
      </div>
    `;
  }

  const fileRows = wizState.fileOrgPlan.map((f, i) => `
    <tr>
      <td style="padding:6px 8px;font-size:0.85rem;">📄 ${escapeHtml(f.name)}</td>
      <td style="padding:6px 8px;">
        <select class="form-input" style="font-size:0.8rem;padding:4px 8px;" onchange="aiSetupMoveFile(${i}, 'folder', this.value)">
          ${folders.map(fo => `<option value="${escapeHtml(fo)}" ${f.folder === fo ? 'selected' : ''}>${escapeHtml(fo)}</option>`).join('')}
          <option value="__new__">+ New folder...</option>
        </select>
      </td>
      ${moduleNames.length > 0 ? `
      <td style="padding:6px 8px;">
        <select class="form-input" style="font-size:0.8rem;padding:4px 8px;" onchange="aiSetupMoveFile(${i}, 'module', this.value)">
          <option value="">-- None --</option>
          ${moduleNames.map(mn => `<option value="${escapeHtml(mn)}" ${f.moduleName === mn ? 'selected' : ''}>${escapeHtml(mn)}</option>`).join('')}
        </select>
      </td>` : ''}
    </tr>
  `).join('');

  return `
    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 4px;">Step 4: Organize Files into Folders & Modules</h3>
      <p class="muted" style="margin:0;font-size:0.85rem;">The AI sorted your files into folders. Review and adjust below. <strong>Folders</strong> organize files for storage; <strong>Modules</strong> are the learning sequence students see.</p>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid var(--border-color);">
            <th style="text-align:left;padding:8px;font-size:0.8rem;font-weight:600;">File</th>
            <th style="text-align:left;padding:8px;font-size:0.8rem;font-weight:600;">Folder</th>
            ${moduleNames.length > 0 ? '<th style="text-align:left;padding:8px;font-size:0.8rem;font-weight:600;">Module Placement</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${fileRows}
        </tbody>
      </table>
    </div>
  `;
}

function aiSetupMoveFile(index, field, value) {
  const entry = wizState.fileOrgPlan[index];
  if (!entry) return;
  if (field === 'folder') {
    if (value === '__new__') {
      const newFolder = prompt('Enter new folder name:');
      if (newFolder?.trim()) {
        entry.folder = newFolder.trim();
      }
    } else {
      entry.folder = value;
    }
    renderWizard();
  } else if (field === 'module') {
    entry.moduleName = value || null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 5: ASSIGNMENTS (AI-proposed from syllabus, user-editable)
// ═════════════════════════════════════════════════════════════════════════════
function generateAssignmentPlan() {
  if (wizState.assignmentPlan.length > 0) return; // already generated

  const plan = [];
  const sd = wizState.syllabusData;

  // From syllabus parsed data
  if (sd?.modules) {
    for (const mod of sd.modules) {
      for (const item of (mod.items || [])) {
        if (item.type === 'reading') continue; // readings become files, not assignments
        const isQuiz = item.type === 'quiz';
        const hasContent = !isQuiz; // quizzes without banks are placeholders
        plan.push({
          title: hasContent ? item.title : `PLACEHOLDER: ${item.title} (CONTENT NEEDED)`,
          description: item.description || (isQuiz ? 'Link a question bank to activate this quiz' : ''),
          dueDate: item.dueDate || '',
          points: item.points || 100,
          assignmentType: isQuiz ? 'quiz' : 'essay',
          status: 'draft',
          isPlaceholder: isQuiz,
          moduleName: mod.name,
          category: isQuiz ? 'quiz' : 'homework'
        });
      }
    }
  }

  // From imported assignments (adjust dates)
  const importedAssignmentIds = Object.values(wizState.importedIds.assignments || {});
  for (const aid of importedAssignmentIds) {
    const a = (appData.assignments || []).find(aa => aa.id === aid);
    if (a) {
      // Already imported, just track for display
      plan.push({
        title: a.title,
        description: a.description || '',
        dueDate: a.dueDate || '',
        points: a.points || 100,
        assignmentType: a.assignmentType || 'essay',
        status: a.status || 'draft',
        isPlaceholder: false,
        moduleName: '',
        category: a.category || 'homework',
        existingId: a.id // already created
      });
    }
  }

  wizState.assignmentPlan = plan;
}

function renderAssignmentsStep() {
  const plan = wizState.assignmentPlan;

  if (plan.length === 0) {
    return `
      <div style="margin-bottom:20px;">
        <h3 style="margin:0 0 4px;">Step 5: Assignments</h3>
        <p class="muted" style="margin:0;font-size:0.85rem;">No assignments detected from syllabus or import. You can add assignments later from the Assignments page.</p>
      </div>
    `;
  }

  const rows = plan.map((a, i) => {
    const isPlaceholder = a.isPlaceholder || a.title.startsWith('PLACEHOLDER:');
    const isExisting = !!a.existingId;
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border-light);${isPlaceholder ? 'background:var(--warning-light,#fff8e1);' : ''}">
        <div style="flex:1;">
          <div style="font-weight:500;font-size:0.85rem;">${escapeHtml(a.title)}</div>
          <div class="muted" style="font-size:0.8rem;">
            ${a.assignmentType === 'quiz' ? 'Quiz/Exam' : 'Assignment'} · ${a.points} pts
            ${a.dueDate ? ` · Due: ${new Date(a.dueDate).toLocaleDateString()}` : ' · No due date'}
            ${a.moduleName ? ` · ${escapeHtml(a.moduleName)}` : ''}
            ${isPlaceholder ? ' · <span style="color:var(--warning);">Needs content</span>' : ''}
            ${isExisting ? ' · <span style="color:var(--success);">Already imported</span>' : ''}
          </div>
        </div>
        ${!isExisting ? `
          <button class="btn btn-secondary btn-sm" onclick="aiSetupEditAssignment(${i})">Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="aiSetupRemoveAssignment(${i})">Remove</button>
        ` : ''}
      </div>
    `;
  }).join('');

  const newCount = plan.filter(a => !a.existingId).length;
  const placeholderCount = plan.filter(a => a.isPlaceholder).length;

  return `
    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 4px;">Step 5: Assignments</h3>
      <p class="muted" style="margin:0;font-size:0.85rem;">
        ${newCount} assignment${newCount !== 1 ? 's' : ''} from syllabus.
        ${placeholderCount > 0 ? `${placeholderCount} are placeholders that need content — they'll be created as drafts titled "PLACEHOLDER".` : ''}
        Review due dates and edit as needed.
      </p>
    </div>
    <div style="border:1px solid var(--border-color);border-radius:var(--radius);overflow:hidden;">
      ${rows}
    </div>
  `;
}

function aiSetupEditAssignment(index) {
  const a = wizState.assignmentPlan[index];
  if (!a) return;
  const newTitle = prompt('Assignment title:', a.title);
  if (newTitle === null) return;
  a.title = newTitle;
  const newDue = prompt('Due date (YYYY-MM-DD or leave empty):', a.dueDate ? a.dueDate.substring(0, 10) : '');
  if (newDue !== null) {
    a.dueDate = newDue ? new Date(newDue + 'T23:59:00.000Z').toISOString() : '';
  }
  const newPts = prompt('Points:', String(a.points));
  if (newPts !== null && !isNaN(parseInt(newPts))) a.points = parseInt(newPts);
  renderWizard();
}

function aiSetupRemoveAssignment(index) {
  wizState.assignmentPlan.splice(index, 1);
  renderWizard();
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 6: GRADING STRUCTURE
// ═════════════════════════════════════════════════════════════════════════════
function generateGradingPlan() {
  if (wizState.gradingPlan.length > 0) return;

  const sd = wizState.syllabusData;
  if (sd?.gradingPolicy?.categories?.length) {
    wizState.gradingPlan = sd.gradingPolicy.categories.map(c => ({
      name: c.name,
      weight: c.weight || 0
    }));
  }
  // If no grading policy from syllabus, derive from assignment categories
  if (wizState.gradingPlan.length === 0 && wizState.assignmentPlan.length > 0) {
    const cats = {};
    for (const a of wizState.assignmentPlan) {
      const cat = a.category || (a.assignmentType === 'quiz' ? 'Exams' : 'Assignments');
      cats[cat] = (cats[cat] || 0) + 1;
    }
    const total = Object.values(cats).reduce((s, c) => s + c, 0);
    wizState.gradingPlan = Object.entries(cats).map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      weight: Math.round((count / total) * 100)
    }));
  }
}

function renderGradingStep() {
  const plan = wizState.gradingPlan;

  if (plan.length === 0) {
    return `
      <div style="margin-bottom:20px;">
        <h3 style="margin:0 0 4px;">Step 6: Grading Weights</h3>
        <p class="muted" style="margin:0;font-size:0.85rem;">No grading policy detected. You can set up grade categories later from the Gradebook page.</p>
      </div>
    `;
  }

  const totalWeight = plan.reduce((s, c) => s + (c.weight || 0), 0);
  const rows = plan.map((c, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border-light);">
      <div style="flex:1;font-size:0.85rem;font-weight:500;">${escapeHtml(c.name)}</div>
      <div style="font-size:0.85rem;font-weight:600;color:var(--primary);">${c.weight}%</div>
      <button class="btn btn-secondary btn-sm" onclick="aiSetupEditGradeCategory(${i})">Edit</button>
      <button class="btn btn-secondary btn-sm" onclick="aiSetupRemoveGradeCategory(${i})">Remove</button>
    </div>
  `).join('');

  return `
    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 4px;">Step 6: Grading Weights</h3>
      <p class="muted" style="margin:0;font-size:0.85rem;">Grade categories extracted from syllabus. Total: <strong>${totalWeight}%</strong>${totalWeight !== 100 ? ' <span style="color:var(--warning);">(should be 100%)</span>' : ''}.</p>
    </div>
    <div style="border:1px solid var(--border-color);border-radius:var(--radius);overflow:hidden;">
      ${rows}
    </div>
  `;
}

function aiSetupEditGradeCategory(index) {
  const c = wizState.gradingPlan[index];
  if (!c) return;
  const newName = prompt('Category name:', c.name);
  if (newName === null) return;
  c.name = newName;
  const newWeight = prompt('Weight (%):', String(c.weight));
  if (newWeight !== null && !isNaN(parseInt(newWeight))) c.weight = parseInt(newWeight);
  renderWizard();
}

function aiSetupRemoveGradeCategory(index) {
  wizState.gradingPlan.splice(index, 1);
  renderWizard();
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 7: CALENDAR
// ═════════════════════════════════════════════════════════════════════════════
function generateCalendarPlan() {
  if (wizState.calendarPlan.length > 0) return;

  const sd = wizState.syllabusData;
  const plan = [];

  // Class meetings from schedule
  if (sd?.schedule?.classMeetings?.length && sd?.schedule?.startDate) {
    const start = new Date(sd.schedule.startDate);
    const end = sd.schedule.endDate ? new Date(sd.schedule.endDate) : new Date(start.getTime() + 86400000 * 120);
    const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

    for (const meeting of sd.schedule.classMeetings) {
      const dayNum = dayMap[(meeting.dayOfWeek || '').toLowerCase()];
      if (dayNum === undefined) continue;

      let d = new Date(start);
      // Find first occurrence of this day
      while (d.getDay() !== dayNum && d <= end) d.setDate(d.getDate() + 1);
      // Generate weekly entries
      let weekNum = 1;
      while (d <= end) {
        plan.push({
          title: `Class ${weekNum} (${meeting.dayOfWeek})`,
          eventDate: d.toISOString(),
          eventType: 'Class',
          description: meeting.time ? `Time: ${meeting.time}` : ''
        });
        weekNum++;
        d.setDate(d.getDate() + 7);
      }
    }
  }

  // Exams from schedule
  if (sd?.schedule?.exams?.length) {
    for (const exam of sd.schedule.exams) {
      if (exam.date) {
        plan.push({
          title: exam.title || 'Exam',
          eventDate: exam.date,
          eventType: 'Exam',
          description: ''
        });
      }
    }
  }

  // Sort by date
  plan.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
  wizState.calendarPlan = plan;
}

function renderCalendarStep() {
  const plan = wizState.calendarPlan;

  if (plan.length === 0) {
    return `
      <div style="margin-bottom:20px;">
        <h3 style="margin:0 0 4px;">Step 7: Calendar</h3>
        <p class="muted" style="margin:0;font-size:0.85rem;">No class sessions or exams detected from syllabus. Assignment due dates are added to the calendar automatically. You can add events later from the Calendar page.</p>
      </div>
    `;
  }

  const classCount = plan.filter(e => e.eventType === 'Class').length;
  const examCount = plan.filter(e => e.eventType === 'Exam').length;

  const rows = plan.map((e, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--border-light);">
      <span style="font-size:0.75rem;padding:2px 6px;border-radius:4px;background:${e.eventType === 'Exam' ? 'var(--error-light,#ffebee)' : 'var(--primary-light)'};color:${e.eventType === 'Exam' ? 'var(--error)' : 'var(--primary)'};">${e.eventType}</span>
      <div style="flex:1;font-size:0.85rem;">${escapeHtml(e.title)}</div>
      <div class="muted" style="font-size:0.8rem;">${new Date(e.eventDate).toLocaleDateString()}</div>
      <button class="btn btn-secondary btn-sm" onclick="aiSetupEditCalendarEvent(${i})">Edit</button>
      <button class="btn btn-secondary btn-sm" onclick="aiSetupRemoveCalendarEvent(${i})">Remove</button>
    </div>
  `).join('');

  return `
    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 4px;">Step 7: Calendar</h3>
      <p class="muted" style="margin:0;font-size:0.85rem;">${classCount} class sessions, ${examCount} exams. Assignment due dates are added automatically — no need to add them here.</p>
    </div>
    <div style="border:1px solid var(--border-color);border-radius:var(--radius);overflow:hidden;max-height:350px;overflow-y:auto;">
      ${rows}
    </div>
  `;
}

function aiSetupEditCalendarEvent(index) {
  const e = wizState.calendarPlan[index];
  if (!e) return;
  const newTitle = prompt('Event title:', e.title);
  if (newTitle === null) return;
  e.title = newTitle;
  const newDate = prompt('Event date (YYYY-MM-DD):', e.eventDate ? e.eventDate.substring(0, 10) : '');
  if (newDate !== null && newDate) {
    e.eventDate = new Date(newDate + 'T10:00:00.000Z').toISOString();
  }
  renderWizard();
}

function aiSetupRemoveCalendarEvent(index) {
  wizState.calendarPlan.splice(index, 1);
  renderWizard();
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 8: SUMMARY
// ═════════════════════════════════════════════════════════════════════════════
function renderSummaryStep() {
  const filesToUpload = wizState.uploadedFiles.length + (wizState.syllabusFile ? 1 : 0);
  const newAssignments = wizState.assignmentPlan.filter(a => !a.existingId).length;
  const placeholders = wizState.assignmentPlan.filter(a => a.isPlaceholder).length;
  const gradeCats = wizState.gradingPlan.length;
  const calEvents = wizState.calendarPlan.length;
  const importedItems = Object.values(wizState.importedIds).reduce((s, m) => s + Object.keys(m).length, 0);

  return `
    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 4px;">Ready to Create Your Course</h3>
      <p class="muted" style="margin:0;font-size:0.85rem;">Review the summary below. Click "Create Course" to build everything.</p>
    </div>
    <div style="padding:16px;background:var(--primary-light);border-radius:var(--radius);margin-bottom:16px;">
      <div style="font-weight:600;font-size:1rem;margin-bottom:4px;">${escapeHtml(wizState.courseName)}</div>
      <div class="muted" style="font-size:0.85rem;">${escapeHtml(wizState.courseCode)}${wizState.courseDescription ? ' — ' + escapeHtml(wizState.courseDescription.substring(0, 100)) : ''}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${importedItems > 0 ? `<div class="card" style="padding:12px;"><strong>Imported</strong><div class="muted" style="font-size:0.85rem;">${importedItems} items from prior course</div></div>` : ''}
      ${filesToUpload > 0 ? `<div class="card" style="padding:12px;"><strong>Files</strong><div class="muted" style="font-size:0.85rem;">${filesToUpload} files to upload & organize</div></div>` : ''}
      ${newAssignments > 0 ? `<div class="card" style="padding:12px;"><strong>Assignments</strong><div class="muted" style="font-size:0.85rem;">${newAssignments} to create${placeholders > 0 ? ` (${placeholders} placeholders)` : ''}</div></div>` : ''}
      ${wizState.modulePlan.length > 0 ? `<div class="card" style="padding:12px;"><strong>Modules</strong><div class="muted" style="font-size:0.85rem;">${wizState.modulePlan.length} modules</div></div>` : ''}
      ${gradeCats > 0 ? `<div class="card" style="padding:12px;"><strong>Grading</strong><div class="muted" style="font-size:0.85rem;">${gradeCats} categories</div></div>` : ''}
      ${calEvents > 0 ? `<div class="card" style="padding:12px;"><strong>Calendar</strong><div class="muted" style="font-size:0.85rem;">${calEvents} events</div></div>` : ''}
    </div>
    ${placeholders > 0 ? `
    <div style="margin-top:16px;padding:12px;background:var(--warning-light,#fff8e1);border-radius:var(--radius);font-size:0.85rem;">
      <strong>Note:</strong> ${placeholders} assignment${placeholders !== 1 ? 's' : ''} will be created as drafts with "PLACEHOLDER" in the title — they need question banks or content added before publishing.
    </div>` : ''}
  `;
}

// ═════════════════════════════════════════════════════════════════════════════
// EXECUTION — Create everything using existing DB calls
// ═════════════════════════════════════════════════════════════════════════════
async function aiSetupExecute() {
  if (wizState.executing) return;
  wizState.executing = true;

  const execBtn = document.getElementById('wizExecuteBtn');
  if (execBtn) { execBtn.disabled = true; execBtn.textContent = 'Creating...'; }

  try {
    // 1. Create course
    const courseId = generateId();
    wizState.courseId = courseId;

    let startHereContent = `Welcome to ${wizState.courseName}.`;
    let startHereLinks = [];

    const course = {
      id: courseId,
      name: wizState.courseName,
      code: wizState.courseCode,
      description: wizState.courseDescription,
      createdBy: appData.currentUser.id,
      startHereContent,
      startHereLinks
    };

    const savedCourse = await supabaseCreateCourse(course);
    if (!savedCourse) throw new Error('Failed to create course');
    appData.courses.push(course);

    // 2. Enroll instructor
    const enrollment = { userId: appData.currentUser.id, courseId, role: 'instructor' };
    const savedEnrollment = await supabaseCreateEnrollment(enrollment);
    if (!savedEnrollment) throw new Error('Failed to enroll instructor');
    appData.enrollments.push(enrollment);

    // 3. Process student invites
    if (wizState.studentEmails) {
      const emails = wizState.studentEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e && e.includes('@'));
      for (const email of emails) {
        const user = (appData.users || []).find(u => u.email === email);
        if (user) {
          const existing = appData.enrollments.find(e => e.userId === user.id && e.courseId === courseId);
          if (!existing) {
            const se = { userId: user.id, courseId, role: 'student' };
            const saved = await supabaseCreateEnrollment(se);
            if (saved) appData.enrollments.push(se);
          }
        } else {
          if (!appData.invites) appData.invites = [];
          const invite = { courseId, email, role: 'student', status: 'pending', sentAt: new Date().toISOString() };
          // Use dynamic import to avoid adding supabaseCreateInvite to deps
          try {
            const { supabaseCreateInvite } = await import('./database_interactions.js');
            const saved = await supabaseCreateInvite(invite);
            if (saved?.id) appData.invites.push({ ...invite, id: saved.id });
          } catch (_) { /* skip invite on failure */ }
        }
      }
    }

    // 4. Execute import from prior course (if selected)
    if (wizState.importSourceCourseId) {
      await executeImport(courseId);
    }

    // 5. Upload syllabus file
    if (wizState.syllabusFile) {
      const syllabusFileId = await uploadFileToStorage(wizState.syllabusFile, courseId, 'Syllabus');
      if (syllabusFileId) {
        course.startHereLinks = [{ label: 'Syllabus', fileId: syllabusFileId }];
        try {
          const { supabaseUpdateCourse } = await import('./database_interactions.js');
          await supabaseUpdateCourse(course);
        } catch (_) {}
      }
    }

    // 6. Upload user files
    for (let i = 0; i < wizState.uploadedFiles.length; i++) {
      const f = wizState.uploadedFiles[i];
      const orgEntry = wizState.fileOrgPlan.find(e => e.source === 'upload' && e.index === i);
      const folder = orgEntry?.folder || 'Course Documents';
      await uploadFileToStorage(f, courseId, folder);
    }

    // 7. Create modules from syllabus + place files
    if (wizState.modulePlan.length > 0) {
      await createModules(courseId);
    }

    // 8. Create assignments
    await createAssignments(courseId);

    // 9. Create grade categories
    await createGradeCategories(courseId);

    // 10. Create calendar events
    await createCalendarEvents(courseId);

    // 11. Set active course and navigate
    showToast('Course created successfully!', 'success');
    closeModal('aiCourseSetupModal');

    // Switch to the new course (sets activeCourseId, re-renders, navigates to home)
    if (switchCourseCallback) switchCourseCallback(courseId);

  } catch (err) {
    console.error('AI Course Setup execution error:', err);
    showToast('Error creating course: ' + err.message, 'error');
  } finally {
    wizState.executing = false;
    const execBtn = document.getElementById('wizExecuteBtn');
    if (execBtn) { execBtn.disabled = false; execBtn.textContent = 'Create Course'; }
  }
}

// ─── Import from prior course ────────────────────────────────────────────────
async function executeImport(destCourseId) {
  const sourceCourseId = wizState.importSourceCourseId;
  if (!sourceCourseId) return;

  const bankIdMap = {};
  const assignmentIdMap = {};
  const fileIdMap = {};

  // 1. Question banks
  if (wizState.importTypes.has('question_banks')) {
    const banks = (appData.questionBanks || []).filter(b => b.courseId === sourceCourseId);
    for (const bank of banks) {
      const newBankId = generateId();
      bankIdMap[bank.id] = newBankId;
      const newBank = {
        id: newBankId,
        courseId: destCourseId,
        name: bank.name,
        questions: (bank.questions || []).map(q => ({ ...q, id: generateId(), bankId: newBankId })),
        createdAt: new Date().toISOString()
      };
      const saved = await supabaseCreateQuestionBank(newBank);
      if (saved) {
        if (!appData.questionBanks) appData.questionBanks = [];
        appData.questionBanks.push(newBank);
      }
    }
  }

  // 2. Assignments
  if (wizState.importTypes.has('assignments')) {
    const assignments = (appData.assignments || []).filter(a => a.courseId === sourceCourseId);
    for (const a of assignments) {
      const newId = generateId();
      assignmentIdMap[a.id] = newId;
      const mappedBankId = a.questionBankId && bankIdMap[a.questionBankId] ? bankIdMap[a.questionBankId] : a.questionBankId;
      const newA = {
        ...a,
        id: newId,
        courseId: destCourseId,
        status: 'draft',
        dueDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        createdAt: new Date().toISOString(),
        questionBankId: mappedBankId
      };
      const saved = await supabaseCreateAssignment(newA);
      if (saved) appData.assignments.push(newA);
    }
  }

  // 3. Files
  if (wizState.importTypes.has('files')) {
    const files = (appData.files || []).filter(f => f.courseId === sourceCourseId && !f.isPlaceholder);
    for (const file of files) {
      const newFile = await supabaseCopyStorageFile(file, destCourseId, appData.currentUser.id);
      if (newFile) {
        fileIdMap[file.id] = newFile.id;
        appData.files.push(newFile);
      }
    }
  }

  // 4. Modules
  if (wizState.importTypes.has('modules')) {
    const modules = (appData.modules || []).filter(m => m.courseId === sourceCourseId).sort((a, b) => a.position - b.position);
    for (const mod of modules) {
      const newMod = {
        id: generateId(),
        courseId: destCourseId,
        name: mod.name,
        position: mod.position,
        hidden: mod.hidden || false,
        items: []
      };
      const saved = await supabaseCreateModule(newMod);
      if (!saved) continue;
      for (const item of (mod.items || [])) {
        let newRefId = item.refId;
        if (item.type === 'assignment' && assignmentIdMap[item.refId]) newRefId = assignmentIdMap[item.refId];
        if (item.type === 'file' && fileIdMap[item.refId]) newRefId = fileIdMap[item.refId];
        const newItem = { id: generateId(), type: item.type, refId: newRefId, title: item.title, url: item.url, position: item.position };
        const savedItem = await supabaseCreateModuleItem(newItem, newMod.id);
        if (savedItem) newMod.items.push(newItem);
      }
      if (!appData.modules) appData.modules = [];
      appData.modules.push(newMod);
    }
  }

  wizState.importedIds = {
    assignments: assignmentIdMap,
    files: fileIdMap,
    banks: bankIdMap,
    modules: {}
  };
}

// ─── File upload helper ──────────────────────────────────────────────────────
async function uploadFileToStorage(file, courseId, folder) {
  const fileId = generateId();
  const fileData = {
    id: fileId,
    courseId: courseId,
    name: file.name,
    type: file.name.split('.').pop(),
    size: file.size,
    folder: folder || null,
    storagePath: `courses/${courseId}/${fileId}_${file.name}`,
    uploadedBy: appData.currentUser.id,
    uploadedAt: new Date().toISOString()
  };

  if (supabaseClient) {
    try {
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('course-files')
        .upload(fileData.storagePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError || !uploadData?.path) {
        console.error('[AI Setup] Upload failed:', uploadError);
        return null;
      }
      fileData.storagePath = uploadData.path;
    } catch (e) {
      console.error('[AI Setup] Upload error:', e);
      return null;
    }
  }

  const saved = await supabaseCreateFile(fileData);
  if (saved) {
    appData.files.push(fileData);
    return fileId;
  }
  return null;
}

// ─── Create modules from plan ────────────────────────────────────────────────
async function createModules(courseId) {
  if (!appData.modules) appData.modules = [];
  const existingCount = appData.modules.filter(m => m.courseId === courseId).length;

  for (let i = 0; i < wizState.modulePlan.length; i++) {
    const mp = wizState.modulePlan[i];
    // Check if module already exists (from import)
    const existing = appData.modules.find(m => m.courseId === courseId && m.name === mp.name);
    if (existing) {
      wizState.createdModuleIds[mp.name] = existing.id;
      continue;
    }
    const mod = {
      id: generateId(),
      courseId,
      name: mp.name,
      position: existingCount + i,
      items: []
    };
    const saved = await supabaseCreateModule(mod);
    if (saved) {
      appData.modules.push(mod);
      wizState.createdModuleIds[mp.name] = mod.id;
    }
  }

  // Place files into modules based on organization plan
  for (const fOrg of wizState.fileOrgPlan) {
    if (!fOrg.moduleName) continue;
    const moduleId = wizState.createdModuleIds[fOrg.moduleName];
    if (!moduleId) continue;

    // Find actual file ID
    let fileId = null;
    if (fOrg.source === 'syllabus') {
      // Find the syllabus file that was uploaded
      fileId = appData.files.find(f => f.courseId === courseId && f.folder === 'Syllabus')?.id;
    } else if (fOrg.source === 'imported') {
      fileId = fOrg.id;
    } else if (fOrg.source === 'upload') {
      // Find uploaded file by name
      fileId = appData.files.find(f => f.courseId === courseId && f.name === fOrg.name)?.id;
    }
    if (!fileId) continue;

    const mod = appData.modules.find(m => m.id === moduleId);
    if (!mod) continue;
    const item = {
      id: generateId(),
      type: 'file',
      refId: fileId,
      position: (mod.items || []).length
    };
    const saved = await supabaseCreateModuleItem(item, moduleId);
    if (saved) {
      if (!mod.items) mod.items = [];
      mod.items.push(item);
    }
  }
}

// ─── Create assignments from plan ────────────────────────────────────────────
async function createAssignments(courseId) {
  for (const a of wizState.assignmentPlan) {
    if (a.existingId) continue; // already imported

    const isQuiz = a.assignmentType === 'quiz';
    const assignmentId = generateId();
    const newAssignment = {
      id: assignmentId,
      courseId,
      title: a.title,
      description: a.description || '',
      assignmentType: a.assignmentType || 'essay',
      gradingType: 'points',
      submissionModalities: isQuiz ? ['text'] : ['text'],
      points: a.points || 100,
      status: 'draft',
      dueDate: a.dueDate || new Date(Date.now() + 86400000 * 14).toISOString(),
      createdAt: new Date().toISOString(),
      category: a.category || (isQuiz ? 'quiz' : 'homework'),
      isPlaceholder: a.isPlaceholder || false,
      allowLateSubmissions: true,
      allowResubmission: false,
      createdBy: appData.currentUser.id
    };

    if (isQuiz) {
      newAssignment.questionBankId = null;
      newAssignment.numQuestions = null;
      newAssignment.randomizeQuestions = false;
    }

    const saved = await supabaseCreateAssignment(newAssignment);
    if (saved) {
      appData.assignments.push(newAssignment);
      wizState.createdAssignmentIds[a.title] = assignmentId;

      // Add to module if specified
      if (a.moduleName) {
        const moduleId = wizState.createdModuleIds[a.moduleName];
        if (moduleId) {
          const mod = appData.modules.find(m => m.id === moduleId);
          if (mod) {
            const item = {
              id: generateId(),
              type: isQuiz ? 'quiz' : 'assignment',
              refId: assignmentId,
              position: (mod.items || []).length
            };
            const savedItem = await supabaseCreateModuleItem(item, moduleId);
            if (savedItem) {
              if (!mod.items) mod.items = [];
              mod.items.push(item);
            }
          }
        }
      }
    }
  }
}

// ─── Create grade categories ─────────────────────────────────────────────────
async function createGradeCategories(courseId) {
  if (!appData.gradeCategories) appData.gradeCategories = [];
  for (const gc of wizState.gradingPlan) {
    const cat = {
      id: generateId(),
      courseId,
      name: gc.name,
      weight: gc.weight
    };
    const saved = await supabaseCreateGradeCategory(cat);
    if (saved) appData.gradeCategories.push(cat);
  }
}

// ─── Create calendar events ─────────────────────────────────────────────────
async function createCalendarEvents(courseId) {
  if (!appData.calendarEvents) appData.calendarEvents = [];
  for (const ev of wizState.calendarPlan) {
    const event = {
      id: generateId(),
      courseId,
      title: ev.title,
      eventDate: ev.eventDate,
      eventType: ev.eventType || 'Event',
      description: ev.description || '',
      createdBy: appData.currentUser.id,
      createdAt: new Date().toISOString()
    };
    const saved = await supabaseCreateCalendarEvent(event);
    if (saved) appData.calendarEvents.push(event);
  }
}
