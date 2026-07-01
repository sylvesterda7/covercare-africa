// ── Supabase client ──
const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
ccInitInactivityLogout(_supabase);

let clientEmail = "";
let clientProfile = null;
let _clientShifts = [];
let _clientTransactions = [];
let notifOpen = false;

// ── Init ──
(async function init() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }
  const user = session.user;
  const meta = user.user_metadata || {};
  window._userEmail = user.email;
  if (!meta.user_type && !user.email) { window.location.href = "oauth-setup.html"; return; }
  if (meta.user_type === "worker") { window.location.href = "dashboard-worker.html"; return; }
  if (meta.user_type === "facility") { window.location.href = "dashboard-facility.html"; return; }
  clientEmail = user.email;
  const firstName = meta.full_name ? meta.full_name.split(" ")[0] : "there";
  document.getElementById("welcomeMsg").textContent = "Welcome back, " + firstName;
  document.getElementById("navUser").textContent = meta.full_name || user.email;
  await loadClientProfile();
  await loadShifts();
  await loadWorkersHistory();
  loadWalletBalance();
})();

// ── Sidebar ──
function toggleSidebar() {
  const sidebar = document.querySelector(".dashboard-sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const layout = document.querySelector(".dashboard-layout");
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle("open");
  sidebar.classList.toggle("closed", !isOpen);
  if (overlay) overlay.classList.toggle("show", isOpen);
  if (layout) layout.classList.toggle("sidebar-open", isOpen);
}

// ── Section navigation ──
function showSection(name) {
  ["dashboard", "finance", "settings"].forEach(s => {
    const sec = document.getElementById("section-" + s);
    if (sec) sec.style.display = s === name ? "block" : "none";
    const tab = document.getElementById("tab-" + s);
    if (tab) {
      tab.style.color = s === name ? "#111827" : "#6b7280";
      tab.style.borderBottomColor = s === name ? "#111827" : "transparent";
    }
    const nav = document.getElementById("nav-" + s);
    if (nav) nav.classList.toggle("btn-sidebar-active", s === name);
  });
  if (name === "finance") { loadFinanceSummary(); loadFinanceTransactions(); loadFinanceProfile(); loadWalletBalance(); loadWalletTransactions(); }
  if (name === "settings") loadSettingsPage();
  const sidebar = document.querySelector(".dashboard-sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (sidebar && sidebar.classList.contains("open")) {
    sidebar.classList.remove("open"); sidebar.classList.add("closed");
    if (overlay) overlay.classList.remove("show");
    document.querySelector(".dashboard-layout").classList.remove("sidebar-open");
  }
}

// ── Notifications ──
async function loadNotifications() {
  const { data } = await ccFetch("/notifications", { method: "GET" });
  if (!data) return;
  const badge = document.getElementById("notifBadge");
  const list = document.getElementById("notifList");
  if (!badge || !list) return;
  if (data.unread_count > 0) {
    badge.style.display = "flex";
    badge.textContent = data.unread_count;
  } else { badge.style.display = "none"; }
  if (!data.data || data.data.length === 0) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--fg-muted);font-size:13px;">No notifications</div>';
    return;
  }
  list.innerHTML = data.data.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markRead('${escapeHtml(n.id)}')" data-id="${escapeHtml(n.id)}">
      <div style="font-size:13px;font-weight:500;color:#111827;">${escapeHtml(n.title)}</div>
      <div style="font-size:12px;color:var(--fg-muted);margin-top:2px;">${escapeHtml(n.message)}</div>
      <div style="font-size:11px;color:var(--fg-muted);margin-top:4px;">${n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}</div>
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
  await ccFetch("/notifications/" + id + "/read", { method: "PUT" });
  loadNotifications();
}

async function markAllRead() {
  await ccFetch("/notifications/read-all", { method: "POST" });
  loadNotifications();
}

document.addEventListener("click", function(e) {
  const dd = document.getElementById("notifDropdown");
  const btn = document.getElementById("notifBtn");
  if (dd && btn && !dd.contains(e.target) && !btn.contains(e.target)) {
    dd.style.display = "none";
    notifOpen = false;
  }
});

