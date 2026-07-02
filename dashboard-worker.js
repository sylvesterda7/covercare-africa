// ── Config & Supabase ──
window._supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

const _supabase = window._supabase;
ccInitInactivityLogout(_supabase);
let currentWorker = null;

// ── Init ──
async function init() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }

  const user = session.user;
  const meta = user.user_metadata || {};

  if (!meta.user_type) {
    window.location.href = "oauth-setup.html";
    return;
  }

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
  await loadMyApplications();
  await loadCompletedShifts();
  await loadPayroll();
  await loadRatings();
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

  // Show/hide identity verify link
  const verifyLink = document.getElementById("verifyIdentityLink");
  if (verifyLink) {
    verifyLink.style.display = data.identity_verified ? "none" : "block";
  }

  const avatarEl = document.getElementById("profileAvatar");
  if (data.profile_photo_url) {
    avatarEl.innerHTML = `<img src="${escapeHtml(data.profile_photo_url)}" alt="Profile photo" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
    avatarEl.style.background = "none";
    avatarEl.style.border = "none";
  } else {
    const initials = data.full_name
      .split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    avatarEl.textContent = initials;
    avatarEl.style.background = "";
    avatarEl.style.border = "";
  }
  document.getElementById("profileName").textContent = data.full_name;
  document.getElementById("profileRole").textContent = data.role;
  document.getElementById("profileCity").textContent = `📍 ${data.city}`;

  let badges = "";
  badges += data.license_verified
    ? `<span class="badge badge-accent" style="margin-right:6px;">✓ License verified</span>`
    : `<span class="badge badge-yellow" style="margin-right:6px;">License pending</span>`;
  badges += data.identity_verified
    ? `<span class="badge badge-accent">✓ Identity verified</span>`
    : `<span class="badge badge-yellow">Identity pending</span>`;

  document.getElementById("profileBadges").innerHTML = badges;
  document.getElementById("verifiedBadge").textContent = data.license_verified ? "✓" : "Pending";

  // ── Activation status banner ──
  renderActivationStatus(data);

  updateAvailBtn(true);
}

// ── Render activation status banner ──
function renderActivationStatus(worker) {
  const banner = document.getElementById("activationBanner");
  if (!banner) return;

  if (worker.activated) {
    banner.style.display = "none";
    return;
  }

  const canAutoVer = canAutoVerify(worker.country || "", worker.role || "");
  const licenseDone = worker.license_verified || (worker.license_file_url);
  const identityDone = worker.identity_verified;

  let steps = "";

  // Step 1: License
  if (canAutoVer && !worker.license_verified) {
    steps += `
      <div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
        <span style="width:24px; height:24px; border-radius:50%; border:2px solid #d1d5db; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px; color:#9ca3af; font-weight:600;">1</span>
        <div>
          <strong style="font-size:14px;">Verify your license</strong>
          <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Click "Verify" next to your license number above to check against the regulatory body database.</p>
        </div>
      </div>
    `;
  } else if (!canAutoVer && !licenseDone) {
    steps += `
      <div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
        <span style="width:24px; height:24px; border-radius:50%; border:2px solid #d1d5db; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px; color:#9ca3af; font-weight:600;">1</span>
        <div>
          <strong style="font-size:14px;">Upload your license document</strong>
          <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Upload a copy of your professional license for manual review. <button onclick="openProfileSettings()" style="background:none; border:none; color:#111827; font-weight:600; cursor:pointer; padding:0; font-family:inherit; font-size:13px; text-decoration:underline;">Upload now</button></p>
        </div>
      </div>
    `;
  } else {
    steps += `
      <div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
        <span style="width:24px; height:24px; border-radius:50%; background:#111827; color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px; font-weight:600;">✓</span>
        <div>
          <strong style="font-size:14px;">License</strong>
          <p style="font-size:13px; color:#059669; margin:4px 0 0;">${worker.license_verified ? "Verified" : "Document received — pending review"}</p>
        </div>
      </div>
    `;
  }

  // Step 2: Identity
  if (!identityDone) {
    steps += `
      <div style="display:flex; align-items:flex-start; gap:12px;">
        <span style="width:24px; height:24px; border-radius:50%; border:2px solid #d1d5db; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px; color:#9ca3af; font-weight:600;">2</span>
        <div>
          <strong style="font-size:14px;">Verify your identity</strong>
          <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">Upload a government-issued ID and take a selfie to confirm your identity. <a href="identity-verify.html" style="color:#111827; font-weight:600;">Start verification</a></p>
        </div>
      </div>
    `;
  } else {
    steps += `
      <div style="display:flex; align-items:flex-start; gap:12px;">
        <span style="width:24px; height:24px; border-radius:50%; background:#111827; color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px; font-weight:600;">✓</span>
        <div>
          <strong style="font-size:14px;">Identity verified</strong>
          <p style="font-size:13px; color:#059669; margin:4px 0 0;">Your ID and selfie have been submitted.</p>
        </div>
      </div>
    `;
  }

  const allDone = licenseDone && identityDone;

  const title = allDone
    ? "Account under review"
    : "Complete your account to start working";
  const subtitle = allDone
    ? "Your documents have been submitted. Our team will review and activate your account — usually within 24 hours."
    : "Complete these steps to unlock all features and start accepting shifts.";

  banner.style.display = "block";
  banner.innerHTML = `
    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:1rem;">
        <span style="width:8px; height:8px; border-radius:50%; background:${allDone ? '#f59e0b' : '#E24B4A'};"></span>
        <h3 style="margin:0; font-size:15px;">${title}</h3>
      </div>
      <p style="font-size:13px; color:#6b7280; margin:0 0 1rem;">${subtitle}</p>
      ${steps}
    </div>
  `;
}

// ── Available shifts data store ──
let _allShifts = [];

function renderShifts(shifts) {
  const container = document.getElementById("shiftsContainer");
  if (!shifts || shifts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No shifts match your filters.</p>
        <p style="font-size:13px;">Try adjusting your search or clear filters.</p>
      </div>`;
    return;
  }
  container.innerHTML = shifts.map(shift => {
    const posterInitials = shift._poster_name ? shift._poster_name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : (shift.role_needed ? shift.role_needed.substring(0, 2).toUpperCase() : "SH");
    const branchInfo = shift._branch_name ? `<p style="font-size:12px;color:#6b7280;">📍 ${escapeHtml(shift._branch_name)}${shift._branch_address ? " · " + escapeHtml(shift._branch_address) : ""}</p>` : "";
    const directionsBtn = (shift._branch_lat && shift._branch_lng) ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${shift._branch_lat},${shift._branch_lng}" target="_blank" style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:#111827;cursor:pointer;text-decoration:none;display:inline-block;">🗺 Directions</a>` : "";
    const assignedBadge = shift._is_assigned ? `<span class="badge" style="background:#111827;color:#fff;font-size:11px;">Assigned to you</span>` : "";
    return `
    <div class="profile-card" style="margin-bottom:12px;">
      <div class="profile-avatar" style="background:rgba(17,24,39,0.1); font-size:14px; overflow:hidden;">
        ${shift._poster_photo ? `<img src="${escapeHtml(shift._poster_photo)}" alt="" style="width:100%;height:100%;object-fit:cover;" />` : posterInitials}
      </div>
      <div class="profile-info" style="flex:1;">
        <h3>${escapeHtml(shift._poster_name || shift.facility_name) || "—"}</h3>
        <p>${escapeHtml(shift.role_needed) || "—"} · ${escapeHtml(shift._poster_city || shift.city) || "—"}</p>
        <p>${escapeHtml(shift.shift_date) || "—"} · ${escapeHtml(shift.start_time) || "—"} · ${escapeHtml(shift.duration) || "—"}</p>
        <p style="color:#111827; font-weight:500;">${escapeHtml(shift.pay_rate) || "—"}</p>
        ${branchInfo}
        <div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <span class="badge badge-accent">
            ${shift.urgency === "today" ? "🔴 Urgent" : "Open"}
          </span>
          ${assignedBadge}
          ${directionsBtn}
        </div>
      </div>
      <div>
        <button
          onclick="applyToShift('${escapeHtml(shift.id)}', this)"
          class="btn-primary-sm"
          style="font-size:13px; padding:8px 16px;">
          ${shift._is_assigned && shift.status === "open" ? "Accept" : "Apply"}
        </button>
      </div>
    </div>`;
  }).join("");
}

function applyFilters() {
  const search = (document.getElementById("filterSearch").value || "").toLowerCase();
  const urgency = document.getElementById("filterUrgency").value;

  let filtered = _allShifts;

  if (search) {
    filtered = filtered.filter(s =>
      (s.facility_name || "").toLowerCase().includes(search) ||
      (s.role_needed || "").toLowerCase().includes(search) ||
      (s.city || "").toLowerCase().includes(search)
    );
  }

  if (urgency === "today") {
    filtered = filtered.filter(s => s.urgency === "today");
  }

  renderShifts(filtered);
}

function normalizeRole(role) {
  const map = {
    "medical-doctor": "medical-doctor",
    "lab-technician": "lab-technician",
    "pharmacist": "pharmacist",
    "pharmacy-tech": "pharmacy-tech",
    "nurse": "nurse",
    "doctor": "medical-doctor",
    "lab-tech": "lab-technician",
    "caregiver": "caregiver",
    "midwife": "midwife",
    "community health worker": "community health worker",
    "other": null
  };
  if (!role) return null;
  const key = role.toLowerCase();
  return map[key] || null;
}

async function loadShifts() {
  const workerRole = currentWorker ? normalizeRole(currentWorker.role) : null;
  const workerId = currentWorker?.id;

  // Fetch open shifts matching role
  let query = _supabase
    .from("shifts")
    .select("*")
    .eq("status", "open");

  if (workerRole) {
    query = query.eq("role_needed", workerRole);
  }

  const { data: openShifts, error } = await query
    .order("created_at", { ascending: false })
    .limit(20);

  // Also fetch shifts preassigned to this worker
  let assignedShifts = [];
  if (workerId) {
    const { data: as } = await _supabase
      .from("shifts")
      .select("*")
      .eq("assigned_to_worker_id", workerId)
      .in("status", ["open", "accepted", "in_progress"])
      .order("created_at", { ascending: false });
    if (as) assignedShifts = as;
  }

  let allData = [...(openShifts || []), ...assignedShifts];
  // Deduplicate
  const seen = new Set();
  allData = allData.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });

  if (allData.length === 0) {
    document.getElementById("shiftsContainer").innerHTML = `
      <div class="empty-state"><p>No shifts available in your area right now.</p></div>`;
    return;
  }

  // Exclude shifts the worker has already applied to
  const appliedIds = new Set();
  if (currentWorker) {
    const { data: apps } = await _supabase
      .from("applications")
      .select("shift_id")
      .eq("worker_id", currentWorker.id);
    if (apps) apps.forEach(a => appliedIds.add(a.shift_id));
  }

  // Also exclude assigned shifts that are accepted (they'll show in active section)
  // but keep assigned open shifts visible

  // Fetch poster details (clients) for shifts
  const clientEmails = [...new Set(allData
    .filter(s => !appliedIds.has(s.id))
    .map(s => s.contact_email?.toLowerCase())
    .filter(Boolean))];
  const posterMap = {};
  if (clientEmails.length > 0) {
    const { data: clients } = await _supabase
      .from("clients")
      .select("email, full_name, profile_photo_url, city")
      .in("email", clientEmails);
    if (clients) {
      clients.forEach(c => { posterMap[c.email.toLowerCase()] = c; });
    }
  }

  // Fetch branch locations for shifts that have branch_id
  const branchIds = [...new Set(allData.map(s => s.branch_id).filter(Boolean))];
  const branchMap = {};
  if (branchIds.length > 0) {
    const { data: branches } = await _supabase
      .from("facility_branches")
      .select("*")
      .in("id", branchIds);
    if (branches) {
      branches.forEach(b => { branchMap[b.id] = b; });
    }
  }

  _allShifts = allData.filter(s => !appliedIds.has(s.id) || assignedShifts.some(a => a.id === s.id)).map(s => {
    const poster = posterMap[s.contact_email?.toLowerCase()];
    if (poster) {
      s._poster_name = poster.full_name;
      s._poster_photo = poster.profile_photo_url;
      s._poster_city = poster.city;
    }
    const branch = branchMap[s.branch_id];
    if (branch) {
      s._branch_name = branch.name;
      s._branch_address = branch.address;
      s._branch_lat = branch.latitude;
      s._branch_lng = branch.longitude;
    }
    s._is_assigned = assignedShifts.some(a => a.id === s.id);
    return s;
  });
  applyFilters();
}

let _countdownTimers = {};
function calcShiftEndTime(shift) {
  if (!shift.shift_date || !shift.start_time) return null;
  const start = new Date(`${shift.shift_date}T${shift.start_time}:00`);
  if (isNaN(start.getTime())) return null;
  const hours = parseFloat(shift.duration_hours) || parseFloat((shift.duration || "").replace(/[^0-9.]/g, "")) || 0;
  return new Date(start.getTime() + hours * 60 * 60 * 1000);
}

setInterval(() => {
  const now = Date.now();
  Object.keys(_countdownTimers).forEach(id => {
    const el = document.getElementById(id);
    if (!el) { delete _countdownTimers[id]; return; }
    const end = _countdownTimers[id];
    const diff = end - now;
    if (diff <= 0) {
      el.textContent = "Shift ended";
      el.style.color = "#E24B4A";
      delete _countdownTimers[id];
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${h}h ${m}m ${s}s`;
  });
}, 1000);

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

  // Fetch branch info for active shifts
  const branchIds = [...new Set(data.map(s => s.branch_id).filter(Boolean))];
  const branchMap = {};
  if (branchIds.length > 0) {
    const { data: branches } = await _supabase.from("facility_branches").select("*").in("id", branchIds);
    if (branches) branches.forEach(b => { branchMap[b.id] = b; });
  }

  container.innerHTML = data.map(shift => {
    const safeId = escapeHtml(shift.id);
    const safeWorkerId = escapeHtml(currentWorker.id);
    const branch = shift.branch_id ? branchMap[shift.branch_id] : null;
    const endTime = calcShiftEndTime(shift);
    const expired = endTime && Date.now() > endTime.getTime();

    if (expired && shift.status === "accepted") {
      return `
        <div class="profile-card" style="flex-direction:column; margin-bottom:12px;">
          <div style="display:flex; gap:12px; align-items:flex-start; width:100%;">
            <div class="profile-avatar" style="background:rgba(17,24,39,0.1); font-size:14px;">
              ${shift.role_needed ? escapeHtml(shift.role_needed.substring(0, 2).toUpperCase()) : "SH"}
            </div>
            <div class="profile-info" style="flex:1;">
              <h3>${escapeHtml(shift.facility_name) || "—"}</h3>
              <p>${escapeHtml(shift.role_needed) || "—"} · ${escapeHtml(shift.city) || "—"}</p>
              <p>${escapeHtml(shift.shift_date) || "—"} · ${escapeHtml(shift.start_time) || "—"}</p>
              <p style="color:#111827; font-weight:500;">${escapeHtml(shift.pay_rate) || "—"}</p>
              <div style="margin-top:6px;">
                <span class="badge" style="background:rgba(226,75,74,0.1); color:#E24B4A; border:1px solid rgba(226,75,74,0.2);">Expired — check-in no longer available</span>
              </div>
            </div>
          </div>
        </div>`;
    }

    const qrUrl = (shift.qr_token && !expired)
      ? `${window.location.origin}/qr-arrive.html?shift_id=${safeId}&worker_id=${safeWorkerId}&token=${escapeHtml(shift.qr_token)}`
      : null;

    const countdownId = `cd-${safeId}`;

    const qrImg = qrUrl && shift.status === "accepted"
      ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}"
           alt="QR Code" style="width:180px; height:180px; border-radius:8px; margin:1rem auto; display:block;" />`
      : "";

    // Set up countdown for in-progress shifts
    if (shift.status === "in_progress" && endTime) {
      _countdownTimers[countdownId] = endTime.getTime();
    }

    const lateInfo = shift.late_minutes > 0 ? `
      <p style="font-size:12px;color:#b45309;margin-top:6px;">
        ⏰ ${shift.late_minutes} min late · Pay adjusted to ${escapeHtml(shift.adjusted_pay || shift.pay_rate)}
      </p>` : "";

    return `
      <div class="profile-card" style="flex-direction:column; margin-bottom:12px;">
        <div style="display:flex; gap:12px; align-items:flex-start; width:100%;">
          <div class="profile-avatar" style="background:rgba(17,24,39,0.1); font-size:14px;">
            ${shift.role_needed ? escapeHtml(shift.role_needed.substring(0, 2).toUpperCase()) : "SH"}
          </div>
          <div class="profile-info" style="flex:1;">
              <h3>${escapeHtml(shift.facility_name) || "—"}</h3>
              <p>${escapeHtml(shift.role_needed) || "—"} · ${escapeHtml(shift.city) || "—"}</p>
              <p>${escapeHtml(shift.shift_date) || "—"} · ${escapeHtml(shift.start_time) || "—"}</p>
              <p style="color:#111827; font-weight:500;">${escapeHtml(shift.pay_rate) || "—"}</p>
              ${branch ? `<p style="font-size:12px;color:#6b7280;">📍 ${escapeHtml(branch.name)}${branch.address ? " · " + escapeHtml(branch.address) : ""}</p>` : ""}
              ${lateInfo}
              <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                ${shift.status === "in_progress"
                  ? expired
                    ? `<span class="badge" style="background:rgba(226,75,74,0.1); color:#E24B4A; border:1px solid rgba(226,75,74,0.2);">Shift ended</span>`
                    : `<span class="badge badge-accent">In progress · <strong id="${countdownId}">${endTime && endTime > new Date() ? "—" : "Ended"}</strong></span>`
                  : `<span class="badge badge-yellow">Accepted — show QR on arrival</span>`
                }
                ${branch?.latitude && branch?.longitude ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}" target="_blank" style="font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:#111827;cursor:pointer;text-decoration:none;">🗺 Directions</a>` : ""}
              </div>
          </div>
        </div>
        ${qrImg}
        ${shift.status === "accepted" && !expired ? `
          <p style="font-size:12px; color:var(--fg-muted); text-align:center; margin-top:4px;">
            Show this QR code when you arrive at the facility
          </p>
        ` : ""}
        ${shift.status === "in_progress" && !expired ? `
          <div style="text-align:center; margin-top:12px;">
            <a href="${qrUrl || '#'}" class="btn-primary-sm">Complete shift & check out</a>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

// ── Apply to shift ──
async function applyToShift(shiftId, btn) {
  if (!currentWorker) {
    ccToast("Please complete your profile before applying to shifts.", "error");
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
      if (result.auto_accepted) {
        ccToast("Shift accepted! Show the QR code on arrival.", "success");
        if (btn) { btn.disabled = true; btn.textContent = "Accepted ✓"; }
        const card = btn?.closest(".profile-card");
        if (card) card.remove();
        loadMyShifts();
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = "Applied ✓"; }
      const card = btn?.closest(".profile-card");
      if (card) card.remove();
      ccToast("Application submitted! The facility will review and respond.", "success");
    } else {
      ccToast(result.message || "Could not apply. Please try again.", "error");
      if (btn) { btn.disabled = false; btn.textContent = "Apply"; }
    }

  } catch (err) {
    console.error("Apply error:", err);
    ccToast("Something went wrong. Please try again.", "error");
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
      accepted: '<span class="badge badge-accent">✓ Accepted</span>',
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
            style="font-size:12px; padding:7px 14px; border-radius:8px; border:1px solid var(--border); background:transparent; color:var(--fg-muted); cursor:pointer; font-family:inherit;">
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
      ccToast(result.message || "Could not withdraw. Please try again.", "error");
      if (btn) { btn.disabled = false; btn.textContent = "Withdraw"; }
    }
  } catch (err) {
    console.error("Withdraw error:", err);
    if (btn) { btn.disabled = false; btn.textContent = "Withdraw"; }
  }
}

// ── Load completed shifts ──
async function loadCompletedShifts() {
  const container = document.getElementById("completedShiftsContainer");
  if (!container) return;

  const { data: result } = await ccFetch("/shifts/history", { method: "GET" });

  if (!result?.success || !result.data || result.data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No completed shifts yet.</p>
        <p style="font-size:13px;">Once you complete a shift, it'll appear here with your earnings.</p>
      </div>`;
    return;
  }

  const totalEarned = result.data.reduce((sum, s) => {
    const pay = s.adjusted_pay || s.total_pay;
    return sum + (parseFloat((pay || "").replace(/[^0-9.]/g, "")) || 0);
  }, 0);

  container.innerHTML = `
    <p style="font-size:13px; color:var(--fg-muted); margin-bottom:12px;">
      ${result.data.length} shift${result.data.length > 1 ? "s" : ""} · Total earned: <strong style="color:#111827;">GHS ${totalEarned.toLocaleString()}</strong>
    </p>
    ${result.data.map(s => {
      const lateInfo = s.late_minutes > 0 ? `
        <p style="font-size:12px;color:#b45309;margin-top:4px;">
          ⏰ ${s.late_minutes} min late${s.adjusted_pay ? ` · Paid: ${escapeHtml(s.adjusted_pay)}` : ''}${s.made_up ? ' · <span style="color:#059669;">Made up time</span>' : ''}
        </p>` : "";
      return `
      <div class="profile-card" style="margin-bottom:10px;">
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(s.facility_name) || "—"}</h3>
          <p>${escapeHtml(s.role_needed) || "—"} · ${escapeHtml(s.city) || "—"}</p>
          <p>${escapeHtml(s.shift_date) || "—"} · ${escapeHtml(s.start_time) || "—"} · ${escapeHtml(s.duration) || "—"}</p>
          <p style="color:#111827; font-weight:500;">${escapeHtml(s.total_pay) || "—"}</p>
          ${lateInfo}
        </div>
        <button onclick="openRatingModal('${escapeHtml(s.id)}', '${escapeHtml(s.contact_email)}', '${escapeHtml(s.facility_name)}')" class="btn-primary-sm" style="font-size:12px; padding:7px 14px; flex-shrink:0;">Rate</button>
      </div>`;
    }).join("")}
  `;
}

