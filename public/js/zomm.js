const mainImage = document.getElementById("main-product-image");
const zoomLens = document.getElementById("zoom-lens");
const zoomResult = document.getElementById("zoom-result");

mainImage.addEventListener("mousemove", zoomImage);
mainImage.addEventListener("mouseleave", hideZoom);

function zoomImage(event) {
  const bounds = mainImage.getBoundingClientRect();
  const lensWidth = zoomLens.offsetWidth / 2;
  const lensHeight = zoomLens.offsetHeight / 2;

  // Calculate cursor position relative to the image
  let x = event.clientX - bounds.left - lensWidth;
  let y = event.clientY - bounds.top - lensHeight;

  // Prevent lens from going out of bounds
  x = Math.max(0, Math.min(x, bounds.width - zoomLens.offsetWidth));
  y = Math.max(0, Math.min(y, bounds.height - zoomLens.offsetHeight));

  zoomLens.style.left = `${x}px`;
  zoomLens.style.top = `${y}px`;
  zoomLens.style.visibility = "visible";
  zoomResult.style.display = "block";

  // Set zoomed background position
  const zoomX = (x / bounds.width) * 100;
  const zoomY = (y / bounds.height) * 100;

  zoomResult.style.backgroundImage = `url('${mainImage.src}')`;
  zoomResult.style.backgroundPosition = `${zoomX}% ${zoomY}%`;
}

function hideZoom() {
  zoomLens.style.visibility = "hidden";
  zoomResult.style.display = "none";
}
