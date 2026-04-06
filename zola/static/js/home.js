// home.js

document.addEventListener("DOMContentLoaded", function() {
  const container = document.getElementById("home-card-container");
  const sortSelect = document.getElementById("home-sort-select");

  if (!container || typeof page_data === "undefined") return;

  // page_data includes: url, title, modified, created, content
  let pages = page_data.map((page) => ({
    ...page,
    _modifiedTs: parseTimestamp(page.modified),
    _createdTs: parseTimestamp(page.created),
  }));
  
  const INITIAL_ITEMS = 24;
  const ITEMS_PER_LOAD = 24;
  let currentlyDisplayed = 0;
  let isLoadingMore = false;
  let observer = null;
  let sentinel = null;

  // Helper to format date
  function formatDate(timestamp) {
    if (!timestamp) return "";
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString();
  }

  function parseTimestamp(value) {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const num = Number(value);
      if (!Number.isNaN(num)) return num;
      const dt = Date.parse(value);
      if (!Number.isNaN(dt)) return dt / 1000;
    }
    return 0;
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
    
    if (page.thumbnail) {
      const imgContainer = document.createElement("div");
      imgContainer.className = "home-card-thumbnail-container";
      
      const img = document.createElement("img");
      img.src = page.thumbnail;
      img.className = "home-card-thumbnail";
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = function() { this.style.display = 'none'; };
      
      imgContainer.appendChild(img);
      body.appendChild(imgContainer);
    } else if (page.content) {
      // Snippet
      const snippet = document.createElement("div"); // Use div to hold block content
      snippet.className = "home-card-snippet text-muted";
      snippet.style.fontSize = "0.85rem";
      snippet.style.lineHeight = "1.4";
      snippet.style.margin = "0 0 12px 0";
      snippet.style.display = "-webkit-box";
      snippet.style.webkitLineClamp = "8";
      snippet.style.webkitBoxOrient = "vertical";
      snippet.style.overflow = "hidden";
      buildSnippetDOM(page.content, snippet);
      body.appendChild(snippet);
    }

    // Meta (Date)
    const meta = document.createElement("div");
    meta.className = "home-card-meta text-muted mt-auto";
    meta.style.fontSize = "0.7rem";
    meta.style.display = "none"; // Hide date to match Cosense/Scrapbox style
    meta.textContent = `Updated: ${formatDate(page.modified)}`;
    body.appendChild(meta);

    card.appendChild(title);
    card.appendChild(body);
    return card;
  }

  // Append items to container
  function appendItems(startIndex, count) {
    if (isLoadingMore) return;

    isLoadingMore = true;
    const fragment = document.createDocumentFragment();
    const endIndex = Math.min(startIndex + count, pages.length);
    
    for (let i = startIndex; i < endIndex; i++) {
        fragment.appendChild(createCard(pages[i]));
    }

    if (sentinel && sentinel.isConnected) {
      container.insertBefore(fragment, sentinel);
      container.appendChild(sentinel);
    } else {
      container.appendChild(fragment);
    }
    
    currentlyDisplayed = endIndex;
    isLoadingMore = false;

    if (sentinel) {
      sentinel.hidden = currentlyDisplayed >= pages.length;
    }
  }

  function ensureSentinel() {
    if (!sentinel) {
      sentinel = document.createElement("div");
      sentinel.id = "home-card-sentinel";
      sentinel.setAttribute("aria-hidden", "true");
      sentinel.style.width = "100%";
      sentinel.style.height = "1px";
    }

    if (!sentinel.isConnected) {
      container.appendChild(sentinel);
    }

    sentinel.hidden = currentlyDisplayed >= pages.length;
  }

  function setupInfiniteScroll() {
    ensureSentinel();

    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting || isLoadingMore || currentlyDisplayed >= pages.length) {
          return;
        }

        requestAnimationFrame(() => appendItems(currentlyDisplayed, ITEMS_PER_LOAD));
      }, {
        rootMargin: "900px 0px",
      });
    }

    observer.disconnect();
    if (currentlyDisplayed < pages.length) {
      observer.observe(sentinel);
    }
  }

  function fillViewportIfNeeded() {
    if (isLoadingMore || currentlyDisplayed >= pages.length) return;

    const sentinelRect = sentinel ? sentinel.getBoundingClientRect() : null;
    const needsMore = !sentinelRect || sentinelRect.top <= window.innerHeight + 160;
    if (!needsMore) return;

    requestAnimationFrame(() => {
      appendItems(currentlyDisplayed, ITEMS_PER_LOAD);
      setupInfiniteScroll();
      fillViewportIfNeeded();
    });
  }

  // Initial render cards
  function renderAll() {
    container.innerHTML = "";
    if (pages.length === 0) {
      container.innerHTML = "<p class='text-muted'>No pages found.</p>";
      return;
    }

    currentlyDisplayed = 0;
    appendItems(0, INITIAL_ITEMS);
    setupInfiniteScroll();
    fillViewportIfNeeded();
  }

  function shufflePages() {
    for (let i = pages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pages[i], pages[j]] = [pages[j], pages[i]];
    }
  }

  // Sort logic
  function sortPages(modeOverride) {
    const sortBy = typeof modeOverride === "string"
      ? modeOverride
      : (sortSelect ? sortSelect.value : "updated_desc");

    if (sortBy === "updated_desc") {
      pages.sort((a, b) => b._modifiedTs - a._modifiedTs);
    } else if (sortBy === "updated_asc") {
      pages.sort((a, b) => a._modifiedTs - b._modifiedTs);
    } else if (sortBy === "created_desc") {
      pages.sort((a, b) => b._createdTs - a._createdTs);
    } else if (sortBy === "created_asc") {
      pages.sort((a, b) => a._createdTs - b._createdTs);
    } else if (sortBy === "title") {
      pages.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "random") {
      shufflePages();
    }

    renderAll();
  }

  // Event Listeners
  if (sortSelect) {
      sortSelect.addEventListener("change", function() {
        sortPages();
      });
  }

  // Initial render (default sort is updated_desc)
  sortPages();
});
