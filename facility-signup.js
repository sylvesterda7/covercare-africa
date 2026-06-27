// ── Session check — show password fields if not authenticated ──
(async function() {
  const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    document.getElementById("regFields").style.display = "block";
  }
})();

document.getElementById("facilityForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const facility = {
    facilityName: document.getElementById("facilityName").value.trim(),
    facilityType: document.getElementById("facilityType").value,
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
    !facility.city ||
    !facility.contactName ||
    !facility.contactRole ||
    !facility.email ||
    !facility.phone ||
    !facility.staffNeeds ||
    !facility.frequency
  ) {
    alert("Please fill in all fields.");
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
      btn.textContent = "Request early access";
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      btn.disabled = false;
      btn.textContent = "Request early access";
      return;
    }

    const { data: signUpData, error: signUpError } = await _supabase.auth.signUp({
      email: facility.email,
      password,
      options: { data: { full_name: facility.contactName, user_type: "facility" } }
    });

    if (signUpError) {
      alert(signUpError.message);
      btn.disabled = false;
      btn.textContent = "Request early access";
      return;
    }

    // If email confirmation is required, stop here
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
      window.location.href = "dashboard-facility.html";
    } else {
      alert("Something went wrong. Please try again.");
      btn.disabled = false;
      btn.textContent = "Create facility account";
    }

  } catch (err) {
    console.error("Submit error:", err);
    alert("Something went wrong. Please try again.");
    btn.disabled = false;
    btn.textContent = "Create facility account";
  }
});