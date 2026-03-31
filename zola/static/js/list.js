// Query dark mode setting
function isDark() {
    return localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

// Get URL of current page and also current node
var curr_url = decodeURI(window.location.href.replace(location.origin, ""));
if (curr_url.endsWith("/")) {
    curr_url = curr_url.slice(0, -1);
}

// Parse nodes and edges
var curr_node = list_data.nodes.find((node) => decodeURI(node.url) === curr_url);
var connected_nodes = [];

if (curr_node) {
    connected_nodes = list_data.edges
        .filter((edge) => edge.from === curr_node.id || edge.to === curr_node.id)
        .map((edge) => (edge.from === curr_node.id ? edge.to : edge.from))
        .map((id) => list_data.nodes.find((node) => node.id === id));
}

console.log("connected_nodes", connected_nodes);

// 本文を取得
const text = Array.from(document.querySelectorAll(".docs-content:not(#list)"))
    .map(el => el.innerText) // 各要素のテキストを取得
    .join("\n"); // 改行で結合

console.log("本文", text);

function filterArrayByText(text, items) {
    return items.filter(item => !text.includes(item.label));
}

let filteredItems = filterArrayByText(text, connected_nodes);

// ここで filteredItems をアルファベット順（label 昇順）にソート
filteredItems.sort((a, b) => a.label.localeCompare(b.label));

console.log("ソート後の残って欲しいもの", filteredItems);

// Helper to format date
function formatDate(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString();
}

// Helper to build snippet securely
function buildSnippetDOM(content, container) {
  if (!content) return;
  
  let text = content.replace(/^[#>\-\*]+\s/gm, "");
  text = text.replace(/[*`_]/g, "");
  text = text.replace(/\n+/g, " ");
  
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

// Create Card
function createCard(page) {
  const card = document.createElement("a");
  card.href = page.url;
  card.className = "home-card text-decoration-none";
  
  const title = document.createElement("h5");
  title.className = "home-card-title";
  title.textContent = page.title || page.label;
  
  const body = document.createElement("div");
  body.className = "home-card-body";
  
  if (page.thumbnail) {
    const imgContainer = document.createElement("div");
    imgContainer.className = "home-card-thumbnail-container";
    const img = document.createElement("img");
    img.src = page.thumbnail;
    img.className = "home-card-thumbnail";
    img.onerror = function() { this.style.display = 'none'; };
    imgContainer.appendChild(img);
    body.appendChild(imgContainer);
  } else if (page.content) {
    const snippet = document.createElement("div");
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

  const meta = document.createElement("div");
  meta.className = "home-card-meta text-muted mt-auto";
  meta.style.fontSize = "0.7rem";
  meta.style.display = "none";
  meta.textContent = `Updated: ${formatDate(page.modified)}`;
  body.appendChild(meta);

  card.appendChild(title);
  card.appendChild(body);
  return card;
}

// Get container for list
var container = document.getElementById("list");
container.innerHTML = "";

var titleEl = document.createElement("h5");
titleEl.textContent = "Links";
titleEl.style.color = "gray";
titleEl.style.marginTop = "3rem";
container.appendChild(titleEl);

if (filteredItems.length !== 0) {
    var grid = document.createElement("div");
    grid.className = "link-card-grid";
    grid.style.marginTop = "1rem";
    
    filteredItems.forEach((node) => {
        // Find full page_data if available
        let fullData = typeof page_data !== 'undefined' ? page_data.find(p => p.url === node.url || decodeURI(p.url) === decodeURI(node.url)) : null;
        let cardData = fullData || { url: node.url, title: node.label };
        
        let card = createCard(cardData);
        grid.appendChild(card);
    });

    container.appendChild(grid);
} else {
    let emptyMsg = document.createElement("p");
    emptyMsg.textContent = "No backlinks found.";
    emptyMsg.className = "text-muted";
    container.appendChild(emptyMsg);
}