const SUPABASE_URL = "https://ifmpbrpcnnswqlwdytfy.supabase.co";
const SUPABASE_KEY = "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB";
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function init() {
  const { data: { session } } = await _supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const user = session.user;
  const meta = user.user_metadata;

  if (meta.user_type !== "worker") {
    window.location.href = "dashboard-facility.html";
    return;
  }

  document.getElementById("navUser").textContent = meta.full_name || user.email;

  const firstName = meta.full_name ? meta.full_name.split(" ")[0] : "there";
  document.getElementById("welcomeMsg").textContent = `Welcome back, ${firstName}`;

  await loadProfile(user.email);
  await loadShifts();
}

async function loadProfile(email) {
  const { data, error } = await _supabase
    .from("workers")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !data) {
    document.getElementById("profileName").textContent = "Profile not set up yet";
    document.getElementById("profileRole").textContent = "Complete your profile to start working";
    document.getElementById("profileAvatar").textContent = "?";
    document.getElementById("profileBadges").innerHTML = `
      <span class="badge badge-yellow" style="margin-top:8px;">Profile incomplete</span>
    `;
    return;
  }

  const initials = data.full_name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  document.getElementById("profileAvatar").textContent = initials;
  document.getElementById("profileName").textContent = data.full_name;
  document.getElementById("profileRole").textContent = data.role;
  document.getElementById("profileCity").textContent = `📍 ${data.city}`;

  let badges = "";
  if (data.license_verified) {
    badges += `<span class="badge badge-green" style="margin-right:6px;">✓ License verified</span>`;
  } else {
    badges += `<span class="badge badge-yellow" style="margin-right:6px;">License pending</span>`;
  }
  if (data.identity_verified) {
    badges += `<span class="badge badge-green">✓ Identity verified</span>`;
  } else {
    badges += `<span class="badge badge-yellow">Identity pending</span>`;
  }
  document.getElementById("profileBadges").innerHTML = badges;
  document.getElementById("verifiedBadge").textContent =
    data.license_verified ? "✓" : "Pending";
}

async function loadShifts() {
  const { data, error } = await _supabase
    .from("shifts")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data || data.length === 0) return;

  const container = document.getElementById("shiftsContainer");
  container.innerHTML = data.map(shift => `
    <div class="profile-card" style="margin-bottom:12px;">
      <div class="profile-avatar" style="background:#E1F5EE; font-size:14px;">
        ${shift.role_needed ? shift.role_needed.substring(0, 2).toUpperCase() : "SH"}
      </div>
      <div class="profile-info" style="flex:1;">
        <h3>${shift.facility_name}</h3>
        <p>${shift.role_needed} · ${shift.city}</p>
        <p>${shift.shift_date} · ${shift.start_time} · ${shift.duration}</p>
        <p style="color:#0F6E56; font-weight:500;">${shift.pay_rate}</p>
        <div style="margin-top:8px;">
          <span class="badge badge-green">${shift.urgency === "today" ? "🔴 Urgent" : "Open"}</span>
        </div>
      </div>
      <div>
        <button
          onclick="acceptShift('${shift.id}')"
          class="btn-primary-sm"
          style="font-size:13px; padding:8px 16px;">
          Accept
        </button>
      </div>
    </div>
  `).join("");

  document.getElementById("totalShifts").textContent = data.length;
}

async function acceptShift(shiftId) {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) return;

  const { error } = await _supabase
    .from("shifts")
    .update({ status: "accepted" })
    .eq("id", shiftId);

  if (error) {
    alert("Could not accept shift. Please try again.");
    return;
  }

  alert("Shift accepted! The facility will be notified.");
  loadShifts();
}

async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}

init();