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
    const { response, data: result } = await ccFetch("/facility", {
      method: "POST",
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

    console.log("Save result:", result);

    if (response.ok && result.success) {
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