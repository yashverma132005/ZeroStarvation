-- ============================================================
-- Zero Starvation — Supabase Database Schema
-- ============================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- This creates all tables, indexes, RLS policies, and triggers.
-- ============================================================

-- ── Enable Extensions ───────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles Table ──────────────────────────────────────────
-- Extends Supabase auth.users with app-specific fields
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('restaurant', 'ngo', 'individual')),
    organization_name TEXT,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Donations Table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    donor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    food_type TEXT NOT NULL,
    quantity TEXT NOT NULL,
    description TEXT,
    expiry_time TIMESTAMPTZ NOT NULL,
    pickup_time_start TIMESTAMPTZ,
    pickup_time_end TIMESTAMPTZ,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    contact_phone TEXT NOT NULL,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'completed', 'expired')),
    claimed_by UUID REFERENCES profiles(id),
    claimed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Requests Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    food_need TEXT NOT NULL,
    description TEXT,
    quantity TEXT,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled')),
    contact_phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Messages Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    donation_id UUID REFERENCES donations(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_claimed_by ON donations(claimed_by);
CREATE INDEX IF NOT EXISTS idx_donations_location ON donations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_donations_expiry ON donations(expiry_time);
CREATE INDEX IF NOT EXISTS idx_requests_requester ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ── Row Level Security (RLS) ────────────────────────────────

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Donations
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donations are viewable by everyone"
    ON donations FOR SELECT
    USING (true);

CREATE POLICY "Restaurants can create donations"
    ON donations FOR INSERT
    WITH CHECK (
        auth.uid() = donor_id
        AND EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'restaurant'
        )
    );

CREATE POLICY "Donors can update their own donations"
    ON donations FOR UPDATE
    USING (auth.uid() = donor_id OR auth.uid() = claimed_by);

CREATE POLICY "Donors can delete their own available donations"
    ON donations FOR DELETE
    USING (auth.uid() = donor_id AND status = 'available');

-- Requests
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requests are viewable by everyone"
    ON requests FOR SELECT
    USING (true);

CREATE POLICY "NGOs and individuals can create requests"
    ON requests FOR INSERT
    WITH CHECK (
        auth.uid() = requester_id
        AND EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ngo', 'individual')
        )
    );

CREATE POLICY "Requesters can update their own requests"
    ON requests FOR UPDATE
    USING (auth.uid() = requester_id);

CREATE POLICY "Requesters can delete their own requests"
    ON requests FOR DELETE
    USING (auth.uid() = requester_id);

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
    ON messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Authenticated users can send messages"
    ON messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can mark messages as read"
    ON messages FOR UPDATE
    USING (auth.uid() = receiver_id);

-- ── Functions & Triggers ────────────────────────────────────

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_donations_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_requests_updated_at
    BEFORE UPDATE ON requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
-- This function runs when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'individual')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user failed: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: create profile after auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions for the trigger to work
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;

-- ── Seed Data (Optional - for demo/testing) ─────────────────
-- Uncomment below to add sample data after creating test users

-- INSERT INTO donations (donor_id, food_type, quantity, description, expiry_time, address, latitude, longitude, contact_phone, status)
-- VALUES
--   ('YOUR_RESTAURANT_USER_UUID', 'Fresh Vegetables & Bread', '50 servings', 'Daily surplus from lunch service', NOW() + INTERVAL '4 hours', 'Downtown Delhi', 28.6139, 77.2090, '+91 98765 43210', 'available'),
--   ('YOUR_RESTAURANT_USER_UUID', 'Cooked Rice & Curry', '30 servings', 'Evening leftover meals', NOW() + INTERVAL '2 hours', 'Connaught Place, Delhi', 28.6315, 77.2167, '+91 87654 32109', 'available');
