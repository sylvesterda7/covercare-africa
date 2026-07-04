const _supabase = ccGetSupabaseClient() || (window.supabase && window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY));

let _currentLeg = null;   // "phone" | "email"
let _currentValue = "";

function showError(msg) {
  const el = document.getElementById("errorMsg");
  el.textContent = msg;
  el.style.display = "block";
  document.getElementById("successMsg").style.display = "none";
}

function showSuccess(msg) {
  const el = document.getElementById("successMsg");
  el.textContent = msg;
  el.style.display = "block";
  document.getElementById("errorMsg").style.display = "none";
}

function configureStepFor(leg, session) {
  _currentLeg = leg;
  document.getElementById("otpStep").style.display = "none";
  document.getElementById("collectStep").style.display = "block";

  const label = document.getElementById("collectLabel");
  const input = document.getElementById("collectValue");
  if (leg === "phone") {
    label.textContent = "Phone number";
    input.type = "tel";
    input.placeholder = "e.g. 0244000000";
    input.value = session.user.phone || "";
    document.getElementById("sendCodeBtn").textContent = "Send code to my phone";
  } else {
    label.textContent = "Email address";
    input.type = "email";
    input.placeholder = "e.g. kwame@gmail.com";
    input.value = session.user.email || "";
    document.getElementById("sendCodeBtn").textContent = "Send code to my email";
  }
}

async function refreshAndRoute() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  if (!session.user.phone_confirmed_at) {
    configureStepFor("phone", session);
    return;
  }
  if (!session.user.email_confirmed_at) {
    configureStepFor("email", session);
    return;
  }
  // Both verified — on to the right dashboard.
  window.location.href = getDashboardUrl(session.user.user_metadata?.user_type, session.user.email);
}

async function sendCode() {
  const value = document.getElementById("collectValue").value.trim();
  if (!value) {
    showError(_currentLeg === "phone" ? "Please enter your phone number." : "Please enter your email address.");
    return;
  }
  _currentValue = value;

  const btn = document.getElementById("sendCodeBtn");
  btn.disabled = true;
  btn.textContent = "Sending...";

  try {
    const { error } = _currentLeg === "phone" ? await ccLinkPhone(value) : await ccLinkEmail(value);
    if (error) {
      showError(error.message);
      btn.disabled = false;
      btn.textContent = _currentLeg === "phone" ? "Send code to my phone" : "Send code to my email";
      return;
    }
    document.getElementById("collectStep").style.display = "none";
    document.getElementById("otpStep").style.display = "block";
    document.getElementById("otpSentNote").textContent = `We sent a 6-digit code to ${value}.`;
    document.getElementById("otpCode").value = "";
    document.getElementById("otpCode").focus();
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = _currentLeg === "phone" ? "Send code to my phone" : "Send code to my email";
  }
}

async function confirmCode() {
  const token = document.getElementById("otpCode").value.trim();
  if (!token || token.length < 4) {
    showError("Please enter the code we sent you.");
    return;
  }

  const btn = document.getElementById("confirmCodeBtn");
  btn.disabled = true;
  btn.textContent = "Confirming...";

  try {
    const { error } = _currentLeg === "phone"
      ? await ccVerifyPhoneChangeOtp(_currentValue, token)
      : await ccVerifyEmailChangeOtp(_currentValue, token);

    if (error) {
      showError(error.message);
      btn.disabled = false;
      btn.textContent = "Confirm code";
      return;
    }

    showSuccess(_currentLeg === "phone" ? "Phone number verified!" : "Email verified!");
    setTimeout(refreshAndRoute, 600);
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
    btn.disabled = false;
    btn.textContent = "Confirm code";
  }
}

async function signOutAndLeave() {
  await _supabase.auth.signOut();
  window.location.href = "login.html";
}

refreshAndRoute();
