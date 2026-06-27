const _supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);

async function init() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }
  if (session.user.user_metadata?.user_type) {
    window.location.href = getDashboardUrl(
      session.user.user_metadata.user_type,
      session.user.email
    );
    return;
  }
  const meta = session.user.user_metadata;
  if (meta?.full_name) {
    document.getElementById("setupName").value = meta.full_name;
  } else if (session.user.email) {
    document.getElementById("setupName").value = session.user.email.split("@")[0];
  }
}

init();

document.getElementById("setupForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const name = document.getElementById("setupName").value.trim();
  const type = document.getElementById("setupType").value;
  const btn = document.getElementById("setupBtn");
  const errorMsg = document.getElementById("errorMsg");
  errorMsg.style.display = "none";
  if (!name || !type) { errorMsg.textContent = "Please fill in all fields."; errorMsg.style.display = "block"; return; }
  btn.disabled = true;
  btn.textContent = "Saving...";
  const { error } = await _supabase.auth.updateUser({
    data: { full_name: name, user_type: type }
  });
  if (error) {
    errorMsg.textContent = error.message;
    errorMsg.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Complete setup";
    return;
  }
  const { data: { session } } = await _supabase.auth.getSession();
  window.location.href = getDashboardUrl(type, session?.user?.email || "");
});
