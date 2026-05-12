/**
 * Zero Starvation — Authentication Module
 * 
 * Handles login, signup, logout, session management,
 * and UI updates based on auth state.
 */

import { supabase, ROLES } from './config.js';
import { geocodeAddress } from './map.js';
import {
    $, showToast, setButtonLoading, showFormError, hideFormError,
    isValidEmail, getInitials, toggleVisibility, getHashParams, capitalize
} from './utils.js';

// ── State ───────────────────────────────────────────────────
let currentUser = null;
let currentProfile = null;

export function getCurrentUser() { return currentUser; }
export function getCurrentProfile() { return currentProfile; }

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

export async function initAuth() {
    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            currentUser = session.user;
            await loadProfile();
            updateAuthUI(true);
        } else {
            currentUser = null;
            currentProfile = null;
            updateAuthUI(false);
        }
    });

    // Check existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        currentUser = session.user;
        await loadProfile();
        updateAuthUI(true);
    }

    // Bind form events
    bindAuthEvents();
}

// ═══════════════════════════════════════════════════════════════
// LOAD USER PROFILE
// ═══════════════════════════════════════════════════════════════

export async function loadProfile() {
    if (!currentUser) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error) {
        console.error('Failed to load profile:', error);
        return null;
    }

    currentProfile = data;
    return data;
}

// ═══════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════

async function handleLogin(e) {
    e.preventDefault();
    hideFormError('login-error');

    const email = $('login-email')?.value?.trim();
    const password = $('login-password')?.value;

    // Validate
    if (!email || !password) {
        showFormError('login-error', 'Please fill in all fields.');
        return;
    }

    if (!isValidEmail(email)) {
        showFormError('login-error', 'Please enter a valid email address.');
        return;
    }

    const btn = $('login-submit-btn');
    setButtonLoading(btn, true);

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        showToast('Welcome back!', 'success');
        
        // Navigate to dashboard
        window.location.hash = '#/dashboard';
    } catch (err) {
        showFormError('login-error', err.message || 'Login failed. Please try again.');
    } finally {
        setButtonLoading(btn, false);
    }
}

// ═══════════════════════════════════════════════════════════════
// SIGNUP
// ═══════════════════════════════════════════════════════════════

async function handleSignup(e) {
    e.preventDefault();
    hideFormError('signup-error');

    const name = $('signup-name')?.value?.trim();
    const org = $('signup-org')?.value?.trim();
    const email = $('signup-email')?.value?.trim();
    const phone = $('signup-phone')?.value?.trim();
    const address = $('signup-address')?.value?.trim();
    const password = $('signup-password')?.value;
    const confirm = $('signup-confirm')?.value;
    const role = getSelectedRole();

    // Validate
    if (!name || !email || !password) {
        showFormError('signup-error', 'Please fill in all required fields.');
        return;
    }

    if (!isValidEmail(email)) {
        showFormError('signup-error', 'Please enter a valid email address.');
        return;
    }

    if (password.length < 6) {
        showFormError('signup-error', 'Password must be at least 6 characters.');
        return;
    }

    if (password !== confirm) {
        showFormError('signup-error', 'Passwords do not match.');
        return;
    }

    const btn = $('signup-submit-btn');
    setButtonLoading(btn, true);

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    role: role,
                },
            },
        });

        if (error) throw error;

        // Update profile with additional info (phone, org, address)
        // The trigger creates the profile row, but it may take a moment
        if (data.user) {
            await updateProfileAfterSignup(data.user.id, {
                phone,
                organization_name: org,
                address,
            });
        }

        // Check if email confirmation is required
        if (data.user && !data.session) {
            showToast('Account created! Please check your email to confirm.', 'info', 6000);
            window.location.hash = '#/login';
        } else {
            showToast('Welcome to Zero Starvation!', 'success');
            window.location.hash = '#/dashboard';
        }
    } catch (err) {
        showFormError('signup-error', err.message || 'Signup failed. Please try again.');
    } finally {
        setButtonLoading(btn, false);
    }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE PROFILE AFTER SIGNUP
