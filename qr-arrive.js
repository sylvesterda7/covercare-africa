window._supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

const _supabase = window._supabase;
ccInitInactivityLogout(_supabase);
const params = new URLSearchParams(window.location.search);
const shiftId = params.get("shift_id");
const workerId = params.get("worker_id");
const token = params.get("token");

let shiftData = null;
let workerData = null;

function showState(id) {
  document.querySelectorAll(".arrive-state").forEach(el => {
    el.style.display = "none";
  });
  document.getElementById(id).style.display = "block";
}

function formatTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-GH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function showError(message) {
  document.getElementById("errorMessage").textContent = message;
  showState("arriveError");
}

async function init() {
  if (!shiftId || !workerId || !token) {
    showError("Missing check-in parameters. Please scan a valid QR code.");
    return;
  }

  try {
    // Safe check-in view from the backend (token-authorized). Avoids exposing
    // full worker PII and shift contact/payment fields via the public read policy.
    const { data: result } = await ccFetch(
      `/shift/checkin-info?shift_id=${encodeURIComponent(shiftId)}&worker_id=${encodeURIComponent(workerId)}&token=${encodeURIComponent(token)}`,
      { method: "GET" }
    );

    if (!result || !result.success) {
      showError(result?.message || "This QR code is invalid or has expired.");
      return;
    }

    shiftData = result.shift;
    workerData = result.worker || {};

    if (shift.status === "completed") {
      document.getElementById("alreadyCompletionTime").textContent =
        formatTime(shift.completion_time);
      showState("alreadyCompleted");
      return;
    }

    if (shift.status === "in_progress") {
      showCompleteConfirm();
      return;
    }

    if (shift.status === "accepted") {
      showArriveConfirm();
      return;
    }

    showError(`This shift cannot be checked in (status: ${shift.status}).`);
  } catch (err) {
    console.error("Init error:", err);
    showError("Could not load shift details. Please try again.");
  }
}

// ── Geo confirmation state ──
let _geoPosition = null;
let _geoError = null;

function setGeoStatus(text, tone) {
  const el = document.getElementById("geoStatus");
  if (!el) return;
  el.style.display = "block";
  el.textContent = text;
  el.style.color = tone === "ok" ? "#141414" : tone === "warn" ? "#b45309" : "var(--fg-muted)";
}

