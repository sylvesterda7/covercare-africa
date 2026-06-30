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
          <h2 style="color:#fff; margin-bottom:0.5rem;">Access denied</h2>
          <p style="color:rgba(255,255,255,0.4);">You don't have admin access.</p>
          <a href="index.html" style="color:#5DCAA5; margin-top:1rem; display:block;">Go to homepage</a>
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
    loadAnalytics()
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
              <td style="color:#fff; font-weight:500;">${w.full_name || "—"}</td>
              <td>${w.email || "—"}</td>
              <td>${w.role || "—"}</td>
              <td>${w.city || "—"}</td>
              <td>
                ${w.license_verified
                  ? '<span class="badge badge-green">✓ Verified</span>'
                  : '<span class="badge badge-yellow">Pending</span>'
                }
              </td>
              <td>
                ${w.identity_verified
                  ? '<span class="badge badge-green">✓ Verified</span>'
                  : '<span class="badge badge-yellow">Pending</span>'
                }
              </td>
              <td style="color:rgba(255,255,255,0.35);">
                ${w.created_at ? new Date(w.created_at).toLocaleDateString() : "—"}
              </td>
              <td>
                <button
                  onclick="toggleLicenseVerified('${w.id}', ${w.license_verified})"
                  style="font-size:11px; padding:4px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:rgba(255,255,255,0.4); cursor:pointer; font-family:inherit;">
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
    alert("Failed to update worker. Please try again.");
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
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(f => `
            <tr>
              <td style="color:#fff; font-weight:500;">${f.facility_name || "—"}</td>
              <td>${f.facility_type || "—"}</td>
              <td>${f.city || "—"}</td>
              <td>${f.contact_name || "—"}</td>
              <td>${f.email || "—"}</td>
              <td>${f.staff_needs || "—"}</td>
              <td style="color:rgba(255,255,255,0.35);">
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
              <td style="color:#fff; font-weight:500;">${s.facility_name || "—"}</td>
              <td>${s.role_needed || "—"}</td>
              <td>${s.city || "—"}</td>
              <td>${s.shift_date || "—"}</td>
              <td>${s.duration || "—"}</td>
              <td>${s.pay_rate || "—"}</td>
              <td style="color:#5DCAA5;">${s.total_pay || "—"}</td>
              <td>
                ${s.payment_status === "paid"
                  ? '<span class="badge badge-green">✓ Paid</span>'
                  : '<span class="badge badge-yellow">Unpaid</span>'
                }
              </td>
              <td>
                ${s.status === "open"
                  ? '<span class="badge badge-green">Open</span>'
                  : s.status === "accepted"
                  ? '<span class="badge badge-green">Accepted</span>'
                  : s.status === "cancelled"
                  ? '<span class="badge badge-red">Cancelled</span>'
                  : '<span class="badge badge-grey">' + (s.status || "—") + '</span>'
                }
              </td>
              <td style="color:rgba(255,255,255,0.35);">
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

  renderBarChart("workersChart", result.workersByMonth || [], "#5DCAA5");
  renderBarChart("shiftsChart", result.shiftsByMonth || [], "#5DCAA5");
  renderBarChart("revenueChart", (result.revenueByMonth || []).map(r => ({ ...r, count: r.amount })), "#F0B429");
}

function renderBarChart(containerId, data, color) {
  const container = document.getElementById(containerId);
  if (!container || !data || data.length === 0) {
    container.innerHTML = '<div style="color:rgba(255,255,255,0.2); font-size:13px;">No data</div>';
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
  ["workers", "facilities", "shifts", "analytics"].forEach(t => {
    document.getElementById("panel-" + t).style.display = t === tab ? "block" : "none";
    document.getElementById("tab-" + t).classList.toggle("active", t === tab);
  });
}

// ── Logout ──
async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}

// ── Run ──
init();