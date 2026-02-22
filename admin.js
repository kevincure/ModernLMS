/* ═══════════════════════════════════════════════════════════════════════════
   Admin Backend — AllDayLMS
   Entry point: admin.html?org=1

   Security model
   ──────────────
   PRIMARY:   Supabase Row-Level Security (RLS) enforces superadmin role at
              the database layer. A crafted API call still cannot read or
              write data it shouldn't — the server rejects it.

   SECONDARY: This client-side verification is defense-in-depth.
              We sign out immediately if the role check fails and we never
              render admin UI before confirmation from the server.

   XSS:       All user-supplied strings are passed through escHtml() before
              being placed in innerHTML. DOM construction via textContent is
              preferred where possible.

   CSRF:      Supabase uses short-lived JWTs in Authorization headers, not
              cookies, so CSRF does not apply.

   Audit:     Every mutation is recorded in admin_audit_log via auditLog().
              RLS blocks UPDATE/DELETE on that table — the log is immutable.

   Redirect:  The OAuth redirectTo URL is always window.location.origin +
              '/admin.html', never a user-supplied URL.
═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── State ───────────────────────────────────────────────────────────────────

const admin = {
  sb:          null,   // Supabase client
  user:        null,   // auth.users row (from Supabase Auth)
  org:         null,   // orgs row for this admin session
  orgMembers:  [],     // { id, user_id, role, profile: { id, email, name } }[]
  orgCourses:  [],     // courses rows with creator profile joined
  enrollments: [],     // enrollments for all org courses
  activeSec:   'users'
};

// ─── Bootstrap ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initAdminApp);

async function initAdminApp() {
  // 1. Validate config.js is filled in
  if (!window.SUPABASE_URL || window.SUPABASE_URL.startsWith('YOUR_')) {
    showScreen('error', 'Supabase is not configured. Please update config.js.');
    return;
  }

  // 2. Resolve org ID from URL param (?org=1) or from sessionStorage
  //    (sessionStorage holds it after an OAuth redirect that strips the query)
  const urlParams    = new URLSearchParams(window.location.search);
  const orgNumericId = urlParams.get('org') || sessionStorage.getItem('admin_org_id');

  if (!orgNumericId || isNaN(parseInt(orgNumericId, 10))) {
    showScreen('error', 'Missing org parameter. Open this page as /admin.html?org=1');
    return;
  }

  // Persist so it survives the OAuth redirect
  sessionStorage.setItem('admin_org_id', orgNumericId);

  // Show org label on the login card
  const orgLabel = document.getElementById('loginOrgLabel');
  if (orgLabel) orgLabel.textContent = `Organization #${escHtml(orgNumericId)}`;

  // 3. Create Supabase client
  admin.sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  // 4. React to auth state (fires immediately with INITIAL_SESSION)
  admin.sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') {
      if (session?.user) {
        await verifyAndLoad(session.user);
      } else {
        showScreen('login');
      }
    } else if (event === 'SIGNED_IN' && session?.user && !admin.user) {
      // Handles the callback after Google OAuth redirect
      await verifyAndLoad(session.user);
    } else if (event === 'SIGNED_OUT') {
      admin.user = null;
      admin.org  = null;
      showScreen('login');
    }
    // TOKEN_REFRESHED: existing user already verified — no action needed
  });
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

async function adminSignInWithGoogle() {
  const btn = document.getElementById('adminSignInBtn');
  btn.disabled = true;
  document.getElementById('adminLoginLoading').style.display = 'block';
  hideLoginError();

  const { error } = await admin.sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Must be added to Supabase → Auth → URL Configuration → Redirect URLs
      redirectTo: window.location.origin + '/admin.html'
    }
  });

  if (error) {
    btn.disabled = false;
    document.getElementById('adminLoginLoading').style.display = 'none';
    showLoginError(error.message);
  }
  // On success the page navigates away to Google — no further code runs here.
}

// ─── Superadmin Verification ──────────────────────────────────────────────────

async function verifyAndLoad(user) {
  showScreen('loading');

  const orgNumericId = sessionStorage.getItem('admin_org_id');

  // 1. Look up the org by its URL-friendly numeric_id
  const { data: org, error: orgErr } = await admin.sb
    .from('orgs')
    .select('id, name, numeric_id, type, status')
    .eq('numeric_id', parseInt(orgNumericId, 10))
    .maybeSingle();

  if (orgErr || !org) {
    await admin.sb.auth.signOut();
    showScreen('error', `Organization #${escHtml(orgNumericId)} not found. Check your database setup.`);
    return;
  }

  // 2. Verify superadmin status.
  //    The RLS policy on org_members requires the caller to be a superadmin
  //    to read rows WHERE org_id = org.id.  If they're not, the query returns
  //    zero rows (empty data, no error) — we treat that as denied.
  const { data: membership, error: memErr } = await admin.sb
    .from('org_members')
    .select('id, role')
    .eq('org_id',  org.id)
    .eq('user_id', user.id)
    .eq('role', 'superadmin')
    .maybeSingle();

  if (memErr || !membership) {
    await admin.sb.auth.signOut();
    showScreen('denied',
      `${user.email} does not have superadmin access to "${org.name}" (org #${orgNumericId}).`
    );
    return;
  }

  // 3. Access confirmed — populate state
  admin.user = user;
  admin.org  = org;

  // Update top bar
  const orgTitle = document.getElementById('adminOrgTitle');
  if (orgTitle) orgTitle.textContent = `Admin — ${org.name}`;
  const userEmail = document.getElementById('adminUserEmail');
  if (userEmail) userEmail.textContent = user.email;

  // 4. Load data then show the dashboard
  await loadAdminData();
  renderCurrentSection();
  showScreen('app');
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadAdminData() {
  await Promise.all([
    loadOrgMembers(),
    loadOrgCourses()
  ]);
  await loadEnrollments(); // depends on orgCourses being loaded first
}

async function loadOrgMembers() {
  // Load membership rows
  const { data: memberships, error } = await admin.sb
    .from('org_members')
    .select('id, user_id, role, created_at')
    .eq('org_id', admin.org.id)
    .order('created_at', { ascending: true });

  if (error) { console.error('[Admin] loadOrgMembers:', error); return; }

  if (!memberships || memberships.length === 0) {
    admin.orgMembers = [];
    return;
  }

  // Fetch matching profiles
  const userIds = [...new Set(memberships.map(m => m.user_id))];
  const { data: profiles } = await admin.sb
    .from('profiles')
    .select('id, email, name')
    .in('id', userIds);

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  admin.orgMembers = memberships.map(m => ({
    ...m,
    profile: profileMap[m.user_id] || { id: m.user_id, email: '(unknown)', name: '' }
  }));
}

async function loadOrgCourses() {
  const { data: courses, error } = await admin.sb
    .from('courses')
    .select('id, name, code, description, active, created_at, created_by')
    .eq('org_id', admin.org.id)
    .order('created_at', { ascending: false });

  if (error) { console.error('[Admin] loadOrgCourses:', error); return; }

  if (!courses || courses.length === 0) {
    admin.orgCourses = [];
    return;
  }

  // Join creator profiles
  const creatorIds = [...new Set(courses.filter(c => c.created_by).map(c => c.created_by))];
  let creatorMap = {};
  if (creatorIds.length > 0) {
    const { data: creators } = await admin.sb
      .from('profiles')
      .select('id, email, name')
      .in('id', creatorIds);
    creatorMap = Object.fromEntries((creators || []).map(p => [p.id, p]));
  }

  admin.orgCourses = courses.map(c => ({
    ...c,
    creator: creatorMap[c.created_by] || null
  }));
}

async function loadEnrollments() {
  if (admin.orgCourses.length === 0) { admin.enrollments = []; return; }

  const courseIds = admin.orgCourses.map(c => c.id);
  const { data: enrollments, error } = await admin.sb
    .from('enrollments')
    .select('id, course_id, user_id, role, enrolled_at')
    .in('course_id', courseIds)
    .order('enrolled_at', { ascending: false });

  if (error) { console.error('[Admin] loadEnrollments:', error); return; }

  if (!enrollments || enrollments.length === 0) {
    admin.enrollments = [];
    return;
  }

  // Join user profiles
  const userIds = [...new Set(enrollments.map(e => e.user_id))];
  const { data: profiles } = await admin.sb
    .from('profiles')
    .select('id, email, name')
    .in('id', userIds);
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  admin.enrollments = enrollments.map(e => ({
    ...e,
    profile: profileMap[e.user_id] || { id: e.user_id, email: '(unknown)', name: '' },
    course:  admin.orgCourses.find(c => c.id === e.course_id) || null
  }));
}

async function loadAuditLog() {
  const { data: rows, error } = await admin.sb
    .from('admin_audit_log')
    .select('id, action, target_type, target_id, details, created_at, actor_user_id')
    .eq('org_id', admin.org.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) { console.error('[Admin] loadAuditLog:', error); return []; }

  // Join actor profiles
  if (!rows || rows.length === 0) return [];
  const actorIds = [...new Set(rows.map(r => r.actor_user_id))];
  const { data: actors } = await admin.sb
    .from('profiles')
    .select('id, email, name')
    .in('id', actorIds);
  const actorMap = Object.fromEntries((actors || []).map(p => [p.id, p]));

  return rows.map(r => ({
    ...r,
    actor: actorMap[r.actor_user_id] || { email: r.actor_user_id }
  }));
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function adminNav(section) {
  admin.activeSec = section;

  // Update toolbar buttons
  document.querySelectorAll('#adminToolbar .tool-btn[data-section]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  // Update subtitle
  const subtitleMap = {
    users:       'Members',
    courses:     'Courses',
    enrollments: 'Enrollments',
    audit:       'Audit Log'
  };
  const sub = document.getElementById('adminSectionSubtitle');
  if (sub) sub.textContent = subtitleMap[section] || section;

  // Show/hide sections
  document.querySelectorAll('.admin-section').forEach(el => {
    el.style.display = el.id === `section-${section}` ? '' : 'none';
  });

  // Lazy-render the newly visible section
  renderCurrentSection();
}

function renderCurrentSection() {
  switch (admin.activeSec) {
    case 'users':       renderUsersSection();       break;
    case 'courses':     renderCoursesSection();     break;
    case 'enrollments': renderEnrollmentsSection(); break;
    case 'audit':       renderAuditSection();       break;
  }
}

// ─── Rendering: Members ───────────────────────────────────────────────────────

function renderUsersSection() {
  const wrap = document.getElementById('usersTableWrap');
  if (!wrap) return;

  if (admin.orgMembers.length === 0) {
    wrap.innerHTML = `<div class="admin-empty">No members yet. Click <strong>+ Add Member</strong> to add the first one.</div>`;
    return;
  }

  const rows = admin.orgMembers.map(m => {
    const isSelf = m.user_id === admin.user.id;
    return `
      <tr>
        <td style="font-weight:500;">${escHtml(m.profile.name || '—')}</td>
        <td>${escHtml(m.profile.email)}</td>
        <td><span class="role-badge role-${escHtml(m.role)}">${escHtml(m.role)}</span></td>
        <td>${formatDate(m.created_at)}</td>
        <td style="text-align:right; white-space:nowrap;">
          ${isSelf ? '<span class="muted" style="font-size:0.8rem;">(you)</span>' : `
            <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.8rem;"
              onclick="openChangeRoleModal('${escHtml(m.id)}', '${escHtml(m.profile.email)}', '${escHtml(m.role)}')">
              Change Role
            </button>
            <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.8rem; margin-left:4px; color:var(--danger);"
              onclick="removeMember('${escHtml(m.id)}', '${escHtml(m.profile.email)}')">
              Remove
            </button>
          `}
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Role</th><th>Added</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── Rendering: Courses ───────────────────────────────────────────────────────

function renderCoursesSection() {
  const wrap = document.getElementById('coursesTableWrap');
  if (!wrap) return;

  if (admin.orgCourses.length === 0) {
    wrap.innerHTML = `<div class="admin-empty">No courses yet. Click <strong>+ Create Course</strong> to create the first one.</div>`;
    return;
  }

  const rows = admin.orgCourses.map(c => {
    const enrollCount = admin.enrollments.filter(e => e.course_id === c.id).length;
    const instructors = admin.enrollments
      .filter(e => e.course_id === c.id && e.role === 'instructor')
      .map(e => escHtml(e.profile.email))
      .join(', ') || '—';

    return `
      <tr>
        <td style="font-weight:500;">${escHtml(c.name)}</td>
        <td class="muted">${escHtml(c.code || '—')}</td>
        <td>${instructors}</td>
        <td style="text-align:center;">${enrollCount}</td>
        <td>${formatDate(c.created_at)}</td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Course Name</th><th>Code</th><th>Instructor(s)</th>
            <th style="text-align:center;">Enrolled</th><th>Created</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── Rendering: Enrollments ───────────────────────────────────────────────────

function renderEnrollmentsSection() {
  const wrap = document.getElementById('enrollmentsWrap');
  if (!wrap) return;

  if (admin.orgCourses.length === 0) {
    wrap.innerHTML = `<div class="admin-empty">No courses yet. Create a course first.</div>`;
    return;
  }

  if (admin.enrollments.length === 0) {
    wrap.innerHTML = `
      <div class="admin-empty">No enrollments yet. Click <strong>+ Enroll User</strong> to add someone to a course.</div>`;
    return;
  }

  // Group enrollments by course
  const byCourse = {};
  for (const e of admin.enrollments) {
    const cid = e.course_id;
    if (!byCourse[cid]) byCourse[cid] = { course: e.course, entries: [] };
    byCourse[cid].entries.push(e);
  }

  const blocks = Object.values(byCourse).map(({ course, entries }) => {
    const rows = entries.map(e => `
      <tr>
        <td style="font-weight:500;">${escHtml(e.profile.name || '—')}</td>
        <td>${escHtml(e.profile.email)}</td>
        <td><span class="role-badge role-enroll-${escHtml(e.role)}">${escHtml(e.role)}</span></td>
        <td>${formatDate(e.enrolled_at)}</td>
        <td style="text-align:right;">
          <button class="btn btn-secondary"
            style="padding:4px 10px; font-size:0.8rem; color:var(--danger);"
            onclick="removeEnrollment('${escHtml(e.id)}', '${escHtml(e.profile.email)}', '${escHtml(course?.name || '')}')">
            Remove
          </button>
        </td>
      </tr>`).join('');

    return `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <div class="card-title">${escHtml(course?.name || 'Unknown Course')}</div>
          ${course?.code ? `<span class="muted" style="font-size:0.8rem;">${escHtml(course.code)}</span>` : ''}
        </div>
        <div class="admin-table-wrap" style="margin-top:0;">
          <table class="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Enrolled</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  wrap.innerHTML = blocks;
}

// ─── Rendering: Audit Log ─────────────────────────────────────────────────────

async function renderAuditSection() {
  const wrap = document.getElementById('auditTableWrap');
  if (!wrap) return;
  wrap.innerHTML = `<div class="muted" style="padding:12px 0;">Loading…</div>`;

  const rows = await loadAuditLog();

  if (rows.length === 0) {
    wrap.innerHTML = `<div class="admin-empty">No audit log entries yet.</div>`;
    return;
  }

  const tableRows = rows.map(r => {
    const details = r.details ? JSON.stringify(r.details) : '—';
    return `
      <tr>
        <td>${formatDatetime(r.created_at)}</td>
        <td>${escHtml(r.actor?.email || '—')}</td>
        <td><code style="font-size:0.8rem;">${escHtml(r.action)}</code></td>
        <td class="muted">${escHtml(r.target_type || '—')}</td>
        <td class="muted" style="font-size:0.78rem; max-width:260px; overflow:hidden; text-overflow:ellipsis;">${escHtml(details)}</td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target Type</th><th>Details</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
}

// ─── CRUD: Add Member ─────────────────────────────────────────────────────────

function openAddUserModal() {
  document.getElementById('addUserEmail').value = '';
  document.getElementById('addUserRole').value  = 'member';
  hideInlineError('addUserError');
  openModal('modal-addUser');
  setTimeout(() => document.getElementById('addUserEmail')?.focus(), 80);
}

async function addUserToOrg() {
  const email = document.getElementById('addUserEmail').value.trim().toLowerCase();
  const role  = document.getElementById('addUserRole').value;

  hideInlineError('addUserError');

  if (!email) { showInlineError('addUserError', 'Email is required.'); return; }
  if (!isValidEmail(email)) { showInlineError('addUserError', 'Enter a valid email address.'); return; }

  setSubmitLoading('addUserSubmitBtn', true);

  // Look up the profile by email
  const { data: profiles, error: profileErr } = await admin.sb
    .from('profiles')
    .select('id, email, name')
    .eq('email', email)
    .limit(1);

  if (profileErr || !profiles || profiles.length === 0) {
    setSubmitLoading('addUserSubmitBtn', false);
    showInlineError('addUserError',
      `No account found for "${escHtml(email)}". Ask the user to sign in to AllDayLMS first.`);
    return;
  }

  const profile = profiles[0];

  // Check if already a member
  const already = admin.orgMembers.find(m => m.user_id === profile.id);
  if (already) {
    setSubmitLoading('addUserSubmitBtn', false);
    showInlineError('addUserError', `${escHtml(email)} is already a member (${already.role}).`);
    return;
  }

  // Insert org_member row
  const { data: newMember, error: insertErr } = await admin.sb
    .from('org_members')
    .insert({
      org_id:     admin.org.id,
      user_id:    profile.id,
      role:       role,
      created_by: admin.user.id
    })
    .select()
    .single();

  setSubmitLoading('addUserSubmitBtn', false);

  if (insertErr) {
    showInlineError('addUserError', `Error: ${insertErr.message}`);
    return;
  }

  // Audit log
  await auditLog('add_org_member', 'user', profile.id, { email, role });

  // Update local state
  admin.orgMembers.push({ ...newMember, profile });
  closeModal('modal-addUser');
  renderUsersSection();
  showToast(`${email} added as ${role}.`);
}

// ─── CRUD: Change Role ────────────────────────────────────────────────────────

function openChangeRoleModal(membershipId, email, currentRole) {
  document.getElementById('changeRoleUserLabel').textContent = `Changing role for ${email}`;
  document.getElementById('changeRoleSelect').value    = currentRole;
  document.getElementById('changeRoleMembershipId').value = membershipId;
  hideInlineError('changeRoleError');
  openModal('modal-changeRole');
}

async function commitChangeRole() {
  const membershipId = document.getElementById('changeRoleMembershipId').value;
  const newRole      = document.getElementById('changeRoleSelect').value;
  hideInlineError('changeRoleError');

  const { error } = await admin.sb
    .from('org_members')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', membershipId)
    .eq('org_id', admin.org.id);

  if (error) {
    showInlineError('changeRoleError', `Error: ${error.message}`);
    return;
  }

  const member = admin.orgMembers.find(m => m.id === membershipId);
  const oldRole = member?.role;
  if (member) member.role = newRole;

  await auditLog('change_org_member_role', 'user', member?.user_id,
    { email: member?.profile?.email, old_role: oldRole, new_role: newRole });

  closeModal('modal-changeRole');
  renderUsersSection();
  showToast(`Role updated to ${newRole}.`);
}

// ─── CRUD: Remove Member ──────────────────────────────────────────────────────

async function removeMember(membershipId, email) {
  if (!confirm(`Remove ${email} from this organization?\nThis will not delete their account or course enrollments.`)) return;

  const member = admin.orgMembers.find(m => m.id === membershipId);

  const { error } = await admin.sb
    .from('org_members')
    .delete()
    .eq('id', membershipId)
    .eq('org_id', admin.org.id);

  if (error) { showToast(`Error: ${error.message}`, true); return; }

  await auditLog('remove_org_member', 'user', member?.user_id, { email });

  admin.orgMembers = admin.orgMembers.filter(m => m.id !== membershipId);
  renderUsersSection();
  showToast(`${email} removed from organization.`);
}

// ─── CRUD: Create Course ──────────────────────────────────────────────────────

function openCreateCourseModal() {
  document.getElementById('courseNameInput').value  = '';
  document.getElementById('courseCodeInput').value  = '';
  document.getElementById('courseDescInput').value  = '';
  hideInlineError('createCourseError');

  // Populate instructor dropdown from org members
  const select = document.getElementById('courseInstructorSelect');
  select.innerHTML = '<option value="">Select an org member…</option>';
  admin.orgMembers.forEach(m => {
    const opt = document.createElement('option');
    opt.value       = m.user_id;
    opt.textContent = m.profile.email + (m.profile.name ? ` (${m.profile.name})` : '');
    select.appendChild(opt);
  });

  openModal('modal-createCourse');
  setTimeout(() => document.getElementById('courseNameInput')?.focus(), 80);
}

async function createCourse() {
  const name         = document.getElementById('courseNameInput').value.trim();
  const code         = document.getElementById('courseCodeInput').value.trim();
  const description  = document.getElementById('courseDescInput').value.trim();
  const instructorId = document.getElementById('courseInstructorSelect').value;

  hideInlineError('createCourseError');

  if (!name) { showInlineError('createCourseError', 'Course name is required.'); return; }
  if (!instructorId) { showInlineError('createCourseError', 'Select a primary instructor.'); return; }

  setSubmitLoading('createCourseSubmitBtn', true);

  // Insert the course
  const { data: course, error: courseErr } = await admin.sb
    .from('courses')
    .insert({
      name,
      code:        code || null,
      description: description || null,
      org_id:      admin.org.id,
      created_by:  instructorId,
      active:      true
    })
    .select()
    .single();

  if (courseErr) {
    setSubmitLoading('createCourseSubmitBtn', false);
    showInlineError('createCourseError', `Error creating course: ${courseErr.message}`);
    return;
  }

  // Enroll the instructor
  const { error: enrollErr } = await admin.sb
    .from('enrollments')
    .insert({
      course_id: course.id,
      user_id:   instructorId,
      role:      'instructor'
    });

  setSubmitLoading('createCourseSubmitBtn', false);

  if (enrollErr) {
    showInlineError('createCourseError',
      `Course created but could not enroll instructor: ${enrollErr.message}`);
    return;
  }

  // Audit
  await auditLog('create_course', 'course', course.id, { name, code, instructor_id: instructorId });

  // Refresh local state
  await loadOrgCourses();
  await loadEnrollments();
  closeModal('modal-createCourse');
  renderCoursesSection();
  showToast(`Course "${name}" created.`);
}

// ─── CRUD: Add Enrollment ─────────────────────────────────────────────────────

function openAddEnrollmentModal() {
  hideInlineError('addEnrollError');

  // Courses
  const cs = document.getElementById('enrollCourseSelect');
  cs.innerHTML = '<option value="">Select course…</option>';
  admin.orgCourses.forEach(c => {
    const opt = document.createElement('option');
    opt.value       = c.id;
    opt.textContent = c.name + (c.code ? ` (${c.code})` : '');
    cs.appendChild(opt);
  });

  // Users
  const us = document.getElementById('enrollUserSelect');
  us.innerHTML = '<option value="">Select org member…</option>';
  admin.orgMembers.forEach(m => {
    const opt = document.createElement('option');
    opt.value       = m.user_id;
    opt.textContent = m.profile.email + (m.profile.name ? ` — ${m.profile.name}` : '');
    us.appendChild(opt);
  });

  document.getElementById('enrollRoleSelect').value = 'student';
  openModal('modal-addEnrollment');
}

async function addEnrollment() {
  const courseId = document.getElementById('enrollCourseSelect').value;
  const userId   = document.getElementById('enrollUserSelect').value;
  const role     = document.getElementById('enrollRoleSelect').value;

  hideInlineError('addEnrollError');

  if (!courseId) { showInlineError('addEnrollError', 'Select a course.'); return; }
  if (!userId)   { showInlineError('addEnrollError', 'Select a user.'); return; }

  // Check for duplicate
  const dup = admin.enrollments.find(e => e.course_id === courseId && e.user_id === userId);
  if (dup) {
    showInlineError('addEnrollError',
      `This user is already enrolled in that course as ${dup.role}.`);
    return;
  }

  setSubmitLoading('addEnrollSubmitBtn', true);

  const { data: enrollment, error } = await admin.sb
    .from('enrollments')
    .insert({ course_id: courseId, user_id: userId, role })
    .select()
    .single();

  setSubmitLoading('addEnrollSubmitBtn', false);

  if (error) {
    showInlineError('addEnrollError', `Error: ${error.message}`);
    return;
  }

  const profile = admin.orgMembers.find(m => m.user_id === userId)?.profile
    || { id: userId, email: '(unknown)', name: '' };
  const course  = admin.orgCourses.find(c => c.id === courseId);

  await auditLog('add_enrollment', 'enrollment', enrollment.id,
    { course_id: courseId, user_id: userId, role, email: profile.email });

  admin.enrollments.push({ ...enrollment, profile, course });
  closeModal('modal-addEnrollment');
  renderEnrollmentsSection();
  showToast(`${profile.email} enrolled as ${role}.`);
}

// ─── CRUD: Remove Enrollment ──────────────────────────────────────────────────

async function removeEnrollment(enrollmentId, email, courseName) {
  if (!confirm(`Remove ${email} from "${courseName}"?`)) return;

  const { error } = await admin.sb
    .from('enrollments')
    .delete()
    .eq('id', enrollmentId);

  if (error) { showToast(`Error: ${error.message}`, true); return; }

  await auditLog('remove_enrollment', 'enrollment', enrollmentId, { email, course_name: courseName });

  admin.enrollments = admin.enrollments.filter(e => e.id !== enrollmentId);
  renderEnrollmentsSection();
  showToast(`${email} removed from "${courseName}".`);
}

// ─── Audit Logging ────────────────────────────────────────────────────────────

async function auditLog(action, targetType, targetId, details) {
  const { error } = await admin.sb
    .from('admin_audit_log')
    .insert({
      org_id:        admin.org.id,
      actor_user_id: admin.user.id,
      action,
      target_type:   targetType || null,
      target_id:     targetId   || null,
      details:       details    || null
    });

  if (error) {
    // Non-fatal: log to console but don't block the operation
    console.warn('[Admin] Audit log insert failed:', error.message);
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function adminLogout() {
  await admin.sb.auth.signOut();
  admin.user = null;
  admin.org  = null;
  showScreen('login');
}

async function adminRetryLogin() {
  await admin.sb.auth.signOut();
  showScreen('login');
}

// ─── Screen Management ────────────────────────────────────────────────────────

function showScreen(name, message) {
  const screens = ['loading', 'login', 'denied', 'error', 'app'];
  screens.forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (!el) return;
    const show = s === name;
    // Use display:flex for app (matches .app layout), display:flex for login-screen, else block
    if (show) {
      el.style.display = (s === 'app') ? 'flex' : (s === 'loading' || s === 'login' || s === 'denied' || s === 'error') ? 'flex' : 'block';
      el.removeAttribute('aria-hidden');
    } else {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    }
  });

  if (name === 'denied' && message) {
    const el = document.getElementById('deniedMessage');
    if (el) el.textContent = message;
  }
  if (name === 'error' && message) {
    const el = document.getElementById('errorMessage');
    if (el) el.textContent = message;
  }
}

// ─── Modal Management ─────────────────────────────────────────────────────────

function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    // Focus first focusable element
    setTimeout(() => el.querySelector('input, select, textarea, button:not(.modal-close)')?.focus(), 60);
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// Close modals on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
  }
});

// Close modals on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.style.display = 'none';
    });
  }
});

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function showLoginError(msg) {
  const el = document.getElementById('adminLoginError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function hideLoginError() {
  const el = document.getElementById('adminLoginError');
  if (el) el.style.display = 'none';
}

function showInlineError(elId, msg) {
  const el = document.getElementById(elId);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function hideInlineError(elId) {
  const el = document.getElementById(elId);
  if (el) el.style.display = 'none';
}

function setSubmitLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.dataset.origText = btn.textContent;
  btn.textContent = loading ? 'Saving…' : (btn.dataset.origText || 'Save');
}

let toastTimer = null;
function showToast(msg, isError = false) {
  const el = document.getElementById('adminToast');
  if (!el) return;
  el.textContent = msg;
  el.style.background = isError ? 'var(--danger)' : 'var(--text-color)';
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** HTML-escape user data before injecting into innerHTML */
function escHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDatetime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Expose onclick handlers (referenced in HTML attributes)
window.adminSignInWithGoogle  = adminSignInWithGoogle;
window.adminLogout            = adminLogout;
window.adminRetryLogin        = adminRetryLogin;
window.adminNav               = adminNav;
window.openAddUserModal       = openAddUserModal;
window.addUserToOrg           = addUserToOrg;
window.openChangeRoleModal    = openChangeRoleModal;
window.commitChangeRole       = commitChangeRole;
window.removeMember           = removeMember;
window.openCreateCourseModal  = openCreateCourseModal;
window.createCourse           = createCourse;
window.openAddEnrollmentModal = openAddEnrollmentModal;
window.addEnrollment          = addEnrollment;
window.removeEnrollment       = removeEnrollment;
window.closeModal             = closeModal;
window.loadAuditLog           = renderAuditSection;
