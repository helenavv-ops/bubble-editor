console.log("Editor loaded and running");

window.addEventListener("message", function (event) {
  console.log("Message received from Bubble:", event.data);
});
