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

// Does this account already have a facility profile row? An account can exist
// in auth without ever having completed the profile step that inserts it —
// don't bounce those people to the dashboard (they can't create it there).
async function facilityProfileExists(email) {
  try {
    const { data } = await ccFetch("/facility/by-email", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    return !!(data && data.success);
  } catch (_) {
    return false;
  }
}

let _routeGuard = false;

async function routeSignedInFacility(session) {
  if (_routeGuard) return;
  _routeGuard = true;
  if (await facilityProfileExists(session.user.email)) {
    window.location.href = "dashboard-facility.html";
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
    routeSignedInFacility(session);
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
    await routeSignedInFacility(session);
  } else {
    document.getElementById("regFields").style.display = "block";
  }
})();

// ── Stage 1: account creation (email + password, or Google/Apple) ──
// Phone OTP is deferred (see CC_CONFIG.REQUIRE_PHONE_VERIFICATION), so signup
// is email + password or an OAuth provider — no "phone or email" branch. The
// phone number is still required, collected in the profile step below, and
// saved; it just isn't OTP-verified yet. Document upload happens later from
// the dashboard's Verification & Documents tab.
function revealStage2() {
  document.getElementById("stage1Fields").style.display = "none";
  document.getElementById("stage2Fields").style.display = "block";
}

async function startPrimarySignup() {
  const contactName = document.getElementById("contactName").value.trim();
  const email = document.getElementById("email").value.trim();

  if (!contactName || !email) {
    ccToast("Please fill in the contact name and email.", "error");
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

  const { error } = await ccSignUpWithEmail(email, password, "facility", contactName);
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

  const btn = e.submitter || this.querySelector('[type="submit"]');
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
      // Email verified in the account step; phone verification deferred.
      window.location.href = "dashboard-facility.html";
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
