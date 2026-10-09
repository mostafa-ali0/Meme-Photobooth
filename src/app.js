// ---- Lofi Cam Booth ----
// Flow: pick 4 memes -> shoot each (capture/retake) -> export PDF strip.

const MEMES_DIR = "memes/";
const LOGO_SRC = "assets/sap-logo.png";
const memeSrc = (file) => MEMES_DIR + encodeURI(file);

const MEMES = [
  "Actually.jpg",
  "Begging.jpg",
  "Monkey confused.jpeg",
  "Shaq timeout.jpg",
  "side smirk girl.jpeg",
  "Speed.jpg",
  "spiderman.jpg",
  "Tiger Monkey.jpeg",
];

const SHOT_COUNT = 4;
const COUNTDOWN_FROM = 3; // seconds before snap

// ---- state ----
let selected = [];        // chosen meme filenames, in order
let shots = [];           // dataURL per slot (null = not taken)
let current = 0;          // active slot index during shoot
let stream = null;        // webcam MediaStream

// ---- elements ----
const el = (id) => document.getElementById(id);
const pickStage = el("pick-stage");
const shootStage = el("shoot-stage");
const resultStage = el("result-stage");
const memeGrid = el("meme-grid");
const pickCount = el("pick-count");
const startBtn = el("start-btn");

const cam = el("cam");
const capturedPreview = el("captured-preview");
const targetMeme = el("target-meme");
const countdownEl = el("countdown");
const flashEl = el("flash");
const captureBtn = el("capture-btn");
const retakeBtn = el("retake-btn");
const nextBtn = el("next-btn");
const thumbs = el("thumbs");
const shotNum = el("shot-num");
const shotsDone = el("shots-done");
const progressFill = el("progress-fill");
const workCanvas = el("work-canvas");

const stripPreview = el("strip-preview");
const pdfBtn = el("pdf-btn");
const restartBtn = el("restart-btn");

const prettyName = (f) => f.replace(/\.(jpg|jpeg|png)$/i, "");

// ---- STAGE 1: picker ----
function buildPicker() {
  memeGrid.innerHTML = "";
  MEMES.forEach((file) => {
    const card = document.createElement("div");
    card.className = "meme-card";
    card.dataset.file = file;
    card.innerHTML = `
      <div class="badge"></div>
      <img src="${memeSrc(file)}" alt="${prettyName(file)}" />
      <div class="name">${prettyName(file)}</div>`;
    card.addEventListener("click", () => toggleMeme(file, card));
    memeGrid.appendChild(card);
  });
}

function toggleMeme(file, card) {
  const idx = selected.indexOf(file);
  if (idx >= 0) {
    selected.splice(idx, 1);
    card.classList.remove("selected");
  } else {
    if (selected.length >= SHOT_COUNT) return; // cap at 4
    selected.push(file);
    card.classList.add("selected");
  }
  refreshBadges();
  pickCount.textContent = selected.length;
  startBtn.disabled = selected.length !== SHOT_COUNT;
}

function refreshBadges() {
  document.querySelectorAll(".meme-card").forEach((c) => {
    const pos = selected.indexOf(c.dataset.file);
    const badge = c.querySelector(".badge");
    badge.textContent = pos >= 0 ? pos + 1 : "";
  });
}

startBtn.addEventListener("click", startShoot);

// ---- STAGE 2: shoot ----
async function startShoot() {
  shots = new Array(SHOT_COUNT).fill(null);
  current = 0;
  pickStage.classList.add("hidden");
  shootStage.classList.remove("hidden");
  buildThumbs();
  await initCam();
  loadSlot(0);
  updateProgress();
}

async function initCam() {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
    cam.srcObject = stream;
  } catch (err) {
    alert("Camera access failed: " + err.message + "\nAllow camera and reload.");
  }
}

function buildThumbs() {
  thumbs.innerHTML = "";
  selected.forEach((_, i) => {
    const t = document.createElement("div");
    t.className = "thumb";
    t.id = "thumb-" + i;
    t.textContent = i + 1;
    t.addEventListener("click", () => jumpTo(i));
    thumbs.appendChild(t);
  });
}

