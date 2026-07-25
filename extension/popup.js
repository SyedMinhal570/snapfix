const SUPABASE_URL = "https://aejdiieyyvqwsyjyjklv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlamRpaWV5eXZxd3N5anlqa2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjkxMDksImV4cCI6MjEwMDQwNTEwOX0.tZLu_hqRlnRVrDyZjvdOaPR8KitngI4alIubo-E7R0c";

const STORAGE_KEY = "snapfix_session";

// UMD bundle already binds global `supabase` — don't redeclare that name.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const loginView = document.getElementById("login-view");
const captureView = document.getElementById("capture-view");
const logoutBtn = document.getElementById("logout-btn");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const captureBtn = document.getElementById("capture-btn");
const annotateArea = document.getElementById("annotate-area");
const canvas = document.getElementById("canvas");
const penBtn = document.getElementById("pen-btn");
const undoBtn = document.getElementById("undo-btn");
const clearBtn = document.getElementById("clear-btn");
const titleInput = document.getElementById("title");
const submitBtn = document.getElementById("submit-btn");
const captureStatus = document.getElementById("capture-status");

const ctx = canvas.getContext("2d");

let originalDataUrl = null;
let pageUrl = "";
let image = null;
let strokes = [];
let currentStroke = null;
let drawing = false;

function showLogin() {
  loginView.classList.remove("hidden");
  captureView.classList.add("hidden");
  logoutBtn.classList.add("hidden");
}

function showCapture() {
  loginView.classList.add("hidden");
  captureView.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
}

async function saveSession(session) {
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

async function loadSession() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? null;
}

async function clearSession() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

async function restoreAuth() {
  const session = await loadSession();
  if (!session?.access_token || !session?.refresh_token) {
    showLogin();
    return false;
  }

  const { data, error } = await sb.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error || !data.session) {
    await clearSession();
    showLogin();
    return false;
  }

  await saveSession(data.session);
  showCapture();
  return true;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    loginError.textContent = error.message;
    return;
  }

  await saveSession(data.session);
  showCapture();
});

logoutBtn.addEventListener("click", async () => {
  await sb.auth.signOut();
  await clearSession();
  resetCapture();
  showLogin();
});

function resetCapture() {
  originalDataUrl = null;
  pageUrl = "";
  image = null;
  strokes = [];
  currentStroke = null;
  drawing = false;
  titleInput.value = "";
  captureStatus.textContent = "";
  annotateArea.classList.add("hidden");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function redraw() {
  if (!image) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const stroke of strokes) {
    drawStroke(stroke);
  }
  if (currentStroke) {
    drawStroke(currentStroke);
  }
}

function drawStroke(stroke) {
  if (stroke.points.length < 2) return;
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
}

function getPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

canvas.addEventListener("pointerdown", (e) => {
  if (!image) return;
  canvas.setPointerCapture(e.pointerId);
  drawing = true;
  currentStroke = { points: [getPoint(e)] };
  redraw();
});

canvas.addEventListener("pointermove", (e) => {
  if (!drawing || !currentStroke) return;
  currentStroke.points.push(getPoint(e));
  redraw();
});

function endStroke() {
  if (!drawing) return;
  drawing = false;
  if (currentStroke && currentStroke.points.length >= 2) {
    strokes.push(currentStroke);
  }
  currentStroke = null;
  redraw();
}

canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);

penBtn.addEventListener("click", () => {
  penBtn.classList.add("active");
});

undoBtn.addEventListener("click", () => {
  strokes.pop();
  redraw();
});

clearBtn.addEventListener("click", () => {
  strokes = [];
  currentStroke = null;
  redraw();
});

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function canvasToPngBlob() {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

captureBtn.addEventListener("click", async () => {
  captureStatus.textContent = "Capturing…";
  submitBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      throw new Error("No active tab found.");
    }

    pageUrl = tab.url || "";
    originalDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Failed to load screenshot."));
      img.src = originalDataUrl;
    });

    image = img;
    strokes = [];
    currentStroke = null;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    redraw();

    annotateArea.classList.remove("hidden");
    captureStatus.textContent = "Annotate, then submit.";
  } catch (err) {
    captureStatus.textContent = err.message || "Capture failed.";
  } finally {
    submitBtn.disabled = false;
  }
});

submitBtn.addEventListener("click", async () => {
  const title = titleInput.value.trim();
  if (!title) {
    captureStatus.textContent = "Please enter a title.";
    return;
  }
  if (!originalDataUrl || !image) {
    captureStatus.textContent = "Capture a page first.";
    return;
  }

  submitBtn.disabled = true;
  captureBtn.disabled = true;
  captureStatus.textContent = "Submitting…";

  try {
    const {
      data: { user },
      error: userError,
    } = await sb.auth.getUser();

    if (userError || !user) {
      throw new Error("Session expired. Please log in again.");
    }

    const id = crypto.randomUUID();
    const originalPath = `${user.id}/${id}.png`;
    const annotatedPath = `${user.id}/${id}-annotated.png`;

    const originalBlob = dataUrlToBlob(originalDataUrl);
    const annotatedBlob = await canvasToPngBlob();
    if (!annotatedBlob) {
      throw new Error("Could not export annotated image.");
    }

    const { error: originalUploadError } = await sb.storage
      .from("screenshots")
      .upload(originalPath, originalBlob, { contentType: "image/png" });
    if (originalUploadError) throw originalUploadError;

    const { error: annotatedUploadError } = await sb.storage
      .from("screenshots")
      .upload(annotatedPath, annotatedBlob, { contentType: "image/png" });
    if (annotatedUploadError) throw annotatedUploadError;

    const {
      data: { publicUrl: screenshotUrl },
    } = sb.storage.from("screenshots").getPublicUrl(originalPath);

    const {
      data: { publicUrl: annotatedUrl },
    } = sb.storage.from("screenshots").getPublicUrl(annotatedPath);

    const { error: insertError } = await sb.from("issues").insert({
      title,
      description: "Reported via Chrome extension",
      page_url: pageUrl,
      screenshot_url: screenshotUrl,
      annotated_url: annotatedUrl,
      created_by: user.id,
    });
    if (insertError) throw insertError;

    captureStatus.textContent = "Issue submitted!";
    setTimeout(() => {
      resetCapture();
      window.close();
    }, 900);
  } catch (err) {
    captureStatus.textContent = err.message || "Submit failed.";
    submitBtn.disabled = false;
    captureBtn.disabled = false;
  }
});

restoreAuth();
