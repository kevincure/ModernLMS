/* ═══════════════════════════════════════════════════════════════════════════════
   UI Helper Functions for Campus LMS
   DOM manipulation, formatting, and utility functions
═══════════════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export function escapeHtml(value) {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.className = `toast visible ${type}`;
    setTimeout(() => toast.classList.remove('visible'), 3000);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATE FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

export function formatDate(dateString) {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid date';

  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / 86400000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 0 && days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDueDate(dateString) {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid date';

  const now = new Date();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = dueDay - nowDay;
  const days = Math.round(diffMs / 86400000);

  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return 'Due yesterday';
  if (days > 1 && days <= 14) return `Due in ${days} days`;
  if (days < -1 && days >= -14) return `Due ${Math.abs(days)} days ago`;
  return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function formatTimeForDisplay(isoDateString) {
  if (!isoDateString) return 'Not set';
  const date = new Date(isoDateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function formatDateShort(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Initialize UI helpers module
 * Sets up any global state or event listeners needed
 */
export function initUIHelpers() {
  // Initialize style theme
  initStyleTheme();
  console.log('[UIHelpers] Module initialized');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATE/TIME SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

export function getDateTimeFromSelectors(dateId, hourId, minuteId, ampmId) {
  const dateVal = document.getElementById(dateId).value;
  if (!dateVal) return null;

  let hour = parseInt(document.getElementById(hourId).value, 10);
  const minute = document.getElementById(minuteId).value;
  const ampm = document.getElementById(ampmId).value;

  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const date = new Date(dateVal + 'T' + hour.toString().padStart(2, '0') + ':' + minute + ':00');
  return date.toISOString();
}

export function setDateTimeSelectors(dateId, hourId, minuteId, ampmId, isoDateString) {
  if (!isoDateString) {
    document.getElementById(dateId).value = '';
    document.getElementById(hourId).value = '11';
    document.getElementById(minuteId).value = '59';
    document.getElementById(ampmId).value = 'PM';
    return;
  }

  const date = new Date(isoDateString);
  const dateStr = date.toISOString().slice(0, 10);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  if (hours === 0) hours = 12;

  const roundedMinutes = Math.round(minutes / 15) * 15;
  const minuteStr = (roundedMinutes === 60 ? 0 : roundedMinutes).toString().padStart(2, '0');

  document.getElementById(dateId).value = dateStr;
  document.getElementById(hourId).value = hours.toString();
  document.getElementById(minuteId).value = minuteStr;
  document.getElementById(ampmId).value = ampm;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function generateId() {
  return crypto.randomUUID();
}

export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function ensureUrlProtocol(url) {
  if (!url) return url;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return 'https://' + trimmed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKDOWN RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

export function formatInlineMarkdown(text) {
  let output = escapeHtml(text);
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return output;
}

export function renderMarkdown(text) {
  if (!text) return '';

  const preservedBlocks = [];
  let working = text;

  // Convert legacy <div class="video-embed"><iframe> blocks to click-to-play placeholders.
  // Old content stored iframe HTML directly; this intercepts it before it can reach the DOM.
  working = working.replace(/<div class="video-embed">[\s\S]*?<\/div>/g, (match) => {
    const index = preservedBlocks.length;
    const ytMatch = match.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    const vimeoMatch = match.match(/player\.vimeo\.com\/video\/(\d+)/);
    if (ytMatch) {
      const videoId = ytMatch[1];
      preservedBlocks.push(
        `<div class="video-embed video-placeholder" data-video-type="youtube" data-video-id="${videoId}" onclick="loadVideoEmbed(this)" style="cursor:pointer;" title="Click to play">` +
        `<img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" alt="Video thumbnail">` +
        `<div class="video-play-btn"><svg viewBox="0 0 24 24" fill="white" width="36" height="36"><path d="M8 5v14l11-7z"/></svg></div>` +
        `</div>`
      );
    } else if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      preservedBlocks.push(
        `<div class="video-embed video-placeholder" data-video-type="vimeo" data-video-id="${videoId}" onclick="loadVideoEmbed(this)" style="cursor:pointer;" title="Click to play">` +
        `<div style="width:100%;height:100%;background:#1a1a2e;display:flex;align-items:center;justify-content:center;">` +
        `<div class="video-play-btn"><svg viewBox="0 0 24 24" fill="white" width="36" height="36"><path d="M8 5v14l11-7z"/></svg></div></div>` +
        `</div>`
      );
    } else {
      preservedBlocks.push(match); // unknown iframe type, preserve as-is
    }
    return `@@PRESERVED${index}@@`;
  });

  // Convert raw YouTube URLs to click-to-play placeholders (avoids loading
  // the YouTube player JS until the user actually wants to watch the video)
  working = working.replace(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s<"]*)?/g, (match, videoId) => {
    const index = preservedBlocks.length;
    preservedBlocks.push(
      `<div class="video-embed video-placeholder" data-video-type="youtube" data-video-id="${videoId}" onclick="loadVideoEmbed(this)" style="cursor:pointer;" title="Click to play">` +
      `<img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" alt="Video thumbnail">` +
      `<div class="video-play-btn"><svg viewBox="0 0 24 24" fill="white" width="36" height="36"><path d="M8 5v14l11-7z"/></svg></div>` +
      `</div>`
    );
    return `@@PRESERVED${index}@@`;
  });

  // Convert raw Vimeo URLs to click-to-play placeholders
  working = working.replace(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/g, (match, videoId) => {
    const index = preservedBlocks.length;
    preservedBlocks.push(
      `<div class="video-embed video-placeholder" data-video-type="vimeo" data-video-id="${videoId}" onclick="loadVideoEmbed(this)" style="cursor:pointer;" title="Click to play">` +
      `<div style="width:100%;height:100%;background:#1a1a2e;display:flex;align-items:center;justify-content:center;">` +
      `<div class="video-play-btn"><svg viewBox="0 0 24 24" fill="white" width="36" height="36"><path d="M8 5v14l11-7z"/></svg></div></div>` +
      `</div>`
    );
    return `@@PRESERVED${index}@@`;
  });

  // Preserve code blocks
  const codeBlocks = [];
  working = working.replace(/```([\s\S]*?)```/g, (match, code) => {
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

  // Restore code blocks
  codeBlocks.forEach((code, index) => {
    const safeCode = escapeHtml(code);
    html = html.replace(`@@CODEBLOCK${index}@@`, `<pre><code>${safeCode}</code></pre>`);
  });

  // Restore preserved blocks
  preservedBlocks.forEach((block, index) => {
    html = html.replace(`<p>@@PRESERVED${index}@@</p>`, block);
    html = html.replace(`@@PRESERVED${index}@@`, block);
  });

  // LaTeX rendering via KaTeX
  if (typeof katex !== 'undefined') {
    // Display math: $$ ... $$ (block)
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      } catch { return match; }
    });
    // Inline math: $ ... $ (but not $$ and not currency like $27)
    // Requires: opening $ not followed by digit or space; closing $ not preceded by space
    html = html.replace(/(?<!\$)\$(?!\$)(?!\d)(?! )([^\$\n]+?)(?<! )\$(?!\$)/g, (match, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
      } catch { return match; }
    });
    // Also support \( ... \) for inline and \[ ... \] for display
    html = html.replace(/\\\[([\s\S]*?)\\\]/g, (match, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      } catch { return match; }
    });
    html = html.replace(/\\\(([\s\S]*?)\\\)/g, (match, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
      } catch { return match; }
    });
  }

  return html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('visible');
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('visible');
  // Clear any inline overrides (display, elevated z-index)
  if (modal.style.display) modal.style.display = '';
  if (modal.style.zIndex) modal.style.zIndex = '';
}

