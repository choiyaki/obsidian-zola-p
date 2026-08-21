// 本文中の画像サイズを調整する。
// 「表示幅 + 表示高さ」が本文のテキスト表示幅と等しくなるように、
// 画像の縦横比を保ったまま幅を計算する。
// (displayWidth + displayHeight = textWidth になるよう displayWidth を逆算)
(function () {
  function getTextWidth(container) {
    var style = getComputedStyle(container);
    var paddingLeft = parseFloat(style.paddingLeft) || 0;
    var paddingRight = parseFloat(style.paddingRight) || 0;
    return container.clientWidth - paddingLeft - paddingRight;
  }

  function fitImage(img) {
    var naturalWidth = img.naturalWidth;
    var naturalHeight = img.naturalHeight;
    if (!naturalWidth || !naturalHeight) return;

    var container = img.closest(".page-content-column") || img.parentElement;
    if (!container) return;

    var textWidth = getTextWidth(container);
    if (!textWidth || textWidth <= 0) return;

    // width + height = textWidth, height = width * (naturalHeight / naturalWidth) を解く
    var targetWidth = (textWidth * naturalWidth) / (naturalWidth + naturalHeight);

    // 元画像の解像度以上には拡大しない(ぼやけ防止)
    targetWidth = Math.min(targetWidth, naturalWidth);

    img.style.width = targetWidth + "px";
    img.style.height = "auto";
  }

  function fitAllImages() {
    var images = document.querySelectorAll(".page-content-column img");
    images.forEach(function (img) {
      if (img.complete && img.naturalWidth) {
        fitImage(img);
      } else {
        img.addEventListener("load", function () {
          fitImage(img);
        });
      }
    });
  }

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitAllImages, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fitAllImages);
  } else {
    fitAllImages();
  }
  window.addEventListener("resize", onResize);
})();
