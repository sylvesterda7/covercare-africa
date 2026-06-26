// ── Config & Supabase ──
window._supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
const _supabase = window._supabase;

let facilityEmail = null;

// ── Init ──
async function init() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }

  const user = session.user;
  const meta = user.user_metadata;

  if (meta.user_type === "worker") {
    window.location.href = "dashboard-worker.html";
    return;
  }

  facilityEmail = user.email;
  document.getElementById("navUser").textContent = meta.full_name || user.email;

  const firstName = meta.full_name ? meta.full_name.split(" ")[0] : "there";
  document.getElementById("welcomeMsg").textContent = `Welcome back, ${firstName}`;

  await loadShifts(facilityEmail);
  await loadApplications(facilityEmail);
  await loadCompletedShifts();
  await loadFacilityProfile();
}

// ── Load shifts ──
async function loadShifts(email) {
  const { data, error } = await _supabase
    .from("shifts")
    .select("*")
    .eq("contact_email", email)
    .order("created_at", { ascending: false });

  if (error || !data) return;

  const openShifts = data.filter(s => s.status === "open");
  const inProgress = data.filter(s => s.status === "in_progress");
  const filledShifts = data.filter(s => s.status === "accepted" || s.status === "in_progress" || s.status === "completed");

  // ── Stats ──
  document.getElementById("totalShifts").textContent = data.length;
  document.getElementById("openShifts").textContent = openShifts.length;
  document.getElementById("onSiteNow").textContent = inProgress.length;
  document.getElementById("filledShifts").textContent = filledShifts.length;

  const totalSpend = filledShifts.reduce((sum, shift) => {
    return sum + (parseFloat((shift.total_pay || "0").replace(/[^0-9.]/g, "")) || 0);
  }, 0);
  document.getElementById("totalSpend").textContent = "GHS " + totalSpend.toLocaleString();

  // ── Open shifts ──
  const openContainer = document.getElementById("openShiftsContainer");
  if (openShifts.length > 0) {
    openContainer.innerHTML = openShifts.map(shift => `
      <div class="profile-card" style="margin-bottom:12px;">
        <div class="profile-avatar" style="background:rgba(93,202,165,0.1); font-size:14px;">
          ${shift.role_needed ? escapeHtml(shift.role_needed.substring(0, 2).toUpperCase()) : "SH"}
        </div>
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(shift.role_needed) || "—"}</h3>
          <p>${escapeHtml(shift.shift_date) || "—"} · ${escapeHtml(shift.start_time) || "—"} · ${escapeHtml(shift.duration) || "—"}</p>
          <p style="color:#5DCAA5; font-weight:500;">${escapeHtml(shift.pay_rate) || "—"}</p>
          <div style="margin-top:8px;">
            <span class="badge badge-yellow">Awaiting applicants</span>
          </div>
        </div>
        <div>
          <button
            onclick="cancelShift('${escapeHtml(shift.id)}')"
            style="font-size:12px; padding:7px 14px; border-radius:8px; border:1px solid rgba(226,75,74,0.3); background:transparent; color:#E24B4A; cursor:pointer; font-family:inherit;">
            Cancel
          </button>
        </div>
      </div>
    `).join("");
  } else {
    openContainer.innerHTML = `
      <div class="empty-state">
        <p>No open shifts yet.</p>
        <a href="post-shift.html" class="btn-primary-sm">Post your first shift</a>
      </div>`;
  }

  // ── Live check-ins (in-progress) ──
  const liveContainer = document.getElementById("liveCheckinsContainer");
  if (liveContainer) {
    if (inProgress.length > 0) {
      const workerIds = [...new Set(inProgress.map(s => s.worker_id).filter(Boolean))];
      const { data: workers } = await _supabase.from("workers").select("id, full_name, role").in("id", workerIds);
      const workerMap = Object.fromEntries((workers || []).map(w => [w.id, w]));
      liveContainer.innerHTML = inProgress.map(s => `
        <div class="profile-card" style="margin-bottom:10px;">
          <div class="profile-info" style="flex:1;">
            <p style="color:#5DCAA5; font-weight:500;">${escapeHtml(workerMap[s.worker_id]?.full_name || "Worker")}</p>
            <p>${escapeHtml(s.role_needed) || "—"} · since ${escapeHtml(s.arrival_time ? new Date(s.arrival_time).toLocaleTimeString() : "—")}</p>
          </div>
        </div>
      `).join("");
    } else {
      liveContainer.innerHTML = `<div class="empty-state"><p>No workers checked in right now.</p></div>`;
    }
  }

  // ── Awaiting arrival (accepted, not yet arrived) ──
  const awaitingContainer = document.getElementById("awaitingArrivalContainer");
  if (awaitingContainer) {
    const awaiting = data.filter(s => s.status === "accepted" && s.worker_id);
    if (awaiting.length > 0) {
      awaitingContainer.innerHTML = awaiting.map(s => `
        <div class="profile-card" style="margin-bottom:10px;">
          <div class="profile-info" style="flex:1;">
            <p style="font-weight:500;">${escapeHtml(s.role_needed) || "—"}</p>
            <p>${escapeHtml(s.shift_date) || "—"} · ${escapeHtml(s.start_time) || "—"}</p>
          </div>
        </div>
      `).join("");
    } else {
      awaitingContainer.innerHTML = `<div class="empty-state"><p>No workers awaiting arrival.</p></div>`;
    }
  }

  // ── Filled shifts ──
  const filledContainer = document.getElementById("filledShiftsContainer");
  if (filledShifts.length > 0) {
    filledContainer.innerHTML = filledShifts.map(shift => `
      <div class="profile-card" style="margin-bottom:12px;">
        <div class="profile-avatar" style="background:rgba(93,202,165,0.1); font-size:14px;">
          ${shift.role_needed ? escapeHtml(shift.role_needed.substring(0, 2).toUpperCase()) : "SH"}
        </div>
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(shift.role_needed) || "—"}</h3>
          <p>${escapeHtml(shift.shift_date) || "—"} · ${escapeHtml(shift.start_time) || "—"} · ${escapeHtml(shift.duration) || "—"}</p>
          <p style="color:#5DCAA5; font-weight:500;">${escapeHtml(shift.total_pay) || "—"}</p>
          <div style="margin-top:8px;">
            <span class="badge badge-green">
              ${shift.status === "in_progress" ? "⏱ In progress" : shift.status === "completed" ? "✓ Completed" : "✓ Filled"}
            </span>
          </div>
        </div>
      </div>
    `).join("");
  } else {
    filledContainer.innerHTML = `
      <div class="empty-state">
        <p>No filled shifts yet.</p>
        <p style="font-size:13px;">Shifts will appear here once a worker is accepted.</p>
      </div>`;
  }
}

