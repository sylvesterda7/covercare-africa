# CoverCare pre-deployment security checklist — status

Legend: ✅ done in code · 🟡 needs a dashboard action (I can't reach it) · 📄 SQL to run

## Done in code (this hardening pass)
- ✅ **API restricted to own domain** — CORS allowlist, now env-driven (`ALLOWED_ORIGINS`) with the prod domain as a safe fallback; localhost origins only outside production.
- ✅ **API rate limiting** — per-route limiters on sensitive endpoints **plus** a new global per-IP backstop (240/min).
- ✅ **Sanitize inputs** — backend `sanitize()` on writes, `escapeHtml()` at render, Supabase parameterized queries.
- ✅ **Basic logs & alerts** — structured logs; errors now POST to `ALERT_WEBHOOK_URL` if set (Slack/Discord).
- ✅ **Custom error screen** — `404.html` (Vercel auto-serves it).
- ✅ **RBAC** — `requireAdmin` on all admin routes; per-route ownership checks.
- ✅ **Lock users to own data (biggest leaks)** — public open-shift browse and qr-arrive now go through backend endpoints (`/shifts/open`, `/shift/checkin-info`); facility→worker PII now via ownership-checked `/facility/shift-workers`. No more full-table `select("*")` from the browser on those paths.
- ✅ **Dependencies** — `npm audit` clean; Dependabot added (npm + actions weekly); floating `supabase-js@2` CDN pinned to `@2.58.0`.
- ✅ **CI** — GitHub Actions: JS syntax check (both repos) + `npm audit` (backend).

## SQL to run (in `covercare-africa` repo root)
- 📄 **Index main queries** — `sql-indexes.sql` — SAFE, run anytime.
- 📄 **Proper facility auth FK** — `sql-facility-user-id.sql` — SAFE, additive + backfill.
- 📄 **Lock users to own UIDs (full RLS)** — `sql-rls-lockdown.sql` — **STAGING FIRST.** Prerequisite #1 is already done in code; the file explains exactly what to verify in a staging Supabase project before running on prod, and covers facilities/workers/shifts/branches (applications/clients/notifications/ratings are a documented phase 2).

## Dashboard actions (2-minute each — I can't reach these)
- 🟡 **Password reset ≤30 min** — Supabase → Authentication → Email → set reset-token expiry to **1800s** (default is 3600).
- 🟡 **Encrypt sensitive data / private KYC docs** — license & ID images currently upload to Cloudinary with **public URLs**. Set the Cloudinary upload preset to **`access_mode = authenticated`** (or deliver signed URLs) so document URLs aren't publicly guessable. Data at rest (Supabase) and in transit (TLS) are already encrypted.
- 🟡 **Blue-green / rollback** — you already have immutable Vercel deploys + Railway deploy history (both one-click rollback). Enable a **Railway health check on `/health`** (added in this pass) so a broken build never receives traffic.
- 🟡 **Regular backups** — confirm your Supabase plan includes daily backups / PITR (Pro tier). Note: Cloudinary assets are **not** covered by DB backups.

## Deferred (noted, not yet done)
- Behavioral/integration tests need a throwaway test Supabase project (current CI is syntax + audit only).
- Phase 2 RLS for applications/clients/notifications/ratings.
- Hardcoded fallback admin email in `server.js` — left in place intentionally (removing it risks admin lockout if `ADMIN_EMAILS` is unset in Railway). Set `ADMIN_EMAILS` in Railway, then it can be removed.
