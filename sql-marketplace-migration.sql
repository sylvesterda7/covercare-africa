-- CoverCare marketplace features migration
-- Run in the Supabase SQL editor.
--
-- NOTE: this is the corrected version of the originally proposed migration.
-- Columns like workers_needed, days_needed, late_minutes, adjusted_pay,
-- waived, and facility_credit ALREADY EXIST on shifts and are what the code
-- reads — the originally proposed duplicates (recurrence_days, minutes_late,
-- deduction_amount, is_trusted, payment_terms) are intentionally omitted so
-- we don't create parallel columns the code ignores.

-- ── Facilities: postpaid billing (code already reads these; they were
--    missing in production and broke the trusted-facility flow) ──
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS billing_model TEXT DEFAULT 'prepaid';
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS trusted_by TEXT;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10,2) DEFAULT 0; -- 0 = no limit

-- ── Shifts: geo-verified check-in ──
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checkin_latitude DECIMAL(10,8);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checkin_longitude DECIMAL(11,8);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS checkin_distance_metres INTEGER;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS geo_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS geo_override BOOLEAN DEFAULT FALSE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS geo_override_reason TEXT;

-- ── Shifts: multi-worker postings (sibling rows link to the first row).
--    IMPORTANT: the referenced type must match shifts.id — if shifts.id is
--    not uuid in your project, change the type below accordingly. ──
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS parent_shift_id UUID REFERENCES shifts(id);

-- ── Workers: punctuality counters ──
ALTER TABLE workers ADD COLUMN IF NOT EXISTS on_time_arrivals INTEGER DEFAULT 0;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS late_arrivals INTEGER DEFAULT 0;
