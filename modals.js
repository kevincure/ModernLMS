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
    <!-- Unified Content Creation Modal -->
    <div class="modal-overlay" id="unifiedContentModal">
      <div class="modal" style="max-width:600px;">
        <div class="modal-header">
          <h2 class="modal-title">Create New Content</h2>
          <button class="modal-close" onclick="closeModal('unifiedContentModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px;">
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('assignment')">
              <div style="font-size:1.5rem; margin-bottom:8px;">📝</div>
              <div class="demo-title">Assignment</div>
              <div class="demo-sub">Homework, essays, projects</div>
            </button>
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('quiz')">
              <div style="font-size:1.5rem; margin-bottom:8px;">❓</div>
              <div class="demo-title">Quiz</div>
              <div class="demo-sub">Multiple choice, true/false</div>
            </button>
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('announcement')">
              <div style="font-size:1.5rem; margin-bottom:8px;">📢</div>
              <div class="demo-title">Announcement</div>
              <div class="demo-sub">Announcements for students</div>
            </button>
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('file')">
              <div style="font-size:1.5rem; margin-bottom:8px;">📄</div>
              <div class="demo-title">File</div>
              <div class="demo-sub">Upload documents</div>
            </button>
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('external-link')">
              <div style="font-size:1.5rem; margin-bottom:8px;">🔗</div>
              <div class="demo-title">External Link</div>
              <div class="demo-sub">YouTube, websites</div>
            </button>
            <button class="demo-btn" style="padding:20px; text-align:left;" onclick="createFromUnified('ai-assist')">
              <div style="font-size:1.5rem; margin-bottom:8px;">✨</div>
              <div class="demo-title">AI Generate</div>
              <div class="demo-sub">Draft with AI assistance</div>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('unifiedContentModal')">Cancel</button>
        </div>
      </div>
    </div>

    <!-- External Link Modal -->
    <div class="modal-overlay" id="externalLinkModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add External Link</h2>
          <button class="modal-close" onclick="closeModal('externalLinkModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px; padding:12px; background:var(--primary-light); border-radius:var(--radius);">
            💡 YouTube links are automatically converted to embeds for inline viewing.
          </div>
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="externalLinkTitle" placeholder="e.g., Lecture Video #1">
          </div>
          <div class="form-group">
            <label class="form-label">URL</label>
            <input type="url" class="form-input" id="externalLinkUrl" placeholder="https://...">
          </div>
          <div class="form-group">
            <label class="form-label">Add to</label>
            <select class="form-select" id="externalLinkType" onchange="document.getElementById('externalLinkModuleGroup').style.display = this.value === 'module' ? 'block' : 'none';">
              <option value="file">Files (as external link)</option>
              <option value="module">Module item</option>
            </select>
          </div>
          <div class="form-group" id="externalLinkModuleGroup" style="display:none;">
            <label class="form-label">Select Module</label>
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
          <button class="modal-close" onclick="closeModal('announcementModal'); resetAnnouncementModal();">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="announcementTitle" placeholder="Enter title">
          </div>
          <div class="form-group">
            <label class="form-label">Content</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('announcementContent')" title="Insert Link">🔗 Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('announcementContent')" title="Insert File">📄 File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('announcementContent')" title="Insert Video">📹 Video</button>
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
          <button class="modal-close" onclick="closeModal('createCourseModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="padding:12px; background:var(--primary-light); border-radius:var(--radius); margin-bottom:16px;">
            <label class="form-label" style="margin-bottom:8px;">Quick Start: Upload Syllabus (optional)</label>
            <div id="syllabusDropZone" class="drop-zone"
                 ondragover="handleDragOver(event, 'syllabusDropZone')"
                 ondragleave="handleDragLeave(event, 'syllabusDropZone')"
                 ondrop="handleSyllabusDrop(event)"
                 onclick="document.getElementById('courseCreationSyllabus').click()"
                 style="border:2px dashed var(--border-color); border-radius:var(--radius); padding:24px; text-align:center; cursor:pointer; transition:all 0.2s;">
              <div style="margin-bottom:8px;">📄</div>
              <div style="font-weight:500;">Drag & drop syllabus here</div>
              <div class="muted" style="font-size:0.85rem;">or click to browse (PDF, DOC, TXT)</div>
              <input type="file" id="courseCreationSyllabus" accept=".pdf,.doc,.docx,.txt,.tex" style="display:none;" onchange="onSyllabusFileSelected()">
            </div>
            <div id="courseCreationSyllabusStatus" style="margin-top:8px;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Course Name</label>
            <input type="text" class="form-input" id="courseName" placeholder="e.g., ECON 101 - Introduction to Economics">
          </div>
          <div class="form-group">
            <label class="form-label">Course Code</label>
            <input type="text" class="form-input" id="courseCode" placeholder="e.g., ECON101">
          </div>
          <div class="form-group">
            <label class="form-label">Description (optional)</label>
            <textarea class="form-textarea" id="courseDescription" placeholder="Course description..." rows="2"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Student Emails (optional)</label>
            <textarea class="form-textarea" id="courseEmails" placeholder="Enter emails separated by commas, semicolons, or newlines:
