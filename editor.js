/*************************************************
 * Editor.js
 * Bubble → Fabric editor bootstrap
 *************************************************/

// -----------------------------
// Global editor state
// -----------------------------
let baseImageObject = null; // main uploaded image reference
let isRestoringHistory = false;   // true while undo/redo is applying a saved state
let isInitialLoad = true;         // true during initial load so we don’t record history yet

const history = [];
let historyIndex = -1;
const HISTORY_LIMIT = 50;

let saveTimeout = null;
const SAVE_DEBOUNCE_MS = 250;

// -----------------------------
// Read query parameters
// -----------------------------
const params = new URLSearchParams(window.location.search);
let imageUrl = params.get("image");
const canvasId = params.get("id"); // optional for later

console.log("Raw image param:", imageUrl);
console.log("Canvas ID:", canvasId);

// -----------------------------
// 2. Normalize Bubble / Imgix URLs
// -----------------------------
if (imageUrl && imageUrl.startsWith("//")) {
  imageUrl = "https:" + imageUrl;
}

console.log("Normalized image URL:", imageUrl);

// -----------------------------
// 3. Create Fabric canvas
// -----------------------------
const canvas = new fabric.Canvas("editor-canvas", {
  preserveObjectStacking: true,
  selection: true
});

console.log("Fabric canvas initialized");

// -----------------------------
// Phase 1: Serialize / Load helpers
// -----------------------------
function serializeCanvas() {
  const json = canvas.toJSON();
  return JSON.stringify(json);
}

function loadCanvasFromSerialized(serialized) {
  return new Promise((resolve, reject) => {
    try {
      const json = JSON.parse(serialized);

      canvas.loadFromJSON(json, () => {
        canvas.renderAll();
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

function pushHistoryState() {
  const serialized = serializeCanvas();

  // If user undid then changed something, wipe redo history
  if (historyIndex < history.length - 1) {
    history.splice(historyIndex + 1);
  }

  // Avoid duplicate consecutive states
  if (history.length > 0 && history[history.length - 1] === serialized) {
    return;
  }

  history.push(serialized);

  // Enforce limit
  if (history.length > HISTORY_LIMIT) {
    history.shift();
  } else {
    historyIndex++;
  }

  // Keep index valid after shifting
  if (historyIndex > history.length - 1) {
    historyIndex = history.length - 1;
  }

  console.log(`History saved. index=${historyIndex}, total=${history.length}`);
}

function scheduleSaveState() {
  if (isInitialLoad || isRestoringHistory) return;

  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    pushHistoryState();
  }, SAVE_DEBOUNCE_MS);
}

// Save state when canvas changes
canvas.on("object:added", scheduleSaveState);
canvas.on("object:modified", scheduleSaveState);
canvas.on("object:removed", scheduleSaveState);
canvas.on("path:created", scheduleSaveState); // for drawing tools later

async function undo() {
  if (historyIndex <= 0) {
    console.log("Undo: nothing to undo");
    return;
  }

  historyIndex--;
  const prevState = history[historyIndex];

  isRestoringHistory = true;
  await loadCanvasFromSerialized(prevState);
  isRestoringHistory = false;

  console.log("Undo applied. index=", historyIndex);
}

async function redo() {
  if (historyIndex >= history.length - 1) {
    console.log("Redo: nothing to redo");
    return;
  }

  historyIndex++;
  const nextState = history[historyIndex];

  isRestoringHistory = true;
  await loadCanvasFromSerialized(nextState);
  isRestoringHistory = false;

  console.log("Redo applied. index=", historyIndex);
}

document.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

  // Undo: Cmd/Ctrl + Z
  if (ctrlOrCmd && e.key.toLowerCase() === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  }

  // Redo: Cmd/Ctrl + Shift + Z
  if (ctrlOrCmd && e.key.toLowerCase() === "z" && e.shiftKey) {
    e.preventDefault();
    redo();
  }
});



// -----------------------------
// 4. Load image (if provided)
// -----------------------------
if (imageUrl) {
  fabric.Image.fromURL(
    imageUrl,
    (img) => {
      baseImageObject = img; // 👈 ADD THIS LINE FIRST

      // Scale image to fit canvas
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      const scale = Math.min(
        canvasWidth / img.width,
        canvasHeight / img.height
      );

      img.set({
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: "center",
        originY: "center",
        scaleX: scale,
        scaleY: scale,
        selectable: true
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      
// Initial load complete → allow history saves
isInitialLoad = false;

// Save first history state so undo works
pushHistoryState();
      console.log("Image loaded into Fabric canvas");
    },
    {
      crossOrigin: "anonymous" // IMPORTANT for Bubble/Imgix
    }
  );
} else {
  // Blank canvas case
  isInitialLoad = false;
  pushHistoryState();
  console.warn("No image URL provided — starting with blank canvas");
}

// -----------------------------
// 5. Editor ready signal
// -----------------------------
console.log("Editor loaded and running");
