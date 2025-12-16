console.log("Editor loaded and running");

let canvas;

/* -----------------------------------
   1. Initialize Fabric Canvas
----------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("editor-container");

  canvas = new fabric.Canvas("editor-canvas", {
    preserveObjectStacking: true,
    selection: false
  });

  canvas.setWidth(container.clientWidth);
  canvas.setHeight(container.clientHeight);

  canvas.setBackgroundColor("#2E2E2E", canvas.renderAll.bind(canvas));

  console.log("Fabric canvas initialized");
});

/* -----------------------------------
   2. Receive messages from Bubble
----------------------------------- */
window.addEventListener("message", (event) => {
  console.log("🟢 IFRAME RECEIVED MESSAGE:", event.data);

  if (!event.data || !event.data.type) return;

  if (event.data.type === "LOAD_IMAGE") {
    loadImage(event.data.url);
  }
});

/* -----------------------------------
   3. Load image into Fabric
----------------------------------- */
function loadImage(url) {
  if (!canvas) {
    console.warn("Canvas not ready yet");
    return;
  }

  console.log("Loading image:", url);

  fabric.Image.fromURL(
    url,
    (img) => {
      canvas.clear();

      const cw = canvas.getWidth();
      const ch = canvas.getHeight();

      const scale = Math.min(cw / img.width, ch / img.height);

      img.set({
        originX: "center",
        originY: "center",
        left: cw / 2,
        top: ch / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: false
      });

      canvas.add(img);
      canvas.renderAll();

      console.log("✅ Image rendered on canvas");
    },
    {
      crossOrigin: "anonymous"
    }
  );
}
