const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

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

  errorMsg.style.display = "none";
  successMsg.style.display = "none";

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

  btn.textContent = "Creating account...";
  btn.disabled = true;

  const { data, error } = await _supabase.auth.signUp({
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

  if (!data.session) {
    successMsg.textContent =
      "Account created! Check your email to confirm, then sign in and complete your profile.";
    successMsg.style.display = "block";
    btn.textContent = "Create account";
    btn.disabled = false;
    setTimeout(() => { window.location.href = "login.html"; }, 3000);
    return;
  }

  successMsg.textContent = "Account created! Redirecting...";
  successMsg.style.display = "block";

  setTimeout(() => {
    if (userType === "worker") {
      window.location.href = "worker-signup.html";
    } else if (userType === "facility" || userType === "homecare") {
      window.location.href = "facility-signup.html";
    } else {
      window.location.href = "index.html";
    }
  }, 1200);
});
