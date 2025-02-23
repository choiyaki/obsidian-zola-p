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
var curr_node = graph_data.nodes.find((node) => decodeURI(node.url) === curr_url);
var connected_nodes = [];

if (curr_node) {
    connected_nodes = graph_data.edges
        .filter((edge) => edge.from === curr_node.id || edge.to === curr_node.id)
        .map((edge) => (edge.from === curr_node.id ? edge.to : edge.from))
        .map((id) => graph_data.nodes.find((node) => node.id === id));
}

console.log("connected_nodes",connected_nodes);


//本文を取得
const text = Array.from(document.querySelectorAll(".docs-content:not(#list)"))
    .map(el => el.innerText) // 各要素のテキストを取得
    .join("\n"); // 改行で結合

console.log("本文", text);

function filterArrayByText(text, items) {
    return items.filter(item => !text.includes(item.label));
}

const filteredItems = filterArrayByText(text, connected_nodes);
console.log("残って欲しいものだけかな？", filteredItems);

// Get container for list
var container = document.getElementById("list");

// Clear previous content
container.innerHTML = "";

// Create list elements
if (curr_node) {
    var title = document.createElement("h2");
    title.textContent = "Current Node: " + curr_node.label;
    container.appendChild(title);

    var list = document.createElement("ul");
    connected_nodes.forEach((node) => {
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
    container.textContent = "No related nodes found.";
}