/**
 * Zero Starvation — Dashboard Module
 * 
 * Renders distinct dashboards for Restaurant, NGO, and Individual users.
 * Each role sees tailored stats, actions, and content sections.
 */

import { getCurrentUser, getCurrentProfile } from './auth.js';
import {
    fetchDonations, fetchRequests, openDonationModal, openRequestModal,
    renderDonationCard, renderRequestCard
} from './donations.js';
import { $, toggleVisibility, escapeHtml, capitalize } from './utils.js';
import { ROLES } from './config.js';

// ═══════════════════════════════════════════════════════════════
// ROLE CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

const ROLE_CONFIG = {
    restaurant: {
        icon: 'fa-solid fa-utensils',
        label: 'Restaurant Dashboard',
        accentClass: 'dash-role-restaurant',
        subtitle: 'Manage your food donations and connect with NGOs.',
    },
    ngo: {
        icon: 'fa-solid fa-building-ngo',
        label: 'NGO Dashboard',
        accentClass: 'dash-role-ngo',
        subtitle: 'Find food donations and manage your distribution programs.',
    },
    individual: {
        icon: 'fa-solid fa-user',
        label: 'Individual Dashboard',
        accentClass: 'dash-role-individual',
        subtitle: 'Browse available food and track your claimed pickups.',
    },
};

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════

export async function renderDashboard() {
    const user = getCurrentUser();
    const profile = getCurrentProfile();

    if (!user || !profile) return;

    // Reset sections visibility
    resetDashboard();

    // Setup role indicator
    const config = ROLE_CONFIG[profile.role] || ROLE_CONFIG.individual;
    const dashPage = $('dashboard-page');
    if (dashPage) {
        // Remove old role classes, add new
        dashPage.classList.remove('dash-role-restaurant', 'dash-role-ngo', 'dash-role-individual');
        dashPage.classList.add(config.accentClass);
    }

    const roleIcon = $('dash-role-icon');
    if (roleIcon) roleIcon.innerHTML = `<i class="${config.icon}"></i>`;

    const roleLabel = $('dash-role-label');
    if (roleLabel) roleLabel.textContent = config.label;

    const orgName = profile.organization_name || profile.full_name;
    const dashTitle = $('dash-title');
    if (dashTitle) dashTitle.textContent = `Welcome back, ${orgName}!`;

    const dashSubtitle = $('dash-subtitle');
    if (dashSubtitle) dashSubtitle.textContent = config.subtitle;

    // Route to role-specific dashboard
    switch (profile.role) {
        case ROLES.RESTAURANT:
            await renderRestaurantDashboard(user, profile);
            break;
        case ROLES.NGO:
            await renderNgoDashboard(user, profile);
            break;
        case ROLES.INDIVIDUAL:
        default:
            await renderIndividualDashboard(user, profile);
            break;
    }
}

function resetDashboard() {
    // Hide optional sections
    toggleVisibility('dash-secondary-section', false);
    toggleVisibility('dash-tertiary-section', false);
    toggleVisibility('dash-tabs', false);

    // Reset buttons
    const postBtn = $('dash-post-btn');
    if (postBtn) { postBtn.style.display = 'none'; postBtn.onclick = null; }
    const reqBtn = $('dash-request-btn');
    if (reqBtn) { reqBtn.style.display = 'none'; reqBtn.onclick = null; }
}

// ═══════════════════════════════════════════════════════════════
// 🍽️ RESTAURANT DASHBOARD
// ═══════════════════════════════════════════════════════════════

