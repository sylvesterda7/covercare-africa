const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
ccInitInactivityLogout(_supabase);
let currentWorker = null;

function toggleSidebar() {
  const sidebar = document.querySelector(".dashboard-sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const layout = document.querySelector(".dashboard-layout");
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle("open");
  sidebar.classList.toggle("closed", !isOpen);
  if (overlay) overlay.classList.toggle("show", isOpen);
  if (layout) layout.classList.toggle("sidebar-open", isOpen);
}

function scrollToSection(id) {
  document.getElementById("sec-" + id)?.scrollIntoView({ behavior: "smooth" });
}

async function init() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }
  const meta = session.user.user_metadata;
  document.getElementById("navUser").textContent = meta.full_name || session.user.email;
  document.getElementById("settingsEmail").textContent = session.user.email;
  const emailVerified = session.user.email_confirmed_at || session.user.identities?.[0]?.identity_data?.email_verified;
  document.getElementById("emailVerifiedBadge").textContent = emailVerified ? "Verified" : "Unverified";
  document.getElementById("emailVerifiedBadge").className = emailVerified ? "badge badge-green" : "badge badge-yellow";
  await loadWorkerProfile(session.user.email);
  loadNotifPrefs();
  loadCurrencyPref();
}
init();

async function loadWorkerProfile(email) {
  const { data, error } = await _supabase.from("workers").select("*").eq("email", email).single();
  if (error || !data) return;
  currentWorker = data;
  const avatarEl = document.getElementById("profileAvatar");
  if (data.profile_photo_url) {
    avatarEl.innerHTML = `<img src="${escapeHtml(data.profile_photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    avatarEl.style.background = "none"; avatarEl.style.border = "none";
  } else {
    const initials = data.full_name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    avatarEl.textContent = initials;
    avatarEl.style.background = ""; avatarEl.style.border = "";
  }
  document.getElementById("profileName").textContent = data.full_name;
  document.getElementById("profileRole").textContent = data.role;
  document.getElementById("profileCity").textContent = data.city;
  let badges = "";
  badges += data.license_verified ? '<span class="badge badge-green" style="margin-right:6px;">License verified</span>' : '<span class="badge badge-yellow" style="margin-right:6px;">License pending</span>';
  badges += data.identity_verified ? '<span class="badge badge-green">Identity verified</span>' : '<span class="badge badge-yellow">Identity pending</span>';
  document.getElementById("profileBadges").innerHTML = badges;

  // Fill form
  document.getElementById("settingsFullname").value = data.full_name || "";
  document.getElementById("settingsPhone").value = data.phone || "";
  document.getElementById("settingsRole").value = data.role || "";
  document.getElementById("settingsLicense").value = data.license_number || "";
  document.getElementById("settingsCity").value = data.city || "";
  document.getElementById("settingsExperience").value = data.experience || "";
  const preview = document.getElementById("settingsPhotoPreview");
  if (data.profile_photo_url) {
    preview.src = data.profile_photo_url;
    preview.style.display = "block";
  }
  document.getElementById("settingsAvailBtn").checked = true;
}

// ── Photo preview ──
document.getElementById("settingsPhoto")?.addEventListener("change", function() {
  const file = this.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById("settingsPhotoPreview");
    preview.src = e.target.result;
    preview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

// ── Save profile ──
document.getElementById("settingsProfileForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  const msg = document.getElementById("settingsProfileMsg");
  btn.disabled = true; btn.textContent = "Saving..."; msg.style.display = "none";

  const fileInput = document.getElementById("settingsPhoto");
  let profilePhotoUrl = currentWorker?.profile_photo_url || null;
  if (fileInput?.files?.[0]) {
    try {
      const { data: photoResult } = await ccFetch("/api/upload", {
        method: "POST",
        body: JSON.stringify({
          image: await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(fileInput.files[0]);
          }),
          folder: "worker-photos"
        })
      });
      if (photoResult?.success) profilePhotoUrl = photoResult.url;
    } catch (e) { console.error("Photo upload error:", e); }
  }

  try {
    const { data: result } = await ccFetch("/worker", {
      method: "PUT",
      body: JSON.stringify({
        full_name: document.getElementById("settingsFullname").value.trim(),
        phone: document.getElementById("settingsPhone").value.trim(),
        role: document.getElementById("settingsRole").value,
        license_number: document.getElementById("settingsLicense").value.trim(),
        city: document.getElementById("settingsCity").value,
        experience: document.getElementById("settingsExperience").value,
        profile_photo_url: profilePhotoUrl
      })
    });
    msg.style.display = "block";
    if (result.success) {
      msg.style.color = "#5DCAA5"; msg.textContent = "Profile saved!";
      const { data: { session } } = await _supabase.auth.getSession();
      if (session) await loadWorkerProfile(session.user.email);
    } else {
      msg.style.color = "#E24B4A"; msg.textContent = result.message || "Failed to save.";
    }
  } catch (e) {
    console.error("Profile save error:", e);
    msg.style.display = "block"; msg.style.color = "#E24B4A"; msg.textContent = "Something went wrong.";
  }
  btn.disabled = false; btn.textContent = "Save profile";
});

// ── Change password ──
document.getElementById("settingsPasswordForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const msg = document.getElementById("settingsPasswordMsg");
  const btn = this.querySelector('button[type="submit"]');
  const newPass = document.getElementById("settingsNewPassword").value;
  const confirmPass = document.getElementById("settingsConfirmPassword").value;
  msg.style.display = "none";
  if (!newPass || newPass.length < 8) { msg.style.display = "block"; msg.style.color = "#E24B4A"; msg.textContent = "Password must be at least 8 characters."; return; }
  if (newPass !== confirmPass) { msg.style.display = "block"; msg.style.color = "#E24B4A"; msg.textContent = "Passwords do not match."; return; }
  btn.disabled = true; btn.textContent = "Updating...";
  try {
    const { error } = await _supabase.auth.updateUser({ password: newPass });
    msg.style.display = "block";
    if (error) { msg.style.color = "#E24B4A"; msg.textContent = error.message; }
    else { msg.style.color = "#5DCAA5"; msg.textContent = "Password updated!"; document.getElementById("settingsNewPassword").value = ""; document.getElementById("settingsConfirmPassword").value = ""; }
  } catch (e) {
    msg.style.display = "block"; msg.style.color = "#E24B4A"; msg.textContent = "Something went wrong.";
  }
  btn.disabled = false; btn.textContent = "Update password";
});

// ── Notification preferences ──
function loadNotifPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem("cc_notif_prefs") || "{}");
    if (saved.shifts !== undefined) document.getElementById("notifShifts").checked = saved.shifts;
    if (saved.applications !== undefined) document.getElementById("notifApplications").checked = saved.applications;
    if (saved.payments !== undefined) document.getElementById("notifPayments").checked = saved.payments;
    if (saved.marketing !== undefined) document.getElementById("notifMarketing").checked = saved.marketing;
  } catch (e) {}
}

function saveNotifPrefs() {
  const prefs = {
    shifts: document.getElementById("notifShifts").checked,
    applications: document.getElementById("notifApplications").checked,
    payments: document.getElementById("notifPayments").checked,
    marketing: document.getElementById("notifMarketing").checked
  };
  localStorage.setItem("cc_notif_prefs", JSON.stringify(prefs));
  const msg = document.getElementById("settingsNotifMsg");
  msg.style.display = "block"; msg.style.color = "#5DCAA5"; msg.textContent = "Notification preferences saved!";
  setTimeout(() => msg.style.display = "none", 3000);
}

// ── Currency preference ──
function loadCurrencyPref() {
  const el = document.getElementById("settingsCurrency");
  if (el) el.value = getPreferredCurrency();
}

function saveCurrencyPref() {
  const el = document.getElementById("settingsCurrency");
  if (!el) return;
  localStorage.setItem("cc_currency", JSON.stringify(el.value));
  const msg = document.getElementById("settingsCurrencyMsg");
  msg.style.display = "block"; msg.style.color = "#5DCAA5"; msg.textContent = "Currency preference saved!";
  setTimeout(() => msg.style.display = "none", 3000);
}

// ── Availability ──
async function saveAvailability() {
  const msg = document.getElementById("settingsAvailMsg");
  const available = document.getElementById("settingsAvailBtn").checked;
  try {
    await ccFetch("/worker/availability", {
      method: "POST",
      body: JSON.stringify({ available })
    });
    msg.style.display = "block"; msg.style.color = "#5DCAA5"; msg.textContent = available ? "You're now available for shifts." : "You've been set as unavailable.";
    setTimeout(() => msg.style.display = "none", 3000);
  } catch (e) {
    msg.style.display = "block"; msg.style.color = "#E24B4A"; msg.textContent = "Failed to update.";
  }
}

// ── Delete account ──
async function confirmDeleteAccount() {
  if (!confirm("Permanently delete your account and all data? This cannot be undone.")) return;
  const email = prompt("Type your email to confirm deletion:");
  if (!email) return;
  try {
    const { data: result } = await ccFetch("/account/delete", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    if (result.success) {
      await _supabase.auth.signOut();
      window.location.href = "index.html";
    } else {
      alert(result.message || "Could not delete account.");
    }
  } catch (e) {
    console.error("Delete error:", e);
    alert("Something went wrong.");
  }
}

async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}