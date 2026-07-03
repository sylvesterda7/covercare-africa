-- Performance indexes for CoverCare hot query paths.
-- SAFE to run anytime — additive, no behavior change. Run in Supabase SQL editor.
--
-- Plain CREATE INDEX (not CONCURRENTLY): the Supabase SQL editor runs in a
-- transaction where CONCURRENTLY is not allowed, and these tables are small
-- enough that the brief lock is negligible.
--
-- Wrapped in table-existence checks: not every table in this list is
-- guaranteed to exist in every environment (e.g. "notifications" is written
-- to with a best-effort .catch(() => {}) in the backend, so the app runs
-- fine without it — but a bare CREATE INDEX on a missing table aborts the
-- whole transaction and silently skips every index after it). Each block
-- below only runs if its table is actually present.

DO $$
BEGIN
  IF to_regclass('public.shifts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_shifts_contact_email   ON shifts (contact_email);
    CREATE INDEX IF NOT EXISTS idx_shifts_status_role     ON shifts (status, role_needed);
    CREATE INDEX IF NOT EXISTS idx_shifts_worker_status   ON shifts (worker_id, status);
    CREATE INDEX IF NOT EXISTS idx_shifts_assigned_worker ON shifts (assigned_to_worker_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_created_at      ON shifts (created_at DESC);

    -- Only if the marketplace migration's parent_shift_id column has been added.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'parent_shift_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_shifts_parent ON shifts (parent_shift_id);
    END IF;
  END IF;

  IF to_regclass('public.workers') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_workers_email ON workers (email);
  END IF;

  IF to_regclass('public.facilities') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_facilities_email ON facilities (email);
  END IF;

  IF to_regclass('public.applications') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_applications_worker ON applications (worker_id);
    CREATE INDEX IF NOT EXISTS idx_applications_shift  ON applications (shift_id);
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications (email, read);
  END IF;

  IF to_regclass('public.facility_branches') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_branches_facility ON facility_branches (facility_email);
  END IF;
END $$;