// ── Client profile ──
async function loadClientProfile() {
  const { data: result } = await ccFetch("/client", { method: "GET" });
  if (result?.success && result.data) {
    clientProfile = result.data;
    const photo = document.getElementById("navUserPhoto");
    if (clientProfile.profile_photo_url) {
      photo.src = clientProfile.profile_photo_url;
      photo.style.display = "inline-block";
    }
  }
}

// ── Shifts ──
async function loadShifts() {
  const { data: shifts, error } = await _supabase
    .from("shifts").select("*").eq("contact_email", clientEmail)
    .order("created_at", { ascending: false });

  const container = document.getElementById("clientShiftsContainer");
  const statsEl = document.getElementById("clientStats");

  if (error || !shifts) {
    container.innerHTML = '<div class="empty-state"><p>Could not load shifts.</p></div>'; return;
  }

  _clientShifts = shifts;
  const total = shifts.length;
  const active = shifts.filter(s => s.status === "in_progress" || s.status === "accepted").length;
  const open = shifts.filter(s => s.status === "open").length;
  const completed = shifts.filter(s => s.status === "completed").length;
  const totalSpent = shifts.filter(s => s.payment_status === "paid").reduce((sum, s) => sum + (parseFloat(s.total_pay) || 0), 0);

  statsEl.innerHTML = `
    <div class="stat-box"><div class="num">${total}</div><div class="label">Total shifts</div></div>
    <div class="stat-box"><div class="num">${active}</div><div class="label">Active</div></div>
    <div class="stat-box"><div class="num">${open}</div><div class="label">Open</div></div>
    <div class="stat-box"><div class="num">${completed}</div><div class="label">Completed</div></div>
    <div class="stat-box"><div class="num">GHS ${Math.round(totalSpent).toLocaleString()}</div><div class="label">Total spend</div></div>
  `;

  if (shifts.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>You haven't posted any shifts yet.</p><a href="post-shift.html" class="btn-auth" style="display:inline-block;margin-top:12px;">Post your first shift</a></div>`;
    return;
  }

  container.innerHTML = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Role needed</th><th>Date</th><th>Status</th><th>Pay rate</th><th>Total pay</th><th>Payment</th><th>Posted</th></tr></thead><tbody>
    ${shifts.map(s => `<tr>
      <td style="color:var(--fg-primary);font-weight:500;">${s.role_needed || "—"}</td>
      <td>${s.shift_date || "—"}</td>
      <td>${s.status === "in_progress" ? '<span class="badge badge-accent" style="background:#111827;color:#fff;">● In progress</span>' : s.status === "open" ? '<span class="badge badge-accent">Open</span>' : s.status === "accepted" ? '<span class="badge badge-accent">Accepted</span>' : s.status === "completed" ? '<span class="badge badge-grey">Completed</span>' : s.status === "cancelled" ? '<span class="badge badge-grey">Cancelled</span>' : '<span class="badge badge-grey">' + (s.status || "—") + '</span>'}</td>
      <td>${s.pay_rate || "—"}</td>
      <td style="color:#111827;">${s.total_pay || "—"}</td>
      <td>${s.payment_status === "paid" ? '<span style="color:#059669;font-size:13px;">Paid</span>' : s.payment_status === "pending" || !s.payment_status ? '<span style="color:#f59e0b;font-size:13px;">Pending</span>' : '<span style="font-size:13px;">' + (s.payment_status || "—") + '</span>'}</td>
      <td style="color:var(--fg-muted);">${s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
    </tr>`).join("")}
  </tbody></table></div>`;
}

// ── Workers history ──
async function loadWorkersHistory() {
  const container = document.getElementById("workersHistoryContainer");
  if (!container) return;
  const { data: result } = await ccFetch("/client/workers-history", { method: "GET" });
  if (!result?.success || !result.data) {
    container.innerHTML = '<div class="empty-state"><p>Could not load workers history.</p></div>'; return;
  }
  const history = result.data;
  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No workers hired yet. Workers appear here once they accept your shift.</p></div>'; return;
  }
  container.innerHTML = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Worker</th><th>Role</th><th>Shift</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
    ${history.map(h => `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          ${h.worker_photo ? `<img src="${escapeHtml(h.worker_photo)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />` : `<div style="width:32px;height:32px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--fg-muted);">${(h.worker_name || "?").charAt(0).toUpperCase()}</div>`}
          <span style="color:var(--fg-primary);font-weight:500;font-size:14px;">${escapeHtml(h.worker_name || "—")}</span>
        </div>
      </td>
      <td>${h.worker_role || "—"}</td>
      <td>${h.role_needed || "—"}</td>
      <td>${h.shift_date || "—"}</td>
      <td style="color:#111827;">GHS ${(h.total_pay || 0).toLocaleString()}</td>
      <td>${h.shift_status === "completed" ? '<span class="badge badge-grey">Completed</span>' : h.shift_status === "in_progress" ? '<span class="badge badge-accent" style="background:#111827;color:#fff;">In progress</span>' : '<span class="badge badge-accent">Accepted</span>'}</td>
    </tr>`).join("")}
  </tbody></table></div>`;
}

