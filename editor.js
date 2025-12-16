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
// Phase 3: Tool state
// -----------------------------
let activeTool = "select"; // select | draw | text | crop

// -----------------------------
// Read query parameters
// -----------------------------
const params = new URLSearchParams(window.location.search);
let imageUrl = params.get("image");
const canvasId = params.get("id"); // optional for later

console.log("Raw image param:", imageUrl);
console.log("Canvas ID:", canvasId);

// -----------------------------
// Phase 2: Bubble API config (MVP)
// -----------------------------
// IMPORTANT: For MVP only. Do NOT keep secrets in frontend long-term.
const BUBBLE_APP_BASE = "https://chrometica.bubbleapps.io/version-test"; // <-- replace
const BUBBLE_DATA_API_VERSION = "1.1";
const BUBBLE_API_TOKEN = "Bearer YOUR_API_TOKEN_HERE";   // <-- replace

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
// Phase 3: Editor command API
// -----------------------------
window.EditorAPI = {
  setTool(tool) {
    activeTool = tool;

    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.forEachObject(obj => obj.selectable = true);

    if (tool === "draw") {
      canvas.isDrawingMode = true;
    }

    console.log("Tool set to:", tool);
  },

  setBrushSize(size) {
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = Number(size);
      console.log("Brush size set to:", size);
    }
  },

  addText() {
    const text = new fabric.IText("Type here", {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: "center",
      originY: "center",
      fontSize: 40,
      fill: "#ffffff"
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    console.log("Text added");
  },

  applyFilters(filters) {
    if (!baseImageObject) {
      console.warn("No base image for filters");
      return;
    }

    baseImageObject.filters = [];

    if (filters.brightness !== 0) {
      baseImageObject.filters.push(
        new fabric.Image.filters.Brightness({ brightness: filters.brightness })
      );
    }

    if (filters.contrast !== 0) {
      baseImageObject.filters.push(
        new fabric.Image.filters.Contrast({ contrast: filters.contrast })
      );
    }

    if (filters.saturation !== 0) {
      baseImageObject.filters.push(
        new fabric.Image.filters.Saturation({ saturation: filters.saturation })
      );
    }

    baseImageObject.applyFilters();
    canvas.requestRenderAll();
    console.log("Filters applied:", filters);
  },

  exportPNG() {
    const dataURL = canvas.toDataURL({
      format: "png",
      quality: 1
    });

    window.parent.postMessage(
      { type: "EXPORT_IMAGE", dataURL },
      "*"
    );
  }
};

// -----------------------------
// Phase 3: Listen for Bubble commands
// -----------------------------
window.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  if (!type) return;

  switch (type) {
    case "SET_TOOL":
      window.EditorAPI.setTool(payload);
      break;

    case "SET_BRUSH_SIZE":
      window.EditorAPI.setBrushSize(payload);
      break;

    case "ADD_TEXT":
      window.EditorAPI.addText();
      break;

    case "APPLY_FILTERS":
      window.EditorAPI.applyFilters(payload);
      break;

    case "EXPORT_PNG":
      window.EditorAPI.exportPNG();
      break;

    default:
      console.warn("Unknown editor command:", type);
  }
});


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
async function saveCanvasJsonToBubble(jsonString) {
  if (!canvasId) {
    console.warn("Autosave skipped: no canvasId provided in URL (?id=...)");
    return;
  }

  const url = `${BUBBLE_APP_BASE}/api/${BUBBLE_DATA_API_VERSION}/obj/canvas/${canvasId}`;

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": BUBBLE_API_TOKEN
      },
      body: JSON.stringify({
        editor_json: jsonString
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Autosave failed:", res.status, text);
      return;
    }

    console.log("Autosaved to Bubble ✅");
  } catch (err) {
    console.error("Autosave error:", err);
  }
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
  scheduleAutosave();

}

function scheduleSaveState() {
  if (isInitialLoad || isRestoringHistory) return;

  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    pushHistoryState();
  }, SAVE_DEBOUNCE_MS);
}

let autosaveTimeout = null;
const AUTOSAVE_DEBOUNCE_MS = 1500; // 1.5s after user stops editing

function scheduleAutosave() {
  if (isInitialLoad || isRestoringHistory) return;

  if (autosaveTimeout) clearTimeout(autosaveTimeout);

  autosaveTimeout = setTimeout(() => {
    const jsonString = serializeCanvas();
    saveCanvasJsonToBubble(jsonString);
  }, AUTOSAVE_DEBOUNCE_MS);
}

async function fetchCanvasJsonFromBubble() {
  if (!canvasId) return null;

  const url = `${BUBBLE_APP_BASE}/api/${BUBBLE_DATA_API_VERSION}/obj/canvas/${canvasId}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": BUBBLE_API_TOKEN
      }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Fetch canvas failed:", res.status, text);
      return null;
    }

    const data = await res.json();

    // Bubble Data API returns object fields in "response"
    // Depending on your API settings it may return:
    // data.response.editor_json OR data.response.editor_json (common)
    const editorJson = data?.response?.editor_json || null;

    return editorJson;
  } catch (err) {
    console.error("Fetch canvas error:", err);
    return null;
  }
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
// 4. Load saved JSON OR load image
// -----------------------------
(async function init() {
  // 1) Try to load saved canvas JSON from Bubble
  const savedJson = await fetchCanvasJsonFromBubble();

  if (savedJson) {
    console.log("Found saved editor_json — loading canvas from JSON...");

    isRestoringHistory = true;
   await loadCanvasFromSerialized(savedJson);

// Restore base image reference
baseImageObject = canvas.getObjects().find(obj => obj.type === "image") || null;

isRestoringHistory = false;

    // Initial load complete
    isInitialLoad = false;

    // Save first history state (so undo starts clean)
    pushHistoryState();

    console.log("Canvas restored from saved JSON ✅");
    console.log("Editor loaded and running");
    return;
  }

  // 2) No JSON saved yet → fallback to loading the initial image
  console.log("No saved JSON found — loading from image param...");

  if (imageUrl) {
    fabric.Image.fromURL(
      imageUrl,
      (img) => {
        baseImageObject = img;

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

        // Initial load complete
        isInitialLoad = false;

        // Save first history state
        pushHistoryState();

        console.log("Image loaded into Fabric canvas");
        console.log("Editor loaded and running");
      },
      { crossOrigin: "anonymous" }
    );
  } else {
    // Blank canvas
    isInitialLoad = false;
    pushHistoryState();
    console.warn("No image URL provided — starting with blank canvas");
    console.log("Editor loaded and running");
  }
})();
