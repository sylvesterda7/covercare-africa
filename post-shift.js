// ── Step navigation ──
function goToStep(step) {
  if (step === 2 && !validateStep1()) return;
  if (step === 3 && !validateStep2()) return;

  document.querySelectorAll(".form-step").forEach(s => s.classList.add("hidden"));
  document.getElementById("step" + step).classList.remove("hidden");

  document.querySelectorAll(".progress-step").forEach((dot, i) => {
    dot.classList.remove("active", "done");
    if (i + 1 < step) dot.classList.add("done");
    if (i + 1 === step) dot.classList.add("active");
  });

  document.querySelectorAll(".progress-line").forEach((line, i) => {
    line.classList.remove("done");
    if (i + 1 < step) line.classList.add("done");
  });

  if (step === 3) showSummary();
  document.querySelector(".progress-wrap").scrollIntoView({ behavior: "smooth" });
}

// ── Populate cities for a given country code, keeping the placeholder option ──
function populateCitiesForCountry(countryCode) {
  const citySel = document.getElementById("city");
  const country = AFRICAN_COUNTRIES.find(c => c.code === countryCode);
  citySel.innerHTML = '<option value="" disabled selected>Select city</option>';
  if (country) {
    country.cities.forEach(city => {
      const opt = document.createElement("option");
      opt.value = city.value;
      opt.textContent = city.label;
      citySel.appendChild(opt);
    });
  }
}

// ── Validate step 1 ──
function validateStep1() {
  const fields = ["country", "facilityName", "facilityType", "city", "contactName", "contactEmail", "contactPhone"];
  for (let field of fields) {
    if (!document.getElementById(field).value.trim()) {
      ccToast("Please fill in all fields before continuing.", "error");
      return false;
    }
  }
  return true;
}

// ── Validate step 2 ──
function validateStep2() {
  const fields = ["role", "shiftDate", "startTime", "durationHours", "daysNeeded", "workersNeeded"];
  for (let field of fields) {
    if (!document.getElementById(field).value) {
      ccToast("Please fill in all shift details before continuing.", "error");
      return false;
    }
  }

  const durationHours = parseInt(document.getElementById("durationHours").value, 10);
  const daysNeeded = parseInt(document.getElementById("daysNeeded").value, 10);
  const workersNeeded = parseInt(document.getElementById("workersNeeded").value, 10);

  if (Number.isNaN(durationHours) || durationHours < 4) {
    ccToast("Minimum shift duration is 4 hours. This protects our professionals and ensures quality care.", "error");
    return false;
  }
  if (Number.isNaN(daysNeeded) || daysNeeded < 1) {
    ccToast("Please choose at least 1 day.", "error");
    return false;
  }
  if (Number.isNaN(workersNeeded) || workersNeeded < 1) {
    ccToast("Please choose at least 1 professional.", "error");
    return false;
  }
  if (workersNeeded > 20) {
    ccToast("Maximum 20 professionals per shift. For larger needs, post multiple shifts or contact support.", "error");
    return false;
  }

  const payRateInput = document.getElementById("payRate");
  if (!payRateInput.value) {
    const roleVal = document.getElementById("role").value;
    if (suggestedRates[roleVal]) {
      payRateInput.value = suggestedRates[roleVal];
    } else {
      ccToast("Please enter a pay rate.", "error");
      return false;
    }
  }
  return true;
}

// ── Suggested rates ──
let suggestedRates = {};

async function fetchSuggestedRates() {
  const { data } = await ccFetch("/roles/rates", { method: "GET" });
  if (data?.success && data.data) {
    suggestedRates = data.data;
  }
}

// ── Lock a text/tel input to a value from the caller's account profile ──
function lockInput(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value || "";
  el.readOnly = true;
  el.style.opacity = "0.7";
  el.style.cursor = "not-allowed";
  el.title = "Uses your account profile";
}

// ── Lock a <select> to a value from the account profile, adding the option if the
//    hardcoded list doesn't already contain it (so the field never locks in blank) ──
function lockSelect(id, value) {
  const el = document.getElementById(id);
  if (!el || !value) return;
  let match = Array.from(el.options).find(o => o.value === value);
  if (!match) {
    match = document.createElement("option");
    match.value = value;
    match.textContent = value;
    el.appendChild(match);
  }
  el.value = value;
  el.disabled = true;
  el.style.opacity = "0.7";
  el.style.cursor = "not-allowed";
  el.title = "Uses your account profile";
}

