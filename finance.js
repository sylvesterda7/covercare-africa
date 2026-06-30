const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
ccInitInactivityLogout(_supabase);

async function init() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }
  const meta = session.user.user_metadata;
  document.getElementById("navUser").textContent = meta.full_name || session.user.email;
  loadFinanceProfile();
}
init();

function switchFinTab(tab) {
  document.getElementById("finMethodsTab").style.display = tab === "methods" ? "block" : "none";
  document.getElementById("finTransactionsTab").style.display = tab === "transactions" ? "block" : "none";
  const methodsBtn = document.getElementById("finTabMethods");
  const txBtn = document.getElementById("finTabTransactions");
  methodsBtn.style.color = tab === "methods" ? "#5DCAA5" : "rgba(255,255,255,0.4)";
  methodsBtn.style.fontWeight = tab === "methods" ? "600" : "500";
  txBtn.style.color = tab === "transactions" ? "#5DCAA5" : "rgba(255,255,255,0.4)";
  txBtn.style.fontWeight = tab === "transactions" ? "600" : "500";
  if (tab === "transactions") loadFinanceTransactions();
}

async function loadFinanceProfile() {
  try {
    const { data: result } = await ccFetch("/finance/worker/profile", { method: "GET" });
    if (result?.success && result.data) {
      const d = result.data;
      document.getElementById("finBankName").value = d.bank_name || "";
      document.getElementById("finBankAccount").value = d.bank_account_number || "";
      document.getElementById("finBankAccountName").value = d.bank_account_name || "";
      document.getElementById("finMomoProvider").value = d.momo_provider || "";
      document.getElementById("finMomoNumber").value = d.momo_number || "";
    }
  } catch (e) { console.error("Finance profile load error:", e); }
}

document.getElementById("financeForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const btn = document.getElementById("finSaveBtn");
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
    if (result?.success) {
      msg.style.color = "#5DCAA5";
      msg.textContent = "Payout details saved!";
    } else {
      msg.style.color = "#E24B4A";
      msg.textContent = result?.message || "Failed to save.";
    }
  } catch (e) {
    console.error("Finance save error:", e);
    msg.style.display = "block"; msg.style.color = "#E24B4A"; msg.textContent = "Something went wrong.";
  }
  btn.disabled = false; btn.textContent = "Save payout details";
});

async function loadFinanceTransactions() {
  const container = document.getElementById("finTransactionsList");
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  try {
    const { data: result } = await ccFetch("/finance/worker/transactions", { method: "GET" });
    if (!result?.success) { container.innerHTML = '<div class="empty-state"><p>Failed to load transactions.</p></div>'; return; }
    const d = result.data;
    const total = d.total || 0;
    document.getElementById("finStatsRow").innerHTML = `
      <div class="stat-box"><div class="num" style="color:#5DCAA5;">GHS ${total.toLocaleString()}</div><div class="label">Total earned</div></div>
      <div class="stat-box"><div class="num">${d.transactions.length}</div><div class="label">Completed shifts</div></div>
    `;
    const chartEl = document.getElementById("finChart");
    const monthly = d.monthly || {};
    const keys = Object.keys(monthly).sort();
    const maxVal = Math.max(...Object.values(monthly), 1);
    chartEl.innerHTML = keys.map(key => {
      const val = monthly[key] || 0;
      const pct = Math.max((val / maxVal) * 100, 2);
      const label = new Date(key + "-01").toLocaleDateString("en", { month: "short", year: "numeric" });
      return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; justify-content:flex-end;">
        <span style="font-size:10px; color:rgba(255,255,255,0.3);">${val ? "GHS" + val : ""}</span>
        <div style="width:100%; max-width:48px; height:${pct}%; background:linear-gradient(180deg,#5DCAA5,rgba(93,202,165,0.2)); border-radius:4px 4px 0 0; transition:height 0.4s;"></div>
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
      return `<div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
        <div style="flex:1;">
          <p style="font-size:14px; font-weight:500; color:#fff; margin:0;">${escapeHtml(t.facility_name)}</p>
          <p style="font-size:12px; color:rgba(255,255,255,0.3); margin:2px 0 0;">${escapeHtml(t.role_needed)} · ${t.shift_date || "—"}</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:15px; font-weight:600; color:#5DCAA5; margin:0;">GHS ${t.amount.toLocaleString()}</p>
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