const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

let facilityEmail = null;
let refreshTimer = null;
let html5QrCode = null;
let scannerActive = false;
let scanLocked = false;
let pendingScan = null;

async function init() {
  const { data: { session } } = await _supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

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
  subscribeToUpdates(facilityEmail);

  refreshTimer = setInterval(() => loadShifts(facilityEmail), 30000);
}

function subscribeToUpdates(email) {
  _supabase
    .channel("facility-shifts")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "shifts",
        filter: `contact_email=eq.${email}`
      },
      () => loadShifts(email)
    )
    .subscribe();
}

function formatTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-GH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatElapsed(isoString) {
  if (!isoString) return "—";
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1) return "Just checked in";
  if (mins < 60) return `${mins} min on site`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m on site`;
}

function parsePay(amount) {
  return parseFloat((amount || "0").toString().replace(/[^0-9.]/g, "")) || 0;
}

function workerInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

async function loadWorkerMap(workerIds) {
  const unique = [...new Set(workerIds.filter(Boolean))];
  if (!unique.length) return {};

  const { data } = await _supabase
    .from("workers")
    .select("id, full_name, role, phone, license_verified, identity_verified")
    .in("id", unique);

  return Object.fromEntries((data || []).map(w => [w.id, w]));
}

function workerBadges(worker) {
  if (!worker) return "";
  let html = "";
  if (worker.license_verified) {
    html += `<span class="badge badge-green">✓ License</span>`;
  }
  if (worker.identity_verified) {
    html += `<span class="badge badge-green">✓ Identity</span>`;
  }
  return html;
}

async function loadShifts(email) {
  const { data, error } = await _supabase
    .from("shifts")
    .select("*")
    .eq("contact_email", email)
    .order("created_at", { ascending: false });

  if (error || !data) return;

  const openShifts = data.filter(s => s.status === "open");
  const awaitingArrival = data.filter(s => s.status === "accepted");
  const liveOnSite = data.filter(s => s.status === "in_progress");
  const completedShifts = data.filter(s => s.status === "completed");

  const workerIds = [...awaitingArrival, ...liveOnSite, ...completedShifts]
    .map(s => s.worker_id);
  const workers = await loadWorkerMap(workerIds);

  document.getElementById("totalShifts").textContent = data.length;
  document.getElementById("openShifts").textContent = openShifts.length;
  document.getElementById("onSiteNow").textContent = liveOnSite.length;

  const totalSpend = completedShifts.reduce((sum, shift) => {
    return sum + parsePay(shift.total_pay);
  }, 0);
  document.getElementById("totalSpend").textContent =
    "GHS " + totalSpend.toLocaleString();

  document.getElementById("lastUpdated").textContent =
    "Updated " + new Date().toLocaleTimeString("en-GH", { timeStyle: "short" });

  renderLiveCheckins(liveOnSite, workers);
  renderAwaitingArrival(awaitingArrival, workers);
  renderOpenShifts(openShifts);
  renderCompletedShifts(completedShifts, workers);
}

function renderLiveCheckins(shifts, workers) {
  const container = document.getElementById("liveCheckinsContainer");

  if (!shifts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No workers checked in right now.</p>
        <p style="font-size:13px;">Workers appear here automatically when you scan their QR code on arrival.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = shifts.map(shift => {
    const worker = workers[shift.worker_id];
    return `
      <div class="checkin-card checkin-card-live">
        <div class="checkin-card-header">
          <div class="profile-avatar">${workerInitials(worker?.full_name)}</div>
          <div class="checkin-card-info">
            <h3>${escapeHtml(worker?.full_name || "Assigned worker")}</h3>
            <p>${escapeHtml(worker?.role || shift.role_needed)} · ${escapeHtml(shift.shift_date)} · ${escapeHtml(shift.start_time)}</p>
          </div>
          <div class="checkin-status">
            <span class="live-dot"></span>
            <span class="checkin-status-label">On site</span>
          </div>
        </div>
        <div class="checkin-meta">
          <div class="checkin-meta-item">
            <span>Checked in</span>
            <strong>${formatTime(shift.arrival_time)}</strong>
          </div>
          <div class="checkin-meta-item">
            <span>Duration</span>
            <strong data-arrival="${shift.arrival_time}" class="elapsed-time">${formatElapsed(shift.arrival_time)}</strong>
          </div>
          <div class="checkin-meta-item">
            <span>Shift pay</span>
            <strong>${escapeHtml(shift.total_pay || shift.pay_rate)}</strong>
          </div>
        </div>
        <div class="checkin-badges">${workerBadges(worker)}</div>
      </div>
    `;
  }).join("");
}

function renderAwaitingArrival(shifts, workers) {
  const container = document.getElementById("awaitingArrivalContainer");

  if (!shifts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No workers assigned yet.</p>
        <p style="font-size:13px;">Accepted shifts waiting for QR check-in will show here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = shifts.map(shift => {
    const worker = workers[shift.worker_id];
    return `
      <div class="checkin-card">
        <div class="checkin-card-header">
          <div class="profile-avatar">${workerInitials(worker?.full_name)}</div>
          <div class="checkin-card-info">
            <h3>${escapeHtml(worker?.full_name || "Assigned worker")}</h3>
            <p>${escapeHtml(worker?.role || shift.role_needed)} · ${escapeHtml(shift.shift_date)} · ${escapeHtml(shift.start_time)}</p>
          </div>
          <span class="badge badge-yellow">Awaiting QR scan</span>
        </div>
        <div class="checkin-meta">
          <div class="checkin-meta-item">
            <span>Expected start</span>
            <strong>${shift.start_time}</strong>
          </div>
          <div class="checkin-meta-item">
            <span>Duration</span>
            <strong>${shift.duration}</strong>
          </div>
          <div class="checkin-meta-item">
            <span>Contact</span>
            <strong>${worker?.phone || "—"}</strong>
          </div>
        </div>
        <div class="checkin-badges">${workerBadges(worker)}</div>
      </div>
    `;
  }).join("");
}

function renderOpenShifts(shifts) {
  const container = document.getElementById("openShiftsContainer");

  if (!shifts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No open shifts yet.</p>
        <a href="post-shift.html" class="btn-primary-sm">Post your first shift</a>
      </div>
    `;
    return;
  }

  container.innerHTML = shifts.map(shift => `
    <div class="profile-card" style="margin-bottom:12px;">
      <div class="profile-avatar" style="font-size:14px;">
        ${shift.role_needed ? shift.role_needed.substring(0, 2).toUpperCase() : "SH"}
      </div>
      <div class="profile-info" style="flex:1;">
        <h3>${shift.role_needed}</h3>
        <p>${shift.shift_date} · ${shift.start_time} · ${shift.duration}</p>
        <p style="color:#5DCAA5; font-weight:500;">${shift.pay_rate}</p>
        <div style="margin-top:8px;">
          <span class="badge badge-yellow">Awaiting match</span>
        </div>
      </div>
      <div>
        <button
          onclick="cancelShift('${shift.id}')"
          class="btn-cancel">
          Cancel
        </button>
      </div>
    </div>
  `).join("");
}

