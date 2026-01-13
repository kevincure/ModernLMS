/* ═══════════════════════════════════════════════════════════════════════════════
   Campus LMS - Complete Implementation
   Local-first LMS with Google SSO, courses, assignments, gradebook, AI
═══════════════════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'campus_lms_data_v3';
const ALLOWED_DOMAINS = ['university.edu', 'demo.edu'];

// Default data structure
const defaultData = {
  currentUser: null,
  users: [
    { id: 'u1', name: 'Dr. Sarah Chen', email: 'schen@university.edu', role: 'instructor', avatar: 'SC' },
    { id: 'u2', name: 'Michael Park', email: 'mpark@university.edu', role: 'ta', avatar: 'MP' },
    { id: 'u3', name: 'Emma Wilson', email: 'ewilson@student.edu', role: 'student', avatar: 'EW' },
    { id: 'u4', name: 'James Rodriguez', email: 'jrodriguez@student.edu', role: 'student', avatar: 'JR' },
    { id: 'u5', name: 'Aisha Patel', email: 'apatel@student.edu', role: 'student', avatar: 'AP' }
  ],
  courses: [
    { id: 'c1', name: 'ECON 101 - Introduction to Economics', code: 'ECON101', inviteCode: 'ECON2025', createdBy: 'u1', description: 'An introduction to microeconomic and macroeconomic principles', startHereTitle: 'Start Here', startHereContent: 'Welcome to **ECON 101**! Begin by reviewing the syllabus and completing Quiz 1 before next week.' },
    { id: 'c2', name: 'ECON 301 - Advanced Microeconomics', code: 'ECON301', inviteCode: 'MICRO25', createdBy: 'u1', description: 'Advanced topics in microeconomic theory and applications', startHereTitle: 'Start Here', startHereContent: 'Read the course overview, then jump into the first problem set.' }
  ],
  enrollments: [
    { userId: 'u1', courseId: 'c1', role: 'instructor' },
    { userId: 'u1', courseId: 'c2', role: 'instructor' },
    { userId: 'u2', courseId: 'c1', role: 'ta' },
    { userId: 'u3', courseId: 'c1', role: 'student' },
    { userId: 'u4', courseId: 'c1', role: 'student' },
    { userId: 'u5', courseId: 'c1', role: 'student' },
    { userId: 'u3', courseId: 'c2', role: 'student' }
  ],
  assignments: [
    { 
      id: 'a1', 
      courseId: 'c1', 
      title: 'Problem Set 1: Supply and Demand', 
      description: 'Complete problems 1-10 from Chapter 2. Show all work.',
      points: 100,
      status: 'published',
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      allowLateSubmissions: true,
      lateDeduction: 10,
      allowResubmission: true,
      category: 'homework',
      rubric: null
    },
    { 
      id: 'a2', 
      courseId: 'c1', 
      title: 'Economic Analysis Essay', 
      description: 'Write a 1500-word analysis of a current economic issue.',
      points: 150,
      status: 'published',
      dueDate: new Date(Date.now() + 86400000 * 14).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      allowLateSubmissions: false,
      lateDeduction: 0,
      allowResubmission: false,
      category: 'essay',
      rubric: null
    },
    { 
      id: 'a3', 
      courseId: 'c2', 
      title: 'Game Theory Problem Set', 
      description: 'Solve the Nash equilibrium problems.',
      points: 100,
      status: 'draft',
      dueDate: new Date(Date.now() + 86400000 * 10).toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      allowLateSubmissions: true,
      lateDeduction: 5,
      allowResubmission: true,
      category: 'homework',
      rubric: null
    }
  ],
  submissions: [
    { id: 's1', assignmentId: 'a1', userId: 'u3', text: 'My solution to problem set 1...', fileName: null, fileData: null, submittedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 's2', assignmentId: 'a1', userId: 'u4', text: 'Here are my answers...', fileName: 'answers.pdf', fileData: null, submittedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 's3', assignmentId: 'a2', userId: 'u3', text: 'Economic analysis essay draft...', fileName: null, fileData: null, submittedAt: new Date(Date.now() - 3600000).toISOString() }
  ],
  grades: [
    { submissionId: 's1', score: 92, feedback: 'Excellent work! Clear explanations.', released: true, gradedBy: 'u1', gradedAt: new Date().toISOString() },
    { submissionId: 's2', score: 78, feedback: 'Good effort, but problem 7 needs more detail.', released: false, gradedBy: 'u2', gradedAt: new Date().toISOString() }
  ],
  announcements: [
    { id: 'an1', courseId: 'c1', title: 'Welcome to ECON 101!', content: 'Welcome! Please review the syllabus and complete the first assignment by next Friday.', pinned: true, authorId: 'u1', createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: 'an2', courseId: 'c1', title: 'Office Hours Update', content: 'Office hours moved to Wednesdays 2-4pm.', pinned: false, authorId: 'u1', createdAt: new Date(Date.now() - 86400000).toISOString() }
  ],
  files: [
    { id: 'f1', courseId: 'c1', name: 'Course Syllabus.pdf', type: 'pdf', size: 245000, uploadedBy: 'u1', uploadedAt: new Date(Date.now() - 86400000 * 10).toISOString() },
    { id: 'f2', courseId: 'c1', name: 'Week 1 Slides.pptx', type: 'pptx', size: 1200000, uploadedBy: 'u1', uploadedAt: new Date(Date.now() - 86400000 * 7).toISOString() }
  ],
  rubrics: [
    // { id, assignmentId, criteria: [{ name, points, description }] }
  ],
  quizzes: [
    {
      id: 'q1',
      courseId: 'c1',
      title: 'Quiz 1: Market Basics',
      description: 'Short quiz on supply and demand basics.',
      status: 'published',
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      timeLimit: 20,
      attempts: 2,
      randomizeQuestions: true,
      questionPoolEnabled: true,
      questionSelectCount: 3,
      questions: [
        { id: 'q1-1', type: 'multiple_choice', prompt: 'What happens to quantity demanded when price increases?', options: ['Increases', 'Decreases', 'Stays the same', 'Becomes zero'], correctAnswer: 1, points: 2 },
        { id: 'q1-2', type: 'true_false', prompt: 'A price ceiling can create a shortage.', options: ['True', 'False'], correctAnswer: 'True', points: 2 },
        { id: 'q1-3', type: 'multiple_choice', prompt: 'Equilibrium occurs where?', options: ['Supply equals demand', 'Demand exceeds supply', 'Supply exceeds demand', 'Demand is zero'], correctAnswer: 0, points: 2 },
        { id: 'q1-4', type: 'short_answer', prompt: 'In one sentence, define opportunity cost.', options: [], correctAnswer: '', points: 4 }
      ]
    }
  ],
  quizQuestions: [
    // { id, quizId, type: 'multiple_choice'|'true_false'|'short_answer', question, options: [], correctAnswer, points }
  ],
  quizSubmissions: [
    // { id, quizId, userId, answers: {}, score, submittedAt }
  ],
  gradeCategories: [
    // { courseId, name, weight } - e.g., { courseId: 'c1', name: 'Homework', weight: 0.3 }
  ],
  notifications: [
    // { userId, type, title, message, courseId, read, createdAt }
  ],
  invites: [
    // { courseId, email, status: 'pending'|'accepted', sentAt }
  ],
  settings: {
    geminiKey: '',
    googleClientId: '',
    emailNotifications: true
  }
};

// State
let appData = loadData();
let activeCourseId = null;
let aiThread = [];
let quizDraftQuestions = [];
let currentEditQuizId = null;
let currentQuizTakingId = null;
let quizTimerInterval = null;
let quizTimeRemaining = null;
let aiDraft = null;
let aiDraftType = 'announcement';
let aiRubricDraft = null;
let aiQuizDraft = null;

// ═══════════════════════════════════════════════════════════════════════════════
// DATA PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  saveData(defaultData);
  return defaultData;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(text) {
  let output = escapeHtml(text);
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return output;
}

function renderMarkdown(text) {
  if (!text) return '';
  const codeBlocks = [];
  let working = text.replace(/```([\s\S]*?)```/g, (match, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(code);
    return `@@CODEBLOCK${index}@@`;
  });
  
  const lines = working.split('\n');
  let html = '';
  let inList = false;
  
  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };
  
  lines.forEach(line => {
    if (/^###\s+/.test(line)) {
      closeList();
      html += `<h4>${formatInlineMarkdown(line.replace(/^###\s+/, ''))}</h4>`;
      return;
    }
    if (/^##\s+/.test(line)) {
      closeList();
      html += `<h3>${formatInlineMarkdown(line.replace(/^##\s+/, ''))}</h3>`;
      return;
    }
    if (/^#\s+/.test(line)) {
      closeList();
      html += `<h2>${formatInlineMarkdown(line.replace(/^#\s+/, ''))}</h2>`;
      return;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${formatInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`;
      return;
    }
    if (line.trim() === '') {
      closeList();
      return;
    }
    closeList();
    html += `<p>${formatInlineMarkdown(line)}</p>`;
  });
  
  closeList();
  codeBlocks.forEach((code, index) => {
    const safeCode = escapeHtml(code);
    html = html.replace(`@@CODEBLOCK${index}@@`, `<pre><code>${safeCode}</code></pre>`);
  });
  
  return html;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / 86400000);
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getCurrentUser() {
  return appData.currentUser;
}

function getUserById(id) {
  return appData.users.find(u => u.id === id);
}

function getCourseById(id) {
  return appData.courses.find(c => c.id === id);
}

function getUserRole(userId, courseId) {
  const enrollment = appData.enrollments.find(e => e.userId === userId && e.courseId === courseId);
  return enrollment ? enrollment.role : null;
}

function isStaff(userId, courseId) {
  const role = getUserRole(userId, courseId);
  return role === 'instructor' || role === 'ta';
}

function getUserCourses(userId) {
  return appData.enrollments
    .filter(e => e.userId === userId)
    .map(e => ({ ...getCourseById(e.courseId), role: e.role }))
    .filter(c => c.id);
}

function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

function getQuizPoints(quiz) {
  if (!quiz || !quiz.questions) return 0;
  const total = quiz.questions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
  if (quiz.questionPoolEnabled && quiz.questionSelectCount && quiz.questions.length > 0) {
    const avg = total / quiz.questions.length;
    return Math.round(avg * quiz.questionSelectCount * 10) / 10;
  }
  return total;
}

function addNotification(userId, type, title, message, courseId) {
  if (!appData.notifications) appData.notifications = [];
  
  appData.notifications.push({
    id: generateId(),
    userId: userId,
    type: type,
    title: title,
    message: message,
    courseId: courseId,
    read: false,
    createdAt: new Date().toISOString()
  });
  
  saveData(appData);
  updateNotificationBadge();
}

function getUnreadNotifications(userId) {
  if (!appData.notifications) return [];
  return appData.notifications.filter(n => n.userId === userId && !n.read);
}

function markNotificationRead(notificationId) {
  if (!appData.notifications) return;
  
  const notification = appData.notifications.find(n => n.id === notificationId);
  if (notification) {
    notification.read = true;
    saveData(appData);
    updateNotificationBadge();
  }
}

function markAllNotificationsRead(userId) {
  if (!appData.notifications) return;
  appData.notifications.forEach(n => {
    if (n.userId === userId) n.read = true;
  });
  saveData(appData);
  updateNotificationBadge();
}

function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  const user = getCurrentUser();
  if (!badge || !user) return;
  
  const unread = getUnreadNotifications(user.id);
  if (unread.length === 0) {
    badge.textContent = '';
    badge.classList.remove('visible');
    return;
  }
  
  badge.textContent = unread.length > 9 ? '9+' : unread.length;
  badge.classList.add('visible');
}

function openNotifications() {
  renderNotifications();
  openModal('notificationsModal');
}

function renderNotifications() {
  const user = getCurrentUser();
  const listEl = document.getElementById('notificationsList');
  if (!user || !listEl) return;
  
  const notifications = (appData.notifications || [])
    .filter(n => n.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  if (notifications.length === 0) {
    listEl.innerHTML = '<div class="empty-state-text">No notifications yet</div>';
    return;
  }
  
  listEl.innerHTML = notifications.map(n => {
    const course = n.courseId ? getCourseById(n.courseId) : null;
    const courseLabel = course ? `<span class="muted">• ${course.code}</span>` : '';
    const statusBadge = n.read ? '' : '<span class="notification-new">New</span>';
    return `
      <button class="notification-item ${n.read ? '' : 'unread'}" onclick="openNotificationDetail('${n.id}')">
        <div class="notification-title">
          <span>${n.title}</span>
          ${statusBadge}
        </div>
        <div class="notification-message">${n.message}</div>
        <div class="notification-meta">${formatDate(n.createdAt)} ${courseLabel}</div>
      </button>
    `;
  }).join('');
}

function openNotificationDetail(notificationId) {
  markNotificationRead(notificationId);
  renderNotifications();
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

function initGoogleSignIn() {
  // Priority: keys.js > saved settings
  const clientId = window.GOOGLE_CLIENT_ID || appData.settings.googleClientId;
  
  if (!clientId || !window.google) {
    // Silently show demo login buttons instead
    document.getElementById('fallbackGoogleBtn').style.display = 'none';
    return;
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleResponse
  });

  google.accounts.id.renderButton(
    document.getElementById('googleSigninContainer'),
    { 
      theme: 'outline', 
      size: 'large',
      width: 300,
      text: 'continue_with'
    }
  );
  
  document.getElementById('fallbackGoogleBtn').style.display = 'none';
}

function handleGoogleResponse(response) {
  try {
    const token = response.credential;
    const payload = parseJwt(token);
    
    const email = payload.email;
    const name = payload.name;
    
    // Find or create user - default to instructor role
    let user = appData.users.find(u => u.email === email);
    if (!user) {
      user = {
        id: generateId(),
        name: name,
        email: email,
        avatar: getInitials(name),
        role: 'instructor' // Default to instructor
      };
      appData.users.push(user);
      
      // Auto-enroll as instructor in demo courses
      appData.courses.forEach(course => {
        const existing = appData.enrollments.find(e => e.userId === user.id && e.courseId === course.id);
        if (!existing) {
          appData.enrollments.push({
            userId: user.id,
            courseId: course.id,
            role: 'instructor'
          });
        }
      });
    }
    
    // Check for pending invites and auto-accept them
    if (!appData.invites) appData.invites = [];
    const pendingInvites = appData.invites.filter(i => i.email === email && i.status === 'pending');
    
    pendingInvites.forEach(invite => {
      // Add enrollment
      const existing = appData.enrollments.find(e => e.userId === user.id && e.courseId === invite.courseId);
      if (!existing) {
        appData.enrollments.push({
          userId: user.id,
          courseId: invite.courseId,
          role: 'student'
        });
      }
      
      // Mark invite as accepted
      invite.status = 'accepted';
    });
    
    appData.currentUser = user;
    saveData(appData);
    initApp();
  } catch (err) {
    console.error('Google sign-in error:', err);
    showToast('Sign-in failed. Please try again.', 'error');
  }
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

function googleSignIn() {
  // If this is called, it means Google SSO isn't configured
  // Just show settings modal
  openModal('settingsModal');
  showToast('Configure Google Client ID in Settings to use SSO', 'info');
}

function demoLogin(role) {
  const demoUsers = {
    instructor: { id: 'demo-i', name: 'Demo Instructor', email: 'instructor@demo.edu', avatar: 'DI', role: 'instructor' },
    ta: { id: 'demo-t', name: 'Demo TA', email: 'ta@demo.edu', avatar: 'DT', role: 'ta' },
    student: { id: 'demo-s', name: 'Demo Student', email: 'student@demo.edu', avatar: 'DS', role: 'student' }
  };
  
  const user = demoUsers[role];
  
  // Ensure demo user exists in users array
  if (!appData.users.find(u => u.id === user.id)) {
    appData.users.push(user);
  }
  
  // Ensure demo user is enrolled in course c1
  if (!appData.enrollments.find(e => e.userId === user.id && e.courseId === 'c1')) {
    appData.enrollments.push({ userId: user.id, courseId: 'c1', role: role });
  }
  
  appData.currentUser = user;
  saveData(appData);
  initApp();
}

function logout() {
  appData.currentUser = null;
  activeCourseId = null;
  saveData(appData);
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appContainer').setAttribute('aria-hidden', 'true');
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function initApp() {
  if (!appData.currentUser) {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appContainer').setAttribute('aria-hidden', 'true');
    setTimeout(initGoogleSignIn, 100);
    return;
  }
  
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appContainer').setAttribute('aria-hidden', 'false');
  
  // Set user info in top bar
  setText('userAvatarTop', appData.currentUser.avatar);
  setText('userNameTop', appData.currentUser.name);
  setText('userEmailTop', appData.currentUser.email);
  
  // Load user's courses
  const courses = getUserCourses(appData.currentUser.id);
  if (courses.length > 0 && !activeCourseId) {
    activeCourseId = courses[0].id;
  }
  
  populateCourseSelector();
  renderAll();
  updateNotificationBadge();
  navigateTo('courses');
}

function populateCourseSelector() {
  const courses = getUserCourses(appData.currentUser.id);
  const select = document.getElementById('courseSelect');

  if (!select) {
    return;
  }
  
  if (courses.length === 0) {
    select.innerHTML = '<option value="">No courses</option>';
    return;
  }
  
  select.innerHTML = courses.map(c => 
    `<option value="${c.id}" ${c.id === activeCourseId ? 'selected' : ''}>${c.name} (${c.role})</option>`
  ).join('');
}

function switchCourse(courseId) {
  activeCourseId = courseId;
  populateCourseSelector();
  renderAll();
  navigateTo('home');
}

function renderAll() {
  populateCourseSelector(); // Update dropdown
  renderTopBarCourse();
  renderTopBarActions();
  renderCourses();
  renderHome();
  renderUpdates();
  renderAssignments();
  renderCalendar();
  renderFiles();
  renderGradebook();
  renderPeople();
  updateNotificationBadge();
}

function renderTopBarActions() {
  const importBtn = document.getElementById('importContentBtn');
  if (!importBtn) return;
  const isStaffUser = activeCourseId && isStaff(appData.currentUser?.id, activeCourseId);
  importBtn.style.display = isStaffUser ? 'inline-flex' : 'none';
}

function renderTopBarCourse() {
  const titleEl = document.getElementById('activeCourseTitle');
  const subtitleEl = document.getElementById('activeCourseSubtitle');
  if (!titleEl || !subtitleEl) return;

  if (!activeCourseId) {
    titleEl.textContent = 'Select a course';
    subtitleEl.textContent = 'Choose a course from the Courses tab';
    return;
  }

  const course = getCourseById(activeCourseId);
  const role = getUserRole(appData.currentUser?.id, activeCourseId);
  if (course) {
    titleEl.textContent = course.name;
    subtitleEl.textContent = `${course.code} · ${role}`;
  } else {
    titleEl.textContent = 'Select a course';
    subtitleEl.textContent = 'Choose a course from the Courses tab';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function navigateTo(page) {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COURSES PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderCourses() {
  const allCourses = getUserCourses(appData.currentUser.id);
  // Filter out inactive courses
  const courses = allCourses.filter(c => c.active !== false);
  
  const actionsHTML = `
    <button class="btn btn-primary" onclick="openModal('createCourseModal')">Create Course</button>
    <button class="btn btn-secondary" onclick="openModal('joinCourseModal')">Join Course</button>
  `;
  setHTML('coursesActions', actionsHTML);
  
  if (courses.length === 0) {
    setHTML('coursesList', '<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">No courses yet</div><div class="empty-state-text">Create a course or join one with an invite code</div></div>');
    return;
  }
  
  const html = courses.map(c => `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${c.name}</div>
          <div class="muted">${c.code} · ${c.role}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" onclick="switchCourse('${c.id}')">Open</button>
          ${c.role === 'instructor' ? `
            <button class="btn btn-secondary btn-sm" onclick="openEditCourseModal('${c.id}')">Edit</button>
          ` : ''}
        </div>
      </div>
      ${c.description ? `<div style="margin-top:8px;" class="muted">${c.description}</div>` : ''}
    </div>
  `).join('');
  
  setHTML('coursesList', html);
}

function createCourse() {
  const name = document.getElementById('courseName').value.trim();
  const code = document.getElementById('courseCode').value.trim();
  const emailsText = document.getElementById('courseEmails').value.trim();
  
  if (!name || !code) {
    showToast('Please fill in course name and code', 'error');
    return;
  }
  
  const courseId = generateId();
  const inviteCode = generateInviteCode();
  
  appData.courses.push({
    id: courseId,
    name: name,
    code: code,
    inviteCode: inviteCode,
    createdBy: appData.currentUser.id
  });
  
  appData.enrollments.push({
    userId: appData.currentUser.id,
    courseId: courseId,
    role: 'instructor'
  });
  
  // Initialize invites array if it doesn't exist
  if (!appData.invites) appData.invites = [];
  
  // Process email invites
  if (emailsText) {
    const emails = emailsText.split('\n').map(e => e.trim()).filter(e => e && e.includes('@'));
    
    emails.forEach(email => {
      // Check if user exists
      let user = appData.users.find(u => u.email === email);
      
      if (user) {
        // User exists - auto-enroll if not already enrolled
        const existing = appData.enrollments.find(e => e.userId === user.id && e.courseId === courseId);
        if (!existing) {
          appData.enrollments.push({
            userId: user.id,
            courseId: courseId,
            role: 'student'
          });
        }
      } else {
        // User doesn't exist - create invite
        appData.invites.push({
          courseId: courseId,
          email: email,
          status: 'pending',
          sentAt: new Date().toISOString()
        });
      }
    });
  }
  
  saveData(appData);
  activeCourseId = courseId;
  
  closeModal('createCourseModal');
  renderAll();
  navigateTo('people');
  showToast(`Course created! Invite code: ${inviteCode}`, 'success');
  
  // Clear form
  document.getElementById('courseName').value = '';
  document.getElementById('courseCode').value = '';
  document.getElementById('courseEmails').value = '';
}

function joinCourse() {
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  
  if (!code) {
    showToast('Please enter an invite code', 'error');
    return;
  }
  
  const course = appData.courses.find(c => c.inviteCode === code);
  
  if (!course) {
    showToast('Invalid invite code', 'error');
    return;
  }
  
  const existing = appData.enrollments.find(e => 
    e.userId === appData.currentUser.id && e.courseId === course.id
  );
  
  if (existing) {
    showToast('You are already enrolled in this course', 'error');
    return;
  }
  
  appData.enrollments.push({
    userId: appData.currentUser.id,
    courseId: course.id,
    role: 'student'
  });
  
  saveData(appData);
  activeCourseId = course.id;
  
  closeModal('joinCourseModal');
  renderAll();
  navigateTo('home');
  showToast('Successfully joined course!', 'success');
}

function generateInviteCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderHome() {
  if (!activeCourseId) {
    setText('homeTitle', 'Home');
    setText('homeSubtitle', 'Select a course to get started');
    setHTML('homeUpcoming', '<div class="empty-state-text">No active course</div>');
    setHTML('homeUpdates', '<div class="empty-state-text">No active course</div>');
    setHTML('homeStartHere', '');
    setHTML('homeChecklist', '');
    return;
  }
  
  const course = getCourseById(activeCourseId);
  setText('homeTitle', course.name);
  setText('homeSubtitle', 'Course overview');

  renderStartHere(course);
  renderOnboardingChecklist(course);
  
  // Upcoming assignments + quizzes
  const upcomingAssignments = appData.assignments
    .filter(a => a.courseId === activeCourseId && a.status === 'published')
    .filter(a => new Date(a.dueDate) > new Date())
    .map(a => ({ type: 'Assignment', title: a.title, dueDate: a.dueDate }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  
  const upcomingQuizzes = appData.quizzes
    .filter(q => q.courseId === activeCourseId && q.status === 'published')
    .filter(q => new Date(q.dueDate) > new Date())
    .map(q => ({ type: 'Quiz', title: q.title, dueDate: q.dueDate }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  
  const upcoming = [...upcomingAssignments, ...upcomingQuizzes]
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);
  
  if (upcoming.length === 0) {
    setHTML('homeUpcoming', '<div class="muted" style="padding:12px;">No upcoming work</div>');
  } else {
    const html = upcoming.map(item => `
      <div style="padding:12px; border-bottom:1px solid var(--border-light);">
        <div style="font-weight:500;">${item.title}</div>
        <div class="muted" style="font-size:0.85rem;">${item.type} · Due ${formatDate(item.dueDate)}</div>
      </div>
    `).join('');
    setHTML('homeUpcoming', html);
  }
  
  // Recent updates
  const updates = appData.announcements
    .filter(a => a.courseId === activeCourseId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  
  if (updates.length === 0) {
    setHTML('homeUpdates', '<div class="muted" style="padding:12px;">No recent updates</div>');
  } else {
    const html = updates.map(u => {
      const author = getUserById(u.authorId);
      return `
        <div style="padding:12px; border-bottom:1px solid var(--border-light);">
          <div style="font-weight:500;">${u.title} ${u.pinned ? '📌' : ''}</div>
          <div class="muted" style="font-size:0.85rem;">${author ? author.name : 'Unknown'} · ${formatDate(u.createdAt)}</div>
        </div>
      `;
    }).join('');
    setHTML('homeUpdates', html);
  }
}

function renderStartHere(course) {
  const isStaffUser = isStaff(appData.currentUser.id, course.id);
  const startHereTitle = course.startHereTitle || 'Start Here';
  const startHereContent = course.startHereContent || course.description || '';
  const pinnedFiles = appData.files.filter(f => f.courseId === course.id).slice(0, 2);
  const pinnedAssignments = appData.assignments.filter(a => a.courseId === course.id).slice(0, 2);
  const pinnedQuizzes = appData.quizzes.filter(q => q.courseId === course.id).slice(0, 2);
  
  const pinnedItems = [
    ...pinnedFiles.map(f => ({ label: f.name, type: 'File' })),
    ...pinnedAssignments.map(a => ({ label: a.title, type: 'Assignment' })),
    ...pinnedQuizzes.map(q => ({ label: q.title, type: 'Quiz' }))
  ].slice(0, 4);
  
  const pinnedHtml = pinnedItems.length
    ? `<div class="start-here-links">${pinnedItems.map(item => `<span class="pill">${item.type}: ${item.label}</span>`).join('')}</div>`
    : '<div class="muted">Pin a syllabus, assignment, or quiz here.</div>';
  
  setHTML('homeStartHere', `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${startHereTitle}</div>
        ${isStaffUser ? `<button class="btn btn-secondary btn-sm" onclick="openStartHereModal('${course.id}')">Edit</button>` : ''}
      </div>
      <div class="markdown-content">${renderMarkdown(startHereContent)}</div>
      <div style="margin-top:12px;">
        <div class="muted" style="margin-bottom:6px;">Pinned essentials</div>
        ${pinnedHtml}
      </div>
    </div>
  `);
}

function renderOnboardingChecklist(course) {
  const isStaffUser = isStaff(appData.currentUser.id, course.id);
  if (!isStaffUser) {
    setHTML('homeChecklist', '');
    return;
  }
  
  const hasStudents = appData.enrollments.some(e => e.courseId === course.id && e.role === 'student');
  const hasAssignments = appData.assignments.some(a => a.courseId === course.id);
  const hasQuizzes = appData.quizzes.some(q => q.courseId === course.id);
  const hasUpdates = appData.announcements.some(a => a.courseId === course.id);
  const hasFiles = appData.files.some(f => f.courseId === course.id);
  
  const items = [
    { label: 'Invite students', done: hasStudents },
    { label: 'Create your first assignment', done: hasAssignments },
    { label: 'Publish a quiz', done: hasQuizzes },
    { label: 'Post a welcome update', done: hasUpdates },
    { label: 'Upload a syllabus file', done: hasFiles }
  ];
  
  setHTML('homeChecklist', `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Getting started checklist</div>
      </div>
      <div class="checklist">
        ${items.map(item => `
          <div class="checklist-row">
            <span class="checklist-status ${item.done ? 'done' : ''}">${item.done ? '✓' : '○'}</span>
            <span>${item.label}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `);
}

function openStartHereModal(courseId) {
  const course = getCourseById(courseId);
  if (!course) return;
  ensureModalsRendered();
  document.getElementById('startHereCourseId').value = courseId;
  document.getElementById('startHereTitle').value = course.startHereTitle || 'Start Here';
  document.getElementById('startHereContent').value = course.startHereContent || course.description || '';
  openModal('startHereModal');
}

function saveStartHere() {
  const courseId = document.getElementById('startHereCourseId').value;
  const title = document.getElementById('startHereTitle').value.trim();
  const content = document.getElementById('startHereContent').value.trim();
  const course = getCourseById(courseId);
  if (!course) return;
  
  course.startHereTitle = title || 'Start Here';
  course.startHereContent = content;
  saveData(appData);
  
  closeModal('startHereModal');
  renderHome();
  showToast('Start Here updated', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATES (ANNOUNCEMENTS) PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderUpdates() {
  if (!activeCourseId) {
    setText('updatesSubtitle', 'Select a course');
    setHTML('updatesActions', '');
    setHTML('updatesList', '<div class="empty-state-text">No active course</div>');
    return;
  }
  
  const course = getCourseById(activeCourseId);
  setText('updatesSubtitle', course.name);
  
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  
  if (isStaffUser) {
    setHTML('updatesActions', `
      <button class="btn btn-primary" onclick="openModal('announcementModal')">New Update</button>
      <button class="btn btn-secondary" onclick="openAiCreateModal('announcement')">AI Draft</button>
    `);
  } else {
    setHTML('updatesActions', '');
  }
  
  const announcements = appData.announcements
    .filter(a => a.courseId === activeCourseId)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  
  if (announcements.length === 0) {
    setHTML('updatesList', '<div class="empty-state"><div class="empty-state-icon">📢</div><div class="empty-state-title">No updates yet</div></div>');
    return;
  }
  
  const html = announcements.map(a => {
    const author = getUserById(a.authorId);
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${a.title} ${a.pinned ? '📌' : ''}</div>
            <div class="muted">${author ? author.name : 'Unknown'} · ${formatDate(a.createdAt)}</div>
          </div>
          ${isStaffUser ? `
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="editAnnouncement('${a.id}')">Edit</button>
              <button class="btn btn-secondary btn-sm" onclick="deleteAnnouncement('${a.id}')">Delete</button>
            </div>
          ` : ''}
        </div>
        <div class="markdown-content">${renderMarkdown(a.content)}</div>
      </div>
    `;
  }).join('');
  
  setHTML('updatesList', html);
}

function createAnnouncement() {
  const title = document.getElementById('announcementTitle').value.trim();
  const content = document.getElementById('announcementContent').value.trim();
  const pinned = document.getElementById('announcementPinned').checked;
  
  if (!title || !content) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  appData.announcements.push({
    id: generateId(),
    courseId: activeCourseId,
    title: title,
    content: content,
    pinned: pinned,
    authorId: appData.currentUser.id,
    createdAt: new Date().toISOString()
  });
  
  saveData(appData);
  closeModal('announcementModal');
  resetAnnouncementModal();
  renderUpdates();
  renderHome();
  showToast('Update posted!', 'success');
}

function deleteAnnouncement(id) {
  confirm('Delete this update?', () => {
    appData.announcements = appData.announcements.filter(a => a.id !== id);
    saveData(appData);
    renderUpdates();
    renderHome();
    showToast('Update deleted', 'success');
  });
}

let currentEditAnnouncementId = null;

function editAnnouncement(id) {
  currentEditAnnouncementId = id;
  const announcement = appData.announcements.find(a => a.id === id);
  
  if (!announcement) return;
  ensureModalsRendered();
  
  // Reuse the announcement modal
  document.getElementById('announcementTitle').value = announcement.title;
  document.getElementById('announcementContent').value = announcement.content;
  document.getElementById('announcementPinned').checked = announcement.pinned || false;
  
  // Change modal title and button text
  document.getElementById('announcementModalTitle').textContent = 'Edit Update';
  document.getElementById('announcementSubmitBtn').textContent = 'Save Changes';
  
  openModal('announcementModal');
}

function resetAnnouncementModal() {
  currentEditAnnouncementId = null;
  document.getElementById('announcementModalTitle').textContent = 'New Update';
  document.getElementById('announcementSubmitBtn').textContent = 'Post';
  document.getElementById('announcementTitle').value = '';
  document.getElementById('announcementContent').value = '';
  document.getElementById('announcementPinned').checked = false;
}

function saveAnnouncementChanges() {
  if (currentEditAnnouncementId) {
    updateAnnouncement();
  } else {
    createAnnouncement();
  }
}

function updateAnnouncement() {
  if (!currentEditAnnouncementId) return;
  
  const announcement = appData.announcements.find(a => a.id === currentEditAnnouncementId);
  if (!announcement) return;
  
  const title = document.getElementById('announcementTitle').value.trim();
  const content = document.getElementById('announcementContent').value.trim();
  const pinned = document.getElementById('announcementPinned').checked;
  
  if (!title || !content) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  announcement.title = title;
  announcement.content = content;
  announcement.pinned = pinned;
  
  saveData(appData);
  closeModal('announcementModal');
  resetAnnouncementModal();
  
  renderUpdates();
  renderHome();
  showToast('Update saved', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderAssignments() {
  if (!activeCourseId) {
    setText('assignmentsSubtitle', 'Select a course');
    setHTML('assignmentsActions', '');
    setHTML('assignmentsList', '<div class="empty-state-text">No active course</div>');
    return;
  }
  
  const course = getCourseById(activeCourseId);
  setText('assignmentsSubtitle', course.name);
  
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  
  if (isStaffUser) {
    setHTML('assignmentsActions', `
      <button class="btn btn-primary" onclick="openAssignmentModal()">New Assignment</button>
      <button class="btn btn-secondary" onclick="openQuizModal()">New Quiz</button>
      <button class="btn btn-secondary" onclick="openAiCreateModal('quiz')">AI Quiz</button>
    `);
  } else {
    setHTML('assignmentsActions', '');
  }
  
  const assignments = appData.assignments
    .filter(a => a.courseId === activeCourseId)
    .filter(a => isStaffUser || a.status === 'published')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const quizzes = appData.quizzes
    .filter(q => q.courseId === activeCourseId)
    .filter(q => isStaffUser || q.status === 'published')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  if (assignments.length === 0 && quizzes.length === 0) {
    setHTML('assignmentsList', '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-title">No assignments or quizzes yet</div></div>');
    return;
  }
  
  const assignmentCards = assignments.map(a => {
    const dueDate = new Date(a.dueDate);
    const isPast = dueDate < new Date();
    const mySubmission = appData.submissions.find(s => s.assignmentId === a.id && s.userId === appData.currentUser.id);
    const submissionCount = appData.submissions.filter(s => s.assignmentId === a.id).length;
    
    let statusBadge = '';
    if (a.status === 'draft') statusBadge = '<span style="padding:4px 8px; background:var(--warning-light); color:var(--warning); border-radius:4px; font-size:0.75rem; font-weight:600;">DRAFT</span>';
    if (a.status === 'closed') statusBadge = '<span style="padding:4px 8px; background:var(--border-color); color:var(--text-muted); border-radius:4px; font-size:0.75rem; font-weight:600;">CLOSED</span>';
    
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${a.title} ${statusBadge}</div>
            <div class="muted">Due ${formatDate(a.dueDate)} ${isPast ? '(Past due)' : ''} · ${a.points} points</div>
          </div>
          <div style="display:flex; gap:8px;">
            ${isStaffUser ? `
              <button class="btn btn-secondary btn-sm" onclick="viewSubmissions('${a.id}')">Submissions (${submissionCount})</button>
              <button class="btn btn-secondary btn-sm" onclick="editAssignment('${a.id}')">Edit</button>
            ` : mySubmission ? `
              <button class="btn btn-secondary btn-sm" onclick="viewMySubmission('${a.id}')">View Submission</button>
            ` : a.status === 'published' && !isPast ? `
              <button class="btn btn-primary btn-sm" onclick="submitAssignment('${a.id}')">Submit</button>
            ` : ''}
          </div>
        </div>
        <div class="markdown-content">${renderMarkdown(a.description)}</div>
      </div>
    `;
  }).join('');

  const quizCards = quizzes.map(q => {
    const dueDate = new Date(q.dueDate);
    const isPast = dueDate < new Date();
    const quizPoints = getQuizPoints(q);
    const submissions = appData.quizSubmissions.filter(s => s.quizId === q.id);
    const mySubmissions = submissions.filter(s => s.userId === appData.currentUser.id);
    const latestSubmission = mySubmissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
    const attemptsUsed = mySubmissions.length;
    const attemptsAllowed = q.attempts ? q.attempts : null;
    const attemptsLeft = attemptsAllowed ? Math.max(attemptsAllowed - attemptsUsed, 0) : null;
    
    let statusBadge = '';
    if (q.status === 'draft') statusBadge = '<span style="padding:4px 8px; background:var(--warning-light); color:var(--warning); border-radius:4px; font-size:0.75rem; font-weight:600;">DRAFT</span>';
    if (q.status === 'closed') statusBadge = '<span style="padding:4px 8px; background:var(--border-color); color:var(--text-muted); border-radius:4px; font-size:0.75rem; font-weight:600;">CLOSED</span>';

    const timeLimitLabel = q.timeLimit ? `${q.timeLimit} min` : 'No time limit';
    const attemptsLabel = attemptsAllowed ? `${attemptsLeft} of ${attemptsAllowed} left` : 'Unlimited attempts';
    const submissionStatus = latestSubmission
      ? (latestSubmission.released ? `Score: ${latestSubmission.score}/${quizPoints}` : 'Submitted · awaiting review')
      : 'Not started';

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${q.title} ${statusBadge}</div>
            <div class="muted">Due ${formatDate(q.dueDate)} ${isPast ? '(Past due)' : ''} · ${quizPoints} points · ${timeLimitLabel}</div>
            <div class="muted" style="font-size:0.85rem;">${attemptsLabel} · ${submissionStatus}</div>
          </div>
          <div style="display:flex; gap:8px;">
            ${isStaffUser ? `
              <button class="btn btn-secondary btn-sm" onclick="viewQuizSubmissions('${q.id}')">Submissions (${submissions.length})</button>
              <button class="btn btn-secondary btn-sm" onclick="openQuizModal('${q.id}')">Edit</button>
            ` : latestSubmission ? `
              <button class="btn btn-secondary btn-sm" onclick="viewQuizSubmission('${q.id}')">View Submission</button>
              ${!isPast && (!attemptsAllowed || attemptsLeft > 0) ? `<button class="btn btn-primary btn-sm" onclick="takeQuiz('${q.id}')">Retake</button>` : ''}
            ` : q.status === 'published' && !isPast ? `
              <button class="btn btn-primary btn-sm" onclick="takeQuiz('${q.id}')">Take Quiz</button>
            ` : ''}
          </div>
        </div>
        <div class="markdown-content">${renderMarkdown(q.description || '')}</div>
      </div>
    `;
  }).join('');

  const sections = [];
  if (assignments.length > 0) {
    sections.push(`
      <div class="section-header">Assignments</div>
      ${assignmentCards}
    `);
  }
  if (quizzes.length > 0) {
    sections.push(`
      <div class="section-header">Quizzes</div>
      ${quizCards}
    `);
  }

  setHTML('assignmentsList', sections.join(''));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderCalendar() {
  if (!activeCourseId) {
    setText('calendarSubtitle', 'Select a course');
    setHTML('calendarActions', '');
    setHTML('calendarList', '<div class="empty-state-text">No active course</div>');
    return;
  }
  
  const course = getCourseById(activeCourseId);
  setText('calendarSubtitle', course.name);
  setHTML('calendarActions', '');
  
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - 7);
  const end = new Date();
  end.setDate(now.getDate() + 45);
  
  const items = [
    ...appData.assignments
      .filter(a => a.courseId === activeCourseId)
      .filter(a => isStaffUser || a.status === 'published')
      .map(a => ({ type: 'Assignment', title: a.title, dueDate: a.dueDate, status: a.status })),
    ...appData.quizzes
      .filter(q => q.courseId === activeCourseId)
      .filter(q => isStaffUser || q.status === 'published')
      .map(q => ({ type: 'Quiz', title: q.title, dueDate: q.dueDate, status: q.status }))
  ].filter(item => {
    const date = new Date(item.dueDate);
    return date >= start && date <= end;
  });
  
  if (items.length === 0) {
    setHTML('calendarList', '<div class="empty-state"><div class="empty-state-icon">🗓️</div><div class="empty-state-title">No upcoming work</div></div>');
    return;
  }
  
  const grouped = items.reduce((acc, item) => {
    const dateKey = new Date(item.dueDate).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});
  
  const orderedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
  
  const html = orderedDates.map(dateKey => `
    <div class="calendar-day">
      <div class="calendar-date">${new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      <div class="calendar-items">
        ${grouped[dateKey].map(item => `
          <div class="calendar-item">
            <div class="calendar-item-type">${item.type}</div>
            <div class="calendar-item-title">${item.title}</div>
            ${item.status === 'draft' ? '<span class="calendar-badge">Draft</span>' : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
  
  setHTML('calendarList', html);
}

function createAssignment() {
  const title = document.getElementById('assignmentTitle').value.trim();
  const description = document.getElementById('assignmentDescription').value.trim();
  const category = document.getElementById('assignmentCategory').value;
  const points = parseInt(document.getElementById('assignmentPoints').value);
  const dueDate = document.getElementById('assignmentDueDate').value;
  const status = document.getElementById('assignmentStatus').value;
  const allowLate = document.getElementById('assignmentAllowLate').checked;
  const lateDeduction = parseInt(document.getElementById('assignmentLateDeduction').value) || 0;
  const allowResubmit = document.getElementById('assignmentAllowResubmit').checked;
  
  if (!title || !description || !points || !dueDate) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  const assignmentId = generateId();
  
  appData.assignments.push({
    id: assignmentId,
    courseId: activeCourseId,
    title: title,
    description: description,
    category: category,
    points: points,
    status: status,
    dueDate: new Date(dueDate).toISOString(),
    createdAt: new Date().toISOString(),
    allowLateSubmissions: allowLate,
    lateDeduction: lateDeduction,
    allowResubmission: allowResubmit,
    rubric: null
  });
  
  saveData(appData);
  
  // Send notifications to enrolled students if published
  if (status === 'published') {
    const students = appData.enrollments
      .filter(e => e.courseId === activeCourseId && e.role === 'student')
      .map(e => e.userId);
    
    students.forEach(studentId => {
      addNotification(studentId, 'assignment', 'New Assignment Posted', 
        `${title} is now available`, activeCourseId);
    });
  }
  
  closeModal('assignmentModal');
  resetAssignmentModal();
  renderAssignments();
  renderHome();
  showToast('Assignment created!', 'success');
}

let currentEditAssignmentId = null;

function openAssignmentModal(assignmentId = null) {
  ensureModalsRendered();
  currentEditAssignmentId = assignmentId;
  const assignment = assignmentId ? appData.assignments.find(a => a.id === assignmentId) : null;

  document.getElementById('assignmentModalTitle').textContent = assignment ? 'Edit Assignment' : 'New Assignment';
  document.getElementById('assignmentSubmitBtn').textContent = assignment ? 'Save Changes' : 'Create';
  document.getElementById('assignmentTitle').value = assignment ? assignment.title : '';
  document.getElementById('assignmentDescription').value = assignment ? assignment.description : '';
  document.getElementById('assignmentCategory').value = assignment ? assignment.category : 'homework';
  document.getElementById('assignmentPoints').value = assignment ? assignment.points : '100';
  document.getElementById('assignmentDueDate').value = assignment ? new Date(assignment.dueDate).toISOString().slice(0, 16) : '';
  document.getElementById('assignmentStatus').value = assignment ? assignment.status : 'draft';
  document.getElementById('assignmentAllowLate').checked = assignment ? assignment.allowLateSubmissions !== false : true;
  document.getElementById('assignmentLateDeduction').value = assignment ? assignment.lateDeduction || 0 : '10';
  document.getElementById('assignmentAllowResubmit').checked = assignment ? assignment.allowResubmission !== false : true;

  openModal('assignmentModal');
}

function resetAssignmentModal() {
  currentEditAssignmentId = null;
  document.getElementById('assignmentModalTitle').textContent = 'New Assignment';
  document.getElementById('assignmentSubmitBtn').textContent = 'Create';
  document.getElementById('assignmentTitle').value = '';
  document.getElementById('assignmentDescription').value = '';
  document.getElementById('assignmentCategory').value = 'homework';
  document.getElementById('assignmentPoints').value = '100';
  document.getElementById('assignmentDueDate').value = '';
  document.getElementById('assignmentStatus').value = 'draft';
  document.getElementById('assignmentAllowLate').checked = true;
  document.getElementById('assignmentLateDeduction').value = '10';
  document.getElementById('assignmentAllowResubmit').checked = true;
}

function saveAssignmentChanges() {
  if (currentEditAssignmentId) {
    updateAssignment();
  } else {
    createAssignment();
  }
}

function updateAssignment() {
  if (!currentEditAssignmentId) return;

  const assignment = appData.assignments.find(a => a.id === currentEditAssignmentId);
  if (!assignment) return;

  const title = document.getElementById('assignmentTitle').value.trim();
  const description = document.getElementById('assignmentDescription').value.trim();
  const category = document.getElementById('assignmentCategory').value;
  const points = parseInt(document.getElementById('assignmentPoints').value);
  const dueDate = document.getElementById('assignmentDueDate').value;
  const status = document.getElementById('assignmentStatus').value;
  const allowLate = document.getElementById('assignmentAllowLate').checked;
  const lateDeduction = parseInt(document.getElementById('assignmentLateDeduction').value) || 0;
  const allowResubmit = document.getElementById('assignmentAllowResubmit').checked;

  if (!title || !description || !points || !dueDate) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  const previousStatus = assignment.status;

  assignment.title = title;
  assignment.description = description;
  assignment.category = category;
  assignment.points = points;
  assignment.status = status;
  assignment.dueDate = new Date(dueDate).toISOString();
  assignment.allowLateSubmissions = allowLate;
  assignment.lateDeduction = lateDeduction;
  assignment.allowResubmission = allowResubmit;

  saveData(appData);

  if (previousStatus !== 'published' && status === 'published') {
    const students = appData.enrollments
      .filter(e => e.courseId === activeCourseId && e.role === 'student')
      .map(e => e.userId);

    students.forEach(studentId => {
      addNotification(studentId, 'assignment', 'New Assignment Posted',
        `${title} is now available`, activeCourseId);
    });
  }

  closeModal('assignmentModal');
  resetAssignmentModal();
  renderAssignments();
  renderHome();
  showToast('Assignment updated!', 'success');
}

function editAssignment(assignmentId) {
  openAssignmentModal(assignmentId);
}

function submitAssignment(assignmentId) {
  openModal('submitModal');
  document.getElementById('submitModalAssignmentId').value = assignmentId;
}

function saveSubmission() {
  const assignmentId = document.getElementById('submitModalAssignmentId').value;
  const text = document.getElementById('submissionText').value.trim();
  const fileInput = document.getElementById('submissionFile');
  
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  
  // Check if past due and late submissions not allowed
  const dueDate = new Date(assignment.dueDate);
  const now = new Date();
  
  if (now > dueDate && !assignment.allowLateSubmissions) {
    showToast('This assignment is past due and does not accept late submissions', 'error');
    return;
  }
  
  // Check if resubmission allowed
  const existingSubmission = appData.submissions.find(s => 
    s.assignmentId === assignmentId && s.userId === appData.currentUser.id
  );
  
  if (existingSubmission && !assignment.allowResubmission) {
    showToast('This assignment does not allow resubmissions', 'error');
    return;
  }
  
  if (!text && !fileInput.files[0]) {
    showToast('Please provide submission text or upload a file', 'error');
    return;
  }
  
  const submission = {
    id: generateId(),
    assignmentId: assignmentId,
    userId: appData.currentUser.id,
    text: text,
    fileName: null,
    fileData: null,
    submittedAt: new Date().toISOString()
  };
  
  if (fileInput.files[0]) {
    const file = fileInput.files[0];
    submission.fileName = file.name;
    
    // For small files (< 1MB), store as base64
    if (file.size < 1048576) {
      const reader = new FileReader();
      reader.onload = function(e) {
        submission.fileData = e.target.result;
        appData.submissions.push(submission);
        saveData(appData);
        
        // Notify instructor
        const instructors = appData.enrollments
          .filter(e => e.courseId === assignment.courseId && e.role === 'instructor')
          .map(e => e.userId);
        
        instructors.forEach(instrId => {
          addNotification(instrId, 'submission', 'New Submission',
            `${appData.currentUser.name} submitted ${assignment.title}`,
            assignment.courseId
          );
        });
        
        closeModal('submitModal');
        renderAssignments();
        showToast('Submission saved!', 'success');
        document.getElementById('submissionText').value = '';
        fileInput.value = '';
      };
      reader.readAsDataURL(file);
      return;
    } else {
      // For large files, just store metadata
      showToast('Large file - metadata only stored (implement Supabase storage for production)', 'info');
    }
  }
  
  appData.submissions.push(submission);
  saveData(appData);
  
  // Notify instructor
  const instructors = appData.enrollments
    .filter(e => e.courseId === assignment.courseId && e.role === 'instructor')
    .map(e => e.userId);
  
  instructors.forEach(instrId => {
    addNotification(instrId, 'submission', 'New Submission',
      `${appData.currentUser.name} submitted ${assignment.title}`,
      assignment.courseId
    );
  });
  
  closeModal('submitModal');
  renderAssignments();
  
  const lateDeduction = calculateLateDeduction(assignment, submission.submittedAt);
  if (lateDeduction > 0) {
    showToast(`Submission saved! Note: ${lateDeduction}% late penalty applies`, 'success');
  } else {
    showToast('Submission saved!', 'success');
  }
  
  document.getElementById('submissionText').value = '';
  fileInput.value = '';
}

function viewSubmissions(assignmentId) {
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  const submissions = appData.submissions.filter(s => s.assignmentId === assignmentId);
  
  const html = `
    <div class="modal-overlay visible" id="submissionsModal">
      <div class="modal" style="max-width:900px;">
        <div class="modal-header">
          <h2 class="modal-title">Submissions: ${assignment.title}</h2>
          <button class="modal-close" onclick="closeModal('submissionsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display:flex; gap:8px; margin-bottom:16px;">
            <button class="btn btn-secondary btn-sm" onclick="openBulkGradeModal('${assignmentId}')">📋 Bulk Import Grades</button>
            <button class="btn btn-secondary btn-sm" onclick="bulkReleaseGrades('${assignmentId}')">🔓 Release All Grades</button>
            <button class="btn btn-secondary btn-sm" onclick="downloadAllSubmissions('${assignmentId}')">📥 Download All (ZIP)</button>
          </div>
          ${submissions.length === 0 ? '<div class="empty-state-text">No submissions yet</div>' : submissions.map(s => {
            const student = getUserById(s.userId);
            const grade = appData.grades.find(g => g.submissionId === s.id);
            const dueDate = new Date(assignment.dueDate);
            const submitDate = new Date(s.submittedAt);
            const isLate = submitDate > dueDate;
            const lateDeduction = calculateLateDeduction(assignment, s.submittedAt);
            
            return `
              <div class="card">
                <div class="card-header">
                  <div>
                    <div class="card-title">${student ? student.name : 'Unknown'} ${isLate ? '⚠️ LATE' : ''}</div>
                    <div class="muted">
                      Submitted ${formatDate(s.submittedAt)}
                      ${isLate && lateDeduction > 0 ? ` · ${lateDeduction}% late penalty` : ''}
                    </div>
                  </div>
                  <div style="display:flex; gap:8px; align-items:center;">
                    ${grade ? `<span class="muted">${grade.score}/${assignment.points} ${grade.released ? '' : '🔒'}</span>` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="viewSubmissionHistory('${assignmentId}', '${s.userId}')">History</button>
                    <button class="btn btn-primary btn-sm" onclick="gradeSubmission('${s.id}', '${assignmentId}')">Grade</button>
                  </div>
                </div>
                <div>${s.text || '<em class="muted">No text submission</em>'}</div>
                ${s.fileName ? `<div class="muted" style="margin-top:8px;">📎 ${s.fileName}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML += html;
}

function downloadAllSubmissions(assignmentId) {
  showToast('ZIP download would be implemented with JSZip library', 'info');
  // In production: use JSZip to create ZIP of all submissions
}

function gradeSubmission(submissionId, assignmentId) {
  const submission = appData.submissions.find(s => s.id === submissionId);
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  const student = getUserById(submission.userId);
  const existingGrade = appData.grades.find(g => g.submissionId === submissionId);
  
  // Check if assignment has a rubric
  const rubric = appData.rubrics?.find(r => r.assignmentId === assignmentId);
  
  let rubricHTML = '';
  if (rubric) {
    rubricHTML = `
      <div class="card" style="margin-bottom:16px; background:var(--bg-color);">
        <div style="font-weight:600; margin-bottom:12px;">Grading Rubric</div>
        ${rubric.criteria.map((criterion, idx) => `
          <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <strong>${criterion.name}</strong>
              <span>${criterion.points} pts</span>
            </div>
            ${criterion.description ? `<div class="muted" style="font-size:0.85rem;">${criterion.description}</div>` : ''}
            <input type="number" class="form-input" id="rubricCriterion${idx}" 
                   min="0" max="${criterion.points}" step="0.1" 
                   placeholder="0-${criterion.points}"
                   style="margin-top:4px;">
          </div>
        `).join('')}
        <button class="btn btn-secondary btn-sm" onclick="calculateRubricScore('${assignmentId}')" style="width:100%; margin-top:8px;">Calculate Total from Rubric</button>
      </div>
    `;
  }
  
  const html = `
    <div class="modal-overlay visible" id="gradeModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title">Grade Submission: ${student ? student.name : 'Unknown'}</h2>
          <button class="modal-close" onclick="closeModal('gradeModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="card" style="margin-bottom:16px; background:var(--bg-color);">
            <div style="font-weight:600; margin-bottom:8px;">${assignment.title}</div>
            <div>${submission.text || '<em class="muted">No text submission</em>'}</div>
            ${submission.fileName ? `<div class="muted" style="margin-top:8px;">📎 ${submission.fileName}</div>` : ''}
          </div>
          
          ${rubricHTML}
          
          <div class="form-group">
            <label class="form-label">Score (out of ${assignment.points})</label>
            <input type="number" class="form-input" id="gradeScore" min="0" max="${assignment.points}" value="${existingGrade ? existingGrade.score : ''}" placeholder="0">
          </div>
          
          <div class="form-group">
            <label class="form-label">Feedback</label>
            <textarea class="form-textarea" id="gradeFeedback" placeholder="Provide feedback...">${existingGrade ? existingGrade.feedback : ''}</textarea>
          </div>
          
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="gradeReleased" ${existingGrade ? (existingGrade.released ? 'checked' : '') : ''}>
              <span>Release grade to student</span>
            </label>
          </div>
          
          <div style="margin-top:16px;">
            <button class="btn btn-secondary" onclick="draftGradeWithAI('${submissionId}', '${assignmentId}')">✨ Draft with AI</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('gradeModal')">Cancel</button>
          <button class="btn btn-primary" onclick="saveGrade('${submissionId}')">Save Grade</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML += html;
}

function calculateRubricScore(assignmentId) {
  const rubric = appData.rubrics?.find(r => r.assignmentId === assignmentId);
  if (!rubric) return;
  
  let total = 0;
  let allFilled = true;
  
  rubric.criteria.forEach((criterion, idx) => {
    const input = document.getElementById(`rubricCriterion${idx}`);
    if (input && input.value) {
      total += parseFloat(input.value) || 0;
    } else {
      allFilled = false;
    }
  });
  
  if (!allFilled) {
    showToast('Please fill in all rubric criteria', 'error');
    return;
  }
  
  document.getElementById('gradeScore').value = total.toFixed(1);
  showToast('Score calculated from rubric', 'success');
}

function saveGrade(submissionId) {
  const score = parseFloat(document.getElementById('gradeScore').value);
  const feedback = document.getElementById('gradeFeedback').value.trim();
  const released = document.getElementById('gradeReleased').checked;
  
  if (isNaN(score) || !feedback) {
    showToast('Please provide score and feedback', 'error');
    return;
  }
  
  // Remove existing grade if any
  appData.grades = appData.grades.filter(g => g.submissionId !== submissionId);
  
  // Add new grade
  appData.grades.push({
    submissionId: submissionId,
    score: score,
    feedback: feedback,
    released: released,
    gradedBy: appData.currentUser.id,
    gradedAt: new Date().toISOString()
  });
  
  saveData(appData);
  closeModal('gradeModal');
  closeModal('submissionsModal');
  renderGradebook();
  showToast('Grade saved!', 'success');
}

async function draftGradeWithAI(submissionId, assignmentId) {
  const apiKey = window.GEMINI || appData.settings.geminiKey;
  
  if (!apiKey) {
    showToast('Gemini API key not configured. Add GEMINI to keys.js or configure in Settings.', 'error');
    return;
  }
  
  const submission = appData.submissions.find(s => s.id === submissionId);
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  
  const prompt = `You are grading a student submission for an assignment.

Assignment: ${assignment.title}
Description: ${assignment.description}
Points possible: ${assignment.points}

Student submission:
${submission.text || 'No text submission provided'}

Please provide a grade and feedback. Respond ONLY with valid JSON in this format:
{"score": <number>, "feedback": "<string>"}

The score should be between 0 and ${assignment.points}. The feedback should be constructive and specific.`;

  try {
    showToast('Drafting grade with AI...', 'info');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const text = data.candidates[0].content.parts[0].text;
    
    // Try to parse JSON from response
    let result;
    try {
      // Extract JSON from markdown code blocks if present
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
    
    document.getElementById('gradeScore').value = result.score;
    document.getElementById('gradeFeedback').value = result.feedback;
    showToast('AI draft ready! Review and edit as needed.', 'success');
    
  } catch (err) {
    console.error('AI grading error:', err);
    showToast('AI drafting failed: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZZES
// ═══════════════════════════════════════════════════════════════════════════════

function createDefaultQuestion(type = 'multiple_choice') {
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

function openQuizModal(quizId = null) {
  ensureModalsRendered();
  currentEditQuizId = quizId;
  const quiz = quizId ? appData.quizzes.find(q => q.id === quizId) : null;
  
  const draft = !quiz && aiQuizDraft ? aiQuizDraft : null;
  
  document.getElementById('quizModalTitle').textContent = quiz ? 'Edit Quiz' : 'New Quiz';
  document.getElementById('quizTitle').value = quiz ? quiz.title : (draft?.title || '');
  document.getElementById('quizDescription').value = quiz ? quiz.description || '' : (draft?.description || '');
  document.getElementById('quizDueDate').value = quiz ? new Date(quiz.dueDate).toISOString().slice(0, 16) : '';
  document.getElementById('quizStatus').value = quiz ? quiz.status : 'draft';
  document.getElementById('quizTimeLimit').value = quiz ? quiz.timeLimit || '' : '';
  document.getElementById('quizAttempts').value = quiz ? quiz.attempts || '' : '';
  document.getElementById('quizRandomize').checked = quiz ? quiz.randomizeQuestions === true : true;
  document.getElementById('quizPoolEnabled').checked = quiz ? quiz.questionPoolEnabled === true : false;
  document.getElementById('quizPoolCount').value = quiz ? quiz.questionSelectCount || '' : '';
  
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

function toggleQuizPoolFields() {
  const enabled = document.getElementById('quizPoolEnabled').checked;
  const poolGroup = document.getElementById('quizPoolCountGroup');
  if (poolGroup) {
    poolGroup.style.display = enabled ? 'block' : 'none';
  }
}

function renderQuizQuestions() {
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
              <input type="text" class="form-input" value="${opt}" oninput="updateQuizOption(${index}, ${optIndex}, this.value)" placeholder="Option ${optIndex + 1}">
            </div>
          `).join('')}
          <div class="form-group">
            <label class="form-label">Correct answer</label>
            <select class="form-select" onchange="updateQuizQuestion(${index}, 'correctAnswer', this.value)">
              ${q.options.map((opt, optIndex) => `
                <option value="${optIndex}" ${parseInt(q.correctAnswer) === optIndex ? 'selected' : ''}>${opt || `Option ${optIndex + 1}`}</option>
              `).join('')}
            </select>
          </div>
        </div>
      `;
    } else if (q.type === 'true_false') {
      optionsHtml = `
        <div class="form-group">
          <label class="form-label">Correct answer</label>
          <select class="form-select" onchange="updateQuizQuestion(${index}, 'correctAnswer', this.value)">
            <option value="True" ${q.correctAnswer === 'True' ? 'selected' : ''}>True</option>
            <option value="False" ${q.correctAnswer === 'False' ? 'selected' : ''}>False</option>
          </select>
        </div>
      `;
    } else {
      optionsHtml = `
        <div class="form-group">
          <label class="form-label">Sample answer (optional)</label>
          <textarea class="form-textarea" rows="2" oninput="updateQuizQuestion(${index}, 'correctAnswer', this.value)" placeholder="Add a reference answer">${q.correctAnswer || ''}</textarea>
        </div>
      `;
    }
    
    return `
      <div class="quiz-question-card">
        <div class="quiz-question-header">
          <div class="form-group">
            <label class="form-label">Question ${index + 1}</label>
            <input type="text" class="form-input" value="${q.prompt}" oninput="updateQuizQuestion(${index}, 'prompt', this.value)" placeholder="Write the question...">
          </div>
          <div class="quiz-question-meta">
            <select class="form-select" onchange="updateQuizQuestion(${index}, 'type', this.value)">
              ${typeOptions}
            </select>
            <input type="number" class="form-input" value="${q.points}" min="1" oninput="updateQuizQuestion(${index}, 'points', this.value)" placeholder="Points">
            <button class="btn btn-secondary btn-sm" onclick="removeQuizQuestion(${index})">Remove</button>
          </div>
        </div>
        ${optionsHtml}
      </div>
    `;
  }).join('');
  
  updateQuizPointsTotal();
}

function updateQuizQuestion(index, field, value) {
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
  
  question[field] = value;
}

function updateQuizOption(questionIndex, optionIndex, value) {
  const question = quizDraftQuestions[questionIndex];
  if (!question || !question.options) return;
  question.options[optionIndex] = value;
}

function addQuizQuestion() {
  quizDraftQuestions.push(createDefaultQuestion());
  renderQuizQuestions();
}

function removeQuizQuestion(index) {
  quizDraftQuestions.splice(index, 1);
  if (quizDraftQuestions.length === 0) {
    quizDraftQuestions.push(createDefaultQuestion());
  }
  renderQuizQuestions();
}

function updateQuizPointsTotal() {
  const total = quizDraftQuestions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
  const el = document.getElementById('quizPointsTotal');
  if (el) el.textContent = total.toFixed(1);
}

function saveQuiz() {
  const title = document.getElementById('quizTitle').value.trim();
  const description = document.getElementById('quizDescription').value.trim();
  const dueDate = document.getElementById('quizDueDate').value;
  const status = document.getElementById('quizStatus').value;
  const timeLimit = parseInt(document.getElementById('quizTimeLimit').value, 10) || 0;
  const attempts = parseInt(document.getElementById('quizAttempts').value, 10) || 0;
  const randomizeQuestions = document.getElementById('quizRandomize').checked;
  const questionPoolEnabled = document.getElementById('quizPoolEnabled').checked;
  const questionSelectCount = parseInt(document.getElementById('quizPoolCount').value, 10) || 0;
  
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
  
  const existingIndex = appData.quizzes.findIndex(q => q.id === quizData.id);
  const previousStatus = existingIndex >= 0 ? appData.quizzes[existingIndex].status : null;
  
  if (existingIndex >= 0) {
    appData.quizzes[existingIndex] = quizData;
  } else {
    appData.quizzes.push(quizData);
  }
  
  saveData(appData);
  
  if (quizData.status === 'published' && previousStatus !== 'published') {
    const students = appData.enrollments
      .filter(e => e.courseId === activeCourseId && e.role === 'student')
      .map(e => e.userId);
    
    students.forEach(studentId => {
      addNotification(studentId, 'quiz', 'New Quiz Posted', `${title} is now available`, activeCourseId);
    });
  }
  
  closeModal('quizModal');
  renderAssignments();
  renderHome();
  showToast('Quiz saved!', 'success');
}

function takeQuiz(quizId) {
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;
  
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
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

function renderQuizTakeModal(quiz) {
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
    if (q.type === 'multiple_choice') {
      return `
        <div class="quiz-question-block">
          <div class="quiz-question-title">${index + 1}. ${q.prompt}</div>
          ${q.options.map((opt, optIndex) => `
            <label class="quiz-answer-option">
              <input type="radio" name="quizQuestion${index}" value="${optIndex}">
              <span>${opt}</span>
            </label>
          `).join('')}
        </div>
      `;
    }
    
    if (q.type === 'true_false') {
      return `
        <div class="quiz-question-block">
          <div class="quiz-question-title">${index + 1}. ${q.prompt}</div>
          ${['True', 'False'].map(option => `
            <label class="quiz-answer-option">
              <input type="radio" name="quizQuestion${index}" value="${option}">
              <span>${option}</span>
            </label>
          `).join('')}
        </div>
      `;
    }
    
    return `
      <div class="quiz-question-block">
        <div class="quiz-question-title">${index + 1}. ${q.prompt}</div>
        <textarea class="form-textarea" rows="3" id="quizAnswer${index}" placeholder="Your answer..."></textarea>
      </div>
    `;
  }).join('');
  
  const points = getQuizPoints({ questions });
  setText('quizTakeTitle', quiz.title);
  setText('quizTakeMeta', `${points} points · ${quiz.timeLimit ? quiz.timeLimit + ' min' : 'No time limit'}`);
  
  startQuizTimer(quiz.timeLimit);
}

function startQuizTimer(timeLimit) {
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

function submitQuiz() {
  const quiz = appData.quizzes.find(q => q.id === currentQuizTakingId);
  const container = document.getElementById('quizTakeQuestions');
  if (!quiz || !container) return;
  
  const questions = JSON.parse(container.dataset.questions || '[]');
  const answers = {};
  
  questions.forEach((q, index) => {
    if (q.type === 'short_answer') {
      answers[q.id] = document.getElementById(`quizAnswer${index}`).value.trim();
    } else {
      const selected = document.querySelector(`input[name="quizQuestion${index}"]:checked`);
      answers[q.id] = selected ? selected.value : null;
    }
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
    released: !needsManual,
    feedback: '',
    submittedAt: new Date().toISOString(),
    gradedAt: needsManual ? null : new Date().toISOString(),
    gradedBy: needsManual ? null : 'auto'
  };
  
  appData.quizSubmissions.push(submission);
  saveData(appData);
  
  if (quizTimerInterval) {
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;
  }
  
  const instructors = appData.enrollments
    .filter(e => e.courseId === activeCourseId && (e.role === 'instructor' || e.role === 'ta'))
    .map(e => e.userId);
  
  instructors.forEach(instrId => {
    addNotification(instrId, 'quiz', 'New Quiz Submission', `${appData.currentUser.name} submitted ${quiz.title}`, activeCourseId);
  });
  
  if (!needsManual) {
    addNotification(appData.currentUser.id, 'quiz', 'Quiz Graded', `Score: ${autoScore}/${totalPoints}`, activeCourseId);
    showToast(`Quiz submitted! Score: ${autoScore}/${totalPoints}`, 'success');
  } else {
    showToast('Quiz submitted! Awaiting review.', 'success');
  }
  
  closeModal('quizTakeModal');
  renderAssignments();
}

function calculateQuizAutoScore(questions, answers) {
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

function viewQuizSubmissions(quizId) {
  ensureModalsRendered();
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (!quiz) return;
  
  const submissions = appData.quizSubmissions
    .filter(s => s.quizId === quizId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  
  const list = document.getElementById('quizSubmissionsList');
  if (!list) return;
  
  if (submissions.length === 0) {
    list.innerHTML = '<div class="empty-state-text">No submissions yet</div>';
  } else {
    list.innerHTML = submissions.map(submission => {
      const student = getUserById(submission.userId);
      const status = submission.released ? `Score: ${submission.score}` : 'Needs review';
      return `
        <div class="submission-row">
          <div>
            <div style="font-weight:600;">${student ? student.name : 'Unknown'}</div>
            <div class="muted">${formatDate(submission.submittedAt)} · ${status}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="openQuizGradeModal('${quizId}', '${submission.id}')">Grade</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  document.getElementById('quizSubmissionsTitle').textContent = `Quiz Submissions: ${quiz.title}`;
  openModal('quizSubmissionsModal');
}

function openQuizGradeModal(quizId, submissionId) {
  ensureModalsRendered();
  const quiz = appData.quizzes.find(q => q.id === quizId);
  const submission = appData.quizSubmissions.find(s => s.id === submissionId);
  if (!quiz || !submission) return;
  
  const student = getUserById(submission.userId);
  const answersList = document.getElementById('quizGradeAnswers');
  const scoreInput = document.getElementById('quizGradeScore');
  const feedbackInput = document.getElementById('quizGradeFeedback');
  
  document.getElementById('quizGradeTitle').textContent = `Grade Quiz: ${student ? student.name : 'Student'}`;
  const totalPoints = getQuizPoints({ questions: submission.questions });
  document.getElementById('quizGradePoints').textContent = `${totalPoints} pts total`;
  
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
        <div class="quiz-answer-question">${index + 1}. ${q.prompt}</div>
        <div class="quiz-answer-response">Answer: ${answerText}</div>
      </div>
    `;
  }).join('');
  
  scoreInput.value = submission.score || submission.autoScore || 0;
  feedbackInput.value = submission.feedback || '';
  document.getElementById('quizGradeSubmissionId').value = submission.id;
  document.getElementById('quizGradeQuizId').value = quizId;
  
  openModal('quizGradeModal');
}

function saveQuizGrade() {
  const submissionId = document.getElementById('quizGradeSubmissionId').value;
  const quizId = document.getElementById('quizGradeQuizId').value;
  const score = parseFloat(document.getElementById('quizGradeScore').value) || 0;
  const feedback = document.getElementById('quizGradeFeedback').value.trim();
  
  const submission = appData.quizSubmissions.find(s => s.id === submissionId);
  if (!submission) return;
  
  submission.score = score;
  submission.feedback = feedback;
  submission.released = true;
  submission.needsManual = false;
  submission.gradedAt = new Date().toISOString();
  submission.gradedBy = appData.currentUser.id;
  
  saveData(appData);
  
  const quiz = appData.quizzes.find(q => q.id === quizId);
  if (quiz) {
    addNotification(submission.userId, 'quiz', 'Quiz Graded', `Score: ${score}/${getQuizPoints(quiz)}`, quiz.courseId);
  }
  
  closeModal('quizGradeModal');
  renderAssignments();
  viewQuizSubmissions(quizId);
  showToast('Quiz graded!', 'success');
}

function viewQuizSubmission(quizId) {
  ensureModalsRendered();
  const quiz = appData.quizzes.find(q => q.id === quizId);
  const submissions = appData.quizSubmissions
    .filter(s => s.quizId === quizId && s.userId === appData.currentUser.id)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  
  const latest = submissions[0];
  if (!quiz || !latest) return;
  
  const list = document.getElementById('quizReviewList');
  if (!list) return;
  
  const totalPoints = getQuizPoints({ questions: latest.questions });
  document.getElementById('quizReviewTitle').textContent = `${quiz.title} · ${latest.released ? `Score ${latest.score}/${totalPoints}` : 'Awaiting review'}`;
  
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
        <div class="quiz-answer-question">${index + 1}. ${q.prompt}</div>
        <div class="quiz-answer-response">Your answer: ${answerText}</div>
      </div>
    `;
  }).join('');
  
  openModal('quizReviewModal');
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function shuffleArray(list) {
  return list.slice().sort(() => Math.random() - 0.5);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILES PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderFiles() {
  if (!activeCourseId) {
    setText('filesSubtitle', 'Select a course');
    setHTML('filesActions', '');
    setHTML('filesList', '<div class="empty-state-text">No active course</div>');
    return;
  }
  
  const course = getCourseById(activeCourseId);
  setText('filesSubtitle', course.name);
  
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  
  if (isStaffUser) {
    setHTML('filesActions', '<button class="btn btn-primary" onclick="openModal(\'fileUploadModal\')">Upload File</button>');
  } else {
    setHTML('filesActions', '');
  }
  
  const files = appData.files.filter(f => f.courseId === activeCourseId);
  
  if (files.length === 0) {
    setHTML('filesList', '<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-title">No files yet</div></div>');
    return;
  }
  
  const html = files.map(f => {
    const uploader = getUserById(f.uploadedBy);
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📄 ${f.name}</div>
            <div class="muted">${formatFileSize(f.size)} · Uploaded by ${uploader ? uploader.name : 'Unknown'} on ${formatDate(f.uploadedAt)}</div>
          </div>
          ${isStaffUser ? `<button class="btn btn-secondary btn-sm" onclick="deleteFile('${f.id}')">Delete</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  setHTML('filesList', html);
}

function uploadFile() {
  const fileInput = document.getElementById('fileUpload');
  const file = fileInput.files[0];
  
  if (!file) {
    showToast('Please select a file', 'error');
    return;
  }
  
  appData.files.push({
    id: generateId(),
    courseId: activeCourseId,
    name: file.name,
    type: file.name.split('.').pop(),
    size: file.size,
    uploadedBy: appData.currentUser.id,
    uploadedAt: new Date().toISOString()
  });
  
  saveData(appData);
  closeModal('fileUploadModal');
  renderFiles();
  showToast('File uploaded! (Metadata only - implement Supabase storage for actual files)', 'success');
  fileInput.value = '';
}

function deleteFile(id) {
  confirm('Delete this file?', () => {
    appData.files = appData.files.filter(f => f.id !== id);
    saveData(appData);
    renderFiles();
    showToast('File deleted', 'success');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRADEBOOK PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderGradebook() {
  if (!activeCourseId) {
    setText('gradebookSubtitle', 'Select a course');
    setHTML('gradebookActions', '');
    setHTML('gradebookWrap', '<div class="empty-state-text">No active course</div>');
    return;
  }
  
  const course = getCourseById(activeCourseId);
  setText('gradebookSubtitle', course.name);
  
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  
  if (isStaffUser) {
    renderStaffGradebook();
  } else {
    renderStudentGradebook();
  }
}

function renderStudentGradebook() {
  setHTML('gradebookActions', '');
  
  const assignments = appData.assignments
    .filter(a => a.courseId === activeCourseId && a.status === 'published')
    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
  
  if (assignments.length === 0) {
    setHTML('gradebookWrap', '<div class="empty-state-text">No assignments yet</div>');
    return;
  }
  
  let totalScore = 0;
  let totalPoints = 0;
  
  const html = assignments.map(a => {
    const submission = appData.submissions.find(s => s.assignmentId === a.id && s.userId === appData.currentUser.id);
    const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;
    
    let status = 'Not submitted';
    let score = '—';
    let feedback = '';
    
    if (submission) {
      if (grade && grade.released) {
        status = 'Graded';
        score = `${grade.score}/${a.points}`;
        feedback = grade.feedback;
        totalScore += grade.score;
        totalPoints += a.points;
      } else if (grade && !grade.released) {
        status = 'Submitted (grading in progress)';
      } else {
        status = 'Submitted';
      }
    }
    
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${a.title}</div>
            <div class="muted">${status} · ${a.category}</div>
          </div>
          <div style="font-size:1.2rem; font-weight:600;">${score}</div>
        </div>
        ${feedback ? `<div style="margin-top:12px; padding:12px; background:var(--bg-color); border-radius:var(--radius);"><strong>Feedback:</strong> ${feedback}</div>` : ''}
      </div>
    `;
  }).join('');
  
  const percentage = totalPoints > 0 ? ((totalScore / totalPoints) * 100).toFixed(1) : '—';
  const weightedGrade = calculateWeightedGrade(appData.currentUser.id, activeCourseId);
  
  let summary = `
    <div class="card" style="background:var(--primary-light); border-color:var(--primary); margin-bottom:16px;">
      <div class="card-header">
        <div class="card-title">Overall Grade</div>
        <div style="font-size:1.5rem; font-weight:600;">${percentage}%</div>
      </div>
      <div class="muted">${totalScore} / ${totalPoints} points</div>
  `;
  
  if (weightedGrade !== null) {
    summary += `<div style="margin-top:12px; padding:12px; background:white; border-radius:var(--radius);">
      <strong>Weighted Grade:</strong> ${weightedGrade.toFixed(1)}%
      <div class="muted" style="font-size:0.85rem; margin-top:4px;">Based on category weights</div>
    </div>`;
  }
  
  summary += '</div>';
  
  setHTML('gradebookWrap', summary + html);
}

function renderStaffGradebook() {
  const hasWeights = appData.gradeCategories && appData.gradeCategories.some(c => c.courseId === activeCourseId);
  
  setHTML('gradebookActions', `
    <button class="btn btn-secondary" onclick="openCategoryWeightsModal()">Category Weights ${hasWeights ? '✓' : ''}</button>
    <button class="btn btn-secondary" onclick="exportGradebook()">Export CSV</button>
  `);
  
  const assignments = appData.assignments
    .filter(a => a.courseId === activeCourseId)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  
  const students = appData.enrollments
    .filter(e => e.courseId === activeCourseId && e.role === 'student')
    .map(e => getUserById(e.userId))
    .filter(u => u);
  
  if (students.length === 0 || assignments.length === 0) {
    setHTML('gradebookWrap', '<div class="empty-state-text">No students or assignments yet</div>');
    return;
  }
  
  // Calculate statistics for each assignment
  const assignmentStats = assignments.map(assignment => {
    const grades = [];
    students.forEach(student => {
      const submission = appData.submissions.find(s => s.assignmentId === assignment.id && s.userId === student.id);
      const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;
      if (grade) grades.push(grade.score);
    });
    
    if (grades.length === 0) {
      return { assignment, average: 0, median: 0, min: 0, max: 0, count: 0 };
    }
    
    grades.sort((a, b) => a - b);
    const average = grades.reduce((sum, g) => sum + g, 0) / grades.length;
    const median = grades.length % 2 === 0 
      ? (grades[grades.length / 2 - 1] + grades[grades.length / 2]) / 2
      : grades[Math.floor(grades.length / 2)];
    
    return {
      assignment,
      average: average.toFixed(1),
      median: median.toFixed(1),
      min: Math.min(...grades),
      max: Math.max(...grades),
      count: grades.length
    };
  });
  
  // Display statistics cards
  let statsHTML = '<div class="card" style="margin-bottom:20px; background:var(--primary-light);">';
  statsHTML += '<div class="card-title">Assignment Statistics</div>';
  statsHTML += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-top:12px;">';
  
  assignmentStats.forEach(stat => {
    statsHTML += `
      <div style="padding:12px; background:white; border-radius:var(--radius); border:1px solid var(--border-color);">
        <div style="font-weight:600; font-size:0.9rem; margin-bottom:8px;">${stat.assignment.title}</div>
        <div style="font-size:0.85rem; color:var(--text-muted);">
          <div>Average: <strong>${stat.average}/${stat.assignment.points}</strong></div>
          <div>Median: ${stat.median}</div>
          <div>Range: ${stat.min}-${stat.max}</div>
          <div>Graded: ${stat.count}/${students.length}</div>
        </div>
      </div>
    `;
  });
  
  statsHTML += '</div></div>';
  
  const table = `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:var(--bg-color); border-bottom:2px solid var(--border-color);">
            <th style="padding:12px; text-align:left; position:sticky; left:0; background:var(--bg-color);">Student</th>
            ${assignments.map(a => `<th style="padding:12px; text-align:center; min-width:120px;">${a.title}<br><span class="muted" style="font-weight:normal;">(${a.points}pts)</span></th>`).join('')}
            <th style="padding:12px; text-align:center;">Total</th>
            <th style="padding:12px; text-align:center;">Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(student => {
            let totalScore = 0;
            let totalPoints = 0;
            
            const row = `
              <tr style="border-bottom:1px solid var(--border-light);">
                <td style="padding:12px; position:sticky; left:0; background:var(--bg-card);">${student.name}</td>
                ${assignments.map(a => {
                  const submission = appData.submissions.find(s => s.assignmentId === a.id && s.userId === student.id);
                  const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;
                  
                  if (grade) {
                    totalScore += grade.score;
                    totalPoints += a.points;
                    return `<td style="padding:12px; text-align:center;">${grade.score} ${grade.released ? '' : '🔒'}</td>`;
                  }
                  return `<td style="padding:12px; text-align:center;" class="muted">—</td>`;
                }).join('')}
                <td style="padding:12px; text-align:center; font-weight:600;">${totalPoints > 0 ? `${totalScore}/${totalPoints}` : '—'}</td>
                <td style="padding:12px; text-align:center; font-weight:600;">${totalPoints > 0 ? ((totalScore / totalPoints) * 100).toFixed(1) + '%' : '—'}</td>
              </tr>
            `;
            return row;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="muted" style="margin-top:12px; font-size:0.85rem;">🔒 = Grade not yet released to student</div>
  `;
  
  setHTML('gradebookWrap', statsHTML + table);
}

function exportGradebook() {
  const assignments = appData.assignments
    .filter(a => a.courseId === activeCourseId)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  
  const students = appData.enrollments
    .filter(e => e.courseId === activeCourseId && e.role === 'student')
    .map(e => getUserById(e.userId))
    .filter(u => u);
  
  let csv = 'Student,Email,' + assignments.map(a => a.title).join(',') + ',Total\n';
  
  students.forEach(student => {
    let totalScore = 0;
    let totalPoints = 0;
    let row = `${student.name},${student.email},`;
    
    assignments.forEach(a => {
      const submission = appData.submissions.find(s => s.assignmentId === a.id && s.userId === student.id);
      const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;
      
      if (grade) {
        totalScore += grade.score;
        totalPoints += a.points;
        row += `${grade.score}/${a.points},`;
      } else {
        row += ',';
      }
    });
    
    row += `${totalScore}/${totalPoints}\n`;
    csv += row;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gradebook.csv';
  a.click();
  
  showToast('Gradebook exported!', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PEOPLE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function renderPeople() {
  if (!activeCourseId) {
    setText('peopleSubtitle', 'Select a course');
    setHTML('peopleActions', '');
    setHTML('peopleList', '<div class="empty-state-text">No active course</div>');
    return;
  }
  
  const course = getCourseById(activeCourseId);
  setText('peopleSubtitle', course.name);
  
  const people = appData.enrollments
    .filter(e => e.courseId === activeCourseId)
    .map(e => ({ ...getUserById(e.userId), role: e.role }))
    .filter(p => p.id)
    .sort((a, b) => {
      const roleOrder = { instructor: 0, ta: 1, student: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });
  
  const isStaffUser = isStaff(appData.currentUser.id, activeCourseId);
  
  if (isStaffUser) {
    setHTML('peopleActions', `
      <button class="btn btn-primary btn-sm" onclick="openAddPersonModal()">Add Person</button>
      <button class="btn btn-secondary btn-sm" onclick="openBulkStudentImportModal()">Import Students</button>
      <div class="muted" style="margin-left:12px;">Invite code: <strong>${course.inviteCode}</strong></div>
    `);
  } else {
    setHTML('peopleActions', '');
  }
  
  // Show as clean table instead of blocky cards
  let html = '';
  
  const grouped = {
    instructor: people.filter(p => p.role === 'instructor'),
    ta: people.filter(p => p.role === 'ta'),
    student: people.filter(p => p.role === 'student')
  };
  
  Object.entries(grouped).forEach(([role, members]) => {
    if (members.length === 0) return;
    
    const roleTitle = role === 'ta' ? 'Teaching Assistants' : role.charAt(0).toUpperCase() + role.slice(1) + 's';
    
    html += `
      <div style="margin-bottom:32px;">
        <h3 style="font-family:var(--font-serif); font-size:1.1rem; margin-bottom:12px; color:var(--text-color);">${roleTitle} (${members.length})</h3>
        <div style="background:white; border:1px solid var(--border-light); border-radius:var(--radius); overflow:hidden;">
          ${members.map((p, idx) => `
            <div style="display:flex; align-items:center; padding:12px 16px; gap:12px; ${idx < members.length - 1 ? 'border-bottom:1px solid var(--border-light);' : ''}">
              <div class="user-avatar" style="width:32px; height:32px; font-size:0.85rem; background:var(--primary-light); color:var(--primary); flex-shrink:0;">${p.avatar}</div>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:500; font-size:0.95rem;">${p.name}</div>
                <div class="muted" style="font-size:0.8rem;">${p.email}</div>
              </div>
              ${isStaffUser && p.id !== appData.currentUser.id ? `
                <button class="btn btn-secondary btn-sm" onclick="removePersonFromCourse('${p.id}', '${activeCourseId}')" style="padding:4px 12px;">Remove</button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });
  
  // Show pending invites for staff
  if (isStaffUser && appData.invites) {
    const pendingInvites = appData.invites.filter(i => i.courseId === activeCourseId && i.status === 'pending');
    
    if (pendingInvites.length > 0) {
      html += `
        <div style="margin-bottom:32px;">
          <h3 style="font-family:var(--font-serif); font-size:1.1rem; margin-bottom:12px; color:var(--warning);">Pending Invites (${pendingInvites.length})</h3>
          <div style="background:var(--warning-light); border:1px solid var(--warning); border-radius:var(--radius); overflow:hidden;">
            ${pendingInvites.map((inv, idx) => `
              <div style="display:flex; align-items:center; padding:12px 16px; gap:12px; ${idx < pendingInvites.length - 1 ? 'border-bottom:1px solid var(--warning);' : ''}">
                <div class="user-avatar" style="width:32px; height:32px; font-size:0.85rem; background:var(--warning); color:white; flex-shrink:0;">?</div>
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:500; font-size:0.95rem;">${inv.email}</div>
                  <div style="font-size:0.8rem; color:var(--warning);">Invited ${formatDate(inv.sentAt)} · Awaiting sign-up</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }
  
  setHTML('peopleList', html || '<div class="empty-state-text">No people in this course</div>');
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function resetAiThread() {
  aiThread = [];
  renderAiThread();
}

function renderAiThread() {
  const html = aiThread.map(msg => `
    <div style="margin-bottom:16px;">
      <div style="font-weight:600; margin-bottom:4px; color:${msg.role === 'user' ? 'var(--primary)' : 'var(--text-color)'};">
        ${msg.role === 'user' ? 'You' : 'AI'}
      </div>
      <div class="markdown-content">${msg.role === 'assistant' ? renderMarkdown(msg.content) : renderMarkdown(msg.content)}</div>
    </div>
  `).join('');
  
  setHTML('aiThread', html || '<div class="muted" style="padding:20px; text-align:center;">Start a conversation...</div>');
  
  const thread = document.getElementById('aiThread');
  thread.scrollTop = thread.scrollHeight;
}

async function sendAiMessage() {
  const input = document.getElementById('aiInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  const apiKey = window.GEMINI || appData.settings.geminiKey;
  
  if (!apiKey) {
    showToast('Gemini API key not configured. Add GEMINI to keys.js or configure in Settings.', 'error');
    return;
  }
  
  // Build context about current course
  let context = '';
  if (activeCourseId) {
    const course = getCourseById(activeCourseId);
    const role = getUserRole(appData.currentUser.id, activeCourseId);
    const students = appData.enrollments.filter(e => e.courseId === activeCourseId && e.role === 'student');
    const assignments = appData.assignments.filter(a => a.courseId === activeCourseId);
    
    context = `
Course Context:
- Course: ${course.name} (${course.code})
- Your Role: ${role}
- Number of Students: ${students.length}
- Number of Assignments: ${assignments.length}
${assignments.length > 0 ? `- Recent Assignments: ${assignments.slice(0, 3).map(a => a.title).join(', ')}` : ''}

`;
  }
  
  const fullMessage = context + message;
  
  aiThread.push({ role: 'user', content: message }); // Show only user's message
  input.value = '';
  renderAiThread();
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullMessage }] }],
        generationConfig: {
          temperature: 0.7
        }
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const reply = data.candidates[0].content.parts[0].text;
    aiThread.push({ role: 'assistant', content: reply });
    renderAiThread();
    
  } catch (err) {
    console.error('AI error:', err);
    showToast('AI request failed: ' + err.message, 'error');
    aiThread.push({ role: 'assistant', content: `Error: ${err.message}` });
    renderAiThread();
  }
}

function openAiCreateModal(type = 'announcement', assignmentId = null) {
  generateModals();
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
  
  document.getElementById('aiCreatePrompt').value = '';
  document.getElementById('aiQuestionCount').value = '5';
  updateAiCreateType();
  renderAiDraftPreview();
  openModal('aiCreateModal');
}

function updateAiCreateType() {
  aiDraftType = document.getElementById('aiCreateType').value;
  const rubricGroup = document.getElementById('aiRubricGroup');
  const quizGroup = document.getElementById('aiQuizGroup');
  if (rubricGroup) rubricGroup.style.display = aiDraftType === 'rubric' ? 'block' : 'none';
  if (quizGroup) quizGroup.style.display = aiDraftType === 'quiz' ? 'block' : 'none';
}

async function generateAiDraft() {
  const apiKey = window.GEMINI || appData.settings.geminiKey;
  if (!apiKey) {
    showToast('Gemini API key not configured. Add GEMINI to keys.js or configure in Settings.', 'error');
    return;
  }
  
  const prompt = document.getElementById('aiCreatePrompt').value.trim();
  if (!prompt) {
    showToast('Add a prompt to guide the AI', 'error');
    return;
  }
  
  const course = activeCourseId ? getCourseById(activeCourseId) : null;
  let systemPrompt = '';
  
  if (aiDraftType === 'announcement') {
    systemPrompt = `Create a course announcement. Return ONLY valid JSON with keys: title, content. Use markdown in content when helpful. Example: {"title":"...","content":"..."}. Do not wrap in code fences or extra text.`;
  } else if (aiDraftType === 'quiz') {
    const count = parseInt(document.getElementById('aiQuestionCount').value, 10) || 5;
    systemPrompt = `Create a quiz as JSON with keys: title, description, questions (array). Each question must include type ("multiple_choice"|"true_false"|"short_answer"), prompt, options (array, for multiple_choice only), correctAnswer (index for multiple_choice, "True"/"False" for true_false, empty string for short_answer), points (number). Provide ${count} questions. Return only JSON (no markdown). Example: {"title":"...","description":"...","questions":[{"type":"multiple_choice","prompt":"...","options":["A","B"],"correctAnswer":0,"points":2}]}.`;
  } else {
    const assignmentId = document.getElementById('aiRubricAssignment').value;
    if (!assignmentId) {
      showToast('Select an assignment for the rubric', 'error');
      return;
    }
    const assignment = appData.assignments.find(a => a.id === assignmentId);
    systemPrompt = `Create a grading rubric for this assignment. Return ONLY JSON with key criteria (array). Each criterion must include name, points, description. Total points should sum to ${assignment ? assignment.points : 100}. Example: {"criteria":[{"name":"...","points":10,"description":"..."}]}.`;
  }
  
  const contextualPrompt = `
Course: ${course ? course.name : 'Unknown'}
Prompt: ${prompt}
${systemPrompt}
`;
  
  try {
    showToast('Generating draft with AI...', 'info');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: contextualPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4
        }
      })
    });
    
    const data = await response.json();
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

function parseAiJsonResponse(text) {
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

function renderAiDraftPreview() {
  const preview = document.getElementById('aiDraftPreview');
  if (!preview) return;
  
  if (!aiDraft) {
    preview.innerHTML = '<div class="muted">Generate a draft to preview it here.</div>';
    return;
  }
  
  if (aiDraftType === 'announcement') {
    preview.innerHTML = `
      <div class="card">
        <div class="card-title">${aiDraft.title || 'Untitled announcement'}</div>
        <div class="markdown-content">${renderMarkdown(aiDraft.content || '')}</div>
      </div>
    `;
    return;
  }
  
  if (aiDraftType === 'quiz') {
    preview.innerHTML = `
      <div class="card">
        <div class="card-title">${aiDraft.title || 'Untitled quiz'}</div>
        <div class="markdown-content">${renderMarkdown(aiDraft.description || '')}</div>
        <div class="muted" style="margin-top:8px;">${(aiDraft.questions || []).length} questions</div>
      </div>
    `;
    return;
  }
  
  preview.innerHTML = `
    <div class="card">
      <div class="card-title">Rubric draft</div>
      <ul>
        ${(aiDraft.criteria || []).map(c => `<li>${escapeHtml(c.name || 'Criterion')} (${c.points || 0} pts)</li>`).join('')}
      </ul>
    </div>
  `;
}

function applyAiDraft() {
  if (!aiDraft) {
    showToast('Generate a draft first', 'error');
    return;
  }
  
  if (aiDraftType === 'announcement') {
    ensureModalsRendered();
    document.getElementById('announcementTitle').value = aiDraft.title || '';
    document.getElementById('announcementContent').value = aiDraft.content || '';
    closeModal('aiCreateModal');
    openModal('announcementModal');
    return;
  }
  
  if (aiDraftType === 'quiz') {
    aiQuizDraft = aiDraft;
    closeModal('aiCreateModal');
    openQuizModal();
    return;
  }
  
  const assignmentId = document.getElementById('aiRubricAssignment').value;
  if (!assignmentId) {
    showToast('Select an assignment for the rubric', 'error');
    return;
  }
  aiRubricDraft = { assignmentId, criteria: aiDraft.criteria || [] };
  closeModal('aiCreateModal');
  openRubricModal(assignmentId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════

function ensureModalsRendered() {
  if (!document.getElementById('announcementModal')) {
    generateModals();
  }
}

function openModal(id) {
  if (!document.getElementById(id)) {
    generateModals();
  }
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('visible');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('visible');
  
  if (id === 'quizTakeModal' && quizTimerInterval) {
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;
  }
}

function generateModals() {
  setHTML('modalsContainer', `
    <!-- Announcement Modal -->
    <div class="modal-overlay" id="announcementModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="announcementModalTitle">New Update</h2>
          <button class="modal-close" onclick="closeModal('announcementModal'); resetAnnouncementModal();">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="announcementTitle" placeholder="Enter title">
          </div>
          <div class="form-group">
            <label class="form-label">Content</label>
            <textarea class="form-textarea" id="announcementContent" placeholder="Write your update..."></textarea>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="announcementPinned">
              <span>Pin this update</span>
            </label>
            <div class="hint">Pinned updates appear at the top of the Updates page</div>
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
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Create Course</h2>
          <button class="modal-close" onclick="closeModal('createCourseModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Course Name</label>
            <input type="text" class="form-input" id="courseName" placeholder="e.g., ECON 101 - Introduction to Economics">
          </div>
          <div class="form-group">
            <label class="form-label">Course Code</label>
            <input type="text" class="form-input" id="courseCode" placeholder="e.g., ECON101">
          </div>
          <div class="form-group">
            <label class="form-label">Student Emails (optional)</label>
            <textarea class="form-textarea" id="courseEmails" placeholder="Enter one email per line:
student1@university.edu
student2@university.edu" rows="5"></textarea>
            <div class="hint">Students will be invited to join the course</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('createCourseModal')">Cancel</button>
          <button class="btn btn-primary" onclick="createCourse()">Create</button>
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
            <textarea class="form-textarea" id="assignmentDescription" placeholder="Describe the assignment..."></textarea>
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
            <input type="datetime-local" class="form-input" id="assignmentDueDate">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="assignmentStatus">
              <option value="draft">Draft (not visible to students)</option>
              <option value="published">Published</option>
              <option value="closed">Closed (no new submissions)</option>
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
              <input type="datetime-local" class="form-input" id="quizDueDate">
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" id="quizStatus">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
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
          <h2 class="modal-title">Upload File</h2>
          <button class="modal-close" onclick="closeModal('fileUploadModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Select File</label>
            <input type="file" class="form-input" id="fileUpload">
            <div class="hint">Metadata only stored in this demo. Implement Supabase storage for production.</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('fileUploadModal')">Cancel</button>
          <button class="btn btn-primary" onclick="uploadFile()">Upload</button>
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
          <div class="form-group">
            <label class="form-label">Google Client ID</label>
            <input type="password" class="form-input" id="settingsGoogleClientId" 
                   placeholder="your-client-id.apps.googleusercontent.com" 
                   value="${window.GOOGLE_CLIENT_ID || appData.settings.googleClientId || ''}">
            <div class="hint">
              ${window.GOOGLE_CLIENT_ID ? '✓ Loaded from keys.js (masked for security)' : 'For Google SSO. Get from Google Cloud Console.'}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Gemini API Key</label>
            <input type="password" class="form-input" id="settingsGeminiKey" 
                   placeholder="AIza..." 
                   value="${window.GEMINI || appData.settings.geminiKey || ''}">
            <div class="hint">
              ${window.GEMINI ? '✓ Loaded from keys.js (masked for security)' : 'Get from Google AI Studio. Using Gemini 3.0 Flash Preview.'}
            </div>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="settingsEmailNotifications" ${appData.settings.emailNotifications !== false ? 'checked' : ''}>
              <span>Enable email notifications (simulated in demo)</span>
            </label>
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
            <textarea class="form-textarea" id="startHereContent" rows="4" placeholder="Welcome message..."></textarea>
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

    <div class="modal-overlay" id="notificationsModal">
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <h2 class="modal-title">Notifications</h2>
          <button class="modal-close" onclick="closeModal('notificationsModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div id="notificationsList" class="notification-list"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="markAllNotificationsRead(appData.currentUser?.id); renderNotifications();">Mark all read</button>
          <button class="btn btn-primary" onclick="closeModal('notificationsModal')">Done</button>
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
            <div class="hint">Hold Ctrl (Windows) or ⌘ (Mac) to select multiple items.</div>
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
            <label class="form-label">Email Address</label>
            <input type="email" class="form-input" id="addPersonEmail" placeholder="student@university.edu">
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
            Upload a CSV with columns: Email, Name (optional), Role (optional: student/ta/instructor).
          </div>
          <div class="form-group">
            <label class="form-label">CSV File</label>
            <input type="file" class="form-input" id="bulkStudentFile" accept=".csv,text/csv">
          </div>
          <div class="form-group">
            <label class="form-label">Default Role</label>
            <select class="form-select" id="bulkStudentRole">
              <option value="student" selected>Student</option>
              <option value="ta">Teaching Assistant</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('bulkStudentImportModal')">Cancel</button>
          <button class="btn btn-primary" onclick="processBulkStudentImport()">Import Students</button>
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
  `);
}

function saveSettings() {
  const googleInput = document.getElementById('settingsGoogleClientId').value.trim();
  const geminiInput = document.getElementById('settingsGeminiKey').value.trim();
  
  // Only save if user explicitly entered values (don't overwrite keys.js with empty)
  if (googleInput) {
    appData.settings.googleClientId = googleInput;
  }
  
  if (geminiInput) {
    appData.settings.geminiKey = geminiInput;
  }
  
  appData.settings.emailNotifications = document.getElementById('settingsEmailNotifications').checked;
  
  saveData(appData);
  closeModal('settingsModal');
  showToast('Settings saved! Refresh page to apply Google SSO changes.', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

let currentEditCourseId = null;

function openEditCourseModal(courseId) {
  currentEditCourseId = courseId;
  const course = getCourseById(courseId);
  
  if (!course) return;
  
  // Ensure modals are rendered
  if (!document.getElementById('editCourseModal')) {
    generateModals();
  }
  
  document.getElementById('editCourseName').value = course.name || '';
  document.getElementById('editCourseCode').value = course.code || '';
  document.getElementById('editCourseDescription').value = course.description || '';
  document.getElementById('editCourseUuid').value = course.id;
  
  // Add checkbox for active/inactive status
  const statusCheckbox = document.getElementById('editCourseActive');
  if (statusCheckbox) {
    statusCheckbox.checked = course.active !== false; // default to active
  }
  
  openModal('editCourseModal');
}

function updateCourse() {
  if (!currentEditCourseId) return;
  
  const course = getCourseById(currentEditCourseId);
  if (!course) return;
  
  course.name = document.getElementById('editCourseName').value.trim();
  course.code = document.getElementById('editCourseCode').value.trim();
  course.description = document.getElementById('editCourseDescription').value.trim();
  course.active = document.getElementById('editCourseActive').checked;
  
  if (!course.name || !course.code) {
    showToast('Please fill in course name and code', 'error');
    return;
  }
  
  saveData(appData);
  closeModal('editCourseModal');
  renderAll();
  showToast('Course updated', 'success');
}

function openImportContentModal() {
  ensureModalsRendered();
  const courses = getUserCourses(appData.currentUser.id).filter(c => c.role === 'instructor' && c.id !== activeCourseId);
  const options = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const select = document.getElementById('importSourceCourse');
  if (select) {
    select.innerHTML = '<option value="">-- Select a course --</option>' + options;
  }
  openModal('importContentModal');
}

function executeImportContent() {
  const sourceCourseId = document.getElementById('importSourceCourse').value;
  const typesSelect = document.getElementById('importContentTypes');
  const selectedTypes = typesSelect ? Array.from(typesSelect.selectedOptions).map(opt => opt.value) : [];

  if (!sourceCourseId) {
    showToast('Please select a source course', 'error');
    return;
  }

  if (!activeCourseId) {
    showToast('No active course', 'error');
    return;
  }

  if (selectedTypes.length === 0) {
    showToast('Select at least one content type to import', 'error');
    return;
  }

  let importedCount = 0;

  if (selectedTypes.includes('assignments')) {
    const assignments = appData.assignments.filter(a => a.courseId === sourceCourseId);
    assignments.forEach(assignment => {
      const newAssignment = {
        ...assignment,
        id: generateId(),
        courseId: activeCourseId,
        status: 'draft',
        createdAt: new Date().toISOString()
      };
      appData.assignments.push(newAssignment);
      importedCount++;
    });
  }

  if (selectedTypes.includes('quizzes')) {
    const quizzes = appData.quizzes.filter(q => q.courseId === sourceCourseId);
    quizzes.forEach(quiz => {
      appData.quizzes.push({
        ...quiz,
        id: generateId(),
        courseId: activeCourseId,
        status: 'draft',
        createdAt: new Date().toISOString(),
        questions: (quiz.questions || []).map(q => ({
          ...q,
          id: generateId()
        }))
      });
      importedCount++;
    });
  }

  if (selectedTypes.includes('announcements')) {
    const announcements = appData.announcements.filter(a => a.courseId === sourceCourseId);
    announcements.forEach(announcement => {
      appData.announcements.push({
        ...announcement,
        id: generateId(),
        courseId: activeCourseId,
        authorId: appData.currentUser.id,
        createdAt: new Date().toISOString(),
        pinned: false
      });
      importedCount++;
    });
  }

  if (selectedTypes.includes('files')) {
    const files = appData.files.filter(f => f.courseId === sourceCourseId);
    files.forEach(file => {
      appData.files.push({
        ...file,
        id: generateId(),
        courseId: activeCourseId,
        uploadedBy: appData.currentUser.id,
        uploadedAt: new Date().toISOString()
      });
      importedCount++;
    });
  }

  if (selectedTypes.includes('categoryWeights') && appData.gradeCategories) {
    const weights = appData.gradeCategories.filter(w => w.courseId === sourceCourseId);
    appData.gradeCategories = appData.gradeCategories.filter(w => w.courseId !== activeCourseId);
    weights.forEach(weight => {
      appData.gradeCategories.push({
        ...weight,
        courseId: activeCourseId
      });
    });
    importedCount += weights.length;
  }

  saveData(appData);
  closeModal('importContentModal');
  renderAll();
  showToast(`Imported ${importedCount} items`, 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM CONFIRMATION DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function openAddPersonModal() {
  ensureModalsRendered();
  document.getElementById('addPersonEmail').value = '';
  document.getElementById('addPersonRole').value = 'student';
  openModal('addPersonModal');
}

function openBulkStudentImportModal() {
  ensureModalsRendered();
  const fileInput = document.getElementById('bulkStudentFile');
  if (fileInput) fileInput.value = '';
  const roleSelect = document.getElementById('bulkStudentRole');
  if (roleSelect) roleSelect.value = 'student';
  openModal('bulkStudentImportModal');
}

function processBulkStudentImport() {
  const fileInput = document.getElementById('bulkStudentFile');
  const defaultRole = document.getElementById('bulkStudentRole').value;

  if (!activeCourseId) {
    showToast('No active course', 'error');
    return;
  }

  if (!fileInput || !fileInput.files[0]) {
    showToast('Please upload a CSV file', 'error');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function(event) {
    const text = event.target.result;
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    if (!lines.length) {
      showToast('CSV file is empty', 'error');
      return;
    }

    let added = 0;
    let invited = 0;
    let errors = 0;

    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes('email')) {
        return;
      }

      const parts = line.split(',').map(part => part.trim());
      const email = parts[0];
      const name = parts[1] || '';
      const roleRaw = parts[2] || '';
      const role = ['student', 'ta', 'instructor'].includes(roleRaw.toLowerCase())
        ? roleRaw.toLowerCase()
        : defaultRole;

      if (!email || !email.includes('@')) {
        errors += 1;
        return;
      }

      let user = appData.users.find(u => u.email === email);
      if (user) {
        const existing = appData.enrollments.find(e => e.userId === user.id && e.courseId === activeCourseId);
        if (existing) {
          existing.role = role;
        } else {
          appData.enrollments.push({
            userId: user.id,
            courseId: activeCourseId,
            role: role
          });
        }
        added += 1;
        return;
      }

      if (!appData.invites) appData.invites = [];
      appData.invites.push({
        courseId: activeCourseId,
        email: email,
        role: role,
        status: 'pending',
        sentAt: new Date().toISOString(),
        name: name || undefined
      });
      invited += 1;
    });

    saveData(appData);
    closeModal('bulkStudentImportModal');
    renderPeople();
    showToast(`Imported ${added} students, invited ${invited}. ${errors} errors.`, errors ? 'error' : 'success');
  };

  reader.onerror = function() {
    showToast('Failed to read CSV file', 'error');
  };

  reader.readAsText(file);
}

function addPersonToCourse() {
  const email = document.getElementById('addPersonEmail').value.trim();
  const role = document.getElementById('addPersonRole').value;
  
  if (!email) {
    showToast('Please enter an email address', 'error');
    return;
  }
  
  if (!activeCourseId) {
    showToast('No active course', 'error');
    return;
  }
  
  // Check if user exists
  let user = appData.users.find(u => u.email === email);
  
  if (user) {
    // User exists - check if already enrolled
    const existing = appData.enrollments.find(e => e.userId === user.id && e.courseId === activeCourseId);
    if (existing) {
      // Update role
      existing.role = role;
      showToast(`Updated ${user.name}'s role to ${role}`, 'success');
    } else {
      // Add enrollment
      appData.enrollments.push({
        userId: user.id,
        courseId: activeCourseId,
        role: role
      });
      showToast(`Added ${user.name} as ${role}`, 'success');
    }
  } else {
    // User doesn't exist - create invite
    if (!appData.invites) appData.invites = [];
    
    appData.invites.push({
      courseId: activeCourseId,
      email: email,
      role: role,
      status: 'pending',
      sentAt: new Date().toISOString()
    });
    
    showToast(`Invitation sent to ${email}`, 'success');
  }
  
  saveData(appData);
  closeModal('addPersonModal');
  renderPeople();
}

function removePersonFromCourse(userId, courseId) {
  const user = getUserById(userId);
  
  // Ensure modals exist before calling confirm
  if (!document.getElementById('confirmModal')) {
    generateModals();
  }
  
  confirm(`Remove ${user.name} from this course?`, () => {
    appData.enrollments = appData.enrollments.filter(e => !(e.userId === userId && e.courseId === courseId));
    saveData(appData);
    renderPeople();
    showToast(`Removed ${user.name}`, 'success');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM CONFIRMATION DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function confirm(message, callback) {
  generateModals(); // Ensure modals are rendered
  document.getElementById('confirmTitle').textContent = 'Confirm Action';
  document.getElementById('confirmMessage').textContent = message;
  
  const confirmBtn = document.getElementById('confirmButton');
  
  // Remove old event listeners by cloning
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  
  newConfirmBtn.addEventListener('click', () => {
    closeModal('confirmModal');
    if (callback) callback();
  });
  
  openModal('confirmModal');
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUBRICS
// ═══════════════════════════════════════════════════════════════════════════════

let currentRubricAssignment = null;
let rubricCriteria = [];

function openRubricModal(assignmentId) {
  ensureModalsRendered();
  currentRubricAssignment = assignmentId;
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  
  if (!assignment) return;
  
  // Check if assignment already has a rubric
  const existingRubric = appData.rubrics?.find(r => r.assignmentId === assignmentId);
  
  if (aiRubricDraft && aiRubricDraft.assignmentId === assignmentId && aiRubricDraft.criteria?.length) {
    rubricCriteria = JSON.parse(JSON.stringify(aiRubricDraft.criteria));
    aiRubricDraft = null;
  } else if (existingRubric) {
    rubricCriteria = JSON.parse(JSON.stringify(existingRubric.criteria)); // Deep copy
  } else {
    rubricCriteria = [
      { name: 'Criterion 1', points: assignment.points / 4, description: '' }
    ];
  }
  
  document.getElementById('rubricMaxPoints').textContent = assignment.points;
  renderRubricCriteria();
  openModal('rubricModal');
}

function renderRubricCriteria() {
  let html = '';
  let totalPoints = 0;
  
  rubricCriteria.forEach((criterion, index) => {
    totalPoints += parseFloat(criterion.points) || 0;
    
    html += `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <input type="text" class="form-input" value="${criterion.name}" 
                 onchange="updateRubricCriterion(${index}, 'name', this.value)" 
                 placeholder="Criterion name" style="flex:1; margin-right:8px;">
          <input type="number" class="form-input" value="${criterion.points}" 
                 onchange="updateRubricCriterion(${index}, 'points', this.value)" 
                 placeholder="Points" style="width:80px; margin-right:8px;">
          <button class="btn btn-secondary btn-sm" onclick="removeRubricCriterion(${index})" style="padding:8px;">✕</button>
        </div>
        <textarea class="form-textarea" rows="2" 
                  onchange="updateRubricCriterion(${index}, 'description', this.value)"
                  placeholder="Description (optional)">${criterion.description || ''}</textarea>
      </div>
    `;
  });
  
  document.getElementById('rubricCriteriaList').innerHTML = html;
  document.getElementById('rubricTotalPoints').textContent = totalPoints.toFixed(1);
  
  // Color code total
  const maxPoints = parseFloat(document.getElementById('rubricMaxPoints').textContent);
  const totalEl = document.getElementById('rubricTotalPoints');
  if (Math.abs(totalPoints - maxPoints) < 0.1) {
    totalEl.style.color = 'var(--success)';
  } else {
    totalEl.style.color = 'var(--danger)';
  }
}

function addRubricCriterion() {
  rubricCriteria.push({
    name: `Criterion ${rubricCriteria.length + 1}`,
    points: 0,
    description: ''
  });
  renderRubricCriteria();
}

function removeRubricCriterion(index) {
  rubricCriteria.splice(index, 1);
  renderRubricCriteria();
}

function updateRubricCriterion(index, field, value) {
  if (field === 'points') {
    rubricCriteria[index][field] = parseFloat(value) || 0;
  } else {
    rubricCriteria[index][field] = value;
  }
  renderRubricCriteria();
}

function saveRubric() {
  if (!currentRubricAssignment) return;
  
  const assignment = appData.assignments.find(a => a.id === currentRubricAssignment);
  const totalPoints = rubricCriteria.reduce((sum, c) => sum + (parseFloat(c.points) || 0), 0);
  
  if (Math.abs(totalPoints - assignment.points) > 0.1) {
    showToast('Rubric points must equal assignment points', 'error');
    return;
  }
  
  if (!appData.rubrics) appData.rubrics = [];
  
  // Remove existing rubric for this assignment
  appData.rubrics = appData.rubrics.filter(r => r.assignmentId !== currentRubricAssignment);
  
  // Add new rubric
  const rubricId = generateId();
  appData.rubrics.push({
    id: rubricId,
    assignmentId: currentRubricAssignment,
    criteria: JSON.parse(JSON.stringify(rubricCriteria)) // Deep copy
  });
  
  // Update assignment to reference rubric
  assignment.rubric = rubricId;
  
  saveData(appData);
  closeModal('rubricModal');
  renderAssignments();
  showToast('Rubric saved', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEIGHTED GRADE CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

function openCategoryWeightsModal() {
  ensureModalsRendered();
  if (!appData.gradeCategories) appData.gradeCategories = [];
  
  const courseCategories = appData.gradeCategories.filter(c => c.courseId === activeCourseId);
  const existingCategories = new Set(courseCategories.map(c => c.name));
  
  // Get all unique categories used in assignments
  const allCategories = [...new Set(
    appData.assignments
      .filter(a => a.courseId === activeCourseId)
      .map(a => a.category)
  )];
  
  // Create category inputs
  let html = '';
  allCategories.forEach(category => {
    const existing = courseCategories.find(c => c.name === category);
    const weight = existing ? existing.weight * 100 : 0;
    
    html += `
      <div class="form-group">
        <label class="form-label">${category.charAt(0).toUpperCase() + category.slice(1)}</label>
        <input type="number" class="form-input category-weight" data-category="${category}" value="${weight}" min="0" max="100" step="1">
      </div>
    `;
  });
  
  setHTML('categoryWeightsList', html);
  
  // Update total when inputs change
  document.querySelectorAll('.category-weight').forEach(input => {
    input.addEventListener('input', updateTotalWeight);
  });
  
  updateTotalWeight();
  openModal('categoryWeightsModal');
}

function updateTotalWeight() {
  const inputs = document.querySelectorAll('.category-weight');
  let total = 0;
  inputs.forEach(input => {
    total += parseFloat(input.value) || 0;
  });
  document.getElementById('totalWeight').textContent = total.toFixed(1);
  
  // Color code the total
  const totalEl = document.getElementById('totalWeight');
  if (Math.abs(total - 100) < 0.1) {
    totalEl.style.color = 'var(--success)';
  } else {
    totalEl.style.color = 'var(--danger)';
  }
}

function saveCategoryWeights() {
  const inputs = document.querySelectorAll('.category-weight');
  let total = 0;
  
  const weights = [];
  inputs.forEach(input => {
    const weight = parseFloat(input.value) || 0;
    total += weight;
    weights.push({
      courseId: activeCourseId,
      name: input.dataset.category,
      weight: weight / 100
    });
  });
  
  if (Math.abs(total - 100) > 0.1) {
    showToast('Weights must add up to 100%', 'error');
    return;
  }
  
  // Remove old weights for this course
  appData.gradeCategories = appData.gradeCategories.filter(c => c.courseId !== activeCourseId);
  
  // Add new weights
  appData.gradeCategories.push(...weights);
  
  saveData(appData);
  closeModal('categoryWeightsModal');
  renderGradebook();
  showToast('Category weights saved', 'success');
}

function calculateWeightedGrade(userId, courseId) {
  if (!appData.gradeCategories) return null;
  
  const categoryWeights = appData.gradeCategories.filter(c => c.courseId === courseId);
  if (categoryWeights.length === 0) return null;
  
  const assignments = appData.assignments.filter(a => a.courseId === courseId);
  const categoryScores = {};
  
  // Calculate score for each category
  categoryWeights.forEach(cw => {
    const categoryAssignments = assignments.filter(a => a.category === cw.name);
    let totalScore = 0;
    let totalPoints = 0;
    
    categoryAssignments.forEach(assignment => {
      const submission = appData.submissions.find(s => s.assignmentId === assignment.id && s.userId === userId);
      const grade = submission ? appData.grades.find(g => g.submissionId === submission.id) : null;
      
      if (grade && grade.released) {
        totalScore += grade.score;
        totalPoints += assignment.points;
      }
    });
    
    if (totalPoints > 0) {
      categoryScores[cw.name] = {
        percentage: (totalScore / totalPoints) * 100,
        weight: cw.weight
      };
    }
  });
  
  // Calculate weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  
  Object.values(categoryScores).forEach(cs => {
    weightedSum += cs.percentage * cs.weight;
    totalWeight += cs.weight;
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK OPERATIONS & ADVANCED FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

let currentBulkAssignmentId = null;

function openBulkGradeModal(assignmentId) {
  ensureModalsRendered();
  currentBulkAssignmentId = assignmentId;
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  document.getElementById('bulkGradeTitle').textContent = `Bulk Grade: ${assignment.title}`;
  openModal('bulkGradeModal');
}

function processBulkGrades() {
  const data = document.getElementById('bulkGradeData').value.trim();
  const release = document.getElementById('bulkGradeRelease').checked;
  
  if (!data) {
    showToast('Please paste grade data', 'error');
    return;
  }
  
  const lines = data.split('\n').filter(l => l.trim());
  let imported = 0;
  let errors = 0;
  
  lines.forEach(line => {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 2) {
      errors++;
      return;
    }
    
    const email = parts[0];
    const score = parseFloat(parts[1]);
    const feedback = parts[2] || 'No feedback provided';
    
    if (isNaN(score)) {
      errors++;
      return;
    }
    
    // Find user
    const user = appData.users.find(u => u.email === email);
    if (!user) {
      errors++;
      return;
    }
    
    // Find submission
    const submission = appData.submissions.find(s => 
      s.assignmentId === currentBulkAssignmentId && s.userId === user.id
    );
    
    if (!submission) {
      errors++;
      return;
    }
    
    // Remove existing grade
    appData.grades = appData.grades.filter(g => g.submissionId !== submission.id);
    
    // Add new grade
    appData.grades.push({
      submissionId: submission.id,
      score: score,
      feedback: feedback,
      released: release,
      gradedBy: appData.currentUser.id,
      gradedAt: new Date().toISOString()
    });
    
    // Notify if released
    if (release) {
      addNotification(user.id, 'grade', 'Grade Released',
        `Your grade for ${appData.assignments.find(a => a.id === currentBulkAssignmentId).title} is now available`,
        appData.assignments.find(a => a.id === currentBulkAssignmentId).courseId
      );
    }
    
    imported++;
  });
  
  saveData(appData);
  closeModal('bulkGradeModal');
  renderGradebook();
  showToast(`Imported ${imported} grades. ${errors} errors.`, imported > 0 ? 'success' : 'error');
  
  document.getElementById('bulkGradeData').value = '';
  document.getElementById('bulkGradeRelease').checked = false;
}

function bulkReleaseGrades(assignmentId) {
  confirm('Release all grades for this assignment to students?', () => {
    const submissions = appData.submissions.filter(s => s.assignmentId === assignmentId);
    let released = 0;
    
    submissions.forEach(submission => {
      const grade = appData.grades.find(g => g.submissionId === submission.id);
      if (grade && !grade.released) {
        grade.released = true;
        released++;
        
        // Notify student
        const assignment = appData.assignments.find(a => a.id === assignmentId);
        addNotification(submission.userId, 'grade', 'Grade Released',
          `Your grade for ${assignment.title} is now available`,
          assignment.courseId
        );
      }
    });
    
    saveData(appData);
    renderGradebook();
    showToast(`Released ${released} grades`, 'success');
  });
}

function viewSubmissionHistory(assignmentId, userId) {
  const submissions = appData.submissions
    .filter(s => s.assignmentId === assignmentId && s.userId === userId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  
  const assignment = appData.assignments.find(a => a.id === assignmentId);
  const student = getUserById(userId);
  
  const html = `
    <div class="modal-overlay visible" id="submissionHistoryModal">
      <div class="modal" style="max-width:700px;">
        <div class="modal-header">
          <h2 class="modal-title">Submission History: ${student.name}</h2>
          <button class="modal-close" onclick="closeModal('submissionHistoryModal')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="muted" style="margin-bottom:16px;">Assignment: ${assignment.title}</div>
          ${submissions.length === 0 ? '<div class="empty-state-text">No submissions yet</div>' : submissions.map((s, idx) => {
            const grade = appData.grades.find(g => g.submissionId === s.id);
            return `
              <div class="card" style="background:${idx === 0 ? 'var(--primary-light)' : 'var(--bg-color)'};">
                <div class="card-header">
                  <div>
                    <div class="card-title">${idx === 0 ? '📌 Current Submission' : `Submission ${submissions.length - idx}`}</div>
                    <div class="muted">Submitted ${formatDate(s.submittedAt)}</div>
                  </div>
                  ${grade ? `<span class="muted">${grade.score}/${assignment.points}</span>` : ''}
                </div>
                <div>${s.text || '<em class="muted">No text submission</em>'}</div>
                ${s.fileName ? `<div class="muted" style="margin-top:8px;">📎 ${s.fileName}</div>` : ''}
                ${grade && grade.feedback ? `<div style="margin-top:12px; padding:12px; background:var(--bg-card); border-radius:var(--radius);"><strong>Feedback:</strong> ${grade.feedback}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('submissionHistoryModal')">Close</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML += html;
}

function calculateLateDeduction(assignment, submittedAt) {
  if (!assignment.allowLateSubmissions) return 0;
  if (!assignment.lateDeduction) return 0;
  
  const dueDate = new Date(assignment.dueDate);
  const submitDate = new Date(submittedAt);
  
  if (submitDate <= dueDate) return 0;
  
  const daysLate = Math.ceil((submitDate - dueDate) / 86400000);
  const deduction = Math.min(daysLate * assignment.lateDeduction, 100);
  
  return deduction;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // ESC closes modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.visible').forEach(m => m.classList.remove('visible'));
      if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
      }
    }
    
    // Ctrl/Cmd+Enter sends AI message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (document.activeElement?.id === 'aiInput') {
        sendAiMessage();
      }
    }
  });
});
