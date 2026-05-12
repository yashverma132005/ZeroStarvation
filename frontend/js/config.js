/**
 * Zero Starvation — Supabase Configuration
 * 
 * Initialize the Supabase client with project URL and anon key.
 * Update these values with your own Supabase project credentials.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── Supabase Credentials ────────────────────────────────────
// Replace these with your actual Supabase project credentials
// Found at: Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://hulpxnrbyvvkhqknnoqa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1bHB4bnJieXZ2a2hxa25ub3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MDczMzksImV4cCI6MjA5MjA4MzMzOX0.r0KkdP7Kz5Y1WAUpfu_6OJv75OHY6KkuF4qQgpRldVk';

// ── Create Client ───────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── App Constants ───────────────────────────────────────────
export const ROLES = {
    RESTAURANT: 'restaurant',
    NGO: 'ngo',
    INDIVIDUAL: 'individual',
};

export const DONATION_STATUS = {
    AVAILABLE: 'available',
    CLAIMED: 'claimed',
    COMPLETED: 'completed',
    EXPIRED: 'expired',
};

export const REQUEST_URGENCY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
};

// ── Default Map Center (New Delhi) ──────────────────────────
export const DEFAULT_MAP_CENTER = [28.6139, 77.2090];
export const DEFAULT_MAP_ZOOM = 12;
