// ── Shared wallet functions for facility & client dashboards ──

let _walletBalance = 0;

// ── Load wallet balance and update display ──
async function loadWalletBalance() {
  try {
    const res = await ccFetch("/wallet/balance", { method: "GET" });
    if (res?.data?.success && res.data.data) {
      _walletBalance = res.data.data.balance || 0;
    }
  } catch (e) {
    _walletBalance = 0;
  }
  updateWalletDisplay();
}

function updateWalletDisplay() {
  const el = document.getElementById("walletBalance");
  if (el) el.textContent = "GHS " + (_walletBalance || 0).toLocaleString();
  const el2 = document.getElementById("walletBalanceSection");
  if (el2) el2.textContent = "GHS " + (_walletBalance || 0).toLocaleString();
}

// ── Deposit modal ──
function openDepositModal() {
  document.getElementById("depositModal").style.display = "flex";
  document.getElementById("depositAmount").value = "";
  document.getElementById("depositError").textContent = "";
  document.getElementById("depositBtn").disabled = false;
  document.getElementById("depositBtn").textContent = "Deposit via Paystack";
}

function closeDepositModal() {
  document.getElementById("depositModal").style.display = "none";
}

async function processDeposit() {
  const amount = parseFloat(document.getElementById("depositAmount").value);
  if (!amount || amount < 10) {
    document.getElementById("depositError").textContent = "Minimum deposit is GHS 10.";
    return;
  }
  const btn = document.getElementById("depositBtn");
  btn.disabled = true;
  btn.textContent = "Initializing...";
  document.getElementById("depositError").textContent = "";

  try {
    const res = await ccFetch("/wallet/deposit", {
      method: "POST",
      body: JSON.stringify({ amount })
    });

    if (!res?.data?.success) {
      document.getElementById("depositError").textContent = res?.data?.message || "Deposit failed.";
      btn.disabled = false;
      btn.textContent = "Deposit via Paystack";
      return;
    }

    var handler = PaystackPop.setup({
      key: CC_CONFIG.PAYSTACK_PUBLIC_KEY,
      email: document.getElementById("navUser").textContent.includes("@") ? document.getElementById("navUser").textContent : "",
      amount: Math.round(amount * 100),
      currency: "GHS",
      ref: res.data.reference,
      label: "CoverCare Wallet Deposit",
      onClose: function() {
        btn.disabled = false;
        btn.textContent = "Deposit via Paystack";
      },
      callback: function(response) {
        ccFetch("/wallet/deposit/verify", {
          method: "POST",
          body: JSON.stringify({ reference: response.reference })
        }).then(function(verifyRes) {
          if (verifyRes?.data?.success) {
            ccToast("Deposit successful! GHS " + amount.toLocaleString() + " added.", "success");
            closeDepositModal();
            loadWalletBalance();
            if (typeof loadWalletTransactions === "function") loadWalletTransactions();
          } else {
            document.getElementById("depositError").textContent = "Verification failed. Contact support.";
          }
        }).catch(function() {
          document.getElementById("depositError").textContent = "Verification error. Contact support.";
        }).finally(function() {
          btn.disabled = false;
          btn.textContent = "Deposit via Paystack";
        });
      }
    });
    handler.openIframe();
  } catch (e) {
    document.getElementById("depositError").textContent = "Something went wrong.";
    btn.disabled = false;
    btn.textContent = "Deposit via Paystack";
  }
}

// ── Withdraw modal ──
function openWithdrawModal() {
  document.getElementById("withdrawModal").style.display = "flex";
  document.getElementById("withdrawAmount").value = "";
  document.getElementById("withdrawError").textContent = "";
  document.getElementById("withdrawSuccess").textContent = "";
  document.getElementById("withdrawBtn").disabled = false;
  document.getElementById("withdrawBtn").textContent = "Request withdrawal";
}

function closeWithdrawModal() {
  document.getElementById("withdrawModal").style.display = "none";
}

function toggleWithdrawMethod() {
  const method = document.querySelector('input[name="withdrawMethod"]:checked')?.value;
  document.getElementById("withdrawBankFields").style.display = method === "bank" ? "block" : "none";
  document.getElementById("withdrawMomoFields").style.display = method === "momo" ? "block" : "none";
}

async function processWithdraw() {
  const amount = parseFloat(document.getElementById("withdrawAmount").value);
  if (!amount || amount < 10) {
    document.getElementById("withdrawError").textContent = "Minimum withdrawal is GHS 10.";
    return;
  }
  if (amount > _walletBalance) {
    document.getElementById("withdrawError").textContent = "Insufficient balance.";
    return;
  }

  const method = document.querySelector('input[name="withdrawMethod"]:checked')?.value;
  if (!method) {
    document.getElementById("withdrawError").textContent = "Select a withdrawal method.";
    return;
  }

  const body = { amount };
  if (method === "bank") {
    body.bank_name = document.getElementById("wdBankName").value.trim();
    body.bank_account_number = document.getElementById("wdBankAccount").value.trim();
    body.bank_account_name = document.getElementById("wdBankAccountName").value.trim();
    if (!body.bank_name || !body.bank_account_number || !body.bank_account_name) {
      document.getElementById("withdrawError").textContent = "Fill all bank fields.";
      return;
    }
  } else {
    body.momo_provider = document.getElementById("wdMomoProvider").value;
    body.momo_number = document.getElementById("wdMomoNumber").value.trim();
    if (!body.momo_provider || !body.momo_number) {
      document.getElementById("withdrawError").textContent = "Fill all mobile money fields.";
      return;
    }
  }

  const btn = document.getElementById("withdrawBtn");
  btn.disabled = true;
  btn.textContent = "Submitting...";
  document.getElementById("withdrawError").textContent = "";

  try {
    const res = await ccFetch("/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify(body)
    });

    if (res?.data?.success) {
      document.getElementById("withdrawSuccess").textContent = "Withdrawal request submitted for admin approval.";
      document.getElementById("withdrawAmount").value = "";
      btn.textContent = "Request sent";
      ccToast("Withdrawal request submitted.", "success");
    } else {
      document.getElementById("withdrawError").textContent = res?.data?.message || "Failed to submit.";
      btn.disabled = false;
      btn.textContent = "Request withdrawal";
    }
  } catch (e) {
    document.getElementById("withdrawError").textContent = "Network error.";
    btn.disabled = false;
    btn.textContent = "Request withdrawal";
  }
}

// ── Load wallet transactions ──
async function loadWalletTransactions() {
  const container = document.getElementById("walletTransactions");
  if (!container) return;
  try {
    const res = await ccFetch("/wallet/transactions", { method: "GET" });
    const txns = res?.data?.data || [];
    if (!txns.length) {
      container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>No wallet transactions yet.</p></div>';
      return;
    }
    const typeLabels = { deposit: "Deposit", deduction: "Deduction", refund: "Refund", withdrawal: "Withdrawal", admin_credit: "Admin credit", admin_debit: "Admin debit" };
    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="admin-table">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance</th><th>Description</th></tr></thead>
          <tbody>
            ${txns.map(t => `<tr>
              <td style="color:var(--fg-muted);white-space:nowrap;">${t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
              <td><span style="font-size:13px;">${typeLabels[t.type] || t.type}</span></td>
              <td style="color:#111827;font-weight:500;">${["deposit","refund","admin_credit"].includes(t.type) ? "+" : "-"}GHS ${Number(t.amount).toLocaleString()}</td>
              <td>GHS ${Number(t.balance_after).toLocaleString()}</td>
              <td style="color:var(--fg-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.description || "")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><p>Could not load transactions.</p></div>';
  }
}
