-- Add a proper auth foreign key to facilities (flagged since day one — the app
-- currently links facilities to auth users only by matching email, which is
-- fragile). SAFE to run: additive column + best-effort backfill from auth.users.
-- Run in Supabase SQL editor.

ALTER TABLE facilities ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Backfill existing rows by matching facility email to the auth user email.
UPDATE facilities f
SET user_id = u.id
FROM auth.users u
WHERE f.user_id IS NULL
  AND lower(f.email) = lower(u.email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facilities_user_id ON facilities (user_id);

-- NOTE: after this is backfilled and the backend is updated to set user_id on
-- new facility rows (POST /facility), email-based lookups can migrate to
-- user_id-based ones, and RLS below can key on auth.uid() instead of email.
