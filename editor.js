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

    case "EXPORT_IMAGE_
