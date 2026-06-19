document.getElementById("workerForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const worker = {
    name: document.getElementById("fullname").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    role: document.getElementById("role").value,
    license: document.getElementById("license").value.trim(),
    city: document.getElementById("city").value,
    experience: document.getElementById("experience").value,
  };

  if (!worker.name || !worker.email || !worker.phone || !worker.role || !worker.license || !worker.city || !worker.experience) {
    alert("Please fill in all fields.");
    return;
  }

  // Send to Formspree
  const response = await fetch("https://formspree.io/f/mykarpka", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(worker)
  });

  if (response.ok) {
    document.getElementById("workerForm").style.display = "none";
    document.getElementById("successCard").style.display = "block";
    document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
  } else {
    alert("Something went wrong. Please try again.");
  }
});