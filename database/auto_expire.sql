-- ============================================================
-- Zero Starvation — Auto-Expire Donations After 24 Hours
-- ============================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- 
-- Prerequisites:
--   1. Enable the pg_cron extension:
--      Go to Dashboard → Database → Extensions → Search "pg_cron" → Enable
-- ============================================================

-- ── Function: Mark old donations as expired ──────────────────
-- Sets status = 'expired' for any donation that:
--   - Has status 'available'
--   - Was created more than 24 hours ago
CREATE OR REPLACE FUNCTION expire_old_donations()
RETURNS void AS $$
BEGIN
    UPDATE donations
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'available'
      AND created_at < NOW() - INTERVAL '24 hours';
    
    RAISE NOTICE 'Expired old donations at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Function: Clean up expired donations (after 48 hours) ───
-- Permanently deletes expired donations older than 48 hours
-- to keep the database clean. Remove this if you want to keep them.
CREATE OR REPLACE FUNCTION cleanup_expired_donations()
RETURNS void AS $$
BEGIN
    DELETE FROM donations
    WHERE status = 'expired'
      AND updated_at < NOW() - INTERVAL '48 hours';
    
    RAISE NOTICE 'Cleaned up expired donations at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Schedule: Run expiry every hour ──────────────────────────
-- Note: pg_cron must be enabled in Supabase Dashboard first
-- Dashboard → Database → Extensions → pg_cron → Enable

-- Expire available donations older than 24 hours (runs every hour)
SELECT cron.schedule(
    'expire-old-donations',          -- job name
    '0 * * * *',                     -- every hour at minute 0
    $$SELECT expire_old_donations()$$
);

-- Clean up expired donations older than 48 hours (runs daily at 3 AM)
SELECT cron.schedule(
    'cleanup-expired-donations',     -- job name
    '0 3 * * *',                     -- daily at 3:00 AM UTC
    $$SELECT cleanup_expired_donations()$$
);

-- ── Manual run (optional) ────────────────────────────────────
-- You can run these manually anytime to test:
-- SELECT expire_old_donations();
-- SELECT cleanup_expired_donations();

-- ── View scheduled jobs ──────────────────────────────────────
-- SELECT * FROM cron.job;

-- ── Remove a job (if needed) ─────────────────────────────────
-- SELECT cron.unschedule('expire-old-donations');
-- SELECT cron.unschedule('cleanup-expired-donations');
