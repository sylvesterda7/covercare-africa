// ── Initialize Supabase ──
const SUPABASE_URL = "https://ifmpbrpcnnswqlwdytfy.supabase.co";
const SUPABASE_KEY = "sb_publishable_KT7yIGNSWn0DcKADLC0HtA_z9kaCoOB";
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Cloudinary config ──
const CLOUDINARY_CLOUD_NAME = "dy58hyn86"; // replace with your cloud name
const CLOUDINARY_UPLOAD_PRESET = "covercare_unsigned"; // we'll create this in a moment

// ── State ──
let idImageElement = null;
let selfieImageElement = null;
let videoStream = null;
let modelsLoaded = false;

// ── Load face-api models ──
async function loadModels() {
  const MODEL_URL = "/weights";
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
  modelsLoaded = true;
  console.log("Face API models loaded");
}

// Load models on page start
loadModels();

// ── Step navigation ──
function updateProgress(step) {
  document.querySelectorAll(".progress-step").forEach((dot, i) => {
    dot.classList.remove("active", "done");
    if (i + 1 < step) dot.classList.add("done");
    if (i + 1 === step) dot.classList.add("active");
  });
  document.querySelectorAll(".progress-line").forEach((line, i) => {
    line.classList.remove("done");
    if (i + 1 < step) line.classList.add("done");
  });
}

function goToStep1() {
  document.getElementById("step1").style.display = "block";
  document.getElementById("step2").style.display = "none";
  document.getElementById("step3").style.display = "none";
  updateProgress(1);
  stopCamera();
}

function goToStep2() {
  const idFile = document.getElementById("idFile").files[0];
  if (!idFile) {
    alert("Please upload your ID document first.");
    return;
  }
  document.getElementById("step1").style.display = "none";
  document.getElementById("step2").style.display = "block";
  document.getElementById("step3").style.display = "none";
  updateProgress(2);
  startCamera();
}

function goToStep3() {
  document.getElementById("step1").style.display = "none";
  document.getElementById("step2").style.display = "none";
  document.getElementById("step3").style.display = "block";
  updateProgress(3);
  stopCamera();
}

// ── ID preview ──
function previewID(input) {
  if (!input.files || !input.files[0]) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById("idPreview");
    preview.src = e.target.result;
    document.getElementById("idPreviewWrap").style.display = "block";

    // Create image element for face-api
    idImageElement = new Image();
    idImageElement.src = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}

// ── Camera ──
async function startCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 400, height: 300 }
    });
    document.getElementById("video").srcObject = videoStream;
  } catch (err) {
    alert("Could not access camera. Please allow camera permission and try again.");
    console.error("Camera error:", err);
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
}

// ── Take selfie ──
function takeSelfie() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);

  const dataURL = canvas.toDataURL("image/jpeg");

  // Show preview
  document.getElementById("selfiePreview").src = dataURL;
  document.getElementById("selfiePreviewWrap").style.display = "block";

  // Create image element for face-api
  selfieImageElement = new Image();
  selfieImageElement.src = dataURL;

  console.log("Selfie taken");
}

function retakeSelfie() {
  document.getElementById("selfiePreviewWrap").style.display = "none";
  selfieImageElement = null;
}

// ── Run face verification ──
async function runVerification() {
  if (!selfieImageElement) {
    alert("Please take a selfie first.");
    return;
  }

  if (!idImageElement) {
    alert("ID image not loaded. Please go back and re-upload your ID.");
    return;
  }

  goToStep3();

  // Show loading
  document.getElementById("verifyLoading").style.display = "block";
  document.getElementById("verifySuccess").style.display = "none";
  document.getElementById("verifyFailed").style.display = "none";

  try {
    // Wait for models if still loading
    if (!modelsLoaded) {
      await loadModels();
    }

    // Wait for images to load
    await Promise.all([
      new Promise(r => { idImageElement.onload = r; if (idImageElement.complete) r(); }),
      new Promise(r => { selfieImageElement.onload = r; if (selfieImageElement.complete) r(); })
    ]);

    // ── Detect faces ──
    console.log("Detecting face in ID...");
    const idDetection = await faceapi
      .detectSingleFace(idImageElement)
      .withFaceLandmarks()
      .withFaceDescriptor();

    console.log("Detecting face in selfie...");
    const selfieDetection = await faceapi
      .detectSingleFace(selfieImageElement)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!idDetection) {
      console.log("No face found in ID");
      showFailed("No face detected in your ID document. Please upload a clearer photo.");
      return;
    }

    if (!selfieDetection) {
      console.log("No face found in selfie");
      showFailed("No face detected in your selfie. Please retake your photo.");
      return;
    }

    // ── Compare faces ──
    const distance = faceapi.euclideanDistance(
      idDetection.descriptor,
      selfieDetection.descriptor
    );

    console.log("Face distance:", distance);

    // Distance < 0.5 = same person (lower = more similar)
    const isMatch = distance < 0.5;

    if (isMatch) {
      await markVerified();
    } else {
      showFailed();
    }

  } catch (err) {
    console.error("Verification error:", err);
    showFailed("An error occurred during verification. Please try again.");
  }
}

// ── Mark worker as identity verified in database ──
async function markVerified() {
  const { data: { session } } = await _supabase.auth.getSession();

  if (session) {
    const email = session.user.email;

    // Upload selfie to Cloudinary
    const selfieDataUrl = document.getElementById("selfiePreview").src;
    const selfieUrl = await uploadToCloudinary(selfieDataUrl, "selfie");

    // Upload ID to Cloudinary
    const idFile = document.getElementById("idFile").files[0];
    const idUrl = await uploadToCloudinary(
      await fileToDataUrl(idFile),
      "id_document"
    );

    // Update worker record in Supabase
    await _supabase
      .from("workers")
      .update({
        identity_verified: true,
        identity_verified_at: new Date().toISOString(),
        selfie_url: selfieUrl,
        id_document_url: idUrl
      })
      .eq("email", email);
  }

  // Show success
  document.getElementById("verifyLoading").style.display = "none";
  document.getElementById("verifySuccess").style.display = "block";
}

function showFailed(message) {
  document.getElementById("verifyLoading").style.display = "none";
  document.getElementById("verifyFailed").style.display = "block";
  if (message) {
    document.getElementById("verifyFailed").querySelector("p").textContent = message;
  }
}

function restart() {
  goToStep1();
  document.getElementById("idFile").value = "";
  document.getElementById("idPreviewWrap").style.display = "none";
  document.getElementById("selfiePreviewWrap").style.display = "none";
  idImageElement = null;
  selfieImageElement = null;
}

// ── Upload to Cloudinary ──
async function uploadToCloudinary(dataUrl, folder) {
  try {
    const formData = new FormData();
    formData.append("file", dataUrl);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", `covercare/${folder}`);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    );

    const data = await response.json();
    return data.secure_url;
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return null;
  }
}

// ── Helper — file to data URL ──
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}