document.addEventListener("DOMContentLoaded", async function() {
  window._supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
  const { data: { session } } = await window._supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  lockInput("contactEmail", session.user.email);
  document.getElementById("contactEmail").title = "Uses your account email";

  // ── Populate country dropdown, cascading the city list on change ──
  const countrySel = document.getElementById("country");
  AFRICAN_COUNTRIES.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.code;
    opt.textContent = c.name;
    countrySel.appendChild(opt);
  });
  countrySel.addEventListener("change", function() {
    populateCitiesForCountry(this.value);
  });

  fetchSuggestedRates();

  // ── Load facility branches ──
  (async () => {
    try {
      const { data: branchesData } = await ccFetch("/facility/branches", { method: "GET" });
      if (branchesData?.success && branchesData.data?.length > 0) {
        const group = document.getElementById("branchGroup");
        const sel = document.getElementById("branch");
        if (group) group.style.display = "block";
        if (sel) {
          sel.innerHTML = '<option value="">Main location</option>' +
            branchesData.data.map(b => `<option value="${b.id}">${escapeHtml(b.name)} (${escapeHtml(b.city)})</option>`).join("");
        }
      }
    } catch (_) {}
  })();

  // ── Lock identity fields to the logged-in facility or individual client profile ──
  (async () => {
    try {
      const { data: facility } = await window._supabase
        .from("facilities")
        .select("facility_name, facility_type, city, country, contact_name, phone")
        .eq("email", session.user.email)
        .maybeSingle();

      if (facility) {
        lockInput("facilityName", facility.facility_name);
        lockSelect("facilityType", facility.facility_type);
        if (facility.country) populateCitiesForCountry(facility.country);
        lockSelect("country", facility.country);
        lockSelect("city", facility.city);
        lockInput("contactName", facility.contact_name);
        lockInput("contactPhone", facility.phone);
        return;
      }

      // Not a facility account — check for an individual client profile
      const { data: client } = await window._supabase
        .from("clients")
        .select("full_name, city, country, phone")
        .eq("email", session.user.email)
        .maybeSingle();

      if (client) {
        lockInput("facilityName", client.full_name);
        if (client.country) populateCitiesForCountry(client.country);
        lockSelect("country", client.country);
        lockSelect("city", client.city);
        lockSelect("facilityType", "individual");
        lockInput("contactName", client.full_name);
        lockInput("contactPhone", client.phone);
      }
    } catch (_) {}
  })();

  // ── Check if facility is trusted (postpaid billing) — isolated so a schema
  //    mismatch here can't take down the identity-lock logic above ──
  (async () => {
    try {
      const { data: fac } = await window._supabase
        .from("facilities")
        .select("billing_model, trusted_by")
        .eq("email", session.user.email)
        .maybeSingle();
      window._canPostpaid = fac?.billing_model === "postpaid" && !!fac?.trusted_by;
      if (window._canPostpaid) {
        const el = document.getElementById("paymentMethodToggle");
        if (el) el.style.display = "block";
      }
    } catch (_) {}
  })();

  const roleEl = document.getElementById("role");
  const payRateEl = document.getElementById("payRate");
  const rateHintEl = document.getElementById("rateHint");
  const durationHoursEl = document.getElementById("durationHours");

  // ── Duration preset buttons ──
  document.querySelectorAll("#durationPresets .duration-preset").forEach(btn => {
    btn.addEventListener("click", function() {
      document.querySelectorAll("#durationPresets .duration-preset").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      if (this.dataset.hours === "custom") {
        durationHoursEl.style.display = "block";
        durationHoursEl.focus();
      } else {
        durationHoursEl.style.display = "none";
        durationHoursEl.value = this.dataset.hours;
        durationHoursEl.dispatchEvent(new Event("input"));
      }
    });
  });
  const daysNeededEl = document.getElementById("daysNeeded");
  const workersNeededEl = document.getElementById("workersNeeded");

  roleEl.addEventListener("change", function() {
    const val = this.value;
    if (val && suggestedRates[val]) {
      const suggested = suggestedRates[val];
      payRateEl.placeholder = `Suggested: GHS ${suggested}/hr`;
      rateHintEl.textContent = `Suggested: GHS ${suggested}/hr`;
      rateHintEl.style.display = "block";
    } else {
      payRateEl.placeholder = "e.g. 80";
      rateHintEl.style.display = "none";
    }
  });

  function updateEstimate() {
    const rate = parseFloat(payRateEl.value) || 0;
    const hours = parseFloat(durationHoursEl.value) || 0;
    const days = parseFloat(daysNeededEl.value) || 0;
    const workers = parseFloat(workersNeededEl.value) || 0;
    const total = rate * hours * days * workers;
    const facilityTotal = total * 1.25;

    const totalPayEl = document.getElementById("totalPay");
    if (totalPayEl) totalPayEl.textContent = "GHS " + total.toLocaleString();

    const estimateEl = document.getElementById("payEstimate");
    if (estimateEl && total > 0) {
      estimateEl.innerHTML =
        "Total worker pay: <strong>GHS " + total.toLocaleString() + "</strong>" +
        " &nbsp;·&nbsp; You pay: <strong>GHS " + facilityTotal.toLocaleString() + "</strong>" +
        " <span style='font-size:12px; opacity:0.6;'>(includes CoverCare fee)</span>";
    }
  }

  payRateEl.addEventListener("input", updateEstimate);
  durationHoursEl.addEventListener("input", updateEstimate);
  daysNeededEl.addEventListener("input", updateEstimate);
  workersNeededEl.addEventListener("input", updateEstimate);

  // ── Auto-calculated end date for multi-day shifts ──
  const shiftDateEl = document.getElementById("shiftDate");
  function updateEndDate() {
    const hint = document.getElementById("endDateHint");
    if (!hint) return;
    const start = shiftDateEl.value;
    const days = parseInt(daysNeededEl.value, 10) || 1;
    if (start && days > 1) {
      const d = new Date(start + "T00:00:00");
      d.setDate(d.getDate() + days - 1);
      hint.textContent = `Runs ${start} → ${d.toISOString().slice(0, 10)} (${days} days)`;
      hint.style.display = "block";
    } else {
      hint.style.display = "none";
    }
  }
  shiftDateEl.addEventListener("input", updateEndDate);
  daysNeededEl.addEventListener("input", updateEndDate);
});