function renderCompletedShifts(shifts, workers) {
  const container = document.getElementById("completedShiftsContainer");

  if (!shifts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No completed shifts yet.</p>
        <p style="font-size:13px;">Finished shifts will appear here after workers check out.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = shifts.slice(0, 10).map(shift => {
    const worker = workers[shift.worker_id];
    return `
      <div class="checkin-card checkin-card-done">
        <div class="checkin-card-header">
          <div class="profile-avatar">${workerInitials(worker?.full_name)}</div>
          <div class="checkin-card-info">
            <h3>${worker?.full_name || "Worker"}</h3>
            <p>${shift.role_needed} · ${shift.shift_date}</p>
          </div>
          <span class="badge badge-green">✓ Completed</span>
        </div>
        <div class="checkin-meta">
          <div class="checkin-meta-item">
            <span>Arrived</span>
            <strong>${formatTime(shift.arrival_time)}</strong>
          </div>
          <div class="checkin-meta-item">
            <span>Completed</span>
            <strong>${formatTime(shift.completion_time)}</strong>
          </div>
          <div class="checkin-meta-item">
            <span>Paid</span>
            <strong>${shift.total_pay || "—"}</strong>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function updateElapsedTimes() {
  document.querySelectorAll(".elapsed-time").forEach(el => {
    const arrival = el.dataset.arrival;
    if (arrival) el.textContent = formatElapsed(arrival);
  });
}

async function cancelShift(shiftId) {
  if (!confirm("Are you sure you want to cancel this shift?")) return;

  const { error } = await _supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", shiftId);

  if (error) {
    alert("Could not cancel shift. Please try again.");
    return;
  }

  loadShifts(facilityEmail);
}

async function logout() {
  if (refreshTimer) clearInterval(refreshTimer);
  await closeScanner();
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}

// ── QR Scanner ──

function parseQrPayload(text) {
  try {
    const url = text.startsWith("http") ? new URL(text) : new URL(text, CC_CONFIG.ARRIVE_BASE_URL);
    const shiftId = url.searchParams.get("shift_id");
    const workerId = url.searchParams.get("worker_id");
    const token = url.searchParams.get("token");
    if (!shiftId || !workerId || !token) return null;
    return { shift_id: shiftId, worker_id: workerId, token };
  } catch {
    return null;
  }
}

async function openScanner() {
  if (scannerActive) return;

  document.getElementById("scannerPlaceholder").style.display = "none";
  document.getElementById("scannerWrap").style.display = "block";

  html5QrCode = new Html5Qrcode("qrReader");

  const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

  try {
    await html5QrCode.start(
      { facingMode: "environment" },
      scanConfig,
      onQrScanSuccess,
      () => {}
    );
    scannerActive = true;
  } catch (err) {
    try {
      await html5QrCode.start(
        { facingMode: "user" },
        scanConfig,
        onQrScanSuccess,
        () => {}
      );
      scannerActive = true;
    } catch (fallbackErr) {
      console.error("Scanner error:", fallbackErr);
      html5QrCode = null;
      document.getElementById("scannerPlaceholder").style.display = "block";
      document.getElementById("scannerWrap").style.display = "none";
      alert("Could not access camera. Please allow camera permission and try again.");
    }
  }
}

async function closeScanner() {
  if (html5QrCode && scannerActive) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (_) {}
    scannerActive = false;
    html5QrCode = null;
  }
  document.getElementById("scannerPlaceholder").style.display = "block";
  document.getElementById("scannerWrap").style.display = "none";
}

async function onQrScanSuccess(decodedText) {
  if (scanLocked) return;

  const payload = parseQrPayload(decodedText);
  if (!payload) return;

  scanLocked = true;
  if (html5QrCode && scannerActive) {
    try { await html5QrCode.pause(true); } catch (_) {}
  }

  await handleScannedQr(payload);
}

function showScanModalState(id) {
  document.querySelectorAll(".scan-modal-state").forEach(el => {
    el.style.display = "none";
  });
  document.getElementById("scanModal").style.display = "flex";
  document.getElementById(id).style.display = "block";
}

async function handleScannedQr(payload) {
  showScanModalState("scanModalLoading");
  pendingScan = payload;

  try {
    const [{ data: shift, error: shiftError }, { data: worker, error: workerError }] =
      await Promise.all([
        _supabase.from("shifts").select("*").eq("id", payload.shift_id).single(),
        _supabase.from("workers").select("*").eq("id", payload.worker_id).single()
      ]);

    if (shiftError || !shift) {
      showScanError("Shift not found.");
      return;
    }

    if (workerError || !worker) {
      showScanError("Worker not found.");
      return;
    }

    if (shift.contact_email !== facilityEmail) {
      showScanError("This QR code belongs to a shift at another facility.");
      return;
    }

    if (shift.worker_id !== payload.worker_id || shift.qr_token !== payload.token) {
      showScanError("Invalid or expired QR code.");
      return;
    }

    if (shift.status === "in_progress") {
      showScanSuccess({
        message: `${worker.full_name} is already checked in.`,
        worker: worker.full_name,
        arrival_time: shift.arrival_time
      });
      return;
    }

    if (shift.status === "completed") {
      showScanError("This shift has already been completed.");
      return;
    }

    if (shift.status !== "accepted") {
      showScanError(`This shift cannot be checked in (status: ${shift.status}).`);
      return;
    }

    document.getElementById("scanWorkerName").textContent = worker.full_name;
    document.getElementById("scanWorkerRole").textContent = worker.role;
    document.getElementById("scanShiftRole").textContent = shift.role_needed;
    document.getElementById("scanShiftDate").textContent = shift.shift_date;
    document.getElementById("scanShiftTime").textContent = shift.start_time;
    document.getElementById("scanWorkerBadges").innerHTML = workerBadges(worker);
    document.getElementById("scanConfirmBtn").disabled = false;
    document.getElementById("scanConfirmBtn").textContent = "Confirm arrival";

    showScanModalState("scanModalConfirm");
  } catch (err) {
    console.error("Scan handle error:", err);
    showScanError("Could not load shift details. Please try again.");
  }
}

function showScanError(message) {
  document.getElementById("scanErrorMsg").textContent = message;
  showScanModalState("scanModalError");
}

function showScanSuccess({ message, worker, arrival_time }) {
  document.getElementById("scanSuccessMsg").textContent = message;
  document.getElementById("scanSuccessWorker").textContent = worker;
  document.getElementById("scanSuccessTime").textContent = formatTime(arrival_time);
  showScanModalState("scanModalSuccess");
  loadShifts(facilityEmail);
}

async function confirmScannedArrival() {
  if (!pendingScan) return;

  const btn = document.getElementById("scanConfirmBtn");
  btn.disabled = true;
  btn.textContent = "Confirming...";

  try {
    const { data: result } = await ccFetch("/shift/arrive", {
      method: "POST",
      body: JSON.stringify({
        ...pendingScan,
        facility_email: facilityEmail
      })
    });

    if (!result.success) {
      showScanError(result.message || "Could not confirm arrival.");
      return;
    }

    showScanSuccess({
      message: result.message,
      worker: result.worker?.full_name || document.getElementById("scanWorkerName").textContent,
      arrival_time: result.arrival_time
    });
  } catch (err) {
    console.error("Arrive error:", err);
    showScanError("Network error. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm arrival";
  }
}

async function closeScanModal() {
  document.getElementById("scanModal").style.display = "none";
  pendingScan = null;
  scanLocked = false;

  if (scannerActive && html5QrCode) {
    try { await html5QrCode.resume(); } catch (_) {}
  }
}

setInterval(updateElapsedTimes, 60000);
init();
