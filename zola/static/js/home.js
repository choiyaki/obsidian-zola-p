// home.js

document.addEventListener("DOMContentLoaded", function() {
  const container = document.getElementById("home-card-container");
  const searchInput = document.getElementById("home-search-input");
  const sortSelect = document.getElementById("home-sort-select");

  if (!container || typeof page_data === "undefined") return;

  // page_data includes: url, title, modified, created
  let pages = [...page_data];

  // Helper to format date
  function formatDate(timestamp) {
    if (!timestamp) return "";
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString();
  }

  // Render cards
  function renderCards(data) {
    container.innerHTML = "";
    if (data.length === 0) {
      container.innerHTML = "<p class='text-muted'>No pages found.</p>";
      return;
    }

    const fragment = document.createDocumentFragment();
    data.forEach(page => {
      const card = document.createElement("a");
      card.href = page.url;
      card.className = "home-card text-decoration-none";
      
      const title = document.createElement("h5");
      title.className = "home-card-title";
      title.textContent = page.title;

      const meta = document.createElement("div");
      meta.className = "home-card-meta text-muted mt-2";
      meta.style.fontSize = "0.85rem";
      meta.textContent = `Updated: ${formatDate(page.modified)}`;

      card.appendChild(title);
      card.appendChild(meta);
      fragment.appendChild(card);
    });
    container.appendChild(fragment);
  }

  // Sort logic
  function sortPages() {
    const sortBy = sortSelect.value;
    if (sortBy === "updated") {
      pages.sort((a, b) => b.modified - a.modified);
    } else if (sortBy === "created") {
      pages.sort((a, b) => b.created - a.created);
    } else if (sortBy === "title") {
      pages.sort((a, b) => a.title.localeCompare(b.title));
    }
    filterAndRender();
  }

  // Filter logic
  function filterAndRender() {
    const q = searchInput.value.toLowerCase().trim();
    let filtered = pages;
    if (q) {
      filtered = pages.filter(p => p.title.toLowerCase().includes(q));
    }
    renderCards(filtered);
  }

  // Event Listeners
  sortSelect.addEventListener("change", sortPages);
  searchInput.addEventListener("input", filterAndRender);

  // Initial render (default sort is updated)
  sortPages();
});
