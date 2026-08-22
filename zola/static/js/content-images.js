(function () {
  "use strict";

  var CONTENT_SELECTOR = ".page.single article, .docs.single .docs-content";
  var IMAGE_SELECTOR = ".page.single article img, .docs.single .docs-content img";
  var EXCLUDED_SELECTOR = "#list, .home-card, .link-card-grid, .graph";

  function resizeImage(image) {
    var content = image.closest(CONTENT_SELECTOR);
    if (!content || image.closest(EXCLUDED_SELECTOR)) return;

    var naturalWidth = image.naturalWidth;
    var naturalHeight = image.naturalHeight;
    var contentStyle = getComputedStyle(content);
    var contentWidth = content.clientWidth
      - parseFloat(contentStyle.paddingLeft)
      - parseFloat(contentStyle.paddingRight);

    if (!naturalWidth || !naturalHeight || !contentWidth) return;

    // Preserve the source aspect ratio while making:
    // rendered width + rendered height = text content width.
    var scale = contentWidth / (naturalWidth + naturalHeight);
    image.style.width = naturalWidth * scale + "px";
    image.style.height = naturalHeight * scale + "px";
    image.style.maxWidth = "none";
    image.classList.add("content-size-balanced");
  }

  function resizeAllImages() {
    document.querySelectorAll(IMAGE_SELECTOR).forEach(function (image) {
      if (image.complete) {
        resizeImage(image);
      } else {
        image.addEventListener("load", function () {
          resizeImage(image);
        }, { once: true });
      }
    });
  }

  resizeAllImages();
  window.addEventListener("resize", resizeAllImages);
})();
