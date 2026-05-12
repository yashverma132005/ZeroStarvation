/**
 * Zero Starvation — Utility Functions
 * 
 * Toast notifications, loading overlays, date formatting,
 * form validation helpers, and DOM utilities.
 */

// ═══════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

const TOAST_ICONS = {
    success: '<i class="fa-solid fa-circle-check"></i>',
    error: '<i class="fa-solid fa-circle-xmark"></i>',
    info: '<i class="fa-solid fa-circle-info"></i>',
    warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
};

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {'success'|'error'|'info'|'warning'} type - Toast type
 * @param {number} duration - Auto-dismiss time in ms (default 4000)
 */
export function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${TOAST_ICONS[type] || '<i class="fa-solid fa-circle-info"></i>'}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        dismissToast(toast);
    });

    container.appendChild(toast);

    // Auto dismiss
    if (duration > 0) {
        setTimeout(() => dismissToast(toast), duration);
    }
}

function dismissToast(toast) {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 250);
}

// ═══════════════════════════════════════════════════════════════
// LOADING OVERLAY
// ═══════════════════════════════════════════════════════════════

export function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        const p = overlay.querySelector('p');
        if (p) p.textContent = message;
        overlay.classList.remove('hidden');
    }
}

export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// ═══════════════════════════════════════════════════════════════
// BUTTON LOADING STATE
// ═══════════════════════════════════════════════════════════════

export function setButtonLoading(btn, loading) {
    if (!btn) return;
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    
    if (loading) {
        btn.disabled = true;
        if (text) text.classList.add('hidden');
        if (loader) loader.classList.remove('hidden');
    } else {
        btn.disabled = false;
        if (text) text.classList.remove('hidden');
        if (loader) loader.classList.add('hidden');
    }
}

// ═══════════════════════════════════════════════════════════════
// DATE & TIME FORMATTING
// ═══════════════════════════════════════════════════════════════

/**
 * Format an ISO date string to a human-readable format
 */
export function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

/**
 * Format an ISO date string to relative time (e.g., "2 hours ago")
 */
export function timeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
}

/**
 * Format an ISO date string to datetime-local input value
 */
export function toDatetimeLocal(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

/**
 * Format expiry time to a readable format with urgency
 */
export function formatExpiry(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date - now;
    const hours = Math.floor(diff / 3600000);
    
    if (diff < 0) return 'Expired';
    if (hours < 1) return `${Math.floor(diff / 60000)} min left`;
    if (hours < 24) return `${hours}h left`;
    return formatDate(dateStr);
}

/**
 * Check if a donation is expired
 */
export function isExpired(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
}

// ═══════════════════════════════════════════════════════════════
// DOM UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Shorthand for getElementById
 */
export function $(id) {
    return document.getElementById(id);
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Show or hide an element
 */
export function toggleVisibility(element, show) {
    if (!element) return;
    if (typeof element === 'string') element = $(element);
    if (!element) return;
    
    if (show) {
        element.classList.remove('hidden');
    } else {
        element.classList.add('hidden');
    }
}

/**
 * Clear form inputs
 */
export function clearForm(formId) {
    const form = $(formId);
    if (form) form.reset();
}

// ═══════════════════════════════════════════════════════════════
// FORM VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Validate email format
 */
export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone number (basic)
 */
export function isValidPhone(phone) {
    return /^[\+]?[0-9\s\-]{8,15}$/.test(phone);
}

/**
 * Show form error message
 */
export function showFormError(errorElementId, message) {
    const el = $(errorElementId);
    if (el) {
        el.textContent = message;
        el.classList.remove('hidden');
    }
}

/**
 * Hide form error message
 */
export function hideFormError(errorElementId) {
    const el = $(errorElementId);
    if (el) {
        el.textContent = '';
        el.classList.add('hidden');
    }
}

// ═══════════════════════════════════════════════════════════════
// MISCELLANEOUS
// ═══════════════════════════════════════════════════════════════

/**
 * Get URL hash parameters
 */
export function getHashParams() {
    const hash = window.location.hash.slice(1); // remove #
    const [path, queryString] = hash.split('?');
    const params = new URLSearchParams(queryString || '');
    return { path: path || '/', params };
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate initials from a name (for avatar)
 */
export function getInitials(name) {
    if (!name) return 'U';
    return name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/**
 * Debounce function for search inputs
 */
export function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
