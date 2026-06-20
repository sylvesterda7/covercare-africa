// ── License verification ──
let licenseVerified = false;

// ── Show/hide verify button based on role ──
document.getElementById("role").addEventListener("change", function() {
  const role = this.value;
  const verifyBtn = document.getElementById("verifyBtn");
  const uploadNote = document.getElementById("uploadNote");
  const uploadGroup = document.getElementById("uploadGroup");
  const pharmacyRoles = ["pharmacist", "pharmacy-tech"];

  if (pharmacyRoles.includes(role)) {
    verifyBtn.style.display = "block";
    uploadNote.style.display = "none";
    uploadGroup.style.display = "none";
  } else {
    verifyBtn.style.display = "none";
    uploadNote.style.display = "block";
    uploadGroup.style.display = "block";
  }
});

// ── Verify license against Pharmacy Council Ghana ──
async function verifyLicense() {
  const license = document.getElementById("license").value.trim();
  const role = document.getElementById("role").value;
  const resultBox = document.getElementById("verifyResult");
  const btn = document.getElementById("verifyBtn");

  // ── Validation ──
  if (!role) {
    alert("Please select your role first.");
    return;
  }

  if (!license) {
    alert("Please enter your license / registration number.");
    return;
  }

  // ── Show loading state ──
  btn.disabled = true;
  btn.textContent = "Checking...";
  resultBox.className = "verify-result";
  resultBox.innerHTML = "";

  try {
    // ── Call verification backend ──
    const name = document.getElementById("fullname").value.trim();

    const response = await fetch(
  `https://covercare-backend-production.up.railway.app/verify?registration_number=${encodeURIComponent(license)}&name=${encodeURIComponent(name)}&api_key=cc-africa-2025-verify-key`
);
    const data = await response.json();

    console.log("Verification response:", data);

    // ── Handle response ──
    if (data.success === true) {
      licenseVerified = true;
      resultBox.className = "verify-result success";
      resultBox.innerHTML = `
        ✓ <strong>Verified — Active and in good standing</strong><br>
        ${data.message}<br>
        <span style="font-size:12px; color:#0F6E56;">
          Source: Pharmacy Council Ghana · ${new Date().toLocaleDateString()}
        </span>
      `;

    } else if (data.data && data.data.status === "name_mismatch") {
      licenseVerified = false;
      resultBox.className = "verify-result warning";
      resultBox.innerHTML = `
        ⚠ <strong>Name mismatch</strong><br>
        This registration number exists but the name does not match 
        Pharmacy Council records. Please check that your full name 
        matches exactly as registered with the Council.
      `;

    } else if (data.data && data.data.status === "not_found") {
      licenseVerified = false;
      resultBox.className = "verify-result warning";
      resultBox.innerHTML = `
        ⚠ <strong>Not found</strong><br>
        We couldn't find this registration number in Pharmacy Council records. 
        Please check and try again, or contact us for manual verification.
      `;

    } else {
      licenseVerified = false;
      resultBox.className = "verify-result error";
      resultBox.innerHTML = `
        ✗ <strong>Verification unavailable</strong><br>
        Our verification service is temporarily unavailable. 
        Your application will be reviewed manually within 24 hours.
      `;
    }

  } catch (err) {
    console.error("Verify error:", err);
    licenseVerified = false;
    resultBox.className = "verify-result error";
    resultBox.innerHTML = `
      ✗ <strong>Verification unavailable</strong><br>
      Our verification service is temporarily unavailable. 
      Your application will be reviewed manually within 24 hours.
    `;
  }

  // ── Always reset button ──
  btn.disabled = false;
  btn.textContent = "Verify";
}

// ── Form submission ──
document.getElementById("workerForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const worker = {
    name: document.getElementById("fullname").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    role: document.getElementById("role").value,
    license: document.getElementById("license").value.trim(),
    licenseVerified: licenseVerified,
    city: document.getElementById("city").value,
    experience: document.getElementById("experience").value,
  };

  if (
    !worker.name ||
    !worker.email ||
    !worker.phone ||
    !worker.role ||
    !worker.license ||
    !worker.city ||
    !worker.experience
  ) {
    alert("Please fill in all fields.");
    return;
  }

  // ── Send to Formspree ──
  const response = await fetch("https://formspree.io/f/mykarpka", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(worker)
  });

  if (response.ok) {
    document.getElementById("workerForm").style.display = "none";
    document.getElementById("successCard").style.display = "block";
    document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
  } else {
    alert("Something went wrong. Please try again.");
  }
});