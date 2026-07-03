-- Performance indexes for CoverCare hot query paths.
-- SAFE to run anytime — additive, no behavior change. Run in Supabase SQL editor.
-- Plain CREATE INDEX (not CONCURRENTLY): the Supabase SQL editor runs in a
-- transaction where CONCURRENTLY is not allowed, and these tables are small
-- enough that the brief lock is negligible.

CREATE INDEX IF NOT EXISTS idx_shifts_contact_email   ON shifts (contact_email);
CREATE INDEX IF NOT EXISTS idx_shifts_status_role     ON shifts (status, role_needed);
CREATE INDEX IF NOT EXISTS idx_shifts_worker_status   ON shifts (worker_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_assigned_worker ON shifts (assigned_to_worker_id);
CREATE INDEX IF NOT EXISTS idx_shifts_created_at      ON shifts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workers_email          ON workers (email);
CREATE INDEX IF NOT EXISTS idx_facilities_email       ON facilities (email);

CREATE INDEX IF NOT EXISTS idx_applications_worker    ON applications (worker_id);
CREATE INDEX IF NOT EXISTS idx_applications_shift     ON applications (shift_id);

CREATE INDEX IF NOT EXISTS idx_notifications_email    ON notifications (email, read);
CREATE INDEX IF NOT EXISTS idx_branches_facility      ON facility_branches (facility_email);

-- Requires the marketplace migration (parent_shift_id column) to have run first.
-- Safe to skip until then:
CREATE INDEX IF NOT EXISTS idx_shifts_parent          ON shifts (parent_shift_id);
