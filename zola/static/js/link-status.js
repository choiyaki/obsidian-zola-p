// Marks in-content links that point to pages which don't actually exist
// (only created as an empty stub because something links to them),
// Cosense/Scrapbox-style.
document.addEventListener("DOMContentLoaded", function () {
  if (typeof missing_pages === "undefined" || !missing_pages.length) return;

  var container = document.querySelector(".docs-content");
  if (!container) return;

  var missing = new Set(
    missing_pages.map(function (url) {
      return decodeURI(url);
    })
  );

  var anchors = container.querySelectorAll('a[href^="/docs/"]');
  anchors.forEach(function (a) {
    var href = decodeURI(a.getAttribute("href").split("#")[0]);
    if (missing.has(href)) {
      a.classList.add("link-missing");
    }
  });
});
