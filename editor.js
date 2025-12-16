/*************************************************
 * Editor.js
 * Bubble → Fabric editor bootstrap
 *************************************************/

// -----------------------------
// 1. Read query parameters
// -----------------------------
const params = new URLSearchParams(window.location.search);
let imageUrl = params.get("image");
const canvasId = params.get("id"); // optional, future use

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
// 4. Load image (if provided)
// -----------------------------
if (imageUrl) {
  fabric.Image.fromURL(
    imageUrl,
    (img) => {
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

      console.log("Image loaded into Fabric canvas");
    },
    {
      crossOrigin: "anonymous" // IMPORTANT for Bubble/Imgix
    }
  );
} else {
  console.warn("No image URL provided — starting with blank canvas");
}

// -----------------------------
// 5. Editor ready signal
// -----------------------------
console.log("Editor loaded and running");
