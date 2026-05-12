/**
 * Zero Starvation — Map Module
 * 
 * Leaflet + OpenStreetMap integration for:
 * - Donation form location picker
 * - Browse donations map view
 * - Donation detail map
 * - Profile location map
 */

import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from './config.js';
import { getCurrentProfile, updateProfileLocation } from './auth.js';
import { $ } from './utils.js';

// ── Map Instances ───────────────────────────────────────────
let donationFormMap = null;
let donationFormMarker = null;
let browseDonationsMap = null;
let browseMarkers = [];
let detailMap = null;
let profileMap = null;
let profileMarker = null;

// ═══════════════════════════════════════════════════════════════
// DONATION FORM MAP (Location Picker)
// ═══════════════════════════════════════════════════════════════

export function initDonationFormMap() {
    const container = $('donation-map');
    if (!container) return;

    // Destroy old map if exists
    if (donationFormMap) {
        donationFormMap.remove();
        donationFormMap = null;
        donationFormMarker = null;
    }

    const profile = getCurrentProfile();
    const center = (profile?.latitude && profile?.longitude)
        ? [profile.latitude, profile.longitude]
        : DEFAULT_MAP_CENTER;

    donationFormMap = L.map('donation-map').setView(center, DEFAULT_MAP_ZOOM);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(donationFormMap);

    // Click to place marker
    donationFormMap.on('click', (e) => {
        const { lat, lng } = e.latlng;

        if (donationFormMarker) {
            donationFormMarker.setLatLng(e.latlng);
        } else {
            donationFormMarker = L.marker(e.latlng, { draggable: true }).addTo(donationFormMap);
            donationFormMarker.on('dragend', () => {
                const pos = donationFormMarker.getLatLng();
                updateDonationCoords(pos.lat, pos.lng);
            });
        }

        updateDonationCoords(lat, lng);
    });

    // Invalidate size after render
    setTimeout(() => donationFormMap.invalidateSize(), 200);
}

function updateDonationCoords(lat, lng) {
    const latInput = $('donation-lat');
    const lngInput = $('donation-lng');
    if (latInput) latInput.value = lat;
    if (lngInput) lngInput.value = lng;
}

export function clearDonationFormMap() {
    if (donationFormMap) {
        donationFormMap.remove();
        donationFormMap = null;
        donationFormMarker = null;
    }
    updateDonationCoords('', '');
}

// ═══════════════════════════════════════════════════════════════
// BROWSE DONATIONS MAP
// ═══════════════════════════════════════════════════════════════

export function initBrowseDonationsMap(donations = []) {
    const container = $('donations-map');
    if (!container) return;

    // Destroy old map
    if (browseDonationsMap) {
        browseDonationsMap.remove();
        browseDonationsMap = null;
        browseMarkers = [];
    }

    browseDonationsMap = L.map('donations-map').setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(browseDonationsMap);

    updateBrowseMapMarkers(donations);

    setTimeout(() => browseDonationsMap.invalidateSize(), 200);
}

