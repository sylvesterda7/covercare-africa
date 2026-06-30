/** Shared CoverCare Africa frontend configuration */
const CC_CONFIG = {
  SUPABASE_URL: "https://ifmpbrpcnnswqlwdytfy.supabase.co",
  SUPABASE_KEY: "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB",
  BACKEND_URL: "https://covercare-backend-production.up.railway.app",
  PAYSTACK_PUBLIC_KEY: "pk_test_866cbb9c537c7780cc05fa3d88c10fcd5e758d02",
  ADMIN_EMAILS: ["sdenyoh-abayateye@st.ug.edu.gh"],
  ARRIVE_BASE_URL: "https://covercare-africa.vercel.app/arrive",
  SUPPORTED_CURRENCIES: [
    { code: "GHS", symbol: "GH\u00a2", name: "Ghana Cedi", locale: "en-GH" },
    { code: "NGN", symbol: "\u20a6", name: "Nigerian Naira", locale: "en-NG" },
    { code: "ZAR", symbol: "R", name: "South African Rand", locale: "en-ZA" },
    { code: "KES", symbol: "KSh", name: "Kenyan Shilling", locale: "en-KE" },
    { code: "UGX", symbol: "USh", name: "Ugandan Shilling", locale: "en-UG" },
    { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling", locale: "en-TZ" },
    { code: "RWF", symbol: "FRw", name: "Rwandan Franc", locale: "en-RW" },
    { code: "XAF", symbol: "FCFA", name: "Central African CFA Franc", locale: "fr-CM" },
    { code: "XOF", symbol: "CFA", name: "West African CFA Franc", locale: "fr-SN" },
    { code: "EGP", symbol: "E\u00a3", name: "Egyptian Pound", locale: "ar-EG" },
    { code: "MAD", symbol: "DH", name: "Moroccan Dirham", locale: "ar-MA" },
    { code: "DZD", symbol: "DA", name: "Algerian Dinar", locale: "ar-DZ" },
    { code: "TND", symbol: "DT", name: "Tunisian Dinar", locale: "ar-TN" },
    { code: "SDG", symbol: "SDG", name: "Sudanese Pound", locale: "ar-SD" },
    { code: "ETB", symbol: "Br", name: "Ethiopian Birr", locale: "am-ET" },
    { code: "GNF", symbol: "GFr", name: "Guinean Franc", locale: "fr-GN" },
    { code: "MZN", symbol: "MT", name: "Mozambican Metical", locale: "pt-MZ" },
    { code: "AOA", symbol: "Kz", name: "Angolan Kwanza", locale: "pt-AO" },
    { code: "ZMW", symbol: "ZK", name: "Zambian Kwacha", locale: "en-ZM" },
    { code: "BWP", symbol: "P", name: "Botswana Pula", locale: "en-BW" },
    { code: "MWK", symbol: "MK", name: "Malawian Kwacha", locale: "en-MW" },
    { code: "NAD", symbol: "N$", name: "Namibian Dollar", locale: "en-NA" },
    { code: "ZWL", symbol: "ZW$", name: "Zimbabwean Dollar", locale: "en-ZW" },
    { code: "MUR", symbol: "Rs", name: "Mauritian Rupee", locale: "en-MU" },
    { code: "SCR", symbol: "SR", name: "Seychellois Rupee", locale: "en-SC" },
    { code: "CDF", symbol: "FC", name: "Congolese Franc", locale: "fr-CD" },
    { code: "BIF", symbol: "FBu", name: "Burundian Franc", locale: "fr-BI" },
    { code: "DJF", symbol: "FDj", name: "Djiboutian Franc", locale: "fr-DJ" },
    { code: "ERN", symbol: "Nkf", name: "Eritrean Nakfa", locale: "ti-ER" },
    { code: "SOS", symbol: "SOSh", name: "Somali Shilling", locale: "so-SO" },
    { code: "SLL", symbol: "Le", name: "Sierra Leonean Leone", locale: "en-SL" },
    { code: "LRD", symbol: "L$", name: "Liberian Dollar", locale: "en-LR" },
    { code: "GMD", symbol: "D", name: "Gambian Dalasi", locale: "en-GM" },
    { code: "MRU", symbol: "UM", name: "Mauritanian Ouguiya", locale: "ar-MR" },
    { code: "SSP", symbol: "SS\u00a3", name: "South Sudanese Pound", locale: "en-SS" },
    { code: "KMF", symbol: "CF", name: "Comorian Franc", locale: "fr-KM" },
    { code: "MGA", symbol: "Ar", name: "Malagasy Ariary", locale: "mg-MG" },
    { code: "CVE", symbol: "Esc", name: "Cape Verdean Escudo", locale: "pt-CV" },
    { code: "LSL", symbol: "L", name: "Lesotho Loti", locale: "en-LS" },
    { code: "SZL", symbol: "E", name: "Eswatini Lilangeni", locale: "en-SZ" },
    { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
    { code: "EUR", symbol: "\u20ac", name: "Euro", locale: "en-EU" },
    { code: "GBP", symbol: "\u00a3", name: "British Pound", locale: "en-GB" }
  ]
};

function getPreferredCurrency() {
  try {
    const saved = JSON.parse(localStorage.getItem("cc_currency") || "null");
    if (saved && CC_CONFIG.SUPPORTED_CURRENCIES.find(c => c.code === saved)) return saved;
  } catch (e) {}
  return "GHS";
}

function formatCurrency(amount) {
  const code = getPreferredCurrency();
  const cur = CC_CONFIG.SUPPORTED_CURRENCIES.find(c => c.code === code) || CC_CONFIG.SUPPORTED_CURRENCIES[0];
  return cur.symbol + " " + Number(amount).toLocaleString(cur.locale || "en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getArriveUrl(shiftId, workerId, token) {
  const base = window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
    ? `${window.location.origin}/arrive`
    : CC_CONFIG.ARRIVE_BASE_URL;
  const params = new URLSearchParams({
    shift_id: shiftId,
    worker_id: workerId,
    token
  });
  return `${base}?${params.toString()}`;
}

function getDashboardUrl(userType, email) {
  if (CC_CONFIG.ADMIN_EMAILS.includes(email)) return "admin.html";
  if (userType === "worker") return "dashboard-worker.html";
  return "dashboard-facility.html";
}

const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
const INACTIVITY_WARNING = 30 * 1000;
let _inactivityTimer = null;
let _warningTimer = null;
let _supabaseClient = null;

function ccInitInactivityLogout(supabaseClient) {
  _supabaseClient = supabaseClient;
  const events = ["mousemove", "click", "keydown", "scroll", "touchstart"];
  function resetTimer() {
    clearTimeout(_inactivityTimer);
    clearTimeout(_warningTimer);
    ccHideInactivityWarning();
    _inactivityTimer = setTimeout(ccShowInactivityWarning, INACTIVITY_TIMEOUT - INACTIVITY_WARNING);
    _warningTimer = setTimeout(ccForceLogout, INACTIVITY_TIMEOUT);
  }
  events.forEach(ev => document.addEventListener(ev, resetTimer, { passive: true }));
  resetTimer();
  window.addEventListener("beforeunload", function() {
    events.forEach(ev => document.removeEventListener(ev, resetTimer));
  });
}

function ccShowInactivityWarning() {
  const existing = document.getElementById("cc-inactivity-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "cc-inactivity-overlay";
  overlay.innerHTML = `
    <div style="position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);">
      <div style="background:#0C1B1D; border:1px solid rgba(93,202,165,0.2); border-radius:16px; padding:2.5rem; max-width:400px; width:90%; text-align:center;">
        <h3 style="color:#fff; font-size:18px; margin-bottom:0.75rem;">Session expiring</h3>
        <p style="color:rgba(255,255,255,0.5); font-size:14px; line-height:1.6; margin-bottom:1.5rem;">You've been inactive for a while. You'll be logged out in 30 seconds to protect your account.</p>
        <button onclick="ccStayLoggedIn()" style="background:#5DCAA5; color:#04342C; border:none; padding:11px 24px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit;">Stay logged in</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function ccHideInactivityWarning() {
  const el = document.getElementById("cc-inactivity-overlay");
  if (el) el.remove();
}

function ccStayLoggedIn() {
  clearTimeout(_inactivityTimer);
  clearTimeout(_warningTimer);
  ccHideInactivityWarning();
  _inactivityTimer = setTimeout(ccShowInactivityWarning, INACTIVITY_TIMEOUT - INACTIVITY_WARNING);
  _warningTimer = setTimeout(ccForceLogout, INACTIVITY_TIMEOUT);
}

async function ccForceLogout() {
  ccHideInactivityWarning();
  try {
    if (_supabaseClient) await _supabaseClient.auth.signOut();
  } catch (e) {}
  window.location.href = "login.html?expired=1";
}

async function ccFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  try {
    const client = window._supabase || (window.supabase && window.supabase.createClient(
      CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY
    ));
    if (client) {
      const { data: { session } } = await client.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    }
  } catch (e) {}
  const response = await fetch(`${CC_CONFIG.BACKEND_URL}${path}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && !data.message) {
    data.message = `Request failed (${response.status})`;
  }
  return { response, data };
}

/* ── Currency combobox ──
   Portals dropdown to body to avoid stacking-context clipping.
   Usage: ccCurrencyCombobox("containerId", "GHS", (code) => { ... })
*/
function ccCurrencyCombobox(containerId, selectedCode, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="cc-combobox-wrap">
      <input class="glass-input cc-combobox-input" type="text" placeholder="Type currency code or name..." autocomplete="off" value="${escapeHtml(selectedCode || "")}" />
      <svg class="cc-combobox-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
    </div>`;

  const input = container.querySelector(".cc-combobox-input");
  let open = false, focusedIdx = -1, filtered = [...CC_CONFIG.SUPPORTED_CURRENCIES];
  let dropdownEl = null;

  function close() {
    open = false; focusedIdx = -1;
    if (dropdownEl) { dropdownEl.remove(); dropdownEl = null; }
  }

  function openDropdown() {
    if (!input.value && !open) { open = true; render(); return; }
    if (!open) { open = true; render(); }
  }

  function position() {
    if (!dropdownEl || !open) return;
    const rect = input.getBoundingClientRect();
    dropdownEl.style.top = (rect.bottom + 4) + "px";
    dropdownEl.style.left = rect.left + "px";
    dropdownEl.style.width = rect.width + "px";
  }

  function render() {
    const val = input.value.toLowerCase();
    filtered = CC_CONFIG.SUPPORTED_CURRENCIES.filter(c =>
      c.code.toLowerCase().includes(val) ||
      c.name.toLowerCase().includes(val)
    );

    if (!open || filtered.length === 0) {
      if (dropdownEl) { dropdownEl.remove(); dropdownEl = null; }
      return;
    }

    if (!dropdownEl) {
      dropdownEl = document.createElement("div");
      dropdownEl.className = "cc-combobox-dropdown";
      document.body.appendChild(dropdownEl);
    }

    position();
    dropdownEl.innerHTML = filtered.map((c, i) =>
      `<div class="cc-combobox-item${i === focusedIdx ? " focused" : ""}" data-index="${i}">
        <span class="cc-combobox-code">${escapeHtml(c.code)}</span>
        <span class="cc-combobox-name">${escapeHtml(c.name)}</span>
      </div>`
    ).join("");
  }

  function select(idx) {
    if (idx < 0 || idx >= filtered.length) return;
    const c = filtered[idx];
    input.value = c.code;
    close();
    if (onChange) onChange(c.code);
  }

  input.addEventListener("input", () => { focusedIdx = -1; open = true; render(); });
  input.addEventListener("focus", () => { if (input.value) { open = true; render(); } });
  input.addEventListener("click", () => { open = true; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) { open = true; render(); } else { focusedIdx = Math.min(focusedIdx + 1, filtered.length - 1); render(); } }
    if (e.key === "ArrowUp") { e.preventDefault(); focusedIdx = Math.max(focusedIdx - 1, 0); render(); }
    if (e.key === "Enter") { e.preventDefault(); select(focusedIdx >= 0 ? focusedIdx : 0); }
    if (e.key === "Escape") { e.preventDefault(); close(); input.blur(); }
  });

  document.addEventListener("scroll", position, true);
  window.addEventListener("resize", position);

  document.addEventListener("mousedown", function ccClick(e) {
    if (dropdownEl && !dropdownEl.contains(e.target) && !input.contains(e.target)) { close(); }
  });

  document.addEventListener("mousedown", function ccSelect(e) {
    if (!dropdownEl) return;
    const item = e.target.closest(".cc-combobox-item");
    if (item && dropdownEl.contains(item)) select(parseInt(item.dataset.index));
  });

  return { close, open: openDropdown };
}

function ccGetCurrencyComboboxValue(containerId) {
  const input = document.querySelector("#" + containerId + " .cc-combobox-input");
  return input ? input.value.trim().toUpperCase() : "";
}


