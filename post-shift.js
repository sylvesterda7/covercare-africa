// ── Step navigation ──
function goToStep(step) {
  if (step === 2 && !validateStep1()) return;
  if (step === 3 && !validateStep2()) return;

  // Hide all steps
  document.querySelectorAll(".form-step").forEach(s => s.classList.add("hidden"));

  // Show target step
  document.getElementById("step" + step).classList.remove("hidden");

  // Update progress dots
  document.querySelectorAll(".progress-step").forEach((dot, i) => {
    dot.classList.remove("active", "done");
    if (i + 1 < step) dot.classList.add("done");
    if (i + 1 === step) dot.classList.add("active");
  });

  // Update progress lines
  document.querySelectorAll(".progress-line").forEach((line, i) => {
    line.classList.remove("done");
    if (i + 1 < step) line.classList.add("done");
  });

  // If moving to step 3, show shift summary
  if (step === 3) showSummary();

  // Scroll to top of form
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
    document.getElementById("totalPay").textContent = "GHS " + total.toLocaleString();
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

  document.getElementById("shiftSummary").innerHTML = `
    <strong>Facility:</strong> ${facility}<br>
    <strong>City:</strong> ${city}<br>
    <strong>Role needed:</strong> ${role}<br>
    <strong>Date:</strong> ${date}<br>
    <strong>Start time:</strong> ${time}<br>
    <strong>Duration:</strong> ${duration} hours<br>
    <strong>Pay rate:</strong> GHS ${pay}/hr<br>
    <strong>Total pay:</strong> GHS ${total.toLocaleString()}
  `;
}

// ── Form submission ──
document.getElementById("shiftForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const shift = {
    facilityName: document.getElementById("facilityName").value.trim(),
    facilityType: document.getElementById("facilityType").value,
    city: document.getElementById("city").value,
    contactName: document.getElementById("contactName").value.trim(),
    contactEmail: document.getElementById("contactEmail").value.trim(),
    contactPhone: document.getElementById("contactPhone").value.trim(),
    role: document.getElementById("role").value,
    shiftDate: document.getElementById("shiftDate").value,
    startTime: document.getElementById("startTime").value,
    duration: document.getElementById("duration").value + " hours",
    payRate: "GHS " + document.getElementById("payRate").value + "/hr",
    totalPay: "GHS " + (parseFloat(document.getElementById("payRate").value) * parseFloat(document.getElementById("duration").value)).toLocaleString(),
    experience: document.getElementById("experience").value,
    urgency: document.getElementById("urgency").value,
    notes: document.getElementById("notes").value.trim(),
  };

  const response = await fetch("https://formspree.io/f/mdavqdpl", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(shift)
  });

  if (response.ok) {
    document.getElementById("shiftForm").style.display = "none";
    document.getElementById("successCard").style.display = "block";
    document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
  } else {
    alert("Something went wrong. Please try again.");
  }
});