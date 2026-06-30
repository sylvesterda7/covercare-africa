const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
ccInitInactivityLogout(_supabase);
let currentWorker = null;

/* ── Sidebar ── */
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

/* ── Tabs ── */
function switchFinTab(tab) {
  ["wallet","methods","transactions"].forEach(t => {
    document.getElementById("finTab" + t.charAt(0).toUpperCase() + t.slice(1)).style.color = t === tab ? "#5DCAA5" : "rgba(255,255,255,0.4)";
    document.getElementById("fin" + t.charAt(0).toUpperCase() + t.slice(1) + "Tab").style.display = t === tab ? "block" : "none";
  });
  if (tab === "wallet") loadWallet();
  if (tab === "methods") loadFinanceProfile();
  if (tab === "transactions") loadFinanceTransactions();
}

/* ── Init ── */
async function init() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }
  const meta = session.user.user_metadata;
  document.getElementById("navUser").textContent = meta.full_name || session.user.email;
  await loadWorkerProfile(session.user.email);
  loadWallet();
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
}

/* ══════════════════════════════════════════════
   WALLET
   ══════════════════════════════════════════════ */
async function loadWallet() {
  try {
    const { data: result } = await ccFetch("/finance/wallet", { method: "GET" });
    if (!result?.success) return;
    const w = result.data;
    document.getElementById("walletAvailable").textContent = formatCurrency(w.available_balance);
    document.getElementById("walletTotalEarned").textContent = formatCurrency(w.total_earned);
    document.getElementById("walletAutoPaid").textContent = formatCurrency(w.auto_paid);
    document.getElementById("walletPending").textContent = formatCurrency(w.pending_requests);
    document.getElementById("walletPayoutsPaid").textContent = formatCurrency(w.payout_requests_paid);
  } catch (e) { console.error("Wallet error:", e); }
  loadPayoutHistory();
}

async function loadPayoutHistory() {
  const container = document.getElementById("payoutHistoryList");
  try {
    const { data: result } = await ccFetch("/finance/payout/history", { method: "GET" });
    if (!result?.success || !result.data?.length) {
      container.innerHTML = '<div class="empty-state"><p>No payout requests yet.</p></div>';
      return;
    }
    container.innerHTML = result.data.map(p => {
      const statusColor = p.status === "completed" ? "#5DCAA5" : p.status === "failed" ? "#E24B4A" : p.status === "processing" ? "#F0B429" : "rgba(255,255,255,0.3)";
      const methodLabel = p.method === "bank" ? "Bank" : "Mobile Money";
      const methodDetail = p.method === "bank" ? p.bank_name + " · " + p.bank_account_number : p.momo_provider + " · " + p.momo_number;
      return `<div style="display:flex; align-items:center; gap:12px; padding:14px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
        <div style="flex:1;">
          <p style="font-size:14px; font-weight:500; color:#fff; margin:0;">${methodLabel} withdrawal</p>
          <p style="font-size:12px; color:rgba(255,255,255,0.3); margin:2px 0 0;">${methodDetail} · ${new Date(p.created_at).toLocaleDateString()}</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:15px; font-weight:600; color:#fff; margin:0;">${formatCurrency(p.amount)}</p>
          <span style="font-size:11px; color:${statusColor};">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
        </div>
      </div>`;
    }).join("");
  } catch (e) { console.error("Payout history error:", e); container.innerHTML = '<div class="empty-state"><p>Failed to load.</p></div>'; }
}

/* ── Payout modal ── */
function openPayoutModal() {
  document.getElementById("payoutModal").style.display = "flex";
  document.getElementById("payoutModalMsg").style.display = "none";
  document.getElementById("payoutAmount").value = "";
  document.getElementById("payoutMethod").value = "momo";
  updatePayoutMethodInfo();
}

function closePayoutModal() {
  document.getElementById("payoutModal").style.display = "none";
}

function updatePayoutMethodInfo() {
  const method = document.getElementById("payoutMethod").value;
  const info = document.getElementById("payoutMethodInfo");
  if (method === "momo") {
    const prov = currentWorker?.momo_provider || "—";
    const num = currentWorker?.momo_number || "—";
    info.textContent = prov && num ? `Receiving via ${prov} · ${num}` : "No Mobile Money details saved. Set up in Payment Methods first.";
  } else {
    const bank = currentWorker?.bank_name || "—";
    const acct = currentWorker?.bank_account_number || "—";
    info.textContent = bank && acct ? `Receiving via ${bank} · ${acct}` : "No bank details saved. Set up in Payment Methods first.";
  }
}

document.getElementById("payoutMethod")?.addEventListener("change", updatePayoutMethodInfo);

async function submitPayoutRequest() {
  const btn = document.getElementById("submitPayoutBtn");
  const msg = document.getElementById("payoutModalMsg");
  const amount = parseFloat(document.getElementById("payoutAmount").value);
  const method = document.getElementById("payoutMethod").value;
  msg.style.display = "none";
  if (!amount || amount <= 0) { msg.style.display = "block"; msg.style.color = "#E24B4A"; msg.textContent = "Enter a valid amount."; return; }
  if (!currentWorker) { msg.style.display = "block"; msg.style.color = "#E24B4A"; msg.textContent = "Profile not loaded."; return; }
  btn.disabled = true; btn.textContent = "Submitting...";
  try {
    const { data: result } = await ccFetch("/finance/payout/request", {
      method: "POST",
      body: JSON.stringify({ amount, method })
    });
    msg.style.display = "block";
    if (result.success) {
      msg.style.color = "#5DCAA5"; msg.textContent = result.message || "Payout request submitted!";
      closePayoutModal();
      loadWallet();
    } else {
      msg.style.color = "#E24B4A"; msg.textContent = result.message || "Failed to submit.";
    }
  } catch (e) {
    msg.style.display = "block"; msg.style.color = "#E24B4A"; msg.textContent = "Something went wrong.";
  }
  btn.disabled = false; btn.textContent = "Request payout";
}