// Confirmation dialog helper
let confirmCallback = null;

export function confirm(message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  const msgEl = document.getElementById('confirmMessage');
  const btnEl = document.getElementById('confirmButton');

  if (msgEl) msgEl.textContent = message;
  if (btnEl) {
    btnEl.onclick = () => {
      closeModal('confirmModal');
      if (onConfirm) onConfirm();
    };
  }

  // Elevate above any other open modal (all share z-index:999 by default)
  if (modal) modal.style.zIndex = '1500';
  openModal('confirmModal');
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
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

// ═══════════════════════════════════════════════════════════════════════════════
// YOUTUBE/VIDEO UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export function extractYouTubeId(url) {
  if (!url) return null;
  // Standard watch URL: youtube.com/watch?v=ID
  if (url.includes('v=')) {
    return url.split('v=')[1].split('&')[0].split('?')[0] || null;
  }
  // Short URL: youtu.be/ID
  if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1].split('?')[0].split('&')[0] || null;
  }
  // YouTube Shorts: youtube.com/shorts/ID
  if (url.includes('/shorts/')) {
    return url.split('/shorts/')[1].split('?')[0].split('&')[0] || null;
  }
  // YouTube Live: youtube.com/live/ID
  if (url.includes('/live/')) {
    return url.split('/live/')[1].split('?')[0].split('&')[0] || null;
  }
  // Already an embed URL: youtube.com/embed/ID
  if (url.includes('/embed/')) {
    return url.split('/embed/')[1].split('?')[0].split('&')[0] || null;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export function getQuizPoints(quiz) {
  if (!quiz || !quiz.questions) return 0;
  const total = quiz.questions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
  if (quiz.questionPoolEnabled && quiz.questionSelectCount && quiz.questions.length > 0) {
    const avg = total / quiz.questions.length;
    return Math.round(avg * quiz.questionSelectCount * 10) / 10;
  }
  return total;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LATE SUBMISSION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateLateDeduction(assignment, submittedAt) {
  if (!assignment.allowLateSubmissions) return 0;
  if (!assignment.dueDate || !submittedAt) return 0;

  const dueDate = new Date(assignment.dueDate);
  const submitDate = new Date(submittedAt);

  if (submitDate <= dueDate) return 0;

  const daysLate = Math.ceil((submitDate - dueDate) / 86400000);
  const deductionPerDay = assignment.lateDeduction || 10;

  return Math.min(daysLate * deductionPerDay, 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR TOOLBAR
// ═══════════════════════════════════════════════════════════════════════════════

export function renderEditorToolbar(textareaId) {
  return `
    <div class="editor-toolbar" style="display:flex; gap:4px; margin-bottom:6px;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="insertLink('${textareaId}')" title="Insert Link">🔗 Link</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="insertFileLink('${textareaId}')" title="Insert File">📄 File</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="insertVideo('${textareaId}')" title="Insert Video">📹 Video</button>
    </div>
  `;
}

export function insertAtCursor(textareaId, text) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);

  textarea.value = before + text + after;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE THEME INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export function initStyleTheme() {
  document.documentElement.classList.add('style-1');
  if (document.body) {
    document.body.classList.add('style-1');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('style-1');
    });
  }
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