// ═══════════════════════════════════════════════════════════════

/**
 * Update profile with additional fields after the auth trigger creates the row.
 * Retries once after a short delay to give the trigger time to execute.
 */
async function updateProfileAfterSignup(userId, fields) {
    const updateFields = {};
    if (fields.phone) updateFields.phone = fields.phone;
    if (fields.organization_name) updateFields.organization_name = fields.organization_name;
    if (fields.address) updateFields.address = fields.address;

    // Auto-geocode the address to get lat/lng
    if (fields.address) {
        try {
            const geo = await geocodeAddress(fields.address);
            if (geo) {
                updateFields.latitude = geo.lat;
                updateFields.longitude = geo.lng;
                console.log('Geocoded address:', fields.address, '→', geo.lat, geo.lng);
            }
        } catch (err) {
            console.warn('Geocoding during signup failed:', err.message);
        }
    }

    // Nothing to update
    if (Object.keys(updateFields).length === 0) return;

    // Wait for the trigger to create the profile row
    await new Promise(r => setTimeout(r, 1500));

    // Try updating
    const { error } = await supabase
        .from('profiles')
        .update(updateFields)
        .eq('id', userId);

    if (error) {
        // Retry once more after another delay
        console.warn('Profile update failed, retrying...', error.message);
        await new Promise(r => setTimeout(r, 1500));

        const { error: retryError } = await supabase
            .from('profiles')
            .update(updateFields)
            .eq('id', userId);

        if (retryError) {
            console.error('Profile update retry failed:', retryError.message);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════


export async function handleLogout() {
    try {
        await supabase.auth.signOut();
        currentUser = null;
        currentProfile = null;
        showToast('Logged out successfully.', 'info');
        window.location.hash = '#/';
    } catch (err) {
        showToast('Logout failed.', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// PROFILE UPDATE
// ═══════════════════════════════════════════════════════════════

export async function handleProfileUpdate(e) {
    e.preventDefault();

    if (!currentUser) {
        showToast('Please log in first.', 'error');
        return;
    }

    const name = $('profile-edit-name')?.value?.trim();
    const org = $('profile-edit-org')?.value?.trim();
    const phone = $('profile-edit-phone')?.value?.trim();
    const address = $('profile-edit-address')?.value?.trim();

    const btn = $('profile-save-btn');
    setButtonLoading(btn, true);

    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: name,
                organization_name: org,
                phone,
                address,
            })
            .eq('id', currentUser.id);

        if (error) throw error;

        await loadProfile();
        renderProfilePage();
        showToast('Profile updated!', 'success');
    } catch (err) {
        showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

// Update profile location from map
export async function updateProfileLocation(lat, lng) {
    if (!currentUser) return;
    
    try {
        await supabase
            .from('profiles')
            .update({ latitude: lat, longitude: lng })
            .eq('id', currentUser.id);
        
        if (currentProfile) {
            currentProfile.latitude = lat;
            currentProfile.longitude = lng;
        }
    } catch (err) {
        console.error('Location update failed:', err);
    }
}

// ═══════════════════════════════════════════════════════════════
// UI UPDATES
// ═══════════════════════════════════════════════════════════════

function updateAuthUI(loggedIn) {
    toggleVisibility('auth-buttons-guest', !loggedIn);
    toggleVisibility('auth-buttons-user', loggedIn);
    toggleVisibility('mobile-auth-guest', !loggedIn);
    toggleVisibility('mobile-auth-user', loggedIn);

    if (loggedIn && currentProfile) {
        const initials = getInitials(currentProfile.full_name);
        
        const avatar = $('avatar-circle');
        if (avatar) avatar.textContent = initials;

        const dropdownName = $('dropdown-name');
        if (dropdownName) dropdownName.textContent = currentProfile.full_name || 'User';

        const dropdownRole = $('dropdown-role');
        if (dropdownRole) dropdownRole.textContent = capitalize(currentProfile.role);
    }
}

export function renderProfilePage() {
    if (!currentProfile) return;

    const p = currentProfile;
    const initials = getInitials(p.full_name);

    const profileAvatar = $('profile-avatar');
    if (profileAvatar) profileAvatar.textContent = initials;

    const profileName = $('profile-display-name');
    if (profileName) profileName.textContent = p.full_name || 'User';

    const roleBadge = $('profile-role-badge');
    if (roleBadge) roleBadge.textContent = capitalize(p.role);

    const profileEmail = $('profile-email');
    if (profileEmail) profileEmail.textContent = p.email || '—';

    const profilePhone = $('profile-phone');
    if (profilePhone) profilePhone.textContent = p.phone || '—';

    const profileOrg = $('profile-org');
    if (profileOrg) profileOrg.textContent = p.organization_name || '—';

    const profileAddress = $('profile-address');
    if (profileAddress) profileAddress.textContent = p.address || '—';

    const profileJoined = $('profile-joined');
    if (profileJoined) {
        profileJoined.textContent = new Date(p.created_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    // Fill edit form
    const editName = $('profile-edit-name');
    if (editName) editName.value = p.full_name || '';

    const editOrg = $('profile-edit-org');
    if (editOrg) editOrg.value = p.organization_name || '';

    const editPhone = $('profile-edit-phone');
    if (editPhone) editPhone.value = p.phone || '';

    const editAddress = $('profile-edit-address');
    if (editAddress) editAddress.value = p.address || '';
}

// ═══════════════════════════════════════════════════════════════
// ROLE SELECTOR
// ═══════════════════════════════════════════════════════════════

function getSelectedRole() {
    const active = document.querySelector('.role-option.active');
    return active?.dataset?.role || ROLES.RESTAURANT;
}

function initRoleSelector() {
    const { params } = getHashParams();
    const preselectedRole = params.get('role');

    const options = document.querySelectorAll('.role-option');
    options.forEach(opt => {
        // Pre-select role from URL if present
        if (preselectedRole && opt.dataset.role === preselectedRole) {
            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            updateOrgLabel(preselectedRole);
        }

        opt.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            updateOrgLabel(opt.dataset.role);
        });
    });
}

function updateOrgLabel(role) {
    const label = $('signup-org-label');
    if (!label) return;

    switch (role) {
        case ROLES.RESTAURANT:
            label.textContent = 'Restaurant Name';
            break;
        case ROLES.NGO:
            label.textContent = 'NGO / Organization Name';
            break;
        case ROLES.INDIVIDUAL:
            label.textContent = 'Organization (Optional)';
            break;
    }
}

// ═══════════════════════════════════════════════════════════════
// USER DROPDOWN
// ═══════════════════════════════════════════════════════════════

function initUserDropdown() {
    const btn = $('user-avatar-btn');
    const dropdown = $('user-dropdown');

    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden');
        btn.setAttribute('aria-expanded', !isOpen);
    });

    // Close dropdown on outside click
    document.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
    });

    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// ═══════════════════════════════════════════════════════════════
// EVENT BINDING
// ═══════════════════════════════════════════════════════════════

function bindAuthEvents() {
    // Login form
    const loginForm = $('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    // Signup form
    const signupForm = $('signup-form');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);

    // Profile form
    const profileForm = $('profile-form');
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);

    // Logout buttons
    const logoutBtn = $('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const mobileLogoutBtn = $('mobile-logout-btn');
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);

    // Role selector
    initRoleSelector();

    // User dropdown
    initUserDropdown();
}

// ═══════════════════════════════════════════════════════════════
// AUTH GUARDS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if user is logged in, redirect to login if not
 */
export function requireAuth() {
    if (!currentUser) {
        showToast('Please log in to access this page.', 'warning');
        window.location.hash = '#/login';
        return false;
    }
    return true;
}

/**
 * Check if user has a specific role
 */
export function requireRole(role) {
    if (!requireAuth()) return false;
    if (currentProfile?.role !== role) {
        showToast('You don\'t have permission to access this.', 'error');
        return false;
    }
    return true;
}

/**
 * Check if user is logged in (returns boolean, no redirect)
 */
export function isLoggedIn() {
    return !!currentUser;
}