student1@university.edu, student2@university.edu" rows="3"></textarea>
            <div class="hint">Students will be invited to join the course</div>
          </div>
          <div id="courseCreationModulesPreview" style="display:none;">
            <label class="form-label">Modules to Create from Syllabus</label>
            <div id="courseCreationModulesList" style="max-height:200px; overflow-y:auto; border:1px solid var(--border-light); border-radius:var(--radius); padding:8px;"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('createCourseModal')">Cancel</button>
          <button class="btn btn-primary" onclick="createCourse()">Create Course</button>
        </div>
      </div>
    </div>

    <!-- Join Course Modal -->
    <div class="modal-overlay" id="joinCourseModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Join Course</h2>
          <button class="modal-close" onclick="closeModal('joinCourseModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Invite Code</label>
            <input type="text" class="form-input" id="joinCode" placeholder="Enter 6-character code" style="text-transform:uppercase;">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('joinCourseModal')">Cancel</button>
          <button class="btn btn-primary" onclick="joinCourse()">Join</button>
        </div>
      </div>
    </div>

    <!-- Assignment Modal -->
    <div class="modal-overlay" id="assignmentModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="assignmentModalTitle">New Assignment</h2>
          <button class="modal-close" onclick="closeModal('assignmentModal'); resetAssignmentModal();">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="assignmentTitle" placeholder="Enter title">
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('assignmentDescription')" title="Insert Link">🔗 Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('assignmentDescription')" title="Insert File">📄 File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('assignmentDescription')" title="Insert Video">📹 Video</button>
            </div>
            <textarea class="form-textarea" id="assignmentDescription" placeholder="Describe the assignment... (supports Markdown)"></textarea>
            <div class="hint" style="margin-top:4px;">Supports Markdown: **bold**, *italic*, [link](url)</div>
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" id="assignmentCategory">
              <option value="homework">Homework</option>
              <option value="quiz">Quiz</option>
              <option value="exam">Exam</option>
              <option value="essay">Essay</option>
              <option value="project">Project</option>
              <option value="participation">Participation</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Points</label>
            <input type="number" class="form-input" id="assignmentPoints" value="100" min="1">
          </div>
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" class="form-input" id="assignmentDueDate" style="margin-bottom:8px;">
            <div style="display:flex; gap:8px; align-items:center;">
              <select class="form-select" id="assignmentDueHour" style="width:auto;">
                ${generateHourOptions()}
              </select>
              <span>:</span>
              <select class="form-select" id="assignmentDueMinute" style="width:auto;">
                ${generateMinuteOptions()}
              </select>
              <select class="form-select" id="assignmentDueAmPm" style="width:auto;">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="assignmentStatus">
              <option value="draft">Draft (not visible to students)</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="assignmentAllowLate" checked>
              <span>Allow late submissions</span>
            </label>
          </div>
          <div class="form-group" id="lateDeductionGroup">
            <label class="form-label">Late Deduction (% per day)</label>
            <input type="number" class="form-input" id="assignmentLateDeduction" value="10" min="0" max="100">
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="assignmentAllowResubmit" checked>
              <span>Allow resubmission</span>
            </label>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="assignmentBlindGrading">
              <span>Blind grading <span class="muted" style="font-size:0.85rem;">(hide student names while grading)</span></span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('assignmentModal'); resetAssignmentModal();">Cancel</button>
          <button class="btn btn-primary" id="assignmentSubmitBtn" onclick="saveAssignmentChanges()">Create</button>
        </div>
      </div>
    </div>

    <!-- Quiz Modal -->
    <div class="modal-overlay" id="quizModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title" id="quizModalTitle">New Quiz</h2>
          <button class="modal-close" onclick="closeModal('quizModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Quiz Title</label>
            <input type="text" class="form-input" id="quizTitle" placeholder="e.g., Week 2 Quiz">
          </div>
          <div class="form-group">
            <label class="form-label">Description (optional)</label>
            <textarea class="form-textarea" id="quizDescription" placeholder="Add instructions..." rows="3"></textarea>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Due Date</label>
              <input type="date" class="form-input" id="quizDueDate" style="margin-bottom:8px;">
              <div style="display:flex; gap:8px; align-items:center;">
                <select class="form-select" id="quizDueHour" style="width:auto;">
                  ${generateHourOptions()}
                </select>
                <span>:</span>
                <select class="form-select" id="quizDueMinute" style="width:auto;">
                  ${generateMinuteOptions()}
                </select>
                <select class="form-select" id="quizDueAmPm" style="width:auto;">
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" id="quizStatus">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Time Limit (minutes)</label>
              <input type="number" class="form-input" id="quizTimeLimit" min="0" placeholder="e.g., 30">
            </div>
            <div class="form-group">
              <label class="form-label">Attempts Allowed</label>
              <input type="number" class="form-input" id="quizAttempts" min="0" placeholder="Leave blank for unlimited">
            </div>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="quizRandomize" checked>
              <span>Randomize question order</span>
            </label>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="quizPoolEnabled" onchange="toggleQuizPoolFields()">
              <span>Use question pool (random subset)</span>
            </label>
          </div>
          <div class="form-group" id="quizPoolCountGroup" style="display:none;">
            <label class="form-label">Questions to show</label>
            <input type="number" class="form-input" id="quizPoolCount" min="1" placeholder="e.g., 5">
          </div>
          <div class="card" style="padding:16px; margin-top:16px;">
            <div class="card-title">Questions</div>
            <div id="quizQuestionsList" class="quiz-questions-list"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
              <button class="btn btn-secondary btn-sm" onclick="addQuizQuestion()">Add Question</button>
              <div class="muted">Total Points: <span id="quizPointsTotal">0</span></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('quizModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveQuiz()">Save Quiz</button>
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
          <button class="modal-close" onclick="closeModal('quizTakeModal')">&times;</button>
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
          <button class="modal-close" onclick="closeModal('quizSubmissionsModal')">&times;</button>
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
          <button class="modal-close" onclick="closeModal('quizGradeModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="quizGradeSubmissionId">
          <input type="hidden" id="quizGradeQuizId">
          <div id="quizGradeAnswers" class="quiz-grade-list"></div>
          <div class="form-group">
            <label class="form-label">Score</label>
            <input type="number" class="form-input" id="quizGradeScore" min="0" placeholder="Enter score">
          </div>
          <div class="form-group">
            <label class="form-label">Feedback (optional)</label>
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
          <button class="modal-close" onclick="closeModal('quizReviewModal')">&times;</button>
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
          <button class="modal-close" onclick="closeModal('submitModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="submitModalAssignmentId">
          <div class="form-group">
            <label class="form-label">Submission Text</label>
            <textarea class="form-textarea" id="submissionText" placeholder="Enter your submission..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Upload File (optional)</label>
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
          <button class="modal-close" onclick="closeModal('fileUploadModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Select Files (up to 50)</label>
            <div id="fileDropZone"
                 style="border:2px dashed var(--border-color); border-radius:var(--radius); padding:32px; text-align:center; cursor:pointer; transition: all 0.2s;"
                 ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'; this.style.background='var(--primary-light)';"
                 ondragleave="this.style.borderColor='var(--border-color)'; this.style.background='';"
                 ondrop="handleFilesDrop(event)"
                 onclick="document.getElementById('fileUpload').click()">
              <div style="font-size:2rem; margin-bottom:8px; opacity:0.5;">📁</div>
              <div style="font-weight:500; margin-bottom:4px;">Drag and drop files here</div>
              <div class="muted">or click to browse</div>
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
          <button class="modal-close" onclick="closeModal('settingsModal')">&times;</button>
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

          <div class="form-group">
            <label class="form-label">Caliper Analytics Endpoint <span style="color:var(--text-muted); font-weight:400;">(optional)</span></label>
            <input type="url" class="form-input" id="settingsCaliperEndpoint"
              placeholder="https://your-lrs.example.com/caliper/v1p1"
              value="${localStorage.getItem('caliperEndpoint') || ''}">
            <div class="hint">IMS Caliper 1.1 LRS endpoint. Leave blank to disable event sending.</div>
          </div>
          <div class="form-group">
            <label class="form-label">Caliper Sensor ID <span style="color:var(--text-muted); font-weight:400;">(optional)</span></label>
            <input type="text" class="form-input" id="settingsCaliperSensorId"
              placeholder="campus-lms"
              value="${localStorage.getItem('caliperSensorId') || 'campus-lms'}">
          </div>

          <div class="form-group" style="border-top:1px solid var(--border-color); padding-top:16px; margin-top:4px;">
            <label class="form-label">OneRoster Export</label>
            <div class="hint" style="margin-bottom:8px;">Download a OneRoster 1.2 compliant ZIP of orgs, users, courses, classes, and enrollments CSVs for your institution.</div>
            <button class="btn btn-secondary" onclick="downloadOneRosterExport(window._appData)">Export OneRoster CSVs</button>
          </div>

        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('settingsModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveSettings()">Save</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="startHereModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title">Edit Start Here</h2>
          <button class="modal-close" onclick="closeModal('startHereModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="startHereCourseId">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="startHereTitle" placeholder="Start Here">
          </div>
          <div class="form-group">
            <label class="form-label">Intro content (supports Markdown)</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('startHereContent')" title="Insert Link">🔗 Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('startHereContent')" title="Insert File">📄 File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('startHereContent')" title="Insert Video">📹 Video</button>
            </div>
            <textarea class="form-textarea" id="startHereContent" rows="4" placeholder="Welcome message..."></textarea>
            <div class="hint" style="margin-top:4px;">Supports Markdown: **bold**, *italic*, [link](url)</div>
          </div>
          <div class="form-group">
            <label class="form-label">Pinned essentials</label>
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
          <button class="modal-close" onclick="closeModal('aiCreateModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Create</label>
              <select class="form-select" id="aiCreateType" onchange="updateAiCreateType()">
                <option value="announcement">Announcement</option>
                <option value="quiz">Quiz</option>
                <option value="rubric">Rubric</option>
              </select>
            </div>
            <div class="form-group" id="aiQuizGroup">
              <label class="form-label">Question count</label>
              <input type="number" class="form-input" id="aiQuestionCount" min="1" value="5">
            </div>
          </div>
          <div class="form-group" id="aiRubricGroup" style="display:none;">
            <label class="form-label">Assignment</label>
            <select class="form-select" id="aiRubricAssignment"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Prompt</label>
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
          <button class="modal-close" onclick="closeModal('confirmModal')">&times;</button>
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
          <button class="modal-close" onclick="closeModal('editCourseModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Course Name</label>
            <input type="text" class="form-input" id="editCourseName" placeholder="e.g., ECON 101 - Introduction to Economics">
          </div>
          <div class="form-group">
            <label class="form-label">Course Code</label>
            <input type="text" class="form-input" id="editCourseCode" placeholder="e.g., ECON101">
          </div>
          <div class="form-group">
            <label class="form-label">Description (optional)</label>
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
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Import Content</h2>
          <button class="modal-close" onclick="closeModal('importContentModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Select Source Course</label>
            <select class="form-select" id="importSourceCourse">
              <option value="">-- Select a course --</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Content to import</label>
            <select class="form-select" id="importContentTypes" multiple size="6">
              <option value="assignments" selected>Assignments</option>
              <option value="quizzes" selected>Quizzes</option>
              <option value="announcements">Announcements</option>
              <option value="files">Files</option>
              <option value="categoryWeights">Grade Category Weights</option>
            </select>
            <div class="hint">Hold Ctrl (Windows) or Command (Mac) to select multiple items.</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('importContentModal')">Cancel</button>
          <button class="btn btn-primary" onclick="executeImportContent()">Import Selected Content</button>
        </div>
      </div>
    </div>

    <!-- Add Person Modal -->
    <div class="modal-overlay" id="addPersonModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add Person to Course</h2>
          <button class="modal-close" onclick="closeModal('addPersonModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="addPersonEmail">Email Address</label>
            <input type="email" class="form-input" id="addPersonEmail" placeholder="student@university.edu" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
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
          <button class="modal-close" onclick="closeModal('bulkStudentImportModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:12px;">
            Upload a file with email addresses (comma-delimited or one per row).
          </div>
          <div class="form-group">
            <label class="form-label">CSV File</label>
            <input type="file" class="form-input" id="bulkStudentFile" accept=".csv,text/csv">
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
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
          <button class="modal-close" onclick="closeModal('bulkGradeModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:12px;">
            Paste data from spreadsheet. Format: Student Email, Score, Feedback (one per line)
          </div>
          <div class="form-group">
            <label class="form-label">Paste Grade Data</label>
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
          <h2 class="modal-title">Grade Category Weights</h2>
          <button class="modal-close" onclick="closeModal('categoryWeightsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px;">
            Set the weight for each category. Weights must add up to 100%.
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
          <button class="modal-close" onclick="closeModal('rubricModal')">&times;</button>
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
          <button class="modal-close" onclick="closeModal('moduleModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="moduleId">
          <div class="form-group">
            <label class="form-label">Module Name</label>
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
          <button class="modal-close" onclick="closeModal('addModuleItemModal')">&times;</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="addItemModuleId">
          <div class="form-group">
            <label class="form-label">Item Type</label>
            <select class="form-select" id="addItemType" onchange="updateAddItemOptions()">
              <option value="assignment">Assignment</option>
              <option value="quiz">Quiz</option>
              <option value="file">File</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Select Item</label>
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
          <button class="modal-close" onclick="closeModal('syllabusParserModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px;">
            Upload a syllabus file or paste syllabus text. AI will extract modules, assignments, and quizzes as drafts.
          </div>
          <div class="form-group">
            <label class="form-label">Upload Syllabus</label>
            <div id="syllabusParserDropZone" class="drop-zone"
                 ondragover="handleDragOver(event, 'syllabusParserDropZone')"
                 ondragleave="handleDragLeave(event, 'syllabusParserDropZone')"
                 ondrop="handleSyllabusParserDrop(event)"
                 onclick="document.getElementById('syllabusFile').click()"
                 style="border:2px dashed var(--border-color); border-radius:var(--radius); padding:24px; text-align:center; cursor:pointer; transition:all 0.2s;">
              <div style="margin-bottom:8px;">📄</div>
              <div style="font-weight:500;">Drag & drop syllabus here</div>
              <div class="muted" style="font-size:0.85rem;">or click to browse (PDF, DOC, TXT)</div>
              <input type="file" id="syllabusFile" accept=".pdf,.doc,.docx,.txt,.tex" style="display:none;" onchange="onSyllabusParserFileSelected()">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Or Paste Syllabus Text</label>
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

    <!-- Audio Input Modal -->
    <div class="modal-overlay" id="audioInputModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title">Voice Command</h2>
          <button class="modal-close" onclick="closeModal('audioInputModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:16px;">
            Record or upload audio to create announcements or quizzes. Say things like "send an announcement at midnight tomorrow about the exam" or "create a quiz with five questions, due at 2pm on Dec 18".
          </div>
          <div class="form-group">
            <label class="form-label">Output Type</label>
            <select class="form-select" id="audioOutputType">
              <option value="announcement">Announcement</option>
              <option value="quiz">Quiz</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Record Audio</label>
            <div style="display:flex; gap:8px; margin-bottom:12px;">
              <button class="btn btn-primary" id="audioStartRecording" onclick="startAudioRecording()">🎤 Start Recording</button>
              <button class="btn btn-secondary" id="audioStopRecording" onclick="stopAudioRecording()" style="display:none;">⏹️ Stop Recording</button>
            </div>
            <div id="audioPreview"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Or Upload Audio File</label>
            <input type="file" class="form-input" id="audioFile" accept="audio/*">
          </div>
          <button class="btn btn-primary" onclick="transcribeAudio()" style="margin-bottom:16px;">Transcribe with AI</button>
          <div class="form-group">
            <label class="form-label">Transcription</label>
            <textarea class="form-textarea" id="audioTranscription" rows="3" readonly placeholder="Transcription will appear here..."></textarea>
          </div>
          <div class="card" style="padding:16px;">
            <div class="card-title">Preview</div>
            <div id="audioParsedPreview"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('audioInputModal')">Cancel</button>
        </div>
      </div>
    </div>

    <!-- SpeedGrader Modal -->
    <div class="modal-overlay" id="speedGraderModal">
      <div class="modal" style="max-width:1100px; height:90vh;">
        <div class="modal-header">
          <h2 class="modal-title" id="speedGraderTitle">SpeedGrader</h2>
          <button class="modal-close" onclick="closeModal('speedGraderModal')">&times;</button>
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
                <label class="form-label">Score</label>
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="number" class="form-input" id="speedGraderScore" min="0" style="width:100px;">
                  <span id="speedGraderScoreMax">/ 100</span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Feedback</label>
                <textarea class="form-textarea" id="speedGraderFeedback" rows="5" placeholder="Provide feedback..."></textarea>
              </div>
              <div class="form-group">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" id="speedGraderRelease">
                  <span>Release grade to student</span>
                </label>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary" id="speedGraderAiBtn" onclick="speedGraderDraftWithAI()">✨ AI Draft</button>
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
          <button class="modal-close" onclick="closeModal('questionBankModal')">&times;</button>
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

    <!-- Question Bank Edit Modal -->
    <div class="modal-overlay" id="questionBankEditModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title" id="questionBankEditTitle">New Question Bank</h2>
          <button class="modal-close" onclick="closeModal('questionBankEditModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Bank Name</label>
            <input type="text" class="form-input" id="questionBankName" placeholder="e.g., Chapter 1 Questions">
          </div>
          <div class="form-group">
            <label class="form-label">Description (optional)</label>
            <textarea class="form-textarea" id="questionBankDescription" rows="2" placeholder="Description of this question bank..."></textarea>
          </div>
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <label class="form-label" style="margin:0;">Questions</label>
              <button class="btn btn-secondary btn-sm" onclick="addQuestionToBankForm()">+ Add Question</button>
            </div>
            <div id="questionBankQuestionsContainer">
              <!-- Questions rendered here -->
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('questionBankEditModal'); openQuestionBankModal();">Cancel</button>
          <button class="btn btn-primary" id="questionBankSaveBtn" onclick="saveQuestionBank()">Save Bank</button>
        </div>
      </div>
    </div>

    <!-- New Assignment Modal (direct creation with type) -->
    <div class="modal-overlay" id="newAssignmentModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title" id="newAssignmentModalTitle">New Assignment</h2>
          <button class="modal-close" onclick="closeModal('newAssignmentModal'); resetNewAssignmentModal();">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Assignment Type</label>
            <select class="form-select" id="newAssignmentType" onchange="handleNewAssignmentTypeChange()">
              <option value="essay">Essay</option>
              <option value="project">Project</option>
              <option value="homework">Homework</option>
              <option value="participation">Participation</option>
              <option value="quiz">Quiz</option>
              <option value="exam">Exam</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="newAssignmentTitle" placeholder="Enter title">
          </div>
          <div class="form-group">
            <label class="form-label">Description / Instructions</label>
            <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('newAssignmentDescription')" title="Insert Link">🔗 Link</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('newAssignmentDescription')" title="Insert File">📄 File</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('newAssignmentDescription')" title="Insert Video">📹 Video</button>
            </div>
            <textarea class="form-textarea" id="newAssignmentDescription" placeholder="Describe the assignment... (supports Markdown)"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Intro Notes (visible to students before starting)</label>
            <textarea class="form-textarea" id="newAssignmentIntroNotes" rows="2" placeholder="Optional notes shown to students before they begin..."></textarea>
          </div>

          <!-- Question Bank Section (for Quiz/Exam) -->
          <div id="questionBankSection" style="display:none; background:var(--surface); padding:16px; border-radius:var(--radius); margin-bottom:16px;">
            <h4 style="margin-bottom:12px;">Question Bank Settings</h4>
            <div class="form-group">
              <label class="form-label">Select Question Bank</label>
              <select class="form-select" id="newAssignmentQuestionBank">
                <option value="">-- Select a question bank --</option>
              </select>
              <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="openQuestionBankModal()">Manage Question Banks</button>
            </div>
            <div class="form-group">
              <label class="form-label">Number of Questions</label>
              <input type="number" class="form-input" id="newAssignmentNumQuestions" value="10" min="1" placeholder="Number of questions to include">
              <div class="hint">Leave blank or 0 to include all questions from the bank</div>
            </div>
            <div class="form-group">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="newAssignmentRandomizeQuestions" checked>
                <span>Randomize question order</span>
              </label>
            </div>
            <div class="form-group">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="newAssignmentRandomizeAnswers" checked>
                <span>Randomize answer choices</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Points</label>
            <input type="number" class="form-input" id="newAssignmentPoints" value="100" min="1">
          </div>

          <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">Available From</label>
              <input type="datetime-local" class="form-input" id="newAssignmentAvailableFrom">
            </div>
            <div class="form-group">
              <label class="form-label">Available Until</label>
              <input type="datetime-local" class="form-input" id="newAssignmentAvailableUntil">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" class="form-input" id="newAssignmentDueDate" style="margin-bottom:8px;">
            <div style="display:flex; gap:8px; align-items:center;">
              <select class="form-select" id="newAssignmentDueHour" style="width:auto;">
                ${generateHourOptions(11)}
              </select>
              <span>:</span>
              <select class="form-select" id="newAssignmentDueMinute" style="width:auto;">
                ${generateMinuteOptions(59)}
              </select>
              <select class="form-select" id="newAssignmentDueAmPm" style="width:auto;">
                <option value="AM">AM</option>
                <option value="PM" selected>PM</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="newAssignmentStatus">
              <option value="draft">Draft (not visible to students)</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="newAssignmentAllowLate" checked>
              <span>Allow late submissions</span>
            </label>
          </div>

          <div id="latePenaltySection">
            <div class="form-group">
              <label class="form-label">Late Penalty Type</label>
              <select class="form-select" id="newAssignmentLatePenaltyType">
                <option value="per_day">Percentage per day late</option>
                <option value="flat">Flat percentage overall</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Penalty Amount (%)</label>
              <input type="number" class="form-input" id="newAssignmentLatePenalty" value="10" min="0" max="100">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Grading Notes (private - only visible to instructors)</label>
            <textarea class="form-textarea" id="newAssignmentGradingNotes" rows="2" placeholder="Notes for graders (rubric guidance, common issues to watch for, etc.)"></textarea>
          </div>

          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="newAssignmentAllowResubmit" checked>
              <span>Allow resubmission</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('newAssignmentModal'); resetNewAssignmentModal();">Cancel</button>
          <button class="btn btn-primary" id="newAssignmentSubmitBtn" onclick="saveNewAssignment()">Create Assignment</button>
        </div>
      </div>
    </div>

    <!-- Clone Course Modal -->
    <div class="modal-overlay" id="cloneCourseModal">
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <h2 class="modal-title">Clone Course</h2>
          <button class="modal-close" onclick="closeModal('cloneCourseModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div id="cloneCourseSourceInfo" class="muted" style="margin-bottom:16px; font-size:0.9rem;"></div>
          <div class="form-group">
            <label class="form-label">New Course Name *</label>
            <input type="text" class="form-input" id="cloneCourseNameInput" placeholder="e.g. ECON 101 - Spring 2027">
          </div>
          <div class="form-group">
            <label class="form-label">New Course Code *</label>
            <input type="text" class="form-input" id="cloneCourseCodeInput" placeholder="e.g. ECON101-SP27">
          </div>
          <div class="form-group">
            <label class="form-label">What to copy into the new course</label>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="cloneAssignments" checked>
                <span>Assignments <span class="muted" style="font-size:0.85rem;">(copied as drafts)</span></span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="cloneQuizzes" checked>
                <span>Quizzes <span class="muted" style="font-size:0.85rem;">(copied as drafts)</span></span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="cloneQBanks" checked>
                <span>Question Banks <span class="muted" style="font-size:0.85rem;">(all questions copied)</span></span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="cloneModules" checked>
                <span>Modules &amp; structure <span class="muted" style="font-size:0.85rem;">(links remapped to cloned items)</span></span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="cloneAnnouncements">
                <span>Announcements <span class="muted" style="font-size:0.85rem;">(copied as hidden drafts)</span></span>
              </label>
            </div>
          </div>
          <div class="hint" style="padding:12px; background:var(--primary-light); border-radius:var(--radius); font-size:0.85rem;">
            💡 The cloned course starts hidden from students. Students, grades, and submissions are never copied.
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('cloneCourseModal')">Cancel</button>
          <button class="btn btn-primary" onclick="cloneCourse()">Clone Course</button>
        </div>
      </div>
    </div>
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

// Export functions
export { generateHourOptions, generateMinuteOptions };
