window._supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

const _supabase = window._supabase;
ccInitInactivityLogout(_supabase);
// ── State ──
let allWorkers = [];
let allFacilities = [];
let allShifts = [];

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
    loadTrustedFacilities()
  ]);
}

// ── Load workers ──
async function loadWorkers() {
  const { data, error } = await _supabase
    .from("workers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return;
  allWorkers = data;

  // ── Update stats ──
  document.getElementById("totalWorkers").textContent = data.length;
  document.getElementById("verifiedWorkers").textContent =
    data.filter(w => w.license_verified).length;

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
          ${workers.map(w => `
            <tr>
              <td style="color:var(--fg-primary); font-weight:500;">${w.full_name || "—"}</td>
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
              </td>
            </tr>
          `).join("")}
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

  document.getElementById("totalFacilities").textContent = data.length;

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
          </tr>
        </thead>
        <tbody>
          ${data.map(f => `
            <tr>
              <td style="color:var(--fg-primary); font-weight:500;">${f.facility_name || "—"}</td>
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

  const paidShifts = data.filter(s => s.payment_status === "paid");

  document.getElementById("totalShifts").textContent = data.length;
  document.getElementById("paidShifts").textContent = paidShifts.length;

  // ── Estimate revenue (25% margin) ──
  const totalRevenue = paidShifts.reduce((sum, shift) => {
    const total = parseFloat(
      (shift.total_pay || "0")
        .replace("GHS ", "")
        .replace(",", "")
    ) || 0;
    return sum + (total * 0.25);
  }, 0);

  document.getElementById("totalRevenue").textContent =
    "GHS " + totalRevenue.toLocaleString();

  const container = document.getElementById("shiftsTable");

  if (data.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No shifts posted yet.</p></div>`;
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
                ${s.status === "open"
                  ? '<span class="badge badge-accent">Open</span>'
                  : s.status === "accepted"
                  ? '<span class="badge badge-accent">Accepted</span>'
                  : s.status === "cancelled"
                  ? '<span class="badge badge-red">Cancelled</span>'
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

// ── Load analytics ──
async function loadAnalytics() {
  const { data: result } = await ccFetch("/admin/analytics", { method: "GET" });
  if (!result?.success) return;

  document.getElementById("analAvgRating").textContent = result.avgRating || "—";
  document.getElementById("analActiveShifts").textContent = result.activeShifts || 0;
  document.getElementById("analPendingApps").textContent = result.pendingApplications || 0;
  document.getElementById("analOpenTickets").textContent = result.openSupportTickets || 0;
  document.getElementById("analIdVerified").textContent = result.identityVerifiedCount || 0;

  renderBarChart("workersChart", result.workersByMonth || [], "#111827");
  renderBarChart("shiftsChart", result.shiftsByMonth || [], "#111827");
  renderBarChart("revenueChart", (result.revenueByMonth || []).map(r => ({ ...r, count: r.amount })), "#F0B429");
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

// ── Tab switching ──
function showTab(tab) {
  ["workers", "facilities", "shifts", "analytics", "trusted", "finance", "settings"].forEach(t => {
    const panel = document.getElementById("panel-" + t);
    if (panel) panel.style.display = t === tab ? "block" : "none";
    const tabEl = document.getElementById("tab-" + t);
    if (tabEl) tabEl.classList.toggle("active", t === tab);
  });
  if (tab === "finance") { loadAdminFinanceSummary(); loadAdminFinanceTransactions(); }
  if (tab === "settings") loadAdminSettings();
}

// ── Logout ──
async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
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
  const { data: result } = await ccFetch("/finance/admin/transactions?page=1&limit=50", { method: "GET" });
  if (!result?.success || !result.data?.transactions?.length) {
    container.innerHTML = '<div class="empty-state"><p>No transactions found.</p></div>';
    return;
  }
  const txns = result.data.transactions;
  container.innerHTML = `
    <p style="font-size:13px; color:var(--fg-muted); margin-bottom:12px;">${result.data.total} transactions</p>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Facility</th>
            <th>Shift</th>
            <th>Amount</th>
            <th>Fee (25%)</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${txns.map(t => {
            const amount = t.facility_total || 0;
            const fee = amount * 0.2;
            const statusColor = t.payment_status === "paid" ? "#059669" : t.payment_status === "postpaid" ? "#F0B429" : "#6b7280";
            const statusLabel = t.payment_status === "paid" ? "Paid" : t.payment_status === "postpaid" ? "Postpaid" : t.payment_status || "—";
            const markPaidBtn = t.payment_status === "postpaid" ? `<button onclick="markPostpaidPaid('${escapeHtml(t.id)}')" style="font-size:11px;padding:4px 8px;border-radius:4px;border:1px solid #059669;background:transparent;color:#059669;cursor:pointer;font-family:inherit;">Mark paid</button>` : "—";
            return `
              <tr>
                <td style="color:var(--fg-muted);">${t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
                <td style="color:var(--fg-primary); font-weight:500;">${escapeHtml(t.facility_name) || "—"}<br><span style="font-size:11px;color:var(--fg-muted);font-weight:400;">${escapeHtml(t.contact_email) || ""}</span></td>
                <td>${escapeHtml(t.role_needed) || "—"}<br><span style="font-size:11px;color:var(--fg-muted);">${escapeHtml(t.shift_date) || ""}</span></td>
                <td style="color:#111827; font-weight:500;">GHS ${amount.toLocaleString()}</td>
                <td>GHS ${fee.toLocaleString()}</td>
                <td><span style="color:${statusColor};">${statusLabel}</span></td>
                <td>${markPaidBtn}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

// ── Admin: mark postpaid as paid ──
async function markPostpaidPaid(shiftId) {
  if (!confirm("Mark this postpaid shift as paid?")) return;
  const { data: result } = await ccFetch("/finance/admin/mark-paid", {
    method: "POST",
    body: JSON.stringify({ shift_id: shiftId })
  });
  if (result?.success) {
    ccToast("Marked as paid.", "success");
    loadAdminFinanceTransactions();
    loadAdminFinanceSummary();
  } else {
    ccToast(result?.message || "Failed.", "error");
  }
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

// ── Run ──
init();