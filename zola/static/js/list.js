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

let oneHopNodes = [];
let outgoingNodes = [];

if (curr_node) {
    // 1-hop links (all direct links in and out)
    oneHopNodes = list_data.edges
        .filter((edge) => edge.from === curr_node.id || edge.to === curr_node.id)
        .map((edge) => (edge.from === curr_node.id ? edge.to : edge.from))
        .map((id) => list_data.nodes.find((node) => node.id === id))
        .filter(n => n);
        
    // Outgoing specific (to be used as 2-hop hubs)
    outgoingNodes = list_data.edges
        .filter((edge) => edge.from === curr_node.id)
        .map((edge) => list_data.nodes.find((node) => node.id === edge.to))
        .filter(n => n);
}

// 2-hop calculation
let twoHopGroups = []; // { hub: node, links: [node] }

outgoingNodes.forEach((hub) => {
    // Find all OTHER nodes that link TO this hub
    let edgesToHub = list_data.edges.filter(e => e.to === hub.id && e.from !== curr_node.id);
    let linkedNodes = edgesToHub
        .map(e => list_data.nodes.find(n => n.id === e.from))
        .filter(n => n);
        
    if (linkedNodes.length > 0) {
        linkedNodes.sort((a,b) => a.label.localeCompare(b.label));
        twoHopGroups.push({
            hub: hub,
            links: linkedNodes
        });
    }
});

// Sort sets
oneHopNodes = Array.from(new Set(oneHopNodes));
oneHopNodes.sort((a,b) => a.label.localeCompare(b.label));
twoHopGroups.sort((a,b) => a.hub.label.localeCompare(b.hub.label));

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

function getCardData(node) {
  const fullData = typeof page_data !== "undefined"
    ? page_data.find((page) => page.url === node.url || decodeURI(page.url) === decodeURI(node.url))
    : null;

  return fullData || { url: node.url, title: node.label };
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

function createHubCard(page) {
  const card = document.createElement("a");
  card.href = page.url;
  card.className = "home-card twohop-hub-card text-decoration-none";

  const title = document.createElement("h5");
  title.className = "home-card-title twohop-hub-card-title";
  title.textContent = page.title || page.label;

  const body = document.createElement("div");
  body.className = "home-card-body twohop-hub-card-body";

  const label = document.createElement("div");
  label.className = "twohop-hub-card-label";
  label.textContent = "Links";

  const icon = document.createElement("div");
  icon.className = "twohop-hub-card-icon";
  icon.textContent = "⛓";

  body.appendChild(label);
  body.appendChild(icon);
  card.appendChild(title);
  card.appendChild(body);
  return card;
}

// Get container for list
var container = document.getElementById("list");
container.innerHTML = "";

// 1. Render Links (1-hop)
var titleEl = document.createElement("h3");
titleEl.textContent = "Links";
titleEl.className = "links-section-title";
container.appendChild(titleEl);

if (oneHopNodes.length !== 0) {
    var grid = document.createElement("div");
    grid.className = "link-card-grid";
    
    oneHopNodes.forEach((node) => {
    let cardData = getCardData(node);
        let card = createCard(cardData);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// 2. Render 2-hop links
if (twoHopGroups.length > 0) {
    var spacer = document.createElement("div");
    spacer.className = "twohop-spacer";
    container.appendChild(spacer);
    
    twoHopGroups.forEach(group => {
        var groupSection = document.createElement("div");
        groupSection.className = "twohop-group";
        
        var grid = document.createElement("div");
        grid.className = "link-card-grid twohop-link-card-grid";

        const hubCard = createHubCard(getCardData(group.hub));
        grid.appendChild(hubCard);
        
        group.links.forEach((node) => {
            let cardData = getCardData(node);
            let card = createCard(cardData);
            grid.appendChild(card);
        });
        
        groupSection.appendChild(grid);
        container.appendChild(groupSection);
    });
}