function loadSlot(i) {
  current = i;
  targetMeme.src = memeSrc(selected[i]);
  shotNum.textContent = i + 1;
  refreshThumbState();
  if (shots[i]) {
    showCaptured(shots[i]);
  } else {
    showLive();
  }
}

function jumpTo(i) {
  loadSlot(i);
}

function showLive() {
  cam.classList.remove("hidden");
  capturedPreview.classList.add("hidden");
  captureBtn.classList.remove("hidden");
  retakeBtn.classList.add("hidden");
  nextBtn.classList.add("hidden");
}

function showCaptured(dataUrl) {
  capturedPreview.src = dataUrl;
  capturedPreview.classList.remove("hidden");
  cam.classList.add("hidden");
  captureBtn.classList.add("hidden");
  retakeBtn.classList.remove("hidden");
  nextBtn.classList.remove("hidden");
  nextBtn.textContent = allDone() ? "Finish ✓" : "Keep & next →";
}

captureBtn.addEventListener("click", runCountdown);
retakeBtn.addEventListener("click", () => showLive());
nextBtn.addEventListener("click", goNext);

function runCountdown() {
  captureBtn.disabled = true;
  let n = COUNTDOWN_FROM;
  countdownEl.textContent = n;
  countdownEl.classList.remove("hidden");
  const timer = setInterval(() => {
    n -= 1;
    if (n <= 0) {
      clearInterval(timer);
      countdownEl.classList.add("hidden");
      captureBtn.disabled = false;
      snap();
    } else {
      countdownEl.textContent = n;
    }
  }, 1000);
}

