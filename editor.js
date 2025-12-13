// Read URL params sent from Bubble
const urlParams = new URLSearchParams(window.location.search);
const imgURL = urlParams.get("img");
const userID = urlParams.get("user_id");
const assetID = urlParams.get("asset");

// Initialize canvas
const canvas = new fabric.Canvas("editor-canvas", {
  backgroundColor: "#111",
  width: window.innerWidth,
  height: window.innerHeight - 80
});

// Load image into canvas
fabric.Image.fromURL(imgURL, function(img) {
  img.scaleToWidth(canvas.width);
  canvas.add(img);
  canvas.renderAll();
});

// ===== Filters =====

function applyGrain() {
  canvas.getObjects()[0].filters.push(new fabric.Image.filters.Noise({ noise: 150 }));
  canvas.getObjects()[0].applyFilters();
  canvas.renderAll();
}

function applyLofi() {
  canvas.getObjects()[0].filters.push(new fabric.Image.filters.Sepia());
  canvas.getObjects()[0].applyFilters();
  canvas.renderAll();
}

function applyFilterPreset() {
  canvas.getObjects()[0].filters.push(new fabric.Image.filters.Contrast({ contrast: 0.4 }));
  canvas.getObjects()[0].applyFilters();
  canvas.renderAll();
}

// ===== Export to Bubble API Endpoint =====

async function exportImage() {
  canvas.discardActiveObject();
  const dataURL = canvas.toDataURL({ format: "png" });

  const blob = await (await fetch(dataURL)).blob();
  const formData = new FormData();

  formData.append("file", blob, "edit.png");
  formData.append("user_id", userID);
  formData.append("original_asset_id", assetID);

  const response = await fetch("https://yourapp.bubbleapps.io/api/1.1/wf/save_edited_image", {
    method: "POST",
    body: formData
  });

  alert("Saved to your Workspace!");
}
ßß