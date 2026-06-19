document.getElementById("facilityForm").addEventListener("submit", function(e) {
  e.preventDefault();

  // Collect all form values
  const facility = {
    facilityName: document.getElementById("facilityName").value.trim(),
    facilityType: document.getElementById("facilityType").value,
    city: document.getElementById("city").value,
    contactName: document.getElementById("contactName").value.trim(),
    contactRole: document.getElementById("contactRole").value,
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    staffNeeds: document.getElementById("staffNeeds").value,
    frequency: document.getElementById("frequency").value,
  };

  // Basic validation
  if (
    !facility.facilityName ||
    !facility.facilityType ||
    !facility.city ||
    !facility.contactName ||
    !facility.contactRole ||
    !facility.email ||
    !facility.phone ||
    !facility.staffNeeds ||
    !facility.frequency
  ) {
    alert("Please fill in all fields.");
    return;
  }

  // Log to console (we will send to a database later)
  console.log("New facility signup:", facility);

  // Hide form, show success card
  document.getElementById("facilityForm").style.display = "none";
  document.getElementById("successCard").style.display = "block";

  // Scroll to success card
  document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
});