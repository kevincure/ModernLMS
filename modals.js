// ═══════════════════════════════════════════════════════════════════════════════
// MODALS MODULE
// Contains all modal HTML generation and related helper functions
// ═══════════════════════════════════════════════════════════════════════════════

// Module dependencies (injected via init)
let appData = null;
let activeCourseId = null;
let setHTML = null;
let escapeHtml = null;

/**
 * Initialize modals module with dependencies
 */
export function initModalsModule(deps) {
  appData = deps.appData;
  setHTML = deps.setHTML;
  escapeHtml = deps.escapeHtml;

  // Set up global window functions
  window.generateModals = generateModals;
}

/**
 * Update active course ID
 */
export function setActiveCourseId(courseId) {
  activeCourseId = courseId;
}

/**
 * Generate all modal HTML and inject into DOM
 */
export function generateModals() {
  // Get modules for external link dropdown
  const modules = (appData.modules || []).filter(m => m.courseId === activeCourseId);
  const moduleOptions = modules.length
    ? modules.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')
    : '<option value="">No modules available</option>';

  setHTML('modalsContainer', `
    <!-- External Link Modal -->
    <div class="modal-overlay" id="externalLinkModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add External Link</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('externalLinkModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px; padding:12px; background:var(--primary-light); border-radius:var(--radius);">
            💡 YouTube links are automatically converted to embeds for inline viewing.
          </div>
          <div class="form-group">
            <label class="form-label" for="externalLinkTitle">Title</label>
            <input type="text" class="form-input" id="externalLinkTitle" placeholder="e.g., Lecture Video #1">
          </div>
          <div class="form-group">
            <label class="form-label" for="externalLinkUrl">URL</label>
            <input type="url" class="form-input" id="externalLinkUrl" placeholder="https://...">
          </div>
          <div class="form-group">
            <label class="form-label" for="externalLinkType">Add to</label>
            <select class="form-select" id="externalLinkType" onchange="document.getElementById('externalLinkModuleGroup').style.display = this.value === 'module' ? 'block' : 'none';">
              <option value="file">Files (as external link)</option>
              <option value="module">Module item</option>
            </select>
          </div>
          <div class="form-group" id="externalLinkModuleGroup" style="display:none;">
            <label class="form-label" for="externalLinkModuleSelect">Select Module</label>
            <select class="form-select" id="externalLinkModuleSelect">
              ${moduleOptions}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('externalLinkModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveExternalLink()">Add Link</button>
        </div>
      </div>
    </div>

    <!-- Announcement Modal -->
    <div class="modal-overlay" id="announcementModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="announcementModalTitle">New Announcement</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('announcementModal'); resetAnnouncementModal();">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="announcementTitle">Title</label>
            <input type="text" class="form-input" id="announcementTitle" placeholder="Enter title">
          </div>
          <div class="form-group">
            <label class="form-label" for="announcementContent">Content</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;" role="toolbar" aria-label="Text formatting">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('announcementContent')" title="Insert Link">Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('announcementContent')" title="Insert File">File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('announcementContent')" title="Insert Video">Video</button>
            </div>
            <textarea class="form-textarea" id="announcementContent" placeholder="Write your update... (supports Markdown)"></textarea>
            <div class="hint" style="margin-top:4px;">Supports Markdown: **bold**, *italic*, [link](url)</div>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="announcementPinned">
              <span>Pin this announcement</span>
            </label>
            <div class="hint">Pinned announcements appear at the top of the Announcements page</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('announcementModal'); resetAnnouncementModal();">Cancel</button>
          <button class="btn btn-primary" id="announcementSubmitBtn" onclick="saveAnnouncementChanges()">Post</button>
        </div>
      </div>
    </div>

    <!-- Create Course Modal -->
    <div class="modal-overlay" id="createCourseModal">
      <div class="modal" style="max-width:600px;">
        <div class="modal-header">
          <h2 class="modal-title">Create Course</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('createCourseModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="padding:12px; background:var(--primary-light); border-radius:var(--radius); margin-bottom:16px;">
            <label class="form-label" for="syllabusDropZone" style="margin-bottom:8px;">Quick Start: Upload Syllabus (optional)</label>
            <div id="syllabusDropZone" class="drop-zone"
                 role="button" tabindex="0"
                 aria-label="Upload syllabus file — drag and drop or press Enter to browse"
                 ondragover="handleDragOver(event, 'syllabusDropZone')"
                 ondragleave="handleDragLeave(event, 'syllabusDropZone')"
                 ondrop="handleSyllabusDrop(event)"
                 onclick="document.getElementById('courseCreationSyllabus').click()"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('courseCreationSyllabus').click();}"
                 style="border:2px dashed var(--border-color); border-radius:var(--radius); padding:24px; text-align:center; cursor:pointer; transition:all 0.2s;">
              <div style="font-weight:500;">Drag & drop syllabus here</div>
              <div class="muted" style="font-size:0.85rem;">or press Enter to browse (PDF, DOC, TXT)</div>
              <input type="file" id="courseCreationSyllabus" accept=".pdf,.doc,.docx,.txt,.tex" style="display:none;" onchange="onSyllabusFileSelected()">
            </div>
            <div id="courseCreationSyllabusStatus" style="margin-top:8px;"></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="courseName">Course Name</label>
            <input type="text" class="form-input" id="courseName" placeholder="e.g., ECON 101 - Introduction to Economics">
          </div>
          <div class="form-group">
            <label class="form-label" for="courseCode">Course Code</label>
            <input type="text" class="form-input" id="courseCode" placeholder="e.g., ECON101">
          </div>
          <div class="form-group">
            <label class="form-label" for="courseDescription">Description (optional)</label>
            <textarea class="form-textarea" id="courseDescription" placeholder="Course description..." rows="2"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="courseEmails">Student Emails (optional)</label>
            <textarea class="form-textarea" id="courseEmails" placeholder="Enter emails separated by commas, semicolons, or newlines:
student1@university.edu, student2@university.edu" rows="3"></textarea>
            <div class="hint">Students will be invited to join the course</div>
          </div>
          <div id="courseCreationModulesPreview" style="display:none;">
            <label class="form-label" for="courseCreationModulesList">Modules to Create from Syllabus</label>
            <div id="courseCreationModulesList" style="max-height:200px; overflow-y:auto; border:1px solid var(--border-light); border-radius:var(--radius); padding:8px;"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('createCourseModal')">Cancel</button>
          <button class="btn btn-primary" onclick="createCourse()">Create Course</button>
        </div>
      </div>
    </div>

    <!-- Pending Invites Modal (for students who log in with unaccepted invites) -->
    <div class="modal-overlay" id="pendingInvitesModal">
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <h2 class="modal-title">Course Invitations</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('pendingInvitesModal')">&times;</button>
        </div>
        <div class="modal-body">
          <p class="muted" style="margin-bottom:16px;">You have been invited to the following courses. Accept to enroll or decline to remove the invitation.</p>
          <div id="pendingInvitesList"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('pendingInvitesModal')">Close</button>
        </div>
      </div>
    </div>

    <!-- Quiz Take Modal -->
    <div class="modal-overlay" id="quizTakeModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="quizTakeTitle">Take Quiz</h2>
            <div class="muted" id="quizTakeMeta"></div>
          </div>
          <div class="quiz-timer" id="quizTimer">No time limit</div>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('quizTakeModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div id="quizTakeQuestions" class="quiz-take-list"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizTakeModal')">Cancel</button>
          <button class="btn btn-primary" onclick="submitQuiz()">Submit Quiz</button>
        </div>
      </div>
    </div>

    <!-- Quiz Submissions Modal -->
    <div class="modal-overlay" id="quizSubmissionsModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title" id="quizSubmissionsTitle">Quiz Submissions</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('quizSubmissionsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div id="quizSubmissionsList"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizSubmissionsModal')">Close</button>
        </div>
      </div>
    </div>

    <!-- Quiz Grade Modal -->
    <div class="modal-overlay" id="quizGradeModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="quizGradeTitle">Grade Quiz</h2>
            <div class="muted" id="quizGradePoints"></div>
          </div>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('quizGradeModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="quizGradeSubmissionId">
          <input type="hidden" id="quizGradeQuizId">
          <div id="quizGradeAnswers" class="quiz-grade-list"></div>
          <div class="form-group">
            <label class="form-label" for="quizGradeScore">Score</label>
            <input type="number" class="form-input" id="quizGradeScore" min="0" placeholder="Enter score">
          </div>
          <div class="form-group">
            <label class="form-label" for="quizGradeFeedback">Feedback (optional)</label>
            <textarea class="form-textarea" id="quizGradeFeedback" rows="3" placeholder="Leave feedback..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizGradeModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveQuizGrade()">Save Grade</button>
        </div>
      </div>
    </div>

    <!-- Quiz Review Modal -->
    <div class="modal-overlay" id="quizReviewModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title" id="quizReviewTitle">Quiz Submission</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('quizReviewModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div id="quizReviewList" class="quiz-grade-list"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizReviewModal')">Close</button>
        </div>
      </div>
    </div>

    <!-- Submit Assignment Modal -->
    <div class="modal-overlay" id="submitModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Submit Assignment</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('submitModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="submitModalAssignmentId">
          <div class="form-group">
            <label class="form-label" for="submissionText">Submission Text</label>
            <textarea class="form-textarea" id="submissionText" placeholder="Enter your submission..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="submissionFile">Upload File (optional)</label>
            <input type="file" class="form-input" id="submissionFile">
            <div class="hint">Files under 1MB stored locally. Larger files: metadata only.</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('submitModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveSubmission()">Submit</button>
        </div>
      </div>
    </div>

    <!-- File Upload Modal -->
    <div class="modal-overlay" id="fileUploadModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Upload Files</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('fileUploadModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="fileDropZone">Select Files (up to 50)</label>
            <div id="fileDropZone"
                 role="button" tabindex="0"
                 aria-label="Upload files — drag and drop or press Enter to browse"
                 style="border:2px dashed var(--border-color); border-radius:var(--radius); padding:32px; text-align:center; cursor:pointer; transition: all 0.2s;"
                 ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'; this.style.background='var(--primary-light)';"
                 ondragleave="this.style.borderColor='var(--border-color)'; this.style.background='';"
                 ondrop="handleFilesDrop(event)"
                 onclick="document.getElementById('fileUpload').click()"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('fileUpload').click();}">
              <div style="font-weight:500; margin-bottom:4px;">Drag and drop files here</div>
              <div class="muted">or press Enter to browse</div>
            </div>
            <input type="file" class="form-input" id="fileUpload" accept=".pdf,.doc,.docx,.txt,.tex,.png,.jpg,.jpeg,.gif,.webp,.svg,.ppt,.pptx,.xls,.xlsx,.zip" multiple style="display:none;" onchange="updateFileUploadPreview()">
            <div id="fileUploadPreview" style="margin-top:12px;"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('fileUploadModal')">Cancel</button>
          <button class="btn btn-primary" onclick="uploadFiles()">Upload</button>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div class="modal-overlay" id="settingsModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Settings</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('settingsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="padding:16px; background:var(--success-light, #e8f5e9); border-radius:var(--radius); margin-bottom:16px;">
            <div style="font-weight:600; margin-bottom:8px;">Account</div>
            <div class="hint">
              <strong>${appData.currentUser?.name || appData.currentUser?.email || 'Not signed in'}</strong><br>
              ${appData.currentUser?.email || ''}<br>
              <span style="color:var(--text-muted); font-size:0.85rem;">Signed in with Google</span>
            </div>
          </div>
          <div class="form-group">
            <div class="hint" style="background: var(--bg-color); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
              <strong>AI Features</strong><br>
              AI features are configured server-side and available to all users.
            </div>
          </div>

        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('settingsModal')">Close</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="startHereModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title">Edit Start Here</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('startHereModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="startHereCourseId">
          <div class="form-group">
            <label class="form-label" for="startHereTitle">Title</label>
            <input type="text" class="form-input" id="startHereTitle" placeholder="Start Here">
          </div>
          <div class="form-group">
            <label class="form-label" for="startHereContent">Intro content (supports Markdown)</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;" role="toolbar" aria-label="Text formatting">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('startHereContent')" title="Insert Link">Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('startHereContent')" title="Insert File">File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('startHereContent')" title="Insert Video">Video</button>
            </div>
            <textarea class="form-textarea" id="startHereContent" rows="4" placeholder="Welcome message..."></textarea>
            <div class="hint" style="margin-top:4px;">Supports Markdown: **bold**, *italic*, [link](url)</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="startHereLinksEditor">Pinned essentials</label>
            <div class="hint" style="margin-bottom:8px;">Add essential links for students (syllabus, office hours, etc.)</div>
            <div id="startHereLinksEditor"></div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addStartHereLink()" style="margin-top:8px;">+ Add link</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('startHereModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveStartHere()">Save</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="aiCreateModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title">AI Create</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('aiCreateModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="aiCreateType">Create</label>
              <select class="form-select" id="aiCreateType" onchange="updateAiCreateType()">
                <option value="announcement">Announcement</option>
                <option value="rubric">Rubric</option>
              </select>
            </div>
            <div class="form-group" id="aiRubricGroup" style="display:none;">
              <label class="form-label" for="aiRubricAssignment">Assignment</label>
              <select class="form-select" id="aiRubricAssignment"></select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="aiCreatePrompt">Prompt</label>
            <textarea class="form-textarea" id="aiCreatePrompt" rows="4" placeholder="Describe what you want the AI to draft..."></textarea>
          </div>
          <div class="card" style="padding:16px; margin-top:12px;">
            <div class="card-title">Preview</div>
            <div id="aiDraftPreview" class="ai-preview"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('aiCreateModal')">Cancel</button>
          <button class="btn btn-secondary" onclick="generateAiDraft()">Generate Draft</button>
          <button class="btn btn-primary" onclick="applyAiDraft()">Use Draft</button>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div class="modal-overlay" id="confirmModal">
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <h2 class="modal-title" id="confirmTitle">Confirm</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('confirmModal')">&times;</button>
        </div>
        <div class="modal-body">
          <p id="confirmMessage"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('confirmModal')">Cancel</button>
          <button class="btn btn-primary" id="confirmButton">Confirm</button>
        </div>
      </div>
    </div>

    <!-- Edit Course Modal -->
    <div class="modal-overlay" id="editCourseModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Edit Course</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('editCourseModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="editCourseName">Course Name</label>
            <input type="text" class="form-input" id="editCourseName" placeholder="e.g., ECON 101 - Introduction to Economics">
          </div>
          <div class="form-group">
            <label class="form-label" for="editCourseCode">Course Code</label>
            <input type="text" class="form-input" id="editCourseCode" placeholder="e.g., ECON101">
          </div>
          <div class="form-group">
            <label class="form-label" for="editCourseDescription">Description (optional)</label>
            <textarea class="form-textarea" id="editCourseDescription" placeholder="Course description..." rows="3"></textarea>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="editCourseActive" checked>
              <span>Course is active</span>
            </label>
            <div class="hint">Inactive courses are hidden from the course list but data is preserved</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('editCourseModal')">Cancel</button>
          <button class="btn btn-primary" onclick="updateCourse()">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- Import Content Modal -->
    <div class="modal-overlay" id="importContentModal">
      <div class="modal" style="max-width:580px;">
        <div class="modal-header">
          <h2 class="modal-title">Import Content</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('importContentModal')">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Destination course (the card we clicked) -->
          <input type="hidden" id="importDestCourseHidden">
          <div id="importDestLabel" style="margin-bottom:12px; padding:8px 12px; background:var(--primary-light); border-radius:var(--radius); font-size:0.9rem;">
            Importing into: <strong id="importDestCourseName"></strong>
          </div>

          <!-- Source course dropdown (pick which course to import FROM) -->
          <div class="form-group">
            <label class="form-label" for="importSourceCourse">Import from course</label>
            <select class="form-input" id="importSourceCourse" onchange="loadImportItems()">
              <option value="">-- Select a source course --</option>
            </select>
          </div>

          <!-- Content type checkboxes -->
          <fieldset class="form-group" style="border:none; padding:0; margin:0;">
            <legend class="form-label">Content to import</legend>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:6px;">
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer; background:var(--bg-color); border:1px solid var(--border-color); border-radius:6px; padding:6px 10px; font-size:0.875rem;">
                <input type="checkbox" class="import-type-cb" value="assignments" checked> Assignments
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer; background:var(--bg-color); border:1px solid var(--border-color); border-radius:6px; padding:6px 10px; font-size:0.875rem;">
                <input type="checkbox" class="import-type-cb" value="question_banks" checked> Question Banks
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer; background:var(--bg-color); border:1px solid var(--border-color); border-radius:6px; padding:6px 10px; font-size:0.875rem;">
                <input type="checkbox" class="import-type-cb" value="modules" checked> Modules
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer; background:var(--bg-color); border:1px solid var(--border-color); border-radius:6px; padding:6px 10px; font-size:0.875rem;">
                <input type="checkbox" class="import-type-cb" value="files" checked> Files
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer; background:var(--bg-color); border:1px solid var(--border-color); border-radius:6px; padding:6px 10px; font-size:0.875rem;">
                <input type="checkbox" class="import-type-cb" value="announcements"> Announcements
              </label>
            </div>
            <div class="hint" style="margin-top:8px;">By default this clones the course — its files, assignments, question banks, and modules. Announcements are unchecked and can be optionally included.</div>
          </fieldset>

          <!-- Per-item selection list -->
          <div id="importItemsList" style="max-height:260px; overflow-y:auto;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('importContentModal')">Cancel</button>
          <button class="btn btn-primary" onclick="executeImportContent()">Import Selected</button>
        </div>
      </div>
    </div>

    <!-- Add Person Modal -->
    <div class="modal-overlay" id="addPersonModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add Person to Course</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('addPersonModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="addPersonEmail">Email Address</label>
            <input type="email" class="form-input" id="addPersonEmail" placeholder="student@university.edu" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" for="addPersonRole">Role</label>
            <select class="form-select" id="addPersonRole">
              <option value="student">Student</option>
              <option value="ta">Teaching Assistant</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('addPersonModal')">Cancel</button>
          <button class="btn btn-primary" onclick="addPersonToCourse()">Add Person</button>
        </div>
      </div>
    </div>

    <!-- Bulk Student Import Modal -->
    <div class="modal-overlay" id="bulkStudentImportModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Import Students</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('bulkStudentImportModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:12px;">
            Upload a file with email addresses (comma-delimited or one per row).
          </div>
          <div class="form-group">
            <label class="form-label" for="bulkStudentFile">CSV File</label>
            <input type="file" class="form-input" id="bulkStudentFile" accept=".csv,text/csv">
          </div>
          <div class="form-group">
            <label class="form-label" for="bulkStudentRole">Role</label>
            <select class="form-select" id="bulkStudentRole">
              <option value="student" selected>Student</option>
              <option value="ta">Teaching Assistant</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('bulkStudentImportModal')">Cancel</button>
          <button class="btn btn-primary" onclick="processBulkStudentImport()">Import</button>
        </div>
      </div>
    </div>

    <!-- Bulk Grade Modal -->
    <div class="modal-overlay" id="bulkGradeModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="bulkGradeTitle">Bulk Grade Entry</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('bulkGradeModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:12px;">
            Paste data from spreadsheet. Format: Student Email, Score, Feedback (one per line)
          </div>
          <div class="form-group">
            <label class="form-label" for="bulkGradeData">Paste Grade Data</label>
            <textarea class="form-textarea" id="bulkGradeData" placeholder="student1@example.com, 95, Excellent work
student2@example.com, 87, Good job
student3@example.com, 92, Well done" rows="10"></textarea>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="bulkGradeRelease">
              <span>Release all grades to students</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('bulkGradeModal')">Cancel</button>
          <button class="btn btn-primary" onclick="processBulkGrades()">Import Grades</button>
        </div>
      </div>
    </div>

    <!-- Category Weights Modal -->
    <div class="modal-overlay" id="categoryWeightsModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Assignment Weights</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('categoryWeightsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px;">
            Set the weight for each assignment. Weights must add up to 100%.
          </div>
          <div id="categoryWeightsList"></div>
          <div style="margin-top:12px; padding:12px; background:var(--bg-color); border-radius:var(--radius);">
            <strong>Total: <span id="totalWeight">0</span>%</strong>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('categoryWeightsModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveCategoryWeights()">Save Weights</button>
        </div>
      </div>
    </div>

    <!-- Rubric Modal -->
    <div class="modal-overlay" id="rubricModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Create Rubric</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('rubricModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px;">
            Define grading criteria. Points for each criterion must add up to the assignment's total points.
          </div>
          <button class="btn btn-secondary btn-sm" onclick="openAiCreateModal('rubric', currentRubricAssignment)">AI Draft Rubric</button>
          <div id="rubricCriteriaList"></div>
          <button class="btn btn-secondary" style="margin-top:12px; width:100%;" onclick="addRubricCriterion()">+ Add Criterion</button>
          <div style="margin-top:12px; padding:12px; background:var(--bg-color); border-radius:var(--radius);">
            <strong>Total Points: <span id="rubricTotalPoints">0</span> / <span id="rubricMaxPoints">100</span></strong>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('rubricModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveRubric()">Save Rubric</button>
        </div>
      </div>
    </div>

    <!-- Module Modal -->
    <div class="modal-overlay" id="moduleModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="moduleModalTitle">New Module</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('moduleModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="moduleId">
          <div class="form-group">
            <label class="form-label" for="moduleName">Module Name</label>
            <input type="text" class="form-input" id="moduleName" placeholder="e.g., Week 1: Introduction">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('moduleModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveModule()">Save Module</button>
        </div>
      </div>
    </div>

    <!-- Add Module Item Modal -->
    <div class="modal-overlay" id="addModuleItemModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add Item to Module</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('addModuleItemModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="addItemModuleId">
          <div class="form-group">
            <label class="form-label" for="addItemType">Item Type</label>
            <select class="form-select" id="addItemType" onchange="updateAddItemOptions()">
              <option value="assignment">Assignment</option>
              <option value="file">File</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="addItemRef">Select Item</label>
            <select class="form-select" id="addItemRef"></select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('addModuleItemModal')">Cancel</button>
          <button class="btn btn-primary" onclick="addModuleItem()">Add Item</button>
        </div>
      </div>
    </div>

    <!-- Syllabus Parser Modal -->
    <div class="modal-overlay" id="syllabusParserModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title">Import from Syllabus</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('syllabusParserModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px;">
            Upload a syllabus file or paste syllabus text. AI will extract modules, assignments, and quizzes as drafts.
          </div>
          <div class="form-group">
            <label class="form-label" for="syllabusParserDropZone">Upload Syllabus</label>
            <div id="syllabusParserDropZone" class="drop-zone"
                 role="button" tabindex="0"
                 aria-label="Upload syllabus file — drag and drop or press Enter to browse"
                 ondragover="handleDragOver(event, 'syllabusParserDropZone')"
                 ondragleave="handleDragLeave(event, 'syllabusParserDropZone')"
                 ondrop="handleSyllabusParserDrop(event)"
                 onclick="document.getElementById('syllabusFile').click()"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('syllabusFile').click();}"
                 style="border:2px dashed var(--border-color); border-radius:var(--radius); padding:24px; text-align:center; cursor:pointer; transition:all 0.2s;">
              <div style="font-weight:500;">Drag & drop syllabus here</div>
              <div class="muted" style="font-size:0.85rem;">or press Enter to browse (PDF, DOC, TXT)</div>
              <input type="file" id="syllabusFile" accept=".pdf,.doc,.docx,.txt,.tex" style="display:none;" onchange="onSyllabusParserFileSelected()">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="syllabusText">Or Paste Syllabus Text</label>
            <textarea class="form-textarea" id="syllabusText" rows="6" placeholder="Paste syllabus content here..."></textarea>
          </div>
          <button class="btn btn-primary" onclick="parseSyllabus()" style="margin-bottom:16px;">Parse with AI</button>
          <div class="card" style="padding:16px; max-height:400px; overflow-y:auto;">
            <div class="card-title">Parsed Content</div>
            <div id="syllabusParsedPreview"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('syllabusParserModal')">Cancel</button>
        </div>
      </div>
    </div>

    <!-- SpeedGrader Modal -->
    <div class="modal-overlay" id="speedGraderModal">
      <div class="modal" style="max-width:1100px; height:90vh;">
        <div class="modal-header">
          <h2 class="modal-title" id="speedGraderTitle">Grade</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('speedGraderModal')">&times;</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; height:calc(100% - 120px); overflow:hidden;">
          <div id="speedGraderNav" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border-color);"></div>
          <div style="margin:12px 0;">
            <select class="form-select" id="speedGraderStudentSelect" onchange="speedGraderSelectStudent(this.value)" style="width:100%;"></select>
          </div>
          <div style="display:flex; gap:24px; flex:1; overflow:hidden;">
            <div style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
              <div id="speedGraderStudentInfo" style="display:flex; align-items:center; gap:12px; padding:12px 0;"></div>
              <div id="speedGraderSubmission" style="flex:1; overflow-y:auto; padding:16px; background:var(--bg-color); border-radius:var(--radius);"></div>
            </div>
            <div style="width:350px; display:flex; flex-direction:column; gap:16px; overflow-y:auto;">
              <div id="speedGraderRubric"></div>
              <div class="form-group">
                <label class="form-label" for="speedGraderScoreSection">Score</label>
                <div id="speedGraderScoreSection" style="display:flex; align-items:center; gap:8px;">
                  <input type="number" class="form-input" id="speedGraderScore" min="0" style="width:100px;">
                  <span id="speedGraderScoreMax">/ 100</span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="speedGraderFeedback">Feedback</label>
                <textarea class="form-textarea" id="speedGraderFeedback" rows="5" placeholder="Provide feedback..."></textarea>
              </div>
              <div class="form-group">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" id="speedGraderRelease">
                  <span>Release grade to student</span>
                </label>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-primary" id="speedGraderSaveBtn" onclick="saveSpeedGraderGrade()">Save & Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Question Bank Modal -->
    <div class="modal-overlay" id="questionBankModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title" id="questionBankModalTitle">Question Banks</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('questionBankModal')">&times;</button>
        </div>
        <div class="modal-body" id="questionBankModalBody">
          <!-- Content rendered dynamically -->
        </div>
        <div class="modal-footer" id="questionBankModalFooter">
          <button class="btn btn-secondary" onclick="closeModal('questionBankModal')">Close</button>
          <button class="btn btn-primary" onclick="openCreateQuestionBankForm()">New Question Bank</button>
        </div>
      </div>
    </div>

    <!-- Question Bank Edit Modal (QTI 3.0 aligned) -->
    <div class="modal-overlay" id="questionBankEditModal">
      <div class="modal" style="max-width:960px;">
        <div class="modal-header">
          <h2 class="modal-title" id="questionBankEditTitle">New Question Bank</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('questionBankEditModal')">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Bank-level settings -->
          <div style="background:var(--surface); border-radius:var(--radius); padding:16px; margin-bottom:20px;">
            <h4 style="margin-bottom:14px; font-size:0.95rem;">Bank Settings</h4>
            <div class="form-group">
              <label class="form-label" for="questionBankName">Bank Title *</label>
              <input type="text" class="form-input" id="questionBankName" placeholder="e.g., Chapter 1 Questions">
            </div>
            <div class="form-group">
              <label class="form-label" for="questionBankDescription">Description (optional)</label>
              <textarea class="form-textarea" id="questionBankDescription" rows="2" placeholder="Brief description of this question bank..."></textarea>
            </div>
            <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" for="questionBankDefaultPoints">Default Points Per Question</label>
                <input type="number" class="form-input" id="questionBankDefaultPoints" value="1" min="0.5" step="0.5" placeholder="1">
                <div class="hint">Auto-fills new questions to save time</div>
              </div>
              <div class="form-group" style="margin-bottom:0; padding-top:28px;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" id="questionBankRandomize">
                  <span>Randomize question order per student</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Questions list -->
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <label class="form-label" for="questionBankPointsTotal" style="margin:0;">Questions <span id="questionBankPointsTotal" class="muted" style="font-size:0.85rem; font-weight:400;"></span></label>
              <button class="btn btn-secondary btn-sm" onclick="addQuestionToBankForm()">+ Add Question</button>
            </div>
            <div id="questionBankQuestionsContainer">
              <!-- Questions rendered here dynamically -->
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('questionBankEditModal'); openQuestionBankModal();">Cancel</button>
          <button class="btn btn-primary" id="questionBankSaveBtn" onclick="saveQuestionBank()">Save Bank</button>
        </div>
      </div>
    </div>

    <!-- New Assignment Modal (CC 1.4 aligned — 3 type model) -->
    <div class="modal-overlay" id="newAssignmentModal">
      <div class="modal" style="max-width:720px;">
        <div class="modal-header">
          <h2 class="modal-title" id="newAssignmentModalTitle">New Assignment</h2>
          <button class="modal-close" aria-label="Close dialog" onclick="closeModal('newAssignmentModal'); resetNewAssignmentModal();">&times;</button>
        </div>
        <div class="modal-body">

          <!-- ── Universal Fields ─────────────────────────────── -->
          <div class="form-group">
            <label class="form-label" for="atype-essay-label">Assignment Type *</label>
            <div style="display:flex; gap:0; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden;">
              <label id="atype-essay-label" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px 8px; cursor:pointer; border-right:1px solid var(--border); background:var(--primary); color:#fff; font-size:0.85rem;" onclick="setAssignmentType('essay')">
                <input type="radio" name="newAssignmentType" id="newAssignmentTypeEssay" value="essay" style="display:none;" checked>
                Essay / Free Text
              </label>
              <label id="atype-quiz-label" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px 8px; cursor:pointer; border-right:1px solid var(--border); background:var(--bg-card); font-size:0.85rem;" onclick="setAssignmentType('quiz')">
                <input type="radio" name="newAssignmentType" id="newAssignmentTypeQuiz" value="quiz" style="display:none;">
                Quiz / Exam
              </label>
              <label id="atype-no-submission-label" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px 8px; cursor:pointer; background:var(--bg-card); font-size:0.85rem;" onclick="setAssignmentType('no_submission')">
                <input type="radio" name="newAssignmentType" id="newAssignmentTypeNoSub" value="no_submission" style="display:none;">
                No Submission
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="newAssignmentTitle">Title *</label>
            <input type="text" class="form-input" id="newAssignmentTitle" placeholder="Enter assignment title">
          </div>

          <div class="form-group">
            <label class="form-label" for="newAssignmentDescription">Description / Prompt *</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;" role="toolbar" aria-label="Text formatting">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('newAssignmentDescription')" title="Insert Link">Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('newAssignmentDescription')" title="Insert File">File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('newAssignmentDescription')" title="Insert Video">📹 Video</button>
            </div>
            <textarea class="form-textarea" id="newAssignmentDescription" placeholder="Describe the assignment prompt... (supports Markdown)" rows="4"></textarea>
          </div>

          <!-- ── Conditional: Essay / Free Text ──────────────── -->
          <div id="essaySection">
            <div style="background:var(--surface); border-radius:var(--radius); padding:16px; margin-bottom:16px;">
              <h4 style="margin-bottom:12px; font-size:0.9rem;">Submission Settings</h4>
              <fieldset class="form-group" style="border:none; padding:0; margin-bottom:10px;">
                <legend class="form-label" style="margin-bottom:6px;">Submission Modality (at least one) *</legend>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:6px;">
                  <input type="checkbox" id="newAssignmentModalityText" checked onchange="handleModalityChange()">
                  <span>Online Text Entry</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" id="newAssignmentModalityFile" onchange="handleModalityChange()">
                  <span>File Upload</span>
                </label>
              </fieldset>
              <div id="fileUploadSettings" style="display:none; padding-left:24px;">
                <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label" for="newAssignmentFileTypes" style="font-size:0.85rem;">Allowed File Types</label>
                    <input type="text" class="form-input" id="newAssignmentFileTypes" placeholder=".pdf, .docx, .png">
                    <div class="hint">Comma-separated extensions, or leave blank for any type</div>
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label" for="newAssignmentMaxFileSize" style="font-size:0.85rem;">Max File Size (MB)</label>
                    <input type="number" class="form-input" id="newAssignmentMaxFileSize" value="50" min="1" max="500">
                  </div>
                </div>
              </div>
            </div>

            <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label" for="essayGradingType">Grading Type</label>
                <select class="form-select" id="essayGradingType" onchange="handleGradingTypeChange('essay')">
                  <option value="points">Points</option>
                  <option value="complete_incomplete">Complete / Incomplete</option>
                  <option value="letter_grade">Letter Grade</option>
                </select>
              </div>
              <div class="form-group" id="essayPointsGroup">
                <label class="form-label" for="newAssignmentPoints">Total Points Possible</label>
                <input type="number" class="form-input" id="newAssignmentPoints" value="100" min="0" step="0.5">
              </div>
            </div>

            <div class="form-group">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex-wrap:wrap;">
                <input type="checkbox" id="newAssignmentAllowResubmit" checked onchange="toggleResubmitOptions(this)">
                <span style="font-size:0.85rem;">Allow resubmissions</span>
                <span id="resubmitLimitGroup" style="display:flex; align-items:center; gap:6px;">
                  <input type="number" class="form-input" id="newAssignmentAttempts" value="" min="1" placeholder="∞" style="width:60px; padding:3px 6px; font-size:0.85rem;" title="Leave blank for unlimited">
                  <span style="font-size:0.8rem; color:var(--text-muted);">attempts (blank = unlimited)</span>
                </span>
              </label>
            </div>
          </div>

          <!-- ── Conditional: Quiz / Exam ─────────────────────── -->
          <div id="quizSection" style="display:none;">
            <div style="background:var(--surface); border-radius:var(--radius); padding:16px; margin-bottom:16px;">
              <h4 style="margin-bottom:12px; font-size:0.9rem;">Quiz Settings</h4>
              <div class="form-group">
                <label class="form-label" for="newAssignmentQuestionBank">Question Bank *</label>
                <select class="form-select" id="newAssignmentQuestionBank" onchange="updateQuizPointsFromBank()">
                  <option value="">-- Select a question bank --</option>
                </select>
                <div class="hint">Points are auto-calculated from the bank's question totals</div>
              </div>
              <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" for="newAssignmentQuizPoints">Total Points Possible</label>
                  <input type="number" class="form-input" id="newAssignmentQuizPoints" value="" readonly
                    style="background:var(--bg-color); color:var(--text-secondary);" placeholder="Auto-calculated">
                  <div class="hint">Read-only — sum of question points</div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" for="newAssignmentTimeLimit">Time Limit (minutes)</label>
                  <div style="display:flex; gap:8px; align-items:center;">
                    <input type="number" class="form-input" id="newAssignmentTimeLimit" value="" min="1" placeholder="e.g. 60" style="flex:1;">
                    <label style="display:flex; align-items:center; gap:4px; white-space:nowrap; font-size:0.85rem; cursor:pointer;">
                      <input type="checkbox" id="newAssignmentUnlimitedTime" onchange="toggleUnlimitedTime(this)"> Unlimited
                    </label>
                  </div>
                </div>
              </div>
              <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" for="newAssignmentQuizAttempts">Submission Attempts</label>
                  <div style="display:flex; gap:8px; align-items:center;">
                    <input type="number" class="form-input" id="newAssignmentQuizAttempts" value="1" min="1" style="flex:1;">
                    <label style="display:flex; align-items:center; gap:4px; white-space:nowrap; font-size:0.85rem; cursor:pointer;">
                      <input type="checkbox" id="newAssignmentUnlimitedQuizAttempts" onchange="toggleUnlimitedAttempts('newAssignmentQuizAttempts', this)"> Unlimited
                    </label>
                  </div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" for="newAssignmentNumQuestions">Questions per Student</label>
                  <div style="display:flex; gap:8px; align-items:center;">
                    <input type="number" class="form-input" id="newAssignmentNumQuestions" min="1" placeholder="All (default)"
                      oninput="updateQuizPointsFromBank()" style="flex:1;">
                    <label style="display:flex; align-items:center; gap:4px; white-space:nowrap; font-size:0.85rem; cursor:pointer;">
                      <input type="checkbox" id="newAssignmentRandomizeQuestions"> Randomize
                    </label>
                  </div>
                  <div class="hint">Blank = all questions; number = random subset</div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Conditional: No Submission ───────────────────── -->
          <div id="noSubSection" style="display:none;">
            <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label" for="noSubGradingType">Gradebook Category</label>
                <select class="form-select" id="noSubGradingType" onchange="handleGradingTypeChange('nosub')">
                  <option value="points">Points</option>
                  <option value="complete_incomplete">Complete / Incomplete</option>
                  <option value="letter_grade">Letter Grade</option>
                </select>
              </div>
              <div class="form-group" id="noSubPointsGroup">
                <label class="form-label" for="newAssignmentNoSubPoints">Points Possible</label>
                <input type="number" class="form-input" id="newAssignmentNoSubPoints" value="100" min="0" step="0.5">
              </div>
            </div>
          </div>

          <!-- ── Universal: Dates (hidden for no_submission) ────── -->
          <div id="assignmentDatesSection">
            <div class="form-group">
              <label class="form-label" for="newAssignmentDueDate">Due Date &amp; Time <span class="muted" style="font-size:0.8rem;">(Eastern Time)</span></label>
              <div style="display:flex; gap:8px;">
                <input type="date" class="form-input" id="newAssignmentDueDate" style="flex:1;"
                  onchange="syncAvailableUntilToDueDate(); updateAvailabilityConstraints();">
                <select class="form-select" id="newAssignmentDueTime" style="width:160px;"
                  onchange="syncAvailableUntilToDueDate(); updateAvailabilityConstraints();">
                  ${generateTimeSelectOptions('23:59')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="newAssignmentAvailableFromDate" style="margin-bottom:4px;">Availability Window <span class="muted" style="font-size:0.8rem;">(Eastern Time)</span></label>
              <div class="hint" style="margin-bottom:8px;">Available From = when submit button unlocks. Available To = when it hard-locks.</div>
              <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
                <div>
                  <label class="form-label" for="newAssignmentAvailableFromDate">Available From</label>
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    <input type="date" class="form-input" id="newAssignmentAvailableFromDate"
                      onchange="updateAvailabilityConstraints();">
                    <select class="form-select" id="newAssignmentAvailableFromTime"
                      onchange="updateAvailabilityConstraints();">
                      ${generateTimeSelectOptions('08:00')}
                    </select>
                  </div>
                </div>
                <div>
                  <label class="form-label" for="newAssignmentAvailableUntilDate">Available To</label>
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    <input type="date" class="form-input" id="newAssignmentAvailableUntilDate"
                      onchange="updateAvailabilityConstraints();">
                    <select class="form-select" id="newAssignmentAvailableUntilTime">
                      ${generateTimeSelectOptions('23:59')}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Universal: Status + Late ─────────────────────── -->
          <div class="form-group" id="assignmentStatusSection">
            <label class="form-label" for="newAssignmentStatus">Status</label>
            <select class="form-select" id="newAssignmentStatus">
              <option value="draft">Draft (not visible to students)</option>
              <option value="published">Published</option>
            </select>
          </div>
          <!-- No Submission: always-draft notice (replaces status selector) -->
          <div id="noSubStatusNotice" style="display:none;" class="form-group">
            <div class="hint" style="padding:10px 12px; background:var(--surface); border-radius:var(--radius); border-left:3px solid var(--primary);">
              Always saved as <strong>Draft — not visible to students</strong>. Use the gradebook to record participation scores.
            </div>
          </div>

          <div class="form-group" id="lateSubmissionToggleGroup">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="newAssignmentAllowLate" checked onchange="syncAvailableUntilToDueDate()">
              <span>Allow late submissions <span class="muted" style="font-size:0.85rem;">(if off, availability closes at due date)</span></span>
            </label>
          </div>

          <div id="latePenaltySection">
            <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label" for="newAssignmentLatePenaltyType">Late Penalty Type</label>
                <select class="form-select" id="newAssignmentLatePenaltyType">
                  <option value="per_day">Percentage per day late</option>
                  <option value="flat">Flat percentage overall</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="newAssignmentLatePenalty">Penalty Amount (%)</label>
                <input type="number" class="form-input" id="newAssignmentLatePenalty" value="10" min="0" max="100">
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="newAssignmentGradingNotes">Grading Notes (private — instructors only)</label>
            <textarea class="form-textarea" id="newAssignmentGradingNotes" rows="2" placeholder="Notes for graders (rubric guidance, key points to check, etc.)"></textarea>
          </div>

          <div style="border-top:1px solid var(--border-color); margin-top:8px; padding-top:12px;">
            <div style="font-weight:600; margin-bottom:8px; font-size:0.875rem;">Student Gradebook Options</div>
            <div class="form-group" style="margin-bottom:8px;">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="newAssignmentVisibleToStudents" checked>
                Show this column to students in their gradebook
              </label>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="newAssignmentShowStats">
                Show class aggregate stats to students (avg, min, max)
              </label>
            </div>
          </div>

        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('newAssignmentModal'); resetNewAssignmentModal();">Cancel</button>
          <button class="btn btn-secondary" id="newAssignmentOverridesBtn" style="display:none;" onclick="openDeadlineOverridesFromModal()">Deadline Overrides</button>
          <button class="btn btn-primary" id="newAssignmentSubmitBtn" onclick="saveNewAssignment()">Create Assignment</button>
        </div>
      </div>
    </div>

    <!-- Clone Course Modal -->
  `);
}

// Helper functions for generating select options
function generateHourOptions(selected = 12) {
  return [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    .map(h => `<option value="${h}" ${h === selected ? 'selected' : ''}>${h}</option>`)
    .join('');
}

function generateMinuteOptions(selected = 0) {
  return [0, 15, 30, 45, 59]
    .map(m => {
      const val = m === 59 ? '59' : String(m).padStart(2, '0');
      return `<option value="${val}" ${m === selected ? 'selected' : ''}>${val}</option>`;
    })
    .join('');
}

// Generate time select options in 30-min increments + special "end of day"
function generateTimeSelectOptions(defaultVal = '23:59') {
  let html = '';
  const pad = n => String(n).padStart(2, '0');
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const val = `${pad(h)}:${pad(m)}`;
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? 'AM' : 'PM';
      const label = `${h12}:${pad(m)} ${ampm}`;
      html += `<option value="${val}"${val === defaultVal ? ' selected' : ''}>${label}</option>`;
    }
  }
  html += `<option value="23:59"${defaultVal === '23:59' ? ' selected' : ''}>11:59 PM (end of day)</option>`;
  return html;
}

// Export functions
export { generateHourOptions, generateMinuteOptions, generateTimeSelectOptions };