async function renderRestaurantDashboard(user, profile) {
    const dashSectionTitle = $('dash-section-title');
    if (dashSectionTitle) dashSectionTitle.textContent = 'Your Donations';

    // Show post button
    const dashPostBtn = $('dash-post-btn');
    if (dashPostBtn) {
        dashPostBtn.style.display = 'inline-flex';
        dashPostBtn.onclick = openDonationModal;
    }

    // Show tabs for filtering donations
    renderTabs([
        { id: 'all', label: 'All', active: true },
        { id: 'available', label: 'Available' },
        { id: 'claimed', label: 'Claimed' },
        { id: 'completed', label: 'Completed' },
    ]);

    // Loading
    const cardsGrid = $('dash-cards');
    const loading = $('dash-loading');
    const empty = $('dash-empty');

    toggleVisibility(loading, true);
    toggleVisibility(empty, false);

    // Fetch restaurant's donations
    const donations = await fetchDonations({ donor_id: user.id });

    toggleVisibility(loading, false);

    // Store for tab filtering
    window.__dashDonations = donations;
    window.__dashFilterFn = (tab) => filterRestaurantDonations(donations, tab);

    renderFilteredCards(donations, 'all');

    if (donations.length === 0) {
        toggleVisibility(empty, true);
        const emptyText = $('dash-empty-text');
        if (emptyText) emptyText.textContent = 'You haven\'t posted any donations yet. Click "Post New Donation" to get started!';
    }

    // Stats
    renderStats([
        { icon: 'fa-solid fa-box-open', number: donations.length, label: 'Total Donations', color: 'green' },
        { icon: 'fa-solid fa-check-circle', number: donations.filter(d => d.status === 'available').length, label: 'Available', color: 'green' },
        { icon: 'fa-solid fa-handshake', number: donations.filter(d => d.status === 'claimed').length, label: 'Claimed', color: 'warm' },
        { icon: 'fa-solid fa-circle-check', number: donations.filter(d => d.status === 'completed').length, label: 'Completed', color: 'blue' },
    ]);

    // Secondary section: NGO food requests
    const secondarySection = $('dash-secondary-section');
    if (secondarySection) {
        secondarySection.classList.remove('hidden');
        const secondaryTitle = $('dash-secondary-title');
        if (secondaryTitle) secondaryTitle.textContent = 'NGO Food Requests';

        const secondaryCards = $('dash-secondary-cards');
        const secondaryEmpty = $('dash-secondary-empty');

        const requests = await fetchRequests({ status: 'active' });

        if (requests.length === 0) {
            if (secondaryEmpty) {
                secondaryEmpty.classList.remove('hidden');
                const emptyText = $('dash-secondary-empty-text');
                if (emptyText) emptyText.textContent = 'No active food requests from NGOs at the moment.';
            }
            if (secondaryCards) secondaryCards.innerHTML = secondaryEmpty?.outerHTML || '';
        } else {
            if (secondaryCards) {
                secondaryCards.innerHTML = requests
                    .map(r => renderRequestCard(r, { showContact: true }))
                    .join('');
            }
        }
    }
}

function filterRestaurantDonations(allDonations, tab) {
    if (tab === 'all') return allDonations;
    return allDonations.filter(d => d.status === tab);
}

// ═══════════════════════════════════════════════════════════════
// 🏢 NGO DASHBOARD
// ═══════════════════════════════════════════════════════════════

