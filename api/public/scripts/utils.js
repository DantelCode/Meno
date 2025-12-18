/*
 * SHARED UTILITY FUNCTIONS
 * Small, safe helpers reused across the app.
 */

// Escape HTML special characters to prevent XSS
function escapeHtml(s) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return s.replace(/[&<>"']/g, m => map[m]);
}

// Read events from localStorage
function readStore() {
  try {
    const stored = localStorage.getItem('meno_events');
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('Failed to read store:', e);
    return {};
  }
}

// Write events to localStorage
function writeStore(obj) {
  try {
    localStorage.setItem('meno_events', JSON.stringify(obj));
  } catch (e) {
    console.error('Failed to write store:', e);
  }
}

// Format date object to YYYY-M-D string for storage
function getDateString(d) {
  if (!(d instanceof Date)) return null;
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Display a toast notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
