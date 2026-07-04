// ── Supabase client ──
// Use the shared singleton helper from config.js to avoid creating multiple GoTrueClient instances
const _supabase = ccGetSupabaseClient() || (window.supabase && window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY));

let googleProfile = null;

// ── Stage 1: account creation with dual-channel signup ──
// License verification and document upload now happen post-signup, from
// the dashboard's Verification & Documents tab — signup is account
// creation only. The chosen contact method becomes the Supabase Auth
// identifier and is verified right here; if that method was phone, email
// must ALSO be linked+verified here (not deferred) because the workers
// table is keyed by email everywhere downstream. If the primary method was
// email, phone verification is deferred to verify-contact.html after the
// profile is created (email already exists as the account key by then).
let signupMethod = "email";
let _awaitingEmailLink = false;

function setSignupMethod(method) {
  signupMethod = method;
  document.getElementById("methodEmailBtn").classList.toggle("active", method === "email");
  document.getElementById("methodPhoneBtn").classList.toggle("active", method === "phone");
}

function revealStage2() {
  document.getElementById("stage1Fields").style.display = "none";
  document.getElementById("stage2Fields").style.display = "block";
}

async function startPrimarySignup() {
  const fullname = document.getElementById("fullname").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!fullname || !email || !phone) {
    ccToast("Please fill in your name, email, and phone number.", "error");
    return;
  }

  // Already authenticated (e.g. via Google) — nothing to create, just continue.
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

  const { error } = signupMethod === "phone"
    ? await ccSignUpWithPhone(phone, password, "worker", fullname)
    : await ccSignUpWithEmail(email, password, "worker", fullname);

  if (error) {
    ccToast(error.message, "error");
    btn.disabled = false;
    btn.textContent = "Continue";
    return;
  }

  document.getElementById("otpLabel").textContent =
    `Enter the 6-digit code we sent to your ${signupMethod === "phone" ? "phone" : "email"}`;
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
  const phone = document.getElementById("phone").value.trim();

  if (_awaitingEmailLink) {
    const { error } = await ccVerifyEmailChangeOtp(email, token);
    if (error) { ccToast(error.message, "error"); return; }
    revealStage2();
    return;
  }

  const { error } = signupMethod === "phone"
    ? await ccVerifySignupPhoneOtp(phone, token)
    : await ccVerifySignupEmailOtp(email, token);

  if (error) {
    ccToast(error.message, "error");
    return;
  }

  if (signupMethod === "phone") {
    const { error: linkErr } = await ccLinkEmail(email);
    if (linkErr) { ccToast(linkErr.message, "error"); return; }
    _awaitingEmailLink = true;
    document.getElementById("otpLabel").textContent = "Enter the 6-digit code we sent to your email";
    document.getElementById("otpCode").value = "";
    return;
  }

  revealStage2();
}

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
    }
    // Any existing session means account creation (stage 1) is already
    // done — whether via Google or a prior email/phone signup — so skip
    // straight to the profile fields.
    document.getElementById("stage1Fields").style.display = "none";
    document.getElementById("stage2Fields").style.display = "block";
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

  const btn = this.querySelector(".btn-submit");
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
      // Whichever contact method wasn't used to sign up still needs
      // verifying before the account is usable at all.
      window.location.href = "verify-contact.html";
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