// ── Profile settings ──
function openProfileSettings() {
  if (!currentWorker) { ccToast("Complete your profile first.", "error"); return; }
  document.getElementById("editFullname").value = currentWorker.full_name || "";
  document.getElementById("editPhone").value = currentWorker.phone || "";
  document.getElementById("editRole").value = currentWorker.role || "";
  const licField = document.getElementById("editLicense");
  licField.value = currentWorker.license_number || "";
  if (currentWorker.license_verified) {
    licField.disabled = true;
    licField.title = "License verified — cannot be changed";
    licField.style.opacity = "0.5";
    licField.style.cursor = "not-allowed";
  } else {
    licField.disabled = false;
    licField.title = "";
    licField.style.opacity = "1";
    licField.style.cursor = "";
  }
  document.getElementById("editCity").value = currentWorker.city || "";
  document.getElementById("editExperience").value = currentWorker.experience || "";
  document.getElementById("editBio").value = currentWorker.bio || "";
  const previewEl = document.getElementById("profilePhotoPreview");
  if (previewEl) {
    previewEl.src = currentWorker.profile_photo_url || "";
    previewEl.style.display = currentWorker.profile_photo_url ? "block" : "none";
  }
  document.getElementById("profileModal").style.display = "flex";
}

function closeProfileSettings() {
  document.getElementById("profileModal").style.display = "none";
}