// ── Show shift summary on step 3 ──
function showSummary() {
  const role = document.getElementById("role").value;
  const date = document.getElementById("shiftDate").value;
  const time = document.getElementById("startTime").value;
  const durationHours = document.getElementById("durationHours").value;
  const daysNeeded = document.getElementById("daysNeeded").value;
  const workersNeeded = document.getElementById("workersNeeded").value;
  const pay = document.getElementById("payRate").value;
  const city = document.getElementById("city").value;
  const facility = document.getElementById("facilityName").value;
  const total = parseFloat(pay) * parseFloat(durationHours) * parseFloat(daysNeeded) * parseFloat(workersNeeded);
  const facilityTotal = total * 1.25;

  document.getElementById("shiftSummary").innerHTML =
    "<strong>Facility:</strong> " + facility + "<br>" +
    "<strong>City:</strong> " + city + "<br>" +
    "<strong>Role needed:</strong> " + role + "<br>" +
    "<strong>Date:</strong> " + ccShiftDateRange(date, daysNeeded) + "<br>" +
    "<strong>Start time:</strong> " + time + "<br>" +
    "<strong>Hours per day:</strong> " + durationHours + " hours<br>" +
    "<strong>Days needed:</strong> " + daysNeeded + "<br>" +
    "<strong>Professionals needed:</strong> " + workersNeeded + "<br>" +
    "<strong>Worker pay rate:</strong> GHS " + pay + "/hr<br>" +
    "<strong>Total worker pay:</strong> GHS " + total.toLocaleString() + "<br>" +
    "<strong>You pay (incl. CoverCare fee):</strong> GHS " + facilityTotal.toLocaleString();
}

