/** Shared CoverCare Africa frontend configuration */
const CC_CONFIG = {
  SUPABASE_URL: "https://ifmpbrpcnnswqlwdytfy.supabase.co",
  SUPABASE_KEY: "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB",
  BACKEND_URL: "https://covercare-backend-production.up.railway.app",
  PAYSTACK_PUBLIC_KEY: "pk_test_866cbb9c537c7780cc05fa3d88c10fcd5e758d02",
  ADMIN_EMAILS: ["sdenyoh-abayateye@st.ug.edu.gh"],
  ARRIVE_BASE_URL: "https://covercare-africa.vercel.app/arrive"
};

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
