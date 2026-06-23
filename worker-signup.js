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
    const name = document.getElementById("fullname").value.trim();

    const { response, data } = await ccFetch(
      `/verify?registration_number=${encodeURIComponent(license)}&name=${encodeURIComponent(name)}`,
      { method: "GET", headers: {} }
    );
    console.log("Verification response:", data);

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

  const pharmacyRoles = ["pharmacist", "pharmacy-tech"];
  if (pharmacyRoles.includes(worker.role) && !licenseVerified) {
    alert("Please verify your pharmacy license before submitting.");
    return;
  }

  try {
    const { response, data: result } = await ccFetch("/worker", {
      method: "POST",
      body: JSON.stringify({
        full_name: worker.name,
        email: worker.email,
        phone: worker.phone,
        role: worker.role,
        license_number: worker.license,
        city: worker.city,
        experience: worker.experience
      })
    });

    console.log("Save result:", result);

    if (response.ok && result.success) {
      document.getElementById("workerForm").style.display = "none";
      document.getElementById("successCard").style.display = "block";
      document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
    } else {
      alert("Something went wrong. Please try again.");
    }

  } catch (err) {
    console.error("Submit error:", err);
    alert("Something went wrong. Please try again.");
  }
});