// ── Config & Supabase ──
window._supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
const _supabase = window._supabase;

let currentWorker = null;

// ── Init ──
async function init() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }

  const user = session.user;
  const meta = user.user_metadata;

  if (meta.user_type !== "worker") {
    window.location.href = "dashboard-facility.html";
    return;
  }

  document.getElementById("navUser").textContent = meta.full_name || user.email;
  const firstName = meta.full_name ? meta.full_name.split(" ")[0] : "there";
  document.getElementById("welcomeMsg").textContent = `Welcome back, ${firstName}`;

  await loadProfile(user.email);
  await loadShifts();
  await loadMyShifts();
}

// ── Load profile ──
async function loadProfile(email) {
  const { data, error } = await _supabase
    .from("workers")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !data) {
    document.getElementById("profileName").textContent = "Profile not set up yet";
    document.getElementById("profileRole").textContent = "Complete your profile to start working";
    document.getElementById("profileAvatar").textContent = "?";
    document.getElementById("profileBadges").innerHTML =
      `<span class="badge badge-yellow" style="margin-top:8px;">Profile incomplete</span>`;
    return;
  }

  currentWorker = data;

  // Show identity verify button if not verified
  if (!data.identity_verified) {
    const quickActions = document.getElementById("quickActions");
    if (quickActions) {
      const btn = document.createElement("a");
      btn.href = "identity-verify.html";
      btn.className = "btn-primary-sm";
      btn.style.cssText = "background:rgba(93,202,165,0.1); color:#5DCAA5; border:1px solid rgba(93,202,165,0.3);";
      btn.textContent = "Verify my identity";
      quickActions.appendChild(btn);
    }
  }

  const initials = data.full_name
    .split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);

  document.getElementById("profileAvatar").textContent = initials;
  document.getElementById("profileName").textContent = data.full_name;
  document.getElementById("profileRole").textContent = data.role;
  document.getElementById("profileCity").textContent = `📍 ${data.city}`;

  let badges = "";
  badges += data.license_verified
    ? `<span class="badge badge-green" style="margin-right:6px;">✓ License verified</span>`
    : `<span class="badge badge-yellow" style="margin-right:6px;">License pending</span>`;
  badges += data.identity_verified
    ? `<span class="badge badge-green">✓ Identity verified</span>`
    : `<span class="badge badge-yellow">Identity pending</span>`;

  document.getElementById("profileBadges").innerHTML = badges;
  document.getElementById("verifiedBadge").textContent = data.license_verified ? "✓" : "Pending";
}

