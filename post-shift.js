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
  const fields = ["role", "shiftDate", "startTime", "duration", "payRate"];
  for (let field of fields) {
    if (!document.getElementById(field).value) {
      alert("Please fill in all shift details before continuing.");
      return false;
    }
  }
  return true;
}

// ── Live pay estimate ──
document.addEventListener("DOMContentLoaded", function() {
  const payRate = document.getElementById("payRate");
  const duration = document.getElementById("duration");

  function updateEstimate() {
    const rate = parseFloat(payRate.value) || 0;
    const hours = parseFloat(duration.value) || 0;
    const total = rate * hours;
    const facilityTotal = total * 1.25;
    document.getElementById("totalPay").textContent = "GHS " + total.toLocaleString();

    // Show what facility pays including CoverCare margin
    const estimateEl = document.getElementById("payEstimate");
    if (estimateEl && total > 0) {
      estimateEl.innerHTML = `
        Worker receives: <strong>GHS ${total.toLocaleString()}</strong> &nbsp;·&nbsp;
        You pay: <strong>GHS ${facilityTotal.toLocaleString()}</strong>
        <span style="font-size:12px; opacity:0.6;">(includes CoverCare fee)</span>
      `;
    }
  }

  payRate.addEventListener("input", updateEstimate);
  duration.addEventListener("change", updateEstimate);
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

  document.getElementById("shiftSummary").innerHTML = `
    <strong>Facility:</strong> ${facility}<br>
    <strong>City:</strong> ${city}<br>
    <strong>Role needed:</strong> ${role}<br>
    <strong>Date:</strong> ${date}<br>
    <strong>Start time:</strong> ${time}<br>
    <strong>Duration:</strong> ${duration} hours<br>
    <strong>Worker pay rate:</strong> GHS ${pay}/hr<br>
    <strong>Worker total pay:</strong> GHS ${total.toLocaleString()}<br>
    <strong>You pay (incl. CoverCare fee):</strong> GHS ${facilityTotal.toLocaleString()}
  `;
}

// ── Form submission with Paystack payment ──
document.getElementById("shiftForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const shift = {
    facility_name: document.getElementById("facilityName").value.trim(),
    facility_type: document.getElementById("facilityType").value,
    city: document.getElementById("city").value,
    contact_name: document.getElementById("contactName").value.trim(),
    contact_email: document.getElementById("contactEmail").value.trim(),
    contact_phone: document.getElementById("contactPhone").value.trim(),
    role_needed: document.getElementById("role").value,
    shift_date: document.getElementById("shiftDate").value,
    start_time: document.getElementById("startTime").value,
    duration: document.getElementById("duration").value + " hours",
    pay_rate: "GHS " + document.getElementById("payRate").value + "/hr",
    total_pay: "GHS " + (
      parseFloat(document.getElementById("payRate").value) *
      parseFloat(document.getElementById("duration").value)
    ).toLocaleString(),
    experience_required: document.getElementById("experience").value,
    urgency: document.getElementById("urgency").value,
    notes: document.getElementById("notes").value.trim(),
  };

  const payRate = parseFloat(document.getElementById("payRate").value);
  const duration = parseFloat(document.getElementById("duration").value);
  const totalPay = payRate * duration;
  const facilityAmount = totalPay * 1.25; // CoverCare 25% margin

  console.log("Initializing payment for GHS", facilityAmount);

  try {
    // ── Initialize payment via backend ──
    const initResponse = await fetch(
      "https://covercare-backend-production.up.railway.app/payment/initialize",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "cc-africa-2025-verify-key"
        },
        body: JSON.stringify({
          email: shift.contact_email,
          amount: facilityAmount,
          shift_data: shift
        })
      }
    );

    const initData = await initResponse.json();
    console.log("Payment init:", initData);

    if (!initData.success) {
      alert("Payment initialization failed. Please try again.");
      return;
    }

    // ── Open Paystack popup ──
    const handler = PaystackPop.setup({
      key: "pk_test_866cbb9c537c7780cc05fa3d88c10fcd5e758d02",
      email: shift.contact_email,
      amount: Math.round(facilityAmount * 100),
      currency: "GHS",
      ref: initData.reference,
      label: `CoverCare - ${shift.role_needed} shift`,
      onClose: function() {
        console.log("Payment window closed");
      },
      callback: async function(response) {
        console.log("Payment successful:", response.reference);

        // ── Verify payment ──
        const verifyResponse = await fetch(
          "https://covercare-backend-production.up.railway.app/payment/verify",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "cc-africa-2025-verify-key"
            },
            body: JSON.stringify({ reference: response.reference })
          }
        );

        const verifyData = await verifyResponse.json();
        console.log("Verify result:", verifyData);

        if (verifyData.success) {
          document.getElementById("shiftForm").style.display = "none";
          document.getElementById("successCard").style.display = "block";
          document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
        } else {
          alert("Payment could not be verified. Please contact support.");
        }
      }
    });

    handler.openIframe();

  } catch (err) {
    console.error("Payment error:", err);
    alert("Something went wrong. Please try again.");
  }
});