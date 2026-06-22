document.getElementById("facilityForm").addEventListener("submit", async function(e) {
  e.preventDefault();

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

  try {
    // ── Send to Supabase via backend ──
    const response = await fetch("https://covercare-backend-production.up.railway.app/facility", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "cc-2025-$#Kp9mN2vQ8xR4wL7jT1zA6bY3eH5dF"
      },
      body: JSON.stringify({
        facility_name: facility.facilityName,
        facility_type: facility.facilityType,
        city: facility.city,
        contact_name: facility.contactName,
        contact_role: facility.contactRole,
        email: facility.email,
        phone: facility.phone,
        staff_needs: facility.staffNeeds,
        frequency: facility.frequency
      })
    });

    const result = await response.json();
    console.log("Save result:", result);

    if (response.ok) {
      document.getElementById("facilityForm").style.display = "none";
      document.getElementById("successCard").style.display = "block";
      document.getElementById("successCard").scrollIntoView({ behavior: "smooth" });
    } else {
      alert("Something went wrong. Please try again.");
    }

  } catch (err) {
    console.error("Submit error:", err);
    alert("Something went wrong. Please try again.");
  }
});