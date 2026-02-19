// ═══════════════════════════════════════════════════════════════════════════════
// FILE HANDLING MODULE
// Handles file uploads, downloads, drag-and-drop, syllabus parsing
// ═══════════════════════════════════════════════════════════════════════════════

// Module dependencies (injected via init)
let appData = null;
let activeCourseId = null;
let supabaseClient = null;
let showToast = null;
let escapeHtml = null;
let generateId = null;
let formatDate = null;
let renderMarkdown = null;
let openModal = null;
let closeModal = null;
let setText = null;
let setHTML = null;
let getCourseById = null;
let getUserById = null;
let isStaff = null;
let studentViewMode = false;
let supabaseCreateFile = null;
let supabaseUpdateFile = null;
let supabaseDeleteFile = null;
let supabaseCreateQuiz = null;
let supabaseCreateAssignment = null;
let supabaseCreateModule = null;
let callGeminiAPIWithRetry = null;
let parseAiJsonResponse = null;
let renderModulesCallback = null;
let generateModalsCallback = null;
let confirm = null;

// Module state
let filesSearch = '';
let filesSort = 'date-desc';
let courseCreationSyllabusData = null;
let courseCreationSyllabusFile = null; // saved File reference (survives dropzone HTML replacement)
let parsedSyllabusData = null;
let pendingUploadFiles = [];

/**
 * Initialize file handling module with dependencies
 */
export function initFileHandlingModule(deps) {
  appData = deps.appData;
  supabaseClient = deps.supabaseClient;
  showToast = deps.showToast;
  escapeHtml = deps.escapeHtml;
  generateId = deps.generateId;
  formatDate = deps.formatDate;
  renderMarkdown = deps.renderMarkdown;
  openModal = deps.openModal;
  closeModal = deps.closeModal;
  setText = deps.setText;
  setHTML = deps.setHTML;
  getCourseById = deps.getCourseById;
  getUserById = deps.getUserById;
  isStaff = deps.isStaff;
  supabaseCreateFile = deps.supabaseCreateFile;
  supabaseUpdateFile = deps.supabaseUpdateFile;
  supabaseDeleteFile = deps.supabaseDeleteFile;
  supabaseCreateQuiz = deps.supabaseCreateQuiz;
  supabaseCreateAssignment = deps.supabaseCreateAssignment;
  supabaseCreateModule = deps.supabaseCreateModule;
  callGeminiAPIWithRetry = deps.callGeminiAPIWithRetry;
  parseAiJsonResponse = deps.parseAiJsonResponse;
  renderModulesCallback = deps.renderModules;
  generateModalsCallback = deps.generateModals;
  confirm = deps.confirm;

  // Set up global window functions for onclick handlers
  window.handleDragOver = handleDragOver;
  window.handleDragLeave = handleDragLeave;
  window.handleSyllabusDrop = handleSyllabusDrop;
  window.onSyllabusFileSelected = onSyllabusFileSelected;
  window.clearSyllabusUpload = clearSyllabusUpload;
  window.parseCourseSyllabus = parseCourseSyllabus;
  window.handleSyllabusParserDrop = handleSyllabusParserDrop;
  window.onSyllabusParserFileSelected = onSyllabusParserFileSelected;
  window.clearSyllabusParserUpload = clearSyllabusParserUpload;
  window.openSyllabusParserModal = openSyllabusParserModal;
  window.parseSyllabus = parseSyllabus;
  window.importParsedSyllabus = importParsedSyllabus;
  window.updateFilesSearch = updateFilesSearch;
  window.updateFilesSort = updateFilesSort;
  window.handleFilesDrop = handleFilesDrop;
  window.updateFileUploadPreview = updateFileUploadPreview;
  window.uploadFiles = uploadFiles;
  window.uploadFile = uploadFile;
  window.deleteFile = deleteFile;
  window.convertPlaceholderToFile = convertPlaceholderToFile;
  window.convertPlaceholderToLink = convertPlaceholderToLink;
  window.toggleFileVisibility = toggleFileVisibility;
  window.convertYouTubeUrl = convertYouTubeUrl;
}

/**
 * Update active course ID
 */
export function setActiveCourseId(courseId) {
  activeCourseId = courseId;
}

/**
 * Update student view mode
 */
export function setStudentViewMode(mode) {
  studentViewMode = mode;
}

/**
 * Get course creation syllabus data
 */
export function getCourseCreationSyllabusData() {
  return courseCreationSyllabusData;
}

/**
 * Clear course creation syllabus data
 */