function requestGeoLocation() {
  if (!navigator.geolocation) {
    _geoError = "unsupported";
    setGeoStatus("Location not supported on this device — use manual override if check-in is blocked.", "warn");
    return;
  }
  setGeoStatus("Confirming you're at the facility…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      _geoPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      _geoError = null;
      setGeoStatus("Location acquired ✓", "ok");
    },
    (err) => {
      _geoError = err.code === 1 ? "denied" : "unavailable";
      setGeoStatus(
        _geoError === "denied"
          ? "Location access denied. Enable location services to check in, or use manual override."
          : "Could not determine your location. Try again, or use manual override.",
        "warn"
      );
      document.getElementById("geoOverrideBtn").style.display = "block";
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
}

function overrideGeoCheck() {
  const reason = prompt("Manual override is logged and reviewed. Why can't location be verified?");
  if (reason === null) return;
  if (!reason.trim()) {
    ccToast("A reason is required for manual override.", "error");
    return;
  }
  confirmArrival({ geo_override: true, geo_override_reason: reason.trim() });
}

function showArriveConfirm() {
  requestGeoLocation();
  document.getElementById("workerName").textContent = escapeHtml(workerData.full_name);
  document.getElementById("workerRole").textContent = escapeHtml(workerData.role);
  document.getElementById("facilityName").textContent = escapeHtml(shiftData.facility_name);
  document.getElementById("shiftDate").textContent = escapeHtml(shiftData.shift_date);
  document.getElementById("shiftTime").textContent = escapeHtml(shiftData.start_time);
  document.getElementById("shiftRole").textContent = escapeHtml(shiftData.role_needed);

  let badges = "";
  if (workerData.license_verified) {
    badges += `<span class="badge badge-accent">✓ License verified</span>`;
  }
  if (workerData.identity_verified) {
    badges += `<span class="badge badge-accent">✓ Identity verified</span>`;
  }
  document.getElementById("verifyBadges").innerHTML = badges;

  showState("arriveConfirm");
}

function showCompleteConfirm() {
  document.getElementById("completeWorkerName").textContent = escapeHtml(workerData.full_name);
  document.getElementById("completeFacility").textContent =
    `${escapeHtml(shiftData.facility_name)} · ${escapeHtml(shiftData.role_needed)}`;
  document.getElementById("checkedInTime").textContent =
    formatTime(shiftData.arrival_time);
  document.getElementById("shiftPay").textContent =
    escapeHtml(shiftData.total_pay) || "—";

  // Show late arrival info
  const lateMinutes = shiftData.late_minutes || 0;
  const lateInfoRow = document.getElementById("completeLateInfo");
  const makeUpRow = document.getElementById("makeUpOption");
  if (lateMinutes > 0) {
    document.getElementById("completeLateMinutes").textContent = `${lateMinutes} min late`;
    document.getElementById("completeOriginalPay").textContent = shiftData.total_pay || "—";
    document.getElementById("completeAdjustedPay").textContent = shiftData.adjusted_pay || shiftData.total_pay;
    lateInfoRow.style.display = "flex";
    makeUpRow.style.display = "flex";
    document.getElementById("makeUpCheckbox").checked = false;
    document.getElementById("makeUpMinutesNeeded").textContent = lateMinutes;
    document.getElementById("makeUpFullPay").textContent = shiftData.total_pay || "—";
    document.getElementById("completePayDisplay").textContent = shiftData.adjusted_pay || shiftData.total_pay;
  } else {
    lateInfoRow.style.display = "none";
    makeUpRow.style.display = "none";
    document.getElementById("completePayDisplay").textContent = shiftData.total_pay || "—";
  }

  showState("completeConfirm");
}

function toggleMakeUp(checked) {
  if (checked) {
    document.getElementById("completePayDisplay").textContent = shiftData.total_pay || "—";
    document.getElementById("makeUpHint").style.display = "block";
  } else {
    document.getElementById("completePayDisplay").textContent = shiftData.adjusted_pay || shiftData.total_pay;
    document.getElementById("makeUpHint").style.display = "none";
  }
}

async function confirmArrival(overrideOpts) {
  const btn = document.getElementById("confirmArriveBtn");
  btn.disabled = true;
  btn.textContent = "Confirming...";

  try {
    const body = { shift_id: shiftId, worker_id: workerId, token };
    if (_geoPosition) {
      body.checkin_latitude = _geoPosition.lat;
      body.checkin_longitude = _geoPosition.lng;
    }
    if (overrideOpts?.geo_override) {
      body.geo_override = true;
      body.geo_override_reason = overrideOpts.geo_override_reason;
    }

    const { data: result } = await ccFetch("/shift/arrive", {
      method: "POST",
      body: JSON.stringify(body)
    });

    if (!result.success) {
      // Geo failures keep the confirm screen up with an override path,
      // rather than dead-ending on the error state.
      if (result.geo_required || result.geo_blocked) {
        setGeoStatus(result.message, "warn");
        document.getElementById("geoOverrideBtn").style.display = "block";
        if (result.geo_required && !_geoPosition) requestGeoLocation();
        return;
      }
      showError(result.message || "Could not confirm arrival.");
      return;
    }

      shiftData = result.shift || { ...shiftData, late_minutes: result.late_minutes, adjusted_pay: result.adjusted_pay };

    document.getElementById("successWorkerName").textContent =
      result.worker?.full_name || workerData.full_name;
    document.getElementById("arrivalTime").textContent =
      formatTime(result.arrival_time);
    document.getElementById("arriveSuccessMsg").textContent = result.message;

    // Show late arrival details if applicable
    const lateInfo = document.getElementById("arriveLateInfo");
    const lateMinutes = result.late_minutes || 0;
    if (lateMinutes > 0) {
      document.getElementById("arriveLateMinutes").textContent = `${lateMinutes} min late`;
      document.getElementById("arriveAdjustedPay").textContent = result.adjusted_pay || shiftData.total_pay;
      lateInfo.style.display = "block";
    } else {
      lateInfo.style.display = "none";
    }

    showState("arriveSuccess");
  } catch (err) {
    console.error("Arrive error:", err);
    showError("Network error. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm arrival";
  }
}

async function confirmComplete() {
  const btn = document.getElementById("confirmCompleteBtn");
  btn.disabled = true;
  btn.textContent = "Processing...";

  try {
    const makeUpChecked = document.getElementById("makeUpCheckbox")?.checked || false;
    const { data: result } = await ccFetch("/shift/complete", {
      method: "POST",
      body: JSON.stringify({ shift_id: shiftId, worker_id: workerId, token, made_up: makeUpChecked })
    });

    if (!result.success) {
      showError(result.message || "Could not complete shift.");
      return;
    }

    document.getElementById("completionTime").textContent =
      formatTime(result.completion_time);
    document.getElementById("payoutAmount").textContent =
      result.payout
        ? `GHS ${result.payout.amount.toLocaleString()} sent via MoMo`
        : "Processing — support will follow up";
    document.getElementById("completeSuccessMsg").textContent = result.message;

    // Show adjusted pay details if late
    const compLateInfo = document.getElementById("completeSuccessLate");
    if (result.late_minutes > 0) {
      document.getElementById("compSuccessLateMins").textContent = `${result.late_minutes} min late`;
      document.getElementById("compSuccessFinalPay").textContent = result.adjusted_pay || "—";
      const payStatus = document.getElementById("compSuccessPayStatus");
      if (result.made_up) {
        payStatus.textContent = "Made up time — full pay retained";
        payStatus.className = "arrive-label";
      } else {
        payStatus.textContent = "Pay adjusted for late arrival";
        payStatus.className = "arrive-label arrive-label-warning";
      }
      compLateInfo.style.display = "block";
    } else {
      compLateInfo.style.display = "none";
    }

    showState("completeSuccess");
  } catch (err) {
    console.error("Complete error:", err);
    showError("Network error. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Complete shift & check out";
  }
}

init();
