document.getElementById("workerForm").addEventListener("submit", function(e) {
  e.preventDefault();

  // Collect all form values
  const worker = {
    name: document.getElementById("fullname").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    role: document.getElementById("role").value,
    license: document.getElementById("license").value.trim(),
    city: document.getElementById("city").value,
    experience: document.getElementById("experience").value,
  };

  // Basic validation
  if (!worker.name || !worker.email || !worker.phone || !worker.role || !worker.license || !worker.city || !worker.experience) {
    alert("Please fill in all fields.");
    return;
  }

  // Log to console (we will send to a database later)
  console.log("New worker signup:", worker);

  // Hide the form, show success card
  document.getElementById("workerForm").style.display = "none";
  document.getElementById("successCard").style.display = "block";

  // Scroll to top of form section
  document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
});