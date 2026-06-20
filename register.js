// ── Initialize Supabase ──
const SUPABASE_URL = "https://ifmpbrpcnnswqlwdytfy.supabase.co";
const SUPABASE_KEY = "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Register form ──
document.getElementById("registerForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const userType = document.getElementById("userType").value;
  const fullname = document.getElementById("fullname").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const btn = document.getElementById("registerBtn");
  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  // ── Reset messages ──
  errorMsg.style.display = "none";
  successMsg.style.display = "none";

  // ── Validation ──
  if (!userType) {
    errorMsg.textContent = "Please select your account type.";
    errorMsg.style.display = "block";
    return;
  }

  if (password !== confirmPassword) {
    errorMsg.textContent = "Passwords do not match.";
    errorMsg.style.display = "block";
    return;
  }

  if (password.length < 8) {
    errorMsg.textContent = "Password must be at least 8 characters.";
    errorMsg.style.display = "block";
    return;
  }

  // ── Show loading ──
  btn.textContent = "Creating account...";
  btn.disabled = true;

  // ── Create account with Supabase Auth ──
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullname,
        user_type: userType
      }
    }
  });

  if (error) {
    errorMsg.textContent = error.message;
    errorMsg.style.display = "block";
    btn.textContent = "Create account";
    btn.disabled = false;
    return;
  }

  // ── Success ──
  successMsg.textContent = "Account created! Redirecting to your dashboard...";
  successMsg.style.display = "block";

  // ── Redirect based on user type ──
  setTimeout(() => {
    if (userType === "worker") {
      window.location.href = "dashboard-worker.html";
    } else if (userType === "facility") {
      window.location.href = "dashboard-facility.html";
    } else if (userType === "homecare") {
      window.location.href = "dashboard-facility.html";
    } else {
      window.location.href = "index.html";
    }
  }, 1500);
});