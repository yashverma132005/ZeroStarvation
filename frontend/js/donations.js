/**
 * Zero Starvation — Donations Module
 * 
 * CRUD operations for donations, claiming, completing,
 * filtering, and rendering donation cards.
 */

import { supabase, DONATION_STATUS } from './config.js';
import { getCurrentUser, getCurrentProfile, isLoggedIn } from './auth.js';
import {
    $, showToast, setButtonLoading, toggleVisibility,
    escapeHtml, timeAgo, formatExpiry, isExpired, showFormError, hideFormError
} from './utils.js';
import { initDonationFormMap, clearDonationFormMap, initDonationAddressGeocoder } from './map.js';

// ═══════════════════════════════════════════════════════════════
// FETCH DONATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch all donations with optional filters
 */
export async function fetchDonations(filters = {}) {
    let query = supabase
        .from('donations')
        .select(`
            *,
            donor:profiles!donor_id(id, full_name, organization_name, phone, role),
            claimer:profiles!claimed_by(id, full_name, organization_name)
        `)
        .order('created_at', { ascending: false });

    // Apply filters
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }

    if (filters.search) {
        query = query.ilike('food_type', `%${filters.search}%`);
    }

    if (filters.donor_id) {
        query = query.eq('donor_id', filters.donor_id);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Failed to fetch donations:', error);
        showToast('Failed to load donations.', 'error');
        return [];
    }

    let results = data || [];

    // ── 24-Hour Auto-Expiry (client-side) ────────────────────
    // Hide donations older than 24 hours that are still "available"
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    results = results.filter(d => {
        if (d.status === 'available') {
            const createdAt = new Date(d.created_at).getTime();
            if (now - createdAt > TWENTY_FOUR_HOURS) {
                return false; // Expired — hide from results
            }
        }
        return true;
    });

    return results;
}

/**
 * Fetch a single donation by ID
 */
