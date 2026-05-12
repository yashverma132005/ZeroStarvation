/**
 * Zero Starvation — Main Application
 * 
 * SPA router, page management, event coordination,
 * and application initialization.
 */

import { initAuth, getCurrentUser, getCurrentProfile, requireAuth, renderProfilePage } from './auth.js';
import {
    initDonations, fetchDonations, fetchDonation,
    renderDonationCard, openDonationModal
} from './donations.js';
import { renderDashboard } from './dashboard.js';
import {
    initBrowseDonationsMap, updateBrowseMapMarkers, destroyBrowseMap,
    initDetailMap, destroyDetailMap, initProfileMap, destroyProfileMap,
    getDirectionsUrl, initProfileAddressGeocoder
} from './map.js';
import {
    $, showToast, toggleVisibility, escapeHtml,
    formatDate, timeAgo, formatExpiry, debounce, getHashParams, isExpired
} from './utils.js';

// ═══════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════

const PAGES = {
    '/': 'page-home',
    '/home': 'page-home',
    '/about': 'page-about',
    '/contact': 'page-contact',
    '/get-involved': 'page-get-involved',
    '/login': 'page-login',
    '/signup': 'page-signup',
    '/dashboard': 'page-dashboard',
    '/donations': 'page-donations',
    '/profile': 'page-profile',
};

// Pages that require authentication
const PROTECTED_PAGES = ['/dashboard', '/profile'];

// Pages where footer should be hidden
const NO_FOOTER_PAGES = ['/login', '/signup'];

let currentPath = '/';
let mapVisible = false;

function navigateTo(path) {
    window.location.hash = '#' + path;
}

