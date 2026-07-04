// ── Supabase client ──
const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

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
    document.getElementById("phone").placeholder = country.phonePrefix + " XX XXX XXXX";
  }
  document.getElementById("restOfForm").style.display = "block";
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

// ── Google / Apple sign-in ──
async function signUpWithGoogle() {
  const { error } = await _supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/facility-signup.html",
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
    options: { redirectTo: window.location.origin + "/facility-signup.html" }
  });
  if (error) ccToast(error.message, "error");
}

function applyGoogleProfile(session) {
  const meta = session.user.user_metadata;
  if (meta?.provider !== "google") return false;
  googleProfile = meta;
  const emailField = document.getElementById("email");
  document.getElementById("contactName").value = meta.full_name || meta.name || "";
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
    if (session.user.user_metadata?.user_type === "facility") {
      window.location.href = "dashboard-facility.html";
      return;
    }
    if (session.user.user_metadata?.provider === "google") {
      applyGoogleProfile(session);
    }
  }
});

// ── On-page session handler (redirect + page load) ──
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
    if (session.user.user_metadata?.user_type === "facility") {
      window.location.href = "dashboard-facility.html";
      return;
    }
    if (session.user.user_metadata?.provider === "google") {
      applyGoogleProfile(session);
    }
    // Any existing session means account creation (stage 1) is already done.
    document.getElementById("stage1Fields").style.display = "none";
    document.getElementById("stage2Fields").style.display = "block";
  } else {
    document.getElementById("regFields").style.display = "block";
  }
})();

// ── Stage 1: account creation with dual-channel signup ──
// Document upload now happens post-signup from the dashboard's
// Verification & Documents tab — signup is account creation only. See
// worker-signup.js for the full rationale on why a phone-primary signup
// must link+verify email inline here rather than deferring to
// verify-contact.html (the facilities table is keyed by email everywhere).
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
  const contactName = document.getElementById("contactName").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!contactName || !email || !phone) {
    ccToast("Please fill in the contact name, email, and phone number.", "error");
    return;
  }

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
    ? await ccSignUpWithPhone(phone, password, "facility", contactName)
    : await ccSignUpWithEmail(email, password, "facility", contactName);

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

// ── Form submission (stage 2 — facility profile; account already exists) ──
document.getElementById("facilityForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const facility = {
    facilityName: document.getElementById("facilityName").value.trim(),
    facilityType: document.getElementById("facilityType").value,
    country: document.getElementById("country").value,
    city: document.getElementById("city").value,
    contactName: document.getElementById("contactName").value.trim(),
    contactRole: document.getElementById("contactRole").value,
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    staffNeeds: document.getElementById("staffNeeds").value,
    frequency: document.getElementById("frequency").value,
  };

  if (
    !facility.facilityName ||
    !facility.facilityType ||
    !facility.country ||
    !facility.city ||
    !facility.contactName ||
    !facility.contactRole ||
    !facility.email ||
    !facility.phone ||
    !facility.staffNeeds ||
    !facility.frequency
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
  btn.textContent = "Saving...";

  try {
    const { response, data: result } = await ccFetch("/facility", {
      method: "POST",
      body: JSON.stringify({
        facility_name: facility.facilityName,
        facility_type: facility.facilityType,
        country: facility.country,
        city: facility.city,
        contact_name: facility.contactName,
        contact_role: facility.contactRole,
        email: facility.email,
        phone: facility.phone,
        staff_needs: facility.staffNeeds,
        frequency: facility.frequency
      })
    });

    console.log("Save result:", result);

    if (response.ok && result.success) {
      await _supabase.auth.updateUser({ data: { user_type: "facility" } }).catch(() => {});
      window.location.href = "verify-contact.html";
    } else {
      ccToast("Something went wrong. Please try again.", "error");
      btn.disabled = false;
      btn.textContent = "Create facility account";
    }

  } catch (err) {
    console.error("Submit error:", err);
    ccToast("Something went wrong. Please try again.", "error");
    btn.disabled = false;
    btn.textContent = "Create facility account";
  }
});