export async function fetchDonation(id) {
    const { data, error } = await supabase
        .from('donations')
        .select(`
            *,
            donor:profiles!donor_id(id, full_name, organization_name, phone, address, role),
            claimer:profiles!claimed_by(id, full_name, organization_name, phone)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Failed to fetch donation:', error);
        return null;
    }

    return data;
}

// ═══════════════════════════════════════════════════════════════
// CREATE DONATION
// ═══════════════════════════════════════════════════════════════

export function openDonationModal() {
    const modal = $('modal-donation');
    if (modal) {
        modal.classList.remove('hidden');
        // Initialize map after modal is visible
        setTimeout(() => {
            initDonationFormMap();
            initDonationAddressGeocoder();
        }, 100);
    }
}

export function closeDonationModal() {
    const modal = $('modal-donation');
    if (modal) {
        modal.classList.add('hidden');
        clearDonationFormMap();
        const form = $('donation-form');
        if (form) form.reset();
        hideFormError('donation-form-error');
    }
}

async function handleCreateDonation(e) {
    e.preventDefault();
    hideFormError('donation-form-error');

    const user = getCurrentUser();
    if (!user) {
        showToast('Please log in first.', 'error');
        return;
    }

    const foodType = $('donation-food-type')?.value?.trim();
    const quantity = $('donation-quantity')?.value?.trim();
    const description = $('donation-description')?.value?.trim();
    const expiry = $('donation-expiry')?.value;
    const contact = $('donation-contact')?.value?.trim();
    const address = $('donation-address')?.value?.trim();
    const lat = parseFloat($('donation-lat')?.value);
    const lng = parseFloat($('donation-lng')?.value);

    // Validate
    if (!foodType || !quantity || !expiry || !contact || !address) {
        showFormError('donation-form-error', 'Please fill in all required fields.');
        return;
    }

    if (isNaN(lat) || isNaN(lng)) {
        showFormError('donation-form-error', 'Please click on the map to set the pickup location.');
        return;
    }

    const btn = $('donation-submit-btn');
    setButtonLoading(btn, true);

    try {
        const { data, error } = await supabase
            .from('donations')
            .insert({
                donor_id: user.id,
                food_type: foodType,
                quantity,
                description,
                expiry_time: new Date(expiry).toISOString(),
                contact_phone: contact,
                address,
                latitude: lat,
                longitude: lng,
                status: DONATION_STATUS.AVAILABLE,
            })
            .select()
            .single();

        if (error) throw error;

        showToast('Donation posted successfully!', 'success');
        closeDonationModal();

        // Refresh the page content
        window.dispatchEvent(new CustomEvent('donations-updated'));
    } catch (err) {
        showFormError('donation-form-error', err.message || 'Failed to post donation.');
    } finally {
        setButtonLoading(btn, false);
    }
}

// ═══════════════════════════════════════════════════════════════
// CLAIM DONATION
// ═══════════════════════════════════════════════════════════════

export async function claimDonation(donationId) {
    const user = getCurrentUser();
    if (!user) {
        showToast('Please log in to claim donations.', 'error');
        return;
    }

    try {
        const { error } = await supabase
            .from('donations')
            .update({
                status: DONATION_STATUS.CLAIMED,
                claimed_by: user.id,
                claimed_at: new Date().toISOString(),
            })
            .eq('id', donationId)
            .eq('status', DONATION_STATUS.AVAILABLE);

        if (error) throw error;

        showToast('Donation claimed! Contact the restaurant for pickup.', 'success');
        window.dispatchEvent(new CustomEvent('donations-updated'));
    } catch (err) {
        showToast('Failed to claim donation. It may already be claimed.', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// COMPLETE DONATION
// ═══════════════════════════════════════════════════════════════

export async function completeDonation(donationId) {
    try {
        const { error } = await supabase
            .from('donations')
            .update({
                status: DONATION_STATUS.COMPLETED,
                completed_at: new Date().toISOString(),
            })
            .eq('id', donationId);

        if (error) throw error;

        showToast('Donation marked as completed!', 'success');
        window.dispatchEvent(new CustomEvent('donations-updated'));
    } catch (err) {
        showToast('Failed to complete donation.', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// DELETE DONATION
// ═══════════════════════════════════════════════════════════════

export async function deleteDonation(donationId) {
    if (!confirm('Are you sure you want to delete this donation?')) return;

    try {
        const { error } = await supabase
            .from('donations')
            .delete()
            .eq('id', donationId);

        if (error) throw error;

        showToast('Donation deleted.', 'info');
        window.dispatchEvent(new CustomEvent('donations-updated'));
    } catch (err) {
        showToast('Failed to delete donation.', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// REQUESTS (NGO Food Requests)
// ═══════════════════════════════════════════════════════════════

export async function fetchRequests(filters = {}) {
    let query = supabase
        .from('requests')
        .select(`
            *,
            requester:profiles!requester_id(id, full_name, organization_name, phone, role)
        `)
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    if (filters.requester_id) {
        query = query.eq('requester_id', filters.requester_id);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Failed to fetch requests:', error);
        return [];
    }

    return data || [];
}

export function openRequestModal() {
    const modal = $('modal-request');
    if (modal) modal.classList.remove('hidden');
}

export function closeRequestModal() {
    const modal = $('modal-request');
    if (modal) {
        modal.classList.add('hidden');
        const form = $('request-form');
        if (form) form.reset();
        hideFormError('request-form-error');
    }
}

async function handleCreateRequest(e) {
    e.preventDefault();
    hideFormError('request-form-error');

    const user = getCurrentUser();
    if (!user) {
        showToast('Please log in first.', 'error');
        return;
    }

    const need = $('request-need')?.value?.trim();
    const quantity = $('request-quantity')?.value?.trim();
    const description = $('request-description')?.value?.trim();
    const urgency = $('request-urgency')?.value;
    const contact = $('request-contact')?.value?.trim();
    const address = $('request-address')?.value?.trim();

    if (!need || !contact || !address) {
        showFormError('request-form-error', 'Please fill in all required fields.');
        return;
    }

    const btn = $('request-submit-btn');
    setButtonLoading(btn, true);

    try {
        const { error } = await supabase
            .from('requests')
            .insert({
                requester_id: user.id,
                food_need: need,
                quantity,
                description,
                urgency,
                contact_phone: contact,
                address,
                status: 'active',
            });

        if (error) throw error;

        showToast('Request posted successfully!', 'success');
        closeRequestModal();
        window.dispatchEvent(new CustomEvent('donations-updated'));
    } catch (err) {
        showFormError('request-form-error', err.message || 'Failed to post request.');
    } finally {
        setButtonLoading(btn, false);
    }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGING
// ═══════════════════════════════════════════════════════════════

let messageTargetDonation = null;
let messageTargetUser = null;

export function openMessageModal(donationId, receiverId) {
    messageTargetDonation = donationId;
    messageTargetUser = receiverId;
    const modal = $('modal-message');
    if (modal) modal.classList.remove('hidden');
}

export function closeMessageModal() {
    const modal = $('modal-message');
    if (modal) {
        modal.classList.add('hidden');
        const form = $('message-form');
        if (form) form.reset();
    }
    messageTargetDonation = null;
    messageTargetUser = null;
}

async function handleSendMessage(e) {
    e.preventDefault();

    const user = getCurrentUser();
    if (!user) {
        showToast('Please log in first.', 'error');
        return;
    }

    const content = $('message-content')?.value?.trim();
    if (!content) return;

    const btn = $('message-submit-btn');
    setButtonLoading(btn, true);

    try {
        const { error } = await supabase
            .from('messages')
            .insert({
                sender_id: user.id,
                receiver_id: messageTargetUser,
                donation_id: messageTargetDonation,
                content,
            });

        if (error) throw error;

        showToast('Message sent!', 'success');
        closeMessageModal();
    } catch (err) {
        showToast('Failed to send message.', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

// ═══════════════════════════════════════════════════════════════
// RENDER DONATION CARD HTML
// ═══════════════════════════════════════════════════════════════

export function renderDonationCard(donation, options = {}) {
    const { showActions = true, context = 'browse' } = options;
    const user = getCurrentUser();
    const profile = getCurrentProfile();
    const isOwner = user && donation.donor_id === user.id;
    const isClaimer = user && donation.claimed_by === user.id;
    const donorName = donation.donor?.organization_name || donation.donor?.full_name || 'Unknown';
    const expired = isExpired(donation.expiry_time);

    let statusBadge = '';
    switch (donation.status) {
        case 'available':
            statusBadge = expired
                ? '<span class="badge badge-expired">Expired</span>'
                : '<span class="badge badge-available"><i class="fa-solid fa-check"></i> Available</span>';
            break;
        case 'claimed':
            statusBadge = '<span class="badge badge-claimed"><i class="fa-solid fa-handshake"></i> Claimed</span>';
            break;
        case 'completed':
            statusBadge = '<span class="badge badge-completed"><i class="fa-solid fa-circle-check"></i> Completed</span>';
            break;
        default:
            statusBadge = `<span class="badge">${donation.status}</span>`;
    }

    let actionsHtml = '';
    if (showActions) {
        const actions = [];

        if (donation.status === 'available' && !expired && !isOwner && profile && profile.role !== 'restaurant') {
            actions.push(`<button class="btn btn-primary btn-sm" onclick="window.__claimDonation('${donation.id}')"><i class="fa-solid fa-check"></i> Claim</button>`);
        }

        if (donation.status === 'available' && !expired && !isOwner && isLoggedIn()) {
            actions.push(`<button class="btn btn-ghost btn-sm" onclick="window.__openMessage('${donation.id}', '${donation.donor_id}')"><i class="fa-solid fa-comment"></i> Contact</button>`);
        }

        if (isOwner && donation.status === 'available') {
            actions.push(`<button class="btn btn-danger btn-sm" onclick="window.__deleteDonation('${donation.id}')"><i class="fa-solid fa-trash"></i> Delete</button>`);
        }

        if ((isOwner || isClaimer) && donation.status === 'claimed') {
            actions.push(`<button class="btn btn-primary btn-sm" onclick="window.__completeDonation('${donation.id}')"><i class="fa-solid fa-circle-check"></i> Mark Complete</button>`);
        }

        actions.push(`<a href="#/donations/${donation.id}" class="btn btn-ghost btn-sm">View Details</a>`);

        if (actions.length > 0) {
            actionsHtml = `<div class="donation-card-actions">${actions.join('')}</div>`;
        }
    }

    let claimerInfo = '';
    if (donation.status === 'claimed' && donation.claimer) {
        const claimerName = donation.claimer.organization_name || donation.claimer.full_name;
        claimerInfo = `<span class="detail-chip"><i class="fa-solid fa-handshake"></i> ${escapeHtml(claimerName)}</span>`;
    }

    return `
        <div class="donation-card" data-donation-id="${donation.id}">
            <div class="donation-card-body">
                <div class="donation-card-header">
                    <div>
                        <div class="donation-card-title">${escapeHtml(donation.food_type)}</div>
                        <div class="donation-card-restaurant">${escapeHtml(donorName)}</div>
                        <div class="donation-card-quantity">${escapeHtml(donation.quantity)}</div>
                    </div>
                    ${statusBadge}
                </div>
                <div class="donation-card-details">
                    <span class="detail-chip ${expired ? 'detail-chip-urgent' : ''}">
                        <i class="fa-regular fa-clock"></i> ${formatExpiry(donation.expiry_time)}
                    </span>
                    <span class="detail-chip"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(donation.address)}</span>
                    <span class="detail-chip"><i class="fa-regular fa-calendar"></i> ${timeAgo(donation.created_at)}</span>
                    ${claimerInfo}
                </div>
                ${actionsHtml}
            </div>
        </div>
    `;
}

/**
 * Render a request card
 */
export function renderRequestCard(request, options = {}) {
    const user = getCurrentUser();
    const isOwner = user && request.requester_id === user.id;
    const requesterName = request.requester?.organization_name || request.requester?.full_name || 'Unknown';

    const urgencyBadge = `<span class="badge badge-${request.urgency}">${request.urgency} priority</span>`;

    let actionsHtml = '';
    if (options.showContact && !isOwner && isLoggedIn()) {
        actionsHtml = `
            <div class="donation-card-actions">
                <a href="tel:${escapeHtml(request.contact_phone)}" class="btn btn-primary btn-sm"><i class="fa-solid fa-phone"></i> Call</a>
                <a href="https://wa.me/${request.contact_phone?.replace(/[\s\-\+]/g, '')}" 
                   target="_blank" class="btn btn-ghost btn-sm"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
            </div>
        `;
    }

    return `
        <div class="donation-card">
            <div class="donation-card-body">
                <div class="donation-card-header">
                    <div>
                        <div class="donation-card-title">${escapeHtml(request.food_need)}</div>
                        <div class="donation-card-restaurant">${escapeHtml(requesterName)}</div>
                    </div>
                    ${urgencyBadge}
                </div>
                <div class="donation-card-details">
                    ${request.description ? `<span class="detail-chip">${escapeHtml(request.description)}</span>` : ''}
                    <span class="detail-chip"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(request.address)}</span>
                    <span class="detail-chip"><i class="fa-solid fa-phone"></i> ${escapeHtml(request.contact_phone)}</span>
                </div>
                ${actionsHtml}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

export function initDonations() {
    // Bind form events
    const donationForm = $('donation-form');
    if (donationForm) donationForm.addEventListener('submit', handleCreateDonation);

    const requestForm = $('request-form');
    if (requestForm) requestForm.addEventListener('submit', handleCreateRequest);

    const messageForm = $('message-form');
    if (messageForm) messageForm.addEventListener('submit', handleSendMessage);

    // Modal close buttons
    $('modal-donation-close')?.addEventListener('click', closeDonationModal);
    $('donation-cancel-btn')?.addEventListener('click', closeDonationModal);

    $('modal-request-close')?.addEventListener('click', closeRequestModal);
    $('request-cancel-btn')?.addEventListener('click', closeRequestModal);

    $('modal-message-close')?.addEventListener('click', closeMessageModal);
    $('message-cancel-btn')?.addEventListener('click', closeMessageModal);

    // Close modals on overlay click
    ['modal-donation', 'modal-request', 'modal-message'].forEach(id => {
        const modal = $(id);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
    });

    // Expose global handlers for inline onclick attributes
    window.__claimDonation = claimDonation;
    window.__completeDonation = completeDonation;
    window.__deleteDonation = deleteDonation;
    window.__openMessage = openMessageModal;
}
