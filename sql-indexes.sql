-- Performance indexes for CoverCare hot query paths.
-- SAFE to run anytime — additive, no behavior change. Run in Supabase SQL editor.
-- CONCURRENTLY avoids locking the tables during creation.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_contact_email   ON shifts (contact_email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_status_role     ON shifts (status, role_needed);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_worker_status   ON shifts (worker_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_assigned_worker ON shifts (assigned_to_worker_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_created_at      ON shifts (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_parent          ON shifts (parent_shift_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workers_email          ON workers (email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_facilities_email       ON facilities (email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_worker    ON applications (worker_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_shift     ON applications (shift_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_email    ON notifications (email, read);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_branches_facility      ON facility_branches (facility_id);
