File 9 — dashboard-facility.js
Click on dashboard-facility.js and paste this in:
javascript// ── Initialize Supabase ──
const SUPABASE_URL = "https://ifmpbrpcnnswqlwdytfy.supabase.co";
const SUPABASE_KEY = "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Check session ──
async function init() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const user = session.user;
  const meta = user.user_metadata;

  // ── Check user type ──
  if (meta.user_type === "worker") {
    window.location.href = "dashboard-worker.html";
    return;
  }

  // ── Populate nav ──
  document.getElementById("navUser").textContent = meta.full_name || user.email;

  // ── Welcome message ──
  const firstName = meta.full_name ? meta.full_name.split(" ")[0] : "there";
  document.getElementById("welcomeMsg").textContent = `Welcome back, ${firstName}`;

  // ── Load shifts ──
  await loadShifts(user.email);
}

// ── Load facility shifts ──
async function loadShifts(email) {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("contact_email", email)
    .order("created_at", { ascending: false });

  if (error || !data) return;

  const openShifts = data.filter(s => s.status === "open");
  const filledShifts = data.filter(s => s.status === "accepted");

  // ── Update stats ──
  document.getElementById("totalShifts").textContent = data.length;
  document.getElementById("openShifts").textContent = openShifts.length;
  document.getElementById("filledShifts").textContent = filledShifts.length;

  // ── Calculate total spend ──
  const totalSpend = filledShifts.reduce((sum, shift) => {
    const amount = parseFloat(
      shift.total_pay.replace("GHS ", "").replace(",", "")
    ) || 0;
    return sum + amount;
  }, 0);
  document.getElementById("totalSpend").textContent =
    "GHS " + totalSpend.toLocaleString();

  // ── Render open shifts ──
  const openContainer = document.getElementById("openShiftsContainer");
  if (openShifts.length > 0) {
    openContainer.innerHTML = openShifts.map(shift => `
      <div class="profile-card" style="margin-bottom:12px;">
        <div class="profile-avatar" style="background:#E1F5EE; font-size:14px;">
          ${shift.role_needed ? shift.role_needed.substring(0, 2).toUpperCase() : "SH"}
        </div>
        <div class="profile-info" style="flex:1;">
          <h3>${shift.role_needed}</h3>
          <p>${shift.shift_date} · ${shift.start_time} · ${shift.duration}</p>
          <p style="color:#0F6E56; font-weight:500;">${shift.pay_rate}</p>
          <div style="margin-top:8px;">
            <span class="badge badge-yellow">Awaiting match</span>
          </div>
        </div>
        <div>
          <button
            onclick="cancelShift('${shift.id}')"
            style="background:transparent; border:1px solid #fca5a5; color:#b91c1c; padding:7px 14px; border-radius:8px; font-size:13px; cursor:pointer;">
            Cancel
          </button>
        </div>
      </div>
    `).join("");
  }

  // ── Render filled shifts ──
  const filledContainer = document.getElementById("filledShiftsContainer");
  if (filledShifts.length > 0) {
    filledContainer.innerHTML = filledShifts.map(shift => `
      <div class="profile-card" style="margin-bottom:12px;">
        <div class="profile-avatar" style="background:#E1F5EE; font-size:14px;">
          ${shift.role_needed ? shift.role_needed.substring(0, 2).toUpperCase() : "SH"}
        </div>
        <div class="profile-info" style="flex:1;">
          <h3>${shift.role_needed}</h3>
          <p>${shift.shift_date} · ${shift.start_time} · ${shift.duration}</p>
          <p style="color:#0F6E56; font-weight:500;">${shift.total_pay}</p>
          <div style="margin-top:8px;">
            <span class="badge badge-green">✓ Filled</span>
          </div>
        </div>
      </div>
    `).join("");
  }
}

// ── Cancel shift ──
async function cancelShift(shiftId) {
  if (!confirm("Are you sure you want to cancel this shift?")) return;

  const { error } = await supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", shiftId);

  if (error) {
    alert("Could not cancel shift. Please try again.");
    return;
  }

  alert("Shift cancelled.");
  const { data: { session } } = await supabase.auth.getSession();
  loadShifts(session.user.email);
}

// ── Logout ──
async function logout() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}

// ── Run ──
init();