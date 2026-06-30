const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

async function checkSession() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session) {
    if (!session.user.user_metadata?.user_type) {
      window.location.href = "oauth-setup.html";
      return;
    }
    window.location.href = getDashboardUrl(
      session.user.user_metadata.user_type,
      session.user.email
    );
  }
}

async function signInWithGoogle() {
  const btn = document.getElementById("googleBtn");
  btn.disabled = true;
  btn.textContent = "Redirecting to Google...";
  const { error } = await _supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + "/login.html"
    }
  });
  if (error) {
    document.getElementById("errorMsg").textContent = error.message;
    document.getElementById("errorMsg").style.display = "block";
    btn.disabled = false;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 48 48" style="vertical-align:middle; margin-right:8px;"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg> Continue with Google';
  }
}

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("expired") === "1") {
  const msg = document.getElementById("errorMsg");
  msg.textContent = "You were logged out due to inactivity. Please sign in again.";
  msg.style.display = "block";
}

checkSession();

_supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session) {
    if (!session.user.user_metadata?.user_type) {
      window.location.href = "oauth-setup.html";
      return;
    }
    window.location.href = getDashboardUrl(
      session.user.user_metadata.user_type,
      session.user.email
    );
  }
});

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
    const userType = data.user.user_metadata?.user_type;
    if (!userType) {
      window.location.href = "oauth-setup.html";
      return;
    }
    window.location.href = getDashboardUrl(
      userType,
      data.user.email
    );
  }, 800);
});
