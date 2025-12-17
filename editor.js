/*************************************************
 * Editor.js
 * Bubble → Fabric editor bootstrap
 *************************************************/

// =================================================
// Global editor state
// =================================================
let baseImageObject = null;
let activeTool = "select";

let isRestoringHistory = false;
let isInitialLoad = true;

const history = [];
let historyIndex = -1;
const HISTORY_LIMIT = 50;

let saveTimeout = null;
const SAVE_DEBOUNCE_MS = 250;

let autosaveTimeout = null;
const AUTOSAVE_DEBOUNCE_MS = 1500;

// =================================================
// Read query parameters
// =================================================
const params = new URLSearchParams(window.location.search);
let imageUrl = params.get("image");
const canvasId = params.get("id");

if (imageUrl && imageUrl.startsWith("//")) {
  imageUrl = "https:" + imageUrl;
}

console.log("Image URL:", imageUrl);
console.log("Canvas ID:", canvasId);

// =================================================
// Bubble API config (MVP ONLY)
// =================================================
const BUBBLE_APP_BASE = "https://chrometica.bubbleapps.io/version-test";
const BUBBLE_DATA_API_VERSION = "1.1";
const BUBBLE_API_TOKEN = "Bearer YOUR_API_TOKEN_HERE"; // ⚠️ do not commit real token

// =================================================
// Create Fabric canvas
// =================================================
const canvas = new fabric.Canvas("editor-canvas", {
  preserveObjectStacking: true,
  selection: true
});

// Expose globally for slider routing
window.canvas = canvas;
window.baseImageObject = null;

console.log("Fabric canvas initialized");

function resizeCanvasToDisplaySize() {
  const el = document.getElementById("editor-canvas");
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);

  if (width > 0 && height > 0) {
    canvas.setWidth(width);
    canvas.setHeight(height);
    canvas.calcOffset();
    canvas.requestRenderAll();
  }
}

function fitImageToCanvas(img) {
  resizeCanvasToDisplaySize();

  // 🔑 RESET any pan / zoom / transform
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.setZoom(1);

  const PADDING = 120;

  const availableWidth = canvas.getWidth() - (PADDING * 2);
  const availableHeight = canvas.getHeight() - (PADDING * 2);

  const safeW = Math.max(10, availableWidth);
  const safeH = Math.max(10, availableHeight);

  const scale = Math.min(
    safeW / img.width,
    safeH / img.height,
    1
  );

  const center = canvas.getCenter();

  img.set({
    originX: "center",
    originY: "center",
    left: center.left,
    top: center.top,
    scaleX: scale,
    scaleY: scale
  });

  img.setCoords();
}

// Run once on load
resizeCanvasToDisplaySize();

// Keep it correct if the page/iframe resizes
window.addEventListener("resize", resizeCanvasToDisplaySize);



// =================================================
// Editor API (non-slider commands)
// =================================================
window.EditorAPI = {
  setTool(tool) {
    activeTool = tool;
    canvas.isDrawingMode = false;
    canvas.selection = true;

    canvas.forEachObject(obj => (obj.selectable = true));

    if (tool === "draw") {
      canvas.isDrawingMode = true;
    }

    console.log("Tool set:", tool);
  },

  setBrushSize(size) {
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = Number(size);
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
  },

  exportPNG() {
    const dataURL = canvas.toDataURL({ format: "png", quality: 1 });
    window.parent.postMessage({ type: "EXPORT_IMAGE", dataURL }, "*");
  }
};

// =================================================
// Slider routing (Adjust / Filter / VFX)
// =================================================
function applySliderChange(panel, tool, value) {
  if (!canvas || !baseImageObject) {
    console.warn("Slider ignored: canvas or image missing");
    return;
  }

  switch (panel) {
    case "adjust":
      applyAdjustTool(tool, value);
      break;
    case "filter":
      applyFilterTool(tool, value);
      break;
    case "vfx":
      applyVFXTool(tool, value);
      break;
    default:
      console.warn("Unknown slider panel:", panel);
  }

  canvas.requestRenderAll();
}

// ----------------- Adjust -----------------
function applyAdjustTool(tool, value) {
  const img = baseImageObject;
  img.filters = img.filters || [];

  const v = value / 100;

  switch (tool) {
    // ---------------- BASIC ----------------
    case "brightness":
      img.filters[0] = new fabric.Image.filters.Brightness({ brightness: v });
      break;

    case "contrast":
      img.filters[1] = new fabric.Image.filters.Contrast({ contrast: v });
      break;

    case "saturation":
      if (fabric.Image.filters.Saturation) {
        img.filters[2] = new fabric.Image.filters.Saturation({ saturation: v });
      }
      break;

    // ---------------- HIGHLIGHTS ----------------
    case "highlights": {
      // RIGHT → brighter highlights
      // LEFT → highlight recovery
      const brightness = 0.25 * v;
      const contrast = 0.35 * v;

      img.filters[3] = new fabric.Image.filters.Brightness({ brightness });
      img.filters[4] = new fabric.Image.filters.Contrast({ contrast });
      break;
    }

    // ---------------- SHADOWS ----------------
    case "shadows": {
      // RIGHT → lifted, faded shadows
      // LEFT → deeper, richer shadows
      const brightness = 0.35 * v;
      const contrast = -0.25 * v;

      img.filters[5] = new fabric.Image.filters.Brightness({ brightness });
      img.filters[6] = new fabric.Image.filters.Contrast({ contrast });
      break;
    }

    // ---------------- SHARPEN ----------------
    case "sharpen": {
      if (value <= 0) {
        img.filters[7] = null;
        break;
      }

      const intensity = value / 100;

      img.filters[7] = new fabric.Image.filters.Convolute({
        matrix: [
          0, -1 * intensity, 0,
          -1 * intensity, 1 + 4 * intensity, -1 * intensity,
          0, -1 * intensity, 0
        ]
      });
      break;
    }

    default:
      console.warn("Unknown adjust tool:", tool);
      return;
  }

  img.applyFilters();
}

