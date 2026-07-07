// ── Supabase client ──
// Use the shared singleton helper from config.js to avoid creating multiple GoTrueClient instances
const _supabase = ccGetSupabaseClient() || (window.supabase && window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY));

let googleProfile = null;

// ── Stage 1: account creation (email + password, or Google/Apple) ──
// Phone OTP is deferred for now (see CC_CONFIG.REQUIRE_PHONE_VERIFICATION) so
// signup no longer branches on "phone or email" — it's email + password, or an
// OAuth provider. The phone number is still required, collected in the profile
// step below, and saved; it just isn't OTP-verified yet. License verification
// and document upload happen later from the dashboard — signup is account
// creation only.
function revealStage2() {
  document.getElementById("stage1Fields").style.display = "none";
  document.getElementById("stage2Fields").style.display = "block";
}

async function startPrimarySignup() {
  const fullname = document.getElementById("fullname").value.trim();
  const email = document.getElementById("email").value.trim();

  if (!fullname || !email) {
    ccToast("Please fill in your name and email.", "error");
    return;
  }

  // Already authenticated (e.g. via Google/Apple) — account exists, go on to
  // the profile step (which collects the phone number).
  const { data: { session: existingSession } } = await _supabase.auth.getSession();
  if (existingSession) {
    revealStage2();
    return;
  }

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  if (!password || password.length < 8) {
    ccToast("Password must be at least 8 characters.", "error");
    return;
  }
  if (password !== confirmPassword) {
    ccToast("Passwords do not match.", "error");
    return;
  }

  const btn = document.getElementById("continueBtn");
  btn.disabled = true;
  btn.textContent = "Sending code...";

  const { error } = await ccSignUpWithEmail(email, password, "worker", fullname);
  if (error) {
    ccToast(error.message, "error");
    btn.disabled = false;
    btn.textContent = "Continue";
    return;
  }

  document.getElementById("otpLabel").textContent = "Enter the 6-digit code we sent to your email";
  btn.style.display = "none";
  document.getElementById("otpGroup").style.display = "block";
}

async function confirmPrimaryOtp() {
  const token = document.getElementById("otpCode").value.trim();
  if (!token) {
    ccToast("Please enter the code we sent you.", "error");
    return;
  }
  const email = document.getElementById("email").value.trim();
  const { error } = await ccVerifySignupEmailOtp(email, token);
  if (error) {
    ccToast(error.message, "error");
    return;
  }
  revealStage2();
}

// ── Live password strength meter + confirm-match feedback ──
function wirePasswordUx() {
  const pw = document.getElementById("password");
  const confirm = document.getElementById("confirmPassword");
  if (!pw || !confirm) return;
  const strengthWrap = document.getElementById("pwStrength");
  const fill = document.getElementById("pwStrengthFill");
  const label = document.getElementById("pwStrengthLabel");
  const matchMsg = document.getElementById("pwMatchMsg");

  function renderStrength() {
    if (!pw.value) { strengthWrap.style.display = "none"; return; }
    strengthWrap.style.display = "block";
    const s = ccPasswordStrength(pw.value);
    fill.style.width = s.pct + "%";
    fill.style.backgroundColor = s.color;
    label.textContent = s.label;
    label.style.color = s.color;
  }
  function renderMatch() {
    if (!confirm.value) { matchMsg.textContent = ""; matchMsg.className = "pw-match-msg"; return; }
    if (pw.value === confirm.value) { matchMsg.textContent = "Passwords match"; matchMsg.className = "pw-match-msg ok"; }
    else { matchMsg.textContent = "Passwords don't match yet"; matchMsg.className = "pw-match-msg bad"; }
  }
  pw.addEventListener("input", () => { renderStrength(); renderMatch(); });
  confirm.addEventListener("input", renderMatch);
}
wirePasswordUx();

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
    document.getElementById("phone").placeholder = country.phonePrefix + " XX XXX XXXX";
    const currencyNote = document.getElementById("currencyNote");
    if (currencyNote) {
      currencyNote.textContent = `You'll be paid in ${country.currency} (${country.name}).`;
      currencyNote.style.display = "block";
    }
  }
  document.getElementById("restOfForm").style.display = "block";
  updateLicenseHint();
});

// ── Populate role options ──
const ROLES = [
  { value: "pharmacist", label: "Pharmacist" },
  { value: "pharmacy-tech", label: "Pharmacy Technician" },
  { value: "medicine-counter-assistant", label: "Medicine Counter Assistant" },
  { value: "medical-doctor", label: "Medical Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "lab-technician", label: "Lab Technician" },
  { value: "midwife", label: "Midwife" },
  { value: "community-health", label: "Community Health Worker" },
  { value: "dental", label: "Dental Professional" },
  { value: "physiotherapist", label: "Physiotherapist" },
  { value: "radiographer", label: "Radiographer" },
  { value: "paramedic", label: "Paramedic / EMT" },
  { value: "health-administrator", label: "Health Administrator" },
];

(function populateRoles() {
  const sel = document.getElementById("role");
  ROLES.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.value;
    opt.textContent = r.label;
    sel.appendChild(opt);
  });
})();

// ── Update license hint when country or role changes ──
function updateLicenseHint() {
  const country = document.getElementById("country").value;
  const role = document.getElementById("role").value;
  const licField = document.getElementById("license");
  if (country && role) {
    licField.placeholder = getLicenseHint(country, role);
  } else {
    licField.placeholder = "License / registration number";
  }
}

document.getElementById("role").addEventListener("change", updateLicenseHint);

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

// ── Google / Apple sign-in ──
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

// Requires Sign in with Apple to be configured in Supabase Auth (Authentication
// → Providers → Apple) plus an Apple Developer Services ID/key — see repo docs.
async function signUpWithApple() {
  const { error } = await _supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo: window.location.origin + "/worker-signup.html" }
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

// Does this account already have a worker profile row? An account can exist
// in auth (user_type set at account creation) without ever having completed
// the profile step that inserts the workers row. We must not bounce those
// people to the dashboard — there's no way to create the profile from there.
async function workerProfileExists(email) {
  try {
    const { data } = await ccFetch("/worker/by-email", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    return !!(data && data.success);
  } catch (_) {
    return false;
  }
}

// Route a signed-in visitor: to the dashboard only if their profile already
// exists; otherwise drop them into the profile step here so they can finish
// (recovery path for accounts that created auth but never completed signup).
async function routeSignedInWorker(session) {
  if (await workerProfileExists(session.user.email)) {
    window.location.href = "dashboard-worker.html";
    return;
  }
  if (session.user.user_metadata?.provider === "google") {
    applyGoogleProfile(session);
  }
  document.getElementById("stage1Fields").style.display = "none";
  document.getElementById("stage2Fields").style.display = "block";
}

_supabase.auth.onAuthStateChange((event, session) => {
  if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
    routeSignedInWorker(session);
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
    await routeSignedInWorker(session);
  } else {
    document.getElementById("regFields").style.display = "block";
  }
})();

// ── Form submission (stage 2 — profile details; account already exists) ──
document.getElementById("workerForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const worker = {
    name: document.getElementById("fullname").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    role: document.getElementById("role").value,
    license: document.getElementById("license").value.trim(),
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

  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    ccToast("Please complete account creation above first.", "error");
    return;
  }

  const btn = e.submitter || this.querySelector('[type="submit"]');
  btn.disabled = true;
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
      // Email was verified in the account step; phone verification is deferred.
      // The dashboard's own gate (ccRequireVerifiedContact) will bounce back to
      // verify-contact.html if email somehow isn't confirmed yet.
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