// ── Load applications ──
async function loadApplications(email) {
  const container = document.getElementById("applicationsContainer");
  if (!container) return;

  // Get open shifts for this facility
  const { data: shifts, error: shiftError } = await _supabase
    .from("shifts")
    .select("id, role_needed, shift_date, city")
    .eq("contact_email", email)
    .eq("status", "open");

  if (shiftError || !shifts || shifts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No pending applications yet.</p>
        <p style="font-size:13px;">Workers who apply to your shifts will appear here.</p>
      </div>`;
    return;
  }

  const shiftIds = shifts.map(s => s.id);
  const shiftMap = Object.fromEntries(shifts.map(s => [s.id, s]));

  // Get pending applications
  const { data: applications, error: appError } = await _supabase
    .from("applications")
    .select(`
      *,
      workers (
        id, full_name, role, city, experience,
        license_verified, identity_verified
      )
    `)
    .in("shift_id", shiftIds)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (appError || !applications || applications.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No pending applications yet.</p>
        <p style="font-size:13px;">Workers who apply to your open shifts will appear here.</p>
      </div>`;
    return;
  }

  container.innerHTML = applications.map(app => {
    const worker = app.workers;
    const shift = shiftMap[app.shift_id];
    if (!worker || !shift) return "";

    const initials = worker.full_name
      ? worker.full_name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)
      : "?";

    return `
      <div class="profile-card" style="margin-bottom:12px;">
        <div class="profile-avatar">${initials}</div>
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(worker.full_name) || "Unknown"}</h3>
          <p>${escapeHtml(worker.role) || "—"} · ${escapeHtml(worker.city) || "—"} · ${escapeHtml(worker.experience) || "—"} exp</p>
          <p style="font-size:12px; color:rgba(255,255,255,0.3);">
            Applied for: ${escapeHtml(shift.role_needed) || "—"} · ${escapeHtml(shift.shift_date) || "—"}
          </p>
          <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
            ${worker.license_verified
              ? '<span class="badge badge-green">✓ License</span>'
              : '<span class="badge badge-yellow">License pending</span>'
            }
            ${worker.identity_verified
              ? '<span class="badge badge-green">✓ Identity</span>'
              : '<span class="badge badge-yellow">Identity pending</span>'
            }
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <button
            onclick="acceptApplication('${escapeHtml(app.id)}')"
            class="btn-primary-sm"
            style="font-size:12px; padding:7px 14px;">
            Accept
          </button>
          <button
            onclick="rejectApplication('${escapeHtml(app.id)}')"
            style="font-size:12px; padding:7px 14px; border-radius:8px; border:1px solid rgba(226,75,74,0.3); background:transparent; color:#E24B4A; cursor:pointer; font-family:inherit;">
            Reject
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// ── Accept application ──
async function acceptApplication(applicationId) {
  if (!confirm("Accept this worker? All other applicants will be rejected.")) return;

  try {
    const { data: result } = await ccFetch("/applications/accept", {
      method: "POST",
      body: JSON.stringify({
        application_id: applicationId,
        facility_email: facilityEmail
      })
    });

    if (result.success) {
      alert("Worker accepted! Shift is now filled.");
      await loadShifts(facilityEmail);
      await loadApplications(facilityEmail);
    } else {
      alert(result.message || "Could not accept. Please try again.");
    }
  } catch (err) {
    console.error("Accept error:", err);
    alert("Something went wrong. Please try again.");
  }
}

// ── Reject application ──
async function rejectApplication(applicationId) {
  if (!confirm("Reject this application?")) return;

  try {
    const { data: result } = await ccFetch("/applications/reject", {
      method: "POST",
      body: JSON.stringify({
        application_id: applicationId,
        facility_email: facilityEmail
      })
    });

    if (result.success) {
      await loadApplications(facilityEmail);
    } else {
      alert(result.message || "Could not reject. Please try again.");
    }
  } catch (err) {
    console.error("Reject error:", err);
    alert("Something went wrong. Please try again.");
  }
}

// ── Cancel shift ──
async function cancelShift(shiftId) {
  if (!confirm("Are you sure you want to cancel this shift?")) return;

  const { error } = await _supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", shiftId)
    .eq("contact_email", facilityEmail);

  if (error) {
    alert("Could not cancel shift. Please try again.");
    return;
  }

  await loadShifts(facilityEmail);
  await loadApplications(facilityEmail);
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
        <p style="font-size:13px;">Finished shifts will appear here after workers check out.</p>
      </div>`;
    return;
  }

  const totalSpent = result.data.reduce((sum, s) => {
    return sum + (parseFloat((s.total_pay || "").replace(/[^0-9.]/g, "")) || 0);
  }, 0);

  container.innerHTML = `
    <p style="font-size:13px; color:rgba(255,255,255,0.3); margin-bottom:12px;">
      ${result.data.length} shift${result.data.length > 1 ? "s" : ""} · Total spent: <strong style="color:#5DCAA5;">GHS ${totalSpent.toLocaleString()}</strong>
    </p>
    ${result.data.map(s => `
      <div class="profile-card" style="margin-bottom:10px;">
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(s.role_needed) || "—"}</h3>
          <p>${escapeHtml(s.facility_name) || "—"} · ${escapeHtml(s.city) || "—"}</p>
          <p>${escapeHtml(s.shift_date) || "—"} · ${escapeHtml(s.start_time) || "—"} · ${escapeHtml(s.duration) || "—"}</p>
          <p style="color:#5DCAA5; font-weight:500;">${escapeHtml(s.total_pay) || "—"}</p>
        </div>
      </div>
    `).join("")}
  `;
}

