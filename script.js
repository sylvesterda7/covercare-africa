let userType = 'facility';

function setType(t) {
  userType = t;
  const facilityBtn = document.getElementById('btn-facility');
  const workerBtn = document.getElementById('btn-worker');

  if (t === 'facility') {
    facilityBtn.style.background = 'rgba(93,202,165,0.15)';
    facilityBtn.style.borderColor = 'rgba(93,202,165,0.3)';
    facilityBtn.style.color = '#5DCAA5';
    facilityBtn.style.fontWeight = '500';
    workerBtn.style.background = 'transparent';
    workerBtn.style.borderColor = 'rgba(255,255,255,0.1)';
    workerBtn.style.color = 'rgba(255,255,255,0.4)';
    workerBtn.style.fontWeight = 'normal';
  } else {
    workerBtn.style.background = 'rgba(93,202,165,0.15)';
    workerBtn.style.borderColor = 'rgba(93,202,165,0.3)';
    workerBtn.style.color = '#5DCAA5';
    workerBtn.style.fontWeight = '500';
    facilityBtn.style.background = 'transparent';
    facilityBtn.style.borderColor = 'rgba(255,255,255,0.1)';
    facilityBtn.style.color = 'rgba(255,255,255,0.4)';
    facilityBtn.style.fontWeight = 'normal';
  }
}

function joinWaitlist() {
  const name = document.getElementById('waitlist-name').value.trim();
  const email = document.getElementById('waitlist-email').value.trim();

  if (!name || !email) {
    alert('Please enter your name and email.');
    return;
  }

  document.getElementById('waitlist-success').style.display = 'block';
  document.getElementById('waitlist-name').value = '';
  document.getElementById('waitlist-email').value = '';
}