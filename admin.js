window._supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

const _supabase = window._supabase;
ccInitInactivityLogout(_supabase);
// ── State ──
let allWorkers = [];
let allFacilities = [];
let allShifts = [];
let currentShiftFilter = "all";
let _adminTransactions = [];

// ── Check session ──
async function init() {
  const { data: { session } } = await _supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const email = session.user.email;

  // ── Verify admin status via backend ──
  const { data: adminCheck } = await ccFetch("/admin/verify", { method: "POST" });

  if (!adminCheck?.admin) {
    document.body.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; min-height:100vh; font-family:sans-serif;">
        <div style="text-align:center; color:#E24B4A;">
          <div style="font-size:48px; margin-bottom:1rem;">🚫</div>
          <h2 style="color:var(--fg-primary); margin-bottom:0.5rem;">Access denied</h2>
          <p style="color:var(--fg-muted);">You don't have admin access.</p>
          <a href="index.html" style="color:#111827; margin-top:1rem; display:block;">Go to homepage</a>
        </div>
      </div>
    `;
    return;
  }

  document.getElementById("navUser").textContent = email;

  // ── Load all data ──
  await Promise.all([
    loadWorkers(),
    loadFacilities(),
    loadShifts(),
    loadAnalytics(),
    loadPerformance(),
    loadTrustedFacilities()
  ]);

  checkAdminBanner();

  // ── Default to analytics tab ──
  showTab("analytics");
  loadNotifications();

  document.addEventListener("click", function(e) {
    const dd = document.getElementById("notifDropdown");
    const btn = document.getElementById("notifBtn");
    if (dd && btn && !dd.contains(e.target) && !btn.contains(e.target)) {
      dd.style.display = "none";
      notifOpen = false;
    }
  });
}

// ── Load workers ──
async function loadWorkers() {
  const { data, error } = await _supabase
    .from("workers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return;
  allWorkers = data;

  renderWorkers(data);
}

// ── Render workers table ──
function renderWorkers(workers) {
  const container = document.getElementById("workersTable");

  if (workers.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No workers found.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>City</th>
            <th>License</th>
            <th>Identity</th>
            <th>Joined</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${workers.map(w => {
            return `
            <tr>
              <td style="color:var(--fg-primary); font-weight:500; cursor:pointer;" onclick="viewWorkerById('${w.id}')">${w.full_name || "—"}</td>
              <td>${w.email || "—"}</td>
              <td>${w.role || "—"}</td>
              <td>${w.city || "—"}</td>
              <td>
                ${w.license_verified
                  ? '<span class="badge badge-accent">✓ Verified</span>'
                  : '<span class="badge badge-yellow">Pending</span>'
                }
              </td>
              <td>
                ${w.identity_verified
                  ? '<span class="badge badge-accent">✓ Verified</span>'
                  : '<span class="badge badge-yellow">Pending</span>'
                }
              </td>
              <td style="color:var(--fg-muted);">
                ${w.created_at ? new Date(w.created_at).toLocaleDateString() : "—"}
              </td>
              <td>
                <button
                  onclick="toggleLicenseVerified('${w.id}', ${w.license_verified})"
                  style="font-size:11px; padding:4px 10px; border-radius:6px; border:1px solid var(--border); background:transparent; color:var(--fg-muted); cursor:pointer; font-family:inherit;">
                  ${w.license_verified ? "Unverify" : "Verify"}
                </button>
                <button
                  onclick="resetAccount('${escapeHtml(w.email)}', 'worker')"
                  style="font-size:11px; padding:4px 10px; border-radius:6px; border:1px solid rgba(226,75,74,0.3); background:transparent; color:#E24B4A; cursor:pointer; font-family:inherit; margin-left:4px;">
                  Reset
                </button>
              </td>
            </tr>
          `}).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ── Filter workers ──
function filterWorkers() {
  const query = document.getElementById("workerSearch").value.toLowerCase();
  const filtered = allWorkers.filter(w =>
    (w.full_name || "").toLowerCase().includes(query) ||
    (w.email || "").toLowerCase().includes(query) ||
    (w.role || "").toLowerCase().includes(query)
  );
  renderWorkers(filtered);
}

// ── Toggle license verified ──
async function toggleLicenseVerified(workerId, currentStatus) {
  const { data: result } = await ccFetch("/admin/toggle-license", {
    method: "POST",
    body: JSON.stringify({
      worker_id: workerId,
      current_status: currentStatus
    })
  });

  if (!result?.success) {
    ccToast("Failed to update worker. Please try again.", "error");
    return;
  }

  await loadWorkers();
}

// ── Load facilities ──
async function loadFacilities() {
  const { data, error } = await _supabase
    .from("facilities")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return;
  allFacilities = data;

  const container = document.getElementById("facilitiesTable");

  if (data.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No facilities registered yet.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Facility name</th>
            <th>Type</th>
            <th>City</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Staff needs</th>
            <th>Billing</th>
            <th>Joined</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(f => `
            <tr>
              <td style="color:var(--fg-primary); font-weight:500; cursor:pointer;" onclick="viewFacilityById('${f.id}')">${f.facility_name || "—"}</td>
              <td>${f.facility_type || "—"}</td>
              <td>${f.city || "—"}</td>
              <td>${f.contact_name || "—"}</td>
              <td>${f.email || "—"}</td>
              <td>${f.staff_needs || "—"}</td>
              <td>
                ${f.billing_model === "postpaid"
                  ? '<span class="badge badge-accent">Postpaid</span>'
                  : '<span class="badge badge-yellow">Prepaid</span>'
                }
                ${f.billing_model !== "postpaid" ? `
                  <button onclick="approveFacility('${escapeHtml(f.email)}')"
                    style="font-size:10px; padding:2px 8px; border-radius:4px; border:1px solid #059669; background:transparent; color:#059669; cursor:pointer; font-family:inherit; margin-left:4px;">
                    Approve
                  </button>
                ` : ""}
              </td>
              <td style="color:var(--fg-muted);">
                ${f.created_at ? new Date(f.created_at).toLocaleDateString() : "—"}
              </td>
              <td>
                <button
                  onclick="resetAccount('${escapeHtml(f.email)}', 'facility')"
                  style="font-size:11px; padding:4px 10px; border-radius:6px; border:1px solid rgba(226,75,74,0.3); background:transparent; color:#E24B4A; cursor:pointer; font-family:inherit;">
                  Reset
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ── Load shifts ──
async function loadShifts() {
  const { data, error } = await _supabase
    .from("shifts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return;
  allShifts = data;
  renderShifts(currentShiftFilter);
}

function renderShifts(filter) {
  const data = filter === "all" ? allShifts : allShifts.filter(s => s.status === filter);
  const container = document.getElementById("shiftsTable");
  if (!container) return;

  if (data.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No shifts found for this filter.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Facility</th>
            <th>Role</th>
            <th>City</th>
            <th>Date</th>
            <th>Duration</th>
            <th>Pay rate</th>
            <th>Total pay</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Posted</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(s => `
            <tr>
              <td style="color:var(--fg-primary); font-weight:500;">${s.facility_name || "—"}</td>
              <td>${s.role_needed || "—"}</td>
              <td>${s.city || "—"}</td>
              <td>${s.shift_date || "—"}</td>
              <td>${s.duration || "—"}</td>
              <td>${s.pay_rate || "—"}</td>
              <td style="color:#111827;">${s.total_pay || "—"}</td>
              <td>
                ${s.payment_status === "paid"
                  ? '<span class="badge badge-accent">✓ Paid</span>'
                  : '<span class="badge badge-yellow">Unpaid</span>'
                }
              </td>
              <td>
                ${s.status === "in_progress"
                  ? '<span class="badge badge-accent" style="background:#111827;color:#fff;">● In progress</span>'
                  : s.status === "open"
                  ? '<span class="badge badge-yellow">Open</span>'
                  : s.status === "accepted"
                  ? '<span class="badge badge-accent">Accepted</span>'
                  : s.status === "cancelled"
                  ? '<span class="badge badge-red">Cancelled</span>'
                  : s.status === "completed"
                  ? '<span class="badge badge-grey">Completed</span>'
                  : '<span class="badge badge-grey">' + (s.status || "—") + '</span>'
                }
              </td>
              <td style="color:var(--fg-muted);">
                ${s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function setShiftFilter(filter) {
  currentShiftFilter = filter;
  document.querySelectorAll("#shiftFilterPills .pill-filter").forEach(btn => {
    btn.classList.toggle("pill-active", btn.dataset.filter === filter);
  });
  renderShifts(filter);
}

// ── Load analytics ──
async function loadAnalytics() {
  const { data: result } = await ccFetch("/admin/analytics", { method: "GET" });
  if (!result?.success) return;

  const totalW = result.totalWorkers || 0;
  const verifiedW = result.verifiedWorkersCount || 0;
  const idVerifiedW = result.identityVerifiedCount || 0;
  const pendingApps = result.pendingApplications || 0;
  const totalShifts = result.totalShifts || 0;
  const paidShifts = result.paidShifts || 0;

  document.getElementById("kpiRevenue").textContent = "GHS " + (result.totalRevenue || 0).toLocaleString();
  document.getElementById("kpiRevenueTrend").textContent = paidShifts + " paid shifts";
  document.getElementById("kpiActiveShifts").textContent = result.activeShifts || 0;
  document.getElementById("kpiFillRate").textContent = (result.fillRate || 0) + "% fill rate";
  document.getElementById("kpiWorkers").textContent = totalW;
  document.getElementById("kpiVerifiedPct").textContent = totalW > 0 ? Math.round((verifiedW / totalW) * 100) + "% verified" : "0% verified";
  document.getElementById("kpiFacilities").textContent = result.totalFacilities || 0;
  document.getElementById("kpiRating").textContent = result.avgRating !== "—" ? result.avgRating + " ★ avg" : "No ratings";
  const totalPaid = paidShifts + (result.pendingApplications || 0);
  document.getElementById("kpiPayments").textContent = totalShifts;
  document.getElementById("kpiPendingPct").textContent = totalShifts > 0 ? Math.round(((totalShifts - paidShifts) / totalShifts) * 100) + "% pending" : "—";
  document.getElementById("kpiInProgress").textContent = result.inProgressShifts || 0;
  document.getElementById("kpiUnfilled").textContent = result.unfilledShifts || 0;

  renderBarChart("workersChart", result.workersByMonth || [], "#111827");
  renderBarChart("shiftsChart", result.shiftsByMonth || [], "#111827");
  renderBarChart("revenueChart", (result.revenueByMonth || []).map(r => ({ ...r, count: r.amount })), "#111827");
}

function renderBarChart(containerId, data, color) {
  const container = document.getElementById(containerId);
  if (!container || !data || data.length === 0) {
    container.innerHTML = '<div style="color:var(--fg-muted); font-size:13px;">No data</div>';
    return;
  }
  const maxVal = Math.max(...data.map(d => d.count || 0), 1);
  container.innerHTML = data.map(d => {
    const pct = Math.max((d.count || 0) / maxVal * 100, 4);
    const val = typeof d.count === "number" ? (d.count % 1 === 0 ? d.count : "GHS " + Number(d.count).toLocaleString()) : d.count;
    return `
      <div class="chart-bar-wrap">
        <div class="chart-bar-value">${val}</div>
        <div class="chart-bar" style="height:${pct}%; background:${color}; opacity:${0.4 + (pct / 100) * 0.6};"></div>
        <div class="chart-bar-label">${d.month || ""}</div>
      </div>
    `;
  }).join("");
}

// ── Performance dashboard ──
async function loadPerformance() {
  const { data: result } = await ccFetch("/admin/performance", { method: "GET" });
  if (!result?.success) return;

  // Summary cards
  const summaryEl = document.getElementById("perfSummaryCards");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="stat-box"><div class="num">${result.workerCount || 0}</div><div class="label">Workers with shifts</div></div>
      <div class="stat-box"><div class="num">${result.facilityCount || 0}</div><div class="label">Active facilities</div></div>
      <div class="stat-box"><div class="num">${result.totalCompleted || 0}</div><div class="label">Completed shifts</div></div>
    `;
  }

  // Top workers
  const topW = document.getElementById("topWorkersTable");
  if (topW) {
    const workers = result.topWorkers || [];
    if (!workers.length) {
      topW.innerHTML = '<div style="color:var(--fg-muted);font-size:13px;text-align:center;padding:1rem;">No worker performance data yet.</div>';
    } else {
      topW.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>#</th><th>Worker</th><th>Role</th><th>Completed</th><th>Earnings</th><th>Rating</th><th>On-time</th></tr></thead>
          <tbody>
            ${workers.map((w, i) => `
              <tr>
                <td style="color:var(--fg-muted);">${i + 1}</td>
                <td style="color:var(--fg-primary);font-weight:500;">${escapeHtml(w.full_name)}</td>
                <td>${escapeHtml(w.role)}</td>
                <td style="font-weight:500;">${w.completed}</td>
                <td style="font-weight:500;">GHS ${w.total_earnings.toLocaleString()}</td>
                <td>${w.avg_rating ? "★ " + w.avg_rating : "—"}</td>
                <td>${w.on_time_rate}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }
  }

  // Top facilities
  const topF = document.getElementById("topFacilitiesTable");
  if (topF) {
    const facilities = result.topFacilities || [];
    if (!facilities.length) {
      topF.innerHTML = '<div style="color:var(--fg-muted);font-size:13px;text-align:center;padding:1rem;">No facility performance data yet.</div>';
    } else {
      topF.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>#</th><th>Facility</th><th>Posted</th><th>Completed</th><th>Fill rate</th><th>Spend</th><th>Rating</th><th>Credits</th></tr></thead>
          <tbody>
            ${facilities.map((f, i) => `
              <tr>
                <td style="color:var(--fg-muted);">${i + 1}</td>
                <td style="color:var(--fg-primary);font-weight:500;">${escapeHtml(f.facility_name)}</td>
                <td>${f.total_posted}</td>
                <td style="font-weight:500;">${f.completed}</td>
                <td>${f.fill_rate}%</td>
                <td style="font-weight:500;">GHS ${f.total_spend.toLocaleString()}</td>
                <td>${f.avg_rating ? "★ " + f.avg_rating : "—"}</td>
                <td>GHS ${f.credits_saved.toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }
  }
}

// ── Tab switching ──
function showTab(tab) {
  ["workers", "facilities", "shifts", "analytics", "performance", "trusted", "finance", "wallet", "settings"].forEach(t => {
    const panel = document.getElementById("panel-" + t);
    if (panel) panel.style.display = t === tab ? "block" : "none";
    const navEl = document.getElementById("nav-" + t);
    if (navEl) navEl.classList.toggle("btn-sidebar-active", t === tab);
  });
  if (tab === "finance") { loadAdminFinanceSummary(); loadAdminFinanceTransactions(); loadAdminInvoices(); }
  if (tab === "wallet") { loadAdminWithdrawals(); }
  if (tab === "settings") loadAdminSettings();
  closeSidebar();
}

function closeSidebar() {
  const sidebar = document.querySelector(".dashboard-sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  const layout = document.querySelector(".dashboard-layout");
  if (!sidebar) return;
  sidebar.classList.remove("open");
  sidebar.classList.add("closed");
  if (overlay) overlay.classList.remove("show");
  if (layout) layout.classList.remove("sidebar-open");
  const dd = document.getElementById("notifDropdown");
  if (dd) dd.style.display = "none";
  notifOpen = false;
}

function toggleSidebar() {
  const sidebar = document.querySelector(".dashboard-sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  const layout = document.querySelector(".dashboard-layout");
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle("open");
  sidebar.classList.toggle("closed", !isOpen);
  if (overlay) overlay.classList.toggle("show", isOpen);
  if (layout) layout.classList.toggle("sidebar-open", isOpen);
}

// ── Logout ──
async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}

// ── Notifications ──
let notifOpen = false;

async function loadNotifications() {
  const { data } = await ccFetch("/notifications", { method: "GET" });
  if (!data) return;

  const badge = document.getElementById("notifBadge");
  const list = document.getElementById("notifList");
  if (!badge || !list) return;

  if (data.unread_count > 0) {
    badge.style.display = "flex";
    badge.textContent = data.unread_count;
  } else {
    badge.style.display = "none";
  }

  if (!data.data || data.data.length === 0) {
    list.innerHTML = '<div style="padding:16px; text-align:center; color:var(--fg-muted); font-size:13px;">No notifications</div>';
    return;
  }

  list.innerHTML = data.data.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markRead('${escapeHtml(n.id)}')" data-id="${escapeHtml(n.id)}">
      <div style="color:var(--fg-muted);">${escapeHtml(n.title)}</div>
      <div style="color:var(--fg-muted); font-size:12px; margin-top:2px;">${escapeHtml(n.message)}</div>
      <div class="notif-time">${n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}</div>
    </div>
  `).join("");
}

function toggleNotifications() {
  notifOpen = !notifOpen;
  const dd = document.getElementById("notifDropdown");
  if (dd) dd.style.display = notifOpen ? "block" : "none";
  if (notifOpen) loadNotifications();
}

async function markRead(id) {
  await ccFetch(`/notifications/${id}/read`, { method: "PUT" });
  loadNotifications();
}

async function markAllRead() {
  await ccFetch("/notifications/read-all", { method: "POST" });
  loadNotifications();
}

// ── Load trusted facilities ──
async function loadTrustedFacilities() {
  const { data: result } = await ccFetch("/admin/trusted-facilities", { method: "GET" });
  if (!result?.success) return;

  const container = document.getElementById("trustedFacilitiesTable");

  const allFacilities = result.data || [];

  if (allFacilities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No trusted facilities yet.</p>
        <p style="font-size:13px;">Approve facilities from the Facilities tab to enable postpaid billing.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Facility</th>
            <th>City</th>
            <th>Email</th>
            <th>Approved by</th>
            <th>Shifts this month</th>
            <th>Monthly charge (GHS)</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${allFacilities.map(f => `
            <tr>
              <td style="color:var(--fg-primary); font-weight:500;">${escapeHtml(f.facility_name || "—")}</td>
              <td>${escapeHtml(f.city || "—")}</td>
              <td>${escapeHtml(f.email || "—")}</td>
              <td>${escapeHtml(f.trusted_by || "—")}</td>
              <td>${f.shift_count || 0}</td>
              <td style="color:#111827; font-weight:500;">${f.monthly_charge ? f.monthly_charge.toLocaleString() : "0"}</td>
              <td>
                <button onclick="revokeFacility('${escapeHtml(f.email)}')"
                  style="font-size:11px; padding:4px 10px; border-radius:6px; border:1px solid rgba(226,75,74,0.3); background:transparent; color:#E24B4A; cursor:pointer; font-family:inherit;">
                  Revoke
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

// ── Approve facility (from facilities tab) ──
async function approveFacility(email) {
  const confirmed = confirm(`Approve ${email} for postpaid billing?`);
  if (!confirmed) return;

  const { data: result } = await ccFetch("/admin/approve-facility", {
    method: "POST",
    body: JSON.stringify({ email })
  });

  if (result?.success) {
    ccToast(`Facility approved for postpaid billing.`, "success");
    await Promise.all([loadFacilities(), loadTrustedFacilities()]);
  } else {
    ccToast(result?.message || "Failed to approve facility.", "error");
  }
}

// ── Revoke facility ──
async function revokeFacility(email) {
  const confirmed = confirm(`Revoke postpaid billing for ${email}? They will need to pay upfront.`);
  if (!confirmed) return;

  const { data: result } = await ccFetch("/admin/revoke-facility", {
    method: "POST",
    body: JSON.stringify({ email })
  });

  if (result?.success) {
    ccToast("Postpaid billing revoked.", "success");
    await Promise.all([loadFacilities(), loadTrustedFacilities()]);
  } else {
    ccToast(result?.message || "Failed to revoke facility.", "error");
  }
}

// ── Admin Finance: summary ──
async function loadAdminFinanceSummary() {
  const container = document.getElementById("adminFinanceSummary");
  if (!container) return;
  const { data: result } = await ccFetch("/finance/admin/summary", { method: "GET" });
  if (!result?.success || !result.data) return;
  const d = result.data;
  const boxes = container.querySelectorAll(".stat-box .num");
  if (boxes[0]) boxes[0].textContent = "GHS " + (d.total_revenue || 0).toLocaleString();
  if (boxes[1]) boxes[1].textContent = "GHS " + (d.pending_postpaid || 0).toLocaleString();
  if (boxes[2]) boxes[2].textContent = "GHS " + (d.this_month_revenue || 0).toLocaleString();
  if (boxes[3]) boxes[3].textContent = "GHS " + (d.total_credits || 0).toLocaleString();
}

// ── Admin Finance: transactions ──
async function loadAdminFinanceTransactions() {
  const container = document.getElementById("adminFinanceTransactions");
  if (!container) return;
  const { data: result } = await ccFetch("/admin/payments", { method: "GET" });
  if (!result?.success || !result.data?.length) {
    container.innerHTML = '<div class="empty-state"><p>No transactions found.</p></div>';
    return;
  }
  const txns = result.data;
  _adminTransactions = txns;
  container.innerHTML = `
    <p style="font-size:13px; color:var(--fg-muted); margin-bottom:12px;">${txns.length} transactions (click a row for details)</p>
    <div style="overflow-x:auto;">
      <table class="admin-table" style="min-width:900px;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Facility</th>
            <th>Shift</th>
            <th>Worker pay</th>
            <th>Facility total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${txns.map(t => {
            const amount = t.facility_total || 0;
            const workerPay = t.total_pay || 0;
            const statusColor = t.payment_status === "paid" || t.payment_status === "completed" ? "#059669" : t.payment_status === "postpaid" ? "#F0B429" : t.payment_status === "held" ? "#E24B4A" : t.payment_status === "refunded" ? "#9ca3af" : "#6b7280";
            const statusLabel = (t.payment_status || "—").charAt(0).toUpperCase() + (t.payment_status || "—").slice(1);
            const actions = paymentActions(t.id, t.payment_status);
            const txnJson = escapeHtml(JSON.stringify(t));
            return `
              <tr onclick='previewAdminTransaction(${txnJson})' style="cursor:pointer;">
                <td style="color:var(--fg-muted); white-space:nowrap;">${t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
                <td style="color:var(--fg-primary); font-weight:500;">${escapeHtml(t.facility_name) || "—"}<br><span style="font-size:11px;color:var(--fg-muted);font-weight:400;">${escapeHtml(t.contact_email) || ""}</span></td>
                <td>${escapeHtml(t.role_needed) || "—"}<br><span style="font-size:11px;color:var(--fg-muted);">${escapeHtml(t.shift_date) || ""}</span></td>
                <td style="color:#111827;">GHS ${workerPay.toLocaleString()}</td>
                <td style="color:#111827; font-weight:500;">GHS ${amount.toLocaleString()}</td>
                <td><span style="color:${statusColor}; font-weight:500;">${statusLabel}</span></td>
                <td><div style="display:flex; gap:4px; flex-wrap:wrap;" onclick="event.stopPropagation();">${actions}</div></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

// ── Transaction preview ──
function previewAdminTransaction(t) {
  const c = document.getElementById("txnPreviewContent");
  if (!c) return;
  const fields = [
    ["Facility", escapeHtml(t.facility_name || "")],
    ["Contact email", escapeHtml(t.contact_email || "")],
    ["Role needed", escapeHtml(t.role_needed || "")],
    ["Shift date", t.shift_date || "—"],
    ["Worker pay", t.total_pay ? "GHS " + Number(t.total_pay).toLocaleString() : "—"],
    ["Facility total", t.facility_total ? "GHS " + Number(t.facility_total).toLocaleString() : "—"],
    ["Facility credit", t.facility_credit ? "GHS " + Number(t.facility_credit).toLocaleString() : "GHS 0"],
    ["Waived", t.waived ? "Yes" : "No"],
    ["Payment status", t.payment_status || "—"],
    ["Paid at", t.paid_at ? new Date(t.paid_at).toLocaleString() : "—"],
    ["Created", t.created_at ? new Date(t.created_at).toLocaleString() : "—"]
  ];
  c.innerHTML = fields.map(([label, val]) => `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);">
      <span style="font-size:13px; color:var(--fg-muted);">${label}</span>
      <span style="font-size:13px; font-weight:500; color:var(--fg-primary);">${val}</span>
    </div>
  `).join("");
  document.getElementById("txnPreviewModal").style.display = "flex";
}

function closeTxnPreview() {
  document.getElementById("txnPreviewModal").style.display = "none";
}

// ── Download statement ──
function downloadAdminStatement() {
  if (!_adminTransactions.length) { ccToast("No transactions to download.", "info"); return; }
  const headers = ["Date", "Facility", "Email", "Role", "Shift date", "Worker pay", "Facility total", "Status"];
  const rows = _adminTransactions.map(t => [
    t.created_at ? new Date(t.created_at).toLocaleDateString() : "",
    t.facility_name || "",
    t.contact_email || "",
    t.role_needed || "",
    t.shift_date || "",
    t.total_pay || 0,
    t.facility_total || 0,
    t.payment_status || ""
  ]);
  downloadCSV(rows, headers, "covercare-admin-statement.csv");
  ccToast("Statement downloaded.", "success");
}

// ── Worker / Facility detail pages ──
function viewWorkerById(id) {
  window.location.href = "admin-detail-worker.html?id=" + encodeURIComponent(id);
}

function viewFacilityById(id) {
  window.location.href = "admin-detail-facility.html?id=" + encodeURIComponent(id);
}
function paymentActions(shiftId, status) {
  const btn = (label, action, color) =>
    `<button onclick="handlePaymentAction('${escapeHtml(shiftId)}', '${action}')" style="font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid ${color};background:transparent;color:${color};cursor:pointer;font-family:inherit;white-space:nowrap;">${label}</button>`;
  switch (status) {
    case "paid": case "completed":
      return btn("Refund", "refund", "#E24B4A") + btn("Hold", "hold", "#F0B429");
    case "postpaid": case "pending":
      return btn("Complete", "complete", "#059669") + btn("Hold", "hold", "#F0B429");
    case "held":
      return btn("Release", "release", "#059669") + btn("Refund", "refund", "#E24B4A");
    case "refunded":
      return '<span style="font-size:11px;color:#9ca3af;">Final</span>';
    default:
      return btn("Complete", "complete", "#059669");
  }
}

async function handlePaymentAction(shiftId, action) {
  const labels = { hold: "Hold", release: "Release", refund: "Refund", complete: "Complete" };
  if (!confirm(`${labels[action] || action} payment for this shift?`)) return;
  const { data: result } = await ccFetch(`/admin/payment/${action}`, {
    method: "POST",
    body: JSON.stringify({ shift_id: shiftId })
  });
  if (result?.success) {
    ccToast(`Payment ${labels[action] || action}ed.`, "success");
    loadAdminFinanceTransactions();
    loadAdminFinanceSummary();
  } else {
    ccToast(result?.message || `Failed to ${action} payment.`, "error");
  }
}

// ── Admin Invoices ──
let _adminInvoices = [];

async function loadAdminInvoices() {
  const container = document.getElementById("adminInvoices");
  if (!container) return;
  const { data: result } = await ccFetch("/finance/admin/invoices", { method: "GET" });
  if (!result?.success) {
    container.innerHTML = '<div class="empty-state"><p>Could not load invoices.</p></div>';
    return;
  }
  const invoices = result.data || [];
  _adminInvoices = invoices;
  if (!invoices.length) {
    container.innerHTML = '<div class="empty-state"><p>No invoices generated yet. Click "Generate invoices" to create them for postpaid facilities.</p></div>';
    return;
  }
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  container.innerHTML = `
    <p style="font-size:13px; color:var(--fg-muted); margin-bottom:12px;">${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}</p>
    <div style="overflow-x:auto;">
      <table class="admin-table" style="min-width:900px;">
        <thead>
          <tr><th>Period</th><th>Facility</th><th>Email</th><th>Amount</th><th>Shifts</th><th>Status</th><th>Due date</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${invoices.map(inv => {
            const statusColor = inv.status === "paid" ? "#059669" : inv.status === "overdue" ? "#E24B4A" : "#F0B429";
            return `<tr>
              <td style="font-weight:500;color:var(--fg-primary);">${monthNames[inv.month - 1] || inv.month} ${inv.year}</td>
              <td style="color:#111827;">${escapeHtml(inv.facility_name)}</td>
              <td style="color:var(--fg-muted);">${escapeHtml(inv.facility_email)}</td>
              <td style="color:#111827;font-weight:500;">GHS ${Number(inv.total_amount).toLocaleString()}</td>
              <td>${inv.shift_count}</td>
              <td><span style="color:${statusColor};font-weight:500;">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span></td>
              <td>${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
              <td>${inv.status !== "paid" ? `<button onclick="markInvoicePaid(${inv.id})" style="font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid #059669;background:transparent;color:#059669;cursor:pointer;font-family:inherit;white-space:nowrap;">Mark paid</button>` : '<span style="font-size:11px;color:#9ca3af;">Paid</span>'}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

async function markInvoicePaid(invoiceId) {
  if (!confirm("Mark this invoice as paid?")) return;
  const { data: result } = await ccFetch(`/finance/admin/invoice/${invoiceId}/pay`, { method: "POST" });
  if (result?.success) {
    ccToast("Invoice marked as paid.", "success");
    loadAdminInvoices();
    loadAdminFinanceSummary();
  } else {
    ccToast(result?.message || "Failed to mark invoice as paid.", "error");
  }
}

async function generateInvoices() {
  if (!confirm("Generate invoices for the previous month for all postpaid facilities?")) return;
  const btn = document.querySelector('#panel-finance button[onclick="generateInvoices()"]');
  if (btn) { btn.disabled = true; btn.textContent = "Generating..."; }
  const { data: result } = await ccFetch("/admin/invoices/generate", { method: "POST" });
  if (btn) { btn.disabled = false; btn.textContent = "Generate invoices"; }
  if (result?.success) {
    ccToast(result.message || "Invoices generated.", "success");
    loadAdminInvoices();
  } else {
    ccToast(result?.message || "Failed to generate invoices.", "error");
  }
}

function downloadAdminInvoices() {
  if (!_adminInvoices.length) { ccToast("No invoices to download.", "info"); return; }
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const headers = ["Period", "Facility", "Email", "Amount", "Shifts", "Status", "Due date", "Paid at"];
  const rows = _adminInvoices.map(inv => [
    `${monthNames[inv.month - 1]} ${inv.year}`, inv.facility_name, inv.facility_email,
    inv.total_amount, inv.shift_count, inv.status, inv.due_date || "", inv.paid_at || ""
  ]);
  downloadCSV(rows, headers, "covercare-admin-invoices.csv");
  ccToast("Invoices downloaded.", "success");
}

// ── Admin Wallet ──
async function loadAdminWithdrawals() {
  const container = document.getElementById("adminWithdrawalRequests");
  if (!container) return;
  const { data: result } = await ccFetch("/admin/wallet/withdrawals", { method: "GET" });
  if (!result?.success) {
    container.innerHTML = '<div class="empty-state"><p>Could not load withdrawals.</p></div>';
    return;
  }
  const requests = result.data || [];
  if (!requests.length) {
    container.innerHTML = '<div class="empty-state"><p>No pending withdrawal requests.</p></div>';
    return;
  }
  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="admin-table" style="min-width:900px;">
        <thead><tr><th>Date</th><th>User</th><th>Type</th><th>Amount</th><th>Bank details</th><th>MoMo details</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${requests.map(r => `<tr>
            <td style="color:var(--fg-muted);white-space:nowrap;">${r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
            <td style="color:var(--fg-primary);font-weight:500;">${escapeHtml(r.user_email)}</td>
            <td>${r.user_type}</td>
            <td style="color:#111827;font-weight:500;">GHS ${Number(r.amount).toLocaleString()}</td>
            <td style="font-size:12px;">${r.bank_name ? escapeHtml(r.bank_name) + "<br>" + escapeHtml(r.bank_account_number || "") : "—"}</td>
            <td style="font-size:12px;">${r.momo_provider ? escapeHtml(r.momo_provider) + "<br>" + escapeHtml(r.momo_number || "") : "—"}</td>
            <td><span style="color:${r.status === "pending" ? "#F0B429" : r.status === "approved" ? "#059669" : "#9ca3af"};">${r.status}</span></td>
            <td>${r.status === "pending" ? `
              <div style="display:flex;gap:4px;">
                <button onclick="adminApproveWithdrawal(${r.id})" style="font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid #059669;background:transparent;color:#059669;cursor:pointer;font-family:inherit;">Approve</button>
                <button onclick="adminRejectWithdrawal(${r.id})" style="font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid #E24B4A;background:transparent;color:#E24B4A;cursor:pointer;font-family:inherit;">Reject</button>
              </div>
            ` : '<span style="font-size:11px;color:#9ca3af;">Processed</span>'}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function adminApproveWithdrawal(id) {
  if (!confirm("Approve this withdrawal? Amount will be deducted from user's wallet.")) return;
  const { data: result } = await ccFetch(`/admin/wallet/withdraw/${id}/approve`, { method: "POST" });
  if (result?.success) { ccToast("Withdrawal approved.", "success"); loadAdminWithdrawals(); }
  else { ccToast(result?.message || "Failed.", "error"); }
}

async function adminRejectWithdrawal(id) {
  if (!confirm("Reject this withdrawal?")) return;
  const { data: result } = await ccFetch(`/admin/wallet/withdraw/${id}/reject`, { method: "POST" });
  if (result?.success) { ccToast("Withdrawal rejected.", "info"); loadAdminWithdrawals(); }
  else { ccToast(result?.message || "Failed.", "error"); }
}

async function adminWalletCredit() {
  const email = document.getElementById("adminWalletEmail").value.trim();
  const amount = parseFloat(document.getElementById("adminWalletAmount").value);
  const description = document.getElementById("adminWalletDescription").value.trim();
  if (!email || !amount || amount <= 0) { ccToast("Valid email and amount required.", "error"); return; }
  if (!confirm(`Credit GHS ${amount.toLocaleString()} to ${email}?`)) return;
  const { data: result } = await ccFetch("/admin/wallet/credit", {
    method: "POST", body: JSON.stringify({ email, amount, description })
  });
  if (result?.success) { ccToast(`Credited GHS ${amount} to ${email}.`, "success"); }
  else { ccToast(result?.message || "Failed.", "error"); }
}

async function adminWalletDebit() {
  const email = document.getElementById("adminWalletEmail").value.trim();
  const amount = parseFloat(document.getElementById("adminWalletAmount").value);
  const description = document.getElementById("adminWalletDescription").value.trim();
  if (!email || !amount || amount <= 0) { ccToast("Valid email and amount required.", "error"); return; }
  if (!confirm(`Debit GHS ${amount.toLocaleString()} from ${email}?`)) return;
  const { data: result } = await ccFetch("/admin/wallet/debit", {
    method: "POST", body: JSON.stringify({ email, amount, description })
  });
  if (result?.success) { ccToast(`Debited GHS ${amount} from ${email}.`, "success"); }
  else { ccToast(result?.message || "Failed.", "error"); }
}

// ── Admin Settings ──
async function loadAdminSettings() {
  const { data: result } = await ccFetch("/settings/admin", { method: "GET" });
  if (!result?.success || !result.data) {
    document.getElementById("setFeePercent").value = 25;
    return;
  }
  const s = result.data;
  document.getElementById("setFeePercent").value = s.covercare_fee_percent || 25;

  const rates = s.suggested_rates || {
    pharmacist: 80, "pharmacy-tech": 40, "medical-doctor": 120,
    nurse: 60, "lab-technician": 50
  };
  const ratesContainer = document.getElementById("adminSuggestedRates");
  if (ratesContainer) {
    ratesContainer.innerHTML = Object.entries(rates).map(([role, rate]) => `
      <div style="display:flex; gap:8px; align-items:center;">
        <span style="min-width:140px; font-size:14px; color:#111827;">${escapeHtml(role.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()))}</span>
        <input id="rate-${escapeHtml(role)}" class="glass-input" type="number" min="10" step="5" value="${rate}" style="max-width:90px;" />
        <span style="font-size:13px; color:var(--fg-muted);">GHS/hr</span>
      </div>
    `).join("");
  }
}

async function saveAdminSetting(key, value) {
  const { data: result } = await ccFetch("/settings/admin", {
    method: "PUT",
    body: JSON.stringify({ key, value: isNaN(value) ? value : parseFloat(value) })
  });
  ccToast(result?.success ? "Setting saved." : result?.message || "Failed.", result?.success ? "success" : "error");
}

async function saveAllSuggestedRates() {
  const rateInputs = document.querySelectorAll("#adminSuggestedRates input[id^='rate-']");
  const rates = {};
  rateInputs.forEach(input => {
    const role = input.id.replace("rate-", "");
    rates[role] = parseFloat(input.value) || 0;
  });
  await saveAdminSetting("suggested_rates", rates);
  ccToast("Suggested rates saved.", "success");
}

// ── Collapsible banner ──
function checkAdminBanner() {
  const banner = document.getElementById("adminBanner");
  if (!banner) return;
  const dismissed = localStorage.getItem("admin_banner_dismissed");
  if (dismissed === "true") { banner.style.display = "none"; return; }
  banner.style.display = "flex";
}

function dismissAdminBanner() {
  const banner = document.getElementById("adminBanner");
  if (banner) banner.style.display = "none";
  localStorage.setItem("admin_banner_dismissed", "true");
}

// ── Reset account ──
async function resetAccount(email, type) {
  const label = type === "worker" ? "worker" : "facility";
  if (!confirm(`Permanently reset this ${label} account? All their data will be deleted. This cannot be undone.`)) return;
  if (!prompt(`Type "${email}" to confirm reset:`) === email) {
    ccToast("Email did not match. Reset cancelled.", "error");
    return;
  }
  const { data: result } = await ccFetch("/admin/reset-account", {
    method: "POST",
    body: JSON.stringify({ email, type })
  });
  if (result?.success) {
    ccToast(`Account reset for ${email}.`, "success");
    if (type === "worker") await loadWorkers();
    else await loadFacilities();
    await loadAnalytics();
  } else {
    ccToast(result?.message || "Failed to reset account.", "error");
  }
}

// ── Run ──
init();