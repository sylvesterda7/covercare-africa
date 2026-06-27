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
      alert("Please fill in all fields before continuing.");
      return false;
    }
  }
  return true;
}

// ── Validate step 2 ──
function validateStep2() {
  const fields = ["role", "shiftDate", "startTime", "duration"];
  for (let field of fields) {
    if (!document.getElementById(field).value) {
      alert("Please fill in all shift details before continuing.");
      return false;
    }
  }
  const payRateInput = document.getElementById("payRate");
  if (!payRateInput.value) {
    const roleVal = document.getElementById("role").value;
    if (suggestedRates[roleVal]) {
      payRateInput.value = suggestedRates[roleVal];
    } else {
      alert("Please enter a pay rate.");
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

document.addEventListener("DOMContentLoaded", function() {
  fetchSuggestedRates();

  const roleEl = document.getElementById("role");
  const payRateEl = document.getElementById("payRate");
  const rateHintEl = document.getElementById("rateHint");

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
  const durationEl = document.getElementById("duration");

  function updateEstimate() {
    const rate = parseFloat(payRateEl.value) || 0;
    const hours = parseFloat(durationEl.value) || 0;
    const total = rate * hours;
    const facilityTotal = total * 1.25;

    const totalPayEl = document.getElementById("totalPay");
    if (totalPayEl) totalPayEl.textContent = "GHS " + total.toLocaleString();

    const estimateEl = document.getElementById("payEstimate");
    if (estimateEl && total > 0) {
      estimateEl.innerHTML =
        "Worker receives: <strong>GHS " + total.toLocaleString() + "</strong>" +
        " &nbsp;·&nbsp; You pay: <strong>GHS " + facilityTotal.toLocaleString() + "</strong>" +
        " <span style='font-size:12px; opacity:0.6;'>(includes CoverCare fee)</span>";
    }
  }

  payRateEl.addEventListener("input", updateEstimate);
  durationEl.addEventListener("change", updateEstimate);
});

// ── Show shift summary on step 3 ──
function showSummary() {
  const role = document.getElementById("role").value;
  const date = document.getElementById("shiftDate").value;
  const time = document.getElementById("startTime").value;
  const duration = document.getElementById("duration").value;
  const pay = document.getElementById("payRate").value;
  const city = document.getElementById("city").value;
  const facility = document.getElementById("facilityName").value;
  const total = parseFloat(pay) * parseFloat(duration);
  const facilityTotal = total * 1.25;

  document.getElementById("shiftSummary").innerHTML =
    "<strong>Facility:</strong> " + facility + "<br>" +
    "<strong>City:</strong> " + city + "<br>" +
    "<strong>Role needed:</strong> " + role + "<br>" +
    "<strong>Date:</strong> " + date + "<br>" +
    "<strong>Start time:</strong> " + time + "<br>" +
    "<strong>Duration:</strong> " + duration + " hours<br>" +
    "<strong>Worker pay rate:</strong> GHS " + pay + "/hr<br>" +
    "<strong>Worker total pay:</strong> GHS " + total.toLocaleString() + "<br>" +
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
  var durationVal = document.getElementById("duration").value;

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
    duration: durationVal + " hours",
    pay_rate: "GHS " + payRateVal + "/hr",
    total_pay: "GHS " + (parseFloat(payRateVal) * parseFloat(durationVal)).toLocaleString(),
    experience_required: document.getElementById("experience").value,
    urgency: document.getElementById("urgency").value,
    notes: document.getElementById("notes").value.trim()
  };

  var totalPay = parseFloat(payRateVal) * parseFloat(durationVal);
  var facilityAmount = totalPay * 1.25;

  console.log("Initializing payment for GHS", facilityAmount);

  try {
    var { data: initData } = await ccFetch("/payment/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: shift.contact_email,
        amount: facilityAmount,
        shift_data: shift
      })
    });
    console.log("Payment init:", initData);

    if (!initData.success) {
      alert("Payment initialization failed. Please try again.");
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
            alert("Payment could not be verified. Please contact support.");
          }
        })
        .catch(function(err) {
          console.error("Verify error:", err);
          alert("Payment made but verification failed. Please contact support.");
        });
      }
    });

    handler.openIframe();

  } catch(err) {
    console.error("Payment error:", err);
    alert("Something went wrong. Please try again.");
  }
});