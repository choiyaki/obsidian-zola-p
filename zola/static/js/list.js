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

// Get container for list
var container = document.getElementById("list");

// Clear previous content
container.innerHTML = "";

// Create list elements
var title = document.createElement("h5");
title.textContent = "Back Links: ";
title.style.color = "gray";
container.appendChild(title);

if (filteredItems.length !== 0) {
    var list = document.createElement("ul");
    filteredItems.forEach((node) => {
        var listItem = document.createElement("li");
        var link = document.createElement("a");
        link.href = node.url;
        link.textContent = node.label;
        link.target = "_self";
        listItem.appendChild(link);
        list.appendChild(listItem);
    });

    container.appendChild(list);
} else {
    container.appendChild("No backlinks found.");
}