/** Shared CoverCare Africa frontend configuration */
const CC_CONFIG = {
  SUPABASE_URL: "https://ifmpbrpcnnswqlwdytfy.supabase.co",
  SUPABASE_KEY: "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB",
  BACKEND_URL: "https://covercare-backend-production.up.railway.app",
  PAYSTACK_PUBLIC_KEY: "pk_test_866cbb9c537c7780cc05fa3d88c10fcd5e758d02",
  ADMIN_EMAILS: ["sdenyoh-abayateye@st.ug.edu.gh"],
  ARRIVE_BASE_URL: "https://covercare-africa.vercel.app/arrive",
  SUPPORTED_CURRENCIES: [
    { code: "GHS", symbol: "GHS", name: "Ghana Cedi", locale: "en-GH" },
    { code: "NGN", symbol: "NGN", name: "Nigerian Naira", locale: "en-NG" },
    { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
    { code: "EUR", symbol: "€", name: "Euro", locale: "en-EU" },
    { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" }
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