// ── Finance summary ──
async function loadFinanceSummary() {
  const container = document.getElementById("financeSummary");
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  const { data: result } = await ccFetch("/finance/client/summary", { method: "GET" });
  if (!result?.success || !result.data) {
    container.innerHTML = '<div class="empty-state"><p>Could not load finance data.</p></div>'; return;
  }
  const d = result.data;
  container.innerHTML = `
    <div class="stat-box"><div class="num">GHS ${(d.total_spent || 0).toLocaleString()}</div><div class="label">Total spent</div></div>
    <div class="stat-box"><div class="num">GHS ${(d.this_month || 0).toLocaleString()}</div><div class="label">This month</div></div>
    <div class="stat-box"><div class="num">GHS ${(d.pending || 0).toLocaleString()}</div><div class="label">Pending</div></div>
  `;
}

// ── Finance transactions ──
async function loadFinanceTransactions() {
  const container = document.getElementById("financeTransactions");
  if (!container) return;
  const { data: result } = await ccFetch("/finance/client/transactions?page=1&limit=50", { method: "GET" });
  if (!result?.success || !result.data) {
    container.innerHTML = '<div class="empty-state"><p>Could not load transactions.</p></div>'; return;
  }
  _clientTransactions = result.data.transactions || [];
  if (_clientTransactions.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No transactions yet.</p></div>'; return;
  }
  container.innerHTML = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Date</th><th>Role</th><th>Shift date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
    ${_clientTransactions.map(t => `<tr onclick="previewTxn(${t.id})" style="cursor:pointer;">
      <td>${t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
      <td style="color:var(--fg-primary);font-weight:500;">${t.role_needed || "—"}</td>
      <td>${t.shift_date || "—"}</td>
      <td style="color:#111827;">GHS ${(t.total_pay || 0).toLocaleString()}</td>
      <td>${t.payment_status === "paid" ? '<span style="color:#059669;font-size:13px;">Paid</span>' : t.payment_status === "pending" || !t.payment_status ? '<span style="color:#f59e0b;font-size:13px;">Pending</span>' : '<span style="font-size:13px;">' + (t.payment_status || "—") + '</span>'}</td>
    </tr>`).join("")}
  </tbody></table></div>`;
}

function previewTxn(id) {
  const t = _clientTransactions.find(x => x.id === id);
  if (!t) return;
  const content = document.getElementById("txnPreviewContent");
  if (!content) return;
  content.innerHTML = `
    <div class="arrive-detail-row"><span>Role</span><strong>${t.role_needed || "—"}</strong></div>
    <div class="arrive-detail-row"><span>Shift date</span><strong>${t.shift_date || "—"}</strong></div>
    <div class="arrive-detail-row"><span>Start time</span><strong>${t.start_time || "—"}</strong></div>
    <div class="arrive-detail-row"><span>Duration</span><strong>${t.duration_hours ? t.duration_hours + "h" : "—"}</strong></div>
    <div class="arrive-detail-row"><span>Amount</span><strong>GHS ${(t.total_pay || 0).toLocaleString()}</strong></div>
    <div class="arrive-detail-row"><span>Payment status</span><strong>${t.payment_status || "—"}</strong></div>
    <div class="arrive-detail-row"><span>Reference</span><strong>${t.payment_reference || "—"}</strong></div>
    <div class="arrive-detail-row"><span>Facility type</span><strong>${t.facility_type || "—"}</strong></div>
    <div class="arrive-detail-row"><span>Shift status</span><strong>${t.status || "—"}</strong></div>
    <div class="arrive-detail-row"><span>Created</span><strong>${t.created_at ? new Date(t.created_at).toLocaleString() : "—"}</strong></div>`;
  document.getElementById("txnPreviewModal").style.display = "flex";
}

function closeTxnPreview() { document.getElementById("txnPreviewModal").style.display = "none"; }

function downloadClientStatement() {
  if (!_clientTransactions.length) { ccToast("No transactions to download.", "info"); return; }
  downloadCSV(_clientTransactions.map(t => [
    t.created_at ? new Date(t.created_at).toLocaleDateString() : "", t.role_needed || "", t.shift_date || "",
    t.total_pay || 0, t.payment_status || "", t.payment_reference || ""
  ]), ["Date", "Role", "Shift date", "Amount", "Payment status", "Reference"], "covercare-client-statement.csv");
  ccToast("Statement downloaded.", "success");
}

// ── Finance profile (momo/bank) ──
async function loadFinanceProfile() {
  const { data: result } = await ccFetch("/finance/client/profile", { method: "GET" });
  if (result?.success && result.data) {
    document.getElementById("finBankName").value = result.data.bank_name || "";
    document.getElementById("finBankAccount").value = result.data.bank_account_number || "";
    document.getElementById("finBankAccountName").value = result.data.bank_account_name || "";
    document.getElementById("finMomoProvider").value = result.data.momo_provider || "";
    document.getElementById("finMomoNumber").value = result.data.momo_number || "";
  }
}

document.getElementById("clientFinanceForm")?.addEventListener("submit", async function(e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = "Saving...";
  const { data: result } = await ccFetch("/finance/client/profile", {
    method: "POST",
    body: JSON.stringify({
      bank_name: document.getElementById("finBankName").value.trim(),
      bank_account_number: document.getElementById("finBankAccount").value.trim(),
      bank_account_name: document.getElementById("finBankAccountName").value.trim(),
      momo_provider: document.getElementById("finMomoProvider").value,
      momo_number: document.getElementById("finMomoNumber").value.trim()
    })
  });
  if (result?.success) { ccToast("Payment details saved!", "success"); }
  else { ccToast(result?.message || "Failed to save payment details.", "error"); }
  btn.disabled = false; btn.textContent = "Save payment details";
});

// ── Settings page ──
async function loadSettingsPage() {
  const form = document.getElementById("settingsProfileForm");
  if (!form) return;
  form.innerHTML = '<p style="font-size:13px;color:var(--fg-muted);">Loading...</p>';
  const { data: result } = await ccFetch("/client", { method: "GET" });
  if (result?.success && result.data) {
    const p = result.data;
    clientProfile = p;
    form.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
        ${p.profile_photo_url ? `<img src="${escapeHtml(p.profile_photo_url)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid rgba(17,24,39,0.15);" />` : `<div style="width:48px;height:48px;border-radius:50%;background:rgba(17,24,39,0.1);display:flex;align-items:center;justify-content:center;font-size:16px;color:#6b7280;">${(p.full_name || "?")[0].toUpperCase()}</div>`}
        <div style="font-size:13px;color:var(--fg-muted);"><strong style="color:#111827;">${escapeHtml(p.full_name || "—")}</strong><br />${escapeHtml(p.email || "")}</div>
      </div>
      <input id="setName" class="glass-input" type="text" placeholder="Full name" value="${escapeHtml(p.full_name || "")}" />
      <input id="setPhone" class="glass-input" type="tel" placeholder="Phone number" value="${escapeHtml(p.phone || "")}" />
      <input id="setEmail" class="glass-input" type="email" value="${escapeHtml(p.email || "")}" readonly style="background:#f9fafb;" />
      <select id="setGender" class="glass-input">
        <option value="">Select gender (optional)</option>
        <option value="male" ${p.gender === "male" ? "selected" : ""}>Male</option>
        <option value="female" ${p.gender === "female" ? "selected" : ""}>Female</option>
        <option value="other" ${p.gender === "other" ? "selected" : ""}>Other</option>
      </select>
      <select id="setCountry" class="glass-input">
        <option value="">Select country</option>
        ${AFRICAN_COUNTRIES.map(c => `<option value="${c.code}" ${c.code === p.country ? "selected" : ""}>${c.name}</option>`).join("")}
      </select>
      <select id="setCity" class="glass-input">
        <option value="">Select city</option>
      </select>
      <input id="setAddress" class="glass-input" type="text" placeholder="Address / Location" value="${escapeHtml(p.address || "")}" />
      <input id="setGpsCode" class="glass-input" type="text" placeholder="GPS Code (e.g. GA-123-4567)" value="${escapeHtml(p.gps_code || "")}" />
      <button onclick="saveSettings()" class="btn-auth" style="align-self:flex-start;">Save changes</button>
    `;
    populateCities("setCountry", "setCity", p.country, p.city);
  } else {
    form.innerHTML = '<p style="font-size:13px;color:var(--fg-muted);">Could not load profile. Please try again.</p>';
  }
}

