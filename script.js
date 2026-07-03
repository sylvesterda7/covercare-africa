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
    workerBtn.style.borderColor = 'rgba(17,24,39,0.08)';
    workerBtn.style.color = 'rgba(17,24,39,0.35)';
    workerBtn.style.fontWeight = 'normal';
  } else {
    workerBtn.style.background = 'rgba(17,24,39,0.15)';
    workerBtn.style.borderColor = 'rgba(17,24,39,0.3)';
    workerBtn.style.color = '#111827';
    workerBtn.style.fontWeight = '500';
    facilityBtn.style.background = 'transparent';
    facilityBtn.style.borderColor = 'rgba(17,24,39,0.08)';
    facilityBtn.style.color = 'rgba(17,24,39,0.35)';
    facilityBtn.style.fontWeight = 'normal';
  }
}

// ── Scroll-in reveal + animated stat counters ──
(function() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function animateCount(el) {
    const target = parseFloat(el.getAttribute("data-count-to"));
    const suffix = el.getAttribute("data-suffix") || "";
    if (Number.isNaN(target)) return;
    if (prefersReducedMotion) {
      el.textContent = target + suffix;
      return;
    }
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  document.addEventListener("DOMContentLoaded", function() {
    const revealEls = document.querySelectorAll(".reveal");
    if (revealEls.length && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            const counter = entry.target.querySelector("[data-count-to]");
            if (counter) animateCount(counter);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2, rootMargin: "0px 0px -40px 0px" });
      revealEls.forEach(function(el) { io.observe(el); });
    } else {
      revealEls.forEach(function(el) { el.classList.add("in-view"); });
    }
  });
})();

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