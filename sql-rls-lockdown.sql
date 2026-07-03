-- =====================================================================
-- RLS LOCKDOWN — STAGING FIRST. DO NOT RUN ON PRODUCTION UNTIL THE
-- PREREQUISITE FRONTEND QUERIES (below) ARE MOVED TO BACKEND ENDPOINTS.
-- =====================================================================
--
-- Today RLS on shifts/facilities/workers is effectively "read for all", so the
-- publishable anon key (shipped in config.js by design) lets anyone dump those
-- tables via the REST API. The worst leaks (public open-shift listing, qr-arrive
-- worker PII) are already closed by backend endpoints (/shifts/open,
-- /shift/checkin-info). The policies below close the rest by keying on the
-- caller's authenticated email (Supabase exposes it as auth.jwt() ->> 'email').
--
-- ---------------------------------------------------------------------
-- STATUS OF PREREQUISITES:
--   1. [DONE in the security-hardening PR] dashboard-facility.js worker reads
--      now go through backend POST /facility/shift-workers (ownership-checked),
--      so a facility only sees workers tied to its own shifts.
--   2. [HANDLED BELOW] worker dashboard reads facility_branches for its shifts;
--      branch name/address is location data the worker needs, so it gets an
--      authenticated-read policy rather than a lockdown.
--
-- STILL REQUIRED BEFORE RUNNING ON PRODUCTION:
--   - Test the facility AND worker dashboards against these policies in a
--     STAGING Supabase project. Watch the browser network tab for any 401/empty
--     reads and migrate that specific query to a backend endpoint before prod.
--   - This file scopes RLS to facilities/workers/shifts/facility_branches only.
--     applications / clients / notifications / ratings are still public and are
--     a documented PHASE 2 (same email-owner pattern) — enabling just these
--     four tables is internally consistent and won't break the others.
-- ---------------------------------------------------------------------
--
-- Rollback for any table:  ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
--                          DROP POLICY IF EXISTS <name> ON <t>;

-- Helper expression used below: current authenticated email
--   (auth.jwt() ->> 'email')

-- ── facilities: a user sees/edits only their own facility row ──
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facilities public read" ON facilities;
DROP POLICY IF EXISTS "facilities public insert" ON facilities;
CREATE POLICY "facility owner read"   ON facilities FOR SELECT
  USING (lower(email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "facility owner insert" ON facilities FOR INSERT
  WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "facility owner update" ON facilities FOR UPDATE
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- ── workers: a worker sees/edits only their own profile row ──
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workers public read" ON workers;
DROP POLICY IF EXISTS "workers public insert" ON workers;
CREATE POLICY "worker owner read"   ON workers FOR SELECT
  USING (lower(email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "worker owner insert" ON workers FOR INSERT
  WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "worker owner update" ON workers FOR UPDATE
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- ── shifts: facility sees its own postings; worker sees shifts assigned to them.
--    (The public "open shifts" browse path no longer reads this table directly —
--     it goes through the backend /shifts/open endpoint with the service role.) ──
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shifts public read" ON shifts;
DROP POLICY IF EXISTS "shifts public insert" ON shifts;
CREATE POLICY "shift facility read" ON shifts FOR SELECT
  USING (lower(contact_email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "shift worker read" ON shifts FOR SELECT
  USING (worker_id IN (
    SELECT id::text FROM workers WHERE lower(email) = lower(auth.jwt() ->> 'email')
  ));
-- Shift creation/payment goes through the backend (service role), so no
-- anon INSERT policy is defined here.

-- ── facility_branches: any authenticated user may read (workers need branch
--    name/address/coordinates for shifts they're assigned to); only the owning
--    facility may write. Branch locations are not sensitive PII. ──
ALTER TABLE facility_branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branches public read" ON facility_branches;
CREATE POLICY "branches authenticated read" ON facility_branches FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "branches owner write" ON facility_branches FOR ALL
  USING (lower(facility_email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(facility_email) = lower(auth.jwt() ->> 'email'));

-- NOTE: the service-role key used by the backend BYPASSES RLS entirely, so all
-- backend endpoints continue to work unchanged. Only direct browser (anon-key)
-- access is constrained by the policies above.
