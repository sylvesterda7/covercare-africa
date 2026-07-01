// ── Supabase client ──
const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

// ── License verification ──
let licenseVerified = false;
let googleProfile = null;

// ── Populate country dropdown ──
(function populateCountries() {
  const sel = document.getElementById("country");
  AFRICAN_COUNTRIES.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.code;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
})();

// ── Country change → populate cities + show form ──
document.getElementById("country").addEventListener("change", function() {
  const countryCode = this.value;
  const country = AFRICAN_COUNTRIES.find(c => c.code === countryCode);
  const citySel = document.getElementById("city");
  citySel.innerHTML = '<option value="" disabled selected>Select your city</option>';
  if (country) {
    country.cities.forEach(city => {
      const opt = document.createElement("option");
      opt.value = city.value;
      opt.textContent = city.label;
      citySel.appendChild(opt);
    });
    // Update phone placeholder with country prefix
    document.getElementById("phone").placeholder = country.phonePrefix + " XX XXX XXXX";
  }
  document.getElementById("restOfForm").style.display = "block";
});

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

// ── Live location ──
function useLiveLocation() {
  if (!navigator.geolocation) {
    ccToast("Geolocation is not supported by your browser.", "error");
    return;
  }
  const btn = document.getElementById("locationBtn");
  btn.disabled = true;
  btn.textContent = "Detecting...";
  navigator.geolocation.getCurrentPosition(
    async function(pos) {
      document.getElementById("lat").value = pos.coords.latitude;
      document.getElementById("lng").value = pos.coords.longitude;
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&accept-language=en`);
        const geo = await resp.json();
        const cityParts = [geo.address?.city, geo.address?.town, geo.address?.village, geo.address?.county].filter(Boolean);
        if (cityParts.length) {
          const city = cityParts[0].toLowerCase().replace(/\s+/g, "-");
          const sel = document.getElementById("city");
          for (let opt of sel.options) {
            if (opt.value === city) { sel.value = city; break; }
          }
        }
        ccToast("Location detected.", "success");
      } catch (_) {
        ccToast("Location coordinates captured.", "success");
      }
      btn.disabled = false;
      btn.textContent = "📍 Use my location";
    },
    function() {
      ccToast("Could not detect location. Please allow location access.", "error");
      btn.disabled = false;
      btn.textContent = "📍 Use my location";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ── Google sign-in ──
async function signUpWithGoogle() {
  const { error } = await _supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/worker-signup.html",
      queryParams: { access_type: "offline", prompt: "consent" }
    }
  });
  if (error) ccToast(error.message, "error");
}

function applyGoogleProfile(session) {
  const meta = session.user.user_metadata;
  if (meta?.provider !== "google") return false;
  googleProfile = meta;
  const emailField = document.getElementById("email");
  document.getElementById("fullname").value = meta.full_name || meta.name || "";
  emailField.value = meta.email || session.user.email || "";
  emailField.readOnly = true;
  document.getElementById("regFields").style.display = "none";
  document.getElementById("googleBadge").style.display = "inline-flex";
  document.getElementById("googleBtnWrap").style.display = "none";
  document.getElementById("googleEmail").textContent = emailField.value;
  return true;
}

_supabase.auth.onAuthStateChange((event, session) => {
  if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
    if (session.user.user_metadata?.user_type === "worker") {
      window.location.href = "dashboard-worker.html";
      return;
    }
    if (session.user.user_metadata?.provider === "google") {
      applyGoogleProfile(session);
    }
  }
});

// ── On-page Google session handler (redirect flow) ──
(async function() {
  const hash = window.location.hash;
  if (hash && (hash.includes("access_token") || hash.includes("type=signup") || hash.includes("type=recovery"))) {
    const { data, error } = await _supabase.auth.getSession();
    if (!error && data.session) {
      applyGoogleProfile(data.session);
      window.location.hash = "";
    }
  }
  const { data: { session } } = await _supabase.auth.getSession();
  if (session) {
    if (session.user.user_metadata?.user_type === "worker") {
      window.location.href = "dashboard-worker.html";
      return;
    }
    if (session.user.user_metadata?.provider === "google") {
      applyGoogleProfile(session);
    } else {
      document.getElementById("regFields").style.display = "none";
      document.getElementById("email").readOnly = true;
    }
  } else {
    document.getElementById("regFields").style.display = "block";
  }
})();

// ── Verify license against Pharmacy Council Ghana ──
async function verifyLicense() {
  const license = document.getElementById("license").value.trim();
  const role = document.getElementById("role").value;
  const resultBox = document.getElementById("verifyResult");
  const btn = document.getElementById("verifyBtn");

  if (!role) {
    ccToast("Please select your role first.", "error");
    return;
  }

  if (!license) {
    ccToast("Please enter your license / registration number.", "error");
    return;
  }

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
    country: document.getElementById("country").value,
    city: document.getElementById("city").value,
    experience: document.getElementById("experience").value,
  };

  if (
    !worker.name ||
    !worker.email ||
    !worker.phone ||
    !worker.role ||
    !worker.license ||
    !worker.country ||
    !worker.city ||
    !worker.experience
  ) {
    ccToast("Please fill in all fields.", "error");
    return;
  }

  const pharmacyRoles = ["pharmacist", "pharmacy-tech"];
  if (pharmacyRoles.includes(worker.role) && !licenseVerified) {
    ccToast("Please verify your pharmacy license before submitting.", "error");
    return;
  }

  const btn = this.querySelector(".btn-submit");
  btn.disabled = true;
  btn.textContent = "Creating account...";

  const { data: { session } } = await _supabase.auth.getSession();

  // Step 1: Register account if not logged in (email/password flow)
  if (!session) {
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!password || password.length < 8) {
      ccToast("Password must be at least 8 characters.", "error");
      btn.disabled = false;
      btn.textContent = "Create my profile";
      return;
    }
    if (password !== confirmPassword) {
      ccToast("Passwords do not match.", "error");
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
      ccToast(signUpError.message, "error");
      btn.disabled = false;
      btn.textContent = "Create my profile";
      return;
    }

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
        country: worker.country,
        city: worker.city,
        experience: worker.experience
      })
    });

    console.log("Save result:", result);

    if (response.ok && result.success) {
      await _supabase.auth.updateUser({ data: { user_type: "worker" } }).catch(() => {});
      window.location.href = "dashboard-worker.html";
    } else {
      ccToast("Something went wrong. Please try again.", "error");
      btn.disabled = false;
      btn.textContent = "Create my profile";
    }

  } catch (err) {
    console.error("Submit error:", err);
    ccToast("Something went wrong. Please try again.", "error");
    btn.disabled = false;
    btn.textContent = "Create my profile";
  }
});