// ── Profile photo preview in edit modal ──
document.getElementById("editPhoto")?.addEventListener("change", function() {
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

document.getElementById("profileForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Saving...";

  const fileInput = document.getElementById("editPhoto");
  let profilePhotoUrl = currentWorker.profile_photo_url || null;
  if (fileInput?.files?.[0]) {
    try {
      const { data: photoResult } = await ccFetch("/api/upload", {
        method: "POST",
        body: JSON.stringify({
          image: await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(fileInput.files[0]);
          }),
          folder: "worker-photos"
        })
      });
      if (photoResult?.success) profilePhotoUrl = photoResult.url;
    } catch (e) { console.error("Photo upload error:", e); }
  }

  try {
    const { data: result } = await ccFetch("/worker", {
      method: "PUT",
      body: JSON.stringify({
        full_name: document.getElementById("editFullname").value.trim(),
        phone: document.getElementById("editPhone").value.trim(),
        role: document.getElementById("editRole").value,
        license_number: document.getElementById("editLicense").value.trim(),
        city: document.getElementById("editCity").value,
        experience: document.getElementById("editExperience").value,
        bio: document.getElementById("editBio").value.trim(),
        profile_photo_url: profilePhotoUrl
      })
    });

    if (result.success) {
      ccToast("Profile updated!", "success");
      closeProfileSettings();
      const { data: { session } } = await _supabase.auth.getSession();
      if (session) await loadProfile(session.user.email);
    } else {
      ccToast(result.message || "Could not update profile.", "error");
    }
  } catch (err) {
    console.error("Update error:", err);
    ccToast("Something went wrong.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save changes";
  }
});

