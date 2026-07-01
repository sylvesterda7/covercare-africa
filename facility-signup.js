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

// ── Google sign-in ──
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

function applyGoogleProfile(session) {
  const meta = session.user.user_metadata;
  if (meta?.provider !== "google") return false;
  googleProfile = meta;
  const emailField = document.getElementById("email");
  const nameField = document.getElementById("contactName");
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
    } else {
      document.getElementById("regFields").style.display = "none";
      document.getElementById("email").readOnly = true;
    }
  } else {
    document.getElementById("regFields").style.display = "block";
  }
})();

// ── Form submission ──
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
      btn.textContent = "Create facility account";
      return;
    }
    if (password !== confirmPassword) {
      ccToast("Passwords do not match.", "error");
      btn.disabled = false;
      btn.textContent = "Create facility account";
      return;
    }

    const { data: signUpData, error: signUpError } = await _supabase.auth.signUp({
      email: facility.email,
      password,
      options: { data: { full_name: facility.contactName, user_type: "facility" } }
    });

    if (signUpError) {
      ccToast(signUpError.message, "error");
      btn.disabled = false;
      btn.textContent = "Create facility account";
      return;
    }

    if (!signUpData.session) {
      document.getElementById("facilityForm").style.display = "none";
      document.getElementById("successCard").querySelector("h2").textContent = "Account created!";
      document.getElementById("successCard").querySelector("p").textContent =
        "Check your email to confirm your account, then sign in and complete your facility profile.";
      document.getElementById("successCard").style.display = "block";
      btn.disabled = false;
      btn.textContent = "Create facility account";
      return;
    }
  }

  // Step 2: Upload documents (optional)
  btn.textContent = "Uploading documents...";

  async function uploadFile(fileInput) {
    const file = fileInput?.files?.[0];
    if (!file) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async function(ev) {
        const { data: result } = await ccFetch("/api/upload", {
          method: "POST",
          body: JSON.stringify({ image: ev.target.result, folder: "facility-docs" })
        });
        resolve(result?.success ? result.url : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  const [incorporationDoc, hefraDoc, pharmacyDoc] = await Promise.all([
    uploadFile(document.getElementById("docIncorporation")),
    uploadFile(document.getElementById("docHefra")),
    uploadFile(document.getElementById("docPharmacy"))
  ]);

  // Step 3: Save profile
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
        frequency: facility.frequency,
        incorporation_doc_url: incorporationDoc,
        hefra_license_url: hefraDoc,
        pharmacy_council_url: pharmacyDoc
      })
    });

    console.log("Save result:", result);

    if (response.ok && result.success) {
      await _supabase.auth.updateUser({ data: { user_type: "facility" } }).catch(() => {});
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
