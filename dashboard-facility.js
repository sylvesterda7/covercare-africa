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
  await loadRecommendedWorkers();
  await loadPayroll();
  await loadRatings();
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
        <button onclick="openFacilityRatingModal('${escapeHtml(s.id)}', '${escapeHtml(s.worker_id || "")}')" class="btn-primary-sm" style="font-size:12px; padding:7px 14px; flex-shrink:0;">Rate</button>
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

// ── Recommended workers ──
async function loadRecommendedWorkers() {
  const container = document.getElementById("recommendedContainer");
  if (!container) return;
  const { data: result } = await ccFetch("/matches/facility", { method: "GET" });
  const badge = document.getElementById("recommendedCount");
  if (!result?.data || result.data.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No recommendations yet.</p><p style="font-size:13px;">Recommendations will appear based on your open shifts.</p></div>';
    if (badge) badge.textContent = "0";
    return;
  }
  const totalMatches = result.data.reduce((sum, s) => sum + (s.workers ? s.workers.length : 0), 0);
  if (badge) badge.textContent = totalMatches;
  container.innerHTML = result.data.map(shift => {
    const workers = shift.workers || [];
    if (workers.length === 0) return "";
    return `
      <div style="margin-bottom:16px;">
        <p style="font-size:13px; color:rgba(255,255,255,0.4); margin-bottom:8px; padding-left:4px;">
          ${escapeHtml(shift.role_needed) || "Shift"} — ${escapeHtml(shift.shift_date) || ""}
        </p>
        ${workers.map(w => {
          const score = w.score || 0;
          const barColor = score >= 80 ? "#5DCAA5" : score >= 50 ? "#F0B429" : "#E24B4A";
          return `
            <div class="profile-card" style="flex-direction:column; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <div style="flex:1; height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
                  <div style="width:${score}%; height:100%; background:${barColor}; border-radius:3px; transition:width 0.4s ease;"></div>
                </div>
                <span style="font-size:11px; color:${barColor}; font-weight:500; min-width:32px; text-align:right;">${score}%</span>
              </div>
              <div style="display:flex; gap:12px; align-items:flex-start; width:100%;">
                <div class="profile-avatar" style="font-size:14px;">
                  ${w.full_name ? escapeHtml(w.full_name).split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2) : "?"}
                </div>
                <div class="profile-info" style="flex:1;">
                  <h3>${escapeHtml(w.full_name) || "Unknown"}</h3>
                  <p>${escapeHtml(w.role) || "—"} · ${escapeHtml(w.city) || "—"} · ${escapeHtml(w.experience) || "—"} exp</p>
                  ${w.breakdown ? `<p style="font-size:11px; color:rgba(255,255,255,0.25); margin-top:4px;">${escapeHtml(w.breakdown)}</p>` : ""}
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }).join("");
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
  html += `<div class="stat-box"><div class="num">GHS ${(d.total_spend || 0).toLocaleString()}</div><div class="label">Total spend</div></div>`;
  html += `<div class="stat-box"><div class="num">${d.paid_shifts || 0}</div><div class="label">Paid shifts</div></div>`;
  html += '</div>';
  html += '<div style="margin-top:8px;"><button onclick="toggleTransactions()" class="btn-sidebar" style="text-align:center; width:100%;" id="txToggle">View transactions</button></div>';
  html += '<div id="txContainer" style="display:none; margin-top:12px;"><div class="empty-state"><p>Loading...</p></div></div>';
  container.innerHTML = html;
}
async function toggleTransactions() {
  const container = document.getElementById("txContainer");
  const toggle = document.getElementById("txToggle");
  if (!container) return;
  if (container.style.display === "none") {
    container.style.display = "block";
    if (toggle) toggle.textContent = "Hide transactions";
    const { data: result } = await ccFetch("/payroll/transactions", { method: "GET" });
    if (!result?.data || result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No transactions yet.</p></div>';
      return;
    }
    container.innerHTML = result.data.map(s => `
      <div class="profile-card" style="margin-bottom:8px;">
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(s.role_needed) || "—"}</h3>
          <p>${escapeHtml(s.shift_date) || "—"} · ${escapeHtml(s.worker_name) || "—"}</p>
          <p style="color:#5DCAA5; font-weight:500;">${escapeHtml(s.total_pay) || "—"}</p>
          <div style="margin-top:4px;"><span class="badge ${s.paid ? 'badge-green' : 'badge-yellow'}">${s.paid ? "Paid" : "Pending"}</span></div>
        </div>
      </div>
    `).join("");
  } else {
    container.style.display = "none";
    if (toggle) toggle.textContent = "View transactions";
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
  container.innerHTML = result.data.map(r => `
    <div class="profile-card" style="margin-bottom:8px;">
      <div class="profile-info" style="flex:1;">
        <p style="color:#5DCAA5;">${"★".repeat(Math.round(r.rating || 0))}${"☆".repeat(5 - Math.round(r.rating || 0))} <span style="color:rgba(255,255,255,0.4);">${r.rating || 0}/5</span></p>
        ${r.review ? `<p style="font-size:13px; color:rgba(255,255,255,0.6); margin-top:4px;">"${escapeHtml(r.review)}"</p>` : ""}
        <p style="font-size:11px; color:rgba(255,255,255,0.2); margin-top:4px;">${r.rater_name ? escapeHtml(r.rater_name) : ""}${r.created_at ? " · " + new Date(r.created_at).toLocaleDateString() : ""}</p>
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
    list.innerHTML = '<div style="padding:16px; text-align:center; color:rgba(255,255,255,0.3); font-size:13px;">No notifications</div>';
    return;
  }
  list.innerHTML = data.data.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markRead('${escapeHtml(n.id)}')" data-id="${escapeHtml(n.id)}">
      <div style="color:rgba(255,255,255,0.8);">${escapeHtml(n.title)}</div>
      <div style="color:rgba(255,255,255,0.4); font-size:12px; margin-top:2px;">${escapeHtml(n.message)}</div>
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

// ── Facility rating modal ──
let facilityRatingShiftId = null;
let facilityRatingWorkerEmail = null;
let facilitySelectedRating = 0;

async function openFacilityRatingModal(shiftId, workerId) {
  if (!workerId) { alert("No worker assigned to this shift."); return; }
  const { data: worker } = await _supabase
    .from("workers")
    .select("full_name, email")
    .eq("id", workerId)
    .single();
  if (!worker) { alert("Worker not found."); return; }
  facilityRatingShiftId = shiftId;
  facilityRatingWorkerEmail = worker.email;
  facilitySelectedRating = 0;
  document.getElementById("ratingWorkerName").textContent = worker.full_name || "Worker";
  document.getElementById("facilityRatingReview").value = "";
  document.getElementById("submitFacilityRatingBtn").textContent = "Submit rating";
  document.getElementById("submitFacilityRatingBtn").disabled = false;
  for (let i = 1; i <= 5; i++) {
    document.getElementById("fStar" + i).style.color = "rgba(255,255,255,0.15)";
  }
  document.getElementById("ratingModal").style.display = "flex";
}

function closeFacilityRatingModal() {
  document.getElementById("ratingModal").style.display = "none";
}

function setFacilityRating(val) {
  facilitySelectedRating = val;
  for (let i = 1; i <= 5; i++) {
    document.getElementById("fStar" + i).style.color = i <= val ? "#F0B429" : "rgba(255,255,255,0.15)";
  }
}

async function submitFacilityRating() {
  if (facilitySelectedRating === 0) { alert("Please select a rating."); return; }
  const btn = document.getElementById("submitFacilityRatingBtn");
  btn.disabled = true;
  btn.textContent = "Submitting...";
  const review = document.getElementById("facilityRatingReview").value.trim();
  const { data: result } = await ccFetch("/ratings", {
    method: "POST",
    body: JSON.stringify({
      shift_id: facilityRatingShiftId,
      rating: facilitySelectedRating,
      review: review,
      target_email: facilityRatingWorkerEmail
    })
  });
  if (result?.success) {
    alert("Rating submitted!");
    closeFacilityRatingModal();
    loadCompletedShifts();
    loadRatings();
  } else {
    alert(result?.message || "Failed to submit rating.");
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
    alert("Support ticket sent! We'll respond within 24 hours.");
    closeSupportModal();
  } else {
    alert("Failed to send. Please try again.");
  }
  btn.disabled = false; btn.textContent = "Send";
});

init();