// ── Form submission with Paystack payment ──
document.getElementById("shiftForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  var payRateInput = document.getElementById("payRate");
  var payRateVal = payRateInput.value;
  if (!payRateVal || payRateVal.trim() === "") {
    var roleVal = document.getElementById("role").value;
    if (suggestedRates[roleVal]) {
      payRateVal = suggestedRates[roleVal];
      payRateInput.value = payRateVal;
    }
  }
  var durationVal = document.getElementById("durationHours").value;
  var daysVal = document.getElementById("daysNeeded").value;
  var workersVal = document.getElementById("workersNeeded").value;

  if (parseFloat(durationVal) < 4) {
    ccToast("Minimum shift duration is 4 hours. This protects our professionals and ensures quality care.", "error");
    return;
  }
  if (parseInt(daysVal, 10) < 1) {
    ccToast("Please choose at least 1 day.", "error");
    return;
  }
  if (parseInt(workersVal, 10) < 1) {
    ccToast("Please choose at least 1 professional.", "error");
    return;
  }
  if (parseInt(workersVal, 10) > 20) {
    ccToast("Maximum 20 professionals per shift. For larger needs, post multiple shifts or contact support.", "error");
    return;
  }

  var branchId = document.getElementById("branch")?.value || null;
  var assignedWorkerId = document.getElementById("assignedWorkerId")?.value || null;
  var shift = {
    facility_name: document.getElementById("facilityName").value.trim(),
    facility_type: document.getElementById("facilityType").value,
    city: document.getElementById("city").value,
    contact_name: document.getElementById("contactName").value.trim(),
    contact_email: document.getElementById("contactEmail").value.trim(),
    contact_phone: document.getElementById("contactPhone").value.trim(),
    role_needed: document.getElementById("role").value,
    shift_date: document.getElementById("shiftDate").value,
    start_time: document.getElementById("startTime").value,
    duration: durationVal + " hours/day for " + daysVal + " day" + (parseInt(daysVal, 10) === 1 ? "" : "s"),
    duration_hours: parseFloat(durationVal),
    days_needed: parseInt(daysVal, 10),
    workers_needed: parseInt(workersVal, 10),
    pay_rate: "GHS " + payRateVal + "/hr",
    total_pay: "GHS " + (parseFloat(payRateVal) * parseFloat(durationVal) * parseInt(daysVal, 10) * parseInt(workersVal, 10)).toLocaleString(),
    experience_required: document.getElementById("experience").value,
    urgency: document.getElementById("urgency").value,
    notes: document.getElementById("notes").value.trim(),
    branch_id: branchId ? parseInt(branchId) : null,
    assigned_to_worker_id: assignedWorkerId ? parseInt(assignedWorkerId) : null
  };

  var totalPay = parseFloat(payRateVal) * parseFloat(durationVal) * parseInt(daysVal, 10) * parseInt(workersVal, 10);
  var facilityAmount = totalPay * 1.25;

  console.log("Initializing payment for GHS", facilityAmount);

  // ── Determine payment method ──
  var paymentMethod = "instant";
  var pmRadio = document.querySelector('input[name="paymentMethod"]:checked');
  if (pmRadio) paymentMethod = pmRadio.value;

  try {
    var { data: initData } = await ccFetch("/payment/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: shift.contact_email,
        amount: facilityAmount,
        shift_data: shift,
        payment_method: paymentMethod
      })
    });
    console.log("Payment init:", initData);

    if (!initData.success) {
      if (initData.credit_limit_exceeded) {
        // Credit limit reached — switch back to upfront payment
        var instantRadio = document.querySelector('input[name="paymentMethod"][value="instant"]');
        if (instantRadio) instantRadio.checked = true;
        ccToast(initData.message || "Monthly credit limit reached. Please pay upfront for this shift.", "error", 8000);
        return;
      }
      ccToast("Payment initialization failed. Please try again.", "error");
      return;
    }

    // ── Postpaid: shift created directly, no Paystack ──
    if (paymentMethod === "postpaid") {
      document.getElementById("shiftForm").style.display = "none";
      document.getElementById("successCard").style.display = "block";
      document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
      return;
    }

    // ── Wallet payment: deducted from balance, no Paystack ──
    if (initData.wallet_paid) {
      document.getElementById("shiftForm").style.display = "none";
      document.getElementById("successCard").style.display = "block";
      document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
      return;
    }

    var handler = PaystackPop.setup({
      key: CC_CONFIG.PAYSTACK_PUBLIC_KEY,
      email: shift.contact_email,
      amount: Math.round(facilityAmount * 100),
      currency: "GHS",
      ref: initData.reference,
      label: "CoverCare - " + shift.role_needed + " shift",
      onClose: function() {
        console.log("Payment window closed");
      },
      callback: function(response) {
        console.log("Payment successful:", response.reference);

        ccFetch("/payment/verify", {
          method: "POST",
          body: JSON.stringify({ reference: response.reference })
        })
        .then(function(res) { return res.data; })
        .then(function(verifyData) {
          console.log("Verify result:", verifyData);
          if (verifyData.success) {
            document.getElementById("shiftForm").style.display = "none";
            document.getElementById("successCard").style.display = "block";
            document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
          } else {
            ccToast("Payment could not be verified. Please contact support.", "error");
          }
        })
        .catch(function(err) {
          console.error("Verify error:", err);
          ccToast("Payment made but verification failed. Please contact support.", "error");
        });
      }
    });

    handler.openIframe();

  } catch(err) {
    console.error("Payment error:", err);
    ccToast("Something went wrong. Please try again.", "error");
  }
});

