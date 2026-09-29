// Set each screenshot's aspect ratio as a CSS variable for figure.css

function setRatio(img) {
  if (img.naturalWidth) {
    img.style.setProperty("--ratio", img.naturalWidth / img.naturalHeight);
  }
}

for (const img of document.querySelectorAll("figure.shot > img")) {
  if (img.complete) setRatio(img);
  img.addEventListener("load", () => setRatio(img));
}
