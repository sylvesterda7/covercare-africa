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
      { method: "GET" }
    );
    console.log("Verification response:", data);

    if (data.success === true) {
      licenseVerified = true;
      resultBox.className = "verify-result success";
      resultBox.innerHTML = `
        <strong>Verified — Active and in good standing</strong><br>
        ${data.message}<br>
        <span style="font-size:12px; color:#0F6E56;">
          Source: Pharmacy Council Ghana · ${new Date().toLocaleDateString()}
        </span>
      `;
    } else if (data.data && data.data.status === "name_mismatch") {
      licenseVerified = false;
      resultBox.className = "verify-result warning";
      resultBox.innerHTML = `
        <strong>Name mismatch</strong><br>
        This registration number exists but the name does not match 
        Pharmacy Council records. Please check that your full name 
        matches exactly as registered with the Council.
      `;
    } else if (data.data && data.data.status === "not_found") {
      licenseVerified = false;
      resultBox.className = "verify-result warning";
      resultBox.innerHTML = `
        <strong>Not found</strong><br>
        We couldn't find this registration number in Pharmacy Council records. 
        Please check and try again, or contact us for manual verification.
      `;
    } else {
      licenseVerified = false;
      resultBox.className = "verify-result error";
      resultBox.innerHTML = `
        <strong>Verification unavailable</strong><br>
        Our verification service is temporarily unavailable. 
        Your application will be reviewed manually within 24 hours.
      `;
    }

  } catch (err) {
    console.error("Verify error:", err);
    licenseVerified = false;
    resultBox.className = "verify-result error";
    resultBox.innerHTML = `
      <strong>Verification unavailable</strong><br>
      Our verification service is temporarily unavailable. 
      Your application will be reviewed manually within 24 hours.
    `;
  }

  // ── Always reset button ──
  btn.disabled = false;
  btn.textContent = "Verify";
}

// ── Session check — show password fields if not authenticated ──
(async function() {
  const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    document.getElementById("regFields").style.display = "block";
  }
})();

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

  const btn = this.querySelector(".btn-submit");
  btn.disabled = true;
  btn.textContent = "Creating account...";

  const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
  const { data: { session } } = await _supabase.auth.getSession();

  // Step 1: Register account if not logged in
  if (!session) {
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!password || password.length < 8) {
      alert("Password must be at least 8 characters.");
      btn.disabled = false;
      btn.textContent = "Create my profile";
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      btn.disabled = false;
      btn.textContent = "Create my profile";
      return;
    }

    const { data: signUpData, error: signUpError } = await _supabase.auth.signUp({
      email: worker.email,
      password,
      options: { data: { full_name: worker.name, user_type: "worker" } }
    });

    if (signUpError) {
      alert(signUpError.message);
      btn.disabled = false;
      btn.textContent = "Create my profile";
      return;
    }

    // If email confirmation is required, stop here
    if (!signUpData.session) {
      document.getElementById("workerForm").style.display = "none";
      document.getElementById("successCard").querySelector("h2").textContent = "Account created!";
      document.getElementById("successCard").querySelector("p").textContent =
        "Check your email to confirm your account, then sign in and complete your profile.";
      document.getElementById("successCard").style.display = "block";
      btn.disabled = false;
      btn.textContent = "Create my profile";
      return;
    }
  }

  // Step 2: Save profile
  btn.textContent = "Saving profile...";

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
      window.location.href = "dashboard-worker.html";
    } else {
      alert("Something went wrong. Please try again.");
      btn.disabled = false;
      btn.textContent = "Create my profile";
    }

  } catch (err) {
    console.error("Submit error:", err);
    alert("Something went wrong. Please try again.");
    btn.disabled = false;
    btn.textContent = "Create my profile";
  }
});