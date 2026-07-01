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

// ── Validate step 1 ──
function validateStep1() {
  const fields = ["facilityName", "facilityType", "city", "contactName", "contactEmail", "contactPhone"];
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
    ccToast("Shift duration must be at least 4 hours.", "error");
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

document.addEventListener("DOMContentLoaded", async function() {
  window._supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
  const { data: { session } } = await window._supabase.auth.getSession();
  if (session) {
    const emailField = document.getElementById("contactEmail");
    emailField.value = session.user.email;
    emailField.readOnly = true;
    emailField.style.opacity = "0.7";
    emailField.style.cursor = "not-allowed";
    emailField.title = "Uses your account email";
  }

  fetchSuggestedRates();

  // ── Check if facility is trusted (postpaid billing) ──
  (async () => {
    try {
      const { data: fac } = await window._supabase
        .from("facilities")
        .select("billing_model, trusted_by")
        .eq("email", session?.user?.email)
        .maybeSingle();
      window._canPostpaid = fac?.billing_model === "postpaid" && !!fac?.trusted_by;
      if (window._canPostpaid) {
        const el = document.getElementById("paymentMethodToggle");
        if (el) el.style.display = "block";
      }
    } catch (_) {}
  })();

  // ── Pre-fill client info if user is an individual ──
  (async () => {
    try {
      const { data: client } = await window._supabase
        .from("clients")
        .select("full_name, city")
        .eq("email", session?.user?.email)
        .maybeSingle();
      if (client) {
        const nameEl = document.getElementById("facilityName");
        if (nameEl && !nameEl.value) nameEl.value = client.full_name || "";
        const cityEl = document.getElementById("city");
        if (cityEl && !cityEl.value && client.city) cityEl.value = client.city;
        const typeEl = document.getElementById("facilityType");
        if (typeEl && !typeEl.value) typeEl.value = "individual";
      }
    } catch (_) {}
  })();

  const roleEl = document.getElementById("role");
  const payRateEl = document.getElementById("payRate");
  const rateHintEl = document.getElementById("rateHint");
  const durationHoursEl = document.getElementById("durationHours");
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
    "<strong>Date:</strong> " + date + "<br>" +
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
    ccToast("Shift duration must be at least 4 hours.", "error");
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
    notes: document.getElementById("notes").value.trim()
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