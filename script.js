let userType = 'facility';

function setType(t) {
  userType = t;
  const facilityBtn = document.getElementById('btn-facility');
  const workerBtn = document.getElementById('btn-worker');

  if (t === 'facility') {
    facilityBtn.style.background = 'rgba(17,24,39,0.15)';
    facilityBtn.style.borderColor = 'rgba(17,24,39,0.3)';
    facilityBtn.style.color = '#111827';
    facilityBtn.style.fontWeight = '500';
    workerBtn.style.background = 'transparent';
    workerBtn.style.borderColor = 'rgba(255,255,255,0.1)';
    workerBtn.style.color = 'rgba(255,255,255,0.4)';
    workerBtn.style.fontWeight = 'normal';
  } else {
    workerBtn.style.background = 'rgba(17,24,39,0.15)';
    workerBtn.style.borderColor = 'rgba(17,24,39,0.3)';
    workerBtn.style.color = '#111827';
    workerBtn.style.fontWeight = '500';
    facilityBtn.style.background = 'transparent';
    facilityBtn.style.borderColor = 'rgba(255,255,255,0.1)';
    facilityBtn.style.color = 'rgba(255,255,255,0.4)';
    facilityBtn.style.fontWeight = 'normal';
  }
}

async function joinWaitlist() {
  const name = document.getElementById('waitlist-name').value.trim();
  const email = document.getElementById('waitlist-email').value.trim();

  if (!name || !email) {
    ccToast("Please enter your name and email.", "error");
    return;
  }

  const btn = document.querySelector('.waitlist-form button');
  if (btn) { btn.disabled = true; btn.textContent = 'Joining...'; }

  try {
    const supabase = window.supabase.createClient(CC_CONFIG.SUPABASE_URL, CC_CONFIG.SUPABASE_KEY);
    const { error } = await supabase.from("waitlist").insert([{ name, email, type: document.querySelector('.type-btn[style*="background"]')?.textContent?.trim() || '' }]);

    if (error) {
      ccToast("Could not join waitlist. Please try again.", "error");
      return;
    }

    document.getElementById('waitlist-success').style.display = 'block';
    document.getElementById('waitlist-name').value = '';
    document.getElementById('waitlist-email').value = '';
  } catch (err) {
    console.error('Waitlist error:', err);
    ccToast("Something went wrong. Please try again.", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Join the Waitlist'; }
  }
}