/* ══════════════════════════════════════════════
   PAYMENT METHODS
   ══════════════════════════════════════════════ */
async function loadFinanceProfile() {
  try {
    const { data: result } = await ccFetch("/finance/worker/profile", { method: "GET" });
    if (!result?.success || !result.data) return;
    document.getElementById("finBankName").value = result.data.bank_name || "";
    document.getElementById("finBankAccount").value = result.data.bank_account_number || "";
    document.getElementById("finBankAccountName").value = result.data.bank_account_name || "";
    document.getElementById("finMomoProvider").value = result.data.momo_provider || "";
    document.getElementById("finMomoNumber").value = result.data.momo_number || "";
  } catch (e) { console.error("Finance profile load error:", e); }
}

document.getElementById("financeForm")?.addEventListener("submit", async function(e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  const msg = document.getElementById("finSaveMsg");
  btn.disabled = true; btn.textContent = "Saving..."; msg.style.display = "none";
  try {
    const { data: result } = await ccFetch("/finance/worker/profile", {
      method: "POST",
      body: JSON.stringify({
        bank_name: document.getElementById("finBankName").value.trim(),
        bank_account_number: document.getElementById("finBankAccount").value.trim(),
        bank_account_name: document.getElementById("finBankAccountName").value.trim(),
        momo_provider: document.getElementById("finMomoProvider").value,
        momo_number: document.getElementById("finMomoNumber").value.trim()
      })
    });
    msg.style.display = "block";
    if (result.success) { msg.style.color = "#5DCAA5"; msg.textContent = "Payment methods saved!"; }
    else { msg.style.color = "#E24B4A"; msg.textContent = result.message || "Failed to save."; }
  } catch (e) {
    msg.style.display = "block"; msg.style.color = "#E24B4A"; msg.textContent = "Something went wrong.";
  }
  btn.disabled = false; btn.textContent = "Save payout details";
});

/* ══════════════════════════════════════════════
   TRANSACTIONS
   ══════════════════════════════════════════════ */
async function loadFinanceTransactions() {
  const container = document.getElementById("finTransactionsList");
  container.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  try {
    const { data: result } = await ccFetch("/finance/worker/transactions", { method: "GET" });
    if (!result?.success) { container.innerHTML = '<div class="empty-state"><p>Failed to load transactions.</p></div>'; return; }
    const d = result.data;
    const total = d.total || 0;
    document.getElementById("finStatsRow").innerHTML = `
      <div class="stat-box"><div class="num" style="color:#5DCAA5;">${formatCurrency(total)}</div><div class="label">Total earned</div></div>
      <div class="stat-box"><div class="num">${d.transactions.length}</div><div class="label">Completed shifts</div></div>
    `;
    const chartEl = document.getElementById("finChart");
    const monthly = d.monthly || {};
    const keys = Object.keys(monthly).sort();
    const maxVal = Math.max(...Object.values(monthly), 1);
    chartEl.innerHTML = keys.map(key => {
      const val = monthly[key] || 0;
      const pct = Math.max((val / maxVal) * 100, 4);
      const label = new Date(key + "-01").toLocaleDateString("en", { month: "short", year: "numeric" });
      return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; justify-content:flex-end;">
        <span style="font-size:10px; color:rgba(255,255,255,0.35); font-weight:500;">${val ? formatCurrency(val) : ""}</span>
        <div style="width:100%; max-width:56px; height:${pct}%; background:linear-gradient(180deg,#5DCAA5,rgba(93,202,165,0.15)); border-radius:6px 6px 0 0; transition:height 0.5s; box-shadow:0 0 12px rgba(93,202,165,0.15);"></div>
        <span style="font-size:10px; color:rgba(255,255,255,0.25); white-space:nowrap;">${label}</span>
      </div>`;
    }).join("");
    if (d.transactions.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No completed shifts yet.</p></div>';
      return;
    }
    container.innerHTML = d.transactions.map(t => {
      const statusColor = t.payout_status === "paid" ? "#5DCAA5" : t.payout_status === "failed" ? "#E24B4A" : "#F0B429";
      const statusLabel = t.payout_status === "paid" ? "Paid" : t.payout_status === "failed" ? "Failed" : "Pending";
      return `<div style="display:flex; align-items:center; gap:12px; padding:14px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
        <div style="flex:1;">
          <p style="font-size:14px; font-weight:500; color:#fff; margin:0;">${escapeHtml(t.facility_name)}</p>
          <p style="font-size:12px; color:rgba(255,255,255,0.3); margin:2px 0 0;">${escapeHtml(t.role_needed)} · ${t.shift_date || "—"}</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:15px; font-weight:600; color:#5DCAA5; margin:0;">${formatCurrency(t.amount)}</p>
          <span style="font-size:11px; color:${statusColor};">${statusLabel}</span>
        </div>
      </div>`;
    }).join("");
  } catch (e) { console.error("Finance transactions error:", e); container.innerHTML = '<div class="empty-state"><p>Failed to load.</p></div>'; }
}

async function logout() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}