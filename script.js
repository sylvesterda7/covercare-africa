function joinWaitlist() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();

  if (!name || !email) {
    alert("Please enter your name and email.");
    return;
  }

  document.getElementById("success").style.display = "block";
  document.getElementById("name").value = "";
  document.getElementById("email").value = "";
}