// ----------------- Filters -----------------
function applyFilterTool(tool, value) {
  const img = baseImageObject;
  img.filters = img.filters || [];

  const v = value / 100;

  switch (tool) {
    case "warm":
      img.filters[10] = new fabric.Image.filters.BlendColor({
        color: "#f2c27b",
        mode: "multiply",
        alpha: v
      });
      break;

    case "vintage":
      img.filters[11] = new fabric.Image.filters.Sepia();
      break;

    default:
      console.warn("Unknown filter tool:", tool);
      return;
  }

  img.applyFilters();
}

// ----------------- VFX -----------------
function applyVFXTool(tool, value) {
  const img = baseImageObject;
  img.filters = img.filters || [];

  const v = value / 100;

  switch (tool) {
    case "grain":
      img.filters[20] = new fabric.Image.filters.Noise({ noise: value });
      break;

    case "blur":
      if (fabric.Image.filters.Blur) {
        img.filters[21] = new fabric.Image.filters.Blur({ blur: v });
      }
      break;

    default:
      console.warn("Unknown VFX tool:", tool);
      return;
  }

  img.applyFilters();
}

// =================================================
// Unified message listener (Bubble → iframe)
// =================================================
window.addEventListener("message", (event) => {
  const data = event.data || {};
  const type = data.type;

  if (!type) return;

  // Slider updates
  if (type === "SLIDER_CHANGE") {
    const { panel, tool } = data;
    const value = Number(data.value);

    if (!tool || Number.isNaN(value)) return;
    applySliderChange(panel, tool, value);
    return;
  }

  // Editor commands
  const payload = data.payload;

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
    case "EXPORT_PNG":
      window.EditorAPI.exportPNG();
      break;
    default:
      console.warn("Unknown message type:", type);
  }
});

// =================================================
// History / Autosave
// =================================================
function serializeCanvas() {
  return JSON.stringify(canvas.toJSON());
}

function scheduleSaveState() {
  if (isInitialLoad || isRestoringHistory) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(pushHistoryState, SAVE_DEBOUNCE_MS);
}

function pushHistoryState() {
  const serialized = serializeCanvas();

  if (historyIndex < history.length - 1) {
    history.splice(historyIndex + 1);
  }

  if (history[history.length - 1] === serialized) return;

  history.push(serialized);
  if (history.length > HISTORY_LIMIT) history.shift();
  historyIndex = history.length - 1;

  scheduleAutosave();
}

function scheduleAutosave() {
  if (isInitialLoad || isRestoringHistory) return;
  clearTimeout(autosaveTimeout);

  autosaveTimeout = setTimeout(async () => {
    if (!canvasId) return;
    const url = `${BUBBLE_APP_BASE}/api/${BUBBLE_DATA_API_VERSION}/obj/canvas/${canvasId}`;

    try {
      await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: BUBBLE_API_TOKEN
        },
        body: JSON.stringify({ editor_json: serializeCanvas() })
      });
    } catch (err) {
      console.error("Autosave failed:", err);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
}

canvas.on("object:added", scheduleSaveState);
canvas.on("object:modified", scheduleSaveState);
canvas.on("object:removed", scheduleSaveState);
canvas.on("path:created", scheduleSaveState);

// =================================================
// Load saved JSON OR initial image
// =================================================
(async function init() {
  async function fetchSavedJson() {
    if (!canvasId) return null;
    try {
      const res = await fetch(
        `${BUBBLE_APP_BASE}/api/${BUBBLE_DATA_API_VERSION}/obj/canvas/${canvasId}`,
        { headers: { Authorization: BUBBLE_API_TOKEN } }
      );
      const data = await res.json();
      return data?.response?.editor_json || null;
    } catch {
      return null;
    }
  }

  const savedJson = await fetchSavedJson();

  if (savedJson) {
    isRestoringHistory = true;
    canvas.loadFromJSON(JSON.parse(savedJson), () => {
      canvas.renderAll();
      baseImageObject = canvas.getObjects().find(o => o.type === "image") || null;
      window.baseImageObject = baseImageObject;
      isRestoringHistory = false;
      isInitialLoad = false;
      pushHistoryState();
    });
    return;
  }

  if (!imageUrl) {
    isInitialLoad = false;
    pushHistoryState();
    return;
  }

  fabric.Image.fromURL(
    imageUrl,
    (img) => {
      // Make sure Fabric size matches the visible canvas BEFORE we fit the image
fitImageToCanvas(img);

      baseImageObject = img;
      window.baseImageObject = baseImageObject;

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();

canvas.calcOffset();

setTimeout(() => {
  fitImageToCanvas(img);
  canvas.renderAll();
  canvas.calcOffset();
}, 60);
      
      isInitialLoad = false;
      pushHistoryState();
    },
    { crossOrigin: "anonymous" }
  );
})();
