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

   case "EXPORT_IMAGE":
  exportImage();
  break;

function loadImage(url) {
  // Safety check: if canvas isn't ready yet, do nothing
  if (!canvas) {
    console.warn("Canvas not initialized yet");
    return;
  }

  // Load image from URL using Fabric.js
  fabric.Image.fromURL(
    url,

    // Callback runs AFTER the image is fully loaded
    (img) => {

      // Clear anything currently on the canvas
      // (this keeps it single-image for now)
      canvas.clear();

      // Get canvas dimensions
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      // Calculate scale so image fits inside canvas
      // without stretching or cropping
      const scale = Math.min(
        canvasWidth / img.width,
        canvasHeight / img.height
      );

      // Apply positioning + scaling to the image
      img.set({
        originX: "center",          // center horizontally
        originY: "center",          // center vertically
        left: canvasWidth / 2,      // move to center X
        top: canvasHeight / 2,      // move to center Y
        scaleX: scale,              // scale proportionally
        scaleY: scale,
        selectable: false           // user cannot drag/select
      });

      // Add image to canvas
      canvas.add(img);

      // Force redraw
      canvas.renderAll();
    },

    // Required so images from Bubble / S3 / CDN load correctly
    { crossO
