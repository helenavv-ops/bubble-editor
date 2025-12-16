console.log("Editor loaded and running");

let canvas;

/* -----------------------------------
   1. Initialize Fabric Canvas
----------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  canvas = new fabric.Canvas("editor-canvas", {
    preserveObjectStacking: true,
    selection: false
  });

  const container = document.getElementById("editor-container");

  canvas.setWidth(container.clientWidth);
  canvas.setHeight(container.clientHeight);
  canvas.setBackgroundColor("#2E2E2E", canvas.renderAll.bind(canvas));

  console.log("Fabric canvas initialized");
});

/* -----------------------------------
   2. Message Router (from Bubble)
----------------------------------- */
window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case "FILTER_SET":
      handleFilter(msg.name, msg.value);
      break;

    case "LOAD_IMAGE":
      loadImage(msg.url);
      break;

    case "EXPORT_IMAGE":
      exportImage();
      break;

    default:
      console.warn("Unknown message type:", msg.type);
  }
});

/* -----------------------------------
   3. Image Loader
----------------------------------- */
function loadImage(url) {
  if (!canvas) {
    console.warn("Canvas not initialized yet");
    return;
  }

  console.log("Loading image:", url);

  fabric.Image.fromURL(
    url,
    (img) => {
      canvas.clear();

      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      const scale = Math.min(
        canvasWidth / img.width,
        canvasHeight / img.height
      );

      img.set({
        originX: "center",
        originY: "center",
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: false
      });

      canvas.add(img);
      canvas.renderAll();
    },
    { crossOrigin: "anonymous" }
  );
}

/* -----------------------------------
   4. Filter Handler (stub for now)
----------------------------------- */
function handleFilter(name, value) {
  console.log("Filter:", name, value);
  canvas.renderAll();
}

/* -----------------------------------
   5. Export Image
----------------------------------- */
function exportImage() {
  if (!canvas) return;

  const dataUR
