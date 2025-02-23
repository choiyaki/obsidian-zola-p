// Query dark mode setting
function isDark() {
    return localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

// Get URL of current page and also current node
var curr_url = decodeURI(window.location.href.replace(location.origin, ""));
if (curr_url.endsWith("/")) {
    curr_url = curr_url.slice(0, -1);
}

// Find current node
var curr_node = graph_data.nodes.find((node) => decodeURI(node.url) === curr_url);

// Extract backlinks (nodes that link to the current node)
if (curr_node) {
    var backlinks = graph_data.edges
        .filter((edge) => edge.to === curr_node.id) // Only backlinks (where 'to' matches the current node)
        .map((edge) => {
            return graph_data.nodes.find((node) => node.id === edge.from);
        })
        .filter(Boolean); // Remove any null values
} else {
    var backlinks = [];
}

// Create list elements for backlinks
var container = document.getElementById("backlinks-list");
if (!container) {
    container = document.createElement("ul");
    container.id = "backlinks-list";
    document.body.appendChild(container);
} else {
    container.innerHTML = ""; // Clear previous content
}

if (backlinks.length > 0) {
    backlinks.forEach((node) => {
        var listItem = document.createElement("li");
        var link = document.createElement("a");
        link.href = node.url;
        link.textContent = node.title || node.url; // Use title if available, otherwise URL
        listItem.appendChild(link);
        container.appendChild(listItem);
    });
} else {
    container.innerHTML = "<p>No backlinks found.</p>";
}