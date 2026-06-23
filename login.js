const SUPABASE_URL = "https://ifmpbrpcnnswqlwdytfy.supabase.co";
const SUPABASE_KEY = "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB";
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSession() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session) {
    const userType = session.user.user_metadata.user_type;
    if (userType === "worker") {
      window.location.href = "dashboard-worker.html";
    } else {
      window.location.href = "dashboard-facility.html";
    }
  }
}

checkSession();

document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("loginBtn");
  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  errorMsg.style.display = "none";
  successMsg.style.display = "none";

  btn.textContent = "Signing in...";
  btn.disabled = true;

  const { data, error } = await _supabase.auth.signInWithPassword({
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

  const userType = data.user.user_metadata.user_type;
  successMsg.textContent = "Signed in successfully. Redirecting...";
  successMsg.style.display = "block";

setTimeout(() => {
  // ── Admin redirect ──
  const adminEmails = ["sdenyoh-abayateye@st.ug.edu.gh"];
  if (adminEmails.includes(data.user.email)) {
    window.location.href = "admin.html";
  } else if (userType === "worker") {
    window.location.href = "dashboard-worker.html";
  } else {
    window.location.href = "dashboard-facility.html";
  }
}, 1000);
});