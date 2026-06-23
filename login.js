const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

async function checkSession() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session) {
    window.location.href = getDashboardUrl(
      session.user.user_metadata.user_type,
      session.user.email
    );
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

  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errorMsg.textContent = error.message;
    errorMsg.style.display = "block";
    btn.textContent = "Sign in";
    btn.disabled = false;
    return;
  }

  successMsg.textContent = "Signed in successfully. Redirecting...";
  successMsg.style.display = "block";

  setTimeout(() => {
    window.location.href = getDashboardUrl(
      data.user.user_metadata.user_type,
      data.user.email
    );
  }, 800);
});
