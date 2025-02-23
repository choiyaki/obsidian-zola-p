// Query dark mode setting
function isDark() {
    return localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

// URL 正規化関数
var normalizeURL = (url) => decodeURI(url).replace(/\/$/, "");

// Get URL of current page and also current node
var curr_url = normalizeURL(window.location.href.replace(location.origin, ""));
var curr_node = graph_data.nodes.find((node) => normalizeURL(node.url) === curr_url);

console.log("Current URL:", curr_url);
console.log("Current node URL:", normalizeURL(curr_node.id));


var backlinks = [];

if (curr_node) {
    backlinks = graph_data.edges
        .filter((edge) => String(edge.to) === String(curr_node.id)) // **バックリンクのみ取得**
        .map((edge) => graph_data.nodes.find((node) => String(node.id) === String(edge.from)))
        .filter(Boolean); // `undefined` を削除
}

console.log("backlinks:", backlinks);

// Get container for list
var container = document.getElementById("list");

// Clear previous content
container.innerHTML = "";

// Create list elements
if (curr_node) {
    var title = document.createElement("h2");
    title.textContent = "Backlinks to: " + curr_node.label;
    container.appendChild(title);

    if (backlinks.length > 0) {
        var list = document.createElement("ul");
        backlinks.forEach((node) => {
            var listItem = document.createElement("li");
            var link = document.createElement("a");
            link.href = node.url;
            link.textContent = node.label;
            link.target = "_blank";
            listItem.appendChild(link);
            list.appendChild(listItem);
        });
        container.appendChild(list);
    } else {
        var noLinks = document.createElement("p");
        noLinks.textContent = "No backlinks found.";
        container.appendChild(noLinks);
    }
} else {
    container.textContent = "Page not found in graph data.";
}