// ── Delete account ──
async function confirmDeleteAccount() {
  if (!confirm("Permanently delete your account and all data? This cannot be undone.")) return;
  const email = prompt("Type your email to confirm deletion:");
  if (!email) return;

  try {
    const { data: result } = await ccFetch("/account/delete", {
      method: "POST",
      body: JSON.stringify({ email })
    });

    if (result.success) {
      await _supabase.auth.signOut();
      window.location.href = "index.html";
    } else {
      ccToast(result.message || "Could not delete account.", "error");
    }
  } catch (err) {
    console.error("Delete error:", err);
    ccToast("Something went wrong.", "error");
  }
}

// ── Logout ──
async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}

// ── Availability toggle ──
async function toggleAvailability() {
  try {
    const { data: current } = await ccFetch("/worker/availability", { method: "GET" });
    const newAvail = !current.available;
    await ccFetch("/worker/availability", {
      method: "POST",
      body: JSON.stringify({ available: newAvail })
    });
    updateAvailBtn(newAvail);
  } catch (e) { console.error(e); }
}
function updateAvailBtn(available) {
  const btn = document.getElementById("availBtn");
  if (!btn) return;
  btn.textContent = available ? "Set unavailable" : "Set available";
  btn.style.borderColor = available ? "rgba(17,24,39,0.3)" : "rgba(226,75,74,0.3)";
}