document.addEventListener("change", function(e) {
  if (e.target.id === "setCountry") populateCities("setCountry", "setCity", e.target.value, "");
});

function populateCities(countrySelectId, citySelectId, countryCode, selectedCity) {
  const country = AFRICAN_COUNTRIES.find(c => c.code === countryCode);
  const citySel = document.getElementById(citySelectId);
  if (!citySel) return;
  citySel.innerHTML = '<option value="">Select city</option>';
  if (country) {
    country.cities.forEach(city => {
      const opt = document.createElement("option");
      opt.value = city.value; opt.textContent = city.label;
      if (city.value === selectedCity) opt.selected = true;
      citySel.appendChild(opt);
    });
  }
}

async function saveSettings() {
  const body = {
    full_name: document.getElementById("setName").value.trim(),
    phone: document.getElementById("setPhone").value.trim(),
    city: document.getElementById("setCity").value,
    country: document.getElementById("setCountry").value,
    gender: document.getElementById("setGender").value,
    address: document.getElementById("setAddress").value.trim(),
    gps_code: document.getElementById("setGpsCode").value.trim()
  };
  if (!body.full_name || !body.phone || !body.city) {
    ccToast("Name, phone, and city are required.", "error"); return;
  }
  const btn = document.querySelector("#section-settings .btn-auth");
  if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
  try {
    const { data: result } = await ccFetch("/client", { method: "PUT", body: JSON.stringify(body) });
    if (result?.success) { ccToast("Settings saved!", "success"); await loadClientProfile(); }
    else { ccToast(result?.message || "Failed to save settings.", "error"); }
  } catch (err) { ccToast("Network error.", "error"); }
  finally { if (btn) { btn.disabled = false; btn.textContent = "Save changes"; } }
}