// ── Load available shifts ──
async function loadShifts() {
  const { data, error } = await _supabase
    .from("shifts")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(10);

  const container = document.getElementById("shiftsContainer");

  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No shifts available in your area right now.</p>
        <p style="font-size:13px;">We'll notify you when new shifts are posted near you.</p>
      </div>`;
    return;
  }

  container.innerHTML = data.map(shift => `
    <div class="profile-card" style="margin-bottom:12px;">
      <div class="profile-avatar" style="background:rgba(93,202,165,0.1); font-size:14px;">
        ${shift.role_needed ? escapeHtml(shift.role_needed.substring(0, 2).toUpperCase()) : "SH"}
      </div>
      <div class="profile-info" style="flex:1;">
        <h3>${escapeHtml(shift.facility_name) || "—"}</h3>
        <p>${escapeHtml(shift.role_needed) || "—"} · ${escapeHtml(shift.city) || "—"}</p>
        <p>${escapeHtml(shift.shift_date) || "—"} · ${escapeHtml(shift.start_time) || "—"} · ${escapeHtml(shift.duration) || "—"}</p>
        <p style="color:#5DCAA5; font-weight:500;">${escapeHtml(shift.pay_rate) || "—"}</p>
        <div style="margin-top:8px;">
          <span class="badge badge-green">
            ${shift.urgency === "today" ? "🔴 Urgent" : "Open"}
          </span>
        </div>
      </div>
      <div>
        <button
          onclick="applyToShift('${escapeHtml(shift.id)}', this)"
          class="btn-primary-sm"
          style="font-size:13px; padding:8px 16px;">
          Apply
        </button>
      </div>
    </div>
  `).join("");
}

// ── Load my accepted/active shifts ──
async function loadMyShifts() {
  if (!currentWorker) return;

  const container = document.getElementById("myShiftsContainer");
  if (!container) return;

  const { data, error } = await _supabase
    .from("shifts")
    .select("*")
    .eq("worker_id", currentWorker.id)
    .in("status", ["accepted", "in_progress"])
    .order("shift_date", { ascending: true });

  // Update stats
  const { data: completed } = await _supabase
    .from("shifts")
    .select("total_pay")
    .eq("worker_id", currentWorker.id)
    .eq("status", "completed");

  document.getElementById("totalShifts").textContent = (completed || []).length;

  const totalEarnings = (completed || []).reduce((sum, s) => {
    return sum + (parseFloat((s.total_pay || "").replace(/[^0-9.]/g, "")) || 0);
  }, 0);
  document.getElementById("totalEarnings").textContent = `GHS ${totalEarnings.toLocaleString()}`;

  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No active shifts yet.</p>
        <p style="font-size:13px;">Apply to a shift above — once accepted you'll see your QR check-in code here.</p>
      </div>`;
    return;
  }

  container.innerHTML = data.map(shift => {
    const safeId = escapeHtml(shift.id);
    const safeWorkerId = escapeHtml(currentWorker.id);
    const qrUrl = shift.qr_token
      ? `${window.location.origin}/qr-arrive.html?shift_id=${safeId}&worker_id=${safeWorkerId}&token=${escapeHtml(shift.qr_token)}`
      : null;

    const qrImg = qrUrl
      ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}"
           alt="QR Code" style="width:180px; height:180px; border-radius:8px; margin:1rem auto; display:block;" />`
      : `<p style="color:rgba(255,255,255,0.3); font-size:13px; text-align:center;">QR code loading...</p>`;

    return `
      <div class="profile-card" style="flex-direction:column; margin-bottom:12px;">
        <div style="display:flex; gap:12px; align-items:flex-start; width:100%;">
          <div class="profile-avatar" style="background:rgba(93,202,165,0.1); font-size:14px;">
            ${shift.role_needed ? escapeHtml(shift.role_needed.substring(0, 2).toUpperCase()) : "SH"}
          </div>
          <div class="profile-info" style="flex:1;">
            <h3>${escapeHtml(shift.facility_name) || "—"}</h3>
            <p>${escapeHtml(shift.role_needed) || "—"} · ${escapeHtml(shift.city) || "—"}</p>
            <p>${escapeHtml(shift.shift_date) || "—"} · ${escapeHtml(shift.start_time) || "—"}</p>
            <p style="color:#5DCAA5; font-weight:500;">${escapeHtml(shift.pay_rate) || "—"}</p>
            <div style="margin-top:6px;">
              <span class="badge ${shift.status === "in_progress" ? "badge-green" : "badge-yellow"}">
                ${shift.status === "in_progress" ? "In progress" : "Accepted — show QR on arrival"}
              </span>
            </div>
          </div>
        </div>
        ${qrImg}
        <p style="font-size:12px; color:rgba(255,255,255,0.3); text-align:center; margin-top:4px;">
          Show this QR code when you arrive at the facility
        </p>
        ${shift.status === "in_progress" && qrUrl ? `
          <div style="text-align:center; margin-top:12px;">
            <a href="${qrUrl}" class="btn-primary-sm">Complete shift & check out</a>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

// ── Apply to shift ──
async function applyToShift(shiftId, btn) {
  if (!currentWorker) {
    alert("Please complete your profile before applying to shifts.");
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = "Applying..."; }

  try {
    const { data: result } = await ccFetch("/applications/apply", {
      method: "POST",
      body: JSON.stringify({
        worker_id: currentWorker.id,
        shift_id: shiftId
      })
    });

    if (result.success) {
      if (btn) { btn.disabled = true; btn.textContent = "Applied ✓"; }
      alert("Application submitted! The facility will review and respond.");
    } else {
      alert(result.message || "Could not apply. Please try again.");
      if (btn) { btn.disabled = false; btn.textContent = "Apply"; }
    }

  } catch (err) {
    console.error("Apply error:", err);
    alert("Something went wrong. Please try again.");
    if (btn) { btn.disabled = false; btn.textContent = "Apply"; }
  }
}

// ── Load my applications ──
async function loadMyApplications() {
  if (!currentWorker) return;

  const container = document.getElementById("myApplicationsContainer");
  if (!container) return;

  const { data, error } = await _supabase
    .from("applications")
    .select(`*, shifts(facility_name, role_needed, city, shift_date, start_time, pay_rate)`)
    .eq("worker_id", currentWorker.id)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No applications yet.</p>
      </div>`;
    return;
  }

  container.innerHTML = data.map(app => {
    const shift = app.shifts;
    const statusBadge = {
      pending: '<span class="badge badge-yellow">Pending</span>',
      accepted: '<span class="badge badge-green">✓ Accepted</span>',
      rejected: '<span class="badge" style="background:rgba(226,75,74,0.1); color:#E24B4A; border:1px solid rgba(226,75,74,0.2);">Rejected</span>',
      withdrawn: '<span class="badge badge-grey">Withdrawn</span>'
    }[app.status] || `<span class="badge badge-grey">${app.status}</span>`;

    return `
      <div class="profile-card" style="margin-bottom:10px;">
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(shift?.facility_name) || "—"}</h3>
          <p>${escapeHtml(shift?.role_needed) || "—"} · ${escapeHtml(shift?.city) || "—"}</p>
          <p>${escapeHtml(shift?.shift_date) || "—"} · ${escapeHtml(shift?.pay_rate) || "—"}</p>
          <div style="margin-top:6px;">${statusBadge}</div>
        </div>
        ${app.status === "pending" ? `
          <button
            onclick="withdrawApplication('${escapeHtml(app.id)}', this)"
            style="font-size:12px; padding:7px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:rgba(255,255,255,0.4); cursor:pointer; font-family:inherit;">
            Withdraw
          </button>
        ` : ""}
      </div>
    `;
  }).join("");
}

// ── Withdraw application ──
async function withdrawApplication(applicationId, btn) {
  if (!confirm("Withdraw this application?")) return;
  if (!currentWorker) return;

  if (btn) { btn.disabled = true; btn.textContent = "Withdrawing..."; }

  try {
    const { data: result } = await ccFetch("/applications/withdraw", {
      method: "POST",
      body: JSON.stringify({
        application_id: applicationId,
        worker_id: currentWorker.id
      })
    });

    if (result.success) {
      await loadMyApplications();
    } else {
      alert(result.message || "Could not withdraw. Please try again.");
      if (btn) { btn.disabled = false; btn.textContent = "Withdraw"; }
    }
  } catch (err) {
    console.error("Withdraw error:", err);
    if (btn) { btn.disabled = false; btn.textContent = "Withdraw"; }
  }
}

// ── Logout ──
async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}

init();