// ── Payroll ──
async function loadPayroll() {
  const container = document.getElementById("payrollContainer");
  if (!container) return;
  const { data: result } = await ccFetch("/payroll/summary", { method: "GET" });
  if (!result?.data) {
    container.innerHTML = '<div class="empty-state"><p>No payroll data yet.</p></div>';
    return;
  }
  const d = result.data;
  let html = '<div class="stats-row" style="margin-bottom:12px;">';
  html += `<div class="stat-box"><div class="num">GHS ${(d.total_earnings || 0).toLocaleString()}</div><div class="label">Total earnings</div></div>`;
  html += `<div class="stat-box"><div class="num">${d.paid_shifts || 0}</div><div class="label">Paid shifts</div></div>`;
  html += `<div class="stat-box"><div class="num">${d.last_payout_date ? new Date(d.last_payout_date).toLocaleDateString() : "—"}</div><div class="label">Last payout</div></div>`;
  html += '</div>';
  html += '<div style="margin-top:8px;"><button onclick="togglePayslips()" class="btn-sidebar" style="text-align:center; width:100%;" id="payslipToggle">View payslips</button></div>';
  html += '<div id="payslipContainer" style="display:none; margin-top:12px;"><div class="empty-state"><p>Loading...</p></div></div>';
  container.innerHTML = html;
}
async function togglePayslips() {
  const container = document.getElementById("payslipContainer");
  const toggle = document.getElementById("payslipToggle");
  if (!container) return;
  if (container.style.display === "none") {
    container.style.display = "block";
    if (toggle) toggle.textContent = "Hide payslips";
    const { data: result } = await ccFetch("/payroll/earnings", { method: "GET" });
    if (!result?.data || result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No payslips available.</p></div>';
      return;
    }
    container.innerHTML = result.data.map(s => `
      <div class="profile-card" style="margin-bottom:8px;">
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(s.facility_name) || "—"}</h3>
          <p>${escapeHtml(s.shift_date) || "—"} · ${escapeHtml(s.role_needed) || "—"}</p>
          <p style="color:#111827; font-weight:500;">${escapeHtml(s.total_pay) || "—"}</p>
          <div style="margin-top:4px;"><span class="badge ${s.paid ? 'badge-accent' : 'badge-yellow'}">${s.paid ? "Paid" : "Pending"}</span></div>
        </div>
      </div>
    `).join("");
  } else {
    container.style.display = "none";
    if (toggle) toggle.textContent = "View payslips";
  }
}