function snap() {
  const vw = cam.videoWidth || 1280;
  const vh = cam.videoHeight || 960;
  workCanvas.width = vw;
  workCanvas.height = vh;
  const ctx = workCanvas.getContext("2d");
  // mirror horizontally to match the live preview
  ctx.translate(vw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(cam, 0, 0, vw, vh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dataUrl = workCanvas.toDataURL("image/jpeg", 0.92);
  shots[current] = dataUrl;
  // flash effect
  flashEl.classList.remove("fire");
  void flashEl.offsetWidth; // reflow to restart animation
  flashEl.classList.add("fire");
  showCaptured(dataUrl);
  refreshThumbState();
  updateProgress();
}

function goNext() {
  if (allDone()) {
    finish();
    return;
  }
  // advance to next empty slot, else next index
  let nextEmpty = shots.findIndex((s, i) => i > current && !s);
  if (nextEmpty === -1) nextEmpty = shots.findIndex((s) => !s);
  loadSlot(nextEmpty === -1 ? Math.min(current + 1, SHOT_COUNT - 1) : nextEmpty);
}

function allDone() {
  return shots.every(Boolean);
}

function refreshThumbState() {
  selected.forEach((_, i) => {
    const t = el("thumb-" + i);
    t.classList.toggle("done", !!shots[i]);
    t.classList.toggle("current", i === current);
    t.innerHTML = shots[i] ? `<img src="${shots[i]}" alt="shot ${i + 1}">` : i + 1;
  });
}

function updateProgress() {
  const done = shots.filter(Boolean).length;
  shotsDone.textContent = done;
  progressFill.style.width = (done / SHOT_COUNT) * 100 + "%";
}

// ---- STAGE 3: result ----
function finish() {
  shootStage.classList.add("hidden");
  resultStage.classList.remove("hidden");
  renderStripPreview();
  stopCam();
}

function renderStripPreview() {
  stripPreview.innerHTML = "";
  for (let i = 0; i < SHOT_COUNT; i++) {
    const row = document.createElement("div");
    row.className = "strip-row";
    row.innerHTML = `
      <div><img src="${shots[i]}" alt="you ${i + 1}"></div>
      <div><img src="${memeSrc(selected[i])}" alt="meme ${i + 1}"></div>`;
    stripPreview.appendChild(row);
  }
  const footer = document.createElement("div");
  footer.className = "strip-footer";
  footer.innerHTML = `<img src="${LOGO_SRC}" alt="SAP"><span>Cam Booth</span>`;
  stripPreview.appendChild(footer);
}

function stopCam() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

restartBtn.addEventListener("click", () => {
  selected = [];
  shots = [];
  current = 0;
  pickCount.textContent = "0";
  startBtn.disabled = true;
  document.querySelectorAll(".meme-card").forEach((c) => c.classList.remove("selected"));
  refreshBadges();
  resultStage.classList.add("hidden");
  pickStage.classList.remove("hidden");
});

// ---- PDF export (film-strip layout, matches template) ----
pdfBtn.addEventListener("click", exportPdf);

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// draw an image into a target rect, cover-cropped
function drawCover(pdf, img, x, y, w, h) {
  const ir = img.width / img.height;
  const tr = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > tr) { // image wider -> crop sides
    sw = img.height * tr;
    sx = (img.width - sw) / 2;
  } else {       // image taller -> crop top/bottom
    sh = img.width / tr;
    sy = (img.height - sh) / 2;
  }
  // use a scratch canvas to crop, then add to pdf
  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", x, y, w, h);
}

// draw SAP trapezoid scatter on the PDF background (navy page)
function drawPdfScatter(pdf, PW, PH) {
  // one SAP trapezoid outline at (x,y) with width w
  const trap = (x, y, w, mode) => {
    const h = w * 0.42;
    const pts = [ [x, y], [x + w, y], [x + w - h * 0.62, y + h], [x, y + h] ];
    if (mode === "fill") {
      pdf.setFillColor(60, 95, 180);
      pdf.lines(
        [[pts[1][0]-pts[0][0], pts[1][1]-pts[0][1]],
         [pts[2][0]-pts[1][0], pts[2][1]-pts[1][1]],
         [pts[3][0]-pts[2][0], pts[3][1]-pts[2][1]]],
        pts[0][0], pts[0][1], [1,1], "F", true);
    } else {
      if (mode === "red") pdf.setDrawColor(224, 26, 79);
      else pdf.setDrawColor(70, 110, 190);
      pdf.setLineWidth(0.8);
      pdf.lines(
        [[pts[1][0]-pts[0][0], pts[1][1]-pts[0][1]],
         [pts[2][0]-pts[1][0], pts[2][1]-pts[1][1]],
         [pts[3][0]-pts[2][0], pts[3][1]-pts[2][1]]],
        pts[0][0], pts[0][1], [1,1], "S", true);
    }
  };
  // sparse scatter in margins/corners so photos stay clear
  trap(6, 30, 34, "line");
  trap(10, 70, 30, "line");
  trap(PW - 46, 40, 34, "line");
  trap(PW - 40, 90, 28, "red");
  trap(8, PH - 60, 30, "fill");
  trap(PW - 44, PH - 70, 32, "line");
}

async function exportPdf() {
  pdfBtn.disabled = true;
  pdfBtn.querySelector("span").textContent = "Rendering…";
  try {
    const { jsPDF } = window.jspdf;
    // Portrait 4x6 photo print (inches -> pts). 4in x 6in at 72dpi.
    const pdf = new jsPDF({ unit: "pt", format: [288, 432] });
    const PW = 288, PH = 432;

    // SAP navy page background
    pdf.setFillColor(21, 40, 122); // --sap-navy
    pdf.rect(0, 0, PW, PH, "F");
    drawPdfScatter(pdf, PW, PH);

    const margin = 14;
    const gap = 6;
    const footerH = 34;
    const usableW = PW - margin * 2;
    const colW = (usableW - gap) / 2;
    const usableH = PH - margin * 2 - footerH;
    const rowH = (usableH - gap * (SHOT_COUNT - 1)) / SHOT_COUNT;

    // preload images
    const memeImgs = await Promise.all(selected.map((f) => loadImg(memeSrc(f))));
    const shotImgs = await Promise.all(shots.map((s) => loadImg(s)));
    const logo = await loadImg(LOGO_SRC);

    for (let i = 0; i < SHOT_COUNT; i++) {
      const y = margin + i * (rowH + gap);
      // left = your photo, right = meme (matches template)
      drawCover(pdf, shotImgs[i], margin, y, colW, rowH);
      drawCover(pdf, memeImgs[i], margin + colW + gap, y, colW, rowH);
    }

    // SAP-blue footer bar with logo
    const fy = PH - margin - footerH + 4;
    const fh = footerH - 4;
    // gradient-ish bar: deep blue fill + lighter top strip
    pdf.setFillColor(0, 87, 184);          // --sap-deep
    pdf.roundedRect(margin, fy, usableW, fh, 5, 5, "F");
    pdf.setFillColor(0, 143, 211);         // --sap-bright accent strip
    pdf.rect(margin, fy, usableW, 4, "F");

    // logo on footer (on white chip for contrast)
    const lh = 18;
    const lw = lh * (logo.width / logo.height);
    const chipPad = 4;
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(margin + 8 - chipPad, fy + (fh - lh) / 2 - chipPad,
      lw + chipPad * 2, lh + chipPad * 2, 3, 3, "F");
    const logoCanvas = document.createElement("canvas");
    logoCanvas.width = logo.width; logoCanvas.height = logo.height;
    logoCanvas.getContext("2d").drawImage(logo, 0, 0);
    pdf.addImage(logoCanvas.toDataURL("image/png"), "PNG",
      margin + 8, fy + (fh - lh) / 2, lw, lh);

    // footer text
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Cam Booth", PW - margin - 12, fy + fh / 2 + 5, { align: "right" });

    pdf.save("sap-cam-booth.pdf");
  } catch (err) {
    alert("PDF export failed: " + err.message);
  } finally {
    pdfBtn.disabled = false;
    pdfBtn.querySelector("span").textContent = "Download PDF to print";
  }
}

// ---- init ----
buildPicker();
buildScatter();

// ---- SAP trapezoid scatter background ----
// Shape = SAP logo silhouette: rectangle with top-right corner sliced diagonally.
// Fixed layout (no Math.random — unavailable), roughly matching the reference.
function buildScatter() {
  const host = document.getElementById("bg-scatter");
  if (!host) return;
  // {x%, y%, w(px), kind: 'line'|'fill'|'red', delay}
  const traps = [
    { x: 3,  y: 40, w: 120, kind: "line", d: 0 },
    { x: 13, y: 40, w: 120, kind: "line", d: 2 },
    { x: 13, y: 54, w: 120, kind: "line", d: 4 },
    { x: 13, y: 66, w: 120, kind: "line", d: 1 },
    { x: 24, y: 66, w: 120, kind: "line", d: 3 },
    { x: 24, y: 76, w: 120, kind: "fill", d: 5 },
    { x: 33, y: 76, w: 120, kind: "line", d: 2 },
    { x: 42, y: 66, w: 120, kind: "line", d: 6 },
    { x: 74, y: 40, w: 120, kind: "line", d: 1 },
    { x: 74, y: 54, w: 120, kind: "line", d: 3 },
    { x: 84, y: 54, w: 120, kind: "line", d: 5 },
    { x: 74, y: 66, w: 120, kind: "line", d: 2 },
    { x: 64, y: 74, w: 120, kind: "red",  d: 4 },
  ];
  traps.forEach((t) => {
    const div = document.createElement("div");
    div.className = "trap";
    const h = Math.round(t.w * 0.42);
    div.style.left = t.x + "%";
    div.style.top = t.y + "%";
    div.style.width = t.w + "px";
    div.style.height = h + "px";
    div.style.animationDelay = "-" + t.d + "s";
    const stroke = t.kind === "red" ? "#e01a4f" : "rgba(120,165,240,0.55)";
    const fill = t.kind === "fill" ? "rgba(140,185,245,0.85)" : "none";
    const sw = t.kind === "fill" ? 0 : 2;
    // trapezoid: top-left, top-right(cut), bottom-right, bottom-left
    div.innerHTML = `<svg viewBox="0 0 100 42" preserveAspectRatio="none">
      <path d="M2,2 L98,2 L72,40 L2,40 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>
    </svg>`;
    host.appendChild(div);
  });
}

