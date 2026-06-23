const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

let currentWorker = null;

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
  await loadMyShifts();
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

  currentWorker = data;

  if (!data.identity_verified) {
    const quickActions = document.getElementById("quickActions");
    const verifyBtn = document.createElement("a");
    verifyBtn.href = "identity-verify.html";
    verifyBtn.className = "btn-primary-sm";
    verifyBtn.style = "background:#f4faf8; color:#0F6E56; border:1px solid #9FE1CB;";
    verifyBtn.textContent = "Verify my identity";
    quickActions.appendChild(verifyBtn);
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

  const container = document.getElementById("shiftsContainer");

  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No shifts available in your area right now.</p>
        <p style="font-size:13px;">We'll notify you when new shifts are posted near you.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(shift => `
    <div class="profile-card" style="margin-bottom:12px;">
      <div class="profile-avatar" style="background:rgba(93,202,165,0.1); font-size:14px;">
        ${shift.role_needed ? shift.role_needed.substring(0, 2).toUpperCase() : "SH"}
      </div>
      <div class="profile-info" style="flex:1;">
        <h3>${escapeHtml(shift.facility_name)}</h3>
        <p>${escapeHtml(shift.role_needed)} · ${escapeHtml(shift.city)}</p>
        <p>${escapeHtml(shift.shift_date)} · ${escapeHtml(shift.start_time)} · ${escapeHtml(shift.duration)}</p>
        <p style="color:#5DCAA5; font-weight:500;">${escapeHtml(shift.pay_rate)}</p>
        <div style="margin-top:8px;">
          <span class="badge badge-green">${shift.urgency === "today" ? "🔴 Urgent" : "Open"}</span>
        </div>
      </div>
      <div>
        <button
          onclick="acceptShift('${shift.id}', this)"
          class="btn-primary-sm"
          style="font-size:13px; padding:8px 16px;">
          Accept
        </button>
      </div>
    </div>
  `).join("");
}

async function loadMyShifts() {
  if (!currentWorker) return;

  const { data, error } = await _supabase
    .from("shifts")
    .select("*")
    .eq("worker_id", currentWorker.id)
    .in("status", ["accepted", "in_progress"])
    .order("shift_date", { ascending: true });

  const container = document.getElementById("myShiftsContainer");
  const completedRes = await _supabase
    .from("shifts")
    .select("total_pay")
    .eq("worker_id", currentWorker.id)
    .eq("status", "completed");

  const completed = completedRes.data || [];
  document.getElementById("totalShifts").textContent = completed.length;

  const totalEarnings = completed.reduce((sum, s) => {
    const amount = parseFloat((s.total_pay || "").replace(/[^0-9.]/g, "")) || 0;
    return sum + amount;
  }, 0);
  document.getElementById("totalEarnings").textContent =
    `GHS ${totalEarnings.toLocaleString()}`;

  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No active shifts. Accept a shift above to get your QR check-in code.</p>
      </div>
    `;
    return;
  }

  const shiftsWithTokens = await Promise.all(
    data.map(async (shift) => {
      if (shift.qr_token) return shift;
      const token = await ensureQrToken(shift.id);
      return token ? { ...shift, qr_token: token } : shift;
    })
  );

  container.innerHTML = shiftsWithTokens.map(shift => {
    const qrUrl = getArriveUrl(shift.id, currentWorker.id, shift.qr_token);
    const statusBadge = shift.status === "in_progress"
      ? `<span class="badge badge-green">In progress</span>`
      : `<span class="badge badge-yellow">Accepted — show QR on arrival</span>`;

    const qrContent = shift.qr_token
      ? `<img id="qr-${shift.id}" class="qr-image" width="200" height="200" alt="Shift check-in QR code" />`
      : `<p class="qr-display-label" style="color:#E24B4A;">QR code unavailable — refresh the page or contact support.</p>`;

    return `
      <div class="qr-card" id="shift-card-${shift.id}">
        <div class="qr-card-header">
          <div>
            <h3>${escapeHtml(shift.facility_name)}</h3>
            <p>${escapeHtml(shift.role_needed)} · ${escapeHtml(shift.shift_date)} · ${escapeHtml(shift.start_time)}</p>
            <p style="color:#5DCAA5; margin-top:4px;">${escapeHtml(shift.total_pay || shift.pay_rate)}</p>
          </div>
          <div>${statusBadge}</div>
        </div>
        <div class="qr-display">
          ${qrContent}
          <p class="qr-display-label">Show this QR code when you arrive at the facility</p>
        </div>
        ${shift.status === "in_progress" && shift.qr_token ? `
          <div style="margin-top:12px; text-align:center;">
            <a href="${qrUrl}" class="btn-primary-sm">Check out when shift ends</a>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  await Promise.all(
    shiftsWithTokens
      .filter(shift => shift.qr_token)
      .map(shift => {
        const qrUrl = getArriveUrl(shift.id, currentWorker.id, shift.qr_token);
        return renderQrImage(`qr-${shift.id}`, qrUrl);
      })
  );
}

async function ensureQrToken(shiftId) {
  try {
    const { data } = await ccFetch("/shift/accept", {
      method: "POST",
      body: JSON.stringify({
        shift_id: shiftId,
        worker_id: currentWorker.id
      })
    });
    return data.success ? data.qr_token : null;
  } catch (err) {
    console.error("Ensure QR token error:", err);
    return null;
  }
}

async function renderQrImage(imgId, url) {
  const img = document.getElementById(imgId);
  if (!img || !url) return;

  try {
    if (typeof QRCode !== "undefined") {
      img.src = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: { dark: "#0a1628", light: "#ffffff" }
      });
      return;
    }
  } catch (err) {
    console.error("QRCode render error:", err);
  }

  img.src =
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
}

function buildQrUrl(shiftId, workerId, token) {
  return getArriveUrl(shiftId, workerId, token);
}

async function acceptShift(shiftId, btn) {
  if (!currentWorker) {
    alert("Please complete your profile before accepting shifts.");
    return;
  }

  if (!btn) btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Accepting...";
  }

  try {
    const { data: result } = await ccFetch("/shift/accept", {
      method: "POST",
      body: JSON.stringify({
        shift_id: shiftId,
        worker_id: currentWorker.id
      })
    });

    if (!result.success) {
      alert(result.message || "Could not accept shift. Please try again.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Accept";
      }
      return;
    }

    await loadShifts();
    await loadMyShifts();

    const card = document.getElementById(`shift-card-${shiftId}`);
    if (card) card.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    console.error("Accept error:", err);
    alert("Something went wrong. Please try again.");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Accept";
    }
  }
}

async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}

init();