// ── Ratings ──
async function loadRatings() {
  const container = document.getElementById("ratingsContainer");
  if (!container) return;
  const { data: result } = await ccFetch("/ratings/mine", { method: "GET" });
  if (!result?.data || result.data.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No ratings yet.</p></div>';
    return;
  }
  let totalRating = 0;
  result.data.forEach(r => { totalRating += r.rating || 0; });
  const avgRating = result.data.length > 0 ? (totalRating / result.data.length).toFixed(1) : "—";
  document.getElementById("rating").textContent = avgRating;

  container.innerHTML = result.data.map(r => `
    <div class="profile-card" style="margin-bottom:8px;">
      <div class="profile-info" style="flex:1;">
        <p style="color:#111827;">${"★".repeat(Math.round(r.rating || 0))}${"☆".repeat(5 - Math.round(r.rating || 0))} <span style="color:var(--fg-muted);">${r.rating || 0}/5</span></p>
        ${r.review ? `<p style="font-size:13px; color:var(--fg-muted); margin-top:4px;">"${escapeHtml(r.review)}"</p>` : ""}
        <p style="font-size:11px; color:var(--fg-muted); margin-top:4px;">${r.rater_name ? escapeHtml(r.rater_name) : ""}${r.created_at ? " · " + new Date(r.created_at).toLocaleDateString() : ""}</p>
      </div>
    </div>
  `).join("");
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

// ── Rating modal ──
let ratingShiftId = null;
let ratingTargetEmail = null;
let selectedRating = 0;

function openRatingModal(shiftId, targetEmail, facilityName) {
  ratingShiftId = shiftId;
  ratingTargetEmail = targetEmail;
  selectedRating = 0;
  document.getElementById("ratingFacilityName").textContent = facilityName || "Facility";
  document.getElementById("ratingReview").value = "";
  document.getElementById("submitRatingBtn").textContent = "Submit rating";
  document.getElementById("submitRatingBtn").disabled = false;
  for (let i = 1; i <= 5; i++) {
    document.getElementById("star" + i).style.color = "var(--border)";
  }
  document.getElementById("ratingModal").style.display = "flex";
}

function closeRatingModal() {
  document.getElementById("ratingModal").style.display = "none";
}

function setRating(val) {
  selectedRating = val;
  for (let i = 1; i <= 5; i++) {
    document.getElementById("star" + i).style.color = i <= val ? "#F0B429" : "var(--border)";
  }
}

async function submitRating() {
  if (selectedRating === 0) { ccToast("Please select a rating.", "error"); return; }
  const btn = document.getElementById("submitRatingBtn");
  btn.disabled = true;
  btn.textContent = "Submitting...";
  const review = document.getElementById("ratingReview").value.trim();
  const { data: result } = await ccFetch("/ratings", {
    method: "POST",
    body: JSON.stringify({
      shift_id: ratingShiftId,
      rating: selectedRating,
      review: review,
      target_email: ratingTargetEmail
    })
  });
  if (result?.success) {
    ccToast("Rating submitted! Thank you for your feedback.", "success");
    closeRatingModal();
    loadCompletedShifts();
    loadRatings();
  } else {
    ccToast(result?.message || "Failed to submit rating.", "error");
    btn.disabled = false;
    btn.textContent = "Submit rating";
  }
}

// ── Support ──
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
  if (data?.success) {
    ccToast("Support ticket sent! We'll respond within 24 hours.", "success");
    closeSupportModal();
  } else {
    ccToast("Failed to send. Please try again.", "error");
  }
  btn.disabled = false; btn.textContent = "Send";
});

// ── Sidebar drawer ──
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
init();