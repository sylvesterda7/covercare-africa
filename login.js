// ── Initialize Supabase ──
const SUPABASE_URL = "https://ifmpbrpcnnswqlwdytfy.supabase.co";
const SUPABASE_KEY = "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Check if already logged in ──
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    // Already logged in — redirect to correct dashboard
    const userType = session.user.user_metadata.user_type;
    if (userType === "worker") {
      window.location.href = "dashboard-worker.html";
    } else if (userType === "facility") {
      window.location.href = "dashboard-facility.html";
    }
  }
}

checkSession();

// ── Login form ──
document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("loginBtn");
  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  // Reset messages
  errorMsg.style.display = "none";
  successMsg.style.display = "none";

  // Show loading
  btn.textContent = "Signing in...";
  btn.disabled = true;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    errorMsg.textContent = error.message;
    errorMsg.style.display = "block";
    btn.textContent = "Sign in";
    btn.disabled = false;
    return;
  }

  // ── Success — redirect based on user type ──
  const userType = data.user.user_metadata.user_type;
  successMsg.textContent = "Signed in successfully. Redirecting...";
  successMsg.style.display = "block";

  setTimeout(() => {
    if (userType === "worker") {
      window.location.href = "dashboard-worker.html";
    } else if (userType === "facility") {
      window.location.href = "dashboard-facility.html";
    } else {
      window.location.href = "dashboard-worker.html";
    }
  }, 1000);
});