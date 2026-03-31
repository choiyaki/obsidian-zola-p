// home.js

document.addEventListener("DOMContentLoaded", function() {
  const container = document.getElementById("home-card-container");
  const sortSelect = document.getElementById("home-sort-select");

  if (!container || typeof page_data === "undefined") return;

  // page_data includes: url, title, modified, created, content
  let pages = [...page_data];
  
  const ITEMS_PER_PAGE = 50;
  const ITEMS_PER_LOAD = 20;
  let currentlyDisplayed = 0;
  let currentObserver = null;

  // Helper to format date
  function formatDate(timestamp) {
    if (!timestamp) return "";
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString();
  }
  
  // Helper to build snippet securely with blue link text and no URLs
  function buildSnippetDOM(content, container) {
    if (!content) return;
    
    let text = content.replace(/^[#>\-\*]+\s/gm, ""); // Remove list and header markers
    text = text.replace(/[*`_]/g, ""); // Remove basic formatting
    text = text.replace(/\n+/g, " "); // Single line
    
    const linkRegex = /\[([^\]]+)\]\([^)]+\)/g;
    let lastIndex = 0;
    let match;
    let charsAdded = 0;
    const MAX_CHARS = 200;
    
    while ((match = linkRegex.exec(text)) !== null) {
      const beforeText = text.substring(lastIndex, match.index);
      if (beforeText) {
          const cut = beforeText.substring(0, MAX_CHARS - charsAdded);
          container.appendChild(document.createTextNode(cut));
          charsAdded += cut.length;
      }
      if (charsAdded >= MAX_CHARS) break;
      
      const linkText = match[1];
      const cutLink = linkText.substring(0, MAX_CHARS - charsAdded);
      const span = document.createElement("span");
      span.style.color = "#3a7bd5";
      span.textContent = cutLink;
      container.appendChild(span);
      charsAdded += cutLink.length;
      
      lastIndex = linkRegex.lastIndex;
      if (charsAdded >= MAX_CHARS) break;
    }
    
    if (charsAdded < MAX_CHARS) {
      const remaining = text.substring(lastIndex, lastIndex + (MAX_CHARS - charsAdded));
      container.appendChild(document.createTextNode(remaining));
      charsAdded += remaining.length;
    }
    
    if (text.length > lastIndex + (MAX_CHARS - charsAdded) || charsAdded >= MAX_CHARS) {
      container.appendChild(document.createTextNode("..."));
    }
  }

  // Create a single card DOM element
  function createCard(page) {
    const card = document.createElement("a");
    card.href = page.url;
    card.className = "home-card text-decoration-none";
    
    // Title
    const title = document.createElement("h5");
    title.className = "home-card-title";
    title.textContent = page.title;
    
    // Body Container
    const body = document.createElement("div");
    body.className = "home-card-body";
    
    // Snippet
    if (page.content) {
      const snippet = document.createElement("div"); // Use div to hold block content
      snippet.className = "home-card-snippet text-muted";
      snippet.style.fontSize = "0.85rem";
      snippet.style.lineHeight = "1.4";
      snippet.style.margin = "0 0 12px 0";
      snippet.style.display = "-webkit-box";
      snippet.style.webkitLineClamp = "4";
      snippet.style.webkitBoxOrient = "vertical";
      snippet.style.overflow = "hidden";
      buildSnippetDOM(page.content, snippet);
      body.appendChild(snippet);
    }

    // Meta (Date)
    const meta = document.createElement("div");
    meta.className = "home-card-meta text-muted mt-auto";
    meta.style.fontSize = "0.75rem";
    meta.textContent = `Updated: ${formatDate(page.modified)}`;
    body.appendChild(meta);

    card.appendChild(title);
    card.appendChild(body);
    return card;
  }

  // Append items to container
  function appendItems(startIndex, count) {
    const fragment = document.createDocumentFragment();
    const endIndex = Math.min(startIndex + count, pages.length);
    
    for (let i = startIndex; i < endIndex; i++) {
        fragment.appendChild(createCard(pages[i]));
    }
    
    // Insert before the observer trigger if it exists
    const trigger = document.getElementById("infinite-scroll-trigger");
    if (trigger) {
        container.insertBefore(fragment, trigger);
    } else {
        container.appendChild(fragment);
    }
    
    currentlyDisplayed = endIndex;
    
    // If all items are loaded, remove observer trigger
    if (currentlyDisplayed >= pages.length && trigger) {
        trigger.remove();
        if (currentObserver) currentObserver.disconnect();
    }
  }

  // Setup Observer
  function setupObserver() {
      // Remove old trigger if any
      let oldTrigger = document.getElementById("infinite-scroll-trigger");
      if (oldTrigger) oldTrigger.remove();
      
      if (currentlyDisplayed >= pages.length) return;
      
      const trigger = document.createElement("div");
      trigger.id = "infinite-scroll-trigger";
      trigger.style.height = "20px";
      trigger.style.width = "100%";
      container.appendChild(trigger);
      
      if (currentObserver) {
          currentObserver.disconnect();
      }
      
      currentObserver = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
              appendItems(currentlyDisplayed, ITEMS_PER_LOAD);
          }
      }, { rootMargin: "100px" });
      
      currentObserver.observe(trigger);
  }

  // Initial render cards
  function renderAll() {
    container.innerHTML = "";
    if (pages.length === 0) {
      container.innerHTML = "<p class='text-muted'>No pages found.</p>";
      return;
    }

    currentlyDisplayed = 0;
    appendItems(0, ITEMS_PER_PAGE);
    setupObserver();
  }

  // Sort logic
  function sortPages() {
    if (!sortSelect) return;
    const sortBy = sortSelect.value;
    if (sortBy === "updated") {
      pages.sort((a, b) => b.modified - a.modified);
    } else if (sortBy === "created") {
      pages.sort((a, b) => b.created - a.created);
    } else if (sortBy === "title") {
      pages.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    renderAll();
  }

  // Event Listeners
  if (sortSelect) {
      sortSelect.addEventListener("change", sortPages);
  }

  // Initial render (default sort is updated)
  sortPages();
});