async function renderNgoDashboard(user, profile) {
    const dashSectionTitle = $('dash-section-title');
    if (dashSectionTitle) dashSectionTitle.textContent = 'Available Food Donations';

    // Show request button
    const dashRequestBtn = $('dash-request-btn');
    if (dashRequestBtn) {
        dashRequestBtn.style.display = 'inline-flex';
        dashRequestBtn.onclick = openRequestModal;
    }

    // Loading
    const cardsGrid = $('dash-cards');
    const loading = $('dash-loading');
    const empty = $('dash-empty');

    toggleVisibility(loading, true);
    toggleVisibility(empty, false);

    // Fetch available donations for claiming
    const availableDonations = await fetchDonations({ status: 'available' });

    toggleVisibility(loading, false);

    if (availableDonations.length === 0) {
        toggleVisibility(empty, true);
        const emptyText = $('dash-empty-text');
        if (emptyText) emptyText.textContent = 'No donations available right now. Check back soon!';
    } else {
        const cardsHtml = availableDonations.map(d => renderDonationCard(d, { context: 'dashboard' })).join('');
        if (cardsGrid) cardsGrid.innerHTML = cardsHtml;
    }

    // Fetch claimed donations by this user
    const allClaimed = await fetchDonations({ status: 'claimed' });
    const myClaimed = allClaimed.filter(d => d.claimed_by === user.id);
    const allCompleted = await fetchDonations({ status: 'completed' });
    const myCompleted = allCompleted.filter(d => d.claimed_by === user.id);

    // My requests
    const myRequests = await fetchRequests({ requester_id: user.id });

    // Stats
    renderStats([
        { icon: 'fa-solid fa-utensils', number: availableDonations.length, label: 'Available Now', color: 'green' },
        { icon: 'fa-solid fa-handshake', number: myClaimed.length, label: 'You Claimed', color: 'warm' },
        { icon: 'fa-solid fa-clipboard-list', number: myRequests.length, label: 'Your Requests', color: 'blue' },
        { icon: 'fa-solid fa-circle-check', number: myCompleted.length, label: 'Completed', color: 'purple' },
    ]);

    // Secondary section: Your claimed donations
    const secondarySection = $('dash-secondary-section');
    if (secondarySection) {
        secondarySection.classList.remove('hidden');
        const secondaryTitle = $('dash-secondary-title');
        if (secondaryTitle) secondaryTitle.textContent = 'Your Claimed Donations';

        const secondaryCards = $('dash-secondary-cards');
        const secondaryEmpty = $('dash-secondary-empty');

        const myClaimHistory = [...myClaimed, ...myCompleted];

        if (myClaimHistory.length === 0) {
            if (secondaryEmpty) {
                secondaryEmpty.classList.remove('hidden');
                const emptyText = $('dash-secondary-empty-text');
                if (emptyText) emptyText.textContent = 'You haven\'t claimed any donations yet. Browse available food above!';
            }
            if (secondaryCards) secondaryCards.innerHTML = secondaryEmpty?.outerHTML || '';
        } else {
            if (secondaryCards) {
                secondaryCards.innerHTML = myClaimHistory
                    .map(d => renderDonationCard(d, { context: 'dashboard' }))
                    .join('');
            }
        }
    }

    // Tertiary section: Your Food Requests
    const tertiarySection = $('dash-tertiary-section');
    if (tertiarySection) {
        tertiarySection.classList.remove('hidden');
        const tertiaryTitle = $('dash-tertiary-title');
        if (tertiaryTitle) tertiaryTitle.textContent = 'Your Food Requests';

        const tertiaryCards = $('dash-tertiary-cards');
        const tertiaryEmpty = $('dash-tertiary-empty');

        if (myRequests.length === 0) {
            if (tertiaryEmpty) {
                tertiaryEmpty.classList.remove('hidden');
                const emptyText = $('dash-tertiary-empty-text');
                if (emptyText) emptyText.textContent = 'You haven\'t posted any food requests yet. Click "Post Food Request" above.';
            }
            if (tertiaryCards) tertiaryCards.innerHTML = tertiaryEmpty?.outerHTML || '';
        } else {
            if (tertiaryCards) {
                tertiaryCards.innerHTML = myRequests
                    .map(r => renderRequestCard(r))
                    .join('');
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 👤 INDIVIDUAL DASHBOARD
// ═══════════════════════════════════════════════════════════════

async function renderIndividualDashboard(user, profile) {
    const dashSectionTitle = $('dash-section-title');
    if (dashSectionTitle) dashSectionTitle.textContent = 'Available Food Near You';

    // No post or request buttons for individuals
    const postBtn = $('dash-post-btn');
    if (postBtn) postBtn.style.display = 'none';
    const reqBtn = $('dash-request-btn');
    if (reqBtn) reqBtn.style.display = 'none';

    // Loading
    const cardsGrid = $('dash-cards');
    const loading = $('dash-loading');
    const empty = $('dash-empty');

    toggleVisibility(loading, true);
    toggleVisibility(empty, false);

    // Fetch available donations
    const availableDonations = await fetchDonations({ status: 'available' });

    toggleVisibility(loading, false);

    if (availableDonations.length === 0) {
        toggleVisibility(empty, true);
        const emptyText = $('dash-empty-text');
        if (emptyText) emptyText.textContent = 'No food donations available right now. Check back soon!';
    } else {
        const cardsHtml = availableDonations.map(d => renderDonationCard(d, { context: 'dashboard' })).join('');
        if (cardsGrid) cardsGrid.innerHTML = cardsHtml;
    }

    // Fetch user's claim history
    const allClaimed = await fetchDonations({ status: 'claimed' });
    const myClaimed = allClaimed.filter(d => d.claimed_by === user.id);
    const allCompleted = await fetchDonations({ status: 'completed' });
    const myCompleted = allCompleted.filter(d => d.claimed_by === user.id);

    // Stats
    renderStats([
        { icon: 'fa-solid fa-utensils', number: availableDonations.length, label: 'Available Nearby', color: 'green' },
        { icon: 'fa-solid fa-handshake', number: myClaimed.length, label: 'You Claimed', color: 'warm' },
        { icon: 'fa-solid fa-circle-check', number: myCompleted.length, label: 'Picked Up', color: 'blue' },
    ]);

    // Secondary section: Your Claimed Food
    const secondarySection = $('dash-secondary-section');
    if (secondarySection) {
        secondarySection.classList.remove('hidden');
        const secondaryTitle = $('dash-secondary-title');
        if (secondaryTitle) secondaryTitle.textContent = 'Your Claimed Food';

        const secondaryCards = $('dash-secondary-cards');
        const secondaryEmpty = $('dash-secondary-empty');

        const myHistory = [...myClaimed, ...myCompleted];

        if (myHistory.length === 0) {
            if (secondaryEmpty) {
                secondaryEmpty.classList.remove('hidden');
                const emptyText = $('dash-secondary-empty-text');
                if (emptyText) emptyText.textContent = 'You haven\'t claimed any food yet. Browse available donations above and claim what you need!';
            }
            if (secondaryCards) secondaryCards.innerHTML = secondaryEmpty?.outerHTML || '';
        } else {
            if (secondaryCards) {
                secondaryCards.innerHTML = myHistory
                    .map(d => renderDonationCard(d, { context: 'dashboard' }))
                    .join('');
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════════════════════

function renderTabs(tabs) {
    const container = $('dash-tabs');
    if (!container) return;

    container.classList.remove('hidden');
    container.innerHTML = tabs.map(t => `
        <button class="dash-tab ${t.active ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>
    `).join('');

    // Bind tab click events
    container.querySelectorAll('.dash-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            if (window.__dashFilterFn) {
                const filtered = window.__dashFilterFn(tab);
                renderFilteredCards(filtered, tab);
            }
        });
    });
}

function renderFilteredCards(donations, tab) {
    const cardsGrid = $('dash-cards');
    const empty = $('dash-empty');

    if (!cardsGrid) return;

    // Filter based on tab
    let filtered = donations;
    if (tab !== 'all') {
        filtered = donations.filter(d => d.status === tab);
    }

    if (filtered.length === 0) {
        cardsGrid.innerHTML = '';
        toggleVisibility(empty, true);
        const emptyText = $('dash-empty-text');
        if (emptyText) {
            const messages = {
                all: 'No donations found.',
                available: 'No available donations.',
                claimed: 'No claimed donations yet.',
                completed: 'No completed donations yet.',
            };
            emptyText.textContent = messages[tab] || 'Nothing here yet.';
        }
    } else {
        toggleVisibility(empty, false);
        cardsGrid.innerHTML = filtered.map(d => renderDonationCard(d, { context: 'dashboard' })).join('');
    }
}

// ═══════════════════════════════════════════════════════════════
// RENDER STATS
// ═══════════════════════════════════════════════════════════════

function renderStats(stats) {
    const container = $('dash-stats-row');
    if (!container) return;

    container.innerHTML = stats.map(s => `
        <div class="dash-stat">
            <div class="dash-stat-icon ${s.color || ''}"><i class="${s.icon}"></i></div>
            <div class="dash-stat-number">${s.number}</div>
            <div class="dash-stat-label">${escapeHtml(s.label)}</div>
        </div>
    `).join('');
}
