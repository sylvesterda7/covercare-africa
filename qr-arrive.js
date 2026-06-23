const SUPABASE_URL = "https://ifmpbrpcnnswqlwdytfy.supabase.co";
const SUPABASE_KEY = "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB";
const BACKEND_URL = "https://covercare-backend-production.up.railway.app";
const API_KEY = "cc2025Kp9mN2vQ8xR4wL7jT1zA6bY3eH5dF";

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
    const [{ data: shift, error: shiftError }, { data: worker, error: workerError }] =
      await Promise.all([
        _supabase.from("shifts").select("*").eq("id", shiftId).single(),
        _supabase.from("workers").select("*").eq("id", workerId).single()
      ]);

    if (shiftError || !shift) {
      showError("Shift not found.");
      return;
    }

    if (workerError || !worker) {
      showError("Worker not found.");
      return;
    }

    if (shift.worker_id !== workerId || shift.qr_token !== token) {
      showError("This QR code is invalid or has expired.");
      return;
    }

    shiftData = shift;
    workerData = worker;

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

function showArriveConfirm() {
  document.getElementById("workerName").textContent = workerData.full_name;
  document.getElementById("workerRole").textContent = workerData.role;
  document.getElementById("facilityName").textContent = shiftData.facility_name;
  document.getElementById("shiftDate").textContent = shiftData.shift_date;
  document.getElementById("shiftTime").textContent = shiftData.start_time;
  document.getElementById("shiftRole").textContent = shiftData.role_needed;

  let badges = "";
  if (workerData.license_verified) {
    badges += `<span class="badge badge-green">✓ License verified</span>`;
  }
  if (workerData.identity_verified) {
    badges += `<span class="badge badge-green">✓ Identity verified</span>`;
  }
  document.getElementById("verifyBadges").innerHTML = badges;

  showState("arriveConfirm");
}

function showCompleteConfirm() {
  document.getElementById("completeWorkerName").textContent = workerData.full_name;
  document.getElementById("completeFacility").textContent =
    `${shiftData.facility_name} · ${shiftData.role_needed}`;
  document.getElementById("checkedInTime").textContent =
    formatTime(shiftData.arrival_time);
  document.getElementById("shiftPay").textContent =
    shiftData.total_pay || "—";

  showState("completeConfirm");
}

async function confirmArrival() {
  const btn = document.getElementById("confirmArriveBtn");
  btn.disabled = true;
  btn.textContent = "Confirming...";

  try {
    const response = await fetch(`${BACKEND_URL}/shift/arrive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({ shift_id: shiftId, worker_id: workerId, token })
    });

    const result = await response.json();

    if (!result.success) {
      showError(result.message || "Could not confirm arrival.");
      return;
    }

    document.getElementById("successWorkerName").textContent =
      result.worker?.full_name || workerData.full_name;
    document.getElementById("arrivalTime").textContent =
      formatTime(result.arrival_time);
    document.getElementById("arriveSuccessMsg").textContent = result.message;
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
    const response = await fetch(`${BACKEND_URL}/shift/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify({ shift_id: shiftId, worker_id: workerId, token })
    });

    const result = await response.json();

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