// ── Profile modal ──
async function uploadPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async function(e) {
      const { data: result } = await ccFetch("/api/upload", {
        method: "POST", body: JSON.stringify({ image: e.target.result, folder: "client-photos" })
      });
      resolve(result?.success ? result.url : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

document.getElementById("editClientPhoto")?.addEventListener("change", function() {
  const file = this.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById("profilePhotoPreview");
    preview.src = e.target.result;
    preview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

function openClientModal() {
  if (!clientProfile) { ccToast("Loading profile...", "info"); return; }
  const p = clientProfile;
  document.getElementById("editClientName").value = p.full_name || "";
  document.getElementById("editClientEmail").value = p.email || "";
  document.getElementById("editClientPhone").value = p.phone || "";
  document.getElementById("editClientGender").value = p.gender || "";
  const preview = document.getElementById("profilePhotoPreview");
  if (p.profile_photo_url) { preview.src = p.profile_photo_url; preview.style.display = "block"; }
  else { preview.src = ""; preview.style.display = "none"; }
  const countrySel = document.getElementById("editClientCountry");
  countrySel.innerHTML = '<option value="">Select country</option>';
  AFRICAN_COUNTRIES.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.code; opt.textContent = c.name;
    if (c.code === p.country) opt.selected = true;
    countrySel.appendChild(opt);
  });
  populateCities("editClientCountry", "editClientCity", p.country, p.city);
  document.getElementById("editClientAddress").value = p.address || "";
  document.getElementById("editClientGpsCode").value = p.gps_code || "";
  document.getElementById("clientModal").style.display = "flex";
}

document.getElementById("editClientCountry").addEventListener("change", function() {
  populateCities("editClientCountry", "editClientCity", this.value, "");
});

function closeClientModal() { document.getElementById("clientModal").style.display = "none"; }

document.getElementById("clientProfileForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = "Saving...";
  try {
    const fileInput = document.getElementById("editClientPhoto");
    let profilePhotoUrl = clientProfile?.profile_photo_url || null;
    if (fileInput?.files?.[0]) {
      profilePhotoUrl = await uploadPhoto(fileInput.files[0]);
    }
    const body = {
      full_name: document.getElementById("editClientName").value.trim(),
      phone: document.getElementById("editClientPhone").value.trim(),
      country: document.getElementById("editClientCountry").value,
      city: document.getElementById("editClientCity").value,
      gender: document.getElementById("editClientGender").value,
      address: document.getElementById("editClientAddress").value.trim(),
      gps_code: document.getElementById("editClientGpsCode").value.trim()
    };
    if (profilePhotoUrl) body.profile_photo_url = profilePhotoUrl;
    const { data: result } = await ccFetch("/client", { method: "PUT", body: JSON.stringify(body) });
    if (result?.success) {
      ccToast("Profile updated!", "success");
      closeClientModal();
      await loadClientProfile();
      const meta = (await _supabase.auth.getSession()).data?.session?.user?.user_metadata;
      if (meta) document.getElementById("navUser").textContent = meta.full_name || body.full_name || clientEmail;
    } else { ccToast(result?.message || "Could not update profile.", "error"); }
  } catch (err) { ccToast("Something went wrong.", "error"); }
  finally { btn.disabled = false; btn.textContent = "Save changes"; }
});

// ── Support modal ──
function openSupportModal() { document.getElementById("supportModal").style.display = "flex"; }
function closeSupportModal() { document.getElementById("supportModal").style.display = "none"; }

document.getElementById("supportForm")?.addEventListener("submit", async function(e) {
  e.preventDefault();
  const btn = this.querySelector(".btn-auth");
  btn.disabled = true; btn.textContent = "Sending...";
  const { data } = await ccFetch("/support/ticket", {
    method: "POST",
    body: JSON.stringify({
      subject: document.getElementById("supportSubject").value.trim(),
      message: document.getElementById("supportMessage").value.trim(),
      category: document.getElementById("supportCategory").value
    })
  });
  if (data?.success) { ccToast("Support ticket sent! We'll respond within 24 hours.", "success"); closeSupportModal(); }
  else { ccToast("Failed to send. Please try again.", "error"); }
  btn.disabled = false; btn.textContent = "Send";
});

// ── Account deletion ──
async function confirmDelete() {
  if (!confirm("Permanently delete your account and all data? This cannot be undone.")) return;
  const email = prompt("Type your email to confirm deletion:");
  if (!email) return;
  try {
    const { data: result } = await ccFetch("/client", { method: "DELETE", body: JSON.stringify({ email }) });
    if (result.success) { await _supabase.auth.signOut(); window.location.href = "index.html"; }
    else { ccToast(result.message || "Could not delete account.", "error"); }
  } catch (err) { ccToast("Something went wrong.", "error"); }
}

// ── Logout ──
async function logout() { await _supabase.auth.signOut(); window.location.href = "login.html"; }

// ── Escape helper ──
function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
