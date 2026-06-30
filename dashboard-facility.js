// ── Config & Supabase ──
window._supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

const _supabase = window._supabase;
ccInitInactivityLogout(_supabase);
let facilityEmail = null;

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

  // ── Stats (null-safe for elements that may not exist in HTML) ──
  const _s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  _s("totalShifts", data.length);
  _s("openShifts", openShifts.length);
  _s("onSiteNow", inProgress.length);
  _s("filledShifts", filledShifts.length);

  const totalSpend = filledShifts.reduce((sum, shift) => {
    return sum + (parseFloat((shift.total_pay || "0").replace(/[^0-9.]/g, "")) || 0);
  }, 0);
  _s("totalSpend", "GHS " + totalSpend.toLocaleString());

  // ── Open shifts ──
  const openContainer = document.getElementById("openShiftsContainer");
  if (openShifts.length > 0) {
    openContainer.innerHTML = openShifts.map(shift => `
      <div class="profile-card" style="margin-bottom:12px;">
        <div class="profile-avatar" style="background:rgba(17,24,39,0.1); font-size:14px;">
          ${shift.role_needed ? escapeHtml(shift.role_needed.substring(0, 2).toUpperCase()) : "SH"}
        </div>
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(shift.role_needed) || "—"}</h3>
          <p>${escapeHtml(shift.shift_date) || "—"} · ${escapeHtml(shift.start_time) || "—"} · ${escapeHtml(shift.duration) || "—"}</p>
          <p style="color:#111827; font-weight:500;">${escapeHtml(shift.pay_rate) || "—"}</p>
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
            <p style="color:#111827; font-weight:500;">${escapeHtml(workerMap[s.worker_id]?.full_name || "Worker")}</p>
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
            <p>${escapeHtml(s.shift_date) || "—"} · ${escapeHtml(s.start_time) || "—"} · ${escapeHtml(s.duration) || "—"}</p>
            <p style="font-size:12px;color:#6b7280;">Worker: ${s.worker_name || "Assigned"}</p>
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
    const workerIds = [...new Set(filledShifts.map(s => s.worker_id).filter(Boolean))];
    const { data: workers } = workerIds.length > 0 ? await _supabase.from("workers").select("id, full_name, role, phone, email, city, experience, bio, profile_photo_url, license_verified, identity_verified").in("id", workerIds) : { data: [] };
    const workerMap = Object.fromEntries((workers || []).map(w => [w.id, w]));

    filledContainer.innerHTML = filledShifts.map(shift => {
      const w = shift.worker_id ? workerMap[shift.worker_id] : null;
      const lateInfo = shift.late_minutes > 0 ? `
        <p style="font-size:12px;color:#b45309;margin-top:4px;">
          ⏰ ${shift.late_minutes} min late · Pay: ${escapeHtml(shift.adjusted_pay || shift.total_pay)}
          ${shift.made_up ? '· <span style="color:#059669;">Made up time</span>' : ''}
        </p>` : "";
      return `
      <div class="profile-card" style="margin-bottom:12px;">
        <div class="profile-avatar" style="${w?.profile_photo_url ? 'background:none;border:none;' : 'background:rgba(17,24,39,0.1);'} font-size:14px;">
          ${w?.profile_photo_url ? `<img src="${escapeHtml(w.profile_photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : (shift.role_needed ? escapeHtml(shift.role_needed.substring(0, 2).toUpperCase()) : "SH")}
        </div>
        <div class="profile-info" style="flex:1;">
          <h3>${w ? escapeHtml(w.full_name) : escapeHtml(shift.role_needed) || "—"}</h3>
          <p>${escapeHtml(shift.shift_date) || "—"} · ${escapeHtml(shift.start_time) || "—"} · ${escapeHtml(shift.duration) || "—"}</p>
          <p style="color:#111827; font-weight:500;">${escapeHtml(shift.total_pay) || "—"}</p>
          ${lateInfo}
          <div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <span class="badge badge-accent">
              ${shift.status === "in_progress" ? "⏱ In progress" : shift.status === "completed" ? "✓ Completed" : "✓ Filled"}
            </span>
            ${w ? `<button data-worker-id="${escapeHtml(w.id)}" onclick="showWorkerDetailsById(this.dataset.workerId)" style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--fg-muted);cursor:pointer;font-family:inherit;">View worker</button>` : ""}
          </div>
        </div>
      </div>`;
    }).join("");
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
        license_verified, identity_verified, profile_photo_url, bio
      )
    `)
    .in("shift_id", shiftIds)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (appError || !applications || applications.length === 0) {
    console.error("[applications] Error or empty result", { appError, applications, shiftIds });
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

    const avatarHtml = worker.profile_photo_url
      ? `<img src="${escapeHtml(worker.profile_photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
      : (worker.full_name
        ? worker.full_name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)
        : "?");

    return `
      <div class="profile-card" style="margin-bottom:12px;">
        <div class="profile-avatar" style="${worker.profile_photo_url ? 'background:none;border:none;' : ''}">${avatarHtml}</div>
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(worker.full_name) || "Unknown"}</h3>
          <p>${escapeHtml(worker.role) || "—"} · ${escapeHtml(worker.city) || "—"} · ${escapeHtml(worker.experience) || "—"} exp</p>
          ${worker.bio ? `<p style="font-size:13px; color:var(--fg-muted); margin-top:4px; line-height:1.5;">"${escapeHtml(worker.bio)}"</p>` : ""}
          <p style="font-size:12px; color:var(--fg-muted); margin-top:4px;">
            Applied for: ${escapeHtml(shift.role_needed) || "—"} · ${escapeHtml(shift.shift_date) || "—"}
          </p>
          <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
            ${worker.license_verified
              ? '<span class="badge badge-accent">✓ License</span>'
              : '<span class="badge badge-yellow">License pending</span>'
            }
            ${worker.identity_verified
              ? '<span class="badge badge-accent">✓ Identity</span>'
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
      ccToast("Worker accepted! Shift is now filled.", "success");
      if (result.worker) showWorkerDetails(result.worker);
      await loadShifts(facilityEmail);
      await loadApplications(facilityEmail);
    } else {
      ccToast(result.message || "Could not accept. Please try again.", "error");
    }
  } catch (err) {
    console.error("Accept error:", err);
    ccToast("Something went wrong. Please try again.", "error");
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
      ccToast(result.message || "Could not reject. Please try again.", "error");
    }
  } catch (err) {
    console.error("Reject error:", err);
    ccToast("Something went wrong. Please try again.", "error");
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
    ccToast("Could not cancel shift. Please try again.", "error");
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
    <p style="font-size:13px; color:var(--fg-muted); margin-bottom:12px;">
      ${result.data.length} shift${result.data.length > 1 ? "s" : ""} · Total spent: <strong style="color:#111827;">GHS ${totalSpent.toLocaleString()}</strong>
    </p>
    ${result.data.map(s => `
      <div class="profile-card" style="margin-bottom:10px;">
        <div class="profile-info" style="flex:1;">
          <h3>${escapeHtml(s.role_needed) || "—"}</h3>
          <p>${escapeHtml(s.facility_name) || "—"} · ${escapeHtml(s.city) || "—"}</p>
          <p>${escapeHtml(s.shift_date) || "—"} · ${escapeHtml(s.start_time) || "—"} · ${escapeHtml(s.duration) || "—"}</p>
          <p style="color:#111827; font-weight:500;">${escapeHtml(s.total_pay) || "—"}</p>
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
    renderDocumentStatus(data);
  }
}

// ── Facility document status ──
function renderDocumentStatus(profile) {
  const container = document.getElementById("documentsContainer");
  if (!container) return;

  const docs = [
    { key: "incorporation_doc_url", label: "Incorporation certificate (Registrar of Companies)" },
    { key: "hefra_license_url", label: "HEFRA license" },
    { key: "pharmacy_council_url", label: "Pharmacy Council permit" },
  ];

  container.innerHTML = docs.map(d => {
    const hasDoc = !!profile[d.key];
    return `
      <div class="profile-card" style="margin-bottom:8px; align-items:center;">
        <div class="profile-info" style="flex:1;">
          <p style="font-size:13px; color:var(--fg-muted);">${d.label}</p>
          <p style="font-size:12px; color:${hasDoc ? '#111827' : 'var(--fg-muted)'};">
            ${hasDoc ? '✓ Uploaded' : 'Not uploaded'}
          </p>
        </div>
        ${hasDoc ? `<a href="${escapeHtml(profile[d.key])}" target="_blank" class="btn-primary-sm" style="font-size:11px; padding:6px 12px; text-decoration:none;">View</a>` : ""}
      </div>
    `;
  }).join("");
}

async function uploadFacilityDoc(fileInputId, targetField) {
  const fileInput = document.getElementById(fileInputId);
  const file = fileInput.files[0];
  if (!file) return;

  const statusEl = document.getElementById(fileInputId + "-status");
  statusEl.textContent = "Uploading...";

  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64 = e.target.result;
    const { data: uploadResult } = await ccFetch("/api/upload", {
      method: "POST",
      body: JSON.stringify({ image: base64, folder: "facility-docs" })
    });

    if (uploadResult?.success) {
      facilityProfile[targetField] = uploadResult.url;
      statusEl.textContent = "✓ Uploaded";
      statusEl.style.color = "#111827";
      const { data: saveResult } = await ccFetch("/facility", {
        method: "PUT",
        body: JSON.stringify({ [targetField]: uploadResult.url })
      });
      if (saveResult?.success) {
        renderDocumentStatus(facilityProfile);
      }
    } else {
      statusEl.textContent = "Upload failed. Try again.";
      statusEl.style.color = "#E24B4A";
    }
  };
  reader.readAsDataURL(file);
}

// ── Facility settings modal ──
function openFacilitySettings() {
  if (!facilityProfile) { ccToast("Complete your profile first.", "error"); return; }
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
      ccToast("Profile updated!", "success");
      closeFacilitySettings();
      await loadFacilityProfile();
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

// ── Recommended workers ──
async function loadRecommendedWorkers() {
  const container = document.getElementById("recommendedContainer");
  if (!container) return;
  const { data: result } = await ccFetch("/matches/facility", { method: "GET" });
  const badge = document.getElementById("recommendedCount");
  const matches = result?.matches;
  if (!matches || Object.keys(matches).length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No recommendations yet.</p><p style="font-size:13px;">Recommendations will appear based on your open shifts.</p></div>';
    if (badge) badge.textContent = "0";
    return;
  }
  const allWorkers = Object.values(matches).flat();
  const totalMatches = allWorkers.length;
  if (badge) badge.textContent = totalMatches;
  container.innerHTML = Object.entries(matches).map(([shiftId, workers]) => {
    if (!workers || workers.length === 0) return "";
    const shiftRole = workers[0]?.role_needed || "";
    const shiftDate = workers[0]?.shift_date || "";
    return `
      <div style="margin-bottom:16px;">
        <p style="font-size:13px; color:var(--fg-muted); margin-bottom:8px; padding-left:4px;">
          ${escapeHtml(shiftRole) || "Shift"} — ${escapeHtml(shiftDate) || ""}
        </p>
        ${workers.map(w => {
          const score = w.score || 0;
          const barColor = score >= 80 ? "#111827" : score >= 50 ? "#F0B429" : "#E24B4A";
          const worker = w.worker || w;
          return `
            <div class="profile-card" style="flex-direction:column; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <div style="flex:1; height:6px; background:var(--bg-elevated); border-radius:3px; overflow:hidden;">
                  <div style="width:${score}%; height:100%; background:${barColor}; border-radius:3px; transition:width 0.4s ease;"></div>
                </div>
                <span style="font-size:11px; color:${barColor}; font-weight:500; min-width:32px; text-align:right;">${score}%</span>
              </div>
              <div style="display:flex; gap:12px; align-items:flex-start; width:100%;">
                <div class="profile-avatar" style="font-size:14px;">
                  ${worker.full_name ? escapeHtml(worker.full_name).split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2) : "?"}
                </div>
                <div class="profile-info" style="flex:1;">
                  <h3>${escapeHtml(worker.full_name) || "Unknown"}</h3>
                  <p>${escapeHtml(worker.role) || "—"} · ${escapeHtml(worker.city) || "—"} · ${escapeHtml(worker.experience) || "—"} exp</p>
                  ${w.breakdown ? `<p style="font-size:11px; color:var(--fg-muted); margin-top:4px;">${escapeHtml(w.breakdown)}</p>` : ""}
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }).join("");
}

// ── Worker details modal ──
function showWorkerDetails(worker) {
  const container = document.getElementById("workerDetailsContent");
  if (!container || !worker) return;
  const avatarHtml = worker.profile_photo_url
    ? `<img src="${escapeHtml(worker.profile_photo_url)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:50%;margin:0 auto 12px;display:block;" />`
    : `<div style="width:72px;height:72px;border-radius:50%;background:rgba(17,24,39,0.1);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;margin:0 auto 12px;">${worker.full_name ? escapeHtml(worker.full_name).split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2) : "?"}</div>`;
  container.innerHTML = `
    ${avatarHtml}
    <h3 style="text-align:center;margin-bottom:4px;">${escapeHtml(worker.full_name) || "Unknown"}</h3>
    <p style="text-align:center;color:var(--fg-muted);font-size:13px;margin-bottom:16px;">${escapeHtml(worker.role) || "—"}</p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${worker.phone ? `<div><span style="font-size:12px;color:var(--fg-muted);display:block;">Phone</span><span style="font-size:14px;color:#111827;">${escapeHtml(worker.phone)}</span></div>` : ""}
      ${worker.email ? `<div><span style="font-size:12px;color:var(--fg-muted);display:block;">Email</span><span style="font-size:14px;color:#111827;">${escapeHtml(worker.email)}</span></div>` : ""}
      ${worker.city ? `<div><span style="font-size:12px;color:var(--fg-muted);display:block;">City</span><span style="font-size:14px;color:#111827;">${escapeHtml(worker.city)}</span></div>` : ""}
      ${worker.experience ? `<div><span style="font-size:12px;color:var(--fg-muted);display:block;">Experience</span><span style="font-size:14px;color:#111827;">${escapeHtml(worker.experience)}</span></div>` : ""}
      ${worker.bio ? `<div><span style="font-size:12px;color:var(--fg-muted);display:block;">About</span><span style="font-size:14px;color:#111827;line-height:1.5;">${escapeHtml(worker.bio)}</span></div>` : ""}
    </div>
    <div style="display:flex;gap:6px;justify-content:center;margin-top:14px;flex-wrap:wrap;">
      ${worker.license_verified ? '<span class="badge badge-accent">✓ License verified</span>' : '<span class="badge badge-yellow">License pending</span>'}
      ${worker.identity_verified ? '<span class="badge badge-accent">✓ Identity verified</span>' : '<span class="badge badge-yellow">Identity pending</span>'}
    </div>
    <button onclick="closeWorkerDetails()" class="btn-auth" style="margin-top:20px;width:100%;">Close</button>
  `;
  document.getElementById("workerDetailsModal").style.display = "flex";
}

async function showWorkerDetailsById(workerId) {
  if (!workerId) return;
  const { data, error } = await _supabase
    .from("workers")
    .select("id, full_name, role, phone, email, city, experience, bio, profile_photo_url, license_verified, identity_verified")
    .eq("id", workerId)
    .single();
  if (error || !data) { ccToast("Could not load worker details.", "error"); return; }
  showWorkerDetails(data);
}

function closeWorkerDetails() {
  document.getElementById("workerDetailsModal").style.display = "none";
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
          <p style="color:#111827; font-weight:500;">${escapeHtml(s.total_pay) || "—"}</p>
          <div style="margin-top:4px;"><span class="badge ${s.paid ? 'badge-accent' : 'badge-yellow'}">${s.paid ? "Paid" : "Pending"}</span></div>
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

// ── Facility rating modal ──
let facilityRatingShiftId = null;
let facilityRatingWorkerEmail = null;
let facilitySelectedRating = 0;

async function openFacilityRatingModal(shiftId, workerId) {
  if (!workerId) { ccToast("No worker assigned to this shift.", "error"); return; }
  const { data: worker } = await _supabase
    .from("workers")
    .select("full_name, email")
    .eq("id", workerId)
    .single();
  if (!worker) { ccToast("Worker not found.", "error"); return; }
  facilityRatingShiftId = shiftId;
  facilityRatingWorkerEmail = worker.email;
  facilitySelectedRating = 0;
  document.getElementById("ratingWorkerName").textContent = worker.full_name || "Worker";
  document.getElementById("facilityRatingReview").value = "";
  document.getElementById("submitFacilityRatingBtn").textContent = "Submit rating";
  document.getElementById("submitFacilityRatingBtn").disabled = false;
  for (let i = 1; i <= 5; i++) {
    document.getElementById("fStar" + i).style.color = "var(--border)";
  }
  document.getElementById("ratingModal").style.display = "flex";
}

function closeFacilityRatingModal() {
  document.getElementById("ratingModal").style.display = "none";
}

function setFacilityRating(val) {
  facilitySelectedRating = val;
  for (let i = 1; i <= 5; i++) {
    document.getElementById("fStar" + i).style.color = i <= val ? "#F0B429" : "var(--border)";
  }
}

async function submitFacilityRating() {
  if (facilitySelectedRating === 0) { ccToast("Please select a rating.", "error"); return; }
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
    ccToast("Rating submitted!", "success");
    closeFacilityRatingModal();
    loadCompletedShifts();
    loadRatings();
  } else {
    ccToast(result?.message || "Failed to submit rating.", "error");
    btn.disabled = false;
    btn.textContent = "Submit rating";
  }
}

// ── QR Scanner ──
let _scannerInstance = null;

function openScanner() {
  document.getElementById("scannerPlaceholder").style.display = "none";
  document.getElementById("scannerWrap").style.display = "block";

  if (typeof Html5Qrcode === "undefined") {
    ccToast("QR scanner library not loaded. Check your internet connection.", "error");
    return;
  }

  _scannerInstance = new Html5Qrcode("qrReader");
  _scannerInstance.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onScanSuccess,
    () => {}
  ).catch(() => {
    ccToast("Could not access camera. Please allow camera permission.", "error");
    closeScanner();
  });
}

function closeScanner() {
  if (_scannerInstance) {
    try { _scannerInstance.stop(); } catch (e) {}
    _scannerInstance = null;
  }
  document.getElementById("scannerWrap").style.display = "none";
  document.getElementById("scannerPlaceholder").style.display = "block";
}

function onScanSuccess(decodedText) {
  if (_scannerInstance) {
    try { _scannerInstance.pause(); } catch (e) {}
  }

  let params;
  try {
    const url = new URL(decodedText);
    params = Object.fromEntries(url.searchParams.entries());
  } catch {
    try {
      params = Object.fromEntries(new URLSearchParams(decodedText.split("?").pop() || decodedText));
    } catch {
      showScanError("Could not parse QR code. Please scan a valid check-in QR.");
      if (_scannerInstance) try { _scannerInstance.resume(); } catch (e) {}
      return;
    }
  }

  const { shift_id, worker_id, token } = params;
  if (!shift_id || !worker_id || !token) {
    showScanError("Invalid QR code. Missing check-in data.");
    if (_scannerInstance) try { _scannerInstance.resume(); } catch (e) {}
    return;
  }

  showScanLoading();
  ccFetch(`/qr/validate?shift_id=${encodeURIComponent(shift_id)}&worker_id=${encodeURIComponent(worker_id)}&token=${encodeURIComponent(token)}`, { method: "GET" })
    .then(({ data }) => {
      if (data?.success) {
        showScanConfirm(shift_id, worker_id, token, data.worker, data.shift);
      } else {
        showScanError(data?.message || "Invalid QR code.");
        if (_scannerInstance) try { _scannerInstance.resume(); } catch (e) {}
      }
    })
    .catch(() => {
      showScanError("Network error. Please try again.");
      if (_scannerInstance) try { _scannerInstance.resume(); } catch (e) {}
    });
}

function showScanLoading() {
  document.querySelectorAll(".scan-modal-state").forEach(el => el.style.display = "none");
  document.getElementById("scanModalLoading").style.display = "block";
  document.getElementById("scanModal").style.display = "flex";
}

function showScanConfirm(shiftId, workerId, token, worker, shift) {
  document.querySelectorAll(".scan-modal-state").forEach(el => el.style.display = "none");
  document.getElementById("scanModalConfirm").style.display = "block";

  document.getElementById("scanWorkerName").textContent = worker?.full_name || "Unknown";
  document.getElementById("scanWorkerRole").textContent = worker?.role || "—";
  document.getElementById("scanShiftRole").textContent = shift?.role_needed || "—";
  document.getElementById("scanShiftDate").textContent = shift?.shift_date || "—";
  document.getElementById("scanShiftTime").textContent = shift?.start_time || "—";

  const badges = document.getElementById("scanWorkerBadges");
  badges.innerHTML = "";
  if (worker?.license_verified) badges.innerHTML += '<span class="badge badge-accent" style="margin-right:6px;">✓ License</span>';
  else badges.innerHTML += '<span class="badge badge-yellow" style="margin-right:6px;">License pending</span>';
  if (worker?.identity_verified) badges.innerHTML += '<span class="badge badge-accent">✓ Identity</span>';
  else badges.innerHTML += '<span class="badge badge-yellow">Identity pending</span>';

  document.getElementById("scanConfirmBtn").dataset.shiftId = shiftId;
  document.getElementById("scanConfirmBtn").dataset.workerId = workerId;
  document.getElementById("scanConfirmBtn").dataset.token = token;
}

function showScanError(msg) {
  document.querySelectorAll(".scan-modal-state").forEach(el => el.style.display = "none");
  document.getElementById("scanModalError").style.display = "block";
  document.getElementById("scanErrorMsg").textContent = msg;
}

function closeScanModal() {
  document.getElementById("scanModal").style.display = "none";
  if (_scannerInstance) try { _scannerInstance.resume(); } catch (e) {}
}

async function confirmScannedArrival() {
  const btn = document.getElementById("scanConfirmBtn");
  const shiftId = btn.dataset.shiftId;
  const workerId = btn.dataset.workerId;
  const token = btn.dataset.token;

  if (!shiftId || !workerId || !token) return;
  btn.disabled = true;
  btn.textContent = "Confirming...";

  try {
    const { data } = await ccFetch("/shift/arrive", {
      method: "POST",
      body: JSON.stringify({ shift_id: shiftId, worker_id: workerId, token, facility_email: facilityEmail })
    });

    if (data?.success) {
      document.querySelectorAll(".scan-modal-state").forEach(el => el.style.display = "none");
      document.getElementById("scanModalSuccess").style.display = "block";
      document.getElementById("scanSuccessMsg").textContent = data.already_arrived ? "Worker was already checked in." : "Arrival confirmed. Shift is now in progress.";
      document.getElementById("scanSuccessWorker").textContent = document.getElementById("scanWorkerName").textContent;
      document.getElementById("scanSuccessTime").textContent = new Date().toLocaleTimeString();
      document.getElementById("scanConfirmBtn").disabled = false;
      document.getElementById("scanConfirmBtn").textContent = "Confirm arrival";
      closeScanner();
      await loadShifts(facilityEmail);
    } else {
      ccToast(data?.message || "Could not confirm arrival.", "error");
      document.getElementById("scanConfirmBtn").disabled = false;
      document.getElementById("scanConfirmBtn").textContent = "Confirm arrival";
    }
  } catch (err) {
    console.error("Arrival confirm error:", err);
    ccToast("Something went wrong. Please try again.", "error");
    document.getElementById("scanConfirmBtn").disabled = false;
    document.getElementById("scanConfirmBtn").textContent = "Confirm arrival";
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