export function clearCourseCreationSyllabusData() {
  courseCreationSyllabusData = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAG AND DROP HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleDragOver(e, dropZoneId) {
  e.preventDefault();
  e.stopPropagation();
  const dropZone = document.getElementById(dropZoneId);
  if (dropZone) {
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'var(--primary-light)';
  }
}

export function handleDragLeave(e, dropZoneId) {
  e.preventDefault();
  e.stopPropagation();
  const dropZone = document.getElementById(dropZoneId);
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYLLABUS PARSING - COURSE CREATION
// ═══════════════════════════════════════════════════════════════════════════════

export function handleSyllabusDrop(e) {
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

export function onSyllabusFileSelected() {
  const input = document.getElementById('courseCreationSyllabus');
  if (!input || !input.files.length) return;
  const file = input.files[0];
  courseCreationSyllabusFile = file; // save before innerHTML wipes the input element
  const dropZone = document.getElementById('syllabusDropZone');
  if (dropZone) {
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
      <input type="file" id="courseCreationSyllabus" accept=".pdf,.doc,.docx,.txt" style="display:none;" onchange="onSyllabusFileSelected()">
    `;
    // Re-attach the selected file to the new hidden input via DataTransfer so
    // parseCourseSyllabus can read input.files directly; courseCreationSyllabusFile
    // is the fallback when this assignment isn't supported by the browser.
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      const newInput = document.getElementById('courseCreationSyllabus');
      if (newInput) newInput.files = dt.files;
    } catch (_) { /* DataTransfer unavailable in some environments */ }
  }
}

export function clearSyllabusUpload() {
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
  courseCreationSyllabusFile = null;
}

export async function parseCourseSyllabus() {
  const fileInput = document.getElementById('courseCreationSyllabus');
  const file = fileInput?.files?.[0] || courseCreationSyllabusFile;
  if (!file) {
    showToast('Please select a syllabus file first', 'error');
    return;
  }

  const statusEl = document.getElementById('courseCreationSyllabusStatus');
  if (statusEl) statusEl.innerHTML = '<div class="ai-spinner" style="display:inline-block; width:16px; height:16px; margin-right:8px;"></div> Parsing syllabus with AI…';
  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || 'application/octet-stream';

    const systemPrompt = `You are analyzing a course syllabus. Extract everything needed to set up this course in an LMS. Return ONLY valid JSON with this exact shape:
{
  "courseInfo": {
    "name": "Full course name (e.g. Introduction to Economics)",
    "code": "Course code (e.g. ECON 101)",
    "instructor": "Instructor/professor name if mentioned",
    "description": "2-4 sentence course description from the syllabus"
  },
  "modules": [
    {
      "name": "Module/Week/Unit name (e.g. Week 1: Supply and Demand)",
      "items": [
        {
          "type": "assignment",
          "title": "Item title",
          "description": "What students need to do",
          "dueDate": "YYYY-MM-DDThh:mm:ss.000Z or null",
          "points": 100
        }
      ]
    }
  ]
}
Rules:
- type must be "assignment" (homework/essays/projects), "quiz" (tests/quizzes/exams/midterms/finals), or "reading" (chapters/readings/lectures)
- Create a module for each week, unit, topic section, or logical grouping
- Create an item for every graded activity and every assigned reading
- If no due date is found, use null
- If no points are specified, estimate based on weight (e.g. 30% of 100pts course = 30pts)
- Extract the description field even if it requires summarizing the syllabus`;

    const contents = [{
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: systemPrompt }
      ]
    }];

    const data = await callGeminiAPIWithRetry(contents, { responseMimeType: 'application/json', temperature: 0.2 });
    if (data.error) throw new Error(data.error.message);

    const text = data.candidates[0].content.parts[0].text;
    const parsed = parseAiJsonResponse(text);
    courseCreationSyllabusData = parsed;

    // Auto-fill course info fields (only if empty)
    if (parsed.courseInfo) {
      const nameEl = document.getElementById('courseName');
      const codeEl = document.getElementById('courseCode');
      const descEl = document.getElementById('courseDescription');
      if (parsed.courseInfo.name && nameEl && !nameEl.value)
        nameEl.value = parsed.courseInfo.name;
      if (parsed.courseInfo.code && codeEl && !codeEl.value)
        codeEl.value = parsed.courseInfo.code;
      if (parsed.courseInfo.description && descEl && !descEl.value)
        descEl.value = parsed.courseInfo.description;
    }

    // Show module/item preview with checkboxes
    const previewEl = document.getElementById('courseCreationModulesPreview');
    const listEl = document.getElementById('courseCreationModulesList');
    if (parsed.modules && parsed.modules.length > 0) {
      let totalAssignments = 0, totalQuizzes = 0, totalReadings = 0;
      parsed.modules.forEach(m => (m.items || []).forEach(it => {
        if (it.type === 'quiz') totalQuizzes++;
        else if (it.type === 'reading') totalReadings++;
        else totalAssignments++;
      }));
      const totalItems = totalAssignments + totalQuizzes + totalReadings;

      if (previewEl) previewEl.style.display = 'block';
      if (listEl) listEl.innerHTML = parsed.modules.map((mod, idx) => {
        const counts = (mod.items || []).reduce((acc, it) => {
          acc[it.type] = (acc[it.type] || 0) + 1;
          return acc;
        }, {});
        const countParts = [];
        if (counts.assignment) countParts.push(`${counts.assignment} assignment${counts.assignment > 1 ? 's' : ''}`);
        if (counts.quiz) countParts.push(`${counts.quiz} quiz/exam${counts.quiz > 1 ? 's' : ''}`);
        if (counts.reading) countParts.push(`${counts.reading} reading${counts.reading > 1 ? 's' : ''}`);
        return `
          <label style="display:flex; align-items:center; gap:8px; padding:4px 0;">
            <input type="checkbox" checked class="course-creation-module-check" data-index="${idx}">
            <span>${escapeHtml(mod.name)}</span>
            <span class="muted" style="font-size:0.8rem;">${countParts.join(', ') || 'no items'}</span>
          </label>
        `;
      }).join('');

      const summaryParts = [];
      if (totalAssignments) summaryParts.push(`${totalAssignments} assignments`);
      if (totalQuizzes) summaryParts.push(`${totalQuizzes} quizzes/exams`);
      if (totalReadings) summaryParts.push(`${totalReadings} readings`);
      const instructorNote = parsed.courseInfo?.instructor ? ` · Instructor: ${parsed.courseInfo.instructor}` : '';
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--success);">✓ Parsed ${parsed.modules.length} modules, ${totalItems} items (${summaryParts.join(', ')})${instructorNote}</span>`;
    } else {
      if (previewEl) previewEl.style.display = 'none';
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--warning);">No modules found — course info was extracted above</span>';
    }

  } catch (err) {
    console.error('Syllabus parsing error:', err);
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--error);">Parsing error: ${escapeHtml(err.message)}</span>`;
    courseCreationSyllabusData = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYLLABUS PARSING - MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export function handleSyllabusParserDrop(e) {
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

export function onSyllabusParserFileSelected() {
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

export function clearSyllabusParserUpload() {
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

export function openSyllabusParserModal() {
  if (generateModalsCallback) generateModalsCallback();
  document.getElementById('syllabusFile').value = '';
  document.getElementById('syllabusText').value = '';
  document.getElementById('syllabusParsedPreview').innerHTML = '<div class="muted">Upload a syllabus or paste text to extract modules and assignments</div>';
  openModal('syllabusParserModal');
}

export async function parseSyllabus() {
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

  let contents;

  // If file uploaded, send as base64 inline data to Gemini
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || 'application/octet-stream';

      contents = [{
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: systemPrompt }
        ]
      }];
    } catch (err) {
      showToast('Could not read file: ' + err.message, 'error');
      return;
    }
  } else if (textInput) {
    // Use pasted text
    contents = [{ parts: [{ text: systemPrompt + '\n\nSYLLABUS:\n' + textInput }] }];
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

    const data = await callGeminiAPIWithRetry(contents, { responseMimeType: "application/json", temperature: 0.2 });
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

export async function importParsedSyllabus() {
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

  showToast('Importing syllabus content...', 'info');

  for (const [modIndex, mod] of parsedSyllabusData.modules.entries()) {
    if (!checkedModuleIndices.has(modIndex)) continue;

    const courseModules = appData.modules.filter(m => m.courseId === activeCourseId);
    const maxPosition = courseModules.length > 0 ? Math.max(...courseModules.map(m => m.position)) + 1 : 0;

    const newModule = {
      id: generateId(),
      courseId: activeCourseId,
      name: mod.name,
      position: maxPosition + modulesCreated,
      items: []
    };

    for (const [itemIndex, item] of (mod.items || []).entries()) {
      if (!checkedItemsMap[modIndex] || !checkedItemsMap[modIndex].has(itemIndex)) continue;

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
          isPlaceholder: true
        };
        await supabaseCreateQuiz(newQuiz);
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
          hidden: true,
          isPlaceholder: true,
          description: item.description || '',
          uploadedBy: appData.currentUser.id,
          uploadedAt: new Date().toISOString()
        };
        await supabaseCreateFile(newFile);
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
          isPlaceholder: true
        };
        await supabaseCreateAssignment(newAssignment);
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
    }

    if (newModule.items.length > 0) {
      await supabaseCreateModule(newModule);
      appData.modules.push(newModule);
      modulesCreated++;
    }
  }

  closeModal('syllabusParserModal');
  if (renderModulesCallback) renderModulesCallback();
  showToast(`Imported ${modulesCreated} modules with ${itemsCreated} items (${placeholdersCreated} placeholders)`, 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export async function fileToBase64(file) {
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

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function convertYouTubeUrl(url) {
  if (!url) return url;

  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

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

// ═══════════════════════════════════════════════════════════════════════════════
// FILE VIEWER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * View a file in a popup if it's a viewable format, or download it otherwise.
 */
export async function viewFile(fileId) {
  const file = appData.files.find(f => f.id === fileId);
  if (!file) return;

  // External/YouTube links open directly
  if (file.externalUrl) {
    window.open(file.externalUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  if (!file.storagePath) {
    showToast('No file content available', 'error');
    return;
  }

  // Get a signed URL from Supabase Storage (60 min)
  // Falls back to public URL if signing fails (e.g. file not in storage)
  let fileUrl;
  try {
    const { data, error } = await supabaseClient.storage
      .from('course-files')
      .createSignedUrl(file.storagePath, 3600);
    if (!error && data?.signedUrl) {
      fileUrl = data.signedUrl;
    } else if (error?.message?.toLowerCase().includes('bucket not found') ||
               error?.error?.toLowerCase?.()?.includes('bucket not found')) {
      // Supabase returns "Bucket not found" both for missing buckets AND for RLS
      // policy denials on storage.objects — check the SELECT policy on course-files.
      console.error('[viewFile] Storage access denied (RLS or missing bucket):', error);
      showToast('File access denied — check the SELECT policy on the "course-files" storage bucket in Supabase', 'error');
      return;
    } else {
      // Fallback: try public URL (works if bucket is public)
      const { data: pubData } = supabaseClient.storage
        .from('course-files')
        .getPublicUrl(file.storagePath);
      if (pubData?.publicUrl) {
        fileUrl = pubData.publicUrl;
      } else {
        showToast('File not available — it may need to be re-uploaded', 'error');
        return;
      }
    }
  } catch (err) {
    showToast('Error accessing file — it may need to be re-uploaded', 'error');
    return;
  }

  // Validate the URL is reachable before loading it in the viewer.
  // createSignedUrl sometimes succeeds even when the bucket doesn't exist;
  // without this check the viewer iframe would show raw Supabase JSON errors.
  try {
    const headRes = await fetch(fileUrl, { method: 'HEAD' });
    if (!headRes.ok) {
      if (headRes.status === 404) {
        showToast(
          'File not found in storage. Ensure the "course-files" bucket exists in Supabase and the file was uploaded correctly.',
          'error'
        );
      } else {
        showToast(`Storage access error (${headRes.status}). Check your Supabase storage permissions.`, 'error');
      }
      return;
    }
  } catch (_) {
    // Network / CORS error — fall through and let the browser attempt to load
  }

  const ext = (file.name || '').split('.').pop().toLowerCase();
  const viewableExts = ['pdf', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
  const googleViewerExts = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];

  // Build viewer modal
  let viewerContent = '';
  if (viewableExts.includes(ext)) {
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      viewerContent = `<img src="${escapeHtml(fileUrl)}" alt="${escapeHtml(file.name)}" style="max-width:100%; max-height:75vh; object-fit:contain; display:block; margin:0 auto;">`;
    } else if (ext === 'txt') {
      // Load text inline
      viewerContent = `<div id="fileViewerTextContent" style="padding:16px; font-family:monospace; white-space:pre-wrap; max-height:70vh; overflow-y:auto; background:var(--bg-color); border-radius:var(--radius);">Loading…</div>`;
    } else {
      // PDF via iframe
      viewerContent = `<iframe src="${escapeHtml(fileUrl)}" style="width:100%; height:75vh; border:none; border-radius:var(--radius);"></iframe>`;
    }
  } else if (googleViewerExts.includes(ext)) {
    const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
    viewerContent = `<iframe src="${escapeHtml(googleViewerUrl)}" style="width:100%; height:75vh; border:none; border-radius:var(--radius);"></iframe>`;
  } else {
    // Trigger download for unsupported formats
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Downloading file…', 'info');
    return;
  }

  // Remove any existing viewer modal
  document.getElementById('fileViewerModal')?.remove();

  const modalHtml = `
    <div class="modal-overlay" id="fileViewerModal" style="display:flex; z-index:900;">
      <div class="modal" style="max-width:90vw; width:900px; max-height:95vh; display:flex; flex-direction:column;">
        <div class="modal-header" style="flex-shrink:0;">
          <h2 class="modal-title" style="font-size:1rem;">${escapeHtml(file.name)}</h2>
          <div style="display:flex; gap:8px; align-items:center;">
            <a href="${escapeHtml(fileUrl)}" download="${escapeHtml(file.name)}" class="btn btn-secondary btn-sm">Download</a>
            <button class="modal-close" onclick="document.getElementById('fileViewerModal').remove()">&times;</button>
          </div>
        </div>
        <div class="modal-body" style="flex:1; overflow:hidden; padding:0;">
          ${viewerContent}
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', modalHtml);

  // Load TXT content
  if (ext === 'txt') {
    try {
      const resp = await fetch(fileUrl);
      const text = await resp.text();
      const el = document.getElementById('fileViewerTextContent');
      if (el) el.textContent = text;
    } catch (err) {
      const el = document.getElementById('fileViewerTextContent');
      if (el) el.textContent = 'Failed to load file content.';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILES PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function updateFilesSearch(value) {
  filesSearch = value.toLowerCase();
  renderFiles();
}

export function updateFilesSort(value) {
  filesSort = value;
  renderFiles();
}

export function renderFiles() {
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
            ` : !isPlaceholder && f.storagePath ? `
              <button class="btn btn-primary btn-sm" onclick="window.viewFile('${f.id}')">View / Download</button>
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

// ═══════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD
// ═══════════════════════════════════════════════════════════════════════════════

export function handleFilesDrop(e) {
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

export function updateFileUploadPreview() {
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

export async function uploadFiles() {
  if (pendingUploadFiles.length === 0) {
    showToast('Please select files to upload', 'error');
    return;
  }

  if (!supabaseClient) {
    showToast('Database not connected', 'error');
    return;
  }

  // Verify auth state before attempting upload
  const { data: { user: authUser } } = await supabaseClient.auth.getUser();
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
        errorCount++;
        continue; // never create a DB record without a valid storagePath
      }

      const fileData = {
        id: fileId,
        courseId: activeCourseId,
        name: file.name,
        type: file.name.split('.').pop(),
        size: file.size,
        // Only store storagePath when upload actually succeeded
        storagePath: (!uploadError && uploadData?.path) ? uploadData.path : null,
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
export async function uploadFile() {
  await uploadFiles();
}

export function deleteFile(id) {
  confirm('Delete this file?', async () => {
    // Remove from storage bucket first (if there is a stored file)
    const file = appData.files.find(f => f.id === id);
    if (file?.storagePath && supabaseClient) {
      const { error: storageError } = await supabaseClient.storage
        .from('course-files')
        .remove([file.storagePath]);
      if (storageError) {
        console.warn('[deleteFile] Storage removal error (continuing with DB delete):', storageError);
      }
    }

    // Delete metadata from database
    await supabaseDeleteFile(id);

    appData.files = appData.files.filter(f => f.id !== id);

    renderFiles();
    showToast('File deleted', 'success');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE VISIBILITY & CONVERSION
// ═══════════════════════════════════════════════════════════════════════════════

export async function toggleFileVisibility(fileId) {
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

  if (renderModulesCallback) renderModulesCallback();
  renderFiles();
  showToast(file.hidden ? 'File hidden from students' : 'File visible to students', 'info');
}

export function convertPlaceholderToFile(fileId) {
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

      renderFiles();
      if (renderModulesCallback) renderModulesCallback();
      showToast('File uploaded!', 'success');
    }
  };
  input.click();
}

export async function convertPlaceholderToLink(fileId) {
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

    renderFiles();
    if (renderModulesCallback) renderModulesCallback();
    showToast('External link added!', 'success');
  }
}

export function downloadAllSubmissions(assignmentId) {
  showToast('ZIP download would be implemented with JSZip library', 'info');
  // In production: use JSZip to create ZIP of all submissions
}

// Export all functions
export {
  filesSearch,
  filesSort,
  pendingUploadFiles
};