// ── Load facility profile for editing ──
let facilityProfile = null;

async function loadFacilityProfile() {
  const { data, error } = await _supabase
    .from("facilities")
    .select("*")
    .eq("email", facilityEmail)
    .single();

  if (!error && data) {
    facilityProfile = data;
  }
}

// ── Facility settings modal ──
function openFacilitySettings() {
  if (!facilityProfile) { alert("Complete your profile first."); return; }
  document.getElementById("editFacilityName").value = facilityProfile.facility_name || "";
  document.getElementById("editFacilityType").value = facilityProfile.facility_type || "";
  document.getElementById("editFacilityCity").value = facilityProfile.city || "";
  document.getElementById("editContactName").value = facilityProfile.contact_name || "";
  document.getElementById("editContactRole").value = facilityProfile.contact_role || "";
  document.getElementById("editFacilityPhone").value = facilityProfile.phone || "";
  document.getElementById("editStaffNeeds").value = facilityProfile.staff_needs || "";
  document.getElementById("editFrequency").value = facilityProfile.frequency || "";
  document.getElementById("facilityModal").style.display = "flex";
}

function closeFacilitySettings() {
  document.getElementById("facilityModal").style.display = "none";
}

document.getElementById("facilityProfileForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const { data: result } = await ccFetch("/facility", {
      method: "PUT",
      body: JSON.stringify({
        facility_name: document.getElementById("editFacilityName").value.trim(),
        facility_type: document.getElementById("editFacilityType").value,
        city: document.getElementById("editFacilityCity").value,
        contact_name: document.getElementById("editContactName").value.trim(),
        contact_role: document.getElementById("editContactRole").value.trim(),
        phone: document.getElementById("editFacilityPhone").value.trim(),
        staff_needs: document.getElementById("editStaffNeeds").value,
        frequency: document.getElementById("editFrequency").value
      })
    });

    if (result.success) {
      alert("Profile updated!");
      closeFacilitySettings();
      await loadFacilityProfile();
    } else {
      alert(result.message || "Could not update profile.");
    }
  } catch (err) {
    console.error("Update error:", err);
    alert("Something went wrong.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save changes";
  }
});

// ── Delete facility account ──
async function confirmDeleteFacilityAccount() {
  if (!confirm("Permanently delete your facility account and all data? This cannot be undone.")) return;
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
      alert(result.message || "Could not delete account.");
    }
  } catch (err) {
    console.error("Delete error:", err);
    alert("Something went wrong.");
  }
}

// ── Logout ──
async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}

init();