async function handleRoute() {
    const { path } = getHashParams();
    const normalizedPath = path || '/';
    currentPath = normalizedPath;

    // Check for donation detail route: /donations/:id
    const donationDetailMatch = normalizedPath.match(/^\/donations\/(.+)$/);
    
    let pageId;
    if (donationDetailMatch) {
        pageId = 'page-donation-detail';
    } else {
        pageId = PAGES[normalizedPath];
    }

    if (!pageId) {
        pageId = 'page-home';
    }

    // Auth guard for protected pages
    if (PROTECTED_PAGES.includes(normalizedPath)) {
        if (!getCurrentUser()) {
            showToast('Please log in to access this page.', 'warning');
            window.location.hash = '#/login';
            return;
        }
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

    // Show target page
    const targetPage = $(pageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkPage = link.dataset.page;
        if (linkPage && normalizedPath === '/' + linkPage) {
            link.classList.add('active');
        } else if (linkPage === 'home' && normalizedPath === '/') {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Close mobile menu
    closeMobileMenu();

    // Toggle footer visibility
    const footer = $('footer');
    if (footer) {
        footer.style.display = NO_FOOTER_PAGES.includes(normalizedPath) ? 'none' : '';
    }

    // Page-specific initialization
    if (donationDetailMatch) {
        await loadDonationDetail(donationDetailMatch[1]);
    } else {
        switch (normalizedPath) {
            case '/dashboard':
                await renderDashboard();
                break;
            case '/donations':
                await loadBrowseDonations();
                break;
            case '/profile':
                renderProfilePage();
                setTimeout(() => {
                    initProfileMap();
                    initProfileAddressGeocoder();
                }, 100);
                break;
            case '/signup':
                // Re-init role selector for URL params
                initSignupPage();
                break;
        }
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════════════
// BROWSE DONATIONS PAGE
// ═══════════════════════════════════════════════════════════════

let allDonations = [];

async function loadBrowseDonations() {
    const grid = $('donations-grid');
    const loading = $('donations-loading');
    const empty = $('donations-empty');

    toggleVisibility(loading, true);
    toggleVisibility(empty, false);

    const statusFilter = $('filter-status')?.value || 'available';
    const searchFilter = $('filter-search')?.value?.trim() || '';

    allDonations = await fetchDonations({
        status: statusFilter,
        search: searchFilter,
    });

    toggleVisibility(loading, false);

    if (allDonations.length === 0) {
        grid.innerHTML = '';
        toggleVisibility(empty, true);
    } else {
        const cardsHtml = allDonations.map(d => renderDonationCard(d)).join('');
        grid.innerHTML = cardsHtml;
    }

    // Update map if visible
    if (mapVisible) {
        updateBrowseMapMarkers(allDonations);
    }
}

function toggleDonationsMap() {
    const container = $('donations-map-container');
    if (!container) return;

    mapVisible = !mapVisible;

    if (mapVisible) {
        container.classList.remove('hidden');
        initBrowseDonationsMap(allDonations);
    } else {
        container.classList.add('hidden');
        destroyBrowseMap();
    }
}

// ═══════════════════════════════════════════════════════════════
// DONATION DETAIL PAGE
// ═══════════════════════════════════════════════════════════════

async function loadDonationDetail(donationId) {
    const content = $('donation-detail-content');
    const loading = $('detail-loading');

    if (!content) return;

    toggleVisibility(loading, true);

    const donation = await fetchDonation(donationId);

    toggleVisibility(loading, false);

    if (!donation) {
        content.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
                <h3>Donation Not Found</h3>
                <p>This donation may have been removed or doesn't exist.</p>
                <a href="#/donations" class="btn btn-primary" style="margin-top: 1rem;">Browse Donations</a>
            </div>
        `;
        return;
    }

    const user = getCurrentUser();
    const profile = getCurrentProfile();
    const donorName = donation.donor?.organization_name || donation.donor?.full_name || 'Unknown';
    const isOwner = user && donation.donor_id === user.id;
    const expired = isExpired(donation.expiry_time);

    let statusBadgeClass = 'badge-available';
    let statusText = 'Available';
    if (expired) { statusBadgeClass = 'badge-expired'; statusText = 'Expired'; }
    else if (donation.status === 'claimed') { statusBadgeClass = 'badge-claimed'; statusText = 'Claimed'; }
    else if (donation.status === 'completed') { statusBadgeClass = 'badge-completed'; statusText = 'Completed'; }

    let actionsHtml = '';
    if (donation.status === 'available' && !expired && !isOwner && user && profile?.role !== 'restaurant') {
        actionsHtml += `<button class="btn btn-primary btn-lg" onclick="window.__claimDonation('${donation.id}')"><i class="fa-solid fa-check"></i> Claim This Donation</button>`;
    }

    if (donation.status === 'available' && !isOwner && user) {
        actionsHtml += `<button class="btn btn-outline btn-lg" onclick="window.__openMessage('${donation.id}', '${donation.donor_id}')"><i class="fa-solid fa-comment"></i> Send Message</button>`;
    }

    let claimerSection = '';
    if (donation.status === 'claimed' && donation.claimer) {
        const claimerName = donation.claimer.organization_name || donation.claimer.full_name;
        claimerSection = `
            <div class="detail-contact" style="background: var(--color-warm-100); border-color: var(--color-warm-300); margin-top: var(--space-lg);">
                <h3 style="color: var(--color-warm-700);"><i class="fa-solid fa-handshake"></i> Claimed by ${escapeHtml(claimerName)}</h3>
                ${donation.claimer.phone ? `<p><i class="fa-solid fa-phone"></i> ${escapeHtml(donation.claimer.phone)}</p>` : ''}
            </div>
        `;
    }

    content.innerHTML = `
        <div class="detail-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h1 class="detail-title">${escapeHtml(donation.food_type)}</h1>
                    <p style="color: var(--color-gray-500); font-size: 1.05rem;">by ${escapeHtml(donorName)}</p>
                </div>
                <span class="badge ${statusBadgeClass}" style="font-size: 0.9rem; padding: 6px 16px;">${statusText}</span>
            </div>

            <div class="detail-meta">
                <div class="detail-meta-item"><i class="fa-solid fa-box-open"></i> <strong>${escapeHtml(donation.quantity)}</strong></div>
                <div class="detail-meta-item ${expired ? 'detail-chip-urgent' : ''}"><i class="fa-regular fa-clock"></i> ${formatExpiry(donation.expiry_time)}</div>
                <div class="detail-meta-item"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(donation.address)}</div>
                <div class="detail-meta-item"><i class="fa-regular fa-calendar"></i> Posted ${timeAgo(donation.created_at)}</div>
            </div>

            ${donation.description ? `
                <div class="detail-description">
                    <strong>Description:</strong><br>
                    ${escapeHtml(donation.description)}
                </div>
            ` : ''}

            <div class="detail-contact">
                <h3><i class="fa-solid fa-phone"></i> Contact Information</h3>
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">
                    <a href="tel:${escapeHtml(donation.contact_phone)}" style="color: var(--color-primary-800); font-weight: 600;">${escapeHtml(donation.contact_phone)}</a>
                </p>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <a href="tel:${escapeHtml(donation.contact_phone)}" class="btn btn-primary btn-sm"><i class="fa-solid fa-phone"></i> Call</a>
                    <a href="https://wa.me/${donation.contact_phone?.replace(/[\s\-\+]/g, '')}" target="_blank" class="btn btn-outline btn-sm"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
                </div>
            </div>

            ${claimerSection}

            ${actionsHtml ? `<div style="display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap;">${actionsHtml}</div>` : ''}
        </div>

        <div>
            <div class="detail-map-card">
                <div id="detail-donation-map" class="map-view"></div>
                <div class="detail-map-info">
                    <h3 style="margin-bottom: 0.5rem;"><i class="fa-solid fa-location-dot"></i> Pickup Location</h3>
                    <p style="color: var(--color-gray-500); margin-bottom: 1rem;">${escapeHtml(donation.address)}</p>
                    <a href="${getDirectionsUrl(donation.latitude, donation.longitude)}" 
                       target="_blank" class="btn btn-primary">
                        <i class="fa-solid fa-diamond-turn-right"></i> Get Directions
                    </a>
                </div>
            </div>
        </div>
    `;

    // Initialize map
    if (donation.latitude && donation.longitude) {
        setTimeout(() => {
            initDetailMap('detail-donation-map', donation.latitude, donation.longitude,
                `<strong>${escapeHtml(donation.food_type)}</strong><br>${escapeHtml(donation.address)}`
            );
        }, 100);
    }
}

// ═══════════════════════════════════════════════════════════════
// SIGNUP PAGE HELPER
// ═══════════════════════════════════════════════════════════════

function initSignupPage() {
    const { params } = getHashParams();
    const role = params.get('role');
    if (role) {
        const options = document.querySelectorAll('.role-option');
        options.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.role === role);
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// MOBILE MENU
// ═══════════════════════════════════════════════════════════════

function toggleMobileMenu() {
    const btn = $('mobile-menu-btn');
    const menu = $('mobile-menu');

    if (btn && menu) {
        btn.classList.toggle('open');
        menu.classList.toggle('open');
        btn.setAttribute('aria-expanded', menu.classList.contains('open'));
    }
}

function closeMobileMenu() {
    const btn = $('mobile-menu-btn');
    const menu = $('mobile-menu');

    if (btn) btn.classList.remove('open');
    if (menu) menu.classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
// NAVBAR SCROLL EFFECT
// ═══════════════════════════════════════════════════════════════

function initNavScroll() {
    const navbar = $('navbar');
    if (!navbar) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }, { passive: true });
}

// ═══════════════════════════════════════════════════════════════
// STAT COUNTER ANIMATION
// ═══════════════════════════════════════════════════════════════

function initStatCounters() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumbers = entry.target.querySelectorAll('.stat-number[data-count]');
                statNumbers.forEach(el => animateCounter(el));
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    const statsSection = document.querySelector('.stats-section');
    if (statsSection) observer.observe(statsSection);
}

function animateCounter(el) {
    const target = parseInt(el.dataset.count) || 0;
    const duration = 2000;
    const start = performance.now();

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(target * eased);
        el.textContent = current.toLocaleString() + (target >= 1000 ? '+' : '');

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = target.toLocaleString() + '+';
        }
    }

    requestAnimationFrame(update);
}

// ═══════════════════════════════════════════════════════════════
// CONTACT FORM
// ═══════════════════════════════════════════════════════════════

function initContactForm() {
    const form = $('contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('Thank you for your message! We\'ll get back to you soon.', 'success');
        form.reset();
    });
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

function bindGlobalEvents() {
    // Hash route changes
    window.addEventListener('hashchange', handleRoute);

    // Mobile menu toggle
    $('mobile-menu-btn')?.addEventListener('click', toggleMobileMenu);

    // Close mobile menu when clicking a link
    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    // Donation filter events
    $('filter-status')?.addEventListener('change', debounce(loadBrowseDonations, 200));
    $('filter-search')?.addEventListener('input', debounce(loadBrowseDonations, 400));
    $('toggle-map-btn')?.addEventListener('click', toggleDonationsMap);

    // Dashboard post buttons (bound in dashboard.js via onclick)
    $('dash-post-btn')?.addEventListener('click', openDonationModal);

    // Listen for donation updates (from create/claim/delete)
    window.addEventListener('donations-updated', () => {
        // Refresh current page data
        if (currentPath === '/dashboard') {
            renderDashboard();
        } else if (currentPath === '/donations') {
            loadBrowseDonations();
        }
    });

    // Contact form
    initContactForm();

    // Keyboard: Escape to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
                modal.classList.add('hidden');
            });
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// APP INITIALIZATION
// ═══════════════════════════════════════════════════════════════

let appInitialized = false;

async function initApp() {
    if (appInitialized) return;
    appInitialized = true;

    console.log('[Zero Starvation] Initializing...');

    // Init auth (handles session check + UI updates)
    // Wrapped in try-catch so the router always initializes
    try {
        await initAuth();
    } catch (err) {
        console.warn('[Zero Starvation] Auth init error (non-fatal):', err.message);
    }

    // Init donations (binds form events)
    initDonations();

    // Bind global events
    bindGlobalEvents();

    // UI enhancements
    initNavScroll();
    initStatCounters();

    // Handle initial route
    if (!window.location.hash || window.location.hash === '#') {
        window.location.hash = '#/';
    }
    handleRoute();

    console.log('[Zero Starvation] Ready!');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