// ── Worker search for direct assignment ──
function toggleWorkerSearch() {
  const checked = document.getElementById("assignSpecific").checked;
  document.getElementById("workerSearchSection").style.display = checked ? "block" : "none";
  if (!checked) {
    document.getElementById("assignedWorkerId").value = "";
    document.getElementById("assignedWorkerInfo").style.display = "none";
  }
}

let _workerSearchTimer = null;
function searchWorkers() {
  clearTimeout(_workerSearchTimer);
  _workerSearchTimer = setTimeout(async () => {
    const q = document.getElementById("workerSearchInput").value.trim();
    const role = document.getElementById("workerSearchRole").value;
    const container = document.getElementById("workerSearchResults");
    if (!q && !role) { container.innerHTML = '<div class="empty-state"><p>Type a name or select a role to search.</p></div>'; return; }
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    const { data: result } = await ccFetch("/workers/search?" + params.toString(), { method: "GET" });
    if (!result?.success || !result.data?.length) {
      container.innerHTML = '<div class="empty-state"><p>No workers found.</p></div>'; return;
    }
    container.innerHTML = result.data.map(w => `
      <div class="profile-card" style="margin-bottom:8px; cursor:pointer;" onclick="selectWorker('${w.id}','${escapeHtml(w.full_name)}')">
        <div class="profile-avatar" style="background:rgba(17,24,39,0.1); font-size:14px; overflow:hidden;">
          ${w.profile_photo_url ? `<img src="${escapeHtml(w.profile_photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;" />` : (w.full_name ? escapeHtml(w.full_name.substring(0,2).toUpperCase()) : "?")}
        </div>
        <div class="profile-info" style="flex:1;">
          <h3 style="margin:0 0 2px;">${escapeHtml(w.full_name)}</h3>
          <p style="font-size:13px;color:var(--fg-muted);">${escapeHtml(w.role) || "—"} · ${escapeHtml(w.city) || "—"}${w.experience ? " · " + escapeHtml(w.experience) + " yrs exp" : ""}</p>
        </div>
        <div style="font-size:12px;color:#141414;">Select</div>
      </div>
    `).join("");
  }, 300);
}

function selectWorker(id, name) {
  document.getElementById("assignedWorkerId").value = id;
  const info = document.getElementById("assignedWorkerInfo");
  info.innerHTML = "✓ Assigned: <strong>" + escapeHtml(name) + "</strong> <button type='button' onclick='clearAssignedWorker()' style='font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid #e5e7eb;background:transparent;cursor:pointer;margin-left:8px;'>Remove</button>";
  info.style.display = "block";
  closeWorkerSearch();
}

function clearAssignedWorker() {
  document.getElementById("assignedWorkerId").value = "";
  document.getElementById("assignedWorkerInfo").style.display = "none";
  document.getElementById("assignSpecific").checked = false;
  document.getElementById("workerSearchSection").style.display = "none";
}

function openWorkerSearch() {
  document.getElementById("workerSearchModal").style.display = "flex";
  document.getElementById("workerSearchInput").value = "";
  document.getElementById("workerSearchRole").value = "";
  document.getElementById("workerSearchResults").innerHTML = '<div class="empty-state"><p>Search for workers to assign.</p></div>';
  setTimeout(() => document.getElementById("workerSearchInput").focus(), 200);
}

function closeWorkerSearch() {
  document.getElementById("workerSearchModal").style.display = "none";
}