export function updateBrowseMapMarkers(donations = []) {
    if (!browseDonationsMap) return;

    // Clear existing markers
    browseMarkers.forEach(m => m.remove());
    browseMarkers = [];

    const bounds = [];

    donations.forEach(d => {
        if (!d.latitude || !d.longitude) return;

        const marker = L.marker([d.latitude, d.longitude])
            .addTo(browseDonationsMap)
            .bindPopup(`
                <div style="min-width:180px">
                    <strong>${d.food_type || 'Food Donation'}</strong><br>
                    <span style="color:#6b7280;font-size:0.85em">${d.quantity || ''}</span><br>
                    <span style="color:#6b7280;font-size:0.85em">${d.address || ''}</span><br>
                    <a href="#/donations/${d.id}" style="color:#2D6A4F;font-weight:600;font-size:0.9em">View Details →</a>
                </div>
            `);

        browseMarkers.push(marker);
        bounds.push([d.latitude, d.longitude]);
    });

    // Fit map to show all markers
    if (bounds.length > 0) {
        browseDonationsMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
}

export function destroyBrowseMap() {
    if (browseDonationsMap) {
        browseDonationsMap.remove();
        browseDonationsMap = null;
        browseMarkers = [];
    }
}

// ═══════════════════════════════════════════════════════════════
// DONATION DETAIL MAP
// ═══════════════════════════════════════════════════════════════

export function initDetailMap(containerId, lat, lng, popupText = '') {
    const container = $(containerId);
    if (!container || !lat || !lng) return;

    if (detailMap) {
        detailMap.remove();
        detailMap = null;
    }

    detailMap = L.map(containerId).setView([lat, lng], 15);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(detailMap);

    const marker = L.marker([lat, lng]).addTo(detailMap);
    if (popupText) {
        marker.bindPopup(popupText).openPopup();
    }

    setTimeout(() => detailMap.invalidateSize(), 200);
}

export function destroyDetailMap() {
    if (detailMap) {
        detailMap.remove();
        detailMap = null;
    }
}

// ═══════════════════════════════════════════════════════════════
// PROFILE MAP (Location Picker)
// ═══════════════════════════════════════════════════════════════

export function initProfileMap() {
    const container = $('profile-map');
    if (!container) return;

    if (profileMap) {
        profileMap.remove();
        profileMap = null;
        profileMarker = null;
    }

    const profile = getCurrentProfile();
    const center = (profile?.latitude && profile?.longitude)
        ? [profile.latitude, profile.longitude]
        : DEFAULT_MAP_CENTER;

    profileMap = L.map('profile-map').setView(center, DEFAULT_MAP_ZOOM);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(profileMap);

    // Place existing marker if location is set
    if (profile?.latitude && profile?.longitude) {
        profileMarker = L.marker([profile.latitude, profile.longitude], { draggable: true })
            .addTo(profileMap);

        profileMarker.on('dragend', () => {
            const pos = profileMarker.getLatLng();
            updateProfileLocation(pos.lat, pos.lng);
        });
    }

    // Click to place/move marker
    profileMap.on('click', (e) => {
        const { lat, lng } = e.latlng;

        if (profileMarker) {
            profileMarker.setLatLng(e.latlng);
        } else {
            profileMarker = L.marker(e.latlng, { draggable: true }).addTo(profileMap);
            profileMarker.on('dragend', () => {
                const pos = profileMarker.getLatLng();
                updateProfileLocation(pos.lat, pos.lng);
            });
        }

        updateProfileLocation(lat, lng);
    });

    setTimeout(() => profileMap.invalidateSize(), 200);
}

export function destroyProfileMap() {
    if (profileMap) {
        profileMap.remove();
        profileMap = null;
        profileMarker = null;
    }
}

// ═══════════════════════════════════════════════════════════════
// DIRECTIONS LINK
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a Google Maps directions URL
 */
export function getDirectionsUrl(lat, lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// ═══════════════════════════════════════════════════════════════
// GEOCODING (Address → Lat/Lng)
// ═══════════════════════════════════════════════════════════════

/**
 * Convert a text address to latitude/longitude using Nominatim (OpenStreetMap).
 * Returns { lat, lng, displayName } or null if not found.
 */
export async function geocodeAddress(address) {
    if (!address || address.trim().length < 3) return null;

    try {
        const encoded = encodeURIComponent(address.trim());
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1&countrycodes=in`;

        const response = await fetch(url, {
            headers: { 'Accept-Language': 'en' },
        });

        if (!response.ok) return null;

        const results = await response.json();
        if (results.length === 0) return null;

        return {
            lat: parseFloat(results[0].lat),
            lng: parseFloat(results[0].lon),
            displayName: results[0].display_name,
        };
    } catch (err) {
        console.warn('Geocoding failed:', err.message);
        return null;
    }
}

/**
 * Attach a geocode-on-blur listener to an address input.
 * When the user finishes typing an address, it auto-geocodes and
 * places a marker on the given map.
 */
export function attachAddressGeocoder(inputId, options = {}) {
    const input = $(inputId);
    if (!input) return;

    let debounceTimer = null;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const address = input.value.trim();
            if (address.length < 5) return;

            const result = await geocodeAddress(address);
            if (!result) return;

            // Call the callback with the geocoded coordinates
            if (options.onGeocode) {
                options.onGeocode(result.lat, result.lng, result.displayName);
            }
        }, 800); // Wait 800ms after user stops typing
    });
}

/**
 * Set up auto-geocoding on the donation form address input.
 * When the address is typed, it places a marker on the donation form map.
 */
export function initDonationAddressGeocoder() {
    attachAddressGeocoder('donation-address', {
        onGeocode: (lat, lng) => {
            if (donationFormMap) {
                donationFormMap.setView([lat, lng], 15);

                if (donationFormMarker) {
                    donationFormMarker.setLatLng([lat, lng]);
                } else {
                    donationFormMarker = L.marker([lat, lng], { draggable: true }).addTo(donationFormMap);
                    donationFormMarker.on('dragend', () => {
                        const pos = donationFormMarker.getLatLng();
                        updateDonationCoords(pos.lat, pos.lng);
                    });
                }

                updateDonationCoords(lat, lng);
            }
        },
    });
}

/**
 * Set up auto-geocoding on the profile address input.
 * When the address is typed, it places a marker on the profile map.
 */
export function initProfileAddressGeocoder() {
    attachAddressGeocoder('profile-edit-address', {
        onGeocode: (lat, lng) => {
            if (profileMap) {
                profileMap.setView([lat, lng], 15);

                if (profileMarker) {
                    profileMarker.setLatLng([lat, lng]);
                } else {
                    profileMarker = L.marker([lat, lng], { draggable: true }).addTo(profileMap);
                    profileMarker.on('dragend', () => {
                        const pos = profileMarker.getLatLng();
                        updateProfileLocation(pos.lat, pos.lng);
                    });
                }

                updateProfileLocation(lat, lng);
            